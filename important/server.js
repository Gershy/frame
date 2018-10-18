// 6018 8710 6830 5623

// [X]  Bullets shouldn't need to send updates every frame
// [ ]  Better camera controls
//      [X]  Shifted ahead further
// [ ]  Reveals should be on units, and teams are just groupings of units
// [ ]  Different ways of determining who shares LOS - e.g. a commander unit, or nearby units share, etc.
// [ ]  Enemies + AI
// [ ]  Different clients receiving different updates (maybe a global list of updates, as well as a per-client or per-group list?)
// [ ]  Smarter way of determining which objects have updated
let http = require('http');
let net = require('net');
let crypto = require('crypto');
let fs = require('fs-extra');
let path = require('path');

require('./common.js');
U.gain({
  validNum: n => !isNaN(n) && n !== Infinity && n !== -Infinity,
  ROT_U: 0,
  ROT_R: Math.PI / 2,
  ROT_D: Math.PI,
  ROT_L: Math.PI * (4 / 3),
  ROT_CW0: 0,
  ROT_CW1: Math.PI / 2,
  ROT_CW2: Math.PI,
  ROT_CCW0: 0,
  ROT_CCW1: Math.PI / -2,
  ROT_CCW2: Math.PI,
  ROT_FULL: Math.PI * 2,
  ROT_HALF: Math.PI
});

let config = {
  hostname: 'localhost', // '192.168.1.144', // 'localhost',
  httpPort: 80,
  soktPort: 81
};
let output = console.log.bind(console);
let UID = 0;

class XY {
  constructor() {}
  x() { throw new Error('not implemented'); }
  y() { throw new Error('not implemented'); }
  asCarte() { throw new Error('not implemented'); }
  asPolar() { throw new Error('not implemented'); }
  toCarte() { throw new Error('not implemented'); }
  toPolar() { throw new Error('not implemented'); }
  toCarte() { throw new Error('not implemented'); }
  toPolar() { throw new Error('not implemented'); }
  add(pt) { throw new Error('not implemented'); }
  sub(pt) { throw new Error('not implemented'); }
  scale(mag) { throw new Error('not implemented'); }
  distSqr(pt) { throw new Error('not implemented'); }
  dist(pt) { throw new Error('not implemented'); }
  magSqr() { throw new Error('not implemented'); }
  mag() { throw new Error('not implemented'); }
  norm() { throw new Error('not implemented'); }
  eq(pt) { throw new Error('not implemented'); }
  perpCW() { throw new Error('not implemented'); }
  perpCCW() { throw new Error('not implemented'); }
  dotProd(pt) { throw new Error('not implemented'); }
  proj(pt) { throw new Error('not implemented'); }
  projLen(pt) { throw new Error('not implemented'); }
  ang() { throw new Error('not implemented'); }
  angTo(pt) { throw new Error('not implemented'); }
  rot(ang) { throw new Error('not implemented'); }
};
class CarteXY {
  constructor(x=0, y=0) { this.x = x; this.y = y; if (!U.validNum(x) || !U.validNum(y)) throw new Error('NAN!'); }
  x()         { return this.x; }
  y()         { return this.y; }
  asCarte()   { return [ this.x, this.y ]; }
  toCarte()   { return this; }
  asPolar()   { return [ this.ang(), this.mag() ]; }
  toPolar()   { return new PolarXY(this.ang(), this.mag()); }
  add(pt)     { let [ x, y ] = pt.asCarte(); return new CarteXY(this.x + x, this.y + y); }
  sub(pt)     { let [ x, y ] = pt.asCarte(); return new CarteXY(this.x - x, this.y - y); }
  scale(amt)  { return new CarteXY(this.x * amt, this.y * amt); }
  distSqr(pt) { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ this.x - x, this.y - y ]; return dx * dx + dy * dy; }
  dist(pt)    { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ this.x - x, this.y - y ]; return Math.sqrt(dx * dx + dy * dy); }
  magSqr()    { return this.x * this.x + this.y * this.y; }
  mag()       { return Math.sqrt(this.x * this.x + this.y * this.y); }
  norm()      { let amt = 1 / Math.sqrt(this.x * this.x + this.y * this.y); return isNaN(amt) ? null : new CarteXY(this.x * amt, this.y * amt); }
  eq(pt)      { let [ x, y ] = pt.asCarte(); return this.x === x && this.y === y; }
  perpCW()    { return new CarteXY(this.y, -this.x); }
  perpCCW()   { return new CarteXY(-this.y, this.x); }
  dotProd(pt) { let [ x, y ] = pt.asCarte(); return this.x * x + this.y * y; }
  proj(pt)    { let [ x, y ] = pt.asCarte(); return pt.scale((this.x * x + this.y * y) / pt.mag()); }
  projLen(pt) { let [ x, y ] = pt.asCarte(); return (this.x * x + this.y * y) / pt.mag(); }
  ang()       { return (this.x || this.y) ? Math.atan2(this.x, this.y) : 0; }
  angTo(pt)   { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ x - this.x, y - this.y ]; return (dx || dy) ? Math.atan2(dx, dy) : 0; }
  rot(ang)    { return new PolarXY(this.ang() + ang, this.mag()); }
};
class PolarXY {
  constructor(r=0, m=1) { this.r = r; this.m = m; if (!U.validNum(r) || !U.validNum(m)) throw new Error('NAN!'); }
  x()         { return Math.sin(this.r) * this.m; }
  y()         { return Math.cos(this.r) * this.m; }
  asCarte()   { return [ Math.sin(this.r) * this.m, Math.cos(this.r) * this.m ]; }
  toCarte()   { return new CarteXY(Math.sin(this.r) * this.m, Math.cos(this.r) * this.m); }
  asPolar()   { return [ this.r, this.m ]; }
  toPolar()   { return this; }
  add(pt)     { return pt.add(this.toCarte()); } // No smooth way to add polar coords
  sub(pt)     { return pt.sub(this.toCarte()); } // No smooth way to add polar coords
  scale(amt)  { return new PolarXY(this.r, this.m * amt); }
  distSqr(pt) { let [ r, m ] = pt.asPolar(); m = (this.m * this.m) + (m * m) - (2 * this.m * m * Math.cos(r - this.r)); return m; }
  dist(pt)    { let [ r, m ] = pt.asPolar(); m = (this.m * this.m) + (m * m) - (2 * this.m * m * Math.cos(r - this.r)); return Math.sqrt(m); }
  magSqr()    { return this.m * this.m; }
  mag()       { return this.m; }
  norm()      { return new PolarXY(this.r, 1); }
  eq(pt)      { return pt.eq(this.toCarte()); }
  perpCW()    { return new PolarXY(this.r + U.ROT_CW1, this.m); }
  perpCCW()   { return new PolarXY(this.r + U.ROT_CCW1, this.m); }
  dotProd(pt) { return pt.dotProd(this.toCarte()); }
  proj(pt)    { return this.toCarte().proj(pt); }
  projLen(pt) { return this.toCarte().projLen(pt); }
  ang()       { return this.r; }
  angTo(pt)   { let d = pt.ang() - this.ang(); while(d > U.ROT_HALF) d -= U.ROT_FULL; while(d < -U.ROT_HALF) d += U.ROT_FULL; return d; /*return pt.ang() - this.ang();*/ }
  rot(ang)    { return new PolarXY(this.r + r, this.m); }
};
XY.sum = (xys) => {
  let [ x, y ] = [ 0, 0 ];
  for (let i = 0, len = xys.length; i < len; i++) {
    let [ xd, yd ] = xys[i].asCarte();
    x += xd;
    y += yd;
  }
  return new CarteXY(x, y);
};

