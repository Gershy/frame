// TODO: HEEERE! Moved back to 2-way Relations and "record" and "hinterlands"
// are 100% passing. Still a bit more housekeeping:
// - Do a final review of "record"
// - Do a final review of "hinterlands" (make sure static setup (like adding Ways to Lands) doesn't use Relations!)
// - Write more hinterlands tests:
//   - head related to tail; only head followed; don't sync rels
//   - head related to tail; only tail followed; don't sync rels
//   - head related to tail; both followed; rel detached; unsync relation
//   - head related to tail; both followed; sync rels; tail shut; unsync rels
//   - head related to tail; both followed; sync rels; head shut; unsync rels
//   - head related to tail; both followed; sync rels; tail shut; clean up memory
//   - head related to tail; both followed; sync rels; head shut; clean up memory
//   - Hut syncs a bunch of deltas, then reconnects and syncs everything at once
// - Make sure hinterlands is 100% passing!

U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    // All huts sit together in the lands
    
    // TODO: WobOne instances need to exist before the first wobble is due. They
    // must immediately wobble upon hold if they've already wobbled beforehand,
    // and won't do so if they're only instantialized after the first wobble
    // occurred.
    
    let { Record, Relation } = record;
    let { Hog, AccessPath } = U;
    
    let TERMS = [];
    
    let LandsRecord = U.inspire({ name: 'LandsRecord', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ lands, uid=lands.nextUid(), value=null }) {
        insp.Record.init.call(this, { uid, value });
        this.lands = lands;
        
        /// {BELOW=
        // Only Below needs a flat list of all Records! Need to be able to
        // directly find Records by uid for update/removal. The only alternative
        // would be to form complex Record addresses, walking from the Lands
        // until the desired Record
        lands.allRecs.set(this.uid, this);
        this.shutWob().hold(() => lands.allRecs.delete(this.uid));
        /// =BELOW}
       }
    })});
    let Lands = U.inspire({ name: 'Lands', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ foundation, records=[], relations=[], commands={}, heartbeatMs=10000 }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.uidCnt = 0;
        this.commands = commands; // TODO: Doesn't need to be listed...
        this.comWobs = {};
        this.heartbeatMs = heartbeatMs;
        
        this.records = new Map();
        for (let rec of records) this.records.set(rec.name, rec);
        
        this.relations = new Map();
        for (let rel of relations) this.relations.set(rel.uid, rel);
        
        this.ways = new Set();
        
        /// {BELOW=
        
        // Some values to control transmission
        this.allRecs = new Map();
        this.version = 0;
        this.heartbeatTimeout = null;
        this.resetHeartbeatTimeout(); // Begin heartbeat
        
        /// =BELOW}
        
        // TODO: Clean this up when `this.commands` is removed
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
          let update = hut.genUpdateTell();
          let initBelow = await foundation.genInitBelow('text/html', hut.getTerm(), update);
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
          
          // TODO: This is all out of date!!
          // TODO: multiKey stuff for relations needs to be changed! Relations
          // are now ordered!
          
          let { command, version, content } = msg;
          
          let recs = lands.allRecs;
          
          try {
            if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
            
            let agg = U.AggWobs();
            
            // Apply all operations
            let { addRec={}, remRec={}, updRec={}, addRel={}, remRel={} } = content;
            addRec.forEach(({ uid, type, value }) => {
              if (!lands.records.has(type)) throw new Error(`Missing class: ${type}`);
              if (recs.has(uid)) throw new Error(`Add duplicate uid: ${uid}`);
              
              let Cls = lands.records[type];
              let inst = agg.addWob(Cls({ uid, lands }));
              inst.wobble(value);
            });
            updRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Upd missing uid: ${uid}`);
              agg.addWob(recs.get(uid)).wobble(v);
            });
            remRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Rem missing uid: ${uid}`);
              agg.addWob(rec.shutWob());
              recs.get(uid).shut();
            });
            addRel.forEach(([ relUid, uid1, uid2 ]) => {
              if (!lands.relations.has(relUid)) throw new Error(`Add relation missing uid: ${relUid}`);
              
              if (!recs.has(uid1)) throw new Error(`Can't find a relation target for attach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Can't find a relation target for attach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs.get(uid1), recs.get(uid2) ];
              try { rec1.attach(rel, rec2, agg); } catch(err) { err.message = `Couldn't attach: ${err.message}`; throw err; }
            });
            remRel.forEach(([ relUid, uid1, uid2 ]) => {
              if (!lands.relations.has(relUid)) throw new Error(`Rem relation missing uid: ${relUid}`);
              
              if (!recs.has(uid1)) throw new Error(`Can't find a relation target for detach; uid: ${uid1}`);
              if (!recs.has(uid2)) throw new Error(`Can't find a relation target for detach; uid: ${uid2}`);
              
              let rel = lands.relations[relUid];
              let [ rec1, rec2 ] = [ recs.get(uid1), recs.get(uid2) ];
              try {
                // TODO: This requires understanding internal implementation
                let wob = rec1.getWob(rel);
                let relRec = rel.cardinality[1] === '1' ? wob.relRec : wob.relRec[rec2.uid];
                agg.addWob(relRec.shutWob());
                relRec.shut();
              } catch(err) { err.message = `Couldn't detach: ${err.message}`; throw err; }
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
        let uid = (this.uidCnt++).toString(36).padHead(8, '0');
        /// {BELOW=
        uid = '~' + uid; // Differentiate from Above uids (TODO: Is this ever used?)
        /// =BELOW}
        return uid;
      },
      genUniqueTerm: function() {
        let huts = this.relVal(rel.landsHuts.fwd);
        for (let i = 0; i < 100; i++) { // TODO: This can't last. `100` is arbitrary!
          let ret = TERMS[Math.floor(Math.random() * TERMS.length)];
          if (!huts.find(hut => hut.term === ret)) return ret;
        }
        throw new Error('Too many huts! Not enough terms!! AHHHH!!!');
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
        
        this.comWob(command).wobble({ lands: this, hut, msg, reply });
        hut.comWob(command).wobble({ lands: this, hut, msg, reply });
      },
      tell: async function(msg) {
        /// {BELOW=
        this.resetHeartbeatTimeout(); // Only need to send heartbeats when we haven't sent anything for a while
        /// =BELOW}
        return Promise.allObj(this.relVal(rel.landsHuts).map(hut => hut.tell(msg)));
      },
      
      /// {ABOVE=
      allRelationsFor: function(rec) {
        let ret = [];
        for (let [ uid, rel ] of this.relations) {
          if (rec.isInspiredBy(rel.fwd.head)) ret.push(rel.fwd);
          if (rec.isInspiredBy(rel.bak.head)) ret.push(rel.bak);
        }
        return ret;
      },
      /// =ABOVE} {BELOW=
      resetHeartbeatTimeout: function() {
        if (!this.heartbeatMs) return;
        
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker; wait a percentage of the overall time
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), this.heartbeatMs * 0.8);
      },
      /// =BELOW}
      
      // TODO: async functions shouldn't be named "open" and "shut"
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'remote' ]; // Below has only 1 Hut, so only 1 name needed
        /// =BELOW}
        
        await Promise.all([ ...this.ways ].map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let hut = this.relVal(rel.landsHuts).find(() => true)[0];
        await this.hear(hut, U.initData); // Lands Below immediately hear the Above's initial update
        /// =BELOW}
      },
      shut: async function() { return Promise.all([ ...this.ways ].map(w => w.shut())); }
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
        // Keep track of which Records the Below for this Hut has followed
        this.version = 0;
        this.fols = new Map();
        this.sync = [ 'addRec', 'remRec', 'updRec', 'addRel', 'remRel' ].toObj(v => [ v, {} ]);
        
        // Keep track of whether the Below for this Hut is still communicating
        this.expiryTimeout = null;
        this.informThrottlePrm = null;
        this.refreshExpiry();
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
        if (!ms) return;
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = setTimeout(() => this.shut(), ms);
      },
      
      toSync: function(type, k, v) {
        // TODO: Under some situations 2 related Records could both be sending
        // "addRel" UpdateParts - for rec1 and rec2, follow rec1, then follow
        // rec2, then relate rec1 and rec2.
        // For MEAN validation throw error if `this.sync[type]` already has `k`!
        if (!this.sync.has(type)) throw new Error(`Invalid type: ${type}`);
        this.sync[type][k] = v;
        this.requestInformBelow();
      },
      getRecFollowStrength: function(rec) { return (this.fols.get(rec) || { strength: 0 }).strength; },
      setRecFollowStrength: function(rec, strength) {
        
        if (strength < 0) throw new Error(`Invalid strength: ${strength}`);
        
        let fol = this.fols.get(rec) || null;
        let strength0 = (fol || { strength: 0 }).strength;
        if (strength === strength0) throw new Error(`Strength is already ${strength}`);
        
        if (!strength0) {                   // ADD
          
          let ap = AccessPath(U.WobVal(rec), (dep, rec) => {
            
            // Initial "addRec" UpdatePart
            this.toSync('addRec', rec.uid, rec);
            dep({
              shut: () => this.toSync('remRec', rec.uid, 1),
              shutWob: () => C.nullShutWob
            });
            
            // Hold changes to `rec` while the Follow persists
            dep(rec.hold(val => this.toSync('updRec', `${rec.uid}`, val)));
            
            // Follow every RelationHalf belonging to `rec`
            dep(AccessPath(rec.relsWob(), (dep, relF) => {
              
              // Follow every RelRec for this RelationHalf of `rec`
              dep(AccessPath(rec.relWob(relF), (dep, relRec) => {
                
                // We only want to sync this RelationHalf if its tail Record is also
                // synced - otherwise the Tail uid would refer to a non-existent
                // Record on Below's end. We'll take advantage of the fact that for
                // `rec` and `relRec.rec`, this point in the code is being hit twice:
                // now when we sync rec->relRec.rec, and again in reverse. Maybe we
                // avoid syncing this Relation because the Tail isn't Followed yet,
                // but as soon as the Tail is Followed and the code reaches this same
                // point in reverse, the "avoidance" won't occur (since now the tail
                // is `rec`, and `rec` is certainly Followed!)
                
                if (!this.fols.has(relRec.rec)) return;
                
                let [ head, tail ] = [ rec, relRec.rec ];
                if (relF.dir === 'bak') [ head, tail ] = [ tail, head ];
                
                // The uid only takes us to the Relation, not the RelationHalf
                // It is IMPLICIT that the uid specifies `exampleRelation.fwd`
                let uidArr = [ relF.rel.uid, head.uid, tail.uid ];
                let uidStr = uidArr.join('/');
                
                this.toSync('addRel', uidStr, uidArr.concat([ relF.name ]));
                dep({
                  shut: () => this.toSync('remRel', uidStr, uidArr.concat([ relF.rel.fwd.name ])),
                  shutWob: () => C.nullShutWob
                });
                
              }));
              
            }));
            
          });
          this.fols.set(rec, { strength, ap });
          
        } else if (strength0 && strength) { // UPD
          
          fol.strength = strength;
          
        } else {                            // REM
          
          // Clean up all Follow-related data for the Record
          this.fols.delete(rec);
          
          // Close the AccessPath
          fol.ap.shut();
          
          // Note: No need to issue `remRel` for each of the Record's relations
          // If the Record is shut, so are its relations
          // TODO: What if the removed Record is at the tail of a Relation?
          // How do we signal that the head needs to remove its Relation?
          this.sync.remRec[`${rec.uid}`] = 1; // Signal that the rec is removed
          
          // Send this message Below
          this.requestInformBelow();
          
        }
        
      },
      followRec: function(rec) {
        
        this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) + 1);
        return Hog(() => this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) - 1));
        
      },
      
      resetVersion: function() {
        // Clears memory of current delta and generates a new delta which would bring
        // a blank Below up to date. Resets this Hut's version to 0 to reflect the Below
        // is currently blank. Note that this method modifies our memory of the delta
        // **without calling `requestInformBelow`**!! This means that the caller needs
        // to insure the Below is eventually sent the data to bring it up to date.
        // This function is useful if a Hut was getting sequential updates and lost
        // track of the sequence.
        
        if (this.version === 0) return;
        
        // Clear current delta...
        this.sync = this.sync.map(v => ({}));
        
        // Rebuild delta based on immediate state
        this.fols.forEach((fol, rec) => {
          
          this.sync.addRec[`${rec.uid}`] = rec;
          
          rec.relsWob().forEach(relF => {
            rec.relWob(relF).forEach(({ rec: rec2 }) => {
              let [ head, tail ] = [ rec, rec2 ];
              if (relF.dir === 'bak') [ head, tail ] = [ tail, head ];
              this.sync.addRel[`${relF.rel.uid}/${head.uid}/${tail.uid}`] = [ relF.rel.uid, head.uid, tail.uid, relF.rel.fwd.name ];
            });
          });
          
        });
        
        this.version = 0;
      },
      genUpdateTell: function() {
        // Generates a "tell" msg to bring the Below up to date. Has the side-effect
        // of clearing this Hut's memory of the current delta.
        
        // 1) Sanitize our delta:
        
        let sync = this.sync;
        
        // Don't affect relations of Records being removed; don't add Records which are removed
        if (!sync.remRec.isEmpty()) {
          let remRec = sync.remRec;
          
          // Relation changes are unecessary if either the head or tail of the Relation is removed
          sync.addRel = sync.addRel.map(v => remRec.has(v[1]) || remRec.has(v[2]) ? C.skip : v);
          sync.remRel = sync.remRel.map(v => remRec.has(v[1]) || remRec.has(v[2]) ? C.skip : v);
          remRec.forEach((r, uid) => { delete sync.addRec[uid]; }); // If "addRec" and "remRec" are sent together, "remRel" wins
        }
        
        // Prioritize "remRel" ahead of "addRel"
        sync.remRel.forEach((r, uid) => { delete sync.addRel[uid]; });
        
        // Don't update Records being added
        sync.addRec.forEach((r, uid) => { delete sync.updRec[uid]; });
        
        // 2) Construct the Tell based on our delta:
        
        let content = sync.map(v => v.isEmpty() ? C.skip : v);
        this.sync = sync.map(v => ({}));
        
        // TODO: Actual value calculations should be performed as late as possible?
        // Or should `genUpdateTell` just be called as late as possible?
        if (content.has('addRec')) content.addRec = content.addRec.map(rec => ({
          uid: rec.uid,
          type: rec.constructor.name,
          value: rec.getValue()
        }));
        
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
            if (this.isShut()) return;
            
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
        let findWay = this.relVal(rel.waysHuts.bak).find(() => true);
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
        
        // TODO: Should be in Lands (e.g. a single Hut connected by 2 Ways)
        this.connections = {};
      },
      
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(absConn => {
          
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
          // TODO: The same machine connecting through multiple Ways will result in
          // multiple Hut instances
          let hut = Hut({ lands: this.lands, address });
          this.connections[address] = { absConn, hut };
          
          // AbstractConnection and Hut open and shut together
          let holdConnShut = absConn.shutWob().hold(() => {
            holdHutShut.shut();
            delete this.connections[address];
            hut.shut();
          });
          let holdHutShut = hut.shutWob().hold(() => {
            holdConnShut.shut();
            delete this.connections[address];
            absConn.shut();
          });
          
          // Pass anything heard on to our Lands
          absConn.hear.hold(([ msg, reply=null ]) => {
            this.lands.hear(hut, msg, reply);
            
            /// {ABOVE=
            hut.refreshExpiry(); // Any amount of communication refreshes expiry
            /// =ABOVE}
          });
          
          // Attach the Hut to the Way and to the Lands
          U.AggWobs().complete(agg => {
            this.attach(rel.waysHuts.fwd, hut);
            this.lands.attach(rel.landsHuts.fwd, hut);
          });
          
        });
      },
      shut: async function() { return C.notImplemented.call(this) },
      
      tellHut: function(hut, msg) {
        if (!this.connections.has(hut.address)) throw new Error(`Tried to tell disconnected hut: ${hut.getTerm()}`);
        this.connections[hut.address].absConn.tell(msg);
      }
    })});
    
    let rel = {
      landsHuts: Relation(Lands, Hut, '1M'),
      waysHuts: Relation(Way, Hut, 'MM')
    };
    
    let content = { Lands, LandsRecord, Hut, Way, rel };
    
    /// {TEST=
    content.test = rootKeep => rootKeep.contain(k => U.Keep(k, 'hinterlands').contain(k => {
      
      U.Keep(k, 'lands1', () => {
        
        let lands = Lands({ foundation });
        return { result: lands.nextUid().length === 8 };
        
      });
      
      U.Keep(k, 'lands2', () => {
        
        let lands = Lands({ foundation });
        
        try {
          lands.comWob('unspecified');
        } catch(err) {
          return { result: true };
        }
        
        return { result: false };
        
      });
      
      U.Keep(k, 'server').contain(k => {
        
        let makeServer = () => {
          let server = U.Wob();
          server.spoofClient = () => {
            let isShut = false;
            let shutWob = U.WobOne();
            
            let client = {
              address: (addrCnt++).toString(36).padHead(8, '0'),
              hear: U.Wob(),
              tell: () => {},
              shut: () => {
                if (isShut) throw new Error('Already shut');
                isShut = true;
                shutWob.wobble();
              },
              shutWob: () => shutWob
            };
            
            server.wobble(client);
            return client;
          };
          return server;
        };
        
        let addrCnt = 0;
        let server = null;
        let clients = new Set();
        k.sandwich.before = () => {
          server = makeServer();
        };
        k.sandwich.after = () => {
          clients.forEach(c => c.shut());
          clients = new Set();
          server = null;
          addrCnt = 0;
        };
        
        U.Keep(k, 'client1', async () => {
          
          let lands = Lands({ foundation, commands: { test: 1 }, heartbeatMs: null });
          
          let way = Way({ lands, makeServer: () => server });
          lands.ways.add(way);
          await lands.open();
          
          let complete = false;
          lands.comWob('test').hold(({ lands, hut, msg }) => { complete = true; });
          
          let client = server.spoofClient();
          client.hear.wobble([ { command: 'test' }, null ]);
          
          return { result: complete };
          
        });
        
        U.Keep(k, 'client2', async () => {
          
          let lands = Lands({ foundation, commands: { test: 1 }, heartbeatMs: null });
          
          let way = Way({ lands, makeServer: () => server });
          lands.ways.add(way);
          await lands.open();
          
          let mostRecentConn = null;
          let mostRecentHear = null;
          
          lands.relWob(rel.landsHuts.fwd).hold(({ rec }) => { mostRecentConn = rec; });
          lands.comWob('test').hold(({ hut }) => { mostRecentHear = hut; });
          
          for (let i = 0; i < 10; i++) {
            
            let client = server.spoofClient();
            client.hear.wobble([ { command: 'test' }, null ]);
            
            if (!mostRecentHear || mostRecentHear !== mostRecentConn) return { result: false };
            
            mostRecentHear = null;
            
          }
          
          return { result: true };
          
        });
        
        U.Keep(k, 'hutShutCauseConnShut', async () => {
          
          let lands = Lands({ foundation, commands: { test: 1 }, heartbeatMs: null });
          
          let way = Way({ lands, makeServer: () => server });
          lands.ways.add(way);
          await lands.open();
          
          let correct = false;
          
          let hut = null;
          lands.relWob(rel.landsHuts.fwd).hold(({ rec }) => { hut = rec; });
          
          let client = server.spoofClient();
          client.shutWob().hold(() => { correct = true; });
          
          hut.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'connShutCauseHutShut', async () => {
          
          let lands = Lands({ foundation, commands: { test: 1 }, heartbeatMs: null });
          
          let way = Way({ lands, makeServer: () => server });
          lands.ways.add(way);
          await lands.open();
          
          let correct = false;
          
          let hut = null;
          
          let client = server.spoofClient();
          lands.relWob(rel.landsHuts.fwd).hold(({ rec: hut }) => {
            hut.shutWob().hold(() => { correct = true; });
          });
          client.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'sync').contain(k => {
          
          let getStuff = async () => {
            
            let Rec1 = U.inspire({ name: 'Rec1', insps: { LandsRecord } });
            let Rec2 = U.inspire({ name: 'Rec2', insps: { LandsRecord } });
            let rel = {
              landsRec1Set: Relation(Lands, Rec1, '1M'),
              rec1Rec2Set: Relation(Rec1, Rec2, '1M')
            };
            
            let lands = Lands({
              foundation,
              commands: { test: 1 },
              heartbeatMs: null,
              records: [ Rec1, Rec2 ],
              relations: [ rel.rec1Rec2Set ]
            });
            lands.ways.add(Way({ lands, makeServer: () => server }));
            await lands.open();
            
            let client = server.spoofClient();
            
            return {
              Rec1, Rec2, rel, lands, client,
              getReply: msg => {
                let v = null;
                let prm = new Promise(r => { client.tell = r; });
                client.hear.wobble([ msg, client.tell ]);
                return prm;
              },
              getNextResp: () => new Promise(r => { client.tell = r; })
            };
            
          };
          
          U.Keep(k, 'getInit1', async () => {
            
            let { client, getReply } = await getStuff();
            let resp = await getReply({ command: 'getInit' });
            return { result: resp.hasHead('<!DOCTYPE html>') };
            
          });
          
          U.Keep(k, 'getInit2', async () => {
            
            let { client, getReply } = await getStuff();
            let resp = await getReply({ command: 'getInit' });
            return { result: resp.has('window.global = window;') };
            
          });
          
          U.Keep(k, 'syncRec1', async () => {
            
            let { lands, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
              }));
            });
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return { result: initData === null };
            
          });
          
          U.Keep(k, 'syncRec2', async () => {
            
            let { lands, Rec1, Rec2, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
              }));
            });
            
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, Rec1({ lands, value: 'test' }));
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 1
                && initData.content.addRec.find(v => 1)[0].value === 'test'
            };
            
          });
          
          U.Keep(k, 'syncRel1', async () => {
            
            // Sync the most basic possible Relation
            
            let { lands, Rec1, Rec2, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 2
                //&& initData.content.addRec.find(v => 1)[0].value === 'test'
                && initData.content.has('addRel')
                && initData.content.addRel.toArr(v => v).length === 1
            };
            
          });
          
          U.Keep(k, 'syncRelUponFullFollow', async () => {
            
            // Sync a relation that was initially only partially followed
            
            let { lands, Rec1, Rec2, rel: appRel, getReply, client } = await getStuff();
            
            let alreadySetDoFollowRec2 = false;
            let doFollowRec2 = () => { throw new Error('incorrect'); };
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  if (alreadySetDoFollowRec2) throw new Error('Multiple sets');
                  alreadySetDoFollowRec2 = true;
                  doFollowRec2 = () => dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            let prm = new Promise(r => { client.tell = r; });
            doFollowRec2();
            let timeout = setTimeout(() => client.tell(null), 20);
            let relResp = await prm;
            clearTimeout(timeout);
              
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.has('content')
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 1
                && !initData.content.has('addRel')
                && U.isType(relResp, Object)
                && relResp.command === 'update'
                && relResp.version === 2
                && relResp.has('content')
                && U.isType(relResp.content, Object)
                && relResp.content.has('addRec')
                && U.isType(relResp.content.addRec, Object)
                && relResp.content.addRec.toArr(v => v).length === 1
                && relResp.content.addRec.find(v => 1)[1] !== initData.content.addRec.find(v => 1)[1]
                && relResp.content.addRec.find(v => 1)[0].uid !== initData.content.addRec.find(v => 1)[0].uid
            };
            
          });
          
          U.Keep(k, 'noTellPartiallyFollowedRelation1', async () => {
            
            // A Relation should not be synced if the tail isn't followed
            
            let { lands, Rec1, Rec2, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 1
                && !initData.content.has('addRel')
            };
            
          });
          
          U.Keep(k, 'noTellPartiallyFollowedRelation2', async () => {
            
            // A Relation should not be synced if the head isn't followed
            
            let { lands, Rec1, Rec2, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep(hut.followRec(rec2));
                });
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 1
                && initData.content.addRec.find(v => 1)[1] === rec2.uid
                && !initData.content.has('addRel')
            };
            
          });
          
          U.Keep(k, 'noTellPartiallyFollowedRelation3', async () => {
            
            // 1) Follow a Head, causing the Tail to become awaited
            // 2) Forget the Head and follow the Tail
            // 3) Ensure that the relation is not synced
            
            let { lands, Rec1, Rec2, rel: appRel, getReply, client } = await getStuff();
            
            let forgetHead = null;
            let followTail = null;
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                
                // Follow the head, allow us to unfollow later
                dep(hut.followRec(rec1));
                forgetHead = () => hut.setRecFollowStrength(rec1, 0);
                
                AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  // Don't follow the Tail, but allow us to follow it later
                  followTail = () => dep(hut.followRec(rec2));
                });
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            let failedEarly = false
              || initData.content.addRec.toArr(v => v).length !== 1
              || initData.content.has('addRel');
            if (failedEarly) return { result: false };
            
            let prm = new Promise(r => { client.tell = r; });
            forgetHead();
            followTail();
            let timeout = setTimeout(() => client.tell(null), 20);
            let relResp = await prm;
            clearTimeout(timeout);
            
            return {
              result: true
                && U.isType(relResp, Object)
                && relResp.has('command')
                && relResp.command === 'update'
                && relResp.has('content')
                && U.isType(relResp.content, Object)
                && relResp.content.has('addRec')
                && U.isType(relResp.content.addRec, Object)
                && relResp.content.addRec.toArr(v => v).length === 1
                && relResp.content.addRec.find(v => 1)[0].uid === rec2.uid
                && relResp.content.has('remRec')
                && U.isType(relResp.content.remRec, Object)
                && relResp.content.remRec.toArr(v => v).length === 1
                && relResp.content.remRec.find(v => 1)[1] === rec1.uid
            };
            
          });
          
          U.Keep(k, 'noTellPartiallyFollowedRelation4', async () => {
            
            // 1) Follow a Head, causing the Tail to become awaited
            // 2) Forget the Tail and follow the Head (opposite order from previous Keep)
            // 3) Ensure that the relation is not synced
            
            let { lands, Rec1, Rec2, rel: appRel, getReply, client } = await getStuff();
            
            let forgetHead = null;
            let followTail = null;
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                
                // Follow the head, allow us to unfollow later
                dep(hut.followRec(rec1));
                forgetHead = () => hut.setRecFollowStrength(rec1, 0);
                
                AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  // Don't follow the Tail, but allow us to follow it later
                  followTail = () => dep(hut.followRec(rec2));
                });
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            let failedEarly = false
              || initData.content.addRec.toArr(v => v).length !== 1
              || initData.content.has('addRel');
            if (failedEarly) return { result: false };
            
            let prm = new Promise(r => { client.tell = r; });
            followTail();
            forgetHead();
            let timeout = setTimeout(() => client.tell(null), 20);
            let relResp = await prm;
            clearTimeout(timeout);
            
            return {
              result: true
                && U.isType(relResp, Object)
                && relResp.has('command')
                && relResp.command === 'update'
                && relResp.has('content')
                && U.isType(relResp.content, Object)
                && relResp.content.has('addRec')
                && U.isType(relResp.content.addRec, Object)
                && relResp.content.addRec.toArr(v => v).length === 1
                && relResp.content.addRec.find(v => 1)[0].uid === rec2.uid
                && relResp.content.has('remRec')
                && U.isType(relResp.content.remRec, Object)
                && relResp.content.remRec.toArr(v => v).length === 1
                && relResp.content.remRec.find(v => 1)[1] === rec1.uid
            };
            
          });
          
          U.Keep(k, 'unfollowAndRemRecUponShut', async () => {
            
            // Follow and sync a Record; then shut the Record and test that
            // the follow and sync were undone
            
            let { lands, Rec1, Rec2, rel: appRel, getReply, client } = await getStuff();
            
            let doFollowRec2 = null;
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  doFollowRec2 = () => dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            rec1.shut();
            
            let resp = await prm;
            clearTimeout(timeout);
            
            return {
              result: true
                && U.isType(resp, Object)
                && resp.has('command')
                && resp.command === 'update'
                && resp.has('content')
                && U.isType(resp.content, Object)
                && resp.content.has('remRec')
                && U.isType(resp.content.remRec, Object)
                && resp.content.remRec.toArr(m => m).length === 1
                && resp.content.remRec.find(v => 1)[1] === rec1.uid
                && !lands.relWob(rel.landsHuts.fwd).hogs.find(({ rec }) => rec.getFollowStrength(rec1) > 0)
            };
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
