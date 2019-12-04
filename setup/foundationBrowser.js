(() => {
  
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  let { Foundation } = U.setup;
  
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    init: function() {
      insp.Foundation.init.call(this);
      
      // GOAL: Determine how long since Above generated `U.aboveMsAtResponseTime`
      // - `firstContactMs` is our earliest timing of server response
      // - We'll calculate `firstContactMs` as `performance.timing.responseStart`
      //   This is the time we received the server's 1st byte
      // - No certainty further than `now - firstContactMs`; increasing accuracy
      //   requires guessing time between data insertion and our 1st byte
      // - This estimates LESS than the real latency
      
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess at
      // current value of Above's `foundation.getMs()`
      this.clockDeltaMs = nativeNow - (U.aboveMsAtResponseTime + knownLatencyMs);
      
      let { host, port, query } = this.parseUrl(window.location.href);
      this.ip = host;
      this.port = port;
      this.spoof = query.has('spoof') ? query.spoof : null;
      
      // Make sure that refreshes redirect to the same session
      window.history.replaceState({}, '', this.spoof ? `?spoof=${this.spoof}` : `?cpuId=${U.cpuId}`);
      
      // This value shows up in stack traces (used to isolate line number)
      this.traceUrl = window.location.slice('origin', 'pathname', 'search').toArr(v => v).join('');
      
      // This is the root of all graphical entities
      this.rootReal = null;
      
      // Detect when the Window loads
      this.domAvailableNozz = Promise(r => window.addEventListener('load', r));
      
      // We want to be able to react when the browser is closed
      // TODO: Still need to qualify what page-closing signifies...
      // Does it mean pausing? Exiting immediately? Exiting after a delay?
      this.unloadNozz = Nozz();
      window.addEventListener('beforeunload', () => this.unloadNozz.drip());
      
      this.domAvailableNozz.route(() => document.body.classList.add('loaded'));
      this.unloadNozz.route(() => document.body.classList.remove('loaded'));
      
    },
    getPlatformName: function() { return 'browser'; },
    establishHut: async function(args) {
      
      if (!args.has('hut')) throw new Error('Missing "hut" param');
      
      // Build all Rooms
      U.rooms.forEach(room => room(this));
      
      // Catch exceptions after building all Rooms
      window.addEventListener('unhandledrejection', evt => {
        console.error(this.formatError(evt.reason));
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
    getRootReal: async function() { 
      
      await this.domAvailableNozz; // Block until DOM is available
      
      if (!this.rootReal) {
        let realHtmlCss = U.rooms.realHtmlCss.built;
        let { Reality } = realHtmlCss;
        
        let Real = Reality.prototype.getRealCls();
        this.rootReal = Real({});
        this.rootReal.realized = document.body;
        this.rootReal.realized.classList.add('root');
      }
      
      return this.rootReal;
      
    },
    getDefaultRealRoom: function() { return U.rooms.realHtmlCss.built; },
    
    // Functionality
    queueTask: function(func) { Promise.resolve().then(func); },
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    addMountFile: function() { /* Nothing... */ },
    getMountFile: function(name) {
      return { ISFILE: true, name, url: `?command=${name}&${this.spoof ? `spoof=${this.spoof}` : `cpuId=${U.cpuId}`}&reply=1` };
    },
    makeHttpServer: async function(pool, ip, port) {
      let numPendingReqs = 0;
      
      let tellAndHear = async (msg, conn) => {
        
        // Do XHR
        let req = new XMLHttpRequest();
        req.open('POST', `?cpuId=${U.cpuId}${this.spoof ? `&spoof=${this.spoof}` : ''}`, true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify(msg));
        
        numPendingReqs++;
        
        // Listen for the request to result in a JSON response
        let res = await new Promise((rsv, rjc) => req.gain({ onreadystatechange: () => {
          if (req.readyState !== 4) return;
          if (req.status === 0) return rjc(new Error('Got HTTP status 0'));
          
          try {         return rsv(req.responseText ? JSON.parse(req.responseText) : null); }
          catch(err) {  return rjc(new Error('Malformed JSON')); }
        }}));
        
        // If any data was received, process it at a higher level
        if (res) {
          try { conn.hear.drip([ res, null ]); }
          catch(err) {
            console.log('TRANSMISSION HEARD:', JSON.stringify(res));
            console.log('ERROR RESULTING:\n', this.formatError(err));
          }
        }
        
        numPendingReqs--;
        
        // Always have 1 pending req
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' }, conn);
        
      };
      
      let server = TubSet({ onceDry: () => tellAndHear = ()=>{} }, Nozz());
      server.desc = `HTTP @ ${ip}:${port}`;
      server.cost = 100;
      server.decorateConn = conn => {
        conn.hear = Nozz();
        conn.tell = msg => tellAndHear(msg, conn);
        this.queueTask(() => conn.tell({ command: 'bankPoll' })); // Immediately bank a poll
      };
      
      return server;
    },
    makeSoktServer: async function(pool, ip, port) {
      if (!WebSocket) return null;
      
      let sokt = new WebSocket(`ws://${ip}:${port}?cpuId=${U.cpuId}${this.spoof ? `&spoof=${this.spoof}` : ''}`);
      await Promise(r => sokt.onopen = r);
      
      let server = TubSet({ onceDry: () => sokt.close() }, Nozz());
      server.desc = `SOKT @ ${ip}:${port}`;
      server.cost = 50;
      server.decorateConn = conn => {
        conn.hear = Nozz();
        conn.tell = msg => sokt.send(JSON.stringify(msg));
        sokt.onmessage = ({ data }) => data && conn.hear.drip([ JSON.parse(data), null ]);
      };
      
      return server;
    },
    formatError: function(err) {
      if (!U.has('debugLineData')) return err.stack;
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
      let lines = trace.split('\n').map(ln => {
        try {
          let [ pre, suf ] = ln.split(this.traceUrl);
          if (!suf) return C.skip;
          
          let [ full, lineInd, charInd ] = suf.match(/([0-9]+):([0-9]+)/);
          
          lineInd -= U.debugLineData.scriptOffset; // Line number relative to full script, not full HTML document
          
          let roomName = null;
          for (let k in U.debugLineData.rooms) {
            let { offsetWithinScript, offsets } = U.debugLineData.rooms[k];
            if (offsetWithinScript > lineInd) break;
            roomName = k;
          }
          
          if (roomName === null) return `UNKNOWN: ${lineInd}:${charInd}`;
          
          let { offsetWithinScript, offsets } = U.debugLineData.rooms[roomName];
          lineInd -= offsetWithinScript; // Line number relative to logical file, not full script
          
          let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
          
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
            
            roomName += '.src';
            
          } else {
            
            srcLineInd = lineInd;
            roomName += '.js';
            
          }
          
          let padRoom = (roomName + ': ').padTail(25);
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
