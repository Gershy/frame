U.buildRoom({
  name: 'record',
  innerRooms: [],
  build: (foundation) => {
    // Recs are data items with a number of properties, including relational properties
    
    let { Hog, Wob, WobVal } = U;
    
    let WobRecVal = U.inspire({ name: 'WobRecVal', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.hog = null;
      },
      hold: function(fn) {
        if (this.hog) fn(this.hog); // Call immediately
        return insp.Wob.hold.call(this, fn);
      },
      forEach: function(fn) { if (this.hog) fn(this.hog); },
      isEmpty: function() { return !this.hog; },
      toArr: function() { return this.hog ? [ this.hog ] : []; },
      find: function(fn) { return (this.hog && fn(this.hog)) ? this.hog : null; },
      size: function() { return this.hog ? 1 : 0; },
      wobbleAdd: function(hog) {
        if (!hog) throw new Error('Invalid hog for add');
        if (this.hog) throw new Error('Already add');
        this.hog = hog;
        this.wobble(this.hog);
        return Hog(() => { this.hog = null; });
      }
    })});
    let WobRecArr = U.inspire({ name: 'WobRecArr', insps: { Wob }, methods: (insp, Insp) => ({
      init: function() {
        insp.Wob.init.call(this);
        this.hogs = new Set();
      },
      hold: function(fn) {
        this.hogs.forEach(fn);
        return insp.Wob.hold.call(this, fn);
      },
      forEach: function(fn) { this.hogs.forEach(fn); },
      isEmpty: function() { return this.hogs.size === 0; },
      toArr: function() { return [ ...this.hogs ]; },
      find: function(fn) {
        for (let hog of this.hogs) if (fn(hog)) return hog;
        return null;
      },
      size: function() { return this.hogs.size; },
      wobbleAdd: function(hog) {
        if (this.hogs.has(hog)) throw new Error('Already add');
        this.hogs.add(hog);
        this.wobble(hog);
        return Hog(() => { this.hogs.delete(hog); });
      }
    })});
    let WobRecObj = U.inspire({ name: 'WobRecObj', insps: { Wob }, methods: (insp, Insp) => ({
      init: function(getKey) {
        insp.Wob.init.call(this);
        this.hogs = new Map();
        this.getKey = getKey;
      },
      hold: function(fn) {
        this.hogs.forEach(fn);
        return insp.Wob.hold.call(this, fn);
      },
      forEach: function(fn) { this.hogs.forEach(fn); },
      isEmpty: function() { return this.hogs.size === 0; },
      toArr: function() { return [ ...this.hogs.values() ]; },
      find: function(fn) {
        for (let hog of this.hogs.values()) if (fn(hog)) return hog;
        return null;
      },
      size: function() { return this.hogs.size; },
      wobbleAdd: function(hog) {
        let key = this.getKey(hog);
        if (this.hogs.has(key)) throw new Error('Already add');
        this.hogs.set(key, hog);
        this.wobble(hog);
        return Hog(() => { this.hogs.delete(key); });
      }
    })});
    
    let Rel = U.inspire({ name: 'Rel', methods: (insp, Insp) => ({
      $NEXT_UID: 0,
      $makeWobVal: () => WobRecVal(),
      $makeWobObj: () => WobRecObj(relRec => relRec.rec.uid),
      
      init: function(head, tail, cardinality) {
        if (cardinality.length !== 2) throw new Error(`Invalid cardinality: "${cardinality}"`);
        if (cardinality.split('').find(v => !'1M'.has(v))) throw new Error(`Invalid cardinality: "${cardinality}"`);
        
        // TODO: The user should provide a unique name (using `foundation`) to ensure no clash
        this.uid = Rel.NEXT_UID++;
        this.fwd = { head: head, tail: tail, name: `${this.uid}:(${head.name}->${tail.name})` };
        this.bak = { head: tail, tail: head, name: `${this.uid}:(${tail.name}<-${head.name})` };
        
        // Rel parts can link back to the full Rel, and validate attempts to attach
        this.fwd.gain({ dir: 'fwd', rel: this, validate: (head, tail) => {} });
        this.bak.gain({ dir: 'bak', rel: this, validate: (head, tail) => {} });
        
        // Rel parts can generate the correct Wob
        this.fwd.gain({ makeWob: cardinality[1] === '1' ? Rel.makeWobVal : Rel.makeWobObj });
        this.bak.gain({ makeWob: cardinality[0] === '1' ? Rel.makeWobVal : Rel.makeWobObj });
        
        // Note: RelHalves are duck-typed as Hogs so that `Rec.prototype.relsWob()`
        // appropriately wobbles Hogs
        [ this.fwd, this.bak ].forEach(rh => rh.gain({ shut: () => {}, shutWob: () => C.nullShutWob }));
      }
    })});
    let Rec = U.inspire({ name: 'Rec', insps: { WobVal, Hog }, methods: (insp, Insp) => ({
      $NEXT_REC_UID: 0,
      
      init: function({ uid=null, value=null }) {
        this.uid = uid !== null ? uid : Rec.NEXT_REC_UID++;
        insp.WobVal.init.call(this, value);
        insp.Hog.init.call(this);
        
        this.inner = {}; // Actual references to related Recs
        this.relsWob0 = WobRecArr(); // Keep track of all Rels on this Rec
      },
      
      relsWob: function() { return this.relsWob0; },
      relWob: function(relF) {
        if (!relF) throw new Error(`Need to provide relation`);
        if (U.isInspiredBy(relF, Rel)) throw new Error(`Provided Rel instead of RelHalf`);
        if (!U.isInspiredBy(this, relF.head)) throw new Error(`Instance of ${U.typeOf(this)} tried to use relation ${relF.name}`);
        if (!this.inner.has(relF.name)) this.inner[relF.name] = relF.makeWob();
        return this.inner[relF.name];
      },
      
      // SHOULD USE "getRelRec" INSTEAD OF "relVal"
      getRelRec: function(relF, uid=null) {
        let wob = this.relWob(relF);
        return uid !== null ? wob.hogs.get(uid) || null : wob.hog;
      },
      
      // PLEASE USE "getRec"
      getRec: function(relF, uid=null) {
        let relRec = this.getRelRec(relF, uid);
        return relRec ? relRec.rec : null;
      },
      
      attach: function(relF, rec, agg=null) {
        
        // `rel` is the overall Rel, `relF` relates `this` -> `rec`, `relB` relates `this` <- `rec`
        let rel = relF.rel;
        let relB = rel[relF.dir === 'fwd' ? 'bak' : 'fwd'];
        
        // Get the wobs that will link back and forth (NOTE: this populates "inner" if necessary)
        let wobFwd = this.relWob(relF);
        let wobBak = rec.relWob(relB);
        
        // Simple validation
        if (!U.isInspiredBy(this, relF.head)) throw new Error(`Tried to attach ${U.typeOf(this)}->${U.typeOf(rec)} with relation ${relF.name}`);
        if (!U.isInspiredBy(rec,  relB.head)) throw new Error(`Tried to attach ${U.typeOf(rec)}->${U.typeOf(this)} with relation ${relB.name}`);
        
        // Allow Rel halves to validate
        relF.validate(this, rec);
        relB.validate(rec, this);
        
        return U.AccessPath(U.WobVal(rec), (dep, rec, ap) => {
          
          // There is always some minimum level of Aggregation, because at least 2
          // wobbles are happening: the Head is wobbling in attachment to the Tail,
          // and the Tail is wobbling in attachment to the Head
          let defAgg = !agg;
          if (defAgg) agg = U.AggWobs();
          
          // For this Rel of the present Recs, Wobble (with Aggregation) the Rel into existence
          if (!this.relsWob0.hogs.has(relF)) agg.addWob(this.relsWob0).wobbleAdd(relF);
          if (!rec.relsWob0.hogs.has(relB)) agg.addWob(rec.relsWob0).wobbleAdd(relB);
          
          // Create related Recs
          let rrFwd = dep(RelRec(ap, rel, rec));
          let rrBak = dep(RelRec(ap, rel, this));
          
          // The Rel definitely exists. Now show that the attachment here exists.
          // Note that the wobbles are aggregated, and then the wobbleAdds are dependent.
          // This means that shutting the AccessPath undoes the wobbleAdd
          dep(agg.addWob(wobFwd).wobbleAdd(rrFwd));
          dep(agg.addWob(wobBak).wobbleAdd(rrBak));
          
          // Complete the aggregation
          if (defAgg) agg.complete();
          
        });
        
      },
      shut0: function(agg=null) {
        
        // For all Recs of all Rels, shut the RecRel
        let defAgg = !agg;
        if (defAgg) agg = U.AggWobs();
        this.relsWob0.forEach(relF => this.relWob(relF).forEach(relRec => relRec.shut(agg)));
        if (defAgg) agg.complete();
        
      }
    })});
    let RelRec = U.inspire({ name: 'RelRec', insps: {}, methods: (insp, Insp) => ({
      init: function(relAp, relF, tail) {
        this.relAp = relAp;
        this.relF = relF;
        this.rec = tail;
      },
      shut: function(...args) { return this.relAp.shut(...args); },
      shutWob: function() { return this.relAp.shutWob(); }
    })});
    
    let content = { Record: Rec, Relation: Rel };
    
    /// {TEST=
    content.test = rootKeep => rootKeep.contain(k => U.Keep(k, 'record').contain(k => {
      
      U.Keep(k, 'rel11').contain(k => {
        
        U.Keep(k, 'circular1', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          Rel(Recc, Recc, '11');
          return { result: true };
          
        });
        
        U.Keep(k, 'circular2', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          let rel = Rel(Recc, Recc, '11');
          
          let rec1 = Recc({});
          let rec2 = Recc({});
          
          let correct1 = false;
          let correct2 = false;
          rec1.relWob(rel.fwd).hold(({ rec }) => { correct1 = rec === rec2; });
          rec2.relWob(rel.bak).hold(({ rec }) => { correct2 = rec === rec1; });
          rec1.attach(rel.fwd, rec2);
          
          return {
            result: true
              && correct1
              && correct2
              && rec1.getRec(rel.fwd) === rec2
              && rec2.getRec(rel.bak) === rec1
          };
          
        });
        
        U.Keep(k, 'circular3', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          let rel = Rel(Recc, Recc, '11');
          
          let loopRec = Recc({});
          let correct = false;
          loopRec.relWob(rel.fwd).hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel.fwd, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular4', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          let rel = Rel(Recc, Recc, '11');
          
          let loopRec = Recc({});
          let correct = false;
          loopRec.relWob(rel.bak).hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel.bak, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular5', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          let rel = Rel(Recc, Recc, '11');
          
          let loopRec = Recc({});
          let correct = false;
          loopRec.relWob(rel.fwd).hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel.bak, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'circular6', () => {
          
          let Recc = U.inspire({ name: 'Recc', insps: { Rec } });
          let rel = Rel(Recc, Recc, '11');
          
          let loopRec = Recc({});
          let correct = false;
          loopRec.relWob(rel.bak).hold(({ rec }) => { correct = rec === loopRec; });
          loopRec.attach(rel.fwd, loopRec);
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'attach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Rec } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Rec } });
          let rel = Rel(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          rec1.attach(rel.fwd, rec2);
          
          return { result: true
            && rec1.getRec(rel.fwd) === rec2
            && rec2.getRec(rel.bak) === rec1
          };
          
        });
        
        U.Keep(k, 'attachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Rec } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Rec } });
          
          let rel = Rel(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          rec1.attach(rel.fwd, rec2);
          
          try { rec1.attach(rel.fwd, Rec2({})); }
          catch(err) { return { result: err.message === 'Already add' }; }
          
          return { result: false };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Rec } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Rec } });
          
          let rel = Rel(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let attach = rec1.attach(rel.fwd, rec2);
          attach.shut();
          
          return { result: rec1.getRelRec(rel.fwd) === null };
          
        });
        
        U.Keep(k, 'detachMultiFails', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Rec } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Rec } });
          
          let rel = Rel(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let attach = rec1.attach(rel.fwd, rec2);
          attach.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: err.message === 'Already shut' }; }
          return { result: false };
          
        });
        
        U.Keep(k, 'aggAttach', () => {
          
          let Rec1 = U.inspire({ name: 'Rec1', insps: { Rec } });
          let Rec2 = U.inspire({ name: 'Rec2', insps: { Rec } });
          
          let rel = Rel(Rec1, Rec2, '11');
          
          let rec1 = Rec1({});
          let rec2 = Rec2({});
          
          let rec1Wobbled = false;
          let rec2Wobbled = false;
          
          rec1.relWob(rel.fwd).hold(relRec => { rec1Wobbled = true; });
          rec2.relWob(rel.bak).hold(relRec => { rec2Wobbled = true; });
          
          let agg = U.AggWobs();
          rec1.attach(rel.fwd, rec2, agg);
          if (rec1Wobbled || rec2Wobbled || !rec1.getRelRec(rel.fwd)) return { result: false };
          
          agg.complete();
          return { result: rec1Wobbled && rec2Wobbled };
          
        });
        
      });
      
      U.Keep(k, 'relWob').contain(k => {
        
        k.sandwich.before = () => { U.DBG_WOBS = new Set(); };
        k.sandwich.after = () => { U.DBG_WOBS = null; };
        
        U.Keep(k, 'attach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          let rel = Rel(RecA, RecB, '1M');
          
          let recs = [];
          let recA = RecA({});
          let holdRel = recA.relWob(rel.fwd).hold(({ rec: recB }) => recs.push(recB));
          
          for (let i = 0; i < 3; i++) recA.attach(rel.fwd, RecB({}));
          
          return {
            result: true
              // wobbled 3 times
              && recs.length === 3
              // instantaneous relVal produces 3 records
              && recA.relWob(rel.fwd).size() === 3
              // every record is of class RecB
              && !recs.find(recB => !U.isType(recB, RecB))
              // every wobbled value can find a RecA through the reverse Rel
              && !recs.find(recB => recB.getRec(rel.bak) !== recA)
          };
          
        });
        
        U.Keep(k, 'detach', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let attaches = [];
          let recA = RecA({});
          for (let i = 0; i < 3; i++) attaches.push(recA.attach(rel.fwd, RecB({})));
          
          attaches.forEach(at => at.shut());
          
          return {
            result: true
              && recA.relWob(rel.fwd).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          
          recA.shut();
          
          return {
            result: true
              && recA.relWob(rel.fwd).isEmpty()
              && recB.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let correct = false;
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          attach.shutWob().hold(() => { correct = true; });
          recA.shut();
          
          return { result: correct };
          
        });
        
        U.Keep(k, 'detachWithRelShutsRel3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let recA = RecA({});
          let recB = RecB({});
          let attach = recA.attach(rel.fwd, recB);
          recA.shut();
          
          try { attach.shut(); }
          catch(err) { return { result: err.message === 'Already shut' }; }
          return { result: false };
          
        });
        
        U.Keep(k, 'detachCleanup', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '1M');
          
          let recs = [];
          let attaches = [];
          let recX = RecX({});
          for (let i = 0; i < 5; i++) {
            let recY = RecY({});
            recs.push(recY);
            attaches.push(recX.attach(rel.fwd, recY));
          }
          
          attaches.forEach(at => at.shut());
          recs.forEach(r => r.shut());
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && !recs.find(r => r.numHolds() > 0)
              && !recs.find(r => r.shutWob().numHolds() > 0)
              && recX.numHolds() === 0
              && recX.shutWob().numHolds() === 0
              && U.TOTAL_WOB_HOLDS() === 0
          };
          
        });
        
        U.Keep(k, 'relShutCausesDetach1', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '1M');
          
          let recX = RecX({});
          let recY = RecY({});
          
          let att = recX.attach(rel.fwd, recY);
          recY.shut();
          
          return { result: recX.relWob(rel.fwd).isEmpty() };
          
        });
        
        U.Keep(k, 'relShutCausesDetach2', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '11');
          
          let recX = RecX({});
          let recY = RecY({});
          
          recX.attach(rel.fwd, recY);
          
          recX.shut();
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && recY.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'relShutCausesDetach3', () => {
          
          let RecX = U.inspire({ name: 'RecX', insps: { Rec } });
          let RecY = U.inspire({ name: 'RecY', insps: { Rec } });
          
          let rel = Rel(RecX, RecY, '11');
          
          let recX = RecX({});
          let recY = RecY({});
          
          recX.attach(rel.fwd, recY);
          recY.shut();
          
          return {
            result: true
              && recX.relWob(rel.fwd).isEmpty()
              && recY.relWob(rel.bak).isEmpty()
          };
          
        });
        
        U.Keep(k, 'interimVal1', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let holdRel = recA.relWob(rel.fwd).hold(recB => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, RecB({}));
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal2', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak).hold(recA0 => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal3', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, '1M');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recA.relWob(rel.fwd).hold(recB => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
        U.Keep(k, 'interimVal4', () => {
          
          let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
          let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
          
          let rel = Rel(RecA, RecB, 'MM');
          
          let interimVal = {};
          
          let recA = RecA({});
          let recB = RecB({});
          let holdRel = recB.relWob(rel.bak).hold(recA0 => {
            interimVal = recA.relWob(rel.fwd).toArr();
          });
          
          recA.attach(rel.fwd, recB);
          
          return { result: interimVal.length === 1 };
          
        });
        
      });
      
      U.Keep(k, 'AccessPath').contain(k => {
        
        U.Keep(k, 'rel11').contain(k => {
          
          U.Keep(k, 'recShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let rec = RecA({});
            let didShut = false;
            
            U.AccessPath(U.WobVal(rec), (dep, hog) => dep({ shut: () => { didShut = true; }, shutWob: () => U.Wob() }));
            
            rec.shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'relShutCauseDepShut', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            let didShut = false;
            
            U.AccessPath(recA.relWob(relAB.fwd), (dep, recB) => {
              dep({
                shut: () => { didShut = true; },
                shutWob: () => C.nullShutWob
              });
            });
            
            let relRec = recA.attach(relAB.fwd, RecB({})).shut();
            
            return { result: didShut };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            // Define an AccessPath which immediately "deps" everything it gets, and immediately
            // shut that same AccessPath
            U.AccessPath(recA.relWob(relAB.fwd), (dep, relRecB) => dep(relRecB)).shut();
            
            return { result: recA.relWob(relAB.fwd).isEmpty() };
            
          });
          
          U.Keep(k, 'apShutCauseRelShut2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            
            let ap = U.AccessPath(recA.relWob(relAB.fwd), (dep, relRecB) => {
              dep(U.AccessPath(U.WobVal(relRecB), (dep, relRecB) => {
                dep(relRecB);
              }));
            });
            
            ap.shut();
            
            return { result: recA.relWob(relAB.fwd).isEmpty() };
            
          });
          
          U.Keep(k, 'attachInterimValue1', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recA.getRec(relAB.fwd) === recB;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue2', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recA.getRec(relAB.fwd) === relRec.rec;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue3', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(relRec => {
              result = recB.getRec(relAB.bak) === recA;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
          U.Keep(k, 'attachInterimValue4', () => {
            
            let RecA = U.inspire({ name: 'RecA', insps: { Rec } });
            let RecB = U.inspire({ name: 'RecB', insps: { Rec } });
            
            let relAB = Rel(RecA, RecB, '11');
            
            let recA = RecA({});
            let recB = RecB({});
            let result = false;
            recA.relWob(relAB.fwd).hold(({ rec: recB }) => {
              result = recB.getRec(relAB.bak) === recA;
            });
            
            recA.attach(relAB.fwd, recB);
            
            return { result };
            
          });
          
        });
        
      });
      
    }));
    /// =TEST}
    
    return content;
  }
});
