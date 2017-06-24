/*

NEAR-TERM:
- Relations should be normalized both client-side in `infoSet`, and server-side in the root dossier
- animation + delay on theory deletion
- Need other sources which can load atoms
  - all the user's atoms
  - all of any user's atoms
  - all the atoms within an argument
- Dragging a node to a dropzone throws an error if the cursor is simultaneously hovering over an "addSupporter" dropzone
- Need a way of distinguishing global relations from loaded relations
  - e.g. can know all the theories a node is related to, but how to determine which ones are actually on-screen?
- Data quality control
  - Who can create theories?
  - Who can delete theories?
  - Who can support a theory? Which of the incoming and standing theories can be unowned?
  - Who can contend a theory? Which of the incoming and standing theories can be unowned?
  - Theory "privileges"?
    - Should users have (and be able to grant) per-theory privileges to other users?
- Relation physics should be better
  - Consider
- Camera controls? Panning/zooming?
  - Minimap?? (this could be a canvas; it could have a low framerate; it would honestly be beautiful)
- dossier.getDataView() is not implemented correctly (some properties will wind up being 'DUMMY_VAL')

INDEFINITE:
- Need to introduce artificial latency for testing and indicate all loading activities
- Info objects should have an "altered" broadcast ability
  - No changes should occur unless there have been alterations
  - e.g. SetViews shouldn't update unless any relevant data has updated
  - Could make CachedInfo obsolete...
- User-content quality control
  - E.g. only 3 new theories every 5 hours
- Deleting a theory from the theorySet should also destroy any references to that theory
- equivalent of validateSetValue for sets; allow native insertion/removal(/updating?) of elements from sets
  - And OOP server queries:
    - `doss.getClientChild('theorySet.newTheory.@essay.markup').$setValue('some new essay markup value')`
    - `doss.getClientChild('theorySet').$addDossier({ quickName: 'newTheory', title: 'New Theory', user: 'userSet.admin', essay: { markup: 'This theory is new.' } })`
      - This one is especially tricky; need defaults for "editedTime" and "createdTime", but also need to get the user from a reference and generate a new "essay" from simple data
      - The baseAddress of a theory's essay reference can inform which dossier the simple essay data conforms to
    - `doss.getClientChild('theorySet').$remDossier('newTheory')
- The current paradigm makes handling server-side deletes awkward. Need to detect and delete. Dis a bad sign?
- Essay can't validate with `verifySetValue` because it has no notion of the user who owns it
- Error reporting (toast-style notifications on errors)
- Long-polling support? (for use with RepeatingSyncedInfo - although RepeatingSyncedInfo should be unaware of whether or not it is long-polling)
- Get rid of persistent sessions...?
- Supporter/contender loading should trigger a search (only within those supporters/contenders) for very large sets (to avoid hundreds of theories being loaded on-click)
- Need a way of preventing tons of views, all wired to the same Info, from running the same calculation over and over again (caching + reset() called before main update)
- When a database is implemented `someDoss.getChild(...)` will need to become `someDoss.$getChild(...)` (which is a pity)
- Can automatic defeat of contenders ensure that only axioms remain contendable?
  - There should be limited ways to reject a supported theory
    - Should be prompted to reject the support instead of the theory
    - Only exception: rejecting a theory on the basis of missing support
      - Should automatically create a new empty theory supporting that theory,
        and add a contender against that support. This contender should be
        automatically defeated as soon as the support is filled in.
- There's a flicker on page-load (a stylesheet is not applying on the 1st frame I think)
- Minification (and once files are being pre-processed, programatic separation between client/server)
- The PACK.p.P constructor is HORRIBLE
- Security issues
  - Username/password is sent via plaintext
  - No restriction on $doRequest requesting sensitive fields
  - Session creation is a hazard
- Refresh page if version changes? (Will require repeated polling for `infoSet.appVersion`

theory deletion, better preloaded test data, infoSet.activeNodes entries simplified, CachedInfo, (Repeating|Reacting)?SyncedInfo, RootView

*/

