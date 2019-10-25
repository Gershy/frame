U.buildRoom({
  name: 'county',
  innerRooms: [ 'hinterlands', 'record', 'real', 'realHtmlCss' ],
  build: (foundation, hinterlands, record, real, realHtmlCss) => {
    
    let { HorzScope, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Rec, recTyper } = record;
    let { Lands } = hinterlands;
    
    let { rt, add } = recTyper();
    add('round',              Rec);
    add('player',             Rec);
    add('archRound',          Rec, '11', hinterlands.rt.arch, rt.round);
    add('hutPlayer',          Rec, '11', hinterlands.rt.hut, rt.player);
    add('roundPlayer',        Rec, '1M', rt.round, rt.player);
    
    let open = async () => {
      
      let recTypes = { ...hinterlands.rt, ...rt }; // TODO: Collisions could occur...
      let heartbeatMs = 1 * 60 * 1000;
      let lands = Lands({ recTypes, heartbeatMs });
      
      lands.makeServers.push(pool => foundation.makeHttpServer(pool, '127.0.0.1', 80));
      lands.makeServers.push(pool => foundation.makeSoktServer(pool, '127.0.0.1', 8000));
      
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
      
      let rootScope = HorzScope(lands.arch.relWob(rt.archRound), async (dep, archRound) => {
        
        let round = archRound.members[1];
        
        /// {ABOVE=
        
        // Init Player for Hut
        dep(HorzScope(lands.arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          let hut = archHut.members[1];
          dep(hut.followRec(round));
          dep(hut.followRec(archRound));
          let player = dep(lands.createRec('player', { value: { hutTerm: hut.getTerm(), name: 'anon', score: 0 } }));
          let hutPlayer = lands.createRec('hutPlayer', {}, hut, player);
          let roundPlayer = lands.createRec('roundPlayer', {}, round, player);
        }));
        
        // Follows
        dep(HorzScope(lands.arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          let hut = archHut.members[1];
          dep(hut.followRec(archRound));
          dep(hut.followRec(round));
          dep(HorzScope(round.relWob(rt.roundPlayer), (dep, roundPlayer) => {
            let player = roundPlayer.members[1];
            dep(hut.followRec(player));
            dep(hut.followRec(roundPlayer));
          }));
          dep(HorzScope(hut.relWob(rt.hutPlayer), (dep, hutPlayer) => {
            let player = hutPlayer.members[1];
            // TODO: Should also be possible to apply a schema to Recs
            // So validation is a combination of fitting the Rec's
            // schema, and app-specific validation. Schemas could handle
            // typical types:. array/string length, required/optional
            // object properties, etc. Only the app would be able to say
            // something like "score cannot be changed to any value
            // except a value one bigger than its current value".
            dep(hut.followRec(player, { modifyAllow: newVal => {
              let { score=C.skip, name=C.skip, ...more } = newVal; // Note: `C.skip` instead of `null` to use a value that can't be spoofed in JSON messages
              if (!more.isEmpty()) return false; // throw new Error(`Invalid props: ${more.toArr((v, k) => k).join(', ')}`);
              if (score !== C.skip && score !== player.value.score + 1) return false; // throw new Error(`Invalid score: ${U.nameOf(score)}`);
              if (name !== C.skip && (!U.isType(name, String) || name.length < 2 || name.length > 20)) return false; // throw new Error(`Invalid name: ${U.nameOf(name)}`);
              return true;
            }}));
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
        
        // TODO: Maybe `foundation.hutTerm` or `foundation.getHutTerm()`
        // makes more sense than `U.hutTerm`?
        let myPlayerWob = WobTmp('dn');
        dep(HorzScope(round.relWob(rt.roundPlayer), (dep, { members: [ _, player ] }) => {
          if (player.value.hutTerm === U.hutTerm) dep(myPlayerWob.up(player));
        }));
        
        dep(HorzScope(round.relWob(rt.roundPlayer), (dep, roundPlayer) => {
          
          let player = roundPlayer.members[1];
          let playerReal = dep(playersReal.addReal('player'));
          let playerNameReal = playerReal.addReal('name');
          let playerScoreReal = playerReal.addReal('score');
          
          dep(player.hold(v => {
            playerNameReal.setText(v.name);
            playerScoreReal.setText(v.score);
          }));
          
          dep(HorzScope(myPlayerWob, (dep, { value: myPlayer }) => {
            if (myPlayer !== player) return;
            dep(lowerReal.feelWob().hold(() => lands.modifyRec(player, { score: player.value.score + 1 })));
            dep(playerNameReal.tellWob().hold(name => lands.modifyRec(player, { name })));
          }));
          
        }));
        
        /// =BELOW}
        
      });
      
      await lands.open();
      
    };
    
    return { open };
  }
});
