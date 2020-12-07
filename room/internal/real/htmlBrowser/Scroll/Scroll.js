global.rooms['internal.real.htmlBrowser.Scroll'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Scroll', has: { Layout }, props: (forms, Form) => ({
    init: function({ mode='cen', x=null, y=null, w=null, h=null }) {
      ({}).gain.call(this, { mode, x, y, w, h });
    },
    isInnerLayout: function() { return true; },
    getChildLayout: function() { return Form.Item(this); },
    
    render: function(real) {
      
      let { x, y } = this;
      if (x === 'auto') real.domNode.style.overflowX = 'auto';
      if (x === 'show') real.domNode.style.overflowX = 'scroll';
      if (y === 'auto') real.domNode.style.overflowY = 'auto';
      if (y === 'show') real.domNode.style.overflowY = 'scroll';
      
    },
    
    $Item: U.form({ name: 'Scroll.Item', has: { Layout }, props: (forms, Form) => ({
      init: function(par, ...params) {
        this.par = par;
      },
      render: function(real) {
        
        let { x, y } = this.par;
        if (x !== 'none' || y !== 'none') real.domNode.style.scrollBehavior = 'smooth';
        
      }
    })})
    
  })});
  
};
