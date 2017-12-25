new PACK.pack.Package({ name: 'queries',
  dependencies: [ 'p' ],
  buildFunc: function(packageName, p) {
    
    var P = p.P;
    var stdStateChangeFunc = function(query, resolve, reject, err) {
      if (query.readyState !== 4) return;
      if (query.status === 200) resolve(U.stringToThing(query.responseText));
      else                      reject(err.update({ message: 'Query failed: ' + query.responseText }));
    };
    var refStateChangeFunc = function(query, resolve, reject, err, ref) {
      if (query.readyState !== 4) return;
      if (query.status === 200) resolve({ ref: ref, result: U.stringToThing(query.responseText) });
      else                      reject(err.update({ message: 'Query failed: ' + query.responseText }));
    };
    
    return {
      
      $doQuery: function(params /* address, command, params, ref */) {
        
        var err = new Error('Query failed'); // This should be a debug feature
        
        var ref = U.param(params, 'ref', null);
        return new P({ custom: function(resolve, reject) {
          
          var query = new XMLHttpRequest();
          query.onreadystatechange = ref === null
            ? stdStateChangeFunc.bind(null, query, resolve, reject, err)
            : refStateChangeFunc.bind(null, query, resolve, reject, err, ref);
          
          var addr = U.param(params, 'address');
          if (U.isObj(addr, String)) addr = addr.split('.');
          
          query.open('POST', '', true);
          query.setRequestHeader('Content-Type', 'application/json');
          query.send(U.thingToString({
            address: addr,
            command: U.param(params, 'command'),
            params: U.param(params, 'params', {})
          }));
        
        }});
        
      }
      
    };
  },
}).build();
