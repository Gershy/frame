/*
TODO: Need a way to issue high-level restrictions/behaviours that will apply
to both client and server side. E.g. Right now users shouldn't vote if they
haven't submitted a votable - but need to do totally separate checks for
the client and server in order to validate.
*/
var package = new PACK.pack.Package({ name: 'creativity',
	dependencies: [ 'quickDev', 'htmlText' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/creativity/style.css' ] }
		};
		
		var CreativityApp = PACK.uth.makeClass({ name: 'CreativityApp',
			superclassName: 'QDict',
			methods: function(sc, c) { return {
				init: function(params /* */) {
					sc.init.call(this, params);
					
					this.resolutionTimeoutRef = null;
				},
				getState: function(cb) {
					if (DB === null) { cb(null); return; }
					
					DB.collection('apps', function(err, collection) {
						collection.find({ name: 'creativity' }).limit(1).next(function(err, doc) {
							cb(doc !== null ? doc.data : null);
						});
					});
				},
				setState: function(state, cb) {
					if (DB === null) { if(cb) cb(null); return; }
					
					DB.collection('apps', function(err, collection) {
						collection.update({ name: 'creativity' }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
							if (cb) cb(doc.result);
						});
					});
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
				handleQuery: function(params, /* command, params */ onComplete) {
					var com = U.param(params, 'command');
					var reqParams = U.param(params, 'params', {});
					
					if (com === 'getToken') {
						/*
						Returns the token and username for the user. Because of the
						nature of the app, it's also useful to return whether or not
						the user has already submitted a votable for the current
						round because the very first screen the user sees is based
						on this.
						*/
						var username = U.param(reqParams, 'username');
						var password = U.param(reqParams, 'password');
						
						var user = this.getChild('users').filter({
							'username/value': username,
							'password/value': password
						}, true);
						
						if (user === null) return { help: 'Invalid credentials' };
						
						onComplete({
							msg: 'user retrieved',
							token: this.genUserToken(user),
							username: user.getChild('username').value,
							hasSubmitted: this.getChild('votables').filter({ '@blurb.user/value': user.getAddress() }, true) !== null
						});
						return;
						
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
						
						onComplete({ vote: vote.schemaParams() });
						return;
						
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
						
						onComplete({ votable: votable.schemaParams() });
						return;
						
					} else if (com === 'resolutionTimeRemaining') {
						
						var startedMillis = this.getChild('resolutionTimer.startedMillis').value;
						
						if (startedMillis === -1) {
							var seconds = null;
						} else {
							var delaySecs = this.getChild('resolutionTimer.delaySeconds').value;
							var timeDiff = (+new Date()) - startedMillis;
							var seconds = delaySecs - Math.round(timeDiff / 1000);
						}
						
						onComplete({ seconds: seconds });
						return;
						
					} else if (com === 'resolutionVoterData') {
						
						onComplete({
							totalVoters: this.getChild('users').length,
							voters: this.getChild('votes').length
						});
						return;
						
					} else if (com === 'write') {
						
						var content = U.param(reqParams, 'content');
						
						this.setState(content, function(state) {
							onComplete({ msg: 'write complete', state: state });
						});
						return;
						
					} else if (com === 'read') {
						
						this.getState(function(state) {
							onComplete({ msg: 'read complete', content: state });
						});
						return;
						
					}
					
					sc.handleQuery.call(this, params, onComplete);
				}
			}; }
		});
		
		ret.queryHandler = new CreativityApp({ name: 'app', children: [
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
		]});
		
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
										auth.update({
											token: response.token,
											username: response.username
										});
										
										if ('help' in response) {
											// Need to actually show user error
											submit.find('.error').setHtml(response.help);
											submit.listAttr({ class: '+error' });
											setTimeout(function() { submit.listAttr({ class: '-error' }) }, 2000);
										} else {
											var writingScene = scene.par.subscenes.main.writing;
											writingScene.defaultScenes.contribute = response.hasSubmitted ? 'vote' : 'write';
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
								
								var story = e('<div class="story"></div>');
								var storyScroller = story.append('<div class="scroller"></div>');
								
								var resolution = e([
									'<div class="resolution">',
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
								
								var listStory = new PACK.e.ListUpdater({
									root: storyScroller,
									elemCreate: function(storyItem) {
										return e([
											'<div class="story-item">',
												'<div class="id">' + storyItem.id + '</div>',
												'<div class="text">' + storyItem.text + '</div>',
												'<div class="user">' + storyItem.username + '</div>',
											'</div>'
										].join(''));
									},
									getElemKey: function(elem) { return elem.find('.id').text(); },
									getDataKey: function(data) { return data.id; }
								});
								var updateStory = new PACK.quickDev.QUpdate({
									request: function(callback) {
										
										// TODO: There are still nested queries here, try to improve?
										root.getChild('storyItems').$load().fire(function(elem) {
											
											new PACK.queries.PromiseQuery({
												subQueries: U.arr(elem.children.map(function(c) {
													// TODO: Need to investigate implications of "addChild" and "useClientSide"
													// using the new @-flag and *Query architecture
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
										listStory.updateList(storyData);
										story.listAttr({ class: [ '-loading' ] });
									}
								});
								updateStory.repeat({ delay: 3000 });
								
								var updateTimer = new PACK.quickDev.QUpdate({
									request: function(callback) {
										new PACK.queries.PromiseQuery({ subQueries: [
											root.$request({ command: 'resolutionTimeRemaining' }),
											root.$request({ command: 'resolutionVoterData' })
										]}).fire(function(responses) {
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
								
								rootElem.append([ story, resolution, subsceneElem.contribute ]);
								
							},
							subscenes: {
								contribute: [
									new PACK.e.Scene({ name: 'write', title: 'Write',
										build: function(rootElem, subsceneElem, scene) {
											/*var updateWriting = new PACK.quickDev.QUpdate({
												request: function(callback) {
													root.getChild('votables').$filter({
														filter: { '@blurb.@user.username/value': auth.username },
														addChildren: false
													}).fire(function(elems) {
														// Active only if there is no existing votable elem
														callback({ moveToVoting: elems.length > 0 });
													});
												},
												start: function() {},
												end: function(d) {
													if (d.moveToVoting) {
														
													}
												}
											});*/
											
											var form = e([
												'<div class="input-form">',
													'<div class="input-field">',
														'<textarea></textarea>',
													'</div>',
													'<div class="submit"><span>Submit</span></div>',
												'</div>'
											].join(''));
											
											form.find('textarea').handle([ 'change', 'keyup' ], function(textarea) {
												var val = textarea.fieldValue();
												if (val.length > 140) textarea.fieldValue(val.substr(0, 140));
											});
											
											form.find('.submit').handle('click', function() {
												form.listAttr({ class: [ '+disabled' ] });
												root.$request({
													command: 'submitVotable',
													params: {
														token: auth.token,
														text: form.find('textarea').fieldValue()
													}
												}).fire(function(response) {
													scene.par.setSubscene('contribute', 'vote');
												});
											});
											
											rootElem.append(form);
											
											return { form: form };
										},
										start: function(d) {
											d.form.listAttr({ class: [ '-disabled' ] });
											d.form.find('textarea').fieldValue('');
										},
										/*end: function(d) { d.updater.endRepeat(); },*/
									}),
									new PACK.e.Scene({ name: 'vote', title: 'Vote',
										build: function(rootElem, subsceneElem, scene) {
											var scroller = e('<div class="scroller"></div>');
											
											var listVotables = new PACK.e.ListUpdater({
												root: scroller,
												elemCreate: function(votableItem) {
													var elem = e([
														'<div class="votable-item">',
															'<div class="check"></div>',
															'<div class="text">' + votableItem.text + '</div>',
															'<div class="user">' + votableItem.username + '</div>',
															'<div class="votes"></div>',
														'</div>'
													].join(''));
													
													elem.find('.check').handle('click', function() {
														rootElem.listAttr({ class: [ '+loading' ] });
														root.$request({
															command: 'submitVote',
															params: {
																voteeUsername: elem.find('.user').text(),
																token: auth.token
															}
														}).fire(function(result) {
															updateVotables.run();
														});
													});
													
													return elem;
												},
												elemUpdate: function(elem, votableItem) {
													
													var clientVote = true;
													var votes = elem.find('.votes');
													votes.clear();
													votes.append(votableItem.votes.map(function(vote) {
														if (vote === auth.username) {
															var display = 'you!';
															clientVote = true;
														} else {
															var display = 'anon';
															clientVote = false;
														}
														return e('<div class="vote">' + /*vote*/ display + '</div>');
													}));
													
													if (clientVote) {
														scroller.listAttr({ class: [ '+voted' ] });
														elem.listAttr({ 	class: [ '+voted' ] });
													}
													
												},
												getElemKey: function(elem) {
													return elem.find('.user').text();
												},
												getDataKey: function(data) {
													return data.username;
												}
											});
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
													rootElem.listAttr({ class: [ '+loading' ] });
												},
												end: function(votableData) {
													listVotables.updateList(votableData);
													
													var gotUserVotable = false;
													for (var i = 0, len = votableData.length; i < len; i++) {
														if (votableData[i].username === auth.username) {
															gotUserVotable = true;
															break;
														}
													}
													
													rootElem.listAttr({ class: [ '-loading' ] });
													
													// The user hasn't submitted a votable... so take them back to writing!
													if (!gotUserVotable) scene.par.setSubscene('contribute', 'write');
												},
											});
											
											rootElem.append(scroller);
											
											return { updater: updateVotables };
										},
										start: function(d) { d.updater.repeat({ delay: 3000 }); },
										end: function(d) { d.updater.endRepeat(); }
									})
								]
							},
							defaultScenes: { contribute: 'vote' }
						})
					]
				},
				defaultScenes: { main: 'login' }
			});
			
			scene.go();
			
		} else {
			
			var users = root.getChild('users');
			var blurbs = root.getChild('blurbs');
			var storyItems = root.getChild('storyItems');
			var votables = root.getChild('votables');
			
			// Initialize all users...
			var userData = {
				daniel: 	'daniel228',
				ari: 		'ari117',
				gershom: 	'gershom331',
				levi: 		'levi443',
				yehuda: 	'yehuda556'
			};
			for (var k in userData) users.getNewChild({ username: k, password: userData[k] });
			
			/*[
				[ 'gershom', 'Howdy.' ],
				[ 'levi', 'My name is Bill,' ],
				[ 'ari', 'but you can call me Reginald the Fourth.' ],
				[ 'yehuda', 'Actually, please do go with Reginald.' ],
				[ 'daniel', 'If you ever call me Bill,' ],
				[ 'gershom', 'even once,' ],
				[ 'levi', 'I mean just even try it you' ],
				[ 'ari', 'fucking little scumbag,' ],
				[ 'yehuda', 'and you will feel the wrath of not only my niece, Egret,' ],
				[ 'daniel', 'but also that of the dangerous Etherlord Waqqagrub.\n\n' ],
				[ 'gershom', 'So just try it.' ],
				[ 'levi', 'I fucking dare you.' ],
				[ 'ari', 'Call me Bill.' ],
				[ 'yehuda', 'Call me Bill you fuckass.' ],
			].forEach(function(d) {
				var blurb = blurbs.getNewChild({ username: d[0], text: d[1] });
				storyItems.getNewChild({ blurb: blurb });
			});*/
			
			/*[
				[ 'levi', 'Hahaha.' ],
				[ 'ari', 'Huehuehuehue.' ],
				[ 'yehuda', 'LOL OWNED.' ],
				[ 'daniel', 'You won\'t, you\'re a pansy!' ],
			].forEach(function(d) {
				var blurb = blurbs.getNewChild({ username: d[0], text: d[1] });
				votables.getNewChild({ blurb: blurb });
			});*/
			
			root.getState(function(state) {
				if (state !== null) {
					var schemaParams = JSON.parse(state);
					var schema = new PACK.quickDev.QSchema(schemaParams);
					
					console.log('Loading saved state...');
					
					schema.assign({
						elem: root,
						recurse: true,
						ha: true,
					});
					
					var startedMillis = root.getChild('resolutionTimer.startedMillis').value;
					if (startedMillis !== -1) {
						
						var target = root.getChild('resolutionTimer.delaySeconds').value;
						var millisRemaining = (target * 1000) - (new Date() - startedMillis);
						
						if (millisRemaining > 0) {
							root.resolutionTimerRef = setTimeout(function() {
								root.resolveVote();
							}, millisRemaining);
						} else {
							root.resolveVote();
						}
						
					}
					
				}
			});
			
			setInterval(function() {
				root.setState(JSON.stringify(root.schemaParams()));
			}, 5000);
			
		}
		
	}
});
package.build();
