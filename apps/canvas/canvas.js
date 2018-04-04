/// {SERVER=
throw new Error('For client-side use only');
/// =SERVER}

var package = new PACK.pack.Package({ name: 'canvas',
  dependencies: [ 'p', 'informer', 'userify' ],
  buildFunc: function(cv, p, nf, uf) {
    
    cv.Graphics = U.makeClass({ name: 'Graphics',
      methods: function(sc, c) { return {
        init: function(params /* canvas */) {
          this.canvas = U.param(params, 'canvas');
          this.g = this.canvas.getContext('2d')
        },
        clear: function() {
          this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
        push: function(params /* translate, rotate, scale, stroke, fill */) {
          this.g.save();
          if (params) for (var k in params) c[k](this.g, params[k]);
        },
        pop: function() {
          this.g.restore();
        }
      };},
      statik: {
        scale: 			function(g, v) { U.isObj(v, Object) ? g.scale(v.x, v.y) : g.scale(v, v); },
        translate: 	function(g, v) { g.translate(v.x, v.y); },
        rotate:			function(g, v) { g.rotate(v); },
        width:			function(g, v) { g.lineWidth = v; },
        stroke:			function(g, v) { g.strokeStyle = v; },
        fill:				function(g, v) { g.fillStyle = v; }
      }
    });
    
    cv.CanvasView = U.makeClass({ name: 'CanvasView', superclass: uf.View,
      description: 'Generates a canvas and paint handler for ' +
        'arbitrary graphics',
      methods: function(sc, c) { return {
        init: function(params /* name, options { centered, trackKeys, trackMouse }, drawFunc(graphicsContext, millis) */) {
          
          // TODO: Note that CanvasView's parent View's size should be fixed! If
          // an increase in CanvasView's size triggers a size change in its parent
          // View's bounding, it will continually resize and loop size changes in
          // its parent - this is a VERY LAGGY EXPERIENCE.
          
          sc.init.call(this, params);
          
          this.drawFunc = U.param(params, 'drawFunc');
          this.options = O.update({ centered: false, trackKeys: false, trackMouse: false }, U.param(params, 'options', {}));
          this.graphics = null;
          this.lastMillis = 0;
          this.running = false;
          this.bounds = null;
          
          if (this.options.trackKeys) {
            
            this.keys = {};
            this.keyInformer = new nf.ValueInformer({ value: this.keys });
            
          }
          
          if (this.options.trackMouse) {
            
            var pass = this;
            this.mouse = {
              pt: { x: 0, y: 0 },
              buttons: [ false, false, false ]
            };
            this.mouseInformer = new nf.ValueInformer({ value: this.mouse });
            
          }
          
        },
        createDomRoot: function() {
          
          var pass = this;
          var canvas = document.createElement('canvas');
          canvas.setAttribute('tabindex', 0);
          
          if (this.options.trackMouse) {
            
            canvas.addEventListener('mousemove', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var canvasBound = pass.bounds || canvas.getBoundingClientRect();
              pass.mouse.pt = {
                x: (e.clientX - canvasBound.left) * 2 - canvas.width,
                y: (e.clientY - canvasBound.top) * 2 - canvas.height
              };
              pass.mouseInformer.worry('invalidated', pass.mouse);
            });
            canvas.onmousedown = function(e) {
              e.preventDefault();
              e.stopPropagation();
              pass.mouse.buttons[0] = true;
              pass.mouseInformer.worry('invalidated', pass.mouse);
            };
            canvas.onmouseup = function(e) {
              e.preventDefault();
              e.stopPropagation();
              pass.mouse.buttons[0] = false;
              pass.mouseInformer.worry('invalidated', pass.mouse);
            };
            
          }
          
          if (this.options.trackKeys) {
            
            canvas.addEventListener('keydown', function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              var code = e.keyCode;
              if (O.contains(pass.keys, code)) return;
              
              pass.keys[code] = true;
              pass.keyInformer.worry('invalidated', pass.keys);
            });
            canvas.addEventListener('keyup', function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              var code = e.keyCode;
              if (!O.contains(pass.keys, code)) return;
              
              delete pass.keys[code];
              pass.keyInformer.worry('invalidated', pass.keys);
            });
            
          }
          
          return canvas;
          
        },
        
        requestFocus: function() {
          if (this.domRoot) this.domRoot.focus();
        },
        update: function() {
          
          if (!this.running) return;
          
          var canvas = this.domRoot;
          this.bounds = canvas.parentNode.getBoundingClientRect();
          var bw = Math.ceil(this.bounds.width);
          var bh = Math.ceil(this.bounds.height);
          
          if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
          
          var prevMillis = this.lastMillis;
          this.lastMillis = +new Date();
          
          var pushParams = {};
          if (this.options.centered) pushParams.translate = { x: bw >> 1, y: bh >> 1 };
          pushParams.scale = { x: 1, y: -1 };
          
          this.graphics.clear();
          this.graphics.push(pushParams);
          this.drawFunc(this.graphics, this.lastMillis - prevMillis);
          this.graphics.pop();
          
          requestAnimationFrame(this.update.bind(this));
          
        },
        
        start0: function() {
          
          sc.start0.call(this);
          
          this.running = true;
          this.graphics = new cv.Graphics({ canvas: this.domRoot });
          requestAnimationFrame(this.update.bind(this));
          
        },
        stop0: function() {
          
          this.running = false;
          this.context = null;
          sc.stop0.call(this);
          
        }
      };}
    });
    
  }
});
package.build();
