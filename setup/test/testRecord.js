require('../foundationNodeJs.js');
require('../foundationBrowser.js');
let { FoundationNodejs, FoundationBrowser } = U.setup;
let { Keep } = require('./hutkeeping.js');

module.exports = async (args, foundationInsps) => {
  
  let foundation = U.foundation = FoundationNodejs();
  
  let recordRoomForNodeJs = await Promise(resolve => foundation.raise({
    settle: 'testRecord.above',
    hut: {
      name: 'testRecord',
      innerRooms: [ 'record' ],
      build: (foundation, record) => ({ open: () => resolve(record) })
    }
  }));
  
  let { recTyper, Rec } = recordRoomForNodeJs;
  let { Hog, Wob } = U;
  
  let keep = Keep(null, 'record').contain(k => {
    
    let setup = () => {
      let { rt, add } = recTyper();
      add('rec', Rec);
      add('lnk', Rec, '11', rt.rec, rt.rec);
      add('recX', Rec);
      add('recY', Rec);
      add('recZ', Rec);
      add('lnkXY', Rec, '11', rt.recX, rt.recY);
      add('lnkYZ', Rec, '11', rt.recY, rt.recZ);
      add('lnkZX', Rec, '11', rt.recZ, rt.recX);
      return rt;
    };
    
    Keep(k, 'rel11').contain(k => {
      
      Keep(k, 'circular').contain(k => {
        
        Keep(k, 'attach1', () => {
          let rt = setup();
          let rec1 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec1);
          return { msg: 'no error', result: true };
        });
        
        Keep(k, 'attach2', () => {
          
          let rt = setup();
          let rec1 = rt.rec.create();
          
          let wobRec1 = null;
          let wobRec2 = null;
          rec1.relWob(rt.lnk, 0).hold(rec => wobRec1 = rec);
          rec1.relWob(rt.lnk, 1).hold(rec => wobRec2 = rec);
          
          let lnk = rt.lnk.create({}, rec1, rec1);
          
          return [
            [ 'index 0 wobbled', () => !!wobRec1 ],
            [ 'index 1 wobbled', () => !!wobRec2 ],
            [ 'index 0 correct', () => wobRec1 === lnk ],
            [ 'index 1 correct', () => wobRec2 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec1 ]
          ];
          
        });
        
        Keep(k, 'attach3', () => {
          let rt = setup();
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          return { msg: 'no error', result: true };
        });
        
        Keep(k, 'attach4', () => {
          
          let rt = setup();
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          
          let rec1Ind0 = null;
          let rec1Ind1 = null;
          let rec2Ind0 = null;
          let rec2Ind1 = null;
          
          rec1.relWob(rt.lnk, 0).hold(rec => rec1Ind0 = rec);
          rec1.relWob(rt.lnk, 1).hold(rec => rec1Ind1 = rec);
          rec2.relWob(rt.lnk, 0).hold(rec => rec2Ind0 = rec);
          rec2.relWob(rt.lnk, 1).hold(rec => rec2Ind1 = rec);
          
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          return [
            [ 'rec1 ind0 wobbled', () => !!rec1Ind0 ],
            [ 'rec1 ind1 untouched', () => !rec1Ind1 ],
            [ 'rec2 ind0 untouched', () => !rec2Ind0 ],
            [ 'rec2 ind1 wobbled', () => !!rec2Ind1 ],
            [ 'rec1 ind0 correct', () => rec1Ind0 === lnk ],
            [ 'rec2 ind1 correct', () => rec2Ind1 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec2 ]
          ];
          
        });
        
        Keep(k, 'detach1', () => {
          let rt = setup();
          let rec1 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec1);
          
          let didWobShut = false;
          lnk.shutWob().hold(() => didWobShut = true);
          
          lnk.shut();
          
          return [
            [ 'link is shut', () => lnk.isShut() ],
            [ 'shut wobbled', () => didWobShut ],
            [ 'rec1 ind 0 no rel', () => rec1.relWob(rt.lnk, 0).toArr(v => v).isEmpty() ],
            [ 'rec1 ind 1 no rel', () => rec1.relWob(rt.lnk, 1).toArr(v => v).isEmpty() ]
          ];
          
        });
        
        Keep(k, 'detach2', () => {
          let rt = setup();
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          let didWobShut = false;
          lnk.shutWob().hold(() => didWobShut = true);
          
          lnk.shut();
          
          return [
            [ 'link is shut', () => lnk.isShut() ],
            [ 'shut wobbled', () => didWobShut ],
            [ 'rec1 ind 0 no rel', () => rec1.relWob(rt.lnk, 0).toArr(v => v).isEmpty() ],
            [ 'rec1 ind 1 no rel', () => rec1.relWob(rt.lnk, 1).toArr(v => v).isEmpty() ],
            [ 'rec2 ind 0 no rel', () => rec2.relWob(rt.lnk, 0).toArr(v => v).isEmpty() ],
            [ 'rec2 ind 1 no rel', () => rec2.relWob(rt.lnk, 1).toArr(v => v).isEmpty() ]
          ];
        });
        
        Keep(k, 'enforceCardinality1', () => {
          
          let rt = setup();
          let rec1 = rt.rec.create();
          
          let wobRec1 = null;
          let wobRec2 = null;
          rec1.relWob(rt.lnk, 0).hold(rec => wobRec1 = rec);
          rec1.relWob(rt.lnk, 1).hold(rec => wobRec2 = rec);
          
          let lnk = rt.lnk.create({}, rec1, rec1);
          
          try {
            let lnk2 = rt.lnk.create({}, rec1, rec1);
            return { msg: 'cardinality enforced', result: false };
          } catch(err) {}
          
          return [
            [ 'index 0 wobbled', () => !!wobRec1 ],
            [ 'index 1 wobbled', () => !!wobRec2 ],
            [ 'index 0 correct', () => wobRec1 === lnk ],
            [ 'index 1 correct', () => wobRec2 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec1 ]
          ];
          
        });
        
        Keep(k, 'enforceCardinality2', () => {
          
          let rt = setup();
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          
          let rec1Ind0 = null;
          let rec1Ind1 = null;
          let rec2Ind0 = null;
          let rec2Ind1 = null;
          
          rec1.relWob(rt.lnk, 0).hold(rec => rec1Ind0 = rec);
          rec1.relWob(rt.lnk, 1).hold(rec => rec1Ind1 = rec);
          rec2.relWob(rt.lnk, 0).hold(rec => rec2Ind0 = rec);
          rec2.relWob(rt.lnk, 1).hold(rec => rec2Ind1 = rec);
          
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          try {
            let lnk = rt.lnk.create({}, rec1, rec2);
            return { msg: 'cardinality enforced', result: false };
          } catch(err) {}
          
          return [
            [ 'rec1 ind0 wobbled', () => !!rec1Ind0 ],
            [ 'rec1 ind1 untouched', () => !rec1Ind1 ],
            [ 'rec2 ind0 untouched', () => !rec2Ind0 ],
            [ 'rec2 ind1 wobbled', () => !!rec2Ind1 ],
            [ 'rec1 ind0 correct', () => rec1Ind0 === lnk ],
            [ 'rec2 ind1 correct', () => rec2Ind1 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec2 ]
          ];
          
        });
        
        Keep(k, 'squad1', () => {
          
          let rt = setup();
          
          let wobRec1 = null;
          let wobRec2 = null;
          
          let rec1 = rt.rec.create();
          rec1.relWob(rt.lnk, 0).hold(rec => wobRec1 = rec);
          rec1.relWob(rt.lnk, 1).hold(rec => wobRec2 = rec);
          
          let squad = U.WobSquad();
          let lnk = rt.lnk.create({ squad }, rec1, rec1);
          
          if (wobRec1 || wobRec2) return { msg: 'squad prevents wobble', result: false };
          
          squad.complete();
          
          return [
            [ 'index 0 wobbled', () => !!wobRec1 ],
            [ 'index 1 wobbled', () => !!wobRec2 ],
            [ 'index 0 correct', () => wobRec1 === lnk ],
            [ 'index 1 correct', () => wobRec2 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec1 ]
          ];
          
        });
        
        Keep(k, 'squad2', () => {
          
          let rt = setup();
          
          let wobRec1 = null;
          let wobRec2 = null;
          
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          rec1.relWob(rt.lnk, 0).hold(rec => wobRec1 = rec);
          rec2.relWob(rt.lnk, 1).hold(rec => wobRec2 = rec);
          
          let squad = U.WobSquad();
          let lnk = rt.lnk.create({ squad }, rec1, rec2);
          
          if (wobRec1 || wobRec2) return { msg: 'squad prevents wobble', result: false };
          
          squad.complete();
          
          return [
            [ 'index 0 wobbled', () => !!wobRec1 ],
            [ 'index 1 wobbled', () => !!wobRec2 ],
            [ 'index 0 correct', () => wobRec1 === lnk ],
            [ 'index 1 correct', () => wobRec2 === lnk ],
            [ 'rel is correct', () => lnk.members[0] === rec1 && lnk.members[1] === rec2 ]
          ];
          
        });
        
      });
      
      Keep(k, 'VertScope').contain(k => {
        
        Keep(k, 'trackRecWobble', () => {
          
          let rt = setup();
          let rec = rt.rec.create();
          let didWobble = false;
          
          let recScope = U.VertScope();
          recScope.hold(() => didWobble = true);
          recScope.trackWob(rec);
          
          return { result: didWobble };
          
        });
        
        Keep(k, 'trackShutRecNoWobble', () => {
          
          let rt = setup();
          let rec = rt.rec.create();
          rec.shut();
          let didWobble = false;
          
          let recScope = U.VertScope();
          recScope.hold(() => didWobble = true);
          recScope.trackWob(rec);
          
          return { result: !didWobble };
          
        });
        
        Keep(k, 'dive1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(rec => rec.relWob(rt.lnk, 0));
          
          let didWobble = false;
          scp2.hold(() => didWobble = true);
          
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          scp1.trackWob(rec1);
          
          return { result: didWobble };
          
        });
        
        Keep(k, 'dive2', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(rec => rec.relWob(rt.lnk, 0));
          
          let didWobble = false;
          scp2.hold(() => didWobble = true);
          
          let rec1 = rt.rec.create();
          scp1.trackWob(rec1);
          
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          return { result: didWobble };
          
        });
        
        Keep(k, 'dive3', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(rec => rec.relWob(rt.lnk, 0));
          let scp3 = scp2.dive(lnk => U.WobVal(lnk.members[1]));
          
          let wobbledVal = null;
          scp3.hold((dep, val) => wobbledVal = val);
          
          let rec1 = rt.rec.create();
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          scp1.trackWob(rec1);
          
          return { result: wobbledVal[0] === rec2 };
          
        });
        
        Keep(k, 'dive4', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(rec => rec.relWob(rt.lnk, 0));
          let scp3 = scp2.dive(lnk => U.WobVal(lnk.members[1]));
          
          let wobbledVal = null;
          scp3.hold((dep, val) => wobbledVal = val);
          
          let rec1 = rt.rec.create();
          scp1.trackWob(rec1);
          
          let rec2 = rt.rec.create();
          let lnk = rt.lnk.create({}, rec1, rec2);
          
          return { result: wobbledVal[0] === rec2 };
          
        });
        
        Keep(k, 'dive5', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          scp1.trackWob(recX);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'dive6', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          scp1.trackWob(recX);
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'dive7', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'shut1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let didWobble = false;
          scp5.hold(() => didWobble = true);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          lnkXY.shut(); // Cut off the VertScope chain
          
          let recZ = rt.recZ.create();
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          
          return { result: !didWobble };
          
        });
        
        Keep(k, 'shut2', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let didWobble = false;
          scp5.hold(() => didWobble = true);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          recY.shut(); // Cut off the VertScope chain
          
          let recZ = rt.recZ.create();
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          
          return { result: !didWobble };
          
        });
        
        Keep(k, 'depShut1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let didShutDep = false;
          scp5.hold((dep, val) => dep(Hog(() => didShutDep = true)));
          
          let recX = rt.recX.create();
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          
          scp1.trackWob(recX);
          
          if (didShutDep) return { result: false, msg: 'didn\'t shut too early' };
          
          lnkXY.shut();
          
          return { result: didShutDep, msg: 'dep was shut' };
          
        });
        
      });
      
    });
    
    Keep(k, 'rel1M').contain(k => {
      
      let setup = () => {
        let { rt, add } = recTyper();
        add('rec', Rec);
        add('lnk', Rec, '1M', rt.rec, rt.rec);
        add('recX', Rec);
        add('recY', Rec);
        add('recZ', Rec);
        add('lnkXY', Rec, '1M', rt.recX, rt.recY);
        add('lnkYZ', Rec, '1M', rt.recY, rt.recZ);
        add('lnkZX', Rec, '1M', rt.recZ, rt.recX);
        return rt;
      };
      
      Keep(k, 'VertScope').contain(k => {
        
        Keep(k, 'dive1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          scp1.trackWob(recX);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'dive2', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          scp1.trackWob(recX);
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'dive3', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          let scp6 = scp5.dive(recZ => recZ.relWob(rt.lnkZX, 0));
          let scp7 = scp6.dive(lnkZX => U.WobVal(lnkZX.members[1]));
          
          let wobbledVal = null;
          scp7.hold((dep, val) => wobbledVal = val);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let recZ = rt.recZ.create();
          let recXFin = rt.recX.create();
          
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          let lnkZX = rt.lnkZX.create({}, recZ, recXFin);
          
          return { result: wobbledVal[0] === recXFin };
          
        });
        
        Keep(k, 'shut1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let didWobble = false;
          scp5.hold(() => didWobble = true);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          lnkXY.shut(); // Cut off the VertScope chain
          
          let recZ = rt.recZ.create();
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          
          return { result: !didWobble };
          
        });
        
        Keep(k, 'shut2', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let didWobble = false;
          scp5.hold(() => didWobble = true);
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY = rt.recY.create();
          let lnkXY = rt.lnkXY.create({}, recX, recY);
          recY.shut(); // Cut off the VertScope chain
          
          let recZ = rt.recZ.create();
          let lnkYZ = rt.lnkYZ.create({}, recY, recZ);
          
          return { result: !didWobble };
          
        });
        
        Keep(k, 'depShut1', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let wobbledRecs = Set();
          let shutRecs = Set();
          scp5.hold((dep, [ rec ]) => { wobbledRecs.add(rec); dep(Hog(() => shutRecs.add(rec))); });
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY1 = rt.recY.create();
          let recY2 = rt.recY.create();
          let recY3 = rt.recY.create();
          
          let recZ1 = rt.recZ.create();
          let recZ2 = rt.recZ.create();
          let recZ3 = rt.recZ.create();
          
          let lnkXY1 = rt.lnkXY.create({}, recX, recY1);
          let lnkXY2 = rt.lnkXY.create({}, recX, recY2);
          let lnkXY3 = rt.lnkXY.create({}, recX, recY3);
          
          let lnkYZ1 = rt.lnkYZ.create({}, recY1, recZ1);
          let lnkYZ2 = rt.lnkYZ.create({}, recY2, recZ2);
          let lnkYZ3 = rt.lnkYZ.create({}, recY3, recZ3);
          
          lnkXY1.shut();
          lnkYZ2.shut();
          
          return [
            [ 'wobbled 3 recs', () => wobbledRecs.size === 3 ],
            [ 'recZ1 deps shut', () => shutRecs.has(recZ1) ],
            [ 'recZ2 deps shut', () => shutRecs.has(recZ2) ],
            [ 'recZ3 deps still open', () => !shutRecs.has(recZ3) ]
          ];
          
        });
        
        Keep(k, 'depShut2', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let wobbledRecs = Set();
          let shutRecs = Set();
          scp5.hold((dep, [ rec ]) => { wobbledRecs.add(rec); dep(Hog(() => shutRecs.add(rec))); });
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY1 = rt.recY.create();
          let recY2 = rt.recY.create();
          let recY3 = rt.recY.create();
          
          let recZ1 = rt.recZ.create();
          let recZ2 = rt.recZ.create();
          let recZ3 = rt.recZ.create();
          
          let lnkYZ1 = rt.lnkYZ.create({}, recY1, recZ1);
          let lnkYZ2 = rt.lnkYZ.create({}, recY2, recZ2);
          let lnkYZ3 = rt.lnkYZ.create({}, recY3, recZ3);
          
          let lnkXY1 = rt.lnkXY.create({}, recX, recY1);
          let lnkXY2 = rt.lnkXY.create({}, recX, recY2);
          let lnkXY3 = rt.lnkXY.create({}, recX, recY3);
          
          recY1.shut();
          recZ2.shut();
          
          return [
            [ 'wobbled 3 recs', () => wobbledRecs.size === 3 ],
            [ 'recZ1 deps shut', () => shutRecs.has(recZ1) ],
            [ 'recZ2 deps shut', () => shutRecs.has(recZ2) ],
            [ 'recZ3 deps still open', () => !shutRecs.has(recZ3) ]
          ];
          
        });
        
        Keep(k, 'depShut3', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let wobbledRecs = Set();
          let shutRecs = Set();
          scp5.hold((dep, [ rec ]) => { wobbledRecs.add(rec); dep(Hog(() => shutRecs.add(rec))); });
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY1 = rt.recY.create();
          let recY2 = rt.recY.create();
          let recY3 = rt.recY.create();
          
          let recZ1 = rt.recZ.create();
          let recZ2 = rt.recZ.create();
          let recZ3 = rt.recZ.create();
          
          let lnkYZ1 = rt.lnkYZ.create({}, recY1, recZ1);
          let lnkYZ2 = rt.lnkYZ.create({}, recY2, recZ2);
          let lnkYZ3 = rt.lnkYZ.create({}, recY3, recZ3);
          
          let lnkXY1 = rt.lnkXY.create({}, recX, recY1);
          let lnkXY2 = rt.lnkXY.create({}, recX, recY2);
          let lnkXY3 = rt.lnkXY.create({}, recX, recY3);
          
          recX.shut();
          
          return [
            [ 'wobbled 3 recs', () => wobbledRecs.size === 3 ],
            [ 'recZ1 deps shut', () => shutRecs.has(recZ1) ],
            [ 'recZ2 deps shut', () => shutRecs.has(recZ2) ],
            [ 'recZ3 deps shut', () => shutRecs.has(recZ3) ]
          ];
          
        });
        
        Keep(k, 'depShut4', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let wobbledRecs = Set();
          let shutRecs = Set();
          scp5.hold((dep, [ rec ]) => { wobbledRecs.add(rec); dep(Hog(() => shutRecs.add(rec))); });
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY1 = rt.recY.create();
          let recY2 = rt.recY.create();
          let recY3 = rt.recY.create();
          
          let recZ1 = rt.recZ.create();
          let recZ2 = rt.recZ.create();
          let recZ3 = rt.recZ.create();
          
          let lnkYZ1 = rt.lnkYZ.create({}, recY1, recZ1);
          let lnkYZ2 = rt.lnkYZ.create({}, recY2, recZ2);
          let lnkYZ3 = rt.lnkYZ.create({}, recY3, recZ3);
          
          let lnkXY1 = rt.lnkXY.create({}, recX, recY1);
          let lnkXY2 = rt.lnkXY.create({}, recX, recY2);
          let lnkXY3 = rt.lnkXY.create({}, recX, recY3);
          
          scp3.shut();
          
          return [
            [ 'wobbled 3 recs', () => wobbledRecs.size === 3 ],
            [ 'recZ1 deps shut', () => shutRecs.has(recZ1) ],
            [ 'recZ2 deps shut', () => shutRecs.has(recZ2) ],
            [ 'recZ3 deps shut', () => shutRecs.has(recZ3) ]
          ];
          
        });
        
        Keep(k, 'depShut5', () => {
          
          let rt = setup();
          
          let scp1 = U.VertScope();
          let scp2 = scp1.dive(recX => recX.relWob(rt.lnkXY, 0));
          let scp3 = scp2.dive(lnkXY => U.WobVal(lnkXY.members[1]));
          let scp4 = scp3.dive(recY => recY.relWob(rt.lnkYZ, 0));
          let scp5 = scp4.dive(lnkYZ => U.WobVal(lnkYZ.members[1]));
          
          let wobbledRecs = Set();
          let shutRecs = Set();
          scp5.hold((dep, [ rec ]) => { wobbledRecs.add(rec); dep(Hog(() => shutRecs.add(rec))); });
          
          let recX = rt.recX.create();
          scp1.trackWob(recX);
          
          let recY1 = rt.recY.create();
          let recY2 = rt.recY.create();
          let recY3 = rt.recY.create();
          
          let recZ1 = rt.recZ.create();
          let recZ2 = rt.recZ.create();
          let recZ3 = rt.recZ.create();
          
          let lnkYZ1 = rt.lnkYZ.create({}, recY1, recZ1);
          let lnkYZ2 = rt.lnkYZ.create({}, recY2, recZ2);
          let lnkYZ3 = rt.lnkYZ.create({}, recY3, recZ3);
          
          let lnkXY1 = rt.lnkXY.create({}, recX, recY1);
          let lnkXY2 = rt.lnkXY.create({}, recX, recY2);
          let lnkXY3 = rt.lnkXY.create({}, recX, recY3);
          
          scp1.shut();
          
          return [
            [ 'wobbled 3 recs', () => wobbledRecs.size === 3 ],
            [ 'recZ1 deps shut', () => shutRecs.has(recZ1) ],
            [ 'recZ2 deps shut', () => shutRecs.has(recZ2) ],
            [ 'recZ3 deps shut', () => shutRecs.has(recZ3) ]
          ];
          
        });
        
      });
      
    });
    
  });
  keep.formatError = err => foundation.formatError(err);
  
  return keep.showResults(foundation, args);
  
};
