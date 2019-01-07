U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    let { Wobbly } = U;
    
    let Real = U.inspire({ name: 'Real', methods: (insp, Insp) => ({
      init: function({ isRoot=false, flag=null }) {
        this.dom = isRoot ? document.body : document.createElement('div');
        
        if (flag) this.addFlag(flag);
        
        this.loc = [ 0, 0 ];
        this.rot = 0;
        this.scl = [ 1, 1 ];
        this.transitions = {};
        this.removalDelayMs = 0;
        this.vals = {};
        
        this.dom.style.gain({
          position: 'absolute',
          left: '50%',
          top: '50%',
          overflow: 'visible'
        });
        
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 1)'
          });
          
        }
        
        this.applyTransform();
        
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
        
        this.addWob = U.BareWob({});
        this.remWob = U.BareWob({});
      },
      setRemovalDelayMs: function(ms) {
        this.removalDelayMs = ms;
      },
      setPriority: function(amt) {
        this.dom.style.zIndex = amt === null ? '' : `${amt}`;
      },
      setTangible: function(isTng) {
        this.dom.style.pointerEvents = isTng ? '' : 'none';
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
      setTransition: function(prop, ms, delay=0, ease='smooth') {
        let props = ({
          loc: [ 'transform' ],
          size: [ 'width', 'height' ],
          colour: [ 'backgroundColour' ],
          opacity: [ 'opacity' ]
        })[prop];
        
        if (ms === null) { props.forEach(prop => { delete this.transitions[prop]; }); return; }
        
        props.forEach(prop => {
          this.transitions[prop] = { time: `${ms}ms`, delay: `${delay}ms`, ease: ({ smooth: 'ease-in-out', sharp: 'linear' })[ease] };
        });
        
        this.applyTransition();
      },
      applyTransition: function() {
        if (this.transitions.isEmpty()) { this.dom.style.transition = ''; return; }
        let trnStr = this.transitions.toArr(({ time, delay, ease }, type) => `${type} ${time} ${ease} ${delay}`).join(', ');
        this.dom.style.transition = trnStr;
      },
      addReal: function(real) {
        this.dom.appendChild(real.dom);
        setTimeout(() => real.addWob.wobble(), 0);
        return real;
      },
      remReal: function(real) {
        real.rem(this.dom);
        return real;
      },
      rem: function(domPar=this.dom.parentNode) {
        let remove = () => domPar.removeChild(this.dom);
        if (this.removalDelayMs === 0)  remove();
        else                            this.setTangible(false) && setTimeout(remove, this.removalDelayMs);
        this.remWob.wobble();
        return this;
      },
      setVal: function(k, v) { this.vals[k] = v; },
      getVal: function(k) { return this.vals.has(k) ? this.vals[k] : null; },
      addFlag: function(flag) { this.dom.classList.add(flag); },
      remFlag: function(flag) { this.dom.classList.remove(flag); },
      hasFlag: function(flag) { return this.dom.classList.contains(flag); }
    })});
    
    return {
      Real
    };
    
  }
});
