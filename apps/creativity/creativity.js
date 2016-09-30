/*
TODO: Need a way to issue high-level restrictions/behaviours that will apply
to both client and server side. E.g. Right now users shouldn't vote if they
haven't submitted a votable - but need to do totally separate checks for
the client and server in order to validate.

TODO: Move the countdown clock into its own app, and use it generate the
times remaining in the lobby rooms list as well as the resolution clock.

TODO: Getting a user from a token is very inefficient

TODO: Growing "vote-power", increases over time, can deplete any amount of
it when voting to increase vote's power.

TODO: Write a subclass for room, implements methods on it instead of on
CreativityApp with "room" parameter
*/
var package = new PACK.pack.Package({ name: 'creativity',
	dependencies: [ 'quickDev', 'htmlText' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		// Add serializables
		(function() {
			U.addSerializable({ name: 'creativity.usersSchema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QString, p: { name: 'username', value: '' } },
					{ c: qd.QString, p: { name: 'password', value: '' } }
				]})
			});
			U.addSerializable({ name: 'creativity.usersInitChild',
				value: function(child, params /* username, password */) {
					var username = U.param(params, 'username');
					var password = U.param(params, 'password');
					child.getChild('username').setValue(username);
					child.getChild('password').setValue(password);
				}
			});
			U.addSerializable({ name: 'creativity.blurbSchema',
				value: new qd.QSchema({ c: qd.QDict, i: {
					id: new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
					user: new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
					text: new qd.QSchema({ c: qd.QString, p: { name: 'text', minLen: 1, maxLen: 140, value: '' } })
				}})
			});
			U.addSerializable({ name: 'creativity.blurbInitChild',
				value: function(child, params /* username, text */) {
					var username = U.param(params, 'username');
					var text = U.param(params, 'text');
					
					child.setValue('user', 'app.users.' + username); // Set the reference
					child.setValue('text', text);
				}
			});
			U.addSerializable({ name: 'creativity.votableSchema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QInt, p: { name: 'id', 	value: 0 } },
					{ c: qd.QRef, p: { name: 'blurb', value: '' } }
				]})
			});
			U.addSerializable({ name: 'creativity.votablesInitChild',
				value: function(child, params /* blurb */) {
					var blurb = U.param(params, 'blurb');
					child.setValue('blurb', blurb);
				}
			});
			U.addSerializable({ name: 'creativity.voteSchema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QInt, p: { name: 'id', value: 0 } },
					{ c: qd.QRef, p: { name: 'user', value: '' } },
					{ c: qd.QRef, p: { name: 'votable', value: '' } }
				]})
			});
			U.addSerializable({ name: 'creativity.votesInitChild',
				value: function(child, params /* user, votable */) {
					var user = U.param(params, 'user');
					var votable = U.param(params, 'votable');
					
					child.setValue('user', user);
					child.setValue('votable', votable);
				}
			});
			U.addSerializable({ name: 'creativity.storyItemSchema',
				value: new qd.QSchema({ c: qd.QDict, i: {
					id: 	new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
					blurb:	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
				}})
			});
			U.addSerializable({ name: 'creativity.storyItemsInitChild',
				value: function(child, params /* blurb */) {
					var blurb = U.param(params, 'blurb');
					child.setValue('blurb', blurb);
				}
			});
		})();
		
		var ret = {
			resources: { css: [ 'apps/creativity/style.css' ] },
			CreativityApp: PACK.uth.makeClass({ name: 'CreativityApp',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					start: function() {
						if (!U.isServer()) throw new Error('Only call this server-side');
						
						var pass = this;
						this.dbUpdate = new qd.QUpdate({
							request: function(cb) { pass.setState(pass.schemaParams(), cb); },
							start: function() {},
							end: function(response) { }
						});
						
						this.resolveUpdate = new qd.QUpdate({
							request: function(cb) {
								pass.tryResolveVotes();
								cb(null);
							},
							start: function() {},
							end: function(response) { }
						});
						
						this.dbUpdate.repeat({ delay: 1500 });
						this.resolveUpdate.repeat({ delay: 1000 });
					},
					step: function() {
						/* Checks to see if resolution needs to be done */
					},
					getState: function(cb) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: 'creativity' }).limit(1).next(function(err, doc) {
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
					getRoomFromQuickName: function(quickName) {
						return this.getChild('rooms.' + quickName);
					},
					getUserFromToken: function(token, room) {
						var users = PACK.creativity.queryHandler.getChild('users');
						for (var k in users.children) {
							var user = users.children[k];
							if (this.genUserToken(user) === token) {
								if (U.exists(room) && room.getChild('users.' + user.name) === null) return null;
								return user;
							}
						}
						return null;
					},
					votableRanking: function(room) {
						// Turn each votable into an object that contains the votable, and the number
						// of votes that votable has received.
						var votes = room.getChild('votes');
						var ret = U.arr(room.getChild('votables').children.map(function(votable) {
							return {
								votable: votable,
								numVotes: votes.filter({ 'votable/value': votable.getAddress() }).length
							};
						}));
						ret.sort(function(v1, v2) { return v2.numVotes - v1.numVotes; });
						return ret;
					},
					timeRemaining: function(room) {
						var startedMillis = room.getChild('startedMillis').value;
						
						if (startedMillis === -1) return null;
						
						var delaySecs = 
							room.getChild('params.roundSubmissionSeconds').value +
							room.getChild('params.roundVoteSeconds').value;
						
						var timeDiff = (+new Date()) - startedMillis;
						return delaySecs - Math.round(timeDiff / 1000);
					},
					tryResolveVotes: function() {
						var rooms = this.getChild('rooms').children;
						
						for (var k in rooms) {
							var room = rooms[k];
							var t = this.timeRemaining(room);
							if (t <= 0) room.getChild('startedMillis').setValue(-1);
							if (room.getChild('votables').length >= 1 && (t === null || t <= 0)) this.resolveVote(room);
						}
					},
					resolveVote: function(room) {
						// This function picks the winning votable and adds it to the story
						var ranking = this.votableRanking(room);
						if (ranking.length === 0) {
							console.log('This shouldn\'t happen - resolution, but no votables??');
							return;
						}
						
						var tieAmount = ranking[0].numVotes;
						var tied = [];
						for (var i = 0, len = ranking.length; i < len; i++) {
							// They're ordered so as soon as one is below tieAmount, all the rest will be
							if (ranking[i].numVotes < tieAmount) break;
							tied.push(ranking[i].votable);
						}
						
						// Break the tie randomly
						var ind = Math.floor(Math.random() * tied.length);
						room.getChild('storyItems').getNewChild({ blurb: tied[ind].getChild('@blurb') });
						
						// Clear votables and votes
						room.getChild('votables').clear();
						room.getChild('votes').clear();
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
							});
							return;
							
						} else if (com === 'joinRoom') {
							
							var token = U.param(reqParams, 'token');
							var quickName = U.param(reqParams, 'quickName');
							
							var user = this.getUserFromToken(token);
							if (user === null) return { code: 1, msg: 'bad token' };
							
							var room = this.getChild('rooms').getChild(quickName);
							if (room === null) return { code: 1, msg: 'invalid quickName' };
							
							var roomUser = room.getChild('users').getChild(user.getChild('username').value);
							if (roomUser === null) {
								if (false /* TODO: max-users check! */) {
									onComplete({ code: 1, msg: 'room is full' });
									return;
								}
								
								console.log('Couldn\'t find "' + user.getChild('username').value + '"; Creating new room user!');
								roomUser = room.getChild('users').getNewChild(user)
							}
							
							onComplete({
								msg: 'joined room!',
								quickName: room.name,
								hasSubmitted: room.getChild('votables').filter({ '@blurb.user/value': user.getAddress() }, true) !== null
							});
							return;
							
						} else if (com === 'submitVote') {
							
							var token = U.param(reqParams, 'token');
							var roomQuickName = U.param(reqParams, 'roomQuickName');
							var voteeUsername = U.param(reqParams, 'voteeUsername'); // This is who to vote for
							
							var room = this.getRoomFromQuickName(roomQuickName);
							if (room === null) return { code: 1, msg: 'bad room' };
							
							var user = this.getUserFromToken(token, room);
							if (user === null) return { code: 1, msg: 'bad token' };
							
							var users = room.getChild('users');
							var votables = room.getChild('votables');
							var votes = room.getChild('votes');
							
							// Ensure the user hasn't already voted
							if (votes.filter({ 'user/value': user.getAddress() }, true) !== null) return { code: 1, msg: 'already voted' };
							
							var votee = users.getChild(voteeUsername);
							if (votee === null) return { code: 1, msg: 'invalid vote-for username' };
							votee = votee.getChild('@user');
							
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
								var ranking = this.votableRanking(room);
								
								if (ranking.length === 1 && ranking[0].numVotes > Math.floor(maxVotes / 2)) {
									
									// There's only 1 votable with more than half the votes
									console.log('The only votable has won the vote! Resolving.');
									this.resolveVote(room);
									
								} else if (ranking.length > 1 && ranking[0].numVotes > (ranking[1].numVotes + votesRemaining)) {
									
									// The #1 votable can't be overtaken by the #2 votable
									console.log('The winner has become evident early! Resolving.');
									this.resolveVote(room);
									
								}
								
							}
							
							onComplete({ vote: vote.schemaParams() });
							return;
							
						} else if (com === 'submitVotable') {
							
							var token = U.param(reqParams, 'token');
							var roomQuickName = U.param(reqParams, 'roomQuickName');
							var text = U.param(reqParams, 'text');
							
							var room = this.getRoomFromQuickName(roomQuickName);
							if (room === null) return { code: 1, msg: 'bad room' };
							
							var user = this.getUserFromToken(token, room);
							if (user === null) return { code: 1, msg: 'bad token' };
							
							if (text.length > 140) return { code: 1, msg: 'text too long (140 char limit)' };
							
							var votables = room.getChild('votables');
							
							var votable = votables.filter({ 'user/value': user.getAddress() }, true);
							if (votable !== null) return { code: 1, msg: 'already submitted' };
							
							var blurb = room.getChild('blurbs').getNewChild({ username: user.getChild('username').value, text: text });
							var votable = votables.getNewChild({ blurb: blurb });
							
							if (votables.length === 1) {
								// Got the 1st votable in the resolution. Start timer!
								room.getChild('startedMillis').setValue(+new Date());
							}
							
							onComplete({ votable: votable.schemaParams() });
							return;
							
						} else if (com === 'resolutionTimeRemaining') {
							
							var roomQuickName = U.param(reqParams, 'roomQuickName');
							var room = this.getRoomFromQuickName(roomQuickName);
							if (room === null) return { code: 1, msg: 'bad room' };
							
							onComplete({ seconds: this.timeRemaining(room) });
							return;
							
						} else if (com === 'resolutionVoterData') {
							
							var roomQuickName = U.param(reqParams, 'roomQuickName');
							var room = this.getRoomFromQuickName(roomQuickName);
							if (room === null) return { code: 1, msg: 'bad room' };
							
							onComplete({
								totalVoters: room.getChild('users').length,
								voters: room.getChild('votes').length
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
			})
		};
		ret.queryHandler = new ret.CreativityApp({ name: 'app', children: [] });
		
		return ret;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		var root = PACK.creativity.queryHandler;
		var e = PACK.e.e;
		
		var auth = { token: null, username: null, room: null };
	
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
										/*
										var writingScene = scene.par.subscenes.main.writing;
										writingScene.defaultScenes.contribute = response.hasSubmitted ? 'vote' : 'write';
										*/
										scene.par.setSubscene('main', 'lobby');
									}
								});
							});
							
							var spin = e('<div class="spin"></div>');
							spin.append(U.rng(20).map(function(i) { return '<div class="spinner"><div class="dash"></div></div>'; }));
							
							credentials.append([ usernameField, passwordField, submit, spin ]);
							
							rootElem.append(title);
							rootElem.append(credentials);
							rootElem.append('<div class="version">Version: 0.0.2 (rooms)</div>');
							
							return {};
						}
					}),
					new PACK.e.Scene({ name: 'lobby', title: 'Lobby',
						build: function(rootElem, subsceneElem, scene) {
							
							var title = e('<div class="title"><span>Rooms</span></div>');
							var rooms = e('<div class="rooms"></div>');
							
							var scroller = rooms.append('<div class="scroller"></div>');
							
							var listRooms = new PACK.e.ListUpdater({
								root: scroller,
								elemCreate: function(roomData) {
									var room = e([
										'<div class="room">',
											'<div class="bg"></div>',
											'<div class="title">',
												'<div class="quick-name">' + roomData.quickName + '</div>',
												'<div class="host">' + roomData.host + '</div>',
												'<div class="story-length">' + roomData.storyLength + '</div>',
											'</div>',
											'<div class="description">' + roomData.description + '</div>',
											'<div class="time-remaining">Round time: ' + roomData.timeRemaining + '</div>',
										'</div>'
									].join(''));
									
									room.handle('click', function() {
										root.$request({	command: 'joinRoom', params: {
											token: auth.token,
											quickName: roomData.quickName
										}}).fire(function(response) {
											auth.room = response.quickName;
											var writingScene = scene.par.subscenes.main.writing;
											writingScene.defaultScenes.contribute = response.hasSubmitted ? 'vote' : 'write';
											scene.par.setSubscene('main', 'writing');
										});
									});
									
									return room;
								},
								elemUpdate: function(elem, roomData) {
									elem.find('.time-remaining').text('Round time: ' + roomData.timeRemaining);
								},
								getElemKey: function(elem) {
									return elem.find('.quick-name').text();
								},
								getDataKey: function(roomData) {
									return roomData.quickName;
								}
							});
							var updateRooms = new PACK.quickDev.QUpdate({
								request: function(callback) {
									root.$getChild({ address: 'rooms', recurse: {
										_: {
											host: true,
											quickName: true,
											description: true,
											params: {
												storyLength: true,
											},
											startedMillis: true,
										}
									}}).fire(function(elem) {
										callback(U.arr(elem.children.map(function(room) { return {
											description: room.getChild('description').value,
											quickName: room.getChild('quickName').value,
											host: room.getChild('host').value.split('.')[2],
											storyLength: room.getChild('params.storyLength').value,
											timeRemaining: room.getChild('startedMillis').value
										};})));
									});
								},
								start: function() {
									rootElem.listAttr({ class: [ '+loading' ] });
								},
								end: function(roomsData) {
									listRooms.updateList(roomsData);
									rootElem.listAttr({ class: [ '-loading' ] });
								}
							});
							
							rootElem.append([ title, rooms ]);
							
							return { updater: updateRooms };
						},
						start: function(d) { d.updater.repeat({ delay: 2000 }); },
						end: function(d) { d.updater.endRepeat(); }
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
									root.$getChild({ address: 'rooms.' + auth.room + '.storyItems', recurse: true }).fire(function(elem) {
										
										elem.name = 'app.rooms.' + auth.room + '.storyItems';
										
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
										root.$request({ command: 'resolutionTimeRemaining', params: { roomQuickName: auth.room } }),
										root.$request({ command: 'resolutionVoterData', params: { roomQuickName: auth.room } })
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
													roomQuickName: auth.room,
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
															token: auth.token,
															roomQuickName: auth.room,
															voteeUsername: elem.find('.user').text()
														}
													}).fire(function(result) {
														updateVotables.run();
													});
												});
												
												return elem;
											},
											elemUpdate: function(elem, votableItem) {
												
												var clientVote = false;
												var votes = elem.find('.votes');
												votes.clear();
												votes.append(votableItem.votes.map(function(vote) {
													var display = 'anon';
													if (vote === auth.username) {
														var display = 'you!';
														clientVote = true;
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
												
												root.$getChild({ address: 'rooms.' + auth.room + '.votables', recurse: true }).fire(function(elem) {
													
													// TODO: This is bad design but without setting "par", the votable
													// doesn't know its root address so it can resolve references
													elem.name = 'app.rooms.' + auth.room + '.votables';
													
													new PACK.queries.PromiseQuery({
														subQueries: U.arr(elem.children.map(function(votable) {
															return new PACK.queries.PromiseQuery({
																subQueries: [
																	votable.$getChild({ address: '@blurb', addChild: false, useClientSide: false }),
																	root.$filter({
																		address: 'rooms.' + auth.room + '.votes',
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
		
	}
});
package.build();
