global.rooms['internal.test.test1'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowser');
  
  return Setup('t1', 'internal.test.test1', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: async (hut, t1Rec, real, dep) => {
      
      t1Rec.setVal({ count: 0 });
      
    },
    kidFn: async (hut, t1Rec, real, dep) => {
      
      let layoutNames = [ 'Free', 'Axis1D', 'Press', 'Text' ];
      let lay = await Promise.allObj(layoutNames.toObj(ln => [ ln, real.getLayoutForm(ln) ]));
      
      let mainReal = dep(real.addReal('t1.main', [
        lay.Free({ w: '100%', h: '100%' }),
        lay.Axis1D({ axis: 'x', flow: '+', cuts: 'focus' })
      ]));
      
      let decrementReal = mainReal.addReal('t1.decrement', { text: '-' }, [
        lay.Text({ size: '300%' }),
        lay.Press({})
      ]);
      let displayReal = mainReal.addReal('t1.display', { text: '... loading ...' }, [
        lay.Text({ size: '300%' })
      ]);
      let incrementReal = mainReal.addReal('t1.increment', { text: '+' }, [
        lay.Text({ size: '300%' }),
        lay.Press({})
      ]);
      
      dep(t1Rec.valSrc.route( () => displayReal.mod({ text: `[${t1Rec.getVal('count')}]` }) ));
      
      let decrementAction = dep(hut.enableAction('t1.decrement', () => {
        t1Rec.setVal({ count: t1Rec.getVal('count') - 1 });
      }));
      let incrementAction = dep(hut.enableAction('t1.increment', () => {
        t1Rec.setVal({ count: t1Rec.getVal('count') + 1 });
      }));
      
      decrementReal.getLayout(lay.Press).src.route(() => decrementAction.act());
      incrementReal.getLayout(lay.Press).src.route(() => incrementAction.act());
      
    }
    
  });
  
};
