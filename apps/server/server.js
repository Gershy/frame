// TODO: Should the "Session" class also be available on the client side?
// There would only ever be one instance, with no channels and a child named "app".
// Then the client-side could forward orders to the app in the same way as the
// server side!

// TODO: Eventually "order" should become "command" or vice-versa
//  - "order" is shorter to type, but confused with ordinality

// NOTE: An "app" seems to be getting defined as a component of the program that is able to completely
// separate giving, and heeding, orders. Instead, an "app" can give an order, and later/independently
// heed an incoming order which may or may not be related to its original outgoing order.

new PACK.pack.Package({ name: 'server',
  /// {SERVER=
  dependencies: [ 'p', 'tree', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'p', 'tree' ],
  /// =CLIENT}
  buildFunc: function(packageName /* ... */) {
    
    /// {SERVER=
    var p = arguments[1];
    var tr = arguments[2];
    var fr = arguments[3];
    var fs = require('fs');
    var path = require('path');
    /// =SERVER}
    /// {CLIENT=
    var p = arguments[1];
    var tr = arguments[2];
    /// =CLIENT}
    
    var P = p.P;
    
    var sv = {
      
      legalExtensions: {
        // "!" preceeding the extension name indicates a binary filetype
        '.html' : 'text/html',
        '.js':    'application/javascript', 
        '.json':  'application/json',
        '.css':   'text/css',
        '.txt':   'text/plain',
        '.jpg':   '!image/jpeg',
        '.gif':   '!image/gif',
        '.png':   '!image/png',
        '.ico':   '!image/x-icon',
        '.eot':   '!font/eot',
        '.woff':  '!font/woff',
        '.ttf':   '!font/ttf',
        '.svg':   '!image/svg+xml'
      },
      $readFile: function(filepath) {
        // Find a static file, return it as an `OrderResponse`
        
        var ext = path.extname(filepath);
        if (!O.contains(sv.legalExtensions, ext)) throw new Error('Illegal extension: "' + ext + '"');
        ext = sv.legalExtensions[ext];
        
        if (ext[0] === '!') {
          var encoding = 'binary';
          ext = ext.substr(1);
        } else {
          var encoding = 'utf8';
        }
        
        return new P({ cb: fs.readFile, args: [ filepath, encoding ] }).then(function(data) {
          return new sv.OrderResponse({
            encoding: encoding,
            contentType: ext,
            data: data
          });
        });
        
      },
      
      getPhysicalHostData: function() {
        
        /// {SERVER=
        return {
          host: fr.host,
          port: fr.port
        };
        /// =SERVER}
        
        /// {CLIENT=
        return {
          host: window.location.hostname,
          port: parseInt(window.location.port || 80) // TODO: This isn't taking https into account
        };
        /// =CLIENT}
        
      },
      
      /* Channeler - manage multiple channels */
      Channeler: U.makeClass({ name: 'Channeler', superclass: tr.TreeNode,
        description: 'Entry point for remote communications. Manipulates a number ' +
          'of channels in order to provide protocol-agnostic communication with ' +
          'the other side.',
        methods: function(sc) { return {
          
          init: function(params /* appName, assetVersion, handler */) {
            
            this.assetVersion = U.param(params, 'assetVersion', U.charId(parseInt(Math.random() * 1000), 3));
            this.appName = U.param(params, 'appName');
            this.handler = U.param(params, 'handler', null);
            
            this.channels = {};
            this.favouriteChannel = null;
            
            /// {SERVER=
            this.sessionSet = {};
            /// =SERVER}
            
          },
          /// {SERVER=
          getSession: function(ip) {
            
            if (!O.contains(this.sessionSet, ip)) {
              this.sessionSet[ip] = new sv.Session({ ip: ip, channeler: this });
              // TODO: Session timeouts
              console.log('Initiated session: ' + this.sessionSet[ip].ip + ' (' + this.sessionSet[ip].id + ')');
            }
            
            return this.sessionSet[ip];
            
          },
          /// =SERVER}
          addChannel: function(channel) {
            
            this.channels[channel.name] = channel;
            channel.channeler = this;
            
            var pass = this;
            channel.$initialized().then(function() {
              if (!pass.favouriteChannel || channel.priority > pass.favouriteChannel.priority) {
                pass.favouriteChannel = channel;
              }
            });
            
            return channel;
            
          },
          
          getNamedChild: function(name) {
            
            if (name === '~root') { return this.handler; }
            if (O.contains(this.channels, name)) return this.channels[name];
            return null;
            
          },
          
          $giveOrder: function(params /* session, data, channelerParams { channelName, channelParams } */) { // Channeler
            
            /*
            Notifies the other side using the best possible method.
            
            If `params.channelerParams.channelName` is provided, then the named
            channel is guaranteed to be used to communicate the order.
            */
            
            /// {SERVER=
            var session = U.param(params, 'session');
            /// =SERVER}
            /// {CLIENT=
            var session = null;
            /// =CLIENT}
            
            var channelerParams = U.param(params, 'channelerParams', {});
            var channelName = U.param(channelerParams, 'channelName', null);
            var channelParams = U.param(channelerParams, 'channelParams', {});
            
            var channel = channelName ? U.param(this.channels, channelName) : this.favouriteChannel;
            
            // Use the channel to give the order (with the appropriate params)
            return channel.$giveOrder({
              session: session,
              data: params.data,
              channelParams: channelParams
            });
            
          },
          $heedOrder: function(params /* session, address, command, params, channelerParams */) { // Channeler
            
            /*
            Obeys an order from the other side
            
            The existence of `params.channelParams` is useful when bouncing orders need
            to be generated, and so it is provided to the child which will consume the
            order.
            */
            
            if (params === null) return p.$null; // `null` is received from fizzling
            
            var pass = this;
            var orderDesc = '<UNRECOGNIZED ORDER>';
            return new P({ run: function() {
              
              var address = U.param(params, 'address', []);
              if (U.isObj(address, String)) address = address.split('.');
              
              /// {SERVER=
              var session = U.param(params, 'session');
              /// =SERVER}
              /// {CLIENT=
              var session = null;
              /// =CLIENT}
              var command = U.param(params, 'command');
              var orderParams = U.param(params, 'params', {});
              var channelerParams = U.param(params, 'channelerParams', {});
              
              orderDesc = (address.length ? address.join('.') : '~root') + '.' + command + '(' + U.debugObj(orderParams) + ');';
              
              var child = pass.getChild(address);
              if (!child) throw new Error('Invalid address: "' + address.join('.') + '"');
              
              // TODO: This looks messy; checking if `child` is an `sv.Channel` seems hackish??
              if (child === pass) {
                
                // The Channeler itself is consuming the order (via `Channeler.prototype.$heedOrder0`)
                return pass.$heedOrder0({ session: session, command: command, params: orderParams, channelerParams: channelerParams });
              
              } else if (U.isInstance(child, sv.Channel)) {
                
                // A Channel is consuming the order (so it needs channel params, not sessionhandler params)
                return child.$heedOrder({ session: session, command: command, params: orderParams, channelParams: U.param(channelerParams, 'channelParams', {}) });
                
              } else {
                
                // Some other child is consuming the order
                var channelName = U.param(channelerParams, 'channelName', null);
                var channelParams = U.param(channelerParams, 'channelParams', {});
                var channel = channelName ? U.param(pass.channels, channelName, null) : null;
                
                var $result = child.$heedOrder({ session: session, command: command, params: orderParams, channelerParams: channelerParams })
                
                // The Channel may need to do some cleanup if it is connection-based or potentially for other reasons (that I haven't thought of)
                // TODO: Should cleanup be done for Channel and Channeler actions as well??
                if (channel)
                  $result = $result.then(channel.cleanup.bind(channel, channelParams));
                
                return $result;
                
              }
              
            }}).then(function() {
              
              console.log('SUCCESS: ' + orderDesc);
              
            }).fail(function(err) {
              
              console.log('FAILURE: ' + orderDesc);
              console.error(err);
              
              // TODO: Immediately use `$giveOrder` to inform the client-side of an error??
              
            });
            
          },
          $heedOrder0: function(params /* session, command, params, channelerParams */) {
            
            var pass = this;
            return new P({ run: function() {
              
              var command = params.command;
              var orderParams = params.params;
              var channelerParams = params.channelerParams;
              var session = params.session;
              
              if (command === 'getFile') {
                
                // TODOVUL: The file access validation here is FARRRRR TOOOOOO LOOOOOOOOOOSE
                
                var reqPath = U.param(orderParams, 'path');
                var lastCmp = reqPath[reqPath.length - 1].toLowerCase();
                if (S.endsWith(lastCmp, '.html')) {
                  
                  // Do any required html replacement
                  
                  var appName = pass.appName;
                  var assetVersion = pass.assetVersion
                  var $orderResponse = sv.$readFile(path.join.apply(path, reqPath)).then(function(orderResponse) {
                  
                    orderResponse.data = orderResponse.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
                    orderResponse.data = orderResponse.data.replace(/{{assetVersion}}/g, assetVersion);
                    orderResponse.data = orderResponse.data.replace('{{title}}', appName);
                    
                    var ver = '?' + assetVersion;
                    var htmlHeaderElems = [];
                    // htmlHeaderElems.push('<link rel="stylesheet" type="text/css" href="apps/' + appName + '/css/style.css' + ver + '"/>');
                    
                    if (O.contains(PACK[appName], 'resources')) {
                      var r = PACK[appName].resources;
                      if (O.contains(r, 'css')) r.css.forEach(function(css) { htmlHeaderElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
                      if (O.contains(r, 'js')) r.js.forEach(function(js) { htmlHeaderElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
                    }
                    
                    var htmlHeaderStr = htmlHeaderElems.length
                      ? '\n' + htmlHeaderElems.map(function(html) { return '    ' + html; }).join('\n')
                      : '';
                    orderResponse.data = orderResponse.data.replace(/(\s*){{resources}}/, htmlHeaderStr);
                    
                    return orderResponse;
                    
                  }).fail(function(err) {
                    
                    console.log('Failed serving file: ' + reqPath.join('/'));
                    console.error(err);
                    return new sv.OrderResponse({
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
                  
                  // Do any javascript validation and path replacement (due to compiled file name mapping)
                  
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
                    
                    var $orderResponse = sv.$readFile(fullPath);
                    
                  } catch(err) {
                    
                    console.log('BAD:', err.message);
                    var $orderResponse = new P({ err: err });
                    
                  }
                  
                } else {
                  
                  // Serve any non-html, non-js file directly
                  
                  var $orderResponse = sv.$readFile(path.join.apply(path, reqPath));
                  
                }
                
                return $orderResponse.fail(function(err) {
                  
                  return new sv.OrderResponse({
                    encoding: 'utf8',
                    contentType: 'text/plain',
                    httpCode: 404,
                    data: 'File "' + reqPath.join('/') + '" unavailable (' + err.message + ')'
                  });
                  
                }).then(function(orderResponse) {
                  
                  return pass.$giveOrder({
                    session: session,
                    data: orderResponse,
                    channelerParams: channelerParams
                  });
                  
                });
                
              } else if (command === 'ping') {
                
                return pass.$giveOrder({
                  session: session,
                  data: {
                    address: U.param(orderParams, 'returnAddress', '~root'),
                    command: 'pong',
                    data: null
                  },
                  channelerParams: channelerParams
                });
                
              } else if (command === 'pong') {
                
                return null; // No bouncing order from a "pong" command
                
              } else if (command === 'getSessionData') {
                
                return pass.$giveOrder({
                  session: session,
                  data: {
                    address: U.param(orderParams, 'returnAddress', '~root'),
                    command: 'gotSessionData',
                    data: new sv.OrderResponse({
                      encoding: 'utf8',
                      contentType: 'text/json',
                      data: {
                        ip: session.ip,
                        id: session.id
                      }
                    })
                  },
                  channelerParams: channelerParams
                });
                
              } else if (command === 'getServerTime') {
                
                // TODO
                throw new Error('not implemented');
                
              }
              
              throw new Error('Invalid order: "' + command + '"');
                
            }});
            
          },
          
          $start: function() {
            
            return new P({ all: O.map(this.channels, function(channel) {
              return channel.$start();
            })});
            
          },
          stop: function() {
            
            O.each(this.channels, 'stop');
            
          }
          
        };}
      }),
      
      /* Channel - manages sending orders between two remote locations */
      Channel: U.makeClass({ name: 'Channel', superclass: tr.TreeNode,
        methods: function(sc) { return {
          init: function(params /* name, priority */) {
            
            /*
            "name" - names the channel
            "priority" - signals how preferrable the channel is. Suppose that
              both http and sokt capabilities exist; when both are available we
              would prefer to use the "sokt" channel as it is a more efficient
              protocol. So the sokt channel should be given a higher priority
              than the http channel.
            */
            
            this.name = U.param(params, 'name');
            this.priority = U.param(params, 'priority', 0);
            this.channeler = null;
            
          },
          $initialized: function() {
            return new P({ err: new Error('not implemented') });
          },
          useSessionData: function(session) {
            if (!O.contains(session.channelData, this.name)) session.channelData[this.name] = this.genDefaultSessionData();
            return session.channelData[this.name];
          },
          
          genDefaultSessionData: function() {
            return {};
          },
          
          $giveOrder: function(params /* session, data, channelParams */) { // Channel
            
            // Channel params are included here so that they may alter the way in which
            // the channel communicates `params.data`.
            
            return new P({ err: new Error('not implemented') });
            
          },
          $heedOrder: function(params /* session, command, params, channelParams */) {  // Channel
            
            // Causes this specific channel to send a notification
            // Channel params are included here in case the channel gives a bouncing order
            
            var pass = this;
            return new P({ run: function() {
              
              var session = U.param(params, 'session');
              var command = U.param(params, 'command');
              var orderParams = U.param(params, 'params', {});
              var channelParams = U.param(params, 'channelParams', {});
              
              if (command === 'notifyMe') {
                
                var returnAddress = U.param(orderParams, 'returnAddress', '~root');
                pass.$giveOrder({
                  session: session,
                  data: {
                    address: returnAddress,
                    command: 'notify',
                    data: 'Your notification'
                  },
                  channelParams: channelParams
                }).done();
                return null;
                
              } else {
                
                throw new Error('Invalid command: "' + command + '"');
                
              }
              
            }});
            
          },
          
          cleanup: function(channelParams) {
          },
          
          $start: function() { throw new Error('not implemented'); },
          stop: function() { throw new Error('not implemented'); }
        };}
      }),
      ChannelHttp: U.makeClass({ name: 'ChannelHttp', superclassName: 'Channel',
        methods: function(sc, c) { return {
          init: function(params /* name, channeler, host, port, numToBank */) {
            sc.init.call(this, params);
            this.host = U.param(params, 'host');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
            this.server = null;
            
            /// {CLIENT=
            this.numToBank = U.param(params, 'numToBank', 1);
            this.numBanked = 0;
            /// =CLIENT}
          },
          $initialized: function() {
            return this.$ready;
          },
          genDefaultSessionData: function() {
            return {
              pending: [],
              polls: []
            };
          },
          
          sendResponse: function(res, data) {
            
            var orderResponse = U.isInstance(data, sv.OrderResponse) ? data : new sv.OrderResponse({ data: data });
            orderResponse.endResponse(res);
            res['~finalized'] = true;
            
          },
          $giveOrder: function(params /* session, data, channelParams { res } */) { // ChannelHttp
            
            var data = U.param(params, 'data');
            
            /// {SERVER=
            
            // Reply to the order using either the Response instance found at
            // `params.channelParams.res`, or using the oldest queued longpoll.
            // If neither of these methods produces a Response instance, queue
            // the `params.data` value until a longpoll becomes available.
            
            // Note that promise fulfillment in this case means that the server
            // has decided to send the order, NOT that the order has been
            // received by the client.
            
            // Get the session data
            var session = U.param(params, 'session');
            var sessionData = this.useSessionData(session);
            var channelParams = U.param(params, 'channelParams', {});
            
            // Get the Response instance
            var res = U.param(channelParams, 'res', null);  // Attempt one: use a provided Response object
            if (!res) res = sessionData.polls.shift();      // Attempt two: use a queued Response object
            
            if (res) {
              
              // We have a Response instance! Use `orderResponse` to respond with it.
              this.sendResponse(res, data);
              
            } else {
              
              // No Response instance found. Need to queue `orderResponse` until we can send it.
              sessionData.pending.push(data);
              
            }
            
            return p.$null;
            
            /// =SERVER}
            /// {CLIENT=
            
            // Get all the data for the query from `params.data`
            var address = U.param(data, 'address');
            var command = U.param(data, 'command');
            var params = U.param(data, 'params');
            
            return this.$doQuery({
              address: address,
              command: command,
              params: params
            });
            
            /// =CLIENT}
            
          },
          $heedOrder: function(params /* session, command, params, channelParams */) { // ChannelHttp
            
            if (!params.channelParams) throw new Error('WAT????');
            if (!params.channelParams.res) throw new Error('WAT');
            
            /// {SERVER=
            var pass = this;
            return new P({ run: function() {
              
              var session = U.param(params, 'session');
              var command = U.param(params, 'command');
              var orderParams = U.param(params, 'params', {});
              var channelParams = U.param(params, 'channelParams', {});
              
              if (command === 'getNumBankedPolls') {
                
                var sessionData = pass.useSessionData(session);
                var returnAddress = U.param(orderParams, 'returnAddress', '~root');
                
                return pass.$giveOrder({
                  session: session,
                  data: {
                    address: returnAddress,
                    command: 'gotNumBankedPolls',
                    data: sessionData.polls.length
                  },
                  channelParams: channelParams
                });
                
              } else if (command === 'bankPoll') {
                
                var sessionData = pass.useSessionData(session);
                var res = U.param(channelParams, 'res'); // When banking a poll, the Response instance must be available here
                
                // If an order is pending, send it using the poll. Otherwise, bank the
                // poll until an order becomes available to be sent.
                
                if (sessionData.pending.length) pass.sendResponse(res, sessionData.pending.shift());
                else                            sessionData.polls.push(res);
                
                return null;
                
              } else if (command === 'fizzleAllPolls') {
                
                console.log('FIZZLING!!');
                
                var polls = pass.useSessionData(session).polls;
                while (polls.length) pass.sendResponse(polls.shift(), null);
                
                return pass.$giveOrder({
                  session: session,
                  data: null,
                  channelParams: channelParams
                });
                
              }
              
              return sc.$heedOrder.call(pass, params);
                
            }});
            /// =SERVER}
            
            /// {CLIENT=
            // No requests available
            return new P({ err: new Error('Invalid request') });
            /// =CLIENT}
            
          },
          
          /// {SERVER=
          cleanup: function(channelParams) {
            
            var res = U.param(channelParams, 'res');
            if (!res['~finalized']) this.sendResponse(res, null);
            
          },
          
          $parseQuery: function(req) { // Parses a Request into a `{ address, command, params }` value
            
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
              if (O.contains(queryParams, '_data')) {
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
            
            // Ensure that "queryUrl" is represented as an `Array`
            queryUrl = queryUrl ? queryUrl.split('/') : [];
            
            var method = req.method.toLowerCase();
            if (method === 'get') {
              
              var $ret = new P({ val: queryParams });
              
            } else if (method === 'post') {
              
              var $ret = new P({ custom: function(resolve, reject) {
                
                var chunks = [];
                
                req.setEncoding('utf8');
                req.on('error', reject);
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
                
                if (S.contains(queryUrl[queryUrl.length - 1], '.')) {
                  
                  // Addressing a file in the URL results in a root-targeted "getFile" command
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
                address: address, // Array
                command: command, // String
                params: params    // Object
              };
              
            });
            
          },
          serverFunc: function(req, res) {
            
            var pass = this;
            this.$parseQuery(req).then(function(queryObj) { // Send the query to the correct child
            
              // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
              var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].replace(/[^0-9a-f.]/g, '');
              var session = pass.channeler.getSession(ip);
              
              // TODO: What about error handling? If `pass.channeler.$heedOrder` rejects, it must not have given any orders...
              return pass.channeler.$heedOrder({
                session: session,
                address: U.param(queryObj, 'address'),
                command: U.param(queryObj, 'command'),
                params: U.param(queryObj, 'params', {}),
                channelerParams: {
                  channelName: pass.name,
                  channelParams: { res: res }
                }
              });
              
            }).fail(function(err) {
              
              console.log('UNHANDLED ERROR (should probably use `$giveOrder` to notify)');
              console.error(err);
              
            }).done();
            
          },
          /// =SERVER}
          /// {CLIENT=
          $doQuery: function(params /* address, command, params, ref */) {
            
            // The only command that can be issued before the HttpChannel is $ready is "fizzleAllPolls"
            var command = U.param(params, 'command');
            if (this.$ready.status === 'pending' && command !== 'fizzleAllPolls') return new P({ err: new Error('Can\'t query until ready') });
            
            var address = U.param(params, 'address');
            if (U.isObj(address, String)) address = address.split('.');
            
            var reqParams = U.param(params, 'params', {});
            var ref = U.param(params, 'ref', null);
            
            var dbgErr = new Error('DBGXHR: ' + address.join('.') + '.' + command + '(' + U.debugObj(reqParams) + ')'); // TODOPRF: This should be a debug feature
            
            
            var pass = this;
            return new P({ custom: function(resolve, reject) {
              
              var formatIncoming = ref === null
                ? function(xhr) { return U.stringToThing(xhr.responseText); }
                : function(xhr) { return { ref: ref, result: U.stringToThing(xhr.responseText) }; };
              
              var xhr = new XMLHttpRequest();
              xhr.onreadystatechange = function() {
                
                if (xhr.readyState !== 4) return;
                
                try {
                  
                  if (xhr.status === 200) return resolve(formatIncoming(xhr));
                  
                  if (xhr.status === 0) {
                    console.log('Warning: xhr status: 0');
                    return resolve(null); // Status 0 indicates browser error. TODO: This can make cross domain errors hard to detect
                  }
                  
                  dbgErr.message += '\nStatus: ' + xhr.status + '; Message: "' + xhr.responseText + '"';
                  return reject(dbgErr);
                  
                } catch(err0) {
                  
                  err0.message = 'Deeper error: ' + err0.message;
                  return reject(err0);
                  
                }
                
              };
              
              xhr.open('POST', '', true);
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.send(U.thingToString({ address: address, command: command, params: reqParams }));
              
            }}).then(function(order) {
              
              // TODO: What if `order` is the number zero (`0`)? It should probably be required to be an `Object`.
              return order ? pass.channeler.$heedOrder(order) : null;
              
            });
            
          },
          doBankPolls: function() {
            
            var pass = this;
            while (this.numBanked < this.numToBank) {
              
              this.$doQuery({ address: [ this.name ], command: 'bankPoll' })
                .then(function(order) {
                  pass.numBanked--;
                  pass.doBankPolls();
                })
                .done();
              
              this.numBanked++;
              
            }
            
          },
          /// =CLIENT}
          
          $start: function() {
            
            /// {SERVER=
            this.server = require('http').createServer(this.serverFunc.bind(this));
            this.server.listen(this.port, this.host, 511, this.$ready.resolve.bind(this.$ready));
            return this.$ready;
            /// =SERVER}
            
            /// {CLIENT=
            // Ensure there are no polls already held by the server. If the server attempted
            // to resolve these polls, *this* instance would not be informed because it has
            // no reference to the XMLHttpRequest instances which initiated these polls.
            var pass = this;
            
            return this.$doQuery({ address: [ this.name ], command: 'fizzleAllPolls' })
              .then(function(data) {
                pass.$ready.resolve(null);
                pass.doBankPolls();
              })
              .fail(console.error.bind(console))
              .done();
            /// =CLIENT}
            
          },
          stop: function() {
            
            /// {SERVER=
            this.server.close();
            this.server = null;
            /// =SERVER}
            /// {CLIENT=
            console.log('FIZZLING');
            this.$doQuery({ address: [ this.name ], command: 'fizzleAllPolls' }).done();
            /// =CLIENT}
            
          }
        };}
      }),
      ChannelSocket: U.makeClass({ name: 'ChannelSocket', superclassName: 'Channel',
        methods: function(sc, c) { return {
          init: function(params /* name, channeler, host, port */) {
            sc.init.call(this, params);
            this.host = U.param(params, 'host');
            this.port = U.param(params, 'port');
            this.$ready = new P({});
            
            /// {SERVER=
            this.socket = null;
            this.connections = {}; // Could save the connections using `this.useSessionData` instead of initializing a new list...
            /// =SERVER}
          },
          $initialized: function() { return this.$ready; },
          
          $giveOrder: function(params /* session, data, channelParams */) { // ChannelSocket
            
            var channelParams = U.param(params, 'channelParams', {});
            var data = U.param(params, 'data');
            
            /// {SERVER=
            var session = U.param(params, 'session');
            var connection = this.connections[session.ip];
            return connection.$giveOrder({ data: U.thingToString(data) });
            /// =SERVER}
            /// {CLIENT=
            this.socket.send(U.thingToString(data));
            return p.$null;
            /// =CLIENT}
            
          },
          $heedOrder: function(params /* session, command, params, channelParams */) { // ChannelSocket
            
            /// {SERVER=
            var session = params.session;
            var command = params.command;
            var reqParams = params.params;
            /// =SERVER}
            /// {CLIENT=
            /// =CLIENT}
            
            return sc.$heedOrder.call(this, params);
            
          },
          
          /// {SERVER=
          socketConnectAttempt: function(socket) {
            
            var ip = socket.remoteAddress;
            if (O.contains(this.connections, ip)) { console.log('Refused connection overwrite attempt: "' + ip + '"'); return; }
            
            this.connections[ip] = new sv.SocketConnection({ ip: ip, channel: this, socket: socket });
            
            socket.on('close', this.closeConnection.bind(this, ip, this.connections[ip]));

          },
          closeConnection: function(ip, connection) {
            
            this.status = 'ending';
            
            connection.socket.on('close', function() { this.status = 'ended'; }.bind(this)); // TODO: This even may have already been thrown
            connection.socket.close();
            
            delete this.connections[ip];
            
          },
          /// =SERVER}
          
          $start: function() {
            
            /// {SERVER=
            // For secure connections, can swap "net" for "tls"
            this.socket = require('net').createServer(this.socketConnectAttempt.bind(this));
            this.socket.listen(this.port, this.host, 511, this.$ready.resolve.bind(this.$ready));
            /// =SERVER}
            /// {CLIENT=
            var socket = new WebSocket('ws://' + this.host + ':' + this.port);
            var channeler = this.channeler;
            socket.onopen = this.$ready.resolve.bind(this.$ready);
            socket.onmessage = function(evt) {
              
              channeler.$heedOrder(O.update(
                U.stringToThing(evt.data),
                {
                  session: null,
                  channelerParams: {}
                }
              )).done();
              
            };
            this.socket = socket;
            /// =CLIENT}
            
            return this.$ready;
            
          },
          stop: function() {
            
            /// {SERVER=
            // TODO: Delete all connections
            this.socket.close();
            /// =SERVER}
            /// {CLIENT=
            this.socket.close();
            /// =CLIENT}
            
          }
        };}
      }),
      
      /// {SERVER=
      Session: U.makeClass({ name: 'Session',
        description: 'The entry-point for queries on the server-side. A Session references ' +
          'all available channels, and the application (which can be accessed via its `getChild` ' +
          'method). Any request either sends the session an order (e.g. "ping", "getFile", ' +
          '"getSessionData"), or locates another handler via the session\'s `getChild` method. ' +
          'Note that this is a very different style of entry-point from the client-side! On the ' +
          'client-side, orders are received by some available Channel and in all cases ' +
          'forwarded to the `Channel.prototype.$heedOrder` method - which is the ' +
          'client-side entry-point.',
        methods: function(sc) { return {
          init: function(params /* ip, channeler */) {
            this.ip = U.param(params, 'ip');
            this.channeler = U.param(params, 'channeler');
            this.id = U.id(sv.Session.NEXT_ID++);
            this.channelData = {};
          },
        }},
        statik: { NEXT_ID: 0 }
      }),
      OrderResponse: U.makeClass({ name: 'OrderResponse',
        description: 'Handles the sending of orders to the other side via HTTP',
        methods: function(sc) { return {
          init: function(params /* httpCode, contentType, encoding, data */) {
            
            this.httpCode = U.param(params, 'code', 200);
            this.contentType = U.param(params, 'contentType', 'text/json');
            this.encoding = U.param(params, 'encoding', 'binary'); // 'binary' | 'utf8'
            this.data = U.param(params, 'data');
            
          },
          endResponse: function(res) {
            
            var data = this.contentType === 'text/json' ? U.thingToString(this.data) : this.data;
            res.writeHead(this.httpCode ? this.httpCode : 200, {
              'Content-Type': this.contentType,
              'Content-Length': Buffer.byteLength(data, this.encoding)
            });
            res.end(data, this.encoding);
            
          },
          endSocket: function(skt) {
            
            throw new Error('not implemented');
            
          }
        };}
      }),
      SocketConnection: U.makeClass({ name: 'SocketConnection',
        methods: function(sc, c) { return {
          
          init: function(params /* ip, channel, socket */) {
            
            this.ip = U.param(params, 'ip');
            var socket = this.socket = U.param(params, 'socket');
            this.channel = U.param(params, 'channel');
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
          
          $giveOrder: function(params /* data, socketParams */) { // SocketConnection
            
            // Doesn't need a session, as a socket is by definition pointed at a single target
            // No extra information is required to narrow down the identity of the recipient
            
            // TODO: Are `params.socketParams` ever necessary??
            
            return new P({ custom: function(resolve) {
              
              var data = U.param(params, 'data');
              
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
                  
                  throw Error('not implemented op: 8');
                  
                } else if (op === 9) {  // Process "ping" op
                  
                  throw Error('not implemented op: 9');
                  
                } else if (op === 10) { // Process "pong" op
                  
                  throw Error('not implemented op: 10');
                  
                }
                
                // For the following operations, ensure that the socket is open
                if (this.status !== 'started') continue;
                
                // Validate "continuation" functionality
                if (op === 0 && this.curOp === null) throw new Error('Invalid continuation frame');
                if (op !== 0 && this.curOp !== null) throw new Error('Expected continuation frame');
                
                // Process "continuation" ops as if they were the op being continued
                if (op === 0) op = this.curOp;
                
                if (op === 1) {         // Process "text" op
                  
                  // Note: `this.curOp === null` at this point can tell us if this is the first frame
                  
                  this.curOp = 1;
                  this.curFrames.push(data.toString('utf8'));
                  
                  if (final) {
                    
                    var fullStr = this.curFrames.join('');
                    this.curOp = null;
                    this.curFrames = [];
                    
                    var channeler = this.channel.channeler;
                    
                    var order = O.update(U.stringToThing(fullStr), {
                      session: channeler.getSession(this.ip),
                      channelerParams: {}
                    });
                    
                    channeler.$heedOrder(order).done();
                    //var channeler = this.channel.channeler;
                    //channeler.getSession(this.ip).$heedOrder(obj).done();
                    
                    // this.$heedOrder(obj).done();
                    
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
