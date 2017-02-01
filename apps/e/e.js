var package = new PACK.pack.Package({ name: 'e',
	dependencies: [ ],
	buildFunc: function() {
		var namespace = {};
		
		return {
			e: function(elems) {
				// Ensures that elems is an instance of E. If it's already an E,
				// does nothing.
				return elems instanceof PACK.e.E ? elems : new PACK.e.E(elems);
			},
			E: U.makeClass({ name: 'E', namespace: namespace,
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(elems) {
						/*
						Accepts a parameter with 5 possible formats.
						
						1)	Some collection of html elements
						2)	A single html element
						3)	A string indicating a new html element to be constructed
							(A string beginning with "<")
						4) 	A dom query to select the first match (any string not
							beginning with "<")
						5)	A dom query to select all matches (same as 4, preceeded 
						 	with "+")
						*/
						if (!U.exists(elems)) throw 'missing "elems" param';
						
						if (elems.constructor === String) {
							
							var str = elems.trim();
							
							if (str[0] === '<') {
								
								var parsedHtml = new DOMParser().parseFromString(str, 'text/html').firstChild;
								
								// Check the body first, then the head
								if (parsedHtml.childNodes.length > 1 && parsedHtml.childNodes[1].childNodes.length > 0) {
									
									// The parser will put the element  if appropriate
									elems = parsedHtml.childNodes[1].childNodes;
									
								} else {
									
									// If it wasn't in the body it must be in the head
									elems = parsedHtml.childNodes[0].childNodes;
									
								}
								
								delete parsedHtml; // Dat memory cleanup
								
								/*// The string represents new elements
								elems = new DOMParser().parseFromString(str, 'text/html')
								//	 html >     body >        inner element
									.firstChild.childNodes[1].firstChild;*/
								
							} else {
								
								if (str[0] === '+') elems = document.querySelectorAll(str.substr(1));
								else 				elems = document.querySelector(str);
								
							}
							
						}
						
						// Use an array with a single element instead of the element itself
						if (elems instanceof HTMLElement) 	elems = [ elems ];
						else 								elems = U.toArray(elems);
						
						this.elems = elems;
					},
					append: function(e) {
						if (e.constructor === Array) {
							for (var i = 0, len = e.length; i < len; i++) this.append(e[i]);
							return this.elems.slice(this.elems.length - e.length);
						}
						
						if (this.elems.length === 0) throw new Error('can\'t append to empty e');
						
						var pass = this;
						e = PACK.e.e(e);
						e.elems.forEach(function(elem) { pass.elems[0].appendChild(elem) });
						
						return e;
					},
					prepend: function(e) {
						console.log('NEED TO TEST THIS!!');
						//this.append(e);
						
						e = PACK.e.e(e);
						var p = this.elems[0].parentNode;
						p.insertBefore(e.elems[0], p.children[0]);
					},
					children: function() {
						if (this.elems.length === 0) return new PACK.e.e([]);
						return new PACK.e.e(this.elems[0].children);
					},
					par: function(selector) {
						// Get the parent, ensure it exists
						var p = this.elems[0].parentNode;
						if (!p) return null;
						
						// Get the wrapped version of the parent
						var ep = new PACK.e.e(p);
						
						// If there's no selector, or the selector is matched, return parent
						if (!U.exists(selector) || p.matches(selector)) return ep;
						
						// Otherwise go deeper
						return ep.par(selector);
					},
					remove: function() {
						this.elems.forEach(function(elem) {
							elem.parentNode.removeChild(elem);
						});
					},
					replaceElement: function(elem) {
						elem = PACK.e.e(elem);
						var rep = elem.elems[0];
						rep.parentNode.replaceChild(this.elems[0], rep);
						
						return elem;
					},
					clear: function(e) {
						this.elems.forEach(function(elem) { elem.innerHTML = ''; });
					},
					parameterize: function(params /* data, delim1, delim2 */) {
						var data = U.param(params, 'data');
						var delim1 = U.param(params, 'delim1', '{{ ');
						var delim2 = U.param(params, 'delim2', ' }}');
						
						this.elems.forEach(function(elem) {
							var html = elem.innerHTML;
							for (var k in data) {
								var reg = new RegExp(delim1 + k + delim2, 'g');
								html = html.replace(reg, data[k]);
							}
							elem.innerHTML = html;
						});
					},
					text: function(v) {
						if (this.elems.length === 0) return '';
						
						if (U.exists(v)) this.elems[0].innerHTML = v;
						else return this.elems[0].innerHTML;
					},
					htmlCopy: function() {
						return PACK.e.e(this.elems[0].outerHTML);
					},
					forEach: function(it) {
						for (var i = 0, len = this.elems.length; i < len; i++) it(new PACK.e.E(this.elems[i]), i);
					},
					children: function() {
						return new PACK.e.E(this.elems[0].childNodes);
					},
					indexedChild: function(index) {
						return new PACK.e.E(this.elems[0].childNodes[index]);
					},
					
					fieldValue: function(v) {
						if (U.exists(v)) {
							this.elems[0].value = v;
							if (this.elems[0].onchange) this.elems[0].onchange();
							return null;
						} else {
							return this.elems[0].value;
						}
					},
					
					find: function(query) {
						if (query[0] === '+') {
							return new PACK.e.e(this.elems[0].querySelectorAll(query.substr(1)));
						} else {
							var e = this.elems[0].querySelector(query);
							if (e !== null) return new PACK.e.e(e);
						}
						return PACK.e.e([]);
					},
					empty: function() {
						return this.elems.length === 0;
					},
					
					handle: function(events, func) {
						if (events.constructor !== Array) events = [ events ];
						
						this.elems.forEach(function(elem) {
							var f = function(event) { func(new PACK.e.E(elem), event); }
							events.forEach(function(eventName) {
								elem['on' + eventName] = f;
							});
						});
					},
					attr: function(attrs /* { "name": "value", ... } */) {
						if (attrs.constructor === String) return this.elems[0].getAttribute(attrs);
						
						for (var i = 0, len = this.elems.length; i < len; i++) {
							for (var k in attrs) {
								if (attrs[k] !== null) 	this.elems[i].setAttribute(k, attrs[k]);
								else 					this.elems[i].removeAttribute(k);
							}
						}
					},
					hasAttr: function(name) {
						return this.elems[0].hasAttribute(name);
					},
					listAttr: function(attrs /* { "name1": [ "+value1", "-value2"... ], ... } */) {
						/*
						Used for modifying values in list-like attributes. The major
						example is the "class" attribute, which is really just a list
						of strings.
						
						Accepts a dictionary of key-values, where each value may be
						prefixed with either "+" or "-". "+" indicates that the value
						should be added to the list, while "-" indicates it should be
						removed.
						*/
						for (var i = 0, len = this.elems.length; i < len; i++) {
							
							var elem = this.elems[i];
							
							for (var k in attrs) {
								var values = attrs[k];
								if (values.constructor !== Array) values = [ values ];
								
								var att = elem.getAttribute(k);
								
								// conversion to boolean checks both null and 0-length string
								if (att)	var atts = att.split(' ');
								else 		var atts = [];
								
								for (var j = 0, vLen = values.length; j < vLen; j++) {
									var v = values[j];
									if ([ '+', '-' ].contains(v[0])) { var mode = v[0]; v = v.substr(1); }
									else  							 { var mode = '+'; }
									
									var ind = atts.indexOf(v);
									if (mode === '+' && !~ind)		{ atts.push(v); }
									else if (mode === '-' && ~ind) 	{ atts.splice(ind, 1); }
								}
								
								elem.setAttribute(k, atts.join(' '));
							}
							
						}
					},
					hasListAttr: function(attrName, value) {
						var attr = this.elems[0].getAttribute(attrName);
						if (!attr) return false;
						
						return ~attr.split(' ').indexOf(value);
					},
					dictAttr: function(attrs /* { "name1": { "attr1": "value1", "attr2": null, ... }, ... } */) {
						/*
						Maintains a list of semicolon-separated dictionary attributes,
						like this string: "v1: k1; v2: k2; v3: k3;".
						
						The most prominent usage is for css attributes, which have this
						exact format.
						*/
					},
					onEvent: function(eventName, callback) {
						this.elems.forEach(function(elem) {
							elem.addEventListener(eventName, callback, false);
						});
					},
					doEvent: function(eventName) {
						var event = new CustomEvent(eventName, { detail: '' });
						this.elems.forEach(function(e) { e.dispatchEvent(event); });
					},
					setHtml: function(html) {
						this.elems.forEach(function(e) { e.innerHTML = html; });
					}
				}; }
			}),
			
			Scene: U.makeClass({ name: 'Scene', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, onStart, onEnd, subscenes, defaultScene */) {
						/*
						name: scene name
						title: human legible name
						build: A function(rootElem, subsceneElem, scene) that adds
							html into an html node.
						subscenes: dict where each entry is a subscene name
							keyed to an array of Scene instances that can be
							displayed within this scene. The array will be
							transformed into an object using each scene's name as
							the key.
						
						Returns an object of named useful elements within the
						scene.
						
						e.g.
						
						var scene = new PACK.e.Scene({ name: 'mainScene', title: 'Main Scene!',
							build: function(rootElem, subsceneObj) {
								var main = new PACK.e.e('<div class="mainScene"></div>');
								
								main.append('<div class="title">Hello, here's da form!</div>');
								
								var fName = main.append('<input type="text" placeholder="first name"/>');
								var lName = main.append('<input type="text" placeholder="last name"/>');
								var go = main.append('<div class="button">Go!</div>');
								
								main.append(text);
								
								main.append(subsceneObj.subscene1);
								main.append(subsceneObj.subscene2);
								
								rootElem.append(main);
								
								return {
									fName: fName,
									lName: lName,
									go: go
								};
							},
							subscenes: {
								subscene1: [
									new PACK.e.Scene({ name: 'lala', title: 'La, La, La',
										build: function(rootElem, subsceneObj) {
											rootElem.append(new PACK.e.e('<div class="hello">Hello! La la la la la</div>'));
											
											return {
											};
										}
									})
								],
								subscene2: [
									new PACK.e.Scene({ name: 'lala', title: 'La, La, La',
										build: function(rootElem, subsceneObj) {
											rootElem.append(new PACK.e.e('<div class="hello">Hello! La la la la la</div>'));
											
											return {
											};
										}
									})
								]
							}
						});
						*/
						this.name = U.param(params, 'name');
						this.title = U.param(params, 'title');
						this.build = U.param(params, 'build');
						this.onStart = U.param(params, 'onStart', null);
						this.onEnd = U.param(params, 'onEnd', null);
						this.defaultScenes = U.param(params, 'defaultScenes', {});
						this.subscenes = U.param(params, 'subscenes', {});
						
						var pass = this;
						this.subscenes.forEach(function(sceneList, wrapperName, obj) {
							var sceneObj = {};
							sceneList.forEach(function(scene) {
								sceneObj[scene.name] = scene;
								scene.par = pass;
								scene.wrapperName = wrapperName;
							});
							obj[wrapperName] = sceneObj;
						});
						
						this.par = null;
						this.wrapperName = null; 	// Stores the name of the parent's wrapper in which this scene exists
						this.activeScenes = {};		// Stores the active scene for each wrapper
						this.wrapperElems = {};		// Stores the container element for each wrapper
						this.elems = {};			// Stores any data returned from this.build
					},
					isActive: function() {
						return this.par.activeScenes[this.wrapperName] === this;
					},
					getWrapper: function() {
						if (this.par === null || !(this.wrapperName in this.par.wrapperElems))
							throw new Error('Missing wrapper for "' + this.getAddress() + '"');
						
						return this.par.wrapperElems[this.wrapperName];
					},
					start: function() {
						// Attach the html
						this.getWrapper().append(this.getHtml());
						
						// Set the parent's active scene
						if (this.par) this.par.activeScenes[this.wrapperName] = this;
						
						// Run the user function
						if (this.onStart) this.onStart(this.elems);
					},
					end: function() {
						if (this.isActive()) {
							// Run the user function
							if (this.onEnd) this.onEnd(this.elems);
							
							// Remove the html
							this.getWrapper().clear();
							
							// Set the parent's active scene within the wrapper to null
							this.par.activeScenes[this.wrapperName] = null;
							
							// End any child scenes
							for (var k in this.activeScenes) {
								var scene = this.activeScenes[k];
								if (scene) scene.end();
							}
						}
					},
					setSubscene: function(wrapperName, subsceneName) {
						var oldScene = this.activeScenes[wrapperName];
						var newScene = this.subscenes[wrapperName][subsceneName];
						
						if (newScene === oldScene) return;
						
						if (oldScene) oldScene.end();
						if (newScene) newScene.start();
					},
					getHtml: function() {
						var sceneElem = new PACK.e.e('<div class="scene"></div>');
						sceneElem.listAttr({ class: this.name });
						
						var pass = this;
						var subsceneObj = {};
						this.subscenes.forEach(function(sceneList, wrapperName) {
							var subsceneElem = new PACK.e.e('<div class="list"></div>');
							subsceneElem.listAttr({ class: wrapperName });
							
							var tabs = subsceneElem.append('<div class="tabs"></div>');
							
							// TODO: Consider reusing wrapperElems? (Or is that a bad idea lol)
							pass.wrapperElems[wrapperName] = subsceneElem.append('<div class="content"></div>');
							
							sceneList.forEach(function(scene) {
								var tab = tabs.append('<div class="tab">' + scene.title + '</div>');
								tab.listAttr({ class: scene.name });
								
								tab.handle('click', function(elem, e) {
									pass.setSubscene(wrapperName, scene.name);
								});
							});
							
							subsceneObj[wrapperName] = subsceneElem;
						});
						
						this.elems = this.build(sceneElem, subsceneObj, this);
						
						for (var k in this.defaultScenes) this.setSubscene(k, this.defaultScenes[k]);
						
						return sceneElem;
					},
					getAddress: function() {
						var ret = [];
						var ptr = this;
						while (ptr !== null) {
							ret.push(this.wrapperName + ':' + this.name);
							ptr = ptr.par;
						}
						return ret.reverse().join('.');
					},
				}; }
			}),
			RootScene: U.makeClass({ name: 'RootScene', namespace: namespace,
				superclassName: 'Scene',
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, subscenes, defaultScenes */) {
						sc.init.call(this, params);
					},
					getWrapper: function() { return PACK.e.e('body'); },
					isActive: function() { return true; },
					end: function() { throw new Error('Cannot end the RootScene'); }
				}; }
			}),
			
			ListUpdater: U.makeClass({ name: 'ListUpdater', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* root, elemCreate, elemUpdate, getElemKey, getDataKey */) {
						this.root = U.param(params, 'root');
						this.elemCreate = U.param(params, 'elemCreate');
						this.elemUpdate = U.param(params, 'elemUpdate', null);
						this.getElemKey = U.param(params, 'getElemKey');
						this.getDataKey = U.param(params, 'getDataKey');
					},
					updateList: function(data) {
						var existingMap = {};
						var existingElems = this.root.children().elems;
						for (var i = 0, len = existingElems.length; i < len; i++) {
							var elem = new PACK.e.E(existingElems[i]);
							var key = this.getElemKey(elem);
							existingMap[key] = elem;
						}
						for (var i = 0, len = data.length; i < len; i++) {
							var d = data[i];
							var key = this.getDataKey(d);
							
							if (key in existingMap) {
								var elem = existingMap[key];
								delete existingMap[key];
							} else {
								var elem = this.elemCreate(d);
								this.root.append(elem);
							}
							if (this.elemUpdate) this.elemUpdate(elem, d);
						}
						existingMap.forEach(function(elem) { elem.remove(); });
					}
				};}
			}),
			
			defaultFormListeners: {
				'input-container': {
					start: function(widget, container) {},
					change: function(widget, container) {
						// Removes errors - sublisteners will reinstate them if necessary
						container.listAttr({ class: [ '-error' ] });
					}
				},
				text: {
					start: function(widget, container) {
						var min = parseInt(widget.attr('min'));
						var max = parseInt(widget.attr('max'));
						
						var count = PACK.e.e([
							'<div class="status">',
								'<div class="cur"></div>',
								'<div class="min"></div>',
							'</div>'
						].join(''));
						
						if (isNaN(min)) widget.attr({ min: null });
						if (isNaN(max)) widget.attr({ max: null });
						
						container.append(count);
					},
					change: function(widget, container) {
						var val = widget.fieldValue();
						var n = val.length;
						var min = parseInt(widget.attr('min'));
						var max = parseInt(widget.attr('max'));
						
						var goodMin = isNaN(min) || n >= min;
						var goodMax = isNaN(max) || n <= max;
						
						var cur = container.find('.status > .cur');
						cur.text(n + (isNaN(max) ? ' chars' : (' / ' + max)));
						
						if (goodMin) {
							container.find('.status > .min').listAttr({ class: [ '-show' ] });
						} else {
							container.find('.status > .min').text('(' + (min - n) + ' more chars)');
							container.find('.status > .min').listAttr({ class: [ '+show' ] });
						}
						
						if (!(goodMin && goodMax)) container.listAttr({ class: [ '+error' ] });
					}
				},
				alphanumeric: {
					start: function(widget, container) {
						container.find('.status').append('<div class="alphanumeric">Invalid characters</div>');
					},
					change: function(widget, container) {
						var val = widget.fieldValue();
						if (/^[a-zA-Z0-9]*$/.test(val)) {
							container.find('.status > .alphanumeric').listAttr({ class: [ '-show' ] });
						} else {
							container.find('.status > .alphanumeric').listAttr({ class: [ '+show' ] });
							container.listAttr({ class: [ '+error' ] });
						}
					}
				},
				number: {
					start: function(widget, container) {},
					change: function(widget, container) {
						var val = parseInt(widget.fieldValue());
						if (isNaN(val)) container.listAttr({ class: [ '+error' ] });
					},
				},
				unique: {
					start: function(widget, container) {},
					change: function(widget, container) {}
				},
				clock: {
					start: function(widget, container) {
						var clock = new PACK.clock.Clock({
							hasControls: true,
							minSeconds: widget.hasAttr('min') ? parseInt(widget.attr('min')) : 0,
							maxSeconds: widget.hasAttr('max') ? parseInt(widget.attr('max')) : 24 * 60 * 60,
							field: widget
						});
						var clockElem = widget.par().append(clock.createElem());
						clockElem.listAttr({ class: [ '+v-widget' ] });
					},
					change: function(widget, container) {
					}
				}
			},
			Form: U.makeClass({ name: 'Form', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* html, onSubmit, listeners */) {
						this.html = U.param(params, 'html');
						this.onSubmit = U.param(params, 'onSubmit');
						this.listeners = U.param(params, 'listeners', PACK.e.defaultFormListeners);
					},
					listenersFor: function(widget) {
						var listeners = [];
						var classes = widget.par('.input-container').attr('class').split(' ');
						for (var i = 0, len = classes.length; i < len; i++) {
							var cls = classes[i];
							if (cls in this.listeners) listeners.push(this.listeners[cls]);
						}
						return listeners;
					},
					validate: function(element) {
						var widget = element.find('.widget');
						var valid = true;
						if (widget.attr('type') === 'number') {
							if (isNaN(parseInt(widget.fieldValue()))) {
								valid = false;
							}
						} else if (widget.attr('type') === 'text') {
							var min = widget.attr('min');
							var nMin = parseInt(min);
							if (!isNaN(nMin) && widget.fieldValue().length < nMin) {
								valid = false;
							}
						}
						
						if (!valid) widget.listAttr({ class: [ '+error' ] });
						else 		widget.listAttr({ class: [ '-error' ] });
						
						return valid;
					},
					build: function(formData) {
						var pass = this;
						var formElem = new PACK.e.e(this.html);
						
						// Parameterize every form element
						for (var k in formData) {
							// Note all literal dots are escaped so they aren't interpreted as the class prefix
							var container = formElem.find('.input-field.' + k.replace(/\./g, '\\.'));
							if (!container) throw new Error('Missing container for field: "' + k + '"');
							
							container.parameterize({ data: formData[k] });
						}
						
						// Generate the function that will cause a widget to adhere to its
						// listener's commands
						var widgetChangeFunc = function(widget) {
							pass.listenersFor(widget).forEach(function(listener) {
								listener.change(widget, widget.par('.input-container'));
							});
						};
						
						// Apply listeners to all containers
						formElem.find('+.input-container').forEach(function(container) {
							var widget = container.find('.widget');
							if (!widget) throw new Error('Container (' + container.attr('class') + ') is missing .widget');
							widget.handle([ 'input', 'change' ], widgetChangeFunc);
							
							pass.listenersFor(widget).forEach(function(listener) {
								listener.start(widget, container);
								listener.change(widget, container);
							});
						});
						
						var submit = formElem.find('.submit');
						if (submit === null) throw new Error('No submit button in template');
						
						// Handle the submit event
						submit.handle('click', function() {
							// Check to see if there are any errors in the form
							if (formElem.find('.input-container.error').elems.length > 0) {
								if (!submit.hasListAttr('class', 'error')) {
									submit.listAttr({ class: [ '+error' ] });
									setTimeout(function() {
										submit.listAttr({ class: [ '-error' ] });
									}, 1500);
								}
								return;
							}
							
							var data = {};
							formElem.find('+.input-field').forEach(function(elem) {
								var address = elem.attr('class').replace('input-field', '').trim();
								var value = elem.find('.widget').fieldValue();
								data[address] = value;
							});
							pass.onSubmit(data);
						});
						
						return formElem;
					}
				};}
			}),
		};
	}
});
package.build();
