global.rooms['internal.real.htmlBrowser.Art'] = async foundation => {
  
  let { Tmp, MemSrc, TimerSrc } = U.logic;
  let Layout = await foundation.getRoom('internal.real.generic.Layout');
  
  return U.form({ name: 'Art', has: { Layout }, props: (insp, Insp) => ({
    init: function({ pixelDensityMult=1, pixelCount=null }={}) {
      if (pixelDensityMult !== 1 && pixelCount) throw Error(`Can't specify pixel density and pixel count`);
      this.pixelDensityMult = pixelDensityMult; // 1 is standard; 0.5 is low-res, 1.5 is hi-res
      this.pixelCount = pixelCount; // e.g. [ 620, 480 ]
      this.keys = Set();
      this.keysSrc = MemSrc.Prm1(this.keys);
      this.animation = null;
    },
    install: function(real) {
      
      let tmp = Tmp();
      
      let canvas = document.createElement('canvas');
      canvas.style.gain({ position: 'absolute', width: '100%', height: '100%', left: '0', top: '0' });
      canvas.setAttribute('tabIndex', '0');
      
      let domNode = real.domNode;
      domNode.appendChild(canvas);
      tmp.endWith(() => canvas.remove());
      
      let keyDnFn = evt => {
        if (this.keys.has(evt.keyCode)) return;
        this.keys.add(evt.keyCode);
        this.keysSrc.send(this.keys);
      };
      let keyUpFn = evt => {
        if (!this.keys.has(evt.keyCode)) return;
        this.keys.rem(evt.keyCode);
        this.keysSrc.send(this.keys);
      };
      let blurFn = evt => {
        if (this.keys.isEmpty()) return;
        this.keys.clear();
        this.keysSrc.send(this.keys);
      };
      canvas.addEventListener('keydown', keyDnFn);
      canvas.addEventListener('keyup', keyUpFn);
      canvas.addEventListener('blur', blurFn);
      tmp.endWith(() => {
        canvas.removeEventListener('keydown', keyDnFn);
        canvas.removeEventListener('keyup', keyUpFn);
        canvas.removeEventListener('blur', blurFn);
      });
      
      let ctx = canvas.getContext('2d');
      let pathFns = {
        jump: (x, y) => ctx.moveTo(x, -y),
        draw: (x, y) => ctx.lineTo(x, -y),
        curve: (x, y, cx1, cy1, cx2, cy2) => ctx.bezierCurveTo(cx1, -cy1, cx2, -cy2, x, y),
        arc: (x1, y1, x2, y2, x3, y3, ccw=true) => {
          
          // TODO: (x1,y1) is the most recent turtle-graphics point
          
          y1 *= -1; y2 *= -1; y3 *= -1;
          
          let dx = (x2 - x1);
          let dy = (y2 - y1);
          let r = Math.sqrt(dx * dx + dy * dy);
          let ang1 = Math.atan2(y1 - y2, x1 - x2);
          let ang2 = Math.atan2(y3 - y2, x3 - x2);
          ctx.arc(x2, y2, r, ang1, ang2, ccw);
        }
      };
      let draw = {
        
        getDims: () => ({
          pxW: canvas.width, pxH: canvas.height,
          w: canvasW, h: canvasH,
          hw: canvasW >> 1, hh: canvasH >> 1
        }),
        
        initFrameCen: (col, f) => {
          draw.frame(() => {
            draw.trn(canvas.width >> 1, -(canvas.height >> 1));
            if (col) draw.rectCen(0, 0, canvas.width, canvas.height, { fillStyle: col });
            f();
          });
        },
        frame: f => { ctx.save(); f(); ctx.restore(); },
        rot: ang => ctx.rotate(ang),
        trn: (x, y) => ctx.translate(x, -y),
        scl: (x, y=x) => ctx.scale(x, y),
        rect: (x, y, w, h, style) => {
          for (let k in style) ctx[k] = style[k];
          if (style.fillStyle) ctx.fillRect(x, -(y + h), w, h);
          if (style.strokeStyle) ctx.strokeRect(x, -(y + h), w, h);
        },
        rectCen: (x, y, w, h, style) => {
          draw.rect(x - w * 0.5, y - h * 0.5, w, h, style);
        },
        circ: (x, y, r, style) => {
          ctx.beginPath();
          ctx.arc(x, -y, r, Math.PI * 2, 0);
          for (let k in style) ctx[k] = style[k];
          if (style.fillStyle) ctx.fill();
          if (style.strokeStyle) ctx.stroke();
        },
        image: (keep, x, y, w, h, alpha=1) => {
          let hw = w >> 1;
          let hh = h >> 1;
          let img = new Image(); //keep.getImage();
          img.src = keep.getUrl();
          try {
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = alpha;
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, -(y + h), w, h);
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = true;
          } catch(err) {
            console.log('BAD IMG:', img);
          }
        },
        imageCen: (keep, x, y, w, h, alpha=1) => {
          draw.image(keep, x - (w >> 1), y - (h >> 1), w, h, alpha);
        },
        path: (style, f) => {
          ctx.beginPath(); f(pathFns); ctx.closePath();
          for (let k in style) ctx[k] = style[k];
          if (style.fillStyle) ctx.fill();
          if (style.strokeStyle) ctx.stroke();
        }
        
      };
      
      (async () => {
        
        await Promise(r => requestAnimationFrame(r));
        while (tmp.onn()) {
          
          let { width: canvasW, height: canvasH } = real.domNode.getBoundingClientRect();
          let [ desiredPxW, desiredPxH ] = this.pixelCount
            ? this.pixelCount
            : [ Math.ceil(canvasW * this.pixelDensityMult), Math.ceil(canvasH * this.pixelDensityMult) ];
          
          // Resize if necessary
          if (desiredPxW !== canvas.width || desiredPxH !== canvas.height) {
            [ canvas.width, canvas.height ] = [ desiredPxW, desiredPxH ];
          }
          
          let animationFn = real.params.has('animationFn') ? real.params.animationFn : Function.stub;
          animationFn(draw);
          await Promise(r => requestAnimationFrame(r));
          
        }
        
      })();
      
      // Make several quick attempts to focus the canvas
      tmp.limit(TimerSrc({ foundation, num: 5, ms: 100 })).route(() => canvas.focus());
      
      return tmp;
      
    },
    render: function() {
      
    }
  })});
  
};
