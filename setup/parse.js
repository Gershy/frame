require('./clearing.js');

// https://en.wikipedia.org/wiki/Left_recursion

let parse = (parser, input) => parseNormalized(normalizedParser(parser), input);

let getParserParams = parser => {
  
  if (parser.type === 'repeat') return { minReps: 0, maxReps: Infinity, greedy: true, ...parser };
  return { ...parser };
  
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
    if (p.type === 'regex' && U.isForm(p.pattern, String)) {
      if (!p.pattern.hasHead('^')) p.pattern = `^(${p.pattern})`;
      p.pattern = new RegExp(p.pattern.replace(/\\/g, '\\\\')); // Escape all backslashes
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
      let [ result=null ] = input.match(parser.pattern) || [];
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
    if (!parser) throw Error(`Invalid parser: ${U.getFormName(parser)}`);
    yield* applyParserTypeFns[parser.type](parser, input);
  }
  
  yield* applyParser(parser, input);
  
};

let genParser = () => {
  
  let rootParser = { name: 'root', type: 'any', parsers: [] };
  
  let inPlaceValue = rootParser.parsers.add({ name: 'inPlaceValue', type: 'any', parsers: [] });
  
  let varRef = { name: 'varRef', type: 'regex', pattern: '[a-zA-Z$_][a-zA-Z0-9$_]*' };
  
  inPlaceValue.parsers.add(varRef);
  
  inPlaceValue.parsers.add({ name: 'singleQuoteString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: `'` },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', pattern: `[^\\']+` },
      { name: 'escapeSeq', type: 'regex', pattern: `\\.` }
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: `'` }
    
  ]});
  
  inPlaceValue.parsers.add({ name: 'doubleQuoteString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: '"' },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', pattern: `[^\\"]+` }, // Non-backslash, non-double-quote
      { name: 'escapeSeq', type: 'regex', pattern: `\\.` }     // Backslash followed by anything
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: '"' }
    
  ]});
  
  inPlaceValue.parsers.add({ name: 'backtickString', type: 'all', parsers: [
    
    { name: 'openQuote', type: 'token', token: '`' },
    
    { name: 'contentEntities', type: 'repeat', parser: { name: 'contentEntity', type: 'any', parsers: [
      
      { name: 'chars', type: 'regex', pattern: '([^\\`$]|$[^{])+' },
      
      { name: 'escapeSeq', type: 'regex', pattern: '\\.' },
      
      { name: 'interpolatedValue', type: 'all', parsers: [
        
        { name: 'openInterpolatedValue', type: 'token', token: '${' },
        
        inPlaceValue,
        
        { name: 'closeInterpolatedValue', type: 'token', token: '}' }
        
      ]}
      
    ]}},
    
    { name: 'closeQuote', type: 'token', token: '`' }
    
  ]});
  
  inPlaceValue.parsers.add({ name: 'decimalInteger', type: 'regex', pattern: '[0-9]+' });
  
  inPlaceValue.parsers.add({ name: 'decimalFloat', type: 'regex', pattern: '[0-9]+[.][0-9]+' });
  
  inPlaceValue.parsers.add({ name: 'boolean', type: 'regex', pattern: 'true|false' });
  
  let arrayEntity = { name: 'arrayEntity', type: 'any', parsers: [
    inPlaceValue,
    { name: 'spreadEntity', type: 'all', parsers: [
      { type: 'token', token: '...' },
      inPlaceValue
    ]}
  ]};
  inPlaceValue.parsers.add({ name: 'array', type: 'all', parsers: [
    
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
      inPlaceValue
      
    ]},
    
  ]};
  inPlaceValue.parsers.add({ name: 'object', type: 'all', parsers: [
    
    { name: 'open', type: 'token', token: '{' },
    
    { name: 'headEntities', type: 'repeat', parser: { type: 'all', parsers: [
      
      objectEntity,
      { name: 'delimiter', type: 'token', token: ',' }
      
    ]}},
    
    { name: 'tailEntity', type: 'repeat', maxReps: 1, parser: objectEntity },
    
    { name: 'close', type: 'token', token: '}' }
    
  ]});
  
  return rootParser;
  
};
let genInput = () => {
  
  return '{a:1}';
  
};

