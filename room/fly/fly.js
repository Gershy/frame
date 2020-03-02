U.buildRoom({
  
  name: 'fly',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term' ],
  build: (foundation, record, hinterlands, real, realWebApp, term) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, CondNozz, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    let { FixedSize, FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, AxisSlotter, TextSized, Art } = real;
    let { UnitPx, UnitPc } = real;
    let { WebApp } = realWebApp;
    
    let open = async () => {
      
      let fps = 30;
      let spf = 1 / fps;
      
      let modelDef = {
        //random: {
        //  name: '???'
        //},
        
        // Damage profiles:
        // TICKING HITBOX:
        //   t: num ticks
        //   tr: tick rate (in millis)
        //   dpt: damage per tick
        
        // PROJECTILE HITBOX:
        //   spd: speed (m/s)
        //   dmg: damage on hit
        
        joust: { name: 'Joust Man', size: [16,16],
          values: {
            w1Charge1Ms: 1000, w1Charge2Ms: 2000, w1Charge3Ms: 6000, // How many millis of charging for various jousts
            w1Charge1T: 3, w1Charge1Tr: 250, w1Charge1Dpt: 1,
            w1Charge3T: 15, w1Charge3Tr: 100, w1Charge3Dpt: 1,
            w2MaxAmmo: 50, w2Delay: 120, w2Dmg: 1
          },
          initValues: {
            w1ChargeMark: null, // Timestamp that charging began or `null` if not charging
            w2LastMark: null, // Timestamp that last bullet was shot, or `null` (meaning "forever ago")
            w2Ammo: 50 // Number of bullets remaining
          }
        },
        gun: { name: 'Gun Girl', size: [16,16],
          values: {
            w1CooldownMs: 3000, w1Spd: 250, w1Dmg: 1, // cooldown applies when stopped shooting
            w2CooldownMs: 15000
          },
          initValues: {
            w1Cooldown: 0,      // Guns start fully off cooldown
            w2Cooldown: 15000   // Ability starts on full cooldown
          }
        },
        slam: { name: 'Slam Kid', size: [16,16],
          values: {
            chargeMinMs: 200,
            chargeMaxMs: 1500,
            chargeShotgunLe: 500, // Shotgun if slam lasts less-than-or-equal-to this amount of time
            chargeMissileMs: 700, // Missile this many millis into the slam
            chargeMissileWindow: 50 // Duration of sweet-spot to get missile
          },
          initValues: {
            w1ChargeMark: null,
            w2ChargeMark: null
          }
        },
        slice: {
          name: 'Slice Lad'
        }
      };
      let enemyDef = {
        runner: {
          name: 'Runner',
          initValues: {}
        },
        walker: {
          name: 'Walker',
          initValues: {}
        }
      };
      let levels = {
        plains: {
          moments: [
            { dist: 0, name: 'scouts',
              entities: [
                [ 'enemy', 'runner', -60, +100 ], // y is relative to `moment.dist`
                [ 'enemy', 'runner', -30, +100 ],
                [ 'enemy', 'runner', +30, +100 ],
                [ 'enemy', 'runner', +60, +100 ],
                [ 'enemy', 'walker', 0, +150 ]
              ]
            },
            { dist: 1000 * 1000 * 1000, entities: [] } // To make sure the Game doesn't dry
          ]
        }
      };
      
      let getEntityIden = (type, entity) => {
        if (type === 'ace') return { type, ...entity.val.data.slice('model', 'name') };
        if (type === 'runner') return { type };
        if (type === 'walker') return { type };
        return { type };
      };
      let updateEntity = (ms, game, entity) => {
        
        if (entity.isDry()) {
          console.log('Tried to update a dry Entity :\'\'(');
          if (entity.visibleSpriteIden) throw Error('IT HAS A SPRITEIDEN :\'\'\'\'(((');
          return;
        }
        
        let { aliveMs, type, data, control=null } = entity.val;
        let spriteUpdate = {};
        let visibleDims = [ 0, 0 ];
        
        if (type === 'ace') {
          
          let spd = 300;
          let { x: cx, y: cy, a1, a2 } = control;
          let vx, vy;
          if (cx && cy) {
            let div = spd / Math.sqrt(cx * cx + cy * cy);
            vx = cx * div;
            vy = cy * div;
          } else {
            vx = cx * spd;
            vy = cy * spd;
          }
          
          vy += game.val.aheadSpd;
          
          if (vx || vy) {
            data.x += vx * spf;
            data.y += vy * spf;
            entity.modVal(v => (v.data = data, v));
            spriteUpdate = { x: data.x, y: data.y };
          }
          
          let model = data.model;
          
          if (model === 'joust') {
            
            if (a2) {
              
              let timeSinceLastBullet = ms - (data.w2LastMark || 0);
              if (data.w2Ammo && timeSinceLastBullet > modelDef.joust.values.w2Delay) {
                // Reduce ammo, mark last moment, and create bullet
                entity.modVal(v => (v.data.w2Ammo--, v.data.w2LastMark = ms, v));
                flyHut.createRec('fly.entity', [ game ], { aliveMs: ms, type: 'joustBullet', data: { x: data.x - 4, y: data.y } });
                flyHut.createRec('fly.entity', [ game ], { aliveMs: ms, type: 'joustBullet', data: { x: data.x + 4, y: data.y } });
              }
              
            }
            
          }
          
          visibleDims = [ 16, 16 ];
          
        } else if (type === 'joustBullet') {
          
          if (ms - aliveMs > 3000) { entity.dry(); return; }
          
          let { vx, vy } = data;
          data.y += (850 + game.val.aheadSpd) * spf;
          
          entity.modVal(v => (v.data = data, v));
          spriteUpdate = { y: data.y };
          
          visibleDims = [ 2, 10 ];
          
        } else if (type === 'runner') {
          
          //console.log('RUNNER @ TIME', (ms - aliveMs), entity.val);
          data.x += Math.cos((ms - aliveMs) * 0.001) * 100 * spf;
          data.y += game.val.aheadSpd * spf
          
          //data.x = (Math.random() * 100) - 50;
          entity.modVal(v => (v.data = data, v));
          spriteUpdate = { x: data.x, y: data.y };
          
          visibleDims = [ 12, 12 ];
          
        } else if (type === 'walker') {
          
          visibleDims = [ 18, 18 ];
          
        } else {
          
          console.log(`Dunno how to update "${type}" (${JSON.stringify(data)})`);
          
        }
        
        let hh = visibleDims[1] >> 1;
        let visiDist = 500 + hh; // Vert distance from the center of the screen for visibility of this Object
        let dist = game.val.dist;
        let visible = (data.y < (dist + visiDist)) && (data.y > (dist - visiDist));
        
        // Create / Dry the Sprite if its existence is changing
        if (visible && !entity.visibleSprite) {
          
          // Create a SpriteIden and makes sure it gets cleaned up if
          // its related Entity every Dries
          let spriteIden = entity.visibleSpriteIden = flyHut.createRec('fly.spriteIden', [ game ], getEntityIden(type, entity));
          spriteIden.dryRoute = entity.drierNozz().route(() => spriteIden.dry());
          
          // Create a Sprite on top of the SpriteIden
          entity.visibleSprite = flyHut.createRec('fly.sprite', [ game, spriteIden ], { x: data.x, y: data.y });
          
        } else if (!visible && entity.visibleSprite) {
          
          // Dry Route (no longer clinging to `entity.drierNozz()`) and
          // the SpriteIden (which cascades to dry the Sprite too)
          entity.visibleSpriteIden.dryRoute.dry();
          entity.visibleSpriteIden.dry();
          
          // Remove references to dried Recs
          entity.visibleSpriteIden = null;
          entity.visibleSprite = null;
          
        }
        
        // Update sprite if necessary
        let sprite = entity.visibleSprite;
        if (sprite && !spriteUpdate.isEmpty()) sprite.modVal(v => v.gain(spriteUpdate));
        
      };
      let renderSprite = (draw, game, sprite) => {
        
        let spriteIden = sprite.members['fly.spriteIden'];
        let { x, y } = sprite.val;
        let { type } = spriteIden.val;
        
        if (type === 'ace') {
          
          let { model } = spriteIden.val;
          let imageKeep = foundation.getKeep('urlResource', { path: `fly.sprite.${model}` });
          draw.circ(x, -y, 20, { fillStyle: 'rgba(100, 0, 0, 0.2)' });
          draw.image(imageKeep, x, -y, 16, 16);
          
        } else if (type === 'joustBullet') {
          
          draw.rect(x - 1, -(y - 5), 2, 10, { fillStyle: '#ff0000' });
          
        } else if (type === 'runner') {
          
          draw.circ(x, -y, 20, { fillStyle: 'rgba(0, 255, 0, 1)' });
          
        } else if (type === 'walker') {
          
          draw.circ(x, -y, 26, { fillStyle: 'rgba(0, 0, 255, 1)' });
          
        } else {
          
          draw.circ(x, -y, 12, { fillStyle: 'rgba(255, 0, 0, 1)' });
          
        }
        
      };
      
      let flyHut = global.hut = await foundation.getRootHut({ heartMs: 1000 * 20 });
      flyHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('fly', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        
        real('content1', () => TextSized({ size: UnitPc(2) }));
        real('content2', () => TextSized({ size: UnitPc(1.5) }));
        real('content3', () => TextSized({ size: UnitPc(1) }));
        
        let centeredText = (name, cNames=[ 'content1', 'content2', 'content3' ]) => {
          for (let cName of cNames) insert(`${name} -> ${cName}`, sl => sl.getCenteredSlot());
        };
        
        // TODO: LinearSlotter provides *no size* for the list container
        // BUT sometimes we want a relatively-sized element inside the
        // list container - so like, the 3rd item in the list should be
        // 40% of the width of its container (with no relation to the
        // widths of its siblings). Ok... WRONG ENTIRELY. Use an
        // AxisSlotter, give it `FixedSize(UnitPc(0.4), ...)`!!
        
        real('lobbyChooser',        () => CenteredSlotter());
        real('lobbyChooserContent', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.4), UnitPc(0.3) ] }));
        real('lobbyNameField',      () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Name' }));
        real('lobbyChooserField',   () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Lobby code' }));
        real('lobbyChooserButton',  () => CenteredSlotter());
        insert('main -> lobbyChooser',                      () => FillParent());
        insert('lobbyChooser -> lobbyChooserContent',       sl => [ sl.getCenteredSlot(), FixedSize(UnitPc(0.8), UnitPc(0.8)) ]);
        insert('lobbyChooserContent -> lobbyNameField',     sl => sl.getAxisSlot(0));
        insert('lobbyChooserContent -> lobbyChooserField',  sl => sl.getAxisSlot(1));
        insert('lobbyChooserContent -> lobbyChooserButton', sl => sl.getAxisSlot(2));
        insert('lobbyChooserButton -> content1', sl => sl.getCenteredSlot());
        
        real('lobby', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.2), UnitPc(0.7) ] }));
        real('lobbyTitle', () => CenteredSlotter());
        real('lobbyBackButton', () => CenteredSlotter());
        real('teamList', () => LinearSlotter({ axis: 'y', dir: '+' }));
        centeredText('lobbyTitle');
        centeredText('lobbyBackButton');
        
        real('teamMember', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('playerName', () => CenteredSlotter());
        real('modelList', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('model', () => CenteredSlotter());
        real('score', () => CenteredSlotter());
        centeredText('playerName');
        centeredText('model');
        centeredText('score');
        insert('main -> lobby', () => FillParent());
        insert('lobby -> lobbyTitle',       sl => sl.getAxisSlot(0));
        insert('lobby -> teamList',         sl => sl.getAxisSlot(1));
        insert('lobby -> lobbyBackButton',  sl => sl.getAxisSlot(2));
        insert('teamList -> teamMember',    sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1), UnitPc(1/4)) ]);
        insert('teamMember -> playerName',  sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('teamMember -> modelList',   sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.7), UnitPc(1)) ]);
        insert('teamMember -> score',       sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.1), UnitPc(1)) ]);
        insert('modelList -> model', sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1/4), UnitPc(1)) ]);
        insert('model -> content2', sl => sl.getCenteredSlot());
        insert('playerName -> content1', sl => sl.getCenteredSlot());
        insert('score -> content1', sl => sl.getCenteredSlot());
        
        real('game', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.8) ] }));
        real('gameLInfo', () => CenteredSlotter());
        real('gameContent', () => Art({ pixelCount: [ 800, 1000 ] }));
        real('gameRInfo', () => CenteredSlotter());
        insert('main -> game', () => FillParent());
        insert('game -> gameLInfo', sl => sl.getAxisSlot(0));
        insert('game -> gameContent', sl => sl.getAxisSlot(1));
        insert('game -> gameRInfo', sl => sl.getAxisSlot(2));
        
        decals('lobbyTitle', { colour: 'rgba(0, 0, 0, 0.15)' });
        decals('teamList', { colour: 'rgba(0, 0, 0, 0.07)' });
        decals('lobbyChooserButton', { colour: '#d0d0d0' });
        decals('lobbyBackButton', { colour: 'rgba(0, 0, 0, 0.5)', textColour: '#ffffff' });
        decals('playerName', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('score', { colour: 'rgba(0, 0, 0, 0.2)' });
        decals('game', { colour: '#000000', textColour: '#ffffff' });
        decals('gameLInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        decals('gameRInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        
      });
      
      let webApp = WebApp('fly');
      await webApp.decorateHut(flyHut, rootReal);
      
      /// {ABOVE=
      let fly = flyHut.createRec('fly.fly', [ flyHut ]);
      let termBank = term.TermBank();
      
      let flyInfoDoc = foundation.getKeep('fileSystem', [ 'room', 'fly', 'info.html' ]);
      flyHut.roadNozz('fly.info').route(({ reply }) => reply(flyInfoDoc));
      
      let resourceKeep = foundation.getKeep('fileSystem', [ 'room', 'fly', 'resource' ]);
      let resourceNames = await resourceKeep.getContent();
      for (let rn of resourceNames) {
        let resource = resourceKeep.to(rn);
        flyHut.roadNozz(`fly.sprite.${rn.split('.')[0]}`).route(({ reply }) => reply(resource));
      }
      
      // Note that a commercial airliner flies at ~ 500 miles/hr, or 223 meters/sec
      
      let testLobby = flyHut.createRec('fly.lobby', [ fly ], { id: 'TEST', allReadyMs: null });
      let testGame = flyHut.createRec('fly.game', [ fly, testLobby ], { dist: 0, aheadSpd: 100, respawns: 10 });
      /// =ABOVE}
      
      let rootScp = RecScope(flyHut, 'fly.fly', async (fly, dep) => {
        
        /// {ABOVE=
        
        // Manage Huts
        dep.scp(flyHut, 'lands.kidHut/par', ({ members: { kid: hut } }, dep) => {
          
          let kidHutDep = dep;
          let { value: term } = dep(termBank.checkout());
          let player = dep(flyHut.createRec('fly.player', [], { term, name: null }));
          let hutPlayer = flyHut.createRec('fly.hutPlayer', [ hut, player ]);
          
          let lobbyPlayerNozz = player.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          dep.scp(lobbyPlayerDryNozz, (noGame, dep) => {
            
            // Players outside of Lobbies can edit their name
            dep(hut.roadNozz('lobbySetName').route(({ msg: { name } }) => player.modVal(v => v.gain({ name }))));
            
            // Players outside of Lobbies can join a Lobby
            dep(hut.roadNozz('joinLobby').route(({ msg: { lobbyId=null } }) => {
              
              // If id is specified, join that specific Lobby. Otherwise
              // create a new Lobby
              
              let lobby = null;
              if (lobbyId) {
                let allLobbies = fly.relNozz('fly.lobby').set.toArr(v => v);
                let findLobby = allLobbies.find(l => l.val.id === lobbyId);
                if (!findLobby) throw Error('Invalid lobby id');
                lobby = findLobby[0];
              } else {
                let randInt = Math.floor(Math.random() * Math.pow(62, 4));
                lobby = flyHut.createRec('fly.lobby', [ fly ], {
                  // The id used to get into the lobby
                  id: `${U.base62(randInt).padHead(4, '0')}`,
                  
                  // The time in millis all Players signalled ready (or
                  // `null`, if a Player isn't ready)
                  allReadyMs: null
                });
              }
              
              if (lobby.relNozz('fly.lobbyPlayer').set.size >= 4) throw Error('Lobby full');
              
              flyHut.createRec('fly.lobbyPlayer', [ lobby, player ], { model: null, score: 0 });
              
            }));
            
          });
          
          // Follows
          dep(hut.followRec(fly));
          dep(hut.followRec(hutPlayer));
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            // Follow Lobby, all LobbyPlayers, the Game, and all Sprites
            // that are visible within the Game
            
            let lobby = myLobbyPlayer.members['fly.lobby'];
            
            dep(hut.followRec(lobby));
            
            dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => dep(hut.followRec(lobbyPlayer)));
            dep.scp(lobby, 'fly.game', (game, dep) => {
              
              dep.scp(game, 'fly.gamePlayer', (gamePlayer, dep) => dep(hut.followRec(gamePlayer)));
              
              // Follow the Sprite belonging to each SpriteIden
              dep.scp(game, 'fly.spriteIden', (spriteIden, dep) => {
                dep.scp(spriteIden, 'fly.sprite', (sprite, dep) => dep(hut.followRec(sprite)));
              });
              
            });
            
          });
          
          // TEST
          if (hut.uid.length !== 3) return; // Accept the 3-letter uids from quadTest
          
          player.modVal(v => (v.name = 'testy', v));
          let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null, score: 0 });
          let gamePlayer = flyHut.createRec('fly.gamePlayer', [ testGame, player ], { deaths: 0, damage: 0 });
          
          let model = 'joust';
          let data = { x: 0, y: 0, model, name: 'testy', ...modelDef[model].initValues };
          
          let entity = flyHut.createRec('fly.entity', [ testGame ], { aliveMs: foundation.getMs(), type: 'ace', data, control: { x: 0, y: 0, a1: false, a2: false } });
          flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, entity ]);
          
        });
        
        // Lobby
        dep.scp(fly, 'fly.lobby', (lobby, dep) => {
          
          let lobbyPlayerNozz = lobby.relNozz('fly.lobbyPlayer');
          
          // Make a LivingSet, tracking LobbyPlayers
          let lobbyPlayers = Set();
          let lobbyPlayersNozz = Nozz();
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            lobbyPlayers.add(lobbyPlayer);
            lobbyPlayersNozz.drip(lobbyPlayers);
            
            dep(Drop(null, () => {
              lobbyPlayers.rem(lobbyPlayer);
              lobbyPlayersNozz.drip(lobbyPlayers);
            }));
          });
          
          // Make a LivingSet, tracking LobbyPlayers who are Ready
          let readyPlayers = Set();
          let readyPlayersNozz = Nozz();
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            dep(lobbyPlayer.route(({ model }) => {
              readyPlayers[model ? 'add' : 'rem'](lobbyPlayer);
              readyPlayersNozz.drip(readyPlayers);
            }));
            
            dep(Drop(null, () => {
              readyPlayers.rem(lobbyPlayer);
              readyPlayersNozz.drip(readyPlayers);
            }));
          });
          
          // Nozzes to track if the start countdown is running
          let allPlayersReadyNozz = dep(CondNozz({ numLobby: lobbyPlayersNozz, numReady: readyPlayersNozz }, args => {
            return (args.numLobby.size === args.numReady.size) ? 'ready' : C.skip;
          }, { numLobby: Set(), numReady: Set() }));
          let notAllPlayersReadyNozz = dep(TubDry(null, allPlayersReadyNozz));
          
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            let player = lobbyPlayer.members['fly.player'];
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              let hut = hutPlayer.members['lands.hut'];
              
              dep.scp(notAllPlayersReadyNozz, (notReady, dep) => {
                
                // When some Players aren't ready models can be set
                // freely, and Players can exit the Lobby freely
                
                dep(hut.roadNozz('lobbySetModel').route(({ msg: { model } }) => lobbyPlayer.modVal(v => v.gain({ model }))));
                dep(hut.roadNozz('lobbyExit').route(() => lobbyPlayer.dry()));
                
              });
              dep.scp(allPlayersReadyNozz, (allReady, dep) => {
                
                // When all Players are Ready, the model can only be set
                // to `null` (unreadying the Player), and exiting the
                // Lobby resets all Player's models to `null`
                
                dep(hut.roadNozz('lobbySetModel').route(() => lobbyPlayer.modVal(v => v.gain({ model: null }))));
                dep(hut.roadNozz('lobbyExit').route(() => {
                  lobbyPlayer.dry();
                  for (let lp of lobbyPlayers) lp.modVal(v => v.gain({ model: null }));
                }));
                
              });
              
            });
            
            /*
            // LobbyPlayers can change their model and readiness until
            // the Game begins
            let lobby = lobbyPlayer.members['fly.lobby'];
            let lobbyGameNozz = lobby.relNozz('fly.game');
            let lobbyGameDryNozz = dep(TubDry(null, lobbyGameNozz));
            
            dep.scp(allPlayersReadyNozz, (allReady, dep) => {
              
              
              
              
            });
            
            dep.scp(lobbyGameDryNozz, (noGame, dep) => {
              dep(hut.roadNozz('lobbySetModel').route(({ msg: { model } }) => {
                lobbyPlayer.modVal(v => v.gain({ model }));
              }));
              dep(hut.roadNozz('lobbyExit').route(() => {
                // When a Player exits their LobbyPlayer
                lobbyPlayer.dry();
                lobbyPlayers.forEach(lp => lp.modVal(v => v.gain({ model: null })));
              }));
            });
            */
            
          });
          
          dep.scp(notAllPlayersReadyNozz, (notReady, dep) => {
            lobby.modVal(v => v.gain({ allReadyMs: null }));
          });
          dep.scp(allPlayersReadyNozz, (ready, dep) => {
            
            // When all Players are ready we modify the Lobby indicating
            // the Game is starting, and begin a Game after 5000ms
            lobby.modVal(v => v.gain({ allReadyMs: foundation.getMs() }));
            let timeout = setTimeout(() => {
              let game = flyHut.createRec('fly.game', [ fly, lobby ], { dist: 0, aheadSpd: 100, respawns: 10 });
              let ms = foundation.getMs();
              for (let lobbyPlayer of lobby.relNozz('fly.lobbyPlayer').set) {
                let player = lobbyPlayer.members['fly.player'];
                let gamePlayer = flyHut.createRec('fly.gamePlayer', [ game, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                console.log(`INIT PLAYER FOR NEW GAME WITH MODEL ${model}`);
                let data = { x: Math.round(Math.random() * 200 - 100), y: 0, model, name: player.val.name, ...modelDef[model].initValues };
                
                let entity = flyHut.createRec('fly.entity', [ game ], { aliveMs: ms, type: 'ace', data, control: { x: 0, y: 0, a1: false, a2: false } });
                flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, entity ]);
              }
            }, 5000);
            dep(Drop(null, () => clearTimeout(timeout)));
            
          });
          
        });
        
        // Game
        dep.scp(fly, 'fly.game', (game, dep) => {
          
          // Get GamePlayer->GamePlayerEntity and HutPlayer. HutPlayer's
          // commands cause changes to the GamePlayerEntity
          dep.scp(game, 'fly.gamePlayer', (gamePlayer, dep) => {
            
            let player = gamePlayer.members['fly.player'];
            
            dep.scp(gamePlayer, 'fly.gamePlayerEntity', (gamePlayerEntity, dep) => {
              let entity = gamePlayerEntity.members['fly.entity'];
              
              dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
                
                let hut = hutPlayer.members['lands.hut'];
                dep(hut.roadNozz('keys').route(({ msg: { keyVal } }) => {
                  
                  // Will contain "left", "right", "up", "down", "act1", "act2"
                  let keys = [];
                  for (let i = 0; i < 6; i++) keys.push((keyVal & (1 << i)) >> i);
                  
                  let vx = keys[1] - keys[0];
                  let vy = keys[2] - keys[3];
                  entity.modVal(val => (val.control = { x: vx, y: vy, a1: !!keys[4], a2: !!keys[5] }, val));
                  
                }));
                
              });
            
            });
            
          });
          
          let level = 'plains';
          let moments = levels[level].moments.toArr(v => v);
          let entities = game.relNozz('fly.entity').set;
          let momentTotalDist = 0;
          
          let interval = setInterval(() => {
            
            let ms = foundation.getMs();
            
            for (let e of entities) updateEntity(ms, game, e);
            
            // The game moves ahead
            game.modVal(v => (v.dist += v.aheadSpd * spf, v));
            
            // Check for the next Moment; apply it if necessary!
            let dist = game.val.dist;
            if (dist >= (momentTotalDist + moments[0].dist)) {
              
              let { dist, name='anonMoment', entities=[] } = moments.shift();
              momentTotalDist += dist;
              
              console.log(`Hit moment: ${level}.${name}`);
              
              for (let ent of entities) {
                
                let [ category, name, x, y ] = ent;
                if (category === 'enemy') {
                  
                  flyHut.createRec('fly.entity', [ game ], { type: name, aliveMs: ms, data: {
                    x, y: momentTotalDist + y, // `y` is relative to the `momentTotalDist` (dist quantized by moments)
                    ...enemyDef[name].initValues
                  }});
                  
                } else {
                  
                  throw Error('Category??', category);
                  
                }
                
              }
              
            }
            if (!moments.length) game.dry();
            
          }, spf * 1000);
          dep(Drop(null, () => clearInterval(interval)));
          
        });
        
        /// =ABOVE} {BELOW=
        
        global.fly = fly;
        dep(Drop(null, () => { delete global.fly; }));
        
        let flyRootReal = dep(rootReal.techReals[0].addReal('fly.root'));
        let mainReal = flyRootReal.addReal('fly.main');
        
        dep.scp(flyHut, 'fly.hutPlayer', (myHutPlayer, dep) => {
          
          let myPlayer = myHutPlayer.members['fly.player'];
          let lobbyPlayerNozz = myPlayer.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          
          dep.scp(lobbyPlayerDryNozz, (noLobbyPlayer, dep) => {
            
            let lobbyChooserReal = dep(mainReal.addReal('fly.lobbyChooser'));
            let content = lobbyChooserReal.addReal('fly.lobbyChooserContent');
            let nameReal = content.addReal('fly.lobbyNameField');
            let lobbyIdFieldReal = content.addReal('fly.lobbyChooserField');
            let buttonReal = content.addReal('fly.lobbyChooserButton');
            let buttonRealContent = buttonReal.addReal('fly.content1');
            
            // Typing in a Lobby name attempts to join that Lobby.
            // Leaving it blank creates a new Lobby
            lobbyIdFieldReal.textNozz().route(val => {
              buttonRealContent.setText(val ? 'Join Lobby' : 'New Lobby');
            });
            
            // Player name syncs through the name field
            myPlayer.route(({ name }) => nameReal.setText(name || ''));
            nameReal.textNozz().route(name => flyHut.tell({ command: 'lobbySetName', name }));
            
            buttonReal.feelNozz().route(v => {
              flyHut.tell({ command: 'joinLobby', lobbyId: lobbyIdFieldReal.textNozz().val });
            });
            
          });
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            let myPlayer = myLobbyPlayer.members['fly.player'];
            let lobby = myLobbyPlayer.members['fly.lobby'];
            
            let lobbyReal = dep(mainReal.addReal('fly.lobby'));
            let lobbyTitle = lobbyReal.addReal('fly.lobbyTitle').addReal('fly.content1');
            let teamListReal = lobbyReal.addReal('fly.teamList');
            
            dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => {
              
              let isMine = lobbyPlayer === myLobbyPlayer;
              
              let player = lobbyPlayer.members['fly.player'];
              let teamMemberReal = dep(teamListReal.addReal('fly.teamMember'));
              let nameReal = teamMemberReal.addReal('fly.playerName').addReal('fly.content2');
              
              let modelListReal = teamMemberReal.addReal('fly.modelList');
              let scoreReal = teamMemberReal.addReal('fly.score').addReal('fly.content3');
              let modelReals = modelDef.map(({ name }, model) => {
                
                let modelReal = modelListReal.addReal('fly.model');
                modelReal.addReal('fly.content3').setText(name);
                
                if (isMine) {
                  dep(modelReal.feelNozz().route(() => {
                    flyHut.tell({ command: 'lobbySetModel', model: model === lobbyPlayer.val.model ? null : model });
                  }));
                }
                
                return modelReal;
                
              });
              
              teamMemberReal.setColour(isMine ? '#f8c0a0' : '#f0f0f0');
              
              dep(player.route(({ name }) => nameReal.setText(name || '<anon>')));
              dep(lobbyPlayer.route(({ model, score }) => {
                
                scoreReal.setText(`${score} Pts`);
                modelReals.forEach((modelReal, k) => {
                  modelReal.setBorder(k === model ? UnitPx(10) : UnitPx(0), isMine ? '#ff9000' : '#a8a8a8');
                });
                
              }));
              
            });
            
            let startCountdownNozz = dep(CondNozz({ lobby }, (args, condNozz) => {
              let { allReadyMs } = args.lobby;
              if (!allReadyMs) return C.skip;
              condNozz.dryContents();
              return allReadyMs;
            }));
            
            // Set the title of the Lobby based on readiness
            dep(lobby.route(({ allReadyMs }) => lobbyTitle.setText(allReadyMs ? `Starting...` : `Lobby @ [${lobby.val.id}]`)));
            
            dep.scp(startCountdownNozz, (starting, dep) => {
              
              let allReadyMs = starting.result;
              let interval = setInterval(() => {
                
                let ms = foundation.getMs();
                let amt = (ms - allReadyMs) / 5000; // where 5000 is the delay before a Game starts
                
                if (amt < 1) {
                  lobbyReal.setOpacity(Math.pow(1 - amt, 1.5));
                } else {
                  lobbyReal.setOpacity(0);
                  clearInterval(interval);
                }
                
              }, 500);
              
              dep(Drop(null, () => { lobbyReal.setOpacity(null); clearInterval(interval); }));
              
            });
            
            let lobbyBackButton = lobbyReal.addReal('fly.lobbyBackButton');
            dep(lobbyBackButton.feelNozz().route(() => flyHut.tell({ command: 'lobbyExit' })));
            lobbyBackButton.addReal('fly.content3').setText(`Leave Lobby`)
            
            let myGamePlayerNozz = myPlayer.relNozz('fly.gamePlayer');
            let myGamePlayerDryNozz = dep(TubDry(null, myGamePlayerNozz));
            dep.scp(myGamePlayerDryNozz, (noGamePlayer, dep) => lobbyReal.setTangible(true));
            dep.scp(myGamePlayerNozz, (myGamePlayer, dep) => lobbyReal.setTangible(false));
            
          });
          
          dep.scp(myPlayer, 'fly.gamePlayer', (myGamePlayer, dep) => {
            
            flyRootReal.setColour('#000000');
            dep(Drop(null, () => rootReal.setColour(null)));
            
            let game = myGamePlayer.members['fly.game'];
            let sprites = game.relNozz('fly.sprite').set;
            
            let gameContainerReal = dep(mainReal.addReal('fly.game'));
            let lInfoReal = gameContainerReal.addReal('fly.gameLInfo');
            let rInfoReal = gameContainerReal.addReal('fly.gameRInfo');
            let gameReal = gameContainerReal.addReal('fly.gameContent');
            
            let { draw, keys } = gameReal;
            
            // Listen to our keys
            dep(keys.nozz.route(keys => {
              
              // A: 65, D: 68, W: 87, S: 83, <: 188, >: 190
              let keyNums = [ 65, 68, 87, 83, 188, 190 ];
              let keyVal = 0;
              for (let i = 0; i < keyNums.length; i++) keyVal += keys.has(keyNums[i]) ? (1 << i) : 0;
              flyHut.tell({ command: 'keys', keyVal });
              
            }));
            
            let doDraw = () => {
              
              let { pxW, pxH } = draw.getDims();
              draw.rect(0, 0, pxW, pxH, { fillStyle: `rgba(200, 180, 255, 1)` });
              draw.frame(() => { draw.trn(pxW >> 1, pxH >> 1); draw.frame(() => {
                
                draw.trn(0, +game.val.dist); // We want to ADD to `hh` in order to translate everything downwards (things are very far up; we translate far up as a result)
                
                //draw.trn(hw, hh + game.val.dist);
                //draw.scl(pxW / w, pxH / h);
                
                //draw.trn(hw, hh - game.val.dist); // Center of canvas and our runner are origin
                //draw.scl(0.8);
                //draw.trn(-myRunner.val.x, -myRunner.val.y);
                
                for (let sprite of sprites) renderSprite(draw, game, sprite);
                  
                // for (let tagRunner of tag.relRecs('tag.tagRunner')) {
                //   let runner = tagRunner.members['tag.runner'];
                //   let { fillColour, bordColour, radius } = typeAttrs[tagRunner.val.type];
                //   let { x, y } = runner.val;
                //   draw.circ(x, y, radius, { fillStyle: fillColour, strokeStyle: bordColour, lineWidth: 1 });
                // }
                
              })});
              
            };
            
            let drawing = true;
            dep(Drop(null, () => drawing = false));
            let drawLoop = () => requestAnimationFrame(() => { if (drawing) { doDraw(); drawLoop(); } });
            drawLoop();
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
