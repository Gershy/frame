// TODO:
//  - Do the full ABOVE args need to be sent to FoundationBrowser?
//    Do *any* need to be sent??
//  - Need to test SSL and check other triple-slash'd code
//  - Take a look at Hut.prototype.processNewRoad. Servers should be
//    created separately, and then connected to any number of Huts
//  - Think about an abstract "default command" to replace "syncInit"
//    This will allow multiplexing apps on the same server!!

global.rooms['hinterlands.hutControls'] = async foundation => {
  
  let { RecSrc, RecScope } = await foundation.getRoom('record');
  
  return U.form({ name: 'HutControls', props: (forms, Form) => ({
    
    // HutControls consolidates a bunch of boilerplate configuration in
    // one place. The main functions are to:
    // - Define debug options
    // - Enumerate hosting options
    // - Enumerate what habitats this app supports
    //    (TODO: At the moment every habitat runs on every host...?)
    //    (TODO: Once hut.addServer(...) is available, servers should
    //    allow a "default road term" to be defined to replace
    //    "syncInit" - this would mean many habitats could all run on
    //    the same server, and multiplex as is required of them)
    // - Provide a recForm mapping (mapping recType names to Forms)
    // - Initializing a root Rec for the app
    // - Persistent storage and loading previous states
    // - Separate ABOVE and BELOW logic, while allowing ABOVE to follow
    //    the state of each BELOW, and parameterizing ABOVE/BELOW logic
    //    appropriately
    
    /// {ABOVE=
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
    /// =ABOVE}
    
    init: function(fullName, params={}) {
      let { hosting=foundation.getArg('hosting') } = params;
      let { debug=foundation.getArg('debug') } = params;
      let { habitats=[], recForms={}, storage=null } = params;
      let { parFn=Function.stub, kidFn=Function.stub } = params;
      ({}).gain.call(this, { fullName, debug, hosting, habitats, recForms, storage, parFn, kidFn });
    },
    
    /// {ABOVE=
    setupReplayStorage: async function(hut, { keep, bufferMinSize=50, bufferMs=10*1000 }) {
      
      let doDbg = this.debug.has('storage');
      
      doDbg && console.log('Init replay storage', { keep, bufferMinSize, bufferMs });
      
      let { Hut } = await foundation.getRoom('hinterlands');
      let { Rec } = await foundation.getRoom('record');
      
      let tmp = U.logic.Tmp();
      
      let storageKeep = U.isForm(keep, String)
        ? foundation.seek('keep', 'adminFileSystem', 'mill', 'storage', 'hutControls', keep)
        : keep;
      
      let replayCount = (await storageKeep.getContent() || []).count();
      let getItemName = i => (i).encodeStr('0123456789abcdefghijklmnopqrstuvwxyz', 8);
      
      // Perform any existing replays to catch up to the latest state
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
          
          // Create Rec relating KidHut and ParHut (TODO: Necessary??)
          let kidHutType = hut.getType('lands.kidHut');
          Rec(kidHutType, `!kidHut@${uid}`, { par: hut, kid: kidHut });
          
          return kidHut;
          
        };
        
        doDbg && console.log(`Catching up; replaying ${replayCount} files...`);
        let t = foundation.getMs();
        let replayCnt = 0;
        for (let i = 0; i < replayCount; i++) {
          let replayLines = (await storageKeep.seek(getItemName(i)).getContent('utf8')).split('\n');
          for (let replayJson of replayLines) {
            let { uid, ms, msg } = JSON.parse(replayJson);
            if (uid && !huts.has(uid)) {
              huts[uid] = makeHut(uid);
              huts[uid].endWith(() => delete huts[uid]);
            }
            let kidHut = uid ? huts[uid] : null;
            replayCnt++;
            Hut.tell(kidHut, hut, null, null, msg, ms);
          }
        }
        doDbg && console.log(`Caught up via replays after ${((foundation.getMs() - t) / 1000).toFixed(2)}s`);
        
        for (let [ k, hut ] of huts) hut.end();
        
      } else {
        
        doDbg && console.log(`Fresh start; no replay required`);
        
      }
      
      let writeIndex = replayCount;
      let writeBuffer = [];
      let writeTimeout = null;
      let addItem = item => {
        
        // If no timeout is already pending, create one
        if (!writeTimeout) writeTimeout = setTimeout(async () => {
          writeTimeout = null;
          let content = writeBuffer.map(item => JSON.stringify(item)).join('\n');
          await storageKeep.seek(getItemName(writeIndex)).setContent(content);
          if (writeBuffer.count() >= bufferMinSize) { writeBuffer = []; writeIndex++; }
        }, bufferMs);
          
        // Add `item` into buffer to be consumed upon timeout
        writeBuffer.push(item);
        
      };
      
      let ignoreCommands = Set([ 'thunThunk', 'syncInit', 'html.multi', 'html.css', 'html.room', 'html.icon' ]);
      hut.roadDbgEnabled = false;
      let hutHearOrig = hut.hear;
      hut.hear = (srcHut, road, reply, msg, ms=foundation.getMs()) => {
        if (msg.command && !ignoreCommands.has(msg.command)) addItem({ uid: srcHut ? srcHut.uid : null, ms, msg });
        return hutHearOrig.call(hut, srcHut, road, reply, msg, ms);
      };
      tmp.endWith(() => delete hut.hear);
      
      return tmp;
      
    },
    /// =ABOVE}
    
    open: async function(hut) {
      
      let tmp = U.logic.Tmp();
      
      hut.roadDbgEnabled = this.debug.has('road');
      
      let debug = await Promise.resolve(this.debug);
      
      // In the future (but it's gonna require figuring out exactly
      // what's going on with the arcane "processNewRoad"):
      //  let server = await foundation.getServer(hostingTerm);
      //  tmp.endWith(hut.addServer(server));
      let hosting = await Promise.resolve(this.hosting);
      for (let [ term, opts ] of hosting) foundation.getServer(hut, opts);
      
      if (debug.has('hosting') && !hosting.isEmpty()) {
        console.log(`Hut ${this.fullName} is now hosted; access via:`);
        for (let h of hosting.toArr(v => v))
          console.log(`- ${foundation.formatHostUrl(h)}`);
      }
      
      /// let { hosting, protocols, heartMs } = options;
      /// if (protocols.http) {
      ///   console.log(`Using HTTP: ${hosting.host}:${hosting.port + 0}`);
      ///   this.createHttpServer(hut, { host: hosting.host, port: hosting.port + 0, ...hosting.sslArgs });
      /// }
      /// if (protocols.sokt) {
      ///   console.log(`Using SOKT: ${hosting.host}:${hosting.port + 1}`);
      ///   this.createSoktServer(hut, { host: hosting.host, port: hosting.port + 1, ...hosting.sslArgs });
      /// }
      
      let name = this.fullName.split('.')[1];
      let preparations = await Promise.allArr(this.habitats.map(h => h.prepare(name, hut)));
      tmp.endWith(() => preparations.each(p => p.end()));
      
      hut.addTypeClsFns(this.recForms.map(RecForm => () => RecForm));
      tmp.endWith(()=> hut.remTypeClsFns(this.recForms.toArr((v, k) => k)));
      
      let real = await foundation.seek('real', 'primary');
      
      /// {ABOVE=
      
      hut.createRec(this.fullName, [ hut ]);
      let parScope = RecScope(hut, this.fullName, (rec, dep) => {
        this.parFn(hut, rec, real, dep);
        dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => {
          let kidHut = kidParHut.mems.kid;
          dep(Form.FollowRecScope(kidHut, hut, this.fullName, (rec, dep) => this.kidFn(kidHut, rec, real, dep)));
        });
      });
      tmp.endWith(parScope);
      
      if (this.storage) {
        if (this.debug.has('storage')) console.log(`Setting up "${this.storage.type}" storage on "${this.fullName}"; params:`, this.storage);
        tmp.endWith(await {
          replay: () => this.setupReplayStorage(hut, this.storage),
          postgres: () => { /* imagine the possibilities! */ }
        }[this.storage.type]());
      } else {
        if (this.debug.has('storage')) console.log(`No storage requested for "${this.fullName}"`);
      }
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below syncs the root Rec it's good to go
      let kidScope = RecScope(hut, this.fullName, (rec, dep) => this.kidFn(hut, rec, real, dep));
      tmp.endWith(kidScope);
      
      /// =BELOW}
      
      return tmp;
      
    }
    
  })});
  
};
