var package = new PACK.pack.Package({ name: 'quickDev',
	dependencies: [ 'queries', 'random' ],
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
						
						var myParams = U.param(params, 'p', {});
						var childParams = U.param(params, 'i', {});
						
						var constructorParams = this.p.clone(myParams);
						
						var constructor = U.getByName({ root: C, name: this.c });
						
						var ret = new constructor(constructorParams);
						this.i.forEach(function(schema, k) {
							ret.addChild(schema.actualize(U.param(childParams, k, {})));
						});
						
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
			
			/* QElem */
			QElem: PACK.uth.makeClass({ name: 'QElem',
				superclassName: 'QueryHandler',
				propertyNames: [ 'name' ],
				methods: function(sc, c) { return {
					init: function(params /* name */) {
						sc.init.call(this, params);
						this.name = U.param(params, 'name', '-unnamed-');
						this.par = null;
						
						this.id = U.id(c.NEXT_ID++);
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
					
					$persist: function(params /* onComplete, requireParent */) {
						/*
						Persists this element, causing it to exist on the server-side.
						*/
						var onComplete = U.param(params, 'onComplete', null);
						var requireParent = U.param(params, 'requireParent', false);
						
						U.request({
							params: {
								address: this.par.getAddress(),
								command: 'persistChild',
								schemaParams: this.schemaParams()
							},
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
						
						U.request({
							params: {
								address: this.getAddress(),
								command: 'getSchema'
							},
							onComplete: function(response) {
								var schema = new PACK.quickDev.QSchema(response.schemaParams);
								
								schema.assign({ elem: pass });
								
								onComplete(pass);
							}
						});
					},
					$getSchema: function(params /* onComplete */) {
						var onComplete = U.param(params, 'onComplete');
						
						U.request({
							params: {
								address: this.getAddress(),
								command: 'getSchema'
							},
							onComplete: onComplete
						});
					},
					handleQuery: function(params) {
						var com = params.command;
						
						if (com === 'getSchema') {
						
							return {
								schemaParams: this.schemaParams()
							};
						
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
					schemaParams: function() {
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
						return {
							c: this.schemaConstructorName(),
							p: this.schemaProperties(),
							i: this.schemaChildren().map(function(child) { return child.schemaParams(); })
						};
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
					},
					validateChild: function(child) {
						if (child.par !== null) throw 'child already has a parent';
					},
					addChild: function(child) {
						if (child.par === this) return;
						this.validateChild(child);
						this.containChild(child);
						child.par = this;
						
						return child;
					},
					remChild: function(child) {
						this.uncontainChild(child);
						child.par = null;
					},
					containChild: function(child) { throw 'not implemented'; },
					uncontainChild: function(child) { throw 'not implemented'; },
					getNamedChild: function(name) { throw 'not implemented'; },
					getChild: function(address) {
						if (address.length === 0) return this;
						
						if (address.constructor !== Array) address = address.split('.');
						
						ptr = this;
						for (var i = 0, len = address.length; i < len; i++) {
							ptr = ptr.getNamedChild(address[i]);
							if (ptr === null) break;
						}
						
						return ptr;
					},
					getChildren: function() { throw 'not implemented'; },
					
					matches: function(filter) {
						if (!sc.matches.call(this, filter)) return false;
						
						var pass = this;
						var filterChildren = U.param(filter, 'i', {});
						return filterChildren.every(function(filter, k) {
							var child = pass.getChild(k);
							return child && child.matches(filter);
						});
					},
					filterChildren: function(filter) {
						var ret = [];
						
						this.getChildren().forEach(function(child, k) {
							if (child.matches(filter)) ret.push(child);
						});
						
						return ret;
					},
					
					schemaChildren: function() { return this.getChildren(); },
					
					$filter: function(params /* filter, onComplete */) {
						var onComplete = U.param(params, 'onComplete', null);
						var filter = U.param(params, 'filter');
						
						U.request({
							params: {
								address: this.getAddress(),
								filter: filter,
								command: 'filteredChildren'
							},
							onComplete: onComplete
						});
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						
						if (com === 'persistChild') {
							
							var schemaParams = params.schemaParams;
							
							var child = new PACK.quickDev.QSchema(schemaParams).actualize();
							this.addChild(child);
							
							return { msg: 'success', id: child.id };
							
						} else if (com === 'filteredChildren') {
							var filter = U.param(params, 'filter');
							
							var children = this.filterChildren(filter);
							
							return {
								schemaParams: children.map(function(child) { return child.schemaParams(); })
							};
						}
						
						return sc.handleQuery.call(this, params);
					}
				}}
			}),
			QGen: PACK.uth.makeClass({ name: 'QGen',
				superclassName: 'QSet',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* name, _schema, childNameProp */) {
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
						this.children = {};
					},
					validateChild: function(child) {
						this._schema.v.validateElem(child);
					},
					getNewChild: function(params /* */) {
						var child = this._schema.v.actualize();
						if (this._initChild) this._initChild.v(child, params);
						this.addChild(child);
						return child;
					},
					containChild: function(child) {
						var prop = child.getChild(this.childAddress)[this.childProp];
						this.children[prop] = child;
					},
					uncontainChild: function(child) {
						var prop = child.getChild(this.childAddress)[this.childProp];
						delete this.children[prop];
					},
					simplified: function() { return this.children.map(function(c) { return c.simplified(); } ); },
					getNamedChild: function(name) {
						return name in this.children ? this.children[name] : null;
					},
					getChildren: function() { return this.children; },
					
					schemaProperties: function() {
						return sc.schemaProperties.call(this).update({
							_schema: this._schema.name
						});
					},
					
					$getNewChild: function(params /* params, onComplete */) {
						var onComplete = U.param(params, 'onComplete', null);
						
						U.request({
							params: {
								address: this.getAddress(),
								command: 'getNewChild',
								params: params
							},
							onComplete: onComplete
						});
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						
						if (com === 'getNewChild') {
							var session = params.session;
							var params = U.param(params, 'params', {});
							
							params.session = session;
							
							var child = this.getNewChild(params);
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
						sc.init.call(this, params);
						var children = U.param(params, 'children', []);
						
						this.children = {};
						for (var i = 0, len = children.length; i < len; i++) this.addChild(children[i]);
					},
					containChild: function(child) {
						if (child.name in this.children) throw 'tried to overwrite "' + child.name + '" in "' + this.getAddress() + '"';
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
					getNamedChild: function(name) {
						return name in this.children ? this.children[name] : null;
					},
					getChildren: function() { return this.children; }
				}}
			}),
			
			/* QValue subclasses */
			QRef: PACK.uth.makeClass({ name: 'QRef',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* name, value, baseAddress */) {
						// Set the base address before calling super (super will call
						// sanitizeAndValidate, which relies on knowing baseAddress)
						this.baseAddress = U.param(params, 'baseAddress', null);
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						if (value instanceof PACK.quickDev.QElem) value = value.getAddress();
						
						if (value.constructor !== String) throw 'invalid reference address';
						
						return this.baseAddress ? this.baseAddress + '.' + value : value;
					},
				}}
			}),
			QString: PACK.uth.makeClass({ name: 'QString',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						return value ? value.toString() : '';
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
