/*
Checklist:
- Should GraphView provide the canvas?
- There's a flicker on page-load (a stylesheet is not applying on the 1st frame I think)

There should be limited ways to reject a supported theory
- Should be prompted to reject the support instead of the theory
- Only exception: rejecting a theory on the basis of missing support
  - Should automatically create a new empty theory supporting that theory,
    and add a challenge against that support. This challenge should be
    automatically defeated as soon as the support is filled in.

Can automatic defeat of challenges ensure that only axioms remain challengable?

==== THE LIST ====

NEAR-TERM:
1) Sort out quickName + auto-saving theories. Shouldn't be editable after save. Unsaved nodes should appear with only a "quickName" field.
2) Create a data controller for sets (the set of names of all theories active on the client-side)
  - Theories are added using the "New Theory" button, support/challenge loading, search function
  - Theories are deleted by dragging them to "remove" and "delete" dropzones
3) `dataSet.activeNodes` should be auto-updating
  - Server-side edits should automatically appear for all clients
  - Server-side deletes should automatically appear for all clients
3) Get relations down.
  - Should be implemented through a decorator
  - Physics decorator should allow for a function that determines gravitational strength between any 2 nodes
  - Canvas graphics to link relations to the `._interactive` elements of standing theories

INDEFINITE:
- Error reporting (toast-style notifications on errors)
- Get rid of persistent sessions...?
- Dependency/support loading should trigger a search (only within those dependencies/supports) for very large sets (to avoid hundreds of theories being loaded on-click)
- Need a way of preventing tons of views, all wired to the same Data, from running the same calculation over and over again (caching + reset() called before main update)

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
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
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
              if (user.getChild('password').value !== password) throw new Error('Incorrect password');
              
              return PACK.p.$({
                username: user.getChild('username').value,
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
              
            }
            
            return sc.$handleQuery.call(this, params);
          },
          requireUser: function(username, token) {
            var user = this.children.userSet.children[username];
            if (!user) throw new Error('Couldn\'t find user "' + username + '"');
            if (token && user.getToken() !== token) throw new Error('Incorrect token for user "' + username + '"');
            return user;
          }
        };}
      }),
      LogicUser: U.makeClass({ name: 'LogicUser',
        superclass: PACK.quickDev.DossierDict,
        methods: function(sc, c) { return {
          init: function(params /* outline */) {
            sc.init.call(this, params);
          },
          
          getToken: function(user) {
            var u = this.getChild('username').value;
            var p = this.getChild('password').value;
            
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
    };
    
    var versioner = new qd.Versioner({ versions: [
      {  name: 'initial',
        detect: function(doss) { return doss === null; },
        $apply: function(doss) {
          
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
                { c: qd.DossierString, p: { name: 'markup' } }
              ]}
            }},
            { c: qd.DossierList, p: { name: 'theorySet',
              innerOutline: { c: qd.DossierDict, i: [
                { c: qd.DossierInt,      p: { name: 'createdTime' } },
                { c: qd.DossierInt,      p: { name: 'editedTime' } },
                { c: qd.DossierString,  p: { name: 'quickName' } },
                { c: qd.DossierString,  p: { name: 'title' } },
                { c: qd.DossierRef,      p: { name: 'user', baseAddress: '~root.userSet' } },
                { c: qd.DossierRef,      p: { name: 'essay', baseAddress: '~root.essaySet' } },
                { c: qd.DossierRef,      p: { name: 'duplicate', baseAddress: '~root.theorySet' } },
                { c: qd.DossierList,    p: { name: 'dependencySet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
                  ]},
                  prop: '@theory.quickName/value'
                }},
                { c: qd.DossierList,    p: { name: 'challengeSet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
                  ]},
                  prop: '@theory.quickName/value'
                }},
                { c: qd.DossierList,    p: { name: 'voterSet',
                  innerOutline: { c: qd.DossierDict, i: [
                    { c: qd.DossierRef, p: { name: 'user', baseAddress: '~root.userSet' } },
                    { c: qd.DossierInt, p: { name: 'value' } }
                  ]},
                  prop: '@user.username/value'
                }}
              ]},
              prop: 'quickName/value'
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
          
          return editor.$editFast({
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
          }).then(function() {
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
      U.debug('THING', doss.getDataView({}));
      
      var dataSet = {
        rps: new uf.SimpleData({ value: 'rps' }),
        token: new uf.SimpleData({ value: null }),
        appVersion: new uf.UpdatingData({
          $getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
        }),
        loginView: new uf.CalculatedData({
          getFunc: function() {  return dataSet.token.getValue() ? 'in' : 'out'  }
        }),
        username: new uf.SimpleData({ value: '' }),
        password: new uf.SimpleData({ value: '' }),
        loginError: new uf.SimpleData({ value: '' }),
        focusedNode: new uf.SimpleData({ value: null }),
        activeNodes: new uf.SimpleData({ value: {} })
      };
      
      /*
      dataSet.nodeList = new uf.UpdatingData({
        initialValue: [],
        updateMillis: 2000,
        $getFunc: function() {
          return new PACK.p.P({
            all: dataSet.activeNodeNames.getValue().map(function(v, quickName) {
              return doss.$doRequest({
                address: [ 'theorySet', quickName ],
                command: 'getData'
              }).fail(function(err) {
                return err.message;
              });
            })
          }).then(function(remoteTheoryDataSet) {
            
          });
        }
      });
      */
      
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
      
      // Makes graph nodes draggable
      var dragNode = new uf.DragDecorator({
        tolerance: 0,
        validTargets: [
          '._text._user',     // Dragging on the username
          '._choose-display'  // Dragging on either the title or the content when they're not editable
        ],
        captureOnStart: function(view) {
          return dataSet.activeNodes.getValue()[view.name].physics.loc.getValue();
        }
      });
      var dragAddDependency = new uf.DragActionDecorator({ dragDecorator: dragNode, action: relateTheories.bind(null, 'support') });
      var dragAddChallenger = new uf.DragActionDecorator({ dragDecorator: dragNode, action: relateTheories.bind(null, 'challenge') });
      var clickNode = new uf.ClickDecorator({
        validTargets: [
          '._text._user',      // Clicking on the username
          '._choose-display'  // clicking on either the title or the content when they're not editable
        ],
        action: function(view) {
          // Don't count clicks if dragging
          var drg = dragNode.data.getValue();
          // No click action should apply during a drag. Prevents drag mouseup from focusing node.
          if (!drg.drag || view !== drg.view)
            dataSet.focusedNode.modValue(function(view0) {
              // Clicking a focused node unfocuses it. Clicking an unfocused node focuses it.
              return view0 === view ? null : view;
            });
        }
      });
      
      var graphNodeInvRadius = 1 / 150;
      
      var graphView = new uf.DynamicSetView({ name: 'graph',
        childData: dataSet.activeNodes,
        decorators: [
          new PACK.userifyNodePhysics.NodePhysicsDecorator({
            data: dataSet.activeNodes,
            maxUpdatesPerFrame: 10,
            physicsSettings: {
              scaleTime: 1,
              dampenGlobal: 0.82,
              gravityPow: 1.5,
              gravityMult: 300,
              separation: 10,
              centerAclMag: 1000,
              minVel: 22
            }
          })
        ],
        genChildView: function(name, nodeData) {
          
          // Note: `nodeData` === graphView.childData.getValue()[name] === dataSet.activeNodes.getValue()[name]
          
          // This is the view that will be returned
          var view = new uf.SetView({ name: name });
          
          // Add data to the `activeNodes` object: physics, owned, saved, and editing
          var loc = nodeData.physics.loc.getValue();
          var owned = nodeData.username.getValue() === dataSet.username.getValue();
          nodeData.update({
            // "owned" is immutable
            owned: new uf.SimpleData({ value: owned }),
            
            // "saved" links directly to the raw `Data`
            saved: nodeData.saved,
            
            // "editing' is initially enabled for owned theories if either the title or theory is blank
            editing: new uf.SimpleData({ value: owned && (!nodeData.title.getValue() || !nodeData.theory.getValue()) })
          });
          nodeData.physics.update({
            r: new uf.CalculatedData({
              getFunc: function() {
                return view === dataSet.focusedNode.getValue() ? 150 : 65;
              }
            }),
            weight: new uf.CalculatedData({
              getFunc: function() {
                // Nodes being dragged have 0 weight
                var drg = dragNode.data.getValue();
                
                if (drg.drag && drg.view === view) {
                  
                  // No movement for 0.5s, when no drag action is being hovered, causes
                  // the node to become heavy.
                  if (drg.getWaitTimeMs() > 500 && !dragAddDependency.data.getValue() && !dragAddChallenger.data.getValue())
                    return 3;
                  
                  return 0;
                  
                }
                
                return (drg.drag && drg.view === view) ? 0 : 1;
              }
            }),
            loc: new uf.CalculatedData({
              getFunc: function() {
                // Priority:
                // 1) Nodes being dragged position to cursor
                // 2) Focused node positions to center
                // 3) Position to the calculated physics `loc`
                var drg = dragNode.data.getValue();
                if (drg.drag && drg.view === view) return loc = drg.capturedData.sub(drg.pt1).add(drg.pt2); // Note that `loc` is also updated here
                if (dataSet.focusedNode.getValue() === view) return loc = PACK.geom.ORIGIN;
                return loc;
              },
              setFunc: function(newLoc) {
                loc = newLoc;
              }
            }),
          });
          
          // Create the dropzones for support and challenges
          var loadDependenciesButton = new uf.ActionView({ name: 'loadDependencies', textData: 'Dependencies...',
            decorators: [
              dragAddDependency,
              new uf.ClassDecorator({
                possibleClasses: [ 'dragHover' ],
                data: function() {
                  return dragAddDependency.data.getValue() === loadDependenciesButton ? 'dragHover' : null;
                }
              })
            ],
            $action: function() {
              var quickName = nodeData.quickName.getValue();
              console.log('Dependencies for ' + quickName, raw);
              
              return doss.$doRequest({
                
                address: [ 'theorySet', quickName, 'dependencySet' ],
                command: 'getData'
                
              }).then(function(dependencySetData) {
                
                for (var k in dependencySetData) {
                  
                  var theoryData = dependencySetData[k].theory;
                  
                  console.log('Dependency:', theoryData);
                  
                }
                
              }).fail(function(err) {
                
                console.log('DEPENDENCIES FAILED:', err);
                
              });
            }
          });
          var loadChallengesButton = new uf.ActionView({ name: 'loadChallenges', textData: 'Challenges...',
            decorators: [
              dragAddChallenger,
              new uf.ClassDecorator({
                possibleClasses: [ 'dragHover' ],
                data: function() {
                  return dragAddChallenger.data.getValue() === loadChallengesButton ? 'dragHover' : null;
                }
              })
            ],
            $action: function() {
              var quickName = nodeData.quickName.getValue();
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
            }
          });
          
          // Install all necessary attributes on `view` before returning it
          view.cssClasses = [ 'theory', owned ? 'owned' : 'foreign' ]; // Set static classes
          view.decorators = [
            dragNode,   // Dragging affects position
            clickNode,  // Clicking focuses node
            new uf.CssDecorator({   // Modify position and radius based on physics
              properties: [ 'left', 'top', 'transform' ],
              data: function() {
                var phys = nodeData.physics;
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
              possibleClasses: [ 'dragging' ],
              data: function() {
                var dragData = dragNode.data.getValue();
                return dragData.drag && dragData.view === view ? 'dragging' : null;
              }
            }),
            new uf.ClassDecorator({ // Add a "focused" class when focused
              possibleClasses: [ 'focused' ],
              data: function() {
                return dataSet.focusedNode.getValue() === view ? 'focused' : null;
              }
            }),
            new uf.ClassDecorator({ // Add "saved"/"unsaved" classes
              possibleClasses: [ 'saved', 'unsaved' ],
              data: function() {
                return nodeData.saved.getValue() ? 'saved' : 'unsaved'
              }
            })
          ];
          view.addChildren([
            new uf.SetView({ name: 'controls', children: [
              loadDependenciesButton,
              loadChallengesButton,
              /*
              // TODO: Can "owner" controls be eliminated fully? Drag nodes to trash to delete; auto-save nodes; only focused nodes are editable
              new uf.ChoiceView({ name: 'owner',
                choiceData: function() {
                  // Controls show up on owned, focused nodes
                  return nodeData.owned.getValue() && view === dataSet.focusedNode.getValue() ? 'show' : null;
                  //return data.getValue().raw.owned && view === dataSet.focusedNode.getValue() ? 'show' : null;
                },
                children: [
                  new uf.SetView({ name: 'show', children: [
                    new uf.ActionView({ name: 'edit', textData: 'Edit', $action: function() {
                      data.modValue(function(val) {
                        val.raw.editing = true;
                        return val;
                      });
                      return PACK.p.$null;
                    }}),
                    new uf.ActionView({ name: 'delete', textData: 'Delete', $action: function() {
                      return PACK.p.$null;
                    }}),
                    new uf.ActionView({ name: 'save', textData: 'Save', $action: function() {
                      // Disable text boxes as soon as save is clicked
                      data.modValue(function(val) {
                        val.raw.editing = false;
                        return val;
                      });
                      
                      var rawData = data.getValue().raw;
                      
                      var saveData = {
                        quickName: view.getChild('data.quickName').textData.getValue(),
                        title: view.getChild('data.title').textData.getValue(),
                        theory: view.getChild('data.theory').textData.getValue()
                      };
                      
                      return new PACK.p.P({ custom: function(resolve) {
                        
                        // 1) update the graphView raw data (which may fail)
                        graphView.updateRawData(view, rawData.clone(saveData));
                        resolve(null);
                        
                      }}).then(function() {
                        
                        // 2) perform the update query
                        return doss.$doRequest({
                          command: 'saveTheory',
                          params: saveData.update({
                            username: rawData.username,
                            token: dataSet.token.getValue(),
                            type: rawData.saved ? 'update' : 'create'
                          })
                        })
                        
                      }).then(function(response) {
                        
                        console.log('SAVED', response);
                        
                        // Update the client data with the server data
                        var updatedData = data.modValue(function(val) {
                          val.raw.update({
                            quickName: response.quickName,
                            title: response.title,
                            theory: response.essay.markup,
                            saved: true
                          });
                          return val;
                        });
                        
                        // 3) update the graphview using the response (which should be able to fail)
                        graphView.updateRawData(view, updatedData.raw);
                        
                      }).fail(function(err) {
                        
                        // TODO: Cleanup things like these are a sign of bad paradigm (need more userification)
                        
                        // On failure go back to editing
                        var fullData = data.modValue(function(val) {
                          val.raw.editing = true;
                          return val;
                        });
                        
                        // It can get confusing if the visible quickName doesn't mirror the actual quickName
                        view.getChild('data.quickName').textData.setValue(fullData.raw.quickName)
                        
                        console.error(err.stack);
                        
                      });
                    }})
                  ]})
                ]
              })
              */
            ]}),
            new uf.ChoiceView({ name: 'data', choiceData: function() { return nodeData.saved.getValue() ? 'saved' : 'unsaved' }, children: [
              // Shows up on unsaved theories (allows editing only quickName)
              new uf.SetView({ name: 'unsaved', children: [
                new uf.TextEditView({ name: 'quickName', textData: nodeData.quickName, placeholderData: 'quickName' }),
                new uf.ActionView({ name: 'save', textData: 'Save', $action: function() {
                  console.log('Saved! nodeData.saved.setValue(true) // which should trigger a request to the server');
                  
                  return PACK.p.$null;
                }})
              ]}),
              
              // Shows up for saved theories (allows editing title and essay)
              new uf.SetView({ name: 'saved', children: [
                new uf.TextView({ name: 'user', data: nodeData.username }),
                new uf.DynamicTextEditView({ name: 'title',
                  editableData: function() {
                    return nodeData.editing.getValue() && nodeData.owned.getValue()
                  },
                  textData: nodeData.title,
                  inputViewParams: {
                    placeholderData: 'Title'
                  }
                }),
                new uf.DynamicTextEditView({ name: 'theory',
                  editableData: function() {
                    return nodeData.editing.getValue() && nodeData.owned.getValue();
                  },
                  textData: nodeData.theory,
                  inputViewParams: {
                    placeholderData: 'Theory',
                    multiline: true
                  }
                })
                
              ]})
              
            ]})
          ]);
          
          return view;
          
          
          new uf.SetView({ name: 'data', children: [
            new uf.DynamicTextEditView({ name: 'quickName',
              editableData: function() {
                // quickName cannot be edited after being saved
                return !nodeData.saved.getValue() && nodeData.editing.getValue() && nodeData.owned.getValue();
              },
              textData: nodeData.quickName,
              inputViewParams: {
                placeholderData: 'Quick Name',
                cssClasses: [ 'centered' ]
              }
            }),
            new uf.TextView({ name: 'user', data: nodeData.username }),
            new uf.DynamicTextEditView({ name: 'title',
              editableData: function() {
                return nodeData.editing.getValue() && nodeData.owned.getValue()
              },
              textData: nodeData.title,
              inputViewParams: {
                placeholderData: 'Title'
              }
            }),
            new uf.DynamicTextEditView({ name: 'theory',
              editableData: function() {
                return nodeData.editing.getValue() && nodeData.owned.getValue();
              },
              textData: nodeData.theory,
              inputViewParams: {
                placeholderData: 'Theory',
                multiline: true
              }
            })
          ]});
          
        }
      });
      
      var rootView = new uf.SetView({ name: 'root',
        decorators: [
          new uf.ClassDecorator({
            possibleClasses: [ 'dragging' ],
            data: function() {
              return dragNode.data.getValue().drag ? 'dragging' : null;
            }
          })
        ],
        children: [
          
          new uf.ChoiceView({ name: 'login', choiceData: dataSet.loginView, children: [
            
            new uf.SetView({ name: 'out', children: [
              
              new uf.TextHideView({ name: 'loginError', data: dataSet.loginError }),
              
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
              
              new uf.SetView({ name: 'controls', children: [
                new uf.SetView({ name: 'global', cssClasses: [ 'subControls' ], children: [
                  new uf.ActionView({ name: 'new', textData: 'New Theory', $action: function() {
                    
                    var num = 2;
                    var prefix = 'newTheory';
                    var name = prefix;
                    while (name in graphView.children) name = prefix + (num++); // Shouldn't be checking `graphView.children` - should be checking `dataSet.activeNodes` I think
                    
                    dataSet.activeNodes.modValue(function(val) {
                      val[name] = {
                        physics: {
                          r: new uf.SimpleData({ value: 65 }),
                          weight: new uf.SimpleData({ value: 1 }),
                          loc: new uf.SimpleData({ value: new PACK.geom.Point({ ang: Math.random() * Math.PI * 2, mag: 0.01 }) }),
                          vel: PACK.geom.ORIGIN,
                          acl: PACK.geom.ORIGIN
                        },
                        username: dataSet.username,
                        quickName: new uf.SimpleData({ value: name }),
                        title: new uf.SimpleData({ value: 'New Theory' }),
                        theory: new uf.SimpleData({ value: 'QED' }),
                        saved: new uf.SimpleData({ value: false })
                      };
                      
                      return val;
                    });
                    
                    /*
                    var node = graphView.addRawData({
                      quickName: name,
                      username: dataSet.username.getValue(),
                      title: 'Look up',
                      theory: 'The sky is blue.',
                      saved: false
                    });
                    dataSet.focusedNode.setValue(node);
                    */
                    
                    return PACK.p.$null;
                    
                  }}),
                  new uf.SetView({ name: 'search', cssClasses: [ 'subControls' ], children: [
                  ]}),
                  new uf.ActionView({ name: 'exit', textData: 'Log Out', $action: function() {
                    
                    dataSet.token.setValue('');
                    return PACK.p.$null;
                    
                  }})
                ]}),
              ]})
              
            ]}),
            
          ]}),
          new uf.TextView({ name: 'version', data: dataSet.appVersion }),
          new uf.TextView({ name: 'rps', data: dataSet.rps })
          
        ]}
      );
      
      var updateMs = 1000 / 60;
      var updateFunc = function() {
        var time = +new Date();
        rootView.update(updateMs);
        dataSet.rps.setValue('update: ' + (new Date() - time) + 'ms')
        requestAnimationFrame(updateFunc);
      };
      requestAnimationFrame(updateFunc);
      
      // Make some stuff accessible on the command line
      window.root = doss;
      window.view = rootView;
      window.data = dataSet;
      
      /* ======= TESTING STUFF ======== */
      
      doss.$doRequest({ command: 'getToken', params: {
        username: 'admin',
        password: 'adminadmin123'
      }}).then(function(data) {
        dataSet.token.setValue(data.token);
      });
      
      dataSet.username.setValue('admin');
      dataSet.password.setValue('adminadmin123');
      
      /*
      graphView.addRawData({
        quickName: 'newTheory',
        username: 'admin',
        title: 'Look up',
        theory: 'The sky is blue.',
        saved: false
      });
      
      for (var i = 0; i < 10; i++) {
        graphView.addRawData({
          quickName: U.charId(i),
          username: U.charId(i),
          title: U.id((i * 93824793287) % 134),
          theory: U.id(i) + U.id(i * 20) + U.id((i + 30) * 17),
          saved: false
        });
      }
      
      dataSet.focusedNode.setValue(graphView.children.newTheory);
      */
      
      
    }).done();
    
  }
});
package.build();
