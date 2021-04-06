// The "clearing" is javascript-level bootstrapping
// write ui bug; no scrollbar for story viewing component (entries spill out, downwards)

Error.stackTraceLimit = 200;

let C = global.C = Object.freeze({
  skip: undefined,
  base62: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  notImplemented: function() { throw Error(`Not implemented by ${U.getFormName(this)}`); },
  noFn: name => {
    let fn = function() { throw Error(`${U.getFormName(this)} does not implement "${name}"`); }
    fn['~noFormCollision'] = true; // TODO: Use Symbol here??
    return fn;
  }
});
let protoDef = (Cls, name, value) => {
  Object.defineProperty(Cls.prototype, name, { value, enumerable: false, writable: true });
  
  // Note these properties should not be available on `global`! If they
  // were available, typos resulting in `protoDef` names resolve to
  // unexpected values instead of `C.skip`; this lead someone (whose
  // name remains undisclosed) into a ridiculous debugging scenario
  if (Cls === global.constructor) global[name] = C.skip;
};

protoDef(Object, 'each', function(fn) { for (let [ k, v ] of this) fn(v, k); });
protoDef(Object, 'map', function(fn) { // Iterator: (val, key) => val
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
  if (props.length === 1 && U.isForm(props[0], Object)) {
    let map = props[0]; // Maps existingKey -> newKeyName
    let ret = {}; for (let k in map) if (this.has(map[k])) ret[k] = this[map[k]]; return ret;
  } else { // `props` is an Array of property names (Strings)
    let ret = {}; for (let p of props) if (this.has(p)) ret[p] = this[p]; return ret;
  }
});
protoDef(Object, 'find', function(f) { // Iterator: (val, key) => bool; returns { found, val, key }
  for (let k in this) if (f(this[k], k)) return { found: true, val: this[k], key: k };
  return { found: false, val: null, k: null };
});
protoDef(Object, 'has', Object.prototype.hasOwnProperty);
protoDef(Object, 'isEmpty', function() { for (let k in this) return false; return true; });
protoDef(Object, 'gain', function(obj) { return Object.assign(this, obj); });
protoDef(Object, 'seek', function(keys) { // Returns { found: bool, val }
  let ret = this;
  if (U.isForm(keys, String)) keys = keys.split('.');
  for (let key of keys) { if (!ret || !ret.has(key)) return { found: false, val: null }; ret = ret[key]; }
  return { found: true, val: ret };
});
protoDef(Object, Symbol.iterator, function*() { for (let k in this) yield [ k, this[k] ]; });

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
protoDef(Array, 'has', Array.prototype.includes);
protoDef(Array, 'isEmpty', function() { return !this.length; }); // "isEmpty" -> "empty"
protoDef(Array, 'add', function(...args) { this.push(...args); return args[0]; });
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
protoDef(String, 'cut', function(seq, num=null) {
  // `num` defines how many cuts occur (# of resulting items - 1)
  let r = this.split(seq); return (num === null) ? r : [ ...r.slice(0, num), r.slice(num).join(seq) ];
});
protoDef(String, 'code', function(ind=0) { return this.charCodeAt(0); });
protoDef(String, 'count', function() { return this.length; });
protoDef(String, 'indent', function(amt=2, char=' ', indentStr=char[0].repeat(amt)) {
  return this.split('\n').map(ln => `${indentStr}${ln}`).join('\n');
});
protoDef(String, 'encodeInt', function(chrs=C.base62) {
  if (!chrs) throw Error(`No characters provided`);
  if (chrs.count() === 1) return this.count();
  let base = chrs.count(), map = chrs.split('').toObj((c, i) => [ c, i ]), sum = 0, len = this.count();
  for (let i = 0; i < len; i++) sum += Math.pow(base, len - i - 1) * map[this[i]];
  return sum;
});

