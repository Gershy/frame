U.buildRoom({
  name: 'tag',
  innerRooms: [      'record', 'hinterlands', 'real', 'realDom', 'chance' ],
  build: (foundation, record,   hinterlands,   real,   realDom,   chance) => {
    
    // Powerups:
    // - Slow all chasers in proximity
    // - Knock back chasers in proximity
    // - Speed boost
    // - Decoy
    // - "Stiff-arm" / plow
    // - Oscillating invisibility
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, Scope, defDrier } = U.water;
    let { Reality } = realDom;
    let { Rec, RecScope } = record;
    let { Hut } = hinterlands;
    
    // Config values
    let open = async () => {
      
      let tagHut = await Hut.getRootHut(foundation, 'test', { heartMs: 1000 * 30 });
      
      let arenaRadius = 400;
      let playersForDasher = 5;
      let typeAttrs = {
        chaser: {
          spd: 4,
          radius: 10,
          fillColour: 'rgba(255, 255, 255, 1)',
          bordColour: null
        },
        shifter: {
          spd: 12,
          radius: 6,
          fillColour: 'rgba(255, 100, 100, 1)',
          bordColour: null
        },
        dasher: {
          spd: 7,
          radius: 14,
          fillColour: 'rgba(255, 0, 0, 1)',
          bordColour: 'rgba(200, 0, 0, 1)'
        }
      };
      
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText, Art } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      let flatLayouts = {
        'main': {
          slot: par => par.cmps.slots.insertViewPortItem(),
          decals: {
            roundness: 1,
            colour: 'rgba(100, 100, 150, 1)'
          }
        },
        'main.art': { size: Art({}) },
        'main.status': {
          size: ShowText({ origin: 'cc', pad: UnitPx(10) }),
          decals: {
            colour: 'rgba(100, 100, 200, 0.5)',
            textColour: 'rgba(255, 255, 255, 0.8)',
            textSize: UnitPx(30)
          }
        }
      };
      
      /// {ABOVE=
      let chn = chance.Chance();
      
      let reality = Reality('testyReality');
      reality.addFlatLayouts(flatLayouts);
      await reality.prepareAboveHut(tagHut);
      
      let updCnt = 0;
      let tag = tagHut.createRec('tag.tag', [ tagHut ], { cnt: U.base62(updCnt++).padHead(8, '0') });
      /// =ABOVE}
      
      let rootScp = RecScope(tagHut, 'tag.tag', (tag, dep) => {
        
        console.log('GOT tag.tag', tag);
        
        global.tag = tag;
        dep(Drop(null, () => { delete global.tag; }));
        
        /// {ABOVE=
        
        let status = tagHut.createRec('tag.status', [], { playerCount: 0, type: 'waiting' });
        tagHut.createRec('tag.tagStatus', [ tag, status ]);
        
        dep.scp(tagHut, 'lands.kidHut/par', ({ members }, dep) => {
          
          status.modVal(v => (v.playerCount++, v));
          dep(Drop(null, () => status.modVal(v => (v.playerCount--, v))));
          
          let hut = members.kid; //kidHut.members['lands.kidHut'];
          let player = dep(tagHut.createRec('tag.player', [], { keyVal: 0 }));
          let hutPlayer = tagHut.createRec('tag.hutPlayer', [ hut, player ]);
          let tagPlayer = tagHut.createRec('tag.tagPlayer', [ tag, player ], { hutId: hut.uid });
          
          // Runner value is a bitmasked "controls" value - indicating
          // which controls are depressed Below
          let runner = dep(tagHut.createRec('tag.runner', [], { x: chn.cntuCen(50), y: chn.cntuCen(50), r: chn.cntu(Math.PI * 2) }));
          let playerRunner = tagHut.createRec('tag.playerRunner', [ player, runner ]);
          let tagRunner = tagHut.createRec('tag.tagRunner', [ tag, runner ], { hutId: hut.uid, type: 'chaser' });
          
          dep(hut.roadNozz('upd').route(({ msg }) => {
            let { keyVal } = msg;
            if (!U.isType(keyVal, Number)) return;
            player.modVal(v => (v.keyVal = keyVal, v));
          }));
          
          dep(hut.followRec(tag));
          dep.scp(tag, 'tag.tagRunner', (tagRunner, dep) => dep(hut.followRec(tagRunner)));
          dep.scp(tag, 'tag.tagStatus', (tagStatus, dep) => dep(hut.followRec(tagStatus)));
          
        });
        
        let fps = 30;
        let interval = setInterval(() => {
          let t = foundation.getMs();
          let hasUpdate = false;
          let typeRunners = typeAttrs.map(v => []);
          
          for (let tagRunner of tag.relRecs('tag.tagRunner')) {
            
            let runner = tagRunner.members['tag.runner'];
            let type = tagRunner.val.type;
            
            typeRunners[type].push(tagRunner);
            
            let playerRunner = runner.relRec('tag.playerRunner');
            if (!playerRunner) continue; // TODO: Why does this happen?
            
            let player = playerRunner.members['tag.player'];
            let { keyVal } = player.val;
            
            let keys = [];
            for (let i = 0; i < 4; i++) keys.push((keyVal & (1 << i)) >> i);
            
            let vx = keys[1] - keys[0];
            let vy = keys[3] - keys[2];
            if (vx && vy) { let div = 1 / Math.sqrt(vx * vx + vy * vy); vx *= div; vy *= div; }
            
            if (vx || vy) {
              let { spd, radius } = typeAttrs[type];
              
              let nx = runner.val.x + vx * spd;
              let ny = runner.val.y + vy * spd;
              let offSqr = nx * nx + ny * ny;
              
              let arenaSubPlayer = arenaRadius - radius;
              let maxOffSqr = arenaSubPlayer * arenaSubPlayer;
              
              if (offSqr > maxOffSqr) {
                let div = Math.sqrt(maxOffSqr) / Math.sqrt(offSqr);
                nx *= div;
                ny *= div;
              }
              
              hasUpdate = true;
              runner.modVal(v => (v.x = nx, v.y = ny, v));
            }
            
          }
          
          // TODO: Assumes static radius per type
          let touchDist = typeAttrs.dasher.radius + typeAttrs.chaser.radius;
          let touchDistSqr = touchDist * touchDist;
          for (let tagDasher of typeRunners.dasher) { for (let tagChaser of typeRunners.chaser) {
            let dasher = tagDasher.members['tag.runner'];
            let chaser = tagChaser.members['tag.runner'];
            
            let dv = dasher.val;
            let cv = chaser.val;
            
            let dx = dv.x - cv.x;
            let dy = dv.y - cv.y;
            let distSqr = dx * dx + dy * dy;
            if (distSqr < touchDistSqr) tagDasher.modVal(v => (v.type = 'chaser', v));
          }}
          
          let numChasers = typeRunners.chaser.length;
          if (typeRunners.dasher.length === 0 && typeRunners.shifter.length === 0 && numChasers >= playersForDasher) {
            let randChaser = chn.elem(typeRunners.chaser);
            randChaser.modVal(v => (v.type = 'shifter', v));
            setTimeout(() => randChaser.modVal(v => (v.type = 'dasher', v)), 5000);
          }
          
          if (hasUpdate) tag.modVal(v => (v.cnt = U.base62(updCnt++), v));
          
          if (((updCnt + 1) % 100) === 0) console.log(`Finished frame in ${foundation.getMs() - t}ms / ${Math.round(1000 / fps)}ms`);
          
        }, 1000 / fps);
        dep(Drop(null, () => clearInterval(interval)));
        
        /// =ABOVE} {BELOW=
        
        dep.scp(tagHut.getRootReal(), rootReal => {
          
          let mainReal = dep(rootReal.addReal('main'));
          
          let myTagRunnerNozz = dep(TubVal(null, tag.relNozz('tag.tagRunner'), tagRunner => {
            return (tagRunner.val.term === U.hutTerm) ? tagRunner : C.skip;
          }));
          
          dep.scp(myTagRunnerNozz, (myTagRunner, dep) => {
            
            let artReal = dep(mainReal.addReal('art'));
            let { draw, keys } = artReal;
            
            let myRunner = myTagRunner.members['tag.runner'];
            
            let drawTimeout = null;
            let doDraw = () => {
              clearTimeout(drawTimeout);
              drawTimeout = setTimeout(doDraw, 1000 / 30);
              
              let { w, h, hw, hh } = draw.getDims();
              draw.rect(0, 0, w, h, { fillStyle: 'rgba(0, 0, 0, 1)' });
              draw.frame(() => {
                
                draw.trn(hw, hh); // Center of canvas and our runner are origin
                draw.scl(0.8);
                draw.trn(-myRunner.val.x, -myRunner.val.y);
                
                draw.circ(0, 0, arenaRadius + 5, {
                  fillStyle: 'rgba(127, 127, 127, 1)',
                  strokeStyle: 'rgba(255, 255, 255, 1)',
                  lineWidth: 10
                });
                
                for (let tagRunner of tag.relRecs('tag.tagRunner')) {
                  let runner = tagRunner.members['tag.runner'];
                  let { fillColour, bordColour, radius } = typeAttrs[tagRunner.val.type];
                  let { x, y } = runner.val;
                  draw.circ(x, y, radius, { fillStyle: fillColour, strokeStyle: bordColour, lineWidth: 1 });
                }
                
              });
            };
            
            dep(keys.nozz.route(keys => {
              
              let keyNums = [
                65, // l
                68, // r
                87, // u
                83  // d
              ];
              let keyVal = 0;
              for (let i = 0; i < keyNums.length; i++) keyVal += keys.has(keyNums[i]) ? (1 << i) : 0;
              
              tagHut.tell({ command: 'upd', keyVal });
              
            }));
            
            // TODO: do draw *after everything drips*! Should be
            // accomplished with what was previously titled "WobSquad";
            // for now accomplished with `foundation.queueTask`
            dep(tag.route(() => foundation.queueTask(doDraw)));
            doDraw();
            
            dep.scp(tag, 'tag.tagStatus', (tagStatus, dep) => {
              
              let status = tagStatus.members['tag.status'];
              let statusReal = null;
              
              dep(status.route(({ playerCount, type }) => {
                let isShowing = playerCount < playersForDasher;
                
                if (!isShowing && statusReal) { statusReal.dry(); statusReal = null; }
                if (isShowing && !statusReal) { statusReal = dep(mainReal.addReal('status')); }
                
                if (!isShowing) return;
                
                if (type === 'waiting') {
                  statusReal.setText(`Got ${playerCount} / ${playersForDasher} players...`);
                }
                
                statusReal.setLoc(UnitPc(0.5), UnitPc(1 / 3));
              }));
              
            });
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
    };
    
    return { open };
    
  }
});
