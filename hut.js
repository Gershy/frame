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

// Keep-Alive headers
// NODE_ENV should be production?

// ==== NOTES
// EventSource looks useful: https://developer.mozilla.org/en-US/docs/Web/API/EventSource

// Do setup
require('./setup/clearing.js');
require('./setup/foundation.js');
require('./setup/foundationNodejs.js');
let { FoundationNodejs } = U.setup;

let args = eval(`(${process.argv.slice(2).join(' ').trim()})`);
if (!U.isForm(args, Object)) throw Error(`Arguments should be Object (got ${U.getFormName(args)})`);

let foundation = FoundationNodejs(args);
foundation.settleRoom(args.settle, 'above').catch(err => {
  console.log('FATAL ERROR:', foundation.formatError(err));
  foundation.halt();
});
