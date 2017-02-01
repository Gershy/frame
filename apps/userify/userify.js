var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'quickDev', 'e' ],
	buildFunc: function() {
		var namespace = {};
		
		return {
			View: U.makeClass({ name: 'View', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, appData */) {
						this.name = U.param(params, 'name');
						this.appData = U.param(params, 'appData', '');
						this.par = null;
						this.elem = null;
					},
					getAppData: function(address) {
						// Supplying a QElem for `address` simply returns that QElem
						if (U.exists(address) && address.constructor !== String) return address;
						
						if (this.appData.constructor === String) {
							if (!this.par) throw new Error('View has no parent or appData');
							this.appData = this.par.getAppData().getChild(this.appData);
						}
						
						return U.exists(address) ? this.appData.getChild(address) : this.appData;
					},
					startRender: function() {
						if (this.elem !== null) throw new Error('`startRender` called while already rendering');
						this.elem = this.createElem();
						this.elem.listAttr({ class: [ '+name-' + this.name  ] });
						
						var cont = this.getContainer();
						
						if (cont) cont.append(this.elem);
					},
					ceaseRender: function() {
						if (this.elem === null) throw new Error('`ceaseRender` called while not rendering');
						this.elem.remove();
						this.elem = null;
					},
					getContainer: function() {
						if (this.par !== null) return this.par.provideContainer(this);
						return null;
					},
					createElem: function() { throw new Error('not implemented'); },
					updateElem: function() { throw new Error('not implemented'); }
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
						
						for (var i = 0, len = children.length; i < len; i++) this.addChild(children[i]);
					},
					getChildWrapper: function() {
						/*
						Returns the element to which children can be directly added
						*/
						return this.elem;
					},
					getChildContainer: function(elem) {
						return ({
							block:	function() { return new PACK.e.E('<div class="child ' + elem.name + '"></div>'); },
							inline:	function() { return new PACK.e.E('<span class="child ' + elem.name + '"></span>'); },
						})[this.flow]();
					},
					provideContainer: function(elem) {
						/*
						Creates and attaches a container for the provided element.
						*/
						if (elem.name in this.childrenElems) return this.childrenElems[elem.name];
						
						var container = this.childrenElems[elem.name] = this.getChildContainer(elem);
						this.getChildWrapper().append(container);
						return container;
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
					addChild: function(child) {
						if (child.par !== null) throw new Error('Tried to add child which already has parent');
						if (child.name in this.children) throw new Error('Tried to add "' + child.name + '" multiple times');
						
						this.children[child.name] = child;
						child.par = this;
					},
					remChild: function(childName) {
						/*
						`childName` can be either a string or a View
						*/
						if (childName.constructor !== String) childName = childName.name;
						
						if (!(name in this.children)) return false;
						
						var ret = this.children[name];
						delete this.children[name];
						ret.par = null;
						
						this.childrenElems[name].remove();
						delete this.childrenElems[name];
						
						return ret;
					},
					doChildrenUpdates: function() { return true; },
					startRender: function() {
						sc.startRender.call(this);
						if (this.doChildrenUpdates()) for (var k in this.children) this.children[k].startRender();
					},
					ceaseRender: function() {
						for (var k in this.children) this.children[k].ceaseRender();
						sc.ceaseRender.call(this);
					},
					createElem: function() {
						return new PACK.e.E('<div class="setView"></div>');
					},
					updateElem: function() {
						if (this.doChildrenUpdates()) for (var k in this.children) this.children[k].updateElem();
					}
				}; }
			}),
			TabView: U.makeClass({ name: 'TabView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, children, flow, getTabAppData */) {
						sc.init.call(this, params);
						this.getTabAppData = U.param(params, 'getTabAppData');
						this.activeTab = null;
						this.activeContainer = null;
						this.activeElem = null;
					},
					getChildWrapper: function() {
						return this.elem.find('.children');
					},
					provideContainer: function(elem) {
						/*
						When a `TabView` provides a container, it adds a tab to
						access it.
						*/
						var pass = this;
						var tabAppData = this.getAppData(this.getTabAppData(elem));
						var tab = new PACK.e.E('<div class="tab ' + elem.name + '">' + tabAppData.value + '</div>');
						var container = sc.provideContainer.call(this, elem);
						
						tab.handle('click', function() { pass.setActiveElem(elem); });
						this.elem.find('.tabs').append(tab);
						
						return container;
					},
					setActiveElem: function(elem) {
						// TODO: Consider doing the actual dom changes in updateElem,
						// and only changing the appData here
						if (elem === this.activeElem) return;
						
						if (this.activeTab) {
							this.activeTab.listAttr({ class: [ '-active' ] });
							this.activeContainer.listAttr({ class: [ '-active' ] });
						}
						
						this.activeElem = elem;
						
						if (this.activeElem) {
							this.activeTab = this.elem.find('.tabs > .tab.' + this.activeElem.name);
							this.activeTab.listAttr({ class: [ '+active' ] });
							
							this.activeContainer = this.elem.find('.children > .child.' + this.activeElem.name);
							this.activeContainer.listAttr({ class: [ '+active' ] });
						}
					},
					// TODO: `orderChildren` needs to be overridden here (need to reorder tabs too)
					createElem: function() {
						return new PACK.e.E([
							'<div class="tabView">',
								'<div class="tabs"></div>',
								'<div class="children"></div>',
							'</div>'
						].join(''));
					},
					updateElem: function() {
						if (this.activeElem === null && !U.isEmptyObj(this.children))
							this.setActiveElem(U.firstVal(this.children));
						
						if (this.activeElem) this.activeElem.updateElem();
					}
				}; }
			}),
			RootView: U.makeClass({ name: 'RootView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, children, appData, rootElem */) {
						var rootElem = U.param(params, 'elem');
						
						sc.init.call(this, params);
						this.rootElem = PACK.e.e(rootElem);
						this.updateInterval = null;
					},
					startRender: function() {
						sc.startRender.call(this);
						
						var pass = this;
						var updateFunc = function() {
							pass.updateElem();
						};
						
						updateFunc();
						this.updateInterval = setInterval(updateFunc, 1000);
					},
					getContainer: function() { return null; },
					createElem: function() {
						// RootView is the one class that doesn't actually "create" an elem
						this.rootElem.listAttr({ class: [ '+rootView' ] });
						return this.rootElem;
					}
				}; }
			}),
			
			ConditionView: U.makeClass({ name: 'ConditionView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, condition, children */) {
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
					provideContainer: function(elem) {
						return this.elem;
					},
					createElem: function() {
						return new PACK.e.E('<div class="conditionView"></div>');
					},
					updateElem: function() {
						var nextName = this.condition();
						if (!(nextName in this.children)) throw new Error('Invalid conditional name "' + nextName + '"');
						var nextView = this.children[nextName];
						
						if (nextView !== this.currentView) {
							// `this.currentView` may be `null` if it's the first call to `updateElem`
							if (this.currentView !== null) {
								this.currentView.ceaseRender();
							}
							this.currentView = nextView;
							this.currentView.startRender();
						}
						
						this.currentView.updateElem();
					}
					
				}; }
			}),
			
			ValueView: U.makeClass({ name: 'ValueView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, editable */) {
						sc.init.call(this, params);
						this.editable = U.param(params, 'editable', true);
					},
					appValue: function(v) {
						if (U.exists(v)) 	this.getAppData().value = v;
						else 				return this.getAppData().value;
					}
				}; }
			}),
			TextView: U.makeClass({ name: 'TextView', namespace: namespace,
				superclassName: 'ValueView',
				methods: function(sc, c) { return {
					init: function(params /* name, appData */) {
						sc.init.call(this, params);
					},
					createElem: function() {
						var ret = new PACK.e.E([
							'<span class="stringView">',
								this.appValue(),
							'</span>'
						].join(''));
						
						return ret;
					},
					updateElem: function() {
						var input = this.elem.find('input');
						var currentlyEditable = !input.empty();
						
						if (this.editable !== currentlyEditable) {
							if (currentlyEditable) { // Set to editable, but shouldn't be
								input.remove();
							} else {
								input = new PACK.e.E('<input type="text"/>');
								input.fieldValue(this.elem.text());
								this.elem.clear();
								this.elem.append(input);
							}
						}
						
						// Either the appData becomes the entered value, or vice-versa;
						
						// Set the app value to reflect the value of the input
						if (this.editable) 	this.appValue(this.elem.find('input').fieldValue());
						// Set the span text to reflect the app value
						else 				this.elem.text(this.appValue());
						
						var isEmpty = this.appValue().length === 0;
						this.elem.listAttr({ class: [
							(isEmpty ? '+' : '-') + 'empty',
							(this.editable ? '+' : '-') + 'editable'
						]});
					}
				}; }
			}),
			FieldView: U.makeClass({ name: 'FieldView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, field, titleAppData */) {
						sc.init.call(this, params);
						this.field = U.param(params, 'field');
						this.titleAppData = U.param(params, 'titleAppData');
					},
					provideContainer: function(elem) {
						return this.elem.find('.field');
					},
					startRender: function() {
						sc.startRender.call(this);
						this.field.startRender();
					},
					createElem: function() {
						return new PACK.e.E([
							'<div class="fieldView">',
								'<div class="title"></div>',
								'<div class="field"></div>',
							'</div>'
						].join(''));
					},
					updateElem: function() {
						this.elem.find('.title').text(this.getAppData(this.titleAppData).value);
					}
				}; }
			}),
			ActionView: U.makeClass({ name: 'ActionView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, titleAppData, action */) {
						sc.init.call(this, params);
						this.titleAppData = U.param(params, 'titleAppData');
						this.action = U.param(params, 'action');
					},
					createElem: function() {
						var title = this.getAppData(this.titleAppData).value;
						var ret = new PACK.e.E('<button type="button" class="actionView">' + title + '</button>');
						ret.handle('click', this.action.bind(null, this));
						return ret;
					},
					updateElem: function() {
						
					}
				}; }
			}),
		
			// TODO: This class would possibly benefit from using a <canvas>
			GenGraphView: U.makeClass({ name: 'GenGraphView', namespace: namespace,
				superclassName: 'SetView',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						
						this.decorateView = U.param(params, 'decorateView');
						this.followLinks = U.param(params, 'followLinks');
						
						this.children = {};
					},
					getChildWrapper: function() {
						return this.elem.find('.children');
					},
					getChildContainer: function(elem) {
						var ret = new PACK.e.E('<div class="graphNode"></div>');
						// TODO: Add controls to focus clicked graphNodes
						// Focussing should decorate the `.genGraphView > .controls`
						// element with the focussed view's controls
						return ret;
					},
					createElem: function() {
						return new PACK.e.E([
							'<div class="genGraphView">',
								'<div class="children"></div>',
								'<div class="controls"></div>',
							'</div>'
						].join(''));
					},
					updateElem: function() {
						
					}
				};}
			})
		};
	}
});
package.build();
	
