U.buildRoom({
  name: 'real',
  innerRooms: [],
  build: (foundation) => {
    
    let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
    
    // ==== UTIL
    let hvParams = (prefix, params, real={}, defUnit=UnitPx(0)) => {
      
      // Get "horz-vert" params for a particular prefix. Gives left,
      // right, top, and bottom prefixed values with sensible defaults:
      // L and R default to H (horz), T and B default to V (vert), H and
      // V default to the prefix-less value.
      
      let def = params.has(prefix) ? params[prefix] : defUnit;
      let hDef = params.has(`${prefix}H`) ? params[`${prefix}H`] : def;
      let vDef = params.has(`${prefix}V`) ? params[`${prefix}V`] : def;
      real[`${prefix}L`] = params.has(`${prefix}L`) ? params[`${prefix}L`] : hDef;
      real[`${prefix}R`] = params.has(`${prefix}R`) ? params[`${prefix}R`] : hDef;
      real[`${prefix}T`] = params.has(`${prefix}T`) ? params[`${prefix}T`] : vDef;
      real[`${prefix}B`] = params.has(`${prefix}B`) ? params[`${prefix}B`] : vDef;
      return real;
      
    };
    let unitsEq = (u1, u2) => {
      let Insp1 = U.inspOf(u1), Insp2 = U.inspOf(u2);
      if (Insp1 !== Insp2) return false;
      if (U.isInspiredBy(Insp1, Unit)) return u1.eq(u2);
      return u1 === u2;
    };
    let updatedExtent = (curE, newE) => {
      // Updates an extent, throwing an error upon conflicts
      if (curE && newE && !unitsEq(curE, newE)) throw Error('Conflicting extents');
      return curE || newE;
    };
    
    // ==== UNIT VALUES
    let Unit = U.inspire({ name: 'Unit', insps: {}, methods: (insp, Insp) => ({
      init: function() {},
      eq: function(u) { return (U.inspOf(u) === U.inspOf(this)) && this.eq0(u); },
      eq0: C.notImplemented
    })});
    let UnitAmt = U.inspire({ name: 'UnitAmt', insps: { Unit }, methods: (insp, Insp) => ({
      
      // A Unit with a specific numeric "amount"
      
      init: function(amt) {
        if (!U.nameOf(amt, Number) || isNaN(amt)) throw Error(`Invalid amt: ${amt}`);
        insp.Unit.init.call(this);
        this.amt = amt;
      },
      eq0: function(u) { return u.amt === this.amt; },
      isAbsolute: function() {
        // Indicates whether the resulting amount is unchanging
        // regardless of context
        return false;
      },
      add: function(n) { let Cls = this.constructor; return Cls(this.amt + n); },
      mult: function(n) { let Cls = this.constructor; return Cls(this.amt * n); },
      
    })});
    let UnitPx = U.inspire({ name: 'UnitPx', insps: { UnitAmt }, methods: (insp, Insp) => ({
      isAbsolute: function() { return true; },
      suff: function() { return 'px'; }
    })});
    let UnitPc = U.inspire({ name: 'UnitPc', insps: { UnitAmt }, methods: (insp, Insp) => ({
      suff: function() { return '%'; }
    })});
    let ViewPortMin = U.inspire({ name: 'ViewPortMin', insps: { UnitAmt }, methods: () => ({
      suff: function() { return 'vmin'; }
    })});
    let Calc = U.inspire({ name: 'Calc', insps: { Unit }, methods: (insp, Insp) => ({
      init: function(...units) {
        let unitsByType = Map();
        for (let unit of units) {
          if (!U.isInspiredBy(unit, UnitAmt)) throw Error(`Provided invalid Unit: ${U.nameOf(unit)}`);
          let UnitCls = unit.constructor;
          if (!unitsByType.has(UnitCls)) unitsByType.set(UnitCls, []);
          unitsByType.get(UnitCls).push(unit);
        }
        
        let uniqueUnits = [];
        for (let [ UnitCls, units ] of unitsByType) {
          let totalAmt = this.op(...units.map(u => u.amt));
          if (totalAmt) uniqueUnits.push(UnitCls(totalAmt));
        }
        
        if (uniqueUnits.length === 0) return UnitPx(0);
        if (uniqueUnits.length === 1) return uniqueUnits[0];
        
        this.units = uniqueUnits;
      },
      eq0: function(c) {
        if (this.units.length !== c.units.length) return false;
        let byType = Map();
        for (let u1 of this.units) byType.set(u1.constructor, u1);
        for (let u2 of c.units) {
          let u1 = byType.get(u2.constructor);
          if (!u1 || !u1.eq0(u2)) return false;
        }
        return true;
      },
      op: C.notImplemented,
      isAbsolute: function() { return false; }
    })});
    let CalcAdd = U.inspire({ name: 'CalcAdd', insps: { Calc }, methods: (insp, Insp) => ({
      op: function(...vals) { let v = 0; for (let vv of vals) v += vv; return v; }
    })});
    
    let FixedSize = U.inspire({ name: 'FixedSize', insps: {}, methods: (insp, Insp) => ({
      init: function(w=null, h=null) { this.w = w; this.h = h; }
    })});
    let FillParent = U.inspire({ name: 'FillParent', insps: {}, methods: (insp, Insp) => ({
      init: function(params={}) { hvParams('shrink', params, this); }
    })});
    let CenteredSlotter = U.inspire({ name: 'CenteredSlotter', methods: (insp, Insp) => ({
      
      // A Slotter defining a single Slot: one which will be centered,
      // along both axes, within its parent, no matter the dimensions of
      // the Slot
      
      $CenteredSlot: U.inspire({ name: 'CenteredSlot', methods: (insp, Insp) => ({
        init: function(slotter) { this.slotter = slotter }
      })}),
      
      init: function() {},
      getCenteredSlot: function(...args) { return Insp.CenteredSlot(this, ...args); }
    })});
    let MinExtSlotter = U.inspire({ name: 'MinExtSlotter', methods: (insp, Insp) => ({
      
      // A Slotter defining a single Slot: one with both extents equal
      // to the shorter extent of the Slotter
      
      $MinExtSlot: U.inspire({ name: 'MinExtSlot', insps: {}, methods: (insp, Insp) => ({
        init: function(slotter) { this.slotter = slotter; }
      })}),
      
      init: function() {},
      getMinExtSlot: function(...args) { return Insp.MinExtSlot(this, ...args); }
    })});
    let LinearSlotter = U.inspire({ name: 'LinearSlotter', methods: (insp, Insp) => ({
      
      $LinearSlot: U.inspire({ name: 'LinearSlot', methods: (insp, Insp) => ({
        init: function(slotter) { this.slotter = slotter; }
      })}),
      
      init: function({ axis, dir='+', scroll=true /*, initPad=UnitPx(0)*/ }) {
        if (!axis) throw Error('Missing "axis" param');
        if (![ '+', '-' ].has(dir)) throw Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw Error('Invalid "axis" param');
        this.axis = axis;
        this.dir = dir;
        this.scroll = scroll;
      },
      getLinearSlot: function(...args) { return Insp.LinearSlot(this, ...args); }
    })});
    let AxisSlotter = U.inspire({ name: 'AxisSections', methods: (insp, Insp) => ({
      
      $AxisSlot: U.inspire({ name: 'AxisSlot', methods: (insp, Insp) => ({
        init: function(slotter, index) {
          if (!U.isType(index, Number)) throw Error(`Invalid slot index`);
          this.slotter = slotter;
          this.index = index;
        }
      })}),
      
      init: function({ axis, dir='+', cuts }) {
        if (!axis) throw Error('Missing "axis" param');
        if (!cuts) throw Error('Missing "cuts" param');
        if (![ '+', '-' ].has(dir)) throw Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw Error('Invalid "axis" param');
        
        this.axis = axis;
        this.dir = dir;
        this.cuts = cuts;
      },
      getAxisSlot: function(index) { return Insp.AxisSlot(this, index); }
    })});
    
    let TextSized = U.inspire({ name: 'TextSized', methods: (insp, Insp) => ({
      init: function(params) {
        
        hvParams('pad', params, this);
        
        // TODO: Take out "desc"; implement `textSizedReal.setPlaceholder(...)`
        let { multiLine=false, origin='cc', interactive=false, embossed=interactive, size=null, desc=null } = params;
        if (origin === 'c') origin = 'cc';
        if (!origin.match(/^[lrc][tbc]$/)) throw Error(`Invalid "origin": ${origin}`);
        this.multiLine = multiLine;
        this.origin = origin;
        this.interactive = interactive;
        this.embossed = embossed;
        this.desc = desc;
        this.size = size || UnitPx(18); // TODO: Should be able to supply integer (avoid many instances of UnitPx!)
        
        this.origin = origin;
        this.size = size;
      }
    })});
    let Art = U.inspire({ name: 'Art', methods: (insp, Insp) => ({
      init: function({ pixelDensityMult=1, pixelCount=null }={}) {
        if (pixelDensityMult !== 1 && pixelCount) throw Error(`Can't specify pixel density and pixel count`);
        
        this.pixelDensityMult = pixelDensityMult; // 1 is standard; 0.5 is low-res, 1.5 is hi-res
        this.pixelCount = pixelCount; // e.g. [ 620, 480 ]
      }
    })});
    
    let realFns = [
      // Dynamic geometry:
      'setGeom', 'setW', 'setH', 'setLoc', 'setRot', 'setScl',
      
      // Additional style features
      'setColour', 'setRoundness', 'setOpacity', 'setBorder', 'setImage', 'setTransition', 'setDeathTransition',
      'setTangible',
      
      // Interaction:
      'feelNozz'
    ];
    let Real = U.inspire({ name: 'Real', insps: { Drop }, methods: (insp, Insp) => ({
      init: function(root, name, chain=[], tech=null) {
        if (!name.match(/^[a-zA-Z0-9]*[.][a-zA-Z0-9]*$/)) throw Error(`Invalid Real name: ${name}`);
        
        this.name = name;
        this.root = root || this;
        this.chain = chain;
        this.senseNozzes = {};
        
        if (!root) {
          this.defReals = {};
          this.defInserts = {};
          this.defineReal(this.name);
        }
        
        this.tech = null;
        this.techNode = null;
        if (tech) this.setTech(tech);
      },
      defineReal: function(name, { modeSlotters={ main: null }, layouts=[], decals={}, tech=null }={}) {
        
        // Defines a name for a new Real. This Real has a number of
        // different SlottingModes, defined as keys within `slotters`.
        // At any time the Real will insert its children using the
        // SlottingMode that is compatible for all of them. The Real
        // also has an optional set of `layouts`, which define extents
        // separately from the slot it's granted by its parent, and
        // `decals`, which define aesthetic features.
        
        let { defReals } = this.root;
        
        // TODO: Weird that arguments after `name` only apply on initial create
        if (!defReals.has(name)) defReals[name] = { name, modeSlotters, layouts, decals, tech: null };
        return defReals[name];
        
      },
      defineInsert: function(parName, kidName, { modeSlotFns={} }={}) {
        
        // Define a new Insertion; allow the named Kid to be inserted
        // into the named Par. This insertion can happen under any
        // SlottingMode within the keys of `slotters` (which must be a
        // subset of Par's SlottingModes)
        
        let { defReals, defInserts } = this.root;
        
        let key = `${parName}->${kidName}`;
        if (parName !== '*' && !defReals.has(parName)) throw Error(`Nonexistent par: "${parName}"`);
        if (!defReals.has(kidName)) throw Error(`Nonexistent kid: "${kidName}"`);
        
        if (!defInserts.has(key)) defInserts[key] = { modeSlotFns };
        
        return defInserts[key];
        
      },
      
      layoutDef: function (prefix, defFn) {
        
        let root = this.root;
        
        let realFn = (name, modeSlotters=null, ...layouts) => {
          let def = this.defineReal(`${prefix}.${name}`);
          
          if (!modeSlotters) modeSlotters = {}; // Make no changes if no `modeSlotters` provided
          if (!U.isType(modeSlotters, Object)) modeSlotters = { main: modeSlotters };
          
          def.modeSlotters.gain(modeSlotters);
          def.layouts.gain(layouts);
        };
        let insertFn = (insertTerm, modeSlotFns=null) => {
          let [ name1, name2 ] = insertTerm.split('->').map(v => `${prefix}.${v.trim()}`);
          if (name1.slice(-1) === '*') name1 = '*';
          
          if (name1 !== '*') this.defineReal(name1);
          this.defineReal(name2);
          let def = this.defineInsert(name1, name2);
          
          if (!modeSlotFns) modeSlotFns = {};
          if (!U.isType(modeSlotFns, Object)) modeSlotFns = { main: modeSlotFns };
          
          def.modeSlotFns.gain(modeSlotFns);
        };
        let decalFn = (name, decals={}) => {
          this.defineReal(`${prefix}.${name}`).decals.gain(decals);
        };
        
        // Finally, call the provided function
        defFn(realFn, insertFn, decalFn);
        
      },
      
      addReal: function(name, ...insertArgs) {
        
        let { defReals, defInserts } = this.root;
        if (!defReals.has(name)) throw Error(`No Real for "${this.name} -> ${name}"`);
        
        let key = `${this.name}->${name}`;
        if (!defInserts.has(key) && !defInserts.has(`*->${name}`)) throw Error(`No insert for "${key}"`);
        
        let defReal = defReals[name];
        let defInsert = defInserts.has(key) ? defInserts[key] : null; // `null` for generic inserts
        let kidChain = [ { defReal, defInsert, insertArgs, parReal: this }, ...this.chain ];
        return Real(this.root, name, kidChain, defReal.tech || this.tech);
        
      },
      setTech: function(newTech) {
        
        if (U.isType(newTech, String)) return console.log(`Invalid tech: ${newTech}`);
        
        if (this.tech) this.tech.remTechNode(this);
        
        this.tech = newTech;
        this.techNode = this.tech.createTechNode(this);
        this.tech.addTechNode(this);
        
      },
      onceDry: function() {
        if (this.tech) this.tech.remTechNode(this);
      },
      
      ...realFns.toObj(v => [ v, function(...args) { return this.tech[v](this, ...args); } ])
    })});
    let Tech = U.inspire({ name: 'Tech', insps: {}, methods: (insp, Insp) => ({
      init: function() {},
      createTechNode: C.notImplemented,
      addTechNode: C.notImplemented,
      remTechNode: C.notImplemented,
      
      ...realFns.toObj(v => [ v, function() { throw Error(`${U.nameOf(this)} does not implement "${v}"`); } ])
    })});
    
    return {
      FixedSize, FillParent, CenteredSlotter, MinExtSlotter, LinearSlotter, AxisSlotter,
      TextSized, Art,
      
      UnitPx, UnitPc, Calc, CalcAdd,
      
      Real, Tech
    };
    
  }
});
