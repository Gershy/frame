new PACK.pack.Package({ name: 'worry',
  buildFunc: function(wr) {
  
    wr.WORRY_ID = 0;
    
    wr.Worry = U.makeMixin({ name: 'Worry',
      methods: function(sc, c) { return {
        
        init: function(params) {
          // To keep objects lightweight, this class doesn't add any properties until necessary
        },
        getKey: function() {
          if (!this.hasOwnProperty('concerns')) this.concerns = {};
          if (!this.hasOwnProperty('nextId')) this.nextId = 0;
          if (!this.hasOwnProperty('worryId')) this.worryId = wr.WORRY_ID++;
          
          return '~wr.' + this.worryId;
        },
        addWorry: function(type, func, key0) {
          
          if (!func) throw new Error('Invalid "func" param');
          
          O.prepare(this, 'concerns');
          O.prepare(this.concerns, type);
          
          if (U.exists(key0)) {
            
            var key = key0;
            if (O.contains(this.concerns[type], key)) throw new Error('Tried to add the same concern twice');
            
          } else {
            
            // If no key is supplied, a key is generated and attached to the function itself
            // In this way the key can be found from the function, and the function itself
            // can be provided for the removal call
            var uniqKey = this.getKey();
            var key = this.nextId++;
            if (!O.contains(func, uniqKey)) func[uniqKey] = {};
            if (O.contains(func[uniqKey], type)) throw new Error('Tried to add the same concern twice');
            
            func[uniqKey][type] = key;
            
          }
          
          this.concerns[type][key] = func;
          
          return func;
          
        },
        remWorry: function(type, func) {
          
          if (!O.contains(this.concerns, type)) throw new Error('Can\'t remove worry; no type "' + type + '"');
          
          if (!U.isObj(func, Function)) {
            
            // `func` is a serial value
            var key = func;
            
          } else {
            
            var uniqKey = this.getKey();
            if (!O.contains(func, uniqKey) || !O.contains(func[uniqKey], type)) return;
            
            var key = func[uniqKey][type];
            if (this.concerns[type][key] !== func) throw new Error('Something has gone horribly wrong');
            delete func[uniqKey][type];
            if (O.isEmpty(func[uniqKey])) delete func[uniqKey];
            
          }
          
          if (!O.contains(this.concerns[type], key)) throw new Error('Can\'t remove worry type "' + type + '"; key "' + key + '"');
          delete this.concerns[type][key];
          if (O.isEmpty(this.concerns[type])) delete this.concerns[type];
          
        },
        hasWorry: function(type, func) {
          
          if (!O.contains(this.concerns, type)) return false;
          
          if (!U.isObj(func, Function)) {
            
            var key = func;
            
          } else {
            
            var uniqKey = this.getKey();
            if (O.contains(func, uniqKey) && O.contains(func[uniqKey], type))
              var key = func[uniqKey][type];
            else
              return false;
            
          }
          
          return O.contains(this.concerns[type], key);
          
        },
        worry: function(type, params) {
          
          if (!O.contains(this, 'concerns') || !O.contains(this.concerns, type)) return;
          
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
    });
  
  }
}).build();
