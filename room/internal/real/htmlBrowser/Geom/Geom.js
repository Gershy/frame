global.rooms['internal.real.htmlBrowser.Geom'] = async foundation => {
  
  let { Layout, Axis1D } = await foundation.getRooms([
    'internal.real.generic.Layout',
    'internal.real.htmlBrowser.Axis1D'
  ]);
  
  return U.form({ name: 'Geom', has: { Layout }, props: (forms, Form) => ({
    init: function({ x=null, y=null, w=null, h=null, anchor=(x !== null || y !== null) ? 'cen' : 'none' }) {
      Object.assign(this, { anchor, x, y, w, h });
    },
    render: function(real, domNode) {
      
      if (this.w) domNode.style.width = this.w;
      if (this.h) domNode.style.height = this.h;
      
      // Skip all positioning changes if no anchor
      if (this.anchor === 'none') return;
      
      let hasAxis1D = real.layouts.find(lay => U.isForm(lay, Axis1D.Item)).found;
      if (hasAxis1D && (this.x !== null || this.y !== null || this.anchor !== 'cen')) throw Error(`Geom provided x/y along with Axis1D positioning`);
      if (!hasAxis1D) domNode.style.position = 'absolute';
      
      if (this.anchor === 'cen') {
        
        let { x, y } = this;
        if (x === '0') x = null;
        if (y === '0') y = null;
        
        if (!hasAxis1D) {
          domNode.style.left = `calc(50% - ${this.w} * 0.5${x ? ' + ' + x : ''})`;
          domNode.style.top = `calc(50% - ${this.h} * 0.5${y ? ' + ' + y : ''})`;
        }
        
      } else if (this.anchor === 't') {
        
        let { x, y } = this;
        if (!x) x = '0';
        if (!y) y = '0';
        domNode.style.left = `calc(50% - ${this.w} * 0.5 + ${x})`;
        domNode.style.top = y;
        
      } else if (this.anchor === 'b') {
        
        let { x, y } = this;
        if (!x) x = '0';
        if (!y) y = '0';
        domNode.style.left = `calc(50% - ${this.w} * 0.5 + ${x})`;
        domNode.style.bottom = y;
        
      } else if (this.anchor === 'tl') {
        let { x, y } = this;
        if (x) domNode.style.left = x || '0';
        if (y) domNode.style.top = y || '0';
      } else if (this.anchor === 'tr') {
        let { x, y } = this;
        if (x) domNode.style.right = x || '0';
        if (y) domNode.style.top = y || '0';
      } else {
        throw Error(`Unsupported mode: "${this.anchor}"`);
      }
      
    }
  })});
  
};
