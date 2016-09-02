/*
TODO: When querying for server-side elems, need to be able to add the queried elem to
the tree on the client-side. The current issue is that when the element's parent is
missing (because the address provided for the element had multiple components, and at
least one of the elements in the component-chain was missing client-side), the
element cannot be attached to the tree because no intermediate elements will be
loaded. Approach this by first writing a method to load all intermediate components
and attach them in order. Then the child can be attached.

Perhaps some data-definition language that is able to entirely describe a certain
connected subset of the full data tree, along with how much of each element in the
subset to load, would be useful for dynamism.

TODO: Maybe QRefs should never have their "value" include the root object's name
*/
var package = new PACK.pack.Package({ name: 'quickDev',
	dependencies: [ 'queries', 'random', 'e' ],
	buildFunc: function() {
		return {
			/* QSchema */
			QSchema: PACK.uth.makeClass({ name: 'QSchema',
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
						this.i = U.param(params, 'i', {});
						
						// this.c is resolved to a string if it's a constructor
						if (this.c.constructor !== String) this.c = this.c.title;
						
						// Ensure that all elements of this.i are instances of QSchema
						this.i = this.i.map(function(inner) {
							return inner instanceof PACK.quickDev.QSchema ? inner : new PACK.quickDev.QSchema(inner);
						});
					},
					actualize: function(params /* p, i */) {
						/*
						Note that this method actually generates children before it
						generates the parent. This means that at every instant during
						this method, no element ever exists without all its children.
						
						====Example call:
						
						var qd = qd;
						
						var schema = new qd.QSchema({ c: qd.QDict, p: { name: 'wrapper' }, i: [
							new qd.QSchema({ c: qd.QString, p: { name: 'inner1', value: 'hi' }),
							new qd.QSchema({ c: qd.QString, p: { name: 'inner2' }),
						]});
						
						schema.actualize({	p: { name: 'wrapperRenamed' }, i: [
							{ p: { name: 'inner1Renamed', value: 'inner1NewValue' }, i: [] },
							{ p: { name: 'inner2Renamed', value: 'inner2NewValue' }, i: [] },
						]});
						
						====Result:
						
						wrapperRenamed: {
							inner1Renamed: 'inner1NewValue',
							inner2Renamed: 'inner2NewValue',
						}
						*/
						
						// Generate the array of children first
						var childParams = U.param(params, 'i', {});
						var children = this.i.map(function(schema, k) {
							return schema.actualize(U.param(childParams, k, {}));
						});
						
						// Next generate the final containing element
						var myParams = U.param(params, 'p', {});
						var constructorParams = this.p.clone(myParams);
						var constructor = U.getByName({ root: C, name: this.c });
						var ret = new constructor(constructorParams);
						
						// Finally add the children to the element
						children.forEach(function(child) { ret.addChild(child); });
						
						return ret;
					},
					assign: function(params /* elem, recurse */) {
						var pass = this;
						var elem = U.param(params, 'elem');
						var recurse = U.param(params, 'recurse', true);
						
						var constructor = U.getByName({ root: C, name: this.c });
						
						if (!(elem instanceof constructor)) throw 'bad schema assignment (have "' + this.c + '", need "' + elem.constructor.title + '")';
						
						elem.schemaProperties().forEach(function(v, k) {
							if (k in pass.p) elem[k] = k[0] === '_'
								? U.getSerializable(pass.p[k])
								: pass.p[k];
						});
						
						if (recurse) {
							this.i.forEach(function(schema, k) {
								var child = elem.getNamedChild(k);
								
								if (child) 	schema.assign({ elem: child });
								else 		elem.addChild(schema.actualize());
							});
						}
					},
					validateElem: function(qElem) {
						// TODO: Validate!!! (allow subclasses? allow omitted children?)
					},
					simplified: function() {
						var ret = {};
						ret[this.c + '(' + JSON.stringify(this.p) + ')'] = this.i.map(function(schema) { return schema.simplified(); });
						return ret;
					},
				}},
			}),
			
			/* QUpdate */
			QUpdate: PACK.uth.makeClass({ name: 'QUpdate',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* request, start, end */) {
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
						this.start = U.param(params, 'start', null);
						this.end = U.param(params, 'end');
						
						this.pendingCount = 0;
						this.interval = null;
					},
					run: function() {
						var pass = this;
						
						this.pendingCount++;
						if (this.start) this.start();
						this.request(function(response) {
							pass.pendingCount--;
							pass.end(response);
						});
					},
					repeat: function(params /* delay, runInstantly, allowMultiple */) {
						if (this.interval !== null) throw new Error('Cannot begin another interval without clearing the first');
						
						var pass = this;
						var delay = U.param(params, 'delay');
						var runInstantly = U.param(params, 'runInstantly', true);
						var allowMultiple = U.param(params, 'allowMultiple', false);
						
						if (runInstantly && (allowMultiple || pass.pendingCount === 0)) this.run();
						
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
			
			/* QElem */
			QElem: PACK.uth.makeClass({ name: 'QElem',
				superclassName: 'QueryHandler',
				propertyNames: [ 'name' ],
				methods: function(sc, c) { return {
					init: function(params /* name, allowTransfer */) {
						sc.init.call(this, params);
						this.name = U.param(params, 'name').toString();
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
						while (ptr.par !== null) ptr = ptr.par;
						return ptr;
					},
					getChild: function(address) {
						if (address.length === 0) return this;
						throw 'cannot get children within non-set element "' + this.getAddress() + '"';
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
						var filterProps = U.param(filter, 'p', {});
						
						for (var k in filterProps) if (this[k] !== filterProps[k]) return false;
						
						return true;
					},
					
					$request: function(params /* command, params, onComplete, address */) {
						var command = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						var onComplete = U.param(params, 'onComplete', null);
						var address = U.param(params, 'address', null);
						
						U.request({
							params: {
								address: address !== null ? address : this.getAddress(),
								command: command,
								params: reqParams
							},
							onComplete: onComplete
						});
					},
					$persist: function(params /* onComplete, requireParent */) {
						/*
						Persists this element, causing it to exist on the server-side.
						*/
						var onComplete = U.param(params, 'onComplete', null);
						var requireParent = U.param(params, 'requireParent', false);
						
						this.$request({
							address: this.par.getAddress(),
							command: 'persistChild',
							params: { schemaParams: this.schemaParams() },
							onComplete: onComplete
						});
					},
					$load: function(params /* onComplete */) {
						/*
						Synchronizes this element with the corresponding server-side
						element. Gets the schema of the server-side element with a
						calling address, and assigns that schema to itself.
						*/
						var pass = this;
						var onComplete = U.param(params, 'onComplete', null);
						
						this.$request({ command: 'getSchema', onComplete: function(response) {
							var schema = new PACK.quickDev.QSchema(response.schemaParams);
							schema.assign({ elem: pass });
							onComplete(pass);
						}});
					},
					$getSchema: function(params /* onComplete */) {
						var onComplete = U.param(params, 'onComplete');
						
						this.$request({	command: 'getSchema', onComplete: onComplete });
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						
						if (com === 'getSchema') {
						
							return { schemaParams: this.schemaParams() };
						
						}
						
						return {
							status: 1,
							msg: '"' + this.getAddress() 
								+ '" (' + this.constructor.title + ') '
								+ 'didn\'t recognize command "' + com + '"'
						};
					},
					
					simplified: function() { throw 'not implemented'; },
					
					schemaConstructorName: function() {
						// Return the name that can be used to reference this class' name.
						// Can be a period-delimited string to reference deep classes.
						return this.constructor.title;
					},
					schemaProperties: function() {
						// Returns the list of properties that need to be included in the
						// schema that describes this QElem.
						return { name: this.name };
					},
					schemaChildren: function() {
						// Returns the list of children for this QElem that need to be
						// included in the schema.
						return {};
					},
					schemaParams: function(params /* recurse */) {
						/*
						Returns an object representing parameters for a PACK.quickDev.QSchema
						object. The parameters can be used raw, but to gain quick
						additional functionality the result of schemaParams() can be plugged
						into the QSchema constructor.
						
						e.g.
						
						var elem = // Some instance of QElem
						
						var schemaParams = elem.schemaParams();
						
						// Can analyze schemaParams and do stuff
						
						// Convenient functionality after building QSchema:
						var schema = new PACK.quickDev.QSchema(schemaParams);
						
						schema.assign(elem); // Quickly assign schema properties to an element
						schema.actualize();	 // Quickly create a new element based on this schema
						//...
						
						*/
						var recurse = U.param(params, 'recurse', true);
						
						var ret = {
							c: this.schemaConstructorName(),
							p: this.schemaProperties(),
						};
						if (recurse) ret.i = this.schemaChildren().map(function(child) { return child.schemaParams(); });
						return ret;
					}
				}},
				statik: { NEXT_ID: 0 },
			}),
			QValue: PACK.uth.makeClass({ name: 'QValue',
				superclassName: 'QElem',
				propertyNames: [ 'value' ],
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						var value = U.param(params, 'value', null);
						
						sc.init.call(this, params);
						this.value = null;
						this.setValue(value);
					},
					setValue: function(value) { this.value = this.sanitizeAndValidate(value); },
					sanitizeAndValidate: function(value) { return value; },
					simplified: function() { return this.value; },
					
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({ value: this.value });
					},
				}}
			}),
			QSet: PACK.uth.makeClass({ name: 'QSet',
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
							if (child.par === this) return;
							throw new Error('child already has a parent');
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
						var ret = this.uncontainChild(child);
						if (ret !== null) {
							this.length--;
							ret.par = null;
						}
						return ret;
					},
					containChild: function(child) { throw 'not implemented'; },
					uncontainChild: function(child) { throw 'not implemented'; },
					getNamedChild: function(name) {
						return name in this.children ? this.children[name].use() : null;
					},
					getChild: function(address) {
						if (address.length === 0) return this.use();
						
						if (address.constructor !== Array) {
							if (address.constructor === String) address = address.split('.');
							else 								address = [ address ];
						}
						
						ptr = this.use();
						for (var i = 0, len = address.length; (i < len) && (ptr !== null); i++) {
							ptr = ptr.getNamedChild(address[i]);
						}
						
						return ptr;
					},
					setValue: function(k, v) {
						/*
						NOTE: This method doesn't follow references!!
						*/
						var c = this.children[k];
						if (!c) throw new Error('Can\'t set value for non-existant child: "' + k + '"');
						c.setValue(v);
					},
					
					forEach: function(cb) { this.children.forEach(cb); /* TODO: Something horribly wrong with this?? (try it) */ },
					
					matches: function(filter) {
						if (!sc.matches.call(this, filter)) return false;
						
						var pass = this;
						var filterChildren = U.param(filter, 'i', {});
						return filterChildren.every(function(filter, k) {
							var child = pass.children[k];
							return child && child.matches(filter);
						});
					},
					filterChildren: function(filter) {
						var ret = [];
						
						this.children.forEach(function(child, k) {
							if (child.matches(filter)) ret.push(child);
						});
						
						return ret;
					},
					
					schemaChildren: function() { return this.children; },
					
					$filter: function(params /* filter, addChildren, onComplete */) {
						var pass = this;
						var filter = U.param(params, 'filter');
						var addChildren = U.param(params, 'addChildren', true);
						var onComplete = U.param(params, 'onComplete', null);
						
						this.$request({
							command: 'filteredChildren',
							params: { filter: filter },
							onComplete: function(response) {
								var elems = response.schemaParamsList.map(function(schemaParams) {
									var schema = new PACK.quickDev.QSchema(schemaParams);
									return schema.actualize();
								});
								if (addChildren) {
									elems.forEach(function(elem) { pass.addChild(elem); });
								}
								onComplete(elems);
							}
						});
					},
					$getChild: function(params /* address, recurse, addChild, onComplete, useClientSide */) {
						var pass = this;
						var address = U.param(params, 'address');
						// In case the request elem is a QSet, give control over whether
						// or not the QSet loads its children.
						var recurse = U.param(params, 'recurse', true);
						var addChild = U.param(params, 'addChild', false);
						var onComplete = U.param(params, 'onComplete', null);
						var useClientSide = U.param(params, 'useClientSide', false);
						
						var addrPcs = address.split('.');
						if (addChild && addrPcs.length > 1) throw new Error('Cannot add retrieved child because it doesn\'t go directly in its parent');
						
						if (useClientSide) {
							var elem = this.getChild(address);
							if (elem !== null) { onComplete(elem); return; }
						}
						
						this.$request({ command: 'getChild', params: { address: address, recurse: recurse }, onComplete: function(response) {
							var schema = new PACK.quickDev.QSchema(response.schemaParams);
							
							var elem = schema.actualize();
							
							if (addChild) pass.addChild(elem);
							
							onComplete(elem);
						}});
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
						
						if (com === 'persistChild') {				/* schemaParams */
							
							var schemaParams = U.param(reqParams, 'schemaParams');
							
							var child = new PACK.quickDev.QSchema(schemaParams).actualize();
							this.addChild(child);
							
							return { msg: 'success' };
							
						} else if (com === 'filteredChildren') {	/* filter */
							
							var filter = U.param(reqParams, 'filter');
							
							var children = this.filterChildren(filter);
							return { schemaParamsList: children.map(function(child) { return child.schemaParams(); }) };
							
						} else if (com === 'getChild') {			/* address, recurse */
							
							// TODO: This fails when "address" has multiple components!!
							var address = U.param(reqParams, 'address');
							var recurse = U.param(reqParams, 'recurse', true);
							
							// TODO: Probably an issue here; specifying a single-component address
							// won't resolve QRefs, multiple-component addresses will. Need more
							// control to specify whether or not to resolve references.
							var addressPcs = address.split('.');
							if (addressPcs.length === 1) {
								var child = this.children[address];
							} else {
								var child = this.getChild(address);
							}
							
							return { schemaParams: child ? child.schemaParams({ recurse: recurse}) : null };
							
						}
						
						return sc.handleQuery.call(this, params);
					}
				}}
			}),
			QGen: PACK.uth.makeClass({ name: 'QGen',
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
						    find the childs "contact.email" address element (a QString),
						    and extract the "value" property to provide a key for indexing.
						*/
						sc.init.call(this, params);
						this._schema = U.pasam(params, '_schema');
						this._initChild = U.pasam(params, '_initChild', null);
						this.prop = U.param(params, 'prop');
						
						var lastDot = this.prop.indexOf('/');
						if (~lastDot) {
							this.childAddress = this.prop.substr(0, lastDot);
							this.childProp = this.prop.substr(lastDot + 1);
						} else {
							this.childAddress = '';
							this.childProp = this.prop;
						}
					},
					validateChild: function(child) {
						this._schema.v.validateElem(child);
					},
					getNewChild: function(params /* */) {
						/*
						Here's the pickle: When a QGen generates a new child, it needs to
						have some way to reference that child. This is done via the "prop"
						property, which specifies how to determine a unique identifier for
						each child. This identifier needs to be found, because it must be
						used to index the child in the parent. When a QRef is added to a
						QGen, the QRef doesn't have a parent yet, so it obviously can't be
						aware of the element it refers to. This is an issue when a QGen
						needs to be able to index deep into a child in order to determine
						its key. This can fail with QRefs because attempting to index
						deeper through a QRef requires the QRef to find its referenced
						element - which can't be done before it's attached to the parent.
						*/
						var child = this._schema.v.actualize({ p: { name: '-generated-' } });
						if (this._initChild) this._initChild.v(child, params, this.length);
						var id = child.getChild('id');
						if (id !== null) id.setValue(this.length);
						
						this.addChild(child);
						return child;
					},
					getChildProp: function(elem) {
						var propElem = elem.getChild(this.childAddress);
						
						if (propElem === null) throw new Error('Invalid child "' + elem.getAddress() + '" doesn\'t contain prop child: "' + this.childAddress + '/' + this.childProp + '"');
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
					
					$getNewChild: function(params /* params, onComplete */) {
						var onComplete = U.param(params, 'onComplete', null);
						var reqParams = U.param(params, 'params', {});
						
						U.request({
							params: {
								address: this.getAddress(),
								command: 'getNewChild',
								initParams: reqParams
							},
							onComplete: onComplete
						});
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						
						if (com === 'getNewChild') {
							var session = params.session;
							var initParams = U.param(params, 'initParams', {});
							initParams.session = session;
							
							var child = this.getNewChild(initParams);
							return { schema: child.schemaParams() };
						}
						
						return sc.handleQuery.call(this, params);
					}
				}}
			}),
			QDict: PACK.uth.makeClass({ name: 'QDict',
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
					removeChild: function(child) {
						delete this.children[child.name];
					},
					simplified: function(child) {
						var ret = {};
						for (var k in this.children) ret[k] = this.children[k].simplified();
						return ret;
					},
				}}
			}),
			
			/* QValue subclasses */
			QRef: PACK.uth.makeClass({ name: 'QRef',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
					},
					
					use: function() {
						var ref = this.getRef();
						return ref === null ? null : ref.use();
					},
					
					rootAddr: function() {
						var dot = this.value.indexOf('.');
						if (~dot) return this.value.substr(dot + 1);
						return '';
					},
					getRef: function() {
						var root = this.getRoot();
						
						var dot = this.value.indexOf('.');
						if (~dot) {
							var rootName = this.value.substr(0, dot);
							var relAddr = this.value.substr(dot + 1);
						} else {
							var rootName = this.value;
							var relAddr = '';
						}
						if (rootName !== root.name) throw new Error('bad address doesn\'t begin with root name');
						
						return root.getChild(relAddr);
					},
					setRef: function(elem) {
						this.setValue(elem.getAddress());
					},
					sanitizeAndValidate: function(value) {
						if (value instanceof PACK.quickDev.QElem) value = value.getAddress();
						
						if (value.constructor !== String) throw 'invalid reference address';
						
						return value;
					},
					
					$getRef: function(params /* useClientValue, addRef, recurse, onComplete */) {
						/*
						"addRef" is much more complicated than "addChild", because a reference
						can be nested anywhere inside the data-tree, not just in the element
						which had "$getRef" called on it.
						*/
						var useClientValue = U.param(params, 'useClientValue', false);
						var addRef = U.param(params, 'addRef', true);
						var recurse = U.param(params, 'recurse', true);
						var onComplete = U.param(params, 'onComplete', null);
						
						if (useClientValue) {
							var ref = this.getRef();
							if (ref !== null) { onComplete(ref); return; }
						}
						
						// TODO: TEST THIS SHIZ!!!! The ref couldn't find a client value, so its asks the root to find one for it.
						this.getRoot().$getChild({ address: this.rootAddr(),
							addChild: addRef,
							recurse: recurse,
							useClientValue: false,
							onComplete: onComplete
						});
					},
					
					schemaParams: function(params /* recurse */) {
						return sc.schemaParams.call(this, params).update({ r: {
							// TODO: Add in referenced elem here
						}});
					}
				}}
			}),
			QString: PACK.uth.makeClass({ name: 'QString',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value, minLen, maxLen */) {
						sc.init.call(this, params);
						this.minLen = U.param(params, 'minLen', null);
						this.maxLen = U.param(params, 'maxLen', null);
					},
					sanitizeAndValidate: function(value) {
						value = value === null ? '' : value.toString();
						
						if (this.minLen !== null && value.length < this.minLen) throw new Error('need min length of ' + this.minLen);
						if (this.maxLen !== null && value.length > this.maxLen) throw new Error('need max length of ' + this.maxLen);
						
						return value;
					},
				}}
			}),
			QInt: PACK.uth.makeClass({ name: 'QInt',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						var intValue = parseInt(value);
						if (isNaN(intValue)) throw 'invalid integer value "' + value + '" for "' + this.getAddress() + '"';
						return intValue;
					},
				}; }
			}),
			QVector2D: PACK.uth.makeClass({ name: 'QVector2D',
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
			QColor: PACK.uth.makeClass({ name: 'QColor',
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
			})
		};
	}
});
package.build();
