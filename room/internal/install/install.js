global.rooms['internal.install'] = async foundation => {
  
  let Setup = await foundation.getRoom('hinterlands.Setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.HtmlBrowserHabitat');
  // let TerminalHabitat = await foundation.getRoom('hinterlands.habitat.terminal'); // Interact with app purely via command line (and maybe even a separate graphical ui experience like 'window' room
  // let TerminalGraphicalHabitat = await foundation.getRoom('hinterlands.habitat.terminalGraphical');
  
  let debug = foundation.getArg('debug');
  return Setup('stl', 'internal.install', {
    debug,
    habitats: [ HtmlBrowserHabitat() ],
    parFn: async (hut, install, real, dep) => {
      
      /// {ABOVE=
      // Make sure to use the non-admin fileSystem to control access
      let fsKeep = foundation.seek('keep', 'fileSystem');
      let installActionKeep = fsKeep.seek('room', 'internal', 'install', 'installAction.js').setContentType('text');
      
      hut.roadSrc('stl.run').route(({ reply, srcHut }) => reply(installActionKeep));
      hut.roadSrc('stl.item').route(async ({ msg, reply, srcHut }) => {
        
        let { pcs=null } = msg;
        if (U.isForm(pcs, String)) pcs = pcs.split(/[,/]/);
        if (!U.isForm(pcs, Array)) reply(Error(`"pcs" should be Array (or String); got ${U.getFormName(pcs)}`));
        if (pcs.find(v => !U.isForm(v, String)).found) reply(Error(`"pcs" should contain only strings`));
        
        let keep = foundation.seek('keep', 'fileSystem', ...pcs);
        try {
          let fsType = await keep.getFsType();
          if (!fsType) throw Error(`Invalid path specified`);
          reply(keep.setContentType('text/plain'));
        } catch(err) {
          reply(err);
        }
        
      });
      hut.relSrc('stl.install').route(installRec => {
        let mainHost = foundation.getArg('hosting').find(v => 1).val;
        installRec.setVal({ httpTrg: `${foundation.formatHostUrl(mainHost)}/stl.run?reply=2` });
      });
      /// =ABOVE}
      
    },
    kidFn: async (hut, install, real, dep) => {
      
      let layoutNames = [ 'Free', 'Axis1D', 'Text', 'Decal', 'Press', 'Feel' ];
      let lay = await Promise.allObj(layoutNames.toObj(v => [ v, real.getLayoutForm(v) ]));
      
      let stlReal = dep(real.addReal('stl.install', [
        lay.Free({ w: '100%', h: '92%', x: '0', y: '-4%' }),
        lay.Axis1D({ axis: 'y', dir: '+', cuts: 'focus' })
      ]));
      
      stlReal.addReal('stl.title', { text: 'Hut Installation' },                  [ lay.Text({ gap: '4px', size: 'calc(120% + 1.8vw)' }) ]);
      stlReal.addReal('stl.step1', { text: '1. Install Nodejs (13.0.0 and up)' }, [ lay.Text({ gap: '2px', size: 'calc(90% + 1.1vw)' }) ]);
      stlReal.addReal('stl.step2', { text: '2. Run this in your terminal:' },     [ lay.Text({ gap: '6px', size: 'calc(90% + 1.1vw)' }) ]);
      
      let textReal = stlReal.addReal('stl.text', { text: '... loading ...' }, [
        lay.Text({ gap: 'calc(7px + 1vw)', size: 'calc(70% + 0.4vw)' }),
        lay.Decal({ border: { ext: '5px', colour: 'rgba(0, 0, 0, 0.3)' } }),
        lay.Press({ modes: [ 'discrete', 'continuous' ] }),
        lay.Feel({ modes: [ 'discrete' ] }),
      ]);
      
      dep(install.valSrc.route(() => {
        let httpTrg = install.getVal('httpTrg');
        textReal.mod({ text: httpTrg
          ? `node -e "h='${httpTrg}';require('http').get(h,(r,d=[])=>(r.on('data',c=>d.push(c)),r.on('end',()=>eval(d.join(''))(h))))"`
          : '-- loading --'
        });
      }));
      
      textReal.getLayout(lay.Press).src.route(() => real.getTech().select(textReal));
      textReal.getLayout(lay.Feel).src.route(() => real.getTech().select(textReal));
      
      stlReal.addReal('stl.reminder', { text: 'Always verify wild code before running!' }, [
        lay.Text({ gap: '6px', size: 'calc(70% + 0.3vw)' })
      ]);
      
    }
  });
  
};
