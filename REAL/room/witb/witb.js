U.buildRoom({
  name: 'witb',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { Record } = record;
    let { Lands, LandsRecord, Way, Hut, relLandsWays, relLandsRecs, relLandsHuts } = hinterlands;
    
    return {
      open: async () => {
        let lands = U.lands = Lands({
          foundation,
          commands: Lands.defaultCommands.map(v => v),
          records: [],
          relations: [],
          getRecsForHut: (lands, hut) => lands.getInnerVal(relLandsRecs)
        });
        
        /// {ABOVE=
        
        /// =ABOVE} {BELOW=
        
        let { Real } = real;
        let rootReal = Real({ isRoot: true });
        let helloReal = rootReal.addReal(Real({}));
        helloReal.setText('Hello!');
        
        /// =BELOW}
        
        let way = Way({ lands, makeServer: foundation.makeHttpServer.bind(foundation, 'localhost', 80) }); // host: 'localhost', port: 80 });
        lands.attach(relLandsWays, way);
        await lands.open();
      }
    };
    
  }
});
