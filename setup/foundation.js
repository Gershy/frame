// The "foundation" is environment-level normalization. It configures javascript to
// operate consistently whether in the browser, in node.js, on a particular web
// platform, etc. Also, for each platform, the foundation takes into account whether
// the hut is alone, above, below, or between

// TODO: Write classes for transports

let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
  init: function({ hut=null, bearing=null, test=false }) {
    if (!hut) throw new Error('Missing "hut" param');
    if (!bearing) throw new Error('Missing "bearing" param');
    if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw new Error(`Invalid bearing: "${bearing}"`);
    this.uidCnt = 0;
    this.hut = hut; // A hut is technically a room; it's the biggest room encompassing all others!
    this.bearing = bearing;
    this.test = test;
  },
  getPlatformName: C.notImplemented,
  nextUid: function() { return this.uidCnt++; },
  
  // Functionality
  getMs: function() { return +new Date(); },
  queueTask: C.notImplemented,
  makeHttpServer: async function(host, port) { return C.notImplemented.call(this); },
  makeSoktServer: async function(host, port) { return C.notImplemented.call(this); },
  
  // Setup
  formatError: C.notImplemeneted,
  install: async function() {
    
    await this.installFoundation();
    
    let room = U.rooms[this.hut];
    
    if (this.test) {
      
      if (!room.built.has('test')) throw new Error(`Couldn't find "test" prop for ${this.hut}`);
      
      U.DBG_WOBS = new Set();
      
      let keep = U.Keep(null, 'root');
      let rootKeep = keep;
      if (true) U.addSetupKeep(keep);   // Add setup-level tests
      await room.built.test(keep);      // Add room-level tests
      
      if (U.isType(this.test, String)) keep = keep.getChild(...this.test.split('.'));
      
      let outputTest = (name, run, ind='') => {
        let { result, err=null, msg=null, childResults } = run;
        
        let { summary, cases } = childResults || { summary: null, cases: {} };
        console.log(`${ind}[${result ? '.' : 'X'}] ${name}`);
        if (err) console.log(`${ind}    TESTERROR(${err.id})`);
        if (msg) console.log(`${ind}    "${msg}"`);
        if (cases.isEmpty()) return;
        console.log(`${ind}    Passed ${summary.passed} / ${summary.total} cases:`);
        for (let [ name0, run ] of Object.entries(cases)) outputTest(`${name}.${name0}`, run, ind + '    ');
      };
      
      console.log('Running tests...');
      let result = await keep.run();
      console.log(`Overall: Passed ${rootKeep.passed} / ${rootKeep.total} (${Math.round((rootKeep.passed / rootKeep.total) * 100)}%)`);
      outputTest(keep.name, result);
      console.log(`Tested ${this.hut} for ${this.getPlatformName()}`);
      process.exit(0);
      
    } else {
      
      if (!room.built.has('open')) throw new Error(`Couldn't find "open" prop for ${this.hut}`);
      await room.built.open();
      console.log(`Built ${this.hut} for ${this.getPlatformName()}`);
      
    }
    
  },
  installFoundation: C.notImplemented,
  genInitBelow: async function(contentType) { return C.notImplemented.call(this); },
  parseUrl: function(url) {
    let [ full, protocol, host, port=80, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
    return {
      protocol, host, port, path,
      query: query.split('&').toObj(queryPc => queryPc.has('=') ? queryPc.split('=') : [ queryPc, null ])
    };
  },
  makeHttpServer: async function(contentType) { return C.notImplemented.call(this); },
  makeSoktServer: async function(contentType) { return C.notImplemented.call(this); }
})});

U.foundationClasses.gain({
  Foundation
});
