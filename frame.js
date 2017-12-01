/*
DB Reference:
- https://github.com/FreeCodeCamp/FreeCodeCamp/wiki/Using-MongoDB-And-Deploying-To-Heroku
- mongodb://localhost:27017/frame

TODO: This is one UGLY goddang file
TODO: Responses for non-existing files are no good, e.g. try removing favicon and loading
TODO: Dependency loading should be done via promises
TODO: Websockets eventually?
*/

require('./common.js');

if (!U.isServer()) throw new Error('only for server-side use');

// var TCP = process.binding('tcp_wrap').TCP;
// var tcp = new TCP();

new PACK.pack.Package({ name: 'frame',
  dependencies: [ 'p', 'compile' ],
  buildFunc: function(packageName, p, cm) {
    
    var P = p.P;
    
    // ==== ARGUMENT RESOLUTION
    
    // Parse process-level arguments
    if (process.argv[2][0] === '{') {
      
      // JSON-style processing
      var argStr = process.argv.slice(2).join(' ');
      var args = eval('(' + process.argv.slice(2).join(' ') + ')');
      
    } else {
      
      // Double-dash-style processing
      var args = {};
      for (var i = 2; i < process.argv.length; i += 2) {
        if (process.argv[i].substr(0, 2) !== '--') throw new Error('Invalid key: "' + process.argv[i] + '"');
        args[process.argv[i].substr(2)] = process.argv[i + 1];
      }
      
    }
    
    // Get the app name
    var appName = U.param(args, 'app', require('./config.js').defaultApp);
    
    // Bind ip and port based on deployment
    var deployment = U.param(args, 'deployment', 'default');
    var deploymentData = {};
    
    if (deployment === 'openshift') {
      
      var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;
      var host = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '0.0.0.0'; // TODO: This variable should be called "host"
      
      var dataPathName = process.env.OPENSHIFT_DATA_DIR || null;
      if (!dataPathName) throw new Error('Can\'t access data directory');
      
      deploymentData.update({
        type: 'openshift',
        fileRootName: dataPathName
      });
      
    } else if (deployment === 'heroku') {
      
      // TODO: need to verify port/ip work with heroku
      var port = 8000;
      var host = '127.0.0.1';
      
      deploymentData.update({
        type: 'heroku',
        fileRootName: '<???>' // TODO: Figure this out
      });
      
    } else if (deployment === 'default') {
      
      var port = 8000;
      var host = '127.0.0.1';
      
      deploymentData.update({
        type: 'default',
        fileRootName: __dirname
      });
      
    }
    
    if (O.contains(args, 'host')) host = args.host;
    if (O.contains(args, 'port')) port = args.port;
    
    var compiler = new cm.DefaultCompiler({
      rootPath: __dirname,
      directives: {
        server: {
          client: 'remove',
          server: 'keep',
          remove: 'remove'
        },
        client: {
          client: 'keep',
          server: 'remove',
          remove: 'remove'
        }
      }
    });
    
    return {
      deployment: deploymentData,
      host: host,
      port: port,
      rawArgs: args,
      appName: appName,
      
      compiler: compiler
      
    };
    
  },
  runAfter: function(fr) {
    
    // ==== APP SETUP
    PACK.pack.compiler = fr.compiler;
    
    // Redefine `console.error` so that it uses the compiler to shape any errors
    var oldErrLog = console.error.bind(console);
    console.error = function() {
      arguments[0] = fr.compiler.shapeError(arguments[0], 'server');
      oldErrLog.apply(null, arguments);
    };
    
    // Set this new `console.error` as the uncaught exception handler
    process.on('uncaughtException', console.error.bind(console));
    
    // Compile and run the "server" app
    fr.compiler.run(fr.appName, 'server');
    
  }
}).build();
