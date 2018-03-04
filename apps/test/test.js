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
    
    // Ideally the Channeler could be set on the root Outline at it's declaration
    // This isn't possible because the root Doss is needed to declare the Channeler,
    // and the root Outline is needed first to declare the root Doss. Bad circle.
    
    // Initialize outline
    var outline = new ds.Outline({ name: 'test', c: ds.DossierObj });
    outline.addChild('val', ds.DossierStr);
    outline.channeler = null;
    
    var arr = outline.addChild('arr', ds.DossierArr, function(doss) {
      
      doss.addAbility('grow', function(session, channelerParams, editor, params /* doSync, data */) {
        
        var doSync = U.param(params, 'doSync');
        var data = U.param(params, 'data');
        
        editor.add({ par: doss, data: data });
        
        if (doSync) {
          
          editor.$transaction
            .then(doss.$giveOrder.bind(doss, { data: {
              address: doss.getAddress(),
              command: 'grow',
              params: { doSync: false, data: data }
            }}))
            .done();
          
        }
        
        return p.$null;
        
      });
      
    });
    arr.addDynamicChild('val', ds.DossierStr, { nameFunc: null });
    
    var obj = outline.addChild('obj', ds.DossierObj, function(doss) {
      
      doss.addAbility('validate', function(editor, params /* data */) {
        
        if (false) return new P({ err: new Error('Invalid') });
        return new P({ val: 'PAR VAL' });
        
      });
      
    });
    obj.addChild('val1', ds.DossierStr, function(doss) {
      
      doss.addAbility('mod', function(session, channelerParams, editor, params /* doSync, data, authParams */) {
        
        var doSync = U.param(params, 'doSync');
        var data = U.param(params, 'data');
        var authParams = U.param(params, 'authParams', {});
        
        // TODO: When many children of the same parent are all modified at once,
        // the parent will be repetitively asked to validate the exact same data.
        // Consider a caching solution on the parent: validate checks are cached
        // temporarily??
        return doss.par.$useAbility('validate', session, authParams).then(function(parVal) {
          
          editor.mod({ doss: doss, data: data });
          
          if (doSync) {
            
            // Do the sync, but don't wait for it to complete before declaring that the ability is complete
            console.log('Starting sync...');
            editor.$transaction
              .then(p.log('Transaction finished...'))
              .then(doss.$giveOrder.bind(doss, { data: {
                address: doss.getAddress(),
                command: 'mod',
                params: { doSync: false, data: data, authParams: authParams, val: Math.random() } // TODO: Unnecessary data sent across wire :(
              }}))
              .then(p.log('Sync COMPLETE'))
              .fail(p.log('Something FAILURE'))
              .done();
            
          }
          
          return p.$null;
          
        });
        
      });
      
    });
    obj.addChild('val2', ds.DossierStr);
    
    var objArr = outline.addChild('objarr', ds.DossierArr);
    var obj = objArr.addDynamicChild('obj', ds.DossierObj, { nameFunc: function(doss) { return doss.getValue('val1') + doss.getValue('val2'); } });
    obj.addChild('val1', ds.DossierStr);
    obj.addChild('val2', ds.DossierStr);
    
    var editor = new ds.Editor();
    var rootDoss = editor.add({ outline: outline, data: {
      
      val: 'hi',
      arr: {
        0: 'hi',
        1: 'hi'
      },
      obj: {
        val1: 'hi4',
        val2: 'hi'
      },
      objarr: {
        hi1hi2: {
          val1: 'hi1',
          val2: 'hi2'
        },
        hi3hi4: {
          val1: 'hi3',
          val2: 'hi4'
        }
      }
      
    }});
    
    editor.$transact().then(function() {
      
      var activities = [];
      
      var hostData = sv.getPhysicalHostData();
      
      // Initialize channeler
      outline.channeler = new sv.Channeler({ appName: 'test', handler: rootDoss });
      outline.channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, host: hostData.host, port: hostData.port, numToBank: 3 }));
      outline.channeler.$start()
        .then(function() { console.log('Ready'); })
        .fail(function(err) { console.error(err); })
        .done();
      
      activities.push(outline.channeler);
      
      /// {SERVER=
      
      // console.log(rootDoss.getData());
      
      /// =SERVER}
      
      /// {CLIENT=
      var view = new uf.RootView({ name: 'root',
        children: [
          new uf.TextView({ name: 'title', info: 'Test' }),
          new uf.SetView({ name: 'data', children: [
            
            // Simple text field
            new uf.TextEditView({ name: 'val', info: rootDoss.getChild('val'), cssClasses: [ 'control' ] }),
            
            // Array of text fields
            new uf.SetView({ name: 'dynarr', cssClasses: [ 'control' ], children: [
              
              new uf.DynamicSetView({ name: 'arr', childInfo: rootDoss.getChild('arr'), cssClasses: [ 'list' ],
                genChildView: function(name, info) {
                  
                  return new uf.SetView({ name: name, cssClasses: [ 'listItem' ], children: [
                    
                    new uf.TextEditView({ name: 'listItemContent', info: info }),
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
                    return rootDoss.getChild('arr').$useAbility('grow', outline.session || null, null, editor, { doSync: true, data: 'NEW' })
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
                  
                  new uf.TextEditView({ name: 'val1', info: info.getChild('val1') }),
                  new uf.TextEditView({ name: 'val2', info: info.getChild('val2') })
                  
                ]});
              }
            })
            
          ]})
        ],
        updateFunc: function() {
          
        }
      });
      view.start();
      
      activities.push(view);
      
      window.addEventListener('unload', A.each.use(activities, 'stop'), { capture: true });
      /// =CLIENT}
      
    }).done();
    
  }
  
});

package.build();
