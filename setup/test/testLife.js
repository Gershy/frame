require('../foundationNodeJs.js');
require('../foundationBrowser.js');
let { FoundationNodejs, FoundationBrowser } = U.setup;
let { Keep } = require('./hutkeeping.js');

module.exports = async (args, foundationInsps) => {
  
  let foundation = U.foundation = FoundationNodejs();
  
  let lifeRoomForNodeJs = await Promise(resolve => foundation.raise({
    settle: 'testRecord.above',
    hut: {
      name: 'testRecord',
      innerRooms: [ 'life' ],
      build: (foundation, life) => ({ open: () => resolve(life) })
    }
  }));
  
  let { Load, FreeLoad, Flow, Sustain, Scope, Flux } = lifeRoomForNodeJs;
  
  let keep = Keep(null, 'life').contain(k => {
    
    Keep(k, 'living').contain(k => {
      
      Keep(k, 'load').contain(k => {
        
        Keep(k, 'trivialDripShut1', () => {
          
          let m = Load();
          return {
            result: U.safe(() => (m.shutFlow(), false), () => true),
            msg: 'by default no shut flow'
          };
          
        });
        
        Keep(k, 'trivialDripShut2', () => {
          
          let m = FreeLoad();
          return { result: !!m.shutFlow(), msg: 'has shut flow' }
          
        });
        
        Keep(k, 'noMultipleOnShut', () => {
          
          let cnt = 0;
          let m = FreeLoad(() => cnt++);
          for (let n of Array.fill(10)) m.shut();
          return { result: cnt === 1, msg: 'shut occurs exactly once' }
          
        });
        
        Keep(k, 'noMultipleShuts', () => {
          
          let cnt = 0;
          let m = FreeLoad();
          m.shutFlow().hold(() => cnt++);
          for (let n of Array.fill(10)) m.shut();
          return { result: cnt === 1, msg: 'shut occurs exactly once' }
          
        });
        
        Keep(k, 'dropPreventsShut', () => {
          
          let cnt = 0;
          let m = FreeLoad();
          let holdShut = m.shutFlow().hold(() => cnt++);
          holdShut.shut();
          
          m.shut();
          return { result: cnt === 0, msg: 'shut wasn\'t born' };
          
        });
        
        Keep(k, 'postmortemShut', () => {
          
          let cnt = 0;
          let m = FreeLoad();
          m.shut();
          
          m.shutFlow().hold(() => cnt++);
          for (let n of Array.fill(10)) m.shut();
          
          return { result: cnt === 1, msg: 'shut born exactly once' };
          
        });
        
        Keep(k, 'ensureIsShut1', () => {
          
          let m = FreeLoad();
          m.shut();
          return { result: m.isShut(), msg: 'isShut is true' };
          
        });
        
        Keep(k, 'ensureIsShut2', () => {
          
          let m = FreeLoad();
          let m2 = FreeLoad();
          m.shutFlow().hold(() => m2.shut());
          m.shut();
          return { result: m2.isShut(), msg: 'isShut is true' };
          
        });
        
        Keep(k, 'ensureIsShut3', () => {
          
          let m = FreeLoad();
          let m2 = FreeLoad();
          m.shut();
          m.shutFlow().hold(() => m2.shut());
          return { result: m2.isShut(), msg: 'isShut is true' };
          
        });
        
      });
      
      Keep(k, 'flow').contain(k => {
        
        Keep(k, 'bearSingleValue', () => {
          
          let b = Flow();
          let v = null;
          b.hold((...args) => v = args[0]);
          b.drip('hello');
          
          return { result: v === 'hello', msg: 'single value propagates' };
          
        });
        
        Keep(k, 'bearMultipleValues', () => {
          
          let b = Flow();
          let v1 = null, v2 = null;
          b.hold((...args) => [ v1, v2 ] = args);
          b.drip('yo', 'hi');
          
          return { result: v1 === 'yo' && v2 === 'hi', msg: 'multiple values propagate' };
          
        });
        
        Keep(k, 'shutHoldNoBear', () => {
          
          let b = Flow();
          let v = null;
          let hold = b.hold(v0 => v = v0);
          hold.shut();
          b.drip('hihi');
          
          return { result: v === null, msg: 'shut hold didn\'t occur' };
          
        });
        
        Keep(k, 'multipleHolds', () => {
          
          let b = Flow();
          let cnt = 0;
          let m = 3;
          let holds = Array.fill(10).map(() => b.hold(v => cnt += v));
          b.drip(m);
          
          return { result: cnt === (m * holds.length), msg: 'multiple holds bear values' };
          
        });
        
        Keep(k, 'multipleHoldsSomeShut', () => {
          
          let b = Flow();
          let cnt = 0;
          let numDropped = 3;
          let m = 4;
          let holds = Array.fill(10).map(() => b.hold(v => cnt += v));
          
          for (let i = 0; i < numDropped; i++) holds[i].shut();
          b.drip(m);
          
          return { result: cnt === (m * (holds.length - numDropped)), msg: 'multiple holds work when some are dropped' };
          
        });
        
      });
      
      Keep(k, 'sustain').contain(k => {
        
        let load = () => FreeLoad();
        
        // "res" = responsible; "dep" = "dependent", "sus" = "sustain"
        
        Keep(k, 'resShutCauseDepShut1', () => {
          
          let res = load();
          let dep = load();
          let rel = Sustain(res, [ dep ]);
          res.shut();
          
          return { result: dep.isShut(), msg: 'res shut cause dep shut' };
          
        });
        
        Keep(k, 'resShutCauseDepShut2', () => {
          
          let res = load();
          let dep = load();
          res.shut();
          let rel = Sustain(res, [ dep ]);
          return { result: dep.isShut(), msg: 'res shut cause dep shut' };
          
        });
        
        Keep(k, 'resShutCauseDepShutResLive', () => {
          
          let res = load();
          let dep = load();
          let rel = Sustain(res, [ dep ]);
          rel.shut();
          return [
            [ 'dep shuts with rel', () => dep.isShut() ],
            [ 'res open when rel shuts', () => !res.isShut() ]
          ];
          
        });
        
        Keep(k, 'recursiveSustains1', () => {
          
          let cnt = 0;
          let root = load();
          let rootRel = Sustain(root);
          
          for (let i = 0; i < 10; i++) {
            
            let midRel = Sustain(rootRel);
            rootRel.addDep(midRel);
            
            for (let i = 0; i < 7; i++) {
              let m = load();
              m.shutFlow().hold(() => cnt++);
              midRel.addDep(m);
            }
            
          }
          
          root.shut();
          
          return { result: cnt === 10 * 7, msg: 'recursively shut reliances' };
          
        });
        
        Keep(k, 'recursiveSustains2', () => {
          
          let cnt = 0;
          let root = load();
          let rootRel = Sustain(root);
          
          for (let i = 0; i < 10; i++) {
            
            let midRel = Sustain(rootRel);
            rootRel.addDep(midRel);
            
            for (let i = 0; i < 7; i++) {
              let m = load();
              m.shutFlow().hold(() => cnt++);
              midRel.addDep(m);
            }
            
          }
          
          rootRel.shut();
          
          return { result: cnt === 10 * 7 && !root.isShut(), msg: 'recursively shut reliances; root survives' };
          
        });
        
        Keep(k, 'recursiveSustains3', () => {
          
          let cnt = 0;
          let root = load();
          let rootRel = Sustain(root);
          let midRels = [];
          
          for (let i = 0; i < 10; i++) {
            
            let midRel = Sustain(rootRel);
            midRels.push(midRel);
            rootRel.addDep(midRel);
            
            for (let i = 0; i < 7; i++) {
              let m = load();
              m.shutFlow().hold(() => cnt++);
              midRel.addDep(m);
            }
            
          }
          for (let i = 0; i < 3; i++) midRels[i].shut();
          
          return {
            result: cnt === 3 * 7 && root.isOpen() && rootRel.isOpen() && midRels.map(r => r.isOpen() ? r : C.skip).length === (10 - 3),
            msg: 'only the correct Sustains are shut'
          };
          
        });
        
      });
      
      Keep(k, 'scope').contain(k => {
        
        Keep(k, 'openAndShut', () => {
          
          let flux = Flux();
          let openCnt = 0;
          let shutCnt = 0;
          let scope = Scope(flux, (dep, load) => {
            openCnt++;
            dep(FreeLoad(() => shutCnt++));
          });
          
          let load1 = FreeLoad();
          flux.drip(load1);
          if (openCnt !== 1) return { result: false, msg: 'exactly 1 opens' };
          if (shutCnt !== 0) return { result: false, msg: 'exactly 0 shuts' };
          
          let load2 = FreeLoad();
          flux.drip(load2);
          let load3 = FreeLoad();
          flux.drip(load3);
          if (openCnt !== 3) return { result: false, msg: 'exactly 3 opens' };
          if (shutCnt !== 0) return { result: false, msg: 'exactly 0 shuts' };
          
          load1.shut();
          load2.shut();
          if (openCnt !== 3) return { result: false, msg: 'exactly 3 opens' };
          if (shutCnt !== 2) return { result: false, msg: 'exactly 2 shuts' };
          
          load3.shut();
          if (openCnt !== 3) return { result: false, msg: 'exactly 3 opens' };
          if (shutCnt !== 3) return { result: false, msg: 'exactly 3 shuts' };
          
          return { result: true };
          
        });
        
        Keep(k, 'nested', () => {
          
          let flux1 = Flux();
          let flux2 = Flux();
          let flux3 = Flux();
          let load = FreeLoad();
          
          let cnts = [ 0, 0, 0, 0, 0, 0 ];
          let cmp = cnts2 => !cnts.find((cnt, i) => cnt !== cnts2[i]);
          
          let scope1 = Scope(flux1, (dep, flux2) => {
            
            cnts[0]++;
            dep(FreeLoad(() => cnts[1]++));
            
            let scope2 = dep(Scope(flux2, (dep, flux3) => {
              
              cnts[2]++;
              dep(FreeLoad(() => cnts[3]++));
              
              let scope3 = dep(Scope(flux3, (dep, load) => {
                
                cnts[4]++;
                dep(FreeLoad(() => cnts[5]++));
                
              }));
              
            }));
            
          });
          
          if (!cmp([ 0, 0, 0, 0, 0, 0 ])) return { result: false, msg: `test 1: ${cnts.join(', ')}` };
          
          flux1.drip(flux2);
          if (!cmp([ 1, 0, 0, 0, 0, 0 ])) return { result: false, msg: `test 2: ${cnts.join(', ')}` };
          
          flux2.drip(flux3);
          if (!cmp([ 1, 0, 1, 0, 0, 0 ])) return { result: false, msg: `test 3: ${cnts.join(', ')}` };
          
          flux3.drip(load);
          if (!cmp([ 1, 0, 1, 0, 1, 0 ])) return { result: false, msg: `test 4: ${cnts.join(', ')}` };
          
          flux3.shut();
          if (!cmp([ 1, 0, 1, 1, 1, 1 ])) return { result: false, msg: `test 5: ${cnts.join(', ')}` };
          
          flux2.shut();
          if (!cmp([ 1, 1, 1, 1, 1, 1 ])) return { result: false, msg: `test 6: ${cnts.join(', ')}` };
          
          return { result: true };
          
        });
        
      });
      
      Keep(k, 'flux').contain(k => {
        
        Keep(k, 'counter1', () => {
          
          let flux = Flux();
          let counter = flux.counter();
          let cnt = 0;
          counter.hold(n => cnt = n);
          
          try {
            Array.fill(10, () => FreeLoad()).forEach((load, i) => {
              flux.drip(load);
              if (cnt !== i + 1) throw new Error('count drips correctly');
            });
          } catch(err) {
            return { result: false, msg: err.message };
          }
          
          return { result: true };
          
        });
        
        Keep(k, 'counter2', () => {
          
          let flux = Flux();
          let counter = flux.counter();
          let cnt = 0;
          counter.hold(n => cnt = n);
          
          try {
            
            let loads = Array.fill(30, () => FreeLoad());
            loads.forEach((load, i) => flux.drip(load));
            loads.forEach((load, i) => {
              load.shut();
              if (cnt !== 30 - (i + 1)) throw new Error('count drips correctly on shut');
            });
            
          } catch(err) {
            return { result: false, msg: err.message };
          }
          
          return { result: true };
          
        });
        
        Keep(k, 'counterShut', () => {
          
          let flux = Flux();
          let counter = flux.counter();
          let cnt = 0;
          counter.hold(n => cnt = n);
          
          for (let i = 0; i < 10; i++) flux.drip(FreeLoad());
          counter.shut();
          for (let i = 0; i < 10; i++) flux.drip(FreeLoad());
          
          return { result: cnt === 10, msg: 'open ignored after shut' };
          
        });
        
        Keep(k, 'trackerSimple', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          
          let loads = Array.fill(3, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          return [
            [ 'correct number tracked', () => tracker.tracked.size === 3 ],
            [ 'correct item tracked 1', () => tracker.tracked.toArr(v=>v)[0] === loads[0] ],
            [ 'correct item tracked 2', () => tracker.tracked.toArr(v=>v)[1] === loads[1] ],
            [ 'correct item tracked 3', () => tracker.tracked.toArr(v=>v)[2] === loads[2] ],
          ];
          
        });
        
        Keep(k, 'trackerDrip1', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          let dripped = [];
          
          tracker.hold(load => dripped.push(load));
          
          let loads = Array.fill(10, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          return [
            [ 'correct number tracked', () => dripped.length === 10 ],
            ...dripped.map((load, i) => [ `correct item #${i + 1}`, () => load === loads[i] ])
          ];
          
        });
        
        Keep(k, 'trackerDrip2', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          let dripped = [];
          
          let loads = Array.fill(10, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          tracker.hold(load => dripped.push(load));
          
          return [
            [ 'correct number tracked', () => dripped.length === 10 ],
            ...dripped.map((load, i) => [ `correct item #${i + 1}`, () => load === loads[i] ])
          ];
          
        });
        
        Keep(k, 'trackerShut1', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          let dripped = [];
          
          tracker.hold(load => dripped.push(load));
          
          let loads = Array.fill(10, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          for (let n of Array.fill(5, i => i)) loads[n].shut();
          
          return [
            [ 'correct number dripped', () => dripped.length === 10 ],
            [ 'correct number tracked', () => dripped.map(load => load.isOpen() ? load : C.skip).length === 5 ]
          ];
          
        });
        
        Keep(k, 'trackerShut2', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          let dripped = [];
          
          let loads = Array.fill(10, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          for (let n of Array.fill(5, i => i)) loads[n].shut();
          
          tracker.hold(load => dripped.push(load));
          
          return [
            [ 'correct number dripped', () => dripped.length === 5 ],
            [ 'correct number tracked', () => dripped.map(load => load.isOpen() ? load : C.skip).length === 5 ]
          ];
          
        });
        
        Keep(k, 'trackerShut3', () => {
          
          let flux = Flux();
          let tracker = flux.tracker();
          let dripped = [];
          
          let loads = Array.fill(10, () => FreeLoad());
          loads.forEach(load => flux.drip(load));
          
          for (let n of Array.fill(5, i => i)) loads[n].shut();
          
          tracker.hold(load => dripped.push(load));
          
          let loads2 = Array.fill(5, () => FreeLoad());
          loads2.forEach(load => flux.drip(load));
          
          return [
            [ 'correct number dripped', () => dripped.length === 10 ],
            [ 'tracked before shuts', () => !loads.slice(5).find(load => !dripped.has(load)) ],
            [ 'tracked after shuts',  () => !loads2.find(load => !dripped.has(load)) ]
          ];
          
        });
        
        Keep(k, 'empty1', () => {
          
          let flux = Flux();
          let inv = flux.barren();
          
          let v1 = 0;
          inv.hold(() => v1 = 1).shut();
          
          if (v1 !== 1) return { result: false, msg: 'inverse active 1' };
          
          let load1 = FreeLoad();
          flux.drip(load1);
          inv.hold(() => v1 = 2).shut()
          if (v1 !== 1) return { result: false, msg: 'inverse inactive 1' };
          
          load1.shut();
          inv.hold(() => v1 = 3).shut();
          if (v1 !== 3) return { result: false, msg: 'inverse active 2' };
          
          let load2 = FreeLoad();
          flux.drip(load2);
          inv.hold(() => v1 = 4).shut()
          if (v1 !== 3) return { result: false, msg: 'inverse inactive 2' };
          
          load2.shut();
          inv.hold(() => v1 = 5).shut();
          if (v1 !== 5) return { result: false, msg: 'inverse active 3' };
          
          return { result: true, msg: 'inverse is maintained' };
          
        });
        
        Keep(k, 'empty2', () => {
          
          let flux = Flux();
          let inv = flux.barren();
          let load1 = flux.drip(FreeLoad());
          
          let count = 0;
          inv.hold(() => count++);
          if (count !== 0) return { result: false, msg: 'inverse inactive' };
          
          load1.shut();
          if (count !== 1) return { result: false, msg: 'inverse active' };
          
          let load2 = flux.drip(FreeLoad());
          if (count !== 1) return { result: false, msg: 'inverse inactive' };
          
          load2.shut();
          if (count !== 2) return { result: false, msg: 'inverse active' };
          
          return { result: true, msg: 'inverse is maintained' };
          
        });
        
        Keep(k, 'empty3', () => {
          
          let flux = Flux();
          let inv = flux.barren();
          
          let loads = Array.fill(10, () => FreeLoad());
          for (let m of loads) flux.drip(m);
          
          let isActive1 = false;
          inv.hold(() => isActive1 = true).shut();
          if (isActive1) return { result: false, msg: 'inv inactive' };
          
          for (let m of loads.slice(1)) {
            m.shut();
            let isActive2 = false;
            inv.hold(() => isActive2 = true).shut();
            if (isActive2) return { result: false, msg: 'inv inactive' };
          }
          
          loads[0].shut();
          let isActive3 = false;
          inv.hold(() => isActive3 = true).shut();
          return { result: isActive3 === true, msg: 'inv active' };
          
        });
        
      });
      
    });
    
  });
  keep.formatError = err => foundation.formatError(err);
  console.log(await keep.getResultString(args));
  
};
