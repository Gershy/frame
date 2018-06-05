// ZOOM OUT would be a really cool feature

var package = new PACK.pack.Package({ name: 'defend',
	dependencies: [ 'canvas', 'geom' ],
	buildFunc: function() {
		var classes = {};
		
		return {
			resources: { css: [ 'apps/defend/style.css' ] },
			
			Realm: U.makeClass({ name: 'Realm',
				namespace: classes,
				methods: function(sc, c) { return {
					init: function(params /* enemyFreq */) {
						this.enemyFunc = U.param(params, 'enemyFunc');
						this.enemyFreq = U.param(params, 'enemyFreq', 5);
						this.spawnDist = U.param(params, 'spawnDist', 1000);
						
						this.id = 0;
						
						this.base = null;
						
						this.addEnemies = [];
						this.enemies = {};
						this.remEnemies = [];
						
						this.addBullets = [];
						this.bullets = {};
						this.remBullets = [];
					},
					nextId: function() { return U.id(this.id++); },
					addEnemy: function(enemy) { this.addEnemies.push(enemy); },
					remEnemy: function(enemy) { this.remEnemies.push(enemy.id); },
					addBullet: function(bullet) { this.addBullets.push(bullet); },
					remBullet: function(bullet) { this.remBullets.push(bullet.id); },
					step: function(params /* seconds, mouse, keys */) {
						this.calcs = 0;
						
						var seconds = U.param(params, 'seconds');
						
						// THIS DOESN'T MAKE SENSE ENEMY FREQUENCY IS MESSSSED RIGHT NOW
						var n = this.enemyFreq * seconds;
						
						while (Math.random() < n) {
							var unit = this.enemyFunc();
							var rot = Math.random() * Math.PI * 2;
							unit.bound.pt = new PACK.geom.Point({ x: Math.cos(rot) * this.spawnDist, y: Math.sin(rot) * this.spawnDist });
							unit.bound.rot = (rot + (Math.PI)) % (Math.PI * 2);
				
							this.addEnemy(unit);
							
							n -= Math.random();
						}
						
						// Add in any enemies/bullets
						for (var i = 0, len = this.addEnemies.length; i < len; i++) {
							var enemy = this.addEnemies[i];
							this.enemies[enemy.id] = enemy;
						}
						for (var i = 0, len = this.addBullets.length; i < len; i++) {
							var bullet = this.addBullets[i];
							this.bullets[bullet.id] = bullet;
						}
						this.addEnemies = [];
						this.addBullets = [];
						
						// Update base, enemies and bullets
						this.base.step(params);
						if (!this.base.isAlive()) console.log('GAME OVER!');
						
						for (var k in this.enemies) {
							var enemy = this.enemies[k];
							enemy.step(params);
							if (!enemy.isAlive()) this.remEnemy(enemy);
						}
						
						for (var k in this.bullets) {
							var bullet = this.bullets[k];
							bullet.step(params);
							if (!bullet.isAlive()) this.remBullet(bullet);
						}
						
						// Delete any enemies/bullets
						for (var i = 0, len = this.remEnemies.length; i < len; i++) delete this.enemies[this.remEnemies[i]];
						for (var i = 0, len = this.remBullets.length; i < len; i++) delete this.bullets[this.remBullets[i]];
						this.remEnemies = [];
						this.remBullets = [];
						
						//console.log(this.calcs);
					},
					draw: function(graphics) {
						this.base.draw(graphics);
						for (var k in this.enemies) this.enemies[k].draw(graphics);
						for (var k in this.bullets) this.bullets[k].draw(graphics);
					}
				};}
			}),
			Unit: U.makeClass({ name: 'Unit',
				namespace: classes,
				methods: function(sc, c) { return {
					init: function(params /* realm, name, img, r, speed */) {
						this.realm = U.param(params, 'realm');
						this.name = U.param(params, 'name');
						this.img = U.param(params, 'img', null);
						this.bound = new PACK.geom.Circle({ x: 0, y: 0, r: U.param(params, 'r', 1) });
						this.aliveSecs = 0;
						
						this.id = this.realm.nextId();
					},
					isAlive: function() { return true; },
					step: function(params /* seconds */) {
						var seconds = U.param(params, 'seconds');
						this.aliveSecs += seconds;
					},
					draw: function(graphics) {
						graphics.circle(this.bound.pt, this.bound.r);
					}
				};}
			}),
			Weapon: U.makeClass({ name: 'Weapon',
				namespace: classes,
				superclassName: 'Unit',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
						this.active = false;
					},
					step: function(params /* seconds */) {
						if (this.active) this.attack(params);
					},
					attack: function() { throw new Error('not implemented'); },
					draw: function(graphics) {
						graphics.push({ width: 10, stroke: '#aa0000' });
						graphics.line(this.bound.pt, this.bound.pt.angleMove(this.bound.rot, this.bound.r));
						graphics.pop();
					}
				};}
			}),
			AutomaticWeapon: U.makeClass({ name: 'AutomaticWeapon',
				namespace: classes,
				superclassName: 'Weapon',
				methods: function(sc, c) { return {
					init: function(params /* bulletsPerSecond */) {
						sc.init.call(this, params);
						this.bulletsPerSecond = U.param(params, 'bulletsPerSecond', 1000);
						this.bulletDelaySecs = 1 / this.bulletsPerSecond;
						this.cooldownSecs = 0;
					},
					attack: function(params /* seconds */) {
						if (this.cooldownSecs === 0) {
							this.fire();
							this.cooldownSecs = this.bulletDelaySecs;
						}
					},
					step: function(params /* seconds */) {
						sc.step.call(this, params);
						var seconds = U.param(params, 'seconds');
						this.cooldownSecs = Math.max(0, this.cooldownSecs - seconds);
					},
					fire: function() { throw new Error('not implemented'); },
				};}
			}),
			BulletWeapon: U.makeClass({ name: 'BulletWeapon',
				namespace: classes,
				superclassName: 'AutomaticWeapon',
				methods: function(sc, c) { return {
					init: function(params /* numBullets, arc */) {
						sc.init.call(this, params);
						this.bulletFunc = U.param(params, 'bulletFunc');
						this.numBullets = U.param(params, 'numBullets', 10);
						this.arc = U.param(params, 'arc', Math.PI * 0.06);
					},
					fire: function() {
						for (var i = 0; i < this.numBullets; i++) {
							var bullet = this.bulletFunc();
							bullet.bound.pt = this.bound.pt;
							bullet.bound.rot = this.bound.rot + (this.numBullets !== 1
								? (-this.arc + (this.arc * 2 * (i / (this.numBullets - 1))))
								: 0
							);
							this.realm.addBullet(bullet);
						}
					}
				};}
			}),
			Bullet: U.makeClass({ name: 'Bullet',
				namespace: classes,
				superclassName: 'Unit',
				methods: function(sc, c) { return {
					init: function(params /* speed, damage, penetration */) {
						sc.init.call(this, params);
						this.damage = U.param(params, 'damage');
						this.penetration = U.param(params, 'penetration');
						this.speed = U.param(params, 'speed');
						this.range = U.param(params, 'range');
						
						this.hitSet = {};
						this.numHit = 0;
					},
					isAlive: function() {
						return this.numHit < this.penetration && (this.speed * this.aliveSecs < this.range);
					},
					step: function(params /* seconds */) {
						sc.step.call(this, params);
						var seconds = U.param(params, 'seconds');
						this.bound.pt = this.bound.pt.angleMove(this.bound.rot, this.speed * seconds);
						
						var enemies = this.realm.enemies;
						for (var k in enemies) {
							var enemy = enemies[k];
							if (!enemy.isAlive()) continue;
							if (this.bound.collides(enemy.bound) && !(enemy.id in this.hitSet)) {
								this.hitSet[enemy.id] = true;
								this.numHit++;
								this.hit(enemy);
							}
							this.realm.calcs++;
						}
					},
					hit: function(target) {
						target.health = Math.max(0, target.health - this.damage);
					},
					draw: function(graphics) {
						graphics.push({ stroke: '#aa0000', fill: '#aa0000' });
						sc.draw.call(this, graphics);
						graphics.pop();
					}
				};}
			}),
				
			Base: U.makeClass({ name: 'Base',
				namespace: classes,
				superclassName: 'Unit',
				methods: function(sc, c) { return {
					init: function(params /* weapon */) {
						sc.init.call(this, params);
						this.weapon = U.param(params, 'weapon');
						this.alive = true;
						
						this.pt = PACK.geom.ORIGIN;
					},
					isAlive: function() { return this.alive; },
					step: function(params /* seconds */) {
						sc.step.call(this, params);
						
						var mouse = params.mouse;
						var mousePt = mouse.pt;
						var mousePress = mouse.buttons[0];
						
						this.pt = mouse.pt;
						
						this.weapon.pt = this.bound.pt;
						this.weapon.bound.rot = this.bound.pt.angleTo(mousePt);
						this.weapon.active = mousePress;
						
						this.weapon.step(params);
					},
					draw: function(graphics) {
						sc.draw.call(this, graphics);
						
						graphics.push({ width: 0.4, stroke: '#ff0000' });
						graphics.line(this.bound.pt, this.bound.pt.angleMove(this.weapon.bound.rot, 1000));
						graphics.pop();
						
						graphics.push({ stroke: '#a05000', fill: '#a05000' });
						graphics.circle(this.pt, 10);
						graphics.pop();
						
						this.weapon.draw(graphics);
					}
				};}
			}),
			AttackingUnit: U.makeClass({ name: 'AttackingUnit',
				namespace: classes,
				superclassName: 'Unit',
				methods: function(sc, c) { return {
					init: function(params /* name, img, r, speed */) {
						sc.init.call(this, params);
						this.speed = U.param(params, 'speed');
						this.maxHealth = U.param(params, 'maxHealth');
						this.health = this.maxHealth;
						this.damage = U.param(params, 'damage');
					},
					isAlive: function() { return this.health > 0; },
					step: function(params /* seconds */) {
						var seconds = U.param(params, 'seconds');
						this.bound.pt = this.bound.pt.angleMove(this.bound.rot, this.speed * seconds);
						
						if (this.bound.collides(this.realm.base.bound)) {
							this.health = 0;
						}
					}
				};}
			}),
			
			queryHandler: {
				respondToQuery: function(params /* address */, onComplete) {
					onComplete(null);
				}
			}
		};
	},
	runAfter: function() {
		if (!U.isServer()) {
			var canvas = document.createElement('canvas');
			var container = document.createElement('div');
			container.setAttribute('class', 'container');
			container.appendChild(canvas);
			var body = document.getElementsByTagName('body')[0];
			body.appendChild(container);
			
			var realm = new PACK.defend.Realm({
				enemyFreq: 10,
				enemyFunc: function() {
					return new PACK.defend.AttackingUnit({ realm: realm, name: 'enemy', img: null, r: 10,
						speed: 35,
						maxHealth: 15,
						damage: 20
					});
				}
			});
			
			realm.base = new PACK.defend.Base({
				realm: realm,
				name: 'base',
				img: null,
				r: 30,
				speed: 0,
				weapon: new PACK.defend.BulletWeapon({
					realm: realm,
					name: 'wep',
					bulletsPerSecond: 5,
					numBullets: 10,
					arc: Math.PI * 0.035,
					r: 40,
					bulletFunc: function() {
						return new PACK.defend.Bullet({
							realm: realm,
							name: 'bullet',
							speed: 500,
							damage: 30,
							penetration: 1,
							range: 1200,
							r: 8
						});
					}
				})
			});
			
			var canvas = new PACK.canvas.Canvas({
				canvas: canvas,
				dataUpdateFps: 40,
				dataUpdate: function(params /* seconds, mouse, keys */) {
					realm.step(params);
				},
				graphicsUpdate: function(graphics) {
					realm.draw(graphics);
				}
			});
		}
	}
});
package.build();
