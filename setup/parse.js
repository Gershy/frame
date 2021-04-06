require('./clearing.js');

let log = (v, depth=Infinity) => console.log(require('util').inspect(v, { depth, colors: true }));
let whiteSpaceRegex = /[ \n\t]/;
let globalOmitRegex = /([ \n\t]|([/][/].*[\n])|([/][*].*[*][/]))*/;

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
    
    if ([ 'nop', 'token', 'regex' ].includes(parser.type)) return true;
    
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
  
  let getLeftRecursionChains = function*(parser, chain=[]) {
    
    // Yields `chain`s of parsers such that each `chain[n]` delegates
    // directly to `chain[n + 1]`, except for the final item in `chain`
    // which delegates directly to `chain[0]`.
    
    if ([ 'nop', 'token', 'regex' ].has(parser.type)) return;
    
    // Check if a loop occurred - find the first occurrence of `parser`
    // in `chain` and return the chain from that point forth
    let findInChain = chain.find(p => p === parser);
    if (findInChain.found)  yield chain.slice(findInChain.ind);
    else                    chain = [ ...chain, parser ];
    
    if (parser.type === 'all') {
      
      yield* getLeftRecursionChains(parser.parsers[0], chain);
      
    } else if (parser.type === 'repeat') {
      
      yield* getLeftRecursionChains(parser.parser, chain);
      
    } else if (parser.type === 'any') {
      
      // Return the chain for every option
      for (let option of parser.parsers) yield* getLeftRecursionChains(option, chain);
      
    } else {
      
      throw Error(`Unexpected parser type: "${parser.type}"`);
      
    }
    
  };
  
  let normalizeLeftRecursionChain = (chain) => {
    
    let addParserChild = (par, child) => {
      
      if (par.type === 'any') {
        
        par.parsers.add(child);
        
      } else if (par.type === 'all') {
        
        throw Error(`Unsure what to do... (maybe this never happens??)`);
        
      } else if (par.type === 'repeat') {
        
        if (par.parser) throw Error(`par.parser should be null!`);
        par.parser = child;
        
      }
      
      return child;
      
    };
    
    let parser = chain[0];
    
    // If `chain.count() === 1` it means there is a structure like:
    // let p = { type: 'any', parsers: [] }; p.parsers.add(p);
    if (chain.count() === 1) {
      
      if (parser.type === 'repeat') {
        // The entire repeating parser is useless!
        for (let k in parser) if (k !== 'name') delete parser[k];
        Object.assign(parser, { type: 'nop' });
        return;
      } else if (parser.type === 'any') {
        // Prevent "any" parsers from referring to themselves
        parser.parsers = parser.parsers.map(p => (p === parser) ? C.skip : p);
        return;
      }
      
    }
    
    if (!parser.diveParser)
      parser.diveParser = { name: '~diveRepeat', type: 'repeat', parser: { name: '~diveAny', type: 'any', parsers: [] } };
    
    let origPar = parser;
    let divePar = (() => {
      
      // `ptr` initially points to the "~diveAny" parser
      let ptr = parser.diveParser.parser;
      
      // Start from the direct child of `parser`. Omit the final parser
      // in `chain`; this is because the final parser will be
      // dive-refactored, not dive-cloned!
      for (let cp of chain.slice(1, -1)) {
        
        ptr = addParserChild(ptr, (() => {
          
          // Create a childless clone of `cp`
          
          if (cp.type === 'any') return cp.map((v, k) => (k === 'parsers') ? [] : v);
          
          // TODO: Can "all" even ever occur in `chain` as neither the
          // first nor last element? It seems like it should always, if
          // anything, be the refactored element!
          if (cp.type === 'all') throw Error(`Unsure what to do here...`); //return cp.map((v, k) => (k === 'parsers') ? [] : v);
          
          if (cp.type === 'repeat') return cp.map((v, k) => (k === 'parser') ? null : v);
          
        })());
        
      }
      
      return ptr;
      
    })();
    
    // `cycleClosingParser` directly delegates to `parser`
    let cycleClosingParser = chain.slice(-1)[0];
    addParserChild(divePar, (() => {
      
      // Refactor `cycleClosingParser` such that it assumes that it is
      // immediately succeeding a successful parse by `parser`, and has
      // no need to delegate to `parser` directly anymore!
      
      if (cycleClosingParser.type === 'any') {
        
        // Remove `parser` as an "any"-option
        return {
          ...cycleClosingParser,
          parsers: cycleClosingParser.parsers.map(p => (p === parser) ? C.skip : p)
        };
        
      } else if (cycleClosingParser.type === 'all') {
        
        // Remove `parser` as a prefix of "all" children
        let numHeads = 0;
        while (cycleClosingParser.parsers[numHeads] === parser) numHeads++;
        if (numHeads > 1) throw Error(`UH OH!`); // "diveTail" ensures *one* instance already preceeds, but this "diveTail" needs to guarantee *several* preceed!
        return {
          ...cycleClosingParser,
          parsers: cycleClosingParser.parsers.slice(numHeads)
        }
        
      } else if (cycleClosingParser.type === 'repeat') {
        
        // TODO: This probably never happens??
        // Produce a "repeat" parser with one less repetition required,
        // since an instance has already been parsed at this point
        let { minReps, maxReps } = getParserParams(cycleClosingParser);
        return { ...cycleClosingParser, minReps: Math.max(0, minReps - 1), maxReps: Math.max(0, maxReps - 1) };
        
      }
      
    })());
    
    // Now neuter `cycleClosingParser` so it can't delegate to `parser`
    if (cycleClosingParser.type === 'any') {
      cycleClosingParser.parsers = cycleClosingParser.parsers.map(p => (p === parser) ? C.skip : p)
    } else if (cycleClosingParser.type === 'all') {
      for (let k in cycleClosingParser) if (k !== 'name') delete cycleClosingParser[k];
      Object.assign(cycleClosingParser, { type: 'nop' });
    } else if (cycleClosingParser.type === 'repeat') {
      for (let k in cycleClosingParser) if (k !== 'name') delete cycleClosingParser[k];
      Object.assign(cycleClosingParser, { type: 'nop' });
    }
    
  };
  
  // Repeat as long as there are left-recursion chains
  while (true) {
    
    // Restart the generator from the beginning each time
    let chain = getLeftRecursionChains(parser).next().value;
    if (!chain) break;
    
    console.log(`Remove cycle: ${chain.map(p => p.name).join(' -> ')} -> ${chain[0].name}`);
    normalizeLeftRecursionChain(chain);
    
  }
  
  return parser;
  
};
let parseNormalized = function*(parser, input) {
  
  let applyParserTypeFns = {
    
    nop: function*(parser, input, chain=[]) {},
    token: function*(parser, input, chain=[]) {
      if (input.hasHead(parser.token)) yield { parser, result: parser.token };
    },
    regex: function*(parser, input, chain=[]) {
      let [ result=null ] = input.match(parser.regex) || [];
      if (result) yield { parser, result };
    },
    repeat: function*(parser, input, chain=[]) {
      
      let { greedy, minReps, maxReps } = getParserParams(parser);
      
      let allChildrenPerms = function*(offset=0, num=0) {
        
        if (num > maxReps) return;
        
        for (let parsedHead of applyParser(parser.parser, input.slice(offset), [ ...chain, parser.parser ])) {
          
          if (!greedy && num >= minReps) yield [ parsedHead ];
          for (let parsedTail of allChildrenPerms(offset + parsedHead.result.length, num + 1)) yield [ parsedHead, ...parsedTail ];
          if (greedy && num >= minReps) yield [ parsedHead ];
          
        }
        
      }
      
      if (!greedy && minReps === 0) yield { parser, result: '', children: [] };
      for (let children of allChildrenPerms()) yield { parser, result: children.map(r => r.result).join(''), children };
      if (greedy && minReps === 0) yield { parser, result: '', children: [] };
      
    },
    all: function*(parser, input, chain=[]) {
      
      let lastChildOffset = parser.parsers.count() - 1;
      
      let allChildrenPerms = function*(inputOffset=0, childOffset=0) {
        
        let childParser = parser.parsers[childOffset];
        
        if (childOffset === lastChildOffset) {
          
          // Immediately yield tail-less results for the final offset
          for (let parsedHead of applyParser(childParser, input.slice(inputOffset), [ ...chain, childParser ])) yield [ parsedHead ];
          
        } else {
          
          // Yield head + tail for non-final parsers
          for (let parsedHead of applyParser(childParser, input.slice(inputOffset), [ ...chain, childParser ]))
            for (let parsedTail of allChildrenPerms(inputOffset + parsedHead.result.length, childOffset + 1))
              yield [ parsedHead, ...parsedTail ];
          
        }
        
      }
      
      for (let children of allChildrenPerms()) yield { parser, result: children.map(r => r.result).join(''), children };
      
    },
    any: function*(parser, input, chain=[]) {
      
      for (let p of parser.parsers)
        for (let child of applyParser(p, input, [ ...chain, p ]))
          yield { parser, result: child.result, child };
      
    }
    
  };
  
  let applyParser = function*(parser, input, chain=[]) {
    
    let { consumeWhiteSpace, diveParser, diveGreedy } = getParserParams(parser);
    
    let ind = ' '.repeat(4 * chain.length);
    
    let pre = '';
    if (consumeWhiteSpace) pre = (input.match(globalOmitRegex) || [''])[0]
    input = input.slice(pre.length);
    
    if (!diveParser) {
      
      for (let parsed of applyParserTypeFns[parser.type](parser, input, chain)) {
        yield { ...parsed, result: pre + parsed.result };
      }
      
    } else {
      
      for (let parsedDiveHead of applyParserTypeFns[parser.type](parser, input, chain)) {
        
        let result = pre + parsedDiveHead.result;
        let remainingInput = input.slice(result.length);
        
        if (diveGreedy) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput, [ ...chain, diveParser ])) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
          }
        }
        
        yield { ...parsedDiveHead, result };
        
        if (!diveGreedy) {
          for (let parsedDiveTail of applyParser(diveParser, remainingInput, [ ...chain, diveParser ])) {
            yield { parser, ...parsedDiveHead, result: result + parsedDiveTail.result, diveTail: parsedDiveTail };
          }
        }
        
      }
      
    }
    
  }
  
  let getNormalizedParseTree = parsed => {
    
    // Convert sequential lists of dive results into something more like
    // a one-legged-binary-tree format
    
    if (parsed.parser.type === 'any')
      parsed = { ...parsed, child: getNormalizedParseTree(parsed.child) };
    
    if ([ 'repeat', 'all' ].includes(parsed.parser.type))
      parsed = { ...parsed, children: parsed.children.map(getNormalizedParseTree) };
    
    if (parsed.has('diveTail')) {
      
      if (parsed.diveTail.parser.name !== '~diveRepeat') throw Error(`Unexpected`);
      
      let { diveTail: diveRepeatParsed, ...parsedNormalized } = parsed;
      parsed = parsedNormalized;
      
      // "~diveRepeat" should only contain "~diveAny" items
      if (diveRepeatParsed.children.find(parsed => parsed.parser.name !== '~diveAny').found) throw Error(`Unexpected`);
      
      let resultFromDive = diveRepeatParsed.children.map(c => c.result).join('');
      let resultWithoutDive = parsed.result.slice(0, parsed.result.length - resultFromDive.length);
      let accumulatedResult = resultWithoutDive;
      parsed.result = resultWithoutDive;
      
      for (let diveChild of diveRepeatParsed.children.map(parsed => parsed.child)) {
        
        // `diveChild` is certainly of type "all"!
        diveChild = getNormalizedParseTree(diveChild);
        accumulatedResult += diveChild.result;
        
        // Walk `ptr` down through any number of "any"-type parsers (we
        // need to get to an "all"/"repeat" parser, since those hold a
        // plurality of parsed results, and we need to extend that
        // plurality by prepending it with the pre-dive parsed value)
        let ptr = { ...diveChild, result: accumulatedResult };
        while (ptr.parser.type === 'any') {
          ptr.child = { ...ptr.child, result: accumulatedResult };
          ptr = ptr.child;
        }
        
        parsed = { ...ptr, result: accumulatedResult, children: [ parsed, ...ptr.children ] };
        
      }
      
    }
    
    return parsed;
    
  };
  
  for (let parsed of applyParser(parser, input, [])) {
    if (input.slice(parsed.result.length).trim()) continue;
    yield getNormalizedParseTree(parsed);
  }
  
};
let parse = (parser, input) => parseNormalized(normalizedParser(parser), input);

