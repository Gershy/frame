// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

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
  hold: function(func, hasty=true) {
    let ret = insp.Wob.hold.call(this, func);
    if (hasty) func(this.value, null);
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
    this.value = value;
    this.toHolds(value, origVal);
  },
  modify: function(func, force) { this.wobble(func(this.value), force); }
})});
let WobFlt = U.inspire({ name: 'WobFlt', insps: { Wob, Hog }, methods: (insp, Insp) => ({
  
  // Wob Filter
  
  init: function(wob, flt, open=true) {
    insp.Wob.init.call(this);
    insp.Hog.init.call(this);
    this.wob = wob;
    this.flt = flt;
    this.wobHold = null;
    if (open) this.open();
  },
  open: function() {
    
    if (this.wobHold) throw new Error('Already open');
    
    this.wobHold = this.wob.hold((...args) => {
      let flt = this.flt(...args);
      if (flt !== C.skip) this.wobble(flt);
    });
    
  },
  shut0: function() { if (this.wobHold) this.wobHold.shut(); }
})});
let WobTmp = U.inspire({ name: 'WobOpt', insps: { Wob }, methods: (insp, Insp) => ({
  
  // Wob Temporary
  
  init: function(pos='up') {
    if (![ 'up', 'dn' ].has(pos)) throw new Error(`Param should be "up" or "dn"; got ${pos}`);
    insp.Wob.init.call(this);
    this.tmp = null;
    if (pos === 'up') this.up();
  },
  up: function(val=null) {
    if (this.tmp) throw new Error('Already up');
    this.tmp = Hog(() => { this.tmp = null; });
    this.tmp.val = val;
    this.wobble(this.tmp);
  },
  dn: function() {
    if (!this.tmp) throw new Error('Already dn');
    this.tmp.shut();
  },
  hold: function(func) {
    let ret = insp.Wob.hold.call(this, func);
    if (this.tmp) func(this.tmp);
    return ret;
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
    if (this.wobs.has(wob)) return wob; // Allowed to add the same `wob` multiple times (with no effect)
    
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

U.gain({ Hog, Wob, WobOne, WobVal, AccessPath, AggWobs });

