'use strict';

// Normalization: stack trace limit, capture object prototype
Error.stackTraceLimit = Infinity;
let names = Object.getOwnPropertyNames(Object.prototype);
const OBJECT_PROTO = {};
for (let i = 0; i < names.length; i++) { OBJECT_PROTO[names[i]] = Object.prototype[names[i]]; }
OBJECT_PROTO.constructor = Object.prototype.constructor;

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
    try {
      
      // Need a special check for `Object` since we've destroyed its prototype
      if (cls === Object && !val.constructor && val instanceof Object) return true;
      
      return val.constructor === cls;
      
    } catch (err) {}
    return false;
  },
  isInstance: function(obj, cls) {
    try { return obj instanceof cls; } catch(err) {}
    return false;
  },
  isInspiredBy: function(obj, insp) {
    
    if (obj.constructor) obj = obj.constructor;
    if (!obj.inspirations) throw new Error('Object in question isn\'t inspired');
    
    for (var k in obj.inspirations) if (insp === obj.inspirations[k]) return true;
    for (var k in obj.inspirations) if (U.isInspiredBy(obj.inspirations[k], insp)) return true;
    
    return false;
    
  },
  typeOf: function(obj) {
    
    if (U.isNull(obj)) return '<NULL>';
    if (U.isUndefined(obj)) return '<UNDEFINED>';
    
    try { return '<{' + v.constructor.name + '}>'; } catch (e) {}
    
    return '<UNKNOWN>';
    
  },
  
  addProto: () => {
    for (let k in OBJECT_PROTO) Object.prototype[k] = OBJECT_PROTO[k];
  },
  remProto: () => {
    for (let k in OBJECT_PROTO) delete Object.prototype[k];
  },
  withProto: f => {
    
    // TODO: Right now large blocks of code will potentially be executed with
    // `U.withProto(() => require(/* ... */))` since the entire required file
    // will be run with a prototype in place.
    
    // If we can find `Object.prototype.constructor`, there's already a prototype in place
    if (Object.prototype.constructor) return f();
    
    U.addProto();
    let ret = f();
    U.remProto();
    
    return ret;
    
  },
  
  // Util
  id: (n, len=8) => {
    let hex = n.toString(16);
    while (hex.length < len) hex = '0' + hex;
    return hex;
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
      letters += (c >= '0' && c <= '9') 
        ? String.fromCharCode('a'.charCodeAt(0) + parseInt(c))
        : String.fromCharCode(c.charCodeAt(0) + 10);
    }
    
    return letters;
  },
  output: (...args) => {
    U.withProto(() => console.log(...args));
  },
  debugObj: val => {
    
    let mem = [];
    return JSON.stringify(val, (k, v) => {
      
      if (!U.isJson(v)) v = U.typeOf(v) + ': ' + v;
      if (~mem.indexOf(v)) return '-- circular --';
      if (!U.isPrimitive(v)) mem.push(v);
      return v;
      
    }, 2);
    
  },
  
  // Params
  pval: (val, schema=null, path=[], err=new Error()) => {
    
    if (schema === null) return;
    
    if (!U.isType(schema, Object)) { err.message = 'Schema must be Object (' + path.join('.') + ')'; throw err; }
    if (!schema.type) { err.message = 'Schema must contain "type" (' + path.join('.') + ')'; throw err; }
    
    if (schema.type === 'obj') {
      
      if (!U.isType(val, Object)) { err.message = 'Schema requires Object (' + path.join('.') + ')'; throw err; }
      
      let required = schema.required || [];
      let optional = schema.optional || [];
      
      for (let k in val) if (!(k in required) && !(k in optional)) { err.message = 'Invalid object key: "' + k + '" (' + path.join('.') + ')'; throw err; }
      
      let ret = {};
      for (let k in required) {
        if (!(k in val)) { err.message = 'Missing required key: "' + k + '" (' + path.join('.') + ')'; throw err; }
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
      if (schema.schema)
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
  makeClass: ({ name, inspiration={ Object }, methods, statik={}, description='' }) => {
    
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
    
    if (methods.constructor) throw new Error('Invalid "constructor" key');
    
    let methodsByName = {};
    O.each(inspiration, (insp, inspName) => {
      
      O.each(insp, (method, methodName) => {
        
        if (methodName === 'constructor') return;
        
        if (!methodsByName[methodName]) methodsByName[methodName] = [];
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
  has: (obj, k) => OBJECT_PROTO.hasOwnProperty.call(obj, k),
  walk: (obj, ...keys) => {
    for (let i = 0, len = keys.length; i < len; i++) {
      let k = keys[i];
      if (!obj.hasOwnProperty(k)) return null;
      obj = obj[k];
    }
    return obj;
  },
  each: (obj, it) => { for (let k in obj) it(obj[k], k); },
  map: (obj, it) => {
    let ret = {};
    for (let k in obj) {
      let v = it(obj[k], k);
      if (v !== U.SKIP) ret[k] = v;
    }
    return ret;
  },
  toArr: (obj, it=null) => {
    let ret = [];
    for (let k in obj) {
      let val = it ? it(obj[k], k) : obj[k];
      if (val !== U.SKIP) ret.push(val);
    }
    return ret;
  },
  include: (obj, ...objs) => {
    for (let i = 0, len = objs.length; i < len; i++) {
      let obj2 = objs[i];
      for (let k in obj2) obj[k] = obj2[k];
    }
    return obj;
  },
  isEmpty: obj => { for (let k in obj) return false; return true; }
  
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
  }
  
};
global.S = {
  
  is: v => U.isType(v, String),
  has: (str, substr) => str.indexOf(substr) !== -1,
  startsWith: (str, prefix) => prefix === str.substr(0, prefix.length),
  endsWith: (str, suffix) => suffix === str.substr(str.length - suffix.length, suffix.length),
  startPad: (str, pad, len) => { while (str.length < len) str = pad + str; return str; },
  endPad: (str, pad, len) => { while (str.length < len) str = str + pad; return str; },
  indent: (str, pad) => {
    return A.map(str.split('\n'), pc => pad + pc).join('\n');
  }
  
};

U.remProto();

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
    
    let actions = this.tmpActions = this.getTmpActions();
    for (let i = 0, len = actions.length; i < len; i++) actions[i].up.call(this);
    
  },
  dn: function() {
    
    if (this.isDn()) throw new Error('Tried to double-db');
    
    let actions = this.tmpActions;
    for (let i = actions.length - 1; i >= 0; i--) actions[i].dn(this);
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
  getNodeChain: function() {
    
    let ret = [];
    let ptr = this;
    while(ptr !== null) { ret.push(ptr); ptr = ptr.par; }
    return ret;
    
  },
  getAddress: function(type='arr') {
    
    let nodeChain = this.getNodeChain();
    let chain = [];
    for (let i = chain.length - 1; i >= 0; i--) chain.push(chain[i].name.toString());
    
    return (type === 'str') ? chain.join('.') : chain;
    
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
  getNamedChild: function(name) { throw new Error('not implemented'); }
  
})});

// Provides event-based access to changing data
U.WOBBLY_ID = 0;
const Wobbly = U.makeClass({ name: 'Wobbly', inspiration: { Temporary }, methods: (insp, Cls) => ({
  
  init: function() {
    
    insp.Temporary.init.call(this);
    
    this.concerns = {};
    this.nextId = 0;
    this.concernKey = '~wbl.' + U.WOBBLY_ID++;
    this.usages = 0;
    
  },
  
  getTmpActions: function() {
    return [
      {
        up: function() {},
        dn: function() {
          O.each(this.concerns, c => { delete c[this.concernKey]; });
          this.concerns = {};
          this.nextId = 0;
        }
      }
    ];
  },
  
  addConcern: function(func, key=null) {
    
    if (key === null) {
      key = this.nextId++;
      func[this.concernKey] = key;
    }
    
    this.concerns[key] = func;
    
    this.usages++;
    if (this.isDn()) this.up();
    
  },
  remConcern: function(key) {
    
    if (this.usages <= 0) throw new Error('Negative usages');
    
    let func = null;
    
    if (U.isType(key, Function)) {
      func = key;
      if (!O.has(func, this.concernKey)) throw new Error('Missing concernKey');
      key = func[this.concernKey];
    }
    
    if (!this.concerns[key]) throw new Error('Concern doesn\'t exist');
    
    delete this.concerns[key];
    if (func) delete func[this.concernKey];
    
    this.usages--;
    if (!this.usages) this.dn();
    
  },
  
  setValue: function(val) { throw new Error('not implemented'); },
  getValue: function() { throw new Error('not implemented'); },
  modValue: function(f) {
    this.setValue(f(this.getValue()));
  },
  
  wobble: function(delta=null) {
    
    let val = this.getValue();
    O.each(this.concerns, c => c(val, delta));
    
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
    
    if (!params.wobblies) throw new Error('Missing "wobblies" param');
    if (!params.calc) throw new Error('Missing "calc" param');
    
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
          A.each(this.wobblies, w => w.addConcern(func, this.concernKey));
          
        },
        dn: function() {
          
          A.each(this.wobblies, w => w.remConcern(this.concernKey));
          
        }
      }
    ]);
    
  },
  
  getValue: function() { return this.value; },
  setValue: function(val) { throw new Error('Can\'t set values on Class "' + this.constructor.name + '"'); }
  
})});

O.include(U, { Temporary, TreeNode, Wobbly, WobblyValue, WobblyResult });
