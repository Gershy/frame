U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record' ],
  build: (foundation, hinterlands, record, random) => {
    
    console.log('Building...');
    
    let { Record } = record;
    let { Lands, Area, LandsRecord, Way, relLandsWays, relLandsRecs, relLandsHuts, relAreasRecs } = hinterlands;
    
    let ValThing = U.inspire({ name: 'ValThing', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    
    let Val = U.inspire({ name: 'Val', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
      }
    })});
    
    let relThingVal1 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal1');
    let relThingVal2 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal2');
    let relThingVal3 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal3');
    
    return {
      open: async () => {
        console.log('Init chess2...');
        
        let records = [
          Area,
          ValThing,
          Val
        ];
        let relations = [
          relAreasRecs,
          relThingVal1,
          relThingVal2,
          relThingVal3
        ];
        
        /// {ABOVE=
        let getRecsForHut = (lands, hut) => game.getInnerVal(relAreasRecs);
        let lands = Lands({ foundation, name: 'lands', records, relations, getRecsForHut });
        let game = Area({ lands });
        /// =ABOVE} {BELOW=
        let getRecsForHut = (lands, hut) => lands.getInnerVal(relLandsRecs);
        let lands = Lands({ foundation, name: 'lands', records, relations, getRecsForHut });
        /// =BELOW}
        
        /// {ABOVE=
        let valThing1 = ValThing({ lands });
        let val11 = Val({ lands });
        let val12 = Val({ lands });
        let val13 = Val({ lands });
        
        valThing1.attach(relThingVal1, val11);
        valThing1.attach(relThingVal2, val12);
        valThing1.attach(relThingVal3, val13);
        
        let valThing2 = ValThing({ lands });
        let val21 = Val({ lands });
        let val22 = Val({ lands });
        let val23 = Val({ lands });
        
        valThing2.attach(relThingVal1, val21);
        valThing2.attach(relThingVal2, val22);
        valThing2.attach(relThingVal3, val23);
        
        game.attach(relAreasRecs, valThing1);
        game.attach(relAreasRecs, val11);
        game.attach(relAreasRecs, val12);
        game.attach(relAreasRecs, val13);
        
        game.attach(relAreasRecs, valThing2);
        game.attach(relAreasRecs, val21);
        game.attach(relAreasRecs, val22);
        game.attach(relAreasRecs, val23);
        
        let arr = [ 'larry', 'barry', 'gertrude', 'matilda', 'samson', 'crock', 'hitler', 'shammy' ];
        arr.sort(() => 0.5 - Math.random());
        arr.sort(() => 0.5 - Math.random());
        arr.sort(() => 0.5 - Math.random());
        val11.wobble(arr[0]);
        val12.wobble(arr[1]);
        val13.wobble(arr[2]);
        // setInterval(() => {
        //   if (false) console.log(valThing1.getJson({
        //     relThingVal1: {},
        //     relThingVal2: {},
        //     relThingVal3: {}
        //   }));
        // }, 3000);
        // 
        // setInterval(() => {
        //   lands.getInnerVal(relLandsHuts).forEach(hut => hut.informBelow());
        // }, 3000);
        /// =ABOVE} {BELOW=
        
        // lands.getInnerWob(relLandsRecs).hold(({ add={}, rem={} }) => {
        //   console.log('Add', add.map(r => r.iden()));
        //   console.log('Rem', rem.map(r => r.iden()));
        // });
        
        /// =BELOW}
        
        let way = Way({ lands, makeServer: foundation.makeHttpServer.bind(foundation, 'localhost', 80) }); // host: 'localhost', port: 80 });
        lands.attach(relLandsWays, way);
        await lands.open();
      }
    };
    
  }
});
