var qd = PACK.quickDev;
var lg = PACK.logic;
var root = lg.queryHandler;

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data) return { msg: 'pre-existing state', data: data };
		
		var schema = U.getSerializable('logic.root.schema').v;
		schema.assign({ elem: PACK.logic.queryHandler, recurse: true });
		
		return {
			msg: 'built initial schema',
			data: PACK.logic.queryHandler
		};
	}
});

if (false)
migrations.chain([
	new qd.QMigration({ name: 'add default data',
		
		// TODO: Timestamp is coming up null, not due to the value supplied,
		// but because it is null when it is initially created.
		
		apply: function(data) {
			if (data.getChild('theories').length) return {
				msg: 'default data already supplied',
				data: data
			};
			
			var app = data;
			
			var theories = app.getChild('theories');
			
			theories.getNewChild({ quickName: 'chooseSurvivors',
				user: null,
				title: 'Choosing a Surviving Group of People',
				essayMarkup: [
					'Given that one must choose a single group of people to survive, ',
					'and given that all other groups of people will perish, ',
					'and given that there is no additional information present on any ',
					'of the people in any of the groups, ',
					'one should choose the largest group to be the one to survive.'
				].join(''),
				prerequisites: []
			});
			
			theories.getNewChild({ quickName: 'townSurvivors',
				user: null,
				title: 'Situation in Town town',
				essayMarkup: [
					'In Town town there are 3 groups of people. The groups have 5, 6, ',
					'and 3 members respectively. You must choose a group to survive, and ',
					'all others will perish.'
				].join(''),
				prerequisites: []
			});
			
			theories.getNewChild({ quickName: 'townSurvivors2',
				user: null,
				title: 'Situation in Town town',
				essayMarkup: [
					'You don\'t know anything about any of the people in Town town.'
				].join(''),
				prerequisites: []
			});
			
			theories.getNewChild({ quickName: 'townSurvivorsSolved',
				user: null,
				title: 'Solution in Town town',
				essayMarkup: [
					'You should pick the group of 6 people to be the surviving group.'
				].join(''),
				prerequisites: [ 'townSurvivors', 'townSurvivors2', 'chooseSurvivors' ]
			});
			
			return {
				msg: 'added default data',
				data: app
			};
		}
	})
]);

var reset = true;
root.getState(function(state) {
	if (state) {
		// If `state` is given it is schemaParams, whereas a `LogicApp` is needed
		var schema = new qd.QSchema(state);
		schema.assign({ elem: PACK.logic.queryHandler, recurse: true });
		state = { msg: 'saved state', data: PACK.logic.queryHandler };
	}
	
	// Get the schema params, convert them into a QSchema
	var app = migrations.run(reset ? null : state);
	app.start();
});
