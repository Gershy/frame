global.COMPILER = null;

O.include(U, {
  makeTwig: ({ name, abbreviation=name.substr(0, 3), make, twigs=[] }) => {
    
    U.remProto(); // TODO: Ugly!!
    
    if (TWIGS[name]) throw new Error(`Tried to overwrite twig "${name}"`);
    if (abbreviation.length !== 3) throw new Error(`Abbreviation "${abbreviation}" should be length 3`);
    
    U.output('Making: ' + name);
    
    A.each(twigs, twigName => COMPILER.run(twigName, 'server')); // Kick off the loading of each twig
    
    let material = {};
    let twigList = [ name ];
    return TWIGS[name] = {
      
      name: name,
      abbreviation: abbreviation,
      twigList: twigList,
      material: material,
      promise: (async () => {
        
        // Allow all twigs to become ready
        await Promise.all(A.map(twigs, twigName => TWIGS[twigName].promise));
        
        // Compile the twigList
        A.each(twigs, twigName => twigList.push(...TWIGS[twigName].twigList));
        
        // Run our `make` function, providing all listed twigs
        let makeParams = [ material ].concat(A.map(twigs, twigName => TWIGS[twigName].material));
        make.apply(null, makeParams);
        
      })()
      
    };
    
  }
});