class Bound {
  constructor() {
    this.loc = new CarteXY();
    this.rot = 0;
  }
  getAxisAlignedBound() { throw new Error('not implemented'); }
  getAxes(bound2) { throw new Error('not implemented'); }
  projOnAxis(axis) { throw new Error('not implemented'); }
};
Bound.getPenetration = (b1, b2) => {
  
  let axes = [ ...b1.getAxes(b2), ...b2.getAxes(b1) ];
  
  let leastAxis = null;
  let leastPenAmt = U.intUpperBound;
  for (let i = 0, len = axes.length; i < len; i++) {
    let axis = axes[i];
    let [ minL, minR ] = b1.projOnAxis(axis);
    let [ maxL, maxR ] = b2.projOnAxis(axis);
    if (maxL < minL) [ minL, minR, maxL, maxR ] = [ maxL, maxR, minL, minR ];
    
    let penAmt = minR - maxL;
    if (penAmt < 0) return null; // Found an axis with separation!
    
    if (penAmt < leastPenAmt) [ leastAxis, leastPenAmt ] = [ axis, penAmt ];
  }
  
  return leastAxis ? [ leastAxis, leastPenAmt ] : null;
  
  // return leastAxis ? leastAxis.scale(leastPenAmt) : null;
  
};
class ConvexPolygonBound extends Bound {
  constructor(vertsCW, angs=null) {
    super();
    this.vertsCW = vertsCW;
    this.angs = angs;
    if (!this.angs) {
      this.angs = [];
      this.eachSeg((v1, v2) => {
        this.angs.push(v1.angTo(v2) - U.ROT_CCW1);
      });
    }
  }
  eachSeg(f) {
    let ret = [];
    let len = this.vertsCW.length;
    let last = this.vertsCW[len - 1];
    for (let i = 0; i < len; i++) {
      f(last, this.vertsCW[i]);
      last = this.vertsCW[i];
    }
  }
  getAxisAlignedBound() {
    
    let h = this.projOnAxis(new CarteXY(1, 0));
    let v = this.projOnAxis(new CarteXY(0, 1));
    
    return {
      x0: h[0], x1: h[1],
      y0: v[0], y1: v[1]
    };
    
  }
  getAxes(bound2) {
    return this.angs.map(ang => new PolarXY(ang + this.rot));
  }
  projOnAxis(axis) {
    let min = U.intUpperBound;
    let max = U.intLowerBound;
    for (let i = 0, len = this.vertsCW.length; i < len; i++) {
      
      let v = this.vertsCW[i];
      let mag = v.mag();
      let ang = v.ang();
      
      let offsetVert = this.loc.add(new PolarXY(ang + this.rot, mag));
      
      // let offsetVert = this.loc.add(this.vertsCW[i]);
      let projLen = offsetVert.projLen(axis, 1);
      if (projLen < min) min = projLen;
      if (projLen > max) max = projLen;
    }
    return [ min, max ];
  }
  getExtremeties() {
    return this.vertsCW.map(v => v.rot(this.rot).add(this.loc));
  }
};
class RectangleBound extends ConvexPolygonBound {
  constructor(w, h, hw=w*0.5, hh=h*0.5) {
    super(
      [ new CarteXY(-hw, -hh), new CarteXY(hw, -hh), new CarteXY(hw, hh), new CarteXY(-hw, hh) ],
      [ U.ROT_U, U.ROT_R ]
    );
  }
};
class CircleBound extends Bound {
  constructor(r) {
    super();
    this.r = r;
  }
  getAxisAlignedBound() {
    
    let { x, y } = this.loc;
    let r = this.r;
    return {
      x0: x - r, x1: x + r,
      y0: y - r, y1: y + r
    }
    
  }
  getAxes(bound2) {
    // If `bound2` has no extremeties, the best we can do is hope the mid->mid vector works
    let extremeties = bound2.getExtremeties() || [ bound2.loc ];
    let ret = [];
    for (let i = 0, len = extremeties.length; i < len; i++) {
      let diff = extremeties[i].sub(this.loc).norm();
      if (diff !== null) ret.push(diff);
    }
    return ret;
    // return extremeties.map(ex => ex.sub(this.loc).norm());
  }
  projOnAxis(axis) {
    let p = this.loc.projLen(axis);
    return [ p - this.r, p + this.r ];
  }
  getExtremeties() {
    return null;
  }
};
class LineSegmentBound extends Bound {
  constructor(length) {
    super();
    this.length = length;
  }
  endPt() {
    return this.loc.add(new PolarXY(this.rot, this.length));
  }
  getAxisAlignedBound() {
    let end = this.loc.add(this.extent);
    let [ x0, x1 ] = [ this.loc.x, end.x ];
    let [ y0, y1 ] = [ this.loc.y, end.y ];
    
    if (x1 < x0) [ x0, x1 ] = [ x1, x0 ];
    if (y1 < y0) [ y0, y1 ] = [ y1, y0 ];
    
    return { x0, x1, y0, y1 };
  }
  getAxes(bound2) {
    return [
      new PolarXY(this.rot),
      new PolarXY(this.rot + U.ROT_CW1)
    ];
  }
  projOnAxis(axis) {
    let [ proj1, proj2 ] = [ this.loc.projLen(axis), this.endPt().projLen(axis) ];
    return proj1 < proj2 ? [ proj1, proj2 ] : [ proj2, proj1 ];
  }
  getExtremeties() {
    return [ this.loc, this.endPt() ];
  }
};

