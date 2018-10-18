let UID = 0;

U.gain({
  updateElemText: (elem, text) => { text = text.toString(); if (elem.innerHTML !== text) elem.innerText = text; }
});

class ClientEntity extends Entity {
  constructor(world, uid, data) {
    super();
    this.world = world;
    this.uid = uid;
    this.data = data;
  }
  remoteUpdate(data) {
    this.data.gain(data);
  }
};
class Client extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  start() {
  }
  update() {
  }
  end() {
  }
};

class LocalEntity extends ClientEntity {
  constructor(world=null) {
    super(world, null, null);
  }
};
class Camera extends LocalEntity {
  constructor(world) {
    super(world);
    
    this.follow = null;
    this.running = false;
    
    let smoothing = 0.32;
    this.smoothAhd = new SmoothingVal(300, smoothing);
    this.smoothRot = new SmoothingVal(0, smoothing);
    this.smoothX = new SmoothingVal(0, smoothing);
    this.smoothY = new SmoothingVal(0, smoothing);
    this.smoothScl = new SmoothingVal(1, smoothing);
  }
  start() {
    this.running = true;
  }
  update() {
    
    // Need to be running and following
    if (!this.running) return;
    if (!this.follow) return;
    
    this.follow.updateOwned();
    
    // Get current client-side actions
    let [ folShooting, folAiming, folInt3, folInt4 ] = this.world.input.i.split('').map(c => c === '1');
    
    // Update smoothed values to approximately sync with css transitions
    let fd = this.follow.data;
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
    
    g.rect(0, 0, w, h, { fillStyle: 'rgba(0, 0, 0, 1)' });
    g.frame(() => {
      
      g.translate(hw, hh); // (0, 0) corresponds to center of canvas
      g.scale(pixels.currentRatio); // Take low-quality, pixelated canvases into account
      g.translate(0, this.smoothAhd.update()); // Shift ahead of unit (for more LOS)
      
      // Draw laser pointer
      if (folAiming) {
        g.path({ strokeStyle: 'rgba(255, 100, 100, 0.8)', lineWidth: 0.5 }, () => {
          g.moveTo(0, 0);
          g.lineTo(0, -this.follow.data.reveals[0].len * this.smoothScl.smooth());
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
        let revealingUnits = formation ? formation.getUnits() : {};
        revealingUnits[this.follow.uid] = this.follow;
        
        for (let revUnit of Object.values(revealingUnits)) {
          let [ revX, revY ] = revUnit.data.loc;
          let revRot = revUnit.data.rot;
          let reveals = revUnit.data.reveals;
          
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
                  let ccw = Math.PI * 0.5;
                  let ang1 = ang * -0.50 - ccw;
                  let ang2 = ang * -0.25 - ccw;
                  let [ sin1, cos1, sin2, cos2 ] = [ Math.sin(ang1), Math.cos(ang1), Math.sin(ang2), Math.cos(ang2) ];
                  let [ ax, ay ] = [ cos1 * r, sin1 * r ]; // arc-x, arc-y
                  let [ cx1, cy1, cx2, cy2 ] = [ cos1 * len, sin1 * len, cos2 * len, sin2 * len ]; // cone-x, cone-y
                  g.arcTo(-ax, ay, 0, 0, ax, ay, false);      // Circle around unit
                  g.lineTo(cx1, cy1);                         // Right edge of vision cone
                  g.curveTo(-cx1, cy1, cx2, cy2, -cx2, cy2);  // Curved periphery of vision cone (shape is implicitly closed)
                });
                
              }
              
            });
            
          }
          
        }
        
      });
      
    });
    
  }
  end() {
    this.running = false;
  }
};
class SpawnScreen extends LocalEntity {
  constructor(world, clickedSpawn=()=>{}) {
    super(world);
    this.clickedSpawn = clickedSpawn;
  }
  start() {
    this.elem = this.world.elems.meta.appendChild(document.createElement('div'));
    this.elem.classList.add('overlay', 'spawn');
    
    let spawnButton = this.elem.appendChild(document.createElement('div'));
    spawnButton.classList.add('button', 'spawn');
    spawnButton.addEventListener('click', this.clickedSpawn);
    
    let spawnButtonText = spawnButton.appendChild(document.createElement('div'));
    spawnButtonText.classList.add('content');
    spawnButtonText.innerHTML = 'spawn';
  }
  update() {
    
  }
  end() {
    this.world.elems.meta.removeChild(this.elem);
    this.elem = null;
  }
};

