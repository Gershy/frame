// GAMEPLAY:
// [ ]  Random map generation!!!
// [ ]  Turning acceleration (allowing fine adjustments to angle while maintaining quicker turns)
// [ ]  Enemies + AI
// [ ]  Good reveal mechanics
//   [X]  Reveals stored on units; formations just group units together
//   [ ]  Ways to determine which units share vision WITHIN a formation (e.g. 2 units together in a formation, but too far apart)
//   [ ]  Reveal-sharing determined by certain units (e.g. maybe a Captain unit is necessary to link Grunts)
// [ ]  Objectives (THIS COUNTS THE MOST!!! WHAT KINDA GAME IS THIS?????)

// TECHNICAL:
// [ ]  All classes should be defined with U.insp
// [ ]  Performance seems poor at the moment? Firing a bunch of bullets off into space nearly overloads processing
// [X]  Bullets shouldn't need to send updates every frame
// [X]  More camera params
//   [X]  Zooming
//   [X]  Shifted ahead further
// [X]  Zones (broad collision detection)
// [X]  Smarter update paradigm
//   [X]  Less effort for defining unit changes?? (takes some redundant code at the moment)
//   [ ]  Clients shouldn't always receive the global update (a viewbox in the collision space; `collideAll` is the list of visible entities?)

let machine = null;
try { machine = window ? 'client' : 'server' } catch(err) { machine = 'server'; }

let doWarnings = Math.random() < 0.2;

