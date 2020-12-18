global.rooms.write = async foundation => {
  
  let { Tmp, Slots, Src, Chooser, FnSrc } = U.logic;
  let { Rec } = await foundation.getRoom('record');
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowser');
  
  return Setup('wrt', 'write', {
    
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
    parFn: async (hut, writeRec, real, dep) => {
      
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
        room.objVal({ timerMs: null });
        
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
          
          // TODO: IMAGINE:
          //  let entries = dep(room.recSrc([ 'wrt.roomUser', 'wrt.roomUserEntry' ])); // hard part
          //  dep(entries.getCounterSrc().route(n => timingChooser.choose(n > 0 ? 'timing' : 'waiting')));
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
            room.objVal({ timerMs: foundation.getMs() });
            dep(() => room.objVal({ timerMs: null }));
            
            // Allow the Round to be ended for a `reason`, and with a
            // random value to perform tie-breaking!
            let endRoundAct = dep(hut.enableAction(`wrt.room.${room.uid}.timeout`, ({ reason, rand }) => {
              
              // Collect all entries from all roomUsers
              let { roomUserEntries, votedEntries } = getRankedEntries();
              
              // // Keep data from round (in case we want it later)
              // let pastRound = hut.createRec('wrt.pastRound', [ room ], { endedAt: foundation.getMs() });
              // for (let { entry, votes } of votedEntries) hut.createRec('wrt.pastRoundEntry', [ pastRound, entry ], { votes });
              
              // Pick a winner from the tied-for-1st, contending entries
              let contenders = votedEntries.map(ve => (ve.votes === votedEntries[0].votes) ? ve : C.skip);
              let { entry: winningEntry } = contenders[Math.floor(rand * contenders.count())];
              hut.createRec('wrt.roomEntry', [ room, winningEntry ]);
              
              console.log(`Round ended (${reason}); winner: ${winningEntry.getVal('username')}: "${winningEntry.getVal('text')}"`);
              
              // Clear all entries; round is over!
              roomUserEntries.each(rue => rue.end());
              
            }));
            let timeout = setTimeout(
              () => endRoundAct.act({ reason: 'timeLimit', rand: Math.random() }),
              1000 * room.getVal().writeParams.timeout
            );
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
                  if ((v0 - v1) > remainingVotes) endRoundAct.act({ reason: 'foregone', rand: Math.random() });
                  
                  // If no votes remain, end!
                  if (remainingVotes === 0) endRoundAct.act({ reason: 'fullyVoted', rand: Math.random() });
                  
                });
              })
            });
            
          });
          
        });
        
      });
      /// =ABOVE}
      
    },
    kidFn: async (hut, writeRec, real, dep) => {
      
      let layoutNames = [ 'Free', 'Size', 'Axis1D', 'Decal', 'Press', 'Feel', 'Text', 'TextInput', 'Scroll' ];
      let lay = await Promise.allObj(layoutNames.toObj(ln => [ ln, real.getLayoutForm(ln) ]));
      
      // "Real" => "Representation"? "Depiction"? ("Dep" is already a thing D:)
      let mainReal = dep(real.addReal('wrt.main', [
        lay.Free({ w: '100%', h: '100%' }),
        lay.Axis1D({ axis: 'y', flow: '+' }),
        lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' } })
      ]));
      
      let presenceChooser = dep(Chooser(hut.relSrc('wrt.presence')));
      dep.scp(presenceChooser.srcs.off, (loggedOut, dep) => {
        
        console.log(`${hut.uid} logged out`);
        
        let loginAct = dep(hut.enableAction('wrt.login', ({ username, password }) => {
          
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
        
        let loggedOutReal = dep(real.addReal('wrt.loggedOut', [
          lay.Free({ w: '100%', h: '100%' }),
          lay.Axis1D({ axis: 'y', flow: '+', cuts: 'focus' }),
          lay.Decal({ colour: 'rgba(230, 230, 230, 1)' })
        ]));
        
        let usernameReal = loggedOutReal.addReal('wrt.loggedOut.user', [
          lay.Size({ w: '200px', h: '50px' }),
          lay.Decal({
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
          }),
          lay.TextInput({ align: 'mid', size: '200%', prompt: 'Username' }),
          lay.Press({ modes: [ 'discrete' ] })
        ]);
        let passwordReal = loggedOutReal.addReal('wrt.loggedOut.pass', [
          lay.Size({ w: '200px', h: '50px' }),
          lay.Decal({
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 255, 0.5)' }
          }),
          lay.TextInput({ align: 'mid', size: '80%', prompt: 'Password' }),
          lay.Press({ modes: [ 'discrete' ] })
        ]);
        let submitReal = loggedOutReal.addReal('wrt.loggedOut.submit', { text: 'enter' }, [
          lay.Size({ w: '200px', h: '50px' }),
          lay.Text({ size: '200%' }),
          lay.Decal({ colour: 'rgba(0, 0, 255, 0.2)' }),
          lay.Press({ modes: [ 'discrete', 'continuous' ] })
        ]);
        loggedOutReal.addReal('wrt.loggedOut.help', { text: 'Account will be created if none exists' }, [
          lay.Text({ size: '90%', align: 'mid' }),
          lay.Size({ w: '200px', h: '45px' }),
          lay.Decal({ textColour: 'rgba(0, 0, 0, 0.7)' })
        ]);
        
        let usernameInpSrc = usernameReal.params.text;
        let passwordInpSrc = passwordReal.params.text;
        
        let submitReals = [ usernameReal, passwordReal, submitReal ];
        for (let submitReal of submitReals) dep(submitReal.getLayout(lay.Press).src.route(() => {
          
          loginAct.act({
            username: usernameReal.params.text.val,
            password: passwordReal.params.text.val
          });
          
        }));
        
      });
      dep.scp(presenceChooser.srcs.onn, (presence, dep) => {
        
        let user = presence.mems['wrt.user'];
        let username = user.getVal('username');
        
        console.log(`Hut @ ${hut.uid} logged INN as ${username}`);
        
        let loggedInReal = dep(real.addReal('wrt.loggedIn', [
          lay.Free({ w: '100%', h: '100%' }),
          lay.Axis1D({ axis: 'y', flow: '+', cuts: null }),
          lay.Decal({ colour: 'rgba(242, 242, 242, 1)' })
        ]));
        
        let headerReal = loggedInReal.addReal('wrt.loggedIn.header', [
          lay.Size({ w: '100%', h: '100px' }),
          lay.Axis1D({ axis: 'x', flow: '+', cuts: 'distribute' }),
          lay.Decal({ colour: 'rgba(230, 230, 230, 1)' })
        ]);
        headerReal.addReal('wrt.loggedIn.header.icon', { text: 'RYTE' }, [
          lay.Text({ size: '200%' })
        ]);
        headerReal.addReal('wrt.loggedIn.header.panel', { text: `Welcome ${username}` }, [
          lay.Text({ size: '100%' })
        ]);
        let logoutReal = headerReal.addReal('wrt.loggedIn.header.logout', { text: 'logout' }, [
          lay.Text({ size: '120%' }),
          lay.Decal({ textColour: 'rgba(120, 120, 120, 1)' }),
          lay.Press({})
        ]);
        
        let logoutAct = dep(hut.enableAction('wrt.logout', () => void presence.end()));
        let logoutPressSrc = logoutReal.getLayout(lay.Press).src;
        dep(logoutPressSrc.route(() => logoutAct.act()));
        
        let inRoomChooser = dep(Chooser(presence.relSrc('wrt.roomUserPresence')));
        dep.scp(inRoomChooser.srcs.off, (noRoomPresence, dep) => {
          
          console.log(`${username} is browsing rooms`);
          
          let billboardText = [
            `You're using RYTE, the thingy that lets friends, enemies and total strangers collaborate`,
            `on Writing Projects. Why? Maybe you'll write some cool stuff. Why not? Many reasons, but`,
            `we like to say: "tell people to ignore those reasons". Anyways, have a fun ass time!`,
          ].join(' ');
          let billboardReal = dep(loggedInReal.addReal('wrt.loggedIn.billboard', { text: billboardText }, [
            lay.Text({ size: 'calc(70% + 1vw)', gap: '20px', align: 'mid' }),
            lay.Size({ h: '150px' }),
            lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' } })
          ]));
          let roomsScrollReal = dep(loggedInReal.addReal('wrt.roomsScroll', [
            lay.Size({ w: '100%', h: 'calc(100% - 330px)' }),
            lay.Scroll({ x: 'none', y: 'auto' }),
            lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 150, 0.3)' } })
          ]));
          let roomsReal = dep(roomsScrollReal.addReal('wrt.rooms', [
            lay.Axis1D({ axis: 'y', flow: '+', cuts: 'focus' })
          ]));
          
          // Being outside a room means we're able to create a room
          let doCreateRoomReal = dep(loggedInReal.addReal('wrt.doCreateRoom', { text: 'Create Room' }, [
            lay.Size({ w: '100%', h: '80px' }),
            lay.Text({ size: '200%' }),
            lay.Decal({
              colour: 'rgba(0, 0, 0, 0.2)',
              border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
            })
          ]));
          let createRoomAct = dep(hut.enableAction('wrt.createRoom', params => {
            
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
            let press = dep(doCreateRoomReal.addLayout(lay.Press({}))).layout;
            dep(press.src.route(() => createRoomChooser.choose('onn')));
          });
          dep.scp(createRoomChooser.srcs.onn, (createRoom, dep) => {
            
            let createRoomReal = dep(real.addReal('wrt.createRoom', [
              lay.Free({ w: '100%', h: '100%' }),
              lay.Axis1D({ axis: 'y', flow: '+', cuts: 'focus' }),
              lay.Decal({ colour: 'rgba(0, 0, 0, 0.5)' })
            ]));
            let contentReal = createRoomReal.addReal('wrt.createRoom.content', [
              lay.Free({ w: '400px' }),
              lay.Axis1D({ axis: 'y', flow: '+' }),
              lay.Decal({
                colour: 'rgba(255, 255, 255, 1)',
                border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.3)' }
              })
            ]);
            let headerReal = contentReal.addReal('wrt.createRoom.content.header', [
              lay.Size({ w: '100%', h: '60px' }),
              lay.Axis1D({ axis: 'x', flow: '+', cuts: 'distribute' })
            ]);
            headerReal.addReal('wrt.createRoom.content.header.left', []);
            headerReal.addReal('wrt.createRoom.title', { text: 'Create Room' }, [
              lay.Text({ size: '150%', align: 'mid' })
            ]);
            let cancelReal = headerReal.addReal('wrt.createRoom.content.header.cancel', { text: 'cancel' }, [
              lay.Text({ size: '120%', align: 'mid' }),
              lay.Decal({ textColour: 'rgba(120, 120, 120, 1)' }),
              lay.Press({})
            ]);
            dep(cancelReal.getLayout(lay.Press).src.route(() => createRoomChooser.choose('off')));
            
            let fieldsReal = contentReal.addReal('wrt.createRoom.content.fields', [
              lay.Axis1D({ axis: 'y', flow: '+' })
            ]);
            
            let inpRealDef = {
              name:       { text: '',    prompt: 'Room Name' },
              desc:       { text: '',    prompt: 'Room Description' },
              charLimit:  { text: '150', prompt: 'Round Character Limit' },
              timeout:    { text: '60',  prompt: 'Timeout (seconds)' },
              maxRounds:  { text: '100', prompt: 'Maximum # of rounds' },
              minUsers:   { text: '3',   prompt: 'Minimum users before writing begins' },
              maxUsers:   { text: '10',  prompt: 'Maximum users allowed' }
            };
            let inpReals = inpRealDef.map(({ text, prompt }, term) => {
              return fieldsReal.addReal(`wrt.createRoom.fields.field.${term}`, [
                lay.Size({ w: '300px', h: '24px' }),
                lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }),
                lay.TextInput({ prompt, size: '110%' })
              ]);
            });
            
            let submitReal = fieldsReal.addReal(`wrt.createRoom.content.submit`, { text: 'Submit' }, [
              lay.Size({ w: '80%', h: '40px' }),
              lay.Text({ size: '110%' }),
              lay.Press({})
            ]);
            dep(submitReal.getLayout(lay.Press).src.route(() => {
              
              let vals = inpReals.map(inp => inp.params.text.val);
              for (let k of 'charLimit,timeout,maxRounds,minUsers,maxUsers'.split(',')) vals[k] = parseInt(vals[k], 10);
              
              console.log({ vals });
              
              createRoomAct.act(vals);
              
            }));
            
          });
          
          let joinRoomAct = dep(hut.enableAction('wrt.joinRoom', ({ roomId }) => {
            
            console.log(`Hut ${hut.uid} wants to join room ${roomId}`);
            
            let room = writeRec.relRecs('wrt.room').find(room => room.uid === roomId).val;
            if (!room) throw Error(`No room for id ${roomId}`);
            
            let roomUser = false
              || room.relRecs('wrt.roomUser').find(ru => ru.mems['wrt.user'] === user).val
              || hut.parHut.createRec('wrt.roomUser', [ room, user ]);
            
            hut.createRec('wrt.roomUserPresence', [ roomUser, presence ]);
            
          }));
          dep.scp(writeRec, 'wrt.room', (room, dep) => {
            
            let roomReal = dep(roomsReal.addReal('wrt.room', [
              lay.Size({ w: 'calc(100% - 20px)', h: '50px' }),
              lay.Axis1D({ axis: 'y', flow: '+' })
            ]));
            roomReal.addReal('wrt.room.title', { text: room.getVal().name }, [
              lay.Text({ size: '200%' })
            ]);
            
            let joinRoomSrc = dep(roomReal.addLayout(lay.Press({}))).layout.src;
            dep(joinRoomSrc.route(() => joinRoomAct.act({ roomId: room.uid })));
            
          });
          
        });
        dep.scp(inRoomChooser.srcs.onn, (roomUserPresence, dep) => {
          
          // TODO: Leave room!!
          let leaveRoomAct = dep(hut.enableAction('wrt.leaveRoom', () => void roomUserPresence.end()));
          
          let roomUser = roomUserPresence.mems['wrt.roomUser'];
          let room = roomUser.mems['wrt.room'];
          let roomCreator = room.mems['wrt.user'];
          
          // Real to display entire room
          let roomReal = dep(loggedInReal.addReal('wrt.activeRoom', [
            lay.Size({ w: '100%', h: 'calc(100% - 100px)' }),
            lay.Axis1D({ axis: 'y', flow: '+' }),
            lay.Decal({ colour: 'rgba(255, 255, 255, 1)' })
          ]));
          
          let headerReal = roomReal.addReal('wrt.activeRoom.header', [
            lay.Size({ w: '100%', h: '60px' }),
            lay.Axis1D({ axis: 'x', dir: '+', cuts: 'distribute' })
          ]);
          
          headerReal.addReal('wrt.activeRoom.header.pad', [ lay.Size({ w: '30%' }) ]);
          
          let titleText = `${room.getVal().name} (by ${roomCreator.getVal().username})`;
          headerReal.addReal('wrt.activeRoom.header.title', { text: titleText }, [
            lay.Size({ h: '60px' }),
            lay.Text({ size: '150%' })
          ]);
          
          let leaveRoomReal = headerReal.addReal('wrt.activeRoom.header.leave', { text: 'Leave' }, [
            lay.Size({ h: '60px' }),
            lay.Text({ size: '120%' }),
            lay.Decal({ textColour: 'rgba(120, 120, 120, 1)' }),
            lay.Press({})
          ]);
          dep(leaveRoomReal.getLayout(lay.Press).src.route(() => leaveRoomAct.act()));
          
          // Show fellow users in room, and indicate which are online
          let usersReal = roomReal.addReal('wrt.activeRoom.users', [
            lay.Size({ h: '40px' }),
            lay.Axis1D({ axis: 'x', flow: '+', cuts: 'focus' })
          ]);
          dep.scp(room, 'wrt.roomUser', (fellowRoomUser, dep) => {
            
            let userInRoom = fellowRoomUser.mems['wrt.user'];
            
            let fellowUsername = userInRoom.getVal().username;
            let userReal = dep(usersReal.addReal('wrt.activeRoom.users.user', { text: fellowUsername }, [
              lay.Text({ size: '120%' }),
              lay.Decal({ textColour: 'rgba(0, 0, 0, 0.35)' })
            ]));
            
            dep.scp(fellowRoomUser, 'wrt.roomUserPresence', (fellowRoomUserPresence, dep) => {
              
              dep(userReal.addLayout(lay.Decal({ textColour: 'rgba(0, 0, 0, 1)' })));
              
            });
            
          });
          
          // Show current story
          let storyReal = roomReal.addReal('wrt.activeRoom.story', [
            lay.Size({ w: '100%', h: 'calc(50% - 70px)' }),
            lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } })
          ]);
          dep.scp(room, 'wrt.roomEntry', (roomEntry, dep) => {
            
            let entry = roomEntry.mems['wrt.entry'];
            let entryText = `${entry.getVal('username')}: ${entry.getVal('text')}`;
            dep(storyReal.addReal('wrt.storyItem', { text: entryText }, [
              lay.Text({ size: '100%' })
            ]));
            
          });
          
          let statusReal = roomReal.addReal('wrt.activeRoom.status', [
            lay.Size({ w: '100%', h: '40px' }),
            lay.Decal({ colour: 'rgba(0, 0, 0, 0.2)' })
          ]);
          let hasTimerChooser = dep(Chooser([ 'noTimer', 'timer' ]));
          dep(room.valSrc.route(() => hasTimerChooser.choose(room.getVal('timerMs') ? 'timer' : 'noTimer')));
          dep.scp(hasTimerChooser.srcs.noTimer, (noTimer, dep) => {
            dep(statusReal.addReal('wrt.activeRoom.status.noTimer', { text: '-- : -- : --' }, [
              lay.Size({ w: '100%', h: '100%' }),
              lay.Text({ size: '120%' }),
              lay.Decal({ textColour: 'rgba(0, 0, 0, 0.4)' })
            ]));
          });
          dep.scp(hasTimerChooser.srcs.timer, (timer, dep) => {
            
            let timerElem = dep(statusReal.addReal('wrt.activeRoom.status.timer', { text: '' }, [
              lay.Size({ w: '100%', h: '100%' }), lay.Text({ size: '120%' }),
              lay.Decal({ textColour: 'rgba(0, 0, 0, 1)' })
            ]));
            
            let updateTimer = () => {
              let secs = Math.floor(Math.max(0, (room.getRoundEndMs() - foundation.getMs()) / 1000));
              let hrs = Math.floor(secs / (60 * 60)); secs -= (hrs * 60 * 60);
              let mins = Math.floor(secs / 60); secs -= (mins * 60);
              
              [ hrs, mins, secs ] = [ Math.min(99, hrs), mins, secs ].map(v => `${v}`.padHead(2, '0'));
              timerElem.mod({ text: `${hrs} : ${mins} : ${secs}` });
            };
            updateTimer();
            
            let interval = setInterval(updateTimer, 500);
            dep(() => clearInterval(interval));
            
          });
          
          let controlsReal = roomReal.addReal('wrt.activeRoom.controls', [
            lay.Size({ w: '100%', h: 'calc(50% - 70px)' })
          ]);
          
          let roomStatusSrc = dep(room.getStatusWatcher()).src;
          let controlsChooser = dep(Chooser([ 'tooFewUsers', 'active', 'finalized' ]));
          dep(roomStatusSrc.route(status => controlsChooser.choose(status)));
          
          dep.scp(controlsChooser.srcs.tooFewUsers, (tooFewUsers, dep) => {
            // Indicate story can't be controlled without more players
            dep(controlsReal.addReal('wrt.tooFewUsers', { text: 'Waiting for more users...' }, [
              lay.Size({ w: '100%', h: '100%' }),
              lay.Text({ size: '250%', gap: '30px' })
            ]));
          });
          dep.scp(controlsChooser.srcs.active, (active, dep) => {
            
            let submittedEntryChooser = dep(Chooser(roomUser.relSrc('wrt.roomUserEntry')));
            dep.scp(submittedEntryChooser.srcs.off, (noSubmittedEntry, dep) => {
              
              let submitEntryAct = dep(hut.enableAction('wrt.submitEntry', ({ text }) => {
                console.log(`User ${username} submitted entry: ${text}`);
                let entry = hut.parHut.createRec('wrt.entry', [ roomUser ], { ms: foundation.getMs(), text });
                hut.createRec('wrt.roomUserEntry', [ roomUser, entry ]);
              }));
              
              let submitEntryReal = dep(controlsReal.addReal('wrt.submitEntry', [
                lay.Size({ w: '100%', h: '100%' }),
                lay.Axis1D({ axis: 'x', flow: '+' })
              ]));
              let inputReal = submitEntryReal.addReal('wrt.submitEntry.input', [
                lay.TextInput({ align: 'fwd', size: '120%', gap: '10px', prompt: 'Write your submission...' }),
                lay.Size({ w: 'calc(100% - 80px)', h: '100%' }),
                lay.Decal({ border: { ext: '4px', colour: 'rgba(0, 150, 0, 1)' } })
              ]);
              let submitReal = submitEntryReal.addReal('wrt.submitEntry.submit', [
                lay.Size({ w: '80px', h: '100%' }),
                lay.Decal({ colour: 'rgba(0, 150, 0, 1)' }),
                lay.Press({})
              ]);
              
              let submitSrc = submitReal.getLayout(lay.Press).src;
              dep(submitSrc.route(() => submitEntryAct.act({ text: inputReal.params.text.val })));
              
            });
            dep.scp(submittedEntryChooser.srcs.onn, (submittedEntry, dep) => {
              
              console.log(`${roomUser.getVal('username')} submitted an entry!`);
              
              let submittedVoteChooser = dep(Chooser(roomUser.relSrc('wrt.vote')));
              let voteEntryScrollReal = dep(controlsReal.addReal('wrt.voteEntryScroll', [
                lay.Size({ w: '100%', h: '100%' }),
                lay.Scroll({ x: 'none', y: 'auto' })
              ]));
              let voteEntryReal = dep(voteEntryScrollReal.addReal('wrt.voteEntry', [
                lay.Size({ w: '100%' }),
                lay.Axis1D({ axis: 'y', flow: '+' })
              ]));
              
              // Can send a vote so long as `hut` *hasn't* voted
              let submitVoteAct = null;
              dep.scp(submittedVoteChooser.srcs.onn, (vote, dep) => {
              });
              dep.scp(submittedVoteChooser.srcs.off, (noVote, dep) => {
                
                submitVoteAct = dep(hut.enableAction('wrt.voteEntry', ({ entryId }) => {
                  
                  let roomUserEntryToVote = room.relRecs('wrt.roomUser')
                    .toArr(roomUser => roomUser.relRec('wrt.roomUserEntry') || C.skip)
                    .find(roomUserEntry => roomUserEntry.mems['wrt.entry'].uid === entryId)
                    .val;
                  
                  if (!roomUserEntryToVote) throw Error(`Invalid entryId: ${entryId}`);
                  
                  console.log(`User ${roomUser.getVal('username')} voted on entry by ${roomUserEntryToVote.getVal('username')} ("${roomUserEntryToVote.getVal('text')}")`);
                  
                  hut.createRec('wrt.vote', [ roomUser, roomUserEntryToVote ]);
                  
                }));
                dep(() => submitVoteAct = null);
                
              });
              
              dep.scp(room, 'wrt.roomUser', (fellowRoomUser, dep) => {
                dep.scp(fellowRoomUser, 'wrt.roomUserEntry', (fellowRoomUserEntry, dep) => {
                  
                  let entry = fellowRoomUserEntry.mems['wrt.entry'];
                  let entryReal = dep(voteEntryReal.addReal('wrt.entry', [
                    lay.Size({ w: '100%', h: '50px' }),
                    lay.Axis1D({ axis: 'x', flow: '+' })
                  ]));
                  let entryTextReal = entryReal.addReal('wrt.entry.text', { text: entry.getVal('text') }, [
                    lay.Size({ w: 'calc(100% - 50px)' }), lay.Text({ gap: '5px' }),
                    lay.Decal({ border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } })
                  ]);
                  let doVoteReal = entryReal.addReal('wrt.entry.vote', [
                    lay.Size({ w: '50px', h: '50px' }),
                    lay.Decal({ colour: 'rgba(0, 0, 0, 0.8)' })
                  ]);
                  
                  dep.scp(submittedVoteChooser.srcs.off, (noVote, dep) => {
                    
                    dep(doVoteReal.addLayout(lay.Decal({ colour: 'rgba(0, 120, 0, 1)' })));
                    
                    let feelSrc = dep(doVoteReal.addLayout(lay.Feel({}))).layout.src;
                    
                    dep.scp(feelSrc, (feel, dep) => dep(doVoteReal.addLayout(lay.Decal({ colour: 'rgba(0, 160, 0, 1)' }))));
                    
                    let pressSrc = dep(doVoteReal.addLayout(lay.Press({}))).layout.src;
                    dep(pressSrc.route(() => submitVoteAct.act({ entryId: entry.uid })));
                    
                  });
                  dep.scp(submittedVoteChooser.srcs.onn, (vote, dep) => {
                    
                    let votedRoomUserEntry = vote.mems['wrt.roomUserEntry'];
                    if (fellowRoomUserEntry !== votedRoomUserEntry) return;
                    
                    dep(doVoteReal.addLayout(lay.Decal({ colour: 'rgba(0, 200, 0, 1)' })));
                    
                  });
                  
                });
              });
              
            });
            
          });
          dep.scp(controlsChooser.srcs.finalized, (finalized, dep) => {
            // Indicate story can't be controlled ever again!
            dep(controlsReal.addReal('wrt.finalized', { text: 'Story finalized!!' }, [
              lay.Size({ w: '100%', h: '100%' }),
              lay.Text({ size: '250%', gap: '30px' })
            ]));
          });
          
        });
        
      });
      
    }
    
  });
  
};
