var package = new PACK.pack.Package({ name: 'parse',
	dependencies: [ 'e' ],
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
					init: function(params /* textObj, numItemsConsumed, parser, data */) {
						this.textObj = U.param(params, 'textObj');
						this.numItemsConsumed = U.param(params, 'numItemsConsumed');
						this.numCharsConsumed = U.param(params, 'numCharsConsumed', 0);
						this.parser = U.param(params, 'parser');
						this.data = U.param(params, 'data', {});
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
					parse: function(params /* */) {
						var err = null;
						var ret = null;
						
						console.log(' '.repeat(DEPTH) + '> "' + this.name + '"');
						DEPTH++;
						try {
							ret = this.parse0(params);
						} catch(err0) {
							err = err0;
						}
						DEPTH--;
						console.log(' '.repeat(DEPTH) + '< "' + this.name + '" ' + (err ? 'failure' : 'success'));
						
						if (err) throw err;
						
						return ret;
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						throw new Error('not implemented');
					},
					toString: function(data) {
						throw new Error('not implemented');
					}
				};}
			}),
			AllParser: U.makeClass({ name: 'AllParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, children, mustComplete */) {
						sc.init.call(this, params);
						this.children = U.param(params, 'children');
						this.mustExhaust = U.param(params, 'mustExhaust', false);
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						var nextChildInd = childInd;
						var nextStrInd = strInd;
						var parsedObjSet = [];
						
						for (var i = 0; i < this.children.length; i++) {
							try {
								var child = this.children[i];
								var parsedObj = child.parse({ textObj: textObj, childInd: nextChildInd, strInd: nextStrInd });
								if (parsedObj.numItemsConsumed) {
									nextChildInd += parsedObj.numItemsConsumed;
									nextStrInd = parsedObj.numCharsConsumed;
								} else {
									nextStrInd += parsedObj.numCharsConsumed;
								}
								parsedObjSet.push(parsedObj);
							} catch(err) {
								throw new Error('AllParser failed at children[' + i + '] (' + this.children[i].constructor.title + ' "' + this.children[i].name + '"): ' + err.message);
							}
						}
						
						if (this.mustExhaust && nextChildInd !== textObj.children.length) throw new Error('AllParser didn\'t consume all input');
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: nextChildInd - childInd,
							numCharsConsumed: nextStrInd,
							parser: this,
							data: {
								parsedObjSet: parsedObjSet
							}
						});
						
					},
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
					init: function(params /* name, children */) {
						sc.init.call(this, params);
						this.children = U.param(params, 'children');
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						
						for (var i = 0; i < this.children.length; i++) {
							var child = this.children[i];
							try {
								return child.parse({ textObj: textObj, childInd: childInd, strInd: strInd });
							} catch(err) {}
						}
						
						throw new Error('None of AnyParser\'s children could match');
					},
					toString: function(data) {
						throw new Error('AnyParser.prototype.toString shouldn\'t be called');
					}
				};}
			}),
			RepeatParser: U.makeClass({ name: 'RepeatParser', namespace: namespace,
				superclassName: 'AbstractParser',
				methods: function(sc, c) { return {
					init: function(params /* name, child */) {
						sc.init.call(this, params);
						this.child = U.param(params, 'child');
					},
					parse0: function(params /* textObj, childInd, strInd */) {
						var textObj = U.param(params, 'textObj');
						var childInd = U.param(params, 'childInd', 0);
						var strInd = U.param(params, 'strInd', 0);
						
						var nextChildInd = childInd;
						var nextStrInd = strInd;
						
						var parsedObjSet = [];
						
						while (nextChildInd < textObj.children.length) {
							var parsedObj = this.child.parse({ textObj: textObj, childInd: nextChildInd, strInd: nextStrInd });
							if (parsedObj.numItemsConsumed) {
								nextChildInd += parsedObj.numItemsConsumed;
								nextStrInd = parsedObj.numCharsConsumed;
							} else {
								nextStrInd += parsedObj.numCharsConsumed;
							}
							parsedObjSet.push(parsedObj);
						}
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: nextChildInd - childInd,
							numCharsConsumed: nextStrInd,
							parser: this,
							data: {
								parsedObjSet: parsedObjSet
							}
						});
					},
					toString: function(data) {
						var ret = '';
						for (var i = 0; i < data.parsedObjSet.length; i++) ret += data.parsedObjSet[i];
						return ret;
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
						var strInd = U.param(params, 'strInd', 0);
						
						if (strInd !== 0) throw new Error('DelimitedParser requires strInd to be 0');
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: textObj.children.length,
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
						console.log('BLIND:', ret);
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
						
						if (strInd !== 0) throw new Error('DelimitedParser requires strInd to be 0');
						
						var childTextObj = textObj.children[childInd];
						if (!childTextObj.delims) throw new Error('DelimitedParser didn\'t find delimiters');
						
						var foundDelims = false;
						for (var i = 0; i < this.delimiters.length; i++) {
							var d = this.delimiters[i];
							if (d[0] === childTextObj.delims[0] && d[1] === childTextObj.delims[1]) {
								foundDelims = true;
								break;
							}
						}
						
						if (!foundDelims) throw new Error('DelimitedParser couldn\'t match delimiters');
						
						var childParsedObj = this.child
							? this.child.parse({ textObj: childTextObj, childInd: 0, strInd: 0 })
							: null;
						
						return new obf.ParsedObj({
							textObj: textObj,
							numItemsConsumed: 1,
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
						
						if (!U.isObj(childTextObj, String)) throw new Error('RegexParser received non-String input');
						
						var childTextUntrimmed = childTextObj.substr(strInd); // Get any remaining text after strInd
						var childText = childTextUntrimmed.trim();
						// TODO: should the trim() be optional?
						
						console.log('REG: "' + this.regex + '" TEXT: "' + childText + '"');
						var match = childText.match(this.regex);
						if (!match) throw new Error('RegexParser couldn\'t match input');
						
						match = match[0];
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
					}
				};}
			}),
			
			queryHandler: null
		};
		
		return obf;
	},
	runAfter: function() {
		if (U.isServer()) return;
		
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
		
		prsValue.children.push(prsInteger, prsString, prsArray, prsObject);
		
		var parseTree = new obf.AnyParser({ name: 'root', parser: parser, children: [
			prsValue
		]});
		
		var ret = parser.parse({
			text: '{ 123: ["abc","def",], \'hi\': 123, }',
			tree: parseTree
		});
		
		console.log('RESULT', ret);
		console.log('STR', ret.toString());
	}
	
});

package.build();
