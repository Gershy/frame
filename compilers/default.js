var fs = require('fs');
var path = require('path');

var fileOffsets = {};   // Stores compilation offsets for files
var fileMappings = {};  // Stores replacement file mappings (e.g. stores server/client versions for an uncompiled filename)
process.on('uncaughtException', function(err) {
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
    
    if (lineDataItem.fileName in fileOffsets) {
      var offsetData = fileOffsets[lineDataItem.fileName];
      var offsets = offsetData.offsets;
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
      lineDataItem.fileName = offsetData.realName;
    }
    
    lineData.push(lineDataItem);
  }
  
  //console.error(err.stack);
  //console.error('\n==============\n');
  
  console.error(errorText + '\n' + lineData.map(function(d) {
    
    return '|-- ' +
      d.fileName + ':' + d.lineInd + ':' + d.charInd +
      (d.corrected ? ' [!]' : '') + ' ' + // Provide an indicator for lines that have been source-calculated
      '(' + (d.isEval ? 'EVAL: ' : '') + (d.funcAddr ? d.funcAddr : '<native>') + ') ';
    
  }).join('\n'));
  
});

var doCompile = function(content, directives, tabs) {
  content = content.split('\n');
  
  var blocks = [];
  
  var currentBlock = null;
  for (var i = 0; i < content.length; i++) {
    
    var line = content[i].trim();
    
    if (!currentBlock) {
      
      for (var k in directives) {
        if (line.contains('{' + k + '=')) {
          var currentBlock = {
            type: k,
            start: i,
            end: -1
          };
        }
      }
      
    } else {
      
      if (line.contains('=' + currentBlock.type + '}')) {
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
        (i !== currentBlock.start && i !== currentBlock.end && directives[currentBlock.type] === 'keep')
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
    lineOffsetData: {
      totalLines: content.length,
      offsets: offsets
    },
    content: filteredLines.join('\n')
  };
};

exports.compile = function(appName, appDir, tabs) {
  if (!tabs) tabs = 2;
  
  var fileName = path.join(appDir, appName + '.js');
  var contents = fs.readFileSync(fileName).toString();
  
  var serverFileName = path.join(appDir, 'cmp-server-' + appName + '.js');
  var serverFileData = doCompile(contents, {
    CLIENT: 'remove',
    SERVER: 'keep',
    REMOVE: 'remove'
  });
  
  var clientFileName = path.join(appDir, 'cmp-client-' + appName + '.js');
  var clientFileData = doCompile(contents, {
    CLIENT: 'keep',
    SERVER: 'remove',
    REMOVE: 'remove'
  });
  
  fs.writeFileSync(serverFileName, serverFileData.content, { flag: 'w' });
  fs.writeFileSync(clientFileName, clientFileData.content, { flag: 'w' });
  
  fileMappings[fileName] = { server: serverFileName, client: clientFileName };
  
  fileOffsets[serverFileName] = serverFileData.lineOffsetData.update({ realName: fileName });
  
  // TODO: Calculate client offsets as well, ship them client-side??
  //fileOffsets[clientFileName] = clientFileData.lineOffsetData.update({ realName: fileName });
};

exports.getFileName = function(sourceFileName, type) {
  if (sourceFileName in fileMappings) return fileMappings[sourceFileName][type];
  return sourceFileName;
};
