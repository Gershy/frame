var package = new PACK.pack.Package({ name: 'match',
	dependencies: [ 'random', 'quickDev' ],
	buildFunc: function() {
		return {
			Knowledge: PACK.uth.makeClass({ name: 'Knowledge',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* */) {
						this.items = {};
					},
					getInd: function(c1, c2) {
						return Math.min(c1.id, c2.id) + ':' + Math.max(c1.id, c2.id);
					},
					getData: function(c1, c2) {
						var ind = this.getInd(c1, c2);
						return ind in this.items ? this.items[ind] : null;
					},
					setData: function(c1, c2, data) {
						var ind = this.getInd(c1, c2);
						this.items[ind] = data.update({ c1: c1, c2: c2 });
					},
					getOrdered: function() {
						var items = U.arr(this.items);
						items.sort(function(c1, c2) {
							return c2.similarity - c1.similarity
						});
						return items;
					},
					truncateOrdered: function(num) {
						var ordered = this.getOrdered();
						if (num < ordered.length) ordered = ordered.slice(0, num);
						
						this.items = {};
						for (var i = 0, len = ordered.length; i < len; i++) this.setData(ordered[i].c1, ordered[i].c2, ordered[i]);
						
						return ordered;
					}
				};}
			}),
				
			Concept: PACK.uth.makeClass({ name: 'Concept',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* */) {
						this.id = U.id(c.NEXT_ID++, 4);
					},
					similarity: function(c) { throw new Error('not implemented'); }
				};},
				statik: {
					NEXT_ID: 0,
				}
			}),
			StringConcept: PACK.uth.makeClass({ name: 'StringConcept',
				superclassName: 'Concept',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* value */) {
						sc.init.call(this);
						this.value = U.param(params, 'value', '');
						this.freq = 0;
					},
					similarity: function(c, k) {
						if (!(c instanceof PACK.match.StringConcept)) return 0;
						
						if (this.value === c.value) return 1;
						
						var data = k.getData(this, c);
						return data === null ? 0 : data.similarity;
					}
				};}
			}),
			OrderedConcept: PACK.uth.makeClass({ name: 'OrderedConcept',
				superclassName: 'Concept',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* concepts, description */) {
						sc.init.call(this);
						this.concepts = U.param(params, 'concepts', []);
						this.description = U.param(params, 'description', null);
					},
					similarity: function(c, k) {
						if (!(c instanceof PACK.match.OrderedConcept)) return 0;
						
						var min = Math.min(this.concepts.length, c.concepts.length);
						var max = Math.max(this.concepts.length, c.concepts.length);
						
						// Should they be compared starting from the beginning?...
						var sum = 0;
						for (var i = 0; i < min; i++) {
							sum += this.concepts[i].similarity(c.concepts[i], k);
						}
						
						return sum / max;
					},
					correlate: function(c, k) {
						var s = this.similarity(c, k);
						
						var min = Math.min(this.concepts.length, c.concepts.length);
						for (var i = 0; i < min; i++) {
							var c1 = this.concepts[i];
							var c2 = c.concepts[i];
							
							if (c1 === c2) continue;
							
							var data = k.getData(c1, c2);
							if (data === null) {
								k.setData(c1, c2, { similarity: s });
							} else {
								var balance = s < data.similarity ? 0.15 : (Math.sqrt(1 / (c1.freq + c2.freq)) * 0.5);
								k.setData(c1, c2, { similarity: ((data.similarity * (1 - balance)) + (s * balance)) });
							}
						}
						
						return s;
					}
				};}
			}),
			/*
			Concept: PACK.uth.makeClass({ name: 'Concept',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* knownLabels, strength * /) {
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
					init: function(params /* improveRate, highestLen * /) {
						this.patterns = [];
						
						this.concepts = [];
						
						this.improveRate = U.param(params, 'improveRate');
						this.highestLen = U.param(params, 'highestLen');
						
						/*
						this.rel.push(new PACK.match.Concept({
							knownLabels: [ 'ben', 'auden', 'claire' ],
							strength: 0.84
						});
						* /
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
					init: function(params /* knowledge, item * /) {
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
			*/
			
			queryHandler: new PACK.quickDev.QDict({ name: 'app' })
		};
	},
	runAfter: function() {
		if (U.isServer()) return;
		
		U.request({
			url: 'apps/match/parse2.txt',
			json: false,
			onComplete: function(text) {
				var knowledge = new PACK.match.Knowledge({
					improveRate: 0.6,
					highestLen: 10
				});
				
				var knowledge = new PACK.match.Knowledge({});
				window.knowledge = knowledge;
				var concepts = [];
				var stringBank = {};
				
				text = text.replace(/\s+/g, ' ');
				items = text.split(/[?!.]/).map(function(sentence) {
					
					var wordConcepts = [];
					var words = sentence.toLowerCase().replace(/[^a-zA-Z, -]/g, '').replace(/,/g, ' ,').trim().split(' ');
					for (var i = 0, len = words.length; i < len; i++) {
						var w = words[i];
						var ind = '~' + w;
						if (!(ind in stringBank)) stringBank[ind] = new PACK.match.StringConcept({ value: w });
						
						stringBank[ind].freq++;
						wordConcepts.push(stringBank[ind]);
					}
					concepts.push(new PACK.match.OrderedConcept({
						concepts: wordConcepts,
						description: sentence
					}));
					
				});
				
				var rand = new PACK.random.Random({ seed: 9873984 });
				var numTests = 20000;
				setInterval(function() {
					var t = +(new Date());
					
					for (var i = 0; i < numTests; i++) {
						var r1 = rand.randInt({ lo: 0, hi: concepts.length });
						var r2 = rand.randInt({ lo: 0, hi: concepts.length });
						
						if (r1 === r2) continue;
						
						concepts[r1].correlate(concepts[r2], knowledge);
					}
					
					knowledge;
					
					var body = document.getElementsByTagName('body')[0];
					body.setAttribute('style', 'overflow-y: scroll;');
					
					var status = document.createElement('div');
					status.innerHTML = 'Finished ' + numTests + ' correlations in ' + (+(new Date()) - t) + 'ms';
					
					var show = document.createElement('div');
					show.setAttribute('class', 'show');
					show.innerHTML = knowledge.getOrdered().slice(0, 10).map(function(i) {
						return '<div style="display: inline-block; margin-left: 30px; width: 150px; font-size: 150%;">' + i.c1.value + '</div>' + 
							'<div style="display: inline-block; width: 150px; font-size: 150%;">' + i.c2.value + '</div>' +
							'<div style="margin-left: 30px;">' + i.similarity + '</div>';
					}).join('<br/>');
					
					requestAnimationFrame(function() {
						body.innerHTML = '';
						body.appendChild(status);
						body.appendChild(show);
					});
				}, 500);
			}
		});
		
	}
});
package.build();
