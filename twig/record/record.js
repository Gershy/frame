// TODO: changing an Arr via "delta" uses Objects, but the wobble produced
// uses Arrays
// The "delta" needs to use Objects since the key may refer to an existing
// child.
// It's tricky for the wobble to return an Object, since the keys available
// at the time the wobble data is generated don't reliably correspond to
// to the actual names the generated Records may have. The key isn't even
// provided as "name" to the `shape` call. The resulting record name may be
// calculated arbitrarily, and not even known to the interfacer providing
// the "delta" data.

U.makeTwig({ name: 'record', twigs: [], make: (record) => {
  
  const { TreeNode, Wobbly } = U;
  const RECORD_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
  
  let NEXT_TEMP = 0;
  let getTempName = () => {
    
    // Returns globally unique identifiers which aren't valid Record names
    
    let id = U.id(NEXT_TEMP++, 8);
    if (id === 'ffffffff') throw new Error('EXHAUSTED IDS'); // Checking for this is almost silly
    return 'TEMP((' + id + '))';
    
  };
  
  // Outline
  const Outline = U.makeClass({ name: 'Outline', inspiration: { TreeNode }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=null }) {
      
      if (!recCls) throw new Error('Missing "recCls" param');
      
      insp.TreeNode.init.call(this, { name });
      this.utilities = {};
      this.recCls = recCls;
      
    },
    genRecordParams: function() {
      return { outline: this };
    },
    requireChildNameMatch: function() { return true; },
    addUtility: function(name, utility) {
      
      if (O.has(this.utilities, name)) throw new Error('Tried to overwrite utility "' + name + '"');
      this.utilities[name] = utility;
      
    }
    
  })});
  const Val = U.makeClass({ name: 'Val', inspiration: { Outline }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=RecordStr, defaultValue=null }) {
      
      insp.Outline.init.call(this, { name, recCls });
      this.defaultValue = defaultValue;
      
    }
    
  })});
  const Obj = U.makeClass({ name: 'Obj', inspiration: { Outline }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=RecordObj, children={} }) {
      
      insp.Outline.init.call(this, { name, recCls });
      this.children = {};
      
    },
    add: function(outline) {
      
      if (outline.par) throw new Error('Outline(' + outline.getAddress() + ') already has a parent');
      if (this.children[outline.name]) throw new Error(`Tried to overwrite ${this.describe()} -> ${outline.name}`);
      
      this.children[outline.name] = outline;
      this.children[outline.name].par = this;
      
      return outline;
      
    },
    getNamedChild: function(name) {
      
      return O.has(this.children, name) ? this.children[name] : null;
      
    }
    
  })});
  const Arr = U.makeClass({ name: 'Arr', inspiration: { Outline }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=RecordArr, template=null, genName=null }) {
      
      if (!template && genName) throw new Error('Can\'t provide "genName" without "template"');
      
      insp.Outline.init.call(this, { name, recCls });
      this.template = template;
      this.genName = genName;
      
    },
    requireChildNameMatch: function() { return false; },
    getNamedChild: function(name) {
      
      if (this.template && this.template.name === name) return this.template;
      return null;
      
    },
    setTemplate: function(outline, genName=null) {
      
      // TODO: Couldn't it be nice for multiple Arrs to reference the same template?
      // That's illegal due to `outline.par` validation
      
      if (this.template) throw new Error('Tried to overwrite template');
      if (outline.par) throw new Error('Outline already has parent');
      
      this.template = outline;
      this.template.par = this;
      if (genName) this.genName = genName;
      return this.template
      
    }
    
  })});
  const Ref = U.makeClass({ name: 'Ref', inspiration: { Val }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=RecordRef, target=null }) {
      
      insp.Val.init.call(this, { name, recCls });
      this.target = target;
      
    },
    setTarget: function(target) {
      
      this.target = target;
      return target;
      
    }
    
  })});
  
  // Record
  const Record = U.makeClass({ name: 'Record', inspiration: { TreeNode, Wobbly }, methods: (insp, Cls) => ({
    
    init: function({ outline }) {
      
      if (!outline) throw new Error('Missing "outline" param');
      
      insp.TreeNode.init.call(this, { name: getTempName() });
      insp.Wobbly.init.call(this);
      this.outline = outline;
      
    },
    
    hasResolvedName: function() { return !S.startsWith(this.name, 'TEMP(('); },
    changeName: function(name) {
      
      name = name.toString();
      if (name === this.name) return;
      
      if (!RECORD_NAME_REGEX.test(name)) throw new Error(`Illegal Record name: "${name}"`);
      
      let par = this.par;
      if (par) par.remChild(this);
      
      let origName = this.name;
      this.name = name;
      
      if (!par) return this; // With no parent to be re-added to, things are simple
      
      // If there's a parent we can't finish until being added back
      try {
        
        par.addChild(this);
        
      } catch(err) {
        
        // If an error occurs reset the name to how it was originally before
        // allowing the error to be thrown
        this.name = origName;
        par.addChild(this);
        throw err;
        
      }
        
      return this;
      
    },
    
    getChildrenDescriptor: function() { return 'none'; },
    getNamedChild: function(name) {
      
      let numDerefs = 0;
      while (name[numDerefs] === '@') numDerefs++;
      if (numDerefs) name = name.substr(numDerefs);
      
      let child = this.getNamedChild0(name);
      for (let i = 0; (i < numDerefs) && child; i++) child = child.dereference();
      return child;
      
    },
    getNamedChild0: function(name) {
      
      if (U.isType(name, String)) {
        
        if (name === '') return this;
        if (name === '~par') return this.par;
        if (S.startsWith(name, '~par(')) return this.getNamedPar(name.substr(5, name.length - 6).trim());
        
      } else {
        
        if (U.isInspiredBy(name, Outline)) return this.getPar(name);
        
      }
      
      return null;
      
    },
    getNamedPar: function(name) {
      
      let ptr = this.par;
      while (ptr) {
        if (ptr.outline.name === name) return ptr;
        ptr = ptr.par;
      }
      
      return null;
      
    },
    getPar: function(outline=null) {
      
      if (!outline) return this.par;
      
      let ptr = this.par;
      while (ptr) {
        if (ptr.outline === outline) return ptr;
        ptr = ptr.par;
      }
      
      return null;
      
    },
    
    useUtility: function(name, ...args) {
      if (!O.has(this.outline.utilities, name)) throw new Error('Couldn\'t find utility "' + name + '"');
      return this.outline.utilities[name].apply(this, args);
    },
    
    dereference: function() { throw new Error('not implemented'); },
    getJson: function() { return this.getValue(); },
    
    describe: function() {
      return this.constructor.name + '(' + (this.hasResolvedName() ? this.getAddress('str') : ('!' + this.outline.getAddress('str'))) + ')';
    },
    valueOf: function() { return this.describe(); }
    
  })});
  
  // RecordSet
  const RecordSet = U.makeClass({ name: 'RecordSet', inspiration: { Record }, methods: (insp, Cls) => ({
    
    init: function({ outline }) {
      
      insp.Record.init.call(this, { outline });
      this.children = {};
      this.length = 0;
      
    },
    
    // Child methods
    addChild: function(child) {
      
      if (this === child.par) return;
      
      if (child.par) throw new Error('Attempted to add child with parent: ' + child.describe());
      if (O.has(this.children, child.name)) throw new Error(`Tried to overwrite ${this.describe()} -> ${child.name}`);
      
      child.par = this;
      this.children[child.name] = child;
      this.length++;
      
      return child;
      
    },
    remChild: function(child) {
      
      if (U.isType(child, String)) {
        
        let name = child;
        if (!O.has(this.children, name)) throw new Error(`No child named "${name}" found`);
        child = this.children[name];
        
      }
      
      if (!child) throw new Error('Can\'t remove null child');
      if (child.par !== this) throw new Error('Can\'t remove child with a different parent');
      
      delete this.children[child.name];
      this.length--;
      child.par = null;
      
      return child;
      
    },
    getNamedChild0: function(name) {
      if (U.isType(name, String) && O.has(this.children, name)) return this.children[name];
      return insp.Record.getNamedChild0.call(this, name);
    },
    
    getChildName: function(child) { throw new Error('not implemented'); },
    getChildOutline: function(name) { throw new Error('not implemented'); },
    
    map: function(f) { return O.map(this.children, f); },
    
    setValue: function(val) {
      
      if (!val) return;
      
      for (var k in val) if (!O.has(this.children, k)) throw new Error(`Tried to set value on nonexistent child: ${this.describe()} -> ${k}`);
      for (var k in val) this.children[k].setValue(val[k]);
      
    },
    getValue: function() { return this.children; },
    getJson: function() { return this.map(child => child.getJson()); }
    
  })});
  const RecordObj = U.makeClass({ name: 'RecordObj', inspiration: { RecordSet }, methods: (insp, Cls) => ({
    
    getChildrenDescriptor: function() { return 'constant'; },
    getChildOutline: function(name) {
      if (!name) throw new Error('Missing "name" param');
      if (!O.has(this.outline.children, name)) throw new Error(`Invalid name ${name} not valid for ${this.describe()}`);
      return this.outline.children[name];
    },
    getChildName: function(rec) {
      if (rec.outline.par !== this.outline) throw new Error('Can\'t get child name for ' + rec.describe() + ' - it isn\'t our child');
      return rec.outline.name;
    }
    
  })});
  const RecordArr = U.makeClass({ name: 'RecordArr', inspiration: { RecordSet }, methods: (insp, Cls) => ({
    
    init: function(params) {
      
      insp.RecordSet.init.call(this, params);
      this.nextInd = 0;
      
    },
    getChildrenDescriptor: function() { return 'dynamic'; },
    addChild: function(child) {
      
      child = insp.RecordSet.addChild.call(this, child);
      while (O.has(this.children, this.nextInd)) this.nextInd++;
      return child;
      
    },
    remChild: function(child) {
      
      child = insp.RecordSet.remChild.call(this, child);
      if (!isNaN(child.name)) this.nextInd = Math.min(this.nextInd, parseInt(child.name, 10));
      return child;
      
    },
    getChildName: function(rec) {
      
      if (rec.par !== this) throw new Error('Can\'t get child name for ' + rec.describe() + ' - it isn\'t our child');
      
      let genName = this.outline.genName;
      let name = genName ? genName(rec) : this.nextInd.toString(); // TODO: (really tricky??) `this.nextInd` isn't incremented!! What happens if the same integer name is returned for multiple Records??
      
      if (!U.isType(name, String)) throw new Error('Invalid genName from ' + this.describe() + ' produce name of type ' + U.typeOf(name));
      
      return name;
      
    },
    getChildOutline: function(name) { return this.outline.template; }
    
  })});
  
  // RecordVal
  const RecordVal = U.makeClass({ name: 'RecordVal', inspiration: { Record }, methods: (insp, Cls) => ({
    
    init: function({ outline, initialValue=null }) {
      
      // Note: If `initialValue` is null, the corresponding Outline's `defaultValue` will be used
      
      insp.Record.init.call(this, { outline });
      this.setValue(initialValue);
      
    },
    
    sanitizeValue: function(value) { return value === null ? this.outline.defaultValue : value; },
    getValue: function() { return this.value; },
    setValue: function(value) { this.value = this.sanitizeValue(value); }
    
  })});
  const RecordStr = U.makeClass({ name: 'RecordStr', inspiration: { RecordVal }, methods: (insp, Cls) => ({
    sanitizeValue: function(value) {
      
      value = insp.RecordVal.sanitizeValue.call(this, value);
      return value === null ? '' : value.toString();
      
    }
  })});
  const RecordInt = U.makeClass({ name: 'RecordInt', inspiration: { RecordVal }, methods: (insp, Cls) => ({
    sanitizeValue: function(value) {
      
      value = insp.RecordVal.sanitizeValue.call(this, value);
      let intVal = parseInt(value, 10);
      if (isNaN(intVal)) throw new Error(`Invalid value for ${this.constructor.name}: ${intVal}`);
      return intVal;
      
    }
  })});
  
  // RecordRef
  const RecordRef = U.makeClass({ name: 'RecordRef', inspiration: { RecordVal }, methods: (insp, Cls) => ({
    
    sanitizeValue: function(value) {
      
      // Will resolve `value` to either `null`, or an address Array
      
      let origValue = value = insp.RecordVal.sanitizeValue.call(this, value);
      if (value === null) return null;
      
      let rec = null;
      
      if (U.isInspiredBy(value, Record)) {
        
        rec = value;
        
      } else {
        
        rec = this.getChild(value);
        if (!rec) throw new Error('Invalid address for ' + this.describe() + ': ' + value);
        
      }
      
      // TODO: Always produces an absolute address, but really should never!
      // TODO: Missing any validation based on `this.outline.target`!
      
      return rec.getAddress();
      
    },
    
    getRefAddress: function() {
      
      return this.value;
      
    },
    dereference: function() {
      
      // TODO: Shouldn't need to walk all the way to the root!
      
      if (!this.value) return null;
      
      let ptr = this;
      while (ptr.par) ptr = ptr.par;
      return ptr.getChild(this.getRefAddress());
      
    },
    getJson: function() { return this.value ? this.getRefAddress().join('.') : null; }
    
  })});
  
  // Editor
  const Editor = U.makeClass({ name: 'Editor', methods: (insp, Cls) => ({
    
    init: function() {
      
      this.ops = [];
      this.wobbles = [];
      
    },
    
    shape: function({ err=new Error(), rec=null, outline=null, par=null, name=null, data=null, assumeType=null }) {
      
      if (rec && outline) throw new Error('If providing "rec" shouldn\'t provide "outline"');
      if (rec && par) throw new Error('If providing "rec" shouldn\'t provide "par"');
      if (outline && par) throw new Error('If providing "outline" shouldn\'t provide "par"');
      if (!rec && !outline && !par) throw new Error('Need to provide one of "rec", "outline", and "par"');
      if (name && !par) throw new Error('Don\'t provide "name" without providing "par"');
      
      // We can get `outline` since we have `rec` or `par`
      if (!outline) outline = rec ? rec.outline : par.getChildOutline(name);
      
      // For the root outline, ensure `name` has a value
      if (!outline.par) name = rec ? rec.name : outline.name;
      
      // We can ensure we have `rec`, since we have `outline`
      let creatingNew = !rec;
      if (creatingNew) {
        const RecordCls = outline.recCls;
        rec = new RecordCls(outline.genRecordParams());
      }
      
      // If `data` isn't an Object, we're certainly working with "exact" (because
      // "delta" isn't supported for RecordVal and the like).
      // Otherwise, we either assume the type or learn it from `data.type`.
      let type = U.isType(data, Object) ? (assumeType || data.type) : 'exact';
      if (type !== 'exact' && type !== 'delta') throw new Error(`Invalid type: ${type}`);
      
      // U.output('REC ' + rec.describe() + ' resulted in: ' + rec.getChildrenDescriptor() + ', ' + type);
      
      let shapeFunc = ({
        constant: {
          exact: () => {
            
            let childrenData = null;
            
            if (data === null) {
              childrenData = {};
            } else if (assumeType) {
              // A type is assumed! `data` is directly the `childrenData`
              childrenData = data;
            } else {
              // A type is given! `data` contains the `childrenData`
              if (!O.has(data, 'children')) { err.message = 'Shaping (constant, exact) requires a "children" property'; throw err; }
              childrenData = data.children;
            }
            
            if (!U.isType(childrenData, Object)) { err.message = `Expected Object (got ${U.typeOf(childrenData)})`; throw err; }
            
            let outlineChildren = outline.children;
            
            // Because this is "exact", we loop through ALL outline children
            for (var k in outlineChildren) {
              
              this.shape({ err, assumeType, data: O.has(childrenData, k) ? childrenData[k] : null,
              ...(
                O.has(rec.children, k)
                  ? { rec: rec.children[k] }
                  : { par: rec, name: k }
              )});
              
            }
            
          },
          delta: () => {
            
            let childrenData = null;
            
            if (data === null) {
              childrenData = {};
            } else if (assumeType) {
              // A type is assumed! `data` is directly the `childrenData`
              childrenData = data;
            } else {
              // A type is given! `data` contains the `childrenData`
              if (!O.has(data, 'children')) { err.message = 'Shaping (constant, delta) requires a "children" property'; throw err; }
              childrenData = data.children;
            }
            
            if (!U.isType(childrenData, Object)) { err.message = `Expected Object (got ${U.typeOf(childrenData)})`; throw err; }
            
            // Because this is "delta", we only affect any children which were mentioned
            // If `k` doesn't correspond to the Outline structure, an error will rightfully be thrown later, by `getChildOutline`
            for (var k in childrenData) {
              
              this.shape({ err, assumeType, data: childrenData[k],
              ...(
                O.has(rec.children, k)
                  ? { rec: rec.children[k] }
                  : { par: rec, name: k }
              )});
              
            }
            
          }
        },
        dynamic: {
          exact: () => {
            
            let childrenData = null;
            
            if (data === null) {
              childrenData = {};
            } else if (assumeType) {
              childrenData = data;
            } else {
              if (!O.has(data, 'children')) { err.message = 'Shaping (dynamic, exact) requires a "children" property'; throw err; }
              childrenData = data.children;
            }
            
            if (!U.isType(childrenData, Object)) { err.message = `Expected Object (got ${U.typeOf(childrenData)})`; throw err; }
            
            let delta = { add: [], rem: [] };
            let needsDelete = O.clone(rec.children);
            
            // Mod/add any existing/new children
            for (var k in childrenData) {
              
              if (O.has(rec.children, k)) {
                
                delete needsDelete[k]; // Unmark this child for deletion
                this.shape({ err, rec: rec.children[k], data: childrenData[k], assumeType });
                
              } else {
                
                let newChild = this.shape({ err, par: rec, data: childrenData[k], assumeType });
                delta.add.push(newChild);
                
              }
              
            }
            
            // Remove any children not unmarked (a.k.a "marked"!) for deletion
            for (var k in needsDelete) {
              this.addOp({ err, type: 'remChild', par: rec, child: needsDelete[k] });
              delta.rem.push(k);
            }
            
            if (delta.add.length || delta.rem.length) this.wobbles.push({ rec, data: delta });
            
          },
          delta: () => {
            
            let addData = {};
            let remData = {};
                        
            if (data === null) {
              // Do nothing
            } else {
              if (O.has(data, 'add')) addData = data.add;
              if (O.has(data, 'rem')) remData = data.rem;
            }
            
            if (!U.isType(addData, Object)) { err.message = `Expected "add" as Object (got ${U.typeOf(addData)})`; throw err; }
            if (!U.isType(remData, Object)) { err.message = `Expected "rem" as Object (got ${U.typeOf(remData)})`; throw err; }
            
            let delta = { add: [], rem: [] };
            
            // Mod/add any existing/new children
            for (var k in addData) {
              if (O.has(rec.children, k)) {
                this.shape({ err, rec: rec.children[k], data: addData[k], assumeType });
              } else {
                let newChild = this.shape({ err, par: rec, data: addData[k], assumeType });
                delta.add.push(newChild);
              }
            }
            
            // Rem appropriate children
            for (var k in remData) {
              this.addOp({ err, type: 'remChild', par: rec, child: k });
              delta.rem.push(k);
            }
            
            if (delta.add.length || delta.rem.length) this.wobbles.push({ rec, data: delta });
            
          }
        },
        none: {
          exact: () => {
            this.addOp({ err, type: 'setValue', rec: rec, value: data });
            this.wobbles.push({ rec, data });
          },
          delta: () => {
            throw new Error('not implemented');
          }
        }
      })[rec.getChildrenDescriptor()][type];
      
      if (!shapeFunc) throw new Error('Invalid shape func: ' + rec.getChildrenDescriptor() + ' / ' + data.type);
      
      shapeFunc();
      
      // Check if we can do any immediate initialization using a constant parent
      
      if (par && par.getChildrenDescriptor() === 'constant') {
        
        // Constant parents allow name and parent-child relationship to be immediately initialized
        
        if (!name) throw new Error('Missing name for a constant child');
        
        rec.changeName(name);
        par.addChild(rec);
        
      } else {
        
        // Without a constant parent, things are trickier
        
        if (name) this.addOp({ err, type: 'setNameSimple', rec, name });
        else      this.addOp({ err, type: 'setNameCalculated', rec });
        
        if (par) {
          
          this.addOp({ err, type: 'addChild', par, child: rec });
          // this.wobbles.push({ rec: par, data: { add: [ rec ], rem: [] } });
          
        }
        
      }
      
      // Only set `rec` up if it's new!
      if (creatingNew) this.addOp({ err, type: 'setUp', rec });
      
      return rec;
      
    },
    
    addOp: function({ err, type, ...params }) {
      
      this.ops.push({ err: COMPILER.formatError(err), type, params });
      
    },
    execOp: function(op) {
      
      if (op.type === 'setNameSimple') {
        
        let { rec, name } = op.params;
        let origName = rec.name;
        rec.changeName(name);
        return { type: 'setNameSimple', params: { rec, name: origName } };
        
      } else if (op.type === 'setNameCalculated') {
        
        let { rec } = op.params;
        let origName = rec.name;
        rec.changeName(rec.par.getChildName(rec));
        return { type: 'setNameSimple', params: { rec, name: origName } };
        
      } else if (op.type === 'setUp') {
        
        let { rec } = op.params;
        rec.up();
        return { type: 'setDn', params: { rec } };
        
      } else if (op.type === 'setDn') {
        
        let { rec } = op.params;
        rec.dn();
        return { type: 'setUp', params: { rec } };
        
      } else if (op.type === 'addChild') {
        
        let { par, child } = op.params;
        par.addChild(child);
        return { type: 'remChild', params: { par, child } };
        
      } else if (op.type === 'remChild') {
        
        let { par, child } = op.params;
        par.remChild(child);
        return { type: 'addChild', params: { par, child } };
        
      } else if (op.type === 'setValue') {
        
        let { rec, value } = op.params;
        let origValue = rec.getValue();
        rec.setValue(value);
        
        return { type: 'setValue', params: { rec, value: origValue } };
        
      }
      
      throw new Error('Unknown op: ' + op.type);
      
    },
    
    attemptOps: function(ops, undoOnFailure=true) {
      
      let allUndoOps = [];
      let remainingOps = null;
      let errs = [];
      
      while (ops.length) {
        
        remainingOps = [];
        errs = [];
        
        for (let i = 0; i < ops.length; i++) {
          
          try {
            
            let undoOp = this.execOp(ops[i]);
            allUndoOps.push(undoOp);
            
          } catch (err) {
            
            remainingOps.push(ops[i]);
            errs.push(err);
            
          }
          
        }
        
        // Signal completion! Success/failure depends on if `remainingOps` is empty/non-empty
        if (!remainingOps.length || ops.length === remainingOps.length) break;
        
        // If we're not done (we made progress, but not 100% progress), set `ops` to `remainingOps`
        ops = remainingOps;
        
      }
      
      // The operation didn't complete, AND this was an undo operation. That's real bad.
      if (remainingOps.length && !undoOnFailure) throw new Error('Fatal MFRF: couldn\'t undo an unsuccessful edit');
      
      if (remainingOps.length) {
        
        // errs[0].message = 'Transaction failed (#1:) ' + errs[0].message;
        // throw errs[0];
        
        U.output('FAILURE', A.map(errs, err => COMPILER.formatError(err))[0]);
        this.attemptOps(allUndoOps, false); // Signal that this attempt can't be undone (it would be undoing an undo)
        throw new Error('Transaction failed');
        
      }
      
      return allUndoOps;
      
    },
    run: function() {
      
      let ops = this.ops;
      let wobbles = this.wobbles;
      
      this.ops = [];
      this.wobbles = [];
      
      let undoOps = this.attemptOps(ops);
      A.each(wobbles, w => w.rec.wobble(w.data));
      return undoOps;
      
    }
    
  })});
  
  O.include(record, {
    Outline, Val, Obj, Arr, Ref,
    Record, RecordObj, RecordArr, RecordVal, RecordStr, RecordInt, RecordRef,
    Editor
  });
  
}});
