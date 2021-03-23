require('./clearing.js');

// https://en.wikipedia.org/wiki/Left_recursion

let parse = (parser, input) => parseNormalized(normalizedParser(parser), input);
let whiteSpaceReg = /[ \n\t]/;

let getParserParams = parser => {
  
  let defaults = { consumeWhiteSpace: true, diveParser: null, diveGreedy: true };
  if (parser.type === 'repeat') defaults = { ...defaults, minReps: 0, maxReps: Infinity, greedy: true };
  return { ...defaults, ...parser };
  
};
let isLeftRecursionSafe = (parser, seen=Map()) => {
  
  // If we've already seen `parser`, return `true` if it was resolved,
  // otherwise false (meaning we've encountered it again before
  // resolving it; a sure sign there can be left-recursion!)
  if (seen.has(parser)) return seen.get(parser);
  
  // Set `parser` as "unresolved" initially. It will become resolved if
  // we can iterate through all of it without finding it again!
  seen.set(parser, false);
  
  let result = (() => {
    
    if ([ 'token', 'regex' ].includes(parser.type)) return true;
    
    if (parser.type === 'repeat')
      return isLeftRecursionSafe(parser.parser, seen);
    
    if (parser.type === 'all')
      return isLeftRecursionSafe(parser.parsers[0], seen);
    
    if (parser.type === 'any')
      return parser.parsers.every(parser => isLeftRecursionSafe(parser, seen));
    
    throw Error(`Unexpected parser type: "${parser.type}"`);
    
  })();
  
  seen.set(parser, result);
  return result;
  
};
let iterateAllParsers = function*(parser, seen=Set()) {
  
  if (seen.has(parser)) return;
  seen.add(parser);
  
  yield parser;
  if (parser.type === 'any') for (let p of parser.parsers) yield* iterateAllParsers(p, seen);
  if (parser.type === 'all') for (let p of parser.parsers) yield* iterateAllParsers(p, seen);
  if (parser.type === 'repeat') yield* iterateAllParsers(parser.parser, seen);
  
};
let normalizedParser = parser => {
  
  for (let p of iterateAllParsers(parser)) {
    
    // Convert string regex to regex object
    if (p.type === 'regex' && U.isForm(p.regex, String)) {
      if (!p.regex.hasHead('^')) p.regex = `^(${p.regex})`;
      p.regex = new RegExp(p.regex.replace(/\\/g, '\\\\')); // Escape all backslashes
    }
    
    if (!isLeftRecursionSafe(p)) {
      
      console.log(`Parser contains left-recursion:`, p);
      throw Error(`Possible left recursion`);
      
    }
    
  }
  
  return parser;
  
};
let parseNormalized = function*(parser, input) {
  
  let applyParserTypeFns = {
    
    token: function*(parser, input) {
      if (input.hasHead(parser.token)) yield { parser, result: parser.token };
    },
    regex: function*(parser, input) {
      let [ result=null ] = input.match(parser.regex) || [];
      if (result) yield { parser, result };
    },
    repeat: function*(parser, input) {
      
      let { greedy, minReps, maxReps } = getParserParams(parser);
      
      let allChildrenPerms = function*(offset=0, num=0) {
        
        if (num > maxReps) return;
        
        for (let parsedHead of applyParser(parser.parser, input.slice(offset))) {
          
          if (num >= minReps && !greedy) yield [ parsedHead ];
          for (let parsedTail of allChildrenPerms(offset + parsedHead.result.length, num + 1)) yield [ parsedHead, ...parsedTail ];
          if (num >= minReps && greedy) yield [ parsedHead ];
          
        }
        
      }
      
      if (minReps === 0 && !greedy) yield { parser, result: '', children: [] };
      for (let children of allChildrenPerms()) yield { parser, result: children.map(r => r.result).join(''), children };
      if (minReps === 0 && greedy) yield { parser, result: '', children: [] };
      
    },
    all: function*(parser, input) {
      
      let lastChildOffset = parser.parsers.count() - 1;
      
      let allChildrenPerms = function*(inputOffset=0, childOffset=0) {
        
        let childParser = parser.parsers[childOffset];
        
        if (childOffset === lastChildOffset) {
          
          // Immediately yield tail-less results for the final offset
          for (let parsedHead of applyParser(childParser, input.slice(inputOffset))) yield [ parsedHead ];
          
        } else {
          
          // Yield head + tail for non-final parsers
          for (let parsedHead of applyParser(childParser, input.slice(inputOffset)))
            for (let parsedTail of allChildrenPerms(inputOffset + parsedHead.result.length, childOffset + 1))
              yield [ parsedHead, ...parsedTail ];
          
        }
        
      }
      
      for (let children of allChildrenPerms()) yield { parser, result: children.map(r => r.result).join(''), children };
      
    },
    any: function*(parser, input) {
      
      for (let p of parser.parsers)
        for (let child of applyParser(p, input))
          yield { parser, result: child.result, child };
      
    }
    
  };
  let applyParser = function*(parser, input) {
    
    if (!input) return;
    if (!parser) throw Error(`Invalid parser: ${U.getFormName(parser)}`);
    
    let { consumeWhiteSpace, diveParser, diveGreedy } = getParserParams(parser);
    
    let pre = '';
    if (consumeWhiteSpace) while (input[pre.length].match(whiteSpaceReg)) pre += input[pre.length];
    input = input.slice(pre.length);
    
    if (!diveParser) {
      
      for (let parsed of applyParserTypeFns[parser.type](parser, input)) yield { ...parsed, result: pre + parsed.result };
      
    } else {
      
      for (let parsedDiveHead of applyParserTypeFns[parser.type](parser, input)) {
        
        console.log(`${parser.name} matched <${parsedDiveHead.result}>; diving...`);
        
        let result = pre + parsedDiveHead.result;
        let remainingInput = input.slice(result.length);
        if (diveGreedy && remainingInput) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput)) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
          }
        }
        yield { ...parsedDiveHead, result };
        if (!diveGreedy && remainingInput) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput)) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
          }
        }
        
      }
      
    }
    
  }
  
  yield* applyParser(parser, input);
  
};