class Client extends Entity {
  constructor(ip, sokt) {
    super();
    this.ip = ip;
    this.sokt = sokt;
    this.unit = null;
    
    this.p = {
      status: 'starting',
      buff: new Buffer(0),
      curOp: null,
      curFrames: []
    };
    
    sokt.on('readable', () => {
      let p = this.p;
      let buff = sokt.read();
      
      if (buff === null) buff = new Buffer(0);
      
      let totalLen = p.buff.length + buff.length; // TODO: deny HUGE buffers!
      p.buff = Buffer.concat([ p.buff, buff ], totalLen);
      this[p.status !== 'starting' ? 'receivedData' : 'receivedHandshakeData']();
    });
  }
  handshakeReply(packet) {
    try {
      let lines = packet.split('\r\n');
      // Parse headers:
      let headers = {};
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        let sep = line.indexOf(':');
        if (sep === -1) throw new Error(`Line doesn't contain header: ${line}`);
        let k = line.substr(0, sep).trim().toLowerCase();
        let v = line.substr(sep + 1).trim();
        headers[k] = v;
      }
      
      if (!headers.hasOwnProperty('sec-websocket-key')) throw new Error('Missing "sec-websocket-key" header');
      let hash = crypto.createHash('sha1');
      hash.end(`${headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
      this.sokt.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Accept: ${hash.read().toString('base64')}\r\n` +
        `\r\n`
      );
    } catch(err) {
      this.sokt.end(`HTTP/1.1 400 ${err.message} \r\n\r\n`);
      throw err;
    }
  }
  receivedHandshakeData() {
    
    let p = this.p;
    let buff = p.buff;
    if (buff.length < 4) return;
    
    let packetInd = null;
    for (let i = 0, len = buff.length - 4; i <= len; i++) {
      if (buff[i] === 13 && buff[i + 1] === 10 && buff[i + 2] === 13 && buff[i + 3] === 10) { packetInd = i; break; }
    }
    if (packetInd === null) return;
    
    let packet = buff.slice(0, packetInd).toString('utf8');
    p.buff = buff.slice(packetInd + 4);
    
    try {
      this.handshakeReply(packet);
      this.sokt.emit('working');
      p.status = 'started';
      if (p.buff.length) this.receivedData();
    } catch(err) {
      output(`Couldn't do handshake:${'\n'}PACKET:${'\n'}${packet}${'\n'}REASON: ${err.stack}`);
      if (p.buff.length) this.receivedHandshakeData();
    }
  }
  receivedData() {
    let p = this.p;
    let { buff, curOp } = p;
    
    try {
      while (buff.length >= 2) {
        // ==== PARSE FRAME
        
        let b = buff[0] >> 4; // Look at bits beyond first 4
        if (b % 8) throw new Error('Some reserved bits are on');
        let final = b === 8;
        
        let op = buff[0] % 16;
        if (op < 0 || (op > 2 && op < 8) || op > 10) throw new Error(`Invalid op: ${op}`);
        
        if (op >= 8 && !final) throw new Error('Fragmented control frame');
        
        b = buff[1];
        let masked = b >> 7;
        
        // Server requires a mask. Client requires no mask
        if (!masked) throw new Error('No mask');
        
        let length = b % 128;
        let offset = masked ? 6 : 2; // Masked frames have an extra 4 halfwords containing the mask
        
        if (buff.length < offset + length) return; // Await more data
        
        if (length === 126) {         // Websocket's "medium-size" frame format
          length = buff.readUInt16BE(2);
          offset += 2;
        } else if (length === 127) {  // Websocket's "large-size" frame format
          length = buff.readUInt32BE(2) * U.int32 + buff.readUInt32BE(6);
          offset += 8;
        }
        
        if (buff.length < offset + length) return; // Await more data
        
        // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
        let data = buff.slice(offset, offset + length);
        if (masked) { // Apply an XOR mask if directed
          
          let mask = buff.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
          let w = 0;
          for (let i = 0, len = data.length; i < len; i++) {
            data[i] ^= mask[w];
            w = w < 3 ? w + 1 : 0; // `w` follows `i`, but wraps every 4. More efficient than `%`
          }
          
        }
        
        // Remove the frame we've managed to locate
        p.buff = buff = buff.slice(offset + length); 
        
        // ==== PROCESS FRAME (based on `final`, `op`, and `data`)
        
        // The following operations can occur regardless of the socket's status
        if (op === 8) {         // Process "close" op
          
          p.status = 'ending';
          this.sokt.end();
          break;
          
        } else if (op === 9) {  // Process "ping" op
          
          throw Error('not implemented op: 9');
          
        } else if (op === 10) { // Process "pong" op
          
          throw Error('not implemented op: 10');
          
        }
        
        // For the following operations, ensure that the socket is open
        if (p.status !== 'started') continue;
        
        // Validate "continuation" functionality
        if (op === 0 && curOp === null) throw new Error('Invalid continuation frame');
        if (op !== 0 && curOp !== null) throw new Error('Expected continuation frame');
        
        // Process "continuation" ops as if they were the op being continued
        if (op === 0) op = curOp;
        
        if (op !== 1) {
          throw new Error(`Unsupported op: ${op}`);
        } else { // Text ops are our ONLY supported ops!
          p.curOp = 1;
          p.curFrames.push(data);
          
          if (final) {
            let fullStr = Buffer.concat(p.curFrames).toString('utf8');
            p.curOp = null;
            p.curFrames = [];
            this.receive(JSON.parse(fullStr));
          }
        }
      }
    } catch(err) {
      
      output(`Websocket error:${'\n'}${err.stack}`);
      
      p.buffer = new Buffer(0);
      p.curOp = null;
      p.curFrames = null;
      
    } 
  }
  receive(command) {
    this.sokt.emit('command', command);
  }
  async send(command) {
    let data = JSON.stringify(command);
    let metaBuff = null;
    
    if (data.length < 126) {            // small-size
      
      metaBuff = new Buffer(2);
      metaBuff[1] = data.length;
      
    } else if (data.length < 65536) {   // medium-size
      
      metaBuff = new Buffer(4);
      metaBuff[1] = 126;
      metaBuff.writeUInt16BE(data.length, 2);
      
    } else {                            // large-size
      
      metaBuff = new Buffer(8);
      metaBuff[1] = 127;
      metaBuff.writeUInt32BE(Math.floor(data.length / U.int32), 2);
      metaBuff.writeUInt32BE(data.length % U.int32, 6);
      
    }
    
    metaBuff[0] = 129; // 128 + 1; `128` pads for modding by 128; `1` is the "text" op
    await new Promise(r => this.sokt.write(Buffer.concat([ metaBuff, new Buffer(data) ]), r));
  }
  update(secs) { /* nothing */ }
  end() {
    this.p.status = 'ended';
    this.sokt.end();
    super.end();
  }
  now() {
    return {
      ...super.now(),
      ip: this.ip,
      unit: this.unit ? this.unit.uid : null
    }
  }
};

class PhysicalEntity extends Entity {
  constructor(bound=new CircleBound(10)) {
    super();
    
    this.bound = bound;
    
    this.rotVel = 0;
    this.vel = new CarteXY();
    this.acl = new CarteXY();
    this.invWeight = 1;
  }
  isTangible() {
    return true;
  }
  physicalUpdate(secs) { throw new Error('not implemented'); }
  dist(phys2) {
    return this.bound.loc.dist(phys2.bound.loc);
  }
  canCollide(entity) {
    return true;
  }
  collideAll(collisions) {
    
  }
  update(secs) {
    let bound = this.bound;
    if (this.vel.x || this.vel.y) {
      bound.loc = bound.loc.add(this.vel.scale(secs));
      this.world.updEntity(this, { loc: bound.loc.asCarte() });
    }
    if (this.rotVel) {
      bound.rot += this.rotVel * secs;
      this.world.updEntity(this, { rot: bound.rot });
    }
  }
  now() {
    return {
      ...super.now(),
      rot: this.bound.rot,
      loc: this.bound.loc.asCarte()
    }
  }
};
class RectStructure extends PhysicalEntity {
  constructor(w, h, loc, rot) {
    let rectBound = new RectangleBound(w, h);
    rectBound.loc = loc;
    rectBound.rot = rot;
    
    super(rectBound);
    this.w = w;
    this.h = h;
    this.invWeight = 0; // immovable
  }
  update(secs) { /* nothing! */ }
  now() {
    return {
      ...super.now(),
      w: this.w,
      h: this.h
    };
  }
};
class Silo extends PhysicalEntity {
  constructor(r, loc, rot) {
    let circBound = new CircleBound(r);
    circBound.loc = loc;
    circBound.rot = rot;
    
    super(circBound);
    this.r = r;
    this.invWeight = 0; // immovable
  }
  update(secs) { /* nothing! */ }
  now() {
    return {
      ...super.now(),
      r: this.r
    };
  }
};
class Bullet extends PhysicalEntity {
  constructor(rot, unit, shootSpd=1000, lifespanSecs=3) {
    super(new LineSegmentBound(0));
    
    this.bound.rot = rot;
    this.vel = (new PolarXY(this.bound.rot, this.shootSpd)).toCarte();
    this.unit = unit;
    
    this.maxSize = 20;
    this.shootSpd = shootSpd;
    this.invWeight = 10;
    this.strikeDamage = 50;
    
    this.lifespanSecs = lifespanSecs;
    this.secsLeftToLive = lifespanSecs;
    this.totalDist = 0;
  }
  isTangible() { return false; /* decollision doesn't occur against bullets */ }
  canCollide(entity) {
    if (this.secsLeftToLive <= 0) return false;
    return entity !== this.unit && !(entity instanceof Bullet);
  }
  collideAll(collisions) {
    
    let deepestEntity = null;
    let deepestPen = U.intUpperBound; // U.intLowerBound; // TODO: Shallowest?? Wat???
    // let lowestAmt = U.intUpperBound;
    let axis = new PolarXY(this.bound.rot); // A unit vector in the direction of interest
    
    for (let { entity, sepAmt } of Object.values(collisions)) {
      if (sepAmt < deepestPen) [ deepestEntity, deepestPen ] = [ entity, sepAmt ];
    }
    
    this.strike(deepestEntity);
    
    // This method is called because we've collided. Bullets die on impact
    this.world.remEntity(this);
    this.secsLeftToLive = 0;
    
  }
  strike(entity) {
    
    if (entity instanceof Humanoid) {
      entity.health -= this.strikeDamage;
      this.world.updEntity(entity, { health: entity.health });
    }
    
  }
  update(secs) {
    // This is how far we'll physically translate this frame
    let dist = this.shootSpd * secs;
    this.distTravelled += dist;
    
    let len = Math.min(this.distTravelled, this.maxSize);
    this.bound.length = -len; // Bullet stretches back to connect to its source until `this.distTravelled > this.maxSize`
    
    this.secsLeftToLive -= secs;
    if (this.secsLeftToLive <= 0) this.world.remEntity(this);
    
    super.update(secs);
  }
  now() {
    return {
      ...super.now(),
      unit: this.unit.uid,
      length: this.maxSize,
      vel: this.vel.asCarte()
    };
  }
};

