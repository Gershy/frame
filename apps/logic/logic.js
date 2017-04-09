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
				rps: new uf.SimpleData({ value: 'rps' }),
				token: new uf.SimpleData({ value: null }),
				appVersion: new uf.UpdatingData({
					$getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
				}),
				loginView: new uf.CalculatedData({
					getFunc: function() {	return dataSet.token.getValue() ? 'in' : 'out'	}
				}),
				username: new uf.SimpleData({ value: '' }),
				password: new uf.SimpleData({ value: '' }),
				loginError: new uf.SimpleData({ value: '' }),
				focusedNodeName: new uf.SimpleData({ value: null })
			};
			
			var graphView = new uf.GraphView({ name: 'graph',
				relations: {
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
					
					var owned = data.username === dataSet.username.getValue();
					var saved = false; // TODO: how do we get this...
					
					return new uf.SetView({ name: name,
						cssClasses: [ 'theory', owned ? 'owned' : 'foreign' ],
						onClick: function(e) {
							console.log('Updated focus');
							dataSet.focusedNodeName.setValue(this.name);
						},
						children: [
							new uf.SetView({ name: 'controls', children: [
								new uf.ActionView({ name: 'loadDependencies', textData: 'Dependencies...', $action: function() {
									console.log('Dependencies for ' + data.quickName);
									return doss.$doRequest({
										address: [ 'theorySet', data.quickName, 'dependencySet' ].join('.'),
										command: 'getRawData'
									}).then(function(data) {
										console.log('GOT DATA', data);
									}).fail(function(err) {
										
										console.log('Loading duds (' + err.message + ')');
										graphView.addRawData([
											{
												quickName: 'thinghaha',
												username: 'MyManStan',
												theory: 'I\'m so fucking coolio bro bro'
											},
											{
												quickName: 'swaswa',
												username: 'GarbageCan',
												theory: 'recyclables do not go in the trash u idgit'
											},
											{
												quickName: 'banana',
												username: 'IAteABananaOnce',
												theory: 'when u eat bananas remember to have napkins available for any collateral banana splatter'
											}
										]);
										
									});
								}}),
								new uf.ActionView({ name: 'loadChallenges', textData: 'Challenges...', $action: function() {
									return PACK.p.$null;
								}})
							]}),
							new uf.SetView({ name: 'data', children: [
								new uf.DynamicTextView({ name: 'quickName',
									editableData: owned && !saved,
									textData: data.quickName,
									inputViewParams: {
										placeholderData: 'Quick Name',
										cssClasses: [ 'centered' ]
									}
								}),
								new uf.TextView({ name: 'user', // This one can't be edited!
									data: data.username
								}),
								new uf.DynamicTextView({ name: 'theory',
									editableData: owned,
									textData: data.theory,
									inputViewParams: {
										placeholderData: 'Theory',
										multiline: true
									}
								})
							]})
						]
					});
					
				},
				focusedNameData: dataSet.focusedNodeName
			});
							
			var rootView = new uf.SetView({ name: 'root', children: [
				
				new uf.ChoiceView({ name: 'login', choiceData: dataSet.loginView, children: [
					
					new uf.SetView({ name: 'out', children: [
						
						new uf.TextHideView({ name: 'loginError', data: dataSet.loginError }),
						
						new uf.InputView({ name: 'username', textData: dataSet.username, placeholderData: 'Username' }),
						new uf.InputView({ name: 'password', textData: dataSet.password, placeholderData: 'Password' }),
						new uf.ActionView({ name: 'submit', textData: 'Submit!', $action: function() {
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
						
						graphView,
						
						new uf.SetView({ name: 'controls', children: [
							new uf.SetView({ name: 'global', cssClasses: [ 'subControls' ], children: [
								new uf.ActionView({ name: 'new', textData: 'New Theory', $action: function() {
									graphView.childDataSet.push({
										quickName: 'newTheory',
										username: dataSet.username.getValue(),
										theory: 'The sky is blue.'
									});
									return PACK.p.$null;
								}}),
								new uf.ActionView({ name: 'exit', textData: 'Log Out', $action: function() {
									dataSet.token.setValue('');
									return PACK.p.$null;
								}})
							]}),
							new uf.SetView({ name: 'specific', cssClasses: [ 'subControls' ], children: [
								new uf.ActionView({ name: 'edit', textData: 'Edit', $action: function() {
									console.log('edit!');
								}}),
								new uf.ActionView({ name: 'delete', textData: 'Delete', $action: function() {
									console.log('delete!');
								}})
							]})
						]})
						
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
			
			/* ======= TESTING STUFF ======== */
			
			window.root = doss;
			window.view = rootView;
			window.data = dataSet;
			
			doss.$doRequest({ command: 'getToken', params: {
				username: 'admin',
				password: 'adminadmin123'
			}}).then(function(data) {
				dataSet.token.setValue(data.token);
			});
			
			dataSet.username.setValue('admin');
			dataSet.password.setValue('adminadmin123');
			
			graphView.addRawData([
				{
					quickName: 'newTheory',
					username: 'admin',
					theory: 'The sky is blue.'
				}
			].concat(U.range({0:4}).map(function(i) {
				return {
					quickName: U.id(i),
					username: U.id(i),
					theory: U.id(i) + ', ' + U.id(i * 20)
				};
			})));
			
			graphView.childDataSet.push({
				quickName: 'newTheory',
				username: 'admin',
				theory: 'The sky is blue.'
			});
			
		}).done();
		
	}
});
package.build();
