U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    // All huts sit together in the lands
    
    let { Record } = record;
    
    let LandsRecord = U.inspire({ name: 'LandsRecord', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, uid=lands.nextUid() }) {
        insp.Record.init.call(this, { uid });
        this.attach(relLandsRecs, lands);
        this.lands = lands;
       }
    })});
    let Lands = U.inspire({ name: 'Lands', insps: { Record }, methods: (insp, Insp) => ({
      $defaultCommands: {
        getInit: async (inst, hut, msg, reply) => {
          // Reset the hut to reflect a blank Below; then send update data
          hut.resetVersion();
          let initBelow = await foundation.genInitBelow('text/html', hut.getTerm(), hut.genUpdateTell());
          reply(initBelow);
        },
        getFile: async (inst, hut, msg, reply) => {
          reply(U.safe(
            () => foundation.getMountFile(msg.path),
            () => ({ command: 'error', type: 'notFound', orig: msg })
          ));
        },
        fizzle: async(inst, hut, msg) => { /* nothing */ },
        error: async (inst, hut, msg) => { /* nothing */ },
        thunThunk: async (inst, hut, msg) => { /* nothing - reception has already lead to expiry renewal */ },
        getFeedback: async (inst, hut, msg, reply) => {
          reply({
            hut: foundation.hut,
            ms: foundation.getMs()
          });
        },
        /// {BELOW=
        update: async (lands, hut, msg) => {
          let { command, version, content } = msg;
          
          if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
          
          let { addRec={}, remRec={}, updRec={}, addRel={}, remRel={} } = content;
          
          let ops = [];
          let recs = lands.relVal(relLandsRecs);
          
          // Note: validation error messages must begin with 'UPDERR - '; other messages
          // will be considered indicative of errors in broader code
          ops.gain(addRec.toArr(({ uid, type, value }) => ({
            func: () => {
              if (!lands.records.has(type)) throw new Error(`UPDERR - Missing class: ${type}`);
              if (recs.has(uid)) throw new Error(`UPDERR - Add duplicate uid: ${uid}`);
              
              let Cls = lands.records[type];
              let inst = Cls({ uid, lands });
              inst.wobble(value);
            },
            desc: `Add ${type} (${uid})`
          })));
          
          ops.gain(remRec.toArr((v, uid) => ({
            func: () => {
              if (!recs.has(uid)) throw new Error(`UPDERR - Rem missing uid: ${uid}`);
              let rec = recs[uid];
              lands.remRec(rec);
            },
            desc: `Rem ${recs.has(uid) ? recs[uid].constructor.name : '???'} (${uid})`
          })));
          
          ops.gain(updRec.toArr((v, uid) => ({
            func: () => {
              if (!recs.has(uid)) throw new Error(`UPDERR - Upd missing uid: ${uid}`);
              
              let rec = recs[uid];
              rec.wobble(v);
            },
            desc: `Upd ${recs.has(uid) ? recs[uid].constructor.name : '???'} (${uid}) -> ${U.typeOf(v)}`
          })));
          
          ops.gain(addRel.toArr(([ relUid, uid1, uid2 ]) => ({
            func: () => {
              let recs = lands.relVal(relLandsRecs);
              
              if (!lands.relations.has(relUid)) throw new Error(`UPDERR - Add relation missing uid: ${relUid}`);
              if (!recs.has(uid1)) throw new Error(`UPDERR - Can't find a relation target for attach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`UPDERR - Can't find a relation target for attach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              try { rec1.attach(rel, rec2); } catch(err) { throw new Error(`UPDERR - Couldn't attach (${err.message.split('\n').join('; ')})`); }
            },
            desc: `Attach relation ${lands.relations[relUid].desc} (${uid1} + ${uid2})`
          })));
          
          ops.gain(remRel.toArr(([ relUid, uid1, uid2 ]) => ({
            func: () => {
              if (!lands.relations.has(relUid)) throw new Error(`UPDERR - Rem relation missing uid: ${relUid}`);
              if (!recs.has(uid1)) throw new Error(`UPDERR - Can't find a relation target for detach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`UPDERR - Can't find a relation target for detach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              try { rec1.detach(rel, rec2); } catch(err) { throw new Error(`UPDERR - Couldn't detach`); }
            },
            desc: `Detach relation ${lands.relations[relUid].desc} (${uid1} + ${uid2})`
          })));
          
          let successes = [];
          let failures = [];
          let attempts = 0; // TODO: For sanity - take it out eventually
          
          while (ops.length && attempts++ < lands.maxUpdateAttempts) {
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
                if (!err.message.hasHead('UPDERR - ')) throw err;
                failures.push(`${op.desc}:\n${foundation.formatError(err)}`)
                ops.push(op);
              }
            });
            
            if (failures.length && successesNow.isEmpty()) break;
          }
          
          if (attempts >= lands.maxUpdateAttempts) {
            console.log('TOO MANY ATTEMPTS!!', failures);
            throw new Error('Too many attempts');
          }
          
          if (failures.length) {
            console.log('SUCCESS:', successes);
            console.log('FAILURE:', failures);
            throw new Error(`Couldn't fully update!`);
          }
          
          lands.version = version;
        }
        /// =BELOW}
      },
      
      init: function({ foundation, records=[], relations=[], commands=Lands.defaultCommands, heartbeatMs=10000 }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.uidCnt = 0;
        this.maxUpdateAttempts = 1000;
        this.terms = [];
        this.commands = commands;
        this.heartbeatMs = heartbeatMs;
        this.records = U.isType(records, Array) ? records.toObj(r => [ r.name, r ]) : records;
        this.relations = U.isType(relations, Array) ? relations.toObj(r => [ r.uid, r ]) : relations;
        /// {ABOVE=
        // Forget all recs for removed huts. Safeguard against sloppy broader code.
        this.relWob(relLandsHuts).hold(({ rem={} }) => rem.forEach(hut => hut.forgetAllRecs()));
        /// =ABOVE} {BELOW=
        this.version = 0;
        this.heartbeatTimeout = null;
        this.resetHeartbeatTimeout(); // Begin heartbeat
        /// =BELOW}
      },
      nextUid: function() {
        /// {ABOVE=
        return (this.uidCnt++).toString(36).padHead(8, '0');
        /// =ABOVE} {BELOW=
        return '~' + (this.uidCnt++).toString(36).padHead(8, '0');
        /// =BELOW}
      },
      genUniqueTerm: function() {
        let ret = this.terms[Math.floor(Math.random() * this.terms.length)];
        return this.relVal(relLandsHuts).find(hut => hut.term === ret) ? this.genUniqueTerm() : ret;
      },
      
      hear: async function(hut, msg, reply=null) {
        let { command } = msg;
        
        /// {ABOVE=
        this.commands.has(command)
          ? await this.commands[command](this, hut, msg, reply)
          : hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
        /// =ABOVE} {BELOW=
        try {         await this.commands[command](this, hut, msg, reply); }
        catch(err) {  console.log('Reload:', foundation.formatError(err)); if (false) window.location.reload(true); }
        /// =BELOW}
      },
      tell: async function(msg) {
        /// {BELOW=
        this.resetHeartbeatTimeout(); // Only need to send heartbeats when we haven't sent anything for a while
        /// =BELOW}
        return Promise.allObj(this.relVal(relLandsHuts).map(hut => hut.tell(msg)));
      },
      /// {BELOW=
      resetHeartbeatTimeout: function() {
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker; only wait a percentage of the overall time
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), this.heartbeatMs * 0.8);
      },
      /// =BELOW}
      remRec: function(rec) {
        // TODO: All forgetting should happen as a result of Wobblies
        // This method should be removed.
        // Rename `Record.prototype.isolate` -> `Record.prototype.rem`
        // A call to `aRecord.rem()` should result in all forgetting!
        
        /// {ABOVE=
        // Cause all huts to forget about this record!
        this.relVal(relLandsHuts).map(hut => hut.forgetRec(rec) ? hut : C.skip);
        /// =ABOVE}
        rec.isolate(); // Detach `rec` from EVERYTHING!
      },
      
      open: async function() {
        /// {ABOVE=
        this.terms = JSON.parse(await foundation.readFile('room/hinterlands/terms.json'));
        /// =ABOVE} {BELOW=
        this.terms = [ 'remote' ];
        /// =BELOW}
        
        await Promise.allObj(this.relVal(relLandsWays).map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let hut = this.relVal(relLandsHuts).find(() => true)[0];
        await this.hear(hut, U.initData); // Hear the initial update
        /// =BELOW}
      },
      shut: async function() { return Promise.allObj(this.relVal(relLandsWays).map(w => w.shut())); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, address }) {
        if (!lands) throw new Error('Missing "lands"');
        
        insp.Record.init.call(this, {});
        this.lands = lands;
        this.address = address;
        this.term = null;
        
        /// {ABOVE=
        this.version = 0;
        this.holds = {};
        this.addRec = {};
        this.remRec = {}; // TODO: Confusing to have `hut.remRec` (an Object), and `lands.remRec` (a method)
        this.updRec = {};
        this.addRel = {};
        this.remRel = {};
        
        this.expiryTimeout = null;
        this.refreshExpiry();
        this.informThrottlePrm = null;
        /// =ABOVE}
      },
      getTerm: function() {
        if (!this.term) this.term = this.lands.genUniqueTerm();
        return this.term;
      },
      
      /// {ABOVE=
      refreshExpiry: function(ms=this.lands.heartbeatMs) {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = setTimeout(() => this.lands.remRec(this), ms);
      },
      
      followRec: function(rec, uid=rec.uid) {
        
        if (rec.constructor.name === 'Player') {
          console.log(`HERE!!!! Hut: ${this.getTerm()} -> Player: ${rec.uid}`);
        }
        
        if (this.holds.has(uid)) return;
        
        // Track `rec`; our hold on `rec` itself, and all its relations
        var hold = { rec, value: null, rel: {}, amt: 0 };
        
        // Need to send initial data for this record now
        this.addRec[uid] = rec; // `requestInformBelow` is called at the end of this method
        
        // Need to send updated data for this record later
        hold.value = rec.hold(val => {
          if (this.addRec.has(rec.uid)) return; // Don't send "upd" along with "add"
          this.updRec[rec.uid] = val;
          this.requestInformBelow();
        });
        
        // Sync all relations similarly
        rec.getFlatDef().forEach((rel, relFwdName) => {
          
          let relUid = rel.uid;
          
          let wob = rec.relWob(rel);
          
          // Normalize; regardless of cardinality deal with a maplist of Records
          let attached = wob.value;
          if (!U.isType(attached, Object)) attached = attached ? { [attached.uid]: attached } : {};
          
          // Need to send initial relations for this record now
          attached.forEach((rec2, uid2) => {
            // Skip relations outside the hut's knowledge
            if (!this.holds.has(uid2)) return;
            this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ]; // `requestInformBelow` is called at the end of this method
          });
          
          // Need to send updated relations for this record later
          let relType = rec.getRelPart(rel).clsRelFwd.type;
          let relHold = ({
            type1: (newVal, oldVal) => {
              if (newVal) {
                if (!this.holds.has(newVal.uid)) return;
                this.addRel[`${relUid}.${U.multiKey(uid, newVal.uid)}`] = [ relUid, uid, newVal.uid, rel.name1 ];
                this.requestInformBelow();
              } else {
                if (!oldVal || !this.holds.has(oldVal.uid)) return;
                this.remRel[`${relUid}.${U.multiKey(uid, oldVal.uid)}`] = [ relUid, uid, oldVal.uid, rel.name1 ];
                this.requestInformBelow();
              }
            },
            typeM: ({ add={}, rem={} }) => {
              add.forEach((rec2, uid2) => {
                if (!this.holds.has(uid2)) return;
                this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2, rel.name1 ];
                this.requestInformBelow();
              });
              rem.forEach((rec2, uid2) => {
                if (!this.holds.has(uid2)) return;
                this.remRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2, rel.name1 ];
                this.requestInformBelow();
              });
            }
          })[`type${relType}`];
          
          hold.rel[relUid] = { wob, f: wob.hold(relHold) };
          if (!hold.rel[relUid]) throw new Error('Didn\'t get a function out of "hold"');
          
        });
        
        this.holds[uid] = hold;
        
        // This method has changed the delta, at least to include `rec` and probably to include
        // several of its relations. Need to inform our Below
        this.requestInformBelow();
      },
      forgetRec: function(rec, uid=rec.uid) {
        // Note that the dropping here is "safe" - doesn't throw errors
        // It's possible that a followed record has been "isolated"; in this
        // case all relations are already dropped and these attempts to drop
        // are redundant. No need to worry about leaks though - once `rec`
        // is detached from `Lands` the `Lands` will ensure all huts forget
        // `rec` appropriately.
        
        // Note that forgetting the Record does NOT clear any delta memory!
        // This is because the delta still needs to be delivered to our Below.
        // To deal with careless broader code, calling `forgetRec` issues a
        // call to `requestInformBelow`, just to make sure the Below is aware
        // the Record no longer exists
        
        // TODO: Consider ensuring that "remRec" and "remRel" deltas are filled
        // out?
        
        if (!this.holds.has(uid)) return null;
        
        let recs = this.lands.relVal(relLandsRecs);
        
        let { value, rel } = this.holds[uid];
        
        // Record and associated relations need to be removed from Below
        // Note that specifying the removed Record is sufficient to also
        // remove all relations associated with it!
        this.remRec[uid] = 1;
        this.requestInformBelow();
        
        // Drop the value and relation holders...
        rec.drop(value, true); // Drop safely. It may have already been dropped.
        rel.forEach(({ wob, f }) => wob.drop(f, true));
        
        // And finally forget our reference to the hold itself
        delete this.holds[uid];
        
        return rec;
      },
      forgetAllRecs: function() {
        this.holds.forEach(hold => this.forgetRec(hold.rec));
      },
      incFollow: function(rec, uid=rec.uid) {
        
        if (!this.holds.has(uid)) this.followRec(rec, uid);
        this.holds[uid].amt++;
        
      },
      decFollow: function(rec, uid=rec.uid) {
        
        if (!this.holds.has(uid)) return;
        this.holds[uid].amt--;
        if (this.holds[uid].amt <= 0) this.forgetRec(rec, uid);
        
      },
      genFollowTemp: function(rec) {
        return { open: () => this.incFollow(rec), shut: () => this.decFollow(rec) };
      },
      
      resetVersion: function() {
        // Clears memory of current delta and generates a new delta which would bring
        // a blank Below up to date. Resets this Hut's version to 0 to reflect the Below
        // is currently blank. Note that this method modifies our memory of the delta
        // **without calling `requestInformBelow`**!! This means that the caller needs
        // to insure the Below is eventually sent the data to bring it up to date.
        
        // Clear current delta...
        [ 'addRec', 'remRec', 'updRec', 'addRel', 'remRel' ].forEach(p => { this[p] = {}; });
        
        // Now recalculate!
        let recs = this.lands.relVal(relLandsRecs);
        this.holds.forEach((hold, uid) => {
          
          // Send an "addRec" for this record
          let rec = recs[uid];
          this.addRec[uid] = rec;
          
          // Send an "addRel" for each of this record's relations
          rec.getFlatDef().forEach((rel, relFwdName) => {
            let relUid = rel.uid;
            
            // Normalize; regardless of cardinality deal with a maplist of Records
            let attached = rec.relVal(rel);
            if (!U.isType(attached, Object)) attached = attached ? { [attached.uid]: attached } : {};
            
            attached.forEach((rec2, uid2) => {
              // Skip relations outside the hut's knowledge
              if (!this.holds.has(uid2)) return;
              this.addRel[`${relUid}.${U.multiKey(uid, uid2)}`] = [ relUid, uid, uid2 ];
            });
          });
          
        });
        
        this.version = 0;
        this.versionHist = [];
      },
      offloadInformData: function() {
        // Returns the delta of data to be sent Below. Clears the Hut's memory
        // of this delta.
        
        // 1) Sanitize our delta:
        
        // Don't affect relations of Records being removed
        // Don't add Records which are removed
        if (!this.remRec.isEmpty()) {
          let r = this.remRec;
          this.addRel = this.addRel.map(v => r.has(v[1]) || r.has(v[2]) ? C.skip : v);
          this.remRel = this.remRel.map(v => r.has(v[1]) || r.has(v[2]) ? C.skip : v);
          this.remRec.forEach((r, uid) => { delete this.addRec[uid]; });
        }
        
        // Don't update Records being added
        this.addRec.forEach((r, uid) => { delete this.updRec[uid]; });
        
        // 2) Construct "tell" based on our delta:
        
        let content = {};
        
        [ 'addRec', 'remRec', 'updRec', 'addRel', 'remRel' ].forEach(p => {
          if (!this[p].isEmpty()) content[p] = this[p];
          this[p] = {};
        });
        
        // TODO: Actual value calculations should be performed as late as possible?
        // Or should `offloadInformData` just be called as late as possible?
        if (content.has('addRec')) content.addRec = content.addRec.map(rec => ({
          uid: rec.uid,
          type: rec.constructor.name,
          value: rec.getValue()
        }));
        
        return content;
      },
      genUpdateTell: function() {
        // Generates a "tell" msg to bring the Below up to date. Has the side-effect
        // of clearing this Hut's memory of the current delta.
        
        let content = this.offloadInformData(); // Clear our memory of the delta; it will be sent Below
        if (content.isEmpty()) return null;
        this.version++;
        //this.versionHist.push(this.version);
        //console.log('TIME:', +new Date(), 'HUT', this.address, '->', this.versionHist);
        return { command: 'update', version: this.version, content }
      },
      requestInformBelow: function() {
        // Implements inform-below-throttling. Schedules a new request to inform
        // our Below if there is not already a request to do so.
        
        if (!this.informThrottlePrm) {
          
          this.informThrottlePrm = (async () => {
            await new Promise(r => process.nextTick(r)); // TODO: This could be swapped out (to a timeout, or whatever!)
            this.informThrottlePrm = null;
            let updateTell = this.genUpdateTell();
            if (updateTell) this.tell(updateTell);
            return updateTell;
          })();
          
        }
        
        return this.informThrottlePrm;
      },
      /// =ABOVE}
      
      favouredWay: function() {
        let findWay = this.relVal(relWaysHuts).find(() => true);
        return findWay ? findWay[0] : null;
      },
      tell: async function(msg) {
        
        console.log('TELL:', this.getTerm(), JSON.stringify(msg, null, 2));
        
        // Could consider making `favouredWay` async - that way if it isn't present when
        // we call this method, it could become present eventually
        let way = this.favouredWay();
        if (!way) return; // throw new Error(`Hut ${this.address} has no favoured Way`);
        await way.tellHut(this, msg);
      }
    })});
    let Way = U.inspire({ name: 'Way', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, makeServer=null }) {
        if (!lands) throw new Error('Missing "lands"');
        if (!makeServer) throw new Error('Missing "makeServer"');
        
        insp.Record.init.call(this, { lands });
        this.lands = lands;
        this.makeServer = makeServer;
        this.server = null;
        this.serverFunc = null
        this.connections = {};
      },
      
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(async hutWob => {
          
          // Get the address
          let { address } = hutWob;
          
          // Create the Hut, and reference by address
          let hut = Hut({ lands: this.lands, address });
          this.connections[address] = { wob: hutWob, hut };
          
          // Forget about this hut
          hutWob.shut.hold(closed => { if (closed) delete this.connections[address]; });
          
          // Pass anything heard on to our Lands
          hutWob.hear.hold(([ msg, reply=null ]) => {
            this.lands.hear(hut, msg, reply);
            
            /// {ABOVE=
            // Any communication from a Hut refreshes its expiry
            hut.refreshExpiry();
            /// =ABOVE}
          });
          
          // Attach the Hut to the Way and to the Lands
          hut.attach(relWaysHuts, this);
          hut.attach(relLandsHuts, this.lands);
          
          // When the connection is closed, remove the Hut (TODO: Consider uncommenting?)
          //hutWob.shut.hold(shut => shut && hut.isolate());
          
          // Close the connection when the Hut is removed
          hut.relWob(relLandsHuts).hold(lands => (!lands) ? hutWob.shut.wobble(true) : null);
          
        });
      },
      shut: async function() {
        throw new Error('not implemented');
      },
      
      tellHut: function(hut, msg) {
        if (!this.connections.has(hut.address)) throw new Error(`Tried to tell disconnected hut: ${hut.getTerm()}`);
        this.connections[hut.address].wob.tell.wobble(msg);
      }
    })});
    
    let relLandsRecs =  Record.relate1M(Lands, LandsRecord, 'relLandsRecs');
    let relLandsWays =  Record.relate1M(Lands, Way, 'relLandsWays');
    let relLandsHuts =  Record.relate1M(Lands, Hut, 'relLandsHuts');
    let relWaysHuts =   Record.relateMM(Way, Hut, 'relWaysHuts');
    
    return {
      Lands, LandsRecord, Hut, Way,
      relLandsRecs,
      relLandsWays,
      relLandsHuts,
      relWaysHuts
    };
  }
});
