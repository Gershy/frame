U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    let { Wob, WobVal, Hog } = U;
    
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
    let Real = U.inspire({ name: 'Real', insps: { Hog }, methods: (insp, Insp) => ({
      init: function({ isRoot=false, flag=null }) {
        
        insp.Hog.init.call(this);
        
        this.dom = isRoot ? document.body : document.createElement('div');
        
        if (flag) this.dom.classList.add(flag);
        
        this.loc = [ 0, 0 ];
        this.rot = 0;
        this.scl = [ 1, 1 ];
        this.size = [ 0, 0 ];
        
        this.dom.style.gain({
          overflow: 'visible',
          fontSize: '14px',
          whiteSpace: 'nowrap',
          caretColor: 'rgba(0, 0, 0, 1)'
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
        
        // "Feeling" most often occurs via click
        this.feelWob0 = null;
        this.curFeel = null;
        
        // "Telling" most often occurs via text entry
        this.tellBox = null;
        this.tellWob0 = null;
        
        // "Looking" most often occurs via focus
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
      setBorderRadius: function(type, amt) {
        if (![ 'hard', 'soft' ].has(type)) throw new Error(`Type should be "hard" or "soft"; got "${type}"`);
        this.dom.style.borderRadius = type === 'hard'
          ? `${amt}px`
          : `${amt * 100}%`;
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
      
      feelWob: function() {
        if (!this.feelWob0) {
          
          this.feelWob0 = Wob();
          this.curFeel = null;
          
          this.dom.addEventListener('mousedown', evt => {
            evt.stopPropagation();
            evt.preventDefault();
            
            if (this.curFeel) this.curFeel.shut();
            this.curFeel = Hog();
            this.feelWob0.wobble(this.curFeel);
          });
          this.dom.addEventListener('mouseup', evt => {
            evt.stopPropagation();
            evt.preventDefault();
            
            if (this.curFeel) this.curFeel.shut();
            this.curFeel = null;
          });
          
          this.dom.style.gain({
            cursor: 'pointer'
          });
          
        }
        
        return this.feelWob0;
      },
      tellWob: function() {
        if (!this.tellWob0) {
          
          let dom = this.dom;
          dom.setAttribute('contentEditable', '');
          this.tellWob0 = Wob();
          
          let origCol = null;
          dom.addEventListener('focus', evt => {
            if (!this.nextTrg) return;
            origCol = this.nextTrg.dom.style.backgroundColor;
            this.nextTrg.dom.style.backgroundColor = 'rgba(255, 150, 0, 0.3)';
          });
          dom.addEventListener('blur', evt => {
            if (!this.nextTrg) return;
            this.nextTrg.dom.style.backgroundColor = origCol;
          });
          
          dom.addEventListener('keydown', evt => {
            // 9: TAB
            // console.log(evt.keyCode);
            if (evt.keyCode === 13) {
              evt.preventDefault();
              if (this.nextTrg) {
                this.nextTrg.dom.focus();
                if (this.nextTrg.feelWob0) {
                  let feel = Hog();
                  this.nextTrg.feelWob0.wobble(feel);
                  feel.shut();
                }
              }
            }
          });
          dom.addEventListener('input', evt => {
            let innerHtml = dom.innerHTML.replace(/&nbsp;/g, '\xA0');
            let textContent = dom.textContent;
            if (innerHtml !== textContent) dom.innerHTML = textContent;
            this.tellWob0.wobble(textContent);
          });
          
        }
        
        return this.tellWob0;
      },
      
      addReal: function(real) {
        this.dom.appendChild(real.dom);
        return real;
      },
      remReal: function(real) {
        real.rem(this.dom);
        return real;
      },
      shut0: function() {
        this.dom.parentNode.removeChild(this.dom);
        return this;
      }
    })});
    
    return { Colour, Reality, Real };
    
  }
});
