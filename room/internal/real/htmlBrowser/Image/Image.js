global.rooms['internal.real.htmlBrowser.Image'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Image', has: { Layout }, props: (forms, Form) => ({
    init: function({ keep=null, smoothing=true, scale=1 }={}) {
      Object.assign(this, { keep, smoothing, scale });
    },
    render: function(real, domNode) {
      
      if (!this.keep) return;
      
      domNode.style.imageRendering = this.smoothing ? '' : 'pixelated';
      domNode.style.backgroundImage = `url('${this.keep.getUrl()}')`;
      domNode.style.backgroundRepeat = 'no-repeat';
      domNode.style.backgroundPosition = 'center';
      domNode.style.backgroundSize = (this.scale === 1) ? 'cover' : `${(this.scale * 100).toFixed(3)}%`;
      
    }
  })});
  
};
