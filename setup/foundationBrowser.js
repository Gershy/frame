(() => {
  
  let { Nozz, TubSet } = U.water;
  let { Foundation, Keep } = U.setup;
  
  let FoundationBrowser = U.inspire({ name: 'FoundationBrowser', insps: { Foundation }, methods: (insp, Insp) => ({
    
    $KeepBrowser: U.inspire({ name: 'KeepBrowser', insps: { Keep }, methods: insp => ({
      init: function(foundation) {
        insp.Keep.init.call(this);
        let urlResourceKeep = Insp.KeepUrlResources(foundation);
        this.keepsByType = {
          static: Insp.KeepStatic(urlResourceKeep),
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
      },
      
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
      let handleError = evt => { evt.preventDefault(); console.error(this.formatError(evt.error || evt.reason)); debugger; };
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
      
      let renderClassMap = {
        // TODO: Should use a Map() of Insp objects, not Insp names
        TextLayout: (layout, domNode) => {
          domNode.style.textAlign = 'center';
          domNode.textContent = layout.text;
        },
        Axis1DLayout: (layout, domNode) => {
          
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
            
            // No need to justify when child items together occupy 100%
            //domNode.style.justifyContent = 'center'; // 'center', 'space-around', 'space-between'
            
            domNode.style.alignItems = 'center'; // 'flex-start', 'center', 'flex-end'
            
          } else if (U.isType(layout, Array)) {
            
            // Children are sized using the specified "cuts"
            let values = [];
            
          }
          
        },
        Axis1DLayoutItem: (layout, domNode) => {
          
          
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
            
            console.log({ cuts: layout.par.cuts, cutInd, ext });
            
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
          
        },
        FillLayout: (layout, domNode) => {
          
          
        },
        CenteredLayout: (layout, domNode) => {
          
        },
        CenteredLayoutItem: (layout, domNode) => {
        },
        decals: (decals, domNode) => {
          
          for (let k in decals) {
            
            if (k === 'colour') {
              domNode.style.backgroundColor = decals[k];
            } else if (k === 'w') {
              domNode.style.width = decals[k];
            } else if (k === 'h') {
              domNode.style.height = decals[k];
            } else if (k === 'border') {
              let { width, colour } = decals[k];
              domNode.style.boxShadow = `inset 0 0 0 ${width} ${colour}`;
            } else if (k === 'scroll') {
              let { x='none', y='none' } = decals[k];
              if (x === 'auto') domNode.style.overflowX = 'auto';
              if (x === 'show') domNode.style.overflowX = 'scroll';
              if (y === 'auto') domNode.style.overflowY = 'auto';
              if (y === 'show') domNode.style.overflowY = 'scroll';
            } else {
              
              console.log(`Unknown decals: "${k}"`);
              
            }
            
          }
          
        }
      };
      let getRenderClass = name => {
        if (!renderClassMap.has(name)) throw Error(`Invalid render class: "${name}"`);
        return renderClassMap[name];
      };
      
      let tech = {
        createTechNode: real => {
          let domNode = document.createElement('div');
          if (real.name) domNode.classList.add(real.name.replace(/([^a-zA-Z]+)([a-zA-Z])?/g, (f, p, c) => c ? c.upper() : ''));
          return domNode;
        },
        render: (real, domNode) => {
          
          // Reset text
          let cn = [ ...domNode.childNodes ];
          let textNode = (cn.length === 1 && cn[0].nodeType === Node.TEXT_NODE) ? cn[0] : null;
          if (textNode) textNode.remove();
          
          // Reset styles
          domNode.removeAttribute('style');
          
          // Apply outer and inner layouts, and decals
          if (real.outerLayout) getRenderClass(U.nameOf(real.outerLayout))(real.outerLayout, domNode);
          if (real.innerLayout) getRenderClass(U.nameOf(real.innerLayout))(real.innerLayout, domNode);
          for (let decals of real.decalStack) renderClassMap.decals(decals, domNode);
          
        },
        addNode: (parTechNode, kidTechNode) => parTechNode.appendChild(kidTechNode)
      };
      let primaryReal = {
        techNode: document.body,
        getChildOuterLayout: params => {
          let Cls = U.inspire({ name: 'FillLayout', methods: (insp, Insp) => ({
            init: function() {}
          })});
          return Cls();
        },
        addReal: real => {
          real.tech = tech;
          real.parent = primaryReal;
          tech.render(real, real.getTechNode());
          tech.addNode(primaryReal.techNode, real.getTechNode());
          return real;
        }
      };
      
      return {
        access: name => {
          if (name !== 'primary') throw Error(`Invalid access for Real -> "${name}"`);
          return primaryReal;
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
          try {         return rsv(req.responseText ? JSON.parse(req.responseText) : null); }
          catch(err) {  return rjc(Error('Malformed JSON')); }
        }}));
        
        // If any data was received, process it at a higher level
        if (res) road.hear.drip([ res, null, ms ]);
        
        // Always have 1 pending req
        numPendingReqs--;
        if (!numPendingReqs) tellAndHear({ command: 'bankPoll' }, road);
        
      };
      
      let server = TubSet({ onceDry: () => tellAndHear = ()=>{} }, Nozz());
      server.desc = `HTTP @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => tellAndHear(msg, road);
        road.currentCost = () => 1.0;
        
        /*
        // TODO: ddos test!!! FoundationNodejs.prototype.makeHttpServer
        // should handle this by detecting that the connection is being
        // abused, and ignoring incoming requests
        setTimeout(() => {
          while (true) road.tell({ command: 'ddos' });
        }, 20);
        */
        
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
      
      let server = TubSet({ onceDry: () => { /*sokt.close()*/ } }, Nozz());
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Nozz();
        road.tell = msg => sokt.send(JSON.stringify(msg));
        road.currentCost = () => 0.5;
        sokt.onmessage = ({ data }) => data && road.hear.drip([ JSON.parse(data), null, this.getMs() ]);
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
