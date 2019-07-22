U.buildRoom({
  name: 'record2',
  innerRooms: [],
  build: (foundation) => {
    // Recs are data items with a number of properties, including relational properties
    
    let { Hog, Wob, WobVal, AggWobs } = U;
    
    let WobRecCrd1 = U.inspire({ name: 'WobRecCrd1', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.rec = null;
      },
      hold: function(holdFn) {
        if (this.rec) this.toHold(holdFn, this.rec); // Call immediately
        return insp.Wob.hold.call(this, holdFn);
      },
      wobbleAdd: function(rec) {
        if (!rec) throw new Error('Invalid rec for add');
        if (this.rec) throw new Error('Already add');
        this.rec = rec;
        this.wobble(this.rec, ...this.rec.members);
        return Hog(() => { this.rec = null; });
      },
      size: function() { return this.hog ? 1 : 0; },
      toArr: function(fn) { return this.hog ? [ this.hog ].map(fn) : []; }
    })});
    let WobRecCrdM = U.inspire({ name: 'WobRecCrdM', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.recs = new Map();
      },
      hold: function(holdFn) {
        this.recs.forEach(rec => this.toHold(holdFn, rec));
        return insp.Wob.hold.call(this, holdFn);
      },
      wobbleAdd: function(rec) {
        if (this.recs.has(rec.uid)) throw new Error('Already add');
        this.recs.set(rec.uid, rec);
        this.wobble(rec, ...rec.members);
        return Hog(() => { this.recs.delete(rec.uid); });
      },
      size: function() { return this.recs.size; },
      toArr: function(fn) { return this.recs.toArr(fn); }
    })});
    
    let RecType = U.inspire({ name: 'RecType', insps: {}, methods: (insp, Insp) => ({
      
      init: function(name, RecCls=Rec, crd=null, ...memberTypes) {
        
        if (crd && crd.split('').find(v => v !== 'M' && v !== '1')) throw new Error(`Invalid cardinality: "${crd}"`);
        if (crd && crd.length !== memberTypes.length) throw new Error(`Invalid: cardinality "${crd}", but member types [${memberTypes.map(c => c.name).join(', ')}]`);
        
        if (RecCls === Rec) {
          RecCls = U.inspire({ name: `${name[0].upper()}${name.slice(1)}Rec`, insps: { Rec }, methods: (insp, Insp) => ({}) })
        }
        
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
        
        let agg = params.has('agg') ? params.agg : null;
        let defAgg = !agg;
        if (defAgg) agg = AggWobs();
        
        let wobs = members.map((m, ind) => m.relWob(this, ind));
        let err = U.safe(() => {
          wobs.forEach(w => agg.addWob(w)); // Add all Wobs to AggWobs
          wobs.forEach(w => w.wobbleAdd(relRec)); // Wobble all Wobs
        });
        agg.complete(err);
        
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
        let holds = members.map(m => m.shutWob().hold(() => this.shut()));
        this.shutWob().hold(() => holds.forEach(h => h.shut()));
        
      },
      relWob: function(recType, ind=null) {
        
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
      shut0: function(agg=null) {
        // Shutting us also shuts all GroupRecs of which we are a MemberRec
        this.relWobs.forEach(relWob => relWob.toArr(v => v).forEach(hog => hog.shut()));
      }
      
    })});
    let recTyper = () => {
      let rt = {};
      let add = (name, ...args) => rt[name] = RecType(name, ...args);
      return { rt, add };
    };
    
    return { RecType, Rec, recTyper };
    
    return {
      open: async () => {
        
        let { rt, add } = recTyper();
        add('story',        Rec),
        add('author',       Rec),
        add('entry',        Rec),
        add('storyAuthor',  Rec, 'MM', rt.story,         rt.author);
        
        let story = rt.story.create();
        let author = rt.author.create();
        let storyAuthor = rt.storyAuthor.create({}, story, author);
        
        // Wobbles occur with the GroupRec first, and then all its MemberRecs
        story.relWob(rt.storyAuthor).hold(({ members: [ _, author ] }) => {
          console.log('STORY GOT AUTHOR:', author);
        });
        
        author.relWob(rt.storyAuthor).hold(({ members: [ story, _ ] }) => {
          console.log('AUTHOR GOT STORY:', story);
        });
        
      }
    };
  }
});