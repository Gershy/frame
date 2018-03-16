new PACK.pack.Package({ name: 'compile', buildFunc: function(cm) {
  
  var fs = require('fs');
  var path = require('path');
  
  var compiledPrefix = 'cmp-';
  
  cm.Compiler = U.makeClass({ name: 'Compiler',
    methods: function(sc, c) { return {
      
      init: function(params /* rootPath */) {
        this.rootPath = U.param(params, 'rootPath');
        this.fileVariants = {};
      },
      compile: function(appName) {
        
        this.fileVariants[appName] = {};
        
        var variantData = this.compile0(appName);
        
        for (var variantName in variantData) {
          
          this.fileVariants[appName][variantName] = O.update({
            
            requirePath: '../' + appName + '/' + compiledPrefix + variantName + '-' + appName + '.js',
            fullPath: path.join(this.rootPath, 'apps', appName, compiledPrefix + variantName + '-' + appName + '.js'),
            instance: null
            
          }, variantData[variantName]);
          
        }
        
      },
      hasCompiled: function(appName) {
        return O.contains(this.fileVariants, appName);
      },
      getVariantData: function(appName, variant) {
        if (!this.hasCompiled(appName)) this.compile(appName);
        return this.fileVariants[appName][variant];
      },
      getFullPath: function(appName) {
        return path.join(this.rootPath, 'apps', appName, appName + '.js');
      },
      getCompiledFullPath: function(appName, variant) {
        return this.getVariantData(appName, variant).fullPath;
      },
      run: function(appName, variant) {
        var variant = this.getVariantData(appName, variant);
        if (!variant.instance) variant.instance = require(variant.requirePath);
        return variant.instance;
      },
      
      compile0: function(appName) { throw new Error('not implemented'); },
      shapeError: function(err, variant) { throw new Error('not implemented'); }
      
    };}
  });
  cm.DefaultCompiler = U.makeClass({ name: 'DefaultCompiler', superclass: cm.Compiler,
    methods: function(sc, c) { return {
      
      init: function(params /* rootPath, directives */) {
        sc.init.call(this, params);
        this.directives = U.param(params, 'directives');
      },
      
      doCompile: function(content, directive) {
        content = content.split('\n');
        
        var blocks = [];
        
        var currentBlock = null;
        for (var i = 0; i < content.length; i++) {
          
          var line = content[i].trim();
          
          if (!currentBlock) {
            
            for (var k in directive) {
              if (S.contains(line, '{' + k.toUpperCase() + '=')) {
                
                var currentBlock = {
                  type: k,
                  start: i,
                  end: -1
                };
                
              }
            }
            
          } else {
            
            if (S.contains(line, '=' + currentBlock.type.toUpperCase() + '}')) {
              currentBlock.end = i;
              blocks.push(currentBlock);
              currentBlock = null;
            }
            
          }
          
        }
        
        if (currentBlock) throw new Error('Last ' + currentBlock.type + ' block has no delimiter');
        
        var currentOffset = null;
        var offsets = [];
        var currentBlock = null;
        var nextBlockInd = 0;
        var filteredLines = [];
        for (var i = 0; i < content.length; i++) {
          
          if (!currentBlock && blocks[nextBlockInd] && blocks[nextBlockInd].start === i) {
            currentBlock = blocks[nextBlockInd];
            nextBlockInd++;
          }
          
          // Filter out blank lines. Filter out all block delimiters, and the contents of any 'remove' blocks.
          var keepLine =
            content[i].trim() && (
              !currentBlock ||
              (i !== currentBlock.start && i !== currentBlock.end && directive[currentBlock.type] === 'keep')
            );
          
          if (keepLine) {
            
            currentOffset = null;
            filteredLines.push(content[i]);
            
          } else {
            
            if (!currentOffset) {
              currentOffset = { at: i, offset: 0 };
              offsets.push(currentOffset);
            }
            currentOffset.offset++;
            
          }
          
          if (currentBlock && i === currentBlock.end) currentBlock = null;
          
        }
        
        return {
          offsets: offsets,
          content: filteredLines.join('\n')
        };
        
      },
      compile0: function(appName) {
        
        var appDir = path.join(this.rootPath, 'apps', appName);
        
        var fileName = path.join(appDir, appName + '.js');
        var contents = fs.readFileSync(fileName).toString();
        
        var ret = {};
        
        return O.map(this.directives, function(directive, variant) {
          
          var cmpFullPath = path.join(appDir, compiledPrefix + variant + '-' + appName + '.js');
          var cmpFileData = this.doCompile(contents, directive);
          
          fs.writeFileSync(cmpFullPath, cmpFileData.content, { flag: 'w' });
          
          return {
            offsets: cmpFileData.offsets
          };
          
        }.bind(this));
        
        return ret;
        
      },
      
      getLineData: function(line, n, variant) {
        
        var isEval = false;
        var fileLineInd = line.indexOf('(');
        if (~fileLineInd) {
          var fileLineStr = line.substr(fileLineInd + 1, line.lastIndexOf(')') - fileLineInd - 1);
          var funcAddr = line.substr(0, fileLineInd - 1);
          
          if (fileLineStr.substr(0, 8) === 'eval at ') {
            var isEval = true;
            var lb = fileLineStr.indexOf('(');
            var rb = fileLineStr.indexOf(')');
            fileLineStr = fileLineStr.substr(lb + 1, rb - lb - 1);
          }
        } else {
          var fileLineStr = line;
          var funcAddr = null;
        }
        
        // Native items aren't useful in the stack trace
        if (/^native$|module\.js:|bootstrap_node\.js:|^vm\.js:/.test(fileLineStr))
          return null;
        
        if (n > 1 && /apps[/\\]p[/\\](cmp-server-)?p\.js:/.test(fileLineStr))
          return null;
        
        // Some paths start with "C:" which makes it awkward to do `.split(':')`
        var lastColon = fileLineStr.lastIndexOf(':');
        var charInd = fileLineStr.substr(lastColon + 1);
        fileLineStr = fileLineStr.substr(0, lastColon);
        
        var lastColon = fileLineStr.lastIndexOf(':');
        var lineInd = fileLineStr.substr(lastColon + 1);
        fileName = fileLineStr.substr(0, lastColon);
        
        // These lines just bloat the trace without providing anything useful
        if (fileName === 'module.js' || fileName === 'node.js') return null;
        
        var lineDataItem = {
          funcAddr: funcAddr,
          fileName: fileName,
          lineInd: parseInt(lineInd),
          charInd: parseInt(charInd),
          corrected: false,
          isEval: isEval
        };
        
        // TODO: No longer `fileOffsets[lineDataItem.fileName]`, instead `this.fileVariants[fileName.removeExtension()][variants].offsets`
        
        var isVariant = false;
        var pcs = fileName.split(/[/\\]/);
        var appName = pcs[pcs.length - 1];
        appName = appName.substr(0, appName.length - 3); // Trim off ".js"
        if (S.startsWith(appName, compiledPrefix)) {
          isVariant = true;
          var pcs = appName.split('-');
          if (pcs[1] !== variant) throw new Error('Expected "' + variant + '" variant but instead got "' + pcs[1] + '"');
          appName = pcs[2];
        }
        
        if (isVariant) {
          
          var offsets = this.fileVariants[appName][variant].offsets;
          
          //var offsetData = fileOffsets[lineDataItem.fileName];
          //var offsets = offsetData.offsets;
          var originalLineInd = lineDataItem.lineInd;
          
          var srcLineInd = 0;
          var cmpLineInd = 0;
          var totalOffset = 0;
          var nextOffset = 0;
          
          while (cmpLineInd < originalLineInd) {
            
            while (offsets[nextOffset] && offsets[nextOffset].at === srcLineInd) {
              srcLineInd += offsets[nextOffset].offset;
              nextOffset++;
            }
            
            srcLineInd++;
            cmpLineInd++;
            
          }
          
          lineDataItem.lineInd = srcLineInd;
          lineDataItem.corrected = true;
          lineDataItem.fileName = '[!] ' + appName + '.js';
          
        }
        
        return lineDataItem;
      
      },
      shapeError: function(err, variant) {
        
        if (!U.isInstance(err, Error)) return { msg: 'NOT AN ERROR', err: err };
        
        var errorType = err.constructor.name;
        var errorText = errorType + ': ' + err.message;
        var stackStartInd = err.stack.indexOf(errorText);
        if (stackStartInd === -1) {
          errorText = 'Not fully parsed (' + stackStartInd + '):\n=================\n' + errorText + '\n=================\n' + err.stack + '\n=================\n';
          var stack = err.stack.substr(errorType.length + ': '.length + errorText.length).trim(); // Take the message off the stack
        } else {
          var stack = err.stack.substr(stackStartInd + errorText.length + 1); // Add one to remove the trailing "\n"
          if (stackStartInd > 0) errorText = err.stack.substr(0, stackStartInd);
        }
        
        var errorTextLines = errorText.trim().split('\n');
        for (var i = 0; i < errorTextLines.length; i++) {
          
          if (/\.js:[0-9]+$/.test(errorTextLines[i])) {
            
            var data = this.getLineData('errorLoc (' + errorTextLines[i].trim() + ':1)', 0, variant);
            errorText = 'Parse error: ' + err.message + '\n|- ' + data.fileName + ':' + data.lineInd;
            break;
            
          }
          
        }
        
        var lines = stack.split('\n');
        
        var linesData = [];
        for (var i = 0; i < lines.length; i++) {
          
          var lineDataItem = this.getLineData(lines[i].trim().substr(2), i, variant); // The trim + substr trim off "  at"
          if (lineDataItem === null) continue;
          
          var line = '|- ';
          
          var funcAddr = (lineDataItem.funcAddr ? lineDataItem.funcAddr : '<native>').trim();
          if (funcAddr.length > 40) funcAddr = funcAddr.substr(0, 37) + '...';
          
          var errorLoc = lineDataItem.fileName + ':' + lineDataItem.lineInd + ':' + lineDataItem.charInd;
          if (errorLoc.length > 45) errorLoc = '...' + errorLoc.substr(errorLoc.length - 42);
          
          // if (lineDataItem.isEval) line += 'Something?'
          line += S.endPad(funcAddr, ' ', 40) + ' ';
          line += S.endPad(errorLoc, ' ', 45) + ' ';
          
          linesData.push(S.endPad(line, ' ', 90) + '|');
          
        }
        
        return errorText + '\n' + linesData.join('\n');
        
      }
      
    };}
  });
  
}}).build();
