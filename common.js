/*
TODO: Switch to POST queries? Eventually queries will exceed the recommended
size for GET (make the "post" parameter of U.request default to true)

The following top-level variables exist regardless of whether code is being
run on server or client side:
	
	-S: Index of non-serializable content that needs to be serialized 
		at some point.
		For example, a function that needs to be referenced dynamically
		on client and server-side is referenced instead by its string
		index in S (allowing for serialization).
	-U: Contains utility methods
	-C: Default class directory
	-PACK: Contains all the packages
	-DB: Reference to the mongodb database object
*/

// Add convenience methods to pre-existing classes

[	{	target: Object.prototype,
		props: {
			simp: function() {
				var ret = [];
				for (var k in this) {
					var val = this[k];
					if (val !== null && val.constructor !== String && val.constructor !== Number && val.constructor !== Boolean) {
						if (typeof val === 'undefined') val = 'undefined';
						else 							val = ('title' in val.constructor) ? val.constructor.title : val.constructor.name;
					} else {
						if (val && val.constructor === String && val.length > 30) val = val.substr(0, 30) + '...';
					}
					ret.push(k + ': ' + val);
				}
				return '{ ' + ret.join(', ') + ' }';
			},
			update: function(obj) {
				for (var k in obj) this[k] = obj[k];
				return this;
			},
			safeUpdate: function(obj) {
				for (var k in obj)
					if (k in this) return false;
				
				this.update(obj);
				return true;
			},
			clone: function(props) {
				var ret = {}.update(this);
				return U.exists(props) ? ret.update(props) : ret;
			},
			instanceProperties: function() {
				return this.propertyNames.reduce(function(ret, v1) {
					ret[v1] = this[v1];
					return ret;
				}, {});
			},
			instanceCopy: function(params) {
				var properties = this.instanceProperties();
				if (U.def(params)) properties.update(params);
				
				return new this.constructor(properties);
			},
			forEach: function(it) {
				for (var k in this) it(this[k], k, this);
			},
			map: function(it) {
				var ret = {};
				for (var k in this) ret[k] = it(this[k], k, this);
				return ret;
			},
			every: function(it) {
				for (var k in this) if (!it(this[k], k, this)) return false;
				return true;
			},
			toArray: function() {
				var ret = [];
				this.forEach(function(v) { ret.push(v); });
				return ret;
			},
			flatten: function(prefix) {
				var ret = {};
				for (var k in this) {
					var kk = U.exists(prefix) ? (prefix + '.' + k) : k;
					var o = this[k];
					if (U.isObj(o) && o.constructor === Object) {
						
						var flattened = o.flatten(kk);
						for (var j in flattened) ret[j] = flattened[j];
						
					} else {
						
						ret[kk] = this[k];
						
					}
				}
				return ret;					
			},
			hasProps: function(propNames) {
				for (var i = 0, len = propNames.length; i < len; i++)
					if (!(propNames[i] in this)) return false;
				
				return true;
			},
		},
	},
	{ 	target: String.prototype,
		props: {
			contains: function(str) {
				return this.indexOf(str) !== -1;
			},
			padding: function(width, char) {
				if (!U.exists(char)) char = ' ';
				
				var len = width - this.length;
				var ret = '';
				while (ret.length < len) ret += char;
				
				return ret;
			},
			padLeft: function(width, char) {
				return this.padding(width, char) + this;
			},
			padRight: function(width, char) {
				return this + this.padding(width, char);
			}
		},
	},
	{ 	target: Array.prototype,
		props: {
			contains: function(val) {
				return this.indexOf(val) !== -1;
			},
		},
	},
].forEach(function(obj) {
	var trg = obj.target;
	var props = obj.props;
	for (var k in props) {
		Object.defineProperty(trg, k, {
			enumerable: false, configurable: false, writable: true,
			value: props[k]
		});
	}
});