let genParser = () => {
  
  let rootParser = { name: 'root', type: 'any', parsers: [] };
  
  let inPlaceVal = rootParser.parsers.add({ name: 'inPlaceVal', type: 'any', parsers: [] });
  
  let varRef = { name: 'varRef', type: 'regex', regex: '[a-zA-Z$_][a-zA-Z0-9$_]*' };
  
  inPlaceVal.parsers.add(varRef);
  
  inPlaceVal.parsers.add({ name: 'singleQuoteString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: `'` },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', regex: `[^\\']+` },
      { name: 'escapeSeq', type: 'regex', regex: `\\.` }
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: `'` }
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'doubleQuoteString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: '"' },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', regex: `[^\\"]+` }, // Non-backslash, non-double-quote
      { name: 'escapeSeq', type: 'regex', regex: `\\.` }  // Backslash followed by anything
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: '"' }
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'backtickString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: '`' },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', regex: '([^\\`$]|$[^{])+' },
      
      { name: 'escapeSeq', type: 'regex', regex: '\\.' },
      
      { name: 'interpolatedValue', type: 'all', parsers: [
        
        { name: 'openInterpolatedValue', type: 'token', token: '${' },
        
        inPlaceVal,
        
        { name: 'closeInterpolatedValue', type: 'token', token: '}' }
        
      ]}
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: '`' }
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'binaryInteger', type: 'regex', regex: '[+-]?0b[0-1]+' });
  inPlaceVal.parsers.add({ name: 'octalInteger', type: 'regex', regex: '[+-]?0[0-7]+' });
  inPlaceVal.parsers.add({ name: 'hexInteger', type: 'regex', regex: '[+-]?0x[0-9a-fA-F]+' });
  inPlaceVal.parsers.add({ name: 'decInteger', type: 'regex', regex: '[+-]?[0-9]+' });
  inPlaceVal.parsers.add({ name: 'decFloat', type: 'regex', regex: '[0-9]+[.][0-9]+' });
  inPlaceVal.parsers.add({ name: 'boolean', type: 'regex', regex: 'true|false' });
  
  let arrayEntity = { name: 'arrayEntity', type: 'any', parsers: [
    inPlaceVal,
    { name: 'spreadEntity', type: 'all', parsers: [
      { type: 'token', token: '...' },
      inPlaceVal
    ]}
  ]};
  inPlaceVal.parsers.add({ name: 'array', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '[' },
    
    { name: 'headEntities', type: 'repeat', parser: { type: 'all', parsers: [
      arrayEntity,
      { name: 'delimiter', type: 'token', token: ',' }
    ]}},
    
    { name: 'tailEntity', type: 'repeat', maxReps: 1, parser: arrayEntity },
    
    { name: 'close', type: 'token', token: ']' }
    
  ]});
  
  let objectEntity = { name: 'objectEntity', type: 'any', parsers: [
    
    varRef, // Shorthand - e.g. { a, b, c: 3 }
    
    { name: 'mapping', type: 'all', parsers: [
      
      varRef,
      { name: 'mappingDelim', type: 'token', token: ':' },
      inPlaceVal
      
    ]},
    
  ]};
  inPlaceVal.parsers.add({ name: 'object', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '{' },
    
    { name: 'headEntities', type: 'repeat', parser: { type: 'all', parsers: [
      
      objectEntity,
      { name: 'delimiter', type: 'token', token: ',' }
      
    ]}},
    
    { name: 'tailEntity', type: 'repeat', maxReps: 1, parser: objectEntity },
    
    { name: 'close', type: 'token', token: '}' }
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'bracketedVal', type: 'all', parsers: [
    
    { type: 'token', token: '(' },
    inPlaceVal,
    { type: 'token', token: ')' }
    
  ]});
  
  inPlaceVal.diveParser = { type: 'repeat', parser: { type: 'any', parsers: [
    
    { name: 'functionCallNoParams', type: 'token', token: '()' }
    
  ]}};
  
  return rootParser;
  
};
let genInput = () => {
  
  return 'f()()()()()()()()';
  
};

(() => {
  
  let cleanResult = (parsed, seen=Map()) => {
    
    if (!parsed) throw Error('BAD');
    
    if (seen.has(parsed)) return seen.get(parsed);
    let clean = {};
    seen.set(parsed, clean);
    
    clean.parser = `${parsed.parser.name || '<anon>'} (${parsed.parser.type})`;
    clean.result = parsed.result;
    
    if (parsed.parser.type === 'any')
      clean.child = cleanResult(parsed.child, seen);
    
    if ([ 'repeat', 'all' ].includes(parsed.parser.type))
      clean.children = parsed.children.map(child => cleanResult(child, seen));
    
    if (parsed.diveTail)
      clean.diveTail = cleanResult(parsed.diveTail, seen);
    
    return clean;
    
  };
  
  let parser = genParser();
  let input = genInput();
  for (let match of parse(parser, input)) {
    console.log(`MATCH <${match.result}>`, require('util').inspect(cleanResult(match), { colors: true, depth: Infinity }));
    break;
  }
  
})();
