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
					actualize: function(params /* */) {
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
					
					$persist: function(params /* onComplete, requireParent */) {
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
						var onComplete = U.param(params, 'onComplete', null);
						
						U.request({
							params: {
								address: this.getAddress(),
								command: 'getSchema'
							},
							onComplete: function(response) {
								var schema = new PACK.quickDev.QSchema(response.schemaParams);
								
								// HEEERE: Now copy all properties from the schema to `this`
								
								onComplete(this);
							},
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
						sc.init.call(this, params);
						this.value = this.sanitizeAndValidate(U.param(params, 'value', null));
					},
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
					},
					remChild: function(child) {
						this.uncontainChild(child);
						child.par = null;
					},
					containChild: function(child) { throw 'not implemented'; },
					uncontainChild: function(child) { throw 'not implemented'; },
					getNamedChild: function(name) { throw 'not implemented'; },
					getChild: function(address) {
						if (address.constructor !== Array) address = address.split('.');
						
						if (address.length === 0) return this;
						
						ptr = this;
						for (var i = 0, len = address.length; i < len; i++) {
							ptr = ptr.getNamedChild(address[i]);
							if (ptr === null) break;
						}
						
						return ptr;
					},
					
					schemaChildren: function() { throw 'not implemented'; /* Force subclasses to implement */ },
					
					handleQuery: function(params) {
						var com = params.command;
						
						if (com === 'persistChild') {
							
							var schemaParams = params.schemaParams;
							
							var child = new PACK.quickDev.QSchema(schemaParams).actualize();
							this.addChild(child);
							
							return { msg: 'success', id: child.id };
							
						}
						
						return sc.handleQuery.call(this, params);
					},
				}}
			}),
			QGen: PACK.uth.makeClass({ name: 'QGen',
				superclassName: 'QSet',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* name, schema */) {
						sc.init.call(this, params);
						this.schema = U.pasam(params, 'schema');
						
						this.children = [];
					},
					validateChild: function(child) {
						this.schema.v.validateElem(child);
					},
					// generateChild: function(params /* */) { throw 'not implemented'; },
					getNewChild: function(params /* */) {
						var child = this.schema.v.actualize(params);
						this.addChild(child);
						return child;
					},
					containChild: function(child) {
						child.name = this.children.length;
						this.children.push(child);
					},
					uncontainChild: function(child) {
						this.children.splice(child.name, 1);
						child.name = '-removed from "' + this.getAddress() + '"-';
					},
					simplified: function() { return this.children.map(function(c) { return c.simplified(); } ); },
					getNamedChild: function(name) {
						var n = parseInt(name);
						if (isNaN(n)) throw 'bad QGen child name: "' + name + '"';
						return n >= 0 && n < this.children.length ? this.children[n] : null;
					},
					
					schemaChildren: function() { return this.children; }
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
					
					schemaChildren: function() { return this.children; }
				}}
			}),
			
			/* QValue subclasses */
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
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						var intValue = parseInt(value);
						if (isNaN(intValue)) throw 'invalid integer value "' + value + '" for "' + this.getAddress() + '"';
						return intValue;
					},
				}}
			}),
			QRef: PACK.uth.makeClass({ name: 'QRef',
				superclassName: 'QValue',
				methods: function(sc) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					sanitizeAndValidate: function(value) {
						if (value instanceof PACK.quickDev.QElem) value = value.getAddress();
						
						if (value.constructor !== String) throw 'invalid reference address';
						
						return value;
					},
				}}
			}),
		};
	}
});
package.build();
