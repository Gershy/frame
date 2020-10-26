global.rooms.write = async foundation => {
  
  let { Tmp, Slots, Src, MemSrc, Chooser } = U.logic;
  
  let { FreeLayout, SizedLayout, Axis1DLayout, TextLayout, TextInputLayout, ScrollLayout } = U.setup;
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  
  let { makeHutAppScope } = await foundation.getRoom('hinterlands.hutApp')
  
  return { open: async hut => {
    
    await HtmlApp({ name: 'write' }).decorateApp(hut);
    
    /// {ABOVE=
    hut.relSrc('wrt.write').route(writeRec => {
      
      let admin1 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin1', password: 'sm4rtadmin?' });
      let admin2 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin2', password: 'sm4rtadmin?' });
      let admin3 = hut.createRec('wrt.user', [ writeRec ], { username: 'admin3', password: 'sm4rtadmin?' });
      
      hut.createRec('wrt.room', [ writeRec, admin1 ], {
        name: 'test room',
        desc: 'testing room!',
        charLimit: 100,
        timeout: 60 * 1000 * 5,
        maxRounds: 100,
        minUsers: 3, maxUsers: 10
      });
      
    });
    /// =ABOVE}
    
    makeHutAppScope(hut, 'wrt', 'write', (writeRec, writeHut, rootReal, dep) => {
      
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
          
          let user = writeRec.relRecs('wrt.user').find(rec => rec.getVal().username === username).val;
          if (user) {
            if (user.getVal().password !== password) return reply(Error(`invalid password`));
            console.log('Signed in as existing user');
          } else {
            if (password.count() < 5) return reply(Error('Password too short'));
            user = hut.createRec('wrt.user', [ writeRec ], { username, password });
            console.log('Created new user');
          }
          
          let presence = hut.createRec('wrt.presence', [ writeHut, user ], { login: foundation.getMs() });
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
          layouts: [ TextInputLayout({ align: 'mid', size: '30px', prompt: 'Username' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
          }
        });
        let passwordReal = loggedOutReal.addReal('wrt.loggedOut.pass', {
          layouts: [ TextInputLayout({ align: 'mid', size: '10px', prompt: 'Password' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 255, 0.5)' }
          }
        });
        let submitReal = loggedOutReal.addReal('wrt.loggedOut.submit', {
          layouts: [ TextLayout({ text: 'enter', size: '30px' }), SizedLayout({ w: '200px', h: '50px' }) ],
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
        
        console.log(`${writeHut.uid} logged INN as ${user.getVal().username}`);
        
        let logoutSender = dep(writeHut.getTellSender('wrt.logout', () => presence.end()));
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
          layouts: [ TextLayout({ text: '??' }) ]
        });
        let logoutReal = headerReal.addReal('wrt.loggedIn.header.logout', {
          layouts: [ TextLayout({ text: 'logout', size: '120%' }) ],
          decals: {
            textColour: 'rgba(120, 120, 120, 1)'
          }
        });
        
        let logoutPressSrc = dep(logoutReal.addPress()).src;
        dep(logoutPressSrc.route(() => logoutSender.src.send()));
        
        let inRoomChooser = dep(Chooser(presence.relSrc('wrt.roomUserPresence')));
        dep.scp(inRoomChooser.srcs.off, (noRoomPresence, dep) => {
          
          let billboardReal = dep(loggedInReal.addReal('wrt.loggedIn.billboard', {
            layouts: [
              TextLayout({
                text: [
                  'You\'re using RYTE, the thingy that lets friends, enemies and total strangers collaborate',
                  'on writing projects. Why? Maybe you\'ll write some cool stuff. Why not? Many reasons, but',
                  'we like to say: "tell people to ignore those reasons". Anyways, have a fun ass time!',
                ].join(' '),
                size: '110%', gap: '20px', align: 'mid'
              }),
              SizedLayout({ h: '200px' })
            ],
            decals: {
              border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
            }
          }));
          let roomsScrollReal = dep(loggedInReal.addReal('wrt.roomsScroll', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(100% - 380px)' }) ],
            innerLayout: ScrollLayout({ x: 'none', y: 'auto' }),
            decals: {
              border: { ext: '2px', colour: 'rgba(0, 0, 150, 0.3)' }
            }
          }));
          let roomsReal = dep(roomsScrollReal.addReal('wrt.rooms', {
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
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
            
            console.log('create room', params);
            
            let { name, desc, charLimit, timeout, maxRounds, minUsers, maxUsers } = params;
            let room = hut.createRec('wrt.room', [ writeRec, user ], { name, desc, charLimit, minUsers, maxUsers });
            let roomUser = hut.create('wrt.roomUser', [ room, user ]);
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
              charLimit:  { src: null, text: '',    prompt: 'Round Character Limit' },
              timeout:    { src: null, text: '',    prompt: 'Timeout (seconds)' },
              maxRounds:  { src: null, text: '',    prompt: 'Maximum # of rounds' },
              minUsers:   { src: null, text: '3',   prompt: 'Minimum users before writing begins' },
              maxUsers:   { src: null, text: '10',  prompt: 'Maximum users allowed' },
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
            dep(submitSrc.route(() => createRoomSender.src.send(inputs.map(inp => inp.src.val))));
            
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
            
            /// {ABOVE=
            dep(writeHut.followRec(room));
            /// =ABOVE}
            
            let roomReal = dep(roomsReal.addReal('wrt.room', {
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
          
          let roomReal = dep(loggedInReal.addReal('wrt.activeRoom', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(100% - 100px)' }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
            decals: { colour: 'rgba(255, 255, 255, 1)' }
          }));
          let titleReal = roomReal.addReal('wrt.activeRoom.title', {
            layouts: [
              SizedLayout({ w: '100%', h: '80px' }),
              TextLayout({ text: `${room.getVal().name} (by ${roomCreator.getVal().username})`, size: '150%' })
            ]
          });
          
          // Show users in room
          let usersReal = roomReal.addReal('wrt.activeRoom.users', {
            layouts: [ SizedLayout({ w: '100%', h: '40px' }) ],
            innerLayout: Axis1DLayout({ axis: 'x', flow: '+', cuts: 'focus' })
          });
          dep.scp(room, 'wrt.roomUser', (roomUser, dep) => {
            
            /// {ABOVE=
            dep(writeHut.followRec(roomUser));
            /// =ABOVE}
            
            dep.scp(roomUser, 'wrt.roomUserPresence', (roomUserPresence, dep) => {
              
              /// {ABOVE=
              dep(writeHut.followRec(roomUserPresence));
              /// =ABOVE}
              
              let user = roomUser.mems['wrt.user'];
              console.log(`User ${user.getVal().username} is in room ${room.uid}`);
              
              dep(usersReal.addReal('wrt.activeRoom.users.user', {
                layouts: [ TextLayout({ text: user.getVal().username }) ],
                decals: { textColour: 'rgba(150, 150, 150, 1)' }
              }));
              
            });
            
          });
          
          // Show current story
          let storyReal = roomReal.addReal('wrt.activeRoom.story', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 60px)' }) ],
            decals: { border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }
          });
          
          let entryReal = roomReal.addReal('wrt.activeRoom.entry', {
            layouts: [ SizedLayout({ w: '100%', h: 'calc(50% - 60px)' }) ],
            decals: { border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.2)' } }
          });
          
        });
        
      });
      
    });
    
  }};
  
};
