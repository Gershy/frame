// TODO: Outline and View definition is incredibly ugly.
// The best solution is probably XML parsing (consider high impact on client-side?)

/*
- Formalize syncing
  - Abilities should be on Outline
- Formalize Activities
- "Hovering" Dossiers?
- Ensure that there are no more per-frame updates
- Formalize an entire application (e.g. it consists of Actionizer, Channeler+Channels, Outline, Versioner, etc.)
- Go write something amazing (Lapse? Blindspot?)
*/

/// {CLIENT=
var old = console.error.bind(console);
console.error = function(err) {
  old(err.message);
  old(err.stack);
};
/// =CLIENT}

var package = new PACK.pack.Package({ name: 'jsonBuilder',
  /// {SERVER=
  dependencies: [ 'dossier', 'informer', 'p', 'server', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  
  buildFunc: function(/* ... */) {
    
    var packageName = arguments[0];
    /// {SERVER=
    var ds = arguments[1];
    var nf = arguments[2];
    var p = arguments[3];
    var sv = arguments[4];
    var fr = arguments[5]
    /// =SERVER}
    /// {CLIENT=
    var ds = arguments[1];
    var nf = arguments[2];
    var p = arguments[3];
    var sv = arguments[4];
    var uf = arguments[5];
    /// =CLIENT}
    
    return {
      resources: {
        css: [
          'apps/jsonBuilder/css/style.css',
          'apps/userify/css/substance.css'
        ]
      }
    };
    
  },
  runAfter: function(/* ... */) {
    
    var ts = arguments[0];
    /// {SERVER=
    var ds = arguments[1];
    var nf = arguments[2];
    var p = arguments[3];
    var sv = arguments[4];
    var fr = arguments[5]
    /// =SERVER}
    /// {CLIENT=
    var ds = arguments[1];
    var nf = arguments[2];
    var p = arguments[3];
    var sv = arguments[4];
    var uf = arguments[5];
    /// =CLIENT}
    
    var P = p.P;
    
    // ==== Initialize activities (TODO: This needs a class and potentially package)
    var activities = [];
    
    /// {CLIENT=
    window.addEventListener('unload', A.each.use(activities, 'stop'), { capture: true });
    /// =CLIENT}
    
    // ==== Initialize channeler
    var channeler = new sv.Channeler({ appName: 'jsonBuilder', handler: rootDoss });
    channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
    channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
    
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
                
                /// {SERVER=
                // If `session` is set, it means that this modification was spurred on by that session.
                // That session does not need to be informed of the change, as it's the source of the change.
                // Resolves a list of sessions; either ALL sessions, or all sessions excluding the source.
                var sessionsToInform = O.clone(channeler.sessionSet);
                if (session !== null) delete sessionsToInform[session.ip];
                var commandParams = { data: data, doSync: false };
                
                //console.log('Server syncing: [ ' + Object.keys(sessionsToInform).join(', ') + ' ]');
                /// =SERVER}
                
                /// {CLIENT=
                // Resolves a list containing either one or zero sessions. If `doSync` is true, will sync
                // the server session (the only session of which a client session is aware).
                var doSync = U.param(params, 'doSync');
                var sessionsToInform = doSync ? { server: null } : {}; // The only session a client can inform is the server session
                var commandParams = { data: data };
                
                //if (doSync) console.log('Syncing server...');
                /// =CLIENT}
                
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
          
          // Attach a sync action to occur when the `editor` is done (but don't wait for this!)
          editor.$transaction.then(function() {
            
            /// {CLIENT=
            // The client side requests syncs
            var command = 'sync';
            var params = {};
            /// =CLIENT}
            
            /// {SERVER=
            // The server side issues mods
            var command = 'mod';
            var params = { doSync: false, data: doss.getData() };
            /// =SERVER}
            
            return channeler.$giveCommand({
              session: session,
              channelerParams: channelerParams,
              data: {
                address: doss.getAddress(),
                command: command,
                params: params
              }
            });
            
          }).done();
          
          return p.$null;
          
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
      num: function(doss) {
        
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
        
        this.addAbility(doss, 'mod', function(editor, doss, data) {
          
          console.log('Mod not implemented ;D');
          
          // TODO: It's not nearly this easy!!
          // Modifying an object results in many removed, added, and modified children.
          // editor.mod({ doss: doss, data: data });
          
        });
        
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
        
      },
      ref: function(doss) {
        
        this.basic(doss);
        
      }
      
    }}});
    var actionizer = new Actionizer({ channeler: channeler });
    
    // ==== Initialize outline
    var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
    
    var outline = new Obj({ name: 'jsonBuilder' });
    
    var typeSet = outline.addChild(new Obj({ name: 'typeSet' }));
    
    // String type
    var stringSet = typeSet.addChild(new Arr({ name: 'stringSet' }));
    var string = stringSet.setTemplate(new Obj({ name: 'string' }), null);
    string.addChild(new Val({ name: 'value', defaultValue: '' }));
    
    // Object type
    var objectSet = typeSet.addChild(new Arr({ name: 'objectSet' }));
    var object = objectSet.setTemplate(new Obj({ name: 'object' }));
    var pairSet = object.addChild(new Arr({ name: 'pairSet' }));
    var pair = pairSet.setTemplate(new Obj({ name: 'pair' }));
    pair.addChild(new Val({ name: 'key' }));
    pair.addChild(new Ref({ name: 'val', format: '~root.itemSet.$id' }));
    /// {CLIENT=
    object.addChild(new Val({ name: 'folded', dossClass: ds.DossierBln, defaultValue: false }));
    /// =CLIENT}
    
    // Array type
    var arraySet = typeSet.addChild(new Arr({ name: 'arraySet' }));
    var array = arraySet.setTemplate(new Obj({ name: 'array' }));
    var indexSet = array.addChild(new Arr({ name: 'indexSet' }));
    var index = indexSet.setTemplate(new Ref({ name: 'index', format: '~root.itemSet.$id' }));
    /// {CLIENT=
    array.addChild(new Val({ name: 'folded', dossClass: ds.DossierBln, defaultValue: false }));
    /// =CLIENT}
    
    var itemSet = outline.addChild(new Arr({ name: 'itemSet' }));
    itemSet.setTemplate(new Ref({ name: 'item', format: '~root.typeSet.$type.$id' }));
    
    var render = outline.addChild(new Ref({ name: 'render', format: '~root.itemSet.$id' }));
    
    // TODO: The following the should be implemented via abilities
    var remItem = function(editor, item) {
      
      var type = item.getChild('@');
      
      editor.rem({ child: item });
      editor.rem({ child: type });
      
      if (type.outline.name === 'object') {
        
        var pairSet = type.getChild('pairSet');
        for (var k in pairSet.children) {
          remItem(editor, pairSet.children[k].getChild('@val'));
        }
        
      } else if (type.outline.name === 'array') {
        
        var indexSet = type.getChild('indexSet');
        for (var k in indexSet.children) {
          remItem(editor, indexSet.children[k].getChild('@'));
        }
        
      }
      
    };
    var exportJson = function(type) {
      
      if (type.outline.name === 'string') {
        
        return type.getValue('value');
        
      } else if (type.outline.name === 'object') {
        
        var ret = {};
        var pairSet = type.getChild('pairSet');
        for (var k in pairSet.children) {
          var pair = pairSet.children[k];
          var key = pair.getChild('key');
          var val = exportJson(pair.getChild('@@val')); // @val is an item (DossierRef), @@val is the type pointed at by the item
        }
        return ret;
        
      } else if (type.outline.name === 'array') {
        
        var ret = [];
        var indexSet = type.getChild('indexSet');
        for (var k in indexSet.children) {
          var index = indexSet.children[k];
          ret.push(exportJson(index.getChild('@@'))); // index.getChild('@') is an item (DossierRef), index.getChild('@@') is the type it points to
        }
        
      }
      
      throw new Error('Unsupported type: ', type.outline.name);
      
    };
    var importJson = function(editor, item, json) {
      // TODO
    };
    
    // ==== Initialize rootDoss
    var editor = new ds.Editor();
    var rootDoss = editor.add({ outline: outline, data: {
      /// {REMOVE=
      typeSet: {},
      itemSet: {},
      render: null
      /// =REMOVE}
      /// {S/ERVER=
      typeSet: {
        
        stringSet: {
          0: {
            value: 'val'
          }
        },
        
        objectSet: {
          0: {
            pairSet: {
              0: {
                key: 'key',
                val: '~root.itemSet.0'
              }
            }
          }
        },
        
        arraySet: {
        }
        
      },
        
      itemSet: {
        0: '~root.typeSet.stringSet.0',
        1: '~root.typeSet.objectSet.0'
      },
      
      render: '~root.itemSet.1'
      /// =S/ERVER}
    }});
    channeler.handler = rootDoss; // Assign this Dossier as the Channeler's handler
    
    /// {CLIENT=
    // ==== Initialize view
    
    var viewFunc = function() {
      
      var hoverFlash = new uf.HoverDecorator({ includeDepth: 3 });
      
      var renderer = function(name, itemDoss) {
        
        if (!itemDoss) throw new Error('BAD');
        
        var childInfo = function() {
          // Returns a list containing a single value: the "item" to render
          var ret = {};
          ret[itemDoss.name] = itemDoss;
          return ret;
        };
        
        return new uf.DynamicSetView({ name: name, childInfo: childInfo, classList: [ 'renderer' ], genChildView: function(name, info) {
          
          var setType = info.value ? info.value[0] : null;
          
          if (setType === 'stringSet') {
            
            var view = new uf.TextEditView({ name: name, info: info.getChild('@.value') })
            
          } else if (setType === 'objectSet') {
            
            var foldedInf = new ds.DossierInformer({ doss: info.getChild('@.folded') });
            var toggleFold = new uf.ActionDecorator({ action: foldedInf.modValue.bind(foldedInf, function(f) { return !f; }) });
            var applyFold = new uf.ClassDecorator({
              list: [ 'open', 'closed' ],
              informer: new nf.CalculationInformer({
                dependencies: [ foldedInf ],
                calc: function(folded) { return folded ? 'closed' : 'open'; }
              })
            });
            
            var view = new uf.SetView({ name: name, decorators: [ applyFold, hoverFlash ], children: [
              
              new uf.TextView({ name: 'lb', info: '{', decorators: [ toggleFold ] }),
              
              new uf.DynamicSetView({ name: 'pairSet', childInfo: info.getChild('@.pairSet'), genChildView: function(name, info) {
                
                return new uf.SetView({ name: name, cssClasses: [ 'pair' ], children: [
                  
                  new uf.TextEditView({ name: 'key', info: info.getChild('key') }),
                  
                  new uf.TextView({ name: 'sep', info: ':' }),
                  
                  renderer('val', info.getChild('@val')),
                  
                  // Pair controls
                  new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                    
                    new uf.ActionDecorator({ $action: function() {
                      
                      var pair = info;
                      var item = pair.getChild('@val');
                      var type = item.getChild('@');
                      
                      var editor = new ds.Editor();
                      editor.rem({ child: pair });
                      remItem(editor, item);
                      
                      return editor.$transact();
                      
                    }})
                    
                  ]})
                  
                ]})
                
              }}),
              
              new uf.TextView({ name: 'rb', info: '}', decorators: [ toggleFold ] }),
              
              new uf.SetView({ name: 'controls', children: [
                
                new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newString = editor.add({ par: rootDoss.getChild('typeSet.stringSet'), data: { value: 'val' } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newString });
                    var newPair = editor.add({ par: info.getChild('@.pairSet'), data: { key: 'str', val: newItem } });
                    return editor.$transact();
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newObject = editor.add({ par: rootDoss.getChild('typeSet.objectSet'), data: { pairSet: {} } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newObject });
                    var newPair = editor.add({ par: info.getChild('@.pairSet'), data: { key: 'obj', val: newItem } });
                    return editor.$transact();
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newArray = editor.add({ par: rootDoss.getChild('typeSet.arraySet'), data: { indexSet: {} } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newArray });
                    var newPair = editor.add({ par: info.getChild('@.pairSet'), data: { key: 'arr', val: newItem } });
                    return editor.$transact();
                    
                  }})
                ]})
                
              ]})
              
            ]});
            
          } else if (setType === 'arraySet') {
            
            var foldedInf = new ds.DossierInformer({ doss: info.getChild('@.folded') });
            var toggleFold = new uf.ActionDecorator({ action: foldedInf.modValue.bind(foldedInf, function(f) { return !f; }) });
            var applyFold = new uf.ClassDecorator({
              list: [ 'open', 'closed' ],
              informer: new nf.CalculationInformer({
                dependencies: [ foldedInf ],
                calc: function(folded) { return folded ? 'closed' : 'open'; }
              })
            });
            
            var view = new uf.SetView({ name: name, decorators: [ applyFold, hoverFlash ], children: [
              
              new uf.TextView({ name: 'lb', info: '[', decorators: [ toggleFold ] }),
              
              new uf.DynamicSetView({ name: 'indexSet', childInfo: info.getChild('@.indexSet'), genChildView: function(name, info) {
                
                return new uf.SetView({ name: name, cssClasses: [ 'index' ], children: [
                  
                  renderer('val', info.getChild('@')),
                  
                  // Index controls
                  new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                    
                    new uf.ActionDecorator({ $action: function() {
                      
                      var index = info;
                      var item = index.getChild('@');
                      
                      var editor = new ds.Editor();
                      editor.rem({ child: index });
                      remItem(editor, item);
                      
                      return editor.$transact();
                      
                    }})
                    
                  ]})
                  
                ]});
                
              }}),
              
              new uf.TextView({ name: 'rb', info: ']', decorators: [ toggleFold ] }),
              
              new uf.SetView({ name: 'controls', children: [
                
                new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newString = editor.add({ par: rootDoss.getChild('typeSet.stringSet'), data: { value: 'val' } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newString });
                    var newIndex = editor.add({ par: info.getChild('@.indexSet'), data: newItem });
                    return editor.$transact();
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newObject = editor.add({ par: rootDoss.getChild('typeSet.objectSet'), data: { pairSet: {} } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newObject });
                    var newIndex = editor.add({ par: info.getChild('@.indexSet'), data: newItem });
                    return editor.$transact();
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    var editor = new ds.Editor();
                    var newArray = editor.add({ par: rootDoss.getChild('typeSet.arraySet'), data: { indexSet: {} } });
                    var newItem = editor.add({ par: rootDoss.getChild('itemSet'), data: newArray });
                    var newIndex = editor.add({ par: info.getChild('@.indexSet'), data: newItem });
                    return editor.$transact();
                    
                  }})
                ]})
                
              ]})
              
            ]});
            
          }
          
          view.cssClasses = [ 'item', setType.substr(0, setType.length - 3) ];
          
          return view;
          
        }});
        
      };
      
      var compactness = new nf.ValueInformer({ value: 'vertCompact' });
      var toggleCompactness = new uf.ActionDecorator({ $action: function() {
        
        compactness.modValue(function(compact) { return compact === 'horzCompact' ? 'vertCompact' : 'horzCompact'; });
        return p.$null;
        
      }});
      var applyCompactness = new uf.ClassDecorator({
        list: [ 'horzCompact', 'vertCompact' ],
        informer: compactness
      });
            
      var view = new uf.RootView({ name: 'root',
        children: [
          new uf.TextView({ name: 'title', info: 'json', decorators: [ toggleCompactness ] }),
          new uf.SetView({ name: 'render', decorators: [ applyCompactness ], children: [
            
            renderer('main', rootDoss.getChild('@render'))
            
          ]})
        ],
        updateFunc: function(){}
      });
      
      window.doss = rootDoss;
      window.view = view;
      activities.push(view);
      return view;
      
    };
    /// =CLIENT}
    
    editor.$transact()
      .then(function() { console.log('TRANSACTED'); return channeler.$start(); }) // Start the channeler once `rootDoss` is ready
      /// {CLIENT=
      .then(function() {
        
        // return rootDoss.$useAbility('sync');
        
      })
      .then(function() {
        
        viewFunc().start();
        
      })
      /// =CLIENT}
      .done();
    
  }
  
});

package.build();
