/*
TODO: Need some way of marking QElems as "sensitive" so that they cannot be
transmitted over the wire to any recipient. Perhaps an anonymous function in a parent
element that gets to return true or false for every child in that parent's
jurisdiction? It needs to be an anonymous function to allow for any use-case-specific
permissions to be applied.

TODO: When querying for server-side elems, need to be able to add the queried elem to
the tree on the client-side. The current issue is that when the element's parent is
missing (because the address provided for the element had multiple components, and at
least one of the elements in the component-chain was missing client-side), the
element cannot be attached to the tree because no intermediate elements will be
loaded. Approach this by first writing a method to load all intermediate components
and attach them in order. Then the child can be attached.

TODO: Long polling

TODO: Link QGen with PACK.e.ListUpdater, and write corresponding *Updaters for the
other subclasses of QElem. Once this is done any server-side element should be easily
syncable with the client side. With long-polling, it should be beautiful

TODO: Abstract tree class in separate package!!!

TODO: Rename from "quickDev" to "dossier". That's smooth. Remove "QD" prefixes.
Rename "Elem" to "Dossier".
*/
var package = new PACK.pack.Package({ name: 'quickDev',
	dependencies: [ 'queries', 'e' ],
	buildFunc: function() {
		
		var ret = {};
		
		// Add classes
		ret.update({
			/* QSchema */
			QSchema: U.makeClass({ name: 'QSchema',
				propertyNames: [ 'c', 'p', 'i' ],
				methods: function(sc) { return {
					init: function(params /* c, p, i */) {
						/*
						This is a shorthand class. The length of the parameter
						names is purposely minimal.
						
						c: "constructor"
						p: "params"
						i: "inner schemas" (array OR object, of params OR instances)
						*/
						this.c = U.param(params, 'c');
						this.p = U.param(params, 'p', {});
						var inner = U.param(params, 'i', {});
						this.i = {};
						
						// this.c is resolved to a string if it's a constructor
						if (this.c.constructor !== String) this.c = this.c.title;
						
						// Ensure that all elements of this.i are instances of QSchema
						var pass = this;
						inner.forEach(function(schema) {
							if (!(schema instanceof PACK.quickDev.QSchema)) schema = new PACK.quickDev.QSchema(schema);
							pass.i[schema.p.name] = schema;
						});
					},
					getInstance: function(params /* overwrite params */) {
						var cls = U.deepGet({ root: C, name: this.c });
						var cParams = U.exists(params) ? this.p.clone(params) : this.p;
						if (!('name' in cParams)) cParams.name = '-unnamed-';
						
						return new cls(cParams);
					},
					actualize: function(params /* p */) {
						/*
						Fully creates an entirely new `QElem` based on the schema.
						*/
						var myParams = U.param(params, 'p', {});
						var ret = this.getInstance(myParams);
						
						this.assign({ elem: ret, recurse: true });
						
						return ret;
					},
					assign: function(params /* elem, recurse */) {
						var pass = this;
						var elem = U.param(params, 'elem');
						// Recurse means that the i field is used to assign values to
						// elem's children as well.
						var recurse = U.param(params, 'recurse', true);
						
						var cls = U.deepGet({ root: C, name: this.c });
						if (!(elem instanceof cls)) throw new Error('bad schema assignment (have "' + this.c + '", need "' + elem.constructor.title + '")');
						
						elem.schemaProperties().forEach(function(v, k) {
							if (k in pass.p) elem[k] = k[0] === '_'
								? U.getSerializable(pass.p[k])
								: pass.p[k];
						});
						
						if (recurse && (elem instanceof PACK.quickDev.QSet)) {
							
							try {
								
								// Try with immediately attaching to parent
								elem.clear();
								this.i.forEach(function(schema, k) {
									var newElem = schema.getInstance();
									elem.addChild(newElem);
									schema.assign({ elem: newElem, recurse: true });
								});
								
							} catch(e) {
								
								// Try building child entirely.
								// All the children are built before any of them are added.
								// The advantage of this is that if an error occurs during
								// building, there will be no malformed children attached
								// during error handling.
								elem.clear(); // Probably removes malformed children from 1st attempt
								var children = this.i.map(function(schema, k) {
									var newElem = schema.getInstance();
									schema.assign({ elem: newElem, recurse: true });
									return newElem;
								});
								children.forEach(function(child) { elem.addChild(child); });
								
							}
							
						}
					},
					validateElem: function(qElem) {
						// TODO: Validate!!! (allow subclasses? allow omitted children?)
					},
					simplified: function() {
						var ret = {};
						ret[this.c + '(' + JSON.stringify(this.p) + ')'] = this.i.map(function(schema) { return schema.simplified(); });
						return ret;
					}
				}},
			}),
			
			/* QUpdate */
			QUpdate: U.makeClass({ name: 'QUpdate',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* request, onStart, onEnd */) {
						/*
						Performs a request with 3 components:
						
						1) request(callback):
							The function that makes the request. It is provided a callback,
							which should be called with any response data once the request
							is complete.
						2) start():
							A function that is called as soon as the request is initiated.
							Useful for indicating to the user that the request has begun.
						3) end(response):
							A function that is called once the request has completed, with
							any data returned by the request.
						*/
						this.request = U.param(params, 'request');
						this.onStart = U.param(params, 'onStart', null);
						this.onEnd = U.param(params, 'onEnd', null);
						
						this.pendingCount = 0;
						this.interval = null;
					},
					run: function() {
						var pass = this;
						
						this.pendingCount++;
						if (this.onStart) this.onStart();
						this.request(function(response) {
							pass.pendingCount--;
							if (pass.onEnd) pass.onEnd(response);
						});
					},
					fire: function(params /* allowMultiple */) {
						var allowMultiple = U.param(params, 'allowMultiple', false);
						
						if (allowMultiple || this.pendingCount === 0) this.run();
					},
					repeat: function(params /* delay, runInstantly, allowMultiple */) {
						if (this.interval !== null) throw new Error('Cannot begin another interval without clearing the first');
						
						var delay = U.param(params, 'delay');
						var runInstantly = U.param(params, 'runInstantly', true);
						var allowMultiple = U.param(params, 'allowMultiple', false);
						
						if (runInstantly && (allowMultiple || this.pendingCount === 0)) this.run();
						
						var pass = this;
						this.interval = setInterval(function() {
							if (allowMultiple || pass.pendingCount === 0) pass.run();
						}, delay);
					},
					endRepeat: function() {
						if (this.interval === null) return;
						clearInterval(this.interval);
						this.interval = null;
					}
				}; }
			}),
			
			/* QSel */
			QSel: U.makeClass({ name: 'QSel',
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(params /* */) {
					},
					getElemChildren: function(elem) {
						/*
						Overridable way of retrieving children from a parent.
						TODO: This is coupled to QSchema. Would it be worthwhile
						decoupling?
						*/
						return elem.schemaChildren();
					},
					select: function(elem) {
						/*
						Returns an object representing the children of `elem`, where
						each key of the returned object is the child's name, and the
						value is the recursive representation of that child; `false`
						if that child is meant to be excluded by the selection, or
						`true` if that child is a leaf.
						
						Note that this method will return `true` instead of an object
						if `elem` is a leaf.
						
						This method should probably not be called by the
						implementation. It is a utility method which simplies
						`QSel.prototype.iterate` and `QSel.prototype.walk`.
						*/
						var children = this.getElemChildren(elem);
						
						if (U.isEmptyObj(children)) return true;
						
						var names = this.getSelectedNames(children);
						
						var ret = {};
						for (var i = 0, len = names.length; i < len; i++) {
							var name = names[i];
							var selector = this.getSelectorFor(children[name]);
							ret[name] = selector ? selector.select(children[name]) : false;
						}
						
						return ret;
					},
					iterate: function(params /* elem, includeRoot, func */) {
						/*
						Applies a function to every element which is selected by
						this `QSel`.
						
						Note the `selection` variable below; it isn't meant to be
						a parameter given by the user. On the first run of this
						method it will be undefined, so the `U.palam` call will
						cause it to be the result of `this.select` on `elem`. This
						value of `selection` will then be provided to every
						recursive call of `this.iterate`, and therefore the `select`
						method won't be called on any iteration except for the 1st.
						*/
						var pass = this;
						var elem = 				U.param(params, 'elem');
						var includeRoot =	U.param(params, 'includeRoot', false);
						var func = 				U.param(params, 'func');
						var selection = 	U.palam(params, 'selection', function() { return pass.select(elem); });
						
						if (includeRoot) func(elem);
						
						if (U.isObj(selection) && selection.constructor === Object) {
							var children = this.getElemChildren(elem);
							for (var k in selection) this.iterate({
								elem: children[k],
								selection: selection[k],
								includeRoot: true,	// `includeRoot` is always true for children
								func: func
							});
						}
					},
					walk: function(params /* elem, func, lastVal, selection */) {
						/*
						This method simplifies the process of building another tree
						which is related to the tree of elements filtered by this
						`QSel`.
						
						If calls `func` for every element in the selected tree, and
						provides a `par` parameter as well. This should allow
						related trees to have their nodes connected in the same
						way as the selected tree.
						*/
						var pass = this;
						var elem = U.param(params, 'elem');
						var func = U.param(params, 'func'); // Accepts (elem, parent)
						var lastVal = U.param(params, 'lastVal', null);
						var selection = U.palam(params, 'selection', function() { return pass.select(elem); });
						
						var ret = func(elem, lastVal);
						
						if (selection.constructor === Object) {
							var children = this.getElemChildren(elem);
							for (var k in selection) this.walk({
								elem: children[k],
								func: func,
								selection: selection[k],
								lastVal: ret
							});
						}
						
						return ret;
					},
					getSelectedNames: function(childrenObj) {
						/*
						This is the method which defines the filtering logic.
						Returns an array whose elements are a subset of the keys in
						`childrenObj`. These keys define which elements have been
						selected by this `QSel`.
						*/
						throw new Error('not implemented');
					},
					getSelectorFor: function(child) {
						/*
						Returns the next instance of a `QSel` which should be used
						to filter `child`.
						*/
						throw new Error('not implemented');
					}
				};}
			}),
			QSelSimpleInner: U.makeClass({ name: 'QSelSimpleInner',
				superclassName: 'QSel',
				propertyNames: [ 'sel' ],
				methods: function(sc) { return {
					init: function(params /* sel */) {
						sc.init.call(this, params);
						this.sel = U.param(params, 'sel', null);
					},
					getSelectorFor: function(child) { return this.sel }
				};}
			}),
			QSelNamedInner: U.makeClass({ name: 'QSelNamedInner',
				superclassName: 'QSelSimpleInner',
				propertyNames: [ 'selNames' ],
				methods: function(sc) { return {
					init: function(params /* sel, selNames */) {
						sc.init.call(this, params);
						this.selNames = U.param(params, 'selNames', null);
					},
					getSelectorFor: function(child) {
						if (child.name in this.selNames) return this.selNames[child];
						return sc.getSelectorFor.call(this, child);
					}
				};}
			}),
			QSelAll: U.makeClass({ name: 'QSelAll',
				superclassName: 'QSelSimpleInner',
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(params /* sel */) {
						sc.init.call(this, params);
					},
					getSelectedNames: function(childrenObj) {
						var ret = [];
						for (var k in childrenObj) ret.push(k);
						return ret;
					}
				};}
			}),
			QSelNone: U.makeClass({ name: 'QSelNone',
				superclassName: 'QSel',
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(params /* sel */) {
						sc.init.call(this, params);
					},
					getSelectedNames: function(childrenObj) { return []; },
					getSelectorFor: function(child) { return null; }
				};}
			}),
			QSelInc: U.makeClass({ name: 'QSelInc',
				propertyNames: [ 'names' ],
				superclassName: 'QSelNamedInner',
				methods: function(sc) { return {
					init: function(params /* selNames */) {
						sc.init.call(this, params);
					},
					getSelectedNames: function(childrenObj) {
						var ret = [];
						for (var k in childrenObj) if (k in this.selNames) ret.push(k);
						return ret;
					}
				};}
			}),
			QSelExc: U.makeClass({ name: 'QSelExc',
				propertyNames: [ 'names' ],
				superclassName: 'QSelSimpleInner',
				methods: function(sc) { return {
					init: function(params /* sel, names */) {
						sc.init.call(this, params);
						this.names = U.param(params, 'names');
					},
					getSelectedNames: function(childrenObj) {
						var ret = [];
						for (var k in childrenObj) if (!(k in this.names)) ret.push(k);
						return ret;
					},
				};}
			}),
			
			/* QElem */
			QElem: U.makeClass({ name: 'QElem',
				superclassName: 'QueryHandler',
				propertyNames: [ 'name' ],
				methods: function(sc, c) { return {
					init: function(params /* name, allowTransfer */) {
						sc.init.call(this, params);
						
						var name = U.param(params, 'name').toString();
						if (!c.NAME_REGEX.test(name)) throw new Error('Invalid element name: "' + name + '"');
						
						this.name = name;
						this.allowTransfer = U.param(params, 'allowTransfer', true);
						this.par = null;
					},
					
					use: function() {
						/*
						Used to resolve an element to the element it is meant to represent.
						Useful for indirection - an indirecting element can provide the
						element it's meant to point at using this method.
						*/
						return this;
					},
					
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
						return this.getAncestry().reverse().map(function(qElem) {
							return qElem.name.toString();
						});
					},
					getAddress: function() { return this.getNameChain().join('.'); },
					getRoot: function() {
						var ptr = this;
						while (ptr.par) ptr = ptr.par;
						return ptr;
					},
					getChild: function(address) {
						// Safe to disregard "use" here, because QSet's "use" returns "this"
						// TODO: is it safe to assume this will never be overloaded?
						if (address.length === 0) return this; // Works for both strings and arrays
						
						if (address.constructor !== Array) address = address.toString().split('.');
						
						var ptr = this;
						for (var i = 0, len = address.length; (i < len) && (ptr !== null); i++)	ptr = ptr.getNamedChild(address[i]);
						
						return ptr;
					},
					getNamedChild: function(name) {
						if (name[0] === '$') {
							
							if (name === '$par')				return this.par;
							else if (name === '$root')	return this.getRoot();
							
						}
						
						return null;
						// throw new Error('Invalid child name: "' + name + '"');
					},
					
					matches: function(filter) {
						/*
						Checks if this element matches a filter
						
						Example usage:
						
						var filter = {
							p: {},
							i: {
								email: 		{ p: { value: 'bob@site.com' } },
								password: 	{ p: { value: 'password123' } },
							}
						};
						
						A filter is an object with "p" and "i" keys.
						
						The "p" key is a list of properties to check against the
						element. If any property in "p" exists on the element and
						doesn't match, the element fails the filter.
						
						The "i" key indicates an array or map of inner filters.
						These filters are applied to inner elements. This is only
						useful for QSets.
						*/
						
						for (var k in filter) {
							var slash = k.indexOf('/');
							if (~slash) {
								var addr = k.substr(0, slash);
								var prop = k.substr(slash + 1);
							} else {
								var addr = '';
								var prop = k;
							}
							var c = this.getChild(addr);
							if (c === null || c[prop] !== filter[k]) return false;
						}
						
						return true;
						
						
						/*var filterProps = U.param(filter, 'p', {});
						
						for (var k in filterProps) if (this[k] !== filterProps[k]) return false;
						
						return true;*/
					},
					
					formParams: function() { return null; },
					getForm: function(selection) {
						var ret = {};
						
						selection.iterate({ elem: this, includeRoot: true, func: function(child) {
							var formParams = child.formParams();
							if (formParams !== null) ret[child.getAddress()] = formParams;
						}});
						
						return ret;
 					},
					$getForm: function(params /* address, selection, formBuilder */) {
						/*
						A form connects the client-side to the server-side with a quick
						way to modify information. The form is responsible for producing
						a QSchema.
						*/
						var address = U.param(params, 'address');
						var selection = U.param(params, 'selection');
						
						return this.$request({
							address: address,
							command: 'getForm',
							params: { selection: selection },
							serialized: [ 'selection' ],
						}).then(function(response) {
							for (var k in response) response[k].name = k;
							return response;
						});
					},
					
					$request: function(params /* command, params, serialized, address */) {
						var address = U.param(params, 'address', this.getAddress());
						var command = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						var serialized = U.param(params, 'serialized', []);
						
						return new PACK.queries.Query({
							address: address,
							command: command,
							params: reqParams,
							serialized: serialized
						}).fire();
					},
					$getSchema: function(params /* selection */) {
						var selection = U.param(params, 'selection');
						
						return this.$request({
							command: 'getSchema',
							params: { selection: selection },
							serialized: [ 'selection' ]
						});
					},
					$load: function(params /* selection */) {
						/*
						Calls `this.$getSchema`, then actualizes the response schema
						into a `QElem`.
						*/
						return this.$getSchema(params).then(function(data) {
							return (new PACK.quickDev.QSchema(data.schemaParams)).actualize();
						});
					},
					handleQuery: function(params) {
						/*
						This method should only be called server-side. Returns a
						response for a request.
						*/
						var com = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						
						if (com === 'getSchema') {
							
							var selection = U.pawam(reqParams, 'selection', PACK.quickDev.sel.all);
							return new PACK.p.P({ val: { schemaParams: this.schemaParams({ selection: selection }) } });
						
						} else if (com === 'getForm') {
							
							var address = U.param(reqParams, 'address');
							var selection = U.pawam(reqParams, 'selection');
							
							var obj = address ? this.getChild(address) : this;
							
							return new PACK.p.P({ val: { form: obj.getForm(selection) } });
							
						}
						
						throw new Error('"' + this.getAddress() + '" didn\'t recognize command "' + com + '"');
					},
					
					simplified: function() { throw 'not implemented'; },
					
					schemaConstructorName: function() {
						// Return the name that can be used to reference this class' name.
						// Can be a period-delimited string to reference packaged classes.
						return this.constructor.title;
					},
					schemaProperties: function() {
						// Returns the list of properties that need to be included in the
						// schema that describes this QElem.
						return { name: this.name };
					},
					schemaChildren: function(params /* whitelist */) {
						// Returns the object of children for this QElem that need to be
						// included in the schema.
						return {};
					},
					schemaParams: function(params /* selection */) {
						/*
						Returns an object representing parameters for a PACK.quickDev.QSchema
						object. The parameters can be used raw, but to gain quick
						additional functionality the result of schemaParams() can be plugged
						into the QSchema constructor.
						
						e.g.
						
						var elem = // Create some instance of QElem
						
						var schemaParams = elem.schemaParams();
						
						// Can analyze schemaParams and do stuff
						
						// Convenient functionality after building QSchema:
						var schema = new PACK.quickDev.QSchema(schemaParams);
						
						schema.assign(elem); // Quickly assign schema properties to an element
						schema.actualize();	 // Quickly create a new element based on this schema
						//...
						
						*/
						var selection = U.param(params, 'selection');
						
						return selection.walk({
							elem: this,
							func: function(elem, par) {
								var ret = {
									c: elem.schemaConstructorName(),
									p: elem.schemaProperties(),
									i: {}
								};
								if (par) par.i[elem.name] = ret;
								return ret;
							}
						});
						
					}
				}},
				statik: {
					NAME_REGEX: /^[a-zA-Z0-9-_]+$/
				}
			}),
			QValue: U.makeClass({ name: 'QValue',
				superclassName: 'QElem',
				propertyNames: [ 'value' ],
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						var value = U.palam(params, 'value', this.defaultValue.bind(this));
						
						sc.init.call(this, params);
						this.value = null;
						this.setValue(value);
					},
					defaultValue: function() { return null; },
					setValue: function(value) { this.value = this.sanitizeAndValidate(value); },
					sanitizeAndValidate: function(value) { return value; },
					simplified: function() { return this.value; },
					
					formParams: function() {
						return this.schemaProperties().update({
							class: this.constructor.title
						});
					},
					
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({ value: this.value });
					},
				}}
			}),
			QSet: U.makeClass({ name: 'QSet',
				superclassName: 'QElem',
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(params /* name */) {
						sc.init.call(this, params);
						
						this.length = 0;
						this.children = {};
					},
					validateChild: function(child) {
						if (child === null) throw new Error('Invalid child element');
					},
					addChild: function(child) {
						if (child.par !== null) {
							if (child.par !== this) throw new Error('child already has a parent');
							return child;
						}
						
						child.par = this;
						
						try {
							this.validateChild(child);
							this.containChild(child);
							this.length++;
						} catch(e) {
							child.par = null;
							throw e;
						}
						return child;
					},
					remChild: function(child) {
						if (child.constructor === String) child = this.getChild(child);
						
						var ret = this.uncontainChild(child);
						if (ret) {
							this.length--;
							ret.par = null;
						}
						return ret;
					},
					clear: function() {
						this.children.forEach(function(child) {
							child.par = null;
						});
						this.children = {};
						this.length = 0;
					},
					containChild: function(child) { throw new Error('not implemented'); },
					uncontainChild: function(child) { throw new Error('not implemented'); },
					getNamedChild: function(name) {
						var resolveRef = name[0] === '@';
						if (resolveRef) name = name.substr(1);
						
						if (name in this.children)
							return resolveRef ? this.children[name].use() : this.children[name];
						
						return sc.getNamedChild.call(this, name);
					},
					setValue: function(address, v) {
						var c = this.getChild(address);
						if (!c) throw new Error('Can\'t set value for non-existant child: "' + address + '"');
						c.setValue(v);
					},
					setChildProperty: function(address, v) {
						var pcs = address.split('/');
						this.getChild(pcs[0])[pcs[1]] = v;
					},
					
					filter: function(filter, onlyOne) {
						if (!U.exists(onlyOne)) onlyOne = false;
						
						if (!onlyOne) var ret = [];
						
						for (var k in this.children) {
							var child = this.children[k];
							if (child.matches(filter)) {
								if (onlyOne) 	return child;
								else 			ret.push(child);
							}
						}
						
						return onlyOne ? null : ret;
					},
					
					schemaChildren: function(params /* whitelist */) {
						var whitelist = U.param(params, 'whitelist', null);
						if (whitelist === null) return this.children;
						
						var ret = {};
						for (var k in whitelist) {
							var child = this.getChild(k);
							if (child === null) throw new Error('Bad key for schemaChildren: "' + k + '"');
							ret[k] = child;
						}
						return ret;
					},
					
					$filter: function(params /* address, filter */) {
						var pass = this;
						var address = U.param(params, 'address', this.getAddress());
						var filter = U.param(params, 'filter');
						
						return this.$request({
							address: address,
							command: 'filter',
							params: { filter: filter },
						}).then(function(response) {
							// Turn each schema into an element
							var elems = response.schemaParamsList.map(function(schemaParams) {
								var schema = new PACK.quickDev.QSchema(schemaParams);
								return schema.actualize();
							});
							
							return elems;
						});
					},
					$getChildSchema: function(params /* address, selection */) {
						if (U.isObj(params, String)) params = { address: params };
						
						var address = U.param(params, 'address');
						var selection = U.param(params, 'selection', PACK.quickDev.sel.all);
						
						return this.$request({
							command: 'getChildSchema',
							params: { address: address, selection: selection },
							serialized: [ 'selection' ]
						}).then(function(response) {
							return response.schemaParams
						});
					},
					$getChild: function(params /* address, selection */) {
						
						return this.$getChildSchema(params)
							.then(function(schemaParams) {
								return schemaParams
									? (new PACK.quickDev.QSchema(schemaParams)).actualize()
									: null;
							});
						
					},
					handleQuery: function(params) {
						/*
						Easy to get confused here because the object "params" has an entry
						keyed "params".
						
						The "params" object holds a command, and the parameters	for that
						specific command. It identifies an operation.
						
						The "params.params" object IS the parameters for the operation. It
						describes how to perform the operation.
						
						To avoid ambiguity between two objects that ought to be named
						"params", the "params.params" object is referenced by the variable
						"reqParams".
						*/
						var com = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						
						if (com === 'filter') {		/* filter */
							
							var filter = U.param(reqParams, 'filter');
							var address = U.param(reqParams, 'address', null);
							
							var root = address ? this.getChild(address) : this;
							if (root === null) throw new Error('bad address: "' + address + '" for "' + this.getAddress() + '"');
							
							var children = root.filter(filter);
							
							return new PACK.p.P({ val: {
								schemaParamsList: children.map(function(child) {
									return child.schemaParams({ selection: PACK.quickDev.sel.all });
								})
							}});
							
						} else if (com === 'getChildSchema') {		/* address, selection */
							
							var address = U.param(reqParams, 'address');
							var selection = U.pawam(reqParams, 'selection');
							
							var child = this.getChild(address);
							return new PACK.p.P({ val: { schemaParams: child ? child.schemaParams({ selection: selection }) : null } });
							
						} else if (com === 'setChildProperty') {	/* address, value */
							
							var address = U.param(reqParams, 'address');
							var value = U.param(reqParams, 'value');
							
							this.setChildProperty(address, value);
							return new PACK.p.P({ val: { msg: 'success' } });
							
						}
						
						return sc.handleQuery.call(this, params);
					}
				}}
			}),
			QGen: U.makeClass({ name: 'QGen',
				/*
				TODO: Still need to deal with reordering children.
				This requires some way to handle reverse-relations.
				This is because reordering requires renaming (e.g. if
				for parent "container" there are children "0", "1", and
				"2", and "1" is deleted, "2" should be renamed "1" - but
				this will break	any references to "container.2", so
				those references would need to be updated. Tricky stuff,
				especially if many children are being reordered (e.g.
				due to the application of some sorting algorithm).
				*/
				superclassName: 'QSet',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* name, _schema, _initChild, prop */) {
						/*
						name: element name
						_schema: (serializable) schema that describes how the QGen
							creates new elements
						prop: dot-separated address, suffixed by a slash-separated
							property-name (e.g. "parent2.parent.child/name"). This
							is necessary to determine which key is used to index
							children that are added to the QGen. The address-component
							of the string indexes into a child that is being added,
							and the property-component picks a property from that
							child to be used as the key.
							
							e.g. suppose you want to QGen "people" objects:
							
							var people = new qd.QGen({ name: 'people',
								_schema: U.addSerializable({ name: 'someApp.peopleSchema',
									value: new qd.QSchema({ c: qd.QDict, i: {
										age: new qd.QSchema({ c: qd.QInt ... }),
										name: new qd.QSchema({ c: qd.QString ... }),
										contact: new qd.QSchema({ c: qd.QDict, i: {
											address: new qd.QSchema({ c: qd.QString ... }),
											email: new qd.QSchema({ c: qd.QString ... })
										}})
									}})
								})
							]);
						    
							But the thing that makes a QGen effective is that it stores
							using an object instead of an array. So there needs to be
							some way of finding a unique object-key for each "person".
							The unique key in this case is the email. So we tell the
							QGen how to find the email: "contact.email/value". This means
							find the child's "contact.email" address element (a QString),
							and extract the "value" property to provide a key for indexing.
						*/
						sc.init.call(this, params);
						this._schema = U.pasam(params, '_schema');
						this._initChild = U.pasam(params, '_initChild', null);
						this.prop = U.param(params, 'prop');
						
						// TODO: Omitting `prop` should cause a default "id" child
						// to be generated (and require the `_schema` produces a
						// subclass of QDict).
						
						var lastDot = this.prop.indexOf('/');
						if (~lastDot) {
							this.childAddress = this.prop.substr(0, lastDot);
							this.childProp = this.prop.substr(lastDot + 1);
						} else {
							// If there's no "/", `this.prop` is the PROP, not the ADDRESS
							// That's because it's ok if the address is blank, but the prop
							// cannot be blank! So if only one string is given, it must be
							// the prop.
							this.childAddress = '';
							this.childProp = this.prop;
						}
					},
					validateChild: function(child) {
						if (this._schema.v) this._schema.v.validateElem(child);
					},
					getNewChild: function(params /* */) {
						var child = this._schema.v.actualize();
						child.par = this; // HACK #1: Instant access to the parent is usually necessary
						
						if (this._initChild) this._initChild.v(child, params, this);
						
						// TODO: The next 2 lines assume sequential ordering...
						// holes left from removals, sorting, etc, will break this.
						
						if (U.isInstance(child, PACK.quickDev.QSet)) {
							var id = child.getChild('id');
							if (id !== null) id.setValue(this.length);
						}
						
						child.par = null; // HACK #2: Need to set the parent to null in order to properly add
						return this.addChild(child);
					},
					getNamedChild: function(name) {
						// QGens allow the "+" symbol to refer to a new,
						// dynamically created element.
						if (name[0] === '+') {
							var elem = this._schema.v.actualize();
							elem.name = name.length > 1
								? name.substr(1)
								: this.length.toString();
							return elem;
						}
						
						return sc.getNamedChild.call(this, name);
					},
					getChildProp: function(elem) {
						var propElem = elem.getChild(this.childAddress);
						
						if (propElem === null)
							throw new Error('Invalid child "' + elem.getAddress() + '" doesn\'t contain prop child: "' + this.childAddress + '/' + this.childProp + '"');
						
						if (!(this.childProp in propElem)) throw new Error('Invalid child "' + elem.getAddress() + '" doesn\'t contain prop: "' + this.childAddress + '/' + this.childProp + '"');
						
						return propElem[this.childProp].toString();
					},
					containChild: function(child) {
						var prop = this.getChildProp(child);
						
						this.children[prop] = child;
						child.name = prop;
						
						return child;
					},
					uncontainChild: function(child) {
						var prop = this.getChildProp(child);
						if (!(prop in this.children)) return null;
						
						var ret = this.children[prop];
						delete this.children[prop];
						return ret;
					},
					simplified: function() { return this.children.map(function(c) { return c.simplified(); } ); },
					
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({
							_schema: 	this._schema.name,
							_initChild: this._initChild.name,
							prop:	 	this.childAddress === '' ? this.childProp : this.childAddress + '/' + this.childProp
						});
					},
					
					$getNewChild: function(params /* initParams */) {
						var initParams = U.param(params, 'initParams', {});
						
						return this.$request({
							command: 'getNewChild',
							params: { initParams: initParams }
						});
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						var session = U.param(params, 'session');
						var reqParams = U.param(params, 'params', {});
						
						if (com === 'getNewChild') {
							var initParams = U.param(reqParams, 'initParams');
							
							if ('session' in initParams) throw new Error('Used reserved "session" parameter');
							
							var child = this.getNewChild(initParams.update({ session: session }));
							return new PACK.p.P({ val: {
								schema: child.schemaParams({ selection: PACK.quickDev.sel.all })
							}});
						}
						
						return sc.handleQuery.call(this, params);
					}
				}}
			}),
			QDict: U.makeClass({ name: 'QDict',
				superclassName: 'QSet',
				propertyNames: [ ],
				methods: function(sc) { return {
					init: function(params /* name, children */) {
						/*
						Note that "children" is an array, not an object. Each child's
						names is enough information to index it properly.
						*/
						sc.init.call(this, params);
						
						var children = U.param(params, 'children', []);
						for (var i = 0, len = children.length; i < len; i++) this.addChild(children[i]);
					},
					containChild: function(child) {
						this.children[child.name] = child;
					},
					uncontainChild: function(child) {
						var ret = this.children[child.name];
						delete this.children[child.name];
						return ret;
					},
					simplified: function(child) {
						var ret = {};
						for (var k in this.children) ret[k] = this.children[k].simplified();
						return ret;
					},
				}}
			}),
			
			/* QValue subclasses */
			QRef: U.makeClass({ name: 'QRef',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
					},
					
					use: function() {
						/*
						Returns the element whose address is "this.value" in this
						QRef's root.
						
						NOTE: "use" not called on "this.getRef()". If it's
						desirable for the target's address to be resolved, this
						QRef's "value" should use the "!" flag where necessary.
						*/
						return this.getRef();
					},
					
					rootAddr: function() {
						/*
						Returns the string that can be used as a parameter for the
						root element's getChild call. This string is the full "value"
						of the reference, with the 1st component chopped off.
						*/
						var dotInd = this.value.indexOf('.');
						return ~dotInd ? this.value.substr(dotInd + 1) : '';
					},
					getRef: function() {
						if (this.value === null) return null;
						return this.getRoot().getChild(this.rootAddr());
					},
					setRef: function(elem) {
						if (!(elem instanceof PACK.quickDev.QElem)) throw new Error('Need QElem for setRef, instead got: ' + elem);
						this.setValue(elem.getAddress());
					},
					sanitizeAndValidate: function(value) {
						if (value instanceof PACK.quickDev.QElem) value = value.getAddress();
						
						if (value !== null && value.constructor !== String) throw new Error('invalid reference address for "' + this.getAddress() + '"');
						
						return value;
					},
					getNamedChild: function(name) {
						if (name === '@') return this.getRef();
						return sc.getNamedChild.call(this, name);
					},
					
					$getRef: function(params /* selection */) {
						return this.getRoot().$getChild(params.update({ address: this.rootAddr() }));
					},
				}}
			}),
			QString: U.makeClass({ name: 'QString',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value, minLen, maxLen */) {
						sc.init.call(this, params);
						this.minLen = U.param(params, 'minLen', null);
						this.maxLen = U.param(params, 'maxLen', null);
						
						if (this.minLen !== null && this.minLen !== null && this.minLen > this.maxLen)
							throw new Error('minLen must be <= maxLen');
					},
					defaultValue: function() { return ''; },
					sanitizeAndValidate: function(value) {
						value = value === null ? '' : value.toString();
						
						if (this.minLen !== null && value.length < this.minLen) throw new Error('need min length of ' + this.minLen);
						if (this.maxLen !== null && value.length > this.maxLen) throw new Error('need max length of ' + this.maxLen);
						
						return value;
					},
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({
							minLen: this.minLen,
							maxLen: this.maxLen
						});
					}
				}}
			}),
			QInt: U.makeClass({ name: 'QInt',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
						
						this.minVal = U.param(params, 'minVal', null);
						this.maxVal = U.param(params, 'maxVal', null);
						
						if (this.minVal !== null && this.maxVal !== null && this.minVal > this.maxVal)
							throw new Error('minVal must be <= maxVal');
					},
					defaultValue: function() { return 0; },
					sanitizeAndValidate: function(value) {
						var intValue = parseInt(value);
						if (isNaN(intValue)) throw new Error('invalid integer value "' + value + '" for "' + this.getAddress() + '"');
						
						if (this.minVal !== null && intValue < this.minVal) throw new Error('Below minimum value: ' + intValue + ' < ' + this.minVal);
						if (this.maxVal !== null && intValue > this.maxVal) throw new Error('Above maximum value: ' + intValue + ' > ' + this.maxVal);
						
						return intValue;
					},
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({
							minVal: this.minVal,
							maxVal: this.maxVal
						});
					}
				}; }
			}),
			QVector2D: U.makeClass({ name: 'QVector2D',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						if (value.constructor !== Object) throw 'invalid type for vector2D: "' + value.constructor.name + '"';
						
						if (!value.hasProps([ 'x', 'y' ])) throw 'missing coordinate for vector2D';
						
						var val = {};
						if (isNaN(val.x = parseFloat(value.x))) throw 'bad x coordinate for vector2D';
						if (isNaN(val.y = parseFloat(value.y))) throw 'bad y coordinate for vector2D';
						
						return val;
					},
				}; },
			}),
			QColor: U.makeClass({ name: 'QColor',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						if (value.constructor !== Object) throw 'invalid type for color: "' + value.constructor.name + '"';
						
						if (!value.hasProps([ 'r', 'g', 'b', 'a' ])) throw 'missing color component';
						
						var val = {};
						if (isNaN(val.r = parseInt(value.r))) throw 'bad format for r component: "' + value.r + '"';
						if (isNaN(val.g = parseInt(value.g))) throw 'bad format for g component: "' + value.g + '"';
						if (isNaN(val.b = parseInt(value.b))) throw 'bad format for b component: "' + value.b + '"';
						if (isNaN(val.a = parseFloat(value.a))) throw 'bad format for a component: "' + value.a + '"';
						
						if (val.r < 0 || val.r > 255) throw 'r component outside range';
						if (val.g < 0 || val.g > 255) throw 'g component outside range';
						if (val.b < 0 || val.b > 255) throw 'b component outside range';
						if (val.a < 0 || val.a > 1) throw 'a component outside range';
						
						return val;
					}
				}; }
			}),
			
			/* QMigration */
			QMigration: U.makeClass({ name: 'QMigration',
				methods: function(sc, c) { return {
					init: function(params /* name, apply, next */) {
						this.name = U.param(params, 'name');
						this.apply = U.param(params, 'apply');
						this.next = U.param(params, 'next', null);
					},
					chain: function(migrations) {
						if (this.next !== null) throw new Error('Don\'t call chain on a migration that already has "next" assigned');
						var ptr = this;
						for (var i = 0, len = migrations.length; i < len; i++) {
							ptr.next = migrations[i];
							ptr = ptr.next;
						}
					},
					run: function(data) {
						var ptr = this;
						
						while (ptr !== null) {
							var result = ptr.apply(data);
							data = result.data;
							ptr = ptr.next;
						}
						
						return data;
					}
				};}
			}),
			
		});
		
		// Add default selectors
		ret.update({
			sel: {
				all: (function() { var sel = new ret.QSelAll(); return sel.sel = sel; })(),
				children: new ret.QSelAll(),
				none: new ret.QSelNone()
			}
		});
		
		return ret;
	}
});
package.build();
