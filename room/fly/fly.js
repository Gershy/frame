U.buildRoom({
  name: 'fly',
  innerRooms: [ 'record', 'hinterlands', 'real', 'realWebApp', 'term' ],
  build: (foundation, record, hinterlands, real, realWebApp, term) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, CondNozz, Scope, defDrier } = U.water;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    let { FixedSize, FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, AxisSlotter, TextSized, Art } = real;
    let { UnitPx, UnitPc } = real;
    let { WebApp } = realWebApp;
    
    let cnst = {
      offscreenDist: 500,
      distToConsiderEnemyClear: 700
    };
    let util = {
      fadeAmt: (v1, v2, amt) => v1 * (1 - amt) + v2 * amt,
      fadeVal: (init, amt=0.5) => {
        let fv = {
          val: init,
          to: trg => fv.val = util.fadeAmt(fv.val, trg, amt)
        };
        return fv;
      }
    };
    
    let fps = 40;       // Server-side ticks per second
    let spf = 1 / fps;  // Seconds per server-side tick
    let gameStartingDelay = 1000; // Give players this long to unready
    let initialAheadSpd = 100;
    let testLevel = null; //'desperation1'; // 'drifters1' / 'wanderers1'
    let badN = (...vals) => vals.find(v => !U.isType(v, Number) || isNaN(v));
    
    // BASE STUFF
    let Entity = U.inspire({ name: 'Entity', insps: {}, methods: (insp, Insp) => ({
      init: function({ ms=foundation.getMs() }={}) {
        this.ms = ms;
      },
      isAlive: function() { return true; },
      canCollide: C.noFn('canCollide'),
      collide: C.noFn('collide'),
      // canCollide: function() { return false; },
      // collide: function(rep) {},
      
      // Get the state in various ways. The "perm" state may never ever
      // change for an Entity. The "norm" state may change now and then.
      // The "flux" state may change constantly.
      permState: function() { return { type: U.nameOf(this), ms: this.ms }; },
      normState: function() { return {}; },
      fluxState: function() { return {}; },
      updateAndGetResult: C.noFn('updateAndGetResult'),
      dieAndGetResult: function() { return { birth: [] }; }
    })});
    let Mortal = U.inspire({ name: 'Mortal', insps: {}, methods: (insp, Insp) => ({
      init: function({ hp=1 }) { this.hp = this.getMaxHp(); },
      getMaxHp: function() { return 1; },
      damageFrom: function(rep, amt) { this.hp -= amt; },
      isAlive: function() { return this.hp > 0; }
    })});
    let Geom = U.inspire({ name: 'Geom', insps: { Entity }, methods: (insp, Insp) => ({
      init: function({ x=0, y=0, ...args }) {
        insp.Entity.init.call(this, args);
        this.x = x; this.y = y;
      },
      
      // TODO: Not everything has "x" and "y" in the flux state
      fluxState: function() { return { x: this.x, y: this.y }; }
    })});
    let Mover = U.inspire({ name: 'Mover', methods: (insp, Insp) => ({
      init: function({ tx, ty, spd=100, relDist=0, ang, dist, ...args }) {
        if (!({}).has.call(this, 'x')) throw Error(`${U.nameOf(this)} inherits Mover, but doesn't initialize an "x" property`);
        if (!({}).has.call(this, 'y')) throw Error(`${U.nameOf(this)} inherits Mover, but doesn't initialize an "x" property`);
        
        this.tx = this.ty = null;
        this.vx = this.vy = null;
        this.spd = null;
        this.ang = null;
        this.setDestination({ relDist, spd, tx, ty, ang, dist });
      },
      setDestination: function({ relDist=0, spd=null, tx=null, ty=null, ang=null, dist=null }) {
        
        // Providing x and y with an optional `relDist` sets the
        // destination through that point (and optionally stopping at
        // that point)
        // Providing a angation and optional distance sets the
        // destination at the angle relative to the current position
        
        if (ang !== null && (tx !== null || ty !== null))
          throw Error(`Specify either "ang", or "tx" and "ty"`);
        
        // Update speed if necessary
        if (spd !== null) this.spd = spd;
        
        if (tx !== null) {
          
          let dx = (tx - this.x);
          let dy = ((ty + (this.moveWithGame() ? relDist : 0)) - this.y);
          
          let tSpd = this.spd / Math.sqrt(dx * dx + dy * dy);
          this.tx = tx; this.ty = ty;
          this.vx = dx * tSpd; this.vy = dy * tSpd;
          this.ang = Math.atan2(dx, dy) / (Math.PI * 2);
          
        } else if (ang !== null) {
          
          if (dist === null) dist = 1;
          
          let r = ang * Math.PI * 2;
          let sin = Math.sin(r);
          let cos = Math.cos(r);
          
          this.ang = ang;
          this.tx = this.x + sin * dist;
          this.ty = this.y + cos * dist;
          this.vx = this.spd * sin;
          this.vy = this.spd * cos;
          
        } else {
          
          throw Error(`Specify either "x" and "y", or "ang"`);
          
        }
        
      },
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return false; },
      moveToDestination: function(game) {
        
        this.x += this.vx * spf;
        this.y += (this.vy + (this.moveWithGame() ? game.val.aheadSpd : 0)) * spf;
        
        let tx = this.tx;
        let ty = this.ty + (this.moveWithGame() ? game.val.dist : 0);
        
        if (this.stopAtDestination()) {
          if (this.vx > 0 && this.x > tx) this.x = tx;
          if (this.vx < 0 && this.x < tx) this.x = tx;
          if (this.vy > 0 && this.y > ty) this.y = ty;
          if (this.vy < 0 && this.y < ty) this.y = ty;
        }
        
      },
      isAlive: function(ms, game) {
        if (!this.stopAtDestination()) {
          let x = this.x;
          let y = this.y - (this.moveWithGame() ? game.val.dist : 0);
          
          if (this.vx > 0 && x > +700) return false;
          if (this.vx < 0 && x < -700) return false;
          if (this.vy > 0 && y > +900) return false;
          if (this.vy < 0 && y < -900) return false;
        }
        
        return true;
      }
    })});
    
    // UTIL
    let Bullet = U.inspire({ name: 'Bullet', methods: (insp, Insp) => ({
      
      $getColour: team => {
        if (team === -1) return 'rgba(0, 135, 45, 0.88)';
        if (team === +1) return 'rgba(230, 85, 0, 0.8)';
        return '#000000';
      },
      
      init: function({ owner, dmg=1, pDmg=[0,0] }) {
        this.owner = owner;
        this.dmg = dmg;
        this.pDmg = pDmg;
      },
      getTeam: function() { return this.owner.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return false;
        let dmg = this.dmg;
        if (this.pDmg[0]) dmg += Math.min(this.pDmg[0] * rep.getMaxHp(), this.pDmg[1] || rep.getMaxHp());
        dmg = Math.min(dmg, rep.hp);
        rep.hp -= dmg;
        this.owner.scoreDamage += dmg;
        return true;
      }
      
    })});
    let SimpleBullet = U.inspire({ name: 'SimpleBullet', insps: { Geom, Bullet }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, w, h, team }) => {
        draw.rectCen(x, y, w, h, { fillStyle: Insp.parents.Bullet.getColour(team) });
      },
      
      init: function({ x, y, spd=700, w=4, h=50, lifespanMs=3000, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Bullet.init.call(this, args);
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        this.spd = spd;
        this.lifespanMs = lifespanMs;
      },
      collide: function(rep) {
        if (insp.Bullet.collide.call(this, rep)) this.lifespanMs = 0;
      },
      permState: function() { return { ...insp.Geom.permState.call(this), team: this.getTeam(), w: this.w, h: this.h }; },
      updateAndGetResult: function(ms, game, entity) {
        this.y += (game.val.aheadSpd + this.spd) * spf;
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: function(ms) { return (ms - this.ms) < this.lifespanMs; }
      
    })});
    let DirectedBullet = U.inspire({ name: 'DirectedBullet', insps: { Geom, Mover, Bullet }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, r, team }) => {
        draw.circ(x, y, r, { fillStyle: Insp.parents.Bullet.getColour(team) });
      },
      init: function({ r=8, lifespanMs=3000, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Mover.init.call(this, { spd: 500, ...args });
        insp.Bullet.init.call(this, args);
        this.r = r;
        this.lifespanMs = lifespanMs;
      },
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return false; },
      canCollide: function() { return true; },
      collide: function(rep) { if (insp.Bullet.collide.call(this, rep)) this.lifespanMs = 0; },
      permState: function() { return { ...insp.Geom.permState.call(this), team: this.getTeam(), r: this.r }; },
      updateAndGetResult: function(ms, game, entity) {
        insp.Mover.moveToDestination.call(this, game);
        return { x: this.x, y: this.y, form: 'circle', r: this.r, birth: [] };
      },
      isAlive: function(ms) { return (ms - this.ms) < this.lifespanMs; }
      
    })});
    
    // GOOD GUYS
    let Ace = U.inspire({ name: 'Ace', insps: { Geom, Mortal }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 8 }, $respawnMs: 2000, $invulnMs: 1500, $spd: 180,
      //TEST::$respawnMs: 200,
      $render: (draw, game, { x, y, invulnMark }, imageKeep=null, fn) => {
        let size = Insp.bound.r << 1;
        
        if (game.val.ms < invulnMark) {
          draw.circ(x, y, size * 5,   { fillStyle: 'rgba(255, 255, 255, 0.3)' });
          draw.circ(x, y, size * 1.6, { fillStyle: 'rgba(255, 255, 255, 0.7)' });
          if (imageKeep) draw.image(imageKeep, x, y, size, size, 0.25);
        } else {
          draw.circ(x, y, size * 1.6, { fillStyle: 'rgba(250, 170, 170, 0.25)' });
          if (imageKeep) draw.image(imageKeep, x, y, size, size);
        }
        
        if (fn) fn();
      },
      
      init: function(args) {
        insp.Geom.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.name = args.name;
        this.spd = Insp.spd;
        this.slowMarks = Set();
        this.effects = Set();
        this.invulnMark = this.ms + Insp.invulnMs;
        this.scoreDamage = 0;
        this.scoreDeaths = 0;
      },
      canCollide: function(ms) { return ms >= this.invulnMark; },
      collide: function(rep) {},
      getTeam: function() { return +1; },
      normState: function() { return { invulnMark: this.invulnMark }; },
      updateAndGetResult: function(ms, game, entity, spdMult=1) {
        
        if (game.victory) {
          if (ms >= this.invulnMark) this.invulnMark = ms + 1000;
          this.y += (game.val.aheadSpd + Insp.spd * 4) * spf;
          return { x: this.x, y: this.y, ...Insp.bound, birth: [] };
        }
        
        // The calculated speed for this tick
        let spd = this.spd * spdMult;
        let spdXMult = 1;
        let spdYMult = 1;
        let birth = [];
        
        for (let slowMark of this.slowMarks) {
          if (ms >= slowMark.mark) this.slowMarks.rem(slowMark);
          else                    spd *= slowMark.amt;
        }
        
        for (let effect of this.effects) {
          let { mark, type=null, fn=null, endFn=null } = effect;
          if (ms > effect.mark) {
            this.effects.rem(effect);
            if (effect.endFn) effect.endFn(ms, { birth });
          } else {
            if (effect.type === 'spdMult') spd *= effect.spdMult;
            if (effect.type === 'spdXMult') spdXMult *= effect.spdXMult;
            if (effect.type === 'spdYMult') spdYMult *= effect.spdYMult;
            if (effect.fn) effect.fn(ms, { birth });
          }
        }
        
        let { x: cx, y: cy, a1, a2 } = entity.controls;
        cx *= spdXMult;
        cy *= spdYMult;
        
        let vx, vy;
        if (cx && cy) spd /= Math.sqrt(cx * cx + cy * cy);
        vx = cx * spd;
        vy = cy * spd;
        
        vy += game.val.aheadSpd;
        if (vx || vy) { this.x += vx * spf; this.y += vy * spf; }
        
        let minX = -386; let maxX = +386;
        let minY = -480; let maxY = + 220;
        if (this.x < minX) this.x = minX;
        if (this.x > maxX) this.x = maxX;
        if (this.y < game.val.dist + minY) this.y = game.val.dist + minY;
        if (this.y > game.val.dist + maxY) this.y = game.val.dist + maxY;
        
        return { x: this.x, y: this.y, ...Insp.bound, birth };
        
      },
      isAlive: insp.Mortal.isAlive
      
    })});
    let JoustMan = U.inspire({ name: 'JoustMan', insps: { Ace }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceJoust' }),
      $render: (draw, game, args) => {
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep, () => {
          let { x, y, w1Mark, w1State, w2Mark } = args;
          
          // Laser reload
          let bar1H = w1Mark ? Math.min(1, (game.val.ms - w1Mark) / Insp.w1Charge3Ms) * 20 : 0;
          let [ bar1W, col ] = [
            [ 16, 'rgba(255, 0, 0, 1)' ],      // Punished
            [ 12, 'rgba(0, 0, 0, 0.75)' ],     // Reload
            [ 6,  'rgba(0, 255, 255, 0.7)' ],  // Horz laser
            [ 10, 'rgba(100, 255, 255, 0.8)' ] // Vert laser
          ][w1State];
          draw.rect(x + bar1W * -0.5, y - 8, bar1W, bar1H, { fillStyle: col });
          
          // Flash reload
          let msRemaining = w2Mark - game.val.ms;
          let bar2W = (msRemaining > 0)
            ? Math.max(0, Math.min(1, (Insp.w2Delay - msRemaining) / Insp.w2Delay))
            : 1;
          draw.rectCen(x, y - 12, bar2W * 16, 4, { fillStyle: `rgba(0, 0, 255, ${msRemaining > 0 ? 0.4 : 1})` });
          
        });
      },
      
      $w1ChargePunishSlow: 0.4, $w1ChargePunishMs: 2000,
      $w1Charge1Ms: 660, $w1Charge2Ms: 1600, $w1Charge3Ms: 4800, // How many millis of charging for various jousts
      $w1Charge3Slow: 0.58,
      $w2Delay: 2500, $w2DashSpeed: 500, $w2OrbDps: 25, $w2DurationMs: 300,
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        this.w1Mark = null; // Marks when charging began
        this.w1State = 0;   // Integer indicating current stage
        this.w2Mark = this.ms; // Marks when next jump is available
      },
      normState: function() { return {
        ...insp.Ace.normState.call(this),
        w1Mark: this.w1Mark, w1State: this.w1State, w2Mark: this.w2Mark
      };},
      updateAndGetResult: function(ms, game, entity) {
        
        if (game.victory) return insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        let birth = [];
        
        // Activate weapon 1
        if (entity.controls.a1) {
          
          if (!this.w1Mark) this.w1Mark = ms;
          
          let duration = ms - this.w1Mark;
          if (duration > Insp.w1Charge3Ms)      this.w1State = 3;
          else if (duration > Insp.w1Charge2Ms) this.w1State = 2;
          else if (duration > Insp.w1Charge1Ms) this.w1State = 1;
          else                                  this.w1State = 0;
          
        } else {
          
          if (this.w1Mark) {
            
            // Activate the charged ability!!
            if (this.w1State === 0) {
              
              // JoustMan is punished for holding for too short a time
              this.slowMarks.add({ mark: ms + Insp.w1ChargePunishMs, amt: Insp.w1ChargePunishSlow });
              
            } else if (this.w1State === 1) {
              
              // Weapon 1 act 1: Spread shot
              
              let incAng = 0.018;
              let orbArgs = { ms, owner: this, x: this.x, y: this.y, spd: 500, dmg: 1, r: 6 };
              birth.gain(Array.fill(10, n => JoustManOrb({
                ...orbArgs,
                ang: (n * incAng) - (5 * incAng) + (0.5 * incAng),
                lifespanMs: 620,
                dmg: 0.75
              })));
              this.slowMarks.add({ mark: ms + 500, amt: 0.5 });
              
            } else if (this.w1State === 2) {
              
              // Weapon 1 act 2: Spheres
              birth.gain([
                JoustManLaserSphere({ ms, joustMan: this, xOff: -66, yOff: +12, durationMs: 1400, dps: 15, r: 26 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: +66, yOff: +12, durationMs: 1400, dps: 15, r: 26 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: +24, yOff: -27, durationMs: 1400, dps: 11, r: 18 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: -24, yOff: -27, durationMs: 1400, dps: 11, r: 18 })
              ]);
              this.slowMarks.add({ mark: ms + 1150, amt: 1.3 });
              
            } else if (this.w1State === 3) {
              
              // Weapon 1 act 3: BIG LASER
              birth.gain([ JoustManLaserVert({ ms, joustMan: this }) ]);
              this.slowMarks.add({ mark: ms + JoustManLaserVert.durationMs, amt: Insp.w1Charge3Slow });
              
            }
            
            this.w1State = 0;
            this.w1Mark = 0;
            
          }
          
        }
        
        // Activate weapon 2
        if (entity.controls.a2 /*&& this.w2Ammo > 0*/ && entity.controls.x && (!this.w2Mark || ms > this.w2Mark)) {
          
          this.w2Mark = ms + Insp.w2Delay;
          
          let dir = entity.controls.x > 0 ? +1 : -1;
          this.invulnMark = Math.max(this.invulnMark, ms + 250);
          this.effects.add({ mark: ms + 250, fn: () => this.x += dir * Insp.w2DashSpeed * spf });
          this.effects.add({ mark: ms + 250, type: 'spdMult', spdMult: 0 });
          
          birth.gain(Array.fill(4, n => JoustManLaserSphere({
            ms, joustMan: this, xOff: -dir * (n + 1) * 30, yOff: 0, durationMs: Insp.w2DurationMs, dps: Insp.w2OrbDps, r: 9
          })));
          
          birth.gain([ JoustManLaserSphere({ ms, joustMan: this, xOff: 0, yOff: 0, durationMs: Insp.w2DurationMs, dps: Insp.w2OrbDps, r: 20 }) ]);
          
        }
        
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        supResult.birth.gain(birth);
        return supResult;
        
      }
      
    })});
    let GunGirl = U.inspire({ name: 'GunGirl', insps: { Ace }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceGun' }),
      $render: (draw, game, args) => {
        
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep, () => {
          let { x, y, w2ReadyMark } = args;
          let w2MsRemaining = w2ReadyMark - game.val.ms;
          let barW = Math.min(1, (Insp.w2Delay - w2MsRemaining) / Insp.w2Delay) * 16;
          draw.rectCen(x, y - 12, barW, 4, { fillStyle: (w2MsRemaining > 0) ? '#6060ff' : '#0000ff' });
        });
        
      },
      
      $shootSteps: [
        { ms: 1000, ang: -0.01, dmgMult: 1   },  // Inwards
        { ms: 1000, ang:  0.00, dmgMult: 1.4 },  // Parallel again
        { ms: 1500, ang: +0.02, dmgMult: 1   },  // Very slowly increase angle
        { ms: 3000, ang: +0.28, dmgMult: 1   }   // Slowly bend all the way outwards
      ],
      $w1Delay: 86, $w1Dmg: 0.3, $w1LockMs: 1100,
      $w1ShortLockPunishSlow: 0.35, $w1ShortLockPunishMs: 300,
      $w1LongLockPunishSlow: 0.85, $w1LongLockPunishMs: 1100,
      $w1ReloadBoostMs: 800, $w1ReloadBoostAmt: 1.55,
      $w2Delay: 10000, $w2Duration: 1900,
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        this.lockoutPunishMark = null;
        this.w1Mark = null; // Marks when bullet ready to fire
        this.w1StartMark = null; // Marks the time the first bullet of the series was fired
        this.w1LockMark = this.ms; // Marks when lockout will end
        this.w2ReadyMark = this.ms; // Marks when w2 can be used
        this.w2Mark = null; // Marks when w2 ends
        this.w2EffectiveShootDuration = null;
      },
      normState: function() { return { ...insp.Ace.normState.call(this), w2ReadyMark: this.w2ReadyMark };},
      getAngForShootDuration: function(shootDurationMs) {
        
        let prevMs = 0;
        let prevAng = 0;
        for (let step of Insp.shootSteps) {
          
          let curMs = prevMs + step.ms;
          
          if (shootDurationMs < curMs) {
            return { ...step, smoothAng: util.fadeAmt(prevAng, step.ang, (shootDurationMs - prevMs) / step.ms) };
          }
          
          prevMs += step.ms;
          prevAng = step.ang;
          
        }
        
        let result = Insp.shootSteps.slice(-1)[0];
        return { ...result, smoothAng: result.ang };
        
      },
      updateAndGetResult: function(ms, game, entity) {
        
        if (game.victory) return insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        // Reset `this.lockoutPunishMark` when the duration ends
        if (this.lockoutPunishMark && ms >= this.lockoutPunishMark) this.lockoutPunishMark = null;
        
        if (this.w1LockMark && ms >= this.w1LockMark) {
          this.w1LockMark = null;
          
          // Upon reload, get a speed boost
          this.slowMarks.add({ mark: ms + Insp.w1ReloadBoostMs, amt: Insp.w1ReloadBoostAmt });
        }
        
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        // End w2 when the duration elapses
        if (this.w2Mark && ms >= this.w2Mark) { this.w2Mark = null; this.w1LockMark = ms + Insp.w1LockMs; }
        
        if (entity.controls.a1 && !this.w1LockMark && (!this.w1Mark || ms >= this.w1Mark)) {
          
          // Mark the time of the first shot in the series
          if (!this.w1StartMark) this.w1StartMark = ms;
          
          if (!this.w2Mark) {
            
            // Enforce typical rate of fire
            this.w1Mark = (this.w1Mark || ms) + Insp.w1Delay;
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(ms - this.w1StartMark);
            supResult.birth.gain([
              DirectedBullet({ ms, owner: this, x: this.x - 4, y: this.y, ang: -ang, spd: 800, dmg: Insp.w1Dmg * dm, r: 3 * dm, lifespanMs: 2800 }),
              DirectedBullet({ ms, owner: this, x: this.x + 4, y: this.y, ang: +ang, spd: 800, dmg: Insp.w1Dmg * dm, r: 3 * dm, lifespanMs: 2800 })
            ]);
            
          } else {
            
            // Enforce steroid rate of fire
            this.w1Mark = (this.w1Mark || ms) + Insp.w1Delay * (1 / 2);
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(this.w2EffectiveShootDuration);
            supResult.birth.gain([
              DirectedBullet({ ms, owner: this, x: this.x - 8, y: this.y, ang: -(ang * 1.5), spd: 800 * 1.1, dmg: Insp.w1Dmg * 1.15 * dm, r: 5 * dm, lifespanMs: 2800 }),
              DirectedBullet({ ms, owner: this, x: this.x - 4, y: this.y, ang: -(ang * 1.0), spd: 800 * 1.1, dmg: Insp.w1Dmg * 1.15 * dm, r: 5 * dm, lifespanMs: 2800 }),
              DirectedBullet({ ms, owner: this, x: this.x + 4, y: this.y, ang: +(ang * 1.0), spd: 800 * 1.1, dmg: Insp.w1Dmg * 1.15 * dm, r: 5 * dm, lifespanMs: 2800 }),
              DirectedBullet({ ms, owner: this, x: this.x + 8, y: this.y, ang: +(ang * 1.5), spd: 800 * 1.1, dmg: Insp.w1Dmg * 1.15 * dm, r: 5 * dm, lifespanMs: 2800 }),
            ]);
            
          }
          
        } else if (this.w1Mark && ms >= this.w1Mark) {
          
          // Just stopped shooting! Lockout!
          this.w1Mark = null;
          this.w1StartMark = null;
          this.w1LockMark = ms + Insp.w1LockMs;
          this.slowMarks.add({ mark: ms + Insp.w1ShortLockPunishMs, amt: Insp.w1ShortLockPunishSlow });
          this.slowMarks.add({ mark: ms + Insp.w1LongLockPunishMs, amt: Insp.w1LongLockPunishSlow });
          
        }
        
        if (entity.controls.a2) {
          
          if (ms >= this.w2ReadyMark) {
            
            this.w2ReadyMark = ms + Insp.w2Duration + Insp.w2Delay;
            this.w2Mark = ms + Insp.w2Duration;
            this.w2EffectiveShootDuration = ms - (this.w1StartMark || ms)
            
            let incAng = 0.029;
            let bulletArgs = { ms, owner: this, x: this.x, y: this.y, spd: 150, dmg: 4, r: 7 };
            supResult.birth.gain(Array.fill(20, n => DirectedBullet({
              ...bulletArgs,
              ang: 0.5 + (n * incAng) - (10 * incAng) + (0.5 * incAng),
              lifespanMs: 2500
            })));
            
          } else {
            
            if (!this.lockoutPunishMark) {
              this.lockoutPunishMark = ms + 500;
              this.slowMarks.add({ mark: ms + 500, amt: 0.4 });
            }
            
          }
          
        }
        
        return supResult;
        
      }
      
    })});
    let SlamKid = U.inspire({ name: 'SlamKid', insps: { Ace }, methods: (insp, Insp) => ({
      
      $slamSpd: 400, $slamDelay: 760,
      $slamCharge1Ms: 300, $slamCharge2Ms: 630, $slamCharge3Ms: 750,
      $slamPunishMs: 1500, $slamPunishSlow: 0.25,
      $missileSpd: 900, $missileDmg: 2.1, $missilePDmg: [0.3,4.5],
      $shotgunCnt: 18, $shotgunInitAng: 0.019, $shotgunAng: 0.009,
      $shotgunSpd: 650, $shotgunDmg: 0.09, $shotgunPDmg: [0.09,0.28], $shotgunLifespanMs: 305,
      $shotgunSlamDelayMult: 0.55,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSlam' }),
      $render: (draw, game, args) => {
        
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep, () => {
          let { x, y, w1Mark, w2Mark, w1StartMark, w2StartMark } = args;
        });
        
      },
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        
        this.w1Mark = this.ms;
        this.w1StartMark = null;
        
        this.w2Mark = this.ms;
        this.w2StartMark = null;
        
        this.slamSpd = Insp.slamSpd / Math.sqrt(2);
      },
      normState: function() { return {
        ...insp.Ace.normState.call(this),
        w1Mark: this.w1Mark, w2Mark: this.w2Mark,
        w1StartMark: this.w1StartMark, w2StartMark: this.w2StartMark
      }},
      updateAndGetResult: function(ms, game, entity) {
        
        if (game.victory) return insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        let birth = [];
        
        let dirs = [
          [ -1, 'a1', 'w1Mark', 'w1StartMark' ],
          [ +1, 'a2', 'w2Mark', 'w2StartMark' ]
        ];
        
        for (let [ mult, a, wMark, wMarkStart ] of dirs) {
          
          if (entity.controls[a] && ms > this[wMark] && (!this[wMarkStart] || ms < this[wMarkStart] + Insp.slamCharge3Ms)) {
            
            if (!this[wMarkStart]) {
              this[wMarkStart] = ms;
              
              let inc1 = 10; let inc2 = 20;
              birth.gain([
                SlamKidSlammer({ ms, slamKid: this, dir: mult, offX: +inc2 + (mult * 20), offY: (-inc2 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, offX: +inc1 + (mult * 20), offY: (-inc1 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, offX:     0 + (mult * 20), offY: (    0 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, offX: -inc1 + (mult * 20), offY: (+inc1 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, offX: -inc2 + (mult * 20), offY: (+inc2 * mult) + 16 })
              ])
            }
            
            let duration = ms - this[wMarkStart];
            let durFade = Math.pow(util.fadeAmt(1, 0.1, duration / Insp.slamCharge3Ms), 0.95);
            this.x += this.slamSpd * spf * durFade * mult;
            this.y += this.slamSpd * spf * durFade;
            
          } else if (this[wMarkStart]) {
            
            let duration = ms - this[wMarkStart];
            if (duration >= Insp.slamCharge3Ms){
              
              // Nothing right now for exceeding charge duration
              this[wMark] = ms + Insp.slamDelay;
              
            } else if (duration >= Insp.slamCharge2Ms) {
              
              // No effect for releasing in the last part of the charge
              this[wMark] = ms + Insp.slamDelay;
              
            } else if (duration >= Insp.slamCharge1Ms) {
              
              // Missile!!
              let missileArgs = { ms, owner: this, x: this.x + (mult * 9), y: this.y };
              birth.gain([
                SimpleBullet({ ...missileArgs, spd: +Insp.missileSpd, dmg: Insp.missileDmg, pDmg: Insp.missilePDmg, w: 7, h: 20 }),
                SimpleBullet({ ...missileArgs, spd: -Insp.missileSpd, dmg: Insp.missileDmg, pDmg: Insp.missilePDmg, w: 7, h: 20 })
              ]);
              this.effects.add({ mark: ms + 150, type: null, fn: ms => {
                this.y -= 220 * spf;
              }});
              this[wMark] = ms + Insp.slamDelay;
              
            } else {
              
              // Shotgun!
              let shotgunArgs = { ms, owner: this, x: this.x + (mult * 7), y: this.y - 7 };
              birth.gain(Array.fill(Insp.shotgunCnt, n => DirectedBullet({
                ...shotgunArgs,
                dmg: Insp.shotgunDmg, pDmg: Insp.shotgunPDmg, r: 2, spd: Insp.shotgunSpd,
                ang: mult * (Insp.shotgunInitAng + n * Insp.shotgunAng),
                lifespanMs: Insp.shotgunLifespanMs
              })));
              
              this.effects.add({ mark: ms + 300, type: 'spdMult', spdMult: 1.2, fn: () => {
                this.x -= mult * 50 * spf;
                this.y -= 50 * spf;
              }});
              this[wMark] = ms + Insp.slamDelay * Insp.shotgunSlamDelayMult;
              
            }
            
            this[wMarkStart] = null;
            
          }
          
        }
        
        let spdMult = (this.w1StartMark || this.w2StartMark) ? 0.55 : 1;
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity, spdMult);
        supResult.birth.gain(birth);
        return supResult;
        
      }
      
    })});
    let SalvoLad = U.inspire({ name: 'SalvoLad', insps: { Ace }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSalvo' }),
      $render: (draw, game, args) => {
        
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep, () => {
          let { x, y, readyMark, combo } = args;
          
          if (combo.length === 0) return;
          
          let dispY = y - 16;
          
          let indSize = 8;
          let hIndSize = indSize >> 1;
          let comboW = combo.length * indSize;
          draw.rectCen(x, dispY, comboW + 4, indSize + 4, { strokeStyle: '#000000' });
          
          let dispX = x - (comboW >> 1);
          for (c of combo) {
            draw.path({ fillStyle: '#000000' }, ({ jump, draw }) => {
              if (c === '<') {
                jump(dispX, dispY - hIndSize);
                draw(dispX + indSize, dispY);
                draw(dispX, dispY + hIndSize);
              } else if (c === '>') {
                jump(dispX + indSize, dispY - hIndSize);
                draw(dispX, dispY);
                draw(dispX + indSize, dispY + hIndSize);
              }
            });
            dispX += indSize;
          }
          
        });
        
      },
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        
        this.readyMark = this.ms;
        this.combo = '';
        
        this.a1Up = false;
        this.a2Up = false;
      },
      normState: function() { return { ...insp.Ace.normState.call(this), readyMark: this.readyMark, combo: this.combo }; },
      comboRetort: function(ms, birth, dir) {
        
        this.effects.add({ mark: ms + 500,
          type: 'spdMult', spdMult: 0.7,
          fn: (ms1) => {
            let amt = ((ms1 - ms) / 500) * 300 * spf;
            this.y -= amt;
            this.x += amt * dir;
          }
        });
        this.effects.add({ mark: ms + 100, endFn: (ms, { birth }) => {
          birth.gain(Array.fill(3, n => DirectedBullet({
            ms, owner: this, x: this.x - (dir * n * 16), y: (this.y + 24) - (16 * n), ang: dir * -0.125, spd: 650, dmg: 1, r: 5, lifespanMs: 450
          })));
        }});
        this.effects.add({ mark: ms + 250, endFn: (ms, { birth }) => {
          birth.gain(Array.fill(3, n => DirectedBullet({
            ms, owner: this, x: this.x - (dir * n * 16), y: (this.y + 24) - (16 * n), ang: dir * -0.125, spd: 650, dmg: 1, r: 5, lifespanMs: 300
          })));
        }});
        this.effects.add({ mark: ms + 350, endFn: (ms, { birth }) => {
          birth.gain(Array.fill(3, n => DirectedBullet({
            ms, owner: this, x: this.x - dir * n * 16, y: this.y + 24 - 16 * n, ang: dir * -0.125, spd: 650, dmg: 1, r: 5, lifespanMs: 200
          })));
        }});
        
      },
      comboDiveBomb: function(ms, birth, dir) {
        
        this.effects.add({ mark: ms + 500,
          type: 'spdMult', spdMult: 0.7,
          fn: (ms1) => {
            this.y += ((ms1 - ms) / 500) * 550 * spf;
            this.x += dir * 150 * spf;
          },
          endFn: (ms1, { birth }) => {
            let missileArgs = { ms, salvoLad: this, x: this.x, y: this.y };
            birth.gain([
              SalvoLadMissile({ ...missileArgs, ang: dir * 0.113, spd: 120, lifespanMs: 1320, kaboomArgs: { dps: 4.25, duration: 1900 } }),
              SalvoLadMissile({ ...missileArgs, ang: dir * 0.085, spd: 138, lifespanMs: 1400, kaboomArgs: { dps: 4.25, duration: 2300 } }),
              SalvoLadMissile({ ...missileArgs, ang: dir * 0.039, spd: 125, lifespanMs: 1350, kaboomArgs: { dps: 4.25, duration: 2150 } })
            ])
          }
        });
        
      },
      comboSpeedBoost: function(ms, birth) {
        this.effects.add({ mark: ms + 500, type: 'spdMult', spdMult: 1.3 });
      },
      updateAndGetResult: function(ms, game, entity) {
        
        if (game.victory) return insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        let birth = [];
        
        if (ms >= this.readyMark) {
          
          if (entity.controls.a1) {
            if (!this.a1Up && !entity.controls.a2) { this.combo += '<'; this.a1Up = true; }
          } else {
            this.a1Up = false;
          }
          
          if (entity.controls.a2) {
            if (!this.a2Up && !entity.controls.a1) { this.combo += '>'; this.a2Up = true; }
          } else {
            this.a2Up = false;
          }
          
          let combos = {
            '<<<': () => this.comboRetort(ms, birth, -1),
            '>>>': () => this.comboRetort(ms, birth, +1),
            '<>>': () => this.comboDiveBomb(ms, birth, -1),
            '><<': () => this.comboDiveBomb(ms, birth, +1),
            '<<>': () => this.comboSpeedBoost(ms, birth),
            '>><': () => {},
            '<><<>': () => {},
            '><>><': () => {}
          };
          
          if (combos.has(this.combo)) {
            combos[this.combo]();
            this.combo = '';
            this.readyMark = ms + 750;
          } else if (this.combo.length >= 5) {
            this.combo = '';
            this.effects.add({ mark: ms + 1000, type: 'spdMult', spdMult: 0.45 });
            this.readyMark = ms + 1000;
          }
          
        }
        
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        supResult.birth.gain(birth);
        return supResult;
        
      },
    })});
    
    // Good guy util
    let JoustManOrb = U.inspire({ name: 'JoustManOrb', insps: { DirectedBullet }, methods: (insp, Insp) => ({
      $render: (draw, game, { x, y, r, team }) => {
        draw.circ(x, y, r,       { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      }
    })});
    let JoustManLaserSphere = U.inspire({ name: 'JoustManLaserSphere', insps: { Geom }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, r }) => {
        draw.circ(x, y, r, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      },
      
      init: function({ joustMan, xOff, yOff, durationMs, dps, r, ...args }) {
        insp.Geom.init.call(this, args);
        this.joustMan = joustMan;
        this.xOff = xOff; this.yOff = yOff;
        this.durationMs = durationMs;
        this.dps = dps;
        this.r = r;
      },
      getTeam: function() { return this.joustMan.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, this.dps * spf);
        rep.hp -= dmg;
        this.joustMan.scoreDamage += dmg;
      },
      permState: function() { return { ...insp.Geom.permState.call(this), r: this.r }; },
      updateAndGetResult: function(ms, game, entity) {
        this.x = this.joustMan.x + this.xOff;
        this.y = this.joustMan.y + this.yOff;
        return { x: this.x, y: this.y, form: 'circle', r: this.r, birth: [] };
      },
      isAlive: function(ms, game) {
        return this.joustMan.isAlive(ms, game) && (ms - this.ms) < this.durationMs;
      }
      
    })});
    let JoustManLaserVert = U.inspire({ name: 'JoustManLaserVert', insps: { Geom }, methods: (insp, Insp) => ({
      
      $durationMs: 3000, $dps: 12,
      $render: (draw, game, { x, y }) => {
        let w = 26;
        let h = 1200;
        draw.rectCen(x, y, w, h, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.rectCen(x, y, w * 0.6, h, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      },
      
      init: function({ joustMan, ...args }={}) {
        insp.Geom.init.call(this, args);
        this.joustMan = joustMan;
      },
      getTeam: function() { return this.joustMan.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, Insp.dps * spf);
        rep.hp -= dmg;
        this.joustMan.scoreDamage += dmg;
      },
      updateAndGetResult: function(ms, game, entity) {
        this.x = this.joustMan.x;
        this.y = this.joustMan.y + 606;
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: 22, h: 1200 }
      },
      isAlive: function(ms, game) {
        return this.joustMan.isAlive(ms, game) && (ms - this.ms) < Insp.durationMs;
      }
      
    })});
    let SlamKidSlammer = U.inspire({ name: 'SlamKidSlammer', insps: { Geom }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 7 }, $dmg: 1.4,
      $render: (draw, game, { x, y }) => {
        draw.circ(x, y, Insp.bound.r, { fillStyle: Bullet.getColour(+1) });
      },
      
      init: function({ slamKid, dir, offX, offY, ...args }={}) {
        insp.Geom.init.call(this, args);
        this.slamKid = slamKid;
        this.dir = dir;
        this.offX = offX; this.offY = offY;
        this.integrity = 1;
      },
      getTeam: function() { return this.slamKid.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, Insp.dmg);
        rep.hp -= dmg;
        this.slamKid.scoreDamage += dmg;
        this.integrity = 0;
      },
      updateAndGetResult: function(ms, game, entity) {
        this.x = this.slamKid.x + this.offX;
        this.y = this.slamKid.y + this.offY;
        return { x: this.x, y: this.y, ...Insp.bound };
      },
      isAlive: function(ms, game) {
        return true
          && this.integrity > 0
          && this.slamKid.isAlive(ms, game) // SlamKid is alive
          && this.slamKid[(this.dir === -1) ? 'w1StartMark' : 'w2StartMark'] // Slammer is used
      }
      
    })});
    let SalvoLadMissile = U.inspire({ name: 'SalvoLadMissile', insps: { Geom, Mover }, methods: (insp, Insp) => ({
      
      $r: 16,
      $render: (draw, game, { x, y }) => {
        draw.circ(x, y, Insp.r, { fillStyle: '#ff0000', strokeStyle: '#ff8400' });
      },
      
      init: function({ salvoLad, lifespanMs, kaboomArgs={}, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Mover.init.call(this, args);
        this.salvoLad = salvoLad;
        this.lifespanMs = lifespanMs;
        this.kaboomArgs = kaboomArgs;
      },
      canCollide: function() { return false; },
      isAlive: function(ms, game) {
        return true
          && (ms - this.ms) < this.lifespanMs
          && insp.Mover.isAlive.call(this, ms, game);
      },
      updateAndGetResult: function(ms, game, entity) {
        insp.Mover.moveToDestination.call(this, game);
        return { form: 'circle', x: this.x, y: this.y, r: this.r, birth: [] };
      },
      dieAndGetResult: function() {
        return { birth: [
          SalvoLadKaboom({ salvoLad: this.salvoLad, x: this.x, y: this.y, ...this.kaboomArgs })
        ]};
      }
    })});
    let SalvoLadKaboom = U.inspire({ name: 'SalvoLadKaboom', insps: { Geom }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, r }) => {
        draw.circ(x, y, r, { fillStyle: 'rgba(255, 50, 30, 0.2)', strokeStyle: '#ff8400' });
      },
      
      init: function({ salvoLad, dps=3.1, durationMs=2000, sizePerSec=40, ...args }) {
        insp.Geom.init.call(this, args);
        this.salvoLad = salvoLad;
        this.r = 0;
        this.dps = dps;
        this.durationMs = durationMs;
        this.sizePerSec = sizePerSec;
      },
      getTeam: function() { return this.salvoLad.getTeam(); },
      fluxState: function() { return { ...insp.Geom.fluxState.call(this), r: this.r }; },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, this.dps * spf);
        rep.hp -= dmg;
        this.salvoLad.scoreDamage += dmg;
      },
      updateAndGetResult: function(ms, game, entity) {
        this.r += this.sizePerSec * spf;
        this.y += game.val.aheadSpd * spf;
        return { form: 'circle', x: this.x, y: this.y, r: this.r, birth: [] };
      },
      isAlive: function(ms) { return (ms - this.ms) < this.durationMs; }
      
    })});
    
    // BAD GUYS
    let Enemy = U.inspire({ name: 'Enemy', insps: { Geom, Mortal }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { imageKeep, x, y, w, h=w, rot=Math.PI }) => {
        draw.frame(() => {
          draw.trn(x, y);
          if (rot) draw.rot(rot);
          draw.image(imageKeep, 0, 0, w, h);
        });
      },
      
      init: function({ game, relDist=0, x, y, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.x = x; this.y = relDist + y;
        this.w = 40; this.h = 40;
        this.scoreDamage = 0;
      },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (U.isInspiredBy(rep, Ace)) {
          let enemyHp = this.hp;
          this.hp -= rep.hp;
          rep.hp -= enemyHp;
        }
      },
      getTeam: function() { return -1; },
      updateAndGetResult: function(ms, game, entity) {
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: insp.Mortal.isAlive
      
    })});
    let Winder = U.inspire({ name: 'Winder', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 20 },
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWinder' }),
      $render: (draw, game, { x, y, spd }) => {
        Insp.parents.Enemy.render(draw, game, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.r << 1,
          rot: (spd < 0) ? Math.PI : 0
        });
      },
      
      init: function({ spd=100, swingHz=2, swingAmt=100, numSwings=0, phase=0, ...args }) {
        if (swingHz < 0) throw Error(`Negative "swingHz" param; use negative "swingAmt" instead`);
        insp.Enemy.init.call(this, args);
        this.spd = spd;
        this.swingHz = swingHz;
        this.swingAmt = swingAmt;
        this.numSwings = numSwings;
        this.phase = phase * Math.PI * 2;
        this.initX = this.x;
      },
      permState: function() { return { ...insp.Enemy.permState.call(this), spd: this.spd }; },
      updateAndGetResult: function(ms, game, entity) {
        this.y += (game.val.aheadSpd + this.spd) * spf;
        this.x = this.initX + Math.sin(this.phase + (ms - this.ms) * 0.002 * Math.PI * this.swingHz) * this.swingAmt;
        return { x: this.x, y: this.y, ...Insp.bound };
      },
      isAlive: function(ms, game) {
        if (!insp.Enemy.isAlive.call(this, ms, game)) return false;
        
        return true
          && (!this.numSwings || ((ms - this.ms) * 0.001 * this.swingHz) <= this.numSwings)
          && (this.spd < 0)
            ? (this.y >= (game.val.dist - cnst.distToConsiderEnemyClear))
            : (this.y <= (game.val.dist + cnst.distToConsiderEnemyClear));
      }
      
    })});
    let WinderMom = U.inspire({ name: 'WinderMom', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'rect', w: 160, h: 160 }, $maxHp: 90,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWinderMom' }),
      $render: (draw, game, { x, y }) => {
        Insp.parents.Enemy.render(draw, game, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.w, h: Insp.bound.h
        });
      },
      
      init: function({ spawnMs=3000, spawnArgs={}, ...args }) {
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        
        this.spawnMs = spawnMs;
        this.spawnMark = this.ms + this.spawnMs;
        this.spawnArgs = spawnArgs;
      },
      getMaxHp: function() { return Insp.maxHp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return true; },
      updateAndGetResult: function(ms, game, entity) {
        
        this.moveToDestination(game);
        
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
        
        return { x: this.x, y: this.y, ...Insp.bound, birth };
        
      },
      isAlive: function(ms, game) {
        return true
          && insp.Enemy.isAlive.call(this, ms, game)
          && insp.Mover.isAlive.call(this, ms, game);
      }
      
    })});
    let WandererMom = U.inspire({ name: 'WandererMom', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'rect', w: 150, h: 210 },
      $maxHp: 90, $numBullets: 7, $bulletSpd: 330,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWandererMom' }),
      $render: (draw, game, { x, y }) => {
        Insp.parents.Enemy.render(draw, game, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.w, h: Insp.bound.h
        });
      },
      
      init: function({ spawnMs=3000, shootDelayMs=2400, spawnArgs={}, ...args }) {
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        this.w = Insp.w; this.h = Insp.h;
        
        this.spawnMs = spawnMs;
        this.spawnMark = this.ms + this.spawnMs;
        this.spawnArgs = spawnArgs;
        
        this.shootDelayMs = shootDelayMs;
      },
      getMaxHp: function() { return Insp.maxHp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return true; },
      updateAndGetResult: function(ms, game, entity) {
        
        this.moveToDestination(game);
        
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
        
        // Try to shoot `Insp.numBullets` bullets
        if (Math.random() < ((spf * 1000) / this.shootDelayMs)) {
          
          let bulletArgs = { ms, owner: this, x: this.x, y: this.y, spd: Insp.bulletSpd, dmg: 1, r: 8 };
          birth.gain(Array.fill(Insp.numBullets, () => DirectedBullet({
            ...bulletArgs, ang: 0.5 + ((Math.random() - 0.5) * 2 * 0.05), lifespanMs: 3000
          })));
          
        }
        
        return { x: this.x, y: this.y, ...Insp.bound, birth };
        
      },
      isAlive: function(ms, game) {
        return true
          && insp.Enemy.isAlive.call(this, ms, game)
          && insp.Mover.isAlive.call(this, ms, game);
      }
      
    })});
    let Drifter = U.inspire({ name: 'Drifter', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyDrifter' }),
      $render: (draw, game, { x, y, vy, r }) => {
        
        Insp.parents.Enemy.render(draw, game, { imageKeep: Insp.imageKeep, x, y,
          w: r * 2,
          rot: (vy <= 0) ? Math.PI : 0
        });
        
      },
      
      init: function({ hp, minSize, hpPerSec, sizeMult, ...args }) {
        this.hp = hp;
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        this.hpPerSec = hpPerSec;
        this.sizeMult = sizeMult;
        this.minSize = minSize;
        this.size = this.minSize + this.hp * this.sizeMult;
      },
      getRadius: function() { return this.minSize + this.hp * this.sizeMult; },
      getMaxHp: function() { return this.hp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return false; },
      normState: function() { return { vy: this.vy }; },
      fluxState: function() { return { ...insp.Enemy.fluxState.call(this), r: this.getRadius() }; },
      updateAndGetResult: function(ms, game, entity) {
        
        this.moveToDestination(game);
        
        this.hp += this.hpPerSec * spf;
        this.size = this.minSize + this.hp * this.sizeMult;
        
        return { x: this.x, y: this.y, form: 'circle', r: this.getRadius() };
        
      },
      isAlive: function(ms, game) {
        return true
          && insp.Enemy.isAlive.call(this, ms, game)
          && insp.Mover.isAlive.call(this, ms, game);
      }
      
    })});
    let Wanderer = U.inspire({ name: 'Wanderer', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 22 }, $maxHp: 4.5,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWanderer' }),
      $render: (draw, game, { x, y, vy }) => {
        Insp.parents.Enemy.render(draw, game, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.r << 1,
          rot: (vy <= 0) ? Math.PI : 0
        });
      },
      
      init: function({ mode, delayMs, initDelay=0, bulletArgs={}, ...args }) {
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        this.mode = mode;
        this.delayMs = delayMs;
        this.shootMark = this.ms + initDelay;
      },
      ...insp.Enemy.slice('canCollide', 'collide'),
      getMaxHp: function() { return Insp.maxHp; },
      moveWithGame: function() { return true; },
      stopAtDestination: function() { return false; },
      normState: function() { return { vy: this.vy }; },
      updateAndGetResult: function(ms, game, entity) {
        this.moveToDestination(game);
        
        let birth = [];
        
        let shootCondition = (this.mode === 'steady')
          ? (ms >= this.shootMark)
          : (Math.random() < ((spf * 1000) / this.delayMs));
        
        if (shootCondition) {
          birth.gain([
            SimpleBullet({
              ms, owner: this,
              x: this.x, y: this.y,
              spd: -380, dmg: 1, w: 8, h: 20,
              lifespanMs: 3000
            })
          ]);
          this.shootMark += this.delayMs;
        }
        return { x: this.x, y: this.y, ...Insp.bound, birth };
      },
      isAlive: function(ms, game) {
        return true
          && insp.Enemy.isAlive.call(this, ms, game)
          && insp.Mover.isAlive.call(this, ms, game);
      }
      
    })});
    
    // TERRAIN
    let TileBg = U.inspire({ name: 'TileBg', insps: { Geom }, methods: (insp, Insp) => ({
      
      $imageKeeps: {
        savanna: foundation.getKeep('urlResource', { path: 'fly.sprite.bgSavanna' }),
        savannaToPlains: foundation.getKeep('urlResource', { path: 'fly.sprite.bgSavannaToPlains' }),
        plains: foundation.getKeep('urlResource', { path: 'fly.sprite.bgPlains' }),
        plainsToSavanna: foundation.getKeep('urlResource', { path: 'fly.sprite.bgPlainsToSavanna' })
      },
      $renderPriority: ({ priority }) => priority,
      $render: (draw, game, { x, y, w, h, tw, th, def }) => {
        
        //w = 400;
        //draw.rectCen(x, -y, w, h, { fillStyle: 'rgba(0, 0, 0, 0.1)', strokeStyle: '#000000', lineWidth: 10 });
        
        let ind = 0;
        let xPermOff = x + (tw >> 1) - (w >> 1);
        let yPermOff = y + (th >> 1) - (h >> 1);
        for (let yOff = 0; yOff < h; yOff += th) { for (let xOff = 0; xOff < w; xOff += tw) {
          if (def[ind]) draw.image(Insp.imageKeeps[def[ind]], xPermOff + xOff, yPermOff + yOff, tw, th);
          ind++;
        }}
        
      },
      
      init: function({ relDist=0, x=0, y=0, w, h, tw=100, th=100, priority=1, tileDef, ...args }) {
        insp.Geom.init.call(this, args);
        this.w = w; this.hw = w >> 1;
        this.h = h; this.hh = h >> 1;
        this.tw = tw; this.th = th;
        
        this.x = x; this.y = relDist + y + this.hh + cnst.offscreenDist;
        this.tileDef = tileDef;
        this.priority = priority;
        
      },
      canCollide: function() { return false; },
      fluxState: function() { return {}; }, // Nothing changes about TileBg! (TODO: Should shift up to cover every so often, making "y" the only flux (or even norm) param)
      permState: function() { return {
        ...insp.Geom.permState.call(this),
        priority: this.priority,
        x: this.x, y: this.y, w: this.w, h: this.h, tw: this.tw, th: this.th, def: this.tileDef
      };},
      isAlive: function(ms, game) {
        
        let screenBot = game.val.dist - cnst.offscreenDist;
        let topY = this.y + this.hh;
        return screenBot <= topY;
        
      },
      updateAndGetResult: function() {
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: this.w, h: this.h };
      }
    })});
    
    let repClasses = {};
    repClasses.gain({ JoustMan, GunGirl, SlamKid, SalvoLad });
    repClasses.gain({ JoustManOrb, JoustManLaserSphere, JoustManLaserVert, SlamKidSlammer, SalvoLadMissile, SalvoLadKaboom });
    repClasses.gain({ Winder, WinderMom, WandererMom, Drifter, Wanderer });
    repClasses.gain({ SimpleBullet, DirectedBullet });
    repClasses.gain({ TileBg });
    
    let levels = {
      plains: {
        moments: [
          
          { dist: 0, name: 'scoutBg', entities: [
            [ 'TileBg', { w: 1000, h: 2500, tw: 500, th: 500, y: -1000, tileDef: Array.fill(10, () => 'savanna') }]
          ]},
          { dist: 500, name: 'scout1', entities: [
            [ 'Winder', { x: -120, y: +620, spd: -100, swingHz: 0.18, swingAmt: -100 } ],
            [ 'Winder', { x: -40, y: +600, spd: -100, swingHz: 0.20, swingAmt: -100 } ],
            [ 'Winder', { x: +40, y: +600, spd: -100, swingHz: 0.20, swingAmt: +100 } ],
            [ 'Winder', { x: +120, y: +620, spd: -100, swingHz: 0.18, swingAmt: +100 } ]
          ]},
          { dist: 500, name: 'scout2', entities: [
            [ 'Winder', { x: -300, y: +640, spd: -100, swingHz: 0.18, swingAmt: -100 } ],
            [ 'Winder', { x: -180, y: +620, spd: -130, swingHz: 0.12, swingAmt: -150 } ],
            [ 'Winder', { x: -60, y: +600, spd: -100, swingHz: 0.18, swingAmt: -100 } ],
            
            [ 'Winder', { x: +60, y: +600, spd: -100, swingHz: 0.18, swingAmt: +100 } ],
            [ 'Winder', { x: +180, y: +620, spd: -130, swingHz: 0.12, swingAmt: +150 } ],
            [ 'Winder', { x: +300, y: +640, spd: -100, swingHz: 0.18, swingAmt: +100 } ],
          ]},
          { dist: 500, name: 'scout3', entities: [
            [ 'Winder', { x: -80, y: +800, spd: -180, swingHz: 0.15, swingAmt: -80 } ],
            [ 'Winder', { x: +80, y: +800, spd: -180, swingHz: 0.15, swingAmt: +80 } ],
            
            [ 'Winder', { x: -300, y: +640, spd: -100, swingHz: 0.22, swingAmt: -100 } ],
            [ 'Winder', { x: -180, y: +620, spd: -130, swingHz: 0.18, swingAmt: -300 } ],
            [ 'Winder', { x: -60, y: +600, spd: -100, swingHz: 0.22, swingAmt: -100 } ],
            
            [ 'Winder', { x: +60, y: +600, spd: -100, swingHz: 0.22, swingAmt: +100 } ],
            [ 'Winder', { x: +180, y: +620, spd: -130, swingHz: 0.18, swingAmt: +300 } ],
            [ 'Winder', { x: +300, y: +640, spd: -100, swingHz: 0.22, swingAmt: +100 } ],
            
            [ 'Winder', { x: -150, y: -700, spd: +50, swingHz: 0.1, swingAmt: -60 } ],
            [ 'Winder', { x: +150, y: -700, spd: +50, swingHz: 0.1, swingAmt: +60 } ],
          ]},
          
          { dist: 0, name: 'sideswipeBg', entities: [
            [ 'TileBg', { w: 1000, h: 2000, tw: 500, th: 500, tileDef: Array.fill(8, () => 'savanna') } ]
          ]},
          { dist: 1000, name: 'sideswipe1', entities: [
            
            [ 'Winder', { x: -800, y: +300, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -720, y: +320, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -640, y: +340, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -560, y: +360, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            
          ]},
          { dist: 250, name: 'sideswipe2', entities: [
            
            [ 'Winder', { x: -800, y: +250, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -720, y: +290, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -640, y: +330, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -560, y: +370, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            
          ]},
          { dist: 250, name: 'sideswipe3', entities: [
            
            [ 'Winder', { x: +1000, y: +300, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +920, y: +340, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +840, y: +380, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +760, y: +420, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            
            [ 'Winder', { x:  +100, y: -600, spd: +130, swingHz: 0.01, swingAmt: +50 } ],
            [ 'Winder', { x:  -100, y: -600, spd: +130, swingHz: 0.01, swingAmt: -50 } ]
            
          ]},
          { dist: 250, name: 'sideswipe4', entities: [
            
            [ 'Winder', { x: -800, y: +500, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -820, y: +430, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -840, y: +360, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -860, y: +290, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -880, y: +220, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -900, y: +150, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            
            [ 'Winder', { x:  +900, y: +500, spd: -180, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x:  +930, y: +435, spd: -180, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x:  +960, y: +370, spd: -180, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x:  +990, y: +305, spd: -180, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +1020, y: +240, spd: -180, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +1050, y: +175, spd: -180, swingHz: 0.03, swingAmt: -1200 } ]
            
          ]},
          { dist: 250, name: 'sideswipe5', entities: [
            
            // left-to-right
            [ 'Winder', { x: +800, y: +500, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +820, y: +430, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +840, y: +360, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +860, y: +290, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +880, y: +220, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            [ 'Winder', { x: +900, y: +150, spd: -120, swingHz: 0.03, swingAmt: -1200 } ],
            
            // right-to-left
            [ 'Winder', { x:  -900, y: +500, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x:  -930, y: +435, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x:  -960, y: +370, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x:  -990, y: +305, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -1020, y: +240, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -1050, y: +175, spd: -180, swingHz: 0.03, swingAmt: +1200 } ],
            
            // Sneak attack
            [ 'Winder', { x: -360, y: -600, spd: +140, swingHz: 0.06, swingAmt: +300 } ],
            [ 'Winder', { x: -240, y: -680, spd: +140, swingHz: 0.04, swingAmt: +300 } ],
            [ 'Winder', { x: -120, y: -760, spd: +140, swingHz: 0.02, swingAmt: +300 } ],
            [ 'Winder', { x:   +0, y: -840, spd: +140, swingHz: 0.00, swingAmt:    0 } ],
            [ 'Winder', { x: +120, y: -760, spd: +140, swingHz: 0.02, swingAmt: -300 } ],
            [ 'Winder', { x: +240, y: -680, spd: +140, swingHz: 0.04, swingAmt: -300 } ],
            [ 'Winder', { x: +360, y: -600, spd: +140, swingHz: 0.06, swingAmt: -300 } ],
            
          ]},
          
          { dist: 0, name: 'momBg', entities: [
            [ 'TileBg', { w: 1000, h: 1500, tw: 500, th: 500, tileDef: Array.fill(6, () => 'savanna') } ]
          ]},
          { dist: 600, name: 'mom', entities: [
            
            [ 'WinderMom', { x: 0, y: +650, tx: 0, ty: +300, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } } ],
            
            [ 'Winder', { x: -240, y: +600, spd: -210, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +600, spd: -210, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +600, spd: -210, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +600, spd: -210, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +600, spd: -210, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +600, spd: -210, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +600, spd: -210, swingHz: 0.06, swingAmt: +60 } ],
            
            [ 'Winder', { x: -240, y: +800, spd: -130, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +800, spd: -130, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +800, spd: -130, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +800, spd: -130, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +800, spd: -130, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +800, spd: -130, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +800, spd: -130, swingHz: 0.06, swingAmt: +60 } ]
            
          ]},
          { dist: 900, name: 'mom2', entities: [
            
            [ 'WinderMom', { x: -450, y: +650, tx: -165, ty: +250, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } } ],
            [ 'WinderMom', { x: +450, y: +650, tx: +165, ty: +250, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } } ],
            
            [ 'Winder', { x: -240, y: +720, spd: -210, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +680, spd: -210, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +640, spd: -210, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +600, spd: -210, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +640, spd: -210, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +680, spd: -210, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +720, spd: -210, swingHz: 0.06, swingAmt: +60 } ],
            
            [ 'Winder', { x: -240, y: +720, spd: -130, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +680, spd: -130, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +640, spd: -130, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +800, spd: -130, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +640, spd: -130, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +680, spd: -130, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +720, spd: -130, swingHz: 0.06, swingAmt: +60 } ]
            
          ]},
          
          { dist: 0, name: 'drifterBg', entities: [
            [ 'TileBg', { w: 1000, h: 5500, tw: 500, th: 500, tileDef: Array.fill(22, () => 'savanna') } ]
          ]},
          { dist: 1000, name: 'drifter1', entities: [
            
            [ 'Drifter', { x: -550, y: +600, tx: 0, ty: -300, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +550, y: +600, tx: 0, ty: -300, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ]
            
          ]},
          { dist: 1500, name: 'drifter2', entities: [
            
            [ 'Drifter', { x: -300, y: +640, tx: -300, ty: 0, spd: 50, hp: 5.5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -150, y: +620, tx: -150, ty: 0, spd: 50, hp: 5.5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x:    0, y: +600, tx:    0, ty: 0, spd: 50, hp: 5.5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +150, y: +620, tx: +150, ty: 0, spd: 50, hp: 5.5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +300, y: +640, tx: +300, ty: 0, spd: 50, hp: 5.5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
          ]},
          { dist: 1500, name: 'drifter3', entities: [
            
            [ 'Drifter', { x: -300, y: +640, tx: -300, ty: 0, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -150, y: +620, tx: -150, ty: 0, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x:    0, y: +600, tx:    0, ty: 0, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +150, y: +620, tx: +150, ty: 0, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +300, y: +640, tx: +300, ty: 0, spd: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
            [ 'Drifter', { x: -600, y: +550, tx: 0, ty: -250, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 3 } ],
            [ 'Drifter', { x: +600, y: +550, tx: 0, ty: -250, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 3 } ]
            
          ]},
          { dist: 1500, name: 'drifter4', entities: [
            
            [ 'Winder', { x: -200, y: +890, spd: -70, swingHz: 0.115, swingAmt: -110 } ],
            [ 'Winder', { x: -150, y: +880, spd: -70, swingHz: 0.120, swingAmt: -100 } ],
            [ 'Winder', { x: -100, y: +870, spd: -70, swingHz: 0.125, swingAmt:  -90 } ],
            [ 'Winder', { x:  -50, y: +860, spd: -70, swingHz: 0.130, swingAmt:  -80 } ],
            [ 'Winder', { x:    0, y: +850, spd: -70, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +50, y: +860, spd: -70, swingHz: 0.130, swingAmt:  +80 } ],
            [ 'Winder', { x: +100, y: +870, spd: -70, swingHz: 0.125, swingAmt:  +90 } ],
            [ 'Winder', { x: +150, y: +880, spd: -70, swingHz: 0.120, swingAmt: +100 } ],
            [ 'Winder', { x: +200, y: +890, spd: -70, swingHz: 0.115, swingAmt: +110 } ],
            
            [ 'Drifter', { x: -300, y: +640, tx: -300, ty: 0, spd: 50, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2.5 } ],
            [ 'Drifter', { x: -150, y: +620, tx: -150, ty: 0, spd: 50, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2.5 } ],
            [ 'Drifter', { x:    0, y: +600, tx:    0, ty: 0, spd: 50, hp: 14, hpPerSec: 1.33, minSize: 16, sizeMult: 2.5 } ],
            [ 'Drifter', { x: +150, y: +620, tx: +150, ty: 0, spd: 50, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2.5 } ],
            [ 'Drifter', { x: +300, y: +640, tx: +300, ty: 0, spd: 50, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2.5 } ],
            
            [ 'Drifter', { x: -680, y: +680, tx: 0, ty: -220, spd: 100, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -680, y: +600, tx: 0, ty: -300, spd: 100, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +680, y: +600, tx: 0, ty: -300, spd: 100, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +680, y: +680, tx: 0, ty: -220, spd: 100, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ]
            
          ]},
          
          { dist: 0, name: 'wandererBg', entities: [
            [ 'TileBg', { w: 1000, h: 9000, tw: 500, th: 500, tileDef: Array.fill(36, () => 'savanna') } ]
          ]},
          { dist: 750, name: 'wanderer1', entities: [
            
            [ 'Drifter', { x: -500, y: +600, tx: 0, ty: -200, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -550, y: +500, tx: 0, ty: -300, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +500, y: +600, tx: 0, ty: -200, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +550, y: +500, tx: 0, ty: -300, spd: 70, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
            [ 'Wanderer', { x: -600, y: +600, tx: 0, ty: +100, spd: 65, mode: 'random', delayMs: 8000 } ],
            [ 'Wanderer', { x: +600, y: +600, tx: 0, ty: +100, spd: 65, mode: 'random', delayMs: 8000 } ]
            
          ]},
          { dist: 1250, name: 'wanderer2', entities: [
            
            [ 'Wanderer', { x: -600, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: -660, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: -720, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: -780, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            
            [ 'Wanderer', { x: +600, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: +660, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: +720, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ],
            [ 'Wanderer', { x: +780, y: +600, tx: 0, ty: +100, spd: 120, mode: 'random', delayMs: 10000 } ]
            
          ]},
          { dist: 750, name: 'wanderer3', entities: [
            
            [ 'Wanderer', { x: -600, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: -660, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: -720, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: -780, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            
            [ 'Wanderer', { x: +600, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: +660, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: +720, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ],
            [ 'Wanderer', { x: +780, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 5000 } ]
            
          ]},
          { dist: 750, name: 'wanderer3', entities: [
            
            [ 'Wanderer', { x: -600, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: -660, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: -720, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: -780, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            
            [ 'Wanderer', { x: +600, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: +660, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: +720, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            [ 'Wanderer', { x: +780, y: +600, tx: 0, ty: +100, spd: 180, mode: 'random', delayMs: 4500 } ],
            
            [ 'Wanderer', { x: -600, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: -660, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: -720, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: -780, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            
            [ 'Wanderer', { x: +600, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: +660, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: +720, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            [ 'Wanderer', { x: +780, y: +600, tx: 0, ty: +300, spd: 240, mode: 'random', delayMs: 4000 } ],
            
            [ 'Winder', { x:  -600, y: -350, spd: +30, swingHz: 0.0145, swingAmt: +1200, numSwings: 0.25 } ],
            [ 'Winder', { x:  -670, y: -425, spd: +30, swingHz: 0.0145, swingAmt: +1340, numSwings: 0.25 } ],
            [ 'Winder', { x:  -740, y: -500, spd: +30, swingHz: 0.0145, swingAmt: +1480, numSwings: 0.25 } ],
            [ 'Winder', { x:  -810, y: -575, spd: +30, swingHz: 0.0145, swingAmt: +1620, numSwings: 0.25 } ],
            [ 'Winder', { x:  -880, y: -650, spd: +30, swingHz: 0.0145, swingAmt: +1760, numSwings: 0.25 } ],
            [ 'Winder', { x:  -950, y: -725, spd: +30, swingHz: 0.0145, swingAmt: +1900, numSwings: 0.25 } ],
            
            [ 'Winder', { x:  +600, y: -350, spd: +30, swingHz: 0.0145, swingAmt: -1200, numSwings: 0.25 } ],
            [ 'Winder', { x:  +670, y: -425, spd: +30, swingHz: 0.0145, swingAmt: -1340, numSwings: 0.25 } ],
            [ 'Winder', { x:  +740, y: -500, spd: +30, swingHz: 0.0145, swingAmt: -1480, numSwings: 0.25 } ],
            [ 'Winder', { x:  +810, y: -575, spd: +30, swingHz: 0.0145, swingAmt: -1620, numSwings: 0.25 } ],
            [ 'Winder', { x:  +880, y: -650, spd: +30, swingHz: 0.0145, swingAmt: -1760, numSwings: 0.25 } ],
            [ 'Winder', { x:  +950, y: -725, spd: +30, swingHz: 0.0145, swingAmt: -1900, numSwings: 0.25 } ]
            
          ]},
          { dist: 750, name: 'wanderer4', entities: [
            
            [ 'Wanderer', { x: +500, y: +370, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay:     0 } ],
            [ 'Wanderer', { x: +560, y: +380, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay:  +400 } ],
            [ 'Wanderer', { x: +620, y: +390, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay:  +800 } ],
            [ 'Wanderer', { x: +680, y: +400, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay: +1200 } ],
            
            [ 'Wanderer', { x: +800, y: +370, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay:     0 } ],
            [ 'Wanderer', { x: +860, y: +380, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay:  +400 } ],
            [ 'Wanderer', { x: +920, y: +390, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay:  +800 } ],
            [ 'Wanderer', { x: +980, y: +400, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay: +1200 } ],
            
          ]},
          { dist: 250, name: 'wanderer5', entities: [
            
            [ 'Wanderer', { x: -500, y: +370, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay:    0 } ],
            [ 'Wanderer', { x: -560, y: +380, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay: +200 } ],
            [ 'Wanderer', { x: -620, y: +390, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay: +400 } ],
            [ 'Wanderer', { x: -680, y: +400, tx: 0, ty: +300, spd: 130, mode: 'steady', delayMs: 2200, initDelay: +600 } ],
            
            [ 'Wanderer', { x: -800, y: +370, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay:    0 } ],
            [ 'Wanderer', { x: -860, y: +380, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay: +200 } ],
            [ 'Wanderer', { x: -920, y: +390, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay: +400 } ],
            [ 'Wanderer', { x: -980, y: +400, tx: 0, ty: +350, spd: 160, mode: 'steady', delayMs: 2200, initDelay: +600 } ],
            
          ]},
          { dist: 250, name: 'wanderer6', entities: [
            
            [ 'Drifter', { x: +500, y: +270, tx: 0, ty: + 200, spd: 75, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +580, y: +280, tx: 0, ty: + 200, spd: 75, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +660, y: +290, tx: 0, ty: + 200, spd: 75, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +720, y: +300, tx: 0, ty: + 200, spd: 75, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
            [ 'Wanderer', { x: +500, y: +370, tx: 0, ty: +370, spd: 75, mode: 'steady', delayMs: 1800, initDelay:    0 } ],
            [ 'Wanderer', { x: +560, y: +380, tx: 0, ty: +380, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +200 } ],
            [ 'Wanderer', { x: +620, y: +390, tx: 0, ty: +390, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +400 } ],
            [ 'Wanderer', { x: +680, y: +400, tx: 0, ty: +400, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +600 } ],
            
            [ 'Wanderer', { x: +800, y: +440, tx: 0, ty: +440, spd: 82, mode: 'steady', delayMs: 1800, initDelay:    0 } ],
            [ 'Wanderer', { x: +860, y: +450, tx: 0, ty: +450, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +200 } ],
            [ 'Wanderer', { x: +920, y: +460, tx: 0, ty: +460, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +400 } ],
            [ 'Wanderer', { x: +980, y: +470, tx: 0, ty: +470, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +600 } ],
            
          ]},
          { dist: 750, name: 'wanderer7', entities: [
            
            [ 'Drifter', { x: +500, y: +270, tx: 0, ty: + 200, spd: 75, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +580, y: +280, tx: 0, ty: + 200, spd: 75, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +660, y: +290, tx: 0, ty: + 200, spd: 75, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +720, y: +300, tx: 0, ty: + 200, spd: 75, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
            [ 'Wanderer', { x: +500, y: +370, tx: 0, ty: +370, spd: 75, mode: 'steady', delayMs: 1800, initDelay:    0 } ],
            [ 'Wanderer', { x: +560, y: +380, tx: 0, ty: +380, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +200 } ],
            [ 'Wanderer', { x: +620, y: +390, tx: 0, ty: +390, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +400 } ],
            [ 'Wanderer', { x: +680, y: +400, tx: 0, ty: +400, spd: 75, mode: 'steady', delayMs: 1800, initDelay: +600 } ],
            
            [ 'Wanderer', { x: +800, y: +440, tx: 0, ty: +440, spd: 82, mode: 'steady', delayMs: 1800, initDelay:    0 } ],
            [ 'Wanderer', { x: +860, y: +450, tx: 0, ty: +450, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +200 } ],
            [ 'Wanderer', { x: +920, y: +460, tx: 0, ty: +460, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +400 } ],
            [ 'Wanderer', { x: +980, y: +470, tx: 0, ty: +470, spd: 82, mode: 'steady', delayMs: 1800, initDelay: +600 } ]
            
          ]},
          { dist: 1000, name: 'wanderer8', entities: [
            
            [ 'WandererMom', { x: -600, y: +450, tx: -110, ty: +220, spd: 45, spawnMs: 1800,
                spawnArgs: { tx: +1, ty: 0, spd: 110, mode: 'random', delayMs: 1800 }
            }],
            
            [ 'Drifter', { x: +500, y: -200, tx: 0, ty: -200, spd: 60, hp: 4, hpPerSec: 4, minSize: 24, sizeMult: 2/3 } ],
            
            [ 'Winder', { x: -240, y: +600, spd: -210, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +600, spd: -210, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +600, spd: -210, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +600, spd: -210, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +600, spd: -210, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +600, spd: -210, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +600, spd: -210, swingHz: 0.06, swingAmt: +60 } ],
            
            [ 'Winder', { x: -240, y: +800, spd: -130, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +800, spd: -130, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +800, spd: -130, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +800, spd: -130, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +800, spd: -130, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +800, spd: -130, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +800, spd: -130, swingHz: 0.06, swingAmt: +60 } ]
            
          ]},
          { dist: 1000, name: 'wanderer9', entities: [
            
            [ 'WandererMom', { x: +600, y: +450, tx: +220, ty: +320, spd: 45, spawnMs: 1800,
                spawnArgs: { tx: -1, ty: 0, spd: 110, mode: 'random', delayMs: 1800 }
            }],
            [ 'WandererMom', { x: -750, y: +450, tx: -220, ty: +320, spd: 45, spawnMs: 1800,
                spawnArgs: { tx: +1, ty: 0, spd: 110, mode: 'random', delayMs: 1800 }
            }],
            
            [ 'Winder', { x: -240, y: +600, spd: -210, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +600, spd: -210, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +600, spd: -210, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +600, spd: -210, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +600, spd: -210, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +600, spd: -210, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +600, spd: -210, swingHz: 0.06, swingAmt: +60 } ],
            
            [ 'Winder', { x: -240, y: +800, spd: -130, swingHz: 0.06, swingAmt: -60 } ],
            [ 'Winder', { x: -160, y: +800, spd: -130, swingHz: 0.04, swingAmt: -60 } ],
            [ 'Winder', { x:  -80, y: +800, spd: -130, swingHz: 0.02, swingAmt: -60 } ],
            [ 'Winder', { x:    0, y: +800, spd: -130, swingHz: 0, swingAmt: 0 } ],
            [ 'Winder', { x:  +80, y: +800, spd: -130, swingHz: 0.02, swingAmt: +60 } ],
            [ 'Winder', { x: +160, y: +800, spd: -130, swingHz: 0.04, swingAmt: +60 } ],
            [ 'Winder', { x: +240, y: +800, spd: -130, swingHz: 0.06, swingAmt: +60 } ]
            
          ]},
          
          { dist: 1500, name: 'desperationBg', entities: [
            
            [ 'TileBg', { w: 1000, h: 12500, tw: 500, th: 500, tileDef: [
              ...Array.fill(2, () => 'savannaToPlains'),
              ...Array.fill(44, () => 'plains'),
            ]}]
            
          ]},
          { dist: 2500, name: 'desperation1', entities: [
            
            [ 'WinderMom', { x: -600, y: +500, tx: -160, ty: +230, spd: 38, spawnMs: 1500, spawnArgs: { spd: -75 } } ],
            [ 'WinderMom', { x: +600, y: +500, tx: +160, ty: +230, spd: 50, spawnMs: 1500, spawnArgs: { spd: -75 } } ],
            
            [ 'Drifter', { x: -560, y: 150, tx:    0, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -570, y: 120, tx:  -50, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -580, y: 90, tx: -100, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -590, y: 60, tx: -150, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -600, y: 30, tx: -200, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: -610, y: 0, tx: -250, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            
            [ 'Drifter', { x: +560, y: 150, tx:    0, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +570, y: 120, tx:  +50, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +580, y: 90, tx: +100, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +590, y: 60, tx: +150, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +600, y: 30, tx: +200, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ],
            [ 'Drifter', { x: +610, y: 0, tx: +250, ty: -300, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 } ]
            
          ]},
          { dist: 1000, name: 'desperation2', entities: [
            
            [ 'Winder', { x: -120, y: -950, spd: +90, swingHz: +0.09, swingAmt: +375 } ],
            [ 'Winder', { x: -100, y: -920, spd: +90, swingHz: +0.09, swingAmt: +300 } ],
            [ 'Winder', { x:  -80, y: -890, spd: +90, swingHz: +0.09, swingAmt: +225 } ],
            [ 'Winder', { x:  -60, y: -860, spd: +90, swingHz: +0.09, swingAmt: +150 } ],
            [ 'Winder', { x:  -40, y: -830, spd: +90, swingHz: +0.09, swingAmt:  +75 } ],
            [ 'Winder', { x:    0, y: -800, spd: +90, swingHz:  0.09, swingAmt:    0 } ],
            [ 'Winder', { x:  +40, y: -830, spd: +90, swingHz: +0.09, swingAmt:  -75 } ],
            [ 'Winder', { x:  +60, y: -860, spd: +90, swingHz: +0.09, swingAmt: -150 } ],
            [ 'Winder', { x:  +80, y: -890, spd: +90, swingHz: +0.09, swingAmt: -225 } ],
            [ 'Winder', { x: +100, y: -920, spd: +90, swingHz: +0.09, swingAmt: -300 } ],
            [ 'Winder', { x: +120, y: -950, spd: +90, swingHz: +0.09, swingAmt: -375 } ],
            
            [ 'Drifter', { x: -500, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: -580, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: -640, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: -720, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: -800, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: -880, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            
            [ 'Drifter', { x: +500, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: +580, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: +640, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: +720, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: +800, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ],
            [ 'Drifter', { x: +880, y: -150, tx: 0, ty: -155, spd: 50, hp: 3, hpPerSec: 1.65, minSize: 16, sizeMult: 1.8 } ]
            
          ]},
          
          { dist: 3500, name: 'end', victory: true }
          
        ]
      }
    };
    
    let lobbyModelOptions = {
      joust: { name: 'Joust Man', size: [16,16], Cls: JoustMan },
      gun: { name: 'Gun Girl', size: [16,16], Cls: GunGirl },
      slam: { name: 'Slam Kid', size: [16,16], Cls: SlamKid },
      salvo: { name: 'Salvo Lad', size: [16,16], Cls: SalvoLad }
    };
    
    let open = async () => {
      
      let updateEntityAndGetBirth = (ms, game, entity, collideTeams) => {
        
        let rep = entity.rep;
        if (!rep) return [];
        
        let updateResult = rep.updateAndGetResult(ms, game, entity);
        let { birth=[] } = updateResult;
        let { /*x,*/ y, /*w,*/ h } = containingRect(updateResult);
        
        let hh = h >> 1;
        let visiDist = cnst.offscreenDist + hh;
        
        let maxYBotVisi = game.val.dist + cnst.offscreenDist + hh;
        let minYTopVisi = game.val.dist - cnst.offscreenDist - hh;
        
        let botY = y - hh;
        let topY = y + hh;
        
        let visible = botY <= maxYBotVisi && topY >= minYTopVisi;
        
        if (visible && !entity.sprite) {
          entity.sprite = flyHut.createRec('fly.sprite', [ game, entity ], rep.fluxState());
        } else if (!visible && entity.sprite) {
          entity.sprite.dry();
          entity.sprite = null;
        }
        
        if (rep.canCollide(ms)) {
          let team = rep.getTeam();
          if (!collideTeams.has(team)) collideTeams[team] = [];
          collideTeams[team].push({ entity, rep, ...updateResult });
        }
        
        return birth;
        
      };
      let containingRect = bound => {
        
        if (bound.form === 'rect') return bound;
        if (bound.form === 'circle') {
          let size = bound.r << 1;
          return { x: bound.x, y: bound.y, w: size, h: size };
        }
        
        return { x: bound.x, y: bound.y, w: 0, h: 0 };
        
      };
      
      let collisionUtil = {
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
            || collisionUtil.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w + roundingGap * 2, h: r.h })
            || collisionUtil.doCollidePointRect(c, { x: r.x, y: r.y, w: r.w, h: r.h + roundingGap * 2 })
            || collisionUtil.doCollidePointCircle(c, { x: r.x - hw, y: r.y - hh, r: roundingGap })
            || collisionUtil.doCollidePointCircle(c, { x: r.x + hw, y: r.y - hh, r: roundingGap })
            || collisionUtil.doCollidePointCircle(c, { x: r.x + hw, y: r.y + hh, r: roundingGap })
            || collisionUtil.doCollidePointCircle(c, { x: r.x - hw, y: r.y + hh, r: roundingGap })
          
        }
      };
      let doCollide = (bound1, bound2) => {
        
        if (bound1.form === bound2.form) {
          
          if (bound1.form === 'circle') return collisionUtil.doCollideCircle(bound1, bound2);
          if (bound1.form === 'rect') return collisionUtil.doCollideRect(bound1, bound2);
          
        } else {
          
          let [ rect=null, circle=null ] = collisionUtil.checkForms('rect', 'circle', bound1, bound2) || [];
          if (rect) return collisionUtil.doCollideRectCircle(rect, circle);
          
        }
        
        throw Error(`No method for colliding ${bound1.form} and ${bound2.form}`);
        
        /*
        return false;
        
        let [ bound1, bound2 ] = collisionUtil.checkForms('circle', 'circle');
        
        let checkForms = (form1, form2) => {
          if (colEnt1.form === form1 && colEnt2.form === form2) return true;
          if (colEnt1.form === form2 && colEnt2.form === form1) {
            [ colEnt1, colEnt2 ] = [ colEnt2, colEnt1 ];
            return true;
          }
          return false;
        };
        
        if (checkForms('circle', 'circle')) {
          let { x: x1, y: y1, r: r1 } = colEnt1;
          let { x: x2, y: y2, r: r2 } = colEnt2;
          
          let dx = x1 - x2;
          let dy = y1 - y2;
          let tr = r1 + r2;
          
          return (dx * dx + dy * dy) < (tr * tr);
        }
        if (checkForms('rect', 'rect')) {
          return true
            && Math.abs(colEnt1.x - colEnt2.x) < (colEnt1.w + colEnt2.w) * 0.5
            && Math.abs(colEnt1.y - colEnt2.y) < (colEnt1.h + colEnt2.h) * 0.5;
        }
        if (checkForms('circle', 'rect')) {
          
          
          
          
        }
        
        return false;
        
        throw Error(`Don't know how to check collision between ${colEnt1.form} and ${colEnt2.form}`);
        */
        
      };
      
      let flyHut = global.hut = await foundation.getRootHut({ heartMs: 1000 * 20 });
      flyHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('fly', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        
        real('content1', () => TextSized({ size: UnitPc(2) }));
        real('content2', () => TextSized({ size: UnitPc(1.5) }));
        real('content3', () => TextSized({ size: UnitPc(1) }));
        
        let centeredText = (name, cNames=[ 'content1', 'content2', 'content3' ]) => {
          for (let cName of cNames) insert(`${name} -> ${cName}`, sl => sl.getCenteredSlot());
        };
        
        // TODO: LinearSlotter provides *no size* for the list container
        // BUT sometimes we want a relatively-sized element inside the
        // list container - so like, the 3rd item in the list should be
        // 40% of the width of its container (with no relation to the
        // widths of its siblings). Ok... WRONG ENTIRELY. Use an
        // AxisSlotter, give it `FixedSize(UnitPc(0.4), ...)`!!
        
        real('lobbyChooser',        () => CenteredSlotter());
        real('lobbyChooserContent', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.4), UnitPc(0.3) ] }));
        real('lobbyNameField',      () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Name' }));
        real('lobbyChooserField',   () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Lobby code' }));
        real('lobbyChooserButton',  () => CenteredSlotter());
        insert('main -> lobbyChooser',                      () => FillParent());
        insert('lobbyChooser -> lobbyChooserContent',       sl => [ sl.getCenteredSlot(), FixedSize(UnitPc(0.8), UnitPc(0.8)) ]);
        insert('lobbyChooserContent -> lobbyNameField',     sl => sl.getAxisSlot(0));
        insert('lobbyChooserContent -> lobbyChooserField',  sl => sl.getAxisSlot(1));
        insert('lobbyChooserContent -> lobbyChooserButton', sl => sl.getAxisSlot(2));
        insert('lobbyChooserButton -> content1', sl => sl.getCenteredSlot());
        
        real('lobby', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.2), UnitPc(0.7) ] }));
        real('lobbyTitle', () => CenteredSlotter());
        real('lobbyBackButton', () => CenteredSlotter());
        real('teamList', () => LinearSlotter({ axis: 'y', dir: '+' }));
        centeredText('lobbyTitle');
        centeredText('lobbyBackButton');
        
        real('teamMember', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('playerName', () => CenteredSlotter());
        real('modelList', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('model', () => AxisSlotter({ axis: 'y', dir: '-', cuts: [ UnitPc(0.2) ] }));
        real('modelName', () => CenteredSlotter());
        real('score', () => CenteredSlotter());
        centeredText('playerName');
        centeredText('modelName');
        centeredText('score');
        insert('model -> modelName', sl => sl.getAxisSlot(0));
        insert('main -> lobby', () => FillParent());
        insert('lobby -> lobbyTitle',       sl => sl.getAxisSlot(0));
        insert('lobby -> teamList',         sl => sl.getAxisSlot(1));
        insert('lobby -> lobbyBackButton',  sl => sl.getAxisSlot(2));
        insert('teamList -> teamMember',    sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1), UnitPc(1/4)) ]);
        insert('teamMember -> playerName',  sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('teamMember -> modelList',   sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.7), UnitPc(1)) ]);
        insert('teamMember -> score',       sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.1), UnitPc(1)) ]);
        insert('modelList -> model', sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1/4), UnitPc(1)) ]);
        insert('playerName -> content1', sl => sl.getCenteredSlot());
        insert('score -> content1', sl => sl.getCenteredSlot());
        
        real('game', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.8) ] }));
        real('gameLInfo', () => CenteredSlotter());
        real('gameContent', () => Art({ pixelCount: [ 800, 1000 ] }));
        real('gameRInfo', () => CenteredSlotter());
        real('gameDispLives', () => TextSized({ size: UnitPc(0.8) }));
        insert('main -> game', () => FillParent());
        insert('game -> gameLInfo', sl => sl.getAxisSlot(0));
        insert('game -> gameContent', sl => sl.getAxisSlot(1));
        insert('game -> gameRInfo', sl => sl.getAxisSlot(2));
        insert('gameLInfo -> gameDispLives', sl => sl.getCenteredSlot());
        
        decals('lobbyTitle', { colour: 'rgba(0, 0, 0, 0.15)' });
        decals('teamList', { colour: 'rgba(0, 0, 0, 0.07)' });
        decals('lobbyChooserButton', { colour: '#d0d0d0' });
        decals('lobbyBackButton', { colour: 'rgba(0, 0, 0, 0.5)', textColour: '#ffffff' });
        decals('playerName', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('score', { colour: 'rgba(0, 0, 0, 0.2)' });
        decals('game', { colour: '#000000', textColour: '#ffffff' });
        decals('gameLInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        decals('gameRInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        
      });
      
      let webApp = WebApp('fly');
      await webApp.decorateHut(flyHut, rootReal);
      
      /// {ABOVE=
      let fly = flyHut.createRec('fly.fly', [ flyHut ]);
      let termBank = term.TermBank();
      
      let flyInfoDoc = foundation.getKeep('fileSystem', [ 'room', 'fly', 'info.html' ]);
      flyHut.roadNozz('fly.info').route(({ reply }) => reply(flyInfoDoc));
      
      let resourceKeep = foundation.getKeep('fileSystem', [ 'room', 'fly', 'resource' ]);
      let resourceNames = await resourceKeep.getContent();
      for (let rn of resourceNames) {
        let resource = resourceKeep.to(rn);
        flyHut.roadNozz(`fly.sprite.${rn.split('.')[0]}`).route(({ reply }) => reply(resource));
      }
      
      // Note that a commercial airliner flies at ~ 500 miles/hr, or 223 meters/sec
      
      let testLobby = null;
      let testGame = null;
      let doTesting = false;
      // TEST::doTesting = true;
      if (doTesting) {
        testLobby = flyHut.createRec('fly.lobby', [ fly ], { id: 'TEST', allReadyMs: null });
        testGame = flyHut.createRec('fly.game', [ fly, testLobby ], {
          lives: 100, dist: 0, ms: foundation.getMs(), aheadSpd: initialAheadSpd
        });
        testGame.victory = false;
      }
      /// =ABOVE}
      
      let rootScp = RecScope(flyHut, 'fly.fly', async (fly, dep) => {
        
        /// {ABOVE=
        
        // Manage Huts
        dep.scp(flyHut, 'lands.kidHut/par', ({ members: { kid: hut } }, dep) => {
          
          let kidHutDep = dep;
          let { value: term } = dep(termBank.checkout());
          let player = dep(flyHut.createRec('fly.player', [], { term, name: null, score: 0 }));
          let hutPlayer = flyHut.createRec('fly.hutPlayer', [ hut, player ]);
          
          let lobbyPlayerNozz = player.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          dep.scp(lobbyPlayerDryNozz, (noGame, dep) => {
            
            // Players outside of Lobbies can edit their name
            dep(hut.roadNozz('lobbySetName').route(({ msg: { name } }) => player.modVal(v => v.gain({ name }))));
            
            // Players outside of Lobbies can join a Lobby
            dep(hut.roadNozz('joinLobby').route(({ msg: { lobbyId=null } }) => {
              
              // If id is specified, join that specific Lobby. Otherwise
              // create a new Lobby
              
              let lobby = null;
              if (lobbyId) {
                let allLobbies = fly.relNozz('fly.lobby').set.toArr(v => v);
                let findLobby = allLobbies.find(l => l.val.id === lobbyId);
                if (!findLobby) throw Error('Invalid lobby id');
                lobby = findLobby[0];
              } else {
                let randInt = Math.floor(Math.random() * Math.pow(62, 4));
                lobby = flyHut.createRec('fly.lobby', [ fly ], {
                  // The id used to get into the lobby
                  id: `${U.base62(randInt).padHead(4, '0')}`,
                  
                  // The time in millis all Players signalled ready (or
                  // `null`, if a Player isn't ready)
                  allReadyMs: null
                });
              }
              
              if (lobby.relNozz('fly.lobbyPlayer').set.size >= 4) throw Error('Lobby full');
              
              flyHut.createRec('fly.lobbyPlayer', [ lobby, player ], { model: null });
              
            }));
            
          });
          
          // Follows
          let followFn = (v, dep) => dep(hut.followRec(v));
          followFn(fly, dep);
          followFn(hutPlayer, dep);
          dep.scp(player, 'fly.gamePlayer', (gamePlayer, dep) => {
            dep.scp(gamePlayer, 'fly.gamePlayerEntity', followFn);
          });
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            // Follow Lobby, all LobbyPlayers, the Game, and all Sprites
            // that are visible within the Game
            
            let lobby = myLobbyPlayer.members['fly.lobby'];
            
            dep(hut.followRec(lobby));
            
            dep.scp(lobby, 'fly.lobbyPlayer', followFn);
            dep.scp(lobby, 'fly.game', (game, dep) => {
              
              // Follow the GamePlayer
              dep.scp(game, 'fly.gamePlayer', followFn);
              
              // Follow Entities and Sprites when we can see the Sprite
              dep.scp(game, 'fly.entity', (e, dep) => dep.scp(e, 'fly.sprite', followFn));
              
            });
            
          });
          
          // TODO: The following Error produces a weird "cannot read property 'tell'..." error:
          // throw Error('HAH');
          
          let doTest = false;
          // TEST::doTest = true;
          if (!doTest || hut.uid.length !==3) return; // Accept the 3-letter uids from quadTest
          
          player.modVal(v => (v.name = 'testy', v));
          let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null });
          let gamePlayer = flyHut.createRec('fly.gamePlayer', [ testGame, player ], { deaths: 0, damage: 0 });
          
          
          let rep = repClasses['SlamKid']({ name: 'testy' });
          rep.y = testGame.val.dist;
          let aceEntity = flyHut.createRec('fly.entity', [ testGame ], { ...rep.permState(), ...rep.normState() });
          console.log('ENTITY:', aceEntity.val);
          aceEntity.controls = { x: 0, y: 0, a1: false, a2: false };
          aceEntity.rep = rep;
          aceEntity.deadRep = null;
          
          // Connect this Entity to the GamePlayer
          let gpe = flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, aceEntity ]);
          aceEntity.drierNozz().route(() => console.log('ENT DEAD!!'));
          gpe.drierNozz().route(() => console.log('GPE DEAD!!'));
          
        });
        
        // Lobby
        dep.scp(fly, 'fly.lobby', (lobby, dep) => {
          
          let lobbyPlayerNozz = lobby.relNozz('fly.lobbyPlayer');
          
          // Make a LivingSet, tracking LobbyPlayers
          let lobbyPlayers = Set();
          let lobbyPlayersNozz = Nozz();
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            lobbyPlayers.add(lobbyPlayer);
            lobbyPlayersNozz.drip(lobbyPlayers);
            
            dep(Drop(null, () => {
              lobbyPlayers.rem(lobbyPlayer);
              lobbyPlayersNozz.drip(lobbyPlayers);
            }));
          });
          
          // Make a LivingSet, tracking LobbyPlayers who are Ready
          let readyPlayers = Set();
          let readyPlayersNozz = Nozz();
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            dep(lobbyPlayer.route(({ model }) => {
              readyPlayers[model ? 'add' : 'rem'](lobbyPlayer);
              readyPlayersNozz.drip(readyPlayers);
            }));
            
            dep(Drop(null, () => {
              readyPlayers.rem(lobbyPlayer);
              readyPlayersNozz.drip(readyPlayers);
            }));
          });
          
          // Nozzes to track if the start countdown is running
          let allPlayersReadyNozz = dep(CondNozz({ numLobby: lobbyPlayersNozz, numReady: readyPlayersNozz }, args => {
            return (args.numLobby.size > 0 && args.numLobby.size === args.numReady.size) ? 'ready' : C.skip;
          }, { numLobby: Set(), numReady: Set() }));
          let notAllPlayersReadyNozz = dep(TubDry(null, allPlayersReadyNozz));
          
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            let player = lobbyPlayer.members['fly.player'];
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              let hut = hutPlayer.members['lands.hut'];
              
              dep.scp(notAllPlayersReadyNozz, (notReady, dep) => {
                
                // When some Players aren't ready models can be set
                // freely, and Players can exit the Lobby freely
                
                dep(hut.roadNozz('lobbySetModel').route(({ msg: { model } }) => lobbyPlayer.modVal(v => v.gain({ model }))));
                dep(hut.roadNozz('lobbyExit').route(() => lobbyPlayer.dry()));
                
              });
              dep.scp(allPlayersReadyNozz, (allReady, dep) => {
                
                // When all Players are Ready, the model can only be set
                // to `null` (unreadying the Player), and exiting the
                // Lobby resets all Player's models to `null`
                
                dep(hut.roadNozz('lobbySetModel').route(() => lobbyPlayer.modVal(v => v.gain({ model: null }))));
                dep(hut.roadNozz('lobbyExit').route(() => {
                  lobbyPlayer.dry();
                  for (let lp of lobbyPlayers) lp.modVal(v => v.gain({ model: null }));
                }));
                
              });
              
            });
            
          });
          
          dep.scp(notAllPlayersReadyNozz, (notReady, dep) => {
            lobby.modVal(v => v.gain({ allReadyMs: null }));
          });
          dep.scp(allPlayersReadyNozz, (ready, dep) => {
            
            // When all Players are ready we modify the Lobby indicating
            // the Game is starting, and begin a Game after 5000ms
            lobby.modVal(v => v.gain({ allReadyMs: foundation.getMs() }));
            let timeout = setTimeout(() => {
              let game = flyHut.createRec('fly.game', [ fly, lobby ], { 
                lives: 3, dist: 0, ms: foundation.getMs(), aheadSpd: initialAheadSpd, respawns: 10
              });
              game.victory = false;
              
              let ms = foundation.getMs();
              let lobbyPlayers = lobby.relNozz('fly.lobbyPlayer').set;
              for (let lobbyPlayer of lobbyPlayers) {
                let player = lobbyPlayer.members['fly.player'];
                let gamePlayer = flyHut.createRec('fly.gamePlayer', [ game, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                let rep = lobbyModelOptions[model].Cls({ name: player.val.name, x: Math.round(Math.random() * 200 - 100), y: -200 });
                
                let entity = flyHut.createRec('fly.entity', [ game ], { ...rep.permState(), ...rep.normState() });
                entity.controls = { x: 0, y: 0, a1: false, a2: false };
                entity.rep = rep;
                entity.deadRep = null;
                
                flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, entity ]);
              }
              for (let lobbyPlayer of lobbyPlayers) lobbyPlayer.modVal(v => (v.model = null, v));
            }, gameStartingDelay);
            dep(Drop(null, () => clearTimeout(timeout)));
            
          });
          
        });
        
        // Game Controls per Player
        dep.scp(fly, 'fly.game', (game, dep) => { dep.scp(game, 'fly.gamePlayer', (gp, dep) => {
          
          // Get a GamePlayerEntity and a HutPlayer at the same time.
          // Overall commands from the HutPlayer's Hut effect the
          // GamePlayerEntity's Entity!
          let player = gp.members['fly.player'];
          dep.scp(gp, 'fly.gamePlayerEntity', ({ members: { 'fly.entity': entity } }, dep) => {
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              
              let hut = hutPlayer.members['lands.hut'];
              dep(hut.roadNozz('keys').route(({ msg: { keyVal } }) => {
                
                // Will contain "left", "right", "up", "down", "act1", "act2"
                let keys = [];
                for (let i = 0; i < 6; i++) keys.push((keyVal & (1 << i)) >> i);
                
                let vx = keys[1] - keys[0];
                let vy = keys[2] - keys[3];
                entity.controls = { x: vx, y: vy, a1: !!keys[4], a2: !!keys[5] };
                
              }));
              
            });
          
          });
          
        })});
        
        // Game
        dep.scp(fly, 'fly.game', (game, dep) => {
          
          let level = 'plains';
          let moments = levels[level].moments.toArr(v => v);
          
          let entities = game.relNozz('fly.entity').set;
          let gamePlayers = game.relNozz('fly.gamePlayer').set;
          let momentTotalDist = 0;
          
          if (testLevel) {
            console.log(`TESTING: ${testLevel}`);
            moments = moments.slice(moments.find(v => v.name === testLevel)[1]);
            let distInc = moments[0].dist * 0.99;
            game.modVal(v => (v.dist = distInc, v));
          }
          
          let interval = setInterval(() => {
            
            let entitySnapshot = [ ...entities ];
            
            // Update all Entities
            let ms = foundation.getMs();
            let collideTeams = {};
            let tickBirth = [];
            for (let e of entitySnapshot) {
              tickBirth.gain(updateEntityAndGetBirth(ms, game, e, collideTeams));
            }
            
            // Collide all Teams against each together
            collideTeams = collideTeams.toArr(v => v);
            let len = collideTeams.length;
            for (let i = 0; i < len - 1; i++) { for (let j = i + 1; j < len; j++) {
              
              for (let colEnt1 of collideTeams[i]) { for (let colEnt2 of collideTeams[j]) {
                
                if (!colEnt1.rep.isAlive(ms, game) || !colEnt2.rep.isAlive(ms, game)) continue;
                
                // There should be "collideHead" and "collideTail".
                // The head is the "instigating" collider. The priority
                // of collisions is (filtering out dead Entities at
                // every step):
                // 
                // Entity1 | Entity2 | Collision priority          
                // --------|---------|-----------------------------
                // ht      | ht      | Lower (Enemy hits Enemy)    
                // ht      | h       | n/a                         
                // ht      | t       | Lower (Enemy hits Ace)      
                // ht      | /       | n/a                         
                // h       | ht      | Highest (bullet hits enemy) 
                // h       | h       | n/a                         
                // h       | t       | Highest (bullet hits ace)   
                // h       | /       | n/a                         
                // t       | ht      | n/a                         
                // t       | h       | n/a                         
                // t       | t       | n/a                         
                // t       | /       | n/a                         
                // /       | ht      | n/a                         
                // /       | h       | n/a                         
                // /       | t       | n/a                         
                // /       | /       | n/a                         
                
                // Render order:
                // 1st: Background
                // 2nd: Ground units
                // 3rd: Anything in the air with no specific priority, (aces, enemies, bullets)
                // 4th: Explosions/debris
                // 5th: Decals; clouds/rain, etc
                
                // Entity2 | Render order
                // --------|-------------
                // ht      | Medium
                // h       | Medium
                // t       | Medium
                // /       | Dynamic! (bg 1st, explosions medium, clouds/rain last)
                
                // E.g. of "ht"? Enemies: damagING and damagABLE
                // E.g. of "h"? Bullets: damagING, but can't be hit
                // E.g. of "t"? Ace. Aren't intended to hit anything, but damagABLE
                // E.g. of "/"? Terrain tiles
                //
                // Note that the left column needs to contain a "h", and
                // the right column needs to contain a "t", for a
                // collision to be possible in the first place
                
                if (doCollide(colEnt1, colEnt2)) {
                  colEnt1.rep.collide(colEnt2.rep);
                  colEnt2.rep.collide(colEnt1.rep);
                }
                
              }}
              
            }}
            
            // Dry and Upd all Entities as is appropriate
            for (let e of entitySnapshot) {
              
              if (!e.rep) continue;
              
              if (!e.rep.isAlive(ms, game)) {
                
                let dieResult = e.rep.dieAndGetResult();
                tickBirth.gain(dieResult.birth);
                
                if (U.isInspiredBy(e.rep, Ace)) {
                  
                  if (e.sprite) { e.sprite.dry(); e.sprite = null; }
                  
                  // Keep track of the old Rep (for scoring)
                  e.deadRep = e.rep;
                  e.rep = null;
                  
                  game.modVal(v => (v.lives--, v));
                  if (game.val.lives >= 0) {
                    setTimeout(() => {
                      let AceCls = e.deadRep.constructor;
                      e.rep = AceCls({ name: e.deadRep.name, x: 0, y: game.val.dist - 200 });
                      e.rep.scoreDamage = e.deadRep.scoreDamage;
                      e.rep.scoreDeath = e.deadRep.scoreDeath;
                      e.deadRep = null;
                    }, Ace.respawnMs);
                  }
                  
                } else {
                  
                  e.dry();
                  
                }
                
                continue;
                
              }
              
              if (e.sprite) {
                // Update the sprite if flux has new values
                let fluxState = e.rep.fluxState();
                if (fluxState.find((v, k) => v !== e.sprite.val[k])) e.sprite.modVal(v => v.gain(fluxState));
              }
              
              // Update the entity if norm has new values
              let normState = e.rep.normState();
              if (normState.find((v, k) => v !== e.val[k])) e.modVal(v => v.gain(normState));
              
            }
            
            if (Math.random() < 0.01) console.log(`Processed ${entitySnapshot.length} Entities in ${foundation.getMs() - ms}ms`);
            
            // Do global updates! The Game moves Ahead...
            game.modVal(v => (v.dist += v.aheadSpd * spf, v.ms = ms, v));
            
            for (let newRep of tickBirth) {
              let entity = flyHut.createRec('fly.entity', [ game ], { ...newRep.permState(), ...newRep.normState() });
              entity.rep = newRep;
            }
            
            // Check for loss: are all GamePlayerEntities missing Reps?
            if (game.val.lives < 0) {
              for (let gp of gamePlayers) {
                for (let gpe of gp.relNozz('fly.gamePlayerEntity').set) {
                  let ent = gpe.members['fly.entity'];
                  let rep = ent.rep || ent.deadRep;
                  gp.members['fly.player'].modVal(v => (v.score = rep.scoreDamage, v));
                }
              }
              game.dry();
            }
            
            // TEST::
            // if (moments.isEmpty()) {
            //   let dist = game.val.dist;
            //   moments = levels[level].moments.toArr(v => v);
            //   game.modVal(v => (v.dist = 0, v));
            //   momentTotalDist = 0;
            //   for (let e of entities) {
            //     if (e.val.has('y')) e.modVal(v => (v.y -= dist, v));
            //     for (let s of e.relNozz('fly.sprite').set) {
            //       if (s.val.has('y')) s.modVal(v => (v.y -= dist, v));
            //     }
            //   }
            // }
            
            // We may encounter the next Moment. If we haven't reached
            // it yet, stop processing right here.
            if (moments.isEmpty() || game.val.dist < (momentTotalDist + moments[0].dist)) return;
            
            // We hit a new Moment! Shift it off the Array of Moments
            let { dist, name='anonMoment', entities: momentEntities=[], victory=false } = moments.shift();
            momentTotalDist += dist;
            
            console.log('New moment:', name);
            for (let [ name, args ] of momentEntities) {
              let rep = repClasses[name]({ ms, game, relDist: momentTotalDist, ...args });
              let entity = flyHut.createRec('fly.entity', [ game ], { ...rep.permState(), ...rep.normState() });
              entity.rep = rep;
            }
            
            if (victory) {
              game.victory = true;
              game.val.aheadSpd = 300;
              
              setTimeout(() => {
                
                // Store damage done by each player
                for (let gp of gamePlayers) {
                  for (let gpe of gp.relNozz('fly.gamePlayerEntity').set) {
                    let ent = gpe.members['fly.entity'];
                    let rep = ent.rep;
                    gp.members['fly.player'].modVal(v => (v.score = rep ? rep.scoreDamage : 0, v));
                  }
                }
                
                game.dry();
                
              }, 3000);
              
            }
            
          }, spf * 1000);
          dep(Drop(null, () => clearInterval(interval)));
          
        });
        
        /// =ABOVE} {BELOW=
        
        global.fly = fly;
        dep(Drop(null, () => { delete global.fly; }));
        
        let flyRootReal = dep(rootReal.techReals[0].addReal('fly.root'));
        let mainReal = flyRootReal.addReal('fly.main');
        
        // Lobby
        dep.scp(flyHut, 'fly.hutPlayer', (myHutPlayer, dep) => {
          
          let myPlayer = myHutPlayer.members['fly.player'];
          let lobbyPlayerNozz = myPlayer.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          
          dep.scp(lobbyPlayerDryNozz, (noLobbyPlayer, dep) => {
            
            let lobbyChooserReal = dep(mainReal.addReal('fly.lobbyChooser'));
            let content = lobbyChooserReal.addReal('fly.lobbyChooserContent');
            let nameReal = content.addReal('fly.lobbyNameField');
            let lobbyIdFieldReal = content.addReal('fly.lobbyChooserField');
            let buttonReal = content.addReal('fly.lobbyChooserButton');
            let buttonRealContent = buttonReal.addReal('fly.content1');
            
            // Typing in a Lobby name attempts to join that Lobby.
            // Leaving it blank creates a new Lobby
            lobbyIdFieldReal.textNozz().route(val => {
              buttonRealContent.setText(val ? 'Join Lobby' : 'New Lobby');
            });
            
            // Player name syncs through the name field
            myPlayer.route(({ name }) => nameReal.setText(name || ''));
            nameReal.textNozz().route(name => flyHut.tell({ command: 'lobbySetName', name }));
            
            buttonReal.feelNozz().route(v => {
              flyHut.tell({ command: 'joinLobby', lobbyId: lobbyIdFieldReal.textNozz().val });
            });
            
          });
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            let myPlayer = myLobbyPlayer.members['fly.player'];
            let lobby = myLobbyPlayer.members['fly.lobby'];
            
            let lobbyReal = dep(mainReal.addReal('fly.lobby'));
            let lobbyTitle = lobbyReal.addReal('fly.lobbyTitle').addReal('fly.content1');
            let teamListReal = lobbyReal.addReal('fly.teamList');
            
            dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => {
              
              let isMine = lobbyPlayer === myLobbyPlayer;
              
              let player = lobbyPlayer.members['fly.player'];
              let teamMemberReal = dep(teamListReal.addReal('fly.teamMember'));
              let nameReal = teamMemberReal.addReal('fly.playerName').addReal('fly.content2');
              
              let modelListReal = teamMemberReal.addReal('fly.modelList');
              let scoreReal = teamMemberReal.addReal('fly.score').addReal('fly.content3');
              
              let modelReals = lobbyModelOptions.map(({ name }, model) => {
                
                let modelReal = modelListReal.addReal('fly.model');
                modelReal.addReal('fly.modelName').addReal('fly.content3').setText(name);
                modelReal.setImage(
                  foundation.getKeep('urlResource', { path: `fly.sprite.ace${model[0].upper()}${model.slice(1)}` }),
                  { smoothing: false, scale: 0.6 }
                );
                
                if (isMine) {
                  dep(modelReal.feelNozz().route(() => {
                    flyHut.tell({ command: 'lobbySetModel', model: model === lobbyPlayer.val.model ? null : model });
                  }));
                }
                
                return modelReal;
                
              });
              
              teamMemberReal.setColour(isMine ? '#f8c0a0' : '#f0f0f0');
              
              dep(player.route(({ name, score }) => {
                nameReal.setText(name || '<anon>')
                scoreReal.setText(`Dmg:\n${Math.round(score) * 100}`);
              }));
              dep(lobbyPlayer.route(({ model, score }) => {
                modelReals.forEach((modelReal, k) => {
                  modelReal.setBorder(k === model ? UnitPx(10) : UnitPx(0), isMine ? '#ff9000' : '#a8a8a8');
                });
              }));
              
            });
            
            let startCountdownNozz = dep(CondNozz({ lobby }, (args, condNozz) => {
              let { allReadyMs } = args.lobby;
              if (!allReadyMs) return C.skip;
              condNozz.dryContents();
              return allReadyMs;
            }));
            
            // Set the title of the Lobby based on readiness
            dep(lobby.route(({ allReadyMs }) => lobbyTitle.setText(allReadyMs ? `Starting...` : `Lobby @ [${lobby.val.id}]`)));
            
            dep.scp(startCountdownNozz, (starting, dep) => {
              
              let allReadyMs = starting.result;
              let interval = setInterval(() => {
                
                let ms = foundation.getMs();
                let amt = (ms - allReadyMs) / gameStartingDelay; // where 5000 is the delay before a Game starts
                
                if (amt < 1) {
                  lobbyReal.setOpacity(Math.pow(1 - amt, 1.5));
                } else {
                  lobbyReal.setOpacity(0);
                  clearInterval(interval);
                }
                
              }, gameStartingDelay / 10);
              
              dep(Drop(null, () => { lobbyReal.setOpacity(null); clearInterval(interval); }));
              
            });
            
            let lobbyBackButton = lobbyReal.addReal('fly.lobbyBackButton');
            dep(lobbyBackButton.feelNozz().route(() => flyHut.tell({ command: 'lobbyExit' })));
            lobbyBackButton.addReal('fly.content3').setText(`Leave Lobby`);
            
            let myGamePlayerNozz = myPlayer.relNozz('fly.gamePlayer');
            let myGamePlayerDryNozz = dep(TubDry(null, myGamePlayerNozz));
            dep.scp(myGamePlayerDryNozz, (noGamePlayer, dep) => {
              lobbyReal.setTangible(true);
              lobbyReal.setOpacity(null);
            });
            dep.scp(myGamePlayerNozz, (myGamePlayer, dep) => lobbyReal.setTangible(false));
            
          });
          
        });
        
        // Game
        dep.scp(flyHut, 'fly.hutPlayer', ({ members: { 'fly.player': p } }, dep) => dep.scp(p, 'fly.gamePlayer', (gp, dep) => {
          
          dep.scp(gp, 'fly.gamePlayerEntity', (gpe, dep) => {
            
            flyRootReal.setColour('#000000');
            dep(Drop(null, () => flyRootReal.setColour(null)));
            
            let game = gp.members['fly.game'];
            let myEntity = gpe.members['fly.entity'];
            let sprites = game.relNozz('fly.sprite').set;
            
            let gameContainerReal = dep(mainReal.addReal('fly.game'));
            let lInfoReal = gameContainerReal.addReal('fly.gameLInfo');
            let rInfoReal = gameContainerReal.addReal('fly.gameRInfo');
            
            let dispLivesReal = lInfoReal.addReal('fly.gameDispLives');
            dep(game.route(({ lives }) => dispLivesReal.setText(`[${lives}]`)));
            
            let gameReal = gameContainerReal.addReal('fly.gameContent');
            
            let { draw, keys } = gameReal;
            
            // Listen to our keys
            dep(keys.nozz.route(keys => {
              
              // A: 65, D: 68, W: 87, S: 83, <: 188, >: 190
              let keyNums = [ 65, 68, 87, 83, 188, 190 ];
              let keyVal = 0;
              for (let i = 0; i < keyNums.length; i++) keyVal += keys.has(keyNums[i]) ? (1 << i) : 0;
              flyHut.tell({ command: 'keys', keyVal });
              
            }));
            
            let panVal = util.fadeVal(0, 0.19);
            let doDraw = () => {
              
              let [ mySprite=null ] = myEntity.relNozz('fly.sprite').set;
              
              let { pxW, pxH } = draw.getDims();
              draw.rect(0, 0, pxW, pxH, { fillStyle: `rgba(225, 220, 255, 1)` });
              draw.frame(() => { draw.trn(pxW >> 1, -(pxH >> 1)); draw.frame(() => {
                
                //draw.scl(0, 0.99);
                //draw.scl(1, -1);
                
                let wantedPanVal = -0.22 * (mySprite ? mySprite.val.x : 0);
                draw.trn(panVal.to(wantedPanVal), 0);
                draw.trn(0, -game.val.dist); // We want to ADD to `hh` in order to translate everything downwards (things are very far up; we translate far up as a result)
                
                let renders = [];
                let set = Set();
                for (let sprite of sprites) {
                  if (set.has(sprite)) throw Error(`Wtf, double iterate sprite??`);
                  set.add(sprite);
                  
                  let entity = sprite.members['fly.entity'];
                  let renderVals = { ...entity.val, ...sprite.val };
                  let Cls = repClasses[entity.val.type];
                  renders.push({
                    uid: entity.uid,
                    priority: Cls.renderPriority ? Cls.renderPriority(renderVals) : 0.5,
                    render: [ Cls, renderVals ]
                  });
                }
                
                renders = renders.sort((v1, v2) => v2.priority - v1.priority);
                for (let { render: [ Cls, vals ] } of renders) Cls.render(draw, game, vals);
                
              })});
              
            };
            
            let drawing = true;
            dep(Drop(null, () => drawing = false));
            let drawLoop = () => requestAnimationFrame(() => drawing && (doDraw(), drawLoop()));
            drawLoop();
            
          });
          
        }));
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
