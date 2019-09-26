// TODO:  UnitPx -> UnitAbs??
//        UnitPc -> UnitRel???

U.buildRoom({
  name: 'real',
  innerRooms: [],
  build: (foundation) => {
    
    let { WobVal, WobTmp, Hog } = U;
    
    
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
    
    
    // ==== UNIT VALUES
    let unitsEq = (u1, u2) => {
      let Insp1=U.inspOf(u1), Insp2=U.inspOf(u2);
      if (Insp1 !== Insp2) return false;
      if (U.isInspiredBy(Insp1, Unit)) return u1.eq(u2);
      return u1 === u2;
    };
    let Unit = U.inspire({ name: 'Unit', insps: {}, methods: (insp, Insp) => ({
      init: function() {},
      eq: function(u) { return (U.inspOf(u) === U.inspOf(this)) && this.eq0(u); },
      eq0: C.notImplemented
    })});
    let UnitAmt = U.inspire({ name: 'UnitAmt', insps: { Unit }, methods: (insp, Insp) => ({
      
      // A Unit with a specific numeric "amount"
      
      init: function(amt) {
        if (!U.typeOf(amt, Number) || isNaN(amt)) throw new Error(`Invalid amt: ${amt}`);
        insp.Unit.init.call(this);
        this.amt = amt;
      },
      eq0: function(u) { return u.amt === this.amt; },
      isAbsolute: function() {
        // Indicates whether the final length indicated by the unit is
        // known without any context. For example, pixel-units are
        // always absolute, since, e.g., "53 pixels" has a known size
        // regardless of any context. In contrast, the final length as
        // a result of percentage units isn't known without knowing
        // the size of the containing Real.
        return false;
      },
      add: function(n) { let Cls = this.constructor; return Cls(this.amt + n); },
      mult: function(n) { let Cls = this.constructor; return Cls(this.amt * n); },
      round: function() { let Cls = this.constructor; return Cls(Math.round(this.amt)); }
      
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
          if (!U.isInspiredBy(unit, UnitAmt)) throw new Error(`Provided invalid Unit: ${U.typeOf(unit)}`);
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
        let byType=Map();
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
    let Size = U.inspire({ name: 'Size', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      getW: C.notImplemented,
      getH: C.notImplemented
    })});
    let FillParent = U.inspire({ name: 'FillParent', insps: { Size }, methods: (insp, Insp) => ({
      init: function(params) {
        insp.Size.init.call(this, {});
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
        if (!origin.match(/^[lrc][tbc]$/)) throw new Error(`Invalid "origin": ${origin}`);
        this.multiLine = multiLine;
        this.origin = origin;
        this.interactive = interactive;
      }
    })});
    
    
    // ==== SLOTS
    let Slots = U.inspire({ name: 'Slots', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({}) });
    
    let RootViewStyles = U.inspire({ name: 'RootViewStyles', insps: { Slots }, methods: (insp, Insp) => ({
      init: function() {},
      insertViewPortItem: function() { return RootViewPortItem(); },
      insertPageItem: function() { return RootPageItem(); },
      fixesChildSizes: function() { return true; },
    })});
    let RootViewPortItem = U.inspire({ name: 'RootViewPortItem', insps: { Size }, methods: (insp, Insp) => ({
      init: function() {},
      getW: function(...trail) { return ViewPortMin(1); },
      getH: function(...trail) { return ViewPortMin(1); }
    })});
    let RootPageItem = U.inspire({ name: 'RootPageItem', insps: { Size }, methods: (insp, Insp) => ({
      init: function() {},
      getW: function(par, ...parTrail) { return UnitPc(1); },
      getH: function(par, ...parTrail) { return UnitPc(1); }
    })});
    
    let AxisSections = U.inspire({ name: 'AxisSections', insps: { Slots }, methods: (insp, Insp) => ({
      init: function({ axis, dir='+', cuts }) {
        if (!axis) throw new Error('Missing "axis" param');
        if (!cuts) throw new Error('Missing "cuts" param');
        if (![ '+', '-' ].has(dir)) throw new Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw new Error('Invalid "axis" param');
        
        this.axis = axis;
        this.dir = dir;
        this.cuts = cuts;
      },
      insertSectionItem: function(index) { return AxisSectionItem(this, index); },
      fixesChildSizes: function() { return true; }
    })});
    let AxisSectionItem = U.inspire({ name: 'AxisSectionItem', insps: { Size }, methods: (insp, Insp) => ({
      init: function(par, index) {
        insp.Size.init.call(this);
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
    
    let LinearSlots = U.inspire({ name: 'LinearSlots', insps: { Slots }, methods: (insp, Insp) => ({
      init: function({ axis, dir='+' /*, initPad=UnitPx(0)*/ }) {
        if (!axis) throw new Error('Missing "axis" param');
        if (![ '+', '-' ].has(dir)) throw new Error('Invalid "dir" param');
        if (![ 'x', 'y' ].has(axis)) throw new Error('Invalid "axis" param');
        this.axis = axis;
        this.dir = dir;
      },
      insertLinearItem: function() { return LinearItem(this); },
      fixesChildSizes: function() { return false; }
    })});
    let LinearItem = U.inspire({ name: 'LinearItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    let CenteredSlot = U.inspire({ name: 'CenteredSlot', insps: { Slots }, methods: (insp, Insp) => ({
      init: function() {},
      insertCenteredItem: function() { return CenteredItem(); },
      fixesChildSizes: function() { return false; }
    })});
    let CenteredItem = U.inspire({ name: 'CenteredItem', insps: { RealLayoutCmp } });
    
    let TextFlowSlots = U.inspire({ name: 'TextFlowSlots', insps: { Slots }, methods: (insp, Insp) => ({
      init: function({ gap=UnitPx(0), lineHeight=null }) {
        this.gap = gap;
        this.lineHeight = lineHeight;
      },
      insertTextFlowItem: function() { return TextFlowItem(this); },
      fixesChildSizes: function() { return false; }
    })});
    let TextFlowItem = U.inspire({ name: 'TextFlowItem', insps: { RealLayoutCmp }, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    
    // ==== STRUCTURE
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      
      $nestedLayouts: flat => {
        // This is the root layout node - so "slots" are RootViewStyles
        let nested = {
          name: 'root',
          cmps: { slot: par => null, size: null, slots: RootViewStyles({}) },
          children: {}
        };
        flat.forEach((cmps, chainName) => {
          let names = chainName.split('.');
          let ptr = nested;
          for (let name of names) {
            if (!ptr.children.has(name)) ptr.children[name] = { cmps: null, children: {} };
            ptr = ptr.children[name];
          }
          ptr.name = names[names.length - 1]; // Assign the name at the end of the chain
          ptr.cmps = cmps; // Set "cmps"
        });
        return nested;
      },
      
      init: function(name, layoutsFlat) {
        this.name = name;
        this.rootLayout = Insp.nestedLayouts(layoutsFlat);
        
        // TODO: Whereas in the future "iterating layouts" may involve
        // visiting every possible slotting of child layout in parent
        // layout, the iteration here simply needs to visit every
        // distinct layout (while the futuristic version would be good
        // for validating all possible getW and getH calls succeed!)
        this.iterateLayouts((layout, trail) => {
          layout.getW = (...trail) => this.getLayoutW(layout, trail);
          layout.getH = (...trail) => this.getLayoutH(layout, trail);
        });
      },
      getLayoutCmps: function(layout, trail) {
        let cmps = [];
        if (layout.cmps.size) cmps.push(layout.cmps.size);
        if (layout.cmps.slots) cmps.push(layout.cmps.slots);
        if (layout.cmps.slot) {
          let slot = layout.cmps.slot(...trail);
          if (slot) cmps.push(slot);
        }
        return cmps;
      },
      getLayoutW: function(layout, trail) {
        let cmps = this.getLayoutCmps(layout, trail);
        let w = null, w1 = null;
        for (let cmp of cmps) {
          if (!cmp.getW || (w1 = cmp.getW(...trail)) === null) continue; // TODO: Duck typing...?
          if (w !== null && !unitsEq(w, w1)) throw new Error('Can\'t determine width; conflicting widths');
          w = w1;
        }
        return w ? (w.isAbsolute() ? w : UnitPc(1)) : null; //(w && w.isAbsolute()) ? w : UnitPc(1);
      },
      getLayoutH: function(layout, trail) {
        let cmps = this.getLayoutCmps(layout, trail);
        let h = null, h1 = null;
        for (let cmp of cmps) {
          if (!cmp.getH || (h1 = cmp.getH(...trail)) === null) continue; // TODO: Duck typing...?
          if (h !== null && !unitsEq(h, h1)) throw new Error('Can\'t determine height; conflicting heights');
          h = h1;
        }
        return h ? (h.isAbsolute() ? h : UnitPc(1)) : null; //(h && h.isAbsolute()) ? h : UnitPc(1);
      },
      iterateLayouts: function(it, trail=[], layout=this.rootLayout) {
        it(layout, trail);
        trail = [ layout, ...trail ];
        layout.children.forEach(childLay => this.iterateLayouts(it, trail, childLay));
      },
      getCmpTimeFwkAssets: C.notImplemented,
      initReal: function(parReal, layout) {
        // Develop the trail
        let trail = [];
        while (parReal) { trail.push(parReal.layout); parReal = parReal.par; }
        let real = Real({ reality: this, layout });
        
        // Do `this.initReal0` - expect it to set `real.realized`!
        this.initReal0(real, layout, trail);
        if (!real.realized) throw new Error(`${U.typeOf(this)} didn't realize Real @ ${[ layout, ...trail ].invert().join('.')}`);
        
        return real;
      },
      initReal0: C.notImplemented,
      addChildReal: C.notImplemented,
      remChildReal: C.notImplemented,
      makeFeelable: C.notImplemented
    })});
    let Real = U.inspire({ name: 'Real', insps: { Hog }, methods: (insp, Insp) => ({
      init: function({ reality=null, layout=null }={}) {
        insp.Hog.init.call(this);
        
        this.reality = reality;     // Our link to a Reality instance
        this.layout = layout; // The list of names to specify our role
        
        this.realized = null;   // Reference to a node in a graphics framework
        this.par = null;
        this.feelWob0 = null;       // "Feeling" most often occurs via click
        this.tellWob0 = null;       // "Telling" most often occurs via text entry
      },
      form: function(submitTerm, dep, act, items) {
        
        // TODO: Dunno where this function should exist, but not here...
        
        let vals = items.map(v => null);
        let fields = [];
        items.forEach(({ type, desc, v=null }, k) => {
          
          // TODO: More types?
          
          let item = this.addReal('item');
          let title = item.addReal('title');
          let field = item.addReal('field');
          fields.push(field);
          
          title.setText(desc);
          
          if (type === 'str') {
            dep(field.tellWob().hold(v => { vals[k] = v; }));
          } else if (type === 'int') {
            dep(field.tellWob().hold(v => { vals[k] = parseInt(v, 10) || null; }));
          }
          
          if (v !== null) {
            field.setText(v);
            field.tellWob().wobble(v);
          }
          
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
      feelWob: function() {
        if (!this.feelWob0) {
          this.feelWob0 = WobTmp('dn');
          this.reality.makeFeelable(this, this.feelWob0);
        }
        return this.feelWob0;
      },
      tellWob: function() {
        if (!this.tellWob0) {
          // TODO: Anything here?
          // this.tellWob0 = WobVal(''); ???
          // this.reality.makeTellable(this, this.tellWob0); ???
        }
        return this.tellWob0;
      },
      addReal: function(realName, dbg=false) {
        let real = this.reality.initReal(this, this.layout.children[realName]);
        real.par = this;
        this.reality.addChildReal(this, real);
        return real;
      },
      shut0: function() {
        this.reality.remChildReal(this);
        this.par = null;
      }
    })});
    
    
    return {
      RealLayoutCmp,
      
      unitsEq,
      Unit,
      UnitAmt, UnitPx, UnitPc, ViewPortMin, Calc, CalcAdd,
      
      Size,
      FillParent, WrapChildren, ShowText,
      
      Slots,
      RootViewStyles, RootViewPortItem, RootPageItem,
      AxisSections, AxisSectionItem,
      LinearSlots, LinearItem,
      CenteredSlot, CenteredItem,
      TextFlowSlots, TextFlowItem,
      
      Reality, Real
    };
    
  }
});