(() => {
  
  let cleanResult = (result, seen=Map()) => {
    
    if (!result) throw Error('BAD');
    
    if (seen.has(result)) return seen.get(result);
    let clean = {};
    seen.set(result, clean);
    
    clean.parser = `${result.parser.name || '<anon>'} (${result.parser.type})`;
    clean.result = result.result;
    
    if (result.parser.type === 'any')
      clean.child = cleanResult(result.child, seen);
    
    if ([ 'repeat', 'all' ].includes(result.parser.type))
      clean.children = result.children.map(child => cleanResult(child, seen));
    
    return clean;
    
  };
  
  let parser = genParser();
  let input = genInput();
  for (let match of parse(parser, input)) {
    console.log(`MATCH <${input}>`, require('util').inspect(cleanResult(match), { colors: true, depth: Infinity }));
    break;
  }
  
})();

return;

let data1 = U.multilineString(`
  let varInt = 98349;
  let varFlt = 893.0394809;
`);
let data2 = U.multilineString(`
  let varInt = 98349;
  let varFlt = 893.0394809;
  let varBoolTrue = true;
  let varBoolFalse = false;
  let varArrEmpty = [];
  let varArrInts = [ 3423, 9879, 9837483 ];
  let varArrStrs = [ 'abc', 'def', 'ghi', 'jklmnopqr', 'stu', 'vwx', 'yz' ];
  let varArrVars = [ varBoolTrue, varBoolFalse, varArrEmpty ];
  let varArrMixed = [
    varFlt, [ 'a', 'b' ], 493, 983789.3487
  ];
`);

