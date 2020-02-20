// The server-side equivalent of a web-page running hut:
// Build the clearing, the foundation and all prerequisite rooms, and
// finally build the hut being run.
// Server-side huts perform compilation, as part of the foundation.

// "DesignerMode": view the site in admin mode (or whatever) with an
// additional console that allows for selecting any element and
// modifying decals (or maybe even extents, in some cases?) - changes
// save directly to the Hut.

// TrustedHutConsumers should be able to add their tests to some central
// test suite. Tests which pass once should always be expected to pass.

// ParadigmOptions could determine how various features are implemented
// behind the scenes. For example, an animation: should it be rendered
// with css+html (@keyframes), or as a gif? That would be a single
// ParadigmOption. Others could involve storing data in an Object vs an
// Array - which is faster? For gzip, which compression level is best?
// Eventually we have a fixed vector of ParadigmOptions (or maybe it's
// trickier, since certain POs could produce a variable number of
// sub-POs?). If we had a way to measure the overall "cost" of an app,
// AI could optimize values for all POs.

// To save on precision-insensitive geometry updates from Below, could
// slow the rate of updates from the server and have the client side
// extrapolate finer-grained time-steps based on sampling the low-res
// location data, and guessing velocity, acceleration, etc. More CPU
// work for the client, much less network pressure on the server!

// Keep-Alive headers
// NODE_ENV should be production?

// ==== NOTES
// EventSource looks useful: https://developer.mozilla.org/en-US/docs/Web/API/EventSource

// Do setup
require('./setup/clearing.js');
require('./setup/foundation.js');
require('./setup/foundationNodejs.js');

// ARG PROCESSING:
// We process the raw text typed into the terminal. Every attempt is
// made to normalize terminal-level argument-passing. We always want the
// exact string which the user typed in.
//
// Two argument modes: 1) object literal; 2) hut params
//
// 1) OBJECT LITERAL:
// The user may type a literal javascript (not necessarily JSON) object
// into the terminal. We'll use `eval` to determine the contents
//
// 2) HUT PARAMS:
// The user may declare multiple heirarchical keys, with corresponding
// values. Heirarchical components are separated with the "." character.
// Values are separated from keys with the "=" character.

// Terminal normalization

let args = process.argv.slice(2).join(' ').trim();
if (args.has('-encodedCommand')) { // Process "encodedCommand"
  
  let ind = args.indexOf('-encodedCommand');
  args = args.crop(ind + '-encodedCommand'.length, 0).trim();
  
  let base64Data = args.split(' ', 1)[0]; // Get everything until the next space (or end)
  args = Buffer
    .from(base64Data, 'base64')             // Decode from base64
    .toString('utf8').split('')             // Get an array of characters
    .map(v => v.charCodeAt(0) ? v : C.skip) // Strip all chars of code 0
    .join('');                              // Stick remaining chars together
  args = `{${args}}`; // Re-wrap in "{}"
  
}

// Process normalized data

if (args[0] === '{') {     // Process object literal
  
  args = eval(`(${args})`);
  
} else {                   // Process hut args
  
  let orig = args;
  args = {};
  
  orig.split(' ').forEach(entry => {
    let [ k, ...v ] = entry.trim().split('=');
    k = k.polish('-').split('.');
    let lastProp = k.pop();
    let ptr = args;
    for (let prop of k) { if (!ptr.has(prop)) ptr[prop] = {}; ptr = ptr[prop]; }
    ptr[lastProp] = v.length ? v.join('=') : true; // No value indicates a flag - so set to `true`
  });
  
}

if (args.has('test')) {
  
  require(`./setup/test/${args.test}`)(args);
  
} else {
  
  // Make the foundation
  let { FoundationNodejs } = U.setup;
  let foundation = FoundationNodejs(args);
  foundation.raise(args).catch(err => {
    console.log('FATAL ERROR:', foundation.formatError(err));
    process.exit(1);
  });
  
}
