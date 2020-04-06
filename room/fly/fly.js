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
    
    let fps = 40; // Server-side ticks per second
    let levelStartingDelay = 1000; // Give players this long to unready
    let initialAheadSpd = 100;
    let testAces = [ 'JoustMan', 'GunGirl', 'SlamKid', 'SalvoLad' ];
    let testing = {
      lives: 10,
      levelName: 'impendingFields',
      momentName: 'scout1',
      ace: testAces[Math.floor(Math.random() * testAces.length)]
    };
    let badN = (...vals) => vals.find(v => !U.isType(v, Number) || isNaN(v));
    let checkBadN = obj => obj.forEach((v, k) => { if (badN(v)) throw Error(`BAD VAL AT ${k} (${U.nameOf(v)}, ${v})`); });
    
    let levels = {
      rustlingMeadow: { num: 0, name: 'Rustling Meadow', password: '',
        desc: util.paragraph(`
          Soft grass underfoot. Joust Man watches over his fellow Aces. Gun Girl lies back,
          absorbing sun, Slam Kid devours his sandwich, and a gust of wind tousles Salvo Lad's mane
          of hair. There is nothing like a picnic with the gang. Suddenly all four perk up. A
          whining reaches their ears, far off and tiny, like the buzz of wasp wings. "Back in your
          ships!" blares Joust Man. His eyes narrow as he turns from the sunlit field to his
          death-delivering fighter jet. Wasps bring stingers. A grim thought runs through his mind:
          "It Is Happening Again"
        `),
        winText: util.paragraph(`
          "Bogies destroyed!" yells Salvo Lad. "Those ship's markings looked Yemenese!" shouts back
          Slam Kid over the comms. "But Yemen would never stir up trouble in this region..." Gun
          Girl has an uneasy note in her voice. Joust Man's eyes narrow. "Squad, it's time we paid
          a visit to our friend the Governor." His eyes were narrowing further still. Governor
          Stalbureaux was not likely to take kindly to their V1s1T1NG.
        `),
        moments: [
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, 
            bounds: { total: { w: 240, h: 300 }, player: { x: 0, y: 0, w: 240, h: 300 } },
            models: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, 
            bounds: { total: { w: 260, h: 325 }, player: { x: 0, y: 0, w: 260, h: 325 } },
            models: []
          },
          { name: 'winder1', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100, 
            bounds: { total: { w: 280, h: 350 }, player: { x: 0, y: 0, w: 280, h: 350 } },
            models: [
              { type: 'Winder', x: -60, y: +150, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:   0, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +60, y: +150, spd: -50, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'winder2', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100, 
            models: [
              { type: 'Winder', x: -60, y: +150, spd: -50, swingHz: 0.05, swingAmt: -50 },
              { type: 'Winder', x:   0, y: +100, spd: -50, swingHz:    0, swingAmt:   0 },
              { type: 'Winder', x: +60, y: +150, spd: -50, swingHz: 0.05, swingAmt: +50 }
            ]
          },
          { name: 'winder3', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100, 
            models: [
              { type: 'Winder', x: -100, y: +150, spd: -50, swingHz: 0.05, swingAmt: +50 },
              { type: 'Winder', x:  -50, y: +200, spd: -50, swingHz: 0.07, swingAmt: -50 },
              { type: 'Winder', x:    0, y: +100, spd: -50, swingHz:    0, swingAmt:   0 },
              { type: 'Winder', x:  +50, y: +200, spd: -50, swingHz: 0.07, swingAmt: +50 },
              { type: 'Winder', x: +100, y: +150, spd: -50, swingHz: 0.05, swingAmt: -50 }
            ]
          },
          { name: 'winder4', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100, 
            models: [
              { type: 'Winder', x: -100, y: +150, spd:  -50, swingHz: 0.055, swingAmt: +60 },
              { type: 'Winder', x:  -50, y: +200, spd:  -50, swingHz: 0.075, swingAmt: -70 },
              { type: 'Winder', x:    0, y: +300, spd: -100, swingHz:     0, swingAmt:   0 },
              { type: 'Winder', x:  +50, y: +200, spd:  -50, swingHz: 0.075, swingAmt: +70 },
              { type: 'Winder', x: +100, y: +150, spd:  -50, swingHz: 0.055, swingAmt: -60 }
            ]
          },
          { name: 'winder5', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            models: [
              { type: 'Winder', x: -200, y: 0, spd: -50, swingHz: 0.055, swingAmt: +100 },
              { type: 'Winder', x: -30, y: +150, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +30, y: +150, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +200, y: 0, spd: -50, swingHz: 0.055, swingAmt: -100 },
            ]
          },
          { name: 'winder6', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            models: [
              { type: 'Winder', x: -350, y: +100, spd: -50, swingHz: 0.050, swingAmt: +270 },
              { type: 'Winder', x: -300, y:  +50, spd: -50, swingHz: 0.050, swingAmt: +240 },
              { type: 'Winder', x: -250, y:    0, spd: -50, swingHz: 0.050, swingAmt: +210 },
              { type: 'Winder', x: -200, y:  -50, spd: -50, swingHz: 0.050, swingAmt: +180 },
              
              { type: 'Winder', x: +350, y: +100, spd: -50, swingHz: 0.050, swingAmt: -270 },
              { type: 'Winder', x: +300, y:  +50, spd: -50, swingHz: 0.050, swingAmt: -240 },
              { type: 'Winder', x: +250, y:    0, spd: -50, swingHz: 0.050, swingAmt: -210 },
              { type: 'Winder', x: +200, y:  -50, spd: -50, swingHz: 0.050, swingAmt: -180 }
            ]
          },
          { name: 'winder7', type: 'MomentAhead', terrain: 'meadow', dist: 750, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            models: [
              { type: 'Winder', x: -120, y: +100, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -120, y: +130, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -120, y: +160, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -120, y: +190, spd: -150, swingHz: 0.08, swingAmt: +22 },
              
              { type: 'Winder', x: +40, y: +300, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +40, y: +330, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +40, y: +360, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +40, y: +390, spd: -150, swingHz: 0.08, swingAmt: -22 },
              
              { type: 'Winder', x: -70, y: +500, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -70, y: +530, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -70, y: +560, spd: -150, swingHz: 0.08, swingAmt: +22 },
              { type: 'Winder', x: -70, y: +590, spd: -150, swingHz: 0.08, swingAmt: +22 },
              
              { type: 'Winder', x: +90, y: +600, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +90, y: +630, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +90, y: +660, spd: -150, swingHz: 0.08, swingAmt: -22 },
              { type: 'Winder', x: +90, y: +690, spd: -150, swingHz: 0.08, swingAmt: -22 }
            ]
          },
          { name: 'winder8', type: 'MomentAhead', terrain: 'meadow', dist: 750, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            models: [
              { type: 'Winder', x: -120, y: +100, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: -120, y: +130, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: -120, y: +160, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: -120, y: +190, spd: -185, swingHz: 0.12, swingAmt: -22 },
              
              { type: 'Winder', x: +40, y: +300, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: +40, y: +330, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: +40, y: +360, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: +40, y: +390, spd: -185, swingHz: 0.12, swingAmt: +22 },
              
              { type: 'Winder', x: -70, y: +500, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: -70, y: +530, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: -70, y: +560, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: -70, y: +590, spd: -185, swingHz: 0.12, swingAmt: -22 },
              
              { type: 'Winder', x: +90, y: +600, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: +90, y: +630, spd: -185, swingHz: 0.12, swingAmt: +22 },
              { type: 'Winder', x: +90, y: +660, spd: -185, swingHz: 0.12, swingAmt: -22 },
              { type: 'Winder', x: +90, y: +690, spd: -185, swingHz: 0.12, swingAmt: +22 }
            ]
          },
          { name: 'weaver1', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            models: [
              
              { type: 'Weaver', x: -100, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +100, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: +250, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +220, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +120, y: +250, spd: -50, swingHz: 0, swingAmt: 0 },
              
            ]
          },
          { name: 'weaver2', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            models: [
              { type: 'Winder', x: -150, y: +450, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -50, y: +440, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +50, y: +440, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +150, y: +450, spd: -100, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: +190, spd: -50, swingHz: 0.10, swingAmt: -20 },
              { type: 'Weaver', x:  -40, y: +170, spd: -50, swingHz: 0.08, swingAmt: -20 },
              { type: 'Weaver', x:  +40, y: +170, spd: -50, swingHz: 0.08, swingAmt: +20 },
              { type: 'Weaver', x: +120, y: +190, spd: -50, swingHz: 0.10, swingAmt: +20 },
              
              { type: 'Weaver', x: -120, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  -40, y:  +85, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  +40, y:  +85, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +120, y: +100, spd: -50, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'weaver3', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            models: [
              { type: 'Winder', x: -150, y: +450, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -75, y: +440, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:    0, y: +430, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +75, y: +440, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +150, y: +450, spd: -150, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: +190, spd: -50, swingHz: 0.10, swingAmt: -20 },
              { type: 'Weaver', x:  -40, y: +170, spd: -50, swingHz: 0.08, swingAmt: -20 },
              { type: 'Weaver', x:  +40, y: +170, spd: -50, swingHz: 0.08, swingAmt: +20 },
              { type: 'Weaver', x: +120, y: +190, spd: -50, swingHz: 0.10, swingAmt: +20 },
              
              { type: 'Weaver', x: -160, y: +100, spd: -50, swingHz: 0.10, swingAmt: -15 },
              { type: 'Weaver', x:  -80, y:  +85, spd: -50, swingHz: 0.08, swingAmt: -15 },
              { type: 'Weaver', x:    0, y:  +70, spd: -50, swingHz: 0.00, swingAmt:   0 },
              { type: 'Weaver', x:  +80, y:  +85, spd: -50, swingHz: 0.08, swingAmt: +15 },
              { type: 'Weaver', x: +160, y: +100, spd: -50, swingHz: 0.10, swingAmt: +15 },
              
              { type: 'Winder', x: -100, y: -500, spd: +40, swingHz: 0.1, swingAmt: +50 },
              { type: 'Winder', x: +100, y: -500, spd: +40, swingHz: 0.1, swingAmt: -50 }
            ]
          },
          { name: 'weaver4', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            models: [
              { type: 'Winder', x: -150, y: +450, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -75, y: +440, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:    0, y: +430, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +75, y: +440, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +150, y: +450, spd: -150, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: +190, spd: -50, swingHz: 0.10, swingAmt: -20 },
              { type: 'Weaver', x:  -40, y: +170, spd: -50, swingHz: 0.08, swingAmt: -20 },
              { type: 'Weaver', x:  +40, y: +170, spd: -50, swingHz: 0.08, swingAmt: +20 },
              { type: 'Weaver', x: +120, y: +190, spd: -50, swingHz: 0.10, swingAmt: +20 },
              
              { type: 'Weaver', x: -160, y: +100, spd: -50, swingHz: 0.10, swingAmt: -15 },
              { type: 'Weaver', x:  -80, y:  +85, spd: -50, swingHz: 0.08, swingAmt: -15 },
              { type: 'Weaver', x:    0, y:  +70, spd: -50, swingHz: 0.00, swingAmt:   0 },
              { type: 'Weaver', x:  +80, y:  +85, spd: -50, swingHz: 0.08, swingAmt: +15 },
              { type: 'Weaver', x: +160, y: +100, spd: -50, swingHz: 0.10, swingAmt: +15 },
              
              { type: 'Winder', x: -180, y: -500, spd: +40, swingHz: 0.05, swingAmt: +65 },
              { type: 'Winder', x: -100, y: -550, spd: +40, swingHz: 0.05, swingAmt: +35 },
              { type: 'Winder',  x: -20, y: -600, spd: +40, swingHz: 0.05, swingAmt:  +5 },
              { type: 'Winder',  x: +20, y: -600, spd: +40, swingHz: 0.05, swingAmt:  -5 },
              { type: 'Winder', x: +100, y: -550, spd: +40, swingHz: 0.05, swingAmt: -35 },
              { type: 'Winder', x: +180, y: -500, spd: +40, swingHz: 0.05, swingAmt: -65 }
            ]
          },
          
          { name: 'final', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100, models: [] }
        ]
      },
      impendingFields: { num: 1, name: 'Impending Fields', password: 'V1s1T1NG',
        desc: util.paragraph(`
          Suddenly Slam Kid comes in over the comms: "More Bogies on the horizon!" Gun Girl's voice
          jumps into the fray: "Do we find a route around them or ready our engines for another
          round?" Salvo Lad scans the landscape intently as Joust Man barks: "If we don't go
          straight through them we'll never get to Stalbureaux in time!" Joust Man's eyes narrow as
          he looks up from his wristwatch, a gift from his father. Time is of the essence.
        `),
        winText: util.paragraph(`
          "Haha, take that Bogies!" yells Slam Kid as the final enemy ship crashes to the ground.
          Smoldering wreckage paves the path now taken by the Aces. "Good shooting Gun Girl!" yells
          Salvo Lad. "And your Salvos were brilliant!" she replies. Joust Man's eyes were
          narrowing. "It's too early to celebrate, Aces! That fleet radioed for RE1NF0rCEMENTS -
          prepare to engage again!"
        `),
        moments: [
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            models: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: []
          },
          { name: 'scout1', type: 'MomentAhead', terrain: 'plains', dist: 750, aheadSpd: 100,
            models: [
              { type: 'Winder', x: -160, y: +100, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -80, y: +100, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:    0, y: +100, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +80, y: +100, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +160, y: +100, spd: -100, swingHz: 0, swingAmt: 0 },
              
              { type: 'Winder', x: -120, y: -600, spd: +50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -40, y: -600, spd: +50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +40, y: -600, spd: +50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +120, y: -600, spd: +50, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'scout2', type: 'MomentAhead', terrain: 'meadow', dist: 750, aheadSpd: 100,
            models: [
              { type: 'Winder', x: -120, y: +100, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -40, y: +100, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +40, y: +100, spd: -150, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +120, y: +100, spd: -150, swingHz: 0, swingAmt: 0 },
              
              { type: 'Winder', x: -160, y: -600, spd: +80, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -80, y: -600, spd: +80, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:    0, y: -600, spd: +80, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +80, y: -600, spd: +80, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +160, y: -600, spd: +80, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'sideswipe1', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              { type: 'Winder', x: -300, y: +250, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1200 },
              { type: 'Winder', x: -300, y: +180, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1100 },
              { type: 'Winder', x: -300, y: +110, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1000 },
              { type: 'Winder', x: -300, y:  +40, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +900 }
            ]
          },
          { name: 'sideswipe2', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              { type: 'Winder', x: +300, y: +250, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1200 },
              { type: 'Winder', x: +300, y: +180, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1100 },
              { type: 'Winder', x: +300, y: +110, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1000 },
              { type: 'Winder', x: +300, y:  +40, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -900 }
            ]
          },
          { name: 'sideswipe3', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              { type: 'Winder', x: -300, y: +250, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: +1200 },
              { type: 'Winder', x: -300, y: +180, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: +1100 },
              { type: 'Winder', x: -300, y: +110, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: +1000 },
              { type: 'Winder', x: -300, y:  +40, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: +900 },
              
              { type: 'Winder', x: -300, y: +250, spd: -80, delayMs: 4000, swingHz: 0.07, swingAmt: +1200 },
              { type: 'Winder', x: -300, y: +180, spd: -80, delayMs: 4000, swingHz: 0.07, swingAmt: +1100 },
              { type: 'Winder', x: -300, y: +110, spd: -80, delayMs: 4000, swingHz: 0.07, swingAmt: +1000 },
              { type: 'Winder', x: -300, y:  +40, spd: -80, delayMs: 4000, swingHz: 0.07, swingAmt: +900 },
              
              { type: 'Winder', x: -160, y: -550, spd: +20, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  -80, y: -550, spd: +20, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:    0, y: -550, spd: +20, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:  +80, y: -550, spd: +20, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +160, y: -550, spd: +20, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'pillar1', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              
              { type: 'Winder', x: +40, y: +360, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +300, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +240, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +180, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +120, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: +40, y:  +60, spd: -120, swingHz: 0, swingAmt: 0 },
              
            ]
          },
          { name: 'pillar2', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              
              { type: 'Winder', x: -20, y: +360, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -20, y: +300, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -20, y: +240, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -20, y: +180, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -20, y: +120, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: -40, y:  +60, spd: -140, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:   0, y:  +60, spd: -140, swingHz: 0, swingAmt: 0 }
              
            ]
          },
          { name: 'pillar3', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              
              { type: 'Winder', x: +40, y: +360, spd: -160, delayMs: 4000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +300, spd: -160, delayMs: 4000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +240, spd: -160, delayMs: 4000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +180, spd: -160, delayMs: 4000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +120, spd: -160, delayMs: 4000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: +20, y:  +60, spd: -160, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +40, y:  +40, spd: -160, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +60, y:  +60, spd: -160, swingHz: 0, swingAmt: 0 }
              
            ]
          },
          { name: 'pillarBreak', type: 'MomentAhead', terrain: 'meadow', dist: 250, aheadSpd: 100, models: [] },
          { name: 'pillar4', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            models: [
              
              { type: 'Furler', x: -120, y: +240, spd: -110, delayMs: 3700, swingHz: 0.1, swingAmt: -100, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              { type: 'Furler', x:  -20, y: +240, spd: -110, delayMs: 3700, swingHz: 0.1, swingAmt: +100, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              
              { type: 'Winder', x: -70, y: +360, spd: -100, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -70, y: +300, spd: -100, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -70, y: +240, spd: -100, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -70, y: +180, spd: -100, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -70, y: +120, spd: -100, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: -90, y:  +60, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: -70, y:  +40, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: -50, y:  +60, spd: -100, swingHz: 0, swingAmt: 0 }
              
            ]
          },
          { name: 'box1', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            models: [
              
              { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              
              { type: 'Winder', x: -160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: +300 },
              
              { type: 'Winder', x: +160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: -300 }
              
            ]
          },
          { name: 'box2', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            models: [
              
              { type: 'Furler', x: -50, y: +400, spd: -30, swingHz: 0.079, swingAmt: +130, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              { type: 'Furler', x: +50, y: +400, spd: -30, swingHz: 0.079, swingAmt: -130, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              
              { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              
              { type: 'Winder', x: -160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: +300 },
              
              { type: 'Winder', x: +160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: -300 }
              
            ]
          },
          { name: 'box3', type: 'MomentAhead', terrain: 'meadow', dist: 2000, aheadSpd: 100,
            models: [
              
              
              { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
              { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, bulletArgs: { spd: -300, lsMs: 3000 } },
              
              // First layer
              { type: 'Winder', x: -160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: +300 },
              { type: 'Winder', x: -210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: +300 },
              
              { type: 'Winder', x: +160, y: +350, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +170, y: +300, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +180, y: +250, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +190, y: +200, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +200, y: +150, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: -300 },
              { type: 'Winder', x: +210, y: +100, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: -300 },
              
              // Second layer
              { type: 'Winder', x: -210, y: +360, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: +350 },
              { type: 'Winder', x: -220, y: +310, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: +350 },
              { type: 'Winder', x: -230, y: +260, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: +350 },
              { type: 'Winder', x: -240, y: +210, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: +350 },
              { type: 'Winder', x: -250, y: +160, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: +350 },
              { type: 'Winder', x: -260, y: +110, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: +350 },
              
              { type: 'Winder', x: +210, y: +360, spd: -60, delayMs: 10500, swingHz: 0.03, swingAmt: -350 },
              { type: 'Winder', x: +220, y: +310, spd: -60, delayMs: 10000, swingHz: 0.03, swingAmt: -350 },
              { type: 'Winder', x: +230, y: +260, spd: -60, delayMs:  9500, swingHz: 0.03, swingAmt: -350 },
              { type: 'Winder', x: +240, y: +210, spd: -60, delayMs:  9000, swingHz: 0.03, swingAmt: -350 },
              { type: 'Winder', x: +250, y: +160, spd: -60, delayMs:  8500, swingHz: 0.03, swingAmt: -350 },
              { type: 'Winder', x: +260, y: +110, spd: -60, delayMs:  8000, swingHz: 0.03, swingAmt: -350 }
            ]
          },
          { name: 'snake1', type: 'MomentAhead', terrain: 'meadow', dist: 1250, aheadSpd: 100,
            models: [
              // Left side
              { type: 'Winder', x: -15, y: +100, spd: -90, delayMs: 1200, swingHz: 0.030, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +150, spd: -90, delayMs: 1200, swingHz: 0.035, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +200, spd: -90, delayMs: 1200, swingHz: 0.040, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +250, spd: -90, delayMs: 1200, swingHz: 0.045, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +300, spd: -90, delayMs: 1200, swingHz: 0.050, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +350, spd: -90, delayMs: 1200, swingHz: 0.055, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +400, spd: -90, delayMs: 1200, swingHz: 0.060, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +450, spd: -90, delayMs: 1200, swingHz: 0.065, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +500, spd: -90, delayMs: 1200, swingHz: 0.070, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +550, spd: -90, delayMs: 1200, swingHz: 0.075, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +600, spd: -90, delayMs: 1200, swingHz: 0.080, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +650, spd: -90, delayMs: 1200, swingHz: 0.085, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +700, spd: -90, delayMs: 1200, swingHz: 0.090, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +750, spd: -90, delayMs: 1200, swingHz: 0.095, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +800, spd: -90, delayMs: 1200, swingHz: 0.100, swingAmt: +195 },
              { type: 'Winder', x: -15, y: +850, spd: -90, delayMs: 1200, swingHz: 0.105, swingAmt: +195 },
              
              // Right side
              { type: 'Winder', x: +15, y: +100, spd: -90, delayMs: 1200, swingHz: 0.030, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +150, spd: -90, delayMs: 1200, swingHz: 0.035, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +200, spd: -90, delayMs: 1200, swingHz: 0.040, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +250, spd: -90, delayMs: 1200, swingHz: 0.045, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +300, spd: -90, delayMs: 1200, swingHz: 0.050, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +350, spd: -90, delayMs: 1200, swingHz: 0.055, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +400, spd: -90, delayMs: 1200, swingHz: 0.060, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +450, spd: -90, delayMs: 1200, swingHz: 0.065, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +500, spd: -90, delayMs: 1200, swingHz: 0.070, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +550, spd: -90, delayMs: 1200, swingHz: 0.075, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +600, spd: -90, delayMs: 1200, swingHz: 0.080, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +650, spd: -90, delayMs: 1200, swingHz: 0.085, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +700, spd: -90, delayMs: 1200, swingHz: 0.090, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +750, spd: -90, delayMs: 1200, swingHz: 0.095, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +800, spd: -90, delayMs: 1200, swingHz: 0.100, swingAmt: +195 },
              { type: 'Winder', x: +15, y: +850, spd: -90, delayMs: 1200, swingHz: 0.105, swingAmt: +195 },
              
              { type: 'Furler', x: 0, y: +900, spd: -90, delayMs: 1500, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, bulletArgs: { spd: -300, lsMs: 6000 } },
            ]
          },
          { name: 'snake2', type: 'MomentAhead', terrain: 'meadow', dist: 1250, aheadSpd: 100,
            models: [
              { type: 'Weaver', x: 0, y: +100, spd: -90, delayMs: 1200, swingHz: 0.030, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +150, spd: -90, delayMs: 1200, swingHz: 0.035, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +200, spd: -90, delayMs: 1200, swingHz: 0.040, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +250, spd: -90, delayMs: 1200, swingHz: 0.045, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +300, spd: -90, delayMs: 1200, swingHz: 0.050, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +350, spd: -90, delayMs: 1200, swingHz: 0.055, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +400, spd: -90, delayMs: 1200, swingHz: 0.060, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +450, spd: -90, delayMs: 1200, swingHz: 0.065, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +500, spd: -90, delayMs: 1200, swingHz: 0.070, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +550, spd: -90, delayMs: 1200, swingHz: 0.075, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +600, spd: -90, delayMs: 1200, swingHz: 0.080, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +650, spd: -90, delayMs: 1200, swingHz: 0.085, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +700, spd: -90, delayMs: 1200, swingHz: 0.090, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +750, spd: -90, delayMs: 1200, swingHz: 0.095, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +800, spd: -90, delayMs: 1200, swingHz: 0.100, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +850, spd: -90, delayMs: 1200, swingHz: 0.105, swingAmt: +195 },
              
              { type: 'Drifter', x: 0, y: +300, tx: 0, ty: 1, vel: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              
              { type: 'Furler', x: 0, y: +900, spd: -90, delayMs: 1200, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, bulletArgs: { spd: -300, lsMs: 6000 } }
            ]
          },
          { name: 'snake3', type: 'MomentAhead', terrain: 'plains', dist: 2000, aheadSpd: 100,
            models: [
              
              { type: 'Drifter', x: -150, y: +100, tx: 0, ty: +1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x:  -50, y: +100, tx: 0, ty: +1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x:  +50, y: +100, tx: 0, ty: +1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x: +150, y: +100, tx: 0, ty: +1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              
              { type: 'Weaver', x: 0, y:  +300, spd: -90, delayMs: 1500, swingHz: 0.030, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +350, spd: -90, delayMs: 1500, swingHz: 0.035, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +400, spd: -90, delayMs: 1500, swingHz: 0.040, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +450, spd: -90, delayMs: 1500, swingHz: 0.045, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +500, spd: -90, delayMs: 1500, swingHz: 0.050, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +550, spd: -90, delayMs: 1500, swingHz: 0.055, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +600, spd: -90, delayMs: 1500, swingHz: 0.060, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +650, spd: -90, delayMs: 1500, swingHz: 0.065, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +700, spd: -90, delayMs: 1500, swingHz: 0.070, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +750, spd: -90, delayMs: 1500, swingHz: 0.075, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +800, spd: -90, delayMs: 1500, swingHz: 0.080, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +850, spd: -90, delayMs: 1500, swingHz: 0.085, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +900, spd: -90, delayMs: 1500, swingHz: 0.090, swingAmt: +195 },
              { type: 'Weaver', x: 0, y:  +950, spd: -90, delayMs: 1500, swingHz: 0.095, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +1000, spd: -90, delayMs: 1500, swingHz: 0.100, swingAmt: +195 },
              { type: 'Weaver', x: 0, y: +1050, spd: -90, delayMs: 1500, swingHz: 0.105, swingAmt: +195 },
              
              { type: 'Furler', x: 0, y: +1100, spd: -90, delayMs: 1500, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, bulletArgs: { spd: -300, lsMs: 6000 } }
            ]
          }
        ]
      },
      imposingFields: { num: 2, name: 'Imposing Fields', password: 'RE1NF0rCEMENTS',
        desc: util.paragraph(`
          Joust Man checks his wristwatch again. Shapes loom over the horizon, a fleet ready to
          test the Aces once more. Joust Man's eyes narrow as his squad whoops and shouts battle
          cries. A shape looms towards the back of the fleet, much bigger than the others. "Let's
          do this", Joust Man thinks, charging up his laser beam.
        `),
        winText: util.paragraph(`
          "Damn damn!" Gun Girl was slurring her words, like most Thursdays. "We sure fucked those
          Bogies right up their Yemenese dickholes, eh?"
        `),
        moments: [
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100,
            bounds: { total: { w: 440, h: 550 }, player: { x: 0, y: 0, w: 440, h: 550 } },
            models: []
          },
          { name: 'final', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100, models: [
            { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: -100 },
            { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: +100 }
          ]}
        ]
      },
      killPlains: { num: 1, name: 'Kill Plains', password: 'R4CIN6',
        desc: [
        
        ].join(' '),
        moments: [
          { name: 'practice1', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            models: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: []
          },
          { name: 'winder1', type: 'MomentAhead', terrain: 'plains', dist: 500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              { type: 'Winder', x: -600, y: +250, spd: -100, swingHz: 0.027, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -100, swingHz: 0.031, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -100, swingHz: 0.035, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -100, swingHz: 0.035, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -100, swingHz: 0.031, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -100, swingHz: 0.027, swingAmt: -580 }
            ]
          },
          { name: 'winder2', type: 'MomentAhead', terrain: 'plains', dist: 500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              { type: 'Winder', x: -600, y: +250, spd: -100, swingHz: 0.032, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -100, swingHz: 0.036, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -100, swingHz: 0.040, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -100, swingHz: 0.040, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -100, swingHz: 0.036, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -100, swingHz: 0.032, swingAmt: -580 }
            ]
          },
          { name: 'winder3', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper up
              { type: 'Winder', x: -600, y: +250, spd: -130, swingHz: 0.047, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -130, swingHz: 0.051, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -130, swingHz: 0.055, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -130, swingHz: 0.055, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -130, swingHz: 0.051, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -130, swingHz: 0.047, swingAmt: -580 }
            ]
          },
          { name: 'winder4', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper down
              { type: 'Winder', x: -600, y:  +50, spd: -130, swingHz: 0.047, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -130, swingHz: 0.051, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +250, spd: -130, swingHz: 0.055, swingAmt: +580 },
              { type: 'Winder', x: +600, y: +250, spd: -130, swingHz: 0.055, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -130, swingHz: 0.051, swingAmt: -580 },
              { type: 'Winder', x: +600, y:  +50, spd: -130, swingHz: 0.047, swingAmt: -580 }
            ]
          },
          { name: 'winder5', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper up
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.057, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.065, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -150, swingHz: 0.065, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -150, swingHz: 0.061, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -150, swingHz: 0.057, swingAmt: -580 }
            ]
          },
          { name: 'winder6', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper down
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.065, swingAmt: +580 },
              { type: 'Winder', x: +600, y: +250, spd: -150, swingHz: 0.065, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -150, swingHz: 0.061, swingAmt: -580 },
              { type: 'Winder', x: +600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: -580 }
            ]
          },
          { name: 'winder7', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper down desync
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: +780 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +780 },
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.065, swingAmt: +780 },
              
              { type: 'Winder', x: +600, y: +300, spd: -150, swingHz: 0.065, swingAmt: -780 },
              { type: 'Winder', x: +600, y: +200, spd: -150, swingHz: 0.061, swingAmt: -780 },
              { type: 'Winder', x: +600, y: +100, spd: -150, swingHz: 0.057, swingAmt: -780 },
              
              { type: 'Weaver', x: -200, y: -600, spd: +40, swingHz: 0.04, swingAmt: +100 },
              { type: 'Weaver', x: +200, y: -600, spd: +40, swingHz: 0.04, swingAmt: -100 }
            ]
          },
          { name: 'winder8', type: 'MomentAhead', terrain: 'plains', dist: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            models: [
              // Zipper down desync
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.075, swingAmt: -780 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.071, swingAmt: -780 },
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.067, swingAmt: -780 },
              
              { type: 'Winder', x: +600, y: +300, spd: -150, swingHz: 0.067, swingAmt: +780 },
              { type: 'Winder', x: +600, y: +200, spd: -150, swingHz: 0.071, swingAmt: +780 },
              { type: 'Winder', x: +600, y: +100, spd: -150, swingHz: 0.075, swingAmt: +780 },
              
              { type: 'Weaver', x: 0, y: -600, spd: +30, swingHz: 0.08, swingAmt: +160 },
              { type: 'Weaver', x: 0, y: -600, spd: +30, swingHz: 0.08, swingAmt: -160 }
            ]
          },
          { name: 'winder9', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 440, h: 550 }, player: { x: 0, y: 0, w: 440, h: 550 } },
            models: [
              // Zipper down desync
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: +780 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +780 },
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.065, swingAmt: +780 },
              
              { type: 'Winder', x: +600, y: +300, spd: -150, swingHz: 0.065, swingAmt: -780 },
              { type: 'Winder', x: +600, y: +200, spd: -150, swingHz: 0.061, swingAmt: -780 },
              { type: 'Winder', x: +600, y: +100, spd: -150, swingHz: 0.057, swingAmt: -780 },
              
              { type: 'Weaver', x: 0, y: -580, spd: +30, swingHz: 0.05, swingAmt: +200 },
              { type: 'Weaver', x: 0, y: -580, spd: +30, swingHz: 0.06, swingAmt: +200 },
              { type: 'Weaver', x: 0, y: -580, spd: +30, swingHz: 0.07, swingAmt: +200 },
              { type: 'Weaver', x: 0, y: -580, spd: +30, swingHz: 0.08, swingAmt: +200 },
              { type: 'Weaver', x: 0, y: -580, spd: +30, swingHz: 0.09, swingAmt: +200 }
            ]
          },
          { name: 'weaver1', type: 'MomentAhead', terrain: 'plains', dist: 750, aheadSpd: 100,
            bounds: { total: { w: 480, h: 600 }, player: { x: 0, y: 0, w: 480, h: 600 } },
            models: [
              
              { type: 'Weaver', x: -210, y: +630, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: -140, y: +620, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  -70, y: +610, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +600, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:  +70, y: +610, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +140, y: +620, spd: -130, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +210, y: +630, spd: -130, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: -580, spd: +30, swingHz: 0.05, swingAmt: +110 },
              { type: 'Weaver', x: -120, y: -580, spd: +30, swingHz: 0.06, swingAmt: +110 },
              { type: 'Weaver', x: -120, y: -580, spd: +30, swingHz: 0.07, swingAmt: +110 },
              { type: 'Weaver', x: -120, y: -580, spd: +30, swingHz: 0.08, swingAmt: +110 },
              { type: 'Weaver', x: -120, y: -580, spd: +30, swingHz: 0.09, swingAmt: +110 },
              
              { type: 'Weaver', x: +120, y: -580, spd: +30, swingHz: 0.05, swingAmt: -110 },
              { type: 'Weaver', x: +120, y: -580, spd: +30, swingHz: 0.06, swingAmt: -110 },
              { type: 'Weaver', x: +120, y: -580, spd: +30, swingHz: 0.07, swingAmt: -110 },
              { type: 'Weaver', x: +120, y: -580, spd: +30, swingHz: 0.08, swingAmt: -110 },
              { type: 'Weaver', x: +120, y: -580, spd: +30, swingHz: 0.09, swingAmt: -110 }
            ]
          },
          { name: 'furler1', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100,
            bounds: { total: { w: 480, h: 600 }, player: { x: 0, y: 0, w: 480, h: 600 } },
            models: [
              { type: 'Furler', x: -120, y: +200, spd: -50, swingHz: 0.1, swingAmt: -80, shootDelayMs: 1500, bulletArgs: { spd: -300 } },
              { type: 'Furler', x: +120, y: +200, spd: -50, swingHz: 0.1, swingAmt: +80, shootDelayMs: 1500, bulletArgs: { spd: -300 } }
            ]
          },
          { name: 'bozz', type: 'MomentAhead', terrain: 'plains', dist: 8000, aheadSpd: 100,
            bounds: { total: { w: 800, h: 1000 }, player: { x: 0, y: -150, w: 800, h: 700 } },
            models: [
              
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.06, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 4000, bulletArgs: { spd: -300, lsMs: 10000 } },
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.07, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 3500, bulletArgs: { spd: -300, lsMs: 10000 } },
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.08, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 3000, bulletArgs: { spd: -300, lsMs: 10000 } },
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.08, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 3000, bulletArgs: { spd: -300, lsMs: 10000 } },
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.07, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 3500, bulletArgs: { spd: -300, lsMs: 10000 } },
              { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.06, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 4000, bulletArgs: { spd: -300, lsMs: 10000 } },
              
              { type: 'WinderMom', x: -600, y: +500, tx: -250, ty: +280, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } },
              { type: 'WinderMom', x:    0, y: +500, tx:    0, ty: +320, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } },
              { type: 'WinderMom', x: +600, y: +500, tx: +250, ty: +280, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } }
              
            ]
          },
          
          { name: 'final', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100, models: [] }
          
        ]
      }
    };
    let getLevelData = name => ({
      name, ...levels[name].slice('num', 'password'),
      dispName: levels[name].name, dispDesc: levels[name].desc
    });
    
    // BASE STUFF
    let Entity = U.inspire({ name: 'FlyEntity', insps: { Rec }, methods: (insp, Insp) => ({
      
      initProps: function(val) {
        let { ud={ ms: val.ms }, lsMs=null } = val;
        //if (!ud) throw Error(`Missing "ud" prop for init ${U.nameOf(this)}`);
        
        let { ms=null } = ud;
        if (badN(ms)) {
          console.log(val);
          throw Error(`Bad "ms" param for ${U.nameOf(this)} (${U.nameOf(val.ms)})`);
        }
        
        // TODO: Annoying that we need to pass "ud" here...
        return { ud: { ms }, ms, lsMs };
      },
      initSyncs: function() { return [ 'ud', 'ms' ]; },
      init: function(rt, uid, mems, val) {
        
        if (!val) throw Error(`${U.nameOf(this)} missing "val" param`);
        
        // Move properties from `props` to `syncProps` as appropriate
        let props = this.initProps(val);
        
        let sProps = this.initSyncs();
        if (Set(sProps).size !== sProps.length) throw Error(`${U.nameOf(this)} defines sync properties multiple times`);
        for (let spn of sProps) if (!props.has(spn)) throw Error(`${U.nameOf(this)} missing sync prop "${spn}"`);
        
        let syncProps = {};
        for (let spn of sProps) {
          syncProps[spn] = props[spn]; delete props[spn];
        }
        
        // Attach all local properties
        for (let localPropName in props) this[localPropName] = props[localPropName];
        
        // Initialize as Rec using sync properties
        insp.Rec.init.call(this, rt, uid, mems, { ...syncProps, type: U.nameOf(this) });
        
      },
      v: function(p, v=C.skip) {
        if (v === C.skip) {  // Get
          if (this.val.has(p))              return this.val[p];
          else if (({}).has.call(this, p))  return this[p];
          else                              throw Error(`${U.nameOf(this)} has no v prop "${p}"`);
        } else {                  // Set
          if (U.isType(v, Function)) v = v(this.val.has(p) ? this.val[p] : this[p]);
          if (this.val.has(p))              this.dltVal({ [p]: v });
          else if (({}).has.call(this, p))  this[p] = v;
          else                              throw Error(`${U.nameOf(this)} has no v prop "${p}"`);
        }
      },
      r: function(ud, p) { return this.v(p) || ud.entities.def(this.v(`${p}Uid`)); },
      getAgeMs: function(updData) { return updData.ms - this.v('ms'); },
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
      getDieResult: function(ud) {},
      isAlive: function(ud) {
        if (this.v('lsMs') !== null && this.getAgeMs(ud) > this.lsMs) return false;
        return true;
      },
      
      renderPriority: function() { return 0.5; },
      render: function(updData, draw) {
        let { x, y } = this.getAbsVal(updData);
        draw.circ(x, y, 10, { fillStyle: '#ff0000' });
      }
      
    })});
    let Mortal = U.inspire({ name: 'Mortal', insps: { Entity }, methods: (insp, Insp) => ({
      initProps: insp.allArr('initProps', (i, arr) => Object.assign(...arr, { hpDmg: 0 })),
      getMaxHp: function() { return 1; },
      getCurrentHp: function(ud) { return this.getMaxHp(ud) - this.v('hpDmg'); },
      takeDamage: function(updData, srcEnt, amt) {
        let fatalDmg = this.getMaxHp(updData) - this.v('hpDmg');
        if (amt > fatalDmg) amt = Math.max(0, fatalDmg);
        
        // Mark damage on us
        this.v('hpDmg', v => v + amt);
        
        // Give damage credit to `srcEnt`
        srcEnt.v('scoreDamage', v => v + amt);
      },
      isAlive: function(updData) { return this.v('hpDmg') < this.getMaxHp(updData); }
    })});
    let Mover = U.inspire({ name: 'Mover', methods: (insp, Insp) => ({
      
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
      initProps: insp.allArr('initProps', (i, arr, val) => {
        
        let { ud: { ms }, aMs=ms, x, y, ax=x, ay=y, vel=100, acl=0 } = val;
        
        let calc = null;
        if (val.has('nx') && val.has('ny'))       calc = () => val.slice('nx', 'ny', 'dist');
        else if (val.has('tx') && val.has('ty'))  calc = Insp.carteParams.bind(null, val.tx, val.ty);
        else if (val.has('ang'))                  calc = Insp.polarParams.bind(null, val.ang, val.dist);
        else                                      calc = () => { throw Error(`Supply either "tx" and "ty", or "ang"`); };
        
        let { nx, ny, dist, ang=Math.atan2(nx, ny) / (Math.PI * 2) } = calc();
        return Object.assign(...arr, { aMs, ax, ay, vel, acl, nx, ny, dist, ang });
        
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'aMs', 'ax', 'ay', 'nx', 'ny', 'dist', 'vel', 'acl' ].concat(...arr)),
      getRelVal: function(updData, ms=updData.ms) {
        
        let aMs = this.v('aMs');
        let ax = this.v('ax'); let ay = this.v('ay');
        let nx = this.v('nx'); let ny = this.v('ny');
        let vel = this.v('vel');
        let acl = this.v('acl');
        let dist = this.v('dist');
        
        // Seconds the most recent anchor move has lasted
        let t = (ms - aMs) * 0.001;
        
        // Non-null `dist` creates a cap on the dist
        let d = vel * t + acl * 0.5 * t * t; // Distance based on t, vel, acl
        if (dist !== null && d > dist) d = dist;
        
        let x = ax + nx * d;
        let y = ay + ny * d;
        return { x: ax + nx * d, y: ay + ny * d };
        
      },
      getAgeMs: C.noFn('getAgeMs'),
      setMoveAnchor: function(updData) {
        let { x, y } = this.getRelVal(updData);
        this.v('aMs', updData.ms); this.v('ax', x); this.v('ay', y);
      },
      setMoveSpd: function(updData, vel, acl) {
        if (updData) this.setMoveAnchor(updData);
        this.v('vel', vel); this.v('acl', acl);
      },
      setCarteDest: function(updData, tx, ty) {
        
        if (updData) this.setMoveAnchor(updData);
        
        let d = Math.sqrt(tx * tx + ty * ty);
        this.v('dist', d);
        
        let n = 1 / d;
        this.v('nx', tx * n); this.v('ny', ty * n);
        this.v('ang', Math.atan2(nx, ny) / (Math.PI * 2));
        
      },
      setPolarDest: function(updData, ang, dist=null) {
        
        if (updData) this.setMoveAnchor(updData);
        
        let r = ang * Math.PI * 2;
        this.v('nx', Math.sin(r)); this.v('ny', Math.cos(r));
        this.v('ang', ang); this.v('dist', dist);
        
      },
      isAlive: function(ud) {
        
        let nx = this.v('nx'); let ny = this.v('ny');
        let { x, y } = this.getRelVal(ud);
        let tb = ud.bounds.total;
        if (nx > 0 && x > (tb.r + 150)) return false;
        if (nx < 0 && x < (tb.l - 150)) return false;
        if (ny > 0 && y > (tb.t + 150)) return false;
        if (ny < 0 && y < (tb.b - 150)) return false;
        return true;
        
      }
      
    })});
    let Physical = U.inspire({ name: 'Physical', methods: (insp, Insp) => ({
      init: C.noFn('init'),
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { ud: { ms }, ax=null, ay=null, aMs=ms, forces=[] } = val;
        return Object.assign(...arr, { ax, ay, aMs, forces });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'ax', 'ay', 'aMs', 'forces' ].concat(...arr)),
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
        let { x, y } = insp.Physical.getRelVal.call(this, ud);
        this.setAnchor(ud, x, y);
        this.v('forces', forces);
      }
    })});
    
    // UTIL
    let Bullet = U.inspire({ name: 'Bullet', methods: (insp, Insp) => ({
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { team, owner=null, dmg=1, pDmg=[0,0], bound={ form: 'circle', r: 4 }, colour='rgba(0, 0, 0, 0.75)' } = val;
        /// {ABOVE=
        if (!owner) throw Error('Bullet missing "owner" property');
        /// =ABOVE}
        if (!U.isType(bound, Object) || !bound.has('form') || !U.isType(bound.form, String)) throw Error(`Bad bound! (${U.nameOf(bound)}, ${JSON.stringify(bound)})`);
        return Object.assign(...arr, { team, owner, dmg, pDmg, bound, colour });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'bound', 'colour' ].concat(...arr)),
      init: C.noFn('init'),
      getCollideResult: function(updData, tail) {
        if (!U.isInspiredBy(tail, Mortal)) return;
        let dmg = this.v('dmg');
        let pDmg = this.v('pDmg');
        if (pDmg[0]) {
          let maxHp = tail.getMaxHp(updData);
          dmg += Math.min(pDmg[0] * maxHp, pDmg[1] || maxHp);
        }
        tail.takeDamage(updData, this.v('owner'), dmg);
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
    let MBullet = U.inspire({ name: 'MBullet', insps: { Entity, Mover, Bullet }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, { x, y, r, team }) => {
        draw.circ(x, y, r, { fillStyle: Insp.parents.Bullet.getColour(team) });
      },
      initProps: insp.allArr('initProps', (i, arr, val) => Object.assign(...arr)),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [].concat(...arr)),
      isAlive: function(ud) {
        return true
          && insp.Entity.isAlive.call(this, ud)
          && insp.Mover.isAlive.call(this, ud);
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
    let Ace = U.inspire({ name: 'Ace', insps: { Mortal, Physical }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 8 }, $respawnMs: 2750, $invulnMs: 1500, $spd: 165,
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { ud: { ms }, name='<anon>', cx=0, cy=0 } = val;
        return Object.assign(...arr, {
          name, spd: Insp.spd, effects: Set(),
          invulnMark: ms + Insp.invulnMs,
          scoreDamage: 0,
          scoreDeath: 0,
          controls: [ 'l', 'r', 'd', 'u', 'a1', 'a2' ].toObj(k => [ k, [ 0, ms ] ])
        });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'invulnMark', 'name' ].concat(...arr)),
      getRelVal: function(ud) {
        let { x, y } = insp.Physical.getRelVal.call(this, ud);
        
        let bounded = false;
        if (!ud.outcome !== 'win') {
          let pb = ud.bounds.player;
          if (x < pb.l) { x = pb.l; bounded = true; }
          if (x > pb.r) { x = pb.r; bounded = true; }
          if (y < (pb.b - pb.y)) { y = (pb.b - pb.y); bounded = true; }
          if (y > (pb.t - pb.y)) { y = (pb.t - pb.y); bounded = true; }
        }
        return { x, y, bounded };
      },
      getCollideResult: function(updData, tail) {},
      getTeam: function() { return +1; },
      getStepResult: function(updData) {
        
        let { ms, spf, bounds, outcome } = updData;
        
        if (!this.isAlive(updData)) {
          return { tangibility: {
            bound: { ...Insp.bound, x: -7070707070, y: -7070707070 },
            team: 'ace', 
            sides: []
          }};
        }
        
        if (outcome === 'win') {
          if (!this.winTime) this.winTime = ms;
          if (this.v('invulnMark') < ms) this.v('invulnMark', ms + 10000);
          this.setForces(updData, [ [ this.winTime, 'vel', 0, Insp.spd * 4 ] ]);
          let { x, y } = this.getAbsVal(updData);
          return { tangibility: {
            bound: { ...Insp.bound, x, y },
            team: 'ace',
            sides: []
          }};
        }
        
        let { r, l, u, d, a1, a2 } = this.controls;
        let cx = r[0] - l[0];
        let cy = u[0] - d[0];
        let { spdMult=1, forces=[] } = this.aceUpdate(updData, { cx, cy, a1: a1[0], a2: a2[0] }) || {};
        
        // The calculated speed for this tick
        spdMult *= this.spd;
        
        for (let effect of this.effects) {
          let { mark, type=null, fn=null, endFn=null } = effect;
          if (ms > effect.mark) {
            this.v('effects').rem(effect);
            if (effect.endFn) effect.endFn(this, updData);
          } else {
            // Note: effects that aren't "spdMult" may need to be added to `forces`
            if (effect.type === 'spdMult') spdMult *= effect.spdMult;
            if (effect.type === 'force') forces.push(effect.force);
            if (effect.fn) effect.fn(this, updData);
          }
        }
        
        // TODO: If moving on both axes, normalize speed!
        if (r[0]) forces.push([ r[1], 'vel', r[0] * +spdMult, 0               ]);
        if (l[0]) forces.push([ l[1], 'vel', l[0] * -spdMult, 0               ]);
        if (u[0]) forces.push([ u[1], 'vel', 0,               u[0] * +spdMult ]);
        if (d[0]) forces.push([ d[1], 'vel', 0,               d[0] * -spdMult ]);
        
        this.setForces(updData, forces);
        
        let { x, y, bounded } = this.getAbsVal(updData);
        if (bounded) this.setAnchor(updData, x, y - updData.bounds.total.y);
        return { tangibility: {
          bound: { ...Insp.bound, x, y },
          team: 'ace',
          sides: (this.v('invulnMark') > ms) ? [] : [ 'tail' ]
        }};
        
      },
      
      aceUpdate: C.noFn('aceUpdate'),
      
      render: function(updData, draw) {
        
        if (!this.isAlive(updData)) return;
        
        let size = Insp.bound.r << 1;
        let mine = this === updData.myEntity;
        let { x, y } = this.getAbsVal(updData);
        
        if (updData.ms < this.v('invulnMark')) {
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
    let JoustMan = U.inspire({ name: 'JoustMan', insps: { Ace }, methods: (insp, Insp) => ({
      
      $w1ChargePunishSlow: 0.4, $w1ChargePunishMs: 2000,
      $w1Charge1Ms: 750, $w1Charge2Ms: 1800, $w1Charge3Ms: 5000, // How many millis of charging for various jousts
      $w1Charge3Slow: 0.58,
      $w2Delay: 3500, $w2DashSpeed: 500, $w2OrbDps: 25, $w2DurationMs: 300,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceJoust' }),
      
      initProps: insp.allArr('initProps', (i, arr) => Object.assign(...arr, { w1Mark: null, w1State: 0, w2Mark: null })),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'w1Mark', 'w1State', 'w2Mark' ].concat(...arr)),
      aceUpdate: function(updData, { cx, cy, a1, a2 }) {
        
        let { aheadDist, ms, spf } = updData;
        
        // Activate weapon 1
        if (a1) {
          
          if (!this.v('w1Mark')) this.v('w1Mark', ms);
          
          let duration = ms - this.v('w1Mark');
          if (duration > Insp.w1Charge3Ms)      this.v('w1State', 3);
          else if (duration > Insp.w1Charge2Ms) this.v('w1State', 2);
          else if (duration > Insp.w1Charge1Ms) this.v('w1State', 1);
          else                                  this.v('w1State', 0);
          
        } else if (this.v('w1Mark')) {
          
          // Activate the charged ability!!
          if (this.v('w1State') === 0) {
            
            // JoustMan is punished for holding for too short a time
            this.v('effects').add({ mark: ms + Insp.w1ChargePunishMs, type: 'spdMult', spdMult: Insp.w1ChargePunishSlow });
            
          } else if (this.v('w1State') === 1) {
            
            // Weapon 1 act 1: Spread shot
            
            let { x, y } = this.getRelVal(updData);
            let incAng = 0.018;
            let args = { owner: this, team: 'ace', ax: x, ay: y, vel: 350, dmg: 0.75, lsMs: 700, bound: { form: 'circle', r: 6 } };
            for (let ang of util.incCen(9, incAng)) updData.spawnEntity({ type: 'JoustManBullet', ...args, ang });
            
            this.v('effects').add({ mark: ms + 500, type: 'spdMult', spdMult: 0.5 });
            
          } else if (this.v('w1State') === 2) {
            
            // Weapon 1 act 2: Spheres
            let args = { joustMan: this, team: 'ace', lsMs: 1400 };
            let offs = [
              { xOff: -64, yOff: +16, r: 28, dps: 15 },
              { xOff: +64, yOff: +16, r: 28, dps: 15 },
              { xOff: +24, yOff: -30, r: 20, dps: 11 },
              { xOff: -24, yOff: -30, r: 20, dps: 11 }
            ];
            for (let off of offs) updData.spawnEntity({ type: 'JoustManLaserSphere', ...args, ...off });
            
            this.v('effects').add({ mark: ms + 1150, type: 'spdMult', spdMult: 1.3 });
            
          } else if (this.v('w1State') === 3) {
            
            // Weapon 1 act 3: BIG LASER
            updData.spawnEntity({ type: 'JoustManLaserVert', joustMan: this, team: 'ace', lsMs: 3000 });
            this.v('effects').add({ mark: ms + 3000, type: 'spdMult', spdMult: Insp.w1Charge3Slow });
            
          }
          
          this.v('w1State', 0);
          this.v('w1Mark', 0);
          
        }
        
        // Activate weapon 2
        if (a2 && cx && (!this.v('w2Mark') || ms > this.v('w2Mark'))) {
          
          this.v('w2Mark', ms + Insp.w2Delay);
          
          let dir = cx > 0 ? +1 : -1;
          this.v('invulnMark', v => Math.max(v || 0, ms + 250));
          this.v('effects').add({ mark: ms + 250, type: 'force', force: [ ms, 'vel', Insp.w2DashSpeed * dir, 0 ] });
          this.v('effects').add({ mark: ms + 270, type: 'spdMult', spdMult: 0 });
          
          let args = { joustMan: this, team: 'ace', lsMs: Insp.w2DurationMs, yOff: 0, r: 9, dps: Insp.w2OrbDps };
          for (let i = 0; i < 4; i++)
            updData.spawnEntity({ type: 'JoustManLaserSphere', ...args, xOff: -dir * (i + 1) * 30 });
          
          updData.spawnEntity({ type: 'JoustManLaserSphere', ...args, xOff: 0, yOff: 0, r: 20 });
          
        }
        
      },
      render: function(ud, draw) {
        
        insp.Ace.render.call(this, ud, draw);
        
        let { x, y } = this.getAbsVal(ud);
        let w1Mark = this.v('w1Mark');
        let w1State = this.v('w1State');
        let w2Mark = this.v('w2Mark');
        
        // Laser reload
        let bar1H = w1Mark ? Math.min(1, (ud.ms - w1Mark) / Insp.w1Charge3Ms) * 20 : 0;
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
          ? Math.max(0, Math.min(1, (Insp.w2Delay - msRemaining) / Insp.w2Delay))
          : 1;
        draw.rectCen(x, y - 12, bar2W * 16, 4, { fillStyle: `rgba(0, 0, 255, ${msRemaining > 0 ? 0.4 : 1})` });
        
      }
      
    })});
    let GunGirl = U.inspire({ name: 'GunGirl', insps: { Ace }, methods: (insp, Insp) => ({
      
      $shootSteps: [
        { ms: 1000, ang: -0.01, dmgMult: 1   },  // Inwards
        { ms: 1000, ang: +0.00, dmgMult: 1.4 },  // Parallel again
        { ms: 1500, ang: +0.02, dmgMult: 1   },  // Very slowly increase angle
        { ms: 4000, ang: +0.25, dmgMult: 1   }   // Slowly bend all the way outwards
      ],
      $w1Delay: 85, $bulletDmg: 0.35, $w1LockMs: 1100,
      $w1ShortLockPunishSlow: 0.36, $w1ShortLockPunishMs: 300,
      $w1LongLockPunishSlow: 0.80, $w1LongLockPunishMs: 800,
      $w1ReloadBoostMs: 800, $w1ReloadBoostAmt: 1.55,
      $w2Delay: 10000, $w2Duration: 1900,
      $bulletDmg: 0.3, $bulletSpd: 740, $bulletMs: 800,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceGun' }),
      
      initProps: insp.allArr('initProps', (i, arr, { ud: { ms } }) => Object.assign(...arr, {
        lockoutPunishMark: null,
        w1Mark: null,                   // Marks when bullet ready to fire
        w1StartMark: null,              // Marks the time the first bullet of the series was fired
        w1LockMark: ms,                 // Marks when lockout will end
        w2ReadyMark: ms,                // Marks when w2 can be used
        w2Mark: ms,                     // Marks when w2 ends
        w2EffectiveShootDuration: null
      })),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'w2ReadyMark' ].concat(...arr)),
      getAngForShootDuration: function(ms) {
        
        let prevMs = 0;
        let prevAng = 0;
        for (let step of Insp.shootSteps) {
          
          let curMs = prevMs + step.ms;
          
          if (ms < curMs) {
            return { ...step, smoothAng: util.fadeAmt(prevAng, step.ang, (ms - prevMs) / step.ms) };
          }
          
          prevMs += step.ms;
          prevAng = step.ang;
          
        }
        
        let result = Insp.shootSteps.slice(-1)[0];
        return { ...result, smoothAng: result.ang };
        
      },
      aceUpdate: function(updData, { a1, a2 }) {
        
        let { aheadDist, ms, spf } = updData;
        
        // Reset `this.lockoutPunishMark` when the duration ends
        if (this.v('lockoutPunishMark') && ms >= this.v('lockoutPunishMark')) this.v('lockoutPunishMark', null);
        
        if (this.v('w1LockMark') && ms >= this.v('w1LockMark')) {
          this.v('w1LockMark', null);
          
          // Upon reload, get a speed boost
          this.v('effects').add({ mark: ms + Insp.w1ReloadBoostMs, type: 'spdMult', spdMult: Insp.w1ReloadBoostAmt });
        }
        
        // End w2 when the duration elapses
        if (this.v('w2Mark') && ms >= this.v('w2Mark')) {
          this.v('w2Mark', null);
          this.v('w1LockMark', ms + Insp.w1LockMs);
        }
        
        if (a1 && !this.v('w1LockMark') && (!this.v('w1Mark') || ms >= this.v('w1Mark'))) {
          
          // Mark the time of the first shot in the series
          if (!this.v('w1StartMark')) this.v('w1StartMark', ms);
          
          let { x, y } = this.getRelVal(updData);
          if (!this.v('w2Mark')) {
            
            // Enforce typical rate of fire
            this.v('w1Mark', v => (v || ms) + Insp.w1Delay);
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(ms - this.v('w1StartMark'));
            let args = { owner: this, team: 'ace', vel: Insp.bulletSpd, dmg: Insp.bulletDmg * dm, bound: { form: 'circle', r: 3 * dm }, lsMs: Insp.bulletMs };
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x - 4, ay: y, ang: -ang });
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x + 4, ay: y, ang: +ang });
            
          } else {
            
            // Enforce steroid rate of fire
            this.v('w1Mark', v => (v || ms) + Insp.w1Delay * 0.65);
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(this.v('w2EffectiveShootDuration'));
            let args = { owner: this, team: 'ace', vel: Insp.bulletSpd, dmg: Insp.bulletDmg * 1.15 * dm, bound: { form: 'circle', r: 5 * dm }, lsMs: Insp.bulletMs };
            
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x - 8, ay: y, ang: -(ang * 1.5) });
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x - 4, ay: y, ang: -(ang * 1.0) });
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x + 4, ay: y, ang: +(ang * 1.0) });
            updData.spawnEntity({ type: 'MBullet', ...args, ax: x + 8, ay: y, ang: +(ang * 1.5) });
            
          }
          
        } else if (this.v('w1Mark') && ms >= this.v('w1Mark')) {
          
          // Just stopped shooting! Lockout!
          this.v('w1Mark', null);
          this.v('w1StartMark', null);
          this.v('w1LockMark', ms + Insp.w1LockMs);
          
          this.v('effects').add({ mark: ms + Insp.w1ShortLockPunishMs, type: 'spdMult', spdMult: Insp.w1ShortLockPunishSlow });
          this.v('effects').add({ mark: ms + Insp.w1LongLockPunishMs, type: 'spdMult', spdMult: Insp.w1LongLockPunishSlow });
          
        }
        
        if (a2) {
          
          if (ms >= this.v('w2ReadyMark')) {
            
            this.v('w2ReadyMark', ms + Insp.w2Duration + Insp.w2Delay);
            this.v('w2Mark', ms + Insp.w2Duration);
            this.v('w2EffectiveShootDuration', ms - (this.v('w1StartMark') || ms));
            
            let incAng = 0.029;
            let { x, y } = this.getRelVal(updData);
            let bulletArgs = { owner: this, team: 'ace', vel: 140, dmg: 3, bound: { form: 'circle', r: 5 }, lsMs: 2500, ax: x, ay: y };
            for (let ang of util.incCen(15, incAng)) {
              updData.spawnEntity({ type: 'MBullet', ...bulletArgs, ang: 0.5 + ang });
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
        
        insp.Ace.render.call(this, ud, draw);
        
        let { x, y } = this.getAbsVal(ud);
        let w2MsRemaining = this.v('w2ReadyMark') - ud.ms;
        let barW = Math.min(1, (Insp.w2Delay - w2MsRemaining) / Insp.w2Delay) * 16;
        draw.rectCen(x, y - 12, barW, 4, { fillStyle: (w2MsRemaining > 0) ? '#6060ff' : '#0000ff' });
        
      }
      
    })});
    let SlamKid = U.inspire({ name: 'SlamKid', insps: { Ace }, methods: (insp, Insp) => ({
      
      $slamSpd: 450 / Math.sqrt(2), $slamDelay: 690,
      $slamCharge1Ms: 300, $slamCharge2Ms: 630, $slamCharge3Ms: 750,
      $slamPunishMs: 1500, $slamPunishSlow: 0.25, $slamDecel: 550 / Math.sqrt(2),
      $missileVel: 550, $missileAcl: 800, $missileDmg: 2.1, $missilePDmg: [0.3,4.5],
      $shotgunCnt: 18, $shotgunInitAng: 0.023, $shotgunAng: 0.009,
      $shotgunSpd: 650, $shotgunDmg: 0.082, $shotgunPDmg: [0.09,0.28], $shotgunLsMs: 305,
      $shotgunSlamDelayMult: 0.55,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSlam' }),
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { ud: { ms }, w1Mark=ms, w1StartMark=null, w2Mark=ms, w2StartMark=null, slamSpd=Insp.slamSpd } = val;
        return Object.assign(...arr, { w1Mark, w1StartMark, w2Mark, w2StartMark, slamSpd });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [].concat(...arr)),
      aceUpdate: function(updData, { a1, a2 }) {
        
        let { aheadDist, ms, spf } = updData;
        let forces = [];
        
        // Slam Kid is symmetrical; do the same thing in two directions:
        let dirs = [ [ -1, a1, 'w1Mark', 'w1StartMark' ], [ +1, a2, 'w2Mark', 'w2StartMark' ] ];
        for (let [ mult, act, wMark, wMarkStart ] of dirs) {
          
          if (act && ms > this.v(wMark) && (!this.v(wMarkStart) || ms < this.v(wMarkStart) + Insp.slamCharge3Ms)) {
            
            if (!this.v(wMarkStart)) {
              this.v(wMarkStart, ms);
              
              let inc1 = 10; let inc2 = 20;
              let args = { slamKid: this, dir: mult };
              updData.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: +inc2 + (mult * 20), yOff: (-inc2 * mult) + 16 });
              updData.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: +inc1 + (mult * 20), yOff: (-inc1 * mult) + 16 });
              updData.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff:     0 + (mult * 20), yOff: (    0 * mult) + 16 });
              updData.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: -inc1 + (mult * 20), yOff: (+inc1 * mult) + 16 });
              updData.spawnEntity({ type: 'SlamKidSlammer', ...args, xOff: -inc2 + (mult * 20), yOff: (+inc2 * mult) + 16 });
              
            }
            
            let duration = ms - this.v(wMarkStart);
            let durFade = Math.pow(util.fadeAmt(1, 0.1, duration / Insp.slamCharge3Ms), 0.95);
            let spd = this.v('slamSpd');
            forces.push([ this.v(wMarkStart), 'acl', spd * mult, spd, Insp.slamDecel * mult * -1, Insp.slamDecel * -1 ]);
            
          } else if (this.v(wMarkStart)) {
            
            let duration = ms - this.v(wMarkStart);
            if (duration >= Insp.slamCharge3Ms){
              
              // Nothing right now for exceeding charge duration
              this.v(wMark, ms + Insp.slamDelay);
              
            } else if (duration >= Insp.slamCharge2Ms) {
              
              // No effect for releasing in the last part of the charge
              this.v(wMark, ms + Insp.slamDelay);
              
            } else if (duration >= Insp.slamCharge1Ms) {
              
              // Missile!!
              let { x, y } = this.getRelVal(updData);
              let missileArgs = {
                owner: this, team: 'ace',
                ax: x + (mult * 9), ay: y,
                vel: Insp.missileVel, acl: Insp.missileAcl,
                dmg: Insp.missileDmg, pDmg: Insp.missilePDmg,
                bound: { form: 'rect', w: 5, h: 18 },
                lsMs: 2000
              };
              updData.spawnEntity({ type: 'MBullet', ...missileArgs, ang: 0.0 });
              updData.spawnEntity({ type: 'MBullet', ...missileArgs, ang: 0.5 });
              
              this.v('effects').add({ mark: ms + 150, type: 'force', force: [ ms, 'vel', 0, -220 ] });
              this.v(wMark, ms + Insp.slamDelay);
              
            } else {
              
              // Shotgun!
              let { x, y } = this.getRelVal(updData);
              let shotgunArgs = {
                aheadDist, ms, owner: this, team: 'ace', ax: x + mult * 7, ay: y - 7,
                dmg: Insp.shotgunDmg, pDmg: Insp.shotgunPDmg,
                vel: Insp.shotgunSpd,
                lsMs: Insp.shotgunLsMs,
                bound: { form: 'circle', r: 2 }
              };
              for (let ang of util.incCen(Insp.shotgunCnt, Insp.shotgunAng)) updData.spawnEntity({
                type: 'MBullet', ...shotgunArgs, ang: mult * (0.125 + ang)
              });
              
              this.v('effects').add({ mark: ms + 300, type: 'spdMult', spdMult: 1.2 });
              this.v('effects').add({ mark: ms + 300, type: 'force', force: [ ms, 'vel', -50 * mult, -50 ] });
              
              this.v(wMark, ms + Insp.slamDelay * Insp.shotgunSlamDelayMult);
              
            }
            
            this.v(wMarkStart, null);
            
          }
          
        }
        
        let spdMult = (this.w1StartMark || this.w2StartMark) ? 0.55 : 1;
        return { spdMult, forces };
        
      }
      
    })});
    let SalvoLad = U.inspire({ name: 'SalvoLad', insps: { Ace }, methods: (insp, Insp) => ({
      
      $comboDelayMs: 800, $comboPunishDelayMs: 1000,
      $decampDelayMs: 1200, $decampDurationMs: 350, $decampSpdMult: 0.5, $decampSpd: 430,
      $diveDelayMs: 600, $diveMs: 700, $diveSpdMult: 0.58, $diveFwdMult: 450, $diveBombLsMs: 1200,
      $missileDelayMs: 600, $missileDmg: 0.5, $missilePDmg:  [0.1,2],
      $suppressDelayMs: 600, $suppressDmg: 0.4,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSalvo' }),
      
      initProps: insp.allArr('initProps', (i, arr) => Object.assign(...arr, {
        readyMark: null,
        combo: '',
        a1Up: false,
        a2Up: false,
        comboMapping: {
          '<<<': i.comboDecamp.bind(i, -1),
          '>>>': i.comboDecamp.bind(i, +1),
          
          '<<>': i.comboDiveBomb.bind(i, -1),
          '>><': i.comboDiveBomb.bind(i, +1),
          
          '<>>': i.comboMissiles.bind(i, -1),
          '><<': i.comboMissiles.bind(i, +1),
          
          '<><': i.comboSuppress.bind(i, -1),
          '><>': i.comboSuppress.bind(i, +1)
        }
      })),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'readyMark', 'combo' ].concat(...arr)),
      comboDecamp: function(dir, ud) {
        
        this.v('invulnMark', v => Math.max(v, ud.ms + Insp.decampDurationMs));
        this.v('effects').add({ mark: ud.ms + Insp.decampDurationMs, type: 'force', force: [ ud.ms, 'vel', Insp.decampSpd * dir, 0 ] });
        this.v('effects').add({ mark: ud.ms + Insp.decampDurationMs, type: 'spdMult', spdMult: Insp.decampSpdMult });
        
        let { x, y } = this.getRelVal(ud);
        let missileArgs = { salvoLad: this, team: 'ace', ax: x, ay: y };
        ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 + dir * 0.000, vel: 15, lsMs:  400, kaboomArgs: { dps: 4.75, lsMs: 1900 } });
        ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 + dir * 0.005, vel: 60, lsMs:  700, kaboomArgs: { dps: 4.75, lsMs: 2300 } });
        ud.spawnEntity({ type: 'SalvoLadDumbBomb', ...missileArgs, ang: 0.5 - dir * 0.005, vel: 70, lsMs: 1050, kaboomArgs: { dps: 4.75, lsMs: 2150 } });
        
        return { delayMs: Insp.decampDelayMs };
        
      },
      comboDiveBomb: function(dir, { ms, spf, aheadDist }) {
        
        this.v('effects').add({ mark: ms + Insp.diveMs, type: 'spdMult', spdMult: Insp.diveSpdMult });
        this.v('effects').add({ mark: ms + Insp.diveMs, type: 'force', force: [ ms, 'acl', 150 * dir, 0, 0, 750 ] });
        this.v('effects').add({ mark: ms + Insp.diveMs,
          endFn: (i, ud) => {
            let { x, y } = i.getRelVal(ud);
            let missileArgs = { type: 'SalvoLadDumbBomb', salvoLad: i, team: 'ace', ax: x, ay: y };
            ud.spawnEntity({ ...missileArgs, ang: dir * 0.109, vel: 140, lsMs: Insp.diveBombLsMs * 1.010, kaboomArgs: { dps: 4.75, lsMs: 1900 } });
            ud.spawnEntity({ ...missileArgs, ang: dir * 0.078, vel: 158, lsMs: Insp.diveBombLsMs * 1.000, kaboomArgs: { dps: 4.75, lsMs: 2300 } });
            ud.spawnEntity({ ...missileArgs, ang: dir * 0.030, vel: 148, lsMs: Insp.diveBombLsMs * 0.989, kaboomArgs: { dps: 4.75, lsMs: 2150 } });
          }
        });
        return { birth: [], delayMs: Insp.diveDelayMs };
        
      },
      comboMissiles: function(dir, ud) {
        
        let args = { owner: this, team: 'ace', w: 6, h: 16, vel: 700, ang: 0, horzMs: 400, delayMs: 120, dmg: Insp.missileDmg, pDmg: Insp.missilePDmg };
        Array.fill(5, n => n).forEach(n => {
          this.v('effects').add({ mark: ud.ms + 50 + n * 30, endFn: (i, ud) => ud.spawnEntity({
            type: 'SalvoLadMissile', ...args, ...i.getRelVal(ud).slice({ ax: 'x', ay: 'y' }),
            horzSpd: (115 + 30 * (n + 1)) * dir
          })});
        });
        return { delayMs: Insp.missileDelayMs };
        
      },
      comboSuppress: function(dir, ud) {
        
        this.v('effects').add({ mark: ud.ms + 500, type: 'spdMult', spdMult: 1.5 });
        
        let args = { team: 'ace', ang: dir * 0.11, dmg: Insp.suppressDmg, bound: { form: 'circle', r: 4 }, lsMs: 500, vel: 360, acl: 800 };
        for (let i = 0; i < 11; i++) {
          let alt = i % 4;
          this.v('effects').add({ mark: ud.ms + 50 + i * alt * 18, endFn: (i, ud) => {
            let { x, y } = i.getRelVal(ud);
            x += 6 * alt * dir;
            y += 30 - 12 * alt
            ud.spawnEntity({ type: 'MBullet', owner: i, ...args, ax: x, ay: y });
          }});
        }
        return { delayMs: Insp.suppressDelayMs };
        
      },
      aceUpdate: function(updData, { a1, a2 }) {
        
        let { ms, spf } = updData;
        
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
            let comboResult = this.v('comboMapping')[this.v('combo')](updData);
            this.v('readyMark', ms + comboResult.delayMs);
          } else if (this.v('combo').length >= 5) {
            this.v('effects').add({ mark: ms + Insp.comboPunishDelayMs, type: 'spdMult', spdMult: 0.45 });
            this.v('readyMark', ms + Insp.comboDelayMs);
          }
          
        }
        
      },
      
      render: function(updData, draw) {
        
        insp.Ace.render.call(this, updData, draw);
        
        let { x, y } = this.getAbsVal(updData);
        let readyMark = this.v('readyMark');
        let combo = this.v('combo');
        
        let waitMs = readyMark - updData.ms;
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
          for (c of combo) {
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
    let JoustManBullet = U.inspire({ name: 'JoustManBullet', insps: { MBullet }, methods: (insp, Insp) => ({
      render: function(ud, draw) {
        let { x, y } = this.getAbsVal(ud);
        let r = this.v('bound').r;
        draw.circ(x, y, r,       { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      }
    })});
    let JoustManLaserSphere = U.inspire({ name: 'JoustManLaserSphere', insps: { Entity }, methods: (insp, Insp) => ({
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { xOff, yOff, r, dps, joustMan=null, joustManUid=joustMan.uid, team } = val;
        return Object.assign(...arr, { xOff, yOff, r, dps, joustMan, joustManUid, team });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'xOff', 'yOff', 'r', 'joustManUid' ].concat(...arr)),
      getCollideResult: function(ud, tail) {
        if (U.isInspiredBy(tail, Mortal)) tail.takeDamage(ud, this.r(ud, 'joustMan'), this.dps * ud.spf);
      },
      getRelVal: function(ud) {
        let { x, y } = this.r(ud, 'joustMan').getRelVal(ud);
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
          && insp.Entity.isAlive.call(this, ud)
          && this.r(ud, 'joustMan').isAlive(ud);
      },
      render: function(ud, draw) {
        let { x, y } = this.getAbsVal(ud);
        let r = this.v('r');
        draw.circ(x, y, r, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      }
      
    })});
    let JoustManLaserVert = U.inspire({ name: 'JoustManLaserVert', insps: { Entity }, methods: (insp, Insp) => ({
      
      $dps: 12, $w: 26, $h: 1200,
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { joustMan=null, joustManUid=joustMan.uid, team } = val;
        return Object.assign(...arr, { joustMan, joustManUid, team });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'joustManUid' ].concat(...arr)),
      getCollideResult: function(ud, tail) {
        if (U.isInspiredBy(tail, Mortal)) tail.takeDamage(ud, this.r(ud, 'joustMan'), Insp.dps * ud.spf);
      },
      getRelVal: function(ud) {
        let { x, y } = this.r(ud, 'joustMan').getRelVal(ud);
        return { x, y: y + 8 + Insp.h * 0.5 };
      },
      getStepResult: function(ud) {
        let { x, y } = this.getAbsVal(ud);
        return { tangibility: {
          bound: { form: 'rect', w: Insp.w, h: Insp.h, x, y },
          team: this.v('team'),
          sides: [ 'head' ]
        }};
      },
      isAlive: function(ud) {
        return true
          && insp.Entity.isAlive.call(this, ud)
          && this.r(ud, 'joustMan').isAlive(ud);
      },
      render: function (ud, draw) {
        let { x, y } = this.getAbsVal(ud);
        draw.rectCen(x, y, Insp.w, Insp.h, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.rectCen(x, y, Insp.w * 0.6, Insp.h, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      }
      
    })});
    let SlamKidSlammer = U.inspire({ name: 'SlamKidSlammer', insps: { Entity }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 7 }, $dmg: 1.4,
      $render: (draw, updData, { x, y, ggg }) => {
        draw.circ(x, y, Insp.bound.r, { fillStyle: Bullet.getColour(+1) });
      },
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { team, slamKid=null, slamKidUid=slamKid.uid, dir, xOff, yOff, integrity=1 } = val;
        return Object.assign(...arr, { team, slamKid, slamKidUid, dir, xOff, yOff, integrity });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'slamKidUid', 'xOff', 'yOff' ].concat(...arr)),
      getCollideResult: function(ud, tail) {
        if (U.isInspiredBy(tail, Mortal)) {
          tail.takeDamage(ud, this.r(ud, 'slamKid'), Insp.dmg);
          this.v('integrity', 0);
        }
      },
      getRelVal: function(ud) {
        let { x, y } = this.r(ud, 'slamKid').getRelVal(ud);
        return { x: x + this.v('xOff'), y: y + this.v('yOff') };
      },
      getStepResult: function(ud) {
        let { x, y } = this.getAbsVal(ud);
        return { tangibility: {
          bound: { ...Insp.bound, x, y },
          team: this.v('team'),
          sides: [ 'head' ]
        }};
      },
      isAlive: function(ud) {
        if (this.v('integrity') <= 0) return false;
        let sk = this.r(ud, 'slamKid');
        return true
          && sk.isAlive(ud) // SlamKid is alive
          && sk.v((this.v('dir') === -1) ? 'w1StartMark' : 'w2StartMark') // Slammer is held
      },
      
      render: function(ud, draw) {
        let { x, y } = this.getAbsVal(ud);
        draw.circ(x, y, Insp.bound.r, { fillStyle: '#ff8000' });
      },
      
    })});
    let SalvoLadDumbBomb = U.inspire({ name: 'SalvoLadDumbBomb', insps: { Entity, Mover }, methods: (insp, Insp) => ({
      
      $r: 13,
      $render: (draw, updData, { x, y }) => {
        draw.circ(x, y, Insp.r, { fillStyle: '#ff0000', strokeStyle: '#ff8400' });
      },
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { team=null, salvoLad=null, kaboomArgs={} } = val;
        return Object.assign(...arr, { team, salvoLad, kaboomArgs });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [].concat(...arr)),
      getStepResult: function(updData) {
        let { x, y } = this.getAbsVal(updData);
        return { tangibility: {
          bound: { form: 'circle', r: Insp.r, x, y },
          team: this.v('team'),
          sides: []
        }};
      },
      getDieResult: function(ud) {
        let { x, y } = this.getRelVal(ud);
        let iy = ud.bounds.total.y;
        ud.spawnEntity({ type: 'SalvoLadKaboom', team: this.v('team'), salvoLad: this.r(ud, 'salvoLad'), ax: x, ay: y, iy, ...this.kaboomArgs });
      },
      isAlive: insp.Entity.isAlive
    })});
    let SalvoLadKaboom = U.inspire({ name: 'SalvoLadKaboom', insps: { Entity }, methods: (insp, Insp) => ({
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { team=null, salvoLad=null, ax, ay, r=0, dps=3.1, sizePerSec=30, lsMs=null } = val;
        /// {ABOVE=
        if (lsMs === null) throw Error(`Kaboom without lsMs`);
        /// =ABOVE}
        return Object.assign(...arr, { team, salvoLad, ax, ay, r, dps, sizePerSec });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'ax', 'ay', 'sizePerSec' ].concat(...arr)),
      getRelVal: function(ud) {
        return {
          x: this.v('ax'), y: this.v('ay'),
          r: this.v('sizePerSec') * this.getAgeMs(ud) * 0.001
        };
      },
      getCollideResult: function(ud, tail) {
        if (U.isInspiredBy(tail, Mortal)) tail.takeDamage(ud, this.v('salvoLad'), this.v('dps') * ud.spf);
      },
      getStepResult: function(updData) {
        let { x, y, r } = this.getAbsVal(updData);
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
    let SalvoLadMissile = U.inspire({ name: 'SalvoLadMissile', insps: { MBullet }, methods: (insp, Insp) => ({
      
      initProps: insp.allArr('initProps', (i, arr, val) => Object.assign(...arr, ({ horzSpd: 0, horzMs: 0, delayMs: 0, bound: { form: 'rect', w: 3, h: 14 } }).pref(val))),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'horzSpd', 'horzMs', 'delayMs' ].concat(...arr)),
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
          y = insp.MBullet.getRelVal.call(this, ud, ud.ms - (horzMs + delayMs)).y;
        }
        
        return { x, y };
        
      }
      
    })});
    
    // BAD GUYS
    let Enemy = U.inspire({ name: 'Enemy', insps: { Mortal }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, { imageKeep, x, y, w, h=w, rot=Math.PI }) => {
        draw.frame(() => {
          draw.trn(x, y);
          if (rot) draw.rot(rot);
          draw.imageCen(imageKeep, 0, 0, w, h);
        });
      },
      
      initProps: insp.allArr('initProps', (i, arr) => Object.assign(...arr, { scoreDamage: 0 })),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [].concat(...arr)),
      getCollideResult: function(updData, ent) {
        console.log(`${U.nameOf(this)} -> ${U.nameOf(ent)}`);
        if (U.isInspiredBy(ent, Mortal)) ent.takeDamage(updData, this, 1);
      },
      getStepResult: function(updData) {
        
        let { x, y } = this.getAbsVal(updData);
        return {
          tangibility: {
            bound: { form: 'circle', x, y, r: 30 },
            team: 'enemy',
            sides: [ 'head', 'tail' ]
          }
        };
        
      },
      isAlive: insp.Mortal.isAlive,
      
      render: function(updData, draw) {
        
        let { x, y, r=null } = this.getAbsVal(updData);
        
        if (r === null && this.constructor.bound && this.constructor.bound.r) r = this.constructor.bound.r;
        if (r === null) r = 8;
        draw.circ(x, y, r, { fillStyle: '#00a000' });
        
      }
      
    })});
    let Spawner = U.inspire({ name: 'Spawner', methods: (insp, Insp) => ({
      
      init: C.noFn('init'),
      getSpawnTypes: function() { return { spawn: { type: this.constructor.name } }; },
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let spawnTypes = i.getSpawnTypes();
        let props = {};
        for (let st in spawnTypes) {
          props[`${st}Mode`] = val.has(`${st}Mode`) ? val[`${st}Mode`] : 'steady';
          props[`${st}DelayMs`] = val.has(`${st}DelayMs`) ? val[`${st}DelayMs`] : 2500;
          props[`${st}Props`] = spawnTypes[st].gain(val.has(`${st}Props`) ? val[`${st}Props`] : {});
          props[`${st}Mark`] = val.ud.ms + (val.has(`${st}InitDelayMs`) ? val[`${st}InitDelayMs`] : props[`${st}DelayMs`]);
        }
        return Object.assign(...arr, props, { spawnTypes: spawnTypes.toArr((v, k) => k) });
      }),
      doSpawn: function(updData, spawnType, state, props) {
        let { ms } = updData;
        return updData.spawnEntity({ ms, ...props, owner: this, ...state.slice('x', 'y') });
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
    
    let Winder = U.inspire({ name: 'Winder', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 20 }, $hp: 1,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWinder' }),
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { x, y, ax=x, ay=y, spd=100, delayMs=0, phase=0, swingHz=0, swingAmt=0, numSwings=0 } = val;
        if (swingHz < 0) throw Error(`Negative "swingHz" param; use negative "swingAmt" instead`);
        return Object.assign(...arr, { ax, ay, spd, delayMs, phase, swingHz, swingAmt, numSwings });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'ax', 'ay', 'spd', 'delayMs', 'phase', 'swingHz', 'swingAmt' ].concat(...arr)),
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
      getStepResult: function(updData) {
        let { x, y } = this.getAbsVal(updData);
        return {
          tangibility: {
            bound: { ...this.constructor.bound, x, y },
            team: 'enemy',
            sides: [ 'head', 'tail' ]
          }
        };
      },
      isAlive: function(updData) {
        if (!insp.Enemy.isAlive.call(this, updData)) return false;
        
        let { bounds } = updData;
        let durMs = this.getAgeMs(updData);
        
        if (this.v('numSwings') && ((durMs - this.delayMs) * 0.001 * this.v('swingHz') > this.v('numSwings')))
          return false;
        
        let { y } = this.getAbsVal(updData);
        if (this.v('spd') > 0 && y > bounds.total.t + 30) return false;
        if (this.v('spd') < 0 && y < bounds.total.b - 30) return false;
        
        return true;
      },
      
      render: function(updData, draw) {
        
        let { x, y } = this.getAbsVal(updData);
        let ext = this.constructor.bound.r * 2;
        draw.frame(() => {
          draw.trn(x, y);
          draw.rot((this.v('spd') < 0) ? Math.PI : 0);
          draw.imageCen(this.constructor.imageKeep, 0, 0, ext, ext);
        });
        
      }
      
    })});
    let Weaver = U.inspire({ name: 'Weaver', insps: { Winder }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 34 }, $hp: 8,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWeaver' }),
      $render: (draw, updData, vals) => {
        Insp.parents.Winder.render(draw, updData, { imageKeep: Insp.imageKeep, ext: Insp.bound.r << 1, ...vals });
      },
      
    })});
    let Furler = U.inspire({ name: 'Furler', insps: { Winder, Spawner }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 24 }, $hp: 4,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyFurler' }),
      $render: (draw, updData, vals) => {
        Insp.parents.Winder.render(draw, updData, { imageKeep: Insp.imageKeep, ext: Insp.bound.r << 1, ...vals });
      },
      
      getSpawnTypes: function() {
        return {
          shoot: { type: 'MBullet', vel: 150, ang: 0.5, dmg: 1, lsMs: 3000, bound: { form: 'rect', w: 3, h: 12 } }
        };
      },
      initProps: insp.allArr('initProps', (i, arr) => Object.assign(...arr)),
      syncProps: insp.allArr('syncProps', (i, arr) => [].concat(...arr)),
      doSpawn: function(updData, spawnType, state, props) {
        
        if (spawnType !== 'shoot')
          return insp.Spawner.doSpawn.call(this, updData, spawnType, state, props);
        
        let { x, y } = state;
        let b1 = updData.spawnEntity({ ...props, team: 'enemy', owner: this, ax: x - Insp.bound.r * 0.55, ay: y });
        let b2 = updData.spawnEntity({ ...props, team: 'enemy', owner: this, ax: x + Insp.bound.r * 0.55, ay: y });
        
      },
      getStepResult: function(updData) {
        
        insp.Spawner.getStepResult.call(this, updData);
        return insp.Winder.getStepResult.call(this, updData);
        
        /*
        let { aheadDist, ms } = updData;
        if (ms >= this.shootMark) {
          this.shootMark += this.shootDelayMs;
          let bulletOff = Insp.bound.r * 0.5;
          let { x, y } = this.getRelVal(updData);
          updData.spawnEntity({
            type: 'SimpleBullet', ms, owner: this, x: x - bulletOff, y: y - updData.bounds.total.y,
            spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
            ...this.bulletArgs
          });
          updData.spawnEntity({
            type: 'SimpleBullet', ms, owner: this, x: x + bulletOff, y: y - updData.bounds.total.y,
            spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
            ...this.bulletArgs
          });
        }
        
        return insp.Winder.getStepResult.call(this, updData);
        */
      }
      
    })});
    let Drifter = U.inspire({ name: 'Drifter', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyDrifter' }),
      $render: (draw, updData, { x, y, vy, r }) => {
        
        Insp.parents.Enemy.render(draw, updData, { imageKeep: Insp.imageKeep, x, y,
          w: r * 2,
          rot: (vy <= 0) ? Math.PI : 0
        });
        
      },
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { initHp=2, minSize=16, hpPerSec=1.33, sizeMult=1.75 } = val;
        return Object.assign(...arr, { initHp, minSize, hpPerSec, sizeMult, dist: null });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'initHp', 'hpDmg', 'minSize', 'hpPerSec', 'sizeMult' ].concat(...arr)),
      getRelVal: function(updData) {
        
        let { x, y } = insp.Mover.getRelVal.call(this, updData);
        let hpLost = this.v('hpDmg');
        let sizeMult = this.v('sizeMult');
        let minSize = this.v('minSize');
        
        return { x, y, r: minSize + (this.getMaxHp(updData) - hpLost) * sizeMult };
        
      },
      getMaxHp: function(ud) {
        return this.v('initHp') + this.v('hpPerSec') * this.getAgeMs(ud) * 0.001;
      },
      getStepResult: function(updData) {
        
        let { x, y, r } = this.getAbsVal(updData);
        this.x = x; this.y = y;
        return { tangibility: {
          bound: { form: 'circle', x, y, r },
          team: 'enemy',
          sides: [ 'head', 'tail' ]
        }};
        
      },
      isAlive: function(updData) {
        return true
          && insp.Enemy.isAlive.call(this, updData)
          && insp.Mover.isAlive.call(this, updData);
      },
      
      render: insp.Enemy.render
      
    })});
    let Wanderer = U.inspire({ name: 'Wanderer', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 22 }, $maxHp: 4.5,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWanderer' }),
      $render: (draw, updData, { x, y, vy }) => {
        Insp.parents.Enemy.render(draw, updData, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.r << 1,
          rot: (vy <= 0) ? Math.PI : 0
        });
      },
      
      // TODO: HEEERE! Replace "getSyncProps", "initEntity", "init",
      // with "initProps" and "initSyncs"! Allow "getRelVal" to return
      // relative coordinates, and a reference to the "node" the Entity
      // is considered relative to!
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { ud: { ms }, mode='steady', shootDelayMs=2500, shootDelayInitMs=shootDelayMs, bulletArgs={} } = val;
        return Object.assign(...arr, { mode, shootDelayMs, bulletArgs, shootMark: ms + shootDelayInitMs });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [].concat(...arr)),
      getMaxHp: function() { return Insp.maxHp; },
      getStepResult: function(updData) {
        let { x, y } = this.getRelVal(updData);
        let { ms, spf } = updData;
        let birth = [];
        
        let shootCondition = (this.v('mode') === 'steady')
          ? (ms >= this.v('shootMark'))
          : (Math.random() < ((spf * 1000) / this.v('shootDelayMs')));
        
        if (shootCondition) {
          updData.spawnEntity({ type: 'SimpleBullet', ms, owner: this, x, y,
            spd: -380, dmg: 1, w: 8, h: 20,
            lsMs: 3000
          });
          this.v('shootDelayMs', v => v + this.delayMs);
        }
        
        return { tangibility: {
          bound: { ...Insp.bound, x, y },
          team: 'enemy',
          sides: [ 'head', 'tail' ]
        }};
        
      },
      isAlive: insp.allArr('isAlive', (i, arr) => !arr.find(alive => !alive))
      
    })});
    let WinderMom = U.inspire({ name: 'WinderMom', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'rect', w: 160, h: 160 }, $maxHp: 90,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWinderMom' }),
      $render: (draw, updData, { x, y }) => {
        Insp.parents.Enemy.render(draw, updData, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.w, h: Insp.bound.h
        });
      },
      
      initProps: C.noFn('initProps'),
      initSyncs: C.noFn('initSyncs'),
      getMaxHp: function() { return Insp.maxHp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      getStepResult: function(updData) {
        
        this.moveToDestination(updData);
        let { ms } = updData;
        
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
      isAlive: function(updData) {
        return true
          && insp.Enemy.isAlive.call(this, updData)
          && insp.Mover.isAlive.call(this, updData);
      }
      
    })});
    let WandererMom = U.inspire({ name: 'WandererMom', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $bound: { form: 'rect', w: 150, h: 210 },
      $maxHp: 90, $numBullets: 7, $bulletSpd: 330,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWandererMom' }),
      $render: (draw, updData, { x, y }) => {
        Insp.parents.Enemy.render(draw, updData, { imageKeep: Insp.imageKeep, x, y,
          w: Insp.bound.w, h: Insp.bound.h
        });
      },
      
      initProps: C.noFn('initProps'),
      initSyncs: C.noFn('initSyncs'),
      getMaxHp: function() { return Insp.maxHp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      updateAndGetResult: function(updData) {
        
        this.moveToDestination(updData);
        
        let { aheadDist, ms, spf } = updData;
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
          
          let bulletArgs = { aheadDist, ms, owner: this, x: this.x, y: this.y, vel: Insp.bulletSpd, dmg: 1, r: 8 };
          birth.gain(Array.fill(Insp.numBullets, () => MBullet({
            ...bulletArgs, ang: 0.5 + ((Math.random() - 0.5) * 2 * 0.05), lsMs: 3000
          })));
          
        }
        
        return { x: this.x, y: this.y, ...Insp.bound, birth };
        
      },
      isAlive: function(updData) {
        return true
          && insp.Enemy.isAlive.call(this, updData)
          && insp.Mover.isAlive.call(this, updData);
      }
      
    })});
    
    // LEVEL
    let Level = U.inspire({ name: 'Level', insps: { Entity }, methods: (insp, Insp) => ({
      
      $getLevelBounds: level => {
        
        // Total bound values
        let val = level.val;
        let thw = val.tw * 0.5; let tl = val.x - thw; let tr = val.x + thw;
        let thh = val.th * 0.5; let tb = val.y - thh; let tt = val.y + thh;
        
        // Player bound values
        let px = val.x + val.px;
        let py = val.y + val.py;
        let phw = val.pw * 0.5; let pl = px - phw; let pr = px + phw;
        let phh = val.ph * 0.5; let pb = py - phh; let pt = py + phh;
        
        return {
          total: { form: 'rect',
            x: val.x, y: val.y, w: val.tw, h: val.th,
            l: tl, r: tr, b: tb, t: tt
          },
          player: { form: 'rect',
            x: px, y: py, w: val.pw, h: val.ph,
            l: pl, r: pr, b: pb, t: pt
          }
        };
        
      },
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        
        let { levelDef=null } = val;
        let momentsDef = (levelDef ? levelDef.moments : []).toArr(v => v);
        
        let { ud: { ms }, flyHut, lives=5, outcome='none', aheadSpd=0, x=0, y=0 } = val;
        let { tw=280, th=350, px=0, py=0, pw=280, ph=350, visiMult=1 } = val;
        
        return Object.assign(...arr, {
          flyHut,
          momentsDef,
          currentMoment: null, resolveTimeout: null,
          outcome,
          lives, aheadSpd, x, y, tw, th, px, py, pw, ph, visiMult 
        });
        
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'lives', 'aheadSpd', 'x', 'y', 'tw', 'th', 'px', 'py', 'pw', 'ph', 'visiMult', 'outcome' ].concat(...arr)),
      
      getRelVal: function(ud) { return { x: this.v('x'), y: this.v('y') }; },
      getParent: function(ud) { return null; },
      update: function(ms, spf) {
        
        let timingMs = foundation.getMs();
        
        let entities = [ ...this.relNozz('fly.entity').set ]; // A snapshot
        let levelPlayers = this.relNozz('fly.levelPlayer').set;
        let flyHut = this.v('flyHut');
        
        let bounds = Insp.getLevelBounds(this); // TODO: Should become an instance method
        let updateData = {
          ms,
          spf,
          level: this,
          entities: entities.toObj(rec => [ rec.uid, rec ]),
          bounds,
          outcome: this.v('outcome'),
          spawnEntity: vals => flyHut.createRec('fly.entity', [ this ], { ...vals, ud: updateData })
        };
        
        let didLose = false;
        
        // Step 1: Update all Entities (tracking collidables and births)
        let collideTeams = {};
        let allEvents = [];
        for (let ent of entities) {
          
          // Allow the Model to update
          let stepResult = ent.getStepResult(updateData);
          
          if (!stepResult.has('tangibility')) throw Error(`${U.nameOf(ent)} missing "tangibility"`);
          if (!stepResult.tangibility.has('bound')) throw Error(`${U.nameOf(ent)} missing "tangibility.bound"`);
          if (!stepResult.tangibility.has('team')) throw Error(`${U.nameOf(ent)} missing "tangibility.team"`);
          if (!stepResult.tangibility.has('sides')) throw Error(`${U.nameOf(ent)} missing "tangibility.sides"`);
          
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
          let visible = geom.doCollideRect(bounds.total, geom.containingRect(stepResult.tangibility.bound));
          if (visible && !ent.sprite) {
            ent.sprite = flyHut.createRec('fly.sprite', [ this, ent ], 'visible');
          } else if (!visible && ent.sprite) {
            ent.sprite.dry();
            ent.sprite = null;
          }
          
          // Track this Model
          if (stepResult.tangibility.sides.length > 0) {
            let team = stepResult.tangibility.team;
            if (!collideTeams.has(team)) collideTeams[team] = { head: [], tail: [] };
            let coll = { ent, stepResult };
            for (let side of stepResult.tangibility.sides) collideTeams[team][side].push(coll);
          }
          
        }
        
        // Step 2: Collide all Teams against each together
        let tryCollide = (updateData, headCd, tailCd) => {
          if (!headCd.ent.isAlive(updateData) || !tailCd.ent.isAlive(updateData)) return;
          
          let bound1 = headCd.stepResult.tangibility.bound;
          let bound2 = tailCd.stepResult.tangibility.bound;
          if (!geom.doCollide(headCd.stepResult.tangibility.bound, tailCd.stepResult.tangibility.bound)) return;
          headCd.ent.getCollideResult(updateData, tailCd.ent);
          
        };
        collideTeams = collideTeams.toArr(v => v);
        let len = collideTeams.length;
        for (let i = 0; i < len - 1; i++) { for (let j = i + 1; j < len; j++) {
          
          let team1 = collideTeams[i]; let team2 = collideTeams[j];
          for (let head of team1.head) for (let tail of team2.tail) tryCollide(updateData, head, tail);
          for (let head of team2.head) for (let tail of team1.tail) tryCollide(updateData, head, tail);
          
        }}
        
        // Step 3: Check deaths and update "fly.entity" Records
        for (let entity of entities) {
          
          if (entity.isAlive(updateData)) continue;
          
          let isAce = U.isInspiredBy(entity, Ace);
          
          // Non-Aces are trivial to handle
          if (!isAce) entity.dry();
          
          // Aces have a more complex way of dying
          if (isAce && !entity.deathMarked) {
            
            entity.deathMarked = true;
            
            // Try to respawn (if enough lives are available)
            if (this.v('lives') > 0) {
              
              this.v('lives', v => v - 1);
              setTimeout(() => {
                
                let { player: pb, total: tb } = Level.getLevelBounds(this);
                entity.deathMarked = false;
                entity.v('hpDmg', 0);
                entity.v('invulnMark', this.v('ms') + Ace.invulnMs);
                entity.setAnchor(updateData, 0, (pb.y - tb.y) + pb.h * -0.2);
                
              }, Ace.respawnMs);
              
            } else {
              
              // Losing a life without any respawns
              didLose = true;
              
            }
            
          }
          
          // All deaths may have births, and short-circuit this stage
          entity.getDieResult(updateData);
          
        }
        
        // Step 4: Check for initial loss frame (`!this.resolveTimeout`)
        if (didLose && !this.v('resolveTimeout')) {
          
          // Update LevelPlayers with the stats from their Models
          for (let gp of levelPlayers) {
            for (let gpe of gp.relNozz('fly.levelPlayerEntity').set) {
              let ent = gpe.mems['fly.entity'];
              if (ent.isAlive(updateData)) rep.v('hpDmg', 1); // Kill remaining Aces
              gp.mems['fly.player'].modVal(v => (v.score = ent.v('scoreDamage'), v.deaths = ent.v('scoreDeath'), v));
            }
          }
          
          this.v('outcome', 'lose');
          this.v('resolveTimeout', setTimeout(() => this.dry(), 2500));
          
        }
        
        // Step 6: Advance as many Moments as possible (some may instantly cease standing)
        let currentMoment = this.v('currentMoment');
        let momentsDef = this.v('momentsDef');
        while (momentsDef.length && (!currentMoment || !currentMoment.isStanding(updateData))) {
          
          let nextMomentDef = momentsDef.shift();
          let newMoment = updateData.spawnEntity({ ...nextMomentDef, prevMoment: currentMoment });
          console.log(`Began moment: ${nextMomentDef.name} (${U.nameOf(newMoment)})`);
          
          // Apply global effects and update bounds
          newMoment.applyLevelEffects(this);
          bounds.gain(Level.getLevelBounds(this));
          
          // Allow the new Moment to setup under the new global settings
          // Note we pass the previous Moment
          newMoment.doSetup(updateData, currentMoment);
          
          // Consider this new moment the CurrentMoment
          currentMoment = newMoment;
          
        }
        
        // Step 7: Check victory condition; no Moments remaining
        let canWin = true;
        if (canWin && !this.v('resolveTimeout') && (!currentMoment || !currentMoment.isStanding(updateData))) {
          
          // Set up a Moment to fill in terrain as the victory occurs
          let newMoment = updateData.spawnEntity({
            type: 'MomentAhead',
            name: 'outcomeWin', terrain: currentMoment && currentMoment.v('terrain'),
            dist: 10000, spd: (currentMoment ? currentMoment.spd : 100) * 2,
            models: [],
            prevMoment: currentMoment
          });
          
          newMoment.applyLevelEffects(this);
          bounds.gain(Level.getLevelBounds(this));
          
          newMoment.doSetup(updateData, currentMoment);
          
          currentMoment = newMoment;
          
          // Mark that victory has occurred
          this.v('outcome', 'win');
          this.v('resolveTimeout', setTimeout(() => {
            // Transfer Model stats to fly.player Records
            for (let gp of levelPlayers) {
              for (let gpe of gp.relNozz('fly.levelPlayerEntity').set) {
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
            this.dry();
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
            let t = U.nameOf(entity);
            types.set(t, (types.get(t) || 0) + 1);
          }
          for (let [ t, n ] of types) console.log(`    ${n.toString().padHead(3, ' ')} x ${t}`);
        }
        
      }
    })});
    let Moment = U.inspire({ name: 'Moment', insps: { Entity }, methods: (insp, Insp) => ({
      
      $imageKeeps: {
        meadow: foundation.getKeep('urlResource', { path: 'fly.sprite.bgMeadow' }),
        meadowToPlains: foundation.getKeep('urlResource', { path: 'fly.sprite.bgMeadowToPlains' }),
        plains: foundation.getKeep('urlResource', { path: 'fly.sprite.bgPlains' }),
        plainsToMeadow: foundation.getKeep('urlResource', { path: 'fly.sprite.bgPlainsToMeadow' })
      },
      $tileExt: 250,
      $renderPriority: () => 1,
      $render: (draw, updData, { type, bounds, minY, maxY, terrain }) => {
        
        if (!terrain) return;
        
        let tExt = Insp.tileExt;
        let imgKeep = Insp.imageKeeps[terrain];
        if (!imgKeep) throw Error(`Invalid terrain: ${terrain}`);
        
        let endMaxY = Math.min(maxY, bounds.total.t);
        
        let y = (minY > bounds.total.b)
          // Bottom of this Moment is visible; simply start from it!
          ? minY
          // Bottom of the Moment is cut off; subtract the cut amount
          : (bounds.total.b - ((bounds.total.b - minY) % Insp.tileExt));
        
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
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { name, models=[], terrain=null, bounds=null, aheadSpd=100, visiMult=1 } = val;
        return Object.assign(...arr, { name, models, terrain, bounds, aheadSpd, visiMult });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'name', 'terrain' ].concat(...arr)),
      getMinY: C.noFn('getMinY'),
      getMaxY: C.noFn('getMaxY'),
      getParent: function(ud) { return null; },
      getRelVal: function(updData) {
        let minY = this.getMinY(updData);
        let maxY = this.getMaxY(updData);
        return {
          x: 0, y: (minY + maxY) * 0.5,
          w: updData.bounds.total.w, h: maxY - minY
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
      doSetup: function(updData, prevMoment) {
        
        // Y-coordinate is relative to the top of the screen!
        let relY = updData.bounds.total.h * 0.5;
        for (let modelDef of this.models) {
          // Make the "y" property relative to the Moment's bottom
          updData.spawnEntity({ ud: updData, ...modelDef, y: relY + modelDef.y });
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
      render: function(updData, draw) {
        
        let terrain = this.v('terrain');
        let minY = this.getMinY(updData);
        let maxY = this.getMaxY(updData);
        let tb = updData.bounds.total;
        
        if (!terrain) return;
        
        let tExt = Insp.tileExt;
        let imgKeep = Insp.imageKeeps[terrain];
        if (!imgKeep) throw Error(`Invalid terrain: ${terrain}`);
        
        let endMaxY = Math.min(maxY, tb.t);
        let y = (minY > tb.b)
          // Bottom of this Moment is visible; simply start from it!
          ? minY
          // Bottom of the Moment is cut off; subtract the cut amount
          : (tb.b - ((tb.b - minY) % Insp.tileExt));
        
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
    let MomentAhead = U.inspire({ name: 'MomentAhead', insps: { Moment }, methods: (insp, Insp) => ({
      
      $render: Insp.parents.Moment.render,
      $renderPriority: Insp.parents.Moment.renderPriority,
      
      initProps: insp.allArr('initProps', (i, arr, val) => {
        let { ud, name, bounds, dist, prevMoment=null, startY=null } = val;
        if (startY === null) {
          startY = prevMoment ? prevMoment.getMaxY(ud) : (bounds.total.h * -0.5);
          //prevMoment ? prevMoment.getMaxY(ud) : ud.bounds.total.b
        }
        return Object.assign(...arr, { dist, startY });
      }),
      initSyncs: insp.allArr('initSyncs', (i, arr) => [ 'dist', 'startY' ].concat(...arr)),
      getMinY: function() { return this.v('startY'); },
      getMaxY: function() { return this.v('startY') + this.v('dist'); },
      isStanding: function(updData) {
        // A MomentAhead stands while its top hasn't become visible
        return this.getMaxY(updData) > updData.bounds.total.t;
      },
      isAlive: function(updData) {
        // A MomentAhead lives while its top hasn't been passed entirely
        // TODO: Keep MomentAhead instances alive for an additional 500
        // units??
        return (this.getMaxY(updData) + 500) > updData.bounds.total.b;
      }
      
    })});
    let MomentTargetType = U.inspire({ name: 'MomentTargetType', insps: { Moment }, methods: (insp, Insp) => ({
      
    })});
    
    // Ground buildings with 1-ups (need to slow down aheadSpd for this, or else they move toooo fast??)
    // Move whatever possible from MomentAhead into Moment, then fill out MomentTargetType
    
    let mdlClasses = {};
    mdlClasses.gain({ JoustMan, GunGirl, SlamKid, SalvoLad });
    mdlClasses.gain({ JoustManBullet, JoustManLaserSphere, JoustManLaserVert, SlamKidSlammer, SalvoLadDumbBomb, SalvoLadKaboom, SalvoLadMissile });
    mdlClasses.gain({ Winder, Weaver, Furler, WinderMom, WandererMom, Drifter, Wanderer });
    mdlClasses.gain({ MBullet });
    mdlClasses.gain({ Level, Moment, MomentAhead });
    
    let lobbyModelOptions = {
      joust: { name: 'Joust Man', size: [16,16], Cls: JoustMan },
      gun: { name: 'Gun Girl', size: [16,16], Cls: GunGirl },
      slam: { name: 'Slam Kid', size: [16,16], Cls: SlamKid },
      salvo: { name: 'Salvo Lad', size: [16,16], Cls: SalvoLad }
    };
    
    let open = async () => {
      
      let flyHut = global.hut = await foundation.getRootHut({ heartMs: 1000 * 20 });
      flyHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
      
      flyHut.addTypeClsFn('fly.level', val => mdlClasses.Level);
      flyHut.addTypeClsFn('fly.entity', val => {
        if (!mdlClasses.has(val.type)) {
          console.log(val);
          throw Error(`No model class for "${val.type}"`);
        }
        return mdlClasses[val.type];
      });
      
      let rootReal = await foundation.getRootReal();
      rootReal.layoutDef('fly', (real, insert, decals) => {
        
        real('root', MinExtSlotter);
        insert('* -> root', () => FillParent());
        insert('root -> main', sl => sl.getMinExtSlot());
        
        real('content1', () => TextSized({ size: UnitPc(2) }));
        real('content2', () => TextSized({ size: UnitPc(1.5) }));
        real('content3', () => TextSized({ size: UnitPc(1) }));
        real('paragraph', () => TextSized({ size: UnitPc(0.9), multiLine: true }));
        
        let centeredText = (name, cNames=[ 'content1', 'content2', 'content3', 'paragraph' ]) => {
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
        
        real('lobby', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.3) ] }));
        real('teamList', () => LinearSlotter({ axis: 'y', dir: '+' }));
        centeredText('lobbyTitle');
        centeredText('lobbyBackButton');
        
        real('teamMember', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('playerName', () => CenteredSlotter());
        real('modelList', () => LinearSlotter({ axis: 'x', dir: '+', scroll: false }));
        real('model', () => AxisSlotter({ axis: 'y', dir: '-', cuts: [ UnitPc(0.15) ] }));
        real('modelName', () => CenteredSlotter());
        real('score', () => CenteredSlotter());
        centeredText('playerName');
        centeredText('modelName');
        centeredText('score');
        insert('model -> modelName', sl => sl.getAxisSlot(0));
        insert('main -> lobby', () => FillParent());
        
        insert('lobby -> lobbyHeader',  sl => sl.getAxisSlot(0));
        insert('lobby -> mapChoice',    sl => sl.getAxisSlot(1));
        insert('lobby -> teamList',     sl => sl.getAxisSlot(2));
        
        // Lobby header
        real('lobbyHeader', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.15), UnitPc(0.7) ] }));
        real('lobbyTitle', () => CenteredSlotter());
        real('lobbyBackButton', () => CenteredSlotter());
        insert('lobbyHeader -> lobbyBackButton', sl => sl.getAxisSlot(0));
        insert('lobbyHeader -> lobbyTitle', sl => sl.getAxisSlot(1));
        
        // Map chooser
        real('mapChoice', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.01), UnitPc(0.24), UnitPc(0.01), UnitPc(0.73) ] }));
        
        real('mapChoiceEntry', () => AxisSlotter({ axis: 'y', dir: '+', cuts: [ UnitPc(0.2), UnitPc(0.3), UnitPc(0.05), UnitPc(0.3) ] }));
        real('mapChoiceField', () => TextSized({ size: UnitPc(2), interactive: true, desc: 'Passcode' }));
        real('mapChoiceButton', () => CenteredSlotter());
        insert('mapChoice -> mapChoiceEntry', sl => sl.getAxisSlot(1));
        insert('mapChoiceEntry -> mapChoiceField', sl => [ sl.getAxisSlot(1) ]);
        insert('mapChoiceEntry -> mapChoiceButton', sl => [ sl.getAxisSlot(3) ]);
        
        real('mapChoiceContentHolder', () => CenteredSlotter());
        real('mapChoiceContent', () => LinearSlotter({ axis: 'y', dir: '+' }));
        real('mapChoiceTitle', () => CenteredSlotter());
        real('mapChoiceDesc', () => CenteredSlotter());
        insert('mapChoice -> mapChoiceContentHolder', sl => sl.getAxisSlot(3));
        insert('mapChoiceContentHolder -> mapChoiceContent', sl => sl.getCenteredSlot());
        insert('mapChoiceContent -> mapChoiceTitle', sl => sl.getLinearSlot());
        insert('mapChoiceContent -> mapChoiceDesc', sl => sl.getLinearSlot());
        centeredText('mapChoiceButton');
        centeredText('mapChoiceTitle');
        centeredText('mapChoiceDesc');
        
        // Player list
        insert('teamList -> teamMember',    sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1), UnitPc(1/4)) ]);
        insert('teamMember -> playerName',  sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('teamMember -> modelList',   sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.6), UnitPc(1)) ]);
        insert('teamMember -> score',       sl => [ sl.getLinearSlot(), FixedSize(UnitPc(0.2), UnitPc(1)) ]);
        insert('modelList -> model', sl => [ sl.getLinearSlot(), FixedSize(UnitPc(1/4), UnitPc(1)) ]);
        insert('playerName -> content1', sl => sl.getCenteredSlot());
        insert('score -> content1', sl => sl.getCenteredSlot());
        
        real('level', () => AxisSlotter({ axis: 'x', dir: '+', cuts: [ UnitPc(0.1), UnitPc(0.8) ] }));
        real('levelLInfo', () => CenteredSlotter());
        real('levelContent', () => Art({ pixelCount: [ 800, 1000 ] }));
        real('levelRInfo', () => CenteredSlotter());
        real('levelDispLives', () => TextSized({ size: UnitPc(0.8) }));
        insert('main -> level', () => FillParent());
        insert('level -> levelLInfo', sl => sl.getAxisSlot(0));
        insert('level -> levelContent', sl => sl.getAxisSlot(1));
        insert('level -> levelRInfo', sl => sl.getAxisSlot(2));
        insert('levelLInfo -> levelDispLives', sl => sl.getCenteredSlot());
        
        decals('lobbyHeader', { colour: 'rgba(0, 0, 0, 0.15)' });
        decals('teamList', { colour: 'rgba(0, 0, 0, 0.07)' });
        decals('lobbyChooserButton', { colour: '#d0d0d0' });
        decals('lobbyBackButton', { colour: 'rgba(0, 0, 0, 0.5)', textColour: '#ffffff' });
        decals('playerName', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('mapChoiceButton', { colour: 'rgba(0, 0, 0, 0.1)' });
        decals('score', { colour: 'rgba(0, 0, 0, 0.2)' });
        decals('level', { colour: '#000000', textColour: '#ffffff' });
        decals('levelLInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        decals('levelRInfo', { colour: 'rgba(255, 0, 0, 0.2)' });
        
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
      let testLevel = null;
      /// =ABOVE}
      
      let rootScp = RecScope(flyHut, 'fly.fly', async (fly, dep) => {
        
        /// {ABOVE=
        
        // Manage Huts
        dep.scp(flyHut, 'lands.kidHut/par', ({ mems: { kid: hut } }, dep) => {
          
          let kidHutDep = dep;
          let { value: term } = dep(termBank.checkout());
          let player = dep(flyHut.createRec('fly.player', [], { term, name: null, score: 0, deaths: 0 }));
          let hutPlayer = flyHut.createRec('fly.hutPlayer', [ hut, player ]);
          
          let lobbyPlayerNozz = player.relNozz('fly.lobbyPlayer');
          let lobbyPlayerDryNozz = dep(TubDry(null, lobbyPlayerNozz));
          dep.scp(lobbyPlayerDryNozz, (noLevel, dep) => {
            
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
                  
                  // Level values
                  level: getLevelData('rustlingMeadow'),
                  
                  // The time in millis all Players signalled ready (or
                  // `null`, if a Player isn't ready)
                  allReadyMs: null
                });
                
                // This route only occurs when the Lobby is initially
                // created. It waits for the Lobby to be non-empty, then
                // waits for it to become empty again (at which point
                // the Lobby is cleaned up).
                let lobbyHasPlayerNozz = lobby.relNozz('fly.lobbyPlayer');
                let lobbyNoPlayersNozz = TubDry(null, lobbyHasPlayerNozz); // Don't `dep` this
                let route = lobbyHasPlayerNozz.route(() => {
                  route.dry();
                  lobbyNoPlayersNozz.route(() => lobby.dry());
                });
              }
              
              if (lobby.relNozz('fly.lobbyPlayer').set.size >= 4) throw Error('Lobby full');
              
              flyHut.createRec('fly.lobbyPlayer', [ lobby, player ], { model: null });
              
            }));
            
          });
          dep.scp(lobbyPlayerNozz, (lobbyPlayer, dep) => {
            
            dep(hut.roadNozz('lobbyPass').route(({ msg: { pass } }) => {
              let [ level=null, levelName ] = levels.find(v => v.password === pass) || [];
              if (!level) return;
              
              let lobby = lobbyPlayer.mems['fly.lobby'];
              for (let lp of lobby.relNozz('fly.lobbyPlayer').set) lp.modVal(v => (v.model = null, v));
              lobby.modVal(v => (v.level = getLevelData(levelName), v));
            }));
            
          });
          
          // Follows
          let followFn = (v, dep) => dep(hut.followRec(v));
          followFn(fly, dep);
          followFn(hutPlayer, dep);
          dep.scp(player, 'fly.levelPlayer', (levelPlayer, dep) => {
            dep.scp(levelPlayer, 'fly.levelPlayerEntity', followFn);
          });
          dep.scp(lobbyPlayerNozz, (myLobbyPlayer, dep) => {
            
            // Follow Lobby, all LobbyPlayers, the Level, and all Sprites
            // that are visible within the Level
            
            let lobby = myLobbyPlayer.mems['fly.lobby'];
            
            dep(hut.followRec(lobby));
            
            dep.scp(lobby, 'fly.lobbyPlayer', followFn);
            dep.scp(lobby, 'fly.level', (level, dep) => {
              
              // Follow the LevelPlayer
              dep.scp(level, 'fly.levelPlayer', followFn);
              
              // Follow Entities and Sprites when we can see the Sprite
              dep.scp(level, 'fly.entity', (e, dep) => dep.scp(e, 'fly.sprite', followFn));
              
            });
            
          });
          
          // TODO: The following Error produces a weird "cannot read property 'tell'..." error:
          // throw Error('HAH');
          
          if (testing && hut.uid.length === 3) setTimeout(() => {
            
            if (!testLobby) {
              
              // Corrupt the level definition
              let { levelName, momentName } = testing;
              let levelDef = levels[levelName];
              if (momentName) {
                levelDef.moments = levelDef.moments.toArr(v => v);
                let [ firstMoment, ind ] = levelDef.moments.find(m => m.name === momentName);
                
                if (!firstMoment.bounds) {
                  for (let i = ind; i >= 0; i--) {
                    if (levelDef.moments[i].has('bounds')) {
                      firstMoment.bounds = levelDef.moments[i].bounds;
                      break;
                    }
                  }
                }
                
                let testMoments = [
                  { name: 'test', type: 'MomentAhead', terrain: 'plains',
                    dist: firstMoment.bounds.total.h, spd: 200,
                    bounds: firstMoment.bounds,
                    models: []
                  },
                  { name: 'testTrn', type: 'MomentAhead', terrain: 'plainsToMeadow',
                    dist: 250, spd: 200,
                    bounds: firstMoment.bounds,
                    models: []
                  }
                ];
                levelDef.moments = [ ...testMoments, ...levelDef.moments.slice(ind) ];
              }
              
              let ms = foundation.getMs();
              testLobby = flyHut.createRec('fly.lobby', [ fly ], { 
                id: 'TEST', allReadyMs: null,
                level: getLevelData(levelName)
              });
              testLevel = flyHut.createRec('fly.level', [ fly, testLobby ], { ud: { ms }, levelDef, flyHut });
              
            }
            
            player.modVal(v => (v.name = 'testy', v));
            let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null });
            let levelPlayer = flyHut.createRec('fly.levelPlayer', [ testLevel, player ], { deaths: 0, damage: 0 });
            
            let ms = foundation.getMs();
            let entity = flyHut.createRec('fly.entity', [ testLevel ], {
              ud: { ms },
              type: testing.ace,
              ax: Math.round(Math.random() * 200 - 100), ay: -200
            });
            
            // Connect this Entity to the LevelPlayer
            flyHut.createRec('fly.levelPlayerEntity', [ levelPlayer, entity ]);
            
          }, 500);
          
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
            let player = lobbyPlayer.mems['fly.player'];
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              let hut = hutPlayer.mems['lands.hut'];
              
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
            // the Level is starting, and begin a Level after 5000ms
            lobby.modVal(v => v.gain({ allReadyMs: foundation.getMs() }));
            let timeout = setTimeout(() => {
              let ms = foundation.getMs();
              let levelDef = levels[lobby.val.level.name];
              let level = flyHut.createRec('fly.level', [ fly, lobby ], { ud: { ms }, levelDef, flyHut });
              
              let lobbyPlayers = lobby.relNozz('fly.lobbyPlayer').set;
              for (let lobbyPlayer of lobbyPlayers) {
                let player = lobbyPlayer.mems['fly.player'];
                let levelPlayer = flyHut.createRec('fly.levelPlayer', [ level, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                let ace = flyHut.createRec('fly.entity', [ level ], {
                  ud: { ms }, type: lobbyModelOptions[model].Cls.name, name: player.val.name,
                  ax: Math.round(Math.random() * 200 - 100), ay: -200
                });
                
                flyHut.createRec('fly.levelPlayerEntity', [ levelPlayer, ace ]);
                
              }
              for (let lobbyPlayer of lobbyPlayers) lobbyPlayer.modVal(v => (v.model = null, v));
            }, levelStartingDelay);
            dep(Drop(null, () => clearTimeout(timeout)));
            
          });
          
        });
        
        // Level Controls per Player
        dep.scp(fly, 'fly.level', (level, dep) => { dep.scp(level, 'fly.levelPlayer', (gp, dep) => {
          
          // Get a LevelPlayerEntity and a HutPlayer at the same time.
          // Overall commands from the HutPlayer's Hut effect the
          // LevelPlayerEntity's Entity!
          let player = gp.mems['fly.player'];
          dep.scp(gp, 'fly.levelPlayerEntity', ({ mems: { 'fly.entity': entity } }, dep) => {
            
            dep.scp(player, 'fly.hutPlayer', (hutPlayer, dep) => {
              
              let hut = hutPlayer.mems['lands.hut'];
              dep(hut.roadNozz('keys').route(({ msg: { keyVal }, ms }) => {
                
                // Will contain "left", "right", "up", "down", "act1", "act2"
                let keys = [];
                for (let i = 0; i < 6; i++) keys.push((keyVal & (1 << i)) >> i);
                
                if (keys[0] !== entity.controls.l[0]) entity.controls.l = [ keys[0], ms ];
                if (keys[1] !== entity.controls.r[0]) entity.controls.r = [ keys[1], ms ];
                if (keys[2] !== entity.controls.u[0]) entity.controls.u = [ keys[2], ms ];
                if (keys[3] !== entity.controls.d[0]) entity.controls.d = [ keys[3], ms ];
                if (keys[4] !== entity.controls.a1[0]) entity.controls.a1 = [ keys[4], ms ];
                if (keys[5] !== entity.controls.a2[0]) entity.controls.a2 = [ keys[5], ms ];
                
              }));
              
            });
          
          });
          
        })});
        
        // Level
        dep.scp(fly, 'fly.level', (level, dep) => {
          
          let levelDef = levels[level.val.level];
          
          let spf = 1 / fps;  // Seconds per server-side tick
          
          let running = true;
          dep(Drop(null, () => running = false));
          
          let frame = () => {
            
            let ms = foundation.getMs();
            if (!running) return;
            
            level.update(ms, spf)
            
            let frameDurMs = foundation.getMs() - ms;
            setTimeout(frame, spf * 1000 - frameDurMs);
            
          };
          frame();
          
        });
        
        /// =ABOVE} {BELOW=
        
        global.fly = fly;
        dep(Drop(null, () => { delete global.fly; }));
        
        let flyRootReal = dep(rootReal.techReals[0].addReal('fly.root'));
        let mainReal = flyRootReal.addReal('fly.main');
        
        // Lobby
        dep.scp(flyHut, 'fly.hutPlayer', (myHutPlayer, dep) => {
          
          let myPlayer = myHutPlayer.mems['fly.player'];
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
            
            let myPlayer = myLobbyPlayer.mems['fly.player'];
            let lobby = myLobbyPlayer.mems['fly.lobby'];
            let lobbyReal = dep(mainReal.addReal('fly.lobby'));
            
            let lobbyHeaderReal = lobbyReal.addReal('fly.lobbyHeader');
            let lobbyTitle = lobbyHeaderReal.addReal('fly.lobbyTitle').addReal('fly.content1');
            let lobbyBackButton = lobbyHeaderReal.addReal('fly.lobbyBackButton');
            dep(lobbyBackButton.feelNozz().route(() => flyHut.tell({ command: 'lobbyExit' })));
            lobbyBackButton.addReal('fly.content3').setText(`Leave Lobby`);
            
            let mapChoiceReal = lobbyReal.addReal('fly.mapChoice');
            let mapChoiceContentReal = mapChoiceReal.addReal('fly.mapChoiceContentHolder').addReal('fly.mapChoiceContent');
            let mapChoiceTitleReal = mapChoiceContentReal.addReal('fly.mapChoiceTitle').addReal('fly.content2');
            let mapChoiceDescReal = mapChoiceContentReal.addReal('fly.mapChoiceDesc').addReal('fly.paragraph');
            
            let mapChoiceEntryReal = mapChoiceReal.addReal('fly.mapChoiceEntry');
            let mapChoiceFieldReal = mapChoiceEntryReal.addReal('fly.mapChoiceField');
            let mapChoiceButtonReal = mapChoiceEntryReal.addReal('fly.mapChoiceButton');
            let mapChoiceButtonTextReal = mapChoiceButtonReal.addReal('fly.content2');
            dep(mapChoiceButtonReal.feelNozz().route(() => {
              let pass = mapChoiceFieldReal.textNozz().val;
              mapChoiceFieldReal.setText('');
              flyHut.tell({ command: 'lobbyPass', pass });
            }));
            dep(lobby.route(({ level }) => {
              let { num, name, password, dispName, dispDesc } = level;
              mapChoiceTitleReal.setText(`Stage #${num + 1}: ${dispName}`);
              mapChoiceDescReal.setText(dispDesc);
              mapChoiceFieldReal.setText(password);
            }));
            mapChoiceButtonTextReal.setText('Submit');
            
            let teamListReal = lobbyReal.addReal('fly.teamList');
            dep.scp(lobby, 'fly.lobbyPlayer', (lobbyPlayer, dep) => {
              
              let isMine = lobbyPlayer === myLobbyPlayer;
              
              let player = lobbyPlayer.mems['fly.player'];
              let teamMemberReal = dep(teamListReal.addReal('fly.teamMember'));
              let nameReal = teamMemberReal.addReal('fly.playerName').addReal('fly.content2');
              
              let modelListReal = teamMemberReal.addReal('fly.modelList');
              let scoreReal = teamMemberReal.addReal('fly.score').addReal('fly.content3');
              
              let modelReals = lobbyModelOptions.map(({ name }, model) => {
                
                let modelReal = modelListReal.addReal('fly.model');
                modelReal.addReal('fly.modelName').addReal('fly.content3').setText(name);
                modelReal.setImage(
                  foundation.getKeep('urlResource', { path: `fly.sprite.ace${model[0].upper()}${model.slice(1)}` }),
                  { smoothing: false, scale: 0.5 }
                );
                
                if (isMine) {
                  dep(modelReal.feelNozz().route(() => {
                    flyHut.tell({ command: 'lobbySetModel', model: model === lobbyPlayer.val.model ? null : model });
                  }));
                }
                
                return modelReal;
                
              });
              
              teamMemberReal.setColour(isMine ? '#f8c0a0' : '#f0f0f0');
              
              dep(player.route(({ name, score, deaths }) => {
                nameReal.setText(name || '<anon>')
                scoreReal.setText(`Dmg: ${Math.round(score) * 100}\nDeaths: ${deaths}`);
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
                let amt = (ms - allReadyMs) / levelStartingDelay; // where 5000 is the delay before a Level starts
                
                if (amt < 1) {
                  lobbyReal.setOpacity(Math.pow(1 - amt, 1.5));
                } else {
                  lobbyReal.setOpacity(0);
                  clearInterval(interval);
                }
                
              }, levelStartingDelay / 10);
              
              dep(Drop(null, () => { lobbyReal.setOpacity(null); clearInterval(interval); }));
              
            });
            
            let myLevelPlayerNozz = myPlayer.relNozz('fly.levelPlayer');
            let myLevelPlayerDryNozz = dep(TubDry(null, myLevelPlayerNozz));
            dep.scp(myLevelPlayerDryNozz, (noLevelPlayer, dep) => {
              lobbyReal.setTangible(true);
              lobbyReal.setOpacity(null);
            });
            dep.scp(myLevelPlayerNozz, (myLevelPlayer, dep) => lobbyReal.setTangible(false));
            
          });
          
        });
        
        // Level
        dep.scp(flyHut, 'fly.hutPlayer', ({ mems: { 'fly.player': p } }, dep) => dep.scp(p, 'fly.levelPlayer', (gp, dep) => {
          
          dep.scp(gp, 'fly.levelPlayerEntity', (gpe, dep) => {
            
            flyRootReal.setColour('#000000');
            dep(Drop(null, () => flyRootReal.setColour(null)));
            
            let level = gp.mems['fly.level'];
            level.flyHut = flyHut;
            
            let myEntity = gpe.mems['fly.entity'];
            let entities = level.relNozz('fly.entity').set;
            let sprites = level.relNozz('fly.sprite').set;
            
            let levelContainerReal = dep(mainReal.addReal('fly.level'));
            let lInfoReal = levelContainerReal.addReal('fly.levelLInfo');
            let rInfoReal = levelContainerReal.addReal('fly.levelRInfo');
            
            let dispLivesReal = lInfoReal.addReal('fly.levelDispLives');
            dep(level.route(v => dispLivesReal.setText(`[${level.val.lives}]`)));
            
            let levelReal = levelContainerReal.addReal('fly.levelContent');
            
            let { draw, keys } = levelReal;
            
            // Listen to our keys
            dep(keys.nozz.route(keys => {
              
              // A: 65, D: 68, W: 87, S: 83, <: 188, >: 190
              let keyNums = [ 65, 68, 87, 83, 188, 190 ];
              let keyVal = 0;
              for (let i = 0; i < keyNums.length; i++) keyVal += keys.has(keyNums[i]) ? (1 << i) : 0;
              flyHut.tell({ command: 'keys', keyVal });
              
            }));
            
            let pixelDims = { w: 800, h: 1000, hw: 400, hh: 500 };
            let fadeXPanVal = util.fadeVal(0, 0.19);
            let fadeYPanVal = util.fadeVal(0, 0.19);
            let lastMs = [ level.val.ms, foundation.getMs() ];
            let doDraw = () => draw.initFrameCen('rgba(220, 220, 255, 1)', () => {
              
              let bounds = Level.getLevelBounds(level);
              let { total: tb, player: pb } = bounds;
              
              let updData = {
                ms: level.val.ms,
                spf: (level.val.ms - lastMs[0]) * 0.001,
                outcome: level.v('outcome'),
                level,
                myEntity,
                entities: entities.toObj(r => [ r.uid, r ]),
                createRec: level.flyHut.createRec.bind(this, flyHut),
                bounds
              };
              if (updData.ms === lastMs[0]) {
                
                // Render before update; compensate for silky smoothness
                let msExtra = foundation.getMs() - lastMs[1];
                updData.ms = lastMs[0] + msExtra;
                
                // Spoof the level as having inched forward a tiny bit
                level.val.y += level.val.aheadSpd * msExtra * 0.001;
                
                // Extrapolate aheadDist
                let addY = level.val.aheadSpd * msExtra * 0.001;
                updData.bounds.total.y += addY;
                updData.bounds.total.t += addY;
                updData.bounds.total.b += addY;
                updData.bounds.player.y += addY;
                updData.bounds.player.t += addY;
                updData.bounds.player.b += addY;
                
              } else {
                
                // Remember the timing of this latest frame
                lastMs = [ updData.ms, foundation.getMs() ];
                
              }
              
              let [ mySprite=null ] = myEntity.relNozz('fly.sprite').set;
              
              let visiMult = Math.min(tb.w / pixelDims.w, tb.h / pixelDims.h) * level.val.visiMult;
              let desiredTrn = { x: 0, y: 0 };
              let scaleAmt = 1 / visiMult;
              
              if (mySprite) {
                
                let { x, y } = mySprite.val;
                
                // Percentage of horz/vert dist travelled
                let xAmt = (x - pb.x) / (pb.w * 0.5);
                let yAmt = (y - pb.y) / (pb.h * 0.5);
                
                // If place camera at `+maxFocusX` or `-maxFocusX`, any
                // further right/left and we'll see dead areas
                let seeDistX = pixelDims.hw * visiMult;
                let seeDistY = pixelDims.hh * visiMult;
                let maxFocusX = tb.w * 0.5 - seeDistX;
                let maxFocusY = tb.h * 0.5 - seeDistY;
                desiredTrn = { x: maxFocusX * xAmt, y: maxFocusY * yAmt };
                
                bounds.visible = {
                  form: 'rect',
                  x: desiredTrn.x, y: desiredTrn.y,
                  w: seeDistX * 2, h: seeDistY * 2,
                  l: desiredTrn.x - seeDistX, r: desiredTrn.x + seeDistX,
                  b: desiredTrn.y - seeDistY, t: desiredTrn.y + seeDistY
                };
                
              } else {
                
                bounds.visible = bounds.total;
                
              }
              
              // TODO: Don't follow Ace upon victory!!
              draw.scl(scaleAmt, scaleAmt);
              draw.trn(0, -updData.bounds.total.y);
              draw.trn(-fadeXPanVal.to(desiredTrn.x), -fadeYPanVal.to(desiredTrn.y));
              
              let renders = [];
              for (let sprite of sprites) {
                let entity = sprite.mems['fly.entity'];
                renders.push({ priority: entity.renderPriority(), entity });
              }
              
              for (let { entity } of renders.sort((v1, v2) => v2.priority - v1.priority)) {
                entity.render(updData, draw);
              }
              
              draw.rectCen(tb.x, tb.y, tb.w - 4, tb.h - 4, { strokeStyle: 'rgba(0, 255, 0, 0.1)', lineWidth: 4 });
              draw.rectCen(pb.x, pb.y, pb.w - 4, pb.h - 4, { strokeStyle: 'rgba(0, 120, 0, 0.1)', lineWidth: 4 });
              
            });
            
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
