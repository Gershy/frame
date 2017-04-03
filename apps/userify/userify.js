var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'quickDev', 'p' ],
	buildFunc: function() {
		var namespace = {};
		
		var ensurePromise = function(val) {
			return U.isInstance(val, PACK.p.P) ? val : new PACK.p.P({ val: val });
		};
		var $null = ensurePromise(null);
		var P = PACK.p.P;
		var E = PACK.e.E;
		
		var uf = {}
		
		uf.update({
			
			domSetText: function(elem, text) {
				if (elem.innerHTML !== text) elem.innerHTML = text;
			},
			domRestartAnimation: function(elem) {
				elem.style.animation = 'none';
				setTimeout(function() { elem.style.animation = ''; }, 10);
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
			InstantData: U.makeClass({ name: 'InstantData',
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
					init: function(params /* $getFunc, updateMillis */) {
						sc.init.call(this, params);
						this.$getFunc = U.param(params, '$getFunc');
						this.$setFunc = U.param(params, '$setFunc', null);
						this.doingSet = false;
						this.updateMillis = U.param(params, 'updateMillis', 0);
						this.value = null;
						
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
					init: function(params /* name */) {
						this.name = U.param(params, 'name');
						if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
						
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
					getContainer: function() {
						if (this.par === null) return document.body;
						return this.par.provideContainer(this);
					},
					$update: function(millis) {
						if (this.domRoot === null) {
							this.domRoot = this.createDomRoot();
							this.domRoot.id = this.getNameChain().join('-');
							this.domRoot.classList.add(this.name);
							this.getContainer().appendChild(this.domRoot);
						}
						
						this.tick(millis);
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
						this.data = U.param(params, 'data');
					},
					
					createDomRoot: function() {
						return document.createElement('span');
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
					init: function(params /* name, textData, placeholderData */) {
						sc.init.call(this, params);
						this.textData = U.param(params, 'textData', uf.emptyData);
						this.placeholderData = U.param(params, 'placeholderData', uf.emptyData);
					},
					
					createDomRoot: function() {
						var ret = document.createElement('div');
						ret.classList.add('_ufInput');
						
						var input = document.createElement('div');
						input.setAttribute('contenteditable', true);
						input.setAttribute('tabindex', 0);
						input.classList.add('_widget');
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
					tick: function() {
						var input = this.domRoot.childNodes[0];
						
						// Update the placeholder value
						uf.domSetText(this.domRoot.childNodes[1], this.placeholderData.getValue());
						
						// Update the "_empty" class
						if (input.innerHTML)	this.domRoot.classList.remove('_empty');
						else 									this.domRoot.classList.add('_empty');
						
						if (document.activeElement === input && !this.domRoot.classList.contains('_focus')) {
							this.domRoot.classList.add('_focus');
							var animSet = this.domRoot.childNodes[2].childNodes;
							for (var i = 0, len = animSet.length; i < len; i++) uf.domRestartAnimation(animSet[i]);
						} else if (document.activeElement !== input) {
							this.domRoot.classList.remove('_focus');
						}
						
						this.textData.setValue(input.innerHTML);
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
						this.textData = U.param(params, 'textData');
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
					tick: function() {
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
						if (child.par === this) return;
						if (child.par !== null) throw new Error('Tried to add View with parent: ' + child.getAddress());
						if (child.name in this.children) throw new Error('Already have a child named "' + child.name + '"');
						
						child.par = this;
						this.children[child.name] = child;
					},
					remChild: function(name) {
						if (!U.isObj(name, String)) name = name.name;
						
						if (!(name in this.children)) return false;
						
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
									all: children.map(function(child) { return child.$update() })
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
						this.choiceData = U.param(params, 'choiceData');
						
						// Property to keep track of the currently active child
						this.currentChild = null;
					},
					
					provideContainer: function() {
						return this.domRoot;
					},
					$update: function(millis) {
						var choice = this.choiceData.getValue();
						
						if (choice === null) {
							var nextChild = null;
						} else {
							if (!(choice in this.children)) throw new Error('Bad view choice: "' + choice + '"');
							var nextChild = this.children[choice];
						}
						
						if (nextChild !== this.currentChild) {
							if (this.currentChild) this.currentChild.fini();
							this.currentChild = nextChild;
						}
						
						return sc.$update.call(this, millis)
							.then(function() {
								return this.currentChild ? this.currentChild.$update(millis) : PACK.p.$null;
							}.bind(this));
					},
					tick: function() {
					}
				};}
			}),
			TextHideView: U.makeClass({ name: 'TextHideView',
				superclassName: 'ChoiceView',
				methods: function(sc, c) { return {
					init: function(params /* name, data */) {
						var data = U.param(params, 'data');
						sc.init.call(this, params.update({
							choiceData: new uf.CalculatedData({ getFunc: function() { return data.getValue() ? 'text' : null; } }),
							children: [	new uf.TextView({ name: 'text', data: data })	]
						}));
					}
				};}
			}),
			
			GraphView: U.makeClass({ name: 'GraphView',
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, relationData, classifyRelation, createNode */) {
						sc.init.call(this, params);
						
						this.relationData = U.param(params, 'relationData');
						this.classifyRelation = U.param(params, 'classifyRelation');
						this.createNode = U.param(params, 'createNode');
					}
				};}
			})
			
		});
		
		uf.update({
			emptyData: new uf.CalculatedData({ getFunc: function() { return ''; }, setFunc: function() {} })
		});
		
		uf.update({} || {
			View: U.makeClass({ name: 'View', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, doss */) {
						this.name = U.param(params, 'name');
						this.doss = U.param(params, 'doss', '');
						this.par = null;
						this.elem = null;
					},
					getChain: function() {
						var views = [];
						var view = this;
						while (view.par) { views.push(view); view = view.par; }
						return views.reverse();
					},
					getAddress: function() {
						return this.getChain().map(function(view) { return view.name; }).join('.');
					},
					$getDoss: function(doss) {
						
						var pass = this;
						
						var $doss1 = ensurePromise(U.exists(doss) ? doss : null);
						var $doss2 = ensurePromise(this.doss)
							.then(function(doss2) {
								// `doss2` is either a String address or a `QElem`
								if (U.isInstance(doss2, PACK.quickDev.QElem)) return doss2;
								
								// `doss2` must be a String; if there's no parent, impossible to get `QElem`
								if (!pass.par) throw new Error('View has no parent or explicit doss');
								
								return pass.par.$getDoss()
									// Retrieve from the parent
									.then(function(parDoss) { return parDoss.getChild(doss2) })
									// Replace the address with the `Dossier` itself
									.then(function(doss) { return pass.doss = doss; });
								
							});
						
						return $doss1.then(function(doss1) {
							
							if (!doss1) return $doss2;
							
							if (U.isInstance(doss1, PACK.quickDev.QElem)) return doss1;
							
							// `doss1` is a String address
							return $doss2.then(function(doss2) { return doss2.getChild(doss1); });
							
						});
						
					},
					$startRender: function() {
						if (this.elem !== null) throw new Error('`$startRender` called while already rendering ' + this.constructor.title + ' (' + this.getAddress() + ')');
						
						return new P({ args: [ this, this.$createElem(), this.$getContainer() ] })
							.then(function(pass, elem, container) {
								pass.elem = elem;
								pass.elem.listAttr({ class: [ '+name-' + pass.name ] });
								
								if (container) container.append(elem);
							});
					},
					ceaseRender: function() {
						if (this.elem === null) throw new Error('`ceaseRender` called while not rendering');
						this.elem.remove();
						this.elem = null;
					},
					$getContainer: function() {
						if (this.par !== null) return this.par.$provideContainer(this);
						return $null;
					},
					$createElem: function() { throw new Error('not implemented'); },
					$updateElem: function() { throw new Error('not implemented'); }
				}; }
			}),
			SetView: U.makeClass({ name: 'SetView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, children, flow */) {
						var children = U.param(params, 'children', []);
						var flow = U.param(params, 'flow', 'block');
						
						sc.init.call(this, params);
						this.children = {};
						this.childrenElems = {};
						this.flow = flow;
						
						for (var i = 0, len = children.length; i < len; i++) this.addView(children[i]);
					},
					getChildWrapper: function() {
						/*
						Returns the element to which children can be directly added
						*/
						return this.elem;
					},
					getChildContainer: function(view) {
						return ({
							block:	function() { return new E('<div class="child ' + view.name + '"></div>'); },
							inline:	function() { return new E('<span class="child ' + view.name + '"></span>'); },
						})[this.flow]();
					},
					$provideContainer: function(view) {
						/*
						Creates and attaches a container for the provided element.
						*/
						
						// Try to reuse a pre-existing container
						if (view.name in this.childrenElems) return ensurePromise(this.childrenElems[view.name]);
						
						// Otherwise create and contain a new container
						var container = this.childrenElems[view.name] = this.getChildContainer(view);
						this.getChildWrapper().append(container);
						return ensurePromise(container);
					},
					orderChildren: function(compareFunc) {
						var data = [];
						for (var k in this.childrenElems) {
							var elem = this.children[k];
							elem.__childContainer = this.childrenElems[k];
							elem.__childContainer.remove();
							data.push(elem);
						}
						
						data.sort(compareFunc);
						
						var wrapper = this.getChildWrapper();
						for (var i = 0, len = data.length; i < len; i++) {
							wrapper.append(data[i].__childContainer);
							delete data[i].__childContainer;
						}
						
						return data;
					},
					addView: function(view) {
						if (view.par !== null) throw new Error('Tried to add view which already has parent');
						if (view.name in this.children) throw new Error('Tried to add "' + view.name + '" multiple times');
						
						this.children[view.name] = view;
						view.par = this;
					},
					remView: function(name) {
						/*
						`childName` can be either a string or a View
						*/
						if (U.isInstance(name, uf.View)) name = name.name;
						
						if (!(name in this.children)) return false;
						
						var ret = this.children[name];
						delete this.children[name];
						ret.par = null;
						
						this.childrenElems[name].remove();
						delete this.childrenElems[name];
						
						return ret;
					},
					doChildrenUpdates: function() {
						return true;
					},
					$startRender: function() {
						
						return new P({ args: [ this, sc.$startRender.call(this) ] })
							.then(function(pass) {
								
								return pass.doChildrenUpdates()
									? new P({ all: pass.children.map(function(child) {	return child.$startRender(); }) })
									: $null;
								
							});
					},
					ceaseRender: function() {
						for (var k in this.children) this.children[k].ceaseRender();
						sc.ceaseRender.call(this);
					},
					$createElem: function() {
						return ensurePromise(new E('<div class="setView"></div>'));
					},
					$updateElem: function() {
						return this.doChildrenUpdates()
							? new P({ all: this.children.map(function(child) { return child.$updateElem();	})})
							: $null;
					}
				}; }
			}),
			TabView: U.makeClass({ name: 'TabView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, children, flow, getTabDoss */) {
						sc.init.call(this, params);
						
						this.getTabDoss = U.param(params, 'getTabDoss'); // A method which takes a view and returns a `Dossier`
						
						this.activeTab = null;
						this.activeContainer = null;
						this.activeElem = null;
					},
					getChildWrapper: function() {
						return this.elem.find('.children');
					},
					$provideContainer: function(view) {
						/*
						When a `TabView` provides a container, it also adds a tab to
						access it.
						*/
						
						return new P({ args: [ this, this.$getDoss(this.getTabDoss(view)) ] })
							.then(function(pass, tabDoss) {
								var tab = new E('<div class="tab ' + view.name + '">' + tabDoss.value + '</div>');
								tab.handle('click', function() { pass.setActiveView(view); });
								pass.elem.find('.tabs').append(tab);
								return pass;
							})
							.then(function(pass) {
								return sc.$provideContainer.call(pass, view)
							});
					},
					setActiveView: function(view) {
						/*
						This method just alters classnames to correctly mark the active
						container and tab.
						
						TODO: Consider doing the actual dom changes in $updateElem,
						and only changing the doss here
						*/
						if (view === this.activeElem) return;
						
						if (this.activeTab) {
							this.activeTab.listAttr({ class: [ '-active' ] });
							this.activeContainer.listAttr({ class: [ '-active' ] });
						}
						
						this.activeElem = view;
						
						if (this.activeElem) {
							this.activeTab = this.elem.find('.tabs > .tab.' + this.activeElem.name);
							this.activeTab.listAttr({ class: [ '+active' ] });
							
							this.activeContainer = this.elem.find('.children > .child.' + this.activeElem.name);
							this.activeContainer.listAttr({ class: [ '+active' ] });
						}
					},
					// TODO: `orderChildren` needs to be overridden here (need to reorder tabs too)
					$createElem: function() {
						return ensurePromise(new E([
							'<div class="tabView">',
								'<div class="tabs"></div>',
								'<div class="children"></div>',
							'</div>'
						].join('')));
					},
					$updateElem: function() {
						// If no active elem, set 1st child active
						if (!this.activeElem && !U.isEmptyObj(this.children))
							this.setActiveView(U.firstVal(this.children));
						
						return this.activeElem
							? this.activeElem.$updateElem()
							: $null;
					}
				}; }
			}),
			RootView: U.makeClass({ name: 'RootView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, children, doss, rootElem */) {
						var rootElem = U.param(params, 'elem');
						
						sc.init.call(this, params);
						this.rootElem = PACK.e.e(rootElem);
						this.interval = null;
					},
					$startRender: function() {
						var pass = this;
						
						var p2 = sc.$startRender.call(this).then(function(v) { return v; });
						
						return new P({ args: [ this, p2 ] })
							.then(function(pass) {
								
								var updateFunc = function() { pass.$updateElem().done(); };
								updateFunc();	// Call immediately...
								pass.interval = setInterval(updateFunc, 1000); // And then once per second
								
							});
						
					},
					$getContainer: function() { return $null; },
					$createElem: function() {
						// RootView is the one class that doesn't actually "create" an elem
						this.rootElem.listAttr({ class: [ '+rootView' ] });
						return ensurePromise(this.rootElem);
					}
				}; }
			}),
			
			ConditionView: U.makeClass({ name: 'ConditionView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, doss, condition, children */) {
						sc.init.call(this, params);
						this.condition = U.param(params, 'condition');
						this.currentView = null;
					},
					doChildrenUpdates: function() {
						// Turn of `SetView` children updates; this
						// class will manually perform updates on
						// children
						return false;
					},
					$provideContainer: function(view) {
						return ensurePromise(this.elem);
					},
					$createElem: function() {
						return ensurePromise(new E('<div class="conditionView"></div>'));
					},
					$updateElem: function() {
						
						var nextName = this.condition();
						if (!(nextName in this.children)) throw new Error('Invalid conditional name "' + nextName + '"');
						var nextView = this.children[nextName];
						
						if (nextView !== this.currentView) {
							
							// `this.currentView` may be `null` if it's the first call to `$updateElem`
							if (this.currentView !== null) this.currentView.ceaseRender();
							this.currentView = nextView;
							var $update = this.currentView.$startRender();
							
						} else {
							
							var $update = $null;
							
						}
						
						var pass = this;
						return $update.then(function() { pass.currentView.$updateElem(); });
						
					}
					
				}; }
			}),
			
			ValueView: U.makeClass({ name: 'ValueView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, doss, editable */) {
						sc.init.call(this, params);
						this.editable = U.param(params, 'editable', true);
					},
					$appValue: function(v) {
						return this.$getDoss().then(function(doss) {
							return U.exists(v) ? doss.value = v : doss.value;
						});
					}
				}; }
			}),
			TextView: U.makeClass({ name: 'TextView', namespace: namespace,
				superclassName: 'ValueView',
				methods: function(sc, c) { return {
					init: function(params /* name, doss */) {
						sc.init.call(this, params);
					},
					$createElem: function() {
						return this.$appValue().then(function(val) {
							return new E('<span class="stringView">' + val + '</span>');
						});
					},
					$updateElem: function() {
						if (!this.elem) throw new Error(this.getAddress() + ' has no elem');
						
						var pass = this;
						var input = this.elem.find('input');
						var currentlyEditable = !input.empty();
						
						if (this.editable !== currentlyEditable) {
							if (currentlyEditable) { 	// Set to editable, but shouldn't be
								input.remove();
							} else {									// Set to uneditable, but shouldn't be
								input = new E('<input type="text"/>');
								input.fieldValue(this.elem.text());
								this.elem.clear();
								this.elem.append(input);
							}
						}
						
						// Update either the field or the value
						var $val = this.editable
							? this.$appValue(input.fieldValue())
							: this.$appValue().then(function(val) { pass.elem.text(val); return val; });
						
						return $val.then(function(val) {
							pass.elem.listAttr({ class: [
								(!val.length ? '+' : '-') + 'empty',
								(pass.editable ? '+' : '-') + 'editable'
							]});
						});
						
					}
				}; }
			}),
			FieldView: U.makeClass({ name: 'FieldView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, doss, field, titleDoss */) {
						sc.init.call(this, params);
						this.field = U.param(params, 'field');
						this.titleDoss = U.param(params, 'titleDoss');
					},
					$provideContainer: function(view) {
						return ensurePromise(this.elem.find('.field'));
					},
					$startRender: function() {
						var pass = this;
						return sc.$startRender.call(this).then(function() {
							return pass.field.$startRender();
						});
					},
					$createElem: function() {
						return ensurePromise(new E([
							'<div class="fieldView">',
								'<div class="title"></div>',
								'<div class="field"></div>',
							'</div>'
						].join('')));
					},
					$updateElem: function() {
						var pass = this;
						return this.$getDoss(this.titleDoss)
							.then(function(doss) {
								pass.elem.find('.title').text(doss.value);
							});
					}
				}; }
			}),
			ActionView: U.makeClass({ name: 'ActionView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, doss, titleDoss, action */) {
						sc.init.call(this, params);
						this.titleDoss = U.param(params, 'titleDoss');
						this.action = U.param(params, 'action'); // Function which is called when the action occurs
					},
					$createElem: function() {
						return new P({ args: [ this, this.$getDoss(this.titleDoss) ] })
							.then(function(pass, doss) {
								var elem = new E('<button type="button" class="actionView">' + doss.value + '</button>')
								elem.handle('click', function() { pass.action(pass); });
								return elem;
							});
					},
					$updateElem: function() {
						return $null;
					}
				}; }
			}),
		
			// TODO: This class would possibly benefit from using a <canvas>
			GenGraphView: U.makeClass({ name: 'GenGraphView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* genView, associationData, $initialDoss */) {
						
						this.genView = U.param(params, 'genView');
						this.associationData = U.param(params, 'associationData');
						this.$initialDoss = U.param(params, '$initialDoss');
						
						sc.init.call(this, params);
					},
					generateNodeView: function(doss) {
						var view = this.genView(doss);
						this.addView(view);
						
						view.addView(new uf.SetView({ name: 'controls', children: [
							
							new uf.SetView({ name: 'associations', 
								children: this.associationData.map(function(data) {
									return new uf.ActionView({ name: data.name,
										titleDoss: data.titleDoss,
										action: function(view) {
											// par reverse-order: associations, controls, graph-node
											var graphNode = view.par.par.par;
											
											// HEEERE TODO: Clicking the links to follow blows up the server!!
											data.$follow(doss).then(function(associatedDossSet) {
												console.log('HA', associatedDossSet);
											});
										}
									});
								}
							)}),
							
							/*new uf.ActionView({ name: 'delete',
								titleDoss: null,
								action: function(view) {
									console
								}
							})*/
							
						]}));
						
						return view;
					},
					getChildWrapper: function() {
						return this.elem.find('.children');
					},
					getChildContainer: function(view) {
						var ret = new E([
							'<div class="graphNode">',
							'</div>'
						].join(''));
						
						// TODO: Add controls to focus clicked graphNodes
						// Focussing should decorate the `.genGraphView > .controls`
						// element with the focussed view's controls
						
						return ret;
					},
					$addDoss: function(doss, association, doss2) {
						var pass = this;
						var $doss = ensurePromise(doss);
						var $startView = $doss.then(function(doss) {
							return pass.generateNodeView(doss).$startRender();
						});
						
						if (!U.exists(association)) return $doss;
						
						return new P({ args: [ $doss, association, doss2, $startView ] })
							.then(function(doss1, association, doss2) {
								if (!U.exists(doss2)) throw new Error('If providing association need to also provide 2nd Dossier');
								
								console.log('Associating', doss1.getAddress(), 'and', doss2.getAddress());
								
								return doss1;
							});
					},
					$createElem: function() {
						return ensurePromise(new E([
							'<div class="genGraphView">',
								'<div class="children"></div>',
								'<div class="controls"></div>',
							'</div>'
						].join('')));
					},
					$updateElem: function() {
							
						var $update = U.isEmpty(this.children)
							? this.$addDoss(this.$initialDoss)
							: $null;
						
						var pass = this;
						return $update.then(function() {
							return sc.$updateElem.call(pass);
						});
						
					}
				};}
			})
		});
		
		return uf;
	}
});
package.build();
