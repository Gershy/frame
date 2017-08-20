/// {REMOVE=
/*
- Many of the sets in this app only ever increase in size, and never re-index anything.
  - These sets shouldn't be constantly getting requested; instead the size should be
    constantly requested, and when the size changes the entire set can be requested
- Writing devices as ability names (e.g. "hyperbolize" instead of "slam")    
*/
/// =REMOVE}
var package = new PACK.pack.Package({ name: 'creativity',
  dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
  buildFunc: function(packageName, qd, uf, p, qr) {
    
    var P = p.P;
    
    var r = 1;
    var mapMillis = {
      second: r *= 1000,
      minute: r *= 60,
      hour: r *= 60,
      day: r *= 24,
      week: r *= 7,
      year: r *= 52.1429
    };

    var cr = {
      
      /// {SERVER=
      resources: {
        css: [
          'apps/userify/style.css',
          'apps/creativity/style.css'
        ]
      },
      /// =SERVER}
      Creativity: U.makeClass({ name: 'Creativity',
        superclass: qd.DossierDict,
        methods: function(sc, c) { return {
          /// {SERVER=
          $handleRequest: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (!command.length) throw new Error('Command cannot be empty string');
            
            var funcName = '$handle' + command[0].toUpperCase() + command.substr(1) + 'Query';
            if (funcName in this)
              return this[funcName](U.param(params, 'params', {}));
            
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
            
          }
          /// =SERVER}
        };}
      }),
      CreativityUser: U.makeClass({ name: 'CreativityUser',
        superclass: qd.DossierDict,
        methods: function(sc, c) { return {
          /// {SERVER=
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
          /// =SERVER}
        };}
      }),
      
      /// {SERVER=
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
          
          var phaseEndTime = story.getValue('timePhaseStarted') + story.getValue('writingTime');
          
          var maxVotes = story.getValue('maxVotes') || numAuthors;
          var votes = currentContest.getChild('writeSet').map(function(write) { // TODO: Does `DossierSet.prototype.map` work??
            
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
      $resolveStoryWritePhase: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        return cr.$resolveStoryVotePhase(story, currentTime).then(function(editor) {
          
          editor.$modFast({
            doss: story,
            data: {
              phase: 'awaitingWrite',
              timePhaseStarted: currentTime
            }
          });
          
        });
        
      },
      $resolveStoryVotePhase: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        var editor = new qd.Editor();
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
          var $resolveVotes = editor.$editFast({
            
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
            
        } else {
          
          var $resolveVotes = p.$null;
          
        }
        
        return $resolveVotes.then(function() {
          
          editor.$modFast({
            doss: story,
            data: {
              phase: 'awaitingWrite',
              timePhaseStarted: currentTime
            }
          });
          
          return editor;
          
        });
        
      },
      
      informWriteSubmitted: function(story) {
        
        if (story.getValue('phase') === 'awaitingWrite') {
          // Kick off writing phase
          story.getChild('phase').setValue('writing');
          story.getChild('timePhaseStarted').setValue(U.timeMs());
        }
        
      },
      informVoteSubmitted: function(story) {
        
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
            this.timeOffset = U.param(params, 'timeOffset', 0);
            this.format = U.param(params, 'format', 'string'); // 'string' | 'digital'
            this.components = U.param(params, 'components', cr.timeComponentData);
          },
          
          createDomRoot: function() {
            var ret = document.createElement('div');
            ret.classList.add('clock');
            ret.classList.add('format-' + this.format);
          
            for (var i = 0, len = this.components.length; i < len; i++) {
              var c = this.components[len - i - 1];
              
              var comp = document.createElement('div');
              comp.classList.add('component');
              comp.classList.add(c.text[0]);
              
              var compName = document.createElement('div');
              if (this.format === 'digital') uf.domSetText(compName, c.text[1]);
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
            
            var currentTime = U.timeMs() + this.timeOffset;
            var time = this.info.getValue();
            
            if (time === Number.MAX_SAFE_INTEGER) {
              
              if (this.format === 'string')
                for (var i = 0, len = this.components.length; i < len; i++) {
                  var c = this.components[len - i - 1];
                  var comp = this.domRoot.childNodes[i * 2];
                  uf.domSetText(comp.childNodes[0], 'unlimited');
                  uf.domSetText(comp.childNodes[1], c.text[1]);
                }
              else if (this.format === 'digital')
                for (var i = 0, len = this.components.length; i < len; i++) {
                  var c = this.components[len - i - 1];
                  uf.domSetText(this.domRoot.childNodes[i * 2].childNodes[0], '-'.fill(c.digits));
                }
              
              return;
              
            }
            
            if (this.format === 'string') {
              
              var gotOne = false;
              for (var i = 0, len = this.components.length; i < len; i++) {
                var c = this.components[len - i - 1];
                var comp = this.domRoot.childNodes[i * 2];
                var sep = comp.nextElementSibling;
                
                var val = Math.floor(time * c.div);
                time -= val * c.mult;
                
                if (gotOne || val || i === len - 1) {
                  comp.classList.remove('empty');
                  if (sep) sep.classList.remove('empty');
                  gotOne = true;
                } else {
                  comp.classList.add('empty');
                  if (sep) sep.classList.add('empty');
                }
                
                uf.domSetText(comp.childNodes[1], c.text[val === 1 ? 0 : 1]);
                uf.domSetText(comp.childNodes[0], val.toString());
              }
              
            } else if (this.format === 'digital') {
            
              for (var i = 0, len = this.components.length; i < len; i++) {
                var c = this.components[len - i - 1];
                
                var val = Math.floor(time * c.div);
                time -= val * c.mult;
                
                val = val.toString();
                while (val.length < c.digits) val = '0' + val;
                
                uf.domSetText(this.domRoot.childNodes[i * 2].childNodes[0], val);
              }
              
            }
            
          }
        };}
      }),
      updateSet: function(sett) { for (var k in sett) sett[k].update(); },
      updateOnFrame: {},
      updateOnUsername: {},
      /// =CLIENT}
      
      versioner: new qd.Versioner({ versions: [
        { name: 'initial',
          detect: function(doss) { return doss === null; },
          $apply: function(root) {
            
            var outline = new qd.Outline({ c: cr.Creativity, p: { name: 'app' }, i: [
              
              { c: qd.DossierString,  p: { name: 'version' } },
              /// {CLIENT=
              { c: qd.DossierString,  p: { name: 'username' } },
              { c: qd.DossierString,  p: { name: 'password' } },
              { c: qd.DossierString,  p: { name: 'token' } },
              { c: qd.DossierRef,     p: { name: 'user',            template: '~root.userSet.$username' } },
              { c: qd.DossierString,  p: { name: 'loginError' } },
              { c: qd.DossierString,  p: { name: 'currentWrite' } },
              { c: qd.DossierRef,     p: { name: 'currentStory',    template: '~root.storySet.$quickName' } },
              /// =CLIENT}
              { c: qd.DossierList,    p: { name: 'userSet',
                innerOutline: { c: cr.CreativityUser, i: [
                  { c: qd.DossierString,  p: { name: 'fname' } },
                  { c: qd.DossierString,  p: { name: 'lname' } },
                  /// {SERVER=
                  { c: qd.DossierString,  p: { name: 'password' } },
                  /// =SERVER}
                  { c: qd.DossierString,  p: { name: 'username' } }
                ]},
                nameFunc: function(par, child) { return child.getValue('username'); }
              }},
              { c: qd.DossierList,    p: { name: 'storySet',
                innerOutline: { c: qd.DossierDict, i: [
                  { c: qd.DossierRef,     p: { name: 'user',        template: '~root.userSet.$username' } },
                  /// {CLIENT=
                  { c: qd.DossierBoolean, p: { name: 'isAuthored' } },
                  { c: qd.DossierString,  p: { name: 'userDisp' } },
                  { c: qd.DossierInt,     p: { name: 'age' } },
                  { c: qd.DossierInt,     p: { name: 'phaseTimeRemaining' } },
                  { c: qd.DossierRef,     p: { name: 'currentContest',  template: '~par.contestSet.$contestInd' } },
                  /// =CLIENT}
                  { c: qd.DossierInt,     p: { name: 'createdTime' } },
                  { c: qd.DossierString,  p: { name: 'quickName' } },
                  { c: qd.DossierString,  p: { name: 'description' } },
                  { c: qd.DossierInt,     p: { name: 'contestInd' } },        // Index of current contest
                  { c: qd.DossierInt,     p: { name: 'authorLimit' } },       // Max number of users writing this story
                  { c: qd.DossierInt,     p: { name: 'writingTime' } },       // Number of millis to submit writes each contest
                  { c: qd.DossierInt,     p: { name: 'votingTime' } },        // Number of millis to vote on writes each contest
                  { c: qd.DossierInt,     p: { name: 'maxWrites' } },         // Number of writes allowed per contest
                  { c: qd.DossierInt,     p: { name: 'maxVotes' } },          // Number of votes allowed per contest
                  { c: qd.DossierInt,     p: { name: 'maxWriteLength' } },    // Number of characters allowed in an entry
                  { c: qd.DossierInt,     p: { name: 'contestLimit' } },      // Total number of contests before the story concludes
                  { c: qd.DossierInt,     p: { name: 'slapLoadTime' } },      // Total millis to load a new slap ability
                  { c: qd.DossierInt,     p: { name: 'slamLoadTime' } },      // Total millis to load a new slam ability'
                  { c: qd.DossierString,  p: { name: 'phase' } },             // The phase: awaitingWrite | writing | awaitingVote | voting
                  { c: qd.DossierInt,     p: { name: 'timePhaseStarted' } },  // The time the phase started at
                  
                  { c: qd.DossierList,    p: { name: 'authorSet',
                    innerOutline: { c: qd.DossierDict, i: [
                      { c: qd.DossierRef,     p: { name: 'user',        template: '~root.userSet.$username' } },
                      { c: qd.DossierInt,     p: { name: 'numSlaps' } },
                      { c: qd.DossierInt,     p: { name: 'lastSlapTime' } },
                      { c: qd.DossierInt,     p: { name: 'numSlams' } },
                      { c: qd.DossierInt,     p: { name: 'lastSlamTime' } }
                    ]},
                    nameFunc: function(par, child) { return child.getChild('@user').name; },
                    // TODO: Users are being handled differently server/client-side; client is trying to get away with using usernames without ever loading user `Dossier`
                    /// {SERVER=
                    verifyAndSanitizeData: function(child, params) {
                      
                      var username = U.param(params, 'username');
                      
                      var preexisting = child.getChild([ 'authorSet', username ]);
                      if (preexisting) throw new Error('User "' + username + '" is already an author');
                      
                      var user = child.getChild([ '~root', 'userSet', username ]);
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
                    /// =SERVER}
                  }},
                  
                  { c: qd.DossierList,    p: { name: 'contestSet',
                    innerOutline: { c: qd.DossierDict, i: [
                      { c: qd.DossierInt,     p: { name: 'num' } },
                      { c: qd.DossierList,    p: { name: 'writeSet',
                        innerOutline: { c: qd.DossierDict, i: [
                          { c: qd.DossierRef,     p: { name: 'user',      template: '~root.userSet.$username' } },
                          { c: qd.DossierString,  p: { name: 'content' } },
                          { c: qd.DossierList,    p: { name: 'voteSet',
                            innerOutline: { c: qd.DossierDict, i: [
                              { c: qd.DossierRef,   p: { name: 'user',      template: '~root.userSet.$username' } },
                              { c: qd.DossierInt,   p: { name: 'value' } }
                            ]},
                            nameFunc: function(par, vote) {
                              return vote.getChild('@user').name;
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
                        ]},
                        nameFunc: function(par, write) {
                          // TODO: Can this be unified?
                          return write.getChild('user').value[0];
                        },
                        verifyAndSanitizeData: function(writeSet, params) {
                          
                          var username = U.param(params, 'username');
                          var content = U.param(params, 'content');
                          
                          // TODO: Again, can server+client be unified?
                          /// {SERVER=
                          // Move from:
                          //  src - storySet, story, contestSet, contest, writeSet
                          //  trg - storySet, story
                          var author = writeSet.getChild([ '~par', '~par', '~par', 'authorSet', username ]);
                          if (!author) throw new Error('Story doesn\'t have author "' + username + '"');
                          var user = author.getChild('@user');
                          cr.informWriteSubmitted(author.par.par);
                          /// =SERVER}
                          
                          /// {CLIENT=
                          var user = writeSet.getChild([ '~root', 'userSet', username ]);
                          if (!user) throw new Error('Can\'t find user "' + username + '"');
                          /// =CLIENT}
                          
                          return {
                            user: user,
                            content: content,
                            voteSet: {}
                          };
                          
                        }
                      }},
                      /// {CLIENT=
                      { c: qd.DossierRef,     p: { name: 'currentWrite',      template: '~par.writeSet.$username' } },
                      { c: qd.DossierRef,     p: { name: 'currentVote',       template: '~par.writeSet.$username.voteSet.$username' } },
                      { c: qd.DossierRef,     p: { name: 'currentVotedWrite', template: '~par.writeSet.$username' } }
                      /// =CLIENT}
                    ]},
                    nameFunc: function(par, child) { return child.getValue('num'); }
                  }},
                  
                  { c: qd.DossierList,    p: { name: 'writeSet',
                    innerOutline: { c: qd.DossierRef, p: { template: '~par.~par.contestSet.$contestInd.writeSet.$username' } }
                  }}
                  
                ]},
                nameFunc: function(par, child) { return child.getValue('quickName'); },
                verifyAndSanitizeData: function(child, params) {
                  
                  var username = U.param(params, 'username');
                  var user = child.getChild([ '~root', 'userSet', username ]);
                  if (!user) throw new Error('Bad username: "' + username + '"');
                  
                  var currentTime = U.timeMs();
                  
                  return {
                    user: user,
                    createdTime: currentTime,
                    quickName: U.param(params, 'quickName'),
                    description: U.param(params, 'description'),
                    contestInd: 0,
                    authorLimit: U.param(params, 'authorLimit'),
                    writingTime: U.param(params, 'writingTime'),
                    votingTime: U.param(params, 'votingTime'),
                    maxWrites: U.param(params, 'maxWrites'),
                    maxVotes: U.param(params, 'maxVotes'),
                    maxWriteLength: U.param(params, 'maxWriteLength'),
                    contestLimit: U.param(params, 'contestLimit'),
                    slapLoadTime: U.param(params, 'slapLoadTime', 1000 * 60 * 60 * 100),
                    slamLoadTime: U.param(params, 'slamLoadTime', 1000 * 60 * 60 * 100),
                    phase: 'awaitingWrite',
                    timePhaseStarted: currentTime,
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
              
            ]});
            
            /// {CLIENT=
            outline.getChild('token').p.changeHandler = cr.updateSet.bind(null, cr.updateOnUsername);
            
            outline.getChild('user').p.contentFunc = function(doss) {
              return new qd.ContentSyncRef({ doss: doss, cache: cr.updateOnUsername,
                calcRef: function() {
                  // Set reference to null unless a token is obtained
                  return doss.getChild('~root.token').value ? [ doss.getChild('~root.username').value ] : null;
                },
                selection: {
                  fname: {},
                  lname: {},
                  username: {}
                }
              });
            };
            
            outline.getChild('version').p.contentFunc = function(doss) {
              return new qd.ContentSync({ doss: doss });
            };
            
            outline.getChild('currentStory').p.contentFunc = function(doss) {
              return new qd.ContentSyncRef({ doss: doss });
            };
            
            outline.getChild('storySet').p.contentFunc = function(doss) {
              return new qd.ContentSyncDict({ doss: doss, waitMs: 10000, selection: {
                '*': {
                  user: {},
                  createdTime: {},
                  quickName: {},
                  description: {},
                  contestInd: {},
                  contestLimit: {},
                  phase: {},
                  timePhaseStarted: {},
                  writingTime: {},
                  votingTime: {}
                }
              }});
            };
            
            outline.getChild('storySet.*.user').p.contentFunc = function(doss) {
              return new qd.ContentSyncRef({ doss: doss });
            };
            
            outline.getChild('storySet.*.userDisp').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                var user = doss.par.getChild('@user');
                return user
                  ? user.getValue('fname') + ' ' + user.getValue('lname') + ' (' + user.getValue('username') + ')'
                  : '- loading -';
              }});
            };
            
            outline.getChild('storySet.*.isAuthored').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                return doss.getValue('~par.username') === doss.getValue('~root.username');
              }});
            };
            
            outline.getChild('storySet.*.phase').p.contentFunc = function(doss) {
              return new qd.ContentSync({ doss: doss, waitMs: 2000 });
            };
            
            outline.getChild('storySet.*.timePhaseStarted').p.contentFunc = function(doss) {
              return new qd.ContentSync({ doss: doss, waitMs: 2000 });
            };
            
            outline.getChild('storySet.*.phaseTimeRemaining').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                
                var story = doss.par;
                var phase = story.getValue('phase');
                
                if (phase === 'writing') {
                  
                  return story.getValue('timePhaseStarted') + story.getValue('writingTime') - U.timeMs();
                  
                } else if (phase === 'voting') {
                  
                  return story.getValue('timePhaseStarted') + story.getValue('votingTime') - U.timeMs();
                  
                } else {
                  
                  return Number.MAX_SAFE_INTEGER;
                  
                }
                  
              }});
            };
            
            outline.getChild('storySet.*.age').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                
                return U.timeMs() - doss.par.getValue('createdTime');
                
              }});
            };
            
            outline.getChild('storySet.*.writeSet').p.contentFunc = function(doss) {
              return new qd.ContentSyncDict({ doss: doss, waitMs: 2000, selection: qd.selectAll });
            };
            
            outline.getChild('storySet.*.writeSet.*').p.contentFunc = function(doss) {
              return new qd.ContentSyncRef({ doss: doss, selection: qd.selectAll });
            };
            
            outline.getChild('storySet.*.contestInd').p.contentFunc = function(doss) {
              return new qd.ContentSync({ doss: doss, waitMs: 1000 });
            };
            outline.getChild('storySet.*.contestInd').p.changeHandler = function(doss) {
              var story = doss.par;
              story.getChild('currentContest').content.update();
              story.getChild('writeSet').content.update();
              story.getChild('phase').content.update();
              story.getChild('timePhaseStarted').content.update();
            };
            
            outline.getChild('storySet.*.currentContest').p.contentFunc = function(doss) {
              return new qd.ContentSyncRef({ doss: doss, calcRef: function() {
                return [ doss.par.getValue('contestInd') ]; // The current contest's index is stored in `contestInd`
              }});
            };
            
            outline.getChild('storySet.*.contestSet.*.writeSet').p.contentFunc = function(doss) {
              return new qd.ContentSyncDict({ doss: doss, waitMs: 2000, selection: qd.selectAll });
            };
            
            outline.getChild('storySet.*.contestSet.*.currentWrite').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                // Return `null` if no current write, otherwise return the write
                var username = doss.getChild('~root.username').value;
                return username ? doss.getChild([ '~par', 'writeSet', username ]) : null;
              }});
            };
            
            outline.getChild('storySet.*.contestSet.*.writeSet.*.voteSet').p.contentFunc = function(doss) {
              return new qd.ContentSyncDict({ doss: doss, waitMs: 2000, selection: qd.selectAll });
            };
            
            outline.getChild('storySet.*.contestSet.*.currentVote').p.contentFunc = function(doss) {
              return new qd.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
                /*
                TODO: The vote data structure isn't great.
                
                Looks like:
                - contest
                  - writeSet
                    - write1
                      - voteSet
                        - vote11
                        - vote12
                        - vote13
                    - write2
                      - voteSet
                        - vote21
                        - vote22
                        - vote23
                
                Should look like:
                - contest
                  - writeSet
                    - write1
                    - write2
                  - voteSet
                    - vote11
                    - vote12
                    - vote21
                    - vote22
                
                */
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
            };
            outline.getChild('storySet.*.contestSet.*.currentVote').p.changeHandler = function(currentVote) {
              // Changing the current vote also changes the current voted write
              var vote = currentVote.dereference();
              var currentVotedWrite = currentVote.getChild('~par.currentVotedWrite');
              currentVotedWrite.setValue(vote ? vote.par.par : null);
            };
    
            /// =CLIENT}
            
            return outline.$getDoss({
              
              /// {SERVER=
              version: '0.0.1 (initial)',
              /// =SERVER}
              /// {CLIENT=
              version: 'Loading...',
              /// =CLIENT}
              userSet: {},
              storySet: {}
              
            });
            
          }
        },
        /// {SERVER=
        { name: 'addDefaultData',
          detect: function(doss) { return doss.getChild('userSet').length === 0; },
          $apply: function(doss) {
            
            var editor = new qd.Editor();
            
            return editor.$editFast({ add: [
              {
                par: doss.getChild('userSet'),
                data: {
                  fname: 'Admin',
                  lname: 'Istrator',
                  username: 'admin',
                  password: 'admin123'
                }
              },
              {
                par: doss.getChild('userSet'),
                data: {
                  fname: 'Gersh',
                  lname: 'Maes',
                  username: 'gershy',
                  password: 'imsosmart'
                }
              }
            ]}).then(function(adminUser) {
              
              return doss.getChild('storySet').$handleRequest({
                command: 'addData',
                params: {
                  data: {
                    username: 'admin',
                    quickName: 'firstStory',
                    description: 'First story!!',
                    authorLimit: 10,
                    writingTime: 1000 * 60 * 60 * 12, // 12 hours // 1000 * 60 * 0.1, // 6 seconds // 
                    votingTime: 1000 * 60 * 60 * 8, // 8 hours
                    maxWrites: 10,
                    maxVotes: 10,
                    maxWriteLength: 500,
                    contestLimit: 1000
                  }
                }
              });
                
            }).then(function() {
            
              return doss.getChild('storySet.firstStory.authorSet').$handleRequest({
                command: 'addData',
                params: {
                  data: {
                    username: 'gershy'
                  }
                }
              });
            
            }).then(function() {
              
              /*return doss.getChild('storySet.firstStory.contestSet.0.writeSet').$handleRequest({
                command: 'addData',
                params: {
                  data: {
                    username: 'admin',
                    content: 'Haha first entry LOLLL'
                  }
                }
              });*/
              
            }).then(function() {
              
              return doss.getChild('storySet.firstStory.contestSet.0.writeSet').$handleRequest({
                command: 'addData',
                params: {
                  data: {
                    username: 'gershy',
                    content: 'IM GERHSOM LOLLLLOOLOOOOO'
                  }
                }
              });
            
            }).then(function() {
              
              return doss; // Ensure the root Dossier is returned no matter what
              
            });
            
          }
        }
        /// =SERVER}
      ]})
      
    };
    
    return cr;
    
  },
  runAfter: function(cr, qd, uf, p, qr) {
    
    var P = p.P;

    cr.versioner.$getDoss().then(function(doss) {
      
      doss.fullyLoaded();
      
      /// {SERVER=
      // console.log(JSON.stringify(doss.getValue(), null, 2));
      cr.queryHandler = doss;
      // TODO: Use a single timeout+inform-on-vote instead of this ugly interval loop?
      setInterval(function() { cr.$updateCreativity(doss).done(); }, 2000);
      console.log('App update loop initialized...');
      /// =SERVER}
      
      /// {CLIENT=
      var rootView = new uf.RootView({ name: 'root',
        children: [
          
          new uf.ChoiceView({ name: 'login', choiceInfo: function () { return doss.getValue('~root.token') ? 'in' : 'out' }, children: [
            
            // The user is logged out
            new uf.SetView({ name: 'out', children: [
              
              new uf.TextHideView({ name: 'loginError', info: doss.getChild('loginError') }),
              /*
              Piece Together
              Dark and Stormy Write
              Collabowrite
              Once Upon a Mind
              WordMixer
              */
              new uf.TextView({ name: 'title', info: 'Creativity' }),
              new uf.TextEditView({ name: 'username', cssClasses: [ 'centered' ], textInfo: doss.getChild('username'), placeholderData: 'Username' }),
              new uf.TextEditView({ name: 'password', cssClasses: [ 'centered' ], textInfo: doss.getChild('password'), placeholderData: 'Password' }),
              new uf.ActionView({ name: 'submit', textInfo: 'Login', $action: function() {
                return doss.$doRequest({ command: 'getToken', params: {
                  username: doss.getValue('username'),
                  password: doss.getValue('password')
                }}).then(function(data) {
                  doss.setValue('token', data.token);
                }).fail(function(err) {
                  doss.setValue('loginError', err.message);
                });
              }})
              
            ]}),
            
            // The user is logged in
            new uf.SetView({ name: 'in', children: [
              
              new uf.ChoiceView({ name: 'chooseStory', choiceInfo: function() { return doss.getChild('@currentStory') ? 'story' : 'lobby'; }, children: [
                
                // The user is selecting which story to enter
                new uf.SetView({ name: 'lobby', cssId: 'lobby', children: [
                  
                  new uf.TextView({ name: 'title', info: 'Lobby' }),
                  new uf.DynamicSetView({ name: 'storySet',
                    childInfo: doss.getChild('storySet'),
                    decorators: [],
                    genChildView: function(name, info) {
                      
                      return new uf.SetView({ name: name, cssClasses: [ 'story' ], children: [
                        
                        new uf.TextView({ name: 'quickName', info: info.getChild('quickName') }),
                        new uf.TextView({ name: 'description', info: info.getChild('description') }),
                        new uf.TextView({ name: 'user', info: info.getChild('userDisp') }),
                        new uf.SetView({ name: 'age', children: [
                          new uf.TextView({ name: 0, info: 'Begun' }),
                          new cr.ClockView({ name: 1,
                            info: info.getChild('age'),
                            format: 'string',
                            components: cr.timeComponentData.slice(1)
                          }),
                          new uf.TextView({ name: 2, info: 'ago' })
                        ]}),
                        
                        new uf.ChoiceView({ name: 'authored', choiceInfo: info.getChild('isAuthored'), children: [
                          
                          new uf.ActionView({ name: 'false', textInfo: 'Become an Author', $action: function() {
                            
                            return p.$null;
                            
                          }}),
                          new uf.ActionView({ name: 'true', textInfo: 'Select', $action: function() {
                            
                            doss.setValue('currentStory', info);
                            console.log('CURRENT STORY', doss.getValue('currentStory'));
                            return p.$null;
                            
                          }})
                          
                        ]})
                        
                      ]});
                      
                    }
                  })
                  
                ]}),
                
                // The user has selected a particular story
                new uf.SetView({ name: 'story', cssId: 'story', children: [
                  
                  new uf.SetView({ name: 'header', children: [
                    
                    new uf.ActionView({ name: 'back', textInfo: 'Back', $action: function() {
                      
                      doss.setValue('currentStory', null);
                      return p.$null;
                      
                    }}),
                    new uf.TextView({ name: 'title', info: doss.getRefValue('@currentStory.quickName') }),
                    new uf.SetView({ name: 'roundInfo', children: [
                      new uf.TextView({ name: 'phase', info: doss.getRefValue('@currentStory.phase') }),
                      new cr.ClockView({ name: 'phaseTimeRemaining',
                        info: doss.getRefValue('@currentStory.phaseTimeRemaining'),
                        format: 'digital',
                        components: cr.timeComponentData.slice(0, 3)
                      })
                    ]})
                      
                  ]}),
                  
                  new uf.DynamicSetView({ name: 'writeSet',
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
                    decorators: [],
                    genChildView: function(name, info) {
                      
                      if (U.isInstance(info, qd.DossierRef)) {
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
                  
                  new uf.ChoiceView({ name: 'writeOrVote',
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
                        
                        new uf.TextEditView({ name: 'editor', textInfo: doss.getChild('currentWrite'), multiline: true, placeholderData: 'Next line of the story...' }),
                        new uf.ActionView({ name: 'submit', textInfo: 'Submit', $action: function() {
                          
                          return doss.getChild('@currentStory.@currentContest.writeSet').content.$addChild({
                            data: {
                              username: doss.getValue('username'),
                              token: doss.getValue('token'),
                              content: doss.getValue('currentWrite')
                            }
                          }).then(function() {
                            
                            doss.setValue('currentWrite', '');
                            
                          });
                        
                        }})
                        
                      ]}),
                      new uf.SetView({ name: 'vote', children: [
                        
                        new uf.TextView({ name: 'title', info: 'Vote:' }),
                        new uf.DynamicSetView({ name: 'contenderSet', cssId: 'contenderSet',
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
                                    new uf.ActionView({ name: 'vote', textInfo: 'Select', $action: function() {
                                      
                                      return writeVoteSet.content.$addChild({
                                        data: {
                                          username: doss.getValue('username'),
                                          value: 1 // This is ignored for now
                                        }
                                      });
                                      
                                    }})
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
              
            ]})
            
          ]}),
          new uf.TextView({ name: 'version', info: doss.getChild('version') }),
          new uf.TextView({ name: 'rps', info: function() { return 'update: ' + rootView.updateTimingInfo.value + 'ms' } })
          
        ],
        updateFunc: function() {
          cr.updateSet(cr.updateOnFrame);
        }
      });
      rootView.start();
      
      window.doss = doss;
      
      // Testing:
      return;
      doss.setValue('username', 'admin');
      doss.setValue('password', 'admin123');
      doss.$doRequest({ command: 'getToken', params: {
        username: doss.getValue('username'),
        password: doss.getValue('password')
      }}).then(function(data) {
        doss.setValue('token', data.token);
      });
      /// =CLIENT}
      
    }).done();
    
  }
});
package.build();
