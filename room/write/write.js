global.rooms.write = async foundation => {
  
  // TODO: HEEERE:
  // 1: Aggregate HtmlApp, decorateApp, and makeHutAppScope
  // 2: Get ?hutId=... out of url!!
  
  let { Tmp, Slots, Src, Chooser, FnSrc } = U.logic;
  let { FreeLayout, SizedLayout, Axis1DLayout, TextLayout, TextInputLayout, ScrollLayout } = U.setup;
  let { Rec } = await foundation.getRoom('record');
  
  let HutControls = await foundation.getRoom('hinterlands.hutControls');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.htmlBrowser');
  
  return HutControls('wrt.write', {
    
    debug: [ 'transportRaw', 'httpRaw', 'hinterlands', 'real' ],
    habitats: [ HtmlBrowserHabitat() ],
    recForms: {
      'wrt.room': U.form({ name: 'RoomRec', has: { Rec }, props: (forms, Form) => ({
        getStatusWatcher: function() {
          
          let tmp = Tmp();
          
          let userCountSrc = this.relSrc('wrt.roomUser').getCounterSrc();
          let entryCountSrc = this.relSrc('wrt.roomEntry').getCounterSrc();
          tmp.src = FnSrc.Prm1([ this.valSrc, userCountSrc, entryCountSrc ], (val, numUsers, numEntries) => {
            let { writeParams: { minUsers, maxRounds } } = this.getVal();
            if (numUsers < minUsers) return 'tooFewUsers';
            if (numEntries >= maxRounds) return 'finalized';
            return 'active';
          });
          tmp.endWith(tmp.src);
          
          return tmp;
          
        },
        getRoundEndMs: function() {
          let { timerMs, writeParams: { timeout } } = this.getVal();
          return timerMs + timeout * 1000;
        }
      })})
    },
    parFn: (writeRec, hut, real, dep) => {
      
      /// {ABOVE=
      let admin1 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin1' });
      hut.createRec('wrt.userPrivate', [ admin1 ], { password: 'sm4rtadmin?' });
      
      let admin2 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin2' });
      hut.createRec('wrt.userPrivate', [ admin2 ], { password: 'sm4rtadmin?' });
      
      let admin3 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin3' });
      hut.createRec('wrt.userPrivate', [ admin3 ], { password: 'sm4rtadmin?' });
      
      let admin1Room = hut.createRec('wrt.room', [ writeRec, admin1 ], {
        name: 'test room',
        desc: 'For testing',
        writeParams: { charLimit: 150, timeout: 30, maxRounds: 100, minUsers: 3, maxUsers: 10 }
      });
      
      hut.createRec('wrt.roomUser', [ admin1Room, admin1 ]);
      
      dep.scp(writeRec, 'wrt.room', (room, dep) => {
        
        // Liven up "active" and "users" prop; count roomUsers
        room.dltVal({ timerMs: null });
        
        // A Chooser to act based on room's status
        let roomStatusSrc = dep(room.getStatusWatcher()).src;
        let activeChooser = dep(Chooser([ 'tooFewUsers', 'active', 'finalized' ]));
        dep(roomStatusSrc.route(status => activeChooser.choose(status)));
        
        console.log(`Waiting for room ${room.uid} to go active...`);
        dep.scp(activeChooser.srcs.active, (active, dep) => {
          
          console.log(`Room ${room.uid} went active!!`);
          
          // Not every active room is also timing! Timing only occurs
          // while an active room has at least one submission.
          let timingChooser = dep(Chooser([ 'waiting', 'timing' ]));
          let numEntries = 0;
          dep.scp(room, 'wrt.roomUser', (ru, dep) => dep.scp(ru, 'wrt.roomUserEntry', (rue, dep) => {
            ++numEntries; timingChooser.choose('timing');
            dep(() => --numEntries || timingChooser.choose('waiting'));
          }));
          
          console.log(`Waiting for ${room.uid} to get some entries and begin timing...`);
          dep.scp(timingChooser.srcs.timing, (timing, dep) => {
            
            console.log(`Room ${room.uid} got entries and began timing!!`);
            
            let getRankedEntries = () => {
              
              let roomUserEntries = room.relRecs('wrt.roomUser').toArr(ru => ru.relRec('wrt.roomUserEntry') || C.skip);
              
              // Calculate votes for each entry; sort them in order
              let votedEntries = roomUserEntries
                .map(roomUserEntry => ({
                  roomUser: roomUserEntry.mems['wrt.roomUser'],
                  entry: roomUserEntry.mems['wrt.entry'],
                  votes: roomUserEntry.relRecs('wrt.vote').count()
                }))
                .sort((ve1, ve2) => ve2.votes - ve1.votes);
              
              return { roomUserEntries, votedEntries };
              
            };
            
            // Begin timer
            room.dltVal({ timerMs: foundation.getMs() });
            dep(() => room.dltVal({ timerMs: null }));
            
            // Timing ends when timer expires
            let timeout = setTimeout(() => timing.end('timeLimit'), 1000 * room.getVal().writeParams.timeout);
            dep(() => clearTimeout(timeout));
            
            // Timing ends by voting (including foregone scenario)
            dep.scp(room, 'wrt.roomUser', (ru, dep) => {
              dep.scp(ru, 'wrt.roomUserEntry', (rue, dep) => {
                dep.scp(rue, 'wrt.vote', (vote, dep) => {
                  
                  let { votedEntries } = getRankedEntries();
                  let [ { votes: v0 }, { votes: v1=0 }={} ] = votedEntries;
                  
                  let remainingVotes = 0
                    // Add number of users
                    + room.relRecs('wrt.roomUser').count()
                    // Subtract number of votes spent already
                    - votedEntries.map(ve => ve.votes).reduce((a, b) => a + b);
                  
                  // If the gap between 1st and 2nd place entries is
                  // bigger than remaining votes round is foregone; end!
                  if ((v0 - v1) > remainingVotes) timing.end('foregone');
                  
                  // If no votes remain, end!
                  if (remainingVotes === 0) timing.end('fullyVoted');
                  
                });
              })
            });
            
            dep(reason => {
              
              console.log(`Rounded ended; reason: ${reason}`);
              
              // Collect all entries from all roomUsers
              let { roomUserEntries, votedEntries } = getRankedEntries();
              
              // Keep data from round (in case we want it later)
              let pastRound = hut.createRec('wrt.pastRound', [ room ], { endedAt: foundation.getMs() });
              for (let { entry, votes } of votedEntries) hut.createRec('wrt.pastRoundEntry', [ pastRound, entry ], { votes });
              
              // Pick a winner from the tied-for-1st, contending entries
              let contenders = votedEntries.map(ve => (ve.votes === votedEntries[0].votes) ? ve : C.skip);
              let { entry: winningEntry } = contenders[Math.floor(Math.random() * contenders.count())];
              hut.createRec('wrt.roomEntry', [ room, winningEntry ]);
              
              console.log(`Winner: ${winningEntry.getVal('username')}: "${winningEntry.getVal('text')}"`);
              
              // Clear all entries; round is over!
              roomUserEntries.each(rue => rue.end());
              
            });
            
          });
          
        });
        
      });
      /// =ABOVE}
      
    },
    kidFn: (writeRec, hut, real, dep) => {
      // "Real" => "Representation"? "Depiction"? ("Dep" is already a thing D:)
      
      let mainReal = dep(real.addReal('wrt.main', {
        layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
        decals: {
          border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      }));
      
      let presenceChooser = dep(Chooser(hut.relSrc('wrt.presence')));
      dep.scp(presenceChooser.srcs.off, (loggedOut, dep) => {
        
        console.log(`${hut.uid} logged out`);
        
        let loginSender = dep(hut.getTellSender('wrt.login', ({ username, password }) => {
          
          // TODO: Calls like `relRecs` here need to become async...
          
          let user = writeRec.relRecs('wrt.user').find(rec => rec.getVal().username === username).val;
          if (user) {
            let neededPw = user.relRec('wrt.userPrivate').getVal().password;
            if (neededPw !== password) throw Error(`invalid password`);
            console.log(`Signed in as existing user ${username}`);
          } else {
            if (password.count() < 5) throw Error('Password too short');
            user = hut.parHut.createRec('wrt.user', [ writeRec ], { username });
            hut.parHut.createRec('wrt.userPrivate', [ user ], { password });
            console.log(`Created new user ${username}`);
          }
          
          hut.createRec('wrt.presence', [ hut, user ], { login: foundation.getMs() });
          
        }));
        
        let loggedOutReal = dep(real.addReal('wrt.loggedOut', {
          layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
          decals: {
            colour: 'rgba(230, 230, 230, 1)'
          }
        }));
        
        let usernameReal = loggedOutReal.addReal('wrt.loggedOut.user', {
          layouts: [ TextInputLayout({ align: 'mid', size: '200%', prompt: 'Username' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
          }
        });
        let passwordReal = loggedOutReal.addReal('wrt.loggedOut.pass', {
          layouts: [ TextInputLayout({ align: 'mid', size: '80%', prompt: 'Password' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 255, 0.5)' }
          }
        });
        let submitReal = loggedOutReal.addReal('wrt.loggedOut.submit', {
          layouts: [ TextLayout({ text: 'enter', size: '200%' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: { colour: 'rgba(0, 0, 255, 0.2)' }
        });
        loggedOutReal.addReal('wrt.loggedOut.help', {
          layouts: [
            TextLayout({ text: 'Account will be created if none exists', size: '90%', align: 'mid' }),
            SizedLayout({ w: '200px', h: '45px' })
          ],
          decals: { textColour: 'rgba(0, 0, 0, 0.7)' }
        });
        
        let usernameInpSrc = dep(usernameReal.addInput()).src;
        let passwordInpSrc = dep(passwordReal.addInput()).src;
        
        let submitSrcs =  [
          dep(passwordReal.addPress('discrete')).src,
          dep(usernameReal.addPress('discrete')).src,
          dep(submitReal.addPress()).src
        ];
        for (let submitSrc of submitSrcs) dep(submitSrc.route(() => loginSender.src.send({
          username: usernameInpSrc.val,
          password: passwordInpSrc.val
        })));
        
      });
      dep.scp(presenceChooser.srcs.onn, (presence, dep) => {
        
        let user = presence.mems['wrt.user'];
        let username = user.getVal('username');
        
        console.log(`Hut @ ${hut.uid} logged INN as ${username}`);
        
        let loggedInReal = dep(real.addReal('wrt.loggedIn', {
          layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: null }),
          decals: {
            colour: 'rgba(242, 242, 242, 1)'
          }
        }));
        
        let headerReal = loggedInReal.addReal('wrt.loggedIn.header', {
          layouts: [ SizedLayout({ w: '100%', h: '100px' }) ],
          innerLayout: Axis1DLayout({ axis: 'x', flow: '+', cuts: 'distribute' }),
          decals: {
            colour: 'rgba(230, 230, 230, 1)'
          }
        });
        headerReal.addReal('wrt.loggedIn.header.icon', {
          layouts: [ TextLayout({ text: 'RYTE', size: '200%' }) ]
        });
        headerReal.addReal('wrt.loggedIn.header.panel', {
          layouts: [ TextLayout({ text: `Welcome ${username}` }) ]
        });
        let logoutReal = headerReal.addReal('wrt.loggedIn.header.logout', {
          layouts: [ TextLayout({ text: 'logout', size: '120%' }) ],
          decals: {
            textColour: 'rgba(120, 120, 120, 1)'
          }
        });
        
        let logoutSender = dep(hut.getTellSender('wrt.logout', () => void presence.end()));
        let logoutPressSrc = dep(logoutReal.addPress()).src;
        dep(logoutPressSrc.route(() => logoutSender.src.send()));
        
        let inRoomChooser = dep(Chooser(presence.relSrc('wrt.roomUserPresence')));
        dep.scp(inRoomChooser.srcs.off, (noRoomPresence, dep) => {
          
          console.log(`${username} is browsing rooms`);
          
          let billboardReal = dep(loggedInReal.addReal('wrt.loggedIn.billboard', {
            layouts: [
              TextLayout({
                text: [
                  `You're using RYTE, the thingy that lets friends, enemies and total strangers collaborate`,
                  `on Writing Projects. Why? Maybe you'll write some cool stuff. Why not? Many reasons, but`,
                  `we like to say: "tell people to ignore those reasons". Anyways, have a fun ass time!`,
                ].join(' '),
                size: 'calc(70% + 1vw)', gap: '20px', align: 'mid'
              }),
              SizedLayout({ h: '150px' })
            ],
            decals: {
              border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
            }
          }));
          let roomsScrollReal = dep(loggedInReal.addReal('wrt.roomsScroll', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(100% - 330px)' }) ],
            innerLayout: ScrollLayout({ x: 'none', y: 'auto' }),
            decals: {
              border: { ext: '2px', colour: 'rgba(0, 0, 150, 0.3)' }
            }
          }));
          let roomsReal = dep(roomsScrollReal.addReal('wrt.rooms', {
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' })
          }));
          
          // Being outside a room means we're able to create a room
          let doCreateRoomReal = dep(loggedInReal.addReal('wrt.doCreateRoom', {
            layouts: [ SizedLayout({ w: '100%', h: '80px' }), TextLayout({ text: 'Create Room', size: '200%' }) ],
            decals: {
              colour: 'rgba(0, 0, 0, 0.2)',
              border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
            }
          }));
          let createRoomSender = dep(hut.getTellSender('wrt.createRoom', params => {
            
            console.log(`Create room; name: ${params.name}, minUsers: ${params.minUsers}`);
            
            let { name, desc, charLimit, timeout, maxRounds, minUsers, maxUsers } = params;
            let room = hut.parHut.createRec('wrt.room', [ writeRec, user ], {
              name, desc,
              writeParams: { charLimit, timeout, maxRounds, minUsers, maxUsers }
            });
            let roomUser = hut.parHut.createRec('wrt.roomUser', [ room, user ]);
            hut.createRec('wrt.roomUserPresence', [ roomUser, presence ]);
            
          }));
          
          let createRoomChooser = dep(Chooser([ 'off', 'onn' ]));
          dep.scp(createRoomChooser.srcs.off, (noCreateRoom, dep) => {
            let createRoomPressSrc = dep(doCreateRoomReal.addPress()).src;
            dep(createRoomPressSrc.route(() => createRoomChooser.choose('onn')));
          });
          dep.scp(createRoomChooser.srcs.onn, (createRoom, dep) => {
            
            let createRoomReal = dep(real.addReal('wrt.createRoom', {
              layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
              innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
              decals: { colour: 'rgba(0, 0, 0, 0.5)' }
            }));
            let contentReal = createRoomReal.addReal('wrt.createRoom.content', {
              layouts: [ FreeLayout({ w: '400px' }) ],
              innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
              decals: {
                colour: 'rgba(255, 255, 255, 1)',
                border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.3)' }
              }
            });
            let headerReal = contentReal.addReal('wrt.createRoom.content.header', {
              layouts: [ SizedLayout({ w: '100%', h: '80px' }) ],
              innerLayout: Axis1DLayout({ axis: 'x', flow: '+', cuts: 'distribute' })
            });
            headerReal.addReal('wrt.createRoom.content.header.left', {});
            headerReal.addReal('wrt.createRoom.title', {
              layouts: [ TextLayout({ text: 'Create Room', size: '150%', align: 'mid' }) ]
            });
            let cancelReal = headerReal.addReal('wrt.createRoom.content.header.cancel', {
              layouts: [ TextLayout({ text: 'cancel', size: '120%', align: 'mid' }) ],
              decals: { textColour: 'rgba(120, 120, 120, 1)' }
            });
            
            let fieldsReal = contentReal.addReal('wrt.createRoom.content.fields', {
              innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
            });
            
            let inputs = {
              name:       { src: null, text: '',    prompt: 'Room Name' },
              desc:       { src: null, text: '',    prompt: 'Room Description' },
              charLimit:  { src: null, text: '150', prompt: 'Round Character Limit' },
              timeout:    { src: null, text: '60',  prompt: 'Timeout (seconds)' },
              maxRounds:  { src: null, text: '100', prompt: 'Maximum # of rounds' },
              minUsers:   { src: null, text: '3',   prompt: 'Minimum users before writing begins' },
              maxUsers:   { src: null, text: '10',  prompt: 'Maximum users allowed' }
            };
            for (let [ term, { text, prompt } ] of inputs) {
              fieldsReal.addReal(`wrt.createRoom.fields.title`, {
                layouts: [ SizedLayout({ w: '80%' }), TextLayout({ text: prompt, align: 'fwd' }) ]
              });
              let real = fieldsReal.addReal(`wrt.createRoom.fields.field.${term}`, {
                layouts: [ SizedLayout({ w: '80%', h: '24px' }), TextInputLayout({ text, size: '110%' }) ],
                decals: {
                  border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' }
                }
              });
              let src = inputs[term].src = dep(real.addInput()).src;
            }
            
            let submitReal = fieldsReal.addReal(`wrt.createRoom.content.submit`, {
              layouts: [ SizedLayout({ w: '80%', h: '40px' }), TextLayout({ text: 'Submit', size: '110%' }) ]
            });
            let submitSrc = dep(submitReal.addPress()).src;
            dep(submitSrc.route(() => {
              let vals = inputs.map(inp => inp.src.val);
              for (let k of 'charLimit,timeout,maxRounds,minUsers,maxUsers'.split(',')) vals[k] = parseInt(vals[k], 10);
              createRoomSender.src.send(vals);
            }));
            
            let cancelSrc = dep(cancelReal.addPress()).src;
            dep(cancelSrc.route(() => createRoomChooser.choose('off')));
            
          });
          
          let joinRoomSender = dep(hut.getTellSender('wrt.joinRoom', ({ roomId }) => {
            
            console.log(`Hut ${hut.uid} wants to join room ${roomId}`);
            
            let room = writeRec.relRecs('wrt.room').find(room => room.uid === roomId).val;
            if (!room) throw Error(`No room for id ${roomId}`);
            
            let roomUser = false
              || room.relRecs('wrt.roomUser').find(ru => ru.mems['wrt.user'] === user).val
              || hut.parHut.createRec('wrt.roomUser', [ room, user ]);
            
            hut.createRec('wrt.roomUserPresence', [ roomUser, presence ]);
            
          }));
          dep.scp(writeRec, 'wrt.room', (room, dep) => {
            
            let roomReal = dep(roomsReal.addReal('wrt.room', {
              layouts: [ SizedLayout({ w: 'calc(100% - 20px)', h: '50px' }) ],
              innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
            }));
            roomReal.addReal('wrt.room.title', {
              layouts: [ TextLayout({ text: room.getVal().name, size: '200%' }) ]
            });
            
            let joinRoomSrc = dep(roomReal.addPress()).src;
            dep(joinRoomSrc.route(() => joinRoomSender.src.send({ roomId: room.uid })));
            
          });
          
        });
        dep.scp(inRoomChooser.srcs.onn, (roomUserPresence, dep) => {
          
          let leaveRoomSender = dep(hut.getTellSender('wrt.leaveRoom', () => void roomUserPresence.end()));
          let roomUser = roomUserPresence.mems['wrt.roomUser'];
          let room = roomUser.mems['wrt.room'];
          let roomCreator = room.mems['wrt.user'];
          
          // IMAGINE:
          //  
          //    |     // "occupy" can only refer to a dimension that is being
          //    |     // exhausted. In the case of children of an Axis1DLayout, that
          //    |     // depends on the axis being used!
          //    |     let roomReal = loggedInReal.addReal('wrt.activeRoom', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy() }) ],
          //    |       innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
          //    |     }));
          //    |     let titleReal = roomReal.addReal('wrt.activeRoom.title', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(60) }) ]
          //    |     }));
          //    |     let usersReal = roomReal.addReal('wrt.activeRoom.users', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(40) }) ]
          //    |     }));
          //    |     let storyReal = roomReal.addReal('wrt.activeRoom.story', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.fill().mult(0.5) }) ]
          //    |     }));
          //    |     let statusReal = roomReal.addReal('wrt.activeRoom.status', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(40) }) ]
          //    |     }));
          //    |     let controlsReal = roomReal.addReal('wrt.activeRoom.controls', ctx => ({
          //    |       layouts: [ SizedLayout({ w: ctx.w, h: ctx.fill().mult(0.5) }) ]
          //    |     }));
          
          // Real to display entire room
          let roomReal = dep(loggedInReal.addReal('wrt.activeRoom', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(100% - 100px)' }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
            decals: { colour: 'rgba(255, 255, 255, 1)' }
          }));
          roomReal.addReal('wrt.activeRoom.title', {
            layouts: [
              SizedLayout({ w: '100%', h: '60px' }),
              TextLayout({ text: `${room.getVal().name} (by ${roomCreator.getVal().username})`, size: '150%' })
            ]
          });
          
          // Show fellow users in room, and indicate which are online
          let usersReal = roomReal.addReal('wrt.activeRoom.users', {
            layouts: [ SizedLayout({ w: '100%', h: '40px' }) ],
            innerLayout: Axis1DLayout({ axis: 'x', flow: '+', cuts: 'focus' })
          });
          dep.scp(room, 'wrt.roomUser', (fellowRoomUser, dep) => {
            
            let userInRoom = fellowRoomUser.mems['wrt.user'];
            let userReal = dep(usersReal.addReal('wrt.activeRoom.users.user', {
              layouts: [ TextLayout({ text: userInRoom.getVal().username, size: '120%' }) ],
              decals: { textColour: 'rgba(0, 0, 0, 0.35)' }
            }));
            
            dep.scp(fellowRoomUser, 'wrt.roomUserPresence', (fellowRoomUserPresence, dep) => {
              dep(userReal.addDecals({ textColour: 'rgba(0, 0, 0, 1)' }));
            });
            
          });
          
          // Show current story
          let storyReal = roomReal.addReal('wrt.activeRoom.story', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 70px)' }) ],
            decals: { border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }
          });
          dep.scp(room, 'wrt.roomEntry', (roomEntry, dep) => {
            
            let entry = roomEntry.mems['wrt.entry'];
            dep(storyReal.addReal('wrt.storyItem', {
              layouts: [ TextLayout({ text: `${entry.getVal('username')}: ${entry.getVal('text')}` }) ]
            }));
            
          });
          
          let statusReal = roomReal.addReal('wrt.activeRoom.status', {
            layouts: [ SizedLayout({ w: '100%', h: '40px' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0.2)' }
          });
          let hasTimerChooser = dep(Chooser([ 'noTimer', 'timer' ]));
          dep(room.valSrc.route(() => hasTimerChooser.choose(room.getVal('timerMs') ? 'timer' : 'noTimer')));
          dep.scp(hasTimerChooser.srcs.noTimer, (noTimer, dep) => {
            dep(statusReal.addReal('wrt.activeRoom.status.noTimer', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: '-- : -- : --', size: '120%' }) ],
              decals: { textColour: 'rgba(0, 0, 0, 0.4)' }
            }));
          });
          dep.scp(hasTimerChooser.srcs.timer, (timer, dep) => {
            
            let timerElem = dep(statusReal.addReal('wrt.activeRoom.status.timer', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: '', size: '120%' }) ],
              decals: { textColour: 'rgba(0, 0, 0, 1)' }
            }));
            
            let updateTimer = () => {
              let secs = Math.floor(Math.max(0, (room.getRoundEndMs() - foundation.getMs()) / 1000));
              let hrs = Math.floor(secs / (60 * 60)); secs -= (hrs * 60 * 60);
              let mins = Math.floor(secs / 60); secs -= (mins * 60);
              
              [ hrs, mins, secs ] = [ Math.min(99, hrs), mins, secs ].map(v => `${v}`.padHead(2, '0'));
              timerElem.setText(`${hrs} : ${mins} : ${secs}`);
            };
            updateTimer();
            
            let interval = setInterval(updateTimer, 500);
            dep(() => clearInterval(interval));
            
          });
          
          let controlsReal = roomReal.addReal('wrt.activeRoom.controls', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 70px)' }) ]
          });
          
          let roomStatusSrc = dep(room.getStatusWatcher()).src;
          let controlsChooser = dep(Chooser([ 'tooFewUsers', 'active', 'finalized' ]));
          dep(roomStatusSrc.route(status => controlsChooser.choose(status)));
          
          dep.scp(controlsChooser.srcs.tooFewUsers, (tooFewUsers, dep) => {
            // Indicate story can't be controlled without more players
            dep(controlsReal.addReal('wrt.tooFewUsers', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: 'Waiting for more users...', size: '250%', gap: '30px' }) ]
            }));
          });
          dep.scp(controlsChooser.srcs.active, (active, dep) => {
            
            let submittedEntryChooser = dep(Chooser(roomUser.relSrc('wrt.roomUserEntry')));
            dep.scp(submittedEntryChooser.srcs.off, (noSubmittedEntry, dep) => {
              
              let submitEntrySender = dep(hut.getTellSender('wrt.submitEntry', ({ text }) => {
                console.log(`User ${username} submitted entry: ${text}`);
                let entry = hut.parHut.createRec('wrt.entry', [ roomUser ], { ms: foundation.getMs(), text });
                hut.createRec('wrt.roomUserEntry', [ roomUser, entry ]);
              }));
              
              let submitEntryReal = dep(controlsReal.addReal('wrt.submitEntry', {
                layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
                innerLayout: Axis1DLayout({ axis: 'x', flow: '+' })
              }));
              let inputReal = submitEntryReal.addReal('wrt.submitEntry.input', {
                layouts: [
                  TextInputLayout({ align: 'fwd', size: '120%', gap: '10px', prompt: 'Write your submission...' }),
                  SizedLayout({ w: 'calc(100% - 80px)', h: '100%' })
                ],
                decals: { border: { ext: '4px', colour: 'rgba(0, 150, 0, 1)' } }
              });
              let submitReal = submitEntryReal.addReal('wrt.submitEntry.submit', {
                layouts: [ SizedLayout({ w: '80px', h: '100%' }) ],
                decals: { colour: 'rgba(0, 150, 0, 1)' }
              });
              
              let inputSrc = dep(inputReal.addInput()).src;
              let submitSrc = dep(submitReal.addPress()).src;
              
              dep(submitSrc.route(() => submitEntrySender.src.send({ text: inputSrc.val })));
              
            });
            dep.scp(submittedEntryChooser.srcs.onn, (submittedEntry, dep) => {
              
              console.log(`${roomUser.getVal('username')} submitted an entry; now they "watch" entries!!`);
              
              let submittedVoteChooser = dep(Chooser(roomUser.relSrc('wrt.vote')));
              let voteEntryScrollReal = dep(controlsReal.addReal('wrt.voteEntryScroll', {
                layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
                innerLayout: ScrollLayout({ x: 'none', y: 'auto' })
              }));
              let voteEntryReal = dep(voteEntryScrollReal.addReal('wrt.voteEntry', {
                layouts: [ SizedLayout({ w: '100%' }) ],
                innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
              }));
              
              // Can send a vote so long as `hut` *hasn't* voted
              let submitVoteSender = null;
              dep.scp(submittedVoteChooser.srcs.onn, (vote, dep) => {
              });
              dep.scp(submittedVoteChooser.srcs.off, (noVote, dep) => {
                
                submitVoteSender = dep(hut.getTellSender('wrt.voteEntry', ({ entryId }) => {
                  
                  let roomUserEntryToVote = room.relRecs('wrt.roomUser')
                    .toArr(roomUser => roomUser.relRec('wrt.roomUserEntry') || C.skip)
                    .find(roomUserEntry => roomUserEntry.mems['wrt.entry'].uid === entryId)
                    .val;
                  
                  if (!roomUserEntryToVote) throw Error(`Invalid entryId: ${entryId}`);
                  
                  console.log(`User ${roomUser.getVal('username')} voted on entry by ${roomUserEntryToVote.getVal('username')} ("${roomUserEntryToVote.getVal('text')}")`);
                  
                  hut.createRec('wrt.vote', [ roomUser, roomUserEntryToVote ]);
                  
                }));
                dep(() => submitVoteSender = null);
                
              });
              
              dep.scp(room, 'wrt.roomUser', (fellowRoomUser, dep) => {
                dep.scp(fellowRoomUser, 'wrt.roomUserEntry', (fellowRoomUserEntry, dep) => {
                  
                  let entry = fellowRoomUserEntry.mems['wrt.entry'];
                  let entryReal = dep(voteEntryReal.addReal('wrt.entry', {
                    layouts: [ SizedLayout({ w: '100%', h: '50px' }) ],
                    innerLayout: Axis1DLayout({ axis: 'x', flow: '+' })
                  }));
                  let entryTextReal = entryReal.addReal('wrt.entry.text', {
                    layouts: [ SizedLayout({ w: 'calc(100% - 50px)' }), TextLayout({ text: entry.getVal('text'), gap: '5px' }) ],
                    decals: { border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }
                  });
                  let doVoteReal = entryReal.addReal('wrt.entry.vote', {
                    layouts: [ SizedLayout({ w: '50px', h: '50px' }) ],
                    decals: { colour: 'rgba(0, 0, 0, 0.8)' }
                  });
                  
                  dep.scp(submittedVoteChooser.srcs.off, (noVote, dep) => {
                    
                    dep(doVoteReal.addDecals({ colour: 'rgba(0, 120, 0, 1)' }));
                    
                    let feelSrc = dep(doVoteReal.addFeel()).src;
                    dep.scp(feelSrc, (feel, dep) => dep(doVoteReal.addDecals({ colour: 'rgba(0, 160, 0, 1)' })));
                    
                    let pressSrc = dep(doVoteReal.addPress()).src;
                    dep(pressSrc.route(() => submitVoteSender.src.send({ entryId: entry.uid })));
                    
                  });
                  dep.scp(submittedVoteChooser.srcs.onn, (vote, dep) => {
                    
                    let votedRoomUserEntry = vote.mems['wrt.roomUserEntry'];
                    if (fellowRoomUserEntry !== votedRoomUserEntry) return;
                    dep(doVoteReal.addDecals({ colour: 'rgba(0, 200, 0, 1)' }));
                    
                  });
                  
                });
              });
              
            });
            
          });
          dep.scp(controlsChooser.srcs.finalized, (finalized, dep) => {
            // Indicate story can't be controlled ever again!
            dep(controlsReal.addReal('wrt.finalized', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: 'Story finalized!!', size: '250%', gap: '30px' }) ]
            }));
          });
          
        });
        
      });
      
    }
    
  });
  
};
