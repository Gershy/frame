U.buildRoom({
  name: 'test',
  innerRooms: [ 'hinterlands', 'chance', 'record', 'real' ],
  build: (foundation, hinterlands, chance, record, real) => {
    
    let { ip='localhost', port=80 } = foundation.raiseArgs;
    
    let { HorzScope, Wob, Hog } = U;
    let { Lands, Way } = hinterlands;
    let { Rec, recTyper } = record;
    
    let chn = chance.Chance();
    
    return { open: async () => {
      
      let { rt, add } = recTyper();
      add('mesh',           Rec);
      add('archMesh',       Rec,  '11',   hinterlands.rt.arch,  rt.mesh);
      add('author',         Rec);
      add('meshAuthor',     Rec,  '1M',   rt.mesh,              rt.author);
      add('story',          Rec);
      add('meshStory',      Rec,  '1M',   rt.mesh,              rt.story);
      add('storyCreator',   Rec,  '11',   rt.story,             rt.author);
      add('storyAuthor',    Rec,  'MM',   rt.story,             rt.author);
      add('round',          Rec);
      add('storyRound',     Rec,  '1M',   rt.story,             rt.round);
      add('storyCurRound',  Rec,  '11',   rt.story,             rt.round);
      add('entry',          Rec);
      add('entryAuthor',    Rec,  'M1',   rt.entry,             rt.author);
      add('roundEntry',     Rec,  '1M',   rt.round,             rt.entry);
      
      rt = { ...hinterlands.rt, ...rt }; // TODO: Conflicts could occur...
      let lands = U.lands = Lands({ foundation, recTypes: rt, heartbeatMs: 10000 });
      let way = Way({ lands, makeServer: () => foundation.makeHttpServer(lands.pool, 'localhost', 80) });
      
      
      let root = null;
      
      /// {ABOVE=
      
      root = HorzScope(lands.arch.relWob(rt.archMesh, 0), (dep, archMesh) => {
        
        let [ arch, mesh ] = archMesh.members;
        console.log('Got mesh!!', mesh);
        
        dep(HorzScope(arch.relWob(rt.archHut, 0), (dep, archHut) => {
          
          let [ arch, hut ] = archHut.members;
          
          dep(hut.followRec(mesh));
          dep(hut.followRec(archMesh));
          
          dep(HorzScope(mesh.relWob(rt.meshStory, 0), (dep, meshStory) => {
            
            let [ mesh, story ] = meshStory.members;
            
            dep(hut.followRec(story));
            dep(hut.followRec(meshStory));
            
          }));
          
        }));
        
        let cnt = 0;
        setInterval(() => {
          
          let story = lands.createRec('story', { value: `STORY #${cnt++}` });
          let meshStory = lands.createRec('meshStory', {}, mesh, story);
          console.log('Created...');
          
          //setTimeout(() => story.shut(), 2500);
          
        }, 5000);
        
      });
      
      let mesh = lands.createRec('mesh', { value: 'I am the mesh!' });
      let archMesh = lands.createRec('archMesh', {}, lands.arch, mesh);
      
      /// =ABOVE} {BELOW=
      
      let archScp = VertScope();
      let meshScp = archScp
        .dive(arch => arch.relWob(rt.archMesh, 0))
        .memberDive(1);
      
      let storyScp = meshScp
        .dive(mesh => mesh.relWob(rt.meshStory, 0))
        .memberDive(1);
      
      meshScp.act(([ mesh ]) => console.log('MESH:', mesh));
      storyScp.act(([ story ]) => console.log('STORY:', story));
      
      archScp.trackWob(lands.arch);
      
      /// =BELOW}
      
      await lands.open();
      
    }};
    
  }
});
