/// {SERVER=
throw new Error('For client-side use only');
/// =SERVER}

var package = new PACK.pack.Package({ name: 'canvas',
  dependencies: [ 'p', 'userify' ],
  buildFunc: function(cv, p, uf) {
    
    cv.CanvasView = U.makeClass({ name: 'CanvasView', superclass: uf.View,
      description: 'Generates a canvas and paint handler for ' +
        'arbitrary graphics',
      methods: function(sc, c) { return {
        init: function(params /* name, options { centered }, drawFunc(graphicsContext, millis) */) {
          
          // TODO: Note that CanvasView's parent View's size should be fixed! If
          // an increase in CanvasView's size triggers a size change in its parent
          // View's bounding, it will continually resize and loop size changes in
          // its parent - this is a VERY LAGGY EXPERIENCE.
          
          sc.init.call(this, params);
          
          this.drawFunc = U.param(params, 'drawFunc');
          this.options = O.update({ centered: false }, U.param(params, 'options', {}));
          this.context = null;
          this.lastMillis = 0;
          this.running = false;
          
        },
        createDomRoot: function() {
          return document.createElement('canvas');
        },
        update: function() {
          
          if (!this.running) return;
          
          var canvas = this.domRoot;
          var bounds = canvas.parentNode.getBoundingClientRect();
          var bw = Math.ceil(bounds.width);
          var bh = Math.ceil(bounds.height);
          
          if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
          
          this.context.clearRect(0, 0, canvas.width, canvas.height)
          
          var prevMillis = this.lastMillis;
          this.lastMillis = +new Date();
          
          this.context.save();
          if (this.options.centered) { this.context.translate(bw >> 1, bh >> 1); }
          this.drawFunc(this.context, this.lastMillis - prevMillis);
          this.context.restore();
          
          requestAnimationFrame(this.update.bind(this));
          
        },
        
        start0: function() {
          
          sc.start0.call(this);
          
          this.running = true;
          this.context = this.domRoot.getContext('2d');
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
