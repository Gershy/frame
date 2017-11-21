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

var http = require('http');
var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');
var compiler = require('./compilers/default.js');

new PACK.pack.Package({ name: 'server',
  dependencies: [ 'p', 'queries' ],
  buildFunc: function() {
    var sv = {
      ASSET_VERSION: U.charId(parseInt(Math.random() * 1000), 3),
      $readFile: function(filepath, encoding) {
        return new PACK.p.P({ custom: function(resolve, reject) {
          fileSys.readFile(filepath, encoding, function(err, data) {
            return err ? reject(err) : resolve(data);
          });
        }});
      },
      ResponseData: U.makeClass({ name: 'ResponseData',
        methods: function(sc) { return {
          init: function(params /* code, contentType, encoding, data */) {
            var data = U.param(params, 'data');
            
            this.code = U.param(params, 'code', 200);
            this.contentType = U.param(params, 'contentType', U.isStdObj(data, Object) ? 'text/json' : 'text/plain');
            this.encoding = U.param(params, 'encoding', 'binary'); // 'binary' | 'utf8'
            this.data = data;
          },
          endResponse: function(res) {
            
            var data = this.contentType === 'text/json' ? U.thingToString(this.data) : this.data;
            
            res.writeHead(this.code ? this.code : 200, {
              'Content-Type': this.contentType,
              'Content-Length': Buffer.byteLength(data, this.encoding)
            });
            res.end(data, this.encoding);
            
          }
        };}
      }),
      Session: U.makeClass({ name: 'Session',
        methods: function(sc) { return {
          init: function(params /* appName, ip */) {
            this.ip = U.param(params, 'ip');
            this.appName = U.param(params, 'appName');
            this.id = U.id(sv.Session.NEXT_ID++);
            
            // Channeled queries RECEIVED are passed from `this.$respondToQuery` -> `this.clientChannel.$handleQuery`
            // Channeled queries SENT are passed to `this.clientChannel.$doQuery`
            this.clientChannel = null; // The session's means of contacting the client
            
            console.log('Initiated session: ' + this.ip + '; ' + this.appName);
          },
          getFileContents: function(filepath) {
            // Find the static file, serve it
            
            var ext = path.extname(filepath);
            if (!config.legalExtensions.contains(ext)) throw new Error('Illegal extension: "' + ext + '"');
            ext = config.legalExtensions[ext];
            
            if (ext[0] === '!') {
              var encoding = 'binary';
              ext = ext.substr(1);
            } else {
              var encoding = 'utf8';
            }
            
            return sv.$readFile(filepath, encoding)
              .then(function(data) {
                return new sv.ResponseData({
                  data: data,
                  contentType: ext,
                  encoding: encoding
                });
              });
            
          },
          $respondToQuery: function(params /* address */) {
            /*
            Simply call the super method, but with an included "session"
            parameter. The "session" parameter is also a reserved
            keyword, so if it has been provided an error is thrown.
            */
            if (params.contains('session')) throw new Error('illegal "session" param');
            
            var address = U.param(params, 'address');
            
            params.session = this;
            
            if (address.length) {
              
              var handler = PACK[this.appName].queryHandler.getChild(address);
              if (!handler) throw new Error('Invalid address: "' + address + '"');
              
            } else {
              
              var handler = this;
              
            }
            
            return handler.$handleRequest(params);
            
            /*
            return handler.$handleRequest(params).then(function(response) {
              
              /*
              The session's children all reply with objects. The session is
              responsible for stringifying those objects, and clarifying that
              they are in json format.
              * /
              return U.isInstance(response, sv.ResponseData)
                ? response
                : new sv.ResponseData({ data: response });
              
            });*/
            
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
                  return new sv.ResponseData({
                    code: 404,
                    data: 'File "' + url.join('/') + '" not found',
                    contentType: 'text/plain',
                    encoding: 'utf8'
                  });
                });
            
            // If the `Session` is generating the response, and a specific
            // file has not been requested, serve "mainPage.html".
            // "mainPage.html" is somewhat compiled before being served.
            var appName = this.appName;
            return this.getFileContents('mainPage.html')
              .then(function(html) {
                // TODO: "cmp-client-" should not appear client-side
                html.data = html.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/cmp-client-' + appName + '.js');
                html.data = html.data.replace(/{{assetVersion}}/g, sv.ASSET_VERSION);
                html.data = html.data.replace('{{title}}', appName);
                
                if (PACK[appName].contains('resources')) {
                  
                  
                  var r = PACK[appName].resources;
                  
                  var ver = '?' + sv.ASSET_VERSION;
                  
                  var htmlElems = [];
                  if (r.contains('css')) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
                  if (r.contains('js')) r.js.forEach(function(js) { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
                  html.data = html.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '    ' + html; }).join('\n'));
                  
                } else {
                  
                  html.data = html.data.replace(/(\s*){{resources}}/, '');
                  
                }
                
                return html;
              })
              .fail(function(err) {
                console.error(err.stack);
                return new sv.ResponseData({
                  data: [
                    '<!DOCTYPE html>',
                    '<html>',
                      '<head>',
                        '<title>Error</title>',
                      '</head>',
                      '<body>Couldn\'t serve main page. :(</body>',
                    '</html>'
                  ].join(''),
                  contentType: 'text/html',
                  encoding: 'utf8'
                })
              });
            
          }
        }},
        statik: {
          NEXT_ID: 0,
          SESSIONS: {},
          GET_SESSION: function(appName, ip) {
            // Note: `appName` isn't checked if the session already exists.
            // TODO: Could be a problem if it's ever desired for the same
            // session to serve multiple apps?
            
            var Session = sv.Session;
            var sessionList = Session.SESSIONS;
            
            if (!sessionList.contains(ip)) sessionList[ip] = new Session({ appName: appName, ip: ip });
            
            return sessionList[ip];
            
          }
        }
      }),
      
      $getSession: function(appName, req) {
        // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
        var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace(/[^0-9.]/g, '');
        return PACK.p.$(sv.Session.GET_SESSION(appName, ip));
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
          if (queryParams.contains('_data')) {
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
          if (queryData.contains('url')) throw new Error('Provided reserved property: "url"');
          queryData.url = queryUrl;
          
          // Ensure there is an "address" property
          if (!queryData.contains('address')) queryData.address = [];
          
          // Ensure the "address" property is an `Array`
          if (U.isObj(queryData.address, String))
            queryData.address = queryParams.address ? queryParams.address.split('.') : [];
          
          return queryData;
          
        });
        
      },
      
      serverFunc: function(appName, req, res) {
        new PACK.p.P({ args: [ sv.$getSession(appName, req), sv.$getQuery(req) ] })
          .them(function(session, query) {  // Get a response based on session and query
            return session.$respondToQuery(query);
          })
          .then(function(response) {        // Ensure a `ResponseData` is being worked with
            return U.isInstance(response, sv.ResponseData) ? response : new sv.ResponseData({ data: response });
          })
          .then(function(response) {        // Insert error message in case of 404
            //return new PACK.p.P({ timeout: 1000 + Math.random(0, 3000) }).then(function() {
              return response || new sv.ResponseData({
                encoding: 'utf8',
                contentType: 'text/plain',
                code: 404,
                data: 'not found'
              });
            //});
          })
          .fail(function(err) {             // Insert error message in case of 400
            console.error(err.stack);
            return new sv.ResponseData({
              encoding: 'utf8',
              contentType: 'text/plain',
              code: 400,
              data: err.message
            });
          })
          .then(function(response) {        // End the response
            response.endResponse(res);
          })
          .done();
      }
    };
    
    return sv;
  },
  runAfter: function(sv) {
    
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
    
    if (args.contains('port')) port = args.port;
    if (args.contains('ip')) ip = args.ip;
    
    var server = http.createServer(sv.serverFunc.bind(null, appName));
    server.listen(port, ip);
    console.log('Listening at ' + ip + ':' + port + '...');
    
  }
}).build();
