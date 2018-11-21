// GAMEPLAY:
// [ ]  Random map generation!!!
// [ ]  Turning acceleration (allowing fine adjustments to angle while maintaining quicker turns)
// [ ]  Enemies + AI
//   [ ]  Adversarial ZombieManager vs TroopManager learning
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
Object.defineProperty(Object.prototype, 'find', {
  value: function(f) {
    for (let k in this) if (f(this[k])) return [ k, this[k] ];
    return null;
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

Object.defineProperty(Array.prototype, 'find', {
  value: function(f) {
    for (let i = 0, len = this.length; i < len; i++) if (f(this[i])) return [ i, this[i] ];
    return null;
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

let BaseInsp = function() {};
BaseInsp.prototype = Object.create(null, {
  

});
BaseInsp.prototype.isInspiredBy = function(Insp0) { return this.constructor.insps.has(Insp0.uid); };

let U = {
  INSP_UID: 0,
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  duoKey: (v1, v2, delim=',') => v1 < v2 ? `${v1}${delim}${v2}` : `${v2}${delim}${v1}`,
  combineObjs: (obj1, obj2) => ({ ...obj1, ...obj2 }),
  inspire: ({ name, insps={}, methods, statik={}, description='' }) => {
    let Insp = function(...p) {
      return (this && this.constructor === Insp) ? this.init(...p) : new Insp(...p);
    };
    Object.defineProperty(Insp, 'name', { value: name });
    
    // Calculate a map of all inspirations for `isInspiredBy` testing
    Insp.uid = U.INSP_UID++;
    Insp.insps = { [Insp.uid]: Insp };
    Insp.isInspiredBy = Insp0 => Insp.insps.has(Insp0.uid);
    insps.forEach(SupInsp => { if (U.isType(SupInsp, Function) && SupInsp.has('uid')) Insp.insps.gain(SupInsp.insps); });
    
    // Initialize prototype
    Insp.prototype = Object.create(BaseInsp.prototype);
    
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
  isInspiredBy: function(Insp1, Insp2) {
    if (!Insp2.has('uid')) throw new Error(`U.typeOf(Insp2) has no "uid"!`);
    try {
      return (U.isType(Insp1, Function) ? Insp1 : Insp1.constructor).insps.has(Insp2.uid);
    } catch(err) { return false; }
  },
  typeOf: function(obj) {
    if (obj === null) return '<NULL>';
    if (typeof obj === 'undefined') return '<UNDEFINED>';
    try { return (obj.constructor === Function && obj.name) ? `<Insp(${obj.name})>` : `<insp(${obj.constructor.name})>`; } catch (e) {}
    return '<UNKNOWN>';
  },
};
let C = {
  skip: { SKIP: true },
  sync: {
    none: 0,    // Never sync
    total: 1,   // Only sync entire structure
    delta: 2    // Sync partial structure
  },
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
  },
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
  },
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
  },
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
    for (let k in this.holders) this.holders[k](value);
  },
  mod: function(f) {
    this.update(f(this.value));
  },
})});
let CalcWob = U.inspire({ name: 'CalcWob', insps: { Wobbly }, methods: (insp, Insp) => ({
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
  },
})});

