global.rooms['internal.real.htmlBrowser.Feel'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  let { Tmp, MemSrc } = U.logic;
  return U.form({ name: 'Feel', has: { Layout }, props: (forms, Form) => ({
    init: function({ modes=[ 'continuous', 'discrete' ] }={}) {
      
      if (!U.isForm(modes, Array)) modes = [ modes ];
      if (!modes.count()) throw Error(`Supply at least one mode`);
      if (modes.count() > 2) throw Error(`Supply maximum two modes`);
      if (modes.find(v => !U.isForm(v, String)).found) throw Error(`All modes should be String`);
      if (modes.find(v => ![ 'continuous', 'discrete' ].includes(v)).found) throw Error(`Invalid mode; use either "continuous" or "discrete"`);
      this.modes = modes;
      this.src = MemSrc.Tmp1();
      
    },
    isInnerLayout: function() { return false; },
    install: function(real) {
      
      let tmp = Tmp();
      let feelTmp = null;
      
      // In the unlikely scenario that the Feel itself ends as a feel
      // Tmp is in progress, end the Tmp!
      tmp.endWith(() => feelTmp && feelTmp.end());
      
      if (this.modes.has('continuous')) {
        
        let onnFn = evt => {
          if (feelTmp) return;
          
          // Create a new Tmp indicating hover.
          feelTmp = Tmp();
          
          // The Tmp ends when "mouseleave" occurs
          real.techNode.addEventListener('mouseleave', offFn);
          feelTmp.endWith(() => real.techNode.removeEventListener('mouseleave', offFn));
          
          this.src.send(feelTmp);
        };
        let offFn = evt => feelTmp && (feelTmp.end(), feelTmp = null);
        
        real.techNode.addEventListener('mouseenter', onnFn);
        tmp.endWith(() => real.techNode.removeEventListener('mouseenter', onnFn));
        
      }
      if (this.modes.has('discrete')) {
        
        let onnFn = evt => {
          if (feelTmp) return;
          
          // Create a new Tmp indicating hover.
          feelTmp = Tmp();
          
          // The Tmp ends when "blur" occurs
          real.techNode.addEventListener('blur', offFn);
          feelTmp.endWith(() => real.techNode.removeEventListener('blur', offFn));
          
          this.src.send(feelTmp);
        };
        let offFn = evt => feelTmp && (feelTmp.end(), feelTmp = null);
        
        real.techNode.addEventListener('focus', onnFn);
        tmp.endWith(() => real.techNode.removeEventListener('focus', onnFn));
        
      }
      
      return tmp;
      
    },
    render: function(real, domNode) {
      
      if (this.modes.has('continuous')) domNode.style.cursor = 'pointer';
      if (this.modes.has('discrete')) domNode.setAttribute('tabIndex', '0');
      
    }
  })});
  
};
