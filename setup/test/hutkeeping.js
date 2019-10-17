let Keep = U.inspire({ name: 'Keep', methods: (insp, Insp) => ({
  init: function(par, name, func) {
    this.par = par;
    this.root = par ? par.root : this;
    this.name = name;
    this.func = func;
    this.children = new Map();
    this.sandwich = { before: null, after: null };
    
    if (!this.par) {
      this.total = 0;
      this.passed = 0;
      this.errId = 0;
      this.formatError = err => err.stack;
    } else {
      if (this.par.children.has(this.name)) throw new Error(`Multiple Keeps named "${this.name}"`);
      this.par.children.set(this.name, this);
    }
  },
  contain: function(fn) {
    let amt0 = this.children.size;
    fn(this);
    if (this.children.size === amt0) throw new Error('Called "contain" but didn\'t add any children');
    return this;
  },
  getChild: function(...names) {
    let ptr = this;
    names.forEach(name => {
      if (!ptr.children.has(name)) throw new Error(`Couldn't find child ${names.join('.')} (at name ${name})`);
      ptr = ptr.children.get(name);
    });
    return ptr;
  },
  chain: function() {
    let ptr = this;
    let chain = [];
    while (ptr) { chain.push(ptr); ptr = ptr.par; };
    return chain.reverse();
  },
  fullName: function() {
    let ptr = this;
    let names = [];
    while (ptr) { names.push(ptr.name); ptr = ptr.par; }
    return names.reverse().join('.');
  },
  run: async function() {
    
    let [ result, msg, err ] = [ null, null, null ];
    
    let chain = this.chain();
    for (let par of chain) if (par.sandwich.before) await par.sandwich.before();
    try {
      let v = this.func ? await this.func() : { result: null };
      
      if (U.isType(v, Array)) {
        
        for (let [ checkMsg, check ] of v) if (!check()) { result = false; msg = checkMsg; break; }
        
      } else if (U.isType(v, Object)) {
        
        if (!v.has('result')) throw new Error('Invalid Object format: missing "result" property');
        result = v.result;
        if (v.has('msg')) msg = v.msg;
        
      } else {
        
        throw new Error('Invalid test result format');
        
      }
      
    } catch(err0) {
      result = false;
      msg = null;
      err = err0;
      
      let errId = this.root.errId++;
      err.message = `TESTERROR(${errId}):\n${this.fullName()}:\n${err.message}`;
      err.id = errId;
      console.log(this.root.formatError(err));
    }
    
    for (let par of chain) if (par.sandwich.after) await par.sandwich.after();
    
    this.root.total++;
    
    if (this.children.size) {
      
      let cTotal = this.children.size;
      let cPassed = 0;
      let cases = {};
      
      for (let child of this.children.values()) {
        let { result, err, msg, childResults } = await child.run();
        if (result !== false) cPassed++;
        cases[child.name] = { result, err, msg, childResults };
      }
      
      if (cPassed < cTotal) result = false;
      if (result !== false) this.root.passed++;
      
      return {
        result: result !== false, err, msg,
        childResults: {
          summary: { total: cTotal, passed: cPassed },
          cases
        }
      };
      
    } else {
      
      if (result !== false) this.root.passed++;
      
      return {
        result: result !== false,
        err,
        msg,
        childResults: null
      };
      
    }
    
  },
  showResults: async function(foundation, args) {
    
    if (this.par) throw new Error('Should only do `showResults` from the root Keep');
    
    let suitePcs = args.has('suite') ? args.suite.split('.') : [];
    let entryKeep = suitePcs.isEmpty() ? this : this.getChild(...suitPcs); // Get specific suite
    
    let firstErr = null;
    let outputTest = (name, run, ind='') => {
      let { result, err=null, msg=null, childResults } = run;
      
      // If no `firstErr` yet, `firstErr` becomes `err`
      if (err && !firstErr) firstErr = err;
      
      // Show the single result, with optional error and failure-message
      let { summary, cases } = childResults || { summary: null, cases: {} };
      console.log(`${ind}[${result ? '.' : 'X'}] ${name}`);
      if (err)              console.log(`${ind}    TESTERROR(${err.id}) - ${err.message.split('\n')[2]}`);
      if (!result && msg)   console.log(`${ind}    Fail at: "${msg}"`);
      //else if (msg)       console.log(`${ind}    "${msg}"`);
      if (cases.isEmpty()) return;
      
      // Show all child results
      console.log(`${ind}    Passed ${summary.passed} / ${summary.total} cases:`);
      for (let [ name0, run ] of Object.entries(cases)) outputTest(`${name}.${name0}`, run, ind + '    ');
    };
    
    console.log('Running tests...');
    let result = await entryKeep.run();
    outputTest(entryKeep.name, result); // Print all results with nice formatting
    console.log(`Overall: Passed ${this.passed} / ${this.total} (${Math.round((this.passed / this.total) * 100)}%)`);
    
    // For convenience show the first error last
    if (firstErr) console.log('First error encountered:\n', this.formatError(firstErr));
    
  }
})});

module.exports = { Keep };