class Humanoid extends PhysicalEntity {
  constructor(r) {
    super(new CircleBound(r));
    this.formation = null;
    this.strafeSpd = 30;
    this.aheadSpd = 65;
    this.backSpd = 25;
    this.rotSpd = (Math.PI * 2) / 4; // 4s for a full rotation
    
    this.maxHealth = 100;
    this.health = this.maxHealth;
    
    this.client = null;
  }
  setClient(client) {
    if (client.unit) throw new Error('Client already has unit!');
    if (this.client) throw new Error('Unit already has client!');
    
    this.client = client;
    this.world.updEntity(this, { client: client.uid });
    
    client.unit = this;
    this.world.updEntity(client, { unit: this.uid });
  }
  update(secs) {
    if (this.health > this.maxHealth) this.health = this.maxHealth;
    if (this.health <= 0) return this.world.remEntity(this);
    super.update(secs);
  }
  end() {
    if (this.client) this.client.unit = null;
    if (this.formation) this.formation.remUnit(this);
    super.end();
  }
  now() {
    return {
      ...super.now(),
      client: this.client ? this.client.uid : null,
      r: this.bound.r,
      formation: this.formation ? this.formation.uid : null,
      maxHealth: this.maxHealth,
      health: this.health
    };
  }
};
class Unit extends Humanoid {
  constructor(r, client) {
    super(r, client);
    
    this.aheadSpd = 200;
    this.backSpd = 150;
    this.strafeSpd = 90;
    this.rotSpd = (Math.PI * 2) / 2;
    
    this.recoilAng = (Math.PI * 2) / 120;
    
    this.shootDelaySecs = 0.14;
    this.shootCooldownSecs = 0;
    
    this.mainVisionAngle = (Math.PI * 2) * 0.15;
    this.mainVisionRange = 600; // Size of the vision-type reveal
    this.mainVisionScale = 1; // 0.3; // Actual zoom level of awareness
    this.mainBodyVision = 100;
    this.visionAngle = this.mainVisionAngle;
    this.visionRange = this.mainVisionRange;
    this.visionScale = this.mainVisionScale;
    this.bodyVision = this.mainBodyVision;
    
    this.control = { s: 0, a: 0, r: 0, i: '0000' }; // Each frame these values determine updates
    this.mainItem = null;
    
    this.reveals = [];
  }
  setMainItem(mainItem) {
    if (this.mainItem) throw new Error('Unit already has mainItem!');
    
    this.mainItem = mainItem;
    this.world.updEntity(this, { mainItem: mainItem.uid });
  }
  update(secs) {
    // Get current interactions
    let [ mainAction, aiming, int3, int4 ] = this.control.i.split('').map(c => c === '1');
    
    // Update velocity based on interactions
    if (this.control.s || this.control.a) {
      let { a, s } = this.control;
      this.vel = XY.sum([
        new PolarXY(this.bound.rot, a ? (a > 0 ? this.aheadSpd : -this.backSpd) : 0),
        new PolarXY(this.bound.rot + U.ROT_CW1, Math.sign(s) * this.strafeSpd)
      ]);
    } else {
      this.vel = new CarteXY();
    }
    
    // Get new vision params
    let newVisionAngle = !aiming ? (this.mainVisionAngle) : (this.mainVisionAngle * 0.5);
    let newVisionRange = !aiming ? (this.mainVisionRange) : (this.mainVisionRange * 1.25);
    let newVisionScale = !aiming ? (this.mainVisionScale) : (this.mainVisionScale * 0.8);
    let newBodyVision = !aiming ? (this.mainBodyVision) : (this.mainBodyVision * 0);
    
    // Apply new vision params
    if (newVisionAngle !== this.visionAngle) { this.visionAngle = newVisionAngle; this.world.updEntity(this, { visionAngle: newVisionAngle}); }
    if (newVisionRange !== this.visionRange) { this.visionRange = newVisionRange; this.world.updEntity(this, { visionRange: newVisionRange}); }
    if (newVisionScale !== this.visionScale) { this.visionScale = newVisionScale; this.world.updEntity(this, { visionScale: newVisionScale}); }
    if (newBodyVision !== this.bodyVision) { this.bodyVision = newBodyVision; this.world.updEntity(this, { bodyVision: newBodyVision}); }
    
    // Allow item use
    if (this.mainItem) {
      if (mainAction) this.mainItem.activate(secs, this, { use: 'main', steadiness: aiming ? 0.6 : 0 });
      else if (int3) this.mainItem.activate(secs, this, { use: 'reload' });
    }
    
    // Update reveals (TODO: Necessary? Can be calculated from vision params)
    this.reveals = [{
      type: 'vision',
      ang: this.visionAngle,
      len: this.visionRange,
      r: this.bodyVision
    }];
    this.world.updEntity(this, { reveals: this.reveals });
    
    super.update(secs);
  }
  end() {
    // TODO: What to do about our mainItem? Just remove it?
    if (this.mainItem) this.world.remEntity(this.mainItem);
    super.end();
  }
  now() {
    return {
      ...super.now(),
      mainItem: this.mainItem ? this.mainItem.uid : null,
      visionScale: this.visionScale,
      reveals: this.reveals
    };
  }
};
class Npc extends Humanoid {
  constructor(r, client) {
    super(r, client);
  }
};
class Zombie extends Npc {
  constructor(r) {
    super(r, null);
    this.idea = null;
    
    this.rotSpd = Math.PI * 2;
    this.aheadSpd = 200;
    
    this.leadership = Math.random(); // How naturally good of a leader this zombie is
    this.idol = null; // The zombie this zombie wants to be like
    this.progress = 0; // How close this zombie feels it is to actualizing its zombie purpose in life
    this.loneliness = 0; // How far away this zombie feels from all other zombies
    this.perceivedCompany = null; // Spot where this zombie thinks it will find company
    
    // this.milestonePoint = null; // Favourable spot the zombie remembers being
    // this.milestoneProgress = 0;
    
    this.target = null;
    // this.milestoneTargetLoc = null;
    
    this.damageDealt = 0;
  }
  canCollide(entity) { return !(entity instanceof Zombie); }
  update(secs) {
    
    let { entities } = this.world;
    
    if (this.idol && (!entities.hasOwnProperty(this.idol.uid) || this.idol.progress < 0.2)) this.idol = null;
    if (this.target && !entities.hasOwnProperty(this.target.uid)) this.target = null;
    if (this.perceivedCompany === null) this.perceivedCompany = this.bound.loc;
    
    let entityEntries = Object.entries(entities);
    let [ uid, randEnt ] = entityEntries[Math.floor(Math.random() * entityEntries.length)];
    
    if (randEnt instanceof Unit) {
      if (!this.target || this.dist(randEnt) < this.dist(this.target) || Math.random() < 1 / Math.max(this.dist(randEnt), 3)) this.target = randEnt;
    } else if (randEnt instanceof Zombie && randEnt !== this) {
      if (!this.idol || randEnt.progress > this.idol.progress) this.idol = randEnt;
      let dist = this.dist(randEnt);
      this.loneliness = (this.loneliness * 0.75) + (Math.min(dist, 1000) * (0.25 / 1000));
      this.perceivedCompany = XY.sum([
        this.perceivedCompany.scale(0.4),
        randEnt.bound.loc.scale(0.2),
        (randEnt.perceivedCompany ? randEnt.perceivedCompany : randEnt.bound.loc).scale(0.4)
      ]);
    }
    
    if (this.idol && this.idol.target && Math.random() < (this.target ? 0.01 : 0.5)) this.target = this.idol.target;
    
    let lastProgress = this.progress;
    
    this.progress = 0;
    let sigDist = 200; // Distance at which we start gaining progress
    let maxDmgSig = 100; // Amount of damage after which progress no longer increases
    
    // Progress calculation
    this.progress += this.leadership * 0.2; // TOTAL: 0.2
    if (this.target) this.progress += 0.2 + (sigDist - Math.min(this.dist(this.target), sigDist)) * (0.2 / sigDist); // TOTAL: 0.6
    if (this.idol) this.progress += 0.1; // TOTAL: 0.7
    this.progress += Math.max(maxDmgSig, this.damageDealt) * (0.3 / maxDmgSig); // TOTAL: 1
    
    // If we've started doing worse, 
    if (lastProgress > this.progress && Math.random() < 0.02) {
      this.target = null;
      this.idol = null;
      this.idea = null;
    }
    
    // Idea formulation
    if (this.idea === null) {
      if (this.target && Math.random() < (1 - (Math.min(this.dist(this.target), 1000) / 1000)) * 0.4) {
        
        let attackIdea = {
          type: 'attack',
          target: this.target,
          offset: new PolarXY(Math.random() * U.ROT_FULL, Math.random() * this.bound.r),
          dest: null,
          next: null
        };
        
        if (Math.random() < 0.7) {
          
          this.idea = {
            type: 'stalk',
            dest: this.target.bound.loc.add(new PolarXY(Math.random() * U.ROT_FULL, 50 + Math.random() * 150)),
            next: attackIdea
          };
          
        } else {
          
          this.idea = attackIdea;
          
        }
        
        // let doStalk = Math.random() < 0.7;
        // let offsetDist = doStalk
        //   ? (50 + Math.random() * 150)
        //   : (Math.random() * this.bound.r);
        // 
        // let offset = new PolarXY(Math.random() * U.ROT_FULL, offsetDist)
        // this.idea = {
        //   type: 'attack',
        //   target: this.target,
        //   offset: offset,
        //   dest: null,
        //   next: null
        // };
        
      } else if (this.idol && Math.random() < (1 - (Math.min(this.dist(this.idol), 1000) / 1000)) * 0.8) {
        this.idea = {
          type: 'follow',
          target: this.idol,
          offset: new PolarXY(Math.random() * U.ROT_FULL, 30 + Math.random() * 60),
          dest: null,
          next: null
        };
      } else if (Math.random() < this.loneliness * 0.4) { // 40% guaranteed at 1 loneliness; 0% at 0
        this.idea = {
          type: 'centralize',
          dest: this.perceivedCompany.add(new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 100)),
          next: null
        };
      } else {
        this.idea = {
          type: 'wander',
          dest: this.bound.loc.add(new PolarXY(Math.random() * U.ROT_FULL, 100 + Math.random() * 50)),
          next: null
        };
      }
    }
    
