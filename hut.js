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

// Process args:
let args = process.argv.slice(2).join(' ');
if (args[0] === '{') {
  args = eval(`(${args})`);
} else {
  let orig = args;
  args = {};
  orig.split('-').forEach(a => {
    if (!a) return;
    let [ k, ...v ] = a.trim().split(' ');
    let ptr = args;
    let pcs = k.split('.');
    let last = pcs.pop();
    pcs.forEach(p => { if (!ptr.has(p)) ptr[p] = {}; ptr = ptr[p]; });
    ptr[last] = v.join(' ') || true;
  });
}

// Some terminals may pass "encodedCommand" with "inputFormat" and "outputFormat"
if (args.has('encodedCommand')) {
  // Decode from base64; strip all 0-bytes
  let encoded = Buffer.from(args.encodedCommand, 'base64').toString('utf8')
    .split('').map(v => v.charCodeAt(0) ? v : C.skip).join('');
  
  args.gain({
    ...eval(`({${encoded}})`),
    encodedCommand: C.skip,
    inputFormat: C.skip,
    outputFormat: C.skip
  });
}

// Make the foundation
let { FoundationNodejs } = U.foundationClasses;
U.foundation = FoundationNodejs();
U.foundation.decide(args);
