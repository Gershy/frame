(() => {
  
  let [ path, fs, http, crypto, os ] = [ 'path', 'fs', 'http', 'crypto', 'os' ].map(v => require(v));
  let { BareWob } = U;
  
  let rootDir = path.join(__dirname, '..');
  let roomDir = path.join(rootDir, 'room');
  
  let { Foundation } = U.foundationClasses;
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
    init: function({ hut, bearing, roomDir, variantDefs, ip='static', port=80, ipPref=null, showIps=false, networkDebug=false }) {
      if (showIps) {
        console.log('IP OPTIONS:', this.getStaticIps());
        return process.exit(0);
      }
      
      insp.Foundation.init.call(this, { hut, bearing });
      this.roomsInOrder = [];
      this.variantDefs = variantDefs || {};
      this.compilationData = {};
      this.mountedFiles = {};
      this.networkDebug = networkDebug;
      
      if (ip === 'static') {
        let staticIps = this.getStaticIps();
        if (staticIps.isEmpty()) throw new Error('No static ip available!');
        
        if (!ipPref) {
          console.log(`In absence of ipPref using "${staticIps[0].type}"`);
          ip = staticIps[0].address;
        } else {
          ip = staticIps.find(({ type }) => type.lower() === ipPref.lower());
          ip = !ip
            ? console.log(`Couldn\'t find ipPref "${ipPref}"; using "${staticIps[0].type}"`) || staticIps[0].address
            : ip[0].address;
        }
      } else if (ip === 'local') {
        ip = '127.0.0.1';
      }
      
      this.ip = ip;
      this.port = port;
      
      this.addMountFile('favicon.ico', 'setup/favicon.ico', 'image/x-icon');
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
    compileRecursive: async function(roomName, alreadyParsed={}, list=[]) {
      // Compiles `roomName`, ensuring that all its inner rooms are compiled beforehand
      // Inner rooms are determined by simple file parsing
      
      if (alreadyParsed.has(roomName)) return alreadyParsed[roomName];
      let [ rsv, rjc ] = [ null, null ];
      let prm = new Promise((rsv0, rjc0) => { [ rsv, rjc ] = [ rsv0, rjc0 ]; });
      alreadyParsed[roomName] = { rsv, rjc, prm };
      
      // Cause inner-room-compilation to run for all inner rooms
      let innerRoomNames = await this.parsedDependencies(roomName);
      innerRoomNames.forEach(irName => this.compileRecursive(irName, alreadyParsed, list)); // Don't await here!
      
      // Wait for all inner rooms to finish compiling
      await Promise.all(innerRoomNames.map(irName => alreadyParsed[irName].prm));
      
      // Now that all dependencies are done, compile and add us to the list
      await this.compile(roomName);
      alreadyParsed[roomName].rsv('Compiled!');
      list.push(roomName);
      
      return list;
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
          
          // The codepoint filename must not contain brackets or spaces
          let codePointPcs = line.match(/([^()[\] ]+):([0-9]+):([0-9]+)/);
          let [ fileName, lineInd, charInd ] = codePointPcs.slice(1);
          
          fileName = path.normalize(fileName);
          if (!fileName.hasHead(rootDir)) return U.SKIP; // Skip non-hut files
          
          let mappedLineData = this.mapLineToSource(fileName, parseInt(lineInd));
          
          if (mappedLineData) {
            fileName = `room/${mappedLineData.roomName}/${mappedLineData.roomName}.cmp`;
            lineInd = mappedLineData.srcLineInd;
          } else {
            fileName = fileName.substr(rootDir.length + 1).split(path.sep).join('/');
          }
          
          return `${fileName.padTail(32)} @ ${lineInd.toString().padTail(10)}|`;
          
        } catch(err) {
          
          return `${err.message.split('\n').join(' ')} - "${origLine}"`;
          
        }
        
      });
      
      let fileRegex = /([^/\\]+(\/|\\))*([^/\\]+\.js):([0-9]+)/;
      let moreData = stack.substr(0, traceBegins - 1).replace(fileRegex, (match, x, y, file, lineInd) => {
        
        let fileNameData = file.match(/^cmp-([^-]+)-(.+)\.js/);
        if (!fileNameData) return match;
        
        let colonInd = match.lastIndexOf(':');
        let fullFileName = match.substr(0, colonInd);
        
        let mappedLineData = this.mapLineToSource(fullFileName, parseInt(lineInd, 10)); 
        if (!mappedLineData) return match;
        
        return `twig/${mappedLineData.twigName}/${mappedLineData.twigName}.js:${mappedLineData.lineInd}`;
        
      });
      
      let content = lines.join('\n');
      if (!content.trim().length) content = 'Couldn\'t format error:\n' + trace;
      
      let lineAbove = '\u203E';
      let lineBelow = '_';
          
      return `/${lineAbove.repeat(30)}\n` +
        moreData.split('\n').map(ln => `| ${ln}`).join('\n') + '\n' +
        `\\${lineBelow.repeat(30)}\n\n` +
        content;
    },
    
    // Functionality
    addMountFile: function(name, src, type=null) {
      let nativeDir = path.join(rootDir, src);
      try { fs.statSync(nativeDir); }
      catch(err) { throw new Error(`Couldn't add file ${name}: ${src}`); }
      this.mountedFiles[name] = { type, nativeDir };
    },
    getMountFile: function(name) {
      if (!this.mountedFiles.has(name)) throw new Error(`File "${name}" isn't mounted`);
      let { type, nativeDir } = this.mountedFiles[name];
      return {
        ISFILE: true, type,
        name,
        getContent: async () => {
          if (!this.mountedFiles.has(name)) throw new Error(`File "${name}" isn't mounted`);
          this.readFile(nativeDir)
        },
        getPipe: () => fs.createReadStream(nativeDir),
        getNumBytes: async () => {
          return new Promise((rsv, rjc) => fs.stat(nativeDir, (err, nb) => err ? rjc(err) : rsv(nb.size)));
        }
      };
    },
    getStaticIps: function(pref=[]) {
      return os.networkInterfaces()
        .toArr((v, type) => v.map(vv => ({ type, ...vv.slice('address', 'family', 'internal') })))
        .to(arr => Array.combine(...arr))
        .map(v => v.family === 'IPv4' && v.address !== '127.0.0.1' ? v : C.skip);
    },
    readFile: async function(name, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.readFile(name, options, (err, c) => {
        if (err) return rjc(err0.gain({ message: `Couldn't read ${name}: ${err.message}` }));
        return rsv(c);
      }));
    },
    writeFile: async function(name, content, options='utf8') {
      let err0 = new Error('');
      return new Promise((rsv, rjc) => fs.writeFile(name, content, options, (err, c) => {
        if (err) return rjc(err0.gain({ message: `Couldn't write ${name}: ${err.message}` }));
        return rsv(c);
      }));
    },
    compactIp: function(ipVerbose) {
      // TODO: This is ipv4; could move to v6 easily by lengthening return value and padding v4 vals with 0s
      let pcs = ipVerbose.split(',')[0].trim().split('.');
      if (pcs.length !== 4 || pcs.find(v => isNaN(v))) throw new Error(`Bad ip format: ${ipVerbose}`);
      return pcs.map(v => parseInt(v, 10).toString(16).padHead(2, '0')).join('');
    },
    makeHttpServer: async function(ip=this.ip, port=this.port) {
      let connections = {};
      let serverWob = BareWob({});
      let sendData = (ip, res, msg) => {
        let type = (() => {
          if (U.isType(msg, String)) return msg[0] === '<' ? 'html' : 'text';
          if (U.isType(msg, Object)) return msg.has('ISFILE') ? 'file' : 'json';
          throw new Error(`Unknown type for ${U.typeOf(msg)}`);
        })();
        
        console.log(`TELL ${ip}:`, ({
          text: () => ({ ISTEXT: true, val: msg }),
          html: () => ({ ISHTML: true, val: `${msg.split('\n')[0].substr(0, 30)}...` }),
          json: () => JSON.stringify(msg).length < 100 ? msg : `${JSON.stringify(msg).substr(0, 100)}...`,
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
        
        // Stream the body
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        let body = await new Promise(r => req.on('end', () => r(chunks.join(''))));
        
        // TODO: Force all bodies to be JSON?
        if (body.length) {
          try { body = JSON.parse(body); }
          catch(err) { console.log('Couldn\'t parse body', body); body = {}; }
        } else {
          body = {};
        }
        
        if (this.networkDebug) {
          console.log('\n\n' + [
            '==== INCOMING REQUEST ====',
            `IP: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`,
            `REQURL: ${req.url}`,
            `REQHDS: ${JSON.stringify(req.headers, null, 2)}`,
            `BODY: ${JSON.stringify(body, null, 2)}`
          ].join('\n'));
        }
        
        // Get the ip
        let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        let { path: urlPath, query } = this.parseUrl(`http://${ip}${req.url}`);
        
        // Allow ip spoofing (TODO: REALLY disable in production!)
        if (query.has('spoof')) ip = query.spoof;
        
        // Compactify the ip
        ip = this.compactIp(ip);
        
        // Create a new connection if this ip hasn't been seen before
        if (!connections.has(ip)) {
          console.log(`CONN ${ip}`);
          
          let connectionWob = connections[ip] = {
            ip,
            hear: BareWob({}),
            tell: BareWob({}),
            shut: BareWob({}),
            queuedTells: [],
            queuedResponses: []
          };
          connectionWob.tell.hold(msg => {
            if (connectionWob.queuedResponses.length) {
              sendData(ip, connectionWob.queuedResponses.shift(), msg);
            } else {
              connectionWob.queuedTells.push(msg);
            }
          });
          serverWob.wobble(connectionWob);
          
          connectionWob.hear.hold(([ msg, reply ]) => {
            console.log(`HEAR ${ip}:`, msg);
          });
          connectionWob.tell.hold(msg => {
            
          });
          
        }
        
        // Get the current connection for this ip
        let connectionWob = connections[ip];
        
        // A requirement to sync means the response data alone lacks context;
        // the response object will need to correspond to its fellow request
        let syncReqRes = false;
        
        // Interpret requests with an empty body based on other features of `req`
        if (body.isEmpty()) {
          if (urlPath.hasHead('/!')) {
            if (urlPath.hasHead('/!FILE/')) { body = { command: 'getFile', path: urlPath.substr(7) }; syncReqRes = true; }
          } else {
            if (urlPath === '/') { body = { command: 'getInit' }; syncReqRes = true; }
            if (urlPath === '/favicon.ico') { body = { command: 'getFile', path: 'favicon.ico' }; syncReqRes = true; }
          }
        }
        
        // Default to the "ping" command
        if (body.isEmpty()) body = { command: 'ping' };
        
        // Performing "getInit" always resets any banked polls
        if (body.command === 'getInit') {
          connectionWob.queuedResponses.forEach(res => res.end());
          connectionWob.queuedResponses = [];
          connectionWob.queuedTells = [];
        }
        
        if (syncReqRes) {
          
          // Send along a "reply" func which uses the corresponding response object
          connectionWob.hear.wobble([ body, msg => sendData(ip, res, msg) ]);
          
        } else {
          
          // Build list of transport-level commands
          // TODO: Is it a safe assumption that these httpCommands are never synced?
          let httpCommands = {
            close: () => {
              console.log('Closing connection @', ip);
              delete connections[ip];
              connectionWob.shut.wobble();
            },
            bankPoll: () => {
              // Do nothing
            }
          };
          
          // Do either a transport- or application-level command
          if (httpCommands.has(body.command)) httpCommands[body.command]();
          else                                connectionWob.hear.wobble([ body, null ]);
          
          // If there are any tells send the oldest, otherwise keep ahold of the response
          if (connectionWob.queuedTells.length) {
            sendData(ip, res, connectionWob.queuedTells.shift());
          } else {
            connectionWob.queuedResponses.push(res);
          }
          
          // Don't hold more than one response
          while (connectionWob.queuedResponses.length > 1)
            sendData(ip, connectionWob.queuedResponses.shift(), { command: 'fizzle' });
            
        }
        
      });
      
      await new Promise(r => server.listen(port, ip, 511, r));
      return serverWob;
    },
    makeSoktServer: async function(ip=this.ip, port=this.port + 1) {
      let serverWob = BareWob({});
      let server = net.createServer(sokt => {
        
        let connectionWob = {
          ip: this.compactIp(sokt.remoteAddress),
          hear: BareWob({}),
          tell: BareWob({}),
          shut: BareWob({})
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
          
          if (op !== 1) {
            throw new Error(`Unsupported op: ${op}`);
          } else { // Text ops are our ONLY supported ops!
            curOp = 1;
            curFrames.push(data);
            
            if (final) {
              let fullStr = Buffer.concat(p.curFrames).toString('utf8');
              curOp = null;
              curFrames = [];
              connectionWob.hear.wobble(JSON.parse(fullStr));
            }
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
          connectionWob.shut.wobble();
        });
        sokt.on('error', err => {
          console.log(`Socket error:\n${this.formatError(err)}`);
          sokt.end();
        });
        
      });
      
      await new Promise(r => server.listen(port, ip, r));
      return serverWob;
    },
    
    getPlatformName: function() { return `nodejs@${this.ip}:${this.port}`; },
    genInitBelow: async function(contentType, hutTerm, initContent={}) {
      if (contentType !== 'text/html') throw new Error(`Invalid content type: ${contentType}`);
      
      let doc = XmlElement(null, 'root');
      
      let doctype = doc.add(XmlElement('!DOCTYPE', 'singleton'));
      doctype.setProp('html');
      
      let html = doc.add(XmlElement('html', 'container'));
      
      let head = html.add(XmlElement('head', 'container'));
      let title = head.add(XmlElement('title', 'text', `${this.hut.upper()}`));
      
      let setupScript = head.add(XmlElement('script', 'text'));
      setupScript.setProp('type', 'text/javascript');
      setupScript.setText('window.global = window;');
      
      let mainScript = head.add(XmlElement('script', 'text'));
      
      let files = [ 'setup/clearing.js', 'setup/foundation.js', 'setup/foundationBrowser.js' ]
        .concat(this.roomsInOrder.map(r => `room/${r}/${r}.below.js`));
      let contents = await Promise.all(files.map(f => this.readFile(path.join(rootDir, f))));
      let splitContents = new Array(files.length);
      for (let i = 0; i < files.length; i++) splitContents[i] = `// ==== File: ${files[i]}\n${contents[i]}`;
      
      contents = splitContents.join('\n\n') + '\n\n' + [
        '// ==== File: hut.js',
        `U.hutTerm = '${hutTerm}';`,
        `U.initData = ${JSON.stringify(initContent)};`,
        'let { FoundationBrowser } = U.foundationClasses;',
        `U.foundation = FoundationBrowser({ hut: '${this.hut}', bearing: 'below' });`,
        'U.foundation.install();'
      ].join('\n');
      
      mainScript.setProp('type', 'text/javascript');
      mainScript.setText(contents);
      
      let mainStyle = head.add(XmlElement('style', 'text'));
      mainStyle.setProp('type', 'text/css');
      mainStyle.setText([
        'html, body {',
        '  position: absolute;',
        '  left: 0; top: 0;',
        '  width: 100%; height: 100%;',
        '  margin: 0;',
        '  padding: 0;',
        '  background-color: #eaeaf2;',
        '  font-family: monospace;',
        '}'
      ].join('\n'));
      
      let body = html.add(XmlElement('body', 'container'));
      
      return doc.toString();
    },
    installFoundation: async function() {
      // Overwrite the original "buildRoom" logic
      let origBuildRoom = U.buildRoom;
      U.buildRoom = (...args) => origBuildRoom(...args)();
      
      process.on('uncaughtException', err => console.log(this.formatError(err)));
      process.on('unhandledRejection', err => console.log(this.formatError(err)));
      
      this.roomsInOrder = await this.compileRecursive(this.hut);
      this.roomsInOrder.forEach(roomName => require(`../room/${roomName}/${roomName}.${this.bearing}.js`));
    }
  })});
  
  U.foundationClasses.gain({
    FoundationNodejs
  });
  
})();
