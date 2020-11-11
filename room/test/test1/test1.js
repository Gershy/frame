global.rooms['test.test1'] = async foundation => {
  
  let { SizedLayout, Axis1DLayout, TextLayout } = U.setup;
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.htmlBrowser');
  
  return {
    
    debug: [ 'road' ],
    habitats: [ HtmlBrowserHabitat() ],
    parFn: (hut, test, real, dep) => {
      
      test.objVal({ num: 0 });
      
    },
    kidFn: (hut, test, real, dep) => {
      
      let incAct = dep(hut.enableAction('t1.inc', () => void test.modVal(v => (v.num++, v))));
      let decAct = dep(hut.enableAction('t1.dec', () => void test.modVal(v => (v.num--, v))));
      
      let mainReal = dep(real.addReal('t1.main', {
        layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'x', dir: '+', cuts: 'focus' })
      }));
      let decReal = mainReal.addReal('t1.dec', {
        layouts: [ TextLayout({ text: '-', size: '550%' }) ]
      });
      let numReal = mainReal.addReal('t1.num', {
        layouts: [ SizedLayout({ w: '200px' }), TextLayout({ text: '0', size: '400%', gap: '40px' }) ]
      });
      let incReal = mainReal.addReal('t1.inc', {
        layouts: [ TextLayout({ text: '+', size: '550%' }) ]
      });
      
      dep(test.valSrc.route(() => numReal.setText(`${test.getVal('num')}`)));
      
      for (let real of [ decReal, incReal ]) {
        let feelSrc = dep(real.addFeel()).src;
        real.addDecals({ textColour: 'rgba(0, 0, 0, 0.4)' });
        dep.scp(feelSrc, (feel, dep) => dep(real.addDecals({ textColour: 'rgba(0, 0, 0, 1)' })));
      }
      
      let decPressSrc = dep(decReal.addPress()).src;
      let incPressSrc = dep(incReal.addPress()).src;
      dep(decPressSrc.route(() => decAct.act()));
      dep(incPressSrc.route(() => incAct.act()));
      
    }
    
  }
  
};
