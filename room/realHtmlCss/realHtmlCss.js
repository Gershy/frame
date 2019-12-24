U.buildRoom({
  name: 'realHtmlCss',
  innerRooms: [ 'real' ],
  build: (foundation, real) => {
    
    let { Wob, WobVal, WobTmp, Hog } = U;
    let { UnitPx, UnitPc, CalcAdd, Real } = real;
    
    let camelToKebab = camel => camel.replace(/([A-Z])/g, (m, chr) => `-${chr.lower()}`);
    let tinyRound = (val, epsilon=0.001) => {
      // If `val` is within `epsilon` distance of an integer, returns
      // that nearby integer (otherwise returns `val`).
      let round = Math.round(val);
      return (Math.abs(val - round) < epsilon) ? round : val;
    };
    let customEvent = evt => evt.stopPropagation() || evt.preventDefault() || true;
    
    /// {ABOVE=
    let cssTech = {
      vAlignPar: { whiteSpace: 'nowrap' },
      vAlignChild: { display: 'inline-block', verticalAlign: 'middle' }, // Should include `position: "relative if not absolute"`
      vAlignBefore: { display: 'inline-block', verticalAlign: 'middle', content: `''`, width: '0', height: '100%' },
    };
    let XmlElement = U.inspire({ name: 'XmlElement', methods: (insp, Insp) => ({
      init: function(tagName, type, text='') {
        if (![ 'root', 'singleton', 'container', 'text' ].has(type)) throw Error(`Invalid type; ${type}`);
        this.tagName = tagName;
        this.type = type;
        this.props = {};
        this.children = [];
        this.text = '';
        this.setText(text);
      },
      setText: function(text) {
        if (text !== text.trim()) throw Error(`Text "${text}" has extra whitespace`);
        this.text = text;
      },
      setProp: function(name, value=null) { this.props[name] = value; },
      add: function(child) {
        if (![ 'root', 'container' ].has(this.type)) throw Error(`Can\'t add to type ${this.type}`);
        this.children.push(child);
        return child;
      },
      toString: function(indent='') {
        let propStr = this.props.toArr((v, k) => v === null ? k : `${k}="${v}"`).join(' ');
        if (propStr) propStr = ' ' + propStr;
        return ({
          singleton: (i, t, p) => `${i}<${t}${p}${t.hasHead('!') ? '' : '/'}>\n`,
          text: (i, t, p) => this.text.has('\n')
            ? `${i}<${t}${p}>\n${this.text.split('\n').map(ln => i + '  ' + ln).join('\n')}\n${i}</${t}>\n`
            : `${i}<${t}${p}>${this.text}</${t}>\n`,
          root: (i, t, p, c) => `${i}${c.map(c => c.toString(i)).join('')}`,
          container: (i, t, p, c) => `${i}<${t}${p}>${c.isEmpty() ? '' : '\n'}${c.map(c => c.toString(i + '  ')).join('')}${c.isEmpty() ? '' : i}</${t}>\n`
        })[this.type](indent, this.tagName, propStr, this.children);
      }
    })});
    /// =ABOVE} {BELOW=
    let updStyle = (dom, prop, newVal) => {
      if (newVal === null) return dom.style.removeProperty(camelToKebab(prop));
      if (newVal !== dom.style[prop]) dom.style[prop] = newVal;
    };
    /// =BELOW}
    
    let unitCss = Map();
    let getUnitCss = unit => {
      if (!unitCss.has(unit.constructor)) throw Error(`Can\'t get css for Unit: ${U.nameOf(unit)}`);
      return unitCss.get(unit.constructor)(unit);
    };
    unitCss.set(real.Unit, unit => { throw Error('Can\'t get css for Unit'); });
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
        main: { ...cssTech.vAlignPar, textAlign: 'center', fontSize: '0', overflow: 'hidden' },
        before: cssTech.vAlignBefore
      }));
      zoneCss.set(real.RootViewPortItem, (rootViewPortItem, layout, ...trail) => ({
        main: {
          position: 'relative', display: 'block', overflow: 'auto',
          width: real.ViewPortMin(1), height: real.ViewPortMin(1),
          ...cssTech.vAlignChild,
        }
      }));
      zoneCss.set(real.RootPageItem, (rootPageItem, layout, ...trail) => ({
        main: {
          position: 'absolute', display: 'block', overflow: 'hidden auto',
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
        if ((!!w) !== (!!h)) throw Error('WrapChildren mixes set and unset extents');
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
        let absH = h && h.isAbsolute();
        
        let alignCss = null;
        if (showText.interactive) {
          if (showText.origin[1] !== 't' && showText.multiLine) throw Error('Tricky to vertically align textarea text anywhere but top');
          alignCss = {
            textAlign: ({ l: 'left', r: 'right', c: 'center' })[showText.origin[0]]
          };
        } else {
          if (showText.origin[1] === 'c' && (!h || h.isAbsolute())) {
            // Vertically centered with absolute height: use line-height
            // if a height is required; otherwise leave line-height
            // unspecified (and container height will conform to text)
            alignCss = {
              textAlign: ({ l: 'left', r: 'right', c: 'center' })[showText.origin[0]],
              ...(h ? { lineHeight: h } : {})
            };
          } else if (showText.origin[1] === 'c' && !h.isAbsolute()) {
            // Vertically centered with relative height: use flexbox
            alignCss = {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: ({ l: 'flex-start', r: 'flex-end', c: 'center' })[showText.origin[0]]
            };
          } else if (showText.origin[1] === 't') {
            // Vertically at the top: this happens by default!
            alignCss = {
              textAlign: ({ l: 'left', r: 'right', c: 'center' })[showText.origin[0]]
            };
          } else if (showText.origin[1] === 'b') {
            // Vertically at the bottom: this also needs flexbox
            alignCss = {
              display: 'flex', flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: ({ l: 'flex-start', r: 'flex-end', c: 'center' })[showText.origin[0]]
            };
          }
        }
        
        // Note that if height for vertical centering is `null` there's
        // no need to apply a line-height: the element's height will
        // conform to the text, making it centered by default.
        if ((!!w) !== (!!h)) throw Error('ShowText mixes set and unset extents');
        
        let zoneCss = {};
        zoneCss.main = {
          ...((w && h) ? { boxSizing: 'border-box' } : {}),
          ...alignCss,
          ...(showText.padL.amt ? { paddingLeft: showText.padL } : {}),
          ...(showText.padR.amt ? { paddingRight: showText.padR } : {}),
          ...(showText.padT.amt ? { paddingTop: showText.padT } : {}),
          ...(showText.padB.amt ? { paddingBottom: showText.padB } : {}),
          whiteSpace: showText.multiLine ? 'pre-wrap' : 'pre',
          pointerEvents: 'auto',
          textOverflow: 'ellipsis'
        };
        
        if (!showText.interactive) zoneCss.before = {
          // We want '\200B' to appear in css
          content: `'\\200B'`
        };
        
        return zoneCss;
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
          ? { main: { overflow: 'auto hidden', ...cssTech.vAlignPar, textAlign: (linearSlots.dir === '+') ? 'left' : 'right' }, before: cssTech.vAlignBefore }
          // Y-axis alignment is easy
          : { main: { overflow: 'hidden auto' } };
      });
      zoneCss.set(real.LinearItem, (linearItem, layout, ...trail) => ({
        // X-axis needs child vertical-alignment; Y-axis must not be absolute
        main: (linearItem.par.axis === 'x') ? cssTech.vAlignChild : { position: 'relative' }
      }));
      zoneCss.set(real.CenteredSlot, (centeredSlot, layout, ...trail) => ({
        main: { ...cssTech.vAlignPar, textAlign: 'center' },
        before: cssTech.vAlignBefore
      }));
      zoneCss.set(real.CenteredItem, (centeredItem, layout, ...trail) => ({
        main: cssTech.vAlignChild
      }));
      zoneCss.set(real.TextFlowSlots, (textFlowSlots, layout, ...trail) => ({
        // TODO: Include `textFlowSlots.origin`, and apply origin here?
        main: { whiteSpace: 'pre', overflow: 'hidden auto', textAlign: 'left' }
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
              dom.setAttribute('disabled', '');
              return dom;
            }
          : () => {
              let dom = document.createElement('input');
              dom.setAttribute('type', 'text');
              dom.setAttribute('disabled', '');
              return dom;
            }
      });
      
      runTimeUixFunc.set(real.ShowText, (showText, layout, ...trail) => {
        
        if (showText.interactive) {
          return real => {
            if (real.tellWob) throw Error(`Conflicting runTimeUix "tellWob" on ${real.layout.name}`);
            if (real.setText) throw Error(`Conflicting runTimeUix "setText" on ${real.layout.name}`);
            let dom = real.realized;
            let tellWob = U.WobVal('');
            real.tellWob = () => (dom.removeAttribute('disabled'), tellWob);
            real.setText = text => {
              if (!U.isType(text, String)) throw Error('Non-string "text" param');
              if (dom.value !== text) tellWob.wobble(dom.value = text);
            };
            dom.addEventListener('input', () => tellWob.wobble(dom.value));
          };
        } else {
          return real => {
            if (real.setText) throw Error(`Conflicting runTimeUix "setText" on ${real.layout.name}`);
            real.setText = text => real.realized.textContent = text;
          };
        };
        
      });
      runTimeUixFunc.set(real.TextFlowItem, (textFlowItem, layout, ...trail) => {
        return real => {
          real.setText = text => real.realized.textContent = text;
        };
      });
      
      let cssAspects = { zoneCss, domElemFunc, runTimeUixFunc };
      return (type, layoutCmp, layout, trail) => {
        if (!cssAspects.has(type)) throw Error('Invalid type');
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
          contentMode: type => ({ overflow: ({ window: 'hidden', free: 'visible' })[type] }),
          text: v => { return { /* tricky! need to set javascript on the element */ }; },
          border: ({ type='in', ext, colour }) => {
            return { boxShadow: `${type === 'in' ? 'inset ' : ''}0 0 0 ${getUnitCss(ext)} ${colour}` }
          }
        };
        
        let zoneDecals = { main: decals };
        if (decals.has('focus')) { zoneDecals.focus = decals.focus; delete decals.focus; }
        if (decals.has('hover')) { zoneDecals.hover = decals.hover; delete decals.hover; }
        if (decals.has('disabled')) { zoneDecals.disabled = decals.disabled; delete decals.disabled; }
        
        // Zones are the same between css and Decals... for now
        let zoneCss = zoneDecals.map((decals, zone) => {
          
          let css = {};
          decals.forEach((decVal, decKey) => {
            
            if (!mapping.has(decKey)) throw Error(`Invalid decal name: "${decKey}"`);
            let m = mapping[decKey];
            
            if (U.isType(m, Function)) m = m(decVal); // Resolve Function if necessary
            if (U.isType(m, String)) m = { [m]: decVal }; // Resolve String if necessary
            m.forEach((cssVal, cssKey) => {
              if (css.has(cssKey)) throw Error(`Calculated conflicting css "${cssKey}" properties (from "${decVal}" Decal)`);
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
              if (!real.unitsEq(cssVal, cssVal0)) throw Error(`Conflicting css props in zone "${zone}" for prop "${cssKey}"`);
              
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
            
            let layoutCmps = this.getLayoutCmps(layout, ...trail);
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
            });
            
            // The overall purpose here is to populate `cssRules`
            if (!zoneCss.isEmpty()) cssRules.push({ nameChain, zoneCss });
          
          } catch(err) {
            err.message = `Failed css for [${nameChain.join('.')}]: ${err.message}`;
            throw err;
          }
          
        });
        
        cssRules = [
          { selector: 'html, body', zoneCss: {
            main: {
              position: 'absolute',
              left: '0', top: '0', width: '100%', height: '100%',
              margin: '0', padding: '0',
              fontFamily: 'monospace',
              overflow: 'hidden',
              pointerEvents: 'none'
            }
          }},
          { selector: 'body', zoneCss: { main: { opacity: '0', transition: 'opacity 600ms linear' } }},
          { selector: 'body.loaded', zoneCss: { main: { opacity: '1' } }},
          { selector: ':focus', zoneCss: {
            main: {
              boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.5)'
            }
          }},
          { selector: 'textarea, input', zoneCss: {
            main: {
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              boxShadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.5)'
            }
          }},
          { selector: 'textarea', zoneCss: {
            main: {
              resize: 'none'
            }
          }},
          ...cssRules
        ];
        
        let cmpCssText = cssRules.map(cssRule => {
          
          if (U.isType(cssRule, String)) return cssRule;
          
          let { nameChain=null, selector=null, zoneCss } = cssRule;
          
          if (selector === null) selector = [ ...nameChain.map(v => `.${v}`) ].join(' > ');
          
          return zoneCss.toArr((css, zone) => {
            
            let zoneSelector = selector;
            
            if (zone === 'main') { // Main css - do nothing!
            } else if ([ 'focus', 'hover', 'disabled' ].has(zone)) {  // Pseudo-selector
              zoneSelector = `${selector}:${zone}`;
            } else if ([ 'before', 'after' ].has(zone)) { // Pseudo-element
              zoneSelector = `${selector}::${zone}`;
            } else {
              throw Error(`Unexpected css zone: ${zone}`);
            }
            
            return [
              `${zoneSelector} {`,
              ...css.toArr((v, k) => v ? `  ${camelToKebab(k)}: ${U.isType(v, String) ? v : getUnitCss(v)};` : C.skip),
              '}'
            ].join('\n'); // Join together all lines of a CssBlock
            
          }).join('\n');  // Join together all Zones of a ZonedCssBlock
          
        }).join('\n');  // Join together all ZonedCssBlocks of a CssStyleSheet
        
        return cmpCssText;
        
      },
      prepareAboveLands: async function(lands) {
        
        let styleSaved = await foundation.getSavedFromData([ 'realHtmlCssMainStyles.css' ], this.genCss());
        let iconSaved = foundation.getSaved([ 'setup', 'favicon.ico' ]);
        
        lands.comNozz('getInit').route(async ({ absConn, hut, msg, reply }) => {
          
          // NOTE: Need to reset and gen initial Tell before *any* async
          // behaviour - otherwise a Tell may occur between the start of
          // this function and the point where `hut.resetSyncState` is
          // finally called. This intermediate Tell could have version 0
          // and this would conflict with the initial sync included in
          // the html <script>, which *always* has version set to 0
          
          // NOTE: Tells may be requested during async portions here but
          // these will have the correct version. It is upon the client
          // to ensure that they don't process these intermediate tells
          // (which would have non-zero version) before receiving the
          // initial html. It's unlikely that clients would ever even do
          // this, as it would require them to have initiated Conns
          // (banked http polls, connected sokts, etc.) *before* running
          // the js embedded in the html
          
          hut.resetSyncState(); // The FarHut starts from scratch
          let initSyncTell = hut.genSyncTell();
          
          let baseParams = { [absConn.isSpoofed ? 'spoof' : 'cpuId']: absConn.cpuId };
          let urlFn = p => {
            return '?' + ({ ...baseParams, ...p, reply: '1' }).toArr((v, k) => `${k}=${v}`).join('&');
          };
          
          let doc = XmlElement(null, 'root');
          
          let doctype = doc.add(XmlElement('!DOCTYPE', 'singleton'));
          doctype.setProp('html');
          
          let html = doc.add(XmlElement('html', 'container'));
          
          let head = html.add(XmlElement('head', 'container'));
          let title = head.add(XmlElement('title', 'text', `${foundation.hut.upper()}`));
          
          let favicon = head.add(XmlElement('link', 'singleton'));
          favicon.setProp('rel', 'shortcut icon');
          favicon.setProp('type', 'image/x-icon');
          favicon.setProp('href', urlFn({ command: 'realHtmlCssGetFavicon' }));
          
          let css = head.add(XmlElement('link', 'singleton'));
          css.setProp('rel', 'stylesheet');
          css.setProp('type', 'text/css');
          css.setProp('href', urlFn({ command: 'realHtmlCssGetStylesheet' }));
          
          // Make a `global` value available to browsers
          let setupScript = head.add(XmlElement('script', 'text'));
          setupScript.setProp('type', 'text/javascript');
          setupScript.setText('window.global = window;');
          
          let mainScript = head.add(XmlElement('script', 'text'));
          
          // TODO: Namespacing issue here (e.g. a room named "foundation" clobbers the "foundation.js" file)
          // TODO: Could memoize the static portion of the script
          let roomNames = foundation.getOrderedRoomNames();
          let files = {
            clearing: [ 'setup', 'clearing' ],
            foundation: [ 'setup', 'foundation' ],
            foundationBrowser: [ 'setup', 'foundationBrowser' ],
            ...roomNames.toObj(rn => [ rn, [ 'room', rn, 'below' ] ]) // Note that "below" might need to be "between" in some cases
          };
          
          // "scriptOffset" is count of html lines preceeding javascript
          let debugLineData = { scriptOffset: 8,  rooms: {} };
          let fileSourceData = await Promise.allObj(files.map(v => foundation.getJsSource(...v)));
          let scriptTextItems = [];
          let totalLineCount = 0;
          fileSourceData.forEach(({ content, offsets, cmpNumLines }, roomName) => {
            scriptTextItems.push(`// ==== File: ${roomName} (line count: ${cmpNumLines})`); totalLineCount += 1;
            debugLineData.rooms[roomName] = { offsetWithinScript: totalLineCount, offsets };
            scriptTextItems.push(content); totalLineCount += cmpNumLines;
            scriptTextItems.push(''); totalLineCount += 1;
          });
          
          let raiseArgs = [];
          raiseArgs.push(`settle: '${foundation.hut}.below'`);
          if (foundation.raiseArgs.has('hutHosting')) raiseArgs.push(`hutHosting: '${foundation.raiseArgs.hutHosting}'`);
          if (foundation.raiseArgs.has('ssl')) raiseArgs.push(`ssl: '${foundation.raiseArgs.ssl}'`);
          
          let scriptContent = scriptTextItems.join('\n') + '\n\n' + [
            '// ==== File: hut.js (line count: 8)',
            `U.cpuId = '${absConn.cpuId}';`,
            `U.hutTerm = '${hut.getTerm()}';`,
            `U.aboveMsAtResponseTime = ${foundation.getMs()};`,
            `U.initData = ${JSON.stringify(initSyncTell)};`,
            `U.debugLineData = ${JSON.stringify(debugLineData)};`,
            'let { FoundationBrowser } = U.setup;',
            `let foundation = FoundationBrowser();`,
            `foundation.raise({ ${raiseArgs.join(', ')} });`
          ].join('\n');
          
          mainScript.setProp('type', 'text/javascript');
          mainScript.setText(scriptContent);
          
          let mainStyle = head.add(XmlElement('style', 'text'));
          mainStyle.setProp('type', 'text/css');
          mainStyle.setText('html { background-color: #eaeaf2; }');
          
          let body = html.add(XmlElement('body', 'container'));
          
          reply(doc.toString());
          
        });
        lands.comNozz('realHtmlCssGetFavicon').route(({ absConn, hut, msg, reply }) => U.safe(() => reply(iconSaved), reply));
        lands.comNozz('realHtmlCssGetStylesheet').route(({ reply }) => U.safe(() => reply(styleSaved), reply));
        lands.comNozz('realHtmlCssGetQuadTest').route(({ reply }) => reply([
          '<!DOCTYPE html>',
          '<html>',
          '  <head>',
          '    <title>Quad Test</title>',
          '  </head>',
          '  <body>',
          ...[ 'jim', 'bob', 'sal', 'fae' ].map(n => `    <iframe id="${n}Frame" width="400" height="400" src="?spoof=${n}"></iframe>`),
          '  </body>',
          '</html>'
        ].join('\n')));
        
      },
      
      /// =ABOVE}
      
      getRealCls: function() { return HtmlCssReal; },
      initReal0: function(real, layout, trail) {
        // Create dom element and add class for `layout.name`
        let cmps = this.getLayoutCmps(layout, ...trail);
        let makeDomElems = cmps.map(cmp => getCssAspect('domElemFunc', cmp, layout, trail) || C.skip);
        if (makeDomElems.length > 1) throw Error('Conflicting domElemFuncs');
        
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
        updStyle(dom, 'pointerEvents', 'none');
        let { death: { ms, fn } } = childReal.dyn || { death: { ms: 0, fn: null } };
        if (ms > 0) {
          if (fn) fn(childReal, ms);
          setTimeout(() => dom.parentNode.removeChild(dom), ms);
        } else {
          dom.parentNode.removeChild(dom);
        }
      },
      initFeel: function(real) {
        let dom = real.realized;
        
        let mouseDnFn = evt => {
          customEvent(evt);
          
          let drop = real.sense.feel.feelDrop = Drop();
          real.sense.feel.drip(drop);
          
          let mouseUpFn = evt => {
            customEvent(evt);
            dom.removeEventListener('mouseup', mouseUpFn, true);
            drop.dry();
          };
          dom.addEventListener('mouseup', mouseUpFn, true);
        };
        dom.addEventListener('mousedown', mouseDnFn, true);
        
        // TODO: If bringing back in key-activation of feelable Reals,
        // make sure that the same Real can't be felt simultaneously
        // with mouse and keyboard!
        
        // TODO: Do we need to concern ourselves with drying the Feel
        // Drop if the Real dries mid-feel? Or is it the responsibility
        // of the user to design code that clears up Feel routes when
        // the Real being felt dries up??
        
        dom.setAttribute('tabIndex', '0');
        updStyle(dom, 'pointerEvents', 'auto');
        updStyle(dom, 'cursor', 'pointer');
      }
    })});
    let HtmlCssReal = U.inspire({ name: 'HtmlCssReal', insps: real.slice('Real'), methods: (insp, Insp) => ({
      init: function(...args) {
        insp.Real.init.call(this, ...args);
        this.dyn = null;
      },
      
      initDynamic: function() {
        if (!this.dyn) {
          this.dyn = {
            size: null,
            loc: null,
            death: { ms: 0, fn: null },
            transition: Map(),
            transform: { scale: null, rotate: null }
          };
        }
        
        return this.dyn;
      },
      
      setTransition: function(props, ms, type='steady', delay=0) {
        let { transition } = this.initDynamic();
        if (!ms) return props.forEach(p => transition.rem(p));
        props.forEach(p => transition.set(p, [ ms, type, delay ]));
        this.updateTransition();
      },
      
      setDeathTransition: function(ms, fn) { this.initDynamic; this.dyn.death = { ms, fn }; },
      setSize: function(w, h) { this.initDynamic(); this.dyn.size = [ w, h ]; this.updateLayout(); },
      setLoc: function(x, y) { this.initDynamic(); this.dyn.loc = [ x, y ]; this.updateLayout(); },
      setLayout: function(w, h, x, y) { this.initDynamic(); this.dyn.gain({ size: [ w, h ], loc: [ x, y ] }); this.updateLayout(); },
      setImage: function(file) {
        if (file) {
          updStyle(this.realized, 'backgroundImage', `url('${file.getUrl()}')`) ;
          updStyle(this.realized, 'backgroundSize', 'contain'); 
        } else {
          updStyle(this.realized, 'backgroundImage', null);
          updStyle(this.realized, 'backgroundSize', null);
        }
      },
      setRoundness: function(amt) {
        updStyle(this.realized, 'borderRadius', amt ? `${tinyRound(amt * 100)}%` : null);
      },
      setBorder: function(ext, colour) {
        updStyle(this.realized, 'boxShadow', ext.amt ? `inset 0 0 0 ${getUnitCss(ext)} ${colour}` : null);
      },
      setColour: function(colour=null) {
        updStyle(this.realized, 'backgroundColor', colour);
      },
      setOpacity: function(amt) { updStyle(this.realized, 'opacity', amt.toString()); },
      setScale: function(w, h=w) { this.initDynamic(); this.dyn.transform.scale = { w, h }; this.updateTransform(); },
      setRotate: function(amt) { this.initDynamic(); this.dyn.transform.rotate = amt; this.updateTransform(); },
      
      updateLayout: function() {
        let dom = this.realized;
        let { size, loc } = this.dyn;
        
        updStyle(dom, 'position', 'absolute');
        updStyle(dom, 'width', size && size[0] && getUnitCss(size[0]));
        updStyle(dom, 'height', size && size[1] && getUnitCss(size[1]));
        
        if (loc) {
          let [ w, h ] = size || dom.getBoundingClientRect().slice('width', 'height').toArr(UnitPx);
          updStyle(dom, 'left', getUnitCss(CalcAdd(loc[0] || UnitPx(0), w.mult(-0.5))));
          updStyle(dom, 'top', getUnitCss(CalcAdd(loc[1] || UnitPx(0), h.mult(-0.5))));
        } else {
          [ 'left', 'top' ].forEach(p => updStyle(dom, p, null));
        }
      },
      updateTransform: function() {
        let { transform } = this.dyn;
        
        let items = [];
        let { w, h } = transform.scale || { w: 1, h: 1 };
        if (w !== 1 || h !== 1) items.push(`scale(${tinyRound(w)}, ${tinyRound(h)})`)
        
        let rot = transform.rotate || 0;
        if (rot) items.push(`rotate(${tinyRound(rot * 360)}deg)`);
        
        updStyle(this.realized, 'transform', items.length ? items.join(' ') : null);
      },
      updateTransition: function() {
        let dom = this.realized;
        let { transition } = this.dyn;
        if (transition.isEmpty()) return updStyle(dom, 'transition', null);
        
        let mapTrnProps = {
          x: 'left', y: 'top', w: 'width', h: 'size',
          opacity: 'opacity',
          rotate: 'transform',
          scale: 'transform'
        };
        let mapTrnTypes = { smooth: 'ease-in-out', steady: 'linear' };
        updStyle(dom, 'transition', transition.toArr(([ ms, type, delay ], p) => {
          return `${mapTrnProps[p]} ${ms}ms ${mapTrnTypes[type]} ${delay}ms`;
        }).join(', '));
        
      }
      
    })});
    
    return { Reality };
    
  }
});
