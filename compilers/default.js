var fs = require('fs');
var path = require('path');

var fileOffsets = {};
process.on('uncaughtException', function(err) {
  var lines = err.stack.split('\n');
  var errorText = lines[0];
  
  lines = lines.slice(1);
  var lineData = [];
  
  for (var i = 0; i < lines.length; i++) {
    line = lines[i].trim().substr(3); // Trim off "at "
    
    var fileLineInd = line.indexOf('(');
    if (~fileLineInd) {
      var fileLineStr = line.substr(fileLineInd + 1, line.indexOf(')') - fileLineInd - 1);
      var funcAddr = line.substr(0, fileLineInd - 1);
    } else {
      var fileLineStr = line;
      var funcAddr = null;
    }
    
    // Some paths start with "C:" which makes it hard to just do `.split(':')`
    var lastColon = fileLineStr.lastIndexOf(':');
    var charInd = fileLineStr.substr(lastColon + 1);
    fileLineStr = fileLineStr.substr(0, lastColon);
    
    var lastColon = fileLineStr.lastIndexOf(':');
    var lineInd = fileLineStr.substr(lastColon + 1);
    filepath = fileLineStr.substr(0, lastColon);
    
    if (filepath === 'module.js' || filepath === 'node.js') continue;
    
    var lineDataItem = {
      funcAddr: funcAddr,
      filepath: filepath,
      lineInd: parseInt(lineInd),
      charInd: parseInt(charInd),
      corrected: false
    };
    
    if (lineDataItem.filepath in fileOffsets) {
      var offsetData = fileOffsets[lineDataItem.filepath];
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
      lineDataItem.filepath = offsetData.realName;
    }
    
    lineData.push(lineDataItem);
  }
  
  console.error(errorText + '\n' + lineData.map(function(lineDataItem) {
    
    return '|-- ' +
      lineDataItem.filepath + ':' + lineDataItem.lineInd + ':' + lineDataItem.charInd +
      (lineDataItem.corrected ? ' [!]' : '') + ' ' +
      '(' + (lineDataItem.funcAddr ? lineDataItem.funcAddr : '<native>') + ') ';
    
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
  
  var serverFilepath = path.join(appDir, 'cmp-server-' + appName + '.js');
  var serverFileData = doCompile(contents, {
    CLIENT: 'remove',
    SERVER: 'keep',
    REMOVE: 'remove'
  });
  
  var clientFilepath = path.join(appDir, 'cmp-client-' + appName + '.js');
  var clientFileData = doCompile(contents, {
    CLIENT: 'keep',
    SERVER: 'remove',
    REMOVE: 'remove'
  });
  
  fs.writeFileSync(serverFilepath, serverFileData.content, { flag: 'w' });
  fs.writeFileSync(clientFilepath, clientFileData.content, { flag: 'w' });
  
  fileOffsets[serverFilepath] = serverFileData.lineOffsetData.update({ realName: fileName });
  //fileOffsets[clientFilepath] = clientFileData.lineOffsetData.update({ realName: fileName });
};
