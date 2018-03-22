// TODO: Outline and View definition is incredibly ugly.
// The best solution is probably XML parsing (consider high impact on client-side?)

// TODO: Don't need start/stop for Dossiers, but how about a final "validate" atomic?
// E.g. without recurseObj, it's possible for DossierObjs to wind up missing some
// children defined in their Outline. The implementation should avoid this, but
// Dossiers should validate to FORCE the implementation to behave well

// TODO: Distinguish between locally and globally invalidated? E.g. if a purely-client-side value changes,
// the View layout is invalidated and needs to recalculated BUT globally no invalidation has occurred.
// Local invalidations are wired into the local View.
// Global invalidations update the server. HOW BOUT DAT?

/*

- Ensure that there are no more per-frame updates
- Formalize Activities
- Formalize an entire application (e.g. it consists of Actionizer, Channeler+Channels, Outline, Versioner, etc.)

************************************************
- Go write something amazing (Lapse? Blindspot?)
************************************************

- "Hovering" Dossiers (although tricky - since Dossiers are Informers they have to persist when they have usages)
- Persistence
- Reduce file sizes

*/

var package = new PACK.pack.Package({ name: 'jsonBuilder',
  /// {SERVER=
  dependencies: [ 'dossier', 'informer', 'p', 'server', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'dossier', 'informer', 'p', 'server', 'userify' ],
  /// =CLIENT}
  
  buildFunc: function(pack /* ... */) {
    
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
    
    pack.resources = {
      css: [
        'apps/jsonBuilder/css/style.css',
        'apps/userify/css/substance.css'
      ]
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
    var channeler = new sv.Channeler({ name: 'jsonBuilder', appName: 'jsonBuilder', handler: rootDoss });
    channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
    channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
    
    activities.push(channeler);
    
    // ==== Initialize actionizer
    var Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      
      init: function(params /* channeler */) {
        
        var channeler = this.channeler = U.param(params, 'channeler');
        
        this.sync = function(session, channelerParams, editor, doss, params /* */) {
          
          // Note that the server side never gives a "sync" command; the server is the source of truth,
          // it doesn't rely on any outside sources to synchronize it.
          // Attach a sync action to occur when the `editor` is done (but don't wait to fulfill $staged!)
          editor.$transaction.then(function() {
            
            /// {CLIENT=
            // The client side issues a sync command
            var command = 'sync';
            var params = {};
            /// =CLIENT}
            
            /// {SERVER=
            // The server side issues a mod command in response
            var command = 'mod';
            var params = { doSync: false, data: doss.getJson() };
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
          
        };
        
        this.modVal = this.makeAbility('mod', true, function(editor, doss, data) {
          
          // TODO: It's not nearly this easy as the currentl uncommented code!
          // console.log('Mod not implemented ;D');
          // Modifying an object results in many removed, added, and modified children.
          // Verification needs to happen for everything in the tree of changes.
          
          editor.mod({ doss: doss, data: data });
          
        });
        
        this.modObj = this.makeAbility('mod', true, function(editor, doss, data, session, channelerParams) {
          
          return new P({ all: O.map(doss.outline.children, function(childOutline, childName) {
            
            var childData = data.hasOwnProperty(childName) ? data[childName] : null;
            
            var child = O.contains(doss.children, childName)
              ? doss.children[childName]
              : editor.add({ par: doss, name: childName, data: null });
            
            return child.$stageAbility('mod', session, channelerParams, editor, { data: childData, doSync: false });
            
          })});
          
        });
        
        this.modArr = this.makeAbility('mod', true, function(editor, doss, data, session, channelerParams) {
          
          return new P({ all: O.map(data, function(childData, childName) {
            
            // We don't want to recurse on objects. This is because objects will
            // add their children through their own 'mod' ability - and
            // `recurseObj` will generate all children, even if `data` is null
            var child = editor.add({ par: doss, data: null, recurseObj: false });
            return child.$stageAbility('mod', session, channelerParams, editor, { data: childData, doSync: false });
            
          })});
          
        });
        
      },
      makeAbility: function(name, invalidates, editsFunc) {
        
        /// {DOC=
        { desc: 'Makes a syncing ability, allowing the writer to worry only about the edits ' +
            'without needing to take anything else into account',
          params: {
            name: { desc: 'The unique name of the ability' },
            invalidates: { desc: 'Indicates whether this ability invalidates the Dossier' },
            editsFunc: { signature: function(editor, doss, data){},
              desc: 'A function which calls edit methods on `editor`. This method is allowed ' +
                'to return a promise',
              params: {
                editor: { desc: 'The editor' },
                doss: { desc: 'The Dossier instance which may be needed for some edits' },
                data: { desc: 'Arbitrary parameters for the ability' }
              }
            }
          }
        }
        /// =DOC}
        
        var channeler = this.channeler;
        
        return function(session, channelerParams, editor, doss, params /* doSync, data */) {
          
          // Perform whatever actions this ability ought to carry out
          var data = U.param(params, 'data');
          
          // The transaction may alter the Dossier's address! Get the address beforehand.
          var address = doss.getAddress();
          
          var $result = new P({ run: editsFunc.bind(null, editor, doss, data, session, channelerParams) });
          
          return $result.then(function() { // After `editsFunc` has run, prepare post-transaction to sync changes
            
            // When the editor transacts, sync any sessions as is necessary. This doesn't block $staging.
            editor.$transaction
              .then(function() {
                
                // Send worries if invalidated
                if (invalidates) doss.worry('invalidated');
                
                if (!U.param(params, 'doSync', false)) return;
                
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
                var sessionsToInform = { server: null }; // The only session a client can inform is the server session
                var commandParams = { data: data, doSync: true }; // The server should sync any other clients
                //if (doSync) console.log('Syncing server...');
                /// =CLIENT}
                
                return new P({ all: O.map(sessionsToInform, function(sessionToInform) {
                  
                  return channeler.$giveCommand({
                    session: sessionToInform,
                    channelerParams: sessionToInform === session ? channelerParams : null,
                    data: {
                      address: address,
                      command: name,
                      params: commandParams
                    }
                  });
                  
                })});
                
              })
              .fail(console.error.bind(console))
              .done();
            
          });
          
        };
        
        
      },
      recurse: function(outline) {
        
        if (U.isInstance(outline, ds.Val)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modVal
          });
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modObj
          });
          
          for (var k in outline.children) this.recurse(outline.children[k]);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modArr
          });
          
          this.recurse(outline.template);
          
        }
        
      }
      
    };}});
    var actionizer = new Actionizer({ channeler: channeler });
    
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
    
    var outline = new Obj({ name: 'jsonBuilder' });
    
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
      addObj: actionizer.makeAbility('addObj', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.objectSet'), data: { pairSet: {} } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newPair = editor.add({ par: doss.getChild('pairSet'), data: { key: 'str', val: newItem } });
        
      }),
      addArr: actionizer.makeAbility('addArr', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.arraySet'), data: { indexSet: {} } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newPair = editor.add({ par: doss.getChild('pairSet'), data: { key: 'obj', val: newItem } });
        
      }),
      addStr: actionizer.makeAbility('addStr', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.stringSet'), data: { value: 'str' } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newPair = editor.add({ par: doss.getChild('pairSet'), data: { key: 'arr', val: newItem } });
        
      }),
      jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data, session, channelerParams) {
        
        editor.rem({ child: doss });
        
        var pairSet = doss.getChild('pairSet');
        return new P({ all: O.map(pairSet.children, function(pair) {
          return pair.getChild('@val').$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
        })});
        
      }),
      jsonRemChild: actionizer.makeAbility('jsonRemChild', true, function(editor, doss, data, session, channelerParams) {
        
        var childName = U.param(data, 'childName');
        var child = doss.getChild([ 'pairSet', childName, '@val' ]);
        editor.rem({ child: doss.getChild([ 'pairSet', childName ]) });
        
        return child.$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
        
      })
    }}));
    var pairSet = object.addChild(new Arr({ name: 'pairSet' }));
    var pair = pairSet.setTemplate(new Obj({ name: 'pair' }));
    pair.addChild(new Val({ name: 'key' }));
    pair.addChild(new Ref({ name: 'val', format: '~root.itemSet.$id' }));
    /// {CLIENT=
    object.addChild(new Val({ name: 'folded', dossClass: ds.DossierBln, defaultValue: false }));
    /// =CLIENT}
    
    // Array type
    var arraySet = typeSet.addChild(new Arr({ name: 'arraySet' }));
    var array = arraySet.setTemplate(new Obj({ name: 'array', abilities: {
      addObj: actionizer.makeAbility('addObj', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.objectSet'), data: { pairSet: {} } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newIndex = editor.add({ par: doss.getChild('indexSet'), data: newItem });
        
      }),
      addArr: actionizer.makeAbility('addArr', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.arraySet'), data: { indexSet: {} } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newIndex = editor.add({ par: doss.getChild('indexSet'), data: newItem });
        
      }),
      addStr: actionizer.makeAbility('addStr', true, function(editor, doss, data) {
        
        var newObj = editor.add({ par: doss.getChild('~root.typeSet.stringSet'), data: { value: 'str' } });
        var newItem = editor.add({ par: doss.getChild('~root.itemSet'), data: newObj });
        var newIndex = editor.add({ par: doss.getChild('indexSet'), data: newItem });
        
      }),
      jsonRem: actionizer.makeAbility('jsonRem', true, function(editor, doss, data, session, channelerParams) {
        
        editor.rem({ child: doss });
        
        var indexSet = doss.getChild('indexSet');
        return new P({ all: O.map(indexSet.children, function(index) {
          return index.getChild('@').$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
        })});
        
      }),
      jsonRemChild: actionizer.makeAbility('jsonRemChild', true, function(editor, doss, data, session, channelerParams) {
        
        var childName = U.param(data, 'childName');
        var child = doss.getChild([ 'indexSet', childName, '@' ]);
        editor.rem({ child: doss.getChild([ 'indexSet', childName ]) });
        
        return child.$stageAbility('jsonRem', session, channelerParams, editor, { data: null, doSync: false });
        
      })
    }}));
    var indexSet = array.addChild(new Arr({ name: 'indexSet' }));
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
      
      /// {CLIENT=
      typeSet: {},
      itemSet: {},
      render: null
      /// =CLIENT}
      
      /// {SERVER=
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
      /// =SERVER}
      
    }});
    channeler.handler = rootDoss; // Assign this Dossier as the Channeler's handler
    
    /// {CLIENT=
    // ==== Initialize view
    
    var viewFunc = function() {
      
      var hoverFlash = new uf.HoverDecorator({ includeDepth: 3 });
      
      var renderer = function(name, itemRef) {
        
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
            
            var view = new uf.TextEditView({ name: name, info: item.getChild('@.value') })
            
          } else if (setType === 'objectSet') {
            
            var object = item.getChild('@');
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
              
              new uf.DynamicSetView({ name: 'pairSet', childInfo: item.getChild('@.pairSet'), genChildView: function(name, pair) {
                
                return new uf.SetView({ name: name, cssClasses: [ 'pair' ], children: [
                  
                  new uf.TextEditView({ name: 'key', info: pair.getChild('key') }),
                  
                  new uf.TextView({ name: 'sep', info: ':' }),
                  
                  renderer('val', pair.getChild('val')),
                  
                  // Pair controls
                  new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                    
                    new uf.ActionDecorator({ $action: function() {
                      
                      return object.$useAbility('jsonRemChild', { data: { childName: pair.name }, doSync: true });
                      
                      //console.log('REMMING:', item.getAddress());
                      //return pair.getChild('@val').$useAbility('jsonRem', { data: null, doSync: true });
                      
                    }})
                    
                  ]})
                  
                ]})
                
              }}),
              
              new uf.TextView({ name: 'rb', info: '}', decorators: [ toggleFold ] }),
              
              new uf.SetView({ name: 'controls', children: [
                
                new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addStr', { data: null, doSync: true });
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addObj', { data: null, doSync: true });
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addArr', { data: null, doSync: true });
                    
                  }})
                ]})
                
              ]})
              
            ]});
            
          } else if (setType === 'arraySet') {
            
            var array = item.getChild('@');
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
              
              new uf.DynamicSetView({ name: 'indexSet', childInfo: item.getChild('@.indexSet'), genChildView: function(name, index) {
                
                return new uf.SetView({ name: name, cssClasses: [ 'index' ], children: [
                  
                  renderer('val', index),
                  
                  // Index controls
                  new uf.TextView({ name: 'delete', info: 'X', cssClasses: [ 'control' ], decorators: [
                    
                    new uf.ActionDecorator({ $action: function() {
                      
                      return array.$useAbility('jsonRemChild', { data: { childName: index.name }, doSync: true });
                      
                    }})
                    
                  ]})
                  
                ]});
                
              }}),
              
              new uf.TextView({ name: 'rb', info: ']', decorators: [ toggleFold ] }),
              
              new uf.SetView({ name: 'controls', children: [
                
                new uf.TextView({ name: 'addString', info: '+STR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addStr', { data: null, doSync: true });
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addObject', info: '+OBJ', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addObj', { data: null, doSync: true });
                    
                  }})
                ]}),
                new uf.TextView({ name: 'addArray', info: '+ARR', cssClasses: [ 'control' ], decorators: [
                  new uf.ActionDecorator({ $action: function() {
                    
                    return item.getChild('@').$useAbility('addArr', { data: null, doSync: true });
                    
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
            
            renderer('main', rootDoss.getChild('render'))
            
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
      .then(channeler.$start.bind(channeler))
      /// {CLIENT=
      .then(rootDoss.$useAbility.bind(rootDoss, 'sync'))
      .then(function() {
        
        window.doss = rootDoss;
        viewFunc().start();
        
      })
      /// =CLIENT}
      .done();
    
  }
  
});

package.build();
