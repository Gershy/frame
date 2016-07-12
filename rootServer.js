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
				methods: function(superclass) { return {
					init: function(params /* ip */) {
						this.ip = U.param(params, 'ip');
						this.id = U.id(this.ip);
						
						this.appName = null;
						this.queryHandler = null;
						
						this.userData = {};
					},
					getNamedChild: function(name) {
						if (name === 'app') return this.queryHandler;
					},
					getFileContents: function(filepath) {
						//Find the static file, serve it
						//var filename = queryUrl.join('/') + '/' + (queryFile !== null ? queryFile : 'index.html');
						//var pathName = DIRNAME + '/' + filename;
						
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
					respondToRequest: function(params /* address */) {
						if ('session' in params) throw 'illegal "session" param';
						superclass.respondToRequest.call(this, params.clone({ session: this }));
					},
					handleQuery: function(params /*  */) {
						/*
						The session itself handles ordinary file requests. Files are
						referenced using params.url, an array of url components.
						*/
						
						var url = U.param(params, 'url');
						
						// Zero-length urls aren't allowed
						// TODO: Consider adding server-queries here? e.g. "ramAvailable"
						if (url.length === 0) throw 'zero-length url';
						
						// A request the specifies a file should just serve that file
						if (url[url.length - 1].contains('.')) {
							try {
								return this.getFileContents(url.join('/'));
							} catch(e) {
								return { data: '"' + url + '" not found', encoding: 'text/plain' };
							}
						}
						
						// A mode-less request to the session just means to serve the html
						var appName = url[0];
						var mainScript = this.getFileContents('mainPage.html');
						mainScript.data = mainScript.data.replace('{{appScriptUrl}}', 'apps/' + appName + '/' + appName + '.js');
						mainScript.data = mainScript.data.replace(/{{assetVersion}}/g, 'v' + PACK.server.ASSET_VERSION);
						
						if (!(appName in PACK)) {
							require('./apps/' + appName + '/' + appName + '.js');
							if (!('queryHandler' in PACK[appName])) throw 'app "' + appName + '" is missing queryHandler';
							
							this.appName = appName;
							this.queryHandler = PACK[appName].queryHandler;
						}
						
						return mainScript;
					},
					processChildResponse: function(response) {
						/*
						The sessions children all reply with objects. The session is
						responsible for stringifying those objects, and clarifying that
						they are in json format.
						*/
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
				var url = req.url; //util.arrDef(req.headers, 'referer', req.headers.host);
				
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
						queryParams.update(json);
					}
				}
				
				/*try {*/
					
				if ('url' in queryParams) throw 'bad query parameter: "url"';
				
				queryUrl = queryUrl.split('/').filter(function(e) { return e.length > 0; });
				if (queryUrl.length === 0) queryUrl.push(config.defaultApp);
				
				var ip = req.connection.remoteAddress;
				
				var sessionsIndex = PACK.server.Session.SESSIONS;
				
				var session = ip in sessionsIndex 
					? sessionsIndex[ip]
					: (sessionsIndex[ip] = new PACK.server.Session({ ip: ip }));
				
				var params = queryParams.update({ url: queryUrl });
				if (!('address' in params)) params.address = [];
					
				if (params.address.constructor === String) {
					params.address = params.address.length > 0
						? params.address.split('.')
						: [];
				}
				
				if ('originalAddress' in params) throw 'illegal "originalAddress" param';
				params.originalAddress = U.arr(params.address);
				
				var responseContent = session.respondToQuery(params);
				responseText = responseContent.data;
				res.setHeader('Content-Length', responseText.length);
				res.setHeader('Content-Type', responseContent.encoding);
				res.end(responseText);
					
				/*} catch(e) {
					
					if (true) throw e;
					
					res.writeHead(404); 
					res.end('An error ocurred: "' + e.message + '"');
					
				}*/
			}
		};
	},
	runAfter: function() {
		var server = http.createServer(PACK.server.serverFunc);
		
		var port = 8000;
		server.listen(port);
		console.log('Listening on port: ' + port);
	},
});
package.build();
