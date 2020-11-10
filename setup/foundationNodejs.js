(() => {
  
  // TODO: For `res.writeHead(...)`, consider Keep-Alive
  // e.g. 'Keep-Alive: timeout=5, max=100'
  
  let { Tmp, Src, MemSrc, FnSrc, Chooser, Scope, Range } = U.logic;
  
  let { Foundation, Real, Keep } = U.setup;
  
  let FoundationNodejs = U.form({ name: 'FoundationNodejs', has: { Foundation }, props: (forms, Form) => ({
    
    $KeepNodejs: U.form({ name: 'KeepNodejs', has: { Keep }, props: forms => ({
      init: function() {
        forms.Keep.init.call(this);
        
        let fileSystemKeep = Form.KeepFileSystem({
          secure: true,
          blacklist: Set([ '.git', '.gitignore', 'mill' ])
        });
        this.keepsByType = {
          static: Form.KeepStatic(fileSystemKeep),
          fileSystem: fileSystemKeep,
          adminFileSystem: Form.KeepFileSystem({ secure: false }),
          urlResource: Form.KeepUrlResources()
        };
      },
      access: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepStatic: U.form({ name: 'KeepStatic', has: { Keep }, props: (forms, Form) => ({
      init: function(fileSystemKeep) {
        this.fileSystemKeep = fileSystemKeep;
        this.hut = null;
      },
      setHut: function(hut) { this.hut = hut; },
      access: function(fpCmps) {
        
        let key = [ 'static', ...fpCmps ].join('/');
        if (!this.hut.roadSrcs.has(key)) {
          // Make keep available to Below
          this.hut.roadSrc(key).route(async ({ reply }) => reply(this.fileSystemKeep.seek(fpCmps)));
        }
        return this.fileSystemKeep.seek(fpCmps);
        
      }
    })}),
    $KeepFileSystem: U.form({ name: 'KeepFileSystem', has: { Keep }, props: (forms, Form) => ({
      
      $fs: ((path, fs) => ({
        
        // "folder" = "directory"; "letter" = "file"
        
        hutRootCmps: (() => {
          // If the absolute path is prefixed with the path separator
          // (common for *nix) the leading item will be an empty string.
          // We also need to ensure this path is absolute, so any
          // leading empty string can be replaced with the separator
          let [ root, ...cmps ] = __dirname.split(path.sep);
          return [ root || path.sep, ...cmps ].slice(0, -1);
        })(),
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
      $HoneyPotKeep: U.form({ name: 'HoneyPotKeep', has: { Keep }, props: (forms, Form) => ({
        init: function(data=[ 'honey', 'passwords', 'tokens', 'credentials', 'bitcoin', 'wallet' ]) { this.data = data; },
        access: function() { return this; },
        setContentType: function() { return this; },
        getContentType: function() { return 'application/json'; },
        getFsType: function() { return 'folder'; },
        getContent: function() { return this.data; },
        setContent: function() {},
        getContentByteLength: function() { return Buffer.byteLength(JSON.stringify(this.data)); },
        getPipe: function() { return ({ pipe: async res => res.end(JSON.stringify(this.data)) }); }
      })}),
      
      // Ensures that a filepath component is "secure"; that it does not
      // define parent access. The ".." sequence is prevented, since "."
      // characters cannot occur side-by-side.
      $secureFpReg: /^[.]?([a-zA-Z0-9@][.]?)*$/,
      
      $extToContentType: {
        json: 'text/json',
        html: 'text/html',
        css: 'text/css',
        txt: 'text/plain',
        ico: 'image/x-icon',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg+xml'
      },
      
      init: function({ absPath=Form.fs.hutRootCmps, secure=true, blacklist=null }) {
        if (absPath.find(v => !U.isForm(v, String)).found) throw Error(`Invalid absPath for ${U.getFormName(this)}`);
        this.absPath = absPath;
        this.secure = secure;
        if (blacklist) this.blacklist = blacklist;
      },
      setContentType: function(contentType) { this.contentType = contentType; return this; },
      desc: function() { return `${U.getFormName(this)}@[${this.absPath.join(', ')}]`; },
      getFileUrl: function() { return Form.fs.cmpsToFileUrl(this.absPath); },
      access: function(dirNames) {
        if (U.isForm(dirNames, String)) dirNames = [ dirNames ];
        if (!U.isForm(dirNames, Array)) throw Error(`Dir names must be Array (or String)`);
        if (dirNames.find(d => !U.isForm(d, String)).found) throw Error(`All dir names must be Strings`);
        
        // Remove any useless cmps
        dirNames = dirNames.map(d => (d === '' || d === '.') ? C.skip : d);
        
        // Ensure all cmps are valid
        if (this.secure && dirNames.find(d => !d.match(Form.secureFpReg)).found) return Form.HoneyPotKeep();
        if (this.blacklist && this.blacklist.has(dirNames[0])) return Form.HoneyPotKeep();
        
        // No need to create a child for 0 cmps
        if (!dirNames.count()) return this;
        
        let KeepCls = this.constructor;
        return KeepCls({ absPath: [ ...this.absPath, ...dirNames ], secure: this.secure });
      },
      getFsType: async function() {
        if (!this.metaPrm) this.metaPrm = Form.fs.getMeta(this.absPath);
        
        let meta = await this.metaPrm;
        if (!meta) return null;
        if (meta.isDirectory()) { return 'folder'; }
        if (meta.isFile())      { this.contentType = Form.extToContentType.json; return 'letter'; }
        throw Error(`${this.desc()} has unknown fsType (exists; non-folder, non-letter)`);
      },
      getContent: async function(...opts) {
        let fsType = await this.getFsType();
        if (fsType === 'folder') {
          
          let content = await Form.fs.getFolder(this.absPath, ...opts);
          
          // Filter blacklisted items if necessary
          return this.blacklist
            ? content.map(v => this.blacklist.has(v) ? C.skip : v)
            : content;
          
        } else if (fsType === 'letter') {
          
          return Form.fs.getLetter(this.absPath, ...opts);
          
        } else {
          
          return null;
          
        }
      },
      setContent: async function(content, ...opts) {
        
        let fsType = await this.getFsType();
        if (content !== null) { // Insert new content
          
          if (fsType === 'folder') throw Error(`${this.desc()} is type "folder"; can't set non-null content`);
          
          // Create all ancestor dirs
          for (let depth = 1; depth < this.absPath.length; depth++) {
            let cmps = this.absPath.slice(0, depth);
            let meta = await Form.fs.getMeta(cmps);
            
            // If this ancestor is non-existent, create it
            // If this ancestor exists but isn't a directory, throw error
            if (!meta) await Form.fs.addFolder(cmps);
            else if (!meta.isDirectory()) throw Error(`${this.desc()} has an invalid path; can't set content`);
          }
          
          // Write content into file
          await Form.fs.setLetter(this.absPath, content, ...opts);
          
        } else if (content === null && fsType === 'folder') {
          
          let items = await this.getContent();
          
          if (items) {
            
            // Set content of all items to `null`
            await Promise.allArr(items.map(item => this.access(item).setContent(null)));
            
          } else {
            
            // Without a single child
            await Form.fs.remFolder(this.absPath);
            await this.remNullAncestry();
            
          }
          
        } else if (content === null && fsType === 'letter') {
          
          await Form.fs.remLetter(this.absPath);
          await this.remNullAncestry();
          
        }
        
      },
      remNullAncestry: async function() {
        
        // Starting with our immediate parent folder, continuously
        // deletes each empty ancestor folder encountered. Stops as soon
        // as any ancestor folder is non-empty.
        
        for (let depth = this.absPath.length - 1; depth > 1; depth--) {
          
          let cmps = this.absPath.slice(0, depth);
          let children = await Form.fs.getFolder(cmps);
          
          if (children === null) continue; // If `children` is `null` the ancestor is already deleted
          if (children.length) break; // An ancestor is populated - stop deleting!
          
          await Form.fs.remFolder(cmps); // This ancestor is empty - delete it!
          
        }
        
      },
      getContentType: function() {
        if (this.contentType) return this.contentType;
        let [ lastCmp ] = this.absPath.slice(-1);
        let [ pcs, ext=null ] = lastCmp.split('.').slice(-2);
        return Form.extToContentType.has(ext) ? Form.extToContentType[ext] : 'application/octet-stream'
      },
      getContentByteLength: async function() {
        let fsType = await this.getFsType();
        if (fsType === 'letter') return (await this.metaPrm).size;
        if (fsType === 'folder') return 0;
        return 0;
      },
      getPipe: async function() {
        
        let fsType = await this.getFsType();
        if (fsType === 'letter') return Form.fs.getPipe(this.absPath);
        if (fsType === 'folder') return { pipe: async res => res.end(JSON.stringify(await this.getContent())) };
        return null;
        
      }
      
    })}),
    $KeepUrlResources: U.form({ name: 'KeepUrlResources', has: { Keep }, props: forms => ({
      init: function() {},
      access: function({ path, urlParams }) { return Form.KeepUrlResource(this, path, urlParams); }
    })}),
    $KeepUrlResource: U.form({ name: 'KeepUrlResource', has: { Keep }, props: forms => ({
      init: function(path='', params={}) {
        forms.Keep.init.call(this);
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
    $removeCommentRegex: /^(([^'"`]|'[^']*'|"[^"]*"|`[^`]*`)*)[/][/]/,
    
    init: function(...args) {
      
      forms.Foundation.init.call(this, ...args);
      
      // As soon as we're compiled we can install useful cmp->src exception handlers
      process.removeAllListeners('uncaughtException');  // TODO: Bad bandaid for multiple instances of FoundationNodejs
      process.removeAllListeners('unhandledRejection');
      process.on('uncaughtException', err => console.error(this.formatError(err)));
      process.on('unhandledRejection', err => console.error(this.formatError(err)));
      
      this.bearing = 'above';
      this.fsKeep = this.seek('keep', 'adminFileSystem');
      
      this.roomsInOrder = [];
      this.compilationData = {};
      
      this.variantDefs = {
        above: { above: 1, below: 0 },
        below: { above: 0, below: 1 }
      };
      
      this.transportDebug = false;
      
      this.usage0 = process.memoryUsage().map(v => v);
      
      this.canSettlePrm = (async () => {
        
        await Promise.allArr([
          this.fsKeep.seek([ 'mill', 'storage' ]).setContent(null),
          this.fsKeep.seek([ 'mill', 'room' ]).setContent(null)
        ]);
        
        let tests = [
          
          async m => { // Number.prototype.toArr
            let arr = (10).toArr(v => v);
            if (!U.isForm(arr, Array)) throw Error(`Expected Array; got ${U.getFormName(arr)}`);
            if (arr.count() !== 10) throw Error(`Expected exactly 10 items; got ${arr.count()}`);
            
            for (let i = 0; i < arr.count(); i++) {
              if (arr[i] !== i) throw Error(`Expected ${i} at position ${i}; got ${arr[i]}`);
            }
          },
          
          async m => { // Promise.allObj
            let prms = {
              thing1: 'hi',
              thing2: 'yo',
              thing3: Promise(r => setTimeout(() => r('ha'), 0)),
              thing4: Promise(r => this.queueTask(() => r('69')))
            };
            let { thing1, thing2, thing3, thing4, ...more } = await Promise.allObj(prms);
            
            if (thing1 !== 'hi') throw Error(`Invalid "thing1"`);
            if (thing2 !== 'yo') throw Error(`Invalid "thing2"`);
            if (thing3 !== 'ha') throw Error(`Invalid "thing3"`);
            if (thing4 !== '69') throw Error(`Invalid "thing4"`);
            if (more.toArr(v => v).count()) throw Error(`allObj resulted in unexpected values`);
          },
          
          async m => { // Ending a Temp changes the results of getter methods
            let tmp = Tmp();
            if (!tmp.onn()) throw Error(`getPosActive() === false before setInactive()`);
            if (tmp.off()) throw Error(`getNegActive() === true before setInactive()`);
            tmp.end();
            if (tmp.onn()) throw Error(`getPosActive() === true after setInactive()`);
            if (!tmp.off()) throw Error(`getNegActive() === false after setInactive()`);
          },
          async m => { // Tmps linked to end with each other stay alive
            let tmp1 = Tmp();
            let tmp2 = Tmp();
            tmp1.endWith(tmp2);
            tmp2.endWith(tmp1);
            if (tmp1.off()) throw Error(`Tmp #1 ended for no reason`);
            if (tmp2.off()) throw Error(`Tmp #2 ended for no reason`);
          },
          async m => { // Tmps linked to end with each other end correctly #1
            let tmp1 = Tmp();
            let tmp2 = Tmp();
            tmp1.endWith(tmp2);
            tmp2.endWith(tmp1);
            tmp1.end();
            if (tmp1.onn()) throw Error(`Tmp #1 still onn after ended`);
            if (tmp2.onn()) throw Error(`Tmp #2 didn't end with Tmp #1`);
          },
          async m => { // Tmps linked to end with each other end correctly #2
            let tmp1 = Tmp();
            let tmp2 = Tmp();
            tmp1.endWith(tmp2);
            tmp2.endWith(tmp1);
            tmp2.end();
            if (tmp1.onn()) throw Error(`Tmp #1 didn't end with Tmp #2`);
            if (tmp2.onn()) throw Error(`Tmp #2 still onn after ended`);
          },
          async m => { // Send 0 events correctly
            let src = Src();
            let events = [];
            src.route(val => events.push(val));
            if (events.count() !== 0) throw Error(`Expected exactly 0 events; got ${events.count()}`);
          },
          async m => { // Ensure single undefined value is sent correctly
            let src = Src();
            let events = [];
            src.route(val => events.push(val));
            src.send();
            if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
          },
          async m => { // Send 3 events correctly
            let src = Src();
            let events = [];
            src.route(val => events.push(val));
            for (let v of [ 1, 'hah', 3 ]) src.send(v);
            if (events.count() !== 3) throw Error(`Expected exactly 3 events; got ${events.count()}`);
            if (events[0] !== 1)      throw Error(`Received wrong value @ ind 0; expected 1, got ${events[0]}`);
            if (events[1] !== 'hah')  throw Error(`Received wrong value @ ind 1; expected "hah", got ${events[1]}`);
            if (events[2] !== 3)      throw Error(`Received wrong value @ ind 2; expected 3, got ${events[2]}`);
          },
          async m => { // Disabling route prevents function being called
            let src = Src();
            let events = [];
            let route = src.route(val => events.push(val));
            route.end();
            for (let v of [ 1, 'hah', 3 ]) src.send(v);
            if (events.count() !== 0) throw Error(`Expected 0 results; got ${events.count()}`);
          },
          async m => { // Inactive event sent when function applied before setInactive()
            let tmp = Tmp();
            let gotInactiveEvent = false;
            tmp.route(() => gotInactiveEvent = true);
            tmp.end();
            if (!gotInactiveEvent) throw Error(`No inactive event after setInactive()`);
          },
          async m => { // Inactive event sent when function applied after setInactive() (immediate setInactive)
            let tmp = Tmp();
            tmp.end();
            let gotInactiveEvent = false;
            tmp.route(() => gotInactiveEvent = true);
            if (!gotInactiveEvent) throw Error(`No inactive event after setInactive()`);
          },
          async m => { // Inactive event not sent when removed; function applied before setInactive()
            let tmp = Tmp();
            let gotInactiveEvent = false;
            let runFunctionOnEvent = tmp.route(() => gotInactiveEvent = true);
            runFunctionOnEvent.end();
            tmp.end();
            if (gotInactiveEvent) throw Error(`Invaled inactive event after setInactive()`);
          },
          
          ...[ FnSrc.Prm1, FnSrc.PrmM ].map(FnSrcCls => [
            async m => { // FnSrc fn doesn't run if no child has event
              let srcs = Array.fill(5, () => Src());
              let events = [];
              let fnSrc = FnSrcCls(srcs, (...args) => events.push(args));
              if (events.count() !== 0) throw Error(`Expected exactly 0 events; got ${events.count()}`);
            },
            async m => { // FnSrc fn runs for each child event
              let srcs = Array.fill(5, () => Src());
              let events = [];
              let fnSrc = FnSrcCls(srcs, (...args) => events.push(args));
              
              for (let i = 0; i < 3; i++) srcs[0].send();
              for (let i = 0; i < 6; i++) srcs[1].send();
              for (let i = 0; i < 2; i++) srcs[2].send();
              for (let i = 0; i < 1; i++) srcs[3].send();
              for (let i = 0; i < 9; i++) srcs[4].send();
              
              let exp = 3 + 6 + 2 + 1 + 9;
              if (events.count() !== exp) throw Error(`Expected exactly 0 events; got ${exp.count()}`);
            },
            async m => { // FnSrc sends values as expected
              let srcs = Array.fill(3, () => Src());
              let cnt = 0;
              let events = [];
              let fnSrc = FnSrcCls(srcs, () => cnt++);
              fnSrc.route(val => events.push(val));
              for (let i = 0; i < 5; i++) srcs[0].send('hee');
              for (let i = 0; i < 9; i++) srcs[1].send('haa');
              for (let i = 0; i < 7; i++) srcs[2].send('hoo');
              let exp = 5 + 9 + 7;
              if (events.count() !== exp) throw Error(`Expected exactly ${exp} events; got ${events.count()}`);
            },
            async m => { // FnSrc events have correct values
              
              let src1 = Src();
              let src2 = Src();
              let events = [];
              let last = 0;
              let fnSrc = FnSrcCls([ src1, src2 ], (v1, v2) => { events.push([ v1, v2, last ]); return last++; });
              
              src2.send('src2val1');
              src1.send('src1val1');
              src2.send('src2val2');
              src1.send('src1val2');
              src1.send('src1val3');
              
              if (events.count() !== 5) throw Error(`Expected exactly 5 results; got ${events.count()}`);
              
              [ [ C.skip,     'src2val1', 0 ],
                [ 'src1val1', 'src2val1', 1 ],
                [ 'src1val1', 'src2val2', 2 ],
                [ 'src1val2', 'src2val2', 3 ],
                [ 'src1val3', 'src2val2', 4 ] ]
              .each((vals, ind1) => vals.each((v, ind2) => {
                if (events[ind1][ind2] !== v) throw Error(`events[${ind1}][${ind2}] should be ${v} (got ${events[ind1][ind2]})`);
              }));
              
            },
          ]).flat(Infinity),
          
          async m => { // MemSrc.Tmp1 sends value
            
            let src = MemSrc.Tmp1();
            let sends = [];
            src.route(v => sends.push(v));
            src.retain(Tmp());
            if (sends.count() !== 1) throw Error(`Expected exactly 1 send; got ${sends.count()}`);
            
          },
          async m => { // MemSrc.Tmp1 sends multiple Tmps, one at a time
            
            let src = MemSrc.Tmp1();
            let sends = [];
            src.route(v => sends.push(v));
            src.retain(Tmp());
            src.retain(Tmp());
            if (sends.count() !== 2) throw Error(`Expected exactly 2 sends; got ${sends.count()}`);
            
          },
          
          async m => { // MemSrc.TmpM handles add-route-while-sending edge-case
            
            let src = MemSrc.TmpM();
            let n = 0;
            let fn = () => n++;
            src.route(() => src.route(fn));
            src.retain(Tmp());
            
            if (n !== 1) throw Error(`MemSrc.TmpM breaks under edge-case; expected 1 call to route fn; got ${n}`);
            
          },
          async m => { // MemSrc.Tmp1 handles add-route-while-sending edge-case
            
            let src = MemSrc.Tmp1();
            let n = 0;
            let fn = () => n++;
            src.route(() => src.route(fn));
            src.retain(Tmp());
            
            if (n !== 1) throw Error(`MemSrc.Tmp1 breaks under edge-case; expected 1 call to route fn; got ${n}`);
            
          },
          async m => { // MemSrc.TmpM handles more difficult add-route-while-sending edge-case
            
            let src = MemSrc.TmpM();
            let n = 0;
            let fn = () => n++;
            src.route(() => src.route(() => src.route(fn)));
            src.retain(Tmp());
            
            if (n !== 1) throw Error(`MemSrc.TmpM breaks under edge-case; expected 1 call to route fn; got ${n}`);
            
          },
          async m => { // MemSrc.Tmp1 handles more difficult add-route-while-sending edge-case
            
            let src = MemSrc.Tmp1();
            let n = 0;
            let fn = () => n++;
            src.route(() => src.route(() => src.route(fn)));
            src.retain(Tmp());
            
            if (n !== 1) throw Error(`MemSrc.Tmp1 breaks under edge-case; expected 1 call to route fn; got ${n}`);
            
          },
          
          async m => { // FnSrc.Prm1 only sends once, for multiple src sends, if value is always the same
            
            let srcs = Array.fill(3, () => Src());
            let fnSrc = FnSrc.Prm1(srcs, (...args) => 'haha');
            let events = [];
            fnSrc.route(v => events.push(v));
            
            for (let i = 0; i < 20; i++) srcs[0].send('yo');
            for (let i = 0; i < 35; i++) srcs[1].send('ha');
            for (let i = 0; i < 60; i++) srcs[2].send('hi');
            
            if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
            
          },
          async m => { // FnSrc.Prm1 gets MemSrc.Prm1 vals as expected
            
            let srcs = Array.fill(3, () => MemSrc.Prm1('a'));
            let fnSrc = FnSrc.Prm1(srcs, (s1, s2, s3) => [ s1, s2, s3 ]);
            let results = [];
            fnSrc.route(v => results.push(v));
            
            srcs[1].retain('b');
            srcs[1].retain('a');
            srcs[1].retain('b');
            srcs[2].retain('b');
            srcs[2].retain('b'); // Should be ignored!
            srcs[1].retain('b'); // Should be ignored!
            srcs[0].retain('a'); // Should be ignored!
            srcs[0].retain('b');
            srcs[1].retain('a');
            
            let expected = [
              [ 'a', 'a', 'a' ],
              [ 'a', 'b', 'a' ],
              [ 'a', 'a', 'a' ],
              [ 'a', 'b', 'a' ],
              [ 'a', 'b', 'b' ],
              [ 'b', 'b', 'b' ],
              [ 'b', 'a', 'b' ]
            ];
            if (expected.count() !== results.count()) throw Error(`Expected exactly ${expected.count()} results; got ${results.count()}`);
            expected.each(([ e1, e2, e3 ], i) => {
              
              let [ r1, r2, r3 ] = results[i];
              if (e1 !== r1 || e2 !== r2 || e3 !== r3) throw Error(`Mismatch on row ${i}; expected [ ${e1}, ${e2}, ${e3} ]; got [ ${r1}, ${r2}, ${r3} ]`);
              
            });
            
          },
          async m => { // FnSrc.Prm1 gets Chooser vals as expected
            
            let choosers = Array.fill(3, () => Chooser([ 'a', 'b' ]));
            let fnSrc = FnSrc.Prm1(choosers, (s1, s2, s3) => [ s1, s2, s3 ]);
            let results = [];
            fnSrc.route(v => results.push(v));
            
            choosers[1].choose('b');
            choosers[1].choose('a');
            choosers[1].choose('b');
            choosers[2].choose('b');
            choosers[2].choose('b'); // Should be ignored!
            choosers[1].choose('b'); // Should be ignored!
            choosers[0].choose('a'); // Should be ignored!
            choosers[0].choose('b');
            choosers[1].choose('a');
            
            let expected = [
              [ 'a', 'a', 'a' ],
              [ 'a', 'b', 'a' ],
              [ 'a', 'a', 'a' ],
              [ 'a', 'b', 'a' ],
              [ 'a', 'b', 'b' ],
              [ 'b', 'b', 'b' ],
              [ 'b', 'a', 'b' ]
            ];
            if (expected.count() !== results.count()) throw Error(`Expected exactly ${expected.count()} results; got ${results.count()}`);
            expected.each(([ e1, e2, e3 ], i) => {
              
              let [ r1, r2, r3 ] = results[i];
              if (e1 !== r1 || e2 !== r2 || e3 !== r3) throw Error(`Mismatch on row ${i}; expected [ ${e1}, ${e2}, ${e3} ]; got [ ${r1}, ${r2}, ${r3} ]`);
              
            });
            
          },
          async m => { // FnSrc.Tmp1 only sends once, for multiple src sends, if value is always the same Tmp
            
            let srcs = Array.fill(3, () => Src());
            let tmppp = Tmp();
            let fnSrc = FnSrc.Tmp1(srcs, (v1, v2, v3, tmp=tmppp) => tmp);
            let events = [];
            fnSrc.route(v => events.push(v));
            
            for (let i = 0; i < 20; i++) srcs[0].send('yo');
            for (let i = 0; i < 35; i++) srcs[1].send('ha');
            for (let i = 0; i < 60; i++) srcs[2].send('hi');
            
            if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
            if (events[0] !== tmppp) throw Error(`Single send had unexpected value`);
            
          },
          async m => { // FnSrc.Tmp1 Tmp value ends when FnSrc ends
            
            let src = Src();
            let tmppp = Tmp();
            let fnSrc = FnSrc.Tmp1([ src ], (v, tmp=tmppp) => tmp);
            src.send('whee');
            
            if (tmppp.off()) throw Error(`Tmp ended too early`);
            fnSrc.end();
            if (tmppp.onn()) throw Error(`Tmp didn't end with FnSrc`);
            
          },
          async m => { // FnSrc.Tmp1 sending ends any previous Tmp sent by same FnSrc
            
            let srcs = [ Src(), Src() ];
            let tmps = [ Tmp(), Tmp(), Tmp() ];
            let fnSrc = FnSrc.Tmp1(srcs, v1 => (v1 !== null) ? tmps[v1] : null);
            
            srcs[0].send(1);
            if (tmps[1].off()) throw Error(`Tmp ended too early`);
            
            srcs[0].send(0);
            if (tmps[1].onn()) throw Error(`Tmp didn't end`);
            if (tmps[0].off()) throw Error(`Tmp ended too early`);
            
            srcs[0].send(2);
            if (tmps[0].onn()) throw Error(`Tmp didn't end`);
            if (tmps[2].off()) throw Error(`Tmp ended too early`);
            
            srcs[0].send(null);
            if (tmps[2].onn()) throw Error(`Tmp didn't end`);
            
          },
          
          async m => { // Scope basics
            
            let src1 = Src();
            let tmpsGot = [];
            let scp = Scope(src1, (tmp1, dep) => {
              tmpsGot.push(tmp1);
              dep.scp(tmp1.src1, (tmp11, dep) => tmpsGot.push(tmp11));
              dep.scp(tmp1.src2, (tmp12, dep) => tmpsGot.push(tmp12));
            });
            
            let tmpsSent = [];
            for (let i = 0; i < 2; i++) {
              let tmp1 = Tmp();
              tmp1.src1 = Src();
              tmp1.src2 = Src();
              
              tmpsSent.push(tmp1); src1.send(tmp1);
              
              let tmp11 = Tmp(), tmp12 = Tmp();
              
              tmpsSent.push(tmp11); tmp1.src1.send(tmp11);
              tmpsSent.push(tmp12); tmp1.src2.send(tmp12);
            }
            
            if (tmpsSent.count() !== tmpsGot.count()) throw Error(`Sent ${tmpsSent.count} Tmps, but got ${tmpsGot.count()}`);
            for (let i = 0; i < tmpsSent.count(); i++)
              if (tmpsSent[i] !== tmpsGot[i]) throw Error(`Tmps arrived out of order`);
            
          },
          async m => { // Deps end when Scope ends
            
            let depTmps = []
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              depTmps = Array.fill(5, () => dep(Tmp()));
            });
            src.send(Tmp());
            scp.end();
            
            if (depTmps.count() !== 5) throw Error(`Scope never ran`);
            if (depTmps.find(tmp => !U.isForm(tmp, Tmp)).found) throw Error(`Not all sends resulted in Tmps`);
            if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when Scope ended`);
            
          },
          async m => { // Deps end when parent Scope ends
            
            let depTmps = [];
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              dep.scp(tmp.src, (tmp, dep) => depTmps = Array.fill(5, () => dep(Tmp())));
            });
            let tmp = Tmp();
            tmp.src = Src();
            src.send(tmp);
            tmp.src.send(Tmp());
            scp.end();
            
            if (depTmps.count() !== 5) throw Error(`Scope never ran`);
            if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when parent Scope ended`);
            
          },
          async m => { // Deps end when Tmp ends, multi, one at a time
            
            let depTmps = [];
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              depTmps = Array.fill(5, () => dep(Tmp()));
            });
            
            for (let i = 0; i < 5; i++) {
              let tmp = Tmp();
              src.send(tmp);
              if (depTmps.count() !== 5) throw Error(`Scope never ran`);
              if (depTmps.find(tmp => tmp.off()).found) throw Error(`Dep ended too early`);
              tmp.end();
              if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when Tmp ended`);
            }
            
          },
          async m => { // Deps end when Tmp ends, multi, all at once
            
            let depTmpsArr = [];
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              depTmpsArr.push(Array.fill(5, () => dep(Tmp())));
            });
            
            let tmps = Array.fill(5, () => { let tmp = Tmp(); src.send(tmp); return tmp; });
            if (depTmpsArr.count() !== 5) throw Error('What??');
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.count() !== 5) throw Error(`Scope never ran`);
              if (depTmps.find(tmp => tmp.off()).found) throw Error(`Dep ended too early`);
            }
            
            for (let tmp of tmps) tmp.end();
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when Tmp ended`);
            }
            
          },
          async m => { // Deps end when Scope ends, multi, all at once
            
            let depTmpsArr = [];
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              depTmpsArr.push(Array.fill(5, () => dep(Tmp())));
            });
            
            let tmps = Array.fill(5, () => { let tmp = Tmp(); src.send(tmp); return tmp; });
            if (depTmpsArr.count() !== 5) throw Error('What??');
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.count() !== 5) throw Error(`Scope never ran`);
              if (depTmps.find(tmp => tmp.off()).found) throw Error(`Dep ended too early`);
            }
            
            scp.end();
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when Tmp ended`);
            }
            
          },
          async m => { // Deps end when nested Scope ends, multi, all at once
            
            let depTmpsArr = [];
            let src = Src();
            let scp = Scope(src, (tmp, dep) => {
              dep.scp(tmp.src, (tmp, dep) => {
                depTmpsArr.push(Array.fill(5, () => dep(Tmp())));
              });
            });
            
            let tmps = Array.fill(5, () => {
              let tmp = Tmp();
              tmp.src = Src();
              src.send(tmp);
              tmp.src.send(Tmp());
              return tmp;
            });
            if (depTmpsArr.count() !== 5) throw Error('What??');
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.count() !== 5) throw Error(`Scope never ran`);
              if (depTmps.find(tmp => tmp.off()).found) throw Error(`Dep ended too early`);
            }
            
            scp.end();
            
            for (let depTmps of depTmpsArr) {
              if (depTmps.find(tmp => tmp.onn()).found) throw Error(`Not all Deps ended when Tmp ended`);
            }
            
          }
          
        ];
        for (let test of tests) await U.safe(test, err => {
          let name = (test.toString().match(/[/][/](.*)\n/) || { 1: '<unnamed>' })[1].trim();
          console.log(`Test FAIL (${name}):\n${this.formatError(err)}`);
          this.halt();
        });
        
      })();
      
    },
    getPlatform: function() { return { name:  'nodejs' }; },
    ready: function() { return this.canSettlePrm; },
    halt: function() { process.exit(0); },
    installRoom: async function(name, bearing='above') {
      
      let pcs = name.split('.');
      let keep = this.seek('keep', 'adminFileSystem', [ 'room', ...pcs, `${pcs.slice(-1)[0]}.js` ]);
      
      let contents = await keep.getContent('utf8');
      if (!contents) throw Error(`Invalid room name: "${name}"`);
      let { lines, offsets } = await this.compileContent(bearing, contents);
      
      return {
        debug: { offsets },
        content: (async () => {
          
          // Write, `require`, and ensure file populates `global.rooms`
          await this.seek('keep', 'adminFileSystem', [ 'mill', 'compiled', `${name}@${bearing}.js` ]).setContent(lines.join('\n'));
          require(`../mill/compiled/${name}@${bearing}.js`);
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
      if (U.isForm(srcLines, String)) srcLines = srcLines.split('\n');
      if (!U.isForm(srcLines, Array)) throw Error(`Param "srcLines" is invalid type: ${U.getFormName(srcLines)}`);
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
        
        if (!curBlock && nextBlockInd < blocks.length && blocks[nextBlockInd].start === i)
          curBlock = blocks[nextBlockInd++];
        
        let keepLine = true;
        if (!line) keepLine = false; // Remove blank lines
        if (line.hasHead('//')) keepLine = false; // Remove comments
        if (curBlock && i === curBlock.startInd) keepLine = false;
        if (curBlock && i === curBlock.endInd) keepLine = false;
        if (curBlock && !variantDef[curBlock.type]) keepLine = false;
        
        if (keepLine) {
          
          curOffset = null;
          let [ lineNoComment=line ] = (line.match(Form.removeCommentRegex) || []).slice(1);
          filteredLines.push(lineNoComment.trim());
          
        } else {
          
          if (!curOffset) offsets.push(curOffset = { at: i, offset: 0 });
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
        let certFolder = this.seek('keep', 'adminFileSystem', [ 'mill', 'cert' ]);
        let { cert, key, selfSign } = await Promise.allObj({
          cert:     certFolder.seek('server.cert').getContent(),
          key:      certFolder.seek('server.key').getContent(),
          selfSign: certFolder.seek('localhost.cert').getContent()
        });
        sslArgs = { keyPair: { cert, key }, selfSign };
      }
      
      options.uid = 'nodejs.root';
      options.hosting.gain({ host, port: parseInt(port, 10), sslArgs });
      
      return forms.Foundation.createHut.call(this, options);
      
    },
    createKeep: function(options={}) { return Form.KeepNodejs(); },
    createReal: async function(options={}) {
      
      let primaryFakeReal = Real({ name: 'nodejs.fakeReal' });
      primaryFakeReal.techNode = null;
      primaryFakeReal.tech = {
        createTechNode: real => null,
        render: (real, techNode) => {},
        addNode: (parTechNode, kidTechNode) => {},
        
        addViewportEntryChecker: real => { let ret = Tmp(); ret.src = Src(); return ret; },
        
        setText: (real, text) => {},
        addInput: real => { let ret = Tmp(); ret.src = Src(); return ret; },
        addPress: real => { let ret = Tmp(); ret.src = Src(); return ret; },
        addFeel: real => { let ret = Tmp(); ret.src = Src(); return ret; }
      };
      
      return {
        access: name => {
          if (name === 'primary') return primaryFakeReal;
          throw Error(`Invalid access for Real -> "${name}"`);
        }
      };
      
    },
    
    // Errors
    parseErrorLine: function(line) {
      
      // The codepoint filename must not contain round/square brackets or spaces
      let [ path, lineInd, charInd ] = line.match(/([^()[\] ]+):([0-9]+):([0-9]+)/).slice(1);
      let [ fileName ] = path.match(/([a-zA-Z0-9.@]*)$/);
      
      // Skip non-hut files
      let fileNamePcs = Form.KeepFileSystem.fs.cmpsToFileUrl([ path ]);
      if (!fileNamePcs.hasHead(this.fsKeep.getFileUrl())) throw Error(`Path "${path}" isn't relevant to error`);
      
      // Extract room name and bearing from filename
      let [ roomName,, bearing=null ] = fileName.match(/^([a-zA-Z0-9.]*)(@([a-zA-Z]*))?[.]js/).slice(1);
      //let [ roomName, bearing=null ] = fileName.split('@').slice(0, -1);
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
        : [ 'room', name, `${name}@${bearing}.js` ];
      let srcContent = await this.seek('keep', 'adminFileSystem', fp).getContent('utf8');
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
      let sendData = async (req=null, res, msg) => {
        
        if (msg === C.skip) return;
        let httpCode = 200;
        if (U.hasForm(msg, Error)) [ httpCode, msg ] = [ 400, { command: 'error', msg: msg.message } ];
        
        if (U.hasForm(msg, Keep)) { // File!
          
          let [ ct, cl ] = await Promise.allArr([ msg.getContentType(), msg.getContentByteLength() ]);
          res.writeHead(httpCode, {
            'Content-Type': ct || 'application/octet-stream',
            ...(cl ? { 'Content-Length': cl } : {})
          });
          (await msg.getPipe()).pipe(res);
          
        } else if (msg === null || U.isForm(msg, Object, Array)) { // Json!
          
          msg = JSON.stringify(msg);
          res.writeHead(httpCode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(msg) });
          res.end(msg);
          
        } else {
          
          msg = msg.toString();
          let accept = ({ req }).seek([ 'req', 'headers', 'accept' ]).val || '*/*';
          let [ t1='*', t2='*' ] = accept.split(/[,;]/)[0].split('/');
          let ct = (t1 !== '*' && t2 !== '*') ? `${t1}/${t2}` : 'application/octet-stream';
          res.writeHead(httpCode, { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(msg) });
          res.end(msg);
          
        }
        
      };
      let serverFn = async (req, res) => {
        
        let ms = this.getMs();
        
        // Stream the body
        // TODO: Watch for exploits - slow loris, etc.
        let chunks = [];
        req.setEncoding('utf8');
        req.on('data', chunk => chunks.push(chunk));
        let body = await Promise((resolve, reject) => {
          req.on('end', () => resolve(chunks.join('')));
          req.on('error', err => reject(Error(`Client abandoned http request (err.message)`)));
        });
        
        // TODO: Depending on how the handshake works it may be possible
        // for `res` to end at absolutely any moment. While receiving
        // chunks these errors will be handled nicely, since for errors
        // occuring early on event cleanup is extremely straightforward.
        // But `res` can end at any time (or can it??), including when
        // it's queued up in a list of longpolls. That could be really
        // awkward, since a critical sync could be transferred using an
        // invalid `res` request, leaving the client with a sync gap for
        // an indefinite amount of time. Any `res` object which becomes
        // invalid needs to be taken out of the queue of polls! And if I
        // think about this more it may turn out that any client whose
        // `res` goes invalid may need to sync-from-scratch...
        
        // `body` is either JSON or the empty string (TODO: For now!)
        try {
          body = body.length ? JSON.parse(body) : {};
          if (!U.isForm(body, Object)) throw Error(`Http body should be Object; got ${U.getFormName(body)}`);
        } catch(err) { return res.writeHead(400).end(); }
        
        let { path: urlPath, query } = this.parseUrl(`http://${req.headers.host}${req.url}`);
        let { hutId=null, ...params } = { ...body, ...query }; // Params are initially based on body and query
        
        // Detect "command" from `urlPath` if none given explicitly
        if (!params.has('command')) params = (p => {
          // Map typical http requests to their meaning within Hut
          if (p === '/') return { command: 'syncInit', ...params, reply: '1' };
          if (p === '/favicon.ico') return { command: 'getIcon', ...params, reply: '2' };
          if (urlPath.length > 1) return { command: urlPath.slice(1), ...params, reply: '1' };
          return {};
        })(urlPath);
        
        // Error response for invalid params
        if (!params.has('command')) return res.writeHead(400).end();
        
        // Get the Road used. An absence of any such Road indicates that
        // authentication failed - in this case redirect the user to a
        // spot where they can request a new identity
        let road = (params.reply !== '2')
          ? this.getHutRoadForQuery(server, pool, hutId)
          : { knownHosts: Set.stub, hear: { send: async ([ msg, reply, ms ]) => {
              let hut = await this.getRootHut();
              let tempSrcHut = { isAfar: Function.stub, refreshDryTimeout: Function.stub, roadSrcs: Set.stub };
              hut.hear(tempSrcHut, null, reply, msg, ms);
            }}};
              
        if (!road) return res.writeHead(302, { 'Location': '/' }).end();
        
        // Note that we've seen this Hut under this host
        road.knownHosts.add(req.connection.remoteAddress);
        
        // Determine the actions that need to happen at various levels for this command
        let comTypesMap = {
          // syncInit has effects at both transport- and hut-level
          syncInit:  { hut: true, transport: road => {
            // Clear any buffered responses and tells
            road.waitResps.forEach(res => res.end());
            road.waitResps = [];
            road.waitTells = [];
          }},
          close: { hut: false, transport: road => road.end() },
          bankPoll: { hut: false, transport: road => { /* empty transport-level action */ } }
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
        // 1. { command: 'login', reply: false } is heard
        // 2. { command: 'getRealDomFavicon', reply: true } is heard
        // 3. The `hut.tell` for #1 occurs - how to avoid the server
        //    thinking that tell is the response for { reply: true }??
        
        // Synced requests end here - `road.tell` MUST occur or the
        // request will hang indefinitely
        // TODO: Consider a timeout to deal with improper usage
        if (params.reply) {
          try {
            return road.hear.send([ params, msg => sendData(req, res, msg), ms ]);
          } catch(err) {
            sendData(req, res, {
              command: 'error', type: 'unexpectedError',
              msg: 'Error is on our end! We extend four quintillion apologies, dear sweet user!',
              orig: params
            });
          }
        }
        
        // Run hut-level actions
        if (comTypes.hut) road.hear.send([ params, null, ms ]);
        
        // We now have an unspent, generic-purpose poll available. If we
        // have tells then send the oldest, otherwise hold the response.
        // Finally return all but one poll. TODO: Could we learn from
        // the client how many polls we are allowed to hold at once??
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
          while (U.isForm(road.waitTells[bundleSize], Object, Array)) bundleSize++; // TODO: This isn't working - waitTells[ind] is always a STRING!! :(
          
          if (bundleSize <= 1) {
            
            // Either a leading contiguous string of 1 json Tell, or the
            // 1st Tell is non-json.
            // Send the single, unbundled Tell
            sendData(req, res, road.waitTells.shift());
            
          } else {
            
            // Send `bundleSize` bundled json Tells!
            sendData(req, res, {
              command: 'multi',
              list: road.waitTells.slice(0, bundleSize)
            });
            road.waitTells = road.waitTells.slice(bundleSize);
            
          }
          
        }
        
        // Bank only a single response (otherwise most clients hang)
        while (road.waitResps.length > 1) sendData(req, road.waitResps.shift(), { command: 'fizzle' });
        
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
      
      // Return the Server as a Tmp which ends with the native server
      let server = Tmp(() => httpServer.close());
      
      server.desc = `HTTP @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.knownHosts = Set();
        road.waitResps = [];
        road.waitTells = [];
        road.hear = Src();
        road.tell = msg => road.waitResps.length
          ? sendData(null, road.waitResps.shift(), msg)
          : road.waitTells.push(msg);
        
        road.endWith(() => road.waitResps.each(res => res.end()));
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
        while (upgradeReq === null) { // TODO: Limit iterations? Timeouts? Max size of `buffer`?
          upgradeReq = await Promise(resolve => sokt.once('readable', () => {
            let newBuffer = sokt.read();
            if (!newBuffer || !newBuffer.length) return resolve(null);
            soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
            resolve(Form.parseSoktUpgradeRequest(soktState));
          }));
        }
        
        if (!upgradeReq.headers.has('sec-websocket-key')) return sokt.end();
        
        // Now we have the headers - send upgrade response
        soktState.status = 'upgrading';
        let hash = require('crypto').createHash('sha1');
        hash.end(`${upgradeReq.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
        
        sokt.write([ // This is fire-and-forget
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${hash.read().toString('base64')}`,
          '\r\n'
        ].join('\r\n'));
        
        let { query } = this.parseUrl(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${upgradeReq.path}`);
        let road = this.getHutRoadForQuery(server, pool, query.seek('hutId').val, road => road.sokt = sokt);
        if (!road) return sokt.end();
        
        soktState.status = 'ready';
        sokt.on('readable', () => {
          if (road.off()) return;
          let ms = this.getMs();
          let newBuffer = sokt.read();
          
          if (!newBuffer || !newBuffer.length) return;
          soktState.buffer = Buffer.concat([ soktState.buffer, newBuffer ]);
          
          try {
            for (let message of Form.parseSoktMessages(soktState)) road.hear.send([ message, null, ms ]);
          } catch(err) { sokt.emit('error', err); }
          
          if (soktState.status === 'ended') road.end();
        });
        sokt.on('close', () => { soktState = makeSoktState('ended'); road.end(); });
        sokt.on('error', () => { soktState = makeSoktState('ended'); road.end(); });
        
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
      
      let server = Tmp(() => soktServer.close());
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Src();
        road.tell = msg => {
          if (msg === C.skip) return;
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
        
        road.endWith(() => road.sokt.end());
        road.currentCost = () => 0.5;
      };
      
      return server;
    }
    
  })});
  
  U.setup.gain({ FoundationNodejs });
  
})();
