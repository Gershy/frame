var package = new PACK.pack.Package({ name: 'p',
  dependencies: [ 'uth' ],
  buildFunc: function() {
    return {
      p: function(val) {
        return PACK.uth.instanceOf(val, PACK.p.P) ? val : new PACK.p.P(val);
      },
      P: PACK.uth.makeClass({ name: 'P',
        methods: function() { return {
          init: function(params /* val, func, cb, cbParams, cbName, all */) {
            this.val = null;
            this.satisfied = true;
            this.waiting = [];
            
            if (!PACK.uth.isObj(params) || params.constructor !== Object) params = { val: params };
            
            if ('cb' in params) {
              
              this.val = null;
              this.satisfied = false;
              
              var cb = U.param(params, 'cb');
              var cbParams = U.param(params, 'cbParams', {});
              var cbName = U.param(params, 'cbName', null);
              
              if (!PACK.uth.instanceOf(cbParams, Array)) cbParams = [ cbParams ];
              
              /*
              Add the generated callback `satisfyMe` to the parameters. The user
              can control where the parameter goes using `cbName`, which will
              be used along with `U.setByName` to insert the parameter correctly.
              */
              var satisfyMe = this.satisfy.bind(this);
              if (cbName) U.setByName({ root: cbParams, name: cbName, value: satisfyMe, overwrite: true });
              else        params.push(satisfyMe);
              
              cb.apply(null, cbParams);
              
            } else if ('val' in params) {

              // If a val is given, it's either a promise or a regular value
              var val = U.param(params, 'val');
              var func = U.param(params, 'func', null);
              
              if (PACK.uth.instanceOf(val, PACK.p.P)) { // If it's a promise, it's either satisfied or not
              
                if (val.satisfied) { // If it's satisfied, simply extract its `val`.
                  
                  this.val = val.val;
                  this.satisfied = true;
                  
                } else { // Otherwise we need to wait on it
                  
                  this.val = val;
                  this.satisfied = false;
                  val.waiting.push({
                    promise: this,
                    func: func
                  });
                  
                }
                
              } else { // If it's not a promise, simply satisfy using it
                
                this.val = val;
                this.satisfied = true;
                
              }
              
            } else if ('all' in params) {
              
              this.val = null;
              this.satisfied = false;
              
              var all = U.param(params, 'all');
              if (all.length === 0) this.satisfy([]);
              
              var pass = this;
              var results = U.arr(all.length);
              var count = 0;
              
              all.forEach(function(promise, i) {
                promise.then(function(val) {
                  console.log('ALL RESULT #' + i + ': ' + val);
                  results[i] = val;
                  if (++count === all.length) pass.satisfy(results);
                  return val;
                });
              });
              
            }
            
          },
          satisfy: function(val) {
            if (this.satisfied) throw new Error('Double-satisfied promise');
            
            this.val = val;
            this.satisified = true;
            
            for (var i = 0, len = this.waiting.length; i < len; i++) {
              var w = this.waiting[i];
              w.promise.satisfy(w.func ? w.func(this.val) : this.val);
              //this.waiting[i].satisfy(this.val);
            }
            
            this.waiting = [];
          },
          then: function(task) {
            if (!task) throw new Error('Need to provide a `task` param');
            
            if (this.satisfied) return PACK.p.p(task(this.val));
            
            return new PACK.p.P({ val: this, func: task });
          }
        };}
      })
    };
  }
});
package.build();
