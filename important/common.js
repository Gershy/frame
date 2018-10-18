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
  update(amt=this.amt) { this.current = (this.current * (1 - amt)) + (this.desired * amt); return this.current; }
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
  addEntity(entity) {
    entity.uid = this.getNextUid();
    entity.world = this;
    this.addEntities[entity.uid] = entity;
    return entity;
  }
  remEntity(entity) {
    this.remEntities[entity.uid] = entity;
    return entity;
  }
  updEntity(entity, updatedData) {
    if (!entity.inWorld) return;
    if (!this.updEntities.hasOwnProperty(entity.uid)) this.updEntities[entity.uid] = {};
    this.updEntities[entity.uid].gain(updatedData);
    return entity;
  }
  doTickResolution() {
    
    let sendAddEntities = {};
    let sendRemEntities = {};
    let sendUpdEntities = {};
    
    // Process adds and rems in a cascade-supported style
    while (!U.empty(this.addEntities) || !U.empty(this.remEntities)) {
      
      let [ add, rem ] = [ this.addEntities, this.remEntities ];
      this.addEntities = {};
      this.remEntities = {};
      
      // Start all added entities
      for (let [ uid, entity ] of Object.entries(add)) {
        this.entities[uid] = entity;
        entity.start();
        sendAddEntities[uid] = entity.now();
      }
      
      // End all removed entities
      for (let [ uid, entity ] of Object.entries(rem)) {
        entity = this.entities[uid];
        delete this.entities[uid];
        entity.end();
        sendRemEntities[uid] = 1;
      }
      
    }
    
    // Updates are pre-calculated! Send the data we already have
    sendUpdEntities = this.updEntities;
    this.updEntities = {};
    
    let result = {};
    if (!U.empty(sendAddEntities)) result.add = sendAddEntities;
    if (!U.empty(sendRemEntities)) result.rem = sendRemEntities;
    if (!U.empty(sendUpdEntities)) result.upd = sendUpdEntities;
    
    return result;
    
  }
};

class Entity {
  constructor(data=null) {
    this.uid = -1;
    this.world = null;
    this.inWorld = false;
  }
  start() { this.inWorld = true; }
  update(secs) { throw new Error(`not implemented for ${this.constructor.name}`); }
  end() { this.inWorld = false; }
  now() {
    return {
      type: this.constructor.name
    };
  }
};

global.gain({
  // Utility stuff
  U, SmoothingVal,
  
  // Game stuff
  World, Entity
});
