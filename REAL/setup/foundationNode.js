let [ path, fs ] = [ 'path', 'fs' ].map(v => require(v));

let rootDir = path.join(__dirname, '..');
let roomDir = path.join(rootDir, 'room');
let readFile = async (name, options='utf8') => {
  let err0 = new Error('');
  return new Promise((rsv, rjc) => fs.readFile(name, options, (err, c) => {
    if (err) {
      err0.message = `Couldn't read ${name}: ${err.message}`;
      return rjc(err0);
    }
    return rsv(c);
  }));
};
let writeFile = async(name, content, options='utf8') => {
  let err0 = new Error('');
  return new Promise((rsv, rjc) => fs.writeFile(name, content, options, (err, c) => {
    if (err) {
      err0.message = `Couldn't write ${name}: ${err.message}`;
      return rjc(err0);
    }
    return rsv(c);
  }));
};

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
    if (text !== text.trim()) throw new Error('Text has extra whitespace');
    this.text = text;
  },
  setProps: function(props) { this.props = props; },
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
  init: function({ hut, bearing, roomDir, variantDefs }) {
    insp.Foundation.init.call(this, { hut, bearing });
    this.roomsInOrder = [];
    this.variantDefs = variantDefs || {};
    this.compilationData = {};
  },
  
  // Compiling
  parsedDependencies: async function(roomName) {
    // Determine the inner rooms of `roomName` by parsing the file for the "innerRooms" property
    
    let roomFileContents = await readFile(path.join(roomDir, roomName, `${roomName}.js`));
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
    
    let contentLines = await readFile(path.join(roomDir, roomName, `${roomName}.js`));
    contentLines = contentLines.split('\n');
    
    this.compilationData[roomName] = {};
    
    for (let variantName in this.variantDefs) {
      let compiledFileName = path.join(roomDir, roomName, `${roomName}.${variantName}.js`);
      let { content: compiledContent, offsets } = this.compileContent(variantName, contentLines);
      await writeFile(compiledFileName, compiledContent, { flag: 'w', encoding: 'utf8' }); // Contents are written to disk
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
        
        //let codePointPcs = line.replace(pathSepReg, '/').match(/([^()[\] ]+):([0-9]+):([0-9]+)/);
        let codePointPcs = line.match(/([^()[\] ]+):([0-9]+):([0-9]+)/);
        let [ fileName, lineInd, charInd ] = codePointPcs.slice(1);
        
        // line = line.trim();
        // if (line.hasHead('at ')) line = line.substr(2).trim();
        // 
        // // Normalize all lines into the more verbose format
        // if (!line.endsWith(')')) line = `<unknown> (${line})`;
        // 
        // let linePcs = line.split(' ');
        // if (linePcs.length !== 2) throw new Error('Unexpected overall structure');
        // let [ scope, codePoint ] = linePcs;
        // 
        // if (!codePoint.hasHead('(') || !codePoint.hasTail(')')) new Error('No brackets');
        // codePoint = codePoint.substr(1, codePoint.length - 2); // Take off the brackets
        // 
        // if (codePoint.hasHead('<')) return U.SKIP; // Skip codePoints like this; they aren't descriptive (e.g. "at Array.forEach (<anonymous>)")
        // 
        // let codePointPcs = codePoint.match(/(.+):([0-9]+):([0-9]+)$/);
        // if (!codePointPcs) throw new Error('Exotic');
        // 
        // let [ fileName, lineInd, charInd ] = codePointPcs.slice(1);
        
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
  
  getPlatformName: function() { return 'nodejs'; },
  genInitBelow: async function(contentType) {
    if (contentType !== 'text/html') throw new Error(`Invalid content type: ${contentType}`);
    
    let doc = XmlElement(null, 'root');
    
    let doctype = doc.add(XmlElement('!DOCTYPE', 'singleton'));
    doctype.setProp('html');
    
    let html = doc.add(XmlElement('html', 'container'));
    
    let head = html.add(XmlElement('head', 'container'));
    let title = head.add(XmlElement('title', 'text', `Hut: ${this.hut}`));
    
    let setupScript = head.add(XmlElement('script', 'text'));
    setupScript.setProp('type', 'text/javascript');
    setupScript.setText('window.global = window;');
    
    
    let mainScript = head.add(XmlElement('script', 'text'));
    
    let files = [ 'setup/clearing.js', 'setup/foundation.js', 'setup/foundationBrowser.js' ]
      .concat(this.roomsInOrder.map(r => `room/${r}/${r}.below.js`));
    let contents = await Promise.all(files.map(f => readFile(path.join(rootDir, f))));
    let splitContents = new Array(files.length);
    for (let i = 0; i < files.length; i++) splitContents[i] = `// ==== File: ${files[i]}\n${contents[i]}`;
    contents = splitContents.join('\n\n') + '\n\n' + [
      '// ==== Initialization',
      'let { FoundationBrowser } = U.foundationClasses',
      `U.foundation = FoundationBrowser({ hut: '${this.hut}', bearing: 'below' });`,
      'U.foundation.install();'
    ].join('\n');
    
    mainScript.setProp('type', 'text/javascript');
    mainScript.setText(contents);
    
    let body = html.add(XmlElement('body', 'container'));
    let header = body.add(XmlElement('h1', 'text', this.hut));
    
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
