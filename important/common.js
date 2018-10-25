let machine = null;
try { machine = window ? 'client' : 'server' } catch(err) { machine = 'server'; }

Object.defineProperty(Object.prototype, 'forEach', {
  value: function(fn) {
    for (let k in this) fn(this[k], k);
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'map', {
  value: function(fn) {
    let ret = {};
    for (let k in this) ret[k] = fn(this[k], k);
    return ret;
  },
  enumerable: false
});
Object.defineProperty(Object.prototype, 'gain', {
  value: function(obj) {
    for (let k in obj) this[k] = obj[k];
    return this;
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

let U = {
  int32: Math.pow(2, 32),
  intUpperBound: Math.pow(2, 32),
  intLowerBound: -Math.pow(2, 32),
  empty: obj => { for (let k in obj) return false; return true; },
  duoKey: (v1, v2, delim=',') => v1 < v2 ? `${v1}${delim}${v2}` : `${v2}${delim}${v1}`,
  combineObjs: (obj1, obj2) => ({ ...obj1, ...obj2 })
};
class SmoothingVal {
  constructor(initial, amt=0.1) {
    this.desired = initial;
    this.current = initial;
    this.amt = amt;
  }
  change(v) { this.desired = v; }
  smooth()  { return this.current; }
  choppy()  { return this.desired; }
  update(desired=this.desired) {
    this.desired = desired;
    this.current = (this.current * (1 - this.amt)) + (this.desired * this.amt); return this.current;
  }
};
class Timeout {
  constructor(f) {
    this.f = f;
    this.ref = null;
  }
  start(delay=1000) {
    if (this.ref !== null) throw new Error('Already started');
    this.ref = setTimeout(this.f, delay);
  }
  stop() {
    clearTimeout(this.ref);
    this.ref = null;
  }
}
class Interval {
  constructor(f) {
    this.f = f;
    this.ref = null;
  }
  start(delay=1000) {
    if (this.ref !== null) throw new Error('Already started');
    this.ref = setInterval(this.f, delay);
  }
  stop() {
    clearInterval(this.ref);
    this.ref = null;
  }
}
class Wobbly {
  constructor(value=null) {
    this.uid = UID++;
    this.nextInd = 0;
    this.holders = {};
    this.value = value;
  }
  hold(func) {
    let ind = this.nextInd++;
    func[`~wob${this.uid}`] = ind;
    this.holders[ind] = func;
    func(this.value);
  }
  drop(func) {
    let ind = func[`~wob${this.uid}`];
    delete func[`~wob${this.uid}`];
    delete this.holders[ind];
  }
  update(val) {
    this.value = val;
    for (let k in this.holders) this.holders[k](val);
  }
  mod(f) {
    this.update(f(this.value));
  }
};
class CalcWob extends Wobbly {
  constructor(wobblies, func) {
    super();
    this.wobblies = wobblies;
    this.func = func;
    this.watchFunc = () => {
      let newVal = this.calc();
      if (newVal !== this.value) this.update(newVal);
    };
    this.value = this.calc();
    this.wobblies.forEach(w => w.hold(this.watchFunc));
  }
  calc() {
    return this.func(...this.wobblies.map(w => w.value));
  }
};

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
};
class Entity {
  static genSerialDef() {
    return {
      type: { scope: 'global',
        change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
        serial: (inst) => inst.constructor.name
      }
    }
  }
  constructor() {
    this.uid = null;
    this.world = null;
    this.inWorld = false;
    this.zones = {};
  }
  getSerialDef() {
    if (!this.constructor.has('serialDef')) this.constructor.serialDef = this.constructor.genSerialDef();
    return this.constructor.serialDef;
  }
  mod(propName, ...vals) {
    let serialDef = this.getSerialDef();
    if (!serialDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.serialDef.${propName}`);
    let { change, scope } = serialDef[propName];
    change(this, ...vals);
    if (this.world && scope === 'global') this.world.updEntity(this, { [propName]: 1 });
  }
  modF(propName, f) {
    let serialDef = this.getSerialDef();
    if (!serialDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.serialDef.${propName}`);
    let { change, scope, actual, serial } = serialDef[propName];
    let val = (actual || serial)(this); // TODO: should "actual" be optional?
    let newVal = f(val);
    if (val === newVal) return false;
    change(this, newVal);
    if (this.world && scope === 'global') this.world.updEntity(this, { [propName]: 1 });
    return true;
  }
  serializePart(fieldMap) {
    let serialDef = this.getSerialDef();
    return fieldMap.map((v, k) => serialDef[k].serial(this));
  }
  serializeFull() {
    let ret = {};
    for (let [ prop, { scope, serial } ] of Object.entries(this.getSerialDef())) {
      if (scope === 'global' || scope === 'fullOnly') ret[prop] = serial(this);
    }
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
};

global.gain({
  // Utility stuff
  output: console.log.bind(console),
  Timeout, Interval,
  U, SmoothingVal, Wobbly, CalcWob,
  
  // Game stuff
  World, Entity
});
