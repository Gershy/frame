var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ ],
	buildFunc: function() {
		return {
			Query: U.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* */) { },
					fire: function(onComplete, ref) { throw new Error('not implemented'); }
				}; }
			}),
			DudQuery: U.makeClass({ name: 'DudQuery',
				superclassName: 'Query',
				methods: function(sc) { return {
					init: function(params /* response */) {
						sc.init.call(this);
						this.response = U.param(params, 'response');
					},
					fire: function(onComplete, ref) { onComplete(this.response, ref); }
				}; }
			}),
			SimpleQuery: U.makeClass({ name: 'SimpleQuery',
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
							var oldOnComplete = onComplete;
							onComplete = function(response, ref) { oldOnComplete(U.isError(response) ? response : tr(response), ref); };
						}
						
						// TODO: Implement U.request here instead?
						// TODO: auto-implement `wirePut` here, based off `serialize` param, instead of in quickDev?
						// TODO: auto-implement `wireGet` here, instead of manually in implementation?
						U.request({ url: this.url, params: this.params, json: this.json,
							onComplete: onComplete, ref: ref
						});
					}
				}; }
			}),
			PromiseQuery: U.makeClass({ name: 'PromiseQuery',
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
							
							// TODO: This is really messy error handling
							// It means that every onComplete handler needs to check
							// if the "response" param is an error
							if (response.constructor === Error) {
								responses = response
								onComplete(responses, ref);
								return;
							}
							
							if (responses.constructor === Error) return;
							
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
			CompoundQuery: U.makeClass({ name: 'CompoundQuery',
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
			QueryHandler: U.makeClass({ name: 'QueryHandler',
				methods: function(sc) { return {
					init: function(params /* */) {
					},
					respondToQuery: function(params /* address */, onComplete) {
						
						var addr = U.param(params, 'address');
						
						// Check if this handler is meant to respond directly to the query
						if (addr.length === 0) {
							this.handleQuery(params, onComplete);
							return;
						}
						
						// Need to have one of the handler's children respond to the query
						var childName = addr[0];
						var child = this.getNamedChild(childName);
						
						// TODO: Reconsider this - it creates a potentially huge chain of function-calls
						// Consider removing it entirely (it's only overidden once in rootServer, and maybe
						// that case could be re-written)
						// Consider having a flag "noChildProcessing" that can stop certain instances of
						// QueryHandler from wrapping the function
						var pass = this;
						var processedOnComplete = function(response) {
							if (!response) throw new Error('Bad response');
							onComplete(pass.processChildResponse(response));
						};
						
						if (child) {
							try {
								child.respondToQuery(params.clone({ address: addr.slice(1) }), processedOnComplete);
							} catch(e) {
								console.log('Error handling query:')
								console.error(e.stack);
								console.log('---------------------');
								processedOnComplete({ code: 1, msg: child.constructor.title + ' caused error' });
							}
						} else {
							processedOnComplete({ code: 1, msg: this.constructor.title + ' got invalid address "' + childName + '"', address: params.originalAddress });
						}
					},
					getNamedChild: function(name) { throw new Error('not implemented'); },
					handleQuery: function(params /* */, onComplete) { onComplete(new Error('not implemented')); },
					processChildResponse: function(response) { return response; },
				}; }
			})
		};
	},
});
package.build();