Object.defineProperty(Object.prototype, 'forEach', {
  value: function(fn) {
    for (let k in this) fn(this[k], k);
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'map', {
  value: function(fn) {
    let ret = {};
    for (let k in this) { let v = fn(this[k], k); if (v !== C.skip) ret[k] = v; }
    return ret;
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'toArr', {
  value: function(it) {
    let ret = [];
    for (let k in this) { let v = fn(this[k], k); if (v !== C.skip) ret.push(v); }
    return ret;
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'slice', {
  value: function(...props) {
    let ret = {};
    for (let p of props) ret[p] = this[p];
    return ret;
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'has', {
  value: Object.prototype.hasOwnProperty,
  enumerable: false
});
Object.defineProperty(Object.prototype, 'gain', {
  value: function(obj) {
    for (let k in obj) this[k] = obj[k];
    return this;
  },
  enumerable: false
});

Object.defineProperty(Array.prototype, 'toObj', {
  value: function(it) {
    let ret = {};
    for (let i = 0, len = this.length; i < len; i++) { let v = it(this[i]); if (itv !== C.skip) ret[itv[0]] = itv[1]; }
    return ret;
  },
  enumerable: false
});
Object.defineProperty(Array.prototype, 'has', {
  value: function(v) { return this.indexOf(v) >= 0; },
  enumerable: false
});
Object.defineProperty(Array.prototype, 'gain', {
  value: function(arr2) { this.push(...arr2); },
  enumerable: false
});

let U = {
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  duoKey: (v1, v2, delim=',') => v1 < v2 ? `${v1}${delim}${v2}` : `${v2}${delim}${v1}`,
  combineObjs: (obj1, obj2) => ({ ...obj1, ...obj2 }),
  inspire: ({ name, inspiration={}, methods, statik={}, description='' }) => {
    let Insp = function(...p) {
      if (!p.length) p.push({});
      if (!this || this.constructor !== Insp) return new Insp(...p);
      this.init(...p);
    };
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Ensure that all `inspiration` items are Objects full of methods
    Insp.inspiration = { ...inspiration }; // Keep a copy of the inspiration on Insp for `isInspiredBy` testing
    inspiration = inspiration.map(insp => insp.prototype ? insp.prototype : insp); // Resolve Insps as their prototypes
    Insp.prototype = Object.create(null);
    
    // Run `methods` if necessary. Ensure it always resolve to an `Object` without a "constructor" key
    if (U.isType(methods, Function)) methods = methods(inspiration, Insp);
    if (!U.isType(methods, Object)) throw new Error('Couldn\'t resolve "methods" to Object');
    if (methods.has('constructor')) throw new Error('Invalid "constructor" key');
    
    let methodsByName = {};
    inspiration.forEach((insp, inspName) => {
      // Can`t do `insp.forEach`; `insp` may have no prototype
      for (let [ methodName, method ] of Object.entries(insp)) {
        // `insp` is likely a prototype and contains a "constructor" property that needs to be skipped
        if (methodName === 'constructor') continue;
        if (!methodsByName.has(methodName)) methodsByName[methodName] = [];
        methodsByName[methodName].push(method);
      }
    });
    
    methodsByName.gain(methods.map(m => [ m ])); // Method names declared for this Insp are guaranteed to be singular
    if (!methodsByName.has('init')) throw new Error('No "init" method available');
    
    methodsByName.forEach((methodsAtName, methodName) => {
      if (methodsAtName.length > 1) throw new Error(`Multiple method names at "${methodName}"; declare a custom method`);
      Insp.prototype[methodName] = methodsAtName[0]; // Length will be exactly 1 now
    });
    
    Insp.prototype.constructor = Insp;
    return Insp;
  },
  isType: (val, Cls) => {
    try { return val.constructor === Cls; } catch (err) {}
    return false;
  },
  isInspiredBy: function(obj, Insp) {
    if (obj.constructor) obj = obj.constructor;
    if (obj === Insp) return true;
    
    let insp = obj.has('inspiration') ? obj.inspiration : {};
    for (let k in insp) if (U.isInspiredBy(insp[k], Insp)) return true;
    return false;
  },
  typeOf: function(obj) {
    if (obj === null) return '<NULL>';
    if (typeof obj === 'undefined') return '<UNDEFINED>';
    try { return `<${obj.constructor.name}>`; } catch (e) {}
    return '<UNKNOWN>';
  }
};
let C = {
  skip: { SKIP: true },
  sync: {
    none: 0,    // Never sync
    total: 1,   // Only sync entire structure
    delta: 2    // Sync partial structure
  }
};

let SmoothingVal = U.inspire({ name: 'SmoothingVal', methods: (insp, Insp) => ({
  init: function (initial, amt=0.1) {
    this.desired = initial;
    this.current = initial;
    this.amt = amt;
  },
  change: function(v) { this.desired = v; },
  smooth: function() { return this.current; },
  choppy: function() { return this.desired; },
  update: function(desired=this.desired) {
    this.desired = desired;
    return this.current = (this.current * (1 - this.amt)) + (this.desired * this.amt);
  }
})});
let Timeout = U.inspire({ name: 'Timeout', methods: (insp, Insp) => ({
  init: function(f) {
    this.f = f;
    this.ref = null;
  },
  start: function(delay=1000) {
    if (this.ref !== null) throw new Error('Already started');
    this.ref = setTimeout(this.f, delay);
  },
  stop: function() {
    clearTimeout(this.ref);
    this.ref = null;
  }
})});
let Interval = U.inspire({ name: 'Interval', methods: (insp, Insp) => ({
  init: function(f) {
    this.f = f;
    this.ref = null;
  },
  start: function(delay=1000) {
    if (this.ref !== null) throw new Error('Already started');
    this.ref = setInterval(this.f, delay);
  },
  stop: function() {
    clearInterval(this.ref);
    this.ref = null;
  }
})});

let WOBBLY_UID = 0;
let Wobbly = U.inspire({ name: 'Wobbly', methods: (insp, Insp) => ({
  init: function(value=null) {
    this.uid = WOBBLY_UID++;
    this.nextInd = 0;
    this.holders = {};
    this.value = value;
  },
  hold: function(func) {
    let ind = this.nextInd++;
    func[`~wob${this.uid}`] = ind;
    this.holders[ind] = func;
    func(this.value);
  },
  drop: function(func) {
    let ind = func[`~wob${this.uid}`];
    delete func[`~wob${this.uid}`];
    delete this.holders[ind];
  },
  update: function(value) {
    this.value = value;
    for (let k in this.holders) this.holders[k](val);
  },
  mod: function(f) {
    this.update(f(this.value));
  }
})});
let CalcWob = U.inspire({ name: 'CalcWob', inspiration: { Wobbly }, methods: (insp, Insp) => ({
  init: function(wobblies, func) {
    insp.Wobbly.init.call(this);
    this.wobblies = wobblies;
    this.func = func;
    this.watchFunc = () => {
      let value = this.calc();
      if (value !== this.value) this.update(value);
    };
    this.value = this.calc();
    this.wobblies.forEach(w => w.hold(this.watchFunc));
  },
  calc: function() {
    return this.func(...this.wobblies.map(w => w.value));
  }
})});

class World {
  constructor() {
    this.clients = {};
    this.uninitializedClients = {};
    
    this.entities = {};
    this.addEntities = {};
    this.remEntities = {};
    this.updEntities = {};
  }
  getNextUid() { throw new Error('not implemented'); }
  addClient(client) {
    this.addEntity(client);
    this.clients[client.uid] = client; // uid is only available after add
    this.uninitializedClients[client.uid] = client;
    return client;
  }
  remClient(client) {
    this.remEntity(client);
    delete this.clients[client.uid];
    delete this.uninitializedClients[client.uid];
    return client;
  }
  addEntity(entity) {
    if (entity.world && entity.world !== this) throw new Error(`Entity belongs to another world`);
    
    // Set uid and world
    if (entity.uid === null) entity.setUid(this.getNextUid());
    entity.world = this;
    
    // if (this.remEntities.has(entity.uid)) return; // rem overrides add
    // delete this.updEntities[entity.uid]; // add overrides upd
    
    this.addEntities[entity.uid] = entity;
    return entity;
  }
  remEntity(entity) {
    if (entity.world !== this) throw new Error(`Entity ${entity.constructor.name} ${entity.world ? 'belongs to another world' : 'has no world'}`);
    if (!entity.inWorld) return;
    this.remEntities[entity.uid] = entity;
    // delete this.updEntities[entity.uid]; // rem overrides upd
    // delete this.addEntities[entity.uid]; // rem overrides add
    return entity;
  }
  updEntity(entity, updatedProps) {
    if (U.empty(updatedProps)) return;
    if (!entity.inWorld) return this.addEntity(entity);
    // if (this.addEntities.has(entity.uid)) return; // add overrides upd
    // if (this.remEntities.has(entity.uid)) return; // rem overrides upd
    if (!this.updEntities.has(entity.uid)) this.updEntities[entity.uid] = {};
    this.updEntities[entity.uid].gain(updatedProps);
    return entity;
  }
  doTickResolution() {
    
    let sendAddEntities = {};
    let sendRemEntities = {};
    let sendUpdEntities = {};
    
    // Process adds and rems in a cascade-supported style
    let cnt = 0;
    while (!U.empty(this.addEntities) || !U.empty(this.remEntities)) {
      
      let [add, rem] = [this.addEntities, this.remEntities];
      [this.addEntities, this.remEntities] = [{}, {}];
      
      // Start all added entities
      for (let [ uid, entity ] of Object.entries(add)) {
        this.entities[uid] = entity;
        entity.start();
        entity.inWorld = true;
        sendAddEntities[uid] = entity;
        delete this.updEntities[uid];
      }
      
      // End all removed entities
      for (let [ uid, entity ] of Object.entries(rem)) {
        entity = this.entities[uid];
        delete this.entities[uid];
        entity.end();
        entity.inWorld = false;
        sendRemEntities[uid] = entity;
        delete this.updEntities[uid];
      }
      
    }
    
    // Updates are pre-calculated! Return the data we already have
    sendUpdEntities = this.updEntities;
    this.updEntities = {};
    
    return {
      add: sendAddEntities,
      rem: sendRemEntities,
      upd: sendUpdEntities
    };
    
  }
}
class Entity {
  static genSerialDef() {
    return {
      type: { sync: C.sync.delta,
        change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
        serial: (inst) => inst.constructor.name
      }
    }
  }
  static setSerialDef(serialDef) {
    for (let k in serialDef) {
      if (!serialDef[k].has('change')) throw new Error(`${this.constructor.name}.serialDef.${k} missing "change"`);
      if (!serialDef[k].has('serial')) throw new Error(`${this.constructor.name}.serialDef.${k} missing "serial"`);
      if (doWarnings && !serialDef[k].has('actual')) console.log(`WARNING: ${this.name}.serialDef.${k} missing "actual"`);
    }
    this.serialDef = serialDef;
  }
  constructor() {
    this.uid = null;
    this.world = null;
    this.inWorld = false;
    this.zones = {};
  }
  getSerialDef() {
    if (!this.constructor.has('serialDef')) this.constructor.setSerialDef(this.constructor.genSerialDef());
    return this.constructor.serialDef;
  }
  mod(propName, newVal) {
    let serialDef = this.getSerialDef();
    if (!serialDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.serialDef.${propName}`);
    let { change, sync } = serialDef[propName];
    change(this, newVal);
    if (this.world && sync >= C.sync.delta) this.world.updEntity(this, { [propName]: 1 });
  }
  modF(propName, f) {
    let serialDef = this.getSerialDef();
    if (!serialDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.serialDef.${propName}`);
    let { change, sync, actual, serial } = serialDef[propName];
    let val = (actual || serial)(this); // TODO: should "actual" be optional?
    let newVal = f(val);
    if (val === newVal) return false;
    change(this, newVal);
    if (this.world && sync >= C.sync.delta) this.world.updEntity(this, { [propName]: 1 });
    return true;
  }
  serializePart(fieldMap) {
    let serialDef = this.getSerialDef();
    return fieldMap.map((v, k) => serialDef[k].serial(this));
  }
  serializeFull() {
    let ret = {};
    for (let [ k, { sync, serial } ] of Object.entries(this.getSerialDef())) if (sync >= C.sync.total) ret[k] = serial(this);
    return ret;
  }
  setUid(uid) {
    if (this.uid !== null) throw new Error(`Can't set new uid for ${this.uid}`);
    let cnst = (() => { try { return uid.constructor } catch(err) { return null; } })();
    if (cnst !== String && (cnst !== Number || uid !== uid)) throw new Error(`Invalid uid: ${uid}`);
    this.uid = uid;
  }
  start() { throw new Error(`not implemented for ${this.constructor.name}`); }
  update(secs) { throw new Error(`not implemented for ${this.constructor.name}`); }
  end() { throw new Error(`not implemented for ${this.constructor.name}`); }
}

global.gain({
  // Utility stuff
  output: console.log.bind(console),
  U, C, SmoothingVal, Wobbly, CalcWob,
  Timeout, Interval,
  
  // Game stuff
  World, Entity
});
