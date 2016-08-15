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
						
						if (stringElem.length > 0) obj.objs.push(stringElem);
						
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
						var tokenized = this.tokenize(input);
						var parseData = this.parseAny(symbolList, tokenized, true);
						return parseData.instance;
					},
					parseAny: function(symbolList, token, mustExhaust) {
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
						
						if (isNaN(parseFloat((name)))) throw new Error('~bad identifier format');
						
						this.string = name;
						return 1;
					}
				}; },
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
						
						console.log(goodObjs);
						
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
							p.SingleQuoteString,
							p.DoubleQuoteString,
							p.Indexing,
							p.Indirecting,
							p.InlineArray,
							p.InlineObject,
							p.BracketedValue
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
			/*BracketedValue: PACK.uth.makeClass({ name: 'BracketedValue',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* * /) {
						sc.init.call(this);
						this.value = U.param(params, 'value', null);
					},
					parse: function(token, parser) {
						// DANG how to allow double-bracketed values? sending obj is no good (has no brackets, won't be parsed), sending obj.objs[0] is no good (may only be a portion of the inner value)
						var obj = parser.getObject(token);
						if (obj.delimA !== '(' || obj.delimB !== ')') throw new Error('~bracketed-value must be enclosed in ()');
						
						var p = PACK.parse;
						this.value = parser.parseAny([ p.Value ], { delimA: null, delimB: null, objs: obj.objs[0] }, true);
					}
				}; }
			}),*/
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
			
			/* STATEMENTS */
			BinaryOp: PACK.uth.makeClass({ name: 'BinaryOp',
				namespace: n,
				superclassName: 'Token',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this);
						
						this.leftSide = U.param(params, 'leftSide', null);
						this.op = U.param(params, 'op', null);
						this.rightSide = U.param(params, 'rightSide', null);
					},
					parse: function(token, parser) {
						// TODO: HERE
						if (token.constructor === String) {
							
							
							
						} else {
							
						}
					}
				}; },
				statik: {
					ops: [ '+', '-', '*', '/', '%', '&', '&&', '|', '||', '<', '<<', '>', '>>', '=', '==', '===', '!==', '^', '~' ].sort(function(a, b) { return b.length - a.length; })
				}
			}),
			
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
		], '"lalala { values ( complexity: [ lolol ] ) }"'));
		
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
	}
});
package.build();
