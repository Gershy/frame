// The "clearing" is javascript-level bootstrapping; top-level configuration
// and extension for increased functionality and consistency

Error.stackTraceLimit = Infinity;

let protoDef = (Cls, name, value) => Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });

let C = global.C = {
  skip: { SKIP: 1 },
  notImplemented: function() { throw Error(`Not implemented by ${U.nameOf(this)}`); },
  noFn: name => {
    let fn = function() { throw Error(`${U.nameOf(this)} does not implement "${name}"`); }
    fn['~noInspCollision'] = true;
    return fn;
  }
};

protoDef(Object, 'forEach', function(fn) { for (let k in this) fn(this[k], k); });
protoDef(Object, 'map', function(fn) {
  let ret = Object.assign({}, this);
  for (let k in ret) { let v = fn(ret[k], k); if (v !== C.skip) ret[k] = v; else delete ret[k]; }
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
  } else { // `props` is an Array of property names (Strings)
    let ret = {};
    for (let p of props) if (this.has(p)) ret[p] = this[p];
    return ret;
  }
});
protoDef(Object, 'splice', function(...props) { let p = this.slice(...props); for (let k in p) delete this[k]; return p; });
protoDef(Object, 'find', function(f) { // Returns [ VAL, KEY ]
  for (let k in this) if (f(this[k], k)) return [ this[k], k ];
  return null;
});
protoDef(Object, 'has', Object.prototype.hasOwnProperty);
protoDef(Object, 'isEmpty', function() { for (let k in this) return false; return true; });
protoDef(Object, 'gain', function(obj) {
  Object.assign(this, obj);
  for (let k in obj) if (obj[k] === C.skip) delete this[k];
  return this;
});
protoDef(Object, 'to', function(f) { return f(this); });

Array.fill = (n, f=()=>null) => { let a = new Array(n); for (let i = 0; i < n; i++) a[i] = f(i); return a; };
Array.combine = (...as) => [].concat(...as);
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
  return null; // TODO: Return empty array instead??
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
  let ret = this;
  while (ret.length < amt) ret = char + ret;
  return ret;
});
protoDef(String, 'padTail', function(amt, char=' ') {
  let ret = this;
  while (ret.length < amt) ret += char;
  return ret;
});
protoDef(String, 'upper', String.prototype.toUpperCase);
protoDef(String, 'lower', String.prototype.toLowerCase);
protoDef(String, 'crop', function(amtL=0, amtR=0) { return this.substr(amtL, this.length - amtR); });
protoDef(String, 'polish', function(c=null) {
  if (c === null) return this.trim();
  let [ ind0, ind1 ] = [ 0, this.length - 1 ];
  while (this[ind0] === c[0]) ind0++;
  while (this[ind1] === c[0]) ind1--;
  return this.substr(ind0, ind1 + 1);
});

