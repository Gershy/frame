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
    getPipe: C.noFn('getPipe')
  })});
  U.setup.gain({ Keep });
  
  // TODO: Merge `U` and `Foundation`??
  let Foundation = U.form({ name: 'Foundation', has: { Slots }, props: (forms, Form) => ({
    
    $protocols: {
      http: { secure: false, defaultPort: 80 },
      https: { secure: true, defaultPort: 443 },
      ws: { secure: false, defaultPort: 80 },
      wss: { secure: true, defaultPort: 443 },
    },
    
    init: function(args={}) {
      
      global.foundation = this;
      
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
    ready: function() { return Promise.resolve(); },
    halt: function() { throw Error(`Foundation halted`); },
    getPlatform: C.noFn('getPlatform'),
    
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
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
      let lines = trace.split('\n').map(line => {
        let parseCmpLine = U.safe(() => this.parseErrorLine(line), null);
        if (!parseCmpLine) return verbose ? `?(1) - ${line.trim()}` : C.skip;
        
        let { roomName, lineInd, charInd, bearing } = parseCmpLine;
        if (bearing === null) return `${roomName}.src @ ${lineInd}`;
        
        let result = U.safe(() => this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp, null);
        return result || (verbose ? `?(2) - mill//${roomName}.js @ ${lineInd} (${line.trim()})` : C.skip);
      });
      
      let preLen = err.constructor.name.length + 2; // The classname plus ": "
      let moreLines = stack.substr(preLen, traceBegins - 1 - preLen);
      
      let { regex, extract } = this.srcLineRegex();
      moreLines = moreLines.replace(regex, fullMatch => {
        let { roomName, lineInd, charInd=null } = extract(fullMatch);
        return this.cmpRoomLineToSrcLine(roomName, lineInd, charInd).disp;
      });
      moreLines = moreLines.split('\n');
      
      let result = [
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
    settleRoom: async function(name, ...args) {
      await this.ready();
      
      // These do not parallelize (TODO: why??)
      let room = await this.getRoom(name, 'above');
      let hut = await this.getRootHut({ heartMs: 1000 * 40 });
      
      this.seek('keep', 'static').setHut(hut);
      return room.open(hut);
    },
    installRoom: C.noFn('installRoom'),
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
  })});
  U.setup.gain({ Foundation });
  
  let Real = U.form({ name: 'Real', has: { Slots, Tmp }, props: (forms, Form) => ({
    init: function(params={}, { name=null, layouts=[], innerLayout=null, decals=null }=params) {
      
      forms.Slots.init.call(this);
      forms.Tmp.init.call(this);
      
      this.name = name;
      
      this.layouts = layouts;
      this.innerLayout = innerLayout;
      this.decalsStack = Set(decals ? [ decals ] : []);
      
      this.parent = null;
      this.tech = null; // TODO: Do we need a "rootReal", or "tech"? (Or both?)
      this.techNode = null;
      this.children = Set();
      
      this.addOns = {};
    },
    ancestry: function() { return !this.parent ? [] : [ this, ...this.parent.ancestry() ]; },
    getTechNode: function() { return this.techNode || (this.techNode = this.tech.createTechNode(this)); },
    addReal: function(real, params={}) {
      
      // If String was given instead of Real, create Real
      if (U.isForm(real, String)) {
        if (U.isForm(params, Function)) {
          params = params({
            layouts: (...p) => {
              let childOuterLayout = this.innerLayout ? this.innerLayout.getChildOuterLayout(...p) : null;
              return childOuterLayout ? [ childOuterLayout ] : [];
            }
          });
        } else {
          if (!params.has('layouts')) params.layouts = [];
          if (this.innerLayout) params.layouts.unshift(this.innerLayout.getChildOuterLayout());
        }
        real = Real({ name: real, ...params });
      }
      
      if (!U.isForm(real, Real)) throw Error(`Invalid real param; got ${U.getFormName(real)}`);
      if (real.parent) throw Error(`Real already has a parent`);
      if (real.tech) throw Error(`Real already has tech`);
      
      real.parent = this;
      real.tech = this.tech;
      
      this.children.add(real);
      real.endWith(() => this.children.rem(real));
      
      // Apply `real`'s styles to `real`'s tech node
      this.tech.render(real, real.getTechNode());
      
      // Attach `real` using the tech
      this.tech.addNode(this, real);
      
      return real;
      
    },
    cleanup: function() {
      if (this.techNode) this.tech.remNode(this);
      this.techNode = null;
      this.parent = null;
    },
    
    scrollTo: function(real, ...args) { return this.tech.scrollTo(this, real, ...args); },
    
    setText: function(...args) { return this.tech.setText(this, ...args) },
    selectTextContent: function(...args) { return this.tech.selectTextContent(this, ...args) },
    
    addInput: function(...args) { return this.tech.addInput(this, ...args); },
    addPress: function(...args) { return this.tech.addPress(this, ...args); },
    addFeel: function(...args) { return this.tech.addFeel(this, ...args); },
    addViewportEntryChecker: function(...args) { return this.tech.addViewportEntryChecker(this, ...args); },
    addDecals: function(decals) {
      this.decalsStack.add(decals);
      this.tech.render(this, this.getTechNode());
      return Tmp(() => {
        this.decalsStack.rem(decals)
        this.tech.render(this, this.getTechNode());
      });
    }
  })});
  
  let Layout = U.form({ name: 'Layout', has: {}, props: (forms, Form) => ({
    init: C.noFn('init'),
    getChildOuterLayout: function(params) { return null; }
  })});
  let Axis1DLayout = U.form({ name: 'Axis1DLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ axis='y', flow='+', cuts=null }) {
      this.axis = axis;
      this.flow = flow;
      this.cuts = cuts;
    },
    getChildOuterLayout: function(...params) { return Form.Item(this, ...params); },
    
    $Item: U.form({ name: 'Axis1DLayout.Item', has: { Layout }, props: (forms, Form) => ({
      init: function(par, ...params) {
        this.par = par;
        this.params = params;
      }
    })})
    
  })});
  let FreeLayout = U.form({ name: 'FreeLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ mode='center', w=null, h=null, x=null, y=null }={}) {
      this.mode = mode;
      ({}).gain.call(this, { mode, w, h, x, y });
    }
  })});
  let SizedLayout = U.form({ name: 'SizedLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ ratio=null, w=ratio ? null : '100%', h=ratio ? null : '100%' }) {
      if (ratio !== null && (w === null) === (h === null)) throw Error(`With "ratio" must provide exactly one of "w" or "h"`);
      this.w = w;
      this.h = h;
      this.ratio = ratio;
    }
  })});
  let ScrollLayout = U.form({ name: 'ScrollLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ x='none', y='auto' }) { ({}).gain.call(this, { x, y }); },
    getChildOuterLayout: function(...params) { return Form.Item(this, ...params); },
    
    $Item: U.form({ name: 'ScrollLayout.Item', has: { Layout }, props: (forms, Form) => ({
      init: function(par) { this.par = par; }
    })})
      
  })});
  let TextLayout = U.form({ name: 'TextLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ text='', size=null, align=null, gap=null }) { ({}).gain.call(this, { text, size, align, gap }); }
  })});
  let TextInputLayout = U.form({ name: 'TextInputLayout', has: { TextLayout }, props: (forms, Form) => ({
    init: function({ multiline=false, prompt=null, ...params }) {
      forms.TextLayout.init.call(this, params);
      this.multiline = multiline;
      this.prompt = prompt;
    }
  })});
  let ImageLayout = U.form({ name: 'ImageLayout', has: { Layout }, props: (forms, Form) => ({
    init: function({ mode='useMinAxis', image }) { ({}).gain.call(this, { mode, image }); }
  })});
  
  U.setup.gain({ Real, Axis1DLayout, FreeLayout, SizedLayout, ScrollLayout, TextLayout, TextInputLayout, ImageLayout });
  
})();
