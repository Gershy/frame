new PACK.pack.Package({ name: 'care',
  buildFunc: function() {
    
    var CARE_ID = 0;
    
    return {
      CareMixin: function(sc, c) { return {
        
        init: function(params) {
        },
        getId: function() {
          if (!('id' in this)) {
            this.cares = {};
            this.nextCareInd = 0;
            this.careId = CARE_ID++;
          }
          return this.careId;
        },
        addCare: function(type, func) {
          var key = '~care.' + this.getId();
          if (key in func) throw new Error('Tried to add the same interest twice');
          
          func[key] = this.nextCareInd++;
          if (!(type in this.cares)) this.cares[type] = {};
          this.cares[type][func[key]] = func;
        },
        remCare: function(type, func) {
          var key = '~care.' + this.getId();
          if (!(key in func)) throw new Error('Tried to remove a non-existent interest');
          if (this.cares[type][func[key]] !== func) throw new Error('Something has gone horribly wrong');
          
          delete func[key];
          delete this.cares[type][func[key]];
          if (U.isEmptyObj(this.cares[type])) delete this.cares[type];
        },
        care: function(type, params) {
          if (!('careId' in this)) return;
          
          var hap = this.cares[type];
          for (var k in hap) hap[k](params);
        }
        
      };}
    };
  }
}).build();
