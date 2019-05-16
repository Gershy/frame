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
    let { AccessPath } = U;
    
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
        this.commands = commands;
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
        
        // TODO: Whitelisting command names ahead of time might not be necessary - not likely
        // that user input could wind up as parameter for `(Lands|Hut).prototype.comWob`
        
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
        /// {ABOVE=
        return (this.uidCnt++).toString(36).padHead(8, '0');
        /// =ABOVE} {BELOW=
        // The "~" prefix prevents collision between local/shared Records
        return '~' + (this.uidCnt++).toString(36).padHead(8, '0');
        /// =BELOW}
      },
      genUniqueTerm: function() {
        let huts = this.relVal(rel.landsHuts);
        for (let i = 0; i < 100; i++) {
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
        for (let [ uid, rel ] of this.relations) if (rec.isInspiredBy(rel.head)) ret.push(rel);
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
        TERMS = [ 'remote' ];
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
        this.version = 0;
        this.fols = new Map();
        this.awaitedTails = new Map(); // Tails in a relation whose Head is followed
        this.sync = {
          addRec: {},
          remRec: {},
          updRec: {},
          addRel: {},
          remRel: {}
        };
        
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
      
      getRecFollowStrength: function(rec) {
        return (this.fols.get(rec) || { strength: 0 }).strength;
      },
      setRecFollowStrength: function(rec, strength) {
        
        if (strength < 0) throw new Error(`Invalid strength: ${strength}`);
        
        let fol = this.fols.get(rec) || null;
        let strength0 = fol ? fol.strength : 0;
        if (strength === strength0) throw new Error(`Strength is already ${strength}`);
        
        if (!strength0) {                   // ADD
          
          let uid = rec.uid;
          
          let ap = AccessPath(U.WobVal(rec), (dep, rec) => {
            
            this.sync.addRec[`${uid}`] = rec;
            
            dep(rec.hold(val => {
              this.sync.updRec[`${uid}`] = val;
              this.requestInformBelow();
            }));
            
            if (this.awaitedTails.has(rec)) {
              
              // We're already a Tail with followed Heads! Need to immediately sync
              // those relations
              let waitingHeads = this.awaitedTails.get(rec);
              waitingHeads.forEach(([ rel, head, relTail ]) => {
                
                if (relTail.rec !== rec) throw new Error('WHY???');
                
                // TODO: HEEERE! Fixed one test, need to test this better and check memory management
                // E.g. after an awaited tail is added, is it no longer awaited?
                // E.g. does shutting the head/tail unsync the relation?
                // E.g. does unfollowing the head remove the tail from being awaited?
                // ------------------
                
                let relUid = rel.uid;
                let uid = head.uid;
                let uid2 = relTail.rec.uid;
                this.sync.addRel[`${relUid}:${uid}->${uid2}`] = [ relUid, uid, uid2 ];
                this.requestInformBelow();
                
                dep({
                  shut: () => {
                    // Inform of the relation rem
                    this.sync.remRel[`${relUid}:${uid}->${uid2}`] = [ relUid, uid, uid2 ];
                    this.requestInformBelow();
                  },
                  shutWob: () => C.nullWob
                });
                
                // ------------------
                
              });
                
              this.awaitedTails.delete(rec);
              
            }
            
            
            dep(AccessPath(rec.relsWob(), (dep, rel) => {
              
              let relUid = rel.uid;
              
              dep(AccessPath(rec.relWob(rel), (dep, relRec) => {
                
                let rec2 = relRec.rec;
                let uid2 = rec2.uid;
                
                if (this.fols.has(rec2)) {
                  
                  // Immediately send the relation!
                  
                  // Inform of the relation add
                  this.sync.addRel[`${relUid}:${uid}->${uid2}`] = [ relUid, uid, uid2 ];
                  this.requestInformBelow();
                  
                  dep({
                    shut: () => {
                      // Inform of the relation rem
                      this.sync.remRel[`${relUid}:${uid}->${uid2}`] = [ relUid, uid, uid2 ];
                      this.requestInformBelow();
                    },
                    shutWob: () => C.nullWob
                  });
                  
                } else {
                  
                  // Tail isn't followed, so can't reveal the relation yet. Instead,
                  // indicate that should the tail be followed, the relation ought to
                  // be sent.
                  
                  if (!this.awaitedTails.has(rec2)) this.awaitedTails.set(rec2, {});
                  let waitingHeads = this.awaitedTails.get(rec2);
                  waitingHeads[rel.keyFor(rec, rec2)] = [ rel, rec, relRec ];
                  
                  dep({
                    shut: () => {
                      delete waitingHeads[rel.keyFor(rec, rec2)];
                      if (waitingHeads.isEmpty()) this.awaitedTails.delete(rec2);
                    },
                    shutWob: () => C.nullWob
                  });
                  
                }
                
              }));
              
            }));
            
          });
          
          this.fols.set(rec, { strength, ap });
          return;
          
        } else if (strength0 && strength) { // UPD
          
          fol.strength = strength;
          
        } else {                            // REM
          
          // Clean up all follow-related data for the Record
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
        
        let shutWob0 = U.WobOne();
        return {
          shut: () => {
            if (shutWob0.wobbled()) throw new Error('Already shut');
            let str = this.fols.get(rec).strength;
            this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) - 1);
            shutWob0.wobble();
          },
          shutWob: () => shutWob0
        };
        
      },
      
      resetVersion: function() {
        // Clears memory of current delta and generates a new delta which would bring
        // a blank Below up to date. Resets this Hut's version to 0 to reflect the Below
        // is currently blank. Note that this method modifies our memory of the delta
        // **without calling `requestInformBelow`**!! This means that the caller needs
        // to insure the Below is eventually sent the data to bring it up to date.
        
        if (this.version === 0) return;
        
        // Clear current delta...
        this.sync = this.sync.map(v => ({}));
        
        // Rebuild delta based on immediate state
        this.fols.forEach((fol, rec) => {
          
          let uid = rec.uid;
          this.sync.addRec[`${uid}`] = rec;
          
          this.lands.allRelationsFor(rec).forEach(rel => {
            rec.relWob(rel).forEach(({ rec: rec2 }) => {
              this.sync.addRel[`${rel.uid}:${uid}->${rec2.uid}`] = [ rel.uid, uid, rec2.uid, rel.name ];
            });
          });
          
        });
        
        this.version = 0;
      },
      genUpdateTell: function() {
        // Generates a "tell" msg to bring the Below up to date. Has the side-effect
        // of clearing this Hut's memory of the current delta.
        
        // 1) Sanitize our delta:
        
        // Don't affect relations of Records being removed
        // Don't add Records which are removed
        if (!this.sync.remRec.isEmpty()) {
          let r = this.remRec;
          this.sync.addRel = this.sync.addRel.map(v => r.has(v[1]) || r.has(v[2]) ? C.skip : v);
          this.sync.remRel = this.sync.remRel.map(v => r.has(v[1]) || r.has(v[2]) ? C.skip : v);
          this.sync.remRec.forEach((r, uid) => { delete this.sync.addRec[uid]; });
        }
        
        // Don't update Records being added
        this.sync.addRec.forEach((r, uid) => { delete this.sync.updRec[uid]; });
        
        // 2) Construct "tell" based on our delta:
        
        let content = this.sync.map(v => v.isEmpty() ? C.skip : v);
        this.sync = this.sync.map(v => ({}));
        
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
            if (this.isShut) return null;
            
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
        let findWay = this.relVal(rel.waysHuts.bak()).find(() => true);
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
            this.attach(rel.waysHuts.fwd(), hut);
            hut.attach(rel.waysHuts.bak(), this);
            
            this.lands.attach(rel.landsHuts.fwd(), hut);
            hut.attach(rel.landsHuts.bak(), this.lands);
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
          
          lands.relWob(rel.landsHuts).hold(({ rec }) => { mostRecentConn = rec; });
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
          lands.relWob(rel.landsHuts).hold(({ rec }) => { hut = rec; });
          
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
          lands.relWob(rel.landsHuts).hold(({ rec: hut }) => {
            hut.shutWob().hold(() => { correct = true; });
          });
          client.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'communication').contain(k => {
          
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
                // TODO: Finish this then use!
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
            
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
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
            
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
              }));
            });
            
            let attachRec1 = lands.attach(appRel.landsRec1Set, Rec1({ lands, value: 'test' }));
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            console.log(JSON.stringify(initData, null, 2));
            
            // TODO: Next need to sync a relation. Will need all Relations in play to
            // be defined on the Lands so that for a Record, all its Relations can be
            // held.
            
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
            
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set), (dep, { rec: rec2 }) => {
                  dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set, rec2);
            
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
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set), (dep, { rec: rec2 }) => {
                  if (alreadySetDoFollowRec2) throw new Error('Multiple sets');
                  alreadySetDoFollowRec2 = true;
                  doFollowRec2 = () => dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            console.log('SYNCUPONFOLLOW #1:', JSON.stringify(initData, null, 2));
            
            let prm = new Promise(r => { client.tell = r; });
            doFollowRec2();
            
            let timeout = setTimeout(() => client.tell(null), 20);
            
            let relResp = await prm;
            clearTimeout(timeout);
            
            console.log('SYNCUPONFOLLOW #2:', JSON.stringify(relResp, null, 2));
            
            // console.log('CHECK 1', U.isType(initData, Object));
            // console.log('CHECK 2', initData.command === 'update');
            // console.log('CHECK 3', initData.version === 1);
            // console.log('CHECK 4', initData.has('content'));
            // console.log('CHECK 5', initData.content.has('addRec'));
            // console.log('CHECK 6', initData.content.addRec.toArr(v => v).length === 1);
            // console.log('CHECK 7', !initData.content.has('addRel'));
            // console.log('CHECK 8', U.isType(relResp, Object));
            // console.log('CHECK 9', relResp.command === 'update');
            // console.log('CHECK 10', relResp.version === 2);
            // console.log('CHECK 11', relResp.has('content'));
            // console.log('CHECK 12', U.isType(relResp.content, Object));
            // console.log('CHECK 13', relResp.content.has('addRec'));
            // console.log('CHECK 14', U.isType(relResp.content.addRec, Object));
            // console.log('CHECK 15', relResp.content.addRec.toArr(v => v).length === 1);
            // console.log('CHECK 16', relRespcon//relResp.content.addRec.find(v => 1)[1].uid !== initData.content.addRec.find(v => 1)[1].uid);
            
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
          
          U.Keep(k, 'noTellPartiallyFollowedRelation', async () => {
            
            // A Relation should not be synced if the tail isn't followed
            
            let { lands, Rec1, Rec2, rel: appRel, getReply } = await getStuff();
            
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let rec2 = Rec2({ lands, value: 'test2' });
            let attachRec1 = lands.attach(appRel.landsRec1Set, rec1);
            let attachRecs = rec1.attach(appRel.rec1Rec2Set, rec2);
            
            let initResp = await getReply({ command: 'getInit' });
            let endBit = initResp.substr(initResp.indexOf('// ==== File:' + ' hut.js'));
            let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
            if (!initDataMatch) return { result: null };
            let initData = JSON.parse(initDataMatch[1]);
            
            console.log('INITDATA2:', JSON.stringify(initData, null, 2));
            
            return {
              result: true
                && U.isType(initData, Object)
                && initData.command === 'update'
                && initData.version === 1
                && initData.content.has('addRec')
                && initData.content.addRec.toArr(v => v).length === 2
                //&& initData.content.addRec.find(v => 1)[0].value === 'test'
                && !initData.content.has('addRel')
            };
            
          });
          
          U.Keep(k, 'unfollowAndRemRecUponShut', async () => {
            
            // Follow and sync a Record; then shut the Record and test that
            // the follow and sync were undone
            
            let { lands, Rec1, Rec2, rel: appRel, getReply, client } = await getStuff();
            
            let doFollowRec2 = null;
            AccessPath(lands.relWob(rel.landsHuts), (dep, { rec: hut }) => {
              dep(AccessPath(lands.relWob(appRel.landsRec1Set), (dep, { rec: rec1 }) => {
                dep(hut.followRec(rec1));
                dep(AccessPath(rec1.relWob(appRel.rec1Rec2Set), (dep, { rec: rec2 }) => {
                  doFollowRec2 = () => dep(hut.followRec(rec2));
                }));
              }));
            });
            
            let rec1 = Rec1({ lands, value: 'test1' });
            let attachRec1 = lands.attach(appRel.landsRec1Set, rec1);
            
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
                && !lands.relWob(rel.landsHuts).hogs.find(({ rec }) => rec.getFollowStrength(rec1) > 0)
            };
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
