var package = new PACK.pack.Package({ name: 'creativity',
  dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
  buildFunc: function(packageName, qd, uf, p, qr) {
    
    var P = p.P;
    
    var cr = {
      
      resources: { css: [ 'apps/creativity/style.css', 'apps/userify/style.css' ] },
      
      Creativity: U.makeClass({ name: 'Creativity',
        superclass: qd.DossierDict,
        methods: function(sc, c) { return {
          $handleQuery: function(params /* command */) {
            var command = U.param(params, 'command');
            
            if (command.length < 2) throw new Error('Invalid command: "' + command + '"');
            
            var funcName = '$handle' + command[0].toUpperCase() + command.substr(1) + 'Query';
            
            console.log('HANDLING', funcName);
            
            if (funcName in this)
              return this[funcName](U.param(params, 'params', {}));
            
            return sc.$handleQuery.call(this, params);
          },
          $handleGetTokenQuery: function(params /* username, password */) {
            
            var username = U.param(params, 'username');
            var password = U.param(params, 'password');
            
            var user = this.getChild([ 'userSet', username ]);
            if (!user) throw new Error('Invalid username: "' + username + '"');
            if (user.getChildValue('password') !== password) throw new Error('Invalid password');
            
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
        
        var phase = story.getChildValue('phase');
        var numAuthors = story.getChild('authorSet').length;
        var currentContest = story.getChild([ 'contestSet', story.getChildValue('contestInd') ]);
        
        if (numAuthors === 0) return p.$null;
        
        if (phase === 'awaitingWrite') {
          
          return p.$null;
          
        } else if (phase === 'writing') {
          
          // Writing ends when time is up, or when the max number of writes have occurred
          
          var phaseEndTime = story.getChildValue('timePhaseStarted') + story.getChildValue('writingTime');
          var maxWrites = story.getChildValue('maxWrites') || numAuthors;
          var numEntries = currentContest.getChild('writeSet').length;
          
          if (currentTime > phaseEndTime) {
            
            console.log('RESOLVING WRITING on "' + story.name + '" because time is up');
            return cr.$resolveStoryWritePhase(story);
            
          } else if (numEntries >= maxWrites) {
            
            console.log('RESOLVING WRITING on "' + story.name + '" because max entries received');
            return cr.$resolveStoryWritePhase(story);
            
          } else {
            
            console.log('Story "' + story.name + '" WRITING continues...');
            
          }
          
        } else if (phase === 'awaitingVote') {
          
          return p.$null;
          
        } else if (phase === 'voting') {
          
          var phaseEndTime = story.getChildValue('timePhaseStarted') + story.getChildValue('votingTime');
          
          var maxVotes = story.getChildValue('maxVotes') || numAuthors;
          var votes = currentContest.getChild('writeSet').map(function(write) { // TODO: Does `DossierSet.prototype.map` work??
            
            var votesForLine = 0;
            var voteSet = write.getChild('voteSet');
            for (var k in voteSet.children) votesForLine += voteSet.getChildValue([ k, 'value' ]);
            
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
            
          }
          
        }
        
        throw new Error('Invalid phase: "' + phase + '"');
        
      },
      $resolveStoryWritePhase: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        var editor = new qd.Editor();
        return editor.$editFast({
          doss: story,
          data: {
            phase: 'voting',
            timePhaseStarted: currentTime
          }
        });
        
      },
      $resolveStoryVotePhase: function(story, currentTime) {
        
        if (!currentTime) currentTime = U.timeMs();
        
        var editor = new qd.Editor();
        var currentContest = story.getChild([ 'contestSet', story.getChildValue('contestInd') ]);
        
        if (currentContest.getChild('writeSet').length) {
          
          var writeStandard = 0;
          var bestWrites = [];
          var writes = currentContest.getChild('writeSet').children;
          for (var k in writes) {
            
            var write = writes[k];
            var numVotes = 0;
            
            var votes = write.getChild('voteSet').children;
            for (var kk in votes) numVotes += votes[kk].getChildValue('value');
            
            if (numVotes === writeStandard) {
              bestWrites.push(write);
            } else if (numVotes > writeStandard) {
              writeStandard = numVotes;
              bestWrites = [ write ]; // Add `write` as the ONLY currently contending option
            }
            
          }
          
          var winningLine = U.randElem(bestWrites); // Decide on a winner amongst the highest-voted
          
          var $promise = p.$null.then(function() { // Compile the winning write into the story
            
            return editor.$addFast({
              doss: story.getChild('writeSet'),
              data: winningLine
            })
          
          }).then(function() {                    // Increment the contest index counter
            
            return editor.$modFast({
              doss: story,
              data: {
                contestInd: story.getChildValue('contestInd') + 1
              }
            });
            
          }).then(function() {                    // Add on a new empty contest
            
            return editor.$addFast({
              doss: story.getChild('contestSet'),
              data: {
                num: story.getChildValue('contestInd'),
                writeSet: {}
              }
            });
            
          });
          
        } else {
          
          var $promise = p.$null;
          
        }
        
        return $promise.then(function() {
          
          editor.$modFast({
            doss: story,
            data: {
              phase: 'writing',
              timePhaseStarted: currentTime
            }
          });
          
        });
        
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
                nameFunc: function(par, child) { return child.getChildValue('username'); }
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
                            nameFunc: function(par, child) { return child.getChild('@user').name; }
                          }}
                        ]},
                        nameFunc: function(par, child) { return child.getChild('@user').name; }
                      }}
                    ]},
                    nameFunc: function(par, child) { return child.getChildValue('num'); }
                  }},
                  
                  { c: qd.DossierList,    p: { name: 'writeSet',
                    innerOutline: { c: qd.DossierRef, p: { baseAddress: '~par.~par.contestSet' } }
                  }}
                  
                ]},
                nameFunc: function(par, child) { return child.getChildValue('quickName'); },
                verifyAndSantizeData: function(child, params) {
                  
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
              
              return doss.getChild('storySet').$handleQuery({
                command: 'addData',
                params: {
                  data: {
                    username: 'admin',
                    quickName: 'firstStory',
                    description: 'First story!!',
                    authorLimit: 10,
                    writingTime: 1000 * 60 * 60 * 12, // 12 hours
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
      
    };
    
    return cr;
    
  },
  runAfter: function(cr, qd, uf, p, qr) {
    
    var beginServer = cr.versioner.$getDoss().then(function(doss) {
      
      cr.queryHandler = doss;
      setInterval(function() { cr.$updateCreativity(doss).done(); }, 5000);
      console.log('App ready...');
      
    }).done();
    
    var beginClient = {};
    
  }
});
package.build();
