require('./clearing.js');

// https://en.wikipedia.org/wiki/Left_recursion

let parse = (parser, input) => parseNormalized(normalizedParser(parser), input);
let whiteSpaceRegex = /[ \n\t]/;

let getParserParams = parser => {
  
  let defaults = { consumeWhiteSpace: false, diveParser: null, diveGreedy: true };
  
  if ([ 'token', 'regex' ].has(parser.type)) defaults.consumeWhiteSpace = true;
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
  
  // Sanitization step
  for (let p of iterateAllParsers(parser)) {
    
    // Convert string regex to regex object
    if (p.type === 'regex' && U.isForm(p.regex, String)) {
      if (!p.regex.hasHead('^')) p.regex = `^(${p.regex})`;
      p.regex = new RegExp(p.regex.replace(/\\/g, '\\\\')); // Escape all backslashes
    }
    
    // TODO: Sort options of "any" by descending complexity??
    if (0 && p.type === 'any') {
      
      p.parsers = p.parsers.sort((p1, p2) => {
        
        let c1 = 0;
        for (let p of iterateAllParsers(p1)) c1++;
        
        let c2 = 0;
        for (let p of iterateAllParsers(p2)) c2++;
        
        return c2 - c1;
        
      });
      
      console.log(p.parsers.map(p => p.name || p.type));
      
    }
    
  }
  
  let getLeftRecursionChainsForParser = (root, chain=[], seen=Set()) => {
    
    // We're looking to see if `root` left-recurses in `current`
    
    let current = chain.slice(-1)[0] || root;
    
    // Ignore terminals
    if ([ 'token', 'regex' ].has(current.type)) return [];
    
    if (seen.has(current)) return [];
    seen.add(current);
    
    if (current.type === 'all') {
      
      if (current.parsers[0] === root) return [ chain ];
      return getLeftRecursionChainsForParser(root, [ ...chain, current.parsers[0] ], seen);
      
    } else if (current.type === 'repeat') {
      
      if (current.parser === root) [ chain ];
      return getLeftRecursionChainsForParser(root, [ ...chain, current.parser ], seen);
      
    } else if (current.type === 'any') {
      
      let chains = [];
      if (current.parsers.has(root)) chains.push(chain);
      
      for (let parser of current.parsers) {
        chains = [
          ...chains,
          ...getLeftRecursionChainsForParser(root, [ ...chain, parser ], seen)
        ];
      }
      
      return chains;
      
    }
    
    throw Error(`Unexpected parser: ${parser.type}`);
    
  };
  let resolveLeftRecursionChainsForParser = (parser, chains) => {
    
    if (!parser.diveParser)
      parser.diveParser = { name: '~diveRepeat', type: 'repeat', parser: { name: '~diveAny', type: 'any', parsers: [] } };
    
    let diveParsersArr = parser.diveParser.parser.parsers;
    
    for (let chain of chains) {
      
      // Note: a chain of length 0 can actually occur for a parser
      // such as:
      //      |   let parser = { type: 'any', parsers: [] };
      //      |   parser.parsers.push(parser);
      
      // This parser immediately delegates to `parser`, and can be
      // returned to from `parser` (causing LR). If this is "repeat",
      // its "parser" prop is `parser`. If it's "any", `parser` is
      // directly within its "parsers" prop. If it's "all" then
      // `parser === cycleClosingParser.parsers[0]`!
      let cycleClosingParser = chain.slice(-1)[0];
      
      if (chain.length !== 1) throw Error(`Handle indirect left recursion??`);
      if (parser.type !== 'any') throw Error(`Handle cyclically closed non-any parser`);
      
      if (cycleClosingParser.type === 'repeat') {
        
        let { minReps, maxReps } = getParserParams(cycleClosingParser);
        
        // Remove from `parser.parsers`
        parser.parsers = parser.parsers.map(p => (p === cycleClosingParser) ? C.skip : p);
        
        // Subtract one off min and max reps, since there will always
        // have been one repetition occurred before the dive parser is
        // even hit
        diveParsersArr.push({
          ...cycleClosingParser,
          minReps: Math.max(0, minReps - 1),
          maxReps: maxReps - 1
        });
        
      } else if (cycleClosingParser.type === 'all') {
        
        let numHeadReps = 0;
        while (cycleClosingParser.parsers[numHeadReps] === parser) numHeadReps++;
        
        if (numHeadReps !== 1) throw Error(`All-type cycle closing parser repeats head multiple times`);
        
        // Remove from `parser.parsers`
        parser.parsers = parser.parsers.map(p => (p === cycleClosingParser) ? C.skip : p);
        
        // Remove the head (the cyclical step; we'll dive instead, so
        // the head is guaranteed already to exist!)
        cycleClosingParser.parsers = cycleClosingParser.parsers.slice(1);
        
        diveParsersArr.push(cycleClosingParser);
        
      } else if (cycleClosingParser.type === 'any') {
        
      }
      
    }
    
  };
  
  // Repeat as long as there are left-recursion chains
  while (true) {
    
    let leftRecursionChainExists = false;
    for (let p of iterateAllParsers(parser)) {
      
      let chains = getLeftRecursionChainsForParser(p);
      if (!chains.length) continue;
      
      leftRecursionChainExists = true;
      resolveLeftRecursionChainsForParser(p, chains);
      break; // Begin looping from beginning after resolving first issue
      
    }
    
    if (!leftRecursionChainExists) break;
    
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
    if (consumeWhiteSpace) while ((input[pre.length] || '').match(whiteSpaceRegex)) pre += input[pre.length];
    input = input.slice(pre.length);
    
    if (!diveParser) {
      
      for (let parsed of applyParserTypeFns[parser.type](parser, input)) {
        yield { ...parsed, result: pre + parsed.result };
      }
      
    } else {
      
      for (let parsedDiveHead of applyParserTypeFns[parser.type](parser, input)) {
        
        let result = pre + parsedDiveHead.result;
        let remainingInput = input.slice(result.length);
        if (diveGreedy && remainingInput) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput)) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
            //yield { parser, ...parsedDiveHead, diveTail: parsedDiveTail };
          }
        }
        
        yield { ...parsedDiveHead, result };
        
        if (!diveGreedy && remainingInput) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput)) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
            //yield { parser, ...parsedDiveHead, diveTail: parsedDiveTail };
          }
        }
        
      }
      
    }
    
  }
  
  let normalizedParseTree = parsed => {
    
    if (parsed.parser.type === 'any')
      parsed = { ...parsed, child: normalizedParseTree(parsed.child) };
    
    if ([ 'repeat', 'all' ].includes(parsed.parser.type))
      parsed = { ...parsed, children: parsed.children.map(normalizedParseTree) };
    
    if (parsed.has('diveTail')) {
      
      if (parsed.diveTail.parser.name !== '~diveRepeat') throw Error(`Unexpected`);
      
      let { diveTail: diveRepeatParsed, ...parsedNormalized } = parsed;
      parsed = parsedNormalized;
      
      // "~diveRepeat" should only contain "~diveAny" items
      if (diveRepeatParsed.children.find(parsed => parsed.parser.name !== '~diveAny').found) throw Error(`Unexpected`);
      
      // Every option picked by "~diveAny" should be "all"-type
      if (diveRepeatParsed.children.find(parsed => parsed.child.parser.type !== 'all').found) throw Error(`Unexpected`);
      
      let resultFromDive = diveRepeatParsed.children.map(c => c.result).join('');
      let resultWithoutDive = parsed.result.slice(0, parsed.result.length - resultFromDive.length);
      let accumulatedResult = resultWithoutDive;
      parsed.result = resultWithoutDive;
      
      for (let diveChild of diveRepeatParsed.children.map(parsed => parsed.child)) {
        
        // `diveChild` is certainly of type "all"!
        diveChild = normalizedParseTree(diveChild);
        accumulatedResult += diveChild.result;
        parsed = { ...diveChild, result: accumulatedResult, children: [ parsed, ...diveChild.children ] };
        
        //console.log({ parsed, diveAllTypeChild })
        
        
      }
      
    }
    
    return parsed;
    
  };
  for (let parsed of applyParser(parser, input)) {
    
    if (input.slice(parsed.result.length).trim()) continue;
    yield normalizedParseTree(parsed);
    //yield parsed;
    
  }
  
};

