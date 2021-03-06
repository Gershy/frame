(() => {
  
  // TODO: For `res.writeHead(...)`, consider Keep-Alive
  // e.g. 'Keep-Alive: timeout=5, max=100'
  
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let path = require('path');
  let { Foundation, Keep } = U.setup;
  
  let FoundationNodejs = U.inspire({ name: 'FoundationNodejs', insps: { Foundation }, methods: (insp, Insp) => ({
    
    $KeepNodejs: U.inspire({ name: 'KeepNodejs', insps: { Keep }, methods: insp => ({
      init: function() {
        insp.Keep.init.call(this);
        this.keepsByType = {
          fileSystem: Insp.KeepFileSystem(),
          urlResource: Insp.KeepUrlResources()
        };
      },
      innerKeep: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepFileSystem: U.inspire({ name: 'KeepFileSystem', insps: { Keep }, methods: (insp, Insp) => ({
      
      $fs: ((path, fs) => ({
        
        // "folder" = "directory"; "letter" = "file"
        
        hutRootCmps: __dirname.split(path.sep).slice(0, -1),
        cmpsToFileUrl: cmps => path.join(...cmps),
        getMeta: cmps => Promise(rsv => fs.stat(path.join(...cmps), (e, m) => rsv(e ? null : m))),
        getFolder: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.readdir(path.join(...cmps), ...opts, (err0, children) => {
            if (err0) rjc(err.update(err0.message));
            else      rsv(children);
          }));
        },
        addFolder: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.mkdir(path.join(...cmps), ...opts, err0 => {
            // Ignore EEXIST - it means the folder is already created!
            if (err0 && err0.code !== 'EEXIST') rjc(err.update(err0.message));
            else      rsv(null);
          }));
        },
        remFolder: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.rmdir(path.join(...cmps), ...opts, err0 => {
            // Ignore ENOENT - it means the folder is already deleted!
            if (err0 && err0.code !== 'ENOENT') rjc(err.update(err0.message));
            else      rsv(null);
          }));
        },
        getLetter: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.readFile(path.join(...cmps), ...opts, (err0, content) => {
            if (err0) rjc(err.update(err0.message));
            else      rsv(content)
          }));
        },
        setLetter: async (cmps, content, ...opts) => { // "set" is "'add' if nonexistent, otherwise 'upd'"
          let err = Error('');
          return Promise((rsv, rjc) => fs.writeFile(path.join(...cmps), content, ...opts, err0 => {
            if (err0) rjc(err.update(err0.message));
            else      rsv(null)
          }));
        },
        remLetter: async(cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.unlink(path.join(...cmps), ...opts, err0 => {
            if (err0) rjc(err.update(err0.message));
            else      rsv(null)
          }));
        },
        getPipe: (cmps, ...opts) => fs.createReadStream(path.join(...cmps), ...opts),
        
      }))(require('path'), require('fs')),
      $extensionContentTypeMap: {
        html: 'text/html',
        json: 'text/json',
        css: 'text/css',
        txt: 'text/plain',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg'
      },
      
      init: function(absPath=Insp.fs.hutRootCmps) {
        if (absPath.find(v => !U.isType(v, String))) throw Error(`Invalid absPath for ${U.nameOf(this)}`);
        this.absPath = absPath;
      },
      desc: function() { return `${U.nameOf(this)}@[${this.absPath.join(', ')}]`; },
      getFileUrl: function() { return Insp.fs.cmpsToFileUrl(this.absPath); },
      innerKeep: function(dirNames) {
        if (U.isType(dirNames, String)) dirNames = [ dirNames ];
        let KeepCls = this.constructor;
        return KeepCls([ ...this.absPath, ...dirNames ]);
      },
      checkType: async function() {
        let meta = await Insp.fs.getMeta(this.absPath);
        if (!meta) return null;
        if (meta.isDirectory()) return 'folder';
        if (meta.isFile()) return 'letter';
        throw Error(`${this.desc()} is non-folder, non-letter`);
      },
      getContent: async function(...opts) {
        let type = await this.checkType();
        if (!type) return null;
        return Insp.fs[type === 'folder' ? 'getFolder' : 'getLetter'](this.absPath, ...opts);
      },
      setContent: async function(content, ...opts) {
        let type = await this.checkType();
        
        if (content !== null) { // Insert new content
          
          if (type === 'folder') throw Error(`${this.desc()} is type "folder"; can't set non-null content`);
          
          // Create all ancestor dirs
          for (let depth = 1; depth < this.absPath.length; depth++) {
            let cmps = this.absPath.slice(0, depth);
            let meta = await Insp.fs.getMeta(cmps);
            
            // If this ancestor is non-existent, create it
            // If this ancestor exists but isn't a directory, throw error
            if (!meta) await Insp.fs.addFolder(cmps);
            else if (!meta.isDirectory()) throw Error(`${this.desc()} has an invalid path; can't set content`);
          }
          
          // Write content into file
          await Insp.fs.setLetter(this.absPath, content, ...opts);
          
        } else if (content === null && type === 'folder') {
          
          let items = await this.getContent();
          
          if (items) {
            
            // Set content of all items to `null`
            await Promise.allArr(items.map(item => this.innerKeep(item).setContent(null)));
            
          } else {
            
            // Without a single child
            await Insp.fs.remFolder(this.absPath);
            await this.remNullAncestry();
            
          }
          
        } else if (content === null && type === 'letter') {
          
          await Insp.fs.remLetter(this.absPath);
          await this.remNullAncestry();
          
        }
        
      },
      remNullAncestry: async function() {
        
        // Starting with our immediate parent folder, continuously
        // deletes each empty ancestor folder encountered. Stops as soon
        // as any ancestor folder is non-empty.
        
        for (let depth = this.absPath.length - 1; depth > 1; depth--) {
          
          let cmps = this.absPath.slice(0, depth);
          let children = await Insp.fs.getFolder(cmps);
          
          if (children === null) continue; // If `children` is `null` the ancestor is already deleted
          if (children.length) break; // An ancestor is populated - stop deleting!
          
          await Insp.fs.remFolder(cmps); // This ancestor is empty - delete it!
          
        }
        
      },
      getContentType: function() {
        let lastCmp = this.absPath[this.absPath.length - 1];
        let [ pcs, ext=null ] = lastCmp.split('.');
        return Insp.extensionContentTypeMap.has(ext)
          ? Insp.extensionContentTypeMap[ext]
          : 'application/octet-stream'
      },
      getContentByteLength: async function() {
        let meta = await Insp.fs.getMeta(this.absPath);
        return meta ? meta.size : 0;
      },
      getPipe: function() { return Insp.fs.getPipe(this.absPath); }
      
    })}),
    $KeepUrlResources: U.inspire({ name: 'KeepUrlResources', insps: { Keep }, methods: insp => ({
      init: function() {},
      innerKeep: function({ path, urlParams }) { return Insp.KeepUrlResource(this, path, urlParams); }
    })}),
    $KeepUrlResource: U.inspire({ name: 'KeepUrlResource', insps: { Keep }, methods: insp => ({
      init: function(path='', params={}) {
        insp.Keep.init.call(this);
        this.path = path;
        this.params = params;
      },
      getUrl: function() {
        let url = `/${this.path}`;
        if (!this.params.isEmpty()) url += `?${this.params.toArr((v, k) => `${k}=${v}`).join('&')}`;
        return url;
      }
    })}),
    
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
    
    init: function(...args) {
      
      insp.Foundation.init.call(this, ...args);
      
      this.rootKeep = Insp.KeepNodejs();
      this.fsKeep = this.rootKeep.innerKeep('fileSystem');
      
      this.roomsInOrder = [];
      this.compilationData = {};
      
      this.variantDefs = {
        above: { above: 1, below: 0 },
        below: { above: 0, below: 1 }
      };
      
      this.transportDebug = false;
      this.httpFullDebug = false;
      
      this.usage0 = process.memoryUsage().map(v => v);
      
      this.canSettlePrm = (async () => {
        await Promise.allArr([
          this.fsKeep.to([ 'mill', 'storage' ]).setContent(null),
          this.fsKeep.to([ 'mill', 'room' ]).setContent(null)
        ]);
      })();
      
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
          
          // TODO: Would be cool when DB is implemented to abstractly
          // save habits into DB instead of fileSystem
          
          let habitNames = await this.fsKeep.to([ 'mill', 'habit' ]).getContent();
          if (habitNames.length) {
            console.log('Available habits:');
            habitNames.sort().forEach(f => console.log(`  - ${f.crop(0, 5)}`)); // 5 is length of ".json"
          } else {
            console.log('-- No habits available --');
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
          
          let habitJson = JSON.stringify(({ ...args }).gain({ habit: C.skip }), null, 2);
          await this.fsKeep.to([ 'mill', 'habit', `${habitName}.json` ]).setContent(habitJson);
          console.log(`Saved habit "${habitName}"; args:`, habitJson);
          
        }
      }));
      
      habitGoal.children.add(Goal({
        name: 'rem',
        desc: 'Remove an existing habit',
        detect: args => U.isType(args.habit, Object) && args.habit.has('rem'),
        enact: async (foundation, args) => {
          
          let habitName = args.habit.rem.split('.');
          
          if (!habitName) throw Error('Need to provide name for habit');
          
          await this.fsKeep.to([ 'mill', 'habit', `${habitName}.json` ]).setContent(null);
          console.log(`Removed habit "${habitName}"`);
          
        }
      }));
      
      habitGoal.children.add(Goal({
        name: 'use',
        desc: 'Repeat an existing habit',
        detect: args => U.isType(args.habit, Object) && args.habit.has('use'),
        enact: async (foundation, args) => {
          
          let habitName = args.habit.use.split('.');
          if (!habitName) throw Error('Need to provide name for habit');
          
          // TODO: This won't work, now that `raiseArgs` are given to
          // the constructor, not the `raise` function...
          let data = JSON.parse(await this.fsKeep.to([ 'mill', 'habit', `${habitName}.json` ]).getContent());
          await foundation.raise(({ ...data, ...args }).gain({ habit: C.skip }));
          
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
      
      let roomFileContents = await this.fsKeep.to([ 'room', roomName, `${roomName}.js` ]).getContent('utf8');
      let depStr = U.safe(
        () => roomFileContents.match(/[^\w]innerRooms:\s*\[([^\]]*)\]/)[1].trim(),
        () => { throw Error(`Couldn't parse dependencies for room "${roomName}"`); }
      );
      
      return depStr
        ? depStr.split(',').map(v => v.trim()).map(v => v.substr(1, v.length - 2))
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
      
      let content = await this.getKeep('fileSystem', [ 'room', roomName, `${roomName}.js` ]).getContent('utf8');
      let contentLines = content.split('\n');
      this.compilationData[roomName] = {};
      
      for (let variantName in this.variantDefs) {
        
        let compiledFilePcs = [ 'room', roomName, `${roomName}.${variantName}.js` ];
        let { lines: cmpLines, offsets } = this.compileContent(variantName, contentLines);
        
        await this.getKeep('fileSystem', compiledFilePcs).setContent(cmpLines.join('\n'));
        
        this.compilationData[roomName][variantName] = {
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
      
      let rootFileUrl = this.fsKeep.getFileUrl()
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
      let trace = stack.substr(traceBegins);
      
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
          
          fileName = Insp.KeepFileSystem.fs.cmpsToFileUrl([ fileName ]);
          if (!fileName.hasHead(rootFileUrl)) return C.skip; // Skip non-hut files
          
          let mappedLineData = this.mapLineToSource(fileName, parseInt(lineInd, 10));
          
          if (mappedLineData) {
            fileName = `room/${mappedLineData.roomName}/${mappedLineData.roomName}.src`;
            lineInd = mappedLineData.srcLineInd;
          } else {
            fileName = fileName.substr(rootFileUrl.length + 1).split(/[^a-zA-Z0-9.]/).join('/');
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
    
    // High level
    getRootKeep: function() { return this.rootKeep; },
    getRootHut: async function(options={}) {
      
      // TODO: Think about what is happening with `hutInstance.uid` -
      // For Above the uid is hard-coded and basically arbitrary. For
      // Below the uid is an unguessable, private base62 string.
      // There are two different ways to add the AboveHut as a MemberRec
      // of some arbitrary Rec:
      // 1) Above-only: 
      
      if (options.has('uid')) throw Error(`Don't specify "uid"!`);
      
      if (!options.has('hosting')) options.hosting = {};
      if (options.hosting.has('host')) throw Error(`Don't specify "hosting.host"!`);
      if (options.hosting.has('port')) throw Error(`Don't specify "hosting.port"!`);
      if (options.hosting.has('sslArgs')) throw Error(`Don't specify "hosting.sslArgs"!`);
      
      let [ host, port ] = this.origArgs.has('hosting')
        ? this.origArgs.hosting.split(':')
        : [ 'localhost', '80' ];
      
      let sslArgs = { keyPair: null, selfSign: null };
      if (this.origArgs.has('ssl') && !!this.origArgs.ssl) {
        let certFolder = this.getKeep('fileSystem', [ 'mill', 'cert' ]);
        let { cert, key, selfSign } = await Promise.allObj({
          cert:     certFolder.to('server.cert').getContent(),
          key:      certFolder.to('server.key').getContent(),
          selfSign: certFolder.to('localhost.cert').getContent()
        });
        sslArgs = { keyPair: { cert, key }, selfSign };
      }
      
      options.uid = 'nodejs.root';
      options.hosting.gain({ host, port: parseInt(port, 10), sslArgs });
      
      return insp.Foundation.getRootHut.call(this, options);
      
    },
    getRootReal: async function() {
      
      // There is only a single RootReal for an instance of node,
      // reflecting the deepest abstraction for visuals.
      
      if (!this.rootReal) {
        
        let rootReal = this.rootReal = U.rooms.real.built.Real(null, 'nodejs.root');
        rootReal.defineReal('nodejs.ascii', { slotters: null, tech: 'ASCII' });
        rootReal.defineReal('nodejs.system', { slotters: null, tech: 'SYSTEM' });
        
        rootReal.defineInsert('nodejs.root', 'nodejs.ascii');
        rootReal.defineInsert('nodejs.root', 'nodejs.system');
        
        rootReal.techReals = [
          rootReal.addReal('nodejs.ascii'),
          rootReal.addReal('nodejs.system')
        ];
        
      }
      
      return this.rootReal;
      
    },
    
    // Functionality
    getStaticIps: function(pref=[]) {
      return require('os').networkInterfaces()
        .toArr((v, type) => v.map(vv => ({ type, ...vv.slice('address', 'family', 'internal') })))
        .to(arr => Array.combine(...arr))
        .map(v => v.family.hasHead('IPv') && v.address !== '127.0.0.1' ? v.slice('type', 'address', 'family') : C.skip);
    },
    getJsSource: async function(type, name, bearing, ...opts) {
      if (![ 'setup', 'room' ].has(type)) throw Error(`Invalid source type: "${type}"`);
      let fp = (type === 'setup')
        ? [ 'setup', `${name}.js` ]
        : [ 'room', name, `${name}.${bearing}.js` ];
      
      let srcContent = await this.getKeep('fileSystem', fp).getContent('utf8');
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
      
      if (query.has('spoof')) {
        
        // Spoofing only available if allowed by Foundation
        if (!this.spoofEnabled) return null;
        
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
        
        // Supplying a "hutId" means the Hut claims to be familiar
        let roadedHut = parHut.getRoadedHut(query.hutId);
        if (!roadedHut) return null;
        
        if (roadedHut.serverRoads.has(server)) return roadedHut.serverRoads.get(server);
        return parHut.processNewRoad(server, road => {
          road.hutId = query.hutId;
          if (decorate) decorate(road);
        });
        
      }
      
      return parHut.processNewRoad(server, decorate || (road => {}));
      
    },
    makeHttpServer: async function(pool, { host, port, keyPair=null, selfSign=null }) {
      
      if (!port) port = keyPair ? 443 : 80;
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = (res, msg) => {
        
        // json, html, text, savd, error
        let type = (() => {
          if (msg === null || U.isTypes(msg, Object, Array)) return 'json';
          if (U.isType(msg, String)) return msg.hasHead('<!DOCTYPE') ? 'html' : 'text';
          if (U.isInspiredBy(msg, Keep)) return 'keep';
          if (msg instanceof Error) throw msg; //return 'error';
          throw Error(`Unknown type for ${U.nameOf(msg)}`);
        })();
        
        // TODO: This displays nice content-type-dependent information!
        if (this.transportDebug) console.log(`??TELL ${'hutId'}:`, ({
          text: () => ({ type: 'text', size: msg.length, val: msg }),
          html: () => ({ type: 'html', size: msg.length, val: `${msg.split('\n')[0].substr(0, 30)}...` }),
          json: () => JSON.stringify(msg).length < 200 ? msg : `${JSON.stringify(msg).substr(0, 200)}...`,
          keep: () => ({ type: 'keep', desc: msg.desc || null }),
          error: () => ({ type: 'error', msg: msg.error })
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
          keep: async () => {
            res.writeHead(200, {
              'Content-Type': (await msg.getContentType()) || 'application/octet-stream',
              'Content-Length': await msg.getContentByteLength()
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
        
        let ms = this.getMs();
        
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
          if (p === '/') return { command: 'syncInit', reply: true };
          if (p === '/favicon.ico') return { command: 'getIcon', reply: true };
          if (urlPath.length > 1) return { command: urlPath.slice(1), reply: true };
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
          // syncInit has effects at both transport- and hut-level
          syncInit:  {
            transport: road => {
              // Clear any buffered responses and tells
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
        if (params.reply) {
          try {
            return road.hear.drip([ params, msg => sendData(res, msg), ms ]);
          } catch(err) {
            // TODO: Stop leaking `err.message`!
            console.log('Http error response:', this.formatError(err));
            sendData(res, { command: 'error', msg: err.message, orig: params });
          }
        }
        
        // Run hut-level actions
        if (comTypes.has('hut') && comTypes.hut) road.hear.drip([ params, null, ms ]);
        
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
            
            // Send `bundleSize` bundled json Tells!
            sendData(res, {
              command: 'multi',
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
        let hash = require('crypto').createHash('sha1');
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
          let ms = this.getMs();
          let newBuffer = sokt.read();
          
          if (!newBuffer || !newBuffer.length) return;
          soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
          
          try {
            for (let message of Insp.parseSoktMessages(soktState)) road.hear.drip([ message, null, ms ]);
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
    establishHut: async function({ hut, bearing }) {
      
      await this.canSettlePrm;
      
      if (!hut) throw Error('Missing "hut" param');
      if (!bearing) throw Error('Missing "bearing" param');
      if (![ 'above', 'below', 'between', 'alone' ].has(bearing)) throw Error(`Invalid bearing: "${bearing}"`);
      
      // We're establishing with known params! So set them on `this`
      this.hut = U.isType(hut, Object) ? hut.name : hut;
      this.bearing = bearing;
      
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
          if (!U.rooms.has(room)) throw Error(`Room "${room}" didn't build correctly`);
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
