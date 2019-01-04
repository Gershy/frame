U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    let Real = U.inspire({ name: 'Real', methods: (insp, Insp) => ({
      init: function({ isRoot=false, flag=null }) {
        this.dom = isRoot ? document.body : document.createElement('div');
        
        if (flag) this.addFlag(flag);
        
        this.transforms = [];
        this.loc = [ 0, 0 ];
        
        this.dom.style.gain({
          position: 'absolute',
          left: '50%',
          top: '50%',
          overflow: 'visible'
        })
        
        if (isRoot) {
          
          this.dom.style.gain({
            width: '0px',
            height: '0px',
            overflow: 'visible'
          });
          
        } else {
          
          this.dom.style.gain({
            width: '100px',
            height: '100px',
            lineHeight: '100px',
            marginLeft: '-50px',
            marginTop: '-50px',
            transform: 'translate(0, 0)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 1)'
          });
          
        }
        
        this.interactWob = U.Wobbly({ value: false });
        this.dom.addEventListener('mousedown', evt => {
          this.interactWob.wobble(true);
          evt.stopPropagation();
          evt.preventDefault();
        });
        this.dom.addEventListener('mouseup', evt => {
          this.interactWob.wobble(false);
          evt.stopPropagation();
          evt.preventDefault();
        });
        
      },
      setText: function(text) {
        this.dom.innerHTML = text;
      },
      setTextColour: function(col) {
        this.dom.style.gain({
          color: col
        });
      },
      setSize: function(x, y) {
        this.dom.style.gain({
          width: `${x}px`,
          height: `${y}px`,
          lineHeight: `${y}px`,
          marginLeft: `${-Math.round(x * 0.5)}px`,
          marginTop: `${-Math.round(y * 0.5)}px`
        });
      },
      setLoc: function(x, y) {
        this.loc = [ x, y ];
        this.applyTransform();
      },
      setColour: function(col) {
        this.dom.style.gain({
          backgroundColor: col
        });
      },
      setBorderRadius: function(amt) {
        this.dom.style.gain({
          borderRadius: `${amt * 100}%`
        });
      },
      setBorder: function(type, w, col) {
        if (type === null) { this.dom.style.boxShadow = ''; return; }
        type = ({
          inner: 'inset ',
          outer: ''
        })[type];
        this.dom.style.gain({
          boxShadow: `${type}0 0 0 ${w}px ${col}`
        });
      },
      addTranslate: function(x, y) { this.transforms.push({ type: 'translate', x, y }); this.applyTransform(); },
      addRotate: function(rad) { this.transforms.push({ type: 'rotate', rad }); this.applyTransform(); },
      addScale: function(x, y=x) { this.transforms.push({ type: 'scale', x, y }); this.applyTransform(); },
      resetTransform: function() { this.transforms = []; this.applyTransform(); },
      applyTransform: function() {
        let ops = this.transforms.map(({ type, ...v }) => ({
          translate: () => `translate(${v.x}px, ${v.y}px)`,
          rotate: () => `rotate(${v.rad}rad)`,
          scale: () => `scale(${v.x}, ${v.y})`
        })[type]());
        
        let transform = `translate(${this.loc[0]}px, ${this.loc[1]}px)`;
        if (ops.length) transform = `${transform} ${ops.join(' ')}`; 
        
        this.dom.style.gain({ transform });
      },
      addReal: function(real) {
        this.dom.appendChild(real.dom);
        return real;
      },
      remReal: function(real) {
        this.dom.removeChild(real.dom);
      },
      rem: function() {
        this.dom.parentNode.removeChild(this.dom);
      },
      addFlag: function(flag) {
        this.dom.classList.add(flag);
      },
      remFlag: function(flag) {
        this.dom.classList.remove(flag);
      }
    })});
    
    return {
      Real
    };
    
  }
});
