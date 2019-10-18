/*
Huts are built on Foundations. There is OurHut representing ourself in
the hinterlands, and FarHuts representing others.

A Foundation runs on any platform which supports javascript - redhat,
digitalocean, heroku, browser, etc.

Huts connect to each other through a variable number of Connections

Huts can be uphill, downhill or level with each other. Any Hut may be at
the very top, or in communication with a single upwards Hut.

Any Hut with Huts underneath it can support a variety of Realities. A
Hut at the very bottom runs using a single Reality.
*/

let doNetworkDbg = 1;

let Goal = U.inspire({ name: 'Goal', methods: (insp, Insp) => ({
  init: function({ name, desc, detect, enact }) {
    this.name = name;
    this.desc = desc;
    this.detect = detect;
    this.enact = enact;
    this.children = Set();
  },
  attempt: async function(foundation, args) {
    if (!this.detect(args)) return false;
    await this.enact(foundation, args);
    for (let child of this.children) await child.attempt(foundation, args);
    return true;
  }
})});
let CpuPool = U.inspire({ name: 'CpuPool', methods: (insp, Insp) => ({
  init: function(dbgLimit=150) {
    this.cpuIdCnt = 0;
    this.cpus = {};
    this.dbgLimit = dbgLimit;
    this.cpuWob = U.Wob();
  },
  dbgItem: function(item) {
    let ret = JSON.stringify(item);
    return (ret.length > this.dbgLimit) ? ret.substr(0, this.dbgLimit - 3) + '...' : ret;
  },
  makeCpuConn: function(serverWob, decorateConn) {
    let conn = U.Hog();
    decorateConn(conn); // Note that decoration may apply a cpuId
    serverWob.decorateConn(conn);
    conn.serverWob = serverWob;
    
    if (!conn.cpuId) conn.cpuId = U.base62(this.cpuIdCnt++).padHead(6, '0')
      + U.base62(Math.random() * Math.pow(62, 6)).padHead(6, '0');
    
    let cpuId=conn.cpuId, cpu=null, serverConns=null, isKnownCpu=this.cpus.has(cpuId);
    let dbgDesc = doNetworkDbg ? `${serverWob.desc.substr(0, 4)}:${cpuId}` : '';
    
    if (isKnownCpu) { // Check if we've seen this cpu on another connection
      cpu = this.cpus[cpuId];
      serverConns = cpu.serverConns;
      if (serverConns.has(serverWob)) throw new Error(`CpuId ${cpuId} connected twice via ${serverWob.desc}`);
    } else {
      cpu = U.Hog();
      cpu.cpuId = cpuId;                      // Unique, sensitive id of this cpu
      cpu.serverConns = serverConns = Map();  // Maps a server to the connection this cpu has on that server
      cpu.connWob = U.Wob();
      this.cpus[cpuId] = cpu;
      this.cpuWob.wobble(cpu)
      if (doNetworkDbg) console.log(`>>JOIN ${dbgDesc}`);
    }
    
    if (doNetworkDbg) {
      
      console.log(`>-HOLD ${dbgDesc} on ${serverWob.desc}`);
      conn.hear.hold(([ msg, reply ]) => console.log(`--HEAR ${dbgDesc}: ${this.dbgItem(msg)}`));
      let origTell = conn.tell;
      conn.tell = (...args) => {
        console.log(`--TELL ${dbgDesc}: ${this.dbgItem(args[0])}`);
        return origTell(...args);
      };
      
      conn.shutWob().hold(() => {
        serverConns.rem(serverWob);
        if (doNetworkDbg) console.log(`<-DROP ${dbgDesc} on ${serverWob.desc} (${serverConns.size} remaining)`);
        if (serverConns.isEmpty()) {
          delete this.cpus[cpuId];
          cpu.shut();
          if (doNetworkDbg) console.log(`<<EXIT ${dbgDesc}`);
        }
      });
    }
    
    serverConns.set(serverWob, conn);
    cpu.connWob.wobble(conn);
    serverWob.wobble(conn); // TODO: Inappropriately coupled to servers??
    
    return conn;
  },
  getCpu: function(cpuId) {
    return this.cpus.has(cpuId) ? this.cpus[cpuId] : null;
  }
})});
let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
  init: function() {
    this.goals = this.defaultGoals();
    this.raiseArgs = {};
  },
  defaultGoals: function() {
    
    let settleGoal = Goal({
      name: 'settle',
      desc: 'Settle our Hut down',
      detect: args => args.has('settle'),
      enact: async (foundation, args) => {
        let [ hut=null, bearing=null ] = args.settle.split('.');
        if (args.has('hut'))      hut = args.hut;
        if (args.has('bearing'))  bearing = args.bearing;
        
        //if (hut && args.has('hut') && hut !== args.hut) throw new Error(`Conflicting "hut" values "${hut}" and "${args.hut}"`);
        //if (bearing && args.has('bearing') && bearing !== args.bearing) throw new Error(`Conflicting "bearing" values "${bearing}" and "${args.bearing}"`);
        
        let rootRoom = await foundation.establishHut({ hut, bearing, ...args });
        if (!rootRoom.built.has('open')) throw new Error(`Room "${rootRoom.name}" isn't setup for settling`);
        
        await rootRoom.built.open();
        console.log(`Settled ${rootRoom.name} on ${this.getPlatformName()}`);
      }
    });
    
    return [ settleGoal ];
    
  },
  getPlatformName: C.notImplemented,
  
  // Platform
  getMs: function() { return +new Date(); },
  queueTask: C.notImplemented, // TODO: No more `process.nextTick`! Use this instead! // TODO: Better name for "queueTask" should simply imply that the task occurs after serial processing is done
  makeHttpServer: async function(pool, ip, port) { return C.notImplemented.call(this); },
  makeSoktServer: async function(pool, ip, port) { return C.notImplemented.call(this); },
  getRootReal: async function() { return C.notImplemented.call(this); },
  formatError: C.notImplemented,
  
  // Setup
  raise: async function(raiseArgs) {
    
    this.raiseArgs = raiseArgs;
    
    let goalAchieved = false;
    for (let goal of this.goals) if (await goal.attempt(this, raiseArgs)) { goalAchieved = true; break; }
    if (!goalAchieved) console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(raiseArgs, null, 2)}`);
    
  },
  establishHut: async function(args) { return C.notImplemented.call(this); },
  installFoundation: C.notImplemented,
  genInitBelow: async function(contentType) { return C.notImplemented.call(this); },
  parseUrl: function(url) {
    let [ full, protocol, host, port=80, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
    if (!path.hasHead('/')) path = `/${path}`;
    
    return {
      protocol, host, port, path,
      query: (query ? query.split('&') : []).toObj(pc => pc.has('=') ? pc.split('=') : [ pc, null ])
    };
  },
})});

U.setup.gain({ Foundation, Goal, CpuPool });
