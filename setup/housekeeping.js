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
  run: function(...vals) {
    
    let [ result, val, err ] = [ null, null, null ];
    
    try {
      let v = this.func ? this.func(...vals) : { result: null, val: null };
      result = v.result;
      val = v.has('val') ? v.val : null;
    } catch(err0) {
      result = false;
      val = null;
      err = err0;
      
      let errId = this.root.errId++;
      err.message = `TESTERROR(${errId}): ${err.message}`;
      err.id = errId;
      console.log(U.foundation.formatError(err));
    }
    
    this.root.total++;
    
    if (this.children.size) {
      
      let childVals = [ val ].concat(vals);
      let cTotal = this.children.size;
      let cPassed = 0;
      let cases = {};
      
      this.children.forEach(child => {
        if (this.sandwich.before) this.sandwich.before();
        let { result, err, childResults } = child.run(childVals);
        if (this.sandwich.after) this.sandwich.after();
        if (result !== false) cPassed++;
        cases[child.name] = { result, err, childResults };
      });
      
      if (cPassed < cTotal) result = false;
      if (result !== false) this.root.passed++;
      
      return {
        result: result !== false,
        err,
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
        childResults: null
      };
      
    }
    
  }
})});

U.gain({
  Keep,
  addSetupKeep: rootKeep => rootKeep.contain(k => {
    Keep(k, 'U').contain(k => {
      
      Keep(k, 'overwriteWobProp1', () => {
        
        let wob = U.Wob();
        
        return { result: wob.toHolds === U.Wob.prototype.toHolds };
        
      });
      
      Keep(k, 'overwriteWobProp2', () => {
        
        let wob = U.Wob();
        let repl = () => 'hi';
        wob.toHolds = repl;
        return { result: wob.toHolds === repl };
        
      });
      
      Keep(k, 'overwriteWobProp3', () => {
        
        let wob = U.Wob();
        
        let numOrigCalls = 0;
        let numReplCalls = 0;
        
        wob.hold(v => { numOrigCalls++; });
        wob.wobble();
        
        wob.toHolds = () => { numReplCalls++; };
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
        let numReplCalls = 0;
        
        wob.hold(v => { numOrigCalls++; });
        wob.wobble();
        
        wob.toHolds = () => { numReplCalls++; };
        wob.wobble();
        wob.wobble();
        
        delete wob.toHolds;
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
      
      Keep(k, 'doubleDepCauseErr', () => {
        
        let reachedPoint = false;
        let hog = interimHog();
        let hogWob = U.Wob();
        
        try {
          let ap = U.AccessPath(hogWob, (dep, hog) => {
            dep(hog);
            reachedPoint = true; // Shouldn't fail before this point
            dep(hog);
          });
          hogWob.wobble(hog);
        } catch(err) {
          return { result: reachedPoint };
        }
        
        return { result: false };
        
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
