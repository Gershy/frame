global.rooms['test2'] = async foundation => {
  
  let { Setup, HtmlBrowserHabitat } = await foundation.getRooms([
    'hinterlands.Setup',
    'hinterlands.habitat.HtmlBrowserHabitat'
  ]);
  
  return Setup('t', 'test2', {
    
    habitats: [ HtmlBrowserHabitat() ],
    
    parFn: async (hut, rec, real, dep) => {
      /// {ABOVE=
      rec.setVal({ counter: 0 });
      /// =ABOVE}
    },
    kidFn: async (hut, rec, real, dep) => {
      
      let lay = await real.tech.getLayoutForms([ 'Geom', 'Text', 'Axis1D', 'Press' ]);
      
      let mainReal = real.addReal('main', [
        lay.Geom({ w: '100%', h: '100%' }),
        lay.Axis1D({ axis: 'x', dir: '+', mode: 'compactCenter' })
      ]);
      
      let decReal = mainReal.addReal('dec', [ lay.Text({ size: '10vw', text: '<' }) ]);
      let dispReal = mainReal.addReal('disp', [ lay.Geom({ size: '400px', anchor: 'none' }), lay.Text({ size: '15vw' }) ]);
      let incReal = mainReal.addReal('inc', [ lay.Text({ size: '10vw', text: '>' }) ]);
      
      rec.valSrc.route(({ counter }) => dispReal.mod({ text: counter.toString() }));
      
      let decAct = hut.enableAction('t.dec', () => {
        rec.modVal(v => (v.counter--, v));
      });
      let incAct = hut.enableAction('t.inc', () => {
        rec.modVal(v => (v.counter++, v));
      });
      
      decReal.addLayout(lay.Press({})).layout.route(() => decAct.act());
      incReal.addLayout(lay.Press({})).layout.route(() => incAct.act());
      
    }
  });
  
};
