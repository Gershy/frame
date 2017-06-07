/*

NEAR-TERM:
- Get relations sorted out
  - Should be implemented through a decorator
  - Physics decorator should allow for a function that determines gravitational strength between any 2 nodes
  - Canvas graphics to link relations to the `._interactive` elements of standing theories
- animation + delay on theory deletion
- Circularity between atoms (e.g. atom1 challenges atom2, atom2 supports atom1) results in stack overflow
- Need other sources which can load atoms
  - all the user's atoms
  - all of any user's atoms
  - all the atoms within an argument
- Dragging a node to a dropzone throws an error if the cursor is simultaneously hovering over an "addDependency" dropzone

INDEFINITE:
- Info objects should have an "altered" broadcast ability
  - No changes should occur unless there have been alterations
  - e.g. SetViews shouldn't update unless any relevant data has updated
  - Could make CachedInfo obsolete...
- equivalent of validateSetValue for sets; allow native insertion/removal of elements from sets
  - And OOP server queries:
    - `doss.getClientChild('theorySet.newTheory.@essay.markup').$setValue('some new essay markup value')`
    - `doss.getClientChild('theorySet').$addDossier({ quickName: 'newTheory', title: 'New Theory', user: 'userSet.admin', essay: { markup: 'This theory is new.' } })`
      - This one is especially tricky; need defaults for "editedTime" and "createdTime", but also need to get the user from a reference and generate a new "essay" from raw data
      - The baseAddress of a theory's essay reference can inform which dossier the raw essay data conforms to
    - `doss.getClientChild('theorySet').$remDossier('newTheory')
- The current paradigm makes handling server-side deletes awkward. Need to detect and delete. Dis a bad sign?
- Essay can't validate with `verifySetValue` because it has no notion of the user who owns it
- Error reporting (toast-style notifications on errors)
- Long-polling support? (for use with RepeatingSyncedInfo - although RepeatingSyncedInfo should be unaware of whether or not it is long-polling)
- Get rid of persistent sessions...?
- Dependency/support loading should trigger a search (only within those dependencies/supports) for very large sets (to avoid hundreds of theories being loaded on-click)
- Need a way of preventing tons of views, all wired to the same Info, from running the same calculation over and over again (caching + reset() called before main update)
- When a database is implemented `someDoss.getChild(...)` will need to become `someDoss.$getChild(...)` (which is a pity)
- Can automatic defeat of challenges ensure that only axioms remain challengable?
  - There should be limited ways to reject a supported theory
    - Should be prompted to reject the support instead of the theory
    - Only exception: rejecting a theory on the basis of missing support
      - Should automatically create a new empty theory supporting that theory,
        and add a challenge against that support. This challenge should be
        automatically defeated as soon as the support is filled in.
- There's a flicker on page-load (a stylesheet is not applying on the 1st frame I think)
- Minification (and once files are being pre-processed, programatic separation between client/server)
- Security issues
  - Username/password is sent via plaintext
  - No restriction on $doRequest requesting sensitive fields
  - Session creation is a hazard

*/