let genParser = () => {
  
  /*
  let exp = { name: 'root', type: 'any', parsers: [] };
  exp.parsers.push({ name: 'num', type: 'regex', regex: '[0-9]+' });
  exp.parsers.push({ name: 'add', type: 'all', parsers: [ exp, { type: 'token', token: '+' }, exp ]});
  exp.parsers.push({ name: 'sub', type: 'all', parsers: [ exp, { type: 'token', token: '-' }, exp ]});
  exp.parsers.push({ name: 'mul', type: 'all', parsers: [ exp, { type: 'token', token: '*' }, exp ]});
  exp.parsers.push({ name: 'div', type: 'all', parsers: [ exp, { type: 'token', token: '/' }, exp ]});
  exp.parsers.push({ name: 'parentheses', type: 'all', parsers: [
    { type: 'token', token: '(' }, exp, { type: 'token', token: ')' }
  ]});
  
  return exp;
  */
  
  let rootParser = { name: 'root', type: 'any', parsers: [] };
  
  let inPlaceVal = rootParser.parsers.add({ name: 'inPlaceVal', type: 'any', parsers: [] });
  
  let varName = { name: 'varName', type: 'regex', regex: '[a-zA-Z$_][a-zA-Z0-9$_]*' };
  
  inPlaceVal.parsers.add(varName);
  
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
    
    varName, // Shorthand - e.g. { a, b, c: 3 }
    
    { name: 'mapping', type: 'all', parsers: [
      
      varName,
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
  
  let functionDefParams = { name: 'functionDefParams', type: 'all', parsers: [
    
    { name: 'functionDefParamsOpen', type: 'token', token: '(' },
    { type: 'all', parsers: [
      
      { type: 'repeat', parser: { type: 'all', parsers: [
        varName,
        { name: 'delimiter', type: 'token', token: ',' }
      ]}},
      
      { name: 'functionDefTailParam', type: 'repeat', maxReps: 1, parser: { type: 'all', parsers: [
        // Last param may be variadic
        { name: 'functionDefTailParamOptionallyVariadic', type: 'repeat', maxReps: 1, parser: { type: 'token', token: '...' } },
        varName
      ]}},
      
    ]},
    { name: 'functionDefParamsClose', type: 'token', token: ')' }
    
  ]};
  let functionCallParams = { name: 'functionCallParams', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '(' },
    { name: 'headEntities', type: 'repeat', parser: { type: 'all', parsers: [
      arrayEntity,
      { name: 'delimiter', type: 'token', token: ',' }
    ]}},
    { name: 'tailEntity', type: 'repeat', maxReps: 1, parser: arrayEntity },
    { name: 'close', type: 'token', token: ')' }
    
  ]};
  let functionBodyStatement = { name: 'functionBodyStatement', type: 'any', parsers: [
    
    inPlaceVal,
    { name: 'functionBodyVarAssign', type: 'all', parsers: [
      
      { name: 'functionBodyVarAssignType', type: 'any', parsers: [
        { name: 'functionBodyVarAssignLet', type: 'token', token: 'let' },
        { name: 'functionBodyVarAssignConst', type: 'token', token: 'const' },
        { name: 'functionBodyVarAssignVar', type: 'token', token: 'var' }
      ]},
      { name: 'functionBodyVarAssignWhiteSpaceDelim', type: 'regex', consumeWhiteSpace: false, regex: whiteSpaceRegex },
      varName,
      { name: 'functionBodyVarAssignToken', type: 'token', token: '=' },
      inPlaceVal
      
    ]}
    
  ]};
  let functionBody = { name: 'functionBody', type: 'all', parsers: [
    { name: 'functionBodyOpen', type: 'token', token: '{' },
    { name: 'functionBodyStatementsHead', type: 'repeat', parser: { name: 'functionBodyDelimitedStatement', type: 'all', parsers: [
      
      functionBodyStatement,
      { name: 'functionBodyStatementDelimiter', type: 'any', parsers: [
        { name: 'functionBodyStatementDelimiterSemicolon', type: 'token', token: ';' },
        { name: 'functionBodyStatementDelimiterWhiteSpace', consumeWhiteSpace: false, type: 'regex', regex: whiteSpaceRegex },
      ]}
      
    ]}},
    
    // Optional undelimited tailing statement
    { name: 'functionBodyStatementsTail', type: 'repeat', maxReps: 1, parser: functionBodyStatement },
    
    { name: 'functionBodyClose', type: 'token', token: '}' }
  ]};
  inPlaceVal.parsers.add({ name: 'functionDef', type: 'all', parsers: [
    
    { name: 'functionDefToken', type: 'token', token: 'function' },
    
    // Optional function name
    { name: 'functionInlineOptionalName', type: 'repeat', maxReps: 1, parser: { type: 'all', parsers: [
      { name: 'functionNameWhiteSpaceSeparator', type: 'regex', consumeWhiteSpace: false, regex: whiteSpaceRegex },
      varName
    ]}},
    
    functionDefParams,
    
    functionBody
    
  ]});
  inPlaceVal.parsers.add({ name: 'shorthandFunctionDef', type: 'all', parsers: [
    
    // Shorthand functions allowed a single simple unbracketed parameter
    { name: 'shorthandFunctionParams', type: 'any', parsers: [
      varName,
      functionDefParams
    ]},
    
    { name: 'shorthandFunctionToken', type: 'token', token: '=>' },
    
    // Shorthand functions can have an unbracketed body consisting of a
    // single in-place value
    { name: 'shorthandFunctionBody', type: 'any', parsers: [
      inPlaceVal,
      functionBody
    ]}
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'bracketedVal', type: 'all', parsers: [
    
    { name: 'bracketedValOpen', type: 'token', token: '(' },
    { name: 'bracketedLeadingVals', type: 'repeat', parser: { type: 'all', parsers: [
      inPlaceVal,
      { type: 'token', token: ',' }
    ]}},
    inPlaceVal,
    { name: 'bracketedValClose', type: 'token', token: ')' }
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'functionCall', type: 'all', parsers: [
    
    inPlaceVal,
    functionCallParams
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'binaryOp', type: 'all', parsers: [
    
    inPlaceVal,
    { type: 'any', parsers: [
      { name: 'add', type: 'token', token: '+' },
      { name: 'subtract', type: 'token', token: '-' },
      { name: 'multiply', type: 'token', token: '*' },
      { name: 'divide', type: 'token', token: '/' },
      { name: 'booleanAnd', type: 'token', token: '&&' },
      { name: 'booleanOr', type: 'token', token: '||' },
      { name: 'bitwiseAnd', type: 'token', token: '&' },
      { name: 'bitwiseOr', type: 'token', token: '|' }
    ]},
    inPlaceVal
    
  ]});
  
  let inPlaceReference = { name: 'inPlaceReference', type: 'any', parsers: [
    
    varName,
    
    //// TODO: **INDIRECT** LEFT RECURSION IS ALL-TOO-REAL :'(
    // { name: 'propAccessSimple', type: 'all', parsers: [
    //   inPlaceVal,
    //   { type: 'token', token: '.' },
    //   varName
    // ]},
    // { name: 'propAccessDynamic', type: 'all', parsers: [
    //   inPlaceVal,
    //   { type: 'token', token: '[' },
    //   inPlaceVal,
    //   { type: 'token', token: ']' }
    // ]}
    
  ]};
  inPlaceVal.parsers.add(inPlaceReference);
  
  inPlaceVal.parsers.add({ name: 'ternary', type: 'all', parsers: [
    
    inPlaceVal,
    { type: 'token', token: '?' },
    inPlaceVal,
    { type: 'token', token: ':' },
    inPlaceVal
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'inPlaceAssignment', type: 'all', parsers: [
    
    inPlaceReference,
    { type: 'token', token: '=' },
    inPlaceVal
    
  ]});
  
  return rootParser;
  
};
let genInput = () => {
  
  return U.multilineString(`
    a => { let v = 100; }
  `).trim();
  
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
  let displayResult = (parsed, ind=0) => {
    
    let indStr = ' '.repeat(ind * 2);
    let log = str => console.log(indStr + str);
    log(`${parsed.parser.name || '<anon>'} (${parsed.parser.type}): "${parsed.result}"`);
    
    if (parsed.parser.type === 'any')
      displayResult(parsed.child, ind + 1);
    
    if ([ 'repeat', 'all' ].has(parsed.parser.type))
      for (let child of parsed.children) displayResult(child, ind + 1);
    
    if (parsed.diveTail) {
      displayResult(parsed.diveTail, ind + 1);
    }
    
  };
  
  let parser = genParser();
  let input = genInput();
  for (let parsed of parse(parser, input)) {
    displayResult(parsed);
    //console.log(`MATCH <${parsed.result}>`, require('util').inspect(cleanResult(parsed), { colors: true, depth: Infinity }));
    break;
    console.log('\n\n');
  }
  
})();
