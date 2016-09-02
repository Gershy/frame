var package = new PACK.pack.Package({ name: 'creativity',
	dependencies: [ 'quickDev', 'htmlText' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/creativity/style.css' ] }
		};
		
		var CreativityApp = PACK.uth.makeClass({ name: 'CreativityApp',
			superclassName: 'QDict',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* */) { sc.init.call(this, params); },
				genUserToken: function(user) {
					var u = user.getChild('username').value;
					var p = user.getChild('password').value;
					
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
				},
				handleQuery: function(params) {
					var com = U.param(params, 'command');
					
					if (com === 'getToken') {
						
						var tokenParams = U.param(params, 'params');
						var username = U.param(tokenParams, 'username');
						var password = U.param(tokenParams, 'password');
						
						var query = { p: {}, i: {
							username: { p: { value: username } },
							password: { p: { value: password } }
						}};
						var result = this.getChild('users').filterChildren(query);
						
						if (result.length === 0) {
							return { help: 'Invalid credentials' };
						}
						
						var user = result[0];
						
						return { msg: 'user retrieved', token: this.genUserToken(user) };
						
					}
					
					return sc.handleQuery.call(this, params);
				}
			}; }
		});
		
		ret.queryHandler = new CreativityApp({ name: 'app',
			children: [
				new qd.QGen({ name: 'users',
					_schema: U.addSerializable({
						name: 'creativity.usersSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							username:	new qd.QSchema({ c: qd.QString, p: { name: 'username', 	value: '' } }),
							password:	new qd.QSchema({ c: qd.QString, p: { name: 'password', 	value: '' } }),
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.usersInitChild',
						value: function(child, params /* username, password */) {
							var username = U.param(params, 'username');
							var password = U.param(params, 'password');
							child.getChild('username').setValue(username);
							child.getChild('password').setValue(password);
						}
					}),
					prop: 'username/value'
				}),
				new qd.QGen({ name: 'blurbs',
					_schema: U.addSerializable({
						name: 'creativity.blurbSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							user: new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
							text: new qd.QSchema({ c: qd.QString, p: { name: 'text', minLen: 1, maxLen: 140, value: '' } })
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.blurbInitChild',
						value: function(child, params /* username, text */) {
							var username = U.param(params, 'username');
							var text = U.param(params, 'text');
							
							child.setValue('user', 'app.users.' + username); // Set the reference
							child.setValue('text', text);
						}
					}),
					prop: 'id/value'
				}),
				new qd.QGen({ name: 'votables',
					_schema: U.addSerializable({ name: 'creativity.votableSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: 	new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							blurb: 	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({ name: 'creativity.votablesInitChild',
						value: function(child, params /* blurb */) {
							var blurb = U.param(params, 'blurb');
							child.setValue('blurb', blurb);
						}
					}),
					prop: 'id/value'
				}),
				new qd.QGen({ name: 'votes',
					_schema: U.addSerializable({ name: 'creativity.voteSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id:		 new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							user:	 new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
							votable: new qd.QSchema({ c: qd.QRef, p: { name: 'votable', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({ name: 'creativity.votesInitChild',
						value: function(child, params /* user, votable */) {
							var user = U.param(params, 'user');
							var votable = U.param(params, 'votable');
							child.setValue('user', user);
							child.setValue('votable', votable);
						}
					}),
					prop: 'user.username/value'
				}),
				new qd.QGen({ name: 'storyItems',
					_schema: U.addSerializable({
						name: 'creativity.storyItemSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: 	new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							blurb:	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.storyItemsInitChild',
						value: function(child, params /* blurb */) {
							var blurb = U.param(params, 'blurb');
							child.setValue('blurb', blurb);
						}
					}),
					prop: 'id/value'
				})
			]
		});
		
		return ret;
	},
	runAfter: function() {
		
		var c = PACK.creativity;
		var root = c.queryHandler;
		
		if (!U.isServer()) {
			
			var e = PACK.e.e;
		
			var scene = new PACK.e.RootScene({ name: 'root', title: 'root',
				build: function(rootElem, subsceneElem) {
					rootElem.append(subsceneElem.main);
				},
				subscenes: {
					main: [
						new PACK.e.Scene({ name: 'login', title: 'Login',
							build: function(rootElem, subsceneElem, scene) {
								
								var title = e('<h1>Creativity</h1>');
								
								var credentials = e('<div class="input-form credentials"></div>');
								
								var usernameField = e('<div class="input-field username"></div>');
								usernameField.append('<div class="label">Username</div>');
								usernameField.append('<input type="text"/>');
								
								var passwordField = e('<div class="input-field password"></div>');
								passwordField.append('<div class="label">Password</div>');
								passwordField.append('<input type="password"/>');
								
								var submit = e('<div class="submit"><div class="content">Submit</div><div class="error"></div></div>');
								submit.handle('click', function() {
									console.log('DOING TOKEN REQUEST', { command: 'getToken', params: {
										username: usernameField.find('input').fieldValue(),
										password: passwordField.find('input').fieldValue()
									}});
									
									root.$request({ command: 'getToken', params: {
										username: usernameField.find('input').fieldValue(),
										password: passwordField.find('input').fieldValue()
									}, onComplete: function(response) {
										console.log('TOKEN RESPONSE', response);
										
										if ('help' in response) {
											submit.find('.error').setHtml(response.help);
											submit.listAttr({ class: '+error' });
											setTimeout(function() { submit.listAttr({ class: '-error' }) }, 2000);
										} else {
											scene.par.setSubscene('main', 'writing');
										}
									}});
								});
								
								var spin = e('<div class="spin"></div>');
								spin.append(U.rng(20).map(function(i) { return '<div class="spinner"><div class="dash"></div></div>'; }));
								
								credentials.append([ usernameField, passwordField, submit, spin ]);
								
								rootElem.append(title);
								rootElem.append(credentials);
								
								return {};
							}
						}),
						new PACK.e.Scene({ name: 'writing', title: 'Writing',
							build: function(rootElem, subsceneElem) {
								
								var story = e('<div class="writing-elem story"></div>');
								var storyScroller = story.append('<div class="scroller"></div>');
								
								var voting = e('<div class="writing-elem voting"></div>');
								var votingScroller = voting.append('<div class="scroller"></div>');
								
								var writing = e('<div class="writing-elem writing"></div>');
								writing.append([
									'<div class="input-form">',
										'<div class="input-field">',
											'<textarea></textarea>',
										'</div>',
									'</div>'
								].join(''));
								
								var updateStory = new PACK.quickDev.QUpdate({
									request: function(callback) {
										root.getChild('storyItems').$load({ onComplete: function(elem) {
											
											var count = 0;
											var blurbs = [];
											var gotBlurb = function(id, username, text) {
												count++;
												blurbs.push({ id: id, username: username.split('.')[2], text: PACK.htmlText.render(text) });
												
												if (count === elem.length) {
													blurbs.sort(function(b1, b2) { return b1.id - b2.id });
													callback(blurbs);
												}
											};
											
											for (var k in elem.children) {
												var storyItem = elem.children[k];
												storyItem.$getChild({ address: 'blurb', addChild: true, useClientSide: true, onComplete: function(blurbRef) {
													blurbRef.$getRef({
														useClientValue: true,
														addRef: false,
														recurse: true,
														onComplete: function(elem) {
															gotBlurb(elem.getChild('id').value, elem.children['user'].value, elem.getChild('text').value);
														}
													});
												}});
											}
											
										}});
									},
									start: function() {
										story.listAttr({ class: [ '+loading' ] });
									},
									end: function(storyData) {
										storyScroller.clear();
										storyScroller.append(storyData.map(function(storyItem) {
											return e([
												'<div class="story-item">',
													'<div class="id">' + storyItem.id + '</div>',
													'<div class="text">' + storyItem.text + '</div>',
													'<div class="user">' + storyItem.username + '</div>',
												'</div>'
											].join(''));
										}));
										
										story.listAttr({ class: [ '-loading' ] });
									}
								});
								updateStory.repeat({ delay: 3000 });
								
								var updateVotables = new PACK.quickDev.QUpdate({
									request: function(callback) {
										
										root.getChild('votables').$load({ onComplete: function(elem) {
											
											var count = 0;
											var votables = [];
											var gotVotable = function(username, text, votes) {
												count++;
												votables.push({ username: username.split('.')[2], text: PACK.htmlText.render(text), votes: votes.map(function(o) { return o.name; }) });
												
												if (count === elem.length) {
													votables.sort(function(b1, b2) { return b2.votes.length - b1.votes.length; });
													callback(votables);
												}
											};
											
											for (var k in elem.children) {
												
												var votable = elem.children[k];
												var blurb = votable.$getChild({ address: 'blurb', addChild: true, useClientSide: true, onComplete: function(blurbRef) {
													blurbRef.$getRef({
														useClientValue: true,
														addRef: false,
														recurse: true,
														onComplete: function(blurb) {
															var votable = blurbRef.par;
															
															// Select each vote whose votable references the blurb
															root.getChild('votes').$filter({
																filter: { i: { votable: { p: { value: votable.getAddress() } } } },
																addChildren: false,
																onComplete: function(elems) {
																	gotVotable(blurb.children['user'].value, blurb.getChild('text').value, elems);
																}
															});
														}
													});
												}});
												
											}
											
										}});
										
									},
									start: function() {
										voting.listAttr({ class: [ '+loading' ] });
									},
									end: function(votableData) {
										votingScroller.clear();
										votingScroller.append(votableData.map(function(votableItem) {
											var elem = e([
												'<div class="votable-item">',
													'<div class="check"></div>',
													'<div class="text">' + votableItem.text + '</div>',
													'<div class="user">' + votableItem.username + '</div>',
												'</div>'
											].join(''));
											
											var votes = elem.append('<div class="votes"></div>');
											votes.append(votableItem.votes.map(function(vote) {
												return e('<div class="vote">' + vote + '</div>');
											}));
											
											return elem;
										}));
										
										voting.listAttr({ class: [ '-loading' ] });
									},
								});
								updateVotables.run();
								//updateVotables.repeat({ delay: 1000 });

								var submit = writing.find('.input-form').append('<div class="submit">Submit</div>');
								
								submit.handle('click', function() {
									console.log('Submitted story item!');
								});
								
								rootElem.append([ story, voting, writing ]);
								
							}
						})
					]
				},
				defaultScenes: { main: 'login' }
			});
			
			scene.go();
			
		} else {
			
			var userData = {
				ari: 		'ari117',
				daniel: 	'daniel228',
				gershom: 	'gershom331',
				levi: 		'levi443',
				yehuda: 	'yehuda556'
			};
			var users = root.getChild('users');
			for (var k in userData) users.getNewChild({ username: k, password: userData[k] });
			
			var blurbData = [
				[	'ari',		'1 Skranula looked upon the mountain.' ],
				[	'gershom',	'2 Hello my name is Tim.' ],
				[	'daniel',	'3 I love gogreens SO MUCH.' ],
				[	'yehuda', 	'4 WTF MANG LOLLLL' ],
				[	'levi',		'5 HAHAHA' ],
				[	'ari',		'6 srsly HAHA' ],
				[	'daniel',	'7 man lol I KNOW AHAH LAAOLLOL' ],
				[	'yehuda',	'8 lol' ],
				[	'levi',		'9 huehue HAHA LAOWLA' ],
				[	'gershom',	'10 LOLOL' ],
				[	'yehuda',	'11 HAHA WHAT IS THE JOKE THO' ],
				[	'daniel',	'12 DUNNO BUT IT funny.' ],
				[	'gershom',	'13 I lol\'d one time ahah.' ],
				[	'levi',		'14 bro you LYING you loled SEVERAL -' ],
				[	'yehuda',	'15 - TIMES.' ],
				[	'levi',		'16 DAWG DON\'T FINISH MY SENTENCES FKIN BISH ASS BISH' ]
			];
			var blurbs = root.getChild('blurbs');
			blurbData.forEach(function(data) {
				blurbs.getNewChild({ username: data[0], text: data[1] });
			});
			
			var taken = {};
			var children = blurbs.children;
			
			var toVote = [];
			var toStory = [];
			
			for (var k in children) {
				var username = children[k].children.user.value;
				if (username in taken) {
					toStory.push(children[k]);
				} else {
					toVote.push(children[k]);
					taken[username] = true;
				}
			}
			
			var votables = root.getChild('votables');
			toVote.forEach(function(blurb) {
				votables.getNewChild({ blurb: blurb });
			});
			
			var storyItems = root.getChild('storyItems');
			toStory.forEach(function(blurb) {
				storyItems.getNewChild({ blurb: blurb });
			});
			
			var votes = root.getChild('votes');
			votes.getNewChild({ user: users.getChild('ari'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('levi'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('daniel'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('gershom'), votable: votables.getChild('3') });
			
			/*[
				{ },
				{ i: { votable: { p: { value: 'app.votables.3' } } } }
			].forEach(function(filter, i) {
				console.log(i, votes.filterChildren(filter).map(function(o) { return o.simplified(); }));
			});*/
		}
		
	}
});
package.build();
