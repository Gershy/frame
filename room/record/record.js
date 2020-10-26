global.rooms.record = async foundation => {
  
  let { Endable, Src, MemSrc, Tmp, TmpAll, TmpAny, Scope } = U.logic;
  
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
    getRecCls: function(name, mems, val) { return Rec; },
    createRec: function(name, mems, val) {
      let RecCls = this.getRecCls(name, mems, val);
      return RecCls(this.getType(name), this.getNextRecUid(), mems, val);
    }
  })});
  let RecType = U.inspire({ name: 'RecType', insps: {}, methods: (insp, Insp) => ({
    init: function(name, types=RecTypes()) {
      
      if (!name.match(/^[a-z][a-zA-Z0-9]*[.][a-z][a-zA-Z0-9]*$/)) throw Error(`Invalid RecType name: ${name}`);
      if (types.typeMap.has(name) && types.typeMap[name] === this) throw Error(`Multiple instances of type "${name}"`);
      
      this.name = name;
      this.types = types;
      
      types.typeMap[name] = this;
      
      this.memberInfoSrc = MemSrc.PrmM(Src());
      this.terms = {};
      this.memberInfoSrc.route(mi => { this.terms[mi.term] = mi; });
      this.validators = [
        (hut, type, value) => ({ valid: false, value: null })
      ];
      
    },
    updMems: function(recTypes) {
      
      let newRecTypes = []; // Terms that have never been seen before
      let defRecTypes = []; // RecTypes corresponding to Terms whose RecType was previously unknown
      
      recTypes.forEach((recType, term) => {
        let memInf = this.memberInfoSrc.vals.find(mi => mi.term === term).val;
        let curRt = memInf ? memInf.recType : null;
        
        if (memInf && curRt && curRt !== recType && term.slice(-1) !== '?') {
          throw Error(`RecType ${this.name} already has ${term}->${memInf.recType.name}; tried to supply ${term}->${recType.name}`);
        }
        
        if (!memInf)      newRecTypes.push({ term, recType });
        else if (!curRt)  defRecTypes.push({ memInf, recType });
      });
      
      for (let { memInf, recType } of defRecTypes) memInf.recType = recType;
      for (let nrt of newRecTypes) this.memberInfoSrc.src.send(nrt);
      
    }
  })});
  let Rec = U.inspire({ name: 'Rec', insps: { Tmp }, methods: (insp, Insp) => ({
    init: function(type, uid, mems={}, val=null) {
      if (U.isType(mems, Array)) mems = mems.toObj(mem => [ mem.type.name, mem ]);
      type.updMems(mems.map(m => m.type));
      
      insp.Tmp.init.call(this);
      
      this.type = type;
      this.uid = uid;
      this.mems = mems;
      this.relSrcs = {};
      this.relTermSrc = MemSrc.PrmM(Src());
      
      this.valSrc = MemSrc.Prm1(Src());
      this.valSrc.src.send(val);
      
      // Set us up to dry if any MemberRec dries
      this.allMemsTmp = TmpAll(this.mems.toArr(m => m || C.skip));
      this.allMemsTmp.endWith(this); // If any Mem ends, we end
      
      // Inform all MemberRecs of this GroupRec
      for (let [ term, mem ] of this.mems) mem.relSrc(this.type, term).src.send(this);
    },
    desc: function() { return `${this.type.name} @ ${this.uid}`; },
    mem: function(termTail) {
      // TODO: This is ugly!
      if (termTail[0] !== '.') termTail = `.${termTail}`;
      for (let term in this.mems) if (term.has(termTail)) return this.mems[term];
      return null;
    },
    getRecJurisdiction: function*() {
      yield this;
      for (let [ , mem ] of this.mems) yield* mem.getRecJurisdiction();
    },
    relSrc: function(recType, term=null) {
      
      if (U.isType(recType, String)) {
        if (recType.has('/')) [ recType, term ] = recType.split('/');
        recType = this.type.types.getType(recType);
      }
      
      if (term === null) {
        
        let memInf = recType.memberInfoSrc.vals.find(mi => mi.recType === this.type).val;
        if (!memInf) {
          // TODO: What if somehow `this.type.name` is already a term
          // for a different type?? Then we'd need to try another
          // "made up" term, like `${this.type.name}/2` or something
          // silly like that
          recType.updMems({ [this.type.name]: this.type });
          term = this.type.name;
        } else {
          term = memInf.term;
        }
        
      }
      
      if (!U.isType(term, String)) throw Error(`Invalid "term" of type ${U.nameOf(term)}`);
      
      let key = `${recType.name}/${term}`;
      if (!this.relSrcs.has(key)) {
        this.relSrcs[key] = MemSrc.TmpM(Src());
        this.relSrcs[key].desc = `RelSrc: ${this.type.name} -> ${recType.name} (${term})`;
        this.relTermSrc.src.send(key);
      }
      return this.relSrcs[key];
      
    },
    relRecs: function(recType, term) { return this.relSrc(recType, term).vals; },
    relRec: function(recType, term) { for (let r of this.relRecs(recType, term)) return r; return null; },
    getVal: function() { return this.valSrc.val; },
    setVal: function(newVal) {
      if (newVal !== this.valSrc.val || U.isType(newVal, Object)) this.valSrc.src.send(newVal);
      return this;
    },
    modVal: function(fn) { return this.setVal(fn(this.getVal())); },
    dltVal: function(delta=null) {
      
      // Note that when `someRec.valSrc.route(val => { ... })` sends
      // there are two values available: first, `val` represents a
      // *delta*; aka only any fields that have changed. Second, the
      // complete value is always available via `someRec.getVal()`
      
      // Ignore any empty deltas
      if (!delta || delta.isEmpty()) return;
      
      // Note that we manually set and send the val - this is so that
      // the full val gets set first, and then only the delta is sent.
      // This allows consuming code to detect that certain properties
      // have not changed, which may allow unnecessary reactions to be
      // avoided.
      this.valSrc.val = { ...this.getVal(), ...delta };
      this.valSrc.send(delta);
      return this;
      
    },
    
    end: function() {
      if (!insp.Tmp.end.call(this)) return false;
      this.allMemsTmp.end();
      this.relSrcs = {};
      this.relTermSrc.end();
      return true;
    }
    
  })});
  
  let RecScope = U.inspire({ name: 'RecScope', insps: { Scope }, methods: (insp, Insp) => ({
    init: function(...args) {
      if (args.length === 3) {
        let [ rec, term, fn ] = args;
        insp.Scope.init.call(this, rec.relSrc(...term.split('/')), fn);
      } else if (args.length === 2) {
        let [ src, fn ] = args;
        insp.Scope.init.call(this, src, fn);
      } else {
        throw Error(`Expected 3 or 2 args; received ${args.length}`);
      }
    }
  })});
  
  return { RecTypes, RecType, Rec, RecScope };
  
};
