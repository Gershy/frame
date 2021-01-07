global.rooms['internal.test.test2'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowserHabitat');
  
  return Set('t2', 'internal.test.t2', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: async (hut, t1Rec, t1Real, dep) => {
      
      t1Rec.setVal({ count: 0 });
      
    },
    kidFn: async (hut, t1Rec, t1Real, dep) => {
      
      
      
    }
    
  });
  
};