    if (this.idea.type === 'attack' || this.idea.type === 'follow') {
      this.idea.dest = this.idea.target.bound.loc.add(this.idea.offset);
    }
    
    this.rotVel = 0;
    this.vel = new CarteXY(0, 0);
    
    // Movement ideas
    if ([ 'stalk', 'attack', 'follow', 'centralize', 'wander', 'pathfind' ].includes(this.idea.type)) {
      
      if (this.bound.loc.distSqr(this.idea.dest) < 5 * 5) {
        
        // We're really close to destination!
        this.bound.loc = this.idea.dest;
        if (this.idea.type !== 'attack' || !entities.hasOwnProperty(this.idea.target.uid)) this.idea = this.idea.next;
        
      } else {
        
        // Far from destination! Facing right way?
        let neededAng = new PolarXY(this.bound.rot, 1).angTo(this.idea.dest.sub(this.bound.loc));
        if (Math.abs(neededAng < this.rotSpd * secs)) {
          // Almost exactly facing the right way! Full speed ahead!
          this.bound.rot += neededAng;
          this.vel = new PolarXY(this.bound.rot, this.aheadSpd);
        } else {
          // Need to turn!
          this.rotVel = Math.sign(neededAng) * this.rotSpd;
        }
        
      }
      
    }
    
    super.update(secs);
    
  }
  collideAll(collisions) {
    
    let [ barrier, barrierAxis ] = [ null, null ];
    
    for (let { entity, sepAxis, sepAmt } of Object.values(collisions)) {
      if (entity.invWeight === 0) [ barrier, barrierAxis ] = [ entity, sepAxis ];
      if (entity instanceof Unit) {
        let dmg = this.bound.r * 0.2;
        entity.health -= dmg;
        this.damageDealt += dmg;
        this.world.updEntity(entity, { health: entity.health });
      }
    }
    
    if (barrier && this.idea) {
      
      if (this.idea.type === 'pathfind' || Math.random() < 0.5) {
        this.idea = this.idea.next;
      } else if (this.idea.dest) { // TODO: check shouldn't be needed, attack null-dests aren't being filled in maybe?
        
        let extremeties = barrier.bound.getExtremeties();
        if (extremeties) {
          
          let loc = this.bound.loc;
          let dir = this.idea.dest.sub(loc); // needle delta wanna translate
          
          let nav1 = barrierAxis.perpCW();
          let nav2 = barrierAxis.perpCCW();
          
          // let bestNav = (Math.random() > 0.5) ? nav1 : nav2;
          
          let bestNav = (nav1.dotProd(dir) > nav2.dotProd(dir)) ? nav1 : nav2;
          
          let cornerNav = loc.add(bestNav.scale(this.bound.r * (1.3 + Math.random()) + (Math.random() * 20)));
          cornerNav = cornerNav.add(new PolarXY(Math.random() * U.ROT_FULL, (0.4 + Math.random() * 0.6) * this.bound.r));
          
          this.idea = {
            type: 'pathfind', 
            dest: cornerNav,
            next: (this.idea && this.idea.type !== 'pathfind') ? this.idea : null
          };
          
        } else {
          this.idea = this.idea.next;
        }
        
      }
      
    }
    
  }
};

class Item extends Entity {
  constructor(name) {
    super();
    this.name = name;
  }
  update(secs) {
    throw new Error('not implemented');
  }
  activate(secs, unit, { use='main' }) {
    throw new Error('not implemented');
  }
  now() {
    return { ...super.now(), name: this.name };
  }
};
class Gun extends Item {
  constructor(name, makeBullet=null) {
    super(name);
    this.makeBullet = makeBullet;
    this.recoilAng = (Math.PI * 2) / 80;
    this.shootDelaySecs = 0.14;
    this.shootCooldownSecs = 0;
    this.shotsInClip = 30;
    this.shotsFired = 0;
    this.reloadDelaySecs = 2;
    this.reloadCooldownSecs = 0;
  }
  dynamicValList() {
    return [ ...super.dynamicValList(), this.shotsFired ];
  }
  update(secs) {
    if (this.shootCooldownSecs > 0) this.shootCooldownSecs -= secs;
    
    // If magazine empty, start reloading
    if (this.reloadCooldownSecs <= 0 && this.shotsFired >= this.shotsInClip) {
      this.reloadCooldownSecs = this.reloadDelaySecs;
    }
    
    // If reloading, keep reloading
    if (this.reloadCooldownSecs > 0) {
      this.reloadCooldownSecs -= secs;
      if (this.reloadCooldownSecs <= 0) this.shotsFired = 0;
    }
  }
  activate(secs, unit, { use='main', steadiness=0 }) {
    if (use === 'main') {
      
      if (this.reloadCooldownSecs > 0) return;
      
      let rot = unit.bound.rot;
      let denom = 1 / this.shootDelaySecs;
      let numShotsNow = -(this.shootCooldownSecs / this.shootDelaySecs);
      let invNumShotsNow = 1 / numShotsNow;
      let mult = secs / numShotsNow;
      let countShots = 0;
      
      while (this.shootCooldownSecs <= 0 && this.shotsFired < this.shotsInClip) {
        this.shootCooldownSecs += this.shootDelaySecs;
        this.shotsFired++;
        
        let ang = rot + (Math.random() - 0.5) * (this.recoilAng - (this.recoilAng * steadiness));
        let bullet = this.world.addEntity(this.makeBullet(ang, unit));
        let initDist = countShots * bullet.shootSpd * mult; // Accounts for count of shot this frame, bullet speed, and seconds this frame
        bullet.bound.loc = unit.bound.loc.add(initDist ? new PolarXY(ang, initDist) : new CarteXY(0, 0));
        
        // Split the `secs` we have to work with into properly weighted pieces
        bullet.update(secs * -this.shootCooldownSecs * denom);
        
        countShots++;
      }
      
      if (countShots) update.updEntities[this.uid] = this;
      
    } else if (use === 'reload') {
      
      if (this.shotsFired >= this.shotsInClip || this.shotsFired === 0) return;
      this.shotsFired = this.shotsInClip;
      this.world.updEntity(this, { shotsFired: this.shotsFired });
      
    } else {
      
      throw new Error('Unknown use: ', use);
      
    }
    
  }
  now() {
    return {
      ...super.now(),
      shotsInClip: this.shotsInClip,
      shotsFired: this.shotsFired,
      reloadDelaySecs: this.reloadDelaySecs
    };
  }
};

