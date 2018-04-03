// TODO: DossierRef's setValue logic should be in Actionizer, so the invalidation only
// happens when the reference is actually crystallized

// TODO: Editor atomics need Error instances so upon transaction failure the trace is useful
// If recreating a DIFFICULT TO DEBUG SITUATION, rename ~root.player.quickName to
// ~root.player.quckName (a type), and try creating a world... have fun with that one

var package = new PACK.pack.Package({ name: 'lapse',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify', 'canvas' ],
  /// =CLIENT}
  buildFunc: function(lapse, ap, ds, nf, p, sv, uf, cv) {
    
    lapse.resources = {
      css: [
        'apps/lapse/css/style.css',
        'apps/userify/css/substance.css'
      ]
    };
    
  },
  runAfter: function(lapse, ap, ds, nf, p, sv, uf, cv) {
    
    var App = ap.App;
    var P = p.P;
    
    var physicalData = sv.getPhysicalHostData();
    
    new App({ name: 'lapse',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, /*host: '192.168.1.148',*/ port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(lapse, actionizer) {
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        var accessAccount = function(lapse, username, password) {
          
          var account = lapse.getChild([ 'accountSet', username ]);
          
          if (!account) return 'nonexistant';
          if (account.getValue('password') !== password) return 'unauthorized';
          
          /// {SERVER=
          // TODO: Reset a timeout to deactivate the current Player associated with the Account
          /// =SERVER}
          
          return account;
          
        };
        
        lapse.addAbility('login', actionizer.makeAbility('login', function(doss, data, stager) {
          
          /// {SERVER=
          var username = U.param(data, 'username');
          var password = U.param(data, 'password');
          
          var account = doss.getChild([ 'accountSet', username ]);
          if (!account) {
            
            stager(doss.getChild('accountSet'), 'add', {
              data: {
                username: username,
                password: password,
                fname: 'Anony',
                lname: 'Mous',
                player: null
              },
              sync: 'quick',
              sessions: [ stager.session ]
            });
            
            var data = { status: 'success', username: username };
            
          } else {
            
            var data = account.getValue('password') === password
              ? { status: 'success', username: username }
              : { status: 'failure', reason: 'password' };
            
          }
          /// =SERVER}
          
        }));
        
        /// {CLIENT=
        // >> Me
        var me = lapse.addChild(new Obj({ name: 'me' }));
        me.addChild(new Val({ name: 'wantsOverlay', dossClass: ds.DossierBln, defaultValue: false }));
        me.addChild(new Ref({ name: 'account', format: '~root.accountSet.$account' }));
        me.addChild(new Ref({ name: 'combatant', format: '~root.worldSet.$world.combatantSet.$combatant' }));
        me.addChild(new Ref({ name: 'world', format: '~root.worldSet.$world' }));
        /// =CLIENT}
        
        // >> AccountSet
        var accountSet = lapse.addChild(new Arr({ name: 'accountSet' }));
        accountSet.setNameFunc(function(account) {
          return account.getValue('username');
        });
        
        // >> AccountSet / Account
        var account = accountSet.setTemplate(new Obj({ name: 'account' }));
        account.addChild(new Val({ name: 'username' }));
        account.addChild(new Val({ name: 'password' }));
        account.addChild(new Val({ name: 'fname' }));
        account.addChild(new Val({ name: 'lname' }));
        account.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        
        // >> PlayerSet
        var playerSet = lapse.addChild(new Arr({ name: 'playerSet' }));
        playerSet.setNameFunc(function(player) {
          return player.getValue('username');
        });
        
        // >> PlayerSet / Player
        var player = playerSet.setTemplate(new Obj({ name: 'player' }));
        player.addChild(new Val({ name: 'username' }));
        /// {SERVER=
        player.addChild(new Val({ name: 'ip' }));
        /// =SERVER}
        player.addChild(new Val({ name: 'joinTime', dossClass: ds.DossierInt }));
        player.addChild(new Ref({ name: 'world', format: '~root.worldSet.$world' }));
        
        // >> RoleTypeSet
        var roleTypeSet = lapse.addChild(new Obj({ name: 'roleTypeSet' }));
        
        // >> RoleTypeSet / General
        var general = roleTypeSet.addChild(new Obj({ name: 'general' }));
        general.addChild(new Val({ name: 'description' }));
        
        // >> RoleTypeSet / General / InstanceSet
        var instanceSet = general.addChild(new Arr({ name: 'instanceSet' }));
        
        // >> RoleTypeSet / General / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        // TODO: General values
        
        // >> RoleTypeSet / Captain
        var captain = roleTypeSet.addChild(new Obj({ name: 'captain' }));
        captain.addChild(new Val({ name: 'description' }));
        
        // >> RoleTypeSet / Captain / InstanceSet
        var instanceSet = captain.addChild(new Arr({ name: 'instanceSet' }));
        
        // >> RoleTypeSet / Captain / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        instance.addChild(new Val({ name: 'maximumHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'currentHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locX', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locY', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'rot', dossClass: ds.DossierInt }));
        
        // >> RoleTypeSet / Grunt
        var grunt = roleTypeSet.addChild(new Obj({ name: 'grunt' }));
        grunt.addChild(new Val({ name: 'description' }));
        
        // >> RoleTypeSet / Grunt / InstanceSet
        var instanceSet = grunt.addChild(new Arr({ name: 'instanceSet' }));
        
        // >> RoleTypeSet / Grunt / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        instance.addChild(new Val({ name: 'maximumHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'currentHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locX', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locY', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'rot', dossClass: ds.DossierInt }));
        
        // >> WorldSet
        var worldSet = lapse.addChild(new Arr({ name: 'worldSet' }));
        worldSet.setNameFunc(function(world) {
          return world.getValue('quickName');
        });
        worldSet.addAbility('create', actionizer.makeAbility('create', function(worldSet, data, stager) {
          
          /// {SERVER=
          var lapse = worldSet.getChild('~root');
          
          var accountData = U.param(data, 'accountData');
          var account = lapse.getChild([ 'accountSet', accountData.username ]);
          if (!account) throw new Error('Invalid username: ' + accountData.username);
          
          // Create + sync world
          var worldData = U.param(data, 'worldData');
          var world = stager(worldSet, 'add', {
            data: {
              quickName: worldData.quickName,
              name: worldData.name,
              mode: worldData.mode
            },
            sync: 'quick',
            sessions: 'all'
          });
          
          // TODO: Validate that no player already exists on `account`
          var player = stager(lapse.getChild('playerSet'), 'add', {
            data: {
              username: account.getValue('username'),
              ip: stager.session.ip,
              joinTime: +new Date(),
              world: [ worldData.quickName ]
            },
            scrub: [ 'ip' ],
            sync: 'quick',
            sessions: [ stager.session ]
          });
          
          // Update the client's Account reference to the client's Player
          stager(account.getChild('player'), 'mod', { data: [ account.getValue('username') ], sync: 'quick', sessions: [ stager.session ] });
          
          /// =SERVER}
          
        }));
        worldSet.addAbility('join', actionizer.makeAbility('join', function(doss, data, stager) {
          
          // TODO: Separate 'create' from 'join' and call 'join' from 'create'
          
        }));
        
        // >> WorldSet / World
        var world = worldSet.setTemplate(new Obj({ name: 'world' }));
        world.addAbility('respawn', actionizer.makeAbility('respawn', function(doss, data, stager) {
          
          var accountData = U.param(data, 'accountData');
          var account = doss.getChild([ '~root', 'accountSet', accountData.username]);
          
          // TODO: Validate password, that player exists, etc.
          
          // TODO: What if the gruntInstance's name (it's based on a counter) goes out of sync with client??
          var gruntInstance = stager(doss.getChild('~root.roleTypeSet.grunt.instanceSet'), 'add', {
            data: {
              maximumHp: 10,
              currentHp: 10,
              locX: 0,
              locY: 0,
              rot: 0
            }
          });
          var combatant = stager(doss.getChild('combatantSet'), 'add', {
            data: {
              account: account,
              roleInstance: gruntInstance
            }
          });
          
          /// {CLIENT=
          stager(doss.getChild('~root.me.combatant'), 'mod', { data: combatant });
          /// =CLIENT}
          
        }));
        world.addChild(new Val({ name: 'quickName' }));
        world.addChild(new Val({ name: 'name' }));
        world.addChild(new Val({ name: 'mode', defaultValue: 'standard' }));
        
        // >> WorldSet / World / ProjectileSet
        // TODO
        
        // >> WorldSet / World / TerrainSet
        // TODO
        
        // >> WorldSet / World / CombatantSet
        var combatantSet = world.addChild(new Arr({ name: 'combatantSet' }));
        
        // >> WorldSet / World / CombatantSet / Combatant
        var combatant = combatantSet.setTemplate(new Obj({ name: 'combatant' }));
        combatant.addChild(new Ref({ name: 'account', format: '~root.accountSet.$account' }));
        combatant.addChild(new Ref({ name: 'roleInstance', format: '~root.roleTypeSet.$type.instanceSet.$instance' }));
        
        actionizer.recurse(lapse);
        
      },
      genOutlineData: function() {
        
        return {
          accountSet: {},
          playerSet: {},
          roleTypeSet: {
            general: {
              instanceSet: {}
            },
            captain: {
              instanceSet: {}
            },
            grunt: {
              instanceSet: {}
            }
          },
          worldSet: {}
        };
        
      },
      setupDoss: function(lapse) {
        
        /// {CLIENT=
        var credInfo = new nf.CalculationInformer({
          dependencies: [ lapse.getChild('me.account') ],
          calc: function(val) {
            
            var account = lapse.getChild('me.@account');
            
            if (!account) return null;
            
            return {
              username: account.getValue('username'),
              password: account.getValue('password')
            };
          }
        });
        credInfo.start();
        window.credInfo = credInfo;
        
        var genFormChildren = function(fields, func) {
          
          var children = A.map(fields, function(field) {
            return new uf.TextEditView({ name: field, info: '', placeholderInfo: field[0].toUpperCase() + field.substr(1), syncOnInput: false });
          });
          children.push(new uf.TextView({ name: 'submit', info: 'Submit', decorators: [
            new uf.ActionDecorator({ $action: function(event, view) {
              
              var formView = view.par;
              var formData = {};
              A.each(fields, function(field) { formData[field] = formView.children[field].info.getValue(); });
              return p.$(func(formData));
              
              // return submitDoss.$useAbility(submitAbilityName, { data: formData, sync: 'confirm' });
              
            }})
          ]}));
          
          return children;
          
          //return new uf.SetView({ name: name, cssClasses: [ 'form' ], children: children });
          
        };
        var creatingWorld = new nf.ValueInformer({ value: false });
        
        var view = new uf.RootView({ name: 'root', children: [
          
          new uf.ChoiceView({ name: 'overlay', cssClasses: [ 'chooser' ], transitionTime: 550,
            choiceInfo: new nf.CalculationInformer({
              dependencies: [ lapse.getChild('me.account'), lapse.getChild('me.world') ],
              calc: function(account, world) {
                if (!account) return 'login';
                if (!world) return 'lobby';
                return 'world';
              }
            }),
            children: [
              new uf.SetView({ name: 'login', cssClasses: [ 'choice', 'filler' ], numWrappers: 1, children: [
                new uf.TextView({ name: 'title', info: 'lapse' }),
                new uf.SetView({ name: 'form', cssClasses: [ 'content' ],
                  children: genFormChildren([ 'username', 'password' ], function(data) {
                    
                    return new P({ all: [
                      lapse.getChild('me.account').$useAbility('mod', { data: [ data.username ] }),
                      lapse.$useAbility('login', { data: data, sync: 'quick' })
                    ]});
                    
                  })
                })
              ]}),
              new uf.SetView({ name: 'lobby', cssClasses: [ 'choice', 'filler', 'titled' ], children: [
                
                new uf.TextView({ name: 'title', info: 'Lobby' }),
                
                new uf.TextView({ name: 'doCreate',
                  info: new nf.CalculationInformer({
                    dependencies: [ creatingWorld ],
                    calc: function(isCreatingWorld) { return isCreatingWorld ? 'Back' : 'Create' }
                  }),
                  decorators: [
                    new uf.ActionDecorator({ action: creatingWorld.as('modValue', function(v) { return !v; }) })
                  ]
                }),
                
                new uf.ChoiceView({ name: 'content', cssClasses: [ 'chooser' ], transitionTime: 550,
                  choiceInfo: new nf.CalculationInformer({
                    dependencies: [ creatingWorld ],
                    calc: function(isCreatingWorld) { return isCreatingWorld ? 'createWorld' : 'worldSet'; }
                  }),
                  children: [
                    new uf.DynamicSetView({ name: 'worldSet', cssClasses: [ 'choice' ],
                      childInfo: lapse.getChild('worldSet'),
                      genChildView: function(name, world) {
                        return new uf.SetView({ name: name, cssClasses: [ 'world' ], children: [
                          new uf.TextView({ name: 'name', info: world.getChild('name') }),
                          new uf.TextView({ name: 'mode', info: world.getChild('mode') }),
                          new uf.TextView({ name: 'enter', info: 'Enter', decorators: [
                            new uf.ActionDecorator({ action: function() { console.log('ENTER:', world.getValue('name')); } })
                          ]})
                        ]})
                      },
                      emptyView: new uf.TextView({ name: 'empty', info: '... no worlds...' })
                    }),
                    new uf.SetView({ name: 'createWorld', cssClasses: [ 'choice', 'titled' ], children: [
                      new uf.TextView({ name: 'title', info: 'Create' }),
                      new uf.SetView({ name: 'form', cssClasses: [ 'content' ],
                        children: genFormChildren([ 'quickName', 'name', 'mode' ], function(worldData) {
                          
                          var accountData = credInfo.getValue();
                          
                          return new P({ all: [
                            
                            lapse.getChild('me.world').$useAbility('mod', { data: [ worldData.quickName ] }),
                            lapse.getChild('me.@account.player').$useAbility('mod', { data: [ accountData.username ] }),
                            lapse.getChild('worldSet').$useAbility('create', {
                              data: {
                                worldData: worldData,
                                accountData: accountData
                              },
                              sync: 'quick'
                            })
                            
                          ]});
                          
                        })
                      })
                    ]})
                  ]
                })
                
              ]}),
              new uf.ChoiceView({ name: 'world', cssClasses: [ 'choice', 'filler', 'titled', 'chooser' ], transitionTime: 550,
                decorators: [
                  new uf.ClassDecorator({
                    list: [ 'show', 'hide' ],
                    informer: new nf.CalculationInformer({
                      dependencies: [ lapse.getChild('me.combatant'), lapse.getChild('me.wantsOverlay') ],
                      calc: function(combatant, wantsOverlay) {
                        if (wantsOverlay) return 'show';
                        return combatant ? 'hide' : 'show'; // If no combatant, always show
                      }
                    })
                  })
                ],
                choiceInfo: new nf.CalculationInformer({
                  dependencies: [ lapse.getChild('me.combatant') ],
                  calc: function(combatant) {
                    
                    console.log('COMBATANT FOR OVERLAY:', combatant);
                    return 'respawn';
                    
                  }
                }),
                children: [
                  
                  new uf.SetView({ name: 'respawn', cssClasses: [ 'filler' ], children: [
                    
                    new uf.SetView({ name: 'map', decorators: [
                      
                    ]}),
                    new uf.TextView({ name: 'go', info: 'Go', decorators: [
                      new uf.ActionDecorator({ $action: function() {
                        
                        return lapse.getChild('me.@world').$useAbility('respawn', {
                          data: {
                            accountData: credInfo.getValue()
                          },
                          sync: 'quick'
                        });
                        
                      }})
                    ]})
                    
                  ]})
                
                ]
              })
            ]
          }),
          
          new cv.CanvasView({ name: 'canvas', options: { centered: true },
            setupControls: function() {
              
            },
            drawFunc: function(ctx, millis) {
            
            }
          })
          
        ]});
        view.start();
        
        /// {DEBUG=
        view.getChild('overlay.login.form.username').info.setValue('gershy');
        view.getChild('overlay.login.form.password').info.setValue('imsosmart');
        view.getChild('overlay.lobby.content.createWorld.form.quickName').info.setValue('gershyworld');
        view.getChild('overlay.lobby.content.createWorld.form.name').info.setValue('Gershy World');
        view.getChild('overlay.lobby.content.createWorld.form.mode').info.setValue('standard');
        /// =DEBUG}
        
        window.view = view;
        window.doss = lapse;
        
        lapse.$useAbility('sync', {}).done();
        /// =CLIENT}
        
      }
      
    }).$run().done();
    
  }
});
package.build();
