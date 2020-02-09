/*
Huts are built on Foundations. There is OurHut representing ourself in
the hinterlands, and FarHuts representing others.

A Foundation sits on any platform which supports javascript - redhat,
digitalocean, heroku, browser, etc.

Huts connect to each other through a variable number of Connections

Huts can be uphill, downhill or level with each other. Any Hut may be at
the very top, or in communication with a single upwards Hut.

Any Hut with Huts underneath it can support a variety of Realities. A
Hut at the very bottom runs using a single Reality.
*/

(() => {
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let Saved = U.inspire({ name: 'Saved', insps: { Drop }, methods: (insp, Insp) => ({
    init: function() {},
    getContentType: function() { return null; },
    update: C.notImplemented,
    getPipe: C.notImplemented,
    getContent: C.notImplemented,
    getNumBytes: C.notImplemented,
    onceDry: C.notImplemented
  })});
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
  
  // TODO: Merge `U` and `Foundation`??
  let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
    
    $protocols: {
      http: { secure: false, defaultPort: 80 },
      https: { secure: true, defaultPort: 443 },
      ws: { secure: false, defaultPort: 80 },
      wss: { secure: true, defaultPort: 443 },
    },
    
    init: function() {
      this.goals = this.defaultGoals();
      this.raiseArgs = {};
      this.uidCnt = 0;
      this.rootReal = null;
      
      // TODO: `Foundation.prototype.getRootHut` should look at what
      // "ServerTech" exists, and then process options based on that
      // data, including checking to see the "enabledness" of every tech
      // included here. A major advantage of this will be improving how
      // BELOW handles adding the root server; right now every
      // server-making function BELOW needs to add a single ABOVE server
      // as a connection which is SUCKY. But if after `Foundation` has
      // setup all servers, `FoundationBrowser` (or any FoundationBelow)
      // can look at all the instances for each server tech, and add the
      // ABOVE as a client to each. Much nicer! 
      this.serverTech = {
        http: { fn: (...args) => this.makeHttpServer(...args), instances: [] },
        sokt: { fn: (...args) => this.makeSoktServer(...args), instances: [] }
      };
    },
    defaultGoals: function() {
      
      let settleGoal = Goal({
        name: 'settle',
        desc: 'Settle our Hut down',
        detect: args => args.has('settle'),
        enact: async (foundation, args) => {
          let [ hut=null, bearing=null ] = args.settle.split('.');
          if (!args.has('title')) args.title = U.isType(hut, Object) ? hut.name : hut;
          
          let rootRoom = await foundation.establishHut({ hut, bearing, ...args });
          if (!rootRoom.built.has('open')) throw Error(`Room "${rootRoom.name}" isn't setup for settling`);
          
          console.log(`Settling ${rootRoom.name} on ${this.getPlatformName()}`);
          await rootRoom.built.open();
        }
      });
      
      return [ settleGoal ];
      
    },
    getPlatformName: C.notImplemented,
    
    getRootHut: async function(options={}) {
      
      // Note: An instance of node could have multiple RootHuts, each
      // representing a server with a variety of Roads, and different
      // servers could host entirely different applications - all within
      // the same node VM context!
      
      // Ensure good defaults inside `options`
      if (!options.has('hosting')) options.hosting = {};
      if (!options.hosting.has('host')) options.hosting.host = 'localhost';
      if (!options.hosting.has('port')) options.hosting.port = 80;
      if (!options.hosting.has('sslArgs')) options.hosting.sslArgs = null;
      if (!options.hosting.sslArgs) options.hosting.sslArgs = {};
      if (!options.hosting.sslArgs.has('keyPair')) options.hosting.sslArgs.keyPair = null;
      if (!options.hosting.sslArgs.has('selfSign')) options.hosting.sslArgs.selfSign = null;
      if (!options.has('protocols')) options.protocols = {};
      if (!options.protocols.has('http')) options.protocols.http = true;
      if (!options.protocols.has('sokt')) options.protocols.sokt = true;
      if (!options.has('heartMs')) options.heartMs = 1000 * 30;
      
      let hut = U.rooms.hinterlands.built.Hut(this, '!root', { heartMs: options.heartMs });
      
      let { hosting, protocols, heartMs } = options;
      if (protocols.http) {
        console.log(`Using HTTP: ${hosting.host}:${hosting.port + 0}`);
        this.makeHttpServer(hut, { host: hosting.host, port: hosting.port + 0, ...hosting.sslArgs });
      }
      if (protocols.sokt) {
        console.log(`Using SOKT: ${hosting.host}:${hosting.port + 1}`);
        this.makeSoktServer(hut, { host: hosting.host, port: hosting.port + 1, ...hosting.sslArgs });
      }
      /// if (protocols.tcp)
      ///   this.makeTcpServer(hut, { host: hosting.host, port: hosting.port + 2, ...hosting.sslArgs });
      
      return hut;
    },
    getRootReal: C.notImplemented,
    
    // Platform
    getMs: function() { return +new Date(); },
    queueTask: C.notImplemented,
    makeHttpServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    makeSoktServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    formatError: C.notImplemented,
    getOrderedRoomNames: C.notImplemented,
    getTerm: C.notImplemented,
    getUid: function() { return U.base62(this.uidCnt++).padHead(8, '0'); },
    
    // Setup
    raise: async function(raiseArgs) {
      
      if (!raiseArgs.has('mode')) raiseArgs.mode = 'prod';
      
      this.raiseArgs = raiseArgs;
      let goalAchieved = false;
      for (let goal of this.goals) if (await goal.attempt(this, this.raiseArgs)) { goalAchieved = true; break; }
      if (!goalAchieved) console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(this.raiseArgs, null, 2)}`);
      
    },
    establishHut: async function(args) { C.notImplemented.call(this); },
    parseUrl: function(url) {
      let [ full, protocol, host, port=null, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
      
      if (!Insp.protocols.has(protocol)) throw Error(`Invalid protocol: "${protocol}"`);
      
      if (!path.hasHead('/')) path = `/${path}`;
      if (!port) port = Insp.protocols[protocol].defaultPort;
      
      return {
        protocol, host, port: parseInt(port, 10), path,
        query: (query ? query.split('&') : []).toObj(pc => pc.has('=') ? pc.split('=') : [ pc, null ])
      };
      
    },
  })});
  
  U.setup.gain({ Saved, Goal, Foundation });
})();
