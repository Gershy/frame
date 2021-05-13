global.rooms['internal.real.htmlBrowser.Text'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Text', has: { Layout }, props: (forms, Form) => ({
    init: function({ text=null, size=null, align=null, gap=null, style='' }) {
      if (U.isForm(style, String)) style = style.split(',');
      Object.assign(this, { text, size, align, gap, style: Set(style) });
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
      domNode.textContent = `${this.text || real.params.seek('text').val}`;
      
      // Apply text alignment; best results occur when flex and classic "text-align" props are used
      domNode.style.alignItems = { fwd: 'flex-start', bak: 'flex-end', mid: 'center', all: 'stretch' }[this.align || 'mid'];
      domNode.style.textAlign = { fwd: 'left', bak: 'right', mid: 'center', all: 'justify' }[this.align || 'mid'];
      
      if (this.gap) {
        domNode.style.boxSizing = 'border-box';
        domNode.style.padding = this.gap;
      }
      
      if (this.style.has('bold')) domNode.style.fontWeight = 'bold';
      if (this.style.has('italic')) domNode.style.fontStyle = 'italic';
      
    }
    
  })});
  
};
