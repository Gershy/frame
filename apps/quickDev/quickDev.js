/*
TODO: Long polling
TODO: Abstract tree class in separate package!!!
TODO: Is IndexedDict efficient? Probably with lots of data present
TODO: Names of Outline properties are confusing; e.g. "c" could stand for "children"
*/
var package = new PACK.pack.Package({ name: 'quickDev',
  dependencies: [ 'queries', 'p' ],
  buildFunc: function(packName, queries, p) {
    
    var P = p.P;
    
    var qd = {};
    
    qd.update({
      
      NAME_REGEX: /^[a-zA-Z0-9<][a-zA-Z0-9-_<,>]*$/,
      NEXT_TEMP: 0,
      getTempName: function() {
        var id = U.id(qd.NEXT_TEMP++);
        
        if (id === 'ffffffff') throw new Error('EXHAUSTED IDS');
        
        return 'TEMP((' + id + '))';
      },
      
      /* IndexedDict - define a multi-key dict with high space usage but efficient search time */
      IndexedDict: U.makeClass({ name: 'IndexedDict', includeGuid: false,
        methods: function(sc) { return {
          init: function(params /* keySize, keyDelimiter */) {
            this.keySize = U.param(params, 'keySize');
            this.keyDelimiter = U.param(params, 'keyDelimiter', '.');
            this.data = {};
            this.index = {};
          },
          add: function(keys, value) {
            // Runtime is O(keySize)
            
            var compoundKey = keys.join(this.keyDelimiter);
            
            var ptr = this.data;
            var lastInd = keys.length - 1;
            
            for (var i = 0; i <= lastInd; i++) {
              var k = keys[i];
              if (i !== lastInd)  ptr = k in ptr ? ptr[k] : (ptr[k] = {});
              else                ptr[k] = value;
              
              if (!(k in this.index)) this.index[k] = {};
              this.index[k][compoundKey] = true;
            }
          },
          find: function(keys) {
            // Runtime is O(keySize)
            
            var ptr = this.data;
            for (var i = 0, len = keys.length; i < len; i++) {
              var k = keys[i];
              if (!(k in ptr)) return null;
              ptr = ptr[k];
            }
            return ptr;
          },
          rem: function(key) {
            // Runtime is O(keySize^2)
            
            if (!(key in this.index)) return;
            var compoundKeyDict = this.index[key];
            
            for (var k in compoundKeyDict) {
              var keys = k.split(this.keyDelimiter);
              
              // Use `ptrStack` instead of just `ptr` to facilitate easy empty-cleanup later
              var ptrStack = [ this.data ];
              for (var i1 = 0, len1 = keys.length; i1 < len1; i1++) {
                var k = keys[i1];
                var ptr = ptrStack[i1];
                if (k !== key) {
                  ptrStack.push(ptr[k]);
                } else {
                  delete ptr[k];
                  break;
                }
              }
              
              // Clean up empty objects in the trail
              var ind = ptrStack.length - 1;
              while (ind > 0 && U.isEmptyObj(ptrStack[ind])) {
                ind--;
                delete ptrStack[ind][keys[ind]];
              }
            }
            
            // Delete every index which includes `key`
            var index = this.index[key];
            for (var compoundKey in index) {
              
              // Every `compoundKey` in `this.index` contains `key`, so each one has to be removed
              var keys = compoundKey.split(this.keyDelimiter);
              
              for (var i = 0, len = keys.length; i < len; i++) {
                var relatedIndexRemName = keys[i];
                if (relatedIndexRemName in this.index) delete this.index[relatedIndexRemName][compoundKey];
                if (U.isEmptyObj(this.index[relatedIndexRemName])) delete this.index[relatedIndexRemName];
              }
              
            }
            
          },
          keyedData: function() {
            return this.data.flatten(this.keySize, this.keyDelimiter);
          }
        };}
      }),
      
      /* Outline - define what a Dossier structure looks like */
      Outline: U.makeClass({ name: 'Outline',
        propertyNames: [ 'c', 'p', 'i' ],
        methods: function(sc) { return {
          
          init: function(params /* c, p, i */) {
            // NOTE: The only Outlines that don't have names are the
            // Outlines for DossierLists
            var c = U.param(params, 'c');
            var p = U.param(params, 'p', {});
            var i = U.param(params, 'i', []);
            
            if (!('name' in p)) p.name = null;
            
            this.c = U.isObj(c, String) ? c : c.title; // If not a string, it's a class
            this.p = p;
            this.i = {};
            
            if ('innerOutline' in this.p && !U.isInstance(this.p.innerOutline, qd.Outline))
              this.p.innerOutline = new qd.Outline(this.p.innerOutline);
            
            for (var j = 0, len = i.length; j < len; j++) {
              var outline = U.isInstance(i[j], qd.Outline) ? i[j] : new qd.Outline(i[j]);
              this.i[outline.getProperty('name')] = outline;
            }
          },
          getNamedChild: function(childName) {
            return childName === '*' ? this.p.innerOutline : this.i[childName];
          },
          getChild: function(addr) {
            if (U.isObj(addr, String)) addr = addr.split('.');
            
            var ptr = this;
            for (var i = 0; (i < addr.length) && ptr; i++) ptr = ptr.getNamedChild(addr[i]);
            
            return ptr;
          },
          getProperty: function(name, def) {
            if (name in this.p) return this.p[name];
            if (!U.exists(def)) throw new Error('Couldn\'t get property "' + name + '"');
            return def;
          },
          $getDoss: function(data) {
            var editor = new qd.Editor();
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
          
          $create: function(outline, data) {
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
            var doss = new cls({ outline: outline }.update(outline.p));
            
            var promises = [];
            
            // Step 2: Add the name; either directly or with requirements
            if (name) {
              
              doss.updateName(name);
              
            } else {
              
              if (outline.p.name) {
                
                promises.push(new P({ custom: function(resolve, reject) {
                  
                  reqs.push({
                    reqFunc: c.reqNameSimple,
                    reqParams: [ doss, outline.p.name ],
                    resolve: resolve,
                    reject: reject
                  });
                  
                }}));
                
              } else {
                
                promises.push(new P({ custom: function(resolve, reject) {
                  
                  reqs.push({
                    reqFunc: c.reqNameCalculated,
                    reqParams: [ doss ],
                    resolve: resolve,
                    reject: reject
                  });
                
                }}));
                
              }
              
            }
            
            // Step 3: Attach to parent
            if (par) par.addChild(doss); // Better to do it after `updateName` (avoids detaching and re-attaching)
            
            // Step 4: Add the data; either directly or with requirements
            promises.push(doss.$loadFromRawData(data, this));
            
            return new P({ all: promises }).then(function() { return doss; });
          },
          $remFast: function(params /* par, name */) {
            var $ret = this.$rem(params);
            this.resolveReqs();
            return $ret;
          },
          $rem: function(params /* par, name */) {
            return this.$rem0(params);
          },
          $rem0: function(params /* par, name */) {
            var par = U.param(params, 'par');
            var name = U.param(params, 'name');
            
            var reqs = this.curReqs;
            
            return new P({ custom: function(resolve, reject) {
              
              reqs.push({
                reqFunc: c.reqRemChild,
                reqParams: [ par, name ],
                resolve: resolve,
                reject: reject
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
          $modFast: function(params /* */) {
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
                reqParams: [ doss, data ],
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
            
            while (this.curReqs.length) { // May run multiple times; resolving reqs can create more reqs
              
              var reqs = this.curReqs;
              this.curReqs = []; // Resolving reqs resets all requirements no matter what
              
              if (this.tryResolveReqs(reqs)) {
                
                reqs.forEach(function(r) { r.resolve(); });
                
              } else {
                
                var err = new Error('Couldn\'t resolve requirements');
                reqs.forEach(function(r) { r.reject(err); });
                this.rollBackChanges();
                
              }
              
            }
            
          },
          tryResolveReqs: function(unresolved) {
            // TODO: Need to consider reqs being added DURING resolveReqs
            // NOTE: `this.curReqs` is EMPTY when this method is called from `resolveReqs`
            var resolved = [];
            
            while (unresolved.length) {
              var solvedOne = false;
              var noProgress = [];
              
              for (var i = 0, len = unresolved.length; i < len; i++) {
                
                var reqDat = unresolved[i];
                
                var result = reqDat.reqFunc.apply(null, reqDat.reqParams);
                
                if (result) {
                  solvedOne = true;
                  resolved.push(reqDat);
                } else {
                  noProgress.push(reqDat);
                }
                
              }
              
              if (!solvedOne) {
                console.log('Couldn\'t solve reqs', unresolved[0].reqFunc, unresolved[0].reqParams);
                return false;
              }
              
              unresolved = noProgress;
              
            }
            
            return true;
          },
          rollBackChanges: function() {
            throw new Error('not implemented ur data is corrupt haha');
          }
        
        };},
        statik: {
          reqNameSimple: function(doss, name) {
            try {
              
              doss.updateName(name);
              return true;
              
            } catch(err) { console.log('REQSIMP ERR:', err.message); return false; }
          },
          reqNameCalculated: function(doss) {
            try {
              
              var name = doss.par.getChildName(doss);
              doss.updateName(name);
              return true;
              
            } catch (err) { console.log('REQCALC ERR:', err.message); console.error(err.stack); return false; }
          },
          reqModData: function(doss, data) {
            try {
              
              for (var k in data) {
                var child = doss.getChild(k);
                if (!child) throw new Error('Couldn\'t get doss child: ' + doss.getAddress() + ' @ ' + k);
                child.setValue(data[k]);
              }
              return true;
              
            } catch(err) { console.log('REQMOD ERR:', err.message); return false; }
          },
          reqRemChild: function(doss, childName) {
            try {
              
              doss.remChild(childName);
              return true;
              
            } catch(err) { console.log('REQREM ERR:', err.message); return false; }
          },
          
          rollBackAdd: function(doss) {
            try {
              
              if (!doss.par) throw new Error('Can\'t un-add doss without parent');
              doss.par.remChild(doss);
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
        }
      }),
      
      /* Dossier */
      Dossier: U.makeClass({ name: 'Dossier',
        superclassName: 'QueryHandler',
        methods: function(sc) { return {
          
          init: function(params /* outline */) {
            sc.init.call(this, params);
            
            this.name = qd.getTempName();
            this.outline = U.param(params, 'outline');
            
            this.par = null;
          },
          
          // Construction
          hasResolvedName: function() {
            return this.name.substr(0, 5) !== 'TEMP(';
          },
          updateName: function(name) {
            if (!qd.NAME_REGEX.test(name)) throw new Error('Illegal Dossier name: "' + name + '"');
            
            var par = this.par;
            if (par) par.remChild(this);
            this.name = name.toString();
            if (par) par.addChild(this);
            
            return this;
          },
          $loadFromRawData: function(data, editor) {
            throw new Error('not implemented');
          },
          fullyLoaded: function() {
            if (this.outline.p.contentFunc && !this.content) {
              this.content = this.outline.p.contentFunc(this);
              this.content.start();
            }
          },
          
          // Heirarchy
          getAncestry: function() {
            var ret = [];
            var ptr = this;
            while(ptr !== null) {
              ret.push(ptr);
              ptr = ptr.par;
            }
            return ret;
          },
          getNameChain: function() {
            return this.getAncestry().reverse().map(function(doss) { return doss.name.toString(); });
          },
          getAddress: function() {
            return this.getNameChain().join('.');
          },
          getRoot: function() {
            var ptr = this;
            while (ptr.par) ptr = ptr.par;
            return ptr;
          },
          getChild: function(address) {
            if (address.length === 0) return this; // Works for both strings and arrays
            
            if (U.isObj(address, String)) address = address.split('.');
            else if (!U.isObj(address, Array)) address = [ address.toString() ]; // `address` is probably numeric (or `null`?)
            
            var ptr = this;
            for (var i = 0, len = address.length; (i < len) && ptr; i++)  {
              
              var a = address[i];
              
              if (U.isObj(a, Array)) a = '<' + a.join('/') + '>';
              
              // Shave off all dereference symbols while counting them
              var numDerefs = 0;
              while (a[numDerefs] === '@') numDerefs++;
              if (numDerefs) a = a.substr(numDerefs);
              
              // Get the child
              ptr = ptr.getNamedChild(a);
              
              // Do the dereferencing as required
              for (var j = 0; j < numDerefs; j++) ptr = ptr.dereference();
                
            }
            
            return ptr;
          },
          getNamedChild: function(name) {
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
            var command = U.param(params, 'command');
            
            if (command === 'getRawData') {
              
              return PACK.p.$(this.getRawDataView());
              
            } else if (command === 'getData') {
              
              return PACK.p.$(this.getDataView({}));
              
            }
            
            throw new Error('Couldn\'t handle invalid command: "' + command + '"');
          },
          
          dereference: function() {
            throw new Error('Cannot dereference "' + this.constructor.title + '"');
          },
          
          getRawDataView: function() {
            throw new Error('Not implemented');
          },
          getDataView: function(existing) {
            if (!existing) throw new Error('Called `getDataView` without `existing` set');
            
            // But `existing` should be filled out before the call to `getDataView0`...
            var addr = this.getAddress();
            if (!(addr in existing)) {
              existing[addr] = 'DUMMY_VAL'; // Mark the element as existing (with a dummy value) before the recursion
              existing[addr] = this.getDataView0(existing); // Fill in the actual value
            }
            
            return existing[addr];
          },
          getDataView0: function(existing) {
            throw new Error('not implemented');
          }
          
        };}
      }),
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
            if (child.name in this.children) throw new Error('Tried to overwrite: "' + this.children[child.name].getAddress() + '"');
            
            child.par = this;
            this.length++;
            this.children[child.name] = child;
            
            return child;
          },
          remChild: function(child) {
            // If `child` was supplied as a number or a string, resolve it
            if (!U.isInstance(child, qd.Dossier)) child = this.children[child];
            
            if (!child || child.par !== this) throw new Error('Couldn\'t remove child "' + child.getAddress() + '"');
            
            delete this.children[child.name];
            this.length--;
            child.par = null;
            
            return child;
          },
          getNamedChild: function(name) {
            if (U.isObj(name, Object))
              return new PACK.quickDev.FilterResults({ origChildren: this.children, filter: name });
            
            if (name in this.children) return this.children[name];
            return sc.getNamedChild.call(this, name);
          },
          getValue: function(address) {
            if (!address) return this.getRawDataView();
            return this.getChild(address).getValue();
          },
          setValue: function(address, value) {
            this.getChild(address).setValue(value);
          },
          getChildName: function(child) {
            // Calculates the name that should be used to label the child
            throw new Error('Not implemented');
          },
          getChildOutline: function(name) {
            // Returns the outline needed by a child named "name"
            throw new Error('Not implemented');
          },
          
          fullyLoaded: function() {
            sc.fullyLoaded.call(this);
            for (var k in this.children) this.children[k].fullyLoaded();
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
          
          /*
          $loadFromRawData: function(data, editor) {
            // Loaded once all children have been loaded via the editor
            var promiseSet = [];
            for (var k in data)
              // Dossier is tightly coupled with Editor, so it's fair to use a "0" method here
              promiseSet.push(editor.$add0(this, this.getChildOutline(k), this.getNameForEditor(data, k), data[k])); // TODO: 2nd last param was `k` until recently
            
            return new P({ all: promiseSet });
          },
          */
          
          $handleRequest: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (command === 'getChildCount') {
              
              return new P({ val: this.length });
              
            } else if (command === 'getChildNames') {
              
              var ret = [];
              for (var k in this.children) ret.push(k);
              
              return new P({ val: ret });
              
            } else if (command === 'getRawPickedFields') {
              
              var reqParams = U.param(params, 'params');
              var fields = U.param(reqParams, 'fields');
              
              var ret = {};
              for (var i = 0, len = fields.length; i < len; i++) {
                var k = fields[i];
                ret[k] = this.children[k].getRawDataView();
              }
              
              return new P({ val: ret });
              
            } else if (command === 'getPickedFields') {
              
              var reqParams = U.param(params, 'params');
              var fields = U.param(reqParams, 'fields');
              
              var ret = {};
              var existing = {};
              for (var i = 0, len = fields.length; i < len; i++) {
                var fieldAddr = fields[i];
                var fieldKey = fieldAddr;
                
                if (fieldAddr[0] === '(') {
                  var rb = fieldAddr.indexOf(')');
                  if (rb === -1) throw new Error('Found open naming bracket without closing bracket: "' + fieldAddr + '"');
                  
                  fieldKey = fieldAddr.substr(1, rb - 1);
                  fieldAddr = fieldAddr.substr(rb + 1).trim();
                }
                
                var child = this.getChild(fieldAddr);
                ret[fieldKey] = child ? child.getDataView(existing) : null;
              }
              
              return new P({ val: ret });
              
            }
            
            return sc.$handleRequest.call(this, params);
          },
          
          getRawDataView: function() {
            var ret = {};
            for (var k in this.children) ret[k] = this.children[k].getRawDataView();
            return ret;
          },
          getDataView0: function(existing) {
            var ret = {};
            for (var k in this.children) {
              ret[k] = this.children[k].getDataView(existing);
            }
            return ret;
          }
        };}
      }),
      DossierDict: U.makeClass({ name: 'DossierDict',
        superclassName: 'DossierSet',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
          $loadFromRawData: function(data, editor) {
            if (!data) data = {};
            
            // Loaded once all children have been loaded via the editor
            var promiseSet = [];
            
            for (var k in this.outline.i)
              promiseSet.push(editor.$add0(this, this.getChildOutline(k), k, data[k] || null));
            
            /*
            for (var k in data)
              // Dossier is tightly coupled with Editor, so it's fair to use a "0" method here
              promiseSet.push(editor.$add0(this, this.getChildOutline(k), k, data[k])); // TODO: 2nd last param was `k` until recently
            */
            
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
            if (!name) throw new Error('DossierDict needs `name` for `getChildOutline`');
            if (name in this.outline.i) return this.outline.i[name];
            return null;
          }
        };}
      }),
      DossierList: U.makeClass({ name: 'DossierList',
        superclassName: 'DossierSet',
        methods: function(sc, c) { return {
          init: function(params /* outline, innerOutline, prop */) {
            sc.init.call(this, params);
            
            this.innerOutline = U.param(params, 'innerOutline');
            //this.prop = U.param(params, 'prop', '~par/nextInd');
            //this.nameFunc = U.param(params, 'nameFunc', function(par, child) { return par.nextInd; });
            
            // `this.nextInd` keeps track of the lowest unused index
            // that a child is named in `this.children`. It is only
            // updated when children with numeric names are added.
            // Useful as the "propName" when using address-props
            // ("the.address.path/propName")
            this.nextInd = 0;
            
            // Convert outline params to Outline
            if (U.isObj(this.innerOutline, Object)) this.innerOutline = new qd.Outline(this.innerOutline);
          },
          
          $loadFromRawData: function(data, editor) {
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
          },
          remChild: function(child) {
            // note that sc.remChild may alter the parameter being dealt with (resolve String to named Dossier)
            child = sc.remChild.call(this, child);
            
            // Two different possibilities here:
            // 1) Fill holes whenever there is an opportunity
            // 2) Always immediately cascade to fill holes
            // Implementing #1: there is definitely a hole at the child's name (since it has been removed), so set the next index to be there
            if (!isNaN(child.name)) this.nextInd = parseInt(child.name, 10);
            
            return child;
          },
          getChildName: function(doss) {
            /*var pcs = this.prop.split('/');
            var addr = pcs[0];
            var prop = pcs[1];
            
            var child = doss.getChild(addr);
            if (!child) throw new Error('Couldn\'t get prop child: (' + doss.getAddress() + ').getChild("' + addr + '")');
            if (!(prop in child)) throw new Error('Child "' + child.getAddress() + '" missing prop "' + prop + '"');
            
            return child[prop];*/
            
            var nameFunc = this.outline.p.nameFunc;
            var name = nameFunc ? nameFunc(this, doss) : this.nextInd;
            
            if (!U.valid(name)) throw new Error('`nameFunc` returned an invalid name');
            return name;
            
          },
          getChildOutline: function(name) {
            // All DossierList children have the same outline
            return this.innerOutline;
          },
          
          $handleRequest: function(params) {
            
            var command = U.param(params, 'command');
            
            if (command === 'addData') {
              
              var reqParams = U.param(params, 'params');
              var returnType = U.param(reqParams, 'returnType', 'address');
              
              if (![ 'address', 'raw', 'full' ].contains(returnType))
                throw new Error('Invalid return type: "' + returnType + '"');
              
              var data = U.param(reqParams, 'data');
              
              var verifyAndSanitize = this.outline.p.verifyAndSanitizeData;
              if (!verifyAndSanitize) throw new Error('Cannot "addData" on "' + this.getAddress() + '"');
              
              var editor = new qd.Editor();
              return editor.$addFast({
                par: this,
                data: verifyAndSanitize(this, data)
              }).then(function(child) {
                
                if (returnType === 'address')
                  return new P({ val: child.getAddress() });
                else if (returnType === 'raw')
                  return new P({ val: child.getRawDataView() });
                else if (returnType === 'full')
                  return new P({ val: child.getDataView({}) });
                
              });
              
            } else if (command === 'remData') {
              
              throw new Error('not implemented');
              
            }
            
            return sc.$handleRequest.call(this, params);
            
          }
          
        };}
      }),
      
      /* DossierValue */
      DossierValue: U.makeClass({ name: 'DossierValue',
        superclassName: 'Dossier',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
            this.value = null;
          },
          
          $loadFromRawData: function(data, editor) {
            this.setValue(data);
            return PACK.p.$null;
          },
          
          matches: function(value) {
            // TODO: Purposeful loose comparison??
            return this.value == value;
          },
          
          getValue: function(value) {
            return this.value;
          },
          setValue: function(value) {
            this.value = value;
          },
          modValue: function(modFunc) {
            var moddedVal = modFunc(this.getValue());
            if (!U.exists(moddedVal)) throw new Error('modFunc shouldn\'t return `undefined`');
            this.setValue(moddedVal);
          },
          
          getRawDataView: function() {
            return this.value;
          },
          getDataView0: function(existing) {
            return this.value;
          },
          
          $handleRequest: function(params) {
            var command = U.param(params, 'command');
            
            if (command === 'setValue') {
              
              var reqParams = U.param(params, 'params');
              var value = U.param(reqParams, 'value');
              
              // TODO: Various `DossierValue` subclasses should validate `value`
              
              if (!this.outline.p.verifySetValue) throw new Error('Cannot "setValue" on "' + this.getAddress() + '"');
              this.outline.p.verifySetValue(this, reqParams); // May throw errors
              
              this.setValue(value);
              
              return new P({ val: { address: this.getAddress(), value: this.value } });
              
            } else if (command === 'getValue') {
              
              return new P({ val: this.getValue() });
              
            }
            
            return sc.$handleRequest.call(this, params);
          }
        };}
      }),
      DossierString: U.makeClass({ name: 'DossierString',
        superclassName: 'DossierValue',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          getLowerValue: function() {
            return this.value.toLowerCase();
          }
        }; }
      }),
      DossierInt: U.makeClass({ name: 'DossierInt',
        superclassName: 'DossierValue',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
          setValue: function(value) {
            if (value === null) value = 0;
            if (isNaN(value)) throw new Error(this.getAddress() + ' received non-numeric value: "' + value + '"');
            
            // `parseInt` on `Number.POSITIVE_INFINITY` results in NaN! Need to avoid that.
            this.value = U.isObj(value, String) ? parseInt(value) : value;
          }
        }; }
      }),
      DossierBoolean: U.makeClass({ name: 'DossierBoolean',
        superclassName: 'DossierValue',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
          setValue: function(value) {
            if (value === null) value = false;
            if (value !== true && value !== false) throw new Error('Received non-boolean value: "' + value + '"');
            this.value = value;
          }
        }; }
      }),
      DossierRef: U.makeClass({ name: 'DossierRef',
        superclassName: 'DossierString',
        methods: function(sc) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
          setValue: function(value) {
            if (value === null) { sc.setValue.call(this, null); return; }
            
            // Dossiers are valid values for `DossierRef.prototype.setValue`; resolve them to their addresses
            if (U.isInstance(value, PACK.quickDev.Dossier)) value = value.getAddress();
            
            var base = this.getChild(this.outline.getProperty('baseAddress', '~root')).getAddress() + '.';
            if (value.substr(0, base.length) !== base)
              throw new Error('Invalid address "' + value + '" doesn\'t begin with base "' + base + '"');
            
            sc.setValue.call(this, value.substr(base.length));
          },
          getNamedChild: function(name) {
            return sc.getNamedChild.call(this, name);
          },
          
          matches: function(value) {
            // TODO: Does this make sense? Is it efficient?
            return this.dereference().getAddress() === value;
          },
          
          getRefAddress: function() {
            return this.outline.getProperty('baseAddress', '~root') + '.' + this.value;
          },
          dereference: function() {
            return this.value !== null ? this.getChild(this.getRefAddress()) : null;
          },
          getRawDataView: function() {
            return this.value !== null ? this.getRefAddress() : 'NULL';
          },
          getDataView0: function(existing) {
            return this.value !== null ? this.dereference().getDataView(existing) : null;
          }
        }; }
      }),
      
      /* Psuedo-Dossier */
      FilterResults: U.makeClass({ name: 'FilterResults',
        methods: function(sc, c) { return {
          init: function(params /* origChildren, filter, par */) {
            var origChildren = U.param(params, 'origChildren');
            var filter = U.param(params, 'filter');
            
            this.children = {};
            this.par = U.param(params, 'par', null);
            
            console.log('FILTER', filter);
            
            var filters = {
              // TODO: can implement more filters :D
              match: function() {
                var ret = {};
                for (var k in origChildren) {
                  var child = origChildren[k];
                  if (child.matches(filter.params)) this.children[k] = child;
                }
              }.bind(this)
            };
            
            if (!(filter.type in filters)) throw new Error('Invalid filter type: "' + filter.type + '"');
            
            return filters[filter.type]();
            
          },
          getNamedChild: function(name) {
            return this.children[name] || null;
          },
          getChild: function(addr) {
            if (U.isObj(addr, String)) addr = addr.split('.');
            var ptr = this;
            for (var i = 0, len = addr.length; i < len; i++)
              ptr = ptr.getNamedChild(addr[i]);
            
            return ptr;
          },
          
          // TODO: Next 4 methods are copy-pasted from DossierSet and Dossier
          $handleRequest: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (command === 'getRawData') {
              
              return PACK.p.$(this.getRawDataView());
              
            } else if (command === 'getData') {
              
              return PACK.p.$(this.getDataView({}));
              
            }
            
            throw new Error('Couldn\'t handle invalid command: "' + command + '"');
          },
          getRawDataView: function() {
            var ret = {};
            for (var k in this.children) ret[k] = this.children[k].getRawDataView();
            return ret;
          },
          getDataView0: function(existing) {
            var ret = {};
            for (var k in this.children) {
              ret[k] = this.children[k].getDataView(existing);
            }
            return ret;
          },
          getDataView: function(existing) {
            if (!existing) throw new Error('Called `getDataView` without `existing` set');
            
            // But `existing` should be filled out before the call to `getDataView0`...
            var addr = this.getAddress();
            if (!(addr in existing)) {
              existing[addr] = 'DUMMY_VAL'; // Mark the element as existing (with a dummy value) before the recursion
              existing[addr] = this.getDataView0(existing); // Fill in the actual value
            }
            
            return existing[addr];
          },
        };}
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
            
            var $dossData = new P({ val: { versionName: 'emptyState', doss: null } });
            
            this.versions.forEach(function(ver) {
              
              $dossData = $dossData.then((function(ver, dossData) {
                
                var versionName = dossData.versionName;
                var doss = dossData.doss;
                
                if (ver.detect(doss)) {
                  
                  console.log('Transitioning from version "' + versionName + '" to "' + ver.name + '"...');
                  return ver.$apply(doss).then(function(doss) {
                    return { versionName: ver.name, doss: doss };
                  });
                  
                } else {
                  
                  return dossData;
                  
                }
                
              }).bind(null, ver));
              
            });
            
            return $dossData.then(function(dossData) {
              console.log('Migrations successful!');
              return dossData.doss;
            });
            
          }
        };}
      }),
      
      /* Content - control how Dossiers determine their content */
      Content: U.makeClass({ name: 'Content',
        methods: function(sc, c) { return {
          init: function(params /* doss */) {
            this.doss = U.param(params, 'doss');
          },
          start: function() { throw new Error('Not implemented'); },
          stop: function() { throw new Error('Not implemented'); }
        };}
      }),
      ContentCalc: U.makeClass({ name: 'ContentCalc',
        includeGuid: true,
        superclassName: 'Content',
        methods: function(sc, c) { return {
          init: function(params /* doss, func, cache */) {
            sc.init.call(this, params);
            this.func = U.param(params, 'func');
            this.cache = U.param(params, 'cache');
          },
          update: function() {
            var val = this.func();
            if (val !== this.doss.getValue()) {
              this.doss.setValue(val);
            }
          },
          start: function() { this.cache[this.guid] = this; },
          stop: function() { delete this.cache[this.guid]; }
        };}
      }),
      ContentAbstractSync: U.makeClass({ name: 'ContentAbstractSync',
        superclassName: 'Content',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs */) {
            sc.init.call(this, params);
            this.address = U.param(params, 'address', this.doss.getAddress());
            this.waitMs = U.param(params, 'waitMs', 0);
            this.jitterMs = U.param(params, 'jitterMs', this.waitMs * 0.17);
            this.timeout = null;
          },
          $query: function() { throw new Error('not implemented'); },
          $applyQueryResult: function(queryResult) { throw new Error('not implemented'); },
          update: function() {
            
            var pass = this;
            
            this.$query().then(function(result) {
              
              if (pass.waitMs || pass.jitterMs)
                this.timeout = setTimeout(pass.update.bind(pass), pass.waitMs + (Math.random() * pass.jitterMs));
              
              return pass.$applyQueryResult(result);
                
            })
            .done();
            
          },
          start: function() {
            this.update();
          },
          stop: function() {
            clearTimeout(this.timeout);
          }
        };}
      }),
      ContentSync: U.makeClass({ name: 'ContentSync',
        superclassName: 'ContentAbstractSync',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs */) {
            sc.init.call(this, params);
          },
          $query: function() {
            return queries.$doQuery({
              address: this.address,
              command: 'getRawData'
            });
          },
          $applyQueryResult: function(rawData) {
            this.doss.setValue(rawData);
            return p.$null;
          }
        };}
      }),
      ContentDeepSync: U.makeClass({ name: 'ContentDeepSync',
        superclassName: 'ContentAbstractSync',
        methods: function(sc, c) { return {
          init: function(params /* doss, address, waitMs, jitterMs, fields */) {
            sc.init.call(this, params);
            this.fields = U.param(params, 'fields');
          },
          $query: function() {
            
            var address = this.address;
            var fields = this.fields;
            return queries.$doQuery({     // Get the names of the children...
              address: address,
              command: 'getChildNames'
            }).then(function(nameSet) {   // Get the picked fields from each child
              
              var nameObj = nameSet.toObj(function(name) { return name; });
              
              return new P({ all: nameObj.map(function(name) {
                
                return queries.$doQuery({
                  address: address + '.' + name,
                  command: 'getRawPickedFields',
                  params: {
                    fields: fields
                  }
                });
                
              })})
                
            });
          
          },
          $applyQueryResult: function(childData) {
            
            var doss = this.doss;
            var editor = new qd.Editor();
            editor.$clearFast({ doss: doss }).then(function() {
              
              var add = [];
              for (var name in childData) {
                add.push({
                  par: doss,
                  name: name,
                  data: childData[name]
                });
              }
              
              return editor.$editFast({ add: add });
              
            }).then(function() {
              
              console.log('ADDED TO DOSS', doss.getRawDataView());
              doss.fullyLoaded();
              
            }).fail(function(err) {
              
              console.error(err.stack);
              
            });
            
          }
        };}
      })
    });
    
    return qd;
  }
});
package.build();
