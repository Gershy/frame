var package = new PACK.pack.Package({ name: 'p',
  dependencies: [ ],
  buildFunc: function(p) {
    
    var getValueData = function(value) {
      
      // Resolves an inline value OR `P` instance to a convenient,
      // manageable inline value. If this resulting inline value is
      // converted from a `P` instance, and the promise was rejected,
      // the value will represent this (no error thrown).
      
      if (!U.isInstance(value, P))
        return { type: 'resolved', multi: false, value: value };
      
      var multi = value.multi;
      while (U.isInstance(value, P) && value.status !== 'pending') {
        if (value.status === 'rejected') return { type: 'rejected', value: value.value };
        if (value.status === 'resolved') { multi = value.multi; value = value.value; }
      }
      
      return {
        type: U.isInstance(value, P) ? 'pending' : 'resolved',
        multi: multi,
        value: value
      };
      
    };
    var promisify = function(value) {
      /*
      Convert a value into a promise.
      If `value` is a promise return it, otherwise return a promise wrapping `value`.
      */
      return U.isInstance(value, P) ? value : new P({ value: value });
    };
    var P = U.makeClass({ name: 'P',
      methods: function(sc) { return {
        init: function(params /* val, func | cb, cbParams, cbName, all */) {
          
          if (U.isInstance(params, Error)) params = { err: params };
          
          this.children = [];
          this.status = 'pending'; // | 'resolved' | 'rejected'
          this.value = null;
          this.multi = U.param(params, 'multi', false);
          this.func = U.param(params, 'func', null);
          this.recoveryFunc = U.param(params, 'recoveryFunc', null);
          // this.initStack = new Error('');
          
          if (O.contains(params, 'value')) {
            
            if (U.isInstance(params.value, this.constructor)) { // `this.constructor` instead of `P` simply just to all the addition of $null before `p.P` exists
              this.tryResolve(params.value);
            } else {
              this.status = 'resolved';
              this.value = params.value;
            }
            
          } else if (O.contains(params, 'custom')) {  // Allow the user to arbitrarily call resolve or reject
            
            try {
              params.custom(this.resolve.bind(this), this.reject.bind(this));
            } catch(err) {
              this.reject(err);
            }
            
          } else if (O.contains(params, 'run')) {
            
            // Runs a function. If the return value is non-promise, converts to promise.
            // If the function throws an immediate error, converts to rejected promise.
            
            try {
              return promisify(params.run())
                .then(this.resolve.bind(this))
                .fail(this.reject.bind(this));
            } catch(err) {
              this.reject(err);
            }
            
          } else if (O.contains(params, 'cb')) {
            
            var cb = params.cb;
            var args = U.param(params, 'args');
            return cb.apply(null, args.concat([ function(err, v) {
              return err? this.reject(err) : this.resolve(v);
            }.bind(this) ]));
            
          } else if (O.contains(params, 'all')) {     // Allow a list of promises to be treated as a single promise
            
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
              promisify(v)
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
            
          } else if (O.contains(params, 'args')) {
            
            this.multi = true;
            var args = U.param(params, 'args');
            var results = [];
            
            if (!args.length) return this.resolve();
            
            var healthy = true;
            var pass = this;
            var count = 0;
            
            args.forEach(function(v, k) {
              promisify(v)
                .then(function(val) {
                  if (!healthy) return;
                  results[k] = val;
                  if (++count === args.length) pass.resolve.apply(pass, results);
                }).fail(function(err) {
                  healthy = false;
                  pass.reject(err);
                });
            });
            
          } else if (O.contains(params, 'timeout')) {
            
            setTimeout(this.resolve.bind(this, null), U.param(params, 'timeout'));
            
          } else if (O.contains(params, 'err')) {
            
            this.status = 'rejected';
            this.value = params.err;
            if (!U.isInstance(this.value, Error)) throw new Error('Non-error value: "' + this.value + '"');
            
          }
          
        },
        tryResolve: function(/* ... */) {
          
          // PART 1: Ensure that multiple values are handled
          
          var args = [];
          var pending = false; // Track if there are any pending arguments
          for (var i = 0, len = arguments.length; i < len; i++) {
            var valueData = getValueData(arguments[i]);
            
            if (valueData.type === 'pending')   pending = true;
            if (valueData.type === 'rejected')  return this.reject(valueData.value);
            
            args.push(valueData);
          }
          
          if (args.length !== 1) {
            
            // If there are pending arguments, need to use an args-style promise
            // If there are no pending arguments, use a simple array of values
            var value = pending
              ? new P({ args: args.map(function(a) { return a.value; }) })
              : args.map(function(a) { return a.value; });
            
          } else {
            
            // Exactly 1 argument was provided.
            var value = arguments[0];
            
          }
          
          // PART 2: Ensure that we are either working with an unresolved promise, or a simple value
          var valueData = getValueData(value);
          if (valueData.type === 'rejected') {
            
            return this.reject(valueData.value);
            
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
            
            this.value = this.func
              ? (multi ? this.func.apply(null, arguments) : this.func(arguments[0]))
              : (multi ? U.toArray(arguments) : arguments[0]);
            
          } catch(err) {
            
            this.reject(err);
            return false;
            
          }
          
          this.status = 'resolved';
          for (var i = 0, len = this.children.length; i < len; i++) {
            var child = this.children[i];
            if (child.multi)  child.tryResolve.apply(child, this.value);
            else              child.tryResolve(this.value);
          }
          this.children = []; // Release memory
          
        },
        reject: function(err) {
          
          if (!U.isInstance(err, Error))
            throw new Error('Rejected value must be an `Error`');
          
          if (this.status === 'resolved')
            throw new Error('Cannot reject; status is already "resolved"')
          else if (this.status === 'rejected')
            throw this.value;
          
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
          this.value = err;
          for (var i = 0, len = this.children.length; i < len; i++) {
            var child = this.children[i];
            child.reject(err);
          }
          this.children = []; // Release memory
          
        },
        then: function(func) {
          var child = new P({ func: U.isObj(func, Function) ? func : function() { return func; } });
          child.tryResolve(this);
          return child;
        },
        them: function(func) {
          var child = new P({ func: func, multi: true });
          child.tryResolve(this);
          return child;
        },
        fail: function(func) {
          var child = new P({ recoveryFunc: func });
          child.tryResolve(this);
          return child;
        },
        done: function() {
          if (U.isServer()) {
            
            new P({ recoveryFunc: function(err) {
              process.nextTick(function() { throw err; });
            }}).tryResolve(this);
            
          } else {
            
            new P({ recoveryFunc: function(err) {
              setTimeout(function() { throw err; });
            }}).tryResolve(this);
            
          }
        }
      };}
    });
    
    O.update(p, {
      $: promisify,
      P: P,
      $null: new P({ value: null }),
      log: function() {
        
        var args = U.toArray(arguments);
        return function(v) {
          console.log.apply(console, args);
          return v;
        };
        
      }
    });
    
  }
});
package.build();
