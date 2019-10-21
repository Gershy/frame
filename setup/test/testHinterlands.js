require('../foundationNodeJs.js');
require('../foundationBrowser.js');
let { Hog, Wob, HorzScope } = U;
let { FoundationNodejs, FoundationBrowser } = U.setup;
let { Keep } = require('./hutkeeping.js');
let path = require('path');

let isGlobalLocked = false;
let doLockGlobal = async fn => {
  if (isGlobalLocked) throw new Error('Can\'t perform - requires global, and global is locked');
  isGlobalLocked = true;
  await fn();
  isGlobalLocked = false;
};

module.exports = async (args, foundationInsps) => {
  
  let isRoomFileName = name => {
    let pcs = name.split(path.sep).slice(-3);
    if (pcs.length < 3) return false;
    return pcs[0] === 'room' && pcs[2].hasHead(`${pcs[1]}.`) && pcs[2].hasTail('.js');
  };
  let spoofFoundationHut = async (FoundationCls, name, bearing, fn) => {
    
    // TODO: Multiple instances of FoundationNodejs result in many `process.on('uncaughtException', ...)`
    
    for (let fileName in require.cache) if (isRoomFileName(fileName)) delete require.cache[fileName];
    U.rooms = {}; // TODO: `U.rooms` should move to `foundationInstance.rooms`
    
    let desc = `${FoundationCls.name}:${name}.${bearing}`;
    let foundation = FoundationCls(); // TODO: Eventually try to prevent FoundationNodejs recompilation (for speed)
    let args0 = null;
    
    try {
      await foundation.raise({
        settle: `${name}.${bearing}`,
        hut: {
          name, innerRooms: [ 'record', 'hinterlands' ],
          build: (...args) => ({ open: () => { args0 = args; fn(...args); } })
        }
      });
    } catch(err) {
      console.log(`Error with [${desc}]:\n${foundation.formatError(err)}`);
    }
    
    return args0;
    
  };
  
  // TODO:
  // - Refactor out common test logic
  // - Test Cpus disconnecting
  // - Test Cpus disconnecting and reconnecting
  // - Test comWobs
  // - Test a setup where BelowHuts can communicate through edits and
  //   shared follows
  // - Test Below->Above modifies (LandsBelow.prototype.modifyRec)
  
  let keep = Keep(null, 'hinterlands').contain(k => {
    
    let trackTimeouts = Set();
    let trackIntervals = Set();
    let origSetTimeout = global.setTimeout;
    let origSetInterval = global.setInterval;
    global.setTimeout = (f, ms) => {
      let v = [ f ];
      let t = origSetTimeout(() => { trackTimeouts.rem(v); f(); }, ms);
      v.push(t);
      trackTimeouts.add(v);
      return t;
    };
    global.setInterval = (f, ms) => {
      let v = [ f ];
      let i = origSetInterval(() => { trackIntervals.rem(v); f(); }, ms);
      v.push(i);
      trackIntervals.add(v);
      return i;
    };
    
    let testHogs = Set();
    let addTestHog = h => testHogs.add(h) && h;
    
    k.sandwich = {
      after: async () => {
        // Clear all timeouts+intervals
        console.log(`** Clearing ${trackTimeouts.size} timeout(s) and ${trackIntervals.size} interval(s) **`);
        for (let [ f, timeout ] of trackTimeouts) { /*f();*/ clearTimeout(timeout); }
        for (let [ f, interval ] of trackIntervals) { /*f();*/ clearInterval(interval); }
        trackTimeouts = Set(); trackIntervals = Set();
        
        // Shut all test Hogs
        for (let hog of testHogs) (hog.isShut && hog.isShut()) || hog.shut();
        testHogs = Set();
        
        // Wait for a brief moment (allow nextTicks to occur, etc)
        await Promise(r => origSetTimeout(r, 10));
      }
    };
    
    Keep(k, 'landsGenUid', async n => {
      let [ f, r, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
      let lands = Lands({ recTypes: rt });
      return { msg: 'Lands uid len is 8', result: lands.nextUid().length === 8 };
    });
    
    Keep(k, 'arch', async n => {
      let [ f, { Rec }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
      let lands = Lands({ recTypes: rt });
      return { msg: 'Lands "arch" is Rec', result: U.isType(lands.arch, Rec) };
    });
    
    Keep(k, 'relWobDefineFirst', async n => {
      let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
      let { rt: trt, add } = recTyper();
      add('item',     Rec);
      add('archItem', Rec, '1M', rt.arch, trt.item);
      let lands = Lands({ recTypes: { ...trt, ...rt } });
      
      let wobbledItem = null;
      HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
      
      let item = lands.createRec('item', { value: 'item!' });
      let archItem = lands.createRec('archItem', {}, lands.arch, item);
      
      return [
        [ 'relWob returns item', () => !!wobbledItem ],
        [ 'relWob returns correct item', () => wobbledItem === item ]
      ];
    });
    
    Keep(k, 'relWobCreateFirst', async n => {
      let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
      let { rt: trt, add } = recTyper();
      add('item',     Rec);
      add('archItem', Rec, '1M', rt.arch, trt.item);
      let lands = Lands({ recTypes: { ...trt, ...rt } });
      
      let item = lands.createRec('item', { value: 'item!' })
      let archItem = lands.createRec('archItem', {}, lands.arch, item)
      
      let wobbledItem = null;
      HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
      
      return [
        [ 'relWob returns item', () => !!wobbledItem ],
        [ 'relWob returns correct item', () => wobbledItem === item ]
      ];
    });
    
    Keep(k, 'connect').contain(k => {
      
      let spoofServerWob = (name, pool) => {
        
        // Very simple Server which hardly decorates incoming Conns
        
        let serverWob = Wob();
        serverWob.desc = `SPOO ("${name}", a spoofy server)`;
        serverWob.cost = 50;
        serverWob.decorateConn = conn => {
          conn.spoofed = `Represents a FarHut for serverWob ${name}`;
        };
        serverWob.shut = () => {};
        return serverWob;
        
      };
      
      let receiveConnAction = (conn, action, timeoutMs=15) => {
        
        if (!conn.tellWob) throw new Error('Can\'t receive for conn without tellWob');
        let h = null;
        let err = new Error('timed out');
        let prm = Promise((rsv, rjc) => { h = conn.tellWob.hold(rsv); setTimeout(() => rjc(err), timeoutMs); });
        prm.catch(() => {}).then(() => h.shut()); // No matter what, shut the hold
        if (U.isType(action, Object)) conn.hear.wobble([ action, conn.tell ]);
        else                          action(conn);
        return prm;
        
      };
      
      Keep(k, 'connectScopeFirst', async n => {
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        
        let hutsFromCpus = [];
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { hutsFromCpus.push(hut); });
        
        let server0 = lands.servers[0];
        let testCpuId = `spoofed:${n}`;
        let conn = addTestHog(lands.pool.makeCpuConn(server0, conn => {
          conn.cpuId = testCpuId
          conn.hear = Wob();
          conn.tell = () => {};
        }));
        
        return [
          [ 'exactly one cpu resulted', () => lands.pool.cpus.toArr(v => v).length === 1 ],
          [ 'exactly one cpu conn',     () => lands.pool.cpus.toArr(v => v)[0].serverConns.size === 1 ],
          [ 'conn is as expected',      () => lands.pool.cpus.toArr(v => v)[0].serverConns.toArr(v => v)[0] === conn ],
          [ 'exactly one hut resulted', () => hutsFromCpus.length === 1 ],
          [ 'hut cpuId as expected',    () => hutsFromCpus[0].cpuId === testCpuId ],
          [ 'cpu cpuId as expected',    () => lands.pool.cpus.has(testCpuId) ]
        ];
        
      });
      
      Keep(k, 'connectConnFirst', async n => {
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        
        let server0 = lands.servers[0];
        let testCpuId = `spoofed:${n}`;
        let conn = addTestHog(lands.pool.makeCpuConn(server0, conn => {
          conn.cpuId = testCpuId
          conn.hear = Wob();
          conn.tell = () => {};
        }));
        
        let hutsFromCpus = [];
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { hutsFromCpus.push(hut); });
        
        return [
          [ 'exactly one cpu resulted', () => lands.pool.cpus.toArr(v => v).length === 1 ],
          [ 'exactly one cpu conn',     () => lands.pool.cpus.toArr(v => v)[0].serverConns.size === 1 ],
          [ 'conn is as expected',      () => lands.pool.cpus.toArr(v => v)[0].serverConns.toArr(v => v)[0] === conn ],
          [ 'exactly one hut resulted', () => hutsFromCpus.length === 1 ],
          [ 'hut cpuId as expected',    () => hutsFromCpus[0].cpuId === testCpuId ],
          [ 'cpu cpuId as expected',    () => lands.pool.cpus.has(testCpuId) ]
        ];
        
      });
      
      Keep(k, 'connShutCauseCpuAndHutShut', async n => {
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        
        let server0 = lands.servers[0];
        let testCpuId = `spoofed:${n}`;
        let conn = addTestHog(lands.pool.makeCpuConn(server0, conn => {
          conn.cpuId = testCpuId
          conn.hear = Wob();
          conn.tell = () => {};
        }));
        let cpu = lands.pool.getCpu(testCpuId);
        let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
        
        conn.shut();
        
        return [
          [ 'conn shut', () => conn.isShut() ],
          [ 'cpu shut', () => cpu.isShut() ],
          [ 'hut shut', () => hut.isShut() ],
        ];
        
      });
      
      Keep(k, 'cpuShutCauseConnAndHutShut', async n => {
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        
        let server0 = lands.servers[0];
        let testCpuId = `spoofed:${n}`;
        let conn = addTestHog(lands.pool.makeCpuConn(server0, conn => {
          conn.cpuId = testCpuId
          conn.hear = Wob();
          conn.tell = () => {};
        }));
        let cpu = lands.pool.getCpu(testCpuId);
        let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
        
        await Promise(r => setTimeout(r, 100));
        cpu.shut();
        
        return [
          [ 'conn shut', () => conn.isShut() ],
          [ 'cpu shut', () => cpu.isShut() ],
          [ 'hut shut', () => hut.isShut() ],
        ];
        
      });
      
      Keep(k, 'hutShutCauseConnAndCpuShut', async n => {
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        
        let server0 = lands.servers[0];
        let testCpuId = `spoofed:${n}`;
        let conn = addTestHog(lands.pool.makeCpuConn(server0, conn => {
          conn.cpuId = testCpuId
          conn.hear = Wob();
          conn.tell = () => {};
        }));
        let cpu = lands.pool.getCpu(testCpuId);
        let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
        
        await Promise(r => setTimeout(r, 100));
        hut.shut();
        
        return [
          [ 'conn shut', () => conn.isShut() ],
          [ 'cpu shut', () => cpu.isShut() ],
          [ 'hut shut', () => hut.isShut() ],
        ];
        
      });
      
      let parseInitData = msg => {
        let endBit = msg.substr(msg.indexOf('// ==== File:' + ' hut.js'));
        let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
        if (!initDataMatch) throw new Error(`Couldn't parse invalid initData`);
        return JSON.parse(initDataMatch[1]);
      };
      
      let getNodejsAboveLands = async n => {
        
        // Creates a FoundationNodejs instance, and a Lands instance
        // under it. The Lands instance will already have a makeServers
        // item which simply uses `spoofServerWob`.
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let lands = Lands({ recTypes: rt });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        return { lands, rt };
        
      };
      
      let getNodejsAboveLandsWithItemRec = async n => {
        
        // Creates a FoundationNodejs instance, some simple RecTypes
        // under it, and a Lands instance using the recTypes. The Lands
        // instance will already have a makeServers item which simply
        // uses `spoofServerWob`.
        
        let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, n, 'above', () => {});
        let { rt: trt, add } = recTyper();
        add('item',     Rec);
        add('archItem', Rec, '1M', rt.arch, trt.item);
        let lands = Lands({ recTypes: { ...trt, ...rt } });
        lands.makeServers.push(pool => spoofServerWob('above', pool));
        await lands.open();
        return { lands, trt, rt };
        
      };
      
      let makeTellWobConnWithLandsServer = (lands, serverWob, cpuId=null) => {
        if (!lands.servers.has(serverWob)) throw new Error('Provided Lands doesn\'t use the provided ServerWob');
        return addTestHog(lands.pool.makeCpuConn(serverWob, conn => {
          if (cpuId) conn.cpuId = cpuId;
          conn.hear = Wob();
          conn.tellWob = Wob(); // tells and replies will wobble here
          conn.tell = (...args) => conn.tellWob.wobble(...args);
        }));
      };
      
      Keep(k, 'sync').contain(k => {
        
        Keep(k, 'initNoData', async n => {
          
          let { lands, rt } = await getNodejsAboveLands(n);
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          let result = await receiveConnAction(conn, { command: 'getInit' });
          return [
            [ 'result is string',       () => U.isType(result, String) ],
            [ 'result looks like html', () => result.hasHead('<!DOCTYPE html>') ],
            [ 'initial value is null',  () => parseInitData(result) === null ]
          ];
          
        });
        
        Keep(k, 'initSimpleRecCreateFirst', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          // All Huts immediately follow Items
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
            dep(HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, archItem) => {
              hut.followRec(archItem);
              hut.followRec(archItem.members[1]);
            }));
          });
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          
          // Request initialization with `conn`
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          if (!U.isType(resultHtml, String)) return { result: false, msg: 'result is String' };
          if (!resultHtml.hasHead('<!DOCTYPE html>')) return { result: false, msg: 'result looks like html' };
          
          let initData = parseInitData(resultHtml);
          
          return [
            [ 'data is Object', () => U.isType(initData, Object) ],
            [ 'version is 1', () => initData.version === 1 ],
            [ 'command is update', () => initData.command === 'update' ],
            [ 'content is Object', () => U.isType(initData.content, Object) ],
            [ 'content addRec is Object', () => U.isType(initData.content.addRec, Object) ],
            [ 'adds 2 Recs', () => initData.content.addRec.toArr(v => v).length === 2 ],
            [ 'adds item', () => initData.content.addRec.find((v, k) => k === item.uid) ],
            [ 'adds archItem', () => initData.content.addRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'initSimpleRecConnFirst', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          // All Huts immediately follow Items
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
            dep(HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, archItem) => {
              hut.followRec(archItem);
              hut.followRec(archItem.members[1]);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          // Request initialization with `conn`
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          if (!U.isType(resultHtml, String)) return { result: false, msg: 'result is non-String' };
          if (!resultHtml.hasHead('<!DOCTYPE html>')) return { result: false, msg: 'result isn\'t html' };
          
          let initData = parseInitData(resultHtml);
          
          return [
            [ 'data is Object', () => U.isType(initData, Object) ],
            [ 'version is 1', () => initData.version === 1 ],
            [ 'command is update', () => initData.command === 'update' ],
            [ 'content is Object', () => U.isType(initData.content, Object) ],
            [ 'content addRec is Object', () => U.isType(initData.content.addRec, Object) ],
            [ 'adds 2 Recs', () => initData.content.addRec.toArr(v => v).length === 2 ],
            [ 'adds item', () => initData.content.addRec.find((v, k) => k === item.uid) ],
            [ 'adds archItem', () => initData.content.addRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'updRec1', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          let resultUpd = await receiveConnAction(conn, () => item.wobble('Wheee')); 
          
          return [
            [ 'result is object', () => U.isType(resultUpd, Object) ],
            [ 'result isn\'t forced', () => !resultUpd.has('force') ],
            [ 'is version 2', () => resultUpd.version === 2 ],
            [ 'is update command', () => resultUpd.command === 'update' ],
            [ 'result content is Object', () => U.isType(resultUpd.content, Object) ],
            [ 'content updRec is Object', () => U.isType(resultUpd.content.updRec, Object) ],
            [ 'upd 1 Rec', () => resultUpd.content.updRec.toArr(v => v).length === 1 ],
            [ 'upd item to correct value', () => resultUpd.content.updRec.find((v, k) => k === item.uid && v === 'Wheee') ],
          ];
          
        });
        
        Keep(k, 'remRec1', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          let resultRem = await receiveConnAction(conn, () => archItem.shut());
          
          return [
            [ 'result is object', () => U.isType(resultRem, Object) ],
            [ 'result isn\'t forced', () => !resultRem.has('force') ],
            [ 'is version 2', () => resultRem.version === 2 ],
            [ 'is update command', () => resultRem.command === 'update' ],
            [ 'result content is Object', () => U.isType(resultRem.content, Object) ],
            [ 'content remRec is Object', () => U.isType(resultRem.content.remRec, Object) ],
            [ 'rem 1 Rec', () => resultRem.content.remRec.toArr(v => v).length === 1 ],
            [ 'rem archItem', () => resultRem.content.remRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'remRec2', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          let resultRem = await receiveConnAction(conn, () => item.shut());
          
          return [
            [ 'result is object', () => U.isType(resultRem, Object) ],
            [ 'result isn\'t forced', () => !resultRem.has('force') ],
            [ 'is version 2', () => resultRem.version === 2 ],
            [ 'is update command', () => resultRem.command === 'update' ],
            [ 'result content is Object', () => U.isType(resultRem.content, Object) ],
            [ 'content remRec is Object', () => U.isType(resultRem.content.remRec, Object) ],
            [ 'rem 2 Recs', () => resultRem.content.remRec.toArr(v => v).length === 2 ],
            [ 'rem item', () => resultRem.content.remRec.find((v, k) => k === item.uid) ],
            [ 'rem archItem', () => resultRem.content.remRec.find((v, k) => k === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'addSyncRemSyncAddSync', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
          
          // Sync initially, then after `archItem` is forgotten, then after following it again
          let result1 = await receiveConnAction(conn, { command: 'getInit' });
          let result2 = await receiveConnAction(conn, () => hut.setRecFollowStrength(archItem, 0));
          let result3 = await receiveConnAction(conn, () => hut.setRecFollowStrength(archItem, 1));
          
          return [
            [ 'result is object', () => U.isType(result3, Object) ],
            [ 'is version 3', () => result3.version === 3 ],
            [ 'is update command', () => result3.command === 'update' ],
            [ 'result content is Object', () => U.isType(result3.content, Object) ],
            [ 'content addRec is Object', () => U.isType(result3.content.addRec, Object) ],
            [ 'adds 1 Rec', () => result3.content.addRec.toArr(v => v).length === 1 ],
            [ 'content addRec is correct', () => result3.content.addRec.find((v, k) => k === archItem.uid) ],
          ];
          
        });
        
        Keep(k, 'addSyncRemAddSync', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
          
          let result1 = await receiveConnAction(conn, { command: 'getInit' });
          try {
            let result2 = await receiveConnAction(conn, () => {
              hut.setRecFollowStrength(archItem, 0);
              hut.setRecFollowStrength(archItem, 1);
            });
            return { result: false, msg: 'rem then add should produce no sync' };
          } catch(err) {
            return { result: err.message === 'timed out', msg: 'error should be timeout' };
          }
          
        });
        
        Keep(k, 'addRemSync1', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          hut.setRecFollowStrength(archItem, 0);
          
          // Get addRec for `item` and `archItem`
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          let resultInit = parseInitData(resultHtml);
          
          return [
            [ 'result is Object', () => U.isType(resultInit, Object) ],
            [ 'is version 1', () => resultInit.version === 1 ],
            [ 'is update command', () => resultInit.command === 'update' ],
            [ 'result content is Object', () => U.isType(resultInit.content, Object) ],
            [ 'content addRec is Object', () => U.isType(resultInit.content.addRec, Object) ],
            [ 'adds 1 Rec', () => resultInit.content.addRec.toArr(v => v).length === 1 ],
            [ 'adds correct Rec', () => resultInit.content.addRec.find((v, k) => k === item.uid) ],
          ];
          
        });
        
        Keep(k, 'addRemSync2', async n => {
          
          let { lands, trt, rt } = await getNodejsAboveLandsWithItemRec(n);
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let conn = makeTellWobConnWithLandsServer(lands, lands.servers[0], `spoofed:${n}`);
          let hut = lands.hutsByCpuId.get(`spoofed:${n}`);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          hut.setRecFollowStrength(archItem, 0);
          //archItem.shut();
          
          // Get addRec for `item` and `archItem`
          let resultHtml = await receiveConnAction(conn, { command: 'getInit' });
          let resultInit = parseInitData(resultHtml);
          
          return [
            [ 'result is Object', () => U.isType(resultInit, Object) ],
            [ 'is version 1', () => resultInit.version === 1 ],
            [ 'is update command', () => resultInit.command === 'update' ],
            [ 'result content is Object', () => U.isType(resultInit.content, Object) ],
            [ 'content addRec is Object', () => U.isType(resultInit.content.addRec, Object) ],
            [ 'adds 1 Rec', () => resultInit.content.addRec.toArr(v => v).length === 1 ],
            [ 'adds correct Rec', () => resultInit.content.addRec.find((v, k) => k === item.uid) ],
          ];
          
        });
        
      });
      
      Keep(k, 'aboveBelow').contain(k => {
        
        let getNodejsAboveLandsWithBelowSpoofing = async (n, recTypeFn=v=>v) => {
          
          let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, `${n}Above`, 'above', () => {});
          let { rt: trt, add } = recTyper();
          recTypeFn(Rec, trt, rt, add);
          let landsAbove = Lands({ recTypes: { ...trt, ...rt } });
          landsAbove.makeServers.push(pool => {
            let serverWob = Wob();
            serverWob.desc = `ABV2 For ${n}`;
            serverWob.cost = 50;
            serverWob.decorateConn = conn => {
              conn.desc = 'Above\'s representation of a connection with Below';
              conn.hear = Wob();
              conn.tellWob = Wob(); // tells and replies will wobble here
              conn.tell = (...args) => conn.tellWob.wobble(...args);
            };
            serverWob.shut = () => {};
            return serverWob;
          });
          await landsAbove.open();
          
          let countBelowCpus = 0;
          
          landsAbove.spoofNodejsLandsBelow = async (belowCpuId, doInitSetup=true) => {
            
            let [ f, { Rec, recTyper }, { Lands, rt } ] = await spoofFoundationHut(FoundationNodejs, `${n}Below`, 'below', () => {});
            let { rt: trt, add } = recTyper();
            recTypeFn(Rec, trt, rt, add);
            let landsBelow = Lands({ recTypes: { ...trt, ...rt } });
            landsBelow.makeServers.push(pool => {
              let serverWob = Wob();
              serverWob.desc = `BLW2 For ${n}`;
              serverWob.cost = 50;
              serverWob.decorateConn = conn => {
                conn.desc = 'Below\'s representation of a connection with Above';
                conn.hear = Wob();
                conn.tellWob = Wob(); // tells and replies will wobble here
                conn.tell = (...args) => conn.tellWob.wobble(...args);
              };
              serverWob.shut = () => {};
              return serverWob;
            });
            
            landsBelow.requestInitialHtmlSyncAndSpoofNetwork = async () => {
              
              // This is the object `landsAbove` uses to represent its
              // connection with `landsBelow`. We get it by declaring a
              // new connection has occurred.
              let connAHearB = addTestHog(landsAbove.pool.makeCpuConn(landsAbove.servers[0], conn => {
                conn.cpuId = belowCpuId;
              }));
              
              let resultHtml = await receiveConnAction(connAHearB, { command: 'getInit' });
              let resultInit = parseInitData(resultHtml);
              
              // TODO: Just another reason why `initData` should be on Foundation! (AND IT COULD BE USED FOR RESTORING SAVED STATES WHEN SET ON ABOVE??)
              await doLockGlobal(async () => {
                U.initData = resultInit;
                await landsBelow.open();
                U.initData = null;
              });
              
              // This is the object `landsBelow` uses to represent its
              // connection with `landsAbove`. A Lands instance Below
              // will have automatically created a single connection for
              // each server, for the cpuId "above"
              let connBHearA = landsBelow.pool.getCpu('above').serverConns.toArr(v => v)[0];
              
              // From now on, these connections are bound together: a
              // Tell to one results in a Hear from the other.
              let shutNetwork = () => {
                holdAHearB.isShut() || holdAHearB.shut();
                holdBHearA.isShut() || holdBHearA.shut();
                holdAbvCpuShut.isShut() || holdAbvCpuShut.shut();
                holdBlwCpuShut.isShut() || holdBlwCpuShut.shut();
              };
              
              let holdAHearB = connAHearB.tellWob.hold(msg => {
                let reply = (...args) => process.nextTick(() => connAHearB.hear.wobble(...args));
                connBHearA.hear.wobble([ msg, reply ]);
              });
              let holdBHearA = connBHearA.tellWob.hold(msg => {
                let reply = (...args) => process.nextTick(() => connBHearA.hear.wobble(...args));
                connAHearB.hear.wobble([ msg, reply ]);
              });
              
              let holdAbvCpuShut = landsBelow.pool.getCpu('above').shutWob().hold(shutNetwork);
              let holdBlwCpuShut = landsAbove.pool.getCpu(belowCpuId).shutWob().hold(shutNetwork);
              
              return { connAHearB, connBHearA };
              
            };
            
            if (doInitSetup) await landsBelow.requestInitialHtmlSyncAndSpoofNetwork();
            
            return { lands: landsBelow, trt, rt, cpuId: belowCpuId };
            
          };
          
          return { lands: landsAbove, trt, rt, cpuId: 'above' }; // Since Below will always assume a single remote Cpu named "above"
          
        };
        
        let gatherAllRecs = (rec, allRecs={}, ignoreExc=true) => {
          
          if (allRecs.has(rec.uid) || rec.uid[0] === '!') return allRecs;
          allRecs[rec.uid] = rec;
          
          // Include Member and GroupRecs
          rec.members.forEach(mem => gatherAllRecs(mem, allRecs));
          rec.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(rec0 => gatherAllRecs(rec0, allRecs)));
          
          return allRecs;
          
        };
        
        let aboveBelowDiff = (landsAbove, landsBelow, ignoreExc=true) => {
          
          let [ recsAbove, recsBelow ] = [ landsAbove.arch, landsBelow.arch ].map(r => gatherAllRecs(r, ignoreExc));
          
          let onlyInAbove = recsAbove.map((rec, uid) => recsBelow.has(uid) ? C.skip : rec);
          let onlyInBelow = recsBelow.map((rec, uid) => recsAbove.has(uid) ? C.skip : rec);
          let valueMismatch = recsAbove.toArr((rec, uid) =>
            (recsBelow.has(uid) && recsBelow[uid].value !== rec.value)
              ? { above: rec, below: recsBelow[uid] }
              : C.skip
          );
          let match = onlyInAbove.isEmpty() && onlyInBelow.isEmpty() && valueMismatch.isEmpty();
          
          return { onlyInAbove, onlyInBelow, valueMismatch, match };
          
        };
        
        let diffMatchTests = diff => {
          return [
            [ 'no recs only in above',  () => diff.onlyInAbove.isEmpty() ],
            [ 'no recs only in below',  () => diff.onlyInBelow.isEmpty() ],
            [ 'no rec values mismatch', () => diff.valueMismatch.isEmpty() ]
          ];
        };
        
        Keep(k, 'createCpuHutSingle', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n);
          let blw1 = await abv.lands.spoofNodejsLandsBelow('testBelow1');
          
          let aboveCpus = abv.lands.pool.cpus.toArr(cpu => cpu);
          let aboveFarHuts = abv.lands.hutsByCpuId.toArr(v => v);
          let belowCpus = blw1.lands.pool.cpus.toArr(cpu => cpu);
          let belowFarHuts = blw1.lands.hutsByCpuId.toArr(v => v);
          return [
            [ 'above has a single cpu',   () => aboveCpus.length === 1 ],
            [ 'above cpu cpuId correct',  () => aboveCpus[0].cpuId === blw1.cpuId ],
            [ 'above has a single hut',   () => aboveFarHuts.length === 1 ],
            [ 'above hut cpuId correct',  () => aboveFarHuts[0].cpuId === blw1.cpuId ],
            [ 'below has a single cpu',   () => belowCpus.length === 1 ],
            [ 'below cpu cpuId correct',  () => belowCpus[0].cpuId === abv.cpuId ],
            [ 'below has a single hut',   () => belowFarHuts.length === 1 ],
            [ 'below hut cpuId correct',  () => belowFarHuts[0].cpuId === abv.cpuId ],
          ];
          
        });
        
        Keep(k, 'createCpuHutMulti', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n);
          let numBlws = 10;
          let blws = [];
          for (let i = 0; i < numBlws; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let aboveCpus = abv.lands.pool.cpus.toArr(cpu => cpu);
          let aboveFarHuts = abv.lands.hutsByCpuId.toArr(v => v);
          
          let tests = [
            [ `above has ${numBlws} cpus`, () => aboveCpus.length === numBlws ],
            [ `above has ${numBlws} huts`, () => aboveFarHuts.length === numBlws ]
          ];
          
          blws.forEach((blw, i) => {
            tests.push(...[
              [ `above has cpu for ${blw.cpuId}`, () => aboveCpus.find(cpu => cpu.cpuId === blw.cpuId) ],
              [ `above has hut for ${blw.cpuId}`, () => aboveFarHuts.find(hut => hut.cpuId === blw.cpuId) ]
            ]);
          });
          
          blws.forEach((blw, i) => {
            let belowCpus = blw.lands.pool.cpus.toArr(cpu => cpu);
            let belowFarHuts = blw.lands.hutsByCpuId.toArr(v => v);
            tests.push(...[
              [ `${blw.cpuId} has a single cpu`,  () => belowCpus.length === 1 ],
              [ `${blw.cpuId} cpu cpuId correct`, () => belowCpus[0].cpuId === abv.cpuId ],
              [ `${blw.cpuId} has a single hut`,  () => belowFarHuts.length === 1 ],
              [ `${blw.cpuId} hut cpuId correct`, () => belowFarHuts[0].cpuId === abv.cpuId ],
            ]);
          });
          
          return tests;
          
        });
        
        Keep(k, 'multipleConnectsFails', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n);
          let blw = await abv.lands.spoofNodejsLandsBelow(`testBelow1`, false);
          
          await blw.lands.requestInitialHtmlSyncAndSpoofNetwork();
          
          try {
            await blw.lands.requestInitialHtmlSyncAndSpoofNetwork();
            return { result: false, msg: 'multiple connects fails' };
          } catch(err) {
            return { result: err.message.has('connected twice'), msg: 'error indicates multiple connects' };
          }
          
        });
        
        Keep(k, 'initSyncNull', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n);
          let blw1 = await abv.lands.spoofNodejsLandsBelow('testBelow1');
          return [
            ...diffMatchTests(aboveBelowDiff(abv.lands, blw1.lands))
          ];
          
        });
        
        Keep(k, 'initSyncSimpleSingleBlwRecFirst', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          let blw1 = await abv.lands.spoofNodejsLandsBelow('testBelow1');
          
          return [
            ...diffMatchTests(aboveBelowDiff(abv.lands, blw1.lands))
          ];
          
        });
        
        Keep(k, 'initSyncSimpleSingleBlwBlwFirst', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blw1 = await abv.lands.spoofNodejsLandsBelow('testBelow1');
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          return [
            ...diffMatchTests(aboveBelowDiff(abv.lands, blw1.lands))
          ];
          
        });
        
        Keep(k, 'initSyncSimpleMultiBlwRecFirst', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
        Keep(k, 'initSyncSimpleMultiBlwBlwFirst', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
        Keep(k, 'syncUpd', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          item.wobble('a new value!');
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
        Keep(k, 'syncRem1', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          item.shut();
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
        Keep(k, 'syncRem2', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let item = abv.lands.createRec('item', { value: 'an item' });
          let archItem = abv.lands.createRec('archItem', {}, abv.lands.arch, item);
          
          archItem.shut();
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
        Keep(k, 'syncAddAddRemAdd', async n => {
          
          let abv = await getNodejsAboveLandsWithBelowSpoofing(n, (Rec, trt, rt, add) => {
            add('item',     Rec);
            add('archItem', Rec, '1M', rt.arch, trt.item);
          });
          
          HorzScope(abv.lands.arch.relWob(abv.rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(abv.trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              dep(hut.followRec(archItem));
              dep(hut.followRec(item));
            }));
          });
          
          let blws = [];
          for (let i = 0; i < 10; i++) blws.push(await abv.lands.spoofNodejsLandsBelow(`testBelow${i + 1}`));
          
          let item1 = abv.lands.createRec('item', { value: 'an item' });
          let archItem1 = abv.lands.createRec('archItem', {}, abv.lands.arch, item1);
          
          let item2 = abv.lands.createRec('item', { value: 'an item' });
          let archItem2 = abv.lands.createRec('archItem', {}, abv.lands.arch, item2)
          
          archItem1.shut();
          
          let item3 = abv.lands.createRec('item', { value: 'an item' });
          let archItem3 = abv.lands.createRec('archItem', {}, abv.lands.arch, item3)
          
          let tests = [];
          blws.forEach(blw => tests.push(...diffMatchTests(aboveBelowDiff(abv.lands, blw.lands))));
          
          return tests;
          
        });
        
      });
      
    });
    
  });
  
  let [ foundationAbove ] = await spoofFoundationHut(FoundationNodejs, 'errorsAbove', 'above', () => {})
  let [ foundationBelow ] = await spoofFoundationHut(FoundationNodejs, 'errorsBelow', 'below', () => {})
  keep.formatError = err => (err.stack.has('.above.') ? foundationAbove : foundationBelow).formatError(err);
  await keep.showResults(args);
  
};
