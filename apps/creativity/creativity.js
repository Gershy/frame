/// {REMOVE=
/*
- Many of the sets in this app only ever increase in size, and never re-index anything.
  - These sets shouldn't be constantly getting requested; instead the size should be
    constantly requested, and when the size changes the entire set can be requested
- Writing devices as ability names (e.g. "hyperbolize" instead of "slam")

TASKS:
[ ] Finish anonymization
[ ] Use `Outline` to speed up userification
[ ] `ContentSyncSet` should have the best of both worlds!!
  [ ] 1 - doesn't emit requests until remote doss is initialized
  [ ] 2 - modifies local data as soon as possible
[X] Decide if naming root Dossier "~root" is appropriate
  [X] If it is, handle this naming properly (the regex shouldn't accept "~")
[ ] Improved content control
  [ ] `PACK.dossier.ContentSync*` classes should accept any "selection" parameter as either a function or an Info object
  [ ] Extend selection syntax. 
    [ ] skip and limit
    [ ] filtering (`PACK.dossier.FilterResults` needs refactoring)
[ ] Interactive elements try to perform actions using `Content` instances which don't yet exist...
      (Note: this could be an indication of a bigger, underlying design flaw??)
      INTERIM SOLUTION: Manually detect unloaded `Dossier` instances, and disable controls appropriately with `Decorator`s
[X] Form validation
  [X] Login
  [X] Story creation
  [ ] Story editing
  [ ] Profile editing
[ ] Decouple `Editor` from `Dossier`
[ ] The scheduling functionality of `PACK.dossier.ContentAbstractSync` should be implemented separately in a `Scheduler` class
      (and `PACK.dossier.ContentAbstractSync` given a "scheduler" property or something of the sort)
      (Or maybe scheduling isn't needed at all, and all we need are sockets/long-polling??)
[ ] Need to add lots of `changeHandler` methods for better responsiveness
      (E.g. upon contest completion, the timer resets to "--:--:--" much more quickly than the voting pane is replaced with a writing pane)
[ ] LOTS OF ACTION VALIDATION
  [ ] Voting on an expired contest
  [ ] Submitting writes on an expired story
  [ ] User account creation
[ ] Is the per-frame loop necessary? Can all changes be processed via `changeHandler`s?
[ ] Files should be cacheable in development mode! Currently suffixes change and everything is invalidated upon restart
[ ] Make sure there are no hard-coded strings in userify or quickdev
[ ] Compiling for all files
[ ] Mapping by line AND character index will allow better compilation (compact files into a single line)
[ ] Mapping raw file names to compiled files
[ ] Some day, need to keep track of reverse-references (to ensure data cannot be made unintegrous)
*/

/* TODO: Advanced selection: 

{
  type: 'selectAll',
  innerSelector: {
  
    type: 'selectVal',
    maxBytes: 100
    
  }
}


{
  type: 'selectWhite',
  innerSelectors: {
    
    user: {
      type: 'selectVal',
      maxBytes: 100
    },
    
    createdTime: {
      type: 'selectVal',
      maxBytes: 100
    },
    
    contestSet: {
      type: 'selectSingle',
      
      name: { type: 'refVal', address: '~queryRoot.contest.currentContest' }, // This is fancy!!
      innerSelector: {
        type: 'selectSingle',
        
        name: 'num',
        innerSelector: {
          type: 'selectVal',
          maxBytes: 100
        }
        
      }
      
    },
    
    writeSet: {
      type: 'selectRange',
      offset: 10,
      limit: 10,
      
      innerSelector: {
        type: 'selectSingle',
        
        name: '@content' // TODO: Reference the content, etc. (should references be follow-able??)
        ....
        
      }
    }
  
  
  }
}

*/
        