class PhysicsEnforcer {
  constructor(rootZone) {
    this.rootZone = rootZone;
  }
  forgetEntity(entity) {
    this.calcEntityTiles(entity, true);
  }
  enforce(secs) {
    
    let { entities } = this.world;
    
    let entityEntries = Object.entries(entities);
    
    // Stupid broad separation
    let checks = {};
    for (let i = 1, len = entityEntries.length; i < len; i++) {
      
      if (!(entityEntries[i][1] instanceof PhysicalEntity)) continue;
      
      for (let j = 0; j < i; j++) {
        
        if (!(entityEntries[j][1] instanceof PhysicalEntity)) continue;
        
        let [ entity1, entity2 ] = [ entityEntries[i][1], entityEntries[j][1] ];
        if (!entity1.invWeight && !entity2.invWeight) continue;
        if (!entity1.canCollide(entity2) || !entity2.canCollide(entity1)) continue;
        checks[U.duoKey(entity1.uid, entity2.uid)] = [ entity1, entity2 ];
      }
    }
    checks = Object.values(checks);
    
    // Broad separation...
    // let checks = this.rootZone.getChecks()
    
    // Narrow separation... (between pairs of entities calculated in broad phase)
    let collisions = {};
    let separations = [];
    for (let [ entity1, entity2 ] of checks) {
      
      let penResult = Bound.getPenetration(entity1.bound, entity2.bound);
      if (!penResult) continue;
      let [ sepAxis1To2, sepAmt ] = penResult;
      
      let [ iw1, b1 ] = [ entity1.invWeight, entity1.bound ];
      let [ iw2, b2 ] = [ entity2.invWeight, entity2.bound ];
      
      // `Bound.getPenetration` doesn't guarantee the direction of the resulting axis. Check to
      // make sure it's roughly co-linear with the delta vector between the two entities
      let sepAxis2To1 = sepAxis1To2.scale(-1);
      let vec1To2 = b1.loc.sub(b2.loc);
      if (sepAxis1To2.dotProd(vec1To2) < 0) [ sepAxis1To2, sepAxis2To1 ] = [ sepAxis2To1, sepAxis1To2 ];
      
      // Keep track of the collision for each entity
      if (!collisions.hasOwnProperty(entity1.uid)) collisions[entity1.uid] = {};
      collisions[entity1.uid][entity2.uid] = { entity: entity2, sepAxis: sepAxis1To2, sepAmt };
      if (!collisions.hasOwnProperty(entity2.uid)) collisions[entity2.uid] = {};
      collisions[entity2.uid][entity1.uid] = { entity: entity1, sepAxis: sepAxis2To1, sepAmt };
      
      // Keep track of the separation which needs to happen. Only the lighter entity will move.
      let [ light, heavy ] = (iw1 === iw2)
        ? (Math.random() > 0.5 ? [ entity1, entity2 ] : [ entity2, entity1 ])
        : (iw1 > iw2 ? [ entity1, entity2 ] : [ entity2, entity1 ]);
      
      if (light.isTangible() && heavy.isTangible())
        separations.push({ light, heavy, sepAmt, sepAxis: light === entity1 ? sepAxis1To2 : sepAxis2To1 });
      
    }
    
    for (let [ uid, coll ] of Object.entries(collisions)) entities[uid].collideAll(coll);
    
    for (let { light, heavy, sepAxis, sepAmt } of separations) {
      light.bound.loc = light.bound.loc.add(sepAxis.scale(sepAmt));
      this.world.updEntity(light, { loc: light.bound.loc.asCarte() });
    }
    
  }
};
class UnitFormation extends Entity {
  constructor() {
    super();
    this.units = {};
  }
  addUnit(unit) {
    this.units[unit.uid] = unit;
    unit.formation = this;
  }
  remUnit(unit) {
    delete this.units[unit.uid];
    unit.formation = null;
    this.world.updEntity(this, { units: this.units });
  }
  update(secs) {
  }
  end() {
    for (let [ uid, entity ] of Object.entries(this.units)) {
      entity.formation = null;
      this.world.updEntity(entity, { formation: null });
    }
    super.end();
  }
  now() {
    return {
      ...super.now(),
      units: this.units.map(u => 1)
    };
  }
}
class ClientManager extends Entity {
  constructor(formation) {
    super();
    this.formation = formation;
    
    let soktServer = net.createServer(sokt => {
      let ip = sokt.remoteAddress;
      output(`SOKT: ${ip}`);
      let client = this.world.addClient(new Client(ip, sokt));
      this.incomingClient(client);
    });
    
    this.ready = Promise.all([
      new Promise(r => soktServer.listen(config.soktPort, config.hostname, r))
    ]);
    
  }
  incomingClient(client) {
    client.sokt.on('working', () => {
      // Listen for client commands
      client.sokt.on('command', command => this.onClientCommand(client, command))
      
      // See if there's already a unit for this client
      for (let [ uid, entity ] of Object.entries(this.world.entities)) {
        if (entity instanceof Unit && entity.client && entity.client.ip === ip) {
          this.world.remEntity(entity.client);
          entity.client = client;
          client.unit = entity;
          this.world.updEntity(entity, { client: client.uid });
          this.world.updEntity(client, { unit: entity.uid });
          break;
        }
      }
    });
    client.sokt.on('close', () => {
      this.world.remEntity(client);
    });
    client.sokt.on('error', err => {
      output(`SOKT ${client.ip} ERROR: ${err.stack}`);
      this.world.remEntity(client);
    });
  }
  onClientCommand(client, command) {
    
    let makeM16 = () => {
      let m16 = new Gun('m16', (rot, unit) => {
        let shootSpd = 1000;
        let lifespanSecs = 3;
        let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
        bullet.invWeight = 10 / 1;
        bullet.strikeDamage = 30;
        return bullet;
      });
      m16.recoilAng = (Math.PI * 2) / 80;
      m16.shootDelaySecs = 0.14;
      m16.shotsInClip = 30;
      m16.reloadDelaySecs = 2;
      return m16;
    };
    let makeMag = () => {
      let mag = new Gun('mag', (rot, unit) => {
        let shootSpd = 1200;
        let lifespanSecs = 3;
        let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
        bullet.invWeight = 10 / 2;
        bullet.strikeDamage = 40;
        return bullet;
      });
      mag.recoilAng = (Math.PI * 2) / 65;
      mag.shootDelaySecs = 0.09;
      mag.shotsInClip = 100;
      mag.reloadDelaySecs = 4;
      return mag;
    };
    let makeGatling = () => {
      let gatling = new Gun('gatling', (rot, unit) => {
        let shootSpd = 1600;
        let lifespanSecs = 2;
        let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
        bullet.invWeight = 10 / 3;
        bullet.strikeDamage = 10;
        return bullet;
      });
      gatling.recoilAng = (Math.PI * 2) / 52;
      gatling.shootDelaySecs = 0.01;
      gatling.shotsInClip = 750;
      gatling.reloadDelaySecs = 10;
      return gatling;
    };
    let makeFlamer = () => {
      let flamer = new Gun('flamer', (rot, unit) => {
        let shootSpd = 250;
        let lifespanSecs = 2;
        let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
        bullet.invWeight = 10 / 1;
        bullet.strikeDamage = 5;
        return bullet;
      });
      flamer.recoilAng = (Math.PI * 2) / 40;
      flamer.shootDelaySecs = 0.005;
      flamer.shotsInClip = 1000;
      flamer.reloadDelaySecs = 1;
      return flamer;
    };
    
    let clientCommands = ({
      spawn: (client, command) => {
        if (client.unit) return;
        output(`SPAWNING: ${client.ip}`);
        
        let weapon = this.world.addEntity(makeGatling());
        let unit = this.world.addEntity(new Unit(8));
        unit.bound.loc = new CarteXY(0, 425);
        unit.bound.rot = U.ROT_D;
        unit.setClient(client);
        unit.setMainItem(weapon);
        this.formation.addUnit(unit);
      },
      control: (client, command) => {
        if (!client.unit) return;
        client.unit.control = command.control;
      }
    });
    
    if (!clientCommands.hasOwnProperty(command.type)) return output(`Unexpected command: ${command.type}`);
    clientCommands[command.type](client, command);
  }
  start() {}
  update(secs) {}
  end() {}
};
class ZombieManager extends Entity {
  constructor(secsPerSpawn=3) {
    super();
    this.secsPerSpawn = secsPerSpawn;
    this.spawnCounter = 0;
  }
  update(secs) {
    
    this.spawnCounter += secs;
    if (this.spawnCounter > this.secsPerSpawn) {
      this.spawnCounter = 0;
      let size = Math.round(Math.random() * Math.random() * Math.random() * Math.random() * 30);
      let zombie = new Zombie(10 + size);
      zombie.aheadSpd = 200 / Math.max(2, size);
      zombie.bound.loc = new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 400);
      zombie.bound.rot = Math.random() * U.ROT_FULL;
      this.world.addEntity(zombie);
      
      // if (Math.random() < 0.7) {
      //   
      //   let u = new Unit(8, null);
      //   u.bound.loc = new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 1000);
      //   u.bound.rot = U.ROT_CCW1 / 2;
      //   
      //   this.world.addEntity(u);
      //   
      // }
      
    }
    
  }
};

