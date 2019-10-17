// NOTES:
// [ ] Persistence
// [ ] Login/identity (desired username + token?)

// The server-side equivalent of a web-page running hut:
// Build the clearing, the foundation and all prerequisite rooms, and
// finally build the hut being run.
// Server-side huts perform compilation, as part of the foundation.

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
  let foundation = U.foundation = FoundationNodejs();
  foundation.addMountFile('favicon.ico', 'image/x-icon', 'setup/favicon.ico');
  foundation.raise(args)
    .catch(err => console.log(foundation.formatError(err)));
  
}
