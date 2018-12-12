let UID = 0;

U.gain({
  updateElemText: (elem, text) => { text = text.toString(); if (elem.innerHTML !== text) elem.innerText = text; }
});
let dom = {
  toArr: elems => { let ret = []; for (let i = 0, len = elems.length; i < len; i++) ret.push(elems[i]); return ret; },
  id: id => document.getElementById(id),
  cls: cls => dom.toArr(document.getElementsByClassName(cls)),
  cls1: cls => document.getElementsByClassName(cls)[0],
  div: () => document.createElement('div')
};

let RendersToDom = U.inspire({ name: 'RendersToDom', methods: (insp, Insp) => ({
  init: function() {
    this.domElem = null;
  },
  getContainer: function() { throw new Error('not implemented'); },
  getRemovalDelay: function() { return 0; },
  genElem: function() { throw new Error('not implemented'); },
  start: function() {
    this.domElem = this.genElem();
    this.domElem.classList.add('rendered');
    this.getContainer().appendChild(this.domElem);
  },
  end: function() {
    let delay = this.getRemovalDelay();
    if (delay) {
      let domElem = this.domElem;
      this.domElem = null;
      domElem.classList.add('removed');
      setTimeout(() => this.getContainer().removeChild(domElem), delay)
    } else {
      this.getContainer().removeChild(this.domElem);
      this.domElem = null;
    }
  }
})});
let RendersToPixels = U.inspire({ name: 'RendersToPixels', methods: (insp, Insp) => ({
  init: function() {
    
  }
})});

let ClientEntity = U.inspire({ name: 'ClientEntity', insps: { Entity }, methods: (insp, Insp) => ({
  init: function(world, uid=null, data={}) {
    insp.Entity.init.call(this);
    this.world = world;
    if (uid !== null) this.setUid(uid);
    this.data = data;
  }
})});
let Client = U.inspire({ name: 'Client', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
  },
  start: function() {
  },
  update: function() {
  },
  end: function() {
  }
})});

