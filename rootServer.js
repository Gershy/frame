/*
DB Reference:
- https://github.com/FreeCodeCamp/FreeCodeCamp/wiki/Using-MongoDB-And-Deploying-To-Heroku
- mongodb://localhost:27017/frame

TODO: This is one UGLY goddang file
TODO: The DB connection at this end of this file needs its own paradigm
TODO: Responses for non-existing files are no good, try removing favicon and loading
TODO: Dependency loading should be done via promises
TODO: Websockets eventually?
*/
require('./common.js');

if (!U.isServer()) throw new Error('only for server-side use');

var http = require('http');
var path = require('path');
var fileSys = require('fs');
var config = require('./config.js');

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
						this.encoding = U.param(params, 'encoding', 'text/json');
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
				superclassName: 'QueryHandler',
				methods: function(sc) { return {
					init: function(params /* ip */) {
						this.ip = U.param(params, 'ip');
						this.id = U.id(PACK.server.Session.NEXT_ID++);
						this.appName = null;
						this.userData = {};
					},
					getNamedChild: function(name) {
						if (name === 'app') return U.deepGet({ root: PACK, name: [ this.appName, 'queryHandler' ] });
						
						return null;
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
						
						params.session = this;
						return sc.$respondToQuery.call(this, params)
							.then(function(response) {
								/*
								The sessions children all reply with objects. The session is
								responsible for stringifying those objects, and clarifying that
								they are in json format.
								*/
								
								return U.isInstance(response, PACK.server.ResponseData)
									? response
									: new PACK.server.ResponseData({ data: response });
							});
					},
					$handleQuery: function(params /* session, url */) {
						/*
						The session itself handles ordinary file requests. Files are
						referenced using params.url, an array of url components.
						*/
						var url = U.param(params, 'url');
						var command = U.param(params, 'command', null);
						
						if (command) {
							
							if (command === 'getIp') {
								
								var promise = PACK.p.P({ val: { ip: this.ip } });
								
							} else {
								
								var promise = new PACK.p.P({ val: {
									code: 1,
									msg: 'invalid session command',
									command: command
								}});
								
							}
								
							return promise.then(this.processChildResponse.bind(this));
							
						}
						
						// Zero-length urls aren't allowed
						if (url.length === 0) throw new Error('Zero-length url');
						
						// A request that specifies a file should just serve that file
						if (url[url.length - 1].contains('.'))
							return this.getFileContents(url.join('/'))
								.fail(function(err) {
									return new PACK.server.ResponseData({
										code: 404,
										data: 'File "' + url.join('/') + '" not found',
										encoding: 'text/plain',
										binary: false
									});
								});
						
						// A mode-less request to the session just means to serve the html
						var appName = url[0];
						
						// Check if it's the server's first request for this app
						if (!(appName in PACK)) {
							try {
								require('./apps/' + appName + '/' + appName + '.js');
							} catch (e) {
								console.log('Couldn\'t load essential file "/apps/' + appName + '/' + appName + '.js"');
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
							
						}
						
						this.appName = appName;
						PACK.server.Session.SESSIONS[this.ip] = this;
						
						return this.getFileContents('mainPage.html')
							.then(function(html) {
								html.data = html.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
								html.data = html.data.replace(/{{assetVersion}}/g, 'v' + PACK.server.ASSET_VERSION);
								html.data = html.data.replace('{{title}}', appName);
								
								if ('resources' in PACK[appName]) {
									
									var htmlElems = [];
									
									var r = PACK[appName].resources;
									
									var ver = '?v' + PACK.server.ASSET_VERSION;
									
									if ('css' in r) r.css.forEach(function(css) { htmlElems.push('<link rel="stylesheet" type="text/css" href="' + css + ver + '"/>'); });
									if ('js' in r) r.js.forEach(function(js) { htmlElems.push('<script type="text/javascript" src="' + js + ver + '"></script>'); });
									
									html.data = html.data.replace(/(\s*){{resources}}/, '\n' + htmlElems.map(function(html) { return '\t\t' + html; }).join('\n'));
									
								} else {
									
									html.data = html.data.replace(/(\s*){{resources}}/, '');
									
								}
								
								return html;
							})
							.fail(function(err) {
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
					GET_SESSION: function(ip) {
						return (ip in PACK.server.Session.SESSIONS)
							? PACK.server.Session.SESSIONS[ip]
							: new PACK.server.Session({ ip: ip });
					}
				},
			}),
			
			$getSession: function(req) {
				// Prefer the "x-forwarded-for" header over `connection.remoteAddress`
				var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace(/^[0-9.]/g, '');
				return PACK.p.$(PACK.server.Session.GET_SESSION(ip));
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
						if (~eq)	queryParams[str.substr(0, eq)] = decodeURIComponent(str.substr(eq + 1));
						else 			queryParams[str] = null;
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
				
				// Ensure that the "url" property is represented as an array
				queryUrl = queryUrl ? queryUrl.split('/') : [];
				
				// Ensure that empty urls refer to the default app
				if (queryUrl.length === 0) queryUrl.push(config.defaultApp);
				
				// Ensure that the "url" property is only provided automatically
				if ('url' in queryParams) throw new Error('Provided reserved property: "url"');
				queryParams.url = queryUrl;
				
				// Ensure there is an "address" property
				if (!('address' in queryParams)) queryParams.address = [];
				
				// Ensure the "address" property is an array
				if (U.isObj(queryParams.address, String))
					queryParams.address = queryParams.address ? queryParams.address.split('.') : [];
				
				return PACK.p.$(queryParams);
			},
			
			serverFunc: function(req, res) {
				new PACK.p.P({ args: [ PACK.server.$getSession(req), PACK.server.$getQuery(req) ] })
					.them(function(session, query) {	// Get a response based on session and query
						return session.$respondToQuery(query);
					})
					.then(function(response) { 				// Insert error message in case of 404
						return response || new PACK.server.ResponseData({
							code: 404,
							binary: false,
							encoding: 'text/plain',
							data: 'not found'
						});
					})
					.fail(function(err) { 						// Insert error message in case of 400
						console.error(err.stack);
						return new PACK.server.ResponseData({
							code: 400,
							binary: false,
							encoding: 'text/plain',
							data: err.message
						});
					})
					.then(function(response) {				// End the response
						response.endResponse(res);
					})
					.done();
			}
		};
	},
	runAfter: function() {
		
		var server = http.createServer(PACK.server.serverFunc);
		
		var port = process.env.PORT || 8000;
		server.listen(port);
		console.log('Listening on port: ' + port);
		
		/*
		setInterval(function() {
			var mem = process.memoryUsage();
			var mb = mem.heapUsed / (1024 * 1024);
			var perc = (mem.heapUsed / mem.heapTotal) * 100;
			console.log('MEM', mb.toFixed(2).toString() + 'mb (' + perc.toFixed(1).toString() + '%)');
		}, 90 * 1000);
		*/
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
