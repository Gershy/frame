/// {SERVER=
/// =SERVER}
// TODO: I hate the multiline ` ... ` strings

/// {SERVER=
let http = require('http');
let path = require('path');
let fs = require('fs');
let readFile = async (type, ...cmps) => {
  if (type === 'binary') type = null
  return await new Promise((rsv, rjc) => {
    return fs.readFile(path.join(...cmps), type, (err, content) => err ? rjc(err) : rsv(content));
  });
};
let deflateContents = contents => {
  let lines = S.split(contents.trim(), '\n');
  lines = A.map(lines, line => line.trim() ? line : U.SKIP);
  return A.join(lines, '\n');
};
/// =SERVER}

U.makeTwig({ name: 'hinterlands', twigs: [ 'clearing', 'record' ], make: (hinterlands, clearing, record) => {
  
  const { Val, Obj, Arr, Ref, RecordVal, RecordObj, RecordArr, Editor } = record;
  
  // ==== Util
  const Encounter = U.makeClass({ name: 'Encounter', methods: (insp, Cls) => ({
    
    init: function({ passage, passageData={}, ip, aspect, message, details={} }) {
      
      // An Encounter happens when we meet a Walker, on a Passage, who's interested
      // in a specific aspect of our hut, and has a brief Message for us, and
      // optionally further Details for that message.
      
      if (!aspect) throw new Error('Missing "aspect" param');
      if (!message) throw new Error('Missing "message" param');
      
      this.hinterlands = null;
      this.passage = passage;
      this.passageData = passageData;
      this.ip = ip;
      this.aspect = aspect;
      this.message = message;
      this.details = details;
      this.walker = null;
      
    },
    describe: function() {
      
      return (this.aspect.length ? this.aspect.join('.') : 'ROOT') + '.' + this.message;
      
    }
    
  })});
  const Journey = U.makeClass({ name: 'Journey', methods: (insp, Cls) => ({
    
    init: function({ aspect=[] }) {
      
      this.aspect = aspect;
      
    },
    getContentType: function() { throw new Error('not implemented'); },
    getHttpStatusCode: function() { throw new Error('not implemented'); },
    getSerializedContent: function() {
      
      // Returns either String or Buffer
      throw new Error('not implemented');
      
    }
    
  })});
  const JourneyWarn = U.makeClass({ name: 'JourneyWarn', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ aspect, error, status=400 }) {
      
      insp.Journey.init.call(this, { aspect });
      this.error = error;
      this.status = status;
      
    },
    getContentType: function() { return 'application/json'; },
    getHttpStatusCode: function() { return this.status; },
    getSerializedContent: function() {
      
      return U.thingToString({
        aspect: this.aspect,
        message: 'warning',
        details: {
          description: this.error.message
        }
      });
      
    }
    
    
  })});
  const JourneyJson = U.makeClass({ name: 'JourneyJson', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ aspect, message, details }) {
      
      insp.Journey.init.call(this, { aspect });
      this.message = message;
      this.details = details;
      
    },
    getContentType: function() { return 'application/json'; },
    getHttpStatusCode: function() { return 200; },
    getSerializedContent: function() {
      
      return U.thingToString({
        aspect: this.aspect,
        message: this.message,
        details: this.details
      });
      
    }
    
  })});
  const JourneyBuff = U.makeClass({ name: 'JourneyBuff', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ aspect, type='generic', buffer }) {
      
      insp.Journey.init.call(this, { aspect });
      this.type = type;
      this.buffer = buffer; // String or Buffer
      
    },
    getContentType: function() {
      
      return ({
        generic: 'application/octet-stream',
        html: 'text/html',
        js: 'application/javascript',
        icon: 'image/x-icon'
      })[this.type];
      
    },
    getHttpStatusCode: function() { return 200; },
    getSerializedContent: function() {
      
      return this.buffer;
      
    }
    
  })});
  
  // ==== Outlines
  const OutlineHinterlands = U.makeClass({ name: 'OutlineHinterlands', inspiration: { Obj }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=Hinterlands, deployment }) {
      
      insp.Obj.init.call(this, { name, recCls });
      this.deployment = deployment;
      
      let walkers = this.add(Arr({ name: 'walkers' }));
      let walker = walkers.setTemplate(Obj({ name: 'walker' }), walker => walker.getChild('ip').getValue());
      walker.add(Val({ name: 'ip' }));          // ip aspect (in compact 8-digit hex format)
      walker.add(Val({ name: 'joinMs' }));      // time joined
      walker.add(Val({ name: 'activityMs' }));  // time of last activity
      walker.add(Ref({ name: 'persona', target: [ this, 'personas', '$persona' ] }));
      
      let passages = walker.add(Arr({ name: 'passages' }));
      let passage = passages.setTemplate(Obj({ name: 'passage' }), passage => passage.getChild('name').getValue());
      passage.add(Val({ name: 'name' }));
      passage.add(Val({ name: 'health' }));
      
      let personas = this.add(Arr({ name: 'personas' }));
      let persona = personas.setTemplate(Obj({ name: 'persona' }));
      
    }
    
  })});
  const OutlinePassage = U.makeClass({ name: 'OutlinePassage', inspiration: { Obj }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=PassageHttp, hinterlands=null }) {
      
      if (!hinterlands) throw new Error('Missing "hinterlands" param');
      
      insp.Obj.init.call(this, { name, recCls });
      this.hinterlands = hinterlands;
      
    }
    
  })});
  
  // ==== Records
  const Hinterlands = U.makeClass({ name: 'Hinterlands', inspiration: { RecordObj }, methods: (insp, Cls) => ({
    
    // An area travelled via many Passages
    
    init: function({ outline, assetVersion=null }) {
      
      insp.RecordObj.init.call(this, { outline });
      this.assetVersion = assetVersion || U.charId(parseInt(Math.random() * 1000), 3);
      this.passages = {};
      
    },
    getTmpActions: function() {
      
      return insp.RecordObj.getTmpActions.call(this).concat([
        {
          up: function() { U.output('Ain\'t it breezy out here in the Hinterlands?'); },
          dn: function() { U.output('Now we\'re somewhere the roads don\'t go.'); }
        }
      ]);
      
    },
    doEncounter: async function(encounter) {
      
      encounter.hinterlands = this;
      
      let walkers = this.getChild('walkers');
      encounter.walker = walkers.getChild(encounter.ip);
      
      let timeMs = U.timeMs();
      let editor = Editor();
      if (!encounter.walker) {
        
        encounter.walker = editor.create({ par: walkers, data: {
          ip: encounter.ip,
          joinMs: timeMs,
          activityMs: timeMs,
          persona: null,
          passages: {
            0: {
              name: encounter.passage.name,
              health: 0.5
            }
          }
        }});
        
      } else {
        
        editor.mod({ rec: encounter.walker.getChild('activityMs'), value: timeMs });
        
        if (!encounter.walker.getChild([ 'passages', encounter.passage.name ])) {
          
          editor.build({ rec: encounter.walker.getChild('passages'), data: {
            [ encounter.passage.name ]: {
              name: encounter.passage.name,
              health: 0.5
            }
          }});
          
        }
        
      }
      
      editor.run();
      
      // Reformat certain specific encounters
      if (encounter.aspect.length === 1 && encounter.aspect[0] === 'favicon.ico') {
        encounter.aspect = [];
        encounter.message = 'giveIcon';
      }
      
      try {
        
        let aspect = this.getChild(encounter.aspect);
        if (!aspect) throw new Error('Invalid aspect name: ' + encounter.aspect.join('.'));
        await aspect.encounter(encounter);
        
      } catch(error) {
        
        this.journey(encounter, JourneyWarn({ aspect: [], error }));
        
      }
      
    },
    encounter: async function(encounter) {
      
      /// {SERVER=
      if (encounter.message === 'greetings') {
        
        let hutName = this.outline.deployment.hut;
        
        let twig = TWIGS[hutName];
        await twig.promise;
        
        let [ [ essentialsContent, clientEssentialsContent ], fileDataList ] = await Promise.all([
          
          // Load the clearing
          Promise.all([
            readFile('utf8', __dirname, '..', '..', 'clearing', 'essentials.js'),
            readFile('utf8', __dirname, '..', '..', 'clearing', 'clientEssentials.js')
          ]),
          
          // Load all twigs
          Promise.all(A.map(twig.twigList, async (twigName) => {
            
            let variantData = COMPILER.getVariantData(twigName, 'client');
            let content = await readFile('utf8', variantData.fullPath);
            
            return {
              name: `twig/${twigName}/${twigName}.cmp`,
              twigName,
              content: content.trim(),
              offsets: variantData.offsets
            };
            
          }))
          
        ]);
        
        let initContents = `
global.process = {
  argv: [
    'browser: ' + (navigator.userAgent || 'unknownUserAgent'),
    'hut.js',
    '--hut ${hutName}',
    '--host ' + window.location.hostname,
    '--port ' + (window.location.port || '80') // TODO: Account for https
  ]
};`;
        
        let environmentContents = `
let { Compiler } = U;
let compiler = global.COMPILER = Compiler({ offsetData: global.COMPILER_DATA });
window.addEventListener('error', event => {
  U.output('---- UNCAUGHT');
  U.output(compiler.formatError(event.error));
  event.preventDefault();
});
window.addEventListener('unhandledrejection', event => {
  U.output('---- UNHANDLED');
  U.output(compiler.formatError(event.reason));
  event.preventDefault();
});
//throw new Error('hey');`;
        
        fileDataList = [
          
          { name: 'clearing/init.js', offsets: [], content: deflateContents(initContents) },
          { name: 'clearing/essentials.js', content: deflateContents(essentialsContent), offsets: [] },
          { name: 'clearing/clientEssentials.js', content: deflateContents(clientEssentialsContent), offsets: [] },
          { name: 'clearing/environment.js', offsets: [], content: deflateContents(environmentContents) },
          
          ...A.reverse(fileDataList) // Reverse order ensures dependencies always precede dependees
          
        ];
        
        let lineOffset = 14; // A simple manual count of how many lines occur before the first js
        let compilerData = {};
        let compoundJs = [];
        
        // Reversing allows dependencies to always come before dependees
        A.each(fileDataList, fileData => {
          
          let content = fileData.content;
          compoundJs.push(content);
          
          compilerData[fileData.name] = {
            twigName: O.has(fileData, 'twigName') ? fileData.twigName : null,
            lineOffset: lineOffset,
            offsets: fileData.offsets
          };
          
          lineOffset += content.split('\n').length;
          
        });
        
        compoundJs = A.join(compoundJs, '\n');
        
        let html = (`
<!DOCTYPE html>
<html>
<head>
<title>${hutName}</title>
<meta charset="utf-8"/>
<meta name="description" content="hut">
<meta name="keywords" content="hut ${this.name}">
<meta name="viewport" content="width=device-width"/>
<link rel="icon" type="image/x-icon" href="?message=giveIcon&time=${+new Date()}"/>
<script type="text/javascript">
'use strict';
window.global = window;
global.COMPILER_DATA = ${JSON.stringify(compilerData)};
${compoundJs}
</script>
<style type="text/css">
body, html {
  position: fixed;
  left: 0; top: 0;
  width: 100%; height: 100%;
  padding: 0; margin: 0;
  overflow: hidden;
  font-family: sans-serif;
}
body { background-color: #e0e4e8; }
</style>
</head>
<body></body>
</html>
        `).trim();
        
        return this.journey(encounter, JourneyBuff({
          aspect: [],
          type: 'html',
          buffer: html
        }));
        
      } else if (encounter.message === 'giveIcon') {
        
        return this.journey(encounter, JourneyBuff({
          aspect: [],
          type: 'icon',
          buffer: await readFile('binary', __dirname, '..', '..', 'clearing', 'favicon.ico')
        }));
        
      }
      /// =SERVER}
      
      throw new Error('Couldn\'t process encounter: ' + encounter.describe());
      
    },
    
    journey: function(encounter=null, journey) {
      
      if (!encounter) throw new Error('Unencountered journeys not implemented');
      
      if (U.isInspiredBy(journey, JourneyWarn)) U.output('JOURNEYERROR:', COMPILER.formatError(journey.error));
      
      encounter.passage.journey(encounter, journey);
      
    }
    
  })});
  const Passage = U.makeClass({ name: 'Passage', inspiration: { RecordObj }, methods: (insp, Cls) => ({
    
    // Abstract Passage type
    
    init: function({ outline }) {
      
      if (!O.has(outline, 'hinterlands')) throw new Error('Missing "hinterlands" param');
      
      insp.RecordObj.init.call(this, { outline });
      this.openPromise = null;
      this.shutPromise = null;
      this.hinterlands = null;
      
    },
    getTmpActions: function() {
      
      return insp.RecordObj.getTmpActions.call(this).concat([
        // Keep Hinterlands informed of our existence
        {
          up: function() {
            
            if (!this.hasResolvedName()) throw new Error('Need resolved name');
            
            this.hinterlands = this.getPar(this.outline.hinterlands);
            if (!this.hinterlands) throw new Error('Need hinterlands parent');
            
            this.hinterlands.passages[this.name] = this;
            
          },
          dn: function() {
            
            delete this.hinterlands.passages[this.name];
            this.hinterlands = null;
            
          }
        },
        // Ensure that the passage is open when appropriate
        {
          up: this.startOpenPassage,
          dn: this.startShutPassage
        }
      ]);
      
    },
    startOpenPassage: function() {
      
      // TODO: Need to be able to deal with quick open/close/open/close sequences
      // The Editor may have to make many attempts to initialize the Hinterlands,
      // and this can involve rapid open/close repetitions.
      if (this.openPromise) throw new Error('Already opening');
      
      this.openPromise = (async () => {
        await this.shutPromise;
        this.shutPromise = null;
        return await this.openPassage();
      })();
      
    },
    startShutPassage: function() {
      
      if (this.shutPromise) throw new Error('Already shutting');
      
      this.shutPromise = (async () => {
        await this.openPromise;
        this.openPromise = null;
        return await this.shutPassage();
      })();
      
    },
    openPassage: async function() { throw new Error('not implemented'); },
    shutPassage: async function() { throw new Error('not implemented'); },
    
    journey: function(encounter, journey) { throw new Error('not implemented'); },
    
  })});
  const PassageHttp = U.makeClass({ name: 'PassageHttp', inspiration: { Passage }, methods: (insp, Cls) => ({
    
    // Passage via http
    
    init: function(params) {
      
      insp.Passage.init.call(this, params);
      this.server = null;
      
    },
    openPassage: async function() {
      
      let { port, host } = this.outline.hinterlands.deployment;
      
      /// {SERVER=
      let serverFunc = this.processRequest.bind(this);
      this.server = http.createServer((...args) => this.processRequest(...args));
      await new Promise((rsv, rjc) => this.server.listen(port, host, 511, rsv));
      /// =SERVER}
      
      /// {CLIENT=
      throw new Error('TODO: fizzle any old polls for our IP, bank new ones!');
      /// =CLIENT}
      
      U.output(`Http passage open: "${this.name}" (${host}:${port})`);
      
    },
    
    parseEncounterData: async function(httpReq, protocol='http') {
      
      // TODO: Need to determine if the IP is trusted
      // nginx can supposedly do it, so why not nodejs?
      
      // Get the ip in verbose form, and a compact `ip` value consisting of 8 hex digits
      let ipVerbose = (httpReq.headers['x-forwarded-for'] || httpReq.connection.remoteAddress).split(',')[0].trim();
      let pcs = A.map(S.split(ipVerbose, '.'), pc => parseInt(pc, 10));
      
      // TODO: What about ipv6?
      if (pcs.length !== 4 || A.any(pcs, pc => isNaN(pc) || pc < 0 || pc > 255)) throw new Error('Unexpected ip format: ' + ipVerbose);
      let ip = A.join(A.map(pcs, pc => parseInt(pc, 10).toString(16)), '');
      
      // Get the url value
      let url = httpReq.url;
      
      // Get the protocol if it's included in the url
      let protocolInd = S.indexOf(url, '://'); // TODO: Not the smartest check. What about arbitrary values in url params?
      if (protocolInd >= 0) {
        protocol = url.substr(0, protocolInd);
        url = url.substr(protocolInd + 3);
      }
      
      // Remove any prefixing "/"
      if (url[0] === '/') url = url.substr(1);
      
      // This `encounterData` value hold all data relevant to the encounter
      let encounterData = {};
      
      // Get any query params in the url
      let queryInd = S.indexOf(url, '?');
      if (queryInd >= 0) {
        
        let queryStr = url.substr(queryInd + 1);
        url = url.substr(0, queryInd);
        
        A.each(S.split(queryStr, '&'), pc => {
          
          let equalInd = pc.indexOf('=');
          let [ key, val ] = equalInd >= 0
            ? [ pc.substr(0, equalInd), decodeURIComponent(pc.substr(equalInd + 1)) ]
            : [ pc, true ];
          
          encounterData[key] = val;
          
        });
        
      }
      
      // Expand the "_" url param if it exists
      if (O.has(encounterData, '_')) {
        
        let data = U.stringToThing(encounterData._);
        if (!U.isType(data, Object)) throw new Error(`Can't process "_" param of type ${U.typeOf(data)}`);
        
        // Make any "_" properties directly available in `encounterData`
        delete encounterData._;
        O.include(encounterData, data);
        
      }
      
      // Remove any suffixing "/"
      if (url[url.length - 1] === '/') url = url.substr(0, url.length - 1);
      
      // Ensure `url` is in Array format
      url = url ? S.split(url, '/') : [];
      
      // Ensure that non-GET requests capture the body
      if (httpReq.method.toLowerCase() !== 'get') {
        
        // TODO: Need protection from timing-based attacks (e.g. slow loris)
        let body = await new Promise((rsv, rjc) => {
          
          let chunks = [];
          httpReq.setEncoding('utf8');
          httpReq.on('error', rjc);
          httpReq.on('data', chunk => chunks.push(chunk));
          httpReq.on('end', () => {
            
            try {
              let bodyStr = chunks.join('');
              rsv(bodyStr.length ? U.stringToThing(bodyStr) : {});
            } catch(err) { rjc(err); }
            
          });
          
        });
        O.include(encounterData, body);
        
      }
      
      O.include(encounterData, { ipVerbose, ip, protocol });
      if (!O.has(encounterData, 'aspect')) encounterData.aspect = url;
      if (!O.has(encounterData, 'message')) encounterData.message = 'greetings';
      if (!O.has(encounterData, 'details')) encounterData.details = {};
      
      return encounterData;
      
    },
    processRequest: async function(httpReq, httpRes) {
      
      try {
        
        let encounterData = await this.parseEncounterData(httpReq);
        
        let encounter = Encounter({
          passage: this,
          passageData: { httpReq, httpRes },
          ip: encounterData.ip,
          aspect: encounterData.aspect,
          message: encounterData.message,
          details: encounterData.details
        });
        
        let hinterlandsRec = this.getPar(this.outline.hinterlands);
        await hinterlandsRec.doEncounter(encounter);
        
      } catch(err) {
        
        err.message = 'Http misinterpretation: ' + err.message;
        U.output(COMPILER.formatError(err));
        
        httpRes.statusCode = 400;
        httpRes.end('Http error', 'utf8');
        
      }
      
    },
    
    journey: function(encounter, journey) {
      
      let httpRes = null;
      if (encounter && encounter.passage === this) httpRes = encounter.passageData.httpRes;
      if (!httpRes) throw new Error('Polling/banking not implemented');
      
      let content = journey.getSerializedContent();
      if (U.isType(content, String)) content = Buffer.from(content, 'utf8');
      
      httpRes.writeHead(journey.getHttpStatusCode(), {
        'content-type': journey.getContentType(),
        'content-length': content.length
      });
      httpRes.end(content, 'binary');
      
    }
    
  })});
  const PassageSokt = U.makeClass({ name: 'PassageSokt', inspiration: { Passage }, methods: (insp, Cls) => ({
    
    // Passage via socket
    openPassage: async function() {
      return null;
    },
    shutPassage: async function() {
      return null;
    }
    
  })});
  
  O.include(hinterlands, {
    
  });
  
  // ===================================
  
  let outline = new OutlineHinterlands({ name: 'root', deployment: clearing.deployment });
  
  let passages = outline.add(Obj({ name: 'passages' }));
  passages.add(OutlinePassage({ name: 'http', recCls: PassageHttp, hinterlands: outline }));
  // passages.add(OutlinePassage({ name: 'sokt', recCls: PassageSokt, hinterlands: outline }));
  
  let editor = Editor();
  let hinterlandsRec = editor.create({ outline });
  editor.run();
  
}});