let genParser = () => {
  
  let delimitedTolerant = (entity, delimiter) => {
    
    return [
      // Any number of entities followed by delimiters
      { name: 'head', type: 'repeat', parser: { name: 'headDelimited', type: 'all', parsers: [ entity, delimiter ]}},
      
      // An optional final entity
      { name: 'tail', type: 'repeat', maxReps: 1, parser: entity },
    ];
    
  };
  
  let inPlaceVal = { name: 'inPlaceVal', type: 'any', parsers: [] };
  
  let varName = { name: 'varName', type: 'regex', regex: '[a-zA-Z$_][a-zA-Z0-9$_]*' };
  
  let inPlaceReference = inPlaceVal.parsers.add({ name: 'inPlaceReference', type: 'any', parsers: [
    
    varName,
    { name: 'propAccessSimple', type: 'all', parsers: [
      inPlaceVal,
      { name: 'propAccessSimpleToken', type: 'token', token: '.' },
      varName
    ]},
    { name: 'propAccessDynamic', type: 'all', parsers: [
      inPlaceVal,
      { type: 'token', token: '[' },
      inPlaceVal,
      { type: 'token', token: ']' }
    ]}
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'binaryInteger', type: 'regex', regex: '[+-]?0b[0-1]+' });
  inPlaceVal.parsers.add({ name: 'octalInteger', type: 'regex', regex: '[+-]?0[0-7]+' });
  inPlaceVal.parsers.add({ name: 'hexInteger', type: 'regex', regex: '[+-]?0x[0-9a-fA-F]+' });
  inPlaceVal.parsers.add({ name: 'decInteger', type: 'regex', regex: '[+-]?[0-9]+' });
  inPlaceVal.parsers.add({ name: 'decFloat', type: 'regex', regex: '[0-9]+[.][0-9]+' });
  inPlaceVal.parsers.add({ name: 'boolean', type: 'regex', regex: 'true|false' });
  
  inPlaceVal.parsers.add({ name: 'inPlaceAssignment', type: 'all', parsers: [
    
    inPlaceReference,
    { name: 'inPlaceAssignmentToken', type: 'token', token: '=' },
    inPlaceVal
    
  ]});
  
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
  
  inPlaceVal.parsers.add({ name: 'bracketedVal', type: 'all', parsers: [
    
    { name: 'bracketedValOpen', type: 'token', token: '(' },
    { name: 'bracketedLeadingVals', type: 'repeat', parser: { type: 'all', parsers: [
      inPlaceVal,
      { type: 'token', token: ',' }
    ]}},
    inPlaceVal,
    { name: 'bracketedValClose', type: 'token', token: ')' }
    
  ]});
  
  let arrayEntity = { name: 'arrayEntity', type: 'any', parsers: [
    inPlaceVal,
    { name: 'spread', type: 'all', parsers: [
      { name: 'spreadToken', type: 'token', token: '...' },
      inPlaceVal
    ]}
  ]};
  inPlaceVal.parsers.add({ name: 'array', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '[' },
    ...delimitedTolerant(arrayEntity, { name: 'delimiter', type: 'token', token: ',' }),
    { name: 'close', type: 'token', token: ']' }
    
  ]});
  
  let objectEntity = { name: 'objectEntity', type: 'any', parsers: [
    varName, // Shorthand - e.g. { a, b, c: 3 }
    { name: 'mapping', type: 'all', parsers: [
      
      { name: 'mappingKey', type: 'any', parsers: [
        varName,
        { name: 'dynamicMappingKey', type: 'all', parsers: [
          { name: 'dynamicMappingOpen', type: 'token', token: '[' },
          inPlaceVal,
          { name: 'dynamicMappingClose', type: 'token', token: ']' }
        ]}
      ]},
      { name: 'mappingDelim', type: 'token', token: ':' },
      inPlaceVal
      
    ]},
    { name: 'spread', type: 'all', parsers: [
      { name: 'spreadToken', type: 'token', token: '...' },
      inPlaceVal
    ]}
  ]};
  inPlaceVal.parsers.add({ name: 'object', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '{' },
    ...delimitedTolerant(objectEntity, { name: 'delimiter', type: 'token', token: ',' }),
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
    ...delimitedTolerant(arrayEntity, { name: 'delimiter', type: 'token', token: ',' }),
    { name: 'close', type: 'token', token: ')' }
    
  ]};
  let assignable = { name: 'assignable', type: 'any', parsers: []};
  assignable.parsers.add(varName);
  assignable.parsers.add({ name: 'destructureArray', type: 'all', parsers: [
    { name: 'destructureArrayOpen', type: 'token', token: '[' },
    ...delimitedTolerant(arrayEntity, { name: 'delimiter', type: 'token', token: ',' }),
    { name: 'destructureArrayClose', type: 'token', token: ']' }
  ]});
  assignable.parsers.add({ name: 'destructureObject', type: 'all', parsers: [
    { name: 'destructureArrayOpen', type: 'token', token: '{' },
    ...delimitedTolerant(objectEntity, { name: 'delimiter', type: 'token', token: ',' }),
    { name: 'destructureArrayClose', type: 'token', token: '}' }
  ]});
  
  let blockStatement = { name: 'blockStatement', type: 'any', parsers: []};
  
  let functionBodyStatement = { name: 'functionBodyStatement', type: 'any', parsers: [
    
    { name: 'functionBodyVarAssign', type: 'all', parsers: [
      
      { name: 'functionBodyVarAssignType', type: 'any', parsers: [
        { name: 'functionBodyVarAssignLet', type: 'token', token: 'let' },
        { name: 'functionBodyVarAssignConst', type: 'token', token: 'const' },
        { name: 'functionBodyVarAssignVar', type: 'token', token: 'var' }
      ]},
      assignable,
      { name: 'functionBodyVarAssignToken', type: 'token', token: '=' },
      inPlaceVal
      
    ]},
    
    blockStatement,
    
    inPlaceVal,
    
    { name: 'functionBodyReturn', type: 'all', parsers: [
      
      { name: 'functionBodyReturnToken', type: 'token', token: 'return' },
      { name: 'functionBodyReturnOptionalValue', type: 'repeat', maxReps: 1, parser: inPlaceVal }
      
    ]},
    { name: 'functionBodyThrow', type: 'all', parsers: [
      
      { name: 'functionBodyReturnToken', type: 'token', token: 'throw' },
      { name: 'functionBodyReturnOptionalValue', type: 'repeat', maxReps: 1, parser: inPlaceVal }
      
    ]}
    
  ]};
  let functionBody = { name: 'functionBody', type: 'all', parsers: [
    
    ...delimitedTolerant(functionBodyStatement, { name: 'functionBodyStatementDelimiter', type: 'any', parsers: [
      { name: 'functionBodyStatementDelimiterSemicolon', type: 'token', token: ';' },
      { name: 'functionBodyStatementDelimiterWhiteSpace', consumeWhiteSpace: false, type: 'regex', regex: whiteSpaceRegex },
    ]})
    
  ]};
  let functionBodyDelimited = { name: 'functionBodyDelimited', type: 'all', parsers: [
    
    { name: 'functionBodyOpen', type: 'token', token: '{' },
    functionBody,
    { name: 'functionBodyClose', type: 'token', token: '}' }
    
  ]};
  
  let shorthandableFunctionBody = { name: 'shorthandableFunctionBody', type: 'any', parsers: [
    inPlaceVal,
    functionBodyDelimited
  ]};
  
  blockStatement.parsers.add({ name: 'ifBlockStatement', type: 'all', parsers: [
    
    { name: 'ifBlockStatementToken', type: 'token', token: 'if' },
    { name: 'ifBlockStatementConditionOpen', type: 'token', token: '(' },
    inPlaceVal,
    { name: 'ifBlockStatementConditionClose', type: 'token', token: ')' },
    shorthandableFunctionBody
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'functionDef', type: 'all', parsers: [
    
    { name: 'functionDefToken', type: 'token', token: 'function' },
    
    // Optional function name
    { name: 'functionInlineOptionalName', type: 'repeat', maxReps: 1, parser: { type: 'all', parsers: [
      { name: 'functionNameWhiteSpaceSeparator', type: 'regex', consumeWhiteSpace: false, regex: whiteSpaceRegex },
      varName
    ]}},
    
    functionDefParams,
    
    functionBodyDelimited
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'shorthandFunctionDef', type: 'all', parsers: [
    
    // Shorthand functions allowed a single simple unbracketed parameter
    { name: 'shorthandFunctionParams', type: 'any', parsers: [
      varName,
      functionDefParams
    ]},
    { name: 'shorthandFunctionToken', type: 'token', token: '=>' },
    shorthandableFunctionBody
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'functionCall', type: 'all', parsers: [
    
    inPlaceVal,
    functionCallParams
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'unaryOperation', type: 'all', parsers: [
    
    { name: 'unaryOperators', type: 'any', parsers: [
      { name: 'negate', type: 'token', token: '!' },
      { name: 'positive', type: 'token', token: '+' },
      { name: 'negative', type: 'token', token: '-' }
    ]},
    inPlaceVal
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'binaryOperation', type: 'all', parsers: [
    
    inPlaceVal,
    { type: 'any', parsers: [
      { name: 'add', type: 'token', token: '+' },
      { name: 'subtract', type: 'token', token: '-' },
      { name: 'multiply', type: 'token', token: '*' },
      { name: 'divide', type: 'token', token: '/' },
      { name: 'booleanAnd', type: 'token', token: '&&' },
      { name: 'booleanOr', type: 'token', token: '||' },
      { name: 'bitwiseAnd', type: 'token', token: '&' },
      { name: 'bitwiseOr', type: 'token', token: '|' },
      { name: 'comparisonStrict', type: 'token', token: '===' },
      { name: 'comparisonLoose', type: 'token', token: '==' }
    ]},
    inPlaceVal
    
  ]});
  
  inPlaceVal.parsers.add({ name: 'ternary', type: 'all', parsers: [
    
    inPlaceVal,
    { type: 'token', token: '?' },
    inPlaceVal,
    { type: 'token', token: ':' },
    inPlaceVal
    
  ]});
  
  return functionBody;
  
};

let displayResult = (parsed, ind=0) => {
  
  let indStr = ' '.repeat(ind * 4);
  let log = str => console.log(indStr + str);
  let result = parsed.result.replace(/\n/g, '\\n').slice(0, 100);
  
  log(`${parsed.parser.name || '<anon>'} (${parsed.parser.type}): "${result}"`);
  
  if (parsed.parser.type === 'any')
    displayResult(parsed.child, ind + 1);
  
  if ([ 'repeat', 'all' ].has(parsed.parser.type))
    for (let child of parsed.children) displayResult(child, ind + 1);
  
  if (parsed.diveTail) {
    displayResult(parsed.diveTail, ind + 1);
  }
  
};

(async () => {
  
  let input = process.argv.slice(2).join(' ').trim();
  if (input.hasHead('::')) input = await require('fs').promises.readFile(input.slice(2), 'utf8');
  input = input.split('%%%')[0];
  
  let parser = genParser();
  
  for (let parsed of parse(parser, input)) {
    console.log('\n');
    displayResult(parsed);
    break;
    console.log('');
  }
  
})()
  .then(() => console.log('Done'))
  .catch(err => console.log('FATAL:', err.stack));
