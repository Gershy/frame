var package = new PACK.pack.Package({ name: 'straightChess',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  buildFunc: function(pack /* ... */) {
    
    pack.resources = {
      css: [
        'apps/straightChess/css/style.css',
        'apps/userify/css/substance.css'
      ]
    };
    
  },
  runAfter: function(jb, app, ds, nf, p, sv, uf) {
    
    var P = p.P;
    var App = app.App;
    
    new App({ name: 'straightChess',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(outline, actionizer) {
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        var playerSet = outline.addChild(new Obj({ name: 'playerSet' }));
        var player1 = playerSet.addChild(new Obj({ name: 'player1' }));
        var player2 = playerSet.addChild(new Obj({ name: 'player2' }));
        
        var pieceTemplate = new Obj({ name: 'piece' });
        pieceTemplate.addChild(new Val({ name: 'type' }));
        pieceTemplate.addChild(new Val({ name: 'col', dossClass: ds.DossierInt }));
        pieceTemplate.addChild(new Val({ name: 'row', dossClass: ds.DossierInt }));
        
        player1.addChild(new Arr({ name: 'pieceSet' })).setTemplate(pieceTemplate);
        player2.addChild(new Arr({ name: 'pieceSet' })).setTemplate(pieceTemplate);
        
        outline.addChild(new Val({ name: 'startTime', dossClass: ds.DossierInt }));
        outline.addChild(new Val({ name: 'turnTime', dossClass: ds.DossierInt, defaultValue: (1000 * 10) })); // 10 seconds
        
        actionizer.recurse(outline);
        
      },
      genOutlineData: function() {
        
        /// {CLIENT=
        return {
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
      /// {CLIENT=
      genView: function(doss) {
        
        var renderPiece = function(name, piece) {
          
          console.log('GEN:', name, piece);
          
          var type = piece.getChild('type');
          var classDec = new uf.ClassDecorator({
            list: [ 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king' ],
            informer: type
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
          
          return new uf.SetView({ name: name, cssClasses: [ 'piece' ], decorators: [ classDec, positionDec ], children: [
            new uf.TextView({ name: 'avatar', info: iconInf })
          ]});
          
        };
        
        return new uf.RootView({ name: 'root', children: [
          
          new uf.SetView({ name: 'board', numWrappers: 1, children: [
           
            new uf.SetView({ name: 'tiles', children: A.map(U.range({0:64}), function(n) {
              
              var row = Math.floor(n / 8);
              var light = (n % 2) === (row % 2);
              
              return new uf.View({ name: 'tile' + n, cssClasses: [ 'tile', light ? 'light' : 'dark' ] });
              
            })}),
            
            new uf.DynamicSetView({ name: 'p1Pieces', cssClasses: [ 'pieces' ], childInfo: doss.getChild('playerSet.player1.pieceSet'), genChildView: renderPiece }),
            new uf.DynamicSetView({ name: 'p2Pieces', cssClasses: [ 'pieces' ], childInfo: doss.getChild('playerSet.player2.pieceSet'), genChildView: renderPiece })
            
          ]})
          
        ]});
        
      }
      /// =CLIENT}
    }).$run().done();
    
  }
});
package.build();
