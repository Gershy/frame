// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

let C = global.C = {
  skip: { SKIP: 1 },
  BaseInsp: (() => {
    let BaseInsp = function BaseInsp() {};
    BaseInsp.prototype = Object.create(null);
    BaseInsp.prototype.isInspiredBy = function(Insp0) { return this.constructor.insps.has(Insp0.uid); };
    return BaseInsp;
  })(),
  notImplemented: function() { throw new Error(`Not implemented by ${this.constructor.name}`); }
};

let protoDef = (Cls, name, value) => Object.defineProperty(Cls.prototype, name, { value, enumerable: false });

protoDef(Object, 'forEach', function(fn) { for (let k in this) fn(this[k], k); });
protoDef(Object, 'map', function(fn) {
  let ret = {};
  for (let k in this) { let v = fn(this[k], k); if (v !== C.skip) ret[k] = v; }
  return ret;
});
protoDef(Object, 'toArr', function(it) {
  let ret = [];
  for (let k in this) { let v = it(this[k], k); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(Object, 'slice', function(...props) {
  if (props.length === 1 && U.isType(props[0], Object)) {
    let map = props[0];
    for (let k in map) map[k] = this[map[k]];
    return map;
  } else {
    let ret = {};
    props.forEach(p => { ret[p] = this[p]; });
    return ret;
  }
});
protoDef(Object, 'find', function(f) {
  for (let k in this) if (f(this[k], k)) return [ this[k], k ];
  return null;
});
protoDef(Object, 'has', Object.prototype.hasOwnProperty);
protoDef(Object, 'isEmpty', function() { for (let k in this) return false; return true; });
protoDef(Object, 'gain', function(obj) {
  for (let k in obj) {
    let v = obj[k];
    if (v !== C.skip) { this[k] = v; } else { delete this[k]; }
  }
  return this;
});
protoDef(Object, 'to', function(f) { return f(this); });

Array.fill = (n, f=()=>null) => {
  let a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = f(i);
  return a;
};
Array.combine = (...arrs) => {
  let len = 0;
  for (let i = 0; i < arrs.length; i++) len += arrs[i].length;
  
  let ret = new Array(len);
  let ind = 0;
  for (let i = 0; i < arrs.length; i++) { let arr = arrs[i]; for (let j = 0; j < arr.length; j++) {
    ret[ind++] = arr[j];
  }}
  
  return ret;
};
protoDef(Array, 'map', function(it) {
  let ret = [];
  for (let i = 0, len = this.length; i < len; i++) {
    let v = it(this[i], i);
    if (v !== C.skip) ret.push(v);
  }
  return ret;
});
protoDef(Array, 'toObj', function(it) {
  let ret = {};
  for (let i = 0, len = this.length; i < len; i++) {
    let v = it(this[i], i);
    if (v === C.skip) continue;
    ret[v[0]] = v[1];
  }
  return ret;
});
protoDef(Array, 'find', function(f) {
  for (let i = 0, len = this.length; i < len; i++) if (f(this[i], i)) return [ this[i], i ];
  return null;
});
protoDef(Array, 'has', function(v) { return this.indexOf(v) >= 0; });
protoDef(Array, 'isEmpty', function() { return this.length === 0; });
protoDef(Array, 'gain', function(arr2) { this.push(...arr2); return this; });

protoDef(String, 'has', function(v) { return this.indexOf(v) >= 0; });
protoDef(String, 'hasHead', function(str) {
  if (str.length > this.length) return false;
  for (let i = 0; i < str.length; i++) if (str[i] !== this[i]) return false;
  return true;
});
protoDef(String, 'hasTail', function(str) {
  let diff = this.length - str.length;
  if (diff < 0) return false;
  for (let i = 0; i < str.length; i++) if (str[i] !== this[diff + i]) return false;
  return true;
});
protoDef(String, 'padHead', function(amt, c=' ') {
  let ret = this;
  while (ret.length < amt) ret = c + ret;
  return ret;
});
protoDef(String, 'padTail', function(amt, c=' ') {
  let ret = this;
  while (ret.length < amt) ret += c;
  return ret;
});
protoDef(String, 'upper', String.prototype.toUpperCase);
protoDef(String, 'lower', String.prototype.toLowerCase);
protoDef(String, 'crop', function(amtL=0, amtR=0) {
  return this.substr(amtL, this.length - amtR);
});

Promise.allArr = Promise.all;
Promise.allObj = async obj => {
  let result = await Promise.allArr(obj.toArr(v => v));
  let ind = 0;
  let ret = {};
  for (let k in obj) ret[k] = result[ind++];
  return ret;
};

let U = global.U = {
  INSP_UID: 0,
  Obj: Object,
  Arr: Array,
  Str: String,
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  multiKey: (...keys) => keys.sort().join('|'),
  safe: (f1, f2=e=>e) => { try { return f1(); } catch(err) { return f2(err); } },
  inspire: ({ name, insps={}, methods, statik={}, description='' }) => {
    
    let Insp = eval(`let Insp = function ${name}(...p) { /* ${name} */ return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p); }; Insp;`);
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a map of all inspirations for `isInspiredBy` testing
    Insp.uid = U.INSP_UID++;
    Insp.insps = { [Insp.uid]: Insp };
    Insp.isInspiredBy = Insp0 => Insp.insps.has(Insp0.uid);
    insps.forEach(SupInsp => Insp.insps.gain(U.isType(SupInsp, Function) && SupInsp.has('uid') ? SupInsp.insps : {}));
    
    // Initialize prototype
    Insp.prototype = Object.create(C.BaseInsp.prototype);
    
    // Resolve all SupInsps to their prototypes
    insps = insps.map(insp => insp.prototype ? insp.prototype : insp); // Resolve Insps as their prototypes
    
    // Run `methods` if necessary. Ensure it always resolves to an `Object` without a "constructor" key
    if (U.isType(methods, Function)) methods = methods(insps, Insp);
    if (!U.isType(methods, Object)) throw new Error('Couldn\'t resolve "methods" to Object');
    if (methods.has('constructor')) throw new Error('Invalid "constructor" key');
    
    let methodsByName = {};
    insps.forEach((insp, inspName) => {
      // Can`t do `insp.forEach`; `insp` may be prototypeless
      for (let [ methodName, method ] of Object.entries(insp)) {
        // `insp` is likely a prototype and contains a "constructor" property that needs to be skipped
        if (methodName === 'constructor') continue;
        if (!methodsByName.has(methodName)) methodsByName[methodName] = [];
        methodsByName[methodName].push(method);
      }
    });
    
    methods.forEach((method, methodName) => {
      if (methodName[0] === '$')  Insp[methodName.substr(1)] = method;
      else                        methodsByName[methodName] = [ method ]; // Guaranteed to be singular
    });
    if (!methodsByName.has('init')) throw new Error('No "init" method available');
    
    methodsByName.forEach((methodsAtName, methodName) => {
      if (methodsAtName.length > 1) throw new Error(`Multiple method "${methodName}" for ${name}; declare a custom method`);
      Insp.prototype[methodName] = methodsAtName[0]; // Length will be exactly 1 now
    });
    
    Insp.prototype.constructor = Insp;
    return Insp;
  },
  isType: (val, Cls) => {
    try { return val.constructor === Cls; } catch (err) {}
    return false;
  },
  isInspiredBy: (Insp1, Insp2) => {
    if (!Insp2.has('uid')) throw new Error(`${U.typeOf(Insp2)} has no "uid"!`);
    try {
      return (U.isType(Insp1, Function) ? Insp1 : Insp1.constructor).insps.has(Insp2.uid);
    } catch(err) { return false; }
  },
  typeOf: obj => {
    if (obj === null) return '<NULL>';
    if (typeof obj === 'undefined') return '<UNDEF>';
    try { return (obj.constructor === Function && obj.name) ? obj.name : obj.constructor.name; } catch (e) {}
    return '<UNKNOWN>';
  },
  
  buildRoom: ({ name, innerRooms=[], build }) => {
    
    return U.rooms[name] = () => {
      
      if (!U.isType(name, String)) throw new Error(`Invalid name: ${U.typeOf(name)}`);
      let missingRoom = innerRooms.find(roomName => !U.rooms.has(roomName));
      if (missingRoom) throw new Error(`Missing innerRoom: ${missingRoom[0]}`);
      
      return U.rooms[name] = {
        name,
        built: build(U.foundation, ...innerRooms.map(roomName => U.rooms[roomName].built))
      };
      
    };
    
  },
  
  foundationClasses: {},
  foundation: null,
  rooms: {}
};

let Wob = U.inspire({ name: 'Wob', methods: (insp, Insp) => ({
  init: function() {
    this.holders = new Set();
  },
  hold: function(func) {
    if (this.holders.has(func)) throw new Error('Already held');
    this.holders.add(func);
    return func;
  },
  drop: function(func, safe=false) {
    if (!this.holders.delete(func) && !safe) throw new Error('Tried to drop unheld function');
    return func;
  },
  isolate: function() { this.holders.clear(); },
  wobble: function(...args) { this.holders.forEach(func => func(...args)); }
})});
let WobVal = U.inspire({ name: 'WobVal', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(value=null) {
    insp.Wob.init.call(this);
    this.value = value;
  },
  setValue: function(value) { this.value = value; },
  getValue: function() { return this.value; },
  hold: function(func, hasty=true) {
    let ret = insp.Wob.hold.call(this, func);
    if (hasty) func(this.getValue(), null);
    return ret;
  },
  wobble: function(value=null, force=U.isType(value, Object)) {
    // Wobbles ought to be prevented on duplicate data; impossible
    // to detect mutation of value though, e.g.:
    // wobbly.wobble(wobbly.value.gain({ prop: 'hi' })
    // The above should generate a wobble, even though the param
    // to `wobbly.wobble` appears to be a duplicate. Therefore the
    // default behaviour here is to force the wobble to occur,
    // only if the new value is an Object
    let origVal = this.value;
    if (!force && value === origVal) return; // Duplicate value; no forcing
    this.setValue(value);
    insp.Wob.wobble.call(this, value, origVal);
  },
  modify: function(func, force) { this.wobble(func(this.getValue()), force); }
})});
let WobObj = U.inspire({ name: 'WobObj', insps: { WobVal }, methods: (insp, Insp) => ({
  init: function(value={}) {
    this.value = {};
    insp.WobVal.init.call(this, value); // Empty obj will add nothing to `this.value`, not clobber it
  },
  wobble: function(delta) {
    this.setValue(delta);
    this.holders.forEach(func => func(delta));
  },
  setValue: function({ add={}, rem={}, ...invalid }) {
    if (!invalid.isEmpty()) throw new Error(`Keys for ${this.constructor.name} should be "add" and "rem"; got: ${Object.keys(invalid).join(', ')}`);
    add.forEach((v, k) => { if (this.value.has(k)) throw new Error(`Duplicate add key: ${k}`); });
    rem.forEach((v, k) => { if (!this.value.has(k)) throw new Error(`Missing rem key: ${k}`); });
    for (let k in add) this.value[k] = add[k];
    for (let k in rem) delete this.value[k];
  },
  getValue: function() { return { add: this.value }; }
})});
let WobFnc = U.inspire({ name: 'WobFnc', insps: { WobVal }, methods: (insp, Insp) => ({
  init: function(wobs, calc) {
    insp.WobVal.init.call(this);
    this.wobs = wobs;
    this.calc = calc;
    
    this.watchFunc = null;
    this.open();
  },
  open: function() {
    if (this.watchFunc) throw new Error(`${this.constructor.name} is already open`);
    this.watchFunc = () => {
      let value = this.calc(...this.wobs.map(wob => wob.getValue()));
      this.wobble(value); // TODO: No "force" being set
    };
    this.wobs.forEach(wob => wob.hold(this.watchFunc, false));
    this.watchFunc(); // Get an initial value
  },
  shut: function() {
    if (!this.watchFunc) throw new Error(`${this.constructor.name} is already shut`);
    insp.WobVal.shut.call(this);
    this.wobs.forEach(wob => wob.drop(this.watchFunc));
    this.watchFunc = null;
  }
})});
let WobFlt = U.inspire({ name: 'WobFlt', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(wob, filter) {
    insp.Wob.init.call(this);
    this.wob = wob;
    this.filter = filter;
    
    this.watchFunc = null
    this.open();
  },
  open: function() {
    if (this.watchFunc) throw new Error(`${this.constructor.name} is already open`);
    this.watchFunc = v => this.filter(v) && this.wobble(v);
    this.wob.hold(this.watchFunc);
  },
  shut: function() {
    if (!this.watchFunc) throw new Error(`${this.constructor.name} is already shut`);
    this.wob.drop(this.watchFunc);
    this.watchFunc = null;
  }
})});
let WobRep = U.inspire({ name: 'WobRep', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(ms, open=false) {
    insp.Wob.init.call(this);
    this.ms = ms;
    this.interval = null;
    if (open) this.open();
  },
  open: function() {
    if (this.interval !== null) throw new Error('Already open');
    this.interval = setInterval(() => this.wobble(), this.ms);
  },
  shut: function() {
    if (this.interval === null) throw new Error('Already shut');
    clearInterval(this.interval);
    this.interval = null;
  }
})});
let WobDel = U.inspire({ name: 'WobDel', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(ms, open=false) {
    insp.Wob.init.call(this);
    this.ms = ms;
    this.timeout = null;
    if (open) this.open();
  },
  open: function() {
    if (this.timeout !== null) throw new Error('Already open');
    this.timeout = setTimeout(() => this.wobble(), this.ms);
  },
  shut: function() {
    if (this.timeout === null) throw new Error('Already shut');
    clearTimeout(this.timeout);
    this.timeout = null;
  }
})});

U.gain({ Wob, WobVal, WobObj, WobFnc, WobFlt, WobRep, WobDel });