protoDef(Number, 'char', function() { return String.fromCharCode(this); });
protoDef(Number, 'each', function(fn) { for (let i = 0; i < this; i++) fn(i); });
protoDef(Number, 'toArr', function(fn) { let arr = Array(this); for (let i = 0; i < this; i++) arr[i] = fn(i); return arr; });
protoDef(Number, 'toObj', function(fn) { let o = {}; for (let i = 0; i < this; i++) { let [ k, v ] = fn(i); o[k] = v; } return p; });
protoDef(Number, 'encodeStr', function(chrs=C.base62, padLen=null) {
  
  // Note that base-1 requires 0 to map to the empty string. This also
  // means that, for `n >= 1`:
  //      |       (n).encodeStr(singleChr)
  // is always equivalent to
  //      |       singleChr.repeat(n - 1)
  
  if (!chrs) throw Error(`No characters provided`);
  
  let n = this, base = chrs.count(), digits = 1, amt = 1, seq = [];
  if (base === 1) { digits = n; n = 0; }
  else            while (true) { let t = amt * base; if (t > n) break; digits++; amt = t; }
  
  for (let p = digits - 1; p >= 0; p--) {
    let pow = Math.pow(base, p), div = Math.floor(n / pow);
    seq.push(chrs[div]);
    n -= pow * div;
  }
  
  return padLen ? seq.join('').padHead(padLen, chrs[0]) : seq.join('');
  
});

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
protoDef(SetOrig, 'map', SetOrig.prototype.toArr);
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
protoDef(MapOrig, 'map', MapOrig.prototype.toObj);
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
Promise.allArr = (...args) => PromiseOrig.all(...args).then(arr => arr.map(v => v));
Promise.allObj = async obj => {
  let result = await Promise.allArr(obj.toArr(v => v));
  let ind = 0;
  let ret = {};
  for (let k in obj) { let r = result[ind++]; if (r !== C.skip) ret[k] = r; }
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

let GenOrig = (function*(){})().constructor;
protoDef(GenOrig, 'each', function(fn) { for (let v of this) fn(v); });
protoDef(GenOrig, 'toArr', function(fn) { return [ ...this ].map(fn); });
protoDef(GenOrig, 'toObj', function(fn) {
  let ret = {};
  for (let v of this) { v = it(v); if (v !== C.skip) ret[v[0]] = v[1]; }
  return ret;
});

protoDef(Error, 'update', function(props) {
  if (U.isForm(props, Function)) props = props(this.message);
  if (U.isForm(props, String)) props = { message: props };
  return Object.assign(this, props);
});

Function.stub = v => v;
Function.createStub = v => Function.stub.bind(null, v);
Set.stub = { count: Function.createStub(0), add: Function.stub, rem: Function.stub, has: Function.createStub(false) };
Map.stub = { count: Function.createStub(0), set: Function.stub, rem: Function.stub, has: Function.createStub(false) };

let U = global.U = {
  dbgCnt: name => {
    if (!U.has('dbgCntMap')) U.dbgCntMap = {};
    return U.dbgCntMap[name] = (U.dbgCntMap.has(name) ? U.dbgCntMap[name] + 1 : 0);
  },
  int32: Math.pow(2, 32),
  safe: (f1, f2=e=>e) => {
    if (!U.isForm(f2, Function)) f2 = Function.stub.bind(null, f2);
    try { let r = f1(); return U.isForm(r, Promise) ? r.catch(f2) : r; }
    catch(err) { return f2(err); }
  },
  then: (v, rsv, rjc=null) => {
    if (U.isForm(v, Promise)) return v.then(rsv, rjc);
    if (!rjc) return rsv(v); // No `rjc` means no error handling
    try { return rsv(v); } catch(err) { return rjc(err); }
  },
  reservedFormProps: Set([ 'constructor', 'Form' ]),
  form: ({ name, has={}, parForms=has, props=()=>({}) }) => {
    
    // Ensure every ParForm is truly a Form (Function)
    for (let [ k, Form ] of parForms) if (!U.isForm(Form, Function)) throw Error(`Invalid Form: "${k}"`);
    
    let fName = name.replace(/[^a-zA-Z0-9]/g, '$');
    let Form = eval(`let Form = function ${fName}(...p) { /* ${name} */ return (this && this.constructor === Form) ? this.init(...p) : new Form(...p); }; Form;`);
    Object.defineProperty(Form, 'name', { value: name });
    
    // Calculate a Set of all parent Forms for `hasForm` testing
    Form.forms = Set([ Form ]);
    parForms.each(({ forms }) => forms.each(ParForm => Form.forms.add(ParForm)));
    
    // Keep track of parent classes directly
    Form.parents = parForms;
    
    // Initialize prototype
    Form.prototype = Object.create(null);
    
    // Resolve all ParForms to their prototypes
    parForms = parForms.map(ParForm => {
      // `protoDef` sets non-enumerable prototype properties
      // Iterate non-enumerable props with `Object.getOwnPropertyNames`
      let proto = ParForm.prototype;
      return Object.getOwnPropertyNames(proto).toObj(v => [ v, proto[v] ]);
    });
    
    // For `U.form({ name: 'MyForm', props: (forms, Form) => ... })`,
    // make `forms.all(name, fn)` available. `forms.all` generates a
    // method which calls all underlying parent functionality for the
    // name `name`. It's also possible for this generated function to
    // return a value; this is enabled by supplying `workFn`, which is
    // called with the original arguments to the generated function.
    // Note that `workFn` has no access to any of the values generated
    // by parent methods! Note that `function(){}` rather than `()=>{}`
    // syntax should be preferred for `workFn`, as no `this` reference
    // will be available using `()=>{}` syntax.
    parForms.all = (methodName, workFn) => {
      let props = parForms.toArr(proto => proto.has(methodName) ? proto[methodName] : C.skip);
      return function(...args) {
        for (let m of props) m.call(this, ...args);
        if (workFn) return workFn.call(this, ...args);
      };
    };
    
    // For `U.form({ name: 'MyForm', props: (forms, Form) => ... })`,
    // make `forms.allArr(name, fn)` available. `forms.allArr` is very
    // similar to `forms.all`, except `workFn`'s signature isn't:
    //    |     workFn(...args)
    // but rather:
    //    |     workFn(parResultArr, ...args)
    // The difference is the `parResultArr`, which contains the results
    // of all parents calling their own `name` functions. Note that the
    // use of an Array rather than an Object intentionally encourages
    // design to treat all returned parent values equally. There is no
    // explicit way to tell which parent returned a particular value.
    parForms.allArr = (methodName, workFn) => {
      let props = parForms.toArr(proto => proto.has(methodName) ? proto[methodName] : C.skip);
      return function(...args) { return workFn.call(this, props.map(m => m.call(this, ...args)), ...args); };
    };
    
    // If `props` is a function it becomes the result of its call
    if (U.isForm(props, Function)) props = props(parForms, Form);
    
    // Ensure we have valid "props"
    if (!U.isForm(props, Object)) throw Error(`Couldn't resolve "props" to Object`);
    
    // Ensure reserved property names haven't been used
    for (let k of U.reservedFormProps) if (props.has(k)) throw Error(`Used reserved "${k}" key`);
    
    // Collect all inherited props
    let propsByName = {};
    
    // Iterate all props of all ParForm prototypes
    for (let [ formName, proto ] of parForms) { for (let [ propName, prop ] of proto) {
      
      // Skip reserved names (they certainly exist in `formProto`!)
      if (U.reservedFormProps.has(propName)) continue;
      
      // Store all props under the same name in the same Set
      if (!propsByName.has(propName)) propsByName[propName] = Set();
      propsByName[propName].add(prop);
      
    }};
    
    // `propsByName` already has all ParForm props; now add in the props
    // unique to the Form being created!
    for (let [ propName, prop ] of props) {
      
      // `propName` values iterated here will be unique; `props` is
      // an object, and must have unique keys
      if (propName[0] === '$')  Form[propName.slice(1)] = prop;        // "$" indicates class-level property
      else                      propsByName[propName] = Set([ prop ]); // Guaranteed to be singular
      
    }
    
    // At this point an "init" prop is required! TODO: Allow for uninitializable ("abstract") Forms?
    if (!propsByName.has('init')) throw Error('No "init" method available');
    
    for (let [ propName, props ] of propsByName) {
      
      // Filter out any '~noFormCollision
      let propsAtName = props.toArr(v => (v && v['~noFormCollision']) ? C.skip : v);
      
      // Ensure there are no collisions for this prop. In case of
      // collisions, the solution is for the Form defining the collision
      // to define its own property under the collision name (and this
      // property may take into account aspects of the ParForm props
      // which collided; for example it may call all ParForm methods of
      // the same name!)
      if (propsAtName.length > 1)
        throw Error(`Found ${propsAtName.length} props named "${propName}" for ${name} (to resolve define ${name}.protoype.${propName})`);
      
      protoDef(Form, propName, propsAtName.length ? propsAtName[0] : C.noFn(propName));
      
    }
    
    protoDef(Form, 'Form', Form);
    protoDef(Form, 'constructor', Form);
    Object.freeze(Form.prototype);
    return Form;
  },
  isForm: (fact, ...forms) => {
    
    // Detect and reject NaN! Hut philosophy!
    if (fact !== fact) return false;
    
    // Allow any provided Form to match...
    for (let Form of forms) {
      
      // Prefer to compare against `FormNative`. Some native Cls
      // references represent the hut-altered form (e.g. they have an
      // extended prototype and can be called without "new"). Such Cls
      // references are not true "Classes" in that they are never set as
      // the "constructor" property of any instance - "contructor"
      // properties will always reflect the native, unmodified Cls. Any
      // Cls which has been hut-modified will have a "Native" property
      // pointing to the original class, which serves as a good value to
      // compare against "constructor" properties
      if (fact != null && fact.constructor === (Form.Native || Form)) return true;
      
    }
    
    return false;
    
  },
  hasForm: (fact, FormOrCls) => {
    
    if (fact == null) return false;
    
    // `fact` may either be a fact/instance, or a Form/Cls. In case a
    // fact/instance was given the "constructor" property points us to
    // the appropriate Form/Cls. We name this value `Form`, although it
    // is also still ambiguously a Form/Cls.
    let Form = U.isForm(fact, Function) ? fact : fact.constructor;
    
    // If a "forms" property exists, `FormOrCls` is specifically a Form,
    // and inheritance can be checked by existence in the set
    if (Form.forms) return Form.forms.has(FormOrCls);
    
    // No "forms" property; FormOrCls is specifically a Cls. Inheritance
    // can be checked using `instanceof`; prefer to compare against a
    // "Native" property
    return (fact instanceof (FormOrCls.Native || FormOrCls));
    
  },
  getForm: f => (f != null) ? f.constructor : null,
  getFormName: f => {
    
    // Previous implementation:
    // U.safe(() => f.constructor.name, () => U.safe(() => String(f), 'Unrepresentable')),
    
    if (f === null) return 'Null';
    if (f === undefined) return 'Undefined';
    if (f !== f) return 'NaN';
    return U.safe(() => f.constructor.name, 'Unrepresentable');
    
  },
  
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
  
  let Endable = U.form({ name: 'Endable', props: (forms, Form) => ({
    
    $globalRegistry: 0 ? Set.stub : Set(),
    
    init: function(fn) {
      // Allow Endable.prototype.cleanup to be masked
      if (fn) Object.defineProperty(this, 'cleanup', { value: fn, writable: true, configurable: true, enumerable: true });
      Form.globalRegistry.add(this);
    },
    onn: function() { return true; },
    off: function() { return !this.onn(); },
    cleanup: function() {},
    end: function(...args) {
      if (this.off()) return false;
      Object.defineProperty(this, 'onn', { value: () => false, writable: true, configurable: true, enumerable: true }); //this.onn = () => false;
      Form.globalRegistry.rem(this);
      this.cleanup(...args);
      return true;
    }
  })});
  let Src = U.form({ name: 'Src', props: (forms, Form) => ({
    init: function() { this.fns = Set(); },
    newRoute: function(fn) {},
    route: function(fn, mode='tmp') {
      if (!U.hasForm(fn, Function)) throw Error(`Can't route to a ${U.getFormName(fn)}`);
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
  let Tmp = U.form({ name: 'Tmp', has: { Endable, Src }, props: (forms, Form) => ({
    init: function(fn=null) {
      forms.Src.init.call(this);
      forms.Endable.init.call(this);
      if (fn) this.route(fn, 'prm');
    },
    ref: function() { this.refCount = (this.refCount || 0) + 1; },
    end: function(...args) { return this.sendAndEnd(...args); },  // TODO: high-traffic code... should reference `sendAndEnd` instead of delegating...??
    send: function(...args) { return this.sendAndEnd(...args); },
    sendAndEnd: function(...args) {
      
      // Sending and ending are synonymous for a Tmp
      
      // For ref'd Tmps, prevent ending if refs still exist
      if (this.refCount && --this.refCount > 0) return;
      
      if (!forms.Endable.end.call(this)) return; // Check if we're already ended
      forms.Src.send.call(this, ...args); // Consider inlining to reduce stack
      this.fns = Set.stub;
      return;
      
    },
    newRoute: function(fn) { if (this.off()) fn(); },
    // needs: function(tmp, mode='prm') {
    //   if (!U.hasForm(tmp, Tmp)) throw Error(`Param must be Tmp; got ${U.getFormName(tmp)}`);
    //   return (mode === 'tmp')
    //     ? Object.assign(tmp.route(() => this.end, 'tmp'), { v: this })
    //     : { v: this };
    // },
    endWith: function(val, mode='prm') {
      if (U.hasForm(val, Function)) return this.route(val, mode) || this;
      if (U.hasForm(val, Endable)) return this.route((...args) => val.end(...args), mode) || this;
      throw Error(`Can't end with a value of type ${U.getFormName(val)}`);
    }
  })});
  
  Src.stub = { route: () => Tmp.stub, send: Function.stub };
  Tmp.stub = (t => (t.end(), t))(Tmp());
  
  let TmpAll = U.form({ name: 'TmpAll', has: { Tmp }, props: (forms, Form) => ({
    
    // A Tmp which lasts as long as all underlying Tmps last
    
    init: function(tmps) {
      forms.Tmp.init.call(this);
      let fn = this.end.bind(this);
      this.routes = [];
      this.routes = tmps.map(tmp => {
        let route = tmp.route(fn);
        this.endWith(route);
        return route;
      });
    },
    cleanup: function() { for (let r of this.routes) r.end(); }
  })});
  let TmpAny = U.form({ name: 'TmpAny', has: { Tmp }, props: (forms, Form) => ({
    
    // A Tmp which lasts as long as any underlying Tmp lasts
    
    init: function(tmps) {
      forms.Tmp.init.call(this);
      let cnt = tmps.length;
      let endFn = () => (--cnt > 0) || this.end();
      for (let tmp of tmps) this.endWith(tmp.route(endFn));
    }
  })});
  
  let MemSrc = U.form({ name: 'MemSrc', has: { Endable, Src }, props: (forms, Form) => ({
    init: function() {
      if (U.isForm(this, MemSrc)) throw Error(`Don't init the parent MemSrc class!`);
      forms.Endable.init.call(this);
      forms.Src.init.call(this);
    },
    retain: C.noFn('retain')
  })});
  MemSrc.Prm1 = U.form({ name: 'MemSrc.Prm1', has: { MemSrc }, props: (forms, Form) => ({
    init: function(val=C.skip) { forms.MemSrc.init.call(this); this.val = val; },
    newRoute: function(fn) { if (this.val !== C.skip) fn(this.val); },
    retain: function(val) {
      
      // Only short-circuit for primitive types; don't trust identity
      // to tell us if compound types (Object, Array) really changed
      if (val === this.val && U.isForm(val, String, Number, Boolean)) return;
      this.val = val;
      if (this.val !== C.skip) this.send(val);
      
    },
    cleanup: function() { this.val = C.skip; }
  })});
  MemSrc.PrmM = U.form({ name: 'MemSrc.PrmM', has: { MemSrc }, props: (forms, Form) => ({
    init: function() { forms.MemSrc.init.call(this); this.vals = []; },
    count: function() { return this.vals.count(); },
    retain: function(val) { this.vals.push(val); this.send(val); },
    newRoute: function(fn) { for (let val of this.vals) fn(val); },
    cleanup: function() { this.vals = []; }
  })});
  MemSrc.Tmp1 = U.form({ name: 'MemSrc.Tmp1', has: { MemSrc }, props: (forms, Form) => ({
    init: function(val) {
      forms.MemSrc.init.call(this);
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
  MemSrc.TmpM = U.form({ name: 'MemSrc.TmpM', has: { MemSrc }, props: (forms, Form) => ({
    init: function() {
      forms.MemSrc.init.call(this);
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
  
  let SetSrc = U.form({ name: 'SetSrc', has: { Endable, Src }, props: (forms, Form) => ({
    
    // Allows a Tmp-sending Src to be treated in aggregate, instead of
    // an item-by-item basis. Instead of monitoring a Src for sent Tmps
    // and each sent Tmp for ending, SetSrc allows a Src to be monitored
    // for any change, whether it is a new Tmp or an ended Tmp. Sends
    // from this class return the entire set of Tmps
    
    init: function(src) {
      
      let tmps = Set();
      this.tmpRoutes = Set();
      this.srcRoute = src.route(tmp => {
        
        if (tmp.off()) return;
        
        let tmpRoute = tmp.route(() => {
          tmps.rem(tmp);
          this.tmpRoutes.rem(tmpRoute);
          this.send(tmps);
        });
        
        tmps.add(tmp);
        this.tmpRoutes.add(tmpRoute);
        
        this.send(tmps);
        
      });
      
    },
    cleanup: function() {
      this.srcRoute.end();
      for (let r of this.tmpRoutes) r.end();
    }
    
  })});
  
  let FilterSrc = U.form({ name: 'FilterSrc', has: { Endable, Src }, props: (forms, Form) => ({
    init: function(src, fn) {
      forms.Endable.init.call(this);
      forms.Src.init.call(this);
      this.src = src;
      this.srcRoute = src.route((...vals) => fn(...vals) && this.send(...vals));
    },
    cleanup: function() { this.srcRoute.end(); }
  })});
  let FnSrc = U.form({ name: 'FnSrc', has: { Endable, Src }, props: (forms, Form) => ({
    
    // Provides capacity to monitor an arbitrary number of Srcs and run
    // functionality based on the most recent result from each Src.
    // Overview:
    // - Array index for each Src; array initially full of `C.skip`
    // - Src sends replace value at array index
    // - For every such send an arbitrary `fn` maps the current array
    //    to a single arbitrary value
    // - Subclass may provide some intermediate processing on this value
    // - If the processed arbitrary value isn't `C.skip`, a send occurs
    
    init: function(srcs, fn) {
      if (U.isForm(this, FnSrc)) throw Error(`Don't init the parent FnSrc class!`);
      
      forms.Endable.init.call(this);
      forms.Src.init.call(this);
      
      let vals = []; // Accessing unpopulated indices gives `C.skip`
      this.routes = srcs.map((src, ind) => src.route(val => {
        vals[ind] = val;
        let result = this.applyFn(fn, vals);
        if (result !== C.skip) this.send(result);
      }));
    },
    applyFn: C.noFn('applyFn', (fn, vals) => 'valToSend'),
    cleanup: function() { for (let r of this.routes) r.end(); }
  })});
  FnSrc.Prm1 = U.form({ name: 'FnSrc.Prm1', has: { FnSrc }, props: (forms, Form) => ({
    
    // Remember most recent arbitrary value; if this value is repeated,
    // prevent a duplicate send by returning `C.skip` from `applyFn`. No
    // regard for any late routes; they won't be sent buffered value
    
    init: function(...args) {
      this.lastResult = C.skip;
      forms.FnSrc.init.call(this, ...args);
    },
    newRoute: function(fn) { if (this.lastResult !== C.skip) fn(this.lastResult); },
    applyFn: function(fn, vals) {
      let result = fn(...vals);
      return (result === this.lastResult) ? C.skip : (this.lastResult = result);
    }
  })});
  FnSrc.PrmM = U.form({ name: 'FnSrc.PrmM', has: { FnSrc }, props: (forms, Form) => ({
    
    // Allows duplicate sends
    
    applyFn: function(fn, vals) { return fn(...vals); }
  })});
  FnSrc.Tmp1 = U.form({ name: 'FnSrc.Tmp1', has: { FnSrc }, props: (forms, Form) => ({
    
    // Prevents duplicate sends; sends most recent Tmp to any late
    // routes; manages arbitrary results by ending them when a new one
    // is received
    
    init: function(...params) {
      this.lastResult = C.skip;
      forms.FnSrc.init.call(this, ...params);
    },
    newRoute: function(fn) { if (this.lastResult !== C.skip) fn(this.lastResult); },
    applyFn: function(fn, vals) {
      // Call function; ignore duplicates
      let result = fn(...vals, this.lastResult);
      if (result === this.lastResult) return C.skip;
      
      // End any previous result; remember result and return it!
      if (this.lastResult) this.lastResult.end();
      return this.lastResult = result;
    },
    cleanup: function() { forms.FnSrc.cleanup.call(this); this.lastResult && this.lastResult.end(); }
  })});
  FnSrc.TmpM = U.form({ name: 'FnSrc.TmpM', has: { FnSrc }, props: (forms, Form) => ({
    
    // Interestingly, behaves exactly like FnSrc.PrmM! `fn` is expected
    // to return Tmp instances (or C.skip), but this class takes no
    // responsibility for ending these Tmps - this is because there are
    // no restrictions on how many Tmps may exist in parallel!
    
    applyFn: function(fn, vals) { return fn(...vals); }
  })});
  
  let Chooser = U.form({ name: 'Chooser', has: { Endable, Src }, props: (forms, Form) => ({
    init: function(names, src=null) {
      forms.Endable.init.call(this);
      forms.Src.init.call(this);
      
      if (U.hasForm(names, Src)) [ src, names ] = [ names, [ 'off', 'onn' ] ];
      
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
          // once again - this allows any cleanup which may be defined
          // under `chooser.srcs.off` to run for the previous value, and
          // then for the next value to be immediately installed
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
  let Scope = U.form({ name: 'Scope', has: { Tmp }, props: (forms, Form) => ({
    init: function(src, fn) {
      
      forms.Tmp.init.call(this);
      this.fn = fn;
      this.srcRoute = src.route(tmp => {
        
        if (!U.hasForm(tmp, Tmp)) throw Error(`Scope expects Tmp - got ${U.getFormName(tmp)}`);
        if (tmp.off()) return;
        
        // Define `addDep` and `addDep.scp` to enable nice shorthand
        let deps = Set();
        let addDep = dep => {
          
          // Allow raw functions; wrap them in `Endable`
          if (U.isForm(dep, Function)) dep = Endable(dep);
          
          if (deps.has(dep)) return; // Ignore duplicates
          if (dep.off()) return; // Ignore any inactive Deps
          
          // `deps` no longer existing requires all Deps to end
          if (!deps) return dep.end();
          
          if (U.hasForm(dep, Tmp)) {
            // Note `deps` falsiness check; `deps` may be set to `null`
            let remDep = dep.route(() => deps && (deps.rem(dep), deps.rem(remDep)));
            deps.add(remDep);
          }
          
          deps.add(dep);
          
          return dep;
          
        };
        addDep.scp = addDep.scope = (...args) => addDep(this.subScope(...args));
        
        // If either `tmp` or this Scope ends, all existing dependencies
        // end as well. This relationship is itself a dependency
        let depsEndTmp = TmpAll([ this, tmp ]);
        depsEndTmp.endWith((...args) => { let deps0 = deps; deps = null; deps0.each(d => d.end(...args)); });
        addDep(depsEndTmp);
        
        this.processTmp(tmp, addDep);
        
      });
      
    },
    processTmp: function(tmp, dep) { this.fn(tmp, dep); },
    subScope: function(...args) { return (0, this.constructor)(...args); },
    cleanup: function() { this.srcRoute.end(); }
  })});
  let Slots = U.form({ name: 'Slots', props: (forms, Form) => ({
    
    $tryAccess: (v, p) => { try { return v.access(p); } catch(e) { throw e.update(m => `Slot ${U.getFormName(v)} -> "${p}" failed: (${m})`); } },
    init: function() {},
    access: C.noFn('access', arg => {}),
    seek: function(...args) {
      let val = this;
      for (let arg of args) val = U.isForm(val, Promise) ? val.then(v => Form.tryAccess(v, arg)) : Form.tryAccess(val, arg);
      return val;
    }
    
  })});
  
  let TimerSrc = U.form({ name: 'TimerSrc', has: { Endable, Src }, props: (forms, Form) => ({
    
    init: function({ ms, num=1, immediate=num!==1 }) {
      
      // `num` may be set to `Infinity` for unlimited ticks
      
      if (!U.isForm(num, Number)) throw Error(`"num" must be integer`);
      
      forms.Endable.init.call(this);
      forms.Src.init.call(this);
      
      if (num <= 0) { this.end(); return; }
      this.num = num;
      this.interval = setInterval(() => this.doSend(), ms);
      if (immediate) Promise.resolve().then(() => this.doSend());
      
    },
    doSend: function() {
      this.send(--this.num);
      if (this.num <= 0) this.end();
    },
    cleanup: function() {
      this.send = () => {}; // TODO: Maybe an intermediate EndableSrc Form, whose cleanup always destroys any further ability to send?
      clearInterval(this.interval);
    }
    
  })});
  
  return {
    // Basic logic
    Endable, Src, Tmp, TmpAll, TmpAny, SetSrc, TimerSrc,
    Source: Src, Temp: Tmp, TempAll: TmpAll, TempAny: TmpAny, SetSource: SetSrc, TimerSource: TimerSrc,
    
    // Higher level logic
    MemSrc, FilterSrc, FnSrc, Chooser, Scope,
    MemSource: MemSrc, FilterSource: FilterSrc,
    
    // Utility
    Slots
  };
  
})();

