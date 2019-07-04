// The "foundation" is environment-level normalization. It configures javascript to
// operate consistently whether in the browser, in node.js, on a particular web
// platform, etc. Also, for each platform, the foundation takes into account whether
// the hut is alone, above, below, or between

// TODO: Write classes for transports

let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
  init: function() {
  },
  getPlatformName: C.notImplemented,
  
  // Platform
  getMs: function() { return +new Date(); },
  queueTask: C.notImplemented,
  makeHttpServer: async function(host, port) { return C.notImplemented.call(this); },
  makeSoktServer: async function(host, port) { return C.notImplemented.call(this); },
  getRootReal: async function() { return C.notImplemented.call(this); },
  formatError: C.notImplemeneted,
  
  // Setup
  decide: function(args) {
    
    let cmd = (args.has('cmd') ? args.cmd : 'establish').split('.');
    
    if (cmd[0] === 'establish') {
      
      (async () => {
        let rootRoom = await this.establishHut(args);
        await rootRoom.built.open();
        console.log(`Established ${args.hut} for ${this.getPlatformName()}`);
      })();
      
    } else if (cmd[0] === 'test') {
      
      (async () => {
        let rootRoom = await this.establishHut(args);
        if (!rootRoom.built.has('test')) throw new Error(`Couldn\'t find "test" prop for ${args.hut}`);
        
        U.DBG_WOBS = new Set();
        
        let keep = U.Keep(null, 'root');
        let rootKeep = keep;              // Don't lose reference to root Keep
        if (true) U.addSetupKeep(keep);   // Add setup-level tests
        await rootRoom.built.test(keep);  // Add room-level tests
        
        // Dive down to a specific test category if needed (defined from "--cmd test.cat.subcat...")
        if (cmd.length > 1) keep = keep.getChild(...cmd.slice(1));
        
        let firstErr = null;
        let outputTest = (name, run, ind='') => {
          let { result, err=null, msg=null, childResults } = run;
          
          // If no `firstErr` yet, `firstErr` becomes `err`
          if (err && !firstErr) firstErr = err;
          
          // Show the single result, with optional error and failure-message
          let { summary, cases } = childResults || { summary: null, cases: {} };
          console.log(`${ind}[${result ? '.' : 'X'}] ${name}`);
          if (err) console.log(`${ind}    TESTERROR(${err.id})`);
          if (msg) console.log(`${ind}    "${msg}"`);
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
        
        console.log(`Tested ${args.hut} for ${this.getPlatformName()}`);
      })();
      
    }
    
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

U.foundationClasses.gain({ Foundation });
