var cr = PACK.creativity;
var qd = PACK.quickDev;
var root = cr.queryHandler;

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data !== null) {
			return { msg: 'pre-existing state', data: data };
		}
		
		return {
			msg: 'built initial schema',
			data: new qd.QSchema({ c: cr.CreativityApp, p: { name: 'app' }, i: [
				{ c: qd.QDict, p: { name: 'resolutionTimer' }, i: [
					{ c: qd.QInt, p: { name: 'startedMillis', value: -1 } },
					{ c: qd.QInt, p: { name: 'delaySeconds', value: 60 * 60 * 24 } }
				]},
				{ c: qd.QGen, p: { name: 'users',
						_schema: 'creativity.usersSchema',
						_initChild: 'creativity.usersInitChild',
						prop: 'username/value'
					},
					i: [
						{ c: qd.QDict, p: { name: 'ari' }, i: [
							{ c: qd.QString, p: { name: 'username', value: 'ari' } },
							{ c: qd.QString, p: { name: 'password', value: 'ari117' } },
						] },
						{ c: qd.QDict, p: { name: 'daniel' }, i: [
							{ c: qd.QString, p: { name: 'username', value: 'daniel' } },
							{ c: qd.QString, p: { name: 'password', value: 'daniel228' } },
						] },
						{ c: qd.QDict, p: { name: 'gershom' }, i: [
							{ c: qd.QString, p: { name: 'username', value: 'gershom' } },
							{ c: qd.QString, p: { name: 'password', value: 'gershom331' } },
						] },
						{ c: qd.QDict, p: { name: 'levi' }, i: [
							{ c: qd.QString, p: { name: 'username', value: 'levi' } },
							{ c: qd.QString, p: { name: 'password', value: 'levi443' } },
						] },
						{ c: qd.QDict, p: { name: 'yehuda' }, i: [
							{ c: qd.QString, p: { name: 'username', value: 'yehuda' } },
							{ c: qd.QString, p: { name: 'password', value: 'yehuda556' } },
						] },
					]
				},
				{ c: qd.QGen, p: { name: 'blurbs',
					_schema: 'creativity.blurbSchema',
					_initChild: 'creativity.blurbInitChild',
					prop: 'id/value'
				}},
				{ c: qd.QGen, p: { name: 'votables',
					_schema: 'creativity.votableSchema',
					_initChild: 'creativity.votablesInitChild',
					prop: 'id/value'
				}},
				{ c: qd.QGen, p: { name: 'votes',
					_schema: 'creativity.voteSchema',
					_initChild: 'creativity.votesInitChild',
					prop: '@user.username/value'
				}},
				{ c: qd.QGen, p: { name: 'storyItems',
					_schema: 'creativity.storyItemSchema',
					_initChild: 'creativity.storyItemsInitChild',
					prop: 'id/value'
				}}
			]})
		};
	}
});
migrations.chain([
	new qd.QMigration({ name: 'string to json',
		apply: function(data) {
			return data.constructor === String
				? { msg: 'parsed json',	data: JSON.parse(data) }
				: { msg: 'no change.',	data: data };
		}
	}),
	new qd.QMigration({ name: 'rooms',
		apply: function(data) {
			U.addSerializable({ name: 'creativity.roomsSchema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QRef, p: { name: 'host', value: '' } },
					{ c: qd.QString, p: { name: 'quickName', value: '', minLen: 3, maxLen: 20 } },
					{ c: qd.QString, p: { name: 'description', value: '', minLen: 0, maxLen: 250 } },
					{ c: qd.QString, p: { name: 'password', value: '', minLen: 0, maxLen: 30 } },
					{ c: qd.QDict, p: { name: 'params' }, i: [
						{ c: qd.QInt, p: { name: 'storyLength', value: 0, minVal: 500, maxVal: 10000000 /* ten-million */ } },
						{ c: qd.QInt, p: { name: 'submissionLengthMin', value: 0, minVal: 10, maxVal: 600 } },
						{ c: qd.QInt, p: { name: 'submissionLengthMax', value: 0, minVal: 10, maxVal: 600 } },
						{ c: qd.QInt, p: { name: 'roundSubmissionSeconds', value: 0, minVal: 15, maxVal: 60 * 60 * 48 } },
						{ c: qd.QInt, p: { name: 'roundVoteSeconds', value: 0, minVal: 15, maxVal: 60 * 60 * 48 } },
						{ c: qd.QInt, p: { name: 'voteMaximum', value: 0, minVal: 0, maxVal: 10000 } },
						{ c: qd.QInt, p: { name: 'submissionMaximum', value: 0, minVal: 0, maxVal: 10000 } },
					]},
					{ c: qd.QInt, p: { name: 'startedMillis', value: -1 } },
					{ c: qd.QGen, p: { name: 'users',
						_schema: U.addSerializable({ name: 'creativity.roomUsersSchema',
							value: new qd.QSchema({ c: qd.QDict, i: [
								/*
								TODO: It sucks that "username" is needed!! But it is,
								because if it's taken out and prop is switched from
								"username/value" to "@user.username/value" then stuff
								breaks!! It will be way	cleaner once this is fixed.
								Pity in the meantime.
								
								NOTE: When it's changed, need to update the query
								handling for 'createRoom' where the user is checked
								to make sure they're not exceeding the rooms limit.
								*/
								{ c: qd.QRef, p: { name: 'user', value: '' } },
								{ c: qd.QString, p: { name: 'username', value: '' } },
								{ c: qd.QInt, p: { name: 'nukeStartedMillis', value: -1 } }
							]})
						}),
						_initChild: U.addSerializable({ name: 'creativity.roomUsersInitChild',
							value: function(userElem, params /* user */) {
								var user = U.param(params, 'user');
								userElem.getChild('user').setRef(user);
								// TODO: This also (see about TODO) should be unecessary
								userElem.getChild('username').setValue(user.name);
							}
						}),
						prop: 'username/value' //'@user.username/value'
					}},
					{ c: qd.QGen, p: { name: 'blurbs',
						_schema: 'creativity.blurbSchema',
						_initChild: 'creativity.blurbInitChild',
						prop: 'id/value'
					}},
					{ c: qd.QGen, p: { name: 'votables',
						_schema: 'creativity.votableSchema',
						_initChild: 'creativity.votablesInitChild',
						prop: 'id/value'
					}},
					{ c: qd.QGen, p: { name: 'votes',
						_schema: 'creativity.voteSchema',
						_initChild: 'creativity.votesInitChild',
						prop: '@user.username/value'
					}},
					{ c: qd.QGen, p: { name: 'storyItems',
						_schema: 'creativity.storyItemSchema',
						_initChild: 'creativity.storyItemsInitChild',
						prop: 'id/value'
					}}
				]})
			});
			U.addSerializable({ name: 'creativity.roomsInitChild',
				value: function(roomElem, params /* host, storyLength, submissionLengthMin, submissionLengthMax, roundSubmissionSeconds, roundVoteSeconds, voteMaximum, submissionMaximum */) {
					
					// Hosting user
					var host = U.param(params, 'host');
					
					// Room quickName
					var quickName = U.param(params, 'quickName');
					// Room description
					var description = U.param(params, 'description');
					
					// Maximum story length in characters
					var storyLength = U.param(params, 'storyLength');
					// Minimum limit on the length of a submission (potential random character limits)
					var submissionLengthMin = U.param(params, 'submissionLengthMin');
					// Maximum limit on the length of a submission
					var submissionLengthMax = U.param(params, 'submissionLengthMax');
					// The number of seconds during which submissions are allowed
					var roundSubmissionSeconds = U.param(params, 'roundSubmissionSeconds');
					// The number of seconds during which voting is allowed
					var roundVoteSeconds = U.param(params, 'roundVoteSeconds');
					// If a submission reaches this many votes, it instantly wins (0 to disable)
					var voteMaximum = U.param(params, 'voteMaximum');
					// Maximum number of submissions allowed per round (0 to disable)
					var submissionMaximum = U.param(params, 'submissionMaximum');
					
					roomElem.getChild('host').setRef(host);
					roomElem.getChild('quickName').setValue(quickName);
					roomElem.getChild('description').setValue(description);
					roomElem.getChild('params.storyLength').setValue(storyLength);
					roomElem.getChild('params.submissionLengthMin').setValue(submissionLengthMin);
					roomElem.getChild('params.submissionLengthMax').setValue(submissionLengthMax);
					roomElem.getChild('params.roundSubmissionSeconds').setValue(roundSubmissionSeconds);
					roomElem.getChild('params.roundVoteSeconds').setValue(roundVoteSeconds);
					roomElem.getChild('params.voteMaximum').setValue(voteMaximum);
					roomElem.getChild('params.submissionMaximum').setValue(submissionMaximum);
				}
			});
			
			if ('rooms' in data.i) return { msg: 'no change', data: data };
			
			data.i.rooms = new qd.QSchema({ c: qd.QGen, p: { name: 'rooms',
				_schema: 'creativity.roomsSchema',
				_initChild: 'creativity.roomsInitChild',
				prop: 'quickName/value'
			}});
			data.i.maxRoomsPerUser = new qd.QSchema({ c: qd.QInt, p: { name: 'maxRoomsPerUser', value: 3 } });
			
			// Work with an actual instance - it's much easier.
			// It will be converted back to a schema at the end.
			var schema = new qd.QSchema(data);
			var root = new cr.CreativityApp({ name: 'app' });
			schema.assign({ elem: root, recurse: true });
			
			if (root.getChild('blurbs').length > 0) {
				
				root.getChild('rooms').getNewChild({
					host: root.getChild('users.gershom'),
					quickName: 'firstStory',
					description: 'The first story ever written with this app!',
					storyLength: 500000,
					submissionLengthMin: 30,
					submissionLengthMax: 160,
					roundSubmissionSeconds: 60 * 60 * 12,
					roundVoteSeconds: 60 * 60 * 12,
					voteMaximum: 0,
					submissionMaximum: 0
				});
				
				// MIGRATE DATA
				var users = root.getChild('users').children;
				var roomUsers = root.getChild('rooms.firstStory.users');
				for (var k in users)
					roomUsers.getNewChild({
						user: users[k]
					});
				
				var blurbs = root.getChild('blurbs').children;
				var roomBlurbs = root.getChild('rooms.firstStory.blurbs');
				for (var k in blurbs)
					roomBlurbs.getNewChild({
						username: blurbs[k].getChild('@user').name,
						text: blurbs[k].getChild('text').value
					});
				
				var votables = root.getChild('votables').children;
				var roomVotables = root.getChild('rooms.firstStory.votables');
				for (var k in votables)
					roomVotables.getNewChild({
						blurb: roomBlurbs.getChild(votables[k].getChild('@blurb').name)
					});
				
				var votes = root.getChild('votes').children;
				var roomVotes = root.getChild('rooms.firstStory.votes');
				for (var k in votes)
					roomVotes.getNewChild({
						user: votes[k].getChild('@user'),
						votable: roomVotables.getChild(votes[k].getChild('@votable').name)
					});
				
				var storyItems = root.getChild('storyItems').children;
				var roomStoryItems = root.getChild('rooms.firstStory.storyItems');
				for (var k in storyItems)
					roomStoryItems.getNewChild({
						blurb: roomBlurbs.getChild(storyItems[k].getChild('@blurb').name)
					});
				
				root.getChild('rooms.firstStory.startedMillis').setValue(root.getChild('resolutionTimer.startedMillis').value);
				
			}
			
			// DELETE UNECESSARY COMPONENTS*/
			root.remChild('blurbs');
			root.remChild('votables');
			root.remChild('votes');
			root.remChild('storyItems');
			root.remChild('resolutionTimer');
			
			return {
				msg: 'added rooms',
				data: root.schemaParams({ selection: qd.sel.all })
			};
		}
	})
]);

var reset = false;
root.getState(function(state) {
	
	if (reset) state = null;
	
	// The migrations produce the root
	var migratedSchemaParams = migrations.run(state);
	var schema = new qd.QSchema(migratedSchemaParams);
	
	schema.assign({ elem: PACK.creativity.queryHandler, recurse: true });
	
	// Start the CreativityApp
	PACK.creativity.queryHandler.start();
});
