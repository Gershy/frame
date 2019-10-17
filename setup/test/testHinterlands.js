require('../foundationNodeJs.js');
require('../foundationBrowser.js');
let { FoundationNodejs, FoundationBrowser } = U.setup;
let { Keep } = require('./hutkeeping.js');

module.exports = async (args, foundationInsps) => {
  
  let foundation = U.foundation = FoundationNodejs();
  
  let [ recordRoomForNodeJs, hinterlandsRoomForNodeJs ] = await Promise(resolve => foundation.raise({
    settle: 'hinterlandsTest.above',
    hut: {
      name: 'hinterlandsTest',
      innerRooms: [ 'record', 'hinterlands' ],
      build: (foundation, record, hinterlands) => ({ open: () => resolve([ record, hinterlands ]) })
    }
  }));
  
  let { Lands, Hut, rt } = hinterlandsRoomForNodeJs;
  let { recTyper, Rec } = recordRoomForNodeJs;
  let { Hog, Wob, HorzScope } = U;
  
  let parseInitData = msg => {
    let endBit = msg.substr(msg.indexOf('// ==== File:' + ' hut.js'));
    let initDataMatch = endBit.match(/U\.initData = (.*);\s*U\.debugLineData = /);
    if (!initDataMatch) throw new Error(`Couldn't parse invalid initData`);
    return JSON.parse(initDataMatch[1]);
  };
  
  // TODO: Copy-pasted from hinterlands
  let doUpdate = (lands, msg) => {
    
    // Updates `lands` based on the contents of `msg`.
    
    let { version, content } = msg;
    if (version !== lands.version + 1) throw new Error(`Tried to move from version ${lands.version} -> ${version}`);
    
    let squad = U.WobSquad();
    let err = U.safe(() => {
      
      // Apply all operations
      let { addRec={}, remRec={}, updRec={} } = content;
      
      // "head" Recs existed before the current update. "tail" Recs are Recs
      // whose existence results from the update. A Rec coming into existence
      // may have member references to both HeadRecs and TailRecs
      let headRecs = lands.allRecs;
      let tailRecs = Map();
      let getHeadOrTailRec = uid => {
        if (headRecs.has(uid)) return headRecs.get(uid);
        if (tailRecs.has(uid)) return tailRecs.get(uid);
        return null;
      };
      
      // Add new Recs with dependency churning
      let waiting = addRec.toArr((v, uid) => v.gain({ uid }));
      while (waiting.length) {
        
        let attempt = waiting;
        waiting = [];
        
        for (let addVals of attempt) {
        
          let { type, value, members, uid } = addVals;
          
          // Convert all members from uid to Rec
          members = members.map(uid => getHeadOrTailRec(uid));
          
          // If a member couldn't be converted wait for a later churn
          if (members.find(m => !m)) { waiting.push(addVals); continue; }
          
          // All members are available - create the Rec!
          let newRec = lands.createRec(type, { uid, value, squad }, ...members);
          tailRecs.set(uid, newRec);
          
        }
        
        if (waiting.length === attempt.length) { // If churn achieved nothing we're stuck
          console.log('Head Recs:', headRecs.toArr((rec, uid) => `${uid}: ${U.nameOf(rec)}`).join('\n'));
          console.log(JSON.stringify(content, null, 2));
          throw new Error(`Unresolvable Rec dependencies`);
        }
        
      }
      
      // Update Recs directly
      updRec.forEach((newValue, uid) => {
        if (!lands.allRecs.has(uid)) throw new Error(`Tried to upd non-existent Rec @ ${uid}`);
        squad.wobble(lands.allRecs.get(uid), newValue);
      });
      
      // Remove Recs directly
      //let shutGroup = Set();
      remRec.forEach((val, uid) => {
        if (!lands.allRecs.has(uid)) throw new Error(`Tried to rem non-existent Rec @ ${uid}`);
        squad.shut(lands.allRecs.get(uid));
      });
      
    });
    
    squad.complete(err);
    
    if (err) { err.message = `Error in "update": ${err.message}`; throw err; }
    
    // We've successfully moved to our next version!
    lands.version = version;
    
  };
  
  let keep = Keep(null, 'hinterlands').contain(k => {
    
    let testyNames = [ 'jim', 'bob', 'sal', 'tom', 'tim', 'rik',
      'hal', 'jed', 'man', 'guy', 'ted', 'may', 'fay', 'boi', 'mom',
      'glo', 'dad', 'zed', 'kli', 'pog', 'wei', 'joy', 'ann', 'rae' ];
    
    let testData = null;
    k.sandwich.before = async () => {
      
      let { rt: trt, add } = recTyper();
      add('loc',        Rec);
      add('item',       Rec);
      add('man',        Rec);
      add('hat',        Rec);
      add('store',      Rec);
      add('manHat',     Rec, '11', trt.man,     trt.hat);
      add('storeItem',  Rec, '1M', trt.store,   trt.item);
      add('storeLoc',   Rec, '11', trt.store,   trt.loc);
      add('manSeen',    Rec, 'MM', trt.man,     trt.loc);
      add('archItem',   Rec, '1M', rt.arch,     trt.item);
      add('archMan',    Rec, '1M', rt.arch,     trt.man);
      add('archStore',  Rec, '1M', rt.arch,     trt.store);
      
      let lands = Lands({ recTypes: { ...rt, ...trt } });
      
      let cpus = Set();
      
      let belowIdCnt = 0;
      lands.makeServers.push(pool => {
        let serverWob = U.Wob();
        serverWob.desc = 'Spoofy Above serverWob for hinterlands tests';
        serverWob.cost = 50;
        serverWob.spoofCpu = () => pool.makeCpuConn(serverWob, conn => conn.cpuId = testyNames[belowIdCnt++]);
        serverWob.decorateConn = conn => {
          conn.hear = U.Wob();
          conn.hear.hold(v => { if (!U.isType(v, Array)) throw new Error('Must hear Array'); });
          conn.tellWob = U.Wob();
          conn.tell = (...args) => conn.tellWob.wobble(...args);
          conn.nextTell = async (fn=null, force='force') => {
            let hold = null;
            let prm = new Promise(rsv => hold = conn.tellWob.hold(v => rsv(v)));
            prm.then(() => hold.shut());
            
            let hut = lands.hutForCpu(conn);
            if (force) hut.forceSync(force);
            if (fn) await fn(hut)
            
            return await prm;
          };
          
          cpus.add(conn);
          conn.shutWob().hold(() => cpus.rem(conn));
        };
        serverWob.shut = () => serverWob.spoofCpu = null;
        return serverWob;
      });
      lands.hutForCpu = ({ cpuId }) => lands.hutsByCpuId.get(cpuId);
      
      await lands.open();
      
      testData = { trt, server: lands.servers[0], lands, cpus };
      
    };
    k.sandwich.after = () => {
      let shutGroup = Set();
      
      // If these aren't explicitly shut timeouts may cause
      // the program to persist after all tests are complete
      testData.cpus.forEach(cpu => cpu.shut(shutGroup));
      testData.lands.shut(shutGroup);
    };
    
    Keep(k, 'landsGenUid', () => {
      let lands = Lands({ recTypes: rt });
      return { msg: 'Lands uid len is 8', result: lands.nextUid().length === 8 };
    });
    
    Keep(k, 'arch', async () => {
      let { trt, server, lands } = testData;
      return { msg: 'Lands has "arch"', result: U.isInspiredBy(lands.arch, Rec) };
    });
    
    Keep(k, 'relWobDefineFirst', async () => {
      let { trt, server, lands } = testData;
      
      let wobbledItem = null;
      HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
      
      let item = lands.createRec('item', { value: 'item!' });
      let archItem = lands.createRec('archItem', {}, lands.arch, item);
      
      return [
        [ 'relWob returns item', () => !!wobbledItem ],
        [ 'relWob returns correct item', () => wobbledItem === item ]
      ];
      
    });
    
    Keep(k, 'relWobCreateFirst', async () => {
      let { trt, server, lands } = testData;
      
      let item = lands.createRec('item', { value: 'item!' })
      let archItem = lands.createRec('archItem', {}, lands.arch, item)
      
      let wobbledItem = null;
      HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, { members: [ _, item ] }) => { wobbledItem = item; });
      
      return [
        [ 'relWob returns item', () => !!wobbledItem ],
        [ 'relWob returns correct item', () => wobbledItem === item ]
      ];
      
    });
    
    Keep(k, 'connectionSucceeds', async () => {
      let { trt, server, lands } = testData;
      
      let client = server.spoofCpu();
      return { result: !!client };
    });
    
    Keep(k, 'connectHutDefineFirst', async () => {
      let { trt, server, lands } = testData;
      
      let wobbledHut = null;
      HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
      
      let client = server.spoofCpu();
      
      return [
        [ 'relWob returns item', () => !!wobbledHut ],
        [ 'relWob returns hut', () => U.isInspiredBy(wobbledHut, Hut) ]
      ];
      
    });
    
    Keep(k, 'connectHutCreateFirst', async () => {
      let { trt, server, lands } = testData;
      
      let client = server.spoofCpu();
      
      let wobbledHut = null;
      HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
      
      return [
        [ 'relWob returns item', () => !!wobbledHut ],
        [ 'relWob returns hut', () => U.isInspiredBy(wobbledHut, Hut) ]
      ];
      
    });
    
    Keep(k, 'clientShutsHut', async () => {
      
      let { trt, server, lands } = testData;
      
      let client = server.spoofCpu();
      
      let wobbledHut = null;
      HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
        wobbledHut = hut;
      });
      
      client.shut();
      
      return { msg: 'hut is shut', result: () => hut.isShut() };
      
    });
    
    Keep(k, 'hutShutsClient', async () => {
      
      let { trt, server, lands } = testData;
      
      let client = server.spoofCpu();
      
      let wobbledHut = null;
      HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => { wobbledHut = hut; });
      
      client.shut();
      
      return { msg: 'hut is shut', result: () => hut.isShut() };
      
    });
    
    Keep(k, 'getInit').contain(k => {
      
      Keep(k, 'noData', async () => {
        
        return { result: true };
        
        let { trt, server, lands } = testData;
        
        let client = server.spoofCpu();
        
        let result = await client.nextTell(() => {
          client.hear.wobble([ { command: 'getInit' }, client.tell ]);
        }, null);
        
        let initData = parseInitData(result);
        return { result: initData === null };
        
      });
      
      Keep(k, 'simpleRec', async () => {
        
        let { trt, server, lands } = testData;
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, { members: [ _, hut ] }) => {
          dep(HorzScope(lands.arch.relWob(trt.archItem, 0), (dep, archItem) => {
            hut.followRec(archItem);
            hut.followRec(archItem.members[1]);
          }));
        });
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
         
        let client = server.spoofCpu();
        let result = await client.nextTell(() => {
          client.hear.wobble([ { command: 'getInit' }, client.tell ]);
        });
        
        let initData = parseInitData(result);
        
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
      
    });
    
    Keep(k, 'follow').contain(k => {
      
      Keep(k, 'addRecDefineFirst', async () => {
        
        let { trt, server, lands } = testData;
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
          
          let [ arch, hut ] = archHut.members;
          
          dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
            
            let [ arch, item ] = archItem.members;
            
            hut.followRec(archItem);
            hut.followRec(item);
            
          }));
          
        });
        
        let client = server.spoofCpu();
        let hut = lands.hutForCpu(client);
        
        let item = lands.createRec('item', { value: 'item!' })
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        let result = await client.nextTell();
        
        return [
          [ 'result is object', () => U.isType(result, Object) ],
          [ 'result isn\'t forced', () => !result.has('force') ],
          [ 'is version 1', () => result.version === 1 ],
          [ 'is update command', () => result.command === 'update' ],
          [ 'result content is Object', () => U.isType(result.content, Object) ],
          [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
          [ 'add 2 Recs', () => result.content.addRec.toArr(v => v).length === 2 ],
          [ 'add includes item', () => result.content.addRec.find((v, k) => v.type === item.type.name && k === item.uid && v.value === 'item!') ],
          [ 'add includes archItem', () => result.content.addRec.find((v, k) => v.type === archItem.type.name && k === archItem.uid) ],
        ];
        
      });
      
      Keep(k, 'addRecCreateFirst', async () => {
        
        let { trt, server, lands } = testData;
        
        let client = server.spoofCpu();
        let hut = lands.hutForCpu(client);
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
          
          let [ arch, hut ] = archHut.members;
          
          dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
            
            let [ arch, item ] = archItem.members;
            
            hut.followRec(archItem);
            hut.followRec(item);
            
          }));
          
        });
        
        let result = await client.nextTell();
        
        return [
          [ 'result is object', () => U.isType(result, Object) ],
          [ 'result isn\'t forced', () => !result.has('force') ],
          [ 'is version 1', () => result.version === 1 ],
          [ 'is update command', () => result.command === 'update' ],
          [ 'result content is Object', () => U.isType(result.content, Object) ],
          [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
          [ 'add 2 Recs', () => result.content.addRec.toArr(v => v).length === 2 ],
          [ 'add includes item', () => result.content.addRec.find((v, k) => v.type === item.type.name && k === item.uid && v.value === 'item!') ],
          [ 'add includes archItem', () => result.content.addRec.find((v, k) => v.type === archItem.type.name && k === archItem.uid) ],
        ];
        
      });
      
      Keep(k, 'updRec1', async () => {
        
        let { trt, server, lands } = testData;
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
          let [ arch, hut ] = archHut.members;
          dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
            let [ arch, item ] = archItem.members;
            hut.followRec(archItem);
            hut.followRec(item);
          }));
        });
        
        let client = server.spoofCpu();
        let hut = lands.hutForCpu(client);
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        // Get addRec
        let result = await client.nextTell();
        
        // Get updRec
        result = await client.nextTell(() => item.wobble('Wheee'));
        
        return [
          [ 'result is object', () => U.isType(result, Object) ],
          [ 'result isn\'t forced', () => !result.has('force') ],
          [ 'is version 2', () => result.version === 2 ],
          [ 'is update command', () => result.command === 'update' ],
          [ 'result content is Object', () => U.isType(result.content, Object) ],
          [ 'content updRec is Object', () => U.isType(result.content.updRec, Object) ],
          [ 'upd 1 Rec', () => result.content.updRec.toArr(v => v).length === 1 ],
          [ 'upd item to correct value', () => result.content.updRec.find((v, k) => k === item.uid && v === 'Wheee') ],
        ];
        
      });
      
      Keep(k, 'remRec1', async () => {
        
        let { trt, server, lands } = testData;
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
          
          let [ arch, hut ] = archHut.members;
          
          dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
            
            let [ arch, item ] = archItem.members;
            
            hut.followRec(archItem);
            hut.followRec(item);
            
          }));
          
        });
        
        let client = server.spoofCpu();
        let hut = lands.hutForCpu(client);
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        let result = await client.nextTell();
        
        result = await client.nextTell(() => {
          archItem.shut();
        });
        
        return [
          [ 'result is object', () => U.isType(result, Object) ],
          [ 'result isn\'t forced', () => !result.has('force') ],
          [ 'is version 2', () => result.version === 2 ],
          [ 'is update command', () => result.command === 'update' ],
          [ 'result content is Object', () => U.isType(result.content, Object) ],
          [ 'content remRec is Object', () => U.isType(result.content.remRec, Object) ],
          [ 'rem 1 Rec', () => result.content.remRec.toArr(v => v).length === 1 ],
          [ 'rem archItem', () => result.content.remRec.find((v, k) => k === archItem.uid) ]
        ];
        
      });
      
      Keep(k, 'remRec2', async () => {
        
        let { trt, server, lands } = testData;
        
        HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
          
          let [ arch, hut ] = archHut.members;
          
          dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
            
            let [ arch, item ] = archItem.members;
            
            hut.followRec(archItem);
            hut.followRec(item);
            
          }));
          
        });
        
        let client = server.spoofCpu();
        let hut = lands.hutForCpu(client);
        
        let item = lands.createRec('item', { value: 'item!' });
        let archItem = lands.createRec('archItem', {}, lands.arch, item);
        
        // Get addRec
        let result = await client.nextTell();
        
        // Get remRec
        result = await client.nextTell(() => item.shut());
        
        // TODO: Really, we only need to send "remRec" for `item`, as its
        // removal will automatically remove `archItem` from below as well.
        // This isn't taken into consideration at the moment. Instead all
        // Recs whose shutting occurs as a result of a single operation are
        // individually synced shut on the Below's end.
        
        return [
          [ 'result is object', () => U.isType(result, Object) ],
          [ 'result isn\'t forced', () => !result.has('force') ],
          [ 'is version 2', () => result.version === 2 ],
          [ 'is update command', () => result.command === 'update' ],
          [ 'result content is Object', () => U.isType(result.content, Object) ],
          [ 'content remRec is Object', () => U.isType(result.content.remRec, Object) ],
          [ 'rem 2 Recs', () => result.content.remRec.toArr(v => v).length === 2 ],
          [ 'rem item', () => result.content.remRec.find((v, k) => k === item.uid) ],
          [ 'rem archItem', () => result.content.remRec.find((v, k) => k === archItem.uid) ]
        ];
        
      });
      
      Keep(k, 'multi').contain(k => {
        
        Keep(k, 'addSyncRemSyncAddSync', async () => {
          
          let { trt, server, lands } = testData;
          
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
          
          let client = server.spoofCpu();
          let hut = lands.hutForCpu(client);
          
          // Get addRec for `item` and `archItem`
          let result1 = await client.nextTell();
          
          // Unfollow `archItem`
          let str = hut.getRecFollowStrength(archItem);
          let result2 = await client.nextTell(() => {
            hut.setRecFollowStrength(archItem, 0);
          });
          
          // Follow `archItem` again
          let result3 = await client.nextTell(() => {
            hut.setRecFollowStrength(archItem, str);
          });
          
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
        
        Keep(k, 'addSyncRemAddSync', async () => {
          
          let { trt, server, lands } = testData;
          
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
          
          let client = server.spoofCpu();
          let hut = lands.hutForCpu(client);
          
          // Get addRec for `item` and `archItem`
          let result1 = await client.nextTell();
          
          // Unfollow and follow `archItem`
          let result2 = await client.nextTell(() => {
            let str = hut.getRecFollowStrength(archItem);
            hut.setRecFollowStrength(archItem, 0);
            hut.setRecFollowStrength(archItem, str);
          });
          
          return [
            [ 'result is object', () => U.isType(result2, Object) ],
            [ 'is version 2', () => result2.version === 2 ],
            [ 'is update command', () => result2.command === 'update' ],
            [ 'result content is Object', () => U.isType(result2.content, Object) ],
            [ 'content has no addRec', () => !result2.content.has('addRec') ],
            [ 'content has no remRec', () => !result2.content.has('remRec') ],
          ];
          
        });
        
        Keep(k, 'addRemSync1', async () => {
          
          let { trt, server, lands } = testData;
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let client = server.spoofCpu();
          let hut = lands.hutForCpu(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          hut.setRecFollowStrength(archItem, 0);
          
          // Get addRec for `item` and `archItem`
          let result = await client.nextTell();
          
          return [
            [ 'result is Object', () => U.isType(result, Object) ],
            [ 'is version 1', () => result.version === 1 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
            [ 'adds 1 Rec', () => result.content.addRec.toArr(v => v).length === 1 ],
            [ 'adds correct Rec', () => result.content.addRec.find((v, k) => k === item.uid) ],
          ];
          
        });
        
        Keep(k, 'addRemSync2', async () => {
          
          let { trt, server, lands } = testData;
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ arch, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let client = server.spoofCpu();
          let hut = lands.hutForCpu(client);
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          archItem.shut();
          
          // Get addRec for `item` and `archItem`
          let result = await client.nextTell();
          
          return [
            [ 'result is Object', () => U.isType(result, Object) ],
            [ 'is version 1', () => result.version === 1 ],
            [ 'is update command', () => result.command === 'update' ],
            [ 'result content is Object', () => U.isType(result.content, Object) ],
            [ 'content addRec is Object', () => U.isType(result.content.addRec, Object) ],
            [ 'adds 1 Rec', () => result.content.addRec.toArr(v => v).length === 1 ],
            [ 'adds correct Rec', () => result.content.addRec.find((v, k) => k === item.uid) ],
          ];
          
        });
        
      });
      
    });
    
    Keep(k, 'aboveAndBelow').contain(k => {
      
      let mock2PartyData = null;
      k.sandwich.before = async () => {
        
        // `serverAbove` wobbles cpus representing Belows
        // `serverBelow` wobbles a single client representing its Above
        
        let { trt, server: serverAbove, lands } = testData;
        
        let addClientBelow = (name, fn=null) => {
          
          let recTypes = { ...rt, ...trt };
          
          // Combine hinterlands RecTypes (`rt`) along with RecTypes for tests (`trt`)
          let state = { version: 0, recTypes, allRecs: Map(), server: null, holds: [] };
          state.createRec = (type, ...args) => {
            let rec = recTypes[type].create(...args);
            state.allRecs.set(rec.uid, rec);
            rec.shutWob().hold(() => state.allRecs.rem(rec.uid));
            return rec;
          };
          state.arch = rt.arch.create({ uid: '!arch' });
          
          let cpuIdCnt = testyNames.length - 1;
          let serverBelow = state.server = U.Wob();
          serverBelow.desc = 'Spoofy Below server for hinterlands tests';
          serverBelow.cost = 50;
          serverBelow.decorateConn = aboveConn => {
            aboveConn.hear = U.Wob();
            aboveConn.hear.hold(v => { if (!U.isType(v, Array)) throw new Error('Need to use Arrays for "tell"'); });
            aboveConn.tellWob = U.Wob();
            aboveConn.tell = (...args) => aboveConn.tellWob.wobble(...args);
            aboveConn.nextHear = async (fn=null, force='force') => {
              let timeout = null;
              let hold = null;
              let prm = new Promise(rsv => {
                hold = aboveConn.hear.hold((...args) => { 'Resolves "nextHear" promise'; rsv(...args); });
                timeout = setTimeout(() => rsv([ { force }, () => { throw new Error('No reply available!'); } ]), 20);
              });
              
              if (fn) fn();
              
              let [ msg, reply ] = await prm; // We ignore "reply" here
              clearTimeout(timeout);
              hold.shut();
              
              return msg;
            };
          };
          serverBelow.spoofCpu = () => lands.pool.makeCpuConn(serverBelow, conn => {
            conn.cpuId = testyNames[cpuIdCnt--];
            conn.spoofForTest = 'spoofy!'
          });
          serverBelow.shut = () => serverBelow.spoofCpu = null;
          
          if (fn) fn(state, serverBelow);
          
          state.fresh = () => {
            
            state.version = 0;
            state.lands = lands;
            state.arch = rt.arch.create({ uid: '!arch' });
            state.allRecs = Map([ [ state.arch.uid, state.arch ] ]);
            state.holds.forEach(hold => !hold.isShut() && hold.shut()); // Close any open holds
            
            // `aboveClient` is `serverAbove`'s representation of Below
            let aboveClient = serverAbove.spoofCpu();
            
            // `belowClient` is `serverBelow`'s only Client, and representation of Above
            // Generated by the function just above!
            let belowClient = serverBelow.spoofCpu();
            
            state.tell = (msg) => {
              if (!U.isType(msg, Object)) throw new Error(`Pls provide Object, not ${U.nameOf(msg)}`);
              belowClient.tell([ msg, (...args) => aboveClient.tell(...args) ]);
            };
            
            // Here's how messages from Above hit Below! Note that a "reply" function
            // is included
            state.holds.push(aboveClient.tellWob.hold(msg => {
              belowClient.hear.wobble([ msg, (...args) => aboveClient.tell(...args) ])
            }));
            
            // Here's how messages from Below hit Above. Note that any "reply" function
            // will already be included in `args`
            state.holds.push(belowClient.tellWob.hold(msg => {
              aboveClient.hear.wobble(U.isType(msg, Array) ? msg : [ msg, null ]);
            }));
            
            return [ aboveClient, belowClient ];
            
          };
          
          return state;
          
        };
        
        lands.modifyRec = (rec, newVal) => lands.tell({ command: 'modifyRec', uid: rec.uid, val: newVal });
        
        mock2PartyData = { addClientBelow, above: testData };
        
      };
      k.sandwich.after = () => {
      };
      
      Keep(k, 'connectedness', async () => {
        
        let { trt, server: serverAbove, lands } = mock2PartyData.above;
        let below1 = mock2PartyData.addClientBelow('testBelow1');
        let [ aboveClient, belowClient ] = below1.fresh();
        
        let heard = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
        
        return { msg: 'heard something', result: !U.isType(heard, Object) || !heard.has('force') };
        
      });
      
      Keep(k, 'getInitHtml', async () => {
        
        let { trt, server: serverAbove, lands } = mock2PartyData.above;
        let below1 = mock2PartyData.addClientBelow('testBelow1');
        let [ aboveClient, belowClient ] = below1.fresh();
        
        let heardData = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
        
        if (!U.isType(heardData, String)) {
          console.log('\n\n\n\n');
          console.log('TYPE:', U.nameOf(heardData));
          console.log('DATA:', heardData);
          console.log('\n\n\n\n');
        }
        
        return [
          [ 'response is String', () => U.isType(heardData, String) ],
          [ 'response looks like html', () => heardData.hasHead('<!DOCTYPE html>') ]
        ];
        
      });
      
      Keep(k, 'mockBelow').contain(k => {
        
        let gatherAllRecs = (rec, allRecs={}) => {
          
          if (allRecs.has(rec.uid)) return allRecs;
          allRecs[rec.uid] = rec;
          
          // Include all MemberRecs
          rec.members.forEach(mem => gatherAllRecs(mem, allRecs));
          
          // Include all GroupRecs
          rec.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(rec0 => gatherAllRecs(rec0, allRecs)));
          
          return allRecs;
          
        };
        let aboveBelowDiff = (lands, state) => {
          
          let [ aboveRecs, belowRecs ] = [ lands.arch, state.arch ].map(r => gatherAllRecs(r));
          
          let onlyInAbove = aboveRecs.map((rec, uid) => belowRecs.has(uid) ? C.skip : rec);
          let onlyInBelow = belowRecs.map((rec, uid) => aboveRecs.has(uid) ? C.skip : rec);
          let valueMismatch = aboveRecs.toArr((rec, uid) =>
            (belowRecs.has(uid) && belowRecs[uid].value !== rec.value)
              ? { above: rec, below: belowRecs[uid] }
              : C.skip
          );
          let match = onlyInAbove.isEmpty() && onlyInBelow.isEmpty() && valueMismatch.isEmpty();
          
          return { onlyInAbove, onlyInBelow, valueMismatch, match };
          
        };
        k.sandwich.before = () => {
          
          // Wrap `addMockedClientBelow` so that information is not
          // just heard, but is actually processed (e.g. an "update"
          // command results in duplicate Recs getting created in our
          // spoofed Below)
          mock2PartyData.addMockedClientBelow = name => {
            
            return mock2PartyData.addClientBelow(name, state => {
              state.server.hold(client => client.hear.hold(([ msg, reply ]) => {
                
                // This happens whenever the Below hears anything
                
                if (U.isType(msg, String)) {
                  
                  if (msg.hasHead('<!DOCTYPE html>')) {
                    
                    let initData = parseInitData(msg);
                    if (initData) doUpdate(state, initData);
                    
                  }
                  
                } else if (U.isType(msg, Object)) {
                  
                  if (msg.has('command')) {
                    
                    if (msg.command === 'update') {
                      
                      doUpdate(state, msg);
                    
                    } else if (msg.command === 'error') {
                      
                      console.log('OH NO:', msg);
                      
                    } else {
                      
                      throw new Error(`Command not supported: "${msg.command}"`);
                      
                    }
                    
                  }
                  
                }
                
              }));
            });
            
          };
          
        };
        k.sandwich.after = () => {};
        
        Keep(k, 'getInitHtml', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          let [ aboveClient, belowClient ] = below1.fresh();
          
          let heardData = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          if (!U.isType(heardData, String)) {
            console.log('\n\n\n\n');
            console.log('TYPE:', U.nameOf(heardData));
            console.log('DATA:', heardData);
            console.log('\n\n\n\n');
          }
          
          return [
            [ 'response is String', () => U.isType(heardData, String) ],
            [ 'response looks like html', () => heardData.hasHead('<!DOCTYPE html>') ]
          ];
          
        });
        
        Keep(k, 'getInitAndSyncRaw', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          let [ aboveClient, belowClient ] = below1.fresh();
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              
              let [ _, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
              
            }));
            
          });
          
          let heardData1 = await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          let heardData2 = await belowClient.nextHear();
          
          return [
            [ 'got Object', () => U.isType(heardData2, Object) ],
            [ 'object version 1', () => heardData2.version === 1 ],
            [ 'command is "update"', () => heardData2.command === 'update' ],
            [ 'command content is Object', () => U.isType(heardData2.content, Object) ],
            [ 'content addRec is Object', () => U.isType(heardData2.content.addRec, Object) ],
            [ 'adds 2 Recs', () => heardData2.content.addRec.toArr(v => v).length === 2 ],
            [ 'adds item', () => heardData2.content.addRec.find((v, uid) => uid === item.uid) ],
            [ 'adds archItem', () => heardData2.content.addRec.find((v, uid) => uid === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'getInitAndSync', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          let [ aboveClient, belowClient ] = below1.fresh();
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          await belowClient.nextHear();
          
          return [
            [ 'synced archItem', () => below1.arch.relWob(trt.archItem, 0).toArr(v => v).length === 1 ],
            [ 'synced item', () => {
              let archItemBelow = below1.arch.relWob(trt.archItem, 0).toArr(v => v)[0];
              let itemBelow = archItemBelow.members.find(rec => rec.type === trt.item);
              if (!itemBelow) return false;
              else            itemBelow = itemBelow[0];
              return itemBelow && itemBelow.uid === item.uid && itemBelow !== item;
              //below1.arch.relWob(trt.archItem, 0).toArr(v => v).find(v => 1).members.find(v => v.type.name === 'item') ]
            }]
          ];
          
        });
        
        Keep(k, 'multipleGetInit', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              hut.followRec(archItem);
              hut.followRec(item);
            }));
          });
          
          // Reset a bunch of times
          let [ aboveClient, belowClient ] = [ null, null ];
          for (let i = 0; i < 10; i++) {
            [ aboveClient, belowClient ] = below1.fresh();
            below1.tell({ command: 'getInit' })
            await belowClient.nextHear();
          }
          
          let item = lands.createRec('item', { value: 'item!' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          await belowClient.nextHear();
          
          return [
            [ 'synced archItem', () => below1.arch.relWob(trt.archItem, 0).toArr(v => v).length === 1 ],
            [ 'synced item', () => {
              let archItemBelow = below1.arch.relWob(trt.archItem, 0).toArr(v => v)[0];
              let itemBelow = archItemBelow.members.find(rec => rec.type === trt.item);
              return itemBelow && itemBelow[0].uid === item.uid && itemBelow[0] !== item;
            }]
          ];
          
        });
        
        Keep(k, 'updSync', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let [ aboveClient, belowClient ] = below1.fresh();
          
          await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          let item = lands.createRec('item', { value: 'item1' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          await belowClient.nextHear();
          
          item.modify(v => `${v}-modified`);
          
          await belowClient.nextHear();
          
          let diff = aboveBelowDiff(lands, below1);
          return [
            [ 'diff not empty', () => !diff.match ],
            [ 'above is superset of below', () => diff.onlyInBelow.isEmpty() ],
            [ 'above has 2 extra Recs', () => diff.onlyInAbove.toArr(v => v).length === 2 ],
            [ 'only above has hut', () => diff.onlyInAbove.find(rec => rec.type.name === 'hut') ],
            [ 'only above has archHut', () => diff.onlyInAbove.find(rec => rec.type.name === 'archHut') ]
          ];
          
        });
        
        Keep(k, 'remSyncRaw', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let [ aboveClient, belowClient ] = below1.fresh();
          let item, archItem;
          
          let v0 = await belowClient.nextHear();
          
          let v1 = await belowClient.nextHear(() => {
            item = lands.createRec('item', { value: 'item1' });
            archItem = lands.createRec('archItem', {}, lands.arch, item);
          });
          
          let sync = await belowClient.nextHear(() => item.shut());
          
          return [
            [ 'sync is Object', () => U.isType(sync, Object) ],
            [ 'sync is version 2', () => sync.version === 2 ],
            [ 'sync command is "update"', () => sync.command === 'update' ],
            [ 'sync content is Object', () => U.isType(sync.content, Object) ],
            [ 'sync does remRec', () => U.isType(sync.content.remRec, Object) ],
            [ 'sync rems 2 Recs', () => sync.content.remRec.toArr(v => v).length === 2 ],
            [ 'sync rems item', () => sync.content.remRec.find((r, uid) => uid === item.uid) ],
            [ 'sync rems archItem', () => sync.content.remRec.find((r, uid) => uid === archItem.uid) ]
          ];
          
        });
        
        Keep(k, 'remSync', async () => {
          
          let { trt, server: serverAbove, lands } = mock2PartyData.above;
          let below1 = mock2PartyData.addMockedClientBelow('testBelow1');
          
          HorzScope(lands.arch.relWob(rt.archHut, 0), (dep, archHut) => {
            let [ arch, hut ] = archHut.members;
            dep(HorzScope(arch.relWob(trt.archItem, 0), (dep, archItem) => {
              let [ _, item ] = archItem.members;
              hut.followRec(item);
              hut.followRec(archItem);
            }));
          });
          
          let [ aboveClient, belowClient ] = below1.fresh();
          
          await belowClient.nextHear(() => below1.tell({ command: 'getInit' }));
          
          let item = lands.createRec('item', { value: 'item1' });
          let archItem = lands.createRec('archItem', {}, lands.arch, item);
          
          await belowClient.nextHear();
          
          item.shut();
          
          let remResult = await belowClient.nextHear();
          
          let diff = aboveBelowDiff(lands, below1);
          
          return [
            [ 'archItem removed', () => below1.arch.relWob(trt.archItem, 0).size() === 0 ],
            [ 'above is superset of below', () => diff.onlyInBelow.isEmpty() ],
            [ 'above has 2 extra Recs', () => diff.onlyInAbove.toArr(v => v).length === 2 ],
            [ 'only above has hut', () => diff.onlyInAbove.find(rec => rec.type.name === 'hut') ],
            [ 'only above has archHut', () => diff.onlyInAbove.find(rec => rec.type.name === 'archHut') ],
            [ 'no value mismatches', () => diff.valueMismatch.isEmpty() ]
          ];
          
        });
        
        Keep(k, 'modifyRec', async () => {
          
          return { result: true };
          
        });
        
      });
      
    });
    
  });
  keep.formatError = err => foundation.formatError(err);
  
  return keep.showResults(foundation, args);
  
};
