global.rooms.install = async foundation => ({ open: async hut => {
  
  let { FreeLayout, Axis1DLayout, TextLayout } = U.setup;
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  let { makeHutAppScope } = await foundation.getRoom('hinterlands.hutApp')
  
  /// {ABOVE=
  let installActionKeep = foundation.seek('keep', 'fileSystem', 'room', 'install', 'installAction.js').setType('text');
  hut.roadSrc('stl.run').route(({ reply, srcHut }) => reply(installActionKeep));
  hut.roadSrc('stl.item').route(async ({ msg, reply, srcHut }) => {
    
    if (!msg.has('pcs')) reply(Error(`Missing "pcs"`));
    if (!U.isType(msg.pcs, String)) reply(Error(`"pcs" should be String; got ${U.nameOf(msg.pcs)}`));
    let keep = foundation.seek('keep', 'fileSystem', ...msg.pcs.split(','));
    
    try {
      let fsType = await keep.getFsType();
      if (!fsType) throw Error(`Invalid path specified`);
      reply(keep.setType('text/plain'));
    } catch(err) {
      reply(Error(`Couldn't get ${keep.absPath}`));
    }
    
  });
  
  hut.relSrc('stl.install').route(installRec => {
    
    let { hosting, ssl } = foundation.origArgs;
    let [ host, port ] = hosting.split(':');
    hosting = (port !== (ssl ? '443' : '80')) ? `${host}:${port}` : host;
    let httpDest = `${ssl ? 'https' : 'http'}://${hosting}?command=stl.run`;
    let text = `node -e "require('http').get('${httpDest}',(r,d=[])=>(r.on('data',c=>d.push(c)),r.on('end',()=>eval(d.join('')))))"`;
    installRec.setVal(text);
    
    installRec.valSrc.route(() => console.log(`Install value: ${installRec.getVal()}`));
    
  });
  /// =ABOVE}
  
  await HtmlApp({ name: 'install' }).decorateApp(hut);
  makeHutAppScope(hut, 'stl', 'install', (stlRec, stlHut, rootReal, dep) => {
    
    console.log('GOT REC:', stlRec.type.name);
    
    let stlReal = dep(rootReal.addReal('stl.install', {
      layouts: [ FreeLayout({ w: '100%', h: '100%', x: '0', y: '0' }) ],
      innerLayout: Axis1DLayout({ axis: 'y', dir: '+', cuts: 'focus' })
    }));
    stlReal.addReal('stl.title', { layouts: [ TextLayout({ gap: '4px', size: '150%', text: 'Hut installation:' }) ] });
    stlReal.addReal('stl.step1', { layouts: [ TextLayout({ gap: '2px', size: '130%', text: '1. Install Nodejs (version 13.0.0 minimum)' }) ] });
    stlReal.addReal('stl.step2', { layouts: [ TextLayout({ gap: '6px', size: '130%', text: '2. Run this in your terminal:' }) ] });
    let installationTextReal = stlReal.addReal('stl.text', {
      layouts: [ TextLayout({ text: '...', gap: '15px', size: '100%' }) ],
      decals: { border: { ext: '5px', colour: 'rgba(0, 0, 0, 0.3)' } }
    });
    
    dep(stlRec.valSrc.route(() => installationTextReal.setText(stlRec.getVal())));
    
    let feelSrc = dep(installationTextReal.addFeel('discrete')).src;
    dep(feelSrc.route(() => installationTextReal.selectTextContent()));
    
    let pressSrc = dep(installationTextReal.addPress()).src;
    dep(pressSrc.route(() => installationTextReal.selectTextContent()));
    
  });
  
}});
