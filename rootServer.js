/*
DB Reference:
- https://github.com/FreeCodeCamp/FreeCodeCamp/wiki/Using-MongoDB-And-Deploying-To-Heroku
- mongodb://localhost:27017/frame

TODO: This is one UGLY goddang file
TODO: The DB connection at this end of this file needs its own paradigm
TODO: Responses for non-existing files are no good, try removing favicon and loading
*/
require('./common.js');

if (!U.isServer()) throw new Error('only for server-side use');

var http = require('http');
var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');
//var mongoDb = require('mongodb').MongoClient;

var readFile = fileSys.readFile.bind(fileSys);

var package = new PACK.pack.Package({ name: 'server',
  dependencies: [ 'queries', 'p' ],
	buildFunc: function() {
		return {
			ASSET_VERSION: U.charId(parseInt(Math.random() * 1000), 3),
			Session: U.makeClass({ name: 'Session',
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
						if (name === 'app') return this.queryHandler;
						
						return null;
					},
					getFileContents: function(filepath) {
						// Find the static file, serve it
						// Not a static method (TODO:) because different sessions will
						// restrict which files are servable in different ways.
						
						var ext = path.extname(filepath);
						if (!(ext in config.legalExtensions)) throw new Error('unknown extension: "' + ext + '"');
						ext = config.legalExtensions[ext];
						
						var binary = ext[0] === '!';
						if (binary) ext = ext.substr(1);
						
						return new PACK.p.P({ cb: readFile, cbParams: [ filepath, binary ? 'binary' : 'utf8' ] })
							.then(function(err, data) {
								if (err) throw err;
								
								return {
									data: data,
									encoding: ext,
									binary: binary
								};
							})
							.fail(function(err) {
								return {
									data: '"' + filepath + '" not found',
									encoding: 'text/plain',
									binary: false
								};
							});
					},
					respondToQuery: function(params /* address */) {
						// Ensure no "session" param was already included
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
							
							var promise = null;
							
							if (command === 'getIp') {
								
								var promise = PACK.p.P({ val: { ip: this.ip } });
								
							} else if (command === 'not yet implemented?') {
								
								var promise = PACK.p.P({ val: { msg: 'not implemented lol' } });
								
							} else {
								
								var promise = new PACK.p.P({ val:{
									code: 1,
									msg: 'invalid session command',
									command: command
								}});
								
							}
								
							return promise.then(this.processChildResponse.bind(this));
							
						}
						
						// Zero-length urls aren't allowed
						// TODO: Consider adding server-queries here? e.g. "ramAvailable"
						if (url.length === 0) throw new Error('Zero-length url');
						
						// A request that specifies a file should just serve that file
						if (url[url.length - 1].contains('.')) return this.getFileContents(url.join('/'));
						
						// A mode-less request to the session just means to serve the html
						var appName = url[0];
						
						// Check if it's the server's first request for this app
						if (!(appName in PACK)) {
							try {
								require('./apps/' + appName + '/' + appName + '.js');
							} catch (e) {
								console.log('./apps/' + appName + '/' + appName + '.js');
								console.log('Couldn\'t load essential file');
								throw e;
							}
							
							try {
								require('./apps/' + appName + '/$' + appName + '.js');
							} catch(e) {
								if (e.message.substr(0, 18) !== 'Cannot find module') {
									console.error(e.stack);
									console.log('No server file for "' + appName + '"');
								}
							}
							
							if (!('queryHandler' in PACK[appName])) throw new Error('app "' + appName + '" is missing queryHandler');
						}
						
						this.queryHandler = PACK[appName].queryHandler;
						if (!(this.queryHandler)) throw new Error('Bad queryHandler in app "' + appName + '"');
						this.appName = appName;
						PACK.server.Session.SESSIONS[this.ip] = this;
						
						return this.getFileContents('mainPage.html')
							.then(function(html) {
								html.data = html.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
								html.data = html.data.replace(/{{assetVersion}}/g, 'v' + PACK.server.ASSET_VERSION);
								
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
							})
							.fail(function(err) {
								return {
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
								}
							});
						
					},
					processChildResponse: function(response) {
						/*
						The sessions children all reply with objects. The session is
						responsible for stringifying those objects, and clarifying that
						they are in json format.
						*/
						if (!('code' in response)) response.code = 0;
						
						if (response.constructor !== String) response = JSON.stringify(response);
						return {
							data: response,
							encoding: 'text/json',
							binary: false
						};
					},
				}},
				statik: {
					NEXT_ID: 0,
					SESSIONS: {},
					GET_SESSION: function(ip) {
						return (ip in PACK.server.Session.SESSIONS)
							? PACK.server.Session.SESSIONS[ip]
							: new PACK.server.Session({ ip: ip });
					}
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
				
				if ('url' in queryParams) throw new Error('bad query parameter: "url"');
				
				queryUrl = queryUrl.split('/').filter(function(e) { return e.length > 0; });
				if (queryUrl.length === 0) queryUrl.push(config.defaultApp);
				
				var ip = req.headers['x-forwarded-for'];
				if (!ip) ip = req.connection.remoteAddress;
				ip = ip.replace(/^[0-9.]/g, '');
				
				var session = PACK.server.Session.GET_SESSION(ip);
				
				var params = queryParams.update({ url: queryUrl });
				if (!('address' in params)) params.address = [];
					
				if (params.address.constructor === String)
					params.address = params.address.length > 0 ? params.address.split('.') : [];
				
				if ('originalAddress' in params) throw new Error('used reserved "originalAddress" param');
				params.originalAddress = U.toArray(params.address);
				
				session.respondToQuery(params).then(function(response) {
					
					// TODO: Sessions need to expire!!
					
					if (!response) response = {
						code: 404,
						binary: false,
						encoding: 'text/plain',
						data: 'not found'
					};
					
					var transferEncoding = response.binary ? 'binary' : 'utf8';
					res.writeHead(response.code ? response.code : 200, {
						'Content-Type': response.encoding,
						'Content-Length': Buffer.byteLength(response.data, transferEncoding)
					});
					
					res.end(response.data, transferEncoding);
					
				}).fail(function(err) {
					
					console.log('Failed response');
					console.error(err.stack);
					
					return {
						code: 400,
						msg: err.message
					};
					
				});
				
			}
		};
	},
	runAfter: function() {
		var server = http.createServer(PACK.server.serverFunc);
		
		var port = process.env.PORT || 8000;
		server.listen(port);
		console.log('Listening on port: ' + port);
		
		setInterval(function() {
			var mem = process.memoryUsage();
			var mb = mem.heapUsed / (1024 * 1024);
			var perc = (mem.heapUsed / mem.heapTotal) * 100;
			console.log('MEM', mb.toFixed(2).toString() + 'mb (' + perc.toFixed(1).toString() + '%)');
		}, 90 * 1000);
	},
});

var dbUri = U.param(process.env, 'FRAME_DB_URI', 'mongodb://localhost:27017/frame');

var gimmeDb = true;
var db = null;

try { db = require('mongodb'); } catch(err) {}

if (db && gimmeDb) {
	
	var client = db.MongoClient;
	var url = process.env.FRAME_DB_URI;

	console.log('Starting DB connection: ' + dbUri);
	client.connect(dbUri, function(err, db) {
		
		if (err) {
			console.log('Couldn\'t connect to DB:', err);
			global.DB = null;
		} else {
			console.log('Connected to DB');
			global.DB = db;
		}
		package.build();
		
	});
	
} else {
	
	global.DB = null;
	package.build();
	
}
