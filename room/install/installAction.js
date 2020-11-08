async hosting => {
  
  let [ fs, http, os, path ] = [ 'fs', 'http', 'os', 'path' ].map(require);
  hosting = hosting.split('?')[0];
  let copy = async function*(local, remote, seen=new Set()) {
    
    let remoteStr = remote.join('/');
    if (seen.has(remoteStr)) return;
    seen.add(remoteStr);
    
    let url = `${hosting}?command=stl.item&pcs=${remote.join(',')}&reply=1`;
    
    console.log(`Requesting: ${url}`);
    let res = await new Promise(r => http.get(url, r));
    let chunks = []; res.on('data', d => chunks.push(d));
    await new Promise(r => res.on('end', r));
    
    let data = Buffer.concat(chunks);
    try {
      let children = JSON.parse(data);
      if (!children || children.constructor !== Array) throw Error('Sad');
      await fs.promises.mkdir(path.join(...local));
      yield remote;
      for (let c of children) yield* copy([ ...local, c ], [ ...remote, c ]);
    } catch(err) {
      yield remote;
      await fs.promises.writeFile(path.join(...local), data);
    }
    
  };
  
  try {
    
    let local = [ ...path.resolve('.').split(path.sep), 'hut' ];
    let stat = null;
    try { stat = await fs.promises.stat(path.join(...local)); } catch(err) {}
    if (stat) throw Error(`${local.join('/')} already exists!`);
    
    console.log('Installing hut to:', local);
    let remote = [ '.' ];
    for await (let p of copy(local, remote)) console.log(`Copied path: [${p.join('/')}]`);
    
  } catch(err) {
    console.log(`Couldn't install: ${err.message}`);
  }
  
};
