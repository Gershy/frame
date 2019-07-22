U.buildRoom({
  name: 'hinterlands2',
  innerRooms: [ 'record2' ],
  build: (foundation, record2) => {
    // All huts sit together in the lands
    
    // TODO: Make everything work nicely with "arch". It should have fixed uid!
    // TODO: FOLLOWING
    // TODO: Lands, Huts, and Ways are setup wrong. A Hut should be able to
    //  connect through multiple Ways!
    // TODO: Could use a nice big high-level comment explaining why Huts are
    //  Recs, but Lands and Ways are not (although `myLands.gate` is a Rec!)
    // TODO: Need tests!
    
    let { Rec, Rel } = record2;
    let { Hog, WobTmp, WobMemSet, AccessPath } = U;
    
    let TERMS = [];
    
    let LandsRec = U.inspire({ name: 'LandsRec', insps: { Rec }, methods: (insp, Insp) => ({
      init: function({ type, members, lands, uid=lands.nextUid(), value=null }) {
        insp.Rec.init.call(this, { type, uid, members, value });
        
        /// {BELOW=
        if (lands.allRecs.has(this.uid)) throw new Error(`Duplicate uid: ${this.uid}`);
        lands.allRecs.set(this.uid, this);
        this.shutWob().hold(() => lands.allRecs.delete(this.uid));
        /// =BELOW}
       }
    })});
    let Lands = U.inspire({ name: 'Lands', methods: () => ({
      init: function({ foundation, heartbeatMs=10000, ...more }) {
        this.uidCnt = 0;
        this.heartbeatMs = heartbeatMs;
        this.comWobs = {};
        this.ways = Set();
        this.arch = rt.arch.create({ uid: '!arch' });
        
        /// {ABOVE=
        
        let { commands=[] } = more;
        this.commands = Set(commands);
        
        /// =ABOVE} {BELOW=
        
        let { recTypes=[] } = more;
        this.recTypes = new Map();
        recTypes.forEach(rec => this.recTypes.set(rec.name, rec));
        
        // Keep direct references to all Recs for update/removal
        // Opening and shutting LandsRecs will modify `this.allRecs`
        this.allRecs = new Map();
        this.allRecs.set(this.arch.uid, this.arch); // Initially the only Rec we're aware of is our arch
        
        // Some values to control transmission
        this.version = 0;
        this.heartbeatTimeout = null;
        this.resetHeartbeatTimeout(); // Begin heartbeat
        
        /// =BELOW}
        
        this.addDefaultCommands();
        
      },
      addDefaultCommands: function() {
        
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
          
          hut.version = 0;                                            // Reset version
          hut.sync = hut.sync.map(v => ({}));                         // Clear current delta
          hut.fols.forEach((fol, rec) => hut.toSync('addRec', rec));  // Gen full sync delta
          
          let update = hut.genSyncTell();
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
          
          let { version, content } = msg;
          if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
          
          let recs = lands.allRecs;
          
          try {
            
            let agg = U.AggWobs();
            
            // Apply all operations
            let { addRec={}, remRec={}, updRec={} } = content;
            
            // "head" Recs existed before the current update. "tail" Recs are Recs
            // whose existence results from the update. A Rec coming into existence
            // may have member reference to both HeadRecs and TailRecs
            let headRecs = this.allRecs;
            let tailRecs = new Map();
            let getHeadOrTailRec = uid => {
              if (headRecs.has(uid)) return headRecs.get(uid);
              if (tailRecs.has(uid)) return tailRecs.get(uid);
              return null;
            };
            
            // Add new Recs with dependency churning
            let waiting = addRec.toArr(v => v);
            while (waiting.length) {
              
              let attempt = waiting;
              waiting = [];
              for (let recData of attempt) {
                
                let { uid, type, value=null, members=[] } = recData;
                
                // Convert all members from uid to Rec
                members = members.map(uid => getHeadOrTailRec(uid));
                
                // If a member couldn't be converted wait for a later churn
                if (members.find(m => !m)) { waiting.push(recData); continue; }
                
                if (!this.recTypes.has(type)) throw new Error(`Below isn't aware of type "${type}"`);
                let recType = this.recTypes[type];
                let newRec = recType.create({ uid, value, agg }, ...members);
                tailRecs.set(uid, newRec);
                
              }
              
              if (waiting.length === attempt.length) throw new Error(`Unresolvable Rec dependencies`);
              
            }
            
            // Update Recs directly
            updRec.forEach((newValue, uid) => {
              if (!this.allRecs.has(uid)) throw new Error(`Tried to upd non-existent Rec @ ${uid}`);
              let rec = this.allRecs.get(uid);
              agg.addWob(rec);
              rec.wobble(newValue);
            });
            
            // Remove Recs directly
            remRec.forEach((val, uid) => {
              if (!this.allRecs.has(uid)) throw new Error(`Tried to rem non-existent Rec @ ${uid}`);
              let rec = this.allRecs.get(uid);
              agg.addWob(rec.shutWob());
              rec.shut();
            });
            
            // Do aggregated wobbles
            agg.complete();
            
            // We've successfully moved to our next version!
            lands.version = version;
            
          } catch(err) {
            err.message = `ABOVE CAUSED: ${err.message}`;
            throw err;
          }
          
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
        let terms = Set(this.getAllHuts().map(h => h.getTerm()));
        for (let i = 0; i < 100; i++) { // TODO: This can't last. `100` is arbitrary!
          let ret = TERMS[Math.floor(Math.random() * TERMS.length)]; // TODO: Should use chance room
          if (!terms.has(ret)) return ret;
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
        this.getAllHuts().forEach(hut => hut.tell(msg));
      },
      
      /// {BELOW=
      resetHeartbeatTimeout: function() {
        if (!this.heartbeatMs) return;
        
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker - wait less millis than `this.heartbeatMs`
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), Math.min(this.heartbeatMs * 0.8, this.heartbeatMs - 2000));
      },
      /// =BELOW}
      
      getAllHuts: function() {
        return this.arch.relWob(rt.archHuts, 0).toArr(({ members: [ _, hut ] }) => hut);
      },
      
      // TODO: async functions shouldn't be named "open" and "shut"
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'remote' ]; // Below has only 1 Hut, so only 1 name needed
        /// =BELOW}
        
        await Promise.all([ ...this.ways ].map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let hut = this.getAllHuts().find(() => true)[0];
        await this.hear(null, hut, U.initData); // Lands Below immediately hear the Above's initial update
        /// =BELOW}
      },
      shut: async function() { return Promise.all([ ...this.ways ].map(w => w.shut())); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { Rec }, methods: (insp, Insp) => ({
      
      init: function({ lands, address, ...supArgs }) {
        
        if (!lands) throw new Error('Missing "lands"');
        
        insp.Rec.init.call(this, supArgs);
        this.lands = lands;
        this.address = address;
        this.term = null;
        this.comWobs = {};
        this.ways = Set();
        
        /// {ABOVE=
        // Keep track of which Records the Below for this Hut has followed
        this.version = 0;
        this.fols = new Map();
        this.sync = [ 'addRec', 'updRec', 'remRec' ].toObj(v => [ v, {} ]);
        
        // Keep track of whether the Below for this Hut is still communicating
        this.expiryTimeout = null;
        this.syncThrottlePrm = null; // Resolves when we've sent sync to Below
        this.refreshExpiry();
        /// =ABOVE}
        
        /// {TEST=
        this.forceSyncVal = null;
        /// =TEST}
        
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
      refreshExpiry: function() {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = setTimeout(() => this.shut(), this.lands.heartbeatMs);
      },
      
      toSync: function(type, rec) {
        
        if (!this.sync.has(type)) throw new Error(`Invalid type: ${type}`);
        
        // TODO: PRESENT -> rem -> add may resolve to NO sync at all, but that
        // could mask any potential UPD that happens between rem and add!! This
        // sequence should probably always produce an upd on `rec` just to be
        // safe
        
        // TODO: These should be tests:
        // ABSENT,  add, rem -> no sync
        // PRESENT, rem, add -> no sync
        // ABSENT,  rem, add -> ERROR (rem non-existent)
        // PRESENT, add, rem -> ERROR (re-add existent)
        
        // Note that if we determine the current SyncItem requested is
        // redundant, the correct option is to `return`. This will also skip
        // the call to `this.requestSyncBelow`.
        
        // MULTIPLE OPS:
        // Can ADDREC and REMREC occur together? NO  (conflicting messages!)
        // Can ADDREC and UPDREC occur together? NO  (redundant!)
        // Can REMREC and UPDREC occur together? YES (e.g. animation upon deletion)
        
        if (type === 'addRec') {
          
          if (this.sync.remRec.has(rec.uid)) {
            delete this.sync.remRec[rec.uid];
            this.sync.updRec[rec.uid] = rec;
          } else {
            delete this.sync.updRec[rec.uid];
            this.sync.addRec[rec.uid] = rec;
          }
          
        } else if (type === 'remRec') {
          
          if (this.sync.addRec.has(rec.uid)) {
            delete this.sync.addRec[rec.uid];
          } else {
            this.sync.remRec[rec.uid] = rec;
          }
          
        } else if (type === 'updRec') {
          
          if (this.sync.addRec.has(rec.uid)) {
            return; // No "updRec" necessary: already adding!
          } else {
            this.sync.updRec[rec.uid] = rec;
          }
          
        }
        
        this.requestSyncBelow();
      },
      genSyncTell: function() {
        
        // Generates sync data to bring the Below up to date. Has the side-effect
        // of clearing this Hut's memory of the current delta.
        
        let addRec = this.sync.addRec.map(r => ({ type: r.type.name, value: r.value, members: r.members.map(m => m.uid) }));
        let updRec = this.sync.updRec.map(r => r.value);
        let remRec = this.sync.remRec.map(r => 1);
        
        let content = {};
        if (!addRec.isEmpty()) content.addRec = addRec;
        if (!updRec.isEmpty()) content.updRec = updRec;
        if (!remRec.isEmpty()) content.remRec = remRec;
        
        /// {TEST=
        if (this.forceSync) { content.force = this.forceSyncVal; this.forceSyncVal = null; }
        /// =TEST}
        
        if (content.isEmpty()) return null;
        
        this.sync = this.sync.map(v => ({}));
        this.version++;
        return { command: 'update', version: this.version, content };
        
      },
      requestSyncBelow: function() {
        
        // Schedules Below to be synced if not already scheduled
        
        if (this.syncThrottlePrm) return;
        
        this.syncThrottlePrm = (async () => {
          
          // await this.genSyncThrottlePrm();
          await new Promise(r => process.nextTick(r)); // TODO: This could be swapped out (to a timeout, or whatever!)
          this.syncThrottlePrm = null;
          
          // Hut may have been shut between scheduling and executing sync
          if (this.isShut()) return;
          
          let updateTell = this.genSyncTell();
          if (updateTell) this.tell(updateTell);
          
        })();
        
      },
      
      getRecFollowStrength: function(rec) { return (this.fols.get(rec) || { strength: 0 }).strength; },
      setRecFollowStrength: function(rec, strength) {
        
        if (strength < 0) throw new Error(`Invalid strength: ${strength}`);
        
        let fol = this.fols.get(rec) || null;               // The current Follow
        let strength0 = (fol || { strength: 0 }).strength;  // The current FollowStrength
        if (strength === strength0) throw new Error(`Strength is already ${strength}`);
        
        // Our FollowStrength of `rec` is changing! There are 3 possibilities:
        // 1 - Strength moving from =0 to >0 : ADD REC!
        // 2 - Strength moving from >0 to >0 : DO NOTHING!
        // 3 - Strength moving from >0 to =0 : REM REC!
        
        if (!strength0) {                   // ADD
          
          // This AccessPath depends on `rec`. That means if `rec` shuts for
          // any reason, we will stop following it! We can also explicitly
          // cease following `rec` by calling `ap.shut()`
          AccessPath(U.WobVal(rec), (dep, rec, ap) => {
            
            // Keep track of the follow
            this.fols.set(rec, { strength, ap });
            dep(Hog(() => this.fols.delete(rec)));
            
            // Send a sync
            this.toSync('addRec', rec);
            dep(Hog(() => this.toSync('remRec', rec)));
            
            // Send upd syncs when `rec` wobbles
            dep(rec.hold(val => this.toSync('updRec', rec)));
          });
          
        } else if (strength0 && strength) { // UPD
          
          fol.strength = strength;
          
        } else {                            // REM
          
          // Close the AccessPath
          fol.ap.shut();
          
        }
        
      },
      followRec: function(rec) {
        this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) + 1);
        return Hog(() => this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) - 1));
      },
      
      shut0: function() {
        insp.Rec.shut0.call(this);
        clearTimeout(this.expiryTimeout); this.expiryTimeout = null;
      },
      /// =ABOVE}
      
      /// {TEST=
      // TODO: Only works with TEST && ABOVE...
      forceSync: function(val) { this.forceSyncVal = val; this.requestSyncBelow(); },
      /// =TEST}
      
      tell: function(msg) {
        let findWay = this.ways.toArr(v => v).find(() => true);
        if (!findWay) throw new Error(`Hut ${this.address} has no Ways`);
        findWay[0].tellHut(this, msg);
      }
    })});
    let Way = U.inspire({ name: 'Way', methods: (insp, Insp) => ({
      init: function({ lands, makeServer }) {
        if (!lands) throw new Error('Missing "lands"');
        if (!makeServer) throw new Error('Missing "makeServer"');
        
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
          //    - A LandsRec which persists for the duration of its
          //      AbstractConnection 
          
          // Get the address; ensure it isn't already connected
          let { address } = absConn;
          if (this.connections.has(address)) throw new Error(`Multiple Huts at address ${address} - makeServer is likely flawed`);
          
          // Create the Hut, and reference by address
          // TODO: The same machine connecting through multiple Ways will result in
          // multiple Hut instances
          let hut = rt.hut.create({ lands: this.lands, address });
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
          absConn.hear.hold(([ msg, reply=null ]) => this.lands.hear(absConn, hut, msg, reply));
          
          /// {ABOVE=
          absConn.hear.hold(() => hut.refreshExpiry()); // Any communication refreshes expiry
          /// =ABOVE}
          
          // Attach the Hut to the Way and to the Lands
          hut.ways.add(this);
          rt.archHuts.create({}, this.lands.arch, hut);
          
        });
      },
      shut: async function() { this.serverFunc.shut(); /* TODO: detach from all connected huts?? */ },
      
      tellHut: function(hut, msg) {
        if (!this.connections.has(hut.address)) throw new Error(`Tried to tell disconnected hut: ${hut.getTerm()}`);
        this.connections[hut.address].absConn.tell(msg);
      }
    })});
    
    let { rt, add } = record2.recTyper();
    add('arch',     Rec);
    add('hut',      Hut);
    add('archHuts', Rec, '1M', rt.arch, rt.hut);
    
    let content = { Lands, LandsRec, Hut, Way, rt };
    
    /// {TEST= (@ line 550)
    content.test = rootKeep => rootKeep.contain(k => U.Keep(k, 'hinterlands').contain(k => {
      
      let testData = null;
      let testSetup = async () => {
        
        let addrCnt = 0;
        
        let { rt: trt, add } = record2.recTyper();
        add('loc',        LandsRec);
        add('item',       LandsRec);
        add('man',        LandsRec);
        add('hat',        LandsRec);
        add('store',      LandsRec);
        add('manHat',     LandsRec, '11', trt.man,     trt.hat);
        add('storeItem',  LandsRec, '1M', trt.store,   trt.item);
        add('storeLoc',   LandsRec, '11', trt.store,   trt.loc);
        add('manSeen',    LandsRec, 'MM', trt.man,     trt.loc);
        add('archItem',   LandsRec, '1M', rt.arch,     trt.item);
        add('archMan',    LandsRec, '1M', rt.arch,     trt.man);
        add('archStore',  LandsRec, '1M', rt.arch,     trt.store);
        
        let clients = Set();
        
        let server = U.Wob();
        server.spoofClient = (addr=null) => {
          if (addr === null) addr = (addrCnt++).toString(36).padHead(8, '0');
          
          let client = Hog();
          client.address = addr;
          client.hear = U.Wob();
          client.tellWob = U.Wob();
          client.tell = (...args) => {
            client.tellWob.wobble(...args);
          };
          client.nextTell = async (fn=null, force='force') => {
            let hold = null;
            let prm = new Promise(rsv => {
              hold = client.tellWob.hold(v => rsv(v));
            });
            
            let hut = way.connections[addr].hut;
            
            // Delta will be non-empty
            hut.forceSync(force);
            
            // Do any arbitrary work to effect the delta
            if (fn) fn(hut);
            
            let tellVal = await prm;
            hold.shut();
            
            return tellVal;
          };
          
          server.wobble(client);
          
          clients.add(client);
          client.shutWob().hold(() => clients.rem(client));
          
          return client;
        };
        
        let lands = Lands({ foundation });
        let way = Way({ lands, makeServer: () => server });
        lands.ways.add(way);
        
        await lands.open();
        
        return { trt, server, lands, way, clients };
        
      };
      
      k.sandwich.before = async () => {
        testData = await testSetup();
      };
      k.sandwich.after = () => {
        // If these aren't explicitly shut timeouts may cause
        // the program to persist after all tests are complete
        testData.clients.forEach(client => client.shut());
        testData.lands.shut();
      };
      
      U.Keep(k, 'landsGenUid', () => {
        let lands = Lands({ foundation });
        return { msg: 'Lands uid len is 8', result: lands.nextUid().length === 8 };
      });
      
      U.Keep(k, 'arch', async () => {
        let { trt, server, lands, way } = testData;
        return { msg: 'Lands has "arch"', result: U.isInspiredBy(lands.arch, Rec) };
      });
      
      U.Keep(k, 'landsRecNeedsLands', async () => {
        let { trt, lands, way } = testData;
        try {
          trt.item.create({ value: 'item!' }); // Missing "lands"
          return { msg: 'LandsRec(...) fails without "lands" param', result: false };
        } catch(err) {
          return { result: true };
        }
      });
      
      U.Keep(k, 'relWobDefineFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let itemWobbled = null;
        AccessPath(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { itemWobbled = item; });
        
        let item = trt.item.create({ lands, value: 'item!' });
        let archItem = trt.archItem.create({ lands }, lands.arch, item);
        
        return [
          [ 'relWob returns item', () => !!itemWobbled ],
          [ 'relWob returns correct item', () => itemWobbled === item ]
        ];
        
      });
      
      U.Keep(k, 'relWobCreateFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let item = trt.item.create({ lands, value: 'item!' });
        let archItem = trt.archItem.create({ lands }, lands.arch, item);
        
        let itemWobbled = null;
        AccessPath(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { itemWobbled = item; });
        
        return [
          [ 'relWob returns item', () => !!itemWobbled ],
          [ 'relWob returns correct item', () => itemWobbled === item ]
        ];
        
      });
      
      U.Keep(k, 'connectionSucceeds', async () => {
        let { trt, server, lands, way } = testData;
        let client = server.spoofClient();
        return { result: !!client };
      });
      
      U.Keep(k, 'connectHutDefineFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let hutWobbled = null;
        AccessPath(lands.arch.relWob(rt.archHuts, 0), (dep, { members: [ _, hut ] }) => { hutWobbled = hut; });
        
        let client = server.spoofClient();
        
        return [
          [ 'relWob returns item', () => !!hutWobbled ],
          [ 'relWob returns hut', () => U.isInspiredBy(hutWobbled, Hut) ]
        ];
        
      });
      
      U.Keep(k, 'connectHutCreateFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let hutWobbled = null;
        AccessPath(lands.arch.relWob(rt.archHuts, 0), (dep, { members: [ _, hut ] }) => { hutWobbled = hut; });
        
        return [
          [ 'relWob returns item', () => !!hutWobbled ],
          [ 'relWob returns hut', () => U.isInspiredBy(hutWobbled, Hut) ]
        ];
        
      });
      
      U.Keep(k, 'clientShutsHut', async() => {
        
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let hutWobbled = null;
        AccessPath(lands.arch.relWob(rt.archHuts, 0), (dep, { members: [ _, hut ] }) => {
          hutWobbled = hut;
        });
        
        client.shut();
        
        return { msg: 'hut is shut', result: () => hut.isShut() };
        
      });
      
      U.Keep(k, 'hutShutsClient', async() => {
        
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let hutWobbled = null;
        AccessPath(lands.arch.relWob(rt.archHuts, 0), (dep, { members: [ _, hut ] }) => {
          hutWobbled = hut;
        });
        
        client.shut();
        
        return { msg: 'hut is shut', result: () => hut.isShut() };
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
