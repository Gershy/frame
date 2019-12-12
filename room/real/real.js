U.buildRoom({
  name: 'real',
  innerRooms: [],
  build: (foundation) => {
    
    //let { WobVal, WobTmp, Hog } = U;
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
    let updatedUnit = (curW, newW) => {
      // Updates a unit, throwing an error upon conflicts
      if (curW && newW && !unitsEq(curW, newW)) throw Error('Conflicting extents');
      return curW || newW;
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
        for (let u1 of this.units) byType1.set(u1.constructor, u1);
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
    
    // ==== ABSTRACT
    let RealLayoutCmp = U.inspire({ name: 'RealLayoutCmp', methods: (insp, Insp) => ({
      init: function() {},
      getW: function(...trail) { return null; },
      getH: function(...trail) { return null; }
    })});
    
    // ==== SIZE
    let FillParent = U.inspire({ name: 'FillParent', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(params={}) {
        hvParams('shrink', params, this);
      },
      getW: function(par, ...parTrail) {
        return CalcAdd(par.getW(...parTrail) || UnitPc(1), this.shrinkL.mult(-1), this.shrinkR.mult(-1));
      },
      getH: function(par, ...parTrail) {
        return CalcAdd(par.getH(...parTrail) || UnitPc(1), this.shrinkT.mult(-1), this.shrinkB.mult(-1));
      }
    })});
    let WrapChildren = U.inspire({ name: 'WrapChildren', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(params) {
        hvParams('pad', params, this);
      }
    })});
    let ShowText = U.inspire({ name: 'ShowText', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(params) {
        hvParams('pad', params, this);
        
        // NOTE: Text origin has really wonky handling. Originally it
        // could be specified in decals, and now it should only be
        // provided to `ShowText` - but specifying under decals was
        // advantageous: decals are applied after geometry is complete
        // and after all other css. `ShowText` doesn't have knowledge
        // of the total geometry of its target, so it can't make the
        // same decisions (especially regarding line-height, with
        // centered text) as "textOrigin" could as a decal. So instead
        // of trying to get knowledge of the full geometry, we've just
        // maintained the "textOrigin" decal, even though it shouldn't
        // be used by anyone except `ShowText`. We set the
        // "lateDecals" zone, and include "textOrigin" there, so the
        // "textOrigin" value can finally apply when geometry is fully
        // understood.
        
        let { multiLine=false, origin='cc', interactive=false } = params;
        if (origin === 'c') origin = 'cc';
        if (!origin.match(/^[lrc][tbc]$/)) throw Error(`Invalid "origin": ${origin}`);
        this.multiLine = multiLine;
        this.origin = origin;
        this.interactive = interactive;
      }
    })});
    
    // ==== SLOTS
    let RootViewStyles = U.inspire({ name: 'RootViewStyles', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      insertViewPortItem: function() { return RootViewPortItem(); },
      insertPageItem: function() { return RootPageItem(); }
    })});
    let RootViewPortItem = U.inspire({ name: 'RootViewPortItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      getW: function(...trail) { return ViewPortMin(1); },
      getH: function(...trail) { return ViewPortMin(1); }
    })});
    let RootPageItem = U.inspire({ name: 'RootPageItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      getW: function(par, ...parTrail) { return UnitPc(1); },
      getH: function(par, ...parTrail) { return UnitPc(1); }
    })});
    
    let AxisSections = U.inspire({ name: 'AxisSections', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function({ axis, dir='+', cuts }) {
        if (!axis) throw Error('Missing "axis" param');
        if (!cuts) throw Error('Missing "cuts" param');
        if (![ '+', '-' ].has(dir)) throw Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw Error('Invalid "axis" param');
        
        this.axis = axis;
        this.dir = dir;
        this.cuts = cuts;
      },
      insertSectionItem: function(index) { return AxisSectionItem(this, index); }
    })});
    let AxisSectionItem = U.inspire({ name: 'AxisSectionItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(par, index) {
        this.par = par;
        this.index = index;
      },
      getCutExt: function(par, ...parTrail) {
        if (this.index < this.par.cuts.length) return this.par.cuts[this.index];
        let parExt = (this.par.axis === 'x') ? par.getW(...parTrail) : par.getH(...parTrail);
        return CalcAdd(parExt, ...this.par.cuts.map(amt => amt.mult(-1)));
      },
      getW: function(par, ...parTrail) { return (this.par.axis === 'y') ? par.getW(...parTrail) || UnitPc(1) : this.getCutExt(par, ...parTrail); },
      getH: function(par, ...parTrail) { return (this.par.axis === 'x') ? par.getH(...parTrail) || UnitPc(1) : this.getCutExt(par, ...parTrail); }
    })});
    
    let LinearSlots = U.inspire({ name: 'LinearSlots', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function({ axis, dir='+' /*, initPad=UnitPx(0)*/ }) {
        if (!axis) throw Error('Missing "axis" param');
        if (![ '+', '-' ].has(dir)) throw Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw Error('Invalid "axis" param');
        this.axis = axis;
        this.dir = dir;
      },
      insertLinearItem: function() { return LinearItem(this); }
    })});
    let LinearItem = U.inspire({ name: 'LinearItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    let CenteredSlot = U.inspire({ name: 'CenteredSlot', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      insertCenteredItem: function() { return CenteredItem(); }
    })});
    let CenteredItem = U.inspire({ name: 'CenteredItem', insps: { RealLayoutCmp } });
    
    let TextFlowSlots = U.inspire({ name: 'TextFlowSlots', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function({ gap=UnitPx(0), lineHeight=null }) {
        // TODO: Include "origin"?
        this.gap = gap;
        this.lineHeight = lineHeight;
      },
      insertTextFlowItem: function() { return TextFlowItem(this); }
    })});
    let TextFlowItem = U.inspire({ name: 'TextFlowItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    // ==== STRUCTURE
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      init: function(name, layoutsFlat) {
        this.name = name;
        this.rootLayout = {
          name: 'root',
          cmps: { slot: par => null, size: null, slots: RootViewStyles({}) },
          children: {}
        };
      },
      addFlatLayouts: function(flatLayouts) {
        flatLayouts.forEach((cmps, chainName) => {
          let names = chainName.split('.');
          let layout = this.rootLayout;
          for (let name of names) {
            if (!layout.children.has(name)) layout.children[name] = { name, cmps: null, children: {} };
            layout = layout.children[name];
          }
          layout.cmps = cmps; // Set "cmps"
          layout.getW = this.getLayoutW.bind(this, layout);
          layout.getH = this.getLayoutH.bind(this, layout);
        });
      },
      getLayoutCmps: function(layout, ...trail) {
        let cmps = [];
        if (layout.cmps.size) cmps.push(layout.cmps.size);
        if (layout.cmps.slots) cmps.push(layout.cmps.slots);
        if (layout.cmps.slot) {
          let slot = layout.cmps.slot(...trail);
          if (slot) cmps.push(slot);
        }
        return cmps;
      },
      getLayoutW: function(layout, ...trail) {
        let cmps = this.getLayoutCmps(layout, ...trail);
        let w = null;
        for (let cmp of cmps) w = updatedUnit(w, cmp.getW(...trail));
        return w && (w.isAbsolute() ? w : UnitPc(1));
      },
      getLayoutH: function(layout, ...trail) {
        let cmps = this.getLayoutCmps(layout, ...trail);
        let h = null;
        for (let cmp of cmps) h = updatedUnit(h, cmp.getH(...trail));
        return h && (h.isAbsolute() ? h : UnitPc(1));
      },
      iterateLayouts: function(it, layout=this.rootLayout, trail=[]) {
        it(layout, trail);
        trail = [ layout, ...trail ];
        layout.children.forEach(childLayout => this.iterateLayouts(it, childLayout, trail));
      },
      getCmpTimeFwkAssets: C.notImplemented,
      initReal: function(parReal, layout) {
        // Develop the trail
        let trail = [];
        while (parReal) { trail.push(parReal.layout); parReal = parReal.par; }
        let Real = this.getRealCls();
        let real = Real({ reality: this, layout });
        
        // Do `this.initReal0` - expect it to set `real.realized`!
        this.initReal0(real, layout, trail);
        if (!real.realized) throw Error(`${U.nameOf(this)} didn't realize Real @ ${[ layout, ...trail ].invert().join('.')}`);
        
        return real;
      },
      getRealCls: function() { return Real; },
      initReal0: C.notImplemented,
      addChildReal: C.notImplemented,
      remChildReal: C.notImplemented,
      initFeel: C.notImplemented
    })});
    let Real = U.inspire({ name: 'Real', insps: { Drop }, methods: (insp, Insp) => ({
      init: function({ drier=null, reality=null, layout=null }={}) {
        insp.Drop.init.call(drier, this);
        
        this.reality = reality; // Our link to a Reality instance
        this.layout = layout;   // The list of names to specify our role
        
        this.realized = null;   // Reference to a node in a graphics framework
        this.par = null;
        this.sense = {};        // Collect various Real-sensing nozzes here
      },
      form: function(submitTerm, dep, act, items) {
        
        // TODO: This function should exist elsewhere...
        
        let vals = items.map(v => null);
        let fields = [];
        items.forEach(({ type, desc, v=null }, k) => {
          
          // TODO: More types?
          
          let item = this.addReal('item');
          let title = item.addReal('title');
          let field = item.addReal('field');
          fields.push(field);
          
          dep(field.tellWob().hold(({
            str: v => vals[k] = v,
            int: v => vals[k] = (parseInt(v, 10) || null)
          })[type]));
          
          title.setText(desc);
          if (v !== null) field.setText(v);
          
        });
        
        let submit = this.addReal('submit');
        submit.setText(submitTerm);
        dep(submit.feelWob().hold(() => act(vals)));
        
        return {
          clear: () => {
            vals = items.map(v => null);
            fields.forEach(f => f.setText(''));
            return true;
          }
        };
        
      },
      feelNozz: function() {
        if (!this.sense.has('feel')) {
          this.reality.initFeel(this);
          this.sense.feel = TubVal(null, Nozz());
          this.sense.feel.feelDrop = Drop();
          this.sense.feel.feelDrop.dry();
        }
        return this.sense.feel;
      },
      addReal: function(realName, dbg=false) {
        if (!this.layout.children.has(realName)) throw Error(`No layout for "${realName}"`);
        let real = this.reality.initReal(this, this.layout.children[realName]);
        real.par = this;
        this.reality.addChildReal(this, real);
        return real;
      },
      onceDry: function() {
        this.reality.remChildReal(this);
        this.par = null;
      }
    })});
    
    
    return {
      
      keys: {
        activate: Set([ 13, 32 ]) // Enter, space
      },
      
      RealLayoutCmp,
      
      unitsEq,
      Unit, UnitAmt, UnitPx, UnitPc, ViewPortMin, Calc, CalcAdd,
      
      RealLayoutCmp,
      FillParent, WrapChildren, ShowText,
      RootViewStyles, RootViewPortItem, RootPageItem,
      AxisSections, AxisSectionItem,
      LinearSlots, LinearItem,
      CenteredSlot, CenteredItem,
      TextFlowSlots, TextFlowItem,
      
      Reality, Real
    };
    
  }
});
