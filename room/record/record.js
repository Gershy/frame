U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    
    // Recs are data items with a number of properties, including relational properties
    
    // TODO: ==== CHANGES FOR ETHER ====
    // 
    // A Rec can be out of memory WHILE:
    // true
    //   && (1. no Routes on its value OR 2. its value won't change)
    //   && (3. no Routes on relNozzes OR 4. relNozzes won't drip)
    //   && (5. no Routes on drierNozz OR 6. Rec won't dry)
    // 
    // HINTERLANDS:
    // 1. routes Rec value for Follow ("updRec")
    // 2. only updates Rec values when its updated (LandsAbove will
    //    never update value!)
    // 3. never routes relNozzes
    // 4. ^^
    // 5. listens to all drierNozzes of freshly created Recs (to
    //    determine when to remove them from "allRecs")
    // 6. dries Recs only for "remRec" update (so Above is safe).
    //    dries Huts when their Cpu dries (Huts won't be saved to Ether)
    // 
    // RECORD:
    // 1. never Routes Rec values
    // 2. never changes Rec values
    // 3. never Routes relNozzes
    // 4. drips relNozzes of MemberRecs when they join a GroupRec
    // 5. routes DrierNozzes to dry GroupRec upon MemberRec drying
    // 6. dries GroupRecs when any MemberRec dries
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, TubCnt, Scope, defDrier } = U.water;
    
    let RecTypes = U.inspire({ name: 'RecTypes', insps: {}, methods: (insp, Insp) => ({
      init: function() { this.typeMap = {}; },
      desc: function() { return 'RecTypes'; },
      ensure: function(name, type) {
        if (this.typeMap.has(name) && this.typeMap[name] === type)
          throw Error(`Multiple instances of type "${name}"`);
        this.typeMap[name] = type;
      },
      getType: function(name) {
        return this.typeMap.has(name) ? this.typeMap[name] : (this.typeMap[name] = RecType(name, this));
      },
      getNextRecUid: function() { return null; },
      createRec: function(name, members, val) {
        return Rec(this.getType(name), this.getNextRecUid(), members, val);
      }
    })});
    let RecType = U.inspire({ name: 'RecType', insps: {}, methods: (insp, Insp) => ({
      init: function(name, types=RecTypes()) {
        
        if (!name.match(/[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*/))
          throw Error(`Invalid RecType name: ${name}`);
        
        this.name = name;
        this.types = types;
        this.types.ensure(this.name, this);
        
        this.memberInfoNozz = TubSet(null, Nozz()); // TODO: A "TubMap" would serve this purpose better...
        this.terms = {};
        this.memberInfoNozz.route(mi => { this.terms[mi.term] = mi; });
        
      },
      updMembers: function(recTypes) {
        
        let newRecTypes = []; // Terms that have never been seen before
        let defRecTypes = []; // RecTypes corresponding to Terms whose RecType was previously unknown
        
        recTypes.forEach((recType, term) => {
          let findMemInf = this.memberInfoNozz.set.find(mi => mi.term === term);
          let curRt = findMemInf ? findMemInf[0].recType : null;
          
          if (findMemInf && curRt && curRt !== recType) {
            throw Error(`RecType ${this.name} already has ${term}->${findMemInf[0].recType.name}; tried to supply ${term}->${recType.name}`);
          }
          
          if (!findMemInf) newRecTypes.push({ term, recType });
          else if (!curRt) defRecTypes.push({ memInf: findMemInf[0], recType });
        });
        
        for (let { memInf, recType } of defRecTypes) memInf.recType = recType;
        for (let nrt of newRecTypes) this.memberInfoNozz.nozz.drip(nrt);
        
      }
    })});
    let Rec = U.inspire({ name: 'Rec', insps: { Drop, Nozz }, methods: (insp, Insp) => ({
      init: function(type, uid, members={}, val=null) {
        if (U.isType(members, Array)) members = members.toObj(mem => [ mem.type.name, mem ]);
        
        type.updMembers(members.map(m => m.type));
        
        console.log(`NEW ${type.name} @ ${uid} (${members.toArr((m, t) => `${t}: ${m.type.name}`)})`);
        
        insp.Drop.init.call(this, defDrier());
        insp.Nozz.init.call(this);
        
        this.type = type;
        this.uid = uid;
        this.val = val;
        this.members = members;
        this.relNozzes = {};
        
        // Set us up to dry if any MemberRec dries
        let dryMe = this.dry.bind(this);
        this.memDryRoutes = Set(this.members.toArr(m => m ? m.drierNozz() : C.skip)) . toArr(dn => dn.route(dryMe));
        
        // Inform all MemberRecs of this GroupRec
        this.members.forEach((m, t) => m.relNozz(this.type, t).nozz.drip(this));
        
      },
      desc: function() { return `${this.type.name} @ ${this.uid}`; },
      mem: function(termTail) {
        if (termTail[0] !== '.') termTail = `.${termTail}`;
        for (let term in this.members) if (term.has(termTail)) return this.members[term];
        return null;
      },
      relNozz: function(recType, term = null) {
        
        if (U.isType(recType, String)) recType = this.type.types.getType(recType);
        
        if (term === null) {
          
          let findMemInf = recType.memberInfoNozz.set.find(mi => mi.recType === this.type);
          let memInf = null;
          if (!findMemInf) {
            // TODO: What if somehow `this.type.name` is already a term
            // for a different type?? Then we'd need to try another
            // "made up" term, like `${this.type.name}/2` or something
            // silly like that
            recType.updMembers({ [this.type.name]: this.type });
            term = this.type.name;
          } else {
            term = findMemInf[0].term;
          }
          
        }
        
        if (!U.isType(term, String)) throw Error(`Invalid "term" of type ${U.nameOf(term)}`);
        
        let key = `${recType.name}/${term}`;
        if (!this.relNozzes.has(key)) {
          this.relNozzes[key] = TubSet(null, Nozz());
          this.relNozzes[key].desc = `RelNozz: ${this.type.name} -> ${recType.name} (${term})`;
        }
        
        return this.relNozzes[key];
      },
      relRecs: function(recType, term) { return this.relNozz(recType, term).set; },
      relRec: function(recType, term) { for (let r of this.relNozz(recType, term).set) return r; return null; },
      setVal: function(newVal) {
        if (newVal !== this.val || U.isType(newVal, Object)) this.drip(this.val = newVal);
        return this;
      },
      modVal: function(fn) { return this.setVal(fn(this.val)); },
      newRoute: function(routeFn) { routeFn(this.val); },
      onceDry: function() {
        for (let memRoute of this.memDryRoutes) memRoute.dry();
        this.relNozzes = {};
        this.members = {};
      }
    })});
    
    let RecScope = U.inspire({ name: 'RecScope', insps: { Scope }, methods: (insp, Insp) => ({
      init: function(...args) {
        if (args.length === 3) {
          let [ rec, term, fn ] = args;
          insp.Scope.init.call(this, rec.relNozz(...term.split('/')), fn);
        } else if (args.length === 2) {
          let [ nozz, fn ] = args;
          insp.Scope.init.call(this, nozz, fn);
        } else {
          throw Error(`Expected 3 or 2 args; received ${args.length}`);
        }
      }
    })});
    
    return { RecTypes, RecType, Rec, RecScope };
    
  }
});
