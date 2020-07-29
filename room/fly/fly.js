U.buildRoom({
  name: 'fly',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term', 'flyModels', 'flyLevels' ],
  build: (foundation, record, hinterlands, real, realWebApp, term, models, levels) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, CondNozz, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    let { FixedSize, FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, AxisSlotter, TextSized, Art } = real;
    let { UnitPx, UnitPc } = real;
    let { WebApp } = realWebApp;
    
    let util = {
      fadeAmt: (v1, v2, amt) => v1 * (1 - amt) + v2 * amt,
      fadeVal: (init, amt=0.5) => {
        let fv = {
          val: init,
          to: trg => fv.val = util.fadeAmt(fv.val, trg, amt)
        };
        return fv;
      },
      incCen: function*(n, stepAmt) {
        let start = -0.5 * stepAmt * (n - 1);
        for (let i = 0; i < n; i++) yield start + i * stepAmt;
      }
    };
    let geom = {
      checkForms: (form1, form2, bound1, bound2) => {
        if (form1 === bound1.form && form2 === bound2.form) return [ bound1, bound2 ];
        if (form1 === bound2.form && form2 === bound1.form) return [ bound2, bound1 ];
        return null;
      },
      doCollidePoint: (p1, p2) => p1.x === p2.x && p1.y === p2.y,
      doCollideCircle: (c1, c2) => {
        
        let { x: x1, y: y1, r: r1 } = c1;
        let { x: x2, y: y2, r: r2 } = c2;
        
        let dx = x1 - x2;
        let dy = y1 - y2;
        let tr = r1 + r2;
        
        return (dx * dx + dy * dy) < (tr * tr);
        
      },
      doCollideRect: (r1, r2) => {
        
        let { x: x1, y: y1, w: w1, h: h1 } = r1;
        let { x: x2, y: y2, w: w2, h: h2 } = r2;
        
        return true
          && Math.abs(x1 - x2) < (w1 + w2) * 0.5
          && Math.abs(y1 - y2) < (h1 + h2) * 0.5;
        
      },
      doCollidePointRect: ({ x, y }, r) => {
        let hw = r.w * 0.5;
        let hh = r.h * 0.5;
        x -= r.x; y -= r.y;
        return x > -hw && x < hw && y > -hh && y < hh
      },
      doCollidePointCircle: ({ x, y }, c) => {
        x -= c.x; y -= c.y;
        return (x * x + y * y) < (c.r * c.r);
      },
      doCollideRectCircle: (r, c) => {
        
        let hw = r.w * 0.5;
        let hh = r.h * 0.5;
        let roundingGap = c.r; // Size of gap separating RoundedRect and Rect
        
        // A "plus sign" consisting of two rects, with the notches
        // rounded off by circles, creates a RoundedRect
        // circumscribing the original Rect by a constant gap equal to
        // the radius of the colliding Circle.
        
        return false
          || geom.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w + roundingGap * 2, h: r.h })
          || geom.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w, h: r.h + roundingGap * 2 })
          || geom.doCollidePointCircle(c, { x: r.x - hw, y: r.y - hh, r: roundingGap })
          || geom.doCollidePointCircle(c, { x: r.x + hw, y: r.y - hh, r: roundingGap })
          || geom.doCollidePointCircle(c, { x: r.x + hw, y: r.y + hh, r: roundingGap })
          || geom.doCollidePointCircle(c, { x: r.x - hw, y: r.y + hh, r: roundingGap })
        
      },
      doCollide: (bound1, bound2) => {
        if (bound1.form === bound2.form) {
          if (bound1.form === 'circle') return geom.doCollideCircle(bound1, bound2);
          if (bound1.form === 'rect') return geom.doCollideRect(bound1, bound2);
        } else {
          let [ rect=null, circle=null ] = geom.checkForms('rect', 'circle', bound1, bound2) || [];
          if (rect) return geom.doCollideRectCircle(rect, circle);
        }
        
        throw Error(`No method for colliding ${bound1.form} and ${bound2.form}`);
      },
      containingRect: bound => {
        if (bound.form === 'rect') return bound;
        if (bound.form === 'circle') {
          let size = bound.r << 1;
          return { x: bound.x, y: bound.y, w: size, h: size };
        }
        throw Error(`No clue how to do containing rect for "${bound.form}"`);
      }
    };
    
    let fps = 40; // Server-side ticks per second
    let levelStartingDelay = 1000; // Give players this long to unready
    let initialAheadSpd = 100;
    let testAces = [ 'JoustMan', 'GunGirl', 'SlamKid', 'SalvoLad' ];
    let testing = {
      lives: 10000,
      levelName: 'imposingFields',
      momentName: 'practice1',
      ace: testAces[Math.floor(Math.random() * testAces.length)]
    };
    let badN = (...vals) => vals.find(v => !U.isType(v, Number) || isNaN(v)).found;
    let checkBadN = obj => obj.forEach((v, k) => { if (badN(v)) throw Error(`BAD VAL AT ${k} (${U.nameOf(v)}, ${v})`); });
    let getLevelData = name => ({
      name, ...levels[name].slice('num', 'password'),
      dispName: levels[name].name, dispDesc: levels[name].desc
    });
    
    // Ground buildings with 1-ups (need to slow down aheadSpd for this, or else they move toooo fast??)
    // Move whatever possible from MomentAhead into Moment, then fill out MomentTargetType
    
    let lobbyModelOptions = {
      joust:  { name: 'Joust Man',  size: [16,16], Cls: models.JoustMan },
      gun:    { name: 'Gun Girl',   size: [16,16], Cls: models.GunGirl },
      slam:   { name: 'Slam Kid',   size: [16,16], Cls: models.SlamKid },
      salvo:  { name: 'Salvo Lad',  size: [16,16], Cls: models.SalvoLad }
    };
    
    let open = async () => {
      
      let flyHut = global.hut = await foundation.getRootHut({ heartMs: 1000 * 20 });
      flyHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
      
      flyHut.addTypeClsFn('fly.level', val => models.Level);
      flyHut.addTypeClsFn('fly.entity', val => {
        if (!models.has(val.type)) {
          console.log(val);
          throw Error(`No model class for "${val.type}"`);
        }
        return models[val.type];
      });
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('fly', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        
        real('content1', () => TextSized({ size: UnitPc(2) }));
        real('content2', () => TextSized({ size: UnitPc(1.5) }));
        real('content3', () => TextSized({ size: UnitPc(1) }));
        real('paragraph', () => TextSized({ size: UnitPc(0.9), multiLine: true }));
        
        let centeredText = (name, cNames=[ 'content1', 'content2', 'content3', 'paragraph' ]) => {
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
        
        real('lobby', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.3) ] }));
        real('teamList', () => LinearSlotter({ axis: 'y', dir: '+' }));
        centeredText('lobbyTitle');
        centeredText('lobbyBackButton');
        
        real('teamMember', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('playerName', () => CenteredSlotter());
        real('modelList', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('model', () => AxisSlotter({ axis: 'y', dir: '-', cuts: [ UnitPc(0.15) ] }));
        real('modelName', () => CenteredSlotter());
        real('score', () => CenteredSlotter());
        centeredText('playerName');
        centeredText('modelName');
        centeredText('score');
        insert('model -> modelName', sl => sl.getAxisSlot(0));
        insert('main -> lobby', () => FillParent());
        
        insert('lobby -> lobbyHeader',  sl => sl.getAxisSlot(0));
        insert('lobby -> mapChoice',    sl => sl.getAxisSlot(1));
        insert('lobby -> teamList',     sl => sl.getAxisSlot(2));
        
        // Lobby header
        real('lobbyHeader', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.15), UnitPc(0.7) ] }));
        real('lobbyTitle', () => CenteredSlotter());
        real('lobbyBackButton', () => CenteredSlotter());
        insert('lobbyHeader -> lobbyBackButton', sl => sl.getAxisSlot(0));
        insert('lobbyHeader -> lobbyTitle', sl => sl.getAxisSlot(1));
        
        // Map chooser
        real('mapChoice', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.01), UnitPc(0.24), UnitPc(0.01), UnitPc(0.73) ] }));
        
        real('mapChoiceEntry', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.2), UnitPc(0.3), UnitPc(0.05), UnitPc(0.3) ] }));
        real('mapChoiceField', () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Passcode' }));
        real('mapChoiceButton', () => CenteredSlotter());
        insert('mapChoice -> mapChoiceEntry', sl => sl.getAxisSlot(1));
        insert('mapChoiceEntry -> mapChoiceField', sl => [ sl.getAxisSlot(1) ]);
        insert('mapChoiceEntry -> mapChoiceButton', sl => [ sl.getAxisSlot(3) ]);
        
        real('mapChoiceContentHolder', () => CenteredSlotter());
        real('mapChoiceContent', () => LinearSlotter({ axis: 'y', dir: '+' }));
        real('mapChoiceTitle', () => CenteredSlotter());
        real('mapChoiceDesc', () => CenteredSlotter());
        insert('mapChoice -> mapChoiceContentHolder', sl => sl.getAxisSlot(3));
        insert('mapChoiceContentHolder -> mapChoiceContent', sl => sl.getCenteredSlot());
        insert('mapChoiceContent -> mapChoiceTitle', sl => sl.getLinearSlot());
        insert('mapChoiceContent -> mapChoiceDesc', sl => sl.getLinearSlot());
        centeredText('mapChoiceButton');
        centeredText('mapChoiceTitle');
        centeredText('mapChoiceDesc');
        
        // Player list
        insert('teamList -> teamMember',    sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1), UnitPc(1/4)) ]);
        insert('teamMember -> playerName',  sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('teamMember -> modelList',   sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.6), UnitPc(1)) ]);
        insert('teamMember -> score',       sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('modelList -> model', sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1/4), UnitPc(1)) ]);
        insert('playerName -> content1', sl => sl.getCenteredSlot());
        insert('score -> content1', sl => sl.getCenteredSlot());
        
        real('level', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.8) ] }));
        real('levelLInfo', () => CenteredSlotter());
        real('levelContent', () => Art({ pixelCount: [ 800, 1000 ] }));
        real('levelRInfo', () => CenteredSlotter());
        real('levelDispLives', () => TextSized({ size: UnitPc(0.8) }));
        insert('main -> level', () => FillParent());
        insert('level -> levelLInfo', sl => sl.getAxisSlot(0));
        insert('level -> levelContent', sl => sl.getAxisSlot(1));
        insert('level -> levelRInfo', sl => sl.getAxisSlot(2));
        insert('levelLInfo -> levelDispLives', sl => sl.getCenteredSlot());
        
        decals('lobbyHeader', { colour: 'rgba(0, 0, 0, 0.15)' });
        decals('teamList', { colour: 'rgba(0, 0, 0, 0.07)' });
        decals('lobbyChooserButton', { colour: '#d0d0d0' });
        decals('lobbyBackButton', { colour: 'rgba(0, 0, 0, 0.5)', textColour: '#ffffff' });
        decals('playerName', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('mapChoiceButton', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('score', { colour: 'rgba(0, 0, 0, 0.2)' });
        decals('level', { colour: '#000000', textColour: '#ffffff' });
        decals('levelLInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        decals('levelRInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        
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
      
      let testLobby = null;
      let testLevel = null;
      /// =ABOVE}
      
      let rootScp = RecScope(flyHut, 'fly.fly', async (fly, dep) => {
        
        /// {ABOVE=
        
        // Manage Huts
        dep.scp(flyHut, 'lands.kidHut/par', ({ mems: { kid: hut } }, dep) => {
          
          let kidHutDep = dep;
          let { value: term } = dep(termBank.checkout());
          let player = dep(flyHut.createRec('fly.player', [], { term, name: null, score: 0, deaths: 0 }));
          let hutPlayer = flyHut.createRec('fly.hutPlayer', [ hut, player ]);
          
          let lobbyPlayerNozz = player.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          dep.scp(lobbyPlayerDryNozz, (noLevel, dep) => {
            
            // Players outside of Lobbies can edit their name
            dep(hut.roadNozz('lobbySetName').route(({ msg: { name } }) => player.modVal(v => v.gain({ name }))));
            
            // Players outside of Lobbies can join a Lobby
            dep(hut.roadNozz('joinLobby').route(({ msg: { lobbyId=null } }) => {
              
              // If id is specified, join that specific Lobby. Otherwise
              // create a new Lobby
              
              let lobby = null;
              if (lobbyId) {
                let allLobbies = fly.relNozz('fly.lobby').set.toArr(v => v);
                let lobby = allLobbies.find(l => l.val.id === lobbyId).val;
                if (!lobby) throw Error('Invalid lobby id');
              } else {
                let randInt = Math.floor(Math.random() * Math.pow(62, 4));
                lobby = flyHut.createRec('fly.lobby', [ fly ], {
                  // The id used to get into the lobby
                  id: `${U.base62(randInt).padHead(4, '0')}`,
                  
                  // Level values
                  level: getLevelData('rustlingMeadow'),
                  
                  // The time in millis all Players signalled ready (or
                  // `null`, if a Player isn't ready)
                  allReadyMs: null
                });
                
                // This route only occurs when the Lobby is initially
                // created. It waits for the Lobby to be non-empty, then
                // waits for it to become empty again (at which point
                // the Lobby is cleaned up).
                let lobbyHasPlayerNozz = lobby.relNozz('fly.lobbyPlayer');
                let lobbyNoPlayersNozz = TubDry(null, lobbyHasPlayerNozz); // Don't `dep` this
                let route = lobbyHasPlayerNozz.route(() => {
                  route.dry();
                  lobbyNoPlayersNozz.route(() => lobby.dry());
                });
              }
              
              if (lobby.relNozz('fly.lobbyPlayer').set.size >= 4) throw Error('Lobby full');
              
              flyHut.createRec('fly.lobbyPlayer', [ lobby, player ], { model: null });
              
            }));
            
          });
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            
            dep(hut.roadNozz('lobbyPass').route(({ msg: { pass } }) => {
              let { key: levelName, val: level } = levels.find(v => v.password === pass);
              if (!level) return;
              
              let lobby = lobbyPlayer.mems['fly.lobby'];
              for (let lp of lobby.relNozz('fly.lobbyPlayer').set) lp.modVal(v => (v.model = null, v));
              lobby.modVal(v => (v.level = getLevelData(levelName), v));
            }));
            
          });
          
          // Follows
          let followFn = (v, dep) => dep(hut.followRec(v));
          followFn(fly, dep);
          followFn(hutPlayer, dep);
          dep.scp(player, 'fly.levelPlayer', (levelPlayer, dep) => {
            dep.scp(levelPlayer, 'fly.levelPlayerEntity', followFn);
          });
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            // Follow Lobby, all LobbyPlayers, the Level, and all Sprites
            // that are visible within the Level
            
            let lobby = myLobbyPlayer.mems['fly.lobby'];
            
            dep(hut.followRec(lobby));
            
            dep.scp(lobby, 'fly.lobbyPlayer', followFn);
            dep.scp(lobby, 'fly.level', (level, dep) => {
              
              // Follow the LevelPlayer
              dep.scp(level, 'fly.levelPlayer', followFn);
              
              // Follow Entities and Sprites when we can see the Sprite
              dep.scp(level, 'fly.entity', (e, dep) => dep.scp(e, 'fly.sprite', followFn));
              
            });
            
          });
          
          // TODO: The following Error produces a weird "cannot read property 'tell'..." error:
          // throw Error('HAH');
          
          if (testing && hut.uid.length === 3) setTimeout(() => {
            
            if (!testLobby) {
              
              // Corrupt the level definition
              let { levelName, momentName } = testing;
              let levelDef = levels[levelName];
              if (momentName) {
                levelDef.moments = levelDef.moments.toArr(v => v);
                let { ind, val: firstMoment } = levelDef.moments.find(m => m.name === momentName);
                
                if (!firstMoment.bounds) {
                  for (let i = ind; i >= 0; i--) {
                    if (levelDef.moments[i].has('bounds')) {
                      firstMoment.bounds = levelDef.moments[i].bounds;
                      break;
                    }
                  }
                }
                
                let testMoments = [
                  { name: 'test', type: 'MomentAhead', terrain: 'plains',
                    dist: firstMoment.bounds.total.h, spd: 200,
                    bounds: firstMoment.bounds,
                    models: []
                  },
                  { name: 'testTrn', type: 'MomentAhead', terrain: 'plainsToMeadow',
                    dist: 250, spd: 200,
                    bounds: firstMoment.bounds,
                    models: []
                  }
                ];
                levelDef.moments = [ ...testMoments, ...levelDef.moments.slice(ind) ];
              }
              
              let ms = foundation.getMs();
              testLobby = flyHut.createRec('fly.lobby', [ fly ], { 
                id: 'TEST', allReadyMs: null,
                level: getLevelData(levelName)
              });
              testLevel = flyHut.createRec('fly.level', [ fly, testLobby ], { ud: { ms }, levelDef, flyHut, lives: testing.lives });
              
            }
            
            player.modVal(v => (v.name = 'testy', v));
            let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null });
            let levelPlayer = flyHut.createRec('fly.levelPlayer', [ testLevel, player ], { deaths: 0, damage: 0 });
            
            let ms = foundation.getMs();
            let entity = flyHut.createRec('fly.entity', [ testLevel ], {
              ud: { ms },
              type: testing.ace,
              ax: Math.round(Math.random() * 200 - 100), ay: -200
            });
            
            // Connect this Entity to the LevelPlayer
            flyHut.createRec('fly.levelPlayerEntity', [ levelPlayer, entity ]);
            
          }, 500);
          
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
            return (args.numLobby.size > 0 && args.numLobby.size === args.numReady.size) ? 'ready' : C.skip;
          }, { numLobby: Set(), numReady: Set() }));
          let notAllPlayersReadyNozz = dep(TubDry(null, allPlayersReadyNozz));
          
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            let player = lobbyPlayer.mems['fly.player'];
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              let hut = hutPlayer.mems['lands.hut'];
              
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
            
          });
          
          dep.scp(notAllPlayersReadyNozz, (notReady, dep) => {
            lobby.modVal(v => v.gain({ allReadyMs: null }));
          });
          dep.scp(allPlayersReadyNozz, (ready, dep) => {
            
            // When all Players are ready we modify the Lobby indicating
            // the Level is starting, and begin a Level after 5000ms
            lobby.modVal(v => v.gain({ allReadyMs: foundation.getMs() }));
            let timeout = setTimeout(() => {
              let ms = foundation.getMs();
              let levelDef = levels[lobby.val.level.name];
              let level = flyHut.createRec('fly.level', [ fly, lobby ], { ud: { ms }, levelDef, flyHut });
              
              let lobbyPlayers = lobby.relNozz('fly.lobbyPlayer').set;
              for (let lobbyPlayer of lobbyPlayers) {
                let player = lobbyPlayer.mems['fly.player'];
                let levelPlayer = flyHut.createRec('fly.levelPlayer', [ level, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                let ace = flyHut.createRec('fly.entity', [ level ], {
                  ud: { ms }, type: lobbyModelOptions[model].Cls.name, name: player.val.name,
                  ax: Math.round(Math.random() * 200 - 100), ay: -200
                });
                
                flyHut.createRec('fly.levelPlayerEntity', [ levelPlayer, ace ]);
                
              }
              for (let lobbyPlayer of lobbyPlayers) lobbyPlayer.modVal(v => (v.model = null, v));
            }, levelStartingDelay);
            dep(Drop(null, () => clearTimeout(timeout)));
            
          });
          
        });
        
        // Level Controls per Player
        dep.scp(fly, 'fly.level', (level, dep) => { dep.scp(level, 'fly.levelPlayer', (gp, dep) => {
          
          // Get a LevelPlayerEntity and a HutPlayer at the same time.
          // Overall commands from the HutPlayer's Hut effect the
          // LevelPlayerEntity's Entity!
          let player = gp.mems['fly.player'];
          dep.scp(gp, 'fly.levelPlayerEntity', ({ mems: { 'fly.entity': entity } }, dep) => {
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              
              let hut = hutPlayer.mems['lands.hut'];
              dep(hut.roadNozz('keys').route(({ msg: { keyVal }, ms }) => {
                
                // Will contain "left", "right", "up", "down", "act1", "act2"
                let keys = [];
                for (let i = 0; i < 6; i++) keys.push((keyVal & (1 << i)) >> i);
                
                if (keys[0] !== entity.controls.l[0]) entity.controls.l = [ keys[0], ms ];
                if (keys[1] !== entity.controls.r[0]) entity.controls.r = [ keys[1], ms ];
                if (keys[2] !== entity.controls.u[0]) entity.controls.u = [ keys[2], ms ];
                if (keys[3] !== entity.controls.d[0]) entity.controls.d = [ keys[3], ms ];
                if (keys[4] !== entity.controls.a1[0]) entity.controls.a1 = [ keys[4], ms ];
                if (keys[5] !== entity.controls.a2[0]) entity.controls.a2 = [ keys[5], ms ];
                
              }));
              
            });
          
          });
          
        })});
        
        // Level
        dep.scp(fly, 'fly.level', (level, dep) => {
          
          let levelDef = levels[level.val.level];
          
          let spf = 1 / fps;  // Seconds per server-side tick
          
          let running = true;
          dep(Drop(null, () => running = false));
          
          let frame = () => {
            
            let ms = foundation.getMs();
            if (!running) return;
            
            level.update(ms, spf)
            
            let frameDurMs = foundation.getMs() - ms;
            setTimeout(frame, spf * 1000 - frameDurMs);
            
          };
          frame();
          
        });
        
        /// =ABOVE} {BELOW=
        
        global.fly = fly;
        dep(Drop(null, () => { delete global.fly; }));
        
        let flyRootReal = dep(rootReal.techReals[0].addReal('fly.root'));
        let mainReal = flyRootReal.addReal('fly.main');
        
        // Lobby
        dep.scp(flyHut, 'fly.hutPlayer', (myHutPlayer, dep) => {
          
          let myPlayer = myHutPlayer.mems['fly.player'];
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
            
            let myPlayer = myLobbyPlayer.mems['fly.player'];
            let lobby = myLobbyPlayer.mems['fly.lobby'];
            let lobbyReal = dep(mainReal.addReal('fly.lobby'));
            
            let lobbyHeaderReal = lobbyReal.addReal('fly.lobbyHeader');
            let lobbyTitle = lobbyHeaderReal.addReal('fly.lobbyTitle').addReal('fly.content1');
            let lobbyBackButton = lobbyHeaderReal.addReal('fly.lobbyBackButton');
            dep(lobbyBackButton.feelNozz().route(() => flyHut.tell({ command: 'lobbyExit' })));
            lobbyBackButton.addReal('fly.content3').setText(`Leave Lobby`);
            
            let mapChoiceReal = lobbyReal.addReal('fly.mapChoice');
            let mapChoiceContentReal = mapChoiceReal.addReal('fly.mapChoiceContentHolder').addReal('fly.mapChoiceContent');
            let mapChoiceTitleReal = mapChoiceContentReal.addReal('fly.mapChoiceTitle').addReal('fly.content2');
            let mapChoiceDescReal = mapChoiceContentReal.addReal('fly.mapChoiceDesc').addReal('fly.paragraph');
            
            let mapChoiceEntryReal = mapChoiceReal.addReal('fly.mapChoiceEntry');
            let mapChoiceFieldReal = mapChoiceEntryReal.addReal('fly.mapChoiceField');
            let mapChoiceButtonReal = mapChoiceEntryReal.addReal('fly.mapChoiceButton');
            let mapChoiceButtonTextReal = mapChoiceButtonReal.addReal('fly.content2');
            dep(mapChoiceButtonReal.feelNozz().route(() => {
              let pass = mapChoiceFieldReal.textNozz().val;
              mapChoiceFieldReal.setText('');
              flyHut.tell({ command: 'lobbyPass', pass });
            }));
            dep(lobby.route(({ level }) => {
              let { num, name, password, dispName, dispDesc } = level;
              mapChoiceTitleReal.setText(`Stage #${num + 1}: ${dispName}`);
              mapChoiceDescReal.setText(dispDesc);
              mapChoiceFieldReal.setText(password);
            }));
            mapChoiceButtonTextReal.setText('Submit');
            
            let teamListReal = lobbyReal.addReal('fly.teamList');
            dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => {
              
              let isMine = lobbyPlayer === myLobbyPlayer;
              
              let player = lobbyPlayer.mems['fly.player'];
              let teamMemberReal = dep(teamListReal.addReal('fly.teamMember'));
              let nameReal = teamMemberReal.addReal('fly.playerName').addReal('fly.content2');
              
              let modelListReal = teamMemberReal.addReal('fly.modelList');
              let scoreReal = teamMemberReal.addReal('fly.score').addReal('fly.content3');
              
              let modelReals = lobbyModelOptions.map(({ name }, model) => {
                
                let modelReal = modelListReal.addReal('fly.model');
                modelReal.addReal('fly.modelName').addReal('fly.content3').setText(name);
                modelReal.setImage(
                  foundation.getKeep('urlResource', { path: `fly.sprite.ace${model[0].upper()}${model.slice(1)}` }),
                  { smoothing: false, scale: 0.5 }
                );
                
                if (isMine) {
                  dep(modelReal.feelNozz().route(() => {
                    flyHut.tell({ command: 'lobbySetModel', model: model === lobbyPlayer.val.model ? null : model });
                  }));
                }
                
                return modelReal;
                
              });
              
              teamMemberReal.setColour(isMine ? '#f8c0a0' : '#f0f0f0');
              
              dep(player.route(({ name, score, deaths }) => {
                nameReal.setText(name || '<anon>')
                scoreReal.setText(`Dmg: ${Math.round(score) * 100}\nDeaths: ${deaths}`);
              }));
              dep(lobbyPlayer.route(({ model, score }) => {
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
                let amt = (ms - allReadyMs) / levelStartingDelay; // where 5000 is the delay before a Level starts
                
                if (amt < 1) {
                  lobbyReal.setOpacity(Math.pow(1 - amt, 1.5));
                } else {
                  lobbyReal.setOpacity(0);
                  clearInterval(interval);
                }
                
              }, levelStartingDelay / 10);
              
              dep(Drop(null, () => { lobbyReal.setOpacity(null); clearInterval(interval); }));
              
            });
            
            let myLevelPlayerNozz = myPlayer.relNozz('fly.levelPlayer');
            let myLevelPlayerDryNozz = dep(TubDry(null, myLevelPlayerNozz));
            dep.scp(myLevelPlayerDryNozz, (noLevelPlayer, dep) => {
              lobbyReal.setTangible(true);
              lobbyReal.setOpacity(null);
            });
            dep.scp(myLevelPlayerNozz, (myLevelPlayer, dep) => lobbyReal.setTangible(false));
            
          });
          
        });
        
        // Level
        
        // SHORTHAND:
        //  `dep.scp(flyHut, 'fly.hutPlayer/fly.player', 'fly.levelPlayer', 'fly.levelPlayerEntity/fly.entity', (myEnt, dep) => {
        //    console.log('WENT FROM HUT TO LEVEL TO MY ENTITY WITHIN LEVEL');
        //  })
        
        dep.scp(flyHut, 'fly.hutPlayer', ({ mems: { 'fly.player': p } }, dep) => dep.scp(p, 'fly.levelPlayer', (gp, dep) => {
          
          dep.scp(gp, 'fly.levelPlayerEntity', (gpe, dep) => {
            
            flyRootReal.setColour('#000000');
            dep(Drop(null, () => flyRootReal.setColour(null)));
            
            let level = gp.mems['fly.level'];
            level.flyHut = flyHut;
            
            let myEntity = gpe.mems['fly.entity'];
            let entities = level.relNozz('fly.entity').set;
            let sprites = level.relNozz('fly.sprite').set;
            
            let levelContainerReal = dep(mainReal.addReal('fly.level'));
            let lInfoReal = levelContainerReal.addReal('fly.levelLInfo');
            let rInfoReal = levelContainerReal.addReal('fly.levelRInfo');
            
            let dispLivesReal = lInfoReal.addReal('fly.levelDispLives');
            dep(level.route(v => dispLivesReal.setText(`[${level.val.lives}]`)));
            
            let levelReal = levelContainerReal.addReal('fly.levelContent');
            
            let { draw, keys } = levelReal;
            
            // Listen to our keys
            dep(keys.nozz.route(keys => {
              
              // A: 65, D: 68, W: 87, S: 83, <: 188, >: 190
              let keyNums = [ 65, 68, 87, 83, 188, 190 ];
              let keyVal = 0;
              for (let i = 0; i < keyNums.length; i++) keyVal += keys.has(keyNums[i]) ? (1 << i) : 0;
              flyHut.tell({ command: 'keys', keyVal });
              
            }));
            
            let pixelDims = { w: 800, h: 1000, hw: 400, hh: 500 };
            let fadeXPanVal = util.fadeVal(0, 0.19);
            let fadeYPanVal = util.fadeVal(0, 0.19);
            console.log(level);
            let lastMs = [ level.v('ms'), foundation.getMs(), level.v('y') ];
            let doDraw = () => draw.initFrameCen('rgba(220, 220, 255, 1)', () => {
              
              let ud = {
                ms: level.val.ms,
                spf: (level.v('ms') - lastMs[0]) * 0.001,
                outcome: level.v('outcome'),
                level,
                myEntity,
                entities: entities.toObj(r => [ r.uid, r ]),
                createRec: level.flyHut.createRec.bind(this, flyHut),
                bounds: models.Level.getLevelBounds(level)
              };
              
              if (ud.ms === lastMs[0]) {
                
                // Render before update; compensate for silky smoothness
                let msExtra = foundation.getMs() - lastMs[1];
                ud.ms = lastMs[0] + msExtra;
                
                // Spoof the level as having inched forward a tiny bit
                let addY = level.v('aheadSpd') * msExtra * 0.001;
                
                // Extrapolate aheadDist
                level.v('y', lastMs[2] + addY);
                ud.bounds = models.Level.getLevelBounds(level);
                
              } else {
                
                // Remember the timing of this latest frame
                lastMs = [ ud.ms, foundation.getMs(), level.v('y') ];
                
              }
              
              let { total: tb, player: pb } = ud.bounds;
              let [ mySprite=null ] = myEntity.relNozz('fly.sprite').set;
              
              let visiMult = Math.min(tb.w / pixelDims.w, tb.h / pixelDims.h) * level.val.visiMult;
              let desiredTrn = { x: 0, y: 0 };
              let scaleAmt = 1 / visiMult;
              
              if (mySprite) {
                
                let { x, y } = mySprite.val;
                
                // Percentage of horz/vert dist travelled
                let xAmt = (x - pb.x) / (pb.w * 0.5);
                let yAmt = (y - pb.y) / (pb.h * 0.5);
                
                // If place camera at `+maxFocusX` or `-maxFocusX`, any
                // further right/left and we'll see dead areas
                let seeDistX = pixelDims.hw * visiMult;
                let seeDistY = pixelDims.hh * visiMult;
                let maxFocusX = tb.w * 0.5 - seeDistX;
                let maxFocusY = tb.h * 0.5 - seeDistY;
                desiredTrn = { x: maxFocusX * xAmt, y: maxFocusY * yAmt };
                
                ud.bounds.visible = {
                  form: 'rect',
                  x: desiredTrn.x, y: desiredTrn.y,
                  w: seeDistX * 2, h: seeDistY * 2,
                  l: desiredTrn.x - seeDistX, r: desiredTrn.x + seeDistX,
                  b: desiredTrn.y - seeDistY, t: desiredTrn.y + seeDistY
                };
                
              } else {
                
                ud.bounds.visible = ud.bounds.total;
                
              }
              
              // TODO: Don't follow Ace upon victory!!
              draw.scl(scaleAmt, scaleAmt);
              draw.trn(0, -ud.bounds.total.y);
              draw.trn(-fadeXPanVal.to(desiredTrn.x), -fadeYPanVal.to(desiredTrn.y));
              
              let renders = [];
              for (let sprite of sprites) {
                let entity = sprite.mems['fly.entity'];
                renders.push({ priority: entity.renderPriority(), entity });
              }
              
              for (let { entity } of renders.sort((v1, v2) => v2.priority - v1.priority)) {
                entity.render(ud, draw);
              }
              
              draw.rectCen(tb.x, tb.y, tb.w - 4, tb.h - 4, { strokeStyle: 'rgba(0, 255, 0, 0.1)', lineWidth: 4 });
              draw.rectCen(pb.x, pb.y, pb.w - 4, pb.h - 4, { strokeStyle: 'rgba(0, 120, 0, 0.1)', lineWidth: 4 });
              
            });
            
            let drawing = true;
            dep(Drop(null, () => drawing = false));
            let drawLoop = () => requestAnimationFrame(() => drawing && (doDraw(), drawLoop()));
            drawLoop();
            
          });
          
        }));
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
