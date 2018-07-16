U.makeTwig({ name: 'chess2', twigs: [ 'clearing', 'record', 'hinterlands', 'persona', 'real' ], make: (chess2, clearing, record, hinterlands, persona, real) => {
  
  let { Val, Obj, Arr, Editor } = record;
  let { ClassicHtmlRealizer, Real, RealObj, RealArr, RealStr } = real;
  let { OutlineHinterlands, OutlinePassage, PassageHttp, PassageSokt } = hinterlands;
  
  let otlLands = OutlineHinterlands({ name: 'lands', deployment: clearing.deployment });
  let otlObjective = otlLands.getChild('objective');
  
  persona.install(otlLands);
  
  let otlTitle = otlObjective.add(Val({ name: 'title' }));
  
  let otlRoomSet = otlObjective.add(Arr({ name: 'roomSet' }));
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
  
  /// {SERVER=
  let data = {
    objective: {
      title: 'chess 2',
      roomSet: {
      }
    }
  };
  /// =SERVER} {CLIENT=
  let data = {
    hutSet: global.INITIAL_HUT_SET_DATA,
    objective: global.INITIAL_CATCH_UP_DATA
  };
  /// =CLIENT}
  
  let editor = Editor();
  let lands = global.lands = editor.shape({ outline: otlLands, assumeType: 'exact', data });
  editor.run();
  
  /// {CLIENT=
  lands.updateFrameId(global.INITIAL_FRAME_ID);
  /// =CLIENT}
  
  /// {CLIENT=
  
  // TODO: would be BEAUTIFUL if there was server-side realization as well
  // through Electron or some kinda GUI tool (maybe even custom????)
  /*
  let realizer = ClassicHtmlRealizer();
  
  let realLands = RealObj({ name: 'lands', realizer });
  let realTitle = realLands.add(RealStr({ name: 'title', realizer, rec: realLands.getChild('objective.title') }));
  
  (async () => {
    
    await realizer.ready;
    realLands.up();
    
  })();
  */
  /// =CLIENT}
  
}});
