U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation, record) => {
    
    let { Wobbly } = U;
    
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
        this.dom = isRoot ? document.body.appendChild(document.createElement('div')) : document.createElement('div');
        
        if (flag) this.addFlag(flag);
        
        this.loc = [ 0, 0 ];
        this.rot = 0;
        this.scl = [ 1, 1 ];
        this.size = [ 0, 0 ];
        this.transitions = {};
        this.transitionsBkp = null;
        this.removalDelayMs = 0;
        this.vals = {};
        
        this.dom.style.gain({
          position: 'absolute',
          left: '50%',
          top: '50%',
          overflow: 'visible',
          fontSize: '14px',
          whiteSpace: 'nowrap'
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
          this.size = [ 100, 100 ];
          
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
        frameCb(this.transitions.has('size') ? 2 : 0, () => {
          this.dom.style.gain({
            width: `${Math.round(x)}px`,
            height: `${Math.round(y)}px`,
            lineHeight: `${y}px`,
            marginLeft: `${-Math.round(x * 0.5)}px`,
            marginTop: `${-Math.round(y * 0.5)}px`
          });
        });
        
        this.size = [ x, y ];
      },
      setLoc: function(x, y) {
        this.loc = [ x, y ];
        this.applyTransform();
      },
      setAgainst: function(real, type='c', wOff=0, hOff=0) {
        if (this.dom.parentNode !== real.dom && this.dom.parentNode !== real.dom.parentNode)
          throw new Error('Can\'t set against non-parent, non-sibling');
        
        if (real.dom.parentNode === this.dom.parentNode)
          [ wOff, hOff ] = [ wOff + real.loc[0], hOff + real.loc[1] ];
        
        let [ w0, h0 ] = this.size;
        let [ w1, h1 ] = real.size;
        
        let wd = (w0 + w1) * 0.5 + wOff;
        let hd = (h0 + h1) * 0.5 + hOff;
        
        let [ x, y ] = Real.type2Loc[type];
        this.setLoc(x * wd, y * hd);
      },
      setFeel: function(feel) {
        this.dom.style.cursor = feel ? ({ interactive: 'pointer', normal: '', text: 'text' })[feel] : '';
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
        frameCb(this.transitions.has('colour') ? 2 : 0, () => {
          this.dom.style.backgroundColor = col;
        });
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
      setTransition: function(prop, ms, ease='smooth') {
        if (ms === null) { delete this.transitions[prop]; return; }
        this.transitions[prop] = { ms, ease };
        this.applyTransition();
      },
      applyTransition: function() {
        if (this.transitions.isEmpty()) { this.dom.style.transition = ''; return; }
        
        let prop2Css = ({
          loc: [ 'transform' ],
          size: [ 'width', 'height', 'margin-left', 'margin-top' ],
          colour: [ 'background-color' ],
          opacity: [ 'opacity' ]
        });
        let ease2Css = ({
          smooth: 'ease-in-out',
          sharp: 'linear'
        });
        
        let trnStrs = [];
        this.transitions.forEach(({ ms, ease }, prop) => {
          prop2Css[prop].forEach(cssProp => trnStrs.push(`${cssProp} ${ms}ms ${ease2Css[ease]}`));
        });
        
        this.dom.style.transition = trnStrs.join(', ');
      },
      skipTransition: function() {
        // Remove/reinsert our dom element. Need to insert at our current index
        // to avoid changing node order
        let nextElem = this.dom.nextSibling;
        let par = this.dom.parentNode;
        par.removeChild(this.dom);
        par.insertBefore(this.dom, nextElem);
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
    
    return { Colour, Reality, Real };
    
  }
});