let LocalEntity = U.inspire({ name: 'LocalEntity', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world=null) {
    insp.ClientEntity.init.call(this, world, null, null);
  }
})});
let Camera = U.inspire({ name: 'Camera', insps: { LocalEntity }, methods: (insp, Insp) => ({
  init: function(world) {
    insp.LocalEntity.init.call(this, world);
    
    this.follow = null;
    this.running = false;
    
    let smoothing = 1;
    this.smoothAhd = new SmoothingVal(300, smoothing);
    this.smoothRot = new SmoothingVal(0, smoothing);
    this.smoothX = new SmoothingVal(0, smoothing);
    this.smoothY = new SmoothingVal(0, smoothing);
    this.smoothScl = new SmoothingVal(1, smoothing);
  },
  start: function() {
    this.running = true;
  },
  update: function() {
    
    if (!this.running) return;
    
    let fd = this.follow ? this.follow.data : { rot: 0, loc: [ 0, 0 ] };
    
    // Need to be running and following
    if (!this.running) return;
    if (!this.follow) return;
    
    // Get current client-side actions
    let [ folShooting, folAiming, folInt3, folInt4 ] = this.world.input.i.split('').map(c => c === '1');
    
    // Update smoothed values to approximately sync with css transitions
    this.smoothRot.change(fd.rot);
    this.smoothX.change(fd.loc[0]);
    this.smoothY.change(fd.loc[1]);
    this.smoothScl.change(this.follow.data.visionScale);
    
    // Get "choppy" values for position, rotation, and actions
    let [ folAhd, folRot, folX, folY, folScl ] = [ this.smoothAhd, this.smoothRot, this.smoothX, this.smoothY, this.smoothScl ].map(v => v.choppy());
    
    // Apply css transforms to each world element
    [ this.world.elems.world1, this.world.elems.world2 ].forEach(e => {
      e.style.transform = `translate(0px, ${folAhd}px) rotate(${-folRot}rad) scale(${folScl}, ${folScl}) translate(${-folX}px, ${folY}px)`;
    });
    
    // Get canvas dimension values
    let pixels = this.world.pixels.vision;
    let g = pixels.graphics;
    let canvasElem = pixels.elem;
    let [ w, h, hw, hh ] = [ canvasElem.width, canvasElem.height, canvasElem.width >> 1, canvasElem.height >> 1 ];
    
    if (!this.follow) {
      // If not following reveal everything and end
      g.rect(0, 0, w, h, { globalCompositeOperation: 'destination-out', fillStyle: 'rgba(0, 0, 0, 1)' });
      return;
    }
    
    g.rect(0, 0, w, h, { fillStyle: 'rgba(0, 0, 0, 1)' });
    g.frame(() => {
      
      g.translate(hw, hh); // (0, 0) corresponds to center of canvas
      g.scale(pixels.currentRatio); // Take low-quality, pixelated canvases into account
      g.translate(0, this.smoothAhd.update()); // Shift ahead of unit (for more LOS)
      
      // Draw laser pointer
      if (folAiming) {
        g.path({ strokeStyle: 'rgba(255, 100, 100, 1)', lineWidth: 0.5 }, () => {
          g.moveTo(0, 0);
          g.lineTo(0, -this.follow.data.visionRange * this.smoothScl.smooth());
        });
      }
      
      g.frame(() => {
        
        // Transform the graphics to correspond to css-transformed world containers
        g.rotate(-this.smoothRot.update());
        g.scale(this.smoothScl.update());
        g.translate(-this.smoothX.update(), -+-this.smoothY.update()); // y needs to be inverted once for bot->top, and again for *undoing* the transition
        
        let revealStyle = {
          globalCompositeOperation: 'destination-out',
          fillStyle: 'rgba(0,0,0,0.8)'
        };
        
        let formation = this.follow.getFormation();
        let revealingUnits = formation ? formation.getActors() : {};
        revealingUnits[this.follow.uid] = this.follow;
        
        for (let revUnit of Object.values(revealingUnits)) {
          let [ revX, revY ] = revUnit.data.loc;
          let revRot = revUnit.data.rot;
          
          let reveals = revUnit.genReveals();
          
          for (let reveal of reveals) {
            
            g.frame(() => {
              
              // Translate to the unit's location
              g.translate(revX, -revY);
              g.rotate(revRot);
              
              if (reveal.type === 'circ') {
                
                let [ x, y ] = reveal.loc;
                g.circ(x, y, reveal.r, revealStyle);
                
              } else if (reveal.type === 'poly') {
                
                g.path(revealStyle, () => {
                  let v = reveal.verts;
                  for (let i = 0, len = v.length; i < len; i++) {
                    let [ x, y ] = v[i];
                    g[j ? 'lineTo' : 'moveTo'](x, -y);
                  }
                });
                
              } else if (reveal.type === 'vision') {
                
                g.path(revealStyle, () => {
                  let { ang, len, r } = reveal;
                  let isCircle = len <= r || !ang;
                  
                  if (isCircle) {
                    g.circ(0, 0, r, revealStyle)
                  } else {
                    let ccw = Math.PI * 0.5;
                    let ang1 = ang * -0.50 - ccw;
                    let ang2 = ang * -0.25 - ccw;
                    let [ sin1, cos1, sin2, cos2 ] = [ Math.sin(ang1), Math.cos(ang1), Math.sin(ang2), Math.cos(ang2) ];
                    let [ ax, ay ] = [ cos1 * r, sin1 * r ]; // arc-x, arc-y
                    let [ lx, ly ] = [ cos1 * len, sin1 * len ]; // long-x, long-y
                    let [ cx1, cy1, cx2, cy2 ] = [ cos1 * len, sin1 * len, cos2 * len, sin2 * len ]; // cone-x, cone-y
                    g.arcTo(-ax, ay, 0, 0, ax, ay, false);      // Circle around unit
                    g.lineTo(cx1, cy1);                         // Right edge of vision cone
                    g.arcTo(lx, ly, 0, 0, -lx, ly, false);
                  }
                });
                
              }
              
            });
            
          }
          
        }
        
      });
      
    });
    
    this.follow.updateOwned();
    
  },
  end: function() {
    this.running = false;
  }
})});
let SpawnScreen = U.inspire({ name: 'SpawnScreen', insps: { LocalEntity }, methods: (insp, Insp) => ({
  init: function(world, clickedSpawn=()=>{}) {
    insp.LocalEntity.init.call(this, world);
    this.clickedSpawn = clickedSpawn;
  },
  start: function() {
    this.elem = this.world.elems.meta.appendChild(dom.div());
    this.elem.classList.add('overlay', 'spawn');
    
    let spawnButton = this.elem.appendChild(dom.div());
    spawnButton.classList.add('button', 'spawn');
    spawnButton.addEventListener('click', this.clickedSpawn);
    
    let spawnButtonText = spawnButton.appendChild(dom.div());
    spawnButtonText.classList.add('content');
    spawnButtonText.innerHTML = 'spawn';
  },
  update: function() {
    
  },
  end: function() {
    this.world.elems.meta.removeChild(this.elem);
    this.elem = null;
  }
})});