class PhysicalEntity extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
    this.elem = null;
  }
  getWorld() {
    return this.world.elems.world1;
  }
  start() {
    this.elem = this.getWorld().appendChild(document.createElement('div'));
    this.elem.classList.add('entity');
    this.elem._ent = this;
  }
  update() {
    let [ x, y ] = this.data.loc;
    this.elem.style.transform = `translate(${x}px, ${-y}px) rotate(${this.data.rot}rad)`;
  }
  end() {
    let elem = this.elem;
    this.elem = null;
    elem.classList.add('removed');
    setTimeout(() => this.getWorld().removeChild(elem), 50);
  }
};
class RectStructure extends PhysicalEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  start() {
    super.start();
    this.elem.classList.add('structure');
    
    let { w, h } = this.data;
    let hw = w * 0.5;
    let hh = h * 0.5;
    
    this.elem.style.width = `${Math.round(w)}px`;
    this.elem.style.height = `${Math.round(h)}px`;
    this.elem.style.left = `-${Math.round(w * 0.5)}px`;
    this.elem.style.top = `-${Math.round(h * 0.5)}px`;
  }
};
class Silo extends PhysicalEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  start() {
    super.start();
    this.elem.classList.add('silo');
    
    let { r } = this.data;
    let d = r * 2;
    
    this.elem.style.width = `${Math.round(d)}px`;
    this.elem.style.height = `${Math.round(d)}px`;
    this.elem.style.marginLeft = `-${Math.round(r)}px`;
    this.elem.style.marginTop = `-${Math.round(r)}px`;
  }
};
class Humanoid extends PhysicalEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  start() {
    super.start();
    this.elem.classList.add('humanoid');
    
    let { r } = this.data;
    let d = r * 2;
    
    this.elem.style.width = `${Math.round(d)}px`;
    this.elem.style.height = `${Math.round(d)}px`;
    this.elem.style.left = `-${Math.round(r)}px`;
    this.elem.style.top = `-${Math.round(r)}px`;
  }
};
class Unit extends Humanoid {
  constructor(world, uid, data) {
    super(world, uid, data);
    this.mainItem = data.mainItem;
    this.metaElem = null;
    this.owned = false;
  }
  getFormation() {
    return (this.data && this.data.formation !== null)
      ? this.world.entities[this.data.formation]
      : null;
  }
  start() {
    super.start();
    this.elem.classList.add('unit');
  }
  update() {
    let newMainItem = this.data.mainItem;
    if (newMainItem !== this.mainItem) {
      if (this.mainItem) this.elem.classList.remove(`mainItem-${this.mainItem}`);
      if (newMainItem) this.elem.classList.add(`mainItem-${newMainItem}`);
      this.mainItem = newMainItem;
    }
    super.update();
  }
  end() {
    if (this.owned) this.endOwned();
    super.end();
  }
  getMainItem() {
    return this.data.mainItem === null ? null : this.world.entities[this.data.mainItem];
  }
  getMetaElemHolder() {
    return this.world.elems.meta.getElementsByClassName('status')[0];
  }
  startOwned() {
    this.owned = true;
    
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.startOwned();
    this.elem.classList.add('followed');
    
    this.metaElem = this.getMetaElemHolder().appendChild(document.createElement('div'));
    this.metaElem.classList.add('hudItem', 'unitStatus');
    
    let hpElem = this.metaElem.appendChild(document.createElement('div'));
    hpElem.classList.add('hp');
    
    let hpBarElem = hpElem.appendChild(document.createElement('div'));
    hpBarElem.classList.add('hpBar');
  }
  updateOwned() {
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.updateOwned();
    
    let hpBar = this.metaElem.getElementsByClassName('hpBar')[0];
    U.updateElemText(hpBar, `${Math.round(this.data.health)} / ${Math.round(this.data.maxHealth)}`);
    hpBar.style.width = `${100 * (this.data.health / this.data.maxHealth)}%`;
  }
  endOwned() {
    let mainItem = this.getMainItem();
    if (mainItem) mainItem.endOwned();
    
    this.elem.classList.remove('followed');
    
    this.getMetaElemHolder().removeChild(this.metaElem);
    this.metaElem = null;
  }
};
class Bullet extends PhysicalEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  getWorld() {
    return this.world.elems.world2;
  }
  start() {
    super.start();
    this.elem.classList.add('bullet');
  }
  update(secs) {
    
    let h = Math.round(this.data.length);
    this.elem.style.height = `${Math.round(h)}px`;
    this.elem.style.top = `${-Math.round(h * 0.5)}px`;
    
    let [ vx, vy ] = this.data.vel;
    this.data.loc[0] += vx * secs;
    this.data.loc[1] += vy * secs;
    
    let [ x, y ] = this.data.loc;
    this.elem.style.transform = `translate(${x}px, ${-y}px) rotate(${this.data.rot}rad) translate(0px, ${h * 0.5}px)`;
    
  }
};

