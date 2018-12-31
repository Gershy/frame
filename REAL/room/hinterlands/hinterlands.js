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
          
          let initBelow = await inst.foundation.genInitBelow('text/html', {
            command: 'update',
            version: 1,
            content: hut.flushAndGenInform()
          });
          
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
        update: async (lands, hut, msg) => {
          let { command, version, content } = msg;
          let { addRec={}, remRec={}, updRec={}, addRel={}, remRel={} } = content;
          
          let ops = [];
          let recs = lands.getInnerVal(relLandsRecs);
          
          ops.gain(addRec.toArr(({ uid, type, value }) => ({
            func: () => {
              
              if (!lands.records.has(type)) throw new Error(`Missing class: ${type}`);
              if (recs.has(uid)) throw new Error(`Add duplicate uid: ${uid}`);
              
              let Cls = lands.records[type];
              let inst = Cls({ uid, lands });
              inst.wobble(value);
              
              console.log(`Added ${inst.iden()} to ${lands.iden()}`);
              console.log('Recs:', lands.getInnerVal(relLandsRecs));
              
              
            },
            desc: `Add ${type} (${uid})`
          })));
          
          ops.gain(remRec.toArr((v, uid) => ({
            func: () => {
              
              if (!recs.has(uid)) throw new Error(`Rem missing uid: ${uid}`);
              
              let rec = recs[uid];
              rec.isolate();
              
            },
            desc: `Rem ${recs.has(uid) ? recs[uid].constructor.name : '???'} (${uid})`
          })));
          
          ops.gain(updRec.toArr((v, uid) => ({
            func: () => {
              
              if (!recs.has(uid)) throw new Error(`Upd missing uid: ${uid}`);
              
              let rec = recs[uid];
              rec.wobble(v);
              
            },
            desc: `Upd ${recs.has(uid) ? recs[uid].constructor.name : '???'} (${uid}) -> ${U.typeOf(v)}`
          })));
          
          ops.gain(addRel.toArr(([ relUid, uid1, uid2 ]) => ({
            func: () => {
              
              let recs = lands.getInnerVal(relLandsRecs);
              
              if (!lands.relations.has(relUid)) throw new Error(`Add relation missing uid: ${relUid}`);
              if (!recs.has(uid1)) throw new Error(`Add relation with missing uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Add relation with missing uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              rec1.attach(rel, rec2);
              
            },
            desc: `Attach relation ${relUid} (${uid1} + ${uid2})`
          })));
          
          ops.gain(remRel.toArr(([ relUid, uid1, uid2 ]) => ({
            func: () => {
              
              if (!lands.relations.has(relUid)) throw new Error(`Rem relation missing uid: ${relUid}`);
              if (!recs.has(uid1)) throw new Error(`Rem relation with missing uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Rem relation with missing uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              rec1.detach(rel, rec2);
              
            },
            desc: `Detach relation ${relUid} (${uid1} + ${uid2})`
          })));
          
          console.log('Updating with', ops.length, 'ops');
          
          let successes = [];
          let failures = null;
          
          while (ops.length) {
            let successesNow = [];
            failures = [];
            let opsNow = ops;
            ops = [];
            
            opsNow.forEach(op => {
              try {
                op.func();
                successesNow.push(op);
                successes.push(op.desc);
              } catch(err) {
                console.log(foundation.formatError(err));
                failures.push(`${op.desc}: ${err.message}`)
                ops.push(op);
              }
            });
            
            if (failures.length && successesNow.isEmpty()) break;
            
          }
          
          console.log('SUCCESS:', successes);
          console.log('FAILURE:', failures);
          
          if (failures.length) throw new Error(`Couldn't fully update!`);
          
        }
        /// =BELOW}
      },
      
      init: function({ foundation, name, getRecsForHut, checkHutHasRec=null, records=[], relations=[], commands=Lands.defaultCommands }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.foundation = foundation;
        this.uidCnt = 0;
        
        this.records = U.isType(records, Array)
          ? records.toObj(r => [ r.name, r ])
          : records;
        
        this.relations = U.isType(relations, Array)
          ? relations.toObj(r => [ r.uid, r ])
          : relations;
        
        /// {ABOVE=
        // Listen for changes to ALL data!
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
      nextUid: function() {
        /// {ABOVE=
        return (this.uidCnt++).toString(16).padHead(8, '0');
        /// =ABOVE} {BELOW=
        return '~' + (this.uidCnt++).toString(16).padHead(8, '0');
        /// =BELOW}
      },
      
      hear: async function(hut, msg) {
        let { command } = msg;
        
        console.log(`HEAR ${hut.address}:`, msg);
        
        if (this.commands.has(command)) await this.commands[command](this, hut, msg);
        else                            hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
      },
      
      open: async function() {
        await Promise.all(this.getInnerVal(relLandsWays).map(h => h.open()).toArr(p => p));
        /// {BELOW=
        let huts = this.getInnerVal(relLandsHuts);
        let hut = huts.find(() => true)[0];
        await this.hear(hut, U.initData);
        console.log('Initialized!!');
        /// =BELOW}
      },
      shut: async function() {
        return Promise.all(this.getInnerVal(relLandsWays).map(h => h.shut()).toArr(p => p));
      }
    })});
    let Area = U.inspire({ name: 'Area', insps: { LandsRecord }, methods: (insp, Insp) => ({
      
      init: function({ lands }) {
        insp.LandsRecord.init.call(this, { lands });
      }
      
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
        
        let checkHasRec = this.lands.checkHutHasRec.bind(null, this.lands, this);
        rec.getFlatDef().forEach((rel, relFwdName) => {
          
          let relUid = rel.uid;
          
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
          rec.getFlatDef().forEach((rel, relFwdName) => {
            let relUid = rel.uid;
            
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
          console.log(`Added hut with ip "${ip}"`);
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
    let relAreasRecs =  Record.relate1M(Record.stability.secret, Area, LandsRecord, 'relAreasRecs');
    let relLandsWays =  Record.relate1M(Record.stability.secret, Lands, Way, 'relLandsWays');
    let relLandsHuts =  Record.relate1M(Record.stability.secret, Lands, Hut, 'relLandsHuts');
    let relWaysHuts =   Record.relateMM(Record.stability.secret, Way, Hut, 'relWaysHuts');
    
    return {
      Lands, LandsRecord, Hut, Way, Area,
      relLandsRecs,
      relLandsWays,
      relLandsHuts,
      relWaysHuts,
      relAreasRecs
    };
  }
});
