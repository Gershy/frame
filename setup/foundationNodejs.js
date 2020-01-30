(() => {
  
  // TODO: For `res.writeHead(...)`, consider Keep-Alive
  // e.g. 'Keep-Alive: timeout=5, max=100'
  
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let [ path, fs, crypto  ] = [ 'path', 'fs', 'crypto' ].map(v => require(v));
  
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
  let fsUpdFile = (cmps, data, opts='utf8') => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't upd file "${f}"`);
    return Promise((rsv, rjc) => fs.writeFile(f, data, opts, e => e ? rjc(err) : rsv()));
  };
  let fsGetFile = (cmps, opts='utf8') => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't get file "${f}"`);
    return Promise((rsv, rjc) => fs.readFile(f, opts, (e, v) => e ? rjc(err) : rsv(v)));
  };
  let fsGetChildren = cmps => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't get children for "${f}"`);
    return Promise((rsv, rjc) => fs.readdir(f, (e, v) => e ? rjc(err) : rsv(v)));
  };
  let fsRemFile = cmps => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't rem file "${f}"`);
    return Promise((rsv, rjc) => fs.unlink(f, e => e ? rjc(err) : rsv()));
  };
  let fsUpdDir = cmps => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't upd file "${f}"`);
    return Promise((rsv, rjc) => fs.mkdir(f, e => e ? rjc(err) : rsv()));
  };
  let fsRemDir = cmps => {
    let f = path.join(...cmps);
    let err = Error(`Couldn't rem dir "${f}"`);
    return Promise((rsv, rjc) => fs.rmdir(f, e => e ? rjc(err) : rsv()));
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
    let err = Error(`Couldn't check file "${f}"`);
    return Promise((rsv, rjc) => fs.stat(f, (e, stat) => e ? rjc(err) : rsv(stat)));
  };
  
  let { Saved } = U.setup;
  let SavedFile = U.inspire({ name: 'SavedFile', insps: { Saved }, methods: (insp, Insp) => ({
    
    // All SavedFile uses filepaths relative to the root Hut directory
    $extMap: {
      '.html': 'text/html',
      '.json': 'text/json',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg'
    },
    
    init: function(...pcs) {
      insp.Saved.init.call(this);
      this.nativeDir = path.join(rootDir, ...pcs);
      this.desc = `File ${this.type} @ ${this.nativeDir}`;
    },
    getContentType: function() {
      let ext = path.extname(this.nativeDir);
      return Insp.extMap.has(ext) ? Insp.extMap[ext] : 'application/octet-stream';
    },
    update: async function(data, opts) { return fsUpdFile([ this.nativeDir ], data, opts); },
    getPipe: function() { return fs.createReadStream(this.nativeDir); },
    getContent: async function(opts) { return fsGetFile([ this.nativeDir ], opts); },
    getNumBytes: async function() { return (await fsGetFileMetadata([ this.nativeDir ])).size; },
    onceDry: function() { fsRemFile([ this.nativeDir ]); }
  })});
  
  let { Foundation } = U.setup;
  let FoundationNodejs = U.inspire({ name: 'FoundationNodejs', insps: { Foundation }, methods: (insp, Insp) => ({
    $parseSoktMessages: soktState => {
      let messages = [];
      let buffer = soktState.buffer;
      while (buffer.length >= 2) {
        
        // ==== PARSE FRAME
        
        let b = buffer[0] >> 4;   // The low 4 bits of 1st byte give us flags (importantly "final")
        if (b % 8) throw Error('Some reserved bits are on');
        let isFinalFrame = b === 8;
        
        let op = buffer[0] % 16;  // The 4 high bits of 1st byte give us the operation
        if (op < 0 || (op > 2 && op < 8) || op > 10) throw Error(`Invalid op: ${op}`);
        
        if (op >= 8 && !isFinalFrame) throw Error('Incomplete control frame');
        
        b = buffer[1];            // Look at second byte
        let masked = b >> 7;      // Lowest bit of 2nd byte - states whether frame is masked
        
        // Server requires a mask; Client requires no mask
        if (!masked) throw Error('No mask');
        
        let length = b % 128;
        let offset = 6; // Masked frames have an extra 4 halfwords containing the mask
        
        if (buffer.length < offset + length) return []; // No messages - should await more data
        
        if (length === 126) {         // Websocket's "medium-size" frame format
          length = buffer.readUInt16BE(2);
          offset += 2;
        } else if (length === 127) {  // Websocket's "large-size" frame format
          length = buffer.readUInt32BE(2) * U.int32 + buffer.readUInt32BE(6);
          offset += 8;
        }
        
        if (buffer.length < offset + length) return []; // No messages - should await more data
        
        // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
        let mask = buffer.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
        let data = buffer.slice(offset, offset + length); // After the mask comes the data
        let w = 0;
        for (let i = 0, len = data.length; i < len; i++) {
          data[i] ^= mask[w];     // Apply XOR
          w = w < 3 ? w + 1 : 0;  // `w` follows `i`, but wraps every 4. More efficient than `%`
        }
        
        // ==== PROCESS FRAME (based on `isFinalFrame`, `op`, and `data`)
        
        // The following operations can occur regardless of socket state
        if (op === 8) {         // Process "close" op
          soktState.status = 'ended'; break;
        } else if (op === 9) {  // Process "ping" op
          throw Error('Unimplemented op: 9');
        } else if (op === 10) { // Process "pong" op
          throw Error('Unimplemented op: 10');
        }
        
        // Validate "continuation" functionality
        if (op === 0 && soktState.curOp === null) throw Error('Unexpected continuation frame');
        if (op !== 0 && soktState.curOp !== null) throw Error('Truncated continuation frame');
        
        // Process "continuation" ops as if they were the op being continued
        if (op === 0) op = soktState.curOp;
        
        // Text ops are our ONLY supported ops! (TODO: For now?)
        if (op !== 1) throw Error(`Unsupported op: ${op}`);
        
        buffer = buffer.slice(offset + length); // Dispense with the frame we've just processed
        soktState.curOp = 1;                              // Our only supported op is "text"
        soktState.curFrames.push(data);                   // Include the complete frame
        
        if (isFinalFrame) {
          let fullStr = Buffer.concat(soktState.curFrames).toString('utf8');
          messages.push(JSON.parse(fullStr));
          soktState.curOp = null;
          soktState.curFrames = [];
        }
      }
      soktState.buffer = buffer; // Set remaining buffer
      return messages;
    },
    $parseSoktUpgradeRequest: soktState => {
      
      let buffer = soktState.buffer;
      if (buffer.length < 4) return null;
      
      // TODO: Could it be more efficient to search backwards from the
      //       end of `buffer`?
      // Search for a 0x1101, 0x1010, 0x1101, 0x1010 (\r\n\r\n) sequence
      let packetEndInd = null;
      for (let i = 0, len = buffer.length - 4; i <= len; i++) {
        // TODO: We could be smart enough to jump more than 1 byte at a time in some cases
        // E.g. if the first byte doesn't match we increment by 1, but if the second
        // byte doesn't match we can increment by 2. Watch out for the repetition of the
        // same byte in the "needle" (as opposed to haystack)
        if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) { packetEndInd = i; break; }
      }
      if (packetEndInd === null) return null;
      
      let packet = buffer.slice(0, packetEndInd).toString('utf8');
      
      // Do an http upgrade operation
      let [ methodLine, ...lines ] = packet.replace(/\\r/g, '').split('\n'); // TODO: I think line-endings will always be \r\n
      let [ method, path, httpVersion ] = methodLine.split(' ').map(v => v.trim());
      
      // Parse headers
      let headers = {};
      for (let line of lines) {
        let [ head, ...tail ] = line.split(':');
        headers[head.trim().lower()] = tail.join(':').trim();
      }
      
      soktState.buffer = buffer.slice(packetEndInd + 4);
      
      return { method, path, httpVersion, headers };
      
    },
    
    init: function() {
      
      insp.Foundation.init.call(this);
      
      this.roomsInOrder = [];
      this.compilationData = {};
      
      this.variantDefs = {
        above: { above: 1, below: 0 },
        below: { above: 0, below: 1 }
      };
      
      this.transportDebug = false;
      this.httpFullDebug = false;
      this.spoofEnabled = false;
      
      this.usage0 = process.memoryUsage().map(v => v);
      
      this.canSettlePrm = (async () => {
        
        await Promise.allArr([
          // TODO: Ideally temp dirs should be purged when Hut *dries*
          fsRemTree([ tempDir, 'storage' ]),
          fsRemTree([ tempDir, 'room' ]),
          
          (async () => {
            try { await fsUpdDir([ tempDir ]); } catch(err) {}
            try { await fsUpdDir([ tempDir, 'habit'   ]); } catch(err) {}
            try { await fsUpdDir([ tempDir, 'room'    ]); } catch(err) {}
            try { await fsUpdDir([ tempDir, 'storage' ]); } catch(err) {}
            try { await fsUpdDir([ tempDir, 'cert'    ]); } catch(err) {}
          })()
        ]);
        
      })();
      
      this.terms = null;
      this.getSaved([ 'setup', 'terms.json' ]).getContent().then(terms => this.terms = JSON.parse(terms));
      
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
          
          if (!habitName) throw Error('Need to provide name for habit');
          
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
          
          if (!habitName) throw Error('Need to provide name for habit');
          
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
          
          if (!habitName) throw Error('Need to provide name for habit');
          
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
          console.log('Author: Gershom Maes');
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
    parseDependencies: async function(roomName) {
      
      // Determine the inner rooms of `roomName` by parsing the file for the "innerRooms" property
      // TODO: Could potentially spoof U.buildRoom, and then require and
      // uncache the room file. It will call U.buildRoom with the
      // anticipated room names...
      
      let roomFileContents = await fsGetFile([ roomDir, roomName, `${roomName}.js` ]);
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
      
      if (U.isType(roomName, Object)) {
        let virtualRoom = roomName;
        compiledPrms[virtualRoom.name] = Promise.resolve();
        let depNames = virtualRoom.innerRooms;
        await Promise.allArr(depNames.map(dn => this.compileRecursive(dn, compiledPrms, precedence)));
        return precedence.gain([ virtualRoom ]);
      }
      
      if (compiledPrms.has(roomName)) return compiledPrms[roomName];
      
      let rsv = null, rjc = null, prm = Promise((rsv0, rjc0) => { rsv = rsv0; rjc = rjc0; });
      compiledPrms[roomName] = prm;
      
      // Get dependency room names
      let depNames = await this.parseDependencies(roomName);
      
      // Don't continue until all dependencies are compiled! Even if we
      // know that our dependencies are already under compilation, we
      // need to wait for them to finish. This will ensure that rooms
      // compile in order of dependency-precedence.
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
      
      let contentLines = (await fsGetFile([ roomDir, roomName, `${roomName}.js` ])).split('\n');
      this.compilationData[roomName] = {};
      
      for (let variantName in this.variantDefs) {
        
        let compiledFilePcs = [ roomDir, roomName, `${roomName}.${variantName}.js` ];
        let { lines: cmpLines, offsets } = this.compileContent(variantName, contentLines);
        await fsUpdFile(compiledFilePcs, cmpLines.join('\n'));
        
        this.compilationData[roomName][variantName] = {
          fileName: path.join(...compiledFilePcs),
          srcNumLines: contentLines.length,
          cmpNumLines: cmpLines.length,
          offsets
        }; // Filename, offsets, and length are kept
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
      
      if (curBlock) throw Error(`Final ${curBlock.type} block is unbalanced`);
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
      
      return { lines: filteredLines, offsets };
    },
    mapLineToSource: function(fileName, lineInd) {
      // For a compiled file and line number, return the corresponding line number
      // in the source
      
      fileName = path.basename(fileName);
      let fileNameData = fileName.match(/^([^.]+)\.([^.]+)\.js/);
      if (!fileNameData) return null;
      
      let [ roomName, variant ] = fileNameData.slice(1);
      if (!this.compilationData.has(roomName)) throw Error(`Missing room ${roomName}`);
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
        ...(lines.length ? lines : [ `Showing unformatted "${type}":`, ...trace.split('\n').map(ln => `? ${ln.trim()}`) ]).map(ln => `||  ${ln}`)
      ].join('\n');
      
    },
    getOrderedRoomNames: function() { return this.roomsInOrder; },
    
    // Platform
    queueTask: setImmediate,
    getMemUsage: function() {
      let usage1 = process.memoryUsage();
      return {
        rss: usage1.rss - this.usage0.rss,
        heapTotal: usage1.heapTotal,
        heapUsed: usage1.heapUsed - this.usage0.heapUsed
      };
    },
    getSaved: function(locator) {
      
      // Returns a Saved based on a Locator
      
      // TODO: This assumes the saved item is on the filesystem...
      // Could verify that `locator` is an Array of Strings...
      return SavedFile(...locator);
    },
    getSavedFromData: async function(locator, data) {
      
      // Saves some Data, and returns the resulting Saved
      
      let savedFile = SavedFile('mill', 'storage', ...locator); // Write to temporary location
      await savedFile.update(data);
      return savedFile;
    },
    getRootReal: async function() { return null; }, // TODO: Maybe electron someday!
    getStaticIps: function(pref=[]) {
      return require('os').networkInterfaces()
        .toArr((v, type) => v.map(vv => ({ type, ...vv.slice('address', 'family', 'internal') })))
        .to(arr => Array.combine(...arr))
        .map(v => v.family.hasHead('IPv') && v.address !== '127.0.0.1' ? v.slice('type', 'address', 'family') : C.skip);
    },
    getJsSource: async function(type, name, bearing, options) {
      if (![ 'setup', 'room' ].has(type)) throw Error(`Invalid source type: "${type}"`);
      let fp = (type === 'setup')
        ? [ rootDir, 'setup', `${name}.js` ]
        : [ rootDir, 'room', name, `${name}.${bearing}.js` ];
      
      let srcContent = await fsGetFile(fp, options);
      if (type === 'room') return { content: srcContent, ...this.compilationData[name][bearing] };
      
      let offsets = [];
      let srcLines = srcContent.replace(/\r/g, '').split('\n');
      let cmpLines = [];
      let cur = { at: 0, offset: 0 };
      
      for (let ind = 0; ind < srcLines.length; ind++) {
        let srcLine = srcLines[ind].trim();
        if (!srcLine || srcLine.hasHead('//')) { cur.offset++; continue; } // Skip empty and comment-only lines
        if (cur.offset > 0) offsets.push(cur);
        cur = { at: ind, offset: 0 };
        cmpLines.push(srcLine);
      }
      
      return {
        content: cmpLines.join('\n'),
        srcNumLines: srcLines.length,
        cmpNumLines: cmpLines.length,
        offsets
      };
    },
    compactIp: function(verboseIp, verbosePort) {
      // TODO: This is ipv4; could move to v6 easily by lengthening return value and padding v4 vals with 0s
      if (verboseIp === 'localhost') verboseIp = '127.0.0.1';
      let pcs = verboseIp.split(',')[0].trim().split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw Error(`Invalid ip: "${verboseIp}"`);
      let ip = pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
      return ip + ':' + verbosePort.toString(16).padHead(4, '0'); // Max port hex value is ffff; 4 digits
    },
    getHutRoadForQuery: function(server, parHut, query, decorate=null) {
      
      // TODO: Right now a Road can be spoofed - this should be a
      // property of the Hut, shouldn't it?
      
      if (this.spoofEnabled && query.has('spoof')) {
        
        // Return the current connection for `server` for the spoofed
        // identity, or create such a connection if none exists
        let roadedHut = parHut.getRoadedHut(query.spoof);
        if (roadedHut && roadedHut.serverRoads.has(server)) return roadedHut.serverRoads.get(server);
        return parHut.processNewRoad(server, road => {
          road.hutId = query.spoof;
          road.isSpoofed = true;
          if (decorate) decorate(road);
        });
        
      } else if (query.has('hutId')) {
        
        let roadedHut = parHut.getRoadedHut(query.hutId);
        if (!roadedHut) return null;
        
        if (roadedHut.serverRoads.has(server)) return roadedHut.serverRoads.get(server);
        return parHut.processNewRoad(server, road => {
          road.hutId = query.hutId;
          if (decorate) decorate(road);
        });
        
      } else {
        
        return parHut.processNewRoad(server, decorate || (road => {}));
        
      }
      
    },
    getTerm: function() {
      if (!this.terms) throw Error('Terms list not yet ready');
      if (!this.terms.length) throw Error('All terms exhausted X_X');
      let ind = Math.floor(Math.random() * this.terms.length);
      let term = this.terms[ind];
      this.terms = [ ...this.terms.slice(0, ind), ...this.terms.slice(ind + 1) ];
      console.log(term, this.terms.length, this.terms.includes(term));
      
      let d = Drop(null, () => this.terms.push(term))
      d.value = term;
      return d;
    },
    makeHttpServer: async function(pool, { host, port, keyPair=null, selfSign=null }) {
      
      if (!port) port = keyPair ? 443 : 80;
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = (res, msg) => {
        
        // json, html, text, savd, error
        let type = (() => {
          if (msg === null || U.isTypes(msg, Object, Array)) return 'json';
          if (U.isType(msg, String)) return msg.hasHead('<!DOCTYPE') ? 'html' : 'text';
          if (U.isInspiredBy(msg, Saved)) return 'savd';
          if (U.isType(msg, Error)) return 'error';
          throw Error(`Unknown type for ${U.nameOf(msg)}`);
        })();
        
        // TODO: This displays nice content-type-dependent information!
        if (this.transportDebug) console.log(`??TELL ${'hutId'}:`, ({
          text: () => ({ ISTEXT: true, size: msg.length, val: msg }),
          html: () => ({ ISHTML: true, size: msg.length, val: `${msg.split('\n')[0].substr(0, 30)}...` }),
          json: () => JSON.stringify(msg).length < 200 ? msg : `${JSON.stringify(msg).substr(0, 200)}...`,
          savd: () => ({ ISSAVD: true, desc: msg.desc || null }),
          error: () => ({ ISERROR: true, msg: msg.error })
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
          savd: async () => {
            res.writeHead(200, {
              'Content-Type': msg.getContentType() || 'application/octet-stream',
              'Content-Length': await msg.getNumBytes()
            });
            msg.getPipe().pipe(res);
          },
          error: () => {
            let text = msg.message;
            res.writeHead(400, {
              'Content-Type': 'text/plain',
              'Content-Length': Buffer.byteLength(text)
            });
            res.end(text);
          }
        })[type]();
        
      };
      let serverFn = async (req, res) => {
        
        // Stream the body
        // TODO: Watch for exploits; slow loris, etc.
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        let body = await new Promise(r => req.on('end', () => r(chunks.join(''))));
        
        // `body` is either JSON or the empty string (TODO: For now!)
        try {
          body = body.length ? JSON.parse(body) : {};
          if (!U.isType(body, Object)) throw Error(`Http body should be Object; got ${U.nameOf(body)}`);
        } catch(err) { return res.writeHead(400).end(); }
        
        let { path: urlPath, query } = this.parseUrl(`http://${req.headers.host}${req.url}`);
        let params = { ...body, ...query }; // Params are initially based on body and query
        
        if (this.httpFullDebug) console.log('\n\n' + [
          '==== INCOMING REQUEST ====',
          `IP: ${req.connection.remoteAddress}`,
          `METHOD: ${req.method}`,
          `REQURL: ${req.url}`,
          `REQQRY: ${JSON.stringify(query, null, 2)}`,
          `REQHDS: ${JSON.stringify(req.headers, null, 2)}`,
          `BODY: ${JSON.stringify(body, null, 2)}`
        ].join('\n'));
        
        // Get identity-specifying props; remove them from the params.
        // Past this point identity is based on the connection and cpu;
        // best practice to remove identity info from params
        let iden = params.splice('spoof', 'hutId');
        
        // If params are empty at this point, look at http path
        if (params.isEmpty()) params = (p => {
          // Map typical http requests to their meaning within Hut
          if (p === '/') return { command: 'getInit', reply: true };
          if (p === '/favicon.ico') return { command: 'getIcon', reply: true };
          return {};
        })(urlPath);
        
        // Error response for invalid params
        if (!params.has('command')) return res.writeHead(400).end();
        
        // Get the Road used. An absence of any such Road indicates that
        // authentication failed - in this case redirect the user to a
        // spot where they can request a new identity
        let road = this.getHutRoadForQuery(server, pool, iden);
        if (!road) return res.writeHead(302, { 'Location': '/' }).end();
        
        // Confirm that we've seen this Hut under this host
        road.knownHosts.add(req.connection.remoteAddress);
        
        // Determine the actions that need to happen at various levels for this command
        let comTypesMap = {
          // getInit has effects at both transport- and hut-level
          getInit:  {
            transport: road => {
              road.waitResps.forEach(res => res.end());
              road.waitResps = [];
              road.waitTells = [];
            },
            hut: true
          },
          close: { transport: road => road.dry() },
          bankPoll: { transport: road => { /* empty transport-level action */ } }
        };
        
        // If no ComType found, default to Hut-level command!
        let comTypes = comTypesMap.has(params.command) ? comTypesMap[params.command] : { hut: true };
        
        // Run transport-level actions
        if (comTypes.has('transport')) comTypes.transport(road);
        
        // TODO: Ideally there should be NO SUCH THING AS `reply` - the
        // implementation should always use `hut.tell`, and the server
        // figures out which http response should get used... could be
        // tricky to figure out which response an instance of `hut.tell`
        // should correspond to tho. Imagine the following:
        // 1. { command: 'login', reply: false } is received
        // 2. { command: 'getRealDomFavicon', reply: true } is received
        // 3. The `hut.tell` for #1 occurs - how to avoid the server
        //    thinking that *this* is the response for { reply: true }??
        
        // TODO: Maybe there should be no such thing as `hut.tell`?? Or
        // at least it should be inaccessible in situations where
        
        // Synced requests end here - `road.tell` MUST occur or the
        // request will hang indefinitely
        // TODO: Consider a timeout to deal with improper usage
        if (params.reply) return road.hear.drip([ params, msg => sendData(res, msg) ]);
        
        // Run hut-level actions
        if (comTypes.has('hut') && comTypes.hut) road.hear.drip([ params, null ]);
        
        // We now have an unspent, generic-purpose poll available. If we
        // have tells then send the oldest, otherwise hold the response.
        // Finally return all but one poll. (TODO: Can raise this if the
        // browser allows us multiple connections?)
        if (road.waitTells.isEmpty()) {
          road.waitResps.push(res);
        } else {
          // Bundle as many waiting responses as possible into a "multi"
          // command
          // TODO: This waits for `road.waitTells[<index too big>]` to
          // return undefined, and fail to compare to Object|Array. Is
          // this ugly?
          
          // TODO: Do the json responses need to be contiguous? E.g. if
          // current Tell queue is "json", "json", "html", "json", could
          // we send all the json responses?
          // What if "html" comes first? Could we delay it and send the
          // 3 json responses first?
          // TODO: What makes json special, in that it is bundle-able?
          // What if the primary protocol switches to binary?
          let bundleSize = 0;
          while (U.isTypes(road.waitTells[bundleSize], Object, Array)) bundleSize++; // TODO: This isn't working - waitTells[ind] is always a STRING!! :(
          
          if (bundleSize <= 1) {
            
            // Either a leading contiguous string of 1 json Tell, or the
            // 1st Tell is non-json.
            // Send the single, unbundled Tell
            sendData(res, road.waitTells.shift());
            
          } else {
            
            console.log('Bundled', bundleSize, 'tells:', road.waitTells.slice(0, bundleSize));
            
            // Send `bundleSize` bundled json Tells!
            sendData(res, {
              type: 'multi',
              list: road.waitTells.slice(0, bundleSize)
            });
            road.waitTells = road.waitTells.slice(bundleSize);
            
          }
          
        }
        
        // Bank only a single response (otherwise most clients hang)
        while (road.waitResps.length > 1) sendData(road.waitResps.shift(), { command: 'fizzle' });
        
      };
      
      let httpServer = !keyPair
        ? require('http').createServer(serverFn)
        : require('https').createServer({
            ...keyPair.slice('key', 'cert'),
            ...(selfSign ? { ca: [ selfSign ] } : {}),
            requestCert: false,
            rejectUnauthorized: false
          }, serverFn);
      
      await new Promise(r => httpServer.listen(port, host, 511, r));
      
      let server = TubSet({ onceDry: () => httpServer.close() }, Nozz());
      server.desc = `HTTP @ ${host}:${port}`;
      server.cost = 100;
      server.decorateRoad = road => {
        road.knownHosts = Set();
        road.waitResps = [];
        road.waitTells = [];
        road.hear = Nozz();
        road.tell = msg => road.waitResps.length
          ? sendData(road.waitResps.shift(), msg)
          : road.waitTells.push(msg)
        road.drierNozz().route(() => { for (let res of road.waitResps) res.end(); });
        road.currentCost = () => 1.0;
      };
      
      return server;
    },
    makeSoktServer: async function(pool, { host, port, keyPair=null, selfSign=null }) {
      if (!port) port = keyPair ? 444 : 81;
      
      let makeSoktState = (status='initial') => ({
        status, // "initial", "upgrading", "ready", "ended"
        buffer: Buffer.alloc(0),
        curOp: null,
        curFrames: []
      });
      let serverFn = async sokt => {
        
        let soktState = makeSoktState();
        
        // Wait to get websocket request - it contains only headers
        let upgradeReq = null;
        while (true) { // TODO: Limit iterations? Timeouts? Max size of `buffer`?
          upgradeReq = await Promise(r => sokt.once('readable', () => {
            let newBuffer = sokt.read();
            if (!newBuffer || !newBuffer.length) return r(null);
            soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
            r(Insp.parseSoktUpgradeRequest(soktState));
          }));
          if (upgradeReq) break;
        }
        
        if (!upgradeReq.headers.has('sec-websocket-key')) return sokt.end();
        
        // Now we have the headers - send upgrade response
        soktState.status = 'upgrading';
        let hash = crypto.createHash('sha1');
        hash.end(`${upgradeReq.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
        
        await new Promise(r => sokt.write([
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${hash.read().toString('base64')}`,
          '\r\n'
        ].join('\r\n'), r));
        
        soktState.status = 'ready';
        
        let { query } = this.parseUrl(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${upgradeReq.path}`);
        
        let road = this.getHutRoadForQuery(server, pool, query, road => road.sokt = sokt);
        if (!road) return sokt.end();
        
        sokt.on('readable', () => {
          if (road.isDry()) return;
          let newBuffer = sokt.read();
          
          if (!newBuffer || !newBuffer.length) return;
          soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
          
          try {
            for (let message of Insp.parseSoktMessages(soktState)) road.hear.drip([ message, null ]);
          } catch(err) { sokt.emit('error', err); }
          
          if (soktState.status === 'ended') road.dry();
        });
        sokt.on('close', () => { soktState = makeSoktState('ended'); road.dry(); });
        sokt.on('error', () => { soktState = makeSoktState('ended'); road.dry(); });
        sokt.on('error', err => console.log(`Socket error:\n${this.formatError(err)}`));
        
      };
      
      let soktServer = !keyPair
        ? require('net').createServer(serverFn)
        : require('tls').createServer({
            ...keyPair.slice('key', 'cert'),
            ...(selfSign ? { ca: [ selfSign ] } : {}),
            requestCert: false,
            rejectUnauthorized: false
          }, serverFn);
      
      await Promise(r => soktServer.listen(port, host, r));
      
      let server = TubSet({ onceDry: () => soktServer.close() }, Nozz());
      server.desc = `SOKT @ ${host}:${port}`;
      server.cost = 50;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => {
          let dataBuff = Buffer.from(JSON.stringify(msg), 'utf8');
          let len = dataBuff.length;
          let metaBuff = null;
          
          // The 2nd byte (`metaBuff[1]`) is either 127 to specify
          // "large", 126 to specify "medium", or n < 126, where
          // `n` is the exact length of `dataBuff`.
          if (len < 126) {            // small-size
            
            metaBuff = Buffer.alloc(2);
            metaBuff[1] = len;
            
          } else if (len < 65536) {   // medium-size
            
            metaBuff = Buffer.alloc(2 + 2);
            metaBuff[1] = 126;
            metaBuff.writeUInt16BE(len, 2);
            
          } else {                    // large-size
            
            // TODO: large-size packet could use more testing
            metaBuff = Buffer.alloc(2 + 8);
            metaBuff[1] = 127;
            metaBuff.writeUInt32BE(Math.floor(len / U.int32), 2); // Lo end of `len` from metaBuff[2-5]
            metaBuff.writeUInt32BE(len % U.int32, 6);             // Hi end of `len` from metaBuff[6-9]
            
          }
          
          metaBuff[0] = 129; // 128 + 1; `128` pads for modding by 128; `1` is the "text" op
          road.sokt.write(Buffer.concat([ metaBuff, dataBuff ]), () => {}); // Ignore the callback
        };
        road.drierNozz().route(() => road.sokt.end());
        road.currentCost = () => 0.5;
      };
      
      return server;
    },
    
    getPlatformName: function() { return 'nodejs'; },
    establishHut: async function(raiseArgs) {
      
      let { hut=null, bearing=null } = raiseArgs;
      
      await this.canSettlePrm;
      
      if (!hut) throw Error('Missing "hut" param');
      if (!bearing) throw Error('Missing "bearing" param');
      if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw Error(`Invalid bearing: "${bearing}"`);
      
      // We're establishing with known params! So set them on `this`
      this.hut = U.isType(hut, Object) ? hut.name : hut;
      this.bearing = bearing;
      this.spoofEnabled = raiseArgs.mode === 'test';
      
      // Compile everything!
      this.roomsInOrder = await this.compileRecursive(hut);
      
      // As soon as we're compiled we can install useful cmp->src exception handlers
      process.removeAllListeners('uncaughtException');  // TODO: Bad bandaid for multiple instances of FoundationNodejs
      process.removeAllListeners('unhandledRejection');
      process.on('uncaughtException', err => console.error(this.formatError(err)));
      process.on('unhandledRejection', err => console.error(this.formatError(err)));
      
      // Require all rooms nodejs-style
      this.roomsInOrder.forEach(room => {
        if (U.isType(room, String)) {
          // Install and run the room-building-function
          require(`../room/${room}/${room}.${this.bearing}.js`);
          U.rooms[room](this);
        } else {
          U.rooms[room.name] = {
            name: room.name,
            built: room.build(this, ...U.rooms.slice(...room.innerRooms).toArr(v => v.built))
          };
        }
      });
      
      // At this stage it's safe to filter out virtual rooms
      this.roomsInOrder = this.roomsInOrder.map(n => U.isType(n, String) ? n : C.skip);
      
      // The final Room is our Hut!
      return U.rooms[this.hut];
      
    }
  })});
  
  U.setup.gain({ FoundationNodejs });
  
})();
