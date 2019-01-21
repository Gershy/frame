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
      
      let { query } = this.parseUrl(window.location.href);
      this.spoof = query.has('spoof') ? query.spoof : null;
      
      //console.log([
      //  'TIME DIF:',
      //  `HERE: ${now}`,
      //  `ABOV: ${U.aboveMsAtResponseTime}`,
      //  `TRANSPORT TOOK: ${knownLatencyMs}`,
      //  `AHEAD BY: ${now - U.aboveMsAtResponseTime} (- ${knownLatencyMs}??)`
      //].join('\n'));
      //console.log(window.performance.timing);
      //console.log(new PerformanceNavigationTiming());
      
    },
    getPlatformName: function() { return 'browser'; },
    installFoundation: async function() {
      
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
        hear: U.BareWob({}),
        tell: U.BareWob({}),
        open: U.BareWob({}),
        shut: U.BareWob({})
      };
      let serverWob = U.Wobbly({ value: clientWob });
      
      let heartbeatTimeout = null;
      let tellAndHear = async msg => {
        
        if (transportDebug) console.log(`TELL remote:`, msg);
        
        // Serialize `msg`
        try {
          msg = JSON.stringify(msg);
        } catch(err) {
          console.log('Couldn\'t stringify message:', msg);
          throw err;
        }
        
        // Do XHR
        let req = new XMLHttpRequest();
        req.open('POST', this.spoof ? `?spoof=${this.spoof}` : '', true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(msg);
        
        numPendingReqs++;
        
        let res = await new Promise((rsv, rjc) => { req.onreadystatechange = () => {
          if (req.readyState !== 4) return;
          try {
            if (req.status === 0) { console.log('Got response status 0'); return rsv(null); }
            if (req.responseText.length === 0) { console.log('Above sent empty message'); }
            rsv(req.responseText.length ? JSON.parse(req.responseText) : null);
          } catch(err) {
            console.log('Received invalid message from above:', U.typeOf(req.responseText), req.responseText);
            tellAndHear = () => {}; // Make sure we don't make any more noise
            clientWob.shut.wobble(true);
            rjc(err);
          }
        }; });
        
        if (res) {
          if (transportDebug) console.log(`HEAR remote:`, res);
          clientWob.hear.wobble([ res, null ]);
        }
        numPendingReqs--;
        
        // Always have 1 pending req
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' });
      };
      
      clientWob.tell.hold(msg => tellAndHear(msg));
      
      tellAndHear({ command: 'bankPoll' });
      
      return serverWob;
    },
    formatError: function(err) {
      return err.stack;
    }
  })});

  U.foundationClasses.gain({
    FoundationBrowser
  });
  
})();