class Zone {
  constructor() {
    this.parentZone = null;
  }
  getFlatJurisdiction() {
    // Returns an Array of every Zone, including `this`, under our jurisdiction
    throw new Error('not implemented');
  }
  getBestZone(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyEncloses=false) {
    // Returns `null` if outside this Zone, or the finest-grained Zone in this
    // Zone's jurisdiction which encloses the bound
    throw new Error('not implemented');
  }
};
class SquareZone extends Zone {
  constructor(offset, e) {
    super();
    this.offset = offset.toCarte();
    this.he = e * 0.5; // "e" is "extent"; "he" is "half-extent"
  }
  enclosesRect({ x0, x1, y0, y1 }) {
    let { x, y } = this.offset; // Definitely a CarteXY
    let he = this.he;
    return true &&
      (x0 > x - he) &&
      (x1 < x + he) &&
      (y0 > y - he) &&
      (y1 < y + he);
  }
  getFlatJurisdiction() {
    return [ this ];
  }
  getBestZone(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyEncloses=false) {
    return (thisDefinitelyEncloses || this.enclosesRect(aaBound)) ? this : null;
  }
};
class TiledZone extends SquareZone {
  constructor(offset, e, numTilesAcross=4, makeSquareZone=null) {
    super(offset, e);
    this.numTilesAcross = numTilesAcross;
    this.tileW = (this.he * 2) / this.numTilesAcross;
    this.invTileW = 1 / this.tileW;
    this.tiles = {};
    this.makeSquareZone = makeSquareZone || 
      ((offset, e) => new SquareZone(offset, e));
    
  }
  xyToTileCoords(x, y) {
    x -= this.offset.x - this.he;
    y -= this.offset.y - this.he;
    return [
      Math.floor(x * this.invTileW),
      Math.floor(y * this.invTileW)
    ];
  }
  getFlatJurisdiction() {
    return [
      ...super.getFlatJurisdiction(),
      ...Object.values(this.tiles).map(t => t.getFlatJurisdiction())
    ];
  }
  getBestZone(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyEncloses=false) {
    
    let { x0, y0, x1, y1 } = aaBound;
    let [ cx1, cy1 ] = this.xyToTileCoords(x0, y0);
    let [ cx2, cy2 ] = this.xyToTileCoords(x1, y1);
    
    // May need to check that `bound` is inside of us
    if (!thisDefinitelyEncloses) {
      if (cx1 < 0 || cy1 < 0 || cx2 > this.numTilesAcross || cy2 > this.numTilesAcross)
        return null;
    }
    
    // If the bound isn't enclosed in a tile, can't do any better than `this`
    if (cx1 !== cx2 || cy1 !== cy2) return this;
    
    // Generate tiles on the fly
    let key = `${cx1},${cy1}`;
    if (!this.tiles.hasOwnProperty(key)) {
      let tile = this.makeSquareZone(new CarteXY((cx1 + 0.5) * this.tileW, (cx2 + 0.5) * this.tileW), this.tileW);
      this.tiles[key] = tile;
      tile.parentZone = this;
    }
    
    return this.tiles[key].getBestZone(bound, aaBound, true);
  }
};

class ZombWorld extends World {
  constructor({ clientManager, framesPerSec=40 }={}) {
    super();
    this.clientManager = clientManager;
    this.uid = 0;
    this.rootZone = null;
    this.enforcers = [];
    
    // The update loop
    let secsPerFrame = 1 / framesPerSec;
    let smoothMs = new SmoothingVal(0, 0.1);
    
    // TODO: Need to get this interval right. It's using values which should now
    // be in `this`. E.g. `entities` -> `this.entities`
    // Should handle enforcers and the root zone
    // Should probably have a cleaner way of handling cascading adds/rems/upds
    // Should eventually allow different clients to receive different updates
    setInterval(() => {
      
      let time = +new Date();
      
      this.entities.forEach(ent => ent.update(secsPerFrame));
      this.enforcers.forEach(enf => enf.enforce(secsPerFrame));
      
      let tickResult = this.doTickResolution();
      let catchUp = U.empty(this.uninitializedClients) ? null : { add: this.entities.map(ent => ent.now()) };
      
      for (let [ uid, client ] of Object.entries(this.clients)) {
        let updateData = this.uninitializedClients.hasOwnProperty(uid) ? catchUp : tickResult;
        // console.log(`Client ${client.ip} gets ${JSON.stringify(updateData, null, 2)}`);
        if (updateData && !U.empty(updateData)) client.send({ type: 'update', update: updateData });
      }
      
      // Mark all clients as initialized
      this.uninitializedClients = {};
      
      process.stdout.write(`\rProcessed in ${Math.round(smoothMs.update())}ms / ${Math.round(secsPerFrame * 1000)}ms${' '.repeat(10)}\r`);
      
    }, secsPerFrame * 1000);
    
  }
  setRootZone(zone) {
    this.rootZone = zone;
    return zone;
  }
  addEnforcer(enf) {
    this.enforcers.push(enf);
    enf.world = this;
    return enf;
  }
  getNextUid() {
    return this.uid++;
  }
};

