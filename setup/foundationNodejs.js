(() => {
  
  let [ path, fs, http, crypto, os ] = [ 'path', 'fs', 'http', 'crypto', 'os' ].map(v => require(v));
  let { Hog, Wob } = U;
  
  let rootDir = path.join(__dirname, '..');
  let roomDir = path.join(rootDir, 'room');
  let tempDir = path.join(rootDir, 'mill');
  
  // TODO: Shouldn't need sync file functions!
  let fsRemTreeSync = f => {
    let stat = U.safe(() => fs.statSync(f), () => null);
    if (!stat) return;
    if (stat.isFile()) { fs.unlinkSync(f); return; }
    let names = fs.readdirSync(f);
    for (let name of names) fsRemTreeSync(path.join(f, name));
    fs.rmdirSync(f);
  };
  
  let fsUpdFile = (cmps, v) => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't upd file "${f}"`);
    return Promise((rsv, rjc) => fs.writeFile(f, v, err0 => err0 ? rjc(err) : rsv()));
  };
  let fsGetFile = cmps => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't get file "${f}"`);
    return Promise((rsv, rjc) => fs.readFile(f, (err0, v) => err0 ? rjc(err) : rsv(v)));
  };
  let fsGetChildren = cmps => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't get children for "${f}"`);
    return Promise((rsv, rjc) => fs.readdir(f, (err0, v) => err0 ? rjc(err) : rsv(v)));
  };
  let fsRemFile = cmps => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't rem file "${f}"`);
    return Promise((rsv, rjc) => fs.unlink(f, err0 => err0 ? rjc(err) : rsv()));
  };
  let fsRemDir = cmps => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't rem dir "${f}"`);
    return Promise((rsv, rjc) => fs.rmdir(f, err0 => err0 ? rjc(err) : rsv()));
  };
  let fsRemTree = async cmps => {
    
    let meta = null;
    try         { meta = await fs.getFileMetadata(cmps); }
    catch(err)  { return; }
    
    // Files are easy
    if (meta.isFile()) return await fsRemFile(cmps);
    
    // Directories require more work
    let names = fsGetChildren(cmps);
    await Promise.allArr(names.map(n => fsRemTree([ ...cmps, n ])));
    await fsRemDir(cmps);
    
  };
  let fsGetFileMetadata = cmps => {
    let f = path.join(...cmps);
    let err = new Error(`Couldn't check file "${f}"`);
    return Promise((rsv, rjc) => fs.stat(f, (err0, stat) => err0 ? rjc(err0) : rsv(stat)));
  };
  let fsGetFileSize = async cmps => {
    let meta = await fsGetFileMetadata(cmps);
    return meta.size;
  };
  
  let { Foundation } = U.setup;
  let XmlElement = U.inspire({ name: 'XmlElement', methods: (insp, Insp) => ({
    init: function(tagName, type, text='') {
      if (![ 'root', 'singleton', 'container', 'text' ].has(type)) throw new Error(`Invalid type; ${type}`);
      this.tagName = tagName;
      this.type = type;
      this.props = {};
      this.children = [];
      this.text = '';
      this.setText(text);
    },
    setText: function(text) {
      if (text !== text.trim()) throw new Error(`Text "${text}" has extra whitespace`);
      this.text = text;
    },
    setProp: function(name, value=null) { this.props[name] = value; },
    add: function(child) {
      if (![ 'root', 'container' ].has(this.type)) throw new Error(`Can\'t add to type ${this.type}`);
      this.children.push(child);
      return child;
    },
    toString: function(indent='') {
      let lines = [];
      let propStr = this.props.toArr((v, k) => v === null ? k : `${k}="${v}"`).join(' ');
      if (propStr) propStr = ' ' + propStr;
      
      return ({
        singleton: (i, t, p) => `${i}<${t}${p}${t.hasHead('!') ? '' : '/'}>\n`,
        text: (i, t, p) => this.text.has('\n')
          ? `${i}<${t}${p}>\n${this.text.split('\n').map(ln => i + '  ' + ln).join('\n')}\n${i}</${t}>\n`
          : `${i}<${t}${p}>${this.text}</${t}>\n`,
        root: (i, t, p, c) => `${i}${c.map(c => c.toString(i)).join('')}`,
        container: (i, t, p, c) => `${i}<${t}${p}>\n${c.map(c => c.toString(i + '  ')).join('')}${i}</${t}>\n`
      })[this.type](indent, this.tagName, propStr, this.children);
    }
  })});
  let FoundationNodejs = U.inspire({ name: 'FoundationNodejs', insps: { Foundation }, methods: (insp, Insp) => ({
    init: function() {
      
      insp.Foundation.init.call(this);
      
      this.roomsInOrder = [];
      this.compilationData = {};
      this.mountedFiles = {}; // TODO: with MANY files could save this in its own file
      
      this.variantDefs = {
        above: { above: 1, below: 0 },
        below: { above: 0, below: 1 }
      };
      
      this.transportDebug = false;
      this.httpFullDebug = false;
      this.spoofEnabled = false;
      
      this.usage0 = process.memoryUsage().map(v => v);
      
      // These directories get purged (TODO: should happen when hut *ends*, not *begins*)
      fsRemTreeSync(path.join(tempDir, 'storage'));
      fsRemTreeSync(path.join(tempDir, 'room'));
      
      // Create all necessary directories
      U.safe(() => fs.mkdirSync(tempDir));
      U.safe(() => fs.mkdirSync(path.join(tempDir, 'habit')));
      U.safe(() => fs.mkdirSync(path.join(tempDir, 'room')));
      U.safe(() => fs.mkdirSync(path.join(tempDir, 'storage')));
      
    },
    defaultGoals: function() {
      
      let { Goal } = U.setup;
      
      let habitGoal = Goal({
        name: 'habit',
        desc: 'Deal with tasks that are done regularly',
        detect: args => args.has('habit'),
        enact: async (foundation, args) => {}
      });
      
      habitGoal.children.add(Goal({
        name: 'all',
        desc: 'List all habits',
        detect: args => U.isType(args.habit, Object) && args.habit.has('all'),
        enact: async (foundation, args) => {
          
          let habits = fs.readdirSync(path.join(tempDir, 'habit'));
          if (habits.length) {
            console.log('Available habits:');
            habits.sort().forEach(f => console.log(`  - ${f.crop(0, 5)}`)); // 5 is length of ".json"
          } else {
            console.log('No habits available!');
          }
          
        }
      }));
      
      habitGoal.children.add(Goal({
        name: 'add',
        desc: 'Add a new habit',
        detect: args => U.isType(args.habit, Object) && args.habit.has('add'),
        enact: async (foundation, args) => {
          
          let habitName = args.habit.add;
          
          if (!habitName) throw new Error('Need to provide name for habit');
          
          let habitData = ({ ...args }).gain({ habit: C.skip });
          let jsonArgs = JSON.stringify(habitData, null, 2);
          await fsUpdFile([ tempDir, 'habit', `${habitName}.json` ], jsonArgs);
          console.log(`Saved habit "${habitName}"; args:`, jsonArgs);
          
        }
      }));
      
      habitGoal.children.add(Goal({
        name: 'rem',
        desc: 'Remove an existing habit',
        detect: args => U.isType(args.habit, Object) && args.habit.has('rem'),
        enact: async (foundation, args) => {
          
          let habitName = args.habit.rem.split('.');
          
          if (!habitName) throw new Error('Need to provide name for habit');
          
          try {
            await fsRemFile([ tempDir, 'habit', `${habitName}.json` ]);
            console.log(`Removed habit "${habitName}"`);
          } catch(err) {
            console.log(`No habit named "${habitName}"`);
          }
          
        }
      }));
      
      habitGoal.children.add(Goal({
        name: 'use',
        desc: 'Repeat an existing habit',
        detect: args => U.isType(args.habit, Object) && args.habit.has('use'),
        enact: async (foundation, args) => {
          
          let habitName = args.habit.use.split('.');
          
          if (!habitName) throw new Error('Need to provide name for habit');
          
          let data = JSON.parse(await fsGetFile([ tempDir, 'habit', `${habitName}.json` ]));
          let newArgs = ({ ...data, ...args }).gain({ habit: C.skip });
          
          await foundation.raise(newArgs);
          
        }
      }));
      
      let versionGoal = Goal({
        name: 'version',
        desc: 'Show version information',
        detect: args => args.has('version') && args.version,
        enact: async (foundation, args) => {
          console.log('Version 0.0.1');
          console.log('Developed by Gershom Maes');
          console.log('Email: gershom.maes@gmail.com');
        }
      });
      
      let helpGoal = Goal({
        name: 'help',
        desc: 'Show help information',
        detect: args => args.has('help') && args.help,
        enact: async (foundation, args) => {
          
          let helpWithGoal = (goal, depth=0, pref=[]) => {
            
            pref.push(goal.name);
            let indent = ' '.repeat(depth * 2);
            let name = pref.join('.');
            console.log(`${indent}${name.upper()}:`);
            console.log(`${indent}"${goal.desc}"`);
            
            for (let child of goal.children) {
              helpWithGoal(child, depth + 1, [ ...pref ]);
            }
            
          };
          
          for (let goal of foundation.goals) helpWithGoal(goal);
          
        }
      });
      
      let environmentGoal = Goal({
        name: 'env',
        desc: 'Query environment information',
        detect: args => args.has('env') && args.env,
        enact: async (foundation, args) => {}
      });
      
      environmentGoal.children.add(Goal({
        name: 'network',
        desc: 'Show network information',
        detect: args => args.env === 'network',
        enact: async (foundation, args) => {
          console.log('Network info:');
          console.log(JSON.stringify(foundation.getStaticIps(), null, 2));
        }
      }));
      
      // Make sure habits have precendence!
      return [ habitGoal, ...insp.Foundation.defaultGoals.call(this), versionGoal, environmentGoal, helpGoal ];
      
    },
    
    // Compilation
    parsedDependencies: async function(roomName) {
      // Determine the inner rooms of `roomName` by parsing the file for the "innerRooms" property
      
      let roomFileContents = await this.readFile(path.join(roomDir, roomName, `${roomName}.js`));
      let depStr = roomFileContents.match(/innerRooms:\s*\[([^\]]*)\]/)[1].trim();
      return depStr
        ? depStr.split(',').map(v => { v = v.trim(); return v.substr(1, v.length - 2); })
        : [];
    },
    
    compileRecursive: async function(roomName, compiledPrms={}, precedence=[]) {
      
      // Note that we deal with only the names of rooms instead of full-fledged
      // room-data, because no room is being brought to life here. We are only
      // compiling source code at this stage.
      
      // Note there are two separate containers for room names:
      // - `compiledPrms` keeps track of every room currently compiling. It
      //   also tells us which rooms are done compiling, as opposed to those
      //   still in progress (via pending/resolved state of the promise).
      // - `precedence` is extended whenever a room becomes fully compiled.
      //   this function will ensure that a room can only fully compile not
      //   only when all its dependencies are *in the process of compiling*,
      //   but are *fully compiled*! This means that rooms will always be
      //   added to `precedence` such that a added earlier never depends on
      //   a room added later.
      
      if (compiledPrms.has(roomName)) return compiledPrms[roomName];
      
      let rsv = null, rjc = null, prm = Promise((rsv0, rjc0) => { rsv = rsv0; rjc = rjc0; });
      compiledPrms[roomName] = prm;
      
      // Get dependency room names
      let depNames = await this.parsedDependencies(roomName);
      
      // Don't continue until all dependencies are compiled! Even if we
      // know that our dependencies are already under compilation, we
      // need to wait for them to finish. This will ensure that rooms
      // compile in order of dependency-precedence
      await Promise.allArr(depNames.map(dn => this.compileRecursive(dn, compiledPrms, precedence)));
      
      // All dependencies are compiled!
      await this.compile(roomName);
      
      // There may be other rooms waiting on our compilation. Notify
      // them by resolving our promise!
      rsv(precedence.gain([ roomName ]));
      
      return precedence;
      
    },
    compile: async function(roomName) {
      
      // Compile a single room; generate a new file for each variant
      
      let contentLines = await this.readFile(path.join(roomDir, roomName, `${roomName}.js`));
      contentLines = contentLines.split('\n');
      this.compilationData[roomName] = {};
      
      for (let variantName in this.variantDefs) {
        
        let compiledFileName = path.join(roomDir, roomName, `${roomName}.${variantName}.js`);
        let { content: compiledContent, offsets } = this.compileContent(variantName, contentLines);
        await this.writeFile(compiledFileName, compiledContent, { flag: 'w', encoding: 'utf8' }); // Contents are written to disk
        
        this.compilationData[roomName][variantName] = { fileName: compiledFileName, offsets }; // Filename and offsets are kept
      }
      
    },
    compileContent: function(variantName, contentLines) {
      
      // Compile file content; filter based on variant tags
      
      if (U.isType(contentLines, String)) contentLines = contentLines.split('\n');
      let variantDef = this.variantDefs[variantName];
      
      let blocks = [];
      let curBlock = null;
      
      for (let i = 0; i < contentLines.length; i++) {
        let line = contentLines[i].trim();
        
        if (curBlock) {
          if (line.has(`=${curBlock.type.upper()}}`)) {
            curBlock.end = i;
            blocks.push(curBlock);
            curBlock = null;
          }
        }
        
        if (!curBlock) {
          for (let k in variantDef) {
            if (line.has(`{${k.upper()}=`)) { curBlock = { type: k, start: i, end: -1 }; break; }
          }
        }
      }
      
      if (curBlock) throw new Error(`Final ${curBlock.type} block is unbalanced`);
      let curOffset = null;
      let offsets = [];
      let nextBlockInd = 0;
      let filteredLines = [];
      
      for (let i = 0; i < contentLines.length; i++) {
        let rawLine = contentLines[i];
        let line = rawLine.trim();
        
        if (!curBlock && nextBlockInd < blocks.length && blocks[nextBlockInd].start === i) {
          curBlock = blocks[nextBlockInd];
          nextBlockInd++;
        }
        
        let keepLine = true;
        if (!line) keepLine = false; // Remove blank lines
        if (line.hasHead('//')) keepLine = false; // Remove comments
        if (curBlock && i === curBlock.startInd) keepLine = false;
        if (curBlock && i === curBlock.endInd) keepLine = false;
        if (curBlock && !variantDef[curBlock.type]) keepLine = false;
        
        if (keepLine) {
          curOffset = null;
          filteredLines.push(rawLine);
        } else {
          if (!curOffset) {
            curOffset = { at: i, offset: 0 };
            offsets.push(curOffset);
          }
          curOffset.offset++;
        }
        
        if (curBlock && i === curBlock.end) {
          curBlock = null;
          if (nextBlockInd < blocks.length && blocks[nextBlockInd].start === i) {
            curBlock = blocks[nextBlockInd];
            nextBlockInd++;
          }
        }
        
      }
      
      return {
        content: filteredLines.join('\n'),
        offsets
      };
    },
    mapLineToSource: function(fileName, lineInd) {
      // For a compiled file and line number, return the corresponding line number
      // in the source
      
      fileName = path.basename(fileName);
      let fileNameData = fileName.match(/^([^.]+)\.([^.]+)\.js/);
      if (!fileNameData) return null;
      
      let [ roomName, variant ] = fileNameData.slice(1);
      if (!this.compilationData.has(roomName)) throw new Error(`Missing room ${roomName}`);
      if (!this.compilationData[roomName].has(variant)) return null;
      
      let variantData = this.compilationData[roomName][variant];
      
      let offsets = variantData.offsets;
      
      let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
      let nextOffset = 0; // The index of the next offset chunk which may take effect
      for (let i = 0; i < lineInd; i++) {
        // Find all the offsets which exist for the source line
        // For each offset increment the line in the source file
        while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
          srcLineInd += offsets[nextOffset].offset;
          nextOffset++;
        }
        srcLineInd++;
      }
      
      return { roomName, srcLineInd };
    },
    formatError: function(err) {
      // Form a pretty representation of an error. Remove noise from filepaths
      // and map line indices from compiled->source.
      
      let [ msg, type, stack ] = [ err.message, err.constructor.name, err.stack ];
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
      let pathSepReg = new RegExp(path.sep.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
      
      let lines = trace.split('\n').map(line => {
        
        // Note: Some lines look like
        //    "    at Function.Module (internal/modules/cjs/loader.js:69:100)"
        // while others are less verbose:
        //    "    at internal/modules/cjs/loader.js:69:100"
        
        let origLine = line;
        
        try {
          
          // The codepoint filename must not contain round/square brackets or spaces
          let codePointPcs = line.match(/([^()[\] ]+):([0-9]+):([0-9]+)/);
          let [ fileName, lineInd, charInd ] = codePointPcs.slice(1);
          
          fileName = path.normalize(fileName);
          if (!fileName.hasHead(rootDir)) return C.skip; // Skip non-hut files
          
          let mappedLineData = this.mapLineToSource(fileName, parseInt(lineInd, 10));
          
          if (mappedLineData) {
            fileName = `room/${mappedLineData.roomName}/${mappedLineData.roomName}.src`;
            lineInd = mappedLineData.srcLineInd;
          } else {
            fileName = fileName.substr(rootDir.length + 1).split(path.sep).join('/');
          }
          
          return `${fileName.padTail(36)} @ ${lineInd.toString()}`;
          
        } catch(err) {
          
          return C.skip; // `TRACEERR - ${err.message.split('\n').join(' ')} - "${origLine}"`;
          
        }
        
      });
      
      let fileRegex = /([^\s]+\.(above|below|between|alone)\.js):([0-9]+)/;
      let preLen = err.constructor.name.length + 2; // The classname plus ": "
      let moreLines = stack.substr(preLen, traceBegins - 1 - preLen).replace(fileRegex, (match, file, bearing, lineInd) => {
        
        let mappedLineData = this.mapLineToSource(file, parseInt(lineInd, 10));
        return mappedLineData
          ? `room/${mappedLineData.roomName}/${mappedLineData.roomName}.src:${mappedLineData.srcLineInd}`
          : match;
        
      }).split('\n');
      
      return [
        '='.repeat(46),
        ...moreLines.map(ln => `||  ${ln}`),
        '||' + ' -'.repeat(22),
        ...(lines.length ? lines : [ 'Couldn\'t format error:', ...trace.split('\n') ]).map(ln => `||  ${ln}`)
      ].join('\n');
      
    },
    
    // Platform
    queueTask: process.nextTick, //function(func) { process.nextTick(func); },
    getMemUsage: function() {
      let usage1 = process.memoryUsage();
      return {
        rss: usage1.rss - this.usage0.rss,
        heapTotal: usage1.heapTotal,
        heapUsed: usage1.heapUsed - this.usage0.heapUsed
      };
    },
    addMountFile: function(name, type, src) {
      let nativeDir = path.join(rootDir, src);
      try { fs.statSync(nativeDir); }
      catch(err) { throw new Error(`Couldn't add file ${name}: ${src}`); }
      this.mountedFiles[name] = { type, nativeDir };
    },
    addMountDataAsFile: function(name, type, data) {
      let nativeDir = path.join(tempDir, 'storage', name);
      fs.writeFileSync(nativeDir, data);
      this.mountedFiles[name] = { type, nativeDir };
    },
    getMountFile: function(name) {
      if (!this.mountedFiles.has(name)) throw new Error(`File "${name}" isn't mounted`);
      let { method, type, nativeDir } = this.mountedFiles[name];
      
      return {
        ISFILE: true, type, name,
        getContent: async () => { 
          if (!this.mountedFiles.has(name)) throw new Error(`File "${name}" isn't mounted`);
          this.readFile(nativeDir)
        },
        getPipe: () => fs.createReadStream(nativeDir),
        getNumBytes: async () => (await fsGetFileMetadata([ nativeDir ])).size
      };
    },
    remMountFile: function(name) {
      if (!this.mountedFiles.has(name)) throw new Error(`File "${name}" isn't mounted`);
      delete this.mountedFiles[name];
    },
    getRootReal: async function() { return null; }, // TODO: Maybe someday, electron!
    getStaticIps: function(pref=[]) {
      return os.networkInterfaces()
        .toArr((v, type) => v.map(vv => ({ type, ...vv.slice('address', 'family', 'internal') })))
        .to(arr => Array.combine(...arr))
        .map(v => v.family.hasHead('IPv') && v.address !== '127.0.0.1' ? v.slice('type', 'address', 'family') : C.skip);
    },
    readFile: async function(name, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.readFile(name, options, (err, c) => {
        return err ? rjc(err0.gain({ message: `Couldn't read ${name}: ${err.message}` })) : rsv(c);
      }));
    },
    writeFile: async function(name, content, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.writeFile(name, content, options, (err, c) => {
        return err ? rjc(err0.gain({ message: `Couldn't write ${name}: ${err.message}` })) : rsv(c);
      }));
    },
    compactIp: function(verboseIp, verbosePort) {
      // TODO: This is ipv4; could move to v6 easily by lengthening return value and padding v4 vals with 0s
      if (verboseIp === 'localhost') verboseIp = '127.0.0.1';
      let pcs = verboseIp.split(',')[0].trim().split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw new Error(`Invalid ip: "${verboseIp}"`);
      let ip = pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
      return ip + ':' + verbosePort.toString(16).padHead(4, '0'); // Max port hex value is ffff; 4 digits
    },
    makeHttpServer: async function(pool, ip, port) {
      let serverWob = Wob({});
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = (res, msg) => {
        
        let type = (() => {
          if (U.isType(msg, String)) return msg[0] === '<' ? 'html' : 'text';
          if (U.isType(msg, Object)) return msg.has('ISFILE') ? 'file' : 'json';
          throw new Error(`Unknown type for ${U.typeOf(msg)}`);
        })();
        
        // TODO: This is nice content-type-dependent information!
        if (this.transportDebug) console.log(`??TELL ${'cpuId'}:`, ({
          text: () => ({ ISTEXT: true, val: msg }),
          html: () => ({ ISHTML: true, val: `${msg.split('\n')[0].substr(0, 30)}...` }),
          json: () => JSON.stringify(msg).length < 200 ? msg : `${JSON.stringify(msg).substr(0, 200)}...`,
          file: () => ({ ISFILE: true, ...msg.slice('name', 'type') })
        })[type]());
        
        return ({
          text: () => {
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(msg) });
            res.end(msg);
          },
          html: () => {
            res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(msg) });
            res.end(msg);
          },
          json: () => {
            try { msg = JSON.stringify(msg); }
            catch(err) { console.log('Couldn\'t serialize json', msg); throw err; }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(msg) });
            res.end(msg);
          },
          file: async () => {
            let numBytes = await msg.getNumBytes();
            res.writeHead(200, {
              'Content-Type': (msg.has('type') && msg.type) ? msg.type : 'application/octet-stream',
              'Content-Length': numBytes
            });
            msg.getPipe().pipe(res);
          }
        })[type]();
        
      };
      let server = http.createServer(async (req, res) => {
        
        // TODO: connections should be Hogs - with "shut" and "shutWob" methods
        // Right now they have "shut" set to `U.Wob()`
        
        // Stream the body
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        let body = await new Promise(r => req.on('end', () => r(chunks.join(''))));
        
        // `body` is either JSON or the empty string (TODO: For now!)
        try { body = body.length ? JSON.parse(body) : {}; }
        catch(err) { console.log('Couldn\'t parse body', body); body = {}; }
        
        let { path: urlPath, query } = this.parseUrl(`http://${req.headers.host}${req.url}`);
        
        if (this.httpFullDebug) {
          console.log('\n\n' + [
            '==== INCOMING REQUEST ====',
            `IP: ${req.connection.remoteAddress}`,
            `METHOD: ${req.method}`,
            `REQURL: ${req.url}`,
            `REQQRY: ${JSON.stringify(query, null, 2)}`,
            `REQHDS: ${JSON.stringify(req.headers, null, 2)}`,
            `BODY: ${JSON.stringify(body, null, 2)}`
          ].join('\n'));
        }
        
        let isSpoofed = this.spoofEnabled && query.has('spoof');
        
        let [ ip, port ] = isSpoofed
          ? query.spoof.split(':')
          : [ req.connection.remoteAddress, 80 /*req.connection.remotePort*/ ];
        
        let cpuId = ip.has('.') ? this.compactIp(ip, port) : `${ip}:${port}`;
        
        // // Build the "cpuId"; use ip + innerId
        // // TODO: Rename "compactIp" -> "uniqueCpuId"?
        // let cpuId = this.compactIp(ip, port);
        
        // Get the connection from the pool
        let conn = pool.getConn(cpuId, serverWob);
        
        if (!conn) {
          
          conn = Hog(() => {
            // Fizzle all remaining polls
            conn.waitResps.forEach(res => res.end());
          });
          conn.cpuId = cpuId;
          conn.isSpoofed = isSpoofed;
          conn.ipPort = [ ip, port ];
          conn.hear = Wob({});
          conn.tell = msg => conn.waitResps.length // Send immediately if possible, otherwise queue!
            ? sendData(conn.waitResps.shift(), msg)
            : conn.waitTells.push(msg);
          conn.waitResps = [];
          conn.waitTells = [];
          
          pool.addConn(conn.cpuId, serverWob, conn);
          serverWob.wobble(conn);
          
        }
        
        // A requirement to sync means the response data alone lacks context;
        // the response object will need to correspond to its fellow request
        let syncReqRes = false;
        
        // We are receiving http Requests, but need to work with hut-style Commands
        // The http body should be a Command in json format, but if it's empty
        // we'll translate the other features of the Request into a Command. This
        // is necessary for accommodating unavoidable http functionality, like the
        // initial request to a page (which is always a simple, body-less GET!)
        if (body.isEmpty()) {
          if (urlPath.hasHead('/!')) {
            if (urlPath.hasHead('/!FILE/')) {
              body = { command: 'getFile', path: urlPath.substr(7) }; // `7` strips off "/!FILE/"
              syncReqRes = true;
            }
          } else if (urlPath === '/') {
            [ body, syncReqRes ] = [ { command: 'getInit' }, true ];
          } else { // If a meaningless request is received reject it and close the connection
            conn.shut();
            res.writeHead(400);
            return res.end();
          }
        }
        
        // Determine the actions that need to happen at various levels for this command
        let comTypesMap = {
          // getInit has effects at both transport- and hut-level
          getInit:  {
            transport: conn => {
              conn.waitResps.forEach(res => res.end());
              conn.waitResps = [];
              conn.waitTells = [];
            },
            hut: true
          },
          close: {
            transport: conn => conn.shut()
          },
          bankPoll: {
            transport: conn => { /* empty transport-level action */ }
          }
        };
        
        // If no ComType found, default to Hut-level command!
        let comTypes = comTypesMap.has(body.command) ? comTypesMap[body.command] : { hut: true };
        
        // Run transport-level actions
        if (comTypes.has('transport')) comTypes.transport(conn);
        
        // Synced requests end here - `conn.hear.wobble` MUST result in a response
        // TODO: Could consider a timeout to deal with careless, responseless usage
        if (syncReqRes) return conn.hear.wobble([ body, msg => sendData(res, msg) ]);
        
        // Run hut-level actions
        if (comTypes.has('hut')) conn.hear.wobble([ body, null ]);
        
        // TODO: Only a single longpoll is held - no need for an Array of longpolls!
        // HTTP POLLING MANAGEMENT; We now have an unspent, generic-purpose poll available:
        // If there are any tells send the oldest, otherwise keep ahold of the response
        // If we have multiple polls available, return all but one
        // (Can't hold too many polls - most browsers limit http connections per site)
        conn.waitTells.length ? sendData(res, conn.waitTells.shift()) : conn.waitResps.push(res);
        while (conn.waitResps.length > 1) sendData(conn.waitResps.shift(), { command: 'fizzle' });
        
      });
      serverWob.desc = `HTTP @ ${ip}:${port}`;
      
      await new Promise(r => server.listen(port, ip, 511, r));
      return serverWob;
    },
    makeSoktServer: async function(ip=this.ip, port=this.port + 1) {
      let serverWob = Wob({});
      let server = net.createServer(sokt => {
        
        let connectionWob = {
          ip: this.compactIp(sokt.remoteAddress, sokt.remotePort),
          hear: Wob({}),
          tell: Wob({}), // TODO: Should be a function
          shut: Wob({})
        };
        
        let status = 'starting';
        let buffer = Buffer.alloc(0);
        let curOp = null;
        let curFrames = [];
        
        // These functions use the higher-scope `buffer` as their source of data
        let heardHandshakeData = () => {
          if (buffer.length < 4) return;
          
          // Search for a 0x1101, 0x1010, 0x1101, 0x1010 sequence
          let packetInd = null;
          for (let i = 0, len = buffer.length - 4; i <= len; i++) {
            if (buffer[i] === 13 && buff[i + 1] === 10 && buff[i + 1] === 13 && buff[i + 3] === 10) { packetInd = i; break; }
          }
          if (packetInd === null) return;
          
          let packet = buffer.slice(0, packetInd).toString('utf8');
          buffer = buffer.slice(packetInd + 4);
          
          // Do an http upgrade operation
          try {
            
            let lines = packet.split('\r\n');
            
            // Parse headers:
            let headers = {};
            for (let i = 1; i < lines.length; i++) {
              let line = lines[i];
              let [ head, ...tail ] = line.split(':');
              if (tail.isEmpty()) throw new Error(`Line isn't header: ${line}`);
              let k = line.substr(0, sepInd).trim().toLowerCase();
              let v = line.substr(sepInd + 1).trim();
              headers[head.trim()] = tail.join(':').trim();
            }
            
            if (!headers.hasOwnProperty('sec-websocket-key')) throw new Error('Missing "sec-websocket-key" header');
            let hash = crypto.createHash('sha1');
            hash.end(`${headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
            sokt.write([
              'HTTP/1.1 101 Switching Protocols',
              'Upgrade: websocket',
              'Connection: Upgrade',
              `Sec-WebSocket-Accept: ${hash.read().toString('base64')}`,
              '\r\n'
            ].join('\r\n'));
            
            status = 'started';
            connectionWob.tell.hold(msg => {
              if (status !== 'started') throw new Error(`Can't send data to client with status ${status}`);
              let data = null;
              try { data = JSON.stringify(msg); }
              catch(err) { console.log('Couldn\'t serialize message', msg); return; }
              
              let metaBuff = null;
              
              if (data.length < 126) {            // small-size
                
                metaBuff = Buffer.alloc(2);
                metaBuff[1] = data.length;
                
              } else if (data.length < 65536) {   // medium-size
                
                metaBuff = Buffer.alloc(4);
                metaBuff[1] = 126;
                metaBuff.writeUInt16BE(data.length, 2);
                
              } else {                            // large-size
                
                metaBuff = Buffer.alloc(8);
                metaBuff[1] = 127;
                metaBuff.writeUInt32BE(Math.floor(data.length / U.int32), 2);
                metaBuff.writeUInt32BE(data.length % U.int32, 6);
                
              }
              
              metaBuff[0] = 129; // 128 + 1; `128` pads for modding by 128; `1` is the "text" op
              sokt.write(Buffer.concat([ metaBuff, Buffer.from(data) ]), () => {}); // Ignore the callback
            });
            serverWob.wobble(connectionWob);
            
          } catch(err) {
            
            console.log(`Couldn't do handshake:\nPACKET:\n${packet}`);
            sokt.end(`HTTP/1.1 400 ${err.message} \r\n\r\n`);
            throw err;
            
          }
          
          // Process any remaining data as a websocket message
          try {
            if (buffer.length) safeHeardData();
          } catch(err) {
            console.log(`Error hearing data: ${this.formatError(err)}`);
          }
          
        };
        let heardData = function() { while (buffer.length >= 2) {
          // ==== PARSE FRAME
          
          let b = buffer[0] >> 4; // Look at bits beyond first 4
          if (b % 8) throw new Error('Some reserved bits are on');
          let final = b === 8;
          
          let op = buffer[0] % 16;
          if (op < 0 || (op > 2 && op < 8) || op > 10) throw new Error(`Invalid op: ${op}`);
          
          if (op >= 8 && !final) throw new Error('Fragmented control frame');
          
          b = buffer[1];
          let masked = b >> 7;
          
          // Server requires a mask. Client requires no mask
          if (!masked) throw new Error('No mask');
          
          let length = b % 128;
          let offset = masked ? 6 : 2; // Masked frames have an extra 4 halfwords containing the mask
          
          if (buffer.length < offset + length) return; // Await more data
          
          if (length === 126) {         // Websocket's "medium-size" frame format
            length = buffer.readUInt16BE(2);
            offset += 2;
          } else if (length === 127) {  // Websocket's "large-size" frame format
            length = buffer.readUInt32BE(2) * U.int32 + buffer.readUInt32BE(6);
            offset += 8;
          }
          
          if (buffer.length < offset + length) return; // Await more data
          
          // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
          let data = buffer.slice(offset, offset + length);
          if (masked) { // Apply an XOR mask if directed
            
            let mask = buffer.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
            let w = 0;
            for (let i = 0, len = data.length; i < len; i++) {
              data[i] ^= mask[w];
              w = w < 3 ? w + 1 : 0; // `w` follows `i`, but wraps every 4. More efficient than `%`
            }
            
          }
          
          // Remove the frame we've managed to locate
          buffer = buffer.slice(offset + length); 
          
          // ==== PROCESS FRAME (based on `final`, `op`, and `data`)
          
          // The following operations can occur regardless of the socket's status
          if (op === 8) {         // Process "close" op
            
            status = 'ending';
            sokt.end();
            break;
            
          } else if (op === 9) {  // Process "ping" op
            
            throw new Error('Unimplemented op: 9');
            
          } else if (op === 10) { // Process "pong" op
            
            throw new Error('Unimplemented op: 10');
            
          }
          
          // For the following operations, ensure that the socket is open and steady
          if (status !== 'started') continue;
          
          // Validate "continuation" functionality
          if (op === 0 && curOp === null) throw new Error('Invalid continuation frame');
          if (op !== 0 && curOp !== null) throw new Error('Expected continuation frame');
          
          // Process "continuation" ops as if they were the op being continued
          if (op === 0) op = curOp;
          
          // Text ops are our ONLY supported ops!
          if (op !== 1) throw new Error(`Unsupported op: ${op}`);
          
          curOp = 1;
          curFrames.push(data);
          
          if (final) {
            let fullStr = Buffer.concat(p.curFrames).toString('utf8');
            curOp = null;
            curFrames = [];
            connectionWob.hear.wobble(JSON.parse(fullStr));
          }
        }};
        let safeHeardData = function() {
          try {
            heardData();
          } catch(err) {
            buffer = Buffer.alloc(0);
            curOp = null;
            curFrames = [];
            throw err;
          };
        };
        
        sokt.on('readable', () => {
          let incomingBuffer = sokt.read();
          if (!incomingBuffer) return;
          let totalLen = buffer.length + incomingBuffer.length; // TODO: Deny big requests!
          buffer = Buffer.concat([ buffer, incomingBuffer ], totalLen);
          
          if (status === 'started') {
            
            try { safeHeardData(); }
            catch(err) { console.log(`Sokt error when started:\n${this.formatError(err)}`); }
            
          } else if (status === 'starting') {
            
            try { heardHandshakeData(); }
            catch(err) { console.log(`Error handshaking: ${this.formatError(err)}`); }
            
          } else {
            
            console.log(`Ignored ${incomingBuffer.length} bytes; status is ${status}`);
            // buffer = Buffer.alloc(0);
            // curOp = null;
            // curFrames = [];
            
          }
          
        });
        sokt.on('close', () => {
          status = 'ended';
          buffer = null;
          curOp = null;
          curFrames = [];
          connectionWob.shut();
        });
        sokt.on('error', err => {
          console.log(`Socket error:\n${this.formatError(err)}`);
          sokt.end();
        });
        
      });
      
      await new Promise(r => server.listen(port, ip, r));
      return serverWob;
    },
    
    prepareForTests: function() {
      require('./hutkeeping.js');
      this.variantDefs.forEach(vd => vd.gain({ test: 1 }));
    },
    getPlatformName: function() { return this.ip ? `nodejs @ ${this.ip}:${this.port}` : 'nodejs'; },
    genInitBelow: async function(contentType, absConn, hutTerm, urlResources, initContent={}) {
      
      let urlFn = this.spoofEnabled
        ? fp => `/!FILE${fp}?spoof=${absConn.cpuId}` // TODO: Even if `absConn` isn't spoofing, this will occur
        : fp => `/!FILE${fp}`;
      
      let cssUrls = [];
      let jsUrls = [];
      let otherUrls = [];
      
      urlResources.forEach(({ type, url }) => {
        if (type === 'text/css')              cssUrls.push(url);
        else if (type === 'text/javascript')  jsUrls.push(url);
        else                                  otherUrls.push(url);
      });
      
      if (contentType !== 'text/html') throw new Error(`Invalid content type: ${contentType}`);
      
      let doc = XmlElement(null, 'root');
      
      let doctype = doc.add(XmlElement('!DOCTYPE', 'singleton'));
      doctype.setProp('html');
      
      let html = doc.add(XmlElement('html', 'container'));
      
      let head = html.add(XmlElement('head', 'container'));
      let title = head.add(XmlElement('title', 'text', `${this.hut.upper()}`));
      
      let favicon = head.add(XmlElement('link', 'singleton'));
      favicon.setProp('rel', 'shortcut icon');
      favicon.setProp('type', 'image/x-icon');
      favicon.setProp('href', urlFn('/favicon.ico'));
      
      cssUrls.forEach(cssUrl => {
        let link = head.add(XmlElement('link', 'singleton'));
        link.setProp('rel', 'stylesheet');
        link.setProp('type', 'text/css');
        link.setProp('href', urlFn(cssUrl));
      });
      
      // Make a `global` value available to browsers
      let setupScript = head.add(XmlElement('script', 'text'));
      setupScript.setProp('type', 'text/javascript');
      setupScript.setText('window.global = window;');
      
      let mainScript = head.add(XmlElement('script', 'text'));
      
      jsUrls.forEach(cssUrl => {
        let script = head.add(XmlElement('script', 'text'));
        link.setProp('type', 'text/javascript');
        link.setProp('src', urlFn(cssUrl));
      });
      
      // TODO: Namespacing issue here (e.g. a room named "foundation" clobbers the "foundation.js" file)
      // TODO: Could memoize the static portion of the script
      // Accumulate all files needed to run this hut Below in the browser:
      // 1) setup/clearing.js
      // 2) setup/foundation.js
      // 3) setup/foundationBrowser.js
      // 4..n) Necessary rooms
      let files = {
        clearing: 'setup/clearing.js',
        foundation: 'setup/foundation.js',
        foundationBrowser: 'setup/foundationBrowser.js',
        ...this.roomsInOrder.toObj(roomName => [ roomName, `room/${roomName}/${roomName}.below.js` ])
      };
      let contents = await Promise.allObj(files.map(roomPath => this.readFile(path.join(rootDir, roomPath))));
      
      let debugLineData = {
        // TODO: "scriptOffset" is the number of HTML lines which appear before the first line of code
        // inside the <script> tag. Note that if the opening "<script>" tag is on its own line, it
        // counts towards the "scriptOffset".
        scriptOffset: 7, // TODO: Hardcoded for now! doctype+html+head+title+link+script+script = 7
        rooms: {}
      };
      let fullScriptContent = [];
      contents.forEach((fileContent, roomName) => {
        // Mark the beginning of what is logically, on the Above, a separate file
        fullScriptContent.push(`// ==== File: ${roomName}`);
        
        debugLineData.rooms[roomName] = {
          offsetWithinScript: fullScriptContent.length,
          // Note that rooms without offset data have uncompiled files
          offsets: this.compilationData.has(roomName) ? this.compilationData[roomName].below.offsets : null // TODO: In the future, a Hut Below us could be a HutBetween
        };
        let lines = fileContent.trim().replace(/\r/g, '').split('\n');
        fullScriptContent.push(...lines);
        
        // Separate logical files with an extra newline
        fullScriptContent.push('');
      });
      
      contents = fullScriptContent.join('\n') + '\n\n' + [
        '// ==== File: hut.js',
        `U.hutTerm = '${hutTerm}';`,
        `U.aboveMsAtResponseTime = ${this.getMs()};`,
        `U.initData = ${JSON.stringify(initContent)};`,
        `U.debugLineData = ${JSON.stringify(debugLineData)};`,
        'let { FoundationBrowser } = U.setup;',
        `U.foundation = FoundationBrowser();`,
        `U.foundation.raise({ settle: '${this.hut}.below' });`
      ].join('\n');
      
      mainScript.setProp('type', 'text/javascript');
      mainScript.setText(contents);
      
      let mainStyle = head.add(XmlElement('style', 'text'));
      mainStyle.setProp('type', 'text/css');
      mainStyle.setText([
        'html, body {',
        '  position: absolute;',
        '  left: 0; top: 0; width: 100%; height: 100%;',
        '  margin: 0; padding: 0;',
        '  background-color: #eaeaf2;',
        '  font-family: monospace;',
        '  overflow: hidden;',
        '}'
      ].join('\n'));
      
      let body = html.add(XmlElement('body', 'container'));
      
      return doc.toString();
    },
    establishHut: async function({ hut=null, bearing=null, ip=null, port=null, spoofEnabled=false }) {
      
      if (!hut) throw new Error('Missing "hut" param');
      if (!bearing) throw new Error('Missing "bearing" param');
      if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw new Error(`Invalid bearing: "${bearing}"`);
      
      // We're establishing with known params! So set them on `this`
      this.hut = hut;
      this.bearing = bearing;
      this.spoofEnabled = spoofEnabled;
      
      // Overwrite the original "buildRoom" logic such that building a
      // Room immediately executes that Room
      let origBuildRoom = U.buildRoom;
      U.buildRoom = (...args) => origBuildRoom(...args)();
      
      // Compile everything!
      this.roomsInOrder = await this.compileRecursive(this.hut);
      
      // As soon as we're compiled we can install useful cmp->src exception handlers
      process.on('uncaughtException', err => console.error(this.formatError(err)));
      process.on('unhandledRejection', err => console.error(this.formatError(err)));
      
      // Require all rooms nodejs-style
      this.roomsInOrder.forEach(roomName => require(`../room/${roomName}/${roomName}.${this.bearing}.js`));
      
      // The final Room is our Hut!
      return U.rooms[this.hut];
      
    }
  })});
  
  U.setup.gain({ FoundationNodejs });
  
})();
