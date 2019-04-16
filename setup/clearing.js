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

let Wobbly = U.inspire({ name: 'Wobbly', methods: (insp, Insp) => ({
  $nextUid: 0,
  $nextHoldUid: 0,
  
  init: function({ value=null, uid=null }) {
    this.uid = uid !== null ? uid : Insp.nextUid++;
    this.setValue(value);
  },
  setValue: function(value) { this.value = value; },
  getValue: function() { return this.value ? this.value : null; },
  setThrottle: function(throttle) {
    this.throttle = open;
    this.throttleVal = null;
  },
  hold: function(func, hasty=true) {
    if (!this.holders) this.holders = {};
    let ind = Insp.nextHoldUid++;
    func[`~wob${this.uid}`] = ind;
    this.holders[ind] = func;
    if (hasty) func(this.getValue(), null);
    return func;
  },
  drop: function(func, safe=false) {
    if (!func.has(`~wob${this.uid}`)) {
      if (!safe)  throw new Error('Tried to drop unheld function');
      else        return false;
    }
    let ind = func[`~wob${this.uid}`];
    if (!this.holders || !this.holders.has(ind)) {
      throw new Error(`${this.constructor.name} doesn't know index ${ind}`);
    }
    delete func[`~wob${this.uid}`];
    delete this.holders[ind];
    if (this.holders.isEmpty()) delete this.holders;
  },
  isolate: function() {
    // Avoid deletion-while-looping headaches; clone holders
    this.holders.map(v => v).forEach(func => this.drop(func));
  },
  wobble: function(value=null, force=U.isType(value, Object)) {
    // Default `value` is null
    // If `value` is an `Object`, `force` default to `true` (because it's likely that inner properties changed)
    // If `value` is any other type, `force` defaults to `false`
    
    let origVal = ({}).has.call(this, 'value') ? this.value : null;
    if (!force && value === origVal) return;
    
    if (!this.throttle) {
      
      this.setValue(value);
      if (this.holders) this.holders.forEach(h => h(value, origVal));
      
    } else {
      
      let isThrottleActive = !!this.throttleVal;
      this.throttleVal = { value };
      
      if (!isThrottleActive) {
        
        // Begin waiting on the throttle event. Once it resolves the most
        // recent `this.throttleVal.value` will be set.
        this.throttle().then(() => {
          this.setValue(this.throttleVal.value);
          this.throttleVal = null;
          if (this.holders) this.holders.forEach(h => h(value, origVal));
        });
        
      }
      
    }
    
  },
  modify: function(f, force) {
    this.wobble(f(this.getValue()), force);
  }
})});
let DeltaWob = U.inspire({ name: 'DeltaWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function({ value={}, uid=null }) {
    this.value = value;
    insp.Wobbly.init.call(this, { value: {}, uid });
  },
  setValue: function(value) {
    let [ add, rem ] = [ value.has('add') ? value.add : {}, value.has('rem') ? value.rem : {} ];
    
    add.forEach((v, k) => {
      if (this.value.has(k)) throw new Error(`Duplicate add key: ${k}`);
    });
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
  },
  wobbleAdd: function(k, v, force) {
    return this.wobble({ add: { [k]: v } }, force);
  },
  wobbleRem: function(k, v, force) {
    return this.wobble({ rem: { [k]: v } }, force);
  }
})});
let BareWob = U.inspire({ name: 'BareWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function({ uid=null }) {
    insp.Wobbly.init.call(this, { uid });
  },
  setValue: function(v) {},
  getValue: function() { return null; },
  wobble: function(value=null, force=true) { insp.Wobbly.wobble.call(this, value, force); },
  modify: function(f) { throw new Error(`Call "wobble" instead of "modify" on ${this.constructor.name}`); },
  hold: function(func, hasty=false) { return insp.Wobbly.hold.call(this, func, hasty); }
})});
let DelayWob = U.inspire({ name: 'DelayWob', insps: { BareWob }, methods: (insp, Insp) => ({
  init: function({ uid, ms, open=true }) {
    insp.BareWob.init.call(this, { uid });
    this.ms = ms;
    this.ref = null;
    if (open) this.open();
  },
  open: function() { this.ref = setTimeout(() => this.wobble(null), this.ms); },
  shut: function() { clearTimeout(this.ref); this.ref = null; }
})});
let IntervalWob = U.inspire({ name: 'IntervalWob', insps: { BareWob }, methods: (insp, Insp) => ({
  init: function({ uid, ms, open=true }) {
    insp.BareWob.init.call(this, { uid });
    this.ms = ms;
    this.ref = null;
    if (open) this.open();
  },
  open: function() { this.ref = setInterval(() => this.wobble(null), this.ms); },
  shut: function() { clearInterval(this.ref); this.ref = null; }
})});
let CalcWob = U.inspire({ name: 'CalcWob', insps: { Wobbly }, methods: (insp, Insp) => ({
  init: function({ uid, wobs, func, open=true }) {
    insp.Wobbly.init.call(this, { uid });
    this.wobs = wobs;
    this.func = func;
    
    this.watchFunc = null;
    if (open) this.open();
    else      this.setValue(this.calc());
  },
  calc: function() {
    return this.func(...this.wobs.map(w => w.getValue()));
  },
  open: function() {
    if (this.watchFunc) { console.log('MULTIPLE CALCWOB ADDS :('); return; }
    this.watchFunc = () => {
      let value = this.calc();
      if (value !== this.getValue()) this.wobble(value);
    };
    this.wobs.forEach(w => w.hold(this.watchFunc, false));  // Don't wobble on hold
    this.setValue(this.calc());                             // Only change value once at end
  },
  shut: function() {
    if (!this.watchFunc) { console.log('MULTIPLE CALCWOB REMS :('); return; }
    this.wobs.forEach(w => w.drop(this.watchFunc));
    this.watchFunc = null;
  },
  drop: function(func, safe) {
    // Overloads `Wobbly.prototype.drop`; providing `func` uses parent behaviour
    // otherwise synonymous with `CalcWob.prototype.shut`
    return func ? insp.Wobbly.drop.call(this, func, safe) : this.shut();
  }
})});

