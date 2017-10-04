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

var http = require('http');
var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');
var compiler = require('./compilers/default.js');

var package = new PACK.pack.Package({ name: 'server',
  dependencies: [ 'p', 'queries', 'quickDev' ],
  buildFunc: function() {
    return {
      ASSET_VERSION: U.charId(parseInt(Math.random() * 1000), 3),
      $readFile: function(filepath, isBinary) {
        return new PACK.p.P({ custom: function(resolve, reject) {
          fileSys.readFile(filepath, isBinary ? 'binary' : 'utf8', function(err, data) {
            return err ? reject(err) : resolve(data);
          });
        }});
      },
      ResponseData: U.makeClass({ name: 'ResponseData',
        methods: function(sc) { return {
          init: function(params /* code, encoding, binary, data */) {
            this.code = U.param(params, 'code', 200);
            this.encoding = U.param(params, 'encoding', 'text/json'); // TODO: Should be called `this.contentType`
            this.binary = U.param(params, 'binary', false);
            this.data = U.param(params, 'data');
          },
          endResponse: function(res) {
            
            var data = this.encoding === 'text/json' ? U.thingToString(this.data) : this.data;
            var transferEncoding = this.binary ? 'binary' : 'utf8';
            
            res.writeHead(this.code ? this.code : 200, {
              'Content-Type': this.encoding,
              'Content-Length': Buffer.byteLength(data, transferEncoding)
            });
            res.end(data, transferEncoding);
            
          }
        };}
      }),
      Session: U.makeClass({ name: 'Session',
        methods: function(sc) { return {
          init: function(params /* appName, ip */) {
            this.ip = U.param(params, 'ip');
            this.appName = U.param(params, 'appName');
            this.id = U.id(PACK.server.Session.NEXT_ID++);
            
            console.log('Initiated session: ' + this.ip + '; ' + this.appName);
          },
          getFileContents: function(filepath) {
            // Find the static file, serve it
            
            var ext = path.extname(filepath);
            if (!(ext in config.legalExtensions)) throw new Error('Illegal extension: "' + ext + '"');
            ext = config.legalExtensions[ext];
            
            var binary = ext[0] === '!';
            if (binary) ext = ext.substr(1);
            
            return PACK.server.$readFile(filepath, binary)
              .then(function(data) {
                return new PACK.server.ResponseData({
                  data: data,
                  encoding: ext,
                  binary: binary
                });
              });
          },
          $respondToQuery: function(params /* address */) {
            /*
            Simply call the super method, but with an included "session"
            parameter. The "session" parameter is also a reserved
            keyword, so if it has been provided an error is thrown.
            */
            if ('session' in params) throw new Error('illegal "session" param');
            
            var address = U.param(params, 'address');
            
            params.session = this;
            
            if (address.length) {
              
              if (address[0] === 'app') address[0] = '~root';
              var handler = PACK[this.appName].queryHandler.getChild(address);
              if (!handler) throw new Error('Invalid address: "' + address + '"');
              
            } else {
              
              var handler = this;
              
            }
            
            return handler.$handleRequest(params).then(function(response) {
              
              /*
              The session's children all reply with objects. The session is
              responsible for stringifying those objects, and clarifying that
              they are in json format.
              */
              return U.isInstance(response, PACK.server.ResponseData)
                ? response
                : new PACK.server.ResponseData({ data: response });
              
            });
            
          },
          $handleRequest: function(params /* session, url */) {
            /*
            The session itself handles ordinary file requests. Files are
            referenced using params.url, an array of url components.
            */
            var url = U.param(params, 'url');
            
            // A request that specifies a file should just serve that file
            if (url.length && url[url.length - 1].contains('.'))
              return this.getFileContents(url.join('/')) // TODO: Use `path.join` instead?
                .fail(function(err) {
                  return new PACK.server.ResponseData({
                    code: 404,
                    data: 'File "' + url.join('/') + '" not found',
                    encoding: 'text/plain',
                    binary: false
                  });
                });
            
            // If the `Session` is generating the response, and a specific
            // file has not been requested, serve "mainPage.html".
            var appName = this.appName;
            return this.getFileContents('mainPage.html')
              .then(function(html) {
                // TODO: The fact that "cmp-client-" appears client-side means the client can request server-side sources
                html.data = html.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/cmp-client-' + appName + '.js');
                html.data = html.data.replace(/{{assetVersion}}/g, PACK.server.ASSET_VERSION);
                html.data = html.data.replace('{{title}}', appName);
                
                if ('resources' in PACK[appName]) {
                  
                  var htmlElems = [];
                  
                  var r = PACK[appName].resources;
                  
                  var ver = '?' + PACK.server.ASSET_VERSION;
                  
                  if ('css' in r) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
                  if ('js' in r) r.js.forEach(function(js) { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
                  
                  html.data = html.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '\t\t' + html; }).join('\n'));
                  
                } else {
                  
                  html.data = html.data.replace(/(\s*){{resources}}/, '');
                  
                }
                
                return html;
              })
              .fail(function(err) {
                console.error(err.stack);
                return new PACK.server.ResponseData({
                  data: [
                    '<!DOCTYPE html>',
                    '<html>',
                      '<head>',
                        '<title>Error</title>',
                      '</head>',
                      '<body>Couldn\'t serve main page. :(</body>',
                    '</html>'
                  ].join(''),
                  encoding: 'text/html',
                  binary: false
                })
              });
            
          },
        }},
        statik: {
          NEXT_ID: 0,
          SESSIONS: {},
          GET_SESSION: function(appName, ip) {
            // Note: `appName` isn't checked if the session already exists.
            // TODO: Could be a problem if it's ever desired for the same
            // session to serve multiple apps?
            
            var Session = PACK.server.Session;
            var sessionList = Session.SESSIONS;
            
            if (!(ip in sessionList)) sessionList[ip] = new Session({ appName: appName, ip: ip });
            
            return sessionList[ip];
            
          }
        }
      }),
      
      $getSession: function(appName, req) {
        // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
        var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace(/[^0-9.]/g, '');
        return PACK.p.$(PACK.server.Session.GET_SESSION(appName, ip));
      },
      $getQuery: function(req) {
        var url = req.url.substr(1); // Strip the leading "/"
        
        // Initialize defaults for all url components
        var queryUrl = url;
        var queryParams = {};
        
        // Check if the url includes parameters (indicated by the "?" symbol)
        var qInd = url.indexOf('?');
        if (~qInd) {
          // Eliminate the query portion from `queryUrl`
          queryUrl = url.substr(0, qInd);
          
          // Get array of "k=v"-style url parameters
          var queryArr = url.substr(qInd + 1).split('&');
          for (var i = 0; i < queryArr.length; i++) {
            var str = queryArr[i];
            var eq = str.indexOf('=');
            if (~eq)  queryParams[str.substr(0, eq)] = decodeURIComponent(str.substr(eq + 1));
            else       queryParams[str] = null;
          }
          
          // Handle the special "_data" parameter
          if ('_data' in queryParams) {
            // The "_data" property overwrites any properties in the query of the same name
            var obj = U.stringToThing(queryParams._data);
            
            if (!U.isObj(obj, Object))
              throw new Error('Invalid "_data" parameter: "' + obj + '"');
            
            delete queryParams._data;
            queryParams.update(obj);
          }
        }
        
        // Ensure that "queryUrl" is represented as an array
        queryUrl = queryUrl ? queryUrl.split('/') : [];
        
        var method = req.method.toLowerCase();
        if (method === 'get') {
          
          var $ret = new PACK.p.P({ val: queryParams });
          
        } else if (method === 'post') {
          
          var $ret = new PACK.p.P({ custom: function(resolve, reject) {
            
            req.setEncoding('utf8');
            var chunks = [];
            req.on('data', function(chunk) { chunks.push(chunk); });
            req.on('end', function() {
              
              var data = chunks.join('');
              data = data.length ? U.stringToThing(data) : {};
              resolve(queryParams.update(data));
              
            });
            
          }});
          
        }
        
        return $ret.then(function(queryData) {
          
          // Ensure that the "url" property is not supplied by the client
          if ('url' in queryData) throw new Error('Provided reserved property: "url"');
          queryData.url = queryUrl;
          
          // Ensure there is an "address" property
          if (!('address' in queryData)) queryData.address = [];
          
          // Ensure the "address" property is an `Array`
          if (U.isObj(queryData.address, String))
            queryData.address = queryParams.address ? queryParams.address.split('.') : [];
          
          return queryData;
          
        });
        
      },
      
      serverFunc: function(appName, req, res) {
        new PACK.p.P({ args: [ PACK.server.$getSession(appName, req), PACK.server.$getQuery(req) ] })
          .them(function(session, query) {  // Get a response based on session and query
            return session.$respondToQuery(query);
          })
          .then(function(response) {        // Insert error message in case of 404
            //return new PACK.p.P({ timeout: 1000 + Math.random(0, 3000) }).then(function() {
              return response || new PACK.server.ResponseData({
                code: 404,
                binary: false,
                encoding: 'text/plain',
                data: 'not found'
              });
            //});
          })
          .fail(function(err) {             // Insert error message in case of 400
            console.error(err.stack);
            return new PACK.server.ResponseData({
              code: 400,
              binary: false,
              encoding: 'text/plain',
              data: err.message
            });
          })
          .then(function(response) {        // End the response
            response.endResponse(res);
          })
          .done();
      }
    };
  },
  runAfter: function() {
    
    // Parse process-level arguments
    if (process.argv[2] === '{') {
      
      var argStr = process.argv.slice(2).join(' '); // Replace angle-brackets with quotes for *nix systems
      var args = eval('(' + process.argv.slice(2).join(' ') + ')');
      
    } else {
      
      var args = {};
      for (var i = 2; i < process.argv.length; i += 2) {
        var key = process.argv[i];
        var val = process.argv[i + 1];
        
        if (key.substr(0, 2) !== '--') throw new Error('Invalid key: "' + key + '"');
        args[key.substr(2)] = val;
      }
      
    }
    
    // Compile and load the app
    var appName = U.param(args, 'app', config.defaultApp);
    var dirPath = path.join(__dirname, 'apps', appName);
    compiler.compile(appName, dirPath);
    
    // Bind ip and port based on deployment
    var deployment = U.param(args, 'deployment', 'default');
    
    if (deployment === 'openshift') {
      
      var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;
      var ip = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '0.0.0.0';
      
      var dataPathName = process.env.OPENSHIFT_DATA_DIR || null;
      if (!dataPathName) throw new Error('Can\'t access data directory');
      
      ENVIRONMENT.update({
        type: 'openshift',
        fileRootName: dataPathName
      });
      
    } else if (deployment === 'heroku') {
      
      // TODO
      ENVIRONMENT.update({
        type: 'heroku',
        fileRootName: '<???>' // TODO: Figure this out
      });
      
    } else if (deployment === 'default') {
      
      
      var port = 8000;
      var ip = '127.0.0.1';
      
      ENVIRONMENT.update({
        type: 'default',
        fileRootName: __dirname
      });
      
    }
    
    ENVIRONMENT.rawArgs = args;
    
    // var serverFileName = compiler.getFileName(dirPath, 'server');
    // console.log('SERVERFILENAME:', serverFileName);
    // require(serverFileName);
    require('./apps/' + appName + '/cmp-server-' + appName + '.js');
    
    if ('port' in args) port = args.port;
    if ('ip' in args) ip = args.ip;
    
    var server = http.createServer(PACK.server.serverFunc.bind(null, appName));
    server.listen(port, ip);
    console.log('Listening at ' + ip + ':' + port + '...');
    
  }
});
package.build();
