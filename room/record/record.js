U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Records are data items with a number of properties, including relational properties
    
    // TODO: Right now `Wob1` and `WobM` support listening for shuts
    // The problem is that shuts need to result in both sides of a relation
    // detaching the value, and these Record-specific Wobs don't have enough
    // information to do this.
    // Shut-listening should probably happen in `Record.prototype.attach`!
    
    let { Wob, WobVal } = U;
    
    let Wob1 = U.inspire({ name: 'Wob1', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.relRec = null;
      },
      hold: function(fn) {
        if (this.relRec) fn(this.relRec); // Call immediately
        return insp.Wob.hold.call(this, fn);
      },
      forEach: function(fn) { if (this.relRec) fn(this.relRec); },
      isEmpty: function() { return !this.relRec; },
      getValue: function() { return this.relRec ? this.relRec.rec : null; },
      wobble: function(relRec) {
        this.relRec = relRec;
        if (this.relRec) insp.Wob.wobble.call(this, this.relRec);
      }
    })});
    let WobM = U.inspire({ name: 'WobM', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.relRecs = {};
      },
      hold: function(fn) {
        this.relRecs.forEach(fn);
        return insp.Wob.hold.call(this, fn);
      },
      forEach: function(fn) { this.relRecs.forEach(fn); },
      isEmpty: function() { return this.relRecs.isEmpty(); },
      getValue: function() { return this.relRecs.map(rr => rr.rec); },
      wobbleAdd: function(relRec) {
        if (this.relRecs.has(relRec.rec.uid)) throw new Error('Already have hog');
        this.relRecs[relRec.rec.uid] = relRec;
        this.wobble(relRec);
      },
      wobbleRem: function(relRec, uid=relRec.rec.uid) {
        if (!this.relRecs.has(uid) || this.relRecs[uid].rec !== relRec.rec) throw new Error('Don\'t have relRec');
        delete this.relRecs[uid];
      }
    })});
    
    let getWob1 = () => Wob1();
    let getWobM = () => WobM();
    
    let Record = U.inspire({ name: 'Record', insps: { WobVal }, methods: (insp, Insp) => ({
      $NEXT_REL_UID: 0,
      $NEXT_REC_UID: 0,
      $fullFlatDef: Insp => {
        // Inherit relations from inspirations, and add on our own relations
        // TODO: Multiple inheritance can result in some defs being clobbered in this namespace...
        let fullDef = {};
        Insp.insps.forEach(SupInsp => SupInsp !== Insp ? fullDef.gain(Record.fullFlatDef(SupInsp)) : null);
        fullDef.gain(Insp.has('relSchemaDef') ? Insp.relSchemaDef : {});
        return fullDef;
      },
      $relateUni1: (name, Cls1, Cls2) => ({
        // Attach/detach instances of Cls1 to/from instances of Cls2
        type: '1',
        attach0: (inst1, inst2) => {
          if (!inst2.isInspiredBy(Record)) throw new Error(`Can't attach: need Record; got ${U.typeOf(inst2)}`);
          if (inst1.inner.has(name) && inst1.inner[name].relRec)
            throw new Error(`Can't attach rel ${Cls1.name}.${name} -> ${Cls2.name}: already attached`);
        },
        attach1: (inst1, relInst2, agg) => {
          if (!inst1.inner.has(name)) inst1.inner[name] = getWob1();
          agg.addWob(inst1.inner[name]);
          inst1.inner[name].wobble(relInst2);
        },
        detach0: (inst1, inst2) => {
          if (!inst2.isInspiredBy(Record)) throw new Error(`Can't detach: need Record; got ${U.typeOf(inst2)}`);
          if (!inst1.inner.has(name) || inst1.inner[name].relRec.rec !== inst2)
            throw new Error(`Can't detach rel ${Cls1.name}.${name} -> ${Cls2.name}: already detached`);
        },
        detach1: (inst1, relInst2, agg) => {
          agg.addWob(inst1.inner[name]);
          inst1.inner[name].wobble(null);
        }
      }),
      $relateUniM: (name, ClsM, Cls1) => ({
        // Attach/detach instances of ClsM to/from multiple instances of Cls1
        type: 'M',
        attach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't attach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (instM.inner.has(name) && instM.inner[name].relRecs.has(inst1.uid)) throw new Error(`Can't attach rel ${ClsM.name}.${name} -> ${Cls1.name}: already attached`);
        },
        attach1: (instM, relInst1, agg) => {
          if (!instM.inner.has(name)) instM.inner[name] = getWobM();
          agg.addWob(instM.inner[name]);
          instM.inner[name].wobbleAdd(relInst1);
        },
        detach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't detach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (!instM.inner.has(name) || !instM.inner[name].relRecs.has(inst1.uid))
            throw new Error(`Can't detach rel ${ClsM.name}.${name} -> ${Cls1.name}: already detached`);
        },
        detach1: (instM, relInst1, agg) => {
          agg.addWob(instM.inner[name]);
          instM.inner[name].wobbleRem(relInst1);
        }
      }),
      $relate: (relFunc1, relFunc2, Cls1, Cls2, name1, name2) => {
        if (!name1) throw new Error('Need to provide relation name');
        
        // TODO: could consider automatically providing names for `name1`, `name2`:
        // `let name1 = 'relVar' + (Cls1.nextRelVarInd++);`
        // `let name2 = 'relVar' + (Cls2.nextRelVarInd++);`
        
        let clsRel1 = relFunc1(name1, Cls1, Cls2);
        let clsRel2 = relFunc2(name2, Cls2, Cls1);
        
        let key = U.multiKey(`${Cls1.uid}.${name1}`, `${Cls2.uid}.${name2}`);
        let rel = {
          key, uid: Record.NEXT_REL_UID++, desc: name1 === name2 ? name1 : `${name1}<->${name2}`,
          Cls1, Cls2, name1, name2,
          clsRel1, clsRel2
        };
        
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
        Cls1.relSchemaDef[name1] = rel;
        
        if (!Cls2.has('relSchemaDef')) Cls2.relSchemaDef = {};
        Cls2.relSchemaDef[name2] = rel;
        
        return rel;
      },
      $relate11: (Cls1, Cls2, name1, name2=name1) => Record.relate(Record.relateUni1, Record.relateUni1, Cls1, Cls2, name1, name2),
      $relateM1: (ClsM, Cls1, nameM, name1=nameM) => Record.relate(Record.relateUni1, Record.relateUniM, ClsM, Cls1, nameM, name1),
      $relate1M: (Cls1, ClsM, name1, nameM=name1) => Record.relate(Record.relateUniM, Record.relateUni1, Cls1, ClsM, name1, nameM),
      $relateMM: (Cls1, Cls2, name1, name2=name1) => Record.relate(Record.relateUniM, Record.relateUniM, Cls1, Cls2, name1, name2),      
      
      init: function({ uid=null, value=null }) {
        this.uid = uid !== null ? uid : Record.NEXT_REC_UID++;
        insp.WobVal.init.call(this, value);
        this.inner = {};
        this.shutWob0 = null;
      },
      getFlatDef: function() {
        // TODO: Should be possible to construct `this.constructor.flatDef` over time
        // as `Record.relateXX` is called; would avoid needing to do an `if` check
        // here every time!
        if (!this.constructor.has('flatDef')) this.constructor.flatDef = Record.fullFlatDef(this.constructor);
        return this.constructor.flatDef;
      },
      
      getRelPart: function(rel, direction='fwd') {
        if (![ 'fwd', 'bak' ].has(direction)) throw new Error(`Direction should be either "fwd" or "bak" (got ${direction})`);
        
        let flatDef = this.getFlatDef();
        
        
        let pcs = [
          rel.slice({ Cls: 'Cls1', name: 'name1', clsRel: 'clsRel1' }),
          rel.slice({ Cls: 'Cls2', name: 'name2', clsRel: 'clsRel2' })
        ];
        if (direction === 'bak') pcs.reverse(); // If going "bak", check the 2nd piece first
        
        //if (direction === 'bak') console.log('PCS:', pcs);
        
        let fwdPc = pcs.find(({ Cls, name, clsRel }) => this.isInspiredBy(Cls) && flatDef.has(name) && flatDef[name] === rel);
        if (!fwdPc) throw new Error(`${this.constructor.name} doesn't use the provided relation`);
        
        let [ pcFwd, ind ] = fwdPc;
        let pcBak = pcs[1 - ind];
        
        return {
          Cls: pcFwd.Cls,
          nameFwd: pcFwd.name, nameBak: pcBak.name,
          clsRelFwd: pcFwd.clsRel, clsRelBak: pcBak.clsRel
        };
      },
      relWob: function(rel, direction) {
        if (!rel) throw new Error('Invalid rel provided');
        let { nameFwd, clsRelFwd } = this.getRelPart(rel, direction);
        if (!this.inner.has(nameFwd)) this.inner[nameFwd] = clsRelFwd.type === '1' ? getWob1() : getWobM();
        return this.inner[nameFwd];
      },
      relVal: function(rel, direction) { return this.relWob(rel, direction).getValue(); },
      
      attach: function(rel, inst, agg=null) {
        // Validate then attach
        let { nameFwd, clsRelFwd, clsRelBak } = this.getRelPart(rel);
        
        // NOTE: Unaggregated, the order would be:
        // validate1, validate2, set1, wobble1, set2, wobble2
        // We need to aggregate! Because the order needs to be:
        // validate1, validate2, set1, set2, wobble1, wobble2
        // Otherwise a wobble occurs before the full new state is set
        
        // Init everything we need to shut this relation
        let shutWob0 = null;
        let shutWob = () => shutWob0 || (shutWob0 = U.WobOne());
        let shut = agg => {
          let defAgg = !agg;
          if (defAgg) agg = U.AggWobs();
          try {
            clsRelFwd.detach0(this, inst);
            clsRelBak.detach0(inst, this);
            clsRelFwd.detach1(this, relInst, agg);
            clsRelBak.detach1(inst, relThis, agg);
          } finally {
            if (defAgg) agg.complete();
          }
          
          if (shutWob0) shutWob0.wobble();
        };
        
        // Records in the context of being related to another Record
        let relThis = { rec: this, shut, shutWob };
        let relInst = { rec: inst, shut, shutWob };
        
        let defAgg = !agg;
        if (defAgg) agg = U.AggWobs();
        try {
          clsRelFwd.attach0(this, inst);
          clsRelBak.attach0(inst, this);
          clsRelFwd.attach1(this, relInst, agg);
          clsRelBak.attach1(inst, relThis, agg);
        } finally {
          if (defAgg) agg.complete();
        }
        
        return { shut, shutWob };
        
      },
      shut: function() {
        
        // TODO: Consider a "shut group" - a number of Hogs being shut together, which
        // are allowed to still be linked to each other (just not to any Hogs outside
        // of the "shut group")
        
        if (this.isShut) throw new Error('Already shut');
        this.isShut = true;
        
        // For all Records of all Relations, shut the RecordRelation
        let agg = U.AggWobs();
        this.getFlatDef().forEach(rel => this.relWob(rel).forEach(relRec => relRec.shut(agg)));
        agg.complete();
        
        if (this.shutWob0) this.shutWob0.wobble();
        return;
        
      },
      shutWob: function() {
        if (!this.shutWob0) this.shutWob0 = U.WobOne();
        return this.shutWob0;
      }
    })});
    
    let content = { Record };
    
    /// {TEST=
    content.test = rootKeep => rootKeep.contain(k => U.Keep(k, 'record').contain(k => {
      
      U.Keep(k, 'rel11').contain(k => {
        
        U.Keep(k, 'circular1', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          Record.relate11(Rec, Rec, 'circFwd', 'circBak');
          return { result: true };
          
        });
        
        U.Keep(k, 'circular2', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Record.relate11(Rec, Rec, 'fwd', 'bak');
          
          let rec1 = Rec({});
          let rec2 = Rec({});
          
          let correct1 = false;
          let correct2 = false;
          rec1.relWob(rel, 'fwd').hold(({ rec }) => { correct1 = rec === rec2; });
          rec2.relWob(rel, 'bak').hold(({ rec }) => { correct2 = rec === rec1; });
          rec1.attach(rel, rec2);
          
          return {
            result: true
              && correct1
              && correct2
              && rec1.relVal(rel, 'fwd') === rec2
              && rec2.relVal(rel, 'bak') === rec1
          };
          
        });
        
        U.Keep(k, 'circular3', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Record.relate11(Rec, Rec, 'relFwd', 'relBak');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel, 'fwd').hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular4', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Record.relate11(Rec, Rec, 'relFwd', 'relBak');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel, 'bak').hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular5', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Record.relate11(Rec, Rec, 'relFwd', 'relBak');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel, 'bak').hold(({ rec }) => { correct = loopRec.relVal(rel, 'fwd') === rec; });
          loopRec.attach(rel, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular6', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Record.relate11(Rec, Rec, 'relFwd', 'relBak');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel, 'bak').hold(({ rec }) => { correct = loopRec.relVal(rel, 'bak') === rec; });
          loopRec.attach(rel, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'attach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Record.relate11(Rec1, Rec2, 'rel12');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          rec1.attach(rel, rec2);
          
          return { result: rec1.relVal(rel) === rec2 && rec2.relVal(rel) === rec1 };
          
        });
        
        U.Keep(k, 'attachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Record.relate11(Rec1, Rec2, 'rel12');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          rec1.attach(rel, rec2);
          
          try { rec1.attach(rel, Rec2({})); }
          catch(err) { return { result: true }; }
          
          return { result: false };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Record.relate11(Rec1, Rec2, 'rel12');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let attach = rec1.attach(rel, rec2);
          attach.shut();
          
          return { result: rec1.relVal(rel) === null && rec2.relVal(rel) === null };
          
        });
        
        U.Keep(k, 'detachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Record.relate11(Rec1, Rec2, 'rel12');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let attach = rec1.attach(rel, rec2);
          attach.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: true }; }
          
          return { result: false };
          
        });
        
      });
      
      U.Keep(k, 'relWob').contain(k => {
        
        k.sandwich.before = () => { U.DBG_WOBS = new Set(); };
        k.sandwich.after = () => { U.DBG_WOBS = null; };
        
        U.Keep(k, 'attach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let recs = [];
          
          let recA = RecA({});
          let holdRel = recA.relWob(rel).hold(recB => recs.push(recB.rec));
          
          for (let i = 0; i < 3; i++) recA.attach(rel, RecB({}));
          
          return {
            result: true
              && recs.length === 3
              && recA.relVal(rel).toArr(m => m).length === 3
              && !recs.find(r => !U.isType(r, RecB))
          };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let attaches = [];
          let recA = RecA({});
          for (let i = 0; i < 3; i++) attaches.push(recA.attach(rel, RecB({})));
          
          attaches.forEach(at => at.shut());
          
          return {
            result: true
              && recA.relVal(rel).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel, recB);
          
          recA.shut();
          
          return {
            result: true
              && recA.relWob(rel).isEmpty()
              && recB.relWob(rel).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let correct = false;
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel, recB);
          attach.shutWob().hold(() => { correct = true; });
          recA.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel, recB);
          
          recA.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: err.message.has('already detached') }; }
          return { result: false };
          
        });
        
        U.Keep(k, 'detachCleanup', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Record } });
          let RecY = U.inspire({ name: 'RecY', insps: { Record } });
          
          let rel = Record.relate1M(RecX, RecY, 'A1BM');
          
          let recs = [];
          let attaches = [];
          let recX = RecX({});
          for (let i = 0; i < 5; i++) {
            let recY = RecY({});
            recs.push(recY);
            attaches.push(recX.attach(rel, recY));
          }
          
          attaches.forEach(at => at.shut());
          recs.forEach(r => r.shut());
          
          return {
            result: true
              && !recs.find(r => r.numHolds() > 0)
              && !recs.find(r => r.shutWob().numHolds() > 0)
              && recX.numHolds() === 0
              && recX.shutWob().numHolds() === 0
              && U.TOTAL_WOB_HOLDS() === 0
          };
          
        });
        
        U.Keep(k, 'interimVal1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'X1YM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let holdRel = recA.relWob(rel).hold(recB => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          recA.attach(rel, RecB({}));
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
        U.Keep(k, 'interimVal2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relate1M(RecA, RecB, 'A1BM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel).hold(recB => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          recA.attach(rel, recB);
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
        U.Keep(k, 'interimVal3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relateMM(RecA, RecB, 'A1BM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let holdRel = recA.relWob(rel).hold(recB => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          recA.attach(rel, RecB({}));
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
        U.Keep(k, 'interimVal4', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Record.relateMM(RecA, RecB, 'A1BM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel).hold(recB => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          recA.attach(rel, recB);
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
      });
      
      U.Keep(k, 'AccessPath').contain(k => {
        
        U.Keep(k, 'rel11').contain(k => {
          
          U.Keep(k, 'recShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let rec = RecA({});
            let didShut = false;
            
            U.AccessPath(U.WobVal(rec), (dep, hog) => dep({ shut: () => { didShut = true; }, shutWob: () => U.Wob() }));
            
            rec.shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'relShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            
            let didShut = false;
            
            U.AccessPath(recA.relWob(relAB), (dep, relRecB) => {
              dep({ shut: () => { didShut = true; }, shutWob: () => U.Wob() });
            });
            
            recA.attach(relAB, RecB({})).shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            
            let ap = U.AccessPath(recA.relWob(relAB), (dep, relRecB) => {
              dep(relRecB);
            });
            
            ap.shut();
            
            return { result: recA.relWob(relAB).isEmpty() };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            
            let ap = U.AccessPath(recA.relWob(relAB), (dep, relRecB) => {
              dep(U.AccessPath(U.WobVal(relRecB), (dep, relRecB) => {
                dep(relRecB);
              }));
            });
            
            ap.shut();
            
            return { result: recA.relWob(relAB).isEmpty() };
            
          });
          
          U.Keep(k, 'attachInterimValue1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB).hold(relRec => {
              result = recA.relVal(relAB) === recB;
            });
            
            recA.attach(relAB, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB).hold(relRec => {
              result = recA.relVal(relAB) === relRec.rec;
            });
            
            recA.attach(relAB, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue3', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB).hold(relRec => {
              result = recB.relVal(relAB) === recA;
            });
            
            recA.attach(relAB, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue4', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Record.relate11(RecA, RecB, 'ab');
            
            let recA = RecA({});
            let result = false;
            recA.relWob(relAB).hold(({ rec: recB }) => {
              result = recB.relVal(relAB) === recA;
            });
            
            recA.attach(relAB, RecB({}));
            
            return { result };
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
