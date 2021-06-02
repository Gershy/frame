global.rooms['test'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowserHabitat');
  
  return Setup('t', 'test', {
    
    habitats: [ HtmlBrowserHabitat({}) ],
    
    parFn: (hut, rec, real, dep) => {
      
      rec.setVal({ counter: 0 });
      
    },
    
    kidFn: async (hut, rec, real, dep) => {
      
      let decAct = hut.enableAction('t.dec', () => {
        rec.modVal(v => (v.counter--, v));
      });
      let incAct = hut.enableAction('t.inc', () => {
        rec.modVal(v => (v.counter++, v));
      });
      
      let lay = await real.tech.getLayoutForms([
        'Geom', 'Text', 'Axis1D', 'Press'
      ]);
      
      let mainReal = real.addReal('main', [
        lay.Geom({ w: '100%', h: '100%' }),
        lay.Axis1D({ axis: 'x', dir: '+', mode: 'compactCenter' })
      ]);
      
      let decReal = mainReal.addReal('dec', [
        lay.Text({ size: '10vw', text: '<' })
      ]);
      let dispReal = mainReal.addReal('disp', [
        lay.Geom({ w: '40vw', anchor: 'none' }),
        lay.Text({ size: '15vw' })
      ]);
      let incReal = mainReal.addReal('inc', [
        lay.Text({ size: '10vw', text: '>' })
      ]);
      
      rec.valSrc.route(({ counter }) => dispReal.mod({ text: counter.toString() }));
      
      let pressDec = lay.Press({});
      decReal.addLayout(pressDec);
      pressDec.route(() => decAct.act());
      
      let pressInc = lay.Press({});
      incReal.addLayout(pressInc);
      pressInc.route(() => incAct.act());
      
    }
    
  });
  
  
};
