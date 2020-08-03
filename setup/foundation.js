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
  
  let { Slots, Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let Keep = U.inspire({ name: 'Keep', insps: { Slots }, methods: (insp, Insp) => ({
    init: function() {},
    getContent: async function() { throw Error(`${U.nameOf(this)} does not implement "getContent"`); },
    setContent: async function() { throw Error(`${U.nameOf(this)} does not implement "setContent"`); },
    getContentType: async function() { throw Error(`${U.nameOf(this)} does not implement "getContentType"`); },
    getContentByteLength: async function() { throw Error(`${U.nameOf(this)} does not implement "getContentByteLength"`); },
    getPipe: function() { throw Error(`${U.nameOf(this)} does not implement "getPipe"`); }
  })});
  
  // TODO: Merge `U` and `Foundation`??
  let Foundation = U.inspire({ name: 'Foundation', insps: { Slots }, methods: (insp, Insp) => ({
    
    $protocols: {
      http: { secure: false, defaultPort: 80 },
      https: { secure: true, defaultPort: 443 },
      ws: { secure: false, defaultPort: 80 },
      wss: { secure: true, defaultPort: 443 },
    },
    
    init: function(args={}) {
      
      if (!args.has('mode')) args.mode = 'prod';
      if (!args.has('hosting')) args.hosting = 'localhost:80';
      if (!args.has('ssl')) args.ssl = null;
      
      this.origArgs = args;
      this.spoofEnabled = args.mode === 'test';
      this.isSpoofed = args.seek('isSpoofed').val || false;
      this.initData = args.seek('initData').val || null;
      this.uidCnt = 0;
      this.installedRooms = {};
      
      this.hutPrm = null;
      this.keepPrm = null;
      this.realPrm = null;
      
    },
    getPlatformName: C.noFn('getPlatformName'),
    
    access: function(arg) {
      if (!U.isType(arg, String)) throw Error(`Invalid type for access: ${U.nameOf(arg)}`);
      if (arg === 'hut') return this.getRootHut();
      if (arg === 'keep') return this.getRootKeep();
      if (arg === 'real') return this.getRootReal();
      return null;
    },
    
    getRootHut: function(options={}) { return this.hutPrm = (this.hutPrm || this.createHut(options)); },
    getRootKeep: function(options={}) { return this.keepPrm = (this.keepPrm || this.createKeep(options)); },
    getRootReal: function(options={}) { return this.realPrm = (this.realPrm || this.createReal(options)); },
    
    createHut: async function(options={}) {
      
      // Note: An instance of node could have multiple RootHuts, each
      // representing a server with a variety of Roads, and different
      // servers could host entirely different applications - all within
      // the same node VM context!
      
      if (!options.has('uid')) throw Error('Must provide "uid"');
      
      // Ensure good defaults inside `options`:
      
      // Hosting:
      if (!options.has('hosting')) options.hosting = {};
      if (!options.hosting.has('host')) options.hosting.host = 'localhost';
      if (!options.hosting.has('port')) options.hosting.port = 80;
      if (!options.hosting.has('sslArgs')) options.hosting.sslArgs = null;
      
      // SSL:
      if (!options.hosting.sslArgs) options.hosting.sslArgs = {};
      if (!options.hosting.sslArgs.has('keyPair')) options.hosting.sslArgs.keyPair = null;
      if (!options.hosting.sslArgs.has('selfSign')) options.hosting.sslArgs.selfSign = null;
      
      // Protocols:
      if (!options.has('protocols')) options.protocols = {};
      if (!options.protocols.has('http')) options.protocols.http = true;
      if (!options.protocols.has('sokt')) options.protocols.sokt = true;
      
      // Heartbeat:
      if (!options.has('heartMs')) options.heartMs = 1000 * 30;
      
      let hut = (await this.getRoom('hinterlands')).Hut(this, options.uid, options.slice('heartMs'));
      
      let { hosting, protocols, heartMs } = options;
      if (protocols.http) {
        console.log(`Using HTTP: ${hosting.host}:${hosting.port + 0}`);
        this.makeHttpServer(hut, { host: hosting.host, port: hosting.port + 0, ...hosting.sslArgs });
      }
      if (protocols.sokt) {
        console.log(`Using SOKT: ${hosting.host}:${hosting.port + 1}`);
        this.makeSoktServer(hut, { host: hosting.host, port: hosting.port + 1, ...hosting.sslArgs });
      }
      
      return hut;
    },
    createKeep: C.noFn('createKeep'),
    createReal: C.noFn('createReal'),
    
    // Error
    parseErrorLine: C.noFn('parseErrorLine'),
    srcLineRegex: C.noFn('srcLineRegex', () => ({ regex: /abc/, extract: fullMatch => ({ roomName: '...', line: '...', char: '...' }) })),
    cmpLineToSrcLine: function(offsets, cmpLine, cmpChar=null) {
      
      // For a compiled file and line number, return the corresponding line number
      // in the source
      
      let srcLine = 0; // The line of code in the source which maps to the line of compiled code
      let nextOffset = 0; // The index of the next offset chunk which may take effect
      for (let i = 0; i < cmpLine; i++) {
        
        let origSrcLineInd = srcLine;
        
        // Find all the offsets which exist for the source line
        // For each offset increment the line in the source file
        while (offsets[nextOffset] && offsets[nextOffset].at === srcLine) {
          srcLine += offsets[nextOffset].offset;
          nextOffset++;
        }
        srcLine++;
      }
      
      return srcLine;
      
    },
    cmpRoomLineToSrcLine: function(roomName, cmpLine, cmpChar=null) {
      let offsets = null
        || this.installedRooms.seek([ roomName, 'debug', 'offsets' ]).val
        || global.seek([ 'roomDebug', roomName, 'offsets' ]).val;
      
      let result = offsets
        ? { disp: null, mapped: true, srcLine: this.cmpLineToSrcLine(offsets, cmpLine, cmpChar) }
        : { disp: null, mapped: false, srcLine: cmpLine };
      
      return result.gain({ disp: `${roomName}.${result.mapped ? 'cmp' : 'src'} @ ${result.srcLine.toString()}` });
    },
    formatError: function(err) {
      
      // Form a pretty representation of an error. Remove noise from filepaths
      // and map line indices from compiled->source.
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
      let lines = trace.split('\n').map(line => {
        try {
          let { roomName, lineInd, charInd } = this.parseErrorLine(line);
          return this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp;
        } catch(err) {
          return `<??> ${line.trim()}`;
        }
      });
      
      let preLen = err.constructor.name.length + 2; // The classname plus ": "
      let moreLines = stack.substr(preLen, traceBegins - 1 - preLen);
      
      let { regex, extract } = this.srcLineRegex();
      moreLines = moreLines.replace(regex, fullMatch => {
        let { roomName, lineInd, charInd=null } = extract(fullMatch);
        return this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp;
      });
      moreLines = moreLines.split('\n');
      
      // TODO: Parse codepoints within error message??
      // let fileRegex = /([^\s]+\.(above|below|between|alone)\.js):([0-9]+)/;
      // let moreLines = moreLinesRaw.replace(fileRegex, (match, file, bearing, lineInd) => {
      //   let mappedLineData = this.mapLineToSource(file, parseInt(lineInd, 10));
      //   return mappedLineData
      //     ? `room/${mappedLineData.roomName}/${mappedLineData.roomName}.src:${mappedLineData.srcLineInd}`
      //     : match;
      // }).split('\n');
      
      let result = [
        // '+'.repeat(46),
        // ...stack.split('\n').map(ln => `++ ${ln}`),
        '='.repeat(46),
        ...moreLines.map(ln => `||  ${ln}`),
        '||' + ' -'.repeat(22),
        ...(lines.length ? lines : [ `Showing unformatted "${type}":`, ...trace.split('\n').map(ln => `? ${ln.trim()}`) ]).map(ln => `||  ${ln}`)
      ].join('\n');
      
      return result;
      
    },
    
    // Platform
    getMs: function() { return +new Date(); },
    queueTask: C.noFn('queueTask'),
    makeHttpServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    makeSoktServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    getUid: function() { return U.base62(this.uidCnt++).padHead(8, '0'); },
    
    // Setup
    getRoom: async function(name, ...args) {
      
      if (!this.installedRooms.has(name)) {
        this.installedRooms[name] = {};
        this.installedRooms[name].gain(await this.installRoom(name, ...args));
      }
      
      return this.installedRooms[name].content;
      
    },
    installRoom: C.noFn('installRoom'),
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
  
  U.setup.gain({ Keep, Foundation });
  
})();
