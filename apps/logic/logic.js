var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'queries', 'quickDev', 'htmlText', 'clock', 'userify' ],
	buildFunc: function(packageName) {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
			versionString: '0.0.1',
			LogicApp: PACK.uth.makeClass({ name: 'LogicApp',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					start: function() {
						if (!U.isServer()) throw new Error('Only call this server-side');
						
						var pass = this;
						this.dbUpdate = new qd.QUpdate({
							request: function(cb) {
								pass.setState(pass.schemaParams({
									selection: qd.sel.all
								}), cb);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						this.dbUpdate.repeat({ delay: 1500 });
					},
					getState: function(cb) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: packageName }).limit(1).next(function(err, doc) {
								cb(doc !== null ? doc.data : null);
							});
						});
					},
					setState: function(state, cb) {
						/*
						Persists the creativity app into the db
						*/
						if (DB === null) { if(cb) cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.update({ name: packageName }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
								if (cb) cb(doc.result);
							});
						});
					},
					handleQuery: function(params, onComplete) {
						var com = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						
						
						if (com === 'createAccount') {
							
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var users = this.getChild('users');
							
							if (users.getChild(username)) return onComplete({ code: 1, msg: 'username taken' });
							
							var user = this.getChild('users').getNewChild({
								username: username,
								password: password
							});
							
							return onComplete({
								msg: 'successfully created account',
								token: user.getToken(),
								username: user.getChild('username').value
							});
							
						} else if (com === 'getUserToken') {
							
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var user = this.getChild('users').filter({ 'username/value': username }, true);
							if (user === null) return onComplete({ error: 'no user named "' + username + '"' });
							if (user.getChild('password').value !== password) return onComplete({ error: 'invalid password' });
							
							return onComplete({
								msg: 'login success',
								token: user.getToken()
							});
							
						}
						
						sc.handleQuery.call(this, params, onComplete);
					}
				}; }
			}),
			LogicUser: PACK.uth.makeClass({ name: 'LogicUser',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					getToken: function() {
						var u = this.getChild('username').value;
						var p = this.getChild('password').value;
						
						var token = '';
						var val = 9;
						var chars = '0ab45c2vwxyz5AB8C0D37EF5GHd21ef58gh02ij0klm0no23p9qr62stQR6ST8U39VW9u97I4JKL2M4NO4P98XYZ';
						
						for (var i = 0; i < 12; i++) {
							var v1 = u[(val + 19) % u.length].charCodeAt(0);
							var v2 = p[((val * val) + 874987) % p.length].charCodeAt(0);
							val = ((v1 + 3 + i) * (v2 + 11) * 112239) + 3 + i + v1;
							token += chars[val % chars.length];
						}
						
						return token;
					}
				}; }
			}),
			LogicTheory: PACK.uth.makeClass({ name: 'LogicTheory',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
				}; }
			})
		};
		ret.queryHandler = new ret.LogicApp({ name: 'app', children: [] });
		
		U.addSerializables([
			{	name: 'logic.root.schemaParams',
				value: { c: ret.LogicApp, p: { name: 'app' }, i: [
					{	c: qd.QString, p: { name: 'version', value: '0.0.1 (initial)' } },
					{ 	c: qd.QGen, p: { name: 'users',
						_schema: 'logic.user.schema',
						_initChild: 'logic.user.init',
						prop: 'username/value'
					}},
					{	c: qd.QGen, p: { name: 'essays',
						_schema: 'logic.essay.schema',
						_initChild: 'logic.essay.init',
						prop: 'id/value'
					}},
					{	c: qd.QGen, p: { name: 'theories',
						_schema: 'logic.theory.schema',
						_initChild: 'logic.theory.init',
						prop: 'quickName/value'
					}}
				]}
			},
			
			{	name: 'logic.user.schema',
				value: new qd.QSchema({ c: ret.LogicUser, i: [
					{ c: qd.QString, p: { name: 'fname' } },
					{ c: qd.QString, p: { name: 'lname' } },
					{ c: qd.QString, p: { name: 'username' } },
					{ c: qd.QString, p: { name: 'password' } }
				]})
			},
			{	name: 'logic.user.init',
				value: function(user, params /* */) {
					user.getChild('fname').setValue('unnamed');
					user.getChild('lname').setValue('individual');
					user.getChild('username').setValue(params.username);
					user.getChild('password').setValue(params.password);
				}
			},
			
			{	name: 'logic.essay.schema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QInt, p: { name: 'id', value: 0 } },
					{ c: qd.QString, p: { name: 'markup' } }
				]})
			},
			{	name: 'logic.essay.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.schema',
				value: new qd.QSchema({ c: ret.LogicTheory, i: [
					{ c: qd.QRef, 		p: { name: 'user' } },
					{ c: qd.QInt, 		p: { name: 'timestamp' } },
					{ c: qd.QRef, 		p: { name: 'duplicate' } },
					{ c: qd.QString, 	p: { name: 'quickName' } },
					{ c: qd.QString, 	p: { name: 'title' } },
					{ c: qd.QRef, 		p: { name: 'essay' } },
					{ c: qd.QGen, 		p: { name: 'challengers',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@theory.quickName/value'
					}},
					{ c: qd.QGen, 		p: { name: 'prerequisites',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@theory.quickName/value'
					}},
					{ c: qd.QGen, 		p: { name: 'voters',
						_schema: 'logic.theory.voter.schema',
						_initChild: 'logic.theory.voter.init',
						prop: '@voter.username/value'
					}}
				]})
			},
			{	name: 'logic.theory.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.related.schema',
				value: new qd.QSchema({ c: qd.QRef, p: { name: 'theory' } })
			},
			{	name: 'logic.theory.related.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.voter.schema',
				value: new qd.QSchema({ c: qd.QDict, p: { name: 'voter' }, i: [
					{ c: qd.QRef, p: { name: 'user' } },
					{ c: qd.QInt, p: { name: 'vote' } }
				]})
			},
			{	name: 'logic.theory.voter.init',
				value: function(child, params /* */) {
					
				}
			}
		]);
		
		return ret;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		var root = PACK.logic.queryHandler;
		var qd = PACK.quickDev;
		var us = PACK.userify;
		var e = PACK.e.e;
		
		root.$load({ selection: new qd.QSelAll() }).fire(function(app) {
			
			app.addChild(new qd.QDict({ name: 'static', children: [
				new qd.QDict({ name: 'credentials', children: [
					new qd.QString({ name: 'token', value: '' }),
					new qd.QRef({ name: 'user', value: null })
				]}),
				new qd.QDict({ name: 'forms', children: [
					new qd.QDict({ name: 'login', children: [
						new qd.QString({ name: 'username', value: '' }),
						new qd.QString({ name: 'password', value: '' })
					]}),
					new qd.QDict({ name: 'createAccount', children: [
						new qd.QString({ name: 'username', value: '' }),
						new qd.QString({ name: 'password', value: '' })
					]}),
				]}),
				new qd.QDict({ name: 'text', children: [
					new qd.QString({ name: 'marker', value: 'HELLOOOO' }),
					new qd.QString({ name: 'version', value: 'Version:' }),
					new qd.QString({ name: 'accountLogin', value: 'Login' }),
					new qd.QString({ name: 'accountLoginTitle', value: 'Enter credentials:' }),
					new qd.QString({ name: 'accountCreate', value: 'Create Account' }),
					new qd.QString({ name: 'accountCreateTitle', value: 'Fill out the fields:' }),
					new qd.QGen({ name: 'temp',
						_schema: U.addSerializable({
							name: 'logic.text.temp.schema',
							value: new qd.QSchema({ c: qd.QString, p: {} })
						}),
						_initChild: U.addSerializable({
							name: 'logic.text.temp.initChild',
							value: function(child, params /* */) {}
						}),
						prop: '/name'
					})
				]})
			]}));
			
			console.log(app.simplified());
			
			var view = new us.RootView({ name: 'root', appData: app, elem: PACK.e.e('body'), children: [
				
				new us.ConditionView({ name: 'checkLogin', appData: app,
					
					condition: function() {
						try {
						return app.getChild('static.credentials.token').value === '' ? 'loginActions'	: 'loggedIn'; } catch(err) {} return 'loginActions';
					},
					
					children: [
						new us.SetView({ name: 'loginActions', children: [
						
							new us.TabView({ name: 'loginOrCreate',
								getTabAppData: function(elem) {
									return ({
										create: 'static.text.accountCreate',
										login: 'static.text.accountLogin',
									})[elem.name];
								},
								children: [
								
									new us.SetView({ name: 'login', children: [
										
										new us.TextView({ name: 'title', appData: 'static.text.accountLoginTitle', editable: false }),
										new us.TextView({ name: 'username', appData: 'static.forms.login.username', editable: true }),
										new us.TextView({ name: 'password', appData: 'static.forms.login.password', editable: true }),
										new us.ActionView({ name: 'submit', titleAppData: 'static.text.accountLogin',
											action: function(view) {
												view.getAppData().$request({
													command: 'getUserToken',
													params: {
														username: view.par.children.username.appValue(),
														password: view.par.children.username.appValue()
													}
												}).fire(function(res) {
													console.log('LOGGED IN??', res);
													app.getChild('static.credentials.token').setValue(res.token);
												});
											}
										})
										
									]}),
									
									new us.SetView({ name: 'create', children: [
										
										new us.TextView({ name: 'title', appData: 'static.text.accountCreateTitle', editable: false }),
										new us.TextView({ name: 'username', appData: 'static.forms.createAccount.username', editable: true }),
										new us.TextView({ name: 'password', appData: 'static.forms.createAccount.password', editable: true }),
										new us.ActionView({ name: 'submit', titleAppData: 'static.text.accountCreate',
											action: function(view) {
												view.getAppData().$request({
													command: 'createAccount',
													params: {
														username: view.par.children.username.appValue(),
														password: view.par.children.password.appValue()
													}
												}).fire(function(res) {
													app.getChild('static.credentials.token').setValue(res.token);
												});
											}
										})
										
									]})
								
								]
							})
							
						]}),
						new us.SetView({ name: 'loggedIn', children: [
							
							new us.GenGraphView({ name: 'theories',
								
								initialNodeAppData: app.getChild('theories.0'),
								
								decorateView: function(view, appData) {
									
									view.addChild(new us.TextView({ name: 'name', appData: 'quickName' }));
									view.addChild(new us.TextView({ name: 'content', appData: '@essay.markup' }));
									view.addChild(new us.TextView({ name: 'user', appData: '@user.username' }));
									
								},
								
								followLinks: function(appData, cb) {
									
									return appData.getChild('prerequisites');
									
								}
								
							})
							
						]})
					]
					
				}),
				
				new us.SetView({ name: 'versionText', flow: 'inline', children: [
					new us.TextView({ name: '1', appData: 'static.text.version', editable: false }),
					new us.TextView({ name: '2', appData: 'version', editable: false })
				]})
				
			]});
			
			view.startRender();
			window.view = view;	// Nice to make `root`/`view` available on client-side terminal
			window.root = root; 
		});
		
	}
});
package.build();
