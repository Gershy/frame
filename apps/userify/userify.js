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
		var geom = PACK.geom;
		
		var uf = {
			
			domSetText: function(elem, text) {
				// TODO: Escaping can occur here
				if (elem.innerHTML !== text) elem.innerHTML = text;
			},
			domSetValue: function(elem, value) {
				if (elem.value !== value) elem.value = value;
			},
			domRestartAnimation: function(elem) {
				elem.style.animation = 'none';
				requestAnimationFrame(function() { elem.style.animation = ''; }, 10);
			},
			domAddListener: function(elem, type, func) {
				// Key the set at an index that isn't already in use
				var setName = '~' + type + 'Set';
				
				// If no set already exists for this type of listener, create it
				if (!(setName in elem)) {
					
					// Create the set...
					elem[setName] = [];							
					
					// Set up a function at "type" to call every function at "setName"
					elem[type] = function(listenerSet, event) {
						listenerSet.forEach(function(listener) { listener(event); });
					}.bind(null, elem[setName]);
					
				}
				
				// Add the listener
				elem[setName].push(func);
			},
			domRemListener: function(elem, type, func) {
				// Key the set at an index that isn't already in use
				var setName = '~' + type + 'Set';
				
				if (!(setName in elem)) return;
				
				var listenerSet = elem[setName];
				
				if (listenerSet.remove(func) && U.isEmpty(listenerSet)) {
					// Clean up set and listener-calling-function
					delete elem[type];
					delete elem[setName];
				}
			},
			padam: function(params, name, def) {
				// Data-param; ensures the return value is an instance of PACK.userify.Data (defaulting to SimpleData)
				var ret = U.param(params, name, def);
				if (U.isInstance(ret, uf.Data)) return ret;
				return U.isObj(ret, Function)
					? new uf.CalculatedData({ getFunc: ret })
					: new uf.SimpleData({ value: ret });
			},
			
			/* DECORATOR */
			Decorator: U.makeClass({ name: 'Decorator',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						this.id = U.id(c.NEXT_ID++);
					},
					start: function(view) { },
					update: function(view) { },
					stop: function(view) { }
				};},
				statik: function() {
					NEXT_ID: 0
				}
			}),
			ClickDecorator: U.makeClass({ name: 'ClickDecorator',
				superclassName: 'Decorator',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.data = new uf.SimpleData({ value: false });
						
						this.clickFuncDn = c.clickFuncDn.bind(this);
						this.clickFuncUp = c.clickFuncUp.bind(this);
					},
					start: function(view) {
						uf.domAddListener(view.domRoot, 'onmousedown', this.clickFuncDn);
					},
					stop: function(view) {
						uf.domRemListener(view.domRoot, 'onmousedown', this.clickFuncDn);
						uf.domRemListener(document.body, 'onmouseup', this.clickFuncUp);	// If stopped during mousedown, this is necessary
					}
				};},
				statik: {
					clickFuncDn: function(event) { // Mouse down - add up listener, modify `this.data`
						uf.domAddListener(document.body, 'onmouseup', this.clickFuncUp);
						this.data.setValue(true);
					},
					clickFuncUp: function(event) { // Mouse up - modify `this.data`, remove up listener
						this.data.setValue(false);
						uf.domRemListener(document.body, 'onmouseup', this.clickFuncUp);
					}
				}
			}),
			DragDecorator: U.makeClass({ name: 'DragDecorator',
				superclassName: 'Decorator',
				methods: function(sc, c) { return {
					init: function(params /* tolerance */) {
						sc.init.call(this, params);
						this.data = new uf.SimpleData({ value: { drag: false, mouseDown: false, view: null } });
						this.tolerance = U.param(params, 'tolerance', 0);
						
						this.clickFuncDn = c.clickFuncDn.bind(this);
						this.clickFuncUp = c.clickFuncUp.bind(this);
						this.mouseMove = c.mouseMove.bind(this);
					},
					start: function(view) {
						// Store properties on the view
						view['~' + this.id + '.' + 'clickFuncDn'] = c.clickFuncDn.bind(this, view);
						view['~' + this.id + '.' + 'clickFuncUp'] = c.clickFuncUp.bind(this, view);
						view['~' + this.id + '.' + 'mouseMove'] = c.mouseMove.bind(this, view);
						
						uf.domAddListener(view.domRoot, 'onmousedown', view['~' + this.id + '.' + 'clickFuncDn']);
					},
					stop: function(view) {
						uf.domRemListener(view.domRoot, 'onmousedown', view['~' + this.id + '.' + 'clickFuncDn']);
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.' + 'clickFuncUp']);		// If stopped during mousedown, this is necessary
						uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.' + 'mouseMove']);	// If stopped during mousedown, this is necessary
						
						// Delete properties from the view
						delete view['~' + this.id + '.' + 'clickFuncDn'];
						delete view['~' + this.id + '.' + 'clickFuncUp'];
						delete view['~' + this.id + '.' + 'mouseMove'];
					}
				};},
				statik: {
					clickFuncDn: function(view, event) { // Mouse down - add up listener, modify `this.data`
						// Add listeners
						uf.domAddListener(document.body, 'onmouseup', view['~' + this.id + '.' + 'clickFuncUp']);
						uf.domAddListener(document.body, 'onmousemove', view['~' + this.id + '.' + 'mouseMove']);
						
						var rect = view.domRoot.getBoundingClientRect();
						
						// Update data
						this.data.setValue({
							drag: false,
							mouseDown: true,
							view: view,
							domPt1: new geom.Point({ x: rect.left, y: rect.top }),
							pt1: new geom.Point({ x: event.clientX, y: event.clientY }),
							pt2: new geom.Point({ x: event.clientX, y: event.clientY })
						});
					},
					clickFuncUp: function(view, event) { // Mouse up - modify `this.data`, remove up listener
						// Remove listeners
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.' + 'clickFuncUp']);
						uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.' + 'mouseMove']);
						
						// Reset data
						this.data.setValue({
							drag: false,
							mouseDown: false,
							view: null
						});
					},
					mouseMove: function(view, event) {	 // Mouse move
						// Update values in `this.data`
						var pt2 = new geom.Point({ x: event.clientX, y: event.clientY });
						var data = this.data.getValue(); // We know `this.data` is a SimpleData, so just updating its value works here
						data.pt2 = pt2;
						if (!data.drag && pt2.dist(data.pt1) > this.tolerance) data.drag = true;
						if (data.drag) {
							data.dragged = data.pt2.sub(data.pt1);
							console.log('DRAG: (' + data.dragged.x + ', ' + data.dragged.y + ')');
						}
					}
				}
			}),
			ClassDecorator: U.makeClass({ name: 'ClassDecorator',
				superclassName: 'Decorator',
				description: 'Dynamically changes html classes on an element',
				methods: function(sc, c) { return {
					init: function(params /* data, possibleClasses */) {
						sc.init.call(this, params);
						this.possibleClasses = U.param(params, 'possibleClasses');
						this.data = uf.padam(params, 'data');
					},
					start: function(view) {
					},
					update: function(view) {
						var nextClass = this.data.getValue();
						var classList = view.domRoot.classList;
						if (!classList.contains(nextClass)) {
							classList.remove.apply(classList, this.possibleClasses);
							classList.add(nextClass);
						}
					},
					end: function(view) {
						var classList = view.domRoot.classList;
						classList.remove.apply(classList, this.possibleClasses);
					}
				};}
			}),
			CssDecorator: U.makeClass({ name: 'CssDecorator',
				superclassName: 'Decorator',
				description: 'Dynamically changes css properties on an element',
				methods: function(sc, c) { return {
					init: function(params /* data, properties */) {
						sc.init.call(this, params);
					},
					start: function(view) {
					},
					update: function(view) {
					},
					stop: function() {
					}
				};}
			}),
			
			/* DATA */
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
					
					start: function() {},
					stop: function() {}
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
					}
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
						this.interval = null;
						
						this.start();
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
					},
					
					start: function() {
						// TODO: Shouldn't be setInterval - should be setTimeout, timeout taking promise latency into account
						this.refresh();
						this.interval = this.updateMillis
							? setInterval(function(){ this.refresh(); }.bind(this), this.updateMillis)
							: null;
					},
					stop: function() {
						if (this.interval !== null) clearInterval(this.interval);
					},
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
			
			/* VIEW */
			NAME_REGEX: /^[a-z0-9]+[a-zA-Z0-9]*$/,
			View: U.makeClass({ name: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, framesPerTick, cssClasses, onClick, decorators */) {
						this.name = U.param(params, 'name');
						if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
						
						this.cssClasses = U.param(params, 'cssClasses', []);
						this.onClick = U.param(params, 'onClick', null);
						this.decorators = U.param(params, 'decorators', []);
						this.framesPerTick = U.param(params, 'framesPerTick', 1);
						this.frameCount = this.framesPerTick; // `frameCount` starting full ensures 1st tick not skipped
						
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
					getChild: function(address) {
						if (address.length === 0) return this; // Works for both strings and arrays
						
						if (!U.isObj(address, Array)) address = address.toString().split('.');
						
						var ptr = this;
						for (var i = 0, len = address.length; (i < len) && ptr; i++) ptr = ptr.children[address[i]];
						return ptr;
					},
					
					// DOM
					createDomRoot: function() {
						return document.createElement('div');
					},
					update: function(millis) {
						// Calling `update` ensures that `domRoot` is initialized
						if (this.domRoot === null) {
							this.domRoot = this.createDomRoot();
							this.start();
						}
						
						if (this.framesPerTick && (++this.frameCount >= this.framesPerTick)) {
							for (var i = 0, len = this.decorators.length; i < len; i++)
								this.decorators[i].update(this);
							
							this.tick(millis);
							this.frameCount = 0;
						}
						this.millisAlive += millis;
						
						return PACK.p.$null;
					},
					tick: function(millis) {
						throw new Error('not implemented for ' + this.constructor.title);
					},
					
					start: function() {
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
						
						(this.par ? this.par.provideContainer(this) : document.body).appendChild(this.domRoot);
						
						for (var i = 0, len = this.decorators.length; i < len; i++)
							this.decorators[i].start(this);
					},
					stop: function() {
						for (var i = 0, len = this.decorators.length; i < len; i++)
							this.decorators[i].stop(this);
						
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
					
					start: function() {
						sc.start.call(this);
						this.data.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.data.stop();
					}
				};}
			}),
			InteractiveView: U.makeClass({ name: 'InteractiveView',
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, enabledData */) {
						sc.init.call(this, params);
						this.enabledData = uf.padam(params, 'enabledData', true);
					},
					
					tick: function(millis) {
						if (this.enabledData.getValue())
							this.domRoot.classList.remove('_disabled');
						else
							this.domRoot.classList.add('_disabled');
					},
					
					start: function() {
						sc.start.call(this);
						this.enabledData.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.enabledData.stop();
					}
				};}
			}),
			InputView: U.makeClass({ name: 'InputView',
				superclassName: 'InteractiveView',
				methods: function(sc, c) { return {
					init: function(params /* name, multiline, initialValue, textData, placeholderData, enabledData */) {
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
						input.classList.add('_interactive');
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
						sc.tick.call(this, millis);
						
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
					},
					
					start: function() {
						sc.start.call(this);
						this.textData.start();
						this.placeholderData.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.textData.stop();
						this.placeholderData.stop();
					}
				};}
			}),
			ActionView: U.makeClass({ name: 'ActionView',
				superclassName: 'InteractiveView',
				methods: function(sc, c) { return {
					init: function(params /* name, $action, textData, enabledData */) {
						sc.init.call(this, params);
						this.$action = U.param(params, '$action');
						this.waiting = false;
						this.textData = uf.padam(params, 'textData');
					},
					
					createDomRoot: function() {
						var button = document.createElement('div');
						button.classList.add('_button');
						button.classList.add('_interactive');
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
						sc.tick.call(this, millis);
						
						uf.domSetText(this.domRoot, this.textData.getValue());
						
						if (this.waiting)	this.domRoot.classList.add('_waiting');
						else 							this.domRoot.classList.remove('_waiting');
					},
					
					start: function() {
						sc.start.call(this);
						this.textData.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.textData.stop();
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
						child.stop();								// Detach dom
						child.par = null;						// Detach data step 1
						delete this.children[name];	// Detach data step 2
						
						return child;
					},
					provideContainer: function() {
						throw new Error('not implemented');
					},
					
					stop: function() {
						for (var k in this.children) this.children[k].stop();
						sc.stop.call(this);
					}
				};}
			}),
			SetView: U.makeClass({ name: 'SetView',
				superclassName: 'AbstractSetView',
				description: 'The simplest implementation of AbstractSetView. ' +
					'Updates all child views.',
				methods: function(sc, c) { return {
					init: function(params /* name, children, numWrappers */) {
						sc.init.call(this, params);
						this.numWrappers = U.param(params, 'numWrappers', 0);
					},
					
					createDomRoot: function() {
						var ret = sc.createDomRoot.call(this);
						var ptr = ret;
						for (var i = 0, len = this.numWrappers; i < len; i++) {
							ptr.appendChild(document.createElement('div'));
							ptr = ptr.childNodes[0];
							ptr.classList.add('_wrap');
						}
						return ret;
					},
					provideContainer: function() {
						var ret = this.domRoot;
						for (var i = 0, len = this.numWrappers; i < len; i++) ret = ret.childNodes[0];
						return ret;
					},
					update: function(millis) {
						var children = this.children;
						
						sc.update.call(this, millis);
						for (var k in this.children)
							this.children[k].update(millis);
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
					update: function(millis) {
						sc.update.call(this, millis);
						if (this.currentChild) this.currentChild.update(millis);
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
								this.currentChild.stop();
							}
							this.currentChild = nextChild;
							if (this.currentChild) {
								this.domRoot.classList.add('_choose-' + this.currentChild.name);
							}
						}
					},
					
					start: function() {
						sc.start.call(this);
						this.choiceData.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.choiceData.stop();
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
						this.textData = uf.padam(params, 'textData');
						var inputViewParams = U.param(params, 'inputViewParams', {});
						sc.init.call(this, params.update({
							choiceData: new uf.CalculatedData({ getFunc: function() { return editableData.getValue() ? 'edit' : 'display'; } }),
							children: [
								new uf.InputView(inputViewParams.update({ name: 'edit', textData: this.textData })),
								new uf.TextView({ name: 'display', data: this.textData })
							]
						}));
					},
					
					start: function() {
						sc.start.call(this);
						this.textData.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.textData.stop();
					}
				};}
			}),
			
			/* COMPLEX VIEW */
			DynamicSetView: U.makeClass({ name: 'DynamicSetView',
				superclassName: 'SetView',
				description: 'A SetView whose children are based on Data. ' +
					'Modifications to the Data instantly modify the children of ' +
					'the DynamicSetView. Adds a 2nd parameter to `addChild`; the ' +
					'raw data that the child was built from.',
				methods: function(sc, c) { return {
					init: function(params /* name, data, getDataId, genChildView, comparator */) {
						if ('children' in params) throw new Error('Cannot initialize DynamicSetView with `children` param');
						
						sc.init.call(this, params);
						this.data = uf.padam(params, 'data');
						this.getDataId = U.param(params, 'getDataId'), // Returns a unique id for a piece of data (will be used for child.name)
						this.genChildView = U.param(params, 'genChildView'), // function(name, initialRawData, data) { /* generates a View */ };
						this.comparator = U.param(params, 'comparator', null);
						
						// Enable `this` inside `this.genChildView`
						this.genChildView = this.genChildView.bind(this);
						
						this.count = 0;
					},
					
					tick: function(millis) {
						
						var addr = this.getAddress();
						
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
							if (!this.remChild(k)) {
								console.log(rem, this.getAddress(), this.children);
								throw new Error('Couldn\'t remove child: "' + k + '"');
							}
						}
						
						// Add all children as necessary
						for (var k in add) {
							var calc = new uf.CalculatedData({ getFunc: function(rawData) { return rawData; }.bind(null, add[k]) });
							var child = this.genChildView(k, calc);
							if (child.name !== k) throw new Error('Child named "' + child.name + '" needs to be named "' + k + '"');
							calc.getFunc = function(child) { return this.getChildRawData(child); }.bind(this, child);
							this.addChild(child, add[k]);
						}
						
					},
					getChildRawData: function() {
						return null;
					},
					
					start: function() {
						sc.start.call(this);
						this.data.start();
					},
					stop: function() {
						sc.stop.call(this);
						this.data.stop();
					}
				};}
			}),
			GraphView: U.makeClass({ name: 'GraphView',
				superclassName: 'DynamicSetView',
				description: 'A DynamicSetView which keeps track of directed ' +
					'relationships between every pair of its children.',
				methods: function(sc, c) { return {
					init: function(params /* name, getDataId, genChildView, relations, classifyRelation, focusedNameData, physicsSettings */) {
						this.childDataSet = []; // An arbitrarily-keyed list of data items. The key is provided by `getDataId`.
						this.childRawData = {}; // A properly-keyed list of raw data items. The child's name corresponds to the data's key.
						var genChildView = U.param(params, 'genChildView');
						params.genChildView = function() {
							
						};
						
						sc.init.call(this, params.update({ data: this.childDataSet }));
						
						var physicsSettings = U.param(params, 'physicsSettings', {});
						this.physicsSettings = {
							dampenGlobal: 0.6,
							gravityMult: 1 / 100,
							focusR: 150,
							unfocusR: 80,
							separation: 20,
							tooFar: 500,
							repulseMult: 10,
							repulseMinDivisor: 0.08,
							focusSpeed: 2000
						}.update(physicsSettings);
						
						// Given the raw data of two nodes, returns the name of the relationship between those nodes
						this.classifyRelation = U.param(params, 'classifyRelation');
						
						// Defines relations; the "schema"
						this.relations = U.param(params, 'relations');
						
						// TODO: Consider if "focused" functionality should even be provided by this class
						// Stores the name of the currently focused element
						this.focusedNameData = uf.padam(params, 'focusedNameData', null);
						
						// Reference to currently focused view
						this.focused = null;
						
						// Stores relations; the "data"
						this.relationMap = {};
						
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
					provideContainer: function(view) {
						var w = Math.round(this.domRoot.offsetWidth);
						var h = Math.round(this.domRoot.offsetHeight);
						
						view.domRoot.style.left = (w >> 1) - this.physicsSettings.unfocusR;
						view.domRoot.style.top = (h >> 1) - this.physicsSettings.unfocusR;
						view.domRoot.style.transform = 'scale(' + this.physicsSettings.unfocusR / this.physicsSettings.focusR + ')';
						view.domRoot.classList.add('_node');
						
						return this.domRoot.childNodes[1];
					},
					addRawData: function(rawDataSet) {
						// TODO: Need way to specify initial node location.
						// The issue is that initial location has no access to rawData;
						// it only has access to the child, and then it generates the
						// raw data from scratch.
						if (!U.isObj(rawDataSet, Array)) rawDataSet = [ rawDataSet ];
						
						for (var i = 0, len = rawDataSet.length; i < len; i++) {
							var d = rawDataSet[i];
							var id = this.getDataId(d);
							if (id in this.childRawData) return;
							
							this.childDataSet.push(d);
						}
					},
					updateRawData: function(view, newRawData) {
						
						var oldId = view.name;
						var oldRawData = this.childRawData[oldId].raw;
						
						var newId = this.getDataId(newRawData);
						
						// Special changes need to be made if the id is changing
						if (newId !== oldId) {
							if (newId in this.children) throw new Error('Updating "' + oldId + '" to "' + newId + '" causes overwrite');
							
							this.childRawData[newId] = { physics: this.childRawData[oldId].physics }; // Need to retain the `physics` property
							delete this.childRawData[oldId];
							
							this.children[newId] = this.children[oldId]; // Update the child key name
							this.children[newId].name = newId; // This seems risky :(
							delete this.children[oldId];
							
							// If the child was already focused, update focusedNameData
							if (this.focusedNameData.getValue() === oldId) {
								this.focusedNameData.setValue(newId);
							}
							
							// TODO: Need to anticipate any static behaviour that occurs when a view generates its dom root :(
							view.domRoot.classList.remove('_' + oldId);
							view.domRoot.classList.add('_' + newId);
						}
						
						// Update the `raw` property of the raw data container
						this.childRawData[newId].raw = newRawData;
						this.childRawData[newId].id = newId;
						
						
						/*
						Need to O(n) search `this.childDataSet` - which is a pity
						and possibly suggests it should be an object whose key is
						always the id??? In which case there would be no more need
						for `this.getDataId`, but is that a loss of power?
						*/ 
						for (var i = 0, len = this.childDataSet.length; i < len; i++) {
							if (this.getDataId(this.childDataSet[i]) === oldId) {
								this.childDataSet[i] = newRawData;
								break;
							}
						}
						
						// TODO: Need to update relations with `this.classifyRelation`!
						
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
								loc: new PACK.geom.Point({ ang: Math.random() * Math.PI * 2, mag: 0.0001 }),
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
						
						if (!c) return null; // Rem failed!
						
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
						
						return c;
					},
					relationKey: function(child1, child2) {
						return child1 !== child2 ? child1.name + '-' + child2.name : child1.name;
					},
					tick: function(millis) {
						var w = Math.round(this.domRoot.offsetWidth);
						var h = Math.round(this.domRoot.offsetHeight);
						var hw = w >> 1;
						var hh = h >> 1;
						var scale = 1 / 150;
						var secs = millis / 1000;
						
						var ps = this.physicsSettings;
						
						// Ensure the canvas size maps directly to the dom space
						var canvas = this.domRoot.childNodes[0];
						if (canvas.width !== w) canvas.width = w;
						if (canvas.height !== h) canvas.height = h;
						
						var cs = this.children.toArray();
						var ncs = cs.length;
						
						// Update physics for all nodes
						for (var i = 0; i < ncs; i++) {
							
							var c1 = cs[i];
							var phys1 = this.childRawData[c1.name].physics;
							phys1.vel = phys1.vel.scale(ps.dampenGlobal);
							phys1.loc = phys1.loc.add(phys1.vel.scale(secs));
							phys1.r = c1 === this.focused ? ps.focusR : ps.unfocusR;
							
							// Always have impulse towards origin
							var d2 = phys1.loc.distSqr(PACK.geom.ORIGIN);
							phys1.vel = phys1.vel.add(new PACK.geom.Point({ ang: phys1.loc.angTo(PACK.geom.ORIGIN), mag: d2 * (ps.gravityMult * ps.gravityMult) }));
							
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
								
								var dist = phys1.loc.dist(phys2.loc) - (phys1.r + phys2.r) - ps.separation;
								if (dist > ps.tooFar) continue;
								
								var mag = ps.repulseMult / Math.max(ps.repulseMinDivisor, dist);
								var repulse = new PACK.geom.Point({ ang: phys2.loc.angTo(phys1.loc), mag: mag }).scale(phys2.r * inertiaRatio);
								phys1.vel = phys1.vel.add(repulse);
							}
						}
						
						// Update the focused node independently
						var f = this.focused;
						if (f) {
							var physF = this.childRawData[f.name].physics;
							physF.vel = PACK.geom.ORIGIN;
							//physF.loc = PACK.geom.ORIGIN;
							physF.loc = physF.loc.moveTowards(PACK.geom.ORIGIN, ps.focusSpeed * secs);
						}
						
						// Update styling based on physics
						for (var i = 0, len = cs.length; i < len; i++) {
							var c = cs[i];
							var phys = this.childRawData[c.name].physics;
							
							c.domRoot.style.left = (hw + (phys.loc.x - phys.r)) + 'px';
							c.domRoot.style.top = (hh + (phys.loc.y - phys.r)) + 'px';
							c.domRoot.style.transform = 'scale(' + phys.r * scale + ')';
						}
						
						// Update the focus
						// TODO: invalid `nextFocusedName` should be tolerated? (It can be set, but won't apply until there is a corresponding view)
						var nextFocusedName = this.focusedNameData.getValue();
						if (!this.focused || nextFocusedName !== this.focused.name) {
							
							// Unfocus any currently focused element
							if (this.focused) {
								this.focused.domRoot.classList.remove('_graphFocus');
								this.focused = null;
							}
							
							// Focus the next view if there is one
							if (nextFocusedName && nextFocusedName in this.children) {
								this.focused = this.children[nextFocusedName];
								this.focused.domRoot.classList.add('_graphFocus');
							}
							
						}
						
						/*
						Here's why sc.tick is called AFTER the other updates:
						If it isn't, it's possible some children will not have their
						`domRoot` initialized yet. `sc.tick` would call `addChild`
						for any un-added children, but those children would never
						have `update` called on them before their `domRoot` property
						was accessed in `this.tick`.
						
						Instead, what happens is that the physics update is applied,
						and then `sc.tick` is called which will set up any new,
						un-added children for the next call to `this.tick`.
						*/
						sc.tick.call(this);
					},
					getChildRawData: function(child) {
						return this.childRawData[child.name].raw;
					}
				};}
			})
			
		};
		
		return uf;
	}
});
package.build();
