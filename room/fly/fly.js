// PLAN:
// [X] Foundation.prototype.getRooms (plural)
// [ ] Clean up Real/Layout API
// [ ] Consider Reals - migrate from a static definition? Add support for
//     predefined Real trees????
// [ ] Fix!

global.rooms['fly'] = async foundation => {
  
  // REAL+LAYOUT:
  // -- Layout is PRM! So no such thing as `someLayout.endWith`
  //    -- This allows some Layouts to subclass Src (useful for
  //       interactable Layouts)
  //    -- Real.prototype.addLayout returns a Tmp with a "layout"
  //       property. This separate Tmp is necessary as the Layout isn't
  //       Endable!
  // -- Real names may have a maximum of one ".", used to delimit the
  //    namespace
  // -- Real.prototype.addReal accepts:
  //    -- A Real instance (simplest case; adds it as a child)
  //    -- A string naming a Real
  //       -- The namespace component of this string is optional
  //       -- The name may relate to some RealTree definition
  //       -- The name may be accompanied by an Object representing Real
  //          params
  //       -- The name may be accompanied by an Array containing a mix
  //          Layout instances and Promises resolving to Layouts
  //          -- In the case of Promises, the Real always resolves
  //             immediately and a best-effort is made to attach the
  //             non-immediately available Layouts as soon as possible
  
  let { TermBank=null, random=null, Setup, HtmlBrowserHabitat, RealTree, levels=null, models } = await foundation.getRooms([
    
    /// {ABOVE=
    'TermBank',
    'random',
    'fly.levels',
    /// =ABOVE}
    
    'hinterlands.Setup',
    'hinterlands.habitat.HtmlBrowserHabitat',
    'internal.real.RealTree',                 // TODO: Shouldn't be a requirement!! (Setup should probably take a "realTree" property??)
    'fly.models'
    
  ]);
  let { Chooser, MemSrc, SetSrc, Src, TimerSrc } = U.logic;
  
  /// {ABOVE=
  let termBank = TermBank();
  let rand = random.FastRandom('fly'.encodeInt());
  /// =ABOVE}
  
  let staticKeep = foundation.seek('keep', 'static');
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
  let getLevelData = name => ({
    name, ...levels[name].slice('num', 'password'),
    dispName: levels[name].name, dispDesc: levels[name].desc
  });
  let lobbyModelOptions = {
    joust:  { name: 'Joust Man',  size: [ 16, 16 ], Form: models.JoustMan },
    gun:    { name: 'Gun Girl',   size: [ 16, 16 ], Form: models.GunGirl },
    slam:   { name: 'Slam Kid',   size: [ 16, 16 ], Form: models.SlamKid },
    salvo:  { name: 'Salvo Lad',  size: [ 16, 16 ], Form: models.SalvoLad }
  };
  
  let realTree = RealTree('fly', (lay, define, insert) => {
    
    let { Axis1D, Scroll, Decal, Geom, Press, Text, TextInput } = lay;
    
    define('root', Geom({ w: '100vmin', h: '100vmin' }));
    
    define('content1', Text({ size: '200%' }));
    define('content2', Text({ size: '150%' }));
    define('content3', Text({ size: '100%' }));
    define('paragraph', Text({ size: '90%', multiline: true }));
    
    define('lobbyChooser',
      Geom({ w: '100%', h: '100%' }),
      Axis1D({ axis: 'y', dir: '+', mode: 'compactCenter' }),
      Decal({ colour: 'rgba(0, 0, 0, 0.1)' })
    );
    define('lobbyChooserTitle',
      Geom({ w: '80%', h: '2em' }),
      Text({ size: '200%', text: 'Join a lobby' }),
      Decal({ colour: 'rgba(0, 0, 0, 0.1)' })
    );
    define('lobbyChooserCodeField',
      Geom({ w: '80%', h: '2em' }),
      TextInput({ size: '200%', prompt: 'Enter code' }),
      Decal({ colour: 'rgba(0, 0, 0, 0.05)' })
    );
    define('lobbyChooserSubmitField',
      Geom({ w: '80%', h: '2em' }),
      Text({ size: '200%' }),
      Press({}),
      Decal({ colour: 'rgba(0, 0, 0, 0.1)' })
    );
    
  });
  
  // Note that a commercial airliner flies at ~ 500 miles/hr, or 223 meters/sec
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
      // the radius of the colliding Circle. If this circumscribing
      // rounded rect contains the Circle's midpoint we know the Rect
      // intersects the Circle.
      
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
  
  return Setup('fly', 'fly', {
    habitats: [ HtmlBrowserHabitat() ],
    recForms: {
      'fly.level': models.Level,
      'fly.entity': val => {
        console.log('Get fly.entity for:', val);
        if (!U.isForm(val, Object) || !val.has('type') || !models.has(val.type)) {
          throw Object.assign(Error(`No model available for modelVal`), { modelVal: val });
        }
        return models[val.type];
      }
    },
    parFn: async (hut, flyRec, real, dep) => {
      
      /// {ABOVE=
      
      dep.scp(hut, 'lands.kidHut/par', (kidHut, dep) => {
        
        // Attach a "fly.player" Rec to every Hut
        let hut = kidHut.mems.kid;
        let termTmp = termBank.hold();
        let player = hut.createRec('fly.player', [], { term: termTmp.term, name: null, score: 0, deaths: 0 });
        let hutPlayer = hut.createRec('fly.hutPlayer', [ hut, player ]);
        player.limit(termTmp);
        
      });
      dep.scp(flyRec, 'fly.lobby', (lobby, dep) => {
        
        let readinessSrc = dep(MemSrc.Prm1({}));
        dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => {
          
          let term = lobbyPlayer.getVal('term');
          
          readinessSrc.update(r => r.gain({ [term]: false }));
          dep(() => readinessSrc.update(r => r.gain({ [term]: C.skip })));
          
          dep(lobbyPlayer.getValSrc().route(() => {
            let modelTerm = lobbyPlayer.getVal('modelTerm');
            readinessSrc.update(r => (r[term] = modelTerm !== null, r));
          }));
          
        });
        
        /* THEORETICALLY:
        SetSrc(lobbyPlayer)
          .map(lp => lp.getValSrc())
          .map(lpVal => lpVal.ready)
          .choose([ 'waiting', 'ready' ], vals => vals.all() ? 'waiting' : 'ready');
        */
        
        let readyChooser = dep(Chooser([ 'waiting', 'ready' ]));
        readinessSrc.route(r => readyChooser.choose(r.all() ? 'ready' : 'waiting'));
        
        dep.scp(readyChooser.srcs.ready, (ready, dep) => {
          
          lobby.objVal({ allReadyMark: foundation.getMs() });
          dep(() => lobby.objVal({ allReadyMark: null }));
          
          let timerSrc = TimerSrc({ ms: levelStartingDelay, num: 1 });
          dep(timerSrc.route(n => {
            
            let ms = foundation.getMs();
            let levelDef = levels[lobby.getVal('level').name];
            let level = hut.createRec('fly.level', [ flyRec, lobby ], { ud: { ms }, ms, levelDef, flyHut: hut });
            
            for (let lobbyPlayer of lobby.relRecs('fly.lobbyPlayer')) {
              
              let player = lobbyPlayer.mems['fly.player'];
              let levelPlayer = hut.createRec('fly.levelPlayer', [ level, player ], { deaths: 0, damage: 0 });
              
              let modelTerm = lobbyPlayer.getVal('modelTerm');
              
              let aceEntity = hut.createRec('fly.entity', [ level ], {
                ud: { ms }, ms, type: lobbyModelOptions[modelTerm].Form.name, name: player.getVal('term'),
                ax: Math.round(Math.random() * 200 - 100), ay: -200
              });
              
              hut.createRec('fly.levelPlayerEntity', [ levelPlayer, aceEntity ]);
              
              lobbyPlayer.objVal({ modelTerm: null });
              
            }
            
          }));
          
        });
        
      });
      /// =ABOVE}
      
    },
    kidFn: async (hut, flyRec, real, dep) => {
      
      let lay = await real.tech.getLayoutForms([
        'Axis1D', 'Decal', 'Geom', 'Press', 'Scroll', 'Size', 'Text', 'TextInput', 'Image'
      ]);
      
      let rootReal = realTree.addReal(real, 'root');
      real.addLayout(lay.Decal({ colour: '#000' }));
      rootReal.addLayout(lay.Decal({ colour: '#fff' }));
      
      let myHutPlayerChooser = dep(Chooser(hut.relSrc('fly.hutPlayer')));
      dep.scp(myHutPlayerChooser.srcs.onn, myHutPlayer => {
        
        let myPlayer = myHutPlayer.mems['fly.player'];
        let myLobbyPlayerChooser = dep(Chooser(myPlayer.relSrc('fly.lobbyPlayer')));
        
        dep.scp(myLobbyPlayerChooser.srcs.off, (noLobbyPlayer, dep) => {
          
          let lobbyChooserReal = dep(rootReal.addReal('lobbyChooser'));
          let titleReal = lobbyChooserReal.addReal('lobbyChooserTitle');
          let codeFieldReal = lobbyChooserReal.addReal('lobbyChooserCodeField');
          let submitFieldReal = lobbyChooserReal.addReal('lobbyChooserSubmitField');
          
          // Change the text of the submit field depending on if there's
          // anything written in the code field
          let codeSrc = codeFieldReal.getLayout(lay.TextInput);
          dep(codeSrc.route(code => {
            submitFieldReal.mod({ text: code.length ? 'Join lobby' : 'Create lobby' });
          }));
          
          // Players not in lobbies are able to join a lobby
          let joinLobbyAct = dep(hut.enableAction('fly.joinLobby', ({ code }) => {
            /// {ABOVE=
            if (code) {
              
              // Find lobby; ensure no more than 4 players per lobby
              let lobby = flyRec.relSrc('fly.lobby').vals.find(lobby => lobby.getVal('code') === code).val;
              if (!lobby) throw Error(`Invalid code`);
              if (lobby.relSrc('fly.lobbyPlayer').vals.count() >= 4) throw Error(`Lobby full`);
              
              hut.createRec('fly.lobbyPlayer', [ lobby, myPlayer ], { modelTerm: null });
              
            } else {
              
              let lobby = hut.createRec('fly.lobby', [ flyRec ], {
                
                // Code used to enter lobby
                code: rand.genInteger(0, Math.pow(62, 4)).encodeStr(C.base62, 4),
                
                // Metadata to display level information
                level: getLevelData('rustlingMeadow'),
                
                // Timestamp at which all players readied up
                allReadyMark: null
                
              });
              
              hut.createRec('fly.lobbyPlayer', [ lobby, myPlayer ], { model: null });
              
              // Track the number of players in the lobby
              let lobbyPlayersSrc = lobby.limit(SetSrc(lobby.relSrc('fly.lobbyPlayer')));
              
              // End the lobby when no players remain
              lobbyPlayersSrc.route(lobbyPlayers => lobbyPlayers.count() || lobby.end());
              
              console.log(`++Lobby @ ${lobby.getVal('code')}`);
              lobby.endWith(() => console.log(`--Lobby @ ${lobby.getVal('code')}`));
              
            }
            /// =ABOVE}
          }));
          
          let submitSrc = submitFieldReal.getLayout(lay.Press);
          dep(submitSrc.route(() => joinLobbyAct.act({ code: codeSrc.val })));
          
        });
        dep.scp(myLobbyPlayerChooser.srcs.onn, (myLobbyPlayer, dep) => {
          
          let myPlayer = myLobbyPlayer.mems['fly.player'];
          let myLobby = myLobbyPlayer.mems['fly.lobby'];
          
          let inLevelChooser = Chooser(myLobby.relSrc('fly.level'));
          dep.scp(inLevelChooser.srcs.off, (notInLevel, dep) => {
            
            let lobbyReal = dep(rootReal.addReal('lobby', [
              lay.Geom({ w: '100%', h: '100%' }),
              lay.Axis1D({ axis: 'y', dir: '+', mode: 'compactCenter' })
            ]));
            let headerReal = lobbyReal.addReal('lobbyHeader', [
              lay.Geom({ w: '100%', h: '3em' }),
              lay.Axis1D({ axis: 'x', dir: '+', mode: 'disperseFully' }),
              lay.Decal({ colour: 'rgba(255, 120, 0, 0.4)' })
            ]);
            let titleReal = headerReal.addReal('lobbyTitle', [
              lay.Text({ size: '200%', text: `Lobby @ ${myLobby.getVal('code')}` })
            ]);
            let returnReal = headerReal.addReal('lobbyReturn', [
              lay.Geom({ h: '100%' }),
              lay.Text({ size: '200%', text: 'Leave lobby' }),
              lay.Decal({ colour: 'rgba(0, 0, 0, 0.05)' }),
              lay.Press({})
            ]);
            
            lobbyReal.addReal('gap', [ lay.Geom({ h: '1vmin' }) ]);
            
            // Players in lobbies are able to leave their lobby
            let exitLobbyAct = dep(hut.enableAction('fly.exitLobby', () => (myLobbyPlayer.end(), null)));
            returnReal.getLayout(lay.Press).route(() => exitLobbyAct.act());
            
            let levelReal = lobbyReal.addReal('lobbyLevel', [
              lay.Axis1D({ axis: 'x', dir: '+', mode: 'dispersePadFull' })
            ]);
            
            let levelOverviewReal = levelReal.addReal('lobbyLevelOverview', [
              lay.Geom({ w: '55%' }),
              lay.Axis1D({ axis: 'y', dir: '+', mode: 'compactCenter' }),
              lay.Decal({ colour: 'rgba(0, 0, 0, 0.05)' })
            ]);
            let levelOverviewTitleReal = levelOverviewReal.addReal('lobbyLevelOverviewTitle', [
              lay.Text({ size: '150%' })
            ]);
            let levelOverviewScrollReal = levelOverviewReal.addReal('lobbyLevelOverviewScroll', [
              lay.Geom({ h: '20vmin' }),
              lay.Scroll({ y: 'show' })
            ]);
            let levelOverviewDescReal = levelOverviewScrollReal.addReal('lobbyLevelOverviewDesc', [
              lay.Text({ size: 'calc(8px + 0.9vmin)', align: 'fwd' })
            ]);
            
            dep(myLobby.getValSrc().route(({ level=null }) => {
              if (!level) return;
              levelOverviewTitleReal.mod({ text: level.dispName });
              levelOverviewDescReal.mod({ text: level.dispDesc });
            }));
            
            let levelPasswordReal = levelReal.addReal('lobbyLevelPassword', [
              lay.Geom({ w: '35%' }),
              lay.Axis1D({ axis: 'y', dir: '+', mode: 'compactCenter' })
            ]);
            let levelPasswordInputFieldReal = levelPasswordReal.addReal('lobbyLevelPasswordInputField', [
              lay.Geom({ w: '100%', h: '2em' }),
              lay.TextInput({ size: 'calc(10px + 1.2vmin)', prompt: 'Level password' }),
              lay.Decal({ colour: 'rgba(0, 0, 0, 0.05)' }),
              lay.Press({ modes: [ 'discrete' ] })
            ]);
            let levelPasswordSubmitFieldReal = levelPasswordReal.addReal('lobbyLevelPasswordSubmitField', [
              lay.Geom({ w: '100%', h: '2em' }),
              lay.Text({ size: 'calc(9px + 1vmin)', text: 'Submit' }),
              lay.Decal({ colour: 'rgba(0, 0, 0, 0.1)' }),
              lay.Press({})
            ]);
            
            let submitLevelPasswordAct = dep(hut.enableAction('fly.submitLevelPassword', ({ password }) => {
              
              /// {ABOVE=
              let levelName = levels.find(v => v.password === password).key;
              if (!levelName) throw Error(`Invalid password`);
              console.log(`Lobby ${myLobby.desc()} set to ${levelName}`);
              myLobby.objVal({ level: getLevelData(levelName) });
              /// =ABOVE}
              
            }));
            
            let getLevelPasswordVal = () => levelPasswordInputFieldReal.params.text;
            let submitLevelPasswordSrc = Src();
            levelPasswordInputFieldReal.getLayout(lay.Press).route(() => submitLevelPasswordSrc.send());
            levelPasswordSubmitFieldReal.getLayout(lay.Press).route(() => submitLevelPasswordSrc.send());
            
            submitLevelPasswordSrc.route(() => {
              submitLevelPasswordAct.act({ password: levelPasswordInputFieldReal.params.text })
              levelPasswordInputFieldReal.mod({ text: '' });
            });
            
            lobbyReal.addReal('gap', [ lay.Geom({ h: '1vmin' }) ]);
            
            // Players in levels are able to pick their model
            let chooseModelAct = dep(hut.enableAction('fly.chooseModel', ({ modelTerm }) => {
              /// {ABOVE=
              myLobbyPlayer.objVal({ modelTerm: modelTerm === myLobbyPlayer.getVal('modelTerm') ? null : modelTerm });
              /// =ABOVE}
            }));
            let teamReal = lobbyReal.addReal('lobbyTeam');
            dep.scp(myLobby, 'fly.lobbyPlayer', (teamLobbyPlayer, dep) => {
              
              let teamPlayer = teamLobbyPlayer.mems['fly.player'];
              let teamPlayerReal = dep(teamReal.addReal('lobbyTeamPlayer', [
                lay.Axis1D({ axis: 'x', dir: '+', mode: 'compactCenter' })
              ]));
              
              // Display player name
              let teamPlayerNameReal = teamPlayerReal.addReal('lobbyTeamPlayerName', [
                lay.Geom({ w: '24vmin', h: '13vmin' }),
                lay.Text({ size: 'calc(10px + 1.3vmin)', style: [ 'bold' ] }),
                lay.Decal({ colour: (teamLobbyPlayer !== myLobbyPlayer) ? 'rgba(0, 0, 0, 0.1)' : 'rgba(230, 130, 100, 0.4)' })
              ]);
              dep(teamPlayer.getValSrc().route(({ term }) => teamPlayerNameReal.mod({ text: term })));
              
              // Display player's damage and deaths
              let teamPlayerStatsReal = teamPlayerReal.addReal('lobbyTeamPlayerStats', [
                lay.Geom({ w: '24vmin', h: '13vmin' }),
                lay.Axis1D({ axis: 'y', dir: '+', mode: 'compactCenter' }),
                lay.Decal({ colour: 'rgba(0, 0, 0, 0.1)' })
              ]);
              let statTextLayout = lay.Text({ size: 'calc(8px + 1vmin)' });
              let teamPlayerStatsDamageReal = teamPlayerStatsReal.addReal('lobbyTeamPlayerStatsDamage', [ statTextLayout ]);
              let teamPlayerStatsDeathsReal = teamPlayerStatsReal.addReal('lobbyTeamPlayerStatsDeaths', [ statTextLayout ]);
              dep(teamPlayer.getValSrc().route(({ score: damage, deaths }) => {
                teamPlayerStatsDamageReal.mod({ text: `damage: ${damage}` });
                teamPlayerStatsDeathsReal.mod({ text: `deaths: ${deaths}` });
              }));
              
              // Allow the player to choose their model from a list
              let teamPlayerModelSetReal = teamPlayerReal.addReal('lobbyTeamPlayerModelSet', [ // TODO: "modelPicker" is a single token, but isn't distinguished from heirarchical items due to the syntax limitations
                lay.Axis1D({ axis: 'x', dir: '+', mode: 'compactCenter' })
              ]);
              for (let [ modelTerm, { name, size, Form } ] of lobbyModelOptions) {
                
                // Show an image of the model with the model name
                let modelReal = teamPlayerModelSetReal.addReal('lobbyTeamPlayerModelSetItem', [
                  lay.Size({ ratio: 1, w: '13vmin' }),
                  lay.Image({ keep: Form.imageKeep, smoothing: false, scale: 0.6 }),
                  lay.Press({})
                ]);
                let modelRealName = modelReal.addReal('lobbyTeamPlayerModelSetItemName', [
                  lay.Geom({ w: '100%', anchor: 'b' }),
                  lay.Text({ size: 'calc(5px + 1vmin)', text: name })
                ]);
                
                // Indicate the player's selected option
                let selectedChooser = dep(Chooser([ 'inactive', 'active' ]));
                dep(teamLobbyPlayer.getValSrc().route(val => {
                  selectedChooser.choose(val.modelTerm === modelTerm ? 'active' : 'inactive');
                }));
                dep.scp(selectedChooser.srcs.active, (active, dep) => {
                  let decal = lay.Decal({ border: { ext: '6px', colour: 'rgba(255, 120, 0, 0.4)' } });
                  dep(modelReal.addLayout(decal));
                });
                dep.scp(selectedChooser.srcs.inactive, (active, dep) => {
                  let decal = lay.Decal({ border: null });
                  dep(modelReal.addLayout(decal));
                });
                
                // Allow players to choose their corresponding options
                if (teamPlayer === myPlayer) {
                  modelReal.getLayout(lay.Press).route(() => chooseModelAct.act({ modelTerm }));
                }
                
              }
              
            });
            
            lobbyReal.addReal('gap', [ lay.Geom({ h: '1vmin' }) ]);
            
            let statusReal = lobbyReal.addReal('lobbyStatus', [
              lay.Geom({ w: '100%', h: '5vmin' }),
              lay.Text({})
            ]);
            let statusChooser = Chooser([ 'waiting', 'starting' ]);
            dep(myLobby.getValSrc().route(() => statusChooser.choose(myLobby.getVal('allReadyMark') ? 'starting' : 'waiting')));
            
            dep.scp(statusChooser.srcs.waiting, (waiting, dep) => {
              statusReal.mod({ text: 'Waiting for players to ready...' });
              dep(statusReal.addLayout(lay.Decal({ colour: 'rgba(0, 0, 0, 0.1)' })));
            });
            dep.scp(statusChooser.srcs.starting, (waiting, dep) => {
              let timerSrc = dep(TimerSrc({ ms: 500, num: Infinity }));
              dep(timerSrc.route(() => {
                let ms = levelStartingDelay - (foundation.getMs() - myLobby.getVal('allReadyMark'));
                statusReal.mod({ text: `Starting in ${Math.ceil(ms / 1000)}s...` });
              }));
              dep(statusReal.addLayout(lay.Decal({ colour: 'rgba(255, 80, 0, 0.75)', textColour: '#fff' })));
            });
            
          });
          dep.scp(inLevelChooser.srcs.onn, (level, dep) => {
            console.log(`I (${myPlayer.getVal('term')}) IN LEVEL ${level.desc()}`);
          });
          
        });
        
      });
      
    }
  });
  
};
