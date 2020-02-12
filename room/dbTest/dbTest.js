U.buildRoom({ name: 'dbTest',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term' ],
  build: (foundation, record, hinterlands, real, realWebApp, term) => {
    
    let { Drop, Nozz } = U.water;
    let { UnitPx } = real;
    let { FillParent, CenteredSlotter, MinExtSlotter, TextSized } = real;
    let { WebApp } = realWebApp;
    let { RecScope } = record;
    
    let open = async () => {
      
      let dbtHut = await foundation.getRootHut({ heartMs: 1000 * 40 });
      dbtHut.roadDbgEnabled = true; // TODO: This doesn't affect the Below!
      
      /// {ABOVE=
      
      let fakeServer = {};
      fakeServer.desc = 'FAKE server';
      fakeServer.decorateRoad = () => {};
      
      let { hut: dbHut } = dbtHut.processNewRoad(fakeServer, road => {
        road.hear = Nozz();
        road.hear.route((...args) => console.log('FAKE SERVER COMMANDS:', JSON.stringify(args, null, 2)));
        road.tell = (...args) => console.log('FAKE SERVER IS TOLD:', JSON.stringify(args, null, 2));
        road.currentCost = () => 0;
      });
      
      let dbt = dbtHut.createRec('dbt.dbTest', [ dbtHut ], 'I AM THE ROOT GUY');
      let thingA1 = dbtHut.createRec('dbt.thingA', [ dbt ], 'thingA1');
      let thingB1 = dbtHut.createRec('dbt.thingB', [ thingA1 ], 'thingB1');
      let thingB2 = dbtHut.createRec('dbt.thingB', [ thingA1 ], 'thingB2');
      let thingC1 = dbtHut.createRec('dbt.thingC', [ thingA1, thingB1 ], 'thingC1');
      let thingC2 = dbtHut.createRec('dbt.thingC', [ thingA1, thingB2 ], 'thingC2');
      
      setTimeout(() => thingC1.dry(), 2000);
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
