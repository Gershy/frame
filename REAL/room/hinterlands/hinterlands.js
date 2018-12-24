U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
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
      
      init: function({ hinterlands, uid=hinterlands.nextUid(), knownToHut=()=>false }) {
        insp.Record.init.call(this, { uid });
        this.knownToHut = knownToHut;
        this.attach('hinterlands', hinterlands);
        this.hinterlands = hinterlands;
        
        let holdValueFunc = newVal => hinterlands.informValue(this, newVal);
        this.hold(holdValueFunc);
        
        let holdAttachFunc = this.getAttachWob().hold(([ relName, inst ]) => hinterlands.informAttaches(relName, this, inst));
        let holdDetachFunc = this.getDetachWob().hold(([ relName, inst ]) => hinterlands.informDetaches(relName, this, inst));
      }
    })});
    
    let Hinterlands = U.inspire({ name: 'Hinterlands', insps: { Record }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      $defaultCommands: {
        getInit: async (inst, hut, msg) => {
          let initBelow = await inst.foundation.genInitBelow('text/html');
          hut.tell(initBelow);
        },
        getFile: async (inst, hut, msg) => {
          hut.tell({ command: 'error', type: 'notImplemented', orig: msg });
        },
        error: async (inst, hut, msg) => {
          console.log(`Error from ${hut.address}:`, msg);
        }
      },
      
      init: function({ foundation, name, commands=Hinterlands.defaultCommands }) {
        insp.Record.init.call(this, {});
        this.foundation = foundation;
        this.uidCnt = 0;
        this.version = 0; // This notion of "version" can increase VERY quickly
        
        this.commands = commands;
        
        this.updateLive = {};
        this.updateDead = {};
        this.updateValues = {};
        this.updateAttaches = {};
        this.updateDetaches = {};
      },
      nextUid: function() { return this.uidCnt++; },
      
      hear: async function(hut, msg) {
        let { command } = msg;
        
        if (command !== 'error') console.log(`Heard ${hut.address}:`, msg);
        
        if (this.commands.has(command)) await this.commands[command](this, hut, msg);
        else                            hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
      },
      
      // TODO: Ignore being informed if `inst` isn't meant to be synced
      informLive: function(inst) {
        this.updateLive[inst.uid] = inst;
      },
      informDead: function(inst) {
        this.updateDead[inst.uid] = inst;
      },
      informValue: function(inst, value) {
        // TODO: Consider ONLY allowing serializable values???
        this.updateValues[inst.uid] = value; // TODO: If `value` isn't serializable there will be issues
      },
      informAttaches: function(relName, inst1, inst2) {
        this.updateAttaches[`${relName}~${U.multiKey(inst1.uid, inst2.uid)}`] = [ relName, inst1, inst2 ];
      },
      informDetaches: function(relName, inst1, inst2) {
        this.updateDetaches[`${relName}~${U.multiKey(inst1.uid, inst2.uid)}`] = [ relName, inst1, inst2 ];
      },
      
      open: async function() { return Promise.all(this.getInner('highways').map(h => h.open()).toArr(p => p)); },
      shut: async function() { return Promise.all(this.getInner('highways').map(h => h.shut()).toArr(p => p)); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands, address }) {
        if (!hinterlands) throw new Error('Missing "hinterlands"');
        insp.HinterlandsRecord.init.call(this, { hinterlands });
        this.address = address;
        this.version = -10; // Some distance from 0
        this.discoveredMs = +new Date();
      },
      favouredHighway: function() {
        // TODO: Implement for real!
        // console.log(this.getInner('highways')); // TODO: getInner is broken
        let highways = this.inner.highways;
        for (let k in highways) return highways[k];
        return null;
      },
      tell: async function(msg) {
        await this.favouredHighway().tellHut(this, msg);
      }
    })});
    let Highway = U.inspire({ name: 'Highway', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ hinterlands, makeServer=null }) {
        if (!makeServer) throw new Error('Missing "makeServer"');
        
        insp.HinterlandsRecord.init.call(this, { hinterlands });
        this.makeServer = makeServer;
        this.server = null;
        this.serverFunc = null
        this.hutsByIp = {};
      },
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(hutWob => {
          let { ip } = hutWob;
          let hut = Hut({ hinterlands: this.hinterlands, address: ip });
          this.attach('huts', hut);
          this.hinterlands.attach('huts', hut);
          this.hutsByIp[ip] = { wob: hutWob, hut };
          
          hutWob.hear.hold(async msg => {
            await this.hinterlands.hear(hut, msg);
          });
          hutWob.shut.hold(() => {
            this.detach('huts', hut);
            this.hinterlands.detach('huts', hut);
          });
        });
      },
      tellHut: function(hut, msg) {
        console.log(`Telling ${hut.address}:`, msg);
        this.hutsByIp[hut.address].wob.tell.wobble(msg);
      }
    })});
    
    Record.relate1M(Record.stability.secret, 'hinterlandsRecords', Hinterlands, 'records', HinterlandsRecord, 'hinterlands');
    Record.relate1M(Record.stability.secret, 'hinterlandsHighways', Hinterlands, 'highways', Highway, 'hinterlands');
    Record.relateMM(Record.stability.secret, 'highwayHuts', Highway, 'huts', Hut, 'highways');
    Record.relate1M(Record.stability.secret, 'hinterlandsHuts', Hinterlands, 'huts', Hut, 'hinterlands2');
    
    return { Hinterlands, Hut, Highway };
  }
});
