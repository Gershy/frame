global.rooms['internal.real.htmlBrowser.Decal'] = async foundation => {
  
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  return U.form({ name: 'Decal', has: { Layout }, props: (forms, Form) => ({
    init: function(props /* colour, textColour, border, texture, !transition, !transform */) {
      this.props = props;
    },
    isInnerLayout: function() { return false; },
    render: function(real, domNode) {
      
      let complexDecals = {};
      
      for (let [ k, d ] of this.props) {
        
        if (k === 'colour') {
          domNode.style.backgroundColor = d;
        } else if (k === 'textColour') {
          domNode.style.color = d;
        } else if (k === 'border') {
          let { ext, colour } = d;
          domNode.style.boxShadow = `inset 0 0 0 ${ext} ${colour}`;
        } else if (k === 'texture') {
          domNode.style.cursor = ({ smooth: '', bumpy: 'pointer' })[d];
        } else {
          if (!U.isForm(d, Object)) throw Error(`Decal type for "${k}" should be Object; got ${U.getFormName(d)}`);
          if (!complexDecals.has(k)) complexDecals[k] = {};
          complexDecals[k].gain(d);
        }
        
      }
      
      for (let [ k, complexDecal ] of complexDecals) {
        
        if (k === 'transition') {
          
          domNode.style.transition = complexDecal.toArr(({ ms=1000, curve='linear', delayMs=0 }, prop) => {
            
            prop = {
              colour: 'background-color',
              textColour: 'color',
              border: 'box-shadow'
            }[prop];
            curve = {
              linear: 'linear',
              smooth: 'ease-in-out',
              accel: 'ease-in',
              decel: 'ease-out'
            }[curve];
            return `${prop} ${ms}ms ${curve} ${delayMs}ms`;
            
          }).join(', ');
          
        } else if (k === 'transform') {
          
          throw Error('Transform not implemented');
          
        } else {
          
          throw Error(`Invalid decal: ${k}`);
          
        }
        
      }
      
    }
  })});
  
};
