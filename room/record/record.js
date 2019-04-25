U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Records are data items with a number of properties, including relational properties
    
    let { WobVal } = U;
    
    let getWob1 = () => {
      let [ attach, detach ] = [ U.Wob({}), U.Wob({}) ];
      
      let wob = U.WobVal();
      wob.hold((newVal, oldVal) => {
        if (newVal) attach.wobble(newVal);
        if (oldVal) detach.wobble(oldVal);
      });
      wob.attach = attach;
      wob.detach = detach;
      
      let attachHold0 = attach.hold;
      attach.hold = fn => {
        let ret = attachHold0.call(attach, fn);
        if (wob.value) fn(wob.value); // DON'T WOBBLE - just call the function being attached
        return ret;
      };
      
      return wob;
    };
    let getWobM = () => {
      let [ attach, detach ] = [ U.Wob({}), U.Wob({}) ];
      let wob = U.WobObj({});
      wob.hold(({ add={}, rem={} }) => {
        add.forEach(rec => attach.wobble(rec));
        rem.forEach(rec => detach.wobble(rec));
      });
      wob.attach = attach;
      wob.detach = detach;
      
      let attachHold0 = attach.hold;
      attach.hold = fn => {
        let ret = attachHold0.call(attach, fn);
        wob.value.forEach(v => fn(v)); // DON'T WOBBLE - just call the function being attached with every current value
        return ret;
      };
      
      return wob;
    };
    
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
          if (inst1.inner.has(name) && inst1.inner[name].value)
            throw new Error(`Can't attach rel ${Cls1.name}.${name} -> ${Cls2.name}: already attached`);
        },
        attach1: (inst1, inst2, agg) => {
          if (!inst1.inner.has(name)) inst1.inner[name] = getWob1();
          agg.addWob(inst1.inner[name]);
          inst1.inner[name].wobble(inst2);
        },
        detach0: (inst1, inst2) => {
          if (!inst2.isInspiredBy(Record)) throw new Error(`Can't detach: need Record; got ${U.typeOf(inst2)}`);
          if (!inst1.inner.has(name) || inst1.inner[name].value !== inst2)
            throw new Error(`Can't detach rel ${Cls1.name}.${name} -> ${Cls2.name}: already detached`);
        },
        detach1: (inst1, inst2, agg) => {
          agg.addWob(inst1.inner[name]);
          inst1.inner[name].wobble(null);
        }
      }),
      $relateUniM: (name, ClsM, Cls1) => ({
        // Attach/detach instances of ClsM to/from multiple instances of Cls1
        type: 'M',
        attach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't attach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (instM.inner.has(name) && instM.inner[name].value.has(inst1.uid)) throw new Error(`Can't attach rel ${ClsM.name}.${name} -> ${Cls1.name}: already attached`);
        },
        attach1: (instM, inst1, agg) => {
          if (!instM.inner.has(name)) instM.inner[name] = getWobM();
          agg.addWob(instM.inner[name]);
          instM.inner[name].wobble({ add: { [inst1.uid]: inst1 } });
        },
        detach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't detach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (!instM.inner.has(name) || !instM.inner[name].value.has(inst1.uid))
            throw new Error(`Can't detach rel ${ClsM.name}.${name} -> ${Cls1.name}: already detached`);
        },
        detach1: (instM, inst1, agg) => {
          agg.addWob(instM.inner[name]);
          instM.inner[name].wobble({ rem: { [inst1.uid]: inst1 } });
        }
      }),
      $relate: (relFunc1, relFunc2, Cls1, Cls2, name1, name2) => {
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
        
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {}; Cls1.relSchemaDef[name1] = rel;
        if (!Cls2.has('relSchemaDef')) Cls2.relSchemaDef = {}; Cls2.relSchemaDef[name2] = rel;
        
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
      },
      iden: function() { return `${this.constructor.name}@${this.uid}`; },
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
        
        let fwdPc = pcs.find(({ Cls, name, clsRel }) => this.isInspiredBy(Cls) && flatDef.has(name) && flatDef[name] === rel);
        
        if (!fwdPc) throw new Error(`${this.constructor.name} doesn't use the provided relation`);
        
        let [ pcFwd, ind ] = fwdPc;
        let pcBak = pcs[1 - ind];
        
        return {
          Cls: pcFwd.Cls,
          nameFwd: pcFwd.name, nameBak: pcBak.name,
          clsRelFwd: pcFwd.clsRel, clsRelBak: pcBak.clsRel
        };
        
        /*let { Cls1, Cls2, name1, name2, clsRel1, clsRel2 } = rel;
        
        if (direction === 'bak') [ Cls1, Cls2, name1, name2, clsRel1, clsRel2 ] = [ Cls2, Cls1, name2, name1, clsRel2, clsRel1 ];
        
        if (this.isInspiredBy(Cls1) && flatDef.has(name1) && flatDef[name1] === rel) {
          return { Cls: Cls1, nameFwd: name1, nameBak: name2, clsRelFwd: clsRel1, clsRelBak: clsRel2 };
        } else if (this.isInspiredBy(Cls2) && flatDef.has(name2) && flatDef[name2] === rel) {
          return { Cls: Cls2, nameFwd: name2, nameBak: name1, clsRelFwd: clsRel2, clsRelBak: clsRel1 };
        }
        throw new Error(`${this.constructor.name} doesn't use the provided relation`);*/
      },
      relWob: function(rel, direction) {
        if (!rel) throw new Error('Invalid rel provided');
        let { nameFwd, clsRelFwd } = this.getRelPart(rel, direction);
        if (!this.inner.has(nameFwd)) this.inner[nameFwd] = clsRelFwd.type === '1' ? getWob1() : getWobM();
        return this.inner[nameFwd];
      },
      relVal: function(rel) { return this.relWob(rel).value; },
      
      attach: function(rel, inst, agg=null) {
        // Validate then attach
        let { clsRelFwd, clsRelBak } = this.getRelPart(rel);
        
        // NOTE: Unaggregated, the order would be:
        // validate1, validate2, set1, wobble1, set2, wobble2
        // We need to aggregate! Because the order needs to be:
        // validate1, validate2, set1, set2, wobble1, wobbl2
        // Otherwise a wobble occurs before the full new state is set
        
        let defAgg = !agg;
        if (defAgg) agg = U.AggWobs();
        
        clsRelFwd.attach0(this, inst); clsRelBak.attach0(inst, this);
        clsRelFwd.attach1(this, inst, agg); clsRelBak.attach1(inst, this, agg);
        
        if (defAgg) agg.complete();
        return inst;
      },
      detach: function(rel, inst, agg=null) {
        // Validate then detach
        let { clsRelFwd, clsRelBak } = this.getRelPart(rel);
        
        let defAgg = !agg;
        if (defAgg) agg = U.AggWobs();
        
        clsRelFwd.detach0(this, inst); clsRelBak.detach0(inst, this);
        clsRelFwd.detach1(this, inst, agg); clsRelBak.detach1(inst, this, agg);
        
        if (defAgg) agg.complete();
        return inst;
      },
      shut: function() {
        insp.WobVal.shut.call(this);
        
        let agg = U.AggWobs();
        
        // For all our relations, detach from all Records related via that relation
        this.getFlatDef().forEach(rel => {
          
          let recs = this.relVal(rel);
          let getRecs = U.isType(recs, Object)
            ? (n => recs) // Take advantage of `recs` being a live reference
            : (n => (recs && n === 0) ? { [recs.uid]: recs } : {});
          
          for (let n = 0; true; n++) {
            let rec = getRecs(n).find(v => true);
            if (!rec) break;
            this.detach(rel, rec[0], agg);
          }
          
        });
        
        agg.complete();
      }
    })});
    
    return { Record };
  }
});