let Law = U.inspire({ name: 'Law', methods: (insp, Insp) => ({
  init: function(name, wob, func) {
    this.name = name;
    this.wob = wob;
    this.func = func;
    this.wobHold = null;
    this.innerHolds = {};
  },
  open: function() {
    
    this.wobHold = this.wob.hold((v1, v0) => {
      
      // TODO: Hard to meaningfully distinguish between adds/rems here... maybe subclass in Record?
      // Consider a subclass of Wobbly which guarantees that any wobbled values have a uid? WobblId?
      let add = null, rem = null;
      if (U.isType(v1, Object)) {
        add = v1.add || {};
        rem = v1.rem || {};
      } else {
        add = v1 ? { [v1.uid]: v1 } : {};
        rem = v0 ? { [v0.uid]: v0 } : {};
      }
      
      // if (add.toArr(v => v).length || rem.toArr(v => v).length)
      //   console.log(`LAW ${this.name}: +${add.toArr(v => v).length}, -${rem.toArr(v => v).length}`);
      
      add.forEach(addVal => {
        if (this.innerHolds.has(addVal.uid)) { console.log('MULTIPLE LAW ADDS! :('); return; }
        this.innerHolds[addVal.uid] = this.func(addVal);
        this.innerHolds[addVal.uid].forEach(temp => temp.open());
      });
      
      rem.forEach(remVal => {
        if (!this.innerHolds.has(remVal.uid)) { console.log('MULTIPLE LAW REMS! :('); return; }
        this.innerHolds[remVal.uid].forEach(temp => temp.shut());
        delete this.innerHolds[remVal.uid];
      });
      
    });
    
  },
  shut: function() {
    
    // Shut all inner holds
    this.innerHolds.forEach(tempsAtUid => tempsAtUid.forEach(temp => temp.shut()));
    this.innerHolds = {};
    
    // Drop our Wobbly
    this.wob.drop(this.wobHold);
    this.wobHold = null;
    
  }
})});
let Waw = U.inspire({ name: 'Waw', methods: (insp, Insp) => ({
  init: function(name, wob, func) {
    this.name = name;
    this.wob = wob;
    this.func = func;
    this.wobHold = null;
  },
  open: function() { this.wobHold = this.wob.hold((...vals) => this.func(...vals)); },
  shut: function() { this.wob.drop(this.wobHold); this.wobHold = null; }
})});

U.gain({
  Wobbly, DeltaWob, BareWob, DelayWob, IntervalWob, CalcWob, Law, Waw
});
