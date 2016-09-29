var package = new PACK.pack.Package({ name: 'geom',
	dependencies: [ ],
	buildFunc: function() {
		return {
			Geom: PACK.uth.makeClass({ name: 'Geom',
				methods: function(sc, c) { return {
					init: function(params /* */) {
					}
				};}
			}),
			Point: PACK.uth.makeClass({ name: 'Point',
				superclassName: 'Geom',
				methods: function(sc, c) { return {
					init: function(params /* x, y */) {
						sc.init.call(this, params);
						this.x = U.param(params, 'x', 0);
						this.y = U.param(params, 'y', 0);
					},
					angleMove: function(ang, dist) {
						return new PACK.geom.Point({
							x: this.x + (Math.cos(ang) * dist),
							y: this.y + (Math.sin(ang) * dist)
						});
					},
					angTo: function(pt2) { 
						return Math.atan2(pt2.y - this.y, pt2.x - this.x); 
					},
					rotate: function(pt, rot) {
						var ang = pt.angTo(this);
						var dist = pt.dist(this);
						return pt.angleMove(ang + rot, dist);
					},
					distSqr: function(pt2) {
						var dx = this.x - pt2.x;
						var dy = this.y - pt2.y;
						return (dx * dx) + (dy * dy);
					},
					dist: function(pt2) {
						return Math.sqrt(this.distSqr(pt2));
					},
					mag: function() {
						return Math.sqrt((this.x * this.x) + (this.y * this.y));
					},
					add: function(pt2) {
						return new PACK.geom.Point({
							x: this.x + pt2.x,
							y: this.y + pt2.y
						});
					},
					sub: function(pt2) {
						return new PACK.geom.Point({
							x: this.x - pt2.x,
							y: this.y - pt2.y
						});
					},
					scale: function(n) {
						return new PACK.geom.Point({
							x: this.x * n,
							y: this.y * n
						});
					},
					conv: function() {
						return new PACK.geom.Point({
							x: this.y,
							y: this.x
						});
					},
					perp: function() {
						return new PACK.geom.Point({
							x: -this.y,
							y: this.x
						});
					},
					perp2: function() {
						return new PACK.geom.Point({
							x: this.y,
							y: -this.x
						});
					},
					norm: function() {
						var mult = 1 / this.mag();
						return this.scale(mult);
					},
					dot: function(pt2) {
						return (this.x * pt2.y) + (this.y * pt2.x);
					}
				};}
			}),
			Bound: PACK.uth.makeClass({ name: 'Bound',
				superclassName: 'Geom',
				methods: function(sc, c) { return {
					init: function(params /* x, y, rot */) {
						this.pt = new PACK.geom.Point(params);
						this.rot = U.param(params, 'rot', 0);
					}
				};}
			}),
			Circle: PACK.uth.makeClass({ name: 'Circle',
				superclassName: 'Bound',
				methods: function(sc, c) { return {
					init: function(params /* x, y, rot, r */) {
						sc.init.call(this, params);
						this.r = U.param(params, 'r', 1);
					},
					collides: function(b) {
						if (b instanceof PACK.geom.Circle) {
							var rSum = this.r + b.r;
							return this.pt.distSqr(b.pt) < (rSum * rSum);
						} else {
							throw new Error('Cannot collide Circle with "' + b.constructor.title + '"');
						}
					},
				};}
			}),
			Rect: PACK.uth.makeClass({ name: 'Rect',
				superclassName: 'Bound',
				methods: function(sc, c) { return {
					init: function(params /* x, y, rot, w, h */) {
						// Note that "w" and "h" refer to width/height when rotation is 0
						sc.init.call(this, params);
						this.w = U.param(params, 'w', 1);
						this.h = U.param(params, 'h', 1);
					}
				};}
			})
				 
		};
	},
});
package.build();
