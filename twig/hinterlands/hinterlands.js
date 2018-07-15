/*

TODO:
[]  FUCK WALKERS. Work with hill / valley huts instead. Simple flat list of
    connections with a "type" option for each
[]  This "hutSet" should be OUTSIDE Hinterland's public subtree
[]  Now some operations may depend less on CLIENT / SERVER, and more on
    whether the hut which initiated the operation is upward or downward.
[]  Account / login behaviour, in its own GODDAM file. Steppe huts need to
    be able to be aware of each other, syncing from their upwards hut.
[]  Chess2 matchmaking system. Have a lobby holding max 1 person; whenever
    an opponent is present pair em up and make em fight
[]  Get the rest of Chess2 done!!


NETWORK MODEL
A hut is an instance of this app running on a physical machine. Therefore
it is possible to talk about "this hut".
Uphill huts have full control over this hut.
Downhill huts are fully controlled by this hut.

- It doesn't make sense to "login" to a downhill hut. Login can only happen upwards
- Huts don't need to know / communicate about other uphill / downhill huts
- Huts still MAY decide to reflect data concerning other huts publicly
- E.g. "logged in users" is synced by an uphill hut with a custom "userSet" Record
  which updates to reflect all downhill huts, and tells all downhill huts about
  each other.
- Network models can be more complex than just a bunch of huts downhill to a
  particular single hut (although this is the typical browser->server model)
- This could make CLIENT/SERVER nondescriptive, since huts may be able to be both.
  CLIENT/SERVER more indicate whether the hut installation is CAPABLE of being
  vallied/hilly respectively
  
"WALKER"
There are 3 different kinds of walkers, between server/client/hut.
There are "srcWalkers", who have full control over our own state
There are "trgWalkers", over whose state we have full control
Both of these lists of walkers are private; essentially, we don't
want to allow any trgWalkers to know about either src OR trgWalkers
The only kind of "public" walkers whose presence should be known
among all walkers are PERSONAS.

ACCESS CONSIDERATIONS:

==== Permissions
- Some data is client-only (e.g. "alreadyPlayedClickSound")
  - There shouldn't be many of these fields; they are settings which are forgotten on refresh
- Some data is server-only
- Some data isn't available to any client
- Some data is only available to a subset of clients
- Any data may be unavailable, read-only, or available to clients (are there any write-only use-cases?)

==== Consider
Server-side-only data could be outside the hinterlands' subtree. Same for Client-side-only data.
The disadvantage is that references to remote Records will have to use paths relative to the
Hinterlands.

let getWalkerDataAccess = (walker, rec) => {

  // Returns walker's data access ability over `rec` (`rec` and its full subtree)
  // Returns 'none' | 'read' | 'full'
  
  // Check fine-grained permissions; e.g. "Is `rec` a user's password field??"
  
  // e.g. protect any server-only data:
  if (A.any(rec.getAncestry(), par => par.outline === serverOnlyOutline)) return 'none';
  
  return 'full';
  
};
let canWalkerRead = (walker, rec) => A.contains([ 'read', 'full' ], getWalkerDataAccess(walker, rec));
let canWalkerWrite = (walker, rec) => getWalkerDataAccess(walker, rec) === 'full';

// When a value changes:

let modifyRec = (walker, aspect, data) => {
  
  let hinterlands = getInstanceOfHinterlands(); // NOTE: `aspect` is the path to the desired Record relative to `hinterlands`
  
  let rec = hinterlands.getChild(aspect); // Need to ensure that `getChild` can only DESCEND into the subtree (e.g. disallow "~par")
  if (!rec) throw new Error('Invalid aspect');
  
  /// {SERVER=
  if (!canWalkerWrite(walker, rec)) throw new Error('No edit permissions');
  /// =SERVER}
  
  let editor = Editor();
  editor.shape({ rec, data });
  editor.run();
  
  /// {SERVER=
  let allWalkers = getObjectContainingAllWalkers();
  let informWalkers = O.map(allWalkers, walker => canWalkerRead(walker, rec) ? walker : U.SKIP);
  O.each(informWalkers, walker => doRemoteModifyRec(walker, aspect, data));
  /// =SERVER}
  
};

Changing client-only data should process entirely on the client-side
Changing any other type of data should probably happen in lockstep with the server
  - Although it would be nice if the client could immediately witness the change client-side!
    - This is complex though; needs to rollback if the server-side fails

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

U.makeTwig({ name: 'hinterlands', twigs: [ 'clearing', 'record' ], make: (hinterlands, clearing, record) => {
  
  const { Val, Obj, Arr, Ref, RecordVal, RecordObj, RecordArr, Editor } = record;
  
  const ACCESS = { NONE: 0, READ: 1, FULL: 2 };
  
  // ==== Util
  const Encounter = U.makeClass({ name: 'Encounter', methods: (insp, Cls) => ({
    
    init: function({ passage, passageData={}, ip, message, details={} }) {
      
      // An Encounter happens when we meet a Walker, on a Passage, who has
      // a brief Message for us, and optionally further Details for that
      // message.
      
      if (!message) throw new Error('Missing "message" param');
      
      this.hinterlands = null;
      this.passage = passage;
      this.passageData = passageData;
      this.ip = ip;
      this.message = message;
      this.details = details;
      this.walker = null;
      
    },
    copy: function(message=null, details=null) {
      
      let enc = Encounter({
        passage: this.passage,
        passageData: this.passageData,
        ip: this.ip,
        message: message || this.message,
        details: details || this.details
      });
      
      enc.walker = this.walker;
      
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
      
      // Include some preset outlining
      let walkers = this.add(Arr({ name: 'walkers' }));
      let walker = walkers.setTemplate(Obj({ name: 'walker', recCls: Walker }), walker => walker.getChild('ip').getValue());
      walker.add(Val({ name: 'ip' }));          // ip (in compact 8-digit hex format)
      walker.add(Val({ name: 'joinMs' }));      // time joined
      walker.add(Val({ name: 'activityMs' }));  // time of last activity
      walker.add(Val({ name: 'personaMoniker' }));
      // walker.add(Ref({ name: 'persona', target: [ this, 'personas', '$persona' ] }));
      
      let passages = walker.add(Arr({ name: 'passages' }));
      let passage = passages.setTemplate(Obj({ name: 'passage' }), passage => passage.getChild('name').getValue());
      passage.add(Val({ name: 'name' }));
      passage.add(Val({ name: 'health' }));
      
      let personas = this.add(Arr({ name: 'personas' }));
      let persona = personas.setTemplate(Obj({ name: 'persona' }), persona => persona.getChild('moniker').value);
      persona.add(Val({ name: 'moniker' }));
      
      // HEEERE: HOW IT OUGHT TO BE SOON:
      if (true) return;
      
      // Holds data which must be objective between all vallied huts
      this.objective = this.add(Obj({ name: 'objective' }));
      
      // Keep track of known huts
      let otlHutSet = this.add(Arr({ name: 'hutSet' }));
      let otlHut = hutSet.setTemplate(Obj({ name: 'hut', recCls: Hut }), hut => hut.getChild('ip').getValue()); // TODO: write the Hut class (it needs to store PassageData)
      otlHut.add(Val({ name: 'ip' }));          // In compact hex format
      otlHut.add(Val({ name: 'type' }));        // "valley" | "steppe"? | "hill"
      otlHut.add(Val({ name: 'joinMs' }));
      otlHut.add(Val({ name: 'activityMs' }));
      
      // For each hut, keep track of all connecting passages
      let otlPassages = otlHut.add(Arr({ name: 'passages' }));
      let otlPassage = otlPassages.setTemplate(Obj({ name: 'passage' }), passage => passage.getChild('name').getValue());
      passage.add(Val({ name: 'name' }));
      passage.add(Val({ name: 'health' }));
      
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
    
    init: function({ outline, assetVersion=null, walkerDataAccessFunc }) {
      
      insp.RecordObj.init.call(this, { outline });
      this.assetVersion = assetVersion || U.charId(parseInt(Math.random() * 1000), 3);
      this.passages = {};
      this.walkerDataAccessFunc = walkerDataAccessFunc || (() => ACCESS.FULL);
      
      /// {SERVER=
      this.updateFuncs = {};
      this.nextFrameId = 0;
      /// =SERVER} {CLIENT=
      this.frameId = null;
      this.frameNum = 0; // Number of the server state we currently match
      this.pendingFrames = {};
      /// =CLIENT}
      
    },
    getTmpActions: function() {
      
      return insp.RecordObj.getTmpActions.call(this).concat([
        {
          up: function() { U.output('Ain\'t it breezy out here in the Hinterlands?'); },
          dn: function() { U.output('Now we\'re somewhere the roads don\'t go.'); }
        }
      ]);
      
    },
    normalizeEncounter: function(encounter) {
      
      /*
      Between the waker and the passage the categories of data are:
      
      1) Walker data: Arbitrary data on the walker
      2) Passage transit data: Extra data generated by the Passage to manage the network
      3) Passage-walker data: Persistent data for use by the Passage
      
      Implementation:
      
      1) Stored on the Record tree under a Walker
      2) Stored at `anEncounterInstance.passageData`
      3) Stored at `aWalkerInstance.passageWalkerData[aPassageInstance.name]`
      */
      
      // Ensure that `this` is the Hinterlands for `encounter`
      encounter.hinterlands = this;
      
      let editor = Editor();
      let timeMs = U.timeMs();
      let passage = encounter.passage; // `encounter.passage` is initialized earlier (by the Passage)
      let walkers = this.getChild('walkers');
      
      // Get/create the Walker
      let walker = walkers.getChild(encounter.ip) || editor.shape({
        par: walkers,
        data: { type: 'exact', children: {
          ip: encounter.ip,
          joinMs: timeMs,
          persona: null
        }}
      });
      
      // Update the time of last activity
      editor.shape({ rec: walker.getChild('activityMs'), data: timeMs });
      
      // Get/create the Passage
      let walkerPassage = walker.getChild([ 'passages', passage.name ]) || editor.shape({
        rec: walker.getChild('passages'),
        data: { type: 'delta', add: {
          0: { type: 'exact', children: {
            name: passage.name,
            health: 0.5
          }}
        }}
      });
      
      editor.run();
      
      // Attach the walker to the encounter
      encounter.walker = walker;
      
    },
    
    addUpdateFunc: function(name, func) {
      if (O.has(this.updateFuncs, name)) throw new Error(`Tried to overwrite updateFunc "${name}"`);
      this.updateFuncs[name] = func;
    },
    update: async function(rec, data) {
      
      // TODO: Update multiple Records at once? An array of { rec, data }
      // entries instead of just rec, data params
      
      // Updates the state of the Hinterlands.
      // Precondition for `rec` to be within `this` hinterland's subtree
      
      // `relAddress` will be the list of names to walk from `this` to `rec`
      let relAddress = rec.getAddress().slice(this.getAncestryDepth());
      
      /// {SERVER=
      
      // When `Hinterlands.prototype.update` is called server-side it:
      // - Tries to perform the update
      // - If the update succeeds, tells all clients to update
      
      let editor = Editor();
      editor.shape({ rec, data });
      editor.run();
      
      O.each(this.getChild('walkers').children, walker => {
        
        // TODO: Broadcast "update" to `walker`!
        // Note that a serial "update-op" integer will need to be included
        if (this.walkerDataAccessFunc(walker, rec) === ACCESS.NONE) return;
        
        this.journey({ walker, journey: JourneyJson({
          message: 'update',
          details: {
            frameId: walker.frameId,
            frameNum: walker.frameNum++,
            root: relAddress,
            data: data
          }
        })});
        
      });
      
      /// =SERVER} {CLIENT=
      
      // When `Hinterlands.prototype.update` is called client-side,
      // regarding server-side data, it:
      // - Tells the server to try updating
      // - Will receive a directive to update once the server has succeeded
      
      // TODO: Would be nice if there was an available "serverWalker" to be
      // provided as the "walker" here
      this.journey({ walker: null, journey: JourneyJson({
        message: 'update',
        details: {
          root: relAddress,
          data: data
        }
      })});
      
      /// =CLIENT}
      
    },
    updateFunc: function(name, ...params) {
      
      /// {SERVER=
      
      if (!O.has(this.updateFuncs, name)) throw new Error(`Couldn't find updateFunc "${name}"`);
      this.updateFuncs[name](null, ...params);
      
      /// =SERVER} {CLIENT=
      
      this.journey({ walker: null, journey: JourneyJson({
        message: 'updateFunc',
        details: { name, params }
      })});
      
      /// =CLIENT}
      
    },
    
    getChildSafe: function(addr) {
      
      if (!U.isType(addr, Array)) throw new Error(`Invalid "addr" param (expected Array, get ${U.typeOf(addr)})`);
      
      let rec = this;
      for (var i = addr.length - 1; rec && i >= 0; i--) rec = O.has(rec.children, addr[i]) ? rec.children[addr[i]] : null;
      return rec;
      
    },
    catchUp: async function(rec, data) {
      /// {SERVER=
      
      // do nothing
      
      /// =SERVER} {CLIENT=
      
      await this.journey({ journey: JourneyJson({ message: 'catchUp' }) });
      
      /// =CLIENT}
    },
    
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
      
      U.output('Encounter: ', encounter.walker.getChild('ip').value, encounter.message, encounter.details);
      
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
        
        /// {SERVER=
        
        if (!encounter.walker) throw new Error('Can\'t call "catchUp" without `encounter.walker');
        
        let clientFullState = this.getJson(); // TODO: Need to hide any values the client isn't allowed to READ
        
        // Don't reveal any details about walkers
        // TODO: It may make sense for "walkers" to exist outside the Hinterlands subtree
        // OR for Hinterlands to have a "public" / "expose" subtree, and "walkers" could
        // be outside that.
        clientFullState.walkers = {
          server: {
            ip: 'serverIp',
            joinMs: aliveMs,
            activityMs: aliveMs,
            persona: null
          }
        };
        
        // Reset the walker's server-side frame tracking
        encounter.walker.frameId = this.nextFrameId++;
        encounter.walker.frameNum = 0;
        
        // Send the client's full state along with a new frame id
        this.journey({ walker: encounter.walker, journey: JourneyJson({
          message: 'catchUp',
          details: {
            newFrameId: encounter.walker.frameId,
            state: clientFullState
          }
        })});
        
        return;
        
        /// =SERVER} {CLIENT=
        
        let details = encounter.details;
        let { state, newFrameId } = details;
        
        let editor = Editor();
        editor.shape({ rec: this, data: state, assumeType: 'exact' });
        
        this.frameId = newFrameId;
        this.frameNum = 0;
        this.pendingFrames = {};
        
        return;
        
        /// =CLIENT}
        
      } else if (encounter.message === 'update') {
        
        let details = encounter.details;
        if (!O.has(details, 'root')) throw new Error('Missing "root" param');
        
        let { root, data } = details;
        if (!U.isType(root, Array)) throw new Error(`Invalid "root" param (expected Array; got ${U.typeOf(root)})`);
        
        /// {SERVER=
        
        // Safely get the addressed child
        let rec = this.getChildSafe(root);
        if (!rec) throw new Error(`Invalid "root" param: ${root.join('.')}`);
        
        // Ensure access conditions are met
        let access  = this.walkerDataAccessFunc(encounter.walker, rec);
        if (access < ACCESS.FULL) throw new Error(`Unauthorized; ${walker.describe()} can't modify ${rec.describe()}`);
        
        // Do the update
        return await this.update({ rec, data });
        
        /// =SERVER} {CLIENT=
        
        let { frameId, frameNum } = details;
        
        if (frameId !== this.frameId) {
          U.output(`Discarding an update to an invalid frameId (we have frameId ${this.frameId}; received ${frameId})`);
          return;
        }
        
        this.pendingFrames[frameNum] = { root, data };
        if (!O.has(this.pendingFrames, this.frameNum)) U.output(`Can\'t process any frames; waiting for frameId ${this.frameNum}`);
        while (O.has(this.pendingFrames, this.frameNum)) {
          
          try {
            
            U.output(`Advancing from frame ${this.frameNum} -> ${this.frameNum + 1}`);
            let { root, data } = this.pendingFrames[this.frameNum];
            let rec = this.getChildSafe(root);
            if (!rec) throw new Error(`Bad address: ${root.join('.')}`);
            
            let editor = Editor();
            editor.shape({ rec, data });
            editor.run();
            
          } catch(err) {
            
            // TODO: The best way to recover may be to drop everything and "catchUp"
            U.output(COMPILER.formatError(err));
            throw new Error('How to recover? The server told us to do something invalid');
            
          }
          
          this.frameNum++;
          
        }
        
        return;
        
        /// =CLIENT}
        
      }
      
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
window.addEventListener('uncaughtexception', event => {
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
<link rel="icon" type="image/x-icon" href="favicon.ico"/>
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
        
        return this.journey({ encounter, journey: JourneyBuff({
          type: 'html',
          buffer: html
        })});
        
      } else if (encounter.message === 'favicon.ico') {
        
        return this.journey({ encounter, journey: JourneyBuff({
          type: 'icon',
          buffer: await readFile('binary', __dirname, '..', '..', 'clearing', 'favicon.ico')
        })});
        
      } else if (encounter.message === 'updateFunc') {
        
        let details = encounter.details;
        let { name, params=[] } = details;
        
        if (!O.has(this.updateFuncs, name)) throw new Error(`Couldn't find updateFunc "${name}"`);
        
        U.output(this.updateFuncs[name]);
        
        return this.updateFuncs[name](encounter.walker, ...params);
        
      }
      
      /// =SERVER} {CLIENT=
      
      // Client responses
      
      /// =CLIENT}
      
      throw new Error(`Couldn't process encounter: ${encounter.describe()}`);
      
    },
    journey: function({ walker=null, encounter=null, journey }) {
      
      if (!journey) throw new Error('Missing "journey" param');
      
      /// {SERVER=
      if (!walker && !encounter) throw new Error('Need to provide 1 of "walker" and "encounter"');
      if (!walker && !encounter.walker) throw new Error('Couldn\'t get a value for "walker"')
      /// =SERVER}
      
      // TODO: On client side, if no walker is specified it should default
      // to the Walker instance for the server
      
      if (!walker && encounter) walker = encounter.walker;
      
      if (U.isInspiredBy(journey, JourneyWarn)) U.output('JourneyWarn:', COMPILER.formatError(journey.error));
      
      let passage = encounter ? encounter.passage : O.firstVal(this.passages);
      return passage.journey({ walker, encounter, journey });
      
    }
    
  })});
  const Walker = U.makeClass({ name: 'Walker', inspiration: { RecordObj }, methods: (insp, Cls) => ({
    
    init: function({ outline }) {
      
      insp.RecordObj.init.call(this, { outline });
      this.passageWalkerData = {};
      
      /// {SERVER=
      this.frameId = null;
      this.frameNum = 0;
      /// =SERVER}
      
    },
    getPassageWalkerData: function(passage) {
      
      if (!O.has(this.passageWalkerData, passage.name))
        this.passageWalkerData[passage.name] = passage.genDefaultPassageWalkerData(this);
      
      return this.passageWalkerData[passage.name];
      
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
    genDefaultPassageWalkerData: function(walker) {
      return {};
    },
    
    finalizeEncounter: function(encounter) { throw new Error('not implemented'); },
    
    journey: function({ walker, encounter=null, journey }) { throw new Error('not implemented'); }
    
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
      
      // Initially release any stale polls, and bank new ones
      let addr = this.getAddress('arr');
      this.journey({ encounter: null, journey: JourneyJson({
        message: 'passageMessage',
        details: {
          name: this.name,
          message: 'releasePolls'
        }
      })});
      while (this.numPendingRequests < this.maxPendingRequests)
        this.journey({ encounter: null, journey: JourneyJson({
          message: 'passageMessage',
          details: {
            name: this.name,
            message: 'bankPoll'
          }
        })})
      
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
    genDefaultPassageWalkerData: function(walker) {
      return {
        pendingJourneys: [],
        bankedEncounters: []
      };
    },
    
    parseEncounterData: async function(httpReq, protocol='http') {
      
      // TODO: Need to determine if the IP is trusted
      // nginx can supposedly do it, so why not nodejs?
      
      // Get the ip in verbose form, and a compact `ip` value consisting of 8 hex digits
      let ipVerbose = (httpReq.headers['x-forwarded-for'] || httpReq.connection.remoteAddress).split(',')[0].trim();
      let pcs = A.map(S.split(ipVerbose, '.'), pc => parseInt(pc, 10));
      
      // TODO: What about ipv6?
      if (pcs.length !== 4 || A.any(pcs, pc => isNaN(pc) || pc < 0 || pc > 255)) throw new Error('Unexpected ip format: ' + ipVerbose);
      let ip = A.join(A.map(pcs, pc => {
        let hex = parseInt(pc, 10).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }), '');
      
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
    
    finalizeEncounter: function(encounter) {
      /// {SERVER=
      if (encounter.passageData.available) this.launchJourney(encounter, JourneyNull());
      /// =SERVER}
    },
    
    encounter: async function(encounter) {
      
      /// {SERVER=
      if (encounter.message === 'releasePolls') {
        
        let passageWalkerData = encounter.walker.getPassageWalkerData(this);
        A.each(passageWalkerData.bankedEncounters, encounter => {
          this.launchJourney(encounter, JourneyNull());
        });
        passageWalkerData.bankedEncounters = [];
        
      } else if (encounter.message === 'bankPoll') {
        
        if (encounter.passage !== this) throw new Error('Invalid encounter');
        let passageWalkerData = encounter.walker.getPassageWalkerData(this);
        let pendingJourney = passageWalkerData.pendingJourneys.shift();
        if (pendingJourney) {
          this.launchJourney(encounter, pendingJourney);
        } else {
          passageWalkerData.bankedEncounters.push(encounter);
          encounter.passageData.available = false;
        }
        
      }
      /// =SERVER}
      
    },
    journey: function({ walker, encounter=null, journey }) {
      
      // TODO: use a Journey referenceId to indicate completion??
      // - Note that some Journeys are not so well defined as to have
      //   a moment of completion; these are usually client->server
      //   requests which don't need a response
      // - In cases like these, the Journey could be considered
      //   completed immediately?
      // - This may require Journey-specific knowledge
      
      // TODO: Ordered Journeys!!
      
      if (encounter && encounter.walker !== walker) throw new Error('Encounter doesn\'t line up with Walker');
      
      /// {SERVER=
      
      // See if we can respond using the `encounter`
      if (encounter && encounter.passage === this && encounter.passageData.available)
        return this.launchJourney(encounter, journey);
      
      // Get the passage-walker data...
      let passageWalkerData = walker.getPassageWalkerData(this);
      
      // Try to use a banked encounter to launch the journey
      if (passageWalkerData.bankedEncounters.length)
        return this.launchJourney(passageWalkerData.bankedEncounters.shift(), journey);
      
      // No way to launch the journey at this time; need to bank it
      passageWalkerData.pendingJourneys.push(journey);
      
      /// =SERVER} {CLIENT=
      
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
                if (xhr.status !== 200) {
                  if (U.isType(payload, Object) && O.has(payload, 'message') && payload.message === 'warning') {
                    throw new Error(`Known http error: ${payload.details.errorDescription}`);
                  } else {
                    throw new Error(`UNKNOWN http error: ${'\n'}${JSON.stringify(payload, null, 2)}`);
                  }
                }
                return rsv(payload);
              } catch(err) { rjc(err); }
            };
            
          });
          
          // Note that `!response` responses are ignored; they represent http-specific poll releasing
          // Otherwise `response` values are constructed into Encounters, and occur
          if (response)
            await this.hinterlands.beginEncounter(Encounter({
              passage: this,
              passageData: {},
              ip: this.hinterlands.outline.deployment.host, // TODO: This is the hostname, not the IP
              message: response.message,
              details: response.details
            }));
          
        } catch(err) {
          
          U.output('Error receiving HTTP:', COMPILER.formatError(err));
          
        } finally {
          
          this.numPendingRequests--;
          
          // Bank a new poll
          if (this.numPendingRequests < this.maxPendingRequests)
            this.journey({ encounter: null, journey: JourneyJson({
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
      
      /// =CLIENT}
      
    },
    
    /// {SERVER=
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
      
    }
    /// =SERVER}
    
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
    Hinterlands, Walker, Passage, PassageHttp, PassageSokt
  });
  
}});
