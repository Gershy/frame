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
      offscreenDist: 520,
      distToConsiderEnemyClear: 700
    };
    let util = {
      fadeAmt: (v1, v2, amt) => v1 * (1 - amt) + v2 * amt
    };
    
    let fps = 30;
    let spf = 1 / fps;
    let badN = (...vals) => vals.find(v => !U.isType(v, Number) || isNaN(v));
    
    // BASE STUFF
    let Entity = U.inspire({ name: 'Entity', insps: {}, methods: (insp, Insp) => ({
      init: function({ ms=foundation.getMs() }={}) {
        this.ms = ms;
      },
      isAlive: function() { return true; },
      canCollide: function() { return false; },
      collide: function(rep) {},
      
      // Get the state in various ways. The "perm" state may never ever
      // change for an Entity. The "norm" state may change now and then.
      // The "flux" state may change constantly.
      permState: function() { return { type: U.nameOf(this), ms: this.ms }; },
      normState: function() { return {}; },
      fluxState: function() { return {}; },
      updateAndGetResult: C.noFn('updateAndGetResult')
    })});
    let Mortal = U.inspire({ name: 'Mortal', insps: {}, methods: (insp, Insp) => ({
      init: function({ hp=1 }) { this.hp = hp; },
      isAlive: function() { return this.hp > 0; }
    })});
    let Geom = U.inspire({ name: 'Geom', insps: { Entity }, methods: (insp, Insp) => ({
      init: function({ ...args }) {
        insp.Entity.init.call(this, args);
        this.x = 0; this.y = 0;
      },
      fluxState: function() { return { x: this.x, y: this.y }; }
    })});
    
    // GOOD GUYS
    let Ace = U.inspire({ name: 'Ace', insps: { Geom, Mortal }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y }, imageKeep=null) => {
        draw.circ(x, -y, 16, { fillStyle: 'rgba(100, 0, 0, 0.2)' });
        if (imageKeep) draw.image(imageKeep, x, -y, 16, 16);
      },
      
      init: function({ ...args }={}) {
        insp.Geom.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.spd = 300;
        this.slowMarks = Set();
      },
      canCollide: function() { return true; /* Maybe short invulnerability after respawn? */ },
      collide: function(rep) {  },
      getTeam: function() { return +1; },
      updateAndGetResult: function(ms, game, entity) {
        
        let spd = this.spd;
        for (let slowMark of this.slowMarks) {
          if (ms > slowMark.mark) this.slowMarks.rem(slowMark);
          else                    spd *= slowMark.amt;
        }
        
        let { x: cx, y: cy, a1, a2 } = entity.controls;
        
        let vx, vy;
        if (cx && cy) {
          let div = spd / Math.sqrt(cx * cx + cy * cy);
          vx = cx * div;
          vy = cy * div;
        } else {
          vx = cx * spd;
          vy = cy * spd;
        }
        
        vy += game.val.aheadSpd;
        if (vx || vy) { this.x += vx * spf; this.y += vy * spf; }
        
        if (this.x > +400) this.x = +400;
        if (this.x < -400) this.x = -400;
        if (this.y > game.val.dist + 300) this.y = game.val.dist + 300;
        if (this.y < game.val.dist - 500) this.y = game.val.dist - 500;
        
        return { birth: [], form: 'axisRect', x: this.x, y: this.y, w: 16, h: 16 };
        
      },
      isAlive: insp.Mortal.isAlive
      
    })});
    let JoustMan = U.inspire({ name: 'JoustMan', insps: { Ace }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: `fly.sprite.joust` }),
      $render: (draw, game, args) => {
        if (U.dbgCnt('joustArgs') === 1) console.log('JOUST:', args);
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep);
        let { x, y, w1Mark, w1State, w2Ammo } = args;
        
        let bar1H = w1Mark ? Math.min(1, (game.val.ms - w1Mark) / Insp.w1Charge3Ms) * 20 : 0;
        let bar1W = w1State === 3 ? 10 : 8;
        let col = [
          'rgba(0, 0, 0, 1)',         // Punished
          'rgba(0, 255, 255, 0.7)',   // Side shot
          'rgba(180, 180, 0, 0.75)', // Reload
          'rgba(0, 255, 255, 0.8)'   // Laser!!
        ][w1State];
        
        draw.rect(x - bar1W * 0.5, -((y - 8) + bar1H), bar1W, bar1H, { fillStyle: col });
        
        let bar2W = (w2Ammo / Insp.w2MaxAmmo) * 16;
        draw.rect(x - bar2W * 0.5, -(y - 10), bar2W, 4, { fillStyle: '#0000ff' });
      },
      
      $w1ChargePunishSlow: 0.4, $w1ChargePunishMs: 2000,
      $w1Charge1Ms: 1000, $w1Charge2Ms: 3000, $w1Charge3Ms: 6000, // How many millis of charging for various jousts
      $w2MaxAmmo: 50, $w2Delay: 110, $w2Damage: 1,
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        this.w1Mark = null; // Marks when charging began
        this.w1State = 0; // Integer indicating power
        this.w2Mark = null; // Marks when the last bullet was fired
        this.w2Ammo = Insp.w2MaxAmmo;
      },
      normState: function() { return { w1Mark: this.w1Mark, w1State: this.w1State, w2Ammo: this.w2Ammo }; },
      updateAndGetResult: function(ms, game, entity) {
        
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
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
              this.slowMarks.add({ mark: ms + Insp.w1ChargePunishMs, amt: Insp.w1ChargePunishSlow });
              // PUNISHED! HOLD TOO SHORT!!
            } else if (this.w1State === 1) {
              // Weapon 1 act 1: sideways jousts
            } else if (this.w1State === 2) {
              // Weapon 1 act 2: reload!
              this.w2Ammo = Insp.w2MaxAmmo;
            } else if (this.w1State === 3) {
              // Weapon 1 act 3: BIG LASER
              supResult.birth.gain([ JoustManLaserVert({ joustMan: this }) ]);
              this.slowMarks.add({ mark: ms + JoustManLaserVert.durationMs, amt: 0.5 });
            }
            
            this.w1State = 0;
            this.w1Mark = 0;
            
          }
          
        }
        
        // Activate weapon 2
        if (entity.controls.a2 && this.w2Ammo > 0) {
          
          let elapsed = ms - (this.w2Mark || 0);
          if (elapsed > Insp.w2Delay) {
            
            // Enforce a cooldown
            this.w2Mark = ms;
            
            // Subtract the bullet
            this.w2Ammo = this.w2Ammo - 1;
            
            supResult.birth.gain([
              SimpleBullet({ team: this.getTeam(), x: this.x - 4, y: this.y, spd: 700, dmg: 1, w: 2, h: 20, lifespanMs: 3000 }),
              SimpleBullet({ team: this.getTeam(), x: this.x + 4, y: this.y, spd: 700, dmg: 1, w: 2, h: 20, lifespanMs: 3000 })
            ]);
            
          }
          
        }
        
        return supResult;
        
      }
      
    })});
    let GunGirl = U.inspire({ name: 'GunGirl', insps: { Ace }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: `fly.sprite.gun` }),
      $render: (draw, game, args) => {
        if (U.dbgCnt('joustArgs') === 1) console.log('JOUST:', args);
        Insp.parents.Ace.render(draw, game, args, Insp.imageKeep);
      },
      
      $w1Delay: 80, $w1Dmg: 0.5, $w1LockoutMs: 1000,
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, { args });
        this.w1Mark = this.ms - Insp.w1Delay; // Marks when last bullet fired
        this.w1StartMark = null;
        this.w1LockMark = this.ms - Insp.w1LockoutMs; // Marks when shooting last stopped
      },
      normState: function() { return {}; },
      updateAndGetResult: function(ms, game, entity) {
        
        let supResult = insp.Ace.updateAndGetResult.call(this, ms, game, entity);
        
        if (entity.controls.a1) {
          
          let lockedOut = this.w1LockMark + Insp.w1LockoutMs > ms;
          let reloading = this.w1Mark + Insp.w1Delay > ms;
          
          console.log({ lockedOut, reloading });
          
          if (!lockedOut && !reloading) {
            
            if (!this.w1StartMark) this.w1StartMark = ms;
            let timeShooting = ms - this.w1StartMark;
            
            let ang;
            if (timeShooting < 500) {
              let timeInStep = timeShooting;
              let stepDur = 500;
              ang = util.fadeAmt(0, -0.01, timeInStep / stepDur);
            } else if (timeShooting < 1500) {
              let timeInStep = timeShooting - 500;
              let stepDur = 1000;
              ang = util.fadeAmt(-0.01, 0.05, timeInStep / stepDur);
            } else if (timeShooting < 4000) {
              let timeInStep = timeShooting - 1500;
              let stepDur = 2500;
              ang = util.fadeAmt(0.05, 0.3, timeInStep / stepDur);
            } else {
              ang = 0.3;
            }
            
            // Sweep in, to -0.01, then out, all the way to 0.3
            
            
            supResult.birth.gain([
              DirectedBullet({ team: this.getTeam(), x: this.x - 4, y: this.y, ang: -ang, spd: 800, dmg: Insp.w1Dmg, w: 4, h: 4, lifespanMs: 2800 }),
              DirectedBullet({ team: this.getTeam(), x: this.x + 4, y: this.y, ang: +ang, spd: 800, dmg: Insp.w1Dmg, w: 4, h: 4, lifespanMs: 2800 })
            ]);
            
          }
          
        } else {
          
          if (this.w1StartMark) { // Just stopped shooting! Lockout!
            
          }
          
        }
        
        if (entity.controls.a2) {}
        
        return supResult;
        
      }
      
    })});
    let SlamKid = U.inspire({ name: 'SlamKid', insps: { Ace }, methods: (insp, Insp) => ({
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, { args });
      }
    })});
    let SalvoLad = U.inspire({ name: 'SalvoLad', insps: { Ace }, methods: (insp, Insp) => ({
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, { args });
      }
    })});
    
    let JoustManLaserVert = U.inspire({ name: 'JoustManLaserVert', insps: { Geom }, methods: (insp, Insp) => ({
      
      $durationMs: 3000, $dps: 10,
      $render: (draw, game, { x, y }) => {
        let w = 26;
        let h = 1200;
        draw.rectCen(x, -y, w, h, { fillStyle: 'rgba(0, 255, 255, 0.8)' });
        draw.rectCen(x, -y, w - 8, h, { fillStyle: 'rgba(255, 255, 255, 0.5)' });
      },
      
      init: function({ joustMan, ...args }={}) {
        insp.Geom.init.call(this, args);
        this.joustMan = joustMan;
      },
      getTeam: function() { return +1; },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        rep.hp -= Insp.dps * spf;
      },
      updateAndGetResult: function(ms, game, entity) {
        this.x = this.joustMan.x;
        this.y = this.joustMan.y + 600;
        return { birth: [], form: 'axisRect', x: this.x, y: this.y, w: 22, h: 1200 }
      },
      isAlive: function(ms, game) {
        return this.joustMan.isAlive(ms, game) && (ms - this.ms) < Insp.durationMs;
      }
      
    })});
    
    // BAD GUYS
    let Enemy = U.inspire({ name: 'Enemy', insps: { Geom, Mortal }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y }) => {
        draw.circ(x, -y, 20, { fillStyle: 'rgba(0, 0, 255, 1)' });
      },
      
      init: function({ game, relDist=0, x, y, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.hp = 1;
        this.x = x; this.y = relDist + y;
        this.w = 40; this.h = 40;
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
        return { birth: [], form: 'axisRect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: insp.Mortal.isAlive
      
    })});
    let Winder = U.inspire({ name: 'Winder', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $render: (draw, game, args) => {
        Insp.parents.Enemy.render(draw, game, args);
      },
      
      init: function({ spd=100, swingHz=2, swingAmt=100, phase=0, ...args }) {
        insp.Enemy.init.call(this, args);
        this.spd = spd;
        this.swingHz = swingHz;
        this.swingAmt = swingAmt;
        this.phase = phase * Math.PI * 2;
        this.initX = this.x;
      },
      updateAndGetResult: function(ms, game, entity) {
        let supResult = insp.Enemy.updateAndGetResult.call(this, ms, game, entity);
        this.y += (game.val.aheadSpd + this.spd) * spf;
        this.x = this.initX + Math.sin(this.phase + (ms - this.ms) * 0.002 * Math.PI * this.swingHz) * this.swingAmt;
        return supResult;
      },
      isAlive: function(ms, game) {
        if (!insp.Enemy.isAlive.call(this, ms, game)) return false;
        
        //console.log(this.spd, this.y >= (game.val.dist - cnst.distToConsiderEnemyClear));
        //return true;
        
        return (this.spd < 0)
          ? (this.y >= (game.val.dist - cnst.distToConsiderEnemyClear))
          : (this.y <= (game.val.dist + cnst.distToConsiderEnemyClear));
        
        // if (!(this.spd < 0)
        //   ? (this.y < (game.val.dist - cnst.distToConsiderEnemyClear))
        //   : (this.y > (game.val.dist + cnst.distToConsiderEnemyClear))) {
        //   console.log(`Winder is DEAD ${this.spd}, ${this.y}, ${game.val.dist - cnst.distToConsiderEnemyClear}`);
        // }
        // 
        // return (this.spd < 0)
        //   ? (this.y < (game.val.dist - cnst.distToConsiderEnemyClear))
        //   : (this.y > (game.val.dist + cnst.distToConsiderEnemyClear));
      }
      
    })});
    
    let WinderMom = U.inspire({ name: 'WinderMom', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y }) => {
        draw.rectCen(x, -y, 160, 200, { fillStyle: '#707070' });
      },
      
      init: function({ tx=0, ty=20, spd=20, spawnMs=3000, spawnArgs={}, relDist=0, ...args }) {
        insp.Enemy.init.call(this, { relDist, ...args });
        this.hp = 90;
        this.spd = spd;
        this.w = 160; this.h = 200;
        
        this.spawnMs = spawnMs;
        this.spawnMark = this.ms + this.spawnMs;
        this.spawnArgs = spawnArgs;
        
        this.tx = tx; this.ty = ty;
        
        let dx = (this.tx - this.x);
        let dy = ((this.ty + relDist) - this.y);
        
        let tSpd = this.spd / Math.sqrt(dx * dx + dy * dy);
        this.vx = dx * tSpd;
        this.vy = dy * tSpd;
      },
      updateAndGetResult: function(ms, game, entity) {
        
        let supResult = insp.Enemy.updateAndGetResult.call(this, ms, game, entity);
        
        this.x += this.vx * spf;
        this.y += (this.vy + game.val.aheadSpd) * spf;
        
        let tx = this.tx;
        let ty = this.ty + game.val.dist;
        
        if (this.vx > 0 && this.x > tx) this.x = tx;
        if (this.vx < 0 && this.x < tx) this.x = tx;
        if (this.vy > 0 && this.y > ty) this.y = ty;
        if (this.vy < 0 && this.y < ty) this.y = ty;
        
        if (ms >= this.spawnMark) {
          
          let args = {
            y: 0, spd: 60, swingHz: 0.22, swingAmt: 300,
            ...this.spawnArgs
          };
          
          if (Math.random() > 50) { args.x = this.x - 80; args.swingAmt *= +1; }
          else                    { args.x = this.x + 80; args.swingAmt *= -1; }
          
          args.y += this.y;
          
          supResult.birth.gain([ Winder(args) ]);
          
          this.spawnMark = ms + this.spawnMs;
          
        }
        
        return supResult;
        
      }
      
    })});
    
    let Drifter = U.inspire({ name: 'Drifter', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $render: (draw, game, args) => {
        Insp.parents.Enemy.render(draw, game, args);
      },
      
      init: function({ ...args }) {
        insp.Enemy.init.call(this, args);
      }
    })});
    
    // UTIL
    let SimpleBullet = U.inspire({ name: 'SimpleBullet', insps: { Geom }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, w, h }) => {
        draw.rectCen(x, y, w, h, { fillStyle: '#ff0000' });
      },
      
      init: function({ team, x, y, spd=700, dmg=1, w=4, h=50, lifespanMs=3000, ...args }) {
        insp.Geom.init.call(this, args);
        this.team = team;
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        this.spd = spd;
        this.dmg = dmg;
        this.lifespanMs = lifespanMs;
      },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        rep.hp -= this.dmg;
        this.lifespanMs = 0;
      },
      getTeam: function() { return this.team; },
      permState: function() {
        return {
          ...insp.Geom.permState.call(this),
          w: this.w, h: this.h
        };
      },
      updateAndGetResult: function(ms, game, entity) {
        this.y += (game.val.aheadSpd + this.spd) * spf;
        return { birth: [], form: 'axisRect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: function(ms) { return (ms - this.ms) < this.lifespanMs; }
      
    })});
    let DirectedBullet = U.inspire({ name: 'DirectedBullet', insps: { Geom }, methods: (insp, Insp) => ({
      
      $render: (draw, game, { x, y, w, h }) => {
        // Shifting the Bullet forward feels more satisfying
        draw.rectCen(x, -y, w, h, { fillStyle: '#000000' });
      },
      init: function({ team, x, y, ang=0, spd=700, dmg=1, w=4, h=50, lifespanMs=3000, ...args }) {
        insp.Geom.init.call(this, args);
        this.team = team;
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        this.dmg = dmg;
        this.lifespanMs = lifespanMs;
        
        //this.spd = spd; this.ang = ang;
        this.vy = spd * Math.cos(ang * Math.PI * 2);
        this.vx = spd * Math.sin(ang * Math.PI * 2);
      },
      canCollide: function() { return true; },
      collide: function(rep) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        rep.hp -= this.dmg;
        this.lifespanMs = 0;
      },
      getTeam: function() { return this.team; },
      permState: function() {
        return {
          ...insp.Geom.permState.call(this),
          w: this.w, h: this.h
        };
      },
      updateAndGetResult: function(ms, game, entity) {
        this.x += this.vx * spf;
        this.y += (game.val.aheadSpd + this.vy) * spf;
        return { birth: [], form: 'axisRect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: function(ms) { return (ms - this.ms) < this.lifespanMs; }
      
    })});
    
    let repClasses = {};
    repClasses.gain({ JoustMan, GunGirl, SlamKid, SalvoLad });
    repClasses.gain({ JoustManLaserVert });
    repClasses.gain({ Winder, WinderMom, Drifter });
    repClasses.gain({ SimpleBullet, DirectedBullet });
    
    let lobbyModelOptions = {
      
      joust: { name: 'Joust Man', size: [16,16], Cls: JoustMan },
      gun: { name: 'Gun Girl', size: [16,16], Cls: GunGirl },
      slam: { name: 'Slam Kid', size: [16,16], Cls: SlamKid },
      salvo: { name: 'Salvo Lad', size: [16,16], Cls: SalvoLad }
      
    };
    let levels = {
      plains: {
        moments: [
          { dist: 300, name: 'scouts1', entities: [
            [ 'Winder', { x: -120, y: +620, spd: -100, swingHz: 0.22, swingAmt: -150 } ],
            [ 'Winder', { x: -40, y: +600, spd: -100, swingHz: 0.25, swingAmt: -150 } ],
            [ 'Winder', { x: +40, y: +600, spd: -100, swingHz: 0.25, swingAmt: +150 } ],
            [ 'Winder', { x: +120, y: +620, spd: -100, swingHz: 0.22, swingAmt: +150 } ]
          ]},
          { dist: 550, name: 'scouts2', entities: [
            [ 'Winder', { x: -300, y: +640, spd: -100, swingHz: 0.22, swingAmt: -100 } ],
            [ 'Winder', { x: -180, y: +620, spd: -130, swingHz: 0.18, swingAmt: -300 } ],
            [ 'Winder', { x: -60, y: +600, spd: -100, swingHz: 0.22, swingAmt: -100 } ],
            
            [ 'Winder', { x: +60, y: +600, spd: -100, swingHz: 0.22, swingAmt: +100 } ],
            [ 'Winder', { x: +180, y: +620, spd: -130, swingHz: 0.18, swingAmt: +300 } ],
            [ 'Winder', { x: +300, y: +640, spd: -100, swingHz: 0.22, swingAmt: +100 } ],
          ]},
          { dist: 550, name: 'scouts3', entities: [
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
          { dist: 500, name: 'sideswipe1', entities: [
            
            [ 'Winder', { x: -800, y: +300, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -720, y: +320, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -640, y: +340, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            [ 'Winder', { x: -560, y: +360, spd: -120, swingHz: 0.03, swingAmt: +1200 } ],
            
          ]},
          { dist: 200, name: 'sideswipe2', entities: [
            
            [ 'Winder', { x: -800, y: +250, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -720, y: +290, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -640, y: +330, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            [ 'Winder', { x: -560, y: +370, spd: -210, swingHz: 0.06, swingAmt: +1200 } ],
            
          ]},
          { dist: 100, name: 'sideswipe3', entities: [
            
            [ 'Winder', { x: +1000, y: +300, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +920, y: +340, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +840, y: +380, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            [ 'Winder', { x:  +760, y: +420, spd: -210, swingHz: 0.06, swingAmt: -1200 } ],
            
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
          { dist: 350, name: 'sideswipe5', entities: [
            
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
            [ 'Winder', { x: -360, y: -600, spd: +100, swingHz: 0.15, swingAmt: 300 } ],
            [ 'Winder', { x: -240, y: -680, spd: +100, swingHz: 0.10, swingAmt: 300 } ],
            [ 'Winder', { x: -120, y: -760, spd: +100, swingHz: 0.05, swingAmt: 300 } ],
            [ 'Winder', { x:   +0, y: -600, spd: +100, swingHz: 0.00, swingAmt: 0 } ],
            [ 'Winder', { x: +120, y: -760, spd: +100, swingHz: 0.05, swingAmt: 300 } ],
            [ 'Winder', { x: +240, y: -680, spd: +100, swingHz: 0.10, swingAmt: 300 } ],
            [ 'Winder', { x: +360, y: -600, spd: +100, swingHz: 0.15, swingAmt: 300 } ],
            
          ]},
          { dist: 500, name: 'mom', entities: [
            
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
          { dist: 800, name: 'mom2', entities: [
            
            [ 'WinderMom', { x: -400, y: +650, tx: -150, ty: +250, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } } ],
            [ 'WinderMom', { x: +400, y: +650, tx: +150, ty: +250, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } } ],
            
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
            
          ]}
        ]
      }
    };
    
    let open = async () => {
      
      let updateEntity = (ms, game, entity, collideTeams) => {
        
        let rep = entity.rep;
        let updateResult = rep.updateAndGetResult(ms, game, entity);
        let { birth=[], y, h } = updateResult;
        
        let hh = h >> 1;
        let visiDist = cnst.offscreenDist + hh;
        let dist = game.val.dist;
        let visible = (y < (dist + visiDist)) && (y > (dist - visiDist));
        if (visible && !entity.sprite) {
          entity.sprite = flyHut.createRec('fly.sprite', [ game, entity ], rep.fluxState());
        } else if (!visible && entity.sprite) {
          entity.sprite.dry();
          entity.sprite = null;
        }
        
        for (let newRep of birth) {
          let entity = flyHut.createRec('fly.entity', [ game ], { ...newRep.permState(), ...newRep.normState() });
          entity.rep = newRep;
        }
        
        if (rep.canCollide()) {
          let team = rep.getTeam();
          if (!collideTeams.has(team)) collideTeams[team] = [];
          collideTeams[team].push({ entity, rep, ...updateResult });
        }
        
      };
      let doCollide = (colEnt1, colEnt2) => {
        
        let checkForms = (form1, form2) => {
          if (colEnt1.form === form1 && colEnt2.form === form2) return true;
          if (colEnt1.form === form2 && colEnt2.form === form1) {
            [ colEnt1, colEnt2 ] = [ colEnt2, colEnt1 ];
            return true;
          }
          return false;
        };
        
        if (checkForms('axisRect', 'axisRect')) {
          return true
            && Math.abs(colEnt1.x - colEnt2.x) < (colEnt1.w + colEnt2.w) * 0.5
            && Math.abs(colEnt1.y - colEnt2.y) < (colEnt1.h + colEnt2.h) * 0.5;
        }
        
        throw Error(`Don't know how to check collision between ${colEnt1.form} and ${colEnt2.form}`);
        
      };
      let renderSprite = (draw, game, entity, sprite) => {
        if (!repClasses.has(entity.val.type)) throw Error(`Missing class for ${entity.val.type}`);
        if (!repClasses[entity.val.type].render) throw Error(`No render defined for ${entity.val.type}`);
        repClasses[entity.val.type].render(draw, game, { ...entity.val, ...sprite.val });
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
        real('model', () => CenteredSlotter());
        real('score', () => CenteredSlotter());
        centeredText('playerName');
        centeredText('model');
        centeredText('score');
        insert('main -> lobby', () => FillParent());
        insert('lobby -> lobbyTitle',       sl => sl.getAxisSlot(0));
        insert('lobby -> teamList',         sl => sl.getAxisSlot(1));
        insert('lobby -> lobbyBackButton',  sl => sl.getAxisSlot(2));
        insert('teamList -> teamMember',    sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1), UnitPc(1/4)) ]);
        insert('teamMember -> playerName',  sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('teamMember -> modelList',   sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.7), UnitPc(1)) ]);
        insert('teamMember -> score',       sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.1), UnitPc(1)) ]);
        insert('modelList -> model', sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1/4), UnitPc(1)) ]);
        insert('model -> content2', sl => sl.getCenteredSlot());
        insert('playerName -> content1', sl => sl.getCenteredSlot());
        insert('score -> content1', sl => sl.getCenteredSlot());
        
        real('game', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.8) ] }));
        real('gameLInfo', () => CenteredSlotter());
        real('gameContent', () => Art({ pixelCount: [ 800, 1000 ] }));
        real('gameRInfo', () => CenteredSlotter());
        insert('main -> game', () => FillParent());
        insert('game -> gameLInfo', sl => sl.getAxisSlot(0));
        insert('game -> gameContent', sl => sl.getAxisSlot(1));
        insert('game -> gameRInfo', sl => sl.getAxisSlot(2));
        
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
      
      let testLobby = flyHut.createRec('fly.lobby', [ fly ], { id: 'TEST', allReadyMs: null });
      let testGame = flyHut.createRec('fly.game', [ fly, testLobby ], {
        dist: 0, ms: foundation.getMs(), aheadSpd: 100, respawns: 10
      });
      /// =ABOVE}
      
      let rootScp = RecScope(flyHut, 'fly.fly', async (fly, dep) => {
        
        /// {ABOVE=
        
        // Manage Huts
        dep.scp(flyHut, 'lands.kidHut/par', ({ members: { kid: hut } }, dep) => {
          
          let kidHutDep = dep;
          let { value: term } = dep(termBank.checkout());
          let player = dep(flyHut.createRec('fly.player', [], { term, name: null }));
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
              
              flyHut.createRec('fly.lobbyPlayer', [ lobby, player ], { model: null, score: 0 });
              
            }));
            
          });
          
          // Follows
          let followFn = (v, dep) => dep(hut.followRec(v));
          followFn(fly, dep);
          followFn(hutPlayer, dep);
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
          
          // TEST
          if (hut.uid.length !== 3) return; // Accept the 3-letter uids from quadTest
          
          player.modVal(v => (v.name = 'testy', v));
          let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null, score: 0 });
          let gamePlayer = flyHut.createRec('fly.gamePlayer', [ testGame, player ], { deaths: 0, damage: 0 });
          
          let rep = repClasses['GunGirl']({ name: 'testy' });
          let aceEntity = flyHut.createRec('fly.entity', [ testGame ], { ...rep.permState(), ...rep.normState() });
          aceEntity.controls = { x: 0, y: 0, a1: false, a2: false };
          aceEntity.rep = rep;
          
          // Connect this Entity to the GamePlayer
          flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, aceEntity ]);
          
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
            
            /*
            // LobbyPlayers can change their model and readiness until
            // the Game begins
            let lobby = lobbyPlayer.members['fly.lobby'];
            let lobbyGameNozz = lobby.relNozz('fly.game');
            let lobbyGameDryNozz = dep(TubDry(null, lobbyGameNozz));
            
            dep.scp(allPlayersReadyNozz, (allReady, dep) => {
              
              
              
              
            });
            
            dep.scp(lobbyGameDryNozz, (noGame, dep) => {
              dep(hut.roadNozz('lobbySetModel').route(({ msg: { model } }) => {
                lobbyPlayer.modVal(v => v.gain({ model }));
              }));
              dep(hut.roadNozz('lobbyExit').route(() => {
                // When a Player exits their LobbyPlayer
                lobbyPlayer.dry();
                lobbyPlayers.forEach(lp => lp.modVal(v => v.gain({ model: null })));
              }));
            });
            */
            
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
                dist: 0, ms: foundation.getMs(), aheadSpd: 100, respawns: 10
              });
              let ms = foundation.getMs();
              for (let lobbyPlayer of lobby.relNozz('fly.lobbyPlayer').set) {
                let player = lobbyPlayer.members['fly.player'];
                let gamePlayer = flyHut.createRec('fly.gamePlayer', [ game, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                let rep = lobbyModelOptions[model].Cls({ name: player.val.name });
                rep.x = Math.round(Math.random() * 200 - 100);
                
                let entity = flyHut.createRec('fly.entity', [ game ], { ...rep.permState(), ...rep.normState() });
                entity.rep = rep;
                
                flyHut.createRec('fly.gamePlayerEntity', [ gamePlayer, entity ]);
              }
            }, 5000);
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
          
          // TEST::moments.reverse(); moments[0].dist = 0;
          
          let entities = game.relNozz('fly.entity').set;
          let momentTotalDist = 0;
          
          let interval = setInterval(() => {
            
            // Update all Entities
            let ms = foundation.getMs();
            let collideTeams = {};
            for (let e of entities) updateEntity(ms, game, e, collideTeams);
            
            // Collide all Teams against each together
            collideTeams = collideTeams.toArr(v => v);
            let len = collideTeams.length;
            for (let i = 0; i < len - 1; i++) { for (let j = i + 1; j < len; j++) {
              
              for (let colEnt1 of collideTeams[i]) { for (let colEnt2 of collideTeams[j]) {
                
                if (!colEnt1.rep.isAlive(ms, game) || !colEnt2.rep.isAlive(ms, game)) continue;
                
                if (doCollide(colEnt1, colEnt2)) {
                  colEnt1.rep.collide(colEnt2.rep);
                  colEnt2.rep.collide(colEnt1.rep);
                }
                
              }}
              
            }}
            
            // Dry and Upd all Entities as is appropriate
            for (let e of entities) {
              
              if (!e.rep.isAlive(ms, game)) { e.dry(); continue; }
              
              if (e.sprite) {
                // Update the sprite if flux has new values
                let fluxState = e.rep.fluxState();
                if (fluxState.find((v, k) => v !== e.sprite.val[k])) e.sprite.modVal(v => v.gain(fluxState));
              }
              
              // Update the entity if norm has new values
              let normState = e.rep.normState();
              if (normState.find((v, k) => v !== e.val[k])) e.modVal(v => v.gain(normState));
              
            }
            
            if (Math.random() < 0.01) console.log(`Processed ${entities.size} Entities in ${foundation.getMs() - ms}ms`);
            
            // Do global updates! The Game moves Ahead...
            game.modVal(v => (v.dist += v.aheadSpd * spf, v.ms = ms, v));
            
            // We may encounter the next Moment. If we haven't reached
            // it yet, stop processing right here.
            if (moments.isEmpty() || game.val.dist < (momentTotalDist + moments[0].dist)) return;
            
            // We hit a new Moment! Shift it off the Array of Moments
            let { dist, name='anonMoment', entities: momentEntities=[] } = moments.shift();
            momentTotalDist += dist;
            
            console.log('ENTERED MOMENT:', name);
            
            for (let [ name, args ] of momentEntities) {
              let rep = repClasses[name]({ ms, game, relDist: momentTotalDist, ...args });
              let entity = flyHut.createRec('fly.entity', [ game ], { ...rep.permState(), ...rep.normState() });
              entity.rep = rep;
            }
            
            // TODO: When does a Level end???
            
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
                modelReal.addReal('fly.content3').setText(name);
                
                if (isMine) {
                  dep(modelReal.feelNozz().route(() => {
                    flyHut.tell({ command: 'lobbySetModel', model: model === lobbyPlayer.val.model ? null : model });
                  }));
                }
                
                return modelReal;
                
              });
              
              teamMemberReal.setColour(isMine ? '#f8c0a0' : '#f0f0f0');
              
              dep(player.route(({ name }) => nameReal.setText(name || '<anon>')));
              dep(lobbyPlayer.route(({ model, score }) => {
                
                scoreReal.setText(`${score} Pts`);
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
                let amt = (ms - allReadyMs) / 5000; // where 5000 is the delay before a Game starts
                
                if (amt < 1) {
                  lobbyReal.setOpacity(Math.pow(1 - amt, 1.5));
                } else {
                  lobbyReal.setOpacity(0);
                  clearInterval(interval);
                }
                
              }, 500);
              
              dep(Drop(null, () => { lobbyReal.setOpacity(null); clearInterval(interval); }));
              
            });
            
            let lobbyBackButton = lobbyReal.addReal('fly.lobbyBackButton');
            dep(lobbyBackButton.feelNozz().route(() => flyHut.tell({ command: 'lobbyExit' })));
            lobbyBackButton.addReal('fly.content3').setText(`Leave Lobby`)
            
            let myGamePlayerNozz = myPlayer.relNozz('fly.gamePlayer');
            let myGamePlayerDryNozz = dep(TubDry(null, myGamePlayerNozz));
            dep.scp(myGamePlayerDryNozz, (noGamePlayer, dep) => lobbyReal.setTangible(true));
            dep.scp(myGamePlayerNozz, (myGamePlayer, dep) => lobbyReal.setTangible(false));
            
          });
          
        });
        dep.scp(flyHut, 'fly.hutPlayer', ({ members: { 'fly.player': p } }, dep) => dep.scp(p, 'fly.gamePlayer', (gp, dep) => {
          
          flyRootReal.setColour('#000000');
          dep(Drop(null, () => rootReal.setColour(null)));
          
          let game = gp.members['fly.game'];
          let sprites = game.relNozz('fly.sprite').set;
          
          let gameContainerReal = dep(mainReal.addReal('fly.game'));
          let lInfoReal = gameContainerReal.addReal('fly.gameLInfo');
          let rInfoReal = gameContainerReal.addReal('fly.gameRInfo');
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
          
          let doDraw = () => {
            
            let { pxW, pxH } = draw.getDims();
            draw.rect(0, 0, pxW, pxH, { fillStyle: `rgba(200, 180, 255, 1)` });
            draw.frame(() => { draw.trn(pxW >> 1, pxH >> 1); draw.frame(() => {
              
              draw.trn(0, +game.val.dist); // We want to ADD to `hh` in order to translate everything downwards (things are very far up; we translate far up as a result)
              
              for (let sprite of sprites) renderSprite(draw, game, sprite.members['fly.entity'], sprite);
              
            })});
            
          };
          
          let drawing = true;
          dep(Drop(null, () => drawing = false));
          let drawLoop = () => requestAnimationFrame(() => drawing && (doDraw(), drawLoop()));
          drawLoop();
          
        }));
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
