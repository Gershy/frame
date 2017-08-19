var fs = require('fs');
var path = require('path');

process.on('uncaughtException', function(err) {
  console.error('UNCAUGHT: ' + err.stack);
});

exports.compile = function(appName, appDir, tabs) {
  if (!tabs) tabs = 2;
  
  var fileName = path.join(appDir, appName + '.js');
  var contents = fs.readFileSync(fileName).toString();
  
  var process = function(content, directives, tabs) {
    content = content.split('\n');
    
    var blocks = [];
    
    var currentBlock = null;
    for (var i = 0; i < content.length; i++) {
      
      var line = content[i].trim();
      /*
      if (line.substr(0, 2) !== '//') {
        if (!currentBlock) {
          for (var k in directives) {
            if (line.contains('// =' + k + '=')) { blocks.push({ type: k, start: i, end: i }); break; }
          }
        }
        
        continue;
      }
      */
      
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
    
    var currentBlock = null;
    var nextBlockInd = 0;
    var filteredLines = [];
    for (var i = 0; i < content.length; i++) {
      
      if (!currentBlock && blocks[nextBlockInd] && blocks[nextBlockInd].start === i) {
        currentBlock = blocks[nextBlockInd];
        nextBlockInd++;
      }
      
      // Blank lines are removed. Block delimiters, as well as the contents of 'remove' blocks are omitted.
      if (content[i].trim() && (!currentBlock || (i !== currentBlock.start && i !== currentBlock.end && directives[currentBlock.type] === 'keep'))) {
        
        filteredLines.push(content[i]);
        
      }
      
      if (currentBlock && i === currentBlock.end) currentBlock = null;
      
    }
    
    return filteredLines.join('\n');
  };
  
  var serverContents = process(contents, {
    CLIENT: 'remove',
    SERVER: 'keep',
    REMOVE: 'remove'
  });
  
  var clientContents = process(contents, {
    CLIENT: 'keep',
    SERVER: 'remove',
    REMOVE: 'remove'
  });
  
  fs.writeFileSync(path.join(appDir, 'cmp-server-' + appName + '.js'), serverContents, { flag: 'w' });
  fs.writeFileSync(path.join(appDir, 'cmp-client-' + appName + '.js'), clientContents,  { flag: 'w' });
  
  
};

exports.compile2 = function(appName, appDir, tabs) {
  // If `tabs` === 'tabs', the tabbing is done with \t
  // If `tabs` is some integer n, the tabbing is done with n spaces
  if (!tabs) tabs = 2;
  
  var removeContent = function(content, inds, typeLen, delimLen, tabs) {
    return content.substr(0, inds[0]) +     // Everything before the block
      '{}' +                                // An empty value as a replacement for the block
      content.substr(inds[1] + delimLen);   // Everything after the block
  };
  var keepContent = function(content, inds, typeLen, delimLen, tabs) {
    
    var ind0 = inds[0] + typeLen + delimLen; // Index of the first character inside the block
    var blockContent = content.substr(ind0, inds[1] - ind0); // Everything from the first to last characters of the block
    if (blockContent.replace(/[\t ]/g, '')[0] === '\n') { // If the first non-tab character is a newline (an unindent is desired)...
      
      // Do an unindent! Split by newline; strip first tab from each line; rejoin with newlines
      blockContent = blockContent.split('\n');
      blockContent = blockContent.map(function(line) {
        
        if (tabs === 'tabs')
          return line[0] === '\t' ? line.substr(1) : line;
        
        var allSpaces = true;
        for (var i = 0; i < tabs; i++) { if (line[i] !== ' ') allSpaces = false; break; }
        
        return allSpaces ? line.substr(tabs) : line;
        
      }).join('\n');
      
    }
    blockContent = blockContent.trim();
    
    return content.substr(0, inds[0]) +     // Everything before the block
      blockContent +                        // Everything inside the block
      content.substr(inds[1] + delimLen);   // Everything after the block
    
  };
  
  var blockTypes = {
    SERVER: {
      contentForServer: keepContent,
      contentForClient: removeContent
    },
    CLIENT: {
      contentForServer: removeContent,
      contentForClient: keepContent
    }
  };
  
  console.log('Compiling "' + appName + '" at "' + appDir + '"...');
  
  var fileName = path.join(appDir, appName + '.js');
  var fileContents = fs.readFileSync(fileName).toString();
  
  var maxBlockStart = 0;
  var blocks = [];
  
  while (true) {
    
    var foundOne = false;
    
    for (var type in blockTypes) {
      
      var typeLen = type.length;
      
      var blockStart = fileContents.indexOf(type + '([[', maxBlockStart);
      if (blockStart === -1) break;
      
      foundOne = true;
      maxBlockStart = blockStart + typeLen;
      
      var blockEnd = fileContents.indexOf(']])', maxBlockStart);
      if (blockEnd === -1) throw new Error(type + ' block missing terminator in file "' + fileName + '"');
      
      blocks.push({
        type: type,
        inds: [ blockStart, blockEnd ]
      });
      
    }
    
    if (!foundOne) break;
    
  }
  
  // Order by greatest last index (handle last blocks first so no re-indexing needs to be done)
  blocks.sort(function(a, b) { return b.inds[1] - a.inds[1] });
  
  var serverContents = fileContents;
  var clientContents = fileContents;
  for (var i = 0; i < blocks.length; i++) {
    
    var block = blocks[i];
    var blockType = block.type;
    var blockTypeLen = blockType.length;
    var blockInds = block.inds;
    
    // `3` is the length of the "]])" block delimiter
    // `tabs` indicates the tab type. An integer indicates n spaces; the string "tab" indicates tabs
    clientContents = blockTypes[blockType].contentForClient(clientContents, blockInds, blockTypeLen, 3, tabs);
    serverContents = blockTypes[blockType].contentForServer(serverContents, blockInds, blockTypeLen, 3, tabs);
    
    /*
    clientContents =
      clientContents.substr(0, blockInds[0]) +  // Everything before the block
      '{ denied: true }' +                      // An empty value as a replacement for the block
      clientContents.substr(blockInds[1] + 3);  // Everything after the block (3 is constant, it's the length of "]])")
    
    
    var ind1 = blockInds[0] + blockTypeLen + 3;
    var blockContents = serverContents.substr(ind1, blockInds[1] - ind1);
    if (blockContents.replace(/[\t ]/g, '')[0] === '\n') {
      blockContents = blockContents.split('\n');
      blockContents = blockContents.map(function(line) {
        
        if (tabs === 'tabs')
          return line[0] === '\t' ? line.substr(1) : line;
        
        var allSpaces = true;
        for (var i = 0; i < tabs; i++) { if (line[i] !== ' ') allSpaces = false; break; }
        
        return allSpaces ? line.substr(tabs) : line;
        
      }).join('\n');
    }
    blockContents = blockContents.trim();
    
    serverContents =
      serverContents.substr(0, blockInds[0]) +  // Everything before the block
      blockContents +                           // Everything inside the block
      serverContents.substr(blockInds[1] + 3);  // Everything after the block
    */
    
    
  }
  
  fs.writeFileSync(path.join(appDir, 'cmp-server-' + appName + '.js'), serverContents, { flag: 'w' });
  fs.writeFileSync(path.join(appDir, 'cmp-client-' + appName + '.js'), clientContents,  { flag: 'w' });
  
  console.log('Compilation successful!');
};
