var package = new PACK.pack.Package({ name: 'p',
  dependencies: [ ],
  buildFunc: function() {
    return {
      p: function(val) {
        /*
        Convert a value into a promise.
        If `val` is a promise return it, otherwise return a promise wrapping `val`.
        */
        return U.instanceOf(val, PACK.p.P) ? val : new PACK.p.P({ val: val, func: null });
      },
      P: U.makeClass({ name: 'P',
        methods: function() { return {
          init: function(params /* val, func, cb, cbParams, cbName, all */) {
            this.val = null;
            this.multiArgs = false;
            this.satisfied = false;
            this.waiting = [];
            this.failTask = null;
            
            if (!U.isObj(params, Object)) throw new Error(this.constructor.title + ' takes an object as a parameter');
            
            if ('val' in params) {        // Allow an ordinary value to be treated as a promise
              
              // Try to satisfy using the simple value we were given
              var val = U.param(params, 'val');
              var func = U.param(params, 'func', null);
              
              this.satisfied = this.trySatisfy(val, func);
              
            } else if ('cb' in params) {  // Allow an ordinary callback function to be treated as a promise
              
              /*
              
              e.g.:
              
              var timeout1Sec = new PACK.p.P({ cb: setTimeout, cbParams: [ null, 1000 ], cbName: '0' });
              
              timeout1Sec.then(console.log.bind(console, 'waited 1 sec!'));
              
              Note "cbName"; it's the position of the callback within the array of parameters.
              
              */
              
              // A callback function
              var cb = U.param(params, 'cb');
              
              // Provided arguments for the function
              var cbParams = U.param(params, 'cbParams', {});
              
              // The deep key of the argument which is the callback
              // If not provided the callback will be assumed to be the final argument in the argument list
              var cbName = U.param(params, 'cbName', null);
              
              // Create the callback `satisfy` which will satisfy `this` when called
              var satisfy = this.satisfy.bind(this);
              
              if (!U.instanceOf(cbParams, Array)) cbParams = [ cbParams ];
              
              if (cbName)
                // `U.deepSet` allows the user to control which parameter is replaced
                U.deepSet({ root: cbParams, name: cbName, value: satisfy, overwrite: true });
              else
                // If no `cbName` then append (this is default since most callback functions take callback as a final parameter)
                cbParams.push(satisfy);
              
              // Run the function
              cb.apply(null, cbParams);
              
            } else if ('all' in params) { // Allow a list of promises to be treated as a single promise
              
              var all = U.param(params, 'all');
              var results = new all.constructor(); // This allows the same code to process both arrays and objects
              var num = U.length(all);
              
              if (!num) this.satisfy(results);
              
              var pass = this;
              var count = 0;
              
              all.forEach(function(promise, k) {
                promise.then(function(val) {
                  results[k] = val;
                  if (++count >= num) pass.satisfy(results);
                  return val;
                });
              });
              
            } else if ('timeout' in params) {
              
              var timeout = U.param(params, 'timeout');
              setTimeout(this.satisfy.bind(this, null), timeout);
              
            } else if (U.isEmptyObj(params)) {
              
              // Manually satisfied promise
              
            } else {
              throw new Error('Invalid P params: ' + params);
            }
            
          },
          satisfy: function(/* ... */) {
            if (this.satisfied) throw new Error('Double-satisfied promise');
            
            this.multiArgs = arguments.length > 1;
            
            this.val = this.multiArgs ? U.toArray(arguments) : arguments[0];
            this.satisfied = true;
            
            for (var i = 0, len = this.waiting.length; i < len; i++) {
              var w = this.waiting[i];
              
              /*var innerVal = w.func
                ? (this.multiArgs ? w.func.apply(null, this.val) : w.func(this.val))
                : this.val;*/
              
              // TODO: Is it `w.getVal(...)` or `this.getVal(...)`???
              w.promise.trySatisfy(w.promise.getVal({
                val: this.val,
                task: w.func,
                multi: this.multiArgs
              }));
            }
            
            this.waiting = [];
          },
          trySatisfy: function(promiseVal, func) {
            if (!U.exists(func)) func = null;
            
            // Turn the promise into its value, if possible
            if (U.instanceOf(promiseVal, PACK.p.P) && promiseVal.satisifed) promiseVal = promiseVal.val;
            
            // Now dealing with either a value or an unsatisfied promise
            if (U.instanceOf(promiseVal, PACK.p.P)) {
              
              promiseVal.waiting.push({ promise: this, func: func });
              return false;
              
            } else {
              
              this.satisfy(this.getVal({
                val: promiseVal,
                task: func
              }));
              return true;
              
            }
          },
          getVal: function(params /* val, task, multi */) {
            
            var val = U.param(params, 'val');
            var task = U.param(params, 'task', null);
            var multi = U.param(params, 'multi', false);
            
            if (this.failTask && task) {
              
              try         { return multi ? task.apply(null, val) : task(val); }
              catch(err)  { return this.failTask(err); };
                
            }
            
            return task ? task(val) : val;
            
          },
          then: function(task) {
            if (!task) throw new Error('Need to provide a `task` param');
            
            return this.satisfied
              ? PACK.p.p(this.getVal({ val: this.val, task: task }))
              : new PACK.p.P({ val: this, func: task });
            
          },
          fail: function(failTask) {
            
            if (this.failTask) throw new Error('Multiple `fail` handlers');
            
            this.failTask = failTask;
            return this;
            
          },
          thenSeq: function(tasks) {
            var promise = this;
            var results = new tasks.constructor();
            var lastKey = null;
            
            tasks.forEach(function(task, k) {
              promise = promise.then(function(result) {
                if (lastKey !== null) results[lastKey] = result;
                lastKey = k;
                return task(results);
              });
            });
            
            // Need to add the final promise value to `results`, and return `results`.
            return promise.then(function(result) {
              if (lastKey !== null) results[lastKey] = result;
              return results;
            });
          }
        };}
      })
    };
  }
});
package.build();

