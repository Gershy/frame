U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Records are data items with a number of properties, including relational properties
    
    let { Wobbly } = U;
    
    let Record = U.inspire({ name: 'Record', insps: { Wobbly }, methods: (insp, Insp) => ({
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
        type: { stability: Insp.stability.constant,
          change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
          serial: (inst) => inst.constructor.name,
          actual: (inst) => inst.constructor
        },
        uid: { stability: Insp.stability.constant,
          change: (inst, val) => { throw new Error('Can\'t modify this prop'); },
          serial: (inst) => inst.uid,
          actual: (inst) => inst.uid
        }
      }),
      $relate11: (stability, name, Cls1, link1, Cls2, link2) => {
        // For 1-to-1, links are pointer names
        
        let both = [
          [ Cls1, link1, Cls2, link2 ],
          [ Cls2, link2, Cls1, link1 ]
        ];
        
        for (let [ Cls1, link1, Cls2, link2 ] of both) {
          
          if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
          Cls1.relSchemaDef[link1] = ((link1, link2) => ({
            stability,
            change: (inst1, p, act=p.act, inst2=p[link1] || p.rec || inst1.inner[link1]) => ({
              attach: (inst1, inst2) => {
                let [ i1, i2 ] = [ inst1.inner || {}, inst2.inner || {} ];
                if (i1.has(link1)) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
                if (i2.has(link2)) throw new Error(`Can't attach rel "${name}" (already have ${inst2.constructor.name}'s ${link2})`);
                i1[link1] = inst2;
                i2[link2] = inst1;
                inst1.inner = i1;
                inst2.inner = i2;
                if (inst1.attachWob) inst1.attachWob.wobble([ name, inst2, link1, link2 ]);
                if (inst2.attachWob) inst2.attachWob.wobble([ name, inst1, link2, link1 ]);
              },
              detach: (inst1, inst2) => {
                if (!inst1.inner || inst1.inner[link1] !== inst2) throw new Error(`Can't detach rel "${name}" (missing ${inst1.constructor.name}'s ${link1})`);
                inst1.inner[link1] = null;
                inst2.inner[link2] = null;
                if (inst1.inner.isEmpty()) delete inst1.inner;
                if (inst2.inner.isEmpty()) delete inst2.inner;
                if (inst1.detachWob) inst1.detachWob.wobble([ name, inst2, link1, link2 ]);
                if (inst2.detachWob) inst2.detachWob.wobble([ name, inst1, link2, link1 ]);
              }
            })[act](inst1, inst2),
            serial: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner[link1].uid : null,
            actual: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner[link1] : null
          }))(link1, link2);
          
        }
        
      },
      $relateM1: (stability, name, Cls1, link1, ClsM, linkM) => {
        // For M-to-1, the 1 links with a pointer and the M links back with a map
        // Cls1 is the singular instance, ClsM links to many instances of Cls1
        
        // TODO: without serial/actual, the following 2 schema defs are exactly
        // the same except for attach/detach parameter order
        
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
        Cls1.relSchemaDef[link1] = { stability,
          change: (inst1, p, act=p.act, instM=p[link1] || p.rec || inst1.inner[link1]) => ({
            attach: (inst1, instM) => {
              let [ i1, iM ] = [ inst1.inner || {}, instM.inner || {} ];
              if (i1.has(link1)) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
              i1[link1] = instM;
              if (!iM.has(linkM)) iM[linkM] = {};
              iM[linkM][inst1.uid] = inst1;
              inst1.inner = i1;
              instM.inner = iM;
              if (inst1.attachWob) inst1.attachWob.wobble([ name, instM, link1, linkM ]);
              if (instM.attachWob) instM.attachWob.wobble([ name, inst1, linkM, link1 ]);
            },
            detach: (inst1, instM) => {
              if (!inst1.inner || inst1.inner[link1] !== instM) throw new Error(`Can't detach rel "${name}" (missing ${inst1.constructor.name}'s ${link1})`);
              inst1.inner[link1] = null;
              delete instM.inner[linkM][inst1.uid];
              if (instM.inner[linkM].isEmpty()) delete instM.inner[linkM];
              if (inst1.inner.isEmpty()) delete inst1.inner;
              if (instM.inner.isEmpty()) delete instM.inner;
              if (inst1.detachWob) inst1.detachWob.wobble([ name, instM, link1, linkM ]);
              if (instM.detachWob) instM.detachWob.wobble([ name, inst1, linkM, link1 ]);
            }
          })[act](inst1, instM),
          serial: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner[link1].uid : null,
          actual: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner[link1] : null
        };
        
        if (!ClsM.has('relSchemaDef')) ClsM.relSchemaDef = {};
        ClsM.relSchemaDef[linkM] = { stability,
          change: (instM, p, act=p.act, inst1=p[link1] || p.rec) => ({
            attach: (instM, inst1) => {
              let [ i1, iM ] = [ inst1.inner || {}, instM.inner || {} ];
              if (i1.has(link1)) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
              i1[link1] = instM;
              if (!iM.has(linkM)) iM[linkM] = {};
              iM[linkM][inst1.uid] = inst1;
              inst1.inner = i1;
              instM.inner = iM;
              if (inst1.attachWob) inst1.attachWob.wobble([ name, instM, link1, linkM ]);
              if (instM.attachWob) instM.attachWob.wobble([ name, inst1, linkM, link1 ]);
            },
            detach: (instM, inst1) => {
              if (!inst1.inner || inst1.inner[link1] !== instM) throw new Error(`Can't detach rel "${name}" (missing ${inst1.constructor.name}'s ${link1})`);
              inst1.inner[link1] = null;
              delete instM.inner[linkM][inst1.uid];
              if (instM.inner[linkM].isEmpty()) delete instM.inner[linkM];
              if (inst1.inner.isEmpty()) delete inst1.inner;
              if (instM.inner.isEmpty()) delete instM.inner;
              if (inst1.detachWob) inst1.detachWob.wobble([ name, instM, link1, linkM ]);
              if (instM.detachWob) instM.detachWob.wobble([ name, inst1, linkM, link1 ]);
            }
          })[act](instM, inst1),
          serial: (instM) => instM.inner && instM.inner.has(linkM) ? instM.inner[linkM].map(ent => 1) : {}, // Only the keys are important
          actual: (instM) => instM.inner && instM.inner.has(linkM) ? instM.inner[linkM] : {}
        };
          
      },
      $relate1M: (stability, name, ClsM, linkM, Cls1, link1) => {
        Record.relateM1(stability, name, Cls1, link1, ClsM, linkM);
      },
      $relateMM: (stability, name, Cls1, link1, Cls2, link2) => {
        
        // For M-to-M, links are maps of uids
        
        let both = [
          [ Cls1, link1, Cls2, link2 ],
          [ Cls2, link2, Cls1, link1 ]
        ];
        
        for (let [ Cls1, link1, Cls2, link2 ] of both) {
          
          if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
          Cls1.relSchemaDef[link1] = ((link1, link2) => ({ stability,
            change: (inst1, p, act=p.act, inst2=p[link1] || p.rec || inst1[link1]) => ({
              attach: (inst1, inst2) => {
                let [ i1, i2 ] = [ inst1.inner || {}, inst2.inner || {} ];
                if (i1.has(link1) && i1[link1].has(inst2.uid)) throw new Error(`Can't attach rel "${name}" (already attached)`);
                if (!i1.has(link1)) i1[link1] = {};
                if (!i2.has(link2)) i2[link2] = {};
                i1[link1][inst2.uid] = inst2;
                i2[link2][inst1.uid] = inst1;
                inst1.inner = i1;
                inst2.inner = i2;
                if (inst1.attachWob) inst1.attachWob.wobble([ name, inst2, link1, link2 ]);
                if (inst2.attachWob) inst2.attachWob.wobble([ name, inst1, link2, link1 ]);
              },
              detach: (inst1, inst2) => {
                if (!inst1.inner || !inst1.inner.has(link1) || !inst1.inner[link1].has(inst2.uid))
                  throw new Error(`Can't detach rel "${name}" (already detached)`);
                delete inst1.inner[link1][inst2.uid];
                delete inst2.inner[link2][inst1.uid];
                if (inst1.inner[link1].isEmpty()) delete inst1.inner[link1];
                if (inst2.inner[link2].isEmpty()) delete inst2.inner[link2];
                if (inst1.inner.isEmpty()) delete inst1.inner;
                if (inst2.inner.isEmpty()) delete inst2.inner;
                if (inst1.detachWob) inst1.detachWob.wobble([ name, inst2, link1, link2 ]);
                if (inst2.detachWob) inst2.detachWob.wobble([ name, inst1, link2, link1 ]);
              }
            })[act](inst1, inst2),
            serial: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner.map(ent => 1) : {},
            actual: (inst1) => inst1.inner && inst1.inner.has(link1) ? inst1.inner : {}
          }))(link1, link2);
          
        }
        
      },
      $stability: {
        secret: 0,
        trivial: 1,
        constant: 2,
        changing: 3
      },
      
      init: function({ uid }) {
        insp.Wobbly.init.call(this, { uid });
        // this.inner = {};
      },
      getFlatDef: function() {
        if (!this.constructor.has('flatDef')) this.constructor.flatDef = Record.fullFlatDef(this.constructor);
        return this.constructor.flatDef;
      },
      getInner: function(addr) {
        if (U.isType(addr, String)) addr = addr.split('/');
        return addr.reduce((ptr, link) => ptr.getFlatDef()[link].actual(ptr), this);
      },
      getInnerValue: function(addr) {
        return this.getInner(addr).getValue();
      },
      
      getAttachWob: function() {
        if (!this.attachWob) this.attachWob = U.BareWob({});
        return this.attachWob;
      },
      getDetachWob: function() {
        if (!this.detachWob) this.detachWob = U.BareWob({});
        return this.detachWob;
      },
      
      getStability: function() { return Record.stability.secret; },
      getSerialValue: function() { return this.getValue(); },
      
      getSerialized: function() {
        let { constant } = Record.stability;
        return this.has('inner')
          ? this.inner.map(inn => inn.getStability() >= constant ? inn.getSerialized() : C.skip)
          : this.getSerialValue();
      },
      
      attach: function(link, inst) {
        let flatDef = this.getFlatDef();
        if (!flatDef.has(link)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${link}`);
        flatDef[link].change(this, { act: 'attach', rec: inst });
        return inst;
      },
      detach: function(link, inst) {
        let flatDef = this.getFlatDef();
        if (!flatDef.has(link)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${link}`);
        flatDef[link].change(this, { act: 'detach', rec: inst });
        return inst;
      },
      
      /*mod: function(propName, newVal) {
        let flatDef = this.getFlatDef();
        if (!flatDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${propName}`);
        let { change, stability } = flatDef[propName];
        change(this, newVal);
        if (this.world && stability >= Record.stability.changing) this.world.updRecord(this, { [propName]: 1 });
      },
      modF: function(propName, f) {
        let flatDef = this.getFlatDef();
        if (!flatDef.has(propName)) throw new Error(`Unsupported property: ${this.constructor.name}.flatDef.${propName}`);
        let { change, stability, actual, serial } = flatDef[propName];
        let oldVal = (actual || serial)(this);
        let newVal = f(oldVal);
        if (newVal === oldVal) return false; // TODO: should "actual" be optional?
        change(this, newVal);
        if (this.world && stability >= Record.stability.changing) this.world.updRecord(this, { [propName]: 1 });
        return true;
      },
      serializePart: function(fieldMap) {
        let flatDef = this.getFlatDef();
        return fieldMap.map((v, k) => flatDef[k].serial(this));
      },
      serializeFull: function() {
        return this.getFlatDef().map(
          ({ stability, serial }) => stability < Record.stability.constant ? serial(this) : C.skip
        );
      },*/
      start: C.notImplemented, //function() { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      update: C.notImplemented, //function(secs) { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      end: C.notImplemented //function() { throw new Error(`not implemented for ${U.typeOf(this)}`); }
    })});
    
    return {
      Record
    };
  }
});
