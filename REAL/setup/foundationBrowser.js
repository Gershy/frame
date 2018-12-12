(() => {
  
  let { Foundation } = U.foundationClasses;
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    init: function({ hut, bearing }) {
      insp.Foundation.init.call(this, { hut, bearing });
    },
    getPlatformName: function() { return 'browser'; },
    installFoundation: async function() {
      
      // TODO: HEEERE, overwritten buildRoom works for node; check if things work in browser!
      
      // Build all rooms
      U.rooms.forEach(room => room());
      await new Promise(r => { window.onload = r; });
      
    }
  })});

  U.foundationClasses.gain({
    FoundationBrowser
  });
  
})();
