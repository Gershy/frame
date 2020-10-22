global.rooms['hinterlands.hutApp'] = async foundation => {
  
  let { RecScope } = await foundation.getRoom('record');
  
  let makeHutAppScope = async (rootHut, prefix, name, fn) => {
    
    /// {ABOVE=
    let rootRec = rootHut.createRec(`${prefix}.${name}`, [ rootHut ]);
    /// =ABOVE}
    let rootReal = await foundation.seek('real', 'primary');
    
    return RecScope(rootHut, `${prefix}.${name}`, async (rootRec, dep) => {
      
      /// {ABOVE=
      
      dep.scp(rootHut, 'lands.kidHut/par', (kidParHut, dep) => {
        // Every KidHut unconditionally follows the root Rec, and then
        // we apply the custom function
        let kidHut = kidParHut.mems.kid;
        dep(kidHut.followRec(rootRec));
        fn(rootRec, kidHut, rootReal, dep)
      });
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below receives the root Rec it's good to go
      fn(rootRec, rootHut, rootReal, dep);
      
      /// =BELOW}
      
    });
    
  };
  
  return { makeHutAppScope };
  
};
