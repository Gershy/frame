U.makeTwig({ name: 'real', twigs: [], make: (real) => {
  
  // TODO: Link css to display through stylesheets by allowing Realizers
  // to "apply" to... `clearance.deployment`? Somewhere there needs to be
  // a way for arbitrary component-specific assets to be added into the
  // client's environment.
  
  const { Temporary, TreeNode } = U;
  
  const Realizer = U.makeClass({ name: 'Realizer', inspiration: {}, methods: (insp, Cls) => ({
    
    init: function({}) {
      
      this.ready = this.genReadyPromise();
      
    },
    genReadyPromise: async function() { throw new Error('not implemented'); },
    genFashion: function(props) {
      throw new Error('not implemented... YET ;D ;D ;D ;D');
    }
    
  })});
  const ClassicHtmlRealizer = U.makeClass({ name: 'ClassicHtmlRealizer', inspiration: { Realizer }, methods: (insp, Cls) => ({
    
    init: function({}) {
      
      insp.Realizer.init.call(this, {});
      
    },
    genReadyPromise: async function() {
      return await new Promise(rsv => { window.onload = rsv; });
    },
    produce: function(real) {
      
      let elem = document.createElement('div');
      elem.classList.add('rl-' + real.name);
      elem.id = real.getAddress('arr').join('-');
      return elem;
      
    },
    release: function(real) {
      
      // Nothing
      
    },
    addChild: function({ par, child }) {
      
      let parRealization = par ? par.realization : document.body;
      parRealization.appendChild(child.realization);
      
    },
    remChild: function({ par, child }) {
      
      if (par && !par.realization) throw new Error('Bad parent');
      
      let parRealization = par ? par.realization : document.body;
      
      parRealization.removeChild(child.realization);
      
    },
    setText: function(real, text) {
      
      // TODO: Escaping!!
      let realization = real.realization;
      if (realization.innerHTML !== text) realization.innerHTML = text;
      
    }
    
  })});
  
  const Real = U.makeClass({ name: 'Real', inspiration: { TreeNode, Temporary }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer=null }) {
      insp.TreeNode.init.call(this, { name });
      this.realizer = realizer;
      this.realization = null;
      this.fashions = [];
    },
    addFashion: function(wobbly) {
      this.fashions.push(wobbly);
    },
    getRealizer: function() {
      if (!this.realizer) this.realizer = this.par.getRealizer();
      return this.realizer;
    },
    getTmpActions: function() {
      return [
        {
          up: function() {
            let realizer = this.getRealizer();
            this.realization = realizer.produce(this);
            realizer.addChild({ par: this.par, child: this });
          },
          dn: function() {
            let realizer = this.getRealizer();
            realizer.remChild({ par: this.par, child: this });
            realizer.release(this);
            this.realization = null;
          }
        },
        {
          up: function() {
            throw new Error('not implemented; add all fashions!!');
          },
          dn: function() {
            throw new Error('not implemented; rem all fashions!!');
          }
        }
      ]
    }
    
  })});
  const RealObj = U.makeClass({ name: 'RealObj', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer }) {
      
      insp.Real.init.call(this, { name, realizer });
      this.children = {};
      
    },
    getTmpActions: function() {
      
      // Children go dn before parent goes down; children go up after parent goes up
      return A.include(
        [{
          up: function() {},
          dn: function() { O.each(this.children, c => c.dn()); }
        }],
        insp.Real.getTmpActions.call(this),
        [{
          up: function() { O.each(this.children, c => c.up()); },
          dn: function() {}
        }]
      );
      
    },
    add: function(child) {
      
      this.children[child.name] = child;
      child.par = this;
      return child;
      
    },
    rem: function(child) {
      
      if (child.par !== this) throw new Error(`Child ${child.describe()} is not a child of ${this.describe()}`);
      child.par = null;
      delete this.children[child.name];
      
    }
    
  })});
  const RealArr = U.makeClass({ name: 'RealArr', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer, wobbly }) {
      
      insp.Real.init.call(this, { name, realizer });
      this.wobbly = wobbly;
      this.template = null;
      this.children = {};
      
      this.onRecWobble = (delta) => {
        
        if (!delta) throw new Error('Wobble without delta :(');
        if (!O.has(delta, 'add')) throw new Error('Invalid delta; missing "add"');
        if (!O.has(delta, 'rem')) throw new Error('Invalid delta; missing "rem"');
        
        A.each(delta.add, childReal => {
          let real = this.template(childReal);
          this.children[real.name] = real;
          real.par = this;
          real.up();
        });
        
        A.each(delta.rem, childRealName => {
          let real = this.children[childRealName];
          delete this.children[real.name];
          real.par = null;
          real.dn();
        });
        
      };
      
    },
      
    getTmpActions: function() {
      
      // Children go dn before parent goes down
      return A.include(
        [{
          up: function() {},
          dn: function() { O.each(this.children, c => c.dn()); }
        }],
        insp.Real.getTmpActions.call(this),
        [{
          up: function() { this.wobbly.hold(this.onRecWobble); },
          dn: function() { this.wobbly.drop(this.onRecWobble); }
        }]
      );
      
    },
      
    getTmpActions: function() {
      
      return A.include(insp.Real.getTmpActions.call(this), [
        {
          up: function() {
            this.wobbly.hold(this.onRecWobble);
          },
          dn: function() {
            this.wobbly.drop(this.onRecWobble);
          }
        }
      ]);
      
    },
    setTemplate: function(template) {
      this.template = template;
    }
    
  })});
  const RealStr = U.makeClass({ name: 'RealStr', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer, wobbly }) {
      
      if (!wobbly) throw new Error('Missing "wobbly" param');
      
      insp.Real.init.call(this, { name, realizer });
      this.wobbly = wobbly;
      
      this.onRecWobble = (delta) => {
        this.getRealizer().setText(this, this.wobbly.getValue());
      };
      
    },
    getTmpActions: function() {
      
      return A.include(insp.Real.getTmpActions.call(this), [
        {
          up: function() {
            this.getRealizer().setText(this, this.wobbly.getValue());
            this.wobbly.hold(this.onRecWobble);
          },
          dn: function() {
            this.wobbly.drop(this.onRecWobble);
          }
        }
      ]);
      
    }
    
  })});
  
  O.include(real, {
    Realizer, ClassicHtmlRealizer,
    Real, RealObj, RealArr, RealStr
  });
  
}});
