global.rooms['internal.real.generic.Real'] = async foundation => {
  
  let { Tmp } = U.logic;
  return U.form({ name: 'Real', has: { Tmp }, props: (forms, Form) => ({
    init: function({ name=null, params={}, layouts=Set(), parent=null }={}) {
      
      forms.Tmp.init.call(this);
      
      this.name = name;
      this.params = params; // For dynamic layout behaviour
      this.parent = parent;
      this.root = parent ? parent.root : this;
      this.children = Set();
      this.tree = {};
      
      this.layouts = Set();
      for (let layout of layouts) this.addLayout(layout);
      
    },
    getTech: function() { return this.root.tech; },
    getLayoutForm: function(formName) { return this.getTech().getLayoutForm(formName); },
    getLayouts: function*() { for (let lay of this.layouts) yield lay; },
    getLayout: function(LayoutForm) { return this.layouts.find(l => U.hasForm(l, LayoutForm)).val; },
    
    render: function(delta=null) {
      
      if (this.renderPrm) return;
      
      this.renderPrm = Promise(r => foundation.queueTask(() => {
        
        // Note that the tech has a render step, and the specific class
        // of Real may take its own render step as well. This allows the
        // tech to react according to its display paradigm (e.g.
        // persistent vs per-frame graphics), and the Real to manage its
        // visuals within the display tree as well
        this.getTech().render(this, delta);
        this.renderPrm = null;
        
      }));
      
    },
    mod: function(paramDelta={}) { this.params.gain(paramDelta); this.render({ paramDelta }); return this; },
    
    addReal: function(...args) {
      
      // Derive a Real instance from `args`
      let real = (() => {
        
        // If a simple Real instance was provided, attach and return it:
        if (args.count() === 1 && U.isForm(args[0], this.Form)) {
          if (real.parent) throw Error(`Real already has a parent`);
          real.parent = this;
          real.root = this.root;
          return real;
        }
        
        if (U.isForm(args[0], String)) {
          
          let name = args[0];
          
          // Add our namespace prefix to the child's name if necessary
          if (!name.has('.')) name = `${this.name.cut('.', 1)[0]}.${name}`;
          
          // Use the knowledge that `params` will be an Object, while
          // `layouts` will be an `Array`
          let params = args.find(v => U.isForm(v, Object)).val || {};
          let layouts = args.find(v => U.isForm(v, Array)).val || [];
          
          // Include any additional info from the tree
          if (this.tree.has(name)) {
            let treeDef = this.tree[name];
            params = { ...params, ...treeDef.params };
            layouts = [ ...layouts, ...treeDef.layouts ];
          }
          
          let RealForm = this.Form;
          return RealForm({ name, parent: this, params, layouts });
          
        }
        
        throw Error(`Couldn't derive Real from given params (args[0] was a ${U.getFormName(args[0])})`);
        
      })();
      
      for (let innerLayout of this.layouts.map(l => l.isInnerLayout() ? l : C.skip)) {
        real.addLayout(innerLayout.getChildLayout());
      }
      
      this.children.add(real);
      real.endWith(() => this.children.rem(real));
      
    },
    
    cleanup: function() {
      this.parent = null;
      for (let layout of this.layouts) layout.end();
      // TODO: rerender upon cleanup? Some Techs may require it...
    },
    addLayout: function(layout) {
      
      if (layout.isInnerLayout()) for (let child of this.children) {
        let childLayout = layout.getChildLayout(child);
        layout.endWith(childLayout);
        child.addLayout(childLayout);
      }
      
      layout.endWith(layout.install(this));
      
      this.layouts.add(layout);
      this.render({ add: [ layout ] });
      layout.endWith(() => {
        this.layouts.rem(layout);
        this.render({ rem: [ layout ] });
      });
      
      return layout;
      
    }
  })});
  
};
