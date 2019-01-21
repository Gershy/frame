U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Records are data items with a number of properties, including relational properties
    
    let { Wobbly } = U;
    
    let Record = U.inspire({ name: 'Record', insps: { Wobbly }, methods: (insp, Insp) => ({
      $NEXT_REL_UID: 0,
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
          if (inst1.inner && inst1.inner.has(name) && inst1.inner[name].value)
            throw new Error(`Can't attach rel ${Cls1.name}.${name} -> ${Cls2.name}: already attached`);
        },
        attach1: (inst1, inst2) => {
          if (!inst1.inner) inst1.inner = {};
          if (!inst1.inner.has(name)) inst1.inner[name] = U.Wobbly({});
          inst1.inner[name].wobble(inst2);
        },
        detach0: (inst1, inst2) => {
          if (!inst1.inner || !inst1.inner.has(name) || inst1.inner[name].value !== inst2)
            throw new Error(`Can't detach rel ${Cls1.name}.${name} -> ${Cls2.name}: already detached`);
        },
        detach1: (inst1, inst2) => {
          inst1.inner[name].wobble(null);
        }
      }),
      $relateUniM: (name, ClsM, Cls1) => ({
        // Attach/detach instances of ClsM to/from multiple instances of Cls1
        type: 'M',
        attach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't attach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (instM.inner && instM.inner.has(name) && instM.inner[name].value.has(inst1.uid)) throw new Error(`Can't attach rel ${ClsM.name}.${name} -> ${Cls1.name}: already attached`);
        },
        attach1: (instM, inst1) => {
          if (!instM.inner) instM.inner = {};
          if (!instM.inner.has(name)) instM.inner[name] = U.DeltaWob({ value: {} });
          instM.inner[name].wobble({ add: { [inst1.uid]: inst1 } });
        },
        detach0: (instM, inst1) => {
          if (inst1.uid === null) throw new Error(`Can't detach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
          if (!instM.inner || !instM.inner.has(name) || !instM.inner[name].value.has(inst1.uid))
            throw new Error(`Can't detach rel ${ClsM.name}.${name} -> ${Cls1.name}: already detached`);
        },
        detach1: (instM, inst1) => {
          instM.inner[name].wobble({ rem: { [inst1.uid]: inst1 } });
        }
      }),
      $relate: (relFunc1, relFunc2, Cls1, Cls2, name1, name2) => {
        // TODO: could consider automatically providing names for `name1`, `name2`:
        // `let name1 = 'relVar' + (Cls1.nextRelVarInd++);`
        // `let name2 = 'relVar' + (Cls2.nextRelVarInd++);`
        let key = U.multiKey(`${Cls1.uid}.${name1}`, `${Cls2.uid}.${name2}`);
        let rel = {
          key, uid: Record.NEXT_REL_UID++, desc: name1 === name2 ? name1 : `${name1}<->${name2}`,
          Cls1, Cls2, name1, name2,
          clsRel1: relFunc1(name1, Cls1, Cls2),
          clsRel2: relFunc2(name2, Cls2, Cls1)
        };
        
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {}; Cls1.relSchemaDef[name1] = rel;
        if (!Cls2.has('relSchemaDef')) Cls2.relSchemaDef = {}; Cls2.relSchemaDef[name2] = rel;
        
        return rel;
      },
      $relate11: (Cls1, Cls2, name1, name2=name1) => Record.relate(Record.relateUni1, Record.relateUni1, Cls1, Cls2, name1, name2),
      $relateM1: (ClsM, Cls1, nameM, name1=nameM) => Record.relate(Record.relateUni1, Record.relateUniM, ClsM, Cls1, nameM, name1),
      $relate1M: (Cls1, ClsM, name1, nameM=name1) => Record.relate(Record.relateUniM, Record.relateUni1, Cls1, ClsM, name1, nameM),
      $relateMM: (Cls1, Cls2, name1, name2=name1) => Record.relate(Record.relateUniM, Record.relateUniM, Cls1, Cls2, name1, name2),      
      
      init: function({ uid }) {
        insp.Wobbly.init.call(this, { uid });
      },
      iden: function() { return `${this.constructor.name}@${this.uid}`; },
      getFlatDef: function() {
        // TODO: Should be possible to construct `this.constructor.flatDef` over time
        // as `Record.relateXX` is called; would avoid needing to do an `if` check
        // here every time!
        if (!this.constructor.has('flatDef')) this.constructor.flatDef = Record.fullFlatDef(this.constructor);
        return this.constructor.flatDef;
      },
      
      getRelPart: function(rel) {
        // TODO: This implementation seems heuristical (error-prone). Is there a better way?
        let flatDef = this.getFlatDef();
        let { Cls1, Cls2, name1, name2, clsRel1, clsRel2 } = rel;
        if (this.isInspiredBy(Cls1) && flatDef.has(name1) && flatDef[name1] === rel) {
          return { Cls: Cls1, nameFwd: name1, nameBak: name2, clsRelFwd: clsRel1, clsRelBak: clsRel2 };
        } else if (this.isInspiredBy(Cls2) && flatDef.has(name2) && flatDef[name2] === rel) {
          return { Cls: Cls2, nameFwd: name2, nameBak: name1, clsRelFwd: clsRel2, clsRelBak: clsRel1 };
        }
        throw new Error(`${this.constructor.name} doesn't use the provided relation`);
      },
      relWob: function(rel) {
        let { nameFwd, clsRelFwd } = this.getRelPart(rel);
        let inner = this.inner ? this.inner : (this.inner = {});
        if (!inner.has(nameFwd)) inner[nameFwd] = clsRelFwd.type === '1' ? U.Wobbly({}) : U.DeltaWob({});
        return inner[nameFwd];
      },
      relWobs: function() { return this.getFlatDef().map(rel => this.relWob(rel)); },
      relVal: function(rel) { return this.relWob(rel).value; },
      
      attach: function(rel, inst) {
        // Validate then attach
        let { clsRelFwd, clsRelBak } = this.getRelPart(rel);
        clsRelFwd.attach0(this, inst); clsRelBak.attach0(inst, this);
        clsRelFwd.attach1(this, inst); clsRelBak.attach1(inst, this);
        return inst;
      },
      detach: function(rel, inst) {
        // Validate then detach
        let { clsRelFwd, clsRelBak } = this.getRelPart(rel);
        clsRelFwd.detach0(this, inst); clsRelBak.detach0(inst, this);
        clsRelFwd.detach1(this, inst); clsRelBak.detach1(inst, this);
        return inst;
      },
      isolate: function() {
        // For all our relations, detach from all related Records
        this.getFlatDef().forEach(rel => {
          let recs = this.relVal(rel);
          if (!U.isType(recs, Object)) recs = recs ? { [recs.uid]: recs } : {};
          
          // TODO: `U.safe` fixes the problem but is most likely overkill!
          // Earlier items detached may, through holds, cause later items to become
          // detached ahead of the forEach loop. Using `U.safe` ensures failures
          // are tolerated - without it there are bugs, but I haven't bothered to
          // fully understand their origin.
          recs.forEach(rec => U.safe(() => this.detach(rel, rec)));
        });
      }
    })});
    
    return { Record };
  }
});
