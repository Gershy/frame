// The server-side equivalent of a web-page running hut:
// Build the clearing, the foundation and all prerequisite chambers, and
// finally build the hut being run.
// Note that server-side huts perform compilation, and it's considered to
// be part of the foundation.

Error.stackTraceLimit = Infinity;

// Build the clearing:
require('./setup/clearing.js');
require('./setup/foundation.js');
require('./setup/foundationNode.js');

// Process args
let args = process.argv.slice(2).join(' ');
if (args[0] === '{') {
  args = eval(`(${args})`);
} else {
  args = args.split('--').toObj(a => {
    if (!a) return U.SKIP;
    let [ k, ...v ] = a.trim().split(' ');
    return [ k, v.join(' ') || true ];
  });
}

// Make the foundation
let { FoundationNodejs } = U.foundationClasses;
U.foundation = FoundationNodejs({
  ...args,
  variantDefs: {
    above: { above: 1, below: 0 },
    below: { above: 0, below: 1 },
    between: { above: 1, below: 1 },
    alone: { above: 0, below: 0 }
  }
});

U.foundation.install();
