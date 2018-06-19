const fs = require('fs');
const path = require('path');

O.include(U, {
  makeTwig: ({ name, abbreviation=name.substr(0, 3), make, twigs=[] }) => {
    
    if (O.has(TWIGS, name)) throw new Error(`Tried to overwrite twig "${name}"`);
    if (abbreviation.length !== 3) throw new Error(`Abbreviation "${abbreviation}" should be length 3`);
    
    A.each(twigs, twigName => COMPILER.run(twigName, 'server')); // Kick off the loading of each twig
    
    let material = {};
    let twigList = [];
    let seenTwigs = { [name]: true };
    return TWIGS[name] = {
      
      name,
      abbreviation,
      twigList,
      material,
      promise: (async () => {
        
        // Allow all twigs to become ready
        await Promise.all(A.map(twigs, twigName => TWIGS[twigName].promise));
        
        // Compile the twigList
        O.each(twigs, twigName => {
          let depTwigList = TWIGS[twigName].twigList;
          A.each(depTwigList, twigName => {
            // Make sure we're adding to the end of `seenTwigs`
            delete seenTwigs[twigName];
            seenTwigs[twigName] = true;
          });
        });
        
        twigList.push(...O.toArr(seenTwigs, (v, k) => k));
        
        // Run our `make` function, providing all listed twigs
        let makeParams = [ material ].concat(A.map(twigs, twigName => TWIGS[twigName].material));
        make(...makeParams);
        
      })()
      
    };
    
  },
  Compiler: U.makeClass({ name: 'Compiler', methods: (insp, Cls) => ({
    
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
        let requirePath = `../twig/${twigName}/cmp-${variantName}-${twigName}.js`;
        
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
    run: async function(twigName, variant='server') {
      
      let variantData = this.getVariantData(twigName, variant);
      if (!variantData) throw new Error(`No twig "${twigName}" (variant: ${variant})`);
      
      if (!variantData.twig) {
        
        require(variantData.requirePath);
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
      
      let traceBeginSearch = `${type}: ${msg}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let traceBegins = traceInd + traceBeginSearch.length;
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
        let lineInd = parseInt(match[3], 10);
        let charInd = parseInt(match[4], 10);
        
        if (!S.startsWith(file, this.rootDir)) return U.SKIP;
        
        let mappedLineData = this.mapLineToSource(file, lineInd);
        
        if (mappedLineData) {
          file = path.normalize(`twig/${mappedLineData.twigName}/${mappedLineData.twigName}.cmp`);
          lineInd = mappedLineData.lineInd;
        } else {
          file = file.substr(this.rootDir.length + 1);
        }
        
        return S.endPad(file, ' ', 32) + ' -- ' + S.endPad(lineInd.toString(), ' ', 10) + '|';
        
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
      
      return '/----------------\n' +
        S.indent(moreData, ' | ') + '\n' +
        '\\----------------\n' +
        content;
      
    }
    
  })})
});
