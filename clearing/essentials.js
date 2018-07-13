// TODO: Could consider using `Object.defineProperty` to make some
// control properties non-enumerable (e.g. `wobblyInstance.numUsages`)

Error.stackTraceLimit = Infinity;

// Method schemas
const makeClassSchema = {
  type: 'obj',
  required: {
    name: { type: 'cls', cls: String },
    inspiration: { type: 'cls', cls: Object },
    methods: null
  },
  optional: {
    description: { type: 'cls', cls: String },
    statik: { type: 'cls', cls: Object }
  }
};

// Methods for quick reference
const hasOwnProperty = Object.prototype.hasOwnProperty;

// Globals
global.TWIGS = {};
global.U = {
  
  // Constants
  SKIP: { SKIP: 'SKIP' },
  
  // Value handling
  isUndefined: val => typeof val === 'undefined',
  isNull: val => val === null,
  isExistent: val => (typeof val !== 'undefined') && (val !== null),
  isType: (val, cls) => {
    try { return val.constructor === cls; } catch (err) {}
    return false;
  },
  isInstance: function(obj, cls) {
    try { return obj instanceof cls; } catch(err) {}
    return false;
  },
  isInspiredBy: function(obj, insp) {
    
    if (obj.constructor) obj = obj.constructor;
    if (obj === insp) return true;
    
    let insps = O.has(obj, 'inspirations') ? obj.inspirations : {};
    for (var k in insps) if (U.isInspiredBy(insps[k], insp)) return true;
    
    return false;
    
  },
  typeOf: function(obj) {
    
    if (U.isNull(obj)) return '<NULL>';
    if (U.isUndefined(obj)) return '<UNDEFINED>';
    
    try { return `<${obj.constructor.name}>`; } catch (e) {}
    
    return '<UNKNOWN>';
    
  },
  
  // Util
  id: (n, len=8) => {
    let hex = n.toString(16);
    return S.startPad(hex, '0', len);
  },
  charId: function(n, len=8) {
    
    /*
    Returns an id comprised entirely of characters starting from lowercase "a".
    There will be no integer characters. For values of "n" greater than 26
    there will be funky non-alpha characters.
    */
    let hex = U.id(n, len);
    let letters = '';
    
    for (let i = 0; i < hex.length; i++) {
      let c = hex[i];
      letters += String.fromCharCode((c >= '0' && c <= '9') ? ('a'.charCodeAt(0) + parseInt(c)) : (c.charCodeAt(0) + 10))
    }
    
    return letters;
    
  },
  output: (...args) => console.log(...args),
  debugObj: val => {
    
    let mem = [];
    return JSON.stringify(val, (k, v) => {
      
      let Cls = null;
      try { Cls = v.constructor; } catch(err) {}
      
      if (!A.has([ Object, Array, String, Number, Boolean, null ], Cls)) v = U.typeOf(v) + ': ' + v;
      if (~mem.indexOf(v)) return '-- circular --';
      if (!A.has([ String, Number, Boolean, null ], Cls)) mem.push(v);
      return v;
      
    }, 2);
    
  },
  timeMs: () => +new Date(),
  
  // Serialization
  straighten: item => {
    
    let arr = [];
    U.straighten0(item, arr);
    return A.map(arr, item => item.calc);
    
  },
  straighten0: (item, items) => {
    
    // This is O(n^2) :(
    for (let i = 0, len = items.length; i < len; i++) if (items[i].orig === item) return i;
    
    let ind = items.length;
    
    if (U.isType(item, Object)) {
      
      let obj = {};
      items.push({ orig: item, calc: obj });
      for (let k in item) obj[k] = U.straighten0(item[k], items);
        
    } else if (U.isType(item, Array)) {
      
      let arr = [];
      items.push({ orig: item, calc: arr });
      for (let i = 0; i < item.length; i++) arr.push(U.straighten0(item[i], items));
      
    } else if (item === null || U.isType(item, String) || U.isType(item, Number) || U.isType(item, Boolean)) {
      
      items.push({ orig: item, calc: item });
      
    }
    
    return ind;
    
  },
  
  unstraighten: items => {
    
    let unbuilt = { UNBUILT: true };
    let builtItems = [];
    for (let i = 0, len = items.length; i < len; i++) builtItems.push(unbuilt);
    return U.unstraighten0(items, 0, builtItems, unbuilt, 0);
    
  },
  unstraighten0: (items, ind, builtItems, unbuilt) => {
    
    if (builtItems[ind] !== unbuilt) return builtItems[ind];
    
    let item = items[ind];
    let value = null;
    
    if (U.isType(item, Object)) {
      
      let obj = builtItems[ind] = {};
      for (let k in item) obj[k] = U.unstraighten0(items, item[k], builtItems, unbuilt);
      return obj;
      
    } else if (U.isType(item, Array)) {
      
      let arr = builtItems[ind] = [];
      for (let i = 0, len = item.length; i < len; i++) arr.push(U.unstraighten0(items, item[i], builtItems, unbuilt));
      return arr;
      
    }
    
    builtItems[ind] = item;
    return item;
    
  },
  thingToString: thing => JSON.stringify(U.straighten(thing)),
  stringToThing: string => string[0] === '!' ? JSON.parse(string.substr(1)) : U.unstraighten(JSON.parse(string)),
  
  // Params
  pval: (val, schema=null, path=[], err=new Error()) => {
    
    if (schema === null) return;
    
    if (!U.isType(schema, Object)) { err.message = 'Schema must be Object (' + path.join('.') + ')'; throw err; }
    if (!O.has(schema,  'type')) { err.message = 'Schema must contain "type" (' + path.join('.') + ')'; throw err; }
    
    if (schema.type === 'obj') {
      
      if (!U.isType(val, Object)) { err.message = 'Schema requires Object (' + path.join('.') + ')'; throw err; }
      
      let required = O.has(schema, 'required') ? schema.required : [];
      let optional = O.has(schema, 'optional') ? schema.optional : [];
      
      for (let k in val) if (!O.has(required, k) && !O.has(optional, k)) { err.message = 'Invalid object key: "' + k + '" (' + path.join('.') + ')'; throw err; }
      
      let ret = {};
      for (let k in required) {
        if (!O.has(val, k)) { err.message = 'Missing required key: "' + k + '" (' + path.join('.') + ')'; throw err; }
        ret[k] = U.pval(val[k], required[k], path.concat([ k ]), err);
      }
      for (let k in optional) {
        // `val[k]` may resolve to `undefined`
        if (k in val) {
          ret[k] = U.pval(val[k], optional[k], path.concat([ k ]), err);
        } else {
          try {
            ret[k] = U.pval(val[k], optional[k], path.concat([ k ]), err);
          } catch (err) {
          }
        }
      }
      
      return ret;
      
    } else if (schema.type === 'arr') {
      
      if (!U.isType(val, Array)) { err.message = 'Schema requires Array (' + path.join('.') + ')'; throw err; }
      
      let ret = [];
      if (O.has(schema, 'schema'))
        for (let i = 0, len = val.length; i < len; i++) ret.push(U.pval(val[i], schema.schema, path.concat([ i ]), err));
      else
        ret = val;
      
      return ret;
      
    } else if (schema.type === 'cls') {
      
      if (!schema.cls) { err.message = 'Schema missing "cls" key (' + path.join('.') + ')'; throw err; }
      
      if (!U.isType(val, schema.cls)) { err.message = 'Schema requires ' + schema.cls.name + ' (' + path.join('.') + ')'; throw err; }
      
      return val;
      
    } else if (schema.type === 'def') {
      
      if (!schema.value) { err.message = 'Schema missing "value" key (' + path.join('.') + ')'; throw err; }
      
      let ret = val;
      let needsDefault = U.isNull(ret) || U.isUndefined(ret);
      
      if (needsDefault) ret = schema.value;
      
      if (schema.schema) ret = U.pval(ret, schema.schema, needsDefault ? path.concat([ '<default>' ]) : path, err);
      
      return ret;
      
    }
    
    throw new Error(`Unexpected schema type: "${schema.type}"`);
    
  },
  
  // Class utility
  makeClass: ({ name, inspiration={}, methods, statik={}, description='' }) => {
    
    let params = U.pval({ name, inspiration, methods, statik, description }, makeClassSchema);
    
    let Cls = function(p={}) {
      if (!this || this.constructor !== Cls) return new Cls(p);
      this.init(p);
    };
    Object.defineProperty(Cls, 'name', { value: name });
    
    Cls.inspirations = O.map(inspiration, insp => insp.prototype ? insp : U.SKIP);
    Cls.prototype = Object.create(null);
    
    // Ensure that all `inspiration` items are Objects full of methods
    inspiration = O.map(inspiration, insp => insp.prototype ? insp.prototype : insp);
    
    // Run `methods` if necessary. Ensure it always resolve to an `Object`
    if (U.isType(methods, Function)) methods = methods(inspiration, Cls);
    if (!U.isType(methods, Object)) throw new Error('Didn\'t resolve "methods" to Object');
    
    if (O.has(methods, 'constructor')) throw new Error('Invalid "constructor" key');
    
    let methodsByName = {};
    O.each(inspiration, (insp, inspName) => {
      
      O.each(insp, (method, methodName) => {
        
        // `insp` is likely a prototype, in which case it will contain a
        // "constructor" property which doesn't interest us
        if (methodName === 'constructor') return;
        
        if (!O.has(methodsByName, methodName)) methodsByName[methodName] = [];
        methodsByName[methodName].push(method);
        
      });
      
    });
    
    O.include(methodsByName, O.map(methods, m => [ m ]));
    if (!methodsByName.init) throw new Error('No "init" method available');
    
    for (let methodName in methodsByName) {
      
      let methodsAtName = methodsByName[methodName];
      if (methodsAtName.length > 1) throw new Error('Conflicting method names at "' + methodName + '"; need resolver');
      Cls.prototype[methodName] = methodsAtName[0];
      
    }
    
    Cls.prototype.constructor = Cls;
    
    return Cls;
    
  }, 
  
};
global.O = {
  
  is: v => U.isType(v, Object),
  clone: obj => {
    let ret = {};
    for (let k in obj) ret[k] = obj[k];
    return ret;
  },
  has: (obj, k) => hasOwnProperty.call(obj, k),
  map: (obj, it) => {
    
    let ret = {};
    for (let k in obj) {
      let v = it(obj[k], k);
      if (v !== U.SKIP) ret[k] = v;
    }
    return ret;
    
  },
  each: (obj, it) => { for (let k in obj) it(obj[k], k); },
  toArr: (obj, it=null) => {
    
    let ret = [];
    for (let k in obj) {
      let val = it ? it(obj[k], k) : obj[k];
      if (val !== U.SKIP) ret.push(val);
    }
    return ret;
    
  },
  walk: (obj, ...keys) => {
    for (let i = 0, len = keys.length; i < len; i++) {
      let k = keys[i];
      if (!obj.hasOwnProperty(k)) return null;
      obj = obj[k];
    }
    return obj;
  },
  include: (obj, ...objs) => {
    
    for (let i = 0, len = objs.length; i < len; i++) {
      let obj2 = objs[i];
      for (let k in obj2) obj[k] = obj2[k];
    }
    return obj;
    
  },
  isEmpty: obj => {
    for (let k in obj) return false;
    return true;
  },
  firstVal: obj => {
    for (let k in obj) return obj[k];
    return null;
  },
  firstKey: obj => {
    for (let k in obj) return k;
    return null;
  }
  
};
global.A = {
  
  is: v => U.isType(v, Array),
  clone: arr => [].concat(arr),
  has: (arr, v) => arr.indexOf(v) !== -1,
  map: (arr, it) => {
    
    let ret = [];
    for (let i = 0, len = arr.length; i < len; i++) {
      let v = it(arr[i], i);
      if (v !== U.SKIP) ret.push(v);
    }
    return ret;
    
  },
  each: (arr, it) => { for (let i = 0, len = arr.length; i < len; i++) it(arr[i], i); },
  toObj: (arr, itKey=null, itVal=null) => {
    let ret = {};
    for (let i = 0, len = arr.length; i < len; i++) {
      let k = itKey ? itKey(arr[i], i) : i;
      let v = itVal ? itVal(arr[i], i) : arr[i];
      if (k !== U.SKIP && v !== U.SKIP) ret[k] = v;
    }
    return ret;
  },
  reverse: arr => {
    let ret = [];
    for (let i = arr.length - 1; i >= 0; i--) ret.push(arr[i]);
    return ret;
  },
  join: (arr, delim) => arr.join(delim),
  include: (...arrs) => arrs[0].concat(...arrs.slice(1)),
  any: (arr, it) => { 
    for (var i = 0, len = arr.length; i < len; i++) if (it(arr[i], i)) return true;
    return false;
  },
  all: (arr, it) => { 
    for (var i = 0, len = arr.length; i < len; i++) if (!it(arr[i], i)) return false;
    return true;
  }
  
};
global.S = {
  
  is: v => U.isType(v, String),
  has: (str, substr) => str.indexOf(substr) !== -1,
  startsWith: (str, prefix) => prefix === str.substr(0, prefix.length),
  endsWith: (str, suffix) => suffix === str.substr(str.length - suffix.length, suffix.length),
  startPad: (str, pad, len) => { while (str.length < len) str = pad + str; return str; },
  endPad: (str, pad, len) => { while (str.length < len) str = str + pad; return str; },
  indent: (str, pad) => { return A.map(str.split('\n'), pc => pad + pc).join('\n'); },
  indexOf: (str, substr) => str.indexOf(substr),
  split: (str, delim) => str.split(delim)
  
};

