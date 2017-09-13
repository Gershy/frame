/*
TODO: Switch to POST queries? Eventually queries will exceed the recommended
size for GET (make the "post" parameter of U.request default to true)

The following top-level variables exist regardless of whether code is being
run on server or client side:
  
  -S: Index of non-serializable content that needs serialization at some
    point. For example, a function that needs to be referenced
    dynamically on client and server-side is referenced instead by its
    string index in S (allowing for serialization).
  -U: Contains utility methods
  -C: Default class directory
  -PACK: Contains all the packages
  -DB: Reference to the mongodb database object
*/

Error.stackTraceLimit = Infinity;

// Add convenience methods to pre-existing classes
[
  {  target: String.prototype,
    props: {
      contains: function(str) {
        return this.indexOf(str) !== -1;
      },
      padding: function(width, char) {
        if (!U.exists(char)) char = ' ';
        
        var len = width - this.length;
        var ret = '';
        while (ret.length < len) ret += char;
        
        return ret;
      },
      padLeft: function(width, char) {
        return this.padding(width, char) + this;
      },
      padRight: function(width, char) {
        return this + this.padding(width, char);
      },
      fill: function(num) {
        if (!this.length) throw new Error('Cannot call `fill` on empty string');
        
        var ind = 0;
        var ret = '';
        while (ret.length < num) {
          ret += this[ind];
          ind = ind === this.length - 1 ? 0 : (ind + 1);
        }
        
        return ret;
      },
      hash: function(){
        var ret = 0;
        if (this.length == 0) return ret;
        for (i = 0; i < this.length; i++) {
          char = this.charCodeAt(i);
          ret = ((ret << 5) - ret) + char;
          ret = ret & ret; // Convert to 32bit integer
        }
        return ret;
      }
    },
  },
  {  target: Object.prototype,
    props: {
      update: function(obj) {
        for (var k in obj) this[k] = obj[k];
        return this;
      },
      safeUpdate: function(obj) {
        for (var k in obj)
          if (k in this) return false;
        
        this.update(obj);
        return true;
      },
      clone: function(props) {
        return {}.update(this).update(props ? props : {});
      },
      forEach: function(it) {
        for (var k in this) it(this[k], k, this);
      },
      map: function(it) {
        var ret = {};
        for (var k in this) {
          var v = it(this[k], k, this);
          if (v !== U.SKIP) ret[k] = v;
        }
        return ret;
      },
      every: function(it) {
        for (var k in this) if (!it(this[k], k, this)) return false;
        return true;
      },
      toArray: function(func) {
        var ret = [];
        
        if (func)
          for (var k in this) ret.push(func(this[k], k));
        else
          for (var k in this) ret.push(this[k]);
        
        return ret;
      },
      keysToArray: function() {
        var ret = [];
        for (var k in this) ret.push(k);
        return ret;
      },
      flatten: function(depth, delim) {
        return this.flatten0(
          U.exists(depth) ? (depth - 1) : Number.MAX_SAFE_INTEGER,
          U.exists(delim) ? delim : '.'
        );
      },
      flatten0: function(depth, delim, prefix) {
        var ret = {};
        for (var k in this) {
          
          var kk = U.exists(prefix) ? (prefix + delim + k) : k;
          var o = this[k];
          
          if (U.isObj(o, Object) && depth > 0) {
            
            var flattened = o.flatten0(depth - 1, delim, kk);
            for (var j in flattened) ret[j] = flattened[j];
            
          } else {
            
            ret[kk] = this[k];
            
          }
          
        }
        return ret;          
      },
      hasProps: function(propNames) {
        for (var i = 0, len = propNames.length; i < len; i++)
          if (!(propNames[i] in this)) return false;
        
        return true;
      },
      shallowCompare: function(obj) {
        if (!U.isObj(obj, Object)) return false;
        for (var k in this) if (!(k in obj) || obj[k] !== this[k]) return false;
        return true;
      }
    },
  },
  {  target: Array.prototype,
    props: {
      contains: function(val) {
        return this.indexOf(val) !== -1;
      },
      map: function(it) {
        var ret = [];
        for (var i = 0, len = this.length; i < len; i++) {
          var v = it(this[i], i, this);
          if (v !== U.SKIP) ret.push(v);
        }
        return ret;
      },
      clone: function() {
        return this.map(function(n) { return n; });
      },
      any: function(func) {
        for (var i = 0, len = this.length; i < len; i++)
          if (func(this[i])) return true;
        return false;
      },
      all: function(func) {
        for (var i = 0, len = this.length; i < len; i++)
          if (!func(this[i])) return false;
        return true;
      },
      toObj: function(nameFunc, valFunc) {
        var ret = {};
        
        if (nameFunc && valFunc)
          for (var i = 0, len = this.length; i < len; i++) ret[nameFunc(this[i], i)] = valFunc(this[i], i);
        else if (nameFunc)
          for (var i = 0, len = this.length; i < len; i++) ret[nameFunc(this[i], i)] = this[i];
        else
          for (var i = 0, len = this.length; i < len; i++) ret[i] = this[i];
        
        return ret;
      },
      remove: function(elem) {
        var rem = false;
        
        for (var i = 0, len = this.length; i < len; i++) {
          var e = this[i];
          if (!rem && e === elem) rem = true;
          if (rem) this[i] = this[i + 1];
        }
        
        if (rem) this.length--;
        
        return rem;
      },
      shallowCompare: function(arr) {
        if (!U.isObj(arr, Array) || this.length !== arr.length) return false;
        for (var i = 0; i < this.length; i++) if (this[i] !== arr[i]) return false;
        return true;
      }
    },
  },
].forEach(function(obj) {
  var trg = obj.target;
  var props = obj.props;
  for (var k in props) {
    Object.defineProperty(trg, k, {
      enumerable: false, configurable: false, writable: true,
      value: props[k]
    });
  }
});

