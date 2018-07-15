U.makeTwig({ name: 'test', twigs: [ 'clearing', 'record', 'hinterlands', 'real' ], make: (test, clearing, record, hinterlands, real) => {
  
  let { Val, Obj, Arr, Editor } = record;
  let { ClassicHtmlRealizer, Real, RealObj, RealArr, RealStr } = real;
  let { OutlineHinterlands, OutlinePassage, PassageHttp, PassageSokt } = hinterlands;
  
  let otlHut = Obj({ name: 'hut' });
  
  let otlTitle = otlHut.add(Val({ name: 'title' }));
  
  let otlLands = otlHut.add(OutlineHinterlands({ name: 'lands', deployment: clearing.deployment }));
  
  let otlRoomSet = otlLands.add(Arr({ name: 'roomSet' }));
  let otlRoom = otlRoomSet.setTemplate(Obj({ name: 'room' }), room => room.getChild('name').value);
  otlRoom.add(Val({ name: 'name' }));
  otlRoom.add(Val({ name: 'createdMs' }));
  otlRoom.add(Val({ name: 'whiteMoniker' }));
  otlRoom.add(Val({ name: 'blackMoniker' }));
  
  let otlPieceSet = otlRoom.add(Arr({ name: 'pieceSet' }));
  let otlPiece = otlPieceSet.setTemplate(Obj({ name: 'piece' }), piece => piece.getChild('desc').value);
  otlPiece.add(Val({ name: 'desc' }));
  otlPiece.add(Val({ name: 'colour' }));
  otlPiece.add(Val({ name: 'row' }));
  otlPiece.add(Val({ name: 'col' }));
  otlPiece.add(Val({ name: 'type' }));
  otlPiece.add(Val({ name: 'cooldown', defaultValue: 0 }));
  
  let otlPassages = otlLands.add(Obj({ name: 'passages' }));
  otlPassages.add(OutlinePassage({ name: 'http', recCls: PassageHttp, hinterlands: otlLands }));
  // otlPassages.add(OutlinePassage({ name: 'sokt', recCls: PassageSokt, hinterlands: otlLands }));
  
  let editor = Editor();
  let hut = global.hut = editor.shape({ assumeType: 'exact', outline: otlHut, data: {
    title: 'chess 2',
    lands: {
      roomSet: {
      }
    }
  }});
  editor.run();
  
  let lands = hut.getChild('lands');
  let walkers = lands.getChild('walkers');
  
  /// {SERVER=
  
  lands.addUpdateFunc('loginTemp', (walker, moniker) => {
    
    // The update to the walker isn't broadcast
    let editor = Editor();
    editor.shape({ rec: walker, data: { type: 'delta', children: {
      personaMoniker: moniker
    }}});
    
    // The update to the persona is public
    lands.update(lands.getChild('personas'), { type: 'delta', add: {
      [ moniker ]: { type: 'exact', children: {
        moniker: moniker
      }}
    }});
    
  });
  
  /*
  let roomCnt = 0;
  let waiting = [];
  
  walkers.hold('walkers', delta => {
    
    let editor = Editor();
    
    let timeMs = U.timeMs();
    let add = delta.add;
    let rem = delta.rem;
    let roomSet = lands.getChild('roomSet');
    
    A.each(rem, remWalker => {
      
      // If it was a waiting walker who left, simply remove it from waiting
      if (rem === waiting) { waiting = null; return; }
      
      // If the walker who left was in a room, delete the room
      // TODO: This will result in a jarring exit from the room. Would be
      // better for the room to remain, with an "OPPONENT GONE" message
      // and review screen for the one remaining player.
      O.each(roomSet.children, room => {
        if (rem === room.getChild('@whitePlayer') || rem === room.getChild('@blackPlayer')) {
          lands.update(roomSet, { type: 'delta', rem: { 0: room.name }});
        }
      });
      
    });
    
    waiting = A.include(waiting, add);
    while (waiting.length >= 2) {
      
      let whiteWalker = waiting.shift();
      let blackWalker = waiting.shift();
      
      if (Math.random() > 0.5) {
        let tmp = whiteWalker;
        whiteWalker = blackWalker;
        blackWalker = tmp;
      }
      
      lands.update(roomSet, { type: 'delta', add: {
        0: { type: 'exact', children: {
          
          name: 'room' + (1 + roomCnt++),
          createdMs: timeMs,
          whiteIp: whiteWalker.getChild('ip').value,
          blackIp: whiteWalker.getChild('ip').value
          
        }}
      }});
      
    }
    
  });
  */
  
  /// =SERVER} {CLIENT=
  
  // TODO: would be BEAUTIFUL if there was server-side realization as well
  // through Electron or some kinda GUI tool (maybe even custom????)
  
  let realizer = ClassicHtmlRealizer();
  
  let realHut = RealObj({ name: 'hut', realizer });
  let realTitle = realHut.add(RealStr({ name: 'title', realizer, rec: hut.getChild('title') }));
  
  (async () => {
    
    await realizer.ready;
    realHut.up();
    await lands.catchUp();
    
  })();
  
  /// =CLIENT}
  
}});
