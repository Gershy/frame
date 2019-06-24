// TODO: real-css file which defines a similar class, inspired by and under
// the same name as all the classes here, except everything is nicely separated
// for Above/Below??

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
      getCss: function() {
        return `rgba(${Math.round(this.r * 255)}, ${Math.round(this.g * 255)}, ${Math.round(this.b * 255)}, ${this.a}`;
      }
    })});
    
    let camelToKebab = camel => camel.replace(/([A-Z])/g, (m, chr) => `-${chr.lower()}`);
    let css = (main, more) => ({ main, ...more });
    
    let vals = (() => {
      let RealVal = U.inspire({ name: 'RealVal', insps: {}, methods: (insp, Insp) => ({
        init: function() {},
        cmpValues: C.notImplemented,
        getCss: C.notImplemented
      })});
      let Unit = U.inspire({ name: 'Unit', insps: { RealVal }, methods: (insp, Insp) => ({
        init: function(amt) {
          if (!U.typeOf(amt, Number) || isNaN(amt)) throw new Error(`Invalid amt: ${amt}`);
          insp.RealVal.init.call(this);
          this.amt = amt;
        },
        cmpValues: function() { return []; },
        isAbsolute: function() { return false; },
        suff: C.notImplemented,
        add: function(n) { let Cls = this.constructor; return Cls(this.amt + n); },
        mult: function(n) { let Cls = this.constructor; return Cls(this.amt * n); },
        round: function() { let Cls = this.constructor; return Cls(Math.round(this.amt)); },
        getCss: function() { return `${this.amt}${this.suff()}`; }
      })});
      return {
        RealVal,
        UnitPx: U.inspire({ name: 'UnitPx', insps: { Unit }, methods: (insp, Insp) => ({
          isAbsolute: function() { return true; },
          suff: function() { return 'px'; }
        })}),
        UnitPc: U.inspire({ name: 'UnitPx', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        UnitParW: U.inspire({ name: 'UnitParW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        UnitParH: U.inspire({ name: 'UnitParW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        ViewportW: U.inspire({ name: 'ViewportW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vw'; }
        })}),
        ViewportH: U.inspire({ name: 'ViewportH', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vh'; }
        })}),
        ViewportMin: U.inspire({ name: 'ViewportMin', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vmin'; }
        })}),
        ViewportMax: U.inspire({ name: 'ViewportMax', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vmax'; }
        })})
      };
    })();
    
    let Ctx = U.inspire({ name: 'Ctx', methods: (insp, Insp) => ({
      init: function(func) {
        this.func = func;
      },
      cmpCondition: C.notImplemented,
      cmpParams: C.notImplemented,
      runParams: function(...args) { return C.notImplemented.call(this); }
    })});
    let CtxAlways = U.inspire({ name: 'CtxAlways', insps: { Ctx }, methods: (insp, Insp) => ({
      cmpCondition: function() { return 'always'; },
      cmpParams: function() { return []; },
      runParams: function(real) { return []; },
    })});
    let CtxViewport = U.inspire({ name: 'CtxViewport', insps: { Ctx }, methods: (insp, Insp) => ({
      cmpCondition: function() { return 'always'; },
      cmpParams: function(p='UnitViewport') { return vals.slice(`${p}W`, `${p}H`, `${p}Min`, `${p}Max`).toArr(v => v(100)); }, //   return [ vals.RealViewportExtW(), vals.RealViewportExtH(), vals.RealViewport ]; },
      runParams: function(real) { return []; },
    })});
    let CtxState = U.inspire({ name: 'CtxState', insps: { Ctx }, methods: (insp, Insp) => ({
      init: function(state, func) {
        insp.Ctx.init.call(this, func);
        this.state = state;
      },
      cmpCondition: function() { return this.state; },
      cmpParams: function() { return []; },
      runParams: function(real) { return []; }
    })});
    let CtxPar = U.inspire({ name: 'CtxPar', insps: { Ctx }, methods: (insp, Insp) => ({
      cmpCondition: function() { return 'always'; },
      cmpParams: function() { return [ vals.UnitParW(100), vals.UnitParH(100) ]; }
    })});
    
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      init: function(name, ctxsByNameFlat) {
        this.name = name;
        
        this.rootCtxsNode = { ctxsFunc: () => [], children: {} };
        
        ctxsByNameFlat.forEach((ctxsFunc, chainName) => {
          
          // Looking at the dom elem with chain name `chainName`, we have the list of all
          // its controlling Contexts under `ctxsFunc`
          
          let names = chainName.split('.');
          let ptr = this.rootCtxsNode;
          for (let name of names) {
            if (!ptr.children.has(name)) { ptr.children[name] = { ctxsFunc: () => [], children: {} }; }
            ptr = ptr.children[name];
          }
          ptr.ctxsFunc = ctxsFunc;
          
        });
        
      },
      /// {ABOVE=
      getCssControls: function() {
        
        let genericCtx = {
          viewport: { w: vals.ViewportW(100), h: vals.ViewportH(100), min: vals.ViewportMin(100), max: vals.ViewportMax(100) }
        };
        
        let cmpRules = [];
        let runRules = [];
        
        // Iterate over ctxsNodes and determine Ctxs in terms of Conditions
        // Return results in flat format
        let processNode = (parCtx, chain, ctxsNode) => {
          
          // TODO: Could recursively propagate new contexts - it'd be more elegant?
          let fullCtx = ({}).gain(genericCtx).gain(parCtx);
          let { layout, slots=null, decals=null } = ctxsNode.ctxsFunc(fullCtx);
          
          let decalsToCss = decals => {
            if (!decals) return {};
            
            let mapping = {
              colour: 'backgroundColor',
              textSize: 'fontSize',
              textOrigin: 'textAlign',
              textColour: 'color',
              size: v => {
                let ret = {};
                if (v[0] !== null) ret.width = v[0];
                if (v[1] !== null) ret.height = v[1];
                return ret;
              },
              text: v => { return { /* tricky! */ }; },
              textLining: lining => {
                if (!lining.has('type')) throw new Error('Invalid lining');
                if (lining.type === 'single') {
                  let ret = {
                    whiteSpace: 'nowrap',
                    'resolveLast.applyFullLineHeight': 1
                  };
                  if (lining.has('pad')) ret.gain({ boxSizing: 'border-box', paddingLeft: lining.pad, paddingRight: lining.pad });
                  return ret;
                }
                throw new Error(`Invalid lining type: "${v.type}"`);
              },
              border: ({ type='in', w, colour }) => {
                return { boxShadow: `${type === 'in' ? 'inset ' : ''}0 0 0 ${w.getCss()} ${colour}` }
              }
            };
            
            let directCss = {};
            if (decals.has('_css')) { directCss = decals._css; delete decals._css; }
            
            let zoneDecals = { main: decals };
            if (decals.has('focus')) { zoneDecals.focus = decals.focus; delete decals.focus; }
            if (decals.has('hover')) { zoneDecals.hover = decals.hover; delete decals.hover; }
            
            // Zones are the same between css and Decals... for now
            let zoneCss = zoneDecals.map((decals, zone) => {
              
              let css = {};
              decals.forEach((decVal, decKey) => {
                
                if (!mapping.has(decKey)) throw new Error(`Invalid decal name: "${decKey}"`);
                let m = mapping[decKey];
                
                if (U.isType(m, Function)) m = m(decVal); // Resolve function if necessary
                
                if (U.isType(m, String)) m = { [m]: decVal }; // Strings imply 1-1 prop mapping
                
                m.forEach((cssVal, cssKey) => {
                  if (css.has(cssKey)) throw new Error(`Calculated conflicting css "${cssKey}" properties (from "${decVal}" Decal)`);
                  css[cssKey] = cssVal;
                });
                
              });
              return css;
              
            });
            
            mergeZoneCss(zoneCss, directCss);
            
            return zoneCss;
          };
          let mergeZoneCss = (cur, add) => {
            
            // Zone is "main", "before", "after", "focus", "hover", etc.
            add.forEach((css, zone) => {
              
              if (!cur.has(zone)) cur[zone] = {};
              
              css.forEach((cssVal, cssKey) => {
                if (cur[zone].has(cssKey)) throw new Error(`Elem ${chain.join('.')} zone "${zone}" has conflicting "${cssKey}" css props`);
                cur[zone][cssKey] = U.isType(cssVal, Number) ? vals.UnitPx(cssVal) : cssVal;
              });
              
            });
            
          };
          
          // Transfer knowledge of size from Layout to Slots
          // NOTE: Slots will ALWAYS have a "layoutSize" property before having `getCss` called!
          if (slots) slots.layoutSize = (layout && layout.size) || [ null, null ];
          
          let zoneCss = {};
          mergeZoneCss(zoneCss, layout ? layout.getCss() : {});
          mergeZoneCss(zoneCss, slots ? slots.getCss() : {}); // Apply css to SlotProvider
          mergeZoneCss(zoneCss, decalsToCss(decals));
          
          zoneCss.forEach((css, zone) => {
            
            // Clean up compound properties
            css.forEach((v, k) => {
              
              if (!k.has('.')) return;
              
              delete css[k];
              k = k.split('.');
              
              let ptr = css;
              while (k.length > 1) {
                let n = k.shift();
                if (!ptr.has(n)) ptr[n] = {};
                ptr = ptr[n];
              }
              
              ptr[k[0]] = v;
              
            });
            
            // Apply text
            if (css.has('text')) true; // TODO: Should apply javascript! For dom elems should set innerHTML; for "before"/"after" should set css "content" property!
            
            // Reset any inappropriately inherited values
            if (!css.has('textAlign')) css.textAlign = 'left';
            if (!css.has('fontSize')) css.fontSize = '13px';
            
            // Interpret "transform" prop
            if (css.has('transform')) css.transform = css.transform.toArr((v, k) => `${k}(${v.map(w => w.getCss()).join(', ')})`).join(' ');
            
            // Interpret other compound props (e.g. padding, margin? (padding-left, padding-right...), gradient, ...)
            
            // Interpret "resolveLast" props
            if (css.has('resolveLast')) {
              
              // TODO: This only works if `css.height` is specified in absolute units!
              if (css.resolveLast.has('applyFullLineHeight')) css.lineHeight = css.height;
              
              delete css.resolveLast;
              
            }
            
          });
          
          cmpRules.push({ chain, zoneCss });
          
          ctxsNode.children.forEach((node, name) => processNode({ slots }, chain.concat([ name ]), node));
          
        };
        processNode({}, [], this.rootCtxsNode);
        
        return {
          cmp: cmpRules.map(({ chain, zoneCss }) => {
            
            if (zoneCss.isEmpty()) return C.skip;
            
            return zoneCss.toArr((css, zone) => {
              
              let selector = [ `#${this.name}` ].concat(chain.map(v => `.${v}`)).join(' > ');
              if (zone === 'main') { // Main css - do nothing!
              } else if ([ 'focus', 'hover' ].has(zone)) {  // Pseudo-selector
                selector = `${selector}:${zone}`;
              } else if ([ 'before', 'after' ].has(zone)) { // Pseudo-element
                selector = `${selector}::${zone}`;
              } else {
                throw new Error(`Invalid css zone: ${zone}`);
              }
              
              return [
                `${selector} {`,
                ...css.toArr((v, k) => `  ${camelToKebab(k)}: ${U.isInspiredBy(v, vals.RealVal) ? v.getCss() : v};`),
                '}'
              ].join('\n'); // Join together all lines of a CssBlock
              
            }).join('\n');  // Join together all Zones of a ZonedCssBlock
            
          }).join('\n'),  // Join together all ZonedCssBlocks of a CssStyleSheet
          run: runRules
        };
        
      },
      /// =ABOVE}
      contain: function(foundation, real) {
        
        if (real) {
          if (real.reality) throw new Error('The Real is already contained');
          real.reality = this;
        }
        
        /// {ABOVE=
        
        let cssControls = this.getCssControls();
        foundation.addMountDataAsFile(`${this.name}.css`, 'text/css', cssControls.cmp);
        return Hog(() => foundation.remMountFile(`${this.name}.css`));
        
        /// =ABOVE} {BELOW=
        
        // TODO: This should be inline in the initial html response
        let styleElem = document.createElement('link');
        styleElem.setAttribute('rel', 'stylesheet');
        styleElem.setAttribute('type', 'text/css');
        styleElem.setAttribute('media', 'screen');
        styleElem.setAttribute('href', `/!FILE/${this.name}.css`);
        document.head.appendChild(styleElem);
        
        real.dom.id = `${this.name}`;
        return Hog(() => { real.dom.id = ''; });
        
        /// =BELOW}
        
      },
      create: function(nameChain, ...altNames) {
        return Real({ nameChain, altNames, reality: this });
      }
    })});
    let Real = U.inspire({ name: 'Real', insps: { Hog }, methods: (insp, Insp) => ({
      $defSetup: function(real) {
        return { dom: document.createElement('div') };
      },
      
      init: function({ reality=null, nameChain=null, altNames=[], setup=Real.defSetup }={}) {
        
        insp.Hog.init.call(this);
        
        // Our link to a Reality instance
        this.reality = reality;
        
        // The list of names to specify our role
        if (nameChain === null) nameChain = [];
        else if (U.isType(nameChain, String)) nameChain = [ nameChain ];
        if (nameChain.find(v => v.has('.'))) throw new Error(`Invalid Real name: [${nameChain.join(',')}]`);
        this.nameChain = nameChain;
        
        // Alternative names for additional roles
        this.altNames = new Set(altNames);
        
        // Get dom element
        let { dom } = setup();
        this.dom = dom;
        
        // Add main name and alt names to dom
        if (nameChain.length) this.dom.classList.add(nameChain[nameChain.length - 1]);
        this.altNames.forEach(n => console.log('ALT:', n) || dom.classList.add(n));
        
        // "Feeling" most often occurs via click
        this.feelWob0 = null;
        this.curFeel = null;
        
        // "Telling" most often occurs via text entry
        this.tellBox = null;
        this.tellWob0 = null;
        
        // "Looking" most often occurs via focus
        this.lookWob0 = null; // TODO: Does WobTmp work here? And can it simplify "curFeel"?
        
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
        let trn = [];
        if (this.loc[0] || this.loc[1]) trn.push(`translate(${this.loc[0]}px, ${this.loc[1]}px)`);
        if (this.rot) trn.push(`rotate(${this.rot}deg)`);
        if (this.scl[0] !== 1 || this.scl[1] !== 1) trn.push(`scale(${this.scl[0]}, ${this.scl[1]})`);
        this.dom.style.transform = trn.join(' ');
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
      
      form: function(submitTerm, dep, act, items) {
        
        let vals = items.map(v => null);
        let fields = [];
        items.forEach(({ type, desc }, k) => {
          
          // TODO: Stop ignoring `type`
          
          let item = this.addReal('item');
          let title = item.addReal('title');
          let field = item.addReal('field');
          fields.push(field);
          
          title.setText(desc);
          
          if (type === 'str') {
            dep(field.tellWob().hold(v => { vals[k] = v; }));
          } else if (type === 'int') {
            dep(field.tellWob().hold(v => { vals[k] = parseInt(v, 10) || null; }));
          }
          
        });
        
        let submit = this.addReal('submit');
        submit.setText(submitTerm);
        dep(submit.feelWob().hold(() => act(vals)));
        
        return {
          clear: () => {
            vals = items.map(v => null);
            fields.forEach(f => { f.dom.innerHTML = ''; });
            return true;
          }
        };
        
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
            if (evt.keyCode !== 13) return;
            evt.preventDefault();
            
            if (!this.nextTrg) return;
            this.nextTrg.dom.focus();
            if (this.nextTrg.feelWob0) {
              let feel = Hog();
              this.nextTrg.feelWob0.wobble(feel);
              feel.shut();
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
        if (U.isType(real, String)) {
          if (!this.reality) throw new Error('Can\'t create Real from String without Reality set');
          real = this.reality.create(this.nameChain.concat([ real ]));
        }
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
    
    let layout = (() => {
      
      return {
        Free: U.inspire({ name: 'Free', methods: (insp, Insp) => ({
          init: function({ x=vals.UnitPx(0), y=vals.UnitPx(0), w=null, h=null }) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
          },
          getCss: function() {
            
            let main = {
              display: 'block',
              position: 'absolute',
              left: vals.UnitPc(50), top: vals.UnitPc(50),
              'transform.translate': [ this.x, this.y ]
            };
            
            if (this.w) main.gain({ width: this.w, marginLeft: this.w.mult(-0.5) });
            if (this.h) main.gain({ height: this.h, marginTop: this.h.mult(-0.5) });
            
            return { main };
            
          }
        })}),
        Fill: U.inspire({ name: 'Fill', methods: (insp, Insp) => ({
          init: function({ pad=null }) {
            this.pad = pad;
          },
          getCss: function() {
            let main = { position: 'absolute' };
            main.gain(this.pad
              ? { left: this.pad, right: this.pad, top: this.pad, bottom: this.pad }
              : { left: '0', top: '0', width: '100%', height: '100%' }
            );
            return { main };
          }
        })})
      };
      
    })();
    
    // Dedicated to Slots: boxSizing, padding*
    // Dedicated to Layouts: width, height, left, right, top, bottom
    
    let slots = (() => {
      
      let Slots = U.inspire({ name: 'Slots', methods: (insp, Insp) => ({
        init: function({}) {
        }
      })});
      
      let Titled = U.inspire({ name: 'Titled', methods: (insp, Insp) => ({
        init: function({ side='t', titleExt }) {
          // TODO: Awkward that size needs to be declared here. It's like after
          // we've finished resolving the css for a particular element, we can
          // take an additional Step of applying the resolved width/height,
          // regardless of where it came from, to our slotted children...
          this.side = side;
          this.titleExt = titleExt;
        },
        getCss: function() {
          
          let paddingCssProp = ({ l: 'paddingLeft', r: 'paddingRight', t: 'paddingTop', b: 'paddingBottom' })[this.side];
          let main = { boxSizing: 'border-box', [paddingCssProp]: this.titleExt.getCss() };
          return { main };
          
        },
        insertTitle: function() { return TitledTitle(this); },
        insertContent: function() { return TitledContent(this); }
      })});
      let TitledTitle = U.inspire({ name: 'TitledTitle', methods: (insp, Insp) => ({
        init: function(par) { this.par = par; },
        getCss: function() {
          let cssProps = ({
            l: { left: '0',  top: '0',    width: this.par.titleExt, height: vals.UnitPc(100) },
            r: { right: '0', top: '0',    width: this.par.titleExt, height: vals.UnitPc(100) },
            t: { left: '0', top: '0',     width: vals.UnitPc(100), height: this.par.titleExt, lineHeight: this.par.titleExt },
            b: { left: '0', bottom: '0',  width: vals.UnitPc(100), height: this.par.titleExt, lineHeight: this.par.titleExt }
          })[this.par.side];
          
          return { main: {
            display: 'block', position: 'absolute',
            ...cssProps
          }};
        }
      })});
      let TitledContent = U.inspire({ name: 'TitledContent', methods: (insp, Insp) => ({
        init: function(par) { this.par = par; },
        getCss: function() {
          
          let cssH = null;
          let cssV = null;
          
          let [ sizeH, sizeV ] = this.par.layoutSize;
          
          if ([ 'l', 'r' ].has(this.par.side)) { // Horizontal title
            
            // Both horizontal size and horizontal title size need to be of the same class
            // so they can be safely subtracted.
            if (sizeH && sizeH.isAbsolute() && U.isType(sizeH, this.par.titleExt.constructor)) cssH = sizeH.add(-this.par.titleExt.amt);
            if (sizeV && sizeV.isAbsolute()) cssV = sizeV;
            
          } else { // Vertical title
            
            // Both vertical size and vertical title size need to be of the same class
            // so they can be safely subtracted.
            if (sizeH && sizeH.isAbsolute()) cssH = sizeH;
            if (sizeV && sizeV.isAbsolute() && U.isType(sizeV, this.par.titleExt.constructor)) cssV = sizeV.add(-this.par.titleExt.amt);
            
          }
          
          return { main: {
            display: 'block', position: 'relative',
            left: '0', top: '0',
            width: cssH || vals.UnitPc(100),
            height: cssV || vals.UnitPc(100)
          }};
        }
      })});
      
      let Justified = U.inspire({ name: 'Justified', methods: (insp, Insp) => ({
        init: function() {},
        getCss: function() {
          return {
            main: {
              textAlign: 'center'
            },
            after: {
              content: '""',
              display: 'inline-block',
              width: '0', height: '100%',
              verticalAlign: 'middle'
            }
          };
        },
        insertJustifiedItem: function(args={}) { return JustifiedItem(this, args); }
      })});
      let JustifiedItem = U.inspire({ name: 'JustifiedItem', methods: (insp, Insp) => ({
        init: function(par, { size=[ null, null ] }) {
          this.par = par;
          this.size = size;
        },
        getCss: function() {
          let main = { display: 'inline-block', verticalAlign: 'middle' };
          if (this.size[0] !== null) main.width = this.size[0];
          if (this.size[1] !== null) main.height = this.size[1];
          return { main };
        }
      })});
      
      let FillV = U.inspire({ name: 'FillV', methods: (insp, Insp) => ({
        init: function({ pad=null }) {
          this.pad = pad;
        },
        getCss: function() {
          let main = { overflowX: 'hidden', overflowY: 'auto' };
          if (this.pad) main.gain({ boxSizing: 'border-box', padding: this.pad });
          return { main };
        },
        insertVItem: function(args={}) { return FillVItem(this, args); }
      })});
      let FillVItem = U.inspire({ name: 'FillVItem', methods: (insp, Insp) => ({
        init: function(par, { size=[ null, null ] }) {
          this.par = par;
          this.size = size;
        },
        getCss: function() {
          let main = { position: 'relative' };
          if (this.size[0] !== null) main.width = this.size[0];
          if (this.size[1] !== null) main.height = this.size[1];
          return { main };
        }
      })});
      
      let FillH = U.inspire({ name: 'FillH', methods: (insp, Insp) => ({
        init: function({ pad=null }) {
          this.pad = pad;
        },
        getCss: function() {
          let main = {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            overflowX: 'auto',
            overflowY: 'hidden'
          };
          
          if (this.pad) main.gain({ boxSizing: 'border-box', padding: this.pad });
          
          return { main };
        },
        insertHItem: function(args={}) { return FillHItem(this, args); }
      })});
      let FillHItem = U.inspire({ name: 'FillHItem', methods: (insp, Insp) => ({
        init: function(par, { size=[ null, null ] }) {
          this.par = par;
          this.size = size;
        },
        getCss: function() {
          let main = { position: 'relative', display: 'inline-block', verticalAlign: 'middle' };
          if (this.size[0] !== null) main.width = this.size[0];
          if (this.size[1] !== null) main.height = this.size[1];
          return { main };
        }
      })});
      
      return { Titled, Justified, FillV, FillH };
      
    })();
    
    return {
      layout, slots,
      UnitPx: vals.UnitPx, UnitPc: vals.UnitPc,
      CtxAlways, CtxViewport, CtxState, CtxPar,
      Colour, Reality, Real
    };
    
  }
});
