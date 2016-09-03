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
				init: function(params /* */) {
					sc.init.call(this, params);
					
					this.resolutionTimeoutRef = null;
				},
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
				getUserFromToken: function(token) {
					var users = PACK.creativity.queryHandler.getChild('users');
					for (var k in users.children) {
						var child = users.children[k];
						if (this.genUserToken(child) === token) return child;
					}
					return null;
				},
				resolveVote: function() {
					// This function picks the winning votable and adds it to the story
				},
				handleQuery: function(params) {
					var com = U.param(params, 'command');
					
					var reqParams = U.param(params, 'params');
					
					if (com === 'getToken') {
						
						var username = U.param(reqParams, 'username');
						var password = U.param(reqParams, 'password');
						
						var query = { p: {}, i: {
							username: { p: { value: username } },
							password: { p: { value: password } }
						}};
						var result = this.getChild('users').filterChildren(query);
						
						if (result.length === 0) return { help: 'Invalid credentials' };
						
						var user = result[0];
						return { msg: 'user retrieved', token: this.genUserToken(user), username: user.getChild('username').value };
						
					} else if (com === 'voteFor') {
						
						var token = U.param(reqParams, 'token');
						var username = U.param(reqParams, 'username'); // This is who to vote for
						
						var user = this.getUserFromToken(token);
						if (user === null) return { code: 1, msg: 'bad token' };
						
						var users = this.children['users'];
						if (!(username in users.children)) return { code: 1, msg: 'invalid vote-for username' };
						
						var voteFor = users.children[username];
						var votable = this.children['votables'].filterChildren({ i: { user: { p: { value: voteFor.getAddress() } } } }, true);
						
						if (votable === null) return { code: 1, msg: 'user hasn\'t submitted a votable' };
						
						if (this.children['votes'].filterChildren({ i: { user: { p: { value: user.getAddress() } } } }, true) !== null)
							return { code: 1, msg: 'already voted' };
						
						var vote = this.children['votes'].getNewChild({ user: user, votable: votable });
						
						return {
							voter: user.name,
							votee: voteFor.name,
							votable: votable.getChild('@blurb.text').value,
							vote: vote.schemaParams()
						};
						
					} else if (com === 'submitVotable') {
						
						var token = U.param(reqParams, 'token');
						var text = U.param(reqParams, 'text');
						
						if (text.length > 140) return { code: 1, msg: 'text too long (140 char limit)' };
						
						var user = this.getUserFromToken(token);
						if (user === null) return { code: 1, msg: 'bad token' };
						
						var votable = this.children['votables'].filterChildren({ i: { user: { p: { value: user.getAddress() } } } }, true);
						if (votable !== null) return { code: 1, msg: 'already submitted' };
						
						var blurb = this.children['blurbs'].getNewChild({ username: user.getChild('username').value, text: text });
						var votable = this.children['votables'].getNewChild({ blurb: blurb });
						
						if (this.children['votables'].length === 1) {
							// Got the 1st votable in the resolution. Start timer!
							var pass = this;
							this.getChild('started').setValue(+new Date());
							this.resolutionTimeoutRef = setTimeout(function() {
								pass.resolveVote();
							}, this.getChild('resolutionTimer.started').value * 60000); // The value is in minutes; convert to seconds
						}
						
						return {
							votable: votable.schemaParams()
						};
						
					} else if (com === 'resolutionTimeRemaining') {
						
						var delaySecs = this.getChild('resolutionTimer.delayMins').value * 60;
						var timeDiff = (+new Date()) - this.getChild('resolutionTimer.startedMillis').value;
						
						return { seconds: delaySecs - Math.round(timeDiff / 1000) };
						
					}
					
					return sc.handleQuery.call(this, params);
				}
			}; }
		});
		
		ret.queryHandler = new CreativityApp({ name: 'app',
			children: [
				new qd.QDict({ name: 'resolutionTimer',
					children: [
						new qd.QInt({ name: 'startedMillis', value: (+new Date()) }),
						new qd.QInt({ name: 'delayMins', value: 60 * 24 }),
					]
				}),
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
							user: 	new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
							blurb: 	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({ name: 'creativity.votablesInitChild',
						value: function(child, params /* blurb */) {
							var blurb = U.param(params, 'blurb');
							child.setValue('blurb', blurb);
							// shouldn't be necessary, but intermediate solution
							// for being unable to filter deeper through QRefs
							child.setValue('user', blurb.children['user'].value);
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
			
			var auth = { token: null, username: null };
		
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
									root.$request({ command: 'getToken', params: {
										username: usernameField.find('input').fieldValue(),
										password: passwordField.find('input').fieldValue()
									}, onComplete: function(response) {
										auth.token = response.token;
										auth.username = response.username;
										
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
								
								var resolution = e([
									'<div class="writing-elem resolution">',
										'<div class="title">End in:</div>',
										'<div class="countdown">',
											'<div class="time-component hour">00</div>',
											'<div class="time-component minute">00</div>',
											'<div class="time-component second">00</div>',
										'</div>',
										'<div class="votes">',
											'Votes:<div class="voted">0</div>/<div class="total">0</div>',
										'</div>',
									'</div>'
								].join(''));
								
								var voting = e('<div class="writing-elem voting"></div>');
								var votingScroller = voting.append('<div class="scroller"></div>');
								
								var writing = e([
									'<div class="writing-elem writing">',
										'<div class="input-form">',
											'<div class="input-field">',
												'<textarea></textarea>',
											'</div>',
										'</div>',
									'</div>'
								].join(''));
								
								var updateStory = new PACK.quickDev.QUpdate({
									request: function(callback) {
										
										// TODO: Solve this: We want every "storyItems.!blurb" in root
										// Once it can be specified in a better way, code can be reduced
										
										root.getChild('storyItems').$load({ onComplete: function(elem) {
											
											if (elem.length === 0) { callback([]); return; }
											
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
								
								var updateTimer = new PACK.quickDev.QUpdate({
									request: function(callback) {
										root.$request({ command: 'resolutionTimeRemaining', onComplete: function(response) {
											callback(response.seconds);
										}});
									},
									start: function() {},
									end: function(endData) {
										console.log('SECONDS:', endData.seconds);
										
										var t = endData.seconds;
										var hours = Math.floor(t / 3600);
										t -= hours * 3600;
										var minutes = Math.floor(t / 60);
										console.log(t, minutes, minutes * 60);
										t -= minutes * 60;
										var seconds = Math.floor(t);
										
										// TODO: HERE!
										var countdown = resolution.find('.countdown');
										countdown.find('.hour').text(hours.toString());
										countdown.find('.minute').text(minutes.toString());
										countdown.find('.second').text(seconds.toString());
									}
								});
								updateTimer.repeat({ delay: 1000 });
								
								var updateVotables = new PACK.quickDev.QUpdate({
									request: function(callback) {
										
										root.getChild('votables').$load({ onComplete: function(elem) {
											
											if (elem.length === 0) { callback([]); return; }
											
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
									end: function(votableData, updater) {
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
											
											if (votableItem.votes.contains(auth.username)) {
												votingScroller.listAttr({ class: [ '+voted' ] });
												elem.listAttr({ class: [ '+voted' ] });
											}
											
											elem.find('.check').handle('click', function() {
												var username = elem.find('.user').text();
												voting.listAttr({ class: [ '+loading' ] });
												root.$request({ command: 'voteFor', params: { username: username, token: auth.token }, onComplete: function(result) {
													console.log(result);
													updater.run();
												}});
											});
											
											return elem;
										}));
										
										voting.listAttr({ class: [ '-loading' ] });
									},
								});
								updateVotables.repeat({ delay: 3000 });
								
								var updateWriting = new PACK.quickDev.QUpdate({
									request: function(callback) {
										root.getChild('votables').$filter({
											filter: { i: { user: { p: { value: 'app.users.' + auth.username } } } },
											addChildren: false,
											onComplete: function(elems) {
												// Active only if there is no existing votable elem
												callback(elems.length === 0);
											}
										});
									},
									start: function() {},
									end: function(active) {
										writing.listAttr({ class: [ (active ? '-' : '+') + 'disabled' ] });
										updateVotables.run();
									}
								});
								updateWriting.repeat({ delay: 3000 });

								var submit = writing.find('.input-form').append('<div class="submit">Submit</div>');
								
								submit.handle('click', function() {
									writing.listAttr({ class: [ '+disabled' ] });
									var textarea = writing.find('textarea');
									root.$request({ command: 'submitVotable', params: { token: auth.token, text: textarea.fieldValue() }, onComplete: function(response) {
										textarea.fieldValue('');
										updateVotables.run();
									}});
								});
								
								rootElem.append([ story, resolution, voting, writing ]);
								
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
			/*toVote.forEach(function(blurb) {
				votables.getNewChild({ blurb: blurb });
			});*/
			
			var storyItems = root.getChild('storyItems');
			toStory.forEach(function(blurb) {
				storyItems.getNewChild({ blurb: blurb });
			});
			
			var votes = root.getChild('votes');
			/*votes.getNewChild({ user: users.getChild('ari'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('levi'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('daniel'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('gershom'), votable: votables.getChild('3') });*/
		}
		
	}
});
package.build();
