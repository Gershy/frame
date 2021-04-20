global.rooms['internal.real.htmlBrowser.Art'] = async foundation => {
  
  let Art = U.inspire({ name: 'Art', methods: (insp, Insp) => ({
    init: function({ pixelDensityMult=1, pixelCount=null }={}) {
      if (pixelDensityMult !== 1 && pixelCount) throw Error(`Can't specify pixel density and pixel count`);
      this.pixelDensityMult = pixelDensityMult; // 1 is standard; 0.5 is low-res, 1.5 is hi-res
      this.pixelCount = pixelCount; // e.g. [ 620, 480 ]
    }
  })});
  
};

0 && (art, real, canvasDom) => {
  
  let scalePxW = 1;
  let scalePxH = 1;
  let canvasW = canvasDom.width; // Only an initial value; later will reflect the client rect width of canvas
  let canvasH = canvasDom.height; // Only an initial value; later will reflect the client rect height of canvas
  let ctx = canvasDom.getContext('2d');
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
  
  real.draw = {
    getDims: () => ({
      pxW: canvasDom.width, pxH: canvasDom.height,
      w: canvasW, h: canvasH,
      hw: canvasW >> 1, hh: canvasH >> 1
    }),
    initFrameCen: (col, f) => {
      real.draw.frame(() => {
        real.draw.trn(canvasDom.width >> 1, -(canvasDom.height >> 1));
        if (col) real.draw.rectCen(0, 0, canvasDom.width, canvasDom.height, { fillStyle: col });
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
      real.draw.rect(x - w * 0.5, y - h * 0.5, w, h, style);
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
      let img = keep.getImage();
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
      real.draw.image(keep, x - (w >> 1), y - (h >> 1), w, h, alpha);
      // let hw = w >> 1;
      // let hh = h >> 1;
      // let img = keep.getImage();
      // try {
      //   ctx.imageSmoothingEnabled = false;
      //   ctx.globalAlpha = alpha;
      //   ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x - hw, -y - hh, w, h);
      //   ctx.globalAlpha = 1;
      //   ctx.imageSmoothingEnabled = true;
      // } catch(err) {
      //   console.log('BAD IMG:', img);
      // }
    },
    path: (style, f) => {
      ctx.beginPath(); f(pathFns); ctx.closePath();
      for (let k in style) ctx[k] = style[k];
      if (style.fillStyle) ctx.fill();
      if (style.strokeStyle) ctx.stroke();
    }
  };
  
  let keys = Set();
  real.keys = { nozz: Nozz() };
  
  canvasDom.addEventListener('keydown', evt => {
    if (keys.has(evt.keyCode)) return;
    keys.add(evt.keyCode);
    real.keys.nozz.drip(keys);
  });
  canvasDom.addEventListener('keyup', evt => {
    if (!keys.has(evt.keyCode)) return;
    keys.rem(evt.keyCode);
    real.keys.nozz.drip(keys);
  });
  canvasDom.addEventListener('blur', evt => {
    if (keys.isEmpty()) return;
    keys.clear();
    real.keys.nozz.drip(keys);
  });
  
  let resizeInterval = null;
  let resizeFn = () => {
    let { width, height } = canvasDom.getBoundingClientRect();
    if (width === canvasW && height === canvasH) return;
    canvasW = width; canvasH = height;
    
    if (!art.pixelCount) {
      canvasDom.width = Math.ceil(width * art.pixelDensityMult);
      canvasDom.height = Math.ceil(height * art.pixelDensityMult);
      scalePxW = canvasDom.width / (width * art.pixelDensityMult);
      scalePxH = canvasDom.height / (height * art.pixelDensityMult);
    } else {
      scalePxW = canvasDom.width / width;
      scalePxH = canvasDom.height / height;
    }
    
  };
  real.addFn = () => {
    resizeFn();
    resizeInterval = setInterval(resizeFn, 500);
    canvasDom.focus();
  };
  real.remFn = () => {
    console.log('Clearing canvas interval');
    clearInterval(resizeInterval);
  };
  
};
