global.rooms['internal.install'] = async foundation => {
  
  let { FreeLayout, Axis1DLayout, TextLayout } = U.setup;
  let HutControls = await foundation.getRoom('hinterlands.hutControls');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.htmlBrowser');
  // let TerminalHabitat = await foundation.getRoom('hinterlands.habitat.terminal'); // Interact with app purely via command line (and maybe even a separate graphical ui experience like 'window' room
  // let TerminalGraphicalHabitat = await foundation.getRoom('hinterlands.habitat.terminalGraphical');
  
  let debug = foundation.getArg('debug');
  return HutControls('stl', 'internal.install', {
    debug,
    habitats: [ HtmlBrowserHabitat() ],
    parFn: (hut, install, real, dep) => {
      
      /// {ABOVE=
      // Make sure to use the non-admin fileSystem to control access
      let fsKeep = foundation.seek('keep', 'fileSystem');
      let installActionKeep = fsKeep.seek('room', 'internal', 'install', 'installAction.js').setContentType('text');
      
      hut.roadSrc('stl.run').route(({ reply, srcHut }) => reply(installActionKeep));
      hut.roadSrc('stl.item').route(async ({ msg, reply, srcHut }) => {
        
        let { pcs=null } = msg;
        if (U.isForm(pcs, String)) pcs = pcs.split(/[,/]/);
        if (!U.isForm(pcs, Array)) reply(Error(`"pcs" should be Array (or String); got ${U.nameOf(pcs)}`));
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
    kidFn: (hut, install, real, dep) => {
      
      console.log('Here...');
      
      let stlReal = dep(real.addReal('stl.install', {
        layouts: [ FreeLayout({ w: '100%', h: '92%', x: '0', y: '-4%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', dir: '+', cuts: 'focus' })
      }));
      stlReal.addReal('stl.title', { layouts: [ TextLayout({ gap: '4px', size: 'calc(120% + 1.8vw)',    text: 'Hut Installation' }) ] });
      stlReal.addReal('stl.step1', { layouts: [ TextLayout({ gap: '2px', size: 'calc(90% + 1.1vw)',  text: '1. Install Nodejs (13.0.0 and up)' }) ] });
      stlReal.addReal('stl.step2', { layouts: [ TextLayout({ gap: '6px', size: 'calc(90% + 1.1vw)',  text: '2. Run this in your terminal:' }) ] });
      let textReal = stlReal.addReal('stl.text', {
        layouts: [ TextLayout({ text: '...', gap: 'calc(7px + 1vw)', size: 'calc(70% + 0.4vw)' }) ],
        decals: { border: { ext: '5px', colour: 'rgba(0, 0, 0, 0.3)' } }
      });
      stlReal.addReal('stl.reminder', { layouts: [ TextLayout({ gap: '6px', size: 'calc(70% + 0.3vw)', text: 'Always verify wild code before running!' }) ] });
      
      dep(install.valSrc.route(() => {
        let httpTrg = install.getVal('httpTrg');
        textReal.setText(httpTrg
          ? `node -e "h='${httpTrg}';require('http').get(h,(r,d=[])=>(r.on('data',c=>d.push(c)),r.on('end',()=>eval(d.join(''))(h))))"`
          : '-- loading --'
        );
      }));
      
      let feelSrc = dep(textReal.addFeel('discrete')).src;
      dep(feelSrc.route(() => textReal.selectTextContent()));
      
      let pressSrc = dep(textReal.addPress()).src;
      dep(pressSrc.route(() => textReal.selectTextContent()));
      
    }
  });
  
};