// Build utility library
global.S = {};		// All serializables are stored here
global.C = {};		// All classes are stored here
global.PACK = {};	// All packages are stored here
global.U = {
	isServer: typeof window === 'undefined' ? function() { return true; } : function() { return false; },
	
	// Parameter utility
	param: function(params, name, def) {
		/*
		Used to retrieve an item from an object. If def is provided and no
		item under the "name" key is found, def is returned.
		*/
		if (U.isObj(params) && (name in params)) return params[name];
		if (U.exists(def)) return def;
		
		throw new Error('missing param: "' + name + '"');
	},
	palam: function(params, name, paramFunc) {
		/*
		Lambda-param. Exactly like U.param, but uses a lambda to retrieve
		the default value (if none was found) instead of a pre-computed
		value.
		*/
		var ret = U.param(params, name, paramFunc);
		return U.isObj(ret, Function) ? ret() : ret;
	},
	pasam: function(params, name, def) {
		/*
		Serializable-param. If the result of U.param is a string
		for the given parameters, return the serializable under the
		string's name.
		*/
		var p = U.param(params, name, def);
		
		if (p === null || p.constructor !== String) return p;
		
		return U.getSerializable(p)
	},
	pawam: function(params, name, def) {
		/*
		Wire-param. Used to reconstitute an object that was sent over
		the wire. If U.param doesn't return def, use U.wireGet
		to rebuild the value.
		*/
		var p = U.param(params, name, def);
		
		if (p === def) return def;
		
		return U.wireGet(p);
	},
	exists: function(p) {
		return typeof p !== 'undefined';
	},
	
	// Object utility
	isObj: function(obj, cls) {
		try { return ('constructor' in obj) && (!cls || obj.constructor === cls); } catch(e) {};
		return false;
	},
	isClassedObj: function(obj) {
		try { return ('constructor' in obj) && ('title' in obj.constructor) } catch(e) {};
		return false;
	},
	instanceOf: function(obj, cls) {
		return U.isObj(obj) && (obj instanceof cls);
	},
	isEmptyObj: function(v) {
		for (k in v) return false;
		return true;
	},
	isEmpty: function(v) {
		if (v.constructor === Array) return v.length === 0;
		return U.isEmptyObj(v);
	},
	length: function(v) {
		if (v.constructor === Array) return v.length;
		return Object.keys(v).length;
	},
	isError: function(object) {
		try { return object.constructor === Error; } catch(e) {};
		return false;
	},
	firstKey: function(obj) {
		for (var k in obj) return k;
		throw new Error('Cannot get first property of empty object');
	},
	firstVal: function(obj) {
		return obj[U.firstKey(obj)];
	},
	matches: function(o, o2) {
		for (var k in o2) if (!(k in o) || o[k] !== o2[k]) return false;
		return true;
	},
	deepSet: function(params /* name, root, value, overwrite */) {
		var name = U.param(params, 'name');
		var root = U.param(params, 'root');
		var value = U.param(params, 'value');
		var overwrite = U.param(params, 'overwrite', false);
		
		var comps = name.split('.');
		
		var ptr = root;
		for (var i = 0, len = comps.length - 1; i < len; i++) {
			var c = comps[i];
			if (!(c in ptr)) ptr[c] = {};
			ptr = ptr[c];
		}
		var lastComp = comps[comps.length - 1];
		if (!overwrite && (lastComp in ptr)) throw new Error('tried to overwrite value: "' + name + '"');
		
		ptr[lastComp] = value;
	},
	deepGet: function(params /* name, root, createIfNone */) {
		var name = U.param(params, 'name');
		var root = U.param(params, 'root');
		var createIfNone = U.param(params, 'createIfNone', false);
		
		var comps = name.length === 0 ? [] : name.split('.');
		var ptr = root;
		for (var i = 0, len = comps.length; i < len; i++) {
			var c = comps[i];
			if (!(c in ptr)) {
				if (createIfNone)	ptr[c] = {};
				else 				return null;
			}
			ptr = ptr[c];
		}
		return ptr;
	},
	
	// Class utility
	makeClass: function(params /* namespace, name, superclassName, propertyNames, methods, statik */) {
		var namespace = U.param(params, 'namespace', global.C);
		
		if (namespace.constructor === String) {
			var comps = namespace.split('.');
			var dir = global.C;
			namespace = U.deepGet({ name: namespace, root: dir, createIfNone: false });
		}
		
		var name = U.param(params, 'name');
		var methods = U.param(params, 'methods');
		var statik = U.param(params, 'statik', {});
		var propertyNames = U.param(params, 'propertyNames', []);
		
		if (name in namespace) throw 'tried to overwrite class "' + name + '"';
		
		var superclassName = U.param(params, 'superclassName', null);
		if (superclassName !== null) {
			if (superclassName in namespace)	var superclass = namespace[superclassName];
			else 								throw 'bad superclass name: "' + superclassName + '"';
		} else {
			var superclass = null;
		}
		
		eval([ // Needed to eval in order to have a named function in debug. Is there a better way??
			'var ' + name + ' = function(params) {',
				'/* ' + name + ' */',
				//'if (!(\'init\' in this)) console.log(\'' + name + '\');',
				'this.init(U.exists(params) ? params : {});',
			'};',
			'namespace[name] = ' + name + ';',
			'delete ' + name + ';',
		].join(''));
		var c = namespace[name];
		c.title = name;
		
		if (methods.constructor === Function) methods = methods(superclass ? superclass.prototype : null, c);
		
		if (!('init' in methods)) throw new Error('missing "init" class method');
		
		[	'constructor',
			'parent',
			'propertyNames',
			'instanceProperties',
			'instanceCopy',
			'update'
		].forEach(function(reserved) { if (methods.hasOwnProperty(reserved)) throw new Error('bad property: "' + reserved + '"'); } );
		
		[	'name'
		].forEach(function(reserved) { if (statik.hasOwnProperty(reserved)) throw 'bad statik property: "' + reserved + '"'; });
		
		if (superclass) { c.prototype = Object.create(superclass.prototype); }
		
		methods.update({
			constructor: c,
			parent: superclass ? superclass.prototype : null,
			propertyNames: (superclass ? superclass.prototype.propertyNames : []).concat(propertyNames)
		});
		
		c.prototype.update(methods);
		c.update(statik);
		
		return c;
	},
	
	// Serialization utility
	wirePut: function(obj, arr) {
		/*
		Note the convention: This method is particularly named "wirePut" because
		it's a form of serialization that should only be used for the wire, and
		has no real application anywhere else.
		*/
		if (!U.exists(arr)) arr = [];
		
		var ind = arr.indexOf(obj);
		if (~ind) return { arr: arr, ind: ind };
		
		ind = arr.length;
		arr.push(obj);
		
		if (U.isClassedObj(obj)) {
			
			var ps = obj.propertyNames;
			var data = {};
			for (var i = 0, len = ps.length; i < len; i++) {
				var k = ps[i];
				data[k] = U.wirePut(obj[k], arr).ind;
			}
			arr[ind] = { __c: obj.constructor.title, p: data };
		
		} else if (U.isObj(obj)) {
			
			if (obj.constructor === Object) {
				
				for (var k in obj) {
					if (k === '_c') throw new Error('Illegal key: "_c"');
					obj[k] = U.wirePut(obj[k], arr).ind;
				}
				
			} else if (obj.constructor === Array) {
				
				for (var i = 0; i < obj.length; i++) obj[i] = U.wirePut(obj[i], arr).ind;
				
			}
			
		}
		
		// Skip `null`, undefined, integer, string cases etc.
		
		return { arr: arr, ind: ind };
	},
	wireGet: function(arr, ind, built) {
		if (!U.exists(built)) built = U.toArray(arr.length);
		if (!U.exists(ind)) ind = 0;
		
		// This is a dumb hack to deal with the actual value being
		// null: put EVERY value in an array lol
		// TODO: Is this even that bad?
		if (built[ind] !== null) return built[ind][0];
		
		var d = arr[ind];
		var value = null;
		
		if (U.isObj(d)) {
			
			if (d.constructor === Object) {
				
				if ('__c' in d) {
					
					// TODO: This is bad. In circular cases, need to have the object
					// already within "built", but that means it has to be constructed
					// before its parameters are known. Because of cases involving
					// mandatory parameters, need to construct "dud" parameters.
					
					// Get constructor
					var cls = U.deepGet({ root: global.C, name: d.__c });
					
					// Construct dud parameters
					var dudParams = {};
					var ps = cls.prototype.propertyNames;
					for (var i = 0, len = ps.length; i < len; i++) dudParams[ps[i]] = null;
					
					// value is a classed object
					built[ind] = [ new cls(dudParams) ];
					
					// Construct actual parameters, and call init
					var params = {};
					for (var k in d.p) params[k] = U.wireGet(arr, d.p[k], built);
					built[ind][0].init(params);
					return built[ind][0];
					
				} else {
					
					// value is an ordinary object
					built[ind] = [ {} ];
					for (var k in d) built[ind][0][k] = U.wireGet(arr, d[k], built);
					return built[ind][0];
					
				}
					
			} else if (d.constructor === Array) {
				
				// value is an array
				built[ind] =  [ [] ];
				for (var i = 0; i < d.length; i++) built[ind][0].push(U.wireGet(arr, d[i], built));
				return built[ind][0];
				
			}
			
		}
		
		built[ind] = [ d ];
		return built[ind][0];
	},
	addSerializable: function(params /* name, value */) {
		var name = U.param(params, 'name');
		var value = U.param(params, 'value');
		
		U.deepSet({
			root: global.S,
			name: name,
			value: value
		});
		return name;
	},
	addSerializables: function(paramsList /* [ { name, value }, ... ] */) {
		paramsList.forEach(U.addSerializable.bind(U));
	},
	getSerializable: function(name) {
		return {
			name: name,
			v: U.deepGet({ name: name, root: S })
		};
	},
	
	// Misc
	toArray: function(arrayLike) {
		/*
		Useful method for constructing arrays from a variety of inputs:
		
		- If `arrayLike` is an int n, return an array of n `null`s
		- If `arrayLike` is an object, return an array of all the object's
		  properties.
		- Otherwise apply `Array.prototype.slice` which will look a
		  `length` property, and return an array consisting of all the
		  index values of the input between 0 and the `length` value.
		*/
		if (arrayLike.constructor === Number) {
			var ret = [];
			for (var i = 0; i < arrayLike; i++) ret.push(null);
			return ret;
		}
		if (arrayLike.constructor === Object) {
			var ret = [];
			for (var k in arrayLike) ret.push(arrayLike[k]);
			return ret;
		}
		return Array.prototype.slice.call(arrayLike);
	},
	range: function(rng) {
		// Sneaky way of allowing x:y notation is using an object param
		if (rng.constructor === Object) {
			var k = U.firstKey(rng);
			var v = rng[k];
		} else {
			var k = 0;
			var v = rng;
		}
		
		var ret = [];
		for (var i = k; i < v; i++) ret.push(i);
		
		return ret;
	},
	id: function(n, len) {
		if (!U.exists(len)) len = 8;
		var hex = n.toString(16);
		
		while(hex.length < len) hex = '0' + hex;
		
		return hex;
	},
	charId: function(n, len) {
		/*
		Returns an id comprised entirely of characters starting from lowercase "a".
		There will be no integer characters. For values of "n" greater than 26
		there will be funky non-alpha characters.
		*/
		var hex = U.id(n, len);
		
		var letters = '';
		for (var i = 0; i < hex.length; i++) {
			var c = hex[i];
			letters += (c >= '0' && c <= '9') 
				? String.fromCharCode('a'.charCodeAt(0) + parseInt(c))
				: String.fromCharCode(c.charCodeAt(0) + 10);
		}
		
		return letters;
	},
	createDelay: function(params /* task, delay, repeat */) {
		var task = U.param(params, 'task');
		var delay = U.param(params, 'delay');
		var repeat = U.param(params, 'repeat', false);
		
		var start = repeat ? setInterval : setTimeout;
		var end = repeat ? clearInterval : clearTimeout;
		
		return {
			ref: start(task, delay),
			end: function() { end(U.ref); }
		};
	}
	
};

