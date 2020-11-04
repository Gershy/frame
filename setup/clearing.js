// The "clearing" is javascript-level bootstrapping

Error.stackTraceLimit = 200;

let C = global.C = {
  skip: undefined,
  notImplemented: function() { throw Error(`Not implemented by ${U.nameOf(this)}`); },
  noFn: name => {
    let fn = function() { throw Error(`${U.nameOf(this)} does not implement "${name}"`); }
    fn['~noInspCollision'] = true;
    return fn;
  }
};
let protoDef = (Cls, name, value) => {
  Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });
  
  // Note that these properties should not be available on `global`! If
  // they were available, typos resulting in `protoDef` names resolve to
  // unexpected values, instead of `C.skip`.
  if (Cls === global.constructor) global[name] = C.skip;
};

protoDef(Object, 'forEach', function(fn) { for (let k in this) fn(this[k], k); });
protoDef(Object, 'each', function(fn) { for (let k in this) fn(this[k], k); });
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
    let ret = {}; for (let k in map) if (this.has(map[k])) ret[k] = this[map[k]]; return ret;
  } else { // `props` is an Array of property names (Strings)
    let ret = {}; for (let p of props) if (this.has(p)) ret[p] = this[p]; return ret;
  }
});
protoDef(Object, 'splice', function(...props) { let p = this.slice(...props); for (let k in p) delete this[k]; return p; });
protoDef(Object, 'find', function(f) { // Iterator: (val, key) => bool; returns { found, val, key }
  for (let k in this) if (f(this[k], k)) return { found: true, val: this[k], key: k };
  return { found: false, val: null, k: null };
});
protoDef(Object, 'has', Object.prototype.hasOwnProperty);
protoDef(Object, 'isEmpty', function() { for (let k in this) return false; return true; });
protoDef(Object, 'gain', function(obj) {
  Object.assign(this, obj);
  for (let k in obj) if (obj[k] === C.skip) delete this[k];
  return this;
});
protoDef(Object, 'to', function(f) { return f(this); });
protoDef(Object, 'seek', function(keys) { // Returns { found: bool, val }
  let ret = this;
  if (U.isType(keys, String)) keys = keys.split('.');
  for (let key of keys) { if (!ret || !ret.has(key)) return { found: false, val: null }; ret = ret[key]; }
  return { found: true, val: ret };
});
protoDef(Object, Symbol.iterator, function*() { // Iterate [ key, val ]
  for (let k in this) yield [ k, this[k] ];
});

