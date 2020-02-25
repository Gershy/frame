U.buildRoom({
  
  // TODO: Would be nice to include the 'term' room so that Above could
  // grant a nice friendly term to each Hut (or more appropriately,
  // Player), but then the big long list of hut terms would be need to
  // be included Below as well, causing bloat! No good way to have such
  // data appear on Above, only - the current method would be to mark
  // the undesired sections of term.js with {ABO/VE= =ABO/VE}, but this
  // would be a semantic Error: the undesired section isn't necessarily
  // for Above, only in this one case...
  // I think the best way to do this is to list "innerRooms" twice, once
  // for Above, and once for Below. This will, however, require some
  // changes to FoundationNodejs, which currently parses "innerRooms"
  // *before* compiling each room (I think!). FoundationNodejs could
  // find itself in an ambiguous situation if two "innerRooms"
  // declarations exist in the plaintext of the file.
  
  // TODO: Why bother with "innerRooms" in the first place? Why not just
  // parse the parameters of the "build" property's function? (This
  // would require implementations to always name a parameter precisely
  // after the room it corresponds to.)
  
  name: 'chess2',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term' ],
  build: (foundation, record, hinterlands, real, realWebApp, term) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    let { FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, TextSized } = real;
    let { UnitPx, UnitPc } = real;
    let { WebApp } = realWebApp;
    
    // Config values
    let moveMs = 50 * 1000;
    let matchmakeMs = ({ test: (1/2) * 1000, prod: 8 * 1000 })[foundation.origArgs.mode];
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
          [ 'queen',    4, 0 ],
          [ 'king',     3, 0 ],
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
          [ 'queen',    4, 7 ],
          [ 'king',     3, 7 ],
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
      castlingTest: {
        white: [
          [ 'rook',     0, 0 ],
          [ 'king',     3, 0 ],
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
          [ 'king',     3, 7 ],
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
    
    let chess2Keeps  = {};
    for (let pieceType of pieceTypes) { for (let colour of [ 'white', 'black' ]) {
      let key = `chess2Piece.${colour}.${pieceType}`;
      let keep = null;
      /// {ABOVE=
      keep = foundation.getKeep('fileSystem', [ 'room', 'chess2', 'img', 'classicPieces', `${colour}-${pieceType}.png` ]);
      /// =ABOVE} {BELOW=
      keep = foundation.getKeep('urlResource', { reply: 1, command: key });
      /// =BELOW}
      chess2Keeps[key] = keep;
    }}
    
    let open = async () => {
      
      let c2Hut = await foundation.getRootHut({ heartMs: 1000 * 40 });
      c2Hut.roadDbgEnabled = true; // TODO: This doesn't affect the Below!
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('c2', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        
        // Logged Out
        real('loggedOut', CenteredSlotter);
        real('welcomePane', () => LinearSlotter({ axis: 'y', dir: '+' }));
        real('welcomePaneTitle', null, TextSized({ size: UnitPc(1.8), pad: UnitPx(10) }));
        real('welcomePaneBody', null, TextSized({ size: UnitPc(1), pad: UnitPx(3) }));
        insert('main -> loggedOut', () => FillParent({ shrink: UnitPc(0.2) }));
        insert('loggedOut -> welcomePane', sl => sl.getCenteredSlot());
        insert('welcomePane -> welcomePaneTitle', sl => sl.getLinearSlot());
        insert('welcomePane -> welcomePaneBody', sl => sl.getLinearSlot());
        
        // Logged In
        real('loggedIn', CenteredSlotter, FillParent());
        real('lobby', null, TextSized({ size: UnitPc(0.85), pad: UnitPx(16) }));
        real('game', () => LinearSlotter({ axis: 'y', dir: '+', scroll: false })); // Insert [ p1, board, p2 ]
        real('player', CenteredSlotter);
        real('playerContent', () => LinearSlotter({ axis: 'x', dir: '+' }));
        real('playerContentName', () => TextSized({ size: UnitPc(1), padH: UnitPx(6) }));
        real('playerContentTimer', () => TextSized({ size: UnitPc(1) }));
        real('conclusion', CenteredSlotter);
        real('conclusionContent', () => TextSized({ size: UnitPc(2.5) }));
        insert('main -> loggedIn', () => FillParent());
        insert('loggedIn -> lobby', sl => sl.getCenteredSlot()); // TODO: Should the slotting functions each be able to return multiple layouts???
        insert('loggedIn -> game', () => FillParent());
        
        /*
        // TODO: In the future, the way an insert resolves should be
        // capable of varying based on contextual info surrounding the
        // KidReal (or even the ParReal??? MINDBLOWING). All possible
        // different insertion types must be listed here so that the css
        // can be made aware of all possibilities...
        insert('game -> player', () => FillParent({ x: 1, y: 0.1 }));
        insert('game -> player:white', sl => sl.getFixedSlot(0));
        insert('game -> player:black', sl => sl.getFixedSlot(1));
        */
        
        insert('game -> player', sl => [ sl.getLinearSlot(), FillParent({ w: UnitPc(1), h: UnitPc(0.1) }) ]); // "player" inside "game" takes up 10% (two take up 20%)
        insert('game -> board', sl => [ sl.getLinearSlot(), FillParent({ x: 0.8, y: 0.8 }) ]);
        insert('player -> playerContent', sl => sl.getCenteredSlot());
        insert('playerContent -> playerContentName', sl => sl.getLinearSlot());
        insert('playerContent -> playerContentTimer', sl => sl.getLinearSlot());
        insert('board -> tileWhite');
        insert('board -> tileBlack');
        insert('board -> piece');
        insert('board -> showMovePiece');
        insert('board -> showMoveTile');
        insert('showMoveTile -> indicator');
        insert('game -> conclusion', () => FillParent());
        insert('conclusion -> conclusionContent', sl => sl.getCenteredSlot());
        
        // Decals
        decals('root', { colour: '#646496', textColour: '#ffffff' });
        decals('loggedOut', { colour: 'rgba(120, 120, 170, 1)' });
        decals('lobby', { colour: '#646496' });
        decals('game', { colour: '#646496' });
        decals('board', { colour: 'transparent' });
        decals('tileWhite', { colour: '#9a9abb', border: { ext: UnitPx(1), colour: '#c0c0d8' } });
        decals('tileBlack', { colour: '#8989af', border: { ext: UnitPx(1), colour: '#c0c0d8' } });
        decals('conclusion', { colour: 'rgba(0, 0, 0, 0.5)' });
        
      });
      
      let webApp = WebApp('c2');
      await webApp.decorateHut(c2Hut, rootReal);
      
      let validMoves = (matchPlayer, match, piece) => {
        
        if (piece.val.wait > 0) return [];
        if (matchPlayer.val.colour !== piece.val.colour) return [];
        
        // Get other pieces
        let pieces = match.relRecs('c2.matchPiece').toArr(matchPiece => matchPiece.mem('piece'));
        
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
          
          if (type === 'king' && piece.val.moves === 0) {
            
            // A king searches along ortho axes for castling moves. An
            // axis+direction is "castleable" if it contains a rook, at
            // least two tiles separate the rook and king, and all tiles
            // between the rook and king are empty.
            // A king may move 2 tiles in a "castleable" axis+direction
            
            for (let step of orth) {
              
              let numSteps = 0, castlePiece = null;
              for (numSteps = 1; true; numSteps++) {
                
                let loc = [ col + Math.round(step[0] * numSteps), row + Math.round(step[1] * numSteps) ];
                let check = checkTile(...loc);
                
                if (check === 'OOB') { break; }
                if (check) { castlePiece = check; break; }
                
              }
              
              let canCastleThisStep = true
                && castlePiece
                && numSteps > 2
                && castlePiece.val.type === 'rook'
                && castlePiece.val.colour === piece.val.colour
                && castlePiece.val.moves === 0;
              
              if (canCastleThisStep) moves.push([ col + Math.round(step[0] * 2), row + Math.round(step[1] * 2) ]);
              
            }
            
          }
          
        } else {
          
          throw Error(`Invalid type: ${type}`);
          
        }
        
        return moves;
        
      };
      let applyMoves = (match, ...playerMoves) => {
        
        // Get all match pieces...
        let matchPieceSet = match.relRecs('c2.matchPiece');
        let pieces = matchPieceSet.toArr(matchPiece => matchPiece.members['c2.piece']);
        
        // All pieces refresh by 1 turn
        for (let piece of pieces) if (piece.val.wait) piece.modVal(v => (v.wait--, v));
        
        let pieceMoves = { white: [], black: [] };
        let dangerTiles = { white: [], black: [] };
        
        // Update piece positions
        playerMoves.forEach(({ type, pieceUid, tile }) => {
          
          if (type === 'pass') return;
          let piece = pieces.find(p => p.uid === pieceUid)[0];
          let gudColour = piece.val.colour;
          let badColour = (gudColour === 'white') ? 'black' : 'white';
          
          let trnCol = tile[0] - piece.val.col;
          let trnRow = tile[1] - piece.val.row;
          
          // Lots of logic required to sort out castling...
          if (piece.val.type === 'king' && (Math.abs(trnCol) >= 2 || Math.abs(trnRow) >= 2)) {
            
            let gudKing = piece;
            let [ gudRook=null ] = pieces.find(gp => { // "gudPiece"
              
              return true
                && gp.val.colour === gudColour
                && gp.val.type === 'rook'
                && gp.val.moves === 0
                && (false
                  // The pieces are on the same row, and the rook is appropriately L/R from the king
                  || (trnRow === 0 && (trnCol > 0 ? (gp.val.col > gudKing.val.col) : (gp.val.col < gudKing.val.col))) // A rook horizontally
                  // The pieces are on the same col, and the rook is appropriately U/D from the king
                  || (trnCol === 0 && (trnRow > 0 ? (gp.val.row > gudKing.val.row) : (gp.val.row < gudKing.val.row)))
                );
              
            }) || [];
            
            if (!gudRook) throw Error(`No rook found for castling... yikes`);
            
            let kingLoc = { col: tile[0], row: tile[1] };
            let rookLoc = (trnRow === 0)
              ? { col: tile[0] + (trnCol > 0 ? -1 : +1), row: tile[1] }
              : { col: tile[0], row: tile[1] + (trnRow > 0 ? -1 : +1) };
            
            pieceMoves[gudColour].push({ piece: gudKing, ...kingLoc });
            pieceMoves[gudColour].push({ piece: gudRook, ...rookLoc });
            
            // No `dangerTiles` when castling!!
            
          } else {
            
            pieceMoves[gudColour].push({ piece, col: tile[0], row: tile[1] });
            dangerTiles[badColour].push({ col: tile[0], row: tile[1] });
            
          }
          
        });
        
        for (let moveColour in pieceMoves) {
          
          let moves = pieceMoves[moveColour];
          let danger = dangerTiles[moveColour];
          
          for (let { piece, col, row } of moves) {
            
            // Apply promotions to pawns which make it all the way
            if (piece.val.type === 'pawn' && row === ((moveColour === 'white') ? 7 : 0)) piece.modVal(v => (v.type = 'queen', v));
            
            // Change piece coords, make it wait, increment moves!
            piece.modVal(v => v.gain({ col, row, wait: 1, moves: v.moves + 1 }));
            
            // Piece dies if it intersected a danger tile
            if (danger.find(({ col: dc, row: dr }) => col === dc && row == dr)) piece.dry();
            
          }
          
        }
        
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
      let termBank = term.TermBank();
      
      c2Hut.roadNozz('chess2.info').route(({ reply }) => {
        reply(foundation.getKeep('fileSystem', [ 'room', 'chess2', 'chess2Info.html' ]));
      });
      /// =ABOVE}
      
      let rootScp = RecScope(c2Hut, 'c2.chess2', async (chess2, dep) => {
        
        /// {ABOVE=
        
        // Serve files (TODO: to be PICKY, could deny Huts without Matches)
        for (let pieceType of pieceTypes) { for (let colour of [ 'white', 'black' ]) {
          let key = `chess2Piece.${colour}.${pieceType}`;
          c2Hut.roadNozz(key).route(({ reply }) => reply(chess2Keeps[key]));
        }}
        
        // Manage Huts
        dep.scp(c2Hut, 'lands.kidHut/par', ({ members: { kid: hut } }, dep) => { // Note we already have reference to `hut`!
          
          let kidHutDep = dep;
          
          // Actions for Huts (differentiate between logged-in and logged-out)
          let hutPlayerNozz = hut.relNozz('c2.hutPlayer');
          let hutPlayerDryNozz = dep(TubDry(null, hutPlayerNozz));
          
          // Follows
          dep(hut.followRec(chess2));
          dep.scp(hut, 'c2.hutPlayer', (hutPlayer, dep) => {
            
            dep(hut.followRec(hutPlayer));
            
            // Careful not to Follow the HutPlayer!
            let player = hutPlayer.mem('player');
            dep.scp(player, 'c2.chess2Player', (chess2Player, dep) => {
              
              // Follow the Player through the Chess2Player!
              dep(hut.followRec(chess2Player));
              
              dep.scp(player, 'c2.matchPlayer', (matchPlayer, dep) => {
                
                dep(hut.followRec(matchPlayer)); // Follow Match
                
                // Follow Players, Pieces, Round, Conclusion of Match
                let followRecFn = (r, dep) => dep(hut.followRec(r));
                let match = matchPlayer.mem('match');
                dep.scp(match, 'c2.matchConclusion',  followRecFn);
                dep.scp(match, 'c2.matchRound',       followRecFn);
                dep.scp(match, 'c2.matchPlayer',      followRecFn);
                dep.scp(match, 'c2.matchPiece',       followRecFn);
                
              });
              
            });
            
          });
          
          dep.scp(hutPlayerDryNozz, (_, dep) => {
            dep(hut.roadNozz('login').route(() => {
              // TODO: `chess2Player` should receive `hutPlayer`, not
              // `player`, as its second member (this would establish an
              // implicit dependency between the Hut and the Player)
              let player =        c2Hut.createRec('c2.player', [], { term: null });
              let hutPlayer =     c2Hut.createRec('c2.hutPlayer', [ hut, player ]);
              let chess2Player =  c2Hut.createRec('c2.chess2Player', [ chess2, player ]);
              
              kidHutDep(player); // The Player dries with the Hut
            }));
          });
          dep.scp(hutPlayerNozz, (hutPlayer, dep) => {
            
            // Huts with Players can logout
            dep(hut.roadNozz('logout').route(({ user, pass }) => hutPlayer.dry()));
            
            let player = hutPlayer.mem('player');
            dep.scp(player, 'c2.matchPlayer', (matchPlayer, dep) => {
              
              // Players in a Match can leave that Match
              dep(hut.roadNozz('exitMatch').route(() => matchPlayer.dry()));
              
              dep.scp(matchPlayer, 'c2.roundPlayer', (roundPlayer, dep) => {
                
                // Players in Rounds can submit a move for that Round
                dep(hut.roadNozz('doMove').route(({ msg }) => {
                  
                  // Clear current move
                  roundPlayer.relNozz('c2.roundPlayerMove').dryContents();
                  
                  // Perform updated move:
                  let { type, pieceUid, tile } = msg;
                  if (type === 'retract') return; // "retract" means no move yet
                  
                  let move = c2Hut.createRec('c2.move', [], { type, pieceUid, tile });
                  c2Hut.createRec('c2.roundPlayerMove', [ roundPlayer, move ]);
                  
                }));
                
              });
              
            });
            
          });
          
        });
        
        // Decorate chess2Players with a "term" from the Bank
        dep.scp(chess2, 'c2.chess2Player', (chess2Player, dep) => {
          
          let { value: term } = dep(termBank.checkout());
          chess2Player.members['c2.player'].modVal(v => v.gain({ term }));
          
        });
        
        // Gameplay
        dep.scp(chess2, 'c2.chess2Match', (chess2Match, dep) => {
          
          let match = chess2Match.mem('match');
          let matchPlayerNozz = match.relNozz('c2.matchPlayer');
          let matchPlayerCntNozz = dep(TubCnt(null, matchPlayerNozz));
          let matchPlayerDryNozz = dep(TubDry(null, matchPlayerNozz));
          
          let matchRoundNozz = match.relNozz('c2.matchRound');
          let noMatchRoundNozz = dep(TubDry(null, matchRoundNozz));
          
          dep.scp(matchRoundNozz, (matchRound, dep) => {
            
            let round = matchRound.mem('round');
            
            dep(matchPlayerCntNozz.route(playerCnt => {
              
              if (playerCnt === 2) return;
              
              round.dry();
              let mp = match.relRec('c2.matchPlayer');
              let conclusion = c2Hut.createRec('c2.conclusion', [], mp ? mp.val.colour : 'stalemate');
              let matchConclusion = c2Hut.createRec('c2.matchConclusion', [ match, conclusion ]);
              
            }));
            
            // Simplify tracking all RoundPlayerMoves; we'll use
            // `roundPlayerMoves` to always hold the most recent set of
            // moves, and `roundPlayerMoveNozz` to drip any changes
            let roundPlayerMoves = Set();
            let roundPlayerMoveNozz = Nozz();
            roundPlayerMoveNozz.newRoute = routeFn => routeFn(roundPlayerMoves);
            dep.scp(round, 'c2.roundPlayer', (roundPlayer, dep) => {
              
              dep.scp(roundPlayer, 'c2.roundPlayerMove', (roundPlayerMove, dep) => {
                
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
                let nextRound = c2Hut.createRec('c2.round', [], { endMs: foundation.getMs() + moveMs });
                for (let matchPlayer of match.relRecs('c2.matchPlayer'))
                  c2Hut.createRec('c2.roundPlayer', [ nextRound, matchPlayer ]);
                c2Hut.createRec('c2.matchRound', [ match, nextRound ]);
                
              } else {
                
                let [ val='stalemate' ] = aliveCols.toArr(v => v);
                let conclusion = c2Hut.createRec('c2.conclusion', [], val);
                c2Hut.createRec('c2.matchConclusion', [ match, conclusion ]);
                
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
          
          let waitingPlayers = chess2.relNozz('c2.chess2Player').set.toArr(v => {
            let player = v.mem('player');
            return player.relRec('c2.matchPlayer') ? C.skip : player;
          });
          
          for (let i = 0; i < waitingPlayers.length - 1; i += 2) {
            
            // For each pair of Players create a Match, assign the Players to
            // that Match, and then create Pieces and assign each Piece to the
            // Match and its appropriate Player.
            
            let match = c2Hut.createRec('c2.match');
            
            let playerPieceSets = [
              { colour: 'white', player: waitingPlayers[i + 0], pieces: pieceDefs.standard.white },
              { colour: 'black', player: waitingPlayers[i + 1], pieces: pieceDefs.standard.black }
            ];
            
            console.log(`Matching ${playerPieceSets.map(({ player }) => player.val.term).join(' and ')}`);
            
            for (let { colour, player, pieces } of playerPieceSets) {
              let matchPlayer = c2Hut.createRec('c2.matchPlayer', [ match, player ], { colour });
              matchPlayer.desc = `For Player ${player.val.term}`;
              for (let [ type, col, row ] of pieces) {
                let piece = c2Hut.createRec('c2.piece', [], { colour, type, col, row, wait: 0, moves: 0 });
                let matchPiece = c2Hut.createRec('c2.matchPiece', [ match, piece ]);
              }
            }
            
            let chess2Match = c2Hut.createRec('c2.chess2Match', [ chess2, match ]);
            let initialRound = c2Hut.createRec('c2.round', [], { endMs: foundation.getMs() + moveMs });
            for (let matchPlayer of match.relRecs('c2.matchPlayer'))
              c2Hut.createRec('c2.roundPlayer', [ initialRound, matchPlayer ]);
            let matchRound = c2Hut.createRec('c2.matchRound', [ match, initialRound ]);
            
          }
          
        }, matchmakeMs);
        dep(Drop(null, () => clearInterval(interval)));
        
        /// =ABOVE} {BELOW=
        
        global.chess2 = chess2;
        dep(Drop(null, () => { delete global.chess2; }));
        
        let c2RootReal = dep(rootReal.techReals[0].addReal('c2.root'));
        let mainReal = c2RootReal.addReal('c2.main');
        
        let myHutPlayerNozz = c2Hut.relNozz('c2.hutPlayer');
        let myHutPlayerDryNozz = dep(TubDry(null, myHutPlayerNozz));
        
        dep.scp(myHutPlayerDryNozz, (_, dep) => {
          
          let outReal = dep(mainReal.addReal('c2.loggedOut'));
          let contentReal = outReal.addReal('c2.welcomePane');
          let titleReal = contentReal.addReal('c2.welcomePaneTitle');
          let textReal = contentReal.addReal('c2.welcomePaneBody');
          
          titleReal.setText('Chess2');
          textReal.setText('Click to start playing!');
          
          dep(outReal.feelNozz().route(() => c2Hut.tell({ command: 'login' })));
          
        });
        dep.scp(myHutPlayerNozz, (hutPlayer, dep) => {
          
          let player = hutPlayer.members['c2.player'];
          
          let loggedInReal = dep(mainReal.addReal('c2.loggedIn'));
          
          let myMatchPlayerNozz = player.relNozz('c2.matchPlayer');
          let myMatchPlayerDryNozz = dep(TubDry(null, myMatchPlayerNozz));
          
          dep.scp(myMatchPlayerDryNozz, (_, dep) => {
            
            let lobbyReal = dep(loggedInReal.addReal('c2.lobby'));
            lobbyReal.setText('Waiting for match...');
            
          });
          dep.scp(myMatchPlayerNozz, (myMatchPlayer, dep) => {
            
            let match = myMatchPlayer.members['c2.match'];
            let myColour = myMatchPlayer.val.colour;
            
            let gameReal = dep(loggedInReal.addReal('c2.game'));
            
            // Show Player names
            dep.scp(match, 'c2.matchPlayer', (matchPlayer, dep) => {
              
              let player = matchPlayer.mem('player');
              let colour = matchPlayer.val.colour;
              
              let playerReal = dep(gameReal.addReal('c2.player'));
              let playerContentReal = playerReal.addReal('c2.playerContent');
              let playerNameReal = playerContentReal.addReal('c2.playerContentName');
              playerNameReal.setText(player.val.term);
              
              playerReal.setGeom(...((colour === 'white')
                ? [ UnitPc(1), UnitPc(0.1), UnitPc(0.5), UnitPc(0.05) ]
                : [ UnitPc(1), UnitPc(0.1), UnitPc(0.5), UnitPc(0.95) ]
              ));
              
              dep(myMatchPlayer.route(val => playerReal.setRot((val.colour === 'white') ? 0.5 : 0)));
              
              if (myMatchPlayer !== matchPlayer) return; // Stop here if this isn't our player
              
              dep.scp(match, 'c2.matchRound', (matchRound, dep) => {
                let round = matchRound.mem('round');
                let playerTimerReal = dep(playerContentReal.addReal('c2.playerContentTimer'));
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
            let boardReal = gameReal.addReal('c2.board');
            boardReal.setGeom(UnitPc(0.8), UnitPc(0.8), UnitPc(0.5), UnitPc(0.5));
            
            // Show board tiles
            for (let col = 0; col < 8; col++) { for (let row = 0; row < 8; row++) {
              let tile = boardReal.addReal(((col % 2) === (row % 2)) ? 'c2.tileWhite' : 'c2.tileBlack');
              tile.setGeom(tileExt(), tileExt(), tileLoc(col), tileLoc(row));
            }}
            
            let selectedPieceNozz = dep(TubVal(null, Nozz()));
            let selectedPieceDryNozz = dep(TubDry(null, selectedPieceNozz));
            let confirmedMoveNozz = dep(TubVal(null, Nozz()));
            let noConfirmedMoveNozz = dep(TubVal(null, Nozz()));
            
            dep.scp(match, 'c2.matchPiece', (matchPiece, dep) => {
              
              let piece = matchPiece.members['c2.piece'];
              let pieceReal = dep(boardReal.addReal('c2.piece'));
              pieceReal.setTransition([ 'x', 'y' ], 300, 'smooth');
              pieceReal.setTransition([ 'scale', 'opacity' ], 300, 'steady', 300);
              pieceReal.setDeathTransition(600, real => { real.setOpacity(0); real.setScl(8); });
              dep(piece.route(({ colour, type, col, row, wait }) => {
                
                // Reset selected and confirmed pieces when any piece updates
                selectedPieceNozz.dryContents();
                confirmedMoveNozz.dryContents();
                
                pieceReal.setRoundness(1);
                pieceReal.setGeom(tileExt(0.95), tileExt(0.95), tileLoc(col), tileLoc(row));
                pieceReal.setImage(chess2Keeps[`chess2Piece.${colour}.${type}`]);
                
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
              
              dep(myMatchPlayer.route(val => pieceReal.setRot((val.colour === 'white') ? 0.5 : 0)));
              
            });
            
            dep.scp(selectedPieceNozz, ({ piece }, dep) => {
              
              confirmedMoveNozz.dryContents();
              
              c2Hut.tell({ command: 'doMove', type: 'retract' });
              
              validMoves(myMatchPlayer, match, piece).forEach(([ col, row, cap ]) => {
                
                let moveReal = dep(boardReal.addReal('c2.showMoveTile'));
                moveReal.setGeom(tileExt(), tileExt(), tileLoc(col), tileLoc(row));
                
                let indReal = moveReal.addReal('c2.indicator');
                let colour = (piece.val.colour === 'white') ? '#e4e4f0' : '#191944';
                indReal.setGeom(UnitPc(cap ? 0.9 : 0.3), UnitPc(cap ? 0.9 : 0.3), UnitPc(0.5), UnitPc(0.5));
                indReal.setRoundness(1);
                
                if (cap)  indReal.setBorder(UnitPx(5), colour);
                else      indReal.setColour(colour);
                
                dep(moveReal.feelNozz().route(() => {
                  c2Hut.tell({ command: 'doMove', type: 'piece', pieceUid: piece.uid, tile: [ col, row ] });
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
              
              let showPieceReal = dep(boardReal.addReal('c2.showMovePiece'));
              showPieceReal.setRoundness(1);
              showPieceReal.setGeom(tileExt(0.9), tileExt(0.9), tileLoc(piece.val.col), tileLoc(piece.val.row));
              showPieceReal.setBorder(UnitPx(5), colour);
              
              let showTileReal = dep(boardReal.addReal('c2.showMoveTile'));
              showTileReal.setRoundness(1);
              if (cap) {
                showTileReal.setGeom(tileExt(0.9), tileExt(0.9), tileLoc(tile[0]), tileLoc(tile[1]));
                showTileReal.setBorder(UnitPx(5), colour);
              } else {
                showTileReal.setGeom(tileExt(0.3), tileExt(0.3), tileLoc(tile[0]), tileLoc(tile[1]));
                showTileReal.setColour(colour);
              }
              
            });
            
            dep(myMatchPlayer.route(val => gameReal.setRot((val.colour === 'white') ? 0.5 : 0)));
            
            dep.scp(match, 'c2.matchConclusion', (matchConclusion, dep) => {
              
              let conclusion = matchConclusion.mem('conclusion');
              let result = conclusion.val;
              
              let conclusionReal = dep(gameReal.addReal('c2.conclusion'));
              let conclusionContentReal = conclusionReal.addReal('c2.conclusionContent');
              
              let type = (result !== 'stalemate')
                ? ((result === myMatchPlayer.val.colour) ? 'winner' : 'loser')
                : 'stalemate';
              
              conclusionContentReal.setText(({
                winner: 'You WIN!',
                loser: 'You LOSE!',
                stalemate: 'Tie game!'
              })[type]);
              
              dep(myMatchPlayer.route(val => conclusionReal.setRot((val.colour === 'white') ? 0.5 : 0)));
              
              dep(conclusionReal.feelNozz().route(() => c2Hut.tell({ command: 'exitMatch' })));
                
            });
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
