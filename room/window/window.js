global.rooms['window'] = foundation => ({ open: async () => {
  
  let { Tmp, Src } = U.logic;
  
  let modCode = (...codes) => codes.map(v => `\x1b[${v}m`).join('');
  let modMapping = {
    red: modCode(91, 39),
    green: modCode(92, 39),
    yellow: modCode(93, 39),
    blue: modCode(94, 39),
    bold: modCode(1, 22),
    dim: modCode(2, 22),
    italic: modCode(3, 22),
    underline: modCode(4, 22),
    reset: modCode(0)
  };
  let cmpSeqs = (s1, s2) => {
    let len = s1.count();
    if (len !== s2.count()) return false;
    for (let i = 0; i < len; i++) if (s1[i] !== s2[i]) return false;
    return true;
  };
  
  let Vals2D = U.inspire({ name: 'Vals2D', methods: (insp, Insp) => ({
    
    init: function({ w, h, xOff=0, yOff=0, rect=null, format, mode='lenient' }) {
      if (!rect) rect = w.toArr(x => h.toArr(y => format));
      ({}).gain.call(this, { w, h, xOff, yOff, rect, format, mode });
    },
    getVal: function(x, y) {
      if (x < 0)        { if (this.mode === 'strict') throw Error(`x too small`); return this.format; }
      if (x >= this.w)  { if (this.mode === 'strict') throw Error(`x too large`); return this.format; }
      if (y < 0)        { if (this.mode === 'strict') throw Error(`y too small`); return this.format; }
      if (y >= this.h)  { if (this.mode === 'strict') throw Error(`y too large`); return this.format; }
      return this.rect[this.xOff + x][this.yOff + y];
    },
    setVal: function(x, y, args) {
      if (x < 0)        { if (this.mode === 'strict') throw Error(`x too small`); return; }
      if (x >= this.w)  { if (this.mode === 'strict') throw Error(`x too large`); return; }
      if (y < 0)        { if (this.mode === 'strict') throw Error(`y too small`); return; }
      if (y >= this.h)  { if (this.mode === 'strict') throw Error(`y too large`); return; }
      
      let [ xx, yy ] = [ this.xOff + x, this.yOff + y ];
      this.rect[xx][yy] = { ...this.rect[xx][yy], ...args };
    },
    fill: function(fn) {
      for (let x = 0; x < this.w; x++) for (let y = 0; y < this.h; y++) this.setVal(x, y, fn(x, y));
      return this;
    },
    getRows: function() {
      let rows = [];
      for (let y = 0; y < this.h; y++) { let row = []; rows.push(row); for (let x = 0; x < this.w; x++) {
        row.push(this.getVal(x, y));
      }}
      return rows;
    },
    getCols: function() {
      let cols = [];
      for (let x = 0; x < this.w; x++) { let col = []; cols.push(col); for (let y = 0; y < this.h; y++) {
        col.push(this.getVal(x, y));
      }}
      return cols;
    },
    sub: function(xOff, yOff, w, h) {
      if (this.mode === 'strict') {
        if (xOff < 0)           throw Error('xOff too small');
        if (xOff + w > this.w)  throw Error('xOff + w too wide');
        if (yOff < 0)           throw Error('yOff too small');
        if (yOff + h > this.h)  throw Error('yOff + h too wide');
      } else {
        w = Math.max(0, Math.min(w, this.w - xOff));
        h = Math.max(0, Math.min(h, this.h - yOff));
      }
      let Cls = this.constructor;
      return Cls({
        w, h,
        xOff: this.xOff + xOff, yOff: this.yOff + yOff,
        rect: this.rect, mode: this.mode, format: this.format
      });
    }
    
  })});
  
  let TerminalReal = U.inspire({ name: 'TerminalReal', insps: { Tmp }, methods: (insp, Insp) => ({
    
    $ansi: (...codes) => `\x1b[${codes.flat(Infinity).join(';')}m`,
    $ansiFgRgb: (r, g, b) => {
      [ r, g, b ] = [ r, g, b ].map(v => Math.round(v * 5));
      return Insp.ansi([ 38, 5, 16 + 36 * b + 6 * g + r ]);
    },
    $ansiBgRgb: (r, g, b) => {
      [ r, g, b ] = [ r, g, b ].map(v => Math.round(v * 5));
      return Insp.ansi([ 48, 5, 16 + 36 * b + 6 * g + r ]);
    },
    
    init: function({ out, bg={ chr: ' ' }, prefChrW=1, prefChrH=2 }) {
      insp.Tmp.init.call(this);
      
      ({}).gain.call(this, { out, w: out.columns, h: out.rows, prefChrW, prefChrH, bg, renderers: Set() });
      
      let resizeFn = () => this.render();
      this.out.on('resize', resizeFn);
      this.endWith(() => this.out.off('resize', resizeFn));
      
      this.status = 'ready';
      this.render();
      
      // this.endWith(() => this.out.write('\u001b[2J\u001b[0;0H'));
      this.endWith(() => this.out.cursorTo(0, this.h, () => this.out.write('\n'.repeat(1))));
    },
    addRenderer: function(renderer) {
      let tmp = Tmp();
      tmp.renderer = renderer;
      
      // Include `renderer` in Set
      this.renderers.add(renderer);
      tmp.endWith(() => this.renderers.rem(renderer));
      
      // Render whenever `renderer` changes
      tmp.endWith(renderer.route(() => this.render()));
      
      // Render as Renderer is added and removed (fire-and-forget)
      this.render();
      tmp.endWith(() => this.render());
      
      return tmp;
    },
    preparePixel: function({ chr, ...args }) {
      let ansiSeqs = [];
      
      if (args.has('emphasis') && args.emphasis === +1) ansiSeqs.push(Insp.ansi(4)); // bold (invert: 7)
      if (args.has('emphasis') && args.emphasis === -1) ansiSeqs.push(Insp.ansi(2)); // dim
      
      if (args.has('raw')) { if (args.raw.count()) ansiSeqs.push(Insp.ansi(args.raw)); }
      
      if (args.has('fgRgb')) { let { r, g, b } = args.fgRgb; if (r || g || b) ansiSeqs.push(Insp.ansiFgRgb(r, g, b)); }
      if (args.has('bgRgb')) { let { r, g, b } = args.bgRgb; if (r || g || b) ansiSeqs.push(Insp.ansiBgRgb(r, g, b)); }
      
      return ansiSeqs.count() ? `${ansiSeqs.join('')}${chr}${Insp.ansi(0)}` : chr;
    },
    render: async function() {
      
      // If busy and asked to render, we are overworked
      if (this.status === 'busy') this.status = 'overworked';
      
      // No more action unless we're ready
      if (this.status !== 'ready') return;
      
      // The moment we start rendering we become busy
      this.status = 'busy';
      
      this.renderRequests++;
      if (this.renderRequests > 1) return;
      
      let [ w, h ] = [ this.w, this.h ] = [ this.out.columns, this.out.rows ];
      
      let canvas = Vals2D({ w, h, format: this.bg });
      let zRenderers = this.renderers.toArr(r => r).sort((r1, r2) => r1.z - r2.z);
      for (let renderer of zRenderers) renderer.render(this, canvas);
      
      
      await Promise(r => this.out.cursorTo(0, 0, r) && r());
      let outputStr = canvas.getRows().map(row => row.map(v => this.preparePixel(v)).join('')).join('\n');
      this.out.write(outputStr);
      
      let s = this.status; this.status = 'ready';
      
      // If overworked there are changes not reflected by this render
      if (s === 'overworked') this.render();
      
    }
    
  })});
  let TerminalMainReal = U.inspire({ name: 'TerminalMainReal', insps: { TerminalReal }, methods: (insp, Insp) => ({
    
    init: function({ inn, ctrlPaneH=10, ...args }) {
      
      this.render = () => {};
      insp.TerminalReal.init.call(this, args);
      
      this.ctrlPaneH = 5;
      this.inn = inn;
      
      this.ctrlPane = TerminalTextRenderer({
        w: r => r.w, h: ctrlPaneH,
        x: 0, y: r => r.h - ctrlPaneH - 1,
        z: 9, bg: (721).char(),
        text: ''
      });
      this.addRenderer(this.ctrlPane);
      
      this.statusPane = TerminalTextRenderer({
        w: r => r.w, h: 1, x: 0, y: r => r.h - 1,
        z: 10,
        text: '-- status --'
      });
      this.addRenderer(this.statusPane);
      
      this.inn.setEncoding('ascii');
      this.endWith(() => this.inn.setEncoding(null));
      
      this.inn.setRawMode(true);
      this.endWith(() => this.inn.setRawMode(false));
      
      require('readline').emitKeypressEvents(this.inn);
      
      this.cmd = '';
      this.cmdInd = 0;
      let keyPressFn = async str => {
        
        let codes = str.split('').map(c => c.code());
        
        // ctrl+c
        if (cmpSeqs(codes, [ 3 ])) { this.end(); return; }
        
        this.statusPane.update({ text: `${JSON.stringify(str)} (${codes.join(', ')})` });
        
        if (str.match(/^[a-zA-Z0-9!@#$%^&*()-={}[\]\\|;':",./<>?`~ ]$/)) {  // Regular chars
          
          this.cmd = this.cmd.slice(0, this.cmdInd) + str + this.cmd.slice(this.cmdInd);
          this.cmdInd++;
          
        } else if (cmpSeqs(codes, [ 8 ])) {                                 // Delete bak
          
          this.cmd = this.cmd.slice(0, this.cmdInd - 1) + this.cmd.slice(this.cmdInd);
          this.cmdInd--;
          
        } else if (cmpSeqs(codes, [ 27, 91, 51, 136 ])) {                   // Delete fwd
          
          this.cmd = this.cmd.slice(0, this.cmdInd) + this.cmd.slice(this.cmdInd + 1);
          
        } else if (cmpSeqs(codes.slice(0, 2), [ 27, 91 ])) {
          
          // regular (r|l)-arrow produces:
          // [ 27, 91, 67 ]
          // [ 27, 91, 68 ]
          
          // ctrl + (r|l)-arrow produces:
          // [ 27, 91, 49, 59, 53, 67 ]
          // [ 27, 91, 49, 59, 53, 68 ]
          
          if (codes.slice(-1)[0] === 68) this.cmdInd--; // L
          if (codes.slice(-1)[0] === 67) this.cmdInd++; // R
          
        }
        
        if (this.cmdInd < 0) this.cmdInd = 0;
        if (this.cmdInd > this.cmd.count()) this.cmdInd = this.cmd.count();
        
        if ([ '\r', '\n' ].has(str)) {
          let cmd = this.cmd; this.cmd = ''; this.cmdInd = 0;
          this.execute(cmd);
        }
        
        let formatCmd = [ this.cmd.split('').map(chr => ({ chr })) ];
        if (this.cmdInd < this.cmd.count()) formatCmd[0][this.cmdInd].emphasis = +1;
        else                                formatCmd[0].push({ chr: ' ', emphasis: +1 });
        
        this.ctrlPane.update({ text: formatCmd });
        
      };
      this.inn.on('data', keyPressFn);
      this.endWith(() => this.inn.off('data', keyPressFn));
      keyPressFn('');
      
      delete this.render;
      this.render();
      
    },
    setCtrlText: function(text) {
      this.cmd = text;
      this.cmdInd = text.count();
      this.ctrlPane.update({ text });
    },
    execute: function(cmd) {
      
      try {
        
        let args = eval(`(${cmd})`);
        if (U.isType(args, String)) args = { cmd: args };
        if (!U.isType(args, Object)) throw Error(`Expected Object; got ${U.nameOf(args)}`);
        if (!args.has('cmd')) throw Error(`Missing "cmd" property`);
        if (!U.isType(args.cmd, String)) throw Error(`Expected "cmd" to be String; got ${U.nameOf(args.command)}`);
        
        if (args.cmd === 'ansiTest') {
          
          let { chr='$', amt=50, codeFn=(n)=>[ 38, 5, n ] } = args;
          
          let text = [ amt.toArr(n => ({ chr, raw: codeFn(n) })) ];
          this.statusPane.update({ text });
          
        } else {
          
          this.statusPane.update({ text: `Couldn't process ${JSON.stringify(args)}` });
          
        }
        
      } catch(err) {
        
        this.statusPane.update({ text: `Couldn't execute "${cmd}": ${err.message}` });
        
      }
      
    }
    
  })});
  
  let TerminalRenderer = U.inspire({ name: 'TerminalRenderer', insps: { Src }, methods: (insp, Insp) => ({
    init: function({ x, y, w, h, z=0, bg=' ' }) {
      insp.Src.init.call(this);
      ({}).gain.call(this, { x, y, w, h, z, bg });
    },
    update: function(props={}) { ({}).gain.call(this, props); this.send(); },
    fillRenderRect: C.noFn('fillRenderRect', (w, h) => {}),
    render: function(real, canvas) {
      
      let [ x, y, w, h ] = [ this.x, this.y, this.w, this.h ].map(v => Math.round(U.isType(v, Function) ? v(real) : v));
      this.fillRenderRect(canvas.sub(x, y, w, h));
      
    }
  })});
  let TerminalPixelsRenderer = U.inspire({ name: 'TerminalPixelsRenderer', insps: { TerminalRenderer }, methods: (insp, Insp) => ({
    init: function({ pixels, mode={ type: 'brightness', chrs: [ ' ', '-', '~', '+', '2', '#', '$' ], colour: true }, chrW=1, chrH=1, ...args }) {
      insp.TerminalRenderer.init.call(this, { w: pixels.w * chrW, h: pixels.h * chrH, ...args });
      this.pixels = pixels;
      this.mode = mode;
      this.chrW = chrW;
      this.chrH = chrH;
    },
    fillRenderRect: function(rect) {
      let maxX = Math.min(rect.w, this.w);
      let maxY = Math.min(rect.h, this.h);
      
      if (this.mode.type === 'brightness') {
        
        let multW = 1 / this.chrW;
        let multH = 1 / this.chrH;
        let { chrs, colour=false } = this.mode;
        
        rect.fill((x, y) => {
          let px = this.pixels.getVal(Math.floor(x * multW), Math.floor(y * multH));
          let result = { chr: chrs[Math.round(px.lum * (chrs.count() - 1))] };
          if (colour) result.fgRgb = px;
          return result;
        });
        
      } else if (this.mode.type === 'binary') {
        
        let multW = 1 / this.chrW;
        let multH = 1 / this.chrH;
        let { onn, off } = this.mode;
        
        rect.fill((x, y) => {
          let px = this.pixels.getVal(Math.floor(x * multW), Math.floor(y * multH));
          return { chr: px.lum > 0.5 ? onn : off };
        });
        
      } else {
        throw Error(`Unknown mode: "${this.mode.type}"`);
      }
      
    }
  })});
  let TerminalTextRenderer = U.inspire({ name: 'TerminalTextRenderer', insps: { TerminalRenderer }, methods: (insp, Insp) => ({
    $strToLns: str => {
      return str.replace(/\r/g, '')                     // Ignore '\r'
        .split('\n')                                    // Split by line
        .map(ln => ln.split('').map(chr => ({ chr }))); // Line characters to pixels
    },
    $defWFn: r => Math.max(...r.text.map(ln => ln.count())),
    $defHFn: r => r.text.count(),
    
    init: function({ text=[], vertOff=0, ...args }) {
      insp.TerminalRenderer.init.call(this, {
        w: Insp.defWFn.wrap(this),
        h: Insp.defHFn.wrap(this),
        ...args
      });
      
      if (U.isType(text, String)) text = Insp.strToLns(text);
      ({}).gain.call(this, { text, vertOff });
    },
    update: function(args) {
      if (args.has('text')) {
        if (U.isType(args.text, String)) args.text = Insp.strToLns(args.text);
      }
      return insp.TerminalRenderer.update.call(this, args);
    },
    fillRenderRect: function(rect) {
      let lns = this.text.slice(this.vertOff);
      rect.fill((x, y) => ((y < lns.count()) && (x < lns[y].count())) ? lns[y][x] : { chr: this.bg });
    }
  })});
  
  let Adapter = U.inspire({ name: 'Adapter', methods: (insp, Insp) => ({
    init: function({ name=null, transform=null }) {
      this.name = name || `Anon${U.nameOf(this)}`
      this.transform = transform;
    },
    convertFwd: async function(bak, ctx={}) {
      let fwd = await this.convertFwd0(bak, { ...ctx });
      return this.transform ? this.transform.fwd(fwd) : fwd;
    },
    convertBak: async function(fwd, buff=null, ctx=fwd) {
      if (this.transform) fwd = this.transform.bak(fwd);
      
      let bLen = this.getBLen(ctx);
      if (!buff && !bLen) throw Error(`No Buffer given and no bLen known`);
      if (!buff) buff = Buffer.allocUnsafe(bLen >> 3);
      
      await this.convertBak0(fwd, buff, { ...ctx });
      
      buff = buff.subarray(0, bLen >> 3);
      buff.bLen = bLen;
      return buff;
    },
    getBLen: function() { return null; },
    
    convertFwd0: C.noFn('convertFwd0', (b, ctx) => {}),
    convertBak0: C.noFn('convertBak0', (v, buff, ctx) => {})
  })});
  let AdapterVal = U.inspire({ name: 'AdapterVal', insps: { Adapter }, methods: (insp, Insp) => ({
    
    $getBuffFnSuffix: function (type, bLen, endn) {
      
      // Provide default `bLen` for default-able types
      if (type === 'flt' && !bLen) bLen = 32;
      if (type === 'dbl' && !bLen) bLen = 32;
      if (type === 'ascii' && !bLen) bLen = 8;
      
      // Ensure `bLen` is correct for restrictive types
      if (type === 'flt' && bLen !== 32) throw Error(`type === 'flt' implies bLen === 32`);
      if (type === 'dbl' && bLen !== 32) throw Error(`type === 'dbl' implies bLen === 32`);
      
      // For "type", simply map our values to node's buffer api terms
      let fnType = { int: 'Int', uInt: 'UInt', flt: 'Float', dbl: 'Double', ascii: 'UInt' }[type];
      
      // Node's naming scheme omits bit length for some types
      let fnBLen = ([ 'flt', 'dbl' ].includes(type)) ? '' : Math.max(bLen, 8);
      
      // Endianness is omitted for some types, when bit length is 8
      let fnEndn = ([ 'int', 'uInt', 'ascii' ].includes(type) && bLen === 8) ? '' : { '<': 'LE', '>': 'BE' }[endn];
      
      return [ fnType, fnBLen, fnEndn ].join('');
      
    },
    
    init: function({ type, bLen, endn, ...args }) {
      insp.Adapter.init.call(this, args);
      this.type = type;
      this.bLen = bLen;
      this.endn = endn;
      this.fnSuffix = Insp.getBuffFnSuffix(type, bLen, endn);
    },
    getBLen: function() { return this.bLen; },
    convertFwd0: async function(b, ctx) {
      let value = b[`read${this.fnSuffix}`](0);
      if (this.type === 'ascii') value = value.char();
      return value;
    },
    convertBak0: async function(value, buff) {
      if (this.type === 'ascii') value = value.code();
      buff[`write${this.fnSuffix}`](value);
    }
  })});
  let AdapterObj = U.inspire({ name: 'AdapterObj', insps: { Adapter }, methods: (insp, Insp) => ({
    init: function({ mems, defaults={}, ...args }) {
      if (!mems) throw Error(`Must provide "mems"`);
      insp.Adapter.init.call(this, args);
      this.mems = mems;
      this.defaults = defaults;
    },
    convertFwd0: async function(b, ctx) {
      
      let value = {};
      let offBLen = 0;
      for (let [ name, mem ] of this.mems) {
        
        if (U.isType(mem, Function)) mem = mem(ctx, this);
        
        let bLen = mem.getBLen(ctx);
        let result = await mem.convertFwd(b.subarray(offBLen >> 3, (offBLen + bLen) >> 3), ctx);
        value[name] = result;
        ctx[name] = result;
        offBLen += bLen;
        
      }
      return value;
      
    },
    convertBak0: async function(memVals, buff, ctx) {
      
      // Provide memVals to context
      ctx.gain(memVals);
      
      // TODO: Complicated!
      // Here we have a pretty typical churn; we collect all mems along
      // with their buffs (we know the size of each mem), and finally
      // churn until every mem writes its value, or churn is stuck. BUT
      // what if some members are unable to know their size (i.e.,
      // `mem.getBLen(ctx) === null`)?? We may actually be able to
      // accomodate these cases, but the churn gets weird. First of all,
      // only include the prefix of members whose sizes are known (as
      // soon as a member has unknown size, all later members cannot
      // know where they fall in the buffer due to the cumulative adding
      // nature of sizes). Then, in addition to churning normally, check
      // to see if any previously-unknown-size members have become able
      // to determine their size (again, off the prefix of remaining
      // members). A churn that resulted in new members determining
      // their sizes is not considered stuck, even if no member could
      // successfully write.
      
      let mems = {};
      let offBLen = 0;
      let memsWithBuffs = []
      for (let [ name, mem ] of this.mems) {
        if (U.isType(mem, Function)) mem = mem({ ...this.defaults, ...ctx, ...memVals }, this);
        mems[name] = mem;
        let bLen = mem.getBLen(ctx);
        memsWithBuffs.push({ name, mem, buff: buff.subarray(offBLen >> 3, (offBLen + bLen) >> 3) });
        offBLen += bLen;
      }
      
      let allVals = { ...this.defaults, ...memVals };
      while (memsWithBuffs.count()) {
        
        let attempt = memsWithBuffs;
        memsWithBuffs = [];
        
        await Promise.allArr(attempt.map(async ({ name, mem, buff }) => {
          try         { await mem.convertBak(allVals[name], buff, ctx); }
          catch(err)  { memsWithBuffs.push({ name, mem, offBLen, err }); }
        }));
        
        if (memsWithBuffs.count() === attempt.count()) {
          for (let { name, err } of memsWithBuffs) console.log(`Error for "${name}":\n`, foundation.formatError(err).indent(2));
          throw Error(`No progress among remaining mems: [ ${memsWithBuffs.map(({ name }) => name).join(', ')} ]`);
        }
        
      }
      
    },
    getBLen: function(ctx) {
      let bLen = 0;
      for (let [ k, mem ] of this.mems) {
        if (U.isType(mem, Function)) mem = mem(ctx, this);
        let bl = mem.getBLen(ctx);
        if (bl === null) return null;
        bLen += bl;
      }
      return bLen;
    }
  })});
  let AdapterArr = U.inspire({ name: 'AdapterArr', insps: { Adapter }, methods: (insp, Insp) => ({
    init: function({ reps, format, ...args }) {
      if (!format) throw Error('Must provide "format"');
      insp.Adapter.init.call(this, args);
      this.reps = reps;
      this.format = format;
    },
    convertFwd0: async function(b, ctx) {
      
      let value = [];
      let offBLen = 0;
      for (let i = 0; i < this.reps; i++) {
        let result = await this.format.convertFwd(b.subarray(offBLen >> 3));
        value.push(result);
        //if (result.bLen % 8) throw Error(`Members don't fall on byte boundaries`);
        offBLen += this.format.getBLen(ctx); //result.bLen;
      }
      
      return value;
      
    },
    convertBak0: async function(values, buff, ctx) {
      
      if (!U.isType(buff, Buffer)) throw Error(`Expected Buffer; got ${U.nameOf(buff)}`);
      
      let offBLen = 0;
      for (let value of values) {
        
        let bLen = this.format.getBLen(ctx);
        if (bLen % 8) throw Error(`Members don't fall on byte boundaries`);
        await this.format.convertBak(value, buff.subarray(offBLen >> 3));
        offBLen += bLen;
        
      }
      
      return { bLen: offBLen, buff };
      
    },
    getBLen: function(ctx) {
      let bl = this.format.getBLen(ctx);
      return bl && this.reps * bl;
    }
  })});
  
  let bmpFormat = AdapterObj({ mems: {
    header: () => AdapterObj({
      mems: {
        idenChar0:    AdapterVal({ type: 'ascii',  bLen: 8,  endn: '<' }),
        idenChar1:    AdapterVal({ type: 'ascii',  bLen: 8,  endn: '<' }),
        size:         AdapterVal({ type: 'uInt',   bLen: 32, endn: '<' }),
        reserved1:    AdapterVal({ type: 'uInt',   bLen: 16, endn: '<' }),
        reserved2:    AdapterVal({ type: 'uInt',   bLen: 16, endn: '<' }),
        pixelOffset:  AdapterVal({ type: 'uInt',   bLen: 32, endn: '<' }),
      },
      defaults: {
        idenChar0: 'B', idenChar1: 'M', reserved1: 0, reserved2: 0,
        pixelOffset: (112 + 320) >> 3 // header (112) + bmpHeader (320)
      }
    }),
    bmpHeader: ctx => AdapterObj({
      mems: {
        headerLen:    AdapterVal({ type: 'uInt', bLen: 32, endn: '<' }),
        w:            AdapterVal({ type: 'int',  bLen: 32, endn: '<' }),
        h:            AdapterVal({ type: 'int',  bLen: 32, endn: '<' }),
        planes:       AdapterVal({ type: 'uInt', bLen: 16, endn: '<' }),
        pxBLen:       AdapterVal({ type: 'uInt', bLen: 16, endn: '<' }),
        compression:  AdapterVal({ type: 'uInt', bLen: 32, endn: '<' }),
        pxSize:       AdapterVal({ type: 'uInt', bLen: 32, endn: '<' }),
        hRes:         AdapterVal({ type: 'int',  bLen: 32, endn: '<' }),
        vRes:         AdapterVal({ type: 'int',  bLen: 32, endn: '<' }),
        genNumCols:   AdapterVal({ type: 'uInt', bLen: 32, endn: '<' }), // General # of colours
        impNumCols:   AdapterVal({ type: 'uInt', bLen: 32, endn: '<' })  // Important # of colours
      },
      defaults: {
        headerLen: (320) >> 3,
        w: ctx.has('pixels') ? ctx.pixels.w : 0,
        h: ctx.has('pixels') ? ctx.pixels.h : 0,
        planes: 1,
        pxBLen: (ctx.has('pixels') ? 3 : 0) << 3 // Bit depth, so multiply by 8
      }
    }),
    pixels: ctx => AdapterArr({
      
      reps: ctx.has('pixels') ? ctx.pixels.w * ctx.pixels.h : ctx.bmpHeader.w * ctx.bmpHeader.h,
      
      format:  AdapterArr({
        reps: ctx.has('pixels') ? 3 : ctx.bmpHeader.pxBLen >> 3,
        format: AdapterVal({ type: 'uInt', bLen: 8, endn: '<' }),
        transform: {
          fwd: cmps => {
            if (cmps.count() !== 3) throw Error(`Require exactly 3 colour components; got ${cmps.count()}`);
            let [ r, g, b ] = cmps.map(cmp => cmp / 255);
            let lum = Math.sqrt(r * r * 0.241 + g * g * 0.691 + b * b * 0.068);
            return { r, g, b, lum };
          },
          bak: ({ r, g, b }) => [ r, g, b ].map(v => Math.round(v * 255))
        }
      }),
      transform: {
        fwd: cmps => {
          let w = ctx.bmpHeader.w;
          let h = ctx.bmpHeader.h;
          
          let result = Vals2D({ w, h, format: {} });
          return result.fill((x, y) => cmps[(h - y - 1) * h + x]);
        },
        bak: pixels => {
          
          let { w, h } = pixels;
          return (w * h).toArr(n => {
            let y = Math.floor(n / w);
            let x = n - y * w;
            return pixels.getVal(x, h - y - 1);
          });
          
        }
      }
      
    })
  }});
  
  if (0) await (async () => {
    
    let pixels = Vals2D({ w: 4, h: 4, format: { r: 0, g: 0, b: 0, lum: 0 } });
    pixels.setVal(0, 0, { r: 1, g: 1, b: 1, lum: 1 });
    pixels.setVal(1, 1, { r: 1, g: 1, b: 1, lum: 1 });
    pixels.setVal(2, 2, { r: 1, g: 1, b: 1, lum: 1 });
    pixels.setVal(3, 3, { r: 1, g: 1, b: 1, lum: 1 });
    
    let buff = await bmpFormat.convertBak({ pixels });
    console.log(buff.toString('hex'));
    await foundation.seek('keep', 'fileSystem', 'room', 'window', 'outputTest.bmp').setContent(buff);
    
    foundation.halt();
    
  })();
  
  if (0) await (async () => {
    
    let bmpBuff = await foundation.seek('keep', 'fileSystem', 'room', 'window', 'imgTest.bmp').getContent();
    let bmpData = await bmpFormat.convertFwd(bmpBuff);
    
    console.log({ bmpData });
    
    foundation.halt();
    
  })();
  
  if (1) await (async () => {
    
    let renderer = TerminalMainReal({
      inn: process.stdin, out: process.stdout,
      bg: { chr: ' ' }
    });
    
    let bmpBuff = await foundation.seek('keep', 'fileSystem', 'room', 'window', 'imgTest.bmp').getContent();
    let bmpData = await bmpFormat.convertFwd(bmpBuff);
    
    renderer.addRenderer(TerminalTextRenderer({
      x: 0, y: 0,
      text: 'Pixels orig:'
    }));
    renderer.addRenderer(TerminalPixelsRenderer({
      chrW: 2, chrH: 1,
      x: 0, y: 1,
      pixels: bmpData.pixels
    }));
    
    renderer.statusPane.update({ text: 'Rendered initial pixels' });
    
    let bmpBuff2 = await bmpFormat.convertBak(bmpData);
    let bmpData2 = await bmpFormat.convertFwd(bmpBuff2);
    
    renderer.addRenderer(TerminalTextRenderer({
      x: r => r.w >> 1, y: 0,
      text: 'Pixels converted:'
    }));
    renderer.addRenderer(TerminalPixelsRenderer({
      chrW: 2, chrH: 1,
      x: r => r.w >> 1, y: 1,
      pixels: bmpData2.pixels
    }));
    
    renderer.statusPane.update({ text: 'Rendered comparison' });
    
  })();
  return;
  
  let posMod = (n, d) => {
    let ret = n % d;
    if (ret < 0) ret += d;
    return ret;
  };
  let complexChars = Set([ 0, 7, 8, 9, 10, 13, 27, 32, 155 ]);
  let charReplace = c => complexChars.has(c.charCodeAt(0)) ? ' ' : c;
  let cmpSeq = (seq1, seq2) => {
    if (U.isType(seq1, String)) seq1 = Array.fill(seq1.count(), i => seq1.charCodeAt(i));
    if (U.isType(seq2, String)) seq2 = Array.fill(seq2.count(), i => seq2.charCodeAt(i));
    
    if (seq1.count() !== seq2.count()) return false;
    if (seq1.find((v, n) => v !== seq2[n]).found) return false;
    return true;
  };
  let applyMods = (text, mods) => {
    if (mods.isEmpty()) return text;
    let modPrefix = mods.toArr(v => modMapping[v]).join('');
    return `${modPrefix}${text}\x1b[0m`;
  };
  
  let asciiPicker = await (async () => {
    
    let { ascii } = foundation.origArgs;
    
    let paeth = (l, u, ul) => {
      let pL = Math.abs(u - ul);
      let pU = Math.abs(l - ul);
      let pUL = Math.abs(l + u - ul * 2);

      if (pL <= pU && pL <= pUL) return l;
      if (pU <= pUL) return u;
      return ul;
    };
    let pngToPixels = async pngBuff => {
      let pngHeader = pngBuff.slice(0, 8);
      
      pngBuff = pngBuff.slice(8);
      let chunks = [];
      while (pngBuff.length) {
        let len = pngBuff.readInt32BE(0);
        let type = pngBuff.slice(4, 8).toString('utf8');
        let data = pngBuff.slice(8, 8 + len);
        let crc = pngBuff.slice(8 + len, 12 + len);
        
        chunks.push({
          meta: {
            critical: (type[0] === type[0].lower()),
            private: (type[0] === type[0].lower()),
            reserved: (type[0] === type[0].upper()) ? 0 : 1,
            copySafe: (type[0] === type[0].lower())
          },
          type: type.lower(),
          data,
          crc
        });
        pngBuff = pngBuff.slice(12 + len);
      }
      
      let ihdrChunk = chunks[0];
      ihdrChunk.ihdr = {
        w: ihdrChunk.data.readInt32BE(0),
        h: ihdrChunk.data.readInt32BE(4),
        bitDepth: ihdrChunk.data.readInt8(8),
        colorType: ihdrChunk.data.readInt8(9),
        compressionMethod: ihdrChunk.data.readInt8(10),
        filterMethod: ihdrChunk.data.readInt8(11),
        interlaceMethod: ihdrChunk.data.readInt8(12)
      };
      
      let idatChunks = chunks.map(v => v.type === 'idat' ? v : C.skip);
      let cmpImageData = Buffer.concat(idatChunks.map(idat => idat.data));
      
      let { w, h } = ihdrChunk.ihdr;
      let imageData = await Promise((r, e) => require('zlib').inflate(cmpImageData, (err, b) => err ? e(err) : r(b)));
      let bytesPerLine = imageData.length / h;
      let bytesPerPx = (bytesPerLine - 1) / w;
      let scanLines = Array.fill(h, y => imageData.slice(bytesPerLine * y, bytesPerLine * (y + 1)));
      
      let pixelData = [];
      for (let i = 0; i < scanLines.length; i++) {
        
        let lastLine = i > 0 ? pixelData[i - 1] : null;
        let method = scanLines[i][0];
        let data = scanLines[i].slice(1);
        let unfilteredLine = Buffer.alloc(data.length);
        pixelData.push(unfilteredLine);
        
        let defiltFns = {
          0: () => {
            for (let x = 0; x < bytesPerLine; x++) unfilteredLine[x] = data[x];
          },
          1: () => {
            let xBiggerThan = bytesPerPx - 1;
            for (let x = 0; x < bytesPerLine; x++) {
              let rawByte = data[1 + x];
              let f1Left = x > xBiggerThan ? unfilteredLine[x - bytesPerPx] : 0;
              unfilteredLine[x] = rawByte + f1Left;
            }
          },
          2: () => {
            for (let x = 0; x < bytesPerLine; x++) {
              let rawByte = data[1 + x];
              let f2Up = lastLine ? lastLine[x] : 0;
              unfilteredLine[x] = rawByte + f2Up;
            }
          },
          3: () => {
            let xBiggerThan = bytesPerPx - 1;
            for (let x = 0; x < bytesPerLine; x++) {
              let rawByte = data[1 + x];
              let f3Up = lastLine ? lastLine[x] : 0;
              let f3Left = x > xBiggerThan ? unfilteredLine[x - bytesPerPx] : 0;
              let f3Add = Math.floor((f3Left + f3Up) / 2);
              unfilteredLine[x] = rawByte + f3Add;
            }
          },
          4: () => {
            let xBiggerThan = bytesPerPx - 1;
            for (let x = 0; x < bytesPerLine; x++) {
              let rawByte = data[1 + x];
              let f4Up = lastLine ? lastLine[x] : 0;
              let f4Left = x > xBiggerThan ? unfilteredLine[x - bytesPerPx] : 0;
              let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - bytesPerPx] : 0;
              let f4Add = paeth(f4Left, f4Up, f4UpLeft);
              unfilteredLine[x] = rawByte + f4Add;
            }
          }
        };
        defiltFns[method]();
        
      }
      
      let min = +1000000, max = -1000000;
      let pixels = Array.fill(h, () => Array.fill(w));
      for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) {
        let [ r, g, b, a ] = pixelData[y].slice(x * bytesPerPx);
        let lum = Math.sqrt(r * r * 0.241 + g * g * 0.691 + b * b * 0.068);
        if (lum < (0.27 * 255)) lum = 0;
        if (lum < min) min = lum;
        if (lum > max) max = lum;
        pixels[y][x] = { r, g, b, lum };
      }}
      
      let normMult = 1 / (max - min);
      for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) {
        pixels[y][x].lum = (pixels[y][x].lum - min) * normMult;
      }}
      
      return { w, h, pixels };
    };
    let pixelsToPng = async pngBuff => {
      
    };
    
    let asciiKeep = await foundation.seek('keep', 'fileSystem', ...ascii.path);
    let { w, h, pixels } = await pngToPixels(await asciiKeep.getContent());
    
    let graphicKeep = await foundation.seek('keep', 'fileSystem', '..', '..', '..', 'users', 'gersmaes', 'desktop', 'graphic.png');
    let graphicPng = await pngToPixels(await graphicKeep.getContent());
    
    let numHorz = Math.floor(w / ascii.w);
    let numVert = Math.floor(h / ascii.h);
    let showPixels = (px, msg='') => {
      console.log(`-`.repeat(px[0].count() * 2 + 2), msg);
      for (let row of px) {
        console.log('|' + row.map(v => (v > 0.5) ? 'XX' : '  ').join('') + '|');
      }
      console.log(`-`.repeat(px[0].count() * 2 + 2));
    };
    
    let testShow = img => {
      console.log(img.map(row => row.map(v => {
        if (v < 0.2) return ' ';
        if (v < 0.4) return '.';
        if (v < 0.7) return '-';
        return 'X';
      }).join('')).join('\n'));
    };
    
    let AsciiPicker = U.inspire({ name: 'PixelPicker', methods: (insp, Insp) => ({
      
      init: function(w, h, numLums=10) {
        this.w = w;
        this.h = h;
        this.choices = {};
        this.lumChoices = Array.fill(numLums, () => ({}));
      },
      reduce: function() {
        this.lumChoices = this.lumChoices.map(v => v.isEmpty() ? C.skip : v);
      },
      lumInd: function(lum) {
        
        let ind = Math.round(lum * this.lumChoices.count());
        return Math.min(ind, this.lumChoices.count() - 1);
        
      },
      include: function(char, image, lum=this.imageLum(image)) {
        this.choices[char] = { lum, image };
        this.lumChoices[this.lumInd(lum)][char] = image;
      },
      
      imageDims: function(pixels) {
        let h = pixels.count();
        let w = pixels[0].count();
        for (let i = 1; i < pixels.count(); i++) if (pixels[i].count() !== w) throw Error(`Non-rectangular`);
        return { w, h };
      },
      imageLum: function(img) {
        let dims = this.imageDims(img);
        let b = 0;
        for (let y = 0; y < dims.h; y++) for (let x = 0; x < dims.w; x++) b += img[y][x];
        return b / (dims.w * dims.h);
      },
      imageDiff: function(image1, image2) {
        
        let dims1 = this.imageDims(image1);
        let dims2 = this.imageDims(image2);
        if (dims1.w !== dims2.w) throw Error(`Width mismatch`);
        if (dims1.h !== dims2.h) throw Error(`Height mismatch`);
        
        let diff = 0;
        for (let y = 0; y < dims1.h; y++) { for (let x = 0; x < dims1.w; x++) {
          let v1 = image1[y][x];
          let v2 = image2[y][x];
          if (!U.isType(v1, Number) || !U.isType(v2, Number)) {
            throw Error(`Invalid @ ${x},${y} (${v1}, ${v1}) (${dims1.w} x ${dims1.h})`);
          }
          diff += (v1 - v2) * (v1 - v2);
        }}
        return diff / (dims1.w * dims1.h);
        
      },
      nearest: function(image, lum=this.imageLum(image)) {
        
        let ind = this.lumInd(lum);
        let dir = (ind > this.lumChoices.count() >> 1) ? -1 : +1;
        let choices = {};
        while (choices.isEmpty()) {
          choices = this.lumChoices[ind];
          ind += dir;
          if (ind >= this.lumChoices.count() || ind < 0) break;
        }
        
        let best = { diff: 1, char: '?' };
        for (let char in choices) {
          let diff = this.imageDiff(choices[char], image);
          if (diff < best.diff) best = { diff, char, image: choices[char] };
        }
        
        return best;
        
      },
      tryInclude: function(char, image) {
        
        if (complexChars.has(char.code())) return;
        
        
        let lum = this.imageLum(image);
        let { diff, char: char0 } = this.nearest(image, lum) || {};
        if (diff === 0) return;
        this.include(char, image, lum);
        
      },
      imageToAscii: function(image) {
        
        let { w, h } = this.imageDims(image);
        let charsVert = Math.floor(h / this.h);
        let charsHorz = Math.floor(w / this.w);
        
        return Array.fill(charsVert, cy => Array.fill(charsHorz, cx => {
          
          let cnt = cy * charsHorz + cx;
          
          if (cnt % 100 === 0) console.log(`Filled ${cnt} / ${charsVert * charsHorz} regions`);
          
          let offY = cy * this.h;
          let offX = cx * this.w;
          let regionImage = Array.fill(this.h, y => Array.fill(this.w, x => image[offY + y][offX + x]));
          return this.nearest(regionImage).char;
          
        }));
        
      }
      
    })});
    
    console.log('Loading...');
    
    let asciiPicker = AsciiPicker(ascii.w, ascii.h, 300);
    
    for (let yy = 0; yy < numVert; yy++) { for (let xx = 0; xx < numHorz; xx++) {
      
      let yOff = yy * ascii.h;
      let xOff = xx * ascii.w;
      let img = Array.fill(ascii.h, y => Array.fill(ascii.w, x => pixels[yOff + y][xOff + x].lum));
      
      let code = yy * numHorz + xx;
      //if (code > 90 && code < 100) showPixels(img);
      //showPixels(img, `${code}: "${charReplace(String.fromCharCode(code))}" (${asciiPicker.imageLum(img)})`);
      
      asciiPicker.tryInclude(String.fromCharCode(code), img);
      
      if (code % 100 === 0) console.log(`Mapped ${code} / ${numVert * numHorz} ascii chars`);
      
    }}
    asciiPicker.reduce();
    console.log(asciiPicker.lumChoices.map((obj, lum) => `${lum}: ${Object.keys(obj).join('')}`).join('\n'));
    
    //console.log(asciiPicker.lumChoices.map((obj, lum) => `${lum}: ${obj.toArr(v => v).count()}`));
    
    console.log('Loaded; processing:');
    let graphicImg = graphicPng.pixels.map(row => row.map(v => v.lum));
    //let graphicImg = Array.fill(200, y => Array.fill(200, x => x / 200));
    
    let asciiRender = asciiPicker.imageToAscii(graphicImg);
    console.log(asciiRender.map(ln => '- ' + ln.join('') + ' -').join('\n'));
    console.log(asciiRender.slice(-1)[0].slice(-1)[0].code());
    process.exit(0);
    
    return asciiPicker;
    
  })();
  
  //process.exit();
  
  let { Nozz } = U.water;
  
  let redraw = async () => {
    
    let w = process.stdout.columns;
    let h = process.stdout.rows - 1;
    let buffer = Array.fill(h, () => Array.fill(w, () => ' '));
    let modBuffer = Array.fill(h, () => Array.fill(w, () => Set()));
    let setBuff = (x, y, c, mods=[]) => {
      
      if (y < 0 || y >= buffer.length) return;
      
      let cursor = 0;
      for (let char of c) {
        let xx = x + cursor++;
        if (xx >= buffer[y].length) return;
        buffer[y][xx] = char;
        for (let mod of mods) modBuffer[y][xx].add(mod);
      }
      
    };
    
    let missedLogs = [];
    let oldConsoleLog = console.log;
    console.log = (...args) => missedLogs.push(args);
    rootReal.render(setBuff, 0, 0, w, h);
    console.log = oldConsoleLog;
    
    //console.clear();
    let fullScreenText = buffer.map((row, y) => {
      
      let processedRow = row.map((char, x) => {
        
        return applyMods(char, modBuffer[y][x]);
        
      });
      
      return processedRow.join('');
      
    }).join('\n');
    
    console.log(buffer.map(row => row.map(charReplace).join('')).join('\n'));
    
    for (let ml of missedLogs) console.log(...ml);
    
  };
  
  let w = process.stdout.columns;
  let h = process.stdout.rows - 1;
  let rows = Array.fill(h, y => Array.fill(w, x => charReplace(String.fromCharCode(y * w + x))));
  for (let row of rows) console.log(row.join(''));
  process.exit(0);
  
  let Real = U.inspire({ name: 'Real', methods: (insp, Insp) => ({
    init: function({ name=null, size={ w: 3, h: 3 } }) {
      this.name = name;
      this.updateNozz = Nozz();
      this.size = size;
    },
    render: function(setBuff, x, y, w, h) { return C.noFn('render').call(this); }
  })});
  let RealFlow = U.inspire({ name: 'RealFlow', insps: { Real }, methods: (insp, Insp) => ({
    init: function({ name, axis='y', dir='+', elems=[], fillElem=null, borderChars={} }) {
      insp.Real.init.call(this, { name });
      this.axis = axis;
      this.dir = dir;
      this.elems = elems;
      this.fillElem = fillElem;
      this.borderChars = {
        horz: '-', vert: '|',
        tl: '+', tr: '+', bl: '+', br: '+',
        ...borderChars
      };
    },
    render: function(setBuff, x, y, w, h) {
      
      for (let xx = x; xx < x + w; xx++) setBuff(xx, y, this.borderChars.horz);
      for (let xx = x; xx < x + w; xx++) setBuff(xx, y + h - 1, this.borderChars.horz);
      for (let yy = y; yy < y + h; yy++) setBuff(x, yy, this.borderChars.vert);
      for (let yy = y; yy < y + h; yy++) setBuff(x + w - 1, yy, this.borderChars.vert);
      setBuff(x, y, this.borderChars.tl);
      setBuff(x + w - 1, y, this.borderChars.tr);
      setBuff(x, y + h - 1, this.borderChars.bl);
      setBuff(x + w - 1, y + h - 1, this.borderChars.br);
      
      let dist = 1;
      let getOff = (this.dist === '+')
        ? (o, v, e=0) => (o + dist)
        : (o, v, e=0) => (o + v - dist - e);
      
      let fy = (this.axis === 'y') ? (y + 0) : null;
      let fx = (this.axis === 'x') ? (x + 0) : null;
      let fw = (this.axis === 'y') ? (w - 2) : null;
      let fh = (this.axis === 'x') ? (h - 2) : null;
      for (let elem of this.elems) {
        
        let [ ew, eh ] = [ fw || elem.size.w, fh || elem.size.h ];
        
        let [ ex, ey ] = [ (fx || x) + 1, (fy || y) + 1 ];
        if (this.axis === 'y') ey = getOff(y, h, eh); //(this.dist === '+') ? (y + dist) : (y + h - eh - dist);
        if (this.axis === 'x') ex = getOff(x, w, ew); //(this.dist === '+') ? (x + dist) : (x + w - ew - dist);
        
        elem.render(setBuff, ex, ey, ew, eh);
        dist += (this.axis === 'y') ? eh : ew;
        
      }
      
      if (this.fillElem) {
        if (this.axis === 'y' && dist < h) this.fillElem.render(setBuff, x + 1, getOff(y, h, h - dist - 1), fw, h - dist - 1);
        if (this.axis === 'x' && dist < w) this.fillElem.render(setBuff, getOff(x, w, w - dist - 1), y + 1, w - dist - 1, fh);
      }
      
    }
  })});
  let RealTextBox = U.inspire({ name: 'RealTextBox', insps: { Real }, methods: (insp, Insp) => ({
    init: function({ name, size, bgChar=String.fromCharCode(721) }) {
      insp.Real.init.call(this, { name, size });
      this.text = '';
      this.bgChar = bgChar;
      this.scroll = 0;
    },
    render: function(setBuff, x, y, w, h) {
      
      for (let xx = x; xx < x + w; xx++) { for (let yy = y; yy < y + h; yy++) {
        setBuff(xx, yy, this.bgChar);
      }}
      
      let lines = this.text.split('\n').slice(this.scroll);
      lines.slice(0, h).forEach((ln, n) => setBuff(x, y + n, ln.slice(0, w)));
      
    }
  })});
  let RealFill = U.inspire({ name: 'RealFill', insps: { Real }, methods: (insp, Insp) => ({
    init: function({ name, size, bgChar='#', bgMods=[] }) {
      insp.Real.init.call(this, { name, size });
      this.bgChar = bgChar;
      this.bgMods = bgMods;
    },
    render: function(setBuff, x, y, w, h) {
      for (let xx = x; xx < x + w; xx++) { for (let yy = y; yy < y + h; yy++) {
        setBuff(xx, yy, this.bgChar, this.bgMods);
      }}
    }
  })});
  
  let readline = require('readline');
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  
  let input = RealTextBox({ size: { w: 100, h: 10 } });
  let disp = RealTextBox({ size: { w: 0, h: 0 }, bgChar: ' ' });
  let sep = RealFill({ size: { w: 1, h: 1 }, bgChar: '=' });
  let rootReal = RealFlow({ axis: 'y', dir: '-', elems: [ input, sep ], fillElem: disp });
  
  let o = {};
  let history = [];
  let cycling = 0;
  let showKeys = false;
  
  process.stdin.on('keypress', async (str, params) => {
    
    let { sequence, name, ctrl, meta, shift } = params;
    if (ctrl && name.lower() === 'c') process.exit(0);
    
    if (showKeys) disp.text = `"${name}": ${sequence}, [ ${sequence.split('').map(v => v.charCodeAt(0)).join(', ')} ], ${JSON.stringify({ meta, ctrl, shift })}`;
    
    let seq = Array.fill(sequence.count(), i => sequence.charCodeAt(i));
    
    let cyclePrev = cmpSeq(seq, [ 27, 27, 91, 68 ]);
    let cycleNext = cmpSeq(seq, [ 27, 27, 91, 67 ]);
    
    if (cyclePrev || cycleNext) {
      
      disp.scroll = 0;
      
      if (history.length) {
        
        if (cyclePrev) cycling++;
        if (cycleNext) cycling--;
        
        if (cycling < 0) cycling = 0;
        if (cycling >= history.length) cycling = (history.length - 1);
        
        let histInd = (history.length - 1) - cycling;
        disp.text = history.map((v, i) => {
          return v.split('\n').map(v => v.trim() || C.skip).map(ln => `${(histInd === i) ? '>> ' : '   '}${ln}`).join('\n');
        }).join('\n');
        
        input.text = history[histInd];
        
      } else {
        
        disp.text = '-- no history --';
        
      }
      
    } else {
      
      cycling = 0;
      
    }
    
    if (cmpSeq(seq, [ 8 ])) { // regular backspace
      
      input.text = input.text.slice(0, -1);
      
    } else if (cmpSeq(seq, [ 127 ])) { // ctrl-backspace (delete word)
      
      input.text = input.text.trimEnd().split(' ').slice(0, -1).join(' ');
      
    } else if (cmpSeq(seq, [ 27, 8 ])) { // alt-backspace (delete all)
      
      input.text = '';
      
    } else if (cmpSeq(seq, [ 10 ])) { // enter (submit for eval)
      
      let command = input.text;
      cycling = history.length - 1;
      
      disp.scroll = 0;
      input.text = '';
      
      history.push(command);
      
      let result = null;
      try {
        result = await eval(command);
      } catch(err) {
        result = foundation.formatError(err);
      }
      
      try {
        disp.text = (U.isType(result, String) ? result : JSON.stringify(result, null, 2)) || '';
      } catch(err) {
        disp.text = `Couldn't format value of type ${U.nameOf(result)}`;
      }
      
    } else if (cmpSeq(seq, [ 13 ])) { // return (line feed)
      
      input.text += '\n';
      
    } else if (sequence.count() === 1) {
      
      input.text += sequence;
      
    }
    
    redraw();
    
  });
  process.stdout.on('resize', redraw);
  redraw();
  
}});
