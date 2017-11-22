/*
TODO: Long polling
TODO: Names of Outline properties are confusing; e.g. "c" could stand for "children"
TODO: Differences between `doss.getValue`, `doss.getData` need to be better understood
*/

var LOG_QUERIES = false;
var package = new PACK.pack.Package({ name: 'dossier',
  dependencies: [ 'tree', 'queries', 'worry', 'p' ],
  buildFunc: function(packName, tree, queries, worry, p) {
    
    var P = p.P;
    
    var ds = {};
    
    ds.selectAll = {};
    ds.selectAll['*'] = ds.selectAll;
    
    ds.update({
      
      NAME_REGEX: /^[a-zA-Z0-9<][a-zA-Z0-9-_<,>]*$/, // The goddam tilde is now allowed in the name, to allow the root to be named "~root"
      NEXT_TEMP: 0,
      getTempName: function() {
        var id = U.id(ds.NEXT_TEMP++);
        if (id === 'ffffffff') throw new Error('EXHAUSTED IDS');
        return 'TEMP((' + id + '))';
      },
      
      /* Outline - define what a Dossier structure looks like */
      Outline: U.makeClass({ name: 'Outline',
        superclass: tree.TreeNode,
        propertyNames: [ 'c', 'p', 'i' ],
        methods: function(sc) { return {
          
          init: function(params /* name, dynamic, c, p, i */) {
            
            sc.init.call(this, params);
            
            // NOTE: A dynamic `Outline` should correspond to a `DossierArr`
            this.dynamic = U.param(params, 'dynamic', false);
            
            var c = U.param(params, 'c');
            this.c = U.isObj(c, String) ? c : c.title; // If not a string, it's a class
            this.p = U.param(params, 'p', {});
            
            // Ensure the "innerOutline" is an `Outline` instance
            if (this.p.contains('innerOutline') && !U.isInstance(this.p.innerOutline, ds.Outline)) {
              this.p.innerOutline = new ds.Outline(this.p.innerOutline.update({ dynamic: true }));
              this.p.innerOutline.par = this;
            }
            
            var i = U.param(params, 'i', []);
            this.i = {};
            
            if (U.isObj(i, Array)) {
              
              for (var j = 0, len = i.length; j < len; j++) {
                var outline = i[j];
                if (!U.isInstance(outline, ds.Outline)) outline = new ds.Outline(outline);
                this.i[outline.name] = outline;
                outline.par = this;
              }
              
            } else if (U.isObj(i, Object)) {
              
              for (var k in i) {
                var outline = i[k];
                
                if (!U.isInstance(outline, ds.Outline)) {
                  if (outline.contains('name') && outline.name !== k) throw new Error('Conflicting outline names: "' + outline.name + '" and "' + k + '"');
                  outline = new ds.Outline(outline.update({ name: k }));
                } else {
                  if (outline.name !== k) throw new Error('Conflicting outline names: "' + outline.name + '" and "' + k + '"');
                }
                
                this.i[outline.name] = outline;
                outline.par = this;
                
              }
              
            } else {
              
              throw new Error('Invalid "i" parameter');
              
            }
            
            if (!U.isEmptyObj(this.i) && this.p.contains('innerOutline'))
              throw new Error('An `Outline` cannot have both an inner outline and children');
            
          },
          getNamedChild: function(name) {
            if (this.p.innerOutline) return this.p.innerOutline;
            return this.i[name] || null;
          },
          addChild: function(name, cls, p) {
            
            var data = {};
            data.name = name;
            data.c = cls;
            data.p = p || {};
            
            if (!data.name) throw new Error('Invalid "name" property');
            if (this.p.innerOutline) throw new Error('Cannot add children to an outline with "innerOutline" property');
            if (this.i.contains(data.name)) throw new Error('Tried to overwrite outline "' + data.name + '"');
            
            var outline = new ds.Outline(data);
            this.i[outline.name] = outline;
            outline.par = this;
            
            return outline;
            
          },
          addDynamicChild: function(name, cls, p) {
            
            var nameFunc = U.param(p, 'nameFunc');
            delete p.nameFunc;
            
            var data = { name: name, c: cls, dynamic: true, p: p };
            
            if (!data.name) throw new Error('Invalid "name" property');
            if (!U.isEmptyObj(this.i)) throw new Error('Cannot add a dynamic child to an outline with children');
            
            var outline = new ds.Outline(data);
            this.p.innerOutline = outline;
            this.p.nameFunc = nameFunc;
            
            outline.par = this;
            
            return outline;
            
          },
          getAbility: function(name) {
            var abl = this.p.abilities;
            if (!abl || !abl.contains(name)) throw new Error('Outline "' + this.getAddress() + '" has no ability "' + name + '"');
            return abl[name];
          }
          
        };}
      }),
      
      /* Editor - make changes to Dossier structures */
      Editor: U.makeClass({ name: 'Editor',
        methods: function(sc, c) { return {
          
          init: function(params) {
            this.atomics = [];
            this.$transaction = new P({});
            this.count = 0;
            this.id = global.NEXT_ID++;
          },
          
          // The next 4 methods are NOT atomics; they are molecules
          // Atomics themselves cannot immediately add more atomics!!
          add: function(params /* par, name, data, outline, recurseArr, recurseObj */) {
            
            var guid = global.NEXT_ID++;
            
            var par = U.param(params, 'par', null);
            var name = U.param(params, 'name', null);
            var data = U.param(params, 'data', null);
            var outline = U.param(params, 'outline', null);
            var recurseArr = U.param(params, 'recurseArr', true);
            var recurseObj = U.param(params, 'recurseObj', true);
            
            if (!outline) {
              if (!par) throw new Error('`add` requires either "outline" or "par" param');
              outline = par.getChildOutline(name || null);
              if (!outline) throw new Error('Couldn\'t get outline');
            }
            
            // If `name` wasn't provided it can be filled in on 2 occasions:
            // 1) The outline is the root outline, in which case name MUST be "~root"
            // 2) The outline isn't dynamic, in which case names are known ahead of time via `outline.name`
            var forceName = false;
            if (!outline.par) {
              name = '~root';
              forceName = true;
            } else if (!outline.dynamic) {
              if (name !== outline.name) throw new Error('Tried to rename non-dynamic doss "' + outline.name + '" to "' + name + '"');
            }
            
            // Step 1: Initialize the doss
            var DossCls = U.deepGet({ root: C, name: outline.c });
            var doss = new DossCls({ outline: outline }.update(outline.p).update({ name: outline.name }));
            
            // Immediately setting `par` can give us more flexibility while creating `Dossiers`
            // Note that this is NOT the correct way to initialize the parent. An atomic must
            // do so. `doss.par` is reset to null at the end of this method.
            if (par) doss.par = par; 
            
            // Step 2: Initialize the name
            if (name) this.$addAtomic(c.atomicSetNameSimple, [ doss, name, forceName ], (forceName ? 'frcname' : 'setname') + ' ::: ' + doss.name + ' -> ' + name);
            else      this.$addAtomic(c.atomicSetNameCalculated, [ doss ], 'clcname ::: ' + doss.name);
            
            // Step 3: Add to parent
            if (par) this.$addAtomic(c.atomicAddChild, [ par, doss ], 'addchld ::: ' + par.name + ' -> ' + doss.name);
            
            // Step 4: Add the data (which can result in recursive `this.$addAtomic` calls)
            if (U.isInstance(doss, ds.DossierSet)) {
              
              if (U.isInstance(doss, ds.DossierArr) && data && recurseArr) {
                
                if (!U.isObj(data, Object)) throw new Error('DossierArr must receive an `Object` as its value');
                for (var k in data)
                  this.add({ par: doss, outline: doss.getChildOutline(k), data: data[k], recurseArr: true, recurseObj: recurseObj });
                
              } else if (U.isInstance(doss, ds.DossierObj) && recurseObj) {
                
                data = data || {};
                if (!U.isObj(data, Object)) throw new Error('DossierObj must receive an `Object` as its value');
                for (var k in doss.outline.i)
                  this.add({ par: doss, outline: doss.getChildOutline(k), data: data[k] || null, name: k, recurseArr: recurseArr, recurseObj: true });
                
              }
              
            } else if (U.isInstance(doss, ds.DossierVal)) {
              
              if (data !== null)
                this.$addAtomic(c.atomicModData, [ doss, data ], 'moddata ::: ' + doss.name + ' -> ' + U.typeOf(data));
              
            }
            
            // Step 5: Start the doss
            this.$addAtomic(c.atomicStartDoss, [ doss ], 'sttdoss ::: ' + doss.outline.getAddress());
            
            doss.par = null; // Ensure that `par` is not initialized by any means other than an atomic
            
            return doss;
            
          },
          rem: function(params /* par, child */) {
            var par = U.param(params, 'par');
            var child = U.param(params, 'child');
            if (!U.isInstance(child, ds.Dossier)) throw new Error('"child" param for rem must be Dossier');
            this.$addAtomic(c.atomicStopDoss, [ child ]);
            this.$addAtomic(c.atomicRemChild, [ par, child ]);
          },
          mod: function(params /* doss, data */) {
            var doss = U.param(params, 'doss');
            var data = U.param(params, 'data');
            this.$addAtomic(c.atomicModData, [ doss, data ], 'moddata ::: ' + doss.name + ' -> ' + U.typeOf(data));
          },
          edit: function(params /* add, mod, rem */) {
            return {
              add: U.param(params, 'add', []).map(this.add.bind(this)),
              mod: U.param(params, 'mod', []).map(this.mod.bind(this)),
              rem: U.param(params, 'rem', []).map(this.rem.bind(this))
            };
          },
          
          $addAtomic: function(atomic, args, desc) {
            
            if (!desc) {
              console.log('NO DESC FOR ', atomic);
              throw new Error('Must provide "desc" to `$addAtomic`');
            }
            
            if (!U.isObj(atomic, Function)) throw new Error('"atomic" must be a `Function`');
            
            /*
            An "atomic" is a function which returns a result of the following
            format (or throws an error):
            
            anAtomic(...) === {
              $result: <promise with atomic result>,
              undoAtomic: <an atomic that is the inverse of the original>
            }
            
            An "atomic" must also fulfill the following criteria:
            1)  If the atomic function throws an error, or if the "$result"
                property becomes rejected, the atomic must have not made any
                changes to the state.
            2)  Calling the "undoAtomic" property after the "$result"
                property has resolved must leave the state as if no action
                were performed in the first place
            */
            
            var $ret = new P({});
            
            var func = function() {
              
              // `$ret` resolves if `result.$result` resolves, but doesn't necessarily
              // reject if `result.$result` rejects
              // TODO: When should `$ret` reject?? And implement this rejection
              
              try {
                
                var result = atomic.apply(null, args);
                result.$result = result.$result.then(function(val) { $ret.resolve(val); return val; });
                
              } catch(err) {
                
                var result = {
                  $result: new P({ err: err }),
                  undoAtomic: function() { return { $result: p.$null }; }
                };
                
              }
              
              result.$rejectable = $ret; // TODO: Need to tell `$ret` it rejected if it didn't resolve
              
              return result;
              
            };
            
            func.desc = desc || '- no description -';
            this.atomics.push(func);
            
            return $ret;
            
          },
          
          getTransactionDetails: function() {
            return this.atomics.map(function(atm) { return atm.desc; });
          },
          $transact: function() {
            
            // Simply calls $recurseStage, resolves/rejects `this.$transaction`
            // appropriately, and upon completion resets itself for the next
            // transaction.
            
            var pass = this;
            var transactionName = 'trn<' + this.id + '/' + this.count + '>';
            this.count++;
            
            return this.$recurseStage(transactionName, 0).then(function(recResults) {
              
              if (!recResults.errors.length) return recResults;
              
              /*
              // Atomic batch could not be completed!
              console.log('Stage failed due to ' + recResults.errors.length + ' error(s):');
              //for (var i = 0; i < recResults.errors.length; i++) {
              //  console.log((i + 1) + ': ' + recResults.errors[i].stack);
              //}
              console.log(recResults.errors.toObj(function(v, n) { return n; }, function(err) {
                return err.stack.split('\n').map(function(ln) { return ln.trim(); });
              }));
              */
              
              console.log('UNDOING???');
              return pass.$recurseAtomics('undo(' + transactionName + ')', 0, 0, recResults.undoAtomics).then(function(undoResults) {
                
                if (undoResults.errors.length) {
                  // Undo batch could not be completed!
                  console.log('Undo failed (this is REAL BAD) due to ' + undoResults.errors.length + ' error(s):\n');
                  for (var i = 0, len = undoResults.errors.length; i < len; i++) console.log('FATAL #' + (i + 1) + ':', undoResults.errors[i].stack, '\n');
                  throw new Error('FATAL MFRF (transaction undo failed; data may be corrupted)');
                }
                
                var msg = 'Stage failed due to ' + recResults.errors.length + ' error(s):\n' +
                  recResults.errors.slice(0, 100).map(function(err, n) { return '  ' + (n + 1) + ': ' + err.stack.split('\n').slice(0, 2).join('\n'); }).join('\n');
                
                throw new Error(msg);
                
              });
                
            }).then(function(recResults) {
              
              pass.$transaction.resolve(null);
              pass.atomics = [];
              pass.$transaction = new P({});
              return recResults;
              
            }).fail(function(err) {
              
              pass.$transaction.reject(err);
              pass.atomics = [];
              pass.$transaction = new P({});
              throw err;
              
            });
            
          },
          $recurseStage: function(type, stageNum) {
            
            /*
            Recursively completes transaction stages until a transaction has completed
            without generating any atomics for the next stage. When this happens the
            stage is "complete".
            */
            
            var desc = type + '(' + stageNum + ')';
            
            var pass = this;
            var atomics = this.atomics;
            this.atomics = [];
            
            return this.$recurseAtomics(type, stageNum, 0, atomics).then(function(recResults) {
              
              // Three possibilities at this point:
              // 1) The stage successfully completed without errors, so the entire process of stage recursion is complete!
              // 2) The stage successfully completed with errors - all is well so far, but another stage is necessary
              // 3) The stage failed. It cannot be completed, and an undo transaction will be performed
              //    (NOTE: The undo transaction will either be successful, or if not, result in a FATAL error).
              
              // console.log('Completed stage: ' + desc + ' with ' + recResults.undoAtomics.length + ' atomics');
              
              if (recResults.errors.length || !pass.atomics.length) {
                
                recResults.attemptArr = [ recResults.attemptNum ];
                return recResults;
                
              }
              
              return pass.$recurseStage(type, stageNum + 1).then(function(recNextResults) {
                
                var oldAtm = pass.atomics;
                pass.atomics = recNextResults.undoAtomics;
                var trnDesc = pass.getTransactionDetails();
                pass.atomics = oldAtm;
                
                // Add the recursive call's atomics to the previous call's atomics
                recNextResults.undoAtomics = recResults.undoAtomics.concat(recNextResults.undoAtomics);
                
                // Keep a log of the number of attempts required at all stages
                recNextResults.attemptArr = [ recNextResults.attemptNum ].concat(recNextResults.attemptArr);
                
                return recNextResults;
                
              });
              
            });
            
          },
          $recurseAtomics: function(type, stageNum, attemptNum, atomics) {
            
            // Returns { errors: <errors>, undoAtomics: <undoAtomics>, remainingAtomics: <remainingAtomics>, attemptNum: <attemptNum> }
            // This method signals error conditions by setting a non-empty "errors" property
            // within its return value. It doesn't throw errors or return rejected promises.
            
            var pass = this;
            return new P({ all: U.arr.map(atomics, function(atomic) {  // Try to get the result of all atomics
              
              var result = atomic();
              
              if (!result || !result.contains('$result')) {
                console.log('WTFFFF', atomic.desc);
                throw new Error('DAMN');
              }
              
              return result.$result.then(function(val) {
                return { status: 'success', undoAtomic: result.undoAtomic };
              }).fail(function(err) {
                return { status: 'failure', error: err, atomic: atomic };
              });
              
            })}).then(function(atomicResultArr) {               // Return results or reattempt as necessary
              
              var errors = [];
              var remainingAtomics = [];
              var undoAtomics = [];
              
              // Represent all results according to errors, remainingAtomics, and undoAtomics
              for (var i = 0, len = atomicResultArr.length; i < len; i++) {
                var ar = atomicResultArr[i];
                if (ar.status === 'success') { undoAtomics.push(ar.undoAtomic); }
                else if (ar.status === 'failure') { remainingAtomics.push(ar.atomic); errors.push(ar.error); }
              }
              
              // If all promises homogenously failed or succeeded, simply return!
              if (!undoAtomics.length || !errors.length) {
                return {
                  undoAtomics: undoAtomics,
                  errors: errors,
                  remainingAtomics: remainingAtomics,
                  attemptNum: attemptNum
                };
              }
              
              // Some atomics passed, and some failed: make another attempt
              return pass.$recurseAtomics(type, stageNum, attemptNum + 1, remainingAtomics).then(function(recResult) {
                recResult.undoAtomics = recResult.undoAtomics.concat(undoAtomics);
                return recResult;
              });
              
            });
            
          }
          
        };},
        statik: function(c) { return {
          atomicStartDoss: function(doss) {
            try {
              
              doss.start();
              return {
                $result: p.$null,
                undoAtomic: c.atomicStopDoss.bind(null, doss)
              };
              
            } catch(err) {
              
              // If `doss.start()` fails, need to ensure that `doss` is stopped before the error propagates
              doss.stop();
              throw err;
              
            }
          },
          atomicStopDoss: function(doss) {
            doss.stop();
            return {
              $result: p.$null,
              undoAtomic: c.atomicStartDoss.bind(null, doss)
            };
          },
          atomicSetNameSimple: function(doss, name, force) {
            
            var origName = doss.name;
            doss.updateName(name, force || null);
            return {
              $result: p.$null,
              undoAtomic: c.atomicSetNameSimple.bind(null, doss, origName, true)
            };
            
          },
          atomicSetNameCalculated: function(doss) {
            
            /*
            // TODO: REQUIREMENTS!!
            var origName = doss.name;
            return {
              $result: doss.$getDependencies().then(function(deps) {
                // TODO: `getChildName` isn't ready to accept a "deps" param
                return doss.updateName(doss.par.getChildName(doss, deps));
              })
            }
            */
            
            var origName = doss.name;
            doss.updateName(doss.par.getChildName(doss));
            
            return {
              $result: p.$null,
              undoAtomic: c.atomicSetNameSimple.bind(null, doss, origName, true)
            };
            
          },
          atomicModData: function(doss, data) {
            
            // Symmetry breaking: `getData()` and `setValue()`, instead of `getData()` and `setData()`
            // Except the symmetrical version doesn't work.
            // TODO: renaming `getData` to `getJson` would clarify this
            var origVal = doss.getData();
            doss.setValue(data);
            return {
              $result: p.$null,
              undoAtomic: c.atomicModData.bind(null, doss, origVal)
            };
            
          },
          atomicAddChild: function(doss, child) {
            
            doss.addChild(child);
            
            return {
              $result: p.$null,
              undoAtomic: c.atomicRemChild.bind(null, doss, child)
            };
            
          },
          atomicRemChild: function(doss, child) {
            
            doss.remChild(child);
            
            return {
              $result: p.$null,
              undoAtomic: c.atomicAddChild.bind(null, doss, child)
            };
            
          }
        };}
      }),
      
      /* Abilities - enable functionality on Dossiers */
      Ability: U.makeClass({ name: 'Ability',
        // TODO: Should this be a TreeNode?
        // TODO: There may be some trouble with errors thrown in "stage" - ideally, errors should only be thrown from "doValidate(Rec)?"
        methods: function(sc, c) { return {
          init: function(params /* outline, par, validate, validateBelow */) {
            this.par = U.param(params, 'par', null);
            this.validate = U.param(params, 'validate', null);
            this.validateBelow = U.param(params, 'validateBelow', null);
            this.decorate = U.param(params, 'decorate', null);
            this.public = U.param(params, 'public', false);
          },
          doValidateRec: function(editor, doss, below, params) {
            
            /*
            - `editor`:
                The editor instance associated with this ability's transaction
            - `doss`:
                The doss associated with this ability's transaction
            - `below`:
                The result of all parent's `validateBelow` functions chained.
                If `below` is `null`, it means that no parent validation has
                occurred yet. In this case, parents must be validated
                recursively (beginning with the deepest validating parent)
            - `params`:
                The client-passed parameters associated with this transaction
            */
            
            // Recursively runs all parent "validateBelow" checks starting with
            // the deepest parent, and propagating return values from deepest to
            // shallowest.
            if (below === null && this.par) {
              if (!doss.par) throw new Error('Can\'t validate parent when doss parent is null');
              below = this.par.doValidateRec(editor, doss.par, null, params);
            }
            return this.validateBelow ? this.validateBelow(editor, doss, below, params) : below;
            
          },
          doValidate: function(editor, doss, below, params) {
            var below = this.doValidateRec(editor, doss, below, params);
            return {
              below: below,
              params: this.validate ? this.validate(editor, doss, below, params) : params
            };
          },
          use: function(editor, doss, below, params /* data */) {
            
            //console.log('RUNNING ' + doss.outline.getAddress() + '.' + this.constructor.title + '()');
            var validated = this.doValidate(editor, doss, below, params);
            var below = validated.below;
            var params = validated.params;
            
            // Completes the stem of Y-validation, and calls `this.stage`
            var result = this.stage(editor, doss, below, params);
            return this.decorate ? this.decorate(result, editor, doss, below, params) : result;
            
          },
          stage: function(editor, doss, below, params) {
            
            // Note: If `stage` ever calls the `use` methods of child abilities, it should
            // pass `below` so that parent validation is not repeated
            throw new Error('Not implemented');
            
          }
        };}
      }),
      AbilityGet: U.makeClass({ name: 'AbilityGet', superclassName: 'Ability',
        methods: function(sc, c) { return {
          stage: function(editor, doss, below, params) {
            
            if (U.isInstance(doss, ds.DossierRef)) {          // Returning a ref's value is easy
              
              return doss.value ? doss.getRefAddress() : null;
              
            } else if (U.isInstance(doss, ds.DossierVal)) {   // Returning a val's value is super easy
              
              return doss.value;
              
            } else if (U.isInstance(doss, ds.DossierSet)) {   // Returning a set's value is tricky. Need to recurse, support "*" and "rename", etc.
              
              var selection = U.param(params, 'selection', ds.selectAll);
          
              // Support the "*" selector (TODO: Consider removing the "*" selector?)
              if (selection.contains('*')) {
                
                var innerParams = params.clone({ selection: selection['*'] });
                return doss.children.map(function(child, k) {
                  return child.hasAbility('get') ? child.stageAbility('get', editor, below, innerParams) : U.SKIP;
                });
                
              }
                
              var ret = {};
              for (var k in selection) {
                
                // Support the "rename" operator
                if (k[0] === '(') {
                  var rb = k.indexOf(')');
                  if (rb === -1) return new P({ err: 'Couldn\'t parse rename operator for selector "' + k + '"' });
                  var rename = k.substr(1, rb - 1);
                  var addr = k.substr(rb + 1).trim();
                } else {
                  var rename = k;
                  var addr = k;
                }
                
                var child = doss.getChild(addr);
                if (!child || !child.hasAbility('get')) { throw new Error('Invalid selection address: "' + addr + '"'); console.log('WARNING, HERE!!'); }
                
                // NOTE: The "below" value is calculated from scratch if `getChild` resulted in a `Dossier` that isn't a direct child
                ret[rename] = child.stageAbility('get', editor, doss.hasChild(child) ? below : null, params.clone({ selection: selection[k] }));
                
              }
              return ret;
              
            }
            
            throw new Error('Unexpected `doss` value: ' + U.typeOf(doss));
            
          }
        };}
      }),
      AbilityMod: U.makeClass({ name: 'AbilityMod', superclassName: 'Ability',
        methods: function(sc, c) { return {
          stage: function(editor, doss, below, params) {
            
            if (U.isInstance(doss, ds.DossierVal)) {
              
              editor.mod({ doss: doss, data: U.param(params, 'data') });
              return null;
              
            } else if (U.isInstance(doss, ds.DossierObj)) {
              
              var data = U.param(params, 'data');
              if (!U.isObj(data, Object)) throw new Error('mod ability expects "data" to be an `Object`');
              
              for (var k in data) {
                if (!doss.children.contains(k)) {
                  U.debug('MISSING KEY: ' + k, doss.getData());
                  throw new Error('Invalid child key in mod ability: ' + doss.outline.getAddress() + ' -> ' + k);
                }
                doss.children[k].stageAbility('mod', editor, below, params.clone({ data: data[k] }));
              }
              return null;
              
            } else if (U.isInstance(doss, ds.DossierArr)) {
              
              // `DossierArr` modding works by supplying `data` as a "delta" `Object`,
              // where any keys of the delta whose value is `null` are removed from
              // the `DossierArr`, and any non-null values are added. Existing values
              // CANNOT be modified. Instead, a "mod" ability should be used directly
              // on the existing value.
              
              var data = U.param(params, 'data');
              var children = [];
              
              for (var childName in data) {
                
                var childData = data[childName];
                if (childData === null) { // TODO: Could consider using another value apart from `null` (can't have `null` values in a `DossierArr`)
                  
                  if (!doss.children.contains(childName)) throw new Error('Invalid removal name: ' + doss.getAddress() + ' -> ' + childName);
                  editor.rem({ par: doss, child: doss.children[childName] });
                  
                } else {
                  
                  var child = editor.add({ par: doss, data: childData, recurseArr: false, recurseObj: true });
                  children.push(child);
                  editor.$addAtomic(function(child0, editor0, below0, params0) {
                    
                    if (!child0.started) throw new Error('Can\'t run until started');
                    child0.stageAbility('mod', editor0, below0, params0);
                    
                    return {
                      $result: p.$null,
                      undoAtomic: function() { return { $result: p.$null }; }
                    };
                    
                  }, [ child, editor, below, params.clone({ data: childData }) ], 'recstag ::: ' + child.outline.getAddress());
                  
                }
                
              }
              
              return children;
              
            }
            
            throw new Error('Unexpected `doss` value: ' + U.typeOf(doss));
            
          }
        };}
      }),
      
      /* Dossier - data description structure */
      Dossier: U.makeClass({ name: 'Dossier',
        superclass: tree.TreeNode, mixins: [ worry.Worry ],
        resolvers: {
          init: function(initConflicts, params) {
            initConflicts.Worry.call(this, params);
            initConflicts.Dossier.call(this, params);
          },
          start: function(startConflicts) {
            startConflicts.Worry.call(this);
            startConflicts.Dossier.call(this);
          },
          stop: function(stopConflicts) {
            stopConflicts.Worry.call(this);
            stopConflicts.Dossier.call(this);
          }
        },
        methods: function(sc, c) { return {
          
          init: function(params /* outline */) {
            
            // Note: "name" is a required, but ignored, parameter. It is required
            // by `TreeNode.prototype.init`, but will be overwritten immediately
            // afterwards.
            
            sc.init.call(this, params);
            
            this.name = ds.getTempName(); // Here's where `this.name` is overwritten
            this.outline = U.param(params, 'outline');
            
            this.par = null; // The `Dossier` initializes with no parent
            this.started = false;
            
          },
          
          // Construction
          hasResolvedName: function() {
            return this.name.substr(0, 5) !== 'TEMP(';
          },
          updateName: function(name, force) {
            name = name.toString();
            
            if (!force && !ds.NAME_REGEX.test(name)) throw new Error('Illegal Dossier name: "' + name + '" for ' + this.outline.getAddress());
            if (name === this.name) return;
            
            var par = this.par;
            if (par) par.remChild(this);
            
            var origName = this.name;
            this.name = name;
            
            if (par) {
              
              try { par.addChild(this); } catch(err) {
                
                // It's crucial that re-adding `this` to `par` (and failing) doesn't leave
                // the `Dossier` structure changed! Upon failure, revert back to the
                // original, unchanged state and throw an error
                this.name = origName;
                
                // Re-adding with the original name NEEDS to succeed - otherwise there's no
                // way to return to the original state
                try { par.addChild(this); } catch(fatalErr) {
                  console.log('FATAL MFRF due to:', fatalErr.stack);
                  throw new Error('FATAL MFRF');
                }
                
                // Reverting to the original state has succeeded, throw a non-fatal error
                throw err;
                
              }
              
            }
            
            return this;
          },
          
          // Heirarchy
          getNamedChild: function(name) {
            if (U.isObj(name, Array)) name = '<' + name.join('/') + '>';
            
            var numDerefs = 0;
            while (name[numDerefs] === '@') numDerefs++;
            if (numDerefs) name = name.substr(numDerefs);
            
            var child = this.getNamedChild0(name);
            for (var i = 0; (i < numDerefs) && child; i++) child = child.dereference();
            return child;
          },
          getNamedChild0: function(name) {
            if (name === '') return this;
            if (name === '~par') return this.par;
            if (name === '~root') return this.getRoot();
            if (name.substr(0, 5) === '~par(') {
              /*var target = name.substr(5, name.length - 6).trim();
              var ptr = this.par;
              while (ptr !== null) {
                if (ptr.outline.name === target) return ptr;
                ptr = ptr.par;
              }
              return null;*/
              return this.getNamedPar(name.substr(5, name.length - 6).trim());
            }
            
            return null;
          },
          getNamedPar: function(name) {
            var ptr = this.par;
            while (ptr !== null) {
              if (ptr.outline.name === name) return ptr;
              ptr = ptr.par;
            }
            return null;
          },
          isRoot: function() {
            return !this.outline.par;
          },
          isRooted: function() {
            return this.getRoot().isRoot();
          },
          
          // Server/client
          $doRequest: function(params /* address, command, params */) {
            if (U.isObj(params, String)) params = { command: params };
            
            var command = U.param(params, 'command');
            var address = U.param(params, 'address', '');
            var reqParams = U.param(params, 'params', {});
            
            if (U.isObj(address, String)) address = address ? address.split('.') : [];
            
            return PACK.queries.$doQuery({
              address: this.getNameChain().concat(address),
              command: command,
              params: reqParams,
            });
          },
          $handleRequest: function(params /* command, params */) {
            
            var abilityName = U.param(params, 'command');
            var abilityParams = U.param(params, 'params', {});
            
            try {
              
              var editor = new ds.Editor();
              
              // TODO: It feels like a hack right now: `result` can be a promise
              // for doing processing after the transaction; e.g. adding a doss
              // may use `return editor.$transaction.then(function() { return { address: doss.getAddress() }; });`
              // to return the address of a fully-transacted `Dossier`.
              
              // NOTE: `result` is returned from a `then` method, so it may be either
              // an immediate value or a promise. This means that the result of
              // an `Ability.prototype.use` method, or the result of an `ability.decorate`
              // function, may be a promise - even if these aren't $-prefixed.
              
              var ability = this.hasAbility(abilityName) ? this.getAbility(abilityName) : null;
              if (!ability || !ability.public) throw new Error('Ability "' + abilityName + '" unavailable');
              
              var result = this.stageAbility(ability, editor, null, abilityParams);
              var $result = editor.$transact().then(function() { return result; });
              
            } catch(err) {
              
              var $result = new P({ err: err.update({
                message: this.getAddress() + '.' + abilityName + '(' + JSON.stringify(abilityParams, null, 2) + '):\n' + err.message
              })});
              
            }
            
            var pass = this;
            
            if (!LOG_QUERIES) return $result;
            
            return $result.then(function(v) {
              
              console.log('SUCCESS: ' + pass.getAddress() + '.' + abilityName + '(' + U.debugObj(abilityParams) + ')');
              console.log('-->', v);
              console.log('');
              return v;
              
            }).fail(function(err) {
              
              console.log('FAILURE: ' + pass.getAddress() + '.' + abilityName + '(' + U.debugObj(abilityParams) + ')');
              console.log('-->', err.message);
              console.log('');
              throw err;
              
            });
            
          },
          
          hasAbility: function(name) {
            return (this.outline.p.abilities || {}).contains(name);
          },
          getAbility: function(name) {
            return this.outline.p.abilities[name];
          },
          stageAbility: function(ability, editor, below, params) {
            if (U.isObj(ability, String)) {
              var abilities = this.outline.p.abilities || {};
              if (!abilities.contains(ability)) return new P({ err: new Error(this.getAddress() + ' has no ability "' + ability + '"') });
              ability = abilities[ability];
            }
            
            return ability.use(editor, this, below, params);
          },
          $useAbility: function(name, params) {
            
            return this.$handleRequest({ command: name, params: params });
          
          },
          
          dereference: function() {
            throw new Error('Cannot dereference "' + this.constructor.title + '"');
          },
          
          getValue: function(addr) {
            if (U.exists(addr)) {
              var c = this.getChild(addr);
              return c ? c.getValue0() : null;
            }
            return this.getValue0();
          },
          getValue0: function() {
            return 'not implemented';
          },
          setValue: function(/* [ addr, ] value */) {
            if (arguments.length === 1) this.setValue0(arguments[0]);
            else                        this.getChild(arguments[0]).setValue0(arguments[1]);
          },
          setValue0: function(value) {
            throw new Error('not implemented');
          },
          
          getData: function() {
            throw new Error('Not implemented');
          },
          getJson: function(params /* */) {
            throw new Error('Not implemented');
          },
          
          start: function() {
            
            if (this.started) throw new Error('Tried to double-start "' + this.getAddress() + '"');
            this.started = true;
            
            if (!this.isRooted()) throw new Error('Cannot start unrooted doss ' + this.outline.getAddress());
            
            if (!this.hasResolvedName() || (this.par && !this.par.started))
              throw new Error('Not ready to start "' + this.getAddress() + '"');
            
            // Run any contentFunc
            var contentFunc = this.outline.p.contentFunc;
            if (contentFunc) {
              this.content = contentFunc(this);
              if (!U.isInstance(this.content, ds.Content)) throw new Error('Bad contentFunc');
              this.content.start();
            }
            
            // Attach any changeHandler
            var changeHandler = this.outline.p.changeHandler;
            if (changeHandler) {
              this.changeHandler = changeHandler.bind(null, this);
              this.addConcern('value', this.changeHandler);
            }
            
            // Apply any decorator function
            var decorateFunc = this.outline.p.decorateFunc;
            if (decorateFunc) {
              decorateFunc(this);
            }
            
          },
          stop: function() {
            
            if (!this.started) throw new Error('Tried to double-stop "' + this.getAddress() + '"');
            this.started = false;
            
            // Stop any content
            if (this.content) {
              this.content.stop();
              delete this.content;
            }
            
            // Stop any change handler
            if (this.changeHandler) {
              this.remConcern('value', this.changeHandler);
              delete this.changeHandler;
            }
            
          },
          
          valueOf: function() {
            return this.getAddress();
          }
          
        };}
      }),
      
      /* DossierSet */
      DossierSet: U.makeClass({ name: 'DossierSet',
        superclassName: 'Dossier',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
            this.children = {};
            this.length = 0;
          },
          
          // Child methods
          addChild: function(child) {
            if (child.par && child.par !== this) throw new Error('Tried to add: "' + child.getAddress() + '"');
            if (this.children.contains(child.name)) throw new Error('Tried to overwrite doss "' + this.children[child.name].getAddress() + '"');
            
            child.par = this;
            this.children[child.name] = child;
            this.length++;
            
            return child;
          },
          remChild: function(name) {
            
            if (U.isInstance(name, ds.Dossier)) {
              
              var child = name;
              name = name.name;
              
            } else if (U.isObj(name, String)) { // `name` must be a `String`
              
              if (name.contains('.')) {
                
                var addr = name.split('.');
                var child = this.getChild(addr);
                name = addr[addr.length - 1];
                
                // Ensure the address references a direct child
                if (!child || this.children[name] !== child) throw new Error('Can\'t remove child at address "' + addr.join('.') + '"');
                
              } else {
                
                var child = this.children[name];
                
              }
              
            } else {
              
              throw new Error('Invalid value for remChild: ' + name);
              
            }
            
            if (!child || child.par !== this)
              throw new Error('Dossier "' + this.getAddress() + '" can\'t remove nonexistant child "' + (child ? child.getAddress() : name) + '"');
            
            delete this.children[name];
            this.length--;
            child.par = null;
            
            return child;
            
          },
          hasChild: function(child) {
            return this.children.contains(child.name) && this.children[child.name] === child;
          },
          getNamedChild0: function(name) {
            /* if (U.isObj(name, Object))
              return new ds.FilterResults({ origChildren: this.children, filter: name }); */
            
            if (this.children.contains(name)) return this.children[name];
            return sc.getNamedChild0.call(this, name);
          },
          
          // TODO: `getValue0` and `setValue0` here aren't compatible
          // e.g. `doss.setValue(doss.getValue())` will fail - `doss`, being a `DossierSet`,
          // will pass each of its children an instance of itself as the parameter to the child's
          // `getValue` method
          getValue0: function() {
            return this.children;
          },
          setValue0: function(val) {
            if (!U.isObj(val, Object)) throw new Error('Invalid value for `' + this.constructor.title + '`: ' + U.typeOf(val));
            for (var k in val) if (!U.obj.contains(this.children, k)) throw new Error('Invalid setValue key: ' + this.getAddress() + ' -> ' + k);
            for (var k in val) this.children[k].setValue0(val[k]);
          },
          getChildName: function(child) {
            // Calculates the name that should be used to label the child
            throw new Error('Not implemented');
          },
          getChildOutline: function(name) {
            // Returns the outline needed by a child named "name"
            throw new Error('Not implemented');
          },
          
          getJson: function(params /* */) {
            
          },
          
          map: function(mapFunc) {
            return this.children.map(mapFunc);
          },
          
          matches: function(value) {
            
            if (U.isObj(value, String)) {
              return this.name === value;
            }
            
            // TODO: Does using `this.getChild(k)` instead of `this.children[k]` open this to exploits??
            for (var k in value) {
              var child = this.getChild(k);
              if (!child || !child.matches(value[k])) return false;
            }
            
            return true;
            
          },
          
          getData: function() {
            var ret = {};
            for (var k in this.children) ret[k] = this.children[k].getData();
            return ret;
          }
        
        };}
      }),
      DossierObj: U.makeClass({ name: 'DossierObj',
        superclassName: 'DossierSet',
        methods: function(sc) { return {
          // Child methods
          getChildName: function(child) {
            throw new Error(this.constructor.title + ' doesn\'t support `getChildName`');
          },
          getChildOutline: function(name) {
            if (!name) throw new Error('DossierObj needs `name` for `getChildOutline`');
            return this.outline.i.contains(name) ? this.outline.i[name] : null;
          }
        };}
      }),
      DossierArr: U.makeClass({ name: 'DossierArr',
        superclassName: 'DossierSet',
        methods: function(sc, c) { return {
          init: function(params /* outline, innerOutline, prop */) {
            sc.init.call(this, params);
            
            // `this.nextInd` keeps track of the lowest unused index
            // that a child is named in `this.children`. It is only
            // updated when children with numeric names are added.
            this.nextInd = 0;
          },
          
          // Child methods
          addChild: function(child) {
            child = sc.addChild.call(this, child);
            while (this.children.contains(this.nextInd)) this.nextInd++; // A hole has just been filled. Ensure the next index is available
            return child;
          },
          remChild: function(child) {
            // note that sc.remChild may alter the parameter being dealt with (resolve String to named Dossier)
            child = sc.remChild.call(this, child);
            
            // Two different possibilities here:
            // 1) Fill holes whenever there is an opportunity
            // 2) Always immediately cascade to fill holes
            // Implementing #1: there is definitely a hole at the child's name (since it has been removed), so set the next index to be there
            if (!isNaN(child.name)) this.nextInd = Math.min(this.nextInd, parseInt(child.name, 10));
            
            return child;
          },
          getChildName: function(doss) {
            if (!U.isInstance(doss, ds.Dossier)) throw new Error('Invalid "doss" param');
            if (doss.par !== this) throw new Error('Can\'t get a name for a non-child');
            
            var nameFunc = this.outline.p.nameFunc;
            var name = nameFunc ? nameFunc(doss) : this.nextInd;
            if (!U.valid(name)) throw new Error('`nameFunc` in "' + doss.outline.getAddress() + '" returned an invalid name: ' + name);
            return name;
          },
          getChildOutline: function(name) {
            // All DossierArr children have the same outline
            return this.outline.p.innerOutline;
          },
          
        };}
      }),
      
      /* DossierVal */
      DossierVal: U.makeClass({ name: 'DossierVal',
        superclassName: 'Dossier',
        methods: function(sc) { return {
          init: function(params /* outline, value */) {
            sc.init.call(this, params);
            this.value = null;
            this.setValue(null);
          },
          
          matches: function(value) {
            // TODO: loose comparison??
            return this.value == value;
          },
          
          getValue0: function(value) {
            return this.value;
          },
          setValue0: function(value) {
            if (value === this.value) return;
            this.value = value;
            this.concern('value', this.value); // TODO: Maybe this should be implemented in `Dossier.prototype.setValue`?
          },
          modValue: function(modFunc) {
            var moddedVal = modFunc(this.getValue());
            if (!U.exists(moddedVal)) throw new Error('modFunc should return a value');
            this.setValue(moddedVal);
          },
          
          getData: function() {
            return this.value;
          }
          
        };}
      }),
      DossierStr: U.makeClass({ name: 'DossierStr',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setValue0: function(val) {
            sc.setValue0.call(this, val === null ? '' : val.toString());
          }
        }; }
      }),
      DossierInt: U.makeClass({ name: 'DossierInt',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setValue0: function(value) {
            // Accept the value "null"
            if (value === null) value = 0;
            
            // Accept any value which isn't NaN after `parseInt`
            value = parseInt(value);
            if (isNaN(value)) throw new Error(this.getAddress() + ' received non-numeric value: "' + value + '"');
            
            sc.setValue0.call(this, value);
          }
        }; }
      }),
      DossierBln: U.makeClass({ name: 'DossierBln',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setValue0: function(value) {
            if (value === null) value = false;
            if (value !== true && value !== false) throw new Error('Received non-boolean value: "' + value + '"');
            sc.setValue0.call(this, value);
          }
        }; }
      }),
      
      /* DossierRef */
      DossierRef: U.makeClass({ name: 'DossierRef',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          init: function(params) {
            var outline = U.param(params, 'outline');
            if (!outline.p.template) throw new Error('Cannot init Ref without "template" value');
            sc.init.call(this, params);
          },
          setValue0: function(value) {
            
            var template = this.outline.p.template;
            if (!U.isObj(template, Array)) template = template.split('.');
            
            if (value === null) {
              
              var arrVal = null;
              
            } else if (U.isObj(value, Array)) {
              
              // TODO: `Array` format is ambiguous: is it a "."-split address?? Or is it the actual value??
              var arrVal = value;
              
            } else if (U.isObj(value, String)) {
              
              var pcs = value.split('.');
              if (pcs.length !== template.length) throw new Error('String value "' + value + '" does not match template "' + template.join('.') + '"');
              var arrVal = pcs.map(function(v, i) { return template[i][0] === '$' ? v : U.SKIP; });
              
            } else if (U.isInstance(value, ds.Dossier)) {
              
              var vals = [];
              var addr = value.getNameChain();
              for (var endOff = 1, len = Math.min(template.length, addr.length); endOff <= len; endOff++) {
                var tmp = template[template.length - endOff];
                var val = addr[addr.length - endOff];
                
                if (tmp[0] === '$')       vals.push(val);   // Add to `vals` for each variable component in `template`
                else if (tmp[0] === '~')  break;            // We're iterating from end to start; variables cannot occur before tilde-prefixed values
                else if (tmp !== val)     throw new Error(  // Non-variable components of the supplied address must match the corresponding template component
                    '`DossierRef` "' + this.getAddress() + '" was supplied value "' + addr.join('.') + '", ' +
                    'but this doesn\'t match the template "' + template.join('.') + '"'
                  );
              }
              
              var arrVal = U.arr.reverse(vals);
              
            } else {
              
              throw new Error('`DosserRef.prototype.setValue` accepts `null`, `Array`, `String` and `Dossier` but received ' + U.typeOf(value));
              
            }
            
            if (arrVal !== null) {
              
              if (arrVal.length !== U.arr.count(template, function(pc) { return pc[0] === '$'; })) {
                console.log('BAD VALUE:', arrVal, ' ORIGINALLY:', value);
                throw new Error('Incorrect number of components');
              }
              
              // TODO: Verify that the `Array` is of the right length, and dereferences
              // to an existing value??
              for (var i = 0; i < arrVal.length; i++) {
                if (!U.exists(arrVal[i]) || !(U.isObj(arrVal[i], String) || U.isObj(value[i], Number))) {
                  console.log('INVALID REF ARRAY VALS:', arrVal);
                  throw new Error('Array contains invalid values');
                }
              }
              
            }
            
            return sc.setValue0.call(this, arrVal);
          },
          getValue0: function() {
            return this.value ? this.getRefAddress() : null;
          },
          getNameParam: function(nameParam) {
            var template = this.outline.p.template;
            if (!U.isObj(template, Array)) template = template.split('.');
            
            var valInd = 0;
            for (var i = 0; i < template.length; i++)
              if (template[i][0] === '$') {
                if (template[i].substr(1) === nameParam) return this.value ? this.value[valInd] : null;
                valInd++;
              }
            
            throw new Error('Invalid template parameter: "' + nameParam + '"');
            
          },
          
          matches: function(value) {
            // TODO: Does this make sense? Is it efficient?
            return this.dereference().getAddress() === value;
          },
          
          getRefAddress: function() {
            var template = this.outline.p.template;
            if (!U.isObj(template, Array)) template = template.split('.');
            
            // If `this.value` is null resolve it to an empty array
            var vals = this.value || [];
            var ret = [];
            var valInd = 0;
            for (var i = 0; i < template.length; i++)
              ret.push(template[i][0] === '$' ? vals[valInd++] : template[i]);
            
            // TODO: This should return an `Array` instead of `String`
            return ret.join('.');
          },
          getHolderAddress: function() {
            // TODO: Should this return an absolute address?
            var addr = this.getRefAddress().split('.');
            return addr.slice(0, addr.length - 1).join('.');
          },
          dereference: function() {
            return this.value ? this.getChild(this.getRefAddress()) : null;
          },
          getData: function() {
            return this.value ? this.getRefAddress() : null;
          }
        }; }
      }),
      
      /* Psuedo-Dossier */
      /*
      FilterResults: U.makeClass({ name: 'FilterResults',
        superclass: tree.TreeNode,
        methods: function(sc, c) { return {
          init: function(params /* origChildren, filter, par * /) {
            var origChildren = U.param(params, 'origChildren');
            var filter = U.param(params, 'filter');
            
            this.children = {};
            this.par = U.param(params, 'par', null);
            
            console.log('FILTER', filter);
            
            if (!c.filters.contains(filter.type)) throw new Error('Unsupported filter type: "' + filter.type + '"');
            c.filters[filter.type].call(this, filter.params);
            
          },
          getNamedChild: function(name) {
            return this.children[name] || null;
          },
          
          // TODO: Next 4 methods are purely referenced from DossierSet and Dossier
          /*$handleRequest: function(params /* command * /) {
            return ds.Dossier.prototype.$handleRequest.call(this, params);
          },
          * /
          getData: function() {
            return ds.DossierSet.prototype.getData.call(this, params);
          }
        };},
        statik: {
          filters: {
            // TODO: can implement more filters :D
            match: function(filterData) {
              var ret = {};
              for (var k in origChildren) {
                var child = origChildren[k];
                if (child.matches(filterData)) this.children[k] = child;
              }
            }
          }
        }
      }),
      */
      
      /* Versioner - maintain evolving Dossier structures */
      Versioner: U.makeClass({ name: 'Versioner',
        methods: function(sc) { return {
          init: function(params /* versions */) {
            this.versions = U.param(params, 'versions');
          },
          addVersion: function(params /* name, detect, $apply */) {
            this.versions.push({
              name:   U.param(params, 'name'),
              detect: U.param(params, 'detect'),
              $apply: U.param(params, '$apply')
            });
          },
          $getDoss: function() {
            
            var $dossData = new P({ val: { versionName: 'empty state', doss: null } });
            
            this.versions.forEach(function(ver) {
              
              $dossData = $dossData.then(function(version, prevData) {
                
                return version.detect(prevData)
                  ? version.$apply(prevData)
                  : prevData;
                
              }.bind(null, ver));
              
            });
            
            return $dossData.then(function(doss) {
              
              if (!U.isInstance(doss, ds.Dossier)) throw new Error('Versioner\'s final output was not a `Dossier`');
              doss.updateName('~root', true);
              return doss;
              
            });
            
          }
        };}
      }),
      
      // TODO: Need to call `.stop` (`.fullyUnloaded`?) on Content objects! It's not being done at the moment!
      // TODO: Generally need to put some thought into "start"/"fullyUnloaded" paradigm
      /* Content - control how Dossiers determine their content */
      Content: U.makeClass({ name: 'Content',
        includeGuid: true,
        methods: function(sc, c) { return {
          init: function(params /* doss, cache */) {
            this.doss = U.param(params, 'doss');
            this.cache = U.param(params, 'cache', null);
            
            if (!this.doss.isRooted()) throw new Error('Dossier isn\'t rooted; can\'t init `Content`');
          },
          start: function() {
            if (this.cache) this.cache[this.guid] = this;
          },
          stop: function() {
            if (this.cache) delete this.cache[this.guid];
          }
        };}
      }),
      ContentCalc: U.makeClass({ name: 'ContentCalc',
        superclassName: 'Content',
        methods: function(sc, c) { return {
          init: function(params /* doss, cache, func */) {
            sc.init.call(this, params);
            this.func = U.param(params, 'func');
          },
          update: function() {
            this.doss.setValue(this.func());
          }
        };}
      }),
      ContentAbstractSync: U.makeClass({ name: 'ContentAbstractSync',
        superclassName: 'Content',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs, syncOnStart */) {
            sc.init.call(this, params);
            
            this.waitMs = U.param(params, 'waitMs', 0);
            this.jitterMs = U.param(params, 'jitterMs', this.waitMs * 0.17);
            this.syncOnStart = U.param(params, 'syncOnStart', false);
            this.timeout = null;
            
            this.freshest = 0;
            this.freshestReq = 0;
          },
          $query: function(ref) { throw new Error('not implemented'); },
          $applyQueryResult: function(queryResult) { throw new Error('not implemented'); },
          cancelUpdates: function() {
            /*
            Clears the current timeout, and also sets `this.timeout` to `null`, which will
            cause any pending updates to be ignored upon their completion.
            */
            clearTimeout(this.timeout);
            this.timeout = null;
            
            // Declare that our current value is fresher than any pending value
            this.freshest = this.freshestReq + 1;
            
            // Ensure that if updates are started again, they are sufficiently fresh
            this.freshestReq = this.freshest;
          },
          scheduleUpdates: function() {
            this.timeout = (this.waitMs || this.jitterMs)
              ? setTimeout(this.update.bind(this), this.waitMs + (Math.random() * this.jitterMs))
              : null;
          },
          update: function() {
            
            var pass = this;
            
            this.freshestReq++;
            this.$query(this.freshestReq).then(function(refResult) {
              
              var freshness = refResult.ref;
              var result = refResult.result;
              
              // Make sure a stale response never overwrites a fresher one
              if (freshness < pass.freshest) return p.$null;
              pass.freshest = freshness;
              
              pass.scheduleUpdates();
              
              return pass.$applyQueryResult(result);
                
            }).fail(function(err) {
              
              console.log('Sync error on: ' + pass.doss.getAddress());
              throw err;
              
            }).done();
            
          },
          start: function() {
            sc.start.call(this);
            if (this.syncOnStart) this.update();
            else                  this.scheduleUpdates();
          },
          stop: function() {
            this.cancelUpdates();
            sc.stop.call(this);
          }
        };}
      }),
      ContentSync: U.makeClass({ name: 'ContentSync',
        superclassName: 'ContentAbstractSync',
        methods: function(sc, c) { return {
          $query: function(ref) {
            return queries.$doQuery({
              address: this.doss.getAddress(),
              command: 'get',
              ref: ref
            });
          },
          $applyQueryResult: function(rawData) {
            this.doss.setValue(rawData);
            return p.$null;
          }
        };}
      }),
      ContentSyncRef: U.makeClass({ name: 'ContentSyncRef',
        superclassName: 'ContentAbstractSync',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, refParAddress, waitMs, jitterMs, syncOnStart, selection */) {
            sc.init.call(this, params);
            
            if (!U.isInstance(this.doss, ds.DossierRef)) throw new Error('`ContentSyncRef` needs its doss to be a `DossierRef`');
            
            // Supplying `calcRef` allows
            this.calcRef = U.param(params, 'calcRef', null);
            this.selection = U.param(params, 'selection', ds.selectAll);
          },
          $query: function(ref) {
            
            if (this.calcRef) this.doss.setValue(this.calcRef());
            
            if (!this.doss.value) return new P({ ref: ref, result: null });
            
            var addr = this.doss.getRefAddress().split('.');
            
            // If `addr` is a relative address, need to convert it to an absolute address
            /*if (addr[0] !== '~root') {
              var numPars = 0;
              while (numPars < addr.length && addr[numPars] === '~par') numPars++;
              if (numPars > prefix.length) throw new Error('Too many "~par" dereferencers');
              addr = prefix.slice(0, prefix.length - numPars).concat(addr.slice(numPars));
            }*/
            
            if (addr[0] !== '~root') {
              var prefix = this.doss.getAddress().split('.');
              while (addr[0] === '~par') {
                addr = addr.slice(1);
                prefix = prefix.slice(0, prefix.length - 1);
              }
              addr = (prefix.concat(addr)).join('.');
            }
            
            return queries.$doQuery({
              address: addr,
              command: 'get',
              params: {
                selection: this.selection
              },
              ref: ref
            });
            
          },
          $applyQueryResult: function(refData) {
            
            // If no data is provided, or the reference already links properly, do nothing
            if (!refData || this.doss.dereference()) return p.$null;
            
            var editor = new ds.Editor({});
            var doss = this.doss;
            
            var holderAddr = doss.getHolderAddress().split('.');
            var holder = doss.getChild(holderAddr);
            
            if (!holder) {
              
              // NOTE: We could use a simple recursive `editor.add` call to immediately generate
              // the entire `Dossier` structure up until and including `holder`, but this means
              // that we would not have immediate access to the final `holder` element; it would
              // be lost within the transaction. We would have to make 2 separate transactions,
              // one to build `holder`, we would then do `holder = doss.getChild(holderAddr)`,
              // and then we would need a second transaction to actually add the referenced
              // `Dossier`. Using a loop of non-recursive `editor.add` calls can grant 
              // immediate access to `holder` at the end of the loop.
              
              holder = doss;
              for (var i = 0, len = holderAddr.length; i < len; i++) {
                var childName = holderAddr[i];
                holder = holder.getNamedChild(childName) || editor.add({ par: holder, name: childName, recurseArr: false, recurseObj: false });
              }
              
              // Now `holder` has the correct address to hold the referenced data
              
            }
            
            var refDoss = editor.add({ par: holder, data: refData });
            
            return editor.$transact().then(function() {
              if (refDoss !== doss.dereference()) throw new Error('Something went wrong');
              return refDoss;
            });
            
          }
        };}
      }),
      ContentSyncSet: U.makeClass({ name: 'ContentSyncSet',
        superclassName: 'ContentAbstractSync',
        description: 'Syncs the children of a set-type Dossier. Only removes and adds children; ' +
          'this `Content` does not update the values of a child even if those values have changed. ' +
          'In order to update such values, children should be assigned inner `Content`s.',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs, syncOnStart, selection, preserveKeys */) {
            sc.init.call(this, params);
            
            this.selection = U.param(params, 'selection');
            this.preserveKeys = U.param(params, 'preserveKeys', []);
          },
          $query: function(ref) {
            return queries.$doQuery({
              address: this.doss.getAddress(),
              command: 'get',
              params: {
                selection: this.selection
              },
              ref: ref
            });
          },
          $applyQueryResult: function(childData) {
            
            // TODO: This method will not update children which have changed in `childData`
            // relative to `doss`. Children are only modified when they exist in one but not
            // the other.
            
            var doss = this.doss;
            
            var add = [];
            var rem = [];
            
            var uncovered = doss.children.clone();
            
            // After this loop every child in uncovered will be a child which exists in `doss`, but not in `childData`
            for (var k in childData) {
              
              if (uncovered.contains(k)) {
                
                // Found a key which is in both `childData` and `doss`
                delete uncovered[k];
                
              } else {
                
                // Found a key which is in `childData`, but not in `doss`
                add.push({ par: doss, name: k, data: childData[k] });
                
              }
              
            }
            
            // Cover all local keys
            for (var i = 0, len = this.preserveKeys.length; i < len; i++) delete uncovered[this.preserveKeys[i]];
            
            // `uncovered` now contains keys which exists in `doss` but not `childData` - such keys are outdated
            for (var k in uncovered) { rem.push({ par: doss, child: uncovered[k] }); }
            
            // TODO: Is an `Editor` really needed here?
            var editor = new ds.Editor();
            editor.edit({ add: add, rem: rem });
            return editor.$transact();
            
          },
          
          $syncedAbility: function(ability, localParams, remoteParams) {
            var pass = this;
            if (!remoteParams) remoteParams = localParams.clone();
            
            // Adding remote 1st:
            return queries.$doQuery({ address: this.doss.getAddress(), command: ability, params: remoteParams }).then(function(remoteVal) {
              
              // update cancelling/scheduling needs to be a stacked operations D:
              pass.cancelUpdates();
              return pass.doss.$useAbility(ability, localParams).then(function(localVal) {
                pass.scheduleUpdates();
                return remoteVal;
              });
              
            });
            
            // Adding remote 2nd:
            /*
            this.cancelUpdates();
            return this.doss.$useAbility(ability, localParams).then(function(localVal) {
              
              return queries.$doQuery({ address: pass.doss.getAddress(), command: 'addData', params: { data: data } }).then(function(remoteVal) {
                
                // Turn updates back on once the remote value has added successfully
                pass.scheduleUpdates();
                
                // return localVal; // Work with the local value instead of remote
                return remoteVal;
                
              }).fail(function(err) {
                
                // Note: this removal is untested
                var addr = localVal.address;
                var child = pass.doss.getChild(addr);
                var editor = new ds.Editor({});
                editor.rem({ par: pass.doss, child: pass.doss.getChild(addr) });
                return editor.$transact().then(function() {
                  throw err; // The undo was successful, but the overall "addData" ability was not
                }).fail(function(err) {
                  console.log('FATAL MFRF');
                  throw err;
                });
                
              });
              
            });
            */
          }
          
        };}
      })
    
    });
    
    return ds;
  }
});
package.build();
