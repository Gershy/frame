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
  dbgCnt: name => {
    if (!U.has('dbgCntMap')) U.dbgCntMap = {};
    if (!U.dbgCntMap.has(name)) {
      U.dbgCntMap[name] = 0;
    } else {
      U.dbgCntMap[name]++;
    }
    return U.dbgCntMap[name];
  },
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  multiKey: (...keys) => keys.sort().join('|'),
  safe: (f1, f2=e=>e) => { try { return f1(); } catch(err) { return f2(err); } },
  inspire: ({ name, insps={}, methods=()=>({}), statik={}, description='' }) => {
    
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
  getConstructor: obj => { try { return obj.constructor; } catch(err) { return null; } },
  typeOf: obj => { return obj === null ? '<NULL>' : obj === undefined ? '<UNDEF>' : U.getConstructor(obj).name; },
  
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

// TODO: VERY draining on performance! Take this out!!!
U.DBG_WOBS = null;
U.TOTAL_WOB_HOLDS = () => {
  let sum = 0;
  for (let wob of U.DBG_WOBS) sum += (wob.holds ? wob.holds.size : 0);
  return sum;
};

let Wob = U.inspire({ name: 'Wob', methods: (insp, Insp) => ({
  init: function() {
    this.holds = new Set();
    if (U.DBG_WOBS) U.DBG_WOBS.add(this);
  },
  hold: function(func) {
    if (this.holds.has(func)) throw new Error('Already held');
    this.holds.add(func);
    
    let shutHoldWob = null;
    return {
      func,
      shut: () => {
        this.holds.delete(func);
        if (shutHoldWob) shutHoldWob.wobble();
      },
      shutWob: () => shutHoldWob || (shutHoldWob = U.WobOne())
    };
  },
  toHolds: function(...args) { this.holds.forEach(func => func(...args)); },
  wobble: function(...args) { this.toHolds(...args); }
})});
let WobOne = U.inspire({ name: 'WobOne', insps: { Wob }, methods: (insp, Insp) => ({
  hold: function(func) {
    // If we haven't wobbled, regular `Wob` functionality
    if (this.holds) {
      if (this.holds.has(func)) throw new Error('Already held');
      this.holds.add(func);
      
      let shutHoldWob = null;
      return {
        func,
        shut: () => {
          if (this.holds) this.holds.delete(func);
          else if (this.tmpHolds) this.tmpHolds.delete(func);
          if (shutHoldWob) shutHoldWob.wobble();
        },
        shutWob: () => shutHoldWob || (shutHoldWob = U.WobOne())
      };

    }
    
    // If we've wobbled, we're either mid-wobble or done wobbling
    if (this.tmpHolds)  this.tmpHolds.add(func);  // Mid-wobble: extend list of holds
    else                  func();                     // Done wobbling: call func immediately
    
    return { shut: () => {}, shutWob: this };
  },
  hadWob: function() { return !this.holds; },
  toHolds: function(...args) {
    if (!this.holds) return;
    this.tmpHolds = this.holds;
    this.holds = null;
    this.tmpHolds.forEach(func => func(...args));
    delete this.tmpHolds;
  }
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
    // to detect mutation of value though, e.g. on Object props
    // The above should generate a wobble, even though the param
    // to `wobbly.wobble` appears to be a duplicate. Therefore the
    // default behaviour here is to force the wobble to occur,
    // only if the new value is an Object
    let origVal = this.value;
    if (!force && value === origVal) return; // Duplicate value; no forcing
    this.setValue(value);
    this.toHolds(value, origVal);
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
    this.toHolds(delta);
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
let WobFnc = U.inspire({ name: 'WobFnc', insps: { Wob }, methods: (insp, Insp) => ({
  // TODO: WobFnc should almost definitely only wobble when all its children have wobbled
  init: function(wobs, calc=v=>v) {
    if (!U.isType(wobs, Array)) wobs = [ wobs ];
    if (!wobs.length) throw new Error('Must provide at least one child Wob');
    wobs.forEach(wob => { if (!wob) throw new Error('Provided null child Wob'); });
    
    insp.Wob.init.call(this);
    
    this.wobs = wobs.map(wob => ({ wob, val: null, holdHog: null }));
    this.calc = calc;
    
    // TODO: Should a wobble be owed when one of our Wobs has wobbled, or only when ALL have?
    this.wobOwed = false; // Detects if a wobble occurs when holding child Wobs upon construction
    this.open();
  },
  childWob: function(item, ...vals) {
    item.val = vals[0]; // NOTE: Omitting all params past the 1st (e.g. for relation11, would omit "old" value)
    this.wobble();
  },
  getValue: function() { return this.calc(...this.wobs.map(wob => wob.val)); },
  wobble: function() {
    // Wobbles are skippable by calculating `C.skip`
    let val = this.getValue();
    if (val !== C.skip) this.toHolds(val);
  },
  hold: function(func, hasty=this.wobOwed) {
    let ret = insp.Wob.hold.call(this, func);
    if (hasty) { let v = this.getValue(); if (v !== C.skip) func(v); } // We implement our own hastiness, controlled with `C.skip`
    return ret;
  },
  open: function() {
    if (this.wobs[0].holdHog) throw new Error(`${this.constructor.name} is already open`);
    
    // Any wobbles resulting from these holds will be prevented, and instead we'll
    // remember that we owe a wobble
    this.wobOwed = false;
    this['toHolds'] = () => { this.wobOwed = true; };
    
    this.wobs.forEach(wobItem => {
      wobItem.val = null;
      wobItem.holdHog = wobItem.wob.hold((...args) => this.childWob(wobItem, ...args));
    });
    
    // Allow wobbles once more
    delete this['toHolds'];
  },
  shut: function() {
    if (!this.wobs[0].holdHog) throw new Error(`${this.constructor.name} is already shut`);
    
    insp.Wob.shut.call(this);
    this.wobs.forEach(wobItem => {
      wobItem.val = null;
      wobItem.holdHog.shut();
      wobItem.holdHog = null;
    });
  }
})});
let WobRep = U.inspire({ name: 'WobRep', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(ms, open=true) {
    insp.Wob.init.call(this);
    if (ms <= 0) throw new Error('Tried to repeat infinitely quickly');
    this.ms = ms;
    this.interval = null;
    if (open) this.open();
  },
  open: function() {
    if (this.interval !== null) throw new Error('Already open');
    this.interval = setInterval(() => this.toHolds(), this.ms);
  },
  shut: function() {
    if (this.interval === null) throw new Error('Already shut');
    clearInterval(this.interval); this.interval = null;
  }
})});
let WobDel = U.inspire({ name: 'WobDel', insps: { WobOne }, methods: (insp, Insp) => ({
  init: function(ms, open=true) {
    insp.WobOne.init.call(this);
    this.ms = ms;
    this.timeout = null;
    if (open) this.open();
  },
  open: function() {
    if (this.timeout !== null) throw new Error('Already open');
    if (this.ms > 0) {
      this.timeout = setTimeout(() => this.toHolds(), this.ms);
    } else {
      this.timeout = 'immediate'; this.toHolds();
    }
  },
  shut: function() {
    if (this.timeout === null) throw new Error('Already shut');
    clearTimeout(this.timeout); this.timeout = null;
  }
})});

let AggWobs = U.inspire({ name: 'AggWobs', insps: {}, methods: (insp, Insp) => ({
  init: function(...wobs) {
    this.wobs = [];
    wobs.forEach(wob => this.addWob(wobs));
    
    this.err = new Error('');
    U.foundation.queueTask(() => {
      if (this.wobs) { this.err.message = 'INCOMPLETE AGG'; throw this.err; }
      delete this.err;
    });
  },
  addWob: function(wob) {
    let wobItem = { wob, vals: null };
    wob.numAggs = wob.numAggs ? wob.numAggs + 1 : 1;
    if (wob.numAggs === 1) wob['toHolds'] = (...vals) => { wobItem.vals = vals; };
    this.wobs.push(wobItem);
  },
  complete: function() {
    this.wobs.forEach(wobItem => {
      delete wobItem.wob.toHolds;
      if (wobItem.wob.numAggs > 1) {
        wobItem.wob.numAggs--;
      } else {
        delete wobItem.wob.numAggs;
        if (wobItem.vals) wobItem.wob.toHolds(...wobItem.vals);
      }
    });
    this.wobs = null;
  }
})});

// TODO: HEEERE! Cleaning up AccessPaths. They'll no longer maintain "accessStrength",
// so Huts will need to know their own strength for following particular Records
let AccessPath = U.inspire({ name: 'AccessPath', insps: {}, methods: (insp, Insp) => ({
  init: function(hogWob, gen=null, open=true, dbg=false) {
    this.hogWob = hogWob;
    this.gen = gen;
    
    this.hogWobHold = null;
    this.allHogDeps = new Set();
    this.shutWob0 = U.WobOne();
    
    if (open) this.open();
  },
  open: function() {
    
    this.hogWobHold = this.hogWob.hold(hog => {
      
      let hogShutWob = hog.shutWob();
      let apShutWob = this.shutWob();
      
      // Shutting the `AccessPath` shuts every accessed `Hog`
      // If the Hog shuts first stop holding
      // let apShutCauseHogShutHold = this.shutWob0.hold(() => hog.shut());
      // hogShutWob.hold(() => apShutCauseHogShutHold.shut());
      
      // Deps alongside `hog` shut when `hog` shuts
      let seen = new Set();
      let addHogDep = dep => {
        
        if (seen.has(dep)) throw new Error('Added same dependency multiple times');
        seen.add(dep);
        
        // If the Dep shuts first stop holding
        let depShutFirstWob = dep.shutWob().hold(() => {
          hogShutCauseDepShutHold.shut();
          apShutCauseDepShutHold.shut();
        });
        
        // If the AccessPath or Hog shut, shut the Dep too
        let hogShutCauseDepShutHold = hogShutWob.hold(() => {
          apShutCauseDepShutHold.shut(); // Stop holding AccessPath
          dep.shut()
        });
        let apShutCauseDepShutHold = apShutWob.hold(() => {
          hogShutCauseDepShutHold.shut(); // Stop holding Hog
          dep.shut();
        });
        
        return dep;
      };
      
      this.gen(addHogDep, hog);
    });
    
  },
  shut: function() {
    if (!this.hogWobHold) throw new Error('Already shut');
    this.hogWobHold.shut(); this.hogWobHold = null;
    this.shutWob0.wobble();
  },
  shutWob: function() { return this.shutWob0; }
  
})});

U.gain({ Wob, WobOne, WobVal, WobObj, WobFnc, WobRep, WobDel, AccessPath, AggWobs });

