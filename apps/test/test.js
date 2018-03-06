var package = new PACK.pack.Package({ name: 'test',
  /// {SERVER=
  dependencies: [ 'dossier', 'p', 'server', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'dossier', 'p', 'server', 'userify' ],
  /// =CLIENT}
  
  buildFunc: function(/* ... */) {
    
    var packageName = arguments[0];
    /// {SERVER=
    var ds = arguments[1];
    var p = arguments[2];
    var sv = arguments[4];
    var fr = arguments[5]
    /// =SERVER}
    /// {CLIENT=
    var ds = arguments[1];
    var p = arguments[2];
    var sv = arguments[4];
    var uf = arguments[3];
    /// =CLIENT}
    
    return {
      resources: {
        css: [
          'apps/' + packageName + '/css/style.css',
          'apps/userify/style.css'
        ]
      }
    };
    
  },
  runAfter: function(/* ... */) {
    
    var ts = arguments[0];
    /// {SERVER=
    var ds = arguments[1];
    var p = arguments[2];
    var sv = arguments[3];
    var fr = arguments[4]
    /// =SERVER}
    /// {CLIENT=
    var ds = arguments[1];
    var p = arguments[2];
    var sv = arguments[3];
    var uf = arguments[4];
    /// =CLIENT}
    
    var P = p.P;
    
    // Initialize activities
    var activities = [];
    
    /// {CLIENT=
    window.addEventListener('unload', A.each.use(activities, 'stop'), { capture: true });
    /// =CLIENT}
    
    // ==== Initialize channeler
    var channeler = new sv.Channeler({ appName: 'test', handler: rootDoss });
    channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
    channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
    channeler.$start()
      .then(function() { console.log('Channeler ready'); })
      .fail(function(err) { console.error(err); })
      .done();
    
    activities.push(channeler);
    
    // ==== Initialize actionizer
    var Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      
      init: function(params /* channeler */) {
        
        this.channeler = U.param(params, 'channeler');
        
      },
      addAbility: function(doss, name, act) {
        
        var channeler = this.channeler;
        
        doss.addAbility(name, function(session, channelerParams, editor, params /* doSync, data */) {
          
          // Perform whatever actions this ability ought to carry out
          var data = U.param(params, 'data');
          var $result = new P({ run: act.bind(null, editor, doss, data) });
          
          return $result.then(function() { // After `act` has run, prepare post-transaction to sync changes
            
            // When the editor transacts, sync any sessions as is necessary
            editor.$transaction
              .then(function() {
                
                // Determine which sessions need to be informed, and then inform them!
                
                /// {CLIENT=
                // Resolves a list containing either one or zero sessions. If `doSync` is true, will sync
                // the server session (the only session of which a client session is aware).
                var doSync = U.param(params, 'doSync');
                var sessionsToInform = doSync ? { server: null } : {}; // The only session a client can inform is the server session
                var commandParams = { data: data };
                /// =CLIENT}
                
                /// {SERVER=
                // If `session` is set, it means that this modification was spurred on by that session.
                // That session does not need to be informed of the change, as it's the source of the change.
                // Resolves a list of sessions; either ALL sessions, or all sessions excluding the source.
                var sessionsToInform = O.clone(channeler.sessionSet);
                if (session !== null) delete sessionsToInform[session.ip];
                var commandParams = { data: data, doSync: false };
                /// =SERVER}
                
                return new P({ all: O.map(sessionsToInform, function(sessionToInform) {
                  
                  return channeler.$giveCommand({
                    session: sessionToInform,
                    channelerParams: sessionToInform === session ? channelerParams : null,
                    data: {
                      address: doss.getAddress(),
                      command: name,
                      params: commandParams
                    }
                  });
                  
                })});
                
              })
              .fail(console.error.bind(console))
              .done();
            
          });
          
        });
        
      },
      basic: function(doss) {
        
        doss.addAbility('sync', function(session, channelerParams, editor, params /* */) {
          
          editor.$transaction.then(function() {
            
            /// {CLIENT=
            // The client side requests syncs
            return channeler.$giveCommand({
              session: null,
              channelerParams: channelerParams,
              data: {
                address: doss.getAddress(),
                command: 'sync',
                params: {}
              }
            });
            /// =CLIENT}
            
            /// {SERVER=
            // The server side provides syncs
            return channeler.$giveCommand({
              session: session,
              channelerParams: channelerParams,
              data: {
                address: doss.getAddress(),
                command: 'mod',
                params: { doSync: false, data: doss.getData() }
              }
            });
            /// =SERVER}
            
          });
          
        });
        
      },
      str: function(doss) {
        
        this.basic(doss);
        
        this.addAbility(doss, 'mod', function(editor, doss, data) {
          
          editor.mod({ doss: doss, data: data });
          
        });
        
        this.addAbility(doss, 'clear', function(editor, doss, data) {
          
          editor.mod({ doss: doss, data: '' });
          
        });
        
      },
      obj: function(doss) {
        
        this.basic(doss);
        
      },
      arr: function(doss) {
        
        this.basic(doss);
        
        this.addAbility(doss, 'add', function(editor, doss, data) {
          
          editor.add({ par: doss, data: data });
          
        });
        
        this.addAbility(doss, 'rem', function(editor, doss, data) {
          
          var childName = data;
          var child = doss.children[childName];
          editor.rem({ par: doss, child: child });
          
        });
        
        this.addAbility(doss, 'clear', function(editor, doss, data) {
          
          for (var k in doss.children) editor.rem({ par: doss, child: doss.children[k] });
          
        });
        
      }
      
    }}});
    var actionizer = new Actionizer({ channeler: channeler });
    
    // ==== Initialize outline
    var outline = new ds.Outline({ name: 'test', c: ds.DossierObj });
    outline.addChild('val', ds.DossierStr, function(doss) {
      
      actionizer.str(doss);
      
    });
    outline.channeler = channeler;
    
    var arr = outline.addChild('arr', ds.DossierArr, function(doss) {
      
      actionizer.arr(doss);
      
    });
    arr.addDynamicChild('val', ds.DossierStr, null,
      function(doss) {
        
        return actionizer.str(doss);
        
      });
    
    var obj = outline.addChild('obj', ds.DossierObj);
    obj.addChild('val1', ds.DossierStr, function(doss) {
      
      actionizer.str(doss);
      
    });
    obj.addChild('val2', ds.DossierStr, function(doss) {
      
      actionizer.str(doss);
      
    });
    
    var objArr = outline.addChild('objarr', ds.DossierArr);
    var obj = objArr.addDynamicChild('obj', ds.DossierObj,
      function(doss) { return doss.getValue('val1') + doss.getValue('val2'); },
      function() {
        
      });
    obj.addChild('val1', ds.DossierStr);
    obj.addChild('val2', ds.DossierStr);
    
    var editor = new ds.Editor();
    var rootDoss = editor.add({ outline: outline, data: {
      
      val: 'val',
      arr: {
        0: 'arr0',
        1: 'arr1'
      },
      obj: {
        val1: 'obj1',
        val2: 'obj2'
      },
      objarr: {
        objarr1objarr2: {
          val1: 'objarr1',
          val2: 'objarr2'
        },
        objarr3objarr4: {
          val1: 'objarr3',
          val2: 'objarr4'
        }
      }
      
    }});
    channeler.handler = rootDoss; // Assign this Dossier as the Channeler's handler
    
    /// {CLIENT=
    // ==== Initialize view
    var viewFunc = function() {
      
      var view = new uf.RootView({ name: 'root',
        children: [
          new uf.TextView({ name: 'title', info: 'Test' }),
          new uf.SetView({ name: 'data', children: [
            
            // Simple text field
            new uf.TextEditView({ name: 'val', info: rootDoss.getChild('val').genAbilityFact(null, 'mod'), cssClasses: [ 'control' ] }),
            
            // Array of text fields
            new uf.SetView({ name: 'dynarr', cssClasses: [ 'control' ], children: [
              
              new uf.DynamicSetView({ name: 'arr', childInfo: rootDoss.getChild('arr'), cssClasses: [ 'list' ],
                genChildView: function(name, info) {
                  
                  return new uf.SetView({ name: name, cssClasses: [ 'listItem' ], children: [
                    
                    new uf.TextEditView({ name: 'listItemContent', info: info.genAbilityFact(null, 'mod') }),
                    new uf.SetView({ name: 'listItemControls', children: [
                      
                      new uf.TextView({ name: 'delete', info: '-', cssClasses: [ 'listItemControl', 'uiButton' ], decorators: [
                        
                        new uf.ActionDecorator({ $action: function() {
                          console.log('Delete:', info);
                          return p.$null;
                        }})
                        
                      ]})
                      
                    ]})
                    
                  ]});
                  
                }
              }),
              new uf.SetView({ name: 'controls', children: [
                
                new uf.TextView({ name: 'add', info: '+', cssClasses: [ 'uiButton' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    return rootDoss.getChild('arr').$useAbility('add', outline.session || null, null, editor, { doSync: true, data: 'NEW' })
                      .then(function() {
                        return editor.$transact();
                      });
                    
                  }})
                ]})
                
              ]})
              
            ]}),
            
            // Object containing 2 text fields
            new uf.SetView({ name: 'obj', cssClasses: [ 'control' ], children: [
              
              new uf.TextEditView({ name: 'val1', info: rootDoss.getChild('obj.val1').genAbilityFact(null, 'mod') }),
              new uf.TextEditView({ name: 'val2', info: rootDoss.getChild('obj.val2').genAbilityFact(null, 'mod') })
              
            ]}),
            
            // Array containings objects, each of which contains 2 text fields
            new uf.DynamicSetView({ name: 'objarr', childInfo: rootDoss.getChild('objarr'), cssClasses: [ 'control' ],
              genChildView: function(name, info) {
                return new uf.SetView({ name: name, children: [
                  
                  new uf.TextEditView({ name: 'val1', info: info.getChild('val1').genAbilityFact(null, 'mod') }),
                  new uf.TextEditView({ name: 'val2', info: info.getChild('val2').genAbilityFact(null, 'mod') })
                  
                ]});
              }
            })
            
          ]})
        ],
        updateFunc: function() {
          
        }
      });
      
      activities.push(view);
      
      return view;
      
    };
    
    /// =CLIENT}
    
    editor.$transact().then(function() {
      
      /// {CLIENT=
      viewFunc().start();
      /// =CLIENT}
      
    }).done();
    
  }
  
});

package.build();
