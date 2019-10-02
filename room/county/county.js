U.buildRoom({
  name: 'county',
  innerRooms: [ 'hinterlands', 'record', 'real', 'realHtmlCss' ],
  build: (foundation, hinterlands, record, real, realHtmlCss) => {
    
    let { HorzScope: AccessPath, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Rec, recTyper } = record;
    let { Lands, Way } = hinterlands;
    
    let { rt, add } = recTyper();
    add('round',              Rec);
    add('player',             Rec);
    add('archRound',          Rec, '11', hinterlands.rt.arch, rt.round);
    add('hutPlayer',          Rec, '11', hinterlands.rt.hut, rt.player);
    add('roundPlayer',        Rec, '1M', rt.round, rt.player);
    
    let open = async () => {
      
      console.log('Init county...');
      
      let recTypes = { ...hinterlands.rt, ...rt }; // TODO: Collisions could occur...
      let commands = [ 'rename', 'click' ];
      let heartbeatMs = 10 * 60 * 1000;
      let lands = Lands({ foundation, recTypes, commands, heartbeatMs });
      
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer(lands.pool, '127.0.0.1', 80) }));
      lands.addWay(Way({ lands, makeServer: () => foundation.makeSoktServer(lands.pool, '127.0.0.1', 8000) }));
      
      /// {ABOVE=
      lands.setRealRooms([ realHtmlCss ]);
      /// =ABOVE}
      
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      lands.realLayout = {
        'main': {
          slot: par => par.cmps.slots.insertViewPortItem(),
          decals: { colour: 'rgba(0, 0, 0, 1)', textColour: 'rgba(255, 255, 255, 1)' }
        },
        'main.round': {
          size: FillParent({}),
          slots: AxisSections({ axis: 'y', dir: '+', cuts: [ UnitPc(0.5) ] })
        },
        'main.round.upper': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          slots: CenteredSlot(),
        },
        'main.round.lower': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          size: ShowText({ origin: 'cc' }),
          decals: { textSize: UnitPx(70), colour: 'rgba(100, 0, 0, 1)' }
        },
        'main.round.upper.players': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          slots: LinearSlots({ axis: 'x', dir: '+' })
        },
        'main.round.upper.players.player': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ pad: UnitPx(5) }),
          slots: LinearSlots({ axis: 'y', dir: '+' }),
          decals: { colour: 'rgba(255, 255, 255, 0.3)' }
        },
        'main.round.upper.players.player.name': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', interactive: true, pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textColour: 'rgba(0, 0, 0, 1)',
            textSize: UnitPx(20),
            disabled: {
              colour: 'rgba(100, 0, 0, 1)',
              textColour: 'rgba(255, 255, 255, 1)'
            }
          }
        },
        'main.round.upper.players.player.score': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', interactive: false, pad: UnitPx(10) }),
          decals: { textSize: UnitPx(30), colour: 'rgba(100, 0, 0, 1)' }
        }
      };
      
      /// {ABOVE=
      let round = lands.createRec('round', { value: null });
      let archRound = lands.createRec('archRound', {}, lands.arch, round);
      /// =ABOVE}
      
      let rootScope = AccessPath(lands.arch.relWob(rt.archRound), async (dep, archRound) => {
        
        let round = archRound.members[1];
        
        /// {ABOVE=
        
        // Init Player for Hut
        dep(AccessPath(lands.arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          let hut = archHut.members[1];
          dep(hut.followRec(round));
          dep(hut.followRec(archRound));
          let player = lands.createRec('player', { value: { name: 'anon', hutTerm: hut.getTerm(), score: 0 } });
          let hutPlayer = lands.createRec('hutPlayer', {}, hut, player);
          let roundPlayer = lands.createRec('roundPlayer', {}, round, player);
        }));
        
        // Follows
        dep(AccessPath(lands.arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          let hut = archHut.members[1];
          dep(hut.followRec(archRound));
          dep(hut.followRec(round));
          dep(AccessPath(round.relWob(rt.roundPlayer), (dep, roundPlayer) => {
            let player = roundPlayer.members[1];
            console.log(`Hut ${hut.getTerm()} follows player ${player.value.name}`);
            dep(hut.followRec(player));
            dep(hut.followRec(roundPlayer));
          }));
        }));
        
        // Controls on Huts
        dep(AccessPath(lands.arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          let hut = archHut.members[1];
          dep(AccessPath(hut.relWob(rt.hutPlayer), (dep, hutPlayer) => {
            let player = hutPlayer.members[1];
            dep(hut.comWob('rename').hold( ({ msg }) => player.modify(v => v.gain(msg.slice('name'))) ));
            dep(hut.comWob('click').hold( ({ msg }) => player.modify(v => (v.score++, v)) ));
          }));
        }));
        
        /// =ABOVE} {BELOW=
        
        let rootReal = await lands.getRootReal();
        let mainReal = rootReal.addReal('main');
        let roundReal = dep(mainReal.addReal('round'));
        let upperReal = roundReal.addReal('upper');
        let playersReal = upperReal.addReal('players');
        
        let lowerReal = roundReal.addReal('lower');
        lowerReal.setText('Score!');
        dep(lowerReal.feelWob().hold(() => lands.tell({ command: 'click' })));
        
        dep(AccessPath(round.relWob(rt.roundPlayer), (dep, roundPlayer) => {
          
          let player = roundPlayer.members[1];
          let playerReal = dep(playersReal.addReal('player'));
          let playerNameReal = playerReal.addReal('name');
          let playerScoreReal = playerReal.addReal('score');
          
          let canRename = false;
          
          dep(player.hold(v => {
            playerNameReal.setText(v.name);
            playerScoreReal.setText(v.score);
            if (!canRename && (v.hutTerm === U.hutTerm)) {
              canRename = true;
              dep(playerNameReal.tellWob().hold(name => (name !== player.value.name) && lands.tell({ command: 'rename', name })));
            }
          }));
          
          
        }));
        
        /// =BELOW}
        
      });
      
      await lands.open();
      
    };
    
    return { open };
  }
});
