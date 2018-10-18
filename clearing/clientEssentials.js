O.include(U, {
  makeTwig: ({ name, abbreviation=name.substr(0, 3), make, twigs=[] }) => {
    
    if (O.has(TWIGS, name)) throw new Error(`Tried to overwrite twig "${name}"`);
    if (abbreviation.length !== 3) throw new Error(`Abbreviation "${abbreviation}" should be length 3`);
    
    let material = {};
    return TWIGS[name] = {
      
      name: name,
      abbreviation: abbreviation,
      material: material,
      promise: (async () => {
        
        // Allow all twigs to become ready
        await Promise.all(A.map(twigs, twigName => TWIGS[twigName].promise));
        
        // Run our `make` function, providing all listed twigs
        let makeParams = A.include([ material ], A.map(twigs, twigName => TWIGS[twigName].material));
        make(...makeParams);
        
      })()
      
    };
    
  },
  Compiler: U.makeClass({ name: 'Compiler', methods: (insp, Cls) => ({
    
    init: function({ offsetData }) {
      
      this.offsetData = offsetData;
      
    },
    mapLineToFile: function(lineInd) {
      
      let last = null;
      for (var fileName in this.offsetData) {
        // TODO: Weird error where `last` is still `null` at this point. For now, use `fileName` if `last === null`
        if (this.offsetData[fileName].lineOffset > lineInd) return last || fileName;
        last = fileName;
      }
      return last;
      
    },
    mapLineToSource: function(file, lineInd) {
      
      if (!O.has(this.offsetData, file)) throw new Error(`Invalid file: ${file}`);
      
      let offsetData = this.offsetData[file];
      let offsets = offsetData.offsets;
      
      lineInd -= (offsetData.lineOffset - 1);
      
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
      
      return srcLineInd;
      
    },
    customFormatError: function(err) {
      
      let msg = err.message;
      let type = err.constructor.name;
      let stack = err.stack;
      
      let traceBeginSearch = msg.trim() ? `${type}: ${msg}\n` : `${type}\n`;
      let traceInd = stack.indexOf(traceBeginSearch);
      let trace = (traceInd >= 0 ? stack.substr(traceInd + traceBeginSearch.length) : stack).trim();
      
      let lines = A.map(S.split(trace, '\n'), line => {
        
        // Note: Some lines look like
        //    "method@http://localhost/?arg1=val1&arg2=val2:847:22"
        // while others are more streamlined:
        //    "@http://localhost/?arg1=val1&arg2=val2:847:22"
        
        let match = line.match(/:([0-9]+):([0-9]+)/);
        if (!match) {
          U.output('Couldn\'t process trace line: ' + line);
          return U.SKIP;
        }
        
        let lineInd = parseInt(match[1], 10);
        let charInd = parseInt(match[2], 10);
        
        let file = this.mapLineToFile(lineInd);
        if (!file) throw new Error(`Couldn\'t get file from lineInd ${lineInd}`);
        
        let srcLineInd = this.mapLineToSource(file, lineInd);
        
        return S.endPad(file, ' ', 32) + ' -- ' + S.endPad(srcLineInd.toString(), ' ', 10) + '|';
        
      });
      
      let content = lines.join('\n');
      if (!content.trim().length) content = 'Couldn\'t format error:\n' + trace;
      
      return '/----------------\n' +
        S.indent(traceBeginSearch.trim(), ' | ') + '\n' +
        '\\----------------\n' +
        content;
      
    },
    formatError: function(err) {
      
      // return err.stack;
      
      try {
        
        return this.customFormatError(err);
        
      } catch(err) {
        
        return 'Couldn\'t format: ' + err.stack;
        
      }
      
    },
    run: async function(twigName, variant='client') {
      
      if (!O.has(TWIGS, twigName)) throw new Error(`Invalid "twigName" param: ${twigName}`);
      let twig = TWIGS[twigName];
      
      await twig.promise;
      return twig.material;
      
    }
    
  })})
});
