U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Records are data items with a number of properties, including relational properties
    
    let { Wobbly } = U;
    
    let Record = U.inspire({ name: 'Record', insps: { Wobbly }, methods: (insp, Insp) => ({
      $NEXT_REL_UID: 0,
      $fullFlatDef: Insp => {
        let fullDef = {};
        
        // Add on all inspiring defs (note that `Insp.insps` contains Insp)
        // TODO: Multiple inheritance can result in some defs being clobbered in this namespace...
        Insp.insps.forEach(SupInsp => SupInsp !== Insp ? fullDef.gain(Record.fullFlatDef(SupInsp)) : null);
        for (let SupInsp of Object.values(Insp.insps)) if (SupInsp !== Insp) fullDef.gain(Record.fullFlatDef(SupInsp));
        
        // Add on Insp's flat def
        fullDef.gain(Insp.has('genFlatDef') ? Insp.genFlatDef(fullDef) : {});
        
        // Add on any relational def
        fullDef.gain(Insp.has('relSchemaDef') ? Insp.relSchemaDef : {});
        
        return fullDef;
      },
      $genFlatDef: () => ({
        // type: { stability: Insp.stability.constant,
        //   change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
        //   serial: (inst) => inst.constructor.name,
        //   actual: (inst) => inst.constructor
        // },
        // uid: { stability: Insp.stability.constant,
        //   change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
        //   serial: (inst) => inst.uid,
        //   actual: (inst) => inst.uid
        // }
      }),
      
      $relateUni1: (name, Cls1, Cls2) => {
        // Attach/detach instances of Cls1 to/from instances of Cls2
        return {
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
        };
      },
      $relateUniM: (name, ClsM, Cls1) => {
        // Attach/detach instances of ClsM to/from multiple instances of Cls1
        return {
          type: 'M',
          attach0: (instM, inst1) => {
            if (inst1.uid === null) throw new Error(`Can't attach ${ClsM.name}.${name} -> ${Cls1.name}: has no uid`);
            if (instM.inner && instM.inner.has(name) && instM.inner[name].value.has(inst1.uid))
              throw new Error(`Can't attach rel ${ClsM.name}.${name} -> ${Cls1.name}: already attached`);
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
        };
      },
      
      $relate: (stability, relFunc1, relFunc2, Cls1, Cls2, name1, name2) => {
        if (U.isType(stability, String)) stability = Record.stability[stability];
        
        let key = U.multiKey(`${Cls1.uid}.${name1}`, `${Cls2.uid}.${name2}`);
        let rel = {
          key,
          desc: name1, //`${Cls1.name} >--(${name1}--${name2})--> ${Cls2.name}`, // TODO: Obviously `name1` is not descriptive of the relation; only half the relation
          uid: Record.NEXT_REL_UID++,
          stability,
          Cls1, Cls2,
          name1, name2,
          cls1Rel: relFunc1(name1, Cls1, Cls2),
          cls2Rel: relFunc2(name2, Cls2, Cls1)
        };
        
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
        Cls1.relSchemaDef[name1] = rel;
        if (!Cls2.has('relSchemaDef')) Cls2.relSchemaDef = {};
        Cls2.relSchemaDef[name2] = rel;
        
        return rel;
      },
      $relate11: (stability, Cls1, Cls2, name1, name2=name1) => {
        return Record.relate(stability, Record.relateUni1, Record.relateUni1, Cls1, Cls2, name1, name2);
      },
      $relateM1: (stability, ClsM, Cls1, nameM, name1=nameM) => {
        return Record.relate(stability, Record.relateUni1, Record.relateUniM, ClsM, Cls1, nameM, name1);
      },
      $relate1M: (stability, Cls1, ClsM, name1, nameM=name1) => {
        return Record.relate(stability, Record.relateUniM, Record.relateUni1, Cls1, ClsM, name1, nameM);
      },
      $relateMM: (stability, Cls1, Cls2, name1, name2=name1) => {
        return Record.relate(stability, Record.relateUniM, Record.relateUniM, Cls1, Cls2, name1, name2);
      },
      
      $stability: {
        secret: 0,
        trivial: 1,
        constant: 2,
        changing: 3
      },
      
      init: function({ uid }) {
        insp.Wobbly.init.call(this, { uid });
      },
      iden: function() { return `${this.constructor.name}@${this.uid}`; },
      getFlatDef: function() {
        if (!this.constructor.has('flatDef')) this.constructor.flatDef = Record.fullFlatDef(this.constructor);
        return this.constructor.flatDef;
      },
      
      getRelPart: function(rel) {
        
        let flatDef = this.getFlatDef();
        
        if (this.isInspiredBy(rel.Cls1) && flatDef.has(rel.name1) && flatDef[rel.name1] === rel) {
          
          return {
            stability: rel.stability,
            Cls: rel.Cls1,
            nameFwd: rel.name1,
            nameBak: rel.name2,
            clsRelFwd: rel.cls1Rel,
            clsRelBak: rel.cls2Rel
          };
          
        } else if (this.isInspiredBy(rel.Cls2) && flatDef.has(rel.name2) && flatDef[rel.name2] === rel) {
          
          return {
            stability: rel.stability,
            Cls: rel.Cls2,
            nameFwd: rel.name2,
            nameBak: rel.name1,
            clsRelFwd: rel.cls2Rel,
            clsRelBak: rel.cls1Rel
          };
          
        }
        
        throw new Error(`${this.constructor.name} doesn't use the provided relation`);
      },
      getInnerWob: function(rel, cheat=false) {
        let relPart = !cheat ? this.getRelPart(rel) : { nameFwd: cheat.name, clsRelFwd: { type: cheat.type } };
        
        //let relPart = this.getRelPart(rel);
        if (!this.inner) this.inner = {};
        if (!this.inner.has(relPart.nameFwd)) {
          this.inner[relPart.nameFwd] = relPart.clsRelFwd.type === '1'
            ? U.Wobbly({ value: null })
            : U.DeltaWob({});
        }
        return this.inner[relPart.nameFwd];
      },
      getInnerWobs: function() {
        return this.getFlatDef().map(rel => this.getInnerWob(rel));
      },
      getInnerVal: function(rel, cheat) {
        return this.getInnerWob(rel, cheat).value;
      },
      
      getJson: function(trail={}) {
        if (!U.isType(trail, Object) || trail.isEmpty()) return this.getValue() || {};
        
        return trail.map((trail0, k) => {
          let inner = this.inner[k].value;
          return U.isType(inner, Object)
            ? inner.map(v => v.getJson(trail0))
            : (inner === null ? null : inner.getJson(trail0));
        });
      },
      
      attach: function(rel, inst) {
        let relPart = this.getRelPart(rel);
        let [ fwd, bak ] = [ relPart.clsRelFwd, relPart.clsRelBak ];
        
        // Validate
        fwd.attach0(this, inst);
        bak.attach0(inst, this);
        
        // Perform attachment
        fwd.attach1(this, inst);
        bak.attach1(inst, this);
        
        return inst;
      },
      detach: function(rel, inst) {
        let relPart = this.getRelPart(rel);
        let [ fwd, bak ] = [ relPart.clsRelFwd, relPart.clsRelBak ];
        
        // Validate
        fwd.detach0(this, inst);
        bak.detach0(inst, this);
        
        // Perform detachment
        fwd.detach1(this, inst);
        bak.detach1(inst, this);
        
        return inst;
      },
      isolate: function() {
        this.getFlatDef().forEach(rel => {
          let recs = this.getInnerVal(rel);
          if (!U.isType(recs, Object)) recs = recs ? { [recs.uid]: recs } : {};
          recs.forEach(rec => this.detach(rel, rec));
        });
      },
      
      start: C.notImplemented, //function() { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      update: C.notImplemented, //function(secs) { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      end: C.notImplemented //function() { throw new Error(`not implemented for ${U.typeOf(this)}`); }
    })});
    
    return {
      Record
    };
  }
});
