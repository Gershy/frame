U.buildRoom({
  name: 'chance',
  innerRooms: [],
  build: (foundation, hinterlands, record, real) => {
    
    let Chance = U.inspire({ name: 'Chance', methods: (insp, Insp) => ({
      init: function(seed=null) {
        if (seed !== null) throw new Error(`${U.typeOf(this)} can't deal with seeds yet`);
      },
      cont: function() { return Math.random(); },
      disc: function(p) { // Sneakily use an object for notation (e.g. `{0:100}`)
        let [ max, min ] = p.find(v => 1);
        min = parseInt(min, 10);
        return min + Math.floor(this.cont() * (max - min));
      },
      elem: function(arr) {
        return arr[this.disc({ 0 : arr.length })];
      }
    })});
    
    return { Chance };
    
  }
});
