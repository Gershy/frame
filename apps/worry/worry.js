new PACK.pack.Package({ name: 'worry',
  buildFunc: function() {
    
    
    var wr = {
      
      WORRY_ID: 0,
      Worry: U.makeMixin({ name: 'Worry',
        methods: function(sc, c) { return {
          
          init: function(params) {
          },
          getKey: function() {
            if (!this.hasOwnProperty('worryId')) {
              this.concerns = {};
              this.nextId = 0;
              this.worryId = wr.WORRY_ID++;
            }
            return '~wr.' + this.worryId;
          },
          addConcern: function(type, func) {
            var key = this.getKey();
            if (key in func) throw new Error('Tried to add the same interest twice');
            
            func[key] = this.nextId++;
            if (!(type in this.concerns)) this.concerns[type] = {};
            this.concerns[type][func[key]] = func;
          },
          remConcern: function(type, func) {
            var key = this.getKey();
            if (!(key in func)) return;
            if (this.concerns[type][func[key]] !== func) throw new Error('Something has gone horribly wrong');
            
            delete func[key];
            delete this.concerns[type][func[key]];
            if (U.isEmptyObj(this.concerns[type])) delete this.concerns[type];
          },
          hasConcern: function(type, func) {
            var key = this.getKey();
            return (type in this.concerns) && (key in func) && (func[key] in this.concerns[type]);
          },
          concern: function(type, params) {
            if (!('concerns' in this)) return;
            
            var typeCares = this.concerns[type];
            for (var k in typeCares) typeCares[k](params);
          },
          
          start: function() {},
          stop: function() {
            
            // Remove keys from all concerns
            var key = this.getKey();
            for (var type in this.concerns) {
              var typeConcerns = this.concerns[type];
              for (var k in typeConcerns) delete typeConcerns[k][key];
            }
            
            // Reset concerns and index
            this.concerns = {};
            this.nextId = 0;
            
          }
          
        };}
      })
    
    };
    
    return wr;
  }
}).build();