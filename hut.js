/*

==== ROADMAP

[X]   - Standard setup + utility library        Emptied Object prototype enables `in` over `hasOwnProperty`
[ ]     - Standard start + stop paradigm
[X]     - Mixins and Classes (the same!)
[X]     - Function argument validation          Declarative (or ES7-style?)
[ ]   - Compilation                             Line-finding on client-side
[X]   - Environment fitting                     Extensible list of supported environments
[ ]     - Automatic localNetwork ip detection
[ ]   - Package definition                      TRIVIAL TO COMBINE PACKAGES (twigs)
[ ]     - Dependency resolution                 Works with promises
[ ]       - Server-side (easy)
[ ]       - Client-side                         Generate dependency tree all at once
[-]     - Package tests
[ ]   - Data definition                         Better atomicity than current Editor
[ ]   - Data access                             Read and write both async, in preparation for persistence
[ ]     - Persistence
[ ]   - Network communication                   Defined as a twig - all network data (e.g. active sessions) available in Dossier-like format. Ordered operations. Confirmation for some actions.


==== IMPROVEMENTS

[X]   - Emptied object prototype
[ ]   - Start/stop paradigm
[X]   - Declarative function argument validation
[ ]   - Debug line-finding on client-side
[ ]   - Extensible list of environment bindings (heroku, openshift, etc)
[ ]   - Automatic IP detection for localNetwork deployment
[ ]   - Trivial package combination
[ ]   - Dependencies required in promised format
[ ]   - Dependency tree generated all at once
[ ]   - Editor actions with atomicity (immediate!)
[ ]   - Network + session data is a twig
[ ]   - Ordered network operations
[ ]   - Network confirmation for some operations?
[ ]   - Streaming where appropriate?


If network data is hut-like, then data definition and access must be defined first.
Could define a network-less Actionizer, and then network communication can subclass this

==== ENVIRONMENT FITTING
Environment encompasses:
  - server-side session info (host/port, which may already be provided by the environment)
  - filesystem accessor data
  - deployment mode (localMachine, localNetwork, global... maybe more?)
  - command-line arguments which can include:
    - name of the hut to enter
    - arbitrary arguments for the hut

*/
require('./clearing/essentials.js');
U.withProto(() => require('./clearing/serverEssentials.js'));

const fs = U.withProto(() => require('fs'));
const path = U.withProto(() => require('path'));

