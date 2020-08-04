(() => {
  
  let { Nozz, TubSet } = U.water;
  let { Foundation, Keep } = U.setup;
  
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    
    $KeepBrowser: U.inspire({ name: 'KeepBrowser', insps: { Keep }, methods: insp => ({
      init: function(foundation) {
        insp.Keep.init.call(this);
        this.keepsByType = {
          urlResource: Insp.KeepUrlResources(foundation)
        };
      },
      access: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepUrlResources: U.inspire({ name: 'KeepUrlResources', insps: { Keep }, methods: insp => ({
      init: function(foundation) {
        this.foundation = foundation;
        this.urlImages = {};
      },
      access: function({ path='', params={} }) { return Insp.KeepUrlResource(this, path, params); }
    })}),
    $KeepUrlResource: U.inspire({ name: 'KeepUrlResource', insps: { Keep }, methods: insp => ({
      init: function(par, path='', params={}) {
        insp.Keep.init.call(this);
        this.par = par;
        this.path = path;
        this.params = params;
      },
      getUrl: function() {
        let params = { hutId: this.par.foundation.hutId, ...this.params };
        return params.isEmpty()
          ? `/${this.path}`
          : `/${this.path}?${params.toArr((v, k) => `${k}=${v}`).join('&')}`;
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
    
    init: function({ hutId, isSpoofed, aboveMsAtResponseTime, ...supArgs }) {
      insp.Foundation.init.call(this, supArgs);
      
      // GOAL: delta since Above generated "aboveMsAtResponseTime"?
      // - `firstContactMs` is our earliest timing of server response
      // - `firstContactMs` is `performance.timing.responseStart`
      //   This is the time we received the server's 1st byte
      // - Without making any assumptions: `now - firstContactMs`
      // - This estimates LESS than the real latency
      
      // Catch exceptions after building all Rooms
      let handleError = evt => { evt.preventDefault(); console.error(this.formatError(evt.error || evt.reason)); debugger; };
      window.addEventListener('unhandledrejection', handleError);
      window.addEventListener('error', handleError);
      
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess
      // at current value of Above's `foundation.getMs()` *right now*
      this.clockDeltaMs = nativeNow - (aboveMsAtResponseTime + knownLatencyMs);
      this.hutId = hutId;
      this.isSpoofed = isSpoofed;
      
      // Make sure that refreshes redirect to the same session
      window.history.replaceState({}, '', this.seek('keep', 'urlResource', {}).getUrl());
      
    },
    installRoom: async function(name, bearing='below') {
      
      let urlParams = { command: 'html.room', type: 'room', room: name, reply: '1' };
      let url = this.seek('keep', 'urlResource', { params: urlParams }).getUrl();
      
      let script = document.createElement('script');
      script.setAttribute('defer', '');
      script.setAttribute('async', '');
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
    
    // Util
    queueTask: function(func) { Promise.resolve().then(func); },
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    getPlatformName: function() { return 'browser'; },
    
    // High level
    createHut: async function(options={}) {
      
      if (options.has('uid')) throw Error(`Don't specify "uid"!`);
      options.uid = this.hutId;
      
      if (!options.has('hosting')) options.hosting = {};
      if (options.hosting.has('host')) throw Error(`Don't specify "hosting.host"!`);
      if (options.hosting.has('port')) throw Error(`Don't specify "hosting.port"!`);
      if (options.hosting.has('sslArgs')) throw Error(`Don't specify "hosting.sslArgs"!`);
      
      let { protocol, host, port } = this.parseUrl(window.location.href);
      let { secure } = Foundation.protocols[protocol];
      options.hosting.gain({ host, port, sslArgs: { keyPair: secure, selfSign: secure } });
      
      return insp.Foundation.createHut.call(this, options);
      
    },
    createKeep: function() { return Insp.KeepBrowser(this); },
    createReal: async function() { 
      let real = (await this.getRoom('real')).Real(null, 'browser.root');
      real.defineReal('browser.doc', { slotters: null, tech: 'BROWSER' });
      real.defineInsert('browser.root', 'browser.doc');
      real.techReals = [ real.addReal('browser.doc') ];
      return real;
    },
    
    // Connectivity
    makeHttpServer: async function(pool, { host, port, keyPair = false, selfSign = false }) {
      if (!port) port = keyPair ? 443 : 80;
      
      let numPendingReqs = 0;
      
      // TODO: Check out native fetch API
      let tellAndHear = async (msg, road) => {
        
        // Do XHR
        let ms = null;
        let req = new XMLHttpRequest();
        req.timeout = 24 * 60 * 60 * 1000;
        req.open('POST', this.seek('keep', 'urlResource', {}).getUrl(), true);
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
        }, 20);
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
      
      let sokt = new WebSocket(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${this.seek('keep', 'urlResource', {}).getUrl()}`);
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
    },
    srcLineRegex: function() {
      
      return {
        regex: /abc/,
        extract: fullMatch => ({ roomName: '???', line: 0, char: 0 })
      };
      
    }
    
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