// Provides a stable start/stop paradigm
const Temporary = U.makeClass({ name: 'Temporary', methods: (insp, Cls) => ({
  
  init: function() {
    
    this.tmpActions = null;
    
  },
  getTmpActions: function() { throw new Error('not implemented'); },
  isDn: function() { return !this.tmpActions; },
  isUp: function() { return !!this.tmpActions; },
  up: function() {
    
    if (this.isUp()) throw new Error('Tried to double-up');
    
    let actions = this.getTmpActions();
    
    for (let i = 0, len = actions.length; i < len; i++) {
      
      try {
        
        actions[i].up.call(this);
        
      } catch(err) {
        
        for (let j = i - 1; j >= 0; j--) actions[i].dn.call(this);
        err.message = 'Couldn\'t go up: ' + err.message;
        throw err;
        
      }
      
    }
    
    this.tmpActions = actions;
    
  },
  dn: function() {
    
    if (this.isDn()) throw new Error('Tried to double-db');
    
    let actions = this.tmpActions;
    
    for (let i = actions.length - 1; i >= 0; i--) {
      
      try {
        
        actions[i].dn(this);
        
      } catch(err) {
        
        for (let j = i + 1, len = actions.length; j < len; j++) actions[i].up.call(this);
        err.message = 'Couldn\'t go dn: ' + err.message;
        throw err;
        
      }
      
    }
    
    this.tmpActions = null;
    
  }
  
})});

