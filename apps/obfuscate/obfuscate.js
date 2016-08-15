var package = new PACK.pack.Package({ name: 'obfuscate',
	dependencies: [ 'e', 'quickDev' ],
	buildFunc: function() {
		var ERRS = 0;
		
		var flattenArr = function(arr, ret) {
			if (!U.exists(ret)) ret = [];
			
			for (var i = 0, len = arr.length; i < len; i++) {
				var e = arr[i];
				
				if (e.constructor === Array) 	flattenArr(e, ret);
				else 							ret.push(e);
			}
			
			return ret;
		};
		
		var ret = {
			flattenArr: flattenArr,
			
			parseAny: function(classes, input, stack, mustExhaust) {
				classes = PACK.obfuscate.flattenArr(classes);
				
				for (var i = 0, len = classes.length; i < len; i++) {
					var c = classes[i];
					
					var instance = new c();
					
					try {
						var index = instance.fromRaw(input);
						
						if (U.exists(mustExhaust) && mustExhaust && index !== input.length) throw new Error('~failed to exhaust input; missed "' + input.substr(index) + '"');
						
						return {
							instance: instance,
							index: index
						};
					} catch(e) {
						if (e.message[0] !== '~') throw e;
					}
				}
				throw new Error('~No class could parse input');
			},
			parseAll: function(ordered, input, stack) {
				var ret = [];
				var startLen = input.length;
				
				input = input.trimLeft();
				
				for (var i = 0, len = ordered.length; i < len; i++) {
					var p = ordered[i];
					
					if (p.constructor === String) {
						
						// Ensure the regex always matches from the beginning
						if (input.substr(0, p.length) !== p) throw new Error('~parseAll failed string test: "' + p + '"');
						
						ret.push(p);
						input = input.substr(p.length);
						
					} else if (p.constructor === RegExp) {
						
						var match = input.match(p);
						if (match === null) throw new Error('~parseAll failed regex: "' + p + '"');
						
						ret.push(match[0]);
						input = input.substr(match[0].length);
						
					} else {
						
						// Accepts either a single class, or an array of classes for parseAny
						if (p.constructor !== Array) p = [ p ];
						
						try {
							
							var parse = PACK.obfuscate.parseAny(p, input, stack);
							ret.push(parse.instance);
							input = input.substr(parse.index);
							
						} catch (e) {
							
							if (e.message[0] !== '~') throw e;
							throw new Error('~Any inside all failed');
							
						}
						
					}
					
					input = input.trimLeft();
				}
				
				return {
					instances: ret,
					index: startLen - input.length
				};
			},
			
			ObfParseTree: PACK.uth.makeClass({ name: 'ParseTree',
				methods: function(sc, c) { return {
					init: function(params /* mustExhaust */) {
						this.stack = [];
						this.mustExhaust = U.param(params, 'mustExhaust', false);
					},
					parse: function(obf, input) {
						return this.doParse([ obf ], input);
					},
					doParse: function(stack, input) {
						console.log('HERES DA STACK', stack);
						
						var obfArr = stack[0];
						if (obfArr.constructor !== Array) obfArr = [ obfArr ];
						
						var obf = null;
						while(U.exists(obf = obfArr.pop())) {
							try {
								
								if (obf instanceof PACK.obfuscate.ObfElem) {
									
									var instance = new obf();
									var index = instance.fromRaw(input, this);
									
									obf = instance; // Give access to the instance instead of the class
									
								} else if (obf.constructor === String) {
										
									if (input.substr(0, obf.length) !== obf) throw new Error('~string "' + obf + '" didn\'t match');
									var index = obf.length;
									
								} else if (obf.constructor === RegExp) {
									
									if (obf.source[0] !== '^') throw new Error('regex "' + obf.source + ' doesn\'t match from start of input');
									
									var match = input.match(obf);
									if (match === null) throw new Error('~regex "' + obf.source + '" didn\'t match');
									var index = match[0].length;
									
									obf = match; // Better to give access to the match than to the regex (which is already known anyways)
									
								}
								
								// By this point relying on "index" to point to the first unexhausted character
								// in "input", and "obf" to point to the item of interest.
								
								// Check if this is the last item in the stack
								if (stack.length === 1) {
									// The mandatory exhaustion requirement is checked only on the last stack item
									if (this.mustExhaust && index !== input.length) throw new Error('~failed to exhaust input');
									return [ { index: index, instance: obf } ];
								}
								var deeperValue = this.doParse(stack.slice(1), input.substr(index));
								return [ { index: index, instance: obf } ].concat(deeperValue);
								
							} catch (e) {
								if (e.message[0] !== '~') throw e;
							}
						}
						throw new Error('~no obf in the obfArr could parse the input');
					}
				}; }
			}),
			
			ObfElem: PACK.uth.makeClass({ name: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
					},
					fromRaw: function(raw, parseTree) { throw new Error('not implemented'); }
				}; },
			}),
			ObfCompoundElem: PACK.uth.makeClass({ name: 'ObfCompoundElem',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					fromRaw: function(raw, parseTree) {
						var parsed = parseTree.doParse(this.getInnerParsers());
					}
				}; }
			}),
			
			ObfDeclareVar: PACK.uth.makeClass({ name: 'ObfDeclareVar',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.name = U.param(params, 'name', null);
					},
					fromRaw: function(raw) {
						var parse = PACK.obfuscate.parseAll([
							'var', PACK.obfuscate.ObfIdentifier
						], raw, this);
						
						this.name = parse.instances[1];
						return parse.index;
					}
				}; }
			}),
			
			ObfIdentifier: PACK.uth.makeClass({ name: 'ObfIdentifier',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.title = U.param(params, 'title', '');
					},
					fromRaw: function(raw) {
						var match = raw.match(/^[_$a-zA-Z][a-zA-Z_$0-9]*/);
						if (match === null) throw new Error('~Bad name format: "' + raw + '"');
						
						this.title = match[0];
						return this.title.length;
					}
				}; }
			}),
			ObfFunctionCall: PACK.uth.makeClass({ name: 'ObfFunctionCall',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this);
						
						this.variable = U.param(params, 'variable', null);
						this.arguments = U.param(params, 'arguments', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parse = p.parseAll([
							[ p.comp('resolvedValue', this), '(', p.ObfResolvedValueList, ')' ]
						], raw, this)
						
						this.variable = parse.instances[0];
						this.arguments = parse.instances[2];
						
						return parse.index;
					}
				}; }
			}),
			ObfIndirection: PACK.uth.makeClass({ name: 'ObfIndirection',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.variable = U.param(params, 'variable', null);
						this.identifier = U.param(params, 'identifier', null);
					},
					fromRaw: function(raw, parseTree) {
						var p = PACK.obfuscate;
						
						var parsed = parseTree.doParse([
							[ p.ObfIdentifier ], '.', [ p.ObfIdentifier ]
						], raw);
						
						console.log('PARSED:', parsed);
						
						throw new Error('LOL');
						
						//var parse = p.parseAll(, raw, this);
						
						//this.variable = parse.instances[0];
						//this.identifier = parse.instances[2];
						
						return parse.index;
					}
				}; }
			}),
			ObfIndexing: PACK.uth.makeClass({ name: 'ObfIndexing',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.variable = U.param(params, 'variable', null);
						this.value = U.param(params, 'value', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						
						var parse = p.parseAll([
							[ p.ObfIdentifier ], '[', p.comp('value', this), ']'
						], raw, this);
						
						this.variable = parse.instances[0];
						this.value = parse.instances[2];
						
						return parse.index;
					}
				}; }
			}),
			ObfBracketedValue: PACK.uth.makeClass({ name: 'ObfBracketedValue',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.resolvedValue = U.param(params, 'resolvedValue', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parsed = p.parseAll([
							'(', p.comp('resolvedValue', this), ')'
						], raw, this);
						
						this.resolvedValue = parsed.instances[1];
						
						return parsed.index;
					}
				}; }
			}),
			ObfReference: PACK.uth.makeClass({ name: 'ObfReference',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'reference', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parsed = p.parseAny([
							p.ObfIdentifier,
							p.ObfFunctionCall,
							p.ObfIndirection,
							p.ObfIndexing,
							p.ObfBracketedValue
						], raw, this);
						
						this.inlineValue = parsed.instance;
						
						return parsed.index;
					}
				}; }
			}),
			
			ObfResolvedValueList: PACK.uth.makeClass({ name: 'ObfResolvedValueList',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.items = U.param(params, 'items', []);
					},
					fromRaw: function(raw) {
						/*
						NOTE: ResolvedValueList never throws an error. An error
						parsing just indicates the end of a list. If the error
						occurs immediately, it indicates an empty list.
						*/
						
						var p = PACK.obfuscate;
						
						this.items = [];
						var initLen = raw.length;
						
						while (true) {
							try {
								
								var parse = p.parseAny(p.comp('resolvedValue', this), raw, this);
								this.items.push(parse.instance);
								
								raw = raw.substr(parse.index).trimLeft();
								
								// Each parsed item needs to be followed by a comma to allow another loop
								if (raw[0] !== ',') break;
								else 				raw = raw.substr(1).trimLeft();
								
							} catch(e) {
								// This means parseAny failed
								break;
							}
							
						}
						
						return initLen - raw.length;
					}
				}; }
			}),
			
			ObfInlineArray: PACK.uth.makeClass({ name: 'ObfInlineArray',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.resolvedValueList = U.param(params, 'resolvedValueList', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parsed = p.parseAll([
							'[', p.ObfResolvedValueList, ']'
						], raw, this);
						
						this.resolvedValueList = parsed.instances[1];
						
						return parsed.index;
					}
				}; }
			}),
			ObfInlineObject: PACK.uth.makeClass({ name: 'ObfInlineObject',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						/*
						Each item in this.pairs is an object with keys "key" and "value"
						*/
						sc.init.call(this, params);
						this.entries = U.param(params, 'entries', []);
					},
					fromRaw: function(raw) {
						/*
						InlineObject only throws errors corresponding to missing delimiters.
						Once inside the object parsing errors are tolerated because such an
						error signals the end of the list of entries. If the error is immediate,
						it signals that the object is empty.
						*/
						var p = PACK.obfuscate;
						
						this.entries = [];
						var initLen = raw.length;
						
						raw = raw.trimLeft();
						if (raw[0] !== '{') throw new Error('~InlineObject missed starting "{"');
						
						raw = raw.substr(1).trimLeft();
						
						while(true) {
							try {
								var parse = p.parseAll([
									[ p.comp('inlineValue', this), p.ObjIdentifier ], ':', p.comp('resolvedValue', this)
								], raw, this);
								
								this.items.push({ key: parse.instances[0], value: parse.instances[2] });
								
								raw = raw.substr(parse.index).trimLeft();
								
								if (raw[0] !== ',') break;
								else 				raw = raw.substr(1).trimLeft();
								
							} catch(e) {
								// This means that parseAll failed
								break;
							}
						}
						
						if (raw[0] !== '}') throw new Error('~InlineObject missed ending "}"');
						raw = raw.substr(1).trimLeft();
						
						return initLen - raw.length;
					}
				}; }
			}),
			ObfString: PACK.uth.makeClass({ name: 'ObfString',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.body = U.param(params, 'body', '');
					},
					delim1: function() { throw new Error('not implemented'); },
					delim2: function() { throw new Error('not implemented'); },
					escape: function() { return '\\'; },
					fromRaw: function(raw) {
						var d1 = this.delim1();
						var d2 = this.delim2();
						var esc = this.escape();
						
						if (raw.substr(0, d1.length) !== d1) throw new Error('~String missed starting delim: "' + d1 + '"');
						
						this.body = '';
						var ind = d1.length;
						
						while (true) {
							// Check for out-of-bounds
							if (ind >= raw.length) throw new Error('~Missed end delim: "' + d2 + '"');
							
							if (raw.substr(ind, esc.length) === esc) {
								// Deal with the escape character - append and skip the esc-char AND the next character
								this.body += raw.substr(ind, esc.length + 1);
								ind += (esc.length + 1);
							} else if (raw.substr(ind, d2.length) === d2) {
								break;
							} else {
								this.body += raw[ind];
								ind++;
							}
						}
						
						return ind + d2.length;
					}
				}; }
			}),
			ObfDoubleString: PACK.uth.makeClass({ name: 'ObfDoubleString',
				superclassName: 'ObfString',
				methods: function(sc, c) { return {
					init: function(params /* */) { sc.init.call(this, params); },
					delim1: function() { return '"'; },
					delim2: function() { return '"'; }
				}; }
			}),
			ObfSingleString: PACK.uth.makeClass({ name: 'ObfSingleString',
				superclassName: 'ObfString',
				methods: function(sc, c) { return {
					init: function(params /* */) { sc.init.call(this, params); },
					delim1: function() { return '\''; },
					delim2: function() { return '\''; }
				}; }
			}),
			ObfInlineRegex: PACK.uth.makeClass({ name: 'ObfInlineRegex',
				superclassName: 'ObfString',
				methods: function(sc, c) { return {
					init: function(params /* */) { sc.init.call(this, params); },
					delim1: function() { return '/'; },
					delim2: function() { return '/'; }
				}; }
			}),
			
			ObfInlineValue: PACK.uth.makeClass({ name: 'ObfInlineValue',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.inlineValue = U.param(params, 'inlineValue', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parsed = p.parseAny([
							p.ObfDoubleString,
							p.ObfSingleString,
							p.ObfInlineRegex,
							p.ObfInlineArray,
							p.ObfInlineObject
						], raw, this);
						
						this.inlineValue = parsed.instance;
						
						return parsed.index;
					}
				}; }
			}),
			
			ObfLineComment: PACK.uth.makeClass({ name: 'ObfLineComment',
				superclassName: 'ObfString',
				methods: function(sc, c) { return {
					init: function(params /* */) { sc.init.call(this, params); },
					delim1: function() { return '//'; },
					delim2: function() { return '\n'; }
				}; }
			}),
			ObfBlockComment: PACK.uth.makeClass({ name: 'ObfBlockComment',
				superclassName: 'ObfString',
				methods: function(sc, c) { return {
					init: function(params /* */) { sc.init.call(this, params); },
					delim1: function() { return '/*'; },
					delim2: function() { return '*/'; }
				}; }
			}),
			
			ObfNumber: PACK.uth.makeClass({ name: 'ObfNumber',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.number = U.param(params, 'number', 0);
					},
					fromRaw: function(raw) {
						var match = raw.match(/^([0-9]+)|([0-9]?\.[0-9]+)/);
						if (match === null) throw new Error('~bad number format');
						
						this.number = parseFloat(match[0]);
						
						return match[0].length;
					}
				}; }
			}),
			
			ObfAssignment: PACK.uth.makeClass({ name: 'ObfAssignment',
				superclassName: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.variable = U.param(params, 'variable', null);
						this.value = U.param(params, 'value', null);
					},
					fromRaw: function(raw) {
						var p = PACK.obfuscate;
						var parse = p.parseAll([
							p.comp('variable', this),
							'=',
							p.comp('value', this)
						], raw, this);
						
						this.variable = parse.instances[0];
						this.value = parse.instances[2];
						
						return parse.index;
					}
				}; }
			}),
			
			parse: function(text) {
				// Remove line-comments
				text = text.replace(/\/\/([^\n]*)\n/g, '');
				// Remove block-comments
				text = text.replace(/(\s+)?\/\*(.*?)\*\//g, '');
				
				// Remove unnecessary whitespace
				text = text.replace(/\s\s+/g, ' ');
				
				var obf = PACK.obfuscate;
				
				console.log(text);
				var root = new obf.ObfParsed({ elements: [], delimA: '', delimB: '' });
				
				var i = obf.parseElement({ element: root, text: text, textPos: 0, encapsData: {
					'[' : ']',
					'(' : ')',
					'{' : '}',
				}});
				
				console.log(i, text.length);
				
				return root;
			},
			
			parseElement: function(params /* element, text, textPos, encapsData */) {
				var element = U.param(params, 'element');
				var text = U.param(params, 'text');
				var textPos = U.param(params, 'textPos');
				var encapsData = U.param(params, 'encapsData');
				
				var endDelim = element.delimB;
				var stringElem = '';
				
				for (var i = textPos, len = text.length; i < len; i++) {
					var c = text[i];
					
					// Check for conditions that terminate the string currently being built
					if (c === endDelim || c in encapsData) {
						
						// Finish whatever was being worked on
						if (stringElem.trim().length > 0) {
							element.elements.push(stringElem);
							stringElem = '';
						}
						
						if (c === endDelim) {
							
							// Found the end of the current element being parsed
							return i;
							
						} else {
							
							// Found the beginning of a child element
							var child = new PACK.obfuscate.ObfParsed({
								elements: [], delimA: c, delimB: encapsData[c]
							});
							
							// Change the position in the text being parsed so that it
							// is the end of the child's portion of the text
							i = PACK.obfuscate.parseElement(params.update({
								// All the same params except the position is the first position beyond delimA
								// and the element is the child
								element: child,
								textPos: i + 1
							}));
							
							element.elements.push(child);
							
						}
						
					} else {
						
						stringElem = stringElem + c;
						
					}
					
				}
				
				return text.length;
				
			},
			
			queryHandler: new PACK.quickDev.QDict({
				name: 'app',
				children: [	],
			}),
		};
		
		// Add in all compounds
		(function() {
			/*
			Compounds:
			-inlineValue:	strings, inline regexes, numbers
			-variable:		any type of reference (name, name via indirection, name via indexing)
			*/
			
			var compounds = {};
			
			// Strings, inline regexes, numbers
			compounds.inlineValue = [ ret.ObfInlineArray, ret.ObfInlineObject, ret.ObfNumber, ret.ObfDoubleString, ret.ObfSingleString, ret.ObfInlineRegex ];
			
			// Any type of reference (x, x.y, var x, x[0], x['a'], x[y], x[y.z], etc)
			compounds.variable = [ ret.ObfIndirection, ret.ObfIndexing, ret.ObfDeclareVar, ret.ObfIdentifier ];
			
			// Any sort of value that can be assigned to a variable. This includes values referenced by variables
			compounds.value = ret.flattenArr([ compounds.variable, compounds.inlineValue ]);
			
			compounds.resolvedValue = ret.flattenArr([
				compounds.inlineValue,
				[ ret.ObfIdentifier, ret.ObfBracketedValue, ret.ObfIndirection, ret.ObfIndexing, ret.ObfFunctionCall ]
			]);
			
			ret.comp = function(name, instance) {
				if (!U.exists(instance)) throw new Error('called comp without instance');
				var c = instance.constructor;
				var ret = PACK.obfuscate.flattenArr(compounds[name]);
				
				return ret;
				
				var ind = ret.indexOf(c);
				if (~ind && ind !== ret.length - 1) {
					ret.splice(ind, 1);
					ret.push(c);
				}
				
				return ret;
			};
		})();
		
		return ret;
	},
	runAfter: function() {
		
		var n = 0;
		var test = function(classes, raw, name) {
			n++;
			if (!U.exists(name)) name = 'Test #' + n;
			
			raw = raw.trim();
			
			try {
				var parse = PACK.obfuscate.parseAny(classes, raw, null, true);
				
				console.log(name);
				console.log(parse);
			} catch (e) {
				console.log('TEST "' + name + '" FAILED (' + raw + ')');
				throw e;
			}
			console.log('');
		};
		
		if (!U.isServer()) {
			
			var e = PACK.e.e;
			
			var body = e('body');
			var head = e('head');
			
			head.append('<link rel="stylesheet" type="text/css" href="apps/obfuscate/style.css"/>');
			var wrapper = body.append('<div id="wrapper"></div>');
			
			var p = PACK.obfuscate;
			
			var tree = new p.ObfParseTree({ mustExhaust: true });
			
			console.log(tree.parse([ p.ObfIndirection ], 'x.y'));
			
			/*test([
				p.ObfDeclareVar
			], 'var myVar');
			
			test([
				p.ObfSingleString,
				p.ObfDoubleString
			], '"HELLO \\"SIR\\" HAHAHA SARCASM"');
			
			test([
				p.ObfIndirection
			], 'x.y.z');
			
			test([
				p.ObfAssignment
			], 'var myVar = \'hi\'');*/
			
			return;
			
			U.request({
				url: 'apps/obfuscate/obfuscate.js',
				json: false,
				onComplete: function(response) {
					console.log(PACK.obfuscate.parseAny([
						PACK.obfuscate.ObfStatementList
					], response));
					
					/*var element = PACK.obfuscate.parse(response);
					console.log('PARSED', element.classified());
					wrapper.append(element.htmlRep());*/
				}
			});
			
			
		}
		
	},
});

package.build();
