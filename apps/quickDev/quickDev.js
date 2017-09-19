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
    
    qd.selectAll = {};
    qd.selectAll['*'] = qd.selectAll;
    
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
            if (this.p.innerOutline) return this.p.innerOutline;
            return this.i[childName];
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
              
              var errorsOccurred = this.tryResolveReqs(reqs);
              
              if (errorsOccurred.length === 0) {
                
                reqs.forEach(function(r) { r.resolve(); });
                
              } else {
                
                this.rollBackChanges();
                reqs.forEach(function(r) { r.reject(err); });
                throw new Error(errorsOccurred.join('; '));
                
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
              var errors = [];
              
              for (var i = 0, len = unresolved.length; i < len; i++) {
                
                var reqDat = unresolved[i];
                
                try {
                  resolved.push(reqDat.reqFunc.apply(null, reqDat.reqParams));
                  solvedOne = true;
                } catch(err) {
                  console.log('REQERR: ' + err.stack);
                  noProgress.push(reqDat);
                  errors.push(err.message);
                }
                
              }
              
              if (!solvedOne) return errors;
              
              unresolved = noProgress;
              
            }
            
            return errors;
          },
          rollBackChanges: function() {
            throw new Error('not implemented');
          }
        
        };},
        statik: {
          reqNameSimple: function(doss, name) {
            doss.updateName(name);
          },
          reqNameCalculated: function(doss) {
            var name = doss.par.getChildName(doss);
            doss.updateName(name);
          },
          reqModData: function(doss, data) {
            doss.setValue(data);
          },
          reqRemChild: function(doss, childName) {
            doss.remChild(childName);
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
              if (!U.isInstance(this.content, qd.Content)) throw new Error('Bad contentFunc');
              this.content.start();
            }
            
            if (this.outline.p.changeHandler && !this.changeHandler) {
              this.changeHandler = this.outline.p.changeHandler;
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
              for (var j = 0; (j < numDerefs) && ptr; j++) ptr = ptr.dereference();
                
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
            
            throw new Error(this.constructor.title + ' couldn\'t handle invalid command: "' + command + '"');
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
            if (!address) return this.children;
            var child = this.getChild(address);
            return child ? child.getValue() : null;
          },
          setValue: function(arg1, arg2 /* address?, value */) {
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
          getSelection: function(selection) {
            var ret = {};
            
            if ('*' in selection) {
              
              // Select all children, passing the same sub-selection in all cases
              var subSelection = selection['*'];
              for (var k in this.children) ret[k] = this.children[k].getSelection(subSelection);
              
            } else {
              
              // Selected listed children, respecting identifiers, using a different sub-selection for each child
              for (var k in selection) {
                
                if (k[0] === '(') {
                  
                  var rb = k.indexOf(')');
                  if (rb === -1) throw new Error('Missing right identifier bracket for key "' + k + '"');
                  
                  var identifier = k.substr(1, rb - 1);
                  var addr = k.substr(rb + 1).trim();
                  
                } else {
                  
                  var identifier = k;
                  var addr = k;
                  
                }
                
                var child = this.getChild(addr);
                // if (!child) throw new Error('Invalid child address: ' + this.getAddress() + ' -> ' + addr);
                if (child) ret[identifier] = child.getSelection(selection[k]);
                
              }
            
            }
            
            return ret;
          },
          
          // TODO: These are `Content`-related methods...
          getRefChild: function(addr) {
            return { getValue: function() { return this.getChild(addr); }.bind(this) };
          },
          getRefValue: function(addr) {
            return { getValue: function() { return this.getValue(addr); }.bind(this) };
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
              
            } else if (command === 'getSelection') {
              
              var reqParams = U.param(params, 'params');
              var selection = U.param(reqParams, 'selection');
              
              return new P({ val: this.getSelection(selection) });
              
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
              return editor.$addFast({ par: this, data: verifyAndSanitize(this, data) }).then(function(child) {
                
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
          init: function(params /* outline, value */) {
            sc.init.call(this, params);
            this.value = U.param(params, 'value', null);
          },
          
          $loadFromRawData: function(data, editor) {
            this.setValue(data);
            return PACK.p.$null;
          },
          
          getSelection: function(selection) {
            //if (!U.isEmptyObj(selection)) throw new Error('Invalid selection for "' + this.getAddress() + '": ' + JSON.stringify(selection));
            return this.value;
          },
          
          matches: function(value) {
            // TODO: Purposeful loose comparison??
            return this.value == value;
          },
          
          getValue: function(value) {
            return this.value;
          },
          setValue: function(value) {
            if (value !== this.value) {
              this.value = value;
              if (this.changeHandler) this.changeHandler(this);
            }
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
          setValue: function(val) {
            sc.setValue.call(this, val === null ? '' : val.toString());
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
            // Accept the value "null"
            if (value === null) value = 0;
            
            // Accept any value which isn't NaN after `parseInt`
            value = parseInt(value);
            if (isNaN(value)) throw new Error(this.getAddress() + ' received non-numeric value: "' + value + '"');
            
            sc.setValue.call(this, value);
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
            sc.setValue.call(this, value);
          }
        }; }
      }),
      DossierRef: U.makeClass({ name: 'DossierRef',
        superclassName: 'DossierValue',
        methods: function(sc) { return {
          init: function(params /* outline */) {
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
              //var vals = [];
              //for (var i = 0; i < pcs.length; i++) if (template[i][0] === '$') vals.push(pcs[i]);
              //return sc.setValue.call(this, vals);
              return sc.setValue.call(this, pcs.map(function(v, i) { return template[i][0] === '$' ? v : U.SKIP; }));
            }
            
            if (!U.isInstance(value, PACK.quickDev.Dossier)) throw new Error('`DosserRef.prototype.setValue` accepts `null`, `Array`, or a `Dossier` instance');
            
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
          getNamedChild: function(name) {
            return sc.getNamedChild.call(this, name);
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
          getRawDataView: function() {
            return this.value ? this.getRefAddress() : null;
          },
          getDataView0: function(existing) {
            return this.value ? this.dereference().getDataView(existing) : null;
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
                  
                  return ver.$apply(doss).then(function(doss) {
                    return { versionName: ver.name, doss: doss };
                  });
                  
                } else {
                  
                  return dossData;
                  
                }
                
              }).bind(null, ver));
              
            });
            
            return $dossData.then(function(dossData) {
              dossData.doss.fullyLoaded(); // Signal to the Dossier that it's ready
              return dossData.doss;
            });
            
          }
        };}
      }),
      
      // TODO: Need to call `.stop` (`.fullyUnloaded`?) on Content objects! It's not being done at the moment!
      // TODO: Generally need to put some thought into "fullyLoaded"/"fullyUnloaded" paradigm
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
            prevent any pending updates from being ignored when they return responses.
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
              if (freshness < pass.freshest) { console.log('IGNORED STALE RESULT!'); return p.$null; }
              
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
          init: function(params /* doss, address, waitMs, jitterMs */) {
            sc.init.call(this, params);
          },
          $query: function(ref) {
            return queries.$doQuery({
              address: this.address,
              command: 'getRawData',
              ref: ref
            });
          },
          $applyQueryResult: function(rawData) {
            //console.log('Syncing SMP: ' + this.doss.getAddress());
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
            
            if (!U.isInstance(this.doss, qd.DossierRef)) throw new Error('`ContentSyncRef` needs its doss to be a `DossierRef`');
            
            // Supplying `calcRef` allows
            this.calcRef = U.param(params, 'calcRef', null);
            this.selection = U.param(params, 'selection', qd.selectAll);
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
              command: 'getSelection',
              params: {
                selection: this.selection
              },
              ref: ref
            });
            
          },
          $applyQueryResult: function(refData) {
            
            // TODO: DossierRef needs to parameratize an address, so its value should only hold
            // the values for the variable components of a static address!!
            // E.g. instead of `dossRef.outline.p.baseAddress` it should be `dossRef.outline.p.addressVar`
            // { c: qd.DossierRef, p: { vars: [ 'contestInd', 'writeUsername' ], addressVar: '~par.contestSet.$contestInd.writeSet.$writeUsername' } }
            // dossRef.value === { contestInd: 12, writeUsername: 'admin' }
            
            // Because this isn't the case currently, need to struggle with "determining the parent who will hold the referenced object" etc.
            // With this implemented such parent is addressed by the parameterized addressVar with the last component removed.
            
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
              
              var editor = new qd.Editor();
              for (var i = 0; i < missingChain.length; i++) {
                $holder = $holder.then(function(ind, holder) {
                  var reqName = missingChain[ind];
                  return reqName in holder.children
                    ? holder.children[reqName]
                    : editor.$addFast({ par: holder, name: missingChain[ind], data: {} });
                }.bind(null, i));
              }
              
              /*
              var selection = {};
              var ptr = selection;
              
              for (var i = 0; i < missingChain.length; i++) {
                var name = missingChain[i];
                ptr[name] = {};
                ptr = ptr[name];
              }
              
              var bestExisting = ;
              
              var editor = new qd.Editor();
              var $holder = editor.$addFast({ par: 
              
              var $holder = queries.$doQuery({
                address: bestExisting.getAddress(),
                command: 'getSelection',
                params: {
                  selection: selection
                }
              }).then(function(result) {
                console.log('SELECTED:', result);
              });*/
              
            }
            
            return $holder.then(function(holder) {
              
              var editor = new qd.Editor();
              return editor.$addFast({
                par: holder,
                data: refData
              }).then(function() {
                doss.dereference().fullyLoaded();
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
              command: 'getSelection',
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
              
              if (k in uncovered) {
                
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
            
            var editor = new qd.Editor();
            return editor.$editFast({ add: add, rem: rem, mod: mod }).then(function() {
              doss.fullyLoaded();
            });
            
          },
          
          // Modifier methods:
          $addChild: function(params /* data, localData */) {
            var pass = this;
            var data = U.param(params, 'data');
            var localData = U.param(params, 'localData', data);
            
            // Prevent any updates while adding the child
            // (TODO: This really needs to be a stacked operation in case of multiple calls occurring before the 1st completes)
            this.cancelUpdates();
            
            // Serially add the value locally, and then remotely
            return this.doss.$handleRequest({ command: 'addData',  params: { data: localData } }).then(function(localVal) {
              
              return queries.$doQuery({ address: pass.address, command: 'addData', params: { data: data } }).then(function(remoteVal) {
                
                // Turn updates back on once the remote value has added successfully
                pass.scheduleUpdates();
                return localVal;
                
              }).fail(function(err) {
                
                // TODO: Need to remove local child
                throw err;
                
              });
              
            });
            
          }
        };}
      })
    
    });
    
    return qd;
  }
});
package.build();
