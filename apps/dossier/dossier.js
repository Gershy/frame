/*
TODO: Long polling
TODO: Names of Outline properties are confusing; e.g. "c" could stand for "children"
TODO: Differences between `doss.getValue`, `doss.getData` need to be better understood
*/
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
            if (this.i.contains(data.name)) throw new Error('Tried to overwrite "' + data.name + '"');
            
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
          
          // The next 4 methods are NOT atomics; they add sets of atomics
          // Atomics themselves cannot add more atomics!!
          add: function(params /* par, name, data, outline */) {
            
            var guid = global.NEXT_ID++;
            
            var par = U.param(params, 'par', null);
            var name = U.param(params, 'name', null);
            var data = U.param(params, 'data', null);
            var outline = U.param(params, 'outline', null);
            
            if (!outline) {
              if (!par) throw new Error('`add` requires either "outline" or "par" param');
              outline = par.getChildOutline(name || null);
              if (!outline) throw new Error('Couldn\'t get outline');
            }
            
            // If the name is missing and a non-dynamic outline is provided, get the name from the outline
            if (!name && !outline.dynamic) name = outline.name;
            
            // Step 1: Initialize the doss
            var DossCls = U.deepGet({ root: C, name: outline.c });
            var doss = new DossCls({ outline: outline }.update(outline.p).update({ name: outline.name }));
            
            // Step 2: Initialize the name
            if (!outline.par) this.$addAtomic(c.atomicSetNameSimple, [ doss, '~root', true ])
            else if (name)    this.$addAtomic(c.atomicSetNameSimple, [ doss, name ]);
            else              this.$addAtomic(c.atomicSetNameCalculated, [ doss ]);
            
            // Step 3: Add to parent
            if (par)  this.$addAtomic(c.atomicAddChild, [ par, doss ]);
            
            // Step 4: Add the data (which can result in recursive `this.$addAtomic` calls)
            doss.loadFromJson(data, this);
            //this.$addAtomic(c.atomicLoadJson, [ doss, data, this ]);
            
            // Step 5: Start the `Dossier`
            this.$addAtomic(c.atomicStartDoss, [ doss ]);
            
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
            this.$addAtomic(c.atomicModData, [ U.param(params, 'doss'), U.param(params, 'data') ]);
          },
          edit: function(params /* add, mod, rem */) {
            return {
              add: U.param(params, 'add', []).map(this.add.bind(this)),
              mod: U.param(params, 'mod', []).map(this.mod.bind(this)),
              rem: U.param(params, 'rem', []).map(this.rem.bind(this))
            };
          },
          
          $addAtomic:   function(atomic, args) {
            
            /*
            An "atomic" is a function which returns a result of the following
            format (or throws an error):
            
            anAtomic(...) === {
              $result: <promise with atomic result>,
              desc: <`String` describing this atomic action>,
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
              // TODO: When does `$ret` reject??
              
              try {
                
                var result = atomic.apply(null, args);
                result.$result = result.$result.then(function(val) { $ret.resolve(val); return val; });
                
              } catch(err) {
                
                var result = {
                  $result: new P({ err: err }),
                  desc: 'Immediate error in atomic: ' + err.message,
                  undoAtomic: function() { /* no action required */ }
                };
                
              }
              
              result.$rejectable = $ret; // TODO: Need to tell `$ret` it rejected if it didn't resolve
              
              return result;
              
            };
            //func.$rejectable = $ret;
            func.inner = atomic;
            this.atomics.push(func);
            
            return $ret;
            
          },
          
          $transact: function() {
            
            // Simply calls $recurseStage, resolves/rejects `this.$transaction`
            // appropriately, and upon completion resets itself for the next
            // transaction.
            
            var pass = this;
            var transactionName = 'trn<' + this.id + '/' + this.count + '>';
            
            return this.$recurseStage(transactionName, 0).then(function(recResults) {
              
              if (!recResults.errors.length) return recResults;
                
              // Atomic batch could not be completed!
              recResults.errors.reverse();
              console.log('Stage failed due to ' + recResults.errors.length + ' error(s):\n');
              for (var i = 0, len = recResults.errors.length; i < len; i++) console.log('#' + (i + 1) + ':', recResults.errors[i].stack, '\n');
              
              // TODO: Is $recurseAtomics or $recurseStage better for undoing?
              // Using $recurseAtomics means that undo operations shouldn't generate
              // more undo operations.
              return pass.$recurseAtomics('undo(' + transactionName + ')', 0, 0, recResults.undoAtomics).then(function(undoResults) {
                
                if (undoResults.errors.length) {
                  // Undo batch could not be completed!
                  console.log('Undo failed (this is REAL BAD) due to ' + undoResults.errors.length + ' error(s):\n');
                  for (var i = 0, len = undoResults.errors.length; i < len; i++) console.log('FATAL #' + (i + 1) + ':', undoResults.errors[i].stack, '\n');
                  throw new Error('FATAL MFRF (transaction undo failed; data may be corrupted)');
                }
                
                throw new Error('Stage failed (transaction undo successful)');
                
              });
                
            }).then(function(recResults) {
              
              pass.$transaction.resolve(null);
              return null;
              
            }).fail(function(err) {
              
              pass.$transaction.reject(err);
              return err;
              
            }).then(function(err) {
              
              pass.actions = [];
              pass.$transaction = new P({});
              pass.count++;
              if (err) throw err;
              
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
            
            var allUndoAtomics = [];
            
            return this.$recurseAtomics(type, stageNum, 0, atomics).then(function(recResults) {
              
              // Three possibilities at this point:
              // 1) The stage successfully completed without errors, so the entire process of stage recursion is complete!
              // 2) The stage successfully completed with errors - all is well so far, but another stage is necessary
              // 3) The stage failed. It cannot be completed, and an undo transaction will be performed
              //    (NOTE: The undo transaction will either be successful, or if not, result in a FATAL error).
              
              if (recResults.errors.length || !pass.atomics.length) {
                recResults.attemptArr = [ recResults.attemptNum ];
                return recResults;
              }
              
              var undoAtomics = recResults.undoAtomics;
              return pass.$recurseStage(type, stageNum + 1).then(function(recNextResults) {
                recNextResults.undoAtomics = recNextResults.undoAtomics.concat(undoAtomics);
                recNextResults.attemptArr = [ recNextResults.attemptNum ].concat(recNextResults.attemptArr);
                return recNextResults;
              });
              
            });
            
          },
          $recurseAtomics: function(type, stageNum, attemptNum, atomics) {
            
            // Returns { errors: <errors>, undoAtomics: <undoAtomics>, remainingAtomics: <remainingAtomics>, attemptNum: <attemptNum> }
            // This method has error conditions, but it signals such errors by returning
            // an "errors" property with at least 1 error (instead of by throwing an error).
            
            // var desc = type + '(' + stageNum + ', ' + attemptNum + ')';
            
            var pass = this;
            
            return new P({ all: atomics.map(function(atomic) {  // Try to get the result of all atomics
              
              var result = atomic();
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
      abilities: (function() {
        
        // Ability: getData
        var $getDataVal = function(doss, params /* */) {
          return new P({ val: doss.value });
        };
        var $getDataSet = function(doss, params /* selection */) {
          var selection = U.param(params, 'selection', ds.selectAll);
          
          if (selection.contains('*')) {
            
            var innerParams = params.clone({ selection: selection['*'] });
            var getInner = doss.children.map(function(c, k) { return c.hasAbility('getData') ? c.$useAbility('getData', innerParams) : U.SKIP; });
            
          } else {
            
            var getInner = {};
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
              if (child && child.hasAbility('getData')) getInner[rename] = child.$useAbility('getData', { selection: selection[k] });
              
            }
            
          }
          
          return new P({ all: getInner });
        };
        var $getDataRef = function(doss, params /* */) {
          return new P({ val: doss.value ? doss.getRefAddress() : null });
        };
        
        // Ability: modData
        var $modDataVal = function(doss, params /* editor, data */) {
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor');
          
          editor.mod({ doss: doss, data: data });
          return editor.$transaction;
          
        };
        var $modDataSet = function(doss, params /* editor, data */) {
          var data = U.param(params, 'data');
          if (!U.isObj(data, Object)) return new P({ err: new Error('modData expects the "data" param to be an `Object`') });
          
          var editor = U.param(params, 'editor');
          
          return new P({
            all: data.map(function(v, k) {
              if (!doss.children.contains(k)) throw new Error('Invalid modDataSet key: ' + doss.getAddress() + ' -> ' + k);
              return doss.children[k].$useAbility('modData', { editor: editor, data: v });
            })
          }).then(function() { return null; });
        };
        var $modDataSetDirect = $modDataVal; // Both of these just call `doss.setValue(...)` with the value
        var $modDataRef = $modDataVal;
        
        // Ability: addData
        var $addData = function(doss, params /* [ prepareForMod, ] editor, data */) {
          
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor');
          var prepareForMod = U.param(params, 'prepareForMod', null);
          
          var child = editor.add({ par: doss, data: data });
          
          return editor.$transaction.then(function() {
            
            var modParams = prepareForMod ? prepareForMod(child, { data: data }) : { data: data };
            
            // On add success, try to mod
            return child.$useAbility('modData', modParams)
              .fail(function(err) {   // On mod failure, some deep-child's "modData" ability call failed
                var editor = new ds.Editor({});
                editor.rem({ par: doss, child: child });
                return editor.$transact().then(function() { return err; }); // Pass `err` along; it will be thrown later
              })
              .fail(function(err) {   // On removal failure, this is a fatal situation (corrupt data)
                console.log('FATAL MFRF: ADDED, BAD MOD, BAD REM D:', err.stack);
                throw err;
              })
              .then(function(err) {   // `err` is provided if the failed add+mod could be undone with a rem.
                if (err) {
                  console.log('ADDED, bad mod, good rem! :D');
                  throw err;
                }
              });
              
          }).then(function() { return { address: child.getAddress() }; }); // If everything succeeds, return the address!
          
        };
        var $addDataDirect = function(doss, params /* editor, data */) {
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor');
          
          var child = editor.add({ par: doss, data: data });
          return editor.$transaction.then(function() { return { address: child.address }; });
        };
        
        // Ability: remData
        var $remData = function(doss, params /* editor, child */) {
          var child = U.param(params, 'child');
          var editor = U.param(params, 'editor');
          
          editor.rem({ par: doss, child: child });
          return editor.$transaction;
        };
        
        return {
          val: { $getData: $getDataVal, $modData: $modDataVal },
          set: { $getData: $getDataSet, $modData: $modDataSet, $addData: $addData, $remData: $remData },
          setDirect: { $getData: $getDataSet, $modData: $modDataSetDirect, $addData: $addDataDirect, $remData: $remData },
          ref: { $getData: $getDataRef, $modData: $modDataRef }
        };
        
      })(),
      
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
            
            if (!force && !ds.NAME_REGEX.test(name)) throw new Error('Illegal Dossier name: "' + name + '"');
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
          loadFromJson: function(data, editor) {
            throw new Error('not implemented');
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
              var target = name.substr(5, name.length - 6).trim();
              var ptr = this.par;
              while (ptr !== null) {
                if (ptr.outline.name === target) return ptr;
                ptr = ptr.par;
              }
              return null;
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
          $handleRequest: function(params /* command */) {
            return this.$useAbility(U.param(params, 'command'), U.param(params, 'params', {}));
          },
          
          hasAbility: function(name) {
            return (this.outline.p.abilities || {}).contains('$' + name);
          },
          $useAbility: function(name, params) {
            var trueName = '$' + name;
            var abilities = this.outline.p.abilities || {};
            if (!abilities.contains(trueName)) return new P({ err: new Error(this.getAddress() + ' has no ability "' + name + '"') });
            
            if (!params) params = {};
            var immediate = !params.contains('editor');
            if (immediate) params.editor = new ds.Editor();
            
            try {
              
              // TODO: There's a difference between the ability being done adding
              // atomics, and the ability having run
              // - Obviously the ability can't run until editor.$transact is called
              // - editor.$transact should be called when abilities are done adding
              //   atomics (calling immediately MIGHT? not always work)
              
              var $result = p.$(abilities[trueName](this, params));
              if (immediate) params.editor.$transact().done();
              return $result;
              
            } catch(err) {
              
              err.message = 'Bad ability: ' + this.getAddress() + '.' + name + '(' + params + ') - ' + err.message;
              return new P({ err: err });
              
            }
          },
          
          dereference: function() {
            throw new Error('Cannot dereference "' + this.constructor.title + '"');
          },
          
          getData: function() {
            throw new Error('Not implemented');
          },
          
          start: function() {
            
            if (this.started) throw new Error('Tried to double-start "' + this.getAddress() + '"');
            this.started = true;
            
            if (!this.isRooted()) throw new Error('Cannot start unrooted doss ' + this.outline.getAddress());
            
            if (!this.hasResolvedName() || (this.par && !this.par.started))
              throw new Error('Not ready to start "' + this.getAddress() + '"');
            
            // Add any contentFunc
            var contentFunc = this.outline.p.contentFunc;
            if (contentFunc) {
              this.content = contentFunc(this);
              if (!U.isInstance(this.content, ds.Content)) throw new Error('Bad contentFunc');
              this.content.start();
            }
            
            // Add any changeHandler
            var changeHandler = this.outline.p.changeHandler;
            if (changeHandler) {
              this.changeHandler = changeHandler.bind(null, this);
              this.addConcern('value', this.changeHandler);
            }
            
            var decorateFunc = this.outline.p.decorateFunc;
            if (decorateFunc) {
              decorateFunc(this);
            }
            
          },
          stop: function() {
            
            if (!this.started) throw new Error('Tried to double-stop "' + this.getAddress() + '"');
            this.started = false;
            
            // console.log('Stopped: "' + this.getAddress() + '"');
            
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
            if (this.children.contains(child.name)) throw new Error('Tried to overwrite: "' + this.children[child.name].getAddress() + '"');
            
            child.par = this;
            
            this.length++;
            this.children[child.name] = child;
            
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
          getNamedChild0: function(name) {
            /* if (U.isObj(name, Object))
              return new ds.FilterResults({ origChildren: this.children, filter: name }); */
            
            if (this.children.contains(name)) return this.children[name];
            return sc.getNamedChild0.call(this, name);
          },
          
          // TODO: `getValue` and `setValue` here aren't compatible
          // e.g. `doss.setValue(doss.getValue())` will fail - `doss`, being a `DossierSet`,
          // will pass each of its children an instance of itself as the parameter to the child's
          // `getValue` method
          getValue: function(address) {
            if (!address) return this.children;
            var child = this.getChild(address);
            return child ? child.getValue() : null;
          },
          setValue: function(arg1, arg2 /* [ address, ] value */) {
            if (U.exists(arg2)) {
              
              this.getChild(arg1).setValue(arg2);
              
            } else {
              
              for (var k in arg1) {
                if (!this.children.contains(k)) throw new Error('Invalid setValue key: ' + this.getAddress() + ' -> ' + k);
                this.children[k].setValue(arg1[k]);
              }
              
            }
          },
          getChildName: function(child) {
            // Calculates the name that should be used to label the child
            throw new Error('Not implemented');
          },
          getChildOutline: function(name) {
            // Returns the outline needed by a child named "name"
            throw new Error('Not implemented');
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
          loadFromJson: function(data, editor) {
            // Unlike `DossierArr`, `DossierObj` can't skip just because `data` isn't provided.
            // The iteration is based on the outline, not on the data
            data = data || {};
            for (var k in this.outline.i) editor.add({ par: this, outline: this.getChildOutline(k), name: k, data: data[k] || null });
          },
          
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
            
            this.innerOutline = U.param(params, 'innerOutline');
            
            // `this.nextInd` keeps track of the lowest unused index
            // that a child is named in `this.children`. It is only
            // updated when children with numeric names are added.
            // Useful as the "propName" when using address-props
            // ("the.address.path/propName")
            this.nextInd = 0;
            
            // Convert outline params to Outline
            if (U.isObj(this.innerOutline, Object)) this.innerOutline = new ds.Outline(this.innerOutline);
          },
          
          loadFromJson: function(data, editor) {
            if (!data) return;
            for (var k in data) editor.add({ par: this, outline: this.getChildOutline(k), data: data[k] });
          },
          
          // Child methods
          addChild: function(child) {
            child = sc.addChild.call(this, child);
            // TODO: There's potentially an issue with the "add"/"attach" concerns here; the nextInd isn't incremented before they're fired
            while (this.nextInd in this.children) this.nextInd++; // A hole has just been filled. Ensure the next index is available
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
            var nameFunc = this.outline.p.nameFunc;
            var name = nameFunc ? nameFunc(this, doss) : this.nextInd;
            
            if (!U.valid(name)) throw new Error('`nameFunc` (in "' + doss.getAddress() + '") returned an invalid name: ' + name);
            return name;
            
          },
          getChildOutline: function(name) {
            // All DossierArr children have the same outline
            return this.innerOutline;
          },
          
        };}
      }),
      
      /* DossierVal */
      DossierVal: U.makeClass({ name: 'DossierVal',
        superclassName: 'Dossier',
        methods: function(sc) { return {
          init: function(params /* outline, value */) {
            sc.init.call(this, params);
            this.value = U.param(params, 'value', null);
          },
          
          loadFromJson: function(data, editor) {
            this.setValue(data);
          },
          
          matches: function(value) {
            // TODO: loose comparison??
            return this.value == value;
          },
          
          getValue: function(value) {
            return this.value;
          },
          setValue: function(value) {
            if (value === this.value) return;
            this.value = value;
            this.concern('value', this.value);
          },
          modValue: function(modFunc) {
            var moddedVal = modFunc(this.getValue());
            if (!U.exists(moddedVal)) throw new Error('modFunc shouldn\'t return `undefined`');
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
          setValue: function(val) {
            sc.setValue.call(this, val === null ? '' : val.toString());
          }
        }; }
      }),
      DossierInt: U.makeClass({ name: 'DossierInt',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setValue: function(value) {
            // Accept the value "null"
            if (value === null) value = 0;
            
            // Accept any value which isn't NaN after `parseInt`
            value = parseInt(value);
            if (isNaN(value)) throw new Error(this.getAddress() + ' received non-numeric value: "' + value + '"');
            
            sc.setValue.call(this, value);
          },
          getValue: function() { return this.value === null ? 0 : this.value; }
        }; }
      }),
      DossierBln: U.makeClass({ name: 'DossierBln',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setValue: function(value) {
            if (value === null) value = false;
            if (value !== true && value !== false) throw new Error('Received non-boolean value: "' + value + '"');
            sc.setValue.call(this, value);
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
          setValue: function(value) {
            if (value === null) { return sc.setValue.call(this, null); }
            
            var template = this.outline.p.template;
            if (!U.isObj(template, Array)) template = template.split('.');
            
            if (U.isObj(value, Array)) { return sc.setValue.call(this, value); }
            if (U.isObj(value, String)) {
              var pcs = value.split('.');
              if (pcs.length !== template.length) throw new Error('String value "' + value + '" does not match template "' + template.join('.') + '"');
              return sc.setValue.call(this, pcs.map(function(v, i) { return template[i][0] === '$' ? v : U.SKIP; }));
            }
            
            if (!U.isInstance(value, ds.Dossier)) throw new Error('`DosserRef.prototype.setValue` accepts `null`, `Array`, or a `Dossier` instance (received ' + U.typeOf(value) + ')');
            
            var addr = value.getNameChain();
            
            var vals = [];
            for (var endOff = 1, len = Math.min(template.length, addr.length); endOff <= len; endOff++) {
              var tmp = template[template.length - endOff];
              var val = addr[addr.length - endOff];
              
              if (tmp[0] === '$')
                vals.push(val);
              else if (tmp[0] === '~')
                break;
              else if (tmp !== val)
                throw new Error('`DossierRef` "' + this.getAddress() + '" was supplied value "' + addr.join('.') + '", ' +
                  'but this doesn\'t match the template "' + template.join('.') + '"');
            }
            
            vals.reverse();
            return sc.setValue.call(this, vals);
          },
          getValue: function() {
            return this.value ? this.getRefAddress() : null;
          },
          
          matches: function(value) {
            // TODO: Does this make sense? Is it efficient?
            return this.dereference().getAddress() === value;
          },
          
          // TODO: Addresses should be represented as `Array` where possible
          getRefAddress: function() {
            var valInd = 0;
            var template = this.outline.p.template;
            if (!U.isObj(template, Array)) template = template.split('.');
            
            // If `this.value` is null resolve it to an empty array
            var vals = this.value || [];
            var ret = [];
            for (var i = 0; i < template.length; i++)
              ret.push(template[i][0] === '$' ? vals[valInd++] : template[i]);
            
            return ret.join('.');
          },
          getHolderAddress: function() {
            // Returns the address of the `Dossier` which holds this `DossierRef`'s reference
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
            
            // TODO: Should it even be possible to have `this.address !== this.doss.getAddress()`??
            this.address = U.param(params, 'address', this.doss.getAddress());
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
              address: this.address,
              command: 'getData',
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
              command: 'getData',
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
            if (doss.name !== '~root' && !doss.par) return new P({ err: new Error('Doss missing parent') });
            
            var holderAddr = doss.getHolderAddress().split('.');
            var holder = doss.getRoot().getChild(holderAddr);
            
            if (!holder) {
              
              var editor = new ds.Editor({});
              holder = doss;
              for (var i = 0, len = holderAddr.length; i < len; i++) {
                var childName = holderAddr[i];
                var child = holder.getNamedChild(childName);
                holder = holder.getNamedChild(childName) || editor.add({ par: holder, name: childName, data: {} });
              }
              
              // Now `holder` has the correct address to hold the referenced data
              
            }
            
            var refDoss = editor.add({ par: holder, data: refData });
            return editor.$transact().then(function() {
              if (refDoss !== doss.dereference()) throw new Error('Something went wrong');
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
              address: this.address,
              command: 'getData',
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
            
            var editor = new ds.Editor();
            editor.edit({ add: add, rem: rem });
            return editor.$transact();
            
          },
          
          $syncedAbility: function(ability, localParams, remoteParams) {
            var pass = this;
            if (!remoteParams) remoteParams = localParams.clone();
            
            if (localParams.contains('editor') || remoteParams.contains('editor')) throw new Error('Provided "editor" to `$syncedAbility`');
            
            // Adding remote 1st:
            return queries.$doQuery({ address: this.address, command: ability, params: remoteParams }).then(function(remoteVal) {
              
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
              
              return queries.$doQuery({ address: pass.address, command: 'addData', params: { data: data } }).then(function(remoteVal) {
                
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
