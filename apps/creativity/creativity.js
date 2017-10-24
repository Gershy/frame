/// {REMOVE=
/*
- Many of the sets in this app only ever increase in size, and never re-index anything.
  - These sets shouldn't be constantly getting requested; instead the size should be
    constantly requested, and when the size changes the entire set can be requested
- Writing devices as ability names (e.g. "hyperbolize" instead of "slam")

 |  HEEERE: When is a doss considered "started"? Even when storySet appears to have loaded
 |  a newly created story, and when storySet.* dosses have contentFuncs, those contentFuncs
 |  still don't run until storySet's contentFunc's 10-second delay has elapsed.
 |  
 |  TODO: Get rid of the latency for stories created client-side!!
 |        (getting rid of latency for all stories is much harder; requires long-polling)
 |  
 |  TODO: Why does simply adding contentFuncs to storySet.* sometimes cause crashes?

TASKS:
[ ] Improved content control
  [ ] `PACK.dossier.ContentSync*` classes should accept any "selection" parameter as either a function or an Info object
  [ ] Extend selection syntax. 
    [ ] skip and limit
    [ ] filtering (`PACK.dossier.FilterResults` needs reimplementation)
[X] Need to allow persisted data to survive openshift restarts
[X] Form validation
  [X] Login
  [X] Story creation/editing
  [ ] Profile editing
[X] Replace `ActionView` with `ActionDecorator`
[X] Zero-latency client side values get overwritten by stale server-side values; remote syncing should pause until remote push is acknowledged
[X] Hitting enter on forms should submit (Need `FormDecorator` and `FormInputDecorator` classes for this, which can probably handle validation too)
[X] Clumsy huge urls with json data; switch to POST requests
[X] Better loading indication
  [X] For login, create form, etc
  [X] For joining rooms
[X] "quickDev" should be renamed "dossier"
[X] Mixins
[ ] Interactive elements try to perform actions using `Content` instances which don't yet exist...
      (Note: this could be an indication of a bigger, underlying design flaw??)
      INTERIM SOLUTION: Manually detect unloaded `Dossier` instances, and disable controls appropriately with `Decorator`s
[ ] Decouple `Editor` from `Dossier`
[ ] The scheduling functionality of `PACK.dossier.ContentAbstractSync` should be implemented separately in a `Scheduler` class
      (and `PACK.dossier.ContentAbstractSync` given a "scheduler" property or something of the sort)
[ ] Need to add lots of `changeHandler` methods for better responsiveness
      (E.g. upon contest completion, the timer resets to "--:--:--" much more quickly than the voting pane is replaced with a writing pane)
[ ] LOTS OF ACTION VALIDATION
  [ ] Voting on an expired contest
  [ ] Submitting writes on an expired story (or is this the same as above?)
  [ ] User account creation
[ ] Is the per-frame loop necessary? Can all changes be processed via `changeHandler`s?
[ ] Compiling for all files
[ ] Mapping by line AND character index will allow better compilation (compact files into a single line)
[ ] Mapping raw file names to compiled files
[ ] Files should be cacheable in development mode! Currently suffixes change and everything is invalidated upon restart
[ ] Profile editing
[ ] Story editing (Change description? Change round time limit?)
[ ] Make sure there are no hard-coded strings in userify or quickdev
*/
/// =REMOVE}
new PACK.pack.Package({ name: 'creativity',
  /// {SERVER=
  dependencies: [ 'dossier', 'p', 'persist' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'dossier', 'p', 'userify' ],
  /// =CLIENT}
  buildFunc: function(/* ... */) {
    
    var packageName = arguments[0];
    /// {SERVER=
    var ds = arguments[1];
    var p = arguments[2];
    var pr = arguments[3];
    /// =SERVER}
    /// {CLIENT=
    var ds = arguments[1];
    var p = arguments[2];
    var uf = arguments[3];
    /// =CLIENT}
    
    var P = p.P;
    
    var mapMillis = (function(r) { return { second: r *= 1000, minute: r *= 60, hour: r *= 60, day: r *= 24, week: r *= 7, year: r *= 52.1429 }; })(1);

    var cr = {
      
      validate: {
        integer: function(name, n, min, max) {
          if (!U.isObj(n, Number) || parseInt(n) !== n) throw new Error(name + ' (' + n + ') is non-integer');
          if (U.exists(min) && n < min) throw new Error(name + ' (' + n + ') is too small');
          if (U.exists(max) && n > max) throw new Error(name + ' (' + n + ') is too large');
          return n;
        },
        intBool: function(name, n, min, max) {
          if (n === null) return null;
          
          if (!U.isObj(n, Number) || parseInt(n) !== n) throw new Error(name + ' (' + n + ') is non-intBool');
          if (U.exists(min) && n < min && n !== 0) throw new Error(name + ' (' + n + ') is too small');
          if (U.exists(max) && n > max && n !== 0) throw new Error(name + ' (' + n + ') is too large');
          
          return n || null;
        },
        string: function(name, str, min, max) {
          if (!U.isObj(str, String)) throw new Error(name + ' is non-string');
          if (U.exists(min) && str.length < min) throw new Error(name + ' is too small');
          if (U.exists(max) && str.length > max) throw new Error(name + ' is too large');
          
          return str;
        },
        boolean: function(name, b) {
          if (!U.isObj(b, Boolean)) throw new Error(name + ' is non-boolean');
          return b;
        }
      },
      
      /// {SERVER=
      resources: {
        css: [
          'apps/userify/style.css',
          'apps/creativity/style.css'
        ]
      },
      /// =SERVER}
      
      Creativity: U.makeClass({ name: 'Creativity',
        superclass: ds.DossierObj,
        methods: function(sc, c) { return {
          /// {SERVER=
          $handleRequest: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (!command.length) throw new Error('Command cannot be empty string');
            
            var funcName = '$handle' + command[0].toUpperCase() + command.substr(1) + 'Query';
            if (this[funcName]) return this[funcName](U.param(params, 'params', {}));
            
            return sc.$handleRequest.call(this, params);
          },
          $handleCurrentTimeQuery: function(params) {
            return new P({ val: U.timeMs() });
          },
          $handleGetTokenQuery: function(params /* username, password */) {
            
            var username = U.param(params, 'username');
            var password = U.param(params, 'password');
            
            var user = this.getChild([ 'userSet', username ]);
            if (!user) throw new Error('Invalid username: "' + username + '"');
            if (user.getValue('password') !== password) throw new Error('Invalid password');
            
            return new P({ val: { token: user.getToken() } });
            
          },
          /*$handleCreateUserQuery: function(params /* username, password * /) {
            
            var username = U.param(params, 'username');
            var password = U.param(params, 'password');
            
            if (username.length < 3 || username.length > 16) throw new Error('Usernames must be 3-16 characters');
            if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(username)) throw new Error('Illegal username');
            
            if (password.length < 5 || password.length > 30) throw new Error('Passwords must be 5-30 characters');
            
            var editor = new ds.Editor();
            return editor.$addFast({ par: this.children.userSet, data: {
              fname: 'Anonymous',
              lname: 'Individual',
              username: username,
              password: password
            }}).then(function(user) {
              return {
                username: user.getValue('username'),
                token: user.getToken()
              };
            });
            
          }*/
          /// =SERVER}
        };}
      }),
      CreativityUser: U.makeClass({ name: 'CreativityUser',
        superclass: ds.DossierObj,
        methods: function(sc, c) { return {
          /// {SERVER=
          validate: function(params) {
            var token = U.param(params, 'token', null);
            if (!token) return false;
            return token === this.getToken();
          },
          getToken: function() {
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
          /// =SERVER}
        };}
      }),
      
      /// {SERVER=
      persister: new pr.Persister({ packageName: packageName, genDefaultData: function() { return require('./state/default.json'); } }),
      $updateCreativity: function(app) {
        
        var time = U.timeMs();
        var storySet = app.children.storySet.children;
        var promises = [];
        
        for (var storyQn in storySet) {
          
          var story = storySet[storyQn];
          promises.push(cr.$updateStory(story, time));
          
        }
        
        return new p.P({ all: promises });
        
      },
      $updateStory: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        var phase = story.getValue('phase');
        var numAuthors = story.getChild('authorSet').length;
        var currentContest = story.getChild([ 'contestSet', story.getValue('contestInd') ]);
        
        if (numAuthors === 0) return p.$null;
        
        if (phase === 'awaitingWrite') {
          
          return p.$null;
          
        } else if (phase === 'writing') {
          
          // Writing ends when time is up, or when the max number of writes have occurred
          
          var phaseEndTime = story.getValue('timePhaseStarted') + story.getValue('contestTime');
          
          var maxVotes = story.getValue('maxVotes') || numAuthors;
          var votes = currentContest.getChild('writeSet').map(function(write) {
            
            var votesForLine = 0;
            var voteSet = write.getChild('voteSet');
            for (var k in voteSet.children) votesForLine += voteSet.getValue([ k, 'value' ]);
            
            return votesForLine;
            
          });
          
          // Build a sortable array while counting total votes...
          var orderedVotes = [];
          var numVotes = 0;
          for (var k in votes) {
            orderedVotes.push(votes[k]);
            numVotes += votes[k];
          }
          orderedVotes.sort(function(a, b) { return b - a; });
          
          var best = orderedVotes.length > 0 ? orderedVotes[0].numVotes : 0;
          var nextBest = 0; // Next best is the next value NOT EQUAL to `best`, or `best` if there are no other lesser values
          if (orderedVotes.length > 1) {
            nextBest = best;
            for (var i = 0; i < orderedVotes.length; i++) {
              if (orderedVotes[i] < best) {
                nextBest = orderedVotes[i];
                break;
              }
            }
          }
          var votesRemaining = numAuthors - numVotes;
            
          if (currentTime > phaseEndTime) {
            
            console.log('RESOLVING ROUND on "' + story.name + '" because time is up');
            return cr.$resolveStoryVotePhase(story);
            
          } else if ((nextBest + votesRemaining) < best) { // Even if some people haven't voted pick a winner; further voting will make no difference
            
            console.log('RESOLVING ROUND on "' + story.name + '" because voters decided early');
            return cr.$resolveStoryVotePhase(story, currentTime);
            
          } else if (votesRemaining === 0) {
            
            console.log('RESOLVING ROUND on "' + story.name + '" because everyone has voted');
            return cr.$resolveStoryVotePhase(story, currentTime);
            
          } else { 
            
            return p.$null;
            
          }
          
        }
        
        throw new Error('Invalid phase: "' + phase + '"');
        
      },
      $resolveStoryVotePhase: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        var editor = new ds.Editor();
        var currentContest = story.getChild([ 'contestSet', story.getValue('contestInd') ]);
        
        if (currentContest.getChild('writeSet').length) {
          
          var writeStandard = 0;
          var bestWrites = [];
          var writes = currentContest.getChild('writeSet').children;
          for (var k in writes) {
            
            var write = writes[k];
            var numVotes = 0;
            
            var votes = write.getChild('voteSet').children;
            for (var kk in votes) numVotes += votes[kk].getValue('value');
            
            if (numVotes === writeStandard) {
              bestWrites.push(write);
            } else if (numVotes > writeStandard) {
              writeStandard = numVotes;
              bestWrites = [ write ]; // Add `write` as the ONLY currently contending option
            }
            
          }
          
          var winningLine = U.randElem(bestWrites); // Decide on a winner amongst the highest-voted
          var nextContestInd = story.getValue('contestInd') + 1;
          editor.$edit({
            
            mod: [
              // Increment the contest index counter
              {
                doss: story,
                data: {
                  contestInd: nextContestInd
                }
              }
            ],
            
            add: [
              // Add on a new empty contest
              {
                par: story.getChild('contestSet'),
                data: {
                  num: nextContestInd,
                  writeSet: {}
                }
              },
              
              // Compile the winning write into the story
              {
                par: story.getChild('writeSet'),
                data: winningLine
              }
            ]
            
          });
          
          var $resolveVotes = editor.$transact();
            
        } else {
          
          var $resolveVotes = p.$null;
          
        }
        
        return $resolveVotes.then(function() {
          
          editor.$mod({ doss: story,
            data: {
              phase: 'awaitingWrite',
              timePhaseStarted: currentTime
            }
          });
          return editor.$transact();
          
        });
        
      },
      
      informWriteSubmitted: function(story) {
        
        if (story.getValue('phase') === 'awaitingWrite') {
          // Kick off writing phase
          story.getChild('phase').setValue('writing');
          story.setValue('timePhaseStarted', U.timeMs());
        }
        
      },
      informVoteSubmitted: function(story) {
        
        cr.$updateStory(story).done();
        
      },
      /// =SERVER}
      
      /// {CLIENT=
      timeComponentData: [
        { text: [ 'second', 'seconds' ], digits: 2, mult: mapMillis.second, div: 1 / mapMillis.second },
        { text: [ 'minute', 'minutes' ], digits: 2, mult: mapMillis.minute, div: 1 / mapMillis.minute },
        { text: [ 'hour',   'hours'   ], digits: 2, mult: mapMillis.hour,   div: 1 / mapMillis.hour },
        { text: [ 'day',    'days'    ], digits: 2, mult: mapMillis.day,    div: 1 / mapMillis.day },
        { text: [ 'week',   'weeks'   ], digits: 2, mult: mapMillis.week,   div: 1 / mapMillis.week },
        { text: [ 'year',   'years'   ], digits: 4, mult: mapMillis.year,   div: 1 / mapMillis.year }
      ],
      ClockView: U.makeClass({ name: 'ClockView',
        superclass: uf.View,
        methods: function(sc, c) { return {
          init: function(params /* name, info, format, components */) {
            sc.init.call(this, params);
            this.info = uf.pafam(params, 'info');
            this.format = U.param(params, 'format', 'string'); // 'string' | 'digital'
            this.components = U.param(params, 'components', cr.timeComponentData);
          },
          
          createDomRoot: function() {
            var ret = document.createElement('div');
            ret.classList.add('clock');
            ret.classList.add('format-' + this.format);
          
            for (var i = 0, len = this.components.length; i < len; i++) {
              var compData = this.components[len - i - 1];
              
              var comp = document.createElement('div');
              comp.classList.add('component');
              comp.classList.add(compData.text[0]);
              
              var compName = document.createElement('div');
              if (this.format === 'digital') uf.domSetText(compName, compData.text[1]);
              compName.classList.add('name');
              
              var compVal = document.createElement('div');
              compVal.classList.add('value');
              
              comp.appendChild(compVal);
              comp.appendChild(compName);
              
              ret.appendChild(comp);
              
              if (i < len - 1) {
                var sep = document.createElement('div');
                sep.classList.add('separator');
                ret.appendChild(sep);
              }
              
            }
          
            return ret;
          },
          tick: function(millis) {
            
            var time = this.info.getValue();
            
            if (time === Number.MAX_SAFE_INTEGER) {
              
              if (this.format === 'string')
                for (var i = 0, len = this.components.length; i < len; i++) {
                  var compData = this.components[len - i - 1];
                  var comp = this.domRoot.childNodes[i * 2];
                  uf.domSetText(comp.childNodes[0], 'unlimited');
                  uf.domSetText(comp.childNodes[1], compData.text[1]);
                }
              else if (this.format === 'digital')
                for (var i = 0, len = this.components.length; i < len; i++) {
                  var compData = this.components[len - i - 1];
                  uf.domSetText(this.domRoot.childNodes[i * 2].childNodes[0], '-'.fill(compData.digits));
                }
              
              return;
              
            }
            
            if (this.format === 'string') {
              
              var gotOne = false;
              for (var i = 0, len = this.components.length; i < len; i++) {
                var compData = this.components[len - i - 1];
                var comp = this.domRoot.childNodes[i * 2];
                var sep = comp.nextElementSibling;
                
                var val = Math.floor(time / compData.mult); // More efficient to multiply by `compData.div`, but that gives awkward floating point errors :(
                time -= val * compData.mult;
                
                if (gotOne || val || i === len - 1) {
                  comp.classList.remove('empty');
                  if (sep) sep.classList.remove('empty');
                  gotOne = true;
                } else {
                  comp.classList.add('empty');
                  if (sep) sep.classList.add('empty');
                }
                
                uf.domSetText(comp.childNodes[1], compData.text[val === 1 ? 0 : 1]);
                uf.domSetText(comp.childNodes[0], val.toString());
              }
              
            } else if (this.format === 'digital') {
              
              for (var i = 0, len = this.components.length; i < len; i++) {
                var compData = this.components[len - i - 1];
                
                var val = Math.floor(time / compData.mult);
                
                time -= val * compData.mult;
                
                val = val.toString();
                while (val.length < compData.digits) val = '0' + val;
                
                uf.domSetText(this.domRoot.childNodes[i * 2].childNodes[0], val);
              }
              
            }
            
          }
        };}
      }),
      ClockEditView: U.makeClass({ name: 'ClockEditView',
        superclassName: 'ClockView',
        methods: function(sc, c) { return {
          init: function(params /* name, info, format, components, min, max */) {
            sc.init.call(this, params);
            this.min = U.param(params, 'min', null);
            this.max = U.param(params, 'max', null);
          },
          createDomRoot: function() {
            var ret = sc.createDomRoot.call(this);
            ret.classList.add('interactive');
            
            for (var i = 0, len = this.components.length; i < len; i++) {
              var compData = this.components[len - i - 1];
              var comp = ret.childNodes[i * 2]; // Multiply by 2 to skip ".separator" elements
              
              var add = document.createElement('div');
              add.classList.add('control', 'add', compData.text[0]);
              add.onclick = c.addClick.bind(null, this.info, compData.mult, this.min, this.max);
              
              var sub = document.createElement('div');
              sub.classList.add('control', 'sub', compData.text[0]);
              sub.onclick = c.addClick.bind(null, this.info, -compData.mult, this.min, this.max);
              
              comp.appendChild(add);
              comp.appendChild(sub);
            }
            
            return ret;
          }
        };},
        statik: {
          // Click handler for adding/reducing time
          addClick: function(info, amount, min, max) {
            info.modValue(function(v) {
              v += amount;
              if (min !== null && v < min) return min;
              if (max !== null && v > max) return max;
              return v;
            });
          }
        }
      }),
      updateOnFrame: {}, // Keep track of all `Content` instances which need to update once per frame
      /// =CLIENT}
      
    };
    
    var outline = new ds.Outline({ name: 'app', c: cr.Creativity, i: {
      
      version:        { c: ds.DossierStr, p: {
        abilities: ds.abilities.val.pick([ '$getData' ]),
        /// {CLIENT=
        contentFunc: function(doss) {
          return new ds.ContentSync({ doss: doss, syncOnStart: true });
        }
        /// =CLIENT}
      }},
      /// {CLIENT=
      username:       { c: ds.DossierStr, p: {
      }},
      password:       { c: ds.DossierStr, p: {
      }},
      token:          { c: ds.DossierStr, p: {
        changeHandler: function(doss) {
          doss.getRoot().getChild('user').content.update();
        }
      }},
      user:           { c: ds.DossierRef, p: { template: '~root.userSet.$username',
        contentFunc: function(doss) {
          return new ds.ContentSyncRef({ doss: doss, syncOnStart: true,
            calcRef: function() {
              // Set reference to null unless a token is obtained
              return doss.getChild('~root.token').value ? [ doss.getChild('~root.username').value ] : null;
            },
            
            // TODO: This could be generated by a client-side `Dossier.prototype.getFullSelection` method?
            // Which could also be the default for the "selection" parameter
            selection: ds.selectAll
          });
        }
      }},
      loginError:     { c: ds.DossierStr, p: {
      }},
      currentWrite:   { c: ds.DossierStr, p: {
      }},
      currentStory:   { c: ds.DossierRef, p: { template: '~root.storySet.$quickName',
        contentFunc: function(doss) {
          return new ds.ContentSyncRef({ doss: doss, syncOnStart: true });
        }
      }},
      isEditingStory: { c: ds.DossierBln, p: {
        value: false
      }},
      editStory:      { c: ds.DossierObj, i: {
        error:          { c: ds.DossierStr, p: {
        }},
        story:          { c: ds.DossierRef, p: { template: '~root.storySet.$quickName'
        }},
        quickName:      { c: ds.DossierStr, p: {
        }},
        description:    { c: ds.DossierStr, p: {
        }},
        authorLimit:    { c: ds.DossierStr, p: {
        }},
        maxWrites:      { c: ds.DossierStr, p: {
        }},
        maxVotes:       { c: ds.DossierStr, p: {
        }},
        maxWriteLength: { c: ds.DossierStr, p: {
        }},
        contestLimit:   { c: ds.DossierStr, p: {
        }},
        contestTime:    { c: ds.DossierInt, p: {
        }},
        slapLoadTime:   { c: ds.DossierStr, p: {
        }},
        slamLoadTime:   { c: ds.DossierStr, p: {
        }},
        anonymizeWriter:{ c: ds.DossierBln, p: {
        }},
        anonymizeVoter: { c: ds.DossierBln, p: {
        }}
      }},
      /// =CLIENT}
      userSet:        { c: ds.DossierArr, p: {
        /// {CLIENT=
        contentFunc: function(doss) {
          return new ds.ContentSyncSet({ doss: doss, syncOnStart: false, selection: ds.selectAll })
        },
        /// =CLIENT}
        abilities: ds.abilities.set.clone({
          /// {SERVER=
          $addData: function(userSet, params) {
            // TODO: It takes a lot of knowledge of `Dossier`'s internals to do this :(
            var token = null;
            return ds.abilities.set.$addData(userSet, params.update({
              prepareForMod: function(user, params) {
                token = user.getToken();
                return params.update({ token: token });
              }
            })).then(function(result) {
              return result.update({ token: token });
            });
          }
          /// =SERVER}
        }),
        innerOutline:   { name: 'user', c: cr.CreativityUser,
          p: {
            abilities: {
              $getData: ds.abilities.set.$getData,
              $modData: function(user, params) {
                /// {SERVER=
                if (!user.validate(params)) throw new Error('Couldn\'t authenticate');
                /// =SERVER}
                return ds.abilities.setDirect.$modData(user, params);
              }
            }
          },
          i: {
            username:       { c: ds.DossierStr, p: {
              abilities: ds.abilities.val.pick([ '$getData' ])
            }},
            password:       { c: ds.DossierStr, p: {
              abilities: {} // No abilities allowed on password
            }},
            fname:          { c: ds.DossierStr, p: {
              abilities: ds.abilities.val.pick([ '$getData' ])
            }},
            lname:          { c: ds.DossierStr, p: {
              abilities: ds.abilities.val.pick([ '$getData' ])
            }}
          }
        },
        nameFunc: function(par, child) { return child.getValue('username'); }
      }},
      storySet:       { c: ds.DossierArr, p: {
        /// {CLIENT=
        contentFunc: function(doss) {
          // TODO: "selection" should become either a function or an Info object; the selection here should be paged
          return new ds.ContentSyncSet({ doss: doss, waitMs: 10000, syncOnStart: true, selection: {
            '*': {
              user: {},
              createdTime: {},
              quickName: {},
              description: {},
              contestInd: {},
              contestLimit: {},
              phase: {},
              timePhaseStarted: {},
              contestTime: {}
            }
          }});
        },
        /// =CLIENT}
        abilities: ds.abilities.set.clone({
          $addData: function(storySet, params) {
            params.data.update({
              contestSet: {
                0: {
                  num: 0,
                  writeSet: {}
                }
              }
            });
            /// {CLIENT=
            return ds.abilities.set.$addData(storySet, params);
            /// =CLIENT}
            /// {SERVER=
            return ds.abilities.set.$addData(storySet, params.update({
              prepareForMod: function(story, params) {
                return params.update({ token: story.getChild('@user').getToken() });
              }
            }));
            /// =SERVER}
          }
        }),
        innerOutline:   { name: 'story', c: ds.DossierObj,
          p: {
            /// {CLIENT=
            contentFunc: function(doss) {
              return new ds.ContentSyncSet({ doss: doss, syncOnStart: true, selection: ds.selectAll });
            },
            /// =CLIENT}
            abilities: {
              $getData: ds.abilities.set.$getData,
              $modData: function(story, params) {
                /// {SERVER=
                if (!story.getChild('@user').validate(params)) throw new Error('Couldn\'t authenticate');
                /// =SERVER}
                return ds.abilities.setDirect.$modData(story, params);
              }
            }
          },
          i: {
            user:           { c: ds.DossierRef, p: { template: '~root.userSet.$username',
              abilities: ds.abilities.ref,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSyncRef({ doss: doss, syncOnStart: true });
              }
              /// =CLIENT}
            }},
            /// {CLIENT=
            isAuthored:     { c: ds.DossierBln, p: {
              contentFunc: function(doss) {
                var story = doss.par;
                return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                  var username = doss.getRoot().getValue('username');
                 // var story = doss.par;
                  return story.children.authorSet.children.contains(username);
                }});
              }
            }},
            userDisp:       { c: ds.DossierStr, p: {
              contentFunc: function(doss) {
                return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                  var user = doss.par.getChild('@user');
                  return user
                    ? user.getValue('fname') + ' ' + user.getValue('lname') + ' (' + user.getValue('username') + ')'
                    : '- loading -';
                }});
              }
            }},
            age:            { c: ds.DossierInt, p: {
              contentFunc: function(doss) {
                return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                  return U.timeMs() - doss.par.getValue('createdTime');
                }});
              }
            }},
            phaseTimeRemaining: { c: ds.DossierInt, p: {
              contentFunc: function(doss) {
                return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                  
                  var story = doss.par;
                  var phase = story.getValue('phase');
                  
                  if (phase === 'writing') {
                    
                    return story.getValue('timePhaseStarted') + story.getValue('contestTime') - U.timeMs();
                    
                  } else {
                    
                    return Number.MAX_SAFE_INTEGER;
                    
                  }
                    
                }});
              }
            }},
            currentContest: { c: ds.DossierRef, p: { template: '~par.contestSet.$contestInd',
              contentFunc: function(doss) {
                return new ds.ContentSyncRef({ doss: doss, syncOnStart: true, calcRef: function() {
                  return [ doss.par.getValue('contestInd') ]; // The current contest's index is stored in `contestInd`
                }});
              }
            }},
            /// =CLIENT}
            anonymizeWriter: { c: ds.DossierBln, p: {
              abilities: ds.abilities.val
            }},
            anonymizeVoter: { c: ds.DossierBln, p: {
              abilities: ds.abilities.val
            }},
            createdTime:    { c: ds.DossierInt, p: {
              abilities: ds.abilities.val
            }},
            quickName:      { c: ds.DossierStr, p: {
              abilities: ds.abilities.val
            }},
            description:    { c: ds.DossierStr, p: {
              abilities: ds.abilities.val
            }},
            contestInd:     { c: ds.DossierInt, p: {    // Index of current contest
              abilities: ds.abilities.val,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSync({ doss: doss, waitMs: 1000 });
              },
              changeHandler: function(doss) {
                var story = doss.par;
                story.getChild('currentContest').content.update();
                story.getChild('writeSet').content.update();
                story.getChild('phase').content.update();
                story.getChild('timePhaseStarted').content.update();
              }
              /// =CLIENT}
            }},
            authorLimit:    { c: ds.DossierInt, p: {    // Max number of users writing this story
              abilities: ds.abilities.val
            }},
            contestTime:    { c: ds.DossierInt, p: {    // Contest time limit
              abilities: ds.abilities.val
            }},
            maxWrites:      { c: ds.DossierInt, p: {    // Number of writes allowed per contest
              abilities: ds.abilities.val
            }},
            maxVotes:       { c: ds.DossierInt, p: {    // Number of votes allowed per contest
              abilities: ds.abilities.val
            }},
            maxWriteLength: { c: ds.DossierInt, p: {    // Number of characters allowed in an entry
              abilities: ds.abilities.val
            }},
            contestLimit:   { c: ds.DossierInt, p: {    // Total number of contests before the story concludes
              abilities: ds.abilities.val
            }},
            slapLoadTime:   { c: ds.DossierInt, p: {    // Total millis to load a new slap ability
            }},
            slamLoadTime:   { c: ds.DossierInt, p: {    // Total millis to load a new slam ability'
            }},
            phase:          { c: ds.DossierStr, p: {    // The phase: awaitingWrite | writing
              abilities: ds.abilities.val,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSync({ doss: doss, waitMs: 2000 });
              }
              /// =CLIENT}
            }},
            timePhaseStarted: { c: ds.DossierInt, p: {  // The time the phase started at
              abilities: ds.abilities.val,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSync({ doss: doss, waitMs: 2000 });
              }
              /// =CLIENT}
            }},

            authorSet:      { c: ds.DossierArr, p: {
              abilities: ds.abilities.set,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSyncSet({ doss: doss, waitMs: 10000, syncOnStart: true, selection: ds.selectAll });
              },
              /// =CLIENT}
              innerOutline:   { name: 'author', c: ds.DossierObj,
                p: {
                  abilities: ds.abilities.set
                },
                i: {
                  user:         { c: ds.DossierRef, p: { template: '~root.userSet.$username', // TODO: For some reason this was `DossierStr`; need to test creating users
                    /// {CLIENT=
                    contentFunc: function(doss) {
                      return new ds.ContentSyncRef({ doss: doss, syncOnStart: true, selection: ds.selectAll });
                    }
                    /// =CLIENT}
                  }},
                  numSlaps:     { c: ds.DossierInt, p: {
                  }},
                  lastSlapTime: { c: ds.DossierInt, p: {
                  }},
                  numSlams:     { c: ds.DossierInt, p: {
                  }},
                  lastSlamTime: { c: ds.DossierInt, p: {
                  }}
                }
              },
              nameFunc: function(par, child) { return child.getChild('@user').name; },
              // TODO: Users are being handled differently server/client-side; client is trying to get away with using usernames without ever loading user `Dossier`
              // The only reason this verifyAndSanitizeData works on both sides is because it's only concerned with the current user (who is essentially guaranteed to exist)
              verifyAndSanitizeData: function(authorSet, params) {
                
                var username = U.param(params, 'username');
                
                var preexisting = authorSet.getChild(username);
                if (preexisting) throw new Error('User "' + username + '" is already an author');
                
                var user = authorSet.getChild([ '~root', 'userSet', username ]);
                if (!user) throw new Error('Invalid username: "' + username + '"');
                
                var currentTime = U.timeMs();
                
                return {
                  user: user,
                  numSlaps: 0,
                  lastSlapTime: currentTime,
                  numSlams: 0,
                  lastSlamTime: currentTime
                };
                
              }
            
            }},
            
            contestSet:     { c: ds.DossierArr, p: {
              abilities: ds.abilities.set,
              innerOutline:   { name: 'contest', c: ds.DossierObj,
                p: {
                  abilities: ds.abilities.set
                },
                i: {
                  num:            { c: ds.DossierInt, p: {
                    abilities: ds.abilities.val
                  }},
                  writeSet:       { c: ds.DossierArr, p: {
                    /// {SERVER=
                    // Server-side, submitting a write must inform the app that such a thing has happened
                    // TODO: This can likely be made cleaner with concerns!!
                    abilities: ds.abilities.set.clone({
                      $addData: function(doss, params) {
                        return ds.abilities.set.$addData(doss, params).then(function() {
                          // Reference: story.contestSet.contest.writeSet -> story
                          cr.informWriteSubmitted(doss.par.par.par);
                        });
                      }
                    }),
                    /// =SERVER}
                    /// {CLIENT=
                    abilities: ds.abilities.set,
                    contentFunc: function(doss) {
                      return new ds.ContentSyncSet({ doss: doss, waitMs: 2000, syncOnStart: true, selection: ds.selectAll });
                    },
                    /// =CLIENT}
                    innerOutline: { name: 'write', c: ds.DossierObj,
                      p: {
                        abilities: ds.abilities.set
                      },
                      i: {
                        user:         { c: ds.DossierRef, p: { template: '~root.userSet.$username',
                          abilities: ds.abilities.ref
                        }},
                        content:      { c: ds.DossierStr, p: {
                          abilities: ds.abilities.val
                        }},
                        voteSet:      { c: ds.DossierArr, p: {
                          abilities: ds.abilities.set,
                          /// {CLIENT=
                          contentFunc: function(doss) {
                            return new ds.ContentSyncSet({ doss: doss, waitMs: 2000, syncOnStart: true, selection: ds.selectAll });
                          },
                          /// =CLIENT}
                          innerOutline: { name: 'vote', c: ds.DossierObj,
                            p: {
                              abilities: ds.abilities.set
                            },
                            i: {
                              user:         { c: ds.DossierRef, p: { template: '~root.userSet.$username',
                                abilities: ds.abilities.ref
                              }},
                              value:        { c: ds.DossierInt, p: {
                                abilities: ds.abilities.val
                              }}
                            }
                          },
                          nameFunc: function(par, vote) {
                            return vote.getChild('user').value[0]; // The 1st address item is the username
                            //console.log('USER FROM', vote);
                            //return vote.getChild('@user').name;
                          },
                          verifyAndSanitizeData: function(voteSet, params) {
                            var username = U.param(params, 'username');
                            var value = 1; // U.param(params, 'value');
                            
                            /// {SERVER=
                            // Oh boy that's a lot of parents... moving from:
                            //  src - storySet, story, contestSet, contest, writeSet, write, voteSet
                            //  trg - storySet, story
                            var author = voteSet.getChild([ '~par', '~par', '~par', '~par', '~par', 'authorSet', username ]);
                            if (!author) throw new Error('Story doesn\'t have author "' + username + '"');
                            var user = author.getChild('@user');
                            cr.informVoteSubmitted(author.par.par);
                            /// =SERVER}
                            
                            /// {CLIENT=
                            var user = voteSet.getChild([ '~root', 'userSet', username ]);
                            if (!user) throw new Error('Can\'t find user "' + username + '"');
                            /// =CLIENT}
                            
                            return {
                              user: user,
                              value: value
                            };
                            
                          }
                        }}
                      }
                    },
                    nameFunc: function(par, write) {
                      // TODO: Can this be unified?
                      return write.getChild('user').value[0];
                    },
                  }},
                  /// {CLIENT=
                  currentWrite:   { c: ds.DossierRef, p: { template: '~par.writeSet.$username',
                    contentFunc: function(doss) {
                      return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                        // Return `null` if no current write, otherwise return the write
                        var username = doss.getChild('~root.username').value;
                        
                        if (!username) return null;
                        return doss.par.children.writeSet.children[username] || null;
                        
                        return username ? doss.getChild([ '~par', 'writeSet', username ]) : null;
                      }});
                    }
                  }},
                  currentVote:    { c: ds.DossierRef, p: { template: '~par.writeSet.$username.voteSet.$username',
                    contentFunc: function(doss) {
                      return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                        var username = doss.getChild('~root.username').value;
                        var contest = doss.par;
                        var writeSet = contest.children.writeSet.children;
                        
                        for (var k in writeSet) {
                          var voteSet = writeSet[k].children.voteSet.children;
                          for (var kk in voteSet) {
                            if (kk === username) return voteSet[kk];
                          }
                        }
                        
                        return null;
                      }});
                    },
                    changeHandler: function(currentVote) {
                      // Changing the current vote also changes the current voted write
                      var vote = currentVote.dereference();
                      var currentVotedWrite = currentVote.getChild('~par.currentVotedWrite');
                      currentVotedWrite.setValue(vote ? vote.par.par : null);
                    }
                  }},
                  currentVotedWrite: { c: ds.DossierRef, p: { template: '~par.writeSet.$username'
                  }}
                  /// =CLIENT}
                }
              },
              nameFunc: function(par, child) { return child.getValue('num'); }
            }},
            
            writeSet:       { c: ds.DossierArr, p: {
              abilities: ds.abilities.set,
              /// {CLIENT=
              contentFunc: function(doss) {
                return new ds.ContentSyncSet({ doss: doss, waitMs: 2000, syncOnStart: true, selection: ds.selectAll });
              },
              /// =CLIENT}
              innerOutline: { name: 'writeSet', c: ds.DossierRef, p: { template: '~par.~par.contestSet.$contestInd.writeSet.$username',
                /// {CLIENT=
                contentFunc: function(doss) {
                  return new ds.ContentSyncRef({ doss: doss, syncOnStart: true, selection: ds.selectAll });
                }
                /// =CLIENT}
              }}
            }}
            
          }
        },
        nameFunc: function(par, child) { return child.getValue('quickName'); },
        verifyAndSanitizeData: function(child, params) {
          
          var username = U.param(params, 'username');
          var user = child.getChild([ '~root', 'userSet', username ]);
          if (!user) throw new Error('Bad username: "' + username + '"');
          
          var currentTime = U.timeMs();
          
          return {
            user: user,
            createdTime: currentTime,
            quickName: cr.validate.string('quickName', U.param(params, 'quickName'), 3, 16),
            description: cr.validate.string('description', U.param(params, 'description'), 10, 250),
            contestInd: 0,
            authorLimit: cr.validate.intBool('authorLimit', U.param(params, 'authorLimit'), 3),
            contestTime: cr.validate.integer('contestTime', U.param(params, 'contestTime'), 1000 * 60 * 3),
            maxWrites: cr.validate.intBool('maxWrites', U.param(params, 'maxWrites'), 3),
            maxVotes: cr.validate.intBool('maxVotes', U.param(params, 'maxVotes'), 3),
            maxWriteLength: cr.validate.integer('maxWriteLength', U.param(params, 'maxWriteLength'), 3, 1000),
            contestLimit: cr.validate.integer('contestLimit', U.param(params, 'contestLimit'), 3),
            slapLoadTime: U.param(params, 'slapLoadTime', 1000 * 60 * 60 * 100),
            slamLoadTime: U.param(params, 'slamLoadTime', 1000 * 60 * 60 * 100),
            phase: 'awaitingWrite',
            timePhaseStarted: currentTime,
            
            // TODO: How to add these next 2 in, using migrations????
            anonymizeWriter: cr.validate.boolean('anonymizeWriter', U.param(params, 'anonymizeWriter')), 
            anonymizeVoter: cr.validate.boolean('anonymizeVoter', U.param(params, 'anonymizeVoter')),
            
            authorSet: {
              0: {
                user: user,
                numSlaps: 0,
                lastSlapTime: currentTime,
                numSlams: 0,
                lastSlamTime: currentTime
              }
            },
            contestSet: {
              0: {
                num: 0,
                writeSet: {
                }
              }
            },
            writeSet: {
            }
          };
          
        }
      }}
      
    }});
    
    var versioner = new ds.Versioner({ versions: [
      { name: 'initial',
        detect: function(prevVal) { return true; },
        $apply: function(prevVal) {
          
          return new P({ all: {
            outline: outline,
            /// {SERVER=
            // TODO: Not saving data!!! Need to uncomment this
            // data: cr.persister.$init().then(function() { return cr.persister.$getData(); }),
            data: cr.persister.$init().then(function() { return cr.persister.genDefaultData(); }),
            /// =SERVER}
            /// {CLIENT=
            data: new P({ val: { version: 'Loading...' } }),
            /// =CLIENT}
            doss: null
          }});
          
        }
      },
      
      /// {SERVER=
      { name: 'data 0.0.1 -> 0.0.2',
        detect: function(prevVal) { return prevVal.data.version.split(' ')[0] === '0.0.1'; },
        $apply: function(prevVal) {
          prevVal.data.version = '0.0.2 (anonymity)';
          
          // On this version, all pre-existing stories are initially anonymized (even though the default values are normally `false`)
          var storySet = prevVal.data.storySet;
          for (var qn in storySet) {
            storySet[qn].anonymizeWriter = true;
            storySet[qn].anonymizeVoter = true;
          }
          
          return new P({ val: prevVal });
        }
      },
      /*{ name: 'data 0.0.2 -> 0.0.3',
        detect: function(prevVal) { return prevVal.data.version.split(' ')[0] === '0.0.2'; },
        $apply: function(prevVal) {
          prevVal.data.version = '0.0.3 (edits)';
          return new P({ val: prevVal });
        }
      },*/
      /// =SERVER}
      
      { name: 'generate doss',
        detect: function(prevVal) { return true; },
        $apply: function(prevVal) {
          return prevVal.outline.$getDoss(prevVal.data);
        }
      }
    ]});
    
    cr.$doss = versioner.$getDoss();
    
    return cr;
    
  },
  runAfter: function(cr, ds, p, uf) {
    
    var P = p.P;
    
    console.log('Initializing doss...');
    cr.$doss.then(function(doss) {
      
      console.log('Success!');
      
      /// {SERVER=
      cr.queryHandler = doss;
      
      // TODO: Use a single timeout+inform-on-vote instead of this ugly interval loop?
      setInterval(function() { cr.$updateCreativity(doss).done(); }, 1 * 1000);
      setInterval(function() { cr.persister.$putData(doss.getData()).done(); }, 10 * 1000);
      /// =SERVER}
      
      /// {CLIENT=
      
      var spinnerHtml =
        '<div class="spin">' +
          U.range({0:20}).map(function(n) {
            var deg = Math.round((n / 20) * 360);
            var del = Math.round((n / 20) * 15000); // 12000
            return '<div class="arm" style="transform: rotate(' + deg + 'deg); animation-delay: -' + del + 'ms;"></div>';
          }).join('') +
        '</div>';
      
      var view = new uf.RootView({ name: 'root',
        children: [
          
          new uf.ChoiceView({ name: 'login', choiceInfo: function () { return doss.getValue('~root.token') ? 'in' : 'out' }, transitionTime: 500, children: [
            
            // The user is logged out
            new uf.SetView({ name: 'out', cssClasses: [ 'choiceTransition' ], children: [
              
              /*
              Piece Together
              Dark and Stormy Write
              Collabowrite
              Once Upon a Mind
              WordMixer
              Storyteller
              */
              new uf.SetView({ name: 'loginForm', cssId: 'loginForm', cssClasses: [ 'form' ], children: [
                new uf.TextHideView({ name: 'error', info: doss.getChild('loginError') }),
                new uf.TextView({ name: 'title', info: 'Creativity' }),
                new uf.SetView({ name: 'username', cssClasses: [ 'formItem' ], children: [
                  new uf.TextEditView({ name: 'input', cssClasses: [ 'centered' ], info: doss.getChild('username'), placeholderInfo: 'Username' })
                ]}),
                new uf.SetView({ name: 'password', cssClasses: [ 'formItem' ], children: [
                  new uf.TextEditView({ name: 'input', cssClasses: [ 'centered' ], info: doss.getChild('password'), placeholderInfo: 'Password' })
                ]}),
                new uf.TextView({ name: 'signin', info: 'Login', cssClasses: [ 'interactive', 'button' ] }),
                new uf.TextView({ name: 'signup', info: 'Signup', cssClasses: [ 'interactive', 'button' ] }),           
                new uf.HtmlView({ name: 'decoration', cssClasses: [ 'spinner', 'spinner1' ], html: spinnerHtml })
              ]})
              
            ]}),
            
            // The user is logged in
            new uf.SetView({ name: 'in', cssClasses: [ 'choiceTransition' ], children: [
              
              new uf.ChoiceView({ name: 'chooseStory',
                choiceInfo: function() {
                  if (doss.getChild('@currentStory'))       return 'story';
                  else if (doss.getValue('isEditingStory')) return 'createStory';
                  else                                      return 'lobby';
                },
                transitionTime: 500,
                children: [
                  
                  // The user is selecting which story to enter
                  new uf.SetView({ name: 'lobby', cssId: 'lobby', cssClasses: [ 'choiceTransition', 'titledContent' ], children: [
                    
                    new uf.TextView({ name: 'title', info: 'Lobby' }),
                    new uf.View({ name: 'back', cssClasses: [ 'interactive', 'button', 'iconButton', 'mainButton', 'left', 'type-larrow' ], decorators: [
                      new uf.ActionDecorator({ $action: function() {
                        doss.setValue('username', '');
                        doss.setValue('password', '');
                        doss.setValue('token', '');
                        return p.$null;
                      }})
                    ]}),
                    new uf.View({ name: 'createStory', cssClasses: [ 'interactive', 'button', 'iconButton', 'mainButton', 'right', 'type-plus' ], decorators: [
                      new uf.ActionDecorator({ $action: function() {
                        doss.getChild('editStory').setValue({
                          story: null,
                          quickName: '',
                          description: '',
                          authorLimit: '',
                          maxWrites: '',
                          maxVotes: '',
                          maxWriteLength: '',
                          contestTime: 1000 * 60 * 60 * 12,
                          contestLimit: '',
                          slapLoadTime: 1000 * 60 * 60 * 100,
                          slamLoadTime: 1000 * 60 * 60 * 100,
                          anonymizeWriter: false,
                          anonymizeVoter: false
                        });
                        doss.setValue('isEditingStory', true);
                        return p.$null;
                      }})
                    ]}),
                    new uf.DynamicSetView({ name: 'content', cssId: 'storySet',
                      childInfo: doss.getChild('storySet'),
                      genChildView: function(name, info) {
                        
                        return new uf.SetView({ name: name, cssClasses: [ 'story' ], children: [
                          
                          new uf.TextView({ name: 'quickName', info: info.getChild('quickName') }),
                          new uf.TextView({ name: 'description', info: info.getChild('description') }),
                          new uf.TextView({ name: 'user', info: info.getChild('userDisp') }),
                          new uf.SetView({ name: 'age', children: [
                            new uf.TextView({ name: 'part0', info: 'Begun' }),
                            new cr.ClockView({ name: 'part1',
                              info: info.getChild('age'),
                              format: 'string',
                              components: cr.timeComponentData.slice(1)
                            }),
                            new uf.TextView({ name: 'part2', info: 'ago' })
                          ]}),
                          // TODO: "isAuthored" has nothing to do with loading indication.
                          // Loading indication is based on whether `info.getChild('authorSet').content` exists
                          new uf.ChoiceView({ name: 'authored', choiceInfo: info.getChild('isAuthored'), children: [
                            
                            new uf.HtmlView({ name: 'false', cssClasses: [ 'interactive', 'button', 'spinner', 'spinner3' ], html: spinnerHtml, decorators: [
                              new uf.ClassDecorator({
                                list: [ 'loading' ],
                                info: function() {
                                  var authorSet = info.getChild('authorSet');
                                  return (!authorSet || !authorSet.content) ? 'loading' : null;
                                }
                              }),
                              new uf.ActionDecorator({ $action: function() {
                                
                                return info.getChild('authorSet').content.$addChild({
                                  data: {
                                    username: doss.getValue('username')
                                  }
                                }).then(function(result) {
                                  doss.setValue('currentStory', info);
                                });
                                
                              }})
                            ]}),
                            
                            new uf.View({ name: 'true', cssClasses: [ 'interactive', 'button' ], decorators: [
                              new uf.ActionDecorator({ $action: function() {
                                
                                doss.setValue('currentStory', info);
                                return p.$null;
                                
                              }})
                            ]})
                            
                          ]})
                          
                        ]});
                        
                      }
                    })
                  
                  ]}),
                  
                  // The user is editing a new story
                  new uf.SetView({ name: 'createStory', cssClasses: [ 'choiceTransition', 'titledContent' ], children: [
                    
                    new uf.TextView({ name: 'title', info: 'Create' }),
                    new uf.View({ name: 'back', cssClasses: [ 'interactive', 'button', 'iconButton', 'mainButton', 'left', 'type-larrow' ], decorators: [
                      new uf.ActionDecorator({ $action: function() {
                        doss.setValue('isEditingStory', false);
                        return p.$null;
                      }})
                    ]}),
                    new uf.SetView({ name: 'content', cssId: 'storyForm', cssClasses: [ 'form' ], children: [
                      new uf.TextHideView({ name: 'error', info: doss.getChild('editStory.error') }),
                      new uf.SetView({ name: 'quickName', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Quick Name' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.quickName'), placeholderInfo: 'A simple, unique, permanent label' }),
                      ]}),
                      new uf.SetView({ name: 'description', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Description' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.description'), placeholderInfo: 'What sort of feel should this story have?', multiline: true }),
                      ]}),
                      new uf.SetView({ name: 'maxWriteLength', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Submission character limit' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.maxWriteLength'), placeholderInfo: 'Limit how long a submission can be' }),
                      ]}),
                      new uf.SetView({ name: 'contestTime', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Round time limit' }),
                        new cr.ClockEditView({ name: 'input', info: doss.getChild('editStory.contestTime'), format: 'string', components: cr.timeComponentData.slice(0, 3), min: 3 * 60 * 1000 })
                      ]}),
                      new uf.SetView({ name: 'contestLimit', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Total number of rounds' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.contestLimit'), placeholderInfo: 'The story is complete after this limit is met' }),
                      ]}),
                      new uf.SetView({ name: 'authorLimit', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Max authors' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.authorLimit'), placeholderInfo: 'Limit the number of users who can participate' })
                      ]}),
                      new uf.SetView({ name: 'maxWrites', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Max round submissions' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.maxWrites'), placeholderInfo: 'Limit the number of submissions each round' })
                      ]}),
                      new uf.SetView({ name: 'maxVotes', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Max round votes' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.maxVotes'), placeholderInfo: 'Limit the number of votes per round' }),
                      ]}),
                      new uf.SetView({ name: 'anonymizeWriter', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Anonymize submission authors' }),
                        new uf.View({ name: 'input', cssClasses: [ 'interactive', 'button', 'toggleButton' ], decorators: [
                          
                          new uf.ClassDecorator({ list: [ 'true', 'false' ], info: doss.getChild('editStory.anonymizeWriter') }),
                          new uf.ActionDecorator({ $action: function() {
                            doss.getChild('editStory.anonymizeWriter').modValue(function(val) { return !val; });
                            return p.$null;
                          }})
                          
                        ]})
                      ]}),
                      new uf.SetView({ name: 'anonymizeVoter', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'name', info: 'Anonymize votes' }),
                        new uf.View({ name: 'input', cssClasses: [ 'interactive', 'button', 'toggleButton' ], decorators: [
                          
                          new uf.ClassDecorator({ list: [ 'true', 'false' ], info: doss.getChild('editStory.anonymizeVoter') }),
                          new uf.ActionDecorator({ $action: function() {
                            doss.getChild('editStory.anonymizeVoter').modValue(function(val) { return !val; });
                            return p.$null;
                          }})
                          
                        ]})
                      ]}),
                      /*new uf.SetView({ name: 'slapLoadTime', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'tip', info: '' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.slapLoadTime') }),
                      ]}),
                      new uf.SetView({ name: 'slamLoadTime', cssClasses: [ 'formItem' ], children: [
                        new uf.TextView({ name: 'tip', info: '' }),
                        new uf.TextEditView({ name: 'input', info: doss.getChild('editStory.slamLoadTime') })
                      ]}),*/
                      
                      new uf.SetView({ name: 'summary', children: [
                        new uf.SetView({ name: 'totalTime', cssClasses: [ 'summaryItem' ], children: [
                          
                          new uf.TextView({ name: 'text', info: 'This story may be finished in approximately:' }),
                          new uf.ChoiceView({ name: 'calc',
                            choiceInfo: function() {
                              return isNaN(parseInt(doss.getValue('editStory.contestTime'))) || isNaN(parseInt(doss.getValue('editStory.contestLimit')))
                                ? 'waiting'
                                : 'finished'
                            },
                            children: [
                              new uf.TextView({ name: 'waiting', info: 'Calculating...' }),
                              new cr.ClockView({ name: 'finished',
                                info: function() {
                                  // Note that `approximationHeuristic` considers both very quick "write" phases, and very long "awaitingWrite" phases
                                  // TODO: The number of authors will effect how long "awaitingWrite" phases last
                                  var approximationHeuristic = 1.1;
                                  return Math.floor(doss.getValue('editStory.contestTime') * doss.getValue('editStory.contestLimit') * approximationHeuristic);
                                },
                                format: 'string',
                                components: cr.timeComponentData.slice(2)
                              })
                            ]
                          })
                          
                        ]}),
                        new uf.SetView({ name: 'totalLength', cssClasses: [ 'summaryItem' ], children: [
                          
                          new uf.TextView({ name: 'text', info: 'In length, this story will be:' }),
                          new uf.ChoiceView({ name: 'calc',
                            choiceInfo: function() {
                              return isNaN(parseInt(doss.getValue('editStory.contestLimit'))) || isNaN(parseInt(doss.getValue('editStory.maxWriteLength')))
                                ? 'waiting'
                                : 'finished'
                            },
                            children: [
                              new uf.TextView({ name: 'waiting', info: 'Calculating...' }),
                              new uf.TextView({ name: 'finished',
                                info: function() {
                                  // Note that `approximationHeuristic` considers shorter-than-maximum writes
                                  var approximationHeuristic = 0.65;
                                  var numCharacters = Math.floor(doss.getValue('editStory.contestLimit') * doss.getValue('editStory.maxWriteLength') * approximationHeuristic);
                                  
                                  var words = numCharacters / 5.1; // Consider the average word to be 5.1 characters long
                                  if (words >= 10000000)      return 'Far too large';
                                  else if (words >= 5000000)  return 'Truly epic';
                                  else if (words >= 1000000)  return 'Longer than every Harry Potter book combined';
                                  else if (words >= 600000)   return 'Comparable to War and Peace';
                                  else if (words >= 160000)   return 'Comparable to A Tree Grows in Brooklyn';
                                  else if (words >= 100000)   return 'Comparable to 1984';
                                  else if (words >= 70000)    return 'Comparable to your typical mystery novel';
                                  else if (words >= 40000)    return 'As long as the average novel';
                                  else if (words >= 25000)    return 'Comparable to Alice in Wonderland';
                                  else if (words >= 10000)    return 'As long as a typical thesis';
                                  else if (words >= 5000)     return 'As long as your typical short story';
                                  else if (words >= 1000)     return 'As long as a typical highschool essay';
                                  else if (words >= 500)      return 'About two pages long';
                                  else if (words >= 250)      return 'Roughly a page long';
                                  else if (words >= 80)       return 'About a single long paragraph';
                                  
                                  return 'Only a few sentences long.';
                                }
                              })
                            ]
                          })
                          
                        ]})
                        
                      ]}),
                      
                      new uf.TextView({ name: 'submit', info: 'Submit', cssClasses: [ 'interactive', 'button', 'textButton' ] })
                      
                    ]})
                    
                  ]}),
                  
                  // The user has selected a particular story
                  new uf.SetView({ name: 'story', cssId: 'story', cssClasses: [ 'choiceTransition', 'titledContent' ], children: [
                    
                    new uf.TextView({ name: 'title', info: function() { return doss.getValue('@currentStory.quickName'); } }),
                    new uf.View({ name: 'back', cssClasses: [ 'interactive', 'button', 'iconButton', 'mainButton', 'left', 'type-larrow' ], decorators: [
                      new uf.ActionDecorator({ $action: function() {
                        doss.setValue('currentStory', null);
                        return p.$null;
                      }})
                    ]}),
                    new uf.SetView({ name: 'content', children: [
                      new uf.SetView({ name: 'metadata', children: [
                        new uf.TextView({ name: 'phase', info: function() { return doss.getValue('@currentStory.phase'); } }),
                        new cr.ClockView({ name: 'phaseTimeRemaining', info: function() { return doss.getValue('@currentStory.phaseTimeRemaining'); },
                          format: 'digital',
                          components: cr.timeComponentData.slice(0, 3)
                        })
                      ]}),
                      new uf.DynamicSetView({ name: 'writeSet', cssId: 'ws',
                        childInfo: function() {
                          var writeSet = doss.getChild('@currentStory.writeSet').children;
                          
                          var currentWrite = doss.getValue('currentWrite');
                          if (!currentWrite) return writeSet;
                          
                          writeSet = writeSet.clone();
                          
                          // Simulate a `doss`. `genChildView` will need the `value` properties.
                          writeSet['preview' + Math.abs(currentWrite.hash())] = {
                            content: currentWrite,
                            user: doss.getValue('username')
                          };
                          
                          return writeSet;
                        },
                        genChildView: function(name, info) {
                          
                          if (U.isInstance(info, ds.DossierRef)) {
                            // TODO: Review efficiency here (could be terrible with a big writeSet)
                            var username = function() {
                              var deref = info.dereference();
                              return deref ? deref.getChild('user').value[0]: 'loading...';
                            };
                            var content = function() {
                              var deref = info.dereference();
                              return deref ? deref.getValue('content') : 'loading...';
                            };
                          } else {
                            var username = info.user;
                            var content = info.content;
                          }
                          
                          return new uf.SetView({ name: name, cssClasses: [ 'write' ], children: [
                            new uf.TextView({ name: 'content', info: content }),
                            new uf.TextView({ name: 'username', info: username })
                          ]});
                          
                        }
                      }),
                      new uf.ChoiceView({ name: 'actions',
                        choiceInfo: function() {
                          var phase = doss.getValue('@currentStory.phase');
                          
                          if ([ 'awaitingWrite', 'writing' ].contains(phase)) {
                            
                            // Choice depends on whether the user has already submitted
                            return doss.getChild('@currentStory.@currentContest.@currentWrite') ? 'vote' : 'write';
                            
                          } else if ([ 'awaitingVote', 'voting' ].contains(phase)) {
                            
                            return 'vote';
                            
                          }
                          
                          throw new Error('Invalid phase: "' + phase + '"');
                        },
                        children: [
                          
                          new uf.SetView({ name: 'write', children: [
                            
                            new uf.TextEditView({ name: 'editor', info: doss.getChild('currentWrite'), multiline: true, placeholderInfo: 'Next line of the story...' }),
                            new uf.View({ name: 'submit', cssClasses: [ 'interactive', 'button' ], decorators: [
                              new uf.ActionDecorator({ $action: function() {
                                
                                // Immediately clear the "currentWrite" value
                                var write = doss.getValue('currentWrite');
                                doss.setValue('currentWrite', '');
                                
                                return doss.getChild('@currentStory.@currentContest.writeSet').content.$addChild({
                                  data: {
                                    user: doss.getValue('user'),
                                    token: doss.getValue('token'),
                                    content: write
                                  }
                                });
                              
                              }})
                            ]})
                            
                          ]}),
                          new uf.SetView({ name: 'vote', cssClasses: [ 'titledContent', 'min1' ], children: [
                            
                            new uf.TextView({ name: 'title', info: 'Vote:' }),
                            new uf.DynamicSetView({ name: 'content', cssId: 'contenderSet',
                              childInfo: function() { return doss.getChild('@currentStory.@currentContest.writeSet').children; },
                              genChildView: function(name, write) {
                                
                                var writeUsername = write.name;
                                var contest = doss.getChild('@currentStory.@currentContest');
                                var writeVoteSet = doss.getChild([ '@currentStory', '@currentContest', 'writeSet', writeUsername, 'voteSet' ]);
                                
                                return new uf.SetView({ name: name, cssClasses: [ 'contender' ],
                                  decorators: [
                                    new uf.ClassDecorator({
                                      list: [ 'selected' ],
                                      info: function() { return contest.getChild('@currentVotedWrite') === write ? 'selected' : null; }
                                    })
                                  ],
                                  children: [
                                    // The content the user wrote for this submission
                                    new uf.TextView({ name: 'content', info: write.getValue('content') }),
                                    
                                    // The username
                                    new uf.TextView({ name: 'user', info: writeUsername }),
                                    
                                    // The set of votes on this write
                                    new uf.DynamicSetView({ name: 'voteSet',
                                      childInfo: writeVoteSet,
                                      genChildView: function(name, voteInfo) {
                                        
                                        return new uf.TextView({ name: name, cssClasses: [ 'vote' ], info: voteInfo.getValue('user').split('.').pop() });
                                        
                                      }
                                    }),
                                    
                                    // Controls to allow voting
                                    new uf.ChoiceView({ name: 'votable',
                                      choiceInfo: function() { return doss.getValue('@currentStory.@currentContest.@currentVote') ? null : 'vote'; },
                                      children: [
                                        new uf.View({ name: 'vote', cssClasses: [ 'interactive', 'button' ], decorators: [
                                          new uf.ActionDecorator({ $action: function() {
                                            
                                            return writeVoteSet.content.$addChild({
                                              data: {
                                                username: doss.getValue('username'),
                                                value: 1 // This is ignored for now
                                              }
                                            });

                                          }})
                                        ]})
                                      ]
                                    })
                                  ]
                                });
                                
                              }
                            })
                            
                          ]})
                          
                        ]
                      })
                    ]})
                    
                    
                  ]})
                  
                ]
              })
              
            ]})
            
          ]}),
          new uf.TextView({ name: 'version', info: doss.getChild('version') }),
          new uf.TextView({ name: 'rps', info: function() { return 'update: ' + view.updateTimingInfo.value + 'ms' } })
          
        ],
        updateFunc: function() {
          var upd = cr.updateOnFrame;
          for (var k in upd) upd[k].update();
        }
      });
      view.start();
      
      // Decorate the login form
      var loginFormDec = new uf.FormDecorator();
      var loginFormView = view.getChild('login.out.loginForm');
      loginFormView.decorators.push(loginFormDec);
      
      var usernameDec = loginFormDec.genInputDecorator(function(val) {
        return !val.length || /^[a-zA-Z][a-zA-Z0-9]*$/.test(val) ? null : 'Invalid characters';
      });
      loginFormView.getChild('username').addChildHead(usernameDec.genErrorView());
      loginFormView.getChild('username.input').decorators.push(usernameDec);
      
      var passwordDec = loginFormDec.genInputDecorator();
      loginFormView.getChild('password.input').decorators.push(passwordDec);
      
      var loginFormSubmitDec = loginFormDec.genSubmitDecorator(function(event) {
        return doss.$doRequest({ command: 'getToken', params: {
          username: doss.getValue('username'),
          password: doss.getValue('password')
        }}).then(function(data) {
          doss.setValue('token', data.token);
        }).fail(function(err) {
          doss.setValue('loginError', err.message);
        });
      });
      loginFormView.getChild('signin').decorators.push(loginFormSubmitDec);
      
      var loginFormSignupDec = loginFormDec.genSubmitDecorator(function(event) {
        
        var username = doss.getValue('username');
        var password = doss.getValue('password');
        if (!username || !password) {
          doss.setValue('loginError', 'Please fill out fields');
          return p.$null;
        }
        
        return doss.getChild('userSet').content.$addChild({
          data: {
            username: doss.getValue('username'),
            password: doss.getValue('password')
          }
        }).then(function(data) {
          doss.setValue('token', data.token);
        }).fail(function(err) {
          console.log(err.stack);
          doss.setValue('loginError', err.message);
        });
        
      });
      loginFormView.getChild('signup').decorators.push(loginFormSignupDec);
      
      loginFormView.addChild(new uf.ChoiceView({ name: 'loading',
        choiceInfo: function() {
          return (loginFormSubmitDec.isLoading() || loginFormSignupDec.isLoading()) ? 'indicator' : null;
        },
        children: [
          new uf.HtmlView({ name: 'indicator', cssClasses: [ 'spinner', 'spinner2', 'inset' ], html: spinnerHtml })
        ]
      }));
      
      // Decorate the story form
      var storyFormDec = new uf.FormDecorator();
      var storyFormView = view.getChild('login.in.chooseStory.createStory.content');
      storyFormView.decorators.push(storyFormDec);
      
      var quickNameDec = storyFormDec.genInputDecorator(function(val) {
        return !val.length || /^[a-z][a-zA-Z]*$/.test(val) ? null : 'Begins with a lowercase letter and contains only letters';
      });
      storyFormView.getChild('quickName').addChildHead(quickNameDec.genErrorView());
      storyFormView.getChild('quickName.input').decorators.push(quickNameDec);
      
      var descriptionDec = storyFormDec.genInputDecorator(function(val) {
        return val.length <= 200 ? null : 'Description is too long';
      });
      storyFormView.getChild('description').addChildHead(descriptionDec.genErrorView());
      storyFormView.getChild('description.input').decorators.push(descriptionDec);
      
      var maxWriteLengthDec = storyFormDec.genInputDecorator(function(val) {
        return /^[0-9]*$/.test(val) ? null : 'Must be a numeric value';
      });
      storyFormView.getChild('maxWriteLength').addChildHead(maxWriteLengthDec.genErrorView());
      storyFormView.getChild('maxWriteLength.input').decorators.push(maxWriteLengthDec);
      
      var contestLimitDec = storyFormDec.genInputDecorator(function(val) {
        return /^[0-9]*$/.test(val) ? null : 'Must be a numeric value';
      });
      storyFormView.getChild('contestLimit').addChildHead(contestLimitDec.genErrorView());
      storyFormView.getChild('contestLimit.input').decorators.push(contestLimitDec);
      
      var authorLimitDec = storyFormDec.genInputDecorator(function(val) {
        return /^[0-9]*$/.test(val) ? null : 'Must be a numeric value';
      });
      storyFormView.getChild('authorLimit').addChildHead(authorLimitDec.genErrorView());
      storyFormView.getChild('authorLimit.input').decorators.push(authorLimitDec);
      
      var maxWritesDec = storyFormDec.genInputDecorator(function(val) {
        return /^[0-9]*$/.test(val) ? null : 'Must be a numeric value';
      });
      storyFormView.getChild('maxWrites').addChildHead(maxWritesDec.genErrorView());
      storyFormView.getChild('maxWrites.input').decorators.push(maxWritesDec);
      
      var maxVotesDec = storyFormDec.genInputDecorator(function(val) {
        return /^[0-9]*$/.test(val) ? null : 'Must be a numeric value';
      });
      storyFormView.getChild('maxVotes').addChildHead(maxVotesDec.genErrorView());
      storyFormView.getChild('maxVotes.input').decorators.push(maxVotesDec);
      
      var storyFormSubmitDec = storyFormDec.genSubmitDecorator(function(event) {
        
        console.log('Adding story...');
        return doss.getChild('storySet').content.$addChild({
          data: {
            user: doss.getChild('@user').getAddress(),
            quickName: doss.getValue('editStory.quickName'),
            description: doss.getValue('editStory.description'),
            contestTime: doss.getValue('editStory.contestTime'), // This value is already an integer
            authorLimit: parseInt(doss.getValue('editStory.authorLimit')),
            maxWrites: parseInt(doss.getValue('editStory.maxWrites')),
            maxVotes: parseInt(doss.getValue('editStory.maxVotes')),
            maxWriteLength: parseInt(doss.getValue('editStory.maxWriteLength')),
            contestLimit: parseInt(doss.getValue('editStory.contestLimit')),
            anonymizeWriter: doss.getValue('editStory.anonymizeWriter'),
            anonymizeVoter: doss.getValue('editStory.anonymizeVoter')
            /*slapLoadTime: doss.getValue('editStory.slapLoadTime'),
            slamLoadTime: doss.getValue('editStory.slamLoadTime'),*/
          }
        }).then(function(result) {
          doss.setValue('isEditingStory', false);
        }).fail(function(err) {
          doss.getChild('editStory.error').setValue(err.message);
          return p.$null;
        });
        
      });
      storyFormView.getChild('submit').decorators.push(storyFormSubmitDec);
      
      storyFormView.par.addChild(new uf.ChoiceView({ name: 'loading',
        choiceInfo: function() {
          return storyFormSubmitDec.isLoading() ? 'indicator' : null;
        },
        children: [
          new uf.HtmlView({ name: 'indicator', cssClasses: [ 'spinner', 'spinner2' ], html: spinnerHtml })
        ]
      }));
      
      // Add these to command line
      window.doss = doss;
      window.view = view;
      
      /*
      doss.setValue('username', 'admin');
      doss.setValue('password', 'suchsmartadmin');
      doss.$doRequest({ command: 'getToken', params: {
        username: doss.getValue('username'),
        password: doss.getValue('password')
      }}).then(function(data) {
        doss.setValue('token', data.token);
      });
      
      doss.setValue('isEditingStory', true);
      doss.setValue('editStory', {
        quickName: 'lalalala',
        description: 'Soooo great',
        authorLimit: 100,
        maxWrites: 100,
        maxVotes: 100,
        maxWriteLength: 150,
        contestLimit: 100,
        contestTime: 1000 * 60 * 60 * 12,
        slapLoadTime: 1000 * 60 * 60 * 24 * 50, // fifty days
        slamLoadTime: 1000 * 60 * 60 * 24 * 50, // fifty days
        anonymizeWriter: true,
        anonymizeVoter: true
      });
      
      */
      /// =CLIENT}
      
    }).done();
    
  }
}).build();
