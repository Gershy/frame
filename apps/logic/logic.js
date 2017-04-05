var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
	buildFunc: function(packageName, qd, userify, p) {
		
		var lg = {
			resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
			versionString: '0.0.1',
			LogicApp: U.makeClass({ name: 'LogicApp',
				superclass: PACK.quickDev.DossierDict,
				methods: function(sc, c) { return {
					init: function(params /* outline */) {
						sc.init.call(this, params);
					},
					
					$handleQuery: function(params /* command */) {
						var command = U.param(params, 'command');
						
						if (command === 'getToken') {
							
							var reqParams = U.param(params, 'params');
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var user = this.children.userSet.children[username];
							if (!user) throw new Error('Couldn\'t find user "' + username + '"');
							if (user.getChild('password').value !== password) throw new Error('Incorrect password');
							
							return PACK.p.$({
								username: user.getChild('username').value,
								token: user.getToken()
							});
							
						}
						
						return sc.$handleQuery.call(this, params);
					}
				};}
			}),
			LogicUser: U.makeClass({ name: 'LogicUser',
				superclass: PACK.quickDev.DossierDict,
				methods: function(sc, c) { return {
					init: function(params /* outline */) {
						sc.init.call(this, params);
					},
					
					getToken: function(user) {
						var u = this.getChild('username').value;
						var p = this.getChild('password').value;
						
						var str = '';
						var val = 9;
						var chars = '0ab45cd21ef58gh02ij0klm0no23p9qr62stu92vwxyz5AB8C0D37EF5GH7I4JKL2M4NO4PQR6ST8U39VW9998XYZ';
						
						for (var i = 0; i < 12; i++) {
							var v1 = u[(val + 19) % u.length].charCodeAt(0);
							var v2 = p[((val * val) + 874987) % p.length].charCodeAt(0);
							val = ((v1 + 3) * (v2 + 11) * 11239) + 3 + i + v1;
							str += chars[val % chars.length];
						}
						
						return str;
					}
				};}
			})
		};
		
		var versioner = new qd.Versioner({ versions: [
			{	name: 'initial',
				detect: function(doss) { return doss === null; },
				$apply: function(doss) {
					
					var outline = new qd.Outline({ c: lg.LogicApp, p: { name: 'app' }, i: [
						{ c: qd.DossierString, p: { name: 'version' } },
						{ c: qd.DossierList, p: { name: 'userSet',
							innerOutline: { c: lg.LogicUser, i: [
								{ c: qd.DossierString, p: { name: 'fname' } },
								{ c: qd.DossierString, p: { name: 'lname' } },
								{ c: qd.DossierString, p: { name: 'username' } },
								{ c: qd.DossierString, p: { name: 'password' } }
							]},
							prop: 'username/value'
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
									prop: '@theory.quickName/value'
								}},
								{ c: qd.DossierList,		p: { name: 'challengeSet',
									innerOutline: { c: qd.DossierDict, i: [
										{ c: qd.DossierRef, p: { name: 'theory', baseAddress: '~root.theorySet' } }
									]},
									prop: '@theory.quickName/value'
								}},
								{ c: qd.DossierList,		p: { name: 'voterSet',
									innerOutline: { c: qd.DossierDict, i: [
										{ c: qd.DossierRef, p: { name: 'user', baseAddress: '~root.userSet' } },
										{ c: qd.DossierInt, p: { name: 'value' } }
									]},
									prop: '@user.username/value'
								}}
							]},
							prop: 'quickName/value'
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
			{ name: 'add default data',
				detect: function(doss) { return !doss.getChild('userSet.admin'); },
				$apply: function(root) {
					
					var editor = new qd.Editor();
					
					return editor.$editFast({
						add: [
							{
								par: root.getChild('userSet'),
								data: {
									fname: 'Admin',
									lname: 'Istrator',
									username: 'admin',
									password: 'adminadmin123'
								}
							},
							{
								par: root.getChild('userSet'),
								data: {
									fname: 'Another',
									lname: 'User',
									username: 'another',
									password: 'anotheruseryay!'
								}
							}
						]
					}).then(function() {
						return root;
					});
					
				}
			}
		]});
		
		lg.$init = versioner.$getDoss().then(function(doss) {
			lg.queryHandler = doss;
			return doss;
		});
		
		return lg;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		var qd = PACK.quickDev;
		var uf = PACK.userify;
		
		var ARR = [];
		
		PACK.logic.$init.then(function(doss) {
			U.debug('THING', doss.getDataView({}));
			
			var dataSet = {
				rps: new uf.InstantData({ value: 'rps' }),
				token: new uf.InstantData({ value: null }),
				appVersion: new uf.UpdatingData({
					$getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
				}),
				loginView: new uf.CalculatedData({
					getFunc: function() {	return dataSet.token.getValue() ? 'in' : 'out'	}
				}),
				username: new uf.InstantData({ value: '' }),
				password: new uf.InstantData({ value: '' }),
				loginError: new uf.InstantData({ value: '' })
			};
			
			var graphView = new uf.GraphView({ name: 'graph',
				relationData: {
					dependsOn: {},
					challengedBy: {}
				},
				classifyRelation: function(data1, data2) {
					
				},
				getDataId: function(data) {
					return data.quickName;
				},
				genChildView: function(name, data) {
					/*
					data = {
						quickName: 'quickName',
						username: 'username',
						theory: 'theory text...',
						date: 'date string',
						prereqs: [
							'app.theorySet.list',
							'app.theorySet.of',
							'app.theorySet.supporting',
							'app.theorySet.theories',
							.
							.
							.
						],
						challengers: [
							'app.theorySet.list',
							'app.theorySet.of',
							'app.theorySet.challenging',
							'app.theorySet.theories',
							.
							.
							.
						],
						rating: 1000, // net sum of votes
					}
					*/
					
					return new uf.SetView({ name: name, children: [
						new uf.SetView({ name: 'controls', children: [
							new uf.ActionView({ name: 'loadDependencies', textData: new uf.InstantData({ value: 'Dependencies...' }), $action: function() {
								console.log('Dependencies for ' + data.quickName);
								return doss.$doRequest({
									address: [ 'theorySet', data.quickName, 'dependencySet' ].join('.'),
									command: 'getRawData'
								}).then(function(data) {
									console.log('GOT DATA', data);
								});
							}}),
							new uf.ActionView({ name: 'loadChallenges', textData: new uf.InstantData({ value: 'Challenges...' }), $action: function() {
								return PACK.p.$null;
							}})
						]}),
						new uf.SetView({ name: 'data', children: [
							new uf.TextView({ name: 'quickName', data: new uf.InstantData({ value: 'Name: ' + data.quickName }) }),
							new uf.TextView({ name: 'user', data: new uf.InstantData({ value: 'User: ' + data.username }) }),
							new uf.TextView({ name: 'theory', data: new uf.InstantData({ value: 'Theory: ' + data.theory }) })
						]})
					]});
					
				}
			});
							
			var rootView = new uf.SetView({ name: 'root', children: [
				
				new uf.ChoiceView({ name: 'login', choiceData: dataSet.loginView, children: [
					
					new uf.SetView({ name: 'out', children: [
						
						new uf.TextHideView({ name: 'loginError', data: dataSet.loginError }),
						
						new uf.InputView({ name: 'username', textData: dataSet.username, placeholderData: new uf.InstantData({ value: 'Username' }) }),
						new uf.InputView({ name: 'password', textData: dataSet.password, placeholderData: new uf.InstantData({ value: 'Password' }) }),
						new uf.ActionView({ name: 'submit', textData: new uf.InstantData({ value: 'Submit!' }), $action: function() {
							return doss.$doRequest({ command: 'getToken', params: {
								username: dataSet.username.getValue(),
								password: dataSet.password.getValue()
							}}).then(function(data) {
								dataSet.token.setValue(data.token);
							}).fail(function(err) {
								dataSet.loginError.setValue(err.message);
								new PACK.p.P({ timeout: 3000 }).then(function() { dataSet.loginError.setValue(''); });
							});
						}})
						
					]}),
					
					new uf.SetView({ name: 'in', children: [
						
						new uf.SetView({ name: 'controls', children: [
							
						]}),
						
						graphView
						
					]}),
					
				]}),
				new uf.TextView({ name: 'version', data: dataSet.appVersion }),
				new uf.TextView({ name: 'rps', data: dataSet.rps })
				
			]});
			
			var updateFunc = function() {
				var time = +new Date();
				rootView.$update(1000 / 60).then(function() {
					dataSet.rps.setValue('update: ' + (new Date() - time) + 'ms')
					requestAnimationFrame(updateFunc);
				}).done();
			};
			requestAnimationFrame(updateFunc);
			
			window.root = doss;
			window.view = rootView;
			
		}).done();
		
		return;
		
		/*
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
								value: function(child, params /* * /) {}
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
		
		*/
	}
});
package.build();
