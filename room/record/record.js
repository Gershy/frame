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
      wobbleAdd: function(relRec) {
        if (!relRec) throw new Error('Invalid hog for add');
        if (this.relRec) throw new Error('Already have hog');
        this.relRec = relRec;
        this.wobble(this.relRec);
      },
      wobbleRem: function(relRec) {
        if (!relRec) throw new Error('Invalid hog for rem')
        if (relRec !== this.relRec) throw new Error('Already rem');
        this.relRec = null;
      }
    })});
    let WobM = U.inspire({ name: 'WobM', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.relRecs = {}; // TODO: Use `Set` instead of `{}` (it's also referenced in hinterlands.js)
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
    
    let Relation = U.inspire({ name: 'Relation', methods: (insp, Insp) => ({
      $NEXT_UID: 0,
      
      init: function(head, tail, cardinality) {
        if (cardinality.length !== 2) throw new Error(`Invalid cardinality: "${cardinality}"`);
        if (cardinality.split('').find(v => !'1M'.has(v))) throw new Error(`Invalid cardinality: "${cardinality}"`);
        
        
        this.uid = Relation.NEXT_UID++;
        this.head = head;
        this.tail = tail;
        this.cardinality = cardinality;
        this.flipped = null;
        this.name = `${this.uid}(${this.head.name}->${this.tail.name})`;
      },
      fwd: function() {
        return this;
      },
      bak: function() {
        if (!this.flipped) {
          let Cls = this.constructor;
          this.flipped = Cls(this.tail, this.head, this.cardinality.split('').reverse().join(''));
          this.flipped.flipped = this;
        }
        return this.flipped;
      },
      makeWob: function() { return this.cardinality[1] === '1' ? Wob1() : WobM(); },
      attach: function(rec, relRec, agg) {
        if (!U.isInspiredBy(rec, this.head)) throw new Error(`Can't attach: ${U.typeOf(rec)} not inspired by ${this.head.name}`);
        if (!U.isInspiredBy(relRec.rec, this.tail)) throw new Error(`Can't attach: ${U.typeOf(relRec.rec)} not inspired by ${this.tail.name}`);
        
        let wob = null;
        if (!rec.inner.has(this.name))  wob = rec.inner[this.name] = this.makeWob();
        else                            wob = rec.inner[this.name];
        
        if (agg) agg.addWob(wob);
        wob.wobbleAdd(relRec);
      },
      detach: function(rec, relRec, agg) {
        if (!U.isInspiredBy(rec, this.head)) throw new Error(`Can't detach: ${U.typeOf(rec)} not inspired by ${this.head.name}`);
        if (!U.isInspiredBy(relRec.rec, this.tail)) throw new Error(`Can't detach: ${U.typeOf(relRec.rec)} not inspired by ${this.tail.name}`);
        
        if (!rec.inner.has(this.name)) throw new Error('Can\'t detach: not attached');
        let wob = rec.inner[this.name];
        
        if (agg) agg.addWob(wob);
        wob.wobbleRem(relRec);
      }
    })});
    
    let Record = U.inspire({ name: 'Record', insps: { WobVal }, methods: (insp, Insp) => ({
      $NEXT_REL_UID: 0,
      $NEXT_REC_UID: 0,
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
        // Creates relations in both directions
        
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
      
      relWob: function(rel, direction) {
        if (!rel || !U.isInspiredBy(rel, Relation)) throw new Error('Invalid rel provided');
        if (!this.isInspiredBy(rel.head)) throw new Error(`Can't use rel: ${U.typeOf(this)} isn't inspired by ${rel.head.name}`);
        if (!this.inner.has(rel.name)) this.inner[rel.name] = rel.makeWob();
        return this.inner[rel.name];
      },
      relVal: function(rel, direction) { return this.relWob(rel, direction).getValue(); },
      
      attach: function(rel, inst, agg=null) {
        
        // TODO: Attaching in a two-way manner will have interleaved validation,
        // instead of front-loaded validation. E.g. the order will be:
        // validate1, attach1, validate2, attach2,
        // Instead of:
        // validate1, validate2, attach1, attach2
        // This is no good because errors could occur partway through attaching!
        
        let relRec = null;
        let isShut = false;
        let shutWob0 = null;
        let shutWob = () => shutWob0 || (shutWob0 = U.WobOne());
        let shut = agg => {
          if (relRec.has('isShut') && relRec.isShut) throw new Error('Already shut');
          relRec.isShut = true;
          
          rel.detach(this, relRec, agg);
          if (shutWob0) shutWob0.wobble();
        };
        
        relRec = { rec: inst, shut, shutWob };
        rel.attach(this, relRec, agg);
        
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
        this.inner.forEach(relWob => relWob.forEach(relRec => relRec.shut(agg)));
        agg.complete();
        
        if (this.shutWob0) this.shutWob0.wobble();
        return;
        
      },
      shutWob: function() {
        if (!this.shutWob0) this.shutWob0 = U.WobOne();
        return this.shutWob0;
      }
    })});
    
    let content = { Record, Relation };
    
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
          let rel = Relation(Rec, Rec, '11');
          
          let rec1 = Rec({});
          let rec2 = Rec({});
          
          let correct1 = false;
          let correct2 = false;
          rec1.relWob(rel.fwd()).hold(({ rec }) => { correct1 = rec === rec2; console.log('CORR1:', correct1); });
          rec2.relWob(rel.bak()).hold(({ rec }) => { correct2 = rec === rec1; console.log('CORR2:', correct2); });
          
          U.AggWobs().complete(agg => {
            rec1.attach(rel.fwd(), rec2, agg);
            rec2.attach(rel.bak(), rec1, agg);
          });
          
          return {
            result: true
              && correct1
              && correct2
              && rec1.relVal(rel.fwd()) === rec2
              && rec2.relVal(rel.bak()) === rec1
          };
          
        });
        
        U.Keep(k, 'circular3', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Relation(Rec, Rec, '11');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel.fwd()).hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular4', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Relation(Rec, Rec, '11');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel.bak()).hold(({ rec }) => { correct = rec === loopRec; });
          
          U.AggWobs().complete(agg => {
            loopRec.attach(rel.bak(), loopRec);
            loopRec.attach(rel.fwd(), loopRec);
          });
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular5', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Relation(Rec, Rec, '11');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel.bak()).hold(({ rec }) => { correct = loopRec.relVal(rel.fwd()) === rec; });
          
          U.AggWobs().complete(agg => {
            loopRec.attach(rel.fwd(), loopRec, agg);
            loopRec.attach(rel.bak(), loopRec, agg);
          });
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular6', () => {
          
          let Rec = U.inspire({ name: 'Rec', insps: { Record } });
          let rel = Relation(Rec, Rec, '11');
          
          let loopRec = Rec({});
          let correct = false;
          loopRec.relWob(rel.bak()).hold(({ rec }) => { correct = loopRec.relVal(rel.bak()) === rec; });
          
          U.AggWobs().complete(agg => {
            loopRec.attach(rel.fwd(), loopRec, agg);
            loopRec.attach(rel.bak(), loopRec, agg);
          });
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'attach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Relation(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          U.AggWobs().complete(agg => {
            rec1.attach(rel.fwd(), rec2, agg);
            rec2.attach(rel.bak(), rec1, agg);
          });
          
          return { result: rec1.relVal(rel.fwd()) === rec2 && rec2.relVal(rel.bak()) === rec1 };
          
        });
        
        U.Keep(k, 'attachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Relation(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          rec1.attach(rel.fwd(), rec2);
          
          try { rec1.attach(rel.fwd(), Rec2({})); }
          catch(err) { return { result: true }; }
          
          return { result: false };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Relation(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let attach = rec1.attach(rel, rec2);
          attach.shut();
          
          return { result: rec1.relVal(rel) === null };
          
        });
        
        U.Keep(k, 'detachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Record } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Record } });
          
          let rel = Relation(Rec1, Rec2, '11');
          
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
          
          let rel = Relation(RecA, RecB, '1M');
          
          let recs = [];
          let recA = RecA({});
          let holdRel = recA.relWob(rel).hold(recB => recs.push(recB.rec));
          
          for (let i = 0; i < 3; i++) recA.attach(rel, RecB({}));
          
          return {
            result: true
              && recs.length === 3
              && recA.relVal(rel.fwd()).toArr(m => m).length === 3
              && !recs.find(recB => !U.isType(recB, RecB))
              && !recs.find(recB => recB.relVal(rel.bak()))
          };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Relation(RecA, RecB, '1M');
          
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
          
          let rel = Relation(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel, recB);
          
          recA.shut();
          
          return {
            result: true
              && recA.relWob(rel.fwd()).isEmpty()
              && recB.relWob(rel.bak()).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Relation(RecA, RecB, '1M');
          
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
          
          let rel = Relation(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel, recB);
          
          recA.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: err.message.toLowerCase().has('already shut') }; }
          return { result: false };
          
        });
        
        U.Keep(k, 'detachCleanup', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Record } });
          let RecY = U.inspire({ name: 'RecY', insps: { Record } });
          
          let rel = Relation(RecX, RecY, '1M');
          
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
              && recX.relWob(rel).isEmpty()
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
          
          let rel = Relation(RecA, RecB, '1M');
          
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
          
          let rel = Relation(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak()).hold(recA0 => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          U.AggWobs().complete(agg => {
            recA.attach(rel.fwd(), recB);
            recB.attach(rel.bak(), recA);
          });
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
        U.Keep(k, 'interimVal3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Relation(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recA.relWob(rel.fwd()).hold(recB => {
            interimVal = recA.relVal(rel.fwd()).map(v => v);
          });
          
          U.AggWobs().complete(agg => {
            recA.attach(rel.fwd(), recB, agg);
            recB.attach(rel.bak(), recA, agg);
          });
          
          return { result: interimVal.toArr(v => v).length === 1 };
          
        });
        
        U.Keep(k, 'interimVal4', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Record } });
          let RecB = U.inspire({ name: 'RecB', insps: { Record } });
          
          let rel = Relation(RecA, RecB, 'MM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak()).hold(recA0 => {
            interimVal = recA.relVal(rel).map(v => v);
          });
          
          U.AggWobs().complete(agg => {
            recA.attach(rel.fwd(), recB);
            recB.attach(rel.bak(), recA);
          });
          
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
            
            let relAB = Relation(RecA, RecB, '11');
            
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
            
            let relAB = Relation(RecA, RecB, '11');
            
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
            
            let relAB = Relation(RecA, RecB, '11');
            
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
            
            let relAB = Relation(RecA, RecB, '11');
            
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
            
            let relAB = Relation(RecA, RecB, '11');
            
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
            
            let relAB = Relation(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd()).hold(relRec => {
              result = recB.relVal(relAB.bak()) === recA;
            });
            
            U.AggWobs().complete(agg => {
              recA.attach(relAB.fwd(), recB, agg);
              recB.attach(relAB.bak(), recA, agg);
            });
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue4', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Record } });
            let RecB = U.inspire({ name: 'RecB', insps: { Record } });
            
            let relAB = Relation(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd()).hold(({ rec: recB }) => {
              result = recB.relVal(relAB.bak()) === recA;
            });
            
            U.AggWobs().complete(agg => {
              recA.attach(relAB.fwd(), recB, agg);
              recB.attach(relAB.bak(), recA, agg);
            });
            
            return { result };
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
