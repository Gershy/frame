global.rooms['internal.real.htmlBrowser.Image'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Image', has: { Layout }, props: (forms, Form) => ({
    init: function({ keep=null }={}) {
      Object.assign(this, { keep });
    },
    render: function(real, domNode) {
      
      if (!this.keep) return;
      domNode.style.backgroundImage = `url('${this.keep.getUrl()}')`;
      domNode.style.backgroundSize = 'cover';
      
    }
  })});
  
};
