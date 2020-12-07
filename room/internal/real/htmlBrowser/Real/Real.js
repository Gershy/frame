global.rooms['internal.real.htmlBrowser.Real'] = async foundation => {
  
  let { Tmp, Slots } = U.logic;
  return U.form({ name: 'Real', has: { Slots, Tmp }, props: (forms, Form) => ({
    init: function({ name=null, params={}, layouts=Set(), parent=null }={}) {
      
      if (U.isForm(layouts, Array)) layouts = Set(layouts);
      if (!U.isForm(layouts, Set)) throw Error(`"layouts" should be Set (or Array); got ${U.getFormName(layouts)}`);
      
      forms.Slots.init.call(this);
      forms.Tmp.init.call(this);
      
      this.renderPrm = null;
      this.name = name;
      this.params = params; // For dynamic layout behaviour
      this.parent = parent;
      this.root = parent ? parent.root : this;
      
      this.techNode = this.domNode = document.createElement('div');
      if (this.name) this.domNode.classList.add(this.name.replace(/([^a-zA-Z0-9]+)([a-zA-Z0-9])?/g, (f, p, c) => c ? c.upper() : ''));
      
      this.children = Set();
      
      this.layouts = Set();
      for (let layoutPrm of layouts) U.then(layoutPrm, layout => this.addLayout(layout));
      
    },
    ancestry: function() { return !this.parent ? [] : [ this, ...this.parent.ancestry() ]; },
    getTech: function() { return this.root.tech; },
    getTechNode: function() { return this.techNode || (this.techNode = this.getTech().createTechNode(this)); },
    
    getLayoutForms: function(...formNames) {
      return formNames.toObj(formName => [ formName, this.getLayoutForm(formName) ]);
    },
    getLayoutForm: function(formName) { return this.getTech().getLayoutForm(formName); },
    makeLayout: function(formName, ...args) { return U.then(this.getTech().getLayoutForm(formName), Form => Form(...args)); },
    
    getLayouts: function*() {
      // If `this.layouts` becomes a Map of Arrays we'll still easily be
      // able to walk all Layouts using this generator
      for (let lay of this.layouts) yield lay;
    },
    getLayout: function(LayoutForm) { return this.layouts.find(l => U.hasForm(l, LayoutForm)).val; },
    
    render: function(delta=null) {
      
      if (this.renderPrm) return;
      
      this.renderPrm = Promise(r => foundation.queueTask(() => {
        this.renderPrm = null;
        this.getTech().render(this, delta);
      }));
      
    },
    mod: function(params={}) { this.params.gain(params); this.render(); return this; },
    addReal: function(real, ...args) {
      
      // Resolve String -> Real using String as name, and given Layouts
      if (U.isForm(real, String)) {
        
        // 2 params: name, layouts
        // 3 params: name, params, layouts
        let [ params={}, layouts=[] ] = args.count() === 1 ? [ {}, ...args ] : args;
        let RealForm = this.Form;
        real = RealForm({ name: real, parent: this, params, layouts });
        
      } else {
        
        if (!U.isForm(real, this.Form)) throw Error(`Invalid real param; got ${U.getFormName(real)}`);
        if (real.parent) throw Error(`Real already has a parent`);
        real.parent = this;
        real.root = this.root;
        
      }
      
      // If Layouts or Reals are added apply any InnerLayout
      let innerLayout = this.layouts.find(l => l.isInnerLayout()).val;
      if (innerLayout) real.addLayout(innerLayout.getChildLayout());
      
      this.children.add(real);
      real.endWith(() => this.children.rem(real));
      
      // Attach `real` using the tech
      this.getTech().addNode(this, real);
      
      // Render from scratch
      real.render();
      
      return real;
      
    },
    cleanup: function() {
      if (this.techNode) { this.getTech().remNode(this); this.techNode = null; }
      this.parent = null;
      // TODO: rerender upon cleanup? Some Techs may require it...
    },
    addLayout: function(...layouts) {
      let tmp = Tmp();
      for (let lay of layouts) U.then(lay, lay => {
        
        // If Layouts or Reals are added apply any InnerLayout
        // TODO: What if `lay` supplies an InnerLayout, and then gets
        // removed? We need to remove the InnerLayout from the child!
        if (lay.isInnerLayout()) for (let r of this.children) r.addLayout(lay.getChildLayout());
        this.layouts.add(lay);
        
        tmp.endWith(lay.install(this));
        
      });
      
      this.render({ add: layouts });
      tmp.endWith(() => {
        for (let lay of layouts) this.layouts.rem(lay);
        this.render({ rem: layouts });
      });
      
      tmp.layout = layouts[0];
      return tmp;
    }
  })});
  
};
