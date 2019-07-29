let Keep = U.inspire({ name: 'Keep', methods: (insp, Insp) => ({
  init: function(par, name, func) {
    this.par = par;
    this.root = par ? par.root : this;
    this.name = name;
    this.func = func;
    this.children = new Map();
    this.sandwich = { before: null, after: null };
    
    if (!par) {
      this.total = 0;
      this.passed = 0;
      this.errId = 0;
    }
    
    if (this.par) {
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
      console.log(U.foundation.formatError(err));
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
    
  }
})});
let Clean = U.inspire({ name: 'Clean', methods: (insp, Insp) => ({
  init: function(validate) {
    this.validate = validate;
  },
  problemFor: function(chain, v) {
    if (this.validate) {
      let prob = this.validate(v);
      if (prob) return [ chain, prob ];
    }
    return null;
  }
})});
let CleanArr = U.inspire({ name: 'CleanArr', insps: { Clean }, methods: (insp, Insp) => ({
  init: function(innerClean, min=null, max=null) {
    insp.Clean.init.call(this, null);
    this.innerClean = innerClean;
    this.min = min;
    this.max = max;
  },
  problemFor: function(chain, arr) {
    if (!U.isType(arr, Array)) return 'Value should be Array';
    if (this.min !== null && arr.length < this.min) return [ chain, `Array has ${arr.length} elems; min is ${this.min}` ];
    if (this.max !== null && arr.length > this.max) return [ chain, `Array has ${arr.length} elems; max is ${this.max}` ];
    
    let childChain = chain.concat([ this ]);
    for (let v of arr) {
      let prob = this.innerClean.problemFor(childChain, v);
      if (prob) return prob;
    }
  }
})});
let CleanObj = U.inspire({ name: 'CleanObj', insps: { Clean }, methods: (insp, Insp) => ({
  init: function(allowed, required={}, map={}) {
    this.allowed = allowed;
    this.required = required;
    this.map = map;
    this.defChildClean = map.has('*') ? map['*'] : null;
    delete this.map['*'];
  },
  problemFor: function(chain, obj) {
    if (!U.isType(obj, Object)) return 'Value should be Object';
    
    // Make sure no properties are missing
    let missing = this.required.find(req => !obj.has(req));
    if (missing) return [ chain, `Object missing mandatory key: ${missing[0]}` ];
    
    // Make sure no illegal properties are present
    let denied = this.allowed === '*'
      ? null
      : obj.find((v, k) => !this.allowed.has(k) && !this.required.has(k));
    if (denied) return [ chain, `Object has illegal key: "${denied[1]}"` ];
    
    let objClone = obj.map(v => v);
    
    let childChain = chain.concat([ this ]);
    for (let [ k, childClean ] of Object.entries(this.map)) {
      
      if (!objClone.has(k)) continue;
      
      let prob = childClean.problemFor(chain, objClone[k])
      if (prob) return prob;
      
      delete objClone[k]; // Only remaining props will go to default '*' handler
      
    }
    
    if (!this.defChildClean) return null;
    
    for (let [ k, v ] of Object.entries(objClone)) {
      
      let prob = this.defChildClean.problemFor(chain, v);
      if (prob) return prob;
      
    }
  }
})});

U.gain({
  Keep, Clean, CleanArr, CleanObj,
  addSetupKeep: rootKeep => rootKeep.contain(k => {
    Keep(k, 'Clean').contain(k => {
      
      let cleanString = Clean(v => U.isType(v, String) ? null : `Expected String (got ${U.typeOf(v)})`);
      let cleanArrStrings = CleanArr(cleanString);
      let cleanObjStrings1 = CleanObj('*', {}, {
        '*': cleanString
      });
      let cleanObjStrings2 = CleanObj([ 'fName', 'mName', 'lName' ], {}, {
        '*': cleanString
      });
      
      Keep(k, '1', () => {
        
        let prob = cleanString.problemFor([], 'hello');
        return { result: !prob };
        
      });
      
      Keep(k, '2', () => {
        
        let prob = cleanString.problemFor([], 123)
        return { result: prob && prob.length === 2 && U.isType(prob[1], String) };
        
      });
      
      Keep(k, '3', () => {
        
        let prob = cleanString.problemFor([], 123)
        return { result: prob && prob.length === 2 && U.isType(prob[1], String) };
        
      });
      
      Keep(k, '4', () => {
        
        let prob = cleanArrStrings.problemFor([], [
          'hi', 'hello', 'wassup', 'loler', 'lololer'
        ]);
        return { result: !prob };
        
      });
      
      Keep(k, '5', () => {
        
        let prob = cleanArrStrings.inspClone([], { max: 4 }).problemFor([], [
          'hi', 'hello', 'wassup', 'loler', 'lololer'
        ]);
        return { result: prob && U.isType(prob, Array) && prob.length === 2 && prob[1] === 'Array has 5 elems; max is 4' };
        
      });
      
      Keep(k, '6', () => {
        
        let prob = cleanArrStrings.inspClone([], { min: 10 }).problemFor([], [
          'hi', 'hello', 'wassup', 'loler', 'lololer'
        ]);
        return { result: prob && U.isType(prob, Array) && prob.length === 2 && prob[1] === 'Array has 5 elems; min is 10' };
        
      });
      
      Keep(k, '7', () => {
        
        let prob = cleanArrStrings.problemFor([], [
          'hi', 'hello', 'wassup', 'loler', 7
        ]);
        return { result: prob && U.isType(prob, Array) && prob.length === 2 && prob[1] === 'Expected String (got Number)' };
        
      });
      
      Keep(k, '8', () => {
        
        let prob = cleanObjStrings1.problemFor([], {
          fName: 'Gershom',
          mName: 'Yonah',
          lName: 'Maes'
        });
        return { result: !prob };
        
      });
      
      Keep(k, '9', () => {
        
        let prob = cleanObjStrings2.problemFor([], {
          fName: 'Gershom',
          mName: 'Yonah',
          lName: 'Maes'
        });
        return { result: !prob };
        
      });
      
      Keep(k, '10', () => {
        
        let prob = cleanObjStrings2.problemFor([], {
          fName: 'Gershom',
          mName: 'Yonah',
          lName: 'Maes',
          faveFood: 'anchovies'
        });
        
        return [
          [ 'prob is Array',            () => U.isType(prob, Array) ],
          [ 'prob has length 2',        () => prob.length === 2 ],
          [ '1st elem is empty Array',  () => U.isType(prob[0], Array) && prob[0].length === 0 ],
          [ '2nd elem has error',       () => prob[1] === 'Object has illegal key: "faveFood"' ]
        ];
        
      });
      
    });
    Keep(k, 'U').contain(k => {
      
      Keep(k, 'overwriteWobProp1', () => {
        
        let wob = U.Wob();
        
        return { result: wob.toHold === U.Wob.prototype.toHold };
        
      });
      
      Keep(k, 'overwriteWobProp2', () => {
        
        let wob = U.Wob();
        let repl = () => 'hi';
        wob.toHold = repl;
        return { result: wob.toHold === repl };
        
      });
      
      Keep(k, 'simpleWob1', () => {
        
        let wob = U.Wob();
        
        let count = 0;
        let hold = v => { count++; };
        wob.toHold(hold);
        wob.toHold(hold);
        
        return [
          [ 'toHold causes Hold to run', () => count === 2 ]
        ];
        
      });
      
      Keep(k, 'simpleWob2', () => {
        
        let wob = U.Wob();
        
        let count = 0;
        wob.hold(v => { count++; });
        wob.wobble();
        wob.wobble();
        
        return [
          [ 'Wobbles cause Holds to run', () => count === 2 ]
        ];
        
      });
      
      Keep(k, 'overwriteWobProp3', () => {
        
        let wob = U.Wob();
        
        let numOrigCalls = 0;
        wob.hold(v => { numOrigCalls++; });
        wob.wobble();
        
        let numReplCalls = 0;
        wob.toHold = () => { numReplCalls++; };
        wob.wobble();
        wob.wobble();
        
        return {
          result: true
            && numOrigCalls === 1
            && numReplCalls === 2
        }
        
      });
      
      Keep(k, 'overwriteWobProp4', () => {
        
        let wob = U.Wob();
        
        let numOrigCalls = 0;
        wob.hold(v => { numOrigCalls++; });
        wob.wobble();
        
        let numReplCalls = 0;
        wob.toHold = () => { numReplCalls++; };
        wob.wobble();
        wob.wobble();
        
        delete wob.toHold;
        wob.wobble();
        wob.wobble();
        
        return {
          result: true
            && numOrigCalls === 3
            && numReplCalls === 2
        }
        
      });
      
    });
    Keep(k, 'WobOne').contain(k => {
      
      let setup = (n=1000) => {
        let wob = U.WobOne();
        wob.cnt = 0;
        wob.hld = [];
        for (let i = 0; i < n; i++) wob.hld.push(wob.hold(() => { wob.cnt++; }));
        return wob;
      };
      
      Keep(k, 'holdCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        return { result: U.TOTAL_WOB_HOLDS() === 1000 };
        
      });
      
      Keep(k, 'wobbleCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        wob.wobble();
        
        return { result: wob.cnt === 1000 };
        
      });
      
      Keep(k, 'dropCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        wob.wobble();
        return { result: U.TOTAL_WOB_HOLDS() === 0 };
        
      });
      
    });
    Keep(k, 'AccessPath').contain(k => {
      
      let cntHogs = 0;
      let allHogs = new Set();
      let interimHog = () => {
        cntHogs++;
        let shutWob = U.WobOne();
        let hog = {
          name: 'hog!',
          moreHogWob1: U.Wob(),
          moreHogWob2: U.Wob(),
          isShut: () => !shutWob.holds,
          shut: () => {
            if (!shutWob.holds) throw new Error('Multiple shuts');
            cntHogs--;
            shutWob.wobble();
          },
          shutWob: () => shutWob
        };
        allHogs.add(hog);
        return hog;
      };
      
      let cntFins = 0;
      let cntFinNames = new Map();
      let fin = (name='anon') => {
        cntFins++;
        cntFinNames.set(name, (cntFinNames.get(name) || 0) + 1);
        
        // TODO: Should use Hog for this
        let shutWob0 = U.WobOne();
        return {
          name,
          shut: () => {
            if (!shutWob0.holds) throw new Error('Multiple shuts');
            cntFins--;
            cntFinNames.set(name, cntFinNames.get(name) - 1);
            shutWob0.wobble();
          },
          shutWob: () => shutWob0
        }
      };
      
      k.sandwich.after = () => {
        U.DBG_WOBS = new Set();
        cntHogs = 0;
        allHogs = new Set();
        cntFins = 0;
        cntFinNames = new Map();
      };
      
      Keep(k, 'openSepHog', () => {
        
        let hog = interimHog();
        let hogWob = U.Wob();
        
        let ap = U.AccessPath(hogWob, (dep, hog) => {
        });
        
        hogWob.wobble(hog);
        
        ap.shut();
        
        return { result: !hog.isShut() };
        
      });
      
      Keep(k, 'shutDepHog', () => {
        
        let hog = interimHog();
        let hogWob = U.Wob();
        
        let ap = U.AccessPath(hogWob, (dep, hog) => {
          dep(hog);
        });
        
        hogWob.wobble(hog);
        
        ap.shut();
        
        return { result: hog.isShut() };
        
      });
      
      Keep(k, 'gen1', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hog2) => {
            
            dep(U.AccessPath(hog2.moreHogWob1, (dep, hog3) => {
              
            }));
            
          }));
          
        });
        
        let numPars = 5;
        let cPerPar = 5;
        
        for (let i = 0; i < numPars; i++) {
          
          let hog1 = interimHog();
          hogWob.wobble(hog1);
          
          for (let i = 0; i < cPerPar; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
        }
        
        return { result: cntHogs === (numPars + (cPerPar * numPars)) };
        
      });
      
      Keep(k, 'gen2', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hogFromWob1) => {
            
            dep(fin('root.1'));
            
          }));
          
          dep(U.AccessPath(hog1.moreHogWob2, (dep, hogFromWob2) => {
            
            dep(fin('root.2'));
            
          }));
          
        });
        
        for (let i = 0; i < 5; i++) {
          
          let hog1 = interimHog();
          hogWob.wobble(hog1);
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob2.wobble(hog2);
            
          }
          
        }
        
        return {
          result: true
            && cntHogs === (5 + 5 * 3 + 5 * 3)
            && cntFinNames.get('root.1') === 15
            && cntFinNames.get('root.2') === 15
        };
        
      });
      
      Keep(k, 'genAndCleanup1', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(hog1)
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hog2) => {
            
            dep(hog2)
            
            dep(U.AccessPath(hog2.moreHogWob1, (dep, hog3) => {
              
              dep(hog3);
              
            }));
            
          }));
          
        });
        
        for (let i = 0; i < 5; i++) {
          
          let hog1 = interimHog();
          hogWob.wobble(hog1);
          
          for (let i = 0; i < 5; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
        }
        
        p1.shut();
        
        return {
          result: true
            && cntHogs === 0
            && U.TOTAL_WOB_HOLDS() === 0
        };
        
      });
      
      Keep(k, 'genAndCleanup2', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(hog1);
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hogFromWob1) => {
            dep(hogFromWob1);
            dep(fin('root.1'));
          }));
          
          dep(U.AccessPath(hog1.moreHogWob2, (dep, hogFromWob2) => {
            dep(hogFromWob2);
            dep(fin('root.2'));
          }));
          
        });
        
        for (let i = 0; i < 5; i++) {
          
          let hog1 = interimHog();
          hogWob.wobble(hog1);
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob2.wobble(hog2);
            
          }
          
        }
        
        p1.shut();
        
        return {
          result: true
            && cntHogs === 0
            && cntFins === 0
            && U.TOTAL_WOB_HOLDS() === 0
        };
        
      });
      
      Keep(k, 'genAndCleanup3', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(hog1);
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hogFromWob1) => {
            
            dep(hogFromWob1);
            dep(fin('root.1'));
            
          }));
          
          dep(U.AccessPath(hog1.moreHogWob2, (dep, hogFromWob2) => {
            
            dep(hogFromWob2);
            dep(fin('root.2'));
            
          }));
          
        });
        
        let rootHogs = [];
        
        for (let i = 0; i < 5; i++) {
          
          let hog1 = interimHog();
          rootHogs.push(hog1);
          hogWob.wobble(hog1);
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
          for (let i = 0; i < 3; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob2.wobble(hog2);
            
          }
          
        }
        
        let numHolds0 = U.TOTAL_WOB_HOLDS();
        
        rootHogs.forEach(hog => hog.shut());
        
        return {
          result: true
            && cntHogs === 0
            && cntFins === 0
            && numHolds0 * 0.2 > U.TOTAL_WOB_HOLDS() // Should have decreased by at least this amount
        };
        
      });
      
      Keep(k, 'genAndPartialCleanup1', () => {
        
        let hogWob = U.Wob();
        
        let p1 = U.AccessPath(hogWob, (dep, hog1) => {
          
          dep(U.AccessPath(hog1.moreHogWob1, (dep, hogFromWob1) => {
            
            dep(fin('root.1'));
            
          }));
          
          dep(U.AccessPath(hog1.moreHogWob2, (dep, hogFromWob2) => {
            
            dep(fin('root.2'));
            
          }));
          
        });
        
        let numPars = 5;
        let numChldAt1 = 3;
        let numChldAt2 = 3;
        for (let i = 0; i < numPars; i++) {
          
          let hog1 = interimHog();
          hogWob.wobble(hog1);
          
          for (let i = 0; i < numChldAt1; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob1.wobble(hog2);
            
          }
          
          for (let i = 0; i < numChldAt2; i++) {
            
            let hog2 = interimHog();
            hog1.moreHogWob2.wobble(hog2);
            
          }
          
        }
        
        let cntHogs1 = cntHogs;
        let cntHolds1 = U.TOTAL_WOB_HOLDS();
        
        let cnt = 0;
        allHogs.forEach(hog => ((cnt++ % 5) === 0) && hog.shut());
        
        // Just trying to see that removing about 1/5th of hogs reduces total hogs
        // and holds by a fair amount
        return {
          result: true
            && cntHogs1 * 0.9 > cntHogs
            && cntHolds1 * 0.9 > U.TOTAL_WOB_HOLDS()
        };
        
      });
      
    });
  })
});
