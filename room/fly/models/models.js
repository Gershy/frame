global.rooms['fly.models'] = async foundation => {
  
  let { Rec } = await foundation.getRoom('record');
  let levels = await foundation.getRoom('fly.levels');
  
  let util = {
    paragraph: str => str.split('\n').map(v => v.trim() || C.skip).join(' '),
    fadeAmt: (v1, v2, amt) => v1 * (1 - amt) + v2 * amt,
    fadeVal: (init, amt=0.5) => {
      let fv = {
        val: init,
        to: trg => fv.val = util.fadeAmt(fv.val, trg, amt)
      };
      return fv;
    },
    incCen: function*(n, stepAmt) {
      let start = -0.5 * stepAmt * (n - 1);
      for (let i = 0; i < n; i++) yield start + i * stepAmt;
    }
  };
  let geom = {
    checkForms: (form1, form2, bound1, bound2) => {
      if (form1 === bound1.form && form2 === bound2.form) return [ bound1, bound2 ];
      if (form1 === bound2.form && form2 === bound1.form) return [ bound2, bound1 ];
      return null;
    },
    doCollidePoint: (p1, p2) => p1.x === p2.x && p1.y === p2.y,
    doCollideCircle: (c1, c2) => {
      
      let { x: x1, y: y1, r: r1 } = c1;
      let { x: x2, y: y2, r: r2 } = c2;
      
      let dx = x1 - x2;
      let dy = y1 - y2;
      let tr = r1 + r2;
      
      return (dx * dx + dy * dy) < (tr * tr);
      
    },
    doCollideRect: (r1, r2) => {
      
      let { x: x1, y: y1, w: w1, h: h1 } = r1;
      let { x: x2, y: y2, w: w2, h: h2 } = r2;
      
      return true
        && Math.abs(x1 - x2) < (w1 + w2) * 0.5
        && Math.abs(y1 - y2) < (h1 + h2) * 0.5;
      
    },
    doCollidePointRect: ({ x, y }, r) => {
      let hw = r.w * 0.5;
      let hh = r.h * 0.5;
      x -= r.x; y -= r.y;
      return x > -hw && x < hw && y > -hh && y < hh
    },
    doCollidePointCircle: ({ x, y }, c) => {
      x -= c.x; y -= c.y;
      return (x * x + y * y) < (c.r * c.r);
    },
    doCollideRectCircle: (r, c) => {
      
      let hw = r.w * 0.5;
      let hh = r.h * 0.5;
      let roundingGap = c.r; // Size of gap separating RoundedRect and Rect
      
      // A "plus sign" consisting of two rects, with the notches
      // rounded off by circles, creates a RoundedRect
      // circumscribing the original Rect by a constant gap equal to
      // the radius of the colliding Circle.
      
      return false
        || geom.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w + roundingGap * 2, h: r.h })
        || geom.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w, h: r.h + roundingGap * 2 })
        || geom.doCollidePointCircle(c, { x: r.x - hw, y: r.y - hh, r: roundingGap })
        || geom.doCollidePointCircle(c, { x: r.x + hw, y: r.y - hh, r: roundingGap })
        || geom.doCollidePointCircle(c, { x: r.x + hw, y: r.y + hh, r: roundingGap })
        || geom.doCollidePointCircle(c, { x: r.x - hw, y: r.y + hh, r: roundingGap })
      
    },
    doCollide: (bound1, bound2) => {
      if (bound1.form === bound2.form) {
        if (bound1.form === 'circle') return geom.doCollideCircle(bound1, bound2);
        if (bound1.form === 'rect') return geom.doCollideRect(bound1, bound2);
      } else {
        let [ rect=null, circle=null ] = geom.checkForms('rect', 'circle', bound1, bound2) || [];
        if (rect) return geom.doCollideRectCircle(rect, circle);
      }
      
      throw Error(`No method for colliding ${bound1.form} and ${bound2.form}`);
    },
    containingRect: bound => {
      if (bound.form === 'rect') return bound;
      if (bound.form === 'circle') {
        let size = bound.r << 1;
        return { x: bound.x, y: bound.y, w: size, h: size };
      }
      throw Error(`No clue how to do containing rect for "${bound.form}"`);
    }
  };
  
  // BASE STUFF
  let Entity = U.form({ name: 'FlyEntity', has: { Rec }, props: (forms, Form) => ({
    
    initProps: function(val) {
      let { ud={ ms: val.ms }, lsMs=null } = val;
      //if (!ud) throw Error(`Missing "ud" prop for init ${U.getFormName(this)}`);
      
      let { ms=null } = ud;
      if (!U.isForm(ms, Number)) {
        console.log(val);
        throw Error(`Bad "ms" param for ${U.getFormName(this)} (${U.getFormName(val.ms)})`);
      }
      
      // TODO: Annoying that we need to pass "ud" here...
      return { ud: { ms }, ms, lsMs };
    },
    initSyncs: function() { return [ 'ud', 'ms' ]; },
    init: function(rt, uid, mems, val) {
      
      if (!val) throw Error(`${U.getFormName(this)} missing "val" param`);
      
      // Get props, and list of sync prop names
      let props = this.initProps(val);
      let sProps = this.initSyncs();
      if (Set(sProps).size !== sProps.length) throw Error(`${U.getFormName(this)} defines sync properties multiple times (potentially through polymorphism)`);
      for (let spn of sProps) if (!props.has(spn)) throw Error(`${U.getFormName(this)} missing sync prop "${spn}"`);
      
      // Move properties from `props` to `syncProps` as appropriate
      let syncProps = {};
      for (let spn of sProps) { syncProps[spn] = props[spn]; delete props[spn]; }
      
      // Attach all local properties
      Object.assign(this, props);
      
      // Initialize as Rec using sync properties
      forms.Rec.init.call(this, rt, uid, mems, { ...syncProps, type: U.getFormName(this) });
      
    },
    v: function(p, v=C.skip) {
      
      let val = this.getVal();
      
      if (v === C.skip) {       // Get
        
        if (val.has(p))                   return val[p];
        else if (({}).has.call(this, p))  return this[p];
        else                              throw Error(`${U.getFormName(this)} has no v prop "${p}"`);
        
      } else {                  // Set
        
        if (U.isForm(v, Function)) v = v(val.has(p) ? val[p] : this[p]);
        
        if (val.has(p))                   this.objVal({ [p]: v });
        else if (({}).has.call(this, p))  this[p] = v;
        else                              throw Error(`${U.getFormName(this)} has no v prop "${p}"`);
        
      }
    },
    rv: function(ud, p) { return this.v(p) || ud.entities.seek(this.v(`${p}Uid`)).val }, //.def(this.v(`${p}Uid`)); },
    getAgeMs: function(ud) { return ud.ms - this.v('ms'); },
    getParent: function(ud) { return ud.level; },
    getRelVal: C.noFn('getRelVal'), // Returns current state, and any events (e.g. births) which occurred during the time delta
    getAbsVal: function(ud) {
      let par = this.getParent(ud);
      if (!par) return this.getRelVal(ud);
      
      let relState = this.getRelVal(ud);
      let { x, y } = par.getAbsVal(ud);
      
      relState.x += x;
      relState.y += y;
      return relState;
    },
    getCollideResult: C.noFn('getCollideResult'),
    getStepResult: C.noFn('getStepResult'),
    getDieResult: function(ud) { this.end(); },
    isAlive: function(ud) {
      if (this.v('lsMs') !== null && this.getAgeMs(ud) > this.lsMs) return false;
      return true;
    },
    
    renderPriority: function() { return 0.5; },
    render: function(ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      draw.circ(x, y, 10, { fillStyle: '#ff0000' });
    }
    
  })});
  let Mortal = U.form({ name: 'Mortal', has: { Entity }, props: (forms, Form) => ({
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr, { hpDmg: 0 })),
    getMaxHp: function() { return 1; },
    getCurrentHp: function(ud) { return this.getMaxHp(ud) - this.v('hpDmg'); },
    takeDamage: function(ud, srcEnt, amt) {
      let fatalDmg = this.getMaxHp(ud) - this.v('hpDmg');
      if (amt > fatalDmg) amt = Math.max(0, fatalDmg);
      
      // Mark damage on us
      this.v('hpDmg', v => v + amt);
      
      // Give damage credit to `srcEnt`
      srcEnt.v('scoreDamage', v => v + amt);
    },
    isAlive: function(ud) { return this.v('hpDmg') < this.getMaxHp(ud); }
  })});
  let Mover = U.form({ name: 'Mover', props: (forms, Form) => ({
    
    $carteParams: (tx, ty) => {
      let dist = Math.sqrt(tx * tx + ty * ty);
      let n = 1 / dist;
      return { nx: tx * n, ny: ty * n, ang: Math.atan2(tx, ty) / (Math.PI * 2), dist };
    },
    $polarParams: (ang, dist=null) => {
      let rad = ang * Math.PI * 2;
      return { nx: Math.sin(rad), ny: Math.cos(rad), ang, dist };
    },
    
    init: C.noFn('init'),
    initProps: forms.allArr('initProps', (i, arr, val) => {
      
      let { ud: { ms }, aMs=ms, x, y, ax=x, ay=y, vel=100, acl=0 } = val;
      
      // "nx" and "ny" specify normalized vector motion
      // "tx" and "ty" specify "targetted" motion; the Mover will move
      //   through the point (tx, ty)
      // "ang" and "dist" specify angular motion
      // Note that "ax" and "ay" are "anchor" coords; they store the
      // last location jumped to by this Mover before continuous motion
      // resumed
      
      let calc = null;
      if (val.has('nx') && val.has('ny'))       calc = () => val.slice('nx', 'ny', 'dist');
      else if (val.has('tx') && val.has('ty'))  calc = Form.carteParams.bind(null, val.tx, val.ty);
      else if (val.has('ang'))                  calc = Form.polarParams.bind(null, val.ang, val.dist);
      else                                      calc = () => { throw Error(`Supply either "tx" and "ty", or "ang"`); };
      
      let { nx, ny, dist, ang=Math.atan2(nx, ny) / (Math.PI * 2) } = calc();
      return {}.gain(...arr, { aMs, ax, ay, vel, acl, nx, ny, dist, ang });
      
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'aMs', 'ax', 'ay', 'nx', 'ny', 'dist', 'vel', 'acl' ].gain(...arr)),
    getRelVal: function(ud, ms=ud.ms) {
      
      let ax = this.v('ax'); let ay = this.v('ay');
      let nx = this.v('nx'); let ny = this.v('ny');
      let vel = this.v('vel');
      
      // Seconds the most recent anchor move has lasted
      let t = (ms - this.v('aMs')) * 0.001;
      
      // Non-null `dist` creates a cap on the dist
      let acl = this.v('acl');
      let dist = this.v('dist');
      let d = vel * t + acl * 0.5 * t * t; // Distance based on t, vel, acl
      if (dist !== null && d > dist) d = dist;
      
      return { x: ax + nx * d, y: ay + ny * d };
      
    },
    getAgeMs: C.noFn('getAgeMs'),
    setMoveAnchor: function(ud) {
      let { x, y } = this.getRelVal(ud);
      this.v('aMs', ud.ms); this.v('ax', x); this.v('ay', y);
    },
    setMoveSpd: function(ud, vel, acl) {
      if (ud) this.setMoveAnchor(ud);
      this.v('vel', vel); this.v('acl', acl);
    },
    setCarteDest: function(ud, tx, ty) {
      
      if (ud) this.setMoveAnchor(ud);
      
      let d = Math.sqrt(tx * tx + ty * ty);
      this.v('dist', d);
      
      let n = 1 / d;
      this.v('nx', tx * n); this.v('ny', ty * n);
      this.v('ang', Math.atan2(nx, ny) / (Math.PI * 2));
      
    },
    setPolarDest: function(ud, ang, dist=null) {
      
      if (ud) this.setMoveAnchor(ud);
      
      let r = ang * Math.PI * 2;
      this.v('nx', Math.sin(r)); this.v('ny', Math.cos(r));
      this.v('ang', ang); this.v('dist', dist);
      
    },
    isAlive: function(ud) {
      
      let nx = this.v('nx'); let ny = this.v('ny');
      let { x, y } = this.getAbsVal(ud);
      let tb = ud.bounds.total;
      if (nx > 0 && x > (tb.r + 150)) return false;
      if (nx < 0 && x < (tb.l - 150)) return false;
      if (ny > 0 && y > (tb.t + 150)) return false;
      if (ny < 0 && y < (tb.b - 150)) return false;
      return true;
      
    }
    
  })});
  let Physical = U.form({ name: 'Physical', props: (forms, Form) => ({
    init: C.noFn('init'),
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { ud: { ms }, ax=null, ay=null, aMs=ms, forces=[] } = val;
      return {}.gain(...arr, { ax, ay, aMs, forces });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'ax', 'ay', 'aMs', 'forces' ].gain(...arr)),
    calcForceState: function(ud, force, durMs=ud.ms - force[0]) {
      
      let t = durMs * 0.001;
      let [ aMs, type ] = force;
      
      if (type === 'vel') {
        
        let [ vx, vy ] = force.slice(2);
        return { fx: vx * t, fy: vy * t }
        
      } else if (type === 'acl') {
        
        let aclMult = 0.5 * t * t;
        let [ vx, vy, ax, ay ] = force.slice(2);
        return { fx: vx * t + ax * aclMult, fy: vy * t + ay * aclMult }
        
      }
      
      throw Error(`Unknown force type: ${type}`);
      
    },
    calcForce: function(ud, force) {
      
      let fx = 0; let fy = 0;
      let aMs = force[0];
      if (this.v('aMs') > aMs) {
        let dt = this.v('aMs') - aMs;
        let { fx: subFx, fy: subFy } = this.calcForceState(ud, force, dt);
        fx -= subFx; fy -= subFy;
      }
      
      let { fx: addFx, fy: addFy } = this.calcForceState(ud, force);
      fx += addFx; fy += addFy;
      return { fx, fy };
      
    },
    getRelVal: function(ud) {
      let fx = 0; let fy = 0;
      
      for (let force of this.v('forces')) {
        let { fx: addFx, fy: addFy } = this.calcForce(ud, force);
        fx += addFx; fy += addFy;
      }
      
      return { x: this.v('ax') + fx, y: this.v('ay') + fy };
    },
    setAnchor: function(ud, ax, ay) {
      this.v('ax', ax); this.v('ay', ay); this.v('aMs', ud.ms);
    },
    setForces: function(ud, forces) {
      let isDiff = (() => {
        let len = forces.length;
        if (len !== this.v('forces').length) return true;
        for (let i = 0; i < len; i++) {
          let f0 = forces[i];
          let f1 = this.v('forces')[i];
          if (f0.length !== f1.length) return true;
          for (let j = 0; j < f0.length; j++) if (f0[j] !== f1[j]) return true;
        }
        return false;
      })();
      
      if (!isDiff) return;
      let { x, y } = this.getRelVal(ud); //forms.Physical.getRelVal.call(this, ud);
      this.setAnchor(ud, x, y);
      this.v('forces', forces);
    }
  })});
  
  // UTIL
  let Bullet = U.form({ name: 'Bullet', props: (forms, Form) => ({
    
    // An abstract bullet; has a bound and logic for dealing damage but
    // no implementation of motion
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { team, owner=null, dmg=1, pDmg=[0,0], bound={ form: 'circle', r: 4 }, colour='rgba(0, 0, 0, 0.75)' } = val;
      /// {ABOVE=
      if (!owner) throw Error('Bullet missing "owner" property');
      /// =ABOVE}
      if (!U.isForm(bound, Object) || !bound.has('form') || !U.isForm(bound.form, String)) throw Error(`Bad bound! (${U.getFormName(bound)}, ${JSON.stringify(bound)})`);
      return {}.gain(...arr, { team, owner, dmg, pDmg, bound, colour });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'bound', 'colour' ].gain(...arr)),
    init: C.noFn('init'),
    getCollideResult: function(ud, tail) {
      if (!U.hasForm(tail, Mortal)) return;
      let dmg = this.v('dmg');
      let pDmg = this.v('pDmg');
      if (pDmg[0]) {
        let maxHp = tail.getMaxHp(ud);
        dmg += Math.min(pDmg[0] * maxHp, pDmg[1] || maxHp);
      }
      tail.takeDamage(ud, this.v('owner'), dmg);
      this.v('lsMs', 0);
    },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { ...this.v('bound'), x, y },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    }
    
  })});
  let MBullet = U.form({ name: 'MBullet', has: { Entity, Mover, Bullet }, props: (forms, Form) => ({
    
    // A moving bullet
    
    $render: (draw, ud, { x, y, r, team }) => {
      draw.circ(x, y, r, { fillStyle: Form.parents.Bullet.getColour(team) });
    },
    initProps: forms.allArr('initProps', (i, arr, val) => ({}).gain(...arr)),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)),
    isAlive: function(ud) {
      return true
        && forms.Entity.isAlive.call(this, ud)
        && forms.Mover.isAlive.call(this, ud);
    },
    render: function(ud, draw) {
      let bound = this.v('bound');
      let { x, y } = this.getAbsVal(ud);
      if (bound.form === 'circle') {
        draw.circ(x, y, bound.r, { fillStyle: this.v('colour') });
      } else if (bound.form === 'rect') {
        draw.rectCen(x, y, bound.w, bound.h, { fillStyle: this.v('colour') });
      } else {
        throw Error(`Bad bound: "${bound.form}"`);
      }
    }
    
  })});
  
  // GOOD GUYS
  let Ace = U.form({ name: 'Ace', has: { Mortal, Physical }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 8 }, $respawnMs: 2500, $invulnMs: 1500, $spd: 165,
    
    initControlProps: function(ud) { return {}; },
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { ud, name='<anon>', cx=0, cy=0 } = val;
      return {}.gain(...arr, {
        name, spd: Form.spd, effects: Set(),
        spawnMark: ud.ms,
        invulnMark: ud.ms + Form.invulnMs,
        scoreDamage: 0,
        scoreDeath: 0,
        controls: [ 'l', 'r', 'd', 'u', 'a1', 'a2' ].toObj(k => [ k, [ 0, ud.ms ] ]),
        ...i.initControlProps(ud)
      });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'invulnMark', 'name' ].gain(...arr)),
    getRelVal: function(ud) {
      let { x, y } = forms.Physical.getRelVal.call(this, ud);
      
      let bounded = false;
      if (ud.outcome !== 'win') {
        let pb = ud.bounds.player;
        if (x < pb.l) { x = pb.l; bounded = true; }
        if (x > pb.r) { x = pb.r; bounded = true; }
        if (y < (pb.b - pb.y)) { y = (pb.b - pb.y); bounded = true; }
        if (y > (pb.t - pb.y)) { y = (pb.t - pb.y); bounded = true; }
      }
      return { x, y, bounded };
    },
    getCollideResult: function(ud, tail) {},
    getTeam: function() { return +1; },
    getStepResult: function(ud) {
      
      if (!this.isAlive(ud)) {
        
        // Try to respawn; happens if we cross the respawn mark or win!
        if (ud.ms >= this.v('spawnMark') || ud.outcome === 'win') {
          
          this.v('hpDmg', 0);
          this.v('spawnMark', v => Math.min(v, ud.ms));
          this.v('invulnMark', this.v('spawnMark') + Form.invulnMs);
          
          let controlProps = this.initControlProps(ud);
          for (let [ k, v ] of controlProps) this.v(k, v);
          
          let pb = ud.bounds.player;
          let tb = ud.bounds.total;
          
          let { x, y } = ud.level.getAceSpawnLoc(ud);
          this.setAnchor(ud, x, y);
          
        }
        
        // If couldn't respawn give intangible result
        if (!this.isAlive(ud)) return { tangibility: { bound: null, team: 'ace', sides: [] }};
        
      }
      
      let { ms, spf, bounds, outcome } = ud;
      
      if (outcome === 'win') {
        if (!this.winTime) this.winTime = ms;
        if (this.v('invulnMark') < ms) this.v('invulnMark', ms + 10000);
        this.setForces(ud, [ [ this.winTime, 'vel', 0, Form.spd * 4 ] ]);
        let { x, y } = this.getAbsVal(ud);
        return { tangibility: {
          bound: { ...Form.bound, x, y },
          team: 'ace',
          sides: []
        }};
      }
      
      let { r, l, u, d, a1, a2 } = this.controls;
      let cx = r[0] - l[0];
      let cy = u[0] - d[0];
      let { spdMult=1, forces=[] } = this.aceUpdate(ud, { cx, cy, a1: a1[0], a2: a2[0] }) || {};
      
      // The calculated speed for this tick
      spdMult *= this.spd;
      
      for (let effect of this.effects) {
        let { mark, type=null, fn=null, endFn=null } = effect;
        if (ms > effect.mark) {
          this.v('effects').rem(effect);
          if (effect.endFn) effect.endFn(this, ud);
        } else {
          // Note: effects that aren't "spdMult" may need to be added to `forces`
          if (effect.type === 'spdMult') spdMult *= effect.spdMult;
          if (effect.type === 'force') forces.push(effect.force);
          if (effect.fn) effect.fn(this, ud);
        }
      }
      
      // TODO: If moving on both axes, normalize speed!
      if (r[0]) forces.push([ r[1], 'vel', r[0] * +spdMult, 0               ]);
      if (l[0]) forces.push([ l[1], 'vel', l[0] * -spdMult, 0               ]);
      if (u[0]) forces.push([ u[1], 'vel', 0,               u[0] * +spdMult ]);
      if (d[0]) forces.push([ d[1], 'vel', 0,               d[0] * -spdMult ]);
      
      this.setForces(ud, forces);
      
      let { x, y, bounded } = this.getAbsVal(ud);
      if (bounded) this.setAnchor(ud, x, y - ud.bounds.total.y);
      return { tangibility: {
        bound: { ...Form.bound, x, y },
        team: 'ace',
        sides: (this.v('invulnMark') > ms) ? [] : [ 'tail' ]
      }};
      
    },
    getDieResult: function(ud) {
      // Don't call `forms.Mortal.getDieResult` - that ends the Rec; Ace
      // Recs don't end, they always stick around until the Level ends
      // to track player score
      
      if (this.v('spawnMark') > ud.ms) return; // This Ace is already respawning
      
      let { level } = ud;
      
      this.v('scoreDeath', v => v + 1);
      if (level.v('lives') > 0) {
        level.v('lives', v => v - 1);
        this.v('spawnMark', ud.ms + Ace.respawnMs);
      } else {
        this.v('spawnMark', ud.ms + 100 * 1000);
        level.v('outcome', 'lose');
      }
      
    },
    aceUpdate: C.noFn('aceUpdate'),
    
    render: function(ud, draw) {
      
      if (!this.isAlive(ud)) return;
      
      let size = Form.bound.r << 1;
      let mine = this === ud.myEntity;
      let { x, y } = this.getAbsVal(ud);
      
      if (ud.ms < this.v('invulnMark')) {
        let outerStyle = mine
          ? { fillStyle: 'rgba(255, 255, 255, 0.30)' }
          : { fillStyle: 'rgba(255, 255, 255, 0.15)' };
        let innerStyle = mine
          ? { fillStyle: 'rgba(255, 255, 255, 0.35)', strokeStyle: 'rgba(255, 255, 255, 0.7)', lineWidth: 3 }
          : { fillStyle: 'rgba(255, 255, 255, 0.15)' };
        draw.circ(x, y, size * 5,   outerStyle);
        draw.circ(x, y, size * 1.6, innerStyle);
        draw.imageCen(this.constructor.imageKeep, x, y, size, size, 0.25);
      } else {
        let indStyle = mine
          ? { fillStyle: 'rgba(255, 140, 140, 0.28)', strokeStyle: 'rgba(255, 100, 100, 0.5)', lineWidth: 3 }
          : { fillStyle: 'rgba(255, 140, 140, 0.20)' };
        draw.circ(x, y, size * 1.6, indStyle);
        draw.imageCen(this.constructor.imageKeep, x, y, size, size);
      }
      
    }
    
  })});
  let JoustMan = U.form({ name: 'JoustMan', has: { Ace }, props: (forms, Form) => ({
    
    $w1ChargePunishSlow: 0.4, $w1ChargePunishMs: 2000,
    $w1Charge1Ms: 600, $w1Charge2Ms: 2200, $w1Charge3Ms: 5750, // How many millis of charging for various jousts
    $w1Charge3Slow: 0.59, $w1Charge3Duration: 3000,
    $w2Delay: 3500, $w2DashSpeed: 500, $w2OrbDps: 25, $w2DurationMs: 300,
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'aceJoust.png' ]),
    
    initControlProps: function(ud) { return { w1Mark: null, w1State: 0, w2Mark: null, joustMark: null, joustReloadMark: null }; },
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'w1Mark', 'w1State', 'w2Mark' ].gain(...arr)),
    
    aceUpdate: function(ud, { cx, cy, a1, a2 }) {
      
      let { aheadDist, ms, spf } = ud;
      
      if (this.v('joustMark')) {
        if (ms > this.v('joustMark') + Form.w1Charge3Duration) this.v('joustMark', null);
        if (this.v('joustMark')) {
          let { x, y } = this.getRelVal(ud);
          
          let rateMs = 1000 * JoustManLaserJoust.bound.h / JoustManLaserJoust.vel;
          while (ms > this.v('joustReloadMark') + rateMs) {
            let spawnMs = this.v('joustReloadMark') + rateMs;
            ud.spawnEntity({ type: 'JoustManLaserJoust', owner: this, team: 'ace', ax: x, ay: y, dmg: 0.75, ang: 0, aMs: spawnMs });
            this.v('joustReloadMark', mark => mark + rateMs);
          }
          
        }
      }
      
      // Activate weapon 1
      if (a1) {
        
        // Mark the moment weapon 1 was held
        if (!this.v('w1Mark')) this.v('w1Mark', ms);
        
        // Weapon 1 state depends on how long held
        let duration = ms - this.v('w1Mark');
        if (duration > Form.w1Charge3Ms)      this.v('w1State', 3);
        else if (duration > Form.w1Charge2Ms) this.v('w1State', 2);
        else if (duration > Form.w1Charge1Ms) this.v('w1State', 1);
        else                                  this.v('w1State', 0);
        
      } else if (this.v('w1Mark')) {
        
        // Activate the charged ability!!
        if (this.v('w1State') === 0) {
          
          // JoustMan is punished for holding for too short a time
          this.v('effects').add({ mark: ms + Form.w1ChargePunishMs, type: 'spdMult', spdMult: Form.w1ChargePunishSlow });
          
        } else if (this.v('w1State') === 1) {
          
          // Weapon 1 act 1: Spread shot
          
          let { x, y } = this.getRelVal(ud);
          let incAng = 0.018;
          let args = { owner: this, team: 'ace', ax: x, ay: y, dmg: 0.75, lsMs: 700, vel: 350, bound: { form: 'circle', r: 6 } };
          for (let ang of util.incCen(9, incAng)) ud.spawnEntity({ type: 'JoustManBullet', ...args, ang });
          
          this.v('effects').add({ mark: ms + 500, type: 'spdMult', spdMult: 1.1 });
          
        } else if (this.v('w1State') === 2) {
          
          // Weapon 1 act 2: Spheres
          let args = { joustMan: this, team: 'ace', lsMs: 1800 };
          let offs = [
            { xOff: -64, yOff: +16, r: 28, dps: 11 },
            { xOff: +64, yOff: +16, r: 28, dps: 11 },
            { xOff: +24, yOff: -30, r: 20, dps: 8 },
            { xOff: -24, yOff: -30, r: 20, dps: 8 }
          ];
          for (let off of offs) ud.spawnEntity({ type: 'JoustManLaserSphere', ...args, ...off });
          
          this.v('effects').add({ mark: ms + 1000, type: 'spdMult', spdMult: 1.3 });
          
        } else if (this.v('w1State') === 3) {
          
          // Weapon 1 act 3: BIG LASER
          //ud.spawnEntity({ type: 'JoustManLaserVert', joustMan: this, team: 'ace', lsMs: Form.w1Charge3Duration });
          this.v('joustMark', ms);
          this.v('joustReloadMark', ms);
          this.v('effects').add({ mark: ms + Form.w1Charge3Duration, type: 'spdMult', spdMult: Form.w1Charge3Slow });
          
        }
        
        this.v('w1State', 0);
        this.v('w1Mark', 0);
        
      }
      
      // Activate weapon 2
      if (a2 && cx && (!this.v('w2Mark') || ms > this.v('w2Mark'))) {
        
        this.v('w2Mark', ms + Form.w2Delay);
        
        let dir = cx > 0 ? +1 : -1;
        this.v('invulnMark', v => Math.max(v || 0, ms + 250));
        this.v('effects').add({ mark: ms + 250, type: 'force', force: [ ms, 'vel', Form.w2DashSpeed * dir, 0 ] });
        this.v('effects').add({ mark: ms + 270, type: 'spdMult', spdMult: 0 });
        
        ud.spawnEntity({ type: 'JoustManLaserHorz', joustMan: this, team: 'ace', lsMs: Form.w2DurationMs, r: 9, dir });
        
      }
      
    },
    render: function(ud, draw) {
      
      forms.Ace.render.call(this, ud, draw);
      
      let { x, y } = this.getAbsVal(ud);
      let w1Mark = this.v('w1Mark');
      let w1State = this.v('w1State');
      let w2Mark = this.v('w2Mark');
      
      // Laser reload
      let bar1H = w1Mark ? Math.min(1, (ud.ms - w1Mark) / Form.w1Charge3Ms) * 20 : 0;
      let [ bar1W, col ] = [
        [ 16, 'rgba(0, 0, 0, 1)' ],         // Punished
        [ 16, 'rgba(0, 150, 150, 0.7)' ],   // Spread shot
        [ 8,  'rgba(0, 255, 255, 0.7)' ],   // Butterfly
        [ 12, 'rgba(100, 255, 255, 0.8)' ]  // Laser
      ][w1State];
      draw.rect(x + bar1W * -0.5, y - 8, bar1W, bar1H, { fillStyle: col });
      
      // Flash reload
      let msRemaining = ((w2Mark || ud.ms) - ud.ms);
      let bar2W = (msRemaining > 0)
        ? Math.max(0, Math.min(1, (Form.w2Delay - msRemaining) / Form.w2Delay))
        : 1;
      draw.rectCen(x, y - 12, bar2W * 16, 4, { fillStyle: `rgba(0, 0, 255, ${msRemaining > 0 ? 0.4 : 1})` });
      
    }
    
  })});
  let GunGirl = U.form({ name: 'GunGirl', has: { Ace }, props: (forms, Form) => ({
    
    $shootSteps: [
      { ms: 1000, ang: -0.01, dmgMult: 1   },  // Inwards
      { ms: 1000, ang: +0.00, dmgMult: 1.4 },  // Parallel again
      { ms: 1500, ang: +0.02, dmgMult: 1   },  // Very slowly increase angle
      { ms: 4000, ang: +0.25, dmgMult: 1   }   // Slowly bend all the way outwards
    ],
    $w1Delay: 85, $bulletDmg: 0.35, $w1LockMs: 1100,
    $w1ShortLockPunishSlow: 0.36, $w1ShortLockPunishMs: 250,
    $w1LongLockPunishSlow: 0.80, $w1LongLockPunishMs: 600,
    $w1ReloadBoostMs: 800, $w1ReloadBoostAmt: 1.3,
    $w2Delay: 10000, $w2Duration: 1900,
    $bulletDmg: 0.3, $bulletSpd: 740, $bulletMs: 800,
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'aceGun.png' ]),
    
    initControlProps: function({ ms }) {
      return {
        lockoutPunishMark: null,
        w1Mark: null,                   // Marks when bullet ready to fire
        w1StartMark: null,              // Marks the time the first bullet of the series was fired
        w1LockMark: ms,                 // Marks when lockout will end
        w2ReadyMark: ms,                // Marks when w2 can be used
        w2Mark: ms,                     // Marks when w2 ends
        w2EffectiveShootDuration: null  // Marks where in the shooting pattern to pause during steroid
      };
    },
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'w2ReadyMark' ].gain(...arr)),
    getAngForShootDuration: function(ms) {
      
      let prevMs = 0;
      let prevAng = 0;
      for (let step of Form.shootSteps) {
        
        let curMs = prevMs + step.ms;
        
        if (ms < curMs) {
          return { ...step, smoothAng: util.fadeAmt(prevAng, step.ang, (ms - prevMs) / step.ms) };
        }
        
        prevMs += step.ms;
        prevAng = step.ang;
        
      }
      
      let result = Form.shootSteps.slice(-1)[0];
      return { ...result, smoothAng: result.ang };
      
    },
    aceUpdate: function(ud, { a1, a2 }) {
      
      let { aheadDist, ms, spf } = ud;
      
      // Reset `this.lockoutPunishMark` when the duration ends
      if (this.v('lockoutPunishMark') && ms >= this.v('lockoutPunishMark')) this.v('lockoutPunishMark', null);
      
      if (this.v('w1LockMark') && ms >= this.v('w1LockMark')) {
        this.v('w1LockMark', null);
        
        // Upon reload, get a speed boost
        this.v('effects').add({ mark: ms + Form.w1ReloadBoostMs, type: 'spdMult', spdMult: Form.w1ReloadBoostAmt });
      }
      
      // End w2 when the duration elapses
      if (this.v('w2Mark') && ms >= this.v('w2Mark')) {
        this.v('w2Mark', null);
        this.v('w1LockMark', ms + Form.w1LockMs);
      }
      
      if (a1 && !this.v('w1LockMark') && (!this.v('w1Mark') || ms >= this.v('w1Mark'))) {
        
        // Mark the time of the first shot in the series
        if (!this.v('w1StartMark')) this.v('w1StartMark', ms);
        
        let { x, y } = this.getRelVal(ud);
        if (!this.v('w2Mark')) {
          
          // Enforce typical rate of fire
          this.v('w1Mark', v => (v || ms) + Form.w1Delay);
          
          let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(ms - this.v('w1StartMark'));
          let args = { owner: this, team: 'ace', vel: Form.bulletSpd, dmg: Form.bulletDmg * dm, bound: { form: 'circle', r: 3 * dm }, lsMs: Form.bulletMs };
          ud.spawnEntity({ type: 'MBullet', ax: x - 4, ay: y, ...args, ang: -ang });
          ud.spawnEntity({ type: 'MBullet', ax: x + 4, ay: y, ...args, ang: +ang });
          
        } else {
          
          // Enforce steroid rate of fire
          this.v('w1Mark', v => (v || ms) + Form.w1Delay * 0.65);
          
          let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(this.v('w2EffectiveShootDuration'));
          let args = { owner: this, team: 'ace', vel: Form.bulletSpd, dmg: Form.bulletDmg * 1.15 * dm, bound: { form: 'circle', r: 5 * dm }, lsMs: Form.bulletMs };
          
          ud.spawnEntity({ type: 'MBullet', ax: x - 8, ay: y, ...args, ang: -(ang * 1.5) });
          ud.spawnEntity({ type: 'MBullet', ax: x - 4, ay: y, ...args, ang: -(ang * 1.0) });
          ud.spawnEntity({ type: 'MBullet', ax: x + 4, ay: y, ...args, ang: +(ang * 1.0) });
          ud.spawnEntity({ type: 'MBullet', ax: x + 8, ay: y, ...args, ang: +(ang * 1.5) });
          
        }
        
      } else if (this.v('w1Mark') && ms >= this.v('w1Mark')) {
        
        // Just stopped shooting! Lockout!
        this.v('w1Mark', null);
        this.v('w1StartMark', null);
        this.v('w1LockMark', ms + Form.w1LockMs);
        
        this.v('effects').add({ mark: ms + Form.w1ShortLockPunishMs, type: 'spdMult', spdMult: Form.w1ShortLockPunishSlow });
        this.v('effects').add({ mark: ms + Form.w1LongLockPunishMs, type: 'spdMult', spdMult: Form.w1LongLockPunishSlow });
        
      }
      
      if (a2) {
        
        if (ms >= this.v('w2ReadyMark')) {
          
          this.v('w2ReadyMark', ms + Form.w2Duration + Form.w2Delay);
          this.v('w2Mark', ms + Form.w2Duration);
          this.v('w2EffectiveShootDuration', ms - (this.v('w1StartMark') || ms));
          
          let incAng = 0.029;
          let { x, y } = this.getRelVal(ud);
          let bulletArgs = { owner: this, team: 'ace', ax: x, ay: y, vel: 140, dmg: 3, bound: { form: 'circle', r: 5 }, lsMs: 2500 };
          for (let ang of util.incCen(15, incAng)) {
            ud.spawnEntity({ type: 'MBullet', ...bulletArgs, ang: 0.5 + ang });
          }
          
        } else {
          
          if (!this.v('lockoutPunishMark')) {
            this.v('lockoutPunishMark', ms + 500);
            this.v('effects').add({ mark: ms + 500, type: 'spdMult', spdMult: 0.4 });
          }
          
        }
        
      }
      
    },
    
    render: function(ud, draw) {
      
      forms.Ace.render.call(this, ud, draw);
      
      let { x, y } = this.getAbsVal(ud);
      let w2MsRemaining = this.v('w2ReadyMark') - ud.ms;
      let barW = Math.min(1, (Form.w2Delay - w2MsRemaining) / Form.w2Delay) * 16;
      draw.rectCen(x, y - 12, barW, 4, { fillStyle: (w2MsRemaining > 0) ? '#6060ff' : '#0000ff' });
      
    }
    
  })});
  let SlamKid = U.form({ name: 'SlamKid', has: { Ace }, props: (forms, Form) => ({
    
    $slamSpd: 450 / Math.sqrt(2), $slamDelay: 690,
    $slamCharge1Ms: 300, $slamCharge2Ms: 630, $slamCharge3Ms: 750,
    $slamPunishMs: 1500, $slamPunishSlow: 0.25, $slamDecel: 550 / Math.sqrt(2),
    $missileVel: 550, $missileAcl: 800, $missileDmg: 2.1, $missilePDmg: [0.3,4.5],
    $shotgunCnt: 18, $shotgunInitAng: 0.023, $shotgunAng: 0.009,
    $shotgunSpd: 650, $shotgunDmg: 0.082, $shotgunPDmg: [0.09,0.28], $shotgunLsMs: 305,
    $shotgunSlamDelayMult: 0.55,
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'aceSlam.png' ]),
    
    initControlProps: function({ ms }) {
      return { w1Mark: ms, w1StartMark: null, w2Mark: ms, w2StartMark: null };;
    },
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)),
    aceUpdate: function(ud, { a1, a2 }) {
      
      let { aheadDist, ms, spf } = ud;
      let forces = [];
      
      // Slam Kid is symmetrical; do the same thing in two directions:
      let dirs = [
        [ -1, a1, 'w1Mark', 'w1StartMark' ],
        [ +1, a2, 'w2Mark', 'w2StartMark' ]
      ];
      for (let [ mult, act, wMark, wMarkStart ] of dirs) {
        
        if (act && ms > this.v(wMark) && (!this.v(wMarkStart) || ms < this.v(wMarkStart) + Form.slamCharge3Ms)) {
          
          if (!this.v(wMarkStart)) {
            this.v(wMarkStart, ms);
            
            let inc1 = 10; let inc2 = 20;
            let args = { slamKid: this, team: 'ace', dir: mult };
            ud.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: +inc2 + (mult * 20), yOff: (-inc2 * mult) + 16 });
            ud.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: +inc1 + (mult * 20), yOff: (-inc1 * mult) + 16 });
            ud.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff:     0 + (mult * 20), yOff: (    0 * mult) + 16 });
            ud.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: -inc1 + (mult * 20), yOff: (+inc1 * mult) + 16 });
            ud.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: -inc2 + (mult * 20), yOff: (+inc2 * mult) + 16 });
            
          }
          
          let duration = ms - this.v(wMarkStart);
          let durFade = Math.pow(util.fadeAmt(1, 0.1, duration / Form.slamCharge3Ms), 0.95);
          let spd = Form.slamSpd; // this.v('slamSpd');
          forces.push([ this.v(wMarkStart), 'acl', spd * mult, spd, Form.slamDecel * mult * -1, Form.slamDecel * -1 ]);
          
        } else if (this.v(wMarkStart)) {
          
          let duration = ms - this.v(wMarkStart);
          if (duration >= Form.slamCharge3Ms){
            
            // Nothing right now for exceeding charge duration
            this.v(wMark, ms + Form.slamDelay);
            
          } else if (duration >= Form.slamCharge2Ms) {
            
            // No effect for releasing in the last part of the charge
            this.v(wMark, ms + Form.slamDelay);
            
          } else if (duration >= Form.slamCharge1Ms) {
            
            // Missile!!
            let { x, y } = this.getRelVal(ud);
            let missileArgs = {
              owner: this, team: 'ace',
              ax: x + (mult * 9), ay: y,
              vel: Form.missileVel, acl: Form.missileAcl,
              dmg: Form.missileDmg, pDmg: Form.missilePDmg,
              bound: { form: 'rect', w: 5, h: 18 },
              lsMs: 2000
            };
            ud.spawnEntity({ type: 'MBullet', ...missileArgs, ang: 0.0 });
            ud.spawnEntity({ type: 'MBullet', ...missileArgs, ang: 0.5 });
            
            this.v('effects').add({ mark: ms + 150, type: 'force', force: [ ms, 'vel', 0, -220 ] });
            this.v(wMark, ms + Form.slamDelay);
            
          } else {
            
            // Shotgun!
            let { x, y } = this.getRelVal(ud);
            let shotgunArgs = {
              aheadDist, ms, owner: this, team: 'ace', ax: x + mult * 7, ay: y - 7,
              dmg: Form.shotgunDmg, pDmg: Form.shotgunPDmg,
              vel: Form.shotgunSpd,
              lsMs: Form.shotgunLsMs,
              bound: { form: 'circle', r: 2 }
            };
            for (let ang of util.incCen(Form.shotgunCnt, Form.shotgunAng)) ud.spawnEntity({
              type: 'MBullet', ...shotgunArgs, ang: mult * (0.125 + ang)
            });
            
            this.v('effects').add({ mark: ms + 300, type: 'spdMult', spdMult: 1.2 });
            this.v('effects').add({ mark: ms + 300, type: 'force', force: [ ms, 'vel', -50 * mult, -50 ] });
            
            this.v(wMark, ms + Form.slamDelay * Form.shotgunSlamDelayMult);
            
          }
          
          this.v(wMarkStart, null);
          
        }
        
      }
      
      let spdMult = (this.w1StartMark || this.w2StartMark) ? 0.55 : 1;
      return { spdMult, forces };
      
    }
    
  })});
  let SalvoLad = U.form({ name: 'SalvoLad', has: { Ace }, props: (forms, Form) => ({
    
    $comboDelayMs: 800, $comboPunishDelayMs: 1000,
    $decampDelayMs: 1200, $decampDurationMs: 350, $decampSpdMult: 0.5, $decampSpd: 430,
    $diveDelayMs: 600, $diveMs: 700, $diveSpdMult: 0.60, $diveFwdMult: 450, $diveBombLsMs: 1200,
    $missileDelayMs: 600, $missileDmg: 0.5, $missilePDmg:  [0.1,2],
    $suppressDelayMs: 600, $suppressDmg: 0.4,
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'aceSalvo.png' ]),
    
    initControlProps: function(ud) {
      // "a1Up" and "a2Up" help ensure one entry per key press
      return { readyMark: null, combo: '', a1Up: false, a2Up: false };
    },
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr, { comboMapping: {
      '<<<': i.comboDecamp.bind(i, -1),
      '>>>': i.comboDecamp.bind(i, +1),
      
      '<<>': i.comboDiveBomb.bind(i, -1),
      '>><': i.comboDiveBomb.bind(i, +1),
      
      '<>>': i.comboMissiles.bind(i, -1),
      '><<': i.comboMissiles.bind(i, +1),
      
      '<><': i.comboSuppress.bind(i, -1),
      '><>': i.comboSuppress.bind(i, +1)
    }})),
    
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'readyMark', 'combo' ].gain(...arr)),
    comboDecamp: function(dir, ud) {
      
      this.v('invulnMark', v => Math.max(v, ud.ms + Form.decampDurationMs));
      this.v('effects').add({ mark: ud.ms + Form.decampDurationMs, type: 'force', force: [ ud.ms, 'vel', Form.decampSpd * dir, 0 ] });
      this.v('effects').add({ mark: ud.ms + Form.decampDurationMs, type: 'spdMult', spdMult: Form.decampSpdMult });
      
      let { x, y } = this.getRelVal(ud);
      let missileArgs = { salvoLad: this, team: 'ace', ax: x, ay: y };
      ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 + dir * 0.000, vel:  15, lsMs:  400, kaboomArgs: { dps: 4.75, lsMs: 1900 } });
      ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 + dir * 0.005, vel: 120, lsMs:  700, kaboomArgs: { dps: 4.75, lsMs: 2300 } });
      ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 - dir * 0.005, vel: 150, lsMs: 1050, kaboomArgs: { dps: 4.75, lsMs: 2150 } });
      
      return { delayMs: Form.decampDelayMs };
      
    },
    comboDiveBomb: function(dir, { ms, spf, aheadDist }) {
      
      this.v('effects').add({ mark: ms + Form.diveMs, type: 'spdMult', spdMult: Form.diveSpdMult });
      this.v('effects').add({ mark: ms + Form.diveMs, type: 'force', force: [ ms, 'acl', 150 * dir, 0, 0, 750 ] });
      this.v('effects').add({ mark: ms + Form.diveMs,
        endFn: (i, ud) => {
          
          let { x, y } = i.getRelVal(ud);
          let lsMsMult = this.controls.d[0] ? 0.65 : (this.controls.u[0] ? 1.5 : 1);
          
          let missileArgs = { type: 'SalvoLadDumbBomb', salvoLad: i, team: 'ace', ax: x, ay: y };
          ud.spawnEntity({ ...missileArgs, ang: dir * 0.109, vel: 140, lsMs: Form.diveBombLsMs * lsMsMult * 1.010, kaboomArgs: { dps: 4.75, lsMs: 1900 } });
          ud.spawnEntity({ ...missileArgs, ang: dir * 0.078, vel: 158, lsMs: Form.diveBombLsMs * lsMsMult * 1.000, kaboomArgs: { dps: 4.75, lsMs: 2300 } });
          ud.spawnEntity({ ...missileArgs, ang: dir * 0.030, vel: 148, lsMs: Form.diveBombLsMs * lsMsMult * 0.989, kaboomArgs: { dps: 4.75, lsMs: 2150 } });
          
          this.v('effects').add({ mark: ud.ms + 350, type: 'force', force: [ ud.ms, 'vel', 0, -150 ] });
          
        }
      });
      return { birth: [], delayMs: Form.diveDelayMs };
      
    },
    comboMissiles: function(dir, ud) {
      
      let args = { owner: this, team: 'ace', w: 6, h: 20, vel: 700, ang: 0, horzMs: 400, delayMs: 120, dmg: Form.missileDmg, pDmg: Form.missilePDmg };
      (5).toArr(n => n).each(n => {
        this.v('effects').add({ mark: ud.ms + 50 + n * 30, endFn: (i, ud) => ud.spawnEntity({
          type: 'SalvoLadMissile', ...args, ...i.getRelVal(ud).slice({ ax: 'x', ay: 'y' }),
          horzSpd: (115 + 30 * (n + 1)) * dir
        })});
      });
      return { delayMs: Form.missileDelayMs };
      
    },
    comboSuppress: function(dir, ud) {
      
      this.v('effects').add({ mark: ud.ms + 500, type: 'spdMult', spdMult: 1.5 });
      
      let args = { team: 'ace', ang: dir * 0.11, dmg: Form.suppressDmg, bound: { form: 'circle', r: 4 }, lsMs: 500, vel: 360, acl: 800 };
      for (let i = 0; i < 11; i++) {
        let alt = i % 4;
        this.v('effects').add({ mark: ud.ms + 50 + i * alt * 18, endFn: (i, ud) => {
          let { x, y } = i.getRelVal(ud);
          x += 6 * alt * dir;
          y += 30 - 12 * alt
          ud.spawnEntity({ type: 'MBullet', owner: i, ...args, ax: x, ay: y });
        }});
      }
      return { delayMs: Form.suppressDelayMs };
      
    },
    aceUpdate: function(ud, { a1, a2 }) {
      
      let { ms, spf } = ud;
      
      if (this.v('readyMark') && ms >= this.v('readyMark')) { this.v('readyMark', null); this.v('combo', ''); }
      
      if (!this.v('readyMark')) {
        
        if (a1) {
          if (!this.v('a1Up') && !a2) { this.v('combo', v => v + '<'); this.v('a1Up', true); }
        } else if (this.v('a1Up')) {
          this.v('a1Up', false);
        }
        
        if (a2) {
          if (!this.v('a2Up') && !a1) { this.v('combo', v => v + '>'); this.v('a2Up', true); }
        } else if (this.v('a2Up')) {
          this.v('a2Up', false);
        }
        
        if (this.v('comboMapping').has(this.v('combo'))) {
          let comboResult = this.v('comboMapping')[this.v('combo')](ud);
          this.v('readyMark', ms + comboResult.delayMs);
        } else if (this.v('combo').length >= 5) {
          this.v('effects').add({ mark: ms + Form.comboPunishDelayMs, type: 'spdMult', spdMult: 0.45 });
          this.v('readyMark', ms + Form.comboDelayMs);
        }
        
      }
      
    },
    
    render: function(ud, draw) {
      
      forms.Ace.render.call(this, ud, draw);
      
      let { x, y } = this.getAbsVal(ud);
      let readyMark = this.v('readyMark');
      let combo = this.v('combo');
      
      let waitMs = readyMark - ud.ms;
      let dispY = y - 16;
      let indSize = 8;
      let comboW = combo.length * indSize;
      
      if (waitMs > 0) {
        
        let waitAmt = Math.min(waitMs / 750, 1);
        if (combo.length < 3) comboW = 3 * indSize;
        draw.rectCen(x, dispY, waitAmt * (comboW + 4), indSize + 4, { fillStyle: 'rgba(80, 80, 80, 0.4)' });
        
      }
      if (combo.length > 0) {
      
        let hIndSize = indSize >> 1;
        let comboW = combo.length * indSize;
        draw.rectCen(x, dispY, comboW + 4, indSize + 4, { strokeStyle: 'rgba(80, 80, 80, 0.4)', lineWidth: 1 });
        
        let dispX = x - (comboW >> 1);
        for (let c of combo) {
          draw.path({ fillStyle: '#000000' }, ({ jump, draw }) => {
            if (c === '<') {
              jump(dispX + indSize, dispY - hIndSize);
              draw(dispX, dispY);
              draw(dispX + indSize, dispY + hIndSize);
            } else if (c === '>') {
              jump(dispX, dispY - hIndSize);
              draw(dispX + indSize, dispY);
              draw(dispX, dispY + hIndSize);
            }
          });
          dispX += indSize;
        }
        
      };
      
    }
    
  })});
  
  // Good guy util
  let JoustManBullet = U.form({ name: 'JoustManBullet', has: { MBullet }, props: (forms, Form) => ({
    render: function(ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      let r = this.v('bound').r;
      draw.circ(x, y, r,       { fillStyle: 'rgba(0, 255, 255, 0.65)' });
      draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
    }
  })});
  let JoustManLaserSphere = U.form({ name: 'JoustManLaserSphere', has: { Entity }, props: (forms, Form) => ({
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { xOff, yOff, r, dps, joustMan=null, joustManUid=joustMan.uid, team } = val;
      return {}.gain(...arr, { xOff, yOff, r, dps, joustMan, joustManUid, team });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'xOff', 'yOff', 'r', 'joustManUid' ].gain(...arr)),
    getCollideResult: function(ud, tail) {
      if (U.hasForm(tail, Mortal)) tail.takeDamage(ud, this.rv(ud, 'joustMan'), this.dps * ud.spf);
    },
    getRelVal: function(ud) {
      let { x, y } = this.rv(ud, 'joustMan').getRelVal(ud);
      return { x: x + this.v('xOff'), y: y + this.v('yOff') };
    },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'circle', r: this.v('r'), x, y },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    },
    isAlive: function(ud) {
      return true
        && forms.Entity.isAlive.call(this, ud)
        && this.rv(ud, 'joustMan').isAlive(ud);
    },
    render: function(ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      let r = this.v('r');
      draw.circ(x, y, r, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
      draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
    }
    
  })});
  let JoustManLaserVert = U.form({ name: 'JoustManLaserVert', has: { Entity }, props: (forms, Form) => ({
    
    $dps: 12, $w: 26, $h: 1200,
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { joustMan=null, joustManUid=joustMan.uid, team } = val;
      return {}.gain(...arr, { joustMan, joustManUid, team });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'joustManUid' ].gain(...arr)),
    getCollideResult: function(ud, tail) {
      if (U.hasForm(tail, Mortal)) tail.takeDamage(ud, this.rv(ud, 'joustMan'), Form.dps * ud.spf);
    },
    getRelVal: function(ud) {
      let { x, y } = this.rv(ud, 'joustMan').getRelVal(ud);
      return { x, y: y + 8 + Form.h * 0.5 };
    },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'rect', w: Form.w, h: Form.h, x, y },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    },
    isAlive: function(ud) {
      return true
        && forms.Entity.isAlive.call(this, ud)
        && this.rv(ud, 'joustMan').isAlive(ud);
    },
    render: function (ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      draw.rectCen(x, y, Form.w, Form.h, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
      draw.rectCen(x, y, Form.w * 0.6, Form.h, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
    }
    
  })});
  let JoustManLaserJoust = U.form({ name: 'JoustManLaserJoust', has: { MBullet }, props: (forms, Form) => ({
    $bound: { form: 'rect', w: 34, h: 20 },
    $vel: 800,
    $lsMs: 650,
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr, { bound: Form.bound, vel: Form.vel, lsMs: Form.lsMs, ang: 0 })),
    render: function(ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      draw.rectCen(x, y, Form.bound.w, Form.bound.h, { fillStyle: 'rgba(0, 255, 255, 0.64)' });
      draw.rectCen(x, y, Form.bound.w * 0.6, Form.bound.h, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
    }
  })});
  let JoustManLaserHorz = U.form({ name: 'JoustManLaserHorz', has: { Entity }, props: (forms, Form) => ({
    
    $dps: 30, $w: 125, $h: 12,
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { joustMan=null, joustManUid=joustMan.uid, team, dir } = val;
      return {}.gain(...arr, { joustMan, joustManUid, team, dir });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'joustManUid', 'dir' ].gain(...arr)),
    getCollideResult: function(ud, tail) {
      if (U.hasForm(tail, Mortal)) tail.takeDamage(ud, this.rv(ud, 'joustMan'), Form.dps * ud.spf);
    },
    getRelVal: function(ud) {
      let { x, y } = this.rv(ud, 'joustMan').getRelVal(ud);
      return { x: x + Form.w * -0.5 * this.v('dir'), y };
    },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'rect', w: Form.w, h: Form.h, x, y },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    },
    isAlive: function(ud) {
      return true
        && forms.Entity.isAlive.call(this, ud)
        && this.rv(ud, 'joustMan').isAlive(ud);
    },
    render: function (ud, draw) {
      let { x: jx, y: jy } = this.rv(ud, 'joustMan').getAbsVal(ud);
      let { x, y } = this.getAbsVal(ud);
      draw.circ(jx, jy, 20, { fillStyle: 'rgba(0, 255, 255, 0.5)' });
      draw.rectCen(x, y, Form.w, Form.h, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
      draw.rectCen(x, y, Form.w, Form.h * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
    }
    
  })});
  let SlamKidSlammer = U.form({ name: 'SlamKidSlammer', has: { Entity }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 7 }, $dmg: 1.4,
    $render: (draw, ud, { x, y, ggg }) => {
      draw.circ(x, y, Form.bound.r, { fillStyle: Bullet.getColour(+1) });
    },
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { team, slamKid=null, slamKidUid=slamKid.uid, dir, xOff, yOff, integrity=1 } = val;
      return {}.gain(...arr, { team, slamKid, slamKidUid, dir, xOff, yOff, integrity });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'slamKidUid', 'xOff', 'yOff' ].gain(...arr)),
    getCollideResult: function(ud, tail) {
      if (U.hasForm(tail, Mortal)) {
        tail.takeDamage(ud, this.rv(ud, 'slamKid'), Form.dmg);
        this.v('integrity', 0);
      }
    },
    getRelVal: function(ud) {
      let { x, y } = this.rv(ud, 'slamKid').getRelVal(ud);
      return { x: x + this.v('xOff'), y: y + this.v('yOff') };
    },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { ...Form.bound, x, y },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    },
    isAlive: function(ud) {
      if (this.v('integrity') <= 0) return false;
      let sk = this.rv(ud, 'slamKid');
      return true
        && sk.isAlive(ud) // SlamKid is alive
        && sk.v((this.v('dir') === -1) ? 'w1StartMark' : 'w2StartMark') // Slammer is held
    },
    
    render: function(ud, draw) {
      let { x, y } = this.getAbsVal(ud);
      draw.circ(x, y, Form.bound.r, { fillStyle: '#ff8000' });
    },
    
  })});
  let SalvoLadDumbBomb = U.form({ name: 'SalvoLadDumbBomb', has: { Entity, Mover }, props: (forms, Form) => ({
    
    $r: 13,
    $render: (draw, ud, { x, y }) => {
      draw.circ(x, y, Form.r, { fillStyle: '#ff0000', strokeStyle: '#ff8400' });
    },
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { team=null, salvoLad=null, kaboomArgs={} } = val;
      return {}.gain(...arr, { team, salvoLad, kaboomArgs });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)),
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'circle', r: Form.r, x, y },
        team: this.v('team'),
        sides: []
      }};
    },
    getDieResult: function(ud) {
      forms.Entity.getDieResult.call(this, ud);
      
      let { x, y } = this.getRelVal(ud);
      let iy = ud.bounds.total.y;
      ud.spawnEntity({ type: 'SalvoLadKaboom', team: this.v('team'), salvoLad: this.rv(ud, 'salvoLad'), ax: x, ay: y, iy, ...this.kaboomArgs });
    },
    isAlive: forms.Entity.isAlive
  })});
  let SalvoLadKaboom = U.form({ name: 'SalvoLadKaboom', has: { Entity, Physical }, props: (forms, Form) => ({
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { team=null, salvoLad=null, r=0, dps=3.1, sizePerSec=30 } = val;
      return {}.gain(...arr, { team, salvoLad, r, dps, sizePerSec });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'sizePerSec' ].gain(...arr)),
    getRelVal: function(ud) {
      let { x, y } = forms.Physical.getRelVal.call(this, ud);
      return { x, y, r: this.v('sizePerSec') * this.getAgeMs(ud) * 0.001 };
    },
    getCollideResult: function(ud, tail) {
      if (U.hasForm(tail, Mortal)) tail.takeDamage(ud, this.v('salvoLad'), this.v('dps') * ud.spf);
    },
    getStepResult: function(ud) {
      this.setForces(ud, [ [ this.v('ms'), 'vel', 0, ud.level.v('aheadSpd') * -0.5 ] ]);
      let { x, y, r } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'circle', x, y, r },
        team: this.v('team'),
        sides: [ 'head' ]
      }};
    },
    render: function(ud, draw) {
      let { x, y, r } = this.getAbsVal(ud);
      draw.circ(x, y, r, { fillStyle: 'rgba(255, 50, 30, 0.2)', strokeStyle: '#ff8400' });
    }
    
  })});
  let SalvoLadMissile = U.form({ name: 'SalvoLadMissile', has: { MBullet }, props: (forms, Form) => ({
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      
      let args = { horzSpd: 0, horzMs: 0, delayMs: 0, bound: { form: 'rect', w: 3, h: 14 } };
      
      // Any properties in `val` replace those in `args`
      return ({}).gain(...arr, args.map((v, k) => val.has(k) ? val[k] : v));
      
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'horzSpd', 'horzMs', 'delayMs' ].gain(...arr)),
    getRelVal: function(ud) {
      
      let durMs = this.getAgeMs(ud);
      let x = this.v('ax');
      let y = this.v('ay'); // + (ud.aheadDist - this.initDist) * durMs * 0.001;
      let horzMs = this.v('horzMs');
      let horzSpd = this.v('horzSpd');
      let delayMs = this.v('delayMs');
      
      // X changes for horzMs, then stays put
      if (durMs < horzMs) x += horzSpd * durMs * 0.001;
      else                x += horzSpd * horzMs * 0.001;
      
      if (durMs > horzMs + delayMs) {
        y = forms.MBullet.getRelVal.call(this, ud, ud.ms - (horzMs + delayMs)).y;
      }
      
      return { x, y };
      
    }
    
  })});
  
  // BAD GUYS
  let Enemy = U.form({ name: 'Enemy', has: { Mortal }, props: (forms, Form) => ({
    
    $render: (draw, ud, { imageKeep, x, y, w, h=w, rot=Math.PI }) => {
      draw.frame(() => {
        draw.trn(x, y);
        if (rot) draw.rot(rot);
        draw.imageCen(imageKeep, 0, 0, w, h);
      });
    },
    
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr, { scoreDamage: 0 })),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)),
    getCollideResult: function(ud, ent) {
      console.log(`${U.getFormName(this)} -> ${U.getFormName(ent)}`);
      if (U.hasForm(ent, Mortal)) ent.takeDamage(ud, this, 1);
    },
    getStepResult: function(ud) {
      
      let { x, y } = this.getAbsVal(ud);
      return {
        tangibility: {
          bound: { form: 'circle', x, y, r: 30 },
          team: 'enemy',
          sides: [ 'head', 'tail' ]
        }
      };
      
    },
    
    render: function(ud, draw) {
      
      let { x, y, r=null } = this.getAbsVal(ud);
      
      if (r === null && this.constructor.bound && this.constructor.bound.r) r = this.constructor.bound.r;
      if (r === null) r = 8;
      draw.circ(x, y, r, { fillStyle: '#00a000' });
      
    }
    
  })});
  let Spawner = U.form({ name: 'Spawner', props: (forms, Form) => ({
    
    init: C.noFn('init'),
    getSpawnTypes: function() { return { spawn: { type: this.constructor.name } }; },
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let spawnTypes = i.getSpawnTypes();
      let props = {};
      for (let st in spawnTypes) {
        props[`${st}Mode`] = val.has(`${st}Mode`) ? val[`${st}Mode`] : 'steady';
        props[`${st}DelayMs`] = val.has(`${st}DelayMs`) ? val[`${st}DelayMs`] : 2500;
        props[`${st}Props`] = spawnTypes[st].gain(val.has(`${st}Props`) ? val[`${st}Props`] : {});
        props[`${st}Mark`] = val.ud.ms + (val.has(`${st}InitDelayMs`) ? val[`${st}InitDelayMs`] : props[`${st}DelayMs`]);
      }
      return {}.gain(...arr, props, { spawnTypes: spawnTypes.toArr((v, k) => k) });
    }),
    doSpawn: function(ud, spawnType, state, props) {
      let { ms } = ud;
      return ud.spawnEntity({ ms, ...props, owner: this, ...state.slice('x', 'y') });
    },
    getStepResult: function(ud) {
      
      let state = this.getRelVal(ud);
      
      for (let st of this.v('spawnTypes')) {
        
        let mode = this.v(`${st}Mode`);
        let delayMs = this.v(`${st}DelayMs`);
        let mark = this.v(`${st}Mark`);

        let shootCnd = (mode === 'steady')
          ? (ud.ms >= mark)
          : (Math.random() < ((ud.spf * 1000) / delayMs));
        
        if (shootCnd) {
          this.doSpawn(ud, st, state, this.v(`${st}Props`));
          this.v(`${st}Mark`, v => v + delayMs);
        }
        
      }
      
    }
    
  })});
  
  let Winder = U.form({ name: 'Winder', has: { Enemy }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 20 }, $hp: 1,
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyWinder.png' ]),
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { x, y, ax=x, ay=y, spd=100, delayMs=0, phase=0, swingHz=0, swingAmt=0, numSwings=0 } = val;
      if (swingHz < 0) throw Error(`Negative "swingHz" param; use negative "swingAmt" instead`);
      return {}.gain(...arr, { ax, ay, spd, delayMs, phase, swingHz, swingAmt, numSwings });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'ax', 'ay', 'spd', 'delayMs', 'phase', 'swingHz', 'swingAmt' ].gain(...arr)),
    getRelVal: function(ud) {
      let durMs = this.getAgeMs(ud);
      let ax = this.v('ax'); let ay = this.v('ay');
      let spd = this.v('spd');
      let delayMs = this.v('delayMs');
      let phase = this.v('phase');
      let swingHz = this.v('swingHz');
      let swingAmt = this.v('swingAmt');
      
      return {
        x: (durMs >= delayMs)
          ? ax + Math.sin(phase + (durMs - delayMs) * 0.002 * Math.PI * swingHz) * swingAmt
          : ax,
        y: ay + spd * durMs * 0.001
      };
    },
    getMaxHp: function(ud) { return this.constructor.hp; },
    getStepResult: function(ud) {
      let { x, y } = this.getAbsVal(ud);
      return {
        tangibility: {
          bound: { ...this.constructor.bound, x, y },
          team: 'enemy',
          sides: [ 'head', 'tail' ]
        }
      };
    },
    isAlive: function(ud) {
      if (!forms.Enemy.isAlive.call(this, ud)) return false;
      
      let { bounds } = ud;
      let durMs = this.getAgeMs(ud);
      
      if (this.v('numSwings') && ((durMs - this.delayMs) * 0.001 * this.v('swingHz') > this.v('numSwings')))
        return false;
      
      let { y } = this.getAbsVal(ud);
      if (this.v('spd') > 0 && y > bounds.total.t + 30) return false;
      if (this.v('spd') < 0 && y < bounds.total.b - 30) return false;
      
      return true;
    },
    
    render: function(ud, draw) {
      
      let { x, y } = this.getAbsVal(ud);
      let ext = this.constructor.bound.r * 2;
      draw.frame(() => {
        draw.trn(x, y);
        draw.rot((this.v('spd') < 0) ? Math.PI : 0);
        draw.imageCen(this.constructor.imageKeep, 0, 0, ext, ext);
      });
      
    }
    
  })});
  let Weaver = U.form({ name: 'Weaver', has: { Winder }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 34 }, $hp: 8,
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyWeaver.png' ]),
    
  })});
  let Furler = U.form({ name: 'Furler', has: { Winder, Spawner }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 24 }, $hp: 4,
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyFurler.png' ]),
    $render: (draw, ud, vals) => {
      Form.parents.Winder.render(draw, ud, { imageKeep: Form.imageKeep, ext: Form.bound.r << 1, ...vals });
    },
    
    getSpawnTypes: function() {
      return {
        shoot: { type: 'MBullet', vel: 150, ang: 0.5, dmg: 1, lsMs: 3000, bound: { form: 'rect', w: 3, h: 12 } }
      };
    },
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr)),
    syncProps: forms.allArr('syncProps', (i, arr) => [].gain(...arr)),
    doSpawn: function(ud, spawnType, state, props) {
      
      if (spawnType !== 'shoot')
        return forms.Spawner.doSpawn.call(this, ud, spawnType, state, props);
      
      let { x, y } = state;
      let b1 = ud.spawnEntity({ ...props, team: 'enemy', owner: this, ax: x - Form.bound.r * 0.55, ay: y });
      let b2 = ud.spawnEntity({ ...props, team: 'enemy', owner: this, ax: x + Form.bound.r * 0.55, ay: y });
      
    },
    getStepResult: function(ud) {
      
      forms.Spawner.getStepResult.call(this, ud);
      return forms.Winder.getStepResult.call(this, ud);
      
      /*
      let { aheadDist, ms } = ud;
      if (ms >= this.shootMark) {
        this.shootMark += this.shootDelayMs;
        let bulletOff = Form.bound.r * 0.5;
        let { x, y } = this.getRelVal(ud);
        ud.spawnEntity({
          type: 'SimpleBullet', ms, owner: this, x: x - bulletOff, y: y - ud.bounds.total.y,
          spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
          ...this.bulletArgs
        });
        ud.spawnEntity({
          type: 'SimpleBullet', ms, owner: this, x: x + bulletOff, y: y - ud.bounds.total.y,
          spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
          ...this.bulletArgs
        });
      }
      
      return forms.Winder.getStepResult.call(this, ud);
      */
    }
    
  })});
  let Drifter = U.form({ name: 'Drifter', has: { Enemy, Mover }, props: (forms, Form) => ({
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyDrifter.png' ]),
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { initHp=2, minSize=16, hpPerSec=1.33, sizeMult=1.75 } = val;
      return {}.gain(...arr, { initHp, minSize, hpPerSec, sizeMult, dist: null });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'initHp', 'hpDmg', 'minSize', 'hpPerSec', 'sizeMult' ].gain(...arr)),
    getRelVal: function(ud) {
      
      let { x, y } = forms.Mover.getRelVal.call(this, ud);
      let hpDmg = this.v('hpDmg');
      let sizeMult = this.v('sizeMult');
      let minSize = this.v('minSize');
      return { x, y, r: minSize + (this.getMaxHp(ud) - hpDmg) * sizeMult };
      
    },
    getMaxHp: function(ud) {
      return this.v('initHp') + this.v('hpPerSec') * this.getAgeMs(ud) * 0.001;
    },
    getStepResult: function(ud) {
      
      let { x, y, r } = this.getAbsVal(ud);
      return { tangibility: {
        bound: { form: 'circle', x, y, r },
        team: 'enemy',
        sides: [ 'head', 'tail' ]
      }};
      
    },
    isAlive: function(ud) {
      return true
        && forms.Enemy.isAlive.call(this, ud)
        && forms.Mover.isAlive.call(this, ud);
    },
    
    render: function(ud, draw) {
      let { x, y, r } = this.getAbsVal(ud);
      draw.frame(() => {
        draw.trn(x, y);
        draw.rot((this.v('ny') < 0) ? Math.PI : 0);
        draw.imageCen(this.constructor.imageKeep, 0, 0, r * 2, r * 2);
      });
    }
    
  })});
  let Wanderer = U.form({ name: 'Wanderer', has: { Enemy, Mover }, props: (forms, Form) => ({
    
    $bound: { form: 'circle', r: 22 }, $maxHp: 4.5,
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyWanderer.png' ]),
    $render: (draw, ud, { x, y, vy }) => {
      Form.parents.Enemy.render(draw, ud, { imageKeep: Form.imageKeep, x, y,
        w: Form.bound.r << 1,
        rot: (vy <= 0) ? Math.PI : 0
      });
    },
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { ud: { ms }, mode='steady', shootDelayMs=2500, shootDelayInitMs=shootDelayMs, bulletArgs={} } = val;
      return {}.gain(...arr, { mode, shootDelayMs, bulletArgs, shootMark: ms + shootDelayInitMs });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)),
    getMaxHp: function() { return Form.maxHp; },
    getStepResult: function(ud) {
      let { x, y } = this.getRelVal(ud);
      let { ms, spf } = ud;
      let birth = [];
      
      let shootCondition = (this.v('mode') === 'steady')
        ? (ms >= this.v('shootMark'))
        : (Math.random() < ((spf * 1000) / this.v('shootDelayMs')));
      
      if (shootCondition) {
        ud.spawnEntity({ type: 'SimpleBullet', ms, owner: this, x, y,
          spd: -380, dmg: 1, w: 8, h: 20,
          lsMs: 3000
        });
        this.v('shootDelayMs', v => v + this.delayMs);
      }
      
      return { tangibility: {
        bound: { ...Form.bound, x, y },
        team: 'enemy',
        sides: [ 'head', 'tail' ]
      }};
      
    },
    isAlive: forms.allArr('isAlive', (i, arr) => !arr.find(alive => !alive).found)
    
  })});
  let WinderMom = U.form({ name: 'WinderMom', has: { Enemy, Mover }, props: (forms, Form) => ({
    
    $bound: { form: 'rect', w: 160, h: 160 }, $maxHp: 90,
    
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyWinderMom.png' ]),
    $render: (draw, ud, { x, y }) => {
      Form.parents.Enemy.render(draw, ud, { imageKeep: Form.imageKeep, x, y,
        w: Form.bound.w, h: Form.bound.h
      });
    },
    
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr)), //C.noFn('initProps'),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)), //C.noFn('initSyncs'),
    getMaxHp: function() { return Form.maxHp; },
    ...forms.Enemy.slice('canCollide', 'collide'),
    getStepResult: function(ud) {
      
      let { ms } = ud;
      let { x, y } = this.getRelVal(ud);
      
      let birth = [];
      if (ms >= this.spawnMark) {
        
        let args = {
          ms, y: 0, spd: 70, swingHz: 0.22, swingAmt: 120,
          ...this.spawnArgs
        };
        args.y += this.y;
        if (Math.random() > 0.5) { args.x = this.x - 60; args.swingAmt *= -1; }
        else                     { args.x = this.x + 60; args.swingAmt *= +1; }
        
        birth.gain([ Winder(args) ]);
        
        this.spawnMark = ms + this.spawnMs;
        
      }
      
      return { tangibility: {
        bound: { ...Form.bound, x, y },
        team: 'enemy',
        sides: [ 'head', 'tail' ]
      }};
      
    },
    isAlive: function(ud) {
      return true
        && forms.Enemy.isAlive.call(this, ud)
        && forms.Mover.isAlive.call(this, ud);
    }
    
  })});
  let WandererMom = U.form({ name: 'WandererMom', has: { Enemy, Mover }, props: (forms, Form) => ({
    
    $bound: { form: 'rect', w: 150, h: 210 },
    $maxHp: 90, $numBullets: 7, $bulletSpd: 330,
    $imageKeep: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'enemyWandererMom.png' ]),
    $render: (draw, ud, { x, y }) => {
      Form.parents.Enemy.render(draw, ud, { imageKeep: Form.imageKeep, x, y,
        w: Form.bound.w, h: Form.bound.h
      });
    },
    
    initProps: forms.allArr('initProps', (i, arr) => ({}).gain(...arr)), //C.noFn('initProps'),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [].gain(...arr)), //C.noFn('initSyncs'),
    getMaxHp: function() { return Form.maxHp; },
    ...forms.Enemy.slice('canCollide', 'collide'),
    updateAndGetResult: function(ud) {
      
      let { aheadDist, ms, spf } = ud;
      let birth = [];
      
      // Try to spawn a Wanderer
      if (ms >= this.spawnMark) {
        
        let args = {
          tx: 0, ty: 1,
          ms, x: this.x, y: this.y, spd: 70, mode: 'random',
          ...this.spawnArgs
        };
        args.tx += this.x;
        args.ty += this.y;
        
        birth.gain([ Wanderer(args) ]);
        
        this.spawnMark = ms + this.spawnMs;
        
      }
      
      // Try to shoot `Form.numBullets` bullets
      if (Math.random() < ((spf * 1000) / this.shootDelayMs)) {
        
        let bulletArgs = { aheadDist, ms, owner: this, x: this.x, y: this.y, vel: Form.bulletSpd, dmg: 1, r: 8 };
        birth.gain(Form.numBullets.toArr(() => MBullet({
          ...bulletArgs, ang: 0.5 + ((Math.random() - 0.5) * 2 * 0.05), lsMs: 3000
        })));
        
      }
      
      return { x: this.x, y: this.y, ...Form.bound, birth };
      
    },
    isAlive: function(ud) {
      return true
        && forms.Enemy.isAlive.call(this, ud)
        && forms.Mover.isAlive.call(this, ud);
    }
    
  })});
  
  // LEVEL
  let Level = U.form({ name: 'Level', has: { Entity }, props: (forms, Form) => ({
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      
      let { levelDef=null } = val;
      let momentsDef = (levelDef ? levelDef.moments : []).toArr(v => v);
      
      let { ud: { ms }, flyHut, lives=5, outcome='none', aheadSpd=0, x=0, y=0 } = val;
      let { tw=280, th=350, px=0, py=0, pw=280, ph=350, visiMult=1 } = val;
      
      return {}.gain(...arr, {
        flyHut,
        momentsDef,
        currentMoment: null, resolveTimeout: null,
        outcome,
        lives, aheadSpd, x, y, tw, th, px, py, pw, ph, visiMult 
      });
      
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'lives', 'aheadSpd', 'x', 'y', 'tw', 'th', 'px', 'py', 'pw', 'ph', 'visiMult', 'outcome' ].gain(...arr)),
    
    getBounds: function(ud) {
      
      // Total bound values
      let x = this.v('x');
      let y = this.v('y');
      let px = this.v('px');
      let py = this.v('py');
      let pw = this.v('pw');
      let ph = this.v('ph');
      let tw = this.v('tw');
      let th = this.v('th');
      let thw = tw * 0.5; let tl = x - thw; let tr = x + thw;
      let thh = th * 0.5; let tb = y - thh; let tt = y + thh;
      
      // Player bound values
      px += x; py += y;
      let phw = pw * 0.5; let pl = px - phw; let pr = px + phw;
      let phh = ph * 0.5; let pb = py - phh; let pt = py + phh;
      
      return {
        total: { form: 'rect',
          x, y, w: tw, h: th,
          l: tl, r: tr, b: tb, t: tt
        },
        player: { form: 'rect',
          x: px, y: py, w: pw, h: ph,
          l: pl, r: pr, b: pb, t: pt
        }
      };
      
    },
    getAceSpawnLoc: function(ud) {
      let { total: { y: ty }, player: { y: py, w, h } } = this.getBounds(ud);
      return { x: (Math.random() * w * 0.6) - w * 0.3, y: (py - ty) - h * 0.25 };
    },
    getRelVal: function(ud) { return { x: this.v('x'), y: this.v('y') }; },
    getParent: function(ud) { return null; },
    update: function(ms, spf) {
      
      /// {ABOVE=
      
      let timingMs = foundation.getMs();
      
      // TODO: Do we need this snapshot AND `updateData.entities`? Just use `updateData.entities` in place of this snapshot???
      let entities = [ ...this.relRecs('fly.entity') ]; // A snapshot
      let levelPlayers = this.relRecs('fly.levelPlayer');
      let flyHut = this.v('flyHut');
      
      let updateData = {
        ms, spf,
        level: this,
        entities: entities.toObj(rec => [ rec.uid, rec ]),
        bounds: null,
        outcome: this.v('outcome'),
        spawnEntity: vals => flyHut.createRec('fly.entity', [ this ], { ...vals, ud: updateData })
      };
      let bounds = updateData.bounds = this.getBounds(updateData);
      let ud = updateData;
      
      // Step 1: Update all Entities (tracking collidables and births)
      let collideTeams = {};
      for (let ent of entities) {
        
        // Allow the Model to update
        let stepResult = ent.getStepResult(ud);
        
        if (!stepResult.has('tangibility')) throw Error(`${U.getFormName(ent)} missing "tangibility"`);
        if (!stepResult.tangibility.has('bound')) throw Error(`${U.getFormName(ent)} missing "tangibility.bound"`);
        if (!stepResult.tangibility.has('team')) throw Error(`${U.getFormName(ent)} missing "tangibility.team"`);
        if (!stepResult.tangibility.has('sides')) throw Error(`${U.getFormName(ent)} missing "tangibility.sides"`);
        
        /// stepResult ~= {
        ///   // events: [
        ///   //   { type: 'birth', birth: { type: 'Winder', x: 0, y: +100, swingHz: 0.01, swingAmt: +200 } },
        ///   //   { type: 'birth', birth: { type: 'Winder', x: 0, y: +100, swingHz: 0.01, swingAmt: -200 } }
        ///   // ],
        ///   tangibility: {
        ///     bound: { form: 'circle', x: 0, y: 0, r: 16 },
        ///     team: 'ace',
        ///     sides: [ 'head', 'tail' ],
        ///   }
        /// }
        
        // Manage sprite visibility
        let isBounded = !!stepResult.tangibility.bound;
        let visible = isBounded && geom.doCollideRect(bounds.total, geom.containingRect(stepResult.tangibility.bound));
        if (visible && !ent.sprite) {
          ent.sprite = flyHut.createRec('fly.sprite', [ this, ent ], 'visible');
        } else if (!visible && ent.sprite) {
          ent.sprite.end();
          ent.sprite = null;
        }
        
        // Track this Model
        if (isBounded && stepResult.tangibility.sides.length > 0) {
          let team = stepResult.tangibility.team;
          if (!collideTeams.has(team)) collideTeams[team] = { head: [], tail: [] };
          let coll = { ent, stepResult };
          for (let side of stepResult.tangibility.sides) collideTeams[team][side].push(coll);
        }
        
      }
      
      // Step 2: Collide all Teams against each other
      let tryCollide = (ud, headCd, tailCd) => {
        if (!headCd.ent.isAlive(ud) || !tailCd.ent.isAlive(ud)) return;
        
        let bound1 = headCd.stepResult.tangibility.bound;
        let bound2 = tailCd.stepResult.tangibility.bound;
        if (!geom.doCollide(headCd.stepResult.tangibility.bound, tailCd.stepResult.tangibility.bound)) return;
        headCd.ent.getCollideResult(ud, tailCd.ent);
        
      };
      collideTeams = collideTeams.toArr(v => v);
      let len = collideTeams.length;
      for (let i = 0; i < len - 1; i++) { for (let j = i + 1; j < len; j++) {
        
        let team1 = collideTeams[i]; let team2 = collideTeams[j];
        for (let head of team1.head) for (let tail of team2.tail) tryCollide(ud, head, tail);
        for (let head of team2.head) for (let tail of team1.tail) tryCollide(ud, head, tail);
        
      }}
      
      for (let entity of entities) {
        if (!entity.isAlive(ud)) entity.getDieResult(ud);
      }
      
      // Step 4: Check for initial loss frame (`!this.resolveTimeout`)
      if (this.v('outcome') === 'lose' && !this.v('resolveTimeout')) {
        
        // Update LevelPlayers with the stats from their Models
        for (let gp of levelPlayers) {
          for (let gpe of gp.relRecs('fly.levelPlayerEntity')) {
            let ent = gpe.mems['fly.entity'];
            if (ent.isAlive(ud)) rep.v('hpDmg', 1); // Kill remaining Aces
            gp.mems['fly.player'].modVal(v => (v.score = ent.v('scoreDamage'), v.deaths = ent.v('scoreDeath'), v));
          }
        }
        
        this.v('resolveTimeout', setTimeout(() => this.end(), 2500));
        
      }
      
      // Step 6: Advance as many Moments as possible (some may instantly cease standing)
      let currentMoment = this.v('currentMoment');
      let momentsDef = this.v('momentsDef');
      while (momentsDef.length && (!currentMoment || !currentMoment.isStanding(ud))) {
        
        let nextMomentDef = momentsDef.shift();
        let newMoment = ud.spawnEntity({ ...nextMomentDef, prevMoment: currentMoment });
        console.log(`Began moment: ${nextMomentDef.name} (${U.getFormName(newMoment)})`);
        
        // Apply global effects and update bounds
        newMoment.applyLevelEffects(this);
        bounds.gain(this.getBounds(ud));
        
        // Allow the new Moment to setup under the new global settings
        // Note we pass the previous Moment
        newMoment.doSetup(ud, currentMoment);
        
        // Consider this new moment the CurrentMoment
        currentMoment = newMoment;
        
      }
      
      // Step 7: Check victory condition; no Moments remaining
      if (this.v('outcome') === 'none' && !this.v('resolveTimeout') && (!currentMoment || !currentMoment.isStanding(ud))) {
        
        // Set up a Moment to fill in terrain as the victory occurs
        let newMoment = ud.spawnEntity({
          type: 'MomentAhead',
          name: 'outcomeWin', terrain: currentMoment && currentMoment.v('terrain'),
          dist: 10000, spd: (currentMoment ? currentMoment.spd : 100) * 2,
          models: [],
          prevMoment: currentMoment
        });
        
        newMoment.applyLevelEffects(this);
        bounds.gain(this.getBounds(ud));
        
        newMoment.doSetup(ud, currentMoment);
        
        currentMoment = newMoment;
        
        // Mark that victory has occurred
        this.v('outcome', 'win');
        this.v('resolveTimeout', setTimeout(() => {
          
          // Transfer Model stats to fly.player Records
          for (let gp of levelPlayers) {
            for (let gpe of gp.relRecs('fly.levelPlayerEntity')) {
              let ent = gpe.mems['fly.entity'];
              gp.mems['fly.player'].modVal(v => (v.score = ent.v('scoreDamage'), v.deaths = ent.v('scoreDeath'), v));
            }
          }
          
          // Update the Lobby taking this win into account
          this.mems['fly.lobby'].modVal(v => {
            v.level.dispName = `${v.level.dispName} - COMPLETE`;
            v.level.dispDesc = levels[v.level.name].winText;
            return v;
          });
          
          // Dry the fly.level Record
          this.end();
          
        }, 3000));
        
      }
      
      if (currentMoment !== this.v('currentMoment')) this.v('currentMoment', currentMoment);
      
      // Step 8: Do global updates; e.g., the Level advances
      this.v('ms', ms);
      this.v('y', y => y + this.v('aheadSpd') * spf);
      
      if (Math.random() < 0.001) {
        console.log(`Processed ${entities.length} entities in ${foundation.getMs() - timingMs}ms:`);
        let types = Map();
        for (let entity of entities) {
          let t = U.getFormName(entity);
          types.set(t, (types.get(t) || 0) + 1);
        }
        for (let [ t, n ] of types) console.log(`    ${n.toString().padHead(3, ' ')} x ${t}`);
      }
      
      /// =ABOVE}
      
    }
  })});
  let Moment = U.form({ name: 'Moment', has: { Entity }, props: (forms, Form) => ({
    
    $imageKeeps: {
      meadow: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'bgMeadow.png' ]),
      meadowToPlains: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'bgMeadowToPlains.png' ]),
      plains: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'bgPlains.png' ]),
      plainsToMeadow: foundation.seek('keep', 'static', [ 'room', 'fly', 'resource', 'bgPlainsToMeadow.png' ])
    },
    $tileExt: 250,
    $renderPriority: () => 1,
    $render: (draw, ud, { type, bounds, minY, maxY, terrain }) => {
      
      if (!terrain) return;
      
      let tExt = Form.tileExt;
      let imgKeep = Form.imageKeeps[terrain];
      if (!imgKeep) throw Error(`Invalid terrain: ${terrain}`);
      
      let endMaxY = Math.min(maxY, bounds.total.t);
      
      let y = (minY > bounds.total.b)
        // Bottom of this Moment is visible; simply start from it!
        ? minY
        // Bottom of the Moment is cut off; subtract the cut amount
        : (bounds.total.b - ((bounds.total.b - minY) % Form.tileExt));
      
      // If y lands right on `endMaxY` (before accounting for rounding
      // errors) stop drawing - favour `endMaxY` avoids cut-off pixels
      let x;
      while (y < (endMaxY - 0.0001)) {
        
        x = 0;
        while (x > bounds.total.l) { draw.image(imgKeep, x - tExt, y, tExt, tExt); x -= tExt; }
        x = 0;
        while (x < bounds.total.r) { draw.image(imgKeep, x, y, tExt, tExt); x += tExt; }
        y += tExt;
        
      }
      
    },
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { name, models=[], terrain=null, bounds=null, aheadSpd=100, visiMult=1 } = val;
      return {}.gain(...arr, { name, models, terrain, bounds, aheadSpd, visiMult });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'name', 'terrain' ].gain(...arr)),
    getMinY: C.noFn('getMinY'),
    getMaxY: C.noFn('getMaxY'),
    getParent: function(ud) { return null; },
    getRelVal: function(ud) {
      let minY = this.getMinY(ud);
      let maxY = this.getMaxY(ud);
      return {
        x: 0, y: (minY + maxY) * 0.5,
        w: ud.bounds.total.w, h: maxY - minY
      };
    },
    applyLevelEffects: function(level) {
      
      // TODO: Really should transition from previous bounds to new
      // ones. Right now the Ace could be sitting in some previous
      // Moment, when the new one shows its first lowest pixels. That
      // means that the Ace immediately snaps into the new bounds -
      // very janky!
      
      if (this.v('bounds')) {
        let { total, player } = this.v('bounds');
        level.modVal(v => v.gain({
          tw: total.w, th: total.h,
          px: player.x, py: player.y, pw: player.w, ph: player.h,
        }));
      }
      
      if (this.v('aheadSpd') !== null) level.modVal(v => v.gain({ aheadSpd: this.v('aheadSpd') }));
      if (this.v('visiMult') !== null) level.modVal(v => v.gain({ visiMult: this.v('visiMult') }));
      
    },
    doSetup: function(ud, prevMoment) {
      
      // Y-coordinate is relative to the top of the screen!
      let relY = ud.bounds.total.h * 0.5;
      for (let modelDef of this.models) {
        // Make the "y" property relative to the Moment's bottom
        ud.spawnEntity({ ud: ud, ...modelDef, y: relY + modelDef.y });
      }
      
    },
    getStepResult: function(ud) {
      let { x, y, w, h } = this.getAbsVal(ud);
      return {
        tangibility: {
          bound: { form: 'rect', x, y, w, h },
          team: null,
          sides: []
        }
      };
    },
    isStanding: C.noFn('isStanding'),
    isAlive: C.noFn('isAlive'),
    
    renderPriority: function() { return 1; },
    render: function(ud, draw) {
      
      let terrain = this.v('terrain');
      let minY = this.getMinY(ud);
      let maxY = this.getMaxY(ud);
      let tb = ud.bounds.total;
      
      if (!terrain) return;
      
      let tExt = Form.tileExt;
      let imgKeep = Form.imageKeeps[terrain];
      if (!imgKeep) throw Error(`Invalid terrain: ${terrain}`);
      
      let endMaxY = Math.min(maxY, tb.t);
      let y = (minY > tb.b)
        // Bottom of this Moment is visible; simply start from it!
        ? minY
        // Bottom of the Moment is cut off; subtract the cut amount
        : (tb.b - ((tb.b - minY) % Form.tileExt));
      
      // If y lands right on `endMaxY` (before accounting for rounding
      // errors) stop drawing - favour `endMaxY` avoids cut-off pixels
      let x;
      while (y < (endMaxY - 0.0001)) {
        
        x = 0;
        while (x > tb.l) { draw.image(imgKeep, x - tExt, y, tExt, tExt); x -= tExt; }
        x = 0;
        while (x < tb.r) { draw.image(imgKeep, x, y, tExt, tExt); x += tExt; }
        y += tExt;
        
      }
      
    }
    
  })});
  let MomentAhead = U.form({ name: 'MomentAhead', has: { Moment }, props: (forms, Form) => ({
    
    $render: Form.parents.Moment.render,
    $renderPriority: Form.parents.Moment.renderPriority,
    
    initProps: forms.allArr('initProps', (i, arr, val) => {
      let { ud, name, bounds, dist, prevMoment=null, startY=null } = val;
      if (startY === null) {
        startY = prevMoment ? prevMoment.getMaxY(ud) : (bounds.total.h * -0.5);
        //prevMoment ? prevMoment.getMaxY(ud) : ud.bounds.total.b
      }
      return {}.gain(...arr, { dist, startY });
    }),
    initSyncs: forms.allArr('initSyncs', (i, arr) => [ 'dist', 'startY' ].gain(...arr)),
    getMinY: function() { return this.v('startY'); },
    getMaxY: function() { return this.v('startY') + this.v('dist'); },
    isStanding: function(ud) {
      // A MomentAhead stands while its top hasn't become visible
      return this.getMaxY(ud) > ud.bounds.total.t;
    },
    isAlive: function(ud) {
      // A MomentAhead lives while its top hasn't been passed entirely
      // TODO: Keep MomentAhead instances alive for an additional 500
      // units??
      return (this.getMaxY(ud) + 500) > ud.bounds.total.b;
    }
    
  })});
  let MomentTargetType = U.form({ name: 'MomentTargetType', has: { Moment }, props: (forms, Form) => ({
    
  })});
  
  // Ground buildings with 1-ups (need to slow down aheadSpd for this, or else they move toooo fast??)
  // Move whatever possible from MomentAhead into Moment, then fill out MomentTargetType
  
  return {
    JoustMan, JoustManBullet, JoustManLaserSphere, JoustManLaserVert, JoustManLaserHorz, JoustManLaserJoust,
    GunGirl,
    SlamKid, SlamKidSlammer,
    SalvoLad, SalvoLadDumbBomb, SalvoLadKaboom, SalvoLadMissile,
    Winder, Weaver, Furler, WinderMom, WandererMom, Drifter, Wanderer,
    MBullet,
    Level,
    Moment,
    MomentAhead
  };
  
};
