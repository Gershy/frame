var package = new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'p' ],
	buildFunc: function(packageName, p) {
    
    var P = p.P;
    
		var qr = {
      
			$doQuery: function(params /* address, command, params, ref */) {
        
        var ref = U.param(params, 'ref', null);
        
        var data = U.thingToString({
					address: U.param(params, 'address'),
					command: U.param(params, 'command'),
					params: U.param(params, 'params', {})
				});
        
				return new P({ custom: function(resolve, reject) {
					var query = new XMLHttpRequest();
					
          query.onreadystatechange = ref === null
            ? qr.stdStateChangeFunc.bind(null, query, resolve, reject)
            : qr.refStateChangeFunc.bind(null, query, resolve, reject, ref);
          
					query.open('GET', '?_data=' + encodeURIComponent(data), true);
					query.send();
				}});
        
			},
      
      stdStateChangeFunc: function(query, resolve, reject) {
        if (query.readyState !== 4) return; // Query isn't done yet
        
        if (query.status === 200) resolve(U.stringToThing(query.responseText));
        else                      reject(new Error(query.responseText));
      },
      refStateChangeFunc: function(query, resolve, reject, ref) {
        if (query.readyState !== 4) return; // Query isn't done yet
        
        if (query.status === 200) resolve({ ref: ref, result: U.stringToThing(query.responseText) });
        else                      reject(new Error(query.responseText));
      },
			
      /*
			Query: U.makeClass({ name: 'Query',
				methods: function(sc) { return {
					init: function(params /* address, command, params * /) {
						this.address = U.param(params, 'address');
						this.command = U.param(params, 'command');
						this.params = U.param(params, 'params', {});
            this.ref = U.param(params, 'ref', null);
					},
					$fire: function() {
						return qr.$doQuery({
							address: this.address,
							command: this.command,
							params: this.params,
              ref: this.ref
						});
					}
				};}
			}),
      */
			QueryHandler: U.makeClass({ name: 'QueryHandler',
				methods: function(sc) { return {
					init: function(params /* */) {
					},
					$respondToQuery: function(params /* address */) {
						// Continue to exhaust the address. If it's already exhausted, immediately handle the query
						var address = U.param(params, 'address');
						if (!address.length) return this.$handleRequest(params);
						
						// Need to have one of the handler's children respond to the query
						var child = this.getNamedChild(address[0]);
						if (!child) return new P({ err: new Error('Invalid address :( : "' + address.join('.') + '" (' + this.constructor.title + ')') });
						
						// Consume the address and forward to the child handler
						return child.$respondToQuery(params.update({ address: params.address.slice(1) }));
					},
          getChild: null, // TODO: This is a mess!!
					getNamedChild: function(name) { throw new Error('not implemented'); },
					$handleRequest: function(params /* */) { throw new Error('not implemented'); },
				}; }
			})
		};
	
    return qr;
  },
});
package.build();
