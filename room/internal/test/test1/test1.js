global.rooms['internal.test.test1'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowserHabitat');
  
  return Setup('test1', 'internal.test.test1', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: async (hut, test1Rec, real, dep) => {
      
      test1Rec.setVal({ count: 0 });
      
    },
    kidFn: async (hut, test1Rec, real, dep) => {
      
      let decrementAction = dep(hut.enableAction('test1.decrement', () => {
        test1Rec.setVal({ count: test1Rec.getVal('count') - 1 });
      }));
      let incrementAction = dep(hut.enableAction('test1.increment', () => {
        test1Rec.setVal({ count: test1Rec.getVal('count') + 1 });
      }));
      
      let layoutNames = [ 'Free', 'Axis1D', 'Press', 'Text' ];
      let lay = await Promise.allObj(layoutNames.toObj(ln => [ ln, real.getLayoutForm(ln) ]));
      
      let mainReal = dep(real.addReal('test1.main', [
        lay.Free({ w: '100%', h: '100%' }),
        lay.Axis1D({ axis: 'x', flow: '+', cuts: 'focus' })
      ]));
      let decrementReal = mainReal.addReal('test1.decrement', { text: '-' }, [
        lay.Text({ size: '300%' }),
        lay.Press({})
      ]);
      let displayReal = mainReal.addReal('test1.display', { text: '... loading ...' }, [
        lay.Text({ size: '300%' })
      ]);
      let incrementReal = mainReal.addReal('test1.increment', { text: '+' }, [
        lay.Text({ size: '300%' }),
        lay.Press({})
      ]);
      
      dep(test1Rec.valSrc.route( () => displayReal.mod({ text: `[${test1Rec.getVal('count')}]` }) ));
      decrementReal.getLayout(lay.Press).src.route(() => decrementAction.act());
      incrementReal.getLayout(lay.Press).src.route(() => incrementAction.act());
      
    }
    
  });
  
};
