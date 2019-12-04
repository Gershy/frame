U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    
    // Recs are data items with a number of properties, including relational properties
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
    
    let Tidy = U.inspire({ name: 'Tidy', methods: (insp, Insp) => ({
      init: function(check=null) { if (check) this.check = check; },
      check: C.notImplemented
    })});
    let TidyArr = U.inspire({ name: 'TidyArr', insps: { Tidy }, methods: (insp, Insp) => ({
      init: function(min=null, max=null, innerTidy=null) {
        insp.Tidy.init.call(this);
        this.min = min;
        this.max = max;
        this.innerTidy = innerTidy;
      },
      check: function(arr) {
        if (!U.isType(arr, Array)) throw new Error(`Expected Array; got ${U.nameOf(arr)}`);
        if (this.min !== null && arr.length < this.min) throw new Error(`Array has ${arr.length} items; min is ${this.min}`);
        if (this.max !== null && arr.length > this.max) throw new Error(`Array has ${arr.length} items; max is ${this.max}`);
        if (this.innerTidy) for (let v of arr) this.innerTidy.check(v);
      }
    })});
    let TidyObj = U.inspire({ name: 'TidyObj', insps: { Tidy }, methods: (insp, Insp) => ({
      init: function(required=[], tidyMap={}) {
        insp.Tidy.init.call(this);
        this.required = required;
        this.tidyMap = tidyMap;
      },
      check: function(obj) {
        if (!U.isType(obj, Object)) throw new Error(`Expected Object; got ${U.nameOf(obj)}`);
        for (let r of this.required) if (!obj.has(r)) throw new Error(`Object missing required property: ${r}`);
        for (let k in obj) {
          if (!this.tidyMap.has(k)) throw new Error(`Object has unexpected property: ${k}`);
          this.tidyMap[k].check(obj[k]);
        }
      }
    })});
    
    let RecType = U.inspire({ name: 'RecType', insps: {}, methods: (insp, Insp) => ({
      
      init: function(name, RecCls=Rec, cardinality=null, ...memberTypes) {
        
        if (cardinality && cardinality.split('').find(v => v !== 'M' && v !== '1')) throw new Error(`Invalid cardinality: "${cardinality}"`);
        if (cardinality && cardinality.length !== memberTypes.length) throw new Error(`Invalid: cardinality "${cardinality}", but member types [${memberTypes.map(c => c.name).join(', ')}]`);
        
        this.name = name;
        this.RecCls = RecCls;
        this.cardinality = cardinality;
        this.memberTypes = memberTypes;
        this.tidy = null;
        
      },
      create: function(params={}, ...members) {
        
        if (members.length !== this.memberTypes.length)
          throw new Error(`RecType ${this.name} has ${this.memberTypes.length} MemberType(s), but tried to create with ${members.length}`);
        
        for (let i = 0; i < members.length; i++)
          if (members[i].type !== this.memberTypes[i])
            throw new Error(`RecType ${this.name} expects [${this.memberTypes.map(mt => mt.name).join(', ')}] but got [${members.map(m => m.type.name).join(', ')}]`);
        
        // Create GroupRec; Inform all MemberRecs of the new relation
        let relRec = this.RecCls({ ...params, type: this, members });
        members.forEach((m, i) => m.relNozz(this, i).nozz.drip(relRec));
        
        return relRec;
        
      }
      
    })});
    let Rec = U.inspire({ name: 'Rec', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
      
      $NEXT_UID: 0,
      
      init: function({ drier=null, val=null, type=null, uid=Rec.NEXT_UID++, members=[] }) {
        
        if (type === null) throw new Error(`Missing "type"`);
        if (uid === null) throw new Error(`Missing "uid"`);
        
        if (!drier) drier = defDrier(); //defDrier(Funnel(...members.map(m => m.drierNozz()))); //{ nozz: TubVal(null, Nozz()) };
        if (!drier.nozz) throw new Error('Missing "drier.nozz"');
        
        insp.Drop.init.call(this, drier);
        insp.Nozz.init.call(this);
        
        this.type = type;
        this.uid = uid;
        this.val = val;
        this.desc = `${this.type.name}@${this.uid}`;
        
        this.relNozzes = {};
        this.members = members; // GroupRecs link to all MemberRecs
        
        this.memberDryRoutes = this.members.map(mem => mem.drierNozz().route(() => this.dry()));
          
        // TODO: When MemberRecs shut, in `doShut`, they shut their
        // GroupRecs. So the following is redundant?
        // TODO: Also consider keeping this, but removing `doShut` -
        // that could free up some requirements of `relNozz()`
        /// // Any MemberRec shutting causes `this` GroupRec to shut
        /// // `this` GroupRec shutting releases all holds on MemberRecs
        /// let holds = members.map(m => m.shutFlow().hold(() => this.shut()));
        /// this.shutFlow().hold(() => holds.forEach(h => h.shut()));
        
      },
      defaultRecTypeInd: function(recType) {
        
        // Without knowing which specific index is desired, we can still
        // often make a 100% certain guess: this is possible when the
        // MemberRecs of `recType` have different RecType - this means
        // we can select the index of *our* type as the correct index.
        // Note this may have unintended consequences if `recType`
        // contains multiple MemberRecs of the same RecType!
        
        let findMatchingType = recType.memberTypes.find(m => m === this.type);
        if (!findMatchingType) throw new Error(`RecType "${this.type.name}" is not a Member of RecType "${recType.name}"`);
        return findMatchingType[1];
        
      },
      relNozz: function(recType, ind=null) {
        if (!recType) throw new Error(`Invalid recType: ${U.nameOf(recType)}`);
        if (ind === null) ind = this.defaultRecTypeInd(recType);
        
        let key = `${recType.name}.${ind}`;
        if (!this.relNozzes.has(key)) {
          if (this.type !== recType.memberTypes[ind]) throw new Error(`RecType "${this.type.name}" is not a Member of RecType "${recType.name}"`);
          let cardinality = recType.cardinality[1 - ind]; // Note that cardinality is determined by OTHER type's cardinality
          let relNozz = this.relNozzes[key] = (cardinality === 'M' ? TubSet : TubVal)(null, Nozz());
          relNozz.desc = `RelNozz for ${this.type.name} -> ${recType.name}; crd: ${cardinality === 'M' ? 'plural' : 'single'}`;
        }
        
        return this.relNozzes[key];
      },
      relRecs: function(recType, ind) { return this.relNozz(recType, ind).set; },
      relRec: function(recType, ind) { let rec = this.relNozz(recType, ind).val; return rec === C.skip ? null : rec; },
      update: function(newVal) {
        if (newVal !== this.val || U.isType(newVal, Object)) this.drip(this.val = newVal);
      },
      modify: function(fn) { this.update(fn(this.val)); },
      newRoute: function(routeFn) { routeFn(this.val); },
      onceDry: function() {
        for (let memRoute of this.memberDryRoutes) memRoute.dry();
        this.relNozzes = {};
      }
      
    })});
    
    let recTyper = () => {
      let rt = {};
      let add = (name, ...args) => rt[name] = RecType(name, ...args);
      return { rt, add };
    };
    
    return { Tidy, TidyArr, TidyObj, RecType, Rec, recTyper };
    
  }
});
