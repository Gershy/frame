// TODO: Check out BinaryOp and BracketedValue

var package = new PACK.pack.Package({ name: 'parse',
	dependencies: [ 'e', 'quickDev' ],
	buildFunc: function() {
		var n = {};
		var ret = {
			Parser: PACK.uth.makeClass({ name: 'Parser',
				namespace: n,
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					},
					tokenize: function(input) {
						var obj = { objs: [], delimA: null, delimB: null };
						this.doTokenize({ obj: obj, input: input, inputPos: 0 });
						return obj.objs.length === 1 ? obj.objs[0] : obj;
					},
					doTokenize: function(params /* obj, input, inputPos, encapsData, escapeChars */) {
						var obj = U.param(params, 'obj');
						var input = U.param(params, 'input');
						var inputPos = U.param(params, 'inputPos');
						var encapsData = U.param(params, 'encapsData', { '{' : '}', '[' : ']', '(' : ')', '"' : '"', "'" : "'" });
						var escapeSeqs = U.param(params, 'escapeSeqs', { '\\': true });
						
						var endDelim = obj.delimB;
						var stringElem = '';
						
						for (var i = inputPos, len = input.length; i < len; i++) {
							
							var c = input[i]; // Get the current character
							
							if (c in escapeSeqs) {
								i++;
								stringElem += input[i];
								continue;
							}
							
							// Check for conditions that terminate the string currently being built
							if (c === endDelim || c in encapsData) {
								
								// Finish whatever was being worked on
								if (stringElem.trim().length > 0) {
									obj.objs.push(stringElem);
									stringElem = '';
								}
								
								if (c === endDelim) {
									
									// Found the end of the current element being parsed
									return i;
									
								} else if (c in encapsData) {
									
									var innerObj = { objs: [], delimA: c, delimB: encapsData[c] };
									
									i = this.doTokenize({ obj: innerObj, input: input, inputPos: i + 1, encapsData: encapsData });
									
									obj.objs.push(innerObj);
									
								}
								
							} else {
								
								stringElem = stringElem + c;
								
							}
							
						}
						
						if (stringElem.trim().length > 0) obj.objs.push(stringElem);
						
						return input.length;
					},
					flattenToString: function(obj) {
						if (obj.constructor === String) return obj;
						
						var ret = '';
						
						if (obj.delimA) ret += obj.delimA;
						
						var objs = obj.objs;
						for (var i = 0, len = objs.length; i < len; i++) {
							var obj = objs[i];
							if (obj.constructor === String) ret += obj;
							else 							ret += this.flattenToString(obj);
						}
						
						if (obj.delimB) ret += obj.delimB;
						
						return ret;
					},
					getString: function(token) {
						if (token.constructor !== String) throw new Error('~string required');
						return token;
					},
					getObject: function(token) {
						if (token.constructor !== Object) throw new Error('~object required');
						return token;
					},
					parse: function(symbolList, input) {
						/*input = input.replace(/\/\/[^\n]+\n/g, '');
						input = input.replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '');
						
						console.log('Compressed input');
						console.log(input);
						console.log('======');*/
						
						
						var tokenized = this.tokenize(input);
						var parseData = this.parseAny(symbolList, tokenized, true);
						return parseData.instance;
					},
					parseAny: function(symbolList, token, mustExhaust) {
						// Automatic unpacking - means that wrappers with null delimiters are meaningless
						while (token.constructor === Object && token.delimA === null && token.delimB === null && token.objs.length === 1) token = token.objs[0];
						
						if (!U.exists(mustExhaust)) mustExhaust = false;
						
						for (var i = 0, len = symbolList.length; i < len; i++) {
							try {
								
								var instance = new symbolList[i]();
								var numParsed = instance.parse(token, this);
								
								if (mustExhaust && numParsed !== (token.constructor === Object ? token.objs.length : 1)) throw new Error('~parser did not exhaust input');
								
								return { numParsed: numParsed, instance: instance };
								
							} catch(e) {
								if (e.message[0] !== '~') throw e;
								//console.log(symbolList[i].title, 'FAILED', this.flattenToString(token), ':', e.message);
							}
						}
						
						throw new Error('~no parser for tokens');
					}
				}; },
			}),
			Token: PACK.uth.makeClass({ name: 'Token',
				namespace: n,
				methods: function(sc, c) { return {
					init: function(params /* */) {},
					parse: function(tokens, parser) {
						/*
						Parses the list of tokens. Extends self (adds children, etc.)
						based off of tokens, and returns the number of tokens that it
						managed to parse.
						*/
						throw new Error ('not implemented');
					}
				}; }
			}),
			
			/* NON-RECURSIVE VALUES */
			Numeric: PACK.uth.makeClass({ name: 'Numeric',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* string */) {
						sc.init.call(this, params);
						this.string = U.param(params, 'string', null);
					},
					parse: function(token, parser) {
						var name = parser.getString(token);
						
						if (!/^[0-9]+$/.test(name)) throw new Error('~bad identifier format');
						
						this.string = name;
						return 1;
					}
				}; },
			}),
			Declaring: PACK.uth.makeClass({ name: 'Declaring',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* string */) {
						sc.init.call(this, params);
						this.identifier = U.param(params, 'identifier', null);
					},
					parse: function(token, parser) {
						var name = parser.getString(token);
						
						var ind = name.indexOf(' ');
						if (ind === -1) throw new Error('~declaring expects a space');
						
						if (name.substr(0, ind) !== 'var') throw new Error('~declaring missed "var" keyword');
						
						this.identifier = parser.parseAny([ PACK.parse.Identifier ], name.substr(ind + 1).trim(), true).instance;
						
						return 1;
					}
				}; }
			}),
			Identifier: PACK.uth.makeClass({ name: 'Identifier',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* string */) {
						sc.init.call(this, params);
						this.string = U.param(params, 'string', null);
					},
					parse: function(token, parser) {
						var name = parser.getString(token);
						
						if (!/^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(name)) throw new Error('~bad identifier format');
						
						this.string = name;
						return 1;
					}
				}; }
			}),
			QuotedString: PACK.uth.makeClass({ name: 'QuotedString',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* string */) {
						sc.init.call(this, params);
						this.string = U.param(params, 'string', null);
					},
					getQuotes: function() { throw new Error('not implemented'); },
					parse: function(token, parser) {
						var obj = parser.getObject(token);
						
						var quotes = this.getQuotes();
						if (obj.delimA !== quotes[0] || obj.delimB !== quotes[1])	throw new Error('~single-quote-string needs single quotes');
						
						var str = parser.flattenToString(obj);
						this.string = str.substr(quotes[0].length, str.length - (quotes[0].length + quotes[1].length)); // Strip off the quotes
						return obj.objs.length;
					}
				}; },
			}),
			SingleQuoteString: PACK.uth.makeClass({ name: 'SingleQuoteString',
				namespace: n,
				superclassName: 'QuotedString',
				methods: function(sc, c) { return {
					init: function(params /* string */) { sc.init.call(this, params); },
					getQuotes: function() { return [ "'", "'" ]; },
				}; },
			}),
			DoubleQuoteString: PACK.uth.makeClass({ name: 'DoubleQuoteString',
				namespace: n,
				superclassName: 'QuotedString',
				methods: function(sc, c) { return {
					init: function(params /* string */) { sc.init.call(this, params); },
					getQuotes: function() { return [ '"', '"' ]; },
				}; },
			}),
			
			/* RECURSIVE VALUES */
			InlineArray: PACK.uth.makeClass({ name: 'InlineArray',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.values = U.param(params, 'values', []);
					},
					parse: function(token, parser) {
						var obj = parser.getObject(token);
						
						if (obj.delimA !== '[' || obj.delimB !== ']') throw new Error('~inline-array needs to be enclosed in []');
						
						var objs = obj.objs;
						var goodObjs = [];
						
						for (var i = 0, len = objs.length; i < len; i++) {
							var o = objs[i];
							
							if (o.constructor === String) {
								goodObjs = goodObjs.concat(o.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; }));
							} else {
								goodObjs.push(o);
							}
						}
						
						var p = PACK.parse;
						this.values = [];
						for (var i = 0, len = goodObjs.length; i < len; i++) {
							this.values.push(parser.parseAny([ p.Value ], goodObjs[i], true).instance.value);
						}
						
						return obj.objs.length;
					}
				}; }
			}),
			InlineObject: PACK.uth.makeClass({ name: 'InlineObject',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.entries = [];
					},
					parse: function(token, parser) {
						var obj = parser.getObject(token);
						
						if (obj.delimA !== '{' || obj.delimB !== '}') throw new Error('~inline-object needs to be enclosed in {}');
						
						var objs = obj.objs;
						var goodObjs = [];
						
						for (var i = 0, len = objs.length; i < len; i++) {
							var o = objs[i];
							if (o.constructor === String) {
								// TODO: This will allow patterns with non-alternating (:|,) chars
								goodObjs = goodObjs.concat(o.split(/[:,]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; }));
							} else {
								goodObjs.push(o);
							}
						}
						
						var p = PACK.parse;
						this.entries = [];
						var key = null;
						for (var i = 0, len = goodObjs.length; i < len; i++) {
							if (key === null) key = parser.parseAny([ p.SimpleValue ], goodObjs[i], true).instance.value;
							else {
								this.entries.push([ key, parser.parseAny([ p.Value ], goodObjs[i], true).instance.value ]);
								key = null;
							}
						}
						
						if (key !== null) throw new Error('~inline-object couldn\'t match final key');
						
						return obj.objs.length;
					}
				}; }
			}),
			BracketedValue: PACK.uth.makeClass({ name: 'BracketedValue',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this);
						
						// TODO: Consider changing this to an array of values?
						this.value = U.param(params, 'value', null);
					},
					parse: function(token, parser) {
						var obj = parser.getObject(token);
						if (obj.delimA !== '(' || obj.delimB !== ')') throw new Error('~bracketed-value must be enclosed in ()');
						if (obj.objs.length !== 1) throw new Error('~bracketed-value should have exactly 1 inner value');
						
						var p = PACK.parse;
						this.value = parser.parseAny([ p.Value ], obj.objs[0], true).instance.value;
						
						return 1;
					}
				}; }
			}),
			Indexing: PACK.uth.makeClass({ name: 'Indexing',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value', null);
						this.index = U.param(params, 'index', null);
					},
					parse: function(token, parser) {
						var obj = parser.getObject(token);
						
						if (obj.objs.length < 2) throw new Error('~indexing consumes 2 tokens');
						
						var value = obj.objs[0];
						var index = obj.objs[1];
						
						if (index.constructor !== Object) throw new Error('~indexing index must be object');
						if (index.delimA !== '[' || index.delimB !== ']') throw new Error('~indexing must be enclosed by []');
						
						var p = PACK.parse;
						this.value = parser.parseAny([ p.Value ], value, true).instance.value;
						this.index = parser.parseAny([ p.Value ], index, true).instance.value;
						
						return 2;
					}
				}; }
			}),
			Indirecting: PACK.uth.makeClass({ name: 'Indirecting',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value', null);
						this.identifier = U.param(params, 'identifier', null);
					},
					parse: function(token, parser) {
						if (token.constructor === String) {
							
							var ind = token.lastIndexOf('.');
							if (ind === -1) throw new Error('~indirecting missed "." character');
							var v = token.substr(0, ind);
							var i = token.substr(ind + 1);
							var numParsed = 1;
							
						} else {
							
							var tobjs = token.objs;
							if (tobjs.length === 0) throw new Error('~not enough data for indirecting');
							
							// Get the last obj
							var lastObj = tobjs[tobjs.length - 1];
							if (lastObj.constructor !== String) throw new Error('~indirecting needs final string in array');
							
							// Consume the bit after the "."
							var ind = lastObj.lastIndexOf('.');
							if (ind === -1) throw new Error('~indirecting missed "." character');
							
							// Slice off the last obj, but include anything preceeding the "." (if there is anything)
							var objs = tobjs.slice(0, tobjs.length - 1);
							if (ind !== 0) objs.push(lastObj.substr(0, ind));
							
							// The identifier is the portion of lastObj after the "."
							var i = lastObj.substr(ind + 1);
							
							// The value is a token including all items but the last, AND all text before the final "." in lastObj
							var v = { delimA: null, delimB: null, objs: objs };
							
							var numParsed = token.objs.length;
							
						}
						
						var p = PACK.parse;
						
						this.value = parser.parseAny([ p.Value ], v, true).instance.value;
						this.identifier = parser.parseAny([ p.Identifier ], i, true).instance;
						
						return numParsed;
					}
				}; }
			}),
			BinaryOp: PACK.uth.makeClass({ name: 'BinaryOp',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this);
						
						this.rightSide = U.param(params, 'rightSide', null);
						this.leftSide = U.param(params, 'leftSide', null);
						this.op = U.param(params, 'op', null);
					},
					findOp: function(str) {
						var ops = c.ops;
						var ind = -1;
						var op = null;
						for (var i = 0, len = ops.length; i < len; i++) {
							if (~(ind = str.lastIndexOf(ops[i]))) {
								op = ops[i];
								break;
							}
						}
						
						return op !== null ? { ind: ind, op: op } : null;
					},
					parse: function(token, parser) {
						if (token.constructor === String) {
							
							var opData = this.findOp(token);
							if (opData === null) throw new Error('~binary-op missed op string');
							
							var v = token.substr(0, opData.ind).trim();
							var i = token.substr(opData.ind + opData.op.length).trim();
							var numParsed = 1;
							
						} else {
							
							var tobjs = token.objs;
							if (tobjs.length === 0) throw new Error('~not enough data for binary-op');
							
							// Get the last obj
							var lastObj = tobjs[tobjs.length - 1];
							
							if (lastObj.constructor === String) {
								
								lastObj = lastObj.trim();
								var opData = this.findOp(lastObj);
								if (opData === null) throw new Error('~binary-op missed op string');
								
								var objs = tobjs.slice(0, tobjs.length - 1);
								if (opData.ind !== 0) objs.push(lastObj.substr(0, opData.ind).trim());
								
								var i = lastObj.substr(opData.ind + opData.op.length).trim();
								
							} else {
								
								if (tobjs.length < 2) throw new Error('~not enough data for binary-op');
								
								var opStr = tobjs[tobjs.length - 2];
								if (opStr.constructor !== String) throw new Error('~binary-op missed op string');
								
								opStr = opStr.trim();
								
								var opData = this.findOp(opStr);
								if (opData === null) throw new Error('~binary-op missed op string');
								
								// TODO: The operator has to be the last part of the string
								if (opData.ind !== opStr.length - opData.op.length) throw new Error('~operator should come at end of string');
								
								var objs = tobjs.slice(0, tobjs.length - 2);
								if (opData.ind !== 0) objs.push(opStr.substr(0, opData.ind));
								
								var i = lastObj;
								
							}
							
							var v = { delimA: null, delimB: null, objs: objs };
							var numParsed = token.objs.length;
							
						}
						
						var p = PACK.parse;
						
						this.rightSide = parser.parseAny([ p.Value ], i, true).instance.value;
						this.op = opData.op;
						this.leftSide = parser.parseAny([ p.Value ], v, true).instance.value;
						
						return numParsed;
					}
				}; },
				statik: {
					ops: [ '+', '-', '*', '/', '%', '&', '&&', '|', '||', '<', '<<', '>', '>>', '=', '==', '===', '!==', '^', '~' ].sort(function(a, b) { return b.length - a.length; })
				}
			}),
			
			/* COLLECTIONS */
			Value: PACK.uth.makeClass({ name: 'Value',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value', null);
					},
					parse: function(token, parser) {
						var p = PACK.parse;
						var parsed = parser.parseAny([
							p.Numeric,
							p.Identifier,
							p.Declaring,
							p.SingleQuoteString,
							p.DoubleQuoteString,
							p.BracketedValue,
							p.Indexing,
							p.Indirecting,
							p.InlineArray,
							p.InlineObject,
							p.BinaryOp
						], token, true);
						
						this.value = parsed.instance;
						return parsed.numParsed;
					}
				}; }
			}),
			SimpleValue: PACK.uth.makeClass({ name: 'SimpleValue',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value', null);
					},
					parse: function(token, parser) {
						var p = PACK.parse;
						var parsed = parser.parseAny([
							p.Numeric,
							p.Identifier,
							p.SingleQuoteString,
							p.DoubleQuoteString,
						], token, true);
						
						this.value = parsed.instance;
						return parsed.numParsed;
					}
				}; }
			}),
			
			/* QUERY HANDLER */
			queryHandler: new PACK.quickDev.QDict({
				name: 'app',
				children: [	],
			}),
		};
		
		return ret;
	},
	runAfter: function() {
		if (U.isServer()) return;
		
		var p = PACK.parse;
		var parser = new p.Parser();
		
		console.log(parser.parse([
			p.Identifier
		], '_hiii'));
		
		console.log(parser.parse([
			p.SingleQuoteString, p.DoubleQuoteString
		], '"lalala { val\\"u\\"es ( complexity: [ lolol ] ) }"'));
		
		console.log(parser.parse([
			p.Indexing
		], 'value[index]'));
		
		console.log(parser.parse([
			p.Indirecting
		], 'value.value2[hi].lol.lol'));
		
		console.log(parser.parse([
			p.InlineArray
		], '[ 1, 2, 3, [ 4 ] ]'));
		
		console.log(parser.parse([
			p.InlineObject
		], '{ a: abc, c: [ 1, 2, 3, { h: \'j\' } ], d: "hi\\"hi\\"hi", b: abc }'));
		
		console.log(parser.parse([
			p.BracketedValue
		], '("dis a value")'));
		
		console.log(parser.parse([
			p.Value
		], 'var hahah'));
		
		console.log(parser.parse([
			p.BinaryOp
		], '(1 + 2) + (3 * 6) / (8 && 7)'));
	}
});
package.build();
