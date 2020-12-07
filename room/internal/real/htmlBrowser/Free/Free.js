global.rooms['internal.real.htmlBrowser.Free'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Free', has: { Layout }, props: (forms, Form) => ({
    init: function({ mode='cen', x=null, y=null, w=null, h=null }) {
      ({}).gain.call(this, { mode, x, y, w, h });
    },
    render: function(real, domNode) {
      
      domNode.style.position = 'absolute';
      if (this.w) domNode.style.width = this.w;
      if (this.h) domNode.style.height = this.h;
      if (this.mode === 'cen') {
        let { x, y } = this;
        if (x === '0') x = null;
        if (y === '0') y = null;
        domNode.style.left = `calc(50% - ${this.w} * 0.5${x ? ' + ' + x : ''})`;
        domNode.style.top = `calc(50% - ${this.h} * 0.5${y ? ' + ' + y : ''})`;
      } else if (this.mode === 'tl') {
        let { x, y } = this;
        if (x) domNode.style.left = x || '0';
        if (y) domNode.style.top = y || '0';
      } else if (this.mode === 'tr') {
        let { x, y } = this;
        if (x) domNode.style.right = x || '0';
        if (y) domNode.style.top = y || '0';
      } else {
        throw Error(`Unsupported mode: "${this.mode}"`);
      }
      
    }
  })});
  
};
