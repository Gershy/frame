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
  
  let Goal = U.inspire({ name: 'Goal', methods: (insp, Insp) => ({
    init: function({ name, desc, detect, enact }) {
      ({}).gain.call(this, { name, desc, detect, enact, children: Set() });
    },
    attempt: async function(foundation) {
      if (!this.detect(foundation.origArgs)) return false;
      await this.enact(foundation, foundation.origArgs);
      for (let child of this.children) await child.attempt(foundation);
      return true;
    }
  })});
  
  let Keep = U.inspire({ name: 'Keep', methods: (insp, Insp) => ({
    
    init: function() {},
    to: function(...args) {
      let keep = this;
      for (let arg of args)
        keep = U.isType(keep, Promise) ? keep.then(k => k.innerKeep(arg)) : keep.innerKeep(arg);
      return keep;
    },
    innerKeep: function() { throw Error(`${U.nameOf(this)} does not implement "innerKeep"`); },
    getContent: async function() { throw Error(`${U.nameOf(this)} does not implement "getContent"`); },
    setContent: async function() { throw Error(`${U.nameOf(this)} does not implement "setContent"`); },
    getContentType: async function() { throw Error(`${U.nameOf(this)} does not implement "getContentType"`); },
    getContentByteLength: async function() { throw Error(`${U.nameOf(this)} does not implement "getContentByteLength"`); },
    getPipe: function() { throw Error(`${U.nameOf(this)} does not implement "getPipe"`); }
    
  })});
  
  // TODO: Merge `U` and `Foundation`??
  let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
    
    $protocols: {
      http: { secure: false, defaultPort: 80 },
      https: { secure: true, defaultPort: 443 },
      ws: { secure: false, defaultPort: 80 },
      wss: { secure: true, defaultPort: 443 },
    },
    
    init: function(args={}) {
      
      this.origArgs = {};
      this.spoofEnabled = false;
      this.setArgs(args);
      
      this.goals = this.defaultGoals();
      this.uidCnt = 0;
      this.rootReal = null;
      this.installedRooms = {};
      
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
    setArgs: function(args) {
      
      if (!args.has('mode')) args.mode = 'prod';
      if (!args.has('hosting')) args.hosting = 'localhost:80';
      if (!args.has('ssl')) args.ssl = '';
      
      this.origArgs = args;
      this.spoofEnabled = args.mode === 'test';
      
    },
    defaultGoals: function() {
      
      let settleGoal = Goal({
        name: 'settle',
        desc: 'Settle our Hut down',
        detect: args => args.has('settle'),
        enact: async (foundation, args) => {
          let [ hut=null, bearing=null ] = args.settle.split('.');
          
          let rootRoom = await foundation.establishHut({ hut, bearing, ...args });
          if (!rootRoom.built.has('open')) throw Error(`Room "${rootRoom.name}" isn't setup for settling`);
          
          console.log(`Settling ${rootRoom.name} on ${this.getPlatformName()}`);
          await rootRoom.built.open();
        }
      });
      
      return [ settleGoal ];
      
    },
    getPlatformName: C.noFn('getPlatformName'),
    
    getKeep: function(...args) { return this.getRootKeep().to(...args); },
    getRootKeep: function() { throw Error(`${U.nameOf(this)} does not implement "getRootKeep"`); },
    getRootHut: async function(options={}) {
      
      // Note: An instance of node could have multiple RootHuts, each
      // representing a server with a variety of Roads, and different
      // servers could host entirely different applications - all within
      // the same node VM context!
      
      let hinterlandsRoom = await this.getRoom('hinterlands');
      
      if (!options.has('uid')) throw Error('Must provide "uid"');
      
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
      
      let hut = hinterlandsRoom.Hut(this, options.uid, options.slice('heartMs'));
      
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
    getRootReal: C.noFn('getRootReal'),
    
    // Platform
    cmpLineToSrcLine: function(offsets, cmpInd) {
      
      // For a compiled file and line number, return the corresponding line number
      // in the source
      
      let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
      let nextOffset = 0; // The index of the next offset chunk which may take effect
      for (let i = 0; i < cmpInd; i++) {
        
        let origSrcLineInd = srcLineInd;
        
        // Find all the offsets which exist for the source line
        // For each offset increment the line in the source file
        while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
          srcLineInd += offsets[nextOffset].offset;
          nextOffset++;
        }
        srcLineInd++;
      }
      
      return srcLineInd;
      
    },
    getMs: function() { return +new Date(); },
    queueTask: C.noFn('parseErrorLine'),
    makeHttpServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    makeSoktServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    parserErrorLine: C.noFn('parseErrorLine'),
    formatError: function(err) {
      
      // Form a pretty representation of an error. Remove noise from filepaths
      // and map line indices from compiled->source.
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
      console.log(this.installedRooms);
      
      let lines = trace.split('\n').map(line => {
        
        try {
          
          let { roomName, lineInd, charInd } = this.parseErrorLine(line);
          
          let offsets = null
            || this.installedRooms.seek([ roomName, 'debug', 'offsets' ]).value
            || global.seek([ 'roomDebug', roomName, 'offsets' ]).value;
          
          let [ errorPath, mappedLineInd, mappedCharInd=null ] = offsets
            ? [ `${roomName}.cmp`, this.cmpLineToSrcLine(offsets, lineInd, charInd) ]
            : [ `${roomName}.src`, lineInd ];
          
          return `${errorPath.padTail(36)} @ ${mappedLineInd.toString()}`;
          
        } catch(err) {
          
          return `<??> ${line.trim()}`;
          
        }
        
      });
      
      let preLen = err.constructor.name.length + 2; // The classname plus ": "
      let moreLines = stack.substr(preLen, traceBegins - 1 - preLen).split('\n');
      
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
    getOrderedRoomNames: C.notImplemented,
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
    raise: async function() {
      
      let goalAchieved = false;
      for (let goal of this.goals) if (await goal.attempt(this)) { goalAchieved = true; break; }
      if (!goalAchieved) console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(this.origArgs, null, 2)}`);
      
    },
    establishHut: C.noFn('establishHut'),
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
  
  U.setup.gain({ Goal, Keep, Foundation });
  
})();
