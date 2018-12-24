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
      
      let tellAndHear = async msg => {
        let req = new XMLHttpRequest();
        
        let reqUrl = ''; // TODO: If spoofing params are needed here
        req.open('POST', reqUrl, true);
        req.setRequestHeader('Content-Type', 'application/json');
        try { req.send(JSON.stringify(msg)); }
        catch(err) { return console.log('Couldn\'t stringify msg', msg); }
        
        numPendingReqs++;
        
        await new Promise((rsv, rjc) => { req.onreadystatechange = () => {
          if (req.readyState !== 4) return;
          if (req.status === 0) rsv(null); // TODO: cross-domain errors will silently fail
          try { clientWob.hear.wobble(JSON.parse(req.responseText)); }
          catch(err) { console.log('Couldn\'t parse json from response', req.responseText); }
        }; });
        
        numPendingReqs--;
        
        // Always have 1 pending req
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' });
      };
      
      clientWob.tell.hold(msg => tellAndHear(msg));
      
      tellAndHear({ command: 'bankPoll' });
      
      return serverWob;
    }
  })});

  U.foundationClasses.gain({
    FoundationBrowser
  });
  
})();
