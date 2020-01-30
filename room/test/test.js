U.buildRoom({
  name: 'test',
  innerRooms: [ 'record', 'hinterlands', 'realDom' ],
  build: (foundation, record, hinterlands, realDom) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    let { Reality } = realDom;
    
    let open = async () => {
      
      let parHut = await Hut.getRootHut(foundation, 'test', { heartMs: 1000 * 30 });
      
      /// {ABOVE=
      let reality = Reality('testyReality');
      await reality.prepareAboveHut(parHut);
      let test = parHut.createRec('test.test', [ parHut ], 'test app');
      /// =ABOVE}
      
      let rootScope = RecScope(parHut, 'test.test', (test, dep) => {
        
        console.log('GOT TESTTTT');
        
        dep.scp(parHut, 'lands.kidHut/par', (kidHut, dep) => {
          dep(kidHut.members.kid.followRec(test));
        });
        
      });
      
    };
    
    return { open };
    
  }
});
