// TODO: Some Data objects can be optimized to cache previous values until the end of the frame (or some other condition?)
// E.g. Would stop 1000 elements all connected to the same CalculatedData from repeating the calculation 1000 times
// TODO: A Decorator to combine dragging + clicking? These 2 features are probably usually desirable together, and annoying
// to implement.

var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'quickDev', 'p', 'geom' ],
	buildFunc: function() {
		var namespace = {};
		
		var P = PACK.p.P;
		var Point = PACK.geom.Point;
		var origin = PACK.geom.ORIGIN;
		
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
				
				if (!func) throw new Error('Bad func:', func);
				
				// If no set already exists for this type of listener, create it
				if (!(setName in elem)) {
					
					// Create the set...
					elem[setName] = [];							
					
					// Set up a function at "type" to call every function at "setName"
					elem[type] = function(listenerSet, event) {
						// TODO: `clone` listenerSet before iteration in case of listeners which add more listeners?
						for (var i = 0; i < listenerSet.length; i++) listenerSet[i](event);
					}.bind(null, elem[setName]);
					
				}
				
				if (~elem[setName].indexOf(func)) throw new Error('Func already added');
				
				// Add the listener
				elem[setName].push(func);
			},
			domRemListener: function(elem, type, func) {
				// Key the set at an index that isn't already in use
				var setName = '~' + type + 'Set';
				
				if (!(setName in elem)) return;
				
				var listenerSet = elem[setName];
				
				var len = listenerSet.length;
				if (listenerSet.remove(func) && U.isEmpty(listenerSet)) {
					// Clean up set and listener-calling-function
					elem[type] = null; // The `type` property shouldn't be delete-able (e.g. "onmousemove", "onmouseup", etc.)
					delete elem[setName]; // But this is a custom property, so it's delete-able
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
				statik: {
					NEXT_ID: 0
				}
			}),
			ClickDecorator: U.makeClass({ name: 'ClickDecorator',
				superclassName: 'Decorator',
				methods: function(sc, c) { return {
					init: function(params /* action */) {
						sc.init.call(this, params); // TODO: Needs parent class with `validTargets`
						
						this.action = U.param(params, 'action', null);
						this.data = new uf.SimpleData({ value: false });
					},
					start: function(view) {
						view['~' + this.id + '.clickFuncDn'] = c.clickFuncDn.bind(this, view);
						view['~' + this.id + '.clickFuncUp'] = c.clickFuncUp.bind(this, view);
						
						uf.domAddListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']); // Up listener is only added after mousedown
					},
					stop: function(view) {
						uf.domRemListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
						
						delete view['~' + this.id + '.clickFuncDn'];
						delete view['~' + this.id + '.clickFuncUp'];
					}
				};},
				statik: {
					clickFuncDn: function(view, event) {
						// TODO: COPY-PASTED FROM DRAGDECORATOR!! Consolidate in superclass
						if (this.validTargets && view.domRoot !== event.target) {
							// Return if no selector in `validTargets` matches `event.target`
							if (!this.validTargets.any(function(sel) { return event.target.matches(sel); })) return;
						}
						
						this.data.setValue(true);
						
						uf.domAddListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
						uf.domAddListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
					},
					clickFuncUp: function(view, event) {
						if (!this.data.getValue()) return; // Could get called x2 with listeners on both document and `view.domRoot`
						
						this.data.setValue(false);
						if (this.action) this.action(view);
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
						uf.domRemListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
					}
				}
			}),
			DragDecorator: U.makeClass({ name: 'DragDecorator',
				superclassName: 'Decorator',
				methods: function(sc, c) { return {
					init: function(params /* tolerance, validTargets, captureOnStart */) {
						sc.init.call(this, params);
						this.data = new uf.SimpleData({ value: { drag: false, mouseDown: false, view: null } });
						this.tolerance = U.param(params, 'tolerance', 0);
						
						// TODO: Function to capture arbitrary data when drag begins (will allow physics values to be captured)
						this.captureOnStart = U.param(params, 'captureOnStart', null);
						
						/*
						DragDecorators can be configured to fire on only specific children of
						the decorated element. If `validTargets` is an empty array, it means
						drags can only occur when the root element is clicked, and not its
						children. If `validTargets === null` then drags can be initiated by
						clicking on any child, or the root element. Otherwise, `validTargets`
						is an array of css-selectors and only child elements which match one
						of those selectors will be able to initiate drag events.
						*/
						this.validTargets = U.param(params, 'validTargets', []);
					},
					start: function(view) {
						// Store properties on the view
						view['~' + this.id + '.clickFuncDn'] = c.clickFuncDn.bind(this, view);
						view['~' + this.id + '.clickFuncUp'] = c.clickFuncUp.bind(this, view);
						view['~' + this.id + '.mouseMove'] = c.mouseMove.bind(this, view);
						
						uf.domAddListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
					},
					stop: function(view) {
						uf.domRemListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']); // If stopped during mousedown, this is necessary
						uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']); // If stopped during mousedown, this is necessary
						
						// Delete properties from the view
						delete view['~' + this.id + '.clickFuncDn'];
						delete view['~' + this.id + '.clickFuncUp'];
						delete view['~' + this.id + '.mouseMove'];
					}
				};},
				statik: {
					// For these methods `this` still refers to the DragDecorator even though these methods are static
					clickFuncDn: function(view, event) { // Mouse down - add up listener, modify `this.data`
						if (this.validTargets && view.domRoot !== event.target) {
							// Return if no selector in `validTargets` matches `event.target`
							if (!this.validTargets.any(function(sel) { return event.target.matches(sel); })) return;
						}
						
						// Add listeners
						uf.domAddListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
						uf.domAddListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
						
						var rect = view.domRoot.getBoundingClientRect();
						
						// Update data
						this.data.setValue({
							drag: false,
							mouseDown: true,
							view: view,
							capturedData: this.captureOnStart ? this.captureOnStart(view) : null,
							pt1: new Point({ x: event.clientX, y: event.clientY }),
							pt2: new Point({ x: event.clientX, y: event.clientY })
						});
					},
					clickFuncUp: function(view, event) { // Mouse up - modify `this.data`, remove up listener
						// Remove listeners
						uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
						uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
						
						var dragOccurred = this.data.getValue().drag;
						
						// Reset data
						this.data.setValue({
							drag: false,
							mouseDown: false,
							view: null
						});
						
						// If the drag happened prevent any clicks from going through on mouseup
						if (dragOccurred) event.preventDefault();
					},
					mouseMove: function(view, event) {	 // Mouse move
						// Update values in `this.data`
						var data = this.data.getValue(); // We know `this.data` is a SimpleData, so just updating it normally works here
						
						// It's possible for mousemove to fire after mouseup; detectable if data.pt1 is undefined
						if (!data.pt1) return;
						
						// Update `drag`
						data.pt2 = new Point({ x: event.clientX, y: event.clientY });
						if (!data.drag && data.pt2.dist(data.pt1) > this.tolerance) {
							data.drag = true;
							// TODO: This is when the drag really starts; should consider updating `pt1` and `capturedData`
						}
						
						event.preventDefault(); // Stops annoying highlighting. TODO: Should this be optional? Probably.
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
						if (!nextClass || !classList.contains(nextClass)) {
							
							// Remove all possible classes
							classList.remove.apply(classList, this.possibleClasses); 
							
							// Add the current class
							if (nextClass) classList.add(nextClass);
							
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
						this.properties = U.param(params, 'properties');
						this.data = uf.padam(params, 'data');
					},
					start: function(view) {
					},
					update: function(view) {
						var nextProps = this.data.getValue();
						var style = view.domRoot.style;
						
						// Calculate the difference...
						for (var i = 0; i < this.properties.length; i++) {
							var prop = this.properties[i];
							var val = (prop in nextProps) ? nextProps[prop] : ''; // Unspecified properties are removed
							if (val !== style[prop]) style[prop] = val; // Only update the style props that have changed
						}
					},
					end: function(view) {
						var style = view.domRoot.style;
						for (var i = 0; i < this.properties.length; i++) style[this.properties[i]] = '';
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
					modValue: function(modFunc) {
						var val = modFunc(this.getValue());
						this.setValue(val);
						return val;
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
			CachedData: U.makeClass({ name: 'CachedData',
				// TODO: Need a way to register this badboy in a list so the whole list can be reset at once
				// Will require modifications to CachedData.prototype.stop/start; to register/unregister itself
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* data */) {
						sc.init.call(this, params);
						this.data = uf.padam(params, 'data');
						this.cached = c.NO_VALUE;
					},
					getValue: function() {
						if (this.cached === c.NO_VALUE) this.cached = this.data.getValue();
						return this.cached;
					},
					setValue: function(val) {
						this.cached = val;
					},
					reset: function() {
						if (this.cached === c.NO_VALUE) return;
						
						this.data.setValue(this.cached);
						this.cached = c.NO_VALUE;
					},
					stop: function() {
						this.reset();
					}
				};},
				statik: {
					NO_VALUE: { NO_VALUE: true }
				}
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
						
						if (++this.frameCount >= this.framesPerTick) {
							for (var i = 0, len = this.decorators.length; i < len; i++)
								this.decorators[i].update(this);
							
							this.tick(millis * this.framesPerTick);
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
						this.addChildren(U.param(params, 'children', []));
					},
					
					addChildren: function(children) {
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
							var rawData = this.initChildRawData(k, add[k]).update({ raw: add[k] });
							var calc = new uf.CalculatedData({ getFunc: function() { return rawData; } });
							var child = this.genChildView.call(this, k, calc);
							
							if (child.name !== k) throw new Error('Child named "' + child.name + '" needs to be named "' + k + '"');
							calc.getFunc = this.getChildRawData.bind(this, child);
							if (!this.addChild(child, add[k])) throw new Error('DynamicSetView `addChild` failed');
						}
						
					},
					initChildRawData: function(name, rawData) {
						return {};
					},
					getChildRawData: function(child) {
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
			// TODO: Consider a class between DynamicSetView and GraphView which
			// simply stores arbitrary data alongside every child node. Move
			// GraphView.prototype.addRawData, GraphView.prototype.updateRawData
			// to this class instead.
			GraphView: U.makeClass({ name: 'GraphView',
				superclassName: 'DynamicSetView',
				description: 'A DynamicSetView which keeps track of directed ' +
					'relationships between every pair of its children.',
				methods: function(sc, c) { return {
					init: function(params /* name, getDataId, genChildView, relations, classifyRelation, physicsSettings */) {
						
						this.childDataSet = []; // An arbitrarily-keyed list of data items. The key is provided by `getDataId`.
						this.childRawData = {}; // A properly-keyed list of raw data items. The child's name corresponds to the data's key.
						sc.init.call(this, params.update({ data: this.childDataSet }));
						
						var physicsSettings = U.param(params, 'physicsSettings', {});
						this.physicsSettings = {
							dampenGlobal: 0.6,
							gravityPow: 2,
							gravityMult: 1 / 100,
							gravityMax: 500,
							separation: 20,
							tooFar: 500,
							repulseMult: 10,
							repulseMinDivisor: 0.08,
						}.update(physicsSettings);
						
						// Given the raw data of two nodes, returns the name of the relationship between those nodes
						this.classifyRelation = U.param(params, 'classifyRelation');
						
						// Defines relations; the "schema"
						this.relations = U.param(params, 'relations');
						
						// Stores relations; the "data"
						this.relationMap = {};
						
						this.maxUpdatesPerFrame = U.param(params, 'maxUpdatesPerFrame', 1000);
						this.updateIndex = 0;
						
					},
					
					createDomRoot: function() {
						var ret = document.createElement('div');
						// TODO: Should occur via decorator. Prevents accidental drags on the GraphView from highlighting text
						// Disabling onmouseup and onmousedown makes it impossible to focus any inputs which are children
						// ret.onmouseup = ret.onmousedown = ret.onmousemove = function(e) { return e.preventDefault(); };
						ret.onmousemove = function(e) { return e.preventDefault(); };
						
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
						view.domRoot.classList.add('_node'); // TODO: This is no good!! Can't add classes like this...
						return this.domRoot.childNodes[1]; // Return ._nodes
					},
					addRawData: function(rawDataSet) {
						// TODO: Need way to specify initial node location.
						// The issue is that initial location has no access to rawData;
						// it only has access to the child, and then it generates the
						// raw data from scratch.
						if (!U.isObj(rawDataSet, Array)) rawDataSet = [ rawDataSet ];
						
						for (var i = 0, len = rawDataSet.length; i < len; i++) {
							var data = rawDataSet[i];
							var id = this.getDataId(data);
							if (!(id in this.childRawData))	this.childDataSet.push(data);
						}
					},
					updateRawData: function(view, newRawData) {
						
						var oldId = view.name;
						var oldRawData = this.childRawData[oldId].raw;
						
						var newId = this.getDataId(newRawData);
						
						// Special changes need to be made if the id is changing
						if (newId !== oldId) {
							if (newId in this.children) throw new Error('Updating "' + oldId + '" to "' + newId + '" causes overwrite');
							
							this.childRawData[newId] = this.childRawData[oldId].clone(); // Retain all properties
							delete this.childRawData[oldId];
							
							this.children[newId] = this.children[oldId]; // Update the child key name
							this.children[newId].name = newId;
							delete this.children[oldId];
							
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
					remChild: function(child) {
						var c = sc.remChild.call(this, child);
						
						if (!c) return null; // Rem failed!
						
						delete this.childRawData[c.name];
						
						for (var k in this.children) {
							var c2 = this.children[k];
							delete this.relationMap[this.relationKey(c, c2)];
							delete this.relationMap[this.relationKey(c2, c)];
						}
						
						return c;
					},
					relationKey: function(child1, child2) {
						if (!U.isObj(child1, String)) child1 = child1.name;
						if (!U.isObj(child2, String)) child2 = child2.name;
						
						return child1 !== child2 ? child1 + '-' + child2 : child1;
					},
					tick: function(millis) {
						// TODO: On really unstable configurations, something breaks here
						// Probably a NaN value propagating to all other values or something
						// of the sort
						
						var w = Math.round(this.domRoot.offsetWidth);
						var h = Math.round(this.domRoot.offsetHeight);
						var screenCenter = new Point({ x: w >> 1, y: h >> 1 });
						var scale = 1 / 150;
						var secs = millis / 1000;
						
						var ps = this.physicsSettings;
						
						// Ensure the canvas size maps directly to the dom space
						var canvas = this.domRoot.childNodes[0];
						if (canvas.width !== w) canvas.width = w;
						if (canvas.height !== h) canvas.height = h;
						
						var cs = this.children.toArray();
						var ncs = cs.length;
						var mncs = Math.min(ncs, this.maxUpdatesPerFrame);
						
						// Update physics for all nodes
						for (var n = 0; n < mncs; n++) { // Iterate maximum `this.maxUpdatesPerFrame` times
							
							var i = this.updateIndex; // Storing before incrementing allows beginning at 0 instead of 1)
							this.updateIndex = (++this.updateIndex >= cs.length) ? 0 : this.updateIndex;
							
							var c1 = cs[i];
							var phys1 = this.childRawData[c1.name].physics;
							var loc1 = phys1.loc.getValue();
							var r1 = phys1.r.getValue();
							
							// Dampen velocity
							phys1.vel = phys1.vel.scale(ps.dampenGlobal);
							
							// Increment location based on velocity
							loc1 = loc1.add(phys1.vel.scale(secs));
							
							// Increment velocity based on acceleration
							phys1.vel = phys1.vel.add(phys1.acl);
							
							// Reset acceleration
							phys1.acl = new Point({
								ang: loc1.angleTo(screenCenter),
								mag: 10
							})
							
							for (var j = 0; j < ncs; j++) {
								if (i === j) continue;
								
								var c2 = cs[j];
								var phys2 = this.childRawData[c2.name].physics;
								var loc2 = phys2.loc.getValue();
								var r2 = phys2.r.getValue();
								
								var sepDist = r1 + r2 + ps.separation;
								var dist = loc1.dist(loc2);
								var gap = dist - sepDist;
								
								phys1.acl = phys1.acl.add(new Point({
									ang: loc1.angleTo(loc2),
									mag: (ps.gravityMult * r2) / (Math.max(Math.pow(dist, ps.gravityPow), 1) * r1)
								}));
								
								if (gap < 0) {
									
									loc1 = loc2.angleMove(loc2.angleTo(loc1), sepDist);
									
								}
								
							}
							
							phys1.loc.setValue(loc1);
							
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
					getScreenCenter: function() {
						// TODO: Consider retrieving data from a Data object instead of the DOM?
						return new Point({
							x: Math.round(this.domRoot.offsetWidth) >> 1,
							y: Math.round(this.domRoot.offsetHeight) >> 1
						});
					},
					initChildRawData: function(name, rawData) {
						for (var k in this.children) {
							var name2 = this.children[k].name;
							this.relationMap[this.relationKey(name, name2)] = 'RELATION ' + name + ' -> ' + name2;
							this.relationMap[this.relationKey(name2, name)] = 'RELATION ' + name2 + ' -> ' + name;
						}
						
						// The return value is also stored in `childRawData`
						return this.childRawData[name] = {
							id: name,
							physics: {
								weight: 1,
								r: new uf.SimpleData({ value: 150 }), // Initial radius
								loc: new uf.SimpleData({ value: this.getScreenCenter().angleMove(Math.random() * Math.PI * 2, 0.0001) }),
								vel: new Point(),
								acl: new Point()
							}
						};
					},
					getChildRawData: function(child) {
						return this.childRawData[child.name];
					}
				};}
			})
			
		};
		
		return uf;
	}
});
package.build();