// Provides some useful management for tree-like data
const TreeNode = U.makeClass({ name: 'TreeNode', methods: (insp, Cls) => ({
  
  init: function({ name, par=null }) {
    
    if (!name) throw new Error('Missing "name" param');
    if (S.has(name, '.')) throw new Error('Illegal character in "name" param: "."');
    
    this.name = name;
    this.par = par;
    
  },
  getAncestry: function() {
    
    let ret = [];
    let ptr = this;
    while (ptr) { ret.push(ptr); ptr = ptr.par; }
    return ret;
    
  },
  ancestryContains: function(trg) {
    
    let ptr = this;
    while (ptr) { if (ptr === trg) return true; ptr = ptr.trg; }
    return false;
    
  },
  getAncestryDepth: function() {
    
    let cnt = 0;
    let ptr = this.par;
    while (ptr) { cnt++; ptr = ptr.par; }
    return cnt;
    
  },
  getAddress: function(type='arr') {
    
    let ancestry = this.getAncestry();
    let address = [];
    for (let i = ancestry.length - 2; i >= 0; i--) address.push(ancestry[i].name.toString());
    
    return (type === 'str') ? address.join('.') : address;
    
  },
  getRoot: function() {
    
    let ptr = this;
    while (ptr.par) ptr = ptr.par;
    return ptr;
    
  },
  getChild: function(addr) {
    
    if (addr.length === 0) return this; // Works for strings, arrays and numeric (e.g. `(5).length === undefined !== null`)
    
    if (U.isType(addr, String)) addr = addr ? addr.split('.') : [];
    else if (!U.isType(addr, Array)) addr = [ addr ];
    
    let ptr = this;
    for (let i = 0, len = addr.length; (i < len) && ptr; i++) ptr = ptr.getNamedChild(addr[i].toString());
    
    return ptr;
    
  },
  getNamedChild: function(name) { throw new Error('not implemented'); },
  describe: function() {
    return this.constructor.name + '(' + this.getAddress('str') + ')';
  }
  
})});

