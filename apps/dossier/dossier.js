/*
TODO: Long polling
TODO: Names of Outline properties are confusing; e.g. "c" could stand for "children"
TODO: Differences between `doss.getValue`, `doss.getData` need to be better defined
*/

var package = new PACK.pack.Package({ name: 'dossier',
  dependencies: [ 'tree', 'worry', 'p' ],
  buildFunc: function(packName, tree, worry, p) {
    
    var P = p.P;
    
    var ds = {};
    
    ds.selectAll = {};
    ds.selectAll['*'] = ds.selectAll;
    
    ds.update({
      
      NAME_REGEX: /^[a-zA-Z0-9<][a-zA-Z0-9-_<,>]*$/,
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
            if (O.contains(this.p, 'innerOutline') && !U.isInstance(this.p.innerOutline, ds.Outline)) {
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
                  if (O.contains(outline, 'name') && outline.name !== k) throw new Error('Conflicting outline names: "' + outline.name + '" and "' + k + '"');
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
            
            if (!U.isEmptyObj(this.i) && O.contains(this.p, 'innerOutline'))
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
            
            if (U.isObj(p, Object)) {
              data.p = p;
            } else if (U.isObj(p, Function)) {
              data.p = { decorateFunc: p };
            } else if (U.isDefined(p)) {
              throw new Error('Invalid "p" param: ' + U.typeOf(p));
            }
            
            if (!data.name) throw new Error('Invalid "name" property');
            if (this.p.innerOutline) throw new Error('Cannot add children to an outline with "innerOutline" property');
            if (O.contains(this.i, data.name)) throw new Error('Tried to overwrite outline "' + data.name + '"');
            
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
        description: 'An Editor allows multiple actions to be performed together on ' +
          'a Dossier structure. The user does not need to be concerned with action ' +
          'ordering (e.g. if one action cannot succeed without another action having ' +
          'first succeeded, the Editor will work this out on its own. The Editor ' +
          'provides transactional consistency. All actions present when ' +
          '`anEditor.$transact` is called will either succeed or fail, with no ' +
          'partial effects. The value resulting from a transaction provides a full ' +
          'description of the actions which occurred, and is used to signal concerns ' +
          'on any involved Dossier instances.',
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
            } else if (!outline.dynamic) { // Note: `outline.dynamic` indicates that the outline repeatedly creates more doss instances
              if (name !== outline.name) throw new Error('Tried to rename non-dynamic doss "' + outline.name + '" to "' + name + '"');
            }
            
            // Step 1: Initialize the doss
            var DossCls = O.walk(C, outline.c.split('.'));
            var doss = new DossCls(O.update({ outline: outline }, outline.p, { name: outline.name }));
            
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
            
            // If this transaction goes through, `doss` gets a "created" worry
            this.$transaction.then(function() {
              doss.worry('editorCreated');
            });
            
            return doss;
            
          },
          rem: function(params /* par, child */) {
            var par = U.param(params, 'par');
            var child = U.param(params, 'child');
            if (!U.isInstance(child, ds.Dossier)) throw new Error('"child" param for rem must be Dossier');
            this.$addAtomic(c.atomicStopDoss, [ child ]);
            this.$addAtomic(c.atomicRemChild, [ par, child ]);
            
            this.$transaction.then(function() { child.worry('editorRemoved'); });
          },
          mod: function(params /* doss, data */) {
            var doss = U.param(params, 'doss');
            var data = U.param(params, 'data');
            this.$addAtomic(c.atomicModData, [ doss, data ], 'moddata ::: ' + doss.name + ' -> ' + U.typeOf(data));
            
            // Perhaps some fields in `data` aren't any different from the fields on `doss`
            // Somehow `c.atomicModData` should be calculating this delta, and the result
            // of that calculation should be sent along with the worry.
            
            this.$transaction.then(function() { doss.worry('editorAltered', data); });
          },
          edit: function(params /* add, mod, rem */) {
            return {
              add: U.param(params, 'add', []).map(this.add.bind(this)),
              mod: U.param(params, 'mod', []).map(this.mod.bind(this)),
              rem: U.param(params, 'rem', []).map(this.rem.bind(this))
            };
          },
          
          $addAtomic: function(func, args, desc) {
            
            /// {DOC=
            { desc: 'Adds a new "atomic" into the editor',
              params: {
                func: { signature: function(/* ... */){},
                  desc: 'A function performing a single "rollable" effect',
                  returns: {
                    object: {
                      desc: 'An object tracking all necessary aspects of the atomic effect',
                      params: {
                        $result: { desc: 'A promise indicating the atomic\'s success' },
                        undoAtomic: { desc: 'A value describing a new atomic which can undo this atomic\'s effect' }
                      }
                    }
                  },
                  criteria: [
                    'If calling the atomic throws an error, or if the atomic\'s `$result`, ' +
                      'property becomes rejected, the atomic must not have made any changes ' +
                      'to the state',
                    'If the atomic\'s `$result` property resolves, activating the atomic ' +
                      'described by the `undoAtomic` property should leave the state as if ' +
                      'no action occurred in the first place'
                  ]
                },
                args: { desc: 'An array of arguments to the atomic' },
                desc: { desc: 'A description for this atomic' }
              }
            }
            /// =DOC}
            
            var $ret = new P({});
            this.atomics.push(c.formAtomic(func, args, desc, { $prm: $ret }));
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
              
              return pass.$recurseAtomics('undo(' + transactionName + ')', 0, 0, recResults.undoAtomics).then(function(undoResults) {
                
                if (undoResults.errors.length) {
                  // Undo batch could not be completed!
                  console.log('Undo failed (this is REAL BAD) due to ' + undoResults.errors.length + ' error(s):\n');
                  for (var i = 0, len = undoResults.errors.length; i < len; i++) {
                    console.log('FATAL #' + (i + 1) + ':');
                    console.error(undoResults.errors[i]);
                    console.log('');
                  }
                  throw new Error('FATAL MFRF (data may be corrupted)');
                }
                
                throw new Error(
                  'Rollback was performed to ' + recResults.remainingAtomics.length + ' unresolvable operation(s):\n' +
                  A.map(recResults.remainingAtomics, function(r) { return r.desc; }).join('\n') + '\n====ERRORS====\n' +
                  A.map(recResults.errors, function(err) { return err.message; }).join('\n')
                );
                
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
            
            // Recursively completes transaction stages until a transaction has completed
            // without generating any atomics for the next stage. When this happens the
            // stage is "completed successfully". Stages may be "completed unsuccessfully",
            // or "failed".
            
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
              // 
              // console.log('Completed stage: ' + desc + ' with ' + recResults.undoAtomics.length + ' atomics');
              
              if (recResults.errors.length || !pass.atomics.length) {
                
                recResults.attemptArr = [ recResults.attemptNum ];
                return recResults;
                
              }
              
              return pass.$recurseStage(type, stageNum + 1).then(function(recNextResults) {
                
                /*
                var oldAtm = pass.atpomics;
                pass.atpomics = recNextResults.undoAtomics;
                var trnDesc = pass.getTransactionDetails();
                pass.atpomics = oldAtm;
                */
                
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
            return new P({ all: U.arr.map(atomics, function(atomic) {  // Try to get the results of all atomics
              
              try {
                
                var result = atomic.func.apply(null, atomic.args);
                
              } catch(err) {
                
                var undoPrevention = function() { return { $result: new P({ err: new Error('Can\'t undo an undo') }) }; };
                
                var result = {
                  $result: new P({ err: err }),
                  undoAtomic: ds.Editor.formAtomic(undoPrevention, [], 'native - thrown undo', { $prm: p.$null })
                };
                
              }
              
              if (!result || !O.contains(result, '$result')) throw new Error('DAMN');
              
              // This result being returned cannot be a failed promise, but it can mark whether a
              // success or failure occurred
              return result.$result.then(function(val) {
                
                // Signal that this atomic has succeeded, even though the transaction has not necessarily succeeded
                if (O.contains(result, '$prm')) result.$prm.resolve(ret);
                
                // Set up a promise to handle the onComplete event for this atomic when the transaction has succeeded
                if (O.contains(result, 'onComplete')) pass.$transaction.then(result.onComplete.bind(null, val));
                
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
          formAtomic: function(atomic, args, desc, more) {
            
            if (!desc) throw new Error('Must provide "desc" to `$addAtomic`');
            if (!U.isObj(atomic, Function)) throw new Error('"atomic" must be a `Function`');
            if (!args[0] && desc !== 'native - thrown undo') throw new Error('Missing 1st param');
            
            var ret = {
              func: atomic,
              args: args,
              desc: desc
            };
            
            return more ? O.update(ret, more) : ret;
            
          },
          atomicStartDoss: function(doss) {
            try {
              
              doss.start();
              return {
                $result: p.$null,
                undoAtomic: c.formAtomic(c.atomicStopDoss, [ doss ], 'undo start doss')
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
              undoAtomic: c.formAtomic(c.atomicStartDoss, [ doss ], 'undo stop doss')
            };
          },
          atomicSetNameSimple: function(doss, name, force) {
            
            var origName = doss.name;
            doss.updateName(name, force || false);
            return {
              $result: p.$null,
              undoAtomic: c.formAtomic(c.atomicSetNameSimple, [ doss, origName, true ], 'undo set name smp')
            };
            
          },
          atomicSetNameCalculated: function(doss) {
            
            var origName = doss.name;
            doss.updateName(doss.par.getChildName(doss));
            
            return {
              $result: p.$null,
              undoAtomic: c.formAtomic(c.atomicSetNameSimple, [ doss, origName, true ], 'undo set name clc')
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
              onComplete: function(v) {
                doss.concern('modified:', v);
              },
              undoAtomic: c.formAtomic(c.atomicModData, [ doss, origVal ], 'undo mod data')
            };
            
          },
          atomicAddChild: function(doss, child) {
            
            doss.addChild(child);
            
            return {
              $result: p.$null,
              onComplete: function(v) {
                doss.concern('modified', v);
              },
              undoAtomic: c.formAtomic(c.atomicRemChild, [ doss, child ], 'undo add child')
            };
            
          },
          atomicRemChild: function(doss, child) {
            
            doss.remChild(child);
            
            return {
              $result: p.$null,
              onComplete: function(v) {
                doss.concern('modified', v);
              },
              undoAtomic: c.formAtomic(c.atomicAddChild, [ doss, child ], 'undo rem child')
            };
            
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
            this.abilities = {}; // TODO: Consider storing these on the outline instead
            
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
          
          $heedOrder: function(params /* session, command, params, channelerParams */) { // Dossier
            
            // Dossiers handle "sync" and "getType" orders; all other orders are handled
            // through abilities.
            
            var orderDesc = this.getAddress() + '.' + params.command;
            
            var editor = new ds.Editor();
            var pass = this;
            return new P({ run: function() {
              
              var session = U.param(params, 'session');
              var command = U.param(params, 'command');
              var commandParams = U.param(params, 'params', {});
              var channelerParams = U.param(params, 'channelerParams', {}); // Passed on to the session handler; hints how to notify the remote side
              
              orderDesc += '(' + U.debugObj(commandParams) + ')';
              
              return pass.$useAbility(command, session, channelerParams, editor, commandParams)
              
            }})
              .then(function(abilityStaged) { return editor.$transact(); })
              .fail(function(err) {
                console.log('FAILURE: ' + orderDesc);
                console.error(err);
              });
            
          },
          $giveOrder: function(params /* session, data, channelerParams */) { // Dossier
            // TODO: In request-heavy environments it may be worth keeping a reference to the Channeler
            return this.outline.getRoot().channeler.$giveOrder(params);
          },
          
          addAbility: function(name, func) {
            
            /// {DOC=
            { desc: 'Adds a new ability to this Dossier under the name `name`',
              params: {
                name: { desc: 'The unique name of the ability' },
                func: { signature: function(session, channelerParams, editor, params){},
                  desc: 'A function which stages all changes, based on the ability, to the editor',
                  params: {
                    session: { desc: 'The session performing the ability' },
                    channelerParams: { desc: 'Any channelerParams for the ability if available' },
                    editor: { desc: 'The editor which will be used to perform this ability' },
                    params: { desc: 'Any ability-specific params' }
                  },
                  returns: {
                    $promise: {
                      resolve: 'All necessary actions are staged to the `editor`',
                      reject: 'Any error'
                    }
                  }
                }
              }
            }
            /// =DOC}
            
            if (O.contains(this.abilities, name)) throw new Error('Tried to overwrite ability:', this.getAddress() + ': ' + name);
            this.abilities[name] = func;
            
          },
          $useAbility: function(name, session, channelerParams, editor, params) {
            
            /// {DOC=
            { desc: 'Stages a named ability. This means `editor` is prepared ' +
                'with the necessary actions to carry out the ability. No changes ' +
                'occur until `editor.$transact` is called',
              params: {
                name: { desc: 'The name of the ability to stage' },
                session: { desc: 'The session using the ability' },
                channelerParams: { desc: 'Any available params for the Channeler' },
                editor: { desc: 'The editor to be prepared' },
                params: { desc: 'Any ability-specific params' }
              },
              returns: {
                $promise: {
                  resolve: 'All necessary actions are staged to the `editor`',
                  reject: 'Any error'
                }
              }
            }
            /// =DOC}
            
            return this.abilities[name](session, channelerParams, editor, params);
            
          },
          genAbilityFact: function(get, set) {
            
            var pass = this;
            var session = this.outline.getRoot().session || null;
            
            return {
              
              name: 'AbilityFact',
              getValue: function(addr) {
                return pass.getValue(addr);
              },
              setValue: function(val) {
                
                // Many fast calls to setValue should be ordered. If other calls haven't
                // finished when a newer one begins, those other calls should have their
                // effects cancelled if possible.
                
                var editor = new ds.Editor();
                pass.$useAbility(set, session, null, editor, { doSync: true, data: val, authParams: 'AUTH_PLZ' })
                  .then(function() {
                    return editor.$transact();
                  })
                
              }
              
            };
            
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
          
          start: function() {
            
            // Validate that double-starting isn't occurring
            if (this.started) throw new Error('Tried to double-start "' + this.getAddress() + '"');
            this.started = true;
            
            // Validate that this doss is rooted
            if (!this.isRooted()) throw new Error('Cannot start unrooted doss ' + this.outline.getAddress());
            
            // Validate that this doss has a resolved name, and that its parent is started
            if (!this.hasResolvedName() || (this.par && !this.par.started)) throw new Error('Not ready to start "' + this.getAddress() + '"');
            
            // Apply any decorator function
            (this.outline.p.decorateFunc || function(){})(this);
            
          },
          stop: function() {
            
            if (!this.started) throw new Error('Tried to double-stop "' + this.getAddress() + '"');
            this.started = false;
            
            // Stop any content
            if (this.content) {
              this.content.stop();
              delete this.content;
            }
            
            this.remWorry('editorCreated', 'builtin');
            this.remWorry('editorRemoved', 'builtin');
            this.remWorry('editorAltered', 'builtin');
            
            // Stop any change handler
            if (this.changeHandler) {
              this.remWorry('value', this.changeHandler);
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
            if (O.contains(this.children, child.name)) throw new Error('Tried to overwrite doss "' + this.children[child.name].getAddress() + '"');
            
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
              
              if (S.contains(name, '.')) {
                
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
            return O.contains(this.children, child.name) && this.children[child.name] === child;
          },
          getNamedChild0: function(name) {
            if (O.contains(this.children, name)) return this.children[name];
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
            
            // Validate that all children exist before setting a value on any of them
            for (var k in val) if (!O.contains(this.children, k)) throw new Error('Invalid setValue key: ' + this.getAddress() + ' -> ' + k);
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
            return O.contains(this.outline.i, name) ? this.outline.i[name] : null;
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
            while (O.contains(this.children, this.nextInd)) this.nextInd++; // A hole has just been filled. Ensure the next index is available
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
      
    });
    
    return ds;
  },
  runAfter2: function(ds, tr, qr, wr, p) {
    
    var outline = new ds.Outline({ name: 'app', c: ds.DossierObj });
    outline.addChild('version', ds.DossierStr);
    
    var userSet = outline.addChild('userSet', ds.DossierArr);
    var user = userSet.addDynamicChild('user', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getValue('username'); }
    });
    user.addChild('username', ds.DossierStr);
    user.addChild('password', ds.DossierStr);
    user.addChild('fname', ds.DossierStr);
    user.addChild('lname', ds.DossierStr);
    
    var storySet = outline.addChild('storySet', ds.DossierArr);
    var story = storySet.addDynamicChild('story', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getValue('quickName'); }
    });
    story.addChild('user', ds.DossierRef, { template: '~root.userSet.$username' });
    story.addChild('createdTime', ds.DossierInt);
    story.addChild('quickName', ds.DossierStr);
    story.addChild('description', ds.DossierStr);
    story.addChild('authorLimit', ds.DossierInt);
    story.addChild('contestTime', ds.DossierInt);
    story.addChild('maxWrites', ds.DossierInt);
    story.addChild('maxVotes', ds.DossierInt);
    story.addChild('maxWriteLength', ds.DossierInt);
    story.addChild('contestLimit', ds.DossierInt);
    story.addChild('anonymizeWriter', ds.DossierBln);
    story.addChild('anonymizeVoter', ds.DossierBln);
    story.addChild('slapLoadTime', ds.DossierInt);
    story.addChild('slamLoadTime', ds.DossierInt);
    story.addChild('contestInd', ds.DossierInt);
    story.addChild('phase', ds.DossierStr);
    story.addChild('timePhaseStarted', ds.DossierInt);
    
    var authorSet = story.addChild('authorSet', ds.DossierArr);
    var author = authorSet.addDynamicChild('author', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getChild('user').getNameParam('username'); },
    });
    author.addChild('user', ds.DossierRef, { template: '~root.userSet.$username' });
    author.addChild('numSlaps', ds.DossierInt);
    author.addChild('lastSlapTime', ds.DossierInt);
    author.addChild('numSlams', ds.DossierInt);
    author.addChild('lastSlamTime', ds.DossierInt);
    
    // ~root.storySet.story.contestSet
    var contestSet = story.addChild('contestSet', ds.DossierArr);
    var contest = contestSet.addDynamicChild('contest', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getValue('num'); }
    });
    contest.addChild('num', ds.DossierInt);
    
    // ~root.storySet.story.contestSet.contest.writeSet
    var contestWriteSet = contest.addChild('writeSet', ds.DossierArr);
    var contestWrite = contestWriteSet.addDynamicChild('write', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getChild('author').getNameParam('username'); }
    });
    contestWrite.addChild('author', ds.DossierRef, { template: '~par(story).authorSet.$username' });
    contestWrite.addChild('content', ds.DossierStr);
    
    // ~root.storySet.story.contestSet.contest.writeSet.write.voteSet
    var voteSet = contestWrite.addChild('voteSet', ds.DossierArr);
    var vote = voteSet.addDynamicChild('vote', ds.DossierObj, {
      nameFunc: function(doss) { return doss.getChild('author').getNameParam('username'); }
    });
    vote.addChild('author', ds.DossierRef, { template: '~par(story).authorSet.$username' });
    vote.addChild('value', ds.DossierInt);
    
    // ~root.storySet.story.writeSet.write
    var winWriteSet = story.addChild('writeSet', ds.DossierArr);
    winWriteSet.addDynamicChild('write', ds.DossierRef, { template: '~par.~par.contestSet.$contestInd.writeSet.$username',
      nameFunc: null,
    });
    
    var editor = new ds.Editor();
    var doss = editor.add({ outline: outline, data: {
      version: '0.0.2 (anonymity)',
      userSet: {
        admin: {
          username: 'admin',
          password: 'suchsmartadmin',
          fname: 'Admin',
          lname: 'Istrator'
        }
      },
      storySet: {}
      /*storySet: {
        heeheehaha: {
          user: '~root.userSet.admin',
          createdTime: 1511636794069,
          quickName: 'heeheehaha',
          description: 'hahahaheeheehee',
          authorLimit: 100,
          contestTime: 43200000,
          maxWrites: 100,
          maxVotes: 100,
          maxWriteLength: 100,
          contestLimit: 100,
          anonymizeWriter: false,
          anonymizeVoter: false,
          slapLoadTime: 432000000,
          slamLoadTime: 432000000,
          contestInd: 9,
          phase: 'awaitingWrite',
          timePhaseStarted: 1512438442203,
          authorSet: {
            admin: {
              user: '~root.userSet.admin',
              numSlaps: 0,
              lastSlapTime: 1511636794087,
              numSlams: 0,
              lastSlamTime: 1511636794087
            }
          },
          contestSet: {
            0: {
              num: 0,
              writeSet: {
                admin: {
                  author: '~par(story).authorSet.admin',
                  content: 'HELLO!!',
                  voteSet: {
                    admin: {
                      author: '~par(story).authorSet.admin',
                      value: 1
                    }
                  }
                }
              }
            },
            1: {
              num: 1,
              writeSet: {
                admin: {
                  author: '~par(story).authorSet.admin',
                  content: 'dsfadsfdsaf',
                  voteSet: {
                    admin: {
                      author: '~par(story).authorSet.admin',
                      value: 1
                    }
                  }
                }
              }
            },
            2: {
              num: 2,
              writeSet: {
                admin: {
                  author: '~par(story).authorSet.admin',
                  content: 'gfdsgsdfgsfd',
                  voteSet: {
                    admin: {
                      author: '~par(story).authorSet.admin',
                      value: 1
                    }
                  }
                }
              }
            },
          },
          writeSet: {
            0: '~par.~par.contestSet.0.writeSet.admin',
            1: '~par.~par.contestSet.1.writeSet.admin'
          }
        }
      }*/
    }});
    
    doss.addWorry('editorCreated', function(d) {
      console.log('Created:', doss.getAddress(), d);
    });
    
    return editor.$transact().then(function(result) {
      
      var fname = doss.getChild('userSet.admin.fname');
      fname.addWorry('editorAltered', function(d) {
        console.log('Modified:', fname.getAddress(), d);
      });
      
      editor.mod({ doss: fname, data: 'GREG' });
      return editor.$transact();
      
    }).then(function() {
      
      var admin = doss.getChild('userSet.admin');
      admin.addWorry('editorAltered', function(d) {
        console.log('Modified:', admin.getAddress(), d);
      });
      
      editor.mod({ doss: admin, data: { fname: 'HANK' } });
      return editor.$transact();
      
    }).then(function() {
      
      console.log('Done!');
      
    }).done();
    
  }
});
package.build();
