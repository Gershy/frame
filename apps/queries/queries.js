var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		return {
			QueryHandler: PACK.uth.makeClass({ name: 'QueryHandler',
				propertyNames: [ ],
				methods: {
					init: function(params /* */) {
					},
					respondToQuery: function(params /* address */) {
						var addr = U.param(params, 'address');
						
						// Check if this handler is meant to respond directly to the query
						if (addr.length === 0) return this.handleQuery(params);
						
						// Need to have one of the handler's children respond to the query
						var childName = addr[0];
						var child = this.getNamedChild(childName);
						
						if (child) {
							
							// Params for the child are exactly the same, except the
							// address has had its first member removed.
							var childResponse = child.respondToQuery(params.clone({ address: addr.slice(1) }));
							
						} else {
							
							var childResponse = { code: 1, msg: 'invalid address', address: params.originalAddress };
							
						}
						
						if (!childResponse) throw 'BAD REQUEST RESPONSE';
						var ret = this.processChildResponse(childResponse);
						
						return ret;
					},
					getNamedChild: function(name) {
						throw 'not implemented';
					},
					handleQuery: function(params /* */) { throw 'not implemented'; },
					processChildResponse: function(response) { return response; },
				},
			})
		};
	},
});
package.build();
