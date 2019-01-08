// FOR PRODUCTION:
// [Y]  More than 1 game at a time!!!
//        - Needs debugging
// [X]  Piece avatar images
// [X]  Ensure that requests and responses don't desync when necessary
// [X]  Replay button
// [ ]  Move timer (prevent indefinite stalls)
// [ ]  Detect idle clients; remove them
// [ ]  Data isolation (getRecsForHut is super buggy rn)

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
        this.passTimeout
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
      },
      validMoves: function () {
        // Get board and fellow pieces
        let board = this.getInnerVal(rel.boardPieces);
        let pieces = board.getInnerVal(rel.boardPieces);
        
        // Make a nice 2d representation of the board
        let calc = Array.fill(8, () => Array.fill(8, () => null));
        pieces.forEach(piece => { calc[piece.value.x][piece.value.y] = piece; });
        
        // Utility func for checking tiles
        let checkTile = (x, y) => (x < 0 || x > 7 || y < 0 || y > 7) ? 'OOB' : calc[x][y];
        
        let { type, colour, x, y } = this.value;
        
        let moves = [];
        
        if (type === 'pawn') {
          
          let dir = colour === 'white' ? 1 : -1;
          let initY = colour === 'white' ? 1 : 6;
          
          if (!checkTile(x, y + dir)) {
            moves.push([ x, y + dir, null ]); // Add first step if unblocked
            if (y === initY && !checkTile(x, y + dir + dir)) {
              moves.push([ x, y + dir + dir, null ]); // Add second step if unblocked and unmoved
            }
          }
          
          // Check for captures in both directions
          let cap1 = checkTile(x - 1, y + dir);
          if (cap1 && cap1 !== 'OOB' && cap1.value.colour !== colour) moves.push([ x - 1, y + dir, cap1 ]);
          
          let cap2 = checkTile(x + 1, y + dir);
          if (cap2 && cap2 !== 'OOB' && cap2.value.colour !== colour) moves.push([ x + 1, y + dir, cap2 ]);
          
        } else if (type === 'knight') {
          
          let offsets = [
            [ -2, -1 ], [ -2, 1 ], [ -1, 2 ], [ 1, 2 ], [ 2, 1 ], [ 2, -1 ], [ 1, -2 ], [ -1, -2 ]
          ];
          offsets.forEach(([ dx, dy ]) => {
            let [ xx, yy ] = [ x + dx, y + dy ];
            let check = checkTile(xx, yy);
            if (!check || (check !== 'OOB' && check.value.colour !== colour)) moves.push([ xx, yy, check ]);
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
              if (!check || check.value.colour !== colour) moves.push([ xx, yy, check ]);
              
              // Finding a piece terminates stepping; kings always terminate after first step
              if (check || type === 'king') break;
            }
            
          });
          
        } else {
          
          throw new Error(`Invalid type: ${type}`);
          
        }
        
        return moves;
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
      matchPlayers:     Record.relate1M(Record.stability.dynamic, Match, Player, 'matchPlayers'),
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
          getRecsForHut: (lands, hut) => lands.getInnerVal(relLandsRecs).map(v => v.isInspiredBy(Chess2) ? C.skip : v)
        });
        
        /// {ABOVE=
        
        // Mount files
        [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ].forEach(
          // TODO: shouldn't need to include "room/chess2"
          // The instance of `foundation` received should be specialized for this 1 room
          pieceName => foundation.addMountFile(`img/${pieceName}.png`, `room/chess2/img/stackPieces/${pieceName}.png`, 'image/png')
        );
        
        // Listen for chess2-specific commands
        lands.commands.gain({
          confirmMove: async (lands, hut, msg) => {
            let player = hut.getInnerVal(rel.playerHut);
            let playerPieces = player.getInnerVal(rel.piecePlayer);
            
            if (!playerPieces.has(msg.piece)) return hut.tell({ command: 'error', type: 'pieceNotFound', orig: msg });
            
            player.move.wobble({
              piece: playerPieces[msg.piece],
              tile: msg.tile
            });
          },
          playAgain: async (lands, hut, msg) => {
            let player = hut.getInnerVal(rel.playerHut);
            
            if (!player) return;
            
            // let board = player.getInnerVal(rel.playerBoard);
            let match = player.getInnerVal(rel.matchPlayers);
            
            // if (!board) throw new Error('UGH PLAYER DOESN\'T HAVE BOARD');
            if (!match) throw new Error('UGH PLAYER DOESN\'T HAVE MATCH');
            // if (match.getInnerVal(rel.matchBoard) !== board) throw new Error('SOMEHOW BOARD AND MATCH DON\'T ASSOCIATE??');
            
            // Remove from match
            player.detach(rel.matchPlayers, match);
            // player.detach(rel.playerBoard, board);
            
            // Switch from playing to waiting
            player.detach(rel.playersPlaying, chess2);
            player.attach(rel.playersWaiting, chess2);
            
            // Update status
            player.modify(v => v.gain({ colour: null, gameStatus: 'waiting' }));
            player.move.wobble(null);
            
            // Inform the huts of all match players
            lands.getInnerVal(relLandsHuts).forEach(hut => hut.informBelow());
          }
        });
        
        // Chess2-specific data
        let pieceDefs = {
          standard: [
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
              [ 'queen',    3, 7 ],
              [ 'king',     4, 7 ],
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
            ]
          ],
          gameOverTest: [
            [
              [ 'rook',     0, 0 ],
              [ 'knight',   1, 0 ],
              [ 'bishop',   2, 0 ],
              [ 'queen',    4, 6 ],
              [ 'king',     4, 0 ],
              [ 'bishop',   5, 0 ],
              [ 'knight',   6, 0 ],
              [ 'rook',     7, 0 ],
              [ 'pawn',     0, 1 ],
              [ 'pawn',     1, 1 ],
              [ 'pawn',     2, 1 ],
              [ 'pawn',     3, 1 ],
              [ 'pawn',     5, 1 ],
              [ 'pawn',     6, 1 ],
              [ 'pawn',     7, 1 ]
            ],
            [
              [ 'rook',     0, 7 ],
              [ 'knight',   1, 7 ],
              [ 'bishop',   2, 7 ],
              [ 'queen',    4, 1 ],
              [ 'king',     4, 7 ],
              [ 'bishop',   5, 7 ],
              [ 'knight',   6, 7 ],
              [ 'rook',     7, 7 ],
              [ 'pawn',     0, 6 ],
              [ 'pawn',     1, 6 ],
              [ 'pawn',     2, 6 ],
              [ 'pawn',     3, 6 ],
              [ 'pawn',     5, 6 ],
              [ 'pawn',     6, 6 ],
              [ 'pawn',     7, 6 ]
            ]
          ]
        };
        
        let chess2 = Chess2({ lands });
        
        // Track hut initialization; create players for initialized huts
        lands.getInnerWob(relLandsHuts).hold(({ add={}, rem={} }) => {
          add.forEach(hut => {
            hut.initializeWob.hold(v => {
              if (!v) return;
              let player = Player({ lands });
              player.wobble({ term: hut.getTerm(), gameStatus: 'waiting', colour: null });
              player.attach(rel.playerHut, hut);
              chess2.attach(rel.playersWaiting, player);
            });
          });
        });
        
        // Matchmaking
        setInterval(() => {
          let playersWaiting = chess2.getInnerVal(rel.playersWaiting).toArr(v => v);
          playersWaiting.sort(() => 0.5 - Math.random());
          
          for (let i = 0; i < playersWaiting.length - 1; i += 2) {
            let [ p1, p2 ] = playersWaiting.slice(i, i + 2);
            if (Math.random() > 0.5) [ p1, p2 ] = [ p2, p1 ];
            
            let [ hut1, hut2 ] = [ p1, p2 ].map(p => p.getInnerVal(rel.playerHut));
            
            chess2.detach(rel.playersWaiting, p1);
            chess2.detach(rel.playersWaiting, p2);
            chess2.attach(rel.playersPlaying, p1);
            chess2.attach(rel.playersPlaying, p2);
            
            let match = Match({ lands });
            let board = Board({ lands });
            chess2.attach(rel.matches, match);
            match.attach(rel.matchBoard, board);
            match.attach(rel.matchPlayers, p1);
            match.attach(rel.matchPlayers, p2);
            
            //board.attach(rel.playerBoard, p1);
            //board.attach(rel.playerBoard, p2);
            
            p1.modify(v => v.gain({ gameStatus: 'playing', colour: 'white' }));
            p2.modify(v => v.gain({ gameStatus: 'playing', colour: 'black' }));
            
            // Set up pieces for each player
            [ p1, p2 ].forEach((player, ind) => {
              pieceDefs.standard[ind].forEach(([ type, x, y ]) => {
                let piece = Piece({ lands });
                piece.wobble({ type, colour: !ind ? 'white' : 'black', wait: 0, x, y });
                board.attach(rel.boardPieces, piece);
                player.attach(rel.piecePlayer, piece);
              });
            });
            
            // Mark the players as playing
            [ p1, p2 ].forEach(player => player.modify(v => v.gain({ gameStatus: 'playing' })));
            
            // Inform each player that they've entered a match
            [ hut1, hut2 ].forEach(hut => hut.informBelow());
            
            // Resolve moves when both players have confirmed
            let doMove = U.CalcWob({ wobs: [ p1.move, p2.move ], func: (p1Move, p2Move) => {
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
            
            // Clean up when no players remain
            match.getInnerWob(rel.matchPlayers).hold(() => {
              let players = match.getInnerVal(rel.matchPlayers);
              if (!players.isEmpty()) return;
              
              doMove.shut(); // Stop listening for moves!
              
              // Remove all pieces, the board and the match
              board.getInnerVal(rel.boardPieces).forEach(piece => lands.remRec(piece));
              lands.remRec(board);
              lands.remRec(match);
              
              // Reset players
              
              // [ p1, p2 ].forEach(player => {
              //   player.modify(v => v.gain({ colour: null, gameStatus: 'waiting' }));
              //   player.move.wobble(null);
              // });
              
              lands.getInnerVal(relLandsHuts).forEach(hut => hut.informBelow());
            });
            
          }
        }, 5000);
        
        /// =ABOVE} {BELOW=
        
        let { Real } = real;
        
        let mySelectedPiece = U.Wobbly({ value: null });
        let myConfirmedPiece = U.Wobbly({ value: null });
        let myConfirmedTile = U.Wobbly({ value: [ -1, -1 ] });
        let myTileClickers = U.Wobbly({ value: [] });
        let myPlayer = U.Wobbly({ value: null });
        
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
          myPlayer.hold(p => p && p.hold(v => real.setRot(v && v.colour === 'black' ? 180 : 0)));
          
          // Show the board when one associates
          let boardReal = null;
          rec.getInnerWob(rel.matchBoard).hold(board => {
            if (boardReal) real.remReal(boardReal);
            if (!board) { boardReal = null; return; }
            boardReal = real.addReal(genBoard(board));
          });
          
          let playerReals = {};
          rec.getInnerWob(rel.matchPlayers).hold(({ add={}, rem={} }) => {
            
            add.forEach(playerRec => {
              
              let playerReal = playerReals[playerRec.uid] = real.addReal(Real({ flag: 'player' }));
              playerReal.setSize(matchSize, playerSize);
              playerRec.hold(v => {
                playerReal.setText(JSON.stringify(v))
                playerReal.setLoc(0, (v && v.colour === 'black' ? -0.5 : +0.5) * (matchSize - playerSize));
              });
              myPlayer.hold(p => p && p.hold(v => playerReal.setRot(v && v.colour === 'black' ? 180 : 0)));
              
            });
            
            rem.forEach((p, uid) => {
              
              if (playerReals.has(uid)) { playerReals[uid].rem(); delete playerReals[uid]; }
              
            });
            
          });
          
          return real;
        };
        let genBoard = rec => {
          let real = Real({ flag: 'board' });
          real.setSize(boardSize, boardSize);
          
          // The entire board is only tangible when the player is playing
          myPlayer.hold(p => p && p.hold(v => real.setTangible(v && v.gameStatus === 'playing')));
          
          let confirmedTileReal = null;
          for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) ((x, y) => {
            let tileReal = real.addReal(Real({ flag: 'tile' }));
            let colour = (y % 2) === (x % 2) ? colours.blackTile : colours.whiteTile;
            tileReal.setColour(colour);
            tileReal.setSize(tileSize, tileSize);
            tileReal.setLoc(...tileLoc(x, y));
            
            tileReal.interactWob.hold(active => {
              if (!active) return;
              mySelectedPiece.wobble(null);
            });
            myConfirmedTile.hold(([x0, y0, cap]) => {
              if (confirmedTileReal) { confirmedTileReal.rem(); confirmedTileReal = null; }
              
              if (x0 === -1 || y0 === -1) return;
              
              confirmedTileReal = real.addReal(Real({ flag: 'confirmed' }));
              confirmedTileReal.setSize(tileSize, tileSize);
              confirmedTileReal.setLoc(...tileLoc(x0, y0));
              confirmedTileReal.setPriority(2);
              confirmedTileReal.setColour(colours.clear);
              
              let indicator = confirmedTileReal.addReal(Real({ flag: 'ind' }));
              indicator.setBorderRadius(1);
              indicator.setTangible(false);
              if (!cap) {
                indicator.setSize(indicatorSize, indicatorSize);
                indicator.setColour(colours.confirmed);
              } else {
                indicator.setSize(pieceSize - 16, pieceSize - 16);
                indicator.setColour(colours.clear);
                indicator.setBorder('outer', 8, colours.confirmed);
              }
              
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
              
              tileSelectors = piece.validMoves().map(([ x, y, cap ]) => {
                let tileReal = real.addReal(Real({ flag: 'validTile' }));
                tileReal.setSize(tileSize, tileSize);
                tileReal.setLoc(...tileLoc(x, y));
                tileReal.setColour(colours.clear);
                tileReal.setPriority(2);
                
                let indicator = tileReal.addReal(Real({ flag: 'ind' }));
                indicator.setBorderRadius(1);
                if (!cap) {
                  indicator.setSize(indicatorSize, indicatorSize);
                  indicator.setColour(colours.selected);
                } else {
                  indicator.setSize(pieceSize - 16, pieceSize - 16);
                  indicator.setColour(colours.clear);
                  indicator.setBorder('outer', 8, colours.selected);
                }
                indicator.setTangible(false);
                
                tileReal.setFeel('interactive');
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
                  myConfirmedTile.wobble([ x, y, cap ]);
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
            real.setPriority(4);
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
          U.CalcWob({ wobs: [ myPlayer, rec ], func: (pl, pcVal) => {
            if (!pl || !pcVal) return;
            pl.hold(plVal => {
              real.setTangible(pcVal && plVal && pcVal.wait === 0 && plVal.colour === pcVal.colour);
            });
          }});
          
          // Ensure pieces are upright for black player (rotated an additional 180deg)
          myPlayer.hold(p => p && p.hold(v => real.setRot(v && v.colour === 'black' ? 180 : 0)));
          
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
        
        // Display any matches which become associated
        myPlayer.hold(player => player && player.getInnerWob(rel.matchPlayers).hold(matchRec => {
          if (mainView) { root.remReal(mainView); mainView = null; }
          if (matchRec) mainView = root.addReal(genMatch(matchRec));
        }));
        
        // Show notifications based on our player's gameStatus
        myPlayer.hold(player => player && player.hold(v => {
          
          // TODO: doing `remReal` followed by `addReal` isn't unnoticeable when
          // there's an initial transition, like the fade-in of the notification.
          // Need to make sure `v.gameStatus` has changed before removing anything.
          
          if (notifyView) { root.remReal(notifyView); notifyView = null; }
          
          if (!v) return;
          let { gameStatus } = v;
          if (gameStatus === 'playing') return;
          
          let nv = notifyView = root.addReal(Real({}));
          nv.setSize(220, 220);
          nv.setColour('rgba(0, 0, 0, 0.85)');
          nv.setPriority(2);
          nv.setOpacity(0);
          nv.setTransition('opacity', 500, 0, 'sharp');
          nv.addWob.hold(() => nv.setOpacity(1));
          
          let [ playAgainStr, size, str ] = ({
            waiting:    [ false,              18, 'Finding match...' ],
            victorious: [ 'Win more!',        25, 'You WIN!' ],
            defeated:   [ 'Reclaim dignity!', 25, 'You LOSE!' ],
            stalemated: [ 'More chess!',      25, 'It\'s a DRAW!' ]
          })[gameStatus];
          
          nv.setTextSize(size);
          nv.setText(str);
          
          if (playAgainStr) {
            let playAgainReal = nv.addReal(Real({ flag: 'playAgain' }));
            playAgainReal.setSize(150, 40);
            playAgainReal.setLoc(0, 140);
            playAgainReal.setText(playAgainStr);
            playAgainReal.setTextSize(14);
            playAgainReal.setFeel('interactive');
            playAgainReal.interactWob.hold(active => {
              if (!active) return;
              lands.getInnerVal(relLandsHuts).forEach(hut => hut.tell({ command: 'playAgain' }));
            });
          }
        }));
        
        lands.getInnerWob(relLandsRecs).hold(({ add={}, rem={} }) => {
          
          // Split incoming records by class
          let addsByCls = { Match: {}, Player: {} };
          add.forEach((rec, uid) => {
            let clsName = rec.constructor.name;
            if (!addsByCls.has(clsName)) addsByCls[clsName] = {};
            addsByCls[clsName][uid] = rec;
          });
          
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
