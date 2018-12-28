// The "clearing" is javascript-level bootstrapping; configuring+extending the
// language to behave more pleasantly and consistently

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

protoDef(Object, 'forEach', function(fn) {
  for (let k in this) fn(this[k], k);
});
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
  let ret = {};
  props.forEach(p => { ret[p] = this[p]; });
  return ret;
});
protoDef(Object, 'find', function(f) {
  for (let k in this) if (f(this[k], k)) return [ this[k], k ];
  return null;
});
protoDef(Object, 'has', Object.prototype.hasOwnProperty);
protoDef(Object, 'isEmpty', function() { for (let k in this) return false; return true; });
protoDef(Object, 'gain', function(obj) {
  for (let k in obj) this[k] = obj[k];
  return this;
});

Array.fill = (n, f=()=>null) => {
  let a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = f(i);
  return a;
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
protoDef(Array, 'isEmpty', function() { return !!this.length; });
protoDef(Array, 'gain', function(arr2) { return this.push(...arr2); });

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

let U = global.U = {
  INSP_UID: 0,
  Obj: Object,
  Arr: Array,
  Str: String,
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  duoKey: (v1, v2, delim=',') => v1 < v2 ? `${v1}${delim}${v2}` : `${v2}${delim}${v1}`,
  multiKey: (...keys) => keys.sort().join('|'),
  combineObjs: (obj1, obj2) => ({ ...obj1, ...obj2 }),
  inspire: ({ name, insps={}, methods, statik={}, description='' }) => {
    
    let Insp = eval(`let Insp = function ${name}(...p) { /* ${name} */ return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p); }; Insp;`);
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a map of all inspirations for `isInspiredBy` testing
    Insp.uid = U.INSP_UID++;
    Insp.insps = { [Insp.uid]: Insp };
    Insp.isInspiredBy = Insp0 => Insp.insps.has(Insp0.uid);
    insps.forEach(SupInsp => { if (U.isType(SupInsp, Function) && SupInsp.has('uid')) Insp.insps.gain(SupInsp.insps); });
    
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
    try { return (obj.constructor === Function && obj.name) ? `<Insp(${obj.name})>` : `<insp(${obj.constructor.name})>`; } catch (e) {}
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

let Wobbly = U.inspire({ name: 'Wobbly', methods: (insp, Insp) => ({
  $nextUid: 0,
  $nextHoldUid: 0,
  
  init: function({ value=null, uid=null }) {
    this.uid = uid !== null ? uid : Insp.nextUid++;
    this.setValue(value);
  },
  setValue: function(value) { this.value = value; },
  getValue: function() { return this.value ? this.value : null; },
  hold: function(func, hasty=true) {
    if (!this.holders) this.holders = {};
    let ind = Insp.nextHoldUid++;
    func[`~wob${this.uid}`] = ind;
    this.holders[ind] = func;
    if (hasty) { let v = this.getValue(); func(v, v); }
    return func;
  },
  drop: function(func, safe=false) {
    if (!func.has(`~wob${this.uid}`)) {
      if (!safe)  throw new Error('Tried to drop unheld function');
      else        return false;
    }
    let ind = func[`~wob${this.uid}`];
    delete func[`~wob${this.uid}`];
    delete this.holders[ind];
    if (this.holders.isEmpty()) delete this.holders;
  },
  wobble: function(value=null) {
    let origVal = ({}).has.call(this, 'value') ? this.value : null;
    if (value === origVal) return;
    this.setValue(value);
    if (this.holders) this.holders.forEach(h => h(value, origVal)); //for (let k in this.holders) this.holders[k](value, origVal);
  },
  modify: function(f) {
    this.wobble(f(this.getValue()));
  }
})});
let DeltaWob = U.inspire({ name: 'DeltaWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function({ value={}, uid=null }) {
    this.value = value;
    insp.Wobbly.init.call(this, { value: {}, uid });
  },
  setValue: function(value) {
    let [ add, rem ] = [ value.has('add') ? value.add : {}, value.has('rem') ? value.rem : {} ];
    
    add.forEach((v, k) => { if (this.value.has(k)) throw new Error(`Duplicate add key: ${k}`); });
    rem.forEach((v, k) => {
      if (!this.value.has(k)) throw new Error(`Missing rem key: ${k}`);
      if (add.has(k)) throw new Error(`Tried to add and rem ${k}`);
    });
    
    add.forEach((v, k) => { this.value[k] = v; });
    rem.forEach((v, k) => { delete this.value[k]; });
  },
  getValue: function() {
    // Return regular value as a delta
    return { add: this.value };
  }
})});
let BareWob = U.inspire({ name: 'BareWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function({ uid=null }) {
    insp.Wobbly.init.call(this, { uid });
  },
  setValue: function(v) {},
  getValue: function() { return null; },
  modify: function(f) { throw new Error(`Call "wobble" instead of "modify" on ${this.constructor.name}`); },
  hold: function(func) { return insp.Wobbly.hold.call(this, func, false); }
})});
let CalcWob = U.inspire({ name: 'CalcWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function(wobblies, func) {
    insp.Wobbly.init.call(this);
    this.wobblies = wobblies;
    this.func = func;
    this.watchFunc = () => {
      let value = this.calc();
      if (value !== this.getValue()) this.wobble(value);
    };
    this.setValue(this.calc());
    this.wobblies.forEach(w => w.hold(this.watchFunc));
  },
  calc: function() {
    return this.func(...this.wobblies.map(w => w.getValue()));
  }
})});

U.gain({
  Wobbly, DeltaWob, BareWob, CalcWob
});
