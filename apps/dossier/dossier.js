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
          $getDoss: function(data) {
            var editor = new ds.Editor();
            return editor.$createFast(this, data);
          }
          
        };}
      }),
      
      /* Editor - make changes to Dossier structures */
      Editor: U.makeClass({ name: 'Editor',
        methods: function(sc, c) { return {
        
          init: function(params /* add, rem */) {
            this.curReqs = [];
            this.rollBacks = [];
          },
          
          // Note: The methods in the following block aren't promised due to latency,
          // but in order to reference values ahead of their initialization
          $create: function(outline, data) {
            // Essentially calls `$add` without a "par" parameter
            return this.$add({ par: null, outline: outline, name: null, data: data });
          },
          $createFast: function(outline, data) {
            return this.$addFast({ par: null, outline: outline, name: null, data: data });
          },
          $addFast: function(params /* par, name, data, outline */) {
            var $ret = this.$add(params);
            this.resolveReqs();
            return $ret;
          },
          $add: function(params /* par, name, data, outline */) {
            var par = U.param(params, 'par', null);
            var name = U.param(params, 'name', null);
            var data = U.param(params, 'data', null);
            var outline = U.param(params, 'outline', null);
            
            if (!outline) {
              
              if (!par) throw new Error('Need to supply either "par", or "outline" to `$add`');
              outline = par.getChildOutline(name);
              
            }
            
            return this.$add0(par, outline, name, data);
          },
          $add0: function(par, outline, name, data) {
            /*
            Returns an object with 2 keys:
            1) "$doss"
              A promise that resolves to the doss generated by this method
            2) "reqs"
              An array of requirements, each of which must be resolved
              before $doss resolves
            */
            
            // Step 1: Initialize the doss
            var reqs = this.curReqs;
            var cls = U.deepGet({ root: C, name: outline.c });
            var doss = new cls({ outline: outline }.update(outline.p).update({ name: outline.name }));
            
            var promises = [];
            
            // Step 2: Add the name; either directly or with requirements
            if (!name && !outline.dynamic) name = outline.name; // The outline provides the name if it isn't an `innerOutline`
            if (name) {
              
              promises.push(new P({ custom: function(resolve, reject) {
                
                reqs.push({
                  reqFunc: c.reqNameSimple,
                  params: [ doss, name ],
                  undoFunc: c.reqNameSimple,
                  undoParams: null,
                  resolve: resolve,
                  reject: reject
                });
                
              }}));
              
            } else {
              
              promises.push(new P({ custom: function(resolve, reject) {
                
                reqs.push({
                  reqFunc: c.reqNameCalculated,
                  params: [ doss ],
                  undoFunc: c.reqNameSimple,
                  undoParams: null,
                  resolve: resolve,
                  reject: reject,
                });
              
              }}));
              
            }
            
            // Step 3: Attach to parent
            if (par) promises.push(new P({ custom: function(resolve, reject) {
              
              reqs.push({
                reqFunc: c.reqAddChild,
                params: [ par, doss ],
                undoFunc: c.reqRemChild,
                undoParams: null,
                resolve: resolve,
                reject: reject
              });
              
            }}));
            
            // Step 4: Add the data; either directly or with requirements
            /*var pass = this;
            promises.push(new P({ custom: function(resolve, reject) {
              
              reqs.push({
                reqFunc: c.reqLoadRaw,
                params: [ doss, data, pass ],
                undoFunc: null, // TODO: A `null` undoFunc can lead to errors
                undoParams: null,
                resolve: resolve,
                reject: reject
              });
              
            }}));*/
            
            // THIS IS A REQUIREMENT, BUT REQUIREMENTS DO NOT SUPPORT PROMISES D:
            // Easy solution: Make requirements promises
            // Hard solution: Make editor non-promised (this probably doesn't work though - what about Editors working with a latency-ish backend??)
            promises.push(doss.$loadFromJson(data, this));
            
            return new P({ all: promises }).then(function() { return doss; });
          },
          $remFast: function(params /* par, name */) {
            var $ret = this.$rem(params);
            this.resolveReqs();
            return $ret;
          },
          $rem: function(params /* par, name */) {
            var name = U.param(params, 'name');
            if (U.isInstance(name, ds.Dossier)) name = name.name;
            return this.$rem0(params);
          },
          $rem0: function(params /* par, name */) {
            var par = U.param(params, 'par');
            var name = U.param(params, 'name');
            
            var reqs = this.curReqs;
            
            return new P({ custom: function(resolve, reject) {
              
              reqs.push({
                reqFunc: c.reqRemChild,
                params: [ par, name ],
                undoFunc: null,
                undoParams: null,
                resolve: resolve,
                reject: reject,
                rollback: null
              });
              
            }});
          },
          $clear: function(params /* doss */) {
            var doss = U.param(params, 'doss');
            var pass = this;
            return new P({ all: doss.children.map(function(child) {
              
              return pass.$rem({ par: doss, name: child.name });
              
            })});
          },
          $clearFast: function(params /* doss */) {
            var $ret = this.$clear(params);
            this.resolveReqs();
            return $ret;
          },
          $modFast: function(params /* doss, data */) {
            var $ret = this.$mod(params);
            this.resolveReqs();
            return $ret;
          },
          $mod: function(params /* doss, data */) {
            var doss = U.param(params, 'doss');
            var data = U.param(params, 'data');
            
            var reqs = this.curReqs;
            
            return new P({ custom: function(resolve, reject) {
              
              reqs.push({
                reqFunc: c.reqModData,
                params: [ doss, data ],
                undoFunc: c.reqModData, // reqModData is its own undoFunc
                undoParams: null,
                resolve: resolve,
                reject: reject
              });
              
            }});
          },
          $editFast: function(params /* add, mod, rem */) {
            var $ret = this.$edit(params);
            this.resolveReqs();
            return $ret;
          },
          $edit: function(params /* add, mod, rem */) {
            var add = U.param(params, 'add', []);
            var mod = U.param(params, 'mod', []);
            var rem = U.param(params, 'rem', []);
            
            var promises = [];
            for (var i = 0, len = add.length; i < len; i++) promises.push(this.$add(add[i]));
            for (var i = 0, len = mod.length; i < len; i++) promises.push(this.$mod(mod[i]));
            for (var i = 0, len = rem.length; i < len; i++) promises.push(this.$rem(rem[i]));
            return new P({ all: promises });
          },
          
          // TODO: Better name for this method: "doTransaction" or "transact"
          resolveReqs: function() {
            
            /*
            TODO: This should prolly return a promise that completes when
            every known unresolved edit action is complete. Right now it
            may break if solving a req generates a new req in another tick.
            E.g. the editor has done all that it needs to add some element,
            but the particular element that's being added needs to do an
            http call, and on being added successfully that element will
            create further reqs. If that happens `resolveReqs` will complete
            before the http call, and not resolve any of the requirements
            generated by the http-element.
            */
            
            var allResolved = [];
            
            while (this.curReqs.length) { // May run multiple times; resolving reqs can create more reqs (or is this wrong? in what instances is it true?)
              
              var reqs = this.curReqs;
              this.curReqs = []; // Resolving reqs resets all requirements no matter what
              
              // The term "resolved" here is misleading; NOTHING has been resolved yet!!
              // Some actions have been performed, while others are either pending or abandoned.
              // No promise has been either rejected or resolved at this point. And either ALL
              // promises must be rejected, or ALL promises must be resolved!
              var tryResolve = this.tryResolveReqs(reqs); // TODO: `tryResolveReqs` can be inline here (I think)
              allResolved = allResolved.concat(tryResolve.resolved);
              
              if (tryResolve.rejected.length === 0) {
                
                reqs.forEach(function(r) { r.resolve(); });
                
              } else {
                
                if (allResolved.length) {
                  console.log(tryResolve.errors.length + ' ROLLBACK ERROR(S):');
                  for (var i = 0; i < tryResolve.errors.length; i++) console.log((i + 1) + ': ' + tryResolve.errors[i].stack, '\n');
                  //console.log('Need to roll back: ', allResolved);
                  this.rollBackChanges(allResolved);
                }
                var err = new Error('Couldn\'t complete transaction (rollback successful)');
                reqs.forEach(function(r) { r.reject(err); });
                return;
                
              }
              
            }
            
          },
          tryResolveReqs: function(unresolved) {
            // NOTE: `this.curReqs` is EMPTY when this method is called from `resolveReqs`
            
            var numAttempts = 0;
            var resolved = [];
            
            while (unresolved.length) {
              numAttempts++;
              
              var solvedOne = false;
              
              var errors = [];
              var rejected = [];
              
              for (var i = 0, len = unresolved.length; i < len; i++) {
                
                var reqDat = unresolved[i];
                
                try {
                  reqDat.undoParams = reqDat.reqFunc.apply(null, reqDat.params);
                  resolved.push(reqDat); // No error; resolved!
                  solvedOne = true;
                } catch(err) {
                  errors.push(err);
                  rejected.push(reqDat);
                }
                
              }
              
              if (!solvedOne) break; // No progress is being made
              
              unresolved = rejected;
              
            }
            
            console.log('Resolved in ' + numAttempts + ' attempts');
            
            return {
              resolved: resolved,
              rejected: rejected,
              errors: errors
            }
          },
          rollBackChanges: function(resolvedArr) {
            for (var i = 0; i < resolvedArr.length; i++) {
              var reqDat = resolvedArr[i];
              if (!reqDat.undoFunc) {
                console.log(reqDat);
                throw new Error('Unable to rollback without "undoFunc"');
              }
              
              reqDat.undoFunc.apply(null, reqDat.undoParams);
              //console.log('Successfully rolled back!');
            }
          }
        
        };},
        statik: function(c) { return {
          // TODO: The paradigm is SUPER MESSY RIGHT NOW
          // The "req" prefix doesn't make sense. "req*" functions are really just the "atomic" parts of transactions
          // Returning "undoParams" is messy. Should return the entire methodology for undoing.
          atomicSetNameSimple: function(doss, name, force) {
            
            var origName = doss.name;
            doss.updateName(name, force || null);
            return {
              $result: p.$null,
              undoFunc: c.atomicSetNameSimple.bind(null, doss, origName, true)
            };
            
          },
          atomicSetNameCalculated: function(doss) {
            
            var origName = doss.name;
            doss.updateName(doss.par.getChildName(doss));
            return {
              $result: p.$null,
              undoFunc: c.atomicSetNameSimple.bind(null, doss, origName, true)
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
              undoFunc: c.atomicModData.bind(null, doss, origVal)
            };
            
          },
          atomicAddChild: function(doss, child) {
            
            var child = doss.addChild(child);
            return {
              $result: new P({ val: child }),
              undoFunc: c.atomicRemChild.bind(null, doss, child.name)
            };
            
          },
          atomicRemChild: function(doss, name) {
            
            var child = doss.remChild(name);
            return {
              $result: new P({ val: child}),
              undoFunc: c.atomicAddChild.bind(null, doss, child)
            };
            
          },
          atomicLoadJson: function(doss, json, editor) {
            
            return {
              $result: doss.$loadFromJson(json, editor),
              undoFunc: function() { throw new Error('Currently no way to undo `$loadFromJson`'); }
            };
            
          },
          
          reqNameSimple: function(doss, name, force) {
            var origName = doss.name;
            doss.updateName(name, force || null);
            
            return [ doss, origName, true ]; // undoParams to reqNameSimple
          },
          reqNameCalculated: function(doss) {
            var origName = doss.name;
            doss.updateName(doss.par.getChildName(doss));
            return [ doss, origName, true ]; // undoParams to reqNameSimple
          },
          reqModData: function(doss, data) {
            // Awkward that `doss.getData()` is used with `doss.setValue`
            // Should be `getData` and `setData` (there is no `setData` as of now),
            // or `getValue` and `setValue`
            
            try {
              
              var origVal = doss.getData(); // `getData` could be named `getJson`
              doss.setValue(data);
              return [ doss, origVal ];
              
            } catch(err) {
              
            }
          },
          reqAddChild: function(doss, child) {
            doss.addChild(child);
            return [ doss, child ]; // undoParams for reqRemChild
          },
          reqRemChild: function(doss, childName) {
            var removed = doss.remChild(childName);
            return [ doss, removed ]; // undoParams for reqAddChild
          },
          reqLoadRaw: function(doss, data, editor) {
            doss.$loadFromJson(data, editor);
            return [ doss ]; // undoParams for ???? (no undo func for this one yet)
          },
          
          rollBackAdd: function(doss, child) {
            try {
              
              if (!doss.remChild(child)) throw new Error('Couldn\'t remove child');
              return true;
              
            } catch (err) { console.log('ROLLBACK ERR:', err.message); return false; }
          },
          rollBackRem: function(par, doss, originalName) {
            try {
              
              par.addChild(doss);
              var fatal = par.children[originalName] !== doss
                ? new Error('FATAL ROLLBACK REM: added child back, but name changed :(')
                : null;
              
              if (!fatal) return true;
              
            } catch (err) { console.log('ROLLBACK REM:', err.message); return false; }
            
            throw fatal;
          }
        };}
      }),
      
      /* Abilities - enable functionality on Dossiers */
      /*
      Ability: U.makeClass({ name: 'Ability',
        methods: function(sc, c) { return {
          init: function(params /* errorFunc * /) {
            this.errorFunc = U.param(params, 'errorFunc');
          },
          abilityNames: [],
          $run: function(doss, abilityName, params) { return new P({ err: new Error('not implemented') }); },
          $use: function(doss, abilityName, params) {
            var errMsg = this.errorFunc(params);
            if (errMsg) return new P({ err: new Error(errMsg) });
            if (!this.abilityNames.contains(abilityName)) return new P({ err: new Error('Invalid ability: "' + abilityName + '"') });
            
            try {
              return p.$(this.$run(doss, abilityName, params));
            } catch (err) {
              return new P({ err: err });
            }
          },
        };}
      }),
      AbilityGetDataVal: U.makeClass({ name: 'AbilityGetDataVal',
        superclassName: 'Ability',
        description: 'Enables any `Dossier` instance with a "value" property ' +
          'to return that value',
        methods: function(sc, c) { return {
          abilityNames: [ 'getData' ],
          $run: function(doss, abilityName, params) { return doss.value; }
        };}
      }),
      AbilityGetDataSet: U.makeClass({ name: 'AbilityGetDataSet',
        superclassName: 'Ability',
        description: 'Enables a `DossierSet` to return any part of its contents ' +
          'which validate, optionally filtered by a "selection"',
        methods: function(sc, c) { return {
          abilityNames: [ 'getData' ],
          $run: function(doss, abilityName, params /* selection * /) {
            var selection = U.param(params, 'selection', ds.selectAll);
            
            if (selection.contains('*')) {
              
              // This is easy; loop through all children (which support "getData")
              var innerParams = { selection: selection['*'] }; // TODO: What about other parameters?
              var getInner = doss.children.map(function(c, k) { return c.hasAbility('getData') ? c.$useAbility('getData', innerParams) : U.SKIP; });
              
            } else {
              
              // This is harder; loop through all selected children, support renaming, and forward selection parameters
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
                if (!child) return new P({ err: new Error('Couldn\'t get child ' + doss.getAddress() + ' -> ' + addr) });
                if (child.hasAbility('getData')) getInner[rename] = child.$useAbility('getData', { selection: selection[k] });
                
              }
              
            }
            
            return new P({ all: getInner });
          }
        };}
      }),
      AbilityGetDataSetDirect: U.makeClass({ name: 'AbilityGetDataSetDirect',
        superclassName: 'Ability',
        description: 'Enables a `DossierSet` to return any part of its contents ' +
          'without validation, optionally filtered by a "selection"',
        methods: function(sc, c) { return {
          abilityNames: [ 'getData' ],
          $run: function(doss, abilityName, params) {
            var selection = U.param(params, 'selection', null);
            
            // No selection makes this easy
            if (!selection) return doss.getData();
            
            // With a selection, need to recursively apply sub-selections
            var recurse = function(doss, sel) {
              var ret = {};
              
              if (!U.isObj(sel, Object) || U.isEmptyObj(sel)) {
                
                return doss.getValue();
                
              } else if (sel.contains('*')) {
                
                var innerSel = sel['*'];
                for (var k in doss.children) ret[k] = recurse(doss, innerSel);
                
              } else {
                
                for (var k in sel) ret[k] = recurse(doss, sel[k]);
                
              }
              
              return ret;
            };
            return recurse(doss, selection);
          }
        };}
      }),
      AbilityGetDataRef: U.makeClass({ name: 'AbilityGetDataRef',
        superclassName: 'Ability',
        methods: function(sc, c) { return {
          abilityNames: [ 'getData' ],
          $run: function(doss, abilityName, params) { return new P({ val: doss.value ? doss.getRefAddress() : null }); }
        };}
      }),
      
      AbilityModDataVal: U.makeClass({ name: 'AbilityModDataVal',
        superclassName: 'Ability',
        methods: function(sc, c) { return {
          abilityNames: [ 'modData' ],
          $run: function(doss, abilityName, params) {
            doss.setValue(U.param(params, 'data'));
            return p.$null;
          }
        };}
      }),
      AbilityModDataSet: U.makeClass({ name: 'AbilityModDataSet',
        superclassName: 'Ability',
        methods: function(sc, c) { return {
          abilityNames: [ 'modData', 'addData', 'remData' ],
          $run: function(doss, abilityName, params) {
            if (abilityName === 'modData') {
              
              
              
            } else if (abilityName === 'addData') {
              
              
              
            } else if (abilityName === 'remData') {
              
              
              
            }
          }
        };}
      }),
      */
      
      abilities: (function() {
        
        // Ability: getData
        var $getDataVal = function(doss, params /* */) {
          return new P({ val: doss.value });
        };
        var $getDataSet = function(doss, params /* selection */) {
          var selection = U.param(params, 'selection', ds.selectAll);
          
          if (selection.contains('*')) {
            
            var innerParams = { selection: selection['*'] };
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
        var $modDataVal = function(doss, params /* [ editor, ] data */) {
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor', null);
          
          return (editor
            ? editor.$mod({ doss: doss, data: data })
            : new ds.Editor({}).$modFast({ doss: doss, data: data })
          ).then(function() { return null; });
        };
        var $modDataSet = function(doss, params /* [ editor, ] data */) {
          var data = U.param(params, 'data');
          if (!U.isObj(data, Object)) return new P({ err: new Error('modData expects the "data" param to be an `Object`') });
          
          var editor = U.param(params, 'editor', null);
          var immediate = !editor;
          if (immediate) editor = new ds.Editor({});
          
          var $ret = new P({
            all: data.map(function(v, k) { return doss.children[k].$useAbility('modData', { editor: editor, data: v }); })
          }).then(function() { return null; });
          
          if (immediate) editor.resolveReqs();
          return $ret;
        };
        var $modDataSetDirect = $modDataVal; // Both of these just call `doss.setValue(...)` with the value
        var $modDataRef = $modDataVal;
        
        // Ability: addData
        var $addData = function(doss, params /* [ editor, ] [ prepareForMod, ] data */) {
          
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor', null);
          var prepareForMod = U.param(params, 'prepareForMod', null);
          
          var immediate = !editor;
          if (immediate) editor = new ds.Editor({});
          
          // Try to add
          var $ret = editor.$add({ par: doss, data: data }).then(function(child) {
            
            var modParams = { data: data };
            if (prepareForMod) modParams = prepareForMod(child, modParams);
            
            // On add success, try to mod
            return child.$useAbility('modData', modParams)
              
              // On mod failure, some deep-child's "modData" ability call failed
              .fail(function(err) {
                
                // NEED to remove `child` from `doss`
                return new ds.Editor({}).$remFast({ par: doss, name: child.name })
                  
                  // On removal failure, this is a fatal situation (corrupt data)
                  .fail(function(err0) { console.log('ADDED, BAD MOD, BAD REM D:', err.stack); throw err0; })
                  
                  // On removal success everything is fine, but signal that the initial $addData ability use failed
                  .then(function() { console.log('ADDED, bad mod, good rem! :D'); throw err; });
                
              })
              
              // On mod success, everything is dandy! Return the child address
              .then(function() { return { address: child.getAddress() }; });
            
          });
          
          if (immediate) editor.resolveReqs();
          return $ret;
          
          // 1) Call doss.$addData, which will ignore any ability supervision and blindly
          //    add the child
          // 2) Explicitly use the "modData" ability (which will respect supervision)
          // 3) If there are any errors, remove the child (and reject with the error)
          // 4) Return the created, modded child
          
          return doss.$addData({ editor: editor, params: params }).then(function(child) {
            
            return child.$useAbility('modData', params)
              .fail(function(err) {
                return doss.$remData({ name: child.name }).then(function() { throw err; });
              })
              .then(function() { return { address: child.getAddress() }; });
          });
          
        };
        var $addDataDirect = function(doss, params /* [ editor, ] data */) {
          var data = U.param(params, 'data');
          var editor = U.param(params, 'editor', null);
          
          return (editor
            ? editor.$add({ par: doss, data: data })
            : new ds.Editor({}).$addFast({ par: doss, data: data })
          ).then(function(child) { return { address: child.getAddress() }; });
        };
        
        // Ability: remData
        var $remData = function(doss, params /* [ editor, ] name */) {
          var name = U.param(params, 'name');
          var editor = U.param(params, 'editor', null);
          
          return (editor
            ? editor.$rem({ par: doss, name: name })
            : new ds.Editor({}).$remFast({ par: doss, name: name })
          ).then(function() { return null; });
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
            sc.init.call(this, params);
            
            this.name = ds.getTempName();
            this.outline = U.param(params, 'outline');
            
            this.par = null;
          },
          
          // Construction
          hasResolvedName: function() {
            return this.name.substr(0, 5) !== 'TEMP(';
          },
          updateName: function(name, force) {
            if (!force && !ds.NAME_REGEX.test(name)) throw new Error('Illegal Dossier name: "' + name + '"');
            
            var par = this.par;
            if (par) par.remChild(this);
            
            var origName = this.name;
            this.name = name.toString();
            
            if (par) {
              
              
              try {
                
                par.addChild(this);
                
              } catch(err) {
                
                // It's crucial that re-adding `this` to `par` (and failing) doesn't leave
                // the `Dossier` structure changed! Upon failure, revert back to the
                // original, unchanged state and throw an error
                this.name = origName;
                
                // Re-adding with the original name NEEDS to succeed - otherwise there's no
                // way to return to the original state
                try {
                  
                  par.addChild(this);
                  
                } catch(fatalErr) {
                  
                  console.log('FATAL MFRF (mod fail, revert fail)', fatalErr.stack);
                  throw fatalErr;
                  
                }
                
                // Reverting to the original state has succeeded, throw a non-fatal error
                throw err;
                
              }
              
            }
            
            return this;
          },
          $loadFromJson: function(data, editor) {
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
            
            return null;
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
            
            try {
              
              var pass = this;
              
              // Action logging:
              // console.log(this.getAddress() + ' -> ' + name + '(' + JSON.stringify(params) + ')');
              
              // Ensure the result is a promise
              return p.$(abilities[trueName](this, params || {}));
              
            } catch(err) {
              
              return new P({ err: err });
              
            }
          },
          
          dereference: function() {
            throw new Error('Cannot dereference "' + this.constructor.title + '"');
          },
          
          getData: function() {
            throw new Error('Not implemented');
          },
          
          $isStarted: function() {
            if (!this.$started) this.$started = new P({});
            return this.$started;
          },
          
          start: function() {
            
            // Add any contentFunc
            var contentFunc = this.outline.p.contentFunc;
            if (contentFunc && !this.content) {
              this.content = contentFunc(this);
              if (!U.isInstance(this.content, ds.Content)) throw new Error('Bad contentFunc');
              this.content.start();
            }
            
            // Add any changeHandler
            var changeHandler = this.outline.p.changeHandler;
            if (changeHandler && !this.hasConcern('value', changeHandler)) {
              this.changeHandler = changeHandler.bind(null, this);
              this.addConcern('value', this.changeHandler);
            }
            
            if (!this.$started) this.$started = new P({});
            if (this.$started.status === 'pending') this.$started.resolve(null);
            
          },
          stop: function() {
            
            // Stop any content
            if (this.content) this.content.stop();
            
            // Stop any change handler
            if (this.changeHandler) {
              this.remConcern('value', this.changeHandler);
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
            if (U.isObj(name, Object))
              return new ds.FilterResults({ origChildren: this.children, filter: name });
            
            if (this.children.contains(name)) return this.children[name];
            return sc.getNamedChild0.call(this, name);
          },
          
          // TODO: `getValue` and setValue here aren't compatible
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
              
              for (var k in arg1) this.children[k].setValue(arg1[k]);
              
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
          },
          
          start: function() {
            sc.start.call(this);
            for (var k in this.children) this.children[k].start();
          }
        };}
      }),
      DossierObj: U.makeClass({ name: 'DossierObj',
        superclassName: 'DossierSet',
        methods: function(sc) { return {
          $loadFromJson: function(data, editor) {
            
            // TODO: `DossierSet` json loading doesn't clear the `DossierSet` first
            
            if (!data) data = {};
            
            // Loaded once all children have been loaded via the editor
            var promiseSet = [];
            
            for (var k in this.outline.i)
              promiseSet.push(editor.$add0(this, this.getChildOutline(k), k, data[k] || null));
            
            return new P({ all: promiseSet });
          },
          
          // Child methods
          getNameForEditor: function(data, k) {
            return k;
          },
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
          
          $loadFromJson: function(data, editor) {
            if (!data) data = {};
            
            // Loaded once all children have been loaded via the editor
            var promiseSet = [];
            for (var k in data)
              // Dossier is tightly coupled with Editor, so it's fair to use a "0" method here
              promiseSet.push(editor.$add0(this, this.getChildOutline(k), null, data[k])); // TODO: 2nd last param was `k` until recently
            
            return new P({ all: promiseSet });
          },
          
          // Child methods
          addChild: function(child) {
            child = sc.addChild.call(this, child);
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
          
          $loadFromJson: function(data, editor) {
            this.setValue(data);
            return PACK.p.$null;
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
            
            if (!U.isInstance(value, ds.Dossier)) throw new Error('`DosserRef.prototype.setValue` accepts `null`, `Array`, or a `Dossier` instance');
            
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
                throw new Error('Doss at addr "' + addr.join('.') + '" doesn\'t match template "' + template.join('.') + '"');
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
          getHolderDoss: function() {
            // Returns the `Dossier` which holds this `DossierRef`'s reference
            var addr = this.getRefAddress().split('.');
            return this.getChild(addr.slice(0, addr.length - 1));
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
      FilterResults: U.makeClass({ name: 'FilterResults',
        superclass: tree.TreeNode,
        methods: function(sc, c) { return {
          init: function(params /* origChildren, filter, par */) {
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
          */
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
              
              /*$dossData = $dossData.then((function(ver, dossData) {
                
                var versionName = dossData.versionName;
                var doss = dossData.doss;
                
                if (ver.detect(doss)) {
                  
                  return ver.$apply(doss).then(function(doss) {
                    return { versionName: ver.name, doss: doss };
                  });
                  
                } else {
                  
                  return dossData;
                  
                }
                
              }).bind(null, ver));*/
              
            });
            
            return $dossData.then(function(doss) {
              if (!U.isInstance(doss, ds.Dossier)) throw new Error('Versioner\'s final output was not a `Dossier`');
              doss.start(); // Signal to the Dossier that it's ready
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
          },
          start: function() { if (this.cache) this.cache[this.guid] = this; },
          stop: function() { if (this.cache) delete this.cache[this.guid]; }
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
          init: function(params /* doss, address, waitMs, jitterMs */) {
            sc.init.call(this, params);
            
            // TODO: Should it even be possible to have `this.address !== this.doss.getAddress()`??
            this.address = U.param(params, 'address', this.doss.getAddress());
            this.waitMs = U.param(params, 'waitMs', 0);
            this.jitterMs = U.param(params, 'jitterMs', this.waitMs * 0.17);
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
            this.timeout = setTimeout(this.update.bind(this), this.waitMs + (Math.random() * this.jitterMs));
          },
          update: function() {
            
            var pass = this;
            
            this.freshestReq++;
            this.$query(this.freshestReq).then(function(refResult) {
              
              var freshness = refResult.ref;
              var result = refResult.result;
              
              // Make sure a stale response never overwrites a fresher one
              if (freshness < pass.freshest) return p.$null;
              
              // If `pass.timeout` is `null`, is signals that updates are currently cancelled.
              // Having `pass.$query` complete when updates are cancelled indicates that the
              // result of the query is stale, so it is ignored
              if (pass.timeout === null) return p.$null;
              
              pass.freshest = freshness;
              
              if (pass.waitMs || pass.jitterMs) pass.scheduleUpdates();
              return pass.$applyQueryResult(result);
                
            }).fail(function(err) {
              
              console.log('Sync error on: ' + pass.doss.getAddress());
              throw err;
              
            }).done();
            
          },
          start: function() {
            sc.start.call(this);
            this.timeout = true; // Needed to avoid the `this.timeout === null` check in `this.update`
            this.update();
          },
          stop: function() {
            sc.stop.call(this);
            this.cancelUpdates();
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
            // console.log('Syncing SMP: ' + this.doss.getAddress());
            this.doss.setValue(rawData);
            return p.$null;
          }
        };}
      }),
      ContentSyncRef: U.makeClass({ name: 'ContentSyncRef',
        superclassName: 'ContentAbstractSync',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, refParAddress, waitMs, jitterMs, selection */) {
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
            
            // Handle relative addresses
            // TODO: This isn't a smart method. Does it handle ALL relative addresses?
            // TODO: Also, `'app'` shouldn't be a keyword!! It shouldn't appear in framework code.
            if (addr[0] !== '~root' && addr[0] !== 'app') {
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
            
            // console.log('Syncing REF: ' + this.doss.getAddress());
            
            var doss = this.doss;
            var holder = doss.getHolderDoss();
            if (holder) {
              
              var $holder = new P({ val: holder });
              
            } else {
              
              var holderAddr = doss.getHolderAddress().split('.');
              
              var missingChain = [];
              while (holderAddr.length && !doss.getChild(holderAddr)) {
                missingChain.push(holderAddr[holderAddr.length - 1]);
                holderAddr = holderAddr.slice(0, holderAddr.length - 1);
              }
              
              missingChain.reverse();
              
              // Note that at this point, `holderAddr` points to the deepest existing parent
              var $holder = new P({ val: doss.getChild(holderAddr) });
              
              var editor = new ds.Editor();
              for (var i = 0; i < missingChain.length; i++) {
                $holder = $holder.then(function(ind, holder) {
                  var reqName = missingChain[ind];
                  return reqName in holder.children
                    ? holder.children[reqName]
                    : editor.$addFast({ par: holder, name: missingChain[ind], data: {} });
                }.bind(null, i));
              }
              
            }
            
            return $holder.then(function(holder) {
              
              var editor = new ds.Editor();
              return editor.$addFast({
                par: holder,
                data: refData
              }).then(function() {
                doss.dereference().start();
              });
              
            });
            
            
          }
        };}
      }),
      ContentSyncDict: U.makeClass({ name: 'ContentSyncDict',
        superclassName: 'ContentAbstractSync',
        description: 'Syncs the children of a set-type Dossier. Only removes and adds children; ' +
          'this `Content` does not update the values of a child even if those values have changed. ' +
          'In order to update such values, children should be assigned inner `Content`s.',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs, fields */) {
            sc.init.call(this, params);
            //this.fields = U.param(params, 'fields');
            this.selection = U.param(params, 'selection');
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
            var mod = [];
            
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
            
            // Uncovered now contains keys which exists in `doss` but not `childData` - such keys are outdated
            for (var k in uncovered) rem.push({ par: doss, name: k });
            
            //console.log('Syncing DCT: ' + doss.getAddress());
            
            var editor = new ds.Editor();
            return editor.$editFast({ add: add, rem: rem, mod: mod }).then(function() {
              doss.start();
            });
            
          },
          
          // Modifier methods:
          $addChild: function(params /* data, localData */) {
            var pass = this;
            var data = U.param(params, 'data');
            var localData = U.param(params, 'localData', data);
            
            // Prevent any updates while adding the child
            // (TODO: This really needs to be a stacked operation in case of multiple calls occurring before the 1st completes)
            // TODO: What about update cancellations which are never resumed, because the operation fails??
            this.cancelUpdates();
            
            // Serially add the value locally, and then remotely
            try {
              
              //  return this.doss.$useAbility('addChild', { data: localData }).then(function(val) {
              //    .
              //    .
              //    .
              //  });
              
              console.log('USING ABILITY ON', this.doss.getAddress());
              
              return this.doss.$useAbility('addData', { data: localData }).then(function(localVal) {
                
                return queries.$doQuery({ address: pass.address, command: 'addData', params: { data: data } }).then(function(remoteVal) {
                  
                  // Turn updates back on once the remote value has added successfully
                  pass.scheduleUpdates();
                  return localVal; // Work with the local value instead of remote
                  
                }).fail(function(err) {
                  
                  // TODO: Need to remove local child
                  throw err;
                  
                });
                
              });
              
            } catch (err) {
              
              // TODO: This is lazyiness! doss.$handleRequest can throw an unpromised error. Really, shouldn't
              // be using an api-related method ($handleRequest) in this context; should simply be able to
              // call an "addData" method directly.
              var $p = new P({});
              $p.reject(err);
              return $p;
              
            }
            
          }
        };}
      })
    
    });
    
    return ds;
  }
});
package.build();