let Road = U.inspire({ name: 'Road', insps: { ClientEntity, RendersToDom }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
    insp.RendersToDom.init.call(this);
  },
  getContainer: function() { return this.world.elems.world1; },
  genElem: function() { let elem = dom.div(); elem.classList.add('road'); return elem; },
  start: function() {
    insp.RendersToDom.start.call(this);
    let { width, points } = this.data;
    
    for (let i = 1; i < points.length; i++) {
      
      let [ x1, y1 ] = points[i - 1];
      let [ x2, y2 ] = points[i];
      
      let segElem = dom.div();
      segElem.classList.add('segment');
      this.domElem.appendChild(segElem);
      
      let dx = x2 - x1;
      let dy = y2 - y1;
      let len = Math.sqrt(dx * dx + dy * dy);
      
      let mx = (x2 + x1) * 0.5;
      let my = (y2 + y1) * 0.5;
      
      let w = Math.round(width);
      let h = Math.round(len + width);
      
      segElem.style.width = `${w}px`;
      segElem.style.height = `${h}px`; // Add half the width on both ends
      segElem.style.marginLeft = `${-(w >> 1)}px`;
      segElem.style.marginTop = `${-(h >> 1)}px`;
      segElem.style.borderRadius = `${w >> 1}px`;
      segElem.style.transform = `translate(${mx}px, ${-my}px) rotate(${Math.atan2(dx, dy)}rad)`;
      
    }
  },
  update: function() {},
  end: function() { insp.RendersToDom.end.call(this); }
})});
let FloorPlan = U.inspire({ name: 'FloorPlan', insps: { ClientEntity, RendersToDom }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
    insp.RendersToDom.init.call(this);
  },
  getContainer: function() { return this.world.elems.world1; },
  genElem: function() { let elem = dom.div(); elem.classList.add('floorPlan'); return elem; },
  start: function() {
    insp.RendersToDom.start.call(this); // Initializes `this.domElem`
    let [ x, y ] = this.data.loc;
    let [ w, h ] = [ Math.round(this.data.w), Math.round(this.data.h) ];
    let style = this.domElem.style;
    style.transform = `translate(${x}px, ${-y}px) rotate(${this.data.rot}rad)`;
    style.width = `${w}px`;
    style.height = `${h}px`;
    style.marginLeft = `${-(w >> 1)}px`;
    style.marginTop = `${-(h >> 1)}px`;
  },
  update: function() {},
  end: function() { insp.RendersToDom.end.call(this); }
})});

