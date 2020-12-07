// TODO:
//  - Do the full ABOVE args need to be sent to FoundationBrowser?
//    Do *any* need to be sent??
//  - Need to test SSL and check other triple-slash'd code
//  - Take a look at Hut.prototype.processNewRoad. Servers should be
//    created separately, and then connected to any number of Huts
//  - Think about an abstract "default command" to replace "syncInit"
//    This will allow multiplexing apps on the same server!!

global.rooms['hinterlands.setup'] = async foundation => {
  
  let { RecSrc, RecScope } = await foundation.getRoom('record');
  
  return U.form({ name: 'Setup', props: (forms, Form) => ({
    
    // Setup consolidates a bunch of boilerplate configuration in one
    // place. The main functions are to:
    // - Define debug options
    // - Enumerate hosting options
    // - Enumerate what habitats this app supports
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
    
    init: function(prefix, hutName, params={}) {
      let { hosting=foundation.getArg('hosting') } = params;
      let { debug=foundation.getArg('debug') } = params;
      let { habitats=[], recForms={} } = params;
      let { parFn=Function.stub, kidFn=Function.stub } = params;
      
      let storage = null;
      
      /// {ABOVE=
      
      // "storage" defaults to `null` unless the "storageKeep" arg is
      // defined, in which case it defaults to replay-style storage
      // using that Keep
      storage = params.has('storage') ? params.storage : (() => {
        let storageKeep = foundation.getArg('storageKeep');
        return storageKeep
          ? { type: 'replay', keep: storageKeep, bufferMinSize: 50, bufferMs: 10*1000 }
          : null;
      })();
      
      /// =ABOVE}
      
      ({}).gain.call(this, { prefix, hutName, debug, hosting, habitats, recForms, storage, parFn, kidFn });
    },
    
    /// {ABOVE=
    setupReplayStorage: async function(hut, { keep, bufferMinSize=50, bufferMs=10*1000 }) {
      
      let doDbg = this.debug.has('storage');
      
      doDbg && console.log(`Init replay storage on "${this.hutName}" @ "${keep.absPath.join('/')}"; bufferMinSize: ${bufferMinSize}; bufferMs: ${bufferMs}`);
      
      let { Hut } = await foundation.getRoom('hinterlands');
      let { Rec } = await foundation.getRoom('record');
      
      let tmp = U.logic.Tmp();
      
      let replayCount = (await keep.getContent() || []).count();
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
          let replayLines = (await keep.seek(getItemName(i)).getContent('utf8')).split('\n');
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
          await keep.seek(getItemName(writeIndex)).setContent(content);
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
      
      // Setup all servers; note this is fire-and-forget! Awaiting the
      // server connection can seriously impact client-side UX!
      // Note: There would be race-condition ramifications if code were
      // allowed to continue without any immediately-available servers
      // (e.g. quickly occurring requests from the BelowHut could
      // encounter the error that it cannot do Tells since there is no
      // AboveHut). This currently cannot happen to FoundationBrowser,
      // as the function for creating the http server is synchronous!
      // This is contextually sensible, as the FoundationBrowser itself
      // has been transported over a functioning http connection.
      let hosting = await Promise.resolve(this.hosting);
      for (let [ term, hostingOpts ] of hosting) U.then(foundation.getServer(hostingOpts), server => {
        
        server.addPool(hut);
        
        /// {BELOW=
        // Link BELOW servers to the Hut instance representing ABOVE
        hut.processNewRoad(server, '!above'); // TODO: Does this belong here?
        /// =BELOW}
        
        if (debug.has('hosting')) console.log(`Access ${this.hutName} at ${foundation.formatHostUrl(hostingOpts)}`);
        
      });
      
      let preparations = await Promise.allArr(this.habitats.map(h => h.prepare(this.hutName, hut)));
      tmp.endWith(() => preparations.each(p => p.end()));
      
      hut.addTypeClsFns(this.recForms.map(RecForm => () => RecForm));
      tmp.endWith(()=> hut.remTypeClsFns(this.recForms.toArr((v, k) => k)));
      
      let real = await foundation.seek('real', 'primary');
      let recName = `${this.prefix}.${this.hutName.split('.').slice(-1)[0]}`;
      
      /// {ABOVE=
      
      hut.createRec(recName, [ hut ]);
      let parScope = RecScope(hut, recName, (rec, dep) => {
        this.parFn(hut, rec, real, dep);
        dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => {
          let kidHut = kidParHut.mems.kid;
          dep(Form.FollowRecScope(kidHut, hut, recName, (rec, dep) => this.kidFn(kidHut, rec, real, dep)));
        });
      });
      tmp.endWith(parScope);
      
      if (this.storage) {
        tmp.endWith(await {
          replay: () => this.setupReplayStorage(hut, this.storage),
          postgres: () => { /* imagine the possibilities! */ }
        }[this.storage.type]());
      } else {
        if (this.debug.has('storage')) console.log(`No storage requested for "${this.hutName}"`);
      }
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below syncs the root Rec it's good to go
      let kidScope = RecScope(hut, recName, (rec, dep) => this.kidFn(hut, rec, real, dep));
      tmp.endWith(kidScope);
      
      /// =BELOW}
      
      return tmp;
      
    }
    
  })});
  
};
