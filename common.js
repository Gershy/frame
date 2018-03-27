Error.stackTraceLimit = Infinity;

// Add convenience methods to pre-existing classes
[
  { target: Object.prototype,
    props: {
      update: function(obj) {
        for (var k in obj) this[k] = obj[k];
        return this;
      },
      clone: function(props) {
        var ret = {};
        for (var k in this) ret[k] = this[k];
        if (props) for (var k in props) ret[k] = props[k];
        return ret;
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
      toArray: function(func) {
        var ret = [];
        
        if (func)
          for (var k in this) ret.push(func(this[k], k));
        else
          for (var k in this) ret.push(this[k]);
        
        return ret;
      },
      pick: function(names) {
        var ret = {};
        for (var i = 0, len = names.length; i < len; i++) ret[names[i]] = this[names[i]];
        return ret;
      },
      toss: function(names) {
        var ret = this.clone();
        for (var i = 0, len = names.length; i < len; i++) delete ret[names[i]];
        return ret;
      },
      contains: Object.prototype.hasOwnProperty
    },
  },
  { target: String.prototype,
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
  { target: Array.prototype,
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
      toObj: function(keyFunc, valFunc) {
        var ret = {};
        
        if (keyFunc && valFunc)
          for (var i = 0, len = this.length; i < len; i++) ret[keyFunc(this[i], i)] = valFunc(this[i], i);
        else if (keyFunc)
          for (var i = 0, len = this.length; i < len; i++) ret[keyFunc(this[i], i)] = this[i];
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
      }
    },
  }
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

// Build utility library (note: client-side, the "global" variable is installed by an inline <script> element)
global.C = {};      // All classes are stored here
global.PACK = {};   // All packages are stored here
global.NEXT_ID = 0;
global.U = {
  
  // Alias
  YEE: true,
  NAW: false,
  VALID: true,
  BOGUS: false,
  
  SKIP: { SKIP: true }, // directive to exclude an item during iteration
  
  isServer: typeof window === 'undefined' ? function() { return true; } : function() { return false; },
  
  // Parameter utility
  param: function(params, name, def) {
    /*
    Used to retrieve an item from an object. If def is provided and no
    item under the "name" key is found, def is returned.
    */
    if (U.isObj(params) && O.contains(params, name)) return params[name];
    if (U.exists(def)) return def;
    throw new Error('missing param: "' + name + '"');
  },
  pafam: function(params, name, def) { // `def` is a mandatory param
    if (U.isObj(params) && O.contains(params, name)) return params[name];
    return def();
  },
  exists: function(p) {
    return typeof p !== 'undefined';
  },
  isDefined: function(v) {
    return typeof v !== 'undefined';
  },
  valid: function(p) {
    return p !== null && U.exists(p);
  },
  
  // Type utility
  typeOf: function(obj) {
    if (obj === null) return '<NULL>';
    if (!U.isDefined(obj)) return '<UNDEFINED>';
    if (U.isClassedObj(obj)) return '<{' + obj.constructor.title + '}>';
    if (U.isObj(obj)) return '<(' + obj.constructor.name + ')>';
    return '<UNKNOWN>';
  },
  isObj: function(obj, cls) {
    try { return cls ? obj.constructor === cls : ('constructor' in obj); } catch(e) {};
    return false;
  },
  isStdObj: function(obj) {
    return U.isObj(obj, Array) || U.isObj(obj, Object);
  },
  isPrimitive: function(obj) {
    // Technically this list should include `RegExp`
    return U.isObj(obj, String) || U.isObj(obj, Number) || U.isObj(obj, Boolean) || obj === null;
  },
  isJson: function(obj) {
    return U.isStdObj(obj) || U.isPrimitive(obj);
  },
  isClassedObj: function(obj) {
    // TODO: Checking for a "title" attribute is hackish... This method should probably be removed
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
  objSizeGt: function(obj, min) {
    var count = 0;
    for (var k in obj) if (++count > min) return true;
    return false;
  },
  objSizeEq: function(obj, eq) {
    var count = 0;
    for (var k in obj) if (++count > eq) return false;
    return count === eq;
  },
  firstKey: function(obj) {
    for (var k in obj) return k;
    throw new Error('Cannot get first property of empty object');
  },
  firstVal: function(obj) {
    for (var k in obj) return obj[k];
    throw new Error('Cannot get first value of empty object');
  },
  
  // JSON utility
  obj: {
    is: function(v) { return U.isObj(v, Object); },
    clone: function(obj1) {
      var ret = {};
      for (var k in obj1) ret[k] = obj1[k];
      return ret;
    },
    contains: function(obj, k) {
      return obj.hasOwnProperty(k);
    },
    encloses: function(obj, keys) {
      for (var i = 0, len = keys.length; i < len; i++) {
        var k = keys[i];
        if (!obj.hasOwnProperty(k)) return false;
        obj = obj[k];
      }
      return true;
    },
    walk: function(obj, keys) {
      for (var i = 0, len = keys.length; i < len; i++) {
        var k = keys[i];
        if (!obj.hasOwnProperty(k)) return null;
        obj = obj[k];
      }
      return obj;
    },
    each: function(obj, it) {
      
      if (U.isObj(it, String)) {
        
        var fName = it;
        it = function(o) { return o[fName](); };
        
      }
      
      for (var k in obj) it(obj[k], k, obj);
      
    },
    map: function(obj, it) {
      var ret = {};
      for (var k in obj) {
        var v = it(obj[k], k, obj);
        if (v !== U.SKIP) ret[k] = v;
      }
      return ret;
    },
    pick: function(obj, names) {
      var ret = {};
      for (var i = 0, len = names.length; i < len; i++) ret[names[i]] = obj[names[i]];
      return ret;
    },
    toArray: function(obj, it) {
      var ret = [];
        
      if (it)
        for (var k in obj) ret.push(it(obj[k], k, obj));
      else
        for (var k in obj) ret.push(obj[k]);
      
      return ret;
    },
    toss: function(obj, names) {
      var ret = {};
      for (var k in obj) ret[k] = obj[k];
      for (var i = 0, len = names.length; i < len; i++) delete ret[names[i]];
      return ret;
    },
    update: function(obj1 /* ... */) {
      for (var i = 1, len = arguments.length; i < len; i++) {
        var obj2 = arguments[i];
        for (var k in obj2) obj1[k] = obj2[k];
      }
      return obj1;
    },
    isEmpty: function(obj) {
      for (var k in obj) return false;
      return true;
    },
    prepare: function(obj, key) {
      if (!O.contains(obj, key)) obj[key] = {};
      return obj;
    }
  },
  arr: {
    is: function(v) { return U.isObj(v, Array); },
    clone: function(arr) {
      var ret = [];
      for (var i = 0; i < arr.length; i++) ret.push(arr[i]);
      return ret;
    },
    contains: function(arr, v) {
      return arr.indexOf(v) !== -1;
    },
    map: function(arr, it) {
      var ret = [];
      for (var i = 0, len = arr.length; i < len; i++) {
        var v = it(arr[i], i, arr);
        if (v !== U.SKIP) ret.push(v);
      }
      return ret;
    },
    each: function(arr, it) {
      
      if (U.isObj(it, String)) {
        var fName = it;
        it = function(o) { return o[fName](); };
      }
      
      for (var i = 0, len = arr.length; i < len; i++) it(arr[i], i, arr);
      
    },
    toObj: function(arr, itKey, itVal) {
      var ret = {};
        
      if (itKey && itVal)
        for (var i = 0, len = arr.length; i < len; i++) ret[itKey(arr[i], i)] = itVal(arr[i], i);
      else if (itKey)
        for (var i = 0, len = arr.length; i < len; i++) ret[itKey(arr[i], i)] = arr[i];
      else
        for (var i = 0, len = arr.length; i < len; i++) ret[i] = arr[i];
      
      return ret;
    },
    reverse: function(arr) {
      var ret = [];
      for (var i = arr.length - 1; i >= 0; i--) ret.push(arr[i]);
      return ret;
    },
    count: function(arr, func) {
      var ret = 0;
      for (var i = 0, len = arr.length; i < len; i++) ret += !!func(arr[i]);
      return ret;
    },
    seqIndexOf: function(arr, seq) {
      
      for (var i = 0, len = arr.length - seq.length; i <= len; i++) {
        var found = true;
        for (var j = 0, lenj = seq.length; j < lenj; j++) if (arr[i + j] !== seq[j]) { found = false; break; }
        if (found) return i;
      }
      
      return -1;
      
    }
  },
  str: {
    is: function(v) { return U.isObj(v, String); },
    contains: function(str, str2) {
      return str.indexOf(str2) !== -1;
    },
    startsWith: function(str, str2) {
      return str.substr(0, str2.length) === str2;
    },
    endsWith: function(str, str2) {
      return str.substr(str.length - str2.length, str2.length) === str2;
    },
    startPad: function(str, pad, len) {
      while (str.length < len) str = pad + str;
      return str;
    },
    endPad: function(str, pad, len) {
      while (str.length < len) str += pad;
      return str;
    }
  },
  
  // Class utility
  makeMixin: function(params /* namespace, name, description, methods */) {
    
    var namespace = U.param(params, 'namespace', global.C);
    if (U.isObj(namespace, String)) namespace = O.walk(global.C, namespace.split('.'));
    
    var name = U.param(params, 'name');
    if (O.contains(namespace, name)) throw new Error('Tried to overwrite mixin "' + name + '"');
    
    var description = U.param(params, 'description', null);
    
    var methods = U.param(params, 'methods');
    
    return {
      name: name,
      methods: methods
    };
    
  },
  makeClass: function(params /* namespace, name, description, superclass, mixins, resolvers, methods, statik */) {
    
    if (O.contains(params, 'superclassName')) throw new Error('Can\'t use "superclassName" anymore!');
    
    // `namespace` may either be an object or a string naming the namespace
    var namespace = U.param(params, 'namespace', global.C);
    if (U.isObj(namespace, String)) namespace = O.walk(global.C, namespace.split('.'));
    
    // Class `name` properties cannot clash within the namespace
    var name = U.param(params, 'name'); // TODO: this should be "title", not "name"
    if (O.contains(namespace, name)) throw new Error('tried to overwrite class "' + name + '"');
    
    // Get the superclass we're using to derive this one
    var superclass = U.param(params, 'superclass', Object);
    
    // Generate `heirName`
    var heirName = (superclass === Object) ? (Object.name + '.' + name) : (superclass.heirName + '.' + name);
    
    // Check for "description" property
    var description = U.param(params, 'description', heirName);
    
    /* NOTE: If uncommenting fix the broken uncomments - "* /" - in the class evals
    // Check for "includeGuid" property; if not found, copy value from superclass
    var includeGuid = U.param(params, 'includeGuid', (superclass === Object) ? false : (superclass.includeGuid));
    
    // Use eval to get a named constructor
    var cls = namespace[name] = includeGuid
      ? eval('(function ' + name + '(params) {\n/* ' + description + ' * /\nthis.guid=global.NEXT_ID++;this.init(params?params:{});})')
      : eval('(function ' + name + '(params) {\n/* ' + description + ' * /\nthis.init(params?params:{});})');
    
    */
    
    // TODO: Do we really need to track classes within namespaces??
    var cls = namespace[name] = eval('(function ' + name + '(params) {\n/* ' + description + ' */\nthis.init(params?params:{});})');
    
    // Inherit superclass methods
    if (superclass !== Object) { cls.prototype = Object.create(superclass.prototype); }
    
    // `statik` is an object naming class properties
    var whiteClassProps = [];
    var blackClassProps = [ 'title', 'heirName', 'par' ];
    var statik = U.param(params, 'statik', {});
    if (U.isObj(statik, Function)) statik = statik(cls);
    
    for (var i = 0; i < whiteClassProps.length; i++)
      if (!statik.hasOwnProperty(whiteClassProps[i])) throw new Error('Missing required statik property: "' + whiteClassProps[i] + '"');
    
    for (var i = 0; i < blackClassProps.length; i++)
      if (statik.hasOwnProperty(blackClassProps[i])) throw new Error('Provided reserved statik property: "' + blackClassProps[i] + '"');
    
    // Process all mixins
    var mixins = U.param(params, 'mixins', []);
    var resolvers = U.param(params, 'resolvers', {});
    if (U.isObj(resolvers, Function)) resolvers = resolvers(superclass ? superclass.prototype : null, cls);
    
    var conflictLists = {};
    var whitePrototypeProps = [];
    var blackPrototypeProps = [ 'constructor', 'as' ];
    for (var i = 0; i < mixins.length; i++) {
      
      var mixin = mixins[i];
      var props = mixin.methods;
      if (U.isObj(props, Function)) props = props(superclass ? superclass.prototype : null, cls);
      
      for (var k = 0; k < whitePrototypeProps.length; k++)
        if (!props.hasOwnProperty(whitePrototypeProps[k])) throw new Error('Missing required prototype property: "' + whitePrototypeProps[k] + '"');
      
      for (var k = 0; k < blackPrototypeProps.length; k++)
        if (props.hasOwnProperty(blackPrototypeProps[k])) throw new Error('Provided reserved prototype property: "' + blackPrototypeProps[k] + '"');
      
      for (var k in props) {
        
        if (!conflictLists[k] || !conflictLists.propertyIsEnumerable(k)) conflictLists[k] = [];
        
        conflictLists[k].push({
          name: mixin.name,
          prop: props[k],
          isSuperProp: false
        });
        
      }
      
    }
    
    // `methods` can be either an object or a function returning an object
    var methods = U.param(params, 'methods');
    var subMethods = methods(superclass ? superclass.prototype : null, cls);
    var supMethods = superclass ? superclass.prototype : {};
    
    // Consider all super methods, which aren't overriden in the subclass, for conflicts
    for (var k in supMethods) {
      
      if (O.contains(subMethods, k)) continue;
      if (!O.contains(conflictLists, k)) conflictLists[k] = [];
      
      conflictLists[k].push({
        name: superclass.title,
        prop: supMethods[k],
        isSuperProp: true
      });
      
    }
    
    // Consider all subclass methods for conflicts
    for (var k in subMethods) {
      
      if (!O.contains(conflictLists, k)) conflictLists[k] = [];
      
      conflictLists[k].push({
        name: name,
        prop: subMethods[k],
        isSuperProp: false
      });
      
    }
    
    // Check for conflicts between mixins, parent class, and current class; use resolvers appropriately
    for (var k in conflictLists) {
      
      var propList = conflictLists[k];
      if (propList.length > 1) {
        
        if (!resolvers[k]) throw new Error('Conflicting properties at ' + name + '.prototype.' + k + ' without resolver');
        cls.prototype[k] = (function(resolver, conflicts, n) {
          
          /*
          TODO: it's possible to have conflicts between Classlike objects with the same name...
          e.g. `PACK.niftyCss.Gear` and `PACK.intenseBackendMachinery.Gear` will overwrite each
          other at `conflicts.Gear`
          
          In such cases a list of same-named Classlike objects could be generated e.g.
          
          conflicts === {
            UniqueClass: function() { ... },
            AnotherUniqueClass: function() { ... },
            SeveralClassesWithTheSameName: [ function() { ... }, function() { ... } ]
          }
          
          In case of such lists the order will be:
          1) mixin methods in the order they're specified (with parent mixins taking precedence)
          2) super- or sub-class method
          */
          
          return function(/* ... */) {
            
            var args = [ conflicts ];
            args.push.apply(args, arguments);
            return resolver.apply(this, args);
            
          };
          
        })(resolvers[k], propList.toObj(function(v) { return v.name; }, function(v) { return v.prop; }));
        
      } else if (!propList[0].isSuperProp) { // Don't add super properties to the subclass; they'll naturally be inherited
        
        cls.prototype[k] = propList[0].prop;
        
      }
      
    }
    
    // Ensure that only subclasses are exempted from providing an "init" function
    if (superclass === Object && !cls.prototype.hasOwnProperty('init'))
      throw new Error('Missing `init` initializer for base-class "' + name + '"');
    
    // Ensure that `constructor` points to the class
    cls.prototype.constructor = cls;
    
    // Attach the `as` function to the root of the heirarchy
    if (superclass === Object) cls.prototype.as = function(/* ... */) {
      
      var args = U.toArray(arguments);
      
      var that = this;
      var funcName = args.shift();
      var func = this[funcName];
      if (!func) throw new Error('Invalid func name: "' + funcName + '"');
      return function() {
        return func.apply(that, args);
      };
      
      /*
      var args = U.toArray(arguments);
      var funcName = args[0];
      args[0] = this;
      if (!this[funcName]) throw new Error('Invalid `as`: "' + funcName + '"');
      var bind = this[funcName].bind;
      return bind.apply(bind, args); // `args` is the list of params to the bind: `this` followed by the actual params
      */
      
    };
    
    // Update statik properties
    cls.toString = function() { return heirName; };
    cls.title = name;
    cls.name = name;
    cls.heirName = heirName;
    cls.par = superclass;
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
    return string[0] === '!'
      ? JSON.parse(string.substr(1))
      : U.unstraighten(JSON.parse(string));
  },
  
  // Misc
  parseUrl: function(url, defaultProtocol) {
    
    if (url[0] === '/') url = url.substr(1);
    
    // Check if `url` includes a protocol
    var pInd = url.indexOf('://');
    if (~pInd) {
      var protocol = url.substr(0, pInd);
      url = url.substr(pInd + 3);
    } else {
      var protocol = defaultProtocol || 'http';
    }
    
    var queryUrl = url;
    var queryParams = {};
    
    // Check if the url includes parameters (indicated by the "?" symbol)
    var qInd = url.indexOf('?');
    if (~qInd) {
      
      // Strip the query off `queryUrl`
      queryUrl = url.substr(0, qInd);
      
      // Get array of "k=v"-style url parameters
      var queryArr = url.substr(qInd + 1).split('&');
      for (var i = 0; i < queryArr.length; i++) {
        var str = queryArr[i];
        var eq = str.indexOf('=');
        if (~eq)  queryParams[str.substr(0, eq)] = decodeURIComponent(str.substr(eq + 1));
        else      queryParams[str] = null;
      }
      
      // Handle the special "_data" parameter
      if (O.contains(queryParams, '_data')) {
        // The "_data" property overwrites any properties in the query of the same name
        try {
          var obj = U.stringToThing(queryParams._data);
        } catch(err) {
          return new P({ err: err });
        }
        if (!U.isObj(obj, Object)) throw new Error('Invalid "_data" parameter: "' + obj + '"');
        
        delete queryParams._data;
        queryParams.update(obj);
      }
    }
    
    // Ensure that "queryUrl" is represented as an `Array`
    if (queryUrl[queryUrl.length - 1] === '/') queryUrl = queryUrl.substr(0, queryUrl.length - 1);
    queryUrl = queryUrl ? queryUrl.split('/') : [];
    
    return {
      protocol: protocol,
      url: queryUrl,
      params: queryParams
    };
    
  },
  timeMs: function() {
    return +new Date();
  },
  toArray: function(arrayLike, v) {
    /*
    Useful method for constructing `Array`s from a variety of inputs:
    
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
      var k = null;
      for (k in rng) break;
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
  randId: function() {
    return U.id(parseInt(Math.random() * 16 * 16 * 16 * 16 * 16, 10));
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
  debugObj: function(val) {
    
    var mem = [];
    return JSON.stringify(val, function(k, v) {
      
      if (!U.isJson(v)) v = U.typeOf(v) + ': ' + v;
      if (~mem.indexOf(v)) return '-- circular --';
      if (!U.isPrimitive(v)) mem.push(v);
      return v;
      
    }, 2);
    
  },
  debug: function(/* ... */) {
    console.log('----------------------');
    
    if (arguments.length === 2) {
      var title = arguments[0];
      var val = arguments[1];
    } else {
      var title = null;
      var val = arguments[0];
    }
    
    if (title) console.log('::::' + title + '::::');
    
    console.log(U.debugObj(val) + '\n');
    
  }
  
};

U.runId = U.randId();
console.log('====== NEW RUN: ' + U.runId + ' ======');

// Shorthand access to value manipulation
global.A = U.arr;
global.O = U.obj;
global.S = U.str;

// PACKAGE: Packaging
global.PACK.pack = {
  compiler: null,
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
        if (O.contains(this.dependencySet, script.src)) throw new Error('double-loaded dependency "' + script.src + '"');
        this.dependencySet[script.src] = 'loaded';
        
        this.receivedDeps++;
        if (this.receivedDeps === this.neededDeps) {
          // Clean up the ugly properties that were attached to the dom
          delete script['~waiting'][this.name];
          if (U.isEmptyObj(script['~waiting'])) delete script['~waiting'];
          
          this.endBuild();
        }
      },
      endBuild: function() {
        /*
        Regardless of whether we're on the server or client side,
        this is the function that should run once all dependencies
        are loaded.
        */
        if (O.contains(PACK, this.name)) throw new Error('double-loaded dependency "' + this.name + '"');
        
        var args = this.dependencies.map(function(n) { return O.walk(PACK, n.split('.')); });
        PACK[this.name] = {};
        this.buildFunc.apply(null, [ PACK[this.name] ].concat(args));
        
        if (!U.isServer()) {
          var waiting = this.script['~waiting'];
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
        
        if (U.isServer()) { // TODO: This method should never be used!!
          
          missingDeps.forEach(function(dependencyName) {
            
            // Possible that one of this package's dependencies
            // is also a dependency of a subpackage. In this case
            // the subpackage has already loaded the dependency.
            if (O.contains(PACK, dependencyName)) return;
            
            // This require statement needs to add the dependencyName key to PACK
            if (PACK.pack.compiler) PACK.pack.compiler.run(dependencyName, 'server');
            else                    require('./apps/' + dependencyName + '/' + dependencyName + '.js');
            
            // Ensure the key was added
            if (!O.contains(PACK, dependencyName)) throw new Error('failed to load dependency "' + dependencyName + '"');
            
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
            if (S.contains(ver, '?')) ver = '?' + ver.split('?')[1];
            else                      ver = '';
            
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
            if (!('~waiting' in script)) script['~waiting'] = {};
            script['~waiting'][this.name] = this;
          }
          
        }
      },
    };}
  })
};