let SpatialEntity = U.inspire({ name: 'SpatialEntity', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
    this.elem = null;
  },
  getWorld: function() {
    return this.world.elems.world1;
  },
  genElem: function() {
    let ret = dom.div();
    ret.classList.add('entity');
    ret._ent = this;
    return ret;
  },
  start: function() {
    this.elem = this.genElem();
    this.update(0);
    this.getWorld().appendChild(this.elem);
  },
  update: function(secs) {
    let [ x, y ] = this.data.loc;
    this.elem.style.transform = `translate(${x}px, ${-y}px) rotate(${this.data.rot}rad)`;
  },
  end: function() {
    let elem = this.elem;
    this.elem = null;
    elem.classList.add('removed');
    setTimeout(() => this.getWorld().removeChild(elem), 150);
  }
})});
let RectStructure = U.inspire({ name: 'RectStructure', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.SpatialEntity.init.call(this, world, uid, data);
  },
  genElem: function() {
    let ret = insp.SpatialEntity.genElem.call(this);
    ret.classList.add('structure');
    
    let { w, h } = this.data;
    ret.style.width = `${Math.round(w)}px`;
    ret.style.height = `${Math.round(h)}px`;
    ret.style.left = `-${Math.round(w * 0.5)}px`;
    ret.style.top = `-${Math.round(h * 0.5)}px`;
    return ret;
  }
})});
let SiloStructure = U.inspire({ name: 'SiloStructure', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.SpatialEntity.init.call(this, world, uid, data);
  },
  genElem: function() {
    let ret = insp.SpatialEntity.genElem.call(this);
    ret.classList.add('silo');
    
    let { r } = this.data;
    let d = r * 2;
    ret.style.width = `${Math.round(d)}px`;
    ret.style.height = `${Math.round(d)}px`;
    ret.style.marginLeft = `-${Math.round(r)}px`;
    ret.style.marginTop = `-${Math.round(r)}px`;
    return ret;
  }
})});
let Actor = U.inspire({ name: 'Actor', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.SpatialEntity.init.call(this, world, uid, data);
  },
  genElem: function() {
    let ret = insp.SpatialEntity.genElem.call(this);
    ret.classList.add('actor');
    
    let { r } = this.data;
    let d = r * 2;
    ret.style.width = `${Math.round(d)}px`;
    ret.style.height = `${Math.round(d)}px`;
    ret.style.left = `-${Math.round(r)}px`;
    ret.style.top = `-${Math.round(r)}px`;
    return ret;
  }
})});
let Unit = U.inspire({ name: 'Unit', insps: { Actor }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.Actor.init.call(this, world, uid, data);
    this.mainItem = data.mainItem;
    this.metaElem = null;
    this.owned = false;
  },
  getFormation: function() {
    return (this.data && this.data.formation !== null)
      ? this.world.entities[this.data.formation]
      : null;
  },
  genElem: function() {
    let ret = insp.Actor.genElem.call(this);
    ret.classList.add('unit');
    return ret;
  },
  update: function() {
    let newMainItem = this.data.mainItem;
    if (newMainItem !== this.mainItem) {
      if (this.mainItem) this.elem.classList.remove(`mainItem-${this.mainItem}`);
      if (newMainItem) this.elem.classList.add(`mainItem-${newMainItem}`);
      this.mainItem = newMainItem;
    }
    insp.Actor.update.call(this);
  },
  end: function() {
    if (this.owned) this.endOwned();
    insp.Actor.end.call(this);
  },
  genReveals: function() {
    // For now only a single reveal for self-LOS
    return [{
      type: 'vision',
      ang: this.data.visionAngle,
      len: this.data.visionRange,
      r: this.data.bodyVision
    }];
  },
  getMainItem: function() {
    return this.data.mainItem === null ? null : this.world.entities[this.data.mainItem];
  },
  getMetaElemHolder: function() {
    return this.world.elems.meta.getElementsByClassName('status')[0];
  },
  startOwned: function() {
    this.owned = true;
    
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.startOwned();
    this.elem.classList.add('followed');
    
    this.metaElem = this.getMetaElemHolder().appendChild(dom.div());
    this.metaElem.classList.add('hudItem', 'unitStatus');
    
    let hpElem = this.metaElem.appendChild(dom.div());
    hpElem.classList.add('hp');
    
    let hpBarElem = hpElem.appendChild(dom.div());
    hpBarElem.classList.add('hpBar');
  },
  updateOwned: function() {
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.updateOwned();
    
    let hpBar = this.metaElem.getElementsByClassName('hpBar')[0];
    U.updateElemText(hpBar, `${Math.round(this.data.health)} / ${Math.round(this.data.maxHealth)}`);
    hpBar.style.width = `${100 * (this.data.health / this.data.maxHealth)}%`;
  },
  endOwned: function() {
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.endOwned();
    
    this.elem.classList.remove('followed');
    
    this.getMetaElemHolder().removeChild(this.metaElem);
    this.metaElem = null;
  }
})});
let Bullet = U.inspire({ name: 'Bullet', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.SpatialEntity.init.call(this, world, uid, data);
    this.totalTime = 0;
  },
  getWorld: function() {
    return this.world.elems.world2;
  },
  genElem: function() {
    let ret = insp.SpatialEntity.genElem.call(this);
    ret.classList.add('bullet');
    let h = Math.round(this.data.length);
    return ret;
  },
  update: function(secs) {
    this.totalTime += secs;
    
    let [ x, y ] = this.data.loc;
    let [ vx, vy ] = this.data.vel;
    
    x += vx * this.totalTime;
    y += vy * this.totalTime;
    
    this.elem.style.transform = `translate(${x}px, ${-y}px) rotate(${this.data.rot}rad)`;
  }
})});

