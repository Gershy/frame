U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    // All huts sit together in the lands
    
    let { Record } = record;
    
    let TERMS = [];
    
    let LandsRecord = U.inspire({ name: 'LandsRecord', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, uid=lands.nextUid(), value=null }) {
        insp.Record.init.call(this, { uid, value });
        this.lands = lands;
        this.attach(relLandsRecs, lands);
       }
    })});
    let Lands = U.inspire({ name: 'Lands', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ foundation, records=[], relations=[], commands={}, heartbeatMs=10000 }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.uidCnt = 0;
        this.maxUpdateAttempts = 1000;
        this.commands = commands;
        this.comWobs = {};
        this.heartbeatMs = heartbeatMs;
        this.records = U.isType(records, Array) ? records.toObj(r => [ r.name, r ]) : records;
        this.relations = U.isType(relations, Array) ? relations.toObj(r => [ r.uid, r ]) : relations;
        
        /// {BELOW=
        
        // Some values to control transmission
        this.version = 0;
        this.heartbeatTimeout = null;
        this.resetHeartbeatTimeout(); // Begin heartbeat
        
        /// =BELOW}
        
        // Lands have some "required" commands which are in place regardless of the current hut
        let requiredCommand = (name, effect) => {
          this.commands[name] = 1;
          this.comWob(name).hold(effect);
        };
        requiredCommand('error', async ({ hut, msg, reply }) => { /* nothing */ });
        requiredCommand('fizzle', async ({ hut, msg, reply }) => { /* nothing */ });
        
        /// {ABOVE=
        
        requiredCommand('getInit', async ({ hut, msg, reply }) => {
          // Reset the hut to reflect a blank Below; then send update data
          hut.resetVersion();
          let initBelow = await foundation.genInitBelow('text/html', hut.getTerm(), hut.genUpdateTell());
          reply(initBelow);
        });
        requiredCommand('getFile', async ({ hut, msg, reply }) => {
          reply(U.safe(
            () => foundation.getMountFile(msg.path),
            () => ({ command: 'error', type: 'notFound', orig: msg })
          ));
        });
        requiredCommand('thunThunk', async ({ hut, msg, reply }) => { /* nothing */ });
        
        /// =ABOVE} {BELOW=
        
        requiredCommand('update', async ({ lands, hut, msg, reply }) => {
          
          let { command, version, content } = msg;
          
          let recs = lands.relVal(relLandsRecs);
          
          try {
            if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
            
            // Apply all operations
            let { addRec={}, remRec={}, updRec={}, addRel={}, remRel={} } = content;
            addRec.forEach(({ uid, type, value }) => {
              if (!lands.records.has(type)) throw new Error(`Missing class: ${type}`);
              if (recs.has(uid)) throw new Error(`Add duplicate uid: ${uid}`);
              
              let Cls = lands.records[type];
              let inst = Cls({ uid, lands });
              inst.wobble(value);
            });
            updRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Upd missing uid: ${uid}`);
              recs[uid].wobble(v);
            });
            remRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Rem missing uid: ${uid}`);
              recs[uid].shut();
            });
            addRel.forEach(([ relUid, uid1, uid2 ]) => {
              if (!lands.relations.has(relUid)) throw new Error(`Add relation missing uid: ${relUid}`);
              
              if (!recs.has(uid1)) throw new Error(`Can't find a relation target for attach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Can't find a relation target for attach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              try { rec1.attach(rel, rec2); } catch(err) { err.message = `Couldn't attach: ${err.message}`; throw err; }
            });
            remRel.forEach(([ relUid, uid1, uid2 ]) => {
              if (!lands.relations.has(relUid)) throw new Error(`Rem relation missing uid: ${relUid}`);
              
              if (!recs.has(uid1)) throw new Error(`Can't find a relation target for detach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Can't find a relation target for detach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs[uid1], recs[uid2] ];
              try { rec1.detach(rel, rec2); } catch(err) { err.message = `Couldn't detach: ${err.message}`; throw err; }
            });
          } catch(err) {
            err.message = `ABOVE CAUSED: ${err.message}`;
            throw err;
          }
          lands.version = version;
          
        });
        
        /// =BELOW}
      },
      nextUid: function() {
        /// {ABOVE=
        return (this.uidCnt++).toString(36).padHead(8, '0');
        /// =ABOVE} {BELOW=
        // The "~" prefix prevents collision between local/shared Records
        return '~' + (this.uidCnt++).toString(36).padHead(8, '0');
        /// =BELOW}
      },
      genUniqueTerm: function() {
        let ret = TERMS[Math.floor(Math.random() * TERMS.length)];
        return this.relVal(relLandsHuts).find(hut => hut.term === ret) ? this.genUniqueTerm() : ret;
      },
      
      comWob: function(command) {
        if (!this.comWobs.has(command)) {
          if (!this.commands.has(command)) throw new Error(`Invalid command: "${command}"`);
          this.comWobs[command] = U.Wob({});
        }
        return this.comWobs[command];
      },
      hear: async function(hut, msg, reply=null) {
        let { command } = msg;
        if (!this.commands.has(command)) {
          return hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
        }
        
        this.comWob(command).wobble({ lands: this, hut, msg, reply, dudo: true });
        hut.comWob(command).wobble({ lands: this, hut, msg, reply, dudo: true });
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
      
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'remote' ];
        /// =BELOW}
        
        await Promise.allObj(this.relVal(relLandsWays).map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let hut = this.relVal(relLandsHuts).find(() => true)[0];
        await this.hear(hut, U.initData); // Lands Below immediately hear the Above's initial update
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
        this.comWobs = {};
        
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
      comWob: function(command) {
        if (!this.comWobs.has(command)) {
          if (!this.lands.commands.has(command)) throw new Error(`Invalid command: "${command}"`);
          this.comWobs[command] = U.Wob({});
        }
        return this.comWobs[command];
      },
      
      /// {ABOVE=
      refreshExpiry: function(ms=this.lands.heartbeatMs) {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = setTimeout(() => this.shut(), ms);
      },
      
      // TODO: AccessPaths don't support "access strength"! Need to implement that here...
      followRec: function(rec, uid=rec.uid) {
        
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
        return { command: 'update', version: this.version, content }
      },
      requestInformBelow: function() {
        // Implements inform-below-throttling. Schedules a new request to inform
        // our Below if there is not already a request to do so.
        
        if (!this.informThrottlePrm) {
          
          this.informThrottlePrm = (async () => {
            await new Promise(r => process.nextTick(r)); // TODO: This could be swapped out (to a timeout, or whatever!)
            
            // It's possible that in between scheduling and performing the tick,
            // this Hut has become isolated. In this case no update should occur
            if (!this.relVal(relLandsHuts)) return null;
            
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
        // Could consider making `favouredWay` async - that way if it isn't present when
        // we call this method, it could become present eventually
        let way = this.favouredWay();
        if (!way) {
          console.log('Couldn\'t tell:', this.getTerm(), msg);
          throw new Error(`Hut ${this.address} has no Ways`);
        }
        await way.tellHut(this, msg);
      }
    })});
    let Way = U.inspire({ name: 'Way', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, makeServer=null }) {
        if (!lands) throw new Error('Missing "lands"');
        if (!makeServer) throw new Error('Missing "makeServer"');
        
        insp.Record.init.call(this, {});
        this.lands = lands;
        this.makeServer = makeServer;
        this.server = null;
        this.serverFunc = null
        this.connections = {};
      },
      
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(async absConn => {
          
          // For connections: service heirarchy from lowest to highest:
          // 1) FundamentalConnection (HTTP, SOKT, etc.)
          // 2) AbstractConnection (here, `absConn`)
          //    - Provides connection events; provides state for stateless
          //      FundamentalConnections
          // 3) Connected Hut (the thing provided by this function)
          //    - A HinterlandsRecord which persists for the duration of its
          //      AbstractConnection 
          
          // Get the address; ensure it isn't already connected
          let { address } = absConn;
          if (this.connections.has(address)) throw new Error(`Multiple Huts at address ${address} - makeServer is likely flawed`);
          
          // Create the Hut, and reference by address
          let hut = Hut({ lands: this.lands, address });
          
          this.connections[address] = { absConn, hut };
          
          // Clean up AbstractConnection and Hut when the connection is closed
          absConn.shut.hold(closed => {
            delete this.connections[address];
            hut.shut();
          });
          
          // Pass anything heard on to our Lands
          absConn.hear.hold(([ msg, reply=null ]) => {
            this.lands.hear(hut, msg, reply);
            
            /// {ABOVE=
            // Any communication from a Hut refreshes its expiry
            hut.refreshExpiry();
            /// =ABOVE}
          });
          
          // Removing the hut results in the connection being closed
          // This gives higher applications control over the connection
          hut.relWob(relLandsHuts).detach.hold(() => absConn.shut.wobble(true));
          
          // Attach the Hut to the Way and to the Lands
          this.attach(relWaysHuts, hut);
          this.lands.attach(relLandsHuts, hut);
          
        });
      },
      shut: async function() {
        throw new Error('not implemented');
      },
      
      tellHut: function(hut, msg) {
        if (!this.connections.has(hut.address)) throw new Error(`Tried to tell disconnected hut: ${hut.getTerm()}`);
        this.connections[hut.address].absConn.tell.wobble(msg);
      }
    })});
    
    let rel = {
      landsRecs: Record.relate1M(Lands, LandsRecord, 'landsRecs'),
      landsWays: Record.relate1M(Lands, Way, 'landsWays'),
      landsHuts: Record.relate1M(Lands, Hut, 'landsHuts'),
      waysHuts: Record.relateMM(Way, Hut, 'waysHuts')
    };
    
    let relLandsRecs =  Record.relate1M(Lands, LandsRecord, 'relLandsRecs');
    let relLandsWays =  Record.relate1M(Lands, Way, 'relLandsWays');
    let relLandsHuts =  Record.relate1M(Lands, Hut, 'relLandsHuts');
    let relWaysHuts =   Record.relateMM(Way, Hut, 'relWaysHuts');
    
    let content = { Lands, LandsRecord, Hut, Way, rel };
    
    /// {TEST=
    content.test = rootKeep => rootKeep.contain(k => U.Keep(k, 'hinterlands').contain(k => {
      
    }));
    /// =TEST}
    
    return content;
  }
});