var package = new PACK.pack.Package({ name: 'logic',
  dependencies: [ 'quickDev', 'userify', 'p', 'geom', 'queries' ],
  buildFunc: function(packageName, qd, userify, p, geom) {
    
    var Point = geom.Point;
    
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
                      supporterSet: [],
                      contenderSet: [],
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
              
              if (relationType === 'supporter') {
                
                if (standing.getChild([ 'contenderSet', incoming.name ]))
                  throw new Error(incoming.name + ' already contends ' + standing.name + '. It cannot also support it.');
                
                console.log('Adding supporter');
                var editor = new qd.Editor();
                var $relation = editor.$addFast({
                  par: standing.getChild('supporterSet'),
                  name: incoming.name,
                  data: {
                    theory: incoming
                  }
                });
                
              } else if (relationType === 'contender') {
                
                if (standing.getChild([ 'supporterSet', incoming.name ]))
                  throw new Error(incoming.name + ' already supports ' + standing.name + '. It cannot also contend it.');
                
                console.log('Adding contender');
                var editor = new qd.Editor();
                var $relation = editor.$addFast({
                  par: standing.getChild('contenderSet'),
                  name: incoming.name,
                  data: {
                    theory: incoming
                  }
                });
                
              } else {
                
                throw new Error('Invalid relationType: "' + relationType + '"');
                
              }
              
              return $relation.then(function(data) {
                return {
                  msg: relationType + ' added',
                  standing: standing.getDataView({})
                }
              });
              
            } else if (command === 'unrelateTheories') {
              
              var reqParams = U.param(params, 'params');
              
              var token = U.param(reqParams, 'token');
              
              var theorySet = this.children.theorySet;
              
              var standingQuickName = U.param(reqParams, 'standingQuickName');
              var standing = theorySet.children[standingQuickName];
              if (!standing) throw new Error ('Invalid standing quickName: "' + standingQuickName + '"');
              
              var incomingQuickName = U.param(reqParams, 'incomingQuickName');
              var incoming = theorySet.children[incomingQuickName];
              if (!incoming) throw new Error ('Invalid incoming quickName: "' + incomingQuickName + '"');
              
              if (incoming === standing) throw new Error('Cannot unrelate a theory from itself');
              
              var relationType = U.param(reqParams, 'relationType');
              
              if (relationType === 'supporter') {
                
                console.log('Removing supporter');
                var editor = new qd.Editor();
                var $unrelate = editor.$remFast({
                  par: standing.getChild('supporterSet'),
                  name: incomingQuickName
                });
                
              } else if (relationType === 'contender') {
                
                console.log('Removing contender');
                var editor = new qd.Editor();
                var $unrelate = editor.$remFast({
                  par: standing.getChild('contenderSet'),
                  name: incomingQuickName
                });
                
              } else {
                
                throw new Error('Invalid relationType: "' + relationType + '"');
                
              }
              
              return $unrelate.then(function(data) {
                return {
                  msg: relationType + ' removed',
                  standing: standing.getDataView({}),
                  incoming: incoming.getDataView({})
                }
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
              
            } else if (command === 'getIncomingRelations') {
              
              var reqParams = U.param(params, 'params');
              var quickName = U.param(reqParams, 'quickName');
              
              var theory = this.children.theorySet.children[quickName];
              if (!theory) throw new Error('Invalid quickName: "' + quickName + '"');
              
              var relToData = function(rel) {
                var theory = rel.getChild('@theory');
                return {
                  quickName: theory.getChild('quickName').getValue(),
                  address: theory.getAddress()
                }
              };
              
              return new PACK.p.P({ val: {
                supporters: theory.children.supporterSet.children.map(relToData),
                contenders: theory.children.contenderSet.children.map(relToData)
              }});
              
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
      }),
      
      nodeRelationOffsets: {
        supporter: new Point({ x: -128, y: -98 }),
        contender: new Point({ x: 128, y: -98 })
      },
      graphNodeInvRadius: 1 / 150,
      LogicPhysicsDecorator: U.makeClass({ name: 'LogicPhysicsDecorator',
        superclass: userify.Decorator,
        methods: function(sc, c) { return {
          init: function(params /* info, enabledInfo, maxUpdatesPerFrame */) {
            sc.init.call(this, params);
            
            this.info = U.param(params, 'info');
            this.enabledInfo = userify.pafam(params, 'enabledInfo', true);
            
            var physicsSettings = U.param(params, 'physicsSettings', {});
            this.physicsSettings = {
              scaleTime: 1,
              dampenGlobal: 0.99,
              gravityPow: 2,
              gravityMult: 1 / 100,
              separation: 20,
              centerAclMag: 10,
              minVel: 0,
              relationStrength: {
                supporter: 10,
                contender: 10
              }
            }.update(physicsSettings);
            
            this.maxUpdatesPerFrame = U.param(params, 'maxUpdatesPerFrame', 1000);
            this.updateIndex = 0;
          },
          sigmoid: function(x) {
            /*
            This is a great smooth curve; begins at (0,0), ends at (1,1),
            approachs 0 quickly towards the left, then approaches 1 quickly
            towards the right. Nodes will quickly decelerate as they reach
            their destination, and will quickly accelerate when they are
            far from where they're meant to be
            */
            if (x < 0) return 0;
            if (x > 1) return 1;
            
            return x < 0.5
              ? (2 * x * x)
              : (-0.5 * (4 * x * x - (8 * x)) - 1);
          },
          update: function(view, millis) {
            
            if (!this.enabledInfo.getValue()) return;
            
            var ps = this.physicsSettings;
            var secs = millis * 0.001 * ps.scaleTime;
            
            var cs = this.info.getValue().toArray();
            var ncs = cs.length;
            var mncs = Math.min(ncs, this.maxUpdatesPerFrame);
            
            for (var n = 0; n < mncs; n++) {
              
              var i = this.updateIndex;
              this.updateIndex = (++this.updateIndex >= cs.length) ? 0 : this.updateIndex;
              
              var qn1 = cs[i].getValue('quickName');
              var phys1 = cs[i].getChild('physics');
              var loc1 = phys1.getValue('loc');
              var vel1 = phys1.getValue('vel');
              var acl1 = phys1.getValue('acl');
              var r1 = phys1.getValue('r');
              var w1 = phys1.getValue('weight');
              
              // Increment location based on velocity
              loc1 = loc1.add(vel1.scale(secs));
              
              // Increment velocity based on acceleration; then dampen
              vel1 = vel1.add(acl1.scale(secs)).scale(ps.dampenGlobal);
              
              // Reset acceleration to 0. Acceleration will go towards the center for
              // any theories that are NOT incoming theories (incoming theories already
              // attract towards a standing theory; they don't need central gravitation)
              var isIncoming = false;
              acl1 = geom.ORIGIN;
              
              for (var j = 0; j < ncs; j++) {
                if (i === j) continue;
                
                // Note that phys1 is the incoming theory, and phys2 is the standing theory
                
                var phys2 = cs[j].getChild('physics');
                var loc2 = phys2.getValue('loc');
                var vel2 = phys2.getValue('vel');
                var acl2 = phys2.getValue('acl');
                var r2 = phys2.getValue('r');
                var w2 = phys2.getValue('weight');
                
                var centerDist = null; // Won't be calculated until necessary
                
                var incRelations = cs[j].getValue('incomingRelations');
                
                if (qn1 in incRelations) {
                  
                  isIncoming = true;
                  var attractors = incRelations[qn1].relations.map(function(rel, k) { return lg.nodeRelationOffsets[k]; });
                  var attractor = PACK.geom.midPoint(attractors.toArray()).scale(r2 * lg.graphNodeInvRadius).add(loc2);
                  
                  acl1 = acl1.add(new Point({
                    ang: loc1.angleTo(attractor),
                    mag: (this.sigmoid(loc1.dist(attractor) * 0.01)) * ps.gravityMult
                  }));
                  
                } else {
                
                  /*
                  // TODO: Removed attraction between unrelated nodes; is this ok??
                  centerDist = loc1.dist(loc2);
                  var denom = Math.max(Math.pow(centerDist, ps.gravityPow), 1) * r1 * w1;
                  if (denom) // Look out for division by 0
                    acl1 = acl1.add(new Point({
                      ang: loc1.angleTo(loc2),
                      mag: (ps.gravityMult * ps.gravityMult * r2 * w2) / denom
                    }));
                  */
                  
                }
                
                if (w1 <= w2) { // If node1 is lighter, it may be displaced by node2
                  
                  if (!centerDist) centerDist = loc1.dist(loc2); // `centerDist` may already be calculated
                  
                  var sepDist = r1 + r2 + ps.separation;
                  var gap = centerDist - sepDist;
                  if (gap < 0) { 
                    
                    loc1 = loc2.angleMove(loc2.angleTo(loc1), sepDist);
                    
                  }
                  
                }
                
              }
              
              //if (!isIncoming) acl1 = acl1.angleMove(loc1.angleTo(geom.ORIGIN), ps.centerAclMag);
              if (!isIncoming) vel1 = vel1.angleMove(loc1.angleTo(geom.ORIGIN), 10);
              
              phys1.setValue('loc', loc1);
              phys1.setValue('vel', vel1);
              phys1.setValue('acl', acl1);
              
            }
            
          }
        };}
      })
    };
    
    if (U.isServer()) {
      
      // Only the server needs the schema
      
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
                  { c: qd.DossierList,    p: { name: 'supporterSet',
                    innerOutline: { c: qd.DossierDict, i: [
                      { c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
                    ]},
                    prop: '@theory.quickName/value',
                    defaultValue: function() { return []; }
                  }},
                  { c: qd.DossierList,    p: { name: 'contenderSet',
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
                  },
                  {
                    par: root.getChild('essaySet'),
                    data: {
                      markup: 'IMPORTANT ESSAY THREE'
                    }
                  },
                  {
                    par: root.getChild('essaySet'),
                    data: {
                      markup: 'IMPORTANT ESSAY FOUR'
                    }
                  },
                  {
                    par: root.getChild('essaySet'),
                    data: {
                      markup: 'IMPORTANT ESSAY FIVE'
                    }
                  },
                  {
                    par: root.getChild('essaySet'),
                    data: {
                      markup: 'IMPORTANT ESSAY SIX'
                    }
                  },
                  {
                    par: root.getChild('essaySet'),
                    data: {
                      markup: 'IMPORTANT ESSAY SEVEN'
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
                      supporterSet: [],
                      contenderSet: [],
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
                      supporterSet: [],
                      contenderSet: [],
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
                      supporterSet: [],
                      contenderSet: [],
                      voterSet: []
                    }
                  },
                  {
                    par: root.getChild('theorySet'),
                    name: 'importantThree',
                    data: {
                      createdTime: +new Date(),
                      editedTime: +new Date(),
                      quickName: 'importantThree',
                      title: 'THREE',
                      user: users[1],
                      essay: essays[3],
                      supporterSet: [],
                      contenderSet: [],
                      voterSet: []
                    }
                  },
                  {
                    par: root.getChild('theorySet'),
                    name: 'importantFour',
                    data: {
                      createdTime: +new Date(),
                      editedTime: +new Date(),
                      quickName: 'importantFour',
                      title: 'FOUR',
                      user: users[1],
                      essay: essays[4],
                      supporterSet: [],
                      contenderSet: [],
                      voterSet: []
                    }
                  },
                  {
                    par: root.getChild('theorySet'),
                    name: 'importantFive',
                    data: {
                      createdTime: +new Date(),
                      editedTime: +new Date(),
                      quickName: 'importantFive',
                      title: 'FIVE',
                      user: users[1],
                      essay: essays[5],
                      supporterSet: [],
                      contenderSet: [],
                      voterSet: []
                    }
                  },
                  {
                    par: root.getChild('theorySet'),
                    name: 'importantSix',
                    data: {
                      createdTime: +new Date(),
                      editedTime: +new Date(),
                      quickName: 'importantSix',
                      title: 'SIX',
                      user: users[1],
                      essay: essays[6],
                      supporterSet: [],
                      contenderSet: [],
                      voterSet: []
                    }
                  },
                  {
                    par: root.getChild('theorySet'),
                    name: 'importantSeven',
                    data: {
                      createdTime: +new Date(),
                      editedTime: +new Date(),
                      quickName: 'importantSeven',
                      title: 'SEVEN',
                      user: users[1],
                      essay: essays[7],
                      supporterSet: [],
                      contenderSet: [],
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
                    par: root.getChild('theorySet.userZeroTheory.supporterSet'),
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
      
    }
    
    return lg;
  },
  runAfter: function() {
    
    if (U.isServer()) return;
    
    var lg = PACK.logic;
    var qd = PACK.quickDev;
    var uf = PACK.userify;
    
    // `doss` provides the $doRequest method that will be used throughout this app
    var doss = new lg.LogicApp({ outline: null });
    doss.updateName('app');
    
    // Here's the `infoSet`. It's equivalent to the state of the app
    var infoSet = new uf.DictInfo({ children: {
      icons: new uf.DictInfo({ children: {
        remove: new uf.SimpleInfo({ value: String.fromCharCode(0xe900) }),
        insert: new uf.SimpleInfo({ value: String.fromCharCode(0xf055) }),
        close: new uf.SimpleInfo({ value: String.fromCharCode(0xf00d) }),
        del: new uf.SimpleInfo({ value: String.fromCharCode(0xf014) }),
      }}),
      rps: new uf.SimpleInfo({ value: 'rps' }),
      token: new uf.SimpleInfo({ value: null }),
      appVersion: new uf.RepeatingSyncedInfo({
        $getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
      }),
      loginView: new uf.CalculatedInfo({
        getFunc: function() {  return infoSet.getValue('token') ? 'in' : 'out'  }
      }),
      username: new uf.SimpleInfo({ value: '' }),
      password: new uf.SimpleInfo({ value: '' }),
      loginError: new uf.SimpleInfo({ value: '' }),
      focusedNode: new uf.SimpleInfo({ value: null }),
    }});
    infoSet.addChild('activeNodes', new uf.DictInfo({ children: {} }));
    infoSet.addChild('physicsEnabled', new uf.SimpleInfo({ value: true }));
    infoSet.addChild('searchTerm', new uf.SimpleInfo({ value: '' }));
    infoSet.addChild('searchResults', new uf.ReactingSyncedInfo({
      initialValue: {},
      info: infoSet.getChild('searchTerm'),
      $getFunc: function() {
        var searchTerm = infoSet.getValue('searchTerm');
        if (searchTerm === '') return new PACK.p.P({ val: {} });
        
        // TODO: Should return an `Info` object, not a plain `Object`.
        return doss.$doRequest({
          command: 'searchTheories',
          params: {
            searchTerm: searchTerm
          }
        });
      }
    }));
    infoSet.start();
    
    // Values for controlling extra data attached to graph nodes (TODO: Subclass SetView as GraphNodeSetView; add data to subclass instead??)
    var makeNodeData = function(params /* quickName, username, editing */) {
      var quickNameInfo = uf.pafam(params, 'quickName');
      var usernameInfo = uf.pafam(params, 'username');
      var editingInfo = uf.pafam(params, 'editing');
      
      var owned = usernameInfo.getValue() === infoSet.getValue('username');
      
      var ret = new uf.DictInfo({ children: {
        physics: new uf.DictInfo({ children: {
          r: new uf.SimpleInfo({ value: 65 }),
          weight: new uf.SimpleInfo({ value: 1 }),
          loc: new uf.SimpleInfo({ value: new PACK.geom.Point({ ang: Math.random() * Math.PI * 2, mag: 0.01 }) }),
          vel: new uf.SimpleInfo({ value: PACK.geom.ORIGIN }),
          acl: new uf.SimpleInfo({ value: PACK.geom.ORIGIN })
        }}),
        username: usernameInfo,
        quickName: quickNameInfo,
        title: new uf.SimpleInfo({ value: '' }),
        theory: new uf.SimpleInfo({ value: '' }),
        saved: new uf.SimpleInfo({ value: false }),
        incomingRelations: new uf.SimpleInfo({ value: [] }),
        owned: new uf.SimpleInfo({ value: owned }),
        editing: editingInfo
      }});
      
      ret.start();
      
      return ret;
    };
    var saveNodeData = function(nodeInfo) {
      // "saved" is now fixed to the value `true`
      nodeInfo.setValue('saved', true);
      
      console.log(nodeInfo.getValue('title'));
      
      // "title" syncs with the `theorySet.<theoryId>.title` value server-side
      nodeInfo.modChild('title', new uf.RepeatingSyncedInfo({
        initialValue: nodeInfo.getValue('title'),
        $getFunc: function() {
          return doss.$doRequest({ command: 'getValue', address: [ 'theorySet', nodeInfo.getValue('quickName'), 'title' ] });
        },
        $setFunc: function(val) {
          return doss.$doRequest({ command: 'setValue', address: [ 'theorySet', nodeInfo.getValue('quickName'), 'title' ],
            params: {
              token: infoSet.getValue('token'),
              username: infoSet.getValue('username'),
              value: val
            }
          });
        },
        updateMs: 60000
      }));
      
      // "theory" syncs with the `theorySet.<theoryId>.@essay.markup` value server-side
      nodeInfo.modChild('theory', new uf.RepeatingSyncedInfo({
        initialValue: nodeInfo.getValue('theory'),
        $getFunc: function() {
          return doss.$doRequest({ command: 'getValue', address: [ 'theorySet', nodeInfo.getValue('quickName'), '@essay', 'markup' ] });
        },
        $setFunc: function(val) {
          return doss.$doRequest({ command: 'setValue', address: [ 'theorySet', nodeInfo.getValue('quickName'), '@essay', 'markup' ],
            params: {
              token: infoSet.getValue('token'),
              username: infoSet.getValue('username'),
              value: val
            }
          });
        },
        updateMs: 60000
      }));
      
      // "incomingRelations" repetitively syncs with the server
      nodeInfo.modChild('incomingRelations', new uf.RepeatingSyncedInfo({
        initialValue: [],
        $getFunc: function() {
          
          return doss.$doRequest({
            
            command: 'getIncomingRelations',
            params: {
              quickName: nodeInfo.getValue('quickName')
            }
            
          }).then(function(related) {
            
            var activeNodes = infoSet.getValue('activeNodes');
            
            var ret = {};
            
            var supps = related.supporters;
            var conts = related.contenders;
            
            for (k in supps) {
              if (!(k in ret)) ret[k] = { quickName: k, relations: {}, data: {} };
              ret[k].relations.supporter = {}; // Can store any arbitrary data on the relation
            }
            
            for (k in conts) {
              if (!(k in ret)) ret[k] = { quickName: k, relations: {}, data: {} };
              ret[k].relations.contender = {}; // Can store any arbitrary data on the relation
            }
            
            return ret;
            
          });
          
        },
        updateMs: 60000
      }));
      
      nodeInfo.start();
      
      return nodeInfo;
    };
    var renameNodeData = function(params /* oldName, newName */) {
      var oldName = U.param(params, 'oldName');
      var newName = U.param(params, 'newName');
      
      var activeNodes = infoSet.getChild('activeNodes');
      
      // Get the value which is changing keys...
      var nodeInfo = activeNodes.getChild(oldName);
      
      // ... update its quickName...
      nodeInfo.setValue('quickName', newName);
      
      // ... and re-key it.
      activeNodes.remChild(oldName);
      activeNodes.addChild(newName, nodeInfo);
      
      /*
      infoSet.modValue('activeNodes', function(activeNodes) {
        
        
        // Re-key...
        //activeNodes[newName] = activeNodes[oldName];
        //delete activeNodes[oldName];
        // ... and update the quickName
        //activeNodes[newName].quickName.setValue(newName);
        
        return activeNodes;
      });
      */
    };
    var removeNodeData = function(name) {
      // TODO: BAD!
      delete infoSet.getChild('activeNodes').children[name];
      /*infoSet.getChild('activeNodes').remChild(name);
      infoSet.modValue('activeNodes', function(activeNodes) {
        var o = activeNodes[name];
        var p = o.physics;
        [ p.r, p.weight, p.loc, o.username, o.quickName, o.title, o.theory, o.saved, o.incomingRelations
        ].forEach(function(info) {
          info.stop();
        });
        
        delete activeNodes[name];
        return activeNodes;
      });*/
    };
    
    // Function called when a theory is dragged to the dropzone of another theory
    var $relateTheories = function(relationType, params /* target, dropZone */) {
      
      // `incoming` supports or contends `standing`
      var standing = U.param(params, 'dropZone').par.par; // Walk to theory view
      var incoming = U.param(params, 'target');
      
      var activeNodes = infoSet.getValue('activeNodes');
      
      var standingData = activeNodes[standing.name];
      var incomingData = activeNodes[incoming.name];
      
      if (!standingData.saved.getValue() || !incomingData.saved.getValue())
        throw new Error('Relations cannot involve unsaved theories');
      
      var rel = standingData.incomingRelations.getValue()[incoming.name];
      var alreadyRelated = rel && (relationType in rel.relations);
      
      return doss.$doRequest({ command: alreadyRelated ? 'unrelateTheories' : 'relateTheories', params: {
        token: infoSet.getValue('token'),
        standingQuickName: standingData.quickName.getValue(),
        incomingQuickName: incomingData.quickName.getValue(),
        relationType: relationType
      }}).then(function(data) {
        console.log('RELATION EDIT COMPLETE??', data);
        standingData.incomingRelations.refresh();
      }).fail(function(err) {
        console.error('Error editing relation: ', err.message);
      });
      
    };
    var $loadRelatedTheories = function(theoryQuickName, relationName, relationSetName) {
      
      return doss.$doRequest({
        
        address: [ 'theorySet', theoryQuickName, relationSetName ],
        command: 'getRawData'
        
      }).then(function(relationSet) {
        
        return new PACK.p.P({ all: relationSet.map(function(relation) {
          return doss.$doRequest({
            
            address: relation.theory,
            command: 'getPickedFields',
            params: {
              fields: [ 'title', '@user', 'quickName' ]
            }
            
          })
        })})
      
      }).then(function(pickedFieldSet) {
        
        var activeNodes = infoSet.modValue('activeNodes', function(activeNodes) {
          
          for (var k in pickedFieldSet) {
            var quickName = pickedFieldSet[k].quickName;
            var username = pickedFieldSet[k]['@user'].username;
            
            if (quickName in activeNodes) continue; // TODO: Should the data be updated, considering it's immediately available?
            
            activeNodes.addChild(quickName, saveNodeData(makeNodeData({
              quickName: quickName,
              username: username,
              editing: false
            })));
          }
          
          return activeNodes;
          
        });
        
        if (theoryQuickName in activeNodes) {
          var phys = activeNodes[theoryQuickName].physics;
          var loc = phys.loc.getValue();
          var r = phys.r.getValue();
          
          var addOrigin = loc.add(lg.nodeRelationOffsets[relationName].scale(r * lg.graphNodeInvRadius));
          
          var added = graphView.updateChildren().add;
          for (var k in added) {
            // Set the loc to be right at the relation ear
            activeNodes[k].physics.loc.setValue(addOrigin.angleMove(Math.random() * Math.PI * 2, 0.01));
          }
        }
        
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
        return infoSet.getValue([ 'activeNodes', view.name, 'physics', 'loc' ]);
      }
    });
    var dragAddSupporter = new uf.DragActionDecorator({ dragDecorator: dragNode, action: $relateTheories.bind(null, 'supporter') });
    var dragAddContender = new uf.DragActionDecorator({ dragDecorator: dragNode, action: $relateTheories.bind(null, 'contender') });
    var clickNode = new uf.ClickDecorator({
      validTargets: [
        '._text._user',           // Clicking on the username
        '._choose-display',       // Clicking on either the title or the content when they're not editable
        // '._toggleEdit > ._view'   // Clicking the edit toggler // TODO: Bad because toggling off editing always unfocuses :(
      ],
      action: function(view) {
        // No click action should apply during a drag. Prevents drag mouseup from focusing node.
        if (dragNode.isDragging(view)) return;
        
        infoSet.modValue('focusedNode', function(view0) {
          // Clicking a focused node unfocuses it. Clicking an unfocused node focuses it.
          // Unfocusing a node sets its "editing" property to `false`
          if (view0 === view) {
            infoSet.getValue([ 'activeNodes', view.name, 'editing' ], false);
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
    var removeNodeView = new uf.SetView({ name: 'remove', cssClasses: [ 'dropZone' ], children: [ new uf.TextView({ name: 'text', info: infoSet.getChild('icons.remove') }) ] });
    removeNodeView.decorators = [ removeNode, removeNode.createClassDecorator(removeNodeView) ];
    
    // Drag nodes to this view to delete them
    var deleteNode = new uf.DragActionDecorator({ dragDecorator: dragNode, action: function(params /* target, dropZone */) {
      
      var target = U.param(params, 'target');
      var targetData = infoSet.getValue('activeNodes')[target.name];
      
      // If the theory is saved ask the server to delete it, otherwise simply remove it
      if (targetData.saved.getValue()) {
        
        var $delete = doss.$doRequest({
          command: 'deleteTheory',
          params: { token: infoSet.getValue('token'), quickName: targetData.quickName.getValue() }
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
    var deleteNodeView = new uf.SetView({ name: 'delete', cssClasses: [ 'dropZone' ], children: [ new uf.TextView({ name: 'text', info: infoSet.getChild('icons.del') }) ] });
    deleteNodeView.decorators = [ deleteNode, deleteNode.createClassDecorator(deleteNodeView) ];
    
    var graphView = new uf.DynamicSetView({ name: 'graph',
      childInfo: infoSet.getChild('activeNodes'),
      decorators: [
        new lg.LogicPhysicsDecorator({ maxUpdatesPerFrame: 10,
          info: infoSet.getChild('activeNodes'),
          enabledInfo: infoSet.getChild('physicsEnabled'),
          /*physicsSettings: {
            scaleTime: 1,
            dampenGlobal: 0.82,
            gravityPow: 1.5,
            gravityMult: 300,
            separation: 20,
            centerAclMag: 1000,
            minVel: 0
          }*/
          physicsSettings: {
            scaleTime: 1,
            dampenGlobal: 0.95,
            gravityPow: 1.5,
            gravityMult: 300,
            separation: 20,
            centerAclMag: 100,
            minVel: 0
          }
        })
      ],
      genChildView: function(name, nodeInfo) {
        
        // This is the view that will be returned
        var view = new uf.SetView({ name: name });
        
        // Add data to the `Info` object: owned, saved, and editing, and physics
        var loc = nodeInfo.getValue('physics.loc');
        var owned = nodeInfo.getValue('username') === infoSet.getValue('username');
        
        var physInfo = nodeInfo.getChild('physics');
        physInfo.modChild('r', new uf.CalculatedInfo({
          getFunc: function() {
            return view === infoSet.getValue('focusedNode') ? 150 : 65;
          }
        }));
        physInfo.modChild('weight', new uf.CalculatedInfo({
          getFunc: function() {
            // Nodes being dragged have 0 weight
            var drg = dragNode.info.getValue();
            
            // 1) Nodes that aren't being dragging have a weight of `1`
            if (!dragNode.isDragging(view)) return 1;
            
            var waitTimeMs = dragNode.info.getValue().getWaitTimeMs();
            
            // 2) Dragged nodes that are held in place for a moment can gain weight...
            if (waitTimeMs > 500)
              
              // 3) Unless the node is being held over another node's dropZone (can't push away nodes the user is trying to interact with)
              if (!dragAddSupporter.info.getValue() && !dragAddContender.info.getValue()) return 3;
            
            // 4) All dragged nodes have a weight of `0`
            return 0;
          }
        }));
        physInfo.modChild('loc', new uf.CalculatedInfo({
          getFunc: function() {
            
            // 1) Nodes being dragged position to cursor
            if (dragNode.isDragging(view)) {
              var drg = dragNode.info.getValue();
              // return loc = drg.pt2.add(drg.capturedData); // Note that `loc` is also updated here
              return loc = drg.capturedData.sub(drg.pt1).add(drg.pt2); // Note that `loc` is also updated here
            }
            
            // 2) Focused node positions to center (only when physics are running)
            if (infoSet.getValue('focusedNode') === view && infoSet.getValue('physicsEnabled')) return loc = PACK.geom.ORIGIN;
            
            // 3) Position to the calculated physics `loc`
            return loc;
            
          },
          setFunc: function(newLoc) {
            loc = newLoc;
          }
        }));
        
        // Create the dropzones for supporting and contending
        var loadSupportersButton = new uf.ActionView({ name: 'loadSupporters', textInfo: 'Supporters...', $action: function() {
          
          return $loadRelatedTheories(nodeInfo.getValue('quickName'), 'supporter', 'supporterSet').fail(function(err) {
            console.log('SUPPORTERS FAILED');
            console.error(err.stack);
          });
          
        }});
        loadSupportersButton.decorators = [
          dragAddSupporter,
          dragAddSupporter.createClassDecorator(loadSupportersButton)
        ];
        
        var loadContendersButton = new uf.ActionView({ name: 'loadContenders', textInfo: 'Contenders...', $action: function() {
          
          return $loadRelatedTheories(nodeInfo.getValue('quickName'), 'contender', 'contenderSet').fail(function(err) {
            console.log('CONTENDERS FAILED');
            console.error(err.stack);
          });
          
        }});
        loadContendersButton.decorators = [
          dragAddContender,
          dragAddContender.createClassDecorator(loadContendersButton)
        ];
        
        // Install all necessary attributes on `view` before returning it
        view.cssClasses = [ 'theory', nodeInfo.getValue('owned') ? 'owned' : 'foreign' ]; // Set static classes
        view.decorators = [
          dragNode,   // Dragging affects position
          clickNode,  // Clicking focuses node
          new uf.CssDecorator({   // Modify position and radius based on physics
            properties: [ 'left', 'top', 'transform' ],
            info: function() {
              var phys = nodeInfo.getChild('physics');
              var loc = phys.getValue('loc');
              var r = phys.getValue('r');
              
              return {
                left: Math.round(loc.x - r) + 'px',
                top: Math.round(loc.y - r) + 'px',
                transform: 'scale(' + r * lg.graphNodeInvRadius + ')'
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
              return infoSet.getValue('focusedNode') === view ? 'focused' : null;
            }
          }),
          new uf.ClassDecorator({ // Add "saved"/"unsaved" classes
            list: [ 'saved', 'unsaved' ],
            info: function() {
              return nodeInfo.getValue('saved') ? 'saved' : 'unsaved'
            }
          })
        ];
        view.addChildren([
          new uf.SetView({ name: 'controls', children: [
            loadSupportersButton,
            loadContendersButton,
          ]}),
          new uf.ChoiceView({ name: 'data', choiceInfo: function() { return nodeInfo.getValue('saved') ? 'saved' : 'unsaved' }, children: [
            // Shows up on unsaved theories (allows editing only quickName)
            new uf.SetView({ name: 'unsaved', children: [
              new uf.TextEditView({ name: 'quickName', cssClasses: [ 'centered' ], textInfo: nodeInfo.getChild('quickName'), placeholderData: 'quickName' }),
              new uf.ActionView({ name: 'save', textInfo: 'Save', $action: function() {
                
                var $saveTheory = doss.$doRequest({
                  command: 'saveTheory',
                  params: {
                    token: infoSet.getValue('token'),
                    username: infoSet.getValue('username'),
                    quickName: nodeInfo.getValue('quickName'),
                    title: '',
                    theory: '',
                    type: 'create' // 'create' | 'update'
                  }
                });
                
                return $saveTheory.then(function(response) {
                  
                  var originalName = view.name;
                  var savedQuickName = response.quickName;
                  
                  // If the quickName has changed re-key the view...
                  if (savedQuickName !== originalName) {
                    
                    // ... both in `activeNodes`...
                    renameNodeData({ oldName: originalName, newName: savedQuickName }); // This will update `quickName` Info
                    
                    // ... and in `graphView`
                    graphView.renameChild(view, nodeInfo.getValue('quickName')); // Should only happen on save success
                    
                  }
                  
                  // Insert all server-syncing properties now that this theory is saved
                  saveNodeData(nodeInfo);
                  
                }).fail(function(err) {
                  console.log('Couldn\'t create theory: ' + err.message);
                  console.error(err.stack);
                });
                
              }})
            ]}),
            
            // Shows up for saved theories (allows editing title and essay)
            new uf.SetView({ name: 'saved', children: [
              
              new uf.TextView({ name: 'user', info: nodeInfo.getChild('username') }),
              new uf.DynamicTextEditView({ name: 'title',
                editableData: function() {
                  return view === infoSet.getValue('focusedNode') && nodeInfo.getValue('editing') && nodeInfo.getValue('owned');
                },
                textInfo: new uf.ProxyInfo({ info: nodeInfo, path: 'title' }),
                inputViewParams: {
                  cssClasses: [ 'centered' ],
                  placeholderData: 'Title'
                }
              }),
              new uf.DynamicTextEditView({ name: 'theory',
                editableData: function() {
                  return view === infoSet.getValue('focusedNode') && nodeInfo.getValue('editing') && nodeInfo.getValue('owned');
                },
                textInfo: new uf.ProxyInfo({ info: nodeInfo, path: 'theory' }),
                inputViewParams: {
                  placeholderData: 'Theory',
                  multiline: true
                }
              }),
              new uf.TextView({ name: 'quickName', info: nodeInfo.getChild('quickName') }),
              
            ]})
            
          ]}),
          new uf.ChoiceView({ name: 'toggleEdit', choiceInfo: function() { return nodeInfo.getValue('owned') && nodeInfo.getValue('saved') ? 'view' : null }, children: [
            new uf.ActionView({ name: 'view', textInfo: '',
              decorators: [
                new uf.ClassDecorator({
                  list: [ 'editing' ],
                  info: function() {
                    return nodeInfo.getValue('editing') ? 'editing' : null;
                  }
                })
              ],
              $action: function() {
                nodeInfo.modValue('editing', function(val) { return !val; });
                return PACK.p.$null;
              }
            })
          ]})
        ]);
        
        return view;
        
      }
    });
    
    var strokes = {
      supporter: 'rgba(100, 255, 100, 0.65)',
      contender: 'rgba(255, 100, 100, 0.65)'
    };
    var canvasView = new uf.CanvasView({ name: 'canvas', options: { centered: true }, drawFunc: function(ctx, millis) {
      ctx.lineWidth = 12;
      
      var items = infoSet.getValue('activeNodes');
      for (var k in items) {
        
        if (!(k in graphView.children)) continue;
        
        var standingInfo = items[k];
        var standingElem = graphView.children[k];
        
        if (!standingElem.domRoot) continue;
        
        var canvas = canvasView.domRoot;
        var hw = canvas.width >> 1;
        var hh = canvas.height >> 1;
        var incomingRelations = standingInfo.getValue('incomingRelations');
        
        var b1 = graphView.children[k].domRoot.getBoundingClientRect()
        var r1 = b1.width * 0.5; // width and height are equal so either works
        var loc1 = new PACK.geom.Point({ x: b1.left + r1 - hw, y: b1.top + r1 - hh });
        var ratio = r1 * lg.graphNodeInvRadius;
        
        for (var qn in incomingRelations) {
          
          // TODO: This is bad!! Possible for `qn` to be in the graphView, but for its domRoot to not be initialized :(
          if (!(qn in items) || !(qn in graphView.children) || !graphView.children[qn].domRoot) continue; // The incoming theory isn't fully loaded client-side
          
          var incomingInfo = items[qn];
          
          var b2 = graphView.children[qn].domRoot.getBoundingClientRect();
          var r2 = incomingInfo.physics.r.getValue();
          var loc2 = new PACK.geom.Point({ x: b2.left + r2 - hw, y: b2.top + r2 - hh });
          
          var relations = incomingRelations[qn].relations;
          for (var relationType in relations) {
            
            var relLoc = loc1.add(lg.nodeRelationOffsets[relationType].scale(ratio));
            
            var ang = loc2.angleTo(relLoc);
            loc2 = loc2.angleMove(ang, r2);
            
            ctx.strokeStyle = strokes[relationType];
            ctx.beginPath();
            ctx.moveTo(loc2.x, loc2.y);
            ctx.lineTo(relLoc.x, relLoc.y);
            ctx.stroke();
            
          }
        
        }
        
      }
      
    }});
    
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
      
      new uf.ChoiceView({ name: 'login', choiceInfo: infoSet.getChild('loginView'), children: [
        
        new uf.SetView({ name: 'out', children: [
          
          new uf.TextHideView({ name: 'loginError', info: infoSet.getChild('loginError') }),
          
          new uf.TextEditView({ name: 'username', textInfo: infoSet.getChild('username'), placeholderData: 'Username' }),
          new uf.TextEditView({ name: 'password', textInfo: infoSet.getChild('password'), placeholderData: 'Password' }),
          new uf.ActionView({ name: 'submit', textInfo: 'Submit!', $action: function() {
            return doss.$doRequest({ command: 'getToken', params: {
              username: infoSet.getValue('username'),
              password: infoSet.getValue('password')
            }}).then(function(data) {
              infoSet.setValue('token', data.token);
            }).fail(function(err) {
              infoSet.setValue('loginError', err.message);
              new PACK.p.P({ timeout: 3000 }).then(function() { infoSet.setValue('loginError', ''); });
            });
          }})
          
        ]}),
        new uf.SetView({ name: 'in', children: [
          
          canvasView,
          graphView,
          new uf.SetView({ name: 'dropZones', children: [ removeNodeView, deleteNodeView ]}),
          new uf.SetView({ name: 'controls', children: [
            new uf.SetView({ name: 'search', cssClasses: [ 'control' ], children: [
              new uf.TextEditView({ name: 'bar', textInfo: infoSet.getChild('searchTerm'), placeholderData: 'Search' }),
              // TODO: What about an unsaved atom that has the same quickName (e.g. "newTheory") as a saved atom?
              // Loading it in will clobber the unsaved atom for what will look like no reason
              new uf.DynamicSetView({ name: 'results',
                childInfo: infoSet.getChild('searchResults'),
                decorators: [
                ],
                genChildView: function(name, nodeInfo) {
                  
                  console.log('GEN', nodeInfo);
                  
                  var view = new uf.SetView({ name: name });
                  
                  view.cssClasses = [ 'result' ];
                  view.decorators = [
                    new uf.ClassDecorator({
                      list: [ 'active' ],
                      info: function() {
                        return (nodeInfo.quickName in infoSet.getValue('activeNodes')) ? 'active' : null;
                      }
                    })
                  ];
                  view.addChildren([
                    new uf.TextView({ name: 'username', cssClasses: [ 'item' ], info: nodeInfo.username }),
                    new uf.TextView({ name: 'quickName', cssClasses: [ 'item' ], info: nodeInfo.quickName }),
                    new uf.TextView({ name: 'title', cssClasses: [ 'item' ], info: nodeInfo.title }),
                    new uf.TextView({ name: 'theory', cssClasses: [ 'item' ], info: nodeInfo.theory }),
                    new uf.ActionView({ name: 'choose', textInfo: infoSet.getChild('icons.insert'), $action: function() {
                      
                      if (!(nodeInfo.quickName in graphView.children)) {
                      
                        // A new theory has been added
                        var activeNodes = infoSet.getChild('activeNodes');
                        activeNodes.addChild(nodeInfo.quickName, saveNodeData(makeNodeData({
                          quickName: nodeInfo.quickName,
                          username: nodeInfo.username,
                          editing: false
                        })));
                        
                        // Ensure that `graphView` is immediately synced
                        graphView.updateChildren();
                        
                      }
                      
                      // Focus the theory that was searched for
                      var pickedChild = graphView.children[nodeInfo.quickName];
                      infoSet.setValue('focusedNode', pickedChild);
                      
                      // Clear the search term
                      infoSet.setValue('searchTerm', '');
                      
                      return PACK.p.$null;
                      
                    }})
                  ]);
                  
                  return view;
                  
                }
              })
            ]}),
            new uf.ActionView({ name: 'new', cssClasses: [ 'control' ], textInfo: 'New Theory', $action: function() {
              
              var activeNodes = infoSet.getChild('activeNodes');
              var activeNodeObj = activeNodes.getValue();
              var num = 2;
              var prefix = 'newTheory';
              var name = prefix;
              while (name in activeNodeObj) name = prefix + (num++);
              
              activeNodes.addChild(name, makeNodeData({
                username: infoSet.getValue('username'),
                quickName: name,
                editing: true
              }));
              
              var child = graphView.updateChildren().add[name];
              infoSet.setValue('focusedNode', child);
              
              return PACK.p.$null;
              
            }}),
            new uf.ActionView({ name: 'exit', cssClasses: [ 'control' ], textInfo: 'Log Out', $action: function() {
              
              infoSet.setValue('token', '');
              return PACK.p.$null;
              
            }})
          ]})
          
        ]}),
        
      ]}),
      new uf.TextView({ name: 'version', info: infoSet.getChild('appVersion') }),
      new uf.TextView({ name: 'rps', info: function() { return 'update: ' + rootView.updateTimingInfo + 'ms' } })
      
    ]);
    rootView.start();
    
    /* ======= TESTING STUFF ======== */
    
    // Make some stuff accessible on the command line
    window.root = doss;
    window.view = rootView;
    window.info = infoSet;
    
    doss.$doRequest({ command: 'getToken', params: {
      username: 'admin',
      password: 'adminadmin123'
    }}).then(function(data) {
      infoSet.setValue('token', data.token);
    });
    
    infoSet.setValue('username', 'admin');
    infoSet.setValue('password', 'adminadmin123');
    infoSet.setValue('searchTerm', 'zero');
    
  }
});
package.build();