let Parser = U.form({ name: 'Parser', props: (insp, Insp) => ({
  
  $from: (rep, seen=Map()) => {
    
    if (!seen.has(rep)) {
      
      let parsers = { RegexParser, TokenParser, SpaceParser, AnyParser, AllParser, RepeatParser };
      let { cls, name, ...props } = rep;
      if (!parsers.has(`${cls}Parser`)) throw Error(`Invalid parser class: "${cls}Parser"`);
      
      let parser = parsers[`${cls}Parser`](name);
      seen.set(rep, parser);
      
      // Add all properties
      for (let k in props) parser[k] = props[k];
      
      // Handle special types
      if (U.isForm(parser, AnyParser)) {
        
        parser.parsers = parser.parsers.map(rep => Parser.from(rep, seen));
        
      } else if (U.isForm(parser, AllParser)) {
        
        parser.parsers = parser.parsers.map(rep => Parser.from(rep, seen));
        
      } else if (U.isForm(parser, RepeatParser)) {
        
        parser.parser = Parser.from(parser.parser, seen);
        
      }
      
    }
    
    return seen.get(rep);
    
  },
  $repGetChildren: rep => ({ // All child parsers of `rep`
    Any: [ ...rep.parsers ],
    All: [ ...rep.parsers ],
    Repeat: [ rep.parser ]
  })[rep.cls] || [],
  $repGetCycleHazards: rep => ({ // Reps that, if they form cycles with `rep`, could lead to left-recursion
    Any: [ ...rep.parsers ],
    All: [ rep.parsers[0] ],
    Repeat: [ rep.parser ]
  })[rep.cls] || [],
  $repNormalize: (rep, seen=Map()) => {
    
    if (!seen.has(rep)) {
      seen.set(rep, {});
      
      let cycleHazards = ({
        Any: rep => [ ...rep.parsers ],
        All: rep => [ rep.parsers[0] ],
        Repeat: rep => [ rep.parser ]
      })[rep.cls] || [];
      
      seen.get(rep).gain({
        
      });
    }
    return seen.get(rep);
    
  },
  
  init: function(name) {
    if (!U.isForm(name, String)) throw Error(`Name was not a String (${U.nameOf(name)})`);
    this.name = name;
  },
  trimSpace: function() { return true; },
  consume: function*(input, chain=[ this ]) {
    
    let n = U.dbgCnt('dbg');
    if (n > 500) { console.log('YIKES!!'); process.exit(0); }
    
    let headSpace = '';
    let tailSpace = '';
    
    if (this.trimSpace()) {
      while (!input[0].trim()) { headSpace += input[0]; input = input.slice(1); }
      while (!input.slice(-1).trim()) { tailSpace = input.slice(-1) + tailSpace; input = input.slice(0, -1); }
    }
    
    for (let node of this.consumeSanitized(input, chain)) {
      node.consumed = `${headSpace}${node.consumed}${tailSpace}`;
      yield node;
    }
    
  },
  consumeSanitized: C.noFn('consume', function*(input, chain){}),
  normalized: function() {
    return Parser.from(Parser.repNormalize(this.toRep()));
  },
  
  toRep: function(seen=Map()) {
    if (!seen.has(this)) {
      seen.set(this, {});
      this.populateRep(seen.get(this), seen);
    }
    return seen.get(this);
  },
  populateRep: function(obj, seen) {
    obj.gain({ cls: this.constructor.name.slice(0, -6), ...this });
  }
})});
let RegexParser = U.form({ name: 'RegexParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name, regex) {
    insp.Parser.init.call(this, name);
    this.regex = regex;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    let match = input.match(this.regex);
    if (match) yield { input, chain, inner: [], consumed: match[0] };
  }
})});
let TokenParser = U.form({ name: 'TokenParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name, token) {
    //if (token.count() === 0) throw Error(`Invalid 0-length token`);
    insp.Parser.init.call(this, name);
    this.token = token;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    // The token doesn't exist as a prefix
    if (!input.hasHead(this.token)) return;
    yield { input, chain, inner: [], consumed: this.token };
  }
})});
let SpaceParser = U.form({ name: 'SpaceParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name) { this.name = name; },
  trimSpace: function() { return false; },
  consumeSanitized: function*(input, chain=[ this ]) {
    if (!input.count() || input[0].trim().count() > 0) return;
    yield { input, chain, inner: [], consumed: input[0] }
  }
})});
let AnyParser = U.form({ name: 'AnyParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name, parsers=[]) {
    insp.Parser.init.call(this, name);
    this.parsers = parsers;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    
    for (let parser of this.parsers) {
      
      for (let node of parser.consume(input, [ ...chain, parser ])) {
        
        yield { input, chain, inner: [ node ], consumed: node.consumed };
        
      }
      
    }
    
  },
  
  populateRep: function(obj, seen) {
    insp.Parser.populateRep.call(this, obj, seen);
    obj.parsers = this.parsers.map(p => p.toRep(seen));
  }
})});
let AllParser = U.form({ name: 'AllParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name, parsers=[]) {
    insp.Parser.init.call(this, name);
    this.parsers = parsers;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    
    let nodeSeqs = [[]];
    for (let parser of this.parsers) {
      
      let origNodeSeqs = nodeSeqs;
      nodeSeqs = [];
      
      for (let nodeSeq of origNodeSeqs) {
        
        let seqTotalLength = nodeSeq.reduce((reg, { consumed }) => reg + consumed.count(), 0);
        let childInput = input.slice(seqTotalLength);
        
        // Include sequence once for each time the child parser returns a sequence result
        // Each included sequence is suffixed with the child parser's result
        // If the child parser returns no results the sequence is discontinued
        for (let parsedNode of parser.consume(childInput, [ ...chain, parser ])) {
          nodeSeqs.push([ ...nodeSeq, parsedNode ]);
        }
        
      }
      
    }
    for (let nodeSeq of nodeSeqs) yield { input, chain, inner: nodeSeq, consumed: nodeSeq.map(node => node.consumed).join('') };
    
  },
  
  populateRep: function(obj, seen) {
    insp.Parser.populateRep.call(this, obj, seen);
    obj.parsers = this.parsers.map(p => p.toRep(seen));
  }
})});
let RepeatParser = U.form({ name: 'RepeatParser', has: { Parser }, props: (insp, Insp) => ({
  init: function(name, min=null, max=null, parser=null) {
    //if (!parser) throw Error('Need "parser" param');
    insp.Parser.init.call(this, name);
    this.parser = parser;
    this.min = min;
    this.max = max;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    
    let nodeSeqs = [[]];
    while (true) {
      
      let origNodeSeqs = nodeSeqs;
      nodeSeqs = [];
      
      for (let nodeSeq of origNodeSeqs) {
        let seqTotalLength = nodeSeq.reduce((reg, { consumed }) => reg + consumed.count(), 0);
        let childInput = input.slice(seqTotalLength);
        
        let gotParsedNode = false;
        if (this.max === null || nodeSeq.count() < this.max) {
          for (let parsedNode of this.parser.consume(childInput, [ ...chain, this.parser ])) {
            gotParsedNode = true;
            nodeSeqs.push([ ...nodeSeq, parsedNode ]);
          }
        }
        
        if (!gotParsedNode && (this.min === null || nodeSeq.count() >= this.min)) {
          yield { input, chain, inner: nodeSeq, consumed: nodeSeq.map(node => node.consumed).join('') };
        }
        
      }
      
      if (!nodeSeqs.count()) break;
      
    }
    
  },
  populateRep: function(obj, seen) {
    insp.Parser.populateRep.call(this, obj, seen);
    obj.parser = this.parser.toRep(seen);
  }
})});

