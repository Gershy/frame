/*
Abilities have associated buildings. The buildings for a specific controller
are grouped into a "camp". Each camp is set within a "foundation". Players
can decide among themselves who gets which foundation. If buildings are
destroyed they cannot be used to spawn until they recover.

The differences in maps will be the placement of camps and the "hq".
Destorying the "generator" wins the game.
*/
var package = new PACK.pack.Package({ name: 'attack',
	dependencies: [ 'quickDev', 'canvas' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/creativity/style.css' ] }
		};
		
		var AttackApp = PACK.uth.makeClass({ name: 'AttackApp',
			superclassName: 'QDict',
			methods: function(sc, c) { return {
				init: function(params /*  */) {
					sc.init.call(this, params);
				}
			};}
		});
		
		ret.queryHandler = new AttackApp({ name: 'app', children: [
			// STATIC
			new qd.QDict({ name: 'classes', children: [
				new qd.QDict({ name: 'slate', children: [
					new qd.QString({ name: 'description', value: [
						'Slate commands troops.'
					].join('')}),
					new qd.QDict({ name: 'abilities', children: [
						new qd.QDict({ name: 0, children: [
							new qd.QString({ name: 'name', value: 'trooper' }),
							new qd.QInt({ name: 'cost', value: 10 }),
							new qd.QInt({ name: 'cooldown', value: 1000 }),
							new qd.QRef({ name: 'building', value: 'app.units.barracks' }),
							new qd.QDict({ name: 'function', children: [
								new qd.QString({ name: 'type', value: 'spawn' }),
								new qd.QRef({ name: 'unit', value: 'app.units.shockTroop' })
							]})
						]}),
						new qd.QDict({ name: 1, children: [
							new qd.QString({ name: 'name', value: 'outpost' }),
							new qd.QInt({ name: 'cost', value: 50 }),
							new qd.QInt({ name: 'cooldown', value: 5000 }),
							new qd.QRef({ name: 'building', value: 'app.units.factory' }),
							new qd.QDict({ name: 'function', children: [
								new qd.QString({ name: 'type', value: 'gridSpawn' }),
								new qd.QRef({ name: 'unit', value: 'app.units.outpost' })
							]})
						]})
					]})
				]})
			]}),
			new qd.QDict({ name: 'units', children: [
				// UNITS
				new qd.QDict({ name: 'shockTroop', children: [
					new qd.QString({ name: 'type', value: 'rangedUnit' }),
					new qd.QInt({ name: 'hp', value: 20 })
				]}),
				
				// BUILDINGS
				new qd.QDict({ name: 'barracks', children: [
					new qd.QString({ name: 'type', value: 'building' }),
					new qd.QString({ name: 'pathingType', value: 'custom' }),
					new qd.QInt({ name: 'hp', value: 1000 })
				]}),
			]}),
			new qd.QDict({ name: 'maps', children: [
				new qd.QDict({ name: 'outlands', children: [
					new qd.QInt({ name: 'numTeams', value: 2 }),
					new qd.QInt({ name: 'playersPerTeam', value: 2 }),
					new qd.QInt({ name: 'width', value: 101 }),
					new qd.QInt({ name: 'height', value: 101 }),
					new qd.QDict({ name: 'terrain', children: [
						new qd.QDict({ name: 0, children: [
							new qd.QString({ name: 'type', value: 'blocked' }),
							new qd.QVector2D({ name: 'loc', value: [ x: 50, y: 50 ] })
						]})
					]}),
					new qd.QDict({ name: 'bases', children: [
						new qd.QDict({ name: 0, children: [
							new qd.QVector2D({ name: 'hqLoc', value: [ x: 30, y: 10 ] }),
						]}),
						new qd.QDict({ name: 1, children: [
							new qd.QVector2D({ name: 'hqLoc', value: [ x: 70, y: 90 ] }),
						]})
					]})
				]})
			]}),
			
			// DYNAMIC
			new qd.QGen({ name: 'users',
				_schema: U.addSerializable({
					name: 'attack.usersSchema',
					value: new qd.QSchema({ c: qd.QDict, i: {
						username:	new qd.QSchema({ c: qd.QString, p: { name: 'username', 	value: '' } }),
					}})
				}),
				_initChild: U.addSerializable({
					name: 'attack.usersInitChild',
					value: function(child, params /* username */) {
						var username = U.param(params, 'username');
						child.getChild('username').setValue(username);
					}
				}),
				prop: 'username/value'
			}),
			new qd.QGen({ name: 'rooms',
				_schema: U.addSerializable({
					name: 'attack.roomsSchema',
					value: new qd.QSchema({ c: qd.QDict, i: {
						host: new qd.QSchema({ c: qd.Ref, p: { name: 'host' }}),
						name: new qd.QSchema({ c: qd.QString, p: { name: 'name' }}),
						users: new qd.QSchema({ c: qd.QDict, p: { name: 'users' }})
					}})
				}),
				_initChild: U.addSerializable({
					name: 'attack.roomsInitChild',
					value: function(child, params /* hostUsername */) {
						var hostUsername = U.param(params, 'hostUsername');
						
						child.getChild('hostUsername')
						child.getChild('name').value = hostUsername + '\'s room';
					}
				}),
				prop: '@host.username/value'
			})
		]});
		
		return ret;
	}
});
package.build();
