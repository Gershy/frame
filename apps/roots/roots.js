var package = new PACK.pack.Package({ name: 'roots',
  dependencies: [ 'random' ],
  buildFunc: function() {
    var namespace = {};
    var rt = {
      Set: U.makeClass({ name: 'Set', namespace: namespace,
        methods: function(c, sc) { return {
          init: function(params /* */) {
            this.id = c.NEXT_ID++;
            this.len = 0;
            this.data = params.toObj(function(sett) { return sett.id; });
          }
        };},
        statik: {
          NEXT_ID: 0
        }
      }),
      Mutator: U.makeClass({ name: 'Mutator', namespace: namespace,
        methods: function(c, sc) { return {
          init: function(params /* */) {
            
          }
        };}
      })
    };
    
    return rt;
  },
  runAfter: function() {
    console.log('running');
  }
});
package.build();
