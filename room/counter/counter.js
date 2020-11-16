global.rooms.counter = async foundation => {
  
  let { SizedLayout, Axis1DLayout, TextLayout } = U.setup;
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.htmlBrowser');
  let Setup = await foundation.getRoom('hinterlands.setup');
  
  return Setup('cnt', 'counter', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: (hut, counter, real, dep) => {
      
      counter.objVal({ num: 0 });
      
    },
    kidFn: (hut, counter, real, dep) => {
      
      let mainReal = real.addReal('cnt.main', {
        layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'x', cuts: 'focus' }),
        decals: { colour: 'rgba(0, 0, 0, 0.1)' }
      });
      
      let decrementReal = mainReal.addReal('cnt.decrement', {
        layouts: [ TextLayout({ text: '-', size: '400%' }) ]
      });
      let displayReal = mainReal.addReal('cnt.display', {
        layouts: [ TextLayout({ text: '??', size: '300%' }) ]
      });
      let incrementReal = mainReal.addReal('cnt.increment', {
        layouts: [ TextLayout({ text: '+', size: '400%' }) ]
      });
      
      counter.valSrc.route(() => displayReal.setText(counter.getVal('num').toString()));
      
      let decrementAction = hut.enableAction('cnt.decrement', () => void counter.modVal(v => (v.num--, v)));
      let incrementAction = hut.enableAction('cnt.increment', () => void counter.modVal(v => (v.num++, v)));
      
      decrementReal.addPress().src.route(() => decrementAction.act());
      incrementReal.addPress().src.route(() => incrementAction.act());
      
      
    }
    
  });
  
};
