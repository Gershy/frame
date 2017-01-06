var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'uth', 'quickDev', 'e' ],
	buildFunc: function() {
		var namespace = {};
		
		return {
			View: PACK.uth.makeClass({ name: 'View', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, appData */) {
						this.name = U.param(params, 'name');
						this.appData = U.param(params, 'appData', '');
						this.par = null;
						this.elem = null;
					},
					getAppData: function() {
						if (this.appData.constructor === String) return this.par
							? this.par.getAppData().getChild(this.appData)
							: null;
						
						return this.appData;
					},
					startRender: function() {
						if (this.elem !== null) throw new Error('`startRender` called while already rendering');
						this.elem = this.createElem();
						
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
			SetView: PACK.uth.makeClass({ name: 'SetView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, children, flow */) {
						var children = U.param(params, 'children', []);
						var flow = U.param(params, 'flow', 'block');
						
						sc.init.call(this, params);
						this.flow = flow;
						this.children = {};
						this.childrenElems = {};
						
						for (var i = 0, len = children.length; i < len; i++) this.addChild(children[i]);
					},
					provideContainer: function(elem) {
						if (elem.name in this.childrenElems) return this.childrenElems[elem.name];
						
						var container = ({
							block:	function() { return new PACK.e.E('<div class="child ' + elem.name + '"></div>'); },
							inline:	function() { return new PACK.e.E('<span class="child ' + elem.name + '"></span>'); },
						})[this.flow]();
						
						this.elem.append(container);
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
						
						for (var i = 0, len = data.length; i < len; i++) {
							this.elem.append(data[i].__childContainer);
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
					startRender: function() {
						sc.startRender.call(this);
						for (var k in this.children) this.children[k].startRender();
					},
					ceaseRender: function() {
						for (var k in this.children) this.children[k].ceaseRender();
						sc.ceaseRender.call(this);
					},
					createElem: function() {
						return new PACK.e.E('<div class="setView"></div>');
					},
					updateElem: function() {
						for (var k in this.children) this.children[k].updateElem();
					}
				}; }
			}),
			RootView: PACK.uth.makeClass({ name: 'RootView', namespace: namespace,
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
			
			IfView: PACK.uth.makeClass({ name: 'IfView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, condition, view0, view1 */) {
						sc.init.call(this, params);
						this.condition = U.param(params, 'condition');
						this.view0 = U.param(params, 'view0');
						this.view1 = U.param(params, 'view1');
						this.currentView = null;
						
						this.view0.par = this;
						this.view1.par = this;
					},
					provideContainer: function(elem) {
						return this.elem;
					},
					createElem: function() {
						return new PACK.e.E('<div class="ifView"></div>');
					},
					updateElem: function() {
						var nextView = this.condition() ? this.view1 : this.view0;
						
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
			
			ValueView: PACK.uth.makeClass({ name: 'ValueView', namespace: namespace,
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
			StringView: PACK.uth.makeClass({ name: 'StringView', namespace: namespace,
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
					}
				}; }
			}),
			ActionView: PACK.uth.makeClass({ name: 'ActionView', namespace: namespace,
				superclassName: 'View',
				methods: function(sc, c) { return {
					init: function(params /* name, appData, title, action */) {
						sc.init.call(this, params);
						this.title = U.param(params, 'title');
						this.action = U.param(params, 'action');
					},
					createElem: function() {
						var ret = new PACK.e.E('<button type="button" class="actionView">' + this.title + '</button>');
						ret.handle('click', this.action);
						return ret;
					},
					updateElem: function() {
						
					}
				}; }
			})
				
		};
	}
});
package.build();
	
