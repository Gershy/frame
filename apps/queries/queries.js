new PACK.pack.Package({ name: 'queries',
	dependencies: [ 'p' ],
	buildFunc: function(packageName, p) {
    
    var P = p.P;
    var stdStateChangeFunc = function(query, resolve, reject) {
      if (query.readyState !== 4) return; // Query isn't done yet
      
      if (query.status === 200) resolve(U.stringToThing(query.responseText));
      else                      reject(new Error(query.responseText));
    };
    var refStateChangeFunc = function(query, resolve, reject, ref) {
      if (query.readyState !== 4) return; // Query isn't done yet
      
      if (query.status === 200) resolve({ ref: ref, result: U.stringToThing(query.responseText) });
      else                      reject(new Error(query.responseText));
    };
    
		return {
      
			$doQuery: function(params /* address, command, params, ref */) {
        
        var ref = U.param(params, 'ref', null);
				return new P({ custom: function(resolve, reject) {
					var query = new XMLHttpRequest();
					
          query.onreadystatechange = ref === null
            ? stdStateChangeFunc.bind(null, query, resolve, reject)
            : refStateChangeFunc.bind(null, query, resolve, reject, ref);
          
          query.open('POST', '', true);
          query.setRequestHeader('Content-Type', 'application/json');
          query.send(U.thingToString({
            address: U.param(params, 'address'),
            command: U.param(params, 'command'),
            params: U.param(params, 'params', {})
          }));
          
          /*
          var dataStr = encodeURIComponent(U.thingToString({
            address: U.param(params, 'address'),
            command: U.param(params, 'command'),
            params: U.param(params, 'params', {})
          }));
					query.open('GET', '?_data=' + dataStr, true);
					query.send();
          */
				}});
        
			}
      
		};
  },
}).build();
