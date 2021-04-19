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
  
  let { Src, FnSrc, Tmp, Slots } = U.logic;
  
  let Keep = U.form({ name: 'Keep', has: { Slots }, props: (insp, Insp) => ({
    init: function() {},
    getContent: C.noFn('getContent'),
    setContent: C.noFn('setContent'),
    getContentType: C.noFn('getContentType'),
    getContentByteLength: C.noFn('getContentByteLength'),
    getPipe: C.noFn('getPipe'),
    desc: C.noFn('desc')
  })});
  U.setup.gain({ Keep });
  
  // TODO: Merge `U` and `Foundation`??
  let Foundation = U.form({ name: 'Foundation', has: { Slots }, props: (forms, Form) => ({
    
    $protocols: {
      http: { secure: false, defaultPort: 80 },
      https: { secure: true, defaultPort: 443 },
      ws: { secure: false, defaultPort: 80 },
      wss: { secure: true, defaultPort: 443 }
    },
    
    // Initialization
    init: function(args={}) {
      
      global.foundation = this;
      
      /// if (!args.has('ssl')) args.ssl = null;
      
      this.origArgs = args;
      this.readyArgs = {};
      this.initData = args.seek('initData').val || null; // TODO: Clumsy! I think the FoundationBrowser script generated by Nodejs (in hinterlands/habitat/htmlBrowser) should include code to process "initData".
      
      this.uidCnt = 0;
      this.installedRooms = {};
      this.servers = {};
      
      this.hutPrm = null;
      this.keepPrm = null;
      this.realPrm = null;
      
    },
    halt: function() { throw Error(`Foundation halted`); },
    ready: function() { return Promise.resolve(); },
    
    // Sandbox
    getMs: function() { return +new Date(); },
    queueTask: C.noFn('queueTask'),
    getUid: function() { return (this.uidCnt++).encodeStr(C.base62, 8); },
    
    // Config
    getArg: function(term) {
      if (!this.readyArgs.has(term)) {
        
        // TODO: should seek should return `C.skip` if `!found`?? I
        // think it makes some cases more convenient, others less. Also
        // consider??:
        // `{ found: <bool>, val: <val|null>, res: <val|C.skip> }`
        let rawVal = this.origArgs.seek(term).val;
        this.readyArgs[term] = this.argProcessors.has(term)
          ? this.argProcessors[term](rawVal, this)
          : rawVal;
        
        U.then(this.readyArgs[term], arg => this.readyArgs[term] = arg);
        
      }
      return this.readyArgs[term];
    },
    parseUrl: function(url) {
      let [ full, protocol, host, port=null, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
      
      if (!Form.protocols.has(protocol)) throw Error(`Invalid protocol: "${protocol}"`);
      
      if (!path.hasHead('/')) path = `/${path}`;
      if (!port) port = Form.protocols[protocol].defaultPort;
      
      return {
        protocol, host, port: parseInt(port, 10), path,
        query: (query ? query.split('&') : []).toObj(pc => pc.has('=') ? pc.split('=') : [ pc, null ])
      };
      
    },
    argProcessors: {
      deploy: val => val || 'prod',
      debug: val => {
        if (val === '*') return { has: () => true };
        if (U.isForm(val, String)) val = val.split(',').map(v => v.trim() || C.skip);
        return Set(val || []);
      },
      roadDebugLimit: val => val || Infinity
    },
    formatHostUrl: function({ protocol, host, port }) {
      let excludePort = true
        && Form.protocols.has(protocol)
        && port === Form.protocols[protocol].defaultPort;
      return `${protocol}://${host}${excludePort ? '' : (':' + port)}`;
    },
    
    // Services
    access: function(arg) {
      if (!U.isForm(arg, String)) throw Error(`Invalid type for access: ${U.getFormName(arg)}`);
      if (arg === 'hut') return this.getRootHut();
      if (arg === 'keep') return this.getRootKeep();
      if (arg === 'real') return this.getRootReal();
      return null;
    },
    getRootHut: function(options={}) { return this.hutPrm = (this.hutPrm || this.createHut(options)); },
    getRootKeep: function(options={}) { return this.keepPrm = (this.keepPrm || this.createKeep(options)); },
    getRootReal: function(options={}) { return this.realPrm = (this.realPrm || this.createReal(options)); },
    createHut: async function(uid) {
      
      // Note: An instance of node could have multiple RootHuts, each
      // representing a server with a variety of Roads, and different
      // servers could host entirely different applications - all within
      // the same node VM context!
      
      // if (!options.has('uid')) throw Error('Must provide "uid"');
      
      // Ensure good defaults inside `options`:
      
      /// // SSL:
      /// if (!options.hosting.sslArgs) options.hosting.sslArgs = {};
      /// if (!options.hosting.sslArgs.has('keyPair')) options.hosting.sslArgs.keyPair = null;
      /// if (!options.hosting.sslArgs.has('selfSign')) options.hosting.sslArgs.selfSign = null;
      /// 
      /// // Protocols:
      /// if (!options.has('protocols')) options.protocols = {};
      /// if (!options.protocols.has('http')) options.protocols.http = true;
      /// if (!options.protocols.has('sokt')) options.protocols.sokt = true;
      /// 
      /// // Heartbeat:
      /// if (!options.has('heartMs')) options.heartMs = 1000 * 30;
      
      let hut = (await this.getRoom('hinterlands')).Hut(this, uid);
      
      return hut;
    },
    createKeep: C.noFn('createKeep'),
    createReal: C.noFn('createReal'),
    
    // Transport
    getServer: function(opts) {
      
      // Returns either an immediate value or a Promise. Immediate
      // server availability is important to allow efficient setup of
      // some clients.
      
      let term = this.formatHostUrl(opts);
      if (!this.servers.has(term)) {
        
        this.servers[term] = ({
          http:   this.createHttpServer,
          sokt:   this.createSoktServer,
          ws:     this.createSoktServer
        })[opts.protocol].call(this, opts);
        U.then(this.servers[term], server => this.servers[term] = server);
        
      }
      return this.servers[term];
      
    },
    createHttpServer: C.noFn('createHttpServer', opts => {}),
    createSoktServer: C.noFn('createSoktServer', opts => {}),
    
    // Room
    getRooms: async function(names, ...args) {
      
      return Promise.allObj(names.toObj(name => {
        
        // Prexisting Promise or resolved values are returned
        if (this.installedRooms.has(name)) return [ name, this.installedRooms[name] ];
        
        // Unresolved promise representing room installation
        let prm = this.installRoom(name, ...args);
        
        // Immediately set key; prevents double-installation
        this.installedRooms[name] = { debug: { offsets: [] }, content: prm.then(v => v.content) };
        
        // Overwrite with resolved values once they're available
        prm.then(obj => this.installedRooms[name].gain(obj));
        
        return [ name, prm ];
        
      }));
      
    },
    getRoom: async function(name, ...args) {
      
      if (!this.installedRooms.has(name)) {
        
        // Note that `Foundation.prototype.installRoom` returns an
        // Object with "debug" and "content" properties. Note that
        // "debug" should be immediately available, whereas "content"
        // may be a promise. This is to allow debug information to be
        // available for any SyntaxErrors that can occur during the
        // resolution of the "content" property.
        let prm = this.installRoom(name, ...args);
        this.installedRooms[name] = { debug: { offsets: [] }, content: prm.then(v => v.content) };
        prm.then(obj => this.installedRooms[name].gain(obj));
        
      }
      return this.installedRooms[name].content;
      
    },
    settleRoom: async function(name, ...args) {
      await this.ready();
      
      // These do not parallelize (TODO: why??)
      let room = await this.getRoom(name, 'above');
      let hut = await this.getRootHut({ heartMs: 1000 * 40 });
      
      // The settled room gets its Hut linked to static resources
      // TODO: Move to hinterlands.Setup?
      this.seek('keep', 'static').setHut(hut);
      return room.open(hut);
    },
    installRoom: C.noFn('installRoom'),
    
    /// {DEBUG=
    // Error
    parseErrorLine: C.noFn('parseErrorLine'),
    srcLineRegex: C.noFn('srcLineRegex', () => ({ regex: /.^/, extract: fullMatch => ({ roomName: '...', line: '...', char: '...' }) })),
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
        || (global.roomDebug || {}).seek([ roomName, 'offsets' ]).val;
      
      let result = offsets
        ? { disp: null, mapped: true, srcLine: this.cmpLineToSrcLine(offsets, cmpLine, cmpChar) }
        : { disp: null, mapped: false, srcLine: cmpLine };
      
      return result.gain({ disp: `${roomName}.${result.mapped ? 'cmp' : 'src'} @ ${result.srcLine.toString()}` });
    },
    formatError: function(err, verbose=false) {
      
      // Form a pretty representation of an error. Remove noise from filepaths
      // and map line indices from compiled->source.
      
      let [ msg, type, stack, diagram ] = [ err.message, U.getFormName(err), err.stack, null ];
      let traceBegins=null, errDescContent=null;
      
      // SyntaxErrors begin with a physical diagram of the line the
      // error occurred on. SyntaxErrors also do not include any
      // overridden message in their stack (If regular Error `err` and
      // SyntaxError `synErr`, for  `err.message += '!'`
      // and `synErr.message += '!'`, the "!" appears in `err.stack`,
      // but not in `synErr.stack`). This is a nuisance since it makes
      // it difficult to detect when the "trace" component of the stack
      // begins - we can't just slice off `msg.count()` characters as
      // some characters of the "error message" can be reflected in
      // `msg` but not `err.stack`. Fortunately for SyntaxErrors the
      // "message" component of the stack will only be a single line!
      // TODO: This isn't necessarily cross-brower compatible!
      if (U.isForm(err, SyntaxError)) {
        [ diagram, stack ] = stack.cut('\n\n', 1);
        traceBegins = stack.cut('\n')[0].count() + 1; // +1 accounts for newline
        errDescContent = diagram + '\n' + stack.slice(0, traceBegins - 1); // 0 could become `U.getFormName(err).count + 2` to trim off "SyntaxError: "
      } else {
        let prefix = `${type}: ${msg}\n`;
        traceBegins = stack.indexOf(prefix) + prefix.length;
        errDescContent = stack.slice(0, traceBegins - 1);
      }
      
      let trace = stack.slice(traceBegins);
      let lines = trace.split('\n').map(line => {
        let parseCmpLine = U.safe(() => this.parseErrorLine(line), null);
        if (!parseCmpLine) return verbose ? `?(1) - ${line.trim()}` : C.skip;
        
        let { roomName, lineInd, charInd, bearing } = parseCmpLine;
        if (bearing === null) return `${roomName}.src @ ${lineInd}`;
        
        let result = U.safe(() => this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp, null);
        return result || (verbose ? `?(2) - mill//${roomName}.js @ ${lineInd} (${line.trim()})` : C.skip);
      });
      
      let { regex, extract } = this.srcLineRegex();
      let moreLines = errDescContent.replace(regex, fullMatch => {
        let { roomName, lineInd, charInd=null } = extract(fullMatch);
        return this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp;
      }).split('\n');
      
      let result = [
        '='.repeat(46),
        ...moreLines.map(ln => `||  ${ln}`),
        '||' + ' -'.repeat(22),
        ...(lines.isEmpty()
          ? [ `Showing unformatted "${type}":`, ...trace.split('\n').map(ln => `? ${ln.trim()}`) ]
          : lines
        ).map(ln => `||  ${ln}`)
      ].join('\n');
      
      return result;
      
    }
    /// =DEBUG}
    
  })});
  U.setup.gain({ Foundation });
  
})();
