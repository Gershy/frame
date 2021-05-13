global.rooms['internal.real.htmlBrowser.Press'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  let { Src, Tmp } = U.logic;
  
  return U.form({ name: 'Press', has: { Layout, Src }, props: (forms, Form) => ({
    init: function({ modes=[ 'continuous', 'discrete' ] }={}) {
      
      forms.Src.init.call(this);
      
      if (!U.isForm(modes, Array)) modes = [ modes ];
      if (!modes.count()) throw Error(`Supply at least one mode`);
      if (modes.count() > 2) throw Error(`Supply maximum two modes`);
      if (modes.find(v => !U.isForm(v, String)).found) throw Error(`All modes should be String`);
      if (modes.find(v => ![ 'continuous', 'discrete' ].includes(v)).found) throw Error(`Invalid mode; use either "continuous" or "discrete"`);
      this.modes = modes;
      
    },
    isInnerLayout: function() { return false; },
    
    install: function(real) {
      
      let tmp = Tmp();
      let domNode = real.domNode;
      
      if (this.modes.has('continuous')) {
        let clickFn = evt => this.send();
        domNode.addEventListener('click', clickFn);
        tmp.endWith(() => domNode.removeEventListener('click', clickFn));
      }
      
      if (this.modes.has('discrete')) {
        let keyFn = evt => {
          if (evt.ctrlKey || evt.altKey || evt.shiftKey || evt.code !== 'Enter') return;
          evt.preventDefault();
          evt.stopPropagation();
          this.send();
        };
        domNode.addEventListener('keypress', keyFn);
        tmp.endWith(() => domNode.removeEventListener('keypress', keyFn));
      }
      
      if (this.modes.has('discrete') && this.modes.has('continuous')) {
        domNode.setAttribute('tabIndex', '0');
        tmp.endWith(() => domNode.removeAttribute('tabIndex'));
      }
      
      return tmp;
      
    },
    
    render: function(real, domNode) {
      if (this.modes.includes('continuous')) domNode.style.cursor = 'pointer';
    }
    
  })});
  
};
