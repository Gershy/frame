let Case = U.inspire({ name: 'Case', methods: (insp, Insp) => ({
  init: function(par, name, func) {
    this.par = par;
    this.name = name;
    this.func = func;
    this.children = new Set();
    
    if (this.par) this.par.children.add(this);
  },
  contain: function(f) {
    f(this);
    return this;
  },
  run: function(...vals) {
    let { result, val=null } = this.func ? this.func(...vals) : { result: null, val: null };
    
    if (this.children.size) {
      
      let childVals = [ val ].concat(vals);
      let total = this.children.size;
      let passed = 0;
      let cases = {};
      
      this.children.forEach(child => {
        let { result, childResults } = child.run(childVals);
        cases[child.name] = { result, childResults };
        if (result !== false) passed++;
      });
      
      return {
        result: result !== false && passed === total,
        childResults: {
          summary: { passed, total },
          cases
        }
      };
      
    } else {
      
      return {
        result: result !== false,
        childResults: null
      };
      
    }
    
  }
})});

let showResult = (name, run, ind='') => {
  let { result, childResults } = run;
  let { summary, cases } = childResults || { summary: null, cases: {} };
  
  console.log(`${ind}[${result ? '.' : 'X'}] ${name}`);
  
  if (cases.isEmpty()) return;
  
  console.log(`${ind}    Passed ${summary.passed} / ${summary.total} cases:`);
  for (let [ name0, run ] of Object.entries(cases)) showResult(`${name}.${name0}`, run, ind + '    ');
};

module.exports = args => {
  
  let rootCase = Case(null, 'root').contain(c => {
    
    Case(c, 'WobOne').contain(c => {
      
      let setup = (n=1000) => {
        let wob = U.WobOne();
        wob.cnt = 0;
        wob.hld = [];
        for (let i = 0; i < n; i++) wob.hld.push(wob.hold(() => { wob.cnt++; }));
        return wob;
      };
      
      Case(c, 'holdCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        return { result: U.TOTAL_WOB_HOLDS() === 1000 };
        
      });
      
      Case(c, 'wobbleCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        wob.wobble();
        
        return { result: wob.cnt === 1000 };
        
      });
      
      Case(c, 'dropCount', () => {
        
        U.DBG_WOBS = new Set();
        let wob = setup();
        wob.wobble();
        return { result: U.TOTAL_WOB_HOLDS() === 0 };
        
      });
      
    });
    
    Case(c, 'AccessPath').contain(c => {
      
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
      
      let reset = () => {
        U.DBG_WOBS = new Set();
        cntHogs = 0;
        allHogs = new Set();
        cntFins = 0;
        cntFinNames = new Map();
      };
      
      Case(c, 'openSepHog', () => {
        
        reset();
        let hog = interimHog();
        let hogWob = U.Wob();
        
        let ap = U.AccessPath(hogWob, (dep, hog) => {
        });
        
        hogWob.wobble(hog);
        
        ap.shut();
        
        return { result: !hog.isShut() };
        
      });
      
      Case(c, 'shutDepHog', () => {
        
        reset();
        let hog = interimHog();
        let hogWob = U.Wob();
        
        let ap = U.AccessPath(hogWob, (dep, hog) => {
          dep(hog);
        });
        
        hogWob.wobble(hog);
        
        ap.shut();
        
        return { result: hog.isShut() };
        
      });
      
      Case(c, 'doubleDepCauseErr', () => {
        
        reset();
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
      
      Case(c, 'gen1', () => {
        
        reset();
        
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
      
      Case(c, 'gen2', () => {
        
        reset();
        
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
      
      Case(c, 'genAndCleanup1', () => {
        
        reset();
        
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
        
        console.log(`GC1: HOGS ${cntHogs}, HOLDS ${U.TOTAL_WOB_HOLDS()}`);
        
        return {
          result: true
            && cntHogs === 0
            && U.TOTAL_WOB_HOLDS() === 0
        };
        
      });
      
      Case(c, 'genAndCleanup2', () => {
        
        reset();
        
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
      
      Case(c, 'genAndCleanup3', () => {
        
        reset();
        
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
      
      Case(c, 'genAndPartialCleanup1', () => {
        
        reset();
        
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
    
  });
  
  showResult(rootCase.name, rootCase.run());
  
};
