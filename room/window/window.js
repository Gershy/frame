U.buildRoom({ name: 'window', innerRooms: [], build: (foundation) => ({
  open: async () => {
    
    let { Nozz } = U.water;
    
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
    
    let charReplace = c => {
      let code = c.charCodeAt(0);
      if (code < 32) return ' ';
      if (code === 155) return ' ';
      return c;
    };
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
    
    let o = {};
    let history = [];
    let cycling = 0;
    let showKeys = false;
    
    process.stdin.on('keypress', (str, params) => {
      
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
            return ((histInd === i) ? `>> ` : `   `) + v
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
          result = eval(command);
        } catch(err) {
          result = foundation.formatError(err);
        }
        
        disp.text = (U.isType(result, String) ? result : JSON.stringify(result, null, 2)) || '';
        
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
