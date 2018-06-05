var package = new PACK.pack.Package({ name: 'accounts',
  /// {SERVER=
  dependencies: [ 'p', 'dossier', 'server', 'actionizer', 'app' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'p', 'dossier', 'server', 'actionizer', 'app', 'userify' ],
  /// =CLIENT}
  buildFunc: function(accounts, p, ds, sv, az, ap, uf) {
    
    accounts.DossierAccount = U.makeClass({ name: 'DossierAccount',
      superclass: ds.DossierObj,
      methods: function(sc, c) { return {
        
      };}
    });
    accounts.makeUserData = function(actionizer, channeler) {
      
      // ==== Outline
      var userData = new ds.Obj({ name: 'userData' });
      
      var activeUserSet = userData.addChild(new ds.Arr({ name: 'activeUserSet' }));
      var activeUser = activeUserSet.setTemplate(new ds.Obj({ name: 'activeUser' }), function(activePlayer) { return activePlayer.getValue('@account.username'); });
      activeUser.addChild(new ds.Ref({ name: 'account', defaultValue: '~par.accountSet.anon' }));
      activeUser.addChild(new ds.Val({ name: 'loginTime', dossClass: ds.DossierInt }));
      /// {SERVER=
      activeUser.addChild(new ds.Val({ name: 'ip' }));
      activeUser.addDecorator(function(activeUser) {
        
        activeUser.getChild('account').addWorry('invalidated', function(val) {
          
          console.log('ACCOUNT CHANGED:', val);
          
        });
        
      });
      /// =SERVER}
      
      var accountSet = userData.addChild(new ds.Arr({ name: 'accountSet' }));
      var account = accountSet.setTemplate(new ds.Obj({ name: 'account' }), function(account) { return account.getValue('username'); });
      account.addChild(new ds.Val({ name: 'fname' }));
      account.addChild(new ds.Val({ name: 'lname' }));
      account.addChild(new ds.Ref({ name: 'activeUser' }));
      account.addChild(new ds.Val({ name: 'username' }));
      /// {SERVER=
      account.addChild(new ds.Val({ name: 'password' }));
      account.addChild(new ds.Arr({ name: 'groupSet' }))
        .setTemplate(new ds.Val({ name: 'group' }), function(group) { return group.getValue(); });
      /// =SERVER}
      
      // ActiveUser and Account point at each other
      activeUser.getChild('account').target = account;
      account.getChild('activeUser').target = activeUser;
      
      /// {SERVER=
      // TODO: Clear all activeUsers on startup
      // ==== Session detection
      channeler.addWorry('sessionAdded', function(session) {
        
        var $activeUser = actionizer.$do(activeUserSet, 'add', {
          loginTime: +new Date(),
          ip: session.ip
        });
        
        session.setData('twig.accounts', {
          $activeUser: $activeUser
        });
        
      });
      /// =SERVER}
      
      // ==== Actions
      actionizer.addAbility(activeUser, new az.DossierAction({ name: 'login', clientResolves: false, clientVerifies: false,
        /// {SERVER=
        func: function(root, doss, params, stager) {
          
          var username = U.param(params, 'username');
          var password = U.param(params, 'password');
          console.log('Logging in:', username, password);
          
          if (!O.contains(accountSet.children, username)) throw new Error('Invalid "username"');
          
          var account = accountSet.children[username];
          
          if (account.getValue('password') !== password) throw new Error('Couldn\'t authenticate');
          
          session.getData('twig.accounts').$activeUser.then(function(activeUser) {
            
            var sessions = {};
            sessions[session.ip] = session;
            return stager.$do(activeUser, 'mod', { account: account }, null, null, sessions);
            
          }).done();
          
        }
        /// =SERVER}
      }));
      
      return {
        outline: userData,
        animateOutline: function(params /* name, memberSet, rootOutlines */) {
          
          var memberSet = U.param(params, 'memberSet');
          
          // Worry about inner outlines propagating invalidations to the full memberSet
          var applyAnimation = function(outline) {
            
            outline.addDecorator(function(doss) {
              
              // TODO: Only inform client side from the Dossier which was the ROOT for the ability
              doss.addWorry('rootInvalidated', function(val) {
                
                // TODO: Use the channeler to inform every session provided by the memberSet
                // of the results of this ability
                
              });
              
            });
            
          };
          
          // TODO: Worry about each "rootOutline" in the Array fully syncing every
          // member who joins (listen for invalidations on memberSet)
          
          return new nf.CalculationInformer({
            dependencies: [ params.memberSet ]
          });
          
          var name = U.param(params, 'name');
          
          var memberSet = U.param(params, 'memberSet', null);
          var rootOutlines = U.param(params, 'rootOutlines', null);
          
          var membersInformer = U.param(params, 'membersInformer', null);
          
          userData.animate({
            name: 'group1',
            memberSet: data1.getChild('memberSet'),
            rootOutlines: [
              data1.getChild('valueSet')
            ]
          });
          
        },
        animateDoss: function(params /* name, doss, membersInformer, rootDoss */) {
          
          
          
        }
      };
      
    };
    
  },
  runAfter: function(accounts, p, ds, sv, az, ap, uf) {
    
    var App = ap.App;
    var P = p.P;
    
    new App({ name: 'accounts',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        // channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupOutline: function(accountsOutline, actionizer, channeler) {
        
        var userData = accounts.makeUserData(actionizer, channeler);
        var accountOutline = userData.outline.getChild('accountSet.account');
        
        accountsOutline.addChild(userData.outline);
        
        var data1 = accountsOutline.addChild(new ds.Obj({ name: 'data1' }));
        data1.addChild(new ds.Arr({ name: 'memberSet' }))
          .setTemplate(new ds.Ref({ name: 'member', target: accountOutline }));
        data1.addChild(new ds.Arr({ name: 'valueSet' }))
          .setTemplate(new ds.Val({ name: 'value', defaultValue: 'data' }));
        
        userData.animate({
          name: 'group1',
          memberSet: data1.getChild('memberSet'),
          rootOutlines: [
            data1.getChild('valueSet')
          ]
        });
        
        var data2 = accountsOutline.addChild(new ds.Obj({ name: 'data2' }));
        data2.addChild(new ds.Arr({ name: 'memberSet' }))
          .setTemplate(new ds.Ref({ name: 'member', target: accountOutline }));
        data2.addChild(new ds.Arr({ name: 'valueSet' }))
          .setTemplate(new ds.Val({ name: 'value', defaultValue: 'data' }));
        
        userData.animate({
          name: 'group2',
          memberSet: data2.getChild('memberSet'),
          rootOutlines: [
            data2.getChild('valueSet')
          ]
        });
        
      },
      setupActions: function(accounts, actionizer) {
        
      },
      genOutlineData: function() {
        
        return {
          userData: {
            activeUserSet: {
            },
            accountSet: {
              anon: {
                fname: 'Anony',
                lname: 'Mous',
                activeUser: null,
                username: 'anon',
                password: '',
                groupSet: {}
              },
              gersh: {
                fname: 'Gersh',
                lname: 'Maes',
                activeUser: null,
                username: 'gershy',
                password: 'imsosmart',
                groupSet: {}
              }
            }
          },
          data1: {
            memberSet: {},
            valueSet: {
              aaa: 'aaa',
              bbb: 'bbb'
            }
          },
          data2: {
            memberSet: {},
            valueSet: {
              ccc: 'ccc'
            }
          }
        };
        
      },
      run: function(accounts, actionizer, $act) {
        
        console.log(accounts.getJson());
        
        /// {CLIENT=
        var view = new uf.RootView({ name: 'root', children: [
          
          new uf.TextView({ name: 'title', info: 'ACCOUNTS' })
          
        ]});
        view.start();
        
        window.view = view;
        window.actionizer = actionizer;
        window.doss = accounts;
        
        /// =CLIENT}
        
      }
      
    }).$start().done();
    
  }
});
package.build();
