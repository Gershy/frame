var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
	buildFunc: function(packageName, qd, userify, p) {
		
		var ret = {
			resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
			versionString: '0.0.1',
			LogicApp: U.makeClass({ name: 'LogicApp',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					start: function() {
						if (!U.isServer()) throw new Error('Only call this server-side');
						
						var pass = this;
						this.dbUpdate = new qd.QUpdate({
							request: function(onComplete) {
								pass.setState(pass.schemaParams({
									selection: qd.sel.all
								}), onComplete);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						this.dbUpdate.repeat({ delay: 1500 });
					},
					getState: function(onComplete) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { onComplete(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: packageName }).limit(1).next(function(err, doc) {
								onComplete(doc !== null ? doc.data : null);
							});
						});
					},
					setState: function(state, onComplete) {
						/*
						Persists the creativity app into the db
						*/
						if (DB === null) { if(onComplete) onComplete(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.update({ name: packageName }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
								if (onComplete) onComplete(doc.result);
							});
						});
					},
					handleQuery: function(params) {
						var com = U.param(params, 'command');
						var reqParams = U.param(params, 'params', {});
						
						if (com === 'createAccount') {
							
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var users = this.getChild('users');
							
							if (users.getChild(username)) return new PACK.p.P({ val: {
								msg: 'username taken',
								code: 1
							}});
							
							var user = this.getChild('users').getNewChild({
								username: username,
								password: password
							});
							
							return new PACK.p.P({ val: {
								msg: 'successfully created account',
								token: user.getToken(),
								username: user.getChild('username').value
							}});
							
						} else if (com === 'getUserToken') {
							
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var user = this.getChild('users').filter({ 'username/data': username }, true);
							if (user === null) throw new Error('no user named "' + username + '"');
							if (user.getChild('password').value !== password) throw new Error('Invalid password');
							
							return new PACK.p.P({ val: {
								msg: 'login success',
								token: user.getToken()
							}});
							
						}
						
						return sc.handleQuery.call(this, params);
					}
				}; }
			}),
			LogicUser: U.makeClass({ name: 'LogicUser',
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
			LogicTheory: U.makeClass({ name: 'LogicTheory',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
				}; }
			})
		};
		//ret.queryHandler = new ret.LogicApp({ name: 'app', children: [] });
		
		var versioner = new qd.Versioner({ versions: [
			{	name: 'initial',
				detect: function(doss) { return doss === null; },
				$apply: function(doss) {
					
					var outline = new qd.Outline({ c: qd.DossierDict, p: { name: 'app' }, i: [
						{ c: qd.DossierString, p: { name: 'version' } },
						{ c: qd.DossierList, p: { name: 'userSet',
							innerOutline: { c: qd.DossierDict, i: [
								{ c: qd.DossierString, p: { name: 'fname' } },
								{ c: qd.DossierString, p: { name: 'lname' } },
								{ c: qd.DossierString, p: { name: 'username' } },
								{ c: qd.DossierString, p: { name: 'password' } }
							]},
							prop: 'username/data'
						}},
						{ c: qd.DossierList, p: { name: 'essaySet',
							innerOutline: { c: qd.DossierDict, i: [
								{ c: qd.DossierString, p: { name: 'markup' } }
							]}
						}},
						{ c: qd.DossierList, p: { name: 'theorySet',
							innerOutline: { c: qd.DossierDict, i: [
								{ c: qd.DossierInt,			p: { name: 'timestamp' } },
								{ c: qd.DossierString,	p: { name: 'quickName' } },
								{ c: qd.DossierString,	p: { name: 'title' } },
								{ c: qd.DossierRef,			p: { name: 'user', baseAddress: '~root.userSet' } },
								{ c: qd.DossierRef,			p: { name: 'essay', baseAddress: '~root.essaySet' } },
								{ c: qd.DossierRef,			p: { name: 'duplicate', baseAddress: '~root.theorySet' } },
								{ c: qd.DossierList,		p: { name: 'dependencySet',
									innerOutline: { c: qd.DossierDict, i: [
										{ c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
									]},
									prop: '@theory.quickName/data'
								}},
								{ c: qd.DossierList,		p: { name: 'challengeSet',
									innerOutline: { c: qd.DossierDict, i: [
										{ c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
									]},
									prop: '@theory.quickName/data'
								}},
								{ c: qd.DossierList,		p: { name: 'voterSet',
									innerOutline: { c: qd.DossierDict, i: [
										{ c: qd.DossierRef, p: { name: 'user', baseAddress: '~root.userSet' } },
										{ c: qd.DossierInt, p: { name: 'value' } }
									]},
									prop: '@user.username/data'
								}}
							]},
							prop: 'quickName/data'
						}}
					]});
					var data = {
						version: '0.0.1 (initial)',
						userSet: {},
						essaySet: {},
						theorySet: {}
					};
					
					var editor = new qd.Editor();
					var $app = editor.$create(outline, data);
					editor.resolveReqs();
					
					return $app;

				}
			},
			{ name: 'add default user',
				detect: function(doss) { return !doss.getChild('userSet.admin'); },
				$apply: function(doss) {
					
					var userSet = doss.getChild('userSet');
					var userOutline = userSet.getChildOutline();
					var userData = {
						fname: 'Admin',
						lname: 'Istrator',
						username: 'admin',
						password: 'adminadmin123'
					};
					
					var editor = new qd.Editor();
					var $user = editor.$add(userSet, userOutline, null, userData);
					editor.resolveReqs();
					
					return $user.then(function() { return doss; });
					
				}
			}
		]});
		
		versioner.$getDoss().then(function(doss) {
			console.log('GOT VERSIONED DOSS');
			console.log(doss);
			console.log(JSON.stringify(doss.getSimpleView(), null, 2));
			
			ret.queryHandler = doss;
		}).done();
		
		/*
		U.addSerializables([
			{	name: 'logic.root.schema',
				value: new qd.QSchema({ c: ret.LogicApp, p: { name: 'app' }, i: [
					{	c: qd.QString, p: { name: 'version', value: '0.0.1 (initial)' } },
					{ c: qd.QGen, p: { name: 'users',
						_schema: 'logic.user.schema',
						_initChild: 'logic.user.init',
						prop: 'username/data'
					}},
					{	c: qd.QGen, p: { name: 'essays',
						_schema: 'logic.essay.schema',
						_initChild: 'logic.essay.init',
						prop: 'id/data'
					}},
					{	c: qd.QGen, p: { name: 'theories',
						_schema: 'logic.theory.schema',
						_initChild: 'logic.theory.init',
						prop: 'quickName/data'
					}}
				]})
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
				value: function(user, params /* * /) {
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
				value: function(child, params /* * /) {
					var markup = U.param(params, 'markup');
					child.getChild('markup').setValue(markup);
				}
			},
			
			{	name: 'logic.theory.schema',
				value: new qd.QSchema({ c: ret.LogicTheory, i: [
					{ c: qd.QInt, 		p: { name: 'timestamp' } },
					{ c: qd.QRef, 		p: { name: 'user' } },
					{ c: qd.QRef, 		p: { name: 'duplicate' } },
					{ c: qd.QString, 	p: { name: 'quickName' } },
					{ c: qd.QString, 	p: { name: 'title' } },
					{ c: qd.QRef, 		p: { name: 'essay' } },
					{ c: qd.QGen, 		p: { name: 'challengers',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@.quickName/data'
					}},
					{ c: qd.QGen, 		p: { name: 'prerequisites',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@.quickName/data'
					}},
					{ c: qd.QGen, 		p: { name: 'voters',
						_schema: 'logic.theory.voter.schema',
						_initChild: 'logic.theory.voter.init',
						prop: '@user.username/data'
					}}
				]})
			},
			{	name: 'logic.theory.init',
				value: function(child, params /* user, quickName, title, essayMarkup, prerequisites * /, par) {
					var theories = par.getChild('$root.theories');
					
					var timestamp = +(new Date());
					var user = U.param(params, 'user');
					var quickName = U.param(params, 'quickName');
					var title = U.param(params, 'title');
					var essayMarkup = U.param(params, 'essayMarkup');
					var prerequisites = U.param(params, 'prerequisites', []);
					
					prerequisites = prerequisites.map(function(prereqName) {
						var ret = theories.getChild(prereqName);
						if (!ret) throw new Error('Invalid prerequisite name: "' + prereqName + '"');
						return ret;
					});
					
					child.getChild('timestamp').setValue(timestamp);
					child.getChild('user').setValue(user);
					child.getChild('quickName').setValue(quickName);
					child.getChild('title').setValue(title);
					
					var essay = par.getChild('$root.essays').getNewChild({ markup: essayMarkup });
					
					child.getChild('essay').setRef(essay);
					
					// TODO: HEEERE; SOMETHING WRONG HERE
					// Should potentially refactor the whole dynamic-id-name, tree-building thing in quickDev
					prerequisites.forEach(function(theory) {
						child.getChild('prerequisites').getNewChild({ theory: theory });
					});
				}
			},
			
			{	name: 'logic.theory.related.schema',
				value: new qd.QSchema({ c: qd.QRef, p: { name: 'theory' } })
			},
			{	name: 'logic.theory.related.init',
				value: function(child, params /* theory * /) {
					var theory = U.param(params, 'theory');
					if (theory === null) throw new Error('Cannot relate to a null theory');
					child.setRef(theory);
				}
			},
			
			{	name: 'logic.theory.voter.schema',
				value: new qd.QSchema({ c: qd.QDict, p: { name: 'voter' }, i: [
					{ c: qd.QRef, p: { name: 'user' } },
					{ c: qd.QInt, p: { name: 'vote' } }
				]})
			},
			{	name: 'logic.theory.voter.init',
				value: function(child, params /* * /) {
					
				}
			}
		]);
		*/
		return ret;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		/*
		var appData = {
			name: 'AMAZING APP',
			snacks: {
				cookie: {
					name: 'cookie',
					calories: 80
				},
				apple: {
					name: 'apple',
					calories: 30
				},
				peanut: {
					name: 'peanut',
					calories: 20
				}
			},
			users: {
				gmaes: {
					name: {
						user: 'gmaes',
						first: 'Gersh',
						last: 'Maes'
					},
					snacks: {
						0: '~root.snacks.peanut',
						1: '~root.snacks.peanut',
						2: '~root.snacks.peanut',
						3: '~root.snacks.peanut',
						4: '~root.snacks.peanut'
					},
					age: 23
				},
				apast: {
					name: {
						user: 'apast',
						first: 'Ari',
						last: 'Past'
					},
					snacks: {
						0: '~root.snacks.cookie',
						1: '~root.snacks.cookie',
						2: '~root.snacks.cookie'
					},
					age: 23
				},
				dsiege: {
					name: {
						user: 'dsiege',
						first: 'Daniel',
						last: 'Siegel'
					},
					snacks: {
						0: '~root.snacks.apple'
					},
					age: 23
				}
			}
		};
		
		var qd = PACK.quickDev;
		
		var snackOutline = new qd.Outline({ c: qd.DossierDict, i: [
			{ c: qd.DossierValue, p: { name: 'name' } },
			{ c: qd.DossierValue, p: { name: 'calories' } },
		]});
		var snackRefOutline = new qd.Outline({ c: qd.DossierRef });
		var userOutline = new qd.Outline({ c: qd.DossierDict, i: [
			
			{ c: qd.DossierDict, p: { name: 'name' }, i: [
				{ c: qd.DossierValue, p: { name: 'user' } },
				{ c: qd.DossierValue, p: { name: 'first' } },
				{ c: qd.DossierValue, p: { name: 'last' } },
			]},
			{ c: qd.DossierList, p: { name: 'snacks',
				innerOutline: snackRefOutline,
				prop: '~par/nextInd',
			}},
			{ c: qd.DossierValue, p: { name: 'age' } },
			
		]});
		var appOutline = new qd.Outline({ c: qd.DossierDict, p: { name: 'app' }, i: [
			
			{ c: qd.DossierValue, p: { name: 'name' } },
			{ c: qd.DossierList, p: { name: 'users',
				innerOutline: userOutline,
				prop: 'name.user/data',
			}},
			{ c: qd.DossierList, p: { name: 'snacks',
				innerOutline: snackOutline,
				prop: 'name.value',
			}}
			
		]});
		
		ed.$create(appOutline, appData)
			.then(function(appDoss) {
				var $newUserDoss = ed.$add(appDoss.getChild('users'), appDoss.getChild('users').getChildOutline(), null, {
					name: { user: 'haha', first: 'Ha', last: 'Haa' },
					snacks: {},
					age: 10
				});
				ed.resolveReqs();
				return [ appDoss, $newUserDoss ];
			})
			.them(function(appDoss, newUserDoss) {
				console.log('APP', appDoss);
				console.log('USR', newUserDoss);
			})
			.done();
		
		ed.resolveReqs();
		
		return;
		*/
		
		var root = PACK.logic.queryHandler;
		var qd = PACK.quickDev;
		var us = PACK.userify;
		var e = PACK.e.e;
		var P = PACK.p.P;
		
		var selAll = qd.sel.all;
		var selTheory = new qd.QSelInc({ selNames: {
			timestamp: selAll,
			quickName: selAll,
			title: selAll,
			essay: selAll
		}});
		
		root.$load({ selection: new qd.QSelAll() })
			.then(function(app) {					// Add static elements to `app`
				
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
						new qd.QString({ name: 'prerequisiteAssocName', value: 'Prerequisite' }),
						new qd.QString({ name: 'challengerAssocName', value: 'Challenger' }),
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
				
				return app;
				
			})
			.then(function(rootDoss) {		// Define the view
				
				var view = new us.RootView({ name: 'root', doss: rootDoss, elem: PACK.e.e('body'), children: [
					
					new us.ConditionView({ name: 'checkLogin',
						
						condition: function() {
							return !rootDoss.getChild('static.credentials.token').value ? 'loggedOut'	: 'loggedIn';
						},
						
						children: [
							new us.SetView({ name: 'loggedOut', children: [
							
								new us.TabView({ name: 'loginOrCreate',
									getTabDoss: function(elem) {
										return ({
											create: 'static.text.accountCreate',
											login: 'static.text.accountLogin',
										})[elem.name];
									},
									children: [
										
										new us.SetView({ name: 'create', children: [
											
											new us.TextView({ name: 'title', doss: 'static.text.accountCreateTitle', editable: false }),
											new us.TextView({ name: 'username', doss: 'static.forms.createAccount.username', editable: true }),
											new us.TextView({ name: 'password', doss: 'static.forms.createAccount.password', editable: true }),
											new us.ActionView({ name: 'submit', titleDoss: 'static.text.accountCreate',
												action: function(view) {
													
													var $username = view.par.children.username.$appValue();
													var $password = view.par.children.password.$appValue()
													
													new P({ args: [ view.$getDoss(), $username, $password ] })
														.then(function(doss, username, password) {
															return doss.$request({
																command: 'createAccount',
																params: { username: username, password: password }
															});
														})
														.then(function(responseData) {
															rootDoss.getChild('static.credentials.token').setValue(responseData.token);
														});
												}
											})
											
										]}),
										new us.SetView({ name: 'login', children: [
											
											new us.TextView({ name: 'title', doss: 'static.text.accountLoginTitle', editable: false }),
											new us.TextView({ name: 'username', doss: 'static.forms.login.username', editable: true }),
											new us.TextView({ name: 'password', doss: 'static.forms.login.password', editable: true }),
											new us.ActionView({ name: 'submit', titleDoss: 'static.text.accountLogin',
												action: function(view) {
													view.getDoss().$request({
														command: 'getUserToken',
														params: {
															username: view.par.children.username.appValue(),
															password: view.par.children.username.appValue()
														}
													}).then(function(res) {
														console.log('LOGGED IN??', res);
														rootDoss.getChild('static.credentials.token').setValue(res.token);
													});
												}
											})
											
										]})
										
									]
								})
								
							]}),
							new us.SetView({ name: 'loggedIn', children: [
								
								new us.GenGraphView({ name: 'theories',
									
									genView: function(doss) {
										return new us.SetView({ name: doss.name, doss: doss, children: [
											new us.TextView({ name: 'name', doss: 'quickName', editable: false }),
											new us.TextView({ name: 'content', doss: 'title', editable: false }),
											//new us.TextView({ name: 'essay', doss: '@essay.markup', editable: false })
										]});
									},
									
									associationData: [
										{	
											name: 'prerequisite',
											titleDoss: rootDoss.getChild('static.text.prerequisiteAssocName'),
											$follow: function(doss) {
												console.log('Getting child from:', doss);
												//return doss.$getChild('prerequisites');
												return doss.$load({ selection: qd.sel.all })
													.then(function(loadedDoss) {
														console.log('LOADED', loadedDoss);
														return loadedDoss;
													})
													.fail(function(err) {
														console.log('ERR:', err);
													});
											}
										},
										{	
											name: 'challenger',
											titleDoss: rootDoss.getChild('static.text.challengerAssocName'),
											$follow: function(doss) { return doss.$getChild('challengers'); }
										}
									],
									
									$initialDoss: rootDoss.$getChild({ address: 'theories.townSurvivorsSolved', selection: selTheory })
									
								})
								
							]})
						]
						
					}),
					
					new us.SetView({ name: 'versionText', flow: 'inline', children: [
						new us.TextView({ name: '1', doss: 'static.text.version', editable: false }),
						new us.TextView({ name: '2', doss: 'version', editable: false })
					]})
					
				]});
				
				// Nice to make `root` and `view` vars available on client-side terminal
				window.view = view;
				window.root = root;
				
				return view.$startRender();
				
			})
			.then(function() {
				console.log('Began rendering');
			})
			.done();
		
	}
});
package.build();
