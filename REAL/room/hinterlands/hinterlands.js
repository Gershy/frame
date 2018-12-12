U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (fnd, record) => {
    // All huts sit together in the hinterlands
    
    let { Record } = record;
    
    let compactIp = ipVerbose => {
      let pcs = ipVerbose.split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw new Error(`Bad ip format: ${ipVerbose}`);
      return pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
    };
    
    let HinterlandsRecord = U.inspire({ name: 'HinterlandsRecord', insps: { Record }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands, knownToHut=()=>false }) {
        insp.Record.init.call(this, {});
        this.hinterlands = null;
        this.knownToHut = knownToHut;
        this.uid = hinterlands.nextUid();
        
        this.mod('hinterlands', { act: 'attach', hinterlands });
      }
    })});
    
    let Hinterlands = U.inspire({ name: 'Hinterlands', insps: { Record }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ foundation, name }) {
        insp.Record.init.call(this, {});
        this.foundation = foundation;
        this.highways = {};
        this.records = {};
        this.uidCnt = 0;
      },
      nextUid: function() { return this.uidCnt++; },
      open: async function() { return Promise.all(this.highways.map(h => h.open()).toArr(p => p)); },
      shut: async function() { return Promise.all(this.highways.map(h => h.shut()).toArr(p => p)); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands, address }) {
        insp.HinterlandsRecord.init.call(this, { hinterlands });
        this.address = address;
        this.highways = {}; // All the highways which connect us to this hut through the hinterlands
        this.discoveredAt = +new Date();
      }
    })});
    let Highway = U.inspire({ name: 'Highway', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands }) {
        insp.HinterlandsRecord.init.call(this, { hinterlands });
        this.hinterlands = null;
        this.huts = {};
      }
    })});
    let HighwayHttp = U.inspire({ name: 'HighwayHttp', insps: { Highway }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands, ...args }) {
        insp.Highway.init.call(this, { hinterlands });
        
        /// {ABOVE=
        let { host, port } = args;
        this.host = host;
        this.port = port;
        this.httpServer = null;
        this.hutResponses = {};
        this.hutBuffereds = {};
        this.hutsByIp = {};
        /// =ABOVE} {BELOW=
        /// =BELOW}
      },
      open: async function() {
        /// {ABOVE=
        this.httpServer = require('http').createServer(async (req, res) => this.processHttpAndHear(req, res));
        await new Promise(r => this.httpServer.listen(this.port, this.host, 511, r));
        /// =ABOVE} {BELOW=
        /// =BELOW}
      },
      shut: async function() {
        /// {ABOVE=
        if (this.httpServer) { this.httpServer.close(); this.httpServer = null; }
        /// =ABOVE} {BELOW=
        /// =BELOW}
      },
      processHttpAndHear: async function(req, res) {
        let ipVerbose = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].trim();
        let ip = compactIp(ipVerbose);
        console.log(`${ip} (${ipVerbose}) - ${req.url}`);
        
        if (!this.huts.has(ip)) {
          let newHut = Hut({ hinterlands: this.hinterlands, address: ip });
          this.mod('huts', { act: 'attach', huts: newHut });
          this.hutsByIp[ip] = newHut;
          this.hutResponses[ip] = [];
          this.hutBuffereds[ip] = [];
        }
        
        this.hutResponses[ip].push(res);
        
        let hut = this.hutsByIp[ip];
        
        if (req.url === '/')            await this.tell(hut, 'getInit');
        if (req.url === '/favicon.ico') await this.tell(hut, 'getBinary', { target: 'favicon.ico' });
        
        let [ buffs, resps ] = [ this.hutBuffereds[ip], this.hutResponses[ip] ];
        
        while (buffs.length && resps.length) {
          let [ buff, resp ] = [ buffs.shift(), resps.shift() ];
          buff(resp);
        }
      },
      tell: async function(hut, command, params={}) {
        // Promise resolution means that the "tell" has been formulated, but not necessarily sent
        
        let doTell = null;
        
        if (command === 'getInit') {
          
          doTell = async res => {
            let initBelow = await this.hinterlands.foundation.genInitBelow('text/html');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(initBelow);
          };
          
        } else {
          
          doTell = res => {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Error');
          };
          
        }
        
        this.hutBuffereds[hut.address].push(doTell);
      },
      hear: async function(hut, command) {
        console.log('REQ:', command.address);
        let initBelow = this.fnd.genInitBelow('http');
        this.tell(initBelow, hut);
      }
    })});
    
    Record.relate1M(Record.stability.secret, 'hinterlandsRecords', Hinterlands, 'records', HinterlandsRecord, 'hinterlands');
    Record.relate1M(Record.stability.secret, 'hinterlandsHighways', Hinterlands, 'highways', Highway, 'hinterlands');
    Record.relateMM(Record.stability.secret, 'highwayHuts', Highway, 'huts', Hut, 'highways');
    
    return { Hinterlands, Hut, Highway, HighwayHttp };
    
  }
});
