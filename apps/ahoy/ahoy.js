var package = new PACK.pack.Package({ name: 'ahoy',
	dependencies: [ 'quickDev', 'e' ],
	buildFunc: function() {
		
		var Ahoy = PACK.uth.makeClass({ name: 'Ahoy',
			superclassName: 'QDict',
			propertyNames: [ ],
			methods: function(sc, c) { return { 
				init: function(params /* name, children */) {
					sc.init.call(this, params);
				}
			}; }
		});
		
		return {
			resources: {
				css: [ 'apps/ahoy/style.css' ]
			},
			scene: new PACK.e.RootScene({ name: 'root', title: 'Ahoy', defaultScene: 'wrapper/intro',
				build: function(rootElem, subSceneObj) {
					rootElem.append(subSceneObj.wrapper);
					
					return {
					};
				},
				subScenes: {
					wrapper: [
						new PACK.e.Scene({ name: 'intro', title: 'Intro',
							build: function(rootElem, subSceneObj) {
								var title = 	rootElem.append(new PACK.e.e('<div class="title"><h1>Ahoy</h1></div>'));
								var sea = 		rootElem.append(new PACK.e.e('<div class="sea"></div>'));
								sea.append(new PACK.e.e('<div class="rocks"></div>'));
								var boat1 = sea.append(new PACK.e.e('<div class="boat boat1"></div>'));
								var boat2 = sea.append(new PACK.e.e('<div class="boat boat2"><div class="fire"></div></div>'));
								var turn1 = sea.append(new PACK.e.e('<div class="turn1"></div>'));
								var turn2 = turn1.append(new PACK.e.e('<div class="turn2"></div>'));
								U.rng(4).forEach(function() { turn2.append('<div class="cannonball"></div>'); });
								boat1.append(new PACK.e.e('<div class="pirate pirate1"></div>'));
								boat1.append(new PACK.e.e('<div class="pirate pirate2"></div>'));
								boat1.append(new PACK.e.e('<div class="pirate pirate3"></div>'));
								
								return {
									title: title,
									boat1: boat1,
									boat2: boat2
								}
							},
						}),
						new PACK.e.Scene({ name: 'game', title: 'Game',
							build: function(rootElem, subSceneObj) {
								var canvas = rootElem.append(new PACK.e.e('<canvas width="400" height="400"></canvas>'));
								return {
									canvas: canvas
								}
							}
						}),
						new PACK.e.Scene({ name: 'credits', title: 'Credits',
							build: function(rootElem, subSceneObj) {
								rootElem.append(new PACK.e.e('<p>Gershom made this!</p>'));
								
								return {
								};
							}
						})
					]
				}
			}),
			queryHandler: new Ahoy({ name: 'app',
				children: [
					new PACK.quickDev.QGen({ name: 'teams',
						prop: 'id',
						_schema: U.addSerializable({
							name: 'ahoy.teamSchema',
							value: new PACK.quickDev.QSchema({
								c: PACK.quickDev.QDict,
								p: { },
								i: {
									id:		{ c: PACK.quickDev.QInt,		p: { name: 'id',	value: 0 } },
									name:	{ c: PACK.quickDev.QString,		p: { name: 'name', 	value: '' } },
									color:	{ c: PACK.quickDev.QColor,		p: { name: 'color', value: { r: 0, g: 0, b: 0, a: 1 } } },
								}
							})
						})
					}),
					new PACK.quickDev.QGen({ name: 'users',
						prop: 'ip',
						_schema: U.addSerializable({
							name: 'ahoy.playerSchema',
							value: new PACK.quickDev.QSchema({
								c: PACK.quickDev.QDict,
								p: { },
								i: {
									ip:		{ c: PACK.quickDev.QString,		p: { name: 'ip',	value: '' } },
									name:	{ c: PACK.quickDev.QString,		p: { name: 'name', 	value: '' } },
									age:	{ c: PACK.quickDev.QInt,		p: { name: 'age', 	value: 0 } },
									level: 	{ c: PACK.quickDev.QInt,		p: { name: 'level', value: 0 } },
									team:	{ c: PACK.quickDev.QRef,		p: { name: 'team', 	value: '', baseAddress: 'app.teams' } },
									pos: 	{ c: PACK.quickDev.QVector2D,	p: { name: 'pos', 	value: { x: 0, y: 0 } } },
								}
							})
						}),
						_initChild: U.addSerializable({
							name: 'ahoy.playerInitChild',
							value: function(child, params) {
								var name = U.param(params, 'name');
								var session = U.param(params, 'session');
								
								child.getChild('ip').setValue(session.ip);
								child.getChild('name').setValue(name);
							}
						})
					}),
					new PACK.quickDev.QGen({ name: 'terrain',
						prop: 'id',
						_schema: U.addSerializable({
							name: 'ahoy.terrainSchema',
							value: new PACK.quickDev.QSchema({
								c: PACK.quickDev.QDict,
								p: { },
								i: {
									id:		{ c: PACK.quickDev.QInt,		p: { name: 'id', 	value: 0 } },
									type: 	{ c: PACK.quickDev.QString, 	p: { name: 'type',	value: '' } },
									pos: 	{ c: PACK.quickDev.QVector2D, 	p: { name: 'pos', 	value: { x: 0, y: 0 } } }
								}
							})
						})
					}),
					new PACK.quickDev.QGen({ name: 'npcs',
						prop: 'id',
						_schema: U.addSerializable({
							name: 'ahoy.npcSchema',
							value: new PACK.quickDev.QSchema({
								c: PACK.quickDev.QDict,
								p: { },
								i: {
									id:		{ c: PACK.quickDev.QInt,		p: { name: 'id',	value: 0 } },
									type:	{ c: PACK.quickDev.QString,		p: { name: 'type', 	value: '' } },
									pos:	{ c: PACK.quickDev.QVector2D,	p: { name: 'pos', 	value: { x: 0, y: 0 } } },
									user:	{ c: PACK.quickDev.QRef,		p: { name: 'user',	value: '', baseAddress: 'app.users' } },
								}
							})
						}),
					})
				]
			})
		};
	},
	runAfter: function() {
		var root = PACK.ahoy.queryHandler;
		// console.log('SIZE:', JSON.stringify(root, function(key, value) { return key === 'par' ? '' : value; }).length);
		
		if (U.isServer()) return;
		
		PACK.ahoy.scene.go();
		
		var users = root.getChild('users');
		var myIp = U.request({
			params: {
				address: '',
				command: 'getIp'
			},
			onComplete: function(response) {
				var ip = response.ip;
				
				var playGame = function(user) {
					console.log('PLAYING GAME with user', user.simplified());
				};
				
				users.$filter({
					filter: { i: {
						ip: { p: { value: ip } },
					} },
					onComplete: function(response) {
						var schemas = response.schemaParams;
						
						if (schemas.length > 1) throw 'more than 1 matching schema?';
						
						if (schemas.length === 1) {
							
							var userSchema = new PACK.quickDev.QSchema(schemas[0]);
							playGame(users.addChild(userSchema.actualize()));
							
						} else {
							
							users.$getNewChild({
								params: {
									name: 'Gershom',
								},
								onComplete: function(response) {
									var userSchema = new PACK.quickDev.QSchema(response.schema);
									playGame(userSchema.actualize());
								}
							});
							
						}
					}
				});
			}
		});
		
	}
});
package.build();
