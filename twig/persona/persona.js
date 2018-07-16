U.makeTwig({ name: 'persona', twigs: [ 'clearing', 'record', 'hinterlands', 'real' ], make: (persona, clearing, record, hinterlands, real) => {
  
  let { Obj, Arr, Val, RecordObj, Editor } = record;
  
  const OutlinePersona = U.makeClass({ name: 'OutlinePersona', inspiration: { Obj }, methods: (insp, Cls) => ({
    init: function({ name, recCls }) {
      insp.Obj.init.call(this, { name, recCls });
    }
  })});
  
  let install = (otlLands) => {
    
    let otlObjective = otlLands.getChild('objective');
    
    // Attach the personaSet
    let otlPersonaSet = otlObjective.add(Arr({ name: 'personaSet' }));
    let otlPersona = otlPersonaSet.setTemplate(OutlinePersona({ name: 'persona' }), persona => persona.getChild('moniker').value);
    otlPersona.add(Val({ name: 'moniker' }));
    
    // Attach values to associate personas with huts
    let otlHut = otlLands.getChild('hutSet.hut');
    otlHut.add(Val({ name: 'personaMoniker', defaultValue: null }));
    otlHut.action('getPersona', hut => {
      let moniker = hut.getChild('moniker').value;
      if (!moniker) return null;
      return hut.getChild([ 'objective', 'personaSet', moniker ]);
    });
    
    otlLands.addUpdateFunc('loginTemp', (lands, srcHut, { moniker }) => {
      
      let editor = Editor();
      
      if (srcHut)
        editor.shape({
          rec: srcHut,
          data: { type: 'delta', children: {
            personaMoniker: moniker
          }}
        });
      
      let newPersona = editor.shape({
        par: lands.getChild('objective.personaSet'),
        data: { type: 'exact', children: {
          moniker: moniker
        }}
      });
      
      editor.run();
      
    });
    
  };
  
  O.include(persona, {
    OutlinePersona,
    install
  });
  
}});
