global.rooms['hinterlands.hutControls'] = async foundation => {
  
  let { RecSrc, RecScope } = await foundation.getRoom('record');
  
  return U.form({ name: 'HutControls', props: (forms, Form) => ({
    
    // HutControls consolidates a bunch of boilerplate configuration in
    // one place. The main functions are to:
    // - Define debug options
    // - Enumerate what habitats this app supports
    // - Provide a recForm mapping (mapping recType names to Forms)
    // - Initialize a root Rec for this app
    // - TODO: persistent storage and loading previous states
    // - Separate ABOVE and BELOW logic, while allowing ABOVE to follow
    //    BELOW state for each BELOW, and parameterizing ABOVE/BELOW
    //    logic appropriately
    
    $FollowRecScope: U.form({ name: 'FollowRecScope', has: { RecScope }, props: (forms, Form) => ({
      init: function(hut, ...args) {
        
        this.hut = hut;
        
        // Our src will send Recs if using either of these styles:
        // 1 - `RecScope(srcTmp, 'relTerm', (rec, dep) => ...)`
        // 2 - `RecScope(srcTmp.relSrc('relTerm'), (rec, dep) => ...)`
        this.doFollowRecs = args.count() === 3 || U.isForm(args[0], RecSrc);
        forms.RecScope.init.call(this, ...args);
      },
      processTmp: function(tmp, dep) {
        if (this.doFollowRecs) dep(this.hut.followRec(tmp));
        return forms.RecScope.processTmp.call(this, tmp, dep);
      },
      subScope: function(...args) { return forms.RecScope.subScope.call(this, this.hut, ...args); }
    })}),
    
    init: function(fullName, { debug=[], habitats=[], recForms={}, storageName=null, parFn=()=>{}, kidFn=()=>{} }) {
      ({}).gain.call(this, { fullName, debug, habitats, recForms, storageName, parFn, kidFn });
    },
    
    /// {ABOVE=
    setupStorage: async function(hut) {
      
      let { Hut } = await foundation.getRoom('hinterlands');
      let { Rec } = await foundation.getRoom('record');
      
      let tmp = U.logic.Tmp();
      
      let storageKeep = foundation.seek('keep', 'adminFileSystem', 'mill', 'storage', 'hutControls', storageName);
      let replayCount = (await storageKeep.getContent() || []).count();
      
      if (replayCount) {
        
        let huts = {};
        let makeHut = uid => {
          
          // TODO: Should disable heartMs entirely
          let kidHut = Hut(foundation, uid, { parHut: hut, heartMs: 24 * 60 * 60 * 1000 })
          kidHut.recFollows = Map(); // only AfarHuts have "recFollows", but `kidRec` is pretending to be afar
          kidHut.pendingSync = { add: {}, upd: {}, rem: {} };
          
          // Stifle any hears the KidHut receives. The KidHut doesn't
          // require any input whatsoever; the storage already knows
          // everything the KidHut will tell!
          kidHut.hear = () => {};
          
          let kidHutType = hut.getType('lands.kidHut');
          Rec(kidHutType, `!kidHut@${uid}`, { par: hut, kid: kidHut });
          
          return kidHut;
          
        };
        
        for (let i = 0; i < replayCount; i++) {
          
          let { uid, msg } = JSON.parse(await storageKeep.seek(`${i}`).getContent());
          if (!huts.has(uid)) {
            huts[uid] = makeHut(uid);
            huts[uid].endWith(() => delete huts[uid]);
          }
          let kidHut = huts[uid];
          Hut.tell(kidHut, hut, null, null, msg);
          
        }
        
        for (let [ k, hut ] of huts) hut.end();
        
      }
      
      let writePendingCount = 0;
      let writeIndex = replayCount;
      let writeQueue = Promise.resolve();
      let addItem = item => {
        let ind = writeIndex++;
        writePendingCount++;
        writeQueue = writeQueue.then(async () => {
          await storageKeep.seek(`${ind}`).setContent(JSON.stringify(item));
          writePendingCount--;
        });
      };
      
      let ignoreCommands = Set([ 'thunThunk' ]);
      hut.roadDbgEnabled = false;
      let hutHearOrig = hut.hear;
      hut.hear = (srcHut, road, reply, msg, ms) => {
        if (msg.command && !ignoreCommands.has(msg.command)) addItem({ uid: srcHut.uid, msg });
        return hutHearOrig.call(hut, srcHut, road, reply, msg, ms);
      };
      tmp.endWith(() => delete hut.hear);
      
      return tmp;
    },
    /// =ABOVE}
    
    open: async function(hut) {
      
      let tmp = U.logic.Tmp();
      
      hut.roadDbgEnabled = this.debug.has('road');
      
      let name = this.fullName.split('.')[1];
      for (let h of this.habitats) tmp.endWith(h.prepare(name, hut));
      
      hut.addTypeClsFns(this.recForms.map(RecForm => () => RecForm));
      tmp.endWith(()=> hut.remTypeClsFns(this.recForms.toArr((v, k) => k)));
      
      let real = await foundation.seek('real', 'primary');
      
      /// {ABOVE=
      
      hut.createRec(this.fullName, [ hut ]);
      let parScope = RecScope(hut, this.fullName, (rec, dep) => {
        this.parFn(rec, hut, real, dep);
        dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => {
          let kidHut = kidParHut.mems.kid;
          dep(Form.FollowRecScope(kidHut, hut, this.fullName, (rec, dep) => this.kidFn(rec, kidHut, real, dep)));
        });
      });
      tmp.endWith(parScope);
      
      if (this.storageName) tmp.endWith(await this.setupStorage(hut, 'block1'));
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below syncs the root Rec it's good to go
      let kidScope = Form.FollowRecScope(hut, hut, this.fullName, (rec, dep) => this.kidFn(rec, hut, real, dep));
      tmp.endWith(kidScope);
      
      /// =BELOW}
      
      return tmp;
      
    }
    
  })});
  
};
