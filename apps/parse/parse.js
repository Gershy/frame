var package = new PACK.pack.Package({ name: 'parse',
	dependencies: [ 'e', 'permute' ],
	buildFunc: function() {
		var namespace = {};
		
		var DEPTH = 0;
		
		var obf = {
			strMatch: function(str1, ind1, str2, ind2, len) {
				if (!U.exists(ind2)) ind2 = 0;
				if (!U.exists(len)) len = str2.length;
				
				for (var i = 0; i < len; i++) if (str1[ind1 + i] !== str2[ind2 + i]) return false;
				return true;
			},
			Parser: U.makeClass({ name: 'Parser', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* delimiters */) {
						this.delimiters = U.param(params, 'delimiters');
						this.depth = 0;
					},
					parse: function(params /* text, tree, delims */) {
						var text = U.param(params, 'text');
						var tree = U.param(params, 'tree');
						var delims = U.param(params, 'delims', null);
						
						var textObj = new obf.TextObj({
							parser: this,
							text: text,
							delims: delims,
							indL: delims ? delims[0].length : 0
						});
						
						console.log(JSON.stringify(textObj.simplified(), null, 2));
						
						return tree.parse({ textObj: textObj });
					},
					matchesDelim: function(text, ind, num) {
						for (var i = 0; i < this.delimiters.length; i++) {
							if (obf.strMatch(text, ind, this.delimiters[i][num]))
								return this.delimiters[i];
						}
						return false;
					},
					matchesDelimL: function(text, ind) { return this.matchesDelim(text, ind, 0); },
					matchesDelimR: function(text, ind) { return this.matchesDelim(text, ind, 1); }
				};}
			}),
			TextObj: U.makeClass({ name: 'TextObj', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* parser, text, indL */) {
						// TODO: cut trim()ming should be an option
						this.parser = U.param(params, 'parser');
						this.text = U.param(params, 'text');
						this.indL = U.param(params, 'indL', 0); // Indicates position to start in text
						this.indR = this.indL;
						this.delims = U.param(params, 'delims', null);
						this.children = [];
						
						var lastCut = this.indL;
						while (this.indR < this.text.length) {
							if (this.delims && obf.strMatch(this.text, this.indR, this.delims[1])) break;
							
							var delims = this.parser.matchesDelimL(this.text, this.indR);
							if (delims) {
								
								// Apply a cut
								var cut = this.text.substr(lastCut, this.indR - lastCut).trim();
								if (cut) this.children.push(cut);
								
								var child = new obf.TextObj({
									parser: this.parser,
									text: this.text,
									indL: this.indR + delims[0].length,
									delims: delims
								});
								this.children.push(child);
								
								// Update `this.indR` and `lastCut`
								var end = child.indR + (child.delims[1].length);
								this.indR = end;
								lastCut = end;
								
							} else {
								this.indR++;
							}
						}
						
						// Apply the final cut
						var cut = this.text.substr(lastCut, this.indR - lastCut).trim();
						if (cut) this.children.push(cut);
					},
					simplified: function() {
						var simp = this.children.map(function(v) { return U.isObj(v, String) ? v : v.simplified(); });
						return this.delims ? [ '<' + this.delims[0] + '>' ].concat(simp).concat([ '<' + this.delims[1] + '>' ]) : simp;
					},
					toString: function() {
						var ret = '';
						this.children.forEach(function(child) { ret += child; });
						return this.delims ? this.delims[0] + ret + this.delims[1] : ret;
					}
				};}
			}),
			ParsedObj: U.makeClass({ name: 'ParsedObj', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* textObj, numItemsConsumed, parser, data, lastResult */) {
						this.textObj = U.param(params, 'textObj');
						this.numItemsConsumed = U.param(params, 'numItemsConsumed');
						this.numCharsConsumed = U.param(params, 'numCharsConsumed', 0);
						this.parser = U.param(params, 'parser');
						this.data = U.param(params, 'data', {});
						this.lastResult = U.param(params, 'lastResult', null);
					},
					sameAs: function(parsedObj) {
						return U.isObj(parsedObj, obf.ParsedObj)
							&& this.parser === parsedObj.parser
							&& this.textObj === parsedObj.textObj
							&& this.numItemsConsumed === parsedObj.numItemsConsumed
							&& this.numCharsConsumed === parsedObj.numCharsConsumed;
					},
					invalidates: function(parsedObj) {
						var ptr = this;
						while (ptr) {
							if (ptr.sameAs(parsedObj)) return true;
							ptr = ptr.lastResult;
						}
						return false;
					},
					eq: function(parsedObj) {
						return parsedObj.numItemsConsumed === this.numItemsConsumed && parsedObj.numCharsConsumed === this.numCharsConsumed;
					},
					gt: function(parsedObj) {
						if (this.numItemsConsumed > parsedObj.numItemsConsumed) return true;
						if (this.numItemsConsumed === parsedObj.numItemsConsumed && this.numCharsConsumed > parsedObj.numCharsConsumed) return true;
						return false;
					},
					chainLength: function() {
						var ret = 0;
						var ptr = this;
						while (ptr) { ret++; ptr = ptr.lastResult; }
						return ret;
					},
					toString: function() {
						return this.parser.toString(this.data);
					}
				};}
			}),
			
			AbstractParser: U.makeClass({ name: 'AbstractParser', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						this.name = U.param(params, 'name', null);
					},
					parse: function(params /* lastResult */) {
						if (DEPTH > 100) { console.log('BIG ERROR'); throw new Error('BIG ERROR'); }
						
						var err = null;
						var ret = null;
						
						console.log(' '.repeat(DEPTH) + '> "' + this.name + '"');
						DEPTH++;
						try {
							ret = this.parse0(params);
							if (this.mustBeUniqueOnReattempt) {
								var lastResult = U.param(params, 'lastResult', null);
								if (lastResult && lastResult.invalidates(ret)) throw new Error('No difference on reattempt');
							}
						} catch(err0) { err = err0; }
						DEPTH--;
						console.log(' '.repeat(DEPTH) + '< "' + this.name + '" ' + (err ? 'failure (' + err.message + ')' : 'success'));
						
						if (err) {
							[
								'Cannot read property'
							].forEach(function(val) {
								if (err.message.substr(0, val.length) === val) console.error(err.stack);
							});
						}
						
						if (err) throw err;
						
						return ret;
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						throw new Error('not implemented');
					},
					toString: function(data) {
						throw new Error('not implemented');
					},
					mustBeUniqueOnReattempt: false
				};}
			}),
			MultiParser: U.makeClass({ name: 'MultiParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, maxReattempts */) {
						sc.init.call(this, params);
						this.maxReattempts = U.param(params, 'maxReattempts', 30); // TODO: In production default value should be 0.
					},
					parse0: function(params /* textObj, childInd, strInd, lastResult */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						var lastResult = U.param(params, 'lastResult', null);
						
						// The initial previous results
						// `lastObjs` will potentially change after the 1st iteration
						//var lastObjs = lastResult ? lastResult.data.parsedObjSet : [];
						var lastObjs = [];
						var count = 0;
						
						if (!lastObjs) console.error(new Error().stack);
						
						/*
						TODO: A problem with this approach involves "alternating" invalid
						child parsers.
						
						On reattempts, each child is only getting the most recent `lastResult`,
						when they should really be getting the full history of all attempted
						lastResults. If the 1st child of a MultiParser has 2 children that both
						succeed on the input, but invalidate the MultiParser's 2nd child, the
						2nd child will always be invalidated because it's impossible for the
						1st child to know that there are MULTIPLE invalid values it should
						skip.
						*/
						
						do {
							
							var parsedObjSet = []; // The final result
							
							try {
								
								var loopData = {
									textObj: textObj,
									index: 0,
									nextChildInd: childInd,
									nextStrInd: strInd,
									numItemsConsumed: 0
								};
								
								while (this.loopCondition(loopData)) {
									
									var child = this.getLoopChild(loopData);
									
									var parsedObj = child.parse({
										textObj: textObj,
										childInd: loopData.nextChildInd,
										strInd: loopData.nextStrInd,
										lastResult: lastObjs[loopData.index] || null
									});
									
									// Forget all `lastObjs` after `index`, and store the most recently parsed value at `index`.
									parsedObj.lastResult = lastObjs[loopData.index] || null;
									lastObjs[loopData.index] = parsedObj;
									
									if (parsedObj.numItemsConsumed) {
										loopData.nextChildInd += parsedObj.numItemsConsumed;
										loopData.numItemsConsumed += parsedObj.numItemsConsumed;
										loopData.nextStrInd = parsedObj.numCharsConsumed;
									} else {
										loopData.nextStrInd += parsedObj.numCharsConsumed;
									}
									parsedObjSet.push(parsedObj);
									
									loopData.index++;
									
								}
								
								// The loop continued until `this.loopCondition` was false
								return new obf.ParsedObj({
									textObj: textObj,
									numItemsConsumed: loopData.nextChildInd - childInd,
									numCharsConsumed: loopData.nextStrInd,
									parser: this,
									data: {
										parsedObjSet: parsedObjSet
									}
								});
								
							} catch(err) { }
							
							count++;
							
						} while(this.reattemptMaySucceed(loopData) && (!this.maxReattempts || count < this.maxReattempts));
						
						throw new Error('Failed all reattempts');
						
					}
				};}
			}),
			AllParser: U.makeClass({ name: 'AllParser', namespace: namespace,
				superclassName: 'MultiParser',
				methods: function(sc, c) { return {
					init: function(params /* name, children */) {
						sc.init.call(this, params);
						this.children = U.param(params, 'children');
					},
					loopCondition: function(data /* index */) { return data.index < this.children.length; },
					getLoopChild: function(data /* index */) { return this.children[data.index]; },
					reattemptMaySucceed: function(data /* numItemsConsumed */) {
						/*
						AllParser may fail a parse because children ordered earlier in
						its `children` array may consume too much or too little input,
						thereby preventing later children from being able to parse.
						E.g. parsing 'aaa.aaa = "hi"' should be parseable with:
						
						"assignment"
							&& "reference"
								|| "identifier"
								|| "delimiterDot"
								|| "delimiterSqr"
							&& "equals"
							&& "value"
								|| "integer"
								|| "string"
						
						But on a 1st iteration, "identifier" will consume 'aaa' forcing
						"equals" to fail parsing '.aaa = "hi"'. At this point,
						`reattemptMaySucceed` should return `true` because it's possible
						that earlier children can be reattempted in order to allow later
						children to work. In this case reattempting "reference" will
						cause "delimiterDot" to consume 'aaa.aaa', allowing "equals" to
						successfully parse ' = "hi"', and allowing "value" to
						successfully parse '"hi"'.
						
						`AllParser.prototype.reattemptMaySucceed` returns `true` if at
						least 2 children were never reached for parsing - because the
						2nd last child could be reattempted in order to allow the final
						child to succeed.
						*/
						
						return data.numItemsConsumed <= (this.children.length - 2);
					},
					toString: function(data) {
						var ret = '';
						for (var i = 0; i < data.parsedObjSet.length; i++) ret += data.parsedObjSet[i];
						return ret;
					}
				};}
			}),
			RepeatParser: U.makeClass({ name: 'RepeatParser', namespace: namespace,
				superclassName: 'MultiParser',
				methods: function(sc, c) { return {
					init: function(params /* name, child */) {
						sc.init.call(this, params);
						this.child = U.param(params, 'child');
					},
					loopCondition: function(data /* nextChildInd, textObj */) { return data.nextChildInd < data.textObj.children.length; },
					getLoopChild: function(data /* */) { return this.child; },
					reattemptMaySucceed: function(data) { return false; },
					toString: function(data) {
						var ret = '';
						for (var i = 0; i < data.parsedObjSet.length; i++) ret += data.parsedObjSet[i];
						return ret;
					}
				};}
			}),
			AnyParser: U.makeClass({ name: 'AnyParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, children, mustExhaust */) {
						sc.init.call(this, params);
						this.children = U.param(params, 'children');
						this.mustExhaust = U.param(params, 'mustExhaust', false);
					},
					parse0: function(params /* textObj, childInd, strInd, lastResult */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						var lastResult = U.param(params, 'lastResult', null);
						
						// The starting iteration index changes on reattempts
						var startInd = lastResult ? lastResult.data.ind : 0;
						
						for (var i = startInd; i < this.children.length; i++) {
							
							var childParsedObj = lastResult ? lastResult.data.childParsedObj : null;
							
							try {
								
								do {
									
									if (this.mustExhaust && childParsedObj) console.log('"' + this.name + '" didn\'t exhaust (' + childParsedObj.toString().length + ' / ' + textObj.toString().length + ' chars)');
									childParsedObj = this.children[i].parse({
										textObj: textObj,
										childInd: childInd,
										strInd: strInd,
										lastResult: childParsedObj
									});
									
								} while(this.mustExhaust && (childParsedObj.numItemsConsumed + childInd < textObj.children.length));
								
								// Return a new ParsedObj containing the child's ParsedObj
								return new obf.ParsedObj({
									textObj: textObj,
									numItemsConsumed: childParsedObj.numItemsConsumed,
									numCharsConsumed: childParsedObj.numCharsConsumed,
									parser: this,
									data: {
										ind: i,
										childParsedObj: childParsedObj
									}
								});
								
							} catch(err) { } // Absorb errors - let the next child try instead
							
						}
						
						throw new Error('No child matched');
					},
					toString: function(data) {
						return data.childParsedObj.toString();
					}
				};}
			}),
			BlindParser: U.makeClass({ name: 'BlindParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						sc.init.call(this, params);
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						
						var lastResult = U.param(params, 'lastResult', null);
						// if (lastResult) throw new Error('Got `lastResult` but no reattempts allowed');
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: textObj.children.length - childInd,
							numCharsConsumed: 0,
							parser: this,
							data: {
								textObjChildren: textObj.children
							}
						});
					},
					toString: function(data) {
						var ret = '';
						for (var i = 0; i < data.textObjChildren.length; i++) ret += data.textObjChildren[i];
						return ret;
					}
				};}
			}),
			DelimitedParser: U.makeClass({ name: 'DelimitedParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, delimiters, child */) {
						sc.init.call(this, params);
						this.delimiters = U.param(params, 'delimiters');
						this.child = U.param(params, 'child', null);
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						
						var strInd = U.param(params, 'strInd', 0);
						if (strInd !== 0) throw new Error('`strInd` required to be 0');
						
						var lastResult = U.param(params, 'lastResult', null);
						
						var childTextObj = textObj.children[childInd];
						if (!childTextObj.delims) throw new Error('Didn\'t find delimiters');
						
						var foundDelims = false;
						for (var i = 0; i < this.delimiters.length; i++) {
							var d = this.delimiters[i];
							if (d[0] === childTextObj.delims[0] && d[1] === childTextObj.delims[1]) {
								foundDelims = true;
								break;
							}
						}
						
						if (!foundDelims) throw new Error('Couldn\'t match delimiters');
						
						var childParsedObj = this.child
							? this.child.parse({ textObj: childTextObj, childInd: 0, strInd: 0, lastResult: lastResult ? lastResult.childParsedObj : null })
							: null;
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: 1,
							numCharsConsumed: 0,
							parser: this,
							data: {
								textObj: textObj,
								childParsedObj: childParsedObj
							}
						});
					},
					toString: function(data) {
						return this.delimiters[0][0] + (
							data.childParsedObj
								? data.childParsedObj
								: data.textObj
						) + this.delimiters[0][1];
					}
				};}
			}),
			RegexParser: U.makeClass({ name: 'RegexParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, regex */) {
						sc.init.call(this, params);
						this.regex = '^' + U.param(params, 'regex');
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						
						var childTextObj = textObj.children[childInd];
						
						if (!U.isObj(childTextObj, String)) throw new Error('Received non-String input');
						
						// TODO: should the trim() be optional?
						var childTextUntrimmed = childTextObj.substr(strInd); // Get any remaining text after strInd
						var childText = childTextUntrimmed.trimLeft();
						
						var match = childText.match(this.regex);
						if (!match) throw new Error('Couldn\'t match input "' + childText + '"');
						
						match = match[0]; // The 0th index is the full matching text
						var isFullMatch = match.length === childText.length;
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: isFullMatch ? 1 : 0,
							numCharsConsumed: isFullMatch ? 0 : match.length + (childTextUntrimmed.length - childText.length),
							parser: this,
							data: {
								content: match
							}
						});
					},
					toString: function(data) {
						return data.content;
					},
					mustBeUniqueOnReattempt: true
				};}
			}),
			
			queryHandler: null
		};
		
		return obf;
	},
	runAfter: function() {
		if (U.isServer()) return;
		
		var Permute = PACK.permute.Permute;
		
		var per = new Permute({ limits: [ 3, 2, 2 ] })
		
		while (per.increment()) {
			console.log(per.value());
		}
		
		console.log('HAHAHA');
		
		while (per.increment()) {
			console.log(per.value());
		}
		
		return;
		
		console.log('Starting...');
		
		var obf = PACK.parse;
		
		var parser = new obf.Parser({
			delimiters: [
				[ '/*', '*/' ],
				[ '{', '}' ],
				[ '(', ')' ],
				[ '[', ']' ],
				[ '\'', '\'' ],
				[ '"', '"' ]
			]
		});
		
		var prsValue = new obf.AnyParser({ name: 'value', children: [] });
		var prsReference = new obf.AnyParser({ name: 'reference', children: [] });
		
		var prsString = new obf.DelimitedParser({ name: 'string',
			child: new obf.BlindParser({ name: 'stringContents' }),
			delimiters: [
				[ '\'', '\'' ],
				[ '"', '"' ]
			]
		});
		var prsInteger = new obf.RegexParser({ name: 'integer', regex: '[1-9][0-9]*' });
		var prsComma = new obf.RegexParser({ name: 'comma', regex: ',' });
		var prsColon = new obf.RegexParser({ name: 'colon', regex: ':' });
		var prsDot = new obf.RegexParser({ name: 'dot', regex: '\\.' });
		var prsEqual = new obf.RegexParser({ name: 'equals', regex: '=' });
		var prsArray = new obf.DelimitedParser({ name: 'array', delimiters: [ [ '[', ']' ] ],
			child: new obf.RepeatParser({ name: 'arrayEntrySet',
				child: new obf.AllParser({ name: 'arrayEntry', children: [
					prsValue,
					prsComma
				]})
			})
		});
		var prsObject = new obf.DelimitedParser({ name: 'object', delimiters: [ [ '{', '}' ] ],
			child: new obf.RepeatParser({ name: 'objectEntrySet',
				child: new obf.AllParser({ name: 'objectEntry', children: [
					prsValue, prsColon, prsValue, prsComma
				]})
			})
		});
		var prsBracketedValue = new obf.DelimitedParser({ name: 'bracketedValue', delimiters: [ [ '(', ')' ] ],
			child: prsValue
		});
		
		var prsIdentifier = new obf.RegexParser({ name: 'identifier', regex: '[a-zA-Z][a-zA-Z0-9]*' });
		var prsDereference1 = new obf.AllParser({ name: 'dereferenceDot', children: [ prsValue, prsDot, prsIdentifier ]});
		var prsDereference2 = new obf.AllParser({ name: 'dereferenceSqr', children: [
			prsValue,
			new obf.DelimitedParser({ name: 'dereferenceIndex', delimiters: [ [ '[', ']' ] ],
				child: prsValue
			})
		]});
		
		prsReference.children.push(
			prsIdentifier,
			//new obf.RegexParser({ name: 'identifierHa', regex: '[a-zA-Z][a-zA-Z0-9]*' }),
			//new obf.RegexParser({ name: 'identifierHaha', regex: '[a-zA-Z][a-zA-Z0-9]*' }),
			prsDereference1,
			prsDereference2
		);
		prsValue.children.push(prsInteger, prsString, prsArray, prsObject, prsIdentifier, prsDereference1, prsDereference2);
		
		var prsAssignment = new obf.AllParser({ name: 'assignment', children: [ prsReference, prsEqual, prsValue ] });
		
		var prsFinal = new obf.AnyParser({ name: 'root', mustExhaust: true, children: [
			//prsValue,
			//prsArray,
			//prsAssignment,
			prsReference
		]});
		
		var ret = parser.parse({
			//text: '{ 123: ["abc","def",], \'hi\': 123, }',
			//text: 'jkdhfkj = 2',
			//text: 'aaa.bbb = "hi"',
			text: 'aaa.bbb.ccc.ddd',
			//text: '[ "a", "b", "c", ]',
			tree: prsFinal
		});
		
		console.log('RESULT', ret);
		console.log('STR', ret.toString());
	}
});

package.build();
