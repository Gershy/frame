U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Recs are data items with a number of properties, including relational properties
    
    let { Hog, Wob, WobVal, WobSquad } = U;
    
    let WobRecCrd1 = U.inspire({ name: 'WobRecCrd1', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.rec = null;
      },
      hold: function(holdFn) {
        if (this.rec) this.toHold(holdFn, this.rec); // Call immediately
        return insp.Wob.hold.call(this, holdFn);
      },
      wobble: function(rec) {
        if (!rec) throw new Error('Invalid rec for add');
        if (this.rec) throw new Error('Already add');
        this.rec = rec;
        insp.Wob.wobble.call(this, this.rec, ...this.rec.members);
        return Hog(() => { this.rec = null; });
      },
      size: function() { return this.hog ? 1 : 0; },
      toArr: function(fn) { return this.hog ? [ this.hog ].map(fn) : []; }
    })});
    let WobRecCrdM = U.inspire({ name: 'WobRecCrdM', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.recs = Map();
      },
      hold: function(holdFn) {
        this.recs.forEach(rec => this.toHold(holdFn, rec));
        return insp.Wob.hold.call(this, holdFn);
      },
      wobble: function(rec) {
        if (this.recs.has(rec.uid)) throw new Error('Already add');
        this.recs.set(rec.uid, rec);
        insp.Wob.wobble.call(this, rec, ...rec.members);
        return Hog(() => { this.recs.delete(rec.uid); });
      },
      size: function() { return this.recs.size; },
      toArr: function(fn) { return this.recs.toArr(fn); }
    })});
    
    let RecType = U.inspire({ name: 'RecType', insps: {}, methods: (insp, Insp) => ({
      
      init: function(name, RecCls=Rec, crd=null, ...memberTypes) {
        
        if (crd && crd.split('').find(v => v !== 'M' && v !== '1')) throw new Error(`Invalid cardinality: "${crd}"`);
        if (crd && crd.length !== memberTypes.length) throw new Error(`Invalid: cardinality "${crd}", but member types [${memberTypes.map(c => c.name).join(', ')}]`);
        
        this.name = name;
        this.RecCls = RecCls;
        this.crd = crd;
        this.memberTypes = memberTypes;
        
      },
      create: function(params={}, ...members) {
        
        members = members.toArr(v => v); // Will be handed off by reference. TODO: Is cloning necessary?
        
        if (members.length !== this.memberTypes.length)
          throw new Error(`RecType ${this.name} has ${this.memberTypes.length} MemberType(s), but tried to create with ${members.length}`);
        
        for (let i = 0; i < members.length; i++)
          if (members[i].type !== this.memberTypes[i])
            throw new Error(`RecType ${this.name} expects [${this.memberTypes.map(v => v.name).join(', ')}] but got [${deps.map(d => d.type.name).join(', ')}]`);
        
        let relRec = this.RecCls({ ...params, type: this, members });
        
        let squad = params.has('squad') ? params.squad : null;
        let defAgg = !squad;
        if (defAgg) squad = WobSquad();
        
        let wobs = members.map((m, ind) => m.relWob(this, ind));
        let err = U.safe(() => {
          
          // Wobble all Wobs
          wobs.forEach(w => {
            // Add the Rec
            let addHog = squad.wobble(w, relRec);
            
            // When the Rec shuts, un-add the Rec
            let holdShut = relRec.shutWob().hold(() => addHog.shut());
            
            // If the Rec is un-added, stop holding the Rec shut
            addHog.shutWob().hold(() => holdShut.shut());
          });
          
        });
        
        // Complete squad
        if (defAgg) squad.complete(err);
        
        // If an error occurred it needs to be thrown
        if (err) throw err;
        
        return relRec;
        
      }
      
    })});
    let Rec = U.inspire({ name: 'Rec', insps: { Hog, WobVal }, methods: (insp, Insp) => ({
      
      $NEXT_UID: 0,
      
      init: function({ value=null, type=null, uid=Rec.NEXT_UID++, members=[] }) {
        
        if (type === null) throw new Error(`Missing "type"`);
        if (uid === null) throw new Error(`Missing "uid"`);
        
        insp.Hog.init.call(this);
        insp.WobVal.init.call(this, value);
        
        this.type = type;
        this.uid = uid;
        
        this.relWobs = {};
        this.members = members; // GroupRecs link to all MemberRecs
        
        // Any MemberRec shutting causes `this` GroupRec to shut
        // `this` GroupRec shutting releases all holds on MemberRecs
        let holds = members.map(m => m.shutWob().hold(g => this.shut(g)));
        this.shutWob().hold(g => holds.forEach(h => h.shut(g)));
        
      },
      relWob: function(recType, ind=null) {
        
        if (!recType) throw new Error(`Passed null recType`);
        
        // `ind` is our index in `recType.memberTypes`
        // If no `ind` is given, return the first index matching our type
        if (ind === null) {
          let findMatchingType = recType.memberTypes.find(m => m === this.type);
          if (!findMatchingType) throw new Error(`RecType "${this.type.name}" is not a Member of RecType "${recType.name}"`);
          ind = findMatchingType[1];
        }
        
        let key = `${recType.name}.${ind}`;
        if (!this.relWobs.has(key)) {
          
          if (this.type !== recType.memberTypes[ind]) throw new Error(`RecType "${this.type.name}" is not a Member of RecType "${recType.name}"`);
          let crd = recType.crd[1 - ind]; // Note that `WobRec*` class is determined by OTHER type's cardinality
          this.relWobs[key] = crd === 'M' ? WobRecCrdM() : WobRecCrd1();
          
        }
        
        return this.relWobs[key];
        
      },
      relRecs: function(recType, ind=null) { return this.relWob(recType, ind).toArr(v => v); }, // TODO: Inefficient!
      relRec: function(recType, ind=null) { return this.relRecs(recType, ind)[0] || null; }, // TODO: Inefficient!
      shut0: function(group=Set()) {
        // Shutting us also shuts all GroupRecs of which we are a MemberRec
        // Note that any double-shuts encountered this way are tolerated
        this.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(rec => rec.isShut() || rec.shut(group)));
      }
      
    })});
    
    let recTyper = () => {
      let rt = {};
      let add = (name, ...args) => rt[name] = RecType(name, ...args);
      return { rt, add };
    };
    
    let content = { RecType, Rec, recTyper };
    
    /// {TEST=
    content.test = rootKeep => rootKeep.contain(k => {
      
      U.Keep(k, 'rel11').contain(k => {
        
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
        
        U.Keep(k, 'circular').contain(k => {
          
          U.Keep(k, 'attach1', () => {
            let rt = setup();
            let rec1 = rt.rec.create();
            let lnk = rt.lnk.create({}, rec1, rec1);
            return { msg: 'no error', result: true };
          });
          
          U.Keep(k, 'attach2', () => {
            
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
          
          U.Keep(k, 'attach3', () => {
            let rt = setup();
            let rec1 = rt.rec.create();
            let rec2 = rt.rec.create();
            let lnk = rt.lnk.create({}, rec1, rec2);
            return { msg: 'no error', result: true };
          });
          
          U.Keep(k, 'attach4', () => {
            
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
          
          U.Keep(k, 'detach1', () => {
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
          
          U.Keep(k, 'detach2', () => {
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
          
          U.Keep(k, 'enforceCardinality1', () => {
            
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
          
          U.Keep(k, 'enforceCardinality2', () => {
            
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
          
          U.Keep(k, 'squad1', () => {
            
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
          
          U.Keep(k, 'squad2', () => {
            
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
        
        U.Keep(k, 'VertScope').contain(k => {
          
          U.Keep(k, 'trackRecWobble', () => {
            
            let rt = setup();
            let rec = rt.rec.create();
            let didWobble = false;
            
            let recScope = U.VertScope();
            recScope.hold(() => didWobble = true);
            recScope.trackWob(rec);
            
            return { result: didWobble };
            
          });
          
          U.Keep(k, 'trackShutRecNoWobble', () => {
            
            let rt = setup();
            let rec = rt.rec.create();
            rec.shut();
            let didWobble = false;
            
            let recScope = U.VertScope();
            recScope.hold(() => didWobble = true);
            recScope.trackWob(rec);
            
            return { result: !didWobble };
            
          });
          
          U.Keep(k, 'dive1', () => {
            
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
          
          U.Keep(k, 'dive2', () => {
            
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
          
          U.Keep(k, 'dive3', () => {
            
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
          
          U.Keep(k, 'dive4', () => {
            
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
          
          U.Keep(k, 'dive5', () => {
            
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
          
          U.Keep(k, 'dive6', () => {
            
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
          
          U.Keep(k, 'dive7', () => {
            
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
          
          U.Keep(k, 'shut1', () => {
            
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
          
          U.Keep(k, 'shut2', () => {
            
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
          
          U.Keep(k, 'depShut1', () => {
            
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
      
      U.Keep(k, 'rel1M').contain(k => {
        
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
        
        U.Keep(k, 'VertScope').contain(k => {
          
          U.Keep(k, 'dive1', () => {
            
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
          
          U.Keep(k, 'dive2', () => {
            
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
          
          U.Keep(k, 'dive3', () => {
            
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
          
          U.Keep(k, 'shut1', () => {
            
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
          
          U.Keep(k, 'shut2', () => {
            
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
          
          U.Keep(k, 'depShut1', () => {
            
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
          
          U.Keep(k, 'depShut2', () => {
            
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
          
          U.Keep(k, 'depShut3', () => {
            
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
          
          U.Keep(k, 'depShut4', () => {
            
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
          
          U.Keep(k, 'depShut5', () => {
            
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
      
      return; // TODO: translate all remaining tests from old record!
      
      // NOTE: U.DBG_WOBS + U.TOTAL_WOB_HOLDS has been removed
      
      U.Keep(k, 'relWob').contain(k => {
        
        k.sandwich.before = () => { U.DBG_WOBS = new Set(); };
        k.sandwich.after = () => { U.DBG_WOBS = null; };
        
        U.Keep(k, 'attach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          let rel = Rel(RecA, RecB, '1M');
          
          let recs = [];
          let recA = RecA({});
          let holdRel = recA.relWob(rel.fwd).hold(({ rec: recB }) => recs.push(recB));
          
          for (let i = 0; i < 3; i++) recA.attach(rel.fwd, RecB({}));
          
          return {
            result: true
              // wobbled 3 times
              && recs.length === 3
              // instantaneous relVal produces 3 records
              && recA.relWob(rel.fwd).size() === 3
              // every record is of class RecB
              && !recs.find(recB => !U.isType(recB, RecB))
              // every wobbled value can find a RecA through the reverse Rel
              && !recs.find(recB => recB.getRec(rel.bak) !== recA)
          };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let attaches = [];
          let recA = RecA({});
          for (let i = 0; i < 3; i++) attaches.push(recA.attach(rel.fwd, RecB({})));
          
          attaches.forEach(at => at.shut());
          
          return {
            result: true
              && recA.relWob(rel.fwd).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          
          recA.shut();
          
          return {
            result: true
              && recA.relWob(rel.fwd).isEmpty()
              && recB.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let correct = false;
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          attach.shutWob().hold(() => { correct = true; });
          recA.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          recA.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: err.message === 'Already shut' }; }
          return { result: false };
          
        });
        
        U.Keep(k, 'detachCleanup', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '1M');
          
          let recs = [];
          let attaches = [];
          let recX = RecX({});
          for (let i = 0; i < 5; i++) {
            let recY = RecY({});
            recs.push(recY);
            attaches.push(recX.attach(rel.fwd, recY));
          }
          
          attaches.forEach(at => at.shut());
          recs.forEach(r => r.shut());
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && !recs.find(r => r.numHolds() > 0)
              && !recs.find(r => r.shutWob().numHolds() > 0)
              && recX.numHolds() === 0
              && recX.shutWob().numHolds() === 0
              && U.TOTAL_WOB_HOLDS() === 0
          };
          
        });
        
        U.Keep(k, 'relShutCausesDetach1', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '1M');
          
          let recX = RecX({});
          let recY = RecY({});
          
          let att = recX.attach(rel.fwd, recY);
          recY.shut();
          
          return { result: recX.relWob(rel.fwd).isEmpty() };
          
        });
        
        U.Keep(k, 'relShutCausesDetach2', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '11');
          
          let recX = RecX({});
          let recY = RecY({});
          
          recX.attach(rel.fwd, recY);
          
          recX.shut();
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && recY.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'relShutCausesDetach3', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '11');
          
          let recX = RecX({});
          let recY = RecY({});
          
          recX.attach(rel.fwd, recY);
          recY.shut();
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && recY.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'interimVal1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let holdRel = recA.relWob(rel.fwd).hold(recB => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, RecB({}));
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak).hold(recA0 => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recA.relWob(rel.fwd).hold(recB => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal4', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, 'MM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak).hold(recA0 => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
      });
      
      U.Keep(k, 'HorzScope').contain(k => {
        
        U.Keep(k, 'rel11').contain(k => {
          
          U.Keep(k, 'recShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let rec = RecA({});
            let didShut = false;
            
            U.HorzScope(U.WobVal(rec), (dep, hog) => dep({ shut: () => { didShut = true; }, shutWob: () => U.Wob() }));
            
            rec.shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'relShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            let didShut = false;
            
            U.HorzScope(recA.relWob(relAB.fwd), (dep, recB) => {
              dep({
                shut: () => { didShut = true; },
                shutWob: () => C.nullShutWob
              });
            });
            
            let relRec = recA.attach(relAB.fwd, RecB({})).shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            // Define a HorzScope which immediately "deps" everything it gets, and immediately
            // shut that same HorzScope
            U.HorzScope(recA.relWob(relAB.fwd), (dep, relRecB) => dep(relRecB)).shut();
            
            return { result: recA.relWob(relAB.fwd).isEmpty() };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            let ap = U.HorzScope(recA.relWob(relAB.fwd), (dep, relRecB) => {
              dep(U.HorzScope(U.WobVal(relRecB), (dep, relRecB) => {
                dep(relRecB);
              }));
            });
            
            ap.shut();
            
            return { result: recA.relWob(relAB.fwd).isEmpty() };
            
          });
          
          U.Keep(k, 'attachInterimValue1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recA.getRec(relAB.fwd) === recB;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recA.getRec(relAB.fwd) === relRec.rec;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue3', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recB.getRec(relAB.bak) === recA;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue4', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(({ rec: recB }) => {
              result = recB.getRec(relAB.bak) === recA;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
        });
        
      });
      
      U.Keep(k, 'VertScope').contain(k => {
        
        U.Keep(k, 'rel11').contain(k => {
          
          U.Keep(k, 'trackRecWobble', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let rec = RecA({});
            let didWobble = false;
            
            let recScope = U.VertScope();
            recScope.hold(() => didWobble = true);
            recScope.trackWob(rec);
            
            return { result: didWobble };
            
          });
          
          U.Keep(k, 'trackRecWobble', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let rec = RecA({});
            rec.shut();
            let didWobble = false;
            
            let recScope = U.VertScope();
            recScope.hold(() => didWobble = true);
            recScope.trackWob(rec);
            
            return { result: !didWobble };
            
          });
          
        });
        
      });
      
      U.Keep(k, 'WobSquad').contain(k => {
        
        U.Keep(k, 'defersWobbleOnHold', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let relAB = Rel(RecA, RecB, '11');
          
          let recA = RecA({});
          let recB = RecB({});
          
          let squad = U.WobSquad();
          
          recA.attach(relAB.fwd, recB, squad);
          
          let cnt = 0;
          let ap = U.HorzScope(recA.relWob(relAB.fwd), (dep, { rec: recB }) => {
            cnt++;
          });
          
          if (cnt > 0) return [
            [ 'Wobble on hold deferred by squad', () => false ]
          ];
          
          squad.complete();
          
          return [
            [ 'Exactly one wobble in total', () => cnt === 1 ]
          ];
          
        });
        
        U.Keep(k, 'parentWithChild1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let relAB = Rel(RecA, RecB, '11');
          
          let recA = RecA({});
          let recB = RecB({});
          
          let squad = U.WobSquad();
          
          recA.attach(relAB.fwd, recB, squad);
          squad.complete();
          
          let cnt = 0;
          let ap = U.HorzScope(recA.relWob(relAB.fwd), (dep, { rec: recB }) => {
            cnt++;
          });
          
          return [
            [ 'Exactly one wobble in total', () => cnt === 1 ]
          ];
          
        });
        
        U.Keep(k, 'parentWithChild2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let relAB = Rel(RecA, RecB, '11');
          
          let recA = RecA({});
          let recB = RecB({});
          
          let squad = U.WobSquad();
          
          recA.attach(relAB.fwd, recB, squad);
          
          let cnt = 0;
          let ap = U.HorzScope(recA.relWob(relAB.fwd), (dep, { rec: recB }) => {
            cnt++;
          });
          
          squad.complete();
          
          return [
            [ 'Exactly one wobble in total', () => cnt === 1 ]
          ];
          
        });
        
      });
      
    });
    /// =TEST}
    
    return content;
    
  }
});
