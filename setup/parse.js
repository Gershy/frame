require('./clearing.js');

let data1 = `
let varInt = 98349;
let varFlt = 893.0394809;
`.trim();

let data2 = `
let varInt = 98349;
let varFlt = 893.0394809;
let varBoolTrue = true;
let varBoolFalse = false;
let varArrEmpty = [];
let varArrInts = [ 3423, 9879, 9837483 ];
let varArrStrs = [
  'abc', 'def', 'ghi', 'jklmnopqr',
  'stu', 'vwx', 'yz'
];
let varArrVars = [ varBoolTrue, varBoolFalse, varArrEmpty ];
let varArrMixed = [
  varFlt, [ 'a', 'b' ], 493, 983789.3487
];`.trim();

let Parser = U.inspire({ name: 'Parser', methods: (insp, Insp) => ({
  init: function(name) {
    if (!U.isType(name, String)) throw Error(`Name was not a String (${U.nameOf(name)})`);
    this.name = `${name}?`;
  },
  trimSpace: function() { return true; },
  getChildren: function() { return []; },
  directPossiblePrefixParsers: function() { return []; },
  possiblePrefixParsers: function() {
    
    let result = Set();
    let unresolved = [ this ];
    
    while (unresolved.count()) {
      
      let origUnresolved = unresolved;
      unresolved = [];
      
      for (let prefixParser of origUnresolved) {
        
        if (result.has(prefixParser)) continue;
        result.add(prefixParser);
        unresolved.gain(prefixParser.directPossiblePrefixParsers());
        
      }
      
    }
    
    return [ ...result ];
    
  },
  getFlattened: function(seen=Set()) {
    
    if (seen.has(this)) return [];
    seen.add(this);
    for (let child of this.getChildren()) child.getFlattened(seen);
    return [ ...seen ];
    
  },
  getDirectJurisdiction: function() { return [ this ]; },
  consume: function*(input, chain=[ this ]) {
    
    let n = U.dbgCnt('dbg');
    console.log(chain.map(n => n.name).join('.'));
    
    if (n > 500) process.exit(0);
    
    let headSpace = '';
    let tailSpace = '';
    
    if (this.trimSpace()) {
      
      while (input[0].trim() === '') {
        headSpace += input[0];
        input = input.slice(1);
      }
      while (input[input.length - 1].trim() === '') {
        tailSpace = input[input.length - 1] + tailSpace;
        input = input.slice(0, -1);
      }
      
    }
    
    for (let node of this.consumeSanitized(input, chain)) {
      node.consumed = `${headSpace}${node.consumed}${tailSpace}`;
      yield node;
    }
    
  },
  consumeSanitized: C.noFn('consume', function*(input, chain){})
})});
let RegexParser = U.inspire({ name: 'RegexParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name, regex, alwaysConsumesChar=true) {
    insp.Parser.init.call(this, name);
    this.regex = regex;
    this.alwaysConsumesChar = alwaysConsumesChar;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    let match = input.match(this.regex);
    if (match) yield { input, chain, inner: [], consumed: match[0] };
  }
})});
let TokenParser = U.inspire({ name: 'TokenParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name, token) {
    if (token.count() === 0) throw Error(`Invalid 0-length token`);
    insp.Parser.init.call(this, name);
    this.token = token;
  },
  consumeSanitized: function*(input, chain=[ this ]) {
    
    // The token doesn't exist as a prefix
    if (!input.hasHead(this.token)) return;
    yield { input, chain, inner: [], consumed: this.token };
    
  }
})});
let SpaceParser = U.inspire({ name: 'SpaceParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name) { this.name = name; },
  trimSpace: function() { return false; },
  consumeSanitized: function*(input, chain=[ this ]) {
    if (!input.count() || input[0].trim().count() > 0) return;
    yield { input, chain, inner: [], consumed: input[0] }
  }
})});
let AnyParser = U.inspire({ name: 'AnyParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name, parsers) {
    insp.Parser.init.call(this, name);
    this.parsers = parsers;
  },
  getChildren: function() { return [ ...this.parsers ]; },
  directPossiblePrefixParsers: function() { return [ ...this.parsers ]; },
  consumeSanitized: function*(input, chain=[ this ]) {
    
    for (let parser of this.parsers) {
      
      for (let node of parser.consume(input, [ ...chain, parser ])) {
        
        yield { input, chain, inner: [ node ], consumed: node.consumed };
        
      }
      
    }
    
  }
})});
let AllParser = U.inspire({ name: 'AllParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name, parsers=[]) {
    insp.Parser.init.call(this, name);
    this.parsers = parsers;
  },
  getChildren: function() { return [ ...this.parsers ]; },
  directPossiblePrefixParsers: function() { return this.parsers.slice(0, 1); },
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
    
  }
})});
let RepeatParser = U.inspire({ name: 'RepeatParser', insps: { Parser }, methods: (insp, Insp) => ({
  init: function(name, min=null, max=null, parser=null) {
    if (!parser) throw Error('Need "parser" param');
    insp.Parser.init.call(this, name);
    this.parser = parser;
    this.min = min;
    this.max = max;
  },
  getChildren: function() { return [ this.parser ]; },
  directPossiblePrefixParsers: function() { return [ this.parser ]; },
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
  
  console.log(`Got ${nodes.length} result(s):`);
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
  RegexParser('data', /([^']|\\')*/),
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

parsers.anyNum.parsers.push(parsers.int);
parsers.anyNum.parsers.push(parsers.flt);

parsers.anyStr.parsers.push(parsers.strQ1);
parsers.anyStr.parsers.push(parsers.strQ2);
parsers.anyStr.parsers.push(parsers.strBt);

parsers.anyVal.parsers.push(parsers.int);
parsers.anyVal.parsers.push(parsers.flt);
parsers.anyVal.parsers.push(parsers.anyStr);
parsers.anyVal.parsers.push(parsers.arr);
parsers.anyVal.parsers.push(parsers.obj);
parsers.anyVal.parsers.push(parsers.sum);
parsers.anyVal.parsers.push(parsers.sub);
parsers.anyVal.parsers.push(parsers.mult);
parsers.anyVal.parsers.push(parsers.div);

console.log(parsers.anyVal.getFlattened());

return;

showResults({
  input: '[ 1, 2, 3, { a: 1, b: 2, c: 3 }]',
  parser: parsers.anyVal
});
