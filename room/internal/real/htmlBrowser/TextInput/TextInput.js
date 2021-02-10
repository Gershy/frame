global.rooms['internal.real.htmlBrowser.TextInput'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  let { MemSrc, Tmp } = U.logic;
  
  return U.form({ name: 'TextInput', has: { Layout }, props: (forms, Form) => ({
    init: function({ multiline=false, prompt, size=null, align=null, gap=null }) {
      Object.assign(this, { multiline, prompt, size, align, gap });
    },
    isInnerLayout: function() { return false; },
    
    install: function(real) {
      
      if (!real.params.has('text')) real.params.text = '';
      if (U.isForm(real.params.text, String)) real.params.text = MemSrc.Prm1(real.params.text);
      if (!U.isForm(real.params.text, MemSrc.Prm1)) throw Error(`Invalid Real "text" param; need MemSrc.Prm1; got ${U.getFormName(real.params.text)}`);
      
      let domNode = real.domNode;
      let src = real.params.text;
      let tmp = Tmp();
      
      let input = document.createElement('input');
      input.style.gain({
        position: 'absolute', display: 'block', boxSizing: 'border-box',
        width: '100%', height: '100%', left: '0', top: '0',
        padding: 'inherit', border: 'none',
        backgroundColor: 'transparent',
        textAlign: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit'
      });
      input.value = src.val;
      
      if (this.prompt) input.setAttribute('placeholder', this.prompt);
      
      if (!domNode.style.position) {
        domNode.style.position = 'relative';
        tmp.endWith(() => domNode.style.position = '');
      }
      
      domNode.appendChild(input);
      tmp.endWith(() => input.remove());
      
      let inpFn = evt => src.retain(input.value);
      input.addEventListener('input', inpFn);
      tmp.endWith(() => input.removeEventListener('input', inpFn));
      return tmp;
      
    },
    render: function(real, domNode) {
      
      if (this.multiline) {
      } else {
      }
      
      if (!domNode.style.position) domNode.style.position = 'relative';
      if (this.size) domNode.style.fontSize = this.size;
      if (this.align) domNode.style.textAlign = { fwd: 'left', bak: 'right', mid: 'center' }[this.align];
      if (this.gap) {
        domNode.style.boxSizing = 'border-box';
        domNode.style.padding = this.gap;
      }
      
    }
    
  })});
  
};
