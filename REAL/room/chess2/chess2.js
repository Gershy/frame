// FOR PRODUCTION:
// [ ]  Piece avatar images
// [X]  Ensure that requests and responses don't desync when necessary
// [ ]  Move timer (prevent indefinite stalls)
// [ ]  Replay button
// [ ]  Detect idle clients; remove them
// [ ]  Simple usernames, restricted in length

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
        this.move = U.Wobbly({ value: null });
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
            
            steps.forEach(([dx, dy]) => {
              
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
            
            if (!playerPieces.has(msg.piece)) return hut.tell({ command: 'error', type: 'pieceNotFound', orig: msg });
            
            player.move.wobble({
              piece: playerPieces[msg.piece],
              tile: msg.tile
            });
          }
        });
        
        [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ].forEach(
          // TODO: shouldn't need to include "room/chess2"
          // The instance of `foundation` received should be specialized for this 1 room
          pieceName => foundation.addMountFile(`img/${pieceName}.png`, `room/chess2/img/stackPieces/${pieceName}.png`, 'image/png')
        );
        
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
        
        // Make a Player for each Hut
        lands.getInnerWob(relLandsHuts).hold(({ add={}, rem={} }) => {
          add.forEach(hut => {
            let player = Player({ lands });
            player.wobble({ term: hut.getTerm(), gameStatus: 'waiting' });
            player.attach(rel.playerHut, hut);
            chess2.attach(rel.playersWaiting, player);
          });
        });
        
        // TODO: HEEERE!!
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
                piece.wobble({ type, colour: !ind ? 'white' : 'black', wait: 0, x, y });
                board.attach(rel.boardPieces, piece);
                player.attach(rel.piecePlayer, piece);
              });
            });
            
            // Mark the players as playing
            [ p1, p2 ].forEach(player => player.modify(v => v.gain({ gameStatus: 'playing' })));
            
            // Inform each player that they've entered a match
            [ p1, p2 ].forEach(player => {
              let hut = player.getInnerVal(rel.playerHut);
              hut.informBelow();
            });
            
            // Resolve moves when both players have confirmed
            U.CalcWob({ wobs: [ p1.move, p2.move ], func: (p1Move, p2Move) => {
              if (!p1Move || !p2Move) return;
              
              let pieces = board.getInnerVal(rel.boardPieces);
              
              // All pieces can wait 1 turn less
              pieces.forEach(piece => piece.value.wait ? piece.modify(v => v.gain({ wait: v.wait - 1 })) : null);
              
              let { piece: p1Piece, tile: [ p1X, p1Y ] } = p1Move;
              let { piece: p2Piece, tile: [ p2X, p2Y ] } = p2Move;
              
              // Update the 2 moved pieces
              p1Piece.modify(v => v.gain({ x: p1X, y: p1Y, wait: 1 }));
              p2Piece.modify(v => v.gain({ x: p2X, y: p2Y, wait: 1 }));
              
              // Identify collided pieces...
              let p1Trgs = pieces.map(p => (p !== p1Piece && p.value.x === p1X && p.value.y === p1Y) ? p : C.skip);
              let p2Trgs = pieces.map(p => (p !== p2Piece && p.value.x === p2X && p.value.y === p2Y) ? p : C.skip);
              
              // And remove them
              p1Trgs.forEach(pc => lands.remRec(pc));
              p2Trgs.forEach(pc => lands.remRec(pc));
              
              // Check if either player has captured the others' king
              let p1Wins = !!p1Trgs.find(piece => piece.value.type === 'king');
              let p2Wins = !!p2Trgs.find(piece => piece.value.type === 'king');
              
              if (p1Wins || p2Wins) {
                if (p1Wins && p2Wins) {
                  p1.modify(v => v.gain({ gameStatus: 'stalemated' }));
                  p2.modify(v => v.gain({ gameStatus: 'stalemated' }));
                } else if (p1Wins) {
                  p1.modify(v => v.gain({ gameStatus: 'victorious' }));
                  p2.modify(v => v.gain({ gameStatus: 'defeated' }));
                } else if (p2Wins) {
                  p1.modify(v => v.gain({ gameStatus: 'defeated' }));
                  p2.modify(v => v.gain({ gameStatus: 'victorious' }));
                }
              }
              
              // Inform the 2 players of the updates
              [ p1, p2 ].forEach(player => player.getInnerVal(rel.playerHut).informBelow());
              
              p1.move.wobble(null);
              p2.move.wobble(null);
            }});
            
          }
        }, 2000);
        
        /// =ABOVE} {BELOW=
        
        let { Real } = real;
        
        let myMatch = U.Wobbly({ value: null });
        let mySelectedPiece = U.Wobbly({ value: null });
        let myConfirmedPiece = U.Wobbly({ value: null });
        let myConfirmedTile = U.Wobbly({ value: [ -1, -1 ] });
        let myTileClickers = U.Wobbly({ value: [] });
        let myPlayer = U.Wobbly({ value: null });
        let myColour = U.Wobbly({ value: null });
        let myGameStatus = U.Wobbly({ value: 'waiting' });
        
        let colours = {
          clear: 'rgba(0, 0, 0, 0)',
          whiteTile: 'rgba(170, 170, 170, 1)',
          blackTile: 'rgba(140, 140, 140, 1)',
          whitePiece: 'rgba(205, 205, 205, 0.9)',
          blackPiece: 'rgba(100, 100, 100, 0.9)',
          selected: 'rgba(0, 255, 255, 0.9)',
          confirmed: 'rgba(0, 245, 20, 0.9)',
          disabled: 'rgba(245, 50, 0, 0.9)'
        };
        let imgs = await Promise.allObj({ pawn: 1, knight: 1, bishop: 1, rook: 1, queen: 1, king: 1 }.map((v, name) => {
          return foundation.getMountFile(`img/${name}.png`);
        }));
        
        // Determine game status by listening to our player once we've entered the game
        myPlayer.hold(player => {
          if (!player) return;
          player.hold(v => v ? myGameStatus.wobble(v.gameStatus) : null);
        });
        
        // Determine colour by the reference used to link our player to our match
        myMatch.hold(match => {
          if (!match) return;
          U.CalcWob({ wobs: [ match.getInnerWob(rel.matchPlayerWhite), myPlayer ], func: (white, player) => {
            if (player && white === player) myColour.wobble('white');
          }});
          U.CalcWob({ wobs: [ match.getInnerWob(rel.matchPlayerBlack), myPlayer ], func: (black, player) => {
            if (player && black === player) myColour.wobble('black');
          }});
        });
        
        let matchSize = 600;
        let boardSize = 480;
        let playerSize = Math.round((matchSize - boardSize) * 0.5);
        let tileSize = Math.round(boardSize / 8);
        let tileHSize = Math.round(tileSize >> 1);
        let tileLoc = (x, y) => [ tileHSize + (x - 4) * tileSize, -tileHSize + (4 - y) * tileSize ];
        let pieceSize = 46;
        let avatarSize = 32;
        let indicatorSize = 32;
        
        let genMatch = rec => {
          let real = Real({ flag: 'match' });
          real.setSize(matchSize, matchSize);
          real.setColour('rgba(0, 0, 0, 0.8)');
          real.setPriority(1);
          
          // Flip the board for the black player
          myColour.hold(col => real.setRot(col === 'black' ? 180 : 0));
          
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
            whiteReal.setSize(matchSize, playerSize);
            whiteReal.setLoc(0, +0.5 * (matchSize - playerSize));
            white.hold(v => whiteReal.setText(`White: ${JSON.stringify(v)}`));
            myColour.hold(col => whiteReal.setRot(col === 'black' ? 180 : 0));
          });
          
          let blackReal = null;
          rec.getInnerWob(rel.matchPlayerBlack).hold(black => {
            if (blackReal) real.remReal(blackReal);
            if (!black) { blackReal = null; return; }
            blackReal = real.addReal(Real({ flag: 'blackPlayer' }));
            blackReal.setSize(matchSize, playerSize);
            blackReal.setLoc(0, -0.5 * (matchSize - playerSize));
            black.hold(v => blackReal.setText(`Black: ${JSON.stringify(v)}`));
            myColour.hold(col => blackReal.setRot(col === 'black' ? 180 : 0));
          });
          
          return real;
        };
        let genBoard = rec => {
          let real = Real({ flag: 'board' });
          real.setSize(320, 320);
          
          // The entire board is only tangible when the player is playing
          myGameStatus.hold(status => real.setTangible(status === 'playing'));
          
          for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) ((x, y) => {
            let tileReal = real.addReal(Real({ flag: 'tile' }));
            let colour = (y % 2) === (x % 2) ? colours.blackTile : colours.whiteTile;
            tileReal.setColour(colour);
            tileReal.setSize(tileSize, tileSize);
            tileReal.setLoc(...tileLoc(x, y));
            
            let indicator = tileReal.addReal(Real({ flag: 'ind'}));
            indicator.setSize(indicatorSize, indicatorSize);
            indicator.setBorderRadius(1);
            indicator.setTangible(false);
            
            tileReal.interactWob.hold(active => {
              if (!active) return;
              mySelectedPiece.wobble(null);
            });
            myConfirmedTile.hold(([x0, y0]) => {
              indicator.setColour((x0 === x && y0 === y) ? colours.confirmed : colours.clear);
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
                let tileReal = real.addReal(Real({ flag: 'validTile' }));
                tileReal.setSize(tileSize, tileSize);
                tileReal.setLoc(...tileLoc(x, y));
                tileReal.setColour(colours.clear);
                
                let indicator = tileReal.addReal(Real({ flag: 'ind' }));
                indicator.setSize(indicatorSize, indicatorSize);
                indicator.setColour(colours.selected);
                indicator.setBorderRadius(1);
                indicator.setTangible(false);
                
                tileReal.interactWob.hold(active => {
                  if (!active) return;
                  lands.getInnerVal(relLandsHuts).forEach(hut => {
                    hut.tell({
                      command: 'confirmMove',
                      piece: piece.uid,
                      tile: [ x, y ]
                    });
                  });
                  mySelectedPiece.wobble(null);
                  myConfirmedTile.wobble([ x, y ]);
                  myConfirmedPiece.wobble(piece);
                });
                
                return tileReal;
              });
              
            }
            
          });
          
          return real;
        };
        let genPiece = rec => {
          let real = Real({ flag: 'piece' });
          real.setColour(colours.clear);
          real.setSize(pieceSize, pieceSize);
          real.setBorderRadius(1);
          real.setOpacity(1);
          real.setPriority(1);
          real.setRemovalDelayMs(1000);
          real.setTangible(false);
          real.setTransition('loc', 500, 0, 'smooth');
          real.setTransition('opacity', 500, 0, 'sharp');
          real.remWob.hold(() => {
            // TODO: Not a fan of this `setTimeout` - better to work with css delays?
            real.setPriority(2);
            setTimeout(() => { real.setScale(3); real.setOpacity(0); }, 500);
          });
          
          // Border depends on whether we are selected, confirmed, and/or waiting
          U.CalcWob({ wobs: [ rec, mySelectedPiece, myConfirmedPiece ], func: (v, sel, cnf) => {
            if (v && v.wait)      real.setBorder('outer', 4, colours.disabled);
            else if (sel === rec) real.setBorder('outer', 4, colours.selected);
            else if (cnf === rec) real.setBorder('outer', 4, colours.confirmed);
            else                  real.setBorder('outer', 4, colours.clear);
          }});
          
          // The tangibility of this piece depends on colour and whether it's waiting
          U.CalcWob({ wobs: [ myColour, rec ], func: (colour, v) => {
            if (!v || !colour) return;
            real.setTangible(v.wait === 0 && colour === v.colour);
          }});
          
          // Ensure pieces are upright for black player (rotated an additional 180deg)
          myColour.hold(col => real.setRot(col === 'black' ? 180 : 0));
          
          let avatar = real.addReal(Real({ flag: 'avatar' }));
          avatar.setSize(avatarSize, avatarSize);
          avatar.setColour(colours.clear);
          
          let grip = real.addReal(Real({ flag: 'grip' }));
          grip.setColour(colours.clear);
          grip.setSize(tileSize, tileSize);
          
          // Apply visuals, colour, and positioning to this piece
          rec.hold(({ type, colour, x, y }) => {
            real.setLoc(...tileLoc(x, y));
            real.setColour(colour === 'white' ? colours.whitePiece : colours.blackPiece);
            //real.setColour(colour === 'white' ? colours.whitePiece : colours.blackPiece);
            avatar.setColoursInverted(colour === 'white');
            avatar.setImage(imgs[type]);
            mySelectedPiece.wobble(null);
            myConfirmedPiece.wobble(null);
            myConfirmedTile.wobble([ -1, -1 ]);
          });
          
          // Interactions cause piece to be selected
          grip.interactWob.hold(active => {
            if (!active) return;
            mySelectedPiece.modify(sel => sel === rec ? null : rec);
          });
          
          return real;
        };
        
        let root = Real({ isRoot: true, flag: 'root' });
        let mainView = null;
        let notifyView = null;
        
        myMatch.hold(rec => {
          if (mainView) { root.remReal(mainView); mainView = null; }
          if (rec) mainView = root.addReal(genMatch(rec));
        });
        
        myGameStatus.hold(gameStatus => {
          
          if (notifyView) { root.remReal(notifyView); notifyView = null; }
          
          if (gameStatus === 'playing') return;
          
          let nv = notifyView = root.addReal(Real({}));
          nv.setSize(220, 220);
          nv.setColour('rgba(0, 0, 0, 0.85)');
          nv.setPriority(2);
          nv.setOpacity(0);
          nv.setTransition('opacity', 500, 0, 'sharp');
          nv.addWob.hold(() => nv.setOpacity(1));
          
          let [ size, str ] = ({
            waiting:    [ 18, 'Finding match...' ],
            victorious: [ 25, 'You WIN!' ],
            defeated:   [ 25, 'You LOSE!' ],
            stalemated: [ 25, 'It\'s a DRAW!' ]
          })[gameStatus];
          
          nv.setTextSize(size);
          nv.setText(str);
          
        });
        
        lands.getInnerWob(relLandsRecs).hold(({ add={}, rem={} }) => {
          
          // Split incoming records by class
          let addsByCls = { Match: {}, Player: {} };
          add.forEach((rec, uid) => {
            let clsName = rec.constructor.name;
            if (!addsByCls.has(clsName)) addsByCls[clsName] = {};
            addsByCls[clsName][uid] = rec;
          });
          
          // Look for any match
          let match = addsByCls.Match.find(() => true);
          if (match) myMatch.wobble(match[0]);
          
          // Search for players whose term is our term
          addsByCls.Player.forEach(player => player.hold(v => v && v.term === U.hutTerm && myPlayer.wobble(player)));
          
        });
        /// =BELOW}
        
        let way = Way({ lands, makeServer: () => foundation.makeHttpServer() });
        lands.attach(relLandsWays, way);
        await lands.open();
      }
    };
    
  }
});