/*
Only one package is built in an ad-hoc manner:

-PACK
This package is the package which facilitates the proper method of building
packages. If it were to be built in the standard way, it would have to build
itself.
*/

// PACKAGE: Packaging
global.PACK.pack = {
	Package: U.makeClass({ name: 'Package',
		propertyNames: [ 'name', 'buildFunc', ],
		methods: {
			init: function(params /* name, dependencies, buildFunc, runAfter */) {
				this.name = U.param(params, 'name');
				this.dependencies = U.param(params, 'dependencies', []);
				this.buildFunc = U.param(params, 'buildFunc');
				this.runAfter = U.param(params, 'runAfter', null);
				
				this.script = U.isServer() ? null : document.currentScript;
				this.neededDeps = 0;
				this.receivedDeps = 0;
				
				this.depErrorChecking = {};
			},
			stepBuild: function(script) {
				/*
				This gets called on the package each time one of its dependencies
				is loaded. The number of times this method gets called is counted,
				and once it's called for each dependency it calls this.endBuild().
				*/
				if (script.src in this.depErrorChecking) throw new Error('double-loaded dependency "' + script.src + '"');
				this.depErrorChecking[script.src] = 'loaded';
				
				this.receivedDeps++;
				if (this.receivedDeps >= this.neededDeps) {
					// Clean up the ugly properties that were attached to the dom
					delete script.__waiting[this.name];
					if (U.isEmptyObj(script.__waiting)) delete script.__waiting;
					
					this.endBuild();
				}
			},
			endBuild: function() {
				/*
				Regardless of whether we're on the server or client side,
				this is the function that should run once all dependencies
				are loaded.
				*/
				if (this.name in PACK) throw 'double-loaded dependency "' + this.name + '"';
				
				PACK[this.name] = this.buildFunc(this.name);
				console.log('Built "' + this.name + '"');
				
				if (!U.isServer()) {
					var waiting = this.script.__waiting;
					for (var k in waiting) waiting[k].stepBuild(this.script);
				}
				
				if (this.runAfter) this.runAfter();
			},
			build: function() {
				/*
				Loads any dependencies the package needs, builds the package,
				and then runs this.runAfter in an environment where the package
				and all its dependencies are accessible through PACK.
				
				This method works substantially differently depending on
				whether it is executing on server or client side.
				*/
				var pass = this;
				
				// Collect missing dependencies
				var missingDeps = this.dependencies.filter(function(dep) { return !(dep in PACK); });
				
				// If there are no dependencies then instantly build
				if (missingDeps.length === 0) { this.endBuild(); return; }
				
				if (U.isServer()) {
					
					missingDeps.forEach(function(dependencyName) {
						// Possible that one of this package's dependencies
						// is also a dependency of a subpackage. In this case
						// the subpackage has already loaded the dependency.
						if (dependencyName in PACK) return;
						
						// This require statement needs to add the dependencyName key to PACK
						require('./apps/' + dependencyName + '/' + dependencyName + '.js');
						
						// Ensure the key was added
						if (!(dependencyName in PACK)) throw 'failed to load dependency "' + dependencyName + '"';
					});
					
					this.endBuild();
					
				} else {
					
					this.neededDeps = missingDeps.length;
					
					for (var i = 0, len = missingDeps.length; i < len; i++) {
						var depName = missingDeps[i];
						
						// TODO: All assets have the same version??
						
						// Get the asset version by checking the version of common.js
						// (common.js is guaranteed to exist)
						var ver = document.querySelector('script[src^="common.js"]').src;
						if (ver.contains('?')) 	ver = '?' + ver.split('?')[1];
						else 					ver = '';
						
						// The src ends with the version
						var src = 'apps/' + depName + '/' + depName + '.js' + ver;
						
						var script = document.querySelector('script[src="' + src + '"]');
						if (script === null) {
							var script = document.createElement('script');
							script.setAttribute('type', 'text/javascript');
							script.async = false;
							script.src = src;
							
							document.getElementsByTagName('head')[0].appendChild(script);
						}
						if (!('__waiting' in script)) script.__waiting = {};
						script.__waiting[this.name] = this;
					}
					
				}
			},
		},
	}),
};
