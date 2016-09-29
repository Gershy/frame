var cr = PACK.creativity;
var qd = PACK.quickDev;
var root = cr.queryHandler;

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data !== null) return { msg: 'pre-existing state', data: data };
		
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
			return {
				msg: 'none for now',
				data: data
			};
		}
	})
]);

root.getState(function(state) {
	var schemaParams = migrations.run(state);
	var schema = new PACK.quickDev.QSchema(schemaParams);
	
	schema.assign({ elem: root,	recurse: true });
	root.start();
});
