(() => {
  
  let { Tmp, Src } = U.logic;
  let { Foundation, Keep  } = U.setup;
  
  let FoundationBrowser = U.form({ name: 'FoundationBrowser', has: { Foundation }, props: (forms, Form) => ({
    
    $KeepBrowser: U.form({ name: 'KeepBrowser', has: { Keep }, props: forms => ({
      init: function(foundation) {
        forms.Keep.init.call(this);
        let urlResourceKeep = Form.KeepUrlResources(foundation);
        this.keepsByType = {
          static: Form.KeepStatic(foundation, urlResourceKeep),
          urlResource: urlResourceKeep
        };
      },
      access: function(type) {
        if (this.keepsByType.has(type)) return this.keepsByType[type];
        throw Error(`Invalid Keep type: "${type}" (options are: ${this.keepsByType.toArr((v, k) => `"${k}"`).join(', ')})`);
      }
    })}),
    $KeepStatic: U.form({ name: 'KeepStatic', has: { Keep }, props: forms => ({
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
    $KeepUrlResources: U.form({ name: 'KeepUrlResources', has: { Keep }, props: forms => ({
      init: function(foundation) { this.foundation = foundation; this.urlImages = {}; },
      access: function({ path='', params={} }) { return Form.KeepUrlResource(this, path, params); }
    })}),
    $KeepUrlResource: U.form({ name: 'KeepUrlResource', has: { Keep }, props: forms => ({
      init: function(par, path='', params={}) {
        forms.Keep.init.call(this);
        this.par = par;
        this.path = path;
        this.params = params;
      },
      getUrl: function() {
        let params = { hutId: this.par.foundation.hutId, ...this.params };
        return params.isEmpty()
          ? `/${this.path}`
          : `/${this.path}?${params.toArr((v, k) => `${k}=${v}`).join('&')}`;
      }
    })}),
    $TextNode: U.getForm(document.createTextNode('')),
    
    // Initialization
    init: function({ hutId, aboveMsAtResponseTime, ...supArgs }) {
      forms.Foundation.init.call(this, supArgs);
      
      // GOAL: delta since Above generated "aboveMsAtResponseTime"?
      // - `firstContactMs` is our earliest timing of server response
      // - `firstContactMs` is `performance.timing.responseStart`
      //   This is the time we heard the server's 1st byte
      // - Without making any assumptions: `now - firstContactMs`
      // - This estimates LESS than the real latency
      let nativeNow = +new Date();
      let firstContactMs = performance.timing.responseStart;
      let knownLatencyMs = nativeNow - firstContactMs;
      
      // With this value, `new Date() + this.clockDeltaMs` is best guess
      // at current value of Above's `foundation.getMs()` *right now*
      // TODO: It's flawed to assume that the delta calculated here is
      // consistently the latency between server and client... If
      // anything, it would make sense to constantly update the delta as
      // a side-effect of other requests.
      this.clockDeltaMs = nativeNow - (aboveMsAtResponseTime + knownLatencyMs);
      this.hutId = hutId;
      
      // Make sure that refreshes redirect to the same session
      let { query } = this.parseUrl(window.location.href);
      
      // TODO: Ideally the foundation should know how to generate urls,
      // and the keep would rely on the foundation (reverse of this)
      window.history.replaceState({}, '', this.seek('keep', 'urlResource', { params: query }).getUrl());
      
    },
    halt: function() { /* debugger */; },
    
    // Sandbox
    queueTask: function(func) { Promise.resolve().then(func); },
    getMs: function() { return (+new Date()) + this.clockDeltaMs; },
    
    // Config
    processArg: function(term, val) { return forms.Foundation.processArg(term, val); },
    
    // Services
    createHut: async function(options={}) { return forms.Foundation.createHut.call(this, this.hutId); },
    createKeep: function(options={}) { return Form.KeepBrowser(this); },
    createReal: async function() {
      
      let Real = await this.getRoom('internal.real.htmlBrowser.Real');
      let primaryHtmlCssJsReal = Real({ name: 'browser.htmlCssJs' });
      primaryHtmlCssJsReal.domNode = document.body;
      primaryHtmlCssJsReal.layoutForms = {};
      primaryHtmlCssJsReal.tech = ({
        
        // css techniques:
        // https://css-tricks.com/almanac/properties/c/contain/
        
        name: 'HtmlCssJsTech',
        render: (real, delta) => {
          
          if (real.off()) return; // `real` may have ended
          
          // Naive: ignoring `delta` purify Real & apply all layouts
          let domNode = real.domNode;
          
          let childNodes = [ ...domNode.childNodes ];
          let textNode = (childNodes.count() === 1 && U.isForm(childNodes[0], Form.TextNode)) ? childNodes[0] : null;
          if (textNode) textNode.remove();
          domNode.removeAttribute('style');
          [ ...domNode.attributes ].each(attr => attr !== 'class' && domNode.removeAttribute(attr));
          
          for (let layout of real.getLayouts()) layout.render(real, domNode);
          
        },
        getLayoutForm: name => {
          
          let layoutForms = primaryHtmlCssJsReal.layoutForms;
          if (!layoutForms.has(name)) {
            layoutForms[name] = this.getRoom(`internal.real.htmlBrowser.${name}`);
            U.then(layoutForms[name], Form => layoutForms[name] = Form);
          }
          return layoutForms[name];
          
        },
        select: (real=null) => {
          
          // Clear previous selection
          window.getSelection().removeAllRanges();
          
          // Select `real` if non-null
          if (!real) return;
          
          // Create new selection
          let selRange = document.createRange();
          selRange.selectNodeContents(real.domNode);
          window.getSelection().addRange(selRange);
          
        }
        
      });
      
      return {
        access: name => {
          if (name === 'primary') return primaryHtmlCssJsReal;
          throw Error(`Invalid access for Real -> "${name}"`);
        }
      };
      
    },
    
    // Transport
    createHttpServer: function({ host, port, keyPair=false, selfSign=false }) {
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
          if (req.status === 0) return rjc(Error('Http transport unavailable'));
          
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
      server.addPool = () => Tmp.stub;
      
      return server;
    },
    createSoktServer: async function({ host, port, keyPair=false, selfSign=false }) {
      if (!WebSocket) return null;
      
      if (!port) port = keyPair ? 444 : 81;
      
      let sokt = new WebSocket(`${keyPair ? 'wss' : 'ws'}://${host}:${port}${this.seek('keep', 'urlResource', {}).getUrl()}`);
      await Promise(r => sokt.addEventListener('open', r));
      
      let server = Tmp(() => { /* sokt.close */ });
      server.desc = `SOKT @ ${host}:${port}`;
      server.decorateRoad = road => {
        road.hear = Src();
        road.tell = msg => {
          if (msg === null) return;
          if (sokt.readyState !== WebSocket.OPEN) throw Error(`Sokt transport unavailable`);
          sokt.send(JSON.stringify(msg));
        }
        road.currentCost = () => 0.5;
        sokt.onmessage = ({ data }) => road.hear.send([ JSON.parse(data), null, this.getMs() ]);
      };
      server.addPool = pool => Tmp.stub;
      
      return server;
    },
    
    // Room
    installRoom: async function(name, bearing='below') {
      
      let params = { command: 'html.room', type: 'room', room: name, reply: '1' };
      let url = this.seek('keep', 'urlResource', { params }).getUrl();
      
      let script = document.createElement('script');
      script.setAttribute('defer', '');
      script.setAttribute('async', '');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', url);
      document.head.appendChild(script);
      
      // Wait for the script to load; ensure it populated `global.rooms`
      await Promise((rsv, rjc) => {
        script.addEventListener('load', rsv);
        script.addEventListener('error', err => rjc(err.update(m => `Couldn't load room "${name}" (${m})`)));
      });
      
      if (!global.rooms.has(name)) throw Error(`Room "${name}" does not set global.rooms['${name}']!`);
      
      return {
        debug: global.roomDebug[name],
        content: global.rooms[name](this)
      };
      
    },
    
    /// {DEBUG=
    // Error
    parseErrorLine: function(line) {
      let [ roomName ] = line.match(/[?&]room=([a-zA-Z0-9.]*)/).slice(1);
      let [ lineInd, charInd ] = line.match(/:([0-9]+):([0-9]+)/).slice(1);
      return { roomName, lineInd: parseInt(lineInd, 10), charInd: parseInt(charInd, 10), bearing: 'below' };
    },
    srcLineRegex: function() { return { regex: /.^/, extract: fullMatch => ({ roomName: null, line: 0, char: 0 }) }; } // That regex ain't ever gonna match! (Intentionally!)
    /// =DEBUG}
    
  })});
  
  U.setup.gain({ FoundationBrowser });
  
})();
