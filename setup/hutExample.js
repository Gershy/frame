
U.buildRoom({
  name: 'exampleHut',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { AccessPath, Wob, WobVal, AggWobs } = U;
    let { Record, Relation } = record;
    let { Lands, LandsRecord, Way, Hut, rel: landsRel } = hinterlands;
    
    let heartbeatMs = 3 * 60 * 1000;
    
    let ExampleHut = U.inspire({ name: 'ExampleHut', insps: { LandsRecord } });
    
    let rel = {
    };
    
    let open = async () => {
      console.log('Init exampleHut...');
      
      let lands = U.lands = Lands({
        foundation,
        commands: {},
        records: [ ExampleHut ],
        relations: rel.toArr(v => v),
        heartbeatMs
      });
      
      AccessPath(WobVal(lands), async (dep, lands) => {
        
        /// {ABOVE=
        let exampleHut = dep(ExampleHut({ lands, value: 'ExampleHut' }));
        lands.attach(rel.landsExampleHut.fwd, exampleHut);
        
        dep(AccessPath(lands.relWob(landsRel.landsHuts.fwd), (dep, relHut) => {
          
          dep(relHut.rec.followRec(exampleHut));
          
        }));
        /// =ABOVE}
        
        /// {BELOW=
        let { Real } = real;
        
        let size = v => Math.round(v * 100);
        
        let rootReal = Real({ isRoot: true, flag: 'root' });
        rootReal.setColour('rgba(0, 0, 0, 1)');
        dep(Hog(() => rootReal.shut()));
        
        let scaleReal = rootReal.addReal(Real({ flag: 'scale' }));
        scaleReal.setSize(size(100));
        scaleReal.setColour('rgba(0, 0, 0, 0)');
        let scaleFac = 1 / size(100);
        let scaleFunc = () => {
          let { width, height } = document.body.getBoundingClientRect();
          let scaleAmt = (width <= height ? width : height) * scaleFac;
          scaleReal.setScale(scaleAmt);
        };
        window.addEventListener('resize', scaleFunc);
        scaleFunc();
        
        // TODO: `Lands` needs to be a LandsRecord, or needs an always-related LandsRecord
        // to serve as an entrypoint for Below
        // E.g. AccessPath(lands.clearing.relWob(appRel.relClearingExampleHut), (dep, { rec: exampleHut }) => { /* ... */ })
        await new Promise(r => setTimeout(r, 0));
        let exampleHut = null;
        for (let [ k, rec ] of lands.allRecs) if (rec.isInspiredBy(ExampleHut)) { exampleHut = rec; break; }
        
        dep(AccessPath(exampleHut ? WobVal(exampleHut) : Wob(), (dep, exampleHut) => {
          
          let titleReal = scaleReal.addReal(Real({ flag: 'title' }));
          titleReal.setSize(size(100));
          titleReal.setColour('rgba(0, 0, 0, 0)')
          titleReal.setTextSize(size(5));
          dep(Hog(() => titleReal.shut()));
          dep(exampleHut.hold(v => titleReal.setText(v)));
          
        }));
        
        /// =BELOW}
        
      });
      
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer() }));
      await lands.open();
    };
    
    return { open };
  }
});
