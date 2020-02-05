U.buildRoom({
  name: 'realWebApp',
  innerRooms: [ 'real' ],
  build: (foundation, real) => {
    
    // TODO: Would be cool if patterns to the compiler could be
    // dynamically defined on a per-file basis. So for example here,
    // we could ask the compiler to, when compiling Below, not only
    // ignore everything marked {ABO/VE= ... =ABO/VE}, but also a regex
    // like /zoneCss.set\(/. Would be especially nifty if the compiler
    // counted indentation, and determines the ignored block has
    // completed after indentation returns to where it started!
    
    let { Art, FillParent, MinExtSlotter, TextSized /* ... */ } = real;
    let { UnitPx, UnitPc, ViewPortMin, CalcAdd, Real, Tech } = real;
      
    let camelToKebab = camel => camel.replace(/([A-Z])/g, (m, chr) => `-${chr.lower()}`);
    let tinyRound = (val, epsilon=0.001) => {
      // If `val` is within `epsilon` distance of an integer, returns
      // that nearby integer (otherwise returns `val`).
      let round = Math.round(val);
      return (Math.abs(val - round) < epsilon) ? round : val;
    };
    let customEvent = evt => evt.stopPropagation() || evt.preventDefault() || true;
    
    /// {ABOVE=
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
    
    let WebApp = U.inspire({ name: 'WebApp', insps: { Tech }, methods: (insp, Insp) => ({
      
      // TODO: HEEERE! Just add `Tech` as a subclass. `WebApp` needs to
      // be able to add and remove Reals as dom elements, then write a
      // bunch more abstract method stubs in `Tech` (e.g. setRotate,
      // setText, setSize, etc.) and implement them under `WebApp`. Also
      // think about a way to process Layouts in a nice abstract manner!
      
      init: function() {},
      decorateHut: async function(parHut, rootReal) {
        
        /// {ABOVE=
        
        console.log('CSS:', this.genCss(parHut, rootReal));
        
        let iconSaved = foundation.getSaved([ 'setup', 'favicon.ico' ]);
        let styleSaved = await foundation.getSavedFromData([ 'realWebAppMainStyles.css' ], this.genCss(parHut, rootReal));
        
        parHut.roadNozz('syncInit').route(async ({ road, srcHut, msg, reply }) => {
          
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
          
          srcHut.resetSyncState(); // The AfarHut starts from scratch
          let initSyncTell = srcHut.consumePendingSync();
          
          let baseParams = { [road.isSpoofed ? 'spoof' : 'hutId']: srcHut.uid };
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
          favicon.setProp('href', urlFn({ command: 'realWebAppGetFavicon' }));
          
          let css = head.add(XmlElement('link', 'singleton'));
          css.setProp('rel', 'stylesheet');
          css.setProp('type', 'text/css');
          css.setProp('href', urlFn({ command: 'realWebAppGetStylesheet' }));
          
          // Make a `global` value available to browsers
          let setupScript = head.add(XmlElement('script', 'text'));
          setupScript.setProp('type', 'text/javascript');
          setupScript.setText('window.global = window;');
          
          let mainScript = head.add(XmlElement('script', 'text'));
          
          // TODO: Can we stream lines, AS THEY ARE OBTAINED, to the
          // html response? That would be really, really snazzy!
          // TODO: Namespacing issue here (e.g. a room named "foundation" clobbers the "foundation.js" file)
          // TODO: Could memoize the static portion of the script
          let roomNames = foundation.getOrderedRoomNames();
          let files = {
            clearing: [ 'setup', 'clearing' ],
            foundation: [ 'setup', 'foundation' ],
            foundationBrowser: [ 'setup', 'foundationBrowser' ],
            ...roomNames.toObj(rn => [ rn, [ 'room', rn, 'below' ] ]) // Note that "below" might need to be "between" in some cases
          };
          
          // "scriptOffset" manually counts lines preceeding javascript
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
            `U.hutId = '${srcHut.uid}';`,
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
          mainStyle.setText([
            'html, body { background-color: #ffffff; margin: 0; padding: 0; }',
            'body { position: absolute; left: 0; right: 0; top: 0; bottom: 0; }'
          ].join('\n'));
          
          let body = html.add(XmlElement('body', 'container'));
          
          reply(doc.toString());
          
        });
        parHut.roadNozz('realWebAppGetFavicon').route(({ road, reply }) => U.safe(() => reply(iconSaved), reply));
        parHut.roadNozz('realWebAppGetStylesheet').route(({ reply }) => U.safe(async () => reply(await styleSaved), reply));
        parHut.roadNozz('realWebAppGetQuadTest').route(({ reply }) => {
          
          let doc = XmlElement(null, 'root');
          
          let doctype = doc.add(XmlElement('!DOCTYPE', 'singleton'));
          doctype.setProp('html');
          
          let html = doc.add(XmlElement('html', 'container'));
          
          let title = head.add(XmlElement('title', 'text', `${foundation.hut.upper()}`));
          
          let favicon = head.add(XmlElement('link', 'singleton'));
          favicon.setProp('rel', 'shortcut icon');
          favicon.setProp('type', 'image/x-icon');
          favicon.setProp('href', urlFn({ command: 'realWebAppGetFavicon' }));
          
          let body = html.add(XmlElement('body', 'container'));
          for (let name of [ 'jim', 'bob', 'sal', 'fae' ]) {
            
            let iframe = body.add(XmlElement('iframe', 'container'));
            iframe.setProp('id', `${name}Frame`);
            iframe.setProp('width', '400');
            iframe.setProp('height', '400');
            iframe.setProp('src', `?spoof=${n}`);
            
          }
          
          reply(doc.toString());
          
        });
        
        /// =ABOVE} {BELOW=
        
        await Promise(r => window.addEventListener('load', r))
        let webAppReal = rootReal.techReals[0]; // TODO: Assumes only a single Real exists for WebApps (may not be the case!)
        webAppReal.tech = this;
        webAppReal.techNode = document.body;
        
        // No mousedown on <html> element; everyone's life improves
        document.body.parentNode.addEventListener('mousedown', customEvent);
        
        /// =BELOW}
        
      },
      
      getClsMappedItems: function(clsMap, parDef, parSm, kidDef, kidSm, defInserts, dbg=false) {
        
        // `sm` is "slottingMode"
        
        // Here in realWebApp many choices are resolved depending on the
        // Size and Slot for a Real somewhere in a chain. In all these
        // cases, one of the Size and Slot need to be `null`, or the
        // Size and Slot need to map to the exact same item (for if they
        // mapped to different items, there would be a conflict!). This
        // function conveniently provides this functionality.
        
        // TODO: Need to know which SlottingMode is in use. An issue is
        // multiple redundant instantiations: if we only pass the NAME
        // of the SlottingMode, we'd need to call the function under
        // that name EACH TIME we are interested in a Layout item within
        // the chain...
        // We need something like a "ResolvedChain" (which sounds overly
        // intensive...)
        
        // TODO: `sm` is `defReal`'s SlottingMode - the one it will be
        // using to insert children. But in order to know all potential
        // Layouts being used to determine the ClassMapped item, we also
        // need *the SlottingMode used to insert `defReal`*!! This means
        // we need `parSlottingMode` AND `kidSlottingMode`...
        
        let insertKey = `${parDef ? parDef.name : '*'}->${kidDef.name}`;
        if (!defInserts.has(insertKey)) insertKey = `*->${kidDef.name}`;
        if (!defInserts.has(insertKey)) throw Error(`Invalid insertion: ${insertKey}`);
        
        let insertSlotFns = defInserts[insertKey];
        
        let layouts = [
        
          ...kidDef.layouts,
          
          // Note: No need to check `kidDef.slotters.has(kidSm)` - we
          // assume a valid mode has been given, and the RealDef must
          // include a Slotter for every mode!
          kidDef.slotters[kidSm] && kidDef.slotters[kidSm](),
          
          // Note: We *do* need to check `insertSlotFns.has(parSm)` -
          // because an insertion does *not* need to define a SlotFn for
          // every slot available in the parent! So a SlotFn may not
          // exist for a given SlottingName
          insertSlotFns.has(parSm)
            && insertSlotFns[parSm]
            && insertSlotFns[parSm](
              parDef
              && parDef.slotters[parSm]
              && parDef.slotters[parSm]()
            )
          
        ].map(v => v || C.skip);
        
        // Return all results. In some cases multiple results indicates
        // a conflict, but we'll let the more specific code handle that!
        return layouts.map(layout => {
          let result = clsMap.get(layout.constructor);
          return result ? [ layout, result ] : C.skip;
        });
        
      },
      domGetElem: function(slottingMode, chain, defInserts) {
        
        // TODO: Need both `parSm` and `kidSm`!!!
        
        let [ { parReal, defReal, defInsert }, ...parChain ] = chain;
        
        let domGettersByCls = Map();
        domGettersByCls.set(Art, () => {
          let canvas = document.createElement('canvas');
          canvas.setAttribute('tabIndex', '0');
          canvas.setAttribute('width', '500');
          canvas.setAttribute('height', '500');
          return canvas;
        });
        
        let args = [ parChain.length && parChain[0].defReal, 'main', defReal, 'main' ];
        let [ domGetter=null, ...conflicts ] = this.getClsMappedItems(domGettersByCls, ...args, defInserts);
        if (!conflicts.isEmpty()) throw Error(`domGetElem conflict`);
        
        return domGetter ? domGetter[1]() : document.createElement('div');
        
      },
      domGetUixFns: function(slottingMode, chain, defInserts) {
        
        // TODO: Need both `parSm` and `kidSm`!!!
        
        let [ { parReal, defReal, defInsert }, ...parChain ] = chain;
        
        let uixGettersByCls = Map();
        uixGettersByCls.set(Art, (real, canvasDom) => {
          
          let ctx = canvasDom.getContext('2d');
          let pathFns = {
            jump: (x, y) => ct.moveTo(x, y),
            draw: (x, y) => ct.lineTo(x, y),
            curve: (x1, x2, cx1, cy1, cx2, cy2) => ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x1, x2),
            arc: (x1, y1, x2, y2, x3, y3, ccw=true) => {
              let dx = (x2 - x1);
              let dy = (y2 - y1);
              let r = Math.sqrt(dx * dx + dy * dy);
              let ang1 = Math.atan2(y1 - y2, x1 - x2);
              let ang2 = Math.atan2(y3 - y2, x3 - x2);
              ctx.arc(x2, y2, r, ang1, ang2, ccw);
            }
          };
          
          real.draw = {
            getDims: () => ({
              w: canvasDom.width, h: canvasDom.height,
              hw: canvasDom.width >> 1, hh: canvasDom.height >> 1
            }),
            frame: f => { ctx.save(); f(); ctx.restore(); },
            rot: ang => ctx.rotate(ang),
            trn: (x, y) => ctx.translate(x, y),
            scl: (x, y=x) => ctx.scale(x, y),
            rect: (x, y, w, h, style) => {
              for (let k in style) ctx[k] = style[k];
              if (style.fillStyle) ctx.fillRect(x, y, w, h);
              if (style.strokeStyle) ctx.strokeRect(x, y, w, h);
            },
            circ: (x, y, r, style) => {
              ctx.beginPath();
              ctx.arc(x, y, r, Math.PI * 2, 0);
              for (let k in style) ctx[k] = style[k];
              if (style.fillStyle) ctx.fill();
              if (style.strokeStyle) ctx.stroke();
            },
            path: (style, f) => {
              let jump = (x, y) => ctx.moveTo(x, y);
              let draw = (x, y) => ctx.lineTo(x, y);
              ctx.beginPath(); f(pathFns); ctx.closePath();
              for (let k in style) ctx[k] = style[k];
              if (style.fillStyle) ctx.fill();
              if (style.strokeStyle) ctx.stroke();
            }
          };
          
          let keys = Set();
          real.keys = { nozz: Nozz() };
          
          console.log(canvasDom);
          canvasDom.addEventListener('keydown', evt => {
            if (keys.has(evt.keyCode)) return;
            keys.add(evt.keyCode);
            real.keys.nozz.drip(keys);
          });
          canvasDom.addEventListener('keyup', evt => {
            if (!keys.has(evt.keyCode)) return;
            keys.rem(evt.keyCode);
            real.keys.nozz.drip(keys);
          });
          
          real.addedFn = () => canvasDom.focus();
          
        });
        uixGettersByCls.set(TextSized, (real, textDom) => {
          
          // TODO: Sanitize string. Don't modify content if input string
          // and current string are the same. Provide
          // `real.getTextChangeNozz`; make sure it doesn't drip unless
          // the input string is different!
          real.setText = str => real.textContent = str;
          
        });
        
        let args = [ parChain.length && parChain[0].defReal, 'main', defReal, 'main' ];
        return this.getClsMappedItems(uixGettersByCls, ...args, defInserts).map(([ lay, uixFn ]) => uixFn);
        
      },
      domGetZoneCss: function(parDef, parSm, kidDef, kidSm, defReals, defInserts) {
        
        // "absolute" and "relative" are awkwardly compound statements;
        // each specifies multiple things. No convenient in-between,
        // like "feature A of absolute with feature B of relative".
        // Really, feature A and feature B should be directly accessible
        // css directives. This issue probably occurs not only with
        // "position", but also other attributes. Could consider
        // extending "ZoneCss" to not only include zones, but also allow
        // non-css, "atomic" properties (like feature A and feature B).
        // This would resolve the sort of issue which occurs when one
        // layout needs relative and the other needs absolute - in such
        // cases conflicts most likely don't need to occur; they're just
        // a result of how "multidimensional" "position" is
        
        // "relative" enables z-index, origin for children, etc.
        // "relative" says "flow acknowledges parent and siblings"
        // "relative" says "default W: parent W"
        // "relative" says "default H: content H"
        
        // "absolute" enables z-index, origin for children, etc.
        // "absolute" says "flow acknowledges parent *only*"
        // "absolute" says "default W: content W"
        // "absolute" says "default H: content H"
        
        // Imagine if an item is set "relative" simply to enable it as
        // an origin for its children, but another Layout needs
        // "absolute" in order to ignore siblings in flow - this is NOT
        // a conflict; the fact that both "relative" and "absolute" have
        // been requested is not an indication that the overall Layout
        // is flawed!!
        
        let zoneCssGettersByCls = Map();
        zoneCssGettersByCls.set(FillParent, fillParent => {
          return { fixed: {
            display: 'block', position: 'absolute', // TODO: Not position->absolute, but flowRegarding->parentOnly
            left: '0', right: '0', top: '0', bottom: '0'
          }};
        });
        zoneCssGettersByCls.set(MinExtSlotter, minExtSlotter => {
          return { fixed: {} };
        });
        zoneCssGettersByCls.set(MinExtSlotter.MinExtSlot, minExtSlot => {
          return { fixed: {} };
        });
        zoneCssGettersByCls.set(Art, art => {
          return {
            fixed: { pointerEvents: 'all' },
            focus: { boxShadow: '0 0 0 4px red' }
          };
        });
        zoneCssGettersByCls.set(TextSized, textSized => {
          return { fixed: {
            display: 'block', fontSize: this.getUnitCss(textSized.size)
          }};
        });
        
        return this.getClsMappedItems(zoneCssGettersByCls, parDef, parSm, kidDef, kidSm, defInserts)
          .map(([ layout, zoneCssGetter ]) => zoneCssGetter(layout));
        
      },
      
      createTechNode: function(real) {
        let elem = this.domGetElem('main', real.chain, real.root.defInserts); // TODO: `'main'` should be CALCULATED!
        elem.classList.add(real.name.split('.').join('-'));
        
        let uixFns = this.domGetUixFns('main', real.chain, real.root.defInserts);
        for (let uixFn of uixFns) uixFn(real, elem);
        
        return elem;
      },
      addTechNode: function(real) {
        let { parReal } = real.chain[0];
        parReal.techNode.appendChild(real.techNode);
        if (real.addedFn) real.addedFn();
      },
      remTechNode: function(real) {
        let { parReal } = real.chain[0];
        parReal.techNode.removeChild(real.techNode);
      },
      
      getUnitCss: function(unit) {
        let unitCss = Map();
        unitCss.set(String, str => str);
        unitCss.set(UnitPx, unit => `${tinyRound(unit.amt)}px`);
        unitCss.set(UnitPc, unit => `${tinyRound(unit.amt * 100)}%`);
        unitCss.set(ViewPortMin, unit => `${tinyRound(unit.amt * 100)}vmin`);
        unitCss.set(CalcAdd, calc => `calc(${calc.units.map(u => this.getUnitCss(u)).join(' + ')})`);
    
        if (!unitCss.has(unit.constructor)) throw Error(`Can\'t get css for Unit: ${U.nameOf(unit)}`);
        return unitCss.get(unit.constructor)(unit);
      },
      
      /// {ABOVE=
      
      /*
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
          roundness: amt => {
            if (amt === 0) return {};
            return { overflow: 'hidden', borderRadius: `${tinyRound(amt * 100)}%` };
          },
          text: v => { return 'tricky! need to set javascript on the element'; },
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
      */
      
      genSingleZoneCss: function(parDef, parSm, kidDef, kidSm, defReals, defInserts) {
        
        // CSS: Sucky
        // ZoneCss: Better structure for pseudo elements + selectors
        // AtomicZoneCss: ZoneCss, providing good fine-grained rules
        //   instead of stupid macro package-deals like "position"
        
        let zoneCss = {};
        
        // TODO: This should be `atomicZoneCssResults`
        let zoneCssResults = this.domGetZoneCss(parDef, parSm, kidDef, kidSm, defReals, defInserts);
        
        // TODO: Then, with `atomicZoneCssResults`:
        // let zoneCssResults = atomicZoneCssResults.map(compileAtomicZoneCss);
        // let css = mergeZoneCss(zoneCssResults);
        // TODO: ACTUALLY, compileAtomic and merge should happen at once
        // in order to properly convert atoms into macros!!!!
        
        for (let zoneCssResult of zoneCssResults) {
          
          for (let zoneName in zoneCssResult) {
            let zoneProps = zoneCssResult[zoneName];
            if (zoneProps.isEmpty()) continue;
            
            if (!zoneCss.has(zoneName)) zoneCss[zoneName] = {};
            for (let k in zoneProps) {
              if (zoneCss[zoneName].has(k) && zoneCss[zoneName][k] !== zoneProps[k]) {
                console.log('ZoneCss items to be merged:', zoneCssResults);
                throw Error(`ZoneCss conflict in zone "${zoneName}"; property "${k}"`);
              }
              zoneCss[zoneName][k] = zoneProps[k];
            }
            
          }
          
        }
        
        // for (let layoutItem of layoutItems) {
        //   
        //   // Merge the css
        //   let layoutZoneCss = this.domGetZoneCss(parDef, parSm, kidDef, kidSm, defReals, defInserts);
        //   for (let zoneName in layoutZoneCss) {
        //     
        //     let propsForThisZone = zoneCss.has(zoneName)
        //       ? zoneCss[zoneName]
        //       : (zoneCss[zoneName] = {});
        //     
        //     let zoneProps = layoutZoneCss[zoneName];
        //     for (let zonePropName in zoneProps) {
        //       let zonePropVal = zoneProps[zonePropName];
        //       if (propsForThisZone.has(zonePropName) && propsForThisZone[zonePropName] !== zonePropVal) {
        //         console.log('EXISTING:', 
        //         throw Error(`Insertion ${parDef ? parDef.name : '*'}->${kidDef.name} has conflict in zone "${zoneName}", prop "${zonePropName}"`);
        //       }
        //     }
        //     
        //     for (let zonePropName in zoneProps) propsForThisZone[zonePropName] = zonePropVal;
        //     
        //   }
        //   
        // }
        return zoneCss;
      },
      genCss: function(parHut, rootReal) {
        
        let genCssSelector = (realName, sm) => {
          let modeCssClass = sm === 'main' ? '' : `.-mode-${sm}`;
          return `${modeCssClass}.${realName.replace('.', '-')}`;
        };
        
        let dynamicZoneCss = [];
        
        let { defReals, defInserts } = rootReal;
        for (let insertTerm in defInserts) {
          
          let [ parName, kidName ] = insertTerm.split('->');
          let parDef = parName === '*' ? null : defReals[parName];
          let kidDef = defReals[kidName];
          
          // Don't process Reals from another Tech
          // TODO: Would be much better if the full list of defReals and
          // defInserts was already filtered to contain only items under
          // this Tech...
          if (kidDef.tech && kidDef.tech !== this) continue;
          
          // Don't generate a "par > kid" css rule if the parent is
          // from another Tech!
          if (parDef && parDef.tech && parDef.tech !== this) continue;
          
          // NOTE: we could think of establishing slotNames by looking
          // at defInserts instead of the defReals, but this establishs
          // only a subset of the slotNames, since RealInsertions occur
          // with *any* of the parent's SlottingModes
          let parSlotNames = parDef ? parDef.slotters.toArr((v, k) => k) : [ 'main' ];
          let kidSlotNames = kidDef.slotters.toArr((v, k) => k);
          
          for (let parSm of parSlotNames) { for (let kidSm of kidSlotNames) {
            
            let selector = parName !== '*'
              ? `${genCssSelector(parName, parSm)} > ${genCssSelector(kidName, kidSm)}`
              : `${genCssSelector(kidName, kidSm)}`;
            
            dynamicZoneCss.push({
              selector,
              zones: this.genSingleZoneCss(parDef, parSm, kidDef, kidSm, defReals, defInserts)
            });
            
          }}
          
          
        }
        
        let standardZoneCss = [
          { selector: 'html, body', zones: { fixed: {
            position: 'absolute',
            left: '0', top: '0', width: '100%', height: '100%',
            margin: '0', padding: '0',
            fontFamily: 'monospace',
            overflow: 'hidden',
            pointerEvents: 'none'
          }}},
          { selector: 'body', zones: { fixed: { opacity: '0', transition: 'opacity 600ms linear' } }},
          { selector: 'body.loaded', zones: { fixed: { opacity: '1' } }},
          { selector: ':focus', zones: { fixed: {
            boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.5)'
          }}},
          { selector: 'textarea, input', zones: { fixed: {
            border: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            boxShadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.5)'
          }}},
          { selector: 'textarea', zones: { fixed: {
            resize: 'none'
          }}}
        ];
        
        let cssItems = [];
        for (let zcssItem of [ ...standardZoneCss, ...dynamicZoneCss ]) {
          if (U.isType(zcssItem, String)) return cssItems.push(zcssItem);
          
          let { selector, zones } = zcssItem;
          for (let zoneName in zones) {
            
            let zoneSelector = null
            if (zoneName === 'fixed') zoneSelector = selector;
            else if ([ 'focus', 'hover', 'disabled' ].has(zoneName)) zoneSelector = `${selector}:${zoneName}`;
            else if ([ 'before', 'after' ].has(zoneName)) zoneSelector = `${selector}::${zoneName}`;
            else { throw Error(`Invalid ZoneCss zoneName: ${zoneName}`); }
            
            let zone = zones[zoneName];
            let rules = [];
            for (let cssPropName in zone) {
              let cssValue = zone[cssPropName];
              rules.push(`${camelToKebab(cssPropName)}: ${this.getUnitCss(cssValue)};`);
            }
            
            cssItems.push([ `${zoneSelector} {`, ...rules.map(r => `  ${r}`), '}' ].join('\n'));
            
          }
        }
        
        return cssItems.join('\n');
        
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
        
        return [ ...standardZoneCss, ...dynamicZoneCss ];
        
      },
      /// =ABOVE}
      
      // Dynamic Real Manipulation
      getDyn: function(r) {
        if (!r.techNode.dyn) {
          r.techNode.dyn = {
            size: null,
            loc: null,
            death: { ms: 0, fn: null },
            transition: Map(),
            transform: { scale: null, rotate: null }
          };
        }
        return r.techNode.dyn;
      },
      setTransition: function(r, props, ms, type='steady', delay=0) {
        let { transition } = this.getDyn(r);
        if (!ms) return props.forEach(p => transition.rem(p));
        props.forEach(p => transition.set(p, [ ms, type, delay ]));
        this.updateTransition(r);
      },
      setDeathTransition: function(r, ms, fn) { let dyn = this.getDyn(r); dyn.death = { ms, fn }; },
      setSize: function(r, w, h) { let dyn = this.getDyn(r); dyn.size = [ w, h ]; this.updateLayout(r); },
      setLoc: function(r, x, y) { let dyn = this.getDyn(r); dyn.loc = [ x, y ]; this.updateLayout(r); },
      setLayout: function(r, w, h, x, y) { let dyn = this.getDyn(r); dyn.gain({ size: [ w, h ], loc: [ x, y ] }); this.updateLayout(r); },
      setImage: function(r, file) {
        if (file) {
          updStyle(r.techNode, 'backgroundImage', `url('${file.getUrl()}')`) ;
          updStyle(r.techNode, 'backgroundSize', 'contain'); 
        } else {
          updStyle(r.techNode, 'backgroundImage', null);
          updStyle(r.techNode, 'backgroundSize', null);
        }
      },
      setRoundness: function(r, amt) {
        updStyle(r.techNode, 'borderRadius', amt ? `${tinyRound(amt * 100)}%` : null);
      },
      setBorder: function(r, ext, colour) {
        updStyle(r.techNode, 'boxShadow', ext.amt ? `inset 0 0 0 ${getUnitCss(ext)} ${colour}` : null);
      },
      setColour: function(r, colour=null) {
        updStyle(r.techNode, 'backgroundColor', colour);
      },
      setOpacity: function(r, amt) { updStyle(r.techNode, 'opacity', amt.toString()); },
      setScale: function(r, w, h=w) { let dyn = this.getDyn(r); dyn.transform.scale = { w, h }; this.updateTransform(r); },
      setRotate: function(r, amt) { let dyn = this.getDyn(r); dyn.transform.rotate = amt; this.updateTransform(r); },
      updateLayout: function(r) {
        let { size, loc } = this.getDyn(r);
        
        let dom = r.techNode;
        updStyle(dom, 'position', 'absolute');
        updStyle(dom, 'width', size && size[0] && getUnitCss(size[0]));
        updStyle(dom, 'height', size && size[1] && getUnitCss(size[1]));
        
        if (loc) {
          let w=null, h=null;
          if (size) {
            [ w, h ] = size;
          } else {
            let { width, height } = dom.getBoundingClientRect();
            w = UnitPx(width); h = UnitPx(height);
          }
          
          updStyle(dom, 'left', this.getUnitCss(CalcAdd(loc[0] || UnitPx(0), w.mult(-0.5))));
          updStyle(dom, 'top', this.getUnitCss(CalcAdd(loc[1] || UnitPx(0), h.mult(-0.5))));
        } else {
          [ 'left', 'top' ].forEach(p => updStyle(dom, p, null));
        }
      },
      updateTransform: function(r) {
        let { transform } = this.getDyn(r);
        
        let items = [];
        let { w, h } = transform.scale || { w: 1, h: 1 };
        if (w !== 1 || h !== 1) items.push(`scale(${tinyRound(w)}, ${tinyRound(h)})`)
        
        let rot = transform.rotate || 0;
        if (rot) items.push(`rotate(${tinyRound(rot * 360)}deg)`);
        
        updStyle(r.techNode, 'transform', items.length ? items.join(' ') : null);
      },
      updateTransition: function(r) {
        let dom = r.techNode;
        let { transition } = this.getDyn(r);
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
    
    return { WebApp };
    
    
  }
});
