(() => {
  
  let { Nozz, TubSet } = U.water;
  let { Foundation, Keep } = U.setup;
  
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    
    $KeepBrowser: U.inspire({ name: 'KeepBrowser', insps: { Keep }, methods: insp => ({
      init: function() {
        insp.Keep.init.call(this);
        this.keepsByType = {
          urlResource: Insp.KeepUrlResources()
        };
      },
      innerKeep: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepUrlResources: U.inspire({ name: 'KeepUrlResources', insps: { Keep }, methods: insp => ({
      init: function() {
        this.urlImages = {};
      },
      innerKeep: function({ path, params }) { return Insp.KeepUrlResource(this, path, params); }
    })}),
    $KeepUrlResource: U.inspire({ name: 'KeepUrlResource', insps: { Keep }, methods: insp => ({
      init: function(par, path='', params={}) {
        insp.Keep.init.call(this);
        this.par = par;
        this.path = path;
        this.params = params;
      },
      getUrl: function(foundation=null) {
        let params = this.params;
        if (foundation) params = { ...foundation.getIdenUrlParams(), ...params };
        let url = `/${this.path}`;
        if (!params.isEmpty()) url += `?${params.toArr((v, k) => `${k}=${v}`).join('&')}`;
        return url;
      },
      getImage: function() {
        let url = this.getUrl();
        if (!this.par.urlImages.has(url)) {
          this.par.urlImages[url] = new Image();
          this.par.urlImages[url].src = url;
        }
        return this.par.urlImages[url];
      }
    })}),
    
    init: function(...args) {
      insp.Foundation.init.call(this, ...args);
      
      // GOAL: delta since Above generated `U.aboveMsAtResponseTime`?
      // - `firstContactMs` is our earliest timing of server response
      // - `firstContactMs` is `performance.timing.responseStart`
      //   This is the time we received the server's 1st byte
      // - Without making any assumptions: `now - firstContactMs`
      // - This estimates LESS than the real latency
      
      // Catch exceptions after building all Rooms
      window.addEventListener('unhandledrejection', evt => {
        console.error(this.formatError(evt.error || evt.reason));
        evt.preventDefault();
        debugger;
      });
      window.addEventListener('error', evt => {
        console.error(this.formatError(evt.error || evt.reason));
        evt.preventDefault();
        debugger;
      });
      
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess
      // at current value of Above's `foundation.getMs()` *right now*
      this.clockDeltaMs = nativeNow - (U.aboveMsAtResponseTime + knownLatencyMs);
      
      let { query } = this.parseUrl(window.location.href);
      this.spoof = (this.spoofEnabled && query.has('spoof')) ? query.spoof : null;
      
      // Make sure that refreshes redirect to the same session
      window.history.replaceState({}, '', this.getUrl({}));
      
      // This value shows up in stack traces (used to isolate line number)
      this.traceUrl = window.location.slice('origin', 'pathname', 'search').toArr(v => v).join('');
      
      // Root Keep
      this.rootKeep = Insp.KeepBrowser();
      
      // Root Real
      this.rootReal = null;
      
      // All css to react to window loading and unloading
      window.addEventListener('load', () => document.body.classList.add('loaded'));
      window.addEventListener('beforeunload', () => document.body.classList.remove('loaded'));
      
    },
    installRoom: async function(name, bearing='below') {
      
      let url = this.getKeep('urlResource', { params: { command: 'html.room', type: 'room', room: name } }).getUrl(foundation);
      
      let script = document.createElement('script');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', url);
      document.head.appendChild(script);
      
      // Wait for the script to load; ensure it populated `global.rooms`
      await Promise(r => script.addEventListener('load', r));
      if (!global.rooms.has(name)) throw Error(`Room "${name}" does not set global.rooms.${name}!`);
      
      return {
        debug: global.roomDebug[name],
        content: global.rooms[name](this)
      };
      
    },
    getPlatformName: function() { return 'browser'; },
    establishHut: async function(args) {
      
      if (!args.has('hut')) throw Error('Missing "hut" param');
      
      // Build all Rooms
      U.rooms.forEach(room => room(this));
      
      let { query } = this.parseUrl(window.location.href);
      if (query.has('title')) {
        let head = document.getElementsByTagName('head')[0];
        let title = head.getElementsByTagName('title')[0];
        title.innerHTML = `${title.innerHTML} (${query.title})`;
      }
      
      return U.rooms[args.hut];
      
    },
    getIdenUrlParams: function() {
      return this.spoof ? { spoof: this.spoof } : { hutId: U.hutId };
    },
    getUrl: function(params) {
      params = { ...this.getIdenUrlParams(), ...params };
      return `/?${params.toArr((v, k) => `${k}=${v}`).join('&')}`;
    },
    
    // High level
    getRootKeep: function() { return this.rootKeep; },
    getRootHut: async function(options={}) {
      
      if (options.has('uid')) throw Error(`Don't specify "uid"!`);
      options.uid = U.hutId;
      
      if (!options.has('hosting')) options.hosting = {};
      if (options.hosting.has('host')) throw Error(`Don't specify "hosting.host"!`);
      if (options.hosting.has('port')) throw Error(`Don't specify "hosting.port"!`);
      if (options.hosting.has('sslArgs')) throw Error(`Don't specify "hosting.sslArgs"!`);
      
      let { protocol, host, port } = this.parseUrl(window.location.href);
      let { secure } = Foundation.protocols[protocol];
      options.hosting.gain({ host, port, sslArgs: { keyPair: secure, selfSign: secure } });
      
      return insp.Foundation.getRootHut.call(this, options);
      
    },
    getRootReal: async function() { 
      
      if (!this.rootReal) {
        
        let rootReal = this.rootReal = U.rooms.real.built.Real(null, 'browser.root');
        rootReal.defineReal('browser.doc', { slotters: null, tech: 'BROWSER' });
        rootReal.defineInsert('browser.root', 'browser.doc');
        rootReal.techReals = [ rootReal.addReal('browser.doc') ];
        
      }
      
      return this.rootReal;
      
    },
    
    // Functionality
    queueTask: function(func) { Promise.resolve().then(func); },
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    makeHttpServer: async function(pool, { host, port, keyPair = false, selfSign = false }) {
      if (!port) port = keyPair ? 443 : 80;
      
      let numPendingReqs = 0;
      
      let tellAndHear = async (msg, road) => {
        
        // Do XHR
        let ms = null;
        let req = new XMLHttpRequest();
        req.timeout = 24 * 60 * 60 * 1000;
        req.open('POST', this.getUrl({}), true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify(msg));
        
        // Listen for the request to result in a JSON response
        numPendingReqs++;
        let res = await new Promise((rsv, rjc) => req.gain({ onreadystatechange: () => {
          if (req.readyState !== 4) return;
          if (req.status === 0) return rjc(Error('Got HTTP status 0'));
          
          ms = this.getMs();
          try {         return rsv(req.responseText ? JSON.parse(req.responseText) : null); }
          catch(err) {  return rjc(Error('Malformed JSON')); }
        }}));
        
        // If any data was received, process it at a higher level
        if (res) road.hear.drip([ res, null, ms ]);
        
        // Always have 1 pending req
        numPendingReqs--;
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' }, road);
        
      };
      
      let server = TubSet({ onceDry: () => tellAndHear = ()=>{} }, Nozz());
      server.desc = `HTTP @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => tellAndHear(msg, road);
        road.currentCost = () => 1.0;
        
        /*
        // TODO: ddos test!!! FoundationNodejs.prototype.makeHttpServer
        // should handle this by detecting that the connection is being
        // abused, and ignoring incoming requests
        setTimeout(() => {
          while (true) road.tell({ command: 'ddos' });
        }, 2000);
        */
        
        this.queueTask(() => road.tell({ command: 'bankPoll' })); // Immediately bank a poll
      };
      
      // Allow communication with only a single Server: our AboveHut
      pool.processNewRoad(server, roadedHut => roadedHut.hutId = '!above');
      return server;
    },
    makeSoktServer: async function(pool, { host, port, keyPair = false, selfSign = false }) {
      if (!WebSocket) return null;
      
      if (!port) port = keyPair ? 444 : 81;
      
      let sokt = new WebSocket(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${this.getUrl({})}`);
      await Promise(r => sokt.onopen = r);
      
      let server = TubSet({ onceDry: () => { /*sokt.close()*/ } }, Nozz());
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => sokt.send(JSON.stringify(msg));
        road.currentCost = () => 0.5;
        sokt.onmessage = ({ data }) => data && road.hear.drip([ JSON.parse(data), null, this.getMs() ]);
      };
      
      // Allow communication with only a single Server: our AboveHut
      pool.processNewRoad(server, roadedHut => roadedHut.hutId = '!above');
      return server;
    },
    
    parseErrorLine: function(line) {
      
      let [ roomName ] = line.match(/[?&]room=([a-zA-Z0-9]*)/).slice(1);
      let [ lineInd, charInd ] = line.match(/:([0-9]+):([0-9]+)/).slice(1);
      return { roomName, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10) };
      
    }
    
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
