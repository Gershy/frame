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
      access: function(type) {
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
        json: 'text/json',
        html: 'text/html',
        css: 'text/css',
        txt: 'text/plain',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg'
      },
      
      init: function(absPath=Insp.fs.hutRootCmps) {
        if (absPath.find(v => !U.isType(v, String)).found) throw Error(`Invalid absPath for ${U.nameOf(this)}`);
        this.absPath = absPath;
      },
      desc: function() { return `${U.nameOf(this)}@[${this.absPath.join(', ')}]`; },
      getFileUrl: function() { return Insp.fs.cmpsToFileUrl(this.absPath); },
      access: function(dirNames) {
        if (U.isType(dirNames, String)) dirNames = [ dirNames ];
        let KeepCls = this.constructor;
        return KeepCls([ ...this.absPath, ...dirNames ]);
      },
      checkType: async function() {
        let meta = await Insp.fs.getMeta(this.absPath);
        if (!meta) return null;
        if (meta.isDirectory()) return 'folder';
        if (meta.isFile()) return 'letter';
        throw Error(`${this.desc()} is unknown type (non-folder, non-letter)`);
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
            await Promise.allArr(items.map(item => this.access(item).setContent(null)));
            
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
      access: function({ path, urlParams }) { return Insp.KeepUrlResource(this, path, urlParams); }
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
      
      // As soon as we're compiled we can install useful cmp->src exception handlers
      process.removeAllListeners('uncaughtException');  // TODO: Bad bandaid for multiple instances of FoundationNodejs
      process.removeAllListeners('unhandledRejection');
      process.on('uncaughtException', err => console.error(this.formatError(err)));
      process.on('unhandledRejection', err => console.error(this.formatError(err)));
      
      this.bearing = 'above';
      this.fsKeep = this.seek('keep', 'fileSystem'); //this.getRootKeep().access('fileSystem');
      
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
          this.fsKeep.seek([ 'mill', 'storage' ]).setContent(null),
          this.fsKeep.seek([ 'mill', 'room' ]).setContent(null)
        ]);
      })();
      
    },
    installRoom: async function(name, bearing='above') {
      
      console.log(`Installing ${name}!`);
      let file = await this.seek('keep', 'fileSystem', [ 'room', name, `${name}.js` ]).getContent('utf8');
      let { lines, offsets } = await this.compileContent(bearing, file);
      
      return {
        debug: { offsets },
        content: (async () => {
          
          // Write, `require`, and ensure file populates `global.rooms`
          await this.seek('keep', 'fileSystem', [ 'mill', 'compiled', `${name}.${bearing}.js` ]).setContent(lines.join('\n'));
          require(`../mill/compiled/${name}.${bearing}.js`);
          if (!global.rooms.has(name)) throw Error(`Room "${name}" didn't set global.rooms.${name}`);
          
          return global.rooms[name](this);
          
        })()
      };
      
    },
    
    // Util
    queueTask: setImmediate,
    getMemUsage: function() {
      let usage1 = process.memoryUsage();
      return {
        rss: usage1.rss - this.usage0.rss,
        heapTotal: usage1.heapTotal,
        heapUsed: usage1.heapUsed - this.usage0.heapUsed
      };
    },
    compileContent: function(variantName, srcLines) {
      
      // Compile file content; filter based on variant tags
      if (U.isType(srcLines, String)) srcLines = srcLines.split('\n');
      if (!U.isType(srcLines, Array)) throw Error(`Param "srcLines" is invalid type: ${U.nameOf(srcLines)}`);
      let variantDef = this.variantDefs[variantName];
      
      let blocks = [];
      let curBlock = null;
      
      for (let i = 0; i < srcLines.length; i++) {
        let line = srcLines[i].trim();
        
        if (curBlock) { // In a block, check for the block end
          if (line.has(`=${curBlock.type.upper()}}`)) {
            curBlock.end = i;
            blocks.push(curBlock);
            curBlock = null;
          }
        }
        
        if (!curBlock) { // Outside a block, check for start of any block
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
      
      for (let i = 0; i < srcLines.length; i++) {
        let rawLine = srcLines[i];
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
    
    // High level
    createHut: async function(options={}) {
      
      // TODO: Think about what is happening with `hutInstance.uid` -
      // For Above the uid is hard-coded and basically arbitrary. For
      // Below the uid is an unguessable, private base62 string.
      
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
        let certFolder = this.seek('keep', 'fileSystem', [ 'mill', 'cert' ]);
        let { cert, key, selfSign } = await Promise.allObj({
          cert:     certFolder.seek('server.cert').getContent(),
          key:      certFolder.seek('server.key').getContent(),
          selfSign: certFolder.seek('localhost.cert').getContent()
        });
        sslArgs = { keyPair: { cert, key }, selfSign };
      }
      
      options.uid = 'nodejs.root';
      options.hosting.gain({ host, port: parseInt(port, 10), sslArgs });
      
      return insp.Foundation.createHut.call(this, options);
      
    },
    createKeep: function(options={}) {
      return Insp.KeepNodejs();
    },
    createReal: async function(options={}) {
      let real = (await this.getRoom('real')).Real(null, 'nodejs.root');
      real.defineReal('nodejs.ascii', { slotters: null, tech: 'ASCII' });
      real.defineReal('nodejs.system', { slotters: null, tech: 'SYSTEM' });
      real.defineInsert('nodejs.root', 'nodejs.ascii');
      real.defineInsert('nodejs.root', 'nodejs.system');
      real.techReals = [
        real.addReal('nodejs.ascii'),
        real.addReal('nodejs.system')
      ];
      return real;
    },
    
    // Errors
    parseErrorLine: function(line) {
      
      // The codepoint filename must not contain round/square brackets or spaces
      let [ path, lineInd, charInd ] = line.match(/([^()[\] ]+):([0-9]+):([0-9]+)/).slice(1);
      let [ fileName ] = path.match(/([a-zA-Z0-9.]*)$/);
      
      // Skip non-hut files
      let fileNamePcs = Insp.KeepFileSystem.fs.cmpsToFileUrl([ path ]);
      if (!fileNamePcs.hasHead(this.fsKeep.getFileUrl())) throw Error(`Path "${path}" isn't relevant to error`);
      
      // Extract room name and bearing from filename
      let [ roomName, bearing=null ] = fileName.split('.').slice(0, -1);
      return { roomName, bearing, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10) };
      
    },
    srcLineRegex: function() {
      return {
        regex: /([^ ]*[^a-zA-Z0-9.])?[a-zA-Z0-9.]*[.]js:[0-9]+/, // TODO: No charInd
        extract: fullMatch => {
          let [ roomBearingName, lineInd ] = fullMatch.split(/[^a-zA-Z0-9.]/).slice(-2);
          let [ roomName, bearing ] = roomBearingName.split('.');
          return { roomName, lineInd: parseInt(lineInd, 10), charInd: null };
        }
      };
    },
    
    // Functionality
    getStaticIps: function(pref=[]) {
      return require('os').networkInterfaces()
        .toArr((v, type) => v.map(vv => ({ type, ...vv.slice('address', 'family', 'internal') })))
        .to(arr => Array.combine(...arr))
        .map(v => v.family.hasHead('IPv') && v.address !== '127.0.0.1' ? v.slice('type', 'address', 'family') : C.skip);
    },
    getJsSource: async function(type, name, bearing) {
      
      if (![ 'setup', 'room' ].has(type)) throw Error(`Invalid source type: "${type}"`);
      let fp = (type === 'setup')
        ? [ 'setup', `${name}.js` ]
        : [ 'room', name, `${name}.${bearing}.js` ];
      let srcContent = await this.seek('keep', 'fileSystem', fp).getContent('utf8');
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
      if (pcs.length !== 4 || pcs.find(v => isNaN(v)).found) throw Error(`Invalid ip: "${verboseIp}"`);
      let ip = pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
      return ip + ':' + verbosePort.toString(16).padHead(4, '0'); // Max port hex value is ffff; 4 digits
    },
    getHutRoadForQuery: function(server, parHut, hutId, decorate=null) {
      
      // TODO: Right now a Road can be spoofed - this should be a
      // property of the Hut, shouldn't it?
      
      // Free pass for Huts that declare themselves unfamiliar
      if (hutId === null) return parHut.processNewRoad(server, decorate || (road => {}));
      
      // Check if this RoadedHut is familiar:
      let roadedHut = parHut.getRoadedHut(hutId);
      if (roadedHut) {
        // Familiar RoadedHuts are guaranteed a Road
        return roadedHut.serverRoads.has(server)
          // Any previous Road is reused
          ? roadedHut.serverRoads.get(server)
          // Otherwise a new Road is processed for the RoadedHut
          : parHut.processNewRoad(server, road => (road.hutId = hutId, decorate && decorate(road)));
      }
      
      // Past this point a Road can only be returned by spoofing
      if (!this.spoofEnabled) return null;
      
      // Return a Road spoofed to have the requested `hutId`
      let newSpoofyRoad = parHut.processNewRoad(server, road => (road.hutId = hutId, decorate && decorate(road)));
      newSpoofyRoad.hut.isSpoofed = true;
      return newSpoofyRoad;
      
    },
    makeHttpServer: async function(pool, { host, port, keyPair=null, selfSign=null }) {
      
      if (!port) port = keyPair ? 443 : 80;
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = (res, msg) => {
        
        // json, html, text, savd, error
        let type = (() => {
          if (U.isType(msg, Object) && msg.has('~contentData')) return 'cd';
          if (msg === null || U.isTypes(msg, Object, Array)) return 'json';
          if (U.isType(msg, String)) return (msg.match(/^<!doctype/i)) ? 'html' : 'text';
          if (U.isInspiredBy(msg, Keep)) return 'keep';
          if (msg instanceof Error) throw msg; //return 'error';
          throw Error(`Unknown type for ${U.nameOf(msg)}`);
        })();
        
        return ({
          cd: () => {
            let type = FoundationNodejs.KeepFileSystem.extensionContentTypeMap[msg.type];
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(msg.content) });
            res.end(msg.content);
          },
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
        let iden = params.splice('hutId');
        
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
        let road = this.getHutRoadForQuery(server, pool, iden.seek('hutId').val);
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
        
        let road = this.getHutRoadForQuery(server, pool, query.seek('hutId').val, road => road.sokt = sokt);
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
    
    getPlatformName: function() { return 'nodejs'; }
    
  })});
  
  U.setup.gain({ FoundationNodejs });
  
})();
