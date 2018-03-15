/*
TODO: Move Editor to its own package and implement a DossierEditor
TODO: Differences between `doss.getValue`, `doss.getData` need to be better defined. One of these should probably become "getJson"
*/

var package = new PACK.pack.Package({ name: 'dossier',
  dependencies: [ 'tree', 'worry', 'informer', 'p' ],
  buildFunc: function(packName, tree, worry, nf, p) {
    
    var P = p.P;
    
    var ds = {};
    
    ds.selectAll = {};
    ds.selectAll['*'] = ds.selectAll;
    
    ds.update({
      
      NAME_REGEX: /^[a-zA-Z0-9<][a-zA-Z0-9-_<,>]*$/,
      NEXT_TEMP: 0,
      getTempName: function() {
        var id = U.id(ds.NEXT_TEMP++);
        if (id === 'ffffffff') throw new Error('EXHAUSTED IDS'); // Checking for this is almost silly
        return 'TEMP((' + id + '))';
      },
      
      /* Outline - define what a Dossier structure looks like */
      
      Outline: U.makeClass({ name: 'Outline', superclass: tree.TreeNode,
        methods: function(sc, c) { return {
          
          init: function(params /* name, dossClass */) {
            
            sc.init.call(this, params);
            
            this.dossClass = U.param(params, 'dossClass', this.getDefaultClass());
            if (!U.isObj(this.dossClass, String)) this.dossClass = this.dossClass.title; // TODO: This requires class names to be globally unique
            
          },
          
          getDefaultClass: function() { throw new Error('not implemented'); },
          childNameMustMatch: function() { return true; },
          getNamedChild: function(name) {
            return null;
          }
          
        };}
      }),
      Val: U.makeClass({ name: 'Val', superclassName: 'Outline',
        methods: function(sc, c) { return {
          
          init: function(params /* name, dossClass, defaultValue */) {
            
            sc.init.call(this, params);
            this.defaultValue = U.param(params, 'defaultValue', null);
            
          },
          
          getDefaultClass: function() { return ds.DossierStr; }
          
        };}
      }),
      Obj: U.makeClass({ name: 'Obj', superclassName: 'Outline',
        methods: function(sc, c) { return {
          
          init: function(params /* name, dossClass, children */) {
            
            sc.init.call(this, params);
            
            this.children = {};
            
          },
          
          getDefaultClass: function() { return ds.DossierObj; },
          getNamedChild: function(name) {
            return U.param(this.children, name, null);
          },
          addChild: function(outline) {
            
            if (outline.par) throw new Error('Tried to add Outline(' + outline.getAddress() + ') which already has a parent');
            if (O.contains(this.children, outline.name)) throw new Error('Tried to overwrite ' + this.getAddress() + ' -> ' + outline.name);
            
            this.children[outline.name] = outline;
            this.children[outline.name].par = this;
            
            return outline;
            
          }
          
        };}
      }),
      Arr: U.makeClass({ name: 'Arr', superclassName: 'Outline',
        methods: function(sc, c) { return {
          
          init: function(params /* name, dossClass, template, nameFunc */) {
            
            sc.init.call(this, params);
            
            this.template = null;
            this.nameFunc = null;
            
          },
          
          getDefaultClass: function() { return ds.DossierArr; },
          childNameMustMatch: function() { return false; }, // Arrs regularly have children whose names don't match
          getNamedChild: function(name) {
            
            return this.template;
            
          },
          setTemplate: function(template, nameFunc) {
            
            this.template = template;
            this.template.par = this;
            
            this.nameFunc = nameFunc || null;
            
            return template;
            
          }
          
        };}
      }),
      Ref: U.makeClass({ name: 'Ref', superclassName: 'Outline',
        methods: function(sc, c) { return {
          
          init: function(params /* name, dossClass, format */) {
            
            sc.init.call(this, params);
            
            this.format = U.param(params, 'format');
            if (U.isObj(this.format, String)) this.format = this.format.split('.');
            
          },
          
          getDefaultClass: function() { return ds.DossierRef; }
          
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
              
            } else {
              
              if (outline.par.childNameMustMatch() && name !== outline.name)
                throw new Error('For outline "' + outline.getAddress() + '", cannot name doss "' + name + '"; its name must match.');
              
            }
            
            /*else if (!outline.dynamic) { // Note: The requested name can (and will) be different from the Outline name if the Outline is dynamic
              
              if (name !== outline.name) throw new Error('Tried to rename non-dynamic doss "' + outline.name + '" to "' + name + '"');
              
            }*/
            
            // Step 1: Initialize the doss
            
            var DossCls = O.walk(C, outline.dossClass.split('.'));
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
                for (var k in doss.outline.children)
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
            
            var child = U.param(params, 'child');
            var par = U.param(params, 'par', child.par);
            if (!U.isInstance(child, ds.Dossier)) throw new Error('"child" param for rem must be Dossier');
            
            this.$addAtomic(c.atomicStopDoss, [ child ], 'stpdoss ::: ' + child.outline.getAddress());
            this.$addAtomic(c.atomicRemChild, [ par, child ], 'remdoss ::: ' + child.outline.getAddress());
            
          },
          mod: function(params /* doss, data */) {
            
            var doss = U.param(params, 'doss');
            var data = U.param(params, 'data');
            this.$addAtomic(c.atomicModData, [ doss, data ], 'moddata ::: ' + doss.name + ' -> ' + U.typeOf(data));
            
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
            
            // TODO: renaming `getData` to `getJson` would lead to more symmetry
            var origVal = doss.getData();
            doss.setInternalValue(data);
            return {
              $result: p.$null,
              undoAtomic: c.formAtomic(c.atomicModData, [ doss, origVal ], 'undo mod data')
            };
            
          },
          atomicAddChild: function(doss, child) {
            
            doss.addChild(child);
            
            return {
              $result: p.$null,
              undoAtomic: c.formAtomic(c.atomicRemChild, [ doss, child ], 'undo add child')
            };
            
          },
          atomicRemChild: function(doss, child) {
            
            doss.remChild(child);
            
            return {
              $result: p.$null,
              undoAtomic: c.formAtomic(c.atomicAddChild, [ doss, child ], 'undo rem child')
            };
            
          }
        };}
      }),
      
      /* DossierInformer - creates an Informer which modifies a Dossier */
      DossierInformer: U.makeClass({ name: 'DossierInformer',
        description: 'Gets an Informer for a Dossier. When the Dossier is invalidated, ' +
          'the Informer is also invalidated',
        superclass: nf.Informer,
        methods: function(sc, c) { return {
          
          init: function(params /* doss, doSync, modAbilityName */) {
            
            sc.init.call(this, params);
            this.doss = U.param(params, 'doss');
            this.doSync = U.param(params, 'doSync', true);
            this.modAbilityName = U.param(params, 'modAbilityName', null);
            this.onDossChange = null;
            
          },
          
          getValue: function() {
            
            return this.doss.getValue();
            
          },
          setValue0: function(newVal) {
            
            /// {SERVER=
            throw new Error('not implemented');
            /// =SERVER}
            
            // TODO: The following looks funky. Abilities naturally concern "invalidated" as they must work
            // with an Editor... but do editors need to fire concerns on Dossiers?
            
            
            if (this.modAbilityName) {
              this.doss.$useAbility(this.modAbilityName, { doSync: this.doSync, data: newVal }).done();
            } else {
              this.doss.setInternalValue(newVal);
              this.worry('invalidated');
            }
            
          },
          
          isStarted: function() {
            return !!this.onDossChange;
          },
          start: function() {
            
            sc.start.call(this);
            this.onDossChange = this.worry.bind(this, 'invalidated');
            this.doss.addWorry('invalidated', this.onDossChange);
            
          },
          stop: function() {
            
            this.doss.remWorry('invalidated', this.onDossChange);
            this.onDossChange = null;
            sc.stop.call(this);
            
          }
          
        }}
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
          
          // Commands
          $heedCommand: function(params /* session, command, params, channelerParams */) { // Dossier
            
            var commandDescription = this.getAddress() + '.' + params.command;
            
            var editor = new ds.Editor();
            var pass = this;
            return new P({ run: function() {
              
              var session = U.param(params, 'session');
              var command = U.param(params, 'command');
              var commandParams = U.param(params, 'params', {});
              var channelerParams = U.param(params, 'channelerParams', {}); // Passed on to the session handler; hints how to notify the remote side
              
              commandDescription += '(' + U.debugObj(commandParams) + ')';
              
              return pass.$stageAbility(command, session, channelerParams, editor, commandParams);
              
            }})
              .then(function(abilityStaged) { return editor.$transact(); });
            
          },
          $giveCommand: function(params /* session, data, channelerParams */) { // Dossier
            // TODO: In request-heavy environments it may be worth keeping a reference to the Channeler
            return this.outline.getRoot().channeler.$giveCommand(params);
          },
          
          // Abilities
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
            
            if (O.contains(this.abilities, name)) throw new Error('Tried to overwrite ability:' + this.getAddress() + ' -> ' + name);
            this.abilities[name] = func;
            
          },
          $stageAbility: function(name, session, channelerParams, editor, params) {
            
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
            
            if (!O.contains(this.abilities, name)) return new P({ err: new Error('Invalid ability: "' + name + '"') });
            return this.abilities[name](session, channelerParams, editor, params);
            
          },
          $useAbility: function(name, params, session, channelerParams) {
            
            var editor = new ds.Editor();
            
            /// {CLIENT=
            var $stage = this.$stageAbility(name, null, null, editor, params || {});
            /// =CLIENT}
            
            /// {SERVER=
            var $stage = this.$stageAbility(name, session, channelerParams, editor, params);
            /// =SERVER}
            
            return $stage.then(editor.$transact.bind(editor));
            
          },
          
          dereference: function() {
            throw new Error('Cannot dereference "' + this.constructor.title + '"');
          },
          
          // Values
          getValue: function(addr) {
            if (U.exists(addr)) {
              var c = this.getChild(addr);
              return c ? c.getValue0() : null;
            }
            return this.getValue0();
          },
          getValue0: function() {
            throw new Error('not implemented');
          },
          setInternalValue: function(/* [ addr, ] value */) {
            if (arguments.length === 1) this.setInternalValue0(arguments[0]);
            else                        this.getChild(arguments[0]).setInternalValue0(arguments[1]);
          },
          setInternalValue0: function(value) {
            throw new Error('not implemented');
          },
          getData: function() {
            throw new Error('not implemented');
          },
          
          start: function() {
            
            if (this.started) throw new Error('Tried to double-start "' + this.getAddress() + '"');
            if (!this.isRooted()) throw new Error('Cannot start unrooted doss ' + this.outline.getAddress());
            if (!this.hasResolvedName()) throw new Error('Can\'t start ' + this.getAddress() + '; name unresolved');
            if (this.par && !this.par.started) throw new Error('Can\'t start ' + this.getAddress() + '; unrooted');
            
            this.started = true;
            
          },
          stop: function() {
            
            if (!this.started) throw new Error('Tried to double-stop "' + this.getAddress() + '"');
            this.started = false;
            
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
          
          getValue0: function() {
            return this.children;
          },
          setInternalValue0: function(val) {
            if (!U.isObj(val, Object)) throw new Error('Invalid value for `' + this.constructor.title + '`: ' + U.typeOf(val));
            
            // Validate that all children exist before setting a value on any of them
            for (var k in val) if (!O.contains(this.children, k)) throw new Error('Invalid setInternalValue key: ' + this.getAddress() + ' -> ' + k);
            for (var k in val) this.children[k].setInternalValue0(val[k]);
          },
          getChildName: function(child) {
            // Calculates the name that should be used to label the child
            throw new Error('not implemented');
          },
          getChildOutline: function(name) {
            // Returns the outline needed by a child named "name"
            throw new Error('not implemented');
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
            return O.contains(this.outline.children, name) ? this.outline.children[name] : null;
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
            // Note that DossierArrs don't maintain children in the
            // order they are added.
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
            
            // TODO: If `getChildName` is called many times for a bunch of Dossiers, but
            // none of those Dossiers are actually added during the process, these those
            // Dossiers will all get the exact same name: `this.nextInd`.
            
            // QUESTION: Is there a guarantee that after `getChildName(doss)` is called,
            // `doss` is added before `getChildName(anyOtherDoss)` is called??
            
            // It's possible that duplicate-name failures are causing silent
            // inefficiencies within Editor.
            
            if (!U.isInstance(doss, ds.Dossier)) throw new Error('Invalid "doss" param');
            if (doss.par !== this) throw new Error('Can\'t get a name for a non-child');
            
            var nameFunc = this.outline.nameFunc;
            var name = nameFunc ? nameFunc(doss) : this.nextInd;
            if (!U.valid(name)) throw new Error('Invalid name produced by `Outline(' + doss.outline.getAddress() + ').nameFunc`: "' + name + '"');
            return name;
            
          },
          getChildOutline: function(name) {
            // All DossierArr children have the same outline
            return this.outline.template;
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
            this.setInternalValue(null);
          },
          
          matches: function(value) {
            // TODO: loose comparison??
            return this.value == value;
          },
          
          getValue0: function(value) {
            return this.value;
          },
          setInternalValue0: function(value) {
            this.value = value;
          },
          
          getData: function() {
            return this.value;
          }
          
        };}
      }),
      DossierStr: U.makeClass({ name: 'DossierStr',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setInternalValue0: function(val) {
            sc.setInternalValue0.call(this, val === null ? '' : val.toString());
          }
        }; }
      }),
      DossierInt: U.makeClass({ name: 'DossierInt',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setInternalValue0: function(value) {
            // Accept the value "null"
            if (value === null) value = 0;
            
            // Accept any value which isn't NaN after `parseInt`
            value = parseInt(value);
            if (isNaN(value)) throw new Error(this.getAddress() + ' received non-numeric value: "' + value + '"');
            
            sc.setInternalValue0.call(this, value);
          }
        }; }
      }),
      DossierBln: U.makeClass({ name: 'DossierBln',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          setInternalValue0: function(value) {
            if (value === null) value = false;
            if (value !== true && value !== false) throw new Error('Received non-boolean value: "' + value + '"');
            sc.setInternalValue0.call(this, value);
          }
        }; }
      }),
      
      /* DossierRef */
      DossierRef: U.makeClass({ name: 'DossierRef',
        superclassName: 'DossierVal',
        methods: function(sc) { return {
          
          init: function(params) {
            var outline = U.param(params, 'outline');
            if (!outline.format) throw new Error('Cannot init ' + this.constructor.title + ' with Outline missing "format" value');
            sc.init.call(this, params);
          },
          setInternalValue0: function(value) {
            
            var format = this.outline.format;
            
            if (value === null) {
              
              var arrVal = null;
              
            } else if (U.isObj(value, Array)) {
              
              // TODO: `Array` format is ambiguous: is it a "."-split address?? Or is it the actual value??
              var arrVal = value;
              
            } else if (U.isObj(value, String)) {
              
              var pcs = value.split('.');
              if (pcs.length !== format.length) throw new Error('String value "' + value + '" does not match format "' + format.join('.') + '"');
              var arrVal = pcs.map(function(v, i) { return format[i][0] === '$' ? v : U.SKIP; });
              
            } else if (U.isInstance(value, ds.Dossier)) {
              
              if (!value.started) throw new Error('Can\'t reference unstarted Dossier');
              
              var vals = [];
              var addr = value.getNameChain();
              for (var endOff = 1, len = Math.min(format.length, addr.length); endOff <= len; endOff++) {
                var tmp = format[format.length - endOff];
                var val = addr[addr.length - endOff];
                
                if (tmp[0] === '$')       vals.push(val);   // Add to `vals` for each variable component in `format`
                else if (tmp[0] === '~')  break;            // We're iterating from end to start; variables cannot occur before tilde-prefixed values
                else if (tmp !== val)     throw new Error(  // Non-variable components of the supplied address must match the corresponding format component
                    '`DossierRef` "' + this.getAddress() + '" was supplied value "' + addr.join('.') + '", ' +
                    'but this doesn\'t match the format "' + format.join('.') + '"'
                  );
              }
              
              var arrVal = U.arr.reverse(vals);
              
            } else {
              
              throw new Error('`DosserRef.prototype.setInternalValue` accepts `null`, `Array`, `String` and `Dossier` but received ' + U.typeOf(value));
              
            }
            
            if (arrVal !== null) {
              
              // Validate that the value has the correct number of parameters
              if (arrVal.length !== A.count(format, function(pc) { return pc[0] === '$'; })) {
                
                throw new Error(
                  this.constructor.title + '(' + this.getAddress() + ') rejects value [ ' + arrVal.join(', ') + ' ] - ' +
                  'incorrect number of parameters for format: "' + format.join('.') + '"'
                );
                
              }
              
              // Verify that all parameters are either Strings or Numbers
              for (var i = 0; i < arrVal.length; i++) {
                if (!U.isObj(arrVal[i], String) && !U.isObj(arrVal[i], Number)) {
                  throw new Error(
                    this.constructor.title + '(' + this.getAddress() + ') rejects value value - ' +
                    'value contains invalid type: ' + U.typeOf(arrVal[i])
                  );
                }
              }
              
              // TODO: Verify that the `Array` is of the right length, and dereferences
              // to an existing value?? May make the values check irrelevant.
              
            }
            
            return sc.setInternalValue0.call(this, arrVal);
            
          },
          getValue0: function() {
            return this.value ? this.getRefAddress().join('.') : null;
          },
          
          matches: function(value) {
            // TODO: Does this make sense? Is it efficient?
            return this.dereference().getAddress() === value;
          },
          
          getRefAddress: function() {
            
            var format = this.outline.format;
            
            // If `this.value` is null resolve it to an empty array
            var vals = this.value || [];
            var ret = [];
            var valInd = 0;
            for (var i = 0; i < format.length; i++)
              ret.push(format[i][0] === '$' ? vals[valInd++] : format[i]);
            
            // TODO: This should return an `Array` instead of `String`
            return ret;
            
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
  }
});
package.build();
