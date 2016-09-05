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
				votableRanking: function() {
					// Turn each votable into an object that contains the votable, and the number
					// of votes that votable has received.
					var votes = this.getChild('votes');
					var ret = U.arr(this.getChild('votables').children.map(function(votable) {
						return {
							votable: votable,
							numVotes: votes.filter({ 'votable/value': votable.getAddress() }).length
						};
					}));
					ret.sort(function(v1, v2) { return v2.numVotes - v1.numVotes; });
					return ret;
				},
				resolveVote: function() {
					// This function picks the winning votable and adds it to the story
					clearTimeout(this.resolutionTimeoutRef);
					
					var ranking = this.votableRanking();
					if (ranking.length === 0) {
						console.log('This shouldn\'t happen - resolution, but no votables??');
						return;
					}
					
					var tieAmount = ranking[0].numVotes;
					var tied = [];
					for (var i = 0, len = ranking.length; i < len; i++) {
						if (ranking[i].numVotes >= tieAmount) tied.push(ranking[i].votable);
						else break; // They're ordered so as soon as one is below tieAmount, all the rest will be
					}
					
					// Break the tie randomly
					var ind = Math.floor(Math.random() * tied.length);
					this.getChild('storyItems').getNewChild({ blurb: tied[ind].getChild('@blurb') });
					
					// Reset timer, clear votables and votes
					this.getChild('resolutionTimer.startedMillis').value = -1;
					this.getChild('votables').clear();
					this.getChild('votes').clear();
				},
				handleQuery: function(params) {
					var com = U.param(params, 'command');
					var reqParams = U.param(params, 'params', {});
					
					if (com === 'getToken') {
						
						var username = U.param(reqParams, 'username');
						var password = U.param(reqParams, 'password');
						
						var user = this.getChild('users').filter({
							'username/value': username,
							'password/value': password
						}, true);
						
						if (user === null) return { help: 'Invalid credentials' };
						
						return { msg: 'user retrieved', token: this.genUserToken(user), username: user.getChild('username').value };
						
					} else if (com === 'submitVote') {
						
						var token = U.param(reqParams, 'token');
						var voteeUsername = U.param(reqParams, 'voteeUsername'); // This is who to vote for
						
						var users = this.getChild('users');
						var votables = this.getChild('votables');
						var votes = this.getChild('votes');
						
						var user = this.getUserFromToken(token);
						// Ensure the token is valid
						if (user === null) return { code: 1, msg: 'bad token' };
						// Ensure the user hasn't already voted
						if (votes.filter({ 'user/value': user.getAddress() }, true) !== null) return { code: 1, msg: 'already voted' };
						
						var votee = users.getChild(voteeUsername);
						// Ensure the user being voted for actually exists
						if (votee === null) return { code: 1, msg: 'invalid vote-for username' };
						
						var votable = votables.filter({ '@blurb.user/value': votee.getAddress() }, true);
						// Ensure the user being voted for has actually published a votable
						if (votable === null) return { code: 1, msg: 'user hasn\'t submitted a votable' };
						
						// Create the new vote
						var vote = votes.getNewChild({ user: user, votable: votable });
						var maxVotes = users.length;
						var votesRemaining = maxVotes - votes.length;
						
						if (votesRemaining <= 0) {
							
							// Resolution from everyone voting
							console.log('Everyone voted! Resolving.');
							this.resolveVote();
							
						} else {
							
							// Resolution because there aren't enough votes left to bump 2nd place above 1st
							var ranking = this.votableRanking();
							
							console.log('RANKING', ranking);
							
							if (ranking.length === 1 && ranking[0].numVotes > Math.floor(maxVotes / 2)) {
								
								// There's only 1 votable with more than half the votes
								console.log('The only votable has won the vote! Resolving.');
								this.resolveVote();
								
							} else if (ranking.length > 1 && ranking[0].numVotes > (ranking[1].numVotes + votesRemaining)) {
								
								// The #1 votable can't be overtaken by the #2 votable
								console.log('The winner has become evident early! Resolving.');
								this.resolveVote();
								
							}
							
						}
						
						return { vote: vote.schemaParams() };
						
					} else if (com === 'submitVotable') {
						
						var token = U.param(reqParams, 'token');
						var text = U.param(reqParams, 'text');
						
						if (text.length > 140) return { code: 1, msg: 'text too long (140 char limit)' };
						
						var user = this.getUserFromToken(token);
						if (user === null) return { code: 1, msg: 'bad token' };
						
						var votable = this.children['votables'].filter({ 'user/value': user.getAddress() }, true);
						if (votable !== null) return { code: 1, msg: 'already submitted' };
						
						var blurb = this.children['blurbs'].getNewChild({ username: user.getChild('username').value, text: text });
						var votable = this.children['votables'].getNewChild({ blurb: blurb });
						
						if (this.children['votables'].length === 1) {
							// Got the 1st votable in the resolution. Start timer!
							var pass = this;
							this.getChild('resolutionTimer.startedMillis').setValue(+new Date());
							this.resolutionTimeoutRef = setTimeout(function() {
								pass.resolveVote();
							}, this.getChild('resolutionTimer.delaySeconds').value * 1000); // The value is in minutes; convert to seconds
						}
						
						return {
							votable: votable.schemaParams()
						};
						
					} else if (com === 'resolutionTimeRemaining') {
						
						var startedMillis = this.getChild('resolutionTimer.startedMillis').value;
						
						if (startedMillis === -1) {
							var seconds = null;
						} else {
							var delaySecs = this.getChild('resolutionTimer.delaySeconds').value;
							var timeDiff = (+new Date()) - startedMillis;
							var seconds = delaySecs - Math.round(timeDiff / 1000);
						}
						
						return { seconds: seconds };
						
					} else if (com === 'resolutionVoterData') {
						
						return {
							totalVoters: this.getChild('users').length,
							voters: this.getChild('votes').length
						};
						
					} else if (com === 'write') {
						
						DB.collections('apps').save({ _id: 'creativity', data: content });
						return { msg: 'writing commenced!' };
						
					} else if (com === 'read') {
						
						// TODO: Need an ability to do asynch response
						
						return {
							msg: 'got file',
							content: content
						};
						
					}
					
					return sc.handleQuery.call(this, params);
				}
			}; }
		});
		
		ret.queryHandler = new CreativityApp({ name: 'app',
			children: [
				new qd.QDict({ name: 'resolutionTimer',
					children: [
						new qd.QInt({ name: 'startedMillis', value: -1 }),
						new qd.QInt({ name: 'delaySeconds', value: 60 * 60 * 24 }),
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
					prop: '@user.username/value'
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
									}}).fire(function(response) {
										auth.token = response.token;
										auth.username = response.username;
										
										if ('help' in response) {
											submit.find('.error').setHtml(response.help);
											submit.listAttr({ class: '+error' });
											setTimeout(function() { submit.listAttr({ class: '-error' }) }, 2000);
										} else {
											scene.par.setSubscene('main', 'writing');
										}
									});
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
										'<div class="title"></div>',
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
										
										// TODO: There are still nested queries here, try to improve?
										root.getChild('storyItems').$load().fire(function(elem) {
											
											new PACK.queries.PromiseQuery({
												subQueries: U.arr(elem.children.map(function(c) {
													// TODO: Need to investigate implications of "addChild" and "useClientSide"
													// using the new @-flag and Query architecture
													return c.$getChild({ address: '@blurb', addChild: false, useClientSide: false });
												}))
											}).fire(function(elems) {
												callback(elems.map(function(elem) {
													return {
														id: elem.getChild('id').value,
														username: elem.getChild('user').value.split('.')[2],
														text: PACK.htmlText.render(elem.getChild('text').value)
													};
												}))
											});
											
										});
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
										new PACK.queries.PromiseQuery({
											subQueries: [
												root.$request({ command: 'resolutionTimeRemaining' }),
												root.$request({ command: 'resolutionVoterData' })
											]
										}).fire(function(responses) {
											callback({
												seconds: responses[0].seconds,
												totalVoters: responses[1].totalVoters,
												voters: responses[1].voters
											});
										});
									},
									start: function() {},
									end: function(endData) {
										var t = endData.seconds;
										
										var countdown = resolution.find('.countdown');
										if (t === null) {
											countdown.find('.hour').text('--');
											countdown.find('.minute').text('--');
											countdown.find('.second').text('--');
											resolution.find('.title').text('Stalled.');
										} else {
											var hours = Math.floor(t / 3600);
											t -= hours * 3600;
											var minutes = Math.floor(t / 60);
											t -= minutes * 60;
											var seconds = Math.floor(t);
											
											countdown.find('.hour').text(hours.toString().padLeft(2, '0'));
											countdown.find('.minute').text(minutes.toString().padLeft(2, '0'));
											countdown.find('.second').text(seconds.toString().padLeft(2, '0'));
											resolution.find('.title').text('Counting...');
										}
										
										var votes = resolution.find('.votes');
										votes.find('.voted').text(endData.voters);
										votes.find('.total').text(endData.totalVoters);
									}
								});
								updateTimer.repeat({ delay: 1000 });
								
								var updateVotables = new PACK.quickDev.QUpdate({
									request: function(callback) {
										
										root.getChild('votables').$load().fire(function(elem) {
											
											new PACK.queries.PromiseQuery({
												subQueries: U.arr(elem.children.map(function(votable) {
													return new PACK.queries.PromiseQuery({
														subQueries: [
															votable.$getChild({ address: '@blurb', addChild: false, useClientSide: false }),
															root.getChild('votes').$filter({
																filter: { 'votable/value': votable.getAddress() },
																addChildren: false
															})
														]
													});
												}))
											}).fire(function(responses) {
												callback(responses.map(function(response) {
													var blurb = response[0];
													var votes = response[1];
													
													return {
														username: blurb.getChild('user').value.split('.')[2],
														text: PACK.htmlText.render(blurb.getChild('text').value),
														votes: votes.map(function(vote) { return vote.name; })
													}
												}));
											});
											
										});
										
									},
									start: function() {
										voting.listAttr({ class: [ '+loading' ] });
									},
									end: function(votableData) {
										var existingVotables = {};
										var votableElems = voting.find('.scroller').children();
										votableElems.elems.forEach(function(elem) {
											elem = e(elem);
											var username = elem.find('.user').text();
											existingVotables[username] = elem;
										});
										
										votableData.forEach(function(votableItem) {
											var username = votableItem.username;
											
											if (username in existingVotables) {
												var elem = existingVotables[username];
												delete existingVotables[username];
											} else {
												var elem = e([
													'<div class="votable-item">',
														'<div class="check"></div>',
														'<div class="text">' + votableItem.text + '</div>',
														'<div class="user">' + votableItem.username + '</div>',
														'<div class="votes"></div>',
													'</div>'
												].join(''));
												
												elem.find('.check').handle('click', function() {
													voting.listAttr({ class: [ '+loading' ] });
													root.$request({
														command: 'submitVote',
														params: {
															voteeUsername: elem.find('.user').text(),
															token: auth.token
														}
													}).fire(function(result) {
														console.log(result);
														updateVotables.run();
													});
												});
												
												votingScroller.append(elem);
											}
											
											var votes = elem.find('.votes');
											votes.clear();
											votes.append(votableItem.votes.map(function(vote) {
												return e('<div class="vote">' + vote + '</div>');
											}));
											
											if (votableItem.votes.contains(auth.username)) {
												// TODO: If votes can be retracted, this needs to change
												votingScroller.listAttr({ class: [ '+voted' ] });
												elem.listAttr({ class: [ '+voted' ] });
											}
										});
										
										// Anything remaining in existingVotables should be removed
										existingVotables.forEach(function(votableElem) {
											console.log('REMOVE', votableElem);
											votableElem.remove();
										});
										
										voting.listAttr({ class: [ '-loading' ] });
									},
								});
								updateVotables.repeat({ delay: 3000 });
								
								var updateWriting = new PACK.quickDev.QUpdate({
									request: function(callback) {
										root.getChild('votables').$filter({
											filter: { '@blurb.@user.username/value': auth.username },
											addChildren: false
										}).fire(function(elems) {
											// Active only if there is no existing votable elem
											callback(elems.length === 0);
										});
									},
									start: function() {},
									end: function(active) {
										writing.listAttr({ class: [ (active ? '-' : '+') + 'disabled' ] });
										updateVotables.run();
									}
								});
								updateWriting.repeat({ delay: 1500 });

								var submit = writing.find('.input-form').append('<div class="submit">Submit</div>');
								submit.handle('click', function() {
									writing.listAttr({ class: [ '+disabled' ] });
									var textarea = writing.find('textarea');
									root.$request({
										command: 'submitVotable',
										params: {
											token: auth.token,
											text: textarea.fieldValue()
										}
									}).fire(function(response) {
										textarea.fieldValue('');
										updateVotables.run();
									});
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
				daniel: 	'daniel228',
				ari: 		'ari117',
				gershom: 	'gershom331',
				levi: 		'levi443',
				yehuda: 	'yehuda556'
			};
			var users = root.getChild('users');
			for (var k in userData) users.getNewChild({ username: k, password: userData[k] });
			
			/*
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
			
			var storyItems = root.getChild('storyItems');
			toStory.forEach(function(blurb) { storyItems.getNewChild({ blurb: blurb }); });
			
			var votables = root.getChild('votables');
			toVote.slice(2, 4).forEach(function(blurb) { votables.getNewChild({ blurb: blurb }); });
			
			
			var votes = root.getChild('votes');
			votes.getNewChild({ user: users.getChild('ari'), votable: votables.getChild('1') });
			votes.getNewChild({ user: users.getChild('ari'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('levi'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('daniel'), votable: votables.getChild('2') });
			votes.getNewChild({ user: users.getChild('gershom'), votable: votables.getChild('3') });*/
		}
		
	}
});
package.build();