let Zombie = U.inspire({ name: 'Zombie', insps: { Actor }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.Actor.init.call(this, world, uid, data);
  },
  genElem: function() {
    let ret = insp.Actor.genElem.call(this);
    ret.classList.add('zombie');
    return ret;
  }
})});

let Item = U.inspire({ name: 'Item', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
    this.elem = null;
    this.titleElem = null;
    this.owned = false;
  },
  start: function() {
  },
  update: function() {
  },
  end: function() {
    if (this.owned) this.endOwned();
  },
  getHolderElem: function() {
    return this.world.elems.meta.getElementsByClassName('items')[0];
  },
  startOwned: function() {
    this.owned = true;
    
    this.elem = this.getHolderElem().appendChild(dom.div());
    this.elem.classList.add('hudItem', 'item');
    
    this.titleElem = this.elem.appendChild(dom.div());
    this.titleElem.classList.add('name');
  },
  updateOwned: function() {
    U.updateElemText(this.titleElem, this.data.name);
  },
  endOwned: function() {
    this.getHolderElem().removeChild(this.elem);
    this.elem = null;
    this.titleElem = null;
    this.owned = false;
  }
})});
let Gun = U.inspire({ name: 'Gun', insps: { Item }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.Item.init.call(this, world, uid, data);
    this.bulletsRemainingElem = null;
    this.bulletsTotalElem = null;
  },
  startOwned: function() {
    insp.Item.startOwned.call(this);
    this.elem.classList.add('gun');
    
    let bulletData = this.elem.appendChild(dom.div());
    bulletData.classList.add('bullets');
    
    let reloadElem = this.elem.appendChild(dom.div());
    reloadElem.classList.add('reloadSlider');
    reloadElem.style.transition = `width ${Math.round(this.data.reloadDelaySecs * 1000)}ms linear`;
    
    this.bulletsRemainingElem = bulletData.appendChild(dom.div());
    this.bulletsRemainingElem.classList.add('remaining');
    
    let sep = bulletData.appendChild(dom.div());
    sep.classList.add('sep');
    sep.innerText = '/';
    
    this.bulletsTotalElem = bulletData.appendChild(dom.div());
    this.bulletsTotalElem.classList.add('total');
  },
  updateOwned: function() {
    insp.Item.updateOwned.call(this);
    let { shotsInClip, shotsFired } = this.data;
    U.updateElemText(this.bulletsRemainingElem, shotsInClip - shotsFired);
    U.updateElemText(this.bulletsTotalElem, shotsInClip);
    
    let reloadElem = this.elem.getElementsByClassName('reloadSlider')[0];
    if (shotsFired === shotsInClip) {
      reloadElem.classList.add('sliding');
    } else if (reloadElem.classList.contains('sliding')) {
      let rep = dom.div();
      let par = reloadElem.parentNode;
      reloadElem.classList.remove('sliding');
      par.replaceChild(rep, reloadElem);
      par.replaceChild(reloadElem, rep);
    }
  },
  endOwned: function() {
    insp.Item.endOwned.call(this);
    this.bulletsRemainingElem = null;
    this.bulletsTotalElem = null;
  }
})});

