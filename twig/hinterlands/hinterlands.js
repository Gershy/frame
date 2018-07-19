/*

TODO:
[X] FUCK WALKERS. Work with hill / valley huts instead. Simple flat list of
    connections with a "type" option for each
[X] This "hutSet" should be OUTSIDE Hinterland's public subtree
[X] Now some operations may depend less on CLIENT / SERVER, and more on
    whether the hut which initiated the operation is upward or downward.
[X] Get updateFuncs working
[X] Account / login behaviour, in its own GODDAM file. Steppe huts need to
    be able to be aware of each other, syncing from a common hill hut.
[ ] Chess2 matchmaking system. Have a lobby holding max 1 person; whenever
    an opponent is present pair em up and make em fight
[ ] Get the rest of Chess2 done!!

MORE DECLARATIVE UPDATE ACTIONS
think about data updates and func updates similarly! They both use frameId and
frameNum, they should both have access to "srcHut".

let srcHut = ...
let updateType = ...    // 'data'         'func'
let details = { ... }   // { 

{
  { name: 'update', details: { root, data } } => {
    
    let editor = Editor();
    
  
  }

}

*/

// TODO: I hate the multiline ` ... ` strings

/// {SERVER=
let aliveMs = U.timeMs();
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

U.makeTwig({ name: 'hinterlands', twigs: [ 'record' ], make: (hinterlands, record) => {
  
  const { Val, Obj, Arr, Ref, RecordVal, RecordObj, RecordArr, Editor } = record;
  
  const ACCESS = { NONE: 0, READ: 1, FULL: 2 };
  
  // ==== Util
  const Encounter = U.makeClass({ name: 'Encounter', methods: (insp, Cls) => ({
    
    init: function({ passage, passageData={}, ip, message, details={} }) {
      
      // An Encounter happens between us and another Hut, via a Passage.
      // There will be a brief "message" for us, and optionally further
      // "details" for that message.
      
      if (!message) throw new Error('Missing "message" param');
      
      this.hinterlands = null;
      this.passage = passage;
      this.passageData = passageData;
      this.ip = ip;
      this.message = message;
      this.details = details;
      this.hut = null;
      
    },
    copy: function(message=null, details=null) {
      
      let enc = Encounter({
        passage: this.passage,
        passageData: this.passageData,
        ip: this.ip,
        message: message || this.message,
        details: details || this.details
      });
      
      enc.hut = this.hut;
      
      return enc;
      
    },
    describe: function() {
      
      return `${this.constructor.name}(${this.message}: ${JSON.stringify(this.details, null, 2)})`;
      
    }
    
  })});
  const Journey = U.makeClass({ name: 'Journey', methods: (insp, Cls) => ({
    
    // An outgoing expedition with a foreign goal in mind
    
    init: function({}) {
      
    },
    getContentType: function() { throw new Error('not implemented'); },
    getHttpStatusCode: function() { throw new Error('not implemented'); },
    getSerializedContent: function() { throw new Error('not implemented'); } // Returns either String or Buffer
    
  })});
  const JourneyWarn = U.makeClass({ name: 'JourneyWarn', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ error, status=400 }) {
      
      insp.Journey.init.call(this, {});
      this.error = error;
      this.status = status;
      
    },
    getContentType: function() { return 'application/json'; },
    getHttpStatusCode: function() { return this.status; },
    getSerializedContent: function() {
      
      return U.thingToString({
        message: 'warning',
        details: {
          errorDescription: this.error.message
        }
      });
      
    }
    
  })});
  const JourneyJson = U.makeClass({ name: 'JourneyJson', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ message, details=null }) {
      
      insp.Journey.init.call(this, {});
      this.message = message;
      this.details = details;
      
    },
    getContentType: function() { return 'application/json'; },
    getHttpStatusCode: function() { return 200; },
    getSerializedContent: function() {
      
      return U.thingToString({
        message: this.message,
        details: this.details
      });
      
    }
    
  })});
  const JourneyBuff = U.makeClass({ name: 'JourneyBuff', inspiration: { Journey }, methods: (insp, Cls) => ({
    
    init: function({ type='generic', buffer }) {
      
      insp.Journey.init.call(this, {});
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
    getSerializedContent: function() { return this.buffer; }
    
  })});
  const JourneyNull = U.makeClass({ name: 'JourneyNull', inspiration: { Journey }, methods: (insp, Cls) => ({
    getContentType: function() { return 'text/plain'; },
    getHttpStatusCode: function() { return 200; },
    getSerializedContent: function() { return U.thingToString(null); }
  })});
  
  // ==== Outlines
  const OutlineHinterlands = U.makeClass({ name: 'OutlineHinterlands', inspiration: { Obj }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=Hinterlands, deployment }) {
      
      insp.Obj.init.call(this, { name, recCls });
      this.deployment = deployment;
      this.updateFuncs = {};
      
      // Holds data which must be objective between all vallied huts
      this.objective = this.add(Obj({ name: 'objective' }));
      
      // Keep track of known huts
      let otlHutSet = this.add(Arr({ name: 'hutSet' }));
      let otlHut = otlHutSet.setTemplate(Obj({ name: 'hut', recCls: Hut }), hut => hut.getChild('ip').value);
      otlHut.add(Val({ name: 'ip' }));          // In compact hex format
      otlHut.add(Val({ name: 'acclivity' }));   // valley || hill
      otlHut.add(Val({ name: 'joinMs' }));
      otlHut.add(Val({ name: 'activityMs' }));
      
      // For each hut, keep track of all connecting passages
      let otlPassages = otlHut.add(Arr({ name: 'passages' }));
      let otlPassage = otlPassages.setTemplate(Obj({ name: 'passage' }), passage => passage.getChild('name').getValue());
      otlPassage.add(Val({ name: 'name' }));
      otlPassage.add(Val({ name: 'health' }));
      
    },
    addUpdateFunc: function(name, func) {
      if (O.has(this.updateFuncs, name)) throw new Error(`Tried to overwrite updateFunc "${name}"`);
      this.updateFuncs[name] = func;
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
      this.srcHillHut = null; // Tells if there is a hut above us
      
      /// {SERVER=
      
      this.nextFrameId = 0; // The frameId to give the next client requiring a frameId
      this.hutDataAccessFunc = () => ACCESS.FULL;
      
      /// =SERVER} {CLIENT=
      
      this.onHutSetWobble = (delta) => {
        A.each(delta.rem, hut => {
          if (hut.getChild('acclivity').value !== 'hill') return;
          if (hut === this.srcHillHut) this.srcHillHut = null;
          O.each(this.passages, passage => passage.shutForHillHut(hut));
        });
        A.each(delta.add, hut => {
          if (hut.getChild('acclivity').value !== 'hill') return;
          if (!this.srcHillHut) this.srcHillHut = hut;
          O.each(this.passages, passage => passage.openForHillHut(hut));
        });
      };
      this.frameId = null;
      this.frameNum = 0; // Number of the server state we currently match
      this.pendingFrames = {};
      
      /// =CLIENT}
      
    },
    getTmpActions: function() {
      
      return insp.RecordObj.getTmpActions.call(this).concat([
        /// {CLIENT=
        {
          up: function() { this.getChild('hutSet').hold(this.onHutSetWobble); },
          dn: function() { this.getChild('hutSet').drop(this.onHutSetWobble); }
        },
        /// =CLIENT}
        {
          up: function() { U.output('Ain\'t it breezy out here in the Hinterlands?'); },
          dn: function() { U.output('Now we\'re somewhere the roads don\'t go.'); }
        }
      ]);
      
    },
    normalizeEncounter: function(encounter) {
      
      /*
      Between two huts the categories of data are:
      
      1)  Hut data: Arbitrary data on the remote hut
      2)  Passage transit data: Extra data generated by the Passage to manage the
          current request
      3)  Passage-hut data: Persistent data for use by the Passage regarding our
          connection with this particular hut
      
      Implementation:
      
      1) Stored on the Record tree under the hutSet
      2) Stored at `anEncounterInstance.passageData`
      3) Stored at `aHutInstance.passageHutData[aPassageInstance.name]`
      */
      
      // Ensure that `this` is the Hinterlands for `encounter`
      encounter.hinterlands = this;
      
      let editor = Editor();
      let timeMs = U.timeMs();
      let passage = encounter.passage; // `encounter.passage` is initialized earlier (by the Passage)
      let hutSet = this.getChild('hutSet');
      
      // Get/create the hut (it's reaching out to us, so it must be in the valley)
      let hut = hutSet.getChild(encounter.ip) || editor.shape({
        par: hutSet,
        data: { type: 'exact', children: {
          ip: encounter.ip,
          acclivity: 'valley',
          joinMs: timeMs,
          persona: null
        }}
      });
      
      // Update the time of last activity
      editor.shape({ rec: hut.getChild('activityMs'), data: timeMs });
      
      // Get/create the Passage
      // TODO: Update passage health??
      let passages = hut.getChild('passages');
      let hutPassage = passages.getChild(passage.name) || editor.shape({
        rec: passages,
        data: { type: 'delta', add: {
          0: { type: 'exact', children: {
            name: passage.name,
            health: 0.5
          }}
        }}
      });
      
      editor.run();
      
      // Attach the hut to the encounter
      encounter.hut = hut;
      
    },
    
    /// {CLIENT=
    updateFrameId: function(newId) {
      this.frameId = newId;
      this.frameNum = 0;
      this.pendingFrames = {};
    },
    /// =CLIENT}
    beginEncounter: async function(encounter) {
      
      this.normalizeEncounter(encounter);
      
      try {
        await this.encounter(encounter);
      } catch(error) {
        this.journey({ encounter, journey: JourneyWarn({ error }) });
      }
      
      encounter.passage.finalizeEncounter(encounter);
      
    },
    encounter: async function(encounter) {
      
      let hut = encounter.hut;
      let hutAcclivity = hut.getChild('acclivity').value;
      let hutIp = hut.getChild('ip').value;
      U.output(`${hutIp} ${(hutAcclivity === 'hill') ? '<<' : '>>'} ${encounter.message}`, encounter.details);
      
      /// {SERVER=
      if (hutAcclivity === 'valley') return await this.encounterValleyHut(encounter);
      /// =SERVER} {CLIENT=
      if (hutAcclivity === 'hill') return await this.encounterHillHut(encounter);
      /// =CLIENT}
      
      throw new Error(`Unable to encounter ${hutAcclivity} hut`);
      
    },
    applyUpdateAndBroadcastDownwards: function(rec, data) {
      
      let relAddress = rec.getAddress().slice(this.getAncestryDepth() + 1); // `+1` accounts for dereferencing "objective"
      
      let editor = Editor();
      editor.shape({ rec, data });
      editor.run();
      
      /// {SERVER=
      O.each(this.getChild('hutSet').children, hut => {
        
        // Don't broadcast upwards
        if (hut.getChild('acclivity').getValue() === 'hill') return;
        
        // Don't broadcast to huts without read permission
        if (this.hutDataAccessFunc(hut, rec) < ACCESS.READ) return;
        
        // Deliver the update command downwards
        this.journey({ hut, journey: JourneyJson({
          message: 'update',
          details: {
            frameId: hut.frameId,
            frameNum: hut.frameNum++,
            root: relAddress,
            data
          }
        })});
        
      });
      /// =SERVER}
      
    },
    applyUpdateFuncAndBroadcastDownwards: function(name, srcHut, params={}) {
      
      if (!O.has(this.outline.updateFuncs, name)) throw new Error(`Couldn't find updateFunc "${name}"`);
      this.outline.updateFuncs[name](this, srcHut, params);
      
      /// {SERVER=
      O.each(this.getChild('hutSet').children, hut => {
        
        // Don't broadcast upwards
        if (hut.getChild('acclivity').getValue() === 'hill') return;
        
        this.journey({ hut, journey: JourneyJson({
          message: 'updateFunc',
          details: {
            frameId: hut.frameId,
            frameNum: hut.frameNum++,
            name,
            params
          }
        })});
        
      });
      /// =SERVER}
      
    },
    update: function(rec, data) {
      
      // If we have a `srcHillHut`, update upwards towards it!
      let isUpwardsUpdate = !!this.srcHillHut;
      
      /// {SERVER=
      if (!isUpwardsUpdate) return this.applyUpdateAndBroadcastDownwards(rec, data);
      /// =SERVER} {CLIENT=
      if (isUpwardsUpdate) {
        
        let relAddress = rec.getAddress().slice(this.getAncestryDepth() + 1); // `+1` accounts for dereferencing "objective"
        
        return this.journey({ hut: this.srcHillHut, journey: JourneyJson({
          message: 'pleaseUpdate',
          details: {
            root: relAddress,
            data: data
          }
        })});
        
      }
      /// =CLIENT}
      
      throw new Error(`Unable to update ${isUpwardsUpdate ? 'upwards' : 'downwards'}`);
      
    },
    updateFunc: function(name, params={}) {
      
      // If we have a `srcHillHut`, update upwards towards it!
      let isUpwardsUpdate = !!this.srcHillHut;
      
      /// {SERVER=
      if (!isUpwardsUpdate) return this.applyUpdateFuncAndBroadcastDownwards(name, null, params);
      /// =SERVER} {CLIENT=
      if (isUpwardsUpdate) {
        
        return this.journey({ hut: this.srcHillHut, journey: JourneyJson({
          message: 'pleaseUpdateFunc',
          details: { name, params }
        })});
        
      }
      /// =CLIENT}
      
      throw new Error(`Unable to updateFunc ${isUpwardsUpdate ? 'upwards' : 'downwards'}`);
      
    },
    
    /// {SERVER=
    encounterValleyHut: async function(encounter) {
      
      if (encounter.message === 'passageMessage') {
        
        let details = encounter.details;
        
        if (!O.has(details, 'name')) throw new Error('Missing "name" param');
        if (!O.has(details, 'message')) throw new Error('Missing "message" param');
        
        let name = details.name;
        if (!O.has(this.passages, name)) throw new Error(`Invalid passage name: "${name}"`);
        
        let message = details.message;
        let details0 = O.has(details, 'details') ? details.details : {};
        
        return await this.passages[name].encounter(encounter.copy(message, details0));
        
      } else if (encounter.message === 'pleaseCatchUp') {
        
        // TODO: Sanitize this somewhat?? Maybe hutDataAccessFunc protects
        // some fields... (this will be tricky)
        let objectiveState = this.getChild('objective').getJson();
        
        // Reset the hut's server-side frame tracking
        encounter.hut.updateFrameId(this.nextFrameId++);
        
        // Send the client's full state along with a new frame id
        this.journey({ hut: encounter.hut, journey: JourneyJson({
          message: 'catchUp',
          details: {
            newFrameId: encounter.hut.frameId,
            state: objectiveState
          }
        })});
        
        return;
        
      } else if (encounter.message === 'greetings') {
        
        let hutName = this.outline.deployment.plan;
        
        let twig = TWIGS[hutName];
        await twig.promise;
        
        let [ [ essentialsContent, clientEssentialsContent ], fileDataList ] = await Promise.all([
          
          // Load the clearing
          Promise.all([
            readFile('utf8', __dirname, '..', '..', 'clearing', 'essentials.js'),
            readFile('utf8', __dirname, '..', '..', 'clearing', 'clientEssentials.js')
          ]),
          
          // Load all twigs
          Promise.all(A.map(A.include([ 'clearing' ], twig.twigList), async (twigName) => {
            
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
        
        // Setup any node objects required by setup, but absent in browser
        let initContents = S.trim(`
global.process = {
  argv: [
    'browser: ' + (navigator.userAgent || 'unknownUserAgent'),
    'hut.js',
    '--plan ${hutName}',
    '--host 127.0.0.1',
    '--port ' + (window.location.port || '80') // TODO: Account for https
  ]
};`);
        
        // Setup the hut environment
        let environmentContents = S.trim(`
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
//throw new Error('hey');`);
        
        fileDataList = [
          
          { name: 'clearing/init.js', offsets: [], content: deflateContents(initContents) },
          { name: 'clearing/essentials.js', content: deflateContents(essentialsContent), offsets: [] },
          { name: 'clearing/clientEssentials.js', content: deflateContents(clientEssentialsContent), offsets: [] },
          { name: 'clearing/environment.js', offsets: [], content: deflateContents(environmentContents) },
          
          ...A.reverse(fileDataList) // Reverse order ensures dependencies always precede dependees
          
        ];
        
        let lineOffset = 17; // A simple manual count of how many lines occur before the first js
        let compilerData = {};
        let compoundJs = [];
        
        // Reversing allows dependencies to always preceed dependees
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
        
        if (encounter.hut.frameId === null) encounter.hut.updateFrameId(this.nextFrameId++);
        
        let html = S.trim(`
<!DOCTYPE html>
<html>
<head>
<title>${hutName}</title>
<meta charset="utf-8"/>
<meta name="description" content="hut">
<meta name="keywords" content="hut ${this.name}">
<meta name="viewport" content="width=device-width"/>
<link rel="icon" type="image/x-icon" href="favicon.ico"/>
<script type="text/javascript">
'use strict';
window.global = window;
global.INITIAL_FRAME_ID = ${encounter.hut.frameId};
global.INITIAL_HUT_SET_DATA = ${JSON.stringify({
  [ this.outline.deployment.ip ]: {
    ip: this.outline.deployment.ip,
    acclivity: 'hill',
    joinMs: U.timeMs(),
    activeMs: U.timeMs()
  }
})};
global.INITIAL_CATCH_UP_DATA = ${JSON.stringify(this.getChild('objective').getJson())};
global.COMPILER_DATA = ${JSON.stringify(compilerData)};
${compoundJs}
(async () => await compiler.run('clearing'))();
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
        `);
        
        return this.journey({ encounter, journey: JourneyBuff({
          type: 'html',
          buffer: html
        })});
        
      } else if (encounter.message === 'favicon.ico') {
        
        return this.journey({ encounter, journey: JourneyBuff({
          type: 'icon',
          buffer: await readFile('binary', __dirname, '..', '..', 'clearing', 'favicon.ico')
        })});
        
      } else if (encounter.message === 'pleaseUpdate') {
        
        let details = encounter.details;
        if (!O.has(details, 'root')) throw new Error('Missing "root" param');
        if (!O.has(details, 'data')) throw new Error('Missing "data" param');
        
        let { root, data } = details;
        if (!U.isType(root, Array)) throw new Error(`Invalid "root" param (expected Array; got ${U.typeOf(root)})`);
        
        if (this.srcHillHut) {
          
          // Continue upwards
          let srcHutName = O.has(details, 'srcHutName') ? details.srcHutName : encounter.hut.getChild('ip').value;
          this.journey({ hut: this.srcHillHut, journey: JourneyJson({
            message: 'pleaseUpdate',
            details: { srcHutName, root, data }
          })});
          
        } else {
          
          // Safely get the addressed child
          let rec = this.getObjectiveChild(root);
          if (!rec) throw new Error(`Invalid "root" param: ${root.join('.')}`);
          
          // Ensure access conditions are met
          let access  = this.hutDataAccessFunc(encounter.hut, rec);
          if (access < ACCESS.FULL) throw new Error(`Unauthorized; ${encounter.hut.describe()} can't modify ${rec.describe()}`);
          
          // Do the update
          await this.update(rec, data);
          
        }
        
        return;
        
      } else if (encounter.message === 'pleaseUpdateFunc') {
        
        let details = encounter.details;
        let { name, params } = details;
        if (!U.isType(name, String)) throw new Error(`Invalid "name" param (expected String, got ${U.typeOf(name)})`);
        if (!U.isType(params, Object)) throw new Error(`Invalid "params" param (expected Object, got ${U.typeOf(params)})`);
        
        if (this.srcHillHut) {
          
          let srcHutName = O.has(details, 'srcHutName') ? details.srcHutName : encounter.hut.getChild('ip').value;
          this.journey({ hut: this.srcHillHut, journey: JourneyJson({
            message: 'pleaseUpdateFunc',
            details: { srcHutName, name, params }
          })});
          
        } else {
          
          let srcHut = O.has(details, 'srcHutName')
            ? this.getChild([ 'hutSet', details.srcHutName ])
            : encounter.hut;
          
          this.applyUpdateFuncAndBroadcastDownwards(name, srcHut, params);
          
        }
        
        return;
        
      }
      
      throw new Error(`Couldn't process valley encounter: ${encounter.describe()}`);
      
    },
    /// =SERVER} {CLIENT=
    encounterHillHut: async function(encounter) {
      
      if (encounter.message === 'passageMessage') {
        
        let details = encounter.details;
        
        if (!O.has(details, 'name')) throw new Error('Missing "name" param');
        if (!O.has(details, 'message')) throw new Error('Missing "message" param');
        
        let name = details.name;
        if (!O.has(this.passages, name)) throw new Error(`Invalid passage name: "${name}"`);
        
        let message = details.message;
        let details0 = O.has(details, 'details') ? details.details : {};
        
        return await this.passages[name].encounter(encounter.copy(message, details0));
        
      } else if (encounter.message === 'catchUp') {
        
        // TODO: What if a "catchUp" is quickly followed by an "update" (in
        // the new frame), and the "update" arrives first?? It will be
        // discarded since its "frameId" is wrong. Then, the very first
        // frameNum will never be received after the "catchUp" applies, since
        // the necessary frameNum has already been discarded.
        
        let details = encounter.details;
        let { state, newFrameId } = details;
        
        let editor = Editor();
        editor.shape({ rec: this.getChild('objective'), data: state, assumeType: 'exact' });
        editor.run();
        
        this.updateFrameId(newFrameId);
        
        return;
        
      } else if (encounter.message === 'update' || encounter.message === 'updateFunc') {
        
        let type = (encounter.message === 'update') ? 'data' : 'func';
        
        let { details } = encounter;
        let { frameId, frameNum } = details;
        if (frameId !== this.frameId) {
          U.output(`Discarding an update to an invalid frameId (we have frameId ${this.frameId}; received ${frameId})`);
          return;
        }
        
        let srcHut = O.has(details, 'srcHutName')
          ? this.getChild([ 'hutSet', details.srcHutName ])
          : null;
        
        if (type === 'data') {
          if (!O.has(details, 'root')) throw new Error('Missing "root" param');
          if (!U.isType(details.root, Array)) throw new Error(`Invalid "root" param (expected Array; got ${U.typeOf(details.root)})`);
          if (!O.has(details,' data')) throw new Error('Missing "data" param');
          if (!U.isType(details.data, Object)) throw new Error(`Invalid "data" param (expected Object; got ${U.typeOf(details.data)})`);
        } else if (type === 'func') {
          if (!O.has(details, 'name')) throw new Error('Missing "name" param');
          if (!U.isType(details.name, String)) throw new Error(`Invalid "name" param (expected String; got ${U.typeOf(details.name)})`);
          if (!O.has(details, 'params')) throw new Error('Missing "params" param');
          if (!U.isType(details.params, Object)) throw new Error(`Invalid "params" param (expected Object; got ${U.typeOf(details.params)})`);
        }
        
        this.pendingFrames[frameNum] = { srcHut, type, details };
        
        if (!O.has(this.pendingFrames, this.frameNum)) U.output(`Can\'t process any frames yet; waiting on frame ${this.frameNum}`);
        while (O.has(this.pendingFrames, this.frameNum)) {
          
          try {
            
            U.output(`Advancing from frame ${this.frameNum} -> ${this.frameNum + 1}`);
            
            let { type, details } = this.pendingFrames[this.frameNum];
            if (type === 'data') {
              let { srcHut, root, data } = details;
              let rec = this.getObjectiveChild(root);
              if (!rec) throw new Error(`Bad address: ${root.join('.')}`);
              this.applyUpdateAndBroadcastDownwards(rec, data);
            } else if (type === 'func') {
              let { srcHut, name, params } = details;
              this.applyUpdateFuncAndBroadcastDownwards(name, srcHut, params);
            }
            
          } catch(err) {
            
            // TODO: The best way to recover may be to drop everything and "catchUp"
            U.output(COMPILER.formatError(err));
            throw new Error('How to recover? The server told us to do something invalid');
            
          }
          
          this.frameNum++;
          
        }
        
        return;
        
      }
      
      throw new Error(`Couldn't process hill encounter: ${encounter.describe()}`);
      
    },
    catchUp: async function() {
      
      if (!this.srcHillHut) throw new Error('Can\'t catch up; no hill hut!');
      await this.journey({ hut: this.srcHillHut, journey: JourneyJson({ message: 'pleaseCatchUp' }) });
      
    },
    /// =CLIENT}
    
    getObjectiveChild: function(addr) {
      
      if (!U.isType(addr, Array)) throw new Error(`Invalid "addr" param (expected Array, get ${U.typeOf(addr)})`);
      
      let rec = this.getChild('objective');
      for (var i = addr.length - 1; rec && i >= 0; i--) rec = O.has(rec.children, addr[i]) ? rec.children[addr[i]] : null;
      return rec;
      
    },
    journey: function({ hut=null, encounter=null, journey }) {
      
      if (!journey) throw new Error('Missing "journey" param');
      if (!hut && !encounter) throw new Error('Need to provide 1 of "hut" and "encounter"');
      if (!hut && !encounter.hut) throw new Error('Couldn\'t get a value for "hut"')
      
      if (!hut && encounter) hut = encounter.hut;
      
      if (U.isInspiredBy(journey, JourneyWarn)) U.output('Broadcasting error response due to encounter error:\n' + COMPILER.formatError(journey.error));
      
      let passage = encounter ? encounter.passage : O.firstVal(this.passages);
      return passage.journey({ hut, encounter, journey });
      
    }
    
  })});
  const Hut = U.makeClass({ name: 'Hut', inspiration: { RecordObj }, methods: (insp, Cls) => ({
    
    init: function({ outline }) {
      
      insp.RecordObj.init.call(this, { outline });
      this.passageHutData = {};
      
      /// {SERVER=
      this.frameId = null;
      this.frameNum = 0;
      /// =SERVER}
      
    },
    /// {SERVER=
    updateFrameId: function(newId) {
      this.frameId = newId;
      this.frameNum = 0;
    },
    /// =SERVER}
    getPassageHutData: function(passage) {
      
      if (!O.has(this.passageHutData, passage.name))
        this.passageHutData[passage.name] = passage.genDefaultPassageHutData(this);
      
      return this.passageHutData[passage.name];
      
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
    /// {SERVER=
    openForValleyHut: async function(valleyHut) { throw new Error('not implemented'); },
    shutForValleyHut: async function(valleyHut) { throw new Error('not implemented'); },
    /// =SERVER} {CLIENT=
    openForHillHut: async function(hillHut) { throw new Error('not implemented'); },
    shutForHillHut: async function(hillHut) { throw new Error('not implemented'); },
    /// =CLIENT}
    
    genDefaultPassageHutData: function(hut) {
      return {};
    },
    
    finalizeEncounter: function(encounter) { throw new Error('not implemented'); },
    
    journey: function({ hut, encounter=null, journey }) { throw new Error('not implemented'); }
    
  })});
  const PassageHttp = U.makeClass({ name: 'PassageHttp', inspiration: { Passage }, methods: (insp, Cls) => ({
    
    init: function(params) {
      
      insp.Passage.init.call(this, params);
      this.server = null;
      
      /// {CLIENT=
      // Note that `numPendingRequests` can at times exceed `maxPendingRequests`;
      // e.g. if polls are fully banked and another request is explicitly begun.
      this.maxPendingRequests = O.has(params, 'maxPendingRequests') ? params.maxPendingRequests : 2;
      this.numPendingRequests = 0;
      /// =CLIENT}
      
    },
    openPassage: async function() {
      
      let { port, host } = this.outline.hinterlands.deployment;
      
      /// {SERVER=
      
      this.server = http.createServer((...args) => this.processRequest(...args));
      await new Promise((rsv, rjc) => this.server.listen(port, host, 511, rsv));
      
      /// =SERVER} {CLIENT=
      
      /// =CLIENT}
      
      U.output(`Http passage open: "${this.name}" (${host}:${port})`);
      
    },
    shutPassage: async function() {
      
      /// {SERVER=
      throw new Error('not implemented');
      /// =SERVER} {CLIENT=
      // Do nothing
      /// =CLIENT}
      
    },
    genDefaultPassageHutData: function(hut) {
      return {
        pendingJourneys: [],
        bankedEncounters: []
      };
    },
    
    /// {CLIENT=
    openForHillHut: async function(hillHut) {
      
      // Initially release any stale polls, and bank new ones
      let addr = this.getAddress('arr');
      this.journey({ hut: hillHut, encounter: null, journey: JourneyJson({
        message: 'passageMessage',
        details: {
          name: this.name,
          message: 'releasePolls'
        }
      })});
      while (this.numPendingRequests < this.maxPendingRequests)
        this.journey({ hut: hillHut, encounter: null, journey: JourneyJson({
          message: 'passageMessage',
          details: {
            name: this.name,
            message: 'bankPoll'
          }
        })});
      
    },
    shutForHillHut: async function(hillHut) {
      
    },
    /// =CLIENT}
    
    parseEncounterData: async function(httpReq, protocol='http') {
      
      // TODO: Need to determine if the IP is trusted
      // nginx can supposedly do it, so why not nodejs?
      
      // Get the ip in verbose form, and a compact `ip` value consisting of 8 hex digits
      let ipVerbose = (httpReq.headers['x-forwarded-for'] || httpReq.connection.remoteAddress).split(',')[0].trim();
      let ip = U.compactIp(ipVerbose);
      
      // Get the url value
      let url = httpReq.url;
      
      // Get the protocol if it's included in the url
      let protocolInd = S.indexOf(url, '://'); // TODO: Not a smart check. What about arbitrary values in url params?
      if (protocolInd >= 0) {
        protocol = url.substr(0, protocolInd);
        url = url.substr(protocolInd + 3);
      }
      
      // Remove any prefixing "/" from the url
      if (url[0] === '/') url = url.substr(1);
      
      // This `encounterData` value will hold all data relevant to the encounter
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
      if (!O.has(encounterData, 'message')) encounterData.message = url.join('/') || 'greetings';
      if (!O.has(encounterData, 'details')) encounterData.details = {};
      
      return encounterData;
      
    },
    processRequest: async function(httpReq, httpRes) {
      
      try {
        
        let encounterData = await this.parseEncounterData(httpReq);
        let hinterlandsRec = this.getPar(this.outline.hinterlands);
        
        await hinterlandsRec.beginEncounter(Encounter({
          passage: this,
          passageData: { httpReq, httpRes, available: true },
          ip: encounterData.ip,
          message: encounterData.message,
          details: encounterData.details
        }));
        
      } catch(err) {
        
        err.message = 'Http misinterpretation: ' + err.message;
        U.output(COMPILER.formatError(err));
        
        httpRes.statusCode = 400;
        httpRes.end('Http error', 'utf8');
        
      }
      
    },
    
    encounter: async function(encounter) {
      
      /// {SERVER=
      if (encounter.message === 'releasePolls') {
        
        let passageHutData = encounter.hut.getPassageHutData(this);
        A.each(passageHutData.bankedEncounters, encounter => {
          this.launchJourney(encounter, JourneyNull());
        });
        passageHutData.bankedEncounters = [];
        
      } else if (encounter.message === 'bankPoll') {
        
        if (encounter.passage !== this) throw new Error('Invalid encounter');
        let passageHutData = encounter.hut.getPassageHutData(this);
        let pendingJourney = passageHutData.pendingJourneys.shift();
        if (pendingJourney) {
          this.launchJourney(encounter, pendingJourney);
        } else {
          passageHutData.bankedEncounters.push(encounter);
          encounter.passageData.available = false;
        }
        
      }
      /// =SERVER}
      
    },
    journey: function({ hut, encounter=null, journey }) {
      
      if (!hut) throw new Error('Missing "hut" param');
      if (encounter && encounter.hut !== hut) throw new Error('Encounter doesn\'t line up with Hut');
      
      let isDownwardsJourney = hut.getChild('acclivity').value === 'valley';
      
      /// {SERVER=
      if (isDownwardsJourney) return this.journeyDownwards({ hut, encounter, journey });
      /// =SERVER} {CLIENT=
      if (!isDownwardsJourney) return this.journeyUpwards({ hut, encounter, journey });
      /// =CLIENT}
      
      throw new Error(`Unable to journey ${isDownwardsJourney ? 'downwards' : 'upwards'}`);
      
    },
    
    /// {SERVER=
    journeyDownwards: function({ hut, encounter=null, journey }) {
      
      // See if we can respond using the immediately available `encounter`
      if (encounter && encounter.passage === this && encounter.passageData.available)
        return this.launchJourney(encounter, journey);
      
      // Get the passage-hut data...
      let passageHutData = hut.getPassageHutData(this);
      
      // Try to use a banked encounter to launch the journey
      if (passageHutData.bankedEncounters.length)
        return this.launchJourney(passageHutData.bankedEncounters.shift(), journey);
      
      // No way to launch the journey at this time; need to bank it
      passageHutData.pendingJourneys.push(journey);
      
    },
    launchJourney: function(encounter, journey) {
      
      if (encounter.passage !== this) throw new Error('Invalid "encounter" param (not owned by this passage)');
      
      // TODO: Not sure if this check is necessary.
      // Taking it out because it catches banked polls which are still usable ("available" is a misnomer)
      //if (!encounter.passageData.available) throw new Error('Invalid "encounter" param (httpRes already ended)');
      
      let content = journey.getSerializedContent();
      if (U.isType(content, String)) content = Buffer.from(content, 'utf8');
      
      let httpRes = encounter.passageData.httpRes;
      httpRes.writeHead(journey.getHttpStatusCode(), {
        'content-type': journey.getContentType(),
        'content-length': content.length
      });
      httpRes.end(content, 'binary');
      
      encounter.passageData.available = false;
      
    },
    /// =SERVER} {CLIENT=
    journeyUpwards: function({ hut, encounter=null, journey }) {
      
      this.numPendingRequests++;
      
      let xhr = new XMLHttpRequest();
      
      (async () => {
        
        try {
        
          let response = await new Promise((rsv, rjc) => {
            xhr.onreadystatechange = () => {
              if (xhr.readyState !== 4) return;
              if (xhr.status === 0) rsv(null); // TODO: This may silence cross-domain errors (indicated by `xhr.status === 0`)
              try {
                let payload = U.stringToThing(xhr.responseText);
                if (xhr.status === 200) return rsv(payload);
                if (U.isType(payload, Object) && O.has(payload, 'message') && payload.message === 'warning')
                  throw new Error(`Known http error: ${payload.details.errorDescription}`);
                throw new Error(`UNKNOWN http error: ${'\n'}${JSON.stringify(payload, null, 2)}`);
              } catch(err) {
                rjc(err);
              }
            };
          });
          
          // Note that `!response` responses are ignored; they represent http-specific poll releasing
          // Otherwise `response` values are constructed into Encounters, and occur
          if (response)
            await this.hinterlands.beginEncounter(Encounter({
              passage: this,
              passageData: {},
              ip: this.hinterlands.outline.deployment.ip, // TODO: This is the hostname, not the IP
              message: response.message,
              details: response.details
            }));
          
        } catch(err) {
          
          U.output('Error receiving HTTP:', COMPILER.formatError(err));
          
        } finally {
          
          this.numPendingRequests--;
          
          // Bank a new poll if we have room to do so
          if (this.numPendingRequests < this.maxPendingRequests)
            this.journey({ hut, encounter: null, journey: JourneyJson({
              message: 'passageMessage',
              details: {
                name: this.name,
                message: 'bankPoll'
              }
            })});
          
        }
        
      })();
      
      let xhrUrl = ''; // TODO: If spoofing params are needed here
      xhr.open('POST', xhrUrl, true);
      xhr.setRequestHeader('Content-Type', journey.getContentType());
      xhr.send(journey.getSerializedContent());
      
    },
    /// =CLIENT}
    
    finalizeEncounter: function(encounter) {
      /// {SERVER=
      // TODO: This isn't enough! Need to check if the encounter is upwards or downwards!
      if (encounter.passageData.available) this.launchJourney(encounter, JourneyNull());
      /// =SERVER}
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
    ACCESS,
    Encounter,
    Journey, JourneyWarn, JourneyJson, JourneyBuff, JourneyNull,
    OutlineHinterlands, OutlinePassage,
    Hinterlands, Hut, Passage, PassageHttp, PassageSokt
  });
  
}});
