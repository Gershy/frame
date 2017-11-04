new PACK.pack.Package({ name: 'channel',
  dependencies: [],
  buildFunc: function() {
    
    var ch = {
      
      Channeler: U.makeClass({ name: 'Channeler',
        methods: function(sc, c) { return {
          init: function(params /* */) {
            
          },
          $respondToQuery: function() {
            // TODO
          },
          $doQuery: function() {
            // TODO
          }
        };}
      })
      
    };
    
    return ch;
    
  }
}).build();