const Compiler = U.makeClass({ name: 'Compiler', methods: (insp, Cls) => ({
  
  init: function({ twigDir, variantDefs }) {
    
    this.twigDir = path.normalize(twigDir);
    this.rootDir = path.join(twigDir, '..');
    this.variantDefs = variantDefs || {};
    
    this.fileVariants = {};
    
  },
  compile: function(twigName) {
    
    let twigFileDir = path.join(this.twigDir, twigName);
    
    let fileName = path.join(twigFileDir, `${twigName}.js`);
    let contents = fs.readFileSync(fileName).toString();
    
    this.fileVariants[twigName] = {};
    
    O.map(this.variantDefs, (variantDef, variantName) => {
      
      let fullPath = path.join(this.twigDir, twigName, `cmp-${variantName}-${twigName}.js`);
      let requirePath = `./twig/${twigName}/cmp-${variantName}-${twigName}.js`;
      
      let cmpFileData = this.compileFile(contents, variantName, variantDef);
      fs.writeFileSync(fullPath, cmpFileData.content, { flag: 'w' });
      
      this.fileVariants[twigName][variantName] = {
        fullPath: fullPath,
        requirePath: requirePath,
        offsets: cmpFileData.offsets,
        twig: null
      };
      
    });
    
  },
  compileFile: function(content, variant, variantDef) {
    
    let lines = content.split('\n');
    
    let blocks = [];
    let currentBlock = null;
    
    for (let i = 0; i < lines.length; i++) {
      
      let line = lines[i].trim();
      
      if (currentBlock) {
        
        if (S.has(line, '=' + currentBlock.type.toUpperCase() + '}')) {
          
          currentBlock.end = i;
          blocks.push(currentBlock);
          currentBlock = null;
          
        }
        
      }
      
      if (!currentBlock) { // The previous code block may set `currentBlock` to `null`
        
        for (let k in variantDef) {
          
          if (!S.has(line, '{' + k.toUpperCase() + '=')) continue;
          
          // Found the beginning of a new block
          currentBlock = {
            type: k,
            start: i,
            end: -1
          };
          
          break;
            
        }
        
      }
      
    }
    
    if (currentBlock) throw new Error('Last ' + currentBlock.type + ' block has no delimiter');
    
    let currentOffset = null;
    let offsets = [];
    let nextBlockInd = 0;
    let filteredLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      
      let lineSmp = lines[i].trim();
      
      if (!currentBlock && blocks[nextBlockInd] && blocks[nextBlockInd].start === i) {
        currentBlock = blocks[nextBlockInd];
        nextBlockInd++;
      }
      
      // Filter out blank lines. Filter out all block delimiters, and the contents of any 'remove' blocks.
      let keepLine = true;
      // if (!lines[i].trim().length) keepLine = false; // TODO: Remove empty lines?
      if (currentBlock && i === currentBlock.start) keepLine = false; // Remove block start definition
      if (currentBlock && i === currentBlock.end) keepLine = false;   // Remove block end definition
      if (currentBlock && variantDef[currentBlock.type] === 'remove') keepLine = false; // Remove remove-type blocks
      
      if (keepLine) {
        
        currentOffset = null;
        filteredLines.push(lines[i]);
        
      } else {
        
        if (!currentOffset) {
          currentOffset = { at: i, offset: 0 };
          offsets.push(currentOffset);
        }
        currentOffset.offset++;
        
      }
      
      if (currentBlock && i === currentBlock.end) {
        
        currentBlock = null;
        
        if (blocks[nextBlockInd] && blocks[nextBlockInd].start === i) {
          currentBlock = blocks[nextBlockInd];
          nextBlockInd++
        }
      }
      
    }
    
    // U.output(`---- FILTERED (${variant}):\n\n` + filteredLines.join('\n'));
    
    return {
      offsets: offsets,
      content: filteredLines.join('\n')
    };
    
  },
  getVariantData: function(twigName, variant) {
    if (!this.fileVariants[twigName]) this.compile(twigName);
    return this.fileVariants[twigName][variant];
  },
  getVariantDataByFile: function(filename, variant) {
    for (var k in this.fileVariants)
      if (this.fileVariants[k][variant].fullPath === filename) return this.fileVariants[k][variant];
    return null;
  },
  run: async function(twigName, variant) {
    
    let variantData = this.getVariantData(twigName, variant);
    if (!variantData) throw new Error(`No twig "${twigName}" (variant: ${variant})`);
    
    if (!variantData.twig) {
      
      U.withProto(() => require(variantData.requirePath));
      await TWIGS[twigName].promise;
      
      variantData.twig = TWIGS[twigName].material;
      
    }
    
    
    return variantData.twig;
    
  },
  
  mapLineToSource: function(file, lineInd) {
    
    file = path.normalize(file);
    let filePcs = file.split(path.sep);
    let fileNameData = filePcs[filePcs.length - 1].match(/^cmp-([^-]+)-(.+)\.js/);
    if (!fileNameData) return null;
    
    let variant = fileNameData[1];
    let twigName = fileNameData[2];
    let variantData = this.getVariantData(twigName, variant);
    if (!variantData) return null;
    
    let offsets = variantData.offsets;
    
    let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
    let nextOffset = 0; // The index of the next offset chunk which may take effect
    for (let i = 0; i < lineInd; i++) {
      
      // Find all the offsets which exist for the source line
      // For each offset, increment the line in the source file
      // Lines in the source file are always AHEAD of lines in
      // the compiled files.
      while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
        srcLineInd += offsets[nextOffset].offset;
        nextOffset++;
      }
      
      srcLineInd++;
      
    }
    
    return {
      twigName: twigName,
      lineInd: srcLineInd
    };
    
  },
  formatError: function(err, variant='server') {
    
    let msg = err.message;
    let type = err.constructor.name;
    let stack = err.stack;
    
    let traceBeginSearch = `${err.constructor.name}: ${msg}\n`;
    let traceBegins = stack.indexOf(traceBeginSearch) + traceBeginSearch.length;
    let trace = stack.substr(traceBegins);
    
    let lines = A.map(trace.split('\n'), line => {
      
      // Note: Some lines look like
      //    "    at Function.Module (internal/modules/cjs/loader.js:69:100)"
      // while others are more streamlined:
      //    "    at internal/modules/cjs/loader.js:69:100"
      
      let match = line.match(/^\s+ at (.+ )?\(?(.+):([0-9]+):([0-9]+)\)?$/);
      if (!match) return U.SKIP;
      
      let loc = match[1];
      let file = path.normalize(match[2]);
      let lineInd = match[3];
      let charInd = match[4];
      
      if (!S.startsWith(file, this.rootDir)) return U.SKIP;
      
      let mappedLineData = this.mapLineToSource(file, lineInd);
      
      if (mappedLineData) {
        file = path.normalize(`twig/${mappedLineData.twigName}/${mappedLineData.twigName}.cmp`);
        lineInd = mappedLineData.lineInd;
      } else {
        file = file.substr(this.rootDir.length + 1);
      }
      
      /*let variantData = this.getVariantDataByFile(file, variant);
      
      // Trim off the base directory of the file for legibility
      file = file.substr(this.rootDir.length + 1);
      
      // Map lines in compiled files to lines in the source file
      if (variantData) {
        
        let offsets = variantData.offsets;
        
        let srcLineInd = 0; // The line of code in the source which maps to the line of compiled code
        let nextOffset = 0;
        
        for (let i = 0; i < lineInd; i++) {
          
          // Find all the offsets which exist for the source line
          // For each offset, increment the line in the source file
          // Lines in the source file are always AHEAD of lines in
          // the compiled files.
          while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
            srcLineInd += offsets[nextOffset].offset;
            nextOffset++;
          }
          
          srcLineInd++;
          
        }
        
        let filePcs = file.split(path.sep);
        let fileTypeData = filePcs[filePcs.length - 1].match(/^cmp-(.+)-(.+)\.js$/);
        filePcs[filePcs.length - 1] = fileTypeData[2] + '.src';
                
        file = filePcs.join(path.sep);  // Reformat the filename
        lineInd = srcLineInd;           // Give the line index in the source file
        
      }*/
      
      return S.endPad(file, ' ', 37) + ' -- ' + S.endPad(lineInd.toString(), ' ', 10) + '|';
      
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
    
    // return err.stack;
    
    return '/----------------\n' +
      S.indent(moreData, ' | ') + '\n' +
      '\\----------------\n' +
      lines.join('\n');
    
  }
  
})});

let compiler = global.COMPILER = Compiler({
  twigDir: path.join(__dirname, 'twig'),
  variantDefs: {
    server: {
      client: 'remove',
      server: 'keep'
    },
    client: {
      client: 'keep',
      server: 'remove'
    }
  }
});
process.on('uncaughtException', err => {
  U.output('---- UNCAUGHT');
  U.output(compiler.formatError(err));
  process.exit(1);
});
process.on('unhandledRejection', err => {
  U.output('---- UNHANDLED');
  U.output(compiler.formatError(err));
  process.exit(1);
});

(async () => {
  let clearing = await compiler.run('clearing', 'server');
  let deployment = clearing.deployment;
  await compiler.run(deployment.hut, 'server');
})();