let Formation = U.inspire({ name: 'Formation', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
  },
  getActors: function() {
    return (this.data && this.data.actors)
      ? this.data.actors.map((actor, uid) => this.world.entities[uid])
      : {};
  },
  getReveals: function() {
    if (!this.data || !this.data.reveals) return null;
    return this.data.reveals.map(rev => ({
      ...rev,
      unit: this.world.entities[rev.srcUid],
    }));
  },
  start: function() {},
  update: function(secs) {
  },
  end: function() {},
})});
let ClientManager = U.inspire({ name: 'ClientManager', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
  },
  start: function() {},
  update: function(secs) {},
  end: function() {}
})});
let ZombieManager = U.inspire({ name: 'ZombieManager', insps: { ClientEntity }, methods: (insp, Insp) => ({
  init: function(world, uid, data) {
    insp.ClientEntity.init.call(this, world, uid, data);
  },
  start: function() {},
  update: function(secs) {},
  end: function() {}
})});

let Graphics = U.inspire({ name: 'Graphics', methods: (insp, Insp) => ({
  init: function(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); },
  frame: function(f) { this.ctx.save(); f(); this.ctx.restore(); },
  rotate: function(ang) { this.ctx.rotate(ang); },
  translate: function(x, y) { this.ctx.translate(x, y); },
  scale: function(x, y=x) { this.ctx.scale(x, y); },
  rect: function(x, y, w, h, style) {
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fillRect(x, y, w, h);
    if (style.strokeStyle) this.ctx.strokeRect(x, y, w, h);
  },
  circ: function(x, y, r, style) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, Math.PI * 2, 0);
    
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fill();
    if (style.strokeStyle) this.ctx.stroke();
  },
  path: function(style, f) {
    this.ctx.beginPath(); f(); this.ctx.closePath();
    
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fill();
    if (style.strokeStyle) this.ctx.stroke();
  },
  moveTo: function(x, y) { this.ctx.moveTo(x, y); },
  lineTo: function(x, y) { this.ctx.lineTo(x, y); },
  curveTo: function(x1, x2, cx1, cy1, cx2, cy2) { this.ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x1, x2); },
  arcTo: function(x1, y1, x2, y2, x3, y3, ccw=true) {
    
    let dx = (x2 - x1);
    let dy = (y2 - y1);
    let r = Math.sqrt(dx * dx + dy * dy);
    let ang1 = Math.atan2(y1 - y2, x1 - x2);
    let ang2 = Math.atan2(y3 - y2, x3 - x2);
    this.ctx.arc(x2, y2, r, ang1, ang2, ccw);
    
  },
})});
let Pixels = U.inspire({ name: 'Pixels', methods: (insp, Insp) => ({
  init: function(elem, pixelRatio=0.5, maxPixels=1600*1200) {
    
    this.elem = elem;
    this.graphics = new Graphics(elem);
    this.maxPixels = maxPixels;
    this.pixelRatio = pixelRatio; // Causes stretching of the canvas instead of oversizing width & height
    this.currentRatio = null;
    this.lastW = null;
    this.lastH = null;
    
  },
  sizeTo: function(w, h) {
    if (w === this.lastW && h === this.lastH) return;
    [ this.lastW, this.lastH ] = [ w, h ];
    
    // w * h * scale^2 = this.maxPixels;
    // scale^2 = this.maxPixels / (w * h)
    // scale = sqrt(this.maxPixels / (w * h));
    this.currentRatio = w * h > this.maxPixels
      ? 1 / Math.sqrt(this.maxPixels / (w * h))
      : this.pixelRatio;
    
    [ w, h ] = [ w, h ].map(n => Math.floor(n * this.currentRatio));
    
    output('Resized to:', w, h, '=', w * h, `(${w * h > (this.maxPixels * this.pixelRatio * this.pixelRatio) ? 'BAD' : 'GOOD'})`);
    
    [ this.elem.width, this.elem.height ] = [ w, h ];
    this.elem.classList.add('sized');
  },
})});
let ZombWorld = U.inspire({ name: 'ZombWorld', insps: { World }, methods: (insp, Insp) => ({
  init: function({ remote, elems={}, pixels={}, entityClasses={}, input, ratioElem=dom.id('ratio'), hudElem=dom.id('meta') }) {
    insp.World.init.call(this);
    
    this.nextLocalUid = 0;
    
    this.remoteUpds = {};
    
    this.elems = elems;
    this.pixels = pixels;
    this.entityClasses = entityClasses;
    this.input = input;
    
    this.lastBoundW = null;
    this.lastBoundH = null;
    this.lastEdgeLen = null;
    this.rootElem = document.body;
    this.ratioElem = ratio;
    this.hudElem = hudElem;
    
    // A continuous per-frame loop drives local updates
    let lastMs = +new Date();
    let updateFunc = () => {
      let curMs = +new Date();
      let elapsedMs = curMs - lastMs;
      lastMs = curMs;
      this.localUpdate(elapsedMs * 0.001);
      document.body.focus();              // All input should hit <body>
      requestAnimationFrame(updateFunc);  // Loop
    };
    requestAnimationFrame(updateFunc);
    
    // Websocket communication drives remote updates
    this.sokt = new WebSocket(`ws://${remote.hostname}:${remote.soktPort}`);
    this.sokt.onmessage = data => this.remoteUpdate(JSON.parse(data.data));
    this.ready = new Promise(r => { this.sokt.onopen = r; });
    
    // Provide remote events
    this.entityAdd = () => {};
    this.entityRem = () => {};
  },
  getNextUid: function() {
    let n = this.nextLocalUid++;
    return `l${n}`;
  },
  localUpdate: function(secs) {
    // Update ratio element
    let bounds = this.rootElem.getBoundingClientRect();
    let edgeLen = Math.ceil(Math.min(bounds.width, bounds.height));
    if (edgeLen !== this.lastEdgeLen) {
      this.lastEdgeLen = edgeLen;
      
      let ratio = edgeLen / 1200;
      
      // Resize the ratio keeper
      // this.ratioElem.style.width = `${edgeLen}px`;
      // this.ratioElem.style.height = `${edgeLen}px`;
      // this.ratioElem.style.marginLeft = `-${edgeLen >> 1}px`;
      // this.ratioElem.style.marginTop = `-${edgeLen >> 1}px`;
      this.ratioElem.style.transform = `scale(${ratio})`;
      this.hudElem.style.transform = `scale(${ratio})`;
      
      // Resize canvases
      this.pixels.forEach(p => p.sizeTo(1200, 1200/*edgeLen, edgeLen*/));
    }
    
    // Apply all remote entity updates
    for (let [uid, entityData] of Object.entries(this.remoteUpds)) {
      if (!this.entities.hasOwnProperty(uid)) continue;
      this.entities[uid].data.gain(entityData);
    }
    this.remoteUpds = {};
    
    this.entities.forEach(ent => ent.update(secs));
    
    // Do tick resolution
    let tickResult = this.doTickResolution();
    tickResult.add.forEach(this.entityAdd);
    tickResult.rem.forEach(this.entityRem);
  },
  remoteUpdate: function(data) {
    
    if (data.type !== 'update') return console.log('Unexpected remote command:', data.type, data);
    let { add={}, upd={}, rem={} } = data.update;
    
    // console.log('GOT:', data.update);
    
    for (let [ uid, entityData ] of Object.entries(add)) {
      if (!this.entityClasses.hasOwnProperty(entityData.type)) throw new Error(`Missing class: ${entityData.type}`);
      let EntityCls = this.entityClasses[entityData.type];
      this.addEntity(new EntityCls(this, +uid, entityData)); // TODO: Always convert uid to Number? Maybe ALL uids should be Strings... (e.g. s23 could be a "server" uid, c92 could be "client")
    }
    for (let uid of Object.keys(rem)) {
      this.remEntity(this.entities[uid]);
    }
    for (let [ uid, entityData ] of Object.entries(upd)) {
      if (!this.remoteUpds.hasOwnProperty(uid)) this.remoteUpds[uid] = {};
      this.remoteUpds[uid].gain(entityData);
    }
    
    // Do tick resolution
    let tickResult = this.doTickResolution();
    tickResult.add.forEach(this.entityAdd);
    tickResult.rem.forEach(this.entityRem);
    
  },
  remoteSend: function(data) {
    this.sokt.send(JSON.stringify(data));
  }
})});

