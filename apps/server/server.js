// TODO: Websocket fallback is available on client side, but the server isn't yet
// learning that a client is missing websocket support. There should really be a
// `favouriteChannel` property on Sessions instead of a single `favouriteChannel`
// on the Channeler.

/// {CLIENT=
var testWebsocketFallback = false;
if (testWebsocketFallback) WebSocket = null;
/// =CLIENT}

var CNT = 0;

new PACK.pack.Package({ name: 'server',
  /// {SERVER=
  dependencies: [ 'p', 'tree', 'frame' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'p', 'tree' ],
  /// =CLIENT}
  buildFunc: function(sv /* ... */) {
    
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
    
    sv.legalExtensions = {
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
    };
    
    sv.$readFile = function(filepath) {
      // Find a static file, return it as an `CommandResponse`
      
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
        return new sv.CommandResponse({
          encoding: encoding,
          contentType: ext,
          data: data
        });
      });
      
    };
    
    sv.getPhysicalHostData = function() {
      
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
      
    };
    
    /* Channeler - manage multiple channels */
    sv.Channeler = U.makeClass({ name: 'Channeler', mixins: [ tr.TreeNode ],
      description: 'Entry point for remote communications. Manipulates a number ' +
        'of channels to provide protocol-agnostic communication with the other ' +
        'side',
      resolvers: {
        init: function(initConflicts, params) {
          initConflicts.TreeNode.call(this, params);
          initConflicts.Channeler.call(this, params);
        }
      },
      methods: function(sc) { return {
        
        init: function(params /* appName, assetVersion, handler */) {
          
          this.assetVersion = U.param(params, 'assetVersion', U.charId(parseInt(Math.random() * 1000), 3));
          this.appName = U.param(params, 'appName');
          this.handler = U.param(params, 'handler', null);
          this.errorHandler = {
            $heedCommand: function(params /* session, channelerParams, command, data */){
              console.log('ERRORHANDLER:', params.data);
              return p.$null;
            }
          };
          
          this.channels = {};
          this.favouriteChannel = null; // TODO: There's no such thing as a single favourite channel. There's a favourite channel per Session
          
          /// {SERVER=
          this.sessionSet = {};
          /// =SERVER}
          
          /// {CLIENT=
          // TODODBG: Allow spoofing via url params
          var urlParams = U.parseUrl(window.location.href).params;
          this.ipSpoof = U.param(urlParams, 'spoof', null);
          /// =CLIENT}
          
        },
        
        /// {SERVER=
        getSession: function(ip) {
          
          return O.contains(this.sessionSet, ip) ? this.sessionSet[ip] : new sv.Session({ ip: ip, channeler: this });
          
        },
        addSession: function(session) {
          
          // TODO: Session timeout
          this.sessionSet[session.ip] = session;
          console.log('Persisted session: ' + session.ip);
          
        },
        remSession: function(ip) {
          
          if (U.isObj(ip, sv.Session)) ip = ip.ip;
          if (!O.contains(this.sessionSet, ip)) throw new Error('Can\'t remove nonexistant session: ' + ip);
          delete this.sessionSet[ip];
          
        },
        /// =SERVER}
        
        addChannel: function(channel) {
          
          this.channels[channel.name] = channel;
          channel.channeler = this;
          channel.par = this;
          
          var pass = this;
          channel.$ready.then(function() {
            
            if (!pass.favouriteChannel || channel.priority > pass.favouriteChannel.priority) pass.favouriteChannel = channel;
            
          });
          
          return channel;
          
        },
        
        getNamedChild: function(name) {
          
          if (name === '~root') { return this.handler; }
          if (name === '~error') { return this.errorHandler; }
          if (O.contains(this.channels, name)) return this.channels[name];
          return null;
          
        },
        
        $giveCommand: function(params /* session, channelerParams { channelName, channelParams }, data */) { // Channeler
          
          /*
          Notifies the other side using the best possible method.
          
          If `params.channelerParams.channelName` is provided, then the named
          channel is guaranteed to be used to communicate the command.
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
          
          if (params.data === null) return; // This occurs upon fizzling
          
          if (U.isInstance(params.data, Error)) { // Errors become commands to the error handler
            var err = params.data;
            params.data = {
              address: '~error',
              command: 'mod',
              params: { data: err.message, doSync: false }
            };
          } else { var err = null; }
          
          /// {CLIENT=
          if (!params.data || !params.data.address) throw new Error('Missing address');
          /// =CLIENT}
          
          /// {SERVER=
          if (!U.isInstance(params.data, sv.CommandResponse) && (!params.data || !params.data.address)) {
            console.log(params);
            throw new Error('Missing address');
          }
          
          /// =SERVER}
          
          // Use the channel to give the command (with the appropriate params)
          return channel.$giveCommand({
            session: session,
            channelerParams: channelerParams,
            channelParams: channelParams,
            data: params.data
          });
          
        },
        $passCommand: function(params /* session, channelerParams, address, command, params, $commandData */) { // Channeler
          
          // Obeys a command from the other side
          
          if (params === null) return p.$null; // `null` is received from fizzling
          
          var pass = this;
          var commandDescription = '<NO_DESCRIPTION>';
          
          var dbgErr = new Error();
          
          // If this overarching P fails, it's prolly a 500 error indication
          return new P({ run: function() {
            
            // Get the session
            /// {SERVER=
            var session = U.param(params, 'session');
            /// =SERVER}
            /// {CLIENT=
            var session = null;
            /// =CLIENT}
            
            // Get any available channeler params
            var channelerParams = U.param(params, 'channelerParams', {});
            var channelName = U.param(channelerParams, 'channelName', null);
            var channelParams = U.param(channelerParams, 'channelParams', {});
            var channel = channelName ? U.param(pass.channels, channelName, null) : null;
            
            // Resolve command data from either "$commandData", or "address" "command" and "params"
            if (params.hasOwnProperty('$commandData')) {
              
              var $commandData = params.$commandData;
              
            } else {
              
              var $commandData = new P({ value: params});
              
            }
            
            return $commandData.then(function(commandData) {
              
              var address = U.param(commandData, 'address');
              if (U.isObj(address, String)) address = address.split('.');
              
              var command = U.param(commandData, 'command');
              
              var child = pass.getChild(address);
              if (!child) throw new Error('Invalid address: "' + address.join('.') + '"');
              
              commandDescription = (address.join('.') || child.getAddress()) + '.' + command;
              
              var commandParams = U.param(commandData, 'params', {});
              if (!commandParams) throw new Error('Couldn\'t perform command: ' + commandDescription + '; NO PARAMS');
              
              if (U.isObj(commandParams, Object)) {
                
                var dat = commandParams.data || {};
                var prms = Object.keys(dat).join(', ');
                prms = prms.length ? '([ ' + prms  + ' ])' : '()';
                commandDescription += prms;
                
              } else {
                
                commandDescription += '(' + U.typeOf(commandParams) + ')';
                
              }
              //commandDescription += '(' + JSON.stringify(commandParams, null, 2) + ')';
              
              // `child` may either be the Channeler, a Channel, or any part of the Channeler's handler. Regardless,
              // `$heedCommand` is called with the same signature:
              return child.$heedCommand({ session: session, command: command, params: commandParams, channelerParams: channelerParams })
              
            }).then(function() {
              
              // if (!S.startsWith(commandDescription, pass.name + '.getFile'))
              //   console.log('Command success: (' + (session ? session.ip : 'SELF') + ') ' + commandDescription);
              
            }).fail(function(err) {
              
              //dbgErr.message = err.message;
              //console.error(dbgErr);
              console.log('Command failure: ' + commandDescription);
              console.error(err);
              return pass.$commandFailed(session, channelerParams, err);
              
            }).then(function() {
              
              if (channel) channel.finalizeCommand(session, channelParams);
              
            });
            
          }});
          
        },
        $heedCommand: function(params /* session, command, params, channelerParams */) {
          
          var pass = this;
          return new P({ run: function() {
            
            var command = params.command;
            var commandParams = params.params;
            var channelerParams = params.channelerParams;
            var session = params.session;
            
            if (command === 'getFile') {
              
              // TODOVUL: The file access validation here is FARRRRR TOOOOOO LOOOOOOOOOOSE
              
              var reqPath = U.param(commandParams, 'path');
              var lastCmp = reqPath[reqPath.length - 1].toLowerCase();
              
              if (S.endsWith(lastCmp, '.html')) {
                
                // Do any required html replacement
                
                var appName = pass.appName;
                var assetVersion = '?' + pass.assetVersion;
                var $commandResponse = sv.$readFile(path.join.apply(path, reqPath)).then(function(commandResponse) {
                  
                  var title = appName + '<' + session.ip + '>';
                  
                  commandResponse.data = commandResponse.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
                  commandResponse.data = commandResponse.data.replace(/{{assetVersion}}/g, assetVersion);
                  commandResponse.data = commandResponse.data.replace('{{title}}', title);
                  
                  var htmlHeaderElems = [];
                  
                  if (O.contains(PACK[appName], 'resources')) {
                    var r = PACK[appName].resources;
                    if (O.contains(r, 'css')) r.css.forEach(function(css) { htmlHeaderElems.push('<link rel="stylesheet" type="text/css" href="' + css + assetVersion + '"/>'); });
                    if (O.contains(r, 'js')) r.js.forEach(function(js) { htmlHeaderElems.push('<script type="text/javascript" src="' + js + assetVersion + '"></script>'); });
                  }
                  
                  var htmlHeaderStr = htmlHeaderElems.length
                    ? '\n' + htmlHeaderElems.map(function(html) { return '    ' + html; }).join('\n')
                    : '';
                  commandResponse.data = commandResponse.data.replace(/(\s*){{resources}}/, htmlHeaderStr);
                  
                  // TODO: A bit meaningless to simply persist a session if it request an html page
                  pass.addSession(session);
                  
                  return commandResponse;
                  
                }).fail(function(err) {
                  
                  console.log('Failed serving file: ' + reqPath.join('/'));
                  console.error(err);
                  return new sv.CommandResponse({
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
                  
                  var $commandResponse = sv.$readFile(fullPath);
                  
                } catch(err) {
                  
                  var $commandResponse = new P({ err: err });
                  
                }
                
              } else {
                
                // TODOVUL: Serves any non-html, non-js file directly
                var $commandResponse = sv.$readFile(path.join.apply(path, reqPath));
                
              }
              
              return $commandResponse.fail(function(err) {
                
                return new sv.CommandResponse({
                  encoding: 'utf8',
                  contentType: 'text/plain',
                  httpCode: 404,
                  data: 'File "' + reqPath.join('/') + '" unavailable (' + err.message + ')'
                });
                
              }).then(function(commandResponse) {
                
                return pass.$giveCommand({
                  session: session,
                  channelerParams: channelerParams,
                  data: commandResponse
                });
                
              });
              
            } else if (command === 'ping') {
              
              return pass.$giveCommand({
                session: session,
                channelerParams: channelerParams,
                data: {
                  address: U.param(commandParams, 'returnAddress', '~root'),
                  command: 'pong',
                  data: null
                }
              });
              
            } else if (command === 'pong') {
              
              return null; // No response from a "pong" command
              
            } else if (command === 'getSessionData') {
              
              return pass.$giveCommand({
                session: session,
                channelerParams: channelerParams,
                data: {
                  address: U.param(commandParams, 'returnAddress', '~root'),
                  command: 'gotSessionData',
                  data: new sv.CommandResponse({
                    encoding: 'utf8',
                    contentType: 'text/json',
                    data: { ip: session.ip, id: session.id }
                  })
                }
              });
              
            } else if (command === 'getServerTime') {
              
              // TODO
              throw new Error('not implemented');
              
            }
            
            throw new Error('Invalid command: "' + command + '"');
              
          }});
          
        },
        
        $commandFailed: function(session, channelerParams, err) {
          
          return this.$giveCommand({
            session: session,
            channelerParams: channelerParams,
            data: err
          });
          
        },
        
        $start: function() {
          
          var pass = this;
          var successChannels = {};
          
          return new P({ all: O.map(this.channels, function(channel) {
            
            return channel.$start()
              .then(function() {
                successChannels[channel.name] = channel;
              })
              .fail(function() {
                console.log('Warning: Channel "' + channel.name + '" unsupported.');
              });
            
          })})
            .then(function() { pass.channels = successChannels; });
          
        },
        stop: function() {
          
          O.each(this.channels, 'stop');
          
        }
        
      };}
    });
    
    /* Channel - manages sending commands between two remote locations */
    sv.Channel = U.makeClass({ name: 'Channel', mixins: [ tr.TreeNode ],
      description: 'An implementation of a protocol for communicating between two physical machines. ' +
        'Must be able to make distinctions between different machines. This base class provides ' +
        'functionality for storing data for different sessions server-side.',
      resolvers: {
        init: function(initConflicts, params) {
          initConflicts.TreeNode.call(this, params);
          initConflicts.Channel.call(this, params);
        }
      },
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
          this.$ready = new P({});
          
        },
        
        genDefaultSessionData: function() {
          return {};
        },
        useSessionData: function(session) {
          if (!O.contains(session.channelData, this.name)) session.channelData[this.name] = this.genDefaultSessionData();
          return session.channelData[this.name];
        },
        
        // TODO: `$giveCommand` uses "data" but `$heedCommand` uses "params" - inconsistent?
        $giveCommand: function(params /* session, channelerParams, channelParams, data */) { // Channel
          
          // "channelerParams" are the params which the Channeler is currently using.
          // "channelParams" are the specific params which this Channel should use to
          // give the command.
          
          return new P({ err: new Error('not implemented') });
          
        },
        $heedCommand: function(params /* session, channelerParams, command, params */) {  // Channel
          
          // Causes this specific channel to send a notification
          // Channel params are included here in case the channel gives a bouncing command
          
          // Note that this method receives "channelerParams", not "channelParams".
          // These "channelerParams" indicate the params the Channeler is currently using
          // for this request, and may be completely unrelated to this Channel. If this
          // method is going to issue `this.$giveCommand`, it may pass the "channelParams"
          // property of `channelerParams` ONLY after validating that the channelParams
          // retrieved this way are compatible with this Channel. In most cases, it will
          // be sufficient to check using the following:
          //
          // |  var channelerParams = U.param(params, 'channelerParams');
          // |  var compatibleChannelParams = channelerParams.channelName === this.name;
          
          var pass = this;
          return new P({ run: function() {
            
            var command = U.param(params, 'command');
            
            if (command === 'notifyMe') {
              
              var session = U.param(params, 'session');
              var commandParams = U.param(params, 'params', {});
              var channelerParams = U.param(params, 'channelerParams');
              
              // If the provided channelerParams aren't compatible, create our own.
              // We want to ensure that THIS Channel sends the notification.
              var selfChannelerParams = channelerParams.channelName === pass.name
                ? channelerParams
                : { channelName: pass.name };
              
              pass.channeler.$giveCommand({
                session: session,
                channelerParams: selfChannelerParams,
                data: {
                  address: U.param(commandParams, 'address', '~root'),
                  command: 'notify',
                  data: 'Your notification via channel: "' + pass.name + '"'
                }
              }).done();
              
            } else {
              
              throw new Error('Invalid command: "' + command + '"');
              
            }
            
          }});
          
        },
        
        finalizeCommand: function(session, channelParams) {
        },
        
        $start: function() { return new P({ err: new Error('not implemented') }); },
        stop: function() { throw new Error('not implemented'); }
      };}
    });
    sv.ChannelHttp = U.makeClass({ name: 'ChannelHttp', superclass: sv.Channel,
      methods: function(sc, c) { return {
        init: function(params /* name, channeler, host, port, numToBank */) {
          
          sc.init.call(this, params);
          
          // Defaults for host/port are based on physical host data
          var physData = sv.getPhysicalHostData();
          this.host = U.param(params, 'host', physData.host);
          this.port = U.param(params, 'port', physData.port);
          
          /// {SERVER=
          this.server = null;
          /// =SERVER}
          
          /// {CLIENT=
          this.numToBank = U.param(params, 'numToBank', 1);
          this.numBanked = 0;
          /// =CLIENT}
          
        },
        genDefaultSessionData: function() {
          return {
            pending: [],
            polls: []
          };
        },
        
        sendResponse: function(res, data) {
          
          var commandResponse = U.isInstance(data, sv.CommandResponse) ? data : new sv.CommandResponse({ data: data });
          commandResponse.endResponse(res);
          res['~finalized'] = true;
          
        },
        $giveCommand: function(params /* session, data, channelParams { res } */) { // ChannelHttp
          
          var data = U.param(params, 'data');
          
          /// {SERVER=
          
          // Reply to the command using either the Response instance found at
          // `params.channelParams.res`, or using the oldest queued longpoll.
          // If neither of these methods produces a Response instance, queue
          // the `params.data` value until a longpoll becomes available.
          
          // Note that promise fulfillment in this case means that the server
          // has decided to send the command, NOT that the command has been
          // received by the client.
          
          
          // Get the session data
          var session = U.param(params, 'session');
          var sessionData = this.useSessionData(session);
          var channelParams = U.param(params, 'channelParams', {});
          
          // Get the Response instance
          //var res = U.param(channelParams, 'res', null);
          //if (!res) res = sessionData.polls.shift();
          
          // Attempt one: use a provided Response object
          var res = U.param(channelParams, 'res', null);
          if (res) {
            this.sendResponse(res, data);
            return p.$null;
          }
          
          // Attempt two: use a queued Response object
          var res = sessionData.polls.shift();
          if (res) {
            this.sendResponse(res, data);
            return p.$null;
          }
          
          // Attempt three: bank the data to be sent when more polls become available
          sessionData.pending.push(data);
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
        $heedCommand: function(params /* session, command, params, channelerParams */) { // ChannelHttp
          
          /// {SERVER=
          var pass = this;
          return new P({ run: function() {
            
            var session = U.param(params, 'session');
            var command = U.param(params, 'command');
            var commandParams = U.param(params, 'params', {});
            
            if (command === 'syncNumBankedPolls') {
              
              return pass.channeler.$giveCommand({
                session: session,
                channelerParams: U.param(params, 'channelerParams', {}),
                data: {
                  address: U.param(commandParams, 'returnAddress', '~root'),
                  command: 'syncNumBankedPolls',
                  data: pass.useSessionData(session).polls.length
                }
              });
              
            } else if (command === 'bankPoll') {
              
              var channelerParams = U.param(params, 'channelerParams', {});
              if (channelerParams.channelName !== pass.name) throw new Error('Called "bankPoll" from another Channel');
              
              var res = U.param(channelerParams.channelParams, 'res'); // It shouldn't be possible for this to fail
              res['~finalized'] = true; // Don't allow this Response to be cleaned up
              
              // If a command is pending send it immediately using the poll
              // Otherwise, bank the poll for use with the next command
              var sessionData = pass.useSessionData(session);
              if (sessionData.pending.length) pass.sendResponse(res, sessionData.pending.shift());
              else                            sessionData.polls.push(res);
              
              return null;
              
            } else if (command === 'fizzleAllPolls') {
              
              var polls = pass.useSessionData(session).polls;
              while (polls.length) pass.sendResponse(polls.shift(), null);
              
              return pass.channeler.$giveCommand({
                session: session,
                channelerParams: U.param(params, 'channelerParams', {}),
                data: null
              });
              
            }
            
            return sc.$heedCommand.call(pass, params);
              
          }});
          /// =SERVER}
          
          /// {CLIENT=
          // No requests available
          return new P({ err: new Error('Invalid request') });
          /// =CLIENT}
          
        },
        
        /// {SERVER=
        finalizeCommand: function(session, channelParams) {
          
          // `res` is marked "~finalized" if it shouldn't be automatically cleaned up
          
          var res = U.param(channelParams, 'res');
          if (res['~finalized']) return; // `res` is unusable; it's either queued for polling or has already sent data
          
          // `res` isn't going to be used by any other source! If there's a pending response,
          // `res` is an ideal candidate to send it!
          var sessionData = this.useSessionData(session);
          this.sendResponse(res, sessionData.pending.shift() || null);
          
        },
        $captureRequest: function(req, urlData) { // Captures a Request as a `{ address, command, params }` value
          
          var queryUrl = urlData.url;
          var queryParams = urlData.params;
          
          var method = req.method.toLowerCase();
          if (method === 'get') {
            
            var $ret = new P({ value: queryParams });
            
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
          
          return $ret.then(function(queryParams) {
            
            var queryAddress = U.param(queryParams, 'address', []);
            if (U.isObj(queryAddress, String)) queryAddress = queryAddress.split('.');
            
            if (!queryAddress.length && !queryUrl.length && U.isEmptyObj(queryParams)) {
              
              // Supplying no URL, address, or params results in a request for "mainPage.html"
              var address = [];
              var command = 'getFile';
              var params = { path: [ 'mainPage.html' ] };
              
            } else if (queryUrl.length) {
              
              if (queryUrl.length === 1 && queryUrl[0][0] === '~') {
                
                // A single-component url which begins with "~" indicates command notation
                var cmp = decodeURIComponent(queryUrl[0].trim());
                var lbInd = cmp.indexOf('(');
                
                if (lbInd >= 0) {
                  
                  if (cmp[cmp.length - 1] !== ')') throw new Error('Command notation missing terminating ")"');
                  
                  var beforeParamsStr = cmp.substr(0, lbInd);
                  var paramsStr = cmp.substr(lbInd + 1, cmp.length - lbInd - 2);
                  var pcs = beforeParamsStr.split('.');
                  
                  var command = pcs.pop();
                  var address = pcs;
                  var params = U.stringToThing(paramsStr); // TODO: Unquoted JSON support would be nice
                  
                } else {
                  
                  var address = cmp.split('.');
                  var command = 'sync';
                  var params = {};
                  
                }
                
              } else if (S.contains(queryUrl[queryUrl.length - 1], '.')) {
                
                // Addressing a file in the URL results in a root-targeted "getFile" command
                var address = [];
                var command = 'getFile';
                var params = { path: queryUrl };
                
              } else {
                
                // Addressing a non-file in the URL results in a command (defaulting to "get") being issued to the child addressed by the URL
                if (queryAddress.length) throw new Error('Supplying a non-empty, non-file url along with an address is invalid');
                var address = queryUrl;
                var command = U.param(queryParams, 'command', 'sync');
                var params = U.param(queryParams, 'params', {});
                
              }
              
            } else {
              
              // A blank URL with an address provided issues a command to the addressed child
              var address = queryAddress;
              var command = U.param(queryParams, 'command');
              var params = U.param(queryParams, 'params', {});
              
            }
            
            return {
              address: address, // Array
              command: command, // String
              params: params // Object
            };
            
          });
          
        },
        serverFunc: function(req, res) {
          
          var channelerParams = {
            channelName: this.name,
            channelParams: { res: res }
          };
          
          // Prefer the "x-forwarded-for" header over `connection.remoteAddress`
          var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',')[0].replace(/[^0-9a-f.]/g, '');
          
          try {
            
            var urlData = U.parseUrl(req.url, 'http');
            if (O.contains(urlData.params, 'spoof')) {
              ip = urlData.params.spoof;
              delete urlData.params.spoof;
            }
            var $commandData = this.$captureRequest(req, urlData);
            
          } catch(err) {
            
            var $commandData = new P(err);
            
          }
          
          var session = this.channeler.getSession(ip);
          
          return this.channeler.$passCommand({
            
            session: session,
            channelerParams: channelerParams,
            $commandData: $commandData
            
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
          
          var commandParams = U.param(params, 'params', {});
          var ref = U.param(params, 'ref', null);
          
          // TODODBG: Localized error and spoofing should be debug features
          var dbgErr = new Error('DBGXHR: ' + address.join('.') + '.' + command + '(' + U.debugObj(commandParams) + ')');
          var trgUrl = this.channeler.ipSpoof ? '?spoof=' + this.channeler.ipSpoof : '';
          
          if (address.join('.') === '~root' && command === 'mod') throw new Error('Bad :(');
          
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
            
            xhr.open('POST', trgUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(U.thingToString({ address: address, command: command, params: commandParams }));
            
          }}).then(function(command) {
            
            // TODO: What if `command` is the number zero (`0`)? It should probably be required to be an `Object`.
            return command ? pass.channeler.$passCommand(command) : null;
            
          });
          
        },
        doBankPolls: function() {
          
          var pass = this;
          while (this.numBanked < this.numToBank) {
            
            this.$doQuery({ address: [ this.name ], command: 'bankPoll' })
              .then(function() {
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
          return this.$ready.then(function() {
            console.log(this.name + ' listening at ' + this.host + ':' + this.port);
          }.bind(this));
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
            .fail(console.error.bind(console));
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
    });
    sv.ChannelSocket = U.makeClass({ name: 'ChannelSocket', superclass: sv.Channel,
      methods: function(sc, c) { return {
        init: function(params /* name, channeler, host, port */) {
          sc.init.call(this, params);
          
          var physData = sv.getPhysicalHostData();
          this.host = U.param(params, 'host', physData.host);
          this.port = U.param(params, 'port', physData.port);
          this.$ready = new P({});
          
          /// {SERVER=
          this.socket = null;
          this.connections = {}; // Could save the connections using `this.useSessionData` instead of initializing a new list...
          /// =SERVER}
        },
        
        $giveCommand: function(params /* session, channelerParams, channelParams, data */) { // ChannelSocket
          
          var channelParams = U.param(params, 'channelParams', {});
          var data = U.param(params, 'data');
          
          /// {SERVER=
          var session = U.param(params, 'session');
          var connection = this.connections[session.ip];
          return connection.$giveCommand({ data: U.thingToString(data) });
          /// =SERVER}
          
          /// {CLIENT=
          this.socket.send(U.thingToString(data));
          return p.$null;
          /// =CLIENT}
          
        },
        $passCommand: function(session, $commandData) {
          
          // Commands discovered by ChannelSocket functionality will inform the Channeler through this method
          
          // commandData.session = ip ? this.channeler.getSession(ip) : null;
          // commandData.channelerParams = channelerParams;
          
          return this.channeler.$passCommand({
            session: session,
            channelerParams: {}, // For now ChannelSocket doesn't use any channelParams
            $commandData: $commandData
          });
          
        },
        
        /// {SERVER=
        socketConnectAttempt: function(socket) {
          
          var ip = socket.remoteAddress;
          if (O.contains(this.connections, ip)) { console.log('Refused connection overwrite attempt: "' + ip + '"'); return; }
          
          var connection = new sv.SocketConnection({ ip: ip, channel: this, socket: socket });
          
          var pass = this;
          socket.once('handshakeComplete', function() {
            pass.connections[connection.ip] = connection;
          });
          
        },
        /// =SERVER}
        
        $start: function() {
          
          /// {SERVER=
          // TODO: `require('tls')` for secure connections
          var pass = this;
          this.socket = require('net').createServer(function(socket) {
            return pass.socketConnectAttempt(socket);
          });
          this.socket.listen(this.port, this.host, 511, this.$ready.resolve.bind(this.$ready));
          /// =SERVER}
          
          /// {CLIENT=
          try {
            var spoof = this.channeler.ipSpoof ? '/?spoof=' + this.channeler.ipSpoof : '';
            var socket = new WebSocket('ws://' + this.host + ':' + this.port + spoof);
          } catch(err) {
            err.message = 'Websockets unsupported: ' + err.message;
            return new P({ err: err });
          }
          
          //var channeler = this.channeler;
          var pass = this;
          socket.onopen = this.$ready.resolve.bind(this.$ready);
          socket.onmessage = function(evt) {
            pass.$passCommand(
              null,
              new P({ run: U.stringToThing.bind(null, evt.data) })
            ).done();
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
    });
    
    /// {SERVER=
    sv.Session = U.makeClass({ name: 'Session',
      description: 'Representation of a Session',
      methods: function(sc) { return {
        init: function(params /* ip, channeler */) {
          this.ip = U.param(params, 'ip');
          this.channeler = U.param(params, 'channeler');
          this.id = U.id(sv.Session.NEXT_ID++);
          this.channelData = {};
        },
      }},
      statik: { NEXT_ID: 0 }
    });
    sv.CommandResponse = U.makeClass({ name: 'CommandResponse',
      description: 'Handles the sending of commands to the other side via HTTP',
      methods: function(sc) { return {
        init: function(params /* httpCode, contentType, encoding, data */) {
          
          this.data = U.param(params, 'data');
          var isError = U.isInstance(this.data, Error);
          
          if (isError) this.data = { err: this.data.message };
          
          this.httpCode = U.param(params, 'code', isError ? 400 : 200);
          this.contentType = U.param(params, 'contentType', 'text/json');
          this.encoding = U.param(params, 'encoding', 'binary'); // 'binary' | 'utf8'
          
        },
        endResponse: function(res) {
          
          try {
          var data = this.contentType === 'text/json' ? U.thingToString(this.data) : this.data;
        } catch(err) { console.log(this.data); throw err; }
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
    });
    sv.SocketConnection = U.makeClass({ name: 'SocketConnection',
      methods: function(sc, c) { return {
        
        init: function(params /* ip, channel, socket */) {
          
          this.ip = U.param(params, 'ip');
          this.socket = U.param(params, 'socket');
          this.channel = U.param(params, 'channel');
          this.status = 'starting'; // starting | started | ending | ended
          this.buffer = new Buffer(0);
          this.curOp = null;
          this.curFrames = [];
          
          var pass = this;
          var socket = this.socket;
          
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
          
          socket.on('close', function() {
            
            pass.status = 'ended';
            delete pass.channel.connections[pass.ip];
            console.log('Terminated socket connection: ' + pass.ip);
            
          });
          
          socket.on('error', function(err) {
            
            console.log('Websocket error:');
            console.error(err);
            
          });
          
        },
        
        $giveCommand: function(params /* data, socketParams */) { // SocketConnection
          
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
          
          // Parses `packet` to make sure it's a valid handshake
          
          try {
            
            var lines = packet.split('\r\n');
            if (lines.length <= 5) throw new Error('Invalid packet');
            
            var parseHeader = lines[0].match(/^GET (.+) HTTP\/\d\.\d$/i);
            if (!parseHeader) throw new Error('Invalid packet request');
            
            var urlData = U.parseUrl(parseHeader[1], 'ws');
            
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
            
            // TODODBG: spoofing
            if (O.contains(urlData.params, 'spoof')) this.ip = urlData.params.spoof;
            
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
            
            this.socket.emit('handshakeComplete');
            
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
          
          // Socket is already connected; websocket protocol implemented here.
          // Results in calls to `this.channel.$passCommand`.
          
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
                
                // throw Error('not implemented op: 8');
                this.status = 'ending';
                this.socket.end();
                break;
                
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
                  
                  this.channel.$passCommand(
                    this.channel.channeler.getSession(this.ip),
                    new P({ run: U.stringToThing.bind(null, fullStr) })
                  ).done();
                  
                }
                
              } else {
                
                throw new Error('Unexpected op: ' + op);
                
              }
              
            }
            
          } catch(err) {
            
            console.log('Websocket error on received data:');
            console.error(err);
            
            this.buffer = new Buffer(0);
            this.curOp = null;
            this.curFrames = null;
            
          } 
          
        }
        
      };},
      statik: {
        requiredHeaders: [ 'sec-websocket-key', 'sec-websocket-version', 'host', 'upgrade', 'connection' ],
        genHash: require('crypto').createHash.bind(null, 'sha1'),
        int32: Math.pow(2, 32),
        invInt32: 1 / Math.pow(2, 32)
      }
    });
    /// =SERVER}
    
  }
}).build();
