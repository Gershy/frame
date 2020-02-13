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
      
      let DbRam = U.inspire({ name: 'DbRam', methods: (insp, Insp) => ({
        init: function() {
          this.version = 0;
          this.recs = {};
          
          // `DbRam` is permanently stable - this is because it is
          // completely synchronous.
          this.stableNozz = TubVal(null, Nozz());
          this.stableNozz.nozz.drip(Drop());
        },
        doSync: function({ version, content: { add=[], upd=[], rem=[] } }) {
          
          // TODO: Pay attention to `version`! May need to buffer syncs
          // which come out-of-order!
          
          let recs = this.recs;
          for (let addRec of add) recs[addRec.uid] = addRec;
          for (let { uid, val } of upd) recs[uid].val = val;
          for (let uid of rem) this.deleteWithDependencies(uid);
        },
        deleteWithDependencies: function(uid) {
          
          if (!this.recs.has(uid)) return;
          
          // Delete the Rec itself
          delete this.recs[uid];
          
          // Now delete every GroupRec with `uid` as a MemberRec...
          let deps = this.recs.map(rec => rec.mems.find(memberUid => memberUid === uid) ? rec : C.skip);
          for (let groupUid in deps) this.deleteWithDependencies(groupUid);
          
        }
      })});
      let DbSaved = U.inspire({ name: 'DbSaved', methods: (insp, Insp) => ({
        init: function(rootLoc=[ 'mill', 'db', 'default' ]) {
          
          // TODO: HEEERE! Working with the filesystem through the
          // abstract layer of "Saved" SUCKS BIG TIME. How do I even
          // create a directory? Or delete a directory? Really the
          // filesystem is a whole bunch of nested "Saveds", a *very*
          // awkward plural. We could say that only files can be deleted
          // and a directory should automatically be deleted when it
          // contains no more files. So want to delete a directory?
          // Just delete all its files.
          
          // That's the least of our concerns. Dbs should be able to run
          // in a separate thread (this is actually quite important for
          // performance!!). Think about how the Hut can be aware that
          // the Db is "stable" (i.e it is in a good state to shut down,
          // it isn't midway through a sync where the file for a
          // MemberRec has been written, but the GroupRecs haven't been
          // written yet). Can also think about dealing with volatility.
          // If the power-chord is yanked halfway through a sync, should
          // be able to recover to a stable state when the Hut is run
          // again!
          
        }
      })});
      
      let db = DbRam();
      
      let { hut: dbHut } = dbtHut.processNewRoad(fakeServer, road => {
        road.hear = Nozz();
        road.currentCost = () => 0;
        
        road.hear.route((...args) => console.log('DB COMMANDS HUT:', args));
        road.tell = sync => db.doSync(sync);
      });
      
      let dbt = dbtHut.createRec('dbt.dbTest', [ dbtHut ], 'I AM THE ROOT GUY');
      let thingA1 = dbtHut.createRec('dbt.thingA', [ dbt ], 'thingA1');
      let thingB1 = dbtHut.createRec('dbt.thingB', [ thingA1 ], 'thingB1');
      let thingB2 = dbtHut.createRec('dbt.thingB', [ thingA1 ], 'thingB2');
      let thingC1 = dbtHut.createRec('dbt.thingC', [ thingA1, thingB1 ], 'thingC1');
      let thingC2 = dbtHut.createRec('dbt.thingC', [ thingA1, thingB2 ], 'thingC2');
      
      let thingHH = dbtHut.createRec('dbt.thingH', [ thingB1, thingB1 ], 'thingHHLAWL');
      
      setTimeout(() => thingB1.dry(), 2000);
      setTimeout(() => dbtHut.createRec('dbt.thingC', [ thingA1, thingB2 ], 'new-improved-C2-BOI'), 4000);
      
      let rootScp = RecScope(dbtHut, 'dbt.dbTest', (dbTest, dep) => {
        
        dep(dbHut.followRec(dbTest));
        
        dep.scp(dbTest, 'dbt.thingA', (thingA, dep) => {
          
          dep(dbHut.followRec(thingA));
          
          dep.scp(thingA, 'dbt.thingB', (thingB, dep) => {
            
            dep(dbHut.followRec(thingB));
            
            dep.scp(thingB, 'dbt.thingC', (thingC, dep) => {
              
              dep(dbHut.followRec(thingC));
              
            });
            
          });
          
        });
        
        
      });
      
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
