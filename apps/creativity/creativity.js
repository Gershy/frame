/*
- Many of the sets in this app only ever increase in size, and never re-index anything.
  - These sets shouldn't be constantly getting requested; instead the size should be
    constantly requested, and when the size changes the entire set can be requested
*/
var package = new PACK.pack.Package({ name: 'creativity',
  dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
  buildFunc: function(packageName, qd, uf, p, qr) {
    
    var P = p.P;
    
    
    var cr = {};
    
    var r = 1;
    cr.mapMillis = {
      second: r *= 1000,
      minute: r *= 60,
      hour: r *= 60,
      day: r *= 24,
      week: r *= 7,
      year: r *= 52.1429
    };
    
    cr.update(SERVER([[{
      
      resources: { css: [ 'apps/creativity/style.css', 'apps/userify/style.css' ] },
      
      Creativity: U.makeClass({ name: 'Creativity',
        superclass: qd.DossierDict,
        methods: function(sc, c) { return {
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
        };}
      }),
      CreativityUser: U.makeClass({ name: 'CreativityUser',
        superclass: qd.DossierDict,
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
      
      $updateCreativity: function(app) {
        
        var time = U.timeMs();
        var storySet = app.children.storySet.children;
        var promises = [];
        
        for (var storyQn in storySet) {
          
          var story = storySet[storyQn];
          promises.push(cr.$updateStory(story, time));
          
        }
        
        return new p.P({ all: promises }).then(function() { console.log('Update complete'); });
        
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
          var maxWrites = story.getValue('maxWrites') || numAuthors;
          var numEntries = currentContest.getChild('writeSet').length;
          
          if (currentTime > phaseEndTime) {
            
            console.log('RESOLVING WRITING on "' + story.name + '" because time is up');
            return cr.$resolveStoryWritePhase(story);
            
          } else if (numEntries >= maxWrites) {
            
            console.log('RESOLVING WRITING on "' + story.name + '" because max entries received');
            return cr.$resolveStoryWritePhase(story);
            
          } else {
            
            console.log('Story "' + story.name + '" WRITING continues...');
            return p.$null;
            
          }
          
        } else if (phase === 'awaitingVote') {
          
          return p.$null;
          
        } else if (phase === 'voting') {
          
          var phaseEndTime = story.getValue('timePhaseStarted') + story.getValue('votingTime');
          
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
            
          if ((nextBest + votesRemaining) < best) { // Even if all remaining votes go to the best losing option, the leader can't be overtaken
            
            console.log('RESOLVING VOTING on "' + story.name + '" because voters decided early');
            return cr.$resolveStoryVotePhase(story, currentTime);
            
          } else if (currentTime >= phaseEndTime) {
            
            console.log('RESOLVING VOTING on "' + story.name + '" because time is up');
            return cr.$resolveStoryVotePhase(story, currentTime);
            
          } else if (votesRemaining === 0) {
            
            console.log('RESOLVING VOTING on "' + story.name + '" because everyone has voted');
            return cr.$resolveStoryVotePhase(story, currentTime);
            
          } else {
            
            console.log('Story "' + story.name + '" VOTING continues...');
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
        
        var phase = story.getValue('phase');
        if (![ 'awaitingWrite', 'writing' ].contains(phase))
          throw new Error('Cannot submit writes on "' + phase + '" phase');
        
        if (phase === 'awaitingWrite') {
          // Kick off writing phase
          story.getChild('phase').setValue('writing');
          story.getChild('timePhaseStarted').setValue(U.timeMs());
        }
        
      },
      informVoteSubmitted: function(story) {
        
        var phase = story.getValue('phase');
        
        if (phase === 'awaitingVote') {
          // Kick off voting phase
          story.getChild('phase').setValue('voting');
          story.getChild('timePhaseStarted').setValue(U.timeMs());
        }
        
      },
      
      versioner: new qd.Versioner({ versions: [
        { name: 'initial',
          detect: function(doss) { return doss === null; },
          $apply: function(root) {
            
            var editor = new qd.Editor();
            
            var outline = new qd.Outline({ c: cr.Creativity, p: { name: 'app' }, i: [
              
              { c: qd.DossierString,  p: { name: 'version' } },
              { c: qd.DossierList,    p: { name: 'userSet',
                innerOutline: { c: cr.CreativityUser, i: [
                  { c: qd.DossierString,  p: { name: 'fname' } },
                  { c: qd.DossierString,  p: { name: 'lname' } },
                  { c: qd.DossierString,  p: { name: 'username' } },
                  { c: qd.DossierString,  p: { name: 'password' } }
                ]},
                nameFunc: function(par, child) { return child.getValue('username'); }
              }},
              { c: qd.DossierList,    p: { name: 'storySet',
                innerOutline: { c: qd.DossierDict, i: [
                  { c: qd.DossierRef,     p: { name: 'user',        baseAddress: '~root.userSet' } },
                  { c: qd.DossierInt,     p: { name: 'createdTime' } },
                  { c: qd.DossierString,  p: { name: 'quickName' } },
                  { c: qd.DossierString,  p: { name: 'description' } },
                  { c: qd.DossierInt,     p: { name: 'contestInd' } },        // Index of current contest
                  { c: qd.DossierInt,     p: { name: 'authorLimit' } },       // Max number of users writing this story
                  { c: qd.DossierInt,     p: { name: 'writingTime' } },       // Number of millis to submit writes each contest
                  { c: qd.DossierInt,     p: { name: 'votingTime' } },        // Number of millis to vote on writes each contest
                  { c: qd.DossierInt,     p: { name: 'maxWrites' } },         // Number of writes allowed per contest
                  { c: qd.DossierInt,     p: { name: 'maxVotes' } },          // Number of votes allowed per contest
                  { c: qd.DossierInt,     p: { name: 'maxWriteLength' } },  // Number of characters allowed in an entry
                  { c: qd.DossierInt,     p: { name: 'contestLimit' } },      // Total number of contests before the story concludes
                  { c: qd.DossierInt,     p: { name: 'slapLoadTime' } },      // Total millis to load a new slap ability
                  { c: qd.DossierInt,     p: { name: 'slamLoadTime' } },      // Total millis to load a new tyranny ability'
                  { c: qd.DossierString,  p: { name: 'phase' } },             // The phase: awaitingWrite | writing | awaitingVote | voting
                  { c: qd.DossierInt,     p: { name: 'timePhaseStarted' } },  // The time the phase started at
                  
                  { c: qd.DossierList,    p: { name: 'authorSet',
                    innerOutline: { c: qd.DossierDict, i: [
                      { c: qd.DossierRef,     p: { name: 'user',        baseAddress: '~root.userSet' } },
                      { c: qd.DossierInt,     p: { name: 'numSlaps' } },
                      { c: qd.DossierInt,     p: { name: 'lastSlapTime' } },
                      { c: qd.DossierInt,     p: { name: 'numSlams' } },
                      { c: qd.DossierInt,     p: { name: 'lastSlamTime' } }
                    ]},
                    nameFunc: function(par, child) { return child.getChild('@user').name; }
                  }},
                  
                  { c: qd.DossierList,    p: { name: 'contestSet',
                    innerOutline: { c: qd.DossierDict, i: [
                      { c: qd.DossierInt,     p: { name: 'num' } },
                      { c: qd.DossierList,    p: { name: 'writeSet',
                        innerOutline: { c: qd.DossierDict, i: [
                          { c: qd.DossierRef,     p: { name: 'user',      baseAddress: '~root.userSet' } },
                          { c: qd.DossierString,  p: { name: 'content' } },
                          { c: qd.DossierList,    p: { name: 'voteSet',
                            innerOutline: { c: qd.DossierDict, i: [
                              { c: qd.DossierRef,   p: { name: 'user',      baseAddress: '~root.userSet' } },
                              { c: qd.DossierInt,   p: { name: 'value' } }
                            ]},
                            nameFunc: function(par, child) { return child.getChild('@user').name; },
                            verifyAndSanitizeData: function(voteSet, params) {
                              var username = U.param(params, 'username');
                              var value = 1; // U.param(params, 'value');
                              
                              // Oh boy that's a lot of parents... moving from:
                              //  src) storySet, story, contestSet, contest, writeSet, write, voteSet
                              //  trg) storySet, story
                              var author = voteSet.getChild([ '~par', '~par', '~par', '~par', '~par', 'authorSet', username ]);
                              if (!author) throw new Error('Story doesn\'t have author "' + username + '"');
                              
                              cr.informVoteSubmitted(author.par.par);
                              
                              return {
                                user: author.getChild('@user'),
                                value: value
                              };
                              
                            }
                          }}
                        ]},
                        nameFunc: function(par, child) { return child.getChild('@user').name; },
                        verifyAndSanitizeData: function(writeSet, params) {
                          var username = U.param(params, 'username');
                          var content = U.param(params, 'content');
                          
                          // Move from:
                          //  src) storySet, story, contestSet, contest, writeSet
                          //  trg) storySet, story
                          var author = writeSet.getChild([ '~par', '~par', '~par', 'authorSet', username ]);
                          if (!author) throw new Error('Story doesn\'t have author "' + username + '"');
                          
                          cr.informWriteSubmitted(author.par.par);
                          
                          return {
                            user: author.getChild('@user'),
                            content: content,
                            voteSet: {}
                          };
                        }
                      }}
                    ]},
                    nameFunc: function(par, child) { return child.getValue('num'); }
                  }},
                  
                  { c: qd.DossierList,    p: { name: 'writeSet',
                    innerOutline: { c: qd.DossierRef, p: { baseAddress: '~par.~par.contestSet' } }
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
            
            return editor.$createFast(outline, {
              version: '0.0.1 (initial)',
              userSet: {},
              storySet: {}
            });
            
          }
        },
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
                    writingTime: 1000 * 60 * 0.1, // 6 seconds // 1000 * 60 * 60 * 12, // 12 hours
                    votingTime: 1000 * 60 * 60 * 8, // 8 hours
                    maxWrites: 10,
                    maxVotes: 10,
                    maxWriteLength: 500,
                    contestLimit: 1000
                  }
                }
              });
              
            }).then(function() {
              
              return doss;
              
            });
            
          }
        }
      ]})
      
    }]]));
    
    cr.update(CLIENT([[{
      
      timeComponentData: [
        { text: [ 'second', 'seconds' ], digits: 2, mult: cr.mapMillis.second, div: 1 / cr.mapMillis.second },
        { text: [ 'minute', 'minutes' ], digits: 2, mult: cr.mapMillis.minute, div: 1 / cr.mapMillis.minute },
        { text: [ 'hour',   'hours'   ], digits: 2, mult: cr.mapMillis.hour,   div: 1 / cr.mapMillis.hour },
        { text: [ 'day',    'days'    ], digits: 2, mult: cr.mapMillis.day,    div: 1 / cr.mapMillis.day },
        { text: [ 'week',   'weeks'   ], digits: 2, mult: cr.mapMillis.week,   div: 1 / cr.mapMillis.week },
        { text: [ 'year',   'years'   ], digits: 4, mult: cr.mapMillis.year,   div: 1 / cr.mapMillis.year }
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
            ret.classList.add('_clock');
            ret.classList.add('_format-' + this.format);
          
            for (var i = 0, len = this.components.length; i < len; i++) {
              var c = this.components[len - i - 1];
              
              var comp = document.createElement('div');
              comp.classList.add('_component');
              comp.classList.add(c.text[0]);
              
              var compName = document.createElement('div');
              if (this.format === 'digital') uf.domSetText(compName, c.text[1]);
              compName.classList.add('_name');
              
              var compVal = document.createElement('div');
              compVal.classList.add('_value');
              
              comp.appendChild(compVal);
              comp.appendChild(compName);
              
              ret.appendChild(comp);
              
              if (i < len - 1) {
                var sep = document.createElement('div');
                sep.classList.add('_separator');
                ret.appendChild(sep);
              }
              
            }
          
            return ret;
          },
          tick: function(millis) {
            
            var currentTime = U.timeMs() + this.timeOffset;
            var time = this.info.getValue();
            
            if (time === Number.POSITIVE_INFINITY) {
              
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
                  comp.classList.remove('_empty');
                  if (sep) sep.classList.remove('_empty');
                  gotOne = true;
                } else {
                  comp.classList.add('_empty');
                  if (sep) sep.classList.add('_empty');
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
            
          },
          
          start: function() {
            sc.start.call(this);
            this.info.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.info.stop();
          }
          
        };}
      })
      
    }]]));
    
    return cr;
    
  },
  runAfter: function(cr, qd, uf, p, qr) {
    
    var P = p.P;
    
    var beginServer = SERVER([[
      cr.versioner.$getDoss().then(function(doss) {
        
        cr.queryHandler = doss;
        setInterval(function() { cr.$updateCreativity(doss).done(); }, 5000);
        console.log('App update loop initialized...');
        
      }).done()
    ]]);
    
    var beginClient = CLIENT([[(function() {
      
      var doss = new qd.DossierDict({ outline: null }).updateName('app');
      
      var infoSet = new uf.DictInfo({ children: {} });
      infoSet.addChild('appVersion', new uf.RepeatingSyncedInfo({
        $getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
      }));
      infoSet.addChild('icons', new uf.DictInfo({ children: {} }));
      infoSet.addChild('loginError', new uf.TemporaryInfo({ value: '', memoryMs: 3000 }));
      infoSet.addChild('username', new uf.SimpleInfo({ value: '' }));
      infoSet.addChild('password', new uf.SimpleInfo({ value: '' }));
      infoSet.addChild('token', new uf.SimpleInfo({ value: null }));
      infoSet.addChild('currentStory', new uf.DictInfo({ children: {
        
        // The owner of the story
        user: new uf.SimpleInfo({ value: null }),
        
        createdTime: new uf.SimpleInfo({ value: 0 }),
        quickName: new uf.SimpleInfo({ value: '' }),
        description: new uf.SimpleInfo({ value: '' }),
        
        // Maximum number of contests in this story
        contestLimit: new uf.SimpleInfo({ value: 0 }),
        
        // Index of the current contest
        contestInd: new uf.RepeatingSyncedInfo({
          initialValue: -1,
          $setFunc: function(val) { return p.$null; },
          $getFunc: function() {
          
            var qn = infoSet.getValue('currentStory.quickName');
            if (!qn) return new P({ val: -1 });
            
            return doss.$doRequest({
              address: [ 'storySet', qn, 'contestInd' ],
              command: 'getRawData'
            });
          
          },
          updateMs: 3000
        }),
        
        // Current contest
        currentContest: new uf.RepeatingSyncedInfo({
          initialValue: null,
          $getFunc: function() {
            
            var qn = infoSet.getValue('currentStory.quickName');
            var contestInd = infoSet.getValue('currentStory.contestInd')
            if (!qn || contestInd === -1) return new P({ val: null });
            
            return doss.$doRequest({
              address: [ 'storySet', qn, 'contestSet', contestInd ],
              command: 'getRawData'
            });
            
          },
          updateMs: 0
        }),
        
        // The current user's author in the story
        author: new uf.SimpleInfo({ value: null }),
        
        // The current user's write in the current contest
        currentWriteSet: new uf.RepeatingSyncedInfo({
          initialValue: {},
          $setFunc: function(value) { return p.$null; },
          $getFunc: function() {
            
            var qn = infoSet.getValue('currentStory.quickName');
            var contestInd = infoSet.getValue('currentStory.contestInd');
            if (!qn || contestInd === -1) return new P({ val: {} });
            
            return doss.$doRequest({
              address: [ 'storySet', qn, 'contestSet', contestInd, 'writeSet' ],
              command: 'getRawData'
            });
            
          },
          updateMs: 3000
        }),
        
        // The address of the write currently voted on
        currentVote: new uf.CalculatedInfo({ getFunc: function() {
          
          // TODO: This is called very repetitively :(
          
          var writeSet = infoSet.getValue('currentStory.currentWriteSet');
          
          var vote = '';
          for (var writeUser in writeSet) {
            
            var write = writeSet[writeUser];
            for (var voteUser in write.voteSet) {
              
              if (voteUser === infoSet.getValue('username')) {
                vote = '~root.storySet.' + infoSet.getValue('currentStory.quickName') + '.writeSet.' + writeUser + '.voteSet.' + voteUser;
                break;
              }
              
            }
            
            if (vote) break;
            
          }
          
          return vote;
          
        }}),
        
        // The writes that have won their way into the story
        writeSet: new uf.RepeatingSyncedInfo({
          initialValue: {},
          $getFunc: function() {
            
            var qn = infoSet.getValue('currentStory.quickName');
            if (!qn) return new P({ val: {} });
            
            // Select the descriptive fields from every story
            return doss.$doRequest({
              address: [ 'storySet', qn, 'writeSet' ],
              command: 'getChildNames'
            }).then(function(writeSet) {
              
              return new P({ all: writeSet.toObj().map(function(writeName) {
                
                return doss.$doRequest({
                  address: [ 'storySet', infoSet.getValue('currentStory.quickName'), 'writeSet', '@' + writeName ],
                  command: 'getRawPickedFields',
                  params: {
                    fields: [ 'user', 'content' ]
                  }
                });
                
              })});
              
            });
            
          },
          updateMs: 5000
        }),
                  
        phase: new uf.RepeatingSyncedInfo({
          initialValue: '',
          $setFunc: function(value) { return p.$null; },
          $getFunc: function() {
            
            var qn = infoSet.getValue('currentStory.quickName');
            if (!qn) return new P({ val: '' });
            
            return doss.$doRequest({
              address: [ 'storySet', qn, 'phase' ],
              command: 'getRawData'
            });
            
          },
          updateMs: 3000
        }),
        timePhaseStarted: new uf.RepeatingSyncedInfo({
          intialValue: 0,
          $setFunc: function() { return p.$null; },
          $getFunc: function() {
            
            var qn = infoSet.getValue('currentStory.quickName');
            if (!qn) return new P({ val: 0 });
            
            return doss.$doRequest({
              address: [ 'storySet', qn, 'timePhaseStarted' ],
              command: 'getRawData'
            });
            
          },
          updateMs: 3000
        }),
        writingTime: new uf.SimpleInfo({ value: 0 }),
        votingTime: new uf.SimpleInfo({ value: 0 }),
        timeEnd: new uf.CalculatedInfo({ getFunc: function() {
          
          var story = infoSet.getChild('currentStory');
          var phase = story.getValue('phase');
          
          if (phase === 'writing') {
            
            return story.getValue('timePhaseStarted') + story.getValue('writingTime');
            
          } else if (phase === 'voting') {
            
            return story.getValue('timePhaseStarted') + story.getValue('votingTime');
            
          } else {
            
            return Number.POSITIVE_INFINITY;
            
          }
          
        }})
        
      }}));
      infoSet.getChild('currentStory.currentContest').addListener(infoSet.getChild('currentStory.contestInd'));
      infoSet.addChild('currentWrite', new uf.SimpleInfo({ value: '' }));
      infoSet.start();
      
      var rootView = new uf.RootView({ name: 'root', children: [
        
        new uf.ChoiceView({ name: 'login', choiceInfo: function() { return infoSet.getValue('token') ? 'loggedIn' : 'loggedOut' }, children: [
          
          new uf.SetView({ name: 'loggedOut', children: [
            
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
              });
            }})
            
          ]}),
          new uf.SetView({ name: 'loggedIn', children: [
            
            new uf.ChoiceView({ name: 'chooseStory', choiceInfo: function() { return infoSet.getValue('currentStory.quickName') ? 'story' : 'lobby'; }, children: [
              
              new uf.SetView({ name: 'lobby', children: [
                
                new uf.DynamicSetView({ name: 'storySet',
                  childInfo: new uf.RepeatingSyncedInfo({
                    initialValue: [],
                    $getFunc: function() {
                      
                      // Select the descriptive fields from every story
                      return doss.$doRequest({ address: 'storySet', command: 'getChildNames' }).then(function(storyNames) {
                        
                        return new P({ all: storyNames.toObj().map(function(childName) {
                          
                          console.log('USERNAME:', infoSet.getValue('username'));
                          
                          return doss.$doRequest({
                            address: [ 'storySet', childName ],
                            command: 'getPickedFields',
                            params: {
                              fields: [
                                '(user) @user',
                                'createdTime',
                                'quickName',
                                'description',
                                'contestInd',
                                'contestLimit',
                                '(author) authorSet.' + infoSet.getValue('username'),
                                'phase',
                                'timePhaseStarted',
                                'writingTime',
                                'votingTime'
                              ]
                            }
                          });
                          
                        })});
                        
                      });
                      
                    },
                    updateMs: 5000
                  }),
                  decorators: [],
                  genChildView: function(name, info) {
                    
                    return new uf.SetView({ name: name, children: [
                      
                      new uf.TextView({ name: 'quickName', info: info.quickName }),
                      new uf.TextView({ name: 'description', info: info.description }),
                      new uf.TextView({ name: 'user', info: info.user.fname + ' ' + info.user.lname + ' (' + info.user.username + ')' }),
                      new uf.SetView({ name: 'age', children: [
                        new uf.TextView({ name: 0, info: 'Begun' }),
                        new cr.ClockView({ name: 1,
                          info: function() { return U.timeMs() - info.createdTime; },
                          format: 'string',
                          components: cr.timeComponentData.slice(1)
                        }),
                        new uf.TextView({ name: 2, info: 'ago' })
                      ]}),
                      
                      new uf.ChoiceView({ name: 'authored', choiceInfo: function() { return info.author ? 'yes' : 'no' }, children: [
                        
                        new uf.ActionView({ name: 'no', textInfo: 'Become an Author', $action: function() {
                          
                          return p.$null;
                          
                        }}),
                        new uf.ActionView({ name: 'yes', textInfo: 'Select', $action: function() {
                          
                          infoSet.getChild('currentStory').setValue(info);
                          console.log(infoSet.valueOf());
                          return p.$null;
                          
                        }})
                        
                      ]})
                      
                    ]});
                    
                  }
                })
                
              ]}),
              new uf.SetView({ name: 'story', children: [
                
                new uf.SetView({ name: 'header', children: [
                  
                  new uf.ActionView({ name: 'back', textInfo: 'Back', $action: function() {
                    
                    infoSet.setValue('currentStory.quickName', '');
                    return p.$null;
                    
                  }}),
                  new uf.TextView({ name: 'title', info: infoSet.getChild('currentStory.quickName') }),
                  new uf.TextView({ name: 'phase', info: infoSet.getChild('currentStory.phase') }),
                  new cr.ClockView({ name: 'timeRemaining',
                    info: function() { return infoSet.getChild('currentStory.timeEnd') - U.timeMs(); },
                    format: 'digital',
                    components: cr.timeComponentData.slice(0, 3)
                  })
                  
                ]}),
                new uf.DynamicSetView({ name: 'writeSet',
                  childInfo: function() {
                    var writeSet = infoSet.getValue('currentStory.writeSet');
                    
                    var currentWrite = infoSet.getValue('currentWrite');
                    if (!currentWrite) return writeSet;
                    
                    var ret = writeSet.clone();
                    ret['preview' + Math.abs(currentWrite.hash())] = {
                      content: currentWrite,
                      user: '~root.userSet.' + infoSet.getValue('username')
                    };
                    
                    return ret;
                    
                  },
                  decorators: [],
                  genChildView: function(name, info) {
                    
                    var userPcs = info.user.split('.');
                    var username = userPcs[userPcs.length - 1];
                    
                    return new uf.SetView({ name: name, cssClasses: [ 'write' ], children: [
                      new uf.TextView({ name: 'content', info: info.content }),
                      new uf.TextView({ name: 'user', info: username })
                    ]});
                    
                  }
                }),
                new uf.ChoiceView({ name: 'writeOrVote',
                  choiceInfo: function() {
                    var phase = infoSet.getValue('currentStory.phase');
                    
                    if ([ 'awaitingWrite', 'writing' ].contains(phase)) {
                      
                      // Even if the phase is currently writing, a user who submitted should vote instead
                      if (infoSet.getValue('username') in infoSet.getValue('currentStory.currentWriteSet'))
                        return 'vote';
                      
                      return 'write';
                      
                    }
                    
                    else if ([ 'awaitingVote', 'voting' ].contains(phase)) {
                      
                      return 'vote';
                      
                    }
                    
                    throw new Error('Invalid phase: "' + phase + '"');
                  },
                  children: [
                    
                    new uf.SetView({ name: 'write', children: [
                      
                      new uf.TextEditView({ name: 'editor', textInfo: infoSet.getChild('currentWrite'), multiline: true, placeholderData: 'Next line of the story...' }),
                      new uf.ActionView({ name: 'submit', textInfo: 'Submit', $action: function() {
                        
                        return doss.$doRequest({
                          address: [
                            'storySet', infoSet.getValue('currentStory.quickName'),
                            'contestSet', infoSet.getValue('currentStory.contestInd'),
                            'writeSet'
                          ],
                          command: 'addData',
                          params: {
                            returnType: 'raw',
                            data: {
                              username: infoSet.getValue('username'),
                              content: infoSet.getValue('currentWrite')
                            }
                          }
                        }).then(function(rawData) {
                          
                          infoSet.getChild('currentStory.currentWriteSet').modValue(function(val) {
                            val[infoSet.getValue('username')] = rawData;
                            return val;
                          });
                          infoSet.setValue('currentWrite', '');
                          return rawData;
                          
                        });
                        
                      }})
                      
                    ]}),
                    new uf.SetView({ name: 'vote', children: [
                      
                      new uf.TextView({ name: 'title', info: 'Vote:' }),
                      new uf.DynamicSetView({ name: 'contenders',
                        childInfo: infoSet.getChild('currentStory.currentWriteSet'),
                        genChildView: function(name, writeInfo) {
                          
                          var writeUserPcs = writeInfo.user.split('.');
                          var writeUsername = writeUserPcs[writeUserPcs.length - 1];
                          
                          return new uf.SetView({ name: name, children: [
                            
                            new uf.TextView({ name: 'content', info: writeInfo.content }),
                            new uf.TextView({ name: 'user', info: writeUsername }),
                            new uf.DynamicSetView({ name: 'votes',
                              childInfo: new uf.RepeatingSyncedInfo({
                                intialValue: {},
                                $getFunc: function() {
                                  
                                  return doss.$doRequest({
                                    address: [
                                      'storySet', infoSet.getValue('currentStory.quickName'),
                                      'contestSet', infoSet.getValue('currentStory.contestInd'),
                                      'writeSet', writeUsername,
                                      'voteSet'
                                    ],
                                    command: 'getRawData'
                                  });
                                  
                                },
                                updateMs: 4000
                              }),
                              genChildView: function(name, voteInfo) {
                                
                                var voteUserPcs = voteInfo.user.split('.');
                                var voteUsername = voteUserPcs[voteUserPcs.length - 1];
                                
                                return new uf.TextView({ name: name, info: JSON.stringify(voteInfo) });
                                
                              }
                            }),
                            new uf.ChoiceView({ name: 'votable',
                              choiceInfo: function() {
                                return infoSet.getValue('currentStory.currentVote') ? null : 'vote';
                              },
                              children: [
                                new uf.ActionView({ name: 'vote', textInfo: 'Select', $action: function() {
                                  
                                  var voteSetAddr =
                                    '~root.storySet.' + infoSet.getValue('currentStory.quickName') +
                                    '.contestSet.' + infoSet.getValue('currentStory.contestInd') +
                                    '.writeSet.' + writeUsername + '.voteSet';
                                  
                                  return doss.$doRequest({
                                    address: voteSetAddr,
                                    command: 'addData',
                                    params: {
                                      returnType: 'raw',
                                      data: {
                                        username: infoSet.getValue('username'),
                                        value: 1
                                      }
                                    }
                                  }).then(function(voteData) {
                                    
                                    infoSet.getChild('currentStory.currentWriteSet').modValue(function(val) {
                                      val[writeUsername].voteSet[infoSet.getValue('username')] = voteData;
                                      return val;
                                    });
                                    
                                  });
                                  
                                }})
                              ]
                            })
                            
                          ]});
                          
                        }
                      })
                      
                    ]})
                    
                  ]
                })
                
              ]})
              
            ]})
            
          ]})
          
        ]}),
        new uf.TextView({ name: 'version', info: infoSet.getChild('appVersion') }),
        new uf.TextView({ name: 'rps', info: function() { return 'update: ' + rootView.updateTimingInfo + 'ms' } })
        
      ]});
      rootView.start();
      
      window.infoSet = infoSet;
      window.doss = doss;
      
      // Testing:
      infoSet.setValue('username', 'admin');
      infoSet.setValue('password', 'admin123');
      doss.$doRequest({ command: 'getToken', params: {
        username: infoSet.getValue('username'),
        password: infoSet.getValue('password')
      }}).then(function(data) {
        infoSet.setValue('token', data.token);
      });
      
    })()]]);
    
  }
});
package.build();
