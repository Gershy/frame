global.rooms['internal.real.htmlBrowser.Real'] = async foundation => {
  
  let { Tmp, Slots } = U.logic;
  let GenericReal = await foundation.getRoom('internal.real.generic.Real');
  return U.form({ name: 'Real', has: { GenericReal }, props: (forms, Form) => ({
    init: function({ name=null, ...args }={}) {
      
      this.renderPrm = null;
      this.domNode = document.createElement('div');
      if (name) this.domNode.classList.add(name.replace(/([^a-zA-Z0-9]+)([a-zA-Z0-9])?/g, (f, p, c) => c ? c.upper() : ''));
      
      forms.GenericReal.init.call(this, { name, ...args });
      
    },
    addReal: function(...args) {
      
      let real = forms.GenericReal.addReal.call(this, ...args);
      this.domNode.appendChild(real.domNode);
      real.render();
      return real;
      
    },
    cleanup: function() {
      
      if (this.domNode) { this.domNode.remove(); this.domNode = null; }
      forms.GenericReal.cleanup.call(this);
      
    }
  })});
  
};
