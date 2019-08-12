U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    // All huts sit together in the lands
    
    // TODO: Lands, Huts, and Ways are setup wrong. A Hut should be able to
    //  connect through multiple Ways!
    // TODO: Could use a nice big high-level comment explaining why Huts are
    //  Recs, but Lands and Ways are not (although `myLands.arch` is a Rec!)
    
    // TODO: HEEERE! Use this one function both for Below, and for Tests!
    // Right now the Test's Below-update-logic is still a corrupt copy-paste
    // This function should be used instead. This function should exist in
    // EITHER "BELOW" or "TEST" modes - no capability to do that at present!
    let doUpdate = (lands, msg) => {
      
      let { version, content } = msg;
      if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
      
      let agg = U.AggWobs();
      let err = U.safe(() => {
        
        // Apply all operations
        let { addRec={}, remRec={}, updRec={} } = content;
        
        // "head" Recs existed before the current update. "tail" Recs are Recs
        // whose existence results from the update. A Rec coming into existence
        // may have member references to both HeadRecs and TailRecs
        let headRecs = lands.allRecs;
        let tailRecs = Map();
        let getHeadOrTailRec = uid => {
          if (headRecs.has(uid)) return headRecs.get(uid);
          if (tailRecs.has(uid)) return tailRecs.get(uid);
          return null;
        };
        
        // Add new Recs with dependency churning
        let waiting = addRec.toArr((v, uid) => v.gain({ uid }));
        while (waiting.length) {
          
          let attempt = waiting;
          waiting = [];
          
          for (let addVals of attempt) {
          
            let { type, value, members, uid } = addVals;
            
            // Convert all members from uid to Rec
            members = members.map(uid => getHeadOrTailRec(uid));
            
            // If a member couldn't be converted wait for a later churn
            if (members.find(m => !m)) { waiting.push(addVals); continue; }
            
            // All members are available - create the Rec!
            let newRec = lands.createRec(type, { uid, value, agg }, ...members);
            tailRecs.set(uid, newRec);
            
          }
          
          if (waiting.length === attempt.length) { // If churn achieved nothing we're stuck
            console.log(headRecs);
            console.log(JSON.stringify(content, null, 2));
            throw new Error(`Unresolvable Rec dependencies`);
          }
          
        }
        
        // Update Recs directly
        updRec.forEach((newValue, uid) => {
          if (!lands.allRecs.has(uid)) throw new Error(`Tried to upd non-existent Rec @ ${uid}`);
          let rec = lands.allRecs.get(uid);
          agg.addWob(rec);
          rec.wobble(newValue);
        });
        
        // Remove Recs directly
        let shutGroup = Set(); // TODO: THE AGGWOBS CAN PROVIDE THE "shutGroup"??? (overall it links a bunch of wobbles together)
        remRec.forEach((val, uid) => {
          if (!lands.allRecs.has(uid)) throw new Error(`Tried to rem non-existent Rec @ ${uid}`);
          let rec = lands.allRecs.get(uid);
          
          // Tolerate double-shuts which occur here (can easily happen when
          // GroupRecs shut due to their MemberRecs shutting, and then are
          // also shut directly)
          if (!rec.isShut()) { /*agg.addWob(rec.shutWob());*/ rec.shut(shutGroup); }
        });
        
        // Include all TailRecs in global set
        tailRecs.forEach((rec, uid) => {
          lands.allRecs.set(uid, rec);
          rec.shutWob().hold(() => lands.allRecs.rem(uid));
        });
        
      });
      
      // Do aggregated wobbles
      agg.complete(err);
      
      if (err) { err.message = `Error in "update": ${err.message}`; throw err; }
      
      // We've successfully moved to our next version!
      lands.version = version;
      
    };
    
    let { Rec, Rel } = record;
    let { Hog, WobTmp, WobMemSet, AccessPath } = U;
    
    let TERMS = [];
    
    let Lands = U.inspire({ name: 'Lands', methods: () => ({
      init: function({ foundation, heartbeatMs=10000, recTypes={}, ...more }) {
        
        this.uidCnt = 0;
        this.heartbeatMs = heartbeatMs;
        this.comWobs = {};
        this.ways = Set();
        this.recTypes = recTypes;
        
        this.arch = rt.arch.create({ uid: '!arch' });
        
        // Connection stuff
        this.pool = U.setup.CpuPool();
        this.hutsBelow = Map();   // Map cpuId to Hut
        
        /// {ABOVE=
        
        let { commands=[] } = more;
        this.commands = Set(commands);
        
        /// =ABOVE} {BELOW=
        
        // Keep direct references to all Recs for update/removal
        this.allRecs = Map();
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
        
        requiredCommand('update', ({ lands, hut, msg, reply }) => {
          
          doUpdate(lands, msg);
          
        });
        
        /// =BELOW}
        
      },
      nextUid: function() { return (this.uidCnt++).toString(36).padHead(8, '0'); },
      genUniqueTerm: function() {
        // If we used `getTerm` we could get an infinite loop! Simply exclude
        // any Huts that don't yet have a term
        let terms = Set(this.getAllHuts().map(h => h.term || C.skip));
        
        for (let i = 0; i < 100; i++) { // TODO: This can't last. `100` is arbitrary!
          let ret = TERMS[Math.floor(Math.random() * TERMS.length)]; // TODO: Should use chance room
          if (!terms.has(ret)) return ret;
        }
        throw new Error('Too many huts! Not enough terms!! AHHHH!!!');
      },
      
      // TODO: Useless? Most Recs don't need a "lands" param...
      createRec: function(name, params={}, ...args) {
        if (!this.recTypes.has(name)) throw new Error(`Invalid RecType name: "${name}"`)
        if (!params.has('uid')) params.uid = this.nextUid();
        params.lands = this;
        return this.recTypes[name].create(params, ...args);
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
        
        if (msg === null) return;
        
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
        this.resetHeartbeatTimeout(); // Already sending a sign of life; defer next heartbeat
        /// =BELOW}
        this.getAllHuts().forEach(hut => hut.tell(msg));
      },
      
      /// {BELOW=
      resetHeartbeatTimeout: function() {
        if (!this.heartbeatMs) return;
        
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker - wait less millis than `this.heartbeatMs`
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), Math.max(this.heartbeatMs * 0.85, this.heartbeatMs - 2000));
      },
      /// =BELOW}
      
      getAllHuts: function() {
        return this.arch.relWob(rt.archHut, 0).toArr(({ members: [ _, hut ] }) => hut);
      },
      
      // TODO: async functions shouldn't be named "open" and "shut"
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'remote' ]; // Below has only 1 Hut, so only 1 name needed
        /// =BELOW}
        
        await Promise.allArr([ ...this.ways ].map(w => w.open())); // Open all Ways
        
        /// {BELOW=
        let hut = this.getAllHuts().find(() => true)[0];
        await this.hear(null, hut, U.initData); // Lands Below immediately hear the Above's initial update
        /// =BELOW}
      },
      shut: async function() { return Promise.allArr([ ...this.ways ].map(w => w.shut())); }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { Rec }, methods: (insp, Insp) => ({
      
      init: function({ lands, cpuId, ...supArgs }) {
        
        if (!lands) throw new Error('Missing "lands"');
        if (!cpuId) throw new Error('Missing "cpuId"');
        
        insp.Rec.init.call(this, supArgs);
        this.lands = lands;
        this.cpuId = cpuId;
        this.term = null;
        this.comWobs = {};
        this.ways = Set();
        
        /// {ABOVE=
        // Keep track of which Records the Below for this Hut has followed
        this.version = 0;
        this.fols = Map();
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
        
        // MULTIPLE OPS:
        // Can ADDREC and REMREC occur together? NO  (conflicting messages!)
        // Can ADDREC and UPDREC occur together? NO  (redundant!)
        // Can REMREC and UPDREC occur together? YES (e.g. animation upon deletion)
        
        if (type === 'addRec') {
          
          if (this.sync.remRec.has(rec.uid)) {
            delete this.sync.remRec[rec.uid];
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
      requestSyncBelow: function() {
        
        // Schedules Below to be synced if not already scheduled
        
        if (this.syncThrottlePrm) return;
        
        let err = new Error('');
        
        this.syncThrottlePrm = (async () => {
          
          try {
            
            // await this.genSyncThrottlePrm();
            await new Promise(r => process.nextTick(r)); // TODO: This could be swapped out (to a timeout, or whatever!)
            
            this.syncThrottlePrm = null;
            
            // Hut may have been shut between scheduling and executing sync
            if (this.isShut()) return;
            
            let updateTell = this.genSyncTell();
            if (updateTell) this.tell(updateTell);
            
          } catch(err0) {
            throw err0;
            err.message = `Error doing sync: ${err0.message}`;
            throw err;
          }
          
        })();
        
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
        if (content.isEmpty() && this.forceSyncVal) { content.force = this.forceSyncVal; }
        this.forceSyncVal = null;
        /// =TEST}
        
        if (content.isEmpty()) return null;
        
        this.sync = this.sync.map(v => ({}));
        this.version++;
        return { command: 'update', version: this.version, content };
        
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
        
        if (!strength0) {                  // ADD
          
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
          
        } else {                           // REM
          
          // Close the AccessPath
          fol.ap.shut();
          
        }
        
      },
      followRec: function(rec) {
        // TODO: Automatically follow `rec.members`?
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
        
        this.lands.ways.add(this); // TODO: I prefer `lands.addWay(Way(...));`
      },
      
      open: async function() {
        this.server = await this.makeServer();
        this.serverFunc = this.server.hold(absConn => {
          
          // Note there are different strata of "connections":
          // 1) FundamentalConnection (HTTP protocol, SOKT protocol, etc.)
          // 2) AbstractConnection (here, `absConn`):
          //    - Provides connection events; provides state for stateless
          //      FundamentalConnections. Common interface across different
          //      FundamentalConnections
          //    - Patches a number of Fundamental connections together
          // 3) Connected Hut (the thing generated by this function):
          //    - A Rec which lives for the duration of its
          //      AbstractConnection 
          
          // Get the cpuId; ensure it isn't already connected
          let { cpuId } = absConn;
          //if (this.lands.pool.getConn(cpuId, this.server)) throw new Error(`Server "${this.server.desc}" gave duplicate cpuId "${cpuId}" - makeServer may be flawed`);
          
          // It's possible this is the first Way through which the Hut is connecting
          let hut = this.lands.hutsBelow.get(cpuId);
          if (!hut) {
            hut = this.lands.createRec('hut', { cpuId }); // Create a hut for the cpu...
            
            // Remember the Hut so long as it lives
            this.lands.hutsBelow.set(cpuId, hut);
            hut.shutWob().hold(() => this.lands.hutsBelow.rem(cpuId));
          }
          
          // TODO: Can Ways shut? Like if the server loses its ability to perform
          // SOKT connections? Let's assume "no" for now...
          
          hut.ways.add(this);
          hut.shutWob().hold(group => absConn.isShut() || absConn.shut(group));
          
          absConn.shutWob().hold(group => {
            // Disconnect the Hut from `this` Way. If the Hut has no more Ways,
            // shut the Hut!
            hut.ways.rem(this);
            if (!hut.isShut() && hut.ways.toArr(v => v).isEmpty()) hut.shut(group);
          });
          
          /// {ABOVE=
          absConn.hear.hold(() => hut.refreshExpiry()); // Any communication refreshes expiry
          /// =ABOVE}
          
          // Pass anything heard on to our Lands
          absConn.hear.hold(([ msg, reply=null ]) => this.lands.hear(absConn, hut, msg, reply));
          
          // Attach the Hut to the Way and to the Lands
          // TODO: Right now the lands tracks the Hut both through `hutsBelow` and
          // through `archHut`... ideally only one should be used! I think we can't
          // create the ArchHut too early in this function, or else initial holders
          // will receive a Hut that is lacking some functionality
          this.lands.createRec('archHut', {}, this.lands.arch, hut);
          
        });
      },
      shut: async function() { this.serverFunc.shut(); },
      
      tellHut: function(hut, msg) {
        let conn = this.lands.pool.getConn(hut.cpuId, this.server);
        if (!conn) throw new Error(`Tried to tell disconnected hut: ${hut.getTerm()}`);
        conn.tell(msg);
      }
    })});
    
    let { rt, add } = record.recTyper();
    add('arch',     Rec);
    add('hut',      Hut);
    add('archHut',  Rec, '1M', rt.arch, rt.hut);
    
    let content = { Lands, Hut, Way, rt };
    
    /// {TEST=
    
    let parseInitData = msg => {
      let endBit = msg.substr(msg.indexOf('// ==== File:' + ' hut.js'));
      let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
      if (!initDataMatch) throw new Error(`Couldn't parse invalid initData`);
      return JSON.parse(initDataMatch[1]);
    };
    
    content.test = rootKeep => rootKeep.contain(k => {
      
      let testData = null;
      k.sandwich.before = async () => {
        
        let cpuIdCnt = 0;
        
        let { rt: trt, add } = record.recTyper();
        add('loc',        Rec);
        add('item',       Rec);
        add('man',        Rec);
        add('hat',        Rec);
        add('store',      Rec);
        add('manHat',     Rec, '11', trt.man,     trt.hat);
        add('storeItem',  Rec, '1M', trt.store,   trt.item);
        add('storeLoc',   Rec, '11', trt.store,   trt.loc);
        add('manSeen',    Rec, 'MM', trt.man,     trt.loc);
        add('archItem',   Rec, '1M', rt.arch,     trt.item);
        add('archMan',    Rec, '1M', rt.arch,     trt.man);
        add('archStore',  Rec, '1M', rt.arch,     trt.store);
        
        let lands = Lands({ foundation, recTypes: { ...rt, ...trt } });
        
        let clients = Set();
        
        let server = U.Wob();
        server.desc = 'Spoofy server for hinterlands tests';
        server.spoofClient = () => {
          let cpuId = (cpuIdCnt++).toString(36).padHead(8, '0');
          
          let client = Hog();
          client.cpuId = cpuId;
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
            prm.then(() => hold.shut());
            
            let hut = way.hutForClient(client);
            
            if (force) hut.forceSync(force);   // Ensure something is sent back even if no delta results
            if (fn) await fn(hut);  // Some arbitrary 
            
            let tellVal = await prm;
            
            return tellVal;
          };
          
          lands.pool.addConn(client.cpuId, server, client);
          server.wobble(client);
          
          clients.add(client);
          client.shutWob().hold(() => clients.rem(client));
          
          return client;
        };
        
        let way = Way({ lands, makeServer: () => server });
        way.hutForClient = client => way.lands.hutsBelow.get(client.cpuId);
        
        await lands.open();
        
        testData = { trt, server, lands, way, clients };
        
      };
      k.sandwich.after = () => {
        let shutGroup = Set();
        
        // If these aren't explicitly shut timeouts may cause
        // the program to persist after all tests are complete
        testData.clients.forEach(client => client.shut(shutGroup));
        testData.lands.shut(shutGroup);
      };
      
      U.Keep(k, 'landsGenUid', () => {
        let lands = Lands({ foundation, recTypes: {} });
        return { msg: 'Lands uid len is 8', result: lands.nextUid().length === 8 };
      });
      
      U.Keep(k, 'arch', async () => {
        let { trt, server, lands, way } = testData;
        return { msg: 'Lands has "arch"', result: U.isInspiredBy(lands.arch, Rec) };
      });
      
      U.Keep(k, 'relWobDefineFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let wobbledItem = null;
        AccessPath(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        return [
          [ 'relWob returns item', () => !!wobbledItem ],
          [ 'relWob returns correct item', () => wobbledItem === item ]
        ];
        
      });
      
      U.Keep(k, 'relWobCreateFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let item = lands.createRec('item', { value: 'item!' })
        let archItem = lands.createRec('archItem', {}, lands.arch, item)
        
        let wobbledItem = null;
        AccessPath(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
        
        return [
          [ 'relWob returns item', () => !!wobbledItem ],
          [ 'relWob returns correct item', () => wobbledItem === item ]
        ];
        
      });
      
      U.Keep(k, 'connectionSucceeds', async () => {
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        return { result: !!client };
      });
      
      U.Keep(k, 'connectHutDefineFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let wobbledHut = null;
        AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
        
        let client = server.spoofClient();
        
        return [
          [ 'relWob returns item', () => !!wobbledHut ],
          [ 'relWob returns hut', () => U.isInspiredBy(wobbledHut, Hut) ]
        ];
        
      });
      
      U.Keep(k, 'connectHutCreateFirst', async () => {
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let wobbledHut = null;
        AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
        
        return [
          [ 'relWob returns item', () => !!wobbledHut ],
          [ 'relWob returns hut', () => U.isInspiredBy(wobbledHut, Hut) ]
        ];
        
      });
      
      U.Keep(k, 'clientShutsHut', async () => {
        
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let wobbledHut = null;
        AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
          wobbledHut = hut;
        });
        
        client.shut();
        
        return { msg: 'hut is shut', result: () => hut.isShut() };
        
      });
      
      U.Keep(k, 'hutShutsClient', async () => {
        
        let { trt, server, lands, way } = testData;
        
        let client = server.spoofClient();
        
        let wobbledHut = null;
        AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
        
        client.shut();
        
        return { msg: 'hut is shut', result: () => hut.isShut() };
        
      });
      
      U.Keep(k, 'getInit').contain(k => {
        
        U.Keep(k, 'noData', async () => {
          
          let { trt, server, lands, way } = testData;
          
          let client = server.spoofClient();
          
          let result = await client.nextTell(() => {
            client.hear.wobble([ { command: 'getInit' }, client.tell ]);
          }, null);
          
          let initData = parseInitData(result);
          return { result: initData === null };
          
        });
        
        U.Keep(k, 'simpleRec', async () => {
          
          let { trt, server, lands, way } = testData;
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
            dep(AccessPath(lands.arch.relWob(trt.archItem, 0), (dep, archItem) => {
              hut.followRec(archItem);
              hut.followRec(archItem.members[1]);
            }));
          });
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
           
          let client = server.spoofClient();
          let result = await client.nextTell(() => {
            client.hear.wobble([ { command: 'getInit' }, client.tell ]);
          });
          
          let initData = parseInitData(result);
          
          return [
            [ 'data is Object', () => U.isType(initData, Object) ],
            [ 'version is 1', () => initData.version === 1 ],
            [ 'command is update', () => initData.command === 'update' ],
            [ 'content is Object', () => U.isType(initData.content, Object) ],
            [ 'content addRec is Object', () => U.isType(initData.content.addRec, Object) ],
            [ 'adds 2 Recs', () => initData.content.addRec.toArr(v => v).length === 2 ],
            [ 'adds item', () => initData.content.addRec.find((v, k) => k === item.uid) ],
            [ 'adds archItem', () => initData.content.addRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
      });
      
      U.Keep(k, 'follow').contain(k => {
        
        U.Keep(k, 'addRecDefineFirst', async () => {
          
          let { trt, server, lands, way } = testData;
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            
            let [ arch, hut ] = archHut.members;
            
            dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              
              let [ arch, item ] = archItem.members;
              
              hut.followRec(archItem);
              hut.followRec(item);
              
            }));
            
          });
          
          let client = server.spoofClient();
          let hut = way.hutForClient(client);
          
          let item = lands.createRec('item', { value: 'item!' })
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let result = await client.nextTell();
          
          return [
            [ 'result is object', () => U.isType(result, Object) ],
            [ 'result isn\'t forced', () => !result.has('force') ],
            [ 'is version 1', () => result.version === 1 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
            [ 'add 2 Recs', () => result.content.addRec.toArr(v => v).length === 2 ],
            [ 'add includes item', () => result.content.addRec.find((v, k) => v.type === item.type.name && k === item.uid && v.value === 'item!') ],
            [ 'add includes archItem', () => result.content.addRec.find((v, k) => v.type === archItem.type.name && k === archItem.uid) ],
          ];
          
        });
        
        U.Keep(k, 'addRecCreateFirst', async () => {
          
          let { trt, server, lands, way } = testData;
          
          let client = server.spoofClient();
          let hut = way.hutForClient(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            
            let [ arch, hut ] = archHut.members;
            
            dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              
              let [ arch, item ] = archItem.members;
              
              hut.followRec(archItem);
              hut.followRec(item);
              
            }));
            
          });
          
          let result = await client.nextTell();
          
          return [
            [ 'result is object', () => U.isType(result, Object) ],
            [ 'result isn\'t forced', () => !result.has('force') ],
            [ 'is version 1', () => result.version === 1 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
            [ 'add 2 Recs', () => result.content.addRec.toArr(v => v).length === 2 ],
            [ 'add includes item', () => result.content.addRec.find((v, k) => v.type === item.type.name && k === item.uid && v.value === 'item!') ],
            [ 'add includes archItem', () => result.content.addRec.find((v, k) => v.type === archItem.type.name && k === archItem.uid) ],
          ];
          
        });
        
        U.Keep(k, 'updRec1', async () => {
          
          let { trt, server, lands, way } = testData;
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          let client = server.spoofClient();
          let hut = way.hutForClient(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          // Get addRec
          let result = await client.nextTell();
          
          // Get updRec
          result = await client.nextTell(() => item.wobble('Wheee'));
          
          return [
            [ 'result is object', () => U.isType(result, Object) ],
            [ 'result isn\'t forced', () => !result.has('force') ],
            [ 'is version 2', () => result.version === 2 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content updRec is Object', () => U.isType(result.content.updRec, Object) ],
            [ 'upd 1 Rec', () => result.content.updRec.toArr(v => v).length === 1 ],
            [ 'upd item to correct value', () => result.content.updRec.find((v, k) => k === item.uid && v === 'Wheee') ],
          ];
          
        });
        
        U.Keep(k, 'remRec1', async () => {
          
          let { trt, server, lands, way } = testData;
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            
            let [ arch, hut ] = archHut.members;
            
            dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              
              let [ arch, item ] = archItem.members;
              
              hut.followRec(archItem);
              hut.followRec(item);
              
            }));
            
          });
          
          let client = server.spoofClient();
          let hut = way.hutForClient(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let result = await client.nextTell();
          
          result = await client.nextTell(() => {
            archItem.shut();
          });
          
          return [
            [ 'result is object', () => U.isType(result, Object) ],
            [ 'result isn\'t forced', () => !result.has('force') ],
            [ 'is version 2', () => result.version === 2 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content remRec is Object', () => U.isType(result.content.remRec, Object) ],
            [ 'rem 1 Rec', () => result.content.remRec.toArr(v => v).length === 1 ],
            [ 'rem archItem', () => result.content.remRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        U.Keep(k, 'remRec2', async () => {
          
          let { trt, server, lands, way } = testData;
          
          AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            
            let [ arch, hut ] = archHut.members;
            
            dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              
              let [ arch, item ] = archItem.members;
              
              hut.followRec(archItem);
              hut.followRec(item);
              
            }));
            
          });
          
          let client = server.spoofClient();
          let hut = way.hutForClient(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          // Get addRec
          let result = await client.nextTell();
          
          // Get remRec
          result = await client.nextTell(() => item.shut());
          
          // TODO: Really, we only need to send "remRec" for `item`, as its
          // removal will automatically remove `archItem` from below as well.
          // This isn't taken into consideration at the moment. Instead all
          // Recs whose shutting occurs as a result of a single operation are
          // individually synced shut on the Below's end.
          
          return [
            [ 'result is object', () => U.isType(result, Object) ],
            [ 'result isn\'t forced', () => !result.has('force') ],
            [ 'is version 2', () => result.version === 2 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content remRec is Object', () => U.isType(result.content.remRec, Object) ],
            [ 'rem 2 Recs', () => result.content.remRec.toArr(v => v).length === 2 ],
            [ 'rem item', () => result.content.remRec.find((v, k) => k === item.uid) ],
            [ 'rem archItem', () => result.content.remRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        U.Keep(k, 'multi').contain(k => {
          
          U.Keep(k, 'addSyncRemSyncAddSync', async () => {
            
            let { trt, server, lands, way } = testData;
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ arch, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            let client = server.spoofClient();
            let hut = way.hutForClient(client);
            
            // Get addRec for `item` and `archItem`
            let result1 = await client.nextTell();
            
            // Unfollow `archItem`
            let str = hut.getRecFollowStrength(archItem);
            let result2 = await client.nextTell(() => {
              hut.setRecFollowStrength(archItem, 0);
            });
            
            // Follow `archItem` again
            let result3 = await client.nextTell(() => {
              hut.setRecFollowStrength(archItem, str);
            });
            
            return [
              [ 'result is object', () => U.isType(result3, Object) ],
              [ 'is version 3', () => result3.version === 3 ],
              [ 'is update command', () => result3.command === 'update' ],
              [ 'result content is Object', () => U.isType(result3.content, Object) ],
              [ 'content addRec is Object', () => U.isType(result3.content.addRec, Object) ],
              [ 'adds 1 Rec', () => result3.content.addRec.toArr(v => v).length === 1 ],
              [ 'content addRec is correct', () => result3.content.addRec.find((v, k) => k === archItem.uid) ],
            ];
            
          });
          
          U.Keep(k, 'addSyncRemAddSync', async () => {
            
            let { trt, server, lands, way } = testData;
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ arch, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            let client = server.spoofClient();
            let hut = way.hutForClient(client);
            
            // Get addRec for `item` and `archItem`
            let result1 = await client.nextTell();
            
            // Unfollow and follow `archItem`
            let result2 = await client.nextTell(() => {
              let str = hut.getRecFollowStrength(archItem);
              hut.setRecFollowStrength(archItem, 0);
              hut.setRecFollowStrength(archItem, str);
            });
            
            return [
              [ 'result is object', () => U.isType(result2, Object) ],
              [ 'is version 2', () => result2.version === 2 ],
              [ 'is update command', () => result2.command === 'update' ],
              [ 'result content is Object', () => U.isType(result2.content, Object) ],
              [ 'content has no addRec', () => !result2.content.has('addRec') ],
              [ 'content has no remRec', () => !result2.content.has('remRec') ],
            ];
            
          });
          
          U.Keep(k, 'addRemSync1', async () => {
            
            let { trt, server, lands, way } = testData;
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ arch, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let client = server.spoofClient();
            let hut = way.hutForClient(client);
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            hut.setRecFollowStrength(archItem, 0);
            
            // Get addRec for `item` and `archItem`
            let result = await client.nextTell();
            
            return [
              [ 'result is Object', () => U.isType(result, Object) ],
              [ 'is version 1', () => result.version === 1 ],
              [ 'is update command', () => result.command === 'update' ],
              [ 'result content is Object', () => U.isType(result.content, Object) ],
              [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
              [ 'adds 1 Rec', () => result.content.addRec.toArr(v => v).length === 1 ],
              [ 'adds correct Rec', () => result.content.addRec.find((v, k) => k === item.uid) ],
            ];
            
          });
          
          U.Keep(k, 'addRemSync2', async () => {
            
            let { trt, server, lands, way } = testData;
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ arch, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let client = server.spoofClient();
            let hut = way.hutForClient(client);
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            archItem.shut();
            
            // Get addRec for `item` and `archItem`
            let result = await client.nextTell();
            
            return [
              [ 'result is Object', () => U.isType(result, Object) ],
              [ 'is version 1', () => result.version === 1 ],
              [ 'is update command', () => result.command === 'update' ],
              [ 'result content is Object', () => U.isType(result.content, Object) ],
              [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
              [ 'adds 1 Rec', () => result.content.addRec.toArr(v => v).length === 1 ],
              [ 'adds correct Rec', () => result.content.addRec.find((v, k) => k === item.uid) ],
            ];
            
          });
          
        });
        
      });
      
      U.Keep(k, 'aboveAndBelow').contain(k => {
        
        let mock2PartyData = null;
        k.sandwich.before = async () => {
          
          // `serverAbove` wobbles clients representing Belows
          // `serverBelow` wobbles a single client representing its Above
          
          let { trt, server: serverAbove, lands, way } = testData;
          
          let addClientBelow = (name, fn=null) => {
            
            let recTypes = { ...rt, ...trt };
            
            // Combine hinterlands RecTypes (`rt`) along with RecTypes for tests (`trt`)
            let state = { version: 0, recTypes, server: null, holds: [] };
            state.createRec = (type, ...args) => recTypes[type].create(...args);
            
            let cpuIdCnt = 0;
            let serverBelow = state.server = U.Wob();
            serverBelow.spoofClient = () => {
              let cpuId = (cpuIdCnt++).toString(36).padHead(8, '0');
              
              let aboveClient = Hog();
              aboveClient.cpuId = cpuId;
              aboveClient.hear = U.Wob();
              aboveClient.tellWob = U.Wob();
              aboveClient.tell = (...args) => aboveClient.tellWob.wobble(...args);
              aboveClient.nextHear = async (fn=null, force='force') => {
                
                let timeout = null;
                let hold = null;
                let prm = new Promise(rsv => {
                  hold = aboveClient.hear.hold(rsv);
                  timeout = setTimeout(() => rsv([ { force }, () => { throw new Error('Bad!'); } ]), 20);
                });
                
                if (fn) fn();
                
                let [ msg, reply ] = await prm; // We ignore "reply" here
                hold.shut();
                clearTimeout(timeout);
                
                return msg;
                
              };
              
              lands.pool.addConn(aboveClient.cpuId, serverBelow, aboveClient);
              serverBelow.wobble(aboveClient);
              
              return aboveClient;
            };
            
            if (fn) fn(state, serverBelow);
            
            state.fresh = () => {
              
              state.version = 0;
              state.arch = rt.arch.create({ uid: '!arch' });
              state.allRecs = Map([ [ state.arch.uid, state.arch ] ]);
              state.holds.forEach(hold => !hold.isShut() && hold.shut()); // Close any open holds
              
              // `aboveClient` is `serverAbove`'s representation of Below
              let aboveClient = serverAbove.spoofClient();
              
              // `belowClient` is `serverBelow`'s only Client, and representation of Above
              // Generated by the function just above!
              let belowClient = serverBelow.spoofClient();
              
              state.tell = (msg) => {
                belowClient.tell([ msg, (...args) => aboveClient.tell(...args) ]);
              };
              
              // Here's how messages from Above hit Below! Note that a "reply" function
              // is included
              state.holds.push(aboveClient.tellWob.hold(msg => belowClient.hear.wobble([ msg, () => { throw new Error('No reply available'); } ])));
              
              // Here's how messages from Below hit Above. Note that any "reply" function
              // will already be included in `args`
              state.holds.push(belowClient.tellWob.hold((...args) => aboveClient.hear.wobble(...args)));
              
              return [ aboveClient, belowClient ];
              
            };
            
            return state;
            
          };
          
          mock2PartyData = {
            addClientBelow,
            above: testData
          };
          
        };
        k.sandwich.after = () => {
        };
        
        U.Keep(k, 'connectedness', async () => {
          
          let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
          let below1 = mock2PartyData.addClientBelow('testBelow1');
          let [ aboveClient, belowClient ] = below1.fresh();
          
          let heard = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          return { msg: 'heard something', result: !U.isType(heard, Object) || !heard.has('force') };
          
        });
        
        U.Keep(k, 'getInitHtml', async () => {
          
          let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
          let below1 = mock2PartyData.addClientBelow('testBelow1');
          let [ aboveClient, belowClient ] = below1.fresh();
          
          let heardData = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          return [
            [ 'response is String', () => U.isType(heardData, String) ],
            [ 'response looks like html', () => heardData.hasHead('<!DOCTYPE html>') ]
          ];
          
        });
        
        U.Keep(k, 'mockBelow').contain(k => {
          
          let gatherAllRecs = (rec, allRecs={}) => {
            
            if (allRecs.has(rec.uid)) return allRecs;
            allRecs[rec.uid] = rec;
            
            // Include all MemberRecs
            rec.members.forEach(mem => gatherAllRecs(mem, allRecs));
            
            // Include all GroupRecs
            rec.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(rec0 => gatherAllRecs(rec0, allRecs)));
            
            return allRecs;
            
          };
          let aboveBelowDiff = (lands, state) => {
            
            let [ aboveRecs, belowRecs ] = [ lands.arch, state.arch ].map(r => gatherAllRecs(r));
            
            let onlyInAbove = aboveRecs.map((rec, uid) => belowRecs.has(uid) ? C.skip : rec);
            let onlyInBelow = belowRecs.map((rec, uid) => aboveRecs.has(uid) ? C.skip : rec);
            let valueMismatch = aboveRecs.toArr((rec, uid) =>
              (belowRecs.has(uid) && belowRecs[uid].value !== rec.value)
                ? { above: rec, below: belowRecs[uid] }
                : C.skip
            );
            let match = onlyInAbove.isEmpty() && onlyInBelow.isEmpty() && valueMismatch.isEmpty();
            
            return { onlyInAbove, onlyInBelow, valueMismatch, match };
            
          };
          k.sandwich.before = () => {
            
            mock2PartyData.addMockedClientBelow = name => {
              
              return mock2PartyData.addClientBelow(name, state => {
                state.server.hold(client => client.hear.hold(([ msg, reply ]) => {
                  
                  // This happens whenever the Below hears anything
                  
                  if (U.isType(msg, String)) {
                    
                    if (msg.hasHead('<!DOCTYPE html>')) {
                      
                      let initData = parseInitData(msg);
                      if (initData) doUpdate(state, initData);
                      
                    }
                    
                  } else if (U.isType(msg, Object)) {
                    
                    if (msg.has('command')) {
                      
                      if (msg.command === 'update') {
                        
                        doUpdate(state, msg);
                        
                      } else {
                        
                        throw new Error(`Command not supported: "${msg.command}"`);
                        
                      }
                      
                    }
                    
                  }
                  
                }));
              });
              
            };
            
          };
          k.sandwich.after = () => {};
          
          U.Keep(k, 'getInitHtml', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            let [ aboveClient, belowClient ] = below1.fresh();
            
            let heardData = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
            
            return [
              [ 'response is String', () => U.isType(heardData, String) ],
              [ 'response looks like html', () => heardData.hasHead('<!DOCTYPE html>') ]
            ];
            
          });
          
          U.Keep(k, 'getInitAndSyncRaw', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            let [ aboveClient, belowClient ] = below1.fresh();
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                
                let [ _, item ] = archItem.members;
                hut.followRec(archItem);
                hut.followRec(item);
                
              }));
              
            });
            
            let heardData1 = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            let heardData2 = await belowClient.nextHear();
            
            return [
              [ 'got Object', () => U.isType(heardData2, Object) ],
              [ 'object version 1', () => heardData2.version === 1 ],
              [ 'command is "update"', () => heardData2.command === 'update' ],
              [ 'command content is Object', () => U.isType(heardData2.content, Object) ],
              [ 'content addRec is Object', () => U.isType(heardData2.content.addRec, Object) ],
              [ 'adds 2 Recs', () => heardData2.content.addRec.toArr(v => v).length === 2 ],
              [ 'adds item', () => heardData2.content.addRec.find((v, uid) => uid === item.uid) ],
              [ 'adds archItem', () => heardData2.content.addRec.find((v, uid) => uid === archItem.uid) ]
            ];
            
          });
          
          U.Keep(k, 'getInitAndSync', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            let [ aboveClient, belowClient ] = below1.fresh();
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ _, item ] = archItem.members;
                hut.followRec(archItem);
                hut.followRec(item);
              }));
            });
            
            await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            await belowClient.nextHear();
            
            return [
              [ 'synced archItem', () => below1.arch.relWob(trt.archItem, 0).toArr(v => v).length === 1 ],
              [ 'synced item', () => {
                let archItemBelow = below1.arch.relWob(trt.archItem, 0).toArr(v => v)[0];
                let itemBelow = archItemBelow.members.find(rec => rec.type === trt.item);
                if (!itemBelow) return false;
                else            itemBelow = itemBelow[0];
                return itemBelow && itemBelow.uid === item.uid && itemBelow !== item;
                //below1.arch.relWob(trt.archItem, 0).toArr(v => v).find(v => 1).members.find(v => v.type.name === 'item') ]
              }]
            ];
            
          });
          
          U.Keep(k, 'multipleGetInit', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ _, item ] = archItem.members;
                hut.followRec(archItem);
                hut.followRec(item);
              }));
            });
            
            // Reset a bunch of times
            let [ aboveClient, belowClient ] = [ null, null ];
            for (let i = 0; i < 10; i++) {
              [ aboveClient, belowClient ] = below1.fresh();
              below1.tell({ command: 'getInit' })
              await belowClient.nextHear();
            }
            
            let item = lands.createRec('item', { value: 'item!' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            await belowClient.nextHear();
            
            return [
              [ 'synced archItem', () => below1.arch.relWob(trt.archItem, 0).toArr(v => v).length === 1 ],
              [ 'synced item', () => {
                let archItemBelow = below1.arch.relWob(trt.archItem, 0).toArr(v => v)[0];
                let itemBelow = archItemBelow.members.find(rec => rec.type === trt.item);
                return itemBelow && itemBelow[0].uid === item.uid && itemBelow[0] !== item;
              }]
            ];
            
          });
          
          U.Keep(k, 'updSync', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ _, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let [ aboveClient, belowClient ] = below1.fresh();
            
            await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
            
            let item = lands.createRec('item', { value: 'item1' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            await belowClient.nextHear();
            
            item.modify(v => `${v}-modified`);
            
            await belowClient.nextHear();
            
            let diff = aboveBelowDiff(lands, below1);
            return [
              [ 'diff not empty', () => !diff.match ],
              [ 'above is superset of below', () => diff.onlyInBelow.isEmpty() ],
              [ 'above has 2 extra Recs', () => diff.onlyInAbove.toArr(v => v).length === 2 ],
              [ 'only above has hut', () => diff.onlyInAbove.find(rec => rec.type.name === 'hut') ],
              [ 'only above has archHut', () => diff.onlyInAbove.find(rec => rec.type.name === 'archHut') ]
            ];
            
          });
          
          U.Keep(k, 'remSyncRaw', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ _, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let [ aboveClient, belowClient ] = below1.fresh();
            
            await belowClient.nextHear();
            
            let item = lands.createRec('item', { value: 'item1' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            await belowClient.nextHear();
            
            item.shut();
            
            let sync = await belowClient.nextHear();
            
            return [
              [ 'sync is Object', () => U.isType(sync, Object) ],
              [ 'sync is version 2', () => sync.version === 2 ],
              [ 'sync command is "update"', () => sync.command === 'update' ],
              [ 'sync content is Object', () => U.isType(sync.content, Object) ],
              [ 'sync does remRec', () => U.isType(sync.content.remRec, Object) ],
              [ 'sync rems 2 Recs', () => sync.content.remRec.toArr(v => v).length === 2 ],
              [ 'sync rems item', () => sync.content.remRec.find((r, uid) => uid === item.uid) ],
              [ 'sync rems archItem', () => sync.content.remRec.find((r, uid) => uid === archItem.uid) ]
            ];
            
          });
          
          U.Keep(k, 'remSync', async () => {
            
            let { trt, server: serverAbove, lands, way } = mock2PartyData.above;
            let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
            
            AccessPath(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
              let [ arch, hut ] = archHut.members;
              dep(AccessPath(arch.relWob(trt.archItem, 0), (dep, archItem) => {
                let [ _, item ] = archItem.members;
                hut.followRec(item);
                hut.followRec(archItem);
              }));
            });
            
            let [ aboveClient, belowClient ] = below1.fresh();
            
            await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
            
            let item = lands.createRec('item', { value: 'item1' });
            let archItem = lands.createRec('archItem', {}, lands.arch, item);
            
            await belowClient.nextHear();
            
            item.shut();
            
            let remResult = await belowClient.nextHear();
            
            let diff = aboveBelowDiff(lands, below1);
            
            return [
              [ 'archItem removed', () => below1.arch.relWob(trt.archItem, 0).size() === 0 ],
              [ 'above is superset of below', () => diff.onlyInBelow.isEmpty() ],
              [ 'above has 2 extra Recs', () => diff.onlyInAbove.toArr(v => v).length === 2 ],
              [ 'only above has hut', () => diff.onlyInAbove.find(rec => rec.type.name === 'hut') ],
              [ 'only above has archHut', () => diff.onlyInAbove.find(rec => rec.type.name === 'archHut') ],
              [ 'no value mismatches', () => diff.valueMismatch.isEmpty() ]
            ];
            
          });
          
        });
        
      });
      
    });
    
    /// =TEST}
    
    return content;
  }
});
