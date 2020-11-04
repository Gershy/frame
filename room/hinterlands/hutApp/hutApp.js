global.rooms['hinterlands.hutApp'] = async foundation => {
  
  let { Hut } = await foundation.getRoom('hinterlands');
  let { RecScope } = await foundation.getRoom('record');
  
  let FollowedRecScope = U.inspire({ name: 'FollowedRecScope', insps: { RecScope }, methods: (insp, Insp) => ({
    init: function(hut, ...args) {
      if (!U.isInspiredBy(hut, Hut)) throw Error(`${U.nameOf(this)} requires Hut as first param; got ${U.nameOf(hut)}`);
      this.hut = hut;
      insp.RecScope.init.call(this, ...args);
    },
    subScope: function(...args) { return insp.RecScope.subScope.call(this, this.hut, ...args); }
  })});
  
  let makeHutAppScope = async (rootHut, prefix, name, fn) => {
    
    /// {ABOVE=
    let rootRec = rootHut.createRec(`${prefix}.${name}`, [ rootHut ]);
    /// =ABOVE}
    let rootReal = await foundation.seek('real', 'primary');
    
    return FollowedRecScope(rootHut, rootHut.relSrc(`${prefix}.${name}`), async (rootRec, dep) => {
      
      /// {ABOVE=
      
      dep.scp(rootHut, 'lands.kidHut/par', (kidParHut, dep) => {
        // Every KidHut unconditionally follows the root Rec, and then
        // we apply the custom function
        let kidHut = kidParHut.mems.kid;
        dep(kidHut.followRec(rootRec));
        fn(rootRec, kidHut, rootReal, dep)
      });
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below syncs the root Rec it's good to go
      fn(rootRec, rootHut, rootReal, dep);
      
      /// =BELOW}
      
    });
    
  };
  
  return { makeHutAppScope };
  
};
