U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    let Record = U.inspire({ name: 'Record', methods: (insp, Insp) => ({
      $fullFlatDef: Insp => {
        let fullDef = {};
        Insp.insps.forEach(SupInsp => SupInsp !== Insp ? fullDef.gain(Record.fullFlatDef(SupInsp)) : null);
        for (let SupInsp of Object.values(Insp.insps)) if (SupInsp !== Insp) fullDef.gain(Record.fullFlatDef(SupInsp));
        if (!Insp.has('genFlatDef')) throw new Error(`Insp ${Insp.name} doesn't support 'genFlatDef'`);
        fullDef.gain(Insp.genFlatDef(fullDef));
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
        let syncFunc = (inst1, link1, inst2, link2) => {
          if (stability < C.stability.delta) return;
          let world = inst1.world || inst2.world;
          if (!world) return;
          world.updRecord(inst1, { [link1]: 1 });
          world.updRecord(inst2, { [link2]: 1 });
        };
        let both = [
          [ Cls1, link1, Cls2, link2 ],
          [ Cls2, link2, Cls1, link1 ]
        ];
        for (let [ Cls1, link1, Cls2, link2 ] of both) {
          if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
          Cls1.relSchemaDef[link1] = ((link1, link2) => ({
            stability,
            change: (inst1, p, act=p.act, inst2=p[link1] || p.rec || inst1[link1]) => ({
              attach: (inst1, inst2) => {
                if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
                if (inst2[link2]) throw new Error(`Can't attach rel "${name}" (already have ${inst2.constructor.name}'s ${link2})`);
                inst1[link1] = inst2;
                inst2[link2] = inst1;
                syncFunc(inst1, link1, inst2, link2);
              },
              detach: (inst1, inst2) => {
                if (inst1[link1] !== inst1) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
                inst1[link1] = null;
                inst2[link2] = null;
                syncFunc(inst1, link1, inst2, link2);
              }
            })[act](inst1, inst2),
            serial: (inst1) => inst1[link1] ? inst1[link1].uid : null,
            actual: (inst1) => inst1[link1]
          }))(link1, link2);
        }
      },
      $relateM1: (stability, name, Cls1, link1, ClsM, linkM) => {
        let syncFunc = (inst1, instM) => {
          if (stability < Record.stability.changing) return;
          inst1.world.updRecord(inst1, { [link1]: 1 });
          inst1.world.updRecord(instM, { [linkM]: 1 });
        };
        if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
        Cls1.relSchemaDef[link1] = { stability,
          change: (inst1, p, act=p.act, instM=p[link1] || p.rec || inst1[link1]) => ({
            attach: (inst1, instM) => {
              if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
              inst1[link1] = instM;
              instM[linkM][inst1.uid] = inst1;
              syncFunc(inst1, instM);
            },
            detach: (inst1, instM) => {
              if (inst1[link1] !== instM) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
              inst1[link1] = null;
              delete instM[linkM][inst1.uid];
              syncFunc(inst1, instM);
            }
          })[act](inst1, instM),
          serial: (inst1) => inst1[link1] ? inst1[link1].uid : null,
          actual: (inst1) => inst1[link1]
        };
        if (!ClsM.has('relSchemaDef')) ClsM.relSchemaDef = {};
        ClsM.relSchemaDef[linkM] = { stability,
          change: (instM, p, act=p.act, inst1=p[link1] || p.rec) => ({
            attach: (instM, inst1) => {
              if (inst1[link1]) throw new Error(`Can't attach rel "${name}" (already have ${inst1.constructor.name}'s ${link1})`);
              inst1[link1] = instM;
              instM[linkM][inst1.uid] = inst1;
              syncFunc(inst1, instM);
            },
            detach: (instM, inst1) => {
              if (inst1[link1] !== instM) throw new Error(`Can't detach rel "${name}" (isn't attached)`);
              inst1[link1] = null;
              delete instM[linkM][inst1.uid];
              syncFunc(inst1, instM);
            }
          })[act](instM, inst1),
          serial: (instM) => instM[linkM].map(ent => 1), // Only the keys are important
          actual: (instM) => instM[linkM]
        };
      },
      $relate1M: (stability, name, ClsM, linkM, Cls1, link1) => {
        Record.relateM1(stability, name, Cls1, link1, ClsM, linkM);
      },
      $relateMM: (stability, name, Cls1, link1, Cls2, link2) => {
        let syncFunc = (inst1, link1, inst2, link2) => {
          if (stability < Record.stability.changing) return;
          inst1.world.updRecord(inst1, { [link1]: 1 });
          inst1.world.updRecord(inst2, { [link2]: 1 });
        };
        let both = [
          [ Cls1, link1, Cls2, link2 ],
          [ Cls2, link2, Cls1, link1 ]
        ];
        for (let [ Cls1, link1, Cls2, link2 ] of both) {
          if (!Cls1.has('relSchemaDef')) Cls1.relSchemaDef = {};
          Cls1.relSchemaDef[link1] = ((link1, link2) => ({ stability,
            change: (inst1, p, act=p.act, inst2=p[link1] || p.rec || inst1[link1]) => ({
              attach: (inst1, inst2) => {
                inst1[link1][inst2.uid] = inst2;
                inst2[link2][inst1.uid] = inst1;
                syncFunc(inst1, link1, inst2, link2);
              },
              detach: (inst1, inst2) => {
                delete inst1[link1][inst2.uid];
                delete inst2[link2][inst1.uid];
                syncFunc(inst1, link1, inst2, link2);
              }
            })[act](inst1, inst2),
            serial: (inst1) => inst1[link1].map(ent => 1),
            actual: (inst1) => inst1[link1]
          }))(link1, link2);
        }
      },
      $stability: {
        secret: 0,
        trivial: 1,
        constant: 2,
        changing: 3
      },
      init: function({}) {
        this.uid = null;
      },
      getFlatDef: function() {
        if (!this.constructor.has('flatDef')) this.constructor.flatDef = Record.fullFlatDef(this.constructor);
        return this.constructor.flatDef;
      },
      mod: function(propName, newVal) {
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
        let ret = {};
        for (let [ k, { stability, serial } ] of Object.entries(this.getFlatDef())) if (stability >= Record.stability.constant) ret[k] = serial(this);
        return ret;
      },
      setUid: function(uid) {
        if (this.uid !== null) throw new Error(`Can't set new uid for ${this.uid}`);
        let cnst = (() => { try { return uid.constructor } catch(err) { return null; } })();
        if (cnst !== String && (cnst !== Number || uid !== uid)) throw new Error(`Invalid uid: ${uid}`);
        this.uid = uid;
      },
      start: function() { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      update: function(secs) { throw new Error(`not implemented for ${U.typeOf(this)}`); },
      end: function() { throw new Error(`not implemented for ${U.typeOf(this)}`); }
    })});
    return {
      Record
    };
  }
});