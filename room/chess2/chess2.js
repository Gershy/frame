// IMPROVE:
// [ ]  CLEAN THE HECK UP
// [ ]  Relations should be slightly reworked; more certain getRelPart, meaningful names instead of uids
// [ ]  Remove necessity to define relations in same order on Above/Below (currently incrementing uids need to match)
// [ ]  Promotion (automatically queen?), en-passante, consider castling? (which pieces need to wait? both?)
// [ ]  Deal with multiple tabs @ same session
// [ ]  Shorthand notation for Huts following Records
// [ ]  Shorthand notation for Records becoming Reals
// [ ]  Look into memory leaks - There's probably all kinds of Wobblies which need to be dropped
// [ ]  Watch out for XSS stuff through `domElem.innerHTML`
// [ ]  HTTP server logic should protect against huge payloads
// [ ]  HTTP server logic should enforce deadlines on transmission completions
// [ ]  Better UI, especially for mobile
// [ ]  Accounts + login
// [ ]  Websockets

// getValue(), hold() --> data(), hold()
// relVal(), relWob() --> relData(), relHold()  (relHold attaches listener; doesn't return anything (IS THIS SUFFICIENT?))

U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { Wobbly, CalcWob, IntervalWob, Law, Waw } = U;
    let { Record } = record;
    let { Lands, LandsRecord, Way, Hut, relLandsWays, relLandsRecs, relLandsHuts } = hinterlands;
    
    let Chess2 = U.inspire({ name: 'Chess2', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
        
        /// {ABOVE=
        this.wobble({ playerCount: 0 });
        let plWob = this.relWob(rel.chess2Players);
        plWob.attach.hold(() => this.modify(v => { v.playerCount++; return v; }));
        plWob.detach.hold(() => this.modify(v => { v.playerCount--; return v; }));
        /// =ABOVE}
      }
    })});
    let Match = U.inspire({ name: 'Match', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
        this.wobble({ turns: 0, movesDeadlineMs: null });
      }
    })});
    let Player = U.inspire({ name: 'Player', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands, hut }) {
        insp.LandsRecord.init.call(this, { uid, lands });
        
        /// {ABOVE=
        this.move = U.Wobbly({ value: null });
        this.wobble({ term: hut.getTerm(), gameStatus: 'waiting', colour: null });
        this.attach(rel.playerHut, hut);
        /// =ABOVE}
      }
    })});
    let Piece = U.inspire({ name: 'Piece', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      },
      validMoves: function () {
        // Get board and fellow pieces
        let pieces = this.relVal(rel.matchPieces).relVal(rel.matchPieces);
        
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
      matches:          Record.relate1M(Chess2, Match, 'matches'),
      playerHut:        Record.relate11(Player, Hut, 'playerHut'),
      chess2Players:    Record.relate1M(Chess2, Player, 'chess2Players'),
      matchPlayers:     Record.relate1M(Match, Player, 'matchPlayers'),
      matchPieces:      Record.relate1M(Match, Piece, 'matchPieces'),
      piecePlayer:      Record.relate1M(Player, Piece, 'piecePlayer'),
      playerMove:       Record.relate11(Player, Move, 'playerMove')
    };
    
    let open = async () => {
      console.log('Init chess2...');
      
      let records = [ Chess2, Match, Player, Piece ];
      let relations = rel.toArr(v => v);
      let lands = U.lands = Lands({
        foundation,
        commands: Lands.defaultCommands.map(v => v),
        records,
        relations,
        heartbeatMs: 60 * 1000 // 1 minute timeout
      });
      
      let moveMs = 50000;
      let matchmakeMs = 2000;
      let pieceNames = [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ];
      
      /// {ABOVE=
      
      // Mount files
      pieceNames.forEach(type => [ 'black', 'white' ].forEach(colour =>
        // TODO: shouldn't need to include "room/chess2"
        // The instance of `foundation` received should be specialized for this 1 room??
        foundation.addMountFile(`img/${colour}-${type}.png`, `room/chess2/img/classicPieces/${colour}-${type}.png`, 'image/png')
      ));
      
      // Listen for chess2-specific commands
      lands.commands.gain({
        initialize: async (lands, hut, msg) => {
          
          if (hut.relVal(rel.playerHut)) return;
          
          let player = Player({ lands, hut });
          chess2.attach(rel.chess2Players, player);
          
          // Clean up Player + Match when Hut is removed
          hut.relWob(rel.playerHut).detach.hold(player => {
            
            player.move.wobble(null);
            
            // Make sure to get the match before removing the player
            let match = player.relVal(rel.matchPlayers);
            lands.remRec(player);
            
            if (match) {
              // Update the match so that other player wins. Don't delete the
              // match; we want the winner to be able to stick around.
              match.modify(v => v.gain({ movesDeadlineMs: null }));
              match.relVal(rel.matchPlayers)
                .forEach(p => p.value.gameStatus === 'playing' ? p.modify(v => v.gain({ gameStatus: 'victorious' })) : null);
            }
            
          });
          
        },
        confirmMove: async (lands, hut, msg) => {
          let player = hut.relVal(rel.playerHut);
          let playerPieces = player.relVal(rel.piecePlayer);
          
          if (msg.piece !== null) {
            
            if (!playerPieces.has(msg.piece)) return hut.tell({ command: 'error', type: 'pieceNotFound', orig: msg });
            player.move.wobble({ piece: playerPieces[msg.piece], tile: msg.tile });
            
          } else {
            
            player.move.wobble({ piece: null, tile: null });
            
          }
        },
        playAgain: async (lands, hut, msg) => {
          let player = hut.relVal(rel.playerHut);
          if (!player) return;
          
          let match = player.relVal(rel.matchPlayers);
          if (!match) return;
          
          // TODO: This is temporary, because the follow/forget process isn't yet
          // smart enough to forget recursively! Eventually forgetting the Match
          // should automatically forget the Board, and forgetting the Board
          // forgets the Pieces, etc.
          match.relVal(rel.matchPieces).forEach(piece => hut.forgetRec(piece));
          hut.forgetRec(match);
          
          // Remove from match
          player.detach(rel.matchPlayers, match);
          
          // Update status
          hut.followRec(player);
          player.modify(v => v.gain({ colour: null, gameStatus: 'waiting' }));
          player.move.wobble(null);
        },
        getFeedback: async (lands, hut, msg, reply) => {
          
          let chess2 = lands.relVal(relLandsRecs).find(r => r.isInspiredBy(Chess2))[0];
          
          reply({
            name: 'Chess2',
            resources: foundation.getMemUsage(),
            numPlayers: chess2.relVal(rel.chess2Players).toArr(v => v).length,
            players: chess2.relVal(rel.chess2Players).map(player => {
              let hut = player.relVal(rel.playerHut);
              return {
                address: hut.address,
                term: hut.getTerm(),
                playerVal: player.value
              };
            }),
            numMatches: chess2.relVal(rel.matches).toArr(v => v).length,
            matches: chess2.relVal(rel.matches).map(match => {
              let white = match.relVal(rel.matchPlayers).find(p => p.value.colour === 'white')[0];
              let black = match.relVal(rel.matchPlayers).find(p => p.value.colour === 'black')[0];
              
              return {
                white: white.value,
                black: black.value,
                numWhitePieces: white.relVal(rel.piecePlayer).toArr(v => v).length,
                numBlackPieces: black.relVal(rel.piecePlayer).toArr(v => v).length
              };
            }),
            idsAtIp: lands.relVal(relLandsWays).find(v => true)[0].server.idsAtIp
          });
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
      
      Law('hutsFollow', Wobbly({ value: lands }), lands => [
        Law('huts', lands.relWob(relLandsHuts), hut => [
          Law('followChess2', Wobbly({ value: chess2 }), chess2 => [
            hut.genFollowTemp(chess2)
          ]),
          Law('followPlayer', hut.relWob(rel.playerHut), player => [
            hut.genFollowTemp(player),
            Law('followMatch', player.relWob(rel.matchPlayers), match => [
              hut.genFollowTemp(match),
              Law('followPlaymates', match.relWob(rel.matchPlayers), player => [
                hut.genFollowTemp(player)
              ]),
              Law('followPieces', match.relWob(rel.matchPieces), piece => [
                hut.genFollowTemp(piece)
              ])
            ])
          ])
        ])
      ]).open();
      
      // Matchmaking
      setInterval(() => {
        
        let matchmakePlayers = chess2
          .relVal(rel.chess2Players)
          .toArr(p => p.value && p.value.gameStatus === 'waiting' ? p : C.skip)
          .sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < matchmakePlayers.length - 1; i += 2) {
          let [ p1, p2 ] = matchmakePlayers.slice(i, i + 2);
          if (Math.random() > 0.5) [ p1, p2 ] = [ p2, p1 ];
          
          let [ hut1, hut2 ] = [ p1, p2 ].map(p => p.relVal(rel.playerHut));
          
          let match = Match({ lands });
          chess2.attach(rel.matches, match);
          match.attach(rel.matchPlayers, p1);
          match.attach(rel.matchPlayers, p2);
          
          p1.modify(v => v.gain({ gameStatus: 'playing', colour: 'white' }));
          p2.modify(v => v.gain({ gameStatus: 'playing', colour: 'black' }));
          
          // Set up pieces for each player
          [ p1, p2 ].forEach((player, ind) => {
            pieceDefs.standard[ind].forEach(([ type, x, y ]) => {
              let piece = Piece({ lands });
              piece.wobble({ type, colour: !ind ? 'white' : 'black', wait: 0, x, y });
              match.attach(rel.matchPieces, piece);
              player.attach(rel.piecePlayer, piece);
            });
          });
          
          // Mark the players as playing
          [ p1, p2 ].forEach(player => player.modify(v => v.gain({ gameStatus: 'playing' })));
          
          match.modify(v => v.gain({ movesDeadlineMs: foundation.getMs() + moveMs }));
          
          let forcePassTimeout = null;
          
          // Activate move timeouts when the round progresses (detected via match wobbles)
          match.hold(v => {
            clearTimeout(forcePassTimeout);
            
            if (!v || v.movesDeadlineMs === null) return;
            
            let timeRemaining = v.movesDeadlineMs - new Date();
            forcePassTimeout = setTimeout(() => {
              // Unsubmitted moves become passes
              p1.move.modify(v => v || { piece: null, tile: null });
              p2.move.modify(v => v || { piece: null, tile: null });
            }, timeRemaining);
          });
          
          // Resolve moves when both players have confirmed
          let holdMove = U.CalcWob({ wobs: [ p1.move, p2.move ], func: (p1Move, p2Move) => {
            
            if (!p1Move || !p2Move) return;
            
            let pieces = match.relVal(rel.matchPieces);
            
            // All pieces have waited a turn
            pieces.forEach(piece => piece.value.wait ? piece.modify(v => v.gain({ wait: v.wait - 1 })) : null);
            
            // Move both pieces
            [ p1Move, p2Move ].forEach(({ piece, tile }) => {
              if (!piece) return;
              piece.modify(v => v.gain({ x: tile[0], y: tile[1], wait: 1 }));
            });
            
            // Identify captured pieces...
            let [ p1Trgs, p2Trgs ] = [ p1Move, p2Move ].map(({ piece, tile }) => {
              if (!piece) return {};
              return pieces.map(p => (p !== piece && p.value.x === tile[0] && p.value.y === tile[1]) ? p : C.skip);
            });
            
            // And remove them
            p1Trgs.forEach(pc => lands.remRec(pc));
            p2Trgs.forEach(pc => lands.remRec(pc));
            
            // Check if either player has captured the others' king
            let p1CapturedKing = !!p1Trgs.find(piece => piece.value.type === 'king');
            let p2CapturedKing = !!p2Trgs.find(piece => piece.value.type === 'king');
            
            // If a king is captured figured out game result
            let addTime = moveMs;
            let concluded = p1CapturedKing || p2CapturedKing || (!p1Move.piece && !p2Move.piece);
            if (concluded) {
              addTime = null; // Don't add more time if the game is over!
              if (p1CapturedKing === p2CapturedKing) {
                p1.modify(v => v.gain({ gameStatus: 'stalemated' }));
                p2.modify(v => v.gain({ gameStatus: 'stalemated' }));
              } else if (p1CapturedKing) {
                p1.modify(v => v.gain({ gameStatus: 'victorious' }));
                p2.modify(v => v.gain({ gameStatus: 'defeated' }));
              } else if (p2CapturedKing) {
                p1.modify(v => v.gain({ gameStatus: 'defeated' }));
                p2.modify(v => v.gain({ gameStatus: 'victorious' }));
              }
            }
            
            // Reset moves
            p1.move.wobble(null);
            p2.move.wobble(null);
            
            match.relVal(rel.matchPieces).forEach(piece => {
              if (!piece.value || piece.value.type !== 'pawn') return;
              let { colour, y } = piece.value;
              if ((colour === 'white' && y === 7) || (colour === 'black' && y === 0))
                piece.modify(v => v.gain({ type: 'queen' }));
            });
            
            // Increment turns; set deadline for next move
            match.modify(v => v.gain({ turns: v.turns + 1, movesDeadlineMs: addTime ? foundation.getMs() + addTime : null }));
            
          }});
          
          // Clean up when no players remain
          match.relWob(rel.matchPlayers).hold(() => {
            let players = match.relVal(rel.matchPlayers);
            if (!players.isEmpty()) return;
            
            holdMove.drop(); // Stop listening for moves!
            
            // Remove all pieces, the board and the match
            match.relVal(rel.matchPieces).forEach(piece => lands.remRec(piece));
            lands.remRec(match);
          });
          
        }
        
      }, matchmakeMs);
      
      /// =ABOVE} {BELOW=
      
      let { Colour, Real } = real;
      
      let mySelectedPiece = U.Wobbly({ value: null });
      let myConfirmedPiece = U.Wobbly({ value: null });
      let myConfirmedTile = U.Wobbly({ value: null });
      let myConfirmedPass = U.Wobbly({ value: false });
      let myChess2 = U.Wobbly({ value: null });
      let myPlayer = U.Wobbly({ value: null });
      
      // Confirming tiles and passing each cancel the other
      myConfirmedPass.hold(isPassing => {
        if (isPassing) { myConfirmedPiece.wobble(null); myConfirmedTile.wobble(null); }
      });
      myConfirmedTile.hold(tile => {
        if (tile) myConfirmedPass.wobble(false);
      });
      
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
        
        // Show notifications based on our player's gameStatus
        let notifyReal = null;
        myPlayer.hold(player => {
          
          let f = v => {
            
            if (notifyReal) { scaleApp.remReal(notifyReal); notifyReal = null; }
            
            if (!v) return;
            let { gameStatus } = v;
            if (gameStatus === 'playing') return;
            
            let nv = notifyReal = scaleApp.addReal(Real({}));
            nv.setSize(1000, 1000);
            nv.setColour('rgba(0, 0, 0, 0.75)');
            nv.setPriority(2);
            nv.setOpacity(0);
            nv.setTransition('opacity', 500, 'sharp');
            nv.addWob.hold(() => nv.setOpacity(1));
            
            if (gameStatus === 'uninitialized') {
              
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
              
            } else if (gameStatus === 'waiting') {
              
              nv.setTextSize(50);
              nv.setText('Finding match...');
              
            } else {
              
              let [ text1, text2 ] = ({
                victorious: [ 'You WIN!',       'Win more!' ],
                defeated:   [ 'You LOSE!',      'Reclaim dignity' ],
                stalemated: [ 'It\'s a DRAW!',  'More chess!' ]
              })[gameStatus];
              
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
          
          player ? player.hold(f) : f({ gameStatus: 'uninitialized' });
          
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
        myPlayer.hold(p => p && p.hold(v => boardReal.setFeel(v && v.gameStatus === 'playing' ? 'smooth' : 'airy')));
        
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
              lands.tell({ command: 'confirmMove', piece: piece.uid, tile: [ x, y ] });
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
              lands.tell({ command: 'confirmMove', piece: null, tile: null });
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
        U.CalcWob({ wobs: [ rec, mySelectedPiece, myConfirmedPiece ], func: (v, sel, cnf) => {
          if (v && v.wait)      real.setBorder('outer', borderWidthSimple, colours.disabled);
          else if (sel === rec) real.setBorder('outer', borderWidthSimple, colours.selected);
          else if (cnf === rec) real.setBorder('outer', borderWidthBold, colours.confirmed);
          else                  real.setBorder('outer', borderWidthSimple, colours.clear);
        }});
        
        // The tangibility of this piece depends on colour and whether it's waiting
        U.CalcWob({ wobs: [ myPlayer, rec ], func: (pl, pcVal) => {
          if (!pl || !pcVal) return;
          pl.hold(plVal => {
            real.setFeel(pcVal && pcVal.wait === 0 && plVal.colour === pcVal.colour ? 'bumpy' : 'airy');
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
