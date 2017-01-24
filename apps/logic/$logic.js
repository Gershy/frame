var qd = PACK.quickDev;
var lg = PACK.logic;
var root = lg.queryHandler;

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data) return { msg: 'pre-existing state', data: data };
		
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
	
	// Load + start!
	var app = PACK.logic.queryHandler;
	(new qd.QSchema(sp)).assign({ elem: app, recurse: true });
	app.start();
});

var P = PACK.p.P;

var d1 = new P({ cb: U.createDelay, cbParams: { delay: 3000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay3000'; });
var d2 = new P({ cb: U.createDelay, cbParams: { delay: 2000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay2000'; });
var d3 = new P({ cb: U.createDelay, cbParams: { delay: 1000, repeat: false }, cbName: '0.task' }).then(function() { return 'delay1000'; });

var allDelays = new P({ all: [ d1, d2, d3 ]}).then(function(vals) {
	console.log('GOT', vals);
});
