U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record' ],
  build: (foundation, hinterlands, record, random) => {
    
    console.log('Building...');
    
    let { Record } = record;
    let { Hinterlands, HinterlandsRecord, Highway, relLandsWays } = hinterlands;
    
    let ValThing = U.inspire({ name: 'ValThing', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      init: function({ hinterlands }) {
        insp.HinterlandsRecord.init.call(this, { hinterlands });
      }
    })});
    
    let Val = U.inspire({ name: 'Val', insps: { HinterlandsRecord }, methods: (insp, Insp) => ({
      init: function({ hinterlands }) {
        insp.HinterlandsRecord.init.call(this, { hinterlands });
      }
    })});
    
    let relThingVal1 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal1');
    let relThingVal2 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal2');
    let relThingVal3 = Record.relate11(Record.stability.dynamic, ValThing, Val, 'relThingVal3');
    
    return {
      open: async () => {
        console.log('Init chess2...');
        let hinterlands = Hinterlands({ foundation, name: 'lands' });
        
        let valThing1 = ValThing({ hinterlands });
        let val11 = Val({ hinterlands });
        let val12 = Val({ hinterlands });
        let val13 = Val({ hinterlands });
        
        valThing1.attach(relThingVal1, val11);
        valThing1.attach(relThingVal2, val12);
        valThing1.attach(relThingVal3, val13);
        
        let valThing2 = ValThing({ hinterlands });
        let val21 = Val({ hinterlands });
        let val22 = Val({ hinterlands });
        let val23 = Val({ hinterlands });
        
        valThing2.attach(relThingVal1, val21);
        valThing2.attach(relThingVal2, val22);
        valThing2.attach(relThingVal3, val23);
        
        /// {ABOVE=
        setInterval(() => {
          val11.wobble(Math.random());
          val12.wobble(Math.random());
          val13.wobble(Math.random());
          console.log(valThing1.getJson({
            relThingVal1: {},
            relThingVal2: {},
            relThingVal3: {}
          }));
        }, 1000);
        /// =ABOVE}
        
        let highway = Highway({ hinterlands, makeServer: foundation.makeHttpServer.bind(foundation, 'localhost', 80) }); // host: 'localhost', port: 80 });
        hinterlands.attach(relLandsWays, highway);
        await hinterlands.open();
      }
    };
    
  }
});
