// The "foundation" is environment-level normalization. It configures javascript to
// operate consistently whether in the browser, in node.js, on a particular web
// platform, etc. Also, for each platform, the foundation takes into account whether
// the hut is alone, above, below, or between

// TODO: Write classes for transports

let doNetworkDbg = true;

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
  // TODO: CpuPool should probably written into hinterlands.Lands...
  init: function() {
    this.cpus = {};
    this.dbgLimit = 150;
  },
  dbgItem: function(item) {
    let ret = JSON.stringify(item);
    return (ret.length > this.dbgLimit) ? ret.substr(0, this.dbgLimit - 3) + '...' : ret;
  },
  addConn: function(cpuId, server, conn) {
    
    if (!conn.hear || !conn.hear.hold) throw new Error('Invalid conn: ' + U.typeOf(conn));
    
    if (!this.cpus.has(cpuId)) {
      
      this.cpus[cpuId] = { cpuId, addedMs: U.foundation.getMs(), conns: Map() };
      if (doNetworkDbg) console.log(`>>JOIN ${cpuId}`);
    }
    
    // Track connection
    this.cpus[cpuId].conns.set(server, conn);
    if (doNetworkDbg) console.log(`>-HOLD ${cpuId} on ${server.desc}`);
    
    if (doNetworkDbg) conn.hear.hold(([ msg, reply ]) => console.log(`--HEAR ${cpuId}: ${this.dbgItem(msg)}`));
    
    let origTell = conn.tell;
    if (doNetworkDbg) conn.tell = (...args) => {
      console.log(`--TELL ${cpuId}: ${this.dbgItem(args[0])}`);
      return origTell(...args);
    };
    
    // If connection shuts, untrack connection. If no connections left,
    // untrack entire cpu!
    conn.shutWob().hold(() => {
      this.cpus[cpuId].conns.rem(server);
      if (doNetworkDbg) console.log(`<-DROP ${cpuId} on ${server.desc}`);
      
      if (this.cpus[cpuId].conns.toArr(v => v).isEmpty()) {
        delete this.cpus[cpuId];
        if (doNetworkDbg) console.log(`<<EXIT ${cpuId}`);
      }
    });
    
    return conn;
  },
  getConn: function(cpuId, server) {
    if (!this.cpus.has(cpuId)) return null;
    return this.cpus[cpuId].conns.get(server);
  },
  remConn: function(cpuId, server) {
    if (!this.cpus.has(cpuId)) throw new Error(`Can't rem conn; no cpu at id "${cpuId}"`);
    if (!this.cpus[cpuId].conns.has(server)) throw new Error(`Can't rem conn; cpu at id "${cpuId}" has no conn for server "${server.desc}"`);
    this.cpus[cpuId].conns.rem(server);
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
        
        if (hut && args.has('hut') && hut !== args.hut) throw new Error(`Conflicting "hut" values "${hut}" and "${args.hut}"`);
        if (bearing && args.has('bearing') && bearing !== args.bearing) throw new Error(`Conflicting "bearing" values "${bearing}" and "${args.bearing}"`);
        
        let rootRoom = await foundation.establishHut({ hut, bearing, ...args });
        if (!rootRoom.built.has('open')) throw new Error(`Room "${rootRoom.name}" isn't setup for settling`);
        
        await rootRoom.built.open();
        console.log(`Settled ${rootRoom.name} on ${this.getPlatformName()}`);
      }
    });
    
    let testGoal = Goal({
      name: 'test',
      desc: 'Test everything is ok with our Hut',
      detect: args => args.has('test'),
      enact: async (foundation, args) => {
        
        let [ hut=null, bearing=null ] = args.test.split('.');
        if (hut && args.has('hut') && hut !== args.hut) throw new Error(`Conflicting "hut" values "${hut}" and "${args.hut}"`);
        
        let suitePcs = args.has('suite') ? args.suite.split('.') : [];
        
        foundation.prepareForTests();
        
        let rootRoom = await this.establishHut({ hut, bearing, ...args });
        if (!rootRoom.built.has('test')) throw new Error(`Room "${rootRoom.name}" isn't setup for testing`);
        
        let rootKeep = U.Keep(null, rootRoom.name); // Initialize a primary Keep
        let keep = rootKeep;                        // Don't lose track of the root
        await rootRoom.built.test(keep);            // Add room-level tests
        
        // Drill down to a specific suite
        if (!suitePcs.isEmpty()) keep = keep.getChild(...suitePcs);
        
        let firstErr = null;
        let outputTest = (name, run, ind='') => {
          let { result, err=null, msg=null, childResults } = run;
          
          // If no `firstErr` yet, `firstErr` becomes `err`
          if (err && !firstErr) firstErr = err;
          
          // Show the single result, with optional error and failure-message
          let { summary, cases } = childResults || { summary: null, cases: {} };
          console.log(`${ind}[${result ? '.' : 'X'}] ${name}`);
          if (err)              console.log(`${ind}    TESTERROR(${err.id})`);
          if (!result && msg)   console.log(`${ind}    Fail at: "${msg}"`);
          //else if (msg)       console.log(`${ind}    "${msg}"`);
          if (cases.isEmpty()) return;
          
          // Show all child results
          console.log(`${ind}    Passed ${summary.passed} / ${summary.total} cases:`);
          for (let [ name0, run ] of Object.entries(cases)) outputTest(`${name}.${name0}`, run, ind + '    ');
        };
        
        console.log('Running tests...');
        let result = await keep.run();
        outputTest(keep.name, result); // Print all keep results with nice formatting
        console.log(`Overall: Passed ${rootKeep.passed} / ${rootKeep.total} (${Math.round((rootKeep.passed / rootKeep.total) * 100)}%)`);
        
        // For convenience show the first error last
        if (firstErr) console.log('First error encountered:\n', U.foundation.formatError(firstErr));
        
      }
    });
    
    return [ settleGoal, testGoal ];
    
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
    if (!goalAchieved)  console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(raiseArgs, null, 2)}`);
    
  },
  establishHut: async function(args) { return C.notImplemented.call(this); },
  installFoundation: C.notImplemented,
  genInitBelow: async function(contentType) { return C.notImplemented.call(this); },
  parseUrl: function(url) {
    let [ full, protocol, host, port=80, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
    if (!path.hasHead('/')) path = `/${path}`;
    return {
      protocol, host, port, path,
      query: query.split('&').toObj(queryPc => queryPc.has('=') ? queryPc.split('=') : [ queryPc, null ])
    };
  },
})});

U.setup.gain({ Foundation, Goal, CpuPool });
