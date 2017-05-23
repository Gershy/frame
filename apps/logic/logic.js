/*
Checklist:
- Determine how dragging overrides graphnode positioning behaviour
- Dragging for moving nodes, or linking, or both???
- Should GraphView provide the canvas?
- Dragging css
	- can apply `pointer-events: none;` globally when dragging (`pointer-events: all;` for drag targets)
- Reconsider having node focus implemented by GraphView
	- Should instead be a decorator that changes classes based on focus
	- Focus clicking should be detected through decorators, not GraphView
- There's a flicker on page-load (a stylesheet is not applying on the 1st frame I think)
*/

var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'userify', 'p', 'queries', 'geom' ],
	buildFunc: function(packageName, qd, userify, p) {
		
		var lg = {
			resources: { css: [ 'apps/logic/style.css', 'apps/userify/style.css' ] },
			versionString: '0.0.1',
			theoryNameRegex: /^[a-z][a-zA-Z]+$/,
			LogicApp: U.makeClass({ name: 'LogicApp',
				superclass: PACK.quickDev.DossierDict,
				methods: function(sc, c) { return {
					init: function(params /* outline */) {
						sc.init.call(this, params);
					},
					
					validateTheoryName: function(name) {
						
						if (name.length > 24)
							return { valid: false, msg: 'theoryName.tooLong' };
						
						if (name.length < 3)
							return { valid: false, msg: 'theoryName.tooShort' };
						
						if (!lg.theoryNameRegex.test(name))
							return { valid: false, msg: 'theoryName.invalid' };
						
						if (name in this.children.theorySet.children)
							return { valid: false, msg: 'theoryName.unavailable' };
						
						return { valid: true };
						
					},
					$handleQuery: function(params /* command */) {
						var command = U.param(params, 'command');
						
						if (command === 'getToken') {
							
							var reqParams = U.param(params, 'params');
							var username = U.param(reqParams, 'username');
							var password = U.param(reqParams, 'password');
							
							var user = this.requireUser(username);
							if (user.getChild('password').value !== password) throw new Error('Incorrect password');
							
							return PACK.p.$({
								username: user.getChild('username').value,
								token: user.getToken()
							});
							
						} else if (command === 'validateTheoryName') {
							
							var reqParams = U.param(params, 'params');
							var name = U.param(reqParams, 'name');
							return PACK.p.$(this.validateTheoryName(name));
							
						} else if (command === 'saveTheory') { // TODO: Consider writing a TheorySet DossierDict subclass, and implementing this there?
							
							var reqParams = U.param(params, 'params');
							var token = U.param(reqParams, 'token');
							var quickName = U.param(reqParams, 'quickName');
							var theoryUsername = U.param(reqParams, 'username');
							var theoryTitle = U.param(reqParams, 'title');
							var theoryText = U.param(reqParams, 'theory');
							
							// The theory's user needs to correspond to the user's token (users can only edit their own theories)
							var user = this.requireUser(theoryUsername, token);
							var theorySet = this.children.theorySet;
							var essaySet = this.children.essaySet;
							
							var timestamp = +new Date();
							var editor = new qd.Editor();
							
							if (quickName in theorySet.children) {
								
								console.log('Updating theory ' + theorySet.children[quickName].getAddress());
								var $theory = PACK.p.$(theorySet.children[quickName]);
								
							} else {
								
								var valid = this.validateTheoryName(quickName);
								if (!valid.valid) throw new Error(valid.msg);
								
								console.log('Saving theory to ' + theorySet.getAddress());
								var essaySet = this.children.essaySet;
								
								var $theory = editor.$addFast({
									par: essaySet,
									data: {
										markup: '- placeholder -'
									}
								}).then(function(essay) {
									
									console.log('GOT ESSAY:', essay.getAddress());
									
									// Create the theory
									return editor.$addFast({
										par: theorySet,
										name: quickName,
										data: {
											createdTime: timestamp,
											editedTime: 0,
											quickName: quickName,
											title: '- placeholder -', // theoryTitle
											user: user,
											essay: essay,
											dependencySet: [],
											challengeSet: [],
											voterSet: []
										}
									});
									
								})
								
							}
							
							return $theory.then(function(theory) {
								
								var $modTheory = editor.$modFast({ doss: theory, data: {
									title: theoryTitle,
									editedTime: timestamp
								}});
								
								var $modEssay = editor.$modFast({ doss: theory.getChild('@essay'), data: {
									markup: theoryText
								}});
								
								return new PACK.p.P({ all: [ theory, $modTheory, $modEssay ] })
								
							}).them(function(theory) {
								
								console.log('GOT THEORY:', theory.getAddress());
								
								return theory.getDataView({});
								
							});
							
						}
						
						return sc.$handleQuery.call(this, params);
					},
					requireUser: function(username, token) {
						var user = this.children.userSet.children[username];
						if (!user) throw new Error('Couldn\'t find user "' + username + '"');
						if (token && user.getToken() !== token) throw new Error('Incorrects token for user "' + username + '"');
						return user;
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
								{ c: qd.DossierInt,			p: { name: 'createdTime' } },
								{ c: qd.DossierInt,			p: { name: 'editedTime' } },
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
				focusedNode: new uf.SimpleData({ value: null })
			};
			
			// Makes graph nodes draggable
			var dragNode = new uf.DragDecorator({
				tolerance: 0,
				validTargets: [
					'._text._user',			// Dragging on the username
					'._choose-display'	// Dragging on either the title or the content when they're not editable
				],
				captureOnStart: function(view) {
					return graphView.getChildRawData(view).physics.loc.getValue();
				}
			});
			var dragDependency = new uf.DragActionDecorator({
				dragDecorator: dragNode,
				action: function(params /* target, dropZone */) {
					var target = U.param(params, 'target');
					var dropZone = U.param(params, 'dropZone');
					
					// `d1` relies on `d0` as a dependency
					var d0 = target;
					var d1 = dropZone.par.par;
					
					var d0Data = graphView.getChildRawData(d0).raw.theory;
					var d1Data = graphView.getChildRawData(d1).raw.theory;
					
					console.log(d0Data, '--->', d1Data);
				}
			});
			var clickNode = new uf.ClickDecorator({
				validTargets: [
					'._text._user',			// Dragging on the username
					'._choose-display'	// Dragging on either the title or the content when they're not editable
				],
				action: function(view) {
					// Don't count clicks if dragging
					var drg = dragNode.data.getValue();
					if (!drg.drag || view !== drg.view) dataSet.focusedNode.setValue(view);
				}
			});
			
			var graphNodeInvRadius = 1 / 150;
			
			var graphView = new uf.GraphView({ name: 'graph', maxUpdatesPerFrame: 10,
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
						saved: true | false
					}
					*/
					
					// This is the view that will be returned
					var view = new uf.SetView({ name: name });
					
					// Get the initial data value for `view`
					var val = data.getValue();
					
					// Substitute custom Data objects in `val`
					val.physics.r = new uf.CalculatedData({
						getFunc: function() {
							return view === dataSet.focusedNode.getValue() ? 150 : 65;
						}
					});
					
					val.physics.weight = new uf.CalculatedData({
						getFunc: function() {
							// Nodes being dragged have 0 weight
							var drg = dragNode.data.getValue();
							return (drg.drag && drg.view === view) ? 0 : 1;
						}
					});
					
					// Replace the `loc` item with one that takes drags into account
					var loc = val.physics.loc.getValue(); // Initialize to the original loc's value
					val.physics.loc = new uf.CalculatedData({
						getFunc: function() {
							var drg = dragNode.data.getValue();
							if (drg.drag && drg.view === view) return drg.capturedData.sub(drg.pt1).add(drg.pt2);
							if (dataSet.focusedNode.getValue() === view) return PACK.geom.ORIGIN;
							
							return loc;
						},
						setFunc: function(newLoc) {
							loc = newLoc;
						}
					});
					
					var username = val.raw.username; // Can't change
					var saved = val.raw.saved;
					var owned = username === dataSet.username.getValue();
					var editing = !saved; // non-saved nodes should be editing initially
					
					view.cssClasses = [ 'theory', owned ? 'owned' : 'foreign' ]; // Ownership can never change, so safe to hardcode
					view.decorators = [
						dragNode,
						clickNode,
						new uf.CssDecorator({
							properties: [ 'left', 'top', 'transform' ],
							data: function() {
								var phys = data.getValue().physics;
								var loc = phys.loc.getValue();
								var r = phys.r.getValue();
								
								return {
									left: (loc.x - r) + 'px',
									top: (loc.y - r) + 'px',
									transform: 'scale(' + r * graphNodeInvRadius + ')' // 150 is the natural width
								}
							}
						}),
						new uf.ClassDecorator({
							possibleClasses: [ 'dragging' ],
							data: function() {
								var dragData = dragNode.data.getValue();
								return dragData.drag && dragData.view === view ? 'dragging' : null;
							}
						}),
						new uf.ClassDecorator({
							possibleClasses: [ 'focused' ],
							data: function() {
								return dataSet.focusedNode.getValue() === view ? 'focused' : null;
							}
						})
					];
					view.addChildren([
						new uf.SetView({ name: 'controls', children: [
							new uf.ActionView({ name: 'loadDependencies', textData: 'Dependencies...',
								decorators: [
									dragDependency
								],
								$action: function() {
									
									var raw = data.getValue().raw;
									console.log('Dependencies for ' + raw.quickName, raw);
									
									return PACK.p.$null;
									
									return doss.$doRequest({
										
										address: [ 'theorySet', raw.quickName, 'dependencySet' ].join('.'),
										command: 'getRawData'
										
									}).then(function(dependencySetData) {
										
										console.log('GOT DATA', dependencySetData);
										
									}).fail(function(err) {
										
										console.log('DEPENDENCIES FAILED:', err);
										
										return;
										
										console.log('Loading duds (' + err.message + ')');
										graphView.addRawData([
											{
												quickName: 'thinghaha',
												username: 'MyManStan',
												title: 'So Cool',
												theory: 'I\'m so fucking coolio bro bro'
											},
											{
												quickName: 'swaswa',
												username: 'GarbageCan',
												title: 'Bad bad',
												theory: 'recyclables do not go in the trash u idgit'
											},
											{
												quickName: 'banana',
												username: 'IAteABananaOnce',
												title: '2messy4me',
												theory: 'when u eat bananas remember to have napkins available for any collateral banana splatter'
											}
										]);
										
									});
								}
							}),
							new uf.ActionView({ name: 'loadChallenges', textData: 'Challenges...', $action: function() {
								return PACK.p.$null;
							}}),
							new uf.ChoiceView({ name: 'owner',
								choiceData: function() { return owned && view === dataSet.focusedNode.getValue() ? 'show' : null; },
								children: [
									new uf.SetView({ name: 'show', children: [
										new uf.ActionView({ name: 'edit', textData: 'Edit', $action: function() {
											editing = true;
											return PACK.p.$null;
										}}),
										new uf.ActionView({ name: 'delete', textData: 'Delete', $action: function() {
											return PACK.p.$null;
										}}),
										new uf.ActionView({ name: 'save', textData: 'Save', $action: function() {
											editing = false;
											var saveData = {
												quickName: view.getChild('data.quickName').textData.getValue(),
												username: data.getValue().raw.username,
												title: view.getChild('data.title').textData.getValue(),
												theory: view.getChild('data.theory').textData.getValue()
											};
											
											console.log('SAVING:', saveData);
											
											return doss.$doRequest({
												command: 'saveTheory',
												params: saveData.update({ token: dataSet.token.getValue() })
											}).then(function(response) {
												console.log('SAVED', response);
												saved = true;
												graphView.updateRawData(view, saveData);
											}).fail(function(err) {
												editing = true; // Didn't save; go back to editing
												console.error(err.stack);
											});
										}})
									]})
								]
							})
						]}),
						new uf.SetView({ name: 'data', children: [
							new uf.DynamicTextView({ name: 'quickName',
								editableData: function() { return editing && owned && !saved; },
								textData: data.getValue().raw.quickName,
								inputViewParams: {
									placeholderData: 'Quick Name',
									cssClasses: [ 'centered' ]
								}
							}),
							new uf.TextView({ name: 'user',
								data: username
							}),
							new uf.DynamicTextView({ name: 'title',
								editableData: function() { return editing && owned; },
								textData: data.getValue().raw.title,
								inputViewParams: {
									placeholderData: 'Title'
								}
							}),
							new uf.DynamicTextView({ name: 'theory',
								editableData: function() { return editing && owned; },
								textData: data.getValue().raw.theory,
								inputViewParams: {
									placeholderData: 'Theory',
									multiline: true
								}
							})
						]})
					]);
					
					return view;
				},
				physicsSettings: {
					dampenGlobal: 0.89,
					separation: 10,
					gravityPow: 1.5,
					gravityMult: 300,
					centerAclMag: 1000
				}
			});
			
			var rootView = new uf.SetView({ name: 'root',
				decorators: [
					new uf.ClassDecorator({
						possibleClasses: [ 'dragging' ],
						data: function() {
							return dragNode.data.getValue().drag ? 'dragging' : null;
						}
					})
				],
				children: [
					
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
										var num = 2;
										var name = 'newTheory';
										while (name in graphView.children) name = name.substr(0, 9) + (num++);
										
										graphView.addRawData({
											quickName: name,
											username: dataSet.username.getValue(),
											title: 'Look up',
											theory: 'The sky is blue.',
											saved: false
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
					
				]}
			);
			
			var updateFunc = function() {
				
				var time = +new Date();
				rootView.update(1000 / 60);
				dataSet.rps.setValue('update: ' + (new Date() - time) + 'ms')
				
				requestAnimationFrame(updateFunc);
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
					title: 'Look up',
					theory: 'The sky is blue.',
					saved: false
				}
			].concat(U.range({0:10}).map(function(i) {
				return {
					quickName: U.charId(i),
					username: U.charId(i),
					title: U.id((i * 93824793287) % 134),
					theory: U.id(i) + U.id(i * 20) + U.id((i + 30) * 17),
					saved: false
				};
			})));
			dataSet.focusedNode.setValue(graphView.children.newTheory);
			
		}).done();
		
	}
});
package.build();
