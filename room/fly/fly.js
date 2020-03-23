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
    let testing = {
      lives: 10,
      levelName: 'impendingFields',
      momentName: 'box3',
      ace: [ 'JoustMan', 'GunGirl', 'SlamKid', 'SalvoLad' ][Math.floor(Math.random() * 4)]
    };
    let badN = (...vals) => vals.find(v => !U.isType(v, Number) || isNaN(v));
    
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
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', distance: 1500, aheadSpd: 100, 
            bounds: { total: { w: 240, h: 300 }, player: { x: 0, y: 0, w: 240, h: 300 } },
            modelsDef: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', distance: 1500, aheadSpd: 100, 
            bounds: { total: { w: 260, h: 325 }, player: { x: 0, y: 0, w: 260, h: 325 } },
            modelsDef: []
          },
          { name: 'winder1', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100, 
            bounds: { total: { w: 280, h: 350 }, player: { x: 0, y: 0, w: 280, h: 350 } },
            modelsDef: [
              { type: 'Winder', x: -60, y: +150, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x:   0, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +60, y: +150, spd: -50, swingHz: 0, swingAmt: 0 }
            ]
          },
          { name: 'winder2', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100, 
            modelsDef: [
              { type: 'Winder', x: -60, y: +150, spd: -50, swingHz: 0.05, swingAmt: -50 },
              { type: 'Winder', x:   0, y: +100, spd: -50, swingHz:    0, swingAmt:   0 },
              { type: 'Winder', x: +60, y: +150, spd: -50, swingHz: 0.05, swingAmt: +50 }
            ]
          },
          { name: 'winder3', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100, 
            modelsDef: [
              { type: 'Winder', x: -100, y: +150, spd: -50, swingHz: 0.05, swingAmt: +50 },
              { type: 'Winder', x:  -50, y: +200, spd: -50, swingHz: 0.07, swingAmt: -50 },
              { type: 'Winder', x:    0, y: +100, spd: -50, swingHz:    0, swingAmt:   0 },
              { type: 'Winder', x:  +50, y: +200, spd: -50, swingHz: 0.07, swingAmt: +50 },
              { type: 'Winder', x: +100, y: +150, spd: -50, swingHz: 0.05, swingAmt: -50 }
            ]
          },
          { name: 'winder4', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100, 
            modelsDef: [
              { type: 'Winder', x: -100, y: +150, spd:  -50, swingHz: 0.055, swingAmt: +60 },
              { type: 'Winder', x:  -50, y: +200, spd:  -50, swingHz: 0.075, swingAmt: -70 },
              { type: 'Winder', x:    0, y: +300, spd: -100, swingHz:     0, swingAmt:   0 },
              { type: 'Winder', x:  +50, y: +200, spd:  -50, swingHz: 0.075, swingAmt: +70 },
              { type: 'Winder', x: +100, y: +150, spd:  -50, swingHz: 0.055, swingAmt: -60 }
            ]
          },
          { name: 'winder5', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            modelsDef: [
              { type: 'Winder', x: -200, y: 0, spd: -50, swingHz: 0.055, swingAmt: +100 },
              { type: 'Winder', x: -30, y: +150, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +30, y: +150, spd: -100, swingHz: 0, swingAmt: 0 },
              { type: 'Winder', x: +200, y: 0, spd: -50, swingHz: 0.055, swingAmt: -100 },
            ]
          },
          { name: 'winder6', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            modelsDef: [
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
          { name: 'winder7', type: 'MomentAhead', terrain: 'meadow', distance: 750, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            modelsDef: [
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
          { name: 'winder8', type: 'MomentAhead', terrain: 'meadow', distance: 750, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            modelsDef: [
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
          { name: 'weaver1', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            modelsDef: [
              
              { type: 'Weaver', x: -100, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +100, y: +100, spd: -50, swingHz: 0, swingAmt: 0 },
              
              { type: 'Weaver', x: -120, y: +250, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:    0, y: +220, spd: -50, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x: +120, y: +250, spd: -50, swingHz: 0, swingAmt: 0 },
              
            ]
          },
          { name: 'weaver2', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            modelsDef: [
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
          { name: 'weaver3', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            modelsDef: [
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
          { name: 'weaver4', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            modelsDef: [
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
          
          { name: 'final', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100, modelsDef: [] }
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
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', distance: 1500, aheadSpd: 100,
            bounds: { total: { w: 320, h: 400 }, player: { x: 0, y: 0, w: 320, h: 400 } },
            modelsDef: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', distance: 1500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: []
          },
          { name: 'scout1', type: 'MomentAhead', terrain: 'meadow', distance: 750, aheadSpd: 100,
            modelsDef: [
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
          { name: 'scout2', type: 'MomentAhead', terrain: 'meadow', distance: 750, aheadSpd: 100,
            modelsDef: [
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
          { name: 'sideswipe1', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              { type: 'Winder', x: -300, y: +250, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1200 },
              { type: 'Winder', x: -300, y: +180, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1100 },
              { type: 'Winder', x: -300, y: +110, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +1000 },
              { type: 'Winder', x: -300, y:  +40, spd: -100, delayMs: 2000, swingHz: 0.04, swingAmt: +900 }
            ]
          },
          { name: 'sideswipe2', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              { type: 'Winder', x: +300, y: +250, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1200 },
              { type: 'Winder', x: +300, y: +180, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1100 },
              { type: 'Winder', x: +300, y: +110, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -1000 },
              { type: 'Winder', x: +300, y:  +40, spd: -100, delayMs: 2500, swingHz: 0.04, swingAmt: -900 }
            ]
          },
          { name: 'sideswipe3', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
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
          { name: 'pillar1', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              
              { type: 'Winder', x: +40, y: +360, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +300, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +240, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: +40, y: +180, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: +40, y: +120, spd: -120, delayMs: 5000, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: +40, y:  +60, spd: -120, swingHz: 0, swingAmt: 0 },
              
            ]
          },
          { name: 'pillar2', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              
              { type: 'Winder', x: -20, y: +360, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -20, y: +300, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -20, y: +240, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Winder', x: -20, y: +180, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: -200 },
              { type: 'Winder', x: -20, y: +120, spd: -140, delayMs: 4500, swingHz: 0.2, swingAmt: +200 },
              { type: 'Weaver', x: -40, y:  +60, spd: -140, swingHz: 0, swingAmt: 0 },
              { type: 'Weaver', x:   0, y:  +60, spd: -140, swingHz: 0, swingAmt: 0 }
              
            ]
          },
          { name: 'pillar3', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              
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
          { name: 'pillarBreak', type: 'MomentAhead', terrain: 'meadow', distance: 250, aheadSpd: 100, modelsDef: [] },
          { name: 'pillar4', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            modelsDef: [
              
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
          { name: 'box1', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            modelsDef: [
              
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
          { name: 'box2', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            modelsDef: [
              
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
          { name: 'box3', type: 'MomentAhead', terrain: 'meadow', distance: 2000, aheadSpd: 100,
            modelsDef: [
              
              //{ type: 'Furler', x: -50, y: +400, spd: -30, swingHz: 0.079, swingAmt: +130, shootDelayMs: 1100, bulletArgs: { spd: -300, lsMs: 3000 } },
              //{ type: 'Furler', x: +50, y: +400, spd: -30, swingHz: 0.079, swingAmt: -130, shootDelayMs: 1100, bulletArgs: { spd: -300, lsMs: 3000 } },
              
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
          { name: 'snake1', type: 'MomentAhead', terrain: 'meadow', distance: 1250, aheadSpd: 100,
            modelsDef: [
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
          { name: 'snake2', type: 'MomentAhead', terrain: 'meadow', distance: 1250, aheadSpd: 100,
            modelsDef: [
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
              
              { type: 'Drifter', x: 0,   y: +300, tx: 0, ty: 0, vel: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              
              { type: 'Furler', x: 0, y: +900, spd: -90, delayMs: 1200, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, bulletArgs: { spd: -300, lsMs: 6000 } }
            ]
          },
          { name: 'snake3', type: 'MomentAhead', terrain: 'meadow', distance: 2000, aheadSpd: 100,
            modelsDef: [
              { type: 'Drifter', x: -150, y: +100, tx: -150, ty: 0, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x:  -50, y: +100, tx:  -50, ty: 0, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x:  +50, y: +100, tx:  +50, ty: 0, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              { type: 'Drifter', x: +150, y: +100, tx: +150, ty: 0, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
              
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
          { name: 'practice1', type: 'MomentAhead', terrain: 'meadow', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'meadow', distance: 500, aheadSpd: 100,
            bounds: { total: { w: 440, h: 550 }, player: { x: 0, y: 0, w: 440, h: 550 } },
            modelsDef: []
          },
          { name: 'final', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100,
            modelsDef: [
              { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: -100 },
              { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: +100 }
            ]
          }
        ]
      },
      killPlains: { num: 1, name: 'Kill Plains', password: 'R4CIN6',
        desc: [
        
        ].join(' '),
        moments: [
          { name: 'practice1', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 360, h: 450 }, player: { x: 0, y: 0, w: 360, h: 450 } },
            modelsDef: []
          },
          { name: 'practice2', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: []
          },
          { name: 'winder1', type: 'MomentAhead', terrain: 'plains', distance: 500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              { type: 'Winder', x: -600, y: +250, spd: -100, swingHz: 0.027, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -100, swingHz: 0.031, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -100, swingHz: 0.035, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -100, swingHz: 0.035, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -100, swingHz: 0.031, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -100, swingHz: 0.027, swingAmt: -580 }
            ]
          },
          { name: 'winder2', type: 'MomentAhead', terrain: 'plains', distance: 500, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              { type: 'Winder', x: -600, y: +250, spd: -100, swingHz: 0.032, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -100, swingHz: 0.036, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -100, swingHz: 0.040, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -100, swingHz: 0.040, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -100, swingHz: 0.036, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -100, swingHz: 0.032, swingAmt: -580 }
            ]
          },
          { name: 'winder3', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              // Zipper up
              { type: 'Winder', x: -600, y: +250, spd: -130, swingHz: 0.047, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -130, swingHz: 0.051, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -130, swingHz: 0.055, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -130, swingHz: 0.055, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -130, swingHz: 0.051, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -130, swingHz: 0.047, swingAmt: -580 }
            ]
          },
          { name: 'winder4', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              // Zipper down
              { type: 'Winder', x: -600, y:  +50, spd: -130, swingHz: 0.047, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -130, swingHz: 0.051, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +250, spd: -130, swingHz: 0.055, swingAmt: +580 },
              { type: 'Winder', x: +600, y: +250, spd: -130, swingHz: 0.055, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -130, swingHz: 0.051, swingAmt: -580 },
              { type: 'Winder', x: +600, y:  +50, spd: -130, swingHz: 0.047, swingAmt: -580 }
            ]
          },
          { name: 'winder5', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              // Zipper up
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.057, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +580 },
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.065, swingAmt: +580 },
              { type: 'Winder', x: +600, y:  +50, spd: -150, swingHz: 0.065, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -150, swingHz: 0.061, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +250, spd: -150, swingHz: 0.057, swingAmt: -580 }
            ]
          },
          { name: 'winder6', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
              // Zipper down
              { type: 'Winder', x: -600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +150, spd: -150, swingHz: 0.061, swingAmt: +580 },
              { type: 'Winder', x: -600, y: +250, spd: -150, swingHz: 0.065, swingAmt: +580 },
              { type: 'Winder', x: +600, y: +250, spd: -150, swingHz: 0.065, swingAmt: -580 },
              { type: 'Winder', x: +600, y: +150, spd: -150, swingHz: 0.061, swingAmt: -580 },
              { type: 'Winder', x: +600, y:  +50, spd: -150, swingHz: 0.057, swingAmt: -580 }
            ]
          },
          { name: 'winder7', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
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
          { name: 'winder8', type: 'MomentAhead', terrain: 'plains', distance: 250, aheadSpd: 100,
            bounds: { total: { w: 400, h: 500 }, player: { x: 0, y: 0, w: 400, h: 500 } },
            modelsDef: [
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
          { name: 'winder9', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 440, h: 550 }, player: { x: 0, y: 0, w: 440, h: 550 } },
            modelsDef: [
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
          { name: 'weaver1', type: 'MomentAhead', terrain: 'plains', distance: 750, aheadSpd: 100,
            bounds: { total: { w: 480, h: 600 }, player: { x: 0, y: 0, w: 480, h: 600 } },
            modelsDef: [
              
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
          { name: 'furler1', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100,
            bounds: { total: { w: 480, h: 600 }, player: { x: 0, y: 0, w: 480, h: 600 } },
            modelsDef: [
              { type: 'Furler', x: -120, y: +200, spd: -50, swingHz: 0.1, swingAmt: -80, shootDelayMs: 1500, bulletArgs: { spd: -300 } },
              { type: 'Furler', x: +120, y: +200, spd: -50, swingHz: 0.1, swingAmt: +80, shootDelayMs: 1500, bulletArgs: { spd: -300 } }
            ]
          },
          { name: 'bozz', type: 'MomentAhead', terrain: 'plains', distance: 8000, aheadSpd: 100,
            bounds: { total: { w: 800, h: 1000 }, player: { x: 0, y: -150, w: 800, h: 700 } },
            modelsDef: [
              
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
          
          { name: 'final', type: 'MomentAhead', terrain: 'plains', distance: 1000, aheadSpd: 100, modelsDef: [] }
          
        ]
      }
    };
    let getLevelData = name => ({
      name, ...levels[name].slice('num', 'password'),
      dispName: levels[name].name, dispDesc: levels[name].desc
    });
    
    // BASE STUFF
    let Entity = U.inspire({ name: 'Entity', insps: {}, methods: (insp, Insp) => ({
      init: function({ ms=foundation.getMs() }={}) {
        this.ms = ms;
      },
      isAlive: function(updData) { return true; },
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
      calcState: C.noFn('calcState'),
      updateAndGetResult: C.noFn('updateAndGetResult'),
      dieAndGetResult: function(updData) { return { birth: [] }; }
    })});
    let Mortal = U.inspire({ name: 'Mortal', insps: {}, methods: (insp, Insp) => ({
      init: function({ hp=1 }) { this.hp = this.getMaxHp(); },
      getMaxHp: function() { return 1; },
      damageFrom: function(rep, amt) { this.hp -= amt; },
      isAlive: function(updData) { return this.hp > 0; }
    })});
    let Geom = U.inspire({ name: 'Geom', insps: { Entity }, methods: (insp, Insp) => ({
      init: function({ x=0, y=0, ...args }) {
        insp.Entity.init.call(this, args);
        this.x = x; this.y = y;
      }
    })});
    let Mover = U.inspire({ name: 'Mover', methods: (insp, Insp) => ({
      
      init: function({ aheadDist=0, vel=100, acl=0, tx, ty, ang, dist, spd=null }) {
        
        if (spd !== null) throw Error(`Don't provide "spd" (${spd}) - instead use "vel"!`);
        if (!({}).has.call(this, 'x')) throw Error(`${U.nameOf(this)} inherits Mover, but doesn't initialize an "x" property`);
        if (!({}).has.call(this, 'y')) throw Error(`${U.nameOf(this)} inherits Mover, but doesn't initialize an "x" property`);
        
        // Note that `aheadDist` is the y value of the total progression
        // of the level, and consistent regardless of the Moment. To get
        // consistent movement we need to use `aheadDist`!
        
        this.initDist = aheadDist;
        this.initX = this.x; this.initY = this.y;
        this.vx = this.vy = this.dist = null;
        this.vel = null; this.acl = null;
        this.ang = null;
        this.setDestination({ aheadDist, vel, acl, tx, ty, ang, dist });
        
      },
      setDestination: function({ aheadDist=0, vel=null, acl=null, tx=null, ty=null, ang=null, dist=null }) {
        
        // Providing x and y with an optional `relDist` sets the
        // destination through that point (and optionally stopping at
        // that point)
        // Providing a angle and optional distance sets the destination
        // at the angle relative to the current position
        
        if (ang !== null && (tx !== null || ty !== null))
          throw Error(`Specify either "ang", or "tx" and "ty"`);
        
        // Update speed if necessary
        if (vel !== null) this.vel = vel;
        if (acl !== null) this.acl = acl;
        
        if (tx !== null) {
          
          let dx = tx - this.x;
          let dy = ty - this.y + ((aheadDist !== null) ? aheadDist : 0);
          this.dist = Math.sqrt(dx * dx + dy * dy);
          
          let n = 1 / this.dist; // Normalizes dx, dy
          this.vx = dx * n; this.vy = dy * n;
          
          this.ang = Math.atan2(dx, dy) / (Math.PI * 2);
          
        } else if (ang !== null) {
          
          let r = ang * Math.PI * 2;
          this.vx = Math.sin(r);
          this.vy = Math.cos(r);
          
          this.dist = dist;
          this.ang = ang;
          
        } else {
          
          throw Error(`Specify either "x" and "y", or "ang"`);
          
        }
        
      },
      permState: function() { return { initDist: this.initDist }; },
      normState: function() { return {
        initX: this.initX, initY: this.initY,
        vx: this.vx, vy: this.vy, dist: this.dist,
        vel: this.vel, acl: this.acl
      };},
      calcState: function(updData) {
        
        let dur = updData.ms - this.ms;
        let t = dur * 0.001;
        let d = this.vel * t + 0.5 * this.acl * t * t; // Distance based on t, vel, acl
        
        // Non-null `dist` creates a cap on the distance
        if (this.dist !== null && d > this.dist) d = this.dist;
        
        let x = this.initX + this.vx * d;
        let y = this.initY + this.vy * d;
        
        // Non-null `initDist` causes movement relative to `aheadDist`
        if (this.initDist !== null) y += updData.aheadDist - this.initDist;
        
        return { x, y };
        
      },
      isAlive: function(updData) {
        if (this.dist === null) {
          let bnd = updData.bounds.total;
          if (this.vx > 0 && this.x > (bnd.r + 100)) return false;
          if (this.vx < 0 && this.x < (bnd.l - 100)) return false;
          if (this.vy > 0 && this.y > (bnd.t + 100)) return false;
          if (this.vy < 0 && this.y < (bnd.b - 100)) return false;
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
      collide: function(rep, updData) {
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
      
      $render: (draw, updData, { type, ms, w, h, team, x, y }) => {
        draw.rectCen(x, y, w, h, { fillStyle: Insp.parents.Bullet.getColour(team) });
      },
      
      init: function({ x, y, spd=700, w=4, h=50, lsMs=3000, aheadDist, ...args }) {
        insp.Geom.init.call(this, { aheadDist, ...args });
        insp.Bullet.init.call(this, { aheadDist, ...args });
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        
        this.initX = x; this.initY = y; this.initDist = aheadDist;
        if (badN(this.initDist)) throw Error('BAD AHAED DIST');
        
        this.spd = spd;
        this.lsMs = lsMs;
      },
      collide: function(rep, updData) {
        if (insp.Bullet.collide.call(this, rep, updData)) this.lsMs = 0;
      },
      permState: function() { return {
        ...insp.Geom.permState.call(this),
        initX: this.initX, initY: this.initY, initDist: this.initDist, spd: this.spd,
        team: this.getTeam(), w: this.w, h: this.h
      };},
      calcState: function(updData) {
        return {
          x: this.initX,
          y: this.initY + (updData.aheadDist - this.initDist) + (this.spd * (updData.ms - this.ms) * 0.001)
        };
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        this.x = x;
        this.y = y;
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: function({ ms }) { return (ms - this.ms) < this.lsMs; }
      
    })});
    let DirectedBullet = U.inspire({ name: 'DirectedBullet', insps: { Entity, Mover, Bullet }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, { x, y, r, team }) => {
        draw.circ(x, y, r, { fillStyle: Insp.parents.Bullet.getColour(team) });
      },
      init: function({ r=8, lsMs=3000, acl=0, x, y, ...args }) {
        this.x = x; this.y = y;
        insp.Entity.init.call(this, args);
        insp.Mover.init.call(this, { vel: 500, ...args });
        insp.Bullet.init.call(this, args);
        this.r = r;
        this.lsMs = lsMs;
        this.acl = acl;
      },
      canCollide: function() { return true; },
      collide: function(rep, updData) { if (insp.Bullet.collide.call(this, rep, updData)) this.lsMs = 0; },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr, { team: i.getTeam(), r: i.r })),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        // this.x = x;
        // this.y = y;
        return { x, y, form: 'circle', r: this.r, birth: [] };
      },
      isAlive: function({ ms }) { return (ms - this.ms) < this.lsMs; }
      
    })});
    
    // GOOD GUYS
    let Ace = U.inspire({ name: 'Ace', insps: { Entity, Mortal }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 8 }, $respawnMs: 2500, $invulnMs: 1500, $spd: 165,
      $render: (draw, { ms }, { entity, myEntity, x, y, invulnMark }, imageKeep=null, fn) => {
        let size = Insp.bound.r << 1;
        let mine = entity === myEntity;
        
        if (ms < invulnMark) {
          let outerStyle = mine
            ? { fillStyle: 'rgba(255, 255, 255, 0.30)' }
            : { fillStyle: 'rgba(255, 255, 255, 0.15)' };
          let innerStyle = mine
            ? { fillStyle: 'rgba(255, 255, 255, 0.35)', strokeStyle: 'rgba(255, 255, 255, 0.7)', lineWidth: 3 }
            : { fillStyle: 'rgba(255, 255, 255, 0.15)' };
          draw.circ(x, y, size * 5,   outerStyle);
          draw.circ(x, y, size * 1.6, innerStyle);
          if (imageKeep) draw.imageCen(imageKeep, x, y, size, size, 0.25);
        } else {
          let indStyle = mine
            ? { fillStyle: 'rgba(255, 140, 140, 0.28)', strokeStyle: 'rgba(255, 100, 100, 0.5)', lineWidth: 3 }
            : { fillStyle: 'rgba(255, 140, 140, 0.20)' };
          draw.circ(x, y, size * 1.6, indStyle);
          if (imageKeep) draw.imageCen(imageKeep, x, y, size, size);
        }
        
        if (fn) fn();
      },
      
      init: function(args) {
        // TODO: Supply ms and aheadDist when creating Aces
        if (!args.has('ms')) throw Error(`Missing "ms" param when creating ${U.nameOf(this)}`);
        if (args.has('aheadDist')) throw Error(`DO NOT PROVIDE "aheadDist" param when creating ${U.nameOf(this)}`);
        
        insp.Entity.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.name = args.name;
        this.spd = Insp.spd;
        this.effects = Set();
        this.invulnMark = this.ms + Insp.invulnMs;
        this.scoreDamage = 0;
        this.scoreDeath = 0;
        
        this.netVelX = 0; this.netVelY = 0;
        this.netAclX = 0; this.netAclY = 0;
        
        this.ctrlX = args.has('x') ? args.x : 0; this.ctrlY = args.has('y') ? args.y : 0;
        
      },
      canCollide: function(ms) { return ms >= this.invulnMark; },
      collide: function(rep, updData) {},
      getTeam: function() { return +1; },
      normState: function() { return { invulnMark: this.invulnMark, victory: this.victory }; },
      fluxState: function() { return { ctrlX: this.ctrlX, ctrlY: this.ctrlY }; },
      calcState: function(updData) {
        return {
          x: this.ctrlX,
          y: this.ctrlY + updData.aheadDist
        };
      },
      updateAndGetResult: function(entity, updData) {
        
        let { ms, spf, bounds, aheadSpd, aheadDist, victory } = updData;
        if (victory) {
          if (ms >= this.invulnMark) this.invulnMark = ms + 1000;
          this.ctrlY += (aheadSpd + Insp.spd * 4) * spf;
          let { x, y } = this.calcState(updData);
          return { x, y, ...Insp.bound, birth: [] };
        }
        
        let cx = entity.controls.r[0] - entity.controls.l[0];
        let cy = entity.controls.u[0] - entity.controls.d[0];
        let a1 = entity.controls.a1[0];
        let a2 = entity.controls.a2[0];
        let { birth=[], spdMult=1 } = this.aceUpdate({ cx, cy, a1, a2 }, updData);
        let forces = [];
        
        // The calculated speed for this tick
        spdMult *= this.spd;
        
        for (let effect of this.effects) {
          let { mark, type=null, fn=null, endFn=null } = effect;
          if (ms > effect.mark) {
            this.effects.rem(effect);
            if (effect.endFn) effect.endFn(this, updData, { birth });
          } else {
            if (effect.type === 'spdMult') spdMult *= effect.spdMult;
            if (effect.type === 'force') forces.push(effect.force);
            if (effect.fn) effect.fn(this, updData, { birth });
          }
        }
        
        let vx, vy;
        if (cx && cy) spdMult /= Math.sqrt(cx * cx + cy * cy);
        vx = cx * spdMult;
        vy = cy * spdMult;
        
        //vy += aheadSpd;
        if (vx || vy) { this.ctrlX += vx * spf; this.ctrlY += vy * spf; }
        
        let rad = Insp.bound.r;
        let { l, r, b, t } = bounds.player;
        if (this.ctrlX < (l + rad)) this.ctrlX = l + rad;
        if (this.ctrlX > (r - rad)) this.ctrlX = r - rad;
        if (this.ctrlY < (b + rad - aheadDist)) this.ctrlY = b + rad - aheadDist;
        if (this.ctrlY > (t - rad - aheadDist)) this.ctrlY = t - rad - aheadDist;
        
        let { x, y } = this.calcState(updData);
        return { x, y, ...Insp.bound, birth };
        
      },
      aceUpdate: C.noFn('aceUpdate'),
      isAlive: insp.Mortal.isAlive
      
    })});
    
    let JoustMan = U.inspire({ name: 'JoustMan', insps: { Ace }, methods: (insp, Insp) => ({
      
      $w1ChargePunishSlow: 0.4, $w1ChargePunishMs: 2000,
      $w1Charge1Ms: 750, $w1Charge2Ms: 1800, $w1Charge3Ms: 5000, // How many millis of charging for various jousts
      $w1Charge3Slow: 0.58,
      $w2Delay: 2500, $w2DashSpeed: 500, $w2OrbDps: 25, $w2DurationMs: 300,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceJoust' }),
      $render: (draw, updData, args) => {
        Insp.parents.Ace.render(draw, updData, args, Insp.imageKeep, () => {
          let { x, y, w1Mark, w1State, w2Mark } = args;
          
          // Laser reload
          let bar1H = w1Mark ? Math.min(1, (updData.ms - w1Mark) / Insp.w1Charge3Ms) * 20 : 0;
          let [ bar1W, col ] = [
            [ 16, 'rgba(0, 0, 0, 1)' ],         // Punished
            [ 16, 'rgba(0, 150, 150, 0.7)' ],   // Spread shot
            [ 8,  'rgba(0, 255, 255, 0.7)' ],   // Butterfly
            [ 12, 'rgba(100, 255, 255, 0.8)' ]  // Laser
          ][w1State];
          draw.rect(x + bar1W * -0.5, y - 8, bar1W, bar1H, { fillStyle: col });
          
          // Flash reload
          let msRemaining = w2Mark - updData.ms;
          let bar2W = (msRemaining > 0)
            ? Math.max(0, Math.min(1, (Insp.w2Delay - msRemaining) / Insp.w2Delay))
            : 1;
          draw.rectCen(x, y - 12, bar2W * 16, 4, { fillStyle: `rgba(0, 0, 255, ${msRemaining > 0 ? 0.4 : 1})` });
          
        });
      },
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        this.w1Mark = null; // Marks when charging began
        this.w1State = 0;   // Integer indicating current stage
        this.w2Mark = this.ms; // Marks when next jump is available
      },
      normState: function() { return { ...insp.Ace.normState.call(this),
        w1Mark: this.w1Mark, w1State: this.w1State, w2Mark: this.w2Mark
      };},
      aceUpdate: function({ cx, cy, a1, a2 }, updData) {
        
        let { aheadDist, ms, spf } = updData;
        let birth = [];
        
        // Activate weapon 1
        if (a1) {
          
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
              this.effects.add({ mark: ms + Insp.w1ChargePunishMs, type: 'spdMult', spdMult: Insp.w1ChargePunishSlow });
              
            } else if (this.w1State === 1) {
              
              // Weapon 1 act 1: Spread shot
              
              let { x, y } = this.calcState(updData);
              let incAng = 0.018;
              let args = { aheadDist, ms, owner: this, x, y, vel: 350, dmg: 1, r: 6 };
              
              birth.gain([ ...util.incCen(9, incAng) ].map(ang => JoustManBullet({
                ...args, ang, lsMs: 650, dmg: 0.75
              })));
              
              this.effects.add({ mark: ms + 500, type: 'spdMult', spdMult: 0.5 });
              
            } else if (this.w1State === 2) {
              
              // Weapon 1 act 2: Spheres
              birth.gain([
                JoustManLaserSphere({ ms, joustMan: this, xOff: -66, yOff: +12, durationMs: 1400, dps: 15, r: 26 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: +66, yOff: +12, durationMs: 1400, dps: 15, r: 26 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: +24, yOff: -27, durationMs: 1400, dps: 11, r: 18 }),
                JoustManLaserSphere({ ms, joustMan: this, xOff: -24, yOff: -27, durationMs: 1400, dps: 11, r: 18 })
              ]);
              this.effects.add({ mark: ms + 1150, type: 'spdMult', spdMult: 1.3 });
              
            } else if (this.w1State === 3) {
              
              // Weapon 1 act 3: BIG LASER
              birth.gain([ JoustManLaserVert({ ms, joustMan: this }) ]);
              this.effects.add({ mark: ms + JoustManLaserVert.durationMs, type: 'spdMult', spdMult: Insp.w1Charge3Slow });
              
            }
            
            this.w1State = 0;
            this.w1Mark = 0;
            
          }
          
        }
        
        // Activate weapon 2
        if (a2 && cx && (!this.w2Mark || ms > this.w2Mark)) {
          
          this.w2Mark = ms + Insp.w2Delay;
          
          let dir = cx > 0 ? +1 : -1;
          this.invulnMark = Math.max(this.invulnMark, ms + 250);
          this.effects.add({ mark: ms + 250, fn: (inst, { spf }) => this.ctrlX += dir * Insp.w2DashSpeed * spf });
          this.effects.add({ mark: ms + 250, type: 'spdMult', spdMult: 0 });
          
          birth.gain(Array.fill(4, n => JoustManLaserSphere({
            ms, joustMan: this, xOff: -dir * (n + 1) * 30, yOff: 0, durationMs: Insp.w2DurationMs, dps: Insp.w2OrbDps, r: 9
          })));
          
          birth.gain([ JoustManLaserSphere({ ms, joustMan: this, xOff: 0, yOff: 0, durationMs: Insp.w2DurationMs, dps: Insp.w2OrbDps, r: 20 }) ]);
          
        }
        
        return { birth };
        
      }
      
    })});
    let GunGirl = U.inspire({ name: 'GunGirl', insps: { Ace }, methods: (insp, Insp) => ({
      
      $shootSteps: [
        { ms: 1000, ang: -0.01, dmgMult: 1   },  // Inwards
        { ms: 1000, ang:  0.00, dmgMult: 1.4 },  // Parallel again
        { ms: 1500, ang: +0.02, dmgMult: 1   },  // Very slowly increase angle
        { ms: 4000, ang: +0.25, dmgMult: 1   }   // Slowly bend all the way outwards
      ],
      $w1Delay: 85, $bulletDmg: 0.31, $w1LockMs: 1100,
      $w1ShortLockPunishSlow: 0.36, $w1ShortLockPunishMs: 300,
      $w1LongLockPunishSlow: 0.80, $w1LongLockPunishMs: 800,
      $w1ReloadBoostMs: 800, $w1ReloadBoostAmt: 1.55,
      $w2Delay: 10000, $w2Duration: 1900,
      $bulletDmg: 0.3, $bulletSpd: 740, $bulletMs: 800,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceGun' }),
      $render: (draw, updData, args) => {
        
        Insp.parents.Ace.render(draw, updData, args, Insp.imageKeep, () => {
          let { x, y, w2ReadyMark } = args;
          let w2MsRemaining = w2ReadyMark - updData.ms;
          let barW = Math.min(1, (Insp.w2Delay - w2MsRemaining) / Insp.w2Delay) * 16;
          draw.rectCen(x, y - 12, barW, 4, { fillStyle: (w2MsRemaining > 0) ? '#6060ff' : '#0000ff' });
        });
        
      },
      
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
      aceUpdate: function({ a1, a2 }, updData) {
        
        let { aheadDist, ms, spf } = updData;
        let birth = [];
        
        // Reset `this.lockoutPunishMark` when the duration ends
        if (this.lockoutPunishMark && ms >= this.lockoutPunishMark) this.lockoutPunishMark = null;
        
        if (this.w1LockMark && ms >= this.w1LockMark) {
          this.w1LockMark = null;
          
          // Upon reload, get a speed boost
          this.effects.add({ mark: ms + Insp.w1ReloadBoostMs, type: 'spdMult', spdMult: Insp.w1ReloadBoostAmt });
        }
        
        // End w2 when the duration elapses
        if (this.w2Mark && ms >= this.w2Mark) { this.w2Mark = null; this.w1LockMark = ms + Insp.w1LockMs; }
        
        if (a1 && !this.w1LockMark && (!this.w1Mark || ms >= this.w1Mark)) {
          
          // Mark the time of the first shot in the series
          if (!this.w1StartMark) this.w1StartMark = ms;
          
          let { x, y } = this.calcState(updData);
          if (!this.w2Mark) {
            
            // Enforce typical rate of fire
            this.w1Mark = (this.w1Mark || ms) + Insp.w1Delay;
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(ms - this.w1StartMark);
            birth.gain([
              DirectedBullet({ aheadDist, ms, owner: this, x: x - 4, y, ang: -ang, vel: Insp.bulletSpd, dmg: Insp.bulletDmg * dm, r: 3 * dm, lsMs: Insp.bulletMs }),
              DirectedBullet({ aheadDist, ms, owner: this, x: x + 4, y, ang: +ang, vel: Insp.bulletSpd, dmg: Insp.bulletDmg * dm, r: 3 * dm, lsMs: Insp.bulletMs })
            ]);
            
          } else {
            
            // Enforce steroid rate of fire
            this.w1Mark = (this.w1Mark || ms) + Insp.w1Delay * (1 / 2);
            
            let { dmgMult: dm, smoothAng: ang } = this.getAngForShootDuration(this.w2EffectiveShootDuration);
            birth.gain([
              DirectedBullet({ aheadDist, ms, owner: this, x: x - 8, y, ang: -(ang * 1.5), vel: Insp.bulletSpd, dmg: Insp.bulletDmg * 1.15 * dm, r: 5 * dm, lsMs: Insp.bulletMs }),
              DirectedBullet({ aheadDist, ms, owner: this, x: x - 4, y, ang: -(ang * 1.0), vel: Insp.bulletSpd, dmg: Insp.bulletDmg * 1.15 * dm, r: 5 * dm, lsMs: Insp.bulletMs }),
              DirectedBullet({ aheadDist, ms, owner: this, x: x + 4, y, ang: +(ang * 1.0), vel: Insp.bulletSpd, dmg: Insp.bulletDmg * 1.15 * dm, r: 5 * dm, lsMs: Insp.bulletMs }),
              DirectedBullet({ aheadDist, ms, owner: this, x: x + 8, y, ang: +(ang * 1.5), vel: Insp.bulletSpd, dmg: Insp.bulletDmg * 1.15 * dm, r: 5 * dm, lsMs: Insp.bulletMs })
            ]);
            
          }
          
        } else if (this.w1Mark && ms >= this.w1Mark) {
          
          // Just stopped shooting! Lockout!
          this.w1Mark = null;
          this.w1StartMark = null;
          this.w1LockMark = ms + Insp.w1LockMs;
          
          this.effects.add({ mark: ms + Insp.w1ShortLockPunishMs, type: 'spdMult', spdMult: Insp.w1ShortLockPunishSlow });
          this.effects.add({ mark: ms + Insp.w1LongLockPunishMs, type: 'spdMult', spdMult: Insp.w1LongLockPunishSlow });
          
        }
        
        if (a2) {
          
          if (ms >= this.w2ReadyMark) {
            
            this.w2ReadyMark = ms + Insp.w2Duration + Insp.w2Delay;
            this.w2Mark = ms + Insp.w2Duration;
            this.w2EffectiveShootDuration = ms - (this.w1StartMark || ms)
            
            let incAng = 0.029;
            let { x, y } = this.calcState(updData);
            let bulletArgs = { aheadDist, ms, owner: this, x, y, vel: 140, r: 5 };
            birth.gain([ ...util.incCen(15, incAng) ].map(ang => DirectedBullet({
              ...bulletArgs, ang: 0.5 + ang, lsMs: 2500, dmg: 4
            })));
            
          } else {
            
            if (!this.lockoutPunishMark) {
              this.lockoutPunishMark = ms + 500;
              this.effects.add({ mark: ms + 500, type: 'spdMult', spdMult: 0.4 });
            }
            
          }
          
        }
        
        return { birth };
        
      }
      
    })});
    let SlamKid = U.inspire({ name: 'SlamKid', insps: { Ace }, methods: (insp, Insp) => ({
      
      $slamSpd: 400, $slamDelay: 760,
      $slamCharge1Ms: 300, $slamCharge2Ms: 630, $slamCharge3Ms: 750,
      $slamPunishMs: 1500, $slamPunishSlow: 0.25,
      $missileSpd: 750, $missileDmg: 2.1, $missilePDmg: [0.3,4.5],
      $shotgunCnt: 18, $shotgunInitAng: 0.023, $shotgunAng: 0.009,
      $shotgunSpd: 650, $shotgunDmg: 0.082, $shotgunPDmg: [0.09,0.28], $shotgunLsMs: 305,
      $shotgunSlamDelayMult: 0.55,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSlam' }),
      $render: (draw, updData, args) => {
        
        Insp.parents.Ace.render(draw, updData, args, Insp.imageKeep, () => {
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
      normState: function() { return { ...insp.Ace.normState.call(this),
        w1Mark: this.w1Mark, w2Mark: this.w2Mark,
        w1StartMark: this.w1StartMark, w2StartMark: this.w2StartMark
      }},
      aceUpdate: function({ a1, a2 }, updData) {
        
        let { aheadDist, ms, spf } = updData;
        let birth = [];
        
        // Slam Kid is symmetrical; do the same thing in two directions:
        let dirs = [ [ -1, a1, 'w1Mark', 'w1StartMark' ], [ +1, a2, 'w2Mark', 'w2StartMark' ] ];
        for (let [ mult, act, wMark, wMarkStart ] of dirs) {
          
          if (act && ms > this[wMark] && (!this[wMarkStart] || ms < this[wMarkStart] + Insp.slamCharge3Ms)) {
            
            if (!this[wMarkStart]) {
              this[wMarkStart] = ms;
              
              let inc1 = 10; let inc2 = 20;
              birth.gain([
                SlamKidSlammer({ ms, slamKid: this, dir: mult, xOff: +inc2 + (mult * 20), yOff: (-inc2 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, xOff: +inc1 + (mult * 20), yOff: (-inc1 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, xOff:     0 + (mult * 20), yOff: (    0 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, xOff: -inc1 + (mult * 20), yOff: (+inc1 * mult) + 16 }),
                SlamKidSlammer({ ms, slamKid: this, dir: mult, xOff: -inc2 + (mult * 20), yOff: (+inc2 * mult) + 16 })
              ])
            }
            
            let duration = ms - this[wMarkStart];
            let durFade = Math.pow(util.fadeAmt(1, 0.1, duration / Insp.slamCharge3Ms), 0.95);
            this.ctrlX += this.slamSpd * spf * durFade * mult;
            this.ctrlY += this.slamSpd * spf * durFade;
            
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
              let { x, y } = this.calcState(updData);
              let missileArgs = { aheadDist, ms, owner: this, x: x + (mult * 9), y };
              birth.gain([
                SimpleBullet({ ...missileArgs, spd: +Insp.missileSpd, dmg: Insp.missileDmg, pDmg: Insp.missilePDmg, w: 7, h: 20 }),
                SimpleBullet({ ...missileArgs, spd: -Insp.missileSpd, dmg: Insp.missileDmg, pDmg: Insp.missilePDmg, w: 7, h: 20 })
              ]);
              this.effects.add({ mark: ms + 150, type: null, fn: (inst, { spf }) => {
                this.ctrlY -= 220 * spf;
              }});
              this[wMark] = ms + Insp.slamDelay;
              
            } else {
              
              // Shotgun!
              let { x, y } = this.calcState(updData);
              let shotgunArgs = {
                aheadDist, ms, owner: this, x: x + mult * 7, y: y - 7,
                dmg: Insp.shotgunDmg, pDmg: Insp.shotgunPDmg,
                vel: Insp.shotgunSpd,
                lsMs: Insp.shotgunLsMs,
                r: 2
              };
              birth.gain([ ...util.incCen(Insp.shotgunCnt, Insp.shotgunAng) ].map(ang => DirectedBullet({
                ...shotgunArgs, ang: mult * (0.125 + ang)
              })));
              
              this.effects.add({ mark: ms + 300, type: 'spdMult', spdMult: 1.2, fn: (inst, { spf }) => {
                inst.ctrlX -= mult * 50 * spf;
                inst.ctrlY -= 50 * spf;
              }});
              this[wMark] = ms + Insp.slamDelay * Insp.shotgunSlamDelayMult;
              
            }
            
            this[wMarkStart] = null;
            
          }
          
        }
        
        let spdMult = (this.w1StartMark || this.w2StartMark) ? 0.55 : 1;
        return { spdMult, birth };
        
      }
      
    })});
    let SalvoLad = U.inspire({ name: 'SalvoLad', insps: { Ace }, methods: (insp, Insp) => ({
      
      $comboDelayMs: 800, $comboPunishDelayMs: 1000,
      $decampDelayMs: 1200, $decampDurationMs: 350, $decampSpdMult: 0.5, $decampSpd: 430,
      $diveDelayMs: 550, $diveMs: 700, $diveSpdMult: 0.58, $diveFwdMult: 450, $diveBombLsMs: 1100,
      $missileDelayMs: 800, $missileDmg: 0.5, $missilePDmg:  [0.1,2],
      $suppressDelayMs: 600, $suppressDmg: 0.4,
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.aceSalvo' }),
      $render: (draw, updData, args) => {
        
        Insp.parents.Ace.render(draw, updData, args, Insp.imageKeep, () => {
          let { x, y, readyMark, combo } = args;
          
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
          
        });
        
      },
      
      init: function({ ...args }={}) {
        insp.Ace.init.call(this, args);
        
        this.readyMark = null;
        this.combo = '';
        
        this.a1Up = false;
        this.a2Up = false;
        
        this.comboMapping = {
          '<<<': this.comboDecamp.bind(this, -1),
          '>>>': this.comboDecamp.bind(this, +1),
          
          '<<>': this.comboDiveBomb.bind(this, -1),
          '>><': this.comboDiveBomb.bind(this, +1),
          
          '<>>': this.comboMissiles.bind(this, -1),
          '><<': this.comboMissiles.bind(this, +1),
          
          '<><': this.comboSuppress.bind(this, -1),
          '><>': this.comboSuppress.bind(this, +1)
        };
      },
      normState: function() { return { ...insp.Ace.normState.call(this), readyMark: this.readyMark, combo: this.combo }; },
      comboDecamp: function(dir, updData) {
        
        let { ms, spf, aheadDist } = updData;
        this.invulnMark = Math.max(this.invulnMark, ms + Insp.decampDurationMs);
        this.effects.add({ mark: ms + Insp.decampDurationMs,
          type: 'spdMult', spdMult: Insp.decampSpdMult,
          fn: (inst, { spf }) => inst.ctrlX += Insp.decampSpd * spf * dir
        });
        
        let { x, y } = this.calcState(updData);
        let missileArgs = { aheadDist, ms, salvoLad: this, x, y };
        return {
          delayMs: Insp.decampDelayMs,
          birth: [
            SalvoLadDumbBomb({ ...missileArgs, ang: 0.5 + dir * 0.000, vel:  15, lsMs:  400, kaboomArgs: { dps: 4.75, duration: 1900 } }),
            SalvoLadDumbBomb({ ...missileArgs, ang: 0.5 + dir * 0.005, vel: 100, lsMs:  800, kaboomArgs: { dps: 4.75, duration: 2300 } }),
            SalvoLadDumbBomb({ ...missileArgs, ang: 0.5 - dir * 0.005, vel: 120, lsMs: 1400, kaboomArgs: { dps: 4.75, duration: 2150 } })
          ]
        };
        
      },
      comboDiveBomb: function(dir, { ms, spf, aheadDist }) {
        
        this.effects.add({ mark: ms + Insp.diveMs,
          type: 'spdMult', spdMult: Insp.diveSpdMult,
          fn: (inst, { ms: ms1, spf }) => {
            inst.ctrlX += dir * 150 * spf;
            inst.ctrlY += ((ms1 - ms) / Insp.diveMs) * Insp.diveFwdMult * spf;
          },
          endFn: (inst, updData, { birth }) => {
            let { aheadDist, ms } = updData;
            let { x, y } = inst.calcState(updData);
            let missileArgs = { aheadDist, ms, salvoLad: inst, x, y };
            birth.gain([
              SalvoLadDumbBomb({ ...missileArgs, ang: dir * 0.113, vel: 120, lsMs: Insp.diveBombLsMs * 1.010, kaboomArgs: { dps: 4.75, duration: 1900 } }),
              SalvoLadDumbBomb({ ...missileArgs, ang: dir * 0.085, vel: 138, lsMs: Insp.diveBombLsMs * 1.000, kaboomArgs: { dps: 4.75, duration: 2300 } }),
              SalvoLadDumbBomb({ ...missileArgs, ang: dir * 0.039, vel: 125, lsMs: Insp.diveBombLsMs * 0.989, kaboomArgs: { dps: 4.75, duration: 2150 } })
            ])
          }
        });
        return { birth: [], delayMs: Insp.diveDelayMs };
        
      },
      comboMissiles: function(dir, { ms, aheadDist }) {
        
        let args = { owner: this, w: 6, h: 16, vel: 700 };
        for (let i = 0; i < 5; i++) {
          this.effects.add({ mark: ms + 50 + i * 30, endFn: (inst, updData, { birth }) => birth.gain([
            SalvoLadMissile({
              aheadDist: updData.aheadDist, ms: updData.ms, ...args, ...inst.calcState(updData).slice('x', 'y'),
              horzSpd: (50 + 55 * (i + 1)) * dir, horzMs: 400, delayMs: 120,
              dmg: Insp.missileDmg, pDmg: Insp.missilePDmg
            })
          ])});
        }
        return { birth: [], delayMs: Insp.missileDelayMs };
        
      },
      comboSuppress: function(dir, { ms }) {
        
        this.effects.add({ mark: ms + 500, type: 'spdMult', spdMult: 1.5 });
        
        let args = { ang: dir * 0.125, dmg: Insp.suppressDmg, r: 4, lsMs: 500, vel: 360, acl: 800 };
        for (let i = 0; i < 11; i++) {
          
          let alt = i % 4;
          this.effects.add({ mark: ms + 50 + i * alt * 18, endFn: (inst, updData, { birth }) => {
            let { aheadDist, ms } = updData;
            let { x, y } = inst.calcState(updData);
            let bullet = DirectedBullet({ aheadDist, ms, owner: inst, ...args,
              x: x + dir * alt * 6, y: y + 24 - 12 * alt
            });
            birth.gain([ bullet ]);
          }});
          
        }
        return { birth: [], delayMs: Insp.suppressDelayMs };
        
      },
      aceUpdate: function({ a1, a2 }, updData) {
        
        let { ms, spf } = updData;
        let birth = [];
        
        if (this.readyMark && ms >= this.readyMark) { this.readyMark = null; this.combo = ''; }
        
        if (!this.readyMark) {
          
          if (a1) {
            if (!this.a1Up && !a2) { this.combo += '<'; this.a1Up = true; }
          } else {
            this.a1Up = false;
          }
          
          if (a2) {
            if (!this.a2Up && !a1) { this.combo += '>'; this.a2Up = true; }
          } else {
            this.a2Up = false;
          }
          
          if (this.comboMapping.has(this.combo)) {
            let comboResult = this.comboMapping[this.combo](updData);
            this.readyMark = ms + comboResult.delayMs;
            birth.gain(comboResult.birth);
          } else if (this.combo.length >= 5) {
            this.effects.add({ mark: ms + Insp.comboPunishDelayMs, type: 'spdMult', spdMult: 0.45 });
            this.readyMark = ms + Insp.comboDelayMs;
          }
          
        }
        
        return { birth };
        
      }
      
    })});
    
    // Good guy util
    let JoustManBullet = U.inspire({ name: 'JoustManBullet', insps: { DirectedBullet }, methods: (insp, Insp) => ({
      $render: (draw, updData, { x, y, r, team }) => {
        draw.circ(x, y, r,       { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      }
    })});
    let JoustManLaserSphere = U.inspire({ name: 'JoustManLaserSphere', insps: { Entity }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, { x, y, r }) => {
        draw.circ(x, y, r, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.circ(x, y, r * 0.6, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      },
      
      init: function({ joustMan, xOff, yOff, durationMs, dps, r, ...args }) {
        insp.Entity.init.call(this, args);
        this.joustMan = joustMan;
        this.joustManUid = joustMan.uid;
        this.xOff = xOff; this.yOff = yOff;
        this.durationMs = durationMs;
        this.dps = dps;
        this.r = r;
      },
      getTeam: function() { return this.joustMan.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep, { spf }) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, this.dps * spf);
        rep.hp -= dmg;
        this.joustMan.scoreDamage += dmg;
      },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr, { joustManUid: i.joustManUid, xOff: i.xOff, yOff: i.yOff, r: i.r })),
      calcState: function(updData) {
        
        let { entities } = updData;
        let joustManEnt = entities.has(this.joustManUid) && entities[this.joustManUid];
        let joustManSpt = joustManEnt && joustManEnt.relNozz('fly.sprite').set.toArr(v => v)[0];
        if (!joustManSpt) return { x: 0, y: 0 };
        
        let val = { ...joustManEnt.val, ...joustManSpt.val };
        let { x, y } = mdlClasses[val.type].prototype.calcState.call(val, updData);
        
        return { x: x + this.xOff, y: y + this.yOff };
        
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        //this.x = this.joustMan.x + this.xOff;
        //this.y = this.joustMan.y + this.yOff;
        return { x, y, form: 'circle', r: this.r, birth: [] };
      },
      isAlive: function(updData) {
        return this.joustMan.isAlive(updData) && (updData.ms - this.ms) < this.durationMs;
      }
      
    })});
    let JoustManLaserVert = U.inspire({ name: 'JoustManLaserVert', insps: { Entity }, methods: (insp, Insp) => ({
      
      $durationMs: 3000, $dps: 12,
      $render: (draw, updData, { x, y }) => {
        let w = 26;
        let h = 1200;
        draw.rectCen(x, y, w, h, { fillStyle: 'rgba(0, 255, 255, 0.65)' });
        draw.rectCen(x, y, w * 0.6, h, { fillStyle: 'rgba(255, 255, 255, 0.4)' });
      },
      
      init: function({ joustMan, ...args }={}) {
        insp.Entity.init.call(this, args);
        this.joustMan = joustMan;
        this.joustManUid = joustMan.uid;
      },
      getTeam: function() { return this.joustMan.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep, { spf }) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, Insp.dps * spf);
        rep.hp -= dmg;
        this.joustMan.scoreDamage += dmg;
      },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr, { joustManUid: i.joustManUid })),
      calcState: function(updData) {
        let { entities } = updData;
        let joustManEnt = entities.has(this.joustManUid) && entities[this.joustManUid];
        let joustManSpt = joustManEnt && joustManEnt.relNozz('fly.sprite').set.toArr(v => v)[0];
        if (!joustManSpt) return { x: 0, y: 0 };
        
        let val = { ...joustManEnt.val, ...joustManSpt.val };
        let { x, y } = mdlClasses[val.type].prototype.calcState.call(val, updData);
        
        return { x, y: y + 606 };
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        return { x, y, form: 'rect', w: 22, h: 1200, birth: [] };
      },
      isAlive: function(updData) {
        return this.joustMan.isAlive(updData) && (updData.ms - this.ms) < Insp.durationMs;
      }
      
    })});
    let SlamKidSlammer = U.inspire({ name: 'SlamKidSlammer', insps: { Entity }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 7 }, $dmg: 1.4,
      $render: (draw, updData, { x, y, ggg }) => {
        draw.circ(x, y, Insp.bound.r, { fillStyle: Bullet.getColour(+1) });
      },
      
      init: function({ slamKid, dir, xOff, yOff, ...args }={}) {
        insp.Entity.init.call(this, args);
        this.slamKid = slamKid;
        this.dir = dir;
        this.xOff = xOff; this.yOff = yOff;
        this.integrity = 1;
        this.slamKidUid = this.slamKid.uid;
      },
      getTeam: function() { return this.slamKid.getTeam(); },
      canCollide: function() { return true; },
      collide: function(rep, updData) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, Insp.dmg);
        rep.hp -= dmg;
        this.slamKid.scoreDamage += dmg;
        this.integrity = 0;
      },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr, { slamKidUid: i.slamKidUid, xOff: i.xOff, yOff: i.yOff })),
      calcState: function(updData) {
        let { entities } = updData;
        let slamKidEnt = entities.has(this.slamKidUid) && entities[this.slamKidUid];
        let slamKidSpt = slamKidEnt && slamKidEnt.relNozz('fly.sprite').set.toArr(v => v)[0];
        if (!slamKidSpt) return { x: 0, y: 0 };
        
        let val = { ...slamKidEnt.val, ...slamKidSpt.val };
        let { x, y } = mdlClasses[val.type].prototype.calcState.call(val, updData);
        
        return { x: x + this.xOff, y: y + this.yOff };
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        this.x = x;// this.slamKid.x + this.xOff;
        this.y = y;// this.slamKid.y + this.yOff;
        return { x, y, ...Insp.bound };
      },
      isAlive: function(updData) {
        return true
          && this.integrity > 0
          && this.slamKid.isAlive(updData) // SlamKid is alive
          && this.slamKid[(this.dir === -1) ? 'w1StartMark' : 'w2StartMark'] // Slammer is used
      }
      
    })});
    let SalvoLadDumbBomb = U.inspire({ name: 'SalvoLadDumbBomb', insps: { Geom, Mover }, methods: (insp, Insp) => ({
      
      $r: 13,
      $render: (draw, updData, { x, y }) => {
        draw.circ(x, y, Insp.r, { fillStyle: '#ff0000', strokeStyle: '#ff8400' });
      },
      
      init: function({ salvoLad, x, y, lsMs, kaboomArgs={}, ...args }) {
        this.salvoLad = salvoLad;
        insp.Geom.init.call(this, { ...args, x, y });
        insp.Mover.init.call(this, args);
        this.lsMs = lsMs;
        this.kaboomArgs = kaboomArgs;
      },
      canCollide: function() { return false; },
      isAlive: function(updData) {
        return true
          && (updData.ms - this.ms) < this.lsMs
          && insp.Mover.isAlive.call(this, updData);
      },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        this.x = x;
        this.y = y;
        return { x, y, form: 'circle', r: this.r, birth: [] };
      },
      dieAndGetResult: function({ aheadDist, ms }) {
        return { birth: [
          SalvoLadKaboom({ aheadDist, ms, salvoLad: this.salvoLad, x: this.x, y: this.y, ...this.kaboomArgs })
        ]};
      }
    })});
    let SalvoLadKaboom = U.inspire({ name: 'SalvoLadKaboom', insps: { Geom }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, args) => {
        let { x, y, r } = args;
        draw.circ(x, y, r, { fillStyle: 'rgba(255, 50, 30, 0.2)', strokeStyle: '#ff8400' });
      },
      
      init: function({ aheadDist, salvoLad, dps=3.1, durationMs=2000, sizePerSec=40, ...args }) {
        insp.Geom.init.call(this, args);
        this.salvoLad = salvoLad;
        this.r = 0;
        this.dps = dps;
        this.durationMs = durationMs;
        this.sizePerSec = sizePerSec;
        this.initDist = aheadDist;
        this.initX = this.x;
        this.initY = this.y;
      },
      getTeam: function() { return this.salvoLad.getTeam(); },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr, {
        initX: i.initX, initY: i.initY, initDist: i.initDist, durationMs: i.durationMs, sizePerSec: i.sizePerSec
      })),
      calcState: function(updData) {
        return {
          x: this.initX,
          y: this.initY + (updData.aheadDist - this.initDist) * 0.5,
          r: this.sizePerSec * (updData.ms - this.ms) * 0.001
        };
      },
      canCollide: function() { return true; },
      collide: function(rep, { spf }) {
        if (!U.isInspiredBy(rep, Mortal)) return;
        let dmg = Math.min(rep.hp, this.dps * spf);
        rep.hp -= dmg;
        this.salvoLad.scoreDamage += dmg;
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y, r } = this.calcState(updData);
        this.x = x;
        this.y = y;
        this.r = r;
        // let { ms, spf, aheadSpd } = updData;
        // this.r += this.sizePerSec * spf;
        // this.y += (aheadSpd * 0.5) * spf;
        return { form: 'circle', x, y, r, birth: [] };
      },
      isAlive: function({ ms }) { return (ms - this.ms) < this.durationMs; }
      
    })});
    let SalvoLadMissile = U.inspire({ name: 'SalvoLadMissile', insps: { SimpleBullet }, methods: (insp, Insp) => ({
      
      $render: Insp.parents.SimpleBullet.render,
      
      init: function({ horzSpd, horzMs, delayMs, ...args }) {
        insp.SimpleBullet.init.call(this, args);
        this.horzSpd = horzSpd;
        this.horzMs = horzMs;
        this.delayMs = delayMs;
      },
      permState: function() { return {
        ...insp.SimpleBullet.permState.call(this),
        horzMs: this.horzMs, horzSpd: this.horzSpd, delayMs: this.delayMs
      };},
      calcState: function(updData) {
        
        let durMs = updData.ms - this.ms;
        let x = this.initX;;
        let y = this.initY + (updData.aheadDist - this.initDist) * durMs * 0.001;
        
        // X changes for horzMs, then stays put
        if (durMs < this.horzMs)  x += this.horzSpd * durMs * 0.001
        else                      x += this.horzSpd * this.horzMs * 0.001
        
        // Y changes after X is done changing, and the delay expires
        if (durMs >= (this.horzMs + this.delayMs)) y += this.spd * (durMs - this.horzMs - this.delayMs) * 0.001;
        
        return { x, y };
        
      }
      
    })});
    
    // BAD GUYS
    let Enemy = U.inspire({ name: 'Enemy', insps: { Geom, Mortal }, methods: (insp, Insp) => ({
      
      $render: (draw, updData, { imageKeep, x, y, w, h=w, rot=Math.PI }) => {
        draw.frame(() => {
          draw.trn(x, y);
          if (rot) draw.rot(rot);
          draw.imageCen(imageKeep, 0, 0, w, h);
        });
      },
      
      init: function({ relDist=0, x, y, ...args }) {
        insp.Geom.init.call(this, args);
        insp.Mortal.init.call(this, args);
        this.x = x; this.y = relDist + y;
        this.w = 40; this.h = 40;
        this.scoreDamage = 0;
      },
      canCollide: function() { return true; },
      collide: function(rep, updData) {
        if (U.isInspiredBy(rep, Ace)) {
          let enemyHp = this.hp;
          rep.hp -= 1; // Pretty much kills the Ace instantly
        }
      },
      getTeam: function() { return -1; },
      updateAndGetResult: function(entity, updData) {
        return { birth: [], form: 'rect', x: this.x, y: this.y, w: this.w, h: this.h };
      },
      isAlive: insp.Mortal.isAlive
      
    })});
    let Winder = U.inspire({ name: 'Winder', insps: { Enemy }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 20 },
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWinder' }),
      $render: (draw, updData, { imageKeep=Insp.imageKeep, ext=Insp.bound.r << 1, spd, x, y }) => {
        Insp.parents.Enemy.render(draw, updData, { imageKeep, x, y, w: ext, rot: (spd < 0) ? Math.PI : 0 });
      },
      init: function({ aheadDist=0, spd=100, delayMs=0, swingHz=2, swingAmt=100, numSwings=0, phase=0, ...args }) {
        if (swingHz < 0) throw Error(`Negative "swingHz" param; use negative "swingAmt" instead`);
        insp.Enemy.init.call(this, args);
        this.spd = spd;
        this.delayMs = delayMs;
        this.phase = phase * Math.PI * 2;
        this.swingHz = swingHz;
        this.swingAmt = swingAmt;
        this.numSwings = numSwings;
        this.initX = this.x;
        this.initY = this.y;
        this.initDist = aheadDist;
      },
      permState: function() { return {
        ...insp.Enemy.permState.call(this),
        initX: this.initX, initY: this.initY, initDist: this.initDist,
        spd: this.spd, delayMs: this.delayMs,
        phase: this.phase, swingHz: this.swingHz, swingAmt: this.swingAmt
      };},
      calcState: function(updData) {
        let durMs = updData.ms - this.ms;
        return {
          x: (durMs >= this.delayMs)
            ? this.initX + Math.sin(this.phase + (durMs - this.delayMs) * 0.002 * Math.PI * this.swingHz) * this.swingAmt
            : this.initX,
          y: this.initY + (updData.aheadDist - this.initDist) + (this.spd * durMs * 0.001)
        };
      },
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        this.x = x;
        this.y = y;
        return { x, y, ...this.constructor.bound, birth: [] };
      },
      isAlive: function(updData) {
        if (!insp.Enemy.isAlive.call(this, updData)) return false;
        
        let { ms, bounds } = updData;
        
        return true
          && (!this.numSwings || ((ms - this.ms - this.delayMs) * 0.001 * this.swingHz) <= this.numSwings)
          && (this.spd > 0 || this.y > bounds.total.b - 30)
          && (this.spd < 0 || this.y < bounds.total.t + 30);
      }
      
    })});
    let Weaver = U.inspire({ name: 'Weaver', insps: { Winder, Enemy }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 34 }, $hp: 8,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyWeaver' }),
      $render: (draw, updData, vals) => {
        Insp.parents.Winder.render(draw, updData, { imageKeep: Insp.imageKeep, ext: Insp.bound.r << 1, ...vals });
      },
      
      ...insp.Winder.slice('init', 'permState', 'fluxState', 'isAlive', 'updateAndGetResult'),
      getMaxHp: function() { return Insp.hp; }
      
    })});
    let Furler = U.inspire({ name: 'Furler', insps: { Winder, Enemy }, methods: (insp, Insp) => ({
      
      $bound: { form: 'circle', r: 24 }, $hp: 4,
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyFurler' }),
      $render: (draw, updData, vals) => {
        Insp.parents.Winder.render(draw, updData, { imageKeep: Insp.imageKeep, ext: Insp.bound.r << 1, ...vals });
      },
      
      init: function({ shootDelayMs, shootDelayInitMs=shootDelayMs, bulletArgs={}, ...args }) {
        insp.Winder.init.call(this, args);
        this.shootDelayMs = shootDelayMs;
        this.bulletArgs = bulletArgs;
        this.shootMark = this.ms + shootDelayInitMs;
      },
      ...insp.Winder.slice('permState', 'fluxState', 'isAlive'),
      getMaxHp: function() { return Insp.hp; },
      updateAndGetResult: function(entity, updData) {
        
        let supUpd = insp.Winder.updateAndGetResult.call(this, entity, updData);
        
        let { aheadDist, ms } = updData;
        if (ms >= this.shootMark) {
          this.shootMark += this.shootDelayMs;
          let bulletOff = Insp.bound.r * 0.5;
          supUpd.birth.gain([
            SimpleBullet({ aheadDist, ms, owner: this, x: this.x - bulletOff, y: this.y,
              spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
              ...this.bulletArgs
            }),
            SimpleBullet({ aheadDist, ms, owner: this, x: this.x + bulletOff, y: this.y,
              spd: -380, dmg: 1, w: 4, h: 20, lsMs: 3000,
              ...this.bulletArgs
            })
          ]);
        }
        
        return supUpd;
        
      },
      isAlive: insp.Winder.isAlive
      
    })});
    let Drifter = U.inspire({ name: 'Drifter', insps: { Enemy, Mover }, methods: (insp, Insp) => ({
      
      $imageKeep: foundation.getKeep('urlResource', { path: 'fly.sprite.enemyDrifter' }),
      $render: (draw, updData, { x, y, vy, r }) => {
        
        Insp.parents.Enemy.render(draw, updData, { imageKeep: Insp.imageKeep, x, y,
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
        this.dist = null; // Move indefinitely
        // this.initDist = null; // This unit is Grounded! (Ignores aheadSpd)
      },
      getRadius: function() { return this.minSize + this.hp * this.sizeMult; },
      getMaxHp: function() { return this.hp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      fluxState: function() { return { r: this.getRadius() }; },
      updateAndGetResult: function(entity, updData) {
        
        let { x, y } = this.calcState(updData);
        this.x = x; this.y = y;
        
        let { spf } = updData;
        this.hp += this.hpPerSec * spf;
        this.size = this.minSize + this.hp * this.sizeMult;
        
        return { x: this.x, y: this.y, form: 'circle', r: this.getRadius() };
        
      },
      isAlive: function(updData) {
        return true
          && insp.Enemy.isAlive.call(this, updData)
          && insp.Mover.isAlive.call(this, updData);
      }
      
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
      
      init: function({ mode, delayMs, initDelay=0, bulletArgs={}, ...args }) {
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        this.mode = mode;
        this.delayMs = delayMs;
        this.shootMark = this.ms + initDelay;
        this.dist = null;
      },
      ...insp.Enemy.slice('canCollide', 'collide'),
      getMaxHp: function() { return Insp.maxHp; },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      updateAndGetResult: function(entity, updData) {
        let { x, y } = this.calcState(updData);
        this.x = x; this.y = y;
        
        let { aheadDist, ms, spf } = updData;
        let birth = [];
        
        let shootCondition = (this.mode === 'steady')
          ? (ms >= this.shootMark)
          : (Math.random() < ((spf * 1000) / this.delayMs));
        
        if (shootCondition) {
          birth.gain([
            SimpleBullet({
              aheadDist, ms, owner: this, x: this.x, y: this.y,
              spd: -380, dmg: 1, w: 8, h: 20,
              lsMs: 3000
            })
          ]);
          this.shootMark += this.delayMs;
        }
        
        return { x: this.x, y: this.y, ...Insp.bound, birth };
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
      
      init: function({ spawnMs=3000, spawnArgs={}, ...args }) {
        insp.Enemy.init.call(this, args);
        insp.Mover.init.call(this, args);
        
        this.spawnMs = spawnMs;
        this.spawnMark = this.ms + this.spawnMs;
        this.spawnArgs = spawnArgs;
      },
      getMaxHp: function() { return Insp.maxHp; },
      ...insp.Enemy.slice('canCollide', 'collide'),
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      moveWithLevel: function() { return true; },
      stopAtDestination: function() { return true; },
      updateAndGetResult: function(entity, updData) {
        
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
      //moveWithLevel: function() { return true; },
      //stopAtDestination: function() { return true; },
      permState: insp.allArr('permState', (i, arr) => Object.assign({}, ...arr)),
      normState: insp.allArr('normState', (i, arr) => Object.assign({}, ...arr)),
      updateAndGetResult: function(entity, updData) {
        
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
          birth.gain(Array.fill(Insp.numBullets, () => DirectedBullet({
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
    let Level = U.inspire({ name: 'Level', methods: (insp, Insp) => ({
      
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
      
      init: function({ name, flyHut, level, momentsDef, ...args }) {
        this.name = name;
        this.flyHut = flyHut;
        this.level = level;
        this.momentsDef = [ ...momentsDef ];
        this.currentMoment = null;
        this.resolveTimeout = null; // Gets set upon win or loss
      },
      getLevelMinY: function() { return this.level.val.y - (this.level.val.h || 1000) * 0.5; },
      getLevelMaxY: function() { return this.level.val.y + (this.level.val.h || 1000) * 0.5; },
      update: function(ms, spf) {
        
        let level = this.level;
        //let entitiesSet = level.relNozz('fly.entity').set;
        let entities = [ ...level.relNozz('fly.entity').set ]; // A snapshot
        let levelPlayers = level.relNozz('fly.levelPlayer').set;
        
        let bounds = Level.getLevelBounds(level);
        let updateData = {
          entities: entities.toObj(rec => [ rec.uid, rec ]), ms, spf,
          aheadSpd: level.val.aheadSpd, aheadDist: level.val.y,
          victory: level.victory, bounds
        };
        
        let didLose = false;
        
        // Step 1: Update all Entities (tracking collidables and births)
        let collideTeams = {};
        let tickBirth = [];
        for (let entity of entities) { if (!entity.rep) continue;
          
          let rep = entity.rep;
          
          // Allow the Model to update
          let updateResult = rep.updateAndGetResult(entity, updateData);
          
          // Manage sprite visibility
          let visible = geom.doCollideRect(bounds.total, geom.containingRect(updateResult));
          if (visible && !entity.sprite) {
            entity.sprite = this.flyHut.createRec('fly.sprite', [ level, entity ], rep.fluxState());
          } else if (!visible && entity.sprite) {
            entity.sprite.dry();
            entity.sprite = null;
          }
          
          // Track this Model
          if (rep.canCollide(ms)) {
            let team = rep.getTeam();
            if (!collideTeams.has(team)) collideTeams[team] = [];
            collideTeams[team].push({ entity, rep, ...updateResult });
          }
          
          // Track new Models which resulted from this Model's update
          tickBirth.gain(updateResult.has('birth') ? updateResult.birth : []);
          
        }
        
        // Step 2: Collide all Teams against each together
        collideTeams = collideTeams.toArr(v => v);
        let len = collideTeams.length;
        for (let i = 0; i < len - 1; i++) { for (let j = i + 1; j < len; j++) {
          
          let team1 = collideTeams[i]; let team2 = collideTeams[j];
          
          for (let colEnt1 of team1) { for (let colEnt2 of team2) {
            
            let mod1 = colEnt1.rep;
            let mod2 = colEnt2.rep;
            
            // Skip collisions involving dead Models
            if (!mod1.isAlive(updateData) || !mod2.isAlive(updateData)) continue;
            
            if (geom.doCollide(colEnt1, colEnt2)) { mod1.collide(mod2, updateData); mod2.collide(mod1, updateData); }
            
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
            
          }}
          
        }}
        
        // Step 3: Check deaths and update "fly.entity" Records
        for (let entity of entities) { if (!entity.rep) continue;
          
          let rep = entity.rep;
          
          // Handle Models which just died
          let isAlive = rep.isAlive(updateData);
          let isAce = U.isInspiredBy(rep, Ace);
          
          // Non-Aces are trivial to handle
          if (!isAlive && !isAce) { entity.dry(); }
          
          // Aces have a more complex way of dying
          if (!isAlive && isAce) {
            
            // Dry the fly.sprite Record if one exists
            if (entity.sprite) { entity.sprite.dry(); entity.sprite = null; }
            
            // Increment death score
            entity.rep.scoreDeath++;
            
            // Keep track of the old Rep (to carry over stats)
            entity.deadRep = entity.rep;
            
            // Clear the old Model reference
            entity.rep = null;
            
            // Try to respawn (if enough lives are available)
            if (level.val.lives > 0) {
              level.modVal(v => (v.lives--, v));
              setTimeout(() => {
                
                let { player: pb, total: tb } = Level.getLevelBounds(level);
                let AceCls = entity.deadRep.constructor;
                
                let { name, initDist, scoreDamage, scoreDeath } = entity.deadRep;
                entity.deadRep = null;
                
                let x = pb.x + (Math.random() - 0.5) * 2 * 100 - tb.x;
                let y = (pb.y - tb.y) + pb.h * -0.2;
                entity.rep = AceCls({ ms: level.val.ms, name, x, y });
                entity.rep.uid = entity.uid;
                entity.rep.scoreDamage = scoreDamage;
                entity.rep.scoreDeath = scoreDeath;
                
              }, Ace.respawnMs);
            } else {
              // Losing a life when all are already gone causes a Loss
              didLose = true;
            }
            
          }
          
          // All deaths may have births, and short-circuit this stage
          if (!isAlive) { tickBirth.gain(rep.dieAndGetResult(updateData).birth); continue; }
          
          // Update the sprite if it exists and flux has new values
          let sprite = entity.sprite;
          if (sprite) {
            let fluxState = rep.fluxState();
            if (fluxState.find((v, k) => v !== sprite.val[k])) sprite.modVal(v => v.gain(fluxState));
          }
          
          // Update the entity if norm has new values
          let normState = rep.normState();
          if (normState.find((v, k) => v !== entity.val[k])) entity.modVal(v => v.gain(normState));
          
        }
        
        // Step 4: Check for initial loss frame (`!this.resolveTimeout`)
        if (didLose && !this.resolveTimeout) {
          
          // Update LevelPlayers with the stats from their Models
          for (let gp of levelPlayers) {
            for (let gpe of gp.relNozz('fly.levelPlayerEntity').set) {
              let ent = gpe.mems['fly.entity'];
              let rep = ent.rep || ent.deadRep || { scoreDamage: '?', scoreDeath: '?' };
              if (rep.isAlive(updateData)) rep.hp = 0; // Kill remaining Aces
              gp.mems['fly.player'].modVal(v => (v.score = rep.scoreDamage, v.deaths = rep.scoreDeath, v));
            }
          }
          
          this.resolveTimeout = setTimeout(() => level.dry(), 2500);
          
        }
        
        // Step 6: Advance as many Moments as possible (some may instantly cease standing)
        while ((!this.currentMoment || !this.currentMoment.isStanding(updateData)) && this.momentsDef.length) {
          
          let nextMomentDef = this.momentsDef.shift() || null;
          
          console.log(`Began new moment: ${nextMomentDef.name} (${nextMomentDef.type})`);
          
          let prevMoment = this.currentMoment;
          let MomentCls = mdlClasses[nextMomentDef.type];
          this.currentMoment = MomentCls({ ms, ...nextMomentDef });
          
          // Apply level effects; recalculate bounds!
          this.currentMoment.applyLevelEffects(level);
          bounds.gain(Level.getLevelBounds(level)); // Update instead of replacing `bounds` to preserve `updateData`
          
          // Now setup considering the new level bounds
          let { birth=[] } = this.currentMoment.setupAndGetResult(prevMoment, updateData);
          tickBirth.gain([ this.currentMoment, ...birth ]);
          
        }
        
        // Step 7: Check victory condition; no Moments remaining
        let canWin = true;
        if (canWin && (!this.currentMoment || !this.currentMoment.isStanding(updateData)) && !this.resolveTimeout) {
          
          // Mark that victory has occurred
          level.victory = true;
          
          // Set up a Moment to fill in terrain as the victory occurs
          let prevMoment = this.currentMoment;
          this.currentMoment = MomentAhead({
            name: 'victory', terrain: prevMoment && prevMoment.terrain, distance: 10000,
            spd: (prevMoment ? prevMoment.spd : 100) * 2,
            modelsDef: []
          });
          this.currentMoment.applyLevelEffects(level);
          bounds.gain(Level.getLevelBounds(level));
          let { birth=[] } = this.currentMoment.setupAndGetResult(prevMoment, updateData);
          tickBirth.gain([ this.currentMoment, ...birth ]);
          
          this.resolveTimeout = setTimeout(() => {
            // Transfer Model stats to fly.player Records
            for (let gp of levelPlayers) {
              for (let gpe of gp.relNozz('fly.levelPlayerEntity').set) {
                let ent = gpe.mems['fly.entity'];
                let rep = ent.rep || ent.deadRep || { scoreDamage: 0, scoreDeath: 0 };
                gp.mems['fly.player'].modVal(v => (v.score = rep.scoreDamage, v.deaths = rep.scoreDeath, v));
              }
            }
            
            // Update the Lobby taking this win into account
            level.mems['fly.lobby'].modVal(v => {
              v.level.dispName = `COMPLETE`;
              v.level.dispDesc = levels[v.level.name].winText;
              return v;
            });
            
            // Dry the fly.level Record
            level.dry();
          }, 3000);
          
        }
        
        // Step 8: Create an Entity for each birth this tick
        for (let newRep of tickBirth) {
          let entity = this.flyHut.createRec('fly.entity', [ level ], { ...newRep.permState(), ...newRep.normState() });
          entity.rep = newRep;
          entity.rep.uid = entity.uid;
        }
        
        // Step 9: Do global updates; e.g., the Level advances
        level.modVal(v => (v.ms = ms, v.y += v.aheadSpd * spf, v));
        
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
      
      init: function({ name, modelsDef, terrain=null, bounds=null, aheadSpd=100, visiMult=null }) {
        this.name = name;
        this.modelsDef = modelsDef;
        this.terrain = terrain;
        
        // Total bounds are always horizontally centered and shifted
        // vertically relative to the aheadDist
        this.bounds = bounds;
        this.aheadSpd = aheadSpd;
        this.visiMult = visiMult;
      },
      getMinY: C.noFn('getMinY'),
      getMaxY: C.noFn('getMaxY'),
      canCollide: function() { return false; },
      permState: function() { return { ...insp.Entity.permState.call(this), terrain: this.terrain };},
      normState: function() { return { ...insp.Entity.normState.call(this), minY: this.getMinY(), maxY: this.getMaxY() };},
      calcState: function() { return {}; },
      applyLevelEffects: function(level) {
        
        // TODO: Really should transition from previous bounds to new
        // ones. Right now the Ace could be sitting in some previous
        // Moment, when the new one shows its first lowest pixels. That
        // means that the Ace immediately snaps into the new bounds -
        // very janky!
        
        if (this.bounds) {
          let { total, player } = this.bounds;
          level.modVal(v => v.gain({
            tw: total.w, th: total.h,
            px: player.x, py: player.y, pw: player.w, ph: player.h,
          }));
        }
        
        if (this.aheadSpd !== null) level.modVal(v => v.gain({ aheadSpd: this.aheadSpd }));
        if (this.visiMult !== null) level.modVal(v => v.gain({ visiMult: this.visiMult }));
        
      },
      setupAndGetResult: function(prevMoment, { ms, aheadDist }) {
        return { birth: this.modelsDef.map(({ type, ...modelDef }) => {
          let ModelCls = mdlClasses[type];
          if (!ModelCls) throw Error(`Invalid type: "${type}"`);
          return ModelCls({ ms, relDist: this.getMinY(), aheadDist, ...modelDef });
        })};
      },
      updateAndGetResult: function(entity, updData) {
        let { bounds: { total } } = updData;
        let minY = this.getMinY();
        let maxY = this.getMaxY();
        return { form: 'rect', x: 0, y: (minY + maxY) * 0.5, w: total.w, h: maxY - minY, birth: [] };
      },
      isStanding: C.noFn('isStanding'),
      isAlive: C.noFn('isAlive')
      
    })});
    let MomentAhead = U.inspire({ name: 'MomentAhead', insps: { Moment }, methods: (insp, Insp) => ({
      
      $render: Insp.parents.Moment.render,
      $renderPriority: Insp.parents.Moment.renderPriority,
      
      init: function({ distance, ...args }) {
        
        insp.Moment.init.call(this, args);
        this.distance = distance;
        this.minY = null; this.maxY = null;
        
      },
      getMinY: function() { return this.minY; },
      getMaxY: function() { return this.maxY; },
      setupAndGetResult: function(prevMoment, updData) {
        // TODO: Treats all Moment classes  like they define `this.maxY`
        this.minY = prevMoment ? prevMoment.maxY : updData.bounds.total.b;
        this.maxY = this.minY + this.distance;
        return insp.Moment.setupAndGetResult.call(this, prevMoment, updData);
      },
      updateAndGetResult: function(entity, updData) {
        return insp.Moment.updateAndGetResult.call(this, entity, updData);
      },
      isStanding: function(updData) {
        // A MomentAhead stands while its top hasn't become visible
        return this.maxY > updData.bounds.total.t;
      },
      isAlive: function(updData) {
        // A MomentAhead lives while its top hasn't been passed entirely
        // TODO: Keep MomentAhead instances alive for an additional 500
        // units??
        return (this.maxY + 500) > updData.bounds.total.b;
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
    mdlClasses.gain({ SimpleBullet, DirectedBullet });
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
      
      flyHut.addTypeClsFn('fly.entity', val => {
        return record.Rec;
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
              if (momentName) {
                let levelDef = levels[levelName];
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
                    distance: firstMoment.bounds.total.h, spd: 200,
                    bounds: firstMoment.bounds,
                    modelsDef: []
                  },
                  { name: 'testTrn', type: 'MomentAhead', terrain: 'plainsToMeadow',
                    distance: 250, spd: 200,
                    bounds: firstMoment.bounds,
                    modelsDef: []
                  }
                ];
                levelDef.moments = [ ...testMoments, ...levelDef.moments.slice(ind) ];
              }
              
              testLobby = flyHut.createRec('fly.lobby', [ fly ], { 
                id: 'TEST', allReadyMs: null,
                level: getLevelData(levelName)
              });
              testLevel = flyHut.createRec('fly.level', [ fly, testLobby ], {
                
                ms: foundation.getMs(), lives: testing.lives, aheadSpd: 0, level: levelName,
                x: 0, y: 0,
                
                // Total dimensions
                tw: 200, th: 200,
                
                // Player dimensions
                px: 0, py: 0, pw: 200, ph: 200,
                
                // See a percentage of the total dimensions visible
                visiMult: 1
                
              });
              testLevel.victory = false;
              
            }
            
            player.modVal(v => (v.name = 'testy', v));
            let lobbyPlayer = flyHut.createRec('fly.lobbyPlayer', [ testLobby, player ], { model: null });
            let levelPlayer = flyHut.createRec('fly.levelPlayer', [ testLevel, player ], { deaths: 0, damage: 0 });
            
            let ms = foundation.getMs();
            let rep = mdlClasses[testing.ace]({ ms, name: 'testy' });
            rep.y = testLevel.val.y;
            let entity = flyHut.createRec('fly.entity', [ testLevel ], { ...rep.permState(), ...rep.normState() });
            entity.controls = [ 'l', 'r', 'd', 'u', 'a1', 'a2' ].toObj(k => [ k, [ 0, ms ] ]);
            entity.rep = rep;
            entity.deadRep = null;
            entity.rep.uid = entity.uid;
            
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
              let levelDims = flyHut.createRec('fly.levelDims', [], {
                
              });
              let level = flyHut.createRec('fly.level', [ fly, lobby ], {
                
                ms: foundation.getMs(), lives: 7, aheadSpd: 0, level: lobby.val.level.name,
                x: 0, y: 0,
                
                // Total dimensions
                tw: 200, th: 200,
                
                // Player dimensions
                px: 0, py: 0, pw: 200, ph: 200,
                
                // See a percentage of the total dimensions visible
                visiMult: 1
                
              });
              level.victory = false;
              
              let ms = foundation.getMs();
              let lobbyPlayers = lobby.relNozz('fly.lobbyPlayer').set;
              for (let lobbyPlayer of lobbyPlayers) {
                let player = lobbyPlayer.mems['fly.player'];
                let levelPlayer = flyHut.createRec('fly.levelPlayer', [ level, player ], { deaths: 0, damage: 0 });
                
                let { model } = lobbyPlayer.val;
                let rep = lobbyModelOptions[model].Cls({
                  ms, name: player.val.name,
                  x: Math.round(Math.random() * 200 - 100), y: -200
                });
                
                let entity = flyHut.createRec('fly.entity', [ level ], { ...rep.permState(), ...rep.normState() });
                entity.controls = [ 'l', 'r', 'd', 'u', 'a1', 'a2' ].toObj(k => [ k, [ 0, ms ] ]);
                entity.rep = rep;
                entity.deadRep = null;
                entity.rep.uid = entity.uid;
                
                flyHut.createRec('fly.levelPlayerEntity', [ levelPlayer, entity ]);
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
                
                // TODO: Maintain a history of keypresses? Finally,
                // convert Aces to use continuous updating
                // console.log('CONTROLS:', entity.controls);
                
              }));
              
            });
          
          });
          
        })});
        
        // Level
        dep.scp(fly, 'fly.level', (level, dep) => {
          
          let levelDef = levels[level.val.level];
          
          let spf = 1 / fps;  // Seconds per server-side tick
          //let level = flyHut.createRec('fly.entity', [ level ], {
          //  type: 'Level',
          //  name: level.val.level,
          //  momentsDef: levelDef.moments
          //});
          
          let levelRep = Level({ flyHut, level, name: level.val.level, momentsDef: levelDef.moments });
          let interval = setInterval(() => levelRep.update(foundation.getMs(), spf), spf * 1000);
          dep(Drop(null, () => clearInterval(interval)));
          
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
            let myEntity = gpe.mems['fly.entity'];
            let entities = level.relNozz('fly.entity').set;
            let sprites = level.relNozz('fly.sprite').set;
            
            let levelContainerReal = dep(mainReal.addReal('fly.level'));
            let lInfoReal = levelContainerReal.addReal('fly.levelLInfo');
            let rInfoReal = levelContainerReal.addReal('fly.levelRInfo');
            
            let dispLivesReal = lInfoReal.addReal('fly.levelDispLives');
            dep(level.route(({ lives }) => dispLivesReal.setText(`[${lives}]`)));
            
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
            let lastMs = [ null, null ];
            let doDraw = () => draw.initFrameCen('rgba(220, 220, 255, 1)', () => {
              
              let updData = {
                ...level.val.slice({ ms: 'ms', aheadDist: 'y' }),
                entities: entities.toArr(r => r).toObj(r => [ r.uid, r ])
              };
              let ms = level.val.ms;
              if (ms === lastMs[0]) {
                
                // Render before update; compensate for silky smoothness
                let msExtra = foundation.getMs() - lastMs[1];
                ms = lastMs[0] + msExtra;
                
                // Extrapolate aheadDist
                updData.aheadDist += level.val.aheadSpd * msExtra * 0.001;
                
              } else {
                
                // Remember the timing of this latest frame
                lastMs = [ ms, foundation.getMs() ];
                
              }
              
              let [ mySprite=null ] = myEntity.relNozz('fly.sprite').set;
              
              let bounds = Level.getLevelBounds(level);
              let { total: tb, player: pb } = bounds;
              let visiMult = Math.min(tb.w / pixelDims.w, tb.h / pixelDims.h) * level.val.visiMult;
              let desiredTrn = { x: 0, y: 0 };
              let scaleAmt = 1 / visiMult;
              
              if (mySprite) {
                
                let { x, y } = mySprite.val;
                
                // Percentage of horz/vert distance travelled
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
                
                // desiredTrn = {
                //   x: ((x - pb.x) / (pb.w * 0.5)) * (tb.w * 0.5 - pixelDims.hw * visiMult),
                //   y: ((y - pb.y) / (pb.h * 0.5)) * (tb.h * 0.5 - pixelDims.hh * visiMult) 
                // };
                
              } else {
                
                bounds.visible = bounds.total;
                
              }
              
              // TODO: Don't follow Ace upon victory!!
              draw.scl(scaleAmt, scaleAmt);
              draw.trn(0, -updData.aheadDist); // TODO: HEEERE! Because Aces are discontinuous, they're very jittery when smoothing is applied
              draw.trn(-fadeXPanVal.to(desiredTrn.x), -fadeYPanVal.to(desiredTrn.y));
              
              let renders = [];
              for (let sprite of sprites) {
                let entity = sprite.mems['fly.entity'];
                let renderVals = { ...entity.val, ...sprite.val };
                let Cls = mdlClasses[entity.val.type];
                
                if (!Cls) { console.log(entity.val); throw Error(`Bad type: ${entity.val.type}`); }
                
                renders.push({
                  uid: entity.uid,
                  priority: Cls.renderPriority ? Cls.renderPriority(renderVals) : 0.5,
                  render: [ Cls, renderVals, entity ]
                });
              }
              
              renders = renders.sort((v1, v2) => v2.priority - v1.priority);
              for (let { render: [ Cls, vals, entity ] } of renders) {
                let calcVals = Cls.prototype.calcState.call(vals, updData);
                Cls.render(draw, updData, { entity, myEntity, bounds, ...vals, ...calcVals }, entities);
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
