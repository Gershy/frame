U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record' ],
  build: (foundation, hinterlands, record, random) => {
    
    return {
      open: async () => {
        console.log('Init chess2...');
        let { Hinterlands, Highway } = hinterlands;
        let lands = Hinterlands({ foundation, name: 'lands' });
        let highway = Highway({ hinterlands: lands, makeServer: foundation.makeHttpServer.bind(foundation, 'localhost', 80) }); // host: 'localhost', port: 80 });
        await lands.open();
      }
    };
    
  }
});
