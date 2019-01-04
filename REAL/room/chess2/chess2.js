U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { Record } = record;
    let { Lands, LandsRecord, Way, Hut, relLandsWays, relLandsRecs, relLandsHuts } = hinterlands;
    
    let Chess2 = U.inspire({ name: 'Chess2', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    let Match = U.inspire({ name: 'Match', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    let Player = U.inspire({ name: 'Player', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    let Board = U.inspire({ name: 'Board', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    let Piece = U.inspire({ name: 'Piece', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    let Move = U.inspire({ name: 'Move', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    
    let rel = {
      matches:          Record.relate1M(Record.stability.dynamic, Chess2, Match, 'matches'),
      playerHut:        Record.relate11(Record.stability.dynamic, Player, Hut, 'playerHut'),
      playersWaiting:   Record.relate1M(Record.stability.dynamic, Chess2, Player, 'playersWaiting'),
      playersPlaying:   Record.relate1M(Record.stability.dynamic, Chess2, Player, 'playersPlaying'),
      matchPlayerWhite: Record.relate11(Record.stability.dynamic, Match, Player, 'matchPlayerWhite'),
      matchPlayerBlack: Record.relate11(Record.stability.dynamic, Match, Player, 'matchPlayerBlack'),
      matchBoard:       Record.relate11(Record.stability.dynamic, Match, Board, 'matchBoard'),
      playerBoard:      Record.relate1M(Record.stability.dynamic, Board, Player, 'playerBoard'),
      boardPieces:      Record.relate1M(Record.stability.dynamic, Board, Piece, 'boardPieces'),
      piecePlayer:      Record.relate1M(Record.stability.dynamic, Player, Piece, 'piecePlayer'),
      playerMove:       Record.relate11(Record.stability.dynamic, Player, Move, 'playerMove')
    };
    
    return {
      open: async () => {
        console.log('Init chess2...');
        
        let records = [ Chess2, Match, Player, Board, Piece ];
        let relations = rel.toArr(v => v);
        
        let lands = U.lands = Lands({
          foundation,
          commands: Lands.defaultCommands.map(v => v),
          records,
          relations,
          getRecsForHut: (lands, hut) => lands.getInnerVal(relLandsRecs)
        });
        
        let validMoves = (board, piece) => {
          // Make a nice 2d representation of the board
          let calc = Array.fill(8, () => Array.fill(8, () => null));
          let pieces = board.getInnerVal(rel.boardPieces);
          pieces.forEach(piece => {
            let { x, y } = piece.value;
            calc[x][y] = piece;
          });
          
          // Utility func for checking tiles
          let checkTile = (x, y) => (x < 0 || x > 7 || y < 0 || y > 7) ? 'OOB' : calc[x][y];
          
          let { type, colour, x, y } = piece.value;
          if (piece !== checkTile(x, y)) throw new Error('Piece not found on board');
          
          let moves = [];
          
          if (type === 'pawn') {
            
            let dir = colour === 'white' ? 1 : -1;
            let initY = colour === 'white' ? 1 : 6;
            
            if (!checkTile(x, y + dir)) {
              moves.push([ x, y + dir ]); // Add first step if unblocked
              if (y === initY && !checkTile(x, y + dir + dir)) {
                moves.push([ x, y + dir + dir ]); // Add second step if unblocked and unmoved
              }
            }
            
            // Check for captures in both directions
            let cap1 = checkTile(x - 1, y + dir);
            if (cap1 && cap1 !== 'OOB' && cap1.value.colour !== colour) moves.push([ x - 1, y + dir ]);
            
            let cap2 = checkTile(x + 1, y + dir);
            if (cap2 && cap2 !== 'OOB' && cap2.value.colour !== colour) moves.push([ x + 1, y + dir ]);
            
          } else if (type === 'knight') {
            
            let offsets = [
              [ -2, -1 ], [ -2, 1 ], [ -1, 2 ], [ 1, 2 ], [ 2, 1 ], [ 2, -1 ], [ 1, -2 ], [ -1, -2 ]
            ];
            offsets.forEach(([ dx, dy ]) => {
              let [ xx, yy ] = [ x + dx, y + dy ];
              let check = checkTile(xx, yy);
              if (!check || (check !== 'OOB' && check.value.colour !== colour)) moves.push([ xx, yy ]);
            });
            
          } else if ([ 'bishop', 'rook', 'queen', 'king' ].has(type)) {
            
            let diag = [ [ -1, -1 ], [ -1, +1 ], [ +1, +1 ], [ +1, -1 ] ];
            let orth = [ [ -1, +0 ], [ +0, +1 ], [ +1, +0 ], [ +0, -1 ] ];
            let steps = [ 'queen', 'king' ].has(type) ? [].gain(diag).gain(orth) : (type === 'bishop' ? diag : orth);
            
            steps.forEach((dx, dy) => {
              
              let [ xx, yy ] = [ x, y ];
              while (true) {
                [ xx, yy ] = [ xx + dx, yy + dy ];
                
                let check = checkTile(xx, yy);
                
                // Stepping terminates at edge of board
                if (check === 'OOB') break;
                
                // Empty tiles and tiles with enemy pieces are valid
                if (!check || check.value.colour !== colour) moves.push([ xx, yy ]);
                
                // Finding a piece terminates stepping; kings always terminate after first step
                if (check || type === 'king') break;
              }
              
            });
            
          } else {
            
            throw new Error(`Invalid type: ${type}`);
            
          }
          
          return moves;
        };
        
        /// {ABOVE=
        lands.commands.gain({
          confirmMove: async (lands, hut, msg) => {
            
            let player = hut.getInnerVal(rel.playerHut);
            let playerPieces = player.getInnerVal(rel.piecePlayer);
            let movedPiece = playerPieces[msg.piece];
            
            console.log('MSG', msg);
            console.log('PP', playerPieces[msg.piece]);
            return;
            
            return;
            
            let { tile: [ x, y ] } = msg;
            
            piece.modify(v => v.gain({ x, y }));
            
            console.log('MOVE!');
            
            lands.getInnerVal(relLandsHuts).forEach(hut => hut.informBelow());
            //let hut = player.getInnerVal(rel.playerHut);
            //  hut.informBelow();
            
          }
        });
        
        
        let pieceDef = [
          [
            [ 'rook',     0, 0 ],
            [ 'knight',   1, 0 ],
            [ 'bishop',   2, 0 ],
            [ 'queen',    3, 0 ],
            [ 'king',     4, 0 ],
            [ 'bishop',   5, 0 ],
            [ 'knight',   6, 0 ],
            [ 'rook',     7, 0 ],
            [ 'pawn',     0, 1 ],
            [ 'pawn',     1, 1 ],
            [ 'pawn',     2, 1 ],
            [ 'pawn',     3, 1 ],
            [ 'pawn',     4, 1 ],
            [ 'pawn',     5, 1 ],
            [ 'pawn',     6, 1 ],
            [ 'pawn',     7, 1 ]
          ],
          [
            [ 'rook',     0, 7 ],
            [ 'knight',   1, 7 ],
            [ 'bishop',   2, 7 ],
            [ 'king',     3, 7 ],
            [ 'queen',    4, 7 ],
            [ 'bishop',   5, 7 ],
            [ 'knight',   6, 7 ],
            [ 'rook',     7, 7 ],
            [ 'pawn',     0, 6 ],
            [ 'pawn',     1, 6 ],
            [ 'pawn',     2, 6 ],
            [ 'pawn',     3, 6 ],
            [ 'pawn',     4, 6 ],
            [ 'pawn',     5, 6 ],
            [ 'pawn',     6, 6 ],
            [ 'pawn',     7, 6 ]
          ],
        ];
        
        let chess2 = Chess2({ lands });
        
        lands.getInnerWob(relLandsHuts).hold(({ add={}, rem={} }) => {
          
          add.forEach(hut => {
            
            let player = Player({ lands });
            player.wobble({ ip: hut.address });
            player.attach(rel.playerHut, hut);
            chess2.attach(rel.playersWaiting, player);
            
          });
          
        });
        
        // TODO: HEEERE!! Currently matchmaking occurs when 2 separate players join
        // - Tell clients which Player instance is theirs, so the board can know to flip
        //   and certain pieces can become unclickable
        // - Update clients with results of moves
        // - Allow for animation upon inevitable DOM element removal
        // - Win/loss/draw screen
        setInterval(() => {
          let playersWaiting = chess2.getInnerVal(rel.playersWaiting).toArr(v => v);
          playersWaiting.sort(() => 0.5 - Math.random());
          
          for (let i = 0; i < playersWaiting.length - 1; i += 2) {
            let [ p1, p2 ] = playersWaiting.slice(i, i + 2);
            if (Math.random() > 0.5) [ p1, p2 ] = [ p2, p1 ];
            
            chess2.detach(rel.playersWaiting, p1);
            chess2.detach(rel.playersWaiting, p2);
            chess2.attach(rel.playersPlaying, p1);
            chess2.attach(rel.playersPlaying, p2);
            
            let match = Match({ lands });
            let board = Board({ lands });
            chess2.attach(rel.matches, match);
            match.attach(rel.matchBoard, board);
            match.attach(rel.matchPlayerWhite, p1);
            match.attach(rel.matchPlayerBlack, p2);
            board.attach(rel.playerBoard, p1);
            board.attach(rel.playerBoard, p2);
            
            // Set up pieces for each player
            [ p1, p2 ].forEach((player, ind) => {
              pieceDef[ind].forEach(([ type, x, y ]) => {
                let piece = Piece({ lands });
                piece.wobble({ type, colour: !ind ? 'white' : 'black', x, y });
                board.attach(rel.boardPieces, piece);
                player.attach(rel.piecePlayer, piece);
              });
            });
            
            // Inform each player that they've entered a match
            [ p1, p2 ].forEach(player => {
              let hut = player.getInnerVal(rel.playerHut);
              hut.informBelow();
            });
          }
        }, 1000);
        
        /// =ABOVE} {BELOW=
        let { Real } = real;
        
        let myMatch = U.Wobbly({ value: null });
        let mySelectedPiece = U.Wobbly({ value: null });
        let mySelectedTile = U.Wobbly({ value: [ -1, -1 ] });
        let myTileClickers = U.Wobbly({ value: [] });
        let myPlayer = U.Wobbly({ value: null });
        
        let boardSize = 320;
        let tileW = Math.round(boardSize / 8);
        let tileHw = Math.round(tileW >> 1);
        let tileLoc = (x, y) => [ tileHw + (x - 4) * tileW, -tileHw + (4 - y) * tileW ];
        
        let genMatch = rec => {
          let real = Real({ flag: 'match' });
          real.setSize(500, 500);
          
          let boardReal = null;
          rec.getInnerWob(rel.matchBoard).hold(board => {
            if (boardReal) real.remReal(boardReal);
            if (!board) { boardReal = null; return; }
            boardReal = real.addReal(genBoard(board));
          });
          
          let whiteReal = null;
          rec.getInnerWob(rel.matchPlayerWhite).hold(white => {
            if (whiteReal) real.remReal(whiteReal);
            if (!white) { whiteReal = null; return; }
            whiteReal = real.addReal(Real({ flag: 'whitePlayer' }));
            whiteReal.setSize(500, 90);
            whiteReal.setLoc(0, 205);
            white.hold(v => {
              whiteReal.setText(`White: ${JSON.stringify(v)}`);
            });
          });
          
          let blackReal = null;
          rec.getInnerWob(rel.matchPlayerBlack).hold(black => {
            if (blackReal) real.remReal(blackReal);
            if (!black) { blackReal = null; return; }
            blackReal = real.addReal(Real({ flag: 'blackPlayer' }));
            blackReal.setSize(500, 90);
            blackReal.setLoc(0, -205);
            black.hold(v => {
              blackReal.setText(`Black: ${JSON.stringify(v)}`);
            });
          });
          
          return real;
        };
        
        let genBoard = rec => {
          let real = Real({ flag: 'board' });
          
          for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) ((x, y) => {
            let tileReal = real.addReal(Real({ flag: 'tile' }));
            let colour = (y % 2) === (x % 2) ? '#c8c8c8' : '#808080';
            tileReal.setSize(tileW, tileW);
            tileReal.setLoc(...tileLoc(x, y));
            tileReal.interactWob.hold(active => {
              if (!active) return;
              mySelectedPiece.wobble(null);
            });
            mySelectedTile.hold(([x0, y0]) => {
              tileReal.setColour((x0 === x && y0 === y) ? '#00c000' : colour);
            });
          })(x, y);
          
          let pieceReals = {};
          rec.getInnerWob(rel.boardPieces).hold(({ add={}, rem={} }) => {
            add.forEach((pieceRec, uid) => {
              pieceReals[uid] = genPiece(pieceRec);
              real.addReal(pieceReals[uid]);
            });
            rem.forEach((pieceRec, uid) => {
              real.remReal(pieceReals[uid]);
              delete pieceReals[uid];
            });
          });
          
          let tileSelectors = [];
          mySelectedPiece.hold(piece => {
            
            tileSelectors.forEach(real => real.rem());
            
            if (!piece) {
              tileSelectors = [];
            } else {
              let moves = validMoves(rec, piece);
              tileSelectors = moves.map(([ x, y ]) => {
                let tileReal = real.addReal(Real({}));
                tileReal.setSize(tileW, tileW);
                tileReal.setLoc(...tileLoc(x, y));
                tileReal.setColour('rgba(0, 255, 255, 0.7)');
                tileReal.interactWob.hold(active => {
                  if (!active) return;
                  console.log(`Move piece ${piece.value.type} to (${x}, ${y})`);
                  lands.getInnerVal(relLandsHuts).forEach(hut => {
                    hut.tell({
                      command: 'confirmMove',
                      piece: piece.uid,
                      tile: [ x, y ]
                    });
                  });
                });
                return tileReal;
              });
            }
            
          });
          
          real.setSize(320, 320);
          return real;
        };
        
        let genPiece = rec => {
          let real = Real({ flag: 'piece' });
          real.setColour('rgba(0, 0, 0, 0)');
          real.setBorderRadius(1);
          real.setSize(30, 30);
          
          let avatar = real.addReal(Real({ flag: 'avatar' }));
          avatar.setSize(30, 30);
          avatar.setColour('rgba(0, 0, 0, 0)');
          
          rec.hold(({ type, colour, x, y }) => {
            real.setLoc(...tileLoc(x, y));
            real.setColour(colour === 'white' ? '#ffffff' : '#000000');
            avatar.setText(type === 'knight' ? 'N' : type[0].upper());
            avatar.setTextColour(colour === 'white' ? '#000000' : '#ffffff');
          });
          
          let grip = real.addReal(Real({ flag: 'grip' }));
          grip.setColour('rgba(0, 0, 0, 0)');
          grip.setSize(tileW, tileW);
          grip.interactWob.hold(active => {
            if (!active) return;
            mySelectedPiece.wobble(rec);
          });
          
          mySelectedPiece.hold(piece => {
            real.setBorder('outer', 3, piece === rec ? 'rgba(0, 255, 255, 1)' : 'rgba(0, 0, 0, 0)');
          });
          
          return real;
        };
        
        let root = Real({ isRoot: true, flag: 'root' });
        let mainView = null;
        
        myMatch.hold(rec => {
          
          if (mainView) root.remReal(mainView);
          
          mainView = root.addReal(Real({}));
          if (!rec) {
            mainView.setSize(300, 300);
            mainView.setText('WAITING...');
            mainView.addFlag('waiting');
          } else {
            mainView.setSize(500, 500);
            mainView.addFlag('playing');
            mainView.addReal(genMatch(rec));
          }
          
        });
        
        lands.getInnerWob(relLandsRecs).hold(({ add={}, rem={} }) => {
          
          let matches = add.map(rec => rec.isInspiredBy(Match) ? rec : C.skip);
          let match = matches.find(() => true);
          
          if (match) myMatch.wobble(match[0]);
          
        });
        
        /// =BELOW}
        
        let way = Way({ lands, makeServer: foundation.makeHttpServer.bind(foundation, 'localhost', 80) }); // host: 'localhost', port: 80 });
        lands.attach(relLandsWays, way);
        await lands.open();
      }
    };
    
  }
});