/// =REMOVE}
var FILLSTORY = true;
var LOADSTATE = true;

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
          if (U.valid(min) && n < min) throw new Error(name + ' (' + n + ') is too small');
          if (U.valid(max) && n > max) throw new Error(name + ' (' + n + ') is too large');
          return n;
        },
        intBool: function(name, n, min, max) {
          if (n === null) return null;
          
          if (!U.isObj(n, Number) || parseInt(n) !== n) throw new Error(name + ' (' + n + ') is non-intBool');
          if (U.valid(min) && n < min && n !== 0) throw new Error(name + ' (' + n + ') is too small');
          if (U.valid(max) && n > max && n !== 0) throw new Error(name + ' (' + n + ') is too large');
          
          return n || null;
        },
        string: function(name, str, min, max, re) {
          if (!U.isObj(str, String)) throw new Error(name + ' is non-string');
          if (U.valid(min) && str.length < min) throw new Error(name + ' is too small');
          if (U.valid(max) && str.length > max) throw new Error(name + ' is too large');
          if (U.valid(re) && !re.test(str)) throw new Error(name + ' is of invalid format');
          
          return str;
        },
        boolean: function(name, b) {
          if (!U.isObj(b, Boolean)) throw new Error(name + ' is non-boolean');
          return b;
        }
      },
      
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
            
          }
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
            return cr.getToken(this.getValue('username'), this.getValue('password'));
          }
          /// =SERVER}
        };}
      }),
      
      /// {SERVER=
      getToken: function(str1, str2) {
        var str = '';
        var val = 9;
        var chars = '0ab45cd21ef58gh02ij0klm0no23p9qr62stu92vwxyz5AB8C0D37EF5GH7I4JKL2M4NO4PQR6ST8U39VW9998XYZ';
        
        for (var i = 0; i < 12; i++) {
          var v1 = str1[(val + 19) % str1.length].charCodeAt(0);
          var v2 = str2[((val * val) + 874987) % str2.length].charCodeAt(0);
          val = ((v1 + 3) * (v2 + 11) * 11239) + 3 + i + v1;
          str += chars[val % chars.length];
        }
        
        return str;
      },
      resources: {
        css: [
          'apps/userify/style.css',
          'apps/creativity/style.css'
        ]
      },
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
          
          var best = orderedVotes.length > 0 ? orderedVotes[0] : 0;
          var nextBest = 0; // `nextBest` is the next value NOT EQUAL to `best`, or `best` if there are no other lesser values
          if (orderedVotes.length > 1) {
            nextBest = best;
            for (var i = 0; i < orderedVotes.length; i++) {
              // This will find the first value smaller than `best`
              if (orderedVotes[i] < best) { nextBest = orderedVotes[i]; break; }
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
          
          var writes = currentContest.getChild('writeSet').children;
          
          var trackWrites = [];
          var bestVotes = 0;
          for (var k in writes) {
            
            var write = writes[k];
            var votes = write.getChild('voteSet').children;
            var numVotes = 0;
            for (var kk in votes) numVotes += votes[kk].getValue('value');
            
            trackWrites.push({
              write: writes[k],
              numVotes: numVotes
            });
            
            if (numVotes > bestVotes) bestVotes = numVotes;
            
          }
          
          var winningWrite = U.randElem(trackWrites.map(function(writeVotes) {
            return writeVotes.numVotes >= bestVotes ? writeVotes.write : U.SKIP;
          }));
          
          var nextContestInd = story.getValue('contestInd') + 1;
          
          editor.edit({
            
            mod: [
              // Increment the contest index counter
              { doss: story, data: { contestInd: nextContestInd } }
            ],
            
            add: [
              // Add on a new empty contest
              { par: story.getChild('contestSet'), data: { num: nextContestInd, writeSet: {} } },
              
              // Compile the winning write into the story
              { par: story.getChild('writeSet'), data: winningWrite }
            ]
            
          });
          
        }
        
        editor.mod({ doss: story,
          data: {
            phase: 'awaitingWrite',
            timePhaseStarted: currentTime
          }
        });
        return editor.$transact();
        
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
    
    // TODO: Recreate the outline using `abl` instead of `ds.abilities`!!
    var abl = ds.abilities;
    
    // ~root
    var outline = new ds.Outline({ name: 'creativity', c: cr.Creativity, });
    outline.addChild('version', ds.DossierStr, {
      /// {CLIENT=
      contentFunc: function(doss) {
        return new ds.ContentSync({ doss: doss, syncOnStart: true });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({})
      }
    });
    /// {CLIENT=
    outline.addChild('username', ds.DossierStr);
    outline.addChild('password', ds.DossierStr);
    outline.addChild('token', ds.DossierStr, {
      changeHandler: function(doss) {
        doss.getChild('~root.user').content.update();
      }
    });
    outline.addChild('user', ds.DossierRef, {
      template: '~root.userSet.$username',
      contentFunc: function(doss) {
        return new ds.ContentSyncRef({ doss: doss, syncOnStart: true,
          selection: ds.selectAll,
          calcRef: function() {
            return doss.getChild('~root.token').value
              ? [ doss.getChild('~root.username').value ]
              : null;
          }
        });
      }
    });
    outline.addChild('loginError', ds.DossierStr);
    outline.addChild('currentWrite', ds.DossierStr);
    outline.addChild('currentStory', ds.DossierRef, { template: '~root.storySet.$quickName',
      contentFunc: function(doss) {
        return new ds.ContentSyncRef({ doss: doss, syncOnStart: true });
      }
    });
    outline.addChild('isEditingStory', ds.DossierBln, {
      value: false
    });
    
    // ~root.editStory
    var editStory = outline.addChild('editStory', ds.DossierObj);
    editStory.addChild('error', ds.DossierStr);
    editStory.addChild('story', ds.DossierRef, { template: '~root.storySet.$quickName' });
    editStory.addChild('quickName', ds.DossierStr);
    editStory.addChild('description', ds.DossierStr);
    editStory.addChild('authorLimit', ds.DossierStr);
    editStory.addChild('maxWrites', ds.DossierStr);
    editStory.addChild('maxVotes', ds.DossierStr);
    editStory.addChild('maxWriteLength', ds.DossierStr);
    editStory.addChild('contestLimit', ds.DossierStr);
    editStory.addChild('contestTime', ds.DossierInt); // TODO: For form consistency, should be a string?
    editStory.addChild('slapLoadTime', ds.DossierStr);
    editStory.addChild('slamLoadTime', ds.DossierStr);
    editStory.addChild('anonymizeWriter', ds.DossierBln);
    editStory.addChild('anonymizeVoter', ds.DossierBln);
    /// =CLIENT}
    
    // ~root.userSet
    var userSet = outline.addChild('userSet', ds.DossierArr, {
      /// {CLIENT=
      contentFunc: function(doss) {
        return new ds.ContentSyncSet({ doss: doss, syncOnStart: false, selection: ds.selectAll })
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({}),
        add: new ds.AbilityAdd({
          validate: function(editor, doss, below, params) {
            
            var data = U.param(params, 'data');
            return params.update({
              data: {
                username: U.param(data, 'username'),
                password: U.param(data, 'password'),
                fname: U.param(data, 'fname', 'Anonymous'),
                lname: U.param(data, 'lname', 'Individual')
              }
            });
            
          },
          decorate: function(newUser, editor) {
            
            return editor.$transaction.then(function() {
              return {
                /// {SERVER=
                token: newUser.getToken(),
                /// =SERVER}
                address: newUser.getAddress()
              };
            });
            
          }
        })
      }
    });
    var user = userSet.addDynamicChild('user', cr.CreativityUser, {
      nameFunc: function(userSet, user) {
        return user.getValue('username');
      },
      abilities: {
        get: new ds.AbilityGet({ par: userSet.getAbility('get') }),
        mod: new ds.AbilityMod({ par: userSet.getAbility('add'),
          validateBelow: function(editor, doss, below, params /* */) {
            
            /// {SERVER=
            if (doss.started) {
              // Don't check the token for uninitiated users; they're in the middle of being added
              var token = U.param(params, 'token');
              if (token !== user.getToken()) throw new Error('Couldn\'t authenticate');
            }
            /// =SERVER}
            
            return { verifiedUser: user };
            
          }
        })
      }
    });
    user.addChild('username', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: user.getAbility('get') }),
        mod: new ds.AbilityMod({ par: user.getAbility('mod'),
          validate: function(editor, doss, below, params) {
            cr.validate.string('user.username', U.param(params, 'data'), 3, 24, /^[a-zA-Z][a-zA-Z0-9]*$/);
            return params;
          }
        })
      }
    });
    user.addChild('password', ds.DossierStr, {
      abilities: {
        mod: new ds.AbilityMod({ par: user.getAbility('mod'),
          validate: function(editor, doss, below, params) {
            
            var str = U.param(params, 'data');
            cr.validate.string('user.password', str, 6, 24);
            return params.clone({ data: str });
            
          }
        })
      }
    });
    user.addChild('fname', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: user.getAbility('get') }),
        mod: new ds.AbilityMod({ par: user.getAbility('mod'),
          validate: function(editor, doss, below, params) {
            
            var str = U.param(params, 'data');
            if (!str.length) throw new Error('user.fname cannot be empty');
            str = str[0].toUpperCase() + str.substr(1);
            
            cr.validate.string('user.fname', str, 2, 30, /^[A-Z][a-zA-Z]*$/);
            
            return params.clone({ data: str });
            
          }
        })
      }
    });
    user.addChild('lname', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: user.getAbility('get') }),
        mod: new ds.AbilityMod({ par: user.getAbility('mod'),
          validate: function(editor, doss, below, params) {
            
            var str = U.param(params, 'data');
            if (!str.length) throw new Error('user.lname cannot be empty');
            str = str[0].toUpperCase() + str.substr(1);
            
            cr.validate.string('user.lname', str, 2, 30, /^[A-Z][a-zA-Z]*$/);
            
            return params.clone({ data: str });
            
          }
        })
      }
    });
    
    // ~root.storySet
    var storySet = outline.addChild('storySet', ds.DossierArr, {
      /// {CLIENT=
      contentFunc: function(doss) {
        console.log('CONTENTFUNC???');
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
      abilities: {
        get: new ds.AbilityGet({}),
        add: new ds.AbilityAdd({
          validateBelow: function(editor, doss, below, params /* username, token */) {
            
            var username = U.param(params, 'username');
            var user = doss.getChild([ '~root', 'userSet', username ]);
            if (!user) throw new Error('Could\'t find user "' + username + '"');
            
            /// {SERVER=
            var token = U.param(params, 'token');
            if (token !== user.getToken()) throw new Error('Couldn\'t authenticate');
            /// =SERVER}
            
            return { verifiedUser: user };
            
          },
          validate: function(editor, doss, below, params /* data */) {
            
            var user = below.verifiedUser;
            var currentTime = U.timeMs();
            
            // TODO: Limit the number of stories a user can create?
            
            var data = U.param(params, 'data');
            var sanitizedData = {
              user: user,
              createdTime: currentTime,
              quickName: U.param(data, 'quickName'),
              description: U.param(data, 'description'),
              authorLimit: U.param(data, 'authorLimit'),
              contestTime: U.param(data, 'contestTime'),
              maxWrites: U.param(data, 'maxWrites'),
              maxVotes: U.param(data, 'maxVotes'),
              maxWriteLength: U.param(data, 'maxWriteLength'),
              contestLimit: U.param(data, 'contestLimit'),
              anonymizeWriter: U.param(data, 'anonymizeWriter'),
              anonymizeVoter: U.param(data, 'anonymizeVoter'),
              slapLoadTime: U.param(data, 'slapLoadTime'),
              slamLoadTime: U.param(data, 'slamLoadTime'),
              contestInd: 0,
              phase: 'awaitingWrite',
              timePhaseStarted: currentTime,
              authorSet: {},
              contestSet: {
                0: {
                  num: 0,
                  writeSet: {}
                }
              },
              writeSet: {}
            };
            sanitizedData.authorSet[user.name] = {
              user: user // NOTE: "authorSet" should be able to fill in the other values for an author record
            };
            
            return params.clone({ data: sanitizedData });
            
          },
          decorate: function(newStory, editor) {
            return editor.$transaction.then(function() {
              return { address: newStory.getAddress() };
            });
          }
        })
      }
    });
    var story = storySet.addDynamicChild('story', ds.DossierObj, {
      nameFunc: function(storySetDoss, storyDoss) {
        return storyDoss.getValue('quickName');
      },
      /// {CLIENT=
      contentFunc: function(doss) {
        return new ds.ContentSyncSet({ doss: doss, syncOnStart: true, selection: ds.selectAll, preserveKeys: [
          'isAuthored', 'userDisp', 'age', 'phaseTimeRemaining', 'currentContest'
        ]});
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: storySet.getAbility('get') }),
        mod: new ds.AbilityMod({ par: storySet.getAbility('add'),
          validateBelow: function(editor, doss, below, params) {
            
            return below.update({
              
              // Include a reference to the story
              story: doss,
              
              // Include a reference to the author, if it has been initialized (if this is a true "mod", and not an "add")
              verifiedAuthor: doss.started ? doss.getChild([ 'userSet', below.verifiedUser.getValue('username') ]) : null
              
            });
            
          },
          validate: function(editor, doss, below, params /* */) {
            
            var storyUser = doss.getChild('@user');
            if (storyUser && storyUser !== below.verifiedUser)
              throw new Error('No permission for user "' + below.verifiedUser + '" to modify story "' + doss.getValue('quickName') + '"');
            
            return params;
            
          }
        })
      }
    });
    story.addChild('user', ds.DossierRef, { template: '~root.userSet.$username',
      /// {CLIENT=
      contentFunc: function(doss) {
        return new ds.ContentSyncRef({ doss: doss, syncOnStart: true });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.user');
            return below;
          }
        })
      }
    });
    /// {CLIENT=
    story.addChild('isAuthored', ds.DossierBln, {
      contentFunc: function(doss) {
        return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
          var username = doss.getRoot().getValue('username');
          var story = doss.par;
          return story.children.authorSet.children.contains(username);
        }});
      }
    });
    story.addChild('userDisp', ds.DossierStr, {
      contentFunc: function(doss) {
        return new ds.ContentCalc({ doss: doss, cache: cr.updateOnFrame, func: function() {
          var userDoss = doss.par.getChild('@user');
          return userDoss
            ? userDoss.getValue('fname') + ' ' + userDoss.getValue('lname') + ' (' + userDoss.getValue('username') + ')'
            : '- loading -';
        }});
      }
    });
    story.addChild('age', ds.DossierInt, {
      contentFunc: function(ageDoss) {
        return new ds.ContentCalc({ doss: ageDoss, cache: cr.updateOnFrame, func: function() {
          return U.timeMs() - ageDoss.par.getValue('createdTime');
        }});
      }
    });
    story.addChild('phaseTimeRemaining', ds.DossierInt, {
      contentFunc: function(ptrDoss) {
        return new ds.ContentCalc({ doss: ptrDoss, cache: cr.updateOnFrame, func: function() {
          var storyDoss = ptrDoss.par;
          var phase = storyDoss.getValue('phase');
          
          if (phase !== 'writing') return Number.MAX_SAFE_INTEGER; // TODO: This is a weird null-signifier
          
          return storyDoss.getValue('timePhaseStarted') + storyDoss.getValue('contestTime') - U.timeMs();
        }});
      }
    });
    story.addChild('currentContest', ds.DossierRef, { template: '~par.contestSet.$contestInd',
      contentFunc: function(ccDoss) {
        return new ds.ContentSyncRef({ doss: ccDoss, syncOnStart: true, calcRef: function() {
          return [ ccDoss.par.getValue('contestInd') ];
        }});
      }
    });
    /// =CLIENT}
    story.addChild('createdTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.createdTime');
            return below;
          }
        })
      }
    });
    story.addChild('quickName', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.quickName');
            return below;
          }
        })
      }
    });
    story.addChild('description', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('authorLimit', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('contestTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('maxWrites', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('maxVotes', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('maxWriteLength', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('contestLimit', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('anonymizeWriter', ds.DossierBln, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('anonymizeVoter', ds.DossierBln, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('slapLoadTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('slamLoadTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod') })
      }
    });
    story.addChild('contestInd', ds.DossierInt, {
      /// {CLIENT=
      contentFunc: function(ciDoss) {
        return new ds.ContentSync({ doss: ciDoss, waitMs: 1000 });
      },
      changeHandler: function(ciDoss) {
        var storyDoss = ciDoss.par;
        storyDoss.getChild('currentContest').content.update();
        storyDoss.getChild('writeSet').content.update();
        storyDoss.getChild('phase').content.update();
        storyDoss.getChild('timePhaseStarted').content.update();
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.contestInd');
            return below;
          }
        })
      }
    });
    story.addChild('phase', ds.DossierStr, {
      /// {CLIENT=
      contentFunc: function(phaseDoss) {
        return new ds.ContentSync({ doss: phaseDoss, waitMs: 2000 });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.phase');
            return below;
          }
        })
      }
    });
    story.addChild('timePhaseStarted', ds.DossierInt, {
      /// {CLIENT=
      contentFunc: function(tpsDoss) {
        return new ds.ContentSync({ doss: tpsDoss, waitMs: 2000 });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: story.getAbility('get') }),
        mod: new ds.AbilityMod({ par: story.getAbility('mod'),
          validateBelow: function(editor, doss, below, params) {
            if (doss.started) throw new Error('Can\'t modify existing story.timePhaseStarted');
            return below;
          }
        })
      }
    });
    
    // ~root.storySet.story.authorSet
    var authorSet = story.addChild('authorSet', ds.DossierArr, {
      /// {CLIENT=
      contentFunc: function(doss) {
        return new ds.ContentSyncSet({ doss: doss, waitMs: 10000, syncOnStart: true, selection: ds.selectAll });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({}),
        add: new ds.AbilityAdd({ par: story.getAbility('mod'),
          validate: function(editor, doss, below, params /* username, token */) {
            
            var currentTime = U.timeMs();
            return {
              user: below.verifiedUser,
              numSlaps: 0,
              lastSlapTime: currentTime,
              numSlams: 0,
              lastSlamTime: currentTime
            };
            
          },
          decorate: function(newAuthor, editor) {
            return editor.$transaction.then(function() {
              return { address: newAuthor.getAddress() };
            });
          }
        })
      }
    });
    var author = authorSet.addDynamicChild('author', ds.DossierObj, {
      nameFunc: function(authorSetDoss, authorDoss) {
        return authorDoss.getChild('@user').name;
      },
      abilities: {
        get: new ds.AbilityGet({ par: authorSet.getAbility('get') }),
        mod: new ds.AbilityMod({ par: authorSet.getAbility('add'),
          validateBelow: function(editor, doss, below, params /* username, token */) {
            
            // NOTE: If non-add mods were allowed it would be important to verify that:
            // doss.getChild('@user') === below.verifiedUser
            //
            // Right now the only way the data can be modified is via an "add", and at
            // the moment of adding, `doss.getChild('@user')` is BY DEFINITION set to
            // `below.verifiedUser`.
            
            if (doss.started) throw new Error('Can\'t modify an existing author');
            return below;
            
          }
        })
      }
    });
    author.addChild('user', ds.DossierRef, { template: '~root.userSet.$username',
      /// {CLIENT=
      contentFunc: function(authorDoss) {
        return new ds.ContentSyncRef({ doss: authorDoss, syncOnStart: true, selection: ds.selectAll });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: author.getAbility('get') })
      }
    });
    author.addChild('numSlaps', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: author.getAbility('get') })
      }
    });
    author.addChild('lastSlapTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: author.getAbility('get') })
      }
    });
    author.addChild('numSlams', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: author.getAbility('get') })
      }
    });
    author.addChild('lastSlamTime', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: author.getAbility('get') })
      }
    });
    
    // HEEERE: Creating a story initializes it with ZERO contests!! There should initially be 1 contest D':
    
    // ~root.storySet.story.contestSet
    var contestSet = story.addChild('contestSet', ds.DossierArr, {
      abilities: {
        get: new ds.AbilityGet({})
      }
    });
    var contest = contestSet.addDynamicChild('contest', ds.DossierObj, {
      nameFunc: function(contestSetDoss, contestDoss) {
        return contestDoss.getValue('num');
      },
      abilities: {
        get: new ds.AbilityGet({ par: contestSet.getAbility('get') })
      }
    });
    /// {CLIENT=
    contest.addChild('currentWrite', ds.DossierRef, { template: '~par.writeSet.$username',
      contentFunc: function(cwDoss) {
        var org = cwDoss;
        return new ds.ContentCalc({ doss: cwDoss, cache: cr.updateOnFrame, func: function() {
          // Return `null` if no current write, otherwise return the write
          var contest = cwDoss.par;
          var username = cwDoss.getRoot().getValue('username');
          return username ? contest.getChild([ 'writeSet', username ]) : null;
        }});
      }
    });
    contest.addChild('currentVote', ds.DossierRef, { template: '~par.writeSet.$username.voteSet.$username',
      contentFunc: function(cvDoss) {
        return new ds.ContentCalc({ doss: cvDoss, cache: cr.updateOnFrame, func: function() {
          var username = cvDoss.getRoot().getValue('username');
          var contest = cvDoss.par;
          var writeSet = contest.children.writeSet.children;
          
          for (var k in writeSet) {
            var voteSet = writeSet[k].children.voteSet.children;
            for (var voteUsername in voteSet) if (voteUsername === username) return voteSet[voteUsername];
          }
          
          return null;
        }});
      }
    });
    /// =CLIENT}
    contest.addChild('num', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: contest.getAbility('get') })
      }
    });
    
    // ~root.storySet.story.contestSet.contest.writeSet
    var contestWriteSet = contest.addChild('writeSet', ds.DossierArr, {
      abilities: {
        get: new ds.AbilityGet({}),
        add: new ds.AbilityAdd({ par: story.getAbility('mod'),
          validate: function(editor, doss, below, params /* */) {
            // TODO: This should happen via a `Worry`
            editor.$transaction.then(cr.informWriteSubmitted.bind(null, doss.getNamedPar('story'))).done();
            return params;
          },
          decorate: function(newContestWrite, editor) {
            return editor.$transaction.then(function() {
              return { address: newContestWrite.getAddress() };
            });
          }
        })
      }
    });
    var contestWrite = contestWriteSet.addDynamicChild('write', ds.DossierObj, {
      nameFunc: function(writeSetDoss, writeDoss) {
        return writeDoss.getChild('@user').name;
      },
      abilities: {
        get: new ds.AbilityGet({ par: contestWriteSet.getAbility('get') }),
        mod: new ds.AbilityMod({ par: contestWriteSet.getAbility('add'),
          validateBelow: function(editor, doss, below, params) {
            
            if (doss.started) throw new Error('Can\'t modify an existing contestWrite');
            return below;
            
          },
          validate: function(editor, doss, below, params /* data */) {
            
            var author = below.verifiedAuthor;
            var data = U.param(params, 'data');
            var content = U.param(data, 'content');
            
            return params.clone({
              data: {
                author: author,
                content: content
              }
            });
            
          }
        })
      }
    });
    contestWrite.addChild('author', ds.DossierRef, { template: '~par(story).authorSet.$username', // TODO: SCHEMA CHANGE, formerly "user"
      abilities: {
        get: new ds.AbilityGet({ par: contestWrite.getAbility('get') }),
        mod: new ds.AbilityMod({ par: contestWrite.getAbility('mod') })
      }
    });
    /// {CLIENT=
    contestWrite.addChild('username', ds.DossierStr, {
      contentFunc: function(usernameDoss) {
        return new ds.ContentCalc({ doss: usernameDoss, cache: cr.updateOnFrame, func: function() {
          var story = usernameDoss.getChild('~par(story)');
          return story.getValue('anonymizeWriter') ? 'anon' : usernameDoss.name;
        }});
      }
    });
    /// =CLIENT}
    contestWrite.addChild('content', ds.DossierStr, {
      abilities: {
        get: new ds.AbilityGet({ par: contestWrite.getAbility('get') }),
        mod: new ds.AbilityMod({ par: contestWrite.getAbility('mod'),
          validate: function(editor, doss, below, params /* data */) {
            var data = U.param(params, 'data');
            var maxWriteLength = doss.getNamedPar('story').getValue('maxWriteLength');
            cr.validate.string('write.content', data, 1, maxWriteLength);
            return params; // Sanitize in any way?
          }
        })
      }
    });
    
    // ~root.storySet.story.contestSet.contest.writeSet.write.voteSet
    var voteSet = contestWrite.addChild('voteSet', ds.DossierArr, {
      /// {CLIENT=
      contentFunc: function(vsDoss) {
        return new ds.ContentSyncSet({ doss: vsDoss, waitMs: 2000, syncOnStart: true, selection: ds.selectAll });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({}),
        add: new ds.AbilityAdd({ par: story.getAbility('mod'),
          validate: function(editor, doss, below, params /* username, token, data */) {
            
            // NOTE: "validate" may be a misnomer. A "validate" function just provides
            // functionality in 4 ways:
            //  1) Cancelling the entire ability, by throwing an error
            //  2) Changing the parameters for the ability, by returning a modified value
            //  3) Contributing to the overall transaction using `editor` methods
            //  4) Reacting to transaction success using `editor.$transaction.then(...)`
            
            /// {SERVER=
            // TODO: Really vote-submission-informing should be done via a `Worry`
            editor.$transaction.then(cr.informVoteSubmitted.bind(null, below.story)).done();
            /// =SERVER}
            
            /* TODO: Verify that the author has enough vote-power remaining, and reduce vote power
            var data = U.param(params, 'data');
            var value = U.param(data, 'value');
            var author = below.verifiedAuthor;
            var votePower = author.getValue('votePower');
            if (votePower < value) throw new Error('Insufficient voting power');
            
            // Reducing voting power becomes part of the transaction:
            editor.mod({ doss: author, { votePower: votePower - value }); // TODO: Race conditions?
            */
            
            return params;

          },
          decorate: function(newVote, editor) {
            return editor.$transaction.then(function() {
              return { address: newVote.getAddress() };
            });
          }
        })
      }
    });
    var vote = voteSet.addDynamicChild('vote', ds.DossierObj, {
      nameFunc: function(voteSetDoss, voteDoss) {
        return voteDoss.getChild('@user').name;
      },
      abilities: {
        get: new ds.AbilityGet({ par: voteSet.getAbility('get') }),
        mod: new ds.AbilityMod({ par: voteSet.getAbility('add'),
          validateBelow: function(editor, doss, below, params /* username, token */) {
            
            // This "mod" ability only exists to facilitate voteSet's "add". Submitted votes cannot be modified
            if (doss.started) throw new Error('Can\'t modify an existing vote');
            return below;
            
          },
          validate: function(editor, doss, below, params /* username, token, data */) {
            
            var data = U.param(params, 'data');
            var value = U.param(data, 'value');
            
            var author = below.verifiedAuthor;
            if (!author) throw new Error('Author "' + params.username + '" doesn\'t exist');
            
            return params.clone({
              data: {
                author: author,
                value: value
              }
            });
            
          }
        })
      }
    });
    vote.addChild('author', ds.DossierRef, { template: '~par(story).authorSet.$username', // TODO: SCHEMA CHANGE, formerly "user"
      abilities: {
        get: new ds.AbilityGet({ par: vote.getAbility('get') }),
        mod: new ds.AbilityMod({ par: vote.getAbility('mod') })
      }
    });
    /// {CLIENT=
    vote.addChild('username', ds.DossierStr, {
      contentFunc: function(voteDoss) {
        return new ds.ContentCalc({ doss: voteDoss, cache: cr.updateOnFrame, func: function() {
          var story = voteDoss.getChild('~par(story)');
          return story.getValue('anonymizeVoter') ? 'anon' : voteDoss.getChild('@author').name;
        }});
      }
    });
    /// =CLIENT}
    vote.addChild('value', ds.DossierInt, {
      abilities: {
        get: new ds.AbilityGet({ par: vote.getAbility('get') }),
        mod: new ds.AbilityMod({ par: vote.getAbility('mod') })
      }
    });
    
    // ~root.storySet.story.writeSet.write
    var winWriteSet = story.addChild('writeSet', ds.DossierArr, {
      /// {CLIENT=
      contentFunc: function(wsDoss) {
        return new ds.ContentSyncSet({ doss: wsDoss, waitMs: 2000, syncOnStart: true, selection: ds.selectAll });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({})
      }
    });
    winWriteSet.addDynamicChild('write', ds.DossierRef, { template: '~par.~par.contestSet.$contestInd.writeSet.$username',
      nameFunc: null,
      /// {CLIENT=
      contentFunc: function(writeDoss) {
        return new ds.ContentSyncRef({ doss: writeDoss, syncOnStart: true, selection: ds.selectAll });
      },
      /// =CLIENT}
      abilities: {
        get: new ds.AbilityGet({ par: winWriteSet.getAbility('get') })
      }
    });
    
    var versioner = new ds.Versioner({ versions: [
      { name: 'initial',
        detect: function(prevVal) { return true; },
        $apply: function(prevVal) {
          
          return new P({ all: {
            outline: outline,
            /// {SERVER=
            data: LOADSTATE
              ? cr.persister.$init().then(function() { return cr.persister.$getData(); })
              : new P({ val: cr.persister.genDefaultData() }),
            /// =SERVER}
            /// {CLIENT=
            data: new P({ val: { version: 'Loading...' } }),
            /// =CLIENT}
            doss: null
          }});
          
        }
      },
      
      /// {SERVER= (run data migrations server-side)
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
      // { name: 'data 0.0.2 -> 0.0.3',
      //   detect: function(prevVal) { return prevVal.data.version.split(' ')[0] === '0.0.2'; },
      //   $apply: function(prevVal) {
      //     prevVal.data.version = '0.0.3 (edits)';
      //     return new P({ val: prevVal });
      //   }
      // },
      /// =SERVER}
      
      { name: 'generate doss',
        detect: function(prevVal) { return true; },
        $apply: function(prevVal) {
          var editor = new ds.Editor();
          var doss = editor.add({ outline: prevVal.outline, data: prevVal.data });
          return editor.$transact().then(function() { return doss; });
        }
      }
    ]});
    
    return cr.update({ versioner: versioner });
    
  },
  runAfter: function(cr, ds, p, uf) {
    
    var P = p.P;
    
    cr.versioner.$getDoss().then(function(doss) {
      console.log('Initialized!');
      U.debug(doss.getData());
      
      /// {SERVER=
      cr.queryHandler = doss;
      
      // TODO: Use a single timeout+inform-on-vote instead of this ugly interval loop?
      setInterval(function() { cr.$updateCreativity(doss).done(); }, 1000 * 1);
      setInterval(function() { cr.persister.$putData(doss.getData()).done(); }, 1000 * 10);
      /// =SERVER}
      
      /// {CLIENT=
      var spinnerHtml =
        '<div class="spin">' +
          U.range({0:20}).map(function(n) {
            var deg = Math.round((n / 20) * 360);
            var del = Math.round((n / 20) * 15000);
            return '<div class="arm" style="transform: rotate(' + deg + 'deg); animation-delay: -' + del + 'ms;"></div>';
          }).join('') +
        '</div>';
      
      // Build the view
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
                                
                                var user = doss.getChild('@user');
                                return info.getChild('authorSet').content.$syncedAbility('add', {
                                  token: user.getAddress(),
                                  data: {
                                    user: user.getAddress()
                                  }
                                }).then(function(result) { doss.setValue('currentStory', info); });
                                
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
                              return deref ? deref.getChild('@user').name : 'loading...';
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
                                
                                return doss.getChild('@currentStory.@currentContest.writeSet').content.$syncedAbility('add', {
                                  token: doss.getValue('token'),
                                  data: {
                                    user: doss.getChild('@user').getAddress(),
                                    content: doss.getValue('currentWrite')
                                  }
                                }).then(function() {
                                  // Clear the write if the action was successful
                                  doss.setValue('currentWrite', '');
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
                                var writeVoteSet = contest.getChild([ 'writeSet', writeUsername, 'voteSet' ]);
                                
                                return new uf.SetView({ name: name, cssClasses: [ 'contender' ],
                                  decorators: [
                                    new uf.ClassDecorator({
                                      list: [ 'selected' ],
                                      info: function() { return contest.getChild('@currentVote.~par(write)') === write ? 'selected' : null; }
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
                                            
                                            return writeVoteSet.content.$syncedAbility('add', {
                                              token: doss.getValue('token'),
                                              data: {
                                                user: doss.getChild('@user').getAddress(),
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
        
        return doss.getChild('userSet').content.$syncedAbility('add', {
          data: {
            username: doss.getValue('username'),
            password: doss.getValue('password')
          }
        }).then(function(data) {
          doss.setValue('token', data.token);
        }).fail(function(err) {
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
        
        return doss.getChild('storySet').content.$syncedAbility('add', {
          username: doss.getValue('username'),
          token: doss.getValue('token'),
          data: {
            user:             doss.getChild('@user').getAddress(),
            quickName:        doss.getValue('editStory.quickName'),
            description:      doss.getValue('editStory.description'),
            contestTime:      doss.getValue('editStory.contestTime'), // This value is already an integer
            authorLimit:      parseInt(doss.getValue('editStory.authorLimit')),
            maxWrites:        parseInt(doss.getValue('editStory.maxWrites')),
            maxVotes:         parseInt(doss.getValue('editStory.maxVotes')),
            maxWriteLength:   parseInt(doss.getValue('editStory.maxWriteLength')),
            contestLimit:     parseInt(doss.getValue('editStory.contestLimit')),
            anonymizeWriter:  doss.getValue('editStory.anonymizeWriter'),
            anonymizeVoter:   doss.getValue('editStory.anonymizeVoter'),
            /*slapLoadTime: doss.getValue('editStory.slapLoadTime'),
            slamLoadTime: doss.getValue('editStory.slamLoadTime'),*/
            slapLoadTime:     1000 * 60 * 60 * 24 * 5,
            slamLoadTime:     1000 * 60 * 60 * 24 * 5
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
      
      if (FILLSTORY) {
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
      }
      /// =CLIENT}
      
    }).done();
    
  }

}).build();
