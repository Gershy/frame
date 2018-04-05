// TODO: DossierRef's setValue logic should be in Actionizer, so the invalidation only
// happens when the reference is actually crystallized

// TODO: Editor atomics need Error instances so upon transaction failure the trace is useful
// If recreating a DIFFICULT TO DEBUG SITUATION, rename ~root.player.quickName to
// ~root.player.quckName (a type), and try creating a world... have fun with that one

// TODO: Allow multiple commands to be packed into a single request. More compression via
// `U.thingToString`, plus efficiency over most protocols. Consider big updates, like the
// per-frame world update...

/*
- Joining existing worlds
- Being a combatant
  - Abstract keys, instead of purpose-naming, just name key1, key2, key3, etc.
    - Keys have different meaning depending on the role
  - Move through velocity
  - Looking at a point
  - Has a rotation
  - Movement: F/B/L/R instead of L/R/D/U
  - Visuals
  - Actions
    - Projectiles (just firing + rendering, no physics yet)
- Terrain
  - Probably static initially
- Physics
  - Grouping
    - Square-tiled? Treelike grouping areas?
  - Smallscale collision
    - No passing through terrain
    - Projectile collision
      - Dynamic penetration through terrain?
      - Projectile effects at target
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
    
    var physicalData = sv.getPhysicalHostData();
    
    new App({ name: 'lapse',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, /*host: '192.168.1.148',*/ port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(lapse) {
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        /// {SERVER=
        lapse.addUtility('update', function(lapse, timeMult) {
          
          /*
          // We want to know which sessions need to be updated for each world
          var playersPerWorld = {};
          var players = lapse.getChild('playerSet').children;
          for (var k in players) {
            var world = players[k].getChild('@world');
            if (!world) continue;
            if (!O.contains(playersPerWorld, world.name)) playersPerWorld[world.name] = [];
            playersPerWorld[world.name].push(players[k]);
          }
          */
          
          var worlds = lapse.getChild('worldSet').children;
          O.each(worlds, function(world) { return world.useUtility('update', timeMult); });
          /*for (var worldName in worlds) {
            //console.log('Updating world "' + worldName + '" with ' + playersPerWorld[worldName].length + ' player(s)');
            worlds[worldName].useUtility('update', timeMult, playersPerWorld[worldName]);
          }*/
          
        });
        /// =SERVER}
        
        /// {CLIENT=
        // >> Me
        var me = lapse.addChild(new Obj({ name: 'me' }));
        me.addChild(new Val({ name: 'wantsOverlay', dossClass: ds.DossierBln, defaultValue: false }));
        me.addChild(new Val({ name: 'creatingWorld', dossClass: ds.DossierBln, defaultValue: false }));
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
        player.addChild(new Ref({ name: 'combatant', format: '~root.worldSet.$world.combatantSet.$combatant' }));
        player.addChild(new Val({ name: 'keyInput', dossClass: ds.DossierJsn, defaultValue: { l: false, r: false, d: false, u: false } }));
        player.addChild(new Val({ name: 'mouseInput', dossClass: ds.DossierJsn, defaultValue: { pt: { x: 0, y: 0 }, buttons: [ false, false, false ] } }));
        
        // >> RoleTypeSet
        var roleTypeSet = lapse.addChild(new Obj({ name: 'roleTypeSet' }));
        
        // >> RoleTypeSet / General
        var general = roleTypeSet.addChild(new Obj({ name: 'general' }));
        general.addChild(new Val({ name: 'description' }));
        
        // >> RoleTypeSet / General / InstanceSet
        var instanceSet = general.addChild(new Arr({ name: 'instanceSet' }));
        instanceSet.setNameFunc(function(instance) {
          return instance.getValue('@player.username');
        });
        
        // >> RoleTypeSet / General / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        /// {SERVER=
        instance.addUtility('update', function(general, timeMult, sessions) {
          throw new Error('not implemented');
        });
        /// =SERVER}
        instance.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        // TODO: General values
        
        // >> RoleTypeSet / Captain
        var captain = roleTypeSet.addChild(new Obj({ name: 'captain' }));
        captain.addChild(new Val({ name: 'description' }));
        captain.addChild(new Val({ name: 'maximumHp', defaultValue: 100 }));
        
        // >> RoleTypeSet / Captain / InstanceSet
        var instanceSet = captain.addChild(new Arr({ name: 'instanceSet' }));
        instanceSet.setNameFunc(function(instance) {
          return instance.getValue('@player.username');
        });
        
        // >> RoleTypeSet / Captain / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        /// {SERVER=
        instance.addUtility('update', function(captain, timeMult, sessions) {
          throw new Error('not implemented');
        });
        /// =SERVER}
        instance.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        instance.addChild(new Val({ name: 'currentHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'x', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'y', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'rot', dossClass: ds.DossierInt }));
        
        // >> RoleTypeSet / Grunt
        var grunt = roleTypeSet.addChild(new Obj({ name: 'grunt' }));
        grunt.addChild(new Val({ name: 'description' }));
        grunt.addChild(new Val({ name: 'maximumHp', defaultValue: 100 }));
        
        // >> RoleTypeSet / Grunt / InstanceSet
        var instanceSet = grunt.addChild(new Arr({ name: 'instanceSet' }));
        instanceSet.setNameFunc(function(instance) {
          return instance.getValue('@player.username');
        });
        
        // >> RoleTypeSet / Grunt / InstanceSet / Instance
        var instance = instanceSet.setTemplate(new Obj({ name: 'instance' }));
        /// {SERVER=
        instance.addUtility('update', function(grunt, timeMult, sessions) {
          
          var keyInput = grunt.getValue('@player.keyInput');
          
          var loc = { x: grunt.getValue('x'), y: grunt.getValue('y') };
          
          if (keyInput && (keyInput.l || keyInput.r || keyInput.d || keyInput.u)) {
            
            if (keyInput.l) loc.x -= (500 * timeMult);
            if (keyInput.r) loc.x += (500 * timeMult);
            if (keyInput.d) loc.y -= (500 * timeMult);
            if (keyInput.u) loc.y += (500 * timeMult);
            
            grunt.$useAbility('mod', {
              data: loc,
              sync: 'quick',
              sessions: sessions
            }).done();
            
          }
          
        });
        /// =SERVER}
        instance.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        instance.addChild(new Val({ name: 'currentHp', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'x', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'y', dossClass: ds.DossierInt }));
        instance.addChild(new Val({ name: 'rot', dossClass: ds.DossierInt }));
        
        // >> WorldSet
        var worldSet = lapse.addChild(new Arr({ name: 'worldSet' }));
        worldSet.setNameFunc(function(world) {
          return world.getValue('quickName');
        });
        
        // >> WorldSet / World
        var world = worldSet.setTemplate(new Obj({ name: 'world' }));
        /// {SERVER=
        world.addUtility('update', function(world, timeMult) {
          
          var sessions = {}; // A.map(players, function(player) { return player.getValue('ip'); });
          
          var combatants = world.getChild('combatantSet').children;
          for (var k in combatants) {
            var ip = combatants[k].getValue('@player.ip');
            if (ip) sessions[ip] = ip;
          }
          
          O.each(combatants, function(combatant) {
            return combatant.useUtility('update', timeMult, sessions);
          });
          
        });
        /// =SERVER}
        world.addChild(new Val({ name: 'quickName' }));
        world.addChild(new Ref({ name: 'account', format: '~root.accountSet.$account' }));
        world.addChild(new Val({ name: 'name' }));
        world.addChild(new Val({ name: 'mode', defaultValue: 'standard' }));
        
        // >> WorldSet / World / ProjectileSet
        // TODO
        
        // >> WorldSet / World / TerrainSet
        // TODO
        
        // >> WorldSet / World / CombatantSet
        var combatantSet = world.addChild(new Arr({ name: 'combatantSet' }));
        combatantSet.setNameFunc(function(combatant) {
          return combatant.getValue('@player.username');
        });
        
        // >> WorldSet / World / CombatantSet / Combatant
        var combatant = combatantSet.setTemplate(new Obj({ name: 'combatant' }));
        /// {SERVER=
        combatant.addUtility('update', function(combatant, timeMult, sessions) {
          
          var roleInstance = combatant.getChild('@roleInstance');
          if (roleInstance) roleInstance.useUtility('update', timeMult, sessions);
          
        });
        /// =SERVER}
        combatant.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        combatant.addChild(new Ref({ name: 'roleInstance', format: '~root.roleTypeSet.$type.instanceSet.$instance' }));
        
        /// {CLIENT=
        lapse.getChild('worldSet.world.combatantSet.combatant').addUtility('draw', function(combatant, graphics) {
          
          var roleInstance = combatant.getChild('@roleInstance');
          if (roleInstance) roleInstance.useUtility('draw', graphics);
          
        });
        lapse.getChild('roleTypeSet.grunt.instanceSet.instance').addUtility('draw', function(grunt, graphics) {
          
          graphics.push({ stroke: '2px solid #000000', fill: '#ff0000' });
          graphics.circle({ x: grunt.getValue('x'), y: grunt.getValue('y') }, 20);
          graphics.pop();
          
        });
        /// =CLIENT}
        
      },
      setupActions: function(lapse, actionizer) {
        
        var accessAccount = function(lapse, username, password) {
          
          /// {CLIENT=
          var account = lapse.getChild('me.@account');
          if (!account) throw new Error('No account available');
          if (account.name !== username) {
            console.log('HEEEEEEEEEEERE');
            return null;
          }
          return account;
          /// =CLIENT}
          
          /// {SERVER=
          if (!lapse.isRoot()) throw new Error('Need root object');
          if (!U.isObj(username, String)) throw new Error('Non-string username: ' + U.typeOf(username));
          if (!U.isObj(password, String)) throw new Error('Non-string password: ' + U.typeOf(password));
          
          var account = lapse.getChild([ 'accountSet', username ]);
          
          if (!account) return null;
          if (account.getValue('password') !== password) throw new Error('Unauthorized');
          
          // TODO: Reset a timeout to deactivate the current Player associated with the Account
          
          return account;
          /// =SERVER}
          
        };
        
        /// {CLIENT=
        actionizer.addAbility(lapse.getChild('me'), 'mod', 'private', true, actionizer.modObj); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        actionizer.addAbility(lapse.getChild('me.wantsOverlay'),  'mod', 'private', true, actionizer.modVal); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        actionizer.addAbility(lapse.getChild('me.creatingWorld'), 'mod', 'private', true, actionizer.modVal); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        actionizer.addAbility(lapse.getChild('me.account'),       'mod', 'private', true, actionizer.modRef); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        actionizer.addAbility(lapse.getChild('me.combatant'),     'mod', 'private', true, actionizer.modRef); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        actionizer.addAbility(lapse.getChild('me.world'),         'mod', 'private', true, actionizer.modRef); // TODO: VALIDATE THAT FOR PRIVATE, CLIENT CAN ALWAYS VALIDATE!
        /// =CLIENT}
        
        actionizer.addAbility(lapse, 'login', 'entrusted', false, function(lapse, data, stager) {
          
          var accountData = U.param(data, 'accountData');
          
          /// {SERVER=
          // Fails if invalid creds (which will fail the dependent client-side)
          // If the account already exists, simply returns success.
          var account = accessAccount(lapse, accountData.username, accountData.password);
          if (account) return account.getJson();
          /// =SERVER}
          
          stager(lapse.getChild('accountSet'), 'add', {
            username: accountData.username,
            password: accountData.password,
            fname: data.fname || 'Anony',
            lname: data.lname || 'Mous',
            player: null
          });
          
        });
        
        actionizer.addAbility(lapse.getChild('accountSet'), 'mod', 'entrusted', false, actionizer.modArr);
        actionizer.addAbility(lapse.getChild('accountSet'), 'add', 'entrusted', false, actionizer.addArr);
        actionizer.addAbility(lapse.getChild('accountSet'), 'rem', 'entrusted', false, actionizer.remArr);
        
        actionizer.addAbility(lapse.getChild('accountSet.account'), 'mod', 'entrusted', false, actionizer.modObj);
        actionizer.addAbility(lapse.getChild('accountSet.account.username'), 'mod', 'entrusted', false, actionizer.modVal);
        actionizer.addAbility(lapse.getChild('accountSet.account.password'), 'mod', 'entrusted', false, actionizer.modVal);
        actionizer.addAbility(lapse.getChild('accountSet.account.fname'), 'mod', 'entrusted', false, actionizer.modVal);
        actionizer.addAbility(lapse.getChild('accountSet.account.lname'), 'mod', 'entrusted', false, actionizer.modVal);
        actionizer.addAbility(lapse.getChild('accountSet.account.player'), 'mod', 'entrusted', false, actionizer.modRef);
        
        return;
        
        worldSet.addAbility('create', 'public', true, actionizer.makeAbility('create', function(worldSet, data, stager) {
          
          var lapse = worldSet.getChild('~root');
          
          var accountData = U.param(data, 'accountData');
          var account = accessAccount(lapse, accountData.username, accountData.password);
          if (!account) throw new Error('No account named "' + accountData.username + '"');
          
          // Create + sync world
          var worldData = U.param(data, 'worldData');
          var world = stager(worldSet, 'add', {
            quickName: worldData.quickName,
            account: account,
            name: worldData.name,
            mode: worldData.mode
          });
          
          // Automatically join the world upon creation
          stager(world, 'join', { data: { lapse: lapse, accountData: accountData } });
          
        }));
        world.addAbility('join', 'entrusted', true, actionizer.makeAbility('join', function(world, data, /* lapse, accountData */ stager) {
          
          // Note that in the case where worldSet.create() calls world.join(), `world` may
          // be unrooted. In that case, `data.lapse` must be available.
          var lapse = O.contains(data, 'lapse') ? data.lapse : world.getChild('~root');
          if (!lapse) throw new Error('Couldn\'t get root reference');
          
          var accountData = U.param(data, 'accountData');
          var account = accessAccount(lapse, accountData.username, accountData.password);
          if (!account) throw new Error('No account named "' + accountData.username + '"');
          
          // TODO: Validate that no player already exists on `account`
          var player = stager(lapse.getChild('playerSet'), 'add', {
            /// {SERVER=
            sync: 'quick',
            sessions: 'peers',
            /// =SERVER}
            data: {
              username: account.getValue('username'),
              /// {SERVER=
              ip: stager.session.ip,
              /// =SERVER}
              joinTime: U.timeMs(),
              world: world,
              combatant: null
            }
          });
          
          // Update the client's Account reference to the client's Player
          stager(account.getChild('player'), 'mod', { data: player });
          
          /// {CLIENT=
          stager(lapse.getChild('me.world'), 'mod', { data: world });
          stager(lapse.getChild('me.@account.player'), 'mod', { data: player });
          /// =CLIENT}
          
          /// {SERVER=
          stager(world, 'sync', { data: {}, sync: 'quick', sessions: [ stager.session ] });
          /// =SERVER}
          
        }));
        world.addAbility('respawn', actionizer.makeAbility('respawn', function(world, data, stager) {
          
          var lapse = world.getChild('~root');
          var accountData = U.param(data, 'accountData');
          var account = accessAccount(lapse, accountData.username, accountData.password);
          
          var player = account.getChild('@player');
          if (!player) throw new Error('No player exists');
          
          var combatant = stager(world, 'addCombatant', {
            /// {SERVER=
            sync: 'quick',
            sessions: 'peers',
            /// =SERVER}
            data: { player: player }
          });
          
          stager(account.getChild('@player.combatant'), 'mod', { data: combatant });
          
          /// {CLIENT=
          stager(world.getChild('~root.me.combatant'), 'mod', { data: combatant });
          /// =CLIENT}
          
        }));
        world.addAbility('addCombatant', actionizer.makeAbility('addCombatant', function(world, data, stager) {
          
          var player = U.param(data, 'player');
          
          var gruntInstance = stager(world.getChild('~root.roleTypeSet.grunt.instanceSet'), 'add', {
            data: {
              player: player,
              maximumHp: 10,
              currentHp: 10,
              x: parseInt((Math.random() * 20) - 10),
              y: parseInt((Math.random() * 20) - 10),
              rot: 0
            }
          });
          var combatant = stager(world.getChild('combatantSet'), 'add', {
            data: {
              player: player,
              roleInstance: gruntInstance
            }
          });
          
          return combatant;
          
        }));
        
      },
      genOutlineData: function() {
        
        /// {CLIENT=
        return {};
        /// =CLIENT}
        
        /// {SERVER=
        return {
          worldSet: {
            sandbox1: {
              quickName: 'sandbox1',
              account: null,
              name: 'Sandbox 1',
              mode: 'standard'
            },
            sandbox2: {
              quickName: 'sandbox2',
              account: null,
              name: 'Sandbox 2',
              mode: 'standard'
            }
          }
        };
        /// =SERVER}
        
      },
      run: function(lapse, actionizer) {
        
        /// {SERVER=
        var update = function(timeMult) {
          lapse.useUtility('update', timeMult);
        };
        var delayMs = 50;
        setInterval(update.bind(null, delayMs / 1000), delayMs); // `delayMs / 1000` gives a multiplier for (units/second)
        /// =SERVER}
        
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
              
            }})
          ]}));
          
          return children;
          
          //return new uf.SetView({ name: name, cssClasses: [ 'form' ], children: children });
          
        };
        
        var creatingWorld = new nf.ValueInformer({ value: false });
        var canvas = new cv.CanvasView({ name: 'canvas', options: { centered: true, trackKeys: true, trackMouse: true },
          setupControls: function() {
            
          },
          drawFunc: function(graphics, millis) {
            
            var world = lapse.getChild('me.@world');
            if (!world) return;
            
            var combatants = world.getChild('combatantSet').children;
            for (var k in combatants) combatants[k].useUtility('draw', graphics);
            
          }
        });
        
        // Input
        canvas.keyInformer.addWorry('invalidated', function(val) {
          
          var player = lapse.getChild('me.@account.@player');
          if (!player) return;
          
          player.getChild('keyInput').$useAbility('mod', {
            data: {
              l: O.contains(val, 65),
              r: O.contains(val, 68),
              d: O.contains(val, 83),
              u: O.contains(val, 87)
            },
            sync: 'quick',
            propagate: false
          });
          
        });
        canvas.mouseInformer.addWorry('invalidated', function(val) {
          
          var player = lapse.getChild('me.@account.@player');
          if (!player) return;
          
          var pt = val.pt;
          var buttons = val.buttons;
          
          player.getChild('mouseInput').$useAbility('mod', {
            data: {
              pt: pt,
              buttons: buttons
            },
            sync: 'quick',
            propagate: false
          });
          
        });
        
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
                    
                    var accountRef = lapse.getChild('me.account');
                    
                    return new P({ all: [
                      
                      //accountRef.$useAbility('mod', { data: accountRef.genValue(data.username) }),
                      actionizer.$do(accountRef, 'mod', accountRef.genValue(data.username)),
                      actionizer.$do(lapse, 'login', { accountData: data })
                    ]});
                    
                  })
                })
              ]}),
              new uf.SetView({ name: 'lobby', cssClasses: [ 'choice', 'filler', 'titled' ], children: [
                new uf.TextView({ name: 'title', info: 'Lobby' }),
                new uf.TextView({ name: 'toggleCreating',
                  info: new nf.CalculationInformer({
                    dependencies: [ lapse.getChild('me.creatingWorld') ],
                    calc: function(isCreatingWorld) { return isCreatingWorld ? 'Back' : 'Create' }
                  }),
                  decorators: [
                    new uf.ActionDecorator({ action: lapse.getChild('me.creatingWorld').as('modValue', function(v) { return !v; }) })
                  ]
                }),
                new uf.ChoiceView({ name: 'options', cssClasses: [ 'chooser', 'content' ], transitionTime: 550,
                  choiceInfo: new nf.CalculationInformer({
                    dependencies: [ lapse.getChild('me.creatingWorld') ],
                    calc: function(isCreatingWorld) { return isCreatingWorld ? 'worldCreate' : 'worldListing'; }
                  }),
                  children: [
                    new uf.DynamicSetView({ name: 'worldListing', cssClasses: [ 'choice', 'filler' ],
                      childInfo: lapse.getChild('worldSet'),
                      genChildView: function(name, world) {
                        return new uf.SetView({ name: name, cssClasses: [ 'world' ], children: [
                          new uf.SetView({ name: 'name', cssClasses: [ 'data' ], children: [
                            new uf.TextView({ name: 'title', info: 'Name' }),
                            new uf.TextView({ name: 'value', info: world.getChild('name') })
                          ]}),
                          new uf.SetView({ name: 'mode', cssClasses: [ 'data' ], children: [
                            new uf.TextView({ name: 'title', info: 'Mode' }),
                            new uf.TextView({ name: 'value', info: world.getChild('mode') })
                          ]}),
                          new uf.TextView({ name: 'enter', info: 'Enter', decorators: [
                            new uf.ActionDecorator({ $action: function() {
                              return world.$useAbility('join', {
                                data: {
                                  accountData: credInfo.getValue()
                                },
                                sync: 'quick',
                                propagate: false
                              });
                            }})
                          ]})
                        ]})
                      }
                    }),
                    new uf.SetView({ name: 'worldCreate', cssClasses: [ 'choice', 'titled', 'filler' ], children: [
                      new uf.TextView({ name: 'title', info: 'Create' }),
                      new uf.SetView({ name: 'form', cssClasses: [ 'content' ],
                        children: genFormChildren([ 'quickName', 'name', 'mode' ], function(worldData) {
                          
                          return lapse.getChild('worldSet').$useAbility('create', {
                            data: {
                              worldData: worldData,
                              accountData: credInfo.getValue()
                            },
                            sync: 'quick',
                            propagate: false
                          });
                          
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
                    
                    if (!combatant) return 'respawn';
                    
                    canvas.requestFocus();
                    return 'hud';
                    
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
                          sync: 'quick',
                          propagate: false
                        });
                        
                      }})
                    ]})
                    
                  ]}),
                  new uf.SetView({ name: 'hud', cssClasses: [ 'filler' ], children: [
                    new uf.SetView({ name: 'vitals', children: [
                      
                    ]})
                  ]})
                  
                ]
              })
            ]
          }),
          canvas
          
        ]});
        view.start();
        
        /// {DE/BUG=
        view.getChild('overlay.login.form.username').info.setValue('gershy');
        view.getChild('overlay.login.form.password').info.setValue('imsosmart');
        view.getChild('overlay.lobby.options.worldCreate.form.quickName').info.setValue('gershyworld');
        view.getChild('overlay.lobby.options.worldCreate.form.name').info.setValue('Gershy World');
        view.getChild('overlay.lobby.options.worldCreate.form.mode').info.setValue('standard');
        /// =DE/BUG}
        
        window.view = view;
        window.doss = lapse;
        
        // lapse.getChild('worldSet').$useAbility('sync', {}).done();
        /// =CLIENT}
        
      }
      
    }).$start().done();
    
  }
});
package.build();