let c = String.fromCharCode(721);
let descNode = node => node.chain.map(parser => parser.name).join('.');
let showResult = (node, indent=0) => {
  let ind = ' '.repeat(indent);
  console.log(`${ind}${node.chain.slice(-1)[0].name} -> ${c.repeat(3)}${node.consumed.replace(/\n/g, '<>')}${c.repeat(3)}`);
  for (let childNode of node.inner) showResult(childNode, indent + 2);
};
let showResults = ({ input, parser }) => {
  
  console.log(`\nPARSING ${c.repeat(3)}${input.replace(/\n/g, '$$')}${c.repeat(3)}`);
  let nodes = [ ...parser.consume(input) ].map(node => node.consumed === input ? node : C.skip);
  
  console.log(`Got ${nodes.count()} result(s):`);
  for (let i = 0; i < nodes.count(); i++) { console.log(`RESULT #${i + 1}:`); showResult(nodes[i], 2); }
  
};

let testSimple = false;
if (testSimple) {
  showResults({
    input: 'abcd',
    parser: TokenParser('alphabet', 'abcd')
  });

  showResults({
    input: '    abcd    ',
    parser: AnyParser('any', [ TokenParser('alphabet', 'abcd'), RegexParser('letters', /[a-z]*/) ])
  });

  showResults({
    input: '()',
    parser: AllParser('emptyBraces', [
      TokenParser('tokenHeadNormParen', '('),
      TokenParser('tokenTailNormParen', ')')
    ])
  });

  showResults({
    input: 'let myCoolVar = mySweetVar;',
    parser: AllParser('all', [
      TokenParser('tokenLet', 'let'),
      SpaceParser('space'),
      RegexParser('var1', /[a-zA-Z]([a-zA-Z0-9_$]*)/),
      TokenParser('tokenAssign', '='),
      RegexParser('var2', /[a-zA-Z]([a-zA-Z0-9_$]*)/),
      TokenParser('tokenEndStatement', ';')
    ])
  });
}

let parsers = {};

parsers.anyStr = AnyParser('anyStr', []);
parsers.anyVal = AnyParser('anyVal', []);
parsers.anyNum = AnyParser('anyNum', []);

