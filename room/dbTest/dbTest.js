U.buildRoom({ name: 'dbTest',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term' ],
  build: (foundation, record, hinterlands, real, realWebApp, term) => {
    
    let { Drop, Nozz, TubVal } = U.water;
    let { UnitPx } = real;
    let { FillParent, CenteredSlotter, MinExtSlotter, TextSized } = real;
    let { WebApp } = realWebApp;
    let { RecScope } = record;
    
    let open = async () => {
      
      let dbtHut = await foundation.getRootHut({ heartMs: 1000 * 40 });
      dbtHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
      
      /// {ABOVE=
      
      let fakeServer = {};
      fakeServer.desc = 'FAKE server';
      fakeServer.decorateRoad = () => {};
      
      let DbRamAndDisk = U.inspire({ name: 'DbRamAndDisk', methods: (insp, Insp) => ({
        init: function() {
          this.syncVersion = 0;
          this.earlySyncs = Map();
          
          this.recs = {};
          this.keep = foundation.getKeep('fileSystem', [ 'mill', 'storage', 'diskDb' ]);
          
          this.diskQueue = Promise.resolve();
          this.diskQueueLen = 0;
          
          this.netRecs = Set();
        },
        uid2Nam: function(uid) {
          let nam = [];
          for (let char of uid) {
            if (char.lower() === char.upper()) {
              nam.push(` ${char}`);
            } else if (char === char.lower()) {
              nam.push(` ${char}`);
            } else if (char === char.upper()) {
              nam.push(`+${char.lower()}`);
            }
          }
          return `[${nam.join('')}]`;
        },
        nam2Uid: function(nam) {
          let uid = [];
          for (let i = 0; i < nam.length - 2; i += 2) {
            let [ mod, sym ] = nam.substr(1 + i); // 1 offsets the "[" character
            uid.push(mod === '+' ? sym.upper() : sym.lower());
          }
          return uid.join('');
        },
        doSync: function({ version, content }) {
          
          this.earlySyncs.set(version, content);
          
          let recs = this.recs;
          let nextVersion = this.syncVersion + 1;
          while (this.earlySyncs.has(nextVersion)) {
            
            let { add=[], upd=[], rem=[] } = this.earlySyncs.get(nextVersion);
            
            this.diskQueueLen++;
            this.diskQueue = this.diskQueue.then(async () => {
              
              let promises = [];
              
              // Compile all "add" promises
              for (let rec of add) {
                let recKeep = this.keep.access(this.uid2Nam(rec.uid));
                promises.push(recKeep.setContent(JSON.stringify(rec)));
                this.netRecs.add(rec.uid);
              }
              
              // Compile all "upd" promises
              for (let { uid, val } of upd) {
                let recKeep = this.keep.access(this.uid2Nam(rec.uid));
                promises.push((async () => {
                  let origVal = JSON.parse(await recKeep.getContent());
                  await recKeep.setContent(JSON.stringify(origVal.gain({ val })));
                })());
              }
              
              // Compile all "rem" promises (the trickiest!!)
              let remWithDeps = async (uid, deletedUids) => {
                
                // Returns when it has added all promises of deletion
                // for all GroupRecs that contain MemberRec @ `uid`
                // Note that this function returns when all promises of
                // deletion have been compiled - these promises will
                // still be resolving even after this function has
                // returned!
                
                if (deletedUids.has(uid)) return;
                deletedUids.add(uid);
                this.netRecs.rem(uid);
                
                let recKeep = this.keep.access(this.uid2Nam(uid));
                
                // Even keeping track of `deletedUids` can't guarantee
                // that the file exists! Do this in a try/catch. Errors
                // will indicate that the file was unexpectedly missing.
                let mems = null;
                
                // Read MemberRec list from the file before deleting
                try { mems = JSON.parse(await recKeep.getContent()).mems; } catch(err) { return; }
                
                // Push the deletion promise for this Rec @ `uid`
                promises.push(recKeep.setContent(null));
                
                // Wait to compile deletions from all MemberRecs
                await Promise.allObj(mems.map(uid => remWithDeps(uid, deletedUids)));
                
              };
              let deletedUids = Set();
              
              // This completes when all "rem" promises are compiled
              await Promise.allArr(rem.map(uid => remWithDeps(uid, deletedUids)));
              
              // Now all add, upd, and rem promises are compiled. Wait
              // for *everything* to finish!
              await Promise.allArr(promises);
              
              this.diskQueueLen--;
              
            });
            
            this.earlySyncs.rem(nextVersion);
            this.syncVersion = nextVersion++;
            
          }
          
          if (this.earlySyncs.size > 30) throw Error('Too many pending syncs');
          
        },
        getFullSync: async function() {
          
          // Wait for writes to settle down
          await this.diskQueue;
          
          let prm = Promise.allArr(((await this.keep.getContent()) || []).map(async nam => {
            let recKeep = this.keep.access(nam);
            return JSON.parse(await recKeep.getContent());
          }));
          
          // Force writes to wait for the read to finish
          this.diskQueue = this.diskQueue.then(() => prm);
          
          return prm;
          
        }
      })});
      
      let db = DbRamAndDisk();
      let { hut: dbHut } = dbtHut.processNewRoad(fakeServer, road => {
        road.hear = Nozz();
        road.currentCost = () => 0;
        
        road.hear.route((...args) => console.log('DB COMMANDS HUT:', args));
        road.tell = sync => db.doSync(sync);
      });
      
      let cnt = 0;
      let rndRec = name => {
        let r = dbtHut.relNozz(name).set.toArr(v => v);
        return r[Math.floor(Math.random() * r.length)];
      };
      let f = async () => {
        
        // NOTE: A Rec has a certain number of Holds - a Rec cannot be
        // discarded while it has non-zero Holds. A newly created Rec
        // has 1 Hold by default. `Hut.prototype.followRec` should
        // increase the Holds on all relevant Recs.
        
        // Consider calling `rec.dry()`:
        // 1 - If Rec has more than 1 Hold, an Error occurs: "You can't
        //     dry this Rec; someone is holding it! (Like windows
        //     filesystem lolol)
        // 2 - Reduce Holds to 0 automatically. Anyone who was Holding
        //     the Rec is out of luck
        // 3 - Cause a series of cascading Drips which overall should
        //     result in the Holds of the Rec being reduced to 1. Then,
        //     Check if there really is only one Hold left. If so, all
        //     good. Otherwise, whoever was Holding the Rec, but didn't
        //     react to its DrierNozz dripping, is out of luck
        
        let t1 = dbtHut.createRec('dbt.thing1', { hut: dbtHut }, `thing1@${cnt}`);
        console.log(`ADD ${t1.desc()}`);
        
        if (!((cnt - 1) % 3)) {
          let t2 = dbtHut.createRec('dbt.thing2', { hut: dbtHut, t11: rndRec('dbt.thing1'), t12: rndRec('dbt.thing1') }, `thing2@${cnt}`);
          console.log(`ADD ${t2.desc()}`);
        }
        
        if (!((cnt - 2) % 4)) {
          let del = rndRec('dbt.thing1');
          console.log(`REM ${del.desc()}`);
          del.dry();
        }
        
        await Promise(r => setTimeout(r, 20)); // Just to get ahead of the sync-throttle-delay
        
        cnt++;
        
        let fullSync = await db.getFullSync();
        console.log(`ALL RECS [${db.netRecs.size} vs ${fullSync.length}] (${db.diskQueueLen}):`);
        fullSync.forEach(({ type, uid, val, mems }) => {
          console.log(`    ${type.padTail(15)}${uid.padTail(15)}: ${mems.toArr((v, k) => `${k}@${v}`).join(', ')}`);
        });
        
      };
      f(); setInterval(f, 3000);
      
      RecScope(dbtHut, 'dbt.thing1/hut', (thing1, dep) => dep(dbHut.followRec(thing1)));
      RecScope(dbtHut, 'dbt.thing2/hut', (thing2, dep) => dep(dbHut.followRec(thing2)));
      
      /// =ABOVE}
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('dbt', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        real('main', CenteredSlotter);
        real('content', () => TextSized({ size: UnitPx(40) }));
        
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        insert('main -> content', sl => sl.getCenteredSlot());
        
        decals('root', { colour: '#4020a0', textColour: '#ffffff' });
        
      });
      
      let webApp = WebApp('dbt');
      await webApp.decorateHut(dbtHut, rootReal);
      
      /// {BELOW=
      let dbtRootReal = rootReal.techReals[0].addReal('dbt.root');
      let mainReal = dbtRootReal.addReal('dbt.main');
      let contentReal = mainReal.addReal('dbt.content');
      contentReal.setText('DB Test');
      /// =BELOW}
      
    };
    
    return { open };
    
  }
});
