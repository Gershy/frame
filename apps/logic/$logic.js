var qd = PACK.quickDev;
var lg = PACK.logic;
var root = lg.queryHandler;

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data !== null) return { msg: 'pre-existing state', data: data };
		
		return {
			msg: 'built initial schema',
			data: U.getSerializable('logic.root.schemaParams').v
		};
	}
});
migrations.chain([
]);

var reset = false;
root.getState(function(state) {
	// Get the schema params, convert them into a QSchema
	var sp = migrations.run(reset ? null : state);
	var schema = new qd.QSchema(sp);
	
	// Load + start!
	var app = PACK.logic.queryHandler;
	schema.assign({ elem: app, recurse: true });
	app.start();
});
