O.include(U, {
  makeTwig: ({ name, abbreviation=name.substr(0, 3), make, twigs={ client: [] } }) => {
    
    U.remProto(); // TODO: Ugly!!
    
    if (TWIGS[name]) throw new Error(`Tried to overwrite twig "${name}"`);
    if (abbreviation.length !== 3) throw new Error(`Abbreviation "${abbreviation}" should be length 3`);
    
    let twig = {};
    return TWIGS[name] = {
      
      name: name,
      abbreviation: abbreviation,
      content: twig,
      promise: (async () => {
        
        await Promise.all(O.toArr(twigs, (t, n) => n));
        
        let makeParams = [ twig ].concat(A.map(twigs, (twig, twigName) => TWIGS[twigName].content));
        make.apply(null, makeParams);
        
      })()
      
    };
    
  }
});
