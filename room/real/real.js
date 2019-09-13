// TODO: real-css file which defines a similar class, inspired by and under
// the same name as all the classes here, except everything is nicely separated
// for Above/Below??

// TODO:  UnitPx -> UnitAbs??
//        UnitPc -> UnitRel???

U.buildRoom({
  name: 'real',
  innerRooms: [ 'record' ],
  build: (foundation) => {
    
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
    
    let cssTech = {
      vAlignChild: { display: 'inline-block', verticalAlign: 'middle' },
      vAlignBefore: { display: 'inline-block', verticalAlign: 'middle', content: '\'\'', width: '0', height: '100%' },
    };
    
    let vals = (() => {
      let RealVal = U.inspire({ name: 'RealVal', insps: {}, methods: (insp, Insp) => ({
        init: function() {},
        getCss: C.notImplemented
      })});
      let Unit = U.inspire({ name: 'Unit', insps: { RealVal }, methods: (insp, Insp) => ({
        init: function(amt) {
          if (!U.typeOf(amt, Number) || isNaN(amt)) throw new Error(`Invalid amt: ${amt}`);
          insp.RealVal.init.call(this);
          this.amt = amt;
        },
        isAbsolute: function() {
          // Indicates whether the final length indicated by the unit is
          // known without any context. For example, pixel-units are
          // always absolute, since, e.g., "53 pixels" has a known size
          // regardless of any context. In contrast, the final length as
          // a result of percentage units isn't known without knowing
          // the size of the containing Real.
          return false;
        },
        suff: C.notImplemented,
        add: function(n) { let Cls = this.constructor; return Cls(this.amt + n); },
        mult: function(n) { let Cls = this.constructor; return Cls(this.amt * n); },
        round: function() { let Cls = this.constructor; return Cls(Math.round(this.amt)); },
        getCss: function() { return `${this.isAbsolute() ? this.amt : (this.amt * 100)}${this.suff()}`; }
      })});
      let Calc = U.inspire({ name: 'Calc', insps: { RealVal }, methods: (insp, Insp) => ({
        init: function(...units) {
          let unitsByType = Map();
          for (let unit of units) {
            if (!U.isType(unit.amt, Number)) throw new Error(`Provided invalid unit: ${U.typeOf(unit)}`);
            let UnitCls = unit.constructor;
            if (!unitsByType.has(UnitCls)) unitsByType.set(UnitCls, []);
            unitsByType.get(UnitCls).push(unit);
          }
          
          let uniqueUnits = [];
          for (let [ UnitCls, units ] of unitsByType) {
            let totalAmt = this.op(...units.map(u => u.amt));
            if (totalAmt) uniqueUnits.push(UnitCls(totalAmt));
          }
          
          if (uniqueUnits.length === 0) return vals.UnitPx(0);
          if (uniqueUnits.length === 1) return uniqueUnits[0];
          
          this.units = uniqueUnits;
        },
        op: C.notImplemented,
        cssCalcSymbol: C.notImplemented,
        isAbsolute: function() { return false; },
        getCss: function() {
          return `calc(${this.units.map(u => u.getCss()).join(` ${this.cssCalcSymbol()} `)})`;
        }
      })});
      return {
        RealVal,
        UnitPx: U.inspire({ name: 'UnitPx', insps: { Unit }, methods: (insp, Insp) => ({
          isAbsolute: function() { return true; },
          suff: function() { return 'px'; }
        })}),
        UnitPc: U.inspire({ name: 'UnitPc', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        UnitParW: U.inspire({ name: 'UnitParW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        UnitParH: U.inspire({ name: 'UnitParW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return '%'; }
        })}),
        ViewPortW: U.inspire({ name: 'ViewPortW', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vw'; }
        })}),
        ViewPortH: U.inspire({ name: 'ViewPortH', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vh'; }
        })}),
        ViewPortMin: U.inspire({ name: 'ViewPortMin', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vmin'; }
        })}),
        ViewPortMax: U.inspire({ name: 'ViewPortMax', insps: { Unit }, methods: (insp, Insp) => ({
          suff: function() { return 'vmax'; }
        })}),
        CalcAdd: U.inspire({ name: 'CalcAdd', insps: { Calc }, methods: (insp, Insp) => ({
          op: function(...vals) { let v = 0; for (let vv of vals) v += vv; return v; },
          cssCalcSymbol: function() { return '+'; }
        })}),
        CalcMult: U.inspire({ name: 'CalcMult', insps: { Calc }, methods: (insp, Insp) => ({
          op: function(...vals) { let v = 1; for (let vv of vals) v *= vv; return v; },
          cssCalcSymbol: function() { return '*'; },
        })})
      };
    })();
    
    let sizing = (() => {
      
      let FillParent = U.inspire({ name: 'FillParent', methods: (insp, Insp) => ({
        init: function({ shrink=vals.UnitPx(0), shrinkH=shrink, shrinkV=shrink, shrinkL=shrinkH, shrinkR=shrinkH, shrinkT=shrinkV, shrinkB=shrinkV }) {
          this.shrinkL = shrinkL;
          this.shrinkR = shrinkR;
          this.shrinkT = shrinkT;
          this.shrinkB = shrinkB;
        },
        getCss: function() {
          return { main: {
            display: 'block', position: 'absolute',
            left: this.shrinkL, right: this.shrinkR,
            top: this.shrinkT, bottom: this.shrinkB
          }};
        }
      })});
      let WrapChildren = U.inspire({ name: 'WrapChildren', methods: (insp, Insp) => ({
        init: function({ pad=vals.UnitPx(0), padH=pad, padV=pad, padL=padH, padR=padH, padT=padV, padB=padV }) {
          this.padL = padL;
          this.padR = padR;
          this.padT = padT;
          this.padB = padB;
        },
        getCss: function(parCtx) {
          return { main: {
            boxSizing: (parCtx.slots && parCtx.slots.fixesChildSizes()) ? 'border-box' : 'initial',
            ...(this.padL.amt ? { paddingLeft: this.padL } : {}),
            ...(this.padR.amt ? { paddingRight: this.padR } : {}),
            ...(this.padT.amt ? { paddingTop: this.padT } : {}),
            ...(this.padB.amt ? { paddingBottom: this.padB } : {})
          }};
        }
      })});
      let ShowText = U.inspire({ name: 'ShowText', methods: (insp, Insp) => ({
        init: function(opts) {
          let { pad=vals.UnitPx(0), padH=pad, padV=pad, padL=padH, padR=padH, padT=padV, padB=padV } = opts;
          this.padL = padL;
          this.padR = padR;
          this.padT = padT;
          this.padB = padB;
          
          // NOTE: Text origin has really wonky handling. Originally it
          // could be specified in decals, and now it should only be
          // provided to `ShowText` - but specifying to decals was
          // advantageous: decals are applied after geometry is complete
          // and after all other css. `ShowText` doesn't have knowledge
          // of the total geometry of its target, so it can't make the
          // same decisions (especially regarding line-height, with
          // centered text) as "textOrigin" could as a decal. So instead
          // of trying to get knowledge of the full geometry, we've just
          // maintained the "textOrigin" decal, even though it shouldn't
          // be used by anyone except `ShowText`. We set the
          // "lateDecals" zone, and include "textOrigin" there, so the
          // "textOrigin" value can finally apply when geometry is fully
          // understood.
          
          let { multiLine=false, origin='left' } = opts;
          this.multiLine = multiLine;
          this.origin = origin;
        },
        getCss: function(parCtx) {
          return {
            main: {
              whiteSpace: this.multiLine ? 'initial' : 'nowrap',
              boxSizing: (parCtx.slots && parCtx.slots.fixesChildSizes()) ? 'border-box' : 'initial',
              ...(!this.multiLine ? { textOverflow: 'ellipsis' } : {}),
              ...(this.padL.amt ? { paddingLeft: this.padL } : {}),
              ...(this.padR.amt ? { paddingRight: this.padR } : {}),
              ...(this.padT.amt ? { paddingTop: this.padT } : {}),
              ...(this.padB.amt ? { paddingBottom: this.padB } : {})
            },
            before: { content: '\'\\200B\'', fontSize: 'inherit' }, // Force text height
            lateDecals: {
              textOrigin: this.origin
            }
          };
        }
      })});
      
      return { FillParent, WrapChildren, ShowText };
      
    })();
    
    let slots = (() => {
      
      let RootViewStyles = U.inspire({ name: 'RootViewStyles', methods: (insp, Insp) => ({
        
        init: function() {},
        insertViewPortItem: function() { return RootViewPortItem(); },
        insertPageItem: function() { return RootPageItem(); },
        fixesChildSizes: function() { return true; },
        getCss: function() {
          return {
            main: {
              textAlign: 'center',
              whiteSpace: 'nowrap',
              fontSize: '0'
            },
            before: cssTech.vAlignBefore
          };
        }
        
      })});
      // TODO: capitalize "P" in "viewPort"?
      let RootViewPortItem = U.inspire({ name: 'RootViewPortItem', methods: (insp, Insp) => ({
        init: function() {},
        getCss: function() {
          return { main: { ...cssTech.vAlignChild, position: 'relative', width: vals.ViewPortMin(1), height: vals.ViewPortMin(1), overflow: 'auto', fontSize: '13px' } };
        }
      })});
      let RootPageItem = U.inspire({ name: 'RootPageItem', methods: (insp, Insp) => ({
        init: function() {},
        getCss: function() {
          return { main: {
            position: 'absolute', display: 'block',
            left: '0', right: '0', top: '0', bottom: '0',
            overflowX: 'hidden', overflowY: 'auto',
            fontSize: '13px'
          }};
        }
      })});
      
      let AxisSections = U.inspire({ name: 'AxisSections', methods: (insp, Insp) => ({
        init: function({ axis, dir='+', cuts }) {
          if (!axis) throw new Error('Missing "axis" param');
          if (!cuts) throw new Error('Missing "cuts" param');
          if (![ '+', '-' ].has(dir)) throw new Error('Invalid "dir" param');
          if (![ 'x', 'y' ].has(axis)) throw new Error('Invalid "axis" param');
          
          this.axis = axis;
          this.dir = dir;
          this.cuts = cuts;
        },
        insertSectionItem: function(index) { return AxisSectionItem(this, index); },
        fixesChildSizes: function() { return true; },
        getCss: function() { return { main: {} }; } // TODO: Need to articulate "`position: relative;` if not `position: absolute`"
      })});
      let AxisSectionItem = U.inspire({ name: 'AxisSectionItem', methods: (insp, Insp) => ({
        init: function(par, index) {
          this.par = par;
          this.index = index;
        },
        getCut: function(index) {
          if (index < 0) return vals.UnitPc(0);
          if (index >= this.par.cuts.length) return vals.UnitPc(1); // TODO: Use parent dimensions
          return this.par.cuts[index];
        },
        getCss: function(parCtx) {
          
          let { cuts, axis, dir } = this.par;
          
          let off = vals.CalcAdd(...cuts.slice(0, this.index));
          let ext = (this.index === cuts.length)
            ? vals.CalcAdd(parCtx[axis === 'x' ? 'w' : 'h'], ...cuts.map(u => u.mult(-1)))
            : cuts[this.index];
          
          let h = axis === 'x'; // "horizontal"
          let f = dir === '+';  // "forwards"
          return { main: {
            position: 'absolute',
            
            // Spanning offset (is always 0)
            [h ? 'top' : 'left']:                                   vals.UnitPx(0),
            
            // Spanning extent (is always the parent's full extent)
            [h ? 'height' : 'width']:                               h ? parCtx.h : parCtx.w,
            
            // Partial offset (depends on axis AND direction)
            [h ? (f ? 'left' : 'right') : (f ? 'top' : 'bottom')]:  off,
            
            // Partial extent
            [h ? 'width' : 'height']:                               ext
          }};
          
        }
      })});
      
      let LinearSlots = U.inspire({ name: 'LinearSlots', methods: (insp, Insp) => ({
        init: function({ axis, dir='+' /*, initPad=vals.UnitPx(0)*/ }) {
          if (!axis) throw new Error('Missing "axis" param');
          if (![ '+', '-' ].has(dir)) throw new Error('Invalid "dir" param');
          if (![ 'x', 'y' ].has(axis)) throw new Error('Invalid "axis" param');
          this.axis = axis;
          this.dir = dir;
        },
        insertLinearItem: function() { return LinearItem(this); },
        fixesChildSizes: function() { return false; },
        getCss: function() {
          if (this.axis === 'x') {
            return {
              main: { whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden' },
              before: cssTech.vAlignBefore
            };
          } else {
            return { main: { overflowX: 'hidden', overflowY: 'auto' } };
          }
        }
      })});
      let LinearItem = U.inspire({ name: 'LinearItem', methods: (insp, Insp) => ({
        init: function(par) {
          this.par = par;
        },
        getCss: function() {
          if (this.par.axis === 'x') {
            return { main: cssTech.vAlignChild };
          } else {
            return { main: { position: 'relative' } };
          }
        }
      })});
      
      let CenteredSlot = U.inspire({ name: 'CenteredSlot', methods: (insp, Insp) => ({
        init: function() {},
        insertCenteredItem: function() { return CenteredItem(this); },
        fixesChildSizes: function() { return false; },
        getCss: function() {
          return {
            main: {
              textAlign: 'center'
            },
            before: cssTech.vAlignBefore
          }
        }
      })});
      let CenteredItem = U.inspire({ name: 'CenteredItem', methods: (insp, Insp) => ({
        init: function(par) {
          this.par = par;
        },
        getCss: function() {
          return { main: cssTech.vAlignChild };
        }
      })});
      
      let TextFlowSlots = U.inspire({ name: 'TextFlowSlots', methods: (insp, Insp) => ({
        init: function({ gap=vals.UnitPx(0), lineHeight=null }) {
          this.gap = gap;
          this.lineHeight = lineHeight;
        },
        insertTextFlowItem: function() { return TextFlowItem(this); },
        fixesChildSizes: function() { return false; },
        getCss: function() {
          return { main: {} };
        }
      })});
      let TextFlowItem = U.inspire({ name: 'TextFlowItem', methods: (insp, Insp) => ({
        init: function(par) {
          this.par = par;
        },
        getCss: function() {
          return { main: {
            display: 'inline',
            whiteSpace: 'initial',
            ...(this.par.gap.amt ? { marginRight: this.par.gap } : {}),
            ...(this.par.lineHeight ? { lineHeight: this.par.lineHeight } : {})
          }};
        }
      })});
      
      return { RootViewStyles, AxisSections, LinearSlots, CenteredSlot, TextFlowSlots };
      
    })();
    
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      init: function(name, ctxsByNameFlat) {
        this.name = name;
        
        this.rootCtxsNode = { ctxsFunc: () => ({ slots: slots.RootViewStyles({}) }), children: {} };
        
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
      decalsToCss: function(parCtx, curMainCss, chain, decals) {
        
        if (!decals) return {};
        
        let mapping = {
          colour: 'backgroundColor',
          textSize: 'fontSize',
          textOrigin: origin => {
            if (origin !== 'center') return { textAlign: origin };
            
            if (curMainCss.has('height') && !curMainCss.height.isAbsolute())
              throw new Error('Can\'t center css text for relative-height element');
            
            let ret = { textAlign: 'center' };
            if (curMainCss.has('height')) ret.lineHeight = curMainCss.height;
            return ret;
          },
          textColour: 'color',
          textFont: 'font-family',
          size: v => {
            let ret = {};
            if (v[0] !== null) ret.width = v[0];
            if (v[1] !== null) ret.height = v[1];
            return ret;
          },
          text: v => { return { /* tricky! need to set javascript on the element */ }; },
          border: ({ type='in', ext, colour }) => {
            return { boxShadow: `${type === 'in' ? 'inset ' : ''}0 0 0 ${ext.getCss()} ${colour}` }
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
        
        this.mergeZoneCss(chain, zoneCss, directCss);
        
        return zoneCss;
        
      },
      mergeZoneCss: function(chain, cur, add) {
        
        // Zone is "main", "before", "after", "focus", "hover", etc.
        add.forEach((css, zone) => {
          
          if (!cur.has(zone)) cur[zone] = {};
          
          css.forEach((cssVal, cssKey) => {
            if (U.isType(cssVal, Number)) cssVal = vals.UnitPx(cssVal); // Allow numeric shorthand
            
            if (cur[zone].has(cssKey)) {
              let cssVal0 = cur[zone][cssKey];
              
              let inspMatch = U.inspOf(cssVal) === U.inspOf(cssVal0);
              let sameVal = inspMatch
                ? (U.isInspiredBy(cssVal, vals.RealVal) && cssVal.amt === cssVal0.amt) || cssVal === cssVal0
                : false;
              
              if (!sameVal) throw new Error(`Elem ${chain.join('.')} zone "${zone}" has conflicting "${cssKey}" css props`);
            }
            
            cur[zone][cssKey] = cssVal; // Allow numeric shorthand
          });
          
        });
        
      },
      getCssControls: function() {
        
        // Generates everything needed to govern the UIX of Below. This
        // includes stylesheet text, to govern static display rules, and
        // javascript controls on an element-by-element basis, to govern
        // any dynamic UIX features.
        
        let cmpRules = []; // Compile-time rules: for static UIX (css)
        let runRules = []; // Run-time rules: for dynamic UIX (js)
        
        // Iterate over ctxsNodes and determine Ctxs in terms of Conditions
        // Return results in flat format
        let processNode = (parCtx, chain, ctxsNode) => {
          
          try {
            
            // TODO: Could recursively propagate new contexts - it'd be more elegant?
            let { slot=null, size=null, slots=null, decals=null, dbg=false } = ctxsNode.ctxsFunc(parCtx);
            
            let dbgShow = cssZones => JSON.stringify(cssZones, (k, v) => U.safe(() => v.getCss(), () => v), 2);
            if (dbg) {
              
              
              console.log('DBG BEFORE:', chain.join('.'));
              console.log('SLOT:', U.typeOf(slot), slot && dbgShow(slot.getCss(parCtx)));
              console.log('SIZE:', U.typeOf(size), size && dbgShow(size.getCss(parCtx)));
              console.log('SLOTS:', U.typeOf(slots), slots && dbgShow(slots.getCss(parCtx)));
              
            }
            
            let zoneCss = { main: {} };
            this.mergeZoneCss(chain, zoneCss, slot ? slot.getCss(parCtx) : {});
            this.mergeZoneCss(chain, zoneCss, size ? size.getCss(parCtx) : {});
            this.mergeZoneCss(chain, zoneCss, slots ? slots.getCss(parCtx) : {});
            this.mergeZoneCss(chain, zoneCss, this.decalsToCss(parCtx, zoneCss.main, chain, decals));
            
            if (zoneCss.has('lateDecals')) {
              this.mergeZoneCss(chain, zoneCss, this.decalsToCss(parCtx, zoneCss.main, chain, zoneCss.lateDecals));
              
              // NOTE: It isn't impossible that the "late" addition of
              // decals will try to schedule ANOTHER late addition. If
              // that happens it's ignored: "lateDecals" is deleted
              delete zoneCss.lateDecals;
            }
            
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
              if (css.fontSize === 'inherit') delete css.fontSize; // `font-size: inherit;` is redundant!
              
              // Interpret "transform" prop
              if (css.has('transform')) css.transform = css.transform.toArr((v, k) => `${k}(${v.map(w => w.getCss()).join(', ')})`).join(' ');
              
              // Simplify compound props? (e.g. padding, margin? (padding-left, padding-right...), gradient, ...)
              
            });
            
            if (dbg) {
              console.log('DBG AFTER:', chain.join('.'));
              console.log(dbgShow(zoneCss));
            }
            
            cmpRules.push({ chain, zoneCss });
            
            let { w=null, h=null } = zoneCss.main.slice({ w: 'width', h: 'height' });
            
            // TODO: These aren't used now, but could be helpful. Tells
            // if the parent had actual size-governing attributes.
            // TODO: An Extent can be determined in ways that don't
            // involve "width" or "height": e.g. having "top" and
            // "bottom" determined, determines "height" as well!
            let determW = !!w, determH = !!h;
            
            if (!w || !w.isAbsolute()) w = vals.UnitPc(1);
            if (!h || !h.isAbsolute()) h = vals.UnitPc(1);
            
            let nextParCtx = { slots, w, h, determW, determH };
            ctxsNode.children.forEach((node, name) => processNode(nextParCtx, chain.concat([ name ]), node));
            
          } catch(err) {
            
            if (err.message[0] === '!') throw err;
            
            err.message = `!Chain err: [${chain.join('.')}]: ${err.message}`;
            throw err;
            
          }
          
        };
        
        processNode({ slots: null, w: vals.UnitPc(1), h: vals.UnitPc(1) }, [], this.rootCtxsNode);
        
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
                ...css.toArr((v, k) => `  ${camelToKebab(k)}: ${U.isType(v, String) ? v : v.getCss()};`),
                '}'
              ].join('\n'); // Join together all lines of a CssBlock
              
            }).join('\n');  // Join together all Zones of a ZonedCssBlock
            
          }).join('\n'),  // Join together all ZonedCssBlocks of a CssStyleSheet
          run: runRules
        };
        
      },
      /// =ABOVE}
      contain: function(foundation, real) {
        
        // NOTE: Right now all Real rules are buffered, transformed to be
        // heirarchical, and then processed at once. Could we skip the
        // buffering step? The main reason is simpler stack traces.
        
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
        // TODO: Shouldn't need to manage spoofing here (or anywhere outside of Foundations!)
        
        let { query } = foundation.parseUrl(window.location.toString());
        
        let styleElem = document.createElement('link');
        styleElem.setAttribute('rel', 'stylesheet');
        styleElem.setAttribute('type', 'text/css');
        styleElem.setAttribute('media', 'screen');
        styleElem.setAttribute('href', `/!FILE/${this.name}.css${query.has('spoof') ? `?spoof=${query.spoof}` : ''}`);
        document.head.appendChild(styleElem);
        
        real.dom.id = `${this.name}`;
        return Hog(() => { real.dom.id = ''; });
        
        /// =BELOW}
        
      },
    })});
    let Real = U.inspire({ name: 'Real', insps: { Hog }, methods: (insp, Insp) => ({
      init: function({ reality=null, nameChain=null, altNames=[], makeDom=()=>document.createElement('div') }={}) {
        
        insp.Hog.init.call(this);
        
        // Our link to a Reality instance
        this.reality = reality;
        
        // The list of names to specify our role
        if (nameChain === null) throw new Error('Missing "nameChain" param');
        if (nameChain.find(v => v.has('.'))) throw new Error(`Invalid Real name: [${nameChain.join(', ')}]`);
        this.nameChain = nameChain;
        
        // Get dom element
        this.dom = makeDom();
        
        // Add main name to dom
        if (nameChain.length) this.dom.classList.add(nameChain[nameChain.length - 1]);
        
        // "Feeling" most often occurs via click
        this.feelWob0 = null;
        this.curFeel = null;
        
        // "Telling" most often occurs via text entry
        this.tellBox = null;
        this.tellWob0 = null;
        
        // "Looking" most often occurs via focus
        this.lookWob0 = null; // TODO: Does WobTmp work here? And can it simplify "curFeel"?
        
        console.log('MADE:', this.dom);
        
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
        items.forEach(({ type, desc, v=null }, k) => {
          
          // TODO: More types?
          
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
          
          if (v !== null) {
            field.setText(v);
            field.tellWob().wobble(v);
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
          // Resolve String to Real
          if (!this.reality) throw new Error('Can\'t create Real from String without Reality set');
          real = Real({ nameChain: this.nameChain.concat([ real ]), reality: this.reality });
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
    
    return {
      
      sizing, slots,
      ...vals.slice('UnitPx', 'UnitPc'),
      Colour, Reality, Real
      
    };
    
  }
});
