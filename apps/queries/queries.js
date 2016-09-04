var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		return {
			Query: PACK.uth.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* */) { },
					fire: function(onComplete, ref) { throw new Error('not implemented'); }
				}; }
			}),
			DudQuery: PACK.uth.makeClass({ name: 'DudQuery',
				superclassName: 'Query',
				methods: function(sc) { return {
					init: function(params /* response */) {
						sc.init.call(this);
						this.response = U.param(params, 'response');
					},
					fire: function(onComplete, ref) { onComplete(this.response, ref); }
				}; }
			}),
			SimpleQuery: PACK.uth.makeClass({ name: 'SimpleQuery',
				superclassName: 'Query',
				methods: function(sc) { return {
					init: function(params /* url, params, json, transform */) {
						sc.init.call(this, params);
						this.url = U.param(params, 'url', '');
						this.params = U.param(params, 'params', {});
						this.json = U.param(params, 'json', true);
						
						// Allows modification of the response before it's passed to the callback
						this.transform = U.param(params, 'transform', null);
					},
					fire: function(onComplete, ref) {
						if (this.transform) {
							var tr = this.transform;
							var cb = function(response, ref) { onComplete(tr(response), ref); };
						} else {
							var cb = onComplete;
						}
						
						// TODO: Implement U.request here instead?
						U.request({ url: this.url, params: this.params, json: this.json,
							onComplete: cb, ref: ref
						});
					}
				}; }
			}),
			PromiseQuery: PACK.uth.makeClass({ name: 'PromiseQuery',
				superclassName: 'Query',
				methods: function(sc) { return {
					init: function(params /* subQueries, ensureOrder */) {
						sc.init.call(this, params);
						this.ensureOrder = U.param(params, 'ensureOrder', true);
						this.subQueries = U.param(params, 'subQueries'); // Array of Query objects
						this.transform = U.param(params, 'transform', null);
					},
					fire: function(onComplete, ref) {
						var num = this.subQueries.length;
						
						if (num === 0) onComplete([], ref);
						
						var responses = [];
						
						var ordered = this.ensureOrder;
						
						var queryDone = function(response, n) {
							if (ordered) 	responses.push({ r: response, n: n });
							else 			responses.push(response);
							
							if (responses.length === num) {
								if (ordered) {
									responses.sort(function(r1, r2) { return r1.n - r2.n; });
									responses = responses.map(function(rr) { return rr.r });
								}
								onComplete(responses, ref);
							}
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
				superclassName: 'Query',
				methods: function(sc) { return {
					init: function(params /* url, subQueries */) {
						sc.init.call(this, params);
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
					getNamedChild: function(name) { throw new Error('not implemented'); },
					handleQuery: function(params /* */) { throw new Error('not implemented'); },
					processChildResponse: function(response) { return response; },
				}; }
			})
		};
	},
});
package.build();
