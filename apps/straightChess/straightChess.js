var package = new PACK.pack.Package({ name: 'straightChess',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  buildFunc: function(sc) {
    
    sc.resources = {
      css: [
        'apps/straightChess/css/style.css',
        'apps/userify/css/substance.css'
      ]
    };
    
  },
  runAfter: function(sc, app, ds, nf, p, sv, uf) {
    
    var P = p.P;
    var App = app.App;
    
    var calcBoard = function(doss) {
      
      var board = A.map(U.range({0:8}), function() {
        return A.map(U.range({0:8}), function() { return null; });
      });
      
      var p1Pcs = doss.getChild('playerSet.player1.pieceSet');
      var p2Pcs = doss.getChild('playerSet.player2.pieceSet');
      
      
      A.each([ [ 'p1', p1Pcs ], [ 'p2', p2Pcs ] ], function(vals) {
        
        var p = vals[0];
        var pcs = vals[1];
        
        for (var k in pcs.children) {
          
          var pc = pcs.getChild(k);
          var col = pc.getChild('col').getValue();
          var row = pc.getChild('row').getValue();
          
          board[col][row] = { type: pc.getChild('type').getValue(), player: p };
        }
        
      });
      
      return board;
      
    };
    var checkTile = function(board, col, row) {
      if (col < 0 || col > 7 || row < 0 || row > 7) return 'OOB'; // Out of bounds
      return board[col][row];
    };
    var movesForPc = function(doss, col, row) {
      
      // TODO: castling + en-passant
      
      var board = calcBoard(doss);
      
      var pc = board[col][row];
      if (!pc) throw new Error('No piece at col ' + col + ', row ' + row);
      
      var moves = [];
      
      if (pc.type === 'pawn') {
        
        var dir = pc.player === 'p1' ? 1 : -1;
        var initRow = pc.player === 'p1' ? 1 : 6;
        
        // Check the first step tile
        if (!board[col][row + dir]) {
          
          moves.push({ col: col, row: row + dir });
          
          // Check for double-move if on initial row
          if (row === initRow && !board[col][row + dir + dir])
            moves.push({ col: col, row: row + dir + dir });
          
        }
        
        // Check for left- and right-captures
        var capture1 = checkTile(board, col - 1, row + dir);
        if (capture1 && capture1 !== 'OOB' && capture1.player !== pc.player) moves.push({ col: col - 1, row: row + dir });
        
        var capture2 = checkTile(board, col + 1, row + dir);
        if (capture2 && capture2 !== 'OOB' && capture2.player !== pc.player) moves.push({ col: col + 1, row: row + dir });
        
      } else if (pc.type === 'knight') {
        
        var offsets = [
          [ -2, -1 ], [ -2, 1 ], [ -1, 2 ], [ 1, 2 ], [ 2, 1 ], [ 2, -1 ], [ 1, -2 ], [ -1, -2 ]
        ];
        
        for (var i = 0; i < offsets.length; i++) {
          
          var col0 = col + offsets[i][0];
          var row0 = row + offsets[i][1];
          
          if (col0 < 0 || col0 > 7 || row0 < 0 || row0 > 7) continue;
          
          // If the move tile is empty, or occupied by the enemy, it's a valid move
          if (!board[col0][row0] || board[col0][row0].player !== pc.player)
            moves.push({ col: col0, row: row0 });
          
        }
        
      } else if (pc.type === 'bishop' || pc.type === 'rook' || pc.type === 'queen' || pc.type === 'king') {
        
        var steps = ({
          // Diagonal steps
          bishop: [ [ -1, -1 ], [ -1, 1 ], [ 1, 1 ], [ 1, -1 ] ],
          // Straight steps
          rook:   [ [ -1, 0 ], [ 0, 1 ], [ 1, 0 ], [ 0, -1 ] ],
          // Both kinds of steps
          queen:  [ [ -1, -1 ], [ -1, 1 ], [ 1, 1 ], [ 1, -1 ], [ -1, 0 ], [ 0, 1 ], [ 1, 0 ], [ 0, -1 ] ],
          king:   [ [ -1, -1 ], [ -1, 1 ], [ 1, 1 ], [ 1, -1 ], [ -1, 0 ], [ 0, 1 ], [ 1, 0 ], [ 0, -1 ] ]
        })[pc.type];
        
        for (var i = 0; i < steps.length; i++) {
          
          var col0 = col;
          var row0 = row;
          
          while (true) {
            
            col0 += steps[i][0];
            row0 += steps[i][1];
            
            if (col0 < 0 || col0 > 7 || row0 < 0 || row0 > 7) break;
            
            var pc0 = board[col0][row0];
            
            // Empty tiles or tiles occupied by enemy pieces are valid moves
            if (!pc0 || pc0.player !== pc.player) moves.push({ col: col0, row: row0 });
            
            // Finding any piece breaks the search in this direction
            // The king only gets to take one step in any direction
            if (pc0 || pc.type === 'king') break;
            
          }
          
        }
        
      } else {
        
        throw new Error('Invalid type: "' + pc.type + '"');
        
      }
      
      return moves;
      
    };
    
    new App({ name: 'straightChess',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(outline, actionizer) {
        
        /// {SERVER=
        var whiteSession = null;
        var blackSession = null;
        /// =SERVER}
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        outline.addAbility('ready', actionizer.makeAbility('ready', false, function(editor, doss, data, session, channelerParams) {
          
          /// {SERVER=
          if (whiteSession === session || blackSession === session) return;
          
          if (whiteSession === null) {
            
            whiteSession = session;
            console.log('WHITE:', session.ip);
            var playerColour = 'white';
            
          } else if (blackSession === null) {
            
            blackSession = session;
            console.log('BLACK:', session.ip);
            var playerColour = 'black';
            
          } else {
            
            console.log('BAD??');
            return;
            
          }
          
          console.log('ASSIGNING:', session.ip);
          var params = {
            data: { 
              playerColour: playerColour,
            },
            doSync: true,
            sessionsToInform: [ session ]
          };
          
          return doss.$stageAbility('assign', session, channelerParams, editor, params);
          
          //doss.$useAbility('assign', params, session, channelerParams).done();
          /// =SERVER}
          
        }));
        outline.addAbility('assign', actionizer.makeAbility('assign', false, function(editor, doss, data) {
          
          /// {CLIENT=
          var playerColour = U.param(data, 'playerColour');
          console.log('ASSIGNED:', playerColour);
          
          if (playerColour === 'white') {
            
            var owned = doss.getChild('~root.playerSet.player1');
            var enemy = doss.getChild('~root.playerSet.player2');
            
          } else if (playerColour === 'black') {
            
            var owned = doss.getChild('~root.playerSet.player2');
            var enemy = doss.getChild('~root.playerSet.player1');
            
          } else {
            
            console.log('BAD PLAYER COLOUR');
            return;
            
          }
          
          editor.mod({ doss: doss.getChild('~root.player.ready'), data: true });
          editor.mod({ doss: doss.getChild('~root.player.owned'), data: owned });
          editor.mod({ doss: doss.getChild('~root.player.enemy'), data: enemy });
          
          editor.$transaction.then(function() {
            
            doss.getChild('~root.player.ready').worry('invalidated');
            doss.getChild('~root.player.owned').worry('invalidated');
            doss.getChild('~root.player.enemy').worry('invalidated');
            
          });
          
          /// =CLIENT}
          
        }));
        outline.addAbility('move', actionizer.makeAbility('move', false, function(editor, doss, data, session, channelerParams) {
          
          var p1Mov = doss.getChild(data.p1.piece);
          var p1Cap = null;
          
          var p2Mov = doss.getChild(data.p2.piece);
          var p2Cap = null;
          
          if (data.p1.col === data.p2.col && data.p1.row === data.p2.row) {
            
            console.log('EXPLOOOODE');
            p1Cap = p2Mov;
            p2Cap = p1Mov;
            
          } else {
            
            // Detect targetted pieces
            var p1Pcs = doss.getChild('playerSet.player1.pieceSet');
            for (var k in p1Pcs.children) {
              var pc = p1Pcs.children[k];
              var col = pc.getChild('col').getValue();
              var row = pc.getChild('row').getValue();
              
              if (col === data.p2.col && row === data.p2.row) { p2Cap = pc; break; }
            }
            
            var p2Pcs = doss.getChild('playerSet.player2.pieceSet');
            for (var k in p2Pcs.children) {
              var pc = p2Pcs.children[k];
              var col = pc.getChild('col').getValue();
              var row = pc.getChild('row').getValue();
              
              if (col === data.p1.col && row === data.p1.row) { p1Cap = pc; break; }
            }
            
            // Can't capture the moving piece(s)
            if (p2Cap === p1Mov) p2Cap = null;
            if (p1Cap === p2Mov) p1Cap = null;
            
            
          }
          
          // Increase the turn count
          var turn = doss.getChild('turnCount').getValue();
          editor.mod({ doss: doss.getChild('turnCount'), data: turn + 1 });
          
          // Move pieces
          editor.mod({
            doss: p1Mov,
            data: { col: data.p1.col, row: data.p1.row, cooldown: turn + 2 }
          });
          editor.mod({
            doss: p2Mov,
            data: { col: data.p2.col, row: data.p2.row, cooldown: turn + 2 }
          });
          
          // Remove captured pieces
          if (p1Cap) editor.rem({ child: p1Cap });
          if (p2Cap) editor.rem({ child: p2Cap });
          
          // Set intentions back to null
          editor.mod({ doss: doss.getChild('playerSet.player1.intention'), data: { piece: null }});
          editor.mod({ doss: doss.getChild('playerSet.player2.intention'), data: { piece: null }});
          
          /// {CLIENT=
          var moveSet = doss.getChild('player.moveSet');
          for (var k in moveSet.children) editor.rem({ child: moveSet.children[k] });
          editor.mod({ doss: doss.getChild('player.selected'), data: null });
          /// =CLIENT}
          
          editor.$transaction.then(function() {
            
            doss.getChild('turnCount').worry('invalidated');
            
            p1Mov.worry('invalidated');
            p1Mov.getChild('cooldown').worry('invalidated');
            p1Mov.getChild('col').worry('invalidated');
            p1Mov.getChild('row').worry('invalidated');
            
            p2Mov.worry('invalidated');
            p2Mov.getChild('cooldown').worry('invalidated');
            p2Mov.getChild('col').worry('invalidated');
            p2Mov.getChild('row').worry('invalidated');
            
            if (p2Cap) doss.getChild('playerSet.player1.pieceSet').worry('invalidated');
            if (p1Cap) doss.getChild('playerSet.player2.pieceSet').worry('invalidated');
            
            doss.getChild('playerSet.player1.intention').worry('invalidated');
            doss.getChild('playerSet.player2.intention').worry('invalidated');
            
            /// {CLIENT=
            doss.getChild('player.moveSet').worry('invalidated');
            doss.getChild('player.selected').worry('invalidated');
            /// =CLIENT}
            
          });
          
        }));
        
        var turnCount = outline.addChild(new Val({ name: 'turnCount', dossClass: ds.DossierInt }));
        
        /// {CLIENT=
        var player = outline.addChild(new Obj({ name: 'player' }));
        player.addChild(new Val({ name: 'ready', dossClass: ds.DossierBln, defaultValue: false }));
        player.addChild(new Ref({ name: 'owned', format: '~root.playerSet.$playerNum' }));
        player.addChild(new Ref({ name: 'enemy', format: '~root.playerSet.$playerNum' }));
        player.addChild(new Ref({ name: 'selected', format: '~root.playerSet.$playerNum.pieceSet.$id' }));
        
        var moveSet = player.addChild(new Arr({ name: 'moveSet' }));
        moveSet.setNameFunc(function(doss) {
          return 'col' + doss.getChild('col').getValue() + 'row' + doss.getChild('row').getValue();
        });
        var move = moveSet.setTemplate(new Obj({ name: 'move' }));
        move.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        move.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        /// =CLIENT}
        
        var playerSet = outline.addChild(new Obj({ name: 'playerSet' }));
        var player1 = playerSet.addChild(new Obj({ name: 'player1' }));
        var player2 = playerSet.addChild(new Obj({ name: 'player2' }));
        
        var piece = new Obj({ name: 'piece', abilities: {
          /// {CLIENT=
          select: actionizer.makeAbility('select', false, function(editor, doss, data) {
            
            var selected = doss.getChild('~root.player.selected');
            var moves = doss.getChild('~root.player.moveSet');
            
            // Clear any existing moves
            for (var k in moves.children) editor.rem({ child: moves.children[k] });
            
            var cooldown = doss.getChild('cooldown').getValue();
            var turnCount = doss.getChild('~root.turnCount').getValue();
            
            if (cooldown <= turnCount) {
            
              var col = doss.getChild('col').getValue();
              var row = doss.getChild('row').getValue();
              var movesData = movesForPc(doss.getChild('~root'), col, row);
              
              // Add on available moves
              for (var i = 0, len = movesData.length; i < len; i++) editor.add({ par: moves, data: movesData[i] });
              
              // Update selected reference
              editor.mod({ doss: selected, data: doss });
              
            } else {
              
              editor.mod({ doss: selected, data: null });
              
            }
            
            editor.$transaction.then(function() {
              moves.worry('invalidated');
              selected.worry('invalidated');
            });
            
          })
          /// =CLIENT}
        }});
        piece.addChild(new Val({ name: 'type' }));
        piece.addChild(new Val({ name: 'cooldown', dossClass: ds.DossierInt }));
        piece.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        piece.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        // P1
        var p1PieceSet = player1.addChild(new Arr({ name: 'pieceSet' }));
        p1PieceSet.setTemplate(piece);
        
        var p1Intention = player1.addChild(new Obj({ name: 'intention' }));
        p1Intention.addChild(new Ref({ name: 'piece', format: '~root.playerSet.player1.pieceSet.$id' }));
        p1Intention.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        p1Intention.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        var p1PrevMove = player1.addChild(new Obj({ name: 'prevMove' }));
        p1PrevMove.addChild(new Ref({ name: 'piece', format: '~root.playerSet.player1.pieceSet.$id' }));
        p1PrevMove.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        p1PrevMove.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        // P2
        var p2PieceSet = player2.addChild(new Arr({ name: 'pieceSet' }))
        p2PieceSet.setTemplate(piece);
        
        var p2Intention = player2.addChild(new Obj({ name: 'intention' }));
        p2Intention.addChild(new Ref({ name: 'piece', format: '~root.playerSet.player2.pieceSet.$id' }));
        p2Intention.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        p2Intention.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        var p2PrevMove = player2.addChild(new Obj({ name: 'prevMove' }));
        p2PrevMove.addChild(new Ref({ name: 'piece', format: '~root.playerSet.player2.pieceSet.$id' }));
        p2PrevMove.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        p2PrevMove.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        outline.addChild(new Val({ name: 'startTime', dossClass: ds.DossierInt }));
        outline.addChild(new Val({ name: 'turnTime', dossClass: ds.DossierInt, defaultValue: (1000 * 10) })); // 10 seconds
        
        actionizer.recurse(outline);
        
      },
      genOutlineData: function() {
        
        /// {CLIENT=
        return {
          player: {
            ready: false,
            owned: null,
            enemy: null
          },
          playerSet: {
            player1: {
              pieceSet: {
                
              }
            },
            player2: {
              pieceSet: {
              }
            }
          },
          startTime: null,
          turnTime: (1000 * 10)
        };
        /// =CLIENT}
        
        /// {SERVER=
        return {
          playerSet: {
            player1: {
              pieceSet: {
                0: {
                  type: 'pawn',
                  col: 0,
                  row: 1
                },
                1: {
                  type: 'pawn',
                  col: 1,
                  row: 1
                },
                2: {
                  type: 'pawn',
                  col: 2,
                  row: 1
                },
                3: {
                  type: 'pawn',
                  col: 3,
                  row: 1
                },
                4: {
                  type: 'pawn',
                  col: 4,
                  row: 1
                },
                5: {
                  type: 'pawn',
                  col: 5,
                  row: 1
                },
                6: {
                  type: 'pawn',
                  col: 6,
                  row: 1
                },
                7: {
                  type: 'pawn',
                  col: 7,
                  row: 1
                },
                8: {
                  type: 'rook',
                  col: 0,
                  row: 0
                },
                9: {
                  type: 'knight',
                  col: 1,
                  row: 0
                },
                10: {
                  type: 'bishop',
                  col: 2,
                  row: 0
                },
                11: {
                  type: 'queen',
                  col: 3,
                  row: 0
                },
                12: {
                  type: 'king',
                  col: 4,
                  row: 0
                },
                13: {
                  type: 'bishop',
                  col: 5,
                  row: 0
                },
                14: {
                  type: 'knight',
                  col: 6,
                  row: 0
                },
                15: {
                  type: 'rook',
                  col: 7,
                  row: 0
                },
              }
            },
            player2: {
              pieceSet: {
                0: {
                  type: 'pawn',
                  col: 0,
                  row: 6
                },
                1: {
                  type: 'pawn',
                  col: 1,
                  row: 6
                },
                2: {
                  type: 'pawn',
                  col: 2,
                  row: 6
                },
                3: {
                  type: 'pawn',
                  col: 3,
                  row: 6
                },
                4: {
                  type: 'pawn',
                  col: 4,
                  row: 6
                },
                5: {
                  type: 'pawn',
                  col: 5,
                  row: 6
                },
                6: {
                  type: 'pawn',
                  col: 6,
                  row: 6
                },
                7: {
                  type: 'pawn',
                  col: 7,
                  row: 6
                },
                8: {
                  type: 'rook',
                  col: 0,
                  row: 7
                },
                9: {
                  type: 'knight',
                  col: 1,
                  row: 7
                },
                10: {
                  type: 'bishop',
                  col: 2,
                  row: 7
                },
                11: {
                  type: 'queen',
                  col: 3,
                  row: 7
                },
                12: {
                  type: 'king',
                  col: 4,
                  row: 7
                },
                13: {
                  type: 'bishop',
                  col: 5,
                  row: 7
                },
                14: {
                  type: 'knight',
                  col: 6,
                  row: 7
                },
                15: {
                  type: 'rook',
                  col: 7,
                  row: 7
                },
              }
            }
          },
          startTime: null,
          turnTime: (1000 * 10)
        };
        /// =SERVER}
        
      },
      setupDoss: function(doss) {
        
        /// {SERVER=
        var p1Intent = false;
        var p2Intent = false;
        
        new nf.CalculationInformer({
          dependencies: [
            doss.getChild('playerSet.player1.intention'),
            doss.getChild('playerSet.player2.intention')
          ],
          calc: function(p1Intent, p2Intent) {
            
            var p1Intent = doss.getChild('playerSet.player1.intention');
            var p2Intent = doss.getChild('playerSet.player2.intention');
            
            var p1Pc = p1Intent.getChild('@piece');
            var p2Pc = p2Intent.getChild('@piece');
            
            if (p1Pc && p2Pc) {
              
              doss.$useAbility('move', {
                data: {
                  p1: p1Intent.getJson(),
                  p2: p2Intent.getJson()
                },
                doSync: true
              }, null, {}).done();
              
            }
            
          }
        }).start();
        /// =SERVER}
        
      },
      /// {CLIENT=
      genView: function(doss) {
        
        var renderPiece = function(name, piece) {
          
          var type = piece.getChild('type');
          var classTypeDec = new uf.ClassDecorator({
            list: [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ],
            informer: type
          });
          var classSelDec = new uf.ClassDecorator({
            list: [ 'selected', 'unselected' ],
            informer: new nf.CalculationInformer({
              dependencies: [ doss.getChild('~root.player.selected') ],
              calc: function() {
                return doss.getChild('~root.player.@selected') === piece ? 'selected' : 'unselected';
              }
            })
          });
          var classCooldownDec = new uf.ClassDecorator({
            list: [ 'available', 'recovering' ],
            informer: new nf.CalculationInformer({
              dependencies: [ doss.getChild('turnCount'), piece.getChild('cooldown') ],
              calc: function(turnCount, cd) {
                return cd <= turnCount ? 'available' : 'recovering';
              }
            })
          });
          var positionDec = new uf.CssDecorator({
            list: [ 'left', 'bottom' ],
            informer: new nf.CalculationInformer({
              dependencies: [ piece.getChild('col'), piece.getChild('row') ],
              calc: function(col, row) {
                return {
                  left: (parseInt(col, 10) * 12.5) + '%',
                  bottom: (parseInt(row, 10) * 12.5) + '%'
                }
              }
            })
          });
          var iconInf = new nf.CalculationInformer({
            dependencies: [ piece.getChild('type') ],
            calc: function(type) {
              return ({ pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' })[type];
            }
          });
          var clickDec = new uf.ActionDecorator({
            $action: piece.as('$useAbility', 'select', { data: null, doSync: false })
          });
          
          return new uf.SetView({ name: name, cssClasses: [ 'piece' ], decorators: [ classTypeDec, classSelDec, classCooldownDec, positionDec, clickDec ], children: [
            new uf.TextView({ name: 'avatar', info: iconInf })
          ]});
          
        };
        
        return new uf.RootView({ name: 'root', children: [
          
          new uf.ChoiceView({ name: 'readyUp',
            choiceInfo: new nf.CalculationInformer({ 
              dependencies: [ doss.getChild('player.ready') ],
              calc: function(ready) { return ready ? 'game' : 'confirm' }
            }),
            children: [
          
              new uf.SetView({ name: 'confirm', children: [
                new uf.TextView({ name: 'button', info: 'enter', decorators: [
                  new uf.ActionDecorator({ $action: doss.as('$useAbility', 'ready', { data: null, doSync: true }) })
                ]})
              ]}),
              new uf.SetView({ name: 'game', children: [
                new uf.SetView({ name: 'board', numWrappers: 1,
                  decorators: [
                    new uf.ClassDecorator({
                      list: [ 'asWhite', 'asBlack' ],
                      informer: new nf.CalculationInformer({
                        dependencies: [ doss.getChild('player.owned') ],
                        calc: function(owned) {
                          if (owned === null) return null;
                          return ({ player1: 'asWhite', player2: 'asBlack' })[owned[0]];
                        }
                      })
                    }),
                    
                  ],
                  children: [
                   
                    new uf.SetView({ name: 'tiles', children: A.map(U.range({0:64}), function(n) {
                      
                      var row = Math.floor(n / 8);
                      var light = (n % 2) === (row % 2);
                      
                      return new uf.View({ name: 'tile' + n, cssClasses: [ 'tile', light ? 'light' : 'dark' ] });
                      
                    })}),
                    new uf.DynamicSetView({ name: 'p1Pieces', cssClasses: [ 'pieces' ],
                      decorators: [
                        new uf.ClassDecorator({
                          list: [ 'owned', 'enemy' ],
                          informer: new nf.CalculationInformer({
                            dependencies: [ doss.getChild('player.owned') ],
                            calc: function(owned) {
                              if (owned === null) return null;
                              return ({ player1: 'owned', player2: 'enemy' })[owned[0]];
                            }
                          })
                        })
                      ],
                      childInfo: 
                      new nf.CalculationInformer({
                        dependencies: [ doss.getChild('playerSet.player1.pieceSet') ],
                        calc: function(pieceData) {
                          return doss.getChild('playerSet.player1.pieceSet').getValue();
                        }
                      }),
                      
                      genChildView: renderPiece
                    }),
                    new uf.DynamicSetView({ name: 'p2Pieces', cssClasses: [ 'pieces' ],
                      decorators: [
                        new uf.ClassDecorator({
                          list: [ 'owned', 'enemy' ],
                          informer: new nf.CalculationInformer({
                            dependencies: [ doss.getChild('player.owned') ],
                            calc: function(owned) {
                              if (owned === null) return null;
                              return ({ player1: 'enemy', player2: 'owned' })[owned[0]];
                            }
                          })
                        })
                      ],
                      childInfo: doss.getChild('playerSet.player2.pieceSet'),
                      genChildView: renderPiece
                    }),
                    new uf.DynamicSetView({ name: 'moves',
                      decorators: [
                        new uf.ClassDecorator({
                          list: [ 'active', 'inactive' ],
                          informer: new nf.ValueInformer({ value: 'inactive' })
                        })
                      ],
                      childInfo: doss.getChild('player.moveSet'),
                      genChildView: function(name, move) {
                        
                        var col = move.getChild('col').getValue();
                        var row = move.getChild('row').getValue();
                        return new uf.View({ name: name, cssClasses: [ 'move' ],
                          decorators: [
                            new uf.CssDecorator({
                              list: [ 'left', 'bottom' ],
                              informer: new nf.ValueInformer({ value: {
                                left: (parseInt(col, 10) * 12.5) + '%',
                                bottom: (parseInt(row, 10) * 12.5) + '%'
                              }})
                            }),
                            new uf.ActionDecorator({
                              $action: doss.getChild('player.@owned.intention').as('$useAbility', 'mod', {
                                data: {
                                  piece: doss.getChild('player.@selected').getAddress(),
                                  col: col,
                                  row: row
                                },
                                doSync: true
                              })
                            })
                          ]
                        });
                        
                      }
                    }),
                    
                  ]
                }),
                new uf.ChoiceView({ name: 'info',
                  choiceInfo: new nf.CalculationInformer({
                    dependencies: [ doss.getChild('player.owned'), doss.getChild('playerSet.player1.intention'), doss.getChild('playerSet.player2.intention') ],
                    calc: function(owned, p1Intent, p2Intent) {
                      if (owned === null) return null;
                      var intent = ({ player1: p1Intent, player2: p2Intent })[owned[0]];
                      return intent.piece.getValue() ? 'waiting' : null;
                    }
                  }),
                  children: [
                    new uf.TextView({ name: 'waiting', info: 'Waiting for opponent...' })
                  ]
                })
              ]})
              
            ]
          })
          
        ]});
        
      }
      /// =CLIENT}
      
    }).$run().done();
    
  }
});
package.build();
