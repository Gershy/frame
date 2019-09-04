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
      add('hutAuthor',      Rec,  '11',   hinterlands.rt.hut,   rt.author);
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
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer(lands.pool, 'localhost', 80) }));
      
      let root = null;
      
      let arch = VertScope();
      let hut = arch.dive(arch => arch.relWob(rt.archHut, 0)).dive(archHut => WobVal(archHut.members[1]));
      let mesh = arch.dive(arch => arch.relWob(rt.archMesh, 0)).dive(archMesh => WobVal(archMesh.members[1]));
      let story = mesh.dive(mesh => mesh.relWob(rt.meshStory, 0)).dive(meshStory => WobVal(meshStory.members[1]));
      
      /// {ABOVE=
      
      let authorLogin = hut
        .dive(hut => hut.comWob('author'))
        .dive((dep, [ { lands, hut, msg } ]) => {
          
          if (hut.relVal(rt.hutAuthor, 0).size) {
            hut.tell({ command: 'error', type: 'alreadyHasHut', orig: msg });
            return Wob(); // Won't ever wobble
          }
          
          let { username, password } = msg;
          
          // TODO: HEEERE! Get list of all authors; try to match one
          // TODO: Returning falsy thing should be same as returning `Wob`
          let matchingAuthors = ???;
          let author = matchingAuthors
            .find(author => author.value.username === username && author.value.password === password);
          
          if (!author) {
            hut.tell({ command: 'error', type: 'invalidCreds', orig: msg });
            return Wob();
          }
          
        });
      
      let hutGetsAuthor = hut
        .dive(hut => hut.relWob(rt.hutAuthor, 0))
        .dive(hutAuthor => WobVal(hutAuthor.members[1]));
      
      hut.hold((dep, [ hut ]) => {
        
        dep(mesh.hold((dep, [ mesh, archMesh ]) => {
          
          dep(hut.followRec(mesh));
          dep(hut.followRec(archMesh));
          
        }));
        
        dep(story.hold((dep, [ story, meshStory ]) => {
          
          dep(hut.followRec(story));
          dep(hut.followRec(meshStory));
          
        }));
        
      });
      
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
        .dive(archMesh => WobVal(archMesh.members[1]));
      
      let storyScp = meshScp
        .dive(mesh => mesh.relWob(rt.meshStory, 0))
        .dive(meshStory => WobVal(meshStory.members[1]));
      
      meshScp.hold((dep, [ mesh ]) => console.log('MESH:', mesh));
      storyScp.hold((dep, [ story ]) => console.log('STORY:', story));
      
      archScp.trackWob(lands.arch);
      
      /// =BELOW}

      arch.trackWob(lands.arch);
      await lands.open();
      
    }};
    
  }
});
