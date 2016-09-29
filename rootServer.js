/*
TODO: Need a way of separating server-code and client-code within app scripts
so that server-code never arrives at the client-side.

DB Reference:
- https://github.com/FreeCodeCamp/FreeCodeCamp/wiki/Using-MongoDB-And-Deploying-To-Heroku
- mongodb://localhost:27017/frame
*/
require('./common.js');

if (!U.isServer()) throw new Error('rootServer.js should only be used server-side');

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
						if (name === 'app') return this.queryHandler;
						
						return null;
					},
					getFileContents: function(filepath, onComplete) {
						// Find the static file, serve it
						// Not a static method (TODO:) because different sessions will
						// restrict which files are servable in different ways.
						
						var ext = path.extname(filepath);
						if (!(ext in config.legalExtensions)) onComplete(new Error('unknown extension: "' + ext + '"'), null);
						ext = config.legalExtensions[ext];
						
						var binary = ext[0] === '!';
						if (binary) ext = ext.substr(1);
						
						fileSys.readFile(filepath, binary ? 'binary' : 'utf8', function(err, content) {
							onComplete(err, {
								data: content,
								encoding: ext
							});
						});
						
						/*
						onComplete(null, {
							data: fileSys.readFileSync(filepath, binary ? 'binary' : 'utf8'),
							encoding: ext
						});
						*/
					},
					respondToQuery: function(params /* address */, onComplete) {
						// Ensure no "session" param was already included
						if ('session' in params) throw new Error('illegal "session" param');
						sc.respondToQuery.call(this, params.clone({ session: this }), onComplete);
					},
					handleQuery: function(params /* session, url */, onComplete) {
						/*
						The session itself handles ordinary file requests. Files are
						referenced using params.url, an array of url components.
						*/
						
						var url = U.param(params, 'url');
						var command = U.param(params, 'command', null);
						
						if (command) {
							
							var jsonResponse = null;
							
							if (command === 'getIp') jsonResponse = { ip: this.ip };
							
							if (jsonResponse === null) {
								jsonResponse = {
									code: 1,
									msg: 'invalid session command',
									command: command
								}
							}
							
							onComplete(this.processChildResponse(jsonResponse));
							return;
							
						}
						
						// Zero-length urls aren't allowed
						// TODO: Consider adding server-queries here? e.g. "ramAvailable"
						if (url.length === 0) { onComplete(new Error('zero-length url')); return; }
						
						// A request that specifies a file should just serve that file
						if (url[url.length - 1].contains('.')) {
							this.getFileContents(url.join('/'), function(err, data) {
								if (U.err(err)) onComplete({ data: '"' + url + '" not found', encoding: 'text/plain' });
								else 			onComplete(data);
							});
							return;
						}
						
						// A mode-less request to the session just means to serve the html
						var appName = url[0];
						
						// Check if it's the server's first request for this app
						if (!(appName in PACK)) {
							try { require('./apps/' + appName + '/' + appName + '.js'); } catch (e) { onComplete(e); return; }
							try { require('./apps/' + appName + '/$' + appName + '.js'); } catch(e) {  }
							if (!('queryHandler' in PACK[appName])) {
								onComplete(new Error('app "' + appName + '" is missing queryHandler'));
								return;
							}
						}
						
						this.queryHandler = PACK[appName].queryHandler;
						if (!(this.queryHandler)) throw new Error('Bad queryHandler in app "' + appName + '"');
						this.appName = appName;
						
						var html = this.getFileContents('mainPage.html', function(err, html) {
							if (U.err(err)) {
								onComplete({
									data: [
										'<!DOCTYPE html>',
										'<html>',
											'<head></head>',
											'<body>Couldn\'t serve main page. :(</body>',
										'</html>'
									].join(''),
									encoding: 'text/html'
								});
							}
							
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
							
							onComplete(html);
							
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
				
				session.respondToQuery(params, function(response) {
					if (response instanceof Error) throw response;
					
					// TODO: Sessions need to expire!!
					if (!existingSession && session.queryHandler !== null) sessionsIndex[session.ip] = session;
					
					res.writeHead(200, {
						'Content-Type': response.encoding,
						'Content-Length': response.data.length
					});
					res.write(response.data, 'binary');
					res.end();
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
		}, 30 * 1000);
	},
});

if ('FRAME_DB_URI' in process.env) {
	
	var db = require('mongodb');
	var client = db.MongoClient;
	var url = process.env.FRAME_DB_URI;
	
	console.log('Starting DB connection: ' + url);
	client.connect(process.env.FRAME_DB_URI, function(err, db) {
		
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
	
	// No DB
	global.DB = null;
	package.build();
	
}
