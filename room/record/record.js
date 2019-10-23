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
        if (this.rec) throw new Error(`Already add: ${this.rec.type.name}`);
        this.rec = rec;
        insp.Wob.wobble.call(this, this.rec, ...this.rec.members);
        return Hog(() => { this.rec = null; });
      },
      size: function() { return this.rec ? 1 : 0; },
      toArr: function(fn) { return this.rec ? [ this.rec ].map(fn) : []; }
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
        if (this.recs.has(rec.uid)) throw new Error(`Already add: ${this.recs.get(rec.uid).type.name}`);
        this.recs.set(rec.uid, rec);
        insp.Wob.wobble.call(this, rec, ...rec.members);
        return Hog(() => { this.recs.delete(rec.uid); });
      },
      size: function() { return this.recs.size; },
      toArr: function(fn) { return this.recs.toArr(fn); }
    })});
    
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
        
        members = members.toArr(v => v); // Will be handed off by reference. TODO: Is cloning necessary?
        
        if (members.length !== this.memberTypes.length)
          throw new Error(`RecType ${this.name} has ${this.memberTypes.length} MemberType(s), but tried to create with ${members.length}`);
        
        for (let i = 0; i < members.length; i++)
          if (members[i].type !== this.memberTypes[i])
            throw new Error(`RecType ${this.name} expects [${this.memberTypes.map(v => v.name).join(', ')}] but got [${members.map(m => m.type.name).join(', ')}]`);
        
        let relRec = this.RecCls({ ...params, type: this, members });
        
        let squad = params.has('squad') ? params.squad : null;
        let defAgg = !squad;
        if (defAgg) squad = WobSquad();
        
        let wobs = members.map((m, ind) => m.relWob(this, ind));
        let err = U.safe(() => {
          
          // Wobble all Wobs
          wobs.forEach(w => {
            // Add the Rec; remove it when the Rec shuts
            let addHog = squad.wobble(w, relRec);
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
      //m: function(ind) { return this.members[ind]; },
      relWob: function(recType, ind=null) {
        
        if (!recType) throw new Error(`Invalid recType: ${U.nameOf(recType)}`);
        
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
          let cardinality = recType.cardinality[1 - ind]; // Note that `WobRec*` class is determined by OTHER type's cardinality
          this.relWobs[key] = cardinality === 'M' ? WobRecCrdM() : WobRecCrd1();
          
        }
        
        return this.relWobs[key];
        
      },
      relRecs: function(recType, ind=null) { return this.relWob(recType, ind).toArr(v => v); }, // TODO: Inefficient!
      relRec: function(recType, ind=null) { return this.relRecs(recType, ind)[0] || null; }, // TODO: Inefficient!
      shut0: function(group=Set()) {
        // Shutting us also shuts all GroupRecs of which we are a MemberRec
        // Note that any double-shuts encountered here are tolerated
        this.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(rec => rec.isShut() || rec.shut(group)));
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
