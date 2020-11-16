global.rooms['internal.install'] = async foundation => {
  
  let { FreeLayout, Axis1DLayout, TextLayout } = U.setup;
  let Setup = await foundation.getRoom('hinterlands.setup');
  let HtmlBrowserHabitat = await foundation.getRoom('hinterlands.habitat.htmlBrowser');
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
    kidFn: async (hut, install, real, dep) => {
      
      /*
      
      // Compare:
      let lay = [ 'Text', 'Free', 'Axis1D' ];
      let layout = await Promise.allObj(lay.toObj(v => [ v, real.techLayout(v) ]));
      real.addReal('stl.install', {
        layouts: [ layout.Free({ w: '100%', h: '100%' }) ]
      });
      
      real.addReal('stl'install', {
        layouts: [ real.techLayout('Free', { w: '100%', h: '100%' }) ]
      });
      
      // `real.techLayout` references the "tech" property of the root
      // Real to provide a reference to a Layout Form of the specified
      // name. If given a 2nd param it returns an instance of the Form
      // initialized with the 2nd param as its arguments. If only 1
      // param (the name of the Form), the Form itself is returned. I
      // think it may be workable for a Real, upon initialization, to
      // determine any sync (immediately available) layouts/decals, and
      // render using them. If there are leftover layouts/decals waiting
      // to resolve the Real could simply wait for those promises to
      // fulfill, and then re-render with the newly available
      // information! Shortcomings of this?? Not exactly sure... A plus
      // is that any "innerLayout" will probably be immediately
      // available - it isn't likely that a TechRoom (like
      // /room/internal/tech/htmlBrowser/axis1D/axis1D.js) would define
      // its "innerLayout" (Axis1D.Item) in a separate Room!
      
      // It looks like there will be no requirement for tech-agnostic
      // Layout definitions (as in foundation.js) to exist. There *is*
      // an expected structure for Layouts of the same name amongst
      // differing habitats, but this doesn't need to be enshrined in
      // real code, especially BELOW (which is sensitive to bloat)
      
      */
      
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
