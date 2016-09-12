var package = new PACK.pack.Package({ name: 'defend',
	dependencies: [ 'canvas', 'geom' ],
	buildFunc: function() {
		var classes = {};
		
		return {
			resources: { css: [ 'apps/defend/style.css' ] },
			
			Renderable: PACK.uth.makeClass({ name: 'Renderable',
				namespace: classes,
				methods: function(sc, c) { return {
					init: function(params /* */) {
						
					}
				};}
			}),
			Unit: PACK.uth.makeClass({ name: 'Unit',
				namespace: classes,
				methods: function(sc, c) { return {
					init: function(params /* name, img, r, speed */) {
						this.name = U.param(params, 'name');
						this.img = U.param(params, 'img');
						this.bound = new PACK.geom.Circle({ x: 0, y: 0, r: U.param(params, 'r', 1) });
						this.speed = U.param(params, 'speed');
						
						this.rot = 0;
					},
					step: function(seconds) {
						this.bound.pt = this.bound.pt.angleMove(this.rot, this.speed * seconds);
					},
					draw: function(graphics) {
						graphics.circle(this.bound.pt, this.bound.r);
					}
				};}
			}),
			EnemyUnit: PACK.uth.makeClass({ name: 'EnemyUnit',
				namespace: classes,
				superclassName: 'Unit',
				methods: function(sc, c) { return {
					init: function(params /* name, img, r, speed */) {
						sc.init.call(this, params);
						// HEEERE!!!!! The EnemyUnit needs to be killable by bullets,
						// and do damage when it gets to the base.
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
			
			var units = [];
			var base = new PACK.defend.Unit({ name: 'base', img: null, r: 30, speed: 0 });
			
			for (var i = 0; i < 30; i++) {
				var unit = new PACK.defend.EnemyUnit({ name: 'enemy', img: null, r: 10, speed:  5 });
				var rot = Math.random() * Math.PI * 2;
				var dist = 170 + (Math.random() * 30);
				unit.bound.pt = new PACK.geom.Point({ x: Math.cos(rot) * dist, y: Math.sin(rot) * dist });
				unit.rot = (rot + (Math.PI)) % (Math.PI * 2);
				
				units.push(unit);
			}
			
			units.push(base);
			
			var canvas = new PACK.canvas.Canvas({
				canvas: canvas,
				stepData: function(input) {
					for (var i = 0, len = units.length; i < len; i++) {
						units[i].step(0.05);
					}
					
					return { units: units };
				},
				step: function(graphics, data) {
					var units = data.units;
					for (var i = 0, len = units.length; i < len; i++) {
						units[i].draw(graphics);
					}
				}
			});
		}
	}
});
package.build();
