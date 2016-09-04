(function() {
	/*
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
	*/
	
	// Add convenience methods to pre-existing classes
	var objectProps = [
		{	target: Object.prototype,
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
				forEach: function(cb) {
					for (var k in this) cb(this[k], k, this);
				},
				map: function(cb) {
					var ret = {};
					for (var k in this) ret[k] = cb(this[k], k, this);
					return ret;
				},
				every: function(cb) {
					for (var k in this) if (!cb(this[k], k, this)) return false;
					return true;
				},
				toArray: function() {
					var ret = [];
					this.forEach(function(v) { ret.push(v); });
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
				contains: function(str) {
					return this.indexOf(str) !== -1;
				},
			},
		},
	];
	
	for (var i in objectProps) {
		var trg = objectProps[i].target;
		var props = objectProps[i].props;
		
		for (var k in props) {
			Object.defineProperty(trg, k, {
				value: props[k],
				enumerable: false,
				configurable: false,
				writable: false
			});
		}
	}
	
	var isServer = typeof window === 'undefined';
	
	// Build utility library
	global.S = {};		// All serializables are stored here
	global.C = {};		// All classes are stored here
	global.PACK = {};	// All packages are stored here
	global.U = {
		isServer: function() {
			return isServer;
		},
		exists: function(p) {
			return typeof p !== 'undefined';
		},
		isEmptyObj: function(v) {
			for (k in v) return false;
			return true;
		},
		value: function(v, def) {
			return this.exists(v) ? v : def;
		},
		param: function(params, name, def) {
			if (U.exists(params) && (name in params) && U.exists(params[name])) return params[name];
			if (this.exists(def)) return def;
			
			throw new Error('missing param: "' + name + '"');
		},
		palam: function(params, name, paramFunc) {
			var ret = this.param(params, name, paramFunc);
			return ret === paramFunc ? paramFunc() : ret;
		},
		pasam: function(params, name, def) {
			var p = this.param(params, name, def);
			
			if (p === null || p.constructor !== String) return p;
			
			return this.getSerializable(p)
		},
		arr: function(arrayLike) {
			if (arrayLike.constructor === Object) {
				var ret = [];
				for (var k in arrayLike) ret.push(arrayLike[k]);
				return ret;
			}
			return Array.prototype.slice.call(arrayLike);
		},
		id: function(n, len) {
			if (!U.exists(len)) len = 8;
			var hex = n.toString(16);
			
			while(hex.length < len) hex = '0' + hex;
			
			return hex;
		},
		rng: function(rng) {
			// Sneaky way of allowing x:y notation is using an object param
			if (rng.constructor === Object) {
				var k = null;
				for (var kk in rng) { k = kk; break; }
				var v = rng[k];
			} else {
				var k = 0;
				var v = rng;
			}
			
			var ret = [];
			for (var i = k; i < v; i++) ret.push(i);
			
			return ret;
		},
		charId: function(n, len) {
			var hex = this.id(n, len);
			
			var letters = '';
			for (var i = 0; i < hex.length; i++) {
				var c = hex[i];
				letters += (c >= '0' && c <= '9') 
					? String.fromCharCode('a'.charCodeAt(0) + parseInt(c))
					: String.fromCharCode(c.charCodeAt(0) + 10);
			}
			
			return letters;
		},
		setByName: function(params /* name, root, value, overwrite */) {
			var name = U.param(params, 'name');
			var root = U.param(params, 'root');
			var value = U.param(params, 'value');
			var overwrite = U.param(params, 'overwrite', false);
			
			var comps = name.split('.');
			
			var ptr = root;
			for (var i = 0, len = comps.length; i < len - 1; i++) {
				var c = comps[i];
				if (!(c in ptr)) ptr[c] = {};
				ptr = ptr[c];
			}
			var lastComp = comps[comps.length - 1];
			if (!overwrite && (lastComp in ptr)) throw 'tried to overwrite value: "' + name + '"';
			
			ptr[lastComp] = value;
		},
		getByName: function(params /* name, root */) {
			var name = U.param(params, 'name');
			var root = U.param(params, 'root');
			
			var comps = name.length === 0 ? [] : name.split('.');
			var ptr = root;
			for (var i = 0, len = comps.length; i < len; i++) {
				var c = comps[i];
				if (!(c in ptr)) return null;
				ptr = ptr[c];
			}
			return ptr;
		},
		addSerializable: function(params /* name, value */) {
			var name = U.param(params, 'name');
			var value = U.param(params, 'value');
			
			this.setByName({
				root: global.S,
				name: name,
				value: value
			});
			return name;
		},
		getSerializable: function(name) {
			return {
				name: name,
				v: this.getByName({ name: name, root: S })
			};
		},
		equals: function(o, o2) {
			for (var k in o2) if (!(k in o) || o[k] !== o2[k]) return false;
			return true;
		},
		request: function(params /* url, params, onComplete, ref, json */) {
			var url = this.param(params, 'url', '');
			var reqParams = this.param(params, 'params', {});
			var onComplete = this.param(params, 'onComplete', null);
			var json = this.param(params, 'json', true);
			
			// User-specified value that doesn't travel client side
			// Discriminates the query from others
			var ref = this.param(params, 'ref', null); 
			
			var req = new XMLHttpRequest();
			
			if (onComplete) {
				var pass = this;
				req.onreadystatechange = function() {
					if (pass.equals(req, { readyState: 4, status: 200 })) {
						if (json) {
							var o = JSON.parse(req.responseText);
							if (o.code !== 0) { console.log(o); throw new Error('Bad API use: ' + o.msg); }
						} else {
							var o = req.responseText;
						}
						onComplete(o, ref);
					}
				};
			}
			
			if (!U.isEmptyObj(reqParams)) url += '?_json=' + encodeURIComponent(JSON.stringify(reqParams));
			
			req.open('GET', url, true);
			req.send();
		},
	};
	
	/*
	Only two packages are built in an ad-hoc manner. These are "uth", and "pack".
	
	-UTH
	This package provides the makeClass method, which is used to built the "pack"
	package itself. That's why it can't be built in the standard way.
	
	-PACK
	This package is the package which facilitates the proper method of building
	packages. If it were to be built in the standard way, it would have to build
	itself.
	*/
	
	// PACKAGE: Under The Hood
	// This is the only package that is generated without the Package class
	global.PACK.uth = {
		makeClass: function(params /* namespace, name, superclassName, propertyNames, methods, statik */) {
			var namespace = U.param(params, 'namespace', global.C);
			
			if (namespace.Constructor === String) {
				var comps = namespace.split('.');
				var dir = global.C;
				comps.forEach(function(comp) {
					if (!(comp in dir)) dir[comp] = {};
					dir = dir[comp];
				});
				namespace = dir;
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
					'/* ~ ' + name + ' ~ */',
					'this.init(U.exists(params) ? params : {});',
				'};',
				'namespace[name] = ' + name + ';',
				'delete ' + name + ';',
			].join(''));
			var c = namespace[name];
			c.title = name;
			
			if (methods.constructor === Function) methods = methods(superclass ? superclass.prototype : null, c);
			
			if (!('init' in methods)) throw 'missing "init" class method';
			
			[	'constructor',
				'parent',
				'propertyNames',
				'instanceProperties',
				'instanceCopy',
				'update'
			].forEach(function(reserved) { if (methods.hasOwnProperty(reserved)) throw 'bad property: "' + reserved + '"'; });
			
			[	'name'
			].forEach(function(reserved) { if (statik.hasOwnProperty(reserved)) throw 'bad statik property: "' + reserved + '"'; });
			
			if (superclass) { c.prototype = Object.create(superclass.prototype); }
			
			methods.update({
				parent: superclass ? superclass.prototype : null,
				propertyNames: (superclass ? superclass.prototype.propertyNames : []).concat(propertyNames),
				constructor: c
			});
			
			c.prototype.update(methods);
			c.update(statik);
			
			return c;
		}
	};
	
	// PACKAGE: Packaging
	global.PACK.pack = {
		onScriptLoad: function() {
			var script = this;
		},
		Package: PACK.uth.makeClass({ name: 'Package',
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
				startBuild: function() {
				},
				stepBuild: function(script) {
					/*
					This gets called on the package each time one of its dependencies
					is loaded. The number of times this method gets called is counted,
					and once it's called for each dependency it calls this.endBuild().
					*/
					if (script.src in this.depErrorChecking) throw 'double-loaded dependency "' + script.src + '"';
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
					
					PACK[this.name] = this.buildFunc();
					console.log('Built     "' + this.name + '"');
					
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
					this.startBuild();
					
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
								script.onload = PACK.pack.onScriptLoad;
								
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
})();
