U.makeTwig({ name: 'chess2', twigs: [], make: (html) => {
  
  const { TreeNode, Temporary } = U;
  
  const ClassDecorator = U.makeClass({ name: 'ClassDecorator', inspiration: { Temporary }, methods: (insp, Cls) => ({
    init: function({ classes, wobbly }) {
      insp.Temporary.init.call(this);
      this.classes = classes;
      this.wobbly = wobbly;
      this.onWobble = null;
      this.htmls = [];
    },
    getTmpActions: function() {
      return [
        {
          up: function() {
            this.onWobble = (newClass) => {
              A.each(this.htmls, html => {
                html.node.classList.remove(...this.classes);
                html.node.classList.add(newClass);
              });
            };
            this.wobbly.hold(this.onWobble);
          },
          dn: function() {
            this.wobbly.drop(this.onWobble);
            this.onWobble = null;
          }
        }
      ];
    }
  })});
  
  const Html = U.makeClass({ name: 'Html', inspiration: { TreeNode, Temporary }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer=null }) {
      
      insp.TreeNode.init.call(this, { name });
      insp.Temporary.init.call(this);
      this.node = null;
      this.decorators = [];
      
    },
    addDecorator: function(decorator) {
      this.decorators.push(decorator);
    },
    getTmpActions: function() {
      return [
        {
          up: function() {
            
            this.node = document.create('div');
            
          },
          dn: function() {
            
            if (this.node && this.node.parentNode) {
              this.node.parentNode.removeChild(this.node);
              this.node = null;
            }
            
          }
        }
      ];
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
          dn: function() {
            O.each(this.children, c => {
              this.getRealizer().remChild({ par: this, child: c });
              c.dn();
            });
          }
        }],
        insp.Real.getTmpActions.call(this),
        [{
          up: function() {
            O.each(this.children, c => {
              c.up();
              this.getRealizer().addChild({ par: this, child: c });
            });
          },
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
    ConstantFashion, DiscreetFashion, ContinuousFashion,
    Realizer, ClassicHtmlRealizer,
    Real, RealObj, RealArr, RealStr
  });
  
}});
