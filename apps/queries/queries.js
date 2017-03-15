var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'p' ],
	buildFunc: function() {
		return {
			
			serialize: function(params, serialized) {
				var neededSerialized = [];
				serialized.forEach(function(paramName) {
					if (paramName in params) {
						params[paramName] = U.wirePut(params[paramName]).arr;
						neededSerialized.push(paramName);
					}
				});
				
				return neededSerialized;
			},
			
			unserialize: function(params, serialized) {
				serialized.forEach(function(paramName) {
					if (paramName in params) params[paramName] = U.wireGet(params[paramName]);
				});
			},
			
			paramsToWire: function(params /* address, command, params, serialized */) {
				// Note that this method modifies `params.params`
				
				var address = U.param(params, 'address');
				var command = U.param(params, 'command');
				var reqParams = U.param(params, 'params', {});
				var serialized = U.param(params, 'serialized', []);
				
				return {
					address: address,
					command: command,
					params: reqParams,
					serialized: PACK.queries.serialize(reqParams, serialized) // Modifies `reqParams` and returns serialized list
				};
			},
			
			wireToParams: function(params /* address, command, params, serialized */) {
				
				var reqParams = U.param(params, 'params', {});
				var serialized = U.param(params, 'serialized', []);
				
				PACK.queries.unserialize(reqParams, serialized);	// Apply wireGet
				delete params.serialized;													// Delete "serialized" property
				
				return params;
				
			},
			
			$doRawQuery: function(params /* */) {
				return new PACK.p.P({ custom: function(resolve, reject) {
					var query = new XMLHttpRequest();
					
					query.onreadystatechange = function() {
						if (query.readyState !== 4) return; // Query isn't done yet
						
						if (query.status === 200) resolve(JSON.parse(query.responseText));
						else 											reject(new Error(query.responseText));
					};
					
					query.open('GET', '?_json=' + encodeURIComponent(JSON.stringify(params)), true);
					query.send();
				}});
			},
			
			$doQuery: function(params /* address, command, params, serialized */) {
				return PACK.queries.$doRawQuery(PACK.queries.paramsToWire(params));
			},
			
			Query: U.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* address, command, params, serialized */) {
						this.address = U.param(params, 'address');
						this.command = U.param(params, 'command');
						this.params = U.param(params, 'params', {});
						this.serialized = U.param(params, 'serialized', []);
					},
					$fire: function() {
						return PACK.queries.$doQuery({
							address: this.address,
							command: this.command,
							params: this.params.clone(),
							serialized: this.serialized
						});
					}
				};}
			}),
			QueryHandler: U.makeClass({ name: 'QueryHandler',
				methods: function(sc) { return {
					init: function(params /* */) {
					},
					$respondToQuery: function(params /* address */) {
						/*
						QueryHandlers respond to queries by forwarding them to children
						if the address has not been exhausted yet, otherwise they
						process them using their `$handleQuery` method.
						*/
						var address = U.param(params, 'address');
						
						if (!address.length) return this.$handleQuery(params);
						
						// Need to have one of the handler's children respond to the query
						var child = this.getNamedChild(address[0]);
						
						if (!child) return new PACK.p.P({ err: new Error('Invalid address: "' + address + '"') });
						
						// Consume the address
						params.address = params.address.slice(1);
						
						return child.$respondToQuery(params);
					},
					getNamedChild: function(name) { throw new Error('not implemented'); },
					$handleQuery: function(params /* */) { throw new Error('not implemented'); },
				}; }
			})
		};
	},
});
package.build();
