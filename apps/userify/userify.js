var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'quickDev', 'p', 'geom' ],
	buildFunc: function() {
		var namespace = {};
		
		var ensurePromise = function(val) {
			return U.isInstance(val, PACK.p.P) ? val : new PACK.p.P({ val: val });
		};
		var $null = ensurePromise(null);
		var P = PACK.p.P;
		var E = PACK.e.E;
		
		var uf = {
			
			domSetText: function(elem, text) {
				if (elem.innerHTML !== text) elem.innerHTML = text;
			},
			domSetValue: function(elem, value) {
				if (elem.value !== value) elem.value = value;
			},
			domRestartAnimation: function(elem) {
				elem.style.animation = 'none';
				requestAnimationFrame(function() { elem.style.animation = ''; }, 10);
			},
			padam: function(params, name, def) {
				// Data-param; ensures the return value is an instance of PACK.userify.Data (defaulting to SimpleData)
				var ret = U.param(params, name, def);
				return U.isInstance(ret, uf.Data) ? ret : new uf.SimpleData({ value: ret });
			},
			
			Data: U.makeClass({ name: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						this.value = null;
					},
					getValue: function() {
						throw new Error('Not implemented');
					},
					setValue: function() {
						throw new Error('Not implemented');
					},
					fini: function() {
						throw new Error('Not implemented');
					}
				};}
			}),
			SimpleData: U.makeClass({ name: 'SimpleData',
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* value */) {
						sc.init.call(this, params);
						this.value = U.param(params, 'value');
					},
					getValue: function() {
						return this.value;
					},
					setValue: function(value) {
						this.value = value;
					},
					fini: function() {}
				};}
			}),
			UpdatingData: U.makeClass({ name: 'UpdatingData',
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* $getFunc, updateMillis, initialValue */) {
						sc.init.call(this, params);
						this.$getFunc = U.param(params, '$getFunc');
						this.$setFunc = U.param(params, '$setFunc', null);
						this.doingSet = false;
						this.updateMillis = U.param(params, 'updateMillis', 0);
						this.value = U.param(params, 'initialValue', null);
						
						this.refresh();
						this.interval = this.updateMillis
							? setInterval(function(){ this.refresh(); }.bind(this), this.updateMillis)
							: null;
					},
					fini: function() {
						if (this.interval !== null) clearInterval(this.interval);
					},
					getValue: function() {
						if (!this.$getFunc) throw new Error('No `$getFunc`');
						return this.value;
					},
					setValue: function(value) {
						if (!this.$setFunc) throw new Error('No `$setFunc`');
						this.value = value;
						this.doingSet = true;
						this.$setFunc(value).then(function() { this.doingSet = false; }.bind(this)).done();
					},
					refresh: function() {
						this.$getFunc().then(function(val) { if (!this.doingSet) this.value = val; }.bind(this)).done();
					}
				};}
			}),
			CalculatedData: U.makeClass({ name: 'CalculatedData',
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* getFunc */) {
						sc.init.call(this, params);
						this.getFunc = U.param(params, 'getFunc');
						this.setFunc = U.param(params, 'setFunc', null);
					},
					getValue: function() {
						return this.getFunc();
					},
					setValue: function(value) {
						if (!this.setFunc) throw new Error('No `setFunc`');
						this.setFunc(value);
					}
				};}
			}),
			
			NAME_REGEX: /^[a-z0-9]+[a-zA-Z0-9]*$/,
			View: U.makeClass({ name: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, framesPerTick, cssClasses, onClick */) {
						this.name = U.param(params, 'name');
						if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
						
						this.cssClasses = U.param(params, 'cssClasses', []);
						this.onClick = U.param(params, 'onClick', null);
						this.framesPerTick = U.param(params, 'framesPerTick', 1);
						this.delay = this.framesPerTick; // `delay` starting full ensures 1st tick not skipped
						
						this.par = null;
						this.domRoot = null;
						this.millisAlive = 0;
					},
					
					// Heirarchy
					getAncestry: function() {
						var ret = [];
						var ptr = this;
						while(ptr !== null) {
							ret.push(ptr);
							ptr = ptr.par;
						}
						return ret;
					},
					getNameChain: function() {
						return this.getAncestry().reverse().map(function(ptr) {
							return ptr.name.toString();
						});
					},
					getAddress: function() {
						return this.getNameChain().join('.');
					},
					getRoot: function() {
						var ptr = this;
						while (ptr.par) ptr = ptr.par;
						return ptr;
					},
					
					// DOM
					createDomRoot: function() {
						return document.createElement('div');
					},
					initDomRoot: function() {
						// Create the element
						this.domRoot = this.createDomRoot();
						
						// Reverse-reference the View from the html element (useful for debugging)
						this.domRoot.__view = this;
						
						// Set the id property
						this.domRoot.id = this.getNameChain().join('-');
						
						// Set desired css classes
						this.domRoot.classList.add('_' + this.name);
						for (var i = 0, len = this.cssClasses.length; i < len; i++)
							this.domRoot.classList.add(this.cssClasses[i]);
						
						// Set up any desired click handlers
						if (this.onClick)
							this.domRoot.onclick = this.onClick.bind(this);
						
						this.getContainer().appendChild(this.domRoot);
					},
					getContainer: function() {
						if (this.par === null) return document.body;
						return this.par.provideContainer(this);
					},
					$update: function(millis) {
						// Calling `$update` ensures that `domRoot` is initialized
						if (this.domRoot === null) this.initDomRoot();
						
						if (this.framesPerTick && (++this.delay >= this.framesPerTick)) {
							this.tick(millis);
							this.delay = 0;
						}
						this.millisAlive += millis;
						
						return PACK.p.$null;
					},
					tick: function(millis) {
						throw new Error('not implemented for ' + this.constructor.title);
					},
					
					fini: function() {
						if (this.domRoot && this.domRoot.parentNode) this.domRoot.parentNode.removeChild(this.domRoot);
						this.domRoot = null;
					}
				};}
			}),
			TextView: U.makeClass({ name: 'TextView',
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, data */) {
						sc.init.call(this, params);
						this.data = uf.padam(params, 'data');
					},
					
					createDomRoot: function() {
						var ret = document.createElement('span');
						ret.classList.add('_text');
						return ret;
					},
					tick: function(millis) {
						uf.domSetText(this.domRoot, this.data.getValue());
					},
					
					fini: function() {
						sc.fini.call(this);
						
						// TODO: THERE WILL BE A BUG WITH THIS!! While $update restarts `this`, nothing ever restarts `this.data` once it's been `fini()`'d
						this.data.fini();
					}
				};}
			}),
			InputView: U.makeClass({ name: 'InputView',
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, multiline, initialValue, textData, placeholderData */) {
						sc.init.call(this, params);
						this.multiline = U.param(params, 'multiline', false);
						this.textData = uf.padam(params, 'textData', '');
						this.placeholderData = uf.padam(params, 'placeholderData', '');
					},
					
					createDomRoot: function() {
						var ret = document.createElement('div');
						ret.classList.add('_input');
						ret.classList.add(this.multiline ? '_multiline' : '_inline');
						
						var input = document.createElement(this.multiline ? 'textarea' : 'input');
						input.classList.add('_widget');
						input.oninput = function(e) {
							this.textData.setValue(input.value);
						}.bind(this);
						ret.appendChild(input);
						
						var placeholder = document.createElement('div');
						placeholder.classList.add('_placeholder');
						ret.appendChild(placeholder);
						
						var anim = document.createElement('div');
						anim.classList.add('_anim');
						for (var i = 0; i < 4; i++) {
							var a = document.createElement('div');
							a.classList.add('_a');
							a.classList.add('_a' + (i + 1));
							anim.appendChild(a);
						}
						ret.appendChild(anim);
						
						return ret;
					},
					tick: function(millis) {
						var input = this.domRoot.childNodes[0];
						var inputText = this.textData.getValue();
						
						// Update text items
						uf.domSetText(this.domRoot.childNodes[1], this.placeholderData.getValue());
						uf.domSetValue(input, inputText);
						
						// Update the "_empty" class
						if (inputText)	this.domRoot.classList.remove('_empty');
						else 						this.domRoot.classList.add('_empty');
						
						// Update the "_focus" class
						if (document.activeElement === input && !this.domRoot.classList.contains('_focus')) {
							this.domRoot.classList.add('_focus');
							var animSet = this.domRoot.childNodes[2].childNodes;
							for (var i = 0, len = animSet.length; i < len; i++) uf.domRestartAnimation(animSet[i]);
						} else if (document.activeElement !== input) {
							this.domRoot.classList.remove('_focus');
						}
					}
				};}
			}),
			ActionView: U.makeClass({ name: 'ActionView',
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, $action, textData */) {
						sc.init.call(this, params);
						this.$action = U.param(params, '$action');
						this.waiting = false;
						this.textData = uf.padam(params, 'textData');
					},
					
					createDomRoot: function() {
						var button = document.createElement('div');
						button.classList.add('_button');
						button.classList.add('_widget');
						button.setAttribute('tabindex', 0);
						button.onkeypress = function(e) {
							if (e.keyCode === 13 || e.keyCode === 32) {
								button.onclick();
								e.preventDefault();
							}
						};
						button.onclick = function() {
							if (this.waiting) return;
							this.waiting = true;
							this.$action().then(function() {
								this.waiting = false;
							}.bind(this)).done();
						}.bind(this);
						
						return button;
					},
					tick: function(millis) {
						uf.domSetText(this.domRoot, this.textData.getValue());
						
						if (this.waiting)	this.domRoot.classList.add('_waiting');
						else 							this.domRoot.classList.remove('_waiting');
					}
				};}
			}),
			AbstractSetView: U.makeClass({ name: 'AbstractSetView',
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, children */) {
						sc.init.call(this, params);
						this.children = {};
						
						var children = U.param(params, 'children', []);
						for (var i = 0, len = children.length; i < len; i++)
							this.addChild(children[i]);
					},
					
					addChild: function(child) {
						if (child.par === this) return child;
						if (child.par !== null) throw new Error('Tried to add View with parent: ' + child.getAddress());
						if (child.name in this.children) throw new Error('Already have a child named "' + child.name + '"');
						
						child.par = this;
						this.children[child.name] = child;
						
						return child;
					},
					remChild: function(name) {
						if (!U.isObj(name, String)) name = name.name;
						
						if (!(name in this.children)) return null;
						
						var child = this.children[name];
						child.fini();								// Detach dom
						child.par = null;						// Detach data step 1
						delete this.children[name];	// Detach data step 2
						
						return child;
					},
					provideContainer: function() {
						throw new Error('not implemented');
					},
					
					fini: function() {
						for (var k in this.children) this.children[k].fini();
						sc.fini.call(this);
					}
				};}
			}),
			SetView: U.makeClass({ name: 'SetView',
				superclassName: 'AbstractSetView',
				methods: function(sc, c) { return {
					init: function(params /* name, children */) {
						sc.init.call(this, params);
					},
					
					provideContainer: function() {
						return this.domRoot;
					},
					$update: function(millis) {
						var children = this.children;
						
						return sc.$update.call(this, millis)
							.then(function() {
								return new PACK.p.P({
									all: children.map(function(child) { return child.$update(millis) })
								});
							});
					},
					tick: function(millis) {
					}
					
				};}
			}),
			ChoiceView: U.makeClass({ name: 'ChoiceView',
				superclassName: 'AbstractSetView',
				methods: function(sc, c) { return {
					init: function(params /* name, choiceData, children */) {
						sc.init.call(this, params);
						
						// Data returning the name of one of the children
						this.choiceData = uf.padam(params, 'choiceData');
						
						// Property to keep track of the currently active child
						this.currentChild = null;
					},
					
					provideContainer: function() {
						return this.domRoot;
					},
					$update: function(millis) {
						return sc.$update.call(this, millis)
							.then(function() {
								return this.currentChild ? this.currentChild.$update(millis) : PACK.p.$null;
							}.bind(this));
					},
					tick: function(millis) {
						var choice = this.choiceData.getValue();
						
						if (choice === null) {
							var nextChild = null;
						} else {
							if (!(choice in this.children)) throw new Error('Bad view choice: "' + choice + '"');
							var nextChild = this.children[choice];
						}
						
						if (nextChild !== this.currentChild) {
							if (this.currentChild) {
								this.domRoot.classList.remove('_choose-' + this.currentChild.name);
								this.currentChild.fini();
							}
							this.currentChild = nextChild;
							this.domRoot.classList.add('_choose-' + this.currentChild.name);
						}
					}
				};}
			}),
			DynamicSetView: U.makeClass({ name: 'DynamicSetView',
				superclassName: 'SetView',
				description: 'A SetView whose children are based on Data. ' +
					'Modifications to the Data instantly modify the children of ' +
					'the DynamicSetView. Adds a 2nd parameter to `addChild`; the ' +
					'raw data that the child was built from.',
				methods: function(sc, c) { return {
					init: function(params /* name, data, getDataId, genChildView, comparator */) {
						if ('children' in params) throw new Error('Initialized DynamicSetView with `children` param');
						
						sc.init.call(this, params);
						this.data = uf.padam(params, 'data');
						this.getDataId = U.param(params, 'getDataId'), 	// Returns a unique id for a piece of data (will be used for child.name)
						this.genChildView = U.param(params, 'genChildView'),		// function(name, rawData) { /* generates a View */ };
						this.comparator = U.param(params, 'comparator', null);
						
						this.count = 0;
					},
					
					tick: function(millis) {
						
						var rem = this.children.clone(); // Initially mark all children for removal
						var add = {};	// Initially mark no children for addition
						
						this.data.getValue().forEach(function(item, k) {
							
							// `itemId` is also always the name of the corresponding child
							var itemId = this.getDataId(item); 
							
							// Each item in `data` is unmarked for removal
							delete rem[itemId];	
							
							// Items which don't already exist as children are marked for addition
							if (!(itemId in this.children)) add[itemId] = item;
							
						}.bind(this));
						
						// Remove all children as necessary
						for (var k in rem) {
							if (!this.remChild(k)) throw new Error('Couldn\'t remove child: "' + k + '"');
						}
						
						// Add all children as necessary
						for (var k in add) {
							var child = this.genChildView(k, add[k], this);
							if (child.name !== k) throw new Error('Child named "' + child.name + '" needs to be named "' + k + '"');
							this.addChild(child, add[k]);
						}
						
					}
				};}
			}),
			TextHideView: U.makeClass({ name: 'TextHideView',
				superclassName: 'ChoiceView',
				description: 'A text field that is hidden when its text is empty',
				methods: function(sc, c) { return {
					init: function(params /* name, data */) {
						var data = uf.padam(params, 'data');
						sc.init.call(this, params.update({
							choiceData: new uf.CalculatedData({ getFunc: function() { return data.getValue() ? 'text' : null; } }),
							children: [	new uf.TextView({ name: 'text', data: data })	]
						}));
					}
				};}
			}),
			DynamicTextView: U.makeClass({ name: 'DynamicTextView',
				superclassName: 'ChoiceView',
				description: 'A text field which is conditionally editable',
				methods: function(sc, c) { return {
					init: function(params /* name, editableData, textData, inputViewParams */) {
						var editableData = uf.padam(params, 'editableData');
						var textData = uf.padam(params, 'textData');
						var inputViewParams = U.param(params, 'inputViewParams', {});
						sc.init.call(this, params.update({
							choiceData: new uf.CalculatedData({ getFunc: function() { return editableData.getValue() ? 'edit' : 'display'; } }),
							children: [
								new uf.InputView(inputViewParams.update({ name: 'edit', textData: textData })),
								new uf.TextView({ name: 'display', data: textData })
							]
						}));
					}
				};}
			}),
			GraphView: U.makeClass({ name: 'GraphView',
				superclassName: 'DynamicSetView',
				description: 'A DynamicSetView which keeps track of directed ' +
					'relationships between every pair of its children.',
				methods: function(sc, c) { return {
					init: function(params /* name, getDataId, genChildView, relations, classifyRelation, focusedNameData */) {
						this.childDataSet = []; // An arbitrarily-keyed list of data items. The key is provided by `getDataId`.
						this.childRawData = {}; // A properly-keyed list of raw data items. The child's name corresponds to the data's key.
						sc.init.call(this, params.update({ data: this.childDataSet }));
						
						// Given the raw data of two nodes, returns the name of the relationship between those nodes
						this.classifyRelation = U.param(params, 'classifyRelation');
						
						// Defines relations; the "schema"
						this.relations = U.param(params, 'relations');
						
						// Stores the name of the currently focused element
						this.focusedNameData = uf.padam(params, 'focusedNameData', null);
						
						// Stores relations; the "data"
						this.relationMap = {};
						
						// Reference to currently focused view
						this.focused = null;
					},
					
					createDomRoot: function() {
						var ret = document.createElement('div');
						ret.classList.add('_graph');
						
						var canvas = document.createElement('canvas');
						canvas.classList.add('_canvas');
						ret.append(canvas);
						
						var children = document.createElement('div');
						children.classList.add('_nodes');
						ret.append(children);
						
						return ret;
					},
					provideContainer: function() {
						return this.domRoot.childNodes[1];
					},
					addRawData: function(rawData) {
						if (!U.isObj(rawData, Array)) rawData = [ rawData ];
						
						for (var i = 0, len = rawData.length; i < len; i++) {
							var d = rawData[i];
							var id = this.getDataId(d);
							if (id in this.childRawData) return;
							
							this.childDataSet.push(rawData[i]);
						}
					},
					addChild: function(child, rawData) {
						var c = sc.addChild.call(this, child);
						
						if (!c) return; // Add failed!
						
						this.childRawData[c.name] = {
							id: c.name,
							raw: rawData,
							physics: {
								weight: 1,
								r: 150,
								loc: new PACK.geom.Point({ x: U.randInt(-200, 200), y: U.randInt(-200, 200) }),
								vel: new PACK.geom.Point(),
								acl: new PACK.geom.Point()
							}
						};
						
						for (var k in this.children) {
							var c2 = this.children[k];
							var r1 = this.relationKey(c, c2);
							var r2 = this.relationKey(c2, c);
							
							this.relationMap[r1] = 'RELATION ' + c.name + ' -> ' + c2.name;
							this.relationMap[r2] = 'RELATION ' + c2.name + ' -> ' + c.name;
						}
					},
					remChild: function(child) {
						var c = sc.remChild.call(this, child);
						
						if (!c) return; // Rem failed!
						
						// Ensure to unfocus the child if necessary
						if (c === this.focused) {
							this.focusedNameData.setValue(null);
							this.focused = null;
						}
						
						delete this.childRawData[c.name];
						
						for (var k in this.children) {
							var c2 = this.children[k];
							delete this.relationMap[this.relationKey(c, c2)];
							delete this.relationMap[this.relationKey(c2, c)];
						}
					},
					relationKey: function(child1, child2) {
						return child1 !== child2 ? child1.name + '-' + child2.name : child1.name;
					},
					updateChild: function(child) {
						var phys = this.childRawData[child.name].physics;
					},
					tick: function(millis) {
						var w = Math.round(this.domRoot.offsetWidth);
						var h = Math.round(this.domRoot.offsetHeight);
						var hw = w >> 1;
						var hh = h >> 1;
						var scale = 1 / 150;
						var secs = millis / 1000;
						
						/*
						var dampenGlobal = 0.85;
						var dampenGravity = 1 / 100;
						var focusSize = 150;
						var unfocusSize = 80;
						var separation = 20;
						var tooFar = 500;
						var repulseMult = 20;
						var repulseMinDivisor = 0.15;
						var focusSpeed = 2000;
						*/
						
						// These are quite good settings
						var dampenGlobal = 0.60;
						var dampenGravity = 1 / 200;
						var focusSize = 150;
						var unfocusSize = 80;
						var separation = 20;
						var tooFar = 500;
						var repulseMult = 10;
						var repulseMinDivisor = 0.08;
						var focusSpeed = 2000;
						
						// Ensure the canvas size maps directly to the dom space
						this.domRoot.childNodes[0].width = w;
						this.domRoot.childNodes[0].height = h;
						
						var cs = this.children.toArray();
						var ncs = cs.length;
						
						// Update physics for all nodes
						for (var i = 0; i < ncs; i++) {
							
							var c1 = cs[i];
							var phys1 = this.childRawData[c1.name].physics;
							phys1.vel = phys1.vel.scale(dampenGlobal);
							phys1.loc = phys1.loc.add(phys1.vel.scale(secs));
							phys1.r = c1 === this.focused ? focusSize : unfocusSize;
							
							// Always have impulse towards origin
							var d2 = phys1.loc.distSqr(PACK.geom.ORIGIN);
							phys1.vel = phys1.vel.add(new PACK.geom.Point({ ang: phys1.loc.angTo(PACK.geom.ORIGIN), mag: d2 * (dampenGravity * dampenGravity) }));
							
						}
						
						// Become affected by other nodes
						for (var i = 0; i < ncs; i++) {
							var c1 = cs[i];
							var phys1 = this.childRawData[c1.name].physics;
							var inertiaRatio = 1 / phys1.r;
							
							for (var j = 0; j < ncs; j++) {
								if (i === j) continue; // Don't interact with self
								
								var c2 = cs[j];
								var phys2 = this.childRawData[c2.name].physics;
								
								var dist = phys1.loc.dist(phys2.loc) - (phys1.r + phys2.r) - separation;
								if (dist > tooFar) continue;
								
								var mag = repulseMult / Math.max(repulseMinDivisor, dist);
								var repulse = new PACK.geom.Point({ ang: phys2.loc.angTo(phys1.loc), mag: mag }).scale(phys2.r * inertiaRatio);
								phys1.vel = phys1.vel.add(repulse);
							}
						}
						
						// Update styling based on physics
						for (var i = 0, len = cs.length; i < len; i++) {
							var c = cs[i];
							var phys = this.childRawData[c.name].physics;
							
							c.domRoot.style.left = (hw + (phys.loc.x - phys.r)) + 'px';
							c.domRoot.style.top = (hh + (phys.loc.y - phys.r)) + 'px';
							c.domRoot.style.transform = 'scale(' + phys.r * scale + ')';
						}
						
						var f = this.focused;
						if (f) {
							var physF = this.childRawData[f.name].physics;
							physF.vel = PACK.geom.ORIGIN;
							physF.loc = physF.loc.moveTowards(PACK.geom.ORIGIN, focusSpeed * secs);
						}
						
						/*
						Here's why sc.tick is called AFTER the physics update:
						If it isn't, it's possible some children will not have their
						`domRoot` initialized yet. `sc.tick` would call `addChild`
						for any un-added children, but those children would never
						have `$update` called on them before their `domRoot`
						property was accessed in `this.tick`.
						
						Instead, what happens is that the physics update is applied,
						and then `sc.tick` is called which will set up any new,
						un-added children for the next call to `this.tick`.
						*/
						sc.tick.call(this);
						
						// Update the focus
						var nextFocusedName = this.focusedNameData.getValue();
						if (!this.focused || nextFocusedName !== this.focused.name) {
							if (this.focused) this.focused.domRoot.classList.remove('_graphFocus');
							if (nextFocusedName) {
								if (!(nextFocusedName in this.children)) throw new Error('Bad child name for focus: "' + nextFocusedName + '"');
								this.focused = this.children[nextFocusedName];
								if (this.focused) this.focused.domRoot.classList.add('_graphFocus');
							}
						}
					}
				};}
			})
			
		};
		
		return uf;
	}
});
package.build();
