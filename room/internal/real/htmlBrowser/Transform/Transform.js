global.rooms['internal.real.htmlBrowser.Transform'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Transform', has: { Layout }, props: (forms, Form) => ({
    init: function({ rotate=null, scale=null, translate=null }={}) {
      Object.assign(this, { rotate, scale, translate });
    },
    render: function(real, domNode) {
      let ops = [];
      if (this.scale) ops.push([ 'scale', ...(U.isForm(this.scale, Array) ? this.scale : [ this.scale ]) ]);
      if (this.rotate) ops.push([ 'rotate', `${(this.rotate * 360).toFixed(2)}deg` ]);
      if (this.translate) ops.push([ 'translate', ...this.translate ]);
      if (ops.count()) domNode.style.transform = ops.map(([ type, ...v ]) => `${type}(${v.join(', ')})`).join(' ');
    }
  })});
  
};

