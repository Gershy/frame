var package = new PACK.pack.Package({ name: 'obfuscate',
	dependencies: [ 'e', 'quickDev' ],
	buildFunc: function() {
		return {
			ObfContainer: PACK.uth.makeClass({ name: 'ObfSimpleElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						// An array where each element is either a string or an ObfContainer
						this.elements = U.param(params, 'elements', []);
						this.delimA = U.param(params, 'delimA');
						this.delimB = U.param(params, 'delimB');
					},
					htmlRep: function() {
						var e = PACK.e.e;
						
						var root = e('<div class="obf-container"></div>');
						root.append('<div class="delim delimA">' + this.delimA + '</div>');
						root.append('<div class="delim delimB">' + this.delimB + '</div>');
						
						var childElems = root.append('<div class="children"></div>');
						console.log('CHILDELEMS', childElems);
						
						this.elements.forEach(function(elem) {
							if (elem.constructor === String) {
								childElems.append('<div class="string">' + elem + '</div>');
							} else {
								childElems.append(elem.htmlRep());
							}
						});
						
						return root;
					}
				}; },
			}),
			ObfElem: PACK.uth.makeClass({ name: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					}
				}; },
			}),
			ObfName: PACK.uth.makeClass({ name: 'ObfName',
				superclass: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					}
				}; },
			}),
			ObfStatement: PACK.uth.makeClass({ name: 'ObfStatement',
				superclass: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					}
				}; },
			}),
			ObfBlock: PACK.uth.makeClass({ name: 'ObfBlock',
				superclass: 'ObfElem',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					}
				}; },
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
				var root = new obf.ObfContainer({ elements: [], delimA: '', delimB: '' });
				
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
							var child = new PACK.obfuscate.ObfContainer({
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
	},
	runAfter: function() {
		
		if (!U.isServer()) {
			
			var e = PACK.e.e;
			
			var body = e('body');
			var head = e('head');
			
			head.append('<link rel="stylesheet" type="text/css" href="apps/obfuscate/style.css"/>');
			var wrapper = body.append('<div id="wrapper"></div>');
			
			U.request({
				url: 'apps/random/random.js',
				json: false,
				onComplete: function(response) {
					var element = PACK.obfuscate.parse(response);
					console.log('PARSED', element);
					
					console.log(element.htmlRep());
					
					wrapper.append(element.htmlRep());
				}
			});
			
			
		}
		
	},
});

package.build();