class Zombie extends Humanoid {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  start() {
    super.start();
    this.elem.classList.add('zombie');
  }
};

class Item extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
    this.elem = null;
    this.titleElem = null;
  }
  start() {
  }
  update() {
  }
  end() {
  }
  getHolderElem() {
    return this.world.elems.meta.getElementsByClassName('items')[0];
  }
  startOwned() {
    this.elem = this.getHolderElem().appendChild(document.createElement('div'));
    this.elem.classList.add('hudItem', 'item');
    
    this.titleElem = this.elem.appendChild(document.createElement('div'));
    this.titleElem.classList.add('name');
  }
  updateOwned() {
    U.updateElemText(this.titleElem, this.data.name);
  }
  endOwned() {
    this.getHolderElem().removeChild(this.elem);
    this.elem = null;
    this.titleElem = null;
  }
};
class Gun extends Item {
  constructor(world, uid, data) {
    super(world, uid, data);
    this.bulletsRemainingElem = null;
    this.bulletsTotalElem = null;
  }
  startOwned() {
    super.startOwned();
    this.elem.classList.add('gun');
    
    let bulletData = this.elem.appendChild(document.createElement('div'));
    bulletData.classList.add('bullets');
    
    let reloadElem = this.elem.appendChild(document.createElement('div'));
    reloadElem.classList.add('reloadSlider');
    reloadElem.style.transition = `width ${Math.round(this.data.reloadDelaySecs * 1000)}ms linear`;
    
    this.bulletsRemainingElem = bulletData.appendChild(document.createElement('div'));
    this.bulletsRemainingElem.classList.add('remaining');
    
    let sep = bulletData.appendChild(document.createElement('div'));
    sep.classList.add('sep');
    sep.innerText = '/';
    
    this.bulletsTotalElem = bulletData.appendChild(document.createElement('div'));
    this.bulletsTotalElem.classList.add('total');
  }
  updateOwned() {
    super.updateOwned();
    let { shotsInClip, shotsFired } = this.data;
    U.updateElemText(this.bulletsRemainingElem, shotsInClip - shotsFired);
    U.updateElemText(this.bulletsTotalElem, shotsInClip);
    
    let reloadElem = this.elem.getElementsByClassName('reloadSlider')[0];
    if (shotsFired === shotsInClip) {
      reloadElem.classList.add('sliding');
    } else if (reloadElem.classList.contains('sliding')) {
      let rep = document.createElement('div');
      let par = reloadElem.parentNode;
      reloadElem.classList.remove('sliding');
      par.replaceChild(rep, reloadElem);
      par.replaceChild(reloadElem, rep);
    }
  }
  endOwned() {
    super.endOwned();
    this.bulletsRemainingElem = null;
    this.bulletsTotalElem = null;
  }
};

class UnitFormation extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  getUnits() {
    return (this.data && this.data.units)
      ? this.data.units.map((unit, uid) => this.world.entities[uid])
      : {};
  }
  getReveals() {
    if (!this.data || !this.data.reveals) return null;
    return this.data.reveals.map(rev => ({
      ...rev,
      unit: this.world.entities[rev.srcUid],
    }));
  }
  update(secs) {
  }
}
class ClientManager extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  update(secs) {}
};
class ZombieManager extends ClientEntity {
  constructor(world, uid, data) {
    super(world, uid, data);
  }
  update(secs) {}
};

