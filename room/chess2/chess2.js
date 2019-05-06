// IMPROVE:
// [ ]  CLEAN THE HECK UP
// [ ]  Relations should be slightly reworked
//    [X] More certain getRelPart
//    [ ] Meaningful names instead of ints
//    [ ] Remove constraint: relations need to be defined in same order on Above/Below (incrementing uids)
// [ ]  Promotion (automatically queen?), en-passante
// [ ]  En passante?
// [ ]  Castling? (Which pieces need to wait? Both?)
// [/]  Deal with multiple tabs @ same session (Actually seems to work! Tabs are buggy, but no explosion. Test more?)
// [X]  Shorthand notation for Huts following Records
// [ ]  Shorthand notation for Records becoming Reals
// [ ]  Look into memory leaks - There's probably all kinds of Wobblies which need to be dropped
// [ ]  Watch out for XSS stuff through `domElem.innerHTML`
// [ ]  HTTP server logic should protect against huge payloads
// [ ]  HTTP server logic should enforce deadlines on transmission completions
// [ ]  Better UI, especially for mobile
//    [X] Fill more screen
//    [ ] Annoying magnifying feature on phones!
// [ ]  Accounts + login
// [ ]  Websockets

// getValue(), hold() --> data(), hold()
// relVal(), relWob() --> relData(), relHold()  (relHold attaches listener; doesn't return anything (IS THIS SUFFICIENT?))