// Build utility library
global.C = {};      // All classes are stored here
global.PACK = {};   // All packages are stored here
global.NEXT_ID = 0;
global.U = {
  SKIP: { SKIP: true }, // directive to exclude an item during iteration
  
  isServer: typeof window === 'undefined' ? function() { return true; } : function() { return false; },
  
  // Parameter utility
  param: function(params, name, def) {
    /*
    Used to retrieve an item from an object. If def is provided and no
    item under the "name" key is found, def is returned.
    */
    if (U.isObj(params) && (name in params)) return params[name];
    if (U.exists(def)) return def;
    
    throw new Error('missing param: "' + name + '"');
  },
  palam: function(params, name, paramFunc) {
    /*
    Lambda-param. Exactly like U.param, but uses a lambda to retrieve
    the default value (if none was found) instead of a pre-computed
    value.
    */
    var ret = U.param(params, name, paramFunc);
    return U.isObj(ret, Function) ? ret() : ret;
  },
  pasam: function(params, name, def) {
    /*
    Serializable-param. If the result of U.param is a string
    for the given parameters, return the serializable under the
    string's name.
    */
    var p = U.param(params, name, def);
    
    if (p === null || p.constructor !== String) return { name: '', v: p };
    
    return U.getSerializable(p)
  },
  $param: function(params, name, def) {
    /*
    Promise-param. Returns a promise. Requires `PACK.p`.
    */
    return PACK.p.p(U.param(params, name, def));
  },
  exists: function(p) {
    return typeof p !== 'undefined';
  },
  valid: function(p) {
    return p !== null && U.exists(p);
  },
  
  // Object utility
  typeOf: function(obj) {
    if (obj === null) return '<NULL>';
    if (!U.exists(obj)) return '<UNDEFINED>';
    if (U.isClassedObj(obj)) return '<{' + obj.constructor.title + '}>';
    if (U.isObj(obj)) return '<(' + obj.constructor.name + ')>';
  },
  isObj: function(obj, cls) {
    try { return cls ? obj.constructor === cls : ('constructor' in obj); } catch(e) {};
    return false;
  },
  isStdObj: function(obj) {
    return U.isObj(obj, Array) || U.isObj(obj, Object);
  },
  isClassedObj: function(obj) {
    // TODO: Checking for a "title" attribute is hackish...
    try { return 'constructor' in obj && 'title' in obj.constructor; } catch(e) {};
    return false;
  },
  isInstance: function(obj, cls) {
    return U.isObj(obj) && (obj instanceof cls);
  },
  isEmptyObj: function(v) {
    for (k in v) return false;
    return true;
  },
  isEmpty: function(v) {
    if (v.constructor === Array) return v.length === 0;
    return U.isEmptyObj(v);
  },
  length: function(v) {
    if (v.constructor === Array) return v.length;
    return Object.keys(v).length;
  },
  isError: function(object) {
    try { return object.constructor === Error; } catch(e) {};
    return false;
  },
  firstKey: function(obj) {
    for (var k in obj) return k;
    throw new Error('Cannot get first property of empty object');
  },
  firstVal: function(obj) {
    return obj[U.firstKey(obj)];
  },
  matches: function(o, o2) {
    for (var k in o2) if (!(k in o) || o[k] !== o2[k]) return false;
    return true;
  },
  deepSet: function(params /* name, root, value, overwrite */) {
    var name = U.param(params, 'name');
    var root = U.param(params, 'root');
    var value = U.param(params, 'value');
    var overwrite = U.param(params, 'overwrite', false);
    
    var comps = name.split('.');
    
    var ptr = root;
    for (var i = 0, len = comps.length - 1; i < len; i++) {
      var c = comps[i];
      if (!(c in ptr)) ptr[c] = {};
      ptr = ptr[c];
    }
    var lastComp = comps[comps.length - 1];
    if (!overwrite && (lastComp in ptr)) throw new Error('tried to overwrite value: "' + name + '"');
    
    ptr[lastComp] = value;
  },
  deepGet: function(params /* name, root, createIfNone */) {
    var name = U.param(params, 'name');
    var root = U.param(params, 'root');
    var createIfNone = U.param(params, 'createIfNone', false);
    
    if (!U.isObj(name, Array)) name = name ? name.split('.') : [];
    
    var ptr = root;
    for (var i = 0, len = name.length; i < len; i++) {
      var c = name[i];
      if (!(c in ptr)) {
        if (createIfNone)  ptr[c] = {};
        else               return null;
      }
      ptr = ptr[c];
    }
    return ptr;
  },
  
  // Class utility
  makeClass: function(params /* namespace, name, description, includeGuid, superclass, superclassName, mixins, mixinResolvers, methods, statik */) {
    
    // `namespace` may either be an object or a string naming the namespace
    var namespace = U.param(params, 'namespace', global.C);
    if (namespace.constructor === String) {
      var comps = namespace.split('.');
      var dir = global.C;
      namespace = U.deepGet({ name: namespace, root: dir, createIfNone: false });
    }
    
    // Class `name` properties cannot clash within the namespace
    var name = U.param(params, 'name'); // TODO: this should be "title", not "name"
    if (name in namespace) throw new Error('tried to overwrite class "' + name + '"');
    
    // `superclass` is calculated either via `superclassName`, or provided directly with `superclass`
    var superclassName = U.param(params, 'superclassName', null);
    if (superclassName) {
      
      if (superclassName in namespace)
        var superclass = namespace[superclassName];
      else
        throw new Error('bad superclass name: "' + superclassName + '"');
      
    } else {
      
      var superclass = U.param(params, 'superclass', Object);
      
    }
    
    // Generate `heirName`
    var heirName = (superclass === Object) ? (Object.name + '.' + name) : (superclass.heirName + '.' + name);
    
    // Check for `description`
    var description = U.param(params, 'description', heirName);
    
    var includeGuid = U.param(params, 'includeGuid', (superclass === Object) ? false : (superclass.includeGuid));
    
    // Use eval to get a named constructor
    var cls = namespace[name] = includeGuid
      ? eval('(function ' + name + '(params) {\n/* ' + description + ' */\nthis.guid=global.NEXT_ID++;this.init(params?params:{});})')
      : eval('(function ' + name + '(params) {\n/* ' + description + ' */\nthis.init(params?params:{});})');
    
    // `methods` can be either an object or a function returning an object
    var methods = U.param(params, 'methods');
    if (methods.constructor === Function) methods = methods(superclass ? superclass.prototype : null, cls);
    if (superclass === Object && !methods.hasOwnProperty('init'))
      throw new Error('Missing `init` initializer for base-class "' + name + '"');
    
    [  // Validate required methods
    ].forEach(function(required) { if (!methods.hasOwnProperty(required)) throw new Error('Missing required property: "' + required + '"'); });
    [  // Validate illegal methods
      'constructor'
    ].forEach(function(reserved) { if (methods.hasOwnProperty(reserved)) throw new Error('Illegal property: "' + reserved + '"'); });
    
    // `statik` is an object naming class properties
    var statik = U.param(params, 'statik', {});
    [  // Validate required statik properties
    ].forEach(function(required) { if (!statik.hasOwnProperty(required)) throw new Error('Missing required statik property: "' + required + '"'); });
    [  // Validate illegal statik properties
      'title',
      'heirName',
      'par'
    ].forEach(function(reserved) { if (statik.hasOwnProperty(reserved)) throw new Error('Illegal statik property: "' + reserved + '"'); });
    
    // Inherit superclass methods
    if (superclass !== Object) { cls.prototype = Object.create(superclass.prototype); } 
    
    /*
    // Handle mixins
    var mixins = U.param(params, 'mixins', []);
    var mixinResolvers = U.param(params, 'mixinResolvers', {});
    var methodSet = methods.map(function
    */
    
    // Update prototype properties
    cls.prototype.constructor = cls;
    for (var k in methods) cls.prototype[k] = methods[k];
    
    // Update statik properties
    cls.toString = function() { return heirName; };
    cls.title = name;
    cls.heirName = heirName;
    cls.par = superclass;
    cls.includeGuid = includeGuid;
    for (var k in statik) cls[k] = statik[k];
    
    return cls;
  },
  
  // Randomness utility
  randFloat: function() {
    return Math.random();
  },
  randInt: function(v1, v2) {
    if (v1 > v2) {
      var t = v1;
      v1 = v2;
      v2 = t;
    }
    return v1 + Math.floor(Math.random() * (v2 + 1 - v1));
  },
  randElem: function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  
  // Serialization utility
  straighten: function(item) {
    var arr = [];
    U.straighten0(item, arr);
    return arr.map(function(item) { return item.calc; });
  },
  straighten0: function(item, items) {
    
    for (var i = 0, len = items.length; i < len; i++) // This is O(n^2) :(
      if (items[i].orig === item) return i;
    
    var ind = items.length;
    
    if (U.isObj(item, Object)) {
      
      var obj = {};
      items.push({ orig: item, calc: obj });
      for (var k in item)
        obj[k] = U.straighten0(item[k], items);
        
    } else if (U.isObj(item, Array)) {
      
      var arr = [];
      items.push({ orig: item, calc: arr });
      for (var i = 0; i < item.length; i++)
        arr.push(U.straighten0(item[i], items));
      
    } else {
      
      items.push({ orig: item, calc: item });
      
    }
        
    return ind;
  },
  unstraighten: function(items) {
    var unbuilt = { UNBUILT: true };
    return U.unstraighten0(items, 0, U.toArray(items.length, unbuilt), unbuilt, 0);
  },
  unstraighten0: function(items, ind, built, unbuilt) {
    
    if (built[ind] !== unbuilt) return built[ind];
    
    var item = items[ind];
    var value = null;
    
    if (U.isObj(item, Object)) {
      
      // value is an ordinary object
      var obj = built[ind] = {};
      for (var k in item)
        obj[k] =  U.unstraighten0(items, item[k], built, unbuilt);
      return obj;
      
    } else if (U.isObj(item, Array)) {
      
      // value is an array
      var arr = built[ind] = [];
      for (var i = 0; i < item.length; i++)
        arr.push(U.unstraighten0(items, item[i], built, unbuilt));
      return arr;
      
    }
    
    built[ind] = item;
    return item;
  },
  thingToString: function(thing) {
    var st = U.straighten(thing);  
    return JSON.stringify(st);
  },
  stringToThing: function(string) {
    return U.unstraighten(JSON.parse(string));
  },
  addSerializable: function(params /* name, value */) {
    var name = U.param(params, 'name');
    var value = U.param(params, 'value');
    
    U.deepSet({
      root: global.S,
      name: name,
      value: value
    });
    return name;
  },
  addSerializables: function(paramsList /* [ { name, value }, ... ] */) {
    paramsList.forEach(U.addSerializable.bind(U));
  },
  getSerializable: function(name) {
    return {
      name: name,
      v: U.deepGet({ name: name, root: S })
    };
  },
  
  // Misc
  timeMs: function() {
    return +new Date();
  },
  toArray: function(arrayLike, v) {
    /*
    Useful method for constructing arrays from a variety of inputs:
    
    - If `arrayLike` is an int n, return an array of n `null`s
    - If `arrayLike` is an object, return an array of all the object's
      properties.
    - Otherwise apply `Array.prototype.slice` which will look a
      `length` property, and return an array consisting of all the
      index values of the input between 0 and the `length` value.
    */
    if (arrayLike.constructor === Number) {
      if (!U.exists(v)) v = null;
      var ret = [];
      for (var i = 0; i < arrayLike; i++) ret.push(v);
      return ret;
    }
    if (arrayLike.constructor === Object) {
      var ret = [];
      for (var k in arrayLike) ret.push(arrayLike[k]);
      return ret;
    }
    return Array.prototype.slice.call(arrayLike);
  },
  range: function(rng) {
    // Sneaky way of allowing x:y notation is using an object param
    if (rng.constructor === Object) {
      var k = U.firstKey(rng);
      var v = rng[k];
    } else {
      var k = 0;
      var v = rng;
    }
    
    var ret = [];
    for (var i = k; i < v; i++) ret.push(i);
    
    return ret;
  },
  id: function(n, len) {
    if (!U.exists(len)) len = 6;
    var hex = n.toString(16);
    
    while(hex.length < len) hex = '0' + hex;
    
    return hex;
  },
  charId: function(n, len) {
    /*
    Returns an id comprised entirely of characters starting from lowercase "a".
    There will be no integer characters. For values of "n" greater than 26
    there will be funky non-alpha characters.
    */
    var hex = U.id(n, len);
    
    var letters = '';
    for (var i = 0; i < hex.length; i++) {
      var c = hex[i];
      letters += (c >= '0' && c <= '9') 
        ? String.fromCharCode('a'.charCodeAt(0) + parseInt(c))
        : String.fromCharCode(c.charCodeAt(0) + 10);
    }
    
    return letters;
  },
  debug: function(/* ... */) {
    var stuff = [];
    console.log('----------------------');
    if (arguments.length > 1) console.log('::::' + arguments[0] + '::::');
    console.log(JSON.stringify(arguments.length === 1 ? arguments[0] : arguments[1], function(k, v) { if (~stuff.indexOf(v)) return '--LOOP--'; stuff.push(v); return v; }, 2));
    console.log('');
  }
  
};

