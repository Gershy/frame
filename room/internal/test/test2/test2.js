global.rooms['internal.test.test2'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowserHabitat');
  
  return Setup('test2', 'internal.test.test2', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: async (hut, test2Rec, real, dep) => {
      
    },
    kidFn: async (hut, test2Rec, real, dep) => {
      
    }
    
  });
  
};
