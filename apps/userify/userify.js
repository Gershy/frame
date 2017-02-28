var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'quickDev', 'e', 'p' ],
	buildFunc: function() {
		var namespace = {};
		
		var ensurePromise = function(val) {
			return U.isInstance(val, PACK.p.P) ? val : new PACK.p.P({ val: val });
		};
		var $null = ensurePromise(null);
		var P = PACK.p.P;
		var E = PACK.e.E;
		
		return {
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
						if (U.isInstance(name, PACK.userify.View)) name = name.name;
						
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
						
						view.addView(new PACK.userify.SetView({ name: 'controls', children: [
							
							new PACK.userify.SetView({ name: 'associations', 
								children: this.associationData.map(function(data) {
									return new PACK.userify.ActionView({ name: data.name,
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
							
							/*new PACK.userify.ActionView({ name: 'delete',
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
		};
	}
});
package.build();
