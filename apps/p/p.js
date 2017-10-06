var package = new PACK.pack.Package({ name: 'p',
  dependencies: [ ],
  buildFunc: function() {
    var ret = {}
    
    ret.update({
      getValueData: function(v) {
        if (!U.isInstance(v, PACK.p.P))
          return { type: 'resolved', multi: false, value: v };
        
        var multi = v.multi;
        while (U.isInstance(v, PACK.p.P) && v.status !== 'pending') {
          if (v.status === 'rejected') return { type: 'rejected', value: v.val };
          if (v.status === 'resolved') { multi = v.multi; v = v.val; }
        }
        
        return {
          type: U.isInstance(v, PACK.p.P) ? 'pending' : 'resolved',
          multi: multi,
          value: v
        };
      },
      $: function(val) {
        /*
        Convert a value into a promise.
        If `val` is a promise return it, otherwise return a promise wrapping `val`.
        */
        return U.isInstance(val, PACK.p.P) ? val : new PACK.p.P({ val: val, func: null });
      },
      P: U.makeClass({ name: 'P',
        methods: function(sc) { return {
          init: function(params /* val, func | cb, cbParams, cbName, all */) {
            this.children = [];
            this.status = 'pending'; // | 'resolved' | 'rejected'
            this.val = null;
            this.multi = U.param(params, 'multi', false);
            this.func = U.param(params, 'func', null);
            this.recoveryFunc = U.param(params, 'recoveryFunc', null);
            
            if ('val' in params) {
              
              if (U.isInstance(params.val, this.constructor)) { // `this.constructor` instead of `PACK.p.P` simply just to all the addition of $null before `PACK.p.P` exists
                this.tryResolve(params.val);
              } else {
                this.status = 'resolved';
                this.val = params.val;
              }
              
            } else if ('custom' in params) {  // Allow the user to arbitrarily call resolve or reject
              
              /*
              e.g.
              new PACK.p.P({ custom: function(resolve, reject) {
                setTimeout(resolve, 1000);
              }});
              */
              try {
                params.custom(this.resolve.bind(this), this.reject.bind(this));
              } catch(err) { this.reject(err); }
              
            } else if ('all' in params) {     // Allow a list of promises to be treated as a single promise
              
              // TODO: all-style and args-style code is basically copy-pasted
              // Differences are:
              // - all-style is always non-multi, args-style is always multi
              // - all-style allows for arrays and objects, args-style is array only
              var all = U.param(params, 'all');
              var results = new all.constructor(); // This allows the same code to process both arrays and objects
              var num = U.isObj(all, Array) ? all.length : Object.keys(all).length;
              
              if (!num) return this.resolve(results);
              
              var healthy = true;
              var pass = this;
              var count = 0;
              
              all.forEach(function(v, k) {
                PACK.p.$(v)
                  .then(function(val) {
                    if (!healthy) return;
                    results[k] = val;
                    if (++count === num) pass.resolve(results);
                  })
                  .fail(function(err) {
                    healthy = false;
                    pass.reject(err);
                  });
              });
              
            } else if ('args' in params) {
              
              this.multi = true;
              var args = U.param(params, 'args');
              var results = [];
              
              if (!args.length) return this.resolve();
              
              var healthy = true;
              var pass = this;
              var count = 0;
              
              args.forEach(function(v, k) {
                PACK.p.$(v)
                  .then(function(val) {
                    if (!healthy) return;
                    results[k] = val;
                    if (++count === args.length) pass.resolve.apply(pass, results);
                  }).fail(function(err) {
                    healthy = false;
                    pass.reject(err);
                  });
              });
              
            } else if ('timeout' in params) {
              
              var timeout = U.param(params, 'timeout');
              setTimeout(this.resolve.bind(this, null), timeout);
            
            } else if ('err' in params) {
              
              this.status = 'rejected';
              this.val = params.err;
              
            }
            
          },
          tryResolve: function(/* ... */) {
            
            // PART 1: Ensure that multiple values are handled
            
            var args = [];
            var pending = false; // Track if there are any pending arguments
            for (var i = 0, len = arguments.length; i < len; i++) {
              var valueData = PACK.p.getValueData(arguments[i]);
              
              if (valueData.type === 'pending')   pending = true;
              if (valueData.type === 'rejected')  return this.reject(valueData.value);
              
              args.push(valueData);
            }
            
            if (args.length !== 1) {
              
              // If there are pending arguments, need to use an args-style promise
              // If there are no pending arguments, use a simple array of values
              if (pending) {
                var val = new PACK.p.P({ args: args.map(function(a) { return a.value; }) });
              } else {
                var val = args.map(function(a) { return a.value; });
              }
              
            } else {
              
              // Exactly 1 argument was provided.
              var val = arguments[0];
              
            }
            
            // PART 2: Ensure that we are either working with an unresolved promise, or a simple value
            var valueData = PACK.p.getValueData(val);
            if (valueData.type === 'rejected') {
              
              return this.reject(valueData.val);
              
            } else if (valueData.type === 'resolved') {
              
              if (this.multi) this.resolve.apply(this, valueData.value);
              else            this.resolve(valueData.value);
              
              return true;
              
            } else if (valueData.type === 'pending') {
              
              valueData.value.children.push(this);
              return false;
              
            }
            
          },
          resolve: function(/* ... */) {
            
            if (this.status !== 'pending') throw new Error('Cannot resolve; status is already "' + this.status + '"');
            
            var multi = arguments.length !== 1;
            
            // Get the value taking `this.multi` and `this.func` into account
            try {
              
              this.val = this.func
                ? (multi ? this.func.apply(null, arguments) : this.func(arguments[0]))
                : (multi ? U.toArray(arguments) : arguments[0]);
              
            } catch(err) {
              
              this.reject(err);
              return false;
              
            }
            
            this.status = 'resolved';
            for (var i = 0, len = this.children.length; i < len; i++) {
              var p = this.children[i];
              if (p.multi)  p.tryResolve.apply(p, this.val);
              else          p.tryResolve(this.val);
            }
            this.children = []; // Release memory
            
          },
          reject: function(err) {
            
            if (this.status === 'resolved')
              throw new Error('Cannot reject; status is already "resolved"')
            else if (this.status === 'rejected')
              throw this.val;
            
            if (this.recoveryFunc) {
              
              try {
                var val = this.recoveryFunc(err);
                this.recoveryFunc = null; // Avoid infinite loop
              } catch(recoveryErr) {
                // Update the error; TODO: Extend the error instead of overwriting?
                err = recoveryErr;
              }
              
              // `this.recoveryFunc` is `null` if no error occurred in `this.recoveryFunc` 
              if (!this.recoveryFunc) return this.tryResolve(val);
              
            }
            
            this.status = 'rejected';
            this.val = err;
            for (var i = 0, len = this.children.length; i < len; i++) {
              var p = this.children[i];
              p.reject(err);
            }
            this.children = []; // Release memory
            
          },
          then: function(func) {
            var p = new PACK.p.P({ func: func });
            p.tryResolve(this);
            return p;
          },
          them: function(func) {
            var p = new PACK.p.P({ func: func, multi: true });
            p.tryResolve(this);
            return p;
          },
          insert: function(func) {
            return this.then(function(v) { func(v); return v; });
          },
          fail: function(func) {
            var p = new PACK.p.P({ recoveryFunc: func });
            p.tryResolve(this);
            return p;
          },
          done: function() {
            if (U.isServer()) {
              
              new PACK.p.P({ recoveryFunc: function(err) {
                process.nextTick(function() { throw err; });
              }}).tryResolve(this);
              
            } else {
              
              new PACK.p.P({ recoveryFunc: function(err) {
                console.error(err.stack);
              }}).tryResolve(this);
              
            }
          }
        };}
      })
    });
    
    ret.update({
      $null: new ret.P({ val: null })
    });
    
    return ret;
  }
});
package.build();