class Graphics {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); }
  frame(f) { this.ctx.save(); f(); this.ctx.restore(); }
  rotate(ang) { this.ctx.rotate(ang); }
  translate(x, y) { this.ctx.translate(x, y); }
  scale(x, y=x) { this.ctx.scale(x, y); }
  rect(x, y, w, h, style) {
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fillRect(x, y, w, h);
    if (style.strokeStyle) this.ctx.strokeRect(x, y, w, h);
  }
  circ(x, y, r, style) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, Math.PI * 2, 0);
    
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fill();
    if (style.strokeStyle) this.ctx.stroke();
  }
  path(style, f) {
    this.ctx.beginPath(); f(); this.ctx.closePath();
    
    for (let k in style) this.ctx[k] = style[k];
    if (style.fillStyle) this.ctx.fill();
    if (style.strokeStyle) this.ctx.stroke();
  }
  moveTo(x, y) { this.ctx.moveTo(x, y); }
  lineTo(x, y) { this.ctx.lineTo(x, y); }
  curveTo(x1, x2, cx1, cy1, cx2, cy2) { this.ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x1, x2); }
  arcTo(x1, y1, x2, y2, x3, y3, ccw=true) {
    
    let dx = (x2 - x1);
    let dy = (y2 - y1);
    let r = Math.sqrt(dx * dx + dy * dy);
    let ang1 = Math.atan2(y1 - y2, x1 - x2);
    let ang2 = Math.atan2(y3 - y2, x3 - x2);
    this.ctx.arc(x2, y2, r, ang1, ang2, ccw);
    
  }
};
class Pixels {
  constructor(elem, pixelRatio=0.5, maxPixels=1600*1200) {
    
    this.elem = elem;
    this.graphics = new Graphics(elem);
    this.maxPixels = maxPixels;
    this.pixelRatio = pixelRatio; // Causes stretching of the canvas instead of oversizing width & height
    this.currentRatio = null;
    this.lastW = null;
    this.lastH = null;
    
  }
  sizeTo(w, h) {
    
    if (w === this.lastW && h === this.lastH) return;
    [ this.lastW, this.lastH ] = [ w, h ];
    
    // w * h * scale^2 = this.maxPixels;
    // scale^2 = this.maxPixels / (w * h)
    // scale = sqrt(this.maxPixels / (w * h));
    this.currentRatio = w * h > this.maxPixels
      ? 1 / Math.sqrt(this.maxPixels / (w * h))
      : this.pixelRatio;
    
    [ w, h ] = [ w, h ].map(n => Math.floor(n * this.currentRatio));
    
    console.log('SIZED TO:', w, h, '=', w * h, `(${w * h > (this.maxPixels * this.pixelRatio * this.pixelRatio) ? 'BAD' : 'GOOD'})`);
    
    [ this.elem.width, this.elem.height ] = [ w, h ];
    this.elem.classList.add('sized');
    
  }
}
class ZombWorld extends World {
  constructor({ remote, elems={}, pixels={}, entityClasses={}, input, ratioElem=document.getElementById('ratio') }) {
    super();
    
    this.nextLocalUid = 0;
    
    this.elems = elems;
    this.pixels = pixels;
    this.entityClasses = entityClasses;
    this.input = input;
    
    this.clients = {};
    
    this.entities = {};
    this.addEntities = {};
    this.remEntities = {};
    
    this.lastBoundW = null;
    this.lastBoundH = null;
    this.lastEdgeLen = null;
    this.rootElem = document.body;
    this.ratioElem = ratio;
    
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
    this.clientAdd = () => {};
    this.clientRem = () => {};
  }
  getNextUid() {
    let n = this.nextLocalUid++;
    return `l${n}`;
  }
  localUpdate(secs) {
        
    let bounds = this.rootElem.getBoundingClientRect();
    let edgeLen = Math.round(Math.min(bounds.width, bounds.height));
    
    if (edgeLen !== this.lastEdgeLen) {
      this.lastEdgeLen = edgeLen;
      
      // Resize the ratio keeper
      this.ratioElem.style.width = `${edgeLen}px`;
      this.ratioElem.style.height = `${edgeLen}px`;
      this.ratioElem.style.marginLeft = `-${edgeLen >> 1}px`;
      this.ratioElem.style.marginTop = `-${edgeLen >> 1}px`;
      
      // Resize canvases
      this.pixels.forEach(c => c.sizeTo(edgeLen, edgeLen));
    }
    
    for (let k in this.clients) this.clients[k].update();
    
    // Add
    for (let [ uid, entity ] of Object.entries(this.addEntities)) {
      this.entities[uid] = entity;
      entity.start();
    }
    let addedEntities = this.addEntities;
    this.addEntities = {};
    
    // Update
    this.entities.forEach(e => e.update(secs));
    
    // Remove
    for (let uid of Object.keys(this.remEntities)) {
      let entity = this.remEntities[uid] = this.entities[uid];
      entity.end();
      delete this.entities[uid];
    }
    let removedEntities = this.remEntities;
    this.remEntities = {};
    
    for (let [ uid, entity ] of Object.entries(addedEntities)) this.entityAdd(entity);
    for (let [ uid, entity ] of Object.entries(removedEntities)) this.entityRem(entity);
    
  }
  remoteUpdate(data) {
    if (data.type !== 'update') return console.log('Unexpected remote command:', data.type, data);
    let { add={}, upd={}, rem={} } = data.update;
    
    for (let [ uid, entityData ] of Object.entries(add)) {
      if (!this.entityClasses.hasOwnProperty(entityData.type)) throw new Error(`Missing class: ${entityData.type}`);
      let EntityCls = this.entityClasses[entityData.type];
      let entity = this.addEntities[uid] = new EntityCls(this, uid, entityData);
    }
    for (let uid of Object.keys(rem)) {
      this.remEntities[uid] = true;
    }
    for (let [ uid, entityData ] of Object.entries(upd)) {
      this.entities[uid].remoteUpdate(entityData);
    }
    
  }
  remoteSend(data) {
    this.sokt.send(JSON.stringify(data));
  }
};

