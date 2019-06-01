U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    let { WobVal } = U;
    
    let frameCb = (frames, f) => {
      let ff = cnt => {
        if (cnt <= 0) return f();
        return requestAnimationFrame(() => ff(cnt - 1));
      };
      ff(frames);
    };
    
    let Colour = U.inspire({ name: 'Colour', methods: (insp, Insp) => ({
      init: function(r, g, b, a=1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
      },
      fadeTo: function({ r, g, b, a=1 }, amt1) {
        let amt0 = 1 - amt1;
        return new Colour(
          (this.r * amt0 + r * amt1),
          (this.g * amt0 + g * amt1),
          (this.b * amt0 + b * amt1),
          (this.a * amt0 + a * amt1)
        );
      },
      toCss: function() {
        return `rgba(${Math.round(this.r * 255)}, ${Math.round(this.g * 255)}, ${Math.round(this.b * 255)}, ${this.a}`;
      }
    })});
    
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      init: function({}) {
      }
    })});
    
    // TODO: Should inherit from Hog
    let Real = U.inspire({ name: 'Real', methods: (insp, Insp) => ({
      $type2Loc: {
        c:  [  0,  0 ],
        tl: [ -1, -1 ],
        t:  [  0, -1 ],
        tr: [ +1, -1 ],
        r:  [ +1,  0 ],
        br: [ +1, +1 ],
        b:  [  0, +1 ],
        bl: [ -1, +1 ],
        l:  [ -1,  0 ]
      },
      init: function({ isRoot=false, flag=null }) {
        this.dom = isRoot ? document.body : document.createElement('div');
        
        if (flag) this.dom.classList.add(flag);
        
        this.loc = [ 0, 0 ];
        this.rot = 0;
        this.scl = [ 1, 1 ];
        this.size = [ 0, 0 ];
        
        this.dom.style.gain({
          overflow: 'visible',
          fontSize: '14px',
          whiteSpace: 'nowrap'
        });
        
        if (isRoot) {
          
          this.dom.style.gain({
            overflow: 'hidden'
          });
          
        } else {
          
          this.dom.style.gain({
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '100px',
            height: '100px',
            lineHeight: '100px',
            marginLeft: '-50px',
            marginTop: '-50px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 1)'
          });
          this.size = [ 100, 100 ];
          
        }
        
        this.applyTransform();
        
        this.interactWob = U.WobVal(false);
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
      setPriority: function(amt) {
        this.dom.style.zIndex = amt === null ? '' : `${amt}`;
      },
      setWindowlike: function(isWnd) {
        this.dom.style.overflow = isWnd ? 'hidden' : 'visible';
      },
      setText: function(text) {
        this.dom.innerHTML = text;
      },
      setTextSize: function(amt) {
        this.dom.style.fontSize = `${amt}px`;
      },
      setTextColour: function(col) {
        this.dom.style.color = col;
      },
      setSize: function(x, y=x) {
        this.dom.style.gain({
          width: `${Math.round(x)}px`,
          height: `${Math.round(y)}px`,
          lineHeight: `${y}px`,
          marginLeft: `${-Math.round(x * 0.5)}px`,
          marginTop: `${-Math.round(y * 0.5)}px`
        });
        this.size = [ x, y ];
      },
      setLoc: function(x, y) {
        this.loc = [ x, y ];
        this.applyTransform();
      },
      setFeel: function(feel) {
        let [ pointerEvents, cursor ] = ({
          airy:   [ 'none', '' ],
          smooth: [ 'all', '' ],
          bumpy:  [ 'all', 'pointer' ]
        })[feel];
        
        this.dom.style.gain({
          pointerEvents,
          cursor
        });
      },
      setRot: function(rot) {
        this.rot = rot;
        this.applyTransform();
      },
      setScale: function(x, y=x) {
        this.scl = [ x, y ];
        this.applyTransform();
      },
      applyTransform: function() {
        this.dom.style.transform = [
          `translate(${this.loc[0]}px, ${this.loc[1]}px)`,
          `rotate(${this.rot}deg)`,
          `scale(${this.scl[0]}, ${this.scl[1]})`
        ].join(' ');
      },
      setColoursInverted: function(isInv) {
        this.dom.style.filter = isInv ? 'invert(100%)' : '';
      },
      setColour: function(col) {
        this.dom.style.backgroundColor = col;
      },
      setBorderRadius: function(amt) {
        this.dom.style.borderRadius = `${amt * 100}%`;
      },
      setBorder: function(type, w, col) {
        this.dom.style.boxShadow = type !== null
          ? (type === 'inner' ? `inset 0 0 0 ${w}px ${col}` : `0 0 0 ${w}px ${col}`)
          : '';
      },
      setImage: function(file) {
        if (!file) {
          delete this.dom.style.backgroundImage;
          delete this.dom.style.backgroundSize;
        } else {
          this.dom.style.gain({
            backgroundImage: `url('${file.url}')`,
            backgroundSize: 'contain'
          });
        }
      },
      setOpacity: function(amt) {
        this.dom.style.opacity = `${amt}`;
      },
      addReal: function(real) {
        this.dom.appendChild(real.dom);
        return real;
      },
      remReal: function(real) {
        real.rem(this.dom);
        return real;
      },
      shut: function() {
        this.dom.parentNode.removeChild(this.dom);
        return this;
      }
    })});
    
    return { Colour, Reality, Real };
    
  }
});
