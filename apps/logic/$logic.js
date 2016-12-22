var qd = PACK.quickDev;
var lg = PACK.logic;

U.addSerializables([
	{	name: 'logic.root.schemaParams',
		value: { c: lg.LogicApp, p: { name: 'app' }, i: [
			{ 	c: lg.QGen, p: { name: 'users',
				_schema: 'logic.user.schema',
				_initChild: 'logic.user.init',
				prop: 'username/value'
			}},
			{	c: lg.QGen, p: { name: 'essays',
				_schema: 'logic.essay.schema',
				_initChild: 'logic.essay.init',
				prop: 'id/value'
			}},
			{	c: lg.QGen, p: { name: 'theories',
				_schema: 'logic.theory.schema',
				_initChild: 'logic.theory.init',
				prop: 'quickName/value'
			}}
		]}
	},
	
	{	name: 'logic.user.schema',
		value: new qd.QSchema({ c: qd.QDict, i: [
			{ c: qd.QString, p: { name: 'fname' } },
			{ c: qd.QString, p: { name: 'lname' } },
			{ c: qd.QString, p: { name: 'username' } }
		]})
	},
	{	name: 'logic.user.init',
		value: function(child, params /* */) {
			
		}
	},
	
	{	name: 'logic.essay.schema',
		value: new qd.QSchema({ c: qd.QDict, i: [
			{ c: qd.QInt, p: { name: 'id', value: 0 } },
			{ c: qd.QString, p: { name: 'markup' } }
		]})
	},
	{	name: 'logic.essay.init',
		value: function(child, params /* */) {
			
		}
	},
	
	{	name: 'logic.theory.schema',
		value: new qd.QSchema({ c: qd.QDict, i: [
			{ c: qd.QRef, 		p: { name: 'user' } },
			{ c: qd.QInt, 		p: { name: 'timestamp' } },
			{ c: qd.QRef, 		p: { name: 'duplicate' } },
			{ c: qd.QString, 	p: { name: 'quickName' } },
			{ c: qd.QString, 	p: { name: 'title' } },
			{ c: qd.QRef, 		p: { name: 'essay' } }
			{ c: qd.QGen, 		p: { name: 'challengers',
				_schema: 'logic.theory.related.schema',
				_initChild: 'logic.theory.related.init',
				prop: '@theory.quickName/value'
			}},
			{ c: qd.QGen, 		p: { name: 'prerequisites',
				_schema: 'logic.theory.related.schema',
				_initChild: 'logic.theory.related.init',
				prop: '@theory.quickName/value'
			}},
			{ c: qd.QGen, 		p: { name: 'voters',
				_schema: 'logic.theory.voter.schema',
				_initChild: 'logic.theory.voter.init'
				prop: '@voter.username/value'
			}}
		]})
	},
	{	name: 'logic.theory.init',
		value: function(child, params /* */) {
			
		}
	},
	
	{	name: 'logic.theory.related.schema',
		value: new qd.QSchema({ c: qd.QRef, p: { name: 'theory' } })
	},
	{	name: 'logic.theory.related.init',
		value: function(child, params /* */) {
			
		}
	},
	
	{	name: 'logic.theory.voter.schema',
		value: new qd.QSchema({ c: qd.QDict, p: { name: 'voter' }, i: [
			{ c: qd.QRef, p: { name: 'user' } },
			{ c: qd.QInt, p: { name: 'vote' } }
		]})
	},
	{	name: 'logic.theory.voter.init',
		value: function(child, params /* */) {
			
		}
	}
});

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) {
		if (data !== null) return { msg: 'pre-existing state', data: data };
		
		return {
			msg: 'built initial schema',
			data: U.getSerializable('logic.root.schemaParams')
		};
	}
});
migrations.chain([
]);

var reset = false;
root.getState(function(state) {
	if (reset) state = null;
	
	// Get the schema params, convert them into a QSchema
	var sp = migrations.run(state);
	var schema = new qd.QSchema(sp);
	
	// Load + start!
	var app = PACK.logic.queryHandler;
	schema.assign({ elem: app, recurse: true });
	app.start();
});
