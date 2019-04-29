// The server-side equivalent of a web-page running hut:
// Build the clearing, the foundation and all prerequisite rooms, and
// finally build the hut being run.
// Server-side huts perform compilation, as part of the foundation.

// ==== NOTES
// EventSource looks useful: https://developer.mozilla.org/en-US/docs/Web/API/EventSource

// RIGHT NOW: Match deadline should be implemented with FilterWob, or some other paradigm
// that makes beginning and ending explicit. WobVal implementation should be cleaned up,
// and with it, Wobblies accept simpler parameters, not objects (with ramifications for
// certain occurrences of WobVal usage)

Error.stackTraceLimit = Infinity;

// Do setup
require('./setup/clearing.js');
require('./setup/foundation.js');
require('./setup/foundationNodejs.js');

// Process args
let args = process.argv.slice(2).join(' ');

if (args[0] === '{') {
  args = eval(`(${args})`);
} else {
  args = args.split('-').toObj(a => {
    if (!a) return C.skip;
    let [ k, ...v ] = a.trim().split(' ');
    return [ k, v.join(' ') || true ];
  });
}

// Powershell and other terminals may pass "encodedCommand"
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
U.foundation = FoundationNodejs({
  ...args,
  variantDefs: {
    above: { above: 1, below: 0 },
    below: { above: 0, below: 1 }
    //between: { above: 1, below: 1 },
    //alone: { above: 0, below: 0 }
  }
});

if (args.has('test') && args.test) {
  require('./test.js')(args);
  return process.exit(0);
}

U.foundation.install();
