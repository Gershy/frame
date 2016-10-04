var package = new PACK.pack.Package({ name: 'e',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		var namespace = {};
		
		return {
			e: function(elems) {
				// Ensures that elems is an instance of E. If it's already an E,
				// does nothing.
				return elems instanceof PACK.e.E ? elems : new PACK.e.E(elems);
			},
			E: PACK.uth.makeClass({ name: 'E', namespace: namespace,
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
						else 								elems = U.arr(elems);
						
						this.elems = elems;
					},
					append: function(e) {
						if (e.constructor === Array) {
							for (var i = 0, len = e.length; i < len; i++) this.append(e[i]);
							return this.elems.slice(this.elems.length - e.length);
						}
						
						if (this.elems.length === 0) throw 'can\'t append to empty e';
						
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
						
						console.log(p);
						
						p.insertBefore(e.elems[0], p.children[0]);
						
						//var p = c.parentNode;
						//p.insertBefore(e.elems[0], p.children[0]);
					},
					children: function() {
						if (this.elems.length === 0) return new PACK.e.e([]);
						return new PACK.e.e(this.elems[0].children);
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
					text: function(v) {
						if (this.elems.length === 0) return '';
						
						if (U.exists(v)) this.elems[0].innerHTML = v;
						else return this.elems[0].innerHTML;
					},
					
					fieldValue: function(v) {
						if (U.exists(v)) {
							this.elems[0].value = v;
						} else {
							return this.elems[0].value;
						}
					},
					
					find: function(query) {
						for (var i = 0, len = this.elems.length; i < len; i++) {
							var e = this.elems[i].querySelector(query);
							if (e !== null) return new PACK.e.e(e);
						}
						return PACK.e.e([]);
					},
					
					handle: function(events, func) {
						if (events.constructor !== Array) events = [ events ];
						
						this.elems.forEach(function(elem) {
							events.forEach(function(eventName) {
								elem['on' + eventName] = function(e) { func(new PACK.e.E(elem), e); };
							});
						});
					},
					attr: function(attrs /* { "name": "value", ... } */) {
						this.elems.forEach(function(elem) {
							for (var k in attrs) elem.setAttribute(k, attrs[k]);
						});
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
			
			Scene: PACK.uth.makeClass({ name: 'Scene', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, start, end, subscenes, defaultScene */) {
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
						this.start = U.param(params, 'start', null);
						this.end = U.param(params, 'end', null);
						this.defaultScenes = U.param(params, 'defaultScenes', {});
						this.subscenes = U.param(params, 'subscenes', {});
						
						var pass = this;
						this.subscenes.forEach(function(sceneList, wrapperName, obj) {
							var sceneObj = {};
							sceneList.forEach(function(scene) {
								sceneObj[scene.name] = scene;
								scene.par = pass;
							});
							obj[wrapperName] = sceneObj;
						});
						
						this.active = false;
						this.wrappers = {};
						this.elems = {};
						this.par = null;
					},
					setSubscene: function(wrapperName, subsceneName) {
						if (!(wrapperName in this.wrappers)) throw new Error('Cannot set subscenes before generating wrapper "' + wrapperName + '"');
						
						var next = this.subscenes[wrapperName][subsceneName];
						if (next !== null && next.active) return;
						
						var sceneList = this.subscenes[wrapperName];
						var active = null;
						for (var k in sceneList) if (sceneList[k].active) { active = sceneList[k]; break; }
						
						if (active) {
							if (active.end) active.end(active.elems);
							active.active = false;
						}
						
						var wrapper = this.wrappers[wrapperName];
						wrapper.clear();
						
						if (next !== null) {
							wrapper.append(next.getHtml());
							
							if (next.start) next.start(next.elems);
							next.active = true;
						}
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
							
							// TODO: Consider reusing wrappers? (Or is that a bad idea lol)
							pass.wrappers[wrapperName] = subsceneElem.append('<div class="content"></div>');
							
							sceneList.forEach(function(scene) {
								var tab = tabs.append('<div class="tab">' + scene.title + '</div>');
								tab.listAttr({ class: scene.name });
								
								tab.handle('click', function(elem, e) {
									pass.setSubscene(wrapperName, scene.name);
								});
							});
							
							subsceneObj[wrapperName] = subsceneElem;
						});
						
						// TODO: how to access useful?
						this.elems = this.build(sceneElem, subsceneObj, this);
						
						for (var k in this.defaultScenes) {
							this.setSubscene(k, this.defaultScenes[k]);
						}
						
						/*if (this.defaultScene) {
							var s = this.defaultScene.split('/');
							this.setSubscene(s[0], s[1]);
						}*/
						
						return sceneElem;
					}
				}; }
			}),
			RootScene: PACK.uth.makeClass({ name: 'RootScene', namespace: namespace,
				superclassName: 'Scene',
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, subscenes, defaultScenes */) {
						sc.init.call(this, params);
						
						this.active = true;
					},
					go: function() {
						PACK.e.e('body').append(this.getHtml());
					}
				}; }
			}),
			
			ListUpdater: PACK.uth.makeClass({ name: 'ListUpdater', namespace: namespace,
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
			
			FormBuilder: PACK.uth.makeClass({ name: 'FormBuilder', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* buildWidget */) {
						this.buildWidget = U.param(params, 'buildWidget', function(widgetData) {
							
							var schema = new PACK.quickDev.QSchema(widgetData);
							var qElem = schema.actualize();
							
							var container = PACK.e.e('<div></div>');
							
							if (qElem instanceof PACK.quickDev.QString) {
								
								if (qElem.maxLen !== null && qElem.maxLen <= 50) {
									
									var widget = PACK.e.e('<input type="text"/>');
									
								} else {
									
									console.log(qElem.maxLen);
									var widget = PACK.e.e('<textarea></textarea>');
									
								}
								
								if (qElem.minLen !== null) {
									container.append('<span class="min">' + qElem.minLen + '</span>');
									widget.attr({ minLength: qElem.minLen });
								}
								if (qElem.maxLen !== null) {
									container.append('<span class="max">' + qElem.maxLen + '</span>');
									widget.attr({ maxLength: qElem.maxLen });
								}
								
								container.append(widget);
								
								if (qElem.minLen !== null) {
									//container.prepend('<span class="min">' + qElem.minLen + '</span>');
									//container.find('input').attr({ min: qElem.minLen });
									container.attr({ minlength: qElem.minLen });
								}
								if (qElem.maxLen !== null) {
									//container.prepend('<span class="max">' + qElem.maxLen + '</span>');
									//container.find('input').attr({ max: qElem.maxLen });
									container.attr({ maxlength: qElem.maxLen });
								}
								
							} else if (qElem instanceof PACK.quickDev.QInt) {
								
								var widget = container.append('<input type="number"/>');
								
							} else {
								
								throw new Error('Unhandled data type: "' + qElem.constructor.title + '"');
								
							}/*else if (qElem instanceof PACK.quickDev.QRef) {
								
								// TODO: This should be cool
								
							}*/
							
							return {
								container: container,
								widget: widget
							};
						});
					},
					build: function(params /* formData, containers, makeContainer */) {
						
						var formData = U.param(params, 'formData');
						var containers = U.param(params, 'containers', {});
						var makeContainer = U.param(params, 'makeContainer', null);
						
						var collectedInputs = {};
						
						for (var k in formData) {
							/*
							Three categories of elements here:
							"container": Contains everything, the widget, its container, the label, etc.
							"widgetContainer": Contains the widget. E.g. stores chars-left indicator for text fields
							"widget": The actual html widget which provides the "value" property that has meaning
							*/
							var container = k in containers ? containers[k] : (makeContainer ? makeContainer(formData[k]) : null);
							if (container === null) continue;
							
							var builtHtml = this.buildWidget(formData[k]);
							if (builtHtml === null) {
								var widget = PACK.e.e('<input type="text"/>');
								var widgetContainer = widget;
							} else {
								var widget = builtHtml.widget;
								var widgetContainer = builtHtml.container;
							}
							
							widget.listAttr({ class: [ '+widget' ] });
							
							// Replace the widget-container part of container
							widgetContainer.listAttr({ class: [ '+widget-container' ] });
							widgetContainer.replaceElement(container.find('.widget-container'));
							
							// Reset the classes on the the container
							container.attr({ class: '' });
							container.listAttr({ class: [ '+input-field', '+' + k ] });
							
							collectedInputs[k] = {
								data: formData[k],
								widget: widget
							};
						}
						
						return function() {
							console.log('OMG HERE WE GOOOO', arguments);
						};
					}
				};}
			}),
			
		};
	}
});
package.build();
