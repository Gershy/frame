U.buildRoom({
  name: 'test',
  innerRooms: [ 'hinterlands', 'chance', 'record', 'real' ],
  build: (foundation, hinterlands, chance, record, real) => {
    
    let { ip='localhost', port=80 } = foundation.raiseArgs;
    
    let { AccessPath } = U;
    let { Lands, Way } = hinterlands;
    let { Rec, recTyper } = record;
    
    let chn = chance.Chance();
    
    return { open: async () => {
      
      let { rt, add } = recTyper();
      add('item',     Rec);
      add('archItem', Rec, '1M', hinterlands.rt.arch, rt.item);
      
      let lands = U.lands = Lands({
        foundation, recTypes: { ...hinterlands.rt, ...rt }, heartbeatMs: 10000
      });
      let way = Way({ lands, makeServer: () => foundation.makeHttpServer(lands.pool, 'localhost', 80) });
      
      let root = null;
      
      /// {ABOVE=
      root = AccessPath(lands.arch.relWob(hinterlands.rt.archHut, 0), (dep, archHut) => {
        
        let [ _, hut ] = archHut.members;
        
        dep(AccessPath(lands.arch.relWob(rt.archItem, 0), (dep, archItem) => {
          
          let [ _, item ] = archItem.members;
          
          hut.followRec(archItem);
          hut.followRec(item);
          
        }));
        
      });
      
      let cnt = 0;
      setInterval(() => {
        
        let item = lands.createRec('item', { value: {
          type: 'type1',
          name: 'cool',
          index: cnt++
        }});
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        setTimeout(() => item.shut(), 2500); //chn.disc({500:2500}));
        
      }, 5000);
      
      /// =ABOVE} {BELOW=
      root = AccessPath(lands.arch.relWob(rt.archItem, 0), (dep, archItem) => {
        
        let [ _, item ] = archItem.members;
        console.log('ADD ITEM:', JSON.stringify(item.value, null, 2));
        dep(Hog( () => console.log('REM ITEM:', JSON.stringify(item.value, null, 2)) ));
        
      });
      /// =BELOW}
      
      await lands.open();
      
    }};
    
  }
});
