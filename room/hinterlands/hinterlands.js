global.rooms.hinterlands = async foundation => {
  
  let recordRoom = await foundation.getRoom('record');
  
  let { RecTypes, Rec } = recordRoom;
  let { Src, Tmp } = U.logic;
  
  let Hut = U.form({ name: 'Hut', has: { RecTypes, Rec }, props: (forms, Form) => ({
    
    // Huts are describable by the following terms:
    // AFAR/HERE: Indicates whether the Hut instance represents a local
    //   or far-away (remote) identity. For example, two HereHuts do not
    //   require any transport tech to communicate with each other,
    //   because they exist side-by-side in RAM!
    // PAR/KID: Indicates whether the Hut was created as the child of
    //   another Hut. KidHuts are instantiated when a ParHut receives a
    //   "sync" that includes a Hut as one of the items to "add".
    //   ParHuts are always instantiated directly (for example, from the
    //   root hut.js file). Note that ancestry heirarchies should only
    //   have parents and children; no grandchildren (a directly
    //   instantiated Hut manages all other Huts, in a flat heirarchy).
    
    $tell: (srcHut, trgHut, road=null, reply=null, msg, ms=foundation.getMs()) => {
      
      // Note that `ms` should typically be provided, and should
      // represent the high-precision time at which the tell occurred
      
      // How communication happens
      // | SrcHut  | TrgHut  | Road
      // |---------|---------|-----------------
      // | Here    | Here    | Not needed - direct is possible
      // | Here    | Afar    | **Default to cheapest Road available**
      // | Afar    | Here    | REQUIRED - Afar must have used Road
      // | Afar    | Afar    | N/A - we cannot direct two AfarHuts!
      // | None    | Here    | Road must not be provided
      // | None    | Afar    | N/A - Error!
      // | None    | None    | N/A - Error!
      
      // Note that "unrelated" Huts are two Huts such that neither is
      // the other's descendant
      // Note that "disjoint" Huts are non-neighbours (they require a
      // Road to communicate)
      
      if (msg === C.skip) return;
      if (U.hasForm(msg, Error)) {
        console.log('Error reply:', foundation.formatError(msg));
        msg = { command: 'error', type: 'application', msg: msg.message };
      }
      
      if (!trgHut) throw Error('Must supply TrgHut');
      if (!srcHut && road) throw Error(`Can't omit SrcHut and provide Road`);
      if (!srcHut && reply) throw Error(`Can't omit "srcHut" but provide "reply"`);
      if (srcHut && srcHut.parHut !== trgHut && trgHut.parHut !== srcHut) throw Error(`Supplied unrelated Huts`);
      
      /// {DEBUG=
      // Do debug output if enabled
      if (foundation.getArg('debug').has('road')) {
        let lim = 150;
        let dbgStr = JSON.stringify(msg);
        if (dbgStr.count() > lim) dbgStr = dbgStr.slice(0, lim - 3) + '...';
        console.log(`--COMM ${srcHut ? srcHut.uid : '<none>'} -> ${trgHut.uid}: ${dbgStr}`);
      }
      /// =DEBUG}
      
      if (!srcHut) {
        if (trgHut.isAfar()) throw Error(`Can't tell TrgAfarHut when SrcHut is null`);
        return trgHut.hear(null, null, () => { /* Reply to null `srcHut` has no effect */ }, msg, ms);
      }
      
      if (srcHut.isAfar() && trgHut.isAfar()) throw Error('Supplied two AfarHuts');
        
      /// {BELOW=
      // BelowSrcHuts telling upwards will have their tell naturally
      // counted as a heartbeat - so their next heartbeat can wait!
      if (srcHut.isHere() && trgHut.isAfar()) srcHut.refreshTellTimeout();
      /// =BELOW}
      
      if (srcHut.isHere() && trgHut.isHere()) {
        // TODO: Conceptualize two HereHuts as NEIGHBOURS - they're
        // so close you don't need to take a Road to pass between them
        if (road) throw Error(`Provided two HereHuts but also a Road`);
        if (!reply) reply = msg => Form.tell(trgHut, srcHut, null, null, msg);
        return trgHut.hear(srcHut, null, reply, msg);
      }
      
      if (srcHut.isAfar() && trgHut.isHere()) {
        if (!road) throw Error(`Supplied AfarSrcHut but omitted Road`);
        if (!reply) reply = msg => Form.tell(trgHut, srcHut, road, null, msg);
        return trgHut.hear(srcHut, road, reply, msg, ms);
      }
      
      if (srcHut.isHere() && trgHut.isAfar()) {
        
        if (trgHut.parHut !== srcHut)
          throw Error(`Supplied HereHut -> AfarHut, but not ParHut -> SrcHut`);
        
        // This is the trickiest possibility, because if no Road was
        // provided we default to the cheapest Road
        if (!road) {
          
          // Find the cheapest available Road
          let roadedHut = srcHut.roadedHuts.get(trgHut.uid);
          let bestCost = U.int32;
          for (let possibleRoad of roadedHut.serverRoads.values()) {
            let curCost = possibleRoad.currentCost();
            if (curCost < bestCost) { road = possibleRoad; bestCost = curCost; }
          }
          
        }
        
        // Note that `road` is already implicitly linked to `trgHut`!
        // `road.tell(...)` propagates a message to `trgHut` (note
        // `road.hear.route(...)` lets us hear messages from `trgHut`)
        return road.tell(msg);
        
      }
      
      throw Error(`Couldn't communicate between Huts`);
      
    },
    
    // TODO: `heartMs` should possibly be handled by the server.
    init: function(foundation, uid, { parHut=null, heartMs=foundation.getArg('heartMs') }={}) {
      
      this.uid = uid;
      this.parHut = parHut;
      this.foundation = foundation;
      
      // Always perfer ParHut's `RecTypes` functionality!
      if (!parHut) forms.RecTypes.init.call(this);
      forms.Rec.init.call(this, (parHut || this).getType('lands.hut'), uid);
      
      // How regularly existence confirmation is required
      this.heartMs = heartMs;
      
      // The most current version this Hut has synced
      this.syncVersion = 0;
      
      // Commands mapped to handling functions
      this.roadSrcs = {};
      
      if (this.isAfar()) {
        
        /// {ABOVE= afar -> a representation of a Client
        
        // Below must communicate before timeout to stay connected
        this.dryHeartTimeout = null;
        
        // Track all Recs this AfarHut has access to
        this.recFollows = Map();
        
        // Track changes to eventually be synced for this AfarHut
        this.pendingSync = { add: {}, upd: {}, rem: {} };
        
        // This resolves when our pending sync is ready to send
        this.throttleSyncPrm = null;
        
        // The most recent version synced to Below
        this.syncTellVersion = 0;
        
        // Begin ensuring that the Client shows signs of life
        this.refreshDryTimeout();
        
        /// =ABOVE} {BELOW= afar -> a representation of our Server
        
        /// =BELOW}
        
      } else if (this.isHere()) {
        
        // Map uids to Recs to allow flat access
        this.allRecs = Map([ [ this.uid, this ] ]);
        
        // Map RecType names to the class used to represent them
        this.typeToClsFns = {};
        
        // Buffer initial syncs as long as we're missing versions
        this.earlySyncs = Map();
        
        this.roadSrc('error').route(({ hut, msg, reply }) => { /* nothing */ });
        this.roadSrc('multi').route(({ hut, msg, reply, road }) => {
          
          let { list } = msg;
          
          if (!U.isForm(list, Array)) return hut.tell({ command: 'error', type: 'invalidMultiList', orig: msg });
          
          // TODO: Would be cool if enough info were present to form a
          // multipart response when several files are requested...
          for (let item of list) this.hear(hut, road, reply, item);
          
        });
        
        /// {ABOVE=
        
        this.roadSrc('thunThunk').route(({ hut, msg, reply }) => { /* nothing */ });
        
        /// =ABOVE} {BELOW=
        
        // To anticipate latency wait LESS than `this.heartMs`
        this.safeHeartMs = Math.max(heartMs * 0.95 - 1000, heartMs - 2500);
        
        // Timeout for informing Above we're present
        this.tellHeartTimeout =  null;
        
        // The most recent version synced from Above
        this.syncHearVersion =  0;
        
        // Begin sending signs of life to Above
        this.refreshTellTimeout();
        
        // Sometimes our Above is locking some Road resource, and
        // decides to discard it without using it (e.g. a long-poll).
        // In this case the Above will use the "fizzle" command
        this.roadSrc('fizzle').route(({ hut, msg, reply }) => { /* nothing */ });
        
        // BelowHuts are always open to syncs from Above
        this.roadSrc('sync').route(({ msg }) => {
          
          let { version, content } = msg;
          if (!U.isForm(version, Number)) throw Error('Invalid "version"');
          if (Math.round(version) !== version) throw Error('Invalid "version"');
          if (!U.isForm(content, Object)) throw Error('Invalid "content"');
          if (version <= this.syncVersion) throw Error('Duplicated sync');
          
          this.earlySyncs.set(version, content);
          
          let nextVersion = this.syncVersion + 1;
          while (this.earlySyncs.has(nextVersion)) {
            this.doSync(this.earlySyncs.get(nextVersion));
            this.earlySyncs.rem(nextVersion);
            this.syncVersion = nextVersion++;
          }
          
          if (this.earlySyncs.size > 50) throw Error('Too many pending syncs');
          
        });
        
        /// =BELOW}
        
      }
      
      if (!parHut) {
        
        // If no parent, we are a ParentHut. We have a responsibility
        // to manage ChildHuts.
        
        /// {BELOW=
        // A reference to the Hut representing our Above (TODO: Are we certain there can only be 1 Above???)
        this.aboveHut = null;
        /// =BELOW}
        
        // For debugging connections
        this.roadDbgEnabled = true;
        this.roadDbgCharLimit = 150;
        
        // For managing ChildHuts
        this.roadedHutIdCnt = 0;
        this.roadedHuts = Map(); // Map a KidHut id to KidHut and connectivity
        
      }
      
    },
    desc: function() {
      
      let availability = this.isHere() ? 'Here' : 'Afar';
      let depth = this.parHut ? 'Kid' : 'Par';
      return `${availability}${depth}Hut@${this.uid}`;
      
    },
    
    getRoadedHut: function(kidHutId) { return this.roadedHuts.get(kidHutId) || null; },
    processNewRoad: function(server, hutId) {
      
      // If no `hutId` provided directly generate a stock `hutId` from
      //  an incrementing counter (to absolutely guarantee uniqueness)
      // and a random value (to ensure unpredictability)
      if (!hutId) {
        let cnt = this.roadedHutIdCnt++;
        let rnd = Math.floor(Math.random() * Math.pow(62, 8));
        hutId = cnt.encodeStr(C.base62, 8) + rnd.encodeStr(C.base62, 8);
      }
      
      let road = Tmp();
      road.hutId = hutId;
      road.desc = `Road on ${server.desc}`;
      server.decorateRoad(road); // Call only after any `hutId` is set
      road.server = server;
      
      // `server.decorateRoad` implementation must set `hear` and `tell`
      if (!road.hear) throw Error('Invalid road: missing "hear"');
      if (!road.tell) throw Error('Invalid road: missing "tell"');
      
      // The idea for drying Hut + RoadedHut is:
      // - Dry everything when all RoadedHut's Roads dry
      // - Drying the RoadedHut dries all RoadedHut's Roads
      let roadedHut = null;
      if (!this.roadedHuts.has(hutId)) {
        
        /// {BELOW=
        // Note that if a hut is BELOW *and* ABOVE, we can't assume that
        // the first Hut to connect is the Above - there will be a
        // multitude of Huts connecting, and we can't simply throw
        // Errors for each one past the first.....
        if (this.aboveHut) throw Error(`Already have an aboveHut, but ${hutId} tried to connect`);
        /// =BELOW}
        
        // Create RoadedHut, Hut, and KidHut relation
        let hut = Hut(null, hutId, { parHut: this, heartMs: this.heartMs });
        roadedHut = Tmp();
        roadedHut.hut = road.hut = hut;
        
        // Hut and RoadedHut end together
        hut.endWith(roadedHut);
        roadedHut.endWith(hut);
        
        // Reference the RoadedHut while it lives
        this.roadedHuts.set(hutId, roadedHut);
        roadedHut.endWith(() => this.roadedHuts.rem(hutId));
        
        // Track all Server => Road mappings for the RoadedHut, while it
        // lives. Note this looks like:
        //  |     roadedHut.serverRoads === Map( <server1>: <road1>, <server2>: <road2> )
        roadedHut.serverRoads = Map();
        roadedHut.endWith(() => roadedHut.serverRoads.each(road => road.end()));
        
        // TODO: Is exclamation mark needed anymore? FollowRec has a
        // better way of checking for sensitive Recs...
        // Do Record relation for this KidHut
        let kidHutType = (this.parHut || this).getType('lands.kidHut');
        Rec(kidHutType, `!kidHut@${hutId}`, { par: this, kid: hut });
        
        if (this.roadDbgEnabled) console.log(`>>JOIN ${hutId}`);
        
        /// {BELOW=
        // TODO: This seems VERY out of place! Implement in Foundation??
        this.aboveHut = hut;
        if (foundation.initData) Form.tell(this.aboveHut, this, road, null, foundation.initData);
        /// =BELOW}
        
      } else {
        
        roadedHut = this.roadedHuts.get(hutId);
        if (roadedHut.serverRoads.has(server)) throw Error(`Hut ${hutId} roaded twice on ${server.desc}`);
        
      }
      
      // Now we have a RoadedHut instance - attach this new Road!
      
      if (this.roadDbgEnabled) console.log(`>-HOLD ${hutId} on ${server.desc}`);
      
      // Listen to communication on this Road
      let routeRoad = road.hear.route(([ msg, reply, ms ]) => Form.tell(roadedHut.hut, this, road, reply, msg, ms));
      
      // Listen for the Road to finish
      road.endWith(() => {
        
        // Drying the Road cleans it up from RoadedHut's list of Roads
        roadedHut.serverRoads.rem(server);
        routeRoad.end(); // Also stop routing Road
        
        if (this.roadDbgEnabled) console.log(`<-DROP ${hutId} on ${server.desc} (${roadedHut.serverRoads.size} remaining)`);
        
        // If all Roads dry, dry the RoadedHut itself!
        if (roadedHut.serverRoads.isEmpty()) {
          roadedHut.end();
          if (this.roadDbgEnabled) console.log(`<<EXIT ${hutId}`);
        }
        
      });
      
      if (roadedHut.onn()) roadedHut.serverRoads.set(server, road);
      
      return road;
      
    },
    
    isHere: function() { return !!this.foundation; },
    isAfar: function() { return !this.foundation; },
    
    roadSrc: function(command, ...args) {
      if (args.length) throw Error(`Supplied more than 1 parameter to "roadSrc"`);
      if (!this.roadSrcs.has(command)) {
        this.roadSrcs[command] = Src();
        this.roadSrcs[command].desc = `Hut ComSrc for "${command}"`;
      }
      return this.roadSrcs[command];
    },
    hear: async function(srcHut, road, reply, msg, ms=foundation.getMs()) {
      
      if (!reply) throw Error(`Missing "reply"`);
      
      /// {ABOVE=
      if (srcHut && srcHut.isAfar()) srcHut.refreshDryTimeout();
      /// =ABOVE}
      
      let command = msg.command;
      if (srcHut && srcHut.roadSrcs.has(command)) return srcHut.roadSrcs[command].send({ srcHut, trgHut: this, road, msg, reply, ms });
      if (this.roadSrcs.has(command)) return this.roadSrcs[command].send({ srcHut, trgHut: this, road, msg, reply, ms });
      
      /// {BELOW=
      throw Error(`Failed to handle command: ${JSON.stringify(msg)}`);
      /// =BELOW}
      
      let resp = { command: 'error', type: 'invalidCommand', orig: msg };
      return reply ? reply(resp) : Hut.tell(this, srcHut, road, null, resp);
      
    },
    
    // TODO: I think it's bad design to allow mapping to a function that
    // returns a class. I think it makes more sense to force a 1-1
    // mapping between types and classes; map to the class itself, not
    // a function that can return one of many classes!
    // Fly is using functions that decide on a variety of classes for a
    // given rec type, but I think this logic should occur without any
    // help from hinterlands.
    addTypeClsFn: function(name, fn) {
      if (this.typeToClsFns.has(name)) throw Error(`Tried to overwrite class function for "${name}"`);
      this.typeToClsFns[name] = fn;
    },
    addTypeClsFns: function(obj) { for (let [ name, fn ] of obj) this.addTypeClsFn(name, fn); },
    getCategorizedRecs: function() {
      let ret = {};
      for (let rec of this.allRecs.values()) {
        if (!ret.has(rec.type.name)) ret[rec.type.name] = [];
        ret[rec.type.name].push(rec);
      }
      return ret;
    },
    getType: function(...args) {
      if (this.isAfar()) throw Error(`${this.desc()} is an AfarHut; it cannot do getType`);
      
      // Always prefer a ParHut's types. This also helps manage any
      // child Huts who happen to be running in the same process as
      // their parent.
      if (this.parHut) return this.parHut.getType(...args);
      
      // Return `RecTypes` functionality
      return forms.RecTypes.getType.call(this, ...args);
    },
    getNextRecUid: function() { return this.foundation.getUid(); },
    getRecCls: function(name, mems, val) {
      if (this.typeToClsFns.has(name)) return this.typeToClsFns[name](val, mems);
      return forms.RecTypes.getRecCls.call(this, name, mems, val);
    },
    trackRec: function(rec) {
      if (!U.hasForm(rec, Rec)) throw Error(`Can't track; ${U.getFormName(rec)} isn't a Rec!`);
      this.allRecs.set(rec.uid, rec);
      rec.endWith(() => this.allRecs.rem(rec.uid));
      return rec;
    },
    createRec: function(...args) {
      if (this.isAfar()) {
        
        // Clients follow any Recs they create
        let rec = this.parHut.createRec(...args);
        return (this.followRec(rec), rec);
        
      } else {
        
        // Server simply creates the Rec
        return this.trackRec(forms.RecTypes.createRec.call(this, ...args));
        
      }
    },
    doSync: function({ add=[], upd=[], rem=[] }) {
      
      // {
      //   add: [
      //     { type: 'app.myThing1', uid: '001Au2s8', mems: [], val: null },
      //     { type: 'app.myThing2', uid: '0011Au2s9', mems: [ '001Au2s8' ], val: null },
      //     { type: 'app.myThing1', uid: null, mems: [], val: 'proposed!' }
      //   ],
      //   upd: [
      //     { uid: '001Au2f1', val: 'newVal for 001Au2f1' },
      //     { uid: '001Au2f2', val: 'newVal for 001Au2f2' }
      //   ],
      //   rem: [
      //     '001Au2h3',
      //     '001Au2h4',
      //     '001Au2h5',
      //     '001Au2h6'
      //   ]
      // }
      
      let waiting = add;
      while (waiting.length) {
        
        let attempt = waiting;
        waiting = [];
        
        // Try to fulfill this attempt
        for (let addRec of attempt) {
          
          if (this.allRecs.has(addRec.uid)) {
            // // TODO: Here's how this should look in the future:
            // throw HutError(null, `Duplicate id: ${addRec.uid}`, {
            //   scope: 'hinterlands:Hut.prototype.doSync',
            //   context: { add, upd, rem }
            // });
            // HutError's 1st param indicates a "causing Error", which
            // optionally describes an error that later occurred from
            // this scope
            console.log(add, addRec);
            throw Error(`Duplicate id: ${addRec.uid}`);
          }
          
          let mems = null;
          if (U.isForm(addRec.mems, Object)) {
            mems = {};
            for (let term in addRec.mems) {
              let uid = addRec.mems[term];
              if (!this.allRecs.has(uid)) { mems = null; break; }
              mems[term] = this.allRecs.get(uid);
            }
          } else if (U.isForm(addRec.mems, Array)) {
            mems = [];
            for (let uid in addRec.mems) {
              if (!this.allRecs.has(uid)) { mems = null; break; }
              mems.push(this.allRecs.get(uid));
            }
          } else {
            throw Error(`Invalid type for "mems": ${U.getFormName(addRec.mems)}`);
          }
          
          if (!mems) { waiting.push(addRec); continue; } // Reattempt soon
          
          // All members are available - create the Rec!
          let recType = (this.parHut || this).getType(addRec.type);
          let RecCls = this.getRecCls(addRec.type, addRec.mems, addRec.val);
          this.trackRec(RecCls(recType, addRec.uid || this.getNextRecUid(), mems, addRec.val));
          
        }
        
        // If no attempted item succeeded we can't make progress
        if (waiting.length === attempt.length) {
          console.log('RECS SUCCESSFULLY CREATED:', this.allRecs);
          console.log('ALL RECS ATTEMPTED TO ADD:', add.map(({ uid }) => uid));
          console.log(`RECS THAT WEREN'T ADDED:`, waiting);
          
          console.log(JSON.stringify(add, null, 2));
          throw Error(`Unresolvable Rec dependencies`);
        }
        
      }
      
      for (let { uid, val } of upd) {
        if (!this.allRecs.has(uid)) throw Error(`Tried to update non-existent Rec @ ${uid}`);
        let rec = this.allRecs.get(uid);
        if (!U.isForm(val, Object) || !U.isForm(rec.getVal(), Object)) {
          rec.setVal(val);
        } else {
          rec.objVal(val);
        }
      }
      
      for (let uid of rem) {
        if (!this.allRecs.has(uid)) continue;
        //if (!this.allRecs.has(uid)) throw Error(`Tried to remove non-existent Rec @ ${uid}`); // TODO: Enable this?
        this.allRecs.get(uid).end();
      }
      
      // Basing the result value's order on `add` guarantees Recs are
      // returned in the same order initially specified, even if they
      // became unordered from churning
      return add.map(({ uid }) => this.allRecs.get(uid));
      
    },
    
    /// {ABOVE=
    
    // Handle syncing for AfarAboveHuts
    isFollowable: function(rec) {
      // Returns false for any Recs which may exist in the ABOVE
      // heirarchy, but are sensitive and not to be synced BELOW
      return !U.hasForm(rec, Hut) || rec === this.parHut || rec === this;
    },
    toSync: function(type, rec, val=null) {
      
      if (!this.pendingSync.has(type)) throw Error(`Invalid type: ${type}`);
      let { add, upd, rem } = this.pendingSync;
      
      // add, rem: cancel out! No information on Rec is sent
      // rem, add: cancel out! Rec already present Below, and stays
      
      // Can add and rem occur together? NO  (conflicting messages!)
      // Can add and upd occur together? NO  (redundant!)
      // Can rem and upd occur together? YES (e.g. animation upon deletion)
      
      if (type === 'add') {
        if (rem.has(rec.uid)) delete rem[rec.uid];
        else                  add[rec.uid] = (delete upd[rec.uid], rec);
      } else if (type === 'rem') {
        if (add.has(rec.uid)) delete add[rec.uid];
        else                  rem[rec.uid] = rec;
      } else if (type === 'upd') {
        if (add.has(rec.uid)) return; // No "upd" necessary: already adding!
        
        if (!upd.has(rec.uid) || !U.isForm(upd[rec.uid], Object) || !U.isForm(val, Object)) {
          upd[rec.uid] = val;
        } else {
          upd[rec.uid].gain(val);
        }
      }
      
      this.requestSendPendingSync();
      
    },
    createThrottleSyncPrm: function() { return Promise(r => foundation.queueTask(r)); },
    requestSendPendingSync: function(ctxErr=null) {
      
      // Schedules Below to be synced if not already scheduled
      
      if (this.throttleSyncPrm) return; // A request to sync already exists
      this.throttleSyncPrm = (async (ctxErr=Error('')) => {
        
        await this.createThrottleSyncPrm();
        this.throttleSyncPrm = null;
        
        // Hut may have dried between scheduling and executing sync
        if (this.off()) return;
        
        let updateTell = this.consumePendingSync(ctxErr);
        if (updateTell) Form.tell(this.parHut, this, null, null, updateTell);
        
      })(ctxErr);
      
    },
    resetSyncState: function() {
      
      // Reset version and current delta, and recalculate all adds
      this.syncTellVersion = 0;
      this.pendingSync = this.pendingSync.map(v => ({}));
      for (let [ rec, f ] of this.recFollows) this.toSync('add', rec);
      
    },
    consumePendingSync: function(ctxErr=Error('')) {
      
      // Creates tell to sync the BelowHut and modifies its
      // representation to be considered fully up-to-date
      let add = this.pendingSync.add.toArr(r => ({
        type: r.type.name, uid: r.uid, val: r.getVal(),
        
        // Redirect all references from ParAboveHut to KidBelowHut
        mems: r.mems.map(mem => this.isFollowable(mem)
          ? (mem === this.parHut ? this.uid : mem.uid)
          : C.skip
        )
        
      }));
      
      let upd = this.pendingSync.upd.toArr((val, uid) => ({ uid, val }));
      let rem = this.pendingSync.rem.toArr(r => r.uid);
      
      let content = {};
      if (!add.isEmpty()) content.add = add;
      if (!upd.isEmpty()) content.upd = upd;
      if (!rem.isEmpty()) content.rem = rem;
      if (content.isEmpty()) return null;
      
      this.pendingSync = this.pendingSync.map(v => ({}));
      
      return { command: 'sync', version: ++this.syncTellVersion, content };
      
    },
    
    // Rec Following
    modRecFollowStrength: function(rec, delta) {
      
      // Ignore inactive Recs
      if (rec.off()) return;
      
      // Prevent follows on sensitive Recs
      if (!this.isFollowable(rec)) return;
      
      // Prevent Huts from following themselvess
      if (rec === this) return;
      
      let fol = this.recFollows.get(rec);
      let str0 = fol ? fol.strength : 0;
      let str1 = str0 + delta;
      
      if (str0 <= 0 && str1 > 0) {
        
        // The Rec wasn't Followed, and now it is!
        
        let followTmp = Tmp();
        fol = { strength: str1, followTmp };
        
        this.recFollows.set(rec, fol);
        followTmp.endWith(() => this.recFollows.rem(rec));
        
        this.toSync('add', rec);
        followTmp.endWith(() => this.toSync('rem', rec));
        
        let updRecRoute = rec.valSrc.route(v => this.toSync('upd', rec, v));
        followTmp.endWith(updRecRoute);
        
        let recDryRoute = rec.endWith(followTmp, 'tmp');
        followTmp.endWith(recDryRoute);
        
      } else if (str0 > 0 && str1 > 0) {
        
        // The Rec was, and is still Followed
        fol.strength = str1;
        
      } else if (str0 > 0 && str1 <= 0) {
        
        // The Rec was Followed; now it isn't
        fol.followTmp.end();
        fol = null;
        
      }
      
    },
    
    // Listening for signs of life from BelowHut
    refreshDryTimeout: function() {
      clearTimeout(this.dryHeartTimeout);
      this.dryHeartTimeout = setTimeout(() => this.end(), this.heartMs); 
    },
    
    followRec: function(rec) {
      
      if (rec.off()) return; // Always ignore any Recs which may be off
      
      let tmp = Tmp(); tmp.rec = rec;
      
      for (let r of rec.getRecJurisdiction()) this.modRecFollowStrength(r, +1);
      tmp.endWith(() => { for (let r of rec.getRecJurisdiction()) this.modRecFollowStrength(r, -1); });
      
      let route = rec.route(() => tmp.end());
      tmp.endWith(route);
      
      return tmp;
      
    },
    
    /// =ABOVE} {BELOW=
    
    tell: function(msg) {
      if (!this.aboveHut) throw Error(`No aboveHut; can't tell`);
      return Form.tell(this, this.aboveHut, null, null, msg);
    },
    
    // Sending signs of life to AboveHut
    refreshTellTimeout: function() {
      clearTimeout(this.tellHeartTimeout);
      this.tellHeartTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), this.safeHeartMs);
    },
    
    /// =BELOW}
    
    enableAction: function(command, fn) {
      
      // To be run both ABOVE and BELOW.
      // The dual purpose is to give BELOW a Src for sending Tells, and
      // attach a RoadSrc to ABOVE for hearing such Tells. Note that for
      // a BETWEEN hut a RoadSrc is established and routed, but that
      // route always leads to a command proxying the action upwards.
      // This means that performing an action on a BETWEEN hut overall
      // performs the action ABOVE.
      
      /// {ABOVE=
      if (this.roadSrcs.has(command)) throw Error(`Hut ${this.uid} already has Tell Sender for "${command}"`);
      /// =ABOVE}
      
      let tmp = Tmp();
      let [ srcHut, trgHut ] = [ null, this ];
      
      /// {BELOW=
      
      tmp.act = msg => Hut.tell(this, this.aboveHut, null, null, { command, ...msg });
      tmp.endWith(() => tmp.act = () => { throw Error(`Action unavailable`); });
      
      // This is a bit of a hack to cover the BETWEEN case. ABOVE will
      // set `tmp.act` to Tell `command` from `srcHut` -> `trgHut`, and
      // route any such `command` to `fn`. If we are *not* BELOW, the
      // following lines don't execute, with the result being:
      // 1. The Tell is from a null SrcHut to `this` Hut, indicating
      //    that the action was self-initiated (e.g. `setTimeout`).
      // 2. `fn` is the direct logic itself (to be called as a direct
      //    result of the self-initiated action)
      // If we *are* BETWEEN, both BELOW and ABOVE will execute. Before
      // ABOVE code, the following lines execute. The purpose is to
      // differentiate the result from the ABOVE-only case:
      // 1. The Tell is from `this` Hut to our AboveHut. There will
      //    certainly be an AboveHut, because we are only BETWEEN.
      // 2. `fn` is not direct logic, but rather a proxy to perform the
      //    action on the AboveHut! If the action was self-initiated
      //    (which is odd for a BETWEEN Hut, but I don't want to rule
      //    out the possibility) then `tmp.act(...)` performs `Hut.tell`
      //    in an effort to run the action ABOVE. If the action is
      //    initiated from BELOW then the RoadSrc will receive the
      //    request from BELOW, and call `fn`, which calls `tmp.act`.
      //    Due to the nature of `tmp.act`, in the case also the action
      //    will be forwarded to be performed ABOVE!
      fn = msg => tmp.act(msg);
      [ srcHut, trgHut ] = [ this, this.aboveHut ];
      
      /// =BELOW} {ABOVE=
      
      // Provide a convenience function to perform the action as if a
      // `null` SrcHut enacted it. This style allows all changes to Rec
      // data to be externalized nicely. When we simply say
      // `rec.objVal({ action: 'occurred' })` the reason for the action
      // occurring becomes unrecordable, and state-tracing, for example
      // reply-style persistence, goes out of sync. Prefer this instead:
      //    |     
      //    |     let ts = dep(hut.enableAction('pfx.action', () => {
      //    |       rec.objVal({ action: 'occurred' });
      //    |     }));
      //    |     dep(someReason.route(() => ts.act()));
      //    |     
      // This style successfully captures the reason behind the action,
      // and makes the action generically accessible via "pfx.action".
      tmp.act = msg => Hut.tell(srcHut, trgHut, null, null, { ...msg, command });
      
      // Route any sends from a RoadSrc so that they call `fn`. Note
      // that `U.safe` allows either a value or an Error to be returned
      // (and makes it so that `return Error(...)` behaves the same as
      // `throw Error` within `fn`). Either the result or Error will be
      // used as a reply. Note that if the result is `C.skip`, `reply`
      // will ensure that no value ever gets sent.
      let hearSrc = this.roadSrcs[command] = Src(); hearSrc.desc = `Hut TellSender for "${command}"`;
      tmp.endWith(() => delete this.roadSrcs[command]);
      tmp.endWith(hearSrc.route(({ msg, reply }) => {
        let result = U.safe(() => fn(msg));
        
        if (U.hasForm(result, Error)) foundation.queueTask(() => { throw result; });
        
        /// {DEBUG= // TODO: this is DEBUG inside ABOVE; nesting not supported yet
        if (result != null && !U.isForm(result, Object, Array, String))
          if (![ U.setup.Keep, Error ].find(Form => U.hasForm(result, Form)).found)
            throw Error(`Action for "${command}" returned invalid type ${U.getFormName(result)}`);
        /// =DEBUG}
        
        reply(result);
      }));
      
      /// =ABOVE} 
      
      return tmp;
      
    },
    
    cleanup: function() {
      forms.Rec.cleanup.call(this);
      /// {BELOW=
      clearTimeout(this.tellHeartTimeout);
      /// =BELOW}
    }
    
  })});
  
  return { Hut };
  
};