// PACKAGE: Packaging
global.PACK.pack = {
  Package: U.makeClass({ name: 'Package',
    methods: function(sc, c) { return {
      init: function(params /* name, dependencies, buildFunc, runAfter */) {
        this.name = U.param(params, 'name');
        this.dependencies = U.param(params, 'dependencies', []);
        this.buildFunc = U.param(params, 'buildFunc');
        this.runAfter = U.param(params, 'runAfter', null);
        
        this.script = U.isServer() ? null : document.currentScript;
        this.neededDeps = 0;
        this.receivedDeps = 0;
        
        this.dependencySet = {};
      },
      stepBuild: function(script) {
        /*
        This gets called on the package each time one of its dependencies
        is loaded. The number of times this method gets called is counted,
        and once it's called for each dependency it calls this.endBuild().
        */
        if (script.src in this.dependencySet) throw new Error('double-loaded dependency "' + script.src + '"');
        this.dependencySet[script.src] = 'loaded';
        
        this.receivedDeps++;
        if (this.receivedDeps === this.neededDeps) {
          // Clean up the ugly properties that were attached to the dom
          delete script.__waiting[this.name];
          if (U.isEmptyObj(script.__waiting)) delete script.__waiting;
          
          this.endBuild();
        }
      },
      endBuild: function() {
        /*
        Regardless of whether we're on the server or client side,
        this is the function that should run once all dependencies
        are loaded.
        */
        if (this.name in PACK) throw new Error('double-loaded dependency "' + this.name + '"');
        
        var args = this.dependencies.map(function(n) { return U.deepGet({ name: n, root: PACK }); });
        PACK[this.name] = this.buildFunc.apply(null, [ this.name ].concat(args));
        
        if (!U.isServer()) {
          var waiting = this.script.__waiting;
          for (var k in waiting) waiting[k].stepBuild(this.script);
        }
        
        if (this.runAfter) this.runAfter.apply(null, [ PACK[this.name] ].concat(args));
      },
      build: function() {
        /*
        Loads any dependencies the package needs, builds the package,
        and then runs this.runAfter in an environment where the package
        and all its dependencies are accessible through PACK.
        
        This method works substantially differently depending on
        whether it is executing on server or client side.
        */
        var pass = this;
        
        // Collect missing dependencies
        var missingDeps = this.dependencies.filter(function(dep) { return !(dep in PACK); });
        
        // If there are no dependencies then instantly build
        if (missingDeps.length === 0) { this.endBuild(); return; }
        
        if (U.isServer()) {
          
          missingDeps.forEach(function(dependencyName) {
            // Possible that one of this package's dependencies
            // is also a dependency of a subpackage. In this case
            // the subpackage has already loaded the dependency.
            if (dependencyName in PACK) return;
            
            // This require statement needs to add the dependencyName key to PACK
            require('./apps/' + dependencyName + '/' + dependencyName + '.js');
            
            // Ensure the key was added
            if (!(dependencyName in PACK)) throw 'failed to load dependency "' + dependencyName + '"';
          });
          
          this.endBuild();
          
        } else {
          
          this.neededDeps = missingDeps.length;
          
          for (var i = 0, len = missingDeps.length; i < len; i++) {
            var depName = missingDeps[i];
            
            // TODO: All assets have the same version??
            
            // Get the asset version by checking the version of common.js
            // (common.js is guaranteed to exist)
            var ver = document.querySelector('script[src^="common.js"]').src;
            if (ver.contains('?'))  ver = '?' + ver.split('?')[1];
            else                     ver = '';
            
            // The src ends with the version
            var src = 'apps/' + depName + '/' + depName + '.js' + ver;
            
            var script = document.querySelector('script[src="' + src + '"]');
            if (script === null) {
              var script = document.createElement('script');
              script.setAttribute('type', 'text/javascript');
              script.async = false;
              script.src = src;
              
              document.getElementsByTagName('head')[0].appendChild(script);
            }
            if (!('__waiting' in script)) script.__waiting = {};
            script.__waiting[this.name] = this;
          }
          
        }
      },
    };}
  })
};
