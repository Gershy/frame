var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'p' ],
	buildFunc: function() {
		
		return {
			
			$doRawQuery: function(data /* */) {
				
				return new PACK.p.P({ custom: function(resolve, reject) {
					var query = new XMLHttpRequest();
					
					query.onreadystatechange = function() {
						if (query.readyState !== 4) return; // Query isn't done yet
						
						if (query.status === 200) {
							
							resolve(U.stringToThing(query.responseText));
							
						} else {
							
							reject(new Error(query.responseText));
							
						}
					};
					
					query.open('GET', '?_data=' + encodeURIComponent(data), true);
					query.send();
				}});
			},
			
			$doQuery: function(params /* address, command, params */) {
				return PACK.queries.$doRawQuery(U.thingToString({
					address: U.param(params, 'address'),
					command: U.param(params, 'command'),
					params: U.param(params, 'params', {})
				}));
			},
			
			Query: U.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* address, command, params */) {
						this.address = U.param(params, 'address');
						this.command = U.param(params, 'command');
						this.params = U.param(params, 'params', {});
					},
					$fire: function() {
						return PACK.queries.$doQuery({
							address: this.address,
							command: this.command,
							params: this.params,
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
