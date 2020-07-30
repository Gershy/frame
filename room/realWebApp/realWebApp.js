global.rooms.realWebApp = async foundation => {
  
  let real = await foundation.getRoom('real');

  // RANT ABOUT "MACRO" CSS DECLARATIONS
  // "absolute" and "relative" are awkwardly compound statements; each
  // specifies multiple things. No convenient in-between, like
  // "feature A of absolute with feature B of relative". Feature A and
  // feature B should be directly accessible css directives. This
  // occurs not only with "position", but also other attributes. Could
  // consider extending "ZoneCss" to not only include zones, but also
  // allow non-css, "atomic" properties (like feature A, feature B).
  // This would resolve the sort of issue which occurs when one layout
  // needs relative and the other needs absolute - in such cases
  // conflicts most likely don't need to occur; they're just a result
  // of how "multidimensional" "position" is
  // NOTE RELATIVE:
  // "relative" enables z-index, origin for children, etc.
  // "relative" says "flow acknowledges parent and siblings"
  // "relative" says "default W: parent W"
  // "relative" says "default H: inner-content H"
  // COMPARE THIS TO ABSOLUTE:
  // "absolute" enables z-index, origin for children, etc.
  // "absolute" says "flow acknowledges parent *only*"
  // "absolute" says "default W: inner-content W"
  // "absolute" says "default H: inner-content H"
  // NOTE:
  // Imagine if an item is set "relative" simply to enable it as
  // an origin for its children, but another Layout needs
  // "absolute" in order to ignore siblings in flow - this is NOT
  // a conflict; the fact that both "relative" and "absolute" have
  // been requested is not an indication that the overall Layout
  // is flawed!!
  
  // TODO: Would be cool if patterns to the compiler could be
  // dynamically defined on a per-file basis. So for example here,
  // we could ask the compiler to, when compiling Below, not only
  // ignore everything marked {ABO/VE= ... =ABO/VE}, but also a regex
  // like /zoneCss.set\(/. Would be especially nifty if the compiler
  // counted indentation, and determines the ignored block has
  // completed after indentation returns to where it started!
  
  let { Art, FixedSize, FillParent, CenteredSlotter, LinearSlotter, AxisSlotter, MinExtSlotter, TextSized } = real;
  let { UnitPx, UnitPc, ViewPortMin, CalcAdd, Real } = real;
    
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
    setText: function(text) { this.text = text.trim(); },
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
  
  let WebApp = U.inspire({ name: 'WebApp', methods: (insp, Insp) => ({
    
    init: function(name='chess2') { this.name = name; },
    decorateHut: async function(parHut, rootReal) {
      
      /// {ABOVE=
      
      let keepFs = foundation.getKeep('fileSystem');
      let keepIcon = keepFs.to([ 'setup', 'favicon.ico' ]);
      let keepCss = keepFs.to([ 'mill', 'storage', 'realWebApp', 'mainStyles.css' ]);
      await keepCss.setContent(this.genCss(rootReal));
      
      parHut.roadNozz('syncInit').route(async ({ road, srcHut, msg, reply }) => {
        
        // The AfarHut immediately has its state reset, requiring a
        // full sync to update. Then this full sync is consumed here,
        // to be included within the html response (the initial html
        // and sync data will arrive at precisely the same time!)
        srcHut.resetSyncState();
        let initSyncTell = srcHut.consumePendingSync();
        
        let baseParams = { [road.isSpoofed ? 'spoof' : 'hutId']: srcHut.uid };
        let urlFn = (customParams={}, params={ ...baseParams, ...customParams, reply: '1' }) => {
          return '?' + params.toArr((v, k) => `${k}=${v}`).join('&');
        };
        
        let foundationArgs = { ...foundation.origArgs };
        console.log('FOUNDATION ARGS:', foundationArgs);
        reply(U.multiLineString(`
          <!doctype html>
          <html>
            <head>
              <title>HUT</title>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <link rel="shortcut icon" type="image/x-icon" href="${urlFn({ command: 'html.favicon' })}" />
              <link rel="stylesheet" type="text/css" href="${urlFn({ command: 'html.stylesheet' })}" />
              <script type="text/javascript">window.global = window;</script>
              <script type="text/javascript">global.roomDebug = {};</script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'clearing' })}"></script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundation' })}"></script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundationBrowser' })}"></script>
              <script type="text/javascript">
                global.domAvailable = Promise(r => window.addEventListener('DOMContentLoaded', r));
                U.hutId = '${srcHut.uid}';
                U.aboveMsAtResponseTime = ${foundation.getMs()};
                U.initData = ${JSON.stringify(initSyncTell)};
                let foundation = global.foundation = U.setup.FoundationBrowser(${JSON.stringify(foundationArgs)});
                foundation.getRoom('chess2', 'below')
                  .then(room => room.open(foundation))
                  .catch(err => {
                    console.log('FATAL ERROR:', foundation.formatError(err));
                    debugger;
                  });
              </script>
            </head>
            <body>
            </body>
          </html>
        `));
        
      });
      parHut.roadNozz('html.favicon').route(({ road, reply }) => U.safe(() => reply(keepIcon), reply));
      parHut.roadNozz('html.stylesheet').route(({ reply }) => U.safe(async () => reply(keepCss), reply));
      parHut.roadNozz('html.room').route(async ({ road, srcHut, msg, reply }) => {
        
        let pcs = (msg.type === 'room')
          ? [ 'room', msg.room, `${msg.room}.js` ]
          : [ 'setup', `${msg.room}.js` ];
        
        let srcContent = await foundation.getKeep('fileSystem', pcs).getContent('utf8');
        let { lines, offsets } = foundation.compileContent('below', srcContent);
        
        reply([
          ...lines,
          `global.roomDebug.${msg.room} = ${JSON.stringify({ offsets })};`
        ].join('\n'));
        
      });
      
      /// =ABOVE} {BELOW=
      
      await global.domAvailable;
      
      let bodyContent = document.body.innerHTML;
      let trimContent = bodyContent.trim();
      if (bodyContent !== trimContent) document.body.innerHTML = trimContent;
      document.body.innerHTML = document.body.innerHTML.trim();
      
      let webAppReal = rootReal.techReals[0]; // TODO: Assumes only a single Real exists for WebApps (may not be the case!)
      webAppReal.tech = this;
      webAppReal.techNode = document.body;
      
      /// =BELOW}
      
    },
    
    getClsMappedItems: function(clsMap, parDef, parSm, kidDef, kidSm, defInserts, dbg=false) {
      
      // "sm" is "slottingMode"
      
      // Here in realWebApp many choices are resolved depending on the
      // Size and Slot for a Real somewhere in a chain. In all these
      // cases, one of the Size and Slot need to be `null`, or the
      // Size and Slot need to map to the exact same item (for if they
      // mapped to different items, there would be a conflict!). This
      // function conveniently provides this functionality.
      
      // TODO: Need to know which SlottingMode is in use. An issue is
      // multiple redundant instantiations: if we only pass the NAME
      // of the SlottingMode, we'd need to call the function under
      // that name EACH TIME we become interested in a Layout item
      // within the chain...
      // We need something like a "ResolvedChain" (which sounds SICK)
      
      // TODO: `sm` is `defReal`'s SlottingMode - the one it will be
      // using to insert children. But in order to know all potential
      // Layouts being used to determine the ClassMapped item, we also
      // need *the SlottingMode used to insert `defReal`*!! This means
      // we need `parSlottingMode` AND `kidSlottingMode`...
      
      try {
        
        let insertKey = `${parDef ? parDef.name : '*'}->${kidDef.name}`;
        if (!defInserts.has(insertKey)) insertKey = `*->${kidDef.name}`;
        if (!defInserts.has(insertKey)) throw Error(`Invalid insertion: ${insertKey}`);
        
        let { modeSlotFns } = defInserts[insertKey];
        let layouts = [];
        
        // Layouts Step 1: Add Kid's layouts
        if (kidDef.layouts) layouts.gain(kidDef.layouts);
        
        // Layouts Step 2: Add Kid's active Slotter
        let kidSlotter = kidDef.modeSlotters[kidSm] && kidDef.modeSlotters[kidSm]();
        if (kidSlotter) layouts.gain([ kidSlotter ]);
        
        // Layouts Step 3: (trickiest) Add all Layouts for the Insertion
        let insertion = defInserts[insertKey];  // Get the Insertion
        let { modeSlotFns: msfs } = insertion;  // The SlotFns of the Insertion
        let slotFn = msfs.has(parSm) && msfs[parSm];
        if (slotFn) { // No SlotFn needs to exist for `parSm`!
          // Earlier we got the Kid's Slotter - now get the ParSlotter
          // since it's a parameter to the SlotFn
          let parSlotterFn = parDef && parDef.modeSlotters[parSm];
          let parSlotter = parSlotterFn && parSlotterFn();
          let insertLayouts = slotFn(parSlotter);
          
          // Ensure that `layouts` is an Array
          if (!U.isType(insertLayouts, Array)) insertLayouts = insertLayouts ? [ insertLayouts ] : null;
          layouts.gain(insertLayouts);
        }
        
        layouts = layouts.map(v => v || C.skip); // Filter out any null Layouts
        
        if (dbg) console.log(`CLSMAP FOR ${kidDef.name}:`, layouts.map(U.nameOf));
        
        // Return all results. In some cases multiple results indicates
        // a conflict, but we'll let the more specific code handle that!
        return layouts.map(layout => {
          let result = clsMap.get(layout.constructor);
          return result ? [ layout, result ] : C.skip;
        });
        
      } catch(err) {
        
        throw Error(`Error in Layout: ${parDef ? parDef.name : '*'}:${parSm} -> ${kidDef.name}:${kidSm} (${err.message})`);
        
      }
      
    },
    domGetElem: function(slottingMode, chain, defInserts) {
      
      let [ { parReal, defReal, defInsert }, ...parChain ] = chain;
      
      let domGettersByCls = Map();
      domGettersByCls.set(TextSized, textSized => {
        
        // Modes are Flat/Interactive, SingleLine/MultiLine
        let mode = `${textSized.interactive ? 'i' : 'f'}${textSized.multiLine ? 'm' : 's'}`;
        let elem = ({
          fs: () => {
            return document.createElement('div');
          },
          fm: () => {
            return document.createElement('div');
          },
          is: () => {
            let elem = document.createElement('input');
            elem.setAttribute('type', 'text');
            if (textSized.desc) elem.setAttribute('placeholder', textSized.desc);
            return elem;
          },
          im: () => {
            let elem = document.createElement('textarea');
            if (textSized.desc) elem.setAttribute('placeholder', textSized.desc);
            return elem;
          }
        })[mode]();
        
        return elem;
        
      });
      domGettersByCls.set(Art, art => {
        let canvas = document.createElement('canvas');
        canvas.setAttribute('tabIndex', '0');
        canvas.setAttribute('width', `${art.pixelCount ? art.pixelCount[0] : 500}`);
        canvas.setAttribute('height', `${art.pixelCount ? art.pixelCount[1] : 500}`);
        return canvas;
      });
      
      let args = [ parChain.length && parChain[0].defReal, 'main', defReal, 'main' ];
      let [ domGetter=null, ...conflicts ] = this.getClsMappedItems(domGettersByCls, ...args, defInserts);
      if (!conflicts.isEmpty()) throw Error(`domGetElem conflict`);
      
      if (!domGetter) return document.createElement('div');
      
      let [ instance, fn ] = domGetter;
      return fn(instance);
      
    },
    domGetUixFns: function(slottingMode, chain, defInserts) {
      
      // TODO: Need both `parSm` and `kidSm`!!!
      
      let [ { parReal, defReal, defInsert }, ...parChain ] = chain;
      
      // Note: Why separate `domGetElem` and `domGetUixFns`? In case
      // html is pre-existing! In that case we want only to apply the
      // uix, and do no dom element creation!
      let uixGettersByCls = Map();
      uixGettersByCls.set(Art, (art, real, canvasDom) => {
        
        let scalePxW = 1;
        let scalePxH = 1;
        let canvasW = canvasDom.width; // Only an initial value; later will reflect the client rect width of canvas
        let canvasH = canvasDom.height; // Only an initial value; later will reflect the client rect height of canvas
        let ctx = canvasDom.getContext('2d');
        let pathFns = {
          jump: (x, y) => ctx.moveTo(x, -y),
          draw: (x, y) => ctx.lineTo(x, -y),
          curve: (x, y, cx1, cy1, cx2, cy2) => ctx.bezierCurveTo(cx1, -cy1, cx2, -cy2, x, y),
          arc: (x1, y1, x2, y2, x3, y3, ccw=true) => {
            
            // TODO: (x1,y1) is the most recent turtle-graphics point
            
            y1 *= -1; y2 *= -1; y3 *= -1;
            
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
            pxW: canvasDom.width, pxH: canvasDom.height,
            w: canvasW, h: canvasH,
            hw: canvasW >> 1, hh: canvasH >> 1
          }),
          initFrameCen: (col, f) => {
            real.draw.frame(() => {
              real.draw.trn(canvasDom.width >> 1, -(canvasDom.height >> 1));
              if (col) real.draw.rectCen(0, 0, canvasDom.width, canvasDom.height, { fillStyle: col });
              f();
            });
          },
          frame: f => { ctx.save(); f(); ctx.restore(); },
          rot: ang => ctx.rotate(ang),
          trn: (x, y) => ctx.translate(x, -y),
          scl: (x, y=x) => ctx.scale(x, y),
          rect: (x, y, w, h, style) => {
            for (let k in style) ctx[k] = style[k];
            if (style.fillStyle) ctx.fillRect(x, -(y + h), w, h);
            if (style.strokeStyle) ctx.strokeRect(x, -(y + h), w, h);
          },
          rectCen: (x, y, w, h, style) => {
            real.draw.rect(x - w * 0.5, y - h * 0.5, w, h, style);
          },
          circ: (x, y, r, style) => {
            ctx.beginPath();
            ctx.arc(x, -y, r, Math.PI * 2, 0);
            for (let k in style) ctx[k] = style[k];
            if (style.fillStyle) ctx.fill();
            if (style.strokeStyle) ctx.stroke();
          },
          image: (keep, x, y, w, h, alpha=1) => {
            let hw = w >> 1;
            let hh = h >> 1;
            let img = keep.getImage();
            try {
              ctx.imageSmoothingEnabled = false;
              ctx.globalAlpha = alpha;
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, -(y + h), w, h);
              ctx.globalAlpha = 1;
              ctx.imageSmoothingEnabled = true;
            } catch(err) {
              console.log('BAD IMG:', img);
            }
          },
          imageCen: (keep, x, y, w, h, alpha=1) => {
            real.draw.image(keep, x - (w >> 1), y - (h >> 1), w, h, alpha);
            // let hw = w >> 1;
            // let hh = h >> 1;
            // let img = keep.getImage();
            // try {
            //   ctx.imageSmoothingEnabled = false;
            //   ctx.globalAlpha = alpha;
            //   ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x - hw, -y - hh, w, h);
            //   ctx.globalAlpha = 1;
            //   ctx.imageSmoothingEnabled = true;
            // } catch(err) {
            //   console.log('BAD IMG:', img);
            // }
          },
          path: (style, f) => {
            ctx.beginPath(); f(pathFns); ctx.closePath();
            for (let k in style) ctx[k] = style[k];
            if (style.fillStyle) ctx.fill();
            if (style.strokeStyle) ctx.stroke();
          }
        };
        
        let keys = Set();
        real.keys = { nozz: Nozz() };
        
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
        canvasDom.addEventListener('blur', evt => {
          if (keys.isEmpty()) return;
          keys.clear();
          real.keys.nozz.drip(keys);
        });
        
        let resizeInterval = null;
        let resizeFn = () => {
          let { width, height } = canvasDom.getBoundingClientRect();
          if (width === canvasW && height === canvasH) return;
          canvasW = width; canvasH = height;
          
          if (!art.pixelCount) {
            canvasDom.width = Math.ceil(width * art.pixelDensityMult);
            canvasDom.height = Math.ceil(height * art.pixelDensityMult);
            scalePxW = canvasDom.width / (width * art.pixelDensityMult);
            scalePxH = canvasDom.height / (height * art.pixelDensityMult);
          } else {
            scalePxW = canvasDom.width / width;
            scalePxH = canvasDom.height / height;
          }
          
        };
        real.addFn = () => {
          resizeFn();
          resizeInterval = setInterval(resizeFn, 500);
          canvasDom.focus();
        };
        real.remFn = () => {
          console.log('Clearing canvas interval');
          clearInterval(resizeInterval);
        };
        
      });
      uixGettersByCls.set(TextSized, (textSized, real, textDom) => {
        
        // TODO: Sanitize string. Don't modify content if input string
        // and current string are the same. Provide
        // `real.getTextChangeNozz`; make sure it doesn't drip unless
        // the input string is different!
        
        if (textSized.interactive) {
          let textNozz = null;
          real.setText = text => {
            if (text === real.techNode.value) return;
            real.techNode.value = text;
            if (textNozz) textNozz.nozz.drip(text);
          }
          real.textNozz = () => {
            if (!textNozz) {
              textNozz = TubVal(null, Nozz());
              textNozz.nozz.drip(real.techNode.value);
            }
            return textNozz;
          }
          textDom.addEventListener('input', evt => customEvent(evt) && textNozz && textNozz.nozz.drip(real.techNode.value));
        } else {
          real.setText = str => real.techNode.textContent = str;
        }
        
      });
      
      let args = [ parChain.length ? parChain[0].defReal : null, 'main', defReal, 'main' ];
      return this.getClsMappedItems(uixGettersByCls, ...args, defInserts)
        .map(([ lay, uixFn ]) => uixFn.bind(null, lay));
    },
    domGetZoneCss: function(parDef, parSm, kidDef, kidSm, defReals, defInserts) {
      
      let zoneCssGettersByCls = Map();
      zoneCssGettersByCls.set(FillParent, fillParent => {
        return { fixed: {
          display: 'block', position: 'absolute',
          left: fillParent.shrinkL, right: fillParent.shrinkR,
          top: fillParent.shrinkT, bottom: fillParent.shrinkB
        }};
      });
      zoneCssGettersByCls.set(FixedSize, fixedSize => {
        return { fixed: {
          ...(!fixedSize.w ? {} : { width: fixedSize.w }),
          ...(!fixedSize.h ? {} : { height: fixedSize.h })
        }};
      });
      zoneCssGettersByCls.set(CenteredSlotter, centeredSlotter => ({
        fixed: { textAlign: 'center', whiteSpace: 'nowrap' },
        before: {
          content: '""', position: 'relative', display: 'inline-block',
          width: '0', height: '100%', verticalAlign: 'middle'
        }
      }));
      zoneCssGettersByCls.set(CenteredSlotter.CenteredSlot, centeredSlot => ({
        fixed: {
          position: 'relative', display: 'inline-block', verticalAlign: 'middle'
        }
      }));
      zoneCssGettersByCls.set(LinearSlotter, ({ axis, dir, scroll }) => {
        let overflow = scroll ? { overflow: axis === 'y' ? 'hidden auto' : 'auto hidden' } : {};
        return  (axis === 'y') ? { fixed: { ...overflow } } : {
          fixed: { textAlign: (dir === '+') ? 'left' : 'right', whiteSpace: 'nowrap', ...overflow },
          before: { display: 'inline-block', verticalAlign: 'middle', content: `''`, width: '0', height: '100%' }
        };
      });
      zoneCssGettersByCls.set(LinearSlotter.LinearSlot, linearSlot => {
        return { fixed: linearSlot.slotter.axis === 'y' ? { /*position: 'relative' TODO: This conflicted with a style in chess2! Need AtomicZoneCss!!! */ } :{
          display: 'inline-block', verticalAlign: 'middle'
        }};
      });
      zoneCssGettersByCls.set(AxisSlotter, axisSlotter => {
        return { fixed: { relContainer: 'yes' } };
      });
      zoneCssGettersByCls.set(AxisSlotter.AxisSlot, axisSlot => {
        
        let { axis, dir, cuts } = axisSlot.slotter;
        let { index } = axisSlot;
        
        let h = axis === 'x'; // "horizontal"
        let f = dir === '+';  // "forwards"
        
        let parW = UnitPc(1);
        let parH = UnitPc(1);
        
        let off = CalcAdd(...cuts.slice(0, index));
        let ext = (index === cuts.length)
          // For the final index subtract all cuts from the parent's full extent along "axis"
          ? CalcAdd(h ? parW : parH, ...cuts.map(u => u.mult(-1)))
          // For other indexes, the size of the indexed cut is the extent of the AxisSectionItem
          : cuts[index];
        
        let fixed = { position: 'absolute' };
        if (h) fixed.gain({ top: UnitPx(0),  height: parH, [f ? 'left' : 'right'] : off, width: ext });
        else   fixed.gain({ left: UnitPx(0), width:  parW, [f ? 'top' : 'bottom'] : off, height: ext });
        
        return { fixed };
        
      });
      zoneCssGettersByCls.set(MinExtSlotter, minExtSlotter => ({
        fixed: { textAlign: 'center', whiteSpace: 'nowrap' },
        before: {
          content: '""', position: 'relative', display: 'inline-block',
          width: '0', height: '100%', verticalAlign: 'middle'
        }
      }));
      zoneCssGettersByCls.set(MinExtSlotter.MinExtSlot, minExtSlot => ({
        fixed: {
          position: 'relative', display: 'inline-block',
          width: '100vmin', height: '100vmin', verticalAlign: 'middle'
        }
      }));
      zoneCssGettersByCls.set(Art, art => {
        return {
          fixed: { pointerEvents: 'all' },
          focus: { boxShadow: '0 0 0 10px rgba(255, 120, 0, 0.2)' }
        };
      });
      zoneCssGettersByCls.set(TextSized, textSized => {
        
        // TODO: Should calculate `w`, `h`, and `absH`!!
        let w = null;
        let h = null;
        let absH = false;
        
        let alignCss = null;
        if (textSized.interactive) {
          if (textSized.origin[1] !== 't' && textSized.multiLine) throw Error('Tricky to vertically align textarea text anywhere but top');
          alignCss = {
            textAlign: ({ l: 'left', r: 'right', c: 'center' })[textSized.origin[0]]
          };
        } else {
          if (textSized.origin[1] === 'c' && (!h || h.isAbsolute())) {
            // Vertically centered with absolute height: use line-height
            // if a height is required; otherwise leave line-height
            // unspecified (and container height will conform to text)
            alignCss = {
              textAlign: ({ l: 'left', r: 'right', c: 'center' })[textSized.origin[0]],
              ...(h ? { lineHeight: h } : {})
            };
          } else if (textSized.origin[1] === 'c' && !h.isAbsolute()) {
            // Vertically centered with relative height: use flexbox
            alignCss = {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: ({ l: 'flex-start', r: 'flex-end', c: 'center' })[textSized.origin[0]]
            };
          } else if (textSized.origin[1] === 't') {
            // Vertically at the top: this happens by default!
            alignCss = {
              textAlign: ({ l: 'left', r: 'right', c: 'center' })[textSized.origin[0]]
            };
          } else if (textSized.origin[1] === 'b') {
            // Vertically at the bottom: this also needs flexbox
            alignCss = {
              display: 'flex', flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: ({ l: 'flex-start', r: 'flex-end', c: 'center' })[textSized.origin[0]]
            };
          }
        }
        
        // Note that if height for vertical centering is `null` there's
        // no need to apply a line-height: the element's height will
        // conform to the text, making it centered by default.
        if ((!!w) !== (!!h)) throw Error('ShowText mixes set and unset extents');
        
        let zoneCss = {};
        zoneCss.fixed = {
          //...((w && h) ? { boxSizing: 'border-box' } : {}),
          ...alignCss,
          ...(textSized.padL.amt ? { paddingLeft: textSized.padL } : {}),
          ...(textSized.padR.amt ? { paddingRight: textSized.padR } : {}),
          ...(textSized.padT.amt ? { paddingTop: textSized.padT } : {}),
          ...(textSized.padB.amt ? { paddingBottom: textSized.padB } : {}),
          whiteSpace: textSized.multiLine ? 'pre-wrap' : 'pre',
          ...(textSized.embossed ? { pointerEvents: 'auto' } : {}),
          maxWidth: '100%',
          overflow: 'hidden',
          ...(textSized.multiLine ? {} : { textOverflow: 'ellipsis' }),
          fontSize: textSized.size
        };
        
        if (!textSized.interactive) zoneCss.before = {
          // We want '\200B' to appear in css
          content: `'\\200B'`
        };
        
        return zoneCss;
        
      });
      
      return this.getClsMappedItems(zoneCssGettersByCls, parDef, parSm, kidDef, kidSm, defInserts);
      
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
      if (real.addFn) real.addFn();
    },
    remTechNode: function(kidReal) {
      let { parReal } = kidReal.chain[0];
      
      updStyle(kidReal.techNode, 'pointerEvents', 'none');
      
      let { death: { ms=0, fn=null } } = kidReal.techNode.dyn || { death: {} };
      if (ms > 0) {
        if (fn) fn(kidReal, ms);
        setTimeout(() => {
          parReal.techNode.removeChild(kidReal.techNode)
          if (kidReal.remFn) kidReal.remFn();
        }, ms);
      } else {
        parReal.techNode.removeChild(kidReal.techNode);
        if (kidReal.remFn) kidReal.remFn();
      }
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
          return { /* overflow: 'hidden', */ borderRadius: `${tinyRound(amt * 100)}%` };
        },
        text: v => { return 'tricky! need to set javascript on the element'; },
        border: ({ type='in', ext, colour }) => {
          return { boxShadow: `${type === 'in' ? 'inset ' : ''}0 0 0 ${this.getUnitCss(ext)} ${colour}` }
        }
      };
      
      let zoneDecals = { fixed: decals };
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
    genSingleZoneCss: function(parDef, parSm, kidDef, kidSm, defReals, defInserts) {
      
      // CSS: Sucky
      // ZoneCss: Better structure for pseudo elements + selectors
      // AtomicZoneCss: ZoneCss, providing good fine-grained rules
      //   instead of stupid macro package-deals like "position"
      
      let zoneCss = {};
      
      // TODO: This should be `atomicZoneCssResults`
      let zoneCssResults = [
        ...this.domGetZoneCss(parDef, parSm, kidDef, kidSm, defReals, defInserts),
          //.map(([ layout, zoneCssGetter ]) => zoneCssGetter(layout)),
        [ null, () => this.decalsToZoneCss(kidDef.decals) ]
      ];
      
      // TODO: Then, with `atomicZoneCssResults`:
      // let zoneCssResults = atomicZoneCssResults.map(compileAtomicZoneCss);
      // let css = mergeZoneCss(zoneCssResults);
      // TODO: ACTUALLY, compileAtomic and merge should happen at once
      // in order to properly convert atoms into macros!!!!
      
      for (let [ layout, zoneCssGetter ] of zoneCssResults) {
        
        let zoneCssResult = zoneCssGetter(layout);
        
        for (let zoneName in zoneCssResult) {
          let zoneProps = zoneCssResult[zoneName];
          if (zoneProps.isEmpty()) continue;
          
          if (!zoneCss.has(zoneName)) zoneCss[zoneName] = {};
          
          for (let k in zoneProps) {
            
            let zoneUnitVal = this.getUnitCss(zoneProps[k]);
            
            // Note that if we aren't converting to unitCss early, this
            // `if` may think that `'0'` and `UnitPx(0)` are different
            if (zoneCss[zoneName].has(k) && zoneCss[zoneName][k].prop !== zoneUnitVal) {
              console.log('ZoneCss items to be merged:', zoneCssResults.toObj(([ layout, fn ]) => {
                return [ U.nameOf(layout), fn(layout) ];
              }));
              throw Error(`ZoneCss conflict; "${parDef && parDef.name}" -> "${kidDef.name}" in zone "${zoneName}"; property "${k}"; ${zoneCss[zoneName][k].prop} vs ${zoneUnitVal}`);
            }
            
            // TODO: Is it too early to convert to unitCss???
            zoneCss[zoneName][k] = { prop: zoneUnitVal, layout };
          }
          
        }
        
      }
      
      return zoneCss;
    },
    genCss: function(rootReal) {
      
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
        let parSlotNames = parDef ? parDef.modeSlotters.toArr((v, k) => k) : [ 'main' ];
        let kidSlotNames = kidDef.modeSlotters.toArr((v, k) => k);
        
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
          pointerEvents: 'none',
          outline: 'none !important',
        }}},
        { selector: 'body', zones: { fixed: { opacity: '0', transition: 'opacity 600ms linear', fontSize: '115%' } }},
        { selector: 'body.loaded', zones: { fixed: { opacity: '1' } }},
        { selector: ':focus', zones: { fixed: {
          boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.5)',
          outline: 'none !important'
        }}},
        { selector: 'textarea, input', zones: { fixed: {
          border: '0', outline: '0', fontFamily: 'inherit',
          boxSizing: 'border-box',
          boxShadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.2)'
        }}},
        { selector: 'textarea', zones: { fixed: {
          resize: 'none'
        }}}
      ];
      
      let cssItems = [];
      for (let zcssItem of [ ...standardZoneCss, ...dynamicZoneCss ]) {
        if (U.isType(zcssItem, String)) return cssItems.push(zcssItem);
        let { selector, zones } = zcssItem;
        
        // Normalize "atomicCss"
        // "relContainer" sets ONLY unset "position" -> relative
        for (let zoneName in zones) {
          let zone = zones[zoneName];
          if (zone.has('relContainer')) {
            if (zone.relContainer.prop === 'yes' && !zone.has('position')) zone.position = 'relative';
            delete zone.relContainer;
          }
        }
        
        // if (zcssItem.zones.has('fixed') && zcssItem.zones.fixed.has('relContainer')) {
        //   console.log('WITH RELCONTAINER:', JSON.stringify(zcssItem, null, 2));
        // }
        
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
            let layout = null;
            if (U.isType(cssValue, Object)) { layout = cssValue.layout; cssValue = cssValue.prop; }
            
            rules.push(`${camelToKebab(cssPropName)}: ${this.getUnitCss(cssValue)};`.padTail(60) + `/* Layout: ${U.nameOf(layout)} */`);
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
            ...css.toArr((v, k) => v ? `  ${camelToKebab(k)}: ${U.isType(v, String) ? v : this.getUnitCss(v)};` : C.skip),
            '}'
          ].join('\n'); // Join together all lines of a CssBlock
          
        }).join('\n');  // Join together all Zones of a ZonedCssBlock
        
      }).join('\n');  // Join together all ZonedCssBlocks of a CssStyleSheet
      
      return [ ...standardZoneCss, ...dynamicZoneCss ];
      
    },
    /// =ABOVE}
    
    // Real Dynamic Manipulation:
    getDyn: function(r) {
      if (!r.techNode.dyn) {
        r.techNode.dyn = {
          removedParent: null,
          size: null,
          loc: null,
          death: { ms: 0, fn: null },
          transition: Map(),
          transform: { scale: null, rotate: null }
        };
      }
      return r.techNode.dyn;
    },
    setExts: function(r, w, h) { let dyn = this.getDyn(r); dyn.size = [ w, h ]; this.updateLayout(r); },
    setGeom: function(r, w, h, x, y) { let dyn = this.getDyn(r); dyn.gain({ size: [ w, h ], loc: [ x, y ] }); this.updateLayout(r); },
    setLoc: function(r, x, y) { let dyn = this.getDyn(r); dyn.loc = [ x, y ]; this.updateLayout(r); },
    setRot: function(r, amt) { let dyn = this.getDyn(r); dyn.transform.rotate = amt; this.updateTransform(r); },
    setScl: function(r, w, h=w) { let dyn = this.getDyn(r); dyn.transform.scale = { w, h }; this.updateTransform(r); },
    setImage: function(r, file, { smoothing=true, scale=1 }={}) {
      if (file) {
        updStyle(r.techNode, 'backgroundImage', `url('${file.getUrl(foundation)}')`) ;
        updStyle(r.techNode, 'backgroundSize', scale === 1 ? 'contain' : `${scale * 100}%`);
        updStyle(r.techNode, 'backgroundPosition', 'center');
        updStyle(r.techNode, 'backgroundRepeat', 'no-repeat');
        updStyle(r.techNode, 'imageRendering', smoothing ? null : 'pixelated');
      } else {
        updStyle(r.techNode, 'backgroundImage', null);
        updStyle(r.techNode, 'backgroundSize', null);
        updStyle(r.techNode, 'backgroundPosition', null);
        updStyle(r.techNode, 'backgroundRepeat', null);
        updStyle(r.techNode, 'imageRendering', null);
      }
    },
    setRoundness: function(r, amt) {
      updStyle(r.techNode, 'borderRadius', amt ? `${tinyRound(amt * 100)}%` : null);
    },
    setBorder: function(r, ext, colour) {
      updStyle(r.techNode, 'boxShadow', ext.amt ? `inset 0 0 0 ${this.getUnitCss(ext)} ${colour}` : null);
    },
    setColour: function(r, colour=null) {
      updStyle(r.techNode, 'backgroundColor', colour);
    },
    setOpacity: function(r, amt) { updStyle(r.techNode, 'opacity', amt && amt.toString()); },
    setTransition: function(r, props, ms, type='steady', delay=0) {
      let { transition } = this.getDyn(r);
      if (!ms) return props.forEach(p => transition.rem(p));
      props.forEach(p => transition.set(p, [ ms, type, delay ]));
      this.updateTransition(r);
    },
    setDeathTransition: function(r, ms, fn) { let dyn = this.getDyn(r); dyn.death = { ms, fn }; },
    setTangible: function(r, isTangible) { updStyle(r.techNode, 'display', isTangible ? null : 'none'); },
    setTangible: function(r, isTangible) {
      let dyn = this.getDyn(r);
      if (isTangible && !r.techNode.parentNode) {
        
        dyn.removedParent.appendChild(r.techNode);
        dyn.removedParent = null;
        
      } else if (!isTangible && r.techNode.parentNode) {
        
        dyn.removedParent = r.techNode.parentNode;
        dyn.removedParent.removeChild(r.techNode);
        
      }
    },
    updateLayout: function(r) {
      let { size, loc } = this.getDyn(r);
      
      let dom = r.techNode;
      updStyle(dom, 'position', 'absolute');
      updStyle(dom, 'width', size && size[0] && this.getUnitCss(size[0]));
      updStyle(dom, 'height', size && size[1] && this.getUnitCss(size[1]));
      
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
    },
    
    // Real Interaction:
    feelNozz: function(r) {
      if (!r.senseNozzes.has('feel')) {
        r.senseNozzes.feel = TubVal(null, Nozz());
        r.techNode.addEventListener('mousedown', evt => {
          customEvent(evt);
          r.senseNozzes.feel.nozz.drip(Drop());
          
          let upFn = evt => {
            customEvent(evt);
            r.senseNozzes.feel.val.dry();
            r.techNode.removeEventListener('mouseup', upFn);
          };
          
          r.techNode.addEventListener('mouseup', upFn);
        });
        
        r.techNode.setAttribute('tabIndex', '0');
        updStyle(r.techNode, 'pointerEvents', 'all');
        updStyle(r.techNode, 'cursor', 'pointer');
        
      }
      return r.senseNozzes.feel;
    },
    
  })});
  
  return { WebApp };
  
  
};
