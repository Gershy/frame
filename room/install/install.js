global.rooms.install = async foundation => ({ open: async hut => {
  
  /// {ABOVE=
  let keep = foundation.seek('keep', 'fileSystem', 'room', 'install', 'installAction.js').setType('text/plain');
  
  let { hosting, ssl } = foundation.origArgs;
  
  let [ host, port ] = hosting.split(':');
  hosting = (port !== (ssl ? '443' : '80')) ? `${host}:${port}` : host;
  
  let httpDest = `${ssl ? 'https' : 'http'}://${hosting}?command=install.run`;
  hut.roadSrc('syncInit').route(({ reply }) => {
    reply(`node -e "require('http').get('${httpDest}',(r,d=[])=>(r.on('data',c=>d.push(c)),r.on('end',()=>eval(d.join('')))))"`);
  });
  hut.roadSrc('install.run').route(({ reply, srcHut }) => reply(keep));
  hut.roadSrc('install.item').route(async ({ msg, reply, srcHut }) => {
    
    if (!msg.has('pcs')) reply(Error(`Missing "pcs"`));
    if (!U.isType(msg.pcs, String)) reply(Error(`"pcs" should be String; got ${U.nameOf(msg.pcs)}`));
    
    let pcs = msg.pcs.split(',');
    let keep = foundation.seek('keep', 'fileSystem', ...pcs);
    
    try {
      reply(keep.setType('text/plain'));
    } catch(err) {
      console.log('Couldn\'t get file:\n', foundation.formatError(err));
      reply(Error(`Couldn't get ${keep.absPath}`));
    }
    
  });
  /// =ABOVE}
  
}});
