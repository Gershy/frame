(() => {
  
  let transportDebug = true;
  
  let { Foundation } = U.foundationClasses;
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    init: function({ hut, bearing }) {
      insp.Foundation.init.call(this, { hut, bearing });
      
      // GOAL: Determine how long since Above generated `U.aboveMsAtResponseTime`
      // - `firstContactMs` is our earliest timing of server response
      // - We'll calculate `firstContactMs` as `performance.timing.responseStart`
      //   This is the time we received the server's 1st byte
      // - No certainty further than `now - firstContactMs`; increasing accuracy
      //   requires guessing time between data insertion and our 1st byte
      // - We'll estimate LESS than the real latency this way
      
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess at
      // current value of Above's `foundation.getMs()`
      this.clockDeltaMs = nativeNow - (U.aboveMsAtResponseTime + knownLatencyMs);
      
      //console.log([
      //  'TIME DIF:',
      //  `HERE: ${now}`,
      //  `ABOV: ${U.aboveMsAtResponseTime}`,
      //  `TRANSPORT TOOK: ${knownLatencyMs}`,
      //  `AHEAD BY: ${now - U.aboveMsAtResponseTime} (- ${knownLatencyMs}??)`
      //].join('\n'));
      //console.log(window.performance.timing);
      //console.log(new PerformanceNavigationTiming());
      
      let { query } = this.parseUrl(window.location.href);
      this.spoof = query.has('spoof') ? query.spoof : null;
      
      // This value shows up in stack traces (used to isolate line number)
      this.traceUrl = window.location.slice('origin', 'pathname', 'search').toArr(v => v).join('');
      
      // We want to be able to react when the browser is closed
      // TODO: Still need to qualify what browser-closing signifies...
      // Does it mean pausing? Exiting immediately? Exiting after a delay?
      this.unloadWob = U.Wob({});
      window.addEventListener('beforeunload', () => this.unloadWob.wobble(true));
      
    },
    getPlatformName: function() { return 'browser'; },
    installFoundation: async function() {
      
      window.addEventListener('unhandledrejection', evt => {
        console.log(this.formatError(evt.reason));
        evt.preventDefault();
      });
      window.addEventListener('error', evt => {
        console.log(this.formatError(evt.reason));
        evt.preventDefault();
      });
      
      // Build all rooms
      U.rooms.forEach(room => room());
      let { query } = this.parseUrl(window.location.href);
      await new Promise(r => { window.onload = r; });
      
      if (query.has('title')) {
        let head = document.getElementsByTagName('head')[0];
        let title = head.getElementsByTagName('title')[0];
        title.innerHTML = `${title.innerHTML} (${query.title})`;
      }
      
    },
    
    // Functionality
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    addMountFile: function() { /* Nothing... */ },
    getMountFile: function(name) {
      return { ISFILE: true, name, url: this.spoof ? `!FILE/${name}?spoof=${this.spoof}` : `!FILE/${name}` };
    },
    makeHttpServer: async function() {
      let numPendingReqs = 0;
      
      let clientWob = {
        ip: 'remote',
        hear: U.Wob({}),
        tell: U.Wob({}),
        open: U.Wob({}),
        shut: U.Wob({})
      };
      let serverWob = U.WobVal(clientWob);
      
      let heartbeatTimeout = null;
      let tellAndHear = async msg => {
        
        if (transportDebug) console.log(`TELL remote:`, msg);
        
        // Do XHR
        let req = new XMLHttpRequest();
        req.open('POST', this.spoof ? `?spoof=${this.spoof}` : '', true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify(msg));
        
        numPendingReqs++;
        
        // Communicating with Above has two parts; performing the HTTP transmission, and
        // responding to its result. Inside this try/catch both occur:
        try {
          
          // Listen for the request to result in a JSON response
          let res = await new Promise((rsv, rjc) => req.gain({ onreadystatechange: () => {
            if (req.readyState !== 4) return;
            try {
              if (req.status === 0) throw new Error('Got HTTP response 0');
              if (req.responseText.length === 0) throw new Error('Above sent empty message');
              rsv(JSON.parse(req.responseText));
            } catch(err) {
              tellAndHear = () => {}; // Don't make any more noise
              clientWob.shut.wobble(true);
              rjc(err);
            }
          }}));
          
          // If any data was received, process it at a higher level
          if (res) {
            if (transportDebug) console.log('HEAR remote:', res);
            clientWob.hear.wobble([ res, null ]);
          }
          
        } catch(err) {
          
          // TODO: Reset our state Below! Reload page?
          console.log('Error from transmission:', this.formatError(err));
          throw err;
          
        }
        
        numPendingReqs--;
        
        // Always have 1 pending req
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' });
      };
      
      // Expose our ability to communicate Above with the higher app
      clientWob.tell.hold(msg => tellAndHear(msg));
      
      // Immediately bank a poll
      tellAndHear({ command: 'bankPoll' });
      
      // TODO: Uncommenting the following may have an issue:
      // This relies on having a good referenced value at "tellAndHear"'
      // Not the case if a transmission errored (`tellAndHear = () => {}`)
      //this.unloadWob.hold(v => v && tellAndHear({ command: 'close' }));
      
      return serverWob;
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
            
            roomName += '.cmp';
            
          } else {
            
            srcLineInd = lineInd;
            roomName += '.js';
            
          }
          
          let padRoom = (roomName + ': ').padTail(25);
          let padLine = `${srcLineInd}:${charInd}`.padTail(10);
          let traceLine = ln.has('(') ? ln.split('(')[1].crop(0, 1) : ln.trim().crop(3);
          
          return `${padRoom} ${padLine} (${traceLine})`;
        } catch(err) {
          
          return `TRACEERR - ${err.message.split('\n').join(' ')} - "${ln}"`;
          
        }
      });
      
      return `${err.message}:\n${lines.map(v => `  ${v}`).join('\n')}`;
      
    }
  })});

  U.foundationClasses.gain({
    FoundationBrowser
  });
  
})();