var package = new PACK.pack.Package({ name: 'logic',
  dependencies: [ 'quickDev', 'userify', 'userifyNodePhysics', 'p', 'queries', 'geom' ],
  buildFunc: function(packageName, qd, userify, userifyNodePhysics, p) {
    
    var lg = {
      resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
      versionString: '0.0.1',
      theoryNameRegex: /^[a-z][a-zA-Z]+$/,
      LogicApp: U.makeClass({ name: 'LogicApp',
        superclass: PACK.quickDev.DossierDict,
        methods: function(sc, c) { return {
          validateTheoryName: function(name) {
            
            if (name.length > 24)
              return { valid: false, msg: 'theoryName.tooLong' };
            
            if (name.length < 3)
              return { valid: false, msg: 'theoryName.tooShort' };
            
            if (!lg.theoryNameRegex.test(name))
              return { valid: false, msg: 'theoryName.invalid' };
            
            if (name in this.children.theorySet.children)
              return { valid: false, msg: 'theoryName.unavailable' };
              
            // Another possible value is 'theoryName.overwrite' - when the user tries
            // to create a new theory that has the same name as an old theory.
            
            return { valid: true };
            
          },
          $handleQuery: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (command === 'getToken') {
              
              var reqParams = U.param(params, 'params');
              var username = U.param(reqParams, 'username');
              var password = U.param(reqParams, 'password');
              
              var user = this.requireUser(username);
              if (user.getChild('password').getValue() !== password) throw new Error('Incorrect password');
              
              return PACK.p.$({
                username: user.getChild('username').getValue(),
                token: user.getToken()
              });
              
            } else if (command === 'validateTheoryName') {
              
              var reqParams = U.param(params, 'params');
              var name = U.param(reqParams, 'name');
              return PACK.p.$(this.validateTheoryName(name));
              
            } else if (command === 'saveTheory') { // TODO: Consider writing a TheorySet DossierDict subclass, and implementing this there?
              
              var reqParams = U.param(params, 'params');
              
              var token = U.param(reqParams, 'token');
              var quickName = U.param(reqParams, 'quickName');
              var theoryUsername = U.param(reqParams, 'username');
              var theoryTitle = U.param(reqParams, 'title');
              var theoryText = U.param(reqParams, 'theory');
              
              var type = U.param(reqParams, 'type');
              if (!~[ 'update', 'create' ].indexOf(type)) throw new Error('Invalid save type: "' + type + '"');
              
              // The theory's user needs to correspond to the user's token (users can only edit their own theories)
              var user = this.requireUser(theoryUsername, token);
              var theorySet = this.children.theorySet;
              var essaySet = this.children.essaySet;
              
              var timestamp = +new Date();
              var editor = new qd.Editor();
              
              if (quickName in theorySet.children) {
                
                if (type === 'create') throw new Error('theoryName.overwrite');
                
                var origTheory = theorySet.children[quickName];
                
                // The theory already exists, but doesn't belong to `user`
                if (origTheory.getChild('user') !== user) throw new Error('theoryName.unavailable');
                
                console.log('Updating theory ' + origTheory.getAddress());
                var $theory = PACK.p.$(origTheory);
                
              } else {
                
                var valid = this.validateTheoryName(quickName);
                if (!valid.valid) throw new Error(valid.msg);
                
                console.log('Saving theory to ' + theorySet.getAddress());
                var essaySet = this.children.essaySet;
                
                var $theory = editor.$addFast({
                  par: essaySet,
                  data: {
                    markup: '- placeholder -'
                  }
                }).then(function(essay) {
                  
                  console.log('GOT ESSAY:', essay.getAddress());
                  
                  // Create the theory
                  return editor.$addFast({
                    par: theorySet,
                    name: quickName,
                    data: {
                      createdTime: timestamp,
                      editedTime: 0,
                      quickName: quickName,
                      title: '- placeholder -',
                      user: user,
                      essay: essay,
                      dependencySet: [],
                      challengeSet: [],
                      voterSet: []
                    }
                  });
                  
                })
                
              }
              
              return $theory.then(function(theory) {
                
                var $modTheory = editor.$modFast({ doss: theory, data: {
                  title: theoryTitle,
                  editedTime: timestamp
                }});
                
                var $modEssay = editor.$modFast({ doss: theory.getChild('@essay'), data: {
                  markup: theoryText
                }});
                
                return new PACK.p.P({ all: [ theory, $modTheory, $modEssay ] })
                
              }).them(function(theory) {
                
                console.log('GOT THEORY:', theory.getAddress());
                
                return theory.getDataView({});
                
              });
            
            } else if (command === 'deleteTheory') {
              
              var reqParams = U.param(params, 'params');
              
              var token = U.param(reqParams, 'token');
              var quickName = U.param(reqParams, 'quickName');
              
              var theorySet = this.children.theorySet;
              
              var theory = theorySet.children[quickName];
              if (!theory) throw new Error('Couldn\'t find theory named "' + quickName + '"');
              
              var user = theory.getChild('@user');
              this.requireUser(user, token);
              
              var editor = new qd.Editor();
              return editor.$remFast({ par: theorySet, name: theory.name }).then(function() {
                return {
                  msg: 'delete successful',
                  quickName: theory.name
                };
              });
              
            } else if (command === 'relateTheories') {
              
              var reqParams = U.param(params, 'params');
              
              var token = U.param(reqParams, 'token');
              
              var theorySet = this.children.theorySet;
              
              var standingQuickName = U.param(reqParams, 'standingQuickName');
              var standing = theorySet.children[standingQuickName];
              if (!standing) throw new Error ('Invalid standing quickName: "' + standingQuickName + '"');
              
              var incomingQuickName = U.param(reqParams, 'incomingQuickName');
              var incoming = theorySet.children[incomingQuickName];
              if (!incoming) throw new Error ('Invalid incoming quickName: "' + incomingQuickName + '"');
              
              if (incoming === standing) throw new Error('A theory cannot relate to itself');
              
              var relationType = U.param(reqParams, 'relationType');
              
              if (relationType === 'support') {
                
                if (standing.getChild([ 'challengeSet', incoming.name ]))
                  throw new Error(incoming.name + ' already challenges ' + standing.name + '. It cannot also support it.');
                
                console.log('Adding dependency');
                var editor = new qd.Editor();
                var $relation = editor.$addFast({
                  par: standing.getChild('dependencySet'),
                  name: incoming.name,
                  data: {
                    theory: incoming
                  }
                });
                
              } else if (relationType === 'challenge') {
                
                if (standing.getChild([ 'dependencySet', incoming.name ]))
                  throw new Error(incoming.name + ' already supports ' + standing.name + '. It cannot also challenge it.');
                
                console.log('Adding challenge');
                var editor = new qd.Editor();
                var $relation = editor.$addFast({
                  par: standing.getChild('challengeSet'),
                  name: incoming.name,
                  data: {
                    theory: incoming
                  }
                });
                
              } else {
                
                throw new Error('Invalid relationType: "' + relationType + '"');
                
              }
              
              return $relation.then(function(data) {
                return standing.getDataView({});
              });
              
            } else if (command === 'searchTheories') {
              
              var reqParams = U.param(params, 'params');
              
              var searchTerm = U.param(reqParams, 'searchTerm');
              
              var theories = this.children.theorySet.children;
              var matched = {};
              
              for (var k in theories) {
                if (theories[k].matchesSearchTerm(searchTerm))
                  matched[k] = theories[k].overviewData()
              }
              
              return new PACK.p.P({ val: matched });
              
            } else if (command === 'fullData') {
              
              return new PACK.p.P({ val: this.getDataView({}) });
              
            }
            
            return sc.$handleQuery.call(this, params);
          },
          requireUser: function(user, token) {
            if (U.isObj(user, String)) {
              var username = user;
              user = this.getChild([ 'userSet', user ]);
              if (!user) throw new Error('Couldn\'t find user "' + username + '"');
            } else if (!U.isInstance(user, lg.LogicUser)) {
              throw new Error('Invalid user type: ' + user);
            }
            
            if (token && user.getToken() !== token) throw new Error('Incorrect token for user "' + user.name + '"');
            return user;
          }
        };}
      }),
      LogicUser: U.makeClass({ name: 'LogicUser',
        superclass: PACK.quickDev.DossierDict,
        methods: function(sc, c) { return {
          getToken: function(user) {
            var u = this.getChild('username').getValue();
            var p = this.getChild('password').getValue();
            
            var str = '';
            var val = 9;
            var chars = '0ab45cd21ef58gh02ij0klm0no23p9qr62stu92vwxyz5AB8C0D37EF5GH7I4JKL2M4NO4PQR6ST8U39VW9998XYZ';
            
            for (var i = 0; i < 12; i++) {
              var v1 = u[(val + 19) % u.length].charCodeAt(0);
              var v2 = p[((val * val) + 874987) % p.length].charCodeAt(0);
              val = ((v1 + 3) * (v2 + 11) * 11239) + 3 + i + v1;
              str += chars[val % chars.length];
            }
            
            return str;
          }
        };}
      }),
      LogicTheory: U.makeClass({ name: 'LogicTheory',
        superclass: PACK.quickDev.DossierDict,
        methods: function(sc, c) { return {
          matchesSearchTerm: function(term) {
            var termLwr = term.toLowerCase();
            
            return ~this.name.toLowerCase().indexOf(termLwr)
              || ~this.children.title.getLowerValue().indexOf(termLwr);
              // || ~this.getChild('@essay.markup).getLowerValue().indexOf(termLwr);
          },
          overviewData: function() {
            var theory = this.getChild('@essay.markup').getValue();
            if (theory.length > 50) theory = theory.substr(0, 50) + '...';
            
            return {
              username: this.getChild('@user').name,
              quickName: this.name,
              title: this.children.title.getValue(),
              theory: theory
            };
          }
        };}
      })
    };
    
    var verifyUser = function(user, params) {
      if (user.name !== U.param(params, 'username')) throw new Error('Wrong user');
      if (user.getToken() !== U.param(params, 'token')) throw new Error('Bad token');
    };
    var versioner = new qd.Versioner({ versions: [
      { name: 'initial',
        detect: function(doss) { return doss === null; },
        $apply: function(root) {
          
          var outline = new qd.Outline({ c: lg.LogicApp, p: { name: 'app' }, i: [
            { c: qd.DossierString, p: { name: 'version' } },
            { c: qd.DossierList, p: { name: 'userSet',
              innerOutline: { c: lg.LogicUser, i: [
                { c: qd.DossierString, p: { name: 'fname' } },
                { c: qd.DossierString, p: { name: 'lname' } },
                { c: qd.DossierString, p: { name: 'username' } },
                { c: qd.DossierString, p: { name: 'password' } }
              ]},
              prop: 'username/value'
            }},
            { c: qd.DossierList, p: { name: 'essaySet',
              innerOutline: { c: qd.DossierDict, i: [
                { c: qd.DossierString, p: { name: 'markup',
                  verifySetValue: function(markupDoss, params /* token, username */) { /* TODO: No way to check essay's user at the moment */ }
                }}
              ]}
            }},
            { c: qd.DossierList, p: { name: 'theorySet',
              innerOutline: { c: lg.LogicTheory, i: [
                { c: qd.DossierInt,     p: { name: 'createdTime', defaultValue: function() { return +new Date(); } } },
                { c: qd.DossierInt,     p: { name: 'editedTime', defaultValue: function() { return +new Date(); } } },
                { c: qd.DossierString,  p: { name: 'quickName' } },
                { c: qd.DossierString,  p: { name: 'title',
                  verifySetValue: function(titleDoss, params /* token, username */) { verifyUser(titleDoss.par.getChild('@user'), params); }
                }},
                { c: qd.DossierRef,     p: { name: 'user', baseAddress: '~root.userSet' } },
                { c: qd.DossierRef,     p: { name: 'essay', baseAddress: '~root.essaySet' } },
                { c: qd.DossierRef,     p: { name: 'duplicate', baseAddress: '~root.theorySet', defaultValue: function() { return null; } } },
                { c: qd.DossierList,    p: { name: 'dependencySet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
                  ]},
                  prop: '@theory.quickName/value',
                  defaultValue: function() { return []; }
                }},
                { c: qd.DossierList,    p: { name: 'challengeSet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
                  ]},
                  prop: '@theory.quickName/value',
                  defaultValue: function() { return []; }
                }},
                { c: qd.DossierList,    p: { name: 'voterSet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'user', baseAddress: '~root.userSet' } },
                    { c: qd.DossierInt, p: { name: 'value' } }
                  ]},
                  prop: '@user.username/value',
                  defaultValue: function() { return []; }
                }}
              ]},
              prop: 'quickName/value',
              verifyAddDossier: function(params /*  */) {}, // TODO: implement in quickDev
              verifyRemDossier: function(params /*  */) {}  // TODO: implement in quickDev
            }}
          ]});
          var data = {
            version: '0.0.1 (initial)',
            userSet: {},
            essaySet: {},
            theorySet: {}
          };
          
          var editor = new qd.Editor();
          var $app = editor.$create(outline, data);
          editor.resolveReqs();
          
          return $app;

        }
      },
      { name: 'add default data',
        detect: function(doss) { return !doss.getChild('userSet.admin'); },
        $apply: function(root) {
          
          var editor = new qd.Editor();
          
          var $addUsers = editor.$editFast({
            add: [
              {
                par: root.getChild('userSet'),
                data: {
                  fname: 'Admin',
                  lname: 'Istrator',
                  username: 'admin',
                  password: 'adminadmin123'
                }
              },
              {
                par: root.getChild('userSet'),
                data: {
                  fname: 'Another',
                  lname: 'User',
                  username: 'another',
                  password: 'anotheruseryay!'
                }
              }
            ]
          });
          
          var $addEssays = $addUsers.then(function(users) {
            return editor.$editFast({
              add: [
                {
                  par: root.getChild('essaySet'),
                  data: {
                    markup: 'Essay written by ' + users[0].name
                  }
                },
                {
                  par: root.getChild('essaySet'),
                  data: {
                    markup: 'I, ' + users[0].name + ', confirm that admin wrote this'
                  }
                },
                {
                  par: root.getChild('essaySet'),
                  data: {
                    markup: 'Essay written by ' + users[1].name
                  }
                }
              ]
            });
          });
          
          var $addTheories = new PACK.p.P({ all: [ $addUsers, $addEssays ] }).them(function(users, essays) {
            return editor.$editFast({
              add: [
                {
                  par: root.getChild('theorySet'),
                  name: 'userZeroTheory',
                  data: {
                    createdTime: +new Date(),
                    editedTime: +new Date(),
                    quickName: 'userZeroTheory',
                    title: 'Written by ' + users[0].name,
                    user: users[0],
                    essay: essays[0],
                    dependencySet: [],
                    challengeSet: [],
                    voterSet: []
                  }
                },
                {
                  par: root.getChild('theorySet'),
                  name: 'testimony',
                  data: {
                    createdTime: +new Date(),
                    editedTime: +new Date(),
                    quickName: 'testimony',
                    title: 'My Testimony',
                    user: users[0],
                    essay: essays[1],
                    dependencySet: [],
                    challengeSet: [],
                    voterSet: []
                  }
                },
                {
                  par: root.getChild('theorySet'),
                  name: 'userOneTheory',
                  data: {
                    createdTime: +new Date(),
                    editedTime: +new Date(),
                    quickName: 'userOneTheory',
                    title: 'Written by ' + users[1].name,
                    user: users[1],
                    essay: essays[2],
                    dependencySet: [],
                    challengeSet: [],
                    voterSet: []
                  }
                }
              ]
            });
          });
          
          var $relateTheories = new PACK.p.P({ all: [ $addUsers, $addEssays, $addTheories ] }).then(function() {
            return editor.$editFast({
              add: [
                {
                  par: root.getChild('theorySet.userZeroTheory.dependencySet'),
                  name: 'testimony',
                  data: {
                    theory: root.getChild('theorySet.testimony')
                  }
                }
              ]
            });
          });
          
          return new PACK.p.P({ all: [ $addUsers, $addEssays, $addTheories, $relateTheories ] }).then(function() {
            return root;
          });
          
        }
      }
    ]});
    
    lg.$init = versioner.$getDoss().then(function(doss) {
      lg.queryHandler = doss;
      return doss;
    });
    
    return lg;
  },
  runAfter: function() {
    
    if (U.isServer()) return;
    
    var qd = PACK.quickDev;
    var uf = PACK.userify;
    
    PACK.logic.$init.then(function(doss) {
      U.debug(doss.getDataView({}));
      
      var dataSet = {
        icons: {
          remove: new uf.SimpleInfo({ value: String.fromCharCode(0xe900) }),
          insert: new uf.SimpleInfo({ value: String.fromCharCode(0xf055) }),
          close: new uf.SimpleInfo({ value: String.fromCharCode(0xf00d) }),
          del: new uf.SimpleInfo({ value: String.fromCharCode(0xf014) }),
        },
        rps: new uf.SimpleInfo({ value: 'rps' }),
        token: new uf.SimpleInfo({ value: null }),
        appVersion: new uf.RepeatingSyncedInfo({
          $getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
        }),
        loginView: new uf.CalculatedInfo({
          getFunc: function() {  return dataSet.token.getValue() ? 'in' : 'out'  }
        }),
        username: new uf.SimpleInfo({ value: '' }),
        password: new uf.SimpleInfo({ value: '' }),
        loginError: new uf.SimpleInfo({ value: '' }),
        focusedNode: new uf.SimpleInfo({ value: null }),
        activeNodes: new uf.SimpleInfo({ value: {} })
      };
      dataSet.searchTerm = new uf.SimpleInfo({ value: '' });
      dataSet.searchResults = new uf.ReactingSyncedInfo({
        initialValue: {},
        info: dataSet.searchTerm,
        $getFunc: function() {
          var searchTerm = dataSet.searchTerm.getValue();
          if (searchTerm === '') return new PACK.p.P({ val: {} });
          
          return doss.$doRequest({
            command: 'searchTheories',
            params: {
              searchTerm: searchTerm
            }
          });
        }
      });
      
      var makeNodeData = function(params /* quickName, username */) {
        return {
          physics: {
            r: new uf.SimpleInfo({ value: 65 }),
            weight: new uf.SimpleInfo({ value: 1 }),
            loc: new uf.SimpleInfo({ value: new PACK.geom.Point({ ang: Math.random() * Math.PI * 2, mag: 0.01 }) }),
            vel: PACK.geom.ORIGIN,
            acl: PACK.geom.ORIGIN
          },
          username: uf.pafam(params, 'username'),
          quickName: uf.pafam(params, 'quickName'),
          title: new uf.SimpleInfo({ value: '' }),
          theory: new uf.SimpleInfo({ value: '' }),
          saved: new uf.SimpleInfo({ value: false })
        };
      };
      var saveNodeData = function(nodeInfo) {
        // "saved" is now fixed to the value `true`
        nodeInfo.saved.setValue(true);
        
        // "title" syncs with the `theorySet.<theoryId>.title` value server-side
        nodeInfo.title = new uf.RepeatingSyncedInfo({
          initialValue: '- not loaded -',
          $getFunc: function() {
            return doss.$doRequest({ command: 'getValue', address: [ 'theorySet', nodeInfo.quickName.getValue(), 'title' ] });
          },
          $setFunc: function(val) {
            return doss.$doRequest({ command: 'setValue', address: [ 'theorySet', nodeInfo.quickName.getValue(), 'title' ],
              params: {
                token: dataSet.token.getValue(),
                username: dataSet.username.getValue(),
                value: val
              }
            });
          },
          updateMillis: 5000
        });
        nodeInfo.title.start();
        
        // "theory" syncs with the `theorySet.<theoryId>.@essay.markup` value server-side
        nodeInfo.theory = new uf.RepeatingSyncedInfo({
          initialValue: '- not loaded -',
          $getFunc: function() {
            return doss.$doRequest({ command: 'getValue', address: [ 'theorySet', nodeInfo.quickName.getValue(), '@essay', 'markup' ] });
          },
          $setFunc: function(val) {
            return doss.$doRequest({ command: 'setValue', address: [ 'theorySet', nodeInfo.quickName.getValue(), '@essay', 'markup' ],
              params: {
                token: dataSet.token.getValue(),
                username: dataSet.username.getValue(),
                value: val
              }
            });
          },
          updateMillis: 5000
        });
        nodeInfo.theory.start();
        
        return nodeInfo;
      };
      var renameNodeData = function(params /* oldName, newName */) {
        var oldName = U.param(params, 'oldName');
        var newName = U.param(params, 'newName');
        
        dataSet.activeNodes.modValue(function(activeNodes) {
          // Re-key...
          activeNodes[newName] = activeNodes[oldName];
          delete activeNodes[oldName];
          
          // ... and update the quickName
          activeNodes[newName].quickName.setValue(newName);
          
          return activeNodes;
        });
      };
      var removeNodeData = function(name) {
        dataSet.activeNodes.modValue(function(activeNodes) {
          var obj = activeNodes[name];
          [
            obj.physics.r, obj.physics.weight, obj.physics.loc,
            obj.username, obj.quickName, obj.title, obj.theory, obj.saved
          ].forEach(function(info) {
            info.stop();
          });
          
          delete activeNodes[name];
          return activeNodes;
        });
      };
      
      var relateTheories = function(relationType, params /* target, dropZone */) {
        // `incoming` justifies or challenges `standing`
        var standing = U.param(params, 'dropZone').par.par; // Walk to theory view
        var incoming = U.param(params, 'target');
        
        var activeNodes = dataSet.activeNodes.getValue();
        
        var standingData = activeNodes[standing.name];
        var incomingData = activeNodes[incoming.name];
        
        console.log(incomingData, ({ support: '-+->', challenge: '-X->' })[relationType], standingData);
        
        if (!standingData.saved.getValue() || !incomingData.saved.getValue())
          throw new Error('Relations cannot involve unsaved theories');
        
        doss.$doRequest({ command: 'relateTheories', params: {
          token: dataSet.token.getValue(),
          standingQuickName: standingData.quickName.getValue(),
          incomingQuickName: incomingData.quickName.getValue(),
          relationType: relationType
        }}).then(function(data) {
          console.log('RELATION COMPLETE??', data);
        }).fail(function(err) {
          console.error('Error adding relation: ', err.message);
        });
        
      };
      
      // Makes graph nodes interactive (dragging + clicking)
      var dragNode = new uf.DragDecorator({
        tolerance: 0,
        validTargets: [
          '._text._user',     // Dragging on the username
          '._choose-display'  // Dragging on either the title or the content when they're not editable
        ],
        captureOnStart: function(view) {
          // The view isn't seen exactly at its physics "loc" due to transition delays
          // TODO: Can subtract the client bound loc from the css loc to offset this difference...
          return dataSet.activeNodes.getValue()[view.name].physics.loc.getValue();
        }
      });
      var dragAddDependency = new uf.DragActionDecorator({ dragDecorator: dragNode, action: relateTheories.bind(null, 'support') });
      var dragAddChallenger = new uf.DragActionDecorator({ dragDecorator: dragNode, action: relateTheories.bind(null, 'challenge') });
      var clickNode = new uf.ClickDecorator({
        validTargets: [
          '._text._user',           // Clicking on the username
          '._choose-display',       // Clicking on either the title or the content when they're not editable
          // '._toggleEdit > ._view'   // Clicking the edit toggler // TODO: Bad because toggling off editing always unfocuses :(
        ],
        action: function(view) {
          // No click action should apply during a drag. Prevents drag mouseup from focusing node.
          if (dragNode.isDragging(view)) return;
          
          dataSet.focusedNode.modValue(function(view0) {
            // Clicking a focused node unfocuses it. Clicking an unfocused node focuses it.
            // Unfocusing a node sets its "editing" property to `false`
            if (view0 === view) {
              dataSet.activeNodes.getValue()[view.name].editing.setValue(false);
              return null;
            }
            return view;
          });
        }
      });
      
      // Drag nodes to this view to remove them
      var removeNode = new uf.DragActionDecorator({ dragDecorator: dragNode, action: function(params /* target, dropZone */) {
        
        var target = U.param(params, 'target');
        removeNodeData(target.name);
        
      }});
      var removeNodeView = new uf.SetView({ name: 'remove', cssClasses: [ 'dropZone' ], children: [ new uf.TextView({ name: 'text', info: dataSet.icons.remove }) ] });
      removeNodeView.decorators = [ removeNode, removeNode.createClassDecorator(removeNodeView) ];
      
      // Drag nodes to this view to delete them
      var deleteNode = new uf.DragActionDecorator({ dragDecorator: dragNode, action: function(params /* target, dropZone */) {
        
        var target = U.param(params, 'target');
        var targetData = dataSet.activeNodes.getValue()[target.name];
        
        // If the theory is saved ask the server to delete it, otherwise simply remove it
        if (targetData.saved.getValue()) {
          
          var $delete = doss.$doRequest({
            command: 'deleteTheory',
            params: { token: dataSet.token.getValue(), quickName: targetData.quickName.getValue() }
          });
          
        } else {
          
          var $delete = PACK.p.$null;
          
        }
        
        $delete.then(function(response) {
          
          removeNodeData(target.name);
          
        }).fail(function(err) {
          
          console.error(err);
          
        });
        
      }});
      var deleteNodeView = new uf.SetView({ name: 'delete', cssClasses: [ 'dropZone' ], children: [ new uf.TextView({ name: 'text', info: dataSet.icons.del }) ] });
      deleteNodeView.decorators = [ deleteNode, deleteNode.createClassDecorator(deleteNodeView) ];
      
      var graphNodeInvRadius = 1 / 150;
      var graphView = new uf.DynamicSetView({ name: 'graph',
        childData: dataSet.activeNodes,
        decorators: [
          new PACK.userifyNodePhysics.NodePhysicsDecorator({
            info: dataSet.activeNodes,
            maxUpdatesPerFrame: 10,
            physicsSettings: {
              scaleTime: 1,
              dampenGlobal: 0.82,
              gravityPow: 1.5,
              gravityMult: 300,
              separation: 10,
              centerAclMag: 1000,
              minVel: 0
            }
          })
        ],
        genChildView: function(name, nodeInfo) {
          
          // Note: `nodeInfo` === graphView.childData.getValue()[name] === dataSet.activeNodes.getValue()[name]
          
          // This is the view that will be returned
          var view = new uf.SetView({ name: name });
          
          // Add data to the `Info` object: physics, owned, saved, and editing
          var loc = nodeInfo.physics.loc.getValue();
          var owned = nodeInfo.username.getValue() === dataSet.username.getValue();
          nodeInfo.update({
            // "owned" is immutable
            owned: new uf.SimpleInfo({ value: owned }),
            
            // "saved" links directly to the raw `Info` (actually this is redundant; setting a property to itself)
            saved: nodeInfo.saved,
            
            // "editing' is initially enabled for owned theories if either the title or theory is blank
            editing: new uf.SimpleInfo({ value: owned && (!nodeInfo.title.getValue() || !nodeInfo.theory.getValue()) })
          });
          nodeInfo.physics.update({
            r: new uf.CalculatedInfo({
              getFunc: function() {
                return view === dataSet.focusedNode.getValue() /*&& !dragNode.isDragging(view)*/ ? 150 : 65;
              }
            }),
            weight: new uf.CalculatedInfo({
              getFunc: function() {
                // Nodes being dragged have 0 weight
                var drg = dragNode.info.getValue();
                
                // 1) Nodes that aren't being dragging have a weight of `1`
                if (!dragNode.isDragging(view)) return 1;
                
                var waitTimeMs = dragNode.info.getValue().getWaitTimeMs();
                
                // 2) Dragged nodes that are held in place for a moment can gain weight...
                if (waitTimeMs > 500)
                  
                  // 3) Unless the node is being held over another node's dropZone (can't push away nodes the user is trying to interact with)
                  if (!dragAddDependency.info.getValue() && !dragAddChallenger.info.getValue()) return 3;
                
                // 4) All dragged nodes have a weight of `0`
                return 0;
              }
            }),
            loc: new uf.CalculatedInfo({
              getFunc: function() {
                
                // 1) Nodes being dragged position to cursor
                if (dragNode.isDragging(view)) {
                  var drg = dragNode.info.getValue();
                  // return loc = drg.pt2.add(drg.capturedData); // Note that `loc` is also updated here
                  return loc = drg.capturedData.sub(drg.pt1).add(drg.pt2); // Note that `loc` is also updated here
                }
                
                // 2) Focused node positions to center
                if (dataSet.focusedNode.getValue() === view) return loc = PACK.geom.ORIGIN;
                
                // 3) Position to the calculated physics `loc`
                return loc;
                
              },
              setFunc: function(newLoc) {
                loc = newLoc;
              }
            }),
          });
          
          // Create the dropzones for support and challenges
          var loadDependenciesButton = new uf.ActionView({ name: 'loadDependencies', textData: 'Dependencies...', $action: function() {
            
            var quickName = nodeInfo.quickName.getValue();
            console.log('Dependencies for ' + quickName);
            
            return doss.$doRequest({
              
              address: [ 'theorySet', quickName, 'dependencySet' ],
              command: 'getRawData'
              
            }).then(function(dependencySetData) {
              
              new PACK.p.P({ all: dependencySetData.map(function(v) {
                return doss.$doRequest({
                  address: v.theory,
                  command: 'getPickedFields',
                  params: {
                    fields: [ 'title', '@user', 'quickName' ]
                  }
                })
              })}).then(function(pickedFieldSet) {
                console.log(pickedFieldSet);
              }).fail(function(err) {
                console.error(err.stack);
              });
              
            }).fail(function(err) {
              
              console.log('DEPENDENCIES FAILED:', err);
              
            });
            
          }});
          loadDependenciesButton.decorators = [
            dragAddDependency,
            dragAddDependency.createClassDecorator(loadDependenciesButton)
          ];
          
          var loadChallengesButton = new uf.ActionView({ name: 'loadChallenges', textData: 'Challenges...', $action: function() {
            
            var quickName = nodeInfo.quickName.getValue();
            console.log('Challengers for ' + quickName, raw);
            
            return doss.$doRequest({
              
              address: [ 'theorySet', quickName, 'challengeSet' ],
              command: 'getData'
              
            }).then(function(challengeSetData) {
              
              for (var k in challengeSetData) {
                
                var theoryData = challengeSetData[k].theory;
                
                console.log('Challenge:', theoryData);
                
              }
              
            }).fail(function(err) {
              
              console.log('CHALLENGES FAILED:', err);
              
            });
            
          }});
          loadChallengesButton.decorators = [
            dragAddChallenger,
            dragAddChallenger.createClassDecorator(loadChallengesButton)
          ];
          
          // Install all necessary attributes on `view` before returning it
          view.cssClasses = [ 'theory', owned ? 'owned' : 'foreign' ]; // Set static classes
          view.decorators = [
            dragNode,   // Dragging affects position
            clickNode,  // Clicking focuses node
            new uf.CssDecorator({   // Modify position and radius based on physics
              properties: [ 'left', 'top', 'transform' ],
              info: function() {
                var phys = nodeInfo.physics;
                var loc = phys.loc.getValue();
                var r = phys.r.getValue();
                
                return {
                  left: Math.round(loc.x - r) + 'px',
                  top: Math.round(loc.y - r) + 'px',
                  transform: 'scale(' + r * graphNodeInvRadius + ')' // 150 is the natural width
                }
              }
            }),
            new uf.ClassDecorator({ // Add a "dragging" class when dragged
              list: [ 'dragging' ],
              info: function() {
                return dragNode.isDragging(view) ? 'dragging' : null;
              }
            }),
            new uf.ClassDecorator({ // Add a "focused" class when focused
              list: [ 'focused' ],
              info: function() {
                return dataSet.focusedNode.getValue() === view ? 'focused' : null;
              }
            }),
            new uf.ClassDecorator({ // Add "saved"/"unsaved" classes
              list: [ 'saved', 'unsaved' ],
              info: function() {
                return nodeInfo.saved.getValue() ? 'saved' : 'unsaved'
              }
            })
          ];
          view.addChildren([
            new uf.SetView({ name: 'controls', children: [
              loadDependenciesButton,
              loadChallengesButton,
            ]}),
            new uf.ChoiceView({ name: 'data', choiceData: function() { return nodeInfo.saved.getValue() ? 'saved' : 'unsaved' }, children: [
              // Shows up on unsaved theories (allows editing only quickName)
              new uf.SetView({ name: 'unsaved', children: [
                new uf.TextEditView({ name: 'quickName', cssClasses: [ 'centered' ], textData: nodeInfo.quickName, placeholderData: 'quickName' }),
                new uf.ActionView({ name: 'save', textData: 'Save', $action: function() {
                  
                  /*
                  var $saveTheory = doss.$doRequest({ address: 'theorySet', command: 'addDossier', params: {
                    token: dataSet.token.getValue(),
                    dossierData: {
                      user:       { type: 'oldRef', value: [ 'userSet', dataSet.username.getValue() ] },
                      quickName:  { type: 'simple', value: nodeInfo.quickName.getValue() },
                      title:      { type: 'simple', value: '' },
                      essay:      { type: 'newRef', value: { markup: '' } }
                    }
                  }});
                  */
                  
                  var $saveTheory = doss.$doRequest({
                    command: 'saveTheory',
                    params: {
                      token: dataSet.token.getValue(),
                      username: dataSet.username.getValue(),
                      quickName: nodeInfo.quickName.getValue(),
                      title: '',
                      theory: '',
                      type: 'create' // 'create' | 'update'
                    }
                  });
                  
                  return $saveTheory.then(function(response) {
                    
                    console.log(response);
                    
                    var originalName = view.name;
                    var savedQuickName = response.quickName;
                    
                    // If the quickName has changed re-key the view...
                    if (savedQuickName !== originalName) {
                      
                      // ... both in `activeNodes`...
                      renameNodeData({ oldName: originalName, newName: savedQuickName }); // This will update `quickName` Info
                      
                      // ... and in `graphView`
                      graphView.renameChild(view, nodeInfo.quickName.getValue()); // Should only happen on save success
                      
                    }
                    
                    // Insert all server-syncing properties now that this theory is saved
                    saveNodeData(nodeInfo);
                    
                  }).fail(function(err) {
                    console.log('Couldn\'t create theory: ' + err.message);
                  });
                  
                }})
              ]}),
              
              // Shows up for saved theories (allows editing title and essay)
              new uf.SetView({ name: 'saved', children: [
                
                new uf.TextView({ name: 'user', info: nodeInfo.username }),
                new uf.DynamicTextEditView({ name: 'title',
                  editableData: function() {
                    return view === dataSet.focusedNode.getValue() && nodeInfo.editing.getValue() && nodeInfo.owned.getValue();
                  },
                  textData: new uf.ProxyInfo({ info: nodeInfo, path: 'title' }),
                  inputViewParams: {
                    cssClasses: [ 'centered' ],
                    placeholderData: 'Title'
                  }
                }),
                new uf.DynamicTextEditView({ name: 'theory',
                  editableData: function() {
                    return view === dataSet.focusedNode.getValue() && nodeInfo.editing.getValue() && nodeInfo.owned.getValue();
                  },
                  textData: new uf.ProxyInfo({ info: nodeInfo, path: 'theory' }),
                  inputViewParams: {
                    placeholderData: 'Theory',
                    multiline: true
                  }
                }),
                new uf.TextView({ name: 'quickName', info: nodeInfo.quickName }),
                
              ]})
              
            ]}),
            new uf.ChoiceView({ name: 'toggleEdit', choiceData: function() { return nodeInfo.owned.getValue() && nodeInfo.saved.getValue() ? 'view' : null }, children: [
              new uf.ActionView({ name: 'view', textData: '',
                decorators: [
                  new uf.ClassDecorator({
                    list: [ 'editing' ],
                    info: function() {
                      return nodeInfo.editing.getValue() ? 'editing' : null;
                    }
                  })
                ],
                $action: function() {
                  nodeInfo.editing.modValue(function(val) { return !val; });
                  return PACK.p.$null;
                }
              })
            ]})
          ]);
          
          return view;
          
        }
      });
      
      var rootView = new uf.RootView({ name: 'root' });
      rootView.decorators = [
        new uf.ClassDecorator({
          list: [ 'dragging' ],
          info: function() {
            return dragNode.info.getValue().drag ? 'dragging' : null;
          }
        })
      ];
      rootView.addChildren([
        
        new uf.ChoiceView({ name: 'login', choiceData: dataSet.loginView, children: [
          
          new uf.SetView({ name: 'out', children: [
            
            new uf.TextHideView({ name: 'loginError', info: dataSet.loginError }),
            
            new uf.TextEditView({ name: 'username', textData: dataSet.username, placeholderData: 'Username' }),
            new uf.TextEditView({ name: 'password', textData: dataSet.password, placeholderData: 'Password' }),
            new uf.ActionView({ name: 'submit', textData: 'Submit!', $action: function() {
              return doss.$doRequest({ command: 'getToken', params: {
                username: dataSet.username.getValue(),
                password: dataSet.password.getValue()
              }}).then(function(data) {
                dataSet.token.setValue(data.token);
              }).fail(function(err) {
                dataSet.loginError.setValue(err.message);
                new PACK.p.P({ timeout: 3000 }).then(function() { dataSet.loginError.setValue(''); });
              });
            }})
            
          ]}),
          new uf.SetView({ name: 'in', children: [
            
            graphView,
            
            new uf.SetView({ name: 'dropZones', children: [ removeNodeView, deleteNodeView ]}),
            new uf.SetView({ name: 'controls', children: [
              new uf.SetView({ name: 'search', cssClasses: [ 'control' ], children: [
                new uf.TextEditView({ name: 'bar', textData: dataSet.searchTerm, placeholderData: 'Search' }),
                // TODO: What about an unsaved atom that has the same quickName (e.g. "newTheory") as a saved atom?
                // Loading it in will clobber the unsaved atom for what will look like no reason
                new uf.DynamicSetView({ name: 'results',
                  childData: dataSet.searchResults,
                  decorators: [
                  ],
                  genChildView: function(name, nodeInfo) {
                    
                    var view = new uf.SetView({ name: name });
                    
                    view.cssClasses = [ 'result' ];
                    view.decorators = [
                      new uf.ClassDecorator({
                        list: [ 'active' ],
                        info: function() {
                          return (nodeInfo.quickName in dataSet.activeNodes.getValue()) ? 'active' : null;
                        }
                      })
                    ];
                    view.addChildren([
                      new uf.TextView({ name: 'username', cssClasses: [ 'item' ], info: nodeInfo.username }),
                      new uf.TextView({ name: 'quickName', cssClasses: [ 'item' ], info: nodeInfo.quickName }),
                      new uf.TextView({ name: 'title', cssClasses: [ 'item' ], info: nodeInfo.title }),
                      new uf.TextView({ name: 'theory', cssClasses: [ 'item' ], info: nodeInfo.theory }),
                      new uf.ActionView({ name: 'choose', textData: dataSet.icons.insert, $action: function() {
                        
                        if (!(nodeInfo.quickName in graphView.children)) {
                        
                          // A new theory has been added
                          dataSet.activeNodes.modValue(function(activeNodes) {
                            activeNodes[nodeInfo.quickName] = saveNodeData(makeNodeData({
                              quickName: nodeInfo.quickName,
                              username: nodeInfo.username
                            }));
                            return activeNodes;
                          });
                          
                          // Ensure that `graphView` is immediately synced
                          graphView.updateChildren();
                          
                        }
                        
                        // Focus the theory that was searched for
                        var pickedChild = graphView.children[nodeInfo.quickName];
                        dataSet.focusedNode.setValue(pickedChild);
                        
                        // Clear the search term
                        dataSet.searchTerm.setValue('');
                        
                        return PACK.p.$null;
                        
                      }})
                    ]);
                    
                    return view;
                    
                  }
                })
              ]}),
              new uf.ActionView({ name: 'new', cssClasses: [ 'control' ], textData: 'New Theory', $action: function() {
                
                var num = 2;
                var prefix = 'newTheory';
                var name = prefix;
                while (name in graphView.children) name = prefix + (num++); // Shouldn't be checking `graphView.children` - should be checking `dataSet.activeNodes` I think
                
                dataSet.activeNodes.modValue(function(val) {
                  val[name] = makeNodeData({
                    username: dataSet.username,
                    quickName: name
                  });
                  
                  /*
                  val[name] = {
                    physics: {
                      r: new uf.SimpleInfo({ value: 65 }),
                      weight: new uf.SimpleInfo({ value: 1 }),
                      loc: new uf.SimpleInfo({ value: new PACK.geom.Point({ ang: Math.random() * Math.PI * 2, mag: 0.01 }) }),
                      vel: PACK.geom.ORIGIN,
                      acl: PACK.geom.ORIGIN
                    },
                    username: dataSet.username,
                    quickName: new uf.SimpleInfo({ value: name }),
                    title: new uf.SimpleInfo({ value: '' }),
                    theory: new uf.SimpleInfo({ value: '' }),
                    saved: new uf.SimpleInfo({ value: false })
                  };
                  */
                  
                  return val;
                });
                
                var child = graphView.updateChildren().add[name];
                dataSet.focusedNode.setValue(child);
                
                return PACK.p.$null;
                
              }}),
              new uf.ActionView({ name: 'exit', cssClasses: [ 'control' ], textData: 'Log Out', $action: function() {
                
                dataSet.token.setValue('');
                return PACK.p.$null;
                
              }})
            ]})
            
          ]}),
          
        ]}),
        new uf.TextView({ name: 'version', info: dataSet.appVersion }),
        new uf.TextView({ name: 'rps', info: function() { return 'update: ' + rootView.updateTimingInfo + 'ms' } })
        
      ]);
      
      /*
      var updateMs = 1000 / 60;
      var updateFunc = function() {
        var time = +new Date();
        rootView.update(updateMs);
        dataSet.rps.setValue('update: ' + (new Date() - time) + 'ms')
        requestAnimationFrame(updateFunc);
      };
      requestAnimationFrame(updateFunc);
      */
      
      rootView.start();
      
      // Make some stuff accessible on the command line
      window.root = doss;
      window.view = rootView;
      window.info = dataSet;
      
      /* ======= TESTING STUFF ======== */
      
      doss.$doRequest({ command: 'getToken', params: {
        username: 'admin',
        password: 'adminadmin123'
      }}).then(function(data) {
        dataSet.token.setValue(data.token);
      });
      
      dataSet.username.setValue('admin');
      dataSet.password.setValue('adminadmin123');
      
    }).done();
    
  }
});
package.build();
