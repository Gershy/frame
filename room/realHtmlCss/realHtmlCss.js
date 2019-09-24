// TODO: real-css file which defines a similar class, inspired by and under
// the same name as all the classes here, except everything is nicely separated
// for Above/Below??

// TODO:  UnitPx -> UnitAbs??
//        UnitPc -> UnitRel???

U.buildRoom({
  name: 'realHtmlCss',
  innerRooms: [ 'real' ],
  build: (foundation, real) => {
    
    let { Wob, WobVal, WobTmp, Hog } = U;
    let { UnitPx, UnitPc, CalcAdd, Real } = real;
    
    let camelToKebab = camel => camel.replace(/([A-Z])/g, (m, chr) => `-${chr.lower()}`);
    let cssTech = {
      vAlignPar: { whiteSpace: 'nowrap' },
      vAlignChild: { display: 'inline-block', verticalAlign: 'middle' }, // Should include `position: "relative if not absolute"`
      vAlignBefore: { zoom: '1', display: 'inline-block', verticalAlign: 'middle', content: '\'\'', width: '0', height: '100%' },
    };
    let tinyRound = (val, epsilon=0.00001) => {
      
      // If `val` is within `epsilon` distance of an integer, returns
      // that nearby integer (otherwise returns `val`).
      
      let round = Math.round(val);
      return (Math.abs(val - round) < epsilon) ? round : val;
    };
    let makeEventCustom = evt => evt.stopPropagation() || evt.preventDefault();
    
    let unitCss = Map();
    let getUnitCss = unit => {
      if (!unitCss.has(unit.constructor)) throw new Error(`Can\'t get css for Unit: ${U.typeOf(unit)}`);
      return unitCss.get(unit.constructor)(unit);
    };
    unitCss.set(real.Unit, unit => { throw new Error('Can\'t get css for Unit'); });
    unitCss.set(real.UnitPx, unit => `${tinyRound(unit.amt)}px`);
    unitCss.set(real.UnitPc, unit => `${tinyRound(unit.amt * 100)}%`);
    unitCss.set(real.ViewPortMin, unit => `${tinyRound(unit.amt * 100)}vmin`);
    unitCss.set(real.CalcAdd, calc => `calc(${calc.units.map(u => getUnitCss(u)).join(' + ')})`);
    
    // Note: Below there is the idea of "LayoutContext" - one such context
    // corresponds to the parent, under `parCtx`, and one corresponds to
    // the Layout itself, under `layoutCtx`. Such LayoutContexts are
    // established without ever seeing the finalized css of a Layout -
    // instead LayoutContexts contain computed information based on the
    // sum of the Slots, Size, and Slot - for example, whether the width
    // and height of the layout will be set. `parCtx.isSized` tells us
    // if the width and height of the parent Layout are set, while
    // `layoutCtx.isSized` tells us if the width+height of the child are
    // set.
    // Note: If a Real isn't "sized", its size is determined based on
    // the size of its parent, or the sum of the sizes of its children(??)
    let layoutCss = Map();
    let getLayoutCss = (layout, parCtx) => layoutCss.get(layout.constructor)(layout, parCtx);
    layoutCss.set(real.FillParent,        (layout, parCtx) => ({
      // makeDomElem: () => document.createElement('div'),
      cmpTimeUix: {
        main: {
          display: 'block', position: 'absolute',
          left: layout.shrinkL, right: layout.shrinkR,
          top: layout.shrinkT, bottom: layout.shrinkB
        }
      }
      // runTimeUix: real => {}
    }));
    layoutCss.set(real.WrapChildren,      (layout, parCtx) => ({
      cmpTimeUix: {
        main: {
          boxSizing: (parCtx.slots && parCtx.slots.fixesChildSizes()) ? 'border-box' : 'initial',
          ...(layout.padL.amt ? { paddingLeft: layout.padL } : {}),
          ...(layout.padR.amt ? { paddingRight: layout.padR } : {}),
          ...(layout.padT.amt ? { paddingTop: layout.padT } : {}),
          ...(layout.padB.amt ? { paddingBottom: layout.padB } : {})
        }
      }
    }));
    layoutCss.set(real.ShowText,          (layout, parCtx) => {
      
      let makeDomElem = () => {
        
        if (!layout.interactive) return document.createElement('div');
        
        let dom = document.createElement(layout.multiLine ? 'textarea' : 'input');
        dom.style.fontFamily = 'inherit'; // TODO: This can be a static rule in the global css
        if (layout.multiLine) {
          dom.style.resize = 'none'; // TODO: This can be a static rule in the global css
        } else {
          dom.setAttribute('type', 'text');
        }
        return dom;
      };
      
      let cmpTimeUix = {
        main: {
          whiteSpace: layout.multiLine ? 'pre-wrap' : 'pre',
          boxSizing: (parCtx.slots && parCtx.slots.fixesChildSizes()) ? 'border-box' : 'initial',
          textOverflow: 'ellipsis',
          ...(layout.padL.amt ? { paddingLeft: layout.padL } : {}),
          ...(layout.padR.amt ? { paddingRight: layout.padR } : {}),
          ...(layout.padT.amt ? { paddingTop: layout.padT } : {}),
          ...(layout.padB.amt ? { paddingBottom: layout.padB } : {}),
        },
        lateDecals: {
          textOrigin: layout.origin
        }
      };
      
      let runTimeUix = real => {
        let dom = real.realized;
        if (layout.interactive) {
          real.tellWob0 = U.WobVal('');
          dom.addEventListener('input', v => real.tellWob0.wobble(dom.value));
          real.setText = layout.multiLine
            ? text => dom.textContent = text
            : text => dom.value = text
        } else {
          real.setText = text => dom.textContent = text;
        }
      };
      
      return { makeDomElem, cmpTimeUix, runTimeUix };
      
    });
    layoutCss.set(real.RootViewStyles,    (layout, parCtx) => ({
      cmpTimeUix: {
        main: {
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontSize: '0'
        },
        before: cssTech.vAlignBefore
      }
    }));
    layoutCss.set(real.RootViewPortItem,  (layout, parCtx) => ({
      cmpTimeUix: {
        main: {
          position: 'relative',
          width: real.ViewPortMin(1),
          height: real.ViewPortMin(1),
          ...cssTech.vAlignChild,
          overflow: 'auto',
          fontSize: '13px'
        }
      }
    }));
    layoutCss.set(real.RootPageItem,      (layout, parCtx) => ({
      cmpTimeUix: {
        main: {
          position: 'absolute', display: 'block',
          left: '0', right: '0', top: '0', bottom: '0',
          overflowX: 'hidden', overflowY: 'auto',
          fontSize: '13px'
        }
      }
    }));
    layoutCss.set(real.AxisSections,      (layout, parCtx) => ({
      cmpTimeUix: { main: {} }  // TODO: Should articulate `position: "relative if not absolute"`
    }));
    layoutCss.set(real.AxisSectionItem,   (layout, parCtx) => {
      
      let { cuts, axis, dir } = layout.par; // TODO: What about when multiple pars are available?
        
      let off = CalcAdd(...cuts.slice(0, layout.index));
      let ext = (layout.index === cuts.length)
        ? CalcAdd(parCtx[axis === 'x' ? 'w' : 'h'], ...cuts.map(u => u.mult(-1)))
        : cuts[layout.index];
      
      let h = axis === 'x'; // "horizontal"
      let f = dir === '+';  // "forwards"
      let main = {
        // AxisSectionItems are always absolute!
        position: 'absolute',
        
        // Spanning offset (is always 0)
        [h ? 'top' : 'left']:                                   UnitPx(0),
        
        // Spanning extent (is always the parent's full extent)
        [h ? 'height' : 'width']:                               h ? parCtx.h : parCtx.w,
        
        // Partial offset (depends on axis AND direction)
        [h ? (f ? 'left' : 'right') : (f ? 'top' : 'bottom')]:  off,
        
        // Partial extent
        [h ? 'width' : 'height']:                               ext
      };
      
      return { cmpTimeUix: { main } };
      
    });
    layoutCss.set(real.LinearSlots,       (layout, parCtx) => ({
      cmpTimeUix: (layout.axis === 'x')
        ? { // X-axis alignment needs the vertical-align technique
          main: { whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden' },
          before: cssTech.vAlignBefore
        }
        : { // Y-axis alignment is easy
          main: { overflowX: 'hidden', overflowY: 'auto' }
        }
    }));
    layoutCss.set(real.LinearItem,        (layout, parCtx) => ({
      cmpTimeUix: {
        // X-axis needs child alignment; Y-axis must not be absolute
        main: (layout.par.axis === 'x') ? cssTech.vAlignChild : { position: 'relative' }
      }
    }));
    layoutCss.set(real.CenteredSlot,      (layout, parCtx) => ({
      cmpTimeUix: {
        main: { textAlign: 'center' },
        before: cssTech.vAlignBefore
      }
    }));
    layoutCss.set(real.CenteredItem,      (layout, parCtx) => ({
      cmpTimeUix: { main: cssTech.vAlignChild }
    }));
    layoutCss.set(real.TextFlowSlots,     (layout, parCtx) => ({
      cmpTimeUix: { main: { whiteSpace: 'pre', overflowX: 'hidden', overflowY: 'auto' } }
    }));
    layoutCss.set(real.TextFlowItem,      (layout, parCtx) => ({
      cmpTimeUix: {
        main: {
          display: 'inline',
          whiteSpace: 'pre-wrap',
          ...(layout.par.gap.amt ? { marginRight: layout.par.gap } : {}),
          ...(layout.par.lineHeight ? { lineHeight: layout.par.lineHeight } : {})
        }
      },
      runTimeUix: real => {
        real.setText = text => real.realized.textContent = text;
      }
    }));
    
    let Reality = U.inspire({ name: 'Reality', insps: real.slice('Reality'), methods: (insp, Insp) => ({
      $makeDefDomElem: () => document.createElement('div'),
      
      init: function(...args) {
        insp.Reality.init.call(this, ...args);
        this.iterateCtxNodes((ctxNode, chain) => {
          
          let { slot=null, size=null, slots=null } = ctxNode.computed;
          ctxNode.makeDomElem = null;
          ctxNode.runTimeUixControls = [];
          
          for (let layout of [ slot, size, slots ]) {
            if (!layout) continue;
            let { makeDomElem, runTimeUix } = getLayoutCss(layout, ctxNode.par);
            
            if (makeDomElem) {
              if (ctxNode.makeDomElem) throw new Error(`Conflicting "makeDomElem" funcs for Real @ ${chain.join('.')}`);
              ctxNode.makeDomElem = makeDomElem;
            }
            
            if (runTimeUix) {
              ctxNode.runTimeUixControls.push(runTimeUix);
            }
          }
          
        });
      },
      
      makeDefaultDomElem: function() { return document.createElement('div'); },
      
      /// {ABOVE=
      
      // Only Above needs to know how to generate css markup
      decalsToCss: function(mainCss, decals) { // TODO: When "textOrigin" is cleaned up, can drop "mainCss" param
        
        if (!decals) return {};
        
        let mapping = {
          
          // String values indicate direct mapping. Objects result in
          // multiple css values for the single Real decal. Function
          // values will be called to produce either Strings or Objects.
          
          colour: 'backgroundColor',
          textSize: 'fontSize',
          textOrigin: origin => {
            // TODO: "textOrigin" should disappear, and `mainCss` should
            // be removed from params
            if (origin !== 'center') return { textAlign: origin };
            
            if (mainCss.has('height') && !mainCss.height.isAbsolute())
              { console.log('Can\'t center css text for relative-height element'); return { textAlign: 'center' }; }
              //throw new Error('Can\'t center css text for relative-height element');
            
            let ret = { textAlign: 'center' };
            if (mainCss.has('height')) ret.lineHeight = mainCss.height;
            return ret;
          },
          textColour: 'color',
          textFont: 'fontFamily',
          text: v => { return { /* tricky! need to set javascript on the element */ }; },
          border: ({ type='in', ext, colour }) => {
            return { boxShadow: `${type === 'in' ? 'inset ' : ''}0 0 0 ${getUnitCss(ext)} ${colour}` }
          }
        };
        
        let zoneDecals = { main: decals };
        if (decals.has('focus')) { zoneDecals.focus = decals.focus; delete decals.focus; }
        if (decals.has('hover')) { zoneDecals.hover = decals.hover; delete decals.hover; }
        
        // Zones are the same between css and Decals... for now
        let zoneCss = zoneDecals.map((decals, zone) => {
          
          let css = {};
          decals.forEach((decVal, decKey) => {
            
            if (!mapping.has(decKey)) throw new Error(`Invalid decal name: "${decKey}"`);
            let m = mapping[decKey];
            
            if (U.isType(m, Function)) m = m(decVal); // Resolve Function if necessary
            if (U.isType(m, String)) m = { [m]: decVal }; // Resolve String if necessary
            m.forEach((cssVal, cssKey) => {
              if (css.has(cssKey)) throw new Error(`Calculated conflicting css "${cssKey}" properties (from "${decVal}" Decal)`);
              css[cssKey] = cssVal;
            });
            
          });
          return css;
          
        });
        
        return zoneCss;
        
      },
      mergeZoneCss: function(cur, add) {
        
        // Zone is "main", "before", "after", "focus", "hover", etc.
        add.forEach((css, zone) => {
          
          if (!cur.has(zone)) cur[zone] = {};
          
          css.forEach((cssVal, cssKey) => {
            
            if (cur[zone].has(cssKey)) {
              
              // We're trying to apply a property that already exists!
              // Check if properties match, precisely - if they don't
              // it means there's a conflict!
              
              let cssVal0 = cur[zone][cssKey];
              //let inspMatch = U.inspOf(cssVal) === U.inspOf(cssVal0);
              //let sameVal = inspMatch
              //  ? (U.isInspiredBy(cssVal, UnitAmt) ? (cssVal.amt === cssVal0.amt) : (cssVal === cssVal0))
              //  : false;
              if (!real.unitsEq(cssVal, cssVal0)) throw new Error(`Conflicting css props in zone "${zone}" for prop "${cssKey}"`);
              
            }
            
            cur[zone][cssKey] = cssVal; // Allow numeric shorthand
            
          });
          
        });
        
      },
      genCss: function() {
        
        // Generates everything needed to govern the UIX of Below. This
        // includes stylesheet text, to govern static display rules, and
        // javascript controls on an element-by-element basis, to govern
        // any dynamic uix features.
        
        let cssRules = []; // [ { chain, zoneCss } ... ];
        this.iterateCtxNodes((ctxNode, chain, par) => {
          
          let { slot, size, slots, decals } = ctxNode.computed;
          
          // Merge ZoneCss for each provided Layout
          let zoneCss = { main: {} };
          for (let layout of [ slot, size, slots ]) {
            if (layout) this.mergeZoneCss(zoneCss, getLayoutCss(layout, ctxNode.par).cmpTimeUix); // `cmpTimeUix` is ZoneCss
          }
          
          // Merge in Decal ZoneCss
          if (decals) this.mergeZoneCss(zoneCss, this.decalsToCss(zoneCss.main, decals));
          
          if (zoneCss.has('lateDecals')) {
            // The "lateDecals" zone allow decals to be added with the
            // full knowledge of geometric parameters. Can be useful
            // for, example, setting a line-height equal to whatever
            // the height happens to be.
            // NOTE: It isn't impossible that the "late" addition of
            // decals will try to schedule ANOTHER late addition. If
            // that happens it's ignored: we always delete "lateDecals"
            this.mergeZoneCss(zoneCss, this.decalsToCss(zoneCss.main, zoneCss.lateDecals));
            delete zoneCss.lateDecals;
          }
          
          // TODO: Necessary??
          zoneCss.forEach((css, zone) => {
            
            if (css.isEmpty()) { delete zoneCss[zone]; return; }
            
            css.forEach((v, k) => { if (!k.match(/^[a-zA-Z]+$/)) throw new Error(`Invalid css key: "${k}"`); });
            
            // Reset any inappropriately inherited values
            if (!css.has('textAlign')) css.textAlign = 'left';
            if (!css.has('fontSize')) css.fontSize = '13px';
            if (css.fontSize === 'inherit') delete css.fontSize; // `font-size: inherit;` is redundant!
            
            // Simplify compound props? (e.g. padding, margin? (padding-left, padding-right...), gradient, ...)
            
          });
          
          // The overall purpose of `recurseRules` is to populate `cssRules`
          if (!zoneCss.isEmpty()) cssRules.push({ chain, zoneCss });
          
        });
        
        let cmpText = cssRules.map(({ chain, zoneCss }) => {
          
          return zoneCss.toArr((css, zone) => {
            
            // Make sure every selector starts with "body"
            // This is important for the root element, whose chain is []
            // If we didn't include "body" in the selector, its selector
            // would be the empty string (and for regions like ::before,
            // a css rule would be generated that globally applies
            // ::before pseudo-elements to all html elements!)
            let selector = [ 'body', ...chain.map(v => `.${v}`) ].join(' > ');
            
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
              ...css.toArr((v, k) => `  ${camelToKebab(k)}: ${U.isType(v, String) ? v : getUnitCss(v)};`),
              '}'
            ].join('\n'); // Join together all lines of a CssBlock
            
          }).join('\n');  // Join together all Zones of a ZonedCssBlock
          
        }).join('\n');  // Join together all ZonedCssBlocks of a CssStyleSheet
        
        return cmpText;
        
      },
      
      /// =ABOVE}
      
      getCmpTimeFwkAssets: function() {
        
        return {
          'style.css': {
            contentType: 'text/css',
            content: this.genCss()
          }
        };
        
      },
      initReal: function(nameChain) {
        // TODO: Most of this should only appear in realHtmlCss!
        let ctx = this.getCtxNode(...nameChain);
        
        // Create dom element and add class
        let domElem = ctx.makeDomElem ? ctx.makeDomElem() : document.createElement('div');
        domElem.classList.add(nameChain[nameChain.length - 1]);
        
        let real = Real({ nameChain, reality: this, realized: domElem });
        for (let rtuc of ctx.runTimeUixControls) rtuc(real);
        return real;
      },
      addChildReal: function(parReal, childReal) {
        parReal.realized.appendChild(childReal.realized);
      },
      remChildReal: function(childReal) {
        let dom = childReal.realized;
        dom.parentNode.removeChild(dom);
      },
      makeFeelable: function(real, wobTmp) {
        let dom = real.realized;
        dom.addEventListener('mousedown', evt => makeEventCustom(evt) || wobTmp.up());
        dom.addEventListener('mouseup', evt => makeEventCustom(evt) || wobTmp.dn());
        dom.style.gain({ cursor: 'pointer' });
      },
      makeTellable: function(real, wob) {
        
      }
    })});
    
    return { Reality };
    
  }
});
