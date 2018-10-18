U.makeTwig({ name: 'chess2', twigs: [ 'record', 'hinterlands', 'persona', 'real' ], make: (chess2, record, hinterlands, persona, real) => {
  
  let { WobblyResult, WobblyValue } = U;
  let { Val, Obj, Arr, Editor } = record;
  let { ConstantFashion, DiscreetFashion, ContinuousFashion, Real, RealStr, RealObj, RealArr } = real;
  
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
    setupRealizer: (realizer) => {
      
      console.log('HERE');
      
      realizer.addFashion(ConstantFashion('root', {
        satisfies: {
          type: 'root'
        },
        purpose: {
          type: 'quad',
          corners: { tl: 'tSide', tr: 'tSide', bl: 'bSide', br: 'bSide' }
        },
        looks: {
          fill: { colour: '#404040' }
        }
      }));
      
      realizer.addFashion(ConstantFashion('root.title', {
        satisfies: {
          type: 'tSide',
          heightFixed: 50
        },
        purpose: {
          type: 'text'
        },
        looks: {
          fill: { colour: '#804040' },
          stroke: { width: 4, colour: '#a05050' }
        }
      }));
      
      realizer.addFashion(ConstantFashion('root.meta', {
        satisfies: {
          type: 'bSide',
          heightFixed: 30
        },
        purpose: {
          type: 'quad',
          corners: { tl: 'lSide', bl: 'lSide', tr: 'rSide', br: 'rSide' }
        },
        looks: {
          fill: 'rgba(0, 0, 0, 0.1)'
        }
      }));
      
      realizer.addFashion(ConstantFashion('root.meta.version', {
        satisfies: {
          type: 'rSide',
          widthFixed: 100
        },
        purpose: {
          type: 'text',
          align: 'center'
        },
        looks: {
          fill: 'rgba(0, 0, 0, 0.1)'
        }
      }));
      
      console.log(Object.keys(realizer.fashions));
      
      /*
      realizer.addFashion(ConstantFashion('meta', {
        'shape': 'rectangle',
        'shape.x': '100%',
        'shape.y': '50px',
        'layout': 'free',
        'layout.clamp': 'bl',
        'fill.colour': 'rgba(0, 0, 0, 0.2)',
        'purpose': 'footer'
      }));
      realizer.addFashion(ConstantFashion('meta.version', {
        'shape': 'rectangle',
        'shape.y': '50px',
        'layout': 'free',
        'layout.clamp': 'br',
        'fill.colour': 'rgba(0, 0, 0, 0.2)',
        'purpose': 'text'
      }));
      
      realizer.addFashion(ConstantFashion('board', {
        'shape': 'square',
        'shape.extent': '640px',
        'layout': 'free',
        'layout.clamp': 'center',
        'purpose': 'grid',
        'purpose.dimensions': '8x8'
      }));
      realizer.addFashion(ConstantFashion('board.square', {
        'shape': 'square',
        'shape.extent': '80px',
        'layout': 'fill',
        'purpose': 'grid.tile'
      }));
      
      realizer.addFashion(ConstantFashion('piece', {
        'shape': 'circle',
        'shape.radius': '50px',
        'layout': 'free',
        'layout.x.transition.duration': '1000ms',
        'layout.x.transition.formula': 'linear',
        'layout.y.transition.duration': '1000ms',
        'layout.y.transition.formula': 'linear',
        'stroke.transition.duration': '1000ms',
        'stroke.transition.formula': 'linear'
      }));
      realizer.addFashion(DiscreetFashion('piece.colour', {
        white: {
          'fill.colour': 'rgba(0, 0, 0, 0.1)'
        },
        black: {
          'fill.colour': 'rgba(255, 255, 255, 0.1)'
        }
      }));
      realizer.addFashion(DiscreetFashion('piece.cooldown', {
        ready: {
          'stroke.width': '5px',
          'stroke.colour': 'rgba(255, 0, 0, 0.4)'
        },
        waiting: {
          'stroke.width': '5px',
          'stroke.colour': 'rgba(255, 0, 0, 0)',
        }
      }));
      realizer.addFashion(ContinuousFashion('piece.offset.x', col => ({
        'layout.x': (col * 100).toString() + 'px'
      })));
      realizer.addFashion(ContinuousFashion('piece.offset.y', row => ({
        'layout.y': (row * 100).toString() + 'px'
      })));
      realizer.addFashion(ConstantFashion('piece.avatar.layout', {
        'shape': 'circle',
        'layout': 'fill',
        // 'layout.grow': '0'
      }));
      realizer.addFashion(DiscreetFashion('piece.avatar.look', A.toObj(
        [ 'pawn', 'knight', 'bishop', 'castle', 'queen', 'king' ],
        v => v,
        v => ({
          'fill.image.path': `piece/${v}.png`
        })
      )));
      */
      
    },
    realize: (lands, realizer, realLands) => {
      
      realLands.dress('root');
      
      let realMeta = realLands.add(RealObj({ name: 'meta' }));
      realMeta.dress('root.meta');
      
      let realMetaVersion = realMeta.add(RealStr({ name: 'version', wobbly: WobblyValue('Version: 0.0.1') }));
      realMetaVersion.dress('root.meta.version');
      
      let realChess2 = realLands.add(RealObj({ name: 'chess2' }));
      realChess2.add(RealStr({ name: 'title', wobbly: WobblyValue('Chess 2') }));
      
      let realRoomSet = realChess2.add(RealArr({ name: 'roomSet', wobbly: lands.getChild('objective.roomSet') }));
      let makeRealPiece = (piece) => {
        
        let realPiece = RealObj({ name: piece.name });
        realPiece.fashion('piece');
        realPiece.fashion('piece.colour', piece.getChild('colour'));
        realPiece.fashion('piece.cooldown', WobblyResult([ piece.getChild('cooldown') ], cd => cd ? 'waiting' : 'ready'));
        realPiece.fashion('piece.offset.x', piece.getChild('col'));
        realPiece.fashion('piece.offset.y', piece.getChild('row'));
        
        let realAvatar = realPiece.add(RealObj({ name: 'avatar' }));
        realAvatar.addFashion(piece.getChild('type'), fashion.piece.avatar.background);
        realAvatar.dress('piece.avatar.layout');
        realAvatar.dress('piece.avatar.look', piece.getChild('type'));
        
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
