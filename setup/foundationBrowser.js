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
      innerKeep: function({ path, urlParams }) { return Insp.KeepUrlResource(this, path, urlParams); }
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
        if (foundation) params.gain(foundation.getIdenUrlParams());
        
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
      
      // GOAL: how long since Above generated `U.aboveMsAtResponseTime`?
      // - `firstContactMs` is our earliest timing of server response
      // - `firstContactMs` is `performance.timing.responseStart`
      //   This is the time we received the server's 1st byte
      // - Without making any assumptions: `now - firstContactMs`
      // - This estimates LESS than the real latency
      
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
    getPlatformName: function() { return 'browser'; },
    establishHut: async function(args) {
      
      if (!args.has('hut')) throw Error('Missing "hut" param');
      
      // Build all Rooms
      U.rooms.forEach(room => room(this));
      
      // Catch exceptions after building all Rooms
      window.addEventListener('unhandledrejection', evt => {
        console.error(this.formatError(evt.error || evt.reason));
        evt.preventDefault();
      });
      window.addEventListener('error', evt => {
        console.error(this.formatError(evt.error || evt.reason));
        evt.preventDefault();
      });
      
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
    getUrl: function(urlParams) {
      urlParams = { ...urlParams, ...this.getIdenUrlParams() };
      return `/?${urlParams.toArr((v, k) => `${k}=${v}`).join('&')}`;
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
          
          try {         return rsv(req.responseText ? JSON.parse(req.responseText) : null); }
          catch(err) {  return rjc(Error('Malformed JSON')); }
        }}));
        
        // If any data was received, process it at a higher level
        if (res) road.hear.drip([ res, null ]);
        
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
      
      let server = TubSet({ onceDry: () => sokt.close() }, Nozz());
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => sokt.send(JSON.stringify(msg));
        road.currentCost = () => 0.5;
        sokt.onmessage = ({ data }) => data && road.hear.drip([ JSON.parse(data), null ]);
      };
      
      // Allow communication with only a single Server: our AboveHut
      pool.processNewRoad(server, roadedHut => roadedHut.hutId = '!above');
      return server;
    },
    formatError: function(err) {
      
      if (!U.has('debugLineData')) return err.stack;
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let trace = stack.substr(stack.indexOf(traceBeginSearch) + traceBeginSearch.length);
      
      let lines = trace.split('\n').map(ln => {
        try {
          
          let full = null, lineInd = null, charInd = null;
          let match = ln.match(/([0-9]+):([0-9]+)/);
          if (!match) return C.skip;
          
          [ full, lineInd, charInd ] = match;
          
          lineInd -= U.debugLineData.scriptOffset; // Line number relative to full script, not full HTML document
          
          let errRoomName = null;
          for (let checkOvershootRoomName in U.debugLineData.rooms) {
            let { offsetWithinScript } = U.debugLineData.rooms[checkOvershootRoomName];
            if (offsetWithinScript > lineInd) break;
            errRoomName = checkOvershootRoomName;
          }
          
          
          let { offsetWithinScript, offsets } = errRoomName
            ? U.debugLineData.rooms[errRoomName]
            : { offsetWithinScript: 0, offsets: null };
          
          let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
          lineInd -= offsetWithinScript; // Line number relative to logical file, not full script
          
          if (offsets) {
            
            let nextOffset = 0; // The index of the next offset chunk which may take effect
            for (let i = 0; i < lineInd; i++) {
              // Find all the offsets which exist for the source line
              // For each offset increment the line in the source file
              while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
                srcLineInd += offsets[nextOffset].offset;
                nextOffset++;
              }
              srcLineInd++;
            }
            
          } else {
            
            srcLineInd = lineInd;
            
          }
          
          let padRoom = `${errRoomName}.js: `.padTail(25);
          let padLine = `${srcLineInd}:${charInd}`.padTail(10);
          let traceLine = ln.has('(') ? ln.split('(')[1].crop(0, 1) : ln.trim().crop(3);
          
          return `${padRoom} ${padLine} (${traceLine})`;
          
        } catch(err) {
          
          return `TRACEERR - "${ln}" - ${err.message.split('\n').join(' ')}`;
          
        }
      });
      
      return `${err.message}:\n${lines.map(v => `  ${v}`).join('\n')}`;
      
    }
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
