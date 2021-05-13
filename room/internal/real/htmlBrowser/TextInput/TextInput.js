global.rooms['internal.real.htmlBrowser.TextInput'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  let { MemSrc, Tmp, Src } = U.logic;
  
  return U.form({ name: 'TextInput', has: { Layout, Src }, props: (forms, Form) => ({
    init: function({ multiline=false, prompt, size=null, align='mid', gap=null }) {
      forms.Src.init.call(this);
      Object.assign(this, { multiline, prompt, size, align, gap, real: null, val: '' });
    },
    newRoute: function(fn) { fn(this.val); },
    isInnerLayout: function() { return false; },
    install: function(real) {
      
      if (!this.real) {
        this.real = real;
        if (!real.params.has('text')) real.params.text = '';
        if (!U.isForm(real.params.text, String)) throw Error(`Real "text" param should be String; got ${U.getFormName(real.params.text)}`);
        this.lastText = real.params.text;
      }
      
      if (real !== this.real) throw Error(`${U.getFormName(this)} applied to multiple Reals (both ${this.real.name} and ${real.name})`);
      
      let tmp = Tmp();
      
      let input = document.createElement('input');
      input.style.gain({
        position: 'absolute', display: 'block', boxSizing: 'border-box',
        width: '100%', height: '100%', left: '0', top: '0',
        padding: 'inherit', border: 'none',
        backgroundColor: 'transparent',
        textAlign: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit'
      });
      input.value = real.params.text;
      
      if (this.prompt) input.setAttribute('placeholder', this.prompt);
      
      let domNode = real.domNode;
      if (![ 'absolute', 'relative' ].has(domNode.style.position)) {
        let origPos = domNode.style.position;
        domNode.style.position = 'relative';
        tmp.endWith(() => domNode.style.position = origPos);
      }
      
      domNode.appendChild(input);
      tmp.endWith(() => input.remove());
      
      let inputEventFn = evt => this.send(this.val = real.params.text = input.value);
      input.addEventListener('input', inputEventFn);
      tmp.endWith(() => input.removeEventListener('input', inputEventFn));
      
      return tmp;
      
    },
    render: function(real, domNode) {
      
      if (this.multiline) {
      } else {
      }
      
      if (!real.params.has('text')) real.params.text = '';
      if (real.params.text !== this.val) {
        let inputElem = domNode.querySelector('input');
        inputElem.value = this.val = real.params.text;
        this.send(this.val);
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
