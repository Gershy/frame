new PACK.pack.Package({ name: 'compile', buildFunc: function() {
  
  var fs = require('fs');
  var path = require('path');
  
  return {
    
    Compiler: U.makeClass({ name: 'Compiler',
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
              
              requirePath: '../' + appName + '/cmp-' + variantName + '-' + appName + '.js',
              fullPath: path.join(this.rootPath, 'apps', appName, 'cmp-' + variantName + '-' + appName + '.js'),
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
    }),
    DefaultCompiler: U.makeClass({ name: 'DefaultCompiler', superclassName: 'Compiler',
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
                if (line.contains('{' + k.toUpperCase() + '=')) {
                  
                  var currentBlock = {
                    type: k,
                    start: i,
                    end: -1
                  };
                  
                }
              }
              
            } else {
              
              if (line.contains('=' + currentBlock.type.toUpperCase() + '}')) {
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
            
            var cmpFullPath = path.join(appDir, 'cmp-' + variant + '-' + appName + '.js');
            var cmpFileData = this.doCompile(contents, directive);
            
            fs.writeFileSync(cmpFullPath, cmpFileData.content, { flag: 'w' });
            
            return {
              offsets: cmpFileData.offsets
            };
            
          }.bind(this));
          
          return ret;
          
        },
        
        shapeError: function(err, variant) {
          
          if (!U.isInstance(err, Error)) return {
            msg: 'NOT AN ERROR',
            err: err
          };
          
          console.log('MESSAGE:', err.message.split('\n').length + 1, ':', err.message);
          
          var lines = err.stack.split('\n');
          
          // `SyntaxError`s begin with a code snippet followed by whitespace
          if (U.isObj(err, SyntaxError)) {
            
            var foundGap = false;
            var numSkip = 0;
            
            var lineDataStr = lines[0];
            
            for (var i = 0; i < lines.length; i++) {
              var len = lines[i].trim().length;
              if (!len) foundGap = true;
              if (foundGap && len) break;
              numSkip++;
            }
            
            lines = lines.slice(numSkip);
            
            var errorText = lines[0];
            lines[0] = '    at ' + lineDataStr + ':0';
            
          } else {
            
            var errorText = lines[0];
            lines = lines.slice(1);
            
          }
          
          var lineData = [];
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim().substr(3); // Trim off "at "
            
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
            if (fileLineStr === 'native') continue;
            
            // Some paths start with "C:" which makes it awkward to do `.split(':')`
            var lastColon = fileLineStr.lastIndexOf(':');
            var charInd = fileLineStr.substr(lastColon + 1);
            fileLineStr = fileLineStr.substr(0, lastColon);
            
            var lastColon = fileLineStr.lastIndexOf(':');
            var lineInd = fileLineStr.substr(lastColon + 1);
            fileName = fileLineStr.substr(0, lastColon);
            
            // These lines just bloat the trace without providing anything useful
            if (fileName === 'module.js' || fileName === 'node.js') continue;
            
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
            if (appName.substr(0, 4) === 'cmp-') {
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
            
            var line = '|-- ';
            // if (lineDataItem.isEval) line += 'Something?'
            line += S.endPad(lineDataItem.funcAddr ? lineDataItem.funcAddr : '<native>', ' ', 45) + ' ';
            line += lineDataItem.fileName + ':' + lineDataItem.lineInd + ':' + lineDataItem.charInd;
            
            if (line.length > 90) line = line.substr(0, 87) + '...';
            
            lineData.push(S.endPad(line, ' ', 90) + '|');
            
          }
          
          //console.error(err.stack);
          //console.error('\n==============\n');
          
          return errorText + '\n' + lineData.join('\n');
          
        }
        
      };}
    })
    
  }
  
}}).build();
