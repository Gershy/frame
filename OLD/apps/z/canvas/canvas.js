var package = new PACK.pack.Package({ name: 'canvas',
	dependencies: [ 'geom' ],
	buildFunc: function() {
		return {
			CanvasGraphics: U.makeClass({ name: 'CanvasGraphics',
				methods: function(sc, c) { return {
					init: function(params /* canvas */) {
						this.canvas = U.param(params, 'canvas');
						this.g = this.canvas.getContext('2d');
					},
					clear: function() {
						this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
					},
					prepareDraw: function(params /* */) {
						
					},
					circle: function(pt, r) {
						this.g.beginPath();
						this.g.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
						this.g.stroke();
						this.g.fill();
					},
					line: function(pt1, pt2) {
						this.g.beginPath();
						this.g.moveTo(pt1.x, pt1.y);
						this.g.lineTo(pt2.x, pt2.y);
						this.g.stroke();
					},
					push: function(params /* translate, rotate, scale, stroke */) {
						this.g.save();
						for (var k in params) c[k](this.g, params[k]);
					},
					pop: function() {
						this.g.restore();
					}
				};},
				statik: {
					scale: 			function(g, v) { g.scale(v, v); },
					translate: 	function(g, v) { g.translate(v.x, v.y); },
					rotate:			function(g, v) { g.rotate(v); },
					width:			function(g, v) { g.lineWidth = v; },
					stroke:			function(g, v) { g.strokeStyle = v; },
					fill:				function(g, v) { g.fillStyle = v; }
				}
			}),
			Canvas: U.makeClass({ name: 'Canvas',
				methods: function(sc, c) { return {
					init: function(params /* canvas, dataUpdate, dataUpdateFps, graphicsUpdate, resizeChecking, trackMouse, trackKeys */) {
						this.canvas = U.param(params, 'canvas');
						
						this.dataUpdate = U.param(params, 'dataUpdate');
						this.dataUpdateFps = U.param(params, 'dataUpdateFps', 60);
						this.dataUpdateIntervalRef = null;
						
						this.graphicsUpdate = U.param(params, 'graphicsUpdate');
						this.graphics = new PACK.canvas.CanvasGraphics({ canvas: this.canvas });
						
						this.resizeChecking = U.param(params, 'resizeChecking', true);
						this.trackMouse = U.param(params, 'trackMouse', true);
						this.trackKeys = U.param(params, 'trackKeys', true);
						
						// Set up values to track keys if necessary
						if (this.trackKeys) {
							this.keys = U.range(256).map(function(n) { return true; });
							console.log(this.keys);
						} else {
							this.keys = null;
						}
						
						// Set up mouse tracking if necessary
						if (this.trackMouse) {
							var pass = this;
							this.mouse = {
								pt: new PACK.geom.Point({ x: 0, y: 0 }),
								buttons: [ 0, 0, 0 ]
							};
							this.canvas.addEventListener('mousemove', function(e) {
								var canvasBound = pass.canvas.getBoundingClientRect();
								pass.mouse.pt = new PACK.geom.Point({
									x: (e.clientX - canvasBound.left) * 2 - pass.canvas.width,
									y: (e.clientY - canvasBound.top) * 2 - pass.canvas.height
								});
							});
							this.canvas.onmousedown = function(e) { pass.mouse.buttons[0] = true; };
							this.canvas.onmouseup = function(e) { pass.mouse.buttons[0] = false; };
						} else {
							this.mouse = null;
						}
						
						// Start the animation loop
						this.looping = true;
						var pass = this;
						requestAnimationFrame(function() { pass.loop(); });
						
						var fps = this.dataUpdateFps;
						var fpm = fps / 1000;
						
						var spf = 1 / fps;
						var mpf = 1 / fpm;
						
						console.log('Each frame lasts ' + spf + ' seconds');
						console.log('The delay between repetitions is ' + mpf + 'ms');
						
						this.dataUpdateIntervalRef = setInterval(function() {
							pass.dataUpdate({ seconds: spf, mouse: pass.mouse, keys: pass.keys });
						}, mpf);
            
					},
					loop: function() {
						// Basing the graphics loop continuation off the data update
						// means both can be cancelled at the same time when the data
						// update is cleared.
						if (this.dataUpdateIntervalRef === null) return;
						
						if (this.resizeChecking) {
							var cBound = this.canvas.getBoundingClientRect();
							var pBound = this.canvas.parentNode.getBoundingClientRect();
							if (cBound.width !== pBound.width || cBound.height !== pBound.height) {
								this.canvas.width = pBound.width;
								this.canvas.height = pBound.height;
							}
						}
						
						this.graphics.clear();
						this.graphics.push({
							translate: { x: this.canvas.width * 0.5, y: this.canvas.height * 0.5 },
							scale: 0.5,
						});
						this.graphicsUpdate(this.graphics);
						this.graphics.pop();
						
						var pass = this;
						requestAnimationFrame(function() { pass.loop(); });
					},
					end: function() {
						clearInterval(this.dataUpdateIntervalRef);
						this.dataUpdateIntervalRef = null;
					}
				};}
			})
		};
	},
});
package.build();