U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { Record } = record;
    let { Lands, LandsRecord, Way, Hut, relLandsWays, relLandsRecs, relLandsHuts } = hinterlands;
    
    // Config values
    let moveMs = 10 * 1000;
    let matchmakeMs = 3000;
    let heartbeatMs = 30 * 1000;
    let pieceNames = [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ];
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
    
    let Chess2 = U.inspire({ name: 'Chess2', insps: { LandsRecord } });
    let Match  = U.inspire({ name: 'Match',  insps: { LandsRecord }, methods: (insp, Insp) => ({
      applyMoves: function(playerMoves) {
        
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
    })});
    let Round  = U.inspire({ name: 'Round',  insps: { LandsRecord } });
    let Player = U.inspire({ name: 'Player', insps: { LandsRecord } });
    let Piece  = U.inspire({ name: 'Piece',  insps: { LandsRecord }, methods: (insp, Insp) => ({
      validMoves: function () {
        // Get board and fellow pieces
        let pieces = this.relVal(rel.matchPieces).relVal(rel.matchPieces);
        
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
      }
    })});
    let Move   = U.inspire({ name: 'Move',   insps: { LandsRecord } });
    
    let rel = {
      chess2Matches:    Record.relate1M(Chess2, Match, 'matches'),
      playerHut:        Record.relate11(Player, Hut, 'playerHut'),
      landsChess2:      Record.relate11(Lands,  Chess2, 'landsChess2'),
      chess2Players:    Record.relate1M(Chess2, Player, 'chess2Players'),
      matchRound:       Record.relate11(Match, Round, 'matchRound'),
      matchPlayers:     Record.relate1M(Match, Player, 'matchPlayers'),
      matchPieces:      Record.relate1M(Match, Piece, 'matchPieces'),
      piecePlayer:      Record.relate1M(Player, Piece, 'piecePlayer'),
      playerMove:       Record.relate11(Player, Move, 'playerMove')
    };
    
    let open = async () => {
      console.log('Init chess2...');
      
      let lands = U.lands = Lands({
        foundation,
        commands: { initialize: 1, movePiece: 1, playAgain: 1 },
        records: [ Chess2, Match, Player, Piece ],
        relations: rel.toArr(v => v),
        heartbeatMs
      });
      
      /// {ABOVE=
      
      // Mount files
      pieceNames.forEach(type => [ 'black', 'white' ].forEach(colour =>
        // TODO: shouldn't need to include "room/chess2"
        // The instance of `foundation` received should be specialized for this 1 room??
        foundation.addMountFile(`img/${colour}-${type}.png`, `room/chess2/img/classicPieces/${colour}-${type}.png`, 'image/png')
      ));
      
      // ===================================================================
      
      let AccessPath = U.AccessPath;
      
      let nop = [ v => {}, v => {} ];
      AccessPath(null, { attach: U.WobVal(lands), detach: U.Wob() }, ...nop, (ap, dep, lands) => {
        
        // Create Chess2
        lands.attach(rel.landsChess2, Chess2({ lands, value: { playerCount: 0 } }));
        
        // Huts follow correct Records
        dep(AccessPath(ap, lands.relWob(relLandsHuts), ...nop, (ap, dep, hut) => {
          
          let term = hut.getTerm();
          let fol = [ rec => hut.followRec(rec), rec => hut.forgetRec(rec) ];
          
          // Follow chess2
          dep(AccessPath(ap, lands.relWob(rel.landsChess2), ...fol, null));
          
          // Follow the Hut's Player
          dep(AccessPath(ap, hut.relWob(rel.playerHut), ...fol, (ap, dep, player) => {
            
            dep(AccessPath(ap, player.relWob(rel.matchPlayers), ...fol, (ap, dep, match) => {
              dep(AccessPath(ap, match.relWob(rel.matchPlayers), ...fol));
              dep(AccessPath(ap, match.relWob(rel.matchPieces), ...fol));
            }));
            
          }));
          
        }));
        
        // Player functionality
        dep(AccessPath(ap, lands.relWob(relLandsHuts), ...nop, (ap, hutDep, hut) => {
          
          // Really, this should exist on an AccessPath which begins when a Hut is Player-less,
          // and ends when the Hut has a Player
          hutDep(U.WobFnc(hut.comWob('initialize'), v => v)).hold(() => {
            
            if (hut.relVal(rel.playerHut)) return;
            
            let player = hutDep(Player({ lands, value: { term: hut.getTerm() } }));
            player.attach(rel.playerHut, hut);
            
          });
          
        }));
        
        // Chess2 gameplay
        dep(AccessPath(ap, lands.relWob(rel.landsChess2), ...nop, (ap, dep, chess2) => {
          
          // Track player count
          let plWob = chess2.relWob(rel.chess2Players);
          let attHold = plWob.attach.hold(() => chess2.modify(v => { v.playerCount++; return v; }));
          let detHold = plWob.detach.hold(() => chess2.modify(v => { v.playerCount++; return v; }));
          dep({ shut: () => plWob.attach.drop(attHold) && plWob.detach.drop(detHold) });
          
          // Chess2 setup for Players
          dep(AccessPath(ap, lands.relWob(relLandsHuts), ...nop, (ap, dep, hut) => {
            
            dep(AccessPath(ap, hut.relWob(rel.playerHut), ...nop, (ap, dep, player) => {
              
              player.modify(v => v.gain({ status: 'waiting', colour: null }));
              player.attach(rel.chess2Players, chess2);
              
            }));
            
          }));
          
          // Matchmaking
          dep(U.WobRep(matchmakeMs)).hold(() => {
            
            // Players in roughly random order (TODO: Better shuffle algorithm)
            let matchmakePlayers = chess2.relVal(rel.chess2Players)
              .toArr(p => p.value && p.value.status === 'waiting' ? p : C.skip)
              .sort(() => 0.5 - Math.random());
            
            for (let i = 0; i < matchmakePlayers.length - 1; i += 2) {
              
              let match = dep(Match({ lands, value: { turns: 0, movesDeadlineMs: null } }));
              match.attach(rel.chess2Matches, chess2);
              match.attach(rel.matchPlayers, matchmakePlayers[i + 0]);
              match.attach(rel.matchPlayers, matchmakePlayers[i + 1]);
              
            }
            
          });
          
          // Match gameplay
          dep(AccessPath(ap, chess2.relWob(rel.chess2Matches), ...nop, (ap, matchDep, match) => {
            
            // Matches always proceed through the same three stages, in order:
            // 1: Both Players have joined
            // 2: A Player has left (a single Player remains)
            // 3: Both Players have left
            
            let matchPlayerWob = match.relWob(rel.matchPlayers);
            let matchPlayerCount = () => match.relVal(rel.matchPlayers).toArr(v => v).length;
            
            // Initialize Players joining the Match
            matchDep(AccessPath(ap, matchPlayerWob, ...nop, (ap, matchPlayerDep, player) => {
              
              let ind = matchPlayerCount() - 1;
              let colour = [ 'white', 'black' ][ind];
              
              player.modify(v => v.gain({ status: 'playing', colour }));
              matchPlayerDep({ shut: () => player.modify(v => v.gain({ status: 'waiting', colour: null })) });
              
              // Set up the Player's pieces
              pieceDefs.standard[ind].forEach(([ type, x, y ]) => {
                let piece = matchDep(Piece({ lands }));
                piece.wobble({ colour, type, x, y, wait: 0 });
                match.attach(rel.matchPieces, piece);
                player.attach(rel.piecePlayer, piece); // TODO: Should probably rename to "playerPieces"
              });
              
              // Allow Players to play again
              matchDep(U.WobFnc(player.relVal(rel.playerHut).comWob('playAgain'), v => v)).hold(() => {
                match.detach(rel.matchPlayers, player);
              });
              
            }));
            
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
      
      // ===================================================================
      
      /// =ABOVE} {BELOW=
      
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
                */
                
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
      
      /// =BELOW}
      
      let way = Way({ lands, makeServer: () => foundation.makeHttpServer() });
      lands.attach(relLandsWays, way);
      await lands.open();
    };
    
    return { open };
  }
});
