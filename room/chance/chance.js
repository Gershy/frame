U.buildRoom({
  name: 'chance',
  innerRooms: [],
  build: (foundation, hinterlands, record, real) => {
    
    let Chance = U.inspire({ name: 'Chance', methods: (insp, Insp) => ({
      init: function(seed=null) {
        if (seed !== null) throw new Error(`${U.typeOf(this)} can't deal with seeds yet`);
      },
      cntu: function(v=1) { return Math.random() * v; },
      cntuCen: function(v=1) { return this.cntu(v * 2) - v; },
      dscr: function(min, max) { return min + Math.floor(this.cntu(max - min)); },
      elem: function(arr) { return arr[this.dscr(0, arr.length)]; }
    })});
    
    return { Chance };
    
  }
});
