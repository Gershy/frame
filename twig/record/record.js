U.makeTwig({ name: 'record', twigs: [ 'clearing' ], make: (record, clearing) => {
  
  const { TreeNode, Wobbly } = U;
  const RECORD_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
  
  let NEXT_TEMP = 0;
  let getTempName = () => {
    
    // Returns globally unique identifiers which don't qualify as valid Record names
    
    let id = U.id(NEXT_TEMP++, 8);
    if (id === 'ffffffff') throw new Error('EXHAUSTED IDS'); // Checking for this is almost silly
    return 'TEMP((' + id + '))';
    
  };
  
  // Outline
  const Outline = U.makeClass({ name: 'Outline', inspiration: { TreeNode }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=null }) {
      
      if (!recCls) throw new Error('Missing "recCls"');
      
      insp.TreeNode.init.call(this, { name });
      this.utilities = {};
      this.recCls = recCls;
      
    },
    requireChildNameMatch: function() { return true; },
    addUtility: function(name, utility) {
      
      if (this.utilities[name]) throw new Error('Tried to overwrite utility "' + name + '"');
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
    addChild: function(outline) {
      
      if (outline.par) throw new Error('Outline(' + outline.getAddress() + ') already has a parent');
      if (this.children[outline.name]) throw new Error('Tried to overwrite ' + this.getAddress('str') + ' -> ' + outline.name);
      
      this.children[outline.name] = outline;
      this.children[outline.name].par = this;
      
      return outline;
      
    },
    getNamedChild: function(name) {
      
      return this.children[name] || null;
      
    }
    
  })});
  const Arr = U.makeClass({ name: 'Arr', inspiration: { Outline }, methods: (insp, Cls) => ({
    
    init: function({ name, recCls=RecordArr }) {
      
      insp.Outline.init.call(this, { name, recCls });
      this.template = null;
      this.genName = null;
      
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
    
    hasResolvedName: function() {
      
      return !S.startsWith(this.name, 'TEMP((');
      
    },
    updateName: function(name) {
      
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
      return this.outline.utilities[name].apply(this, args);
    },
    
    dereference: function() { throw new Error('not implemented'); },
    getJson: function() { return this.getValue(); },
    
    describe: function() {
      return this.constructor.name + '(' + (this.hasResolvedName() ? this.getAddress('str') : ('!' + this.outline.getAddress('str'))) + ')';
    },
    valueOf: function() {
      return this.describe();
    }
    
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
      
      if (child.par) throw new Error('Attempted to add ' + child.describe() + ' (already has parent)');
      if (this.children[child.name]) throw new Error('Tried to overwrite ' + this.describe() + ' -> ' + child.name);
      
      child.par = this;
      this.children[child.name] = child;
      this.length++;
      
      /*this.wobble({
        add: [ child ],
        rem: []
      });*/
      
      return child;
      
    },
    remChild: function(child) {
      
      if (U.isType(child, String)) {
        
        let name = child;
        child = this.children[name];
        if (!child) throw new Error('No child named "' + name + '" found');
        
      }
      
      if (!child || child.par !== this) throw new Error('Can\'t remove ' + child.describe());
      
      delete this.children[child.name];
      this.length--;
      child.par = null;
      
      /*this.wobble({
        add: [],
        rem: [ child ]
      });
      */
      
      return child;
      
    },
    getNamedChild0: function(name) {
      if (U.isType(name, String) && this.children[name]) return this.children[name];
      return insp.Record.getNamedChild0.call(this, name);
    },
    
    getChildName: function(child) { throw new Error('not implemented'); },
    getChildOutline: function(name) { throw new Error('not implemented'); },
    
    map: function(f) {
      return O.map(this.children, f);
    },
    
    setValue: function(val) {
      
      if (!val) return;
      
      for (var k in val) if (!this.children[k]) throw new Error('Tried to set value on nonexistent child: ' + this.describe() + ' -> ' + k);
      for (var k in val) this.children[k].setValue(val[k]);
      
    },
    getValue: function() {
      return this.children;
    },
    getJson: function() {
      return this.map(child => child.getJson());
    }
    
  })});
  const RecordObj = U.makeClass({ name: 'RecordObj', inspiration: { RecordSet }, methods: (insp, Cls) => ({
    
    getChildrenDescriptor: function() { return 'static'; },
    getChildOutline: function(name) {
      if (!name) throw new Error('Missing "name" param');
      if (!this.outline.children[name]) throw new Error('Invalid "name" param: ' + name);
      return this.outline.children[name];
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
      while (this.children[this.nextInd]) this.nextInd++;
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
      let name = genName ? genName(rec) : this.nextInd.toString(); // TODO: `this.nextInd` isn't incremented!! What happens if the same integer name is returned for multiple Records??
      
      if (!U.isType(name, String)) throw new Error('Invalid genName from ' + this.describe() + ' produce name of type ' + U.typeOf(name));
      
      return name;
      
    },
    getChildOutline: function(rec) {
      return this.outline.template;
    }
    
  })});
  
  // RecordVal
  const RecordVal = U.makeClass({ name: 'RecordVal', inspiration: { Record }, methods: (insp, Cls) => ({
    
    init: function({ outline, initialValue=null }) {
      
      // Note: If `initialValue` is null, the corresponding Outline's `defaultValue` will be used
      
      insp.Record.init.call(this, { outline });
      this.setValue(initialValue);
      
    },
    
    sanitizeValue: function(value) {
      return value === null ? this.outline.defaultValue : value;
    },
    getValue: function() {
      return this.value;
    },
    setValue: function(value) {
      
      this.value = this.sanitizeValue(value);
      // this.wobble();
      
    }
    
  })});
  const RecordStr = U.makeClass({ name: 'RecordSer', inspiration: { RecordVal }, methods: (insp, Cls) => ({
    sanitizeValue: function(value) {
      value = insp.RecordVal.sanitizeValue.call(this, value);
      return value === null ? '' : value.toString();
    }
  })});
  
  // RecordRef
  const RecordRef = U.makeClass({ name: 'RecordRef', inspiration: { RecordVal }, methods: (insp, Cls) => ({
    
    sanitizeValue: function(value) {
      
      // Will resolve `value` to either `null`, or an address Array
      
      let origValue = value = insp.RecordRef.sanitizeValue.call(this, value);
      
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
      
      /*var format = this.outline.format;
      
      if (value === null) {
        
        var arrVal = null;
        
      } else if (U.isObj(value, Array)) {
        
        // TODO: `Array` format is ambiguous: is it a "."-split address?? Or is it the actual value??
        // Currently considering it to be the actual value.
        var arrVal = value;
        
      } else if (U.isObj(value, String)) {
        
        var pcs = value.split('.');
        if (pcs.length !== format.length) throw new Error('String value "' + value + '" does not match format "' + format.join('.') + '"');
        var arrVal = pcs.map(function(v, i) { return format[i][0] === '$' ? v : U.SKIP; });
        
      } else if (U.isInstance(value, ds.Dossier)) {
        
        if (!value.hasResolvedName()) throw new Error('Can\'t reference Dossier without resolved name');
        
        var vals = [];
        var addr = value.getNameChain();
        for (var endOff = 1, len = Math.min(format.length, addr.length); endOff <= len; endOff++) {
          var tmp = format[format.length - endOff];
          var val = addr[addr.length - endOff];
          
          if (tmp[0] === '$')       vals.push(val);   // Add to `vals` for each variable component in `format`
          else if (tmp[0] === '~')  break;            // We're iterating from end to start; variables cannot occur before tilde-prefixed values
          else if (tmp !== val)     throw new Error(  // Non-variable components of the supplied address must match the corresponding format component
              '`DossierRef` "' + this.getAddress() + '" was supplied value "' + addr.join('.') + '", ' +
              'but this doesn\'t match the format "' + format.join('.') + '"'
            );
        }
        
        var arrVal = U.arr.reverse(vals);
        
      } else {
        
        throw new Error('`DosserRef.prototype.setInternalValue` accepts `null`, `Array`, `String` and `Dossier` but received ' + U.typeOf(value));
        
      }
      
      if (arrVal !== null) {
        
        // Validate that the value has the correct number of parameters
        if (arrVal.length !== A.count(format, function(pc) { return pc[0] === '$'; })) {
          
          throw new Error(
            this.constructor.title + '(' + this.getAddress() + ') rejects value [ ' + arrVal.join(', ') + ' ] - ' +
            'incorrect number of parameters for format: "' + format.join('.') + '"'
          );
          
        }
        
        // Verify that all parameters are either Strings or Numbers
        for (var i = 0; i < arrVal.length; i++) {
          if (!U.isObj(arrVal[i], String) && !U.isObj(arrVal[i], Number)) {
            throw new Error(
              this.constructor.title + '(' + this.getAddress() + ') rejects value - ' +
              'value contains invalid type: ' + U.typeOf(arrVal[i])
            );
          }
        }
        
        // TODO: Verify that the `Array` is of the right length, and dereferences
        // to an existing value?? May make the values check irrelevant.
        
      }
      
      return arrVal;*/
      
    },
    
    getRefAddress: function() {
      
      return this.value;
      
      /*var format = this.outline.format;
      
      // If `this.value` is null resolve it to an empty array
      var vals = this.value || [];
      var ret = [];
      var valInd = 0;
      for (var i = 0; i < format.length; i++)
        ret.push(format[i][0] === '$' ? vals[valInd++] : format[i]);
      
      return ret;*/
      
    },
    dereference: function() {
      
      // TODO: Shouldn't need to walk all the way to the root!
      
      if (!this.value) return null;
      
      let ptr = this;
      while (ptr.par) ptr = ptr.par;
      return ptr.getChild(this.getRefAddress());
      
    },
    getJson: function() {
      return this.value ? this.getRefAddress().join('.') : null;
    }
    
  })});
  
  // Editor
  const Editor = U.makeClass({ name: 'Editor', methods: (insp, Cls) => ({
    
    init: function() {
      this.ops = [];
      this.wobbles = [];
    },
    create: function({ err=new Error(), outline=null, name=null, data=null, par=null }) {
      
      if (!outline && !par) throw new Error('Need either "outline" or "par"');
      if (!outline && par) outline = par.getChildOutline();
      
      const RecordCls = outline.recCls;
      let rec = new RecordCls({ outline });
      
      this.build({ err, rec, data });
      
      if (!name && !outline.par) name = outline.name;
      
      if (name) this.addOp({ err, type: 'setNameSimple', rec, name });
      else      this.addOp({ err, type: 'setNameCalculated', rec });
      
      if (par)  {
        this.wobbles.push({
          rec: par,
          data: { add: [ rec ], rem: [] }
        });
        this.add({ par, child: rec });
      }
      
      this.addOp({ err, type: 'setUp', rec });
      
      return rec;
      
    },
    build: function({ err=new Error(), rec, data=null }) {
      
      // TODO: This "mod" action is only good upon creation. It can't actually
      // "modify" anything:
      
      // For "static"-type children there's never an attempt to modify existing
      // children
      
      // For "dynamic"-type children there's never an attempt to delete children
      // which are no longer listed
      
      let outline = rec.outline;
      let childrenDesc = rec.getChildrenDescriptor();
      
      if (childrenDesc === 'none') {
        
        // Without children, `data` refers to a value
        this.mod({ err, rec, value: data });
        
      } else if (childrenDesc === 'static') {
        
        // With static children, items in `data` should correspond to the known static children
        if (!data) data = {};
        if (!U.isType(data, Object)) throw new Error('Expected Object');
        
        let staticChildren = outline.children;
        for (var k in staticChildren) {
          
          let child = this.create({ err, outline: staticChildren[k], name: k, data: data[k] || null });
          this.add({ err, par: rec, child: child });
          
        }
        
      } else if (childrenDesc === 'dynamic') {
        
        // With dynamic children, each item in `data` defines a new child dynamically
        if (!data) data = {};
        if (!U.isType(data, Object)) throw new Error('Expected Object');
        
        let dynamicTemplate = outline.template;
        let children = [];
        for (var k in data) {
          
          let child = this.create({ err, outline: dynamicTemplate, data: data[k] });
          this.add({ err, par: rec, child });
          children.push(child);
          
        }
        
        this.wobbles.push({
          rec: rec,
          data: { add: children, rem: [] }
        });
        
      }
      
    },
    add: function({ err=new Error(), par, child }) {
      
      this.addOp({ err, type: 'addChild', par, child });
      
    },
    rem: function({ err=new Error(), par, child }) {
      
      if (!par) par = child.par;
      
      this.wobbles.push({
        rec: par,
        data: { add: [], rem: [ child ] }
      });
      this.addOp({ err, type: 'setDn', rec: child });
      this.addOp({ err, type: 'remChild', par, child });
      
    },
    mod: function({ err=new Error(), rec, value }) {
      
      this.wobbles.push({
        rec: rec,
        data: null // no delta available
      });
      this.addOp({ err, type: 'setValue', rec, value });
      
    },
    
    addOp: function({ err, type, ...params }) {
      
      // if (type === 'setDn') U.output('TYPE:', params.rec.constructor.name);
      if (type === 'setDn' && !params.rec) { U.output(params); throw new Error('HERE! ' + U.typeOf(params)); }
      
      this.ops.push({ err: COMPILER.formatError(err), type, params });
      
    },
    execOp: function(op) {
      
      if (op.type === 'setNameSimple') {
        
        let { rec, name } = op.params;
        let origName = rec.name;
        rec.updateName(name);
        
        return { type: 'setNameSimple', params: { rec, name: origName } };
        
      } else if (op.type === 'setNameCalculated') {
        
        let { rec } = op.params;
        let origName = rec.name;
        rec.updateName(rec.par.getChildName(rec));
        
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
      
      if (remainingOps.length && !undoOnFailure) {
        throw new Error('Fatal MFRF: couldn\'t undo an unsuccessful edit');
      }
      
      if (remainingOps.length) {
        
        errs[0].message = 'Transaction failed (#1:) ' + errs[0].message;
        throw errs[0];
        
        U.output('FAILURE', A.map(errs, err => COMPILER.formatError(err))[0]);
        this.attemptOps(allUndoOps, false); // Make sure we don't try to undo the undo
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
  
  let outline = Obj({ name: 'root' });
  outline.addChild(Val({ name: 'val1', defaultValue: 'val111' }));
  outline.addChild(Val({ name: 'val2', defaultValue: 'val222' }));
  
  let arr = outline.addChild(Arr({ name: 'arr' }));
  let tmp = arr.setTemplate(Obj({ name: 'tmp' }), tmp => tmp.getChild('hi').getValue());
  tmp.addChild(Val({ name: 'hi' }));
  tmp.addChild(Val({ name: 'hello' }));
  
  let editor = Editor();
  let rec = editor.create({ outline: outline, data: {
    
    val2: 'wheee',
    arr: {
      ey: {
        hi: 'ey',
        hello: 'whee'
      },
      oy: {
        hi: 'oy',
        hello: 'whee'
      },
      woy: {
        hi: 'woyyyy',
        hello: 'whee'
      },
    }
    
  }});
  editor.run();
  
  rec.getChild('arr').addConcern((v, delta) => U.output('CONCERN:', delta));
  
  editor.rem({ child: rec.getChild('arr.woyyyy') });
  editor.run();
  
  editor.create({ par: rec.getChild('arr'), data: {
    hi: 'deedooo',
    hello: 'hukahukahukahukahukahukahukahukahukahukahukahuka'
  }});
  editor.run();
  
  U.output(rec.getJson());
  
  O.include(record, {
    Val, Obj, Arr, Ref,
    RecordObj, RecordArr, RecordStr, RecordRef,
    Editor
  });
  
}});
