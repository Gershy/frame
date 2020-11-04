(() => {
  
  let { Tmp, TmpRefCount, Src, FnSrc, MemSrc } = U.logic;
  let { Foundation, Keep } = U.setup;
  
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    
    $KeepBrowser: U.inspire({ name: 'KeepBrowser', insps: { Keep }, methods: insp => ({
      init: function(foundation) {
        insp.Keep.init.call(this);
        let urlResourceKeep = Insp.KeepUrlResources(foundation);
        this.keepsByType = {
          static: Insp.KeepStatic(foundation, urlResourceKeep),
          urlResource: urlResourceKeep
        };
      },
      access: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepStatic: U.inspire({ name: 'KeepStatic', insps: { Keep }, methods: insp => ({
      init: function(foundation, urlResourceKeep) {
        this.foundation = foundation;
        this.urlResourceKeep = urlResourceKeep;
        this.hut = null;
      },
      setHut: function(hut) { this.hut = hut; },
      access: function(fpCmps) {
        return this.urlResourceKeep.access({ path: [ 'static', ...fpCmps ].join('/') });
      }
    })}),
    $KeepUrlResources: U.inspire({ name: 'KeepUrlResources', insps: { Keep }, methods: insp => ({
      init: function(foundation) {
        this.foundation = foundation;
        this.urlImages = {};
      },
      access: function({ path='', params={} }) { return Insp.KeepUrlResource(this, path, params); }
    })}),
    $KeepUrlResource: U.inspire({ name: 'KeepUrlResource', insps: { Keep }, methods: insp => ({
      init: function(par, path='', params={}) {
        insp.Keep.init.call(this);
        this.par = par;
        this.path = path;
        this.params = params;
      },
      getUrl: function() {
        let params = { hutId: this.par.foundation.hutId, ...this.params };
        return params.isEmpty()
          ? `/${this.path}`
          : `/${this.path}?${params.toArr((v, k) => `${k}=${v}`).join('&')}`;
      },
      getImage: function() {
        let url = this.getUrl();
        if (!this.par.urlImages.has(url)) {
          this.par.urlImages[url] = new Image();
          this.par.urlImages[url].src = url;
        }
        return this.par.urlImages[url];
      }
    })}),
    
    init: function({ hutId, isSpoofed, aboveMsAtResponseTime, ...supArgs }) {
      insp.Foundation.init.call(this, supArgs);
      
      // GOAL: delta since Above generated "aboveMsAtResponseTime"?
      // - `firstContactMs` is our earliest timing of server response
      // - `firstContactMs` is `performance.timing.responseStart`
      //   This is the time we heard the server's 1st byte
      // - Without making any assumptions: `now - firstContactMs`
      // - This estimates LESS than the real latency
      
      // Catch exceptions after building all Rooms
      let handleError = evt => { evt.preventDefault(); console.error(this.formatError(evt.error || evt.reason)); this.halt(); };
      window.addEventListener('unhandledrejection', handleError);
      window.addEventListener('error', handleError);
      
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess
      // at current value of Above's `foundation.getMs()` *right now*
      this.clockDeltaMs = nativeNow - (aboveMsAtResponseTime + knownLatencyMs);
      this.hutId = hutId;
      this.isSpoofed = isSpoofed;
      
      // Make sure that refreshes redirect to the same session
      window.history.replaceState({}, '', this.seek('keep', 'urlResource', {}).getUrl());
      
    },
    halt: function() { /* debugger */; },
    installRoom: async function(name, bearing='below') {
      
      let urlParams = { command: 'html.room', type: 'room', room: name, reply: '1' };
      let url = this.seek('keep', 'urlResource', { params: urlParams }).getUrl();
      
      let script = document.createElement('script');
      script.setAttribute('defer', '');
      script.setAttribute('async', '');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', url);
      document.head.appendChild(script);
      
      // Wait for the script to load; ensure it populated `global.rooms`
      await Promise(r => script.addEventListener('load', r));
      if (!global.rooms.has(name)) throw Error(`Room "${name}" does not set global.rooms['${name}']!`);
      
      return {
        debug: global.roomDebug[name],
        content: global.rooms[name](this)
      };
      
    },
    
    // Util
    queueTask: function(func) { Promise.resolve().then(func); },
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    getPlatformName: function() { return 'browser'; },
    
    // High level
    createHut: async function(options={}) {
      
      if (options.has('uid')) throw Error(`Don't specify "uid"!`);
      options.uid = this.hutId;
      
      if (!options.has('hosting')) options.hosting = {};
      if (options.hosting.has('host')) throw Error(`Don't specify "hosting.host"!`);
      if (options.hosting.has('port')) throw Error(`Don't specify "hosting.port"!`);
      if (options.hosting.has('sslArgs')) throw Error(`Don't specify "hosting.sslArgs"!`);
      
      let { protocol, host, port } = this.parseUrl(window.location.href);
      let { secure } = Foundation.protocols[protocol];
      options.hosting.gain({ host, port, sslArgs: { keyPair: secure, selfSign: secure } });
      
      return insp.Foundation.createHut.call(this, options);
      
    },
    createKeep: function(options={}) { return Insp.KeepBrowser(this); },
    createReal: async function() {
      
      let { Real } = U.setup;
      let primaryHtmlCssJsReal = Real({ name: 'browser.htmlCssJs' });
      primaryHtmlCssJsReal.techNode = document.body;
      primaryHtmlCssJsReal.tech = (() => {
        
        // css techniques:
        // https://css-tricks.com/almanac/properties/c/contain/
        
        let { Axis1DLayout, FreeLayout, SizedLayout, ScrollLayout, TextLayout, TextInputLayout, ImageLayout } = U.setup;
        let renderClassMap = Map();
        let getRenderClass = layout => {
          let LayoutCls = layout.constructor;
          if (!renderClassMap.has(LayoutCls)) throw Error(`Invalid render class: "${LayoutCls.name}"`);
          return renderClassMap.get(LayoutCls);
        };
        renderClassMap.set(Axis1DLayout, (layout, hCss, domNode) => {
          
          if (![ 'relative', 'absolute' ].includes(domNode.style.position)) domNode.style.position = 'relative';
          
          if ([ null, 'focus', 'distribute' ].includes(layout.cuts)) {
            
            domNode.style.display = 'flex';
            domNode.style.flexDirection = (layout.axis === 'x')
              ? (layout.flow === '+' ? 'row' : 'row-reverse')
              : (layout.flow === '+' ? 'column' : 'column-reverse');
            domNode.style.alignItems = 'center'; // 'flex-start', 'center', 'flex-end'
            
            domNode.style.justifyContent = {
              stack: 'auto',
              focus: 'center',
              distribute: 'auto'
            }[layout.cuts || 'stack']; // null -> 'stack'
            
          } else if (U.isType(layout, Array)) {
            
            // Children are sized using the specified "cuts"
            let values = [];
            
          }
          
        });
        renderClassMap.set(Axis1DLayout.Item, (layout, hCss, domNode) => {
          
          if (layout.par.cuts === null) {
            
            // Children determine their own size in the axis direction, and have 100% perp direction
            
          } else if (layout.par.cuts === 'distribute') {
            
            // Children are all the same size
            domNode.style.flexGrow = '1';
            domNode.style.flexShrink = '1';
            domNode.style.flexBasis = '0';
            domNode.style[layout.par.axis === 'x' ? 'height' : 'width'] = '100%';
            
          } else if (U.isType(layout.par.cuts, Array)) {
            
            // Children are sized using the specified "cuts"
            let cutInd = layout.params[0];
            let offCuts = layout.par.cuts.slice(0, cutInd);
            
            let off = offCuts.length ? `calc(${offCuts.join(' + ')})` : '0';
            let ext = (cutInd <= (layout.par.cuts.length - 1))
              ? layout.par.cuts[cutInd]
              : `calc(100% - ${layout.par.cuts.join(' - ')})`;
            
            domNode.style.position = 'absolute';
            
            let dir = `${layout.par.flow}${layout.par.axis}`
            if (dir === '+x') domNode.style.gain({ left: off, width: ext, height: '100%' });
            if (dir === '-x') domNode.style.gain({ right: off, width: ext, height: '100%' });
            if (dir === '+y') domNode.style.gain({ top: off, width: '100%', height: ext });
            if (dir === '-y') domNode.style.gain({ bottom: off, width: '100%', height: ext });
            
          }
          
        });
        renderClassMap.set(FreeLayout, (layout, hCss, domNode) => {
          
          // TODO: Decouple w/h from FreeLayout!! Should use SizedLayout
          // for this instead - BUT how to center a child, without
          // altering the parent, when child size is unknown??
          
          domNode.style.position = 'absolute';
          if (layout.w) domNode.style.width = layout.w;
          if (layout.h) domNode.style.height = layout.h;
          if (layout.mode === 'center') {
            domNode.style.left = `calc(50% - ${layout.w} * 0.5)`;
            domNode.style.top = `calc(50% - ${layout.h} * 0.5)`;
          } else {
            throw Error(`Unsupported mode: "${layout.mode}"`);
          }
          
        });
        renderClassMap.set(SizedLayout, (layout, hCss, domNode) => {
          
          let { w, h, ratio } = layout;
          if (ratio !== null) {
            let [ amt, unit ] = ((w !== null) ? w : h).match(/([0-9]*)(.*)/).slice(1);
            if (w !== null) h = `${parseInt(amt) / ratio}${unit}`;
            if (h !== null) w = `${parseInt(amt) * ratio}${unit}`;
            domNode.style.width = w;
            domNode.style.paddingBottom = h;
          } else {
            if (w !== null) domNode.style.width = w;
            if (h !== null) domNode.style.height = h;
          }
          
        });
        renderClassMap.set(ScrollLayout, (layout, hCss, domNode) => {
          let { x, y } = layout;
          if (x === 'auto') domNode.style.overflowX = 'auto';
          if (x === 'show') domNode.style.overflowX = 'scroll';
          if (y === 'auto') domNode.style.overflowY = 'auto';
          if (y === 'show') domNode.style.overflowY = 'scroll';
        });
        renderClassMap.set(ScrollLayout.Item, (layout, hCss, domNode) => {
          let { x, y } = layout.par;
          if (x !== 'none' || y !== 'none') domNode.style.scrollBehavior = 'smooth';
        });
        renderClassMap.set(TextLayout, (layout, hCss, domNode) => {
          domNode.style.gain({
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis'
          });
          
          // Apply font size
          if (layout.size) domNode.style.fontSize = layout.size;
          
          // Apply text
          domNode.textContent = layout.text;
          
          // Apply text alignment; best results occur when flex and classic "text-align' props are used
          domNode.style.alignItems = { fwd: 'flex-start', bak: 'flex-end', mid: 'center', all: 'stretch' }[layout.align || 'mid'];
          domNode.style.textAlign = { fwd: 'left', bak: 'right', mid: 'center', all: 'justify' }[layout.align || 'mid'];
          
          if (layout.gap) {
            domNode.style.boxSizing = 'border-box';
            domNode.style.padding = layout.gap;
          }
        });
        renderClassMap.set(TextInputLayout, (layout, hCss, domNode) => {
          if (layout.multiline) {
            
          } else {
            
          }
          if (layout.size) domNode.style.fontSize = layout.size;
          if (layout.align) domNode.style.textAlign = { fwd: 'left', bak: 'right', mid: 'center' }[layout.align];
          if (layout.gap) {
            domNode.style.boxSizing = 'border-box';
            domNode.style.padding = layout.gap;
          }
        });
        renderClassMap.set(ImageLayout, (layout, hCss, domNode) => {
          
          domNode.style.backgroundImage = `url('${layout.image.getUrl()}')`;
          domNode.style.backgroundSize = ({
            useMinAxis: 'contain',
            useMaxAxis: 'cover',
            stretch: '100%'
          })[layout.mode] || layout.mode;
          domNode.style.backgroundRepeat = 'no-repeat';
          domNode.style.backgroundPosition = 'center';
          domNode.style.pointerEvents = 'none';
          
        });
        
        let applyDecalsStack = (decalsStack, hCss, domNode) => {
          
          let complexDecals = {};
          for (let decals of decalsStack) {
            
            for (let k in decals) {
              
              if (k === 'colour') {
                domNode.style.backgroundColor = decals[k];
              } else if (k === 'textColour') {
                domNode.style.color = decals[k];
              } else if (k === 'border') {
                let { ext, colour } = decals[k];
                domNode.style.boxShadow = `inset 0 0 0 ${ext} ${colour}`;
              } else {
                if (!U.isType(decals[k], Object)) throw Error(`Decal type for "${k}" should be Object; got ${U.nameOf(decals[k])}`);
                if (!complexDecals.has(k)) complexDecals[k] = {};
                complexDecals[k].gain(decals[k]);
              }
              
            }
            
          }
          
          for (let k in complexDecals) {
            
            if (k === 'transition') {
              
              domNode.style.transition = complexDecals[k].toArr(({ ms=1000, curve='linear', delayMs=0 }, prop) => {
                
                prop = {
                  colour: 'background-color',
                  textColour: 'color',
                  border: 'box-shadow'
                }[prop];
                curve = {
                  linear: 'linear',
                  smooth: 'ease-in-out'
                }[curve];
                return `${prop} ${ms}ms ${curve} ${delayMs}ms`;
                
              }).join(', ');
              
            } else if (k === 'transform') {
              
              throw Error('Transform not implemented');
              
            } else {
              
              throw Error(`Invalid decal: ${k}`);
              
            }
            
          }
          
        };
        
        let browserTech = {
          name: 'HtmlCssJsTech',
          createTechNode: real => {
            let domNode = document.createElement('div');
            if (real.name) domNode.classList.add(real.name.replace(/([^a-zA-Z]+)([a-zA-Z])?/g, (f, p, c) => c ? c.upper() : ''));
            return domNode;
          },
          render: (real, domNode) => {
            
            if (!U.isInspiredBy(real, Real)) throw Error(`Invalid type: ${U.nameOf(real)}`);
            
            // Reset styles (and text)
            let childNodes = [ ...domNode.childNodes ];
            let textNode = (childNodes.count() === 1 && childNodes[0].nodeType === Node.TEXT_NODE) ? childNodes[0] : null;
            if (textNode) textNode.remove();
            domNode.removeAttribute('style');
            
            // Apply `real.layouts`, `real.innerLayout`, and decals
            let hCss = {};
            for (let layout of real.layouts) getRenderClass(layout)(layout, hCss, domNode);
            if (real.innerLayout) getRenderClass(real.innerLayout)(real.innerLayout, hCss, domNode);
            applyDecalsStack(real.decalsStack, hCss, domNode);
            
          },
          addNode: (parReal, kidReal) => parReal.getTechNode().appendChild(kidReal.getTechNode()),
          remNode: real => real.getTechNode().remove(),
          
          makeFocusable: (real, techNode=real.getTechNode()) => {
            let tmp = Tmp();
            
            let focusedElems = [];
            let focusFn = evt => {
              if (focusedElems.count()) throw Error(`Double focus :(`);
              focusedElems = [];
              let ptr = techNode;
              while (ptr !== document.body) { focusedElems.push(ptr); ptr = ptr.parentNode; }
              for (let elem of focusedElems) elem.style.zIndex = '10000';
            };
            let blurFn = evt => {
              for (let elem of focusedElems) elem.style.zIndex = '';
              focusedElems = [];
            };
            techNode.addEventListener('focus', focusFn);
            techNode.addEventListener('blur', blurFn);
            
            tmp.endWith(() => {
              techNode.removeEventListener('focus', focusFn);
              techNode.removeEventListener('blur', blurFn);
              for (let elem of focusedElems) elem.style.zIndex = '';
            });
            
            return tmp;
          },
          scrollTo: (scrollReal, trgReal) => {
            let children = [ ...scrollReal.getTechNode().childNodes ];
            if (children.count() !== 1) throw Error(`Scrollable parent needs 1 child; has ${children.count()}`);
            
            let scrollElem = scrollReal.getTechNode();
            let offsetElem = children[0];
            let targetElem = trgReal.getTechNode();
            if (!offsetElem.contains(targetElem)) throw Error(`The target elem is outside the scrollable context`);
            
            let tops = [ scrollElem, offsetElem, targetElem ].map(elem => elem.getBoundingClientRect().top);
            offsetElem.scrollTop += tops[2] - tops[1];
          },
          scrollerFocusedElemChecker: scrollReal => {
            
          },
          
          addInput: real => {
            
            let textInputLayout = real.layouts.find(layout => U.isInspiredBy(layout, TextInputLayout)).val;
            if (!textInputLayout) throw Error(`Can't add input; no TextInputLayout found!`);
            
            let initVal = textInputLayout.text || '';
            let techNode = real.getTechNode();
            let tmp = Tmp(); tmp.src = MemSrc.Prm1(initVal);
            
            let input = document.createElement('input');
            input.style.gain({
              position: 'absolute', display: 'block', boxSizing: 'border-box',
              width: '100%', height: '100%', left: '0', top: '0',
              padding: 'inherit', border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'inherit', fontSize: 'inherit', fontFamily: 'inherit'
            });
            input.value = initVal;
            
            if (textInputLayout.prompt) input.setAttribute('placeholder', textInputLayout.prompt);
            
            if (!techNode.style.position) {
              techNode.style.position = 'relative';
              tmp.endWith(() => techNode.style.position = '');
            }
            
            techNode.appendChild(input);
            tmp.endWith(() => input.remove());
            
            tmp.endWith(browserTech.makeFocusable(real, input));
            
            let inpFn = evt => tmp.src.retain(input.value);
            input.addEventListener('input', inpFn);
            tmp.endWith(() => input.removeEventListener('input', inpFn));
            return tmp;
            
          },
          addPress: (real, modes=[ 'continuous', 'discrete' ]) => {
            
            if (!U.isType(modes, Array)) modes = [ modes ];
            if (!modes.count()) throw Error(`Supply at least one mode`);
            if (modes.count() > 2) throw Error(`Supply maximum two modes`);
            if (modes.find(v => !U.isType(v, String)).found) throw Error(`All modes should be String`);
            if (modes.find(v => ![ 'continuous', 'discrete' ].includes(v)).found) throw Error(`Invalid mode; use either "continuous" or "discrete"`);
            
            let tmp = Tmp(); tmp.src = Src();
            let techNode = real.getTechNode();
            
            if (modes.includes('continuous')) {
              let clickFn = evt => tmp.src.send();
              techNode.addEventListener('click', clickFn);
              tmp.endWith(() => techNode.removeEventListener('click', clickFn));
              
              techNode.style.cursor = 'pointer';
              tmp.endWith(() => techNode.style.cursor = '');
            }
            
            if (modes.includes('discrete')) {
              
              let keyPressFn = evt => {
                if (evt.ctrlKey || evt.altKey || evt.shiftKey || evt.code !== 'Enter') return;
                [ 'preventDefault', 'stopPropagation' ].each(v => evt[v]());
                tmp.src.send(evt);
              };
              techNode.addEventListener('keypress', keyPressFn);
              tmp.endWith(() => techNode.removeEventListener('keypress', keyPressFn));
              
            }
            
            // TODO: This is a sloppy heuristic to get around the issue
            // that adding a tabIndex for any "discrete" mode may wind
            // up making the <div> containing an <input> focusable; this
            // means that tabbing to the <input> would require first
            // tabbing to the <div>. The real issue is that `techNode`
            // is always assumed to be the primary, interactive surface
            // of a Real - but in the case of a techNode overlaid with
            // an <input>, this isn't the case! This is therefore an
            // odd heuristic to add tabIndex for discreet press events,
            // only if the press is also continuous - because chances
            // are, if `real` is overlaid with an <input> the press will
            // *only* be discrete (since a continuous press would mean
            // clicks to focus the input element would result in sends)
            if (modes.includes('continuous') && modes.includes('discrete')) {
              
              techNode.setAttribute('tabIndex', '0');
              tmp.endWith(() => techNode.removeAttribute('tabIndex'));
              tmp.endWith(browserTech.makeFocusable(real, techNode));
              
              // tmp.endWith(real.addDecals({ texture: 'rough' }));
              
            }
            
            return tmp;
          },
          addFeel: real => {
            
            let techNode = real.getTechNode();
            let tmp = Tmp(); tmp.src = Src();
            let sentTmp = null;
            
            let onnFn = evt => {
              if (sentTmp) return;
              
              // Create a new Tmp indicating hover.
              sentTmp = Tmp();
              techNode.addEventListener('mouseleave', offFn);
              sentTmp.endWith(() => techNode.removeEventListener('mouseleave', offFn));
              
              tmp.src.send(sentTmp);
            };
            let offFn = evt => sentTmp && (sentTmp.end(), sentTmp = null);
            techNode.addEventListener('mouseenter', onnFn);
            tmp.endWith(() => techNode.removeEventListener('mouseleave', onnFn));
            return tmp;
            
          },
          addViewportEntryChecker: real => {
            
            let src = Src();
            let tmp = Tmp(); tmp.src = FnSrc.Tmp1([ src ], (evt, prev=Tmp()) => {
              let { left: l, right: r, top: t, bottom: b } = real.getTechNode().getBoundingClientRect();
              let { innerWidth: w, innerHeight: h } = window;
              if ((l < w && r > 0) && (t < h && b > 0)) return prev;
            });
            
            let pars = real.ancestry();
            let fn = (...args) => src.send(...args);
            for (let p of pars) p.getTechNode().addEventListener('scroll', fn);
            window.addEventListener('resize', fn);
            tmp.endWith(() => {
              for (let p of pars) p.getTechNode().addEventListener('scroll', fn);
              window.removeEventListener('resize', fn);
            });
            window.requestAnimationFrame(fn);
            
            return tmp;
            
          }
        };
        return browserTech;
        
      })();
      
      return {
        access: name => {
          if (name === 'primary') return primaryHtmlCssJsReal;
          throw Error(`Invalid access for Real -> "${name}"`);
        }
      };
      
    },
    
    // Connectivity
    makeHttpServer: async function(pool, { host, port, keyPair = false, selfSign = false }) {
      if (!port) port = keyPair ? 443 : 80;
      
      let numPendingReqs = 0;
      
      // TODO: Check out native fetch API
      let tellAndHear = async (msg, road) => {
        
        // Do XHR
        let ms = null;
        let req = new XMLHttpRequest();
        req.timeout = 24 * 60 * 60 * 1000;
        req.open('POST', this.seek('keep', 'urlResource', {}).getUrl(), true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify(msg));
        
        // Listen for the request to result in a JSON response
        numPendingReqs++;
        let res = await new Promise((rsv, rjc) => req.gain({ onreadystatechange: () => {
          if (req.readyState !== 4) return;
          if (req.status === 0) return rjc(Error('Got HTTP status 0'));
          
          ms = this.getMs();
          try {
            return rsv(req.responseText ? JSON.parse(req.responseText) : null);
          } catch(err) {
            console.log({
              msg: 'Expected JSON',
              request: { path: this.seek('keep', 'urlResource', {}).getUrl(), body: msg },
              responseCode: req.status,
              response: req.responseText
            });
            return rjc(Error('Malformed JSON'));
          }
        }}));
        
        // If any data was transmitted, process it at a higher level
        if (res) road.hear.send([ res, null, ms ]);
        
        // Always have 1 pending req
        numPendingReqs--;
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' }, road);
        
      };
      
      let server = Tmp(() => tellAndHear = v=>v);
      server.desc = `HTTP @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Src();
        road.tell = msg => tellAndHear(msg, road);
        road.currentCost = () => 1.0;
        this.queueTask(() => road.tell({ command: 'bankPoll' })); // Immediately bank a poll
      };
      
      // Allow communication with only a single Server: our AboveHut
      pool.processNewRoad(server, roadedHut => roadedHut.hutId = '!above');
      
      return server;
    },
    makeSoktServer: async function(pool, { host, port, keyPair = false, selfSign = false }) {
      if (!WebSocket) return null;
      
      if (!port) port = keyPair ? 444 : 81;
      
      let sokt = new WebSocket(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${this.seek('keep', 'urlResource', {}).getUrl()}`);
      await Promise(r => sokt.onopen = r);
      
      let server = Tmp(() => { /* sokt.close */ });
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Src();
        road.tell = msg => sokt.send(JSON.stringify(msg));
        road.currentCost = () => 0.5;
        sokt.onmessage = ({ data }) => data && road.hear.send([ JSON.parse(data), null, this.getMs() ]);
      };
      
      // Allow communication with only a single Server: our AboveHut
      pool.processNewRoad(server, roadedHut => roadedHut.hutId = '!above');
      return server;
    },
    
    parseErrorLine: function(line) {
      let [ roomName ] = line.match(/[?&]room=([a-zA-Z0-9]*)/).slice(1);
      let [ lineInd, charInd ] = line.match(/:([0-9]+):([0-9]+)/).slice(1);
      return { roomName, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10), bearing: 'below' };
    },
    srcLineRegex: function() { return { regex: /.^/, extract: fullMatch => ({ roomName: '???', line: 0, char: 0 }) }; }
    
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
