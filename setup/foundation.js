// The "foundation" is environment-level normalization. It configures javascript to
// operate consistently whether in the browser, in node.js, on a particular web
// platform, etc. Also, for each platform, the foundation takes into account whether
// the hut is alone, above, below, or between

// TODO: Write classes for transports

let Goal = U.inspire({ name: 'Goal', methods: (insp, Insp) => ({
  
  init: function({ name, desc, detect, enact }) {
    this.name = name;
    this.desc = desc;
    this.detect = detect;
    this.enact = enact;
    this.children = Set();
  },
  add: function(goal) {
    this.children.add(goal);
    return goal
  },
  attempt: async function(foundation, args, level=0) {
    
    if (!this.detect(args)) return false;
    
    await this.enact(foundation, args);
    for (let child of this.children) await child.attempt(foundation, args, level + 1);
    return true;
    
  }
  
})});

let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
  init: function() {
    this.goals = this.defaultGoals();
  },
  defaultGoals: function() {
    
    let inhabitGoal = Goal({
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
        
        let suitePcs = args.has('suite') ? args.suit.split('.') : [];
        
        foundation.prepareForTests();
        
        let rootRoom = await this.establishHut({ hut, bearing, ...args });
        if (!rootRoom.built.has('test')) throw new Error(`Room "${rootRoom.name}" isn't setup for testing`);
        
        let keep = U.Keep(null, rootRoom.name); // Initialize a primary Keep
        let rootKeep = keep;                    // Don't lose track of the root
        await rootRoom.built.test(keep);        // Add room-level tests
        
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
          if (err) console.log(`${ind}    TESTERROR(${err.id})`);
          if (!result && msg)  console.log(`${ind}    Fail at: "${msg}"`);
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
    
    return [ inhabitGoal, testGoal ];
    
  },
  getPlatformName: C.notImplemented,
  
  // Platform
  getMs: function() { return +new Date(); },
  queueTask: C.notImplemented, // TODO: No more `process.nextTick`! Use this instead!
  makeHttpServer: async function(host, port) { return C.notImplemented.call(this); },
  makeSoktServer: async function(host, port) { return C.notImplemented.call(this); },
  getRootReal: async function() { return C.notImplemented.call(this); },
  formatError: C.notImplemented,
  
  // Setup
  rouse: async function(args) {
    
    let goalAchieved = false;
    for (let goal of this.goals) if (await goal.attempt(this, args)) { goalAchieved = goal; break; }
    
    if (!goalAchieved)  console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(args, null, 2)}`);
    
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

U.setup.gain({ Foundation, Goal });
