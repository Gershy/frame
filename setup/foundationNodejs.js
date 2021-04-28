(() => {
  
  // TODO: For `res.writeHead(...)`, consider Keep-Alive
  // e.g. 'Keep-Alive: timeout=5, max=100'
  
  let { Tmp, Src, MemSrc, FnSrc, Chooser, Scope, Range } = U.logic;
  
  let { Foundation, Real, Keep } = U.setup;
  let nativeLibs = {};
  let native = name => {
    if (!nativeLibs.has(name)) nativeLibs[name] = require(name);
    return nativeLibs[name];
  };
  
  let FoundationNodejs = U.form({ name: 'FoundationNodejs', has: { Foundation }, props: (forms, Form) => ({
    
    $KeepNodejs: U.form({ name: 'KeepNodejs', has: { Keep }, props: forms => ({
      init: function() {
        forms.Keep.init.call(this);
        
        let fileSystemKeep = Form.KeepFileSystem({ secure: true, blacklist: Set([ '.git', '.gitignore', 'mill' ]) });
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
      init: function(sourceKeep) {
        this.sourceKeep = sourceKeep;
        this.hut = null;
      },
      
      // TODO: Instead of having a single KeepStatic linked to a single
      // hut should consider `access`ing a new "KeepStaticHut" instance
      // via a Hut seek parameter. `KeepStatic` could track all existing
      // instances of "KeepStaticHut" to avoid creating multiple
      // instances for the same Hut. KeepStaticHut could inherit from
      // Tmp as well as Keep to facilitate it ending when its Hut ends.
      // And would need to clean up the mapped entry in `KeepStatic` if
      // the "KeepStaticHut" ends.
      // Could even support multiple "access" param types. For example:
      //    |   hut.access('static', [ 'room', 'testy', 'asset', 'testy.jpg' ]);
      // retrieves a Keep available to any client, whereas:
      //    |   hut.access('static', instanceOfHut);
      // retrieves a more specialized Keep for accessing content only
      // available to a particular Hut instance
      setHut: function(hut) { this.hut = hut; },
      access: function(fpCmps) {
        
        let key = [ 'static', ...fpCmps ].join('/');
        if (!this.hut.roadSrcs.has(key)) {
          // Make Keep available Below
          this.hut.roadSrc(key).route(async ({ reply }) => reply(this.sourceKeep.seek(fpCmps)));
        }
        return this.sourceKeep.seek(fpCmps);
        
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
          return Promise((rsv, rjc) => fs.readdir(path.join(...cmps), ...opts, (err0, children) => rsv(err0 ? null : children)));
        },
        addFolder: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.mkdir(path.join(...cmps), ...opts, err0 => {
            if (err0 && err0.code === 'EEXIST') err0 = null; // EEXIST means already created! We're good!
            if (err0) rjc(err.update(err0.message));
            else      rsv(null);
          }));
        },
        remFolder: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.rmdir(path.join(...cmps), ...opts, err0 => {
            if (err0 && err0.code === 'ENOENT') err0 = null; // ENOENT means already deleted! Mission accomplished!
            if (err0) { err.rjc(err.update(err0.message)); }
            else      { rsv(null); }
          }));
        },
        getLetter: async (cmps, ...opts) => {
          let err = Error('');
          return Promise((rsv, rjc) => fs.readFile(path.join(...cmps), ...opts, (err0, content) => err0 ? rjc(err.update(err0.message)) : rsv(content)));
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
        getPipe: (cmps, ...opts) => fs.createReadStream(path.join(...cmps), ...opts)
        
      }))(native('path'), native('fs')),
      $HoneyPotKeep: U.form({ name: 'HoneyPotKeep', has: { Keep }, props: (forms, Form) => ({
        init: function(data=[ 'passwords', 'keys', 'tokens', 'secrets', 'credentials', 'bitcoin', 'wallet', 'honey' ]) { this.data = data; },
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
          
          // Simply try to write
          try { return await Form.fs.setLetter(this.absPath, content, ...opts); } catch(err) {}
          
          // Count how many parent folders are missing
          let folderCmps = this.absPath.slice(0, -1);
          let numMissingDirs = 1;
          while (!await Form.fs.getMeta(folderCmps.slice(0, -numMissingDirs))) numMissingDirs++;
          
          // Create `numMissingDirs` folders
          for (let n = 0; n < numMissingDirs; n++)
            await Form.fs.addFolder(this.absPath.slice(0, n - numMissingDirs));
          
          // Write content into file - more likely to work!
          await Form.fs.setLetter(this.absPath, content, ...opts);
          
        } else if (content === null && fsType === 'folder') {
          
          let items = await this.getContent();
          
          // Set content of all items to `null`
          if (items) await Promise.allArr(items.map(item => this.access(item).setContent(null, { remAncestry: false })));
            
          // Now there are no children; delete folder and ancestry
          await Form.fs.remFolder(this.absPath);
          
          let [ { remAncestry=true }={} ] = opts;
          await this.remNullAncestry();
          
        } else if (content === null && fsType === 'letter') {
          
          await Form.fs.remLetter(this.absPath);
          
          let [ { remAncestry=true }={} ] = opts;
          if (remAncestry) await this.remNullAncestry();
          
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
        if (fsType === 'folder') {
          return native('stream').Readable.from(JSON.stringify(await this.getContent()));
        }
        return null;
        
      },
      desc: function() { return `${U.getFormName(this)}: ${this.absPath.join('/')}`; }
      
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
      let buff = soktState.buff;
      while (buff.length >= 2) {
        
        // ==== PARSE FRAME
        
        let b = buff[0] >> 4;   // The low 4 bits of 1st byte give us flags (importantly "final")
        if (b % 8) throw Error('Some reserved bits are on'); // % gets us low-end bits
        let isFinalFrame = b === 8;
        
        let op = buff[0] % 16;  // The 4 high bits of 1st byte give us the operation
        if (op < 0 || (op > 2 && op < 8) || op > 10) throw Error(`Invalid op: ${op}`);
        
        if (op >= 8 && !isFinalFrame) throw Error('Incomplete control frame');
        
        b = buff[1];            // Look at second byte
        let masked = b >> 7;    // Lowest bit of 2nd byte - states whether frame is masked
        
        // Server requires a mask; Client requires no mask
        if (!masked) throw Error('No mask');
        
        let length = b % 128;
        let offset = 6; // Masked frames have an extra 4 halfwords containing the mask
        
        if (buff.length < offset + length) return []; // No messages - should await more data
        
        if (length === 126) {         // Websocket's "medium-size" frame format
          length = buff.readUInt16BE(2);
          offset += 2;
        } else if (length === 127) {  // Websocket's "large-size" frame format
          length = buff.readUInt32BE(2) * U.int32 + buff.readUInt32BE(6);
          offset += 8;
        }
        
        if (buff.length < offset + length) return []; // No messages - should await more data
        
        // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
        let mask = buff.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
        let data = buff.slice(offset, offset + length); // After the mask comes the data
        let w = 0;
        for (let i = 0, len = data.length; i < len; i++) {
          data[i] ^= mask[w];     // Apply XOR
          w = w < 3 ? w + 1 : 0;  // `w` follows `i`, but wraps every 4. Faster than `%`
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
        
        buff = buff.slice(offset + length); // Dispense with the frame we've just processed
        soktState.curOp = 1;                // Our only supported op is "text"
        soktState.curFrames.push(data);     // Include the complete frame
        
        if (isFinalFrame) {
          let fullStr = Buffer.concat(soktState.curFrames).toString('utf8');
          messages.push(JSON.parse(fullStr));
          soktState.curOp = null;
          soktState.curFrames = [];
        }
      }
      soktState.buff = buff; // Set remaining buff
      return messages;
    },
    $parseSoktUpgradeRequest: soktState => {
      
      let buff = soktState.buff;
      if (buff.length < 4) return null;
      
      // Can't search backwards; the 1st \r\n\r\n sequence found would
      // not necessarily belong to the nextmost message
      let packetEndInd = null;
      for (let i = 0, len = buff.length - 4; i <= len; i++) {
        // TODO: We could be smart enough to jump more than 1 byte at a time in some cases
        // E.g. if the first byte doesn't match we increment by 1, but if the second
        // byte doesn't match we can increment by 2. Watch out for the repetition of the
        // same byte in the "needle" (as opposed to haystack)
        if (buff[i] === 13 && buff[i + 1] === 10 && buff[i + 2] === 13 && buff[i + 3] === 10) { packetEndInd = i; break; }
      }
      if (packetEndInd === null) return null;
      
      let packet = buff.slice(0, packetEndInd).toString('utf8');
      
      // Do an http upgrade operation
      let [ methodLine, ...lines ] = packet.replace(/\\r/g, '').split('\n'); // TODO: I think line-endings will always be \r\n
      let [ method, path, httpVersion ] = methodLine.split(' ').map(v => v.trim());
      
      // Parse headers
      let headers = {};
      for (let line of lines) {
        let [ head, ...tail ] = line.split(':');
        headers[head.trim().lower()] = tail.join(':').trim();
      }
      
      soktState.buff = buff.slice(packetEndInd + 4);
      
      return { method, path, httpVersion, headers };
      
    },
    $removeLineCommentRegex: /^(([^'"`]|'[^']*'|"[^"]*"|`[^`]*`)*)[/][/]/,
    
    // Initialization
    init: function(...args) {
      
      forms.Foundation.init.call(this, ...args);
      
      this.bearing = 'above';
      this.fsKeep = this.seek('keep', 'adminFileSystem');
      this.compilationData = {};
      
      this.usage0 = process.memoryUsage().map(v => v);
      
      // Create a Promise describing whether the Nodejs environment is
      // sufficiently initialized to settle a Room
      this.canSettlePrm = (async () => {
        
        await this.fsKeep.seek([ 'mill', 'compiled' ]).setContent(null);
        
        let argsKeep = this.getArg('argsKeep');
        if (argsKeep) {
          
          let content = await U.safe(async () => eval(`(${await argsKeep.getContent()})`), () => null);
          if (!U.isForm(content, Object)) throw Error(`Specified bad arg keep: ${argsKeep.absPath.join('/')}`);
          this.readyArgs = {};
          this.origArgs = {
            ...content,
            ...this.origArgs,
            debug: [
              ...this.argProcessors.debug(this.origArgs.debug, this),
              ...this.argProcessors.debug(content.debug, this)
            ]
          };
          if (this.getArg('debug').has('arg')) console.log(`Loading additional args from ${argsKeep.absPath.join('/')}`);
          
        }
        
        let tests = [
          
          async m => { // Number.prototype.toArr
            let arr = (10).toArr(v => v);
            if (!U.isForm(arr, Array)) throw Error(`Expected Array; got ${U.getFormName(arr)}`);
            if (arr.count() !== 10) throw Error(`Expected exactly 10 items; got ${arr.count()}`);
            
            for (let i = 0; i < arr.count(); i++) {
              if (arr[i] !== i) throw Error(`Expected ${i} at position ${i}; got ${arr[i]}`);
            }
          },
          
          async m => { // String.prototype.cut
            
            let tests = [
              [ () => 'abc,def,ghi'       .cut(','),          [ 'abc', 'def', 'ghi' ] ],
              [ () => 'abc,def,ghi'       .cut(',', 1),       [ 'abc', 'def,ghi' ] ],
              [ () => 'a,def,ghi'         .cut(',', 1),       [ 'a', 'def,ghi' ] ],
              [ () => 'abc,d,efgh,ij'     .cut(',', 2),       [ 'abc', 'd', 'efgh,ij' ] ],
              [ () => 'abc,,d,,efgh,,ij'  .cut(',,', 2),      [ 'abc', 'd', 'efgh,,ij' ] ],
              [ () => ',,,'               .cut(',,'),         [ '', ',' ] ],
              [ () => ',,,'               .cut(','),          [ '', '', '', '' ] ],
              [ () => 'a,,,'              .cut(','),          [ 'a', '', '', '' ] ],
              [ () => ',a,,'              .cut(','),          [ '', 'a', '', '' ] ],
              [ () => ',,,a'              .cut(','),          [ '', '', '', 'a' ] ],
              [ () => ',,,a'              .cut(',', 1),       [ '', ',,a' ] ],
              [ () => ',,,a'              .cut(',', 2),       [ '', '', ',a' ] ],
              [ () => ','                 .cut(',', 0),       [ ',' ] ],
              [ () => ','                 .cut(',', 1),       [ '', '' ] ],
              [ () => ','                 .cut(',,'),         [ ',' ] ],
              [ () => ''                  .cut(',', 0),       [ '' ] ],
              [ () => ''                  .cut(',', 1),       [ '' ] ],
              [ () => 'a,b,c'             .cut(',', 0),       [ 'a,b,c' ] ]
            ];
            
            for (let [ fn, exp ] of tests) {
              
              let c = fn();
              let valid = true
                && c.length === exp.length
                && !c.find((v, i) => v !== exp[i]).found;
              
              if (!valid) {
                let fnStr = fn.toString().replace(/ *[.]cut/, '.cut');
                throw Error(`${fnStr} gave ${JSON.stringify(c)}; expected ${JSON.stringify(exp)}`);
              }
              
            }
            
          },
          
          async m => { // Promise.allObj
            let prms = {
              thing1: 'hi',
              thing2: Promise(r => setTimeout(() => r('ha'), 0)),
              thing3: 'yo',
              thing4: Promise(r => this.queueTask(() => r('69')))
            };
            let { thing1, thing2, thing3, thing4, ...more } = await Promise.allObj(prms);
            
            if (thing1 !== 'hi') throw Error(`Invalid "thing1"`);
            if (thing2 !== 'ha') throw Error(`Invalid "thing3"`);
            if (thing3 !== 'yo') throw Error(`Invalid "thing2"`);
            if (thing4 !== '69') throw Error(`Invalid "thing4"`);
            if (!more.isEmpty()) throw Error(`allObj resulted in unexpected values`);
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
          async m => { // Tmps with references end appropriately #1
            
            // TODO: Think about referenced Tmps + U.logic classes
            // that manage their underlying Tmps; e.g. FnSrc.Tmp1 ends
            // every Tmp when a new one arrives
            
            let tmp = Tmp();
            tmp.ref();
            tmp.end();
            if (tmp.onn()) throw Error(`Tmp was referenced then ended, but was onn`);
            
          },
          async m => { // Tmps with references end appropriately #2
            
            let tmp = Tmp();
            tmp.ref();
            tmp.ref();
            tmp.end();
            if (tmp.off()) throw Error(`Tmp referenced twice, ended once, but was off`);
            
          },
          async m => { // Tmps with references end appropriately #1
            
            let tmp = Tmp();
            for (let i = 0; i < 10; i++) tmp.ref();
            for (let i = 0; i < 10; i++) tmp.end();
            if (tmp.onn()) throw Error(`Tmp was referenced x 10, ended x 10, but was onn`);
            
          },
          async m => { // Tmps with references end appropriately #1
            
            let tmp = Tmp();
            for (let i = 0; i < 11; i++) tmp.ref();
            for (let i = 0; i < 10; i++) tmp.end();
            if (tmp.off()) throw Error(`Tmp was referenced x 11, ended x 10, but was off`);
            
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
              let srcs = (5).toArr(() => Src());
              let events = [];
              let fnSrc = FnSrcCls(srcs, (...args) => events.push(args));
              if (events.count() !== 0) throw Error(`Expected exactly 0 events; got ${events.count()}`);
            },
            async m => { // FnSrc fn runs for each child event
              let srcs = (5).toArr(() => Src());
              let events = [];
              let fnSrc = FnSrcCls(srcs, (...args) => events.push(args));
              
              for (let i = 0; i < 3; i++) srcs[0].send();
              for (let i = 0; i < 6; i++) srcs[1].send();
              for (let i = 0; i < 2; i++) srcs[2].send();
              for (let i = 0; i < 1; i++) srcs[3].send();
              for (let i = 0; i < 9; i++) srcs[4].send();
              
              let exp = 3 + 6 + 2 + 1 + 9;
              if (events.count() !== exp) throw Error(`Expected exactly 0 events; got ${events.count()}`);
            },
            async m => { // FnSrc sends values as expected
              let srcs = (3).toArr(() => Src());
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
            
            let srcs = (3).toArr(() => Src());
            let fnSrc = FnSrc.Prm1(srcs, (...args) => 'haha');
            let events = [];
            fnSrc.route(v => events.push(v));
            
            for (let i = 0; i < 20; i++) srcs[0].send('yo');
            for (let i = 0; i < 35; i++) srcs[1].send('ha');
            for (let i = 0; i < 60; i++) srcs[2].send('hi');
            
            if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
            
          },
          async m => { // FnSrc.Prm1 gets MemSrc.Prm1 vals as expected
            
            let srcs = (3).toArr(() => MemSrc.Prm1('a'));
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
            
            let choosers = (3).toArr(() => Chooser([ 'a', 'b' ]));
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
            
            let srcs = (3).toArr(() => Src());
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
              depTmps = (5).toArr(() => dep(Tmp()));
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
              dep.scp(tmp.src, (tmp, dep) => depTmps = (5).toArr(() => dep(Tmp())));
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
              depTmps = (5).toArr(() => dep(Tmp()));
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
              depTmpsArr.push((5).toArr(() => dep(Tmp())));
            });
            
            let tmps = (5).toArr(() => { let tmp = Tmp(); src.send(tmp); return tmp; });
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
              depTmpsArr.push((5).toArr(() => dep(Tmp())));
            });
            
            let tmps = (5).toArr(() => { let tmp = Tmp(); src.send(tmp); return tmp; });
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
                depTmpsArr.push((5).toArr(() => dep(Tmp())));
              });
            });
            
            let tmps = (5).toArr(() => {
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
        if (this.getArg('debug').has('lowLevelTests')) console.log(`Running ${tests.length} low-level tests...`);
        for (let test of tests) await U.safe(test, err => {
          let name = (test.toString().match(/[/][/](.*)\n/) || { 1: '<unnamed>' })[1].trim();
          console.log(`Test FAIL (${name}):\n${this.formatError(err)}`);
          this.halt();
        });
        if (this.getArg('debug').has('lowLevelTests')) console.log(`All low-level tests passed!`);
        
        if (this.getArg('debug').has('args')) {
          console.log(`Computed args:`, await Promise.allObj(this.argProcessors.map((v, k) => this.getArg(k))));
        }
        if (this.getArg('debug').has('rawArgs')) {
          console.log(`Raw args:`, this.origArgs);
        }
        
        if (this.getArg('debug').has('storage')) {
          let storageKeep = this.getArg('storageKeep');
          console.log(storageKeep
            ? `Running with storage @ ${storageKeep.desc()}`
            : `No storage provided; this will be a transient run`
          );
        }
        
        if (this.getArg('debug').has('residentSetSize')) {
          let mbMult = 1 / (1024 * 1024);
          let fn = () => console.log(`Resident set size: ${(process.memoryUsage().rss * mbMult).toFixed(2)}mb`);
          setInterval(fn, this.getArg('residentSetSizeDebugMs'));
          fn();
        }
        
      })();
      
    },
    halt: function() { process.exit(0); },
    ready: function() { return this.canSettlePrm; },
    
    // Sandbox
    queueTask: setImmediate,
    getMemUsage: function() {
      let usage1 = process.memoryUsage();
      return {
        rss: usage1.rss - this.usage0.rss,
        heapTotal: usage1.heapTotal,
        heapUsed: usage1.heapUsed - this.usage0.heapUsed
      };
    },
    
    // Config
    argProcessors: {
      
      ...forms.Foundation.argProcessors,
      
      dnsServers: val => {
        // TODO: CloudFlare best choice of default dns server??
        if (!val) return [ '1.1.1.1', '1.0.0.1' ];
        return U.isForm(val, String) ? val.split(',').map(v => v.trim() || C.skip) : val;
      },
      residentSetSize: val => (val != null) ? val : false,
      residentSetSizeDebugMs: val => val || 20 * 1000,
      hosting: async (hosting, foundation) => {
        
        let host = await foundation.getArg('host');
        
        // Note that the "hosting" arg can hold an arbitrary number of
        // hosting definitions. The "host" arg can be used to quickly
        // specify the "host" value for all "hosting" entries. If using
        // "host", should not provide any "host" props within `hosting`
        if (!hosting) {
          
          // If no hosting options are provided we'll try to generate
          // suitable http+sokt options
          
          host = host || await (async () => {
            
            // If no `host` was specified we'll use dns searches to find
            // any publicly addressable hostnames available for this
            // machine. Note this will only find addresses which can be
            // reversed from ips through dns methods.
            
            let externalIps = native('os').networkInterfaces()
              .toArr(v => v).flat()                       // Flat list of all interfaces
              .map(v => v.internal ? C.skip : v.address); // Remove internal interfaces
            
            let dnsResolver = new (native('dns').promises.Resolver)();
            dnsResolver.setServers(foundation.getArg('dnsServers'));
            
            let potentialHosts = (await Promise.allArr(externalIps.map(async ip => {
              
              let type = ((pcs=ip.split('.').map(v => parseInt(v, 10))) => {
                
                // Check for non-ipv4-style ips
                if (pcs.count() !== 4 || pcs.find(v => !U.isForm(v, Number)).found) return null;
                
                // Reserved:
                // 0.0.0.0 -> 0.255.255.255
                if (pcs[0] === 0) return 'reserved';
                
                // Loopback:
                // 127.0.0.0 -> 127.255.255.255
                if (pcs[0] === 127) return 'loopback';
                
                // Private; any of:
                // 10.0.0.0 -> 10.255.255.255,
                // 172.16.0.0 -> 172.31.255.255,
                // 192.168.0.0 -> 192.168.255.255
                if (pcs[0] === 10) return 'private'
                if (pcs[0] === 172 && pcs[1] >= 16 && pcs[1] < 32) return 'private';
                if (pcs[0] === 192 && pcs[1] === 168) return 'private';
                
                // Any other address is public
                return 'external';
                
              })();
              
              // Non-ipv4 and reserved hosts are ignored entirely
              if (type === null) return C.skip;
              if (type === 'reserved') return C.skip;
              
              // Loopback hosts are the least powerful
              if (type === 'loopback') return { type, rank: 0, ip, addr: null };
              
              // Next-best is private; available on local network
              if (type === 'private') return { type, rank: 1, ip, addr: null };
              
              // Remaining types will be "external"; within "external"
              // there are three different ranks (from worst to best:)
              // - Non-reversible
              // - Reversible without A-record
              // - Reversible with A-record (globally addressable)
              try {
                
                // Reverse `ip` into any related hostnames
                let addrs = await dnsResolver.reverse(ip);
                
                // Only consider hostnames with available A records
                return Promise.allArr(addrs.map(async addr => {
                  
                  // If an A record is found this is the most powerful
                  // address possible; globally addressable
                  try { await dnsResolver.resolve(addr, 'A'); return { type: 'public', rank: 4, ip, addr }; }
                  
                  // Reversable ips without A records are one level down
                  // from globally addressable results
                  catch(err) { return { type: 'publicNoHost', rank: 3, ip, addr }; }
                  
                }));
                
              } catch(err) {
                
                // The address is external but not reversible
                return { type: 'external', rank: 2, ip, addr: null };
                
              }
              
            }))).flat();
            
            let bestRank = Math.max(...potentialHosts.map(v => v.rank));
            let bestHosts = potentialHosts.map(v => v.rank === bestRank ? (v.addr || v.ip) : C.skip);
            
            if (foundation.getArg('debug').has('hosting')) {
              
              console.log('Autodetected hosts; results:');
              for (let { type, rank, ip, addr } of potentialHosts.sort((h1, h2) => h2.rank - h1.rank)) {
                console.log(addr
                  ? `- Priority ${rank} (${type}): ${addr} (${ip})`
                  : `- Priority ${rank} (${type}): ${ip}`
                );
              }
              
            }
            
            return bestHosts.count() !== 1
              ? (bestHosts.count() && console.log(`Using host "localhost" but there are multiple options: ${bestHosts.join(', ')}`), 'localhost')
              : bestHosts[0];
            
          })();
          
          let port = foundation.getArg('port') || 80;
          hosting = {
            http: { protocol: 'http', host, port, compress: [ 'deflate', 'gzip' ] },
            sokt: { protocol: 'sokt', host, port: port + 1 }
          };
          
        }
        
        if (U.isForm(hosting, String)) hosting = { main: hosting };
        if (U.isForm(hosting, Array)) hosting = hosting.toObj(({ name, ...args }) => [ name, args ]);
        return hosting.map(v => {
          
          if (U.isForm(v, String)) {
            let [ protocol=null, host=null, port=null ] = (v.trim().match(/^(.*):[/][/](.*):([0-9]+)$/) || []).slice(1);
            if (!protocol) throw Error(`Hosting term "${v}" missing protocol`);
            if (!host) throw Error(`Hosting term "${v}" missing host`);
            if (!port) throw Error(`Hosting term "${v}" missing port`);
            v = { protocol, host, port: parseInt(port, 10) };
          }
          
          if (!v.has('host') || !v.host) v.host = host;
          if (!v.has('host') || !v.host) throw Error(`Missing "host" for ${JSON.stringify(v)}`);
          if (!U.isForm(v.port, Number)) throw Error(`Port for ${JSON.stringify(v)} is not a number`);
          return v;
          
        });
        
      },
      heartMs: val => val || (30 * 1000),
      argsKeep: (val, foundation) => {
        if (!val) val = foundation.getArg('args');
        if (U.isForm(val, String)) val = val.split(/[,/]/);
        if (U.isForm(val, Array)) val = foundation.seek('keep', 'adminFileSystem', ...val);
        if (val && !U.hasForm(val, Keep)) throw Error(`Value of type ${U.getFormName(val)} could not be interpreted as storage Keep`);
        return val || null;
      },
      storageKeep: val => {
        
        if (U.isForm(val, String)) val = val.split(/[,/]/);
        if (U.isForm(val, Array)) val = foundation.seek('keep', 'adminFileSystem', ...val);
        if (val && !U.hasForm(val, Keep)) throw Error(`Value of type ${U.getFormName(val)} could not be interpreted as storage Keep`);
        return val || null;
        
      }
      
    },
    
    // Services
    createHut: async function(options={}) {
      
      /// if (options.has('uid')) throw Error(`Don't specify "uid"!`);
      /// 
      /// if (!options.has('hosting')) options.hosting = {};
      /// if (options.hosting.has('host')) throw Error(`Don't specify "hosting.host"!`);
      /// if (options.hosting.has('port')) throw Error(`Don't specify "hosting.port"!`);
      /// if (options.hosting.has('sslArgs')) throw Error(`Don't specify "hosting.sslArgs"!`);
      /// 
      /// let { host, port } = this.args.hosting;
      /// 
      /// let sslArgs = { keyPair: null, selfSign: null };
      /// if (this.args.hosting.has('ssl') && !!this.args.hosting.ssl) {
      ///   let certFolder = this.seek('keep', 'adminFileSystem', [ 'mill', 'cert' ]);
      ///   let { cert, key, selfSign } = await Promise.allObj({
      ///     cert:     certFolder.seek('server.cert').getContent(),
      ///     key:      certFolder.seek('server.key').getContent(),
      ///     selfSign: certFolder.seek('localhost.cert').getContent()
      ///   });
      ///   sslArgs = { keyPair: { cert, key }, selfSign };
      /// }
      /// 
      /// options.hosting.gain({ host, port: parseInt(port, 10), sslArgs });
      
      return forms.Foundation.createHut.call(this, 'nodejs.root');
      
    },
    createKeep: function(options={}) { return Form.KeepNodejs(); },
    createReal: async function(options={}) {
      
      let FakeReal = U.form({ name: 'FakeReal', has: { Tmp }, props: (forms, Form) => ({
        init: function(params={}, { name }) {
          forms.Tmp.init.call(this);
          this.name = name;
          this.fakeLayout = null;
          this.params = {
            text: MemSrc.Prm1('')
          };
        },
        addReal: real => {
          if (U.isForm(real, String)) return FakeReal({}, { name: real });
          return real;
        },
        mod: function() {},
        addLayout: function() {
          let tmp = Tmp();
          tmp.layout = { src: Src.stub };
          return tmp;
        },
        getLayout: function() { return this.fakeLayout || (this.fakeLayout = primaryFakeReal.getLayoutForm('SuperFake')()); },
        getLayoutForm: function(name) { return primaryFakeReal.tech.getLayoutForm(name); },
        getTech: function() { return primaryFakeReal.tech; },
        render: function() {}
      })});
      
      let layouts = {};
      let primaryFakeReal = FakeReal({}, { name: 'nodejs.fakeReal' });
      primaryFakeReal.tech = {
        render: (real, delta) => {},
        
        getLayoutForm: name => {
          if (!layouts.has(name)) {
            
            layouts[name] = U.form({ name: `Fake${name}`, has: { Tmp }, props: (forms, Form) => ({
              init: function() { forms.Tmp.init.call(this); },
              isInnerLayout: function() { return false; },
              setText: function(){},
              addReal: function(){},
              src: Src.stub
            })});
            
          }
          return layouts[name];
        },
        render: Function.stub
      };
      
      return {
        access: name => {
          if (name === 'primary') return primaryFakeReal;
          throw Error(`Invalid access for Real -> "${name}"`);
        }
      };
      
    },
    
    // Transport
    getHutRoadForQuery: function(server, pool, hutId) {
      
      // TODO: Right now a Road can be spoofed - this should be a
      // property of the Hut, shouldn't it?
      
      // Free pass for Huts that declare themselves unfamiliar
      if (hutId === null) return pool.processNewRoad(server, null);
      
      // Check if this RoadedHut is familiar:
      let roadedHut = pool.getRoadedHut(hutId);
      if (roadedHut) {
        
        // Familiar RoadedHuts are guaranteed a Road
        return roadedHut.serverRoads.has(server)
          // Any previous Road is reused
          ? roadedHut.serverRoads.get(server)
          // Otherwise a new Road is processed for the RoadedHut
          : pool.processNewRoad(server, hutId);
        
      }
      
      // Past this point a Road can only be returned by spoofing
      if (this.getArg('deploy') !== 'dev') return null;
      
      // Return a Road spoofed to have the requested `hutId`
      let newSpoofyRoad = pool.processNewRoad(server, hutId);
      newSpoofyRoad.hut.isSpoofed = true;
      return newSpoofyRoad;
      
    },
    createHttpServer: async function({ host, port, compress=[ 'deflate', 'gzip' ], keyPair=null, selfSign=null }) {
      
      if (!port) port = keyPair ? 443 : 80;
      
      // Translates a javascript value `msg` into http content type and payload
      let sendData = async (req=null, res, msg) => {
        
        if (msg === C.skip) return;
        let httpCode = 200;
        if (U.hasForm(msg, Error)) [ httpCode, msg ] = [ 400, { command: 'error', msg: msg.message } ];
        
        let acceptEncoding = (req ? req.headers : res.reqHeaders)['accept-encoding'] || [];
        
        // Aggregate multiple "Accept-Encoding" headers
        if (U.isForm(acceptEncoding, Array)) acceptEncoding = acceptEncoding.join(',');
        
        // Sanitize encoding options
        let encodeOptions = acceptEncoding.split(',').map(v => v.trim() || C.skip).slice(0, 4);
        
        // Find a compression option which is supported by both us and this client
        let encodeOption = compress ? compress.find(v => encodeOptions.has(v)).val : null;
        
        if (U.hasForm(msg, Keep)) { // Stream files via `pipe`
          
          res.writeHead(httpCode, {
            'Content-Type': (await msg.getContentType()) || 'application/octet-stream',
            ...(encodeOption ? { 'Content-Encoding': encodeOption } : {}),
          });
          
          if (encodeOption === null) {
            
            (await msg.getPipe()).pipe(res);
            
          } else {
            
            // Note we always compress no matter how small the resource
            // is. Chances are any Keep's content will be large enough
            // to merit compression. TODO: Look out for applications
            // which transfer large numbers of tiny files!
            let compressFn = native('zlib')[{ deflate: 'createDeflate', gzip: 'createGzip' }[encodeOption]];
            await Promise(async (rsv, rjc) => {
              native('stream').pipeline(await msg.getPipe(), compressFn(), res, err => err ? rjc(err) : rsv());
            });
            
          }
          
        } else { // Handle json and other immediately-available responses
          
          let contentType = null;
          
          if (msg === null || U.isForm(msg, Object, Array)) {
            
            // Interpret `null`, Object and Array as json responses
            contentType = 'application/json';
            msg = JSON.stringify(msg);
            
          } else {
            
            // Other responses depend on the Accept header, defaulting
            // to "application/octet-stream"
            let accept = ({ req }).seek([ 'req', 'headers', 'accept' ]).val || '*/*';
            let [ t1='*', t2='*' ] = accept.split(/[,;]/)[0].split('/');
            contentType = (t1 !== '*' && t2 !== '*') ? `${t1}/${t2}` : 'application/octet-stream';
            msg = msg.toString();
            
          }
          
          let doEncode = encodeOption && msg.count() > 75;
          if (doEncode) msg = await Promise((rsv, rjc) => {
            native('zlib')[encodeOption](msg, (err, buff) => err ? rjc(err) : rsv(buff));
          });
          
          res.writeHead(httpCode, {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(msg),
            ...(doEncode ? { 'Content-Encoding': encodeOption } : {})
          });
          res.end(msg);
          
        }
        
      };
      let serverFn = async (req, res) => {
        
        let ms = this.getMs();
        
        // Stream the body
        // TODO: Watch for abuse - slow loris, etc.
        let chunks = [];
        req.setEncoding('utf8');
        req.on('data', chunk => chunks.push(chunk));
        let body = await Promise((resolve, reject) => {
          req.on('end', () => resolve(chunks.join('')));
          req.on('error', err => reject(Error(`Client abandoned http request (err.message)`)));
        });
        
        // Show entire HTTP packet if debug options ask for it
        if (this.getArg('debug').has('httpRaw')) {
          
          let lines = [];
          lines.add(`GET ${req.url} HTTP/${req.httpVersion}`);
          for (let [ k, vals ] of req.headers) {
            if (!U.isForm(vals, Array)) vals = [ vals ];
            let headerName = k.replace(/(^|-)[a-z]/g, v => v.upper());
            for (let val of vals) lines.add(`${headerName}: ${val}`);
          }
          lines.add('');
          if (body) lines.add(...body.split('\n'), '');
          
          console.log([
            '<<<<< BEGIN HTTP REQUEST <<<<<',
            ...lines.map(ln => `  ${ln}`),
            '>>>>>> END HTTP REQUEST >>>>>>'
          ].join('\n'));
          
        }
        
        // TODO: Depending on how the handshake works it may be possible
        // for `res` to end at absolutely any moment. While receiving
        // chunks these errors will be handled nicely, since for errors
        // occuring early-on event cleanup is extremely straightforward.
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
          if (urlPath.length > 1) return { command: urlPath.slice(1), ...params, reply: '1' };
          return {};
        })(urlPath);
        
        // Error response for invalid params
        if (!params.has('command')) return res.writeHead(400).end();
        
        // Figure out which Pool will handle this request
        let pool = server.pickTrgPool(params);
        
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
        
        // Synced requests end here - `road.tell` must be called or the
        // request will hang indefinitely
        // TODO: Request  should end with 500 after some delay
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
          
          res.reqHeaders = req.headers; // TODO: Should more information be provided?
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
        ? native('http').createServer(serverFn)
        : native('https').createServer({
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
      server.pools = Set();
      server.pickTrgPool = params => server.pools.toArr(v => v)[0];
      server.addPool = pool => {
        if (server.pools.has(pool)) throw Error(`Added duplicate pool: ${U.getFormName(pool)}`);
        server.pools.add(pool);
        return Tmp(() => server.pools.rem(pool));
      };
      
      return server;
      
    },
    createSoktServer: async function({ host, port, keyPair=null, selfSign=null }) {
      if (!port) port = keyPair ? 444 : 81;
      
      let makeSoktState = (status='initial') => ({
        status, // "initial", "upgrading", "ready", "ended"
        buff: Buffer.alloc(0),
        curOp: null,
        curFrames: []
      });
      let serverFn = async sokt => {
        
        let soktState = makeSoktState();
        
        // Wait to get websocket request - it contains only headers
        let upgradeReq = null;
        while (upgradeReq === null) { // TODO: Limit iterations? Timeouts? Max size of `buff`?
          upgradeReq = await Promise(resolve => sokt.once('readable', () => {
            let newBuff = sokt.read();
            if (!newBuff || !newBuff.length) return resolve(null);
            soktState.buff = Buffer.concat([ soktState.buff, newBuff ]);
            resolve(Form.parseSoktUpgradeRequest(soktState));
          }));
        }
        
        if (!upgradeReq.headers.has('sec-websocket-key')) return sokt.end();
        
        // Now we have the headers - send upgrade response
        soktState.status = 'upgrading';
        let hash = native('crypto').createHash('sha1');
        hash.end(`${upgradeReq.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
        
        sokt.write([ // This is fire-and-forget
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${hash.read().toString('base64')}`,
          '\r\n'
        ].join('\r\n'));
        
        let { query } = this.parseUrl(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${upgradeReq.path}`);
        
        // Figure out which Pool will handle this request
        let pool = server.pickTrgPool(query);
        
        let road = this.getHutRoadForQuery(server, pool, query.seek('hutId').val);
        if (!road) return sokt.end();
        road.sokt = sokt;
        
        soktState.status = 'ready';
        sokt.on('readable', () => {
          if (road.off()) return;
          let ms = this.getMs();
          let newBuff = sokt.read();
          
          if (!newBuff || !newBuff.length) return;
          soktState.buff = Buffer.concat([ soktState.buff, newBuff ]);
          
          try {
            for (let message of Form.parseSoktMessages(soktState)) road.hear.send([ message, null, ms ]);
          } catch(err) { sokt.emit('error', err); }
          
        });
        sokt.on('close', () => { soktState = makeSoktState('ended'); road.end(); });
        sokt.on('error', err => {
          console.log(foundation.formatError(err.update(m => `Sokt error: ${m}`)));
          soktState = makeSoktState('ended');
          road.end();
        });
        
      };
      
      let soktServer = !keyPair
        ? native('net').createServer(serverFn)
        : native('tls').createServer({
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
      server.pools = Set();
      server.pickTrgPool = params => server.pools.toArr(v => v)[0];
      server.addPool = pool => {
        if (server.pools.has(pool)) throw Error(`Added duplicate pool: ${U.getFormName(pool)}`);
        server.pools.add(pool);
        return Tmp(() => server.pools.rem(pool));
      };
      
      return server;
    },
    
    // Room
    compileContent: function(variantName, srcLines, fileNameForDebug='<unknown file>') {
      
      // Compile file content; filter based on variant tags
      if (U.isForm(srcLines, String)) srcLines = srcLines.split('\n');
      if (!U.isForm(srcLines, Array)) throw Error(`Param "srcLines" is invalid type: ${U.getFormName(srcLines)}`);
      
      let variantDef = {
        above: variantName === 'above',
        below: variantName === 'below',
        debug: this.getArg('deploy') === 'dev' || !this.getArg('debug').isEmpty()
      };
      
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
      
      if (curBlock) throw Error(`Ended with unbalanced "${curBlock.type}" block`);
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
          let [ lineNoComment=line ] = (line.match(Form.removeLineCommentRegex) || []).slice(1);
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
      
      if (this.getArg('debug').has('compile')) {
        let srcCnt = srcLines.count();
        let trgCnt = filteredLines.count();
        console.log(`Compiled ${fileNameForDebug}: ${srcCnt} -> ${trgCnt} (-${srcCnt - trgCnt}) lines`);
      }
      
      if (filteredLines.count()) filteredLines[0] = `'use strict';${filteredLines[0]}`;
      return { lines: filteredLines, offsets };
      
    },
    installRoom: async function(name, { bearing='above' }={}) {
      
      let namePcs = name.split('.');
      let pcs = [ 'room', ...namePcs, `${namePcs.slice(-1)[0]}.js` ]
      
      let contents = await this.seek('keep', 'adminFileSystem', pcs).getContent('utf8');
      if (!contents) throw Error(`Invalid room name: "${name}"`);
      let { lines, offsets } = await this.compileContent(bearing, contents, pcs.join('/'));
      
      return {
        debug: { offsets },
        content: (async () => {
          
          // Write, `require`, and ensure file populates `global.rooms`
          await this.seek('keep', 'adminFileSystem', [ 'mill', 'compiled', `${name}@${bearing}.js` ]).setContent(lines.join('\n'));
          try         { require(`../mill/compiled/${name}@${bearing}.js`); }
          catch(err)  { throw err.update(m => `Error requiring ${name}.cmp (${m})`); }
          if (!global.rooms.has(name)) throw Error(`Room "${name}" didn't set global.rooms.${name}`);
          if (!U.hasForm(global.rooms[name], Function)) throw Error(`Room "${name}" set non-function at global.rooms.${name}`);
          
          // The file and set a function at `global.room[name]`. Return
          // a call to that function, providing a `foundation` argument!
          return global.rooms[name](this);
          
        })()
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
      let [ roomName, , bearing=null ] = fileName.match(/^([a-zA-Z0-9.]*)(@([a-zA-Z]*))?[.]js/).slice(1);
      //let [ roomName, bearing=null ] = fileName.split('@').slice(0, -1);
      return { roomName, bearing, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10) };
      
    },
    srcLineRegex: function() {
      return {
        regex: /([^ ]*[^a-zA-Z0-9@.])?[a-zA-Z0-9@.]*[.]js:[0-9]+/, // TODO: No charInd
        extract: fullMatch => {
          let [ roomBearingName, lineInd ] = fullMatch.split(/[^a-zA-Z0-9.@]/).slice(-2);
          let [ roomName, bearing ] = roomBearingName.split('@');
          return { roomName, lineInd: parseInt(lineInd, 10), charInd: null };
        }
      };
    },
    
  })});
  
  U.setup.gain({ FoundationNodejs });
  
})();
