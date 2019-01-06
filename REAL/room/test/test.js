U.buildRoom({
  name: 'test',
  innerRooms: [ 'hinterlands', 'record', 'real' ],
  build: (foundation, hinterlands, record, real) => {
    
    let { Record } = record;
    let { Lands, LandsRecord, Way, Hut, relLandsWays, relLandsRecs, relLandsHuts } = hinterlands;
    
    let User = U.inspire({ name: 'User', insps: { LandsRecord }, methods: (insp, Insp) => ({
      init: function({ uid, lands }) {
        insp.LandsRecord.init.call(this, { uid, lands });
        this.move = U.Wobbly({ value: null });
      }
    })});
    
    let rel = {
      userHut:        Record.relate11(Record.stability.dynamic, User, Hut, 'userHut')
    };
    
    return {
      open: async () => {
        console.log('Init test...');
        
        let lands = U.lands = Lands({
          foundation,
          commands: Lands.defaultCommands.map(v => v),
          records: [ LandsRecord, User ],
          relations: rel.toArr(v => v),
          getRecsForHut: (lands, hut) => lands.getInnerVal(relLandsRecs)
        });
        
        /// {ABOVE=
        lands.commands.gain({
          score: async (lands, hut, msg) => {
            let user = hut.getInnerVal(rel.userHut);
            user.modify(v => v.gain({ score: v.score + 1 }));
            
            lands.getInnerVal(relLandsHuts).forEach(hut => hut.informBelow());
          }
        });
        
        // Make a User for each Hut
        lands.getInnerWob(relLandsHuts).hold(({ add={}, rem={} }) => {
          
          add.forEach(hut => {
            let user = User({ lands });
            user.attach(rel.userHut, hut);
            user.wobble({ term: hut.getTerm(), score: 0 });
          });
          
        });
        
        /// =ABOVE} {BELOW=
        
        let { Real } = real;
        
        let myUser = U.Wobbly({ value: null });
        let otherUsers = U.DeltaWob({ value: {} });
        
        lands.getInnerWob(relLandsRecs).hold(({ add={}, rem={} }) => {
          
          add.forEach((rec, uid) => {
            if (!rec.isInspiredBy(User)) return;
            rec.hold(v => (v && v.term === U.hutTerm) ? myUser.wobble(rec) : null);
          });
          
          rem.forEach((rec, uid) => {
            if (myUser.value && myUser.value.uid === uid) myUser.wobble(null);
          });
          
          otherUsers.wobble({
            add: add.map(rec => rec.isInspiredBy(User) ? rec : C.skip),
            rem: rem.map(rec => rec.isInspiredBy(User) ? rec : C.skip)
          });
          
        });
        
        let genRoot = () => {
          let root = new Real({ isRoot: true, flag: 'root' });
          
          let holdMyUserReal = root.addReal(Real({ flag: 'my' }));
          let myUserReal = null;
          holdMyUserReal.setSize(500, 50);
          holdMyUserReal.setLoc(0, -150);
          myUser.hold(userRec => {
            if (myUserReal) { myUserReal.rem(); myUserReal = null; }
            if (userRec) myUserReal = holdMyUserReal.addReal(genUser(userRec));
          });
          
          let holdOtherUserReals = root.addReal(Real({ flag: 'other' }));
          let otherUserReals = {};
          holdOtherUserReals.setSize(500, 300);
          holdOtherUserReals.setLoc(0, 50);
          holdOtherUserReals.setWindowlike(true);
          otherUsers.hold(({ add={}, rem={} }) => {
            add.forEach((userRec, uid) => {
              otherUserReals[uid] = holdOtherUserReals.addReal(genUser(userRec));
              
              // If a userRec changes, the order may change!
              userRec.hold(v => {
                let sortedReals = otherUserReals.toArr(v => v).sort((r1, r2) => r2.getVal('score') - r1.getVal('score'));
                sortedReals.forEach((real, i) => real.setLoc(0, -125 + (i * 40)));
              });
            });
            rem.forEach((userRec, uid) => { otherUserReals[uid].rem(); delete otherUserReals[uid]; });
          });
          
          let clicker = root.addReal(Real({ flag: 'click' }));
          clicker.setSize(80, 80);
          clicker.setLoc(300, 0);
          clicker.setText('SCORE!');
          clicker.interactWob.hold(active => {
            if (!active) return;
            lands.tell({ command: 'score' });
          });
          
          return root;
        };
        let genUser = userRec => {
          let userReal = Real({ flag: 'user' });
          userReal.setSize(480, 30);
          userReal.setVal('score', 0);
          userRec.hold(v => {
            userReal.setText(v ? JSON.stringify(v) : '- unknown -');
            userReal.setVal('score', v ? v.score : 0);
          });
          myUser.hold(userRec0 => userReal.setColour(userRec0 !== userRec ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 100, 0, 0.7)'));
          return userReal;
        };
        
        U.real = genRoot();
        
        /// =BELOW}
        
        let way = Way({ lands, makeServer: () => foundation.makeHttpServer() }); // host: 'localhost', port: 80 });
        lands.attach(relLandsWays, way);
        await lands.open();
      }
    };
    
  }
});
