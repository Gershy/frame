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
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(lapse) {
        
        var Val = ds.Val, Obj = ds.Obj, Arr = ds.Arr, Ref = ds.Ref;
        
        /// {CLIENT=
        // >> Me
        var me = lapse.addChild(new Obj({ name: 'me' }));
        me.addChild(new Val({ name: 'wantsOverlay', dossClass: ds.DossierBln, defaultValue: false }));
        me.addChild(new Val({ name: 'creatingWorld', dossClass: ds.DossierBln, defaultValue: false }));
        me.addChild(new Ref({ name: 'account', format: '~root.accountSet.$account' }));
        me.addChild(new Ref({ name: 'combatant', format: '~root.worldSet.$world.combatantSet.$combatant' }));
        me.addChild(new Ref({ name: 'roleInstance', format: '~root.roleTypeSet.$type.instanceSet.$instance' }));
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
        combatant.addChild(new Ref({ name: 'player', format: '~root.playerSet.$player' }));
        combatant.addChild(new Ref({ name: 'roleInstance', format: '~root.roleTypeSet.$type.instanceSet.$instance' }));
        
      },
      setupActions: function(lapse, actionizer) {
        
        var accessAccount = function(lapse, username, password) {
          
          /// {CLIENT=
          var account = lapse.getChild('me.@account');
          if (!account) return null;
          if (account.name !== username) throw new Error('Unauthorized');
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
        var requireAccount = function(lapse, username, password) {
          
          var account = accessAccount(lapse, username, password);
          if (!account) throw new Error('No account named "' + username + '"');
          return account;
          
        };
        var getAccount = function(lapse, stager, account) {
          
          if (!lapse) throw new Error('Missing `lapse`');
          
          // Gets the current account. The `account` param implies that a particular
          // account is desired. If `account` is supplied, and the current account
          // is different from `account`, this function returns `null`.
          var specificAccount = !!account;
          if (U.isObj(account, String)) account = lapse.getChild(account);
          
          /// {CLIENT=
          var myAccount = lapse.getChild('me.@account');
          /// =CLIENT}
          /// {SERVER=
          var sessionData = stager.session.getData('twig.lapse');
          var myAccount = sessionData ? sessionData.account : null;
          /// =SERVER}
          
          return specificAccount
            ? (myAccount === account ? myAccount : null)
            : myAccount;
          
        };
        
        actionizer.addAbility(lapse, 'display', 'public', true, actionizer.display);
        
        /// {CLIENT=
        actionizer.recurse(lapse.getChild('me'), 'private', true);
        /// =CLIENT}
        
        actionizer.addAbility(lapse, 'login', 'entrusted', false, function(lapse, data, stager) {
          
          var accountData = U.param(data, 'accountData');
          var account =
            accessAccount(lapse, accountData.username, accountData.password) ||
            stager(lapse.getChild('accountSet'), 'add', {
              username: accountData.username,
              password: accountData.password,
              fname: data.fname || 'Anony',
              lname: data.lname || 'Mous',
              player: null
            });
          
          /// {SERVER=
          stager.session.setData('twig.lapse', { account: account });
          return {
            accountData: account.hasResolvedName() ? account.getJson() : accountData,
            worldSetData: O.map(lapse.getChild('worldSet').children, function(world) {
              
              return {
                quickName: world.getValue('quickName'),
                account: world.getValue('account'),
                name: world.getValue('name'),
                mode: world.getValue('mode'),
                combatantSet: {}
              };
              
            })
          };
          /// =SERVER}
          
          /// {CLIENT=
          stager(lapse.getChild('me.account'), 'mod', account);
          var worldSetData = U.param(data, 'worldSetData', null);
          if (worldSetData) stager(lapse.getChild('worldSet'), 'mod', worldSetData);
          /// =CLIENT}
          
        });
        actionizer.addAbility(lapse, 'createWorld', 'public', false, function(lapse, data, stager) {
          
          var worldData = U.param(data, 'worldData');
          
          var account = getAccount(lapse, stager, worldData.account);
          var world = stager(lapse.getChild('worldSet'), 'add', {
            quickName: worldData.quickName,
            account: account, // TODO: Server requires `account` to always be non-null
            name: worldData.name,
            mode: worldData.mode
          });
          
          /// {CLIENT=
          if (account) stager.$do(world, 'join', {}); // If we created the world, immediately join it
          /// =CLIENT}
          /// {SERVER=
          return {
            worldData: {
              quickName: worldData.quickName,
              account: account,
              name: worldData.name,
              mode: worldData.mode,
            }
          };
          /// =SERVER}
          
        });
        actionizer.addAbility(lapse.getChild('worldSet.world'), 'join', 'public', false, function(world, data, stager) {
          
          var lapse = world.getChild('~root');
          var account = getAccount(lapse, stager, data.account);
          
          /// {SERVER=
          if (!account) throw new Error('No account');
          // TODO: ip will be broadcasted to other sessions even if it won't be persisted
          // in their Dossier structures. Probably need a "scrub" or "sanitizeResult" type
          // of thing applied to playerSet's abilities, preventing certain properties from
          // being broadcasted
          
          var username = account.getValue('username');
          
          stager.$do(lapse.getChild('playerSet'), 'add', {
            
            username: username,
            ip: stager.session.ip,
            joinTime: U.timeMs(),
            world: world,
            combatant: null
            
          }).then(function(player) {
            
            return new P({ all: [
              
              // Add a combatant for the player
              stager.$do(world.getChild('combatantSet'), 'add', {
                player: player,
                roleInstance: null
              }),
              
              // Add the player to the account
              stager.$do(account.getChild('player'), 'mod', player)
              
            ]});
            
          }).done();
          
          return {
            account: account,
            playerRef: [ username ],
            combatantRef: [ world.name, username ],
            combatantData: world.getChild('combatantSet').getJson()
          };
          /// =SERVER}
          
          /// {CLIENT=
          if (account) {
            var playerRef = U.param(data, 'playerRef');
            var combatantRef = U.param(data, 'combatantRef');
            stager(account.getChild('player'), 'mod', playerRef);
            stager(lapse.getChild('me.world'), 'mod', world);
            stager(lapse.getChild('me.combatant'), 'mod', combatantRef);
            stager(world.getChild('combatantSet'), 'mod', data.combatantData);
          }
          /// =CLIENT}
          
        });
        actionizer.addAbility(lapse.getChild('worldSet.world'), 'respawn', 'entrusted', false, function(world, data, stager) {
          
          var lapse = world.getChild('~root');
          var account = getAccount(lapse, stager);
          if (!account) throw new Error('No account');
          
          var player = account.getChild('@player');
          if (!player) throw new Error('No player');
          
          /// {SERVER=
          var roleType = 'grunt';
          var roleInstanceData = {
            player: player,
            currentHp: 100,
            x: Math.round((Math.random() * 100) - 50),
            y: Math.round((Math.random() * 100) - 50),
            rot: 0
          };
          
          var instanceSet = lapse.getChild([ 'roleTypeSet', roleType, 'instanceSet' ]);
          stager.$do(instanceSet, 'add', roleInstanceData).then(function(instance) {
            
            return stager.$do(world.getChild([ 'combatantSet', player.name, 'roleInstance' ]), 'mod', instance);
            
          }).done();
          
          return {
            roleInstance: [ roleType, player.name ]
          };
          /// =SERVER}
          
          /// {CLIENT=
          stager(lapse.getChild('me.roleInstance'), 'mod', data.roleInstance);
          // setTimeout(lapse.getChild('me.roleInstance').as('worry', 'invalidated'), 200);
          /// =CLIENT}
          
        });
        actionizer.addAbility(lapse.getChild('worldSet.world'), 'keyInput', 'entrusted', true, function(world, data, stager) {
          
          var account = getAccount(world.getChild('~root'), stager);
          if (!account) throw new Error('No account');
          
          var player = account.getChild('@player');
          if (!player) throw new Error('No player');
          
          // TODO: Validate `data` format
          stager(player.getChild('keyInput'), 'mod', data);
          
        });
        actionizer.addAbility(lapse.getChild('worldSet.world'), 'mouseInput', 'entrusted', true, function(world, data, stager) {
          
          var account = getAccount(world.getChild('~root'), stager);
          if (!account) throw new Error('No account');
          
          var player = account.getChild('@player');
          if (!player) throw new Error('No player');
          
          // TODO: Validate `data` format
          stager(player.getChild('mouseInput'), 'mod', data);
          
        });
        
        var getWorldSessions = function(allSessions, worldChild) {
          /// {SERVER=
          var worldOutline = worldChild.getRoot().outline.getChild('worldSet.world');
          while (worldChild.outline !== worldOutline) worldChild = worldChild.par;
          
          var world = worldChild;
          // TODO: Very inefficient
          var sessions = {};
          var players = world.getChild('~root.playerSet').children;
          for (var k in players) {
            if (players[k].getChild('@world') !== world) continue;
            var ip = players[k].getValue('ip');
            if (ip) sessions[ip] = ip;
          }
          return sessions;
          /// =SERVER}
        };
        actionizer.recurse(lapse.getChild('accountSet'), 'private', false);
        actionizer.recurse(lapse.getChild('playerSet'), 'serverSourced', false);
        actionizer.recurse(lapse.getChild('worldSet'), getWorldSessions, false);
        actionizer.recurse(lapse.getChild('roleTypeSet'), 'serverSourced', false);
        
        /// {SERVER=
        lapse.addUtility('update', function(lapse, timeMult) {
          
          // TODO: HEEERE; dynamic-machine-scoping basically works, but it's very
          // awkward depending on the doss on which the ability was called. E.g.
          // for ~root.worldSet.world.name, if that name changes the dynamic scoping
          // function will apply to the DossierStr holding the name, and we need to
          // walk all the way up to the parent ~root.worldSet.world. Even worse, for
          // roleType instances, there's no way to link to their world. Could
          // consider adding a "world" DossierRef at
          // ~root.roleTypeSet.$type.instanceSet.$instance but not ideal. Maybe
          // there's no other way though...
          var sessionsPerWorld = {};
          var players = lapse.getChild('playerSet').children;
          for (var k in players) {
            
            var ip = players[k].getValue('ip');
            var worldName = players[k].getChild('world').value[0];
            if (!O.contains(sessionsPerWorld, worldName)) sessionsPerWorld[worldName] = {};
            sessionsPerWorld[worldName][ip] = ip;
            
          }
          
          O.each(lapse.getChild('worldSet').children, function(world) {
            if (!O.contains(sessionsPerWorld, world.name)) return;
            world.useUtility('update', timeMult, sessionsPerWorld[world.name] || {});
          });
          
        });
        lapse.getChild('worldSet.world').addUtility('update', function(world, timeMult, sessions) {
          
          O.each(world.getChild('combatantSet').children, U.as('useUtility', 'update', timeMult, sessions));
          
        });
        lapse.getChild('worldSet.world.combatantSet.combatant').addUtility('update', function(combatant, timeMult, sessions) {
          
          var roleInstance = combatant.getChild('@roleInstance');
          if (roleInstance) roleInstance.useUtility('update', timeMult, sessions);
          
        });
        lapse.getChild('roleTypeSet.general.instanceSet.instance').addUtility('update', function(captain, timeMult, sessions) {
          throw new Error('not implemented');
        });
        lapse.getChild('roleTypeSet.captain.instanceSet.instance').addUtility('update', function(captain, timeMult, sessions) {
          throw new Error('not implemented');
        });
        lapse.getChild('roleTypeSet.grunt.instanceSet.instance').addUtility('update', function(grunt, timeMult, sessions) {
          
          var loc = { x: grunt.getValue('x'), y: grunt.getValue('y') };
          
          var keyInput = grunt.getValue('@player.keyInput');
          if (keyInput && (keyInput.l || keyInput.r || keyInput.d || keyInput.u)) {
            
            if (keyInput.l) loc.x -= (500 * timeMult);
            if (keyInput.r) loc.x += (500 * timeMult);
            if (keyInput.d) loc.y -= (500 * timeMult);
            if (keyInput.u) loc.y += (500 * timeMult);
            
            actionizer.$do(grunt, 'mod', loc, null, null, sessions).done();
            
          }
          
        });
        /// =SERVER}
        
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
      run: function(lapse, actionizer, $act) {
        
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
          
        };
        
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
          
          if (!lapse.getChild('me.@account.@player')) return;
          actionizer.$do(lapse.getChild('me.@world'), 'keyInput', {
            l: O.contains(val, 65),
            r: O.contains(val, 68),
            d: O.contains(val, 83),
            u: O.contains(val, 87)
          }).done();
          
        });
        canvas.mouseInformer.addWorry('invalidated', function(val) {
          
          if (!lapse.getChild('me.@account.@player')) return;
          actionizer.$do(lapse.getChild('me.@world'), 'mouseInput', {
            pt: val.pt,
            buttons: val.buttons
          }).done();
          
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
                    
                    return actionizer.$do(lapse, 'login', { accountData: data });
                    // var accountRef = lapse.getChild('me.account');
                    // return new P({ all: [
                    //   // actionizer.$do(accountRef, 'mod', accountRef.genValue(data.username)),
                    // ]});
                    
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
                    // new uf.ActionDecorator({ $action: actionizer.as('$do', lapse.getChild('me.creatingWorld'), 'mod', function(v) { return !!v; }) })
                    new uf.ActionDecorator({ $action: $act('me.creatingWorld', 'mod', function(v) { return !v; }) })
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
                            new uf.ActionDecorator({ $action: actionizer.as('$do', world, 'join', {}) })
                          ]})
                        ]})
                      }
                    }),
                    new uf.SetView({ name: 'worldCreate', cssClasses: [ 'choice', 'titled', 'filler' ], children: [
                      new uf.TextView({ name: 'title', info: 'Create' }),
                      new uf.SetView({ name: 'form', cssClasses: [ 'content' ],
                        children: genFormChildren([ 'quickName', 'name', 'mode' ], function(worldData) {
                          
                          return actionizer.$do(lapse, 'createWorld', {
                            worldData: worldData
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
                      dependencies: [ lapse.getChild('me.roleInstance'), lapse.getChild('me.wantsOverlay') ],
                      calc: function(roleInstance, wantsOverlay) {
                        
                        if (wantsOverlay) return 'show';
                        return roleInstance ? 'hide' : 'show'; // If no roleInstance, always show
                        
                      }
                    })
                  })
                ],
                choiceInfo: new nf.CalculationInformer({
                  dependencies: [ lapse.getChild('me.roleInstance') ],
                  calc: function(roleInstance) {
                    
                    if (!roleInstance) return 'respawn';
                    
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
                        
                        return actionizer.$do(lapse.getChild('me.@world'), 'respawn', {
                          accountData: credInfo.getValue()
                        });
                        
                        /*return lapse.getChild('me.@world').$useAbility('respawn', {
                          data: {
                            accountData: credInfo.getValue()
                          },
                          sync: 'quick',
                          propagate: false
                        });*/
                        
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
        window.actionizer = actionizer;
        window.doss = lapse;
        
        //actionizer.$do(lapse.getChild('worldSet'), 'sync', {}).done();
        /// =CLIENT}
        
      }
      
    }).$start().done();
    
  }
});
package.build();
