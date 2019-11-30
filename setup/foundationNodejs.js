(() => {
  
  let [  path,   fs,   net,   http,   crypto,   os ] =
      [ 'path', 'fs', 'net', 'http', 'crypto', 'os' ].map(v => require(v));
  
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  //let { Load, Free, Flow, Flux } = U.life;
  
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
        container: (i, t, p, c) => `${i}<${t}${p}>${c.isEmpty() ? '' : '\n'}${c.map(c => c.toString(i + '  ')).join('')}${c.isEmpty() ? '' : i}</${t}>\n`
      })[this.type](indent, this.tagName, propStr, this.children);
    }
  })});
  let FoundationNodejs = U.inspire({ name: 'FoundationNodejs', insps: { Foundation }, methods: (insp, Insp) => ({
    $parseSoktMessages: soktState => {
      let messages = [];
      let buffer = soktState.buffer;
      while (buffer.length >= 2) {
        
        // ==== PARSE FRAME
        
        let b = buffer[0] >> 4;   // The low 4 bits of 1st byte give us flags (importantly "final")
        if (b % 8) throw new Error('Some reserved bits are on');
        let isFinalFrame = b === 8;
        
        let op = buffer[0] % 16;  // The 4 high bits of 1st byte give us the operation
        if (op < 0 || (op > 2 && op < 8) || op > 10) throw new Error(`Invalid op: ${op}`);
        
        if (op >= 8 && !isFinalFrame) throw new Error('Incomplete control frame');
        
        b = buffer[1];            // Look at second byte
        let masked = b >> 7;      // Lowest bit of 2nd byte - states whether frame is masked
        
        // Server requires a mask; Client requires no mask
        if (!masked) throw new Error('No mask');
        
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
          throw new Error('Unimplemented op: 9');
        } else if (op === 10) { // Process "pong" op
          throw new Error('Unimplemented op: 10');
        }
        
        // Validate "continuation" functionality
        if (op === 0 && soktState.curOp === null) throw new Error('Unexpected continuation frame');
        if (op !== 0 && soktState.curOp !== null) throw new Error('Truncated continuation frame');
        
        // Process "continuation" ops as if they were the op being continued
        if (op === 0) op = soktState.curOp;
        
        // Text ops are our ONLY supported ops! (TODO: For now?)
        if (op !== 1) throw new Error(`Unsupported op: ${op}`);
        
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
      
      this.cpuCnt = 0;
      this.roomsInOrder = [];
      this.compilationData = {};
      this.mountedFiles = {}; // TODO: with MANY files could save this index in its own file
      
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
      
      let contentLines = await this.readFile(path.join(roomDir, roomName, `${roomName}.js`));
      contentLines = contentLines.split('\n');
      this.compilationData[roomName] = {};
      
      for (let variantName in this.variantDefs) {
        
        let compiledFileName = path.join(roomDir, roomName, `${roomName}.${variantName}.js`);
        let { content: compiledContent, offsets } = this.compileContent(variantName, contentLines);
        await this.writeFile(compiledFileName, compiledContent, { flag: 'w', encoding: 'utf8' }); // Contents are written to disk
        
        this.compilationData[roomName][variantName] = { fileName: compiledFileName, offsets, numLines: contentLines.length }; // Filename, offsets, and length are kept
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
    writeFile: async function(name, content, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.writeFile(name, content, options, (err, c) => {
        return err ? rjc(err0.gain({ message: `Couldn't write ${name}: ${err.message}` })) : rsv(c);
      }));
    },
    readFile: async function(name, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.readFile(name, options, (err, c) => {
        return err ? rjc(err0.gain({ message: `Couldn't read ${name}: ${err.message}` })) : rsv(c);
      }));
    },
    getJsSource: async function(type, name, bearing, options) {
      if (![ 'setup', 'room' ].has(type)) throw new Error(`Invalid source type: "${type}"`);
      let fp = (type === 'setup')
        ? path.join(rootDir, 'setup', `${name}.js`)
        : path.join(rootDir, 'room', name, `${name}.${bearing}.js`);
      
      let srcContent = await this.readFile(fp, options);
      let v = (() => {
        if (type === 'room') {
          let { offsets, numLines } = this.compilationData[name][bearing];
          return [ srcContent, offsets, numLines ];
        }
        
        let offsets = [];
        let lines = srcContent.trim().replace(/\r/g, '').split('\n');
        let cur = { at: 0, offset: 0 };
        lines = lines.map((ln, ind) => {
          // Note that this isn't syntax-aware: it may incorrectly strip
          // data from multiline tag-strings, for example
          let skip = ln.match(/^ *\/\//); // Skip lines which contain only a single-line comment
          if (skip) { cur.offset++; return C.skip; } // Increment skip-count, and remove the line
          
          if (cur.offset > 0) offsets.push(cur);
          cur = { at: ind, offset: 0 };
          return ln;
        });
        
        return [ lines.join('\n'), offsets, lines.length ];
      })();
      
      let [ content, offsets, numLines ] = v;
      
      return { content, offsets, numLines };
    },
    compactIp: function(verboseIp, verbosePort) {
      // TODO: This is ipv4; could move to v6 easily by lengthening return value and padding v4 vals with 0s
      if (verboseIp === 'localhost') verboseIp = '127.0.0.1';
      let pcs = verboseIp.split(',')[0].trim().split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw new Error(`Invalid ip: "${verboseIp}"`);
      let ip = pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
      return ip + ':' + verbosePort.toString(16).padHead(4, '0'); // Max port hex value is ffff; 4 digits
    },
    getCpuConn: function(server, pool, query, decorate=null) {
      
      if (this.spoofEnabled && query.has('spoof')) {
        
        // Return the current connection for `server` for the spoofed
        // identity, or create such a connection if none exists
        let cpu = pool.getCpu(query.spoof);
        if (cpu && cpu.serverConns.has(server)) return cpu.serverConns.get(server)
        return pool.makeCpuConn(server, conn => {
          conn.cpuId = query.spoof;
          conn.isSpoofed = true;
          if (decorate) decorate(conn);
        });
        
      } else if (query.has('cpuId')) {
        
        // If the given identity exists, returns a connection for the
        // identity for `server`. Returns `null` if not recognized
        let cpu = pool.getCpu(query.cpuId);
        if (!cpu) return null;
        if (cpu.serverConns.has(server)) return cpu.serverConns.get(server);
        return pool.makeCpuConn(server, conn => {
          conn.cpuId = query.cpuId;
          if (decorate) decorate(conn);
        });
        
      } else {
        
        // Create a connection and identity for the unrecognized request
        return pool.makeCpuConn(server, decorate || (conn => {}));
        
      }
      
    },
    makeHttpServer: async function(pool, ip, port) {
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = (res, msg) => {
        
        let type = (() => {
          if (U.isType(msg, String)) return msg[0] === '<' ? 'html' : 'text';
          if (U.isType(msg, Object)) return msg.has('ISFILE') ? 'file' : 'json';
          if (U.isType(msg, Error)) return 'error';
          throw new Error(`Unknown type for ${U.nameOf(msg)}`);
        })();
        
        // TODO: This is nice content-type-dependent information!
        if (this.transportDebug) console.log(`??TELL ${'cpuId'}:`, ({
          text: () => ({ ISTEXT: true, size: msg.length, val: msg }),
          html: () => ({ ISHTML: true, size: msg.length, val: `${msg.split('\n')[0].substr(0, 30)}...` }),
          json: () => JSON.stringify(msg).length < 200 ? msg : `${JSON.stringify(msg).substr(0, 200)}...`,
          file: () => ({ ISFILE: true, ...msg.slice('name', 'type') }),
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
          file: async () => {
            res.writeHead(200, {
              'Content-Type': (msg.has('type') && msg.type) ? msg.type : 'application/octet-stream',
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
      let httpServer = http.createServer(async (req, res) => {
        
        // Stream the body
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        let body = await new Promise(r => req.on('end', () => r(chunks.join(''))));
        
        // `body` is either JSON or the empty string (TODO: For now!)
        try {
          body = body.length ? JSON.parse(body) : {};
          if (!U.isType(body, Object)) throw new Error(`Http body should be Object; got ${U.nameOf(body)}`);
        } catch(err) {
          res.writeHead(400); res.end(); return;
        }
        
        let { path: urlPath, query } = this.parseUrl(`http://${req.headers.host}${req.url}`);
        let params = { ...body, ...query }; // Params are initially based on body and query
        
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
        
        let conn = this.getCpuConn(server, pool, params.slice('spoof', 'cpuId'));
        if (!conn) { res.writeHead(302, { 'Location': '/' }); res.end(); return; }
        conn.knownHosts.add(req.connection.remoteAddress);
        
        // Remove identity-specifying params
        delete params.spoof;
        delete params.cpuId;
        
        if (params.isEmpty()) { // If params are empty at this point, look at http path
          params = (p => {
            // Map typical http requests to their meaning within Hut
            if (p === '/') return { command: 'getInit', reply: true };
            return {};
          })(urlPath);
        }
        
        // Error response for invalid params
        if (!params.has('command')) { conn.dry(); res.writeHead(400).end(); return; };
        
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
            transport: conn => conn.dry()
          },
          bankPoll: {
            transport: conn => { /* empty transport-level action */ }
          }
        };
        
        // If no ComType found, default to Hut-level command!
        let comTypes = comTypesMap.has(params.command) ? comTypesMap[params.command] : { hut: true };
        
        // Run transport-level actions
        if (comTypes.has('transport')) comTypes.transport(conn);
        
        // Synced requests end here - `conn.hear.drip` MUST occur or the
        // request will hang indefinitely
        // TODO: Consider a timeout to deal with improper usage
        if (params.reply) return conn.hear.drip([ params, msg => sendData(res, msg) ]);
        
        // Run hut-level actions
        if (comTypes.has('hut') && comTypes.hut) conn.hear.drip([ params, null ]);
        
        // We now have an unspent, generic-purpose poll available. If we
        // have tells send the oldest, otherwise keep the response.
        // Finally return all but one poll. (TODO: Can raise this if the
        // browser allows us multiple connections?)
        conn.waitTells.length ? sendData(res, conn.waitTells.shift()) : conn.waitResps.push(res);
        while (conn.waitResps.length > 1) sendData(conn.waitResps.shift(), { command: 'fizzle' });
        
      });
      await new Promise(r => httpServer.listen(port, ip, 511, r));
      
      let server = TubSet({ onceDry: () => httpServer.close() }, Nozz());
      server.desc = `HTTP @ ${ip}:${port}`;
      server.cost = 100;
      server.decorateConn = conn => {
        conn.knownHosts = Set();
        conn.waitResps = [];
        conn.waitTells = [];
        conn.hear = Nozz();
        conn.tell = msg => conn.waitResps.length
          ? sendData(conn.waitResps.shift(), msg)
          : conn.waitTells.push(msg)
        conn.drierNozz().route(() => { for (let res of conn.waitResps) res.end(); });
      };
      
      return server;
    },
    makeSoktServer: async function(pool, ip=this.ip, port=this.port + 1) {
      
      let makeSoktState = (status='initial') => ({
        status, // "initial", "upgrading", "ready", "ended"
        buffer: Buffer.alloc(0),
        curOp: null,
        curFrames: []
      });
      let soktServer = net.createServer(async sokt => {
        
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
        
        soktState.status = 'upgrading';
        
        // Now we have the headers - send upgrade response
        if (!upgradeReq.headers.has('sec-websocket-key')) throw new Error('Missing "sec-websocket-key" header');
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
        
        let { query } = this.parseUrl(`ws://${ip}:${port}${upgradeReq.path}`);
        
        let conn = this.getCpuConn(server, pool, query, conn => conn.sokt = sokt);
        if (!conn) return sokt.end();
        
        sokt.on('readable', () => {
          if (conn.isDry()) return;
          let newBuffer = sokt.read();
          if (!newBuffer || !newBuffer.length) return;
          soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
          
          try {
            let messages = Insp.parseSoktMessages(soktState);
            for (let message of messages) conn.hear.drip([ message, null ]);
          } catch(err) {
            console.log(`Socket error:\n${this.formatError(err)}`);
            soktState = makeSoktState('ended');
          }
          if (soktState.status === 'ended') conn.dry();
        });
        sokt.on('close', () => { soktState = makeSoktState('ended'); conn.dry(); });
        sokt.on('error', () => { soktState = makeSoktState('ended'); conn.dry(); });
        sokt.on('error', err => console.log(`Socket error:\n${this.formatError(err)}`));
        
      });
      await Promise(r => soktServer.listen(port, ip, r));
      
      let server = TubSet({ onceDry: () => soktServer.close() }, Nozz());
      server.desc = `SOKT @ ${ip}:${port}`;
      server.cost = 50;
      server.decorateConn = conn => {
        conn.hear = Nozz();
        conn.tell = msg => {
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
          conn.sokt.write(Buffer.concat([ metaBuff, dataBuff ]), () => {}); // Ignore the callback
        };
        conn.drierNozz().route(() => conn.sokt.end());
      };
      
      return server;
    },
    
    getPlatformName: function() { return this.ip ? `nodejs @ ${this.ip}:${this.port}` : 'nodejs'; },
    establishHut: async function({ hut=null, bearing=null, ip=null, port=null, spoofEnabled=false }) {
      
      if (!hut) throw new Error('Missing "hut" param');
      if (!bearing) throw new Error('Missing "bearing" param');
      if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw new Error(`Invalid bearing: "${bearing}"`);
      
      // We're establishing with known params! So set them on `this`
      this.ip = ip || '127.0.0.1';
      this.port = port || 80;
      this.hut = hut;
      this.bearing = bearing;
      this.spoofEnabled = spoofEnabled;
      
      // Compile everything!
      this.roomsInOrder = await this.compileRecursive(this.hut);
      if (U.isType(this.hut, Object)) this.hut = this.hut.name; 
      
      // As soon as we're compiled we can install useful cmp->src exception handlers
      process.removeAllListeners('uncaughtException');  // TODO: Bandaid for multiple instances of FoundationNodejs
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
