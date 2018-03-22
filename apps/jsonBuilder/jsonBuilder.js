// TODO: Outline and View definition is incredibly ugly.
// The best solution is probably XML parsing (consider high impact on client-side?)

// TODO: Don't need start/stop for Dossiers, but how about a final "validate" atomic?
// E.g. without recurseObj, it's possible for DossierObjs to wind up missing some
// children defined in their Outline. The implementation should avoid this, but
// Dossiers should validate to FORCE the implementation to behave well

// TODO: Distinguish between locally and globally invalidated? E.g. if a purely-client-side value changes,
// the View layout is invalidated and needs to recalculated BUT globally no invalidation has occurred.
// Local invalidations are wired into the local View
// Global invalidations update the server
// HOW BOUT DAT?

// TODO: Informers should be able to prevent invalidation when the value being set is already
// the value being held

/*

************************************************
- Go write something amazing (Lapse? Blindspot?)
************************************************

- "Hovering" Dossiers (although tricky - since Dossiers are Informers they have to persist when they have usages)
- Persistence
- Reduce file sizes

*/

var package = new PACK.pack.Package({ name: 'jsonBuilder',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  
  buildFunc: function(pack /* ... */) {
    
    pack.resources = {
      css: [
        'apps/jsonBuilder/css/style.css',
        'apps/userify/css/substance.css'
      ]
    };
    
  },
  runAfter: function(jb, app, ds, nf, p, sv, uf) {
    
    var P = p.P;
    var App = app.App;
    
    new App({ name: 'jsonBuilder',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
        // TODO: Nothing for now...
      },
      setupOutline: function(outline, actionizer) {
        
        // ==== Initialize outline
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        /* TODO: Maybe this heirarchical definition is nice??
        var outline = new Obj({ name: 'jsonBuilder', abilities: { sync: actionizer.sync }})
          .addChildren([
            
            new Obj({ name: 'typeSet' })
              .addChildren([
                
                new Arr({ name: 'stringSet' })
                  .addTemplate([
                    
                    new Obj({ name: 'string' })
                      .addChildren([
                        
                        new Val({ name: 'value', defaultValue: '' })
                        
                      ])
                    
                  ])
                
                new Arr({ name: 'objectSet'
                
              ])
          
          
          ]);*/
        
        /* TODO: Another idea? Although it doesn't allow for defining abilities on Obj or Arr...
        var outline = ds.parseOutline('jsonBuilder', {
          
          typeSet: {
            stringSet: [
              {
                value: {
                  cls: ds.DossierStr,
                  abilities: {}
                }
              },
              null
            ],
            objectSet: [
              {
                pairSet: [
                  {
                    key: {
                      cls: ds.DossierStr,
                      abilities: {}
                    },
                    val: {
                      cls: ds.DossierRef,
                      format: '~root.itemSet.$id',
                      abilities: {}
                    }
                  }
                ]
              },
              null
            ],
            arraySet: [
              {
                indexSet: [
                  {
                    index: {
                      cls: ds.DossierRef,
                      format: '~root.itemSet.$id',
                      abilities: {}
                    }
                  },
                  null
                ]
              },
              null
            ]
          },
          
          itemSet: [
            {
              cls: ds.DossierRef,
              format: '~root.typeSet.$type.$id',
              abilities: {}
            },
            null
          ],
          
          render: {
            cls: ds.DossierRef,
            format: '~root.itemSet.$id',
            abilities: {
            }
          }
          
        });
        */
        
        // Type set
        var typeSet = outline.addChild(new Obj({ name: 'typeSet' }));
        
        // String type
        var stringSet = typeSet.addChild(new Arr({ name: 'stringSet' }));
        var string = stringSet.setTemplate(new Obj({ name: 'string', abilities: {
          jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data) {
            
            editor.rem({ child: doss });
            
          })
        }}));
        string.addChild(new Val({ name: 'value', defaultValue: '' }));
        
        // Object type
        var objectSet = typeSet.addChild(new Arr({ name: 'objectSet' }));
        var object = objectSet.setTemplate(new Obj({ name: 'object', abilities: {
          jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data, session, channelerParams) {
            
            editor.rem({ child: doss });
            
            var pairSet = doss.getChild('pairSet');
            return new P({ all: O.map(pairSet.children, function(pair) {
              return pair.getChild('@val').$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
            })});
            
          })
        }}));
        var pairSet = object.addChild(new Arr({ name: 'pairSet', abilities: {
          addObj: actionizer.makeAbility('addObj', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.objectSet'), data: { pairSet: {} } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newPair = editor.add({ par: doss, data: { key: 'obj', val: newItem } });
            
          }),
          addArr: actionizer.makeAbility('addArr', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.arraySet'), data: { indexSet: {} } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newPair = editor.add({ par: doss, data: { key: 'arr', val: newItem } });
            
          }),
          addStr: actionizer.makeAbility('addStr', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.stringSet'), data: { value: 'str' } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newPair = editor.add({ par: doss, data: { key: 'str', val: newItem } });
            
          }),
          jsonRemChild: actionizer.makeAbility('jsonRemChild', true, function(editor, doss, data, session, channelerParams) {
            
            var childName = U.param(data, 'childName');
            
            var pair = doss.getChild(childName);
            var item = pair.getChild('@val');
            
            editor.rem({ child: pair });
            return item.$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
            
          })
        }}));
        var pair = pairSet.setTemplate(new Obj({ name: 'pair' }));
        pair.addChild(new Val({ name: 'key' }));
        pair.addChild(new Ref({ name: 'val', format: '~root.itemSet.$id' }));
        /// {CLIENT=
        object.addChild(new Val({ name: 'folded', dossClass: ds.DossierBln, defaultValue: false }));
        /// =CLIENT}
        
        // Array type
        var arraySet = typeSet.addChild(new Arr({ name: 'arraySet' }));
        var array = arraySet.setTemplate(new Obj({ name: 'array', abilities: {
          jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data, session, channelerParams) {
            
            editor.rem({ child: doss });
            
            var indexSet = doss.getChild('indexSet');
            return new P({ all: O.map(indexSet.children, function(index) {
              return index.getChild('@').$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
            })});
            
          })
        }}));
        var indexSet = array.addChild(new Arr({ name: 'indexSet', abilities: {
          addObj: actionizer.makeAbility('addObj', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.objectSet'), data: { pairSet: {} } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newIndex = editor.add({ par: doss, data: newItem });
            
          }),
          addArr: actionizer.makeAbility('addArr', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.arraySet'), data: { indexSet: {} } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newIndex = editor.add({ par: doss, data: newItem });
            
          }),
          addStr: actionizer.makeAbility('addStr', true, function(editor, doss, data) {
            
            var newObj = editor.add({ par: doss.getChild('~root.typeSet.stringSet'), data: { value: 'str' } });
            var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
            var newIndex = editor.add({ par: doss, data: newItem });
            
          }),
          jsonRemChild: actionizer.makeAbility('jsonRemChild', true, function(editor, doss, data, session, channelerParams) {
            
            var childName = U.param(data, 'childName');
            
            var index = doss.getChild(childName);
            var item = index.getChild('@');
            
            editor.rem({ child: index });
            return item.$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
            
          })
        }}));
        var index = indexSet.setTemplate(new Ref({ name: 'index', format: '~root.itemSet.$id' }));
        /// {CLIENT=
        array.addChild(new Val({ name: 'folded', dossClass: ds.DossierBln, defaultValue: false }));
        /// =CLIENT}
        
        var itemSet = outline.addChild(new Arr({ name: 'itemSet' }));
        itemSet.setTemplate(new Ref({ name: 'item', format: '~root.typeSet.$type.$id', abilities: {
          jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data, session, channelerParams) {
            
            editor.rem({ child: doss });
            return doss.getChild('@').$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
            
          })
        }}));
        
        var render = outline.addChild(new Ref({ name: 'render', format: '~root.itemSet.$id' }));
        
        actionizer.recurse(outline); // Apply all actions to all members of the outline

      },
      genOutlineData: function() {
        
        /// {CLIENT=
        return {
          typeSet: {},
          itemSet: {},
          render: null
        };
        /// =CLIENT}
        
        /// {SERVER=
        return {
          typeSet: {
            stringSet: {
              0: {
                value: 'str'
              }
            },
            objectSet: {
              0: {
                pairSet: {
                  0: {
                    key: 'str',
                    val: '~root.itemSet.1'
                  }
                }
              }
            },
            arraySet: {
            }
          },
          itemSet: {
            0: '~root.typeSet.objectSet.0',
            1: '~root.typeSet.stringSet.0'
          },
          render: '~root.itemSet.0'
        };
        /// =SERVER}
        
      },
      /// {CLIENT=
      genView: function(doss) {
        
        var hoverFlash = new uf.HoverDecorator({ includeDepth: 3 });
        var renderItem = function(name, itemRef) {
          
          // `childInfo` builds a set of either zero or one items; allows `null` to be represented
          var childInfo = new nf.CalculationInformer({
            dependencies: [ itemRef ],
            calc: function() {
              
              var item = itemRef.dereference();
              var ret = {};
              if (item) ret[item.name] = item;
              return ret;
              
            }
          });
          
          return new uf.DynamicSetView({ name: name, childInfo: childInfo, classList: [ 'renderer' ], genChildView: function(name, item) {
            
            var setType = item.value ? item.value[0] : null;
            
            if (setType === 'stringSet') {
              
              var view = new uf.TextEditView({ name: name, syncOnInput: true, info: item.getChild('@.value') })
              
            } else if (setType === 'objectSet') {
              
              var object = item.getChild('@');
              var pairSet = object.getChild('pairSet');
              var foldedInf = object.getChild('folded');
              
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
                
                new uf.DynamicSetView({ name: 'pairSet', childInfo: pairSet, genChildView: function(name, pair) {
                  
                  return new uf.SetView({ name: name, cssClasses: [ 'pair' ], children: [
                    
                    new uf.TextEditView({ name: 'key', syncOnInput: true, info: pair.getChild('key') }),
                    
                    new uf.TextView({ name: 'sep', info: ':' }),
                    
                    renderItem('val', pair.getChild('val')),
                    
                    // Pair controls
                    new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                      new uf.ActionDecorator({ $action: pairSet.as('$useAbility', 'jsonRemChild', { data: { childName: pair.name }, doSync: true }) })
                    ]})
                    
                  ]})
                  
                }}),
                
                new uf.TextView({ name: 'rb', info: '}', decorators: [ toggleFold ] }),
                
                new uf.SetView({ name: 'controls', children: [
                  
                  new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: pairSet.as('$useAbility', 'addStr', { data: null, doSync: true }) })
                  ]}),
                  new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: pairSet.as('$useAbility', 'addObj', { data: null, doSync: true }) })
                  ]}),
                  new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: pairSet.as('$useAbility', 'addArr', { data: null, doSync: true }) })
                  ]})
                  
                ]})
                
              ]});
              
            } else if (setType === 'arraySet') {
              
              var array = item.getChild('@');
              var indexSet = array.getChild('indexSet');
              var foldedInf = array.getChild('folded');
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
                
                new uf.DynamicSetView({ name: 'indexSet', childInfo: indexSet, genChildView: function(name, index) {
                  
                  return new uf.SetView({ name: name, cssClasses: [ 'index' ], children: [
                    
                    renderItem('val', index),
                    
                    // Index controls
                    new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                      new uf.ActionDecorator({ $action: indexSet.as('$useAbility', 'jsonRemChild', { data: { childName: index.name }, doSync: true }) })
                    ]})
                    
                  ]});
                  
                }}),
                
                new uf.TextView({ name: 'rb', info: ']', decorators: [ toggleFold ] }),
                
                new uf.SetView({ name: 'controls', children: [
                  new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: indexSet.as('$useAbility', 'addStr', { data: null, doSync: true }) })
                  ]}),
                  new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: indexSet.as('$useAbility', 'addObj', { data: null, doSync: true }) })
                  ]}),
                  new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                    new uf.ActionDecorator({ $action: indexSet.as('$useAbility', 'addArr', { data: null, doSync: true }) })
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
        return new uf.RootView({ name: 'root', children: [
          new uf.TextView({ name: 'title', info: 'json', decorators: [ toggleCompactness ] }),
          new uf.SetView({ name: 'render', decorators: [ applyCompactness ], children: [
            renderItem('main', doss.getChild('render'))
          ]})
        ]});
        
      }
      /// =CLIENT}
      
    }).$run().done();
    
  }
  
});

package.build();
