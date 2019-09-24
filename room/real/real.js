// TODO: real-css file which defines a similar class, inspired by and under
// the same name as all the classes here, except everything is nicely separated
// for Above/Below??

// TODO:  UnitPx -> UnitAbs??
//        UnitPc -> UnitRel???

U.buildRoom({
  name: 'real',
  innerRooms: [],
  build: (foundation) => {
    
    let { WobVal, WobTmp, Hog } = U;
    
    
    // ==== UTIL
    let camelToKebab = camel => camel.replace(/([A-Z])/g, (m, chr) => `-${chr.lower()}`);
    let hvParams = (prefix, params, real={}, defUnit=UnitPx(0)) => {
      
      // Get "horz-vert" params for a particular prefix. Gives left,
      // right, top, and bottom prefixed values with sensible defaults:
      // L and R default to H (horz), T and B default to V (vert), H and
      // V default to the prefix-less value.
      
      let def = params.has(prefix) ? params[prefix] : defUnit;
      let horzDef = params.has(`${prefix}H`) ? params[`${prefix}H`] : def;
      let vertDef = params.has(`${prefix}V`) ? params[`${prefix}V`] : def;
      
      real[`${prefix}L`] = params.has(`${prefix}L`) ? params[`${prefix}L`] : horzDef;
      real[`${prefix}R`] = params.has(`${prefix}R`) ? params[`${prefix}R`] : horzDef;
      real[`${prefix}T`] = params.has(`${prefix}T`) ? params[`${prefix}T`] : vertDef;
      real[`${prefix}B`] = params.has(`${prefix}B`) ? params[`${prefix}B`] : vertDef;
      
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
    let RealLayout = U.inspire({ name: 'RealLayout', methods: (insp, Insp) => ({
      init: function() {}
    })});
    
    
    // ==== SIZE
    let Size = U.inspire({ name: 'Size', insps: { RealLayout }, methods: (insp, Insp) => ({
      getW: C.notImplemented,
      getH: C.notImplemented
    })});
    let FillParent = U.inspire({ name: 'FillParent', insps: { Size }, methods: (insp, Insp) => ({
      init: function(params) {
        insp.Size.init.call(this, {});
        hvParams('shrink', params, this);
      },
      getW: function(par) { return CalcAdd(par.w, this.shrinkL.mult(-1), this.shrinkR.mult(-1)); },
      getH: function(par) { return CalcAdd(par.h, this.shrinkT.mult(-1), this.shrinkB.mult(-1)); }
    })});
    let WrapChildren = U.inspire({ name: 'WrapChildren', insps: {}, methods: (insp, Insp) => ({
      init: function(params) {
        hvParams('pad', params, this);
      }
    })});
    let ShowText = U.inspire({ name: 'ShowText', insps: {}, methods: (insp, Insp) => ({
      init: function(params) {
        hvParams('pad', params, this);
        
        // NOTE: Text origin has really wonky handling. Originally it
        // could be specified in decals, and now it should only be
        // provided to `ShowText` - but specifying to decals was
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
        
        let { multiLine=false, origin='left', interactive=false } = params;
        this.multiLine = multiLine;
        this.origin = origin;
        this.interactive = interactive;
      }
    })});
    
    
    // ==== SLOTS
    let Slots = U.inspire({ name: 'Slots', insps: { RealLayout }, methods: (insp, Insp) => ({}) });
    
    let RootViewStyles = U.inspire({ name: 'RootViewStyles', insps: { Slots }, methods: (insp, Insp) => ({
      init: function() {},
      insertViewPortItem: function() { return RootViewPortItem(); },
      insertPageItem: function() { return RootPageItem(); },
      fixesChildSizes: function() { return true; },
    })});
    let RootViewPortItem = U.inspire({ name: 'RootViewPortItem', insps: { Size }, methods: (insp, Insp) => ({
      init: function() {},
      getW: function(par) { return ViewPortMin(1); },
      getH: function(par) { return ViewPortMin(1); }
    })});
    let RootPageItem = U.inspire({ name: 'RootPageItem', insps: { Size }, methods: (insp, Insp) => ({
      init: function() {},
      getW: function(par) { return par.w; },
      getH: function(par) { return par.h; }
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
      getW: function(par) { return (this.par.axis === 'y') ? par.w : this.par.cuts[this.index]; },
      getH: function(par) { return (this.par.axis === 'x') ? par.h : this.par.cuts[this.index]; }
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
    let LinearItem = U.inspire({ name: 'LinearItem', insps: {}, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    let CenteredSlot = U.inspire({ name: 'CenteredSlot', insps: { Slots }, methods: (insp, Insp) => ({
      init: function() {},
      insertCenteredItem: function() { return CenteredItem(this); },
      fixesChildSizes: function() { return false; }
    })});
    let CenteredItem = U.inspire({ name: 'CenteredItem', insps: {}, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    let TextFlowSlots = U.inspire({ name: 'TextFlowSlots', insps: { Slots }, methods: (insp, Insp) => ({
      init: function({ gap=UnitPx(0), lineHeight=null }) {
        this.gap = gap;
        this.lineHeight = lineHeight;
      },
      insertTextFlowItem: function() { return TextFlowItem(this); },
      fixesChildSizes: function() { return false; }
    })});
    let TextFlowItem = U.inspire({ name: 'TextFlowItem', insps: {}, methods: (insp, Insp) => ({
      init: function(par) {
        this.par = par;
      }
    })});
    
    
    // ==== STRUCTURE
    let Reality = U.inspire({ name: 'Reality', methods: (insp, Insp) => ({
      
      init: function(name, ctxsByNameFlat) {
        this.name = name;
        
        // ==== Convert `ctxsByNameFlat` into a heirarchical version @ `this.rootCtxNode`
        this.rootCtxNode = {
          ctxsFunc: () => ({ slot: null, size: null, slots: RootViewStyles({}) }),
          children: {}
        };
        ctxsByNameFlat.forEach((ctxsFunc, chainName) => {
          // Looking at the dom elem with chain name `chainName`, we
          // get "slot", "size", and "slots"" by calling `ctxsFunc`
          let names = chainName.split('.');
          let ptr = this.rootCtxNode;
          for (let name of names) {
            if (!ptr.children.has(name)) { ptr.children[name] = { ctxsFunc: () => ({}), children: {} }; }
            ptr = ptr.children[name];
          }
          ptr.ctxsFunc = ctxsFunc; // Set the func at the end of the pointer chain
        });
        
        let rootPar = { slots: null, w: UnitPc(1), h: UnitPc(1) };
        this.iterateCtxNodes((ctxNode, chain, par) => {
          
          let { slot=null, size=null, slots=null, decals=null } = ctxNode.ctxsFunc(par);
          
          ctxNode.gain({
            par,
            computed: { slot, size, slots, decals },
            chain // TODO: Probably not necessary; will naturally be available when needed
          });
          
          // Look at the 3 Layouts to try to determine size
          let w=null, h=null;
          for (let layout of [ slot, size, slots ]) {
            if (!U.isInspiredBy(layout, Size)) continue;
            
            let wFromSize = layout.getW(par);
            if (wFromSize !== null) {
              if (w !== null && !unitsEq(w, wFromSize)) throw new Error('Conflict at size.w');
              w = wFromSize;
            }
            
            let hFromSize = layout.getH(par);
            if (hFromSize !== null) {
              if (h !== null && !unitsEq(h, hFromSize)) throw new Error('Conflict at size.h');
              h = hFromSize;
            }
          }
          
          if (!w || !w.isAbsolute()) w = UnitPc(1);
          if (!h || !h.isAbsolute()) h = UnitPc(1);
          
          let nextPar = { slots, w, h };
          return [ nextPar ];
          
        }, [ rootPar ]);
        
      },
      iterateCtxNodes: function(it, nextArgs=[], chain=[], node=this.rootCtxNode) {
        nextArgs = it(node, chain, ...nextArgs);
        node.children.forEach((node, name) => this.iterateCtxNodes(it, nextArgs, chain.concat([ name ]), node));
      },
      getCtxNode: function(...chain) {
        let ret = { children: { root: this.rootCtxNode } };
        for (let pc of chain) ret = ret.children[pc];
        return ret;
      },
      getCmpTimeFwkAssets: C.notImplemented,
      initReal: C.notImplemented,
      addChildReal: C.notImplemented,
      remChildReal: C.notImplemented,
      makeFeelable: C.notImplemented
    })});
    let Real = U.inspire({ name: 'Real', insps: { Hog }, methods: (insp, Insp) => ({
      init: function({ reality=null, realized=null, nameChain=null, altNames=[] }={}) {
        
        if (nameChain === null) throw new Error('Missing "nameChain" param');
        if (nameChain.find(v => v.has('.'))) throw new Error(`Invalid Real name: [${nameChain.join(', ')}]`);
        //if (!reality) throw new Error('Missing "reality" param');
        if (!realized) throw new Error('Missing "realized" param');
        
        insp.Hog.init.call(this);
        
        this.reality = reality;     // Our link to a Reality instance
        this.nameChain = nameChain; // The list of names to specify our role
        this.realized = realized;   // Reference to a node in a graphics framework
        
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
      addReal: function(realName) {
        let real = this.reality.initReal([ ...this.nameChain, realName ]);
        this.reality.addChildReal(this, real);
        return real;
      },
      shut0: function() {
        this.reality.remChildReal(this);
      }
    })});
    
    
    return {
      RealLayout,
      
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
