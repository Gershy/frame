new PACK.pack.Package({ name: 'fact',
  dependencies: [],
  buildFunc: function(packageName /* ... */) {
    
    return {
      
      Fact: U.makeClass({ name: 'Fact',
        methods: function(sc, c) {
          
        }
      })
      
    };
    
  }
}).build();
