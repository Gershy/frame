global.rooms.hinterlands = async foundation => {
  
  let recordRoom = await foundation.getRoom('record');
  
  let { RecTypes, RecType, Rec } = recordRoom;
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let Hut = U.inspire({ name: 'Hut', insps: { RecTypes, Rec }, methods: (insp, Insp) => ({
    
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
      
      if (!trgHut) throw Error('Must supply TrgHut');
      if (!srcHut && road) throw Error(`Can't omit SrcHut and provide Road`);
      if (srcHut && srcHut.parHut !== trgHut && trgHut.parHut !== srcHut) throw Error(`Supplied unrelated Huts`);
      
      // Debug output if any ParHut has debug enabled
      let [ dbgParHut=null ] = [ srcHut, trgHut ].find(h => h && h.isHere() && h.roadDbgEnabled) || [];
      if (dbgParHut) console.log(`--COMM ${srcHut ? srcHut.uid : '<none>'} -> ${trgHut.uid}: ${dbgParHut.dbgRoadsItem(msg)}`);
      
      if (!srcHut) {
        if (trgHut.isAfar()) throw Error(`Can't tell TrgAfarHut when SrcHut is null`);
        if (road) throw Error(`Can't omit "srcHut" but provide "road"`);
        if (reply) throw Error(`Can't omit "srcHut" but provide "reply"`);
        return trgHut.hear(null, null, () => { throw Error('Can\'t reply'); }, msg, ms);
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
        if (!reply) reply = msg => Insp.tell(trgHut, srcHut, null, null, msg);
        return trgHut.hear(srcHut, null, reply, msg);
      }
      
      if (srcHut.isAfar() && trgHut.isHere()) {
        if (!road) throw Error(`Supplied AfarSrcHut but omitted Road`);
        if (!reply) reply = msg => Insp.tell(trgHut, srcHut, road, null, msg);
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
        // `road.hear.route(...)` would be used to receive messages
        // from `trgHut`)
        return road.tell(msg);
        
      }
      
      throw Error(`Couldn't communicate between Huts`);
      
    },
    
    init: function(foundation, uid, { parHut=null, heartMs=15 * 1000, term=null }={}) {
      
      this.uid = uid;
      this.parHut = parHut;
      this.foundation = foundation;
      this.typeToClsFns = {};
      
      // Only ParHuts truly have the capabilities of `RecTypes`
      if (!parHut) insp.RecTypes.init.call(this);
      
      let hutType = (parHut || this).getType('lands.hut');
      insp.Rec.init.call(this, hutType, uid);
      
      // How regularly communication needed to confirm existence
      this.heartMs = heartMs;
      if (this.heartMs === 30000) throw Error('WHY THO');
      
      // The most current version this Hut has synced
      this.syncVersion = 0;
      
      // Commands mapped to handling functions
      this.roadNozzes = {};
      
      if (this.isAfar()) {
        
        /// {ABOVE= remote -> a representation of a Client
        
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
        
        /// =ABOVE} {BELOW= remote -> a representation of our Server
        
        /// =BELOW}
        
      } else if (this.isHere()) {
        
        // Map uids to Recs to allow flat access
        this.allRecs = Map();
        this.allRecs.set(this.uid, this);
        
        // Buffer pre-mature syncs until gap is filled
        this.earlySyncs = Map();
        
        this.roadNozz('error').route(({ hut, msg, reply }) => { /* nothing */ });
        this.roadNozz('multi').route(({ hut, msg, reply, road }) => {
          
          let { list } = msg;
          
          if (!U.isType(list, Array)) return hut.tell({ command: 'error', type: 'invalidMultiList', orig: msg });
          
          // TODO: Would be cool if enough info were present to form a
          // multipart response when several files are requested...
          for (let item of list) this.hear(hut, road, reply, item);
          
        });
        
        /// {ABOVE=
        
        this.roadNozz('thunThunk').route(({ hut, msg, reply }) => { /* nothing */ });
        
        /// =ABOVE} {BELOW=
        
        // To anticipate latency wait LESS than `this.heartMs`
        this.safeHeartMs = Math.max(heartMs * 0.85 - 1000, heartMs - 2000);
        
        // Timeout for informing Above we're present
        this.tellHeartTimeout =  null;
        
        // The most recent version synced from Above
        this.syncHearVersion =  0;
        
        // Begin sending signs of life to Above
        this.refreshTellTimeout();
        
        // Sometimes our Above is locking some Road resource, and
        // decides to discard it without using it (e.g. a long-poll).
        // In this case the Above will use the "fizzle" command
        this.roadNozz('fizzle').route(({ hut, msg, reply }) => { /* nothing */ });
        
        // BelowHuts are always open to syncs from Above
        this.roadNozz('sync').route(({ msg }) => {
          
          let { version, content } = msg;
          if (!U.isType(version, Number)) throw Error('Invalid "version"');
          if (Math.round(version) !== version) throw Error('Invalid "version"');
          if (!U.isType(content, Object)) throw Error('Invalid "content"');
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
      
      let access = this.isHere() ? 'Here' : 'Afar';
      
      let maturity = this.parHut ? 'Kid' : 'Par';
      
      let bearing = [];
      /// {ABOVE=
      bearing.push('Above');
      /// =ABOVE} {BELOW=
      bearing.push('Below');
      /// =BELOW}
      
      bearing = bearing.length === 0
        ? 'UnknownBearing'
        : ((bearing.length > 1) ? 'Between' : bearing[0]);
      
      return `${access}${maturity}${bearing}Hut @ ${this.uid}`;
      
    },
    
    dbgRoadsItem: function(item) {
      let ret = JSON.stringify(item);
      return (ret.length > this.dbgLimit) ? ret.substr(0, this.roadDbgCharLimit - 3) + '...' : ret;
    },
    getRoadedHut: function(kidHutId) { return this.roadedHuts.get(kidHutId) || null; },
    processNewRoad: function(server, decorateRoad) {
      
      let road = Drop(defDrier());
      road.desc = `Road on ${server.desc}`;
      decorateRoad(road); // This can apply a HutId
      server.decorateRoad(road);
      road.server = server;
      
      if (!road.hear) throw Error('Invalid road: missing "hear"');
      if (!road.tell) throw Error('Invalid road: missing "tell"');
      
      if (!road.hutId) road.hutId = ''
        + U.base62(this.roadedHutIdCnt++).padHead(8, '0')
        + U.base62(Math.floor(Math.random() * Math.pow(62, 8))).padHead(8, '0')
      
      let hutId = road.hutId, roadedHut = null;
      
      // The idea for drying Hut + RoadedHut is:
      // - Dry everything when all RoadedHut's Roads dry
      // - Drying the RoadedHut dries all RoadedHut's Roads
      
      if (!this.roadedHuts.has(hutId)) {
        
        /// {BELOW=
        // Note that if a hut is BELOW *and* ABOVE, we can't assume
        // that the first Hut to connect is the Above - there will be
        // a multitude of Huts connecting, and we can't simply throw
        // Errors for each one past the first.....
        if (this.aboveHut) throw Error(`Already have an aboveHut, but ${hutId} tried to connect`);
        /// =BELOW}
        
        // Create a new RoadedHut, Hut, and KidHut relation
        
        // The RoadedHut drying causes Hut and all Roads to dry
        roadedHut = Drop(defDrier(), () => {
          this.roadedHuts.rem(hutId);
          for (let [ s, road ] of roadedHut.serverRoads) road.dry();
          roadedHut.hut.dry();
        });
        roadedHut.hut = road.hut = Hut(null, hutId, { parHut: this, heartMs: this.heartMs });
        roadedHut.serverRoads = Map(); // Map Servers to the single Road for that Server
        this.roadedHuts.set(hutId, roadedHut);
        
        // Drying the Hut causes the RoadedHut to dry
        roadedHut.hut.drierNozz().route(() => roadedHut.dry());
        
        // Do Record relation for this KidHut
        let kidHutType = (this.parHut || this).getType('lands.kidHut');
        Rec(kidHutType, `!kidHut@${hutId}`, { par: this, kid: roadedHut.hut });
        
        if (this.roadDbgEnabled) console.log(`>>JOIN ${hutId}`);
        
        this.aboveHut = roadedHut.hut;
        if (U.initData) Insp.tell(this.aboveHut, this, road, null, U.initData);
        
      } else {
        
        roadedHut = this.roadedHuts.get(hutId);
        if (roadedHut.serverRoads.has(server)) throw Error(`Hut ${hutId} roaded twice on ${server.desc}`);
        
      }
      
      // Now we have a RoadedHut instance - attach this new Road!
      
      if (this.roadDbgEnabled) console.log(`>-HOLD ${hutId} on ${server.desc}`);
      
      // Listen to communication on this Road
      let routeRoad = road.hear.route(([ msg, reply, ms ]) => Insp.tell(roadedHut.hut, this, road, reply, msg, ms));
      
      // Listen for the Road to finish
      road.drierNozz().route(() => {
        
        // Drying the Road cleans it up from RoadedHut's list of Roads
        roadedHut.serverRoads.rem(server);
        routeRoad.dry(); // Also stop routing Road
        
        if (this.roadDbgEnabled) console.log(`<-DROP ${hutId} on ${server.desc} (${roadedHut.serverRoads.size} remaining)`);
        
        if (roadedHut.serverRoads.isEmpty()) {
          
          // If *all* Roads are dry, the RoadedHut no longer exists
          // from our perspective - dry it!
          
          roadedHut.dry();
          if (this.roadDbgEnabled) console.log(`<<EXIT ${hutId}`);
          
        }
      });
      
      if (roadedHut.isWet()) roadedHut.serverRoads.set(server, road);
      
      return road;
      
    },
    
    isHere: function() { return !!this.foundation; },
    isAfar: function() { return !this.foundation; },
    
    roadNozz: function(command, ...args) {
      if (args.length) throw Error(`Supplied more than 1 parameter to "roadNozz"`);
      if (!this.roadNozzes.has(command)) {
        this.roadNozzes[command] = Nozz();
        this.roadNozzes[command].desc = `Hut ComNozz for "${command}"`;
      }
      return this.roadNozzes[command];
    },
    hear: async function(srcHut, road, reply, msg, ms=foundation.getMs()) {
      
      if (!reply) throw Error(`Missing "reply"`);
      
      /// {ABOVE=
      if (srcHut.isAfar()) srcHut.refreshDryTimeout();
      /// =ABOVE}
      
      let command = msg.command;
      if (srcHut && srcHut.roadNozzes.has(command)) return srcHut.roadNozzes[command].drip({ srcHut, trgHut: this, road, msg, reply, ms });
      if (this.roadNozzes.has(command)) return this.roadNozzes[command].drip({ srcHut, trgHut: this, road, msg, reply, ms });
      
      let resp = { command: 'error', type: 'invalidCommand', orig: msg };
      if (reply) return reply(resp);
      return Hut.tell(this, srcHut, road, null, resp);
      
    },
    
    addTypeClsFn: function(name, fn) {
      if (this.typeToClsFns.has(name)) throw Error(`Tried to overwrite class function for "${name}"`);
      this.typeToClsFns[name] = fn;
    },
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
      return insp.RecTypes.getType.call(this, ...args);
    },
    getNextRecUid: function() { return this.foundation.getUid(); },
    getRecCls: function(name, mems, val) {
      if (this.typeToClsFns.has(name)) return this.typeToClsFns[name](val, mems);
      return insp.RecTypes.getRecCls.call(this, name, mems, val);
    },
    trackRec: function(rec) {
      if (!U.isInspiredBy(rec, Rec)) throw Error(`Can't track; ${U.nameOf(rec)} isn't a Rec!`);
      this.allRecs.set(rec.uid, rec);
      rec.drierNozz().route(() => this.allRecs.rem(rec.uid));
      return rec;
    },
    createRec: function(name, mems, val) {
      return this.trackRec(insp.RecTypes.createRec.call(this, name, mems, val));
    },
    doSync: function({ add=[], upd=[], rem=[] }) {
      
      // TODO: If Below is allowed to create Recs how do we ensure
      // that Rec uids never overlap?? Best way would be for Below
      // to send a "ProposedRecUpd" Above, Above processes it
      // forming an "ApprovedRecUpd", and then Above performs the
      // ApprovedRecUpd, syncing any changes with following Belows as
      // usual.
      
      /*
      {
        add: [
          { type: 'app.myThing1', uid: '001Au2s8', mems: [], val: null },
          { type: 'app.myThing2', uid: '0011Au2s9', mems: [ '001Au2s8' ], val: null },
          { type: 'app.myThing1', uid: null, mems: [], val: 'proposed!' }
        ],
        upd: [
          { uid: '001Au2f1', val: 'newVal for 001Au2f1' },
          { uid: '001Au2f2', val: 'newVal for 001Au2f2' }
        ],
        rem: [
          '001Au2h3',
          '001Au2h4',
          '001Au2h5',
          '001Au2h6'
        ]
      }
      */
      
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
            // this scope!
            console.log(add, addRec);
            throw Error(`Duplicate id: ${addRec.uid}`);
          }
          
          let mems = null;
          if (U.isType(addRec.mems, Object)) {
            mems = {};
            for (let term in addRec.mems) {
              let uid = addRec.mems[term];
              if (!this.allRecs.has(uid)) { mems = null; break; }
              mems[term] = this.allRecs.get(uid);
            }
          } else if (U.isType(addRec.mems, Array)) {
            mems = [];
            for (let uid in addRec.mems) {
              if (!this.allRecs.has(uid)) { mems = null; break; }
              mems.push(this.allRecs.get(uid));
            }
          } else {
            throw Error(`Invalid type for "mems": ${U.nameOf(addRec.mems)}`);
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
          console.log('RECS THAT WEREN\'T ADDED:', waiting);
          
          console.log(JSON.stringify(add, null, 2));
          throw Error(`Unresolvable Rec dependencies`);
        }
        
      }
      
      for (let { uid, val } of upd) {
        if (!this.allRecs.has(uid)) throw Error(`Tried to update non-existent Rec @ ${uid}`);
        let rec = this.allRecs.get(uid);
        if (!U.isType(val, Object) || !U.isType(rec.val, Object)) {
          rec.setVal(val);
        } else {
          rec.dltVal(val);
        }
      }
      
      for (let uid of rem) {
        // TODO: Take this off, the play Fly and lose all lives. An
        // invalid "rem" sync will be performed:
        if (!this.allRecs.has(uid)) continue;
        //if (!this.allRecs.has(uid)) throw Error(`Tried to remove non-existent Rec @ ${uid}`);
        this.allRecs.get(uid).dry();
      }
      
      // Using `map` to return here ensures Rec instances are received
      // in the same order they were initially specified even if they
      // became unordered from churning
      return add.map(({ uid }) => this.allRecs.get(uid));
      
    },
    
    /// {ABOVE=
    
    // Handle syncing for AfarAboveHuts
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
        
        if (!upd.has(rec.uid) || !U.isType(upd[rec.uid], Object) || !U.isType(val, Object)) {
          upd[rec.uid] = val;
        } else {
          upd[rec.uid].gain(val);
        }
      }
      
      this.requestSendPendingSync();
      
    },
    makeThrottleSyncPrm: function() { return Promise(r => foundation.queueTask(r)); },
    requestSendPendingSync: function(ctxErr=null) {
      
      // Schedules Below to be synced if not already scheduled
      
      if (this.throttleSyncPrm) return; // A request to sync already exists
      this.throttleSyncPrm = (async (ctxErr=Error('')) => {
        
        await this.makeThrottleSyncPrm();
        this.throttleSyncPrm = null;
        
        // Hut may have dried between scheduling and executing sync
        if (this.isDry()) return;
        
        let updateTell = this.consumePendingSync(ctxErr);
        if (updateTell) Insp.tell(this.parHut, this, null, null, updateTell);
        
      })(ctxErr);
      
    },
    resetSyncState: function() {
      
      // Reset version and current delta, and recalculate all adds
      this.syncTellVersion = 0;
      this.pendingSync = this.pendingSync.map(v => ({}));
      this.recFollows.forEach((f, rec) => this.toSync('add', rec));
      
    },
    consumePendingSync: function(ctxErr=Error('')) {
      
      // Creates tell to sync the BelowHut and modifies its
      // representation to be considered fully up-to-date
      let add = this.pendingSync.add.toArr(r => ({
        type: r.type.name, uid: r.uid, val: r.val,
        
        // Redirect all references from ParAboveHut to KidBelowHut
        mems: r.mems.map(({ uid }) => uid === this.parHut.uid ? this.uid : uid)
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
      
      let fol = this.recFollows.get(rec);
      let str0 = fol ? fol.strength : 0;
      let str1 = str0 + delta;
      
      if (str1 > str0 && rec.isDry()) throw Error(`Tried to Follow dry ${rec.type.name}@${rec.uid}`);
      
      if (str0 <= 0 && str1 > 0) {
        
        // The Rec wasn't Followed, and now it is!
        
        this.toSync('add', rec);
        let updRecRoute = rec.route(v => this.toSync('upd', rec, v));
        let recDryRoute = rec.drierNozz().route(() => followDrop.dry());
        
        let followDrop = Drop(null, () => {
          this.toSync('rem', rec);
          updRecRoute.dry();
          recDryRoute.dry();
          this.recFollows.rem(rec);
        });
        
        fol = { strength: str1, followDrop };
        this.recFollows.set(rec, fol);
        
      } else if (str0 > 0 && str1 > 0) {
        
        // The Rec was, and is still Followed
        fol.strength = str1;
        
      } else if (str0 > 0 && str1 <= 0) {
        
        // The Rec was Followed; now it isn't
        fol.followDrop.dry();
        fol = null;
        
      }
      
      return fol;
      
    },
    followRec: function(rec) {
      // TODO: Should we follow permissions recursively, instead of just
      // the direct descendants, for `rec`?
      // E.g. `rec.mems.toArr(v=>v)[0]` could have further member Recs
      
      let recs = [ rec, ...rec.mems.toArr(r => r) ]
        .map(rec => (rec.uid[0] !== '!' && rec.uid !== this.uid) ? rec : C.skip);
      
      for (let rec of recs) this.modRecFollowStrength(rec, +1);
      return Drop(null, () => { for (let rec of recs) this.modRecFollowStrength(rec, -1); });
    },
    
    // Listening for signs of life from BelowHut
    refreshDryTimeout: function() {
      clearTimeout(this.dryHeartTimeout);
      this.dryHeartTimeout = setTimeout(() => this.dry(), this.heartMs); 
    },
    
    /// =ABOVE} {BELOW=
    
    tell: function(msg) {
      if (!this.aboveHut) throw Error(`No aboveHut; can't tell`);
      return Insp.tell(this, this.aboveHut, null, null, msg);
    },
    
    // Sending signs of life to AboveHut
    refreshTellTimeout: function() {
      clearTimeout(this.tellHeartTimeout);
      this.tellHeartTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), this.safeHeartMs);
    },
    
    /// =BELOW}
    
    onceDry: function() {
      insp.Rec.onceDry.call(this);
    }
    
  })});
  
  return { Hut };
  
};