// Provides event-based access to changing data
U.WOBBLY_ID = 0;
const Wobbly = U.makeClass({ name: 'Wobbly', inspiration: { Temporary }, methods: (insp, Cls) => ({
  
  init: function() {
    
    insp.Temporary.init.call(this);
    
    this.holders = {};
    this.nextId = 0;
    this.holdKey = '~wbl.' + U.WOBBLY_ID++;
    this.numUsages = 0;
    
  },
  getTmpActions: function() {
    
    return [
      {
        up: function() {},
        dn: function() {
          O.each(this.holders, c => { delete c[this.holdKey]; });
          this.holders = {};
          this.nextId = 0;
        }
      }
    ];
    
  },
  hold: function(func, key=null) {
    
    if (key === null) {
      key = this.nextId++;
      func[this.holdKey] = key;
    }
    
    this.holders[key] = func;
    
    this.numUsages++;
    if (this.isDn()) this.up();
    
  },
  drop: function(key) {
    
    if (this.numUsages <= 0) throw new Error('Negative numUsages');
    
    let func = null;
    
    if (U.isType(key, Function)) {
      func = key;
      if (!O.has(func, this.holdKey)) throw new Error('Missing holdKey');
      key = func[this.holdKey];
    }
    
    if (!O.has(this.holders, key)) throw new Error('Holder doesn\'t exist');
    
    delete this.holders[key];
    if (func) delete func[this.holdKey];
    
    this.numUsages--;
    if (!this.numUsages) this.dn();
    
  },
  setValue: function(val) { throw new Error('not implemented'); },
  getValue: function() { throw new Error('not implemented'); },
  modValue: function(f) { this.setValue(f(this.getValue())); },
  wobble: function(delta=null) {
    
    O.each(this.holders, c => c(delta, this.getValue()));
    
  }
  
})});
const WobblyValue = U.makeClass({ name: 'WobblyValue', inspiration: { Wobbly }, methods: (insp, Cls) => ({
  
  init: function(params /* value */) {
    
    insp.Wobbly.init.call(this, params);
    this.value = O.has(params, 'value') ? params.value : null;
    
  },
  setValue: function(value) {
    this.value = value;
    this.wobble(value);
  },
  getValue: function() {
    return this.value;
  }
  
})});
const WobblyResult = U.makeClass({ name: 'WobblyResult', inspiration: { Wobbly }, methods: (insp, Cls) => ({
  
  init: function(params /* wobblies, calc */) {
    
    insp.Wobbly.init.call(this, params);
    
    if (!O.has(params, 'wobblies')) throw new Error('Missing "wobblies" param');
    if (!O.has(params, 'calc')) throw new Error('Missing "calc" param');
    
    this.wobblies = params.wobblies;
    this.calc = params.calc;
    this.value = this.calcValue();
    
  },
  calcValue: function() {
    
    return this.calc(...A.map(this.wobblies, w => w.getValue()));
    
  },
  getTmpActions: function() {
    
    return insp.Wobbly.getTmpActions.call(this).concat([
      {
        up: function() {
          
          let func = () => { this.value = this.calcValue(); this.wobble(this.value); };
          A.each(this.wobblies, w => w.hold(func, this.holdKey));
          
        },
        dn: function() {
          
          A.each(this.wobblies, w => w.drop(this.holdKey));
          
        }
      }
    ]);
    
  },
  
  getValue: function() { return this.value; },
  setValue: function(val) { throw new Error('Can\'t set values on Class "' + this.constructor.name + '"'); }
  
})});

O.include(U, { Temporary, TreeNode, Wobbly, WobblyValue, WobblyResult });
