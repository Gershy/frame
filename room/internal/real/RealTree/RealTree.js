global.rooms['internal.real.RealTree'] = async foundation => {
  
  return U.form({ name: 'RealTree', props: (forms, Form) => ({
    
    $layoutFormNames: [
      // TODO: This should draw from a definitive list (the filesystem?)
      'Art', 'Axis1D', 'Decal', 'Feel', 'Geom', 'Image', 'Press'
    ],
    
    init: function(name, fn) {
      
      Object.assign(this, { name, fn });
      
      let layoutForms = Form.layoutFormNames.toObj(layoutFormName => {
        return [ layoutFormName, (...initArgs) => ({ layoutFormName, initArgs }) ];
      });
      
      let defs = {};
      let define = (term, ...layouts) => defs[term] = layouts;
      let insert = (term) => {};
      fn(layoutForms, define, insert);
      
    },
    
  })});
  
};
