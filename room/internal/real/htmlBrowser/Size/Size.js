global.rooms['internal.real.htmlBrowser.Size'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Size', has: { Layout }, props: (forms, Form) => ({
    init: function({ ratio=null, w=ratio ? null : '100%', h=ratio ? null : '100%' }) {
      if (ratio !== null && (w === null) === (h === null)) throw Error(`With "ratio" must provide exactly one of "w" or "h"`);
      ({}).gain.call(this, { ratio, w, h });
    },
    render: function(real, domNode) {
      
      let { w, h, ratio } = this;
      if (ratio !== null) {
        let [ amt, unit ] = ((w !== null) ? w : h).match(/([0-9]*)(.*)/).slice(1);
        if (w !== null) h = `${parseFloat(amt) / ratio}${unit}`;
        if (h !== null) w = `${parseFloat(amt) * ratio}${unit}`;
        domNode.style.width = w;
        domNode.style.paddingBottom = h;
      } else {
        if (w !== null) domNode.style.width = w;
        if (h !== null) domNode.style.height = h;
      }
      
    }
  })});
  
};
