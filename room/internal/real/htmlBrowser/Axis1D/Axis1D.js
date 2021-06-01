global.rooms['internal.real.htmlBrowser.Axis1D'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Axis1D', has: { Layout }, props: (forms, Form) => ({
    
    $modes: 'stackFwd,stackBwd,stretch,compactCenter,disperseFully,dispersePadHalf,dispersePadFull'.cut(','),
    
    init: function({ axis='y', flow='+', mode='stack', overflowAction='none' }) {
      if (mode === 'stack') mode = 'stackFwd';
      if (!U.isForm(mode, Array) && !Form.modes.has(mode)) throw Error(`Invalid mode: ${mode}`);
      Object.assign(this, { axis, flow, mode, overflowAction });
    },
    isInnerLayout: function() { return true; },
    getChildLayout: function() { return Form.Item(this); },
    render: function(real, domNode) {
      
      // TODO: I took this off thinking of `* { position: relative; }`
      // so unless some other layout sets a non-relative/absolute
      // position we should always be guaranteed at least relative
      //if (![ 'relative', 'absolute' ].has(domNode.style.position)) domNode.style.position = 'relative';
      
      if (U.isForm(this.mode, String)) {
        
        domNode.style.display = 'flex';
        domNode.style.flexDirection = (this.axis === 'x')
          ? (this.flow === '+' ? 'row' : 'row-reverse')
          : (this.flow === '+' ? 'column' : 'column-reverse');
        
        // Controls tangent alignment; consider an Axis1D with dir: 'y'
        // and with children of varying widths; if they should be
        // horizontally centered we're all set, but if they should be
        // aligned left/right (so that wide ones jut out far to the side
        // past their siblings) we'll need additional properties to
        // define this behaviour
        domNode.style.alignItems = 'center';
        
        domNode.style.justifyContent = {
          stackFwd: 'start',
          stackBwd: 'end',
          stretch: 'stretch',
          compactCenter: 'center',
          disperseFully: 'space-between',
          dispersePadHalf: 'space-around',
          dispersePadFull: 'space-evenly',
        }[this.mode];
        
      } else if (U.isForm(this.mode, Array)) {
        
        // Children are sized using the specified "cuts"
        let values = [];
        
      }
      
      if (this.overflowAction === 'none') {
        domNode.style.overflow = 'hidden';
      } else {
        domNode.style.overflow = (this.axis === 'x') ? 'scroll hidden' : 'hidden scroll';
      }
      
    },
    
    $Item: U.form({ name: 'Axis1D.Item', has: { Layout }, props: (forms, Form) => ({
      init: function(par) {
        this.par = par;
      },
      render: function(real, domNode) {
        
        if (real.params.has('order') && U.isForm(real.params.order, Number)) {
          domNode.style.order = `${real.params.order}`;
        }
        
        if (this.par.mode === 'stretch') {
          
          // Children are all the same size
          domNode.style.flexGrow = '1';
          domNode.style.flexShrink = '1';
          domNode.style.flexBasis = '0';
          domNode.style[this.par.axis === 'x' ? 'height' : 'width'] = '100%';
          
        } else if (U.isForm(this.par.mode, Array)) {
          
          let cuts = this.par.mode;
          
          // Children are sized using the specified "cuts"
          let cutInd = this.params[0]; // TODO: Cut index should be found at something like `real.params.cutIndex`
          let offCuts = cuts.slice(0, cutInd);
          
          let off = offCuts.length ? `calc(${offCuts.join(' + ')})` : '0';
          let ext = (cutInd <= (cuts.count() - 1))
            ? cuts[cutInd]
            : `calc(100% - ${cuts.join(' - ')})`;
          
          domNode.style.position = 'absolute';
          
          let dir = this.par.flow + this.par.axis;
          if (dir === '+x') domNode.style.gain({ left: off, width: ext, height: '100%' });
          if (dir === '-x') domNode.style.gain({ right: off, width: ext, height: '100%' });
          if (dir === '+y') domNode.style.gain({ top: off, width: '100%', height: ext });
          if (dir === '-y') domNode.style.gain({ bottom: off, width: '100%', height: ext });
          
        }
        
      }
    })})
    
  })});
  
};
