var package = new PACK.pack.Package({ name: 'uscape',
	dependencies: [ 'quickDev' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		var ret = {
			queryHandler: new qd.QDict({
				name: 'app',
				children: [
					new qd.QGen({
						name: 'users',
						_schema: U.addSerializable({
							name: 'uscape.userSchema',
							value: new qd.QSchema({ c: qd.QDict, i: {
								name:		new qd.QSchema({ c: qd.QString, p: { name: 'name', value: '' } }),
								password:	new qd.QSchema({ c: qd.QString, p: { name: 'password', value: '' } }),
								age:		new qd.QSchema({ c: qd.QInt,	p: { name: 'age', value: 0 } }),
							}}),
						}),
					})
				],
			})
		};
		
		return ret;
	},
	runAfter: function() {
		
		var root = PACK.uscape.queryHandler;
		
		if (!U.isServer()) {
			
			var users = root.getChild('users');
			
			users.$load({ onComplete: function(d) {
				console.log('loaded', d);
				
				var newUser = users.getNewChild({ p: {}, i: {
					name:		{ p: { value: 'Gershom' } },
					password:	{ p: { value: '1msosmart' } },
					age:		{ p: { value: 23 } },
				}});
				
				newUser.$persist({ onComplete: function() {
					users.$getSchema({ onComplete: function(response) {
						var userSchemaData = response.schemaParams;
						console.log(userSchemaData.i.length);
					}});
				}});
			}});
			
		}
		
	},
});
package.build();
