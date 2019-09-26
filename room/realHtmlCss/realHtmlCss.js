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
    
    // TODO: Would be cool if patterns to the compiler could be
    // dynamically defined on a per-file basis. So for example here,
    // we could ask the compiler to, when compiling Below, not only
    // ignore everything marked {ABO/VE= ... =ABO/VE}, but also to ignore
    // a regex like /zoneCss.set\(/. Would be especially nifty if the
    // compiler began counting indentation during a dynamic-ignore, and
    // automatically figured out the ignored block was complete after
    // indentation returns to where it started!
    
    // "zoneCss" gets ZoneCss
    // "domElemFunc" gets a function returning a dom element
    // "runTimeUixFunc" gets a function which applies uix to a Real
    let getCssAspect = (() => { // Params: "type", "layoutCmp", "layout", "trail"
      
      let zoneCss = Map(), domElemFunc = Map(), runTimeUixFunc = Map();
      
      /// {ABOVE=
      zoneCss.set(real.RootViewStyles, (rootViewStyles, layout, ...trail) => ({
        main: { textAlign: 'center', fontSize: '0', overflow: 'hidden', ...cssTech.vAlignPar },
        before: cssTech.vAlignBefore
      }));
      zoneCss.set(real.RootViewPortItem, (rootViewPortItem, layout, ...trail) => ({
        main: {
          position: 'relative', display: 'block',
          overflow: 'auto', fontSize: '13px',
          width: real.ViewPortMin(1), height: real.ViewPortMin(1),
          ...cssTech.vAlignChild,
        }
      }));
      zoneCss.set(real.RootPageItem, (rootPageItem, layout, ...trail) => ({
        main: {
          position: 'absolute', display: 'block',
          overflow: 'hidden auto', fontSize: '13px',
          left: '0', right: '0', top: '0', bottom: '0'
        }
      }));
      zoneCss.set(real.FillParent, (fillParent, layout, ...trail) => ({
        main: {
          display: 'block', position: 'absolute',
          left: fillParent.shrinkL, right: fillParent.shrinkR,
          top: fillParent.shrinkT, bottom: fillParent.shrinkB
        }
      }));
      zoneCss.set(real.WrapChildren, (wrapChildren, layout, ...trail) => {
        let w = layout.getW(...trail);
        let h = layout.getH(...trail);
        if ((!!w) !== (!!h)) throw new Error('WrapChildren mixes set and unset extents');
        return { main: {
          ...((w && h) ? { boxSizing: 'border-box' } : {}),
          ...(wrapChildren.padL.amt ? { paddingLeft:    wrapChildren.padL } : {}),
          ...(wrapChildren.padR.amt ? { paddingRight:   wrapChildren.padR } : {}),
          ...(wrapChildren.padT.amt ? { paddingTop:     wrapChildren.padT } : {}),
          ...(wrapChildren.padB.amt ? { paddingBottom:  wrapChildren.padB } : {})
        }};
      });
      zoneCss.set(real.ShowText, (showText, layout, ...trail) => {
        let w = layout.getW(...trail);
        let h = layout.getH(...trail);
        let vCentered = showText.origin[1] === 'c';
        
        // Note that if height for vertical centering is `null` there's
        // no need to apply a line-height: the element's height will
        // conform to the text, making it centered by default.
        if (vCentered && h && !h.isAbsolute()) throw new Error('Css doesn\'t enjoy vertically aligning text in a non-absolute-height element!');
        if (showText.origin[1] === 'b') throw new Error('Css doesn\'t enjoy vertically aligning text to bottom');
        if ((!!w) !== (!!h)) throw new Error('ShowText mixes set and unset extents');
        
        return { main: {
          ...((w && h) ? { boxSizing: 'border-box' } : {}),
          whiteSpace: showText.multiLine ? 'pre-wrap' : 'pre',
          textAlign: ({ l: 'left', r: 'right', c: 'center' })[showText.origin[0]],
          textOverflow: 'ellipsis',
          ...((vCentered && h) ? { lineHeight: h } : {}),
          ...(showText.padL.amt ? { paddingLeft: showText.padL } : {}),
          ...(showText.padR.amt ? { paddingRight: showText.padR } : {}),
          ...(showText.padT.amt ? { paddingTop: showText.padT } : {}),
          ...(showText.padB.amt ? { paddingBottom: showText.padB } : {}),
        }};
      });
      zoneCss.set(real.AxisSectionItem, (axisSectionItem, layout, parLayout, ...parTrail) => {
        
        let { cuts, axis, dir } = axisSectionItem.par;
        let index = axisSectionItem.index;
        
        let h = axis === 'x'; // "horizontal"
        let f = dir === '+';  // "forwards"
        
        let parW = parLayout.getW(...parTrail) || UnitPc(1); // TODO: Potentially don't need to calculate (based on "axis", and if it's the final index)
        let parH = parLayout.getH(...parTrail) || UnitPc(1);
        
        let off = CalcAdd(...cuts.slice(0, index));
        let ext = (index === cuts.length)
          // For the final index, subtract all cuts from the parent's full extent along "axis"
          ? CalcAdd(h ? parW : parH, ...cuts.map(u => u.mult(-1)))
          // For other indexes, the size of the indexed cut is the extent of the AxisSectionItem
          : cuts[index];
        
        let main = { position: 'absolute' };
        if (h) main.gain({ top: UnitPx(0),  height: parH, [f ? 'left' : 'right'] : off, width: ext });
        else   main.gain({ left: UnitPx(0), width:  parW, [f ? 'top' : 'bottom'] : off, height: ext });
        
        return { main };
        
      });
      zoneCss.set(real.LinearSlots, (linearSlots, layout, ...trail) => {
        return  (linearSlots.axis === 'x')
          // X-axis alignment needs the vertical-align technique
          ? { main: { overflow: 'auto hidden', ...cssTech.vAlignPar }, before: cssTech.vAlignBefore }
          // Y-axis alignment is easy
          : { main: { overflow: 'hidden auto' } };
      });
      zoneCss.set(real.LinearItem, (linearItem, layout, ...trail) => ({
        // X-axis needs child vertical-alignment; Y-axis must not be absolute
        main: (linearItem.par.axis === 'x') ? cssTech.vAlignChild : { position: 'relative' }
      }));
      zoneCss.set(real.CenteredSlot, (centeredSlot, layout, ...trail) => ({
        main: { textAlign: 'center', ...cssTech.vAlignPar },
        before: cssTech.vAlignBefore
      }));
      zoneCss.set(real.CenteredItem, (centeredItem, layout, ...trail) => ({
        main: cssTech.vAlignChild
      }));
      zoneCss.set(real.TextFlowSlots, (textFlowSlots, layout, ...trail) => ({
        main: { whiteSpace: 'pre', overflow: 'hidden auto' }
      }));
      zoneCss.set(real.TextFlowItem, (textFlowItem, layout, ...trail) => ({
        main: {
          display: 'inline',
          whiteSpace: 'pre-wrap',
          ...(textFlowItem.par.gap.amt ? { marginRight: textFlowItem.par.gap } : {}),
          ...(textFlowItem.par.lineHeight ? { lineHeight: textFlowItem.par.lineHeight } : {})
        }
      }));
      /// =ABOVE}
      
      domElemFunc.set(real.ShowText, (showText, layout, ...trail) => {
        if (!showText.interactive) return () => document.createElement('div');
        return showText.multiLine
          ? () => {
              let dom = document.createElement('textarea');
              dom.style.fontFamily = 'inherit'; // TODO: Should be static css rule
              dom.style.resize = 'none'; // TODO: Also should be in css
              return dom;
            }
          : () => {
              let dom = document.createElement('input');
              dom.style.fontFamily = 'inherit';
              dom.setAttribute('type', 'text');
              return dom;
            }
      });
      
      runTimeUixFunc.set(real.ShowText, (showText, layout, ...trail) => {
        return showText.interactive
          ? real => {
              let dom = real.realized;
              real.tellWob0 = U.WobVal('');
              real.setText = showText.multiLine ? text => dom.textContent = text : text => dom.value = text;
              dom.addEventListener('input', v => real.tellWob0.wobble(dom.value));
            }
          : real => {
              real.setText = text => real.realized.textContent = text;
            };
      });
      runTimeUixFunc.set(real.TextFlowItem, (textFlowItem, layout, ...trail) => {
        return real => {
          real.setText = text => real.realized.textContent = text;
        };
      });
      
      let cssAspects = { zoneCss, domElemFunc, runTimeUixFunc };
      return (type, layoutCmp, layout, trail) => {
        if (!cssAspects.has(type)) throw new Error('Invalid type');
        let Cls = layoutCmp.constructor;
        let aspects = cssAspects[type];
        if (!aspects.has(Cls)) return null;
        return aspects.get(Cls)(layoutCmp, layout, ...trail);
      };
      
    })();
    
    let Reality = U.inspire({ name: 'Reality', insps: real.slice('Reality'), methods: (insp, Insp) => ({
      /// {ABOVE=
      
      // Only Above needs to know how to generate css markup
      decalsToZoneCss: function(decals) {
        
        if (!decals) return {};
        
        let mapping = {
          
          // String values indicate direct mapping. Objects result in
          // multiple css values for the single Real decal. Function
          // values will be called to produce either Strings or Objects.
          
          colour: 'backgroundColor',
          textSize: 'fontSize',
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
          
          if (css.isEmpty()) return; // Don't merge empty zones
          if (!cur.has(zone)) cur[zone] = {};
          
          css.forEach((cssVal, cssKey) => {
            
            if (cur[zone].has(cssKey)) {
              
              // We're trying to apply a property that already exists!
              // Check if properties match, precisely - if they don't
              // it means there's a conflict!
              
              let cssVal0 = cur[zone][cssKey];
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
        this.iterateLayouts((layout, trail) => {
          
          let nameChain = [ layout.name, ...trail.map(l => l.name) ].invert();
          
          try {
            
            let layoutCmps = this.getLayoutCmps(layout, trail);
            let decals = layout.cmps.decals;
            
            // Merge ZoneCss for all LayoutCmps
            let zoneCss = { main: {} };
            for (let layoutCmp of layoutCmps) {
              let zoneCssForLayoutCmp = getCssAspect('zoneCss', layoutCmp, layout, trail);
              if (zoneCssForLayoutCmp) this.mergeZoneCss(zoneCss, zoneCssForLayoutCmp);
            }
            
            // Merge in Decal ZoneCss
            if (decals) this.mergeZoneCss(zoneCss, this.decalsToZoneCss(decals));
            
            // Note only the "main" zone may be empty by this point
            if (zoneCss.main.isEmpty()) delete zoneCss.main;
            
            // TODO: Necessary??
            zoneCss.forEach((css, zone) => {
              if (css.isEmpty()) { delete zoneCss[zone]; return; }
              
              // TODO:  Consider globally inherited font-size of 0, and
              //        only apply font-size to `ShowText`???
              // Reset any inappropriately inherited values
              if (!css.has('textAlign')) css.textAlign = 'left';
              if (!css.has('fontSize')) css.fontSize = '13px';
              if (css.fontSize === 'inherit') delete css.fontSize; // `font-size: inherit;` is redundant!
            });
            
            // The overall purpose here is to populate `cssRules`
            if (!zoneCss.isEmpty()) cssRules.push({ nameChain, zoneCss });
          
          } catch(err) {
            err.message = `Failed css for [${nameChain.join('.')}]: ${err.message}`;
            throw err;
          }
          
        });
        
        let cmpText = cssRules.map(({ nameChain, zoneCss }) => {
          
          return zoneCss.toArr((css, zone) => {
            
            let selector = [ ...nameChain.map(v => `.${v}`) ].join(' > ');
            
            if (zone === 'main') { // Main css - do nothing!
            } else if ([ 'focus', 'hover' ].has(zone)) {  // Pseudo-selector
              selector = `${selector}:${zone}`;
            } else if ([ 'before', 'after' ].has(zone)) { // Pseudo-element
              selector = `${selector}::${zone}`;
            } else {
              throw new Error(`Unexpected css zone: ${zone}`);
            }
            
            //console.log('CSS:', nameChain.join('.'), css);
            return [
              `${selector} {`,
              ...css.toArr((v, k) => v ? `  ${camelToKebab(k)}: ${U.isType(v, String) ? v : getUnitCss(v)};` : C.skip),
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
      initReal0: function(real, layout, trail) {
        // Create dom element and add class for `layout.name`
        let cmps = this.getLayoutCmps(layout, trail);
        let makeDomElems = cmps.map(cmp => getCssAspect('domElemFunc', cmp, layout, trail) || C.skip);
        if (makeDomElems.length > 1) throw new Error('Conflicting domElemFuncs');
        
        let domElem = makeDomElems.length ? makeDomElems[0]() : document.createElement('div');
        domElem.classList.add(layout.name);
        
        // Link real to dom
        real.realized = domElem;
        
        // Apply runtime uix
        for (let cmp of cmps) {
          let rtuc = getCssAspect('runTimeUixFunc', cmp, layout, trail);
          if (rtuc) rtuc(real);
        }
        
        // Now `real` should be ready!
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
