// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

Error.stackTraceLimit = Infinity;

let protoDef = (Cls, name, value) => Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });

let C = global.C = {
  skip: { SKIP: 1 },
  BaseInsp: (() => {
    let BaseInsp = function BaseInsp() {};
    BaseInsp.prototype = Object.create(null);
    protoDef(BaseInsp, 'isInspiredBy', function(Insp0) { return this.constructor.allInsps.has(Insp0.uid); }); 
    protoDef(BaseInsp, 'inspReborn', function(cnsProps=[]) { return this.constructor.call(null, ...cnsProps); }); 
    protoDef(BaseInsp, 'inspClone', function(cnsProps=[], props={}) {
      return ({}).gain.call(this.inspReborn(cnsProps), { ...this, ...props });
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
    let map = props[0]; // Maps existingKey -> newKeyName
    let ret = {};
    for (let k in map) if (this.has(map[k])) ret[k] = this[map[k]];
    return ret;
  } else {
    let ret = {};
    for (let p of props) if (this.has(p)) ret[p] = this[p];
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
protoDef(Array, 'toObj', function(it) { // Iterator returns [ KEY, VAL ] pairs
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
protoDef(Array, 'isEmpty', function() { return !this.length; });
protoDef(Array, 'gain', function(arr2) { this.push(...arr2); return this; });
protoDef(Array, 'invert', function() {
  let ret = [];
  for (let i = this.length - 1; i >= 0; i--) ret.push(this[i]);
  return ret;
});

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
protoDef(String, 'polish', function(c=null) {
  if (c === null) return this.trim();
  let [ ind0, ind1 ] = [ 0, this.length - 1 ];
  while (this[ind0] === c[0]) ind0++;
  while (this[ind1] === c[0]) ind1--;
  return this.substr(ind0, ind1 + 1);
});

let SetOrig = Set;
Set = global.Set = function Set(...args) { return new SetOrig(...args); };
Set.prototype = SetOrig.prototype;
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
Map.prototype = MapOrig.prototype;
protoDef(MapOrig, 'toObj', function(fn) { // Iterator returns [ KEY, VAL ] pairs
  let ret = {};
  for (let [ k, v ] of this.entries()) { v = fn(v, k); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(MapOrig, 'toArr', function(fn) {
  let ret = [];
  for (let [ k, v ] of this.entries()) { v = fn(v, k); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(MapOrig, 'isEmpty', function() { return !this.size; });
protoDef(MapOrig, 'rem', MapOrig.prototype.delete);

let PromiseOrig = Promise;
Promise = global.Promise = function Promise(...args) { return new PromiseOrig(...args); };
Promise.prototype = PromiseOrig.prototype;
Promise.allArr = (...args) => PromiseOrig.all(...args);
Promise.allObj = async obj => {
  let result = await Promise.allArr(obj.toArr(v => v));
  let ind = 0;
  let ret = {};
  for (let k in obj) ret[k] = result[ind++];
  return ret;
};
Promise.resolve = PromiseOrig.resolve;
let U = global.U = {
  Obj: Object, Arr: Array, Str: String,
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
  safe: (f1, f2=e=>e) => { try { return f1(); } catch(err) { return f2(err); } },
  inspire: ({ name, insps={}, methods=()=>({}), statik={}, description='' }) => {
    
    let parInsps = insps;
    parInsps.forEach((ParInsp, k) => { if (!U.isType(ParInsp, Function)) throw new Error(`Invalid Insp: "${k}"`); });
    
    let Insp = eval(`let Insp = function ${name}(...p) { /* ${name} */ return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p); }; Insp;`);
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a Set of all inspirations for `isInspiredBy` testing
    let inheritedInsps = [ Insp ];
    parInsps.forEach(ParInsp => inheritedInsps.gain(ParInsp.allInsps.toArr(v => v)));
    Insp.allInsps = Set(inheritedInsps);
    
    // Initialize prototype
    Insp.prototype = Object.create(C.BaseInsp.prototype);
    
    // Resolve all SupInsps to their prototypes
    parInsps = parInsps.map(ParInsp => {
      // `protoDef` sets prototype properties, making them non-enumerable
      // Iterate non-enumerable props with `Object.getOwnPropertyNames`
      let proto = ParInsp.prototype;
      let pNames = Object.getOwnPropertyNames(proto);
      return pNames.toObj(v => [ v, proto[v] ]);
    });
    
    // If `methods` is a function it becomes the result of its own call
    if (U.isType(methods, Function)) methods = methods(parInsps, Insp);
    
    // Ensure we have valid "methods"
    if (!U.isType(methods, Object)) throw new Error('Couldn\'t resolve "methods" to Object');
    
    // Ensure reserved property names haven't been used
    if (methods.has('constructor')) throw new Error('Used reserved "constructor" key');
    
    // Collect all inherited methods
    let methodsByName = {};
    parInsps.forEach((inspProto, inspName) => {
      // Can`t do `inspProto.forEach` - `inspProto` is prototype-less!
      for (let [ methodName, method ] of Object.entries(inspProto)) {
        // `inspProto` contains a "constructor" property that needs to be skipped
        if (methodName === 'constructor') continue;
        if (!methodsByName.has(methodName)) methodsByName[methodName] = [];
        methodsByName[methodName].push(method);
      }
    });
    
    // Collect all methods for this particular Insp
    for (let methodName in methods) {
      let method = methods[methodName];
      
      // Dollar-sign indicates class-level property
      // All methods here are the single method of their name!
      // They may call inherited methods of the same name (or not)
      if (methodName[0] === '$')  Insp[methodName.crop(1, 0)] = method; 
      else                        methodsByName[methodName] = [ method ]; // Guaranteed to be singular
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
    try {
      if (!U.isType(Insp1, Function)) Insp1 = Insp1.constructor;
      return Insp1.has('allInsps') && Insp1.allInsps.has(Insp2);
    } catch(err) { return false; }
  },
  typeOf: obj => { try { return obj.constructor.name; } catch(err) {} return String(obj); },
  inspOf: obj => { try { return obj.constructor; } catch(err) {} return null; },
  
  buildRoom: ({ name, innerRooms=[], build }) => {
    
    return U.rooms[name] = () => {
      
      if (!U.isType(name, String)) throw new Error(`Invalid name: ${U.typeOf(name)}`);
      let missingRoom = innerRooms.find(roomName => !U.rooms.has(roomName));
      if (missingRoom) throw new Error(`Missing innerRoom: ${missingRoom[0]}`);
      
      return U.rooms[name] = {
        name,
        built: build(U.foundation, ...innerRooms.map(rn => U.rooms[rn].built))
      };
      
    };
    
  },
  
  setup: {}, // Gains items used for setup
  foundation: null,
  rooms: {}
};

let Hog = U.inspire({ name: 'Hog', methods: (insp, Insp) => ({
  init: function(shut=null) {
    this.shutWob0 = U.WobOne();
    if (shut) this.shut0 = shut; // Allow easy overwrite of "shut0" functionality
  },
  shutCondAny: function(...wobs) {
    if (this.shutAnyWobs) throw new Error('Already have a "shutCondAny" condition');
    
    let holds = Set();
    let fn = () => {
      if (!holds) return;
      let holds0 = holds;
      holds = null;
      holds0.forEach(h => h.shut());
      this.shut();
    };
    wobs.forEach(wob => holds.add(wob.hold(fn)));
    
    return Hog(() => holds.forEach(h => h.shut()));
  },
  isShut: function() { return !!this.didShut; },
  shut0: function() { /* nothing */ },
  shut: function(group=Set()) {
    if (group.has(this)) return; // Double-shut is excused!
    group.add(this);
    
    if (this.didShut) { console.log(U.foundation.formatError(this.didShut)); throw new Error('Second shut'); }
    this.didShut = new Error('First shut');
    this.shut0(group);
    this.shutWob0.wobble();
  },
  shutWob: function() { return this.shutWob0; }
})});

let Wob = U.inspire({ name: 'Wob', methods: (insp, Insp) => ({
  init: function() { this.holds = new Set(); },
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
    if (this.holds)     return insp.Wob.hold.call(this, holdFn);
    
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
  shut0: function(group=Set()) { if (this.wobHold) this.wobHold.shut(group); }
})});
let WobTmp = U.inspire({ name: 'WobTmp', insps: { Wob }, methods: (insp, Insp) => ({
  
  // Wob Temporary
  
  init: function(pos='up', value=null) {
    if (![ 'up', 'dn' ].has(pos)) throw new Error(`Param should be "up" or "dn"; got ${pos}`);
    insp.Wob.init.call(this);
    this.tmp = null;
    if (pos === 'up') this.up(value);
  },
  inverse: function() {
    
    // TODO: Need to test WobTmp.prototype.inverse
    
    if (!this.inverse0) {
      this.inverse0 = WobTmp(this.pos === 'up' ? 'dn' : 'up');
      this.inverse0.inverse0 = this;
      
      // Now, forever, wobbles on us have an inverse effect on `this.inverse0`
      this.hold(tmp => {
        this.inverse0.dn(); // Us going up puts our inverse down
        tmp.shutWob().hold(() => this.inverse0.up()); // TODO: Would pass `tmp.value` here if `this.inverse0` were initializable with a value
      });
      
    }
    return this.inverse0;
    
  },
  up: function(value=null) {
    if (this.tmp) throw new Error('Already up');
    this.tmp = Hog(() => { this.tmp = null; });
    this.tmp.value = value;
    this.wobble(this.tmp);
    return Hog(() => this.dn());
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

let WobSquad = U.inspire({ name: 'WobSquad', insps: {}, methods: (insp, Insp) => ({
  // Added Wobs have "toHolds" intercepted, and repurposed to collect a mapping of
  // all args going to all holds of the Wob.
  // Shut Wobs are simply collected.
  
  init: function() {
    this.wobs = new Set(); // Maps a `Wob` to its related WobItem
    this.shuts = new Set();
    
    this.err = new Error('');
    U.foundation.queueTask(() => {
      if (this.wobs) { this.err.message = 'INCOMPLETE AGG'; throw this.err; }
      delete this.err;
    });
  },
  wobble: function(rec, ...args) { this.addWob(rec); return rec.wobble(...args); },
  shut: function(rec) { this.shuts.add(rec); },
  addWob: function(wob) {
    
    if (this.wobs.has(wob)) return wob; // Allowed to add the same `wob` multiple times (with no effect)
    this.wobs.add(wob);
    
    // For each Wob there are many Holds. Each Hold may be contacted multiple times,
    // with different values each time. These values could be simple literals, or
    // could also be Hogs.
    
    wob.squadCnt = wob.squadCnt ? wob.squadCnt + 1 : 1;
    if (wob.squadCnt > 1) console.log(U.foundation.formatError(new Error('Multiple squads'))); // TODO: Bad?
    
    if (wob.squadCnt !== 1) return wob; // WobSquads past the first don't mask any functions
    
    let m = wob.squadMapHoldToArgsSet = Map();
    wob['toHold'] = (holdFn, ...args) => {
      // From the Wob, get a particular Hold, and add a set of arguments for it.
      if (!m.has(holdFn)) m.set(holdFn, Set());
      m.get(holdFn).add(args);
    };
    
    return wob;
  },
  complete: function(err=null) {
    
    let wobs = this.wobs;
    let shuts = this.shuts;
    this.wobs = null;
    this.shuts = null;
    
    // Catch up on buffered wobbles!
    for (let wob of wobs) {
      
      if (wob.squadCnt > 1) { wob.squadCnt--; return; } // There are still more WobSquad holding `wob`
      
      // Get reference to needed data, then clean up our "toHold" mask and other "squad*" props
      let holdsToArgsSet = err || wob.squadMapHoldToArgsSet;
      delete wob['toHold'];
      delete wob.squadCnt;
      delete wob.squadMapHoldToArgsSet;
      
      // In the case of an error skip calling any Holds!
      if (err) continue;
      
      // Call each Hold once for every set of arguments it is meant to be called with
      holdsToArgsSet.forEach((argsSet, holdFn) => argsSet.forEach(args => holdFn(...args)));
      
    }
    
    // Catch up on buffered shuts!
    if (!err) {
      let shutGroup = Set();
      for (let hog of shuts) hog.shut(shutGroup);
    }
    
  }
})});

let shutDependence = (dep, srcShutWobs) => {
  
  // Sets up a bunch of holds to implement shut dependence, such that
  // if any SrcHog shuts, `dep`, the TrgHog, will shut as well!
  // Note that setting up such a dependence creates many Hogs. Shutting
  // these Hogs can't be accomplished directly - this function returns
  // the SrcHog, and no explicit way of undoing the shut-dependence.
  // It may sound workable to add an extra Hog into `srcShutWobs`, and
  // shut it when the dependence should be undone - but note this will
  // also shut `dep`! At the moment there is no way to remove the
  // dependence without shutting `dep`.
  
  // Note that our SrcShuts aren't a list of Hogs, but rather Wobs -
  // which can be produced via `theHog.shutWob()`. This gives us more
  // freedom - we can pass Wobs that aren't specifically ShutWobs, and
  // tie `dep`'s dependence to these Wobs as well!
  
  if (!dep.shutWob) throw new Error(`Invalid "dep": ${U.typeOf(dep)}`);
  if (srcShutWobs.find(w => !w.hold)) throw new Error(`Invalid srcShutWobs: [ ${srcShutWobs.map(U.typeOf).join(', ')} ]`);
  
  // A set of all SrcHolds which will cause `dep` (the TrgHold) to shut
  let srcShutCauseDepShutHolds = null;
  
  // When Dep shuts immediately stop holding
  let depShutFirstWob = dep.shutWob().hold(() => {
    let holdsToDrop = srcShutCauseDepShutHolds;
    srcShutCauseDepShutHolds = null;
    
    // Shut every non-null src hold
    let shutGroup = Set();
    holdsToDrop.forEach(hold => hold && hold.shut(shutGroup));
  });
  
  // It's possible that `dep.shutWob()` has wobbled before any
  // `srcShutCauseDepShutHolds` are initialized.
  if (!srcShutCauseDepShutHolds) {
    // If the HorzScope or Hog shut, immediately shut all src holds!
    // Note that shutting `dep` will cause all such holds to be dropped
    
    srcShutCauseDepShutHolds = [];
    for (let srcShut of srcShutWobs) {
      if (!srcShutCauseDepShutHolds) break; // Cut short if everything has shut
      srcShutCauseDepShutHolds.push(srcShut.hold((...args) => dep.shut(...args)));
    }
  }
  
  return dep;
  
};

let HorzScope = U.inspire({ name: 'HorzScope', insps: { Hog }, methods: (insp, Insp) => ({
  init: function(hogWob, gen=null, dbg=false) {
    insp.Hog.init.call(this);
    
    this.gen = gen;
    this.hogWobHold = null;
    this.open(hogWob);
  },
  open: function(hogWob) {
    
    this.hogWobHold = hogWob.hold(hog => {
      
      // If somehow an already-shut Hog is wobbled, ignore it. This can
      // happen when using WobSquads, for example!
      if (hog.isShut()) return;
      
      // Whatever the user passes as a Dep will be tied to `hog`
      let addHogDep = dep => { shutDependence(dep, [ hog.shutWob(), this.shutWob() ]); return dep; };
      this.gen(addHogDep, hog, this);
      
    });
    
  },
  shut0: function(group=Set()) { this.hogWobHold.shut(group); },
})});
let VertScope = U.inspire({ name: 'VertScope', insps: { Wob, Hog }, methods: (insp, Insp) => ({
  init: function(wob=null) {
    insp.Wob.init.call(this);
    insp.Hog.init.call(this);
    this.genSubWob = null;
    this.children = Set();  // All our sub-states
  },
  trackWob: function(wob, depHog=null, path=[]) { // TODO: Consider adding an "squad" param?
    
    // `wob` is a Rec wobbled by our mainWob
    
    if (wob.isShut()) return; // Skip Wobs which are somehow already shut
    
    // `trackHog` lives so long as this `VertScope` is tracking `wob`
    let trackHog = Hog();
    let deps = [ this.shutWob(), wob.shutWob() ];
    if (depHog) deps.push(depHog.shutWob());
    shutDependence(trackHog, deps);
    
    let addHogDep = dep => { shutDependence(dep, [ trackHog.shutWob() ]); return dep; };
    let fullPath = [ wob, ...path ];
    this.wobble(addHogDep, fullPath);
    
    this.children.forEach(child => {
      
      // Generate some new `Wob` derived from `Wob`
      let relWob = child.genSubWob(wob);
      
      // Wobble `tWobs` ("TrackWobs") when `relWob` wobbles!
      // Derived Wobs wobble "TrackWobs". All the VertScope's children
      // are informed of a new TrackWob.
      let holdRelWob = relWob.hold(tWob => child.trackWob(tWob, trackHog, fullPath));
      shutDependence(holdRelWob, [ trackHog.shutWob() ]);
      
    });
    
  },
  dive: function(genSubWob) {
    let childVertScope = VertScope();
    childVertScope.genSubWob = genSubWob;
    this.children.add(childVertScope);
    return childVertScope;
  },
  shut0: function(...args) { this.children.forEach(child => child.shut(...args)); }
})});

U.gain({ Hog, Wob, WobOne, WobVal, WobMemVal, WobMemSet, WobTmp, HorzScope, VertScope, WobSquad });