(async () => {
  
  let world = new ZombWorld();
  
  // ==== Unit formation
  let testFormation = world.addEntity(new UnitFormation());
  
  // ==== Client manager
  let clientManager = world.addEntity(new ClientManager(testFormation));
  
  // ==== Zombie manager
  let zombieManager = world.addEntity(new ZombieManager());
  
  // ==== Static geometry
  // Tuning-fork bunker kinda thing
  world.addEntity(new RectStructure(180, 300, new CarteXY(0, -170), U.ROT_U));
  world.addEntity(new RectStructure(40, 150, new CarteXY(-70, +20), U.ROT_CW1 / 3));
  world.addEntity(new RectStructure(40, 150, new CarteXY(+70, +20), U.ROT_CCW1 / 3));
  world.addEntity(new RectStructure(40, 150, new CarteXY(-36, +150), U.ROT_U));
  world.addEntity(new RectStructure(40, 150, new CarteXY(+36, +150), U.ROT_U));
  
  // Flanking angled rects
  world.addEntity(new RectStructure(150, 150, new CarteXY(-130, +350), U.ROT_CW1 / 4));
  world.addEntity(new RectStructure(150, 150, new CarteXY(+130, +350), U.ROT_CCW1 / 4));
  
  // Big silo
  world.addEntity(new Silo(150, new CarteXY(0, +600), U.ROT_U));
  
  // Test units
  let testUnit1 = new Unit(8, null);
  testUnit1.bound.loc = new CarteXY(-130, +445);
  testUnit1.bound.rot = U.ROT_CCW1 / 2;
  testFormation.addUnit(testUnit1); // In the formation
  world.addEntity(testUnit1);
  
  let testUnit2 = new Unit(8, null);
  testUnit2.bound.loc = new CarteXY(+130, +445);
  testUnit2.bound.rot = U.ROT_CW1 / 2;
  testFormation.addUnit(testUnit2); // In the formation
  world.addEntity(testUnit2);
  
  // Tiled root zone
  let rootZone = world.setRootZone(new TiledZone(new CarteXY(0, 0), 10000, 10));
  
  // Enforce physical entity separation
  let physicsEnforcer = world.addEnforcer(new PhysicsEnforcer(rootZone));
  
  // Server setup
  let httpServer = http.createServer(async (request, response) => {
    
    output(`HTTP: ${request.method} ${request.url}`);
    
    let method = request.method.toLowerCase();
    let url = request.url;
    
    try {
      
      if (method === 'get' && url === '/') {
        
        response.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(__dirname, 'client.html')).pipe(response);
        
      } else if (method === 'get' && url === '/config.js') {
        
        let clientConfig = {
          ...config,
          clientIp: request.socket.remoteAddress // This needs to correlate with the socket remoteAddress (it should!)
        };
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        response.end(`let config = global.CONFIG = ${JSON.stringify(clientConfig, null, 2)}`);
        
      } else if (method === 'get' && url === '/client.js') {
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(path.join(__dirname, 'client.js')).pipe(response);
        
      } else if (method === 'get' && url === '/common.js') {
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(path.join(__dirname, 'common.js')).pipe(response);
        
      } else if (method === 'get' && url === '/client.css') {
        
        response.writeHead(200, { 'Content-Type': 'text/css' });
        fs.createReadStream(path.join(__dirname, 'client.css')).pipe(response);
        
      } else if (method === 'get' && url === '/favicon') {
        
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('No favicon yet :(');
        
      } else if (method === 'get' && url.startsWith('/assets')) {
        
        let pcs = url.split('/');
        let lastPc = pcs[pcs.length - 1];
        
        if (!~lastPc.indexOf('.')) throw new Error(`Bad url: ${url}`);
        
        lastPc = lastPc.split('.');
        let ext = lastPc[lastPc.length - 1];
        
        let contentType = ({
          png: 'image/png',
          jpg: 'image/jpg',
          jpeg: 'image/jpg'
        })[ext];
        
        if (!contentType) throw new Error(`Bad asset extension: ${ext}`);
        
        response.writeHead(200, { 'Content-Type': contentType });
        
        let filepath = path.join(__dirname, ...pcs);
        fs.createReadStream(filepath).pipe(response);
        
      } else {
        
        throw new Error('bad request');
        
      }
      
      output(`served: ${method} ${url}`);
      
    } catch(err) {
      
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end(`dunno: ${method} ${url}`);
      output(`error: ${method} ${url} (${err.message})`);
      return;
      
    }
    
  });
  
  await Promise.all([
    clientManager.ready,
    new Promise(r => httpServer.listen(config.httpPort, config.hostname, r))
  ]);
  
  output(`Ready: ${JSON.stringify(config, null, 2)}`);
  
  
  
  
  
  
  
  
  
  
  // TODO: DEPRECATED! (although some of the http server should probably remain here?)
  // let clients = {};
  // let entities = {};
  // for (let initialEntity of initialEntities) entities[initialEntity.uid] = initialEntity;
  // 
  // // The update loop
  // let framesPerSec = 40;
  // let secsPerFrame = 1 / framesPerSec;
  // let smoothMs = 0;
  // setInterval(() => {
  //   
  //   let time = +new Date();
  //   
  //   let update = {
  //     addClients: {},
  //     updClients: {},
  //     remClients: {},
  //     addEntities: {},
  //     updEntities: {},
  //     remEntities: {}
  //   };
  //   
  //   // Update all entities (while collecting physical entities for physics update)
  //   let physEntities = {};
  //   for (let [ uid, entity ] of Object.entries(entities)) {
  //     entity.update(secsPerFrame, update, clients, entities);
  //     if (entity instanceof PhysicalEntity) physEntities[uid] = entity;
  //   }
  //   
  //   // Apply physics update after all other updates
  //   physicsEnforcer.applyCollisions(physEntities, update);
  //   
  //   // ==== Update clients
  //   let { addClients, updClients, remClients } = update;
  //   for (let ip in addClients) {
  //     clients[ip] = addClients[ip];
  //     addClients[ip] = addClients[ip].now();
  //   }
  //   for (let ip in updClients) {
  //     updClients[ip] = updClients[ip].now();
  //   }
  //   for (let ip in remClients) {
  //     delete clients[ip];
  //     remClients[ip] = 1;
  //   }
  //   
  //   // ==== Update entities
  //   let { addEntities, updEntities, remEntities } = update;
  //   for (let uid in addEntities) {
  //     entities[uid] = addEntities[uid];
  //     addEntities[uid] = addEntities[uid].now();
  //   }
  //   
  //   // Remove entities first (removals may cause updates! e.g. setting references to null)
  //   let cascadedRems = update.remEntities;
  //   while (!U.empty(cascadedRems)) {
  //     let rems = cascadedRems;
  //     cascadedRems = {};
  //     for (let uid in rems) {
  //       entities[uid].onRemove({ remEntities: cascadedRems, updEntities: update.updEntities }, clients, entities);
  //       delete entities[uid];
  //       update.remEntities[uid] = 1;
  //     }
  //   }
  //   
  //   // Convert all updated entities to "now" format
  //   for (let uid in updEntities) {
  //     updEntities[uid] = updEntities[uid].now();
  //   }
  //   
  //   // ==== Broadcast frame
  //   // Remove any empty update properties
  //   for (let k in update) if (U.empty(update[k])) delete update[k];
  //   
  //   // Generate the full catchUp structure if there are new clients
  //   let catchUp = U.empty(addClients) ? null : { addClients: clients.map(c => c.now()), addEntities: entities.map(e => e.now()) };
  //   
  //   // Inform all clients of all updates. Old clients get deltas; new clients are caught up fully
  //   for (let [ ip, client ] of Object.entries(clients)) {
  //     let isNewClient = addClients.hasOwnProperty(ip);
  //     let data = isNewClient ? catchUp : update;
  //     if (!U.empty(data)) client.send({ type: 'update', update: data });
  //   }
  //   
  //   smoothMs = (0.85 * smoothMs) + (0.15 * (new Date() - time));
  //   process.stdout.write(`\rProcessed in ${Math.round(smoothMs)}ms / ${Math.round(secsPerFrame * 1000)}ms${' '.repeat(10)}\r`);
  //   
  // }, secsPerFrame * 1000);
  // 
  // 
  // let soktServer = net.createServer(sokt => {
  //   
  //   let ip = sokt.remoteAddress;
  //   output(`SOKT: ${ip}`);
  //   clientManager.incomingClient(new Client(ip, sokt));
  //   
  // });
  // 
  // // Listen for requests
  // await Promise.all([
  //   new Promise(r => httpServer.listen(config.httpPort, config.hostname, r)),
  //   new Promise(r => soktServer.listen(config.soktPort, config.hostname, 511, r))
  // ]);
  // 
  // output(`Ready: ${JSON.stringify(config, null, 2)}`);
  
})();
