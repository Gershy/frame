var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'p' ],
	buildFunc: function() {
		return {
			Query: U.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* address, command, params, serialized, post, ref */) {
						this.address = U.param(params, 'address');
						this.command = U.param(params, 'command');
						this.params = U.param(params, 'params', {});
						this.serialized = U.param(params, 'serialized', []);
					},
					wireParams: function() {
						var params = this.params.clone();
						
						var serialized = [];
						
						this.serialized.forEach(function(paramName) {
							if (paramName in params) {
								params[paramName] = U.wirePut(params[paramName]).arr;
								serialized.push(paramName);
							}
						});
						
						return {
							address: this.address,
							command: this.command,
							params: params,
							serialized: serialized
						};
					},
					fire: function() {
						var prmQuery = new PACK.p.P({});
						
						var query = new XMLHttpRequest();
						query.onreadystatechange = function() {
							if (U.matches(query, { readyState: 4, status: 200 })) prmQuery.satisfy(JSON.parse(query.responseText));
						};
						
						//req.open('POST', '', true);
						//req.setRequestHeader('Content-Type', 'application/json');
						//req.send(JSON.stringify(this.wireParams()));
							
						query.open('GET', '?_json=' + encodeURIComponent(JSON.stringify(this.wireParams())));
						query.send();
						
						return prmQuery;
					}
				};}
			}),
			QueryHandler: U.makeClass({ name: 'QueryHandler',
				methods: function(sc) { return {
					init: function(params /* */) {
					},
					respondToQuery: function(params /* address */) {
						/*
						QueryHandlers respond to queries by forwarding them to children
						if the address has not been exhausted yet, otherwise they
						process them using their `handleQuery` method.
						*/
						var address = U.param(params, 'address');
						
						if (!address.length) return this.handleQuery(params);
						
						// Need to have one of the handler's children respond to the query
						var child = this.getNamedChild(address[0]);
						
						if (!child) throw new Error('Invalid address: "' + address + '"');
						
						var pass = this;
						return child.respondToQuery(params.clone({ address: address.slice(1) }))
							.then(function(response) { // Is this necessary?
								return pass.processChildResponse(response);
							});
					},
					getNamedChild: function(name) { throw new Error('not implemented'); },
					handleQuery: function(params /* */) { throw new Error('not implemented'); },
					processChildResponse: function(response) { return response; }
				}; }
			})
		};
	},
});
package.build();
