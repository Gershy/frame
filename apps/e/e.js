var package = new PACK.pack.Package({ name: 'e',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		return {
			e: function(elems) {
				// Ensures that elems is an instance of E. If it's already an E,
				// does nothing.
				return elems instanceof PACK.e.E ? elems : new PACK.e.E(elems);
			},
			E: PACK.uth.makeClass({ name: 'E',
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
						if (elems instanceof HTMLElement) elems = [ elems ];
						else {
							elems = U.arr(elems);
						}
						/*// Use array instead of HTMLCollection
						if (elems instanceof HTMLCollection) elems = U.arr(elems);*/
						
						this.elems = elems;
					},
					append: function(e) {
						if (this.elems.length === 0) throw 'can\'t append to empty e';
						
						var pass = this;
						e = PACK.e.e(e);
						e.elems.forEach(function(elem) { pass.elems[0].appendChild(elem) });
						
						return e;
					},
					clear: function(e) {
						this.elems.forEach(function(elem) { elem.innerHTML = ''; });
					},
					
					find: function(query) {
						for (var i = 0, len = this.elems.length; i < len; i++) {
							var e = this.elems[i].querySelector(query);
							if (e !== null) return new PACK.e.e(e);
						}
					},
					
					handle: function(event, func) {
						var eventPropName = 'on' + event;
						this.elems.forEach(function(elem) {
							elem[eventPropName] = function(e) { func(elem, e); };
						});
					},
					attr: function(attrs /* { "name": "value", ... } */) {
						this.elems.forEach(function(elem) {
							for (var k in attrs) elem.setAttribute(k, attrs[k]);
						});
					},
					listAttr: function(attrs /* { "name": "value", ... } */) {
						/*
						Used for modifying values in list-like attributes.
						The major example is the "class" attribute, which is
						really just a list of strings.
						
						Accepts a dictionary of key-values, where each value
						may be prefixed with either "+" or "-". "+" indicates
						that the value should be added to the list, while "-"
						indicates it should be removed.
						*/
						this.elems.forEach(function(elem) {
							attrs.forEach(function(v, k) {
								if (v.constructor !== Array) v = [ v ];
								
								var att = elem.getAttribute(k);
								
								// conversion to boolean checks both null and 0-length string
								if (att)	var atts = att.split(' ');
								else 		var atts = [];
								
								v.forEach(function(vv) {
									var mode = '+';
									if ([ '+', '-' ].contains(vv[0])) {
										mode = vv[0];
										vv = vv.substr(1);
									}
									
									if (mode === '+') 	atts.push(vv);
									else {
										var ind = atts.indexOf(vv);
										if (~ind) atts.splice(ind, 1);
									}
								});
								
								elem.setAttribute(k, atts.join(' '));
							});
							
						});
					},
					dictAttr: function(attrs /* { "name": { "attr1": "value1", ... }, ... } */) {
						
					},
					onEvent: function(eventName, callback) {
						this.elems.forEach(function(elem) {
							elem.addEventListener(eventName, callback, false);
						});
					},
					doEvent: function(eventName) {
						var event = new CustomEvent(eventName, { detail: '' });
						this.elems.forEach(function(e) { e.dispatchEvent(event); });
					}
				}; }
			}),
			Scene: PACK.uth.makeClass({ name: 'Scene',
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, subScenes */) {
						/*
						name: scene name
						title: human legible name
						build: A function(rootElem, subSceneElem) that adds html
							into an html node.
						subScenes: dict of subScene names to array of Scene
							instances that can be displayed	within this scene.
							The array will be transformed into an object using
							each scene's name as the key.
						
						Returns an object of named useful elements within the
						scene.
						
						e.g.
						
						var scene = new PACK.e.Scene({ name: 'mainScene', title: 'Main Scene!',
							build: function(rootElem, subSceneObj) {
								var main = new PACK.e.e('<div class="mainScene"></div>');
								
								main.append('<div class="title">Hello, here's da form!</div>');
								
								var fName = main.append('<input type="text" placeholder="first name"/>');
								var lName = main.append('<input type="text" placeholder="last name"/>');
								var go = main.append('<div class="button">Go!</div>');
								
								main.append(text);
								
								main.append(subSceneObj.subScene1);
								main.append(subSceneObj.subScene2);
								
								rootElem.append(main);
								
								return {
									fName: fName,
									lName: lName,
									go: go
								};
							},
							subScenes: {
								subScene1: [
									new PACK.e.Scene({ name: 'lala', title: 'La, La, La',
										build: function(rootElem, subSceneObj) {
											rootElem.append(new PACK.e.e('<div class="hello">Hello! La la la la la</div>'));
											
											return {
											};
										}
									})
								],
								subScene2: [
									new PACK.e.Scene({ name: 'lala', title: 'La, La, La',
										build: function(rootElem, subSceneObj) {
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
						this.defaultScene = U.param(params, 'defaultScene', null);
						this.subScenes = U.param(params, 'subScenes', {});
						
						var pass = this;
						this.subScenes.forEach(function(sceneList, wrapperName, obj) {
							var sceneObj = {};
							sceneList.forEach(function(scene) {
								sceneObj[scene.name] = scene;
								scene.par = pass;
							});
							obj[wrapperName] = sceneObj;
						});
						
						this.active = false;
						this.wrappers = {};
						this.elems = null;
						this.par = null;
					},
					setSubScene: function(wrapperName, subSceneName) {
						if (!(wrapperName in this.wrappers)) throw new Error('Cannot set subscenes before generating wrapper');
						
						var next = this.subScenes[wrapperName][subSceneName];
						if (next.active) return;
						
						var sceneList = this.subScenes[wrapperName];
						var active = null;
						for (var k in sceneList) {
							if (sceneList[k].active) {
								active = sceneList[k];
								break;
							}
						}
						
						if (active) {
							if (active.end) active.end(active.elems);
							active.active = false;
						}
						
						var wrapper = this.wrappers[wrapperName];
						wrapper.clear();
						wrapper.append(next.getHtml());
						
						if (next.start) next.start(next.elems);
						next.active = true;
					},
					getHtml: function() {
						var sceneElem = new PACK.e.e('<div class="scene"></div>');
						sceneElem.listAttr({ class: this.name });
						
						var pass = this;
						var subSceneObj = {};
						this.subScenes.forEach(function(sceneList, wrapperName) {
							var subSceneElem = new PACK.e.e('<div class="list"></div>');
							subSceneElem.listAttr({ class: wrapperName });
							
							var tabs = subSceneElem.append('<div class="tabs"></div>');
							
							// TODO: Consider reusing wrappers? (Or is that a bad idea lol)
							pass.wrappers[wrapperName] = subSceneElem.append('<div class="content"></div>');
							
							sceneList.forEach(function(scene) {
								var tab = tabs.append('<div class="tab">' + scene.title + '</div>');
								tab.listAttr({ class: scene.name });
								
								tab.handle('click', function(elem, e) {
									pass.setSubScene(wrapperName, scene.name);
								});
							});
							
							subSceneObj[wrapperName] = subSceneElem;
						});
						
						// TODO: how to access useful?
						this.elems = this.build(sceneElem, subSceneObj);
						
						if (this.defaultScene) {
							var s = this.defaultScene.split('/');
							this.setSubScene(s[0], s[1]);
						}
						
						return sceneElem;
					}
				}; }
			}),
			RootScene: PACK.uth.makeClass({ name: 'RootScene',
				superclassName: 'Scene',
				methods: function(sc, c) { return {
					init: function(params /* name, title, build, subScenes */) {
						sc.init.call(this, params);
						
						this.active = true;
					},
					go: function() {
						PACK.e.e('body').append(this.getHtml());
					}
				}; }
			})
		};
	}
});
package.build();
