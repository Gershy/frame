/*

// TODO: Some Temporary operations need to be async, e.g. PassageHttp initializing
// an http server. Can't switch to full async, because that will require editor.run
// to be async (completely unacceptable; introduces race conditions).
// Consider a separate TemporaryAsync class, where the syncronous "up" command
// ENSURES that an asynchronous "asyncUp" command cannot fail. Then "up" calls
// "asyncUp", and doesn't wait for it.

==== ROADMAP

[X]   - Standard setup + utility library
[X]     - Standard start + stop paradigm
[X]     - Mixins and Classes (the same!)
[X]     - Function argument validation          Declarative (or ES7-style?)
[X]   - Compilation
[X]     - Client-side line mapping
[X]   - Environment fitting                     Extensible list of supported environments
[ ]     - Automatic localNetwork ip detection
[ ]   - Package definition                      TRIVIAL TO COMBINE PACKAGES (twigs)
[X]     - Dependency resolution                 Works with promises
[X]       - Server-side (easy)
[X]       - Client-side                         Generate dependency tree all at once
[X]   - Data definition                         Better atomicity than current Editor
[ ]   - Data operations                         Read and write both async, in preparation for persistence
[/]     - Persistence
[X]       - Http                                Long-polling
[ ]       - Sokt
[ ]   - Network communication                   Defined as a twig - all network data (e.g. active sessions) available in Dossier-like format. Ordered operations. Confirmation for some actions.
[ ]   - Client-side with a server-side session
[ ]   - Debug IP spoofing
[ ]   - HTTPS
[ ]   - Certificate (try self-signed??)
[ ]   - Run as cluster
[ ]     - Task-specific nodes
[ ]       - A single node for all data operations (synchronous infallability)
[ ]   - Package tests


==== IMPROVEMENTS

[X]   - Start/stop paradigm
[X]   - Declarative function argument validation
[ ]   - Debug line-finding on client-side
[ ]   - Extensible list of environment bindings (heroku, openshift, etc)
[ ]   - Automatic IP detection for localNetwork deployment
[ ]   - Trivial package combination (NEED TO THINK MORE ABOUT THIS. MAY MEAN COMBINING SOMETHING OF A HIGHER ORDER THAN TWIGS)
[X]   - Dependencies required in promised format
[ ]   - Dependency tree generated all at once
[X]   - Editor actions with atomicity (immediate!)
[ ]   - Network + session data is a twig
[ ]   - Ordered network operations
[ ]   - Network confirmation for some operations?
[ ]   - Streaming where appropriate?
[ ]   - Persistence


If network data is hut-like, then data definition and access must be defined first.
Could define a network-less Actionizer, and then network communication can subclass this

==== ENVIRONMENT FITTING
Environment encompasses:
  - server-side session info (host/port, which may already be provided by the environment)
  - filesystem accessor data
  - deployment mode (localMachine, localNetwork, global... maybe more?)
  - command-line arguments which can include:
    - name of the hut to enter
    - arbitrary arguments for the hut

*/
let path = require('path');
require('./clearing/essentials.js');
require('./clearing/serverEssentials.js');

let { Compiler } = U;

let compiler = global.COMPILER = Compiler({
  twigDir: path.join(__dirname, 'twig'),
  variantDefs: {
    server: {
      client: 'remove',
      server: 'keep'
    },
    client: {
      client: 'keep',
      server: 'remove'
    }
  }
});
process.on('uncaughtException', err => {
  U.output('---- UNCAUGHT');
  U.output(compiler.formatError(err));
  process.exit(1);
});
process.on('unhandledRejection', err => {
  U.output('---- UNHANDLED');
  U.output(compiler.formatError(err));
  process.exit(1);
});

(async () => {
  let clearing = await compiler.run('clearing');
  let deployment = clearing.deployment;
  await compiler.run(deployment.hut);
})();
