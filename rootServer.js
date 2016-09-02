require('./common.js');

var http = require('http');
var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');
//var mongoDb = require('mongodb').MongoClient;

var DIRNAME = __dirname.replace(/\\/g, '/');

var package = new PACK.pack.Package({ name: 'server',
	dependencies: [ 'queries', ],
	buildFunc: function() {
		return {
			ASSET_VERSION: U.charId(parseInt(Math.random() * 1000), 3),
			Session: PACK.uth.makeClass({ name: 'Session',
				superclassName: 'QueryHandler',
				propertyNames: [ 'ip' ],
				methods: function(sc) { return {
					init: function(params /* ip */) {
						this.ip = U.param(params, 'ip');
						this.id = U.id(PACK.server.Session.NEXT_ID++);
						
						this.appName = null;
						this.queryHandler = null;
						
						this.userData = {};
					},
					getNamedChild: function(name) {
						console.log('ALL SESSIONS');
						for (var k in PACK.server.Session.SESSIONS) {
							var s = PACK.server.Session.SESSIONS[k];
							console.log('IP:', s.ip, 'ID:', s.id);
						}
						console.log('MY SESS: IP:', this.ip, 'ID:', this.id);
						console.log('ASK FOR "' + name + '"');
						console.log('HANDLER:' + this.queryHandler);
						console.log('');
						
						if (name === 'app') return this.queryHandler;
						
						return null;
					},
					getFileContents: function(filepath) {
						// Find the static file, serve it
						// Not a static method (TODO:) because different sessions will
						// restrict which files are servable in different ways.
						
						var ext = path.extname(filepath);
						if (!(ext in config.legalExtensions)) throw 'unknown extension: "' + ext + '"';
						ext = config.legalExtensions[ext];
						
						var binary = ext[0] === '!';
						if (binary) ext = ext.substr(1);
						
						return {
							data: fileSys.readFileSync(filepath, binary ? 'binary' : 'utf8'),
							encoding: ext
						};
					},
					respondToQuery: function(params /* address */) {
						// Overwrite this method to ensure no "session" param is included
						if ('session' in params) throw new Error('illegal "session" param');
						return sc.respondToQuery.call(this, params.clone({ session: this }));
					},
					handleQuery: function(params /* session, url */) {
						/*
						The session itself handles ordinary file requests. Files are
						referenced using params.url, an array of url components.
						*/
						
						var url = U.param(params, 'url');
						var command = U.param(params, 'command', null);
						
						if (command) {
							
							var jsonResponse = null;
							
							if (command === 'getIp') {
								jsonResponse = { ip: this.ip }
							}
							
							if (jsonResponse === null) {
								jsonResponse = {
									code: 1,
									msg: 'invalid session command',
									command: command
								}
							}
							
							// processChildCommand already takes care of formatting
							// and conversion to JSON.
							return this.processChildResponse(jsonResponse);
							
						}
						
						// Zero-length urls aren't allowed
						// TODO: Consider adding server-queries here? e.g. "ramAvailable"
						if (url.length === 0) throw 'zero-length url';
						
						// A request that specifies a file should just serve that file
						if (url[url.length - 1].contains('.')) {
							try {
								return this.getFileContents(url.join('/'));
							} catch(e) {
								return { data: '"' + url + '" not found', encoding: 'text/plain' };
							}
						}
						
						// A mode-less request to the session just means to serve the html
						var appName = url[0];
						var html = this.getFileContents('mainPage.html');
						html.data = html.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
						html.data = html.data.replace(/{{assetVersion}}/g, 'v' + PACK.server.ASSET_VERSION);
						
						// Check if it's the server's first request for this app
						if (!(appName in PACK)) {
							require('./apps/' + appName + '/' + appName + '.js');
							if (!('queryHandler' in PACK[appName])) throw new Error('app "' + appName + '" is missing queryHandler');
						}
						
						this.appName = appName;
						this.queryHandler = PACK[appName].queryHandler;
						if (!(this.queryHandler)) throw new Error('Bad queryHandler in app "' + appName + '"');
						
						if ('resources' in PACK[appName]) {
							
							var htmlElems = [];
							
							var r = PACK[appName].resources;
							
							var ver = '?v' + PACK.server.ASSET_VERSION;
							
							if ('css' in r) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
							if ('js' in r)  r.js.forEach( function(js)  { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
							
							html.data = html.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '\t\t' + html; }).join('\n'));
							
						} else {
							
							html.data = html.data.replace(/(\s*){{resources}}/, '');
							
						}
						
						return html;
					},
					processChildResponse: function(response) {
						/*
						The sessions children all reply with objects. The session is
						responsible for stringifying those objects, and clarifying that
						they are in json format.
						*/
						if (!('code' in response)) response.code = 0;
						
						if (response.constructor !== String) response = JSON.stringify(response);
						return { data: response, encoding: 'text/json' };
					},
				}},
				statik: {
					NEXT_ID: 0,
					SESSIONS: {},
				},
			}),
			serverFunc: function(req, res) {
				var url = req.url; // req.url, req.headers.referer, req.headers.host?
				
				//Initialize defaults for all url components
				var queryUrl = url;
				var queryParams = {};
				
				//Check if the url includes parameters (indicated by the "?" symbol)
				var q = queryUrl.indexOf('?');
				if (~q) {
					queryUrl = url.substr(0, q); //The url is only the piece before the "?" symbol
					var queryArr = url.substr(q + 1).split('&'); //Array of url parameters
					for (var i = 0; i < queryArr.length; i++) {
						var str = queryArr[i];
						var eq = str.indexOf('=');
						if (~eq)	queryParams[str.substr(0, eq)] = decodeURIComponent(str.substr(eq + 1));
						else 		queryParams[str] = null;
					}
					
					if ('_json' in queryParams) {
						// The "_json" property overwrites any properties in the query of the same name
						var json = JSON.parse(queryParams._json);
						delete queryParams._json;
						queryParams.update(json);
					}
				}
				
				if ('url' in queryParams) throw 'bad query parameter: "url"';
				
				queryUrl = queryUrl.split('/').filter(function(e) { return e.length > 0; });
				if (queryUrl.length === 0) queryUrl.push(config.defaultApp);
				
				var ip = req.headers['x-forwarded-for'];
				if (!ip) ip = req.connection.remoteAddress;
				ip = ip.replace(/^[0-9.]/g, '');
				
				var sessionsIndex = PACK.server.Session.SESSIONS;
				
				for (var k in sessionsIndex) {
					var s = sessionsIndex[k];
					if (!('id' in s)) {
						console.log('DAFUQ IS THIS', s, s.constructor.name, s.constructor.title);
					} else {
						console.log('SESSION: ' + k + ': ' + s.id + '(' + (k === s.ip ? 'fine' : 'BAD') + '), "' + s.appName + '"');
					}
				}
				
				var existingSession = ip in sessionsIndex;
				var session = existingSession ? sessionsIndex[ip] : new PACK.server.Session({ ip: ip });
				
				var params = queryParams.update({ url: queryUrl });
				if (!('address' in params)) params.address = [];
					
				if (params.address.constructor === String) {
					params.address = params.address.length > 0
						? params.address.split('.')
						: [];
				}
				
				if ('originalAddress' in params) throw 'used reserved "originalAddress" param';
				params.originalAddress = U.arr(params.address);
				
				var responseContent = session.respondToQuery(params);
				
				if (!existingSession && session.queryHandler !== null) {
					console.log('ACCEPT ' + session.ip + ': ' + session.queryHandler.simp());
					sessionsIndex[session.ip] = session;
				}
				
				res.writeHead(200, {
					'Content-Type': responseContent.encoding,
					'Content-Length': responseContent.data.length
				});
				res.write(responseContent.data, 'binary');
				res.end();
				
			}
		};
	},
	runAfter: function() {
		var server = http.createServer(PACK.server.serverFunc);
		
		var port = process.env.PORT || 5000;
		server.listen(port);
		console.log('Listening on port: ' + port);
		
		setInterval(function() {
			var mem = process.memoryUsage();
			var mb = mem.heapUsed / (1024 * 1024);
			var perc = (mem.heapUsed / mem.heapTotal) * 100;
			console.log('MEM', mb.toFixed(2).toString() + 'mb (' + perc.toFixed(1).toString() + '%)');
		}, 30 * 1000);
	},
});
package.build();
