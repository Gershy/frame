U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp' ],
  build: (foundation, record, hinterlands, real, realWebApp) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Lands } = hinterlands;
    let { FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, TextSized } = real;
    let { UnitPx, UnitPc } = real;
    let { WebApp } = realWebApp;
    
    // Config values
    let moveMs = 50 * 1000;
    let matchmakeMs = ({ test: 1 * 1000, prod: 8 * 1000 })[foundation.raiseArgs.mode];
    let pieceDefs = {
      minimal: {
        white: [ [ 'queen', 3, 3 ], [ 'king', 4, 3 ] ],
        black: [ [ 'queen', 4, 4 ], [ 'king', 3, 4 ] ]
      },
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
    let pieceTypes = Set();
    pieceDefs.forEach(mode => mode.forEach(pl => pl.forEach(([ type ]) => pieceTypes.add(type))));
    
    let savedItems  = {};
    for (let pieceType of pieceTypes) { for (let colour of [ 'white', 'black' ]) {
      let key = `chess2Piece.${colour}.${pieceType}`;
      let locator = null;
      /// {ABOVE=
      locator = [ 'room', 'chess2', 'img', 'classicPieces', `${colour}-${pieceType}.png` ];
      /// =ABOVE} {BELOW=
      locator = key;
      /// =BELOW}
      savedItems[key] = foundation.getSaved(locator);
    }}
    
    let open = async () => {
        
      let c2Hut = await foundation.getRootHut({ heartMs: 1000 * 40 });
      c2Hut.roadDbgEnabled = true;
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('c2', (real, insert, decals) => {
        
        /*
        real('name');
        real('name', null);
        real('name', {});
        real('name', { main: null });
        real('name', { main: SlotterCls });
        real('name', { main: SlotterCls1, secondary: SlotterCls2 });
        real('name', { main: () => SlotterCls1({ ... }), secondary: () => SlotterCls2({ ... }) });
        real('name', SlotterCls1);                // Default mode will be "main"
        real('name', () => SlotterCls1({ ... })); // Default mode will be "main"
        real('name', null, []);
        real('name', null, [ Layout1, Layout2, ... ]);
        real('name', SlotterCls1, [ Layout1, Layout2, ... ]);
        real('name', { main: SlotterCls1, secondary: SlotterCls2 }, [ Layout1, Layout2, ... ]);
        real('name', { main: SlotterCls1, secondary: SlotterCls2 }, [ () => Layout1({ ... }) ]);
        real('name', { main: SlotterCls1, secondary: SlotterCls2 }, [ () => Layout1({ ... }), () => Layout2({ ... }) ]);
        
        insert('name1 -> name2'); // SlotFns will be { main: null }
        insert('name1 -> name2', null);
        insert('name1 -> name2', {});
        insert('name1 -> name2', { Layout });
        insert('name1 -> name2', { main: Layout1, secondary: Layout2 });
        insert('name1 -> name2', { main: () => Layout1({ ... }), secondary: Layout2 });
        insert('name1 -> name2', { main: sl => sl.getSlotType1({ ... }), secondary: sl => sl.getSlotType2({ ... }) });
        
        decals('name', { colour: '#000000', textColour: '#ffffff' });
        */
        
        real('root', MinExtSlotter);
        insert('* -> root', FillParent);
        insert('root -> main', sl => sl.getMinExtSlot());
        
        // Logged Out
        real('loggedOut', CenteredSlotter);
        real('welcomePane', () => LinearSlotter({ axis: 'y', dir: '+' }));
        real('welcomePaneTitle', null, TextSized({ size: UnitPx(24), pad: UnitPx(10) }));
        real('welcomePaneBody', null, TextSized({ size: UnitPx(14), pad: UnitPx(3) }));
        insert('main -> loggedOut', () => FillParent({ shrink: UnitPc(0.2) }));
        insert('loggedOut -> welcomePane', sl => sl.getCenteredSlot());
        insert('welcomePane -> welcomePaneTitle', sl => sl.getLinearSlot());
        insert('welcomePane -> welcomePaneBody', sl => sl.getLinearSlot());
        
        // Logged In
        real('loggedIn', CenteredSlotter, FillParent());
        real('lobby', null, TextSized({ size: UnitPx(12), pad: UnitPx(16) }));
        real('game', () => LinearSlotter({ axis: 'y', dir: '+' })); // Insert [ p1, board, p2 ]
        real('player', CenteredSlotter);
        real('playerContent', () => LinearSlotter({ axis: 'x', dir: '+' }));
        real('playerContentName', () => TextSized({ size: UnitPx(14), padH: UnitPx(6) }));
        real('playerContentTimer', () => TextSized({ size: UnitPx(14) }));
        real('conclusion', CenteredSlotter);
        real('conclusionContent', () => TextSized({ size: UnitPx(30) }));
        insert('main -> loggedIn', FillParent);
        insert('loggedIn -> lobby', sl => sl.getCenteredSlot()); // TODO: Should the slotting functions each be able to return multiple layouts???
        insert('loggedIn -> game', FillParent);
        insert('game -> player', sl => [ sl.getLinearSlot(), FillParent({ x: 1, y: 0.1}) ]); // "player" inside "game" takes up 10% (two take up 20%)
        insert('game -> board', sl => [ sl.getLinearSlot(), FillParent({ x: 0.8, y: 0.8 }) ]);
        insert('player -> playerContent', sl => sl.getCenteredSlot());
        insert('playerContent -> playerContentName', sl => sl.getLinearSlot());
        insert('playerContent -> playerContentTimer', sl => sl.getLinearSlot());
        insert('board -> tileWhite');
        insert('board -> tileBlack');
        insert('board -> piece');
        insert('piece -> indicator');
        insert('board -> showMovePiece');
        insert('board -> showMoveTile');
        insert('game -> conclusion', FillParent);
        insert('conclusion -> conclusionContent', sl => sl.getCenteredSlot());
        
        // Decals
        decals('root', { colour: 'rgba(100, 100, 150, 1)', textColour: '#ffffff' });
        decals('loggedOut', { colour: 'rgba(120, 120, 170, 1)' });
        decals('lobby', { colour: 'rgba(100, 100, 150, 1)' });
        decals('game', { colour: 'rgba(100, 100, 150, 1)', contentMode: 'window' });
        decals('board', { colour: 'transparent' });
        decals('tileWhite', { colour: '#9a9abb', border: { ext: UnitPx(1), colour: '#c0c0d8' } });
        decals('tileBlack', { colour: '#8989af', border: { ext: UnitPx(1), colour: '#c0c0d8' } });
        decals('conclusion', { colour: 'rgba(0, 0, 0, 0.5)' });
        
      });
      
      /* // TODO: Above "layoutDef" function should have these results:
      // Root layout
      rootReal.defineReal('c2.c2', { slotters: MinExtSlotter, decals: {
        colour: 'rgba(100, 100, 150, 1)'
      }});
      rootReal.defineReal('c2.main', {});
      rootReal.defineInsert(null, 'c2.c2', () => FillParent());
      rootReal.defineInsert('c2.c2', 'c2.main', slotter => slotter.getMinExtSlot());
      
      // Logged out
      rootReal.defineReal('c2.loggedOut', { slotters: CenteredSlotter, decals: {
        colour: 'rgba(120, 120, 170, 1)'
      }});
      rootReal.defineReal('c2.welcomePane', { slotters: () => LinearSlotter({ axis: 'y', dir: '+' }) });
      rootReal.defineReal('c2.welcomePaneTitle', {
        layouts: [ ShowText({ pad: UnitPx(10), size: UnitPx(24) }) ],
        decals: { textColour: 'rgba(255, 255, 255, 1)' }
      });
      rootReal.defineReal('c2.welcomePaneBody', {
        layouts: [ ShowText({ pad: UnitPx(3), size: UnitPx(14) }) ],
        decals: { textColour: 'rgba(255, 255, 255, 1)' }
      });
      rootReal.defineInsert('c2.main', 'c2.loggedOut', () => FillParent({ shrink: UnitPc(0.2) }));
      rootReal.defineInsert('c2.loggedOut', 'c2.welcomePane', slotter => slotter.getCenteredSlot());
      rootReal.defineInsert('c2.welcomePane', 'c2.welcomePaneTitle', { slotter => slotter.getLinearSlot() });
      rootReal.defineInsert('c2.welcomePane', 'c2.welcomePaneBody', { slotter => slotter.getLinearSlot() });
      
      rootReal.defineReal('c2.loggedIn', { slotters: CenteredSlot(), decals: {
        colour: 'rgba(120, 120, 170, 1)'
      }});*/
      
      /*
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
          size: ShowText({ pad: UnitPx(10) }),
          decals: { textSize: UnitPx(24), textColour: 'rgba(255, 255, 255, 1)' }
        },
        'main.out.content.text': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ pad: UnitPx(3) }),
          decals: { textSize: UnitPx(12), textColour: 'rgba(255, 255, 255, 1)' }
        },
        'main.in': {
          size: FillParent(),
          decals: { colour: 'rgba(120, 120, 170, 1)' },
          slots: CenteredSlot() // Regarding Real "Insertions" (Relations) - note that we want CenteredSlot when inserting "lobby", but FillParent when inserting "game"
        },
        'main.in.lobby': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          size: ShowText({ pad: UnitPx(15) }),
          decals: { colour: 'rgba(100, 100, 150, 1)', textColour: 'rgba(255, 255, 255, 1)', textSize: UnitPx(12) }
        },
        'main.in.game': {
          size: FillParent(),
          decals: {
            contentMode: 'window',
            colour: 'rgba(100, 100, 150, 1)'
          }
        },
        'main.in.game.player': {
          slots: CenteredSlot()
        },
        'main.in.game.player.content': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          slots: LinearSlots({ axis: 'x', dir: '+' }),
          decals: {
            textSize: UnitPx(14),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.in.game.player.content.name': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ padH: UnitPx(6) })
        },
        'main.in.game.player.content.timer': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc' })
        },
        'main.in.game.board': { decals: { colour: 'rgba(255, 255, 255, 0)' } },
        'main.in.game.board.tileWhite': {
          decals: {
            colour: 'rgba(154, 154, 187, 1)',
            border: { ext: UnitPx(1), colour: '#c0c0d8' }
          }
        },
        'main.in.game.board.tileBlack': {
          decals: {
            colour: 'rgba(137, 137, 175, 1)',
            border: { ext: UnitPx(1), colour: '#c0c0d8' }
          }
        },
        'main.in.game.board.piece': { decals: {} },
        'main.in.game.board.move': { decals: {} },
        'main.in.game.board.move.indicator': { decals: {} },
        'main.in.game.board.showMovePiece': { decals: {} },
        'main.in.game.board.showMoveTile': { decals: {} },
        'main.in.game.conclusion': {
          size: FillParent(),
          slots: CenteredSlot(),
          decals: {
            colour: 'rgba(0, 0, 0, 0.5)'
          }
        },
        'main.in.game.conclusion.content': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          size: ShowText({ origin: 'cc' }),
          decals: {
            textSize: UnitPx(30),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        }
      };
      */
      
      let webApp = WebApp('c2');
      await webApp.decorateHut(c2Hut, rootReal);
      
      let validMoves = (matchPlayer, match, piece) => {
        
        if (piece.val.wait > 0) return [];
        if (matchPlayer.val.colour !== piece.val.colour) return [];
        
        // Get other pieces
        let pieces = match.relRecs('chess2.matchPiece').toArr(matchPiece => matchPiece.mem('piece'));
        
        // Make a nice 2d representation of the board
        let calc = Array.fill(8, () => Array.fill(8, () => null));
        pieces.forEach(piece => calc[piece.val.col][piece.val.row] = piece);
        
        // Utility func for checking tiles (OOB=out-of-bounds, null=empty-tile, otherwise a Piece)
        let checkTile = (col, row) => (col < 0 || col > 7 || row < 0 || row > 7) ? 'OOB' : calc[col][row];
        
        let { type, colour, col, row } = piece.val;
        
        let moves = [];
        
        if (type === 'pawn') {
          
          let dir = colour === 'white' ? 1 : -1;
          let initRow = colour === 'white' ? 1 : 6;
          
          if (!checkTile(col, row + dir)) {
            moves.push([ col, row + dir, null ]); // Add first step if unblocked
            if (row === initRow && !checkTile(col, row + dir + dir)) {
              moves.push([ col, row + dir + dir, null ]); // Add second step if unblocked and unmoved
            }
          }
          
          // Check for captures in both directions
          let cap1 = checkTile(col - 1, row + dir);
          if (cap1 && cap1 !== 'OOB' && cap1.val.colour !== colour) moves.push([ col - 1, row + dir, cap1 ]);
          
          let cap2 = checkTile(col + 1, row + dir);
          if (cap2 && cap2 !== 'OOB' && cap2.val.colour !== colour) moves.push([ col + 1, row + dir, cap2 ]);
          
        } else if (type === 'knight') {
          
          let offsets = [
            [ -2, -1 ], [ -2, 1 ], [ -1, 2 ], [ 1, 2 ], [ 2, 1 ], [ 2, -1 ], [ 1, -2 ], [ -1, -2 ]
          ];
          offsets.forEach(([ dx, dy ]) => {
            let [ c, r ] = [ col + dx, row + dy ];
            let check = checkTile(c, r);
            if (!check || (check !== 'OOB' && check.val.colour !== colour)) moves.push([ c, r, check ]);
          });
          
        } else if ([ 'bishop', 'rook', 'queen', 'king' ].has(type)) {
          
          let diag = [ [ -1, -1 ], [ -1, +1 ], [ +1, +1 ], [ +1, -1 ] ];
          let orth = [ [ -1, 00 ], [ 00, +1 ], [ +1, 00 ], [ 00, -1 ] ];
          let steps = [ 'queen', 'king' ].has(type) ? [].gain(diag).gain(orth) : (type === 'bishop' ? diag : orth);
          
          steps.forEach(([dx, dy]) => {
            
            let xx = col, yy = row;
            while (true) {
              [ xx, yy ] = [ xx + dx, yy + dy ];
              
              let check = checkTile(xx, yy);
              
              // Stepping terminates at edge of board
              if (check === 'OOB') break;
              
              // Empty tiles and tiles with enemy pieces are valid
              if (!check || check.val.colour !== colour) moves.push([ xx, yy, check ]);
              
              // Finding a piece terminates stepping; kings always terminate after first step
              if (check || type === 'king') break;
            }
            
          });
          
        } else {
          
          throw Error(`Invalid type: ${type}`);
          
        }
        
        return moves;
        
      };
      let applyMoves = (match, ...playerMoves) => {
        
        // Get all match pieces...
        let matchPieceSet = match.relRecs('chess2.matchPiece');
        let pieces = matchPieceSet.toArr(matchPiece => matchPiece.mem('piece'));
        
        // All pieces refresh by 1 turn
        for (let piece of pieces) if (piece.val.wait) piece.modVal(v => (v.wait--, v));
        
        // Update piece positions
        playerMoves.forEach(({ type, pieceUid, tile }) => {
          if (type === 'pass') return;
          let piece = pieces.find(p => p.uid === pieceUid)[0];
          piece.modVal(v => v.gain({ col: tile[0], row: tile[1], wait: 1 }))
        });
        
        // Look for promotions
        pieces.forEach(piece => {
          let { type, colour, row } = piece.val;
          let lastRow = (colour === 'white') ? 7 : 0;
          if (type === 'pawn' && row === lastRow) piece.modVal(v => v.gain({ type: 'queen' }));
        });
        
        // Determine captured pieces
        let trgSets = playerMoves.map(({ type, pieceUid, tile }) => {
          if (type === 'pass') return [];
          return pieces.map(p => (p.uid !== pieceUid && p.val.col === tile[0] && p.val.row === tile[1]) ? p : C.skip);
        });
        
        // Remove captured pieces
        for (let trgSet of trgSets) for (let piece of trgSet) piece.dry();
        
        // Return the Players who are still alive. If both Players pass,
        // both die. If a Player submitted a move, the living Players are
        // the ones which still possess a king at the end of the Round.
        return playerMoves.find(({ type}) => type !== 'pass')
          ? Set(matchPieceSet.toArr(p => { let v = p.mem('piece').val; return v.type === 'king' ? v.colour : C.skip; }))
          : Set();
        
      }
      
      /// {ABOVE=
      let chess2 = c2Hut.createRec('c2.chess2', [ c2Hut ]);
      /// =ABOVE}
      
      let rootScp = RecScope(c2Hut, 'c2.chess2', async (chess2, dep) => {
        
        global.chess2 = chess2;
        dep(Drop(null, () => { delete global.chess2; }));
        
        /// {ABOVE=
        
        // Serve files (TODO: to be PICKY, could deny Huts without Matches)
        for (let pieceType of pieceTypes) { for (let colour of [ 'white', 'black' ]) {
          let key = `chess2Piece.${colour}.${pieceType}`;
          c2Hut.roadNozz(key).route(({ reply }) => reply(savedItems[key]));
        }}
        
        dep.scp(c2Hut, 'lands.kidHut/par', ({ members: { kid: hut } }, dep) => { // Note we already have reference to `hut`!
          
          let hutPlayerNozz = hut.relNozz('c2.hutPlayer');
          
          // Follows
          dep(hut.followRec(chess2));
          dep.scp(hut, 'chess2.hutPlayer', (hutPlayer, dep) => {
            
            // Careful not to Follow the HutPlayer!
            let player = hutPlayer.mem('player');
            dep.scp(player, 'chess2.chess2Player', (chess2Player, dep) => {
              
              // Follow the Player through the Chess2Player!
              dep(hut.follow(chess2Player));
              
              dep.scp(player, 'chess2.matchPlayer', (matchPlayer, dep) => {
                
                dep(hut.follow(matchPlayer)); // Follow Match
                
                // Follow Players, Pieces, Round, Conclusion of Match
                let match = matchPlayer.mem('match');
                dep.scp(match, 'chess2.matchConclusion',  (r, dep) => dep(hut.follow(r)));
                dep.scp(match, 'chess2.matchRound',       (r, dep) => dep(hut.follow(r)));
                dep.scp(match, 'chess2.matchPlayer',      (r, dep) => dep(hut.follow(r)));
                dep.scp(match, 'chess2.matchPiece',       (r, dep) => dep(hut.follow(r)));
                
              });
              
            });
            
          });
          
          // Actions for Huts (differentiate between logged-in and logged-out)
          let hutPlayerDryNozz = dep(TubDry(null, hutPlayerNozz));
          dep.scp(hutPlayerDryNozz, (_, dep) => {
            dep(hut.roadNozz('login').route(() => {
              // TODO: `chess2Player` should receive `hutPlayer`, not
              // `player`, as its second member (this would establish an
              // implicit dependency between the Hut and the Player)
              let player =        lands.createRec('chess2.player', [], { term: hut.getTerm() });
              let hutPlayer =     lands.createRec('chess2.hutPlayer', [ hut, player ]);
              let chess2Player =  lands.createRec('chess2.chess2Player', [ chess2, player ]);
              
              hut.drierNozz().route(() => player.dry());
            }));
          });
          dep.scp(hutPlayerNozz, (hutPlayer, dep) => {
            
            // Huts with Players can logout
            dep(hut.roadNozz('logout').route(({ user, pass }) => hutPlayer.dry()));
            
            // Huts with Players in Matches can leave their Match
            let player = hutPlayer.mem('player');
            dep.scp(player, 'chess2.matchPlayer', (matchPlayer, dep) => {
              dep(hut.roadNozz('exitMatch').route(() => matchPlayer.dry()));
            });
            
          });
          
          dep.scp(hutPlayerNozz, (hutPlayer, dep) => {
            
            // Allow moves while there is a RoundPlayer
            let player = hutPlayer.mem('player');
            
            dep.scp(player, 'chess2.matchPlayer', (matchPlayer, dep) => {
              
              dep.scp(matchPlayer, 'chess2.roundPlayer', (roundPlayer, dep) => {
                
                let round = roundPlayer.mem('round');
                
                dep(hut.roadNozz('doMove').route(({ msg }) => {
                  
                  // Clear current move
                  roundPlayer.relNozz('chess2.roundPlayerMove').dryContents();
                  
                  // Perform updated move:
                  let { type, pieceUid, tile } = msg;
                  if (type === 'retract') return; // "retract" means no move yet
                  
                  let move = lands.createRec('chess2.move', [], { type, pieceUid, tile });
                  lands.createRec('chess2.roundPlayerMove', [ roundPlayer, move ]);
                  
                }));
                
              });
              
            });
            
          });
          
        });
        
        // Gameplay
        dep.scp(chess2, 'chess2.chess2Match', (chess2Match, dep) => {
          
          let match = chess2Match.mem('match');
          let matchPlayerNozz = match.relNozz('chess2.matchPlayer');
          let matchPlayerCntNozz = dep(TubCnt(null, matchPlayerNozz));
          let matchPlayerDryNozz = dep(TubDry(null, matchPlayerNozz));
          
          let matchRoundNozz = match.relNozz('chess2.matchRound');
          let noMatchRoundNozz = dep(TubDry(null, matchRoundNozz));
          
          dep.scp(matchRoundNozz, (matchRound, dep) => {
            
            let round = matchRound.mem('round');
            
            dep(matchPlayerCntNozz.route(playerCnt => {
              
              if (playerCnt === 2) return;
              
              round.dry();
              let mp = match.relRec('chess2.matchPlayer');
              let conclusion = lands.createRec('chess2.conclusion', [], mp ? mp.val.colour : 'stalemate');
              let matchConclusion = lands.createRec('chess2.matchConclusion', [ match, conclusion ]);
              
            }));
            
            // Simplify tracking all RoundPlayerMoves; we'll use
            // `roundPlayerMoves` to always hold the most recent set of
            // moves, and `roundPlayerMoveNozz` to drip any changes
            let roundPlayerMoves = Set();
            let roundPlayerMoveNozz = Nozz();
            roundPlayerMoveNozz.newRoute = routeFn => routeFn(roundPlayerMoves);
            dep.scp(round, 'chess2.roundPlayer', (roundPlayer, dep) => {
              
              dep.scp(roundPlayer, 'chess2.roundPlayerMove', (roundPlayerMove, dep) => {
                
                roundPlayerMoves.add(roundPlayerMove);
                roundPlayerMoveNozz.drip(roundPlayerMoves);
                dep(Drop(null, () => {
                  roundPlayerMoves.rem(roundPlayerMove);
                  roundPlayerMoveNozz.drip(roundPlayerMoves);
                }));
                
              });
              
            });
            
            let allMovesNozz = dep(TubVal(null, roundPlayerMoveNozz, rpms => (rpms.size === 2) ? 'allMoves' : C.skip));
            let timeoutNozz = Nozz();
            let roundTimeout = setTimeout(() => timeoutNozz.drip('timeout'), moveMs);
            dep(Drop(null, () => clearTimeout(roundTimeout)));
            let roundDoneNozz = dep(Funnel(allMovesNozz, timeoutNozz));
            
            dep(roundDoneNozz.route(reason => {
              
              let aliveCols = applyMoves(match, ...roundPlayerMoves.toArr(rpm => rpm.mem('move').val));
              
              // End Round
              round.dry();
              
              if (aliveCols.size === 2) {
                
                // Begin new Round
                let nextRound = lands.createRec('chess2.round', [], { endMs: foundation.getMs() + moveMs });
                for (let matchPlayer of match.relRecs('chess2.matchPlayer'))
                  lands.createRec('chess2.roundPlayer', [ nextRound, matchPlayer ]);
                lands.createRec('chess2.matchRound', [ match, nextRound ]);
                
              } else {
                
                let [ val='stalemate' ] = aliveCols.toArr(v => v);
                let conclusion = lands.createRec('chess2.conclusion', [], val);
                lands.createRec('chess2.matchConclusion', [ match, conclusion ]);
                
              }
              
            }));
            
          });
          
          // TODO: Really the condition for a Match to end is "The Match
          // now has zero players, AND it once had non-zero Players"
          // The Match ends when no Players remain
          dep(matchPlayerDryNozz.route(() => match.dry()));
          
        });
        
        // Intermittently enter Players into Matches
        let interval = setInterval(() => {
          
          let waitingPlayers = chess2.relNozz('chess2.chess2Player').set.toArr(v => {
            let player = v.mem('player');
            return player.relRec('chess2.matchPlayer') ? C.skip : player;
          });
          
          for (let i = 0; i < waitingPlayers.length - 1; i += 2) {
            
            // For each pair of Players create a Match, assign the Players to
            // that Match, and then create Pieces and assign each Piece to the
            // Match and its appropriate Player.
            
            let match = lands.createRec('chess2.match');
            
            let playerPieceSets = [
              { colour: 'white', player: waitingPlayers[i + 0], pieces: pieceDefs.standard.white },
              { colour: 'black', player: waitingPlayers[i + 1], pieces: pieceDefs.standard.black }
            ];
            
            console.log('Matching:', playerPieceSets.map(({ player }) => player.val.term));
            
            for (let { colour, player, pieces } of playerPieceSets) {
              let matchPlayer = lands.createRec('chess2.matchPlayer', [ match, player ], { colour });
              matchPlayer.desc = `For Player ${player.val.term}`;
              for (let [ type, col, row ] of pieces) {
                let piece = lands.createRec('chess2.piece', [], { colour, type, col, row, wait: 0 });
                let matchPiece = lands.createRec('chess2.matchPiece', [ match, piece ]);
              }
            }
            
            let chess2Match = lands.createRec('chess2.chess2Match', [ chess2, match ]);
            let initialRound = lands.createRec('chess2.round', [], { endMs: foundation.getMs() + moveMs });
            for (let matchPlayer of match.relRecs('chess2.matchPlayer'))
              lands.createRec('chess2.roundPlayer', [ initialRound, matchPlayer ]);
            let matchRound = lands.createRec('chess2.matchRound', [ match, initialRound ]);
            
          }
          
        }, matchmakeMs);
        dep(Drop(null, () => clearInterval(interval)));
        
        /// =ABOVE} {BELOW=
        
        let c2RootReal = dep(rootReal.techReals[0].addReal('c2.root'));
        let mainReal = c2RootReal.addReal('c2.main');
        
        let myPlayerNozz = dep(TubVal(null, chess2.relNozz('chess2.chess2Player'), chess2Player => {
          let player = chess2Player.mem('player');
          return (player.val.term === U.hutTerm) ? player : C.skip;
        }));
        let myPlayerDryNozz = dep(TubDry(null, myPlayerNozz));
        
        dep.scp(myPlayerDryNozz, (_, dep) => {
          
          let outReal = dep(mainReal.addReal('c2.loggedOut'));
          let contentReal = outReal.addReal('c2.welcomePane');
          let titleReal = contentReal.addReal('c2.welcomePaneTitle');
          let textReal = contentReal.addReal('c2.welcomePaneBody');
          
          console.log('TITLE REAL:', titleReal);
          
          titleReal.setText('Chess2');
          textReal.setText('Click to start playing!');
          
          //dep(outReal.feelNozz().route(() => lands.tell({ command: 'login' })));
          
        });
        dep.scp(myPlayerNozz, (player, dep) => {
          
          let inReal = dep(mainReal.addReal('in'));
          
          let myMatchPlayerNozz = player.relNozz('chess2.matchPlayer');
          let myMatchPlayerDryNozz = dep(TubDry(null, myMatchPlayerNozz));
          
          dep.scp(myMatchPlayerDryNozz, (_, dep) => {
            
            let lobbyReal = dep(inReal.addReal('lobby'));
            lobbyReal.setText('Waiting for match...');
            
          });
          dep.scp(myMatchPlayerNozz, (myMatchPlayer, dep) => {
            
            let match = myMatchPlayer.mem('match');
            let myColour = myMatchPlayer.val.colour;
            
            let gameReal = dep(inReal.addReal('game'));
            
            // Show Player names
            dep.scp(match, 'chess2.matchPlayer', (matchPlayer, dep) => {
              
              let player = matchPlayer.mem('player');
              let colour = matchPlayer.val.colour;
              
              let playerReal = dep(gameReal.addReal('player'));
              let playerContentReal = playerReal.addReal('content');
              let playerNameReal = playerContentReal.addReal('name');
              playerNameReal.setText(player.val.term);
              
              playerReal.setLayout(...((colour === 'white')
                ? [ UnitPc(1), UnitPc(0.1), UnitPc(0.5), UnitPc(0.05) ]
                : [ UnitPc(1), UnitPc(0.1), UnitPc(0.5), UnitPc(0.95) ]
              ));
              
              dep(myMatchPlayer.route(val => playerReal.setRotate((val.colour === 'white') ? 0.5 : 0)));
              
              if (myMatchPlayer !== matchPlayer) return; // Stop here if this isn't our player
              
              dep.scp(match, 'chess2.matchRound', (matchRound, dep) => {
                let round = matchRound.mem('round');
                let playerTimerReal = dep(playerContentReal.addReal('timer'));
                let updTimer = () => {
                  let ms = round.val.endMs - foundation.getMs();
                  let secs = Math.floor(ms / 1000);
                  playerTimerReal.setText(`(${Math.max(0, secs)})`);
                };
                let interval = setInterval(updTimer, 500); updTimer();
                dep(Drop(null, () => clearInterval(interval)));
              });
              
            });
            
            let tileExt = (amt=1) => UnitPc(amt / 8);
            let tileLoc = v => UnitPc((0.5 + v) / 8);
            
            let t = 1 / 8;
            let p = t * 0.95;
            let boardReal = gameReal.addReal('board');
            boardReal.setLayout(UnitPc(0.8), UnitPc(0.8), UnitPc(0.5), UnitPc(0.5));
            
            // Show board tiles
            for (let col = 0; col < 8; col++) { for (let row = 0; row < 8; row++) {
              let tile = boardReal.addReal(((col % 2) === (row % 2)) ? 'tileBlack' : 'tileWhite');
              tile.setLayout(tileExt(), tileExt(), tileLoc(col), tileLoc(row));
            }}
            
            let selectedPieceNozz = dep(TubVal(null, Nozz()));
            let selectedPieceDryNozz = dep(TubDry(null, selectedPieceNozz));
            let confirmedMoveNozz = dep(TubVal(null, Nozz()));
            let noConfirmedMoveNozz = dep(TubVal(null, Nozz()));
            
            dep.scp(match, 'chess2.matchPiece', (matchPiece, dep) => {
              
              let piece = matchPiece.mem('piece');
              let pieceReal = dep(boardReal.addReal('piece'));
              pieceReal.setTransition([ 'x', 'y' ], 300, 'smooth');
              pieceReal.setTransition([ 'scale', 'opacity' ], 300, 'steady', 300);
              pieceReal.setDeathTransition(600, real => { real.setOpacity(0); real.setScale(8); });
              dep(piece.route(({ colour, type, col, row, wait }) => {
                
                // Reset selected and confirmed pieces when any piece updates
                selectedPieceNozz.dryContents();
                confirmedMoveNozz.dryContents();
                
                pieceReal.setRoundness(1);
                pieceReal.setLayout(tileExt(0.95), tileExt(0.95), tileLoc(col), tileLoc(row));
                pieceReal.setImage(savedItems[`chess2Piece.${colour}.${type}`]);
                
                pieceReal.setColour((wait > 0) ? 'rgba(255, 120, 50, 0.55)' : null);
                
              }));
              
              dep(pieceReal.feelNozz().route(() => {
                // Unselect previously selected piece (feeling the
                // selected piece results in only an unselect)
                let selPiece = selectedPieceNozz.val;
                selectedPieceNozz.dryContents();
                if (selPiece.piece === piece) return;
                
                // Select new piece
                selPiece = Drop(defDrier(Funnel(piece.drierNozz())));
                selPiece.piece = piece;
                selectedPieceNozz.nozz.drip(selPiece);
              }));
              
              dep(myMatchPlayer.route(val => pieceReal.setRotate((val.colour === 'white') ? 0.5 : 0)));
              
            });
            
            dep.scp(selectedPieceNozz, ({ piece }, dep) => {
              
              confirmedMoveNozz.dryContents();
              lands.tell({ command: 'doMove', type: 'retract' });
              
              validMoves(myMatchPlayer, match, piece).forEach(([ col, row, cap ]) => {
                
                let moveReal = dep(boardReal.addReal('move'));
                moveReal.setLayout(tileExt(), tileExt(), tileLoc(col), tileLoc(row));
                
                let indReal = moveReal.addReal('indicator');
                let colour = (piece.val.colour === 'white') ? '#e4e4f0' : '#191944';
                indReal.setLayout(UnitPc(cap ? 0.9 : 0.3), UnitPc(cap ? 0.9 : 0.3), UnitPc(0.5), UnitPc(0.5));
                indReal.setRoundness(1);
                
                if (cap)  indReal.setBorder(UnitPx(5), colour);
                else      indReal.setColour(colour);
                
                dep(moveReal.feelNozz().route(() => {
                  lands.tell({ command: 'doMove', type: 'piece', pieceUid: piece.uid, tile: [ col, row ] });
                  selectedPieceNozz.dryContents();
                  
                  let cmDrop = Drop(defDrier());
                  cmDrop.confirmedMove = { piece, tile: [ col, row ], cap };
                  confirmedMoveNozz.nozz.drip(cmDrop);
                }));
                
              });
              
            });
            
            dep.scp(confirmedMoveNozz, ({ confirmedMove }, dep) => {
              
              
              let { piece, tile, cap } = confirmedMove;
              let colour = '#40df15';
              
              let showPieceReal = dep(boardReal.addReal('showMovePiece'));
              showPieceReal.setRoundness(1);
              showPieceReal.setLayout(tileExt(0.9), tileExt(0.9), tileLoc(piece.val.col), tileLoc(piece.val.row));
              showPieceReal.setBorder(UnitPx(5), colour);
              
              let showTileReal = dep(boardReal.addReal('showMoveTile'));
              showTileReal.setRoundness(1);
              if (cap) {
                showTileReal.setLayout(tileExt(0.9), tileExt(0.9), tileLoc(tile[0]), tileLoc(tile[1]));
                showTileReal.setBorder(UnitPx(5), colour);
              } else {
                showTileReal.setLayout(tileExt(0.3), tileExt(0.3), tileLoc(tile[0]), tileLoc(tile[1]));
                showTileReal.setColour(colour);
              }
              
            });
            
            dep(myMatchPlayer.route(val => gameReal.setRotate((val.colour === 'white') ? 0.5 : 0)));
            
            dep.scp(match, 'chess2.matchConclusion', (matchConclusion, dep) => {
              
              let conclusion = matchConclusion.mem('conclusion');
              let result = conclusion.val;
              
              let conclusionReal = dep(gameReal.addReal('conclusion'));
              let conclusionContentReal = conclusionReal.addReal('content');
              
              let type = (result !== 'stalemate')
                ? ((result === myMatchPlayer.val.colour) ? 'winner' : 'loser')
                : 'stalemate';
              
              conclusionContentReal.setText(({
                winner: 'You WIN!',
                loser: 'You LOSE!',
                stalemate: 'Tie game!'
              })[type]);
              
              dep(myMatchPlayer.route(val => conclusionReal.setRotate((val.colour === 'white') ? 0.5 : 0)));
              
              dep(conclusionReal.feelNozz().route(() => lands.tell({ command: 'exitMatch' })));
                
            });
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
