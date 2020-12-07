global.rooms['internal.real.htmlBrowser.Axis1D'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Axis1D', has: { Layout }, props: (forms, Form) => ({
    init: function({ axis='y', flow='+', cuts=null }) {
      ({}).gain.call(this, { axis, flow, cuts });
    },
    isInnerLayout: function() { return true; },
    getChildLayout: function() { return Form.Item(this); },
    render: function(real, domNode) {
      
      if (![ 'relative', 'absolute' ].has(domNode.style.position)) domNode.style.position = 'relative';
      
      if ([ null, 'focus', 'distribute' ].includes(this.cuts)) {
        
        domNode.style.display = 'flex';
        domNode.style.flexDirection = (this.axis === 'x')
          ? (this.flow === '+' ? 'row' : 'row-reverse')
          : (this.flow === '+' ? 'column' : 'column-reverse');
        domNode.style.alignItems = 'center'; // 'flex-start', 'center', 'flex-end'
        
        domNode.style.justifyContent = {
          stack: 'auto',
          focus: 'center',
          distribute: 'auto'
        }[this.cuts || 'stack']; // null -> 'stack'
        
      } else if (U.isForm(this, Array)) {
        
        // Children are sized using the specified "cuts"
        let values = [];
        
      }
      
    },
    
    $Item: U.form({ name: 'Axis1D.Item', has: { Layout }, props: (forms, Form) => ({
      init: function(par) {
        forms.Layout.init.call(this);
        this.par = par;
      },
      render: function(real, domNode) {
        
        if (this.par.cuts === null) {
          
          // Children determine their own size in the axis direction, and have 100% perp direction
          
        } else if (this.par.cuts === 'distribute') {
          
          // Children are all the same size
          domNode.style.flexGrow = '1';
          domNode.style.flexShrink = '1';
          domNode.style.flexBasis = '0';
          domNode.style[this.par.axis === 'x' ? 'height' : 'width'] = '100%';
          
        } else if (U.isForm(this.par.cuts, Array)) {
          
          // Children are sized using the specified "cuts"
          let cutInd = this.params[0]; // TODO: Cut index should be found at something like `real.params.cutIndex`
          let offCuts = this.par.cuts.slice(0, cutInd);
          
          let off = offCuts.length ? `calc(${offCuts.join(' + ')})` : '0';
          let ext = (cutInd <= (this.par.cuts.length - 1))
            ? this.par.cuts[cutInd]
            : `calc(100% - ${this.par.cuts.join(' - ')})`;
          
          domNode.style.position = 'absolute';
          
          let dir = `${this.par.flow}${this.par.axis}`
          if (dir === '+x') domNode.style.gain({ left: off, width: ext, height: '100%' });
          if (dir === '-x') domNode.style.gain({ right: off, width: ext, height: '100%' });
          if (dir === '+y') domNode.style.gain({ top: off, width: '100%', height: ext });
          if (dir === '-y') domNode.style.gain({ bottom: off, width: '100%', height: ext });
          
        }
        
      }
    })})
    
  })});
  
};
