new PACK.pack.Package({ name: 'server',
  /// {SERVER=
  dependencies: [ 'p', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'p' ],
  /// =CLIENT}
  buildFunc: function(packageName /* ... */) {
    
    /// {SERVER=
    var p = arguments[1];
    var fr = arguments[2];
    var fs = require('fs');
    var path = require('path');
    var config = require('../../config.js');
    /// =SERVER}
    /// {CLIENT=
    var p = arguments[1];
    /// =CLIENT}
    
    var P = p.P;
    
    /*
    
    Should be working with "put" and "get" methods, each of which is 1/2 client-side,
    1/2 server-side.
    
    The "put" function should always TELL the other side what to do.
    The "get" function should always DO what it was told to do (let `Dossier` handle the validation)
    
    The "put" function should be able to TELL the other side, to TELL a command back
    (e.g. instead of telling the other side to reply with dossier data, tell the other side to
    TELL this side how to update dossier data)
    
    Submethods called from "put" or "get" should be restricted to the client/server side from which
    the call was made (but preferrably try to inline such methods!)
    
    */
    
    var sv = {
      
      SessionHandler: U.makeClass({ name: 'SessionHandler',
        methods: function(sc) { return {
          init: function(params /* appName, assetVersion */) {
            this.appName = U.param(params, 'appName');
            this.assetVersion = U.param(params, 'assetVersion', U.charId(parseInt(Math.random() * 1000), 3));
            this.sessionSet = {};
            this.capabilities = {};
          },
          getSession: function(ip) {
            
            if (!this.sessionSet.contains(ip)) {
              this.sessionSet[ip] = new sv.Session({ ip: ip, sessionHandler: this });
              // TODO: Session timeouts
              console.log('Initiated session: ' + this.sessionSet[ip].ip + ' (' + this.sessionSet[ip].id + ')');
            }
            
            return this.sessionSet[ip];
            
          },
          addCapability: function(capability) {
            
            this.capabilities[capability.name] = capability;
            capability.sessionHandler = this;
            return capability;
            
          }
        };}
      }),
      
      ChannelCapability: U.makeClass({ name: 'ChannelCapability',
        methods: function(sc) { return {
          init: function(params /* name, priority */) {
            
            /*
            "name" - names the capability
            "priority" - signals how preferrable the capability is. Suppose that
              both http and sokt capabilities exist; when both are available we
              would prefer to use the "sokt" capability as it is a more efficient
              protocol. So the sokt capability should be given a higher priority
              than the http capability.
            */
            
            this.name = U.param(params, 'name');
            this.priority = U.param(params, 'priority', 0);
            this.sessionHandler = null;
            
          },
          $initialized: function() {
            return new P({ err: new Error('not implemented') });
          },
          useSessionData: function(session) {
            if (!session.channelData.contains(this.name)) session.channelData[this.name] = {};
            return session.channelData[this.name];
          },
          
          $notify: function(params /* session, data */) {
            // Sends a command to the other side
            return new P({ err: new Error('not implemented') });
          },
          $handleRequest: function(params /* command, params, session */) {
            
            /// {SERVER=
            var session = params.session;
            var command = params.command;
            var reqParams = params.params;
            
            if (command === 'notifyMe') {
              
              this.$notify({ session: session, data: { data: 'The notification you asked for :D' } }).done();
              return new P({ val: 'Notification en-route!' });
              
            }
            /// =SERVER}
            
            /// {CLIENT=
            /// =CLIENT} 
            
            return new P({ err: new Error('Invalid command: "' + command + '"') });
            
          },
          getReadyNotification: function() { throw new Error('not implemented'); },
          
          start: function() {
            throw new Error('not implemented');
          },
          stop: function() {
            throw new Error('not implemented');
          }
        };}
      }),
      ChannelCapabilityHttp: U.makeClass({ name: 'ChannelCapabilityHttp', superclassName: 'ChannelCapability',
        methods: function(sc, c) { return {
          init: function(params /* name, sessionHandler, host, port */) {
            sc.init.call(this, params);
            this.host = U.param(params, 'host');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
            this.server = null;
          },
          $initialized: function() {
            return this.$ready;
          },
          
          // TODO: Which sessions get notified?? It can't always be all sessions!
          // TODO: `$notify` should be called from the `SessionHandler`, not the `ChannelCapability`
          //  That way, the most prioritized `ChannelCapability` can be selected.
          //  `ChannelCapability` should implemented `notify(session, data)` notifying a single
          //  session.
          $notify: function(params /* session, data */) {
            
            /// {SERVER=
            var data = U.param(params, 'data');
            var session = U.param(params, 'session');
            
            var sessionData = this.useSessionData(session);
            if (!sessionData.contains('pending')) sessionData.pending = [];
            sessionData.pending.push(data);
            this.tryNotify(session); // Now that the data is pending, try to send it!
            
            return p.$null;
            /// =SERVER}
            
            /// {CLIENT=
            return new P({ err: new Error('not implemented') });
            /// =CLIENT}
            
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
            
            /// {SERVER=
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
              
              this.tryNotify(session);
              return $promise;
              
            } else if (command === 'fizzleAllPolls') {
              
              var sessionData = this.useSessionData(session);
              if (!sessionData.contains('polls')) sessionData.polls = [];
              var polls = sessionData.polls;
              
              var err = new Error('Longpolling fizzled');
              while (sessionData.polls.length) sessionData.polls.shift().reject(err);
              
              return new P({ val: 'fizzled all longpolls' });
              
            }
            /// =SERVER}
            
            /// {CLIENT=
            /// =CLIENT}
            
            return sc.$handleRequest.call(this, params);
            
          },
          getReadyNotification: function() { return this.name.toUpperCase() + ' capability active at http://' + this.host + ':' + this.port; },
          
          /// {SERVER=
          $processQuery: function(req) {
            
            var url = req.url.substr(1); // Strip the leading "/"
            
            // Initialize defaults for all url components
            var queryUrl = url;
            var queryParams = {};
            
            // Check if the url includes parameters (indicated by the "?" symbol)
            var qInd = url.indexOf('?');
            if (~qInd) {
              // Strip the query off `queryUrl`
              queryUrl = url.substr(0, qInd);
              
              // Get array of "k=v"-style url parameters
              var queryArr = url.substr(qInd + 1).split('&');
              for (var i = 0; i < queryArr.length; i++) {
                var str = queryArr[i];
                var eq = str.indexOf('=');
                if (~eq)  queryParams[str.substr(0, eq)] = decodeURIComponent(str.substr(eq + 1));
                else      queryParams[str] = null;
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
              
              var $ret = new P({ val: queryParams });
              
            } else if (method === 'post') {
              
              var $ret = new P({ custom: function(resolve, reject) {
                
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
              
              // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
              var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].replace(/[^0-9a-f.]/g, '');
              var session = pass.sessionHandler.getSession(ip);
              
              var handler = session.getChild(queryObj.address);
              if (!handler) throw new Error('Invalid address: "' + queryObj.address.join('.') + '"');
              return handler.$handleRequest(U.obj.update(queryObj, { session: session, req: req, res: res }));
              
            }).then(function(responseObj) {                   // Ensure the result is a `HttpResponse` instance
              
              return U.isInstance(responseObj, sv.HttpResponse)
                ? responseObj
                : new sv.HttpResponse({ data: responseObj });
              
            }).fail(function(err) {                           // Errors result in 400 responses
              
              console.error(err);
              return new sv.HttpResponse({
                encoding: 'utf8',
                contentType: 'text/plain',
                code: 400,
                data: err.message
              });
              
            }).then(function(responseData) {                  // Send the result
              
              responseData.endResponse(res);
              
            }).done();
            
          },
          /// =SERVER}
          
          start: function() {
            /// {SERVER=
            this.server = require('http').createServer(this.serverFunc.bind(this));
            this.server.listen(this.port, this.host, 511, this.$ready.resolve.bind(this.$ready));
            /// =SERVER}
            /// {CLIENT=
            // Http connections already exist by definition on the client-side, as it's
            // the method of delivering the source-code itself
            this.$ready.resolve(null);
            /// =CLIENT}
          },
          stop: function() {
            this.server.close();
            this.server = null;
          }
        };}
      }),
      ChannelCapabilitySocket: U.makeClass({ name: 'ChannelCapabilitySocket', superclassName: 'ChannelCapability',
        methods: function(sc, c) { return {
          init: function(params /* name, sessionHandler, host, port */) {
            sc.init.call(this, params);
            this.host = U.param(params, 'host');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
            
            /// {SERVER=
            this.socket = null;
            this.connections = {};
            /// =SERVER}
          },
          $initialized: function() { return this.$ready; },
          getReadyNotification: function() { return this.name.toUpperCase() + ' capability active at ws://' + this.host + ':' + this.port; },
          
          $notify: function(params /* session, data  */) {
            
            /// {SERVER=
            var session = U.param(params, 'session');
            var data = U.param(params, 'data');
            var connection = this.connections[session.ip];
            return connection.$notify(U.thingToString(data));
            /// =SERVER}
            
            /// {CLIENT=
            var data = U.param(params, 'data');
            this.socket.send(U.thingToString(data));
            return p.$null;
            /// =CLIENT}
            
          },
          $handleRequest: function(params /* command, params, session, res */) {
            
            /// {SERVER=
            var session = params.session;
            var command = params.command;
            var reqParams = params.params;
            /// =SERVER}
            
            /// {CLIENT=
            /// =CLIENT}
            
            return sc.$handleRequest.call(this, params);
            
          },
          
          /// {SERVER=
          socketConnectAttempt: function(socket) {
            
            var ip = socket.remoteAddress;
            
            if (O.contains(this.connections, ip)) { console.log('Refused connection overwrite attempt: "' + ip + '"'); return; }
            
            this.connections[ip] = new sv.SocketConnection({ socket: socket });
            
            socket.on('close', function() {
              console.log('SOCKET CLOSED!');
              // TODO: Remove from connections list
            });

          },
          /// =SERVER}
          
          start: function() {
            
            /// {SERVER=
            // For secure connections, can swap "net" for "tls"
            this.socket = require('net').createServer(this.socketConnectAttempt.bind(this));
            this.socket.listen(this.port, this.host, 511, this.$ready.resolve.bind(this.$ready));
            /// =SERVER}
            
            /// {CLIENT=
            var socket = new WebSocket('ws://' + this.host + ':' + this.port);
            socket.onopen = this.$ready.resolve.bind(this.$ready);
            socket.onmessage = function(evt) { U.debug('RECEIVED', U.stringToThing(evt.data)); };
            this.socket = socket;
            /// =CLIENT}
            
          },
          stop: function() {
            
          }
        };}
      }),
      
      /// {SERVER=
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
            
            return new P({ cb: fs.readFile, args: [ filepath, encoding ] }).then(function(data) {
              return new sv.HttpResponse({
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
              
              var reqPath = U.param(reqParams, 'path');
              var lastCmp = reqPath[reqPath.length - 1].toLowerCase();
              if (S.endsWith(lastCmp, '.html')) {
                
                var appName = this.sessionHandler.appName;
                var assetVersion = this.sessionHandler.assetVersion
                var $contents = this.$readFile(path.join.apply(path, reqPath)).then(function(contents) {
                
                  contents.data = contents.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
                  contents.data = contents.data.replace(/{{assetVersion}}/g, assetVersion);
                  contents.data = contents.data.replace('{{title}}', appName);
                  
                  if (PACK[appName].contains('resources')) {
                    
                    var r = PACK[appName].resources;
                    
                    var ver = '?' + assetVersion;
                    
                    var htmlElems = [];
                    if (r.contains('css')) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
                    if (r.contains('js')) r.js.forEach(function(js) { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
                    contents.data = contents.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '    ' + html; }).join('\n'));
                    
                  } else {
                    
                    contents.data = contents.data.replace(/(\s*){{resources}}/, '');
                    
                  }
                  
                  return contents;
                  
                }).fail(function(err) {
                  
                  console.error(err);
                  return new sv.HttpResponse({
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
                
              } else if (S.endsWith(lastCmp, '.js')) {
                
                try {
                  
                  if (reqPath[0] === 'apps') {
                    
                    if (reqPath.length !== 3 || reqPath[1] !== reqPath[2].substr(0, reqPath[2].length - 3)) {
                      
                      console.log('BAD REQPATH:', reqPath);
                      throw new Error('Application javascript filepaths must have the following format: "apps/<appName>/<appName>.js"');
                      
                    }
                    
                    // Note that `reqPath[1]` is the name of the directory within "/apps", therefore
                    // it is the exact name of the app being requested. Note that the "client" variant
                    // is specified, because this file is being requested by the client.
                    var fullPath = fr.compiler.getCompiledFullPath(reqPath[1], 'client');
                    
                  } else {
                    
                    var fullPath = path.join.apply(path, reqPath);
                    
                  }
                  
                  var $contents = this.$readFile(fullPath);
                  
                } catch(err) {
                  
                  var $contents = new P({ err: err });
                  
                }
                
              } else {
                
                var $contents = this.$readFile(path.join.apply(path, reqPath));
                
              }
              
              return $contents.fail(function(err) {
                return new sv.HttpResponse({
                  contentType: 'text/plain',
                  encoding: 'utf8',
                  code: 404,
                  data: 'File "' + reqPath.join('/') + '" unavailable (' + err.message + ')'
                });
              });
              
            } else if (command === 'ping') {
              
              return new P({ val: new sv.HttpResponse({
                
                encoding: 'utf8',
                contentType: 'text/plain',
                data: 'Ping ping ping!'
                
              })});
              
            } else if (command === 'getSessionData') {
              
              return new P({ val: new sv.HttpResponse({
                
                encoding: 'utf8',
                contentType: 'text/json',
                data: {
                  ip: this.ip,
                  id: this.id
                }
                
              })});
              
            }
            
            return new P({ err: new Error('Invalid command: "' + command + '"') });
            
          }
        }},
        statik: { NEXT_ID: 0 }
      }),
      HttpResponse: U.makeClass({ name: 'HttpResponse',
        methods: function(sc) { return {
          init: function(params /* code, contentType, encoding, data */) {
            
            this.code = U.param(params, 'code', 200);
            this.contentType = U.param(params, 'contentType', 'text/json');
            this.encoding = U.param(params, 'encoding', 'binary'); // 'binary' | 'utf8'
            this.data = U.param(params, 'data');
            
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
      SocketConnection: U.makeClass({ name: 'SocketConnection',
        methods: function(sc, c) { return {
          init: function(params /* socket, session */) {
            
            var socket = this.socket = U.param(params, 'socket');
            this.status = 'starting'; // starting | started | ending | ended
            this.buffer = new Buffer(0);
            this.curOp = null;
            this.curFrames = [];
            
            var pass = this;
            
            socket.on('readable', function() {
              
              if (pass.status === 'ended') return;
              
              var buffer = socket.read();
              if (!buffer) return;  // The 'readable' event doesn't guarantee `socket.read` will return any data
              
              // TODO: Ensure that `totalLen` doesn't exceed a bound?
              // If the bound is exceeded, respond with 400: "HTTP/1.1 400 Bad Request\r\n\r\n"
              var totalLen = pass.buffer.length + buffer.length;
              pass.buffer = Buffer.concat([ pass.buffer, buffer ], totalLen);
              
              if (pass.status !== 'starting') pass.receivedData();
              else                            pass.receivedHandshakeData();
              
            });
            
            socket.on('error', function(err) {
              
              console.log('SOCKET ERR');
              console.error(err);
              
            });
            
          },
          
          $notify: function(data) {
            
            return new P({ custom: function(resolve, reject) {
              
              if (data.length < 126) {            // small-size
                
                var metaBuff = new Buffer(2);
                metaBuff[1] = data.length;
                
              } else if (data.length < 65536) {   // medium-size
                
                var metaBuff = new Buffer(4);
                metaBuff[1] = 126;
                metaBuff.writeUInt16BE(data.length, 2);
                
              } else {                            // large-size
                
                var metaBuff = new Buffer(8);
                metaBuff[1] = 127;
                metaBuff.writeUInt32BE(Math.floor(data.length / c.int32), 2);
                metaBuff.writeUInt32BE(data.length % c.int32, 6);
                
              }
              
              metaBuff[0] = 129; // 128 + 1; `128` pads for modding by 128; `1` is the "text" op
              
              var dataBuff = new Buffer(data);
              this.socket.write(Buffer.concat([ metaBuff, dataBuff ], metaBuff.length + dataBuff.length), resolve);
              
            }.bind(this) });
            
          },
          
          tryResolveHandshake: function(packet) {
            
            try {
              
              var lines = packet.split('\r\n');
              if (lines.length <= 5) throw new Error('Invalid packet');
              
              var path = lines[0].match(/^GET (.+) HTTP\/\d\.\d$/i);
              if (!path) throw new Error('Invalid packet request');
              
              // Parse headers:
              var headers = {};
              for (var i = 1; i < lines.length; i++) {
                var sep = lines[i].indexOf(':');
                if (sep === -1) throw new Error('Invalid header');
                var key = lines[i].substr(0, sep).trim().toLowerCase();
                var val = lines[i].substr(sep + 1).trim();
                headers[key] = val;
              }
              
              // Validate/sanitize headers:
              for (var i = 0, len = c.requiredHeaders.length; i < len; i++)
                if (!O.contains(headers, c.requiredHeaders[i])) throw new Error('Missing header: "' + c.requiredHeaders[i] + '"');
              
              headers.upgrade = headers.upgrade.toLowerCase();
              if (headers.upgrade !== 'websocket') throw new Error('header[\'Upgrade\'] must be "websocket"; got "' + headers.upgrade + '"');
              
              headers.connection = A.map(headers.connection.split(','), function(con) { return con.trim().toLowerCase(); });
              if (headers.connection.indexOf('upgrade') === -1) throw new Error('header[\'Connection\'] must contain "upgrade"; got "' + headers.connection + '"');
              
              headers['sec-websocket-version'] = parseInt(headers['sec-websocket-version']);
              if (headers['sec-websocket-version'] !== 13) throw new Error('Unsupported websocket version');
              
              // TODO: Need to anticipate the "sec-websocket-protocol" header
              
              // Generate a secure hash
              var hash = c.genHash();
              hash.end(headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
              
              this.socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                'Sec-Websocket-Accept: ' + hash.read().toString('base64') + '\r\n' +
                // 'Sec-Websocket-Protocol: ... \r\n' +
                '\r\n');
              
              return true;
              
            } catch(err) {
              
              this.socket.end('HTTP/1.1 400 ' + err.message + '\r\n\r\n');
              return false;
              
            }
            
          },
          
          receivedHandshakeData: function(buffer) {
            
            var b = this.buffer;
            if (b.length < 4) return;
            
            // Search for double-carriage-return
            var endInd = A.seqIndexOf(b, [ 13, 10, 13, 10 ]);
            if (endInd === -1) return;
            
            // The double-carriage-return is found; try to process a handshaking http packet
            var packet = b.slice(0, endInd).toString('utf8');
            this.buffer = b.slice(endInd + 4);
            
            if (this.tryResolveHandshake(packet)) {
              
              // Handshake successful
              this.status = 'started'; // Switch from hypertext-transfer-protocol to websocket-protocol
              
              // Try to process any remaining data using socket protocol
              if (this.buffer.length) this.receivedData();
              
            } else {
              
              // The handshake wasn't successful, but we're still listening!
              
              // Try to process any remaining data using http
              if (this.buffer.length) this.receivedHandshakeData();
              
            }
            
          },
          receivedData: function () {
            
            try {
              
              while (this.buffer.length >= 2) {
                
                // ==== PARSE FRAME
                
                var b = this.buffer[0] >> 4; // Look at bits beyond first 4
                if (b % 8) throw new Error('Some reserved bits are on');
                var final = b === 8;
                
                var op = this.buffer[0] % 16;
                if (op !== 0 && op !== 1 && op !== 2 && op !== 8 && op !== 9 && op !== 10)
                  throw new Error('Invalid op: ' + op);
                
                if (op >= 8 && !final) throw new Error('Fragmented control frame');
                
                b = this.buffer[1];
                var masked = b >> 7;
                
                // Server requires a mask. Client requires no mask
                if (!masked) throw new Error('No mask');
                
                var length = b % 128;
                var offset = masked ? 6 : 2; // Masked frames have an extra 4 halfwords containing the mask
                
                if (this.buffer.length < offset + length) return; // Await more data
                
                if (length === 126) {         // Signals websocket's "medium-size" frame format
                  length = this.buffer.readUInt16BE(2);
                  offset += 2;
                } else if (length === 127) {  // Signals websocket's "large-size" frame format
                  length = this.buffer.readUInt32BE(2) * c.int32 + this.buffer.readUInt32BE(6);
                  offset += 8;
                }
                
                if (this.buffer.length < offset + length) return; // Await more data
                
                // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
                var data = this.buffer.slice(offset, offset + length);
                if (masked) { // Apply an XOR mask if directed
                  
                  var mask = this.buffer.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
                  var w = 0;
                  for (var i = 0, len = data.length; i < len; i++) {
                    data[i] ^= mask[w];
                    w = w < 3 ? (w + 1) : 0; // `w` follows `i`, but wraps every 4. More efficient than `%`
                  }
                  
                }
                
                // Remove the frame we've managed to locate
                this.buffer = this.buffer.slice(offset + length); 
                
                // ==== PROCESS FRAME (based on `final`, `op`, and `data`)
                
                // The following operations can occur regardless of the socket's status
                if (op === 8) {         // Process "close" op
                  
                } else if (op === 9) {  // Process "ping" op
                  
                } else if (op === 10) { // Process "pong" op
                  
                }
                
                // For the following operations, ensure that the socket is open
                if (this.status !== 'started') continue;
                
                // Validate "continuation" functionality
                if (op === 0 && this.curOp === null) throw new Error('Invalid continuation frame');
                if (op !== 0 && this.curOp !== null) throw new Error('Expected continuation frame');
                
                // Process "continuation" ops as the op which is being continued
                if (op === 0) op = this.curOp;
                
                if (op === 1) {         // Process "text" op
                  
                  // Note: can check if this is the first frame in the "text" op by checking `this.curOp === null`
                  this.curOp = 1;
                  this.curFrames.push(data.toString('utf8'));
                  
                  if (final) {
                    
                    var fullStr = this.curFrames.join('');
                    this.curOp = null;
                    this.curFrames = [];
                    
                    var obj = U.stringToThing(fullStr);
                    U.debug('RECEIVED', obj);
                    
                  }
                  
                } else {
                  
                  throw new Error('Unexpected op: ' + op);
                  
                }
                
              }
              
            } catch(err) {
              
              console.log('ERROR:', err);
              
              this.buffer = new Buffer(0);
              this.curOp = null;
              this.curFrames = null;
              
              // TODO: close socket (from nodejsWebsocket:Connection.prototype.close)
              
            } 
            
          }
          
        };},
        statik: {
          requiredHeaders: [ 'sec-websocket-key', 'sec-websocket-version', 'host', 'upgrade', 'connection' ],
          genHash: require('crypto').createHash.bind(null, 'sha1'),
          int32: Math.pow(2, 32),
          invInt32: 1 / Math.pow(2, 32)
        }
      })
      /// =SERVER}
      
    };
    
    return sv;
    
  }
}).build();
