// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

Error.stackTraceLimit = Infinity;

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

let SetOrig = Set;
Set = global.Set = function Set(...args) { return new SetOrig(...args); };
protoDef(SetOrig, 'toArr', function(fn) {
  let ret = [];
  for (let v of this) { v = fn(v); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(SetOrig, 'find', function(f) {
  for (let v of this) if (f(v)) return [ v ];
  return null;
});
protoDef(SetOrig, 'isEmpty', function() { return !this.size; });
protoDef(SetOrig, 'rem', SetOrig.prototype.delete);

let MapOrig = Map;
Map = global.Map = function Map(...args) { return new MapOrig(...args); };
protoDef(MapOrig, 'toObj', function(fn) {
  let ret = {};
  for (let [ k, v ] of this.entries()) { v = fn(v, k); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(MapOrig, 'isEmpty', function() { return !this.size; });
protoDef(MapOrig, 'rem', MapOrig.prototype.delete);

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
  dbgVar: obj => {
    for (let k in obj) console.log(k.upper(), obj[k]);
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
    // Unboxed values (`null` and `undefined` are tested in the `catch`
    try { return val.constructor === Cls; } catch (err) { return val === Cls; }
    return false;
  },
  isInspiredBy: (Insp1, Insp2) => {
    if (!Insp2.has('uid')) throw new Error(`${U.typeOf(Insp2)} has no "uid"!`);
    try {
      if (!U.isType(Insp1, Function)) Insp1 = Insp1.constructor;
      return Insp1.has('insps') && Insp1.insps.has(Insp2.uid);
    } catch(err) { return false; }
  },
  typeOf: obj => { try { return obj.constructor.name; } catch(err) {} return String(obj); },
  
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
  init: function(shut=null) {
    this.shutWob0 = U.WobOne();
    if (shut) this.shut0 = shut; // Allow easy overwrite of "shut0" functionality
  },
  isShut: function() { return !!this.didShut; },
  shut0: function() { /* nothing */ },
  shut: function(...args) {
    if (this.didShut) throw new Error(`Already shut`);
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
  hold: function(holdFn) {
    if (this.holds.has(holdFn)) throw new Error('Already held');
    this.holds.add(holdFn);
    return Hog(() => this.shutHolder(holdFn)); // holds.delete(func));
  },
  shutHolder: function(holdFn) { this.holds.delete(holdFn); },
  wobble: function(...args) { this.holds.forEach(holdFn => this.toHold(holdFn, ...args)); },
  toHold: function(holdFn, ...args) { holdFn(...args); }
})});
let WobOne = U.inspire({ name: 'WobOne', insps: { Wob }, methods: (insp, Insp) => ({
  init: function() {
    insp.Wob.init.call(this);
  },
  hold: function(holdFn) {
    // If we haven't wobbled, regular `Wob` functionality
    if (this.holds) return insp.Wob.hold.call(this, holdFn);
    
    // If `!this.holds`, we're either mid-wobble or done wobbling:
    if (this.tmpHolds)  this.tmpHolds.add(holdFn);  // Mid-wobble: we're already iterating `this.tmpHolds` so queue `holdFn` and we'll get to it
    else                this.toHold(holdFn);        // Done wobbling: call `holdFn` immediately with no args
    
    // Return a duck-typed Hog which ignores shuts and wobbles as if
    // its already been shut
    return { shut: () => {}, shutWob: () => this };
  },
  shutHolder: function(holdFn) {
    if (this.holds) this.holds.delete(holdFn);
    else if (this.tmpHolds) this.tmpHolds.delete(holdFn);
  },
  wobble: function(...args) {
    if (!this.holds) return; // Can only wobble once; the 1st time is detected by `!!this.holds`
    this.tmpHolds = this.holds;
    this.holds = null;
    this.tmpHolds.forEach(holdFn => this.toHold(holdFn, ...args));
    delete this.tmpHolds;
  }
})});
let WobVal = U.inspire({ name: 'WobVal', insps: { Wob }, methods: (insp, Insp) => ({
  init: function(value=null) {
    insp.Wob.init.call(this);
    this.value = value;
  },
  hold: function(holdFn, hasty=true) {
    let ret = insp.Wob.hold.call(this, holdFn);
    if (hasty) this.toHold(holdFn, this.value, null);
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
    insp.Wob.wobble.call(this, value, origVal);
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
let WobTmp = U.inspire({ name: 'WobTmp', insps: { Wob }, methods: (insp, Insp) => ({
  
  // Wob Temporary
  
  init: function(pos='up', val=null) {
    if (![ 'up', 'dn' ].has(pos)) throw new Error(`Param should be "up" or "dn"; got ${pos}`);
    insp.Wob.init.call(this);
    this.tmp = null;
    if (pos === 'up') this.up(val);
  },
  inverse: function() {
    
    // TODO: Need to test WobTmp.prototype.inverse
    
    if (!this.inverse0) {
      this.inverse0 = WobTmp(this.pos === 'up' ? 'dn' : 'up');
      this.inverse0.inverse0 = this;
      
      // let origUp = this.up;
      // let origDn = this.dn;
      // this.up = (...args) => {
      //   let ret = origUp.call(this, ...args);
      //   this.inverse0.dn();
      //   return ret;
      // };
      // this.dn = (...args) => {
      //   let ret = origDn.call(this, ...args);
      //   this.inverse0.up();
      //   return ret;
      // };
      
      // Now, forever, wobbles on us have an inverse effect on `this.inverse0`
      this.hold(tmp => {
        this.inverse0.dn(); // Us going up puts our inverse down
        tmp.shutWob().hold(() => this.inverse0.up()); // TODO: Would pass `tmp.val` here if `this.inverse0` were initializable with a value
      });
      
    }
    return this.inverse0;
    
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
  hold: function(holdFn) {
    let ret = insp.Wob.hold.call(this, holdFn);
    if (this.tmp) this.toHold(holdFn, this.tmp);
    return ret;
  },
  wobble: function(...args) { return insp.Wob.wobble.call(this, this.tmp, ...args); }
})});

let WobMemVal = U.inspire({ name: 'WobMemVal', insps: { Wob }, methods: (insp, Insp) => ({
  init: function() { insp.Wob.init.call(this); this.val = null; },
  hold: function(holdFn) {
    if (this.val) this.toHold(holdFn, this.val);
    return insp.Wob.hold.call(this, holdFn);
  },
  gain: function(val) {
    if (!val) throw new Error(`Invalid val ${U.typeOf(val)} resolves to false`);
    if (this.val) throw new Error('Already add');
    this.val = val;
    this.wobble(this.val);
    return Hog(() => { this.val = null; });
  }
})});
let WobMemSet = U.inspire({ name: 'WobMemSet', insps: { Wob }, methods: (insp, Insp) => ({
  init: function() { insp.Wob.init.call(this); this.vals = Set(); },
  hold: function(holdFn) {
    this.vals.forEach(v => this.toHold(holdFn, v));
    return insp.Wob.hold.call(this, holdFn);
  },
  gain: function(val) {
    if (this.vals.has(val)) throw new Error('Already add');
    this.vals.add(val);
    this.wobble(val);
    return Hog(() => this.vals.delete(val));
  }
})});

let AggWobs = U.inspire({ name: 'AggWobs', insps: {}, methods: (insp, Insp) => ({
  init: function(...wobs) {
    this.wobs = new Set(); // Maps a `Wob` to its related WobItem
    wobs.forEach(wob => this.addWob(wob));
    
    this.err = new Error('');
    U.foundation.queueTask(() => { // TODO: Better name for "queueTask" should simply imply that the task occurs after serial processing is done
      if (this.wobs) { this.err.message = 'INCOMPLETE AGG'; throw this.err; }
      delete this.err;
    });
  },
  addWob: function(wob) {
    
    if (this.wobs.has(wob)) return wob; // Allowed to add the same `wob` multiple times (with no effect)
    this.wobs.add(wob);
    
    // For each Wob there are many Holds. Each Hold may be contacted multiple times,
    // with different values each time. These values could be simple literals, or
    // could also be Hogs. Each of the Wob's Holds should be wobbled once for every
    // received value, EXCEPTING any values which were Hogs, and are shut at the
    // present instant.
    
    wob.aggCnt = wob.aggCnt ? wob.aggCnt + 1 : 1; // TODO: No more "numAggs"!
    
    // This should be indicated. AggWobs should probably not compound. If anything, there
    // should be a heirarchy of AggWobs (e.g. `agg1.addWob(agg2)`)
    if (wob.aggCnt > 1) console.log(U.foundation.formatError(new Error('Multiple aggs')));
    
    // Only the 1st AggWobs gets to mask the Wob's "toHold" function:
    if (wob.aggCnt === 1) {
      
      let m = wob.aggMapHoldToArgsSet = new Map();
      wob['toHold'] = (holdFn, ...args) => {
        
        if (!m.has(holdFn)) m.set(holdFn, new Set());
        
        // From the Wob, get a particular Hold, and add a set of arguments for it.
        m.get(holdFn).add(args);
        
      };
      
    }
    
    return wob;
  },
  complete: function(err=null) {
    
    // Apply all wobbles that happened while aggregated!
    this.wobs.forEach(wob => {
      
      if (wob.aggCnt > 1) { wob.aggCnt--; return; } // There are still more AggWobs holding `wob`
      
      // Get reference to needed data, then clean up our "toHold" mask and other "agg*" props
      let mapHoldsToArgsSet = err || wob.aggMapHoldToArgsSet;
      delete wob['toHold'];
      delete wob.aggCnt;
      delete wob.aggMapHoldToArgsSet;
      
      if (!err) {
        // Now we have Holds mapped to a set of Args. Each Hold should be called with every
        // related instance of Args:
        mapHoldsToArgsSet.forEach((argsSet, holdFn) => {
          argsSet.forEach(args => {
            let argsIsShutHog = args.length === 1 && U.isInspiredBy(args[0], Hog) && args[0].isShut();
            if (!argsIsShutHog) holdFn(...args); // Unless the shut-Hog exception applies, wobble the Holder!
          });
        });
      }
      
    });
    
    this.wobs = null; // Prevent adding any new wobs. `AggWobs` can only complete once!
    
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
        
        if (!dep.shutWob) throw new Error(`Invalid "dep": ${U.typeOf(dep)}`);
        let depShutWob = dep.shutWob();
        
        if (!depShutWob || !depShutWob.hold) throw new Error(`Mis-implemented shutWob: ${U.typeOf(dep)}`);
        
        let [ hogShutCauseDepShutHold, apShutCauseDepShutHold ] = [ null, null ];
        let finished = false;
        
        // If the Dep shuts stop holding
        let depShutFirstWob = depShutWob.hold(() => {
          if (hogShutCauseDepShutHold) hogShutCauseDepShutHold.shut();
          if (apShutCauseDepShutHold) apShutCauseDepShutHold.shut();
          finished = true;
        });
        
        // It's possible that `depShutWob` wobbles immediately, before
        // `hogShutCauseDepShutHold` and `apShutCauseDepShutHold` are even
        // initialized. If that occurs, shouldn't even initialize them!
        if (!finished) {
          // If the AccessPath or Hog shut, immediately shut `dep`
          // Note that shutting `dep` will cause both these holds, against
          // the Hog shutting and the AccessPath shutting, to be dropped.
          hogShutCauseDepShutHold = hogShutWob.hold((...args) => dep.shut(...args));
          apShutCauseDepShutHold = apShutWob.hold((...args) => dep.shut(...args));
        }
        
        return dep;
      };
      this.gen(addHogDep, hog, this);
      
    });
    
  },
  shut0: function(...args) { this.hogWobHold.shut(); },
})});

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
U.gain({ Hog, Wob, WobOne, WobVal, WobMemVal, WobMemSet, WobTmp, AccessPath, AggWobs });

