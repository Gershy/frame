var package = new PACK.pack.Package({ name: 'transform',
  buildFunc: function() {
    var defaultShow = function() {
      return '(' + this.name + ': ' + JSON.stringify(this.inner) + ')';
    };
    
    return {
      Piece: U.makeClass({ name: 'Piece',
        methods: function(sc, c) { return {
          init: function(params /* name, inner, typeData */) {
            this.name = U.param(params, 'name');
            this.inner = U.param(params, 'inner', {});
            this.typeData = U.param(params, 'typeData')
          },
          clone: function() {
            
            // Deep clone
            if (U.isObj(this.inner, Object) || U.isObj(this.inner, Array)) {
              var inner = this.inner.map(function(pc) { return pc.clone(); });
            } else {
              var inner = this.inner;
            }
            
            return new PACK.transform.Piece({
              name: this.name,
              inner: inner,
              typeData: this.typeData
            });
            
          },
          flattened: function(includeMe) {
            if (!U.exists(includeMe)) includeMe = false;
            
            var ret = includeMe ? [ this ] : [];
            
            if (U.isObj(this.inner, Object)) {
              
              for (var k in this.inner) ret = ret.concat(this.inner[k].flattened(true));
              
            } else if (U.isObj(this.inner, Array)) {
              
              for (var i = 0; i < this.inner.length; i++) ret = ret.concat(this.inner[i].flattened(true));
              
            }
            
            return ret;
          },
          restoreFrom: function(orig) {
            this.name = orig.name;
            this.inner = orig.clone().inner;
          },
          valueOf: function() {
            return (this.typeData[this.name].show || defaultShow).call(this);
          },
          hasTag: function(tag) {
            return tag in this.typeData[this.name].tags;
          }
        };}
      }),
      MultiTransformer: U.makeClass({ name: 'Transform',
        methods: function(sc, c) { return {
          init: function(params /* transformations */) {
            this.transformations = U.param(params, 'transformations');
          },
          getIterator: function(piece) {
            
            var orig = piece.clone();
            var tList = this.transformations;
            var tInd = 0;
            var currentIterator = null;
            
            return function() {
              
              var result = currentIterator ? currentIterator() : null;
              
              while (!result && tInd < tList.length) {
                currentIterator = tList[tInd].getIterator(piece);
                result = currentIterator();
                tInd++;
              }
              
              //  TODO: why was this important??
              //if (result) {
              //  result = result.clone();
                //piece.restoreFrom(orig);
              //}
              
              return result;
            };
            
          }
        };}
      }),
      DeeperTransformer: U.makeClass({ name: 'DeeperTransformer',
        methods: function(sc, c) { return {
          init: function(params /* transformer */) {
            this.transformer = U.param(params, 'transformer');
          },
          getIterator: function(piece) {
            
            var orig = piece.clone();
            var transformer = this.transformer;
            var currentIterator = null;
            var lastFlattened = { length: 398439084 };
            var ind = 0;
            
            return function() {
              
              var result = currentIterator ? currentIterator() : null;
              
              while (!result && ind < lastFlattened.length) {
                piece.restoreFrom(orig);
                lastFlattened = piece.flattened(true);
                currentIterator = transformer.getIterator(lastFlattened[ind]);
                result = currentIterator();
                ind++;
              }
              
              return result ? piece : null;
              
            };
            
          }
        };}
      }),
      SimpleTransformer: U.makeClass({ name: 'SimpleTransformer',
        methods: function(sc, c) { return {
          init: function(params /* validate, run */) {
            this.validate = U.param(params, 'validate');
            this.run = U.param(params, 'run');
          },
          getIterator: function(piece) {
            
            var valid = true;
            var validate = this.validate;
            var run = this.run;
            
            return function() {
              
              if (!valid) return null;
              valid = false;
              return validate(piece) ? run(piece) : null;
              
            };
            
          }
        };}
      })
    };
  },
  runAfter: function() {
    if (U.isServer()) return;
    
    var Piece = PACK.transform.Piece;
    var MultiTransformer = PACK.transform.MultiTransformer;
    var SimpleTransformer = PACK.transform.SimpleTransformer;
    var DeeperTransformer = PACK.transform.DeeperTransformer;
    
    var typeData = {
      number: {
        show: function() {
          return this.inner.toString(); 
        }
      },
      add: {
        show: function() {
          return '(' + this.inner.map(function(num) { return num.valueOf(); }).join(' + ') + ')';
        }
      },
      mult: {
        show: function() {
          return '(' + this.inner.map(function(num) { return num.valueOf(); }).join(' * ') + ')';
        }
      },
      equals: {
        show: function() {
          return this.inner[0].valueOf() + ' = ' + this.inner[1].valueOf();
        }
      }
    };
    
    var num = function(val) {
      return new Piece({ name: 'number', inner: val, typeData: typeData });
    };
    var add = function(numbers) {
      return new Piece({ name: 'add', inner: numbers, typeData: typeData });
    };
    var mult = function(numbers) {
      return new Piece({ name: 'mult', inner: numbers, typeData: typeData });
    };
    var equals = function(pc1, pc2) {
      return new Piece({ name: 'equals', inner: [ pc1, pc2 ], typeData: typeData });
    };
    
    var resolveAddition = new SimpleTransformer({
      validate: function(pc) {
        if (pc.name !== 'add') return false;
        for (var i = 0; i < pc.inner.length; i++) if (pc.inner[i].name !== 'number') return false;
        return true;
      },
      run: function(pc) {
        var val = 0;
        for (var i = 0; i < pc.inner.length; i++) val += pc.inner[i].inner;
        pc.name = 'number';
        pc.inner = val;
        return pc;
      }
    });
    var resolveMultiplication = new SimpleTransformer({
      validate: function(pc) {
        if (pc.name !== 'mult') return false;
        for (var i = 0; i < pc.inner.length; i++) if (pc.inner[i].name !== 'number') return false;
        return true;
      },
      run: function(pc) {
        var val = 1;
        for (var i = 0; i < pc.inner.length; i++) val *= pc.inner[i].inner;
        pc.name = 'number';
        pc.inner = val;
        return pc;
      }
    });
    var resolveEquals = new SimpleTransformer({
      validate: function(pc) {
        return pc.name === 'equals' && pc.inner[0].name === 'number' && pc.inner[1].name === 'number';
      },
      run: function(pc) {
        pc.name = 'number';
        pc.inner = pc.inner[0].inner === pc.inner[1].inner ? 1 : 0;
      }
    });
    var shuffle = new SimpleTransformer({
      validate: function(pc) {
        return [ 'mult', 'add' ].contains(pc.name)
      },
      run: function(pc) {
        for (var i = pc.inner.length; i; i--) {
          var ind = Math.floor(Math.random() * i);
          var tmp = pc.inner[i - 1];
          pc.inner[i - 1] = pc.inner[ind];
          pc.inner[ind] = tmp;
        }
        return pc;
      }
    });
    
    var transformer = new DeeperTransformer({
      transformer: new MultiTransformer({ transformations: [
        resolveAddition,
        resolveMultiplication,
        resolveEquals,
        shuffle
      ]})
    });
    
    var pc = equals(add([ num(3), add([ num(4), num(7) ]) ]), num(14));
    
    var it = transformer.getIterator(pc);
    
    var results = [ pc.valueOf() ];
    
    while (true) {
      var result = it();
      if (!result) break;
      results.push(result.clone());
    }
    
    console.log(results.map(function(result) { return result.valueOf() }));
  }
});
package.build();