class Wobbly {
  constructor(value=null) {
    this.uid = UID++;
    this.nextInd = 0;
    this.holders = {};
    this.value = value;
  }
  hold(func) {
    let ind = this.nextInd++;
    func[`~wob${this.uid}`] = ind;
    this.holders[ind] = func;
    func(this.value);
  }
  drop(func) {
    let ind = func[`~wob${this.uid}`];
    delete func[`~wob${this.uid}`];
    delete this.holders[ind];
  }
  update(val) {
    this.value = val;
    for (let k in this.holders) this.holders[k](val);
  }
  mod(f) {
    this.update(f(this.value));
  }
};
class CalcWob extends Wobbly {
  constructor(wobblies, func) {
    super();
    this.wobblies = wobblies;
    this.func = func;
    this.watchFunc = () => {
      let newVal = this.calc();
      if (newVal !== this.value) this.update(newVal);
    };
    this.value = this.calc();
    this.wobblies.forEach(w => w.hold(this.watchFunc));
  }
  calc() {
    return this.func(...this.wobblies.map(w => w.value));
  }
};

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
  
  let world = new ZombWorld({
    remote: config.slice('hostname', 'httpPort', 'soktPort'),
    elems: {
      meta: document.getElementById('meta'),
      world1: document.getElementById('world1'),
      world2: document.getElementById('world2'),
      vision: document.getElementById('vision')
    },
    pixels: {
      vision: new Pixels(document.getElementById('vision'))
    },
    entityClasses: {
      Client,
      ClientManager, RectStructure, Silo, Unit, Bullet, UnitFormation,
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
  let isSpawned = new CalcWob([ myClient, myUnit ], (client, unit) => {
    return client && unit && unit.data.client === client.ip
  });
  
  // Keep track of our client and unit
  world.clientAdd = client => {
    if (client.ip === config.clientIp) myClient.update(client);
  };
  world.clientRem = client => {
    if (client.ip === config.clientIp) myClient.update(null);
  };
  world.entityAdd = unit => {
    if (!myClient.value) return;
    if (!unit.data) return; // Local entities don't necessarily have data
    if (unit.data.client === myClient.value.ip) { myUnit.update(unit); console.log('NEW UID:', unit.uid); }
  };
  world.entityRem = unit => {
    if (!myUnit.value) return;
    if (unit.uid === myUnit.value.uid) myUnit.update(null);
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
