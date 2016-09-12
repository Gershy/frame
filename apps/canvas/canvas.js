var package = new PACK.pack.Package({ name: 'canvas',
	dependencies: [ 'geom' ],
	buildFunc: function() {
		return {
			CanvasGraphics: PACK.uth.makeClass({ name: 'CanvasGraphics',
				methods: function(sc, c) { return {
					init: function(params /* canvas */) {
						this.canvas = U.param(params, 'canvas');
						this.g = this.canvas.getContext('2d');
					},
					clear: function() {
						this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
					},
					circle: function(pt, r) {
						this.g.beginPath();
						this.g.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
						this.g.stroke();
					},
					push: function(params /* translate, rotate */) {
						this.g.save();
						var translate = U.param(params, 'translate', null);
						var rotate = U.param(params, 'rotate', null);
						
						if (translate) 	this.g.translate(translate.x, translate.y);
						if (rotate) 	this.g.rotate(translate);
					},
					pop: function() {
						this.g.restore();
					}
				};}
			}),
			Canvas: PACK.uth.makeClass({ name: 'Canvas',
				methods: function(sc, c) { return {
					init: function(params /* canvas, stepData, step, resizeChecking */) {
						this.canvas = U.param(params, 'canvas');
						this.stepData = U.param(params, 'stepData');
						this.step = U.param(params, 'step');
						this.graphics = new PACK.canvas.CanvasGraphics({ canvas: this.canvas });
						
						this.resizeChecking = U.param(params, 'resizeChecking', true);
						this.trackMouse = U.param(params, 'trackMouse', true);
						this.trackKeys = U.param(params, 'trackKeys', true);
						
						// Set up values to track keys if necessary
						if (this.trackKeys) {
							this.keys = U.rng(256).map(function(n) { return true; });
							console.log(this.keys);
						} else {
							this.keys = null;
						}
						
						// Set up mouse tracking if necessary
						if (this.trackMouse) {
							var pass = this;
							this.mouseLoc = { x: 0, y: 0 };
							this.canvas.addEventListener('mousemove', function(e) {
								pass.mouseLoc = new PACK.geom.Point({
									x: e.layerX - (pass.canvas.width * 0.5),
									y: e.layerY - (pass.canvas.height * 0.5)
								});
							});
						} else {
							this.mouseLoc = null;
						}
						
						// Start the animation loop
						this.looping = true;
						var pass = this;
						requestAnimationFrame(function() { pass.loop(); });
					},
					loop: function() {
						if (this.resizeChecking) {
							var cBound = this.canvas.getBoundingClientRect();
							var pBound = this.canvas.parentNode.getBoundingClientRect();
							if (cBound.width !== pBound.width || cBound.height !== pBound.height) {
								this.canvas.width = pBound.width;
								this.canvas.height = pBound.height;
							}
						}
						
						var data = this.stepData({ mouse: this.mouseLoc, keys: this.keys });
						if (data !== null) {
							this.graphics.clear();
							this.graphics.push({
								translate: { x: this.canvas.width * 0.5, y: this.canvas.height * 0.5 }
							});
							this.step(this.graphics, data);
							this.graphics.pop();
						}
						
						if (this.looping) {
							var pass = this;
							requestAnimationFrame(function() { pass.loop(); });
						}
					},
				};}
			})
		};
	},
});
package.build();
