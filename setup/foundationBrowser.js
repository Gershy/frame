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
      //   This is the time we received the server's 1st byte
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
      if (!global.rooms.has(name)) throw Error(`Room "${name}" does not set global.rooms.${name}!`);
      
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
        
        let { Axis1DLayout, FreeLayout, SizedLayout, ScrollLayout, TextLayout, ImageLayout } = U.setup;
        let renderClassMap = Map();
        let getRenderClass = layout => {
          let LayoutCls = layout.constructor;
          if (!renderClassMap.has(LayoutCls)) throw Error(`Invalid render class: "${LayoutCls.name}"`);
          return renderClassMap.get(LayoutCls);
        };
        renderClassMap.set(Axis1DLayout, (layout, hCss, domNode) => {
          
          if (![ 'relative', 'absolute' ].includes(domNode.style.position)) domNode.style.position = 'relative';
          
          if (layout.cuts === null) {
            
            // Children determine their own size in the axis direction, and have 100% perp direction
            domNode.style.overflowX = (layout.axis === 'x') ? 'auto' : 'hidden';
            domNode.style.overflowY = (layout.axis === 'y') ? 'auto' : 'hidden';
            
          } else if (layout.cuts === 'distribute') {
            
            // Children are all the same size
            domNode.style.display = 'flex';
            domNode.style.flexDirection = (layout.axis === 'x')
              ? (layout.flow === '+' ? 'row' : 'row-reverse')
              : (layout.flow === '+' ? 'column' : 'column-reverse');
            domNode.style.alignItems = 'center'; // 'flex-start', 'center', 'flex-end'
            
            // No need to justify when child items together occupy 100%
            //domNode.style.justifyContent = 'center'; // 'center', 'space-around', 'space-between'
            
            
          } else if (layout.cuts === 'focus') {
            
            domNode.style.display = 'flex';
            domNode.style.flexDirection = (layout.axis === 'x')
              ? (layout.flow === '+' ? 'row' : 'row-reverse')
              : (layout.flow === '+' ? 'column' : 'column-reverse');
            domNode.style.alignItems = 'center'; // 'flex-start', 'center', 'flex-end'
            domNode.style.justifyContent = 'center';
            
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
            
          } else if (U.isType(layout.par.cuts, Array)) {
            
            // Children are sized using the specified "cuts"
            let cutInd = layout.params[0];
            let offCuts = layout.par.cuts.slice(0, cutInd);
            
            let off = offCuts.length
              ? `calc(${offCuts.join(' + ')})`
              : '0';
            let ext = (cutInd <= (layout.par.cuts.length - 1))
              ? layout.par.cuts[cutInd]
              : `calc(100% - ${layout.par.cuts.join(' - ')})`;
            
            domNode.style.position = 'absolute';
            
            if (layout.par.axis === 'x' && layout.par.flow === '+') {
              
              domNode.style.left = off;
              domNode.style.width = ext;
              domNode.style.height = '100%';
              
            } else if (layout.par.axis === 'x' && layout.par.flow === '-') {
              
              domNode.style.right = off;
              domNode.style.width = ext;
              domNode.style.height = '100%';
              
            } else if (layout.par.axis === 'y' && layout.par.flow === '+') {
              
              domNode.style.top = off;
              domNode.style.width = '100%';
              domNode.style.height = ext;
              
            } else if (layout.par.axis === 'y' && layout.par.flow === '-') {
              
              domNode.style.bottom = off;
              domNode.style.width = '100%';
              domNode.style.height = ext;
              
            }
            
            
          }
          
        });
        renderClassMap.set(FreeLayout, (layout, hCss, domNode) => {
          
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
          domNode.style.display = 'flex';
          domNode.style.flexDirection = 'column';
          domNode.style.alignItems = 'center';
          domNode.style.justifyContent = 'center';
          if (layout.size) domNode.style.fontSize = layout.size;
          domNode.textContent = layout.text;
          
          if (layout.align) domNode.style.textAlign = {
            fwd: 'left', bak: 'right', mid: 'center'
          }[layout.align];
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
                let { width, colour } = decals[k];
                domNode.style.boxShadow = `inset 0 0 0 ${width} ${colour}`;
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
          addNode: (parTechNode, kidTechNode) => parTechNode.appendChild(kidTechNode),
          
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
          
          domEventToSrc: (eventName, techNode) => {
            let tmp = TmpRefCount(); tmp.src = Src();
            let fn = evt => tmp.src.send(evt);
            techNode.addEventListener(eventName, fn);
            tmp.endWith(() => techNode.removeEventListener(eventName, fn));
            return tmp;
          },
          addPress: real => browserTech.domEventToSrc('click', real.getTechNode()),
          addFeel: real => {
            
            let techNode = real.getTechNode();
            let tmp = TmpRefCount(); tmp.src = Src();
            let sentTmp = null;
            let onnFn = evt => {
              if (sentTmp) return;
              
              // Create a new Tmp indicating hover.
              sentTmp = Tmp();
              techNode.addEventListener('mouseleave', offFn);
              sentTmp.endWith(() => techNode.removeEventListener('mouseleave', offFn));
              
              tmp.src.send(sentTmp);
            };
            let offFn = evt => {
              if (!sentTmp) return; sentTmp.end(); sentTmp = null;
            };
            
            techNode.addEventListener('mouseenter', onnFn);
            tmp.endWith(() => techNode.removeEventListener('mouseleave', onnFn));
            return tmp;
            
          },
          addViewportEntryChecker: real => {
            
            let tmp = TmpRefCount(); tmp.src = FnSrc([ Src() ], (evt, prev=Tmp()) => {
              let { left: l, right: r, top: t, bottom: b } = real.getTechNode().getBoundingClientRect();
              let { innerWidth: w, innerHeight: h } = window;
              if ((l < w && r > 0) && (t < h && b > 0)) return prev;
            });
            
            let pars = real.ancestry();
            let fn = (...args) => tmp.src.srcs[0].send(...args);
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
        
        // If any data was received, process it at a higher level
        if (res) road.hear.send([ res, null, ms ]);
        
        // Always have 1 pending req
        numPendingReqs--;
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' }, road);
        
      };
      
      let server = Tmp(() => tellAndHear = v=>v);
      server.connSrc = MemSrc.TmpM(Src());
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
      server.connSerc = MemSrc.TmpM(Src());
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
      return { roomName, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10) };
    },
    srcLineRegex: function() {
      
      return {
        regex: /abc/,
        extract: fullMatch => ({ roomName: '???', line: 0, char: 0 })
      };
      
    }
    
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
