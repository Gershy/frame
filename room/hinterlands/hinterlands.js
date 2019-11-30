U.buildRoom({
  name: 'hinterlands',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    // NOTE: Recs generated by Below need custom uids to avoid conflicts
    // inside `allRecs`. If Below has a "hut" Rec #00000152 - Above will
    // eventually sync a Rec with the same uid. That means when Below
    // will look for a member Rec with uid #00000152, and consider that
    // Rec to be a member of the incoming GroupRec - since it isn't
    // possible for the GroupRec to have a Member with RecType of "hut", 
    // an error will be thrown: unexpected RecType received!
    
    // NOTE: Recs are created in 3 different manners:
    // 1 - Arch: May be referenced by other Huts; never dries. Created
    // without `Lands.prototype.createRec`, but still tracked within
    // `lands.allRecs`
    // 2 - ArchHut, Hut: May not be referenced by other Huts. Only dry
    // when the corresponding Cpu is rejected (for bad behaviour, etc),
    // or when the corresponding Cpu shuts. Are created without the use
    // of `Lands.prototype.createRec`; aren't tracked in `lands.allRecs`
    // 3 - All other Recs: May be referenced, and may dry up for any
    // reason! So we use `Lands.prototype.createRec`.
    
    let { Rec, Rel } = record;
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
    
    let TERMS = [];
    
    let Lands = U.inspire({ name: 'Lands', methods: () => ({
      init: function({ heartbeatMs=10000, recTypes={} }) {
        
        if (recTypes.isEmpty()) throw new Error('No "recTypes" provided');
        
        this.pool = U.setup.CpuPool();
        
        this.heartbeatMs = heartbeatMs;
        this.recTypes = recTypes;
        this.uidCnt = 0;
        this.comNozzes = {};
        
        this.servers = [];
        this.makeServers = [];
        
        this.allRecs = Map();             // Map uid -> Rec
        
        /// {ABOVE=
        
        this.realRooms = [];              // All supported Real Rooms
        
        /// =ABOVE} {BELOW=
        
        this.syncVersion = 0;             // Track the version of Below
        this.heartbeatTimeout = null;     // Timeout reference
        this.resetHeartbeatTimeout();     // Initialize heartbeat Below
        
        /// =BELOW}
        
        // Note that Arch and ArchHut don't use `this.createRec`
        this.arch = this.recTypes.arch.create({ uid: '!arch' });
        this.allRecs.set('!arch', this.arch);
        
        this.addDefaultCommands();
        
      },
      addDefaultCommands: function() {
        
        this.comNozz('error').route(({ hut, msg, reply }) => { /* nothing */ });
        this.comNozz('fizzle').route(({ hut, msg, reply }) => { /* nothing */ });
        
        /// {ABOVE=
        
        this.comNozz('modifyRec').route(({ hut, msg, reply }) => {
          if (!msg.has('uid')) return hut.tell({ command: 'error', type: 'uidMissing', orig: msg });
          if (!msg.has('val')) return hut.tell({ command: 'error', type: 'valMissing', orig: msg });
          let { uid, val } = msg;
          let rec = this.allRecs.get(uid);
          if (!rec) return hut.tell({ command: 'error', type: 'uidNotFound', orig: msg });
          try { hut.modifyRec(rec, val); }
          catch(err) { hut.tell({ command: 'error', type: 'modifyError', message: err.message, orig: msg }); }
        });
        this.comNozz('thunThunk').route(({ hut, msg, reply }) => { /* nothing */ });
        
        /// =ABOVE} {BELOW=
        
        this.comNozz('update').route(({ msg, reply }) => {
          
          let { version, content } = msg;
          
          if (version !== this.syncVersion + 1) throw new Error(`Tried to move from version ${this.syncVersion} -> ${version}`);
          
          // Apply all operations
          let { addRec={}, remRec={}, updRec={} } = content;
          
          // Consider "head" and "tail" Recs - HeadRecs exist before
          // update, TailRecs exist *due to* update. TailRecs may have
          // both HeadRecs and TailRecs as MemberRecs
          let headRecs = this.allRecs;
          let tailRecs = Map();
          let getHeadOrTailRec = uid => headRecs.get(uid) || tailRecs.get(uid) || null;
          
          // Add new Recs with churning
          let waiting = addRec.toArr((v, uid) => ({ ...v, uid }));
          while (waiting.length) {
            
            let attempt = waiting;
            waiting = [];
            
            for (let addVals of attempt) {
            
              let { type, val, memberUids, uid } = addVals;
              
              // Convert all members from uid to Rec
              let memberRecs = [];
              for (let memberUid of memberUids) {
                let memberRec = getHeadOrTailRec(memberUid);
                if (!memberRec) { memberRecs = null; break; }
                else            memberRecs.push(memberRec);
              }
              
              if (!memberRecs) { waiting.push(addVals); continue; }
              
              // All members are available - create the Rec!
              let newRec = this.createRec(type, { uid, val }, ...memberRecs);
              tailRecs.set(uid, newRec);
              
            }
            
            if (waiting.length === attempt.length) { // If churn achieved nothing we're stuck
              console.log('Head Recs:\n', headRecs.toArr((rec, uid) => `- ${uid}: ${U.nameOf(rec)} (${rec.type.name})`).join('\n'));
              console.log(JSON.stringify(content, null, 2));
              throw new Error(`Unresolvable Rec dependencies`);
            }
            
          }
          
          // Update Recs directly
          updRec.forEach((newValue, uid) => {
            if (!this.allRecs.has(uid)) throw new Error(`Tried to upd non-existent Rec @ ${uid}`);
            this.allRecs.get(uid).drip(newValue);
          });
          
          // Remove Recs directly
          remRec.forEach((val, uid) => {
            if (!this.allRecs.has(uid)) throw new Error(`Tried to rem non-existent Rec @ ${uid}`);
            this.allRecs.get(uid).shut();
          });
          
          // We've successfully moved to our next version!
          this.syncVersion = version;
          
        });
        
        /// =BELOW}
        
      },
      nextUid: function() { return (this.uidCnt++).toString(36).padHead(8, '0'); },
      genUniqueTerm: function() {
        // If we used `getTerm` we could get an infinite loop! Simply exclude
        // any Huts that don't yet have a term
        let terms = Set(this.getAllHuts().map(h => h.term || C.skip));
        
        for (let i = 0; i < 100; i++) { // TODO: This is no good - `100` is arbitrary!
          let ret = TERMS[Math.floor(Math.random() * TERMS.length)]; // TODO: Should use chance room
          if (!terms.has(ret)) return ret;
        }
        throw new Error('Too many huts! Not enough terms!! AHHHH!!!');
      },
      
      createRec: function(name, params={}, ...args) {
        
        // Prefer this to `this.recTypes.<type>.create(...)` when:
        // 1 - Want to supply automatic uid for recType
        // 2 - Want to supply automatic "lands" param to Rec subclass
        // 3 - Want to include createdRec in `this.allRecs`, and remove
        // it when it dries up
        
        if (!this.recTypes.has(name)) throw new Error(`Invalid RecType name: "${name}"`)
        if (!params.has('uid')) params.uid = this.nextUid();
        params.lands = this;
        
        let rec = this.recTypes[name].create(params, ...args);
        this.allRecs.set(rec.uid, rec);
        rec.drierNozz().route(() => this.allRecs.rem(rec.uid));
        return rec;
      },
      comNozz: function(command) {
        if (!this.comNozzes.has(command)) this.comNozzes[command] = Nozz();
        return this.comNozzes[command];
      },
      hear: async function(absConn, hut, msg, reply=null) {
        let { command } = msg;
        
        // Note: We don't allow a new `comNozz` to be created for
        // `command`; that could allow exploitation from Below.
        let comVal = { lands: this, absConn, hut, msg, reply };
        if (this.comNozzes.has(command))  this.comNozzes[command].drip(comVal);
        if (hut.comNozzes.has(command))   hut.comNozzes[command].drip(comVal);
      },
      tell: async function(msg) {
        /// {BELOW=
        this.resetHeartbeatTimeout(); // Already sending a sign of life; defer next heartbeat
        /// =BELOW}
        this.getAllHuts().forEach(hut => hut.tell(msg));
      },
      
      /// {ABOVE=
      setRealRooms: function(realRooms) { this.realRooms = realRooms; },
      /// =ABOVE}
      
      getRootReal: async function(realRoom=foundation.getDefaultRealRoom()) {
        let rootReal = await foundation.getRootReal();
        if (rootReal.reality) throw new Error('Reality already applied');
        let reality = realRoom.Reality('root');
        reality.addFlatLayouts(this.realLayout);
        rootReal.reality = reality;
        rootReal.layout = reality.rootLayout;
        return rootReal;
      },
      
      /// {BELOW=
      resetHeartbeatTimeout: function() {
        if (!this.heartbeatMs) return;
        
        // After exactly `this.heartbeatMs` millis Above will shut us down
        // Therefore we need to be quicker - wait less millis than `this.heartbeatMs`
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => this.tell({ command: 'thunThunk' }), Math.max(this.heartbeatMs * 0.85, this.heartbeatMs - 2000));
      },
      modifyRec: function(rec, newVal) {
        
        // Called from Below; affects `rec` Above!
        
        // TODO: Validation in {ABOVE= Lands.prototype.modifyRec =ABOVE}
        // and {BELOW= Hut.prototype.modifyRec =BELOW} disagree with
        // each other!
        // TODO: We can prevent the message from happening if `newVal`
        // is a redundant update!
        // TODO: The naming "newVal" (and the "val" property of the
        // "modifyRec" command) don't reflect that "newVal" is often a
        // delta - containing only the changed properties.
        
        let curVal = rec.val;
        if (curVal === newVal) return;
        
        // Only allow type-mixing between `null` and non-null values
        let nullUpd = curVal === null || newVal === null;
        
        if (!nullUpd && U.inspOf(curVal) !== U.inspOf(newVal))
          throw new Error(`Tried to update ${U.nameOf(curVal)} -> ${U.nameOf(newVal)}`);
        
        if (!nullUpd && U.isType(newVal, Object)) {
          let changedProp = false;
          for (let k in newVal) {
            if (!curVal.has(k)) throw new Error(`Tried to add non-existent property: "${k}"`);
            if (curVal[k] !== newVal[k]) changedProp = true;
          }
          if (!changedProp) return; // Tolerate this! No property changed. TODO: Recursively check inner properties?
        }
        
        this.tell({ command: 'modifyRec', uid: rec.uid, val: newVal });
      },
      /// =BELOW}
      
      getAllHuts: function() {
        return this.arch.relNozz(rt.archHut, 0).set.toArr(archHut => archHut.members[1]);
      },
      
      // TODO: async functions shouldn't be named "open" and "shut"
      // TODO: should return a HorzScope I think??
      open: async function() {
        /// {ABOVE=
        TERMS = JSON.parse(await foundation.readFile('room/hinterlands/TERMS.json'));
        /// =ABOVE} {BELOW=
        TERMS = [ 'above' ]; // Below has only 1 FarHut, so only 1 name
        /// =BELOW}
        
        /// {ABOVE=
        
        // Setup each supported Reality (using temporary instances)
        for (let realRoom of this.realRooms) {
          let reality = realRoom.Reality('root');
          reality.addFlatLayouts(this.realLayout);
          reality.prepareAboveLands(this);
        }
        
        /// =ABOVE}
        
        // Servers ultimately result in Cpus and CpuConns being wobbled
        this.servers = await Promise.allArr(this.makeServers.map(make => make(this.pool)));
        this.cpuScope = Scope(this.pool.cpuNozz, (cpu, dep) => {
          
          let cpuId = cpu.cpuId;
          
          // Create a Hut; it will be throttled until it gives us a Tell
          let hut = this.recTypes.hut.create({ uid: `!hut@${cpuId}`, cpu, lands: this });
          let resolveGotCom = null;
          let hutGotComPrm = Promise(r => resolveGotCom = r);
          hut['throttleSyncBelow'] = () => hutGotComPrm;
          
          // Now that the Hut is safely throttled connect it to ArchHut
          let archHut = this.recTypes.archHut.create({ uid: `!archHut@${cpuId}` }, this.arch, hut);
          
          // Cpu and Hut dry up together!
          dep(Drop(null, () => hut && hut.dry()));
          dep(hut.drierNozz().route(() => cpu.dry()));
          
          // Listen to each Conn of the Cpu
          dep.scp(cpu.connNozz, (conn, dep) => {
            
            // Listen to Commands coming from the Conn
            dep(conn.hear.route(([ msg, reply=null ]) => {
              
              /// {ABOVE=
              hut.refreshExpiry();
              /// =ABOVE}
              
              this.hear(conn, hut, msg, reply);
              
              // This will only occur once per Hut. Now that we've heard
              // from the Hut, unthrottle its tells.
              if (resolveGotCom) { resolveGotCom(); resolveGotCom = null; delete hut['throttleSyncBelow']; }
              
            }));
            
          });
          
        });
        
        /// {BELOW=
        
        // The only Hut which Below talks to is the Above Hut
        for (let server of this.servers) this.pool.makeCpuConn(server, conn => conn.cpuId = 'above');
        let aboveHut = this.getAllHuts().find(() => true)[0];
        if (U.initData) await this.hear(null, aboveHut, U.initData); // Do the initial update
        
        /// =BELOW}
      },
      shut: async function() {
        this.cpuScope.dry();
        await Promise.allArr(this.servers.map(server => server.dry()));
      }
    })});
    let Hut = U.inspire({ name: 'Hut', insps: { Rec }, methods: (insp, Insp) => ({
      
      init: function({ lands, cpu, ...supArgs }) {
        
        if (!lands) throw new Error('Missing "lands"'); // TODO: Can this property be removed? It's aaalmost unnecessary
        if (!cpu) throw new Error('Missing "cpu"');
        
        insp.Rec.init.call(this, supArgs);
        this.lands = lands;   // TODO: Only needed for "getTerm" and "refreshExpiry"
        this.cpu = cpu;       // TODO: Only needed in "tell" (this.cpu.connNozz.set)
        this.term = null;
        this.comNozzes = {};
        
        /// {ABOVE=
        // Keep track of which Records the Below for this Hut has followed
        
        this.version = 0;
        this.fols = Map();
        this.sync = { addRec: {}, updRec: {}, remRec: {} };
        
        // Keep track of whether the Below for this Hut is still communicating
        this.syncThrottlePrm = null; // Resolves when we've sent sync to Below
        this.expiryTimeout = null;
        this.refreshExpiry();
        /// =ABOVE}
        
      },
      getTerm: function() {
        if (!this.term) this.term = this.lands.genUniqueTerm();
        return this.term;
      },
      comNozz: function(command) {
        if (!this.comNozzes.has(command)) this.comNozzes[command] = Nozz();
        return this.comNozzes[command];
      },
      
      /// {ABOVE=
      refreshExpiry: function() {
        clearTimeout(this.expiryTimeout);
        this.expiryTimeout = setTimeout(() => this.dry(), this.lands.heartbeatMs);
      },
      
      toSync: function(type, rec) {
        
        if (!this.sync.has(type)) throw new Error(`Invalid type: ${type}`);
        let { addRec, updRec, remRec } = this.sync;
        
        // Can addRec and remRec occur together? NO  (conflicting messages!)
        // Can addRec and updRec occur together? NO  (redundant!)
        // Can remRec and updRec occur together? YES (e.g. animation upon deletion)
        
        if (type === 'addRec') {
          if (remRec.has(rec.uid))  delete remRec[rec.uid];
          else                      addRec[rec.uid] = (delete updRec[rec.uid], rec);
        } else if (type === 'remRec') {
          if (addRec.has(rec.uid))  delete addRec[rec.uid];
          else                      remRec[rec.uid] = rec;
        } else if (type === 'updRec') {
          if (addRec.has(rec.uid))  return; // No "updRec" necessary: already adding!
          else                      updRec[rec.uid] = rec;
        }
        
        this.requestSyncBelow();
        
      },
      throttleSyncBelow: function() { return Promise(r => foundation.queueTask(r)); },
      requestSyncBelow: function() {
        
        // Schedules Below to be synced if not already scheduled
        
        if (this.syncThrottlePrm) return; // A request to sync already exists
        
        this.syncThrottlePrm = (async () => {
          
          let throttlePrm = this.throttleSyncBelow();
          await throttlePrm;
          this.syncThrottlePrm = null;
          
          // Hut may have dried between scheduling and executing sync
          if (this.isDry()) return;
          
          let updateTell = this.genSyncTell();
          if (updateTell) this.tell(updateTell);
          
        })();
        
      },
      
      resetSyncState: function() {
        this.version = 0;                                           // Reset version
        this.sync = this.sync.map(v => ({}));                       // Clear current delta
        this.fols.forEach((f, rec) => this.toSync('addRec', rec));  // Sync all addRecs
      },
      genSyncTell: function() {
        
        // Generates data to sync the BelowHut, and flags the BelowHut
        // as fully up to date
        
        let addRec = this.sync.addRec.map(r => ({ type: r.type.name, val: r.val, memberUids: r.members.map(m => m.uid) }));
        let updRec = this.sync.updRec.map(r => r.val);
        let remRec = this.sync.remRec.map(r => 1);
        
        let content = {};
        if (!addRec.isEmpty()) content.addRec = addRec;
        if (!updRec.isEmpty()) content.updRec = updRec;
        if (!remRec.isEmpty()) content.remRec = remRec;
        if (content.isEmpty()) return null;
        
        this.sync = this.sync.map(v => ({}));
        this.version++;
        return { command: 'update', version: this.version, content };
        
      },
      
      getRecFollowStrength: function(rec) { return (this.fols.get(rec) || { strength: 0 }).strength; },
      setRecFollowStrength: function(rec, strength) {
        
        if (strength < 0) throw new Error(`Invalid strength ${strength} for ${rec.type.name}`);
        
        let fol = this.fols.get(rec) || null;     // The current Follow
        let strength0 = fol ? fol.strength : 0;   // The current FollowStrength
        if (strength === strength0) throw new Error(`Strength is already ${strength}`);
        
        // Our FollowStrength of `rec` is changing! There are 3 possibilities:
        // 1 - Strength moving from =0 to >0 : ADD REC!
        // 2 - Strength moving from >0 to >0 : DO NOTHING!
        // 3 - Strength moving from >0 to =0 : REM REC!
        
        if (!strength0) {                   // ADD
          
          // Follow ends when Rec is unfollowed, or Rec dries
          
          this.toSync('addRec', rec);
          let updRecRoute = rec.route(() => this.toSync('updRec', rec));
          
          let unfollowNozz = Funnel(rec.drier.nozz);
          unfollowNozz.route(() => {
            this.toSync('remRec', rec);
            updRecRoute.dry();
          });
          
          fol = { strength, unfollowNozz, modifyAllow: Map(), modifyBlock: Map() };
          this.fols.set(rec, fol);
          
        } else if (strength0 && strength) { // UPD
          
          fol.strength = strength;
          
        } else {                            // REM
          
          this.fols.rem(rec);
          fol.unfollowNozz.drip();
          fol = null;
          
        }
        
        return fol;
        
      },
      followRec: function(rec, modify={}) {
        
        // TODO: Automatically follow `rec.members`?
        let fol = this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) + 1);
        
        // Note that `fol.modifyAllow` and `fol.modifyBlock` map functions
        // to the hold strength of that specific function
        let { modifyAllow: anyF, modifyBlock: allF } = modify;
        if (anyF && !U.isType(anyF, Function)) throw new Error('Invalid "modifyAllow" value');
        if (allF && !U.isType(allF, Function)) throw new Error('Invalid "modifyBlock" value');
        if (anyF) fol.modifyAllow.set(anyF, (fol.modifyAllow.get(anyF) || 0) + 1);
        if (allF) fol.modifyBlock.set(allF, (fol.modifyBlock.get(allF) || 0) + 1);
        
        return Drop(null, () => {
          let fol = this.setRecFollowStrength(rec, this.getRecFollowStrength(rec) - 1);
          if (fol) {
            if (anyF) { let v = fol.modifyAllow.get(anyF); fol.modifyAllow[(v > 1) ? 'set' : 'rem'](anyF, v - 1); }
            if (allF) { let v = fol.modifyBlock.get(allF); fol.modifyBlock[(v > 1) ? 'set' : 'rem'](allF, v - 1); }
          }3
        });
      },
      follow: function(rec) {
        // Note: may pass Recs with "!"-prefixed uids - they're ignored
        let drops = [ rec, ...rec.members ].map(r => r.uid[0] === '!' ? C.skip : this.followRec(r));
        return Drop(null, () => drops.forEach(d => d.dry()));
      },
      modifyRec: function(rec, newVal) {
        
        // A command from Below has wound us up here. Make sure that the
        // Below has permission to modify this `rec` as it desires, and
        // if so do the modification.
        
        if (rec.val !== null && newVal.val !== null)
          if (U.inspOf(rec.val) !== U.inspOf(newVal))
            throw new Error(`Can't modify - tried to modify ${U.nameOf(rec.val)} -> ${U.nameOf(newVal)}`);
        
        let fol = this.fols.get(rec);
        if (!fol) throw new Error(`Modification denied`);
        
        // Allow if any "modifyAllow" passes and no "modifyBlock" fails
        let anyAllow = false;
        for (let f of fol.modifyAllow.keys()) if (f(newVal)) { anyAllow = true; break; }
        if (!anyAllow) throw new Error(`Can't modify since no "any" passed`);
        
        let allPass = true;
        for (let f of fol.modifyBlock.keys()) if (f(newVal)) { allPass = false; break; }
        if (!allPass) throw new Error(`Can't modify since an "all" denied`);
        
        if (U.isType(newVal, Object)) rec.drip({ ...(rec.val || {}), ...newVal });
        else                          rec.drip(newVal);
      },
      
      onceDry: function() {
        insp.Rec.onceDry.call(this);
        clearTimeout(this.expiryTimeout); this.expiryTimeout = null;
      },
      /// =ABOVE}
      
      tell: function(msg, conn=null) {
        let conns = this.cpu.connNozz.set;
        if (conns.isEmpty()) throw new Error(`Hut ${this.getTerm()} has no Conns`);
        if (conn && !conns.has(conn)) throw new Error(`Provided Conn doesn't apply to Hut`);
        
        if (!conn) {
          let bestCost = U.int32;
          for (let conn0 of conns) {
            let cost = conn0.server.cost;
            if (cost < bestCost) { conn = conn0; bestCost = cost; }
          }
        }
        
        conn.tell(msg);
      }
    })});
    
    let { rt, add } = record.recTyper();
    add('arch',     Rec);
    add('hut',      Hut);
    add('archHut',  Rec, '1M', rt.arch, rt.hut);
    
    return { Lands, Hut, rt };
    
  }
});
