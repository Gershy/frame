global.rooms['hinterlands.hutApp'] = async foundation => {
  
  let { Tmp } = U.logic;
  let { Hut } = await foundation.getRoom('hinterlands');
  let { RecSrc, RecScope } = await foundation.getRoom('record');
  
  let FollowRecScope = U.inspire({ name: 'FollowRecScope', insps: { RecScope }, methods: (insp, Insp) => ({
    init: function(hut, ...args) {
      
      if (!U.isInspiredBy(hut, Hut)) throw Error(`${U.nameOf(this)} requires Hut as first param; got ${U.nameOf(hut)}`);
      this.hut = hut;
      
      // Our src will send Recs if using either of these styles:
      // 1 - `RecScope(srcTmp, 'relTerm', (rec, dep) => ...)`
      // 2 - `RecScope(srcTmp.relSrc('relTerm'), (rec, dep) => ...)`
      this.doFollowRecs = args.count() === 3 || U.isType(args[0], RecSrc);
      insp.RecScope.init.call(this, ...args);
    },
    processTmp: function(tmp, dep) {
      if (this.doFollowRecs) dep(this.hut.followRec(tmp));
      return insp.RecScope.processTmp.call(this, tmp, dep);
    },
    subScope: function(...args) { return insp.RecScope.subScope.call(this, this.hut, ...args); }
  })});
  
  let makeHutAppScope = async (hut, prefix, name, fn) => {
    
    let real = await foundation.seek('real', 'primary');
    
    /// {ABOVE=
    
    hut.createRec(`${prefix}.${name}`, [ hut ]);
    return RecScope(hut, `${prefix}.${name}`, (rec, dep) => {
      dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => {
        let kidHut = kidParHut.mems.kid;
        dep(FollowRecScope(kidHut, hut, `${prefix}.${name}`, (rec, dep) => fn(rec, kidHut, real, dep)));
      });
    });
    
    /// =ABOVE} {BELOW=
    
    // As soon as Below syncs the root Rec it's good to go
    return FollowRecScope(hut, hut, `${prefix}.${name}`, (rec, dep) => fn(rec, hut, real, dep));
    
    /// =BELOW}
    
  };
  
  return { makeHutAppScope };
  
};
