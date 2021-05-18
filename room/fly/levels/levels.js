global.rooms['fly.levels'] = async foundation => {
  
  let paragraph = str => str.split('\n').map(v => v.trim() || C.skip).join(' ');
  return {
    rustlingMeadow: { num: 0, name: 'Rustling Meadow', password: '',
      desc: paragraph(`
        Soft grass underfoot. Joust Man watches over his fellow Aces. Gun Girl lies back,
        absorbing sun, Slam Kid devours his sandwich, and a gust of wind tousles Salvo Lad's mane
        of hair. There is nothing like a picnic with the gang. Suddenly all four perk up. A
        whining reaches their ears, far off and tiny, like the buzz of wasp wings. "Back in your
        ships!" blares Joust Man. His eyes narrow as he turns from the sunlit field to his
        death-delivering fighter jet. Wasps bring stingers. A grim thought runs through his mind:
        "It Is Happening Again."
      `),
      winText: paragraph(`
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
      desc: paragraph(`
        Suddenly Slam Kid comes in over the comms: "More Bogies on the horizon!" Gun Girl's voice
        jumps into the fray: "Do we find a route around them or ready our engines for another
        round?" Salvo Lad scans the landscape intently as Joust Man barks: "If we don't go
        straight through them we'll never get to Stalbureaux in time!" Joust Man's eyes narrow as
        he looks up from his wristwatch, a gift from his father. Time is of the essence.
      `),
      winText: paragraph(`
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
            
            { type: 'Furler', x: -120, y: +240, spd: -110, delayMs: 3700, swingHz: 0.1, swingAmt: -100, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            { type: 'Furler', x:  -20, y: +240, spd: -110, delayMs: 3700, swingHz: 0.1, swingAmt: +100, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            
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
            
            { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            
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
            
            { type: 'Furler', x: -50, y: +400, spd: -30, swingHz: 0.079, swingAmt: +130, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            { type: 'Furler', x: +50, y: +400, spd: -30, swingHz: 0.079, swingAmt: -130, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            
            { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            
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
            
            
            { type: 'Furler', x: -150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            { type: 'Weaver', x: -100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  -50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:    0, y: +430, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x:  +50, y: +420, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Weaver', x: +100, y: +410, spd: -60, swingHz: 0, swingAmt: 0 },
            { type: 'Furler', x: +150, y: +400, spd: -60, swingHz: 0, swingAmt: 0, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
            
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
            
            { type: 'Furler', x: 0, y: +900, spd: -90, delayMs: 1500, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, shootProps: { vel: 300, lsMs: 6000 } },
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
            
            { type: 'Drifter', x: 0, y: +300, tx: 0, ty: -1, vel: 50, hp: 2, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
            { type: 'Furler', x: 0, y: +900, spd: -90, delayMs: 1200, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, shootProps: { vel: 300, lsMs: 6000 } }
          ]
        },
        { name: 'snake3', type: 'MomentAhead', terrain: 'plains', dist: 2000, aheadSpd: 100,
          models: [
            
            { type: 'Drifter', x: -150, y: +100, tx: 0, ty: -1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
            { type: 'Drifter', x:  -50, y: +100, tx: 0, ty: -1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
            { type: 'Drifter', x:  +50, y: +100, tx: 0, ty: -1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
            { type: 'Drifter', x: +150, y: +100, tx: 0, ty: -1, vel: 50, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
            
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
            
            { type: 'Furler', x: 0, y: +1100, spd: -90, delayMs: 1500, swingHz: 0.110, swingAmt: +195, shootDelayMs: 1400, shootProps: { vel: 300, lsMs: 6000 } }
            
          ]
        }
      ]
    },
    imposingFields: { num: 2, name: 'Imposing Fields', password: 'RE1NF0rCEMENTS',
      desc: paragraph(`
        Joust Man checks his wristwatch again. Shapes loom over the horizon, a fleet ready to
        test the Aces once more. Joust Man's eyes narrow as his squad whoops and shouts battle
        cries. A shape looms towards the back of the fleet, much bigger than the others. "Let's
        do this", Joust Man thinks, charging up his laser beam.
      `),
      winText: paragraph(`
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
        { name: 'drifter1', type: 'MomentAhead', terrain: 'meadow', dist: 500, aheadSpd: 100, models: [
          { type: 'Winder',  x: -60, y: 50, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x:   0, y: 30, vel: 50, tx: 0, ty: -1, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x: +60, y: 50, spd: -50, swingAmt: 0 }
        ]},
        { name: 'drifter2', type: 'MomentAhead', terrain: 'meadow', dist: 750, aheadSpd: 100, models: [
          { type: 'Winder',  x: -60, y: 50, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x:   0, y: 30, vel: 50, tx: 0, ty: -1, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x: +60, y: 50, spd: -50, swingAmt: 0 },
          
          { type: 'Winder', x: -500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.1, swingAmt: +450 },
          { type: 'Winder', x: +500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.1, swingAmt: -450 }
        ]},
        { name: 'drifter3', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100, models: [
          { type: 'Winder',  x: -60, y: +50, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x:   0, y: +30, vel: 50,tx: 0, ty: -1, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x: +60, y: +50, spd: -50, swingAmt: 0 },
          
          { type: 'Winder',  x: -200, y: +130, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x: -140, y: +110, vel: 50, tx: 0, ty: -1, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x:  -80, y: +130, spd: -50, swingAmt: 0 },
          
          { type: 'Winder',  x: +200, y: +130, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x: +140, y: +110, vel: 50, tx: 0, ty: -1, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x:  +80, y: +130, spd: -50, swingAmt: 0 },
          
          { type: 'Winder', x: -500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.07, swingAmt: +450 },
          { type: 'Winder', x: -500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.08, swingAmt: +450 },
          { type: 'Winder', x: +500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.08, swingAmt: -450 },
          { type: 'Winder', x: +500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.07, swingAmt: -450 }
        ]},
        { name: 'drifter4', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100, models: [
          
          { type: 'Weaver',  x: -60, y: +50, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x:   0, y: +30, vel: 50, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Weaver',  x: +60, y: +50, spd: -50, swingAmt: 0 },
          
          { type: 'Winder',  x: -200, y: +130, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x: -140, y: +110, vel: 50, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x:  -80, y: +130, spd: -50, swingAmt: 0 },
          
          { type: 'Winder',  x: +200, y: +130, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x: +140, y: +110, vel: 50, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Winder',  x:  +80, y: +130, spd: -50, swingAmt: 0 },
          
          { type: 'Winder', x: -500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.07, swingAmt: +450 },
          { type: 'Winder', x: -500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.08, swingAmt: +450 },
          { type: 'Winder', x: +500, y: +700, spd: -166, delayMs: 5000, swingHz: 0.08, swingAmt: -450 },
          { type: 'Winder', x: +500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.07, swingAmt: -450 }
          
        ]},
        { name: 'drifter5', type: 'MomentAhead', terrain: 'meadow', dist: 1000, aheadSpd: 100, models: [
          
          { type: 'Furler',  x: -140, y: +70, spd: -50, swingAmt: 0, shootDelayMs: 1500, shootProps: { vel: 300, lsMs: 3000 } },
          { type: 'Weaver',  x:  -70, y: +50, spd: -50, swingAmt: 0 },
          { type: 'Drifter', x:    0, y: +30, vel:  50, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Weaver',  x:  +70, y: +50, spd: -50, swingAmt: 0 },
          { type: 'Furler',  x: +140, y: +70, spd: -50, swingAmt: 0, shootDelayMs: 1500, shootProps: { vel: 300, lsMs: 3000 } },
          
          { type: 'Winder', x: -500, y: +850, spd: -166, delayMs: 5000, swingHz: 0.065, swingAmt: +450 },
          { type: 'Winder', x: -500, y: +800, spd: -166, delayMs: 5000, swingHz: 0.070, swingAmt: +450 },
          { type: 'Winder', x: -500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.080, swingAmt: +450 },
          { type: 'Winder', x: +500, y: +750, spd: -166, delayMs: 5000, swingHz: 0.080, swingAmt: -450 },
          { type: 'Winder', x: +500, y: +800, spd: -166, delayMs: 5000, swingHz: 0.070, swingAmt: -450 },
          { type: 'Winder', x: +500, y: +850, spd: -166, delayMs: 5000, swingHz: 0.065, swingAmt: -450 }
          
        ]},
        { name: 'wall1', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.05, swingAmt: 200, shootDelayMs: 1200, shootProps: { vel: 300, lsMs: 3000 } },
          
          { type: 'Drifter', x: -200, y: +50, vel: 48, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -120, y: +50, vel: 44, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  -40, y: +50, vel: 40, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  +40, y: +50, vel: 40, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +120, y: +50, vel: 44, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +200, y: +50, vel: 48, ang: 0.5, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 }
          
        ]},
        { name: 'wall2', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: 200, shootDelayMs: 1000, shootProps: { vel: 300, lsMs: 3000 } },
          
          { type: 'Drifter', x: -200, y: +50, vel: 48, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -120, y: +50, vel: 44, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  -40, y: +50, vel: 40, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  +40, y: +50, vel: 40, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +120, y: +50, vel: 44, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +200, y: +50, vel: 48, ang: 0.5, hp: 5, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          
          { type: 'Winder', x: -150, y: -600, spd: +15, swingAmt: 0 },
          { type: 'Winder', x:    0, y: -600, spd: +15, swingAmt: 0 },
          { type: 'Winder', x: +150, y: -600, spd: +15, swingAmt: 0 }
          
        ]},
        { name: 'wall3', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: +200, shootDelayMs: 800, shootProps: { vel: 300, lsMs: 3000 } },
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: -200, shootDelayMs: 800, shootProps: { vel: 300, lsMs: 3000 } },
          
          { type: 'Drifter', x: -200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  -40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  +40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          
          { type: 'Winder', x: -100, y: -600, spd: +15, swingAmt: -100, swingHz: 0.05 },
          { type: 'Winder', x:    0, y: -600, spd: +15, swingAmt:  100, swingHz: 0.00 },
          { type: 'Winder', x: +100, y: -600, spd: +15, swingAmt: +100, swingHz: 0.05 }
          
        ]},
        { name: 'wall4', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: +200, shootDelayMs: 800, shootProps: { vel: 300, lsMs: 3000 } },
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: -200, shootDelayMs: 800, shootProps: { vel: 300, lsMs: 3000 } },
          
          { type: 'Drifter', x: -200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  -40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  +40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          
          { type: 'Winder', x: -100, y: -600, spd: +15, swingAmt: -100, swingHz: 0.12 },
          { type: 'Winder', x:    0, y: -600, spd: +15, swingAmt:  100, swingHz: 0.00 },
          { type: 'Winder', x: +100, y: -600, spd: +15, swingAmt: +100, swingHz: 0.12 }
          
        ]},
        { name: 'wall5', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Drifter', x: -200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  -40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x:  +40, y: +50, vel: 40, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +120, y: +50, vel: 44, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +200, y: +50, vel: 48, ang: 0.5, hp: 6, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: +200, shootDelayMs: 700, shootProps: { vel: 300, lsMs: 3000 } },
          { type: 'Furler', x: 0, y: +100, spd: -40, swingHz: 0.08, swingAmt: -200, shootDelayMs: 700, shootProps: { vel: 300, lsMs: 3000 } }
          
        ]},
        { name: 'crush1', type: 'MomentAhead', terrain: 'meadow', dist: 1500, aheadSpd: 100, models: [
          
          { type: 'Drifter', x: -300, y: -50, vel: 120, ang: 0.5 - 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -300, y: -50, vel:  80, ang: 0.5 - 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: -300, y: -50, vel:  40, ang: 0.5 - 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          
          { type: 'Drifter', x: +300, y: -50, vel: 120, ang: 0.5 + 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +300, y: -50, vel:  80, ang: 0.5 + 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 },
          { type: 'Drifter', x: +300, y: -50, vel:  40, ang: 0.5 + 0.125, hp: 4, hpPerSec: 1.33, minSize: 16, sizeMult: 2 }
          
        ]},
        { name: 'final', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100, models: [
          { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: -100 },
          { type: 'Winder', x: 0, y: +100, spd: -50, swingHz: 0.02, swingAmt: +100 }
        ]}
      ]
    },
    killPlains: { num: 1, name: 'Kill Plains', password: 'R4CIN6',
      desc: paragraph(``),
      winText: paragraph(``),
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
            { type: 'Furler', x: -120, y: +200, spd: -50, swingHz: 0.1, swingAmt: -80, shootDelayMs: 1500, shootProps: { vel: 300 } },
            { type: 'Furler', x: +120, y: +200, spd: -50, swingHz: 0.1, swingAmt: +80, shootDelayMs: 1500, shootProps: { vel: 300 } }
          ]
        },
        { name: 'bozz', type: 'MomentAhead', terrain: 'plains', dist: 8000, aheadSpd: 100,
          bounds: { total: { w: 800, h: 1000 }, player: { x: 0, y: -150, w: 800, h: 700 } },
          models: [
            
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.06, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 4000, shootProps: { vel: 300, lsMs: 10000 } },
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.07, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 3500, shootProps: { vel: 300, lsMs: 10000 } },
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.08, swingAmt: -380, shootDelayMs: 1200, shootDelayInitMs: 3000, shootProps: { vel: 300, lsMs: 10000 } },
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.08, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 3000, shootProps: { vel: 300, lsMs: 10000 } },
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.07, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 3500, shootProps: { vel: 300, lsMs: 10000 } },
            { type: 'Furler', x: 0, y: +120, spd: -3, swingHz: 0.06, swingAmt: +380, shootDelayMs: 1200, shootDelayInitMs: 4000, shootProps: { vel: 300, lsMs: 10000 } },
            
            { type: 'WinderMom', x: -600, y: +500, tx: -250, ty: +280, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } },
            { type: 'WinderMom', x:    0, y: +500, tx:    0, ty: +320, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } },
            { type: 'WinderMom', x: +600, y: +500, tx: +250, ty: +280, spd: 50, spawnMs: 1800, spawnArgs: { spd: -60 } }
            
          ]
        },
        
        { name: 'final', type: 'MomentAhead', terrain: 'plains', dist: 1000, aheadSpd: 100, models: [] }
        
      ]
    }
  };
  
};