let World = U.inspire({ name: 'World', methods: (insp, Insp) => ({
  init: function() {
    this.clients = {};
    this.uninitializedClients = {};
    
    this.entities = {};
    this.addEntities = {};
    this.remEntities = {};
    this.updEntities = {};
  },
  getNextUid: function() { throw new Error('not implemented'); },
  addClient: function(client) {
    this.addEntity(client);
    this.clients[client.uid] = client; // uid is only available after add
    this.uninitializedClients[client.uid] = client;
    return client;
  },
  remClient: function(client) {
    this.remEntity(client);
    delete this.clients[client.uid];
    delete this.uninitializedClients[client.uid];
    return client;
  },
  addEntity: function(entity) {
    if (entity.world && entity.world !== this) throw new Error(`Entity belongs to another world`);
    
    // Set uid and world
    if (entity.uid === null) entity.setUid(this.getNextUid());
    entity.world = this;
    
    this.addEntities[entity.uid] = entity;
    return entity;
  },
  remEntity: function(entity) {
    if (entity.world !== this) throw new Error(`Entity ${entity.constructor.name} ${entity.world ? 'belongs to another world' : 'has no world'}`);
    if (!entity.inWorld) return;
    this.remEntities[entity.uid] = entity;
    return entity;
  },
  updEntity: function(entity, updatedProps) {
    if (U.empty(updatedProps)) return;
    if (!entity.inWorld) return this.addEntity(entity);
    if (!this.updEntities.has(entity.uid)) this.updEntities[entity.uid] = {};
    this.updEntities[entity.uid].gain(updatedProps);
    return entity;
  },
  doTickResolution: function() {
    
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
        entity.inWorld = true;
        entity.start();
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
})});
let Entity = U.inspire({ name: 'Entity', methods: (insp, Insp) => ({
  $fullFlatDef: Insp => {
    let fullDef = {};
    
    // Add on all inspiring defs (note that `Insp.insps` contains Insp)
    // TODO: Multiple inheritance can result in some defs being clobbered in this namespace...
    for (let SupInsp of Object.values(Insp.insps)) if (SupInsp !== Insp) fullDef.gain(Entity.fullFlatDef(SupInsp));
    
    // Add on Insp's flat def
    if (!Insp.has('genFlatDef')) throw new Error(`Insp ${Insp.name} doesn't support 'genFlatDef'`);
    fullDef.gain(Insp.genFlatDef(fullDef));
    
    // Add on any relational def
    fullDef.gain(Insp.has('relSchemaDef') ? Insp.relSchemaDef : {});
    
    return fullDef;
  },
  $genFlatDef: () => ({
    type: { sync: C.sync.delta,
      change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.constructor.name,
      actual: (inst) => inst.constructor
    }
  }),
  $relate11: (name, sync, Cls1, link1, Cls2, link2) => {
    // For 1-to-1, links are pointer names
    
    let syncFunc = (inst1, link1, inst2, link2) => {
      if (sync < C.sync.delta) return;
      let world = inst1.world || inst2.world;
      if (!world) return;
      world.updEntity(inst1, { [link1]: 1 });
      world.updEntity(inst2, { [link2]: 1 });
    };
    
    let both = [
      [ Cls1, link1, Cls2, link2 ],
      [ Cls2, link2, Cls1, link1 ]
    ];
    
    for (let [ Cls1, link1, Cls2, link2 ] of both) {
      
      if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
      Cls1.relSchemaDef[link1] = ((link1, link2) => ({ sync,
        change: (inst1, p, act=p.act, inst2=p[link1] || inst1[link1]) => ({
          attach: (inst1, inst2) => {
            if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
            if (inst2[link2]) throw new Error(`Can't attach rel "${name}" (already have ${inst2.constructor.name}'s ${link2})`);
            inst1[link1] = inst2;
            inst2[link2] = inst1;
            syncFunc(inst1, link1, inst2, link2);
          },
          detach: (inst1, inst2) => {
            if (inst1[link1] !== inst1) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
            inst1[link1] = null;
            inst2[link2] = null;
            syncFunc(inst1, link1, inst2, link2);
          }
        })[act](inst1, inst2),
        serial: (inst1) => inst1[link1] ? inst1[link1].uid : null,
        actual: (inst1) => inst1[link1]
      }))(link1, link2);
      
    }
    
  },
  $relate1M: (name, sync, Cls1, link1, ClsM, linkM) => {
    
    // For 1-to-M, the 1 links with a pointer and the M links back with a map
    // Cls1 is the singular instance - ClsM links to many instances of Cls1
    
    let syncFunc = (inst1, instM) => {
      if (sync < C.sync.delta) return;
      // Certain `inst1.world` exists - otherwise there'd be no uid for linking
      inst1.world.updEntity(inst1, { [link1]: 1 });
      inst1.world.updEntity(instM, { [linkM]: 1 });
    };
      
    if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
    Cls1.relSchemaDef[link1] = { sync,
      change: (inst1, p, act=p.act, instM=p[link1] || inst1[link1]) => ({
        attach: (inst1, instM) => {
          if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
          inst1[link1] = instM;
          instM[linkM][inst1.uid] = inst1;
          syncFunc(inst1, instM);
        },
        detach: (inst1, instM) => {
          if (inst1[link1] !== instM) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
          inst1[link1] = null;
          delete instM[linkM][inst1.uid];
          syncFunc(inst1, instM);
        }
      })[act](inst1, instM),
      serial: (inst1) => inst1[link1] ? inst1[link1].uid : null,
      actual: (inst1) => inst1[link1]
    };
    
    if (!ClsM.has('relSchemaDef')) ClsM.relSchemaDef = {};
    ClsM.relSchemaDef[linkM] = { sync,
      change: (instM, p, act=p.act, inst1=p[link1]) => ({
        attach: (instM, inst1) => {
          if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
          inst1[link1] = instM;
          instM[linkM][inst1.uid] = inst1;
          syncFunc(inst1, instM);
        },
        detach: (instM, inst1) => {
          if (inst1[link1] !== instM) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
          inst1[link1] = null;
          delete instM[linkM][inst1.uid];
          syncFunc(inst1, instM);
        }
      })[act](instM, inst1),
      serial: (instM) => instM[linkM].map(ent => 1), // Only the keys are important
      actual: (instM) => instM[linkM]
    };
      
  },
  $relateM1: (name, sync, ClsM, linkM, Cls1, link1) => {
    Entity.relate1M(name, sync, Cls1, link1, ClsM, linkM);
  },
  $relateMM: (name, sync, Cls1, link1, Cls2, link2) => {
    
    // For M-to-M, links are maps of uids
    
    // TODO: Small changes to large related sets cause the entire set to be synced...
    let syncFunc = (inst1, link1, inst2, link2) => {
      if (sync < C.sync.delta) return;
      // Certain `inst1.world` exists - otherwise there'd be no uid for linking
      inst1.world.updEntity(inst1, { [link1]: 1 });
      inst1.world.updEntity(inst2, { [link2]: 1 });
    };
    
    let both = [
      [ Cls1, link1, Cls2, link2 ],
      [ Cls2, link2, Cls1, link1 ]
    ];
    
    for (let [ Cls1, link1, Cls2, link2 ] of both) {
      
      if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
      Cls1.relSchemaDef[link1] = ((link1, link2) => ({ sync,
        change: (inst1, p, act=p.act, inst2=p[link1] || inst1[link1]) => ({
          attach: (inst1, inst2) => {
            inst1[link1][inst2.uid] = inst2;
            inst2[link2][inst1.uid] = inst1;
            syncFunc(inst1, link1, inst2, link2);
          },
          detach: (inst1, inst2) => {
            delete inst1[link1][inst2.uid];
            delete inst2[link2][inst1.uid];
            syncFunc(inst1, link1, inst2, link2);
          }
        })[act](inst1, inst2),
        serial: (inst1) => inst1[link1].map(ent => 1),
        actual: (inst1) => inst1[link1]
      }))(link1, link2);
      
    }
    
  },
  
  init: function() {
    this.uid = null;
    this.world = null;
    this.inWorld = false;
    this.zones = {};
  },
  getFlatDef: function() {
    if (!this.constructor.has('flatDef')) this.constructor.flatDef = Entity.fullFlatDef(this.constructor);
    return this.constructor.flatDef;
  },
  mod: function(propName, newVal) {
    let flatDef = this.getFlatDef();
    if (!flatDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${propName}`);
    let { change, sync } = flatDef[propName];
    change(this, newVal);
    if (this.world && sync >= C.sync.delta) this.world.updEntity(this, { [propName]: 1 });
  },
  modF: function(propName, f) {
    let flatDef = this.getFlatDef();
    if (!flatDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${propName}`);
    let { change, sync, actual, serial } = flatDef[propName];
    let oldVal = (actual || serial)(this);
    let newVal = f(oldVal);
    if (newVal === oldVal) return false; // TODO: should "actual" be optional?
    change(this, newVal);
    if (this.world && sync >= C.sync.delta) this.world.updEntity(this, { [propName]: 1 });
    return true;
  },
  serializePart: function(fieldMap) {
    let flatDef = this.getFlatDef();
    return fieldMap.map((v, k) => flatDef[k].serial(this));
  },
  serializeFull: function() {
    let ret = {};
    for (let [ k, { sync, serial } ] of Object.entries(this.getFlatDef())) if (sync >= C.sync.total) ret[k] = serial(this);
    return ret;
  },
  setUid: function(uid) {
    if (this.uid !== null) throw new Error(`Can't set new uid for ${this.uid}`);
    let cnst = (() => { try { return uid.constructor } catch(err) { return null; } })();
    if (cnst !== String && (cnst !== Number || uid !== uid)) throw new Error(`Invalid uid: ${uid}`);
    this.uid = uid;
  },
  start: function() { throw new Error(`not implemented for ${U.typeOf(this)}`); },
  update: function(secs) { throw new Error(`not implemented for ${U.typeOf(this)}`); },
  end: function() { throw new Error(`not implemented for ${U.typeOf(this)}`); }
})});

global.gain({
  // Utility stuff
  output: console.log.bind(console),
  U, C, SmoothingVal, Wobbly, CalcWob,
  Timeout, Interval,
  
  // Game stuff
  World, Entity
});
