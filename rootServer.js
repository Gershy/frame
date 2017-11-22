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

var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');
var compiler = require('./compilers/default.js');

new PACK.pack.Package({ name: 'server',
  dependencies: [ 'p', 'queries' ],
  buildFunc: function(packageName, p, qr) {
    
    var P = p.P;
    
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
            this.contentType = U.param(params, 'contentType', 'text/json');
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
      
      SessionHandler: U.makeClass({ name: 'SessionHandler',
        methods: function(sc) { return {
          init: function(params /* appName */) {
            this.appName = U.param(params, 'appName');
            this.sessionSet = {};
            this.capabilities = {};
          },
          getSession: function(req) {
            
            // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
            var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].replace(/[^0-9a-f.]/g, '');
            
            if (!this.sessionSet.contains(ip)) {
              this.sessionSet[ip] = new sv.Session({ ip: ip, sessionHandler: this });
              // TODO: Session timeouts
              console.log('Initiated session: ' + this.sessionSet[ip].ip + ' (' + this.sessionSet[ip].id + ')');
            }
            
            return this.sessionSet[ip];
            
          }
        };}
      }),
      Session: U.makeClass({ name: 'Session',
        methods: function(sc) { return {
          init: function(params /* ip, sessionHandler */) {
            this.ip = U.param(params, 'ip');
            this.sessionHandler = U.param(params, 'sessionHandler');
            this.id = U.id(sv.Session.NEXT_ID++);
            this.userData = {};
            this.channelData = {};
          },
          $readFile: function(filepath) {
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
                  encoding: encoding,
                  contentType: ext,
                  data: data
                });
              });
            
          },
          getChild: function(address) {
            
            if (address.length === 0) return this;
            
            if (address[0] === 'channels') {
              
              if (address.length !== 2) return null;
              var caps = this.sessionHandler.capabilities;
              return caps.contains(address[1]) ? caps[address[1]] : null;
              
            } else if (address[0] === 'app') {
              
              var appName = this.sessionHandler.appName;
              return PACK[appName].queryHandler.getChild(address.slice(1));
              
            } else {
              
              return null;
              
            }
            
          },
          $handleRequest: function(params /* command, params, channel */) {
            
            /*
            The session itself handles ordinary file requests. Files are
            referenced using params.url, an array of url components.
            */
            var command = U.param(params, 'command');
            var reqParams = U.param(params, 'params');
            
            if (command === 'getFile') {
              
              var $contents = this.$readFile(U.param(reqParams, 'path').join('/')); // TODO: Use `path.join`?
              
              var reqPath = U.param(reqParams, 'path');
              var lastCmp = reqPath[reqPath.length - 1].toLowerCase();
              if (U.str.endsWith(lastCmp, '.html')) {
                
                var appName = this.sessionHandler.appName;
                $contents = $contents.then(function(contents) {
                
                  contents.data = contents.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/cmp-client-' + appName + '.js');
                  contents.data = contents.data.replace(/{{assetVersion}}/g, sv.ASSET_VERSION);
                  contents.data = contents.data.replace('{{title}}', appName);
                  
                  if (PACK[appName].contains('resources')) {
                    
                    var r = PACK[appName].resources;
                    
                    var ver = '?' + sv.ASSET_VERSION;
                    
                    var htmlElems = [];
                    if (r.contains('css')) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
                    if (r.contains('js')) r.js.forEach(function(js) { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
                    contents.data = contents.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '    ' + html; }).join('\n'));
                    
                  } else {
                    
                    contents.data = contents.data.replace(/(\s*){{resources}}/, '');
                    
                  }
                  
                  return contents;
                  
                }).fail(function(err) {
                  
                  console.error(err.stack);
                  return new sv.ResponseData({
                    encoding: 'utf8',
                    contentType: 'text/html',
                    data: [
                      '<!DOCTYPE html>',
                      '<html>',
                        '<head>',
                          '<title>Error</title>',
                        '</head>',
                        '<body><h1>Couldn\'t serve main page. :(</h1><p>' + err.message + '</p></body>',
                      '</html>'
                    ].join('')
                  })
                  
                });
                
              }
              
              return $contents.fail(function(err) {
                return new sv.ResponseData({
                  contentType: 'text/plain',
                  encoding: 'utf8',
                  code: 404,
                  data: 'File "' + filepath.join('/') + '" not found'
                });
              });
              
            } else if (command === 'ping') {
              
              return new P({ val: new sv.ResponseData({
                
                encoding: 'utf8',
                contentType: 'text/plain',
                data: 'Ping ping ping!'
                
              })});
              
            } else if (command === 'getSessionData') {
              
              return new P({ val: new sv.ResponseData({
                
                encoding: 'utf8',
                contentType: 'text/json',
                data: {
                  ip: this.ip,
                  id: this.id
                }
                
              })});
              
            } else {
              
              return U.param(params, 'channel').$handleRequest(params.update({ session: this }));
              
            }
            
          }
        }},
        statik: { NEXT_ID: 0 }
      }),
        
      ChannelCapability: U.makeClass({ name: 'ChannelCapability',
        methods: function(sc) { return {
          init: function(params /* name, sessionHandler */) {
            this.name = U.param(params, 'name');
            this.sessionHandler = U.param(params, 'sessionHandler')
            this.sessionHandler.capabilities[this.name] = this;
          },
          $initialized: function() {
            return new P({ err: new Error('not implemented') });
          },
          useSessionData: function(session) {
            if (!session.channelData.contains(this.name)) session.channelData[this.name] = {};
            return session.channelData[this.name];
          },
          
          $notify: function(params /* */) {
            return new P({ err: new Error('not implemented') });
          },
          $handleRequest: function(params /* command, params, session */) {
            throw new Error('not implemented');
          },
          
          start: function() {
            throw new Error('not implemented');
          },
          stop: function() {
            throw new Error('not implemented');
          }
        };}
      }),
      ChannelCapabilityHttp: U.makeClass({ name: 'ChannelCapabilityHttp',
        superclassName: 'ChannelCapability',
        methods: function(sc, c) { return {
          init: function(params /* name, sessionHandler, ip, port */) {
            sc.init.call(this, params);
            this.ip = U.param(params, 'ip');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
            this.server = null;
          },
          $initialized: function() {
            return this.$ready;
          },
          
          // TODO: Which sessions get notified? Is it always all sessions??
          $notify: function(params /* sessions, data */) {
            
            var data = U.param(params, 'data');
            var sessions = U.param(params, 'sessions', null);
            if (!sessions) sessions = U.obj.toArray(this.sessionHandler.sessionSet);
            
            for (var i = 0, len = sessions.length; i < len; i++) {
              
              var session = sessions[i];
              var sessionData = this.useSessionData(session);
              if (!sessionData.contains('pending')) sessionData.pending = [];
              sessionData.pending.push(data);
              
              this.tryNotify(session);
              
            }
            
            return p.$null;
            
          },
          tryNotify: function(session) {
            
            // The ChannelCapabilityHttp should be responsible for delaying the sending of any longpolls
            var sessionData = this.useSessionData(session);
            var pending = sessionData.contains('pending') ? sessionData.pending : [];
            var polls = sessionData.contains('polls') ? sessionData.polls : [];
            
            // `polls` contains promises which when resolved will consume a longpoll
            // `pending` contains values which need to be returned to the user via longpolling
            while (pending.length && polls.length) polls.shift().resolve(pending.shift());
            
          },
          $handleRequest: function(params /* command, params, session, res */) {
            
            var session = params.session;
            
            var command = params.command;
            var reqParams = params.params;
            
            if (command === 'getNumBankedPolls') {
              
              var sessionData = this.useSessionData(session);
              return sessionData.contains('polls') ? sessionData.polls.length : 0;
              
            } else if (command === 'bankPoll') {
              
              var sessionData = this.useSessionData(session);
              if (!sessionData.contains('polls')) sessionData.polls = [];
              
              var $promise = new P({});
              sessionData.polls.push($promise);
              
              console.log('BANKED POLL');
              
              this.tryNotify(session);
              return $promise;
              
            } else if (command === 'fizzleAllPolls') {
              
              var sessionData = this.useSessionData(session);
              if (!sessionData.contains('polls')) sessionData.polls = [];
              var polls = sessionData.polls;
              
              var err = new Error('Longpolling fizzled');
              
              while (sessionData.polls.length) sessionData.polls.shift().reject(err);
              
              return new P({ val: 'fizzled all longpolls' });
              
            } else {
              
              return new P({ err: new Error('Invalid command: "' + command + '"') });
              
            }
            
          },
          
          $processQuery: function(req) {
            
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
                try {
                  var obj = U.stringToThing(queryParams._data);
                } catch(err) {
                  return new P({ err: err });
                }
                if (!U.isObj(obj, Object)) throw new Error('Invalid "_data" parameter: "' + obj + '"');
                
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
                  
                  try {
                    var data = chunks.join('');
                    data = data.length ? U.stringToThing(data) : {};
                    resolve(queryParams.update(data));
                  } catch(err) {
                    reject(err);
                  }
                  
                });
                
              }});
              
            }
            
            return $ret.then(function(queryData) {
              
              var queryAddress = U.param(queryData, 'address', []);
              if (U.isObj(queryAddress, String)) queryAddress = queryAddress.split('.');
              
              if (!queryAddress.length && !queryUrl.length && U.isEmptyObj(queryData)) {
                
                // Supplying no URL, address, or params results in a request for "mainPage.html"
                var address = [];
                var command = 'getFile';
                var params = { path: [ 'mainPage.html' ] };
                
              } else if (queryUrl.length) {
                
                if (U.str.contains(queryUrl[queryUrl.length - 1], '.')) {
                  
                  // Addressing a file in the URL results in a root-targetted "getFile" command
                  var address = [];
                  var command = 'getFile';
                  var params = { path: queryUrl };
                  
                } else {
                  
                  // Addressing a non-file in the URL results in a command (defaulting to "get") being issued to the child addressed by the URL
                  if (queryAddress.length) throw new Error('Supplying a non-empty, non-file url along with an address is invalid');
                  var address = queryUrl;
                  var command = U.param(queryData, 'command', 'get');
                  var params = U.param(queryData, 'params', {});
                  
                }
                
              } else {
                
                // A blank URL with an address provided issues a command to the addressed child
                var address = queryAddress;
                var command = U.param(queryData, 'command');
                var params = U.param(queryData, 'params', {});
                
              }
              
              return {
                address: address,
                command: command,
                params: params
              };
              
            });
            
          },
          serverFunc: function(req, res) {
            
            var pass = this;
            this.$processQuery(req).then(function(queryObj) {  // Send the query to the correct child
              
              var session = pass.sessionHandler.getSession(req);
              var handler = session.getChild(queryObj.address);
              if (!handler) throw new Error('Invalid address: "' + queryObj.address.join('.') + '"');
              return handler.$handleRequest(U.obj.update(queryObj, { session: session, req: req, res: res }));
              
            }).then(function(responseObj) {                   // Ensure the result is a `ResponseData` instance
              
              return U.isInstance(responseObj, sv.ResponseData)
                ? responseObj
                : new sv.ResponseData({ data: responseObj });
              
            }).fail(function(err) {                           // Errors result in 400 responses
              
              console.error(err.stack);
              return new sv.ResponseData({
                encoding: 'utf8',
                contentType: 'text/plain',
                code: 400,
                data: err.message
              });
              
            }).then(function(responseData) {                  // Send the result
              
              responseData.endResponse(res);
              
            }).done();
            
          },
          
          start: function() {
            this.server = require('http').createServer(this.serverFunc.bind(this));
            this.server.listen(this.port, this.ip, 511, this.$ready.resolve.bind(this.$ready));
          },
          stop: function() {
            this.server.close();
            this.server = null;
          }
        };}
      }),
      ChannelCapabilitySocket: U.makeClass({ name: 'ChannelCapabilitySocket',
        superclassName: 'ChannelCapability',
        methods: function(sc, c) { return {
          init: function(params /* name, sessionHandler, ip, port */) {
            sc.init.call(this, params);
            this.ip = U.param(params, 'ip');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
          },
          $initialized: function() {
            return this.$ready;
          },
          
          start: function() {
            
            this.server = require('http').createServer(function(req, res) {
              
              console.log('HERE');
              U.debug('REQ', req);
              res.status(400).send('BAD');
              
            });
            
            // For security, can swap "net" for "tls"
            this.socket = require('net').createServer(function(connectedSocket) {
              console.log('FOUND WS CONNECTION!');
            });
            this.socket.listen(this.port, this.ip, 511, this.$ready.resolve.bind(this.$ready));
            
            /*this.server.listen({
              path: 'ws://' + this.ip + ':' + this.port,
              backlog: 511
            }, this.$ready.resolve.bind(this.$ready));*/
            //this.server.listen(this.port, 'ws://' + this.ip, 511, );
            
          },
          stop: function() {
            
          }
        };}
      })
      
    };
    
    return sv;
    
  },
  runAfter: function(sv) {
    
    // ==== ARGUMENT RESOLUTION
    
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
      
      // TODO: need to verify port/ip work with heroku
      var port = 8000;
      var ip = '127.0.0.1';
      
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
    
    if (args.contains('port')) port = args.port;
    if (args.contains('ip')) ip = args.ip;
    
    ENVIRONMENT.rawArgs = args;
    
    // ==== APP SETUP
    
    // var serverFileName = compiler.getFileName(dirPath, 'server');
    // console.log('SERVERFILENAME:', serverFileName);
    // require(serverFileName);
    require('./apps/' + appName + '/cmp-server-' + appName + '.js');
    
    // ==== SERVER SETUP
    
    var sessionHandler = new sv.SessionHandler({ appName: appName });
    
    var httpCap = new sv.ChannelCapabilityHttp({ sessionHandler: sessionHandler, name: 'http', ip: ip, port: port });
    httpCap.start();
    httpCap.$initialized().then(function() {
      console.log('HTTP capability active at ' + ip + ':' + port);
    });
    
    var soktCap = new sv.ChannelCapabilitySocket({ sessionHandler: sessionHandler, name: 'sokt', ip: ip, port: port + 1 })
    soktCap.start();
    soktCap.$initialized().then(function() {
      console.log('SOKT capability active at ' + ip + ':' + (port + 1));
    });
    
  }
}).build();
