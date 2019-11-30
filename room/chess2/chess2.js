U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'real', 'realHtmlCss', 'chance' ],
  build: (foundation, hinterlands, record, real, realHtmlCss, chance) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
    let { Chance } = chance;
    let { Rec, recTyper } = record;
    let { Lands } = hinterlands;
    
    // Config values
    let moveMs = 10 * 1000;
    let matchmakeMs = 3000;
    let heartbeatMs = 30 * 1000;
    let pieceDefs = {
      standard: {
        white: [
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
        black: [
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
      },
      gameOverTest: {
        white: [
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
        black: [
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
      }
    };
    
    let validMoves = (match, piece) => {
      // Get other pieces
      let pieces = match.relRecs(rt.matchPiece);
      
      // Make a nice 2d representation of the board
      let calc = Array.fill(8, () => Array.fill(8, () => null));
      pieces.forEach(piece => { calc[piece.value.x][piece.value.y] = piece; });
      
      // Utility func for checking tiles (OOB=out-of-bounds, null=empty-tile, otherwise a Piece)
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
    };
    let applyMoves = (match, ...playerMoves) => {
      
      playerMoves = playerMoves.map(mv => mv || { uid: null, tile: null });
      
      // Get all match pieces...
      let pieces = this.relVal(rel.matchPieces);
      
      // All pieces refresh by 1 turn
      pieces.forEach(piece => piece.value.wait && piece.modify(v => { v.wait--; return v; }));
      
      // Make sure all moved pieces are in this match
      let badPiece = playerMoves.find(({ uid }) => uid && !pieces.has(uid));
      if (badPiece) throw new Error(`We don't own Piece ${badPiece[0].uid}`);;
      
      // Update piece positions
      playerMoves.forEach(({ uid, tile }) => {
        if (!uid) return;
        pieces[uid].modify(v => v.gain({ x: tile[0], y: tile[1], wait: 1 }))
      });
      
      // Look for promotions
      pieces.forEach(piece => {
        if (!piece.value || piece.value.type !== 'pawn') return;
        let { colour, y } = piece.value;
        if ((colour === 'white' && y === 7) || (colour === 'black' && y === 0))
          piece.modify(v => v.gain({ type: 'queen' }));
      });
      
      // Get captured pieces...
      let [ p1Trgs, p2Trgs ] = playerMoves.map(({ uid, tile }) => {
        if (!uid) return {};
        let collided = pieces.map(p => (p.value.x === tile[0] && p.value.y === tile[1]) ? p : C.skip);
        delete collided[uid]; // Pieces can't capture themselves!
        return collided;
      });
      
      // And remove them
      p1Trgs.forEach(pc => pc.shut());
      p2Trgs.forEach(pc => pc.shut());
      
      // Check if either player has captured the others' king
      let p1CapturedKing = !!p1Trgs.find(piece => piece.value.type === 'king');
      let p2CapturedKing = !!p2Trgs.find(piece => piece.value.type === 'king');
      
      // If a king is captured, or no player played a non-pass move, conclude match
      let concluded = p1CapturedKing || p2CapturedKing || !playerMoves.find(({ uid }) => uid);
      
      if (!concluded) return 'inconclusive';
      if (p1CapturedKing === p2CapturedKing) return 'stalemate';
      return p1CapturedKing ? 'white' : 'black';
      
    }
    
    let { rt: chess2Rt, add } = recTyper();
    let rt = { lands: hinterlands.rt, chess2: chess2Rt };
    
    add('chess2', Rec);
    add('match',  Rec);
    add('round',  Rec);
    add('piece',  Rec)
    add('player', Rec);
    add('move',   Rec);
    add('archChess2',       Rec, '11', rt.lands.arch,     rt.chess2.chess2);
    add('chess2Match',      Rec, '1M', rt.chess2.chess2,  rt.chess2.match);
    add('matchRound',       Rec, '1M', rt.chess2.match,   rt.chess2.round);
    add('matchPiece',       Rec, '1M', rt.chess2.match,   rt.chess2.piece);
    add('hutPlayer',        Rec, '11', rt.lands.hut,      rt.chess2.player);
    add('chess2Player',     Rec, '1M', rt.chess2.chess2,  rt.chess2.player);
    add('matchPlayer',      Rec, '1M', rt.chess2.match,   rt.chess2.player);
    add('piecePlayer',      Rec, 'M1', rt.chess2.piece,   rt.chess2.player);
    add('playerMove',       Rec, '11', rt.chess2.player,  rt.chess2.move);
    
    add('conclusion',       Rec);
    add('matchConclusion',  Rec, '11', rt.chess2.match,   rt.chess2.conclusion);
    
    
    let open = async () => {
      
      // TODO: Images should probably automatically get included by the
      // real room - e.g. under decals, say `image: 'classicHorse'`, and
      // then the real room will automatically mount that file and add
      // a comWob to the lands to allow it to serve the file.
      // Mount files
      
      // TODO: No good that this needs to be flattened!
      let recTypes = { ...rt.chess2, ...rt.lands };
      let lands = U.lands = Lands({ recTypes, heartbeatMs: 1 * 60 * 1000 });
      lands.realLayout = [];
      lands.makeServers.push(pool => foundation.makeHttpServer(pool, '127.0.0.1', 80));
      lands.makeServers.push(pool => foundation.makeSoktServer(pool, '127.0.0.1', 8000));
      
      // TODO: Insertions (the "Relation" equivalent for Reals) should
      // exist explicitly
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      lands.realLayout = {
        'main': {
          slot: par => par.cmps.slots.insertViewPortItem(),
          decals: { colour: 'rgba(100, 100, 150, 1)' }
        },
        'main.out': {
          size: FillParent({ shrink: UnitPc(0.2) }),
          decals: { colour: 'rgba(120, 120, 170, 1)' },
          slots: CenteredSlot()
        },
        'main.out.content': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.out.content.title': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', pad: UnitPx(10) }),
          decals: { textSize: UnitPx(24), textColour: 'rgba(255, 255, 255, 1)' }
        },
        'main.out.content.text': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', pad: UnitPx(3) }),
          decals: { textSize: UnitPx(12), textColour: 'rgba(255, 255, 255, 1)' }
        },
        'main.in': {
          size: FillParent(),
          decals: { colour: 'rgba(120, 120, 170, 1)' },
          slots: CenteredSlot() // Regarding Real "Insertions" (Relations) - note that we want CenteredSlot when inserting "lobby", but FillParent when inserting "game"
        },
        'main.in.lobby': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          size: ShowText({ origin: 'cc', pad: UnitPx(15) }),
          decals: { colour: 'rgba(100, 100, 150, 1)', textColour: 'rgba(255, 255, 255, 1)', textSize: UnitPx(12) }
        },
        'main.in.game': {
          size: FillParent(),
          decals: { colour: 'rgba(100, 100, 150, 1)' }
        },
        'main.in.game.white': {},
        'main.in.game.black': {},
        'main.in.game.board': {}
      };
      
      /// {ABOVE=
      lands.setRealRooms([ realHtmlCss ]);
      let chess2 = lands.createRec('chess2');
      let archChess2 = lands.createRec('archChess2', {}, lands.arch, chess2);
      /// =ABOVE}
      
      let rootScp = Scope(lands.arch.relNozz(rt.chess2.archChess2), (archChess2, dep) => {
        
        let chess2 = archChess2.members[1];
        global.chess2 = chess2;
        
        /// {ABOVE=
        
        dep.scp(lands.arch.relNozz(rt.lands.archHut), (archHut, dep) => {
          
          let hut = archHut.members[1];
          let hutPlayerNozz = hut.relNozz(rt.chess2.hutPlayer);
          
          // Follows
          dep(hut.follow(archChess2));
          dep.scp(hut.relNozz(rt.chess2.hutPlayer), (hutPlayer, dep) => {
            
            // Careful not to Follow the HutPlayer!
            let player = hutPlayer.members[1];
            dep.scp(player.relNozz(rt.chess2.chess2Player), (chess2Player, dep) => {
              
              // Follow the Player through the Chess2Player!
              dep(hut.follow(chess2Player));
              
              dep.scp(player.relNozz(rt.chess2.matchPlayer), (matchPlayer, dep) => {
                
                console.log(`Hut ${hut.getTerm()} follow Match ${matchPlayer.members[0].uid}`);
                
                dep(hut.follow(matchPlayer)); // Follow Match
                
                // Follow all Players and Pieces in the Match
                let match = matchPlayer.members[0];
                dep.scp(match.relNozz(rt.chess2.matchPlayer), (matchPlayer, dep) => dep(hut.follow(matchPlayer)));
                dep.scp(match.relNozz(rt.chess2.matchPiece), (matchPiece, dep) => dep(hut.follow(matchPiece)));
                
              });
              
            });
            
          });
          
          // Actions for Huts (differentiate between logged-in and logged-out)
          let hutNoPlayerNozz = dep(TubDry(defDrier(), hutPlayerNozz));
          dep.scp(hutNoPlayerNozz, (_, dep) => {
            dep(hut.comNozz('login').route(() => {
              let player =    lands.createRec('player', { val: { term: hut.getTerm() } });
              let hutPlayer = lands.createRec('hutPlayer', {}, hut, player);
              let chess2Player = lands.createRec('chess2Player', {}, chess2, player);
            }));
          });
          dep.scp(hutPlayerNozz, (hutPlayer, dep) => {
            
            // Huts with Players can logout
            dep(hut.comNozz('logout').route(({ user, pass }) => hutPlayer.dry()));
            
            let player = hutPlayer.members[1];
            let playerMatchNozz = player.relNozz(rt.chess2.matchPlayer);
            let playerNoMatchNozz = dep(TubDry(defDrier(), playerMatchNozz));
            dep.scp(playerNoMatchNozz, (_, dep) => {
              // Just wait...
            });
            dep.scp(playerMatchNozz, (matchPlayer, dep) => {
              
              let match = matchPlayer.members[0];
              let matchConclusionNozz = match.relNozz(rt.chess2.matchConclusion);
              let matchNoConclusionNozz = dep(TubDry(defDrier(), matchConclusionNozz));
              
              dep.scp(matchNoConclusionNozz, (_, dep) => {
                
                // In Matches without Conclusions, Players without Moves can
                // submit Moves, and Players with Moves can retract their Moves
                
                let playerMoveNozz = player.relNozz(rt.chess2.playerMove);
                let playerNoMoveNozz = dep(TubDry(defDrier(), playerMoveNozz));
                dep.scp(playerNoMoveNozz, (_, dep) => {
                  dep(hut.comNozz('doMove').route(({ type, pieceId=null, tile=null }) => {
                    let move = lands.createRec('move', { val: { type, pieceId, tile } });
                    let playerMove = lands.createRec('playerMove', {}, player, move);
                  }));
                });
                dep.scp(playerMoveNozz, (playerMove, dep) => {
                  dep(hut.comNozz('undoMove').route(() => playerMove.dry()));
                });
                
              });
              
            });
            
          });
          
        });
        
        // Gameplay
        dep.scp(chess2.relNozz(rt.chess2.chess2Match), (chess2Match, dep) => {
          
          let match = chess2Match.members[1];
          let matchPlayerNozz = match.relNozz(rt.chess2.matchPlayer);
          let matchNoPlayerNozz = dep(TubDry(defDrier(), matchPlayerNozz));
          
          let matchConclusionNozz = match.relNozz(rt.chess2.matchConclusion);
          let matchNoConclusionNozz = dep(TubDry(defDrier(), matchConclusionNozz));
          
          dep.scp(matchNoConclusionNozz, (_, dep) => {
            
            let playersWithMoves = Map();
            let movesNozz = Nozz();
            dep.scp(matchPlayerNozz, (matchPlayer, dep) => {
              
              let playerForMove = matchPlayer.members[1];
              dep.scp(playerForMove.relNozz(rt.chess2.playerMove), (playerMove, dep) => {
                
                dep(Drop(null, () => {
                  playersWithMoves.rem(playerForMove);
                  movesNozz.drip();
                }));
                
                playersWithMoves.set(playerForMove, playerMove);
                movesNozz.drip();
                
              });
              
            });
            
            // Apply moves when exactly 2 moves have been received
            dep(movesNozz.route(() => {
              
              if (playersWithMoves.size !== 2) return;
              
              // Apply moves - ensure order is white, black
              let playerMoves = playersWithMoves.toArr((player, move) => { player, move });
              if (playerMoves[0].player.val.colour === 'black') playerMoves.reverse();
              applyMoves(match, ...playerMoves);
              
              // Dry all Moves submitted
              playerMoves.forEach(playerMove => playerMove.move.members[1].dry());
              
            }));
            
          });
          
          // TODO: Really, the condition for a Match to end is "The Match
          // now has zero players, AND at some point it had non-zero Players"
          // The Match ends when no Players remain
          dep(matchNoPlayerNozz.route(() => match.dry()));
          
        });
        
        // Intermittently enter Players into Matches
        let interval = setInterval(() => {
          
          let allPlayers = chess2.relNozz(rt.chess2.chess2Player).set.toArr(v => {
            let player = v.members[1];
            return player.relRec(rt.chess2.matchPlayer) ? C.skip : player;
          });
          
          for (let i = 0; i < allPlayers.length - 1; i += 2) {
            
            // For each pair of Players create a Match, assign the Players to
            // that Match, and then create Pieces and assign each Piece to the
            // Match and its appropriate Player.
            
            let match = lands.createRec('match');
            
            let playerPieceSets = [
              { colour: 'white', player: allPlayers[i + 0], pieces: pieceDefs.standard.white },
              { colour: 'black', player: allPlayers[i + 1], pieces: pieceDefs.standard.black }
            ];
            for (let { colour, player, pieces } of playerPieceSets) {
              let matchPlayer1 = lands.createRec('matchPlayer', { val: { colour } }, match, player);
              for (let [ name, col, row ] of pieces) {
                let piece = lands.createRec('piece');
                let piecePlayer = lands.createRec('piecePlayer', {}, piece, player);
                let matchPiece = lands.createRec('matchPiece', {}, match, piece);
              }
            }
            
            let chess2Match = lands.createRec('chess2Match', {}, chess2, match);
          }
          
        }, 5000);
        dep(Drop(null, () => clearInterval(interval)));
        
        /// =ABOVE} {BELOW=
        
        dep.scp(lands.getRootReal(), rootReal => {
          
          let mainReal = rootReal.addReal('main');
          let myPlayerNozz = dep(TubVal(null, chess2.relNozz(rt.chess2.chess2Player), chess2Player => {
            let player = chess2Player.members[1];
            return (player.val.term === U.hutTerm) ? player : C.skip;
          }));
          let noMyPlayerNozz = dep(TubDry(null, myPlayerNozz));
          
          dep.scp(noMyPlayerNozz, (_, dep) => {
            
            let outReal = dep(mainReal.addReal('out'));
            let contentReal = outReal.addReal('content');
            let titleReal = contentReal.addReal('title');
            let textReal = contentReal.addReal('text');
            
            titleReal.setText('Chess2');
            textReal.setText('Click to start playing!');
            
            dep(outReal.feelNozz().route(() => lands.tell({ command: 'login' })));
            
          });
          dep.scp(myPlayerNozz, (player, dep) => {
            
            let inReal = dep(mainReal.addReal('in'));
            
            let myMatchPlayerNozz = player.relNozz(rt.chess2.matchPlayer);
            let noMyMatchPlayerNozz = dep(TubDry(null, myMatchPlayerNozz));
            
            dep.scp(noMyMatchPlayerNozz, (_, dep) => {
              
              let lobbyReal = dep(inReal.addReal('lobby'));
              lobbyReal.setText('Waiting for match...');
              
            });
            dep.scp(myMatchPlayerNozz, (matchPlayer, dep) => {
              
              let myColour = matchPlayer.val.colour;
              
              let gameReal = dep(inReal.addReal('game'));
              let whiteReal = gameReal.addReal('white');
              let boardReal = gameReal.addReal('board');
              let blackReal = gameReal.addReal('black');
              
              whiteReal.setSize(UnitPc(1), UnitPc(0.1));
              whiteReal.setLoc(UnitPc(0.5), UnitPc(0.05));
              
              boardReal.setSize(UnitPc(0.8), UnitPc(0.8));
              boardReal.setLoc(UnitPc(0.5), UnitPc(0.5));
              
              blackReal.setSize(UnitPc(1), UnitPc(0.1));
              whiteReal.setLoc(UnitPc(0.5), UnitPc(0.05));
              
            });
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
      await lands.open();
      
    };
    
    return { open };
  }
});

/*
if (false) U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'life', 'real', 'realHtmlCss', 'chance' ],
  build: (foundation, hinterlands, record, life, real, realHtmlCss, chance) => {
    
    //let { HorzScope, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Chance } = chance;
    let { Rec, recTyper } = record;
    let {  } = life;
    let { Lands } = hinterlands;
    
    // Config values
    let moveMs = 10 * 1000;
    let matchmakeMs = 3000;
    let heartbeatMs = 30 * 1000;
    let pieceNames = [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ];
    let pieceDefs = {
      standard: {
        white: [
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
        black: [
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
      },
      gameOverTest: {
        white: [
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
        black: [
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
      }
    };
    
    let validMoves = (match, piece) => {
      // Get other pieces
      let pieces = match.relRecs(rt.matchPiece);
      
      // Make a nice 2d representation of the board
      let calc = Array.fill(8, () => Array.fill(8, () => null));
      pieces.forEach(piece => { calc[piece.value.x][piece.value.y] = piece; });
      
      // Utility func for checking tiles (OOB=out-of-bounds, null=empty-tile, otherwise a Piece)
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
    };
    let applyMoves = (match, ...playerMoves) => {
      
      playerMoves = playerMoves.map(mv => mv || { uid: null, tile: null });
      
      // Get all match pieces...
      let pieces = this.relVal(rel.matchPieces);
      
      // All pieces refresh by 1 turn
      pieces.forEach(piece => piece.value.wait && piece.modify(v => { v.wait--; return v; }));
      
      // Make sure all moved pieces are in this match
      let badPiece = playerMoves.find(({ uid }) => uid && !pieces.has(uid));
      if (badPiece) throw new Error(`We don't own Piece ${badPiece[0].uid}`);;
      
      // Update piece positions
      playerMoves.forEach(({ uid, tile }) => {
        if (!uid) return;
        pieces[uid].modify(v => v.gain({ x: tile[0], y: tile[1], wait: 1 }))
      });
      
      // Look for promotions
      pieces.forEach(piece => {
        if (!piece.value || piece.value.type !== 'pawn') return;
        let { colour, y } = piece.value;
        if ((colour === 'white' && y === 7) || (colour === 'black' && y === 0))
          piece.modify(v => v.gain({ type: 'queen' }));
      });
      
      // Get captured pieces...
      let [ p1Trgs, p2Trgs ] = playerMoves.map(({ uid, tile }) => {
        if (!uid) return {};
        let collided = pieces.map(p => (p.value.x === tile[0] && p.value.y === tile[1]) ? p : C.skip);
        delete collided[uid]; // Pieces can't capture themselves!
        return collided;
      });
      
      // And remove them
      p1Trgs.forEach(pc => pc.shut());
      p2Trgs.forEach(pc => pc.shut());
      
      // Check if either player has captured the others' king
      let p1CapturedKing = !!p1Trgs.find(piece => piece.value.type === 'king');
      let p2CapturedKing = !!p2Trgs.find(piece => piece.value.type === 'king');
      
      // If a king is captured, or no player played a non-pass move, conclude match
      let concluded = p1CapturedKing || p2CapturedKing || !playerMoves.find(({ uid }) => uid);
      
      if (!concluded) return 'inconclusive';
      if (p1CapturedKing === p2CapturedKing) return 'stalemate';
      return p1CapturedKing ? 'white' : 'black';
      
    }
    
    let landsRt = hinterlands.rt;
    
    let { rt, add } = recTyper();
    add('chess2', Rec);
    add('match',  Rec);
    add('round',  Rec);
    add('piece',  Rec)
    add('player', Rec);
    add('move',   Rec);
    add('archChess2',       Rec, '11', landsRt.arch,    rt.chess2);
    add('chess2Match',      Rec, '1M', rt.chess2,       rt.match);
    add('matchRound',       Rec, '1M', rt.match,        rt.round);
    add('matchPiece',       Rec, '1M', rt.match,        rt.piece);
    add('hutPlayer',        Rec, '11', landsRt.hut,     rt.player);
    add('chess2Player',     Rec, '1M', rt.chess2,       rt.player);
    add('matchWhitePlayer', Rec, '11', rt.match,        rt.player);
    add('matchBlackPlayer', Rec, '11', rt.match,        rt.player);
    add('piecePlayer',      Rec, 'M1', rt.piece,        rt.player);
    add('playerMove',       Rec, '11', rt.player,       rt.move);
    
    let open = async () => {
      
      /// {ABOVE=
      
      // TODO: Images should probably automatically get included by the
      // real room - e.g. under decals, say `image: 'classicHorse'`, and
      // then the real room will automatically mount that file and add
      // a comWob to the lands to allow it to serve the file.
      // Mount files
      let pieceStyle = 'classicPieces';
      pieceNames.forEach(type => [ 'black', 'white' ].forEach(colour =>
        // TODO: shouldn't need to include "room/chess2"
        // The instance of `foundation` received should be specialized for this 1 room??
        foundation.addMountFile(`img/${colour}-${type}.png`, 'image/png', `room/chess2/img/${pieceStyle}/${colour}-${type}.png`)
      ));
      
      /// =ABOVE}
      
      let recTypes = { ...rt, ...landsRt };
      let lands = U.lands = Lands({ recTypes, heartbeatMs: 1 * 60 * 1000 });
      lands.makeServers.push(pool => foundation.makeHttpServer(pool, '127.0.0.1', 80));
      lands.makeServers.push(pool => foundation.makeSoktServer(pool, '127.0.0.1', 8000));
      
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      lands.realLayout = {
        'main': {
          slot: par => par.cmps.slots.insertViewPortItem(),
          slots: AxisSections({ axis: 'y', cuts: [ UnitPx(50) ] }),
          decals: {
            colour: 'rgba(0, 0, 0, 1)'
          }
        },
        'main.header': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          size: ShowText({ origin: 'cc' }),
          decals: {
            textColour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(35)
          }
        },
        'main.withFooter': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          slots: AxisSections({ axis: 'y', dir: '-', cuts: [ UnitPx(50) ] })
        },
        'main.withFooter.footer': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          decals: { colour: 'rgba(0, 255, 0, 0.2)' }
        },
        'main.withFooter.content': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          decals: { colour: 'rgba(255, 0, 0, 0.2)' }
        },
        'main.withFooter.content.join': {
          size: ShowText({ origin: 'cc' }),
          decals: {
            textSize: UnitPx(30),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.withFooter.content.wait': {
          size: FillParent({}),
          decals: { colour: 'rgba(255, 0, 0, 0.5)' }
        },
        'main.withFooter.content.play': {
          size: FillParent({}),
          slots: AxisSections({ axis: 'y', dir: '+', cuts: [ UnitPx(30) ] }),
          decals: { colour: 'rgba(255, 255, 255, 1)' }
        },
        'main.withFooter.content.play.white': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textColour: 'rgba(0, 0, 0, 1)'
          }
        },
        'main.withFooter.content.play.content': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          slots: AxisSections({ axis: 'y', dir: '-', cuts: [ UnitPx(30) ] }),
          decals: {}
        },
        'main.withFooter.content.play.content.black': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          decals: {
            colour: 'rgba(0, 0, 0, 1)',
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.withFooter.content.play.content.boardHolder': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          slots: null // Horizontal-items with a single board item?
        }
      };
      
      /// {ABOVE=
      
      lands.setRealRooms([ realHtmlCss ]);
      let chess2 = lands.createRec('chess2', { value: { version: '0.0.1', numPlayers: 0 } });
      let archStoryMix = lands.createRec('archChess2', {}, lands.arch, chess2);
      
      /// =ABOVE}
      
      let rootScope = HorzScope(lands.arch.relWob(rt.archChess2), async (dep, archChess2) => {
        
        let [ arch, chess2 ] = archChess2.members;
        
        /// {ABOVE=
        
        // Liven up the "numPlayers" property of `chess2`
        dep(chess2.relScope(rt.chess2Player, (dep, chess2Player) => {
          chess2.modify(v => (v.numPlayers++, v));
          dep(Hog(() => chess2.modify(v => (v.numPlayers--, v))));
        }));
        
        dep(arch.relScope(landsRt.archHut, (dep, archHut, { hut }) => {
          
          console.log('GOT HUT:', hut.getTerm());
          
          // Follow:
          // - Chess2
          // - Chess2 Player
          // - Chess2 Player's Match
          // - Chess2 Player's Match's Players
          // - Chess2 Player's Match's Pieces
          dep(hut.follow(archChess2));
          dep(hut.relScope(rt.hutPlayer, (dep, hutPlayer, { player }) => {
            
            dep(player.relScope(rt.chess2Player, (dep, chess2Player) => {
              
              dep(hut.follow(chess2Player));
              
              dep(player.relScope(rt.matchPlayer, (dep, matchPlayer, { match }) => {
                
                dep(hut.follow(matchPlayer));
                dep(match.relScope(rt.matchPlayer, (dep, matchPlayer) => dep(hut.follow(matchPlayer))));
                dep(match.relScope(rt.matchPiece, (dep, matchPiece) => dep(hut.follow(matchPiece))));
                
              }));
              
            }));
            
          }));
          
        }));
        
// ------------------------------------------
        
        dep(HorzScope(lands.arch.relWob(landsRt.archHut), (dep, archHut) => {
          
          let hut = archHut.members[1];
          
          // TODO: HEEERE!! (look above)
          let noPlayerWob = dep(WobInv(hut.relWob(rt.hutPlayer)));
          
          dep(HorzScope(noPlayerWob, dep => {
            dep(hut.comWob('chess2Init').hold(() => {
              let player = lands.createRec('player', { value: { term: hut.getTerm(), status: 'waiting', colour: null } });
              let chess2Player = lands.createRec('chess2Player', {}, chess2, player);
              let hutPlayer = lands.createRec('hutPlayer', {}, hut, player);
            }));
          }));
          
        }));
        
        let matchmakeInterval = setInterval(() => {
          
          // Get all "waiting" players
          let matchmakePlayers = chess2.relRecs(rt.chess2Player)
            .map(({ members: [ _, p ] }) => p.value.status === 'waiting' ? p : C.skip)
            .sort(() => 0.5 - Math.random());
          
          // Divide `matchmakePlayers` into 2
          let numMatches = matchmakePlayers.length >> 1;
          let whites = matchmakePlayers.slice(0, numMatches);
          let blacks = matchmakePlayers.slice(numMatches, numMatches * 2);
          
          for (let i = 0; i < numMatches; i++) {
            
            // Create a match with the selected players
            let match = lands.createRec('match', { value: { turnCount: 0, movesDeadlineMs: null } });
            match.whitePlayer = whites[i];
            match.blackPlayer = blacks[i];
            lands.createRec('chess2Match', {}, chess2, match);
            
          }
          
        }, 3000);
        dep(Hog(() => clearInterval(matchmakeInterval)));
        
        dep(HorzScope(chess2.relWob(rt.chess2Match), (dep, chess2Match) => {
          
          let match = chess2Match.members[1];
          let { whitePlayer, blackPlayer } = match;
          
          let whiteMatchPlayer = dep(lands.createRec('matchPlayer', {}, match, whitePlayer));
          let blackMatchPlayer = dep(lands.createRec('matchPlayer', {}, match, blackPlayer));
          whitePlayer.modify(v => v.gain({ colour: 'white' }));
          blackPlayer.modify(v => v.gain({ colour: 'black' }));
          
          // TODO: Scope creation for WobTmp should probably happen in
          // an anonymous function that is a param for the WobTmp...
          let matchPopulatedWob = dep(WobAll([ match.relWob(rt.matchWhitePlayer), match.relWob(rt.matchBlackPlayer) ]));
          
          let matchPlayerWob = match.relWob(rt.matchPlayer);
          let numMatchPlayersWob = matchPlayerWob.countWob(); // Recs should support `countWob`. Should it be a Hog?
          
          // A match is finished, really, when it *has had* players in
          // it, and it no longer has players in it
          
          // TODO:
          // - Asking for a `WobFlt` on a simple changing value (WobVal)
          // should produce a Single-style wobble for the duration that
          // the changing value passes the filter.
          // - A `WobFlt` on a SingleMortalBearer should produce a
          // Single-style wobble while a filter-passing Mortal exists.
          // This can assume that the Mortal is immutable, so if it
          // passes the filter on the first wobble it doesn't have to be
          // held any further for its value.
          // - A `WobFlt` on a PluralMortalBearer should produce a
          // Plural-style wobble for each Mortal that passes the filter
          
          let matchHasOutcomeWob = Wob();
          let matchNoOutcomeWob = dep(WobInv(matchConcludedWob));
          
          //let matchPopulatedWob = dep(WobFlt(numMatchPlayersWob, v => v === 2));
          let matchPlayableWob = dep(WobAll([ matchNoOutcomeWob, matchPopulatedWob ]));;
          
          dep(HorzScope(matchPlayableWob, dep => {
            
            let players = [
              { p: whitePlayer, o: blackPlayer, colour: 'white' },
              { p: blackPlayer, o: whitePlayer, colour: 'black' },
            ];
            players.forEach(({ p, o, colour }) => {
              
              // Player has exited if they have no more match
              let exitWob = dep(WobInv(p.relWob(rt.matchPlayer)));
              
              // If the player exits, hand victory to opponent
              dep(exitWob.hold(() => o.modify(v => v.gain({ status: 'victorious' })) ));
              
              // Set player as playing
              p.modify(v => v.gain({ status: 'playing', colour }));
              
              // Set up pieces for player
              pieceDefs.standard[colour].forEach(([ type, x, y ]) => {
                let piece = dep(lands.createRec('piece', { colour, type, x, y, wait: 0 }));
                lands.createRec('matchPiece', {}, match, piece);
                lands.createRec('piecePlayer', {}, piece, p);
              });
              
              // Set up commands for player
              dep(HorzScope(p.relWob(rt.hutPlayer), (dep, hutPlayer) => {
                let hut = hutPlayer.members[0];
                dep(hut.comWob('playAgain').hold(() => {
                  p.relRec(rt.matchPlayer).shut();
                  p.modify(v => v.gain({ status: 'waiting', colour: null }));
                }));
                dep(hut.comWob('movePiece').hold(({ msg: { uid, tile } }) => {
                  
                  if (!tile) {  // Null `tile` means cancel the move
                    
                    if (!p.relRec(rt.playerMove)) return hut.tell({ command: 'error', type: 'noMove', orig: msg });
                    p.relRec(rt.playerMove).shut();
                    
                  } else {      // Otherwise set the move
                    
                    // TODO: Separate piece and destination coords?
                    let [ x, y ] = tile;
                    
                    let validCoords = U.isType(x, Number) && U.isType(y, Number)
                      && x >= 0 && x <= 7 && y >= 0 && y <= 7;
                    if (!validCoords) return hut.tell({ command: 'error', type: 'coordFormat', orig: msg });
                    
                    if (!p.relRec(rt.playerMove)) {
                      let move = lands.createRec('move', { uid, x, y });
                      lands.createRec('playerMove', {}, p, move);
                    } else {
                      p.relRec(rt.playerMove).wobble({ uid, x, y });
                    }
                    
                  }
                  
                }));
              }));
              
            });
            
            dep(match.relScope(rt.matchRound, (dep, matchRound) => {
              
              let round = matchRound.members[1];
              round.modify(v => v.gain({ movesDeadlineMs: foundation.getMs + moveMs }));
              
              // Clear player moves
              players.forEach(({ p }) => {
                if (p.relRec(rt.playerMove)) p.relRec(rt.playerMove).members[1].shut();
              });
              
              let bothMovesWob =  dep(WobAll([ whitePlayer.relWob(rt.playerMove), blackPlayer.relWob(rt.playerMove) ]));
              let timerWob =      dep(WobDelay(moveMs));
              let roundOverWob =  dep(WobAny([ bothMovesWob, timerWob ]));
              
            }));
            
          }));
          
          dep(HorzScope(matchPopulatedWob, dep => {
            
            let players = [ whitePlayer, blackPlayer ];
            
            dep(HorzScope(match.relWob(rt.matchRound), (dep, matchRound) => {
              
              let round = matchRound.members[0];
              match.modify(v => v.gain({ movesDeadlineMs: foundation.getMs() + moveMs }));
              dep(Hog(() => match.modify(v => v.gain({ movesDeadlineMs: null }))));
              
              let bothMovesWob =  dep(WobAll([ whitePlayer.relWob(rt.playerMove), blackPlayer.relWob(rt.playerMove) ]));
              let timerWob =      dep(WobDelay(moveMs));
              let roundOverWob =  dep(WobAny([ bothMovesWob, timerWob ]));
              
              dep(HorzScope(roundOverWob, dep => {
                
                let result = applyMoves(match, ...players.map(p => p.relRec(rt.playerMove)));
                round.shut();
                
                if (result === 'inconclusive') {
                  let nextRound = lands.createRec('round');
                  lands.createRec('matchRound', {}, match, nextRound);
                } else if (result === 'stalemate') {
                  whitePlayer.modify(v => v.gain({ status: 'stalemated' }));
                  blackPlayer.modify(v => v.gain({ status: 'stalemated' }));
                } else if (result === 'white') {
                  whitePlayer.modify(v => v.gain({ status: 'victorious' }));
                  blackPlayer.modify(v => v.gain({ status: 'defeated' }));
                } else if (result === 'black') {
                  whitePlayer.modify(v => v.gain({ status: 'defeated' }));
                  blackPlayer.modify(v => v.gain({ status: 'victorious' }));
                }
                
              }));
              
            }));
            
            let initialRound = lands.createRec('round');
            lands.createRec('matchRound', {}, match, initialRound);
            
          }));
          
          let matchPlayerLeftWob = dep(WobInv(matchPopulatedWob));
          dep(HorzScope(matchPlayerLeftWob, dep => {
            
            
            
          }));
          
        }));
        
        /// =ABOVE} {BELOW=
        
        let rootReal = await lands.getRootReal();
        
        let mainReal = dep(rootReal.addReal('main'));
        let withFooterReal = mainReal.addReal('withFooter');
        let headerReal = mainReal.addReal('header');
        let footerReal = withFooterReal.addReal('footer');
        let contentReal = withFooterReal.addReal('content');
        
        headerReal.setText('Chess2');
        
        let playerWob = chess2.relWob(rt.chess2Player);
        let myPlayerWob = dep(WobFltVal(playerWob, p => p.value.term === U.hutTerm));
        let noPlayerWob = dep(WobInv(myPlayerWob));
        
        dep(HorzScope(playerWob, (dep, player) => {
          console.log('GOT GENERIC PLAYER:', player);
        }));
        
        dep(chess2.hold(v => console.log('META CHANGED:', v)));
        
        dep(HorzScope(noPlayerWob, dep => {
          
          console.log('Waiting to join...');
          
          let joinReal = contentReal.addReal('join');
          joinReal.setText('Join?');
          joinReal.feelWob().hold(() => {
            lands.tell({ command: 'chess2Init' });
          });
          
        }));
        
        dep(HorzScope(myPlayerWob, (dep, player) => {
          
          console.log('PLAYER:', player);
          
          let matchPlayerWob = player.relWob(rt.matchPlayer);
          let noMatchPlayerWob = dep(WobInv(matchWob));
          
          dep(HorzScope(noMatchPlayerWob, dep => {
            
            console.log('WAITING...');
            let waitReal = dep(contentReal.addReal('wait'));
            
          }));
          
          dep(HorzScope(matchPlayerWob, matchPlayer => {
            
            console.log('WE IN A MATCH! OUR PLAYER:', player);
            
          }));
          
        }));
        
        //let headerReal = mainReal.addReal('header', 'lolol');
        //let titleReal = headerReal.addReal('title');
        //titleReal.setText('StoryMix');
        
        
        /// =BELOW}
        
      });
      
      if (false) AccessPath(null, { attach: U.WobVal(lands), detach: U.Wob() }, ...nop, (ap, dep, lands) => {
        
        // Chess2 gameplay
        dep(AccessPath(ap, lands.relWob(rel.landsChess2), ...nop, (ap, dep, chess2) => {
          
          // Match gameplay
          dep(AccessPath(ap, chess2.relWob(rel.chess2Matches), ...nop, (ap, matchDep, match) => {
            
            // Stage 1 (Two Players are in the Match)
            let match2PWob = matchDep(U.WobFnc(matchPlayerWob.attach, () => matchPlayerCount() === 2 ? null : C.skip));
            matchDep(AccessPath(ap, { attach: match2PWob, detach: U.Wob() }, ...nop, (ap) => {
              
              // These `matchPlayers` should remained fixed for the duration of the FilledMatch
              let matchPlayers = match.relVal(rel.matchPlayers).toArr(v => v);
              
              // Begin an initial Round
              let initialRound = matchDep(Round({ lands }));
              match.attach(rel.matchRound, initialRound);
              
              // Round gameplay...
              matchDep(AccessPath(ap, match.relWob(rel.matchRound), ...nop, (ap, roundDep, round) => {
                
                // Send deadline info Below (TODO: Could consider just syncing the Round)
                match.modify(v => v.gain({ movesDeadlineMs: foundation.getMs() + moveMs }));
                roundDep({ shut: () => match.modify(v => v.gain({ movesDeadlineMs: null })) });
                
                // Set up listeners for Player Moves
                let moveWobs = matchPlayers.map(pl => pl.relVal(rel.playerHut).comWob('movePiece'));
                let bothMovesWob = roundDep(U.WobFnc(moveWobs, (...m) => m.map(m => m && m.msg.slice('uid', 'tile'))));
                
                let resolveRound = () => {
                  
                  let result = match.applyMoves(bothMovesWob.getValue());
                  
                  // Conclude this round
                  round.shut();
                  
                  if (result === 'inconclusive') {
                    let newRound = matchDep(Round({ lands }));
                    match.attach(rel.matchRound, newRound);
                  } else if (result === 'stalemate') {
                    matchPlayers[0].modify(v => v.gain({ status: 'stalemated' }));
                    matchPlayers[1].modify(v => v.gain({ status: 'stalemated' }));
                  } else if (result === 'white') {
                    matchPlayers[0].modify(v => v.gain({ status: 'victorious' }));
                    matchPlayers[1].modify(v => v.gain({ status: 'defeated' }));
                  } else if (result === 'black') {
                    matchPlayers[1].modify(v => v.gain({ status: 'victorious' }));
                    matchPlayers[0].modify(v => v.gain({ status: 'defeated' }));
                  }
                  
                };
                
                // A timer resolves the Round
                roundDep(U.WobDel(moveMs)).hold(resolveRound);
                
                // When neither Player hasn't submitted a Move resolve the Round
                roundDep(U.WobFnc(bothMovesWob, m => m.find(m => !m) ? C.skip : m)).hold(resolveRound);
                
                // TODO: *** This is as far as the comments go
                
              }));
              
              // Check for the 1st player to leave
              let match1PWob = matchDep(U.WobFnc(matchPlayerWob.detach, () => matchPlayerCount() === 1 ? null : C.skip));
              matchDep(AccessPath(ap, { attach: match1PWob, detach: U.Wob() }, ...nop, (ap) => {
                
                // TODO: The Round should clean itself up; its AccessPath should have a proper "detach"
                //       The Round should automatically end when there aren't sufficient Players
                
                // Players can exit whenever, even in the middle of a Round - so if a Round is still going, end it!
                let round = match.relVal(rel.matchRound);
                if (round) round.shut();
                
                // If the leaver left while the remaining Player is still "playing", that Player wins
                let remainingPlayer = match.relVal(rel.matchPlayers).find(v => v)[0];
                if (remainingPlayer.value.status === 'playing') remainingPlayer.modify(v => v.gain({ status: 'victorious' }));
                
                // Check for the last player to leave; this cleans up the Match
                let match0PWob = matchDep(U.WobFnc(matchPlayerWob.detach, () => matchPlayerCount() === 0 ? null : C.skip));
                matchDep(AccessPath(ap, { attach: match0PWob, detach: U.Wob() }, ...nop, (ap) => {
                  
                  match.shut();
                  
                }));
                
              }));
              
            }));
            
            
            
          }));
          
        }));
        
      });
      
      /// {BELOW=
      
      if (false) {
        let { Colour, Real } = real;
        
        let colours = {
          clear: 'rgba(0, 0, 0, 0)',
          whiteTile: 'rgba(170, 170, 170, 1)',
          blackTile: 'rgba(140, 140, 140, 1)',
          whitePiece: 'rgba(205, 205, 205, 0.2)',
          blackPiece: 'rgba(100, 100, 100, 0.2)',
          selected: 'rgba(0, 255, 255, 0.9)',
          confirmed: 'rgba(0, 245, 20, 0.9)',
          disabled: 'rgba(245, 50, 0, 0.9)'
        };
        let imgs = await Promise.allObj({
          white: Promise.allObj(pieceNames.toObj(v => [ v, foundation.getMountFile(`img/white-${v}.png`) ])),
          black: Promise.allObj(pieceNames.toObj(v => [ v, foundation.getMountFile(`img/black-${v}.png`) ]))
        });
        
        let totalSize = 2000;
        let metaRoom = 100;
        let matchSize = totalSize - (metaRoom * 2);
        let boardSize = 1500;
        let playerSize = Math.round((matchSize - boardSize) * 0.5);
        let tileSize = Math.round(boardSize / 8);
        let tileHSize = Math.round(tileSize >> 1);
        let tileLoc = (x, y) => [ tileHSize + (x - 4) * tileSize, -tileHSize + (4 - y) * tileSize ];
        let pieceSize = 150;
        let avatarSize = 200;
        let indicatorSize = 80;
        let borderWidthSimple = 8;
        let borderWidthBold = 12;
        
        let type = [ 'withAccessPaths', 'badAndUgly' ][1];
        if (type === 'withAccessPaths') { // ------------------==========lllllllllllllll
          
          let nop = [ v => {}, v => {} ];
          AccessPath(null, { attach: U.WobVal(lands), detach: U.Wob() }, ...nop, (ap, dep, lands) => {
            
            let rootReal = dep(Real({ isRoot: true, flag: 'root' }));
            
            dep(AccessPath(null, lands.relWob(rel.landsChess2), ...nop, (ap, dep, chess2) => {
              
              let chess2Real = dep(rootReal.addReal(Real({ flag: 'scale' })));
              chess2Real.setSize(totalSize, totalSize);
              chess2Real.setColour('rgba(0, 0, 0, 0)');
              let scaleFac = 1 / totalSize;
              let scaleFunc = () => {
                let { width, height } = document.body.getBoundingClientRect();
                let scaleAmt = (width <= height ? width : height) * scaleFac;
                chess2Real.setScale(scaleAmt);
              };
              window.addEventListener('resize', scaleFunc);
              scaleFunc();
              
              let matchHolder = chess2Real.addReal(Real({}));
              matchHolder.setSize(matchSize);
              
              let statusReal = chess2Real.addReal(Real({}));
              statusReal.setSize(Math.round(matchSize / 4), metaRoom);
              statusReal.setAgainst(matchHolder, 'tl', -500, 0);
              statusReal.setColour('rgba(0, 0, 0, 0.2)');
              statusReal.setTextColour('rgba(255, 255, 255, 1)');
              statusReal.setTextSize(42);
              
              let myPlayer = null;
              
              let myPlayerWob = dep(U.WobFnc(chess2.relWob(rel.chess2Players).attach, pl => pl.term === U.hutTerm ? pl : C.skip));
              dep(AccessPath(ap, { attach: myPlayerWob, detach: U.Wob() }, ...nop, (ap, myPlayerDep, myPlayer) => {
                
                let myPlayerShowNoticeWob = dep(U.WobFnc(myPlayer, v => v.status !== 'playing' ? 'yes' : 'no'));
                let mulShowNotice = dep(U.MulTmps(myPlayerStatusWob));
                
                dep(AccessPath(ap, mulShowNotice.getTmp('yes'), ...nop, (ap, noticeDep) => {
                  
                  let notifyReal = noticeDep(chess2Real.addReal(Real({ flag: 'notify' })));
                  notifyReal.setSize(1000, 1000);
                  notifyReal.setColour('rgba(0, 0, 0, 0.75)');
                  notifyReal.setPriority(2);
                  notifyReal.setOpacity(0);
                  notifyReal.setTransition('opacity', 500, 'sharp');
                  notifyReal.addWob.hold(() => nv.setOpacity(1));
                  
                  let { status } = myPlayer.getValue();
                  
                  /*
                  let myPlayerStatusWob = dep(U.WobFnc(myPlayer, v => v.status));
                  let mulStatus = dep(U.MulTmps(myPlayerStatusWob));
                  
                  dep(AccessPath(ap, mulStatus.getTmp('uninitialized')
                  
                  if (status === 'uninitialized') {
                    notifyReal.setTextSize(65);
                    notifyReal.setText('Welcome to Chess2!');
                  }
                  
                  
                  let updateNotifyHold = myPlayer.hold(v => {
                    
                    if (v.status === 'uninitialized') {
                      notifyReal.setTextSize(65);
                      notifyReal.setText('Welcome to Chess2!');
                    } else if (v.
                    
                  });
                  noticeDep({ shut: () => myPlayer.drop(updateNotifyHold) });
                  
                  console.log('SHOW NOTICE!');
                  if (notifyReal) { scaleApp.remReal(notifyReal); notifyReal = null; }
                  
                  if (!v) return;
                  let { status } = v;
                  if (status === 'playing') return;
                  
                  let nv = notifyReal = scaleApp.addReal(Real({}));
                  nv.setSize(1000, 1000);
                  nv.setColour('rgba(0, 0, 0, 0.75)');
                  nv.setPriority(2);
                  nv.setOpacity(0);
                  nv.setTransition('opacity', 500, 'sharp');
                  nv.addWob.hold(() => nv.setOpacity(1));
                  
                  if (status === 'uninitialized') {
                    
                    nv.setTextSize(65);
                    nv.setText('Welcome to Chess2!');
                    
                    let enterReal = nv.addReal(Real({ flag: 'enter' }));
                    enterReal.setSize(480, 120);
                    enterReal.setLoc(0, 280);
                    enterReal.setTextSize(50);
                    enterReal.setText('Start playing!');
                    enterReal.setFeel('bumpy');
                    enterReal.setBorder('outer', 10, 'rgba(255, 255, 255, 0.3)');
                    enterReal.interactWob.hold(active => {
                      if (!active) return;
                      lands.tell({ command: 'initialize' });
                    });
                    
                  } else if (status === 'waiting') {
                    
                    nv.setTextSize(50);
                    nv.setText('Finding match...');
                    
                  } else {
                    
                    let [ text1, text2 ] = ({
                      victorious: [ 'You WIN!',       'Win more!' ],
                      defeated:   [ 'You LOSE!',      'Reclaim dignity' ],
                      stalemated: [ 'It\'s a DRAW!',  'More chess!' ]
                    })[status];
                    
                    nv.setTextSize(80);
                    nv.setText(text1);
                    
                    let playAgainReal = nv.addReal(Real({ flag: 'playAgain' }));
                    playAgainReal.setSize(450, 150);
                    playAgainReal.setColour('rgba(0, 0, 0, 0.85)');
                    playAgainReal.setLoc(0, 280);
                    playAgainReal.setTextSize(45);
                    playAgainReal.setText(text2);
                    playAgainReal.setBorder('outer', 10, 'rgba(255, 255, 255, 0.3)');
                    playAgainReal.setFeel('bumpy');
                    playAgainReal.interactWob.hold(active => {
                      if (!active) return;
                      lands.tell({ command: 'playAgain' });
                    });
                    
                  }
                  * a/
                  
                }));
                
              }));
              
            }));
            
          });
          
        } else if (type === 'badAndUgly') { //-----------------==========lllllllllllllll
          
          let mySelectedPiece = U.WobVal();
          let myConfirmedPiece = U.WobVal();
          let myConfirmedTile = U.WobVal();
          let myConfirmedPass = U.WobVal();
          let myChess2 = U.WobVal();
          let myPlayer = U.WobVal();
          
          // Confirming tiles and passing each cancel the other
          myConfirmedPass.hold(isPassing => {
            if (isPassing) { myConfirmedPiece.wobble(null); myConfirmedTile.wobble(null); }
          });
          myConfirmedTile.hold(tile => {
            if (tile) myConfirmedPass.wobble(false);
          });
          
          let genChess2 = () => {
            
            let chess2Real = Real({ isRoot: true, flag: 'root' });
            
            let scaleApp = chess2Real.addReal(Real({ flag: 'scale' }));
            scaleApp.setSize(totalSize, totalSize);
            scaleApp.setColour('rgba(0, 0, 0, 0)');
            
            let matchHolder = scaleApp.addReal(Real({}));
            matchHolder.setSize(matchSize);
            
            let statusReal = scaleApp.addReal(Real({}));
            statusReal.setSize(500, metaRoom);
            statusReal.setAgainst(matchHolder, 'tl', -500, 0);
            statusReal.setColour('rgba(0, 0, 0, 0.2)');
            statusReal.setTextColour('rgba(255, 255, 255, 1)');
            statusReal.setTextSize(42);
            myChess2.hold(chess2 => chess2 && chess2.hold(v => {
              statusReal.setText(`Players online: ${v ? v.playerCount : 0}`);
            }));
            
            // Display any matches which become associated
            let matchReal = null;
            myPlayer.hold(player => player && player.relWob(rel.matchPlayers).hold(matchRec => {
              if (matchReal) { matchHolder.remReal(matchReal); matchReal = null; }
              if (matchRec) matchReal = matchHolder.addReal(genMatch(matchRec));
            }));
            
            // Show notifications based on our player's status
            let notifyReal = null;
            myPlayer.hold(player => {
              
              let f = v => {
                
                if (notifyReal) { scaleApp.remReal(notifyReal); notifyReal = null; }
                
                if (!v) return;
                let { status } = v;
                if (status === 'playing') return;
                
                let nv = notifyReal = scaleApp.addReal(Real({}));
                nv.setSize(1000, 1000);
                nv.setColour('rgba(0, 0, 0, 0.75)');
                nv.setPriority(2);
                nv.setOpacity(0);
                nv.setTransition('opacity', 500, 'sharp');
                nv.addWob.hold(() => nv.setOpacity(1));
                
                if (status === 'uninitialized') {
                  
                  nv.setTextSize(65);
                  nv.setText('Welcome to Chess2!');
                  
                  let enterReal = nv.addReal(Real({ flag: 'enter' }));
                  enterReal.setSize(480, 120);
                  enterReal.setLoc(0, 280);
                  enterReal.setTextSize(50);
                  enterReal.setText('Start playing!');
                  enterReal.setFeel('bumpy');
                  enterReal.setBorder('outer', 10, 'rgba(255, 255, 255, 0.3)');
                  enterReal.interactWob.hold(active => {
                    if (!active) return;
                    lands.tell({ command: 'initialize' });
                  });
                  
                } else if (status === 'waiting') {
                  
                  nv.setTextSize(50);
                  nv.setText('Finding match...');
                  
                } else {
                  
                  let [ text1, text2 ] = ({
                    victorious: [ 'You WIN!',       'Win more!' ],
                    defeated:   [ 'You LOSE!',      'Reclaim dignity' ],
                    stalemated: [ 'It\'s a DRAW!',  'More chess!' ]
                  })[status];
                  
                  nv.setTextSize(80);
                  nv.setText(text1);
                  
                  let playAgainReal = nv.addReal(Real({ flag: 'playAgain' }));
                  playAgainReal.setSize(450, 150);
                  playAgainReal.setColour('rgba(0, 0, 0, 0.85)');
                  playAgainReal.setLoc(0, 280);
                  playAgainReal.setTextSize(45);
                  playAgainReal.setText(text2);
                  playAgainReal.setBorder('outer', 10, 'rgba(255, 255, 255, 0.3)');
                  playAgainReal.setFeel('bumpy');
                  playAgainReal.interactWob.hold(active => {
                    if (!active) return;
                    lands.tell({ command: 'playAgain' });
                  });
                  
                }
                
              };
              
              player ? player.hold(f) : f({ status: 'uninitialized' });
              
            });
            
            let scaleFac = 1 / totalSize;
            let scaleFunc = () => {
              let { width, height } = document.body.getBoundingClientRect();
              let scaleAmt = (width <= height ? width : height) * scaleFac;
              scaleApp.setScale(scaleAmt);
            };
            window.addEventListener('resize', scaleFunc);
            scaleFunc();
            
          };
          let genMatch = matchRec => {
            let real = Real({ flag: 'match' });
            real.setSize(matchSize, matchSize);
            real.setColour('rgba(0, 0, 0, 0.8)');
            real.setPriority(1);
            
            // Flip the match for the black player
            myPlayer.hold(p => p && p.hold(v => real.setRot(v && v.colour === 'black' ? 180 : 0)));
            
            // ==============================
            
            // Build the board
            let boardReal = real.addReal(Real({ flag: 'board' }));
            boardReal.setSize(boardSize, boardSize);
            
            // The entire board is only tangible when the player is playing
            myPlayer.hold(p => p && p.hold(v => boardReal.setFeel(v && v.status === 'playing' ? 'smooth' : 'airy')));
            
            let confirmedTileReal = null;
            for (let x = 0; x < 8; x++) { for (let y = 0; y < 8; y++) {
              
              // Add a physical tile to the board
              let tileReal = boardReal.addReal(Real({ flag: 'tile' }));
              let colour = (y % 2) === (x % 2) ? colours.blackTile : colours.whiteTile;
              tileReal.setColour(colour);
              tileReal.setSize(tileSize, tileSize);
              tileReal.setLoc(...tileLoc(x, y));
              tileReal.interactWob.hold(active => active && mySelectedPiece.wobble(null));
              
            }}
            
            // When a tile becomes confirmed put an indicator on the board
            myConfirmedTile.hold(v => {
              if (confirmedTileReal) { confirmedTileReal.rem(); confirmedTileReal = null; }
              
              if (!v) return;
              
              [x0, y0, cap] = v;
              
              confirmedTileReal = boardReal.addReal(Real({ flag: 'confirmed' }));
              confirmedTileReal.setSize(tileSize, tileSize);
              confirmedTileReal.setLoc(...tileLoc(x0, y0));
              confirmedTileReal.setPriority(2);
              confirmedTileReal.setColour(colours.clear);
              
              let indicator = confirmedTileReal.addReal(Real({ flag: 'ind' }));
              indicator.setBorderRadius(1);
              indicator.setFeel('airy');
              if (!cap) {
                indicator.setSize(indicatorSize, indicatorSize);
                indicator.setColour(colours.confirmed);
              } else {
                indicator.setSize(pieceSize, pieceSize);
                indicator.setColour(colours.clear);
                indicator.setBorder('inner', borderWidthSimple, colours.confirmed);
              }
            });
            
            // Pieces on the board
            let pieceReals = {};
            matchRec.relWob(rel.matchPieces).attach.hold(rec => {
              pieceReals[rec.uid] = genPiece(rec);
              real.addReal(pieceReals[rec.uid]);
            });
            matchRec.relWob(rel.matchPieces).detach.hold(rec => {
              real.remReal(pieceReals[rec.uid]);
              delete pieceReals[rec.uid];
            });
            
            // When a piece becomes selected show selectors for all its valid moves
            let tileSelectors = [];
            mySelectedPiece.hold(piece => {
              
              tileSelectors.forEach(real => real.rem());
              tileSelectors = [];
              
              if (!piece) return;
                
              tileSelectors = piece.validMoves().map(([ x, y, cap ]) => {
                let tileReal = boardReal.addReal(Real({ flag: 'validTile' }));
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
                  indicator.setSize(pieceSize - (borderWidthSimple * 2));
                  indicator.setColour(colours.clear);
                  indicator.setBorder('outer', borderWidthSimple, colours.selected);
                }
                indicator.setFeel('airy');
                
                // Activating a selector confirms the move with Above
                tileReal.setFeel('bumpy');
                tileReal.interactWob.hold(active => {
                  if (!active) return;
                  lands.tell({ command: 'movePiece', uid: piece.uid, tile: [ x, y ] });
                  mySelectedPiece.wobble(null);
                  myConfirmedTile.wobble([ x, y, cap ]);
                  myConfirmedPiece.wobble(piece);
                });
                
                return tileReal;
              });
              
            });
            
            // ==============================
            
            // TODO: This doesn't work, but has correct format
            let playerReals = {};
            matchRec.relWob(rel.matchPlayers).attach.hold(playerRec => {
              
              let playerReal = playerReals[playerRec.uid] = real.addReal(Real({ flag: 'player' }));
              playerReal.setSize(matchSize, playerSize);
              
              let timerReal = null;
              matchRec.hold(v => {
                if (timerReal) { timerReal.rem(); timerReal = null; }
                
                if (v === null || v.movesDeadlineMs === null) return;
                
                let timeLeft = v.movesDeadlineMs - foundation.getMs();
                let timeLeftPerc = timeLeft / moveMs;
                let colourCool = Colour(0.3, 0.3, 1, 0.5);
                let colourHot = Colour(1, 0, 0, 0.5);
                
                timerReal = playerReal.addReal(Real({ flag: 'timer'}));
                timerReal.setSize(matchSize * timeLeftPerc, playerSize);
                timerReal.setColour(colourCool.fadeTo(colourHot, 1 - timeLeftPerc).toCss());
                timerReal.setPriority(1);
                timerReal.setFeel('airy');
                
                // Begin animation
                timerReal.setTransition('size', timeLeft, 'sharp');
                timerReal.setTransition('colour', timeLeft, 'sharp');
                timerReal.setSize(0, playerSize);
                timerReal.setColour(colourHot.toCss());
              });
              
              let playerNameReal = playerReal.addReal(Real({ flag: 'playerName' }));
              playerNameReal.setSize(matchSize, playerSize);
              playerNameReal.setColour(colours.clear);
              playerNameReal.setTextColour('rgba(255, 255, 255, 1)');
              playerNameReal.setTextSize(62);
              playerNameReal.setPriority(2);
              playerRec.hold(v => {
                playerNameReal.setText(`${v ? v.term : '- unknown -'}`);
                playerReal.setLoc(0, (v && v.colour === 'black' ? -0.5 : +0.5) * (matchSize - playerSize));
              });
              
              // Make sure to rotate things upright for the black player
              myPlayer.hold(p => p && p.hold(v => playerReal.setRot(v && v.colour === 'black' ? 180 : 0)));
              
              let passReal = null;
              myPlayer.hold(mp => {
                if (passReal) { passReal.rem(); passReal = null; }
                
                if (mp !== playerRec) return;
                
                passReal = playerReal.addReal(Real({ flag: 'player' }));
                passReal.setSize(180, 80);
                passReal.setLoc(750, 0);
                passReal.setColour('rgba(0, 0, 0, 0)');
                passReal.setPriority(3);
                passReal.setBorderRadius(0.2);
                passReal.setTextSize(48);
                passReal.setText('Pass');
                passReal.setTransition('colour', 200, 'sharp');
                myConfirmedPass.hold(isPassing => {
                  let [ bw, col ] = isPassing
                    ? [ borderWidthBold, colours.confirmed ]
                    : [ borderWidthSimple, 'rgba(255, 255, 255, 1)' ];
                  
                  passReal.setBorder('outer', bw, col);
                  passReal.setTextColour(col);
                });
                passReal.setFeel('bumpy');
                passReal.interactWob.hold(active => {
                  if (!active) return;
                  myConfirmedPass.wobble(true);
                  mySelectedPiece.wobble(null);
                  lands.tell({ command: 'movePiece', piece: null, tile: null });
                });
              });
            });
            matchRec.relWob(rel.matchPlayers).detach.hold(playerRec => {
              playerReals[playerRec.uid].rem();
              delete playerReals[playerRec.uid];
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
            real.setFeel('airy');
            real.setTransition('loc', 500, 'smooth');
            real.setTransition('opacity', 500, 'sharp');
            real.setRemovalDelayMs(1000);
            real.remWob.hold(() => {
              real.setPriority(4);
              setTimeout(() => { real.setScale(3); real.setOpacity(0); }, 500);
            });
            
            // Border depends on whether we are selected, confirmed, and/or waiting
            U.WobFnc([ rec, mySelectedPiece, myConfirmedPiece ], (...v) => v).hold(([ v, sel, cnf]) => {
              if (v && v.wait)      real.setBorder('outer', borderWidthSimple, colours.disabled);
              else if (sel === rec) real.setBorder('outer', borderWidthSimple, colours.selected);
              else if (cnf === rec) real.setBorder('outer', borderWidthBold,   colours.confirmed);
              else                  real.setBorder('outer', borderWidthSimple, colours.clear);
            });
            
            // The tangibility of this piece depends on colour and whether it's waiting
            U.WobFnc([ myPlayer, rec ], (...v) => v).hold(([ pl, pcVal ]) => {
              if (!pl || !pcVal) return;
              pl.hold(plVal => {
                real.setFeel(pcVal && pcVal.wait === 0 && plVal.colour === pcVal.colour ? 'bumpy' : 'airy');
              });
            });
            
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
              avatar.setImage(imgs[colour][type]);
              
              // If a piece moved we can clear the state of our last confirmation
              mySelectedPiece.wobble(null);
              myConfirmedPiece.wobble(null);
              myConfirmedTile.wobble(null);
              myConfirmedPass.wobble(null);
            });
            
            // Interactions cause piece to be selected
            grip.interactWob.hold(active => {
              if (!active) return;
              mySelectedPiece.modify(sel => sel === rec ? null : rec);
              myConfirmedPass.wobble(null); // Unselect the "pass" option if a piece is clicked
            });
            
            return real;
          };
          
          genChess2();
          
          lands.relWob(relLandsRecs).attach.hold(rec => {
            if (rec.isInspiredBy(Chess2)) myChess2.wobble(rec);
            if (rec.isInspiredBy(Player)) rec.hold(v => v && v.term === U.hutTerm && myPlayer.wobble(rec));
          });
          
        } // --------------------------------------------------==========lllllllllllllll
        
        let credits = document.body.appendChild(document.createElement('div'));
        credits.innerHTML = 'Project by Gershom Maes';
        credits.style.gain({
          position: 'absolute',
          right: '-71px',
          top: '50%',
          marginTop: '-9px',
          width: '160px',
          textAlign: 'center',
          height: '18px',
          lineHeight: '18px',
          fontSize: '10px',
          backgroundColor: 'rgba(100, 100, 100, 0.8)',
          color: 'rgba(255, 255, 255, 0.8)',
          transform: 'rotate(-90deg)'
        });
        
      }
      
      /// =BELOW}
      
      await lands.open();
      
    };
    
    return { open };
  }
});
*/
