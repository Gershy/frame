U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    // All huts sit together in the lands
    
    let { Record } = record;
    
    let compactIp = ipVerbose => {
      let pcs = ipVerbose.split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw new Error(`Bad ip format: ${ipVerbose}`);
      return pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
    };
    
    let LandsRecord = U.inspire({ name: 'LandsRecord', insps: { Record }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ lands, uid=lands.nextUid() }) {
        insp.Record.init.call(this, { uid });
        this.attach(relLandsRecs, lands);
        this.lands = lands;
       }
    })});
    
    let Lands = U.inspire({ name: 'Lands', insps: { Record }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      $defaultCommands: {
        getInit: async (inst, hut, msg) => {
          
          hut.version = 1;
          hut.recalcInitInform();
          
          let initBelow = await inst.foundation.genInitBelow('text/html', hut.flushAndGenInform());
          
          hut.tell(initBelow);
        },
        getFile: async (inst, hut, msg) => {
          hut.tell({ command: 'error', type: 'notImplemented', orig: msg });
        },
        fizzle: async(inst, hut, msg) => {
          console.log(`Fizzled for ${hut.address}`);
        },
        error: async (inst, hut, msg) => {
          //console.log(`Error from ${hut.address}:`, msg);
        },
        /// {BELOW=
        update: async (inst, hut, msg) => {
          //console.log('Update with:', msg.content);
        }
        /// =BELOW}
      },
      
      init: function({ foundation, name, getRecsForHut, checkHutHasRec=null, commands=Lands.defaultCommands }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.foundation = foundation;
        this.uidCnt = 0;
        
        /// {ABOVE=
        this.getRecsForHut = getRecsForHut;
        this.checkHutHasRec = checkHutHasRec || ((lands, hut, rec) => getRecsForHut(lands, hut).has(rec.uid));
        
        let hutWob = this.getInnerWob(relLandsHuts);
        hutWob.hold(({ add={}, rem={} }) => {
          
          // Newly added huts need to set up tracking for all preexisting records
          add.forEach(hut => {
            let recs = this.getRecsForHut(this, hut);
            recs.forEach((rec, uid) => hut.followRec(rec, uid));
          });
          
          // Removed huts need to detach from all records they're following
          rem.forEach(hut => hut.forgetAllRecs());
          
        });
        
        let recWob = this.getInnerWob(relLandsRecs);
        recWob.hold(({ add={}, rem={} }) => {
          
          let huts = this.getInnerVal(relLandsHuts);
          
          add.forEach(rec => {
            huts.forEach(hut => this.checkHutHasRec(this, hut, rec) && hut.followRec(rec));
          });
          
          rem.forEach(rec => {
            huts.forEach(hut => hut.forgetRec(rec));
          });
          
        });
        /// =ABOVE}
        
        /// {BELOW=
        this.version = 0;
        /// =BELOW}
        
        this.commands = commands;
      },
      nextUid: function() { return (this.uidCnt++).toString(16).padHead(8, '0'); },
      
      hear: async function(hut, msg) {
        let { command } = msg;
        
        console.log(`HEAR ${hut.address}:`, msg);
        
        if (this.commands.has(command)) await this.commands[command](this, hut, msg);
        else                            hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
      },
      
      open: async function() { return Promise.all(this.getInnerVal(relLandsWays).map(h => h.open()).toArr(p => p)); },
      shut: async function() { return Promise.all(this.getInnerVal(relLandsWays).map(h => h.shut()).toArr(p => p)); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { LandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ lands, address }) {
        if (!lands) throw new Error('Missing "lands"');
        insp.LandsRecord.init.call(this, { lands });
        this.address = address;
        this.discoveredMs = +new Date();
        
        this.version = 0;
        
        /// {ABOVE=
        this.recHolds = {};
        this.addRec = {};
        this.remRec = {};
        this.updRec = {};
        this.addRel = {};
        this.remRel = {};
        /// =ABOVE}
      },
      
      /// {ABOVE=
      followRec: function(rec, uid=rec.uid) {
        // Start keeping track of new holds
        var holds = {
          value: null,
          rel: {}
        };
        
        // Need to send initial data for this record
        this.addRec[uid] = rec;
        
        // Need to send updated data for this record
        holds.value = rec.hold(value => {
          if (!this.addRec.has(rec.uid)) this.updRec[rec.uid] = value;
        });
        
        // rec.getInnerWobs().forEach((wob, relUid) => {
        // });
        
        let checkHasRec = this.lands.checkHutHasRec.bind(null, this.lands, this);
        rec.getFlatDef().forEach((rel, relUid) => {
          let wob = rec.getInnerWob(rel);
          
          // Normalize; regardless of cardinality deal with a maplist of Records
          let attached = wob.value;
          if (!U.isType(attached, Object)) attached = attached ? { [attached.uid]: attached } : {};
          
          // Need to send initial relations for this record
          attached.forEach((rec2, uid2) => {
            // Skip relations outside the hut's knowledge
            if (!checkHasRec(rec2)) return;
            this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ];
          });
          
          // Need to send updated relations for this record
          let relType = rec.getRelPart(rel).clsRelFwd.type;
          let hold = ({
            type1: (newVal, oldVal) => {
              let [ map, rec2 ] = newVal ? [ this.addRel, newVal ] : [ this.remRel, oldVal ];
              if (!rec2 || !checkHasRec(rec2)) return;
              map[`${relUid}.${U.multiKey(uid, rec2.uid)}`] = [ relUid, uid, rec2.uid ];
            },
            typeM: ({ add={}, rem={} }) => {
              add.forEach((rec2, uid2) => {
                if (!checkHasRec(rec2)) return;
                this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ];
              });
              rem.forEach((rec2, uid2) => {
                if (!checkHasRec(rec2)) return;
                this.remRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ];
              });
            }
          })[`type${relType}`];
          
          holds.rel[relUid] = wob.hold(hold);
          
          this.recHolds[uid] = holds;
        });
      },
      forgetRec: function(rec, uid=rec.uid) {
        // Note that the dropping here is "safe" - doesn't throw errors
        // It's possible that a followed record has been "isolated"; in this
        // case all relations are already dropped and these attempts to drop
        // are redundant. No need to worry about leaks though - once `rec`
        // is detached from `Lands` the `Lands` will ensure all huts forget
        // `rec` appropriately.
        if (!this.holds.has(uid)) return;
        let recHolds = this.holds[uid];
        rec.drop(recHolds.value, true);
        rec.getInnerWobs().forEach((wob, uid) => wob.drop(recHolds.rel[uid], true));
        delete this.holds[uid];
      },
      forgetAllRecs: function() {
        this.holds.forEach((hold, uid) => {
          let rec = this.lands.getInnerVal(relLandsRecs)[uid];
          this.forgetRec(rec);
        });
      },
      recalcInitInform: function() {
        [ 'addRec', 'remRec', 'updRec', 'addRel', 'remRel' ].forEach(p => { this[p] = {}; });
        
        let recs = this.lands.getInnerVal(relLandsRecs);
        this.recHolds.forEach((h, uid) => {
          
          // Send an "add" for this record
          let rec = recs[uid];
          this.addRec[uid] = rec;
          
          // Send an "add" for each of this record's relations
          rec.getFlatDef().forEach((rel, relUid) => {
            // Normalize; regardless of cardinality deal with a maplist of Records
            let attached = rec.getInnerVal(rel);
            if (!U.isType(attached, Object)) attached = attached ? { [attached.uid]: attached } : {};
            
            attached.forEach((rec2, uid2) => {
              // Skip relations outside the hut's knowledge
              if (!this.addRec.has(uid2)) return;
              this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ];
            });
          });
          
        });
        
      },
      flushAndGenInform: function() {
        let content = {};
        
        [ 'addRec', 'remRec', 'updRec', 'addRel', 'remRel' ].forEach(str => {
          if (!this[str].isEmpty()) content[str] = this[str];
          this[str] = {};
        });
        
        if (content.has('addRec')) content.addRec = content.addRec.map(rec => ({
          uid: rec.uid,
          type: rec.constructor.name,
          value: rec.getValue()
        }));
        
        return content;
      },
      informBelow: async function() {
        let content = this.flushAndGenInform();
        if (content.isEmpty()) return;
        
        await this.tell({
          command: 'update',
          version: this.version++,
          content
        });
      },
      /// =ABOVE}
      
      favouredWay: function() {
        // TODO: Implement for real!
        // console.log(this.getInner('ways')); // TODO: getInner is broken
        let ways = this.getInnerVal(relWaysHuts);
        for (let k in ways) return ways[k];
        return null;
      },
      tell: async function(msg) {
        await this.favouredWay().tellHut(this, msg);
      }
    })});
    let Way = U.inspire({ name: 'Way', insps: { LandsRecord }, methods: (insp, Insp) => ({
      $genFlatDef: () => ({
      }),
      
      init: function({ lands, makeServer=null }) {
        if (!makeServer) throw new Error('Missing "makeServer"');
        
        insp.LandsRecord.init.call(this, { lands });
        this.makeServer = makeServer;
        this.server = null;
        this.serverFunc = null
        this.hutsByIp = {};
      },
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(hutWob => {
          let { ip } = hutWob;
          let hut = Hut({ lands: this.lands, address: ip });
          this.attach(relWaysHuts, hut);
          this.lands.attach(relLandsHuts, hut);
          this.hutsByIp[ip] = { wob: hutWob, hut };
          
          hutWob.hear.hold(async msg => {
            await this.lands.hear(hut, msg);
          });
          hutWob.shut.hold(() => {
            this.detach(relWaysHuts, hut);
            this.lands.detach(relLandsHuts, hut);
          });
        });
      },
      tellHut: function(hut, msg) {
        let doOutput = true;
        if (doOutput) {
          let consoleOutput = msg;
          if (U.isType(consoleOutput, String)) consoleOutput = { str: `${consoleOutput.split('\n')[0].substr(0, 30)}...` };
          console.log(`TELL ${hut.address}:`, consoleOutput);
        }
        
        this.hutsByIp[hut.address].wob.tell.wobble(msg);
      }
    })});
    
    let relLandsRecs =  Record.relate1M(Record.stability.secret, Lands, LandsRecord, 'relLandsRecs');
    let relLandsWays =  Record.relate1M(Record.stability.secret, Lands, Way, 'relLandsWays');
    let relLandsHuts =  Record.relate1M(Record.stability.secret, Lands, Hut, 'relLandsHuts');
    let relWaysHuts =   Record.relateMM(Record.stability.secret, Way, Hut, 'relWaysHuts');
    
    return {
      Lands, LandsRecord, Hut, Way,
      relLandsRecs,
      relLandsWays,
      relLandsHuts,
      relWaysHuts
    };
  }
});
