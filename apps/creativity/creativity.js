/*
TODO: Need a way to issue high-level restrictions/behaviours that will apply
to both client and server side. E.g. Right now users shouldn't vote if they
haven't submitted a votable - but need to do totally separate checks for
the client and server in order to validate.

TODO: Getting a user from a token is very inefficient

TODO: Growing "vote-power", increases over time, can deplete any amount of
it when voting to increase vote's power.

TODO: Write a subclass for room, implements methods on it instead of on
CreativityApp with "room" parameter
*/
var package = new PACK.pack.Package({ name: 'creativity',
	dependencies: [ 'quickDev', 'htmlText', 'clock' ],
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
			versionString: '0.0.4 (rooms)',
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
							request: function(onComplete) {
								pass.setState(pass.schemaParams({
									selection: qd.sel.all
								}), onComplete);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						
						this.resolveUpdate = new qd.QUpdate({
							request: function(onComplete) {
								pass.tryResolveVotes();
								onComplete(null);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						
						this.dbUpdate.repeat({ delay: 1500 });
						this.resolveUpdate.repeat({ delay: 1000 });
					},
					getState: function(onComplete) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { onComplete(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: 'creativity' }).limit(1).next(function(err, doc) {
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
							collection.update({ name: 'creativity' }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
								if (onComplete) onComplete(doc.result);
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
						
						// Clear the timer
						room.getChild('startedMillis').setValue(-1)
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
							
							if (user === null) return onComplete({ help: 'Invalid credentials' });
							
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
								roomUser = room.getChild('users').getNewChild({ user: user })
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
								this.resolveVote(room);
								
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
							
							onComplete({ vote: vote.schemaParams({ selection: PACK.quickDev.sel.all }) });
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
							
							onComplete({ votable: votable.schemaParams({ selection: PACK.quickDev.sel.all }) });
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
							
						} else if (com === 'createRoom') {
							
							var token = U.param(reqParams, 'token');
							var roomParams = U.param(reqParams, 'roomParams');
							
							var user = this.getUserFromToken(token);
							
							var rooms = this.getChild('rooms');
							var userRooms = rooms.filter({ '@host.username/value': user.getChild('username').value });
							var maxRooms = this.getChild('maxRoomsPerUser').value;
							if (userRooms.length >= maxRooms) {
								onComplete({ code: 1, msg: 'User already owns ' + maxRooms + ' rooms; can\'t create another.' });
								return;
							}
							
							var quickName = U.param(roomParams, 'room.quickName');
							if (rooms.getChild(quickName)) {
								onComplete({ code: 1, msg: 'A room with quickName "' + quickName + '" already exists.' });
								return;
							}
							
							try {
								var newRoom = rooms.getNewChild({
									host: user,
									quickName: quickName,
									description: 			U.param(roomParams, 'room.description'),
									storyLength: 			U.param(roomParams, 'room.params.storyLength'),
									submissionLengthMin: 	U.param(roomParams, 'room.params.submissionLengthMin'),
									submissionLengthMax: 	U.param(roomParams, 'room.params.submissionLengthMax'),
									roundSubmissionSeconds: U.param(roomParams, 'room.params.roundSubmissionSeconds'),
									roundVoteSeconds: 		U.param(roomParams, 'room.params.roundVoteSeconds'),
									voteMaximum: 			U.param(roomParams, 'room.params.voteMaximum'),
									submissionMaximum: 		U.param(roomParams, 'room.params.submissionMaximum')
								});
							} catch(e) {
								console.error(e.stack);
								onComplete({ code: 1, msg: 'Error creating room: "' + e.message + '"' });
								return;
							}
							onComplete({ msg: 'created room!', schemaParams: newRoom.schemaParams({ selection: PACK.quickDev.sel.all }) });
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
		var qd = PACK.quickDev;
		var e = PACK.e.e;
		
		var auth = { token: null, username: null, room: null };
		var creativityFormListeners = PACK.e.defaultFormListeners.clone({
			'char-count': {
				start: function(widget, container) {
					container.append('<div class="char-sense"></div>');
				},
				change: function(widget, container) {
					var n = parseInt(widget.fieldValue());
					
					var sense = '';
					if (!isNaN(n)) {
						var words = n / 5.1;
						
						if (words >= 10000000) 		sense = 'Stop lol no one will read this';
						else if (words >= 5000000)	sense = 'Think: absolutely massive epic';
						else if (words >= 1000000)	sense = 'Every Harry Potter book combined';
						else if (words >= 600000) 	sense = 'War and Peace';
						else if (words >= 160000) 	sense = 'A Tree Grows in Brooklyn';
						else if (words >= 100000)	sense = '1984';
						else if (words >= 70000)	sense = 'Think: typical mystery novel';
						else if (words >= 40000)	sense = 'Think: typical novel';
						else if (words >= 25000)	sense = 'Alice in Wonderland';
						else if (words >= 10000)	sense = 'Think: typical thesis';
						else if (words >= 5000)		sense = 'Think: typical short story';
						else if (words >= 1000)		sense = 'Think: typical highschool essay';
						else if (words >= 500)		sense = 'Think: two pages';
						else if (words >= 250)		sense = 'Think: a page';
						else if (words >= 80)		sense = 'Think: a long paragraph';
						else if (words >= 10)		sense = 'Think: a long sentence';
						
						var places = Math.floor(Math.log10(n));
						var inc = Math.max(1, Math.pow(10, places - 1)); // Affect the 2nd-highest digit
						widget.attr({ step: inc });
					}
					
					container.find('.char-sense').text(sense);
				}
			}
		});
	
		var rootScene = new PACK.e.RootScene({ name: 'root', title: 'root',
			build: function(rootElem, subsceneElems) {
				rootElem.append(subsceneElems.main);
			},
			subscenes: { main: [
				new PACK.e.Scene({ name: 'login', title: 'Login',
					build: function(rootElem, subsceneElems, scene) {
						var title = e('<h1>Creativity</h1>');
						
						var credentials = e('<div class="input-form credentials"></div>');
						
						var usernameField = e('<div class="input-field username"></div>');
						usernameField.append('<div class="label">Username</div>');
						usernameField.append('<input type="text"/>');
						
						var passwordField = e('<div class="input-field password"></div>');
						passwordField.append('<div class="label">Password</div>');
						passwordField.append('<input type="password"/>');
						
						var submit = e('<div class="submit"><div class="content">Submit</div></div>');
						submit.handle('click', function() {
							root.$request({ command: 'getToken', params: {
								username: usernameField.find('input').fieldValue(),
								password: passwordField.find('input').fieldValue()
							}}).fire(function(response) {
								if ('help' in response) {
									// Need to actually show user error, display response.help
								} else {
									auth.update({
										token: response.token,
										username: response.username
									});
									scene.par.setSubscene('main', 'lobby');
								}
							});
						});
						
						var spin = e('<div class="spin"></div>');
						spin.append(U.rng(20).map(function(i) { return '<div class="spinner"><div class="dash"></div></div>'; }));
						
						credentials.append([ usernameField, passwordField, submit, spin ]);
						
						rootElem.append(title);
						rootElem.append(credentials);
						rootElem.append('<div class="version">Version: ' + PACK.creativity.versionString + '</div>');
						
						return {};
					}
				}),
				new PACK.e.Scene({ name: 'lobby', title: 'Lobby',
					build: function(rootElem, subsceneElems, scene) {
						rootElem.append([
							'<div class="title"><span>Rooms</span></div>',
							subsceneElems.main
						]);
						return {};
					},
					subscenes: { main: [
						new PACK.e.Scene({ name: 'rooms', title: 'Room list',
							build: function(rootElem, subsceneElems, scene) {
								var scroller = e('<div class="scroller"></div>');
					
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
												
												// TODO: Here!
												rootScene.subscenes.main.writing.defaultScenes.contribute  = response.hasSubmitted ? 'vote' : 'write';
												rootScene.setSubscene('main', 'writing');
												
												/*console.log(scene.par.par);
												var writingScene = scene.par.par.subscenes.main.writing;
												writingScene.defaultScenes.contribute = ;
												scene.par.setSubscene('main', 'writing');*/
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
									onStart: function() {
										rootElem.listAttr({ class: [ '+loading' ] });
									},
									onEnd: function(roomsData) {
										listRooms.updateList(roomsData);
										rootElem.listAttr({ class: [ '-loading' ] });
									}
								});
								
								var newRoomButton = e('<div class="button new-room"><span></span></div>');
								newRoomButton.handle('click', function() {
									scene.par.setSubscene('main', 'newRoom');
								});
								
								rootElem.append([
									scroller,
									newRoomButton
								]);
								
								return { updater: updateRooms };
							},
							onStart: function(d) { d.updater.repeat({ delay: 2000 }); },
							onEnd: function(d) { d.updater.endRepeat(); },
						}),
						new PACK.e.Scene({ name: 'newRoom', title: 'Create new room',
							build: function(rootElem, subsceneElems, scene) {
								var scroller = e('<div class="scroller"><div class="input-form"></div></div>');
								scroller.listAttr({ class: [ '+loading' ] });
								
								var form = new PACK.e.Form({
									html: [
										'<div class="input-form">',
											'<p>',
												'The room\'s name must be alphanumeric, and unique.',
											'</p>',
											'<div class="input-field room.quickName">',
												'<div class="label">Name</div>',
												'<div class="input-container text alphanumeric unique">',
													'<input class="widget" name="{{ name }}" min="{{ minLen }}" max="{{ maxLen }}"/>',
												'</div>',
											'</div>',
											'<div class="input-field room.password">',
												'<div class="label">Password</div>',
												'<div class="input-container text">',
													'<input class="widget" name="{{ name }} min="{{ minLen }}" max="{{ maxLen }}""/>',
												'</div>',
											'</div>',
											'<div class="input-field room.description">',
												'<div class="label">Description</div>',
												'<div class="input-container text long">',
													'<textarea class="widget" name="{{ name }} min="{{ minLen }}" max="{{ maxLen }}""></textarea>',
												'</div>',
											'</div>',
											'<div class="input-field room.params.roundSubmissionSeconds">',
												'<div class="label">Submission time limit</div>',
												'<div class="input-container number clock">',
													'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
												'</div>',
											'</div>',
											'<div class="input-field room.params.roundVoteSeconds">',
												'<div class="label">Voting time limit</div>',
												'<div class="input-container number clock">',
													'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
												'</div>',
											'</div>',
											'<div class="input-field room.params.storyLength">',
												'<div class="label">Story length (characters)</div>',
												'<div class="input-container number char-count">',
													'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
												'</div>',
											'</div>',
											'<p>',
												'The next field allows you to control the minimum and maximum ',
												'length of a submission each round randomly has. If you want ',
												'each submission to be of the same length (no randomness), set ',
												'both fields to the same value.',
											'</p>',
											'<div class="input-joiner range-input">',
												'<div class="label">Text limit range</div>',
												'<div class="input-field room.params.submissionLengthMin">',
													'<div class="input-container number">',
														'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
													'</div>',
												'</div>',
												'<div class="sep">to</div>',
												'<div class="input-field room.params.submissionLengthMax">',
													'<div class="input-container number">',
														'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
													'</div>',
												'</div>',
											'</div>',
											'<p>',
												'The next field allows you to control how many submissions ',
												'there can be in each round. If the maximum is hit during a ',
												'round, no more submissions can occur and the voting stage is ',
												'entered immediately. If you want no limit, set the value to 0.',
											'</p>',
											'<div class="input-field room.params.submissionMaximum">',
												'<div class="label">Maximum submissions per round</div>',
												'<div class="input-container number">',
													'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
												'</div>',
											'</div>',
											'<p>',
												'The next field allows you to control how many votes there can ',
												'be in each round. If the maximum is hit, a submission is ',
												'immediately picked based on the existing votes. If you want ',
												'no limit, set the value to 0.',
											'</p>',
											'<div class="input-field room.params.voteMaximum">',
												'<div class="label">Maximum votes per round</div>',
												'<div class="input-container number">',
													'<input class="widget" name="{{ name }}" type="number" min="{{ minVal }}" max="{{ maxVal }}"/>',
												'</div>',
											'</div>',
											'<div class="submit">Submit</div>',
										'</div>'
									].join(''),
									listeners: creativityFormListeners,
									onSubmit: function(data) {
										scroller.listAttr({ class: [ '+loading' ] });
										root.$request({
											command: 'createRoom',
											params: {
												token: auth.token,
												roomParams: data,
											}
										}).fire(function(response) {
											scroller.listAttr({ class: [ '-loading' ] });
											scene.par.setSubscene('main', 'rooms');
										});
									}
								});
								
								root.$getForm({
									address: 'rooms.+room',
									selection: new qd.QSelExc({
										names: { 'startedMillis': 1, 'host': 1 }, // Excluded fields
										sel: qd.sel.all
									})
								}).fire(function(response) {

									scroller.append(form.build(response.form));
									scroller.listAttr({ class: [ '-loading' ] });
									
								});
								
								rootElem.append(scroller);
								
								return { form: form };
							},
						}),
					]},
					defaultScenes: { main: 'rooms' },
				}),
				new PACK.e.Scene({ name: 'writing', title: 'Writing',
					build: function(rootElem, subsceneElems) {
						var story = e('<div class="story"></div>');
						var storyScroller = story.append('<div class="scroller"></div>');
						
						var clock = new PACK.clock.Clock({
							hasControls: false,
							minSeconds: 0,
							maxSeconds: null
						});
						
						var resolution = e('<div class="resolution"></div>');
						resolution.append([
							'<div class="title"></div>',
							clock.createElem(),
							'<div class="votes">Votes:<div class="voted">0</div>/<div class="total">0</div></div>'
						]);
						
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
											// using the @-flag and *Query architecture
											return c.$getChild({ address: '@blurb' });
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
							onStart: function() {
								story.listAttr({ class: [ '+loading' ] });
							},
							onEnd: function(storyData) {
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
							onStart: function() {},
							onEnd: function(endData) {
								var countdown = resolution.find('.countdown');
								var seconds = endData.seconds;
								
								if (seconds === null) {
									clock.setSeconds(null);
									resolution.find('.title').text('Stalled.');
								} else {
									clock.setSeconds(seconds);
									resolution.find('.title').text('Counting...');
								}
								
								var votes = resolution.find('.votes');
								votes.find('.voted').text(endData.voters);
								votes.find('.total').text(endData.totalVoters);
							}
						});
						updateTimer.repeat({ delay: 1000 });
						
						rootElem.append([ story, resolution, subsceneElems.contribute ]);
						
					},
					subscenes: { contribute: [
						new PACK.e.Scene({ name: 'write', title: 'Write',
							build: function(rootElem, subsceneElems, scene) {
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
							onStart: function(d) {
								d.form.listAttr({ class: [ '-disabled' ] });
								d.form.find('textarea').fieldValue('');
							},
							/*onEnd: function(d) { d.updater.endRepeat(); },*/
						}),
						new PACK.e.Scene({ name: 'vote', title: 'Vote',
							build: function(rootElem, subsceneElems, scene) {
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
															votable.$getChild({ address: '@blurb' }),
															root.$filter({
																address: 'rooms.' + auth.room + '.votes',
																filter: { 'votable/value': votable.getAddress() },
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
									onStart: function() {
										rootElem.listAttr({ class: [ '+loading' ] });
									},
									onEnd: function(votableData) {
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
							onStart: function(d) { d.updater.repeat({ delay: 3000 }); },
							onEnd: function(d) { d.updater.endRepeat(); }
						})
					]},
					defaultScenes: { contribute: 'vote' }
				})
			]},
			defaultScenes: { main: 'login' }
		});
		
		rootScene.start();
		
		window.root = root; // Nice to make "root" available on client-side terminal
	}
});
package.build();
