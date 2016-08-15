var package = new PACK.pack.Package({ name: 'match',
	dependencies: [ 'quickDev' ],
	buildFunc: function() {
		return {
			Concept: PACK.uth.makeClass({ name: 'Concept',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* knownLabels, strength */) {
						this.knownLabels = U.param(params, 'knownLabels', {});
						this.strength = U.param(params, 'strength', 0);
						
						if (this.knownLabels.constructor === Array) {
							var l = this.knownLabels;
							this.knownLabels = {};
							for (var i = 0, len = l.length; i < len; i++) this.knownLabels[l[i]] = true;
						}
					},
					matches: function(labels) {
						for (var i = 0; i < labels.length; i++) if (labels[i] in this.knownLabels) return true;
						return false;
					}
				}; }
			}),
			Knowledge: PACK.uth.makeClass({ name: 'Knowledge',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* improveRate, highestLen */) {
						this.patterns = [];
						
						this.concepts = [];
						
						this.improveRate = U.param(params, 'improveRate');
						this.highestLen = U.param(params, 'highestLen');
						
						/*
						this.rel.push(new PACK.match.Concept({
							knownLabels: [ 'ben', 'auden', 'claire' ],
							strength: 0.84
						});
						*/
					},
					getConcept: function(labels) {
						for (var i = 0, len = this.concepts.length; i < len; i++) {
							if (this.concepts[i].matches(labels)) return this.concepts[i];
						}
						return null;
					},
					process: function(patterns) {
						var m = patterns.length
						
						for (var i = 0; i < m; i++) {
							for (var j = i + 1; j < m; j++) {
								
								this.processPair(patterns[i], patterns[j]);
								
							}
						}
					},
					processPair: function(p1, p2) {
						if (p1.items.length > p2.items.length) {
							var t = p1;
							p1 = p2;
							p2 = t;
						}
						
						var concepts = [];
						var cmp = p1.compare(p2);
						
						var lenMul = Math.min(cmp.length, this.highestLen) / this.highestLen; // Higher rating for longer item string
						var r1 = this.improveRate * lenMul;
						var r2 = 1 - r1;
						for (var k = 0, len = cmp.length; k < len; k++) {
							var label1 = p1.items[k];
							var label2 = p2.items[cmp.index + k];
							
							var concept = null;
							
							if (label1 !== label2) {
								var concept = this.getConcept([ label1, label2 ]);
								
								if ((concept === null && cmp.strength > 0) || concept !== null) {
									if (concept === null) {
										concept = new PACK.match.Concept({ knownLabels: [ label1, label2 ], strength: 0 });
										this.concepts.push(concept);
									} else {
										concept.knownLabels[label1] = true;
										concept.knownLabels[label2] = true;
									}
									
									concept.strength = (cmp.strength * r1) + (concept.strength * r2);
								}
							} else {
								// Perfectly matching labels
							}
							
							concepts.push(concept);
						}
						
						return concepts;
					},
					sortedConcepts: function() {
						var ret = this.concepts.map(function(c) {
							var keys = [];
							for (var k in c.knownLabels) keys.push(k);
							keys.sort();
							
							return { keys: keys.join(' ][ '), str: c.strength };
						});
						ret.sort(function(o1, o2) {
							return o2.str - o1.str;
						});
						return ret.map(function(r) { return '(' + r.str.toFixed(2) + ') [ ' + r.keys + ' ]' });
					}
				}; }
			}),
			Pattern: PACK.uth.makeClass({ name: 'Pattern',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* knowledge, item */) {
						this.knowledge = U.param(params, 'knowledge');
						this.item = U.param(params, 'item');
						this.items = [];
						this.conceptualized = [];
						
						if (this.item.constructor === String) {
							var pcs = this.item.split(' ');
							for (var i = 0, len = pcs.length; i < len; i++) {
								var pc = pcs[i].toLowerCase();
								
								if (~([ '"', '\'' ].indexOf(pc[0]))) {
									this.items.push(pc[0]);
									pc = pc.substr(1);
								}
								
								if (~([ ',', ';', ':', '"' ].indexOf(pc[pc.length - 1]))) {
									this.items.push(pc.substr(0, pc.length - 1));
									this.items.push(pc.substr(pc.length - 1));
								} else {
									this.items.push(pc);
								}
							}
						} else {
							this.items = this.item;
						}
						
						this.knowledge.patterns.push(this);
					},
					s: function() { return this.items.length; },
					flatten: function() {
						var ret = [];
						this.items.forEach(function(item) {
							if (item.constructor === String) {
								ret.push(item);
							} else {
								ret = ret.concat(item.flatten());
							}
						});
						return ret;
					},
					compare: function(patt) {
						if (patt.items.length < this.items.length) 	throw 'should call "compare" on the shorter pattern';
						if (patt.knowledge !== this.knowledge) 		throw 'shouldn\'t compare patterns with different knowledge';
						
						var knowledge = this.knowledge;
						
						var maxStrength = -1;
						var maxIndex = -1;
						for (var start = 0, len = patt.items.length - this.items.length; start < len; start++) {
							var strength = 0;
							for (var ind = 0; ind < this.items.length; ind++) {
								var item1 = this.items[ind];
								var item2 = patt.items[start + ind];
								
								// TODO: Need to do concept-concept and concept-string rating here as well as string-string
								if (item1 === item2) {
									strength++;
								} else {
									var con = knowledge.getConcept([ item1, item2 ]);
									if (con) strength += con.strength;
								}
							}
							if (strength > maxStrength) {
								maxStrength = strength;
								maxIndex = start;
							}
						}
						
						return {
							index: maxIndex,
							length: this.items.length,
							strength: maxStrength / this.items.length
						}
					},
					compareInfo: function(patt) {
						var cmp = this.compare(patt);
						console.log('=======');
						console.log(this.items);
						console.log(patt.items.slice(cmp.index, this.items.length));
						console.log('STR:', cmp.strength);
					}
				}; }
			}),
			
			queryHandler: new PACK.quickDev.QDict({ name: 'app' })
		};
	},
	runAfter: function() {
		if (U.isServer()) return;
		
		U.request({
			url: 'apps/match/parse.txt',
			json: false,
			onComplete: function(text) {
				var knowledge = new PACK.match.Knowledge({
					improveRate: 0.6,
					highestLen: 10
				});
				
				text = text.replace(/\s+/g, ' ');
				items = text.split(/[?!.]/).map(function(item) { return new PACK.match.Pattern({
					knowledge: knowledge,
					item: item.trim()
				}); });
				
				knowledge.process(knowledge.patterns.slice(200, 400));
				
				console.log(knowledge.sortedConcepts());
			}
		});
		
	}
});
package.build();
