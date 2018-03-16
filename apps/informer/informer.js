/*

An informer does 3 simple things:
1) Provides access to a value
2) Provides a means of requesting to modify the value
3) Provides a means of worrying about changes to the value

Note that request to modify the value does not equate to the immediately
modifying the value. It's possible there will be a delay between
requesting and having the value set. Worries help detect when the value
has actually changed.

Getting and modifying informer values should be immediate and blocking.
Informers track how many usages they have; an Informer with 0 usages will
terminate itself.

*/

var package = new PACK.pack.Package({ name: 'informer',
  dependencies: [ 'worry' ],
  buildFunc: function(nf, wr) {
    
    nf.Informer = U.makeClass({ name: 'Informer',
      mixins: [ wr.Worry ],
      resolvers: {
        init: function(initConflicts, params) {
          initConflicts.Worry.call(this, params);
          initConflicts.Informer.call(this, params);
        },
        addWorry: function(addWorryConflicts, type, func, key0) {
          addWorryConflicts.Worry.call(this, type, func, key0);
          addWorryConflicts.Informer.call(this);
        },
        remWorry: function(remWorryConflicts, type, func) {
          remWorryConflicts.Worry.call(this, type, func);
          remWorryConflicts.Informer.call(this);
        },
        start: function(startConflicts) {
          startConflicts.Worry.call(this);
          startConflicts.Informer.call(this);
        },
        stop: function(stopConflicts) {
          stopConflicts.Worry.call(this);
          stopConflicts.Informer.call(this);
        }
      },
      methods: function(sc, c) { return {
        
        init: function(params /* */) {
          this.usages = 0;
        },
        
        addWorry: function() {
          
          this.usages++;
          if (!this.isStarted()) this.start();
          
        },
        remWorry: function() {
          
          if (this.usages <= 0) throw new Error('Negative usages');
          
          this.usages--;
          if (this.usages === 0) this.stop();
          
        },
        
        getValue: function() {
          throw new Error('not implemented for ' + this.constructor.title);
        },
        setValue: function(newVal) {
          
          // TODO: Check if `newVal` is any different than current value?
          this.setValue0(newVal);
          this.worry('invalidated');
          
        },
        setValue0: function(newVal) {
          throw new Error('not implemented');
        },
        modValue: function(f) {
          this.setValue(f(this.getValue()));
        },
        
        isStarted: function() {
          throw new Error('not implemented');
        },
        start: function() {
          
        },
        stop: function() {
        }
        
      }; }
    });
    nf.AbstractValueInformer = U.makeClass({ name: 'AbstractValueInformer', superclass: nf.Informer,
      methods: function(sc, c) { return {
        
        init: function(params /* value */) {
          sc.init.call(this, params);
          this.value = U.param(params, 'value', null);
        },
        getValue: function() { return this.value; },
        setValue0: function(newVal) { this.value = newVal; },
        
        isStarted: function() { throw new Error('not implemented'); }
        
      }; }
    });
    nf.ValueInformer = U.makeClass({ name: 'ValueInformer', superclass: nf.AbstractValueInformer,
      methods: function(sc, c) { return {
        
        init: function(params /* value */) {
          sc.init.call(this, params);
          this.started = false;
        },
        isStarted: function() { return this.started; },
        start: function() {
          sc.start.call(this);
          this.started = true;
        },
        stop: function() {
          this.started = false;
          sc.stop.call(this);
        }
        
      }; }
    });
    nf.CalculationInformer = U.makeClass({ name: 'CalculationInformer', superclass: nf.Informer,
      methods: function(sc, c) { return {
        
        init: function(params /* dependencies, calc, delayTime */) {
          
          sc.init.call(this, params);
          this.dependencies = U.param(params, 'dependencies', []);
          this.calc = U.param(params, 'calc');
          
          this.selfInvalidated = null; // The function which will invalidate this Informer if any dependencies invalidate
          this.value = null;
          
          // TODO: Previously, initial value was `null`, only becoming calculated after `this.start()`
          this.value = this.calc.apply(null, A.map(this.dependencies, function(dep) { return dep.getValue() }));
          
        },
        onDependencyInvalidated: function() {
          
          this.value = this.calc.apply(null, A.map(this.dependencies, function(dep) { return dep.getValue() }));
          this.worry('invalidated');
          
        },
        
        getValue: function() {
          return this.value;
        },
        setValue0: function(newVal) {
          throw new Error('Can\'t set values on ' + this.constructor.title);
        },
        
        isStarted: function() {
          return !!this.invalidateSelf;
        },
        start: function() {
          
          sc.start.call(this);
          
          var selfInvalidated = this.selfInvalidated = this.onDependencyInvalidated.bind(this);
          A.each(this.dependencies, function(dep) { dep.addWorry('invalidated', selfInvalidated); });
          
        },
        stop: function() {
          
          this.value = null;
          
          var selfInvalidated = this.selfInvalidated;
          this.selfInvalidated = null;
          A.each(this.dependencies, function(dep) { dep.remWorry('invalidated', selfInvalidated); });
          
          sc.stop.call(this);
          
        }
        
      }; }
    });
    
    // TODO: CoalescingInformer??? (receives multiple updates from multiple informers but only processes them so often)
    
  }
});
package.build();
