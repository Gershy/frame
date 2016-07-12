var package = new PACK.pack.Package({ name: 'uscape',
	dependencies: [ 'quickDev' ],
	buildFunc: function() {
		var ret = {
			queryHandler: new PACK.quickDev.QDict({
				name: 'app',
				children: [
					
				],
			})
		};
		
		return ret;
	},
	runAfter: function() {
		var qd = PACK.quickDev;
		
		var root = PACK.uscape.queryHandler;
		
		U.addSerializable({
			name: 'uscape.userSchema',
			value: new qd.QSchema({ c: qd.QDict, i: {
				name:		new qd.QSchema({ c: qd.QString, p: { name: 'name', value: '' } }),
				password:	new qd.QSchema({ c: qd.QString, p: { name: 'password', value: '' } }),
				age:		new qd.QSchema({ c: qd.QInt,	p: { name: 'age', value: 0 } }),
			}}),
		});
		
		if (U.isServer()) {
			
			root.addChild(new qd.QGen({
				name: 'users',
				schema: U.getSerializable('uscape.userSchema'),
			}));
			
		} else {
			
			root.$load({ onComplete: function(d) {
				console.log('loaded', d);
				
				var users = root.getChild('users');
				
				var newUser = users.getNewChild({ p: {}, i: {
					name:		{ p: { value: 'Gershom' }, i: [] },
					password:	{ p: { value: '1msosmart' }, i: [] },
					age:		{ p: { value: 23 }, i: [] },
				}});
				
				newUser.$persist({ onComplete: function() {
					root.$getSchema({ onComplete: function(response) {
						console.log(response);
						
						var schema = new PACK.quickDev.QSchema(response.schemaParams);
						console.log(schema.simplified());
					}});
				}});
			}});
			
			
		}
		
	},
});
package.build();
