global.rooms.write = async foundation => {
  
  let { Tmp, Slots, Src, MemSrc, Chooser } = U.logic;
  let { FreeLayout, SizedLayout, Axis1DLayout, TextLayout, TextInputLayout, ScrollLayout } = U.setup;
  let { RecScope } = await foundation.getRoom('record');
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  
  let { makeHutAppScope } = await foundation.getRoom('hinterlands.hutApp')
  
  return { open: async hut => {
    
    hut.roadDbgEnabled = false;
    
    await HtmlApp({ name: 'write' }).decorateApp(hut);
    
    /// {ABOVE=
    hut.relSrc('wrt.write').route(writeRec => {
      
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
      
      // hut.createRec('wrt.roomUser', [ admin1Room, admin1 ]);
      
      let rootScope = RecScope(writeRec, 'wrt.room', (room, dep) => {
        
        // Liven up "active" and "users" prop; count roomUsers
        room.dltVal({ users: 0, status: 'needMoreUsers', timerMs: null });
        dep.scp(room, 'wrt.roomUser', (roomUser, dep) => {
          
          let { users, writeParams: { minUsers } } = room.getVal(); users++;
          room.dltVal({ users, status: users >= minUsers ? 'active' : 'needMoreUsers' });
          dep(() => {
            let { users, writeParams: { minUsers } } = room.getVal(); users--;
            room.dltVal({ users, status: users >= minUsers ? 'active' : 'needMoreUsers' });
          });
          
        });
        
        // A Chooser to act based on room's status
        let activeChooser = dep(Chooser([ 'needMoreUsers', 'active' ]));
        dep(room.valSrc.route(() => activeChooser.choose(room.getVal('status'))));
        
        console.log(`Waiting for room ${room.uid} to go active...`);
        dep.scp(activeChooser.srcs.active, (active, dep) => {
          
          console.log(`Room ${room.uid} went active!!`);
          
          let timingChooser = dep(Chooser([ 'waiting', 'timing' ]));
          let numEntries = 0;
          dep.scp(room, 'wrt.roomUser', (ru, dep) => dep.scp(ru, 'wrt.roomUserEntry', (rue, dep) => {
            ++numEntries; timingChooser.choose('timing');
            dep(() => --numEntries || timingChooser.choose('waiting'));
          }));
          
          console.log(`Waiting for ${room.uid} to receive entries and begin timing...`);
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
      writeRec.endWith(rootScope);
      
    });
    /// =ABOVE}
    
    makeHutAppScope(hut, 'wrt', 'write', (writeRec, writeHut, rootReal, dep) => {
      
      // TODO: Really any Record ever supplied to `dep` at any level of
      // `dep.scp` ought to be followed, automatically, by the BelowHut.
      // This could entirely remove the need to use `followRec` (and it
      // could be returned to being defined ABOVE only)
      
      // "Real" => "Representation"? "Depiction" ("Dep" is already a thing D:)?
      
      let mainReal = dep(rootReal.addReal('wrt.main', {
        layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
        decals: {
          border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      }));
      
      let loginChooser = dep(Chooser(writeHut.relSrc('wrt.presence')));
      dep.scp(loginChooser.srcs.off, (loggedOut, dep) => {
        
        console.log(`${writeHut.uid} logged out`);
        
        let loginSender = dep(writeHut.getTellSender('wrt.login', ({ username, password }, reply) => {
          
          // TODO: Calls like `relRecs` here need to become async...
          let user = writeRec.relRecs('wrt.user').find(rec => rec.getVal().username === username).val;
          if (user) {
            let neededPw = user.relRec('wrt.userPrivate').getVal().password;
            if (neededPw !== password) return reply(Error(`invalid password`));
            console.log('Signed in as existing user');
          } else {
            if (password.count() < 5) return reply(Error('Password too short'));
            user = hut.createRec('wrt.user', [ writeRec ], { username });
            hut.createRec('wrt.userPrivate', [ user ], { password });
            console.log(`Created new user ${username}`);
          }
          
          let presence = false
            || user.relRec('wrt.presence')
            || hut.createRec('wrt.presence', [ writeHut, user ], { login: foundation.getMs() });
          if (presence.mems['lands.hut'] !== writeHut) return reply(Error(`Another user is signed in`));
          
          writeHut.followRec(presence);
          
        }));
        
        let loggedOutReal = dep(rootReal.addReal('wrt.loggedOut', {
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
            TextLayout({ text: 'Account will be created if none is found', size: '90%', align: 'mid' }),
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
      dep.scp(loginChooser.srcs.onn, (presence, dep) => {
        
        let user = presence.mems['wrt.user'];
        let username = user.getVal('username');
        
        console.log(`Hut @ ${writeHut.uid} logged INN as ${username}`);
        
        let loggedInReal = dep(rootReal.addReal('wrt.loggedIn', {
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
        
        let logoutSender = dep(writeHut.getTellSender('wrt.logout', () => presence.end()));
        let logoutPressSrc = dep(logoutReal.addPress()).src;
        dep(logoutPressSrc.route(() => logoutSender.src.send()));
        
        let inRoomChooser = dep(Chooser(presence.relSrc('wrt.roomUserPresence')));
        dep.scp(inRoomChooser.srcs.off, (noRoomPresence, dep) => {
          
          let billboardReal = dep(loggedInReal.addReal('wrt.loggedIn.billboard', {
            layouts: [
              TextLayout({
                text: [
                  'You\'re using RYTE, the thingy that lets friends, enemies and total strangers collaborate',
                  'on Writing Projects. Why? Maybe you\'ll write some cool stuff. Why not? Many reasons, but',
                  'we like to say: "tell people to ignore those reasons". Anyways, have a fun ass time!',
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
          let createRoomSender = dep(writeHut.getTellSender('wrt.createRoom', params => {
            
            console.log(`Create room; name: ${params.name}, minUsers: ${params.minUsers}`);
            
            let { name, desc, charLimit, timeout, maxRounds, minUsers, maxUsers } = params;
            let room = hut.createRec('wrt.room', [ writeRec, user ], {
              name, desc,
              writeParams: { charLimit, timeout, maxRounds, minUsers, maxUsers }
            });
            let roomUser = hut.createRec('wrt.roomUser', [ room, user ]);
            writeHut.followRec(hut.createRec('wrt.roomUserPresence', [ roomUser, presence ]));
            
          }));
          
          let createRoomChooser = dep(Chooser([ 'off', 'onn' ]));
          dep.scp(createRoomChooser.srcs.off, (noCreateRoom, dep) => {
            let createRoomPressSrc = dep(doCreateRoomReal.addPress()).src;
            dep(createRoomPressSrc.route(() => createRoomChooser.choose('onn')));
          });
          dep.scp(createRoomChooser.srcs.onn, (createRoom, dep) => {
            
            let createRoomReal = dep(rootReal.addReal('wrt.createRoom', {
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
          
          let joinRoomSender = dep(writeHut.getTellSender('wrt.joinRoom', ({ roomId }, reply) => {
            
            console.log(`Hut ${writeHut.uid} wants to join room ${roomId}`);
            
            let room = writeRec.relRecs('wrt.room').find(room => room.uid === roomId).val;
            if (!room) return reply(new Error(`No room for id ${roomId}`));
            
            let roomUser = false
              || room.relRecs('wrt.roomUser').find(ru => ru.mems['wrt.user'] === user).val
              || hut.createRec('wrt.roomUser', [ room, user ]);
            
            writeHut.followRec(hut.createRec('wrt.roomUserPresence', [ roomUser, presence ]));
            
          }));
          dep.scp(writeRec, 'wrt.room', (room, dep) => {
            
            dep(writeHut.followRec(room));
            
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
          
          let leaveRoomSender = dep(writeHut.getTellSender('wrt.leaveRoom', () => roomUserPresence.end()));
          let roomUser = roomUserPresence.mems['wrt.roomUser'];
          let room = roomUser.mems['wrt.room'];
          let roomCreator = room.mems['wrt.user'];
          
          /*
          IMAGINE:
          
          // "occupy" can only refer to a dimension that is being
          // exhausted. In the case of children of an Axis1DLayout, that
          // depends on the axis being used!
          let roomReal = loggedInReal.addReal('wrt.activeRoom', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy() }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
          }));
          let titleReal = roomReal.addReal('wrt.activeRoom.title', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(60) }) ]
          }));
          let usersReal = roomReal.addReal('wrt.activeRoom.users', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(40) }) ]
          }));
          let storyReal = roomReal.addReal('wrt.activeRoom.story', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.fill().mult(0.5) }) ]
          }));
          let statusReal = roomReal.addReal('wrt.activeRoom.status', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.occupy().abs(40) }) ]
          }));
          let controlsReal = roomReal.addReal('wrt.activeRoom.controls', ctx => ({
            layouts: [ SizedLayout({ w: ctx.w, h: ctx.fill().mult(0.5) }) ]
          }));
          
          */
          
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
            
            dep(writeHut.followRec(fellowRoomUser));
            
            let userInRoom = fellowRoomUser.mems['wrt.user'];
            let userReal = dep(usersReal.addReal('wrt.activeRoom.users.user', {
              layouts: [ TextLayout({ text: userInRoom.getVal().username, size: '120%' }) ],
              decals: { textColour: 'rgba(0, 0, 0, 0.35)' }
            }));
            
            dep.scp(fellowRoomUser, 'wrt.roomUserPresence', (fellowRoomUserPresence, dep) => {
              
              dep(writeHut.followRec(fellowRoomUserPresence));
              dep(userReal.addDecals({ textColour: 'rgba(0, 0, 0, 1)' }));
              
            });
            
          });
          
          // Show current story
          let storyReal = roomReal.addReal('wrt.activeRoom.story', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 70px)' }) ],
            decals: { border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }
          });
          dep.scp(room, 'wrt.roomEntry', (roomEntry, dep) => {
            
            writeHut.followRec(roomEntry);
            
            let entry = roomEntry.mems['wrt.entry'];
            dep(storyReal.addReal('wrt.storyItem', {
              layouts: [ TextLayout({ text: `${entry.getVal('username')}: ${entry.getVal('text')}` }) ]
            }));
            
          });
          
          let statusReal = roomReal.addReal('wrt.activeRoom.status', {
            layouts: [ SizedLayout({ w: '100%', h: '40px' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0.2)' }
          });
          
          let controlsReal = roomReal.addReal('wrt.activeRoom.controls', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 70px)' }) ]
          });
          
          let controlsChooser = dep(Chooser([ 'complete', 'needMoreUsers', 'active' ]));
          dep(room.valSrc.route(() => controlsChooser.choose(room.getVal('status'))));
          dep.scp(controlsChooser.srcs.needMoreUsers, (needMoreUsers, dep) => {
            // Indicate story can't be controlled without more players
            dep(controlsReal.addReal('wrt.needMoreUsers', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: 'Waiting for more users...', size: '250%', gap: '30px' }) ]
            }));
          });
          dep.scp(controlsChooser.srcs.complete, (complete, dep) => {
            // Indicate story can't be controlled ever again!
            dep(controlsReal.addReal('wrt.complete', {
              layouts: [ SizedLayout({ w: '100%', h: '100%' }), TextLayout({ text: 'Story complete!!', size: '250%', gap: '30px' }) ]
            }));
          });
          dep.scp(controlsChooser.srcs.active, (active, dep) => {
            
            let submittedEntryChooser = dep(Chooser(roomUser.relSrc('wrt.roomUserEntry')));
            dep.scp(submittedEntryChooser.srcs.off, (noSubmittedEntry, dep) => {
              
              let submitEntrySender = dep(writeHut.getTellSender('wrt.submitEntry', ({ text }) => {
                console.log(`User ${username} (${roomUser.getVal('username')}??) submitted entry: ${text}`);
                let entry = hut.createRec('wrt.entry', [ roomUser ], { ms: foundation.getMs(), text });
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
              
              // Can send a vote so long as `writeHut` *hasn't* voted
              let submitVoteSender = null;
              dep.scp(submittedVoteChooser.srcs.onn, (vote, dep) => {
                
                console.log(`User ${roomUser.getVal('username')} has voted for ${vote.getVal('text')} and CANNOT vote again`);
                
              });
              dep.scp(submittedVoteChooser.srcs.off, (noVote, dep) => {
                
                console.log(`User ${roomUser.getVal('username')} has NOT voted and may do so!`);
                
                submitVoteSender = dep(writeHut.getTellSender('wrt.voteEntry', ({ entryId }, reply) => {
                  
                  let roomUserEntryToVote = room.relRecs('wrt.roomUser')
                    .toArr(roomUser => roomUser.relRec('wrt.roomUserEntry') || C.skip)
                    .find(roomUserEntry => roomUserEntry.mems['wrt.entry'].uid === entryId)
                    .val;
                  
                  if (!roomUserEntryToVote) return reply(Error(`Invalid entryId: ${entryId}`));
                  
                  console.log(`User ${roomUser.getVal('username')} voted on entry by ${roomUserEntryToVote.getVal('username')} ("${roomUserEntryToVote.getVal('text')}")`);
                  
                  writeHut.followRec(hut.createRec('wrt.vote', [ roomUser, roomUserEntryToVote ]));
                  
                }));
                dep(() => submitVoteSender = null);
                
              });
              
              dep.scp(room, 'wrt.roomUser', (fellowRoomUser, dep) => {
                
                dep(writeHut.followRec(fellowRoomUser));
                
                dep.scp(fellowRoomUser, 'wrt.roomUserEntry', (fellowRoomUserEntry, dep) => {
                  
                  dep(writeHut.followRec(fellowRoomUserEntry));
                  
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
                    
                    console.log(`${username} voted on ${votedRoomUserEntry.uid} vs ${fellowRoomUserEntry.uid}`);
                    if (fellowRoomUserEntry !== votedRoomUserEntry) return;
                    dep(doVoteReal.addDecals({ colour: 'rgba(0, 200, 0, 1)' }));
                    
                  });
                  
                });
                
              });
              
            });
            
          });
          
        });
        
      });
      
    });
    
  }};
  
};
