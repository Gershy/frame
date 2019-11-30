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

(() => {
  let doNetworkDbg = 1;

  //let { Load, FreeLoad, Flow, Flux } = U.life;
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;

  let Goal = U.inspire({ name: 'Goal', methods: (insp, Insp) => ({
    init: function({ name, desc, detect, enact }) {
      ({}).gain.call(this, { name, desc, detect, enact, children: Set() });
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
      this.cpuNozz = TubSet(null, Nozz());
    },
    dbgItem: function(item) {
      let ret = JSON.stringify(item);
      return (ret.length > this.dbgLimit) ? ret.substr(0, this.dbgLimit - 3) + '...' : ret;
    },
    makeCpuConn: function(server, decorateConn) {
      let conn = Drop(defDrier());
      conn.desc = `Conn on ${server.desc}`;
      decorateConn(conn); // Note that decoration may apply a cpuId
      server.decorateConn(conn);
      conn.server = server;
      
      if (!conn.hear) throw new Error('Invalid conn: missing "hear"');
      if (!conn.tell) throw new Error('Invalid conn: missing "tell"');
      
      if (!conn.cpuId) conn.cpuId = U.base62(this.cpuIdCnt++).padHead(6, '0')
        + U.base62(Math.random() * Math.pow(62, 6)).padHead(6, '0');
      
      let cpuId=conn.cpuId, cpu=null, serverConns=null, isKnownCpu=this.cpus.has(cpuId);
      let dbgDesc = doNetworkDbg ? `${cpuId}:${server.desc.substr(0, 4)}` : '';
      
      if (isKnownCpu) { // Check if we've seen this cpu on another connection
        cpu = this.cpus[cpuId];
        serverConns = cpu.serverConns;
        if (serverConns.has(server)) throw new Error(`CpuId ${cpuId} connected twice via ${server.desc}`);
      } else {
        // All Conns dry up when the Cpu dries
        cpu = Drop(defDrier(), () => { for (let [ s, c ] of cpu.serverConns) c.dry(); });
        cpu.cpuId = cpuId;                      // Unique, sensitive id of this cpu
        cpu.serverConns = serverConns = Map();  // Maps a server to the connection this cpu has on that server
        cpu.connNozz = TubSet(null, Nozz());
        this.cpus[cpuId] = cpu;
        this.cpuNozz.nozz.drip(cpu);
        
        if (doNetworkDbg) console.log(`>>JOIN ${cpuId}`);
      }
      
      if (doNetworkDbg) {
        
        console.log(`>-HOLD ${dbgDesc} on ${server.desc}`);
        conn.hear.route(([ msg, reply ]) => console.log(`--HEAR ${dbgDesc}: ${this.dbgItem(msg)}`));
        let origTell = conn.tell;
        conn.tell = (...args) => {
          console.log(`--TELL ${dbgDesc}: ${this.dbgItem(args[0])}`);
          return origTell(...args);
        };
        
        conn.drierNozz().route(() => {
          serverConns.rem(server);
          if (doNetworkDbg) console.log(`<-DROP ${dbgDesc} on ${server.desc} (${serverConns.size} remaining)`);
          if (serverConns.isEmpty()) {
            delete this.cpus[cpuId];
            cpu.dry();
            if (doNetworkDbg) console.log(`<<EXIT ${cpuId}`);
          }
        });
      }
      
      serverConns.set(server, conn);
      cpu.connNozz.nozz.drip(conn);
      server.drip(conn); // TODO: Inappropriately coupled to servers??
      
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
          
          console.log(`Settling ${rootRoom.name} on ${this.getPlatformName()}`);
          await rootRoom.built.open();
          
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
    getOrderedRoomNames: C.notImplemented,
    
    // Setup
    raise: async function(raiseArgs) {
      
      this.raiseArgs = raiseArgs;
      
      let goalAchieved = false;
      for (let goal of this.goals) if (await goal.attempt(this, raiseArgs)) { goalAchieved = true; break; }
      if (!goalAchieved) console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(raiseArgs, null, 2)}`);
      
    },
    establishHut: async function(args) { return C.notImplemented.call(this); },
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

})();