Array.fill = (n, f=()=>null) => { let a = new Array(n); for (let i = 0; i < n; i++) a[i] = f(i); return a; };
Array.combine = (...as) => [].concat(...as);
protoDef(Array, 'each', Array.prototype.forEach);
protoDef(Array, 'map', function(it) {
  let ret = [];
  for (let i = 0, len = this.length; i < len; i++) {
    let v = it(this[i], i);
    if (v !== C.skip) ret.push(v);
  }
  return ret;
});
protoDef(Array, 'toObj', function(it) { // Iterator: (val, ind) => [ key0, val0 ]
  let ret = {};
  for (let i = 0, len = this.length; i < len; i++) { let v = it(this[i], i); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(Array, 'find', function(f) { // Iterator: (val, ind) => bool; returns { found, val, ind }
  for (let i = 0, len = this.length; i < len; i++) if (f(this[i], i)) return { found: true, val: this[i], ind: i };
  return { found: false, val: null, ind: null };
});
protoDef(Array, 'has', function(v) { return this.indexOf(v) >= 0; });
protoDef(Array, 'isEmpty', function() { return !this.length; });
protoDef(Array, 'add', Array.prototype.push);
protoDef(Array, 'gain', function(arr2) { this.push(...arr2); return this; });
protoDef(Array, 'count', function() { return this.length; });
protoDef(Array, 'invert', function() { let r = []; for (let i = this.length - 1; i >= 0; i--) r.push(this[i]); return r; });

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
protoDef(String, 'code', function(ind=0) { return this.charCodeAt(0); });
protoDef(String, 'count', function() { return this.length; });
protoDef(String, 'indent', function(amt=2, char=' ', indentStr=char[0].repeat(amt)) {
  return this.split('\n').map(ln => `${indentStr}${ln}`).join('\n');
});

protoDef(Number, 'char', function() { return String.fromCharCode(this); });
protoDef(Number, 'each', function(fn) { for (let i = 0; i < this; i++) fn(i); });
protoDef(Number, 'toArr', function(fn) { let arr = Array(this); for (let i = 0; i < this; i++) arr[i] = fn(i); return arr; });
protoDef(Number, 'toObj', function(fn) { let o = {}; for (let i = 0; i < this; i++) { let [ k, v ] = fn(i); o[k] = v; } return p; });

let SetOrig = Set;
Set = global.Set = function Set(...args) { return new SetOrig(...args); };
Set.Native = SetOrig;
Set.prototype = SetOrig.prototype;
protoDef(SetOrig, 'toArr', function(fn) { // Iterator: (val, ind) => val0
  let ret = [], ind = 0;
  for (let v of this) { v = fn(v, ind++); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(SetOrig, 'toObj', function(fn) {
  let ret = {};
  for (let v of this) { v = fn(v); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(SetOrig, 'each', SetOrig.prototype.forEach);
protoDef(SetOrig, 'find', function(f) { // Iterator: (val) => bool; returns { found, val }
  for (let v of this) if (f(v)) return { found: true, val: v };
  return { found: false, val: null };
});
protoDef(SetOrig, 'count', function() { return this.size; });
protoDef(SetOrig, 'isEmpty', function() { return !this.size; });
protoDef(SetOrig, 'rem', SetOrig.prototype.delete);

let MapOrig = Map;
Map = global.Map = function Map(...args) { return new MapOrig(...args); };
Map.Native = MapOrig;
Map.prototype = MapOrig.prototype;
protoDef(MapOrig, 'toObj', function(fn) { // Iterator: (val, key) => [ key0, val0 ]
  let ret = {};
  for (let [ k, v ] of this) { v = fn(v, k); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});
protoDef(MapOrig, 'toArr', function(fn) { // Iterator: (val, key) => val0
  let ret = [];
  for (let [ k, v ] of this) { v = fn(v, k); if (v !== C.skip) ret.push(v); }
  return ret;
});
protoDef(MapOrig, 'each', MapOrig.prototype.forEach);
protoDef(MapOrig, 'find', function(f) { // Iterator: (val, key) => bool; returns { found, val, key }
  for (let [ k, v ] of this) if (f(v, k)) return { found: true, val: v, key: k };
  return { found: false, val: null, key: null };
});
protoDef(MapOrig, 'count', function() { return this.size; });
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
Promise.defer = () => {
  let resolve = null, reject = null;
  let prm = Promise((rsv, rjc) => [ resolve, reject ] = [ rsv, rjc ]);
  prm.resolve = resolve;
  prm.reject = reject;
  return prm;
};
Promise.ext = () => {
  let rsv=null, rjc=null;
  let prm = Promise((rsv0, rjc0) => (rsv=rsv0, rjc=rjc0));
  return { rsv, rjc, prm };
};
protoDef(Promise, 'route', Promise.prototype.then);

protoDef(Error, 'update', function(msg, props=null) { this.message = U.isType(msg, String) ? msg : msg(this.message); return this; });

Function.stub = () => {};
Set.stub = { count: () => 0, add: Function.stub, rem: Function.stub, has: Function.stub };
Map.stub = { count: () => 0, set: Function.stub, rem: Function.stub, has: Function.stub };

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
    
    let fName = name.replace(/[.]/g, '$');
    let Insp = eval(`let Insp = function ${fName}(...p) { /* ${name} */ return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p); }; Insp;`);
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a Set of all inspirations for `isInspiredBy` testing
    Insp.allInsps = Set([ Insp ]);
    parInsps.each(({ allInsps }) => allInsps.each(SubInsp => Insp.allInsps.add(SubInsp)));
    
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
    parInsps.all = (methodName, workFn) => {
      let methods = parInsps.toArr(proto => proto.has(methodName) ? proto[methodName] : C.skip);
      return function(...args) {
        for (let m of methods) m.call(this, ...args);
        if (workFn) return workFn(...args);
      };
    };
    parInsps.allArr = (methodName, workFn) => {
      let methods = parInsps.toArr(proto => proto.has(methodName) ? proto[methodName] : C.skip);
      return function(...args) { return workFn(this, methods.map(m => m.call(this, ...args)), ...args); };
    };
    
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
    
    parInsps[name] = {};
    for (let methodName in methodsByName) {
      let methodsAtName = methodsByName[methodName].toArr(v => (v && v['~noInspCollision']) ? C.skip : v);
      if (methodsAtName.length > 1) {
        throw Error(`Found ${methodsAtName.length} methods "${methodName}" for ${name}; declare a custom method`);
      }
      let fn = methodsAtName.length ? methodsAtName[0] : C.noFn(methodName);
      parInsps[name][methodName] = fn;
      protoDef(Insp, methodName.hasHead('Symbol.') ? Symbol[methodName.slice(7)] : methodName, fn);
    }
    
    protoDef(Insp, 'constructor', Insp);
    return Insp;
  },
  isType: (val, Cls) => {
    // Note: This is hopefully the *only* use of `==` throughout Hut!
    // Falsy only for unboxed values (`null` and `undefined`)
    if (Cls && Cls.Native) Cls = Cls.Native;
    if (val == null || val.constructor !== Cls) return false;
    if (Cls === Number && val === NaN) return false;
    return true;
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
  multilineString: str => {
    
    let lines = str.split('\n').map(ln => ln.replace(/\r/g, ''));
    
    // Trim any leading empty lines
    while (lines.length && !lines[0].trim()) lines = lines.slice(1);
    
    // Count leading whitespace chars on first line with content
    let initSpace = 0;
    while (lines[0][initSpace].match(/\s/)) initSpace++;
    
    return lines.map(ln => ln.slice(initSpace)).join('\n').trimEnd(); // TODO: "trimTail" would be more consistent
    
  },
  
  buildRoom: ({ name, innerRooms=[], build }) => {
    
    global.rooms[name] = async foundation => {
      if (!foundation) throw Error('Missing "foundation" param');
      let innerRoomContents = await Promise.allArr(innerRooms.map(rn => foundation.getRoom(rn)));
      return build(foundation, innerRoomContents);
    };
    
  },
  
  setup: {}, // Gains items used for setup
  rooms: {}
};
global.rooms = {};

U.logic = (() => {
  
  let Endable = U.inspire({ name: 'Endable', methods: (insp, Insp) => ({
    
    $globalRegistry: 0 ? Set.stub : Set(),
    
    init: function(fn) {
      // Allow Endable.prototype.cleanup to be masked
      if (fn) this.cleanup = fn;
      Insp.globalRegistry.add(this);
    },
    onn: function() { return true; },
    off: function() { return !this.onn(); },
    cleanup: function() {},
    end: function(...args) {
      if (this.off()) return false;
      this.onn = () => false;
      Insp.globalRegistry.rem(this);
      this.cleanup(...args);
      return true;
    }
  })});
  let Src = U.inspire({ name: 'Src', methods: (insp, Insp) => ({
    init: function() { this.fns = Set(); },
    newRoute: function(fn) {},
    route: function(fn, mode='tmp') {
      if (!(fn instanceof Function)) throw Error(`Can't route to a ${U.nameOf(fn)}`);
      if (this.fns.has(fn)) return; // Ignore duplicates
      this.fns.add(fn);
      this.newRoute(fn);
      if (mode === 'tmp') return Tmp(() => this.fns.rem(fn));
    },
    send: function(...args) {
      
      // Behaviour is much better when "addRoute-while-send" does not
      // result in the route being called **from Src.prototype.send**
      // (note it may be called from, e.g., "newRoute"). So when "send"
      // is called our goal is to iterate a snapshot of `this.fns`. Note
      // that while "addRoute-while-send" cases should effectively be
      // ignored, "remRoute-while-send" should *not* be ignored. So for
      // each route in the snapshot, when the time comes to call that
      // route we need to ensure it still exists within `this.fns`.
      
      for (let fn of [ ...this.fns ]) if (this.fns.has(fn)) fn(...args);
      
    }
  })});
  let Tmp = U.inspire({ name: 'Tmp', insps: { Endable, Src }, methods: (insp, Insp) => ({
    
    $nullFns: { add: ()=>{}, rem: ()=>{} },
    $endedTmp: () => {
      let tmp = Insp(); tmp.end();
      Insp.endedTmp = () => tmp;
      return Insp.endedTmp();
    },
    
    init: function(fn=null) {
      insp.Src.init.call(this);
      insp.Endable.init.call(this);
      if (fn) this.route(fn, 'prm');
    },
    ref: function() { return this; },
    end: function(...args) { return this.sendAndEnd(...args); },
    send: function(...args) { return this.sendAndEnd(...args); },
    sendAndEnd: function(...args) {
      // Sending and ending are synonymous for a Tmp
      if (!insp.Endable.end.call(this)) return; // Check if we're already ended
      insp.Src.send.call(this, ...args);
      this.fns = Insp.nullFns;
      return;
    },
    newRoute: function(fn) { if (this.off()) fn(); },
    endWith: function(val, mode='prm') {
      if (val != null && val instanceof Function) return this.route(val, mode) || this;
      if (U.isInspiredBy(val, Endable)) return this.route((...args) => val.end(...args), mode) || this;
      throw Error(`Can't end with a value of type ${U.nameOf(val)}`);
    }
  })});
  let TmpAll = U.inspire({ name: 'TmpAll', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(tmps) {
      insp.Tmp.init.call(this);
      let fn = this.end.bind(this);
      this.routes = tmps.map(tmp => {
        let route = tmp.route(fn);
        this.endWith(route);
        return route;
      });
    },
    cleanup: function() { for (let r of this.routes) r.end(); }
  })});
  let TmpAny = U.inspire({ name: 'TmpAny', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(tmps) {
      insp.Tmp.init.call(this);
      let cnt = tmps.length;
      let endFn = () => (--cnt > 0) || this.end();
      for (let tmp of tmps) this.endWith(tmp.route(endFn));
    }
  })});
  
  let MemSrc = U.inspire({ name: 'MemSrc', insps: { Endable, Src }, methods: (insp, Insp) => ({
    init: function() {
      if (U.isType(this, MemSrc)) throw Error(`Don't init the parent MemSrc class!`);
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
    },
    retain: C.noFn('retain')
  })});
  MemSrc.Prm1 = U.inspire({ name: 'MemSrc.Prm1', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(val=C.skip) { insp.MemSrc.init.call(this); this.val = val; },
    newRoute: function(fn) { if (this.val !== C.skip) fn(this.val); },
    retain: function(val) { if (val === this.val) return; this.val = val; if (this.val !== C.skip) this.send(val); },
    cleanup: function() { this.val = C.skip; }
  })});
  MemSrc.PrmM = U.inspire({ name: 'MemSrc.PrmM', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function() { insp.MemSrc.init.call(this); this.vals = []; },
    count: function() { return this.vals.count(); },
    retain: function(val) { this.vals.push(val); this.send(val); },
    newRoute: function(fn) { for (let val of this.vals) fn(val); },
    cleanup: function() { this.vals = []; }
  })});
  MemSrc.Tmp1 = U.inspire({ name: 'MemSrc.Tmp1', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(val) {
      insp.MemSrc.init.call(this);
      this.valEndRoute = null;
      this.val = null;
    },
    retain: function(tmp) {
      
      if (tmp.off()) return; // Don't bother with inactive Tmps
      
      if (this.val === tmp) return; // Ignore duplicates;
      this.val = tmp;
      this.valEndRoute = tmp.route(() => this.val = this.valEndRoute = null);
      this.send(tmp);
      
    },
    newRoute: function(fn) { if (this.val) fn(this.val); },
    cleanup: function() { this.valEndRoute && this.valEndRoute.end(); this.val = this.valEndRoute = null; }
  })});
  MemSrc.TmpM = U.inspire({ name: 'MemSrc.TmpM', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function() {
      insp.MemSrc.init.call(this);
      this.valEndRoutes = Map();
      this.vals = Set();
      this.counter = null;
    },
    count: function() { return this.vals.count(); },
    getCounterSrc: function() {
      if (!this.counter) this.counter = MemSrc.Prm1(this.vals.count());
      return this.counter;
    },
    retain: function(tmp) {
      if (tmp.off()) return; // Ignore inactive Tmps
      if (this.vals.has(tmp)) return; // Ignore duplicates
      
      this.vals.add(tmp);
      this.counter && this.counter.retain(this.vals.count());
      
      this.valEndRoutes.set(tmp, tmp.route(() => {
        this.vals.rem(tmp);
        this.valEndRoutes.rem(tmp);
        this.counter && this.counter.retain(this.vals.count());
      }));
      
      this.send(tmp);
    },
    newRoute: function(fn) { for (let val of this.vals) fn(val); },
    cleanup: function() {
      for (let [ , route ] of this.valEndRoutes) route.end();
      this.vals = Set();
      this.valEndRoutes = Map();
    }
  })});

  let FilterSrc = U.inspire({ name: 'FilterSrc', insps: { Endable, Src }, methods: (insp, Insp) => ({
    init: function(src, fn) {
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
      this.src = src;
      this.srcRoute = src.route((...vals) => fn(...vals) && this.send(...vals));
    },
    cleanup: function() { this.srcRoute.end(); }
  })});
  let FnSrc = U.inspire({ name: 'FnSrc', insps: { Endable, Src }, methods: (insp, Insp) => ({
    init: function(srcs, fn) {
      if (U.isType(this, FnSrc)) throw Error(`Don't init the parent FnSrc class!`);
      
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
      
      let vals = srcs.map(v => C.skip);
      this.routes = srcs.map((src, ind) => src.route(val => {
        vals[ind] = val;
        let result = this.applyFn(fn, vals);
        if (result !== C.skip) this.send(result);
      }));
    },
    applyFn: C.noFn('applyFn', (fn, vals) => 'valToSend'),
    cleanup: function() { for (let r of this.routes) r.end(); }
  })});
  FnSrc.Prm1 = U.inspire({ name: 'FnSrc.Prm1', insps: { FnSrc }, methods: (insp, Insp) => ({
    init: function(...args) {
      this.lastResult = C.skip;
      insp.FnSrc.init.call(this, ...args);
    },
    newRoute: function(fn) { if (this.lastResult !== C.skip) fn(this.lastResult); },
    applyFn: function(fn, vals) {
      let result = fn(...vals);
      return (result === this.lastResult) ? C.skip : (this.lastResult = result);
    }
  })});
  FnSrc.PrmM = U.inspire({ name: 'FnSrc.PrmM', insps: { FnSrc }, methods: (insp, Insp) => ({
    applyFn: function(fn, vals) { return fn(...vals); }
  })});
  FnSrc.Tmp1 = U.inspire({ name: 'FnSrc.Tmp1', insps: { FnSrc }, methods: (insp, Insp) => ({
    init: function(...params) { this.lastResult = C.skip; insp.FnSrc.init.call(this, ...params); },
    newRoute: function(fn) { if (this.lastResult !== C.skip) fn(this.lastResult); },
    applyFn: function(fn, vals) {
      // Call function; ignore `C.skip`
      let result = fn(...vals, this.lastResult);
      if (result === this.lastResult) return C.skip;
      
      // End any previous result; remember result and return it!
      if (this.lastResult) this.lastResult.end();
      return this.lastResult = result;
    },
    cleanup: function() { insp.FnSrc.cleanup.call(this); this.lastResult && this.lastResult.end(); }
  })});
  FnSrc.TmpM = U.inspire({ name: 'FnSrc.TmpM', insps: { FnSrc }, methods: (insp, Insp) => ({
    // Interestingly, FnSrc.TmpM behaves exactly like FnSrc.PrmM! `fn`
    // is expected to return Tmp instances (or C.skip), but this class
    // takes no responsibility for ending these Tmps - this is because
    // there are no restrictions on how many Tmps may exist in parallel!
    applyFn: function(fn, vals) { return fn(...vals); }
  })});
  
  // TODO: What about something with a ref count; e.g. it can be
  // initiated multiple times, and can withstand a call to `end` for
  // each time it has been initiated past the first? An implementation
  // could look like:
  //      |     U.inspire({ name: '...', methods: (insp, Insp) => ({
  //      |       
  //      |       init: function() { this.watcher = Tmp.endedTmp(); },
  //      |       actuallyCreateWatcher: function() {
  //      |       
  //      |         // Arbitrary; return, MemSrc.Tmp1, FnSrc.TmpM, it
  //      |         // doesn't matter!
  //      |         return someKindOfWatcher();
  //      |         
  //      |       },
  //      |       getWatcher: function() {
  //      |         
  //      |         if (this.watcher.off()) {
  //      |           // I can't immediately see how to do this without
  //      |           // supplying a list of exposed fields.
  //      |           // RefCountWatcher.prototype.ref needs to return
  //      |           // an object that behaves exactly like the value
  //      |           // `this.actuallyCreateWatcher()`, but with an
  //      |           // `end` method that only ends the underlying
  //      |           // object if the RefCount drops to 0. Note it's
  //      |           // important to indicate which exposed fields are
  //      |           // functions since they'll need to be bound.
  //      |           this.watcher = RefCountWatcher(this.actuallyCreateWatcher(), [ 'src', 'cleanup()' ]);
  //      |         }
  //      |         return this.watcher.ref();
  //      |         
  //      |       }
  //      |     })});
  
  let Chooser = U.inspire({ name: 'Chooser', insps: { Endable, Src }, methods: (insp, Insp) => ({
    init: function(names, src=null) {
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
      
      if (U.isInspiredBy(names, Src)) [ src, names ] = [ names, [ 'off', 'onn' ] ];
      
      this.activeSrcName = names[0];
      this.srcs = names.toObj(n => [ n, MemSrc.Tmp1() ]);
      this.srcs[this.activeSrcName].retain(Tmp());
      
      if (src) {
        if (names.count() !== 2) throw Error(`Chooser requires exactly 2 names when used with a Src; got ${names.count()}: ${names.join(', ')}`);
        let [ nOff, nOnn ] = names;
        this.srcRoute = Scope(src, (tmp, dep) => {
          
          // Consider `Chooser(src); src.send(Tmp()); src.send(Tmp());`.
          // In this situation a 2nd Tmp is sent before the 1st one
          // expires. This means that `this.activeSrcName` will not
          // toggle to "off", but rather remain the same, for the
          // upcoming call `this.choose(nOnn, tmp)`. But because
          // `Chooser.prototype.choose` ignores any duplicate choices,
          // the newly retained Tmp will be completely ignored, and
          // never be produced external to the Chooser. For this reason
          // if we're already in an "onn" state and we are routed
          // another Tmp we first toggle to "off" before choosing "onn"
          // once again.
          if (this.activeSrcName === nOnn) {
            
            // Ignore duplicate values
            if (this.srcs[this.activeSrcName].val === tmp) return;
            
            // Toggle off so that this new value can retrigger onn
            this.choose(nOff);
            
          }
          
          this.choose(nOnn, tmp);
          dep(() => this.choose(nOff));
          
        });
      }
      
    },
    newRoute: function(fn) { if (this.onn()) fn(this.activeSrcName); },
    choose: function(name, tmp=null) {
      if (!this.srcs.has(name)) throw Error(`Invalid choice name: "${name}"`);
      
      // Prevent duplicate choices from producing multiple sends. If
      // this isn't a duplicate send, immediately set the newly active
      // name, to "lock the door behind us".
      if (name === this.activeSrcName) return;
      let prevSrcName = this.activeSrcName;
      this.activeSrcName = name;
      
      // End any previous Src val
      // Note that if `val` is ended externally, the `MemSrc.Tmp1` that
      // stored it may have already set its own `val` to `null`. If this
      // is the case, the `MemSrc.Tmp1` is already taken care of ending
      // `val`, so all is good - we just need to check for nullness
      this.srcs[prevSrcName].val && this.srcs[prevSrcName].val.end();
      
      // Send new val to newly chosen Src
      this.srcs[this.activeSrcName].retain(tmp || Tmp());
      
      // The Chooser itself also sends the currently active name
      this.send(this.activeSrcName);
    },
    cleanup: function() {
      if (this.srcRoute) this.srcRoute.end();
      this.srcs[this.activeSrcName].val.end();
    }
  })});
  let Scope = U.inspire({ name: 'Scope', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(src, fn) {
      
      insp.Tmp.init.call(this);
      this.fn = fn;
      this.srcRoute = src.route(tmp => {
        
        if (!U.isInspiredBy(tmp, Tmp)) throw Error(`Scope expects Tmp - got ${U.nameOf(tmp)}`);
        if (tmp.off()) return;
        
        // Define `addDep` and `addDep.scp` to enable nice shorthand
        let deps = Set();
        let addDep = dep => {
          
          // Allow raw functions; wrap them in `Endable`
          if (U.isType(dep, Function)) dep = Endable(dep);
          
          if (deps.has(dep)) return; // Ignore duplicates
          if (dep.off()) return; // Ignore any inactive Deps
          
          // `deps` no longer existing requires all Deps to end
          if (!deps) return dep.end();
          
          if (U.isInspiredBy(dep, Tmp)) {
            // Note `deps` falsiness check; `deps` may be set to `null`
            let remDep = dep.route(() => deps && (deps.rem(dep), deps.rem(remDep)));
            deps.add(remDep);
          }
          
          deps.add(dep);
          
          return dep;
          
        };
        addDep.scp = (...args) => addDep(this.subScope(...args));
        
        // If either `tmp` or this Scope ends, all existing dependencies
        // end as well. This relationship is itself a dependency
        let depsEndTmp = TmpAll([ this, tmp ]);
        depsEndTmp.endWith((...args) => { let deps0 = deps; deps = null; deps0.each(d => d.end(...args)); });
        addDep(depsEndTmp);
        
        this.processTmp(tmp, addDep);
        
      });
      
    },
    processTmp: function(tmp, dep) { this.fn(tmp, dep); },
    subScope: function(...args) { return this.constructor.call(null, ...args); },
    cleanup: function() { this.srcRoute.end(); }
  })});
  let Slots = U.inspire({ name: 'Slots', methods: (insp, Insp) => ({
    
    $tryAccess: (v, p) => { try { return v.access(p); } catch(e) { e.message = `Slot ${U.nameOf(v)} -> "${p}" failed: (${e.message})`; throw e; } },
    init: function() {},
    access: C.noFn('access', arg => {}),
    seek: function(...args) {
      let val = this;
      for (let arg of args) val = U.isType(val, Promise) ? val.then(v => Insp.tryAccess(v, arg)) : Insp.tryAccess(val, arg);
      return val;
    }
    
  })});
  
  return {
    // Basic logic
    Endable, Src, Tmp, TmpAll, TmpAny,
    
    // Higher level logic
    MemSrc, FilterSrc, FnSrc, Chooser, Scope,
    
    // Utility
    Slots
  };
  
})();

