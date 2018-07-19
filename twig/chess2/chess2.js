U.makeTwig({ name: 'chess2', twigs: [ 'record', 'hinterlands', 'persona', 'real' ], make: (chess2, record, hinterlands, persona, real) => {
  
  let { WobblyResult, WobblyValue } = U;
  let { Val, Obj, Arr, Editor } = record;
  let { RealStr, RealObj, RealArr } = real;
  
  O.include(chess2, {
    outline: (otlLands) => {
      
      persona.outline(otlLands);
      
      let otlObjective = otlLands.getChild('objective');
      
      let otlTitle = otlObjective.add(Val({ name: 'title'}));
      
      let otlRoomSet = otlObjective.add(Arr({ name: 'roomSet' }));
      let otlRoom = otlRoomSet.setTemplate(Obj({ name: 'room' }), room => room.getChild('name').value);
      otlRoom.add(Val({ name: 'name' }));
      otlRoom.add(Val({ name: 'createdMs' }));
      otlRoom.add(Val({ name: 'whiteMoniker' }));
      otlRoom.add(Val({ name: 'blackMoniker' }));
      
      otlRoom.addRelator('whitePersona', room => [ hut.getChild('whiteMoniker') ], (room, moniker) => {
        return room.getPar(otlLands).getChild([ 'objective', 'personaSet', moniker ]);
      });
      otlRoom.addRelator('blackPersona', room => [ hut.getChild('blackMoniker') ], (room, moniker) => {
        return room.getPar(otlLands).getChild([ 'objective', 'personaSet', moniker ]);
      });
      
      let otlPieceSet = otlRoom.add(Arr({ name: 'pieceSet' }));
      let otlPiece = otlPieceSet.setTemplate(Obj({ name: 'piece' }), piece => piece.getChild('desc').value);
      otlPiece.add(Val({ name: 'desc' }));
      otlPiece.add(Val({ name: 'colour' }));
      otlPiece.add(Val({ name: 'row' }));
      otlPiece.add(Val({ name: 'col' }));
      otlPiece.add(Val({ name: 'type' }));
      otlPiece.add(Val({ name: 'cooldown', defaultValue: 0 }));
      
      otlPiece.addRelator('persona',
        piece => [
          piece.getChild('colour'),
          piece.getPar(otlRoom).getChild('whiteMoniker'),
          piece.getPar(otlRoom).getChild('blackMoniker')
        ],
        (piece, colour, whiteMoniker, blackMoniker) => {
          return piece.getPar(otlLands).getChild([ 'objective', 'personaSet', colour === 'white' ? whiteMoniker : blackMoniker ]);
        }
      );
      
    },
    realize: (lands, realLands) => {
      
      let realizer = realLands.realizer;
      let pieceAvatarFashions = {
        pawn: realizer.genFashion({}),
        knight: realizer.genFashion({}),
        bishop: realizer.genFashion({}),
        castle: realizer.genFashion({}),
        queen: realizer.genFashion({}),
        king: realizer.genFashion({})
      };
      
      let realMeta = realLands.add(RealObj({ name: 'meta' }));
      realMeta.add(RealStr({ name: 'version', wobbly: WobblyValue('Version: 0.0.1') }));
      
      let realChess2 = realLands.add(RealObj({ name: 'chess2' }));
      realChess2.add(RealStr({ name: 'title', wobbly: WobblyValue('Chess 2') }));
      
      let realRoomSet = realChess2.add(RealArr({ name: 'roomSet', wobbly: lands.getChild('objective.roomSet') }));
      let makeRealPiece = (piece) => {
        
        let realPiece = RealObj({ name: piece.name });
        let realAvatar = realPiece.add(RealObj({ name: 'avatar' }));
        
        realAvatar.fashion(WobblyResult({
          wobblies: piece.getChild('type'),
          calc: type => pieceAvatarFashions[type];
        }));
        
        return realPiece;
        
      };
      let makeRealRoom = (room) => {
        
        let realRoom = RealObj({ name: room.name });
        let realBoard = realRoom.add(RealArr({ name: 'board' }));
        realBoard.setTemplate(makeRealPiece);
        return realRoom;
        
      };
      realRoomSet.setTemplate(makeRealRoom);
      
    }
  });
  
}});
