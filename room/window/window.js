U.buildRoom({ name: 'window', innerRooms: [], build: (foundation) => ({
  open: async () => {
    
    let toBinary = b => {
      let ret = [];
      for (let byte of b) for (let i = 0; i < 8; i++) ret.push(!!(byte & (1 << i)));
      return ret;
    };
    let toBinaryStr = b => {
      return toBinary(b).map(v => v ? 'X' : '-').join('');
    };
    let posMod = (n, d) => {
      let ret = n % d;
      if (ret < 0) ret += d;
      return ret;
    };
    let paeth = (l, u, ul) => {
      let pL = Math.abs(u - ul);
      let pU = Math.abs(l - ul);
      let pUL = Math.abs(l + u - ul * 2);

      if (pL <= pU && pL <= pUL) return l;
      if (pU <= pUL) return u;
      return ul;
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
    let modCode = (...codes) => codes.map(v => `\x1b[${v}m`).join('');
    let modMapping = {
      red: modCode(91, 39),
      green: modCode(92, 39),
      yellow: modCode(93, 39),
      blue: modCode(94, 39),
      bold: modCode(1, 22),
      dim: modCode(2, 22),
      italic: modCode(3, 22),
      underline: modCode(4, 22)
    };
    let applyMods = (text, mods) => {
      
      if (mods.isEmpty()) return text;
      let modPrefix = mods.toArr(v => modMapping[v]).join('');
      return `${modPrefix}${text}\x1b[0m`;
      
    };
    
    let asciiPicker = await (async () => {
      
      let { ascii } = foundation.origArgs;
      
      let parsePng = async pngBuff => {
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
          //let { method, data } = scanLines[i];
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
      
      let asciiKeep = await foundation.seek('keep', 'fileSystem', ...ascii.path);
      let { w, h, pixels } = await parsePng(await asciiKeep.getContent());
      
      let graphicKeep = await foundation.seek('keep', 'fileSystem', '..', '..', '..', 'users', 'gersmaes', 'desktop', 'graphic.png');
      let graphicPng = await parsePng(await graphicKeep.getContent());
      
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
    
  }
})});