parsers.int = RegexParser('int', /[-+]?[0-9]+/);
parsers.flt = RegexParser('flt', /[-+]?[0-9]*[.][0-9]+/);

parsers.jsVar = RegexParser('jsVar', /[a-zA-Z$_][a-zA-Z$_0-9]*/);

parsers.sum = AllParser('sum', [ parsers.anyVal, TokenParser('add', '+'), parsers.anyVal ]);
parsers.sub = AllParser('sub', [ parsers.anyVal, TokenParser('sub', '-'), parsers.anyVal ]);
parsers.mult = AllParser('mult', [ parsers.anyVal, TokenParser('mult', '*'), parsers.anyVal ]);
parsers.div = AllParser('div', [ parsers.anyVal, TokenParser('div', '/'), parsers.anyVal ]);

parsers.strQ1 = AllParser('strQ1', [
  TokenParser('open', `'`),
  RegexParser('data', /([^']|\\')*/), // Fails on strings whose last character is a backquote :P
  TokenParser('shut', `'`)
]);
parsers.strQ2 = AllParser('strQ2', [
  TokenParser('open', '"'),
  RegexParser('data', /([^"]|\\")*/),
  TokenParser('shut', '"')
]);
parsers.strBt = AllParser('strBt', [
  TokenParser('open', '`'),
  RegexParser('data', /([^`]|\\`)*/),
  TokenParser('shut', '`')
]);

parsers.arr = AllParser('arr', [
  TokenParser('open', '['),
  RepeatParser('vals', null, null,
    AllParser('delimVal', [ parsers.anyVal, TokenParser('delim', ',') ])
  ),
  RepeatParser('lastVal', 0, 1, parsers.anyVal),
  TokenParser('shut', ']')
]);
parsers.objEntry = AllParser('entry', [
  AnyParser('anyEntry', [
    AllParser('dynamicEntry', [ TokenParser('open', '['), parsers.anyVal, TokenParser('shut', ']') ]),
    AnyParser('normalEntry', [
      parsers.jsVar,
      parsers.anyStr,
      parsers.int,
      parsers.flt
    ])
  ]),
  TokenParser('map', ':'),
  parsers.anyVal
]);
parsers.obj = AllParser('obj', [
  TokenParser('open', '{'),
  RepeatParser('entries', null, null, AllParser('delimEntry', [
    parsers.objEntry,
    TokenParser('delim', ',')
  ])),
  RepeatParser('lastEntry', 0, 1, parsers.objEntry),
  TokenParser('shut', '}')
]);

parsers.anyNum.parsers.gain([ parsers.int, parsers.flt ]);
parsers.anyStr.parsers.gain([ parsers.strQ1, parsers.strQ2, parsers.strBt ]);
parsers.anyVal.parsers.gain([
  parsers.anyStr,
  parsers.int,
  parsers.flt,
  //parsers.arr,
  //parsers.obj,
  //parsers.sum,
  //parsers.sub,
  //parsers.mult,
  //parsers.div
]);
// parsers.anyVal.parsers.push(parsers.sum);
// parsers.anyVal.parsers.push(parsers.sub);
// parsers.anyVal.parsers.push(parsers.mult);
// parsers.anyVal.parsers.push(parsers.div);

//console.log(parsers.anyVal);
//console.log(Parser.from(parsers.anyVal.toRep()));
showResults({
  input: `'abcd'`,
  parser: parsers.anyVal
});

try {
  showResults({
    input: '[ 1, 2, 3 ]',
    parser: parsers.arr
  });
} catch(err) {
  console.log(err);
}

return;


/*
// e.g.:
num -> sum | sub | /R/
sum -> num , '+' , num
sub -> num , '-' , num


num -> /R/ , 



/R/ ( ( '+' | '-' ) /R/ )*


// cycles:
num -> sum -> num
num -> sub -> num
*/
