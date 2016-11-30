var package = new PACK.pack.Package({ name: 'ctrl',
	dependencies: [ 'quickDev' ],
	buildFunc: function() {
		var namespace = {};
		return {
			Node: PACK.uth.makeClass({ name: 'Node', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						this.name = U.param(params, 'name', '') + '#' + U.id(c.NEXT_ID++);
						this.children = {};
					},
					addChild: function(child) {
						this.children[child.name] = child;
					},
					flatten: function(params /* exclude */) {
						var exclude = U.param(params, 'exclude', {});
						
						if (this.name in exclude) return [];
						
						exclude[this.name] = true;
						
						var ret = [ this ];
						for (var k in this.children) ret = ret.concat(this.children[k].flatten(exclude));
						return ret;
					},
					receive: function(message) { throw new Error('not implemented'); },
					emit: function(child) { throw new Error('not implemented'); },
					fire: function() {
						for (var k in this.children) {
							var c = this.children[k];
							c.receive(this.emit(c));
						}
					}
				};},
				statik: { NEXT_ID: 0 }
			}),
			StackNode: PACK.uth.makeClass({ name: 'StackNode', namespace: namespace,
				superclassName: 'Node',
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						sc.init.call(this, params);
						this.received = [];
					},
					receive: function(message) { this.received.push(message); },
					emit: function(child) { throw new Error('not implemented'); },
					fire: function() {
						// Reset after firing
						sc.fire.call(this);
						this.received = [];
					}
				};}
			}),
			AnyNode: PACK.uth.makeClass({ name: 'AnyNode', namespace: namespace,
				superclassName: 'StackNode',
				methods: function(sc, c) { return {
					init: function(params /* name */) { sc.init.call(this, params); },
					emit: function(child) { return this.received.contains(1) ? 1 : 0; },
				};}
			}),
			AllNode: PACK.uth.makeClass({ name: 'AllNode', namespace: namespace,
				superclassName: 'StackNode',
				methods: function(sc, c) { return {
					init: function(params /* name */) { sc.init.call(this, params); },
					emit: function(child) { return this.received.contains(0) ? 0 : 1; }
				};}
			}),
			HardNode: PACK.uth.makeClass({ name: 'HardNode', namespace: namespace,
				superclassName: 'Node',
				methods: function(sc, c) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value');
					},
					emit: function(child) { return this.value; },
				};}
			}),
			MemoryNode: PACK.uth.makeClass({ name: 'MemoryNode', namespace: namespace,
				superclassName: 'Node',
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						sc.init.call(this, params);
						this.message = null;
					},
					receive: function(message) { this.message = message; }
				};}
			}),
			
			sigmoid: function(n) {
				return 1 / (1 + Math.pow(Math.E, -n));
			},
			
			NNNode: PACK.uth.makeClass({ name: 'NNNode', namespace: namespace,
				superclassName: 'Node',
				methods: function(sc, c) { return {
					init: function(params /* name, activation */) {
						sc.init.call(this, params);
						this.activation = U.param(params, 'activation', PACK.ctrl.sigmoid);
						this.sum = 0;
						this.bias = 0;
						this.mult = {};
					},
					addChild: function(child, mult) {
						if (!U.exists(mult)) mult = 1;
						
						sc.addChild.call(this, child);
						this.mult[child.name] = mult;
					},
					receive: function(message) { this.sum += message; },
					emit: function(child) {
						return this.activation(this.bias + (this.sum * (child ? this.mult[child.name] : 1)));
					},
					fire: function() {
						sc.fire.call(this);
						this.sum = 0;
					}
				};},
				statik: {
					quickAssemble: function(layerSizes) {
						var prevLayer = {};
						var layerArrs = [];
						
						for (var i = layerSizes.length - 1; i >= 0; i--) {
							var numNodes = layerSizes[i];
							var layer = {};
							
							for (var j = 0; j < numNodes; j++) {
								// Create new node
								var node = new PACK.ctrl.NNNode();
								
								// Set its children pointing forwards
								node.children = prevLayer;
								
								// Set its multipliers to 1 (TODO: consider random?) by default
								for (var k in node.children) node.mult[k] = 1;
								
								// Add it to the layer
								layer[node.name] = node;
							}
							
							// Update the layer
							prevLayer = layer;
							layerArrs.push(U.arr(layer));
						}
						
						layerArrs.reverse();
						
						return {
							layers: layerArrs,
							
							inputs: layerArrs[0],
							outputs: layerArrs[layerSizes.length - 1],
							
							values: layerArrs.map(function(layer, i) {
								var keys = [];
								for (var j = 0, len = layer.length; j < len; j++) {
									keys.push(i + '.' + j + '.bias');
									for (var k in layer[j].mult) {
										keys.push(i + '.' + j + '.mult.' + k);
									}
								}
								return keys;
							}).reduce(function(a, b) {
								return a.concat(b);
							}, [])
						};
					}
				}
			}),
			
			System: PACK.uth.makeClass({ name: 'System', namespace: namespace,
				methods: function() { return {
					init: function(params /* start */) {
						this.start = U.param(params, 'start');
					},
					iterate: function() {
						var next = {};
						for (var i = 0, len = this.start.length; i < len; i++) next[this.start[i].name] = this.start[i];
						
						var done = {};
						
						while(!U.isEmptyObj(next)) {
							var current = next;
							var next = {};
							
							for (var k in current) {
								// Fire the current node
								var node = current[k];
								node.fire();
								
								// Mark the current node as done
								done[k] = current[k];
								
								// Collect all its untraversed children for the next iteration
								for (var kk in node.children) {
									if (kk in done) { console.log('loop'); continue; }
									next[kk] = node.children[kk];
								}
								
							}
						}
					},
				};}
			}),
			
			Ctrl: PACK.uth.makeClass({ name: 'Ctrl', namespace: namespace,
				methods: function() { return {
					init: function(params /* access,  */) {
						this.system = U.param(params, 'system');
					}
				};}
			}),
			
			queryHandler: new PACK.quickDev.QDict({ name: 'app' })
		};
	},
	runAfter: function() {
		var c = PACK.ctrl;
		
		var nn = c.NNNode.quickAssemble([ 5, 5, 5 ]);
		console.log(nn);
		return;
		
		var inp1 = new c.HardNode({ value: 0 });
		var inp2 = new c.HardNode({ value: 0 });
		var inp3 = new c.HardNode({ value: 0 });
		var inp4 = new c.HardNode({ value: 0 });
		
		var and1 = new c.AllNode();
		var and2 = new c.AllNode();
		
		var or = new c.AnyNode();
		var mem = new c.MemoryNode();
		
		inp1.addChild(and1);
		inp2.addChild(and1);
		
		inp3.addChild(and2);
		inp4.addChild(and2);
		
		and1.addChild(or);
		and2.addChild(or);
		
		or.addChild(mem);
		
		var system = new c.System({
			start: 	[ inp1, inp2, inp3, inp4 ],
		});
		
		/*
		The process should have something to do with figuring out that
		the input nodes influence the "or" node, discovering that the
		input nodes also influence the "and" node, but then importantly
		figuring out that the and nodes are truly what effect the "or"
		node.
		
		An "assumption" happens when a "visible" node is simulated as an
		"access" node.
		*/
		
		var ctrl = new c.Ctrl({
			access: [
				{ obj: inp1, prop: 'value', poss: [ 0, 1 ] },
				{ obj: inp2, prop: 'value', poss: [ 0, 1 ] },
				{ obj: inp3, prop: 'value', poss: [ 0, 1 ] },
				{ obj: inp4, prop: 'value', poss: [ 0, 1 ] }
			],
			review: [
				{ obj: or, prop: 'message', poss: [ 0, 1 ] }
			]
		});
		
		console.log(system);
		
		var attempts = [
			function() {
				inp1.value = 1;
				inp2.value = 1;
				inp3.value = 0;
				inp4.value = 0;
			},
			function() {
				inp1.value = 1;
				inp2.value = 0;
				inp3.value = 0;
				inp4.value = 0;
			},
			function() {
				inp1.value = 1;
				inp2.value = 0;
				inp3.value = 1;
				inp4.value = 0;
			},
			function() {
				inp1.value = 0;
				inp2.value = 1;
				inp3.value = 0;
				inp4.value = 1;
			}
		];
		
		for (var i = 0, len = attempts.length; i < len; i++) {
			attempts[i]();
			system.iterate();
			console.log('Case #' + (i + 1) + ': ' + mem.message);
		}
	}
});
package.build();