let SetOrig = Set;
Set = global.Set = function Set(...args) { return new SetOrig(...args); };
Set.Native = SetOrig;
Set.prototype = SetOrig.prototype;
protoDef(SetOrig, 'toArr', function(fn) { // Iterator args: [ VAL, IND ]; returns VAL
  let ret = [], ind = 0;
  for (let v of this) { v = fn(v, ind++); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(SetOrig, 'find', function(f) { // Returns [ VAL, null ]
  for (let v of this) if (f(v)) return [ v ];
  return null;
});
protoDef(SetOrig, 'isEmpty', function() { return !this.size; });
protoDef(SetOrig, 'rem', SetOrig.prototype.delete);

let MapOrig = Map;
Map = global.Map = function Map(...args) { return new MapOrig(...args); };
Map.Native = MapOrig;
Map.prototype = MapOrig.prototype;
protoDef(MapOrig, 'toObj', function(fn) { // Iterator args: [ VAL, KEY ]; returns [ KEY, VAL ] pairs
  let ret = {};
  for (let [ k, v ] of this) { v = fn(v, k); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(MapOrig, 'toArr', function(fn) { // Iterator args: [ VAL, KEY ]; returns VALs
  let ret = [];
  for (let [ k, v ] of this) { v = fn(v, k); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(MapOrig, 'find', function(f) { // Returns [ VAL, KEY ]
  for (let [ k, v ] of this) if (f(v, k)) return [ v, k ];
  return null;
});
protoDef(MapOrig, 'isEmpty', function() { return !this.size; });
protoDef(MapOrig, 'rem', MapOrig.prototype.delete);

let PromiseOrig = Promise;
Promise = global.Promise = function Promise(...args) { return new PromiseOrig(...args); };
Promise.Native = PromiseOrig;
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
Promise.ext = () => {
  let rsv=null, rjc=null;
  let prm = Promise((rsv0, rjc0) => (rsv=rsv0, rjc=rjc0));
  return { rsv, rjc, prm };
};
protoDef(Promise, 'route', Promise.prototype.then);

protoDef(Error, 'update', function(msg, props=null) { this.message = U.isType(msg, String) ? msg : msg(this.message); return this; });

let U = global.U = {
  dbgCnt: name => {
    if (!U.has('dbgCntMap')) U.dbgCntMap = {};
    U.dbgCntMap[name] = U.dbgCntMap.has(name) ? U.dbgCntMap[name] + 1 : 0;
    return U.dbgCntMap[name];
  },
  dbgVar: obj => { for (let k in obj) console.log(k.upper(), obj[k]); },
  int32: Math.pow(2, 32),
  base62: n => {
    let pow = 0, amt = 1, next;
    while (true) { next = amt * 62; if (next > n) break; pow++; amt = next; }
    let amts = [];
    for (let p = pow; p >= 0; p--) {
      let amt = Math.pow(62, p), div = Math.floor(n / amt);
      n -= amt * div;
      if (div < 10)       amts.push(`${div}`);
      else if (div < 36)  amts.push(String.fromCharCode(97 + div - 10));
      else                amts.push(String.fromCharCode(65 + div - 36));
    }
    return amts.join('');
  },
  safe: (f1, f2=e=>e) => { try { return f1(); } catch(err) { return f2(err); } },
  toss: v => { throw v; },
  inspire: ({ name, insps={}, methods=()=>({}) }) => {
    
    let parInsps = insps;
    parInsps.forEach((ParInsp, k) => { if (!U.isType(ParInsp, Function)) throw Error(`Invalid Insp: "${k}"`); });
    
    let Insp = eval(`let Insp = function ${name}(...p) { /* ${name} */ return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p); }; Insp;`);
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a Set of all inspirations for `isInspiredBy` testing
    let inheritedInsps = [ Insp ];
    parInsps.forEach(ParInsp => inheritedInsps.gain(ParInsp.allInsps.toArr(v => v)));
    Insp.allInsps = Set(inheritedInsps);
    
    // Keep track of parent classes directly
    Insp.parents = insps;
    
    // Initialize prototype
    Insp.prototype = Object.create(null);
    
    // Resolve all SupInsps to their prototypes
    parInsps = parInsps.map(ParInsp => {
      // `protoDef` sets non-enumerable prototype properties
      // Iterate non-enumerable props with `Object.getOwnPropertyNames`
      let proto = ParInsp.prototype;
      let pNames = Object.getOwnPropertyNames(proto);
      return pNames.toObj(v => [ v, proto[v] ]);
    });
    
    // If `methods` is a function it becomes the result of its call
    if (U.isType(methods, Function)) methods = methods(parInsps, Insp);
    
    // Ensure we have valid "methods"
    if (!U.isType(methods, Object)) throw Error('Couldn\'t resolve "methods" to Object');
    
    // Ensure reserved property names haven't been used
    if (methods.has('constructor')) throw Error('Used reserved "constructor" key');
    
    // Collect all inherited methods
    let methodsByName = {};
    parInsps.forEach((inspProto, inspName) => {
      // Can`t do `inspProto.forEach` - `inspProto` is prototype-less!
      for (let [ methodName, method ] of Object.entries(inspProto)) {
        // `inspProto` contains a "constructor" property that needs to be skipped
        if (methodName === 'constructor') continue;
        if (method && method['~noInspCollision']) continue;
        if (!methodsByName.has(methodName)) methodsByName[methodName] = Set();
        methodsByName[methodName].add(method);
      }
    });
    
    // Collect all methods for this particular Insp
    for (let methodName in methods) {
      let method = methods[methodName];
      
      // All methods here are the single method of their name!
      // They may call inherited methods of the same name (or not)
      if (methodName[0] === '$')  Insp[methodName.slice(1)] = method;        // "$" = class-level property
      else                        methodsByName[methodName] = Set([ method ]); // Guaranteed to be singular
      
    }
    
    if (!methodsByName.has('init')) throw Error('No "init" method available');
    
    for (let methodName in methodsByName) {
      let methodsAtName = methodsByName[methodName];
      if (methodsAtName.size > 1) {
        throw Error(`Found ${methodsAtName.size} methods "${methodName}" for ${name}; declare a custom method`);
      }
      protoDef(Insp, methodName, methodsAtName.toArr(v=>v)[0]); // `methodsAtName.length` will certainly be `1`
    }
    
    protoDef(Insp, 'constructor', Insp);
    return Insp;
  },
  isType: (val, Cls) => {
    // Note: This is hopefully the *only* use of `!=` throughout Hut!
    // Falsy for `null` and `undefined`; truthy for `0`, `''`
    if (Cls && Cls.Native) Cls = Cls.Native;
    return val != null && (val.constructor === Cls || val === Cls);
  },
  isTypes: (val, ...Classes) => {
    for (let Cls of Classes) if (U.isType(val, Cls)) return true;
    return false;
  },
  isInspiredBy: (Insp1, Insp2) => {
    try {
      if (!U.isType(Insp1, Function)) Insp1 = Insp1.constructor;
      return Insp1.has('allInsps') && Insp1.allInsps.has(Insp2);
    } catch(err) { return false; }
  },
  nameOf: obj => { try { return obj.constructor.name; } catch(err) {} return String(obj); },
  inspOf: obj => { try { return obj.constructor; } catch(err) {} return null; },
  
  // TODO: "buildRoom" probably doesn't belong in `U`
  buildRoom: ({ name, innerRooms=[], build }) => {
    
    if (!U.isType(name, String)) throw Error(`Invalid name: ${U.nameOf(name)}`);
    if (U.rooms.has(name)) throw Error(`Tried to overwrite room "${name}"`);
    return U.rooms[name] = foundation => {
      
      if (!foundation) throw Error('Missing "foundation" param');
      let missingRoom = innerRooms.find(roomName => !U.rooms.has(roomName));
      if (missingRoom) throw Error(`Missing innerRoom: ${missingRoom[0]}`);
      
      return U.rooms[name] = {
        name,
        built: build(foundation, ...innerRooms.map(rn => U.rooms[rn].built))
      };
      
    };
    
  },
  
  setup: {}, // Gains items used for setup
  rooms: {}
};

let Drop = U.inspire({ name: 'Drop', methods: (insp, Insp) => ({
  init: function(drier=null, onceDry=null) {
    this.drier = drier; // `drier` may have "nozz", "isWet", "onceDry"
    if (onceDry) this.onceDry = onceDry;
  },
  isWet: function() {
    // If our drier setup tells us "isWet", use that; otherwise `true`
    return (this.drier && this.drier.has('isWet'))
      ? this.drier.isWet()
      : true;
  },
  isDry: function() { return !this.isWet(); },
  onceDry: function() {},
  dry: function() {
    if (this.isDry()) return;
    this.isWet = () => false;
    this.onceDry();
    if (this.drier && this.drier.has('onceDry')) this.drier.onceDry();
  },
  drierNozz: function() {
    if (!this.drier) throw Error('No "drier" available');
    if (!this.drier.has('nozz')) throw Error('No "drier.nozz" available');
    return this.drier.nozz;
  }
})});
let Nozz = U.inspire({ name: 'Nozz', methods: (insp, Insp) => ({
  init: function() {
    this.routes = Set();
  },
  route: function(routeFn) {
    this.routes.add(routeFn);
    this.newRoute(routeFn);
    return Drop(null, () => this.routes.rem(routeFn));
  },
  newRoute: function(routeFn) {},
  drip: function(...items) {
    
    // The idea for preventing Routes during a Drip from receiving that
    // drip: when intending to iterate over `this.routes` first take a
    // snapshot of these Routes. Then iterate over that snapshot, at 
    // each stage ensuring that each Route still exists in `this.routes`
    // 1 - Only Routes present before Drip receive drip
    // 2 - Routes which dry before Dripping still don't receive drip
    
    for (let routeFn of Set(this.routes)) if (this.routes.has(routeFn)) routeFn(...items);
  },
  block: function(doDrip, ...dripVals) {
    // Cause any new Routes to receive "newRoute" functionality, but not
    // to be held (and return a dry Drop in indication of this)
    this.route = routeFn => { this.newRoute(routeFn); return Drop({ isWet: () => false }); };
    
    // Keep track of our most recent set of Routes, and then clear our Routes
    let origRoutes = this.routes;
    this.routes = Set();
    
    // Do a final drip to our latest set of Routes if required
    if (doDrip) for (let routeFn of origRoutes) routeFn(...dripVals);
    
    // If we're an instance of Drop release any resources
    if (this.dry) this.dry();
  }
})});

let defDrier = (nozz=Nozz()) => {
  
  // Takes a Nozz to be the DrierNozz. Telling the associated Drop to
  // dry will cause the given Nozz to drip, and become blocked. It will
  // also cause the Nozz to always immediately drip into any new Routes
  // that are attempted to be attached. (These Routes won't be attached,
  // but the immediate drip will signal dryness to the implementation.)
  // Note that dripping from the Nozz does NOT cause the associated Drop
  // to dry. Call `Drop.prototype.dry()` as desired; it causes `nozz` to
  // drip. Never call `nozz.drip()` directly - it would NOT cause the
  // instance of Drop to dry.
  
  let dried = false;
  nozz.newHold = holdFn => dried && holdFn();
  nozz.desc = `Default Drier using ${U.nameOf(nozz)}`;
  let drier = { nozz, onceDry: () => {
    dried = false;
    drier.onceDry = () => {};
    nozz.block(true);
  }};
  return drier;
  
};

let Funnel = U.inspire({ name: 'Funnel', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(...nozzes) {
    insp.Drop.init.call(this);
    insp.Nozz.init.call(this);
    this.joinRoutes = Set();
    for (let nozz of nozzes) this.joinRoute(nozz);
  },
  joinRoute: function(nozz) {
    let joinRoute = nozz.route(this.drip.bind(this));
    this.joinRoutes.add(joinRoute);
    return joinRoute;
  },
  onceDry: function() { for (let jr in this.joinRoutes) jr.dry(); }
})});
let TubVal = U.inspire({ name: 'TubVal', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(drier, nozz, flt=null) {
    insp.Drop.init.call(this, drier);
    insp.Nozz.init.call(this);
    this.nozz = nozz;   // This Nozz is "above" the Tub - it flows into the Tub
    this.val = C.skip;  // `null` indicates the `null` will be Dripped. `C.skip` indicates no Drip
    this.itemDryRoute = null; // A Route to know if latest item goes Dry
    this.nozzRoute = this.nozz.route(item => {
      // If filter, replace `item` with filter result and ignore skips
      if (flt && (item = flt(item)) === C.skip) return;
      
      // Check to see if `item` is a Drop
      let itemIsDrop = U.isInspiredBy(item, Drop);
      if (itemIsDrop && item.isDry()) return; // Skip Dry Drops
      
      // Remove previous Item-Dry-Route if it exists
      if (this.itemDryRoute) throw Error('A value is already set');
      
      // If `item` is a Drop with a Drier-Nozz add additional Routes
      let itemDryNozz = itemIsDrop && item.drier && item.drier.nozz;
      if (itemDryNozz) {
        // Note that no drip occurs when `item` dries
        this.itemDryRoute = itemDryNozz.route(() => { this.itemDryRoute = null; this.val = C.skip; });
      }
      
      // Update our value
      this.val = item;
      if (this.val !== C.skip) this.drip(item);
    });
  },
  newRoute: function(routeFn) { if (this.val !== C.skip) routeFn(this.val); },
  dryContents: function() {
    if (this.val === C.skip) return;
    if (U.isInspiredBy(this.val, Drop)) this.val.dry();
    this.val = C.skip;
  },
  onceDry: function() {
    this.nozzRoute.dry();
    if (this.itemDryRoute) this.itemDryRoute.dry();
  }
})});
let TubSet = U.inspire({ name: 'TubSet', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(drier, nozz, flt=null) {
    insp.Drop.init.call(this, drier);
    insp.Nozz.init.call(this);
    this.nozz = nozz;
    this.set = Set();
    this.tubRoutes = Set();
    this.tubRoutes.add(this.nozz.route(item => {
      // If filter, replace `item` with filter result and ignore skips
      if (flt && (item = flt(item)) === C.skip) return;
      
      // Check to see if `item` is a Drop
      let itemIsDrop = U.isInspiredBy(item, Drop);
      if (itemIsDrop && item.isDry()) return;
      
      // If `item` is a Drop with a Drier-Nozz add additional Routes
      let itemDryNozz = itemIsDrop && item.drier && item.drier.nozz;
      if (itemDryNozz) {
        let itemDryRoute = itemDryNozz.route(() => { this.tubRoutes.rem(itemDryRoute); this.set.rem(item); });
        this.tubRoutes.add(itemDryRoute);
      }
      
      // Add `item` to our set
      this.set.add(item);
      this.drip(item);
    }));
  },
  newRoute: function(routeFn) { for (let val of this.set) routeFn(val); },
  dryContents: function() { for (let val of this.set) if (U.isInspiredBy(val, Drop)) val.dry(); },
  onceDry: function() { for (let tr of this.tubRoutes) tr.dry(); }
})});
let TubDry = U.inspire({ name: 'TubDry', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(drier, nozz) {
    insp.Drop.init.call(this, drier);
    insp.Nozz.init.call(this);
    this.nozz = nozz;
    
    let count = 0;
    this.drop = Drop(defDrier());
    this.drop.desc = `TubDry dryness-indicating Drop`;
    
    this.dropDryRoutes = Set();
    this.nozzRoute = this.nozz.route(drop => {
      
      if (!U.isInspiredBy(drop, Drop)) throw Error(`TubDry expected nozz to drip Drops - got ${U.nameOf(drop)}`);
      if (!drop.drier) throw Error('TubDry expects Drops to have "drier"');
      if (!drop.drier.nozz) throw Error('TubDry expects Drops to have "drier.nozz"');
      if (drop.isDry()) return;
      
      if (count === 0) this.drop.dry();
      count++;
      
      this.dropDryRoutes.add(drop.drier.nozz.route(() => {
        count--;
        if (count === 0) this.drip(this.drop = Drop(defDrier()));
        this.drop.desc = `From TubDry`;
      }));
      
    });
  },
  newRoute: function(routeFn) { if (this.drop.isWet()) routeFn(this.drop); },
  onceDry: function() {
    this.nozzRoute.dry();
    for (let dr of this.dropDryRoutes) dr.dry();
  }
})});
let TubCnt = U.inspire({ name: 'TubCnt', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(drier, nozz, flt=null) {
    insp.Drop.init.call(this, drier);
    insp.Nozz.init.call(this);
    this.nozz = nozz;
    this.count = 0;
    this.tubRoutes = Set();
    this.tubRoutes.add(this.nozz.route(item => {
      
      if (flt && (item = flt(item)) === C.skip) return;
      
      let itemIsDrop = U.isInspiredBy(item, Drop);
      if (itemIsDrop && item.isDry()) return;
      
      let itemDryNozz = itemIsDrop && item.drier && item.drier.nozz;
      if (itemDryNozz) {
        let itemDryRoute = itemDryNozz.route(() => { this.tubRoutes.rem(itemDryRoute); this.drip(--this.count); });
        this.tubRoutes.add(itemDryRoute);
      }
      
      this.drip(++this.count);
    }));
  },
  newRoute: function(routeFn) { routeFn(this.count); },
  onceDry: function() { for (let tr of this.tubRoutes) tr.dry(); }
})});
let CondNozz = U.inspire({ name: 'CondNozz', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
  init: function(nozzesObj, fn, initial=null) {
    insp.Drop.init.call(this);
    insp.Nozz.init.call(this);
    this.fn = fn;
    this.curVals = initial || nozzesObj.map(v => C.skip);
    this.nozzRoutes = nozzesObj.toArr((nozz, k) => nozz.route(val => {
      // Check for duplicate value. Objects can't be duplicates.
      //if (!U.isType(val, Object) && this.curVals[k] === val) return;
      this.curVals[k] = val;
      this.reevaluate();
    }));
    
    // Value is initially a dry Drop
    this.drop = null;
    
    this.reevaluate();
  },
  newRoute: function(routeFn) { if (this.drop) routeFn(this.drop); },
  reevaluate: function() {
    let result = this.fn(this.curVals, this);
    if (this.drop && result !== C.skip) return; // The Drop is appropriately wet
    if (!this.drop && result === C.skip) return; // The Drop is appropriately dry
    
    if (result !== C.skip) {
      this.drop = Drop(defDrier());
      this.drop.rawVals = this.curVals.map(v => v);
      this.drop.result = result;
      this.drip(this.drop);
    } else {
      this.drop.dry();
      this.drop = null;
    }
  },
  dryContents: function() {
    if (!this.drop) return;
    this.drop.dry();
    this.drop = null;
  },
  onceDry: function() {
    for (let r of this.nozzRoutes) r.dry();
  }
})});
let Scope = U.inspire({ name: 'Scope', insps: { Drop }, methods: (insp, Insp) => ({
  
  $addDep: (deps, dep) => { if (dep && dep.isWet()) deps.add(dep); return dep; },
  
  init: function(nozz, fn) {
    
    this.dryNozz = Funnel();
    insp.Drop.init.call(this, { nozz: TubVal(null, this.dryNozz), isWet: () => !!this.fn });
    
    this.fn = fn;
    this.nozzRoute = nozz.route(drop => {
      
      if (!U.isInspiredBy(drop, Drop)) throw Error(`Scope expects Drop - got ${U.nameOf(drop)}`);
      if (drop.isDry()) return;
      
      // Allow shorthand adding of Deps and SubScopes
      let deps = Set();
      let addDep = Insp.addDep.bind(null, deps);
      addDep.scp = (...args) => addDep(this.constructor.call(null, ...args));
      
      // Unscope if the Scope or Drop (assuming dryable Drop) dries
      let dropUnscopedNozz = Funnel(this.dryNozz);
      let drierNozz = drop.drier && drop.drier.has('nozz') && drop.drier.nozz;
      if (drierNozz) dropUnscopedNozz.joinRoute(drierNozz);
      deps.add(dropUnscopedNozz);
      
      // When Drop unscopes dry up all deps (Note: not the Drop itself!)
      dropUnscopedNozz.route(() => { for (let dep of deps) dep.dry(); });
      
      this.fn(drop, addDep);
      
    });
  },
  onceDry: function() {
    this.fn = null;
    this.nozzRoute.dry();
    this.dryNozz.drip();
  }
})});

U.water = { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, CondNozz, Scope, defDrier };
