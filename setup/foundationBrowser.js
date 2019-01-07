(() => {
  
  let { Foundation } = U.foundationClasses;
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    init: function({ hut, bearing }) {
      insp.Foundation.init.call(this, { hut, bearing });
    },
    getPlatformName: function() { return 'browser'; },
    installFoundation: async function() {
      
      // Build all rooms
      U.rooms.forEach(room => room());
      await new Promise(r => { window.onload = r; });
      
    },
    
    // Functionality
    addMountFile: function() { /* Nothing... */ },
    getMountFile: function(name) {
    return { ISFILE: true, name, url: `!FILE/${name}` };
    },
    makeHttpServer: async function() {
      
      let reqUrl = '';
      let { query } = this.parseUrl(window.location.href);
      if (query.has('spoof')) reqUrl = `?spoof=${query.spoof}`;
      
      let numPendingReqs = 0;
      
      let clientWob = {
        ip: 'remote',
        hear: U.BareWob({}),
        tell: U.BareWob({}),
        open: U.BareWob({}),
        shut: U.BareWob({})
      };
      let serverWob = U.Wobbly({ value: clientWob });
      
      let tellAndHear = async msg => {
        let req = new XMLHttpRequest();
        
        req.open('POST', reqUrl, true);
        req.setRequestHeader('Content-Type', 'application/json');
        try { req.send(JSON.stringify(msg)); }
        catch(err) { return console.log('Couldn\'t stringify msg', msg); }
        
        numPendingReqs++;
        
        let res = await new Promise((rsv, rjc) => { req.onreadystatechange = () => {
          if (req.readyState !== 4) return;
          try {
            if (req.status === 0) { console.log('Got response status 0'); return rsv(null); }
            rsv(JSON.parse(req.responseText));
          } catch(err) {
            console.log('Received invalid message from above:', U.typeOf(req.responseText), req.responseText);
            tellAndHear = () => {}; // Make sure no more requests are sent
            rjc(err);
            clientWob.shut.wobble(null);
          }
        }; });
        
        if (res) clientWob.hear.wobble([ res, null ]);
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
