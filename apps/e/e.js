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
				methods: {
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
								
								// The string represents new elements
								elems = new DOMParser().parseFromString(str, 'text/html')
								//	 html >     body >        inner element
									.firstChild.childNodes[1].firstChild;
								
							} else {
								
								if (str[0] === '+') elems = document.querySelectorAll(str.substr(1));
								else 				elems = document.querySelector(str);
								
							}
							
						}
						
						// Use array instead of HTMLCollection
						if (elems instanceof HTMLCollection) elems = U.arr(elems);
						
						// Use an array with a single element instead of the element itself
						if (elems instanceof HTMLElement) elems = [ elems ];
						
						this.elems = elems;
					},
					append: function(e) {
						e = E(e);
						for (var n = 0; n < e.elems.length; n++) this.elems[0].appendChild(e.elems[n]);
					},
					handle: function(event, func) {
						var eventPropName = 'on' + event.substr(0, 1).toUpperCase() + event.substr(1);
						for (var n = 0; n < this.elems.length; n++) this.elems[n][eventPropName] = func;
					},
					attr: function(attrs /* { "name": "value", ... } */) {
						for (var n = 0; n < this.elems.length; n++) {
							var elem = this.elems[n];
							for (var k in attrs) {
								var v = attrs[k];
								
								if (k === 'class') {
									
									if (v.constructor.name === 'String') 	var newClasses = v.split(' ');
									else									var newClasses = v;
									
									var curClassStr = elem.getAttribute('class');
									if (curClassStr === null)	var curClasses = [];
									else						var curClasses = curClassStr.split(' ');
									
									var finalClasses = {};
									for (var i = 0; i < curClasses.length; i++)	finalClasses[curClasses[i]] = true;
									
									for (var i = 0; i < newClasses.length; i++) {
										var cls = newClasses[i];
										var c0 = cls.substr(0, 1);
										
										if (c0 === '+' || c0 === '-') cls = cls.substr(1); 
										
										if (c0 === '+') 		finalClasses[cls] = true;
										else if (c0 === '-')	delete finalClasses[cls];
										else {
											// TODO: Anything for no operator?
										}
									}
									
									var finalClassArr = [];
									for (var k in finalClasses) finalClassArr.push(k);
									
									if (finalClassArr.length === 0) elem.removeAttribute('class');
									else							elem.setAttribute('class', finalClassArr.join(' '));
									
								} else if (k === 'css') {
									
								} else {
									elem.setAttribute(k, v);
								}
							}
						}
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
				}
			}),
		};
	}
});
package.build();
