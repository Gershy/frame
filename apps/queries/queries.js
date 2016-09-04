var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		return {
			ServerQuery: PACK.uth.makeClass({ name: 'ServerQuery',
				methods: function(sc) { return {
					init: function(params /* */) { },
					fire: function(onComplete, ref) { throw new Error('not implemented'); }
				}; }
			}),
			PromiseQuery: PACK.uth.makeClass({ name: 'PromiseQuery',
				superclassName: 'ServerQuery',
				methods: function(sc) { return {
					init: function(params /* subQueries */) {
						sc.init.call(this, params);
						this.subQueries = U.param(params, 'subQueries'); // Array of ServerQuery objects
					},
					fire: function(onComplete, ref) {
						var responses = [];
						var num = this.subQueries.length;
						var queryDone = function(response, n) {
							responses.push(response);
							if (responses.length === num) onComplete(responses, ref);
						};
						
						this.subQueries.forEach(function(query, n) { query.fire(queryDone, n); });
					}
				}; }
			}),
			CompoundQuery: PACK.uth.makeClass({ name: 'CompoundQuery',
				// TODO: This class would be nice to have!!
				// Instead of sending multiple small queries and waiting
				// for all of them to return, bundle all the queries together
				// and have the server return a corresponding bundle of
				// responses
				superclassName: 'ServerQuery',
				methods: function(sc) { return {
					init: function(params /* url, subQueries */) {
						sc.init.call(this, params);
					}
				}; }
			}),
			SimpleQuery: PACK.uth.makeClass({ name: 'SimpleQuery',
				superclassName: 'ServerQuery',
				methods: function(sc) { return {
					init: function(params /* url, params, json */) {
						sc.init.call(this, params);
						this.url = U.param(params, 'url', '');
						this.params = U.param(params, 'params', {});
						this.json = U.param(params, 'json', true);
					},
					fire: function(onComplete, ref) {
						// TODO: Implement U.request here instead?
						U.request({ url: this.url, params: this.params, json: this.json,
							onComplete: onComplete, ref: ref
						});
					}
				}; }
			}),
			QueryHandler: PACK.uth.makeClass({ name: 'QueryHandler',
				methods: function(sc) { return {
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
							if (!childResponse) throw new Error('Bad response');
							
						} else {
							
							var childResponse = { code: 1, msg: this.constructor.title + ' got invalid address "' + childName + '"', address: params.originalAddress };
							
						}
						
						var ret = this.processChildResponse(childResponse);
						
						return ret;
					},
					getNamedChild: function(name) {
						throw 'not implemented';
					},
					handleQuery: function(params /* */) { throw 'not implemented'; },
					processChildResponse: function(response) { return response; },
				}; }
			})
		};
	},
});
package.build();
