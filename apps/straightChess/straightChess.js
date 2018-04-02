var package = new PACK.pack.Package({ name: 'straightChess',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  buildFunc: function(straightChess) {
    
    straightChess.resources = {
      css: [
        'apps/straightChess/css/style.css',
        'apps/userify/css/substance.css'
      ]
    };
    
  },
  runAfter: function(straightChess, app, ds, nf, p, sv, uf) {
    
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
      return board[col][row] || null;
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
          
          var chk = checkTile(board, col0, row0);
          
          if (chk === 'OOB') continue;
          
          // If the move tile is empty, or occupied by the enemy, it's a valid move
          if (!chk || chk.player !== pc.player)
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
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, host: '192.168.1.148', port: 80, numToBank: 1 }));
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
        
        outline.addAbility('ready', actionizer.makeAbility('ready', function(doss, data, stager) {
          
          var session = stager.session;
          
          /// {SERVER=
          if (whiteSession === session)       { var playerColour = 'white'; }
          else if (blackSession === session)  { var playerColour = 'black'; }
          else if (whiteSession === null)     { whiteSession = session; var playerColour = 'white'; }
          else if (blackSession === null)     { blackSession = session; var playerColour = 'black'; }
          else                                { console.log('Session ' + session.ip + ' can GO SCREW HIM/HERSELF'); return; }
          
          console.log('ASSIGNING ' + playerColour.toUpperCase() + ' TO: ' + session.ip);
          
          stager(doss, 'assign', {
            data: { playerColour: playerColour },
            sync: 'quick',
            sessions: [ session ]
          });
          /// =SERVER}
          
        }));
        outline.addAbility('assign', actionizer.makeAbility('assign', function(doss, data, stager) {
          
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
            
            console.log('BAD PLAYER COLOUR??', playerColour);
            return;
            
          }
          
          stager(doss.getChild('~root.player.ready'), 'mod', { data: true });
          stager(doss.getChild('~root.player.owned'), 'mod', { data: owned });
          stager(doss.getChild('~root.player.enemy'), 'mod', { data: enemy });
          /// =CLIENT}
          
        }));
        outline.addAbility('move', actionizer.makeAbility('move', function(doss, data, stager) {
          
          // No `stager` calls in here sync... because this ability is meant to
          // originate with the server, and simultaneously execute on all clients
          // simultaneously
          
          var p1Mov = doss.getChild(data.p1.piece);
          var p1Cap = null;
          
          var p2Mov = doss.getChild(data.p2.piece);
          var p2Cap = null;
          
          if (data.p1.col === data.p2.col && data.p1.row === data.p2.row) {
            
            console.log('EXPLOOOODE');
            p1Cap = p2Mov;
            p2Cap = p1Mov;
            
          } else {
            
            // Detect the piece capture by player 1
            var p2Pcs = doss.getChild('playerSet.player2.pieceSet');
            for (var k in p2Pcs.children) {
              var pc = p2Pcs.children[k];
              var col = pc.getChild('col').getValue();
              var row = pc.getChild('row').getValue();
              if (col === data.p1.col && row === data.p1.row) { p1Cap = pc; break; }
            }
            
            // Detect the piece captured by player 2
            var p1Pcs = doss.getChild('playerSet.player1.pieceSet');
            for (var k in p1Pcs.children) {
              var pc = p1Pcs.children[k];
              var col = pc.getChild('col').getValue();
              var row = pc.getChild('row').getValue();
              if (col === data.p2.col && row === data.p2.row) { p2Cap = pc; break; }
            }
            
            // If the pieces tried to capture each other, no capture occurs
            if (p1Cap === p2Mov) p1Cap = null;
            if (p2Cap === p1Mov) p2Cap = null;
            
          }
          
          // Calculate whether a conclusion has occurred
          var p1Win = p1Cap && (p1Cap.getValue('type') === 'king');
          var p2Win = p2Cap && (p2Cap.getValue('type') === 'king');
          
          // Increase the turn count
          var turn = doss.getChild('turnCount').getValue();
          stager(doss.getChild('turnCount'), 'mod', { data: turn + 1 });
          
          // Move pieces
          stager(p1Mov, 'mod', { data: { col: data.p1.col, row: data.p1.row, cooldown: turn + 2 } });
          stager(p2Mov, 'mod', { data: { col: data.p2.col, row: data.p2.row, cooldown: turn + 2 } });
          
          // Remove captured pieces
          if (p1Cap) stager(p1Cap.par, 'rem', { data: p1Cap });
          if (p2Cap) stager(p2Cap.par, 'rem', { data: p2Cap });
          
          // Set intentions back to null
          stager(doss.getChild('playerSet.player1.intention'), 'mod', { data: { piece: null } });
          stager(doss.getChild('playerSet.player2.intention'), 'mod', { data: { piece: null } });
          
          /// {CLIENT=
          // Set moveset back to empty
          stager(doss.getChild('player.moveSet'), 'mod', { data: {} });
          
          // Set selection back to `null`
          stager(doss.getChild('player.selected'), 'mod', { data: {} });
          /// =CLIENT}
          
          // Set outcome if required
          if (p1Win || p2Win)
            stager(doss.getChild('outcome'), 'mod', { data: (p1Win && p2Win) ? 'draw' : (p1Win ? 'white' : 'black') });
          
        }));
        
        var turnCount = outline.addChild(new Val({ name: 'turnCount', dossClass: ds.DossierInt }));
        var outcome = outline.addChild(new Val({ name: 'outcome', defaultValue: 'undecided' }));
        
        /// {CLIENT=
        var player = outline.addChild(new Obj({ name: 'player' }));
        player.addChild(new Val({ name: 'ready', dossClass: ds.DossierBln, defaultValue: false }));
        player.addChild(new Ref({ name: 'owned', format: '~root.playerSet.$playerNum' }));
        player.addChild(new Ref({ name: 'enemy', format: '~root.playerSet.$playerNum' }));
        player.addChild(new Ref({ name: 'selected', format: '~root.playerSet.$playerNum.pieceSet.$id' }));
        
        var moveSet = player.addChild(new Arr({ name: 'moveSet' }));
        moveSet.setNameFunc(function(doss) {
          return 'col' + doss.getValue('col') + 'row' + doss.getValue('row');
        });
        var move = moveSet.setTemplate(new Obj({ name: 'move' }));
        move.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        move.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        /// =CLIENT}
        
        var playerSet = outline.addChild(new Obj({ name: 'playerSet' }));
        var player1 = playerSet.addChild(new Obj({ name: 'player1' }));
        var player2 = playerSet.addChild(new Obj({ name: 'player2' }));
        
        var piece = new Obj({ name: 'piece' });
        /// {CLIENT=
        piece.addAbility('select', actionizer.makeAbility('select', function(doss, data, stager) {
          
          //var selected = doss.getChild('~root.player.selected');
          //var moves = doss.getChild('~root.player.moveSet');
          
          var cooldown = doss.getChild('cooldown').getValue();
          var turnCount = doss.getChild('~root.turnCount').getValue();
          
          if (cooldown <= turnCount) {
          
            var col = doss.getChild('col').getValue();
            var row = doss.getChild('row').getValue();
            
            // TODO: So much work for the implementor! :(
            // It's needed because ~root.player.moveSet has a nameFunc. That nameFunc
            // can only work with an instance of Dossier, otherwise `actionizer.modArr`
            // will get confused about which children (being modded) it already has.
            // And there will probably be errors because `actionizer.modArr` passes an
            // explicit name to `Editor.prototype.add`, which will certainly conflict
            // with the name produced by `nameFunc` if the following logic isn't
            // implemented.
            // 
            // Basically we're repeating ourselves: exactly this logic
            // has already been written for Dosser(~root.playerSet.moveSet).nameFunc,
            // except there it needs to work with a Dossier and here it needs to work
            // with raw data.
            var moves = A.toObj(movesForPc(doss.getChild('~root'), col, row), function(data) {
              return 'col' + data.col + 'row' + data.row;
            });
            var selected = doss;
            
          } else {
            
            var moves = {};
            var selected = null;
            
          }
          
          stager(doss.getChild('~root.player.moveSet'), 'mod', { data: moves });
          stager(doss.getChild('~root.player.selected'), 'mod', { data: selected });
          
        }));
        /// =CLIENT}
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
        
        // P2
        var p2PieceSet = player2.addChild(new Arr({ name: 'pieceSet' }))
        p2PieceSet.setTemplate(piece);
        
        var p2Intention = player2.addChild(new Obj({ name: 'intention' }));
        p2Intention.addChild(new Ref({ name: 'piece', format: '~root.playerSet.player2.pieceSet.$id' }));
        p2Intention.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        p2Intention.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        outline.addChild(new Val({ name: 'startTime', dossClass: ds.DossierInt }));
        outline.addChild(new Val({ name: 'turnTime', dossClass: ds.DossierInt, defaultValue: (1000 * 10) })); // 10 seconds
        
        actionizer.recurse(outline);
        
      },
      genOutlineData: function() {
        
        /// {CLIENT=
        return {
          turnCount: 0,
          outcome: 'undecided',
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
        new nf.CalculationInformer({
          dependencies: [
            doss.getChild('playerSet.player1.intention.piece'),
            doss.getChild('playerSet.player2.intention.piece')
          ],
          calc: function() {
            
            var p1Intent = doss.getChild('playerSet.player1.intention');
            var p2Intent = doss.getChild('playerSet.player2.intention');
            
            var p1Pc = p1Intent.getChild('@piece');
            var p2Pc = p2Intent.getChild('@piece');
            
            if (p1Pc && p2Pc) {
              
              doss.$useAbility('move', {
                data: { p1: p1Intent.getJson(), p2: p2Intent.getJson() },
                sync: 'quick'
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
            $action: piece.as('$useAbility', 'select', { data: null, sync: 'none' })
          });
          
          return new uf.SetView({ name: name, cssClasses: [ 'piece' ], decorators: [ classTypeDec, classSelDec, classCooldownDec, positionDec, clickDec ], children: [
            new uf.TextView({ name: 'avatar', info: iconInf })
          ]});
          
        };
        
        return new uf.RootView({ name: 'root', children: [
          
          new uf.ChoiceView({ name: 'readyUp',
            choiceInfo: new nf.CalculationInformer({ 
              dependencies: [ doss.getChild('player.ready') ],
              calc: function(ready) {
                return ready ? 'game' : 'confirm';
              }
            }),
            children: [
          
              new uf.SetView({ name: 'confirm', children: [
                new uf.TextView({ name: 'button', info: 'enter', decorators: [
                  new uf.ActionDecorator({ $action: doss.as('$useAbility', 'ready', { data: null, sync: 'quick' }) })
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
                    new uf.DynamicSetView({ name: 'p1Pieces', transitionTime: 1500, cssClasses: [ 'pieces' ],
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
                      childInfo: doss.getChild('playerSet.player1.pieceSet'),
                      /*new nf.CalculationInformer({
                        dependencies: [ doss.getChild('playerSet.player1.pieceSet') ],
                        calc: function(pieceData) {
                          return doss.getChild('playerSet.player1.pieceSet').getValue();
                        }
                      }),*/
                      
                      genChildView: renderPiece
                    }),
                    new uf.DynamicSetView({ name: 'p2Pieces', transitionTime: 1500, cssClasses: [ 'pieces' ],
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
                                sync: 'quick'
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
                }),
                new uf.ChoiceView({ name: 'conclusion',
                  choiceInfo: doss.getChild('outcome'),
                  children: [
                    new uf.TextView({ name: 'undecided', info: 'no winner yet' }),
                    new uf.TextView({ name: 'draw', info: 'draw!' }),
                    new uf.TextView({ name: 'white', info: 'white wins!' }),
                    new uf.TextView({ name: 'black', info: 'black wins!' })
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