/*

var P = PACK.p.P;

var d1 = new P({ cb: U.createDelay, cbParams: { delay: 3000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay3000'; });
var d2 = new P({ cb: U.createDelay, cbParams: { delay: 2000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay2000'; });
var d3 = new P({ cb: U.createDelay, cbParams: { delay: 1000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay1000'; });

var allDelays = new P({ all: [ d1, d2, d3 ] }).then(function(vals) {
	console.log('GOT', vals);
	return vals;
});

var dp = new P({ cb: U.createDelay, cbParams: { delay: 3550, repeat: false }, cbName: '0.task' }).then(function() { return 'HAHA'; });
var doubleDelay = new P({ all: { big: allDelays, lala: dp } }).then(function(vals) {
	console.log('FINAL', vals);
});

// =========================

var simplePromise = new P({ val: 'val' }).then(function(v) {
	console.log('YAY', v);
	return v;
}).then(function(v) {
	console.log('ANOTHER');
	return v;
});

var objSeq = new P({ val: { lol: 'ha' } }).thenSeq({
	thing1: 	function(v) { return new P({ val: '1' }).then(function(v) { console.log('HAHA!!'); return v; }); },
	thing2: 	function(v) { return '2'; },
	thing3: 	function(v) { return '3'; },
	delayed: 	function(v) { return new P({ cb: setTimeout, cbParams: [ null, 2000 ], cbName: '0' }).then(function() { return 'DD'; }) },
	delayed2: function(v) { return new P({ cb: setTimeout, cbParams: [ null, 1000 ], cbName: '0' }).then(function() { return v.delayed + ' AGAIN'; }) },
	thing5: 	function(v) { return '5'; }
}).then(function(allVals) {
	console.log('OBJECT SEQ:', allVals);
	return allVals;
});

var arrSeq = new P({ val: '0' }).thenSeq([
	function(v) { return '1'; },
	function(v) { return '2'; },
	function(v) { return new P({ cb: setTimeout, cbParams: [ null, 500 ], cbName: '0' }).then(function() { return '3' }) },
	function(v) { return v[0] + v[2]; }
]).then(function(allVals) {
	console.log('ARRAY SEQ:', allVals);
	return allVals;
});

new P({ all: [ objSeq, arrSeq, simplePromise ] }).then(function(allVals) {
	console.log('ALL', allVals);
});

// =========================

new P({ timeout: 1000 }).then(function() {
  console.log('WHOOOO');
  return new P({ timeout: 500 });
}).then(function() {
  console.log('ye');
  return new P({ timeout: 500 });
}).then(function() {
  console.log('ye');
  return new P({ timeout: 500 });
}).then(function() {
  console.log('ye');
  return new P({ timeout: 500 });
}).then(function() {
  console.log('ye');
  return new P({ timeout: 500 });
});

*/
