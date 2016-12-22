var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'htmlText', 'clock' ],
	buildFunc: function(packageName) {
		var qd = PACK.quickDev;
		
		// Add serializables
		(function() {
			U.addSerializable({ name: [ packageName, 'itemSchema' ].join('.'),
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: null, p: { name: null, value: null } }
				]})
			});
		})();
		
		var ret = {
			resources: { css: [ 'apps/logic/style.css' ] },
			versionString: '0.0.1',
			LogicApp: PACK.uth.makeClass({ name: 'LogicApp',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					start: function() {
						if (!U.isServer()) throw new Error('Only call this server-side');
						
						var pass = this;
						this.dbUpdate = new qd.QUpdate({
							request: function(cb) {
								pass.setState(pass.schemaParams({
									selection: qd.sel.all
								}), cb);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						
						this.resolveUpdate = new qd.QUpdate({
							request: function(cb) {
								pass.tryResolveVotes();
								cb(null);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						
						this.dbUpdate.repeat({ delay: 1500 });
						this.resolveUpdate.repeat({ delay: 1000 });
					},
					getState: function(cb) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: packageName }).limit(1).next(function(err, doc) {
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
							collection.update({ name: packageName }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
								if (cb) cb(doc.result);
							});
						});
					},
				}; }
			})
		};
		ret.queryHandler = new ret.LogicApp({ name: 'app', children: [] });
		
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
