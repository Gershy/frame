/*

Credential entry + login; generate a server-side Account

*/

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
    
    new App({ name: 'lapse',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, /*host: '192.168.1.148',*/ port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(lapse, actionizer) {
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        lapse.addAbility('submitCreds', actionizer.makeAbility('submitCreds', function(doss, data, stager) {
          
          /// {SERVER=
          var username = U.param(data, 'username');
          var password = U.param(data, 'password');
          
          var account = doss.getChild([ 'account', username ]);
          if (!account) {
            
            stager(doss.getChild('accountSet'), 'add', {
              data: {
                username: username,
                password: password,
                fname: 'Anony',
                lname: 'Mous'
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
          
          stager.use(doss, 'receiveAccount', data);
          /// =SERVER}
          
        }));
        lapse.addAbility('receiveAccount', actionizer.makeAbility('receiveAccount', function(doss, data, stager) {
          
          /// {CLIENT=
          if (data.status === 'success') stager(doss.getChild('player.account'), 'mod', { data: [ data.username ] });
          /// =CLIENT}
          
        }));
        
        /// {CLIENT=
        var player = lapse.addChild(new Obj({ name: 'player' }));
        player.addChild(new Ref({ name: 'account', format: '~root.accountSet.$player' }));
        player.addChild(new Ref({ name: 'world', format: '~root.worldSet.$id' }));
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
        
        // >> PlayerSet
        var playerSet = lapse.addChild(new Arr({ name: 'playerSet' }));
        playerSet.setNameFunc(function(player) {
          return player.getValue('ip');
        });
        
        // >> PlayerSet / Player
        var player = playerSet.setTemplate(new Obj({ name: 'player' }));
        player.addChild(new Val({ name: 'ip' }));
        player.addChild(new Ref({ name: 'account', format: '~root.accountSet.$account' }));
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
        
        // >> RoleTypeSet / Soldier
        var soldier = roleTypeSet.addChild(new Obj({ name: 'soldier' }));
        soldier.addChild(new Val({ name: 'description' }));
        
        // >> RoleTypeSet / Soldier / InstanceSet
        var instanceSet = soldier.addChild(new Arr({ name: 'instanceSet' }));
        
        // >> RoleTypeSet / Soldier / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        instance.addChild(new Val({ name: 'maximumHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'currentHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locX', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'locY', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'rot', dossClass: ds.DossierInt }));
        
        // >> WorldSet
        var worldSet = lapse.addChild(new Arr({ name: 'worldSet' }));
        worldSet.addAbility('create', actionizer.makeAbility('create', function(doss, data, stager) {
          
          console.log('CREATING:', data);
          
          var editor = stager.editor;
          var world = editor.add({ par: doss, data: data });
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          /// {CLIENT=
          editor.mod({ doss: doss.getChild('~root.player.world'), data: world });
          editor.$transaction.then(doss.getChild('~root.player.world').as('worry', 'invalidated'));
          /// =CLIENT}
          
          
        }));
        
        // >> WorldSet / World
        var world = worldSet.setTemplate(new Obj({ name: 'world' }));
        world.addChild(new Val({ name: 'name' }));
        world.addChild(new Val({ name: 'mode', defaultValue: 'standard' }));
        
        // >> WorldSet / World / ProjectileSet
        // TODO
        
        // >> WorldSet / World / TerrainSet
        // TODO
        
        // >> WorldSet / World / CombatantSet
        var combatantSet = world.addChild(new Arr({ name: 'combatantSet' }));
        combatantSet.setNameFunc(function(combatant) {
          return combatant.getValue('player.@ip');
        });
        
        // >> WorldSet / World / CombatantSet / Combatant
        var combatant = combatantSet.setTemplate(new Obj({ name: 'combatant' }));
        combatant.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        combatant.addChild(new Ref({ name: 'role', format: '~root.roleTypeSet.$type.$id' }));
        
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
            soldier: {
              instanceSet: {}
            }
          },
          worldSet: {}
        };
        
      },
      setupDoss: function(doss) {
        
      },
      /// {CLIENT=
      genView: function(lapse) {
        
        var genForm = function(name, fields, submitDoss, submitAbilityName) {
          
          var children = A.map(fields, function(field) {
            return new uf.TextEditView({ name: field, info: '', placeholderInfo: field[0].toUpperCase() + field.substr(1), syncOnInput: false });
          });
          children.push(new uf.TextView({ name: 'submit', info: 'Submit', decorators: [
            new uf.ActionDecorator({ $action: function(event, view) {
              
              var formView = view.par;
              var formData = {};
              A.each(fields, function(field) { formData[field] = formView.children[field].info.getValue(); });
              return submitDoss.$useAbility(submitAbilityName, { data: formData, sync: 'confirm' });
              
            }})
          ]}));
          return new uf.SetView({ name: name, cssClasses: [ 'form' ], children: children });
          
        };
        
        var creatingWorld = new nf.ValueInformer({ value: false });
        
        return new uf.RootView({ name: 'root', children: [
          
          new uf.ChoiceView({ name: 'overlay',
            choiceInfo: new nf.CalculationInformer({
              dependencies: [ lapse.getChild('player.account') ],
              calc: function(account) {
                return account ? 'lobby' : 'login';
              }
            }),
            children: [
              new uf.SetView({ name: 'login', children: [
                new uf.TextView({ name: 'title', info: 'lapse' }),
                genForm('creds', [ 'username', 'password' ], lapse, 'submitCreds')
              ]}),
              new uf.SetView({ name: 'lobby', children: [
                
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
                
                new uf.ChoiceView({ name: 'contents',
                  choiceInfo: new nf.CalculationInformer({
                    dependencies: [ creatingWorld ],
                    calc: function(isCreatingWorld) { return isCreatingWorld ? 'createWorld' : 'worldSet'; }
                  }),
                  children: [
                    new uf.DynamicSetView({ name: 'worldSet',
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
                    new uf.SetView({ name: 'createWorld', children: [
                      new uf.TextView({ name: 'title', info: 'Create' }),
                      genForm('form', [ 'name', 'mode' ], lapse.getChild('worldSet'), 'create')
                    ]})
                  ]
                })
                
              ]}),
              new uf.SetView({ name: 'world', children: [
                
              ]})
            ]
          }),
          
          new cv.CanvasView({ name: 'canvas', options: { centered: true }, drawFunc: function(ctx, millis) {
            
          }})
          
        ]});
        
      }
      /// =CLIENT}
      
    }).$run().done();
    
  }
});
package.build();
