// The "foundation" is environment-level normalization. It configures javascript to
// operate consistently whether in the browser, in node.js, on a particular web
// platform, etc. Also, for each platform, the foundation takes into account whether
// the hut is alone, above, below, or between

// TODO: Write classes for transports

let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
  init: function({ hut=null, bearing=null }) {
    if (!hut) throw new Error('Missing "hut" param');
    if (!bearing) throw new Error('Missing "bearing" param');
    if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw new Error(`Invalid bearing: "${bearing}"`);
    this.uidCnt = 0;
    this.hut = hut; // A hut is technically a room; it's the biggest room encompassing all others!
    this.bearing = bearing;
  },
  getPlatformName: C.notImplemented,
  nextUid: function() { return this.uidCnt++; },
  
  // Functionality
  makeHttpServer: async function(host, port) { return C.notImplemented.call(this); },
  makeSoktServer: async function(host, port) { return C.notImplemented.call(this); },
  
  // Setup
  formatError: C.notImplemeneted,
  install: async function() {
    await this.installFoundation();
    let room = U.rooms[this.hut];
    await room.built.open();
    console.log(`Built ${this.hut} for ${this.getPlatformName()}`);
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
