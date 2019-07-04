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
        if (lands.allRecs.has(this.uid)) throw new Error(`Duplicate uid: ${this.uid}`);
        lands.allRecs.set(this.uid, this);
        this.shutWob().hold(() => lands.allRecs.delete(this.uid));
        /// =BELOW}
       }
    })});
    let Lands = U.inspire({ name: 'Lands', insps: { Record }, methods: (insp, Insp) => ({
      init: function({ foundation, heartbeatMs=10000, ...more }) {
        insp.Record.init.call(this, { uid: 'root' });
        this.uidCnt = 0;
        this.heartbeatMs = heartbeatMs;
        this.comWobs = {};
        this.ways = new Set();
        
        /// {ABOVE=
        
        let { commands=[] } = more;
        
        this.commands = new Set(commands);
        
        /// =ABOVE} {BELOW=
        
        let { records=[], relations=[] } = more;
        
        this.records = new Map();
        for (let rec of records) this.records.set(rec.name, rec);
        
        this.relations = new Map();
        for (let rel of relations) this.relations.set(rel.uid, rel);
        
        // Some values to control transmission
        this.allRecs = new Map();
        this.version = 0;
        this.heartbeatTimeout = null;
        this.resetHeartbeatTimeout(); // Begin heartbeat
        
        /// =BELOW}
        
        // Add required commands to Lands
        
        let requiredCommand = (name, effect) => {
          /// {ABOVE=
          this.commands.add(name);
          /// =ABOVE}
          this.comWob(name).hold(effect);
        };
        requiredCommand('error', async ({ hut, msg, reply }) => { /* nothing */ });
        requiredCommand('fizzle', async ({ hut, msg, reply }) => { /* nothing */ });
        
        /// {ABOVE=
        
        requiredCommand('getInit', async ({ absConn, hut, msg, reply }) => {
          // Reset the hut to reflect a blank Below; then send update data
          hut.resetVersion();
          let update = hut.genUpdateTell();
          let initBelow = await foundation.genInitBelow('text/html', absConn, hut.getTerm(), [], update);
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
              
              let Cls = lands.records.get(type);
              agg.addWob(Cls({ uid, lands })).wobble(value);
            });
            updRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Upd missing uid: ${uid}`);
              agg.addWob(recs.get(uid)).wobble(v);
            });
            remRec.forEach((v, uid) => {
              if (!recs.has(uid)) throw new Error(`Rem missing uid: ${uid}`);
              let rec = recs.get(uid);
              agg.addWob(rec.shutWob());
              rec.shut();
            });
            addRel.forEach(([ relUid, headUid, tailUid, dbg ]) => {
              
              if (!lands.relations.has(relUid)) throw new Error(`Add relation missing uid: ${relUid}`);
              
              if (!recs.has(headUid)) throw new Error(`Can't find a relation target for attach; uid: ${headUid}`);
              if (!recs.has(tailUid)) throw new Error(`Can't find a relation target for attach; uid: ${tailUid}`);
              
              let rel = lands.relations.get(relUid);
              let [ head, tail ] = [ recs.get(headUid), recs.get(tailUid) ];
              try {
                agg.addWob(head.relWob(rel.fwd));
                agg.addWob(tail.relWob(rel.bak));
                head.attach(rel.fwd, tail, agg);
              } catch(err) { err.message = `Couldn't attach: ${err.message}`; throw err; }
              
            });
            remRel.forEach(([ relUid, headUid, tailUid ]) => {
              if (!lands.relations.has(relUid)) throw new Error(`Rem relation missing uid: ${relUid}`);
              
              if (!recs.has(headUid)) throw new Error(`Can't find a relation target for detach; uid: ${headUid}`);
              if (!recs.has(tailUid)) throw new Error(`Can't find a relation target for detach; uid: ${tailUid}`);
              
              let rel = lands.relations.get(relUid);
              let [ head, tail ] = [ recs.get(headUid), recs.get(tailUid) ];
              let relRec = head.getRelRec(rel.fwd, tail.uid);
              
              if (!relRec) throw new Error(`Couldn't find related rec. rel: ${relUid}, head: ${headUid}, tail: ${tailUid}`);
              try {
                // TODO: Have to think about aggregating the shuts along with all the other
                // changes. At the moment, it results in `shut` being called multiple times
                // on the same Hogs.
                //agg.addWob(relRec.shutWob());
                relRec.shut();
              } catch(err) { err.message = `Couldn't detach: ${err.message}`; throw err; }
              
            });
            
            agg.complete();
            
          } catch(err) {
            err.message = `ABOVE CAUSED: ${err.message}`;
            console.error(err.message);
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
        let huts = this.relWob(rel.landsHuts.fwd).toArr();
        for (let i = 0; i < 100; i++) { // TODO: This can't last. `100` is arbitrary!
          let ret = TERMS[Math.floor(Math.random() * TERMS.length)];
          if (!huts.find(hut => hut.term === ret)) return ret;
        }
        throw new Error('Too many huts! Not enough terms!! AHHHH!!!');
      },
      
      comWob: function(command) {
        if (!this.comWobs.has(command)) {
          /// {ABOVE=
          if (!this.commands.has(command)) throw new Error(`Invalid command: "${command}"`);
          /// =ABOVE}
          this.comWobs[command] = U.Wob({});
        }
        return this.comWobs[command];
      },
      hear: async function(absConn, hut, msg, reply=null) {
        
        let { command } = msg;
        
        /// {ABOVE=
        if (!this.commands.has(command)) {
          return hut.tell({ command: 'error', type: 'notRecognized', orig: msg });
        }
        /// =ABOVE}
        
        this.comWob(command).wobble({ lands: this, absConn, hut, msg, reply });
        hut.comWob(command).wobble({ lands: this, absConn, hut, msg, reply });
      },
      tell: async function(msg) {
        /// {BELOW=
        this.resetHeartbeatTimeout(); // Only need to send heartbeats when we haven't sent anything for a while
        /// =BELOW}
        this.relWob(rel.landsHuts.fwd).forEach(relHut => relHut.rec.tell(msg));
      },
      
      /// {BELOW=
      getInitRec: async function(Cls) {
        await new Promise(r => setTimeout(r, 0));
        for (let [ k, rec ] of this.allRecs) if (rec.isInspiredBy(Cls)) { return rec; }
        return null;
      },
      resetHeartbeatTimeout: function() {
        if (!this.heartbeatMs) return;
        
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker - wait less millis than `this.heartbeatMs`
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), Math.min(this.heartbeatMs * 0.8, this.heartbeatMs - 2000));
      },
      /// =BELOW}
      
      // TODO: async functions shouldn't be named "open" and "shut"
      addWay: function(way) {
        this.ways.add(way)
      },
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'remote' ]; // Below has only 1 Hut, so only 1 name needed
        /// =BELOW}
        
        await Promise.all([ ...this.ways ].map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let relHut = this.relWob(rel.landsHuts.fwd).toArr().find(() => true)[0];
        await this.hear(null, relHut.rec, U.initData); // Lands Below immediately hear the Above's initial update
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
          /// {ABOVE=
          if (!this.lands.commands.has(command)) throw new Error(`Invalid command: "${command}"`);
          /// =ABOVE}
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
            dep(Hog(() => this.toSync('remRec', rec.uid, 1)));
            
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
                // The uid IMPLICITLY specifies `exampleRelation.fwd`
                let uidArr = [ relF.rel.uid, head.uid, tail.uid ];
                let uidStr = uidArr.join('/');
                
                this.toSync('addRel', uidStr, uidArr.concat([ relF.name ]));
                dep(Hog( () => this.toSync('remRel', uidStr, uidArr.concat([ relF.rel.fwd.name ])) ));
                
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
        
        console.log(`${this.getTerm()}: reset version`);
        
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
              if (this.getRecFollowStrength(rec2) <= 0) return;
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
          value: rec.value
        }));
        
        if (content.isEmpty()) return null;
        
        this.version++;
        return { command: 'update', version: this.version, content }
      },
      requestInformBelow: function() {
        
        // Implements inform-below-throttling. Schedules a new request to inform
        // our Below if there is not already a request to do so.
        
        if (this.informThrottlePrm) return;
        
        this.informThrottlePrm = (async () => {
          await new Promise(r => process.nextTick(r)); // TODO: This could be swapped out (to a timeout, or whatever!)
          
          this.informThrottlePrm = null;
          
          // It's possible that in between scheduling and performing the tick,
          // this Hut has become isolated. In this case no update should occur
          if (this.isShut()) return;
          
          let updateTell = this.genUpdateTell();
          if (updateTell) this.tell(updateTell);
          return updateTell;
        })();
        
      },
      /// =ABOVE}
      
      favouredWay: function() {
        let findRelWay = this.relWob(rel.waysHuts.bak).toArr().find(() => true);
        return findRelWay ? findRelWay[0].rec : null;
      },
      tell: function(msg) {
        
        console.log(`${this.getTerm()}: TELL:`, JSON.stringify(msg, null, 2));
        
        let way = this.favouredWay();
        if (!way) throw new Error(`Hut ${this.address} has no Ways`);
        way.tellHut(this, msg);
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
            this.lands.hear(absConn, hut, msg, reply);
            
            /// {ABOVE=
            hut.refreshExpiry(); // Any amount of communication refreshes expiry
            /// =ABOVE}
          });
          
          // Attach the Hut to the Way and to the Lands
          U.AggWobs().complete(agg => {
            this.attach(rel.waysHuts.fwd, hut, agg);
            this.lands.attach(rel.landsHuts.fwd, hut, agg);
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
        return [
          [ 'Lands makes 8-char uid',   () => lands.nextUid().length === 8 ]
        ];
        
      });
      
      U.Keep(k, 'lands2', () => {
        
        // TODO: Consider allowing unspecified "comWob" calls. Below should never
        // be able to put unsanitized param into `lands.comWob(...)`
        let lands = Lands({ foundation });
        
        try {
          lands.comWob('unspecified');
        } catch(err) {
          return { result: true };
        }
        
        return { result: false, msg: 'Unspecified commands throw errors' };
        
      });
      
      U.Keep(k, 'server').contain(k => {
        
        let makeServer = () => {
          let server = U.Wob();
          server.spoofClient = () => {
            
            let client = Hog();
            client.address = (addrCnt++).toString(36).padHead(8, '0');
            client.hear = U.Wob();
            client.tell = () => {};
            
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
          
          let lands = Lands({ foundation, commands: [ 'test' ], heartbeatMs: null });
          
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
          
          let lands = Lands({ foundation, commands: [ 'test' ], heartbeatMs: null });
          
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
          
          let lands = Lands({ foundation, commands: [ 'test' ], heartbeatMs: null });
          
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
          
          let lands = Lands({ foundation, commands: [ 'test' ], heartbeatMs: null });
          
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
            let appRel = {
              landsRec1Set: Relation(Lands, Rec1, '1M'),
              rec1Rec2Set: Relation(Rec1, Rec2, '1M')
            };
            
            let lands = Lands({ foundation, commands: [ 'test' ], heartbeatMs: null });
            lands.ways.add(Way({ lands, makeServer: () => server }));
            await lands.open();
            
            let client = server.spoofClient();
            
            return {
              Rec1, Rec2, appRel, lands, client,
              getReply: msg => {
                let v = null;
                let prm = new Promise(r => { client.tell = r; });
                client.hear.wobble([ msg, client.tell ]);
                return prm;
              },
              getNextResp: () => new Promise(r => { client.tell = r; }),
              getHut: () => new Promise(r => lands.relWob(rel.landsHuts.fwd).hold(({ rec }) => r(rec)))
            };
            
          };
          
          U.Keep(k, 'getInit', async () => {
            
            let { client, getReply } = await getStuff();
            let resp = await getReply({ command: 'getInit' });
            
            return [
              [ 'result begins with DOCTYPE',   () => resp.hasHead('<!DOCTYPE html>') ],
              [ 'result sets `window.global`',  () => resp.has('window.global' + ' = ' + 'window;') ]
            ];
            
          });
          
          U.Keep(k, 'syncRec1', async () => {
            
            let { lands, appRel, getReply } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
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
            
            return [
              [ 'sync is Object',             () => U.isType(initData, Object) ],
              [ 'sync version is 1',          () => initData.version === 1 ],
              [ 'sync command is "update"',   () => initData.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(initData.content, Object) ],
              [ 'sync addRec is Object',      () => U.isType(initData.content.addRec, Object) ],
              [ 'sync adds single rec',       () => initData.content.addRec.toArr(v => v).length === 1 ],
              [ 'sync adds no relations',     () => !initData.content.has('addRel') ],
              [ 'sync2 is Object',            () => U.isType(relResp, Object) ],
              [ 'sync2 is version 2',         () => relResp.version === 2 ],
              [ 'sync2 command is "update"',  () => relResp.command === 'update' ],
              [ 'sync2 content is Object',    () => U.isType(relResp.content, Object) ],
              [ 'sync2 addRec is Object',     () => U.isType(relResp.content.addRec, Object) ],
              [ 'sync2 adds single rec',      () => relResp.content.addRec.toArr(v => v).length === 1 ],
              [ 'sync2 adds unique rec',      () => relResp.content.addRec.find(v => 1)[1] !== initData.content.addRec.find(v => 1)[1] ]
            ];
            
          });
          
          U.Keep(k, 'noTellPartiallyFollowedRelation1', async () => {
            
            // A Relation should not be synced if the tail isn't followed
            
            let { lands, Rec1, Rec2, appRel, getReply } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
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
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
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
                && !lands.relWob(rel.landsHuts.fwd).hogs.find(({ rec }) => rec.getRecFollowStrength(rec1) > 0)
            };
            
          });
          
          U.Keep(k, 'noFollowRelOnlyHead', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  //dep(hut.followRec(rec2)); // Don't follow tail!
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRec2 = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return [
              [ 'sync is Object',             () => U.isType(initData, Object) ],
              [ 'sync version is 1',          () => initData.version === 1 ],
              [ 'sync command is "update"',   () => initData.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(initData.content, Object) ],
              [ 'sync adds no relations',     () => !initData.content.has('addRel') ]
            ];
            
          });
          
          U.Keep(k, 'noFollowRelOnlyTail', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                //dep(hut.followRec(rec1)); // Don't follow head!
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRec2 = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            return [
              [ 'sync is Object',             () => U.isType(initData, Object) ],
              [ 'sync version is 1',          () => initData.version === 1 ],
              [ 'sync command is "update"',   () => initData.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(initData.content, Object) ],
              [ 'sync adds no relations',     () => !initData.content.has('addRel') ]
            ];
            
          });
          
          U.Keep(k, 'removeRel', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
            // Note that the root `dep0` is used to track Record follows
            // We want a situation where the 2 Records persist after their
            // Relation ends. We're looking for only the Relation, not the
            // Records, to be removed Below
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep0, { rec: hut }) => {
              dep0(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep0(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep0(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRec2 = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            attachRec2.shut();
            let sync2 = await prm;
            clearTimeout(timeout);
            
            return [
              [ 'sync is Object',             () => U.isType(sync1, Object) ],
              [ 'sync version is 1',          () => sync1.version === 1 ],
              [ 'sync command is "update"',   () => sync1.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync1.content, Object) ],
              [ 'sync "addRel" is Object',    () => U.isType(sync1.content.addRel, Object) ],
              [ 'sync adds single relation',  () => sync1.content.addRel.toArr(v => v).length === 1 ],
              [ 'sync2 is Object',            () => U.isType(sync2, Object) ],
              [ 'sync2 version is 2',         () => sync2.version === 2 ],
              [ 'sync2 command is "update"',  () => sync2.command === 'update' ],
              [ 'sync2 content is Object',    () => U.isType(sync2.content, Object) ],
              [ 'sync2 has no "remRec"',      () => !sync2.content.has('remRec') ],
              [ 'sync2 "remRel" is Object',   () => U.isType(sync2.content.remRel, Object) ],
              [ 'sync2 rems single relation', () => sync2.content.remRel.toArr(v => v).length === 1 ]
            ];
            
          });
          
          U.Keep(k, 'removeHead', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
            // Note that the root `dep0` is used to track Record follows
            // We want a situation where the 2 Records persist after their
            // Relation ends. We're looking for only the Relation, not the
            // Records, to be removed Below
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep0, { rec: hut }) => {
              dep0(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep0(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep0(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRec2 = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            rec1.shut();
            let sync2 = await prm;
            clearTimeout(timeout);
            
            return [
              [ 'sync is Object',             () => U.isType(sync1, Object) ],
              [ 'sync version is 1',          () => sync1.version === 1 ],
              [ 'sync command is "update"',   () => sync1.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync1.content, Object) ],
              [ 'sync "addRel" is Object',    () => U.isType(sync1.content.addRel, Object) ],
              [ 'sync adds single relation',  () => sync1.content.addRel.toArr(v => v).length === 1 ],
              [ 'sync2 is Object',            () => U.isType(sync2, Object) ],
              [ 'sync2 version is 2',         () => sync2.version === 2 ],
              [ 'sync2 command is "update"',  () => sync2.command === 'update' ],
              [ 'sync2 content is Object',    () => U.isType(sync2.content, Object) ],
              
              // Note it's unecessary to explicitly tell Below that the Relation is removed.
              // Of course if the Record is removed, so are all its Relations!
              [ 'sync2 has no "remRel"',      () => !sync2.content.has('remRel') ],
              [ 'sync2 "remRec" is Object',   () => U.isType(sync2.content.remRec, Object) ],
              [ 'sync2 rems single record',   () => sync2.content.remRec.toArr(v => v).length === 1 ],
              [ 'sync2 rems rec1',            () => sync2.content.remRec.find(v => 1)[1] === rec1.uid ]
            ];
            
          });
          
          U.Keep(k, 'removeTail', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client } = await getStuff();
            
            // Note that the root `dep0` is used to track Record follows
            // We want a situation where the 2 Records persist after their
            // Relation ends. We're looking for only the Relation, not the
            // Records, to be removed Below
            AccessPath(lands.relWob(rel.landsHuts.fwd), (dep0, { rec: hut }) => {
              dep0(AccessPath(lands.relWob(appRel.landsRec1Set.fwd), (dep, { rec: rec1 }) => {
                dep0(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set.fwd), (dep, { rec: rec2 }) => {
                  dep0(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set.fwd, rec1);
            let attachRec2 = rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            rec2.shut();
            let sync2 = await prm;
            clearTimeout(timeout);
            
            return [
              [ 'sync is Object',             () => U.isType(sync1, Object) ],
              [ 'sync version is 1',          () => sync1.version === 1 ],
              [ 'sync command is "update"',   () => sync1.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync1.content, Object) ],
              [ 'sync "addRel" is Object',    () => U.isType(sync1.content.addRel, Object) ],
              [ 'sync adds single relation',  () => sync1.content.addRel.toArr(v => v).length === 1 ],
              [ 'sync2 is Object',            () => U.isType(sync2, Object) ],
              [ 'sync2 version is 2',         () => sync2.version === 2 ],
              [ 'sync2 command is "update"',  () => sync2.command === 'update' ],
              [ 'sync2 content is Object',    () => U.isType(sync2.content, Object) ],
              [ 'sync2 has no "remRel"',      () => !sync2.content.has('remRel') ],
              [ 'sync2 "remRec" is Object',   () => U.isType(sync2.content.remRec, Object) ],
              [ 'sync2 rems single record',   () => sync2.content.remRec.toArr(v => v).length === 1 ],
              [ 'sync2 rems rec2',            () => sync2.content.remRec.find(v => 1)[1] === rec2.uid ]
            ];
            
          });
          
          U.Keep(k, 'unfollowRefollowHead', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client, getHut } = await getStuff();
            
            let hut = await getHut();
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            hut.setRecFollowStrength(rec1, 100);
            hut.setRecFollowStrength(rec2, 100);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let good1 = true
              && U.isType(sync1, Object)
              && sync1.version === 1
              && sync1.command === 'update'
              && U.isType(sync1.content, Object)
              && U.isType(sync1.content.addRec, Object)
              && sync1.content.addRec.toArr(v => v).length === 2
              && U.isType(sync1.content.addRel, Object)
              && sync1.content.addRel.toArr(v => v).length === 1;
            if (!good1) return { result: false, msg: 'Bad 1st sync' };
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            hut.setRecFollowStrength(rec1, 0);
            let sync2 = await prm;
            clearTimeout(timeout);
            
            let good2 = true
              && U.isType(sync2, Object)
              && sync2.version === 2
              && sync2.command === 'update'
              && U.isType(sync2.content, Object)
              && !sync2.has('remRel')
              && U.isType(sync2.content.remRec, Object)
              && sync2.content.remRec.toArr(v => v).length === 1;
            if (!good2) return { result: false, msg: 'Bad 2nd sync' };
            
            prm = new Promise(r => { client.tell = r; });
            timeout = setTimeout(() => client.tell(null), 20);
            hut.setRecFollowStrength(rec1, 100);
            let sync3 = await prm;
            clearTimeout(timeout);
            
            return [
              [ 'sync is Object',             () => U.isType(sync3, Object) ],
              [ 'sync version is 3',          () => sync3.version === 3 ],
              [ 'sync command is "update"',   () => sync3.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync3.content, Object) ],
              [ 'sync "addRec" is Object',    () => U.isType(sync3.content.addRec, Object) ],
              [ 'sync adds single record',    () => sync3.content.addRec.toArr(v => v).length === 1 ],
              [ 'sync adds rec1',             () => sync3.content.addRec.find(v => 1)[1] === rec1.uid ],
              [ 'sync "addRel" is Object',    () => U.isType(sync3.content.addRel, Object) ],
              [ 'sync adds single relation',  () => sync3.content.addRel.toArr(v => v).length === 1]
            ];
            
          });
          
          U.Keep(k, 'unfollowRefollowTail', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client, getHut } = await getStuff();
            
            let hut = await getHut();
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            hut.setRecFollowStrength(rec1, 100);
            hut.setRecFollowStrength(rec2, 100);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let good1 = true
              && U.isType(sync1, Object)
              && sync1.version === 1
              && sync1.command === 'update'
              && U.isType(sync1.content, Object)
              && U.isType(sync1.content.addRec, Object)
              && sync1.content.addRec.toArr(v => v).length === 2
              && U.isType(sync1.content.addRel, Object)
              && sync1.content.addRel.toArr(v => v).length === 1;
            if (false && !good1) return { result: false, msg: 'Bad 1st sync' };
            
            let prm = new Promise(r => { client.tell = r; });
            let timeout = setTimeout(() => client.tell(null), 20);
            hut.setRecFollowStrength(rec2, 0);
            let sync2 = await prm;
            clearTimeout(timeout);
            
            let good2 = true
              && U.isType(sync2, Object)
              && sync2.version === 2
              && sync2.command === 'update'
              && U.isType(sync2.content, Object)
              && !sync2.has('remRel')
              && U.isType(sync2.content.remRec, Object)
              && sync2.content.remRec.toArr(v => v).length === 1;
            if (!good2) return { result: false, msg: 'Bad 2nd sync' };
            
            prm = new Promise(r => { client.tell = r; });
            timeout = setTimeout(() => client.tell(null), 20);
            hut.setRecFollowStrength(rec2, 100);
            let sync3 = await prm;
            clearTimeout(timeout);
            
            return [
              [ 'sync is Object',             () => U.isType(sync3, Object) ],
              [ 'sync version is 3',          () => sync3.version === 3 ],
              [ 'sync command is "update"',   () => sync3.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync3.content, Object) ],
              [ 'sync "addRec" is Object',    () => U.isType(sync3.content.addRec, Object) ],
              [ 'sync adds single record',    () => sync3.content.addRec.toArr(v => v).length === 1 ],
              [ 'sync adds rec2',             () => sync3.content.addRec.find(v => 1)[1] === rec2.uid ],
              [ 'sync "addRel" is Object',    () => U.isType(sync3.content.addRel, Object) ],
              [ 'sync adds single relation',  () => sync3.content.addRel.toArr(v => v).length === 1]
            ];
            
          });
          
          U.Keep(k, 'resetVersion', async () => {
            
            let { lands, Rec1, Rec2, appRel, getReply, client, getHut } = await getStuff();
            
            let hut = await getHut();
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            
            hut.setRecFollowStrength(rec1, 100);
            hut.setRecFollowStrength(rec2, 100);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync1 = JSON.parse(initDataMatch[1]);
            
            let good1 = true
              && U.isType(sync1, Object)
              && sync1.version === 1
              && sync1.command === 'update'
              && U.isType(sync1.content, Object)
              && U.isType(sync1.content.addRec, Object)
              && sync1.content.addRec.toArr(v => v).length === 2
              && !sync1.content.has('addRel');
            if (false && !good1) return { result: false, msg: 'Bad 1st sync' };
            
            rec1.attach(appRel.rec1Rec2Set.fwd, rec2);
            
            initResp = await getReply({ command: 'getInit' });
            endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let sync2 = JSON.parse(initDataMatch[1]);
            
            return [
              [ 'sync is Object',             () => U.isType(sync2, Object) ],
              [ 'sync version is 1',          () => sync2.version === 1 ],
              [ 'sync command is "update"',   () => sync2.command === 'update' ],
              [ 'sync content is Object',     () => U.isType(sync2.content, Object) ],
              [ 'sync addRec is Object',      () => U.isType(sync2.content.addRec, Object) ],
              [ 'sync adds 2 recs',           () => sync2.content.addRec.toArr(v => v).length === 2 ],
              [ 'sync addRel is Object',      () => U.isType(sync2.content.addRel, Object) ],
              [ 'sync adds 1 rel',            () => sync2.content.addRel.toArr(v => v).length === 1 ]
            ];
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
