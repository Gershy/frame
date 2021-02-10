global.rooms['internal.real.htmlBrowser.Text'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Text', has: { Layout }, props: (forms, Form) => ({
    init: function({ text='', size=null, align=null, gap=null }) {
      Object.assign(this, { text, size, align, gap });
    },
    isInnerLayout: function() { return false; },
    
    render: function(real, domNode) {
      
      domNode.style.gain({
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis'
      });
      
      // Apply font size
      if (this.size) domNode.style.fontSize = this.size;
      
      // Apply text
      domNode.textContent = `${real.params.seek('text').val}`;
      
      // Apply text alignment; best results occur when flex and classic "text-align' props are used
      domNode.style.alignItems = { fwd: 'flex-start', bak: 'flex-end', mid: 'center', all: 'stretch' }[this.align || 'mid'];
      domNode.style.textAlign = { fwd: 'left', bak: 'right', mid: 'center', all: 'justify' }[this.align || 'mid'];
      
      if (this.gap) {
        domNode.style.boxSizing = 'border-box';
        domNode.style.padding = this.gap;
      }
      
    }
    
  })});
  
};
