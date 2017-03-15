var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
	buildFunc: function(packageName, qd, userify, p) {
		
		var ret = {
			resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
			versionString: '0.0.1',
		};
		
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
		
		ret.$init = versioner.$getDoss().then(function(doss) {
			ret.queryHandler = doss;
			return doss;
		});
		
		return ret;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		PACK.logic.$init.then(function(doss) {
			console.log(doss.getDataView({}));
		}).done();
		
		return;
		
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
