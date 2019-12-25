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
    let { Rec, RecScope } = record;
    let { Lands } = hinterlands;
    
    // Config values
    let open = async () => {
      
      let [ host, httpPort, soktPort ] = foundation.raiseArgs.has('hutHosting')
        ? foundation.raiseArgs.hutHosting.split(':')
        : [ 'localhost', '', '' ];
      
      let useSsl = foundation.raiseArgs.has('ssl') && !!foundation.raiseArgs.ssl;
      let serverArgs = { keyPair: null, selfSign: null };
      if (useSsl) {
        /// {ABOVE=
        let { cert, key, selfSign } = await Promise.allObj({
          cert:     foundation.getSaved([ 'mill', 'cert', 'server.cert' ]).getContent(),
          key:      foundation.getSaved([ 'mill', 'cert', 'server.key' ]).getContent(),
          selfSign: foundation.getSaved([ 'mill', 'cert', 'localhost.cert' ]).getContent()
        });
        serverArgs = { keyPair: { cert, key }, selfSign };
        /// =ABOVE} {BELOW=
        serverArgs = { keyPair: true, selfSign: true };
        /// =BELOW}
      }
      
      let lands = U.lands = Lands({ heartbeatMs: 10 * 1000 });
      lands.cpuPool.dbgEnabled = false;
      lands.makeServers.push(pool => foundation.makeHttpServer(pool, { host, port: parseInt(httpPort), ...serverArgs }));
      lands.makeServers.push(pool => foundation.makeSoktServer(pool, { host, port: parseInt(soktPort), ...serverArgs }));
      
      /// {ABOVE=
      lands.setRealRooms([ realDom ]);
      chance = chance.Chance();
      let updCnt = 0;
      let tag = lands.createRec('tag.tag', [], { cnt: U.base62(0).padHead(8, '0') });
      let archTag = lands.createRec('tag.archTag', [ lands.arch, tag ]);
      /// =ABOVE}
      
      let arenaRadius = 400;
      let playersForChaser = 5;
      let typeAttrs = {
        chaser: {
          spd: 4,
          radius: 5,
          fillColour: 'rgba(255, 255, 255, 1)',
          bordColour: null
        },
        transforming: {
          spd: 12,
          radius: 3,
          fillColour: 'rgba(255, 100, 100, 1)',
          bordColour: null
        },
        runner: {
          spd: 7,
          radius: 8,
          fillColour: 'rgba(255, 200, 200, 1)',
          bordColour: 'rgba(200, 0, 0, 1)'
        }
      };
      
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText, Art } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      lands.realLayout = {
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
      
      let rootScp = RecScope(lands.arch, 'tag.archTag', (archTag, dep) => {
        
        let tag = global.tag = archTag.members['tag.tag'];
        
        /// {ABOVE=
        
        let status = lands.createRec('tag.status', [], { playerCount: 0, type: 'waiting' });
        lands.createRec('tag.tagStatus', [ tag, status ]);
        
        dep.scp(lands.arch, 'lands.archHut', (archHut, dep) => {
          
          status.modVal(v => (v.playerCount++, v));
          dep(Drop(null, () => status.modVal(v => (v.playerCount--, v))));
          
          let hut = archHut.members['lands.hut'];
          let player = dep(lands.createRec('tag.player', [], { keyVal: 0 }));
          let hutPlayer = lands.createRec('tag.hutPlayer', [ hut, player ]);
          let tagPlayer = lands.createRec('tag.tagPlayer', [ tag, player ], { term: hut.getTerm() });
          
          // Runner value is a bitmasked "controls" value - indicating
          // which controls are depressed Below
          let runner = dep(lands.createRec('tag.runner', [], { x: chance.cntuCen(50), y: chance.cntuCen(50), r: chance.cntu(Math.PI * 2) }));
          let playerRunner = lands.createRec('tag.playerRunner', [ player, runner ]);
          let tagRunner = lands.createRec('tag.tagRunner', [ tag, runner ], { term: hut.getTerm(), type: 'chaser' });
          
          dep(hut.comNozz('upd').route(({ msg }) => {
            let { keyVal } = msg;
            if (!U.isType(keyVal, Number)) return;
            player.modVal(v => (v.keyVal = keyVal, v));
          }));
          
          dep(hut.follow(archTag));
          dep.scp(tag, 'tag.tagRunner', (tagRunner, dep) => dep(hut.follow(tagRunner)));
          dep.scp(tag, 'tag.tagStatus', (tagStatus, dep) => dep(hut.follow(tagStatus)));
          
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
            for (let i = 0; i < 4; i++) keys.push((keyVal & (1 << i)) ? 1 : 0);
            
            let vx = keys[1] - keys[0];
            let vy = keys[3] - keys[2];
            
            if (vx && vy) {
              let div = 1 / Math.sqrt(vx * vx + vy * vy);
              vx *= div;
              vy *= div;
            }
            
            if (vx || vy) {
              
              let { spd, radius } = typeAttrs[tagRunner.val.type];
              
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
          
          let runnerChaserTouchDist = typeAttrs.runner.radius + typeAttrs.chaser.radius;
          let runnerChaserTouchDistSqr = runnerChaserTouchDist * runnerChaserTouchDist;
          for (let tagRunner of typeRunners.runner) { for (let tagChaser of typeRunners.chaser) {
            let runner = tagRunner.members['tag.runner'];
            let chaser = tagChaser.members['tag.runner'];
            
            let rv = runner.val;
            let cv = chaser.val;
            
            let dx = rv.x - cv.x;
            let dy = rv.y - cv.y;
            let distSqr = dx * dx + dy * dy;
            if (distSqr < runnerChaserTouchDistSqr) tagRunner.modVal(v => (v.type = 'chaser', v));
          }}
          
          let numChasers = typeRunners.chaser.length;
          if (typeRunners.runner.length === 0 && typeRunners.transforming.length === 0 && numChasers >= playersForChaser) {
            let randChaser = chance.elem(typeRunners.chaser);
            randChaser.modVal(v => (v.type = 'transforming', v));
            setTimeout(() => randChaser.modVal(v => (v.type = 'runner', v)), 5000);
          }
          
          if (hasUpdate) tag.modVal(v => (v.cnt = U.base62(++updCnt), v));
          
          if (((updCnt + 1) % 100) === 0) console.log(`Finished frame in ${foundation.getMs() - t}ms / ${Math.round(1000 / fps)}ms`);
          
        }, 1000 / fps);
        dep(Drop(null, () => clearInterval(interval)));
        
        /// =ABOVE} {BELOW=
        
        dep.scp(lands.getRootReal(), rootReal => {
          
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
              lands.tell({ command: 'upd', keyVal });
              
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
                let isShowing = type !== 'tagging';
                
                if (!isShowing && statusReal) { statusReal.dry(); statusReal = null; }
                if (isShowing && !statusReal) { statusReal = dep(mainReal.addReal('status')); }
                
                if (!isShowing) return;
                
                if (type === 'waiting') {
                  statusReal.setText(`Got ${playerCount} / ${playersForChaser} players...`);
                }
                
                statusReal.setLoc(UnitPc(0.5), UnitPc(1 / 3));
              }));
              
            });
            
          });
          
        });
        
        /// =BELOW}
        
      });
      
      await lands.open();
      
    };
    
    return { open };
    
  }
});
