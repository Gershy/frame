// The "clearing" is javascript-level bootstrapping

Error.stackTraceLimit = 200;

let protoDef = (Cls, name, value) => Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });

let C = global.C = {
  skip: undefined,
  notImplemented: function() { throw Error(`Not implemented by ${U.nameOf(this)}`); },
  noFn: name => {
    let fn = function() { throw Error(`${U.nameOf(this)} does not implement "${name}"`); }
    fn['~noInspCollision'] = true;
    return fn;
  }
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
protoDef(Object, 'pref', function(obj) { for (let k in obj) if (this.has(k)) this[k] = obj[k]; return this; });
protoDef(Object, 'def', function(k, def=null) { return this.has(k) ? this[k] : def; });
protoDef(Object, 'seek', function(keys) { // Returns { found: bool, val }
  let ret = this;
  if (U.isType(keys, String)) keys = keys.split('.');
  for (let key of keys) { if (!ret || !ret.has(key)) return { found: false, val: null }; ret = ret[key]; }
  return { found: true, val: ret };
});
protoDef(Object, Symbol.iterator, function*() {
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
protoDef(String, 'code', function(ind=0) { return this.charCodeAt(0); });
protoDef(String, 'count', function() { return this.length; });
protoDef(String, 'polish', function(c=null) {
  if (c === null) return this.trim();
  let [ ind0, ind1 ] = [ 0, this.length - 1 ];
  while (this[ind0] === c[0]) ind0++;
  while (this[ind1] === c[0]) ind1--;
  return this.substr(ind0, ind1 + 1);
});

protoDef(Number, 'char', function() { return String.fromCharCode(this); });

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
      protoDef(Insp, methodName, fn);
    }
    
    protoDef(Insp, 'constructor', Insp);
    return Insp;
  },
  isType: (val, Cls) => {
    // Note: This is hopefully the *only* use of `!=` throughout Hut!
    // Falsy only for unboxed values (`null` and `undefined`)
    if (Cls && Cls.Native) Cls = Cls.Native;
    return val != null && val.constructor === Cls;
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
  multiLineString: str => {
    
    let lines = str.split('\n').map(ln => ln.replace(/\r/g, ''));
    
    // Trim any leading empty lines
    while (lines.length && !lines[0].trim()) lines = lines.slice(1);
    
    // Count leading whitespace chars on first line with content
    let initSpace = 0;
    while (lines[0][initSpace].match(/\s/)) initSpace++;
    
    return lines.map(ln => ln.slice(initSpace)).join('\n');
    
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
    
    $globalRegistry: Set(),
    
    init: function() { Insp.globalRegistry.add(this); },
    onn: function() { return true; },
    off: function() { return !this.onn(); },
    cleanup: function() {},
    end: function() {
      if (this.off()) return false;
      this.onn = () => false;
      Insp.globalRegistry.rem(this);
      this.cleanup();
      return true;
    }
  })});
  let Src = U.inspire({ name: 'Src', methods: (insp, Insp) => ({
    
    $nullFns: { add: ()=>{}, rem: ()=>{} },
    
    init: function() { this.fns = Set(); },
    addedRoute: function(fn) {},
    route: function(fn, mode='tmp') {
      if (!(fn instanceof Function)) throw Error(`Can't route to a ${U.nameOf(fn)}`);
      
      this.fns.add(fn);
      this.addedRoute(fn);
      if (mode === 'tmp') return Tmp(() => this.fns.rem(fn));
    },
    send: function(...args) { for (let fn of this.fns) fn(...args); }
  })});
  let Tmp = U.inspire({ name: 'Tmp', insps: { Endable, Src }, methods: (insp, Insp) => ({
    init: function(fn=null) {
      insp.Src.init.call(this);
      insp.Endable.init.call(this);
      if (fn) this.route(fn, 'prm');
    },
    ref: function() { return this; },
    end: function() { return this.sendAndEnd(); },
    send: function() { return this.sendAndEnd(); },
    sendAndEnd: function() {
      // Sending and ending are synonymous for a Tmp
      if (!insp.Endable.end.call(this)) return; // Check if we're already ended
      insp.Src.send.call(this);
      this.fns = Src.nullFns;
      return;
    },
    addedRoute: function(fn) { if (this.off()) fn(); },
    endWith: function(val, mode='prm') {
      if (U.isType(val, Function)) return this.route(val, mode) || this;
      if (U.isInspiredBy(val, Endable)) return this.route(() => val.end(), mode) || this;
      throw Error(`Can't end with a value of type ${U.nameOf(val)}`);
    }
  })});
  let TmpRefCount = U.inspire({ name: 'TmpRefCount', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(fn) {
      insp.Tmp.init.call(this, fn);
      this.refCount = 0;
    },
    ref: function() { this.refCount++; return this; },
    sendAndEnd: function(...args) { if (--this.refCount <= 0) return insp.Tmp.sendAndEnd.call(this); }
  })});
  let TmpAll = U.inspire({ name: 'TmpAll', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(tmps) {
      insp.Tmp.init.call(this);
      let fn = this.end.bind(this);
      for (let tmp of tmps) this.endWith(tmp.route(fn));
    }
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
    $init: (mode='tmp', amt='many', src) => {
      if (![ 'tmp', 'prm' ].includes(mode)) throw Error(`Invalid mode: "${mode}"`);
      if (![ 'one', 'many' ].includes(amt)) throw Error(`Invalid amt: "${amt}"`);
      return Insp[`${mode === 'tmp' ? 'Tmp' : 'Prm'}${amt === 'many' ? 'M' : '1'}`](src);
    },
    init: function(src) {
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
      this.src = src;
      this.srcRoute = this.src.route((...vals) => this.receive(...vals));
    },
    cleanup: function() { this.srcRoute.end(); }
  })});
  MemSrc.Tmp1 = U.inspire({ name: 'MemSrc.Tmp1', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(src) {
      insp.MemSrc.init.call(this, src);
      this.valEndRoute = null;
      this.val = null;
    },
    receive: function(tmp) {
      if (tmp.off()) return; // Don't bother with inactive Tmps
      if (this.valEndRoute) { this.valEndRoute.end(); this.valEndRoute = null; }
      this.val = tmp;
      this.valEndRoute = tmp.route(() => this.val = this.valEndRoute = null);
      this.send(tmp);
    },
    route: function(fn, mode) {
      if (this.val) fn(this.val);
      return insp.MemSrc.route.call(this, fn, mode);
    },
    cleanup: function() { this.valEndRoute && this.valEndRoute.end(); this.val = this.valEndRoute = null; }
  })});
  MemSrc.TmpM = U.inspire({ name: 'MemSrc.TmpM', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(src) {
      insp.MemSrc.init.call(this, src);
      this.valEndRoutes = Map();
      this.vals = Set();
    },
    receive: function(tmp) {
      if (tmp.off()) return; // Don't bother with inactive Tmps
      this.vals.add(tmp);
      this.valEndRoutes.set(tmp, tmp.route(() => (this.vals.rem(tmp), this.valEndRoutes.rem(tmp))));
      this.send(tmp);
    },
    route: function(fn, mode) {
      for (let val of this.vals) fn(val);
      return insp.MemSrc.route.call(this, fn, mode);
    },
    cleanup: function() {
      for (let [ tmp, route ] of this.valEndRoutes) route.end();
      this.vals = Set();
      this.valEndRoutes = Map();
    }
  })});
  MemSrc.Prm1 = U.inspire({ name: 'MemSrc.Prm1', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(src) {
      insp.MemSrc.init.call(this, src);
      this.val = C.skip;
    },
    receive: function(val) { this.val = val; this.send(val); },
    route: function(fn, mode) { if (this.val !== C.skip) fn(this.val); return insp.MemSrc.route.call(this, fn, mode); },
    cleanup: function() { this.val = null; }
  })});
  MemSrc.PrmM = U.inspire({ name: 'MemSrc.PrmM', insps: { MemSrc }, methods: (insp, Insp) => ({
    init: function(src) {
      insp.MemSrc.init.call(this, src);
      this.vals = [];
    },
    receive: function(val) { this.vals.push(val); this.send(val); },
    route: function(fn, mode) { for (let val of this.vals) fn(val); return insp.MemSrc.route.call(this, fn, mode); },
    cleanup: function() { this.vals = []; }
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
      insp.Endable.init.call(this);
      insp.Src.init.call(this);
      this.srcs = srcs;
      this.lastResult = undefined; // To allow default params
      let vals = srcs.map(v => null);
      this.routes = srcs.map((src, ind) => src.route(val => {
        vals[ind] = val;
        
        let result = fn(...vals, this.lastResult);
        if (result === this.lastResult) return;
        
        if (U.isInspiredBy(this.lastResult, Endable)) this.lastResult.end();
        if ((this.lastResult = result) !== C.skip) this.send(result);
      }));
    },
    cleanup: function() {
      for (let r of this.routes) r.end();
      if (U.isInspiredBy(this.lastResult, Endable)) this.lastResult.end();
    }
  })});
  
  let Scope = U.inspire({ name: 'Scope', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(src, fn) {
      
      insp.Tmp.init.call(this);
      this.srcRoute = src.route(tmp => {
        
        if (!U.isInspiredBy(tmp, Tmp)) throw Error(`Scope expects Tmp - got ${U.nameOf(tmp)}`);
        if (tmp.off()) return;
        
        // Define `addDep` and `addDep.scp` to enable nice shorthand
        let deps = Set();
        let endFn = () => { let deps0 = deps; deps = null; deps0.each(d => d.end()); };
        let addDep = dep => deps ? (dep.onn() && deps.add(dep), dep) : dep.end();
        addDep.scp = (...args) => addDep(this.constructor.call(null, ...args));
        
        // If either `tmp` or this Scope ends, all existing dependencies
        // end as well. This relationship is itself a dependency
        addDep( TmpAll([ this, tmp ]).endWith(endFn) );
        
        fn(tmp, addDep);
        
      });
      
    },
    cleanup: function() { this.srcRoute.end(); }
  })});
  
  let Slots = U.inspire({ name: 'Slots', methods: (insp, Insp) => ({
    
    $tryAccess: (v, p) => { try { return v.access(p); } catch(e) { e.message = `Slot ${U.nameOf(v)} -> "${p}" failed: (${e.message})`; throw e; } },
    init: C.noFn('init'),
    access: C.noFn('access', arg => {}),
    seek: function(...args) {
      let val = this;
      for (let arg of args) val = U.isType(val, Promise) ? val.then(v => Insp.tryAccess(v, arg)) : Insp.tryAccess(val, arg);
      return val;
    }
    
  })});
  
  return { Endable, Src, Tmp, TmpRefCount, TmpAll, TmpAny, MemSrc, FilterSrc, FnSrc, Scope, Slots };
  
})();