let host = window.location.hostname;
let port = parseInt(window.location.port || 80);

(async () => {
  
  await new Promise(r => { window.onload = r });
  
  // Collect input from DOM
  let keyMapping = {
    65: 'moveL',
    87: 'moveU',
    68: 'moveR',
    83: 'moveD',
    85: 'rotCw',
    89: 'rotCcw',
    32: 'int1', // interaction
    69: 'int2',
    82: 'int3', // random keycode
    84: 'int4'  // random keycode
  };
  let input = {
    moveL: false,
    moveR: false,
    moveD: false,
    moveU: false,
    rotCw: false,
    rotCcw: false,
    int1: false,
    int2: false,
    int3: false,
    int4: false
  };
  let calcInputResult = () => ({
    s: (input.moveR - input.moveL),  // Strafe
    a: (input.moveU - input.moveD),  // Ahead
    r: (input.rotCw - input.rotCcw), // Rot
    i: `${+input.int1}${+input.int2}${+input.int3}${+input.int4}`
  });
  let latestInput = calcInputResult(input);
  let updateInputResult = () => {
    let newInputResult = calcInputResult();
    for (let k in newInputResult) {
      if (newInputResult[k] === latestInput[k]) continue;
      for (let kk in newInputResult) latestInput[kk] = newInputResult[kk];
      world.remoteSend({
        type: 'control',
        control: latestInput
      });
      break;
    }
  };
  document.body.onkeydown = evt => {
    if (evt.altKey) {
      console.log(`Pressed ${evt.keyCode}`);
      evt.stopPropagation();
      evt.preventDefault();
      return;
    }
    
    if (!keyMapping.hasOwnProperty(evt.keyCode)) return;
    input[keyMapping[evt.keyCode]] = true;
    updateInputResult();
  };
  document.body.onkeyup = evt => {
    if (!keyMapping.hasOwnProperty(evt.keyCode)) return;
    input[keyMapping[evt.keyCode]] = false;
    updateInputResult();
  };
  document.body.onblur = evt => {
    for (let k in input) input[k] = false;
    updateInputResult();
  };
  document.body.onfocus = evt => {
  };
  
  let world = window.world = new ZombWorld({
    remote: config.slice('hostname', 'httpPort', 'soktPort'),
    elems: {
      meta: dom.id('meta'),
      world1: dom.id('world1'),
      world2: dom.id('world2'),
      vision: dom.id('vision'),
      pixels: dom.id('pixels')
    },
    pixels: {
      vision: new Pixels(dom.id('vision')),
      world: new Pixels(dom.id('pixels'))
    },
    entityClasses: {
      Client, ClientManager,
      RectStructure, SiloStructure,
      Road, FloorPlan,
      Unit, Bullet,
      Formation,
      Gun,
      ZombieManager, Zombie
    },
    input: latestInput
  });
  await world.ready;
  
  let camera = new Camera();
  world.addEntity(camera);
  
  // Known "meta" entities for managing the game itself
  let spawnScreen = new SpawnScreen();
  spawnScreen.clickedSpawn = () => {
    world.remoteSend({ type: 'spawn' });
  };
  
  // Keep track of our client and unit, and whether or not we're spawned
  let myClient = new Wobbly(null);
  let myUnit = new Wobbly(null);
  let isSpawned = new CalcWob([ myClient, myUnit ], (client, unit) => client && unit);
  
  // Keep track of our client and unit
  world.entityAdd = entity => {
    if (U.isInspiredBy(entity, Client)) {
      let client = entity;
      if (client.data.ip === config.clientIp) myClient.update(client);
    }
    if (U.isInspiredBy(entity, Unit)) {
      let unit = entity;
      let client = myClient.value;
      if (client && unit.data.client === client.uid) myUnit.update(unit);
    }
  };
  world.entityRem = entity => {
    if (myClient.value && entity.uid === myClient.value.uid) return myClient.update(null);
    if (myUnit.value && entity.uid === myUnit.value.uid) return myUnit.update(null);
  };
  
  isSpawned.hold(spawned => {
    if (spawned) {
      myUnit.value.startOwned();
      camera.follow = myUnit.value;
      world.remEntity(spawnScreen);
    } else {
      camera.follow = null;
      world.addEntity(spawnScreen);
    }
  });
  
})();
