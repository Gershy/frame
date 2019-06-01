// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

// TODO: Is "writable" ok?
let protoDef = (Cls, name, value) => Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });

let C = global.C = {
  skip: { SKIP: 1 },
  BaseInsp: (() => {
    let BaseInsp = function BaseInsp() {};
    BaseInsp.prototype = Object.create(null);
    protoDef(BaseInsp, 'isInspiredBy', function(Insp0) { return this.constructor.insps.has(Insp0.uid); }); 
    protoDef(BaseInsp, 'inspClone', function(cnsProps=null, props={}) {
      let ThisCls = this.constructor;
      let newInst = ThisCls(...(cnsProps || []));
      for (let k in this) newInst[k] = this[k];
      for (let k in props) newInst[k] = props[k];
      return newInst;
    });
    return BaseInsp;
  })(),
  notImplemented: function() { throw new Error(`Not implemented by ${this.constructor.name}`); }
};

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
protoDef(Object, 'find', function(f) { // Returns [ VAL, KEY ]
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
protoDef(Array, 'toObj', function(it) { // Return [ KEY, VAL ] from the iterator
  let ret = {};
  for (let i = 0, len = this.length; i < len; i++) {
    let v = it(this[i], i);
    if (v === C.skip) continue;
    ret[v[0]] = v[1];
  }
  return ret;
});
protoDef(Array, 'find', function(f) { // Returns [ VAL, IND ]
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
protoDef(String, 'padHead', function(amt, char=' ') {
  //return char.repeat(Math.max(0, amt - this.length)) + ret;
  let ret = this;
  while (ret.length < amt) ret = char + ret;
  return ret;
});
protoDef(String, 'padTail', function(amt, char=' ') {
  //return char.repeat(Math.max(0, amt - this.length)) + ret;
  let ret = this;
  while (ret.length < amt) ret += char;
  return ret;
});
protoDef(String, 'upper', String.prototype.toUpperCase);
protoDef(String, 'lower', String.prototype.toLowerCase);
protoDef(String, 'crop', function(amtL=0, amtR=0) {
  return this.substr(amtL, this.length - amtR);
});

protoDef(Set, 'find', function(f) {
  for (let v of this) if (f(v)) return [ v ];
  return null;
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
    insps = insps.map(insp => {
      if (!insp.prototype) return insp;
      let pNames = Object.getOwnPropertyNames(insp.prototype);
      return pNames.toObj(v => [ v, insp.prototype[v] ]);
    }); // Resolve Insps as their prototypes
    
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
    
    for (let methodName in methods) {
      let method = methods[methodName];
      if (methodName[0] === '$') {
        Insp[methodName.substr(1)] = method;
      } else {
        methodsByName[methodName] = [ method ]; // Guaranteed to be singular
      }
    }
    
    if (!methodsByName.has('init')) throw new Error('No "init" method available');
    
    for (let methodName in methodsByName) {
      let methodsAtName = methodsByName[methodName];
      if (methodsAtName.length > 1) throw new Error(`Multiple methods "${methodName}" for ${name}; declare a custom method`);
      protoDef(Insp, methodName, methodsAtName[0]); // `methodsAtName.length === 1`
    }
    
    protoDef(Insp, 'constructor', Insp);
    return Insp;
  },
  isType: (val, Cls) => {
    try { return val.constructor === Cls; } catch (err) {}
    return false;
  },
  isInspiredBy: (Insp1, Insp2) => {
    if (!Insp2.has('uid')) throw new Error(`${U.typeOf(Insp2)} has no "uid"!`);
    try {
      if (!U.isType(Insp1, Function)) Insp1 = Insp1.constructor;
      return Insp1.has('insps') && Insp1.insps.has(Insp2.uid);
      //return (U.isType(Insp1, Function) ? Insp1 : Insp1.constructor).insps.has(Insp2.uid);
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

let Hog = U.inspire({ name: 'Hog', methods: (insp, Insp) => ({
  init: function(shut) {
    this.shutWob0 = U.WobOne();
    if (shut) this.shut0 = shut; // Allow easy overwrite of "shut0" functionality
  },
  isShut: function() { return !!this.didShut; },
  shut0: function() { /* nothing */ },
  shut: function(...args) {
    if (this.didShut) throw new Error('Already shut');
    this.didShut = true;
    this.shut0(...args);
    this.shutWob0.wobble();
  },
  shutWob: function() { return this.shutWob0; }
})});

let Wob = U.inspire({ name: 'Wob', methods: (insp, Insp) => ({
  init: function() {
    this.holds = new Set();
    if (U.DBG_WOBS) U.DBG_WOBS.add(this);
  },
  numHolds: function() { return this.holds ? this.holds.size : 0; },
  hold: function(func) {
    if (this.holds.has(func)) throw new Error('Already held');
    this.holds.add(func);
    return Hog(() => this.holds.delete(func));
  },
  wobble: function(...args) { this.toHolds(...args); },
  toHolds: function(...args) { this.holds.forEach(func => func(...args)); }
})});
let WobOne = U.inspire({ name: 'WobOne', insps: { Wob }, methods: (insp, Insp) => ({
  init: function() {
    insp.Wob.init.call(this);
  },
  hold: function(func) {
    // If we haven't wobbled, regular `Wob` functionality
    if (this.holds) {
      
      if (this.holds.has(func)) throw new Error('Already held');
      this.holds.add(func);
      
      return Hog(() => {
        if (this.holds) this.holds.delete(func);
        else if (this.tmpHolds) this.tmpHolds.delete(func);
      });

    }
    
    // If `!this.holds`, we're either mid-wobble or done wobbling
    if (this.tmpHolds)  this.tmpHolds.add(func);  // Mid-wobble: we're already iterating `this.tmpHolds` so queue `func` and we'll get to it
    else                func();                   // Done wobbling: call `func` immediately
    
    // Return a duck-typed Hog which ignores shuts and wobbles as if
    // its already been shut
    return { shut: () => {}, shutWob: () => this };
  },
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
    // Wobbles ought to be prevented on duplicate data; impossible to
    // detect mutation of value though, e.g. on Object props. The Above
    // should generate a wobble, even though the param to `wobbly.wobble`
    // appears to be a duplicate. Therefore the default behaviour here is
    // to force the wobble to occur if the new value is an Object.
    let origVal = this.value;
    if (!force && value === origVal) return; // Duplicate value; no forcing
    this.setValue(value);
    this.toHolds(value, origVal);
  },
  modify: function(func, force) { this.wobble(func(this.getValue()), force); }
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
    this.wobs = new Map(); // Maps a `Wob` to its related WobItem
    wobs.forEach(wob => this.addWob(wobs));
    
    this.err = new Error('');
    U.foundation.queueTask(() => {
      if (this.wobs) { this.err.message = 'INCOMPLETE AGG'; throw this.err; }
      delete this.err;
    });
  },
  addWob: function(wob) {
    if (this.wobs.has(wob)) return wob; // TODO: Throw error?
    
    let wobItem = { wob, vals: null };
    
    wob.numAggs = wob.numAggs ? wob.numAggs + 1 : 1;
    if (wob.numAggs > 1) console.log(U.foundation.formatError(new Error('Multiple aggs')));
    if (wob.numAggs === 1) wob['toHolds'] = (...vals) => { wobItem.vals = vals; };
    
    this.wobs.set(wob, wobItem);
    
    return wob;
  },
  complete: function(fnc=null) {
    if (fnc) fnc(this);
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

let AccessPath = U.inspire({ name: 'AccessPath', insps: { Hog }, methods: (insp, Insp) => ({
  init: function(hogWob, gen=null, dbg=false) {
    insp.Hog.init.call(this);
    
    this.hogWob = hogWob;
    this.gen = gen;
    
    this.hogWobHold = null;
    this.allHogDeps = new Set();
    
    this.open();
  },
  open: function() {
    
    this.hogWobHold = this.hogWob.hold(hog => {
      
      let hogShutWob = hog.shutWob();
      let apShutWob = this.shutWob();
      
      // Shutting the `AccessPath` shuts every accessed `Hog`
      
      // Deps alongside `hog` shut when `hog` shuts
      let addHogDep = dep => {
        
        // If the Dep shuts stop holding
        let depShutFirstWob = dep.shutWob().hold(() => {
          hogShutCauseDepShutHold.shut();
          apShutCauseDepShutHold.shut();
        });
        
        // If the AccessPath or Hog shut, immediately shut `dep`
        // Note that shutting `dep` will cause both these holds, against
        // the Hog shutting and the AccessPath shutting, to be dropped.
        let hogShutCauseDepShutHold = hogShutWob.hold((...args) => dep.shut(...args));
        let apShutCauseDepShutHold = apShutWob.hold((...args) => dep.shut(...args));
        
        return dep;
      };
      this.gen(addHogDep, hog, this);
    });
    
  },
  shut0: function(...args) { this.hogWobHold.shut(); },
})});

// TODO: Oughtn't be aggregated
let nullWob = {
  hold: () => nullShutWob,
  wobble: () => {}
};
let nullShutWob = {
  hold: () => nullShutWob,
  shut: () => {},
  shutWob: () => nullWob
};
C.gain({ nullWob, nullShutWob });

U.gain({ Hog, Wob, WobOne, WobVal, WobFnc, WobRep, WobDel, AccessPath, AggWobs });

