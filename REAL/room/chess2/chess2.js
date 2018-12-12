U.buildRoom({
  name: 'chess2',
  innerRooms: [ 'hinterlands', 'record', 'random' ],
  build: (foundation, hinterlands, record, random) => {
    
    return {
      open: async () => {
        let { Hinterlands, HighwayHttp } = hinterlands;
        let lands = Hinterlands({ foundation, name: 'lands' });
        let highway = HighwayHttp({ hinterlands: lands, host: 'localhost', port: 80 });
        highway.mod('hinterlands', { act: 'attach', hinterlands: lands });
        await lands.open();
      }
    };
    
  }
});
