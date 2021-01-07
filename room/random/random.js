global.rooms['random'] = foundation => {
  
  let Random = U.form({ name: 'Random', props: (forms, Form) => ({
    init: C.noFn('init', seed => {}),
    genFloat: C.noFn('genFloat', (min=0, max=1) => {}),
    genInteger: function(min, max) { return min + Math.floor(this.genFloat(0, max - min)); },
    genZ: function(...args) { return this.genInteger(...args); },
    genQ: function(...args) { return this.genFloat(...args); },
    getElem: function(arr) { return arr[this.genInteger(0, arr.length)]; },
    genShuffled: function(arr) {
      
      let result = [ ...arr ];
      
      let n = result.count();
      for (let i = 0; i < n; i++) {
        let r = this.genInteger(i, n);
        if (r === i) continue;
        let t = result[i]
        result[i] = result[r];
        result[r] = t;
      }
      
      return result;
      
    }
  })});
  
  let NativeRandom = U.form({ name: 'NativeRandom', has: { Random }, props: (forms, Form) => ({
    
    // Powered by native `Math.random()` method
    
    init: function(seed=null) {
      if (seed !== null) throw Error(`${U.getFormName(this)} does not support a seed`);
    },
    genFloat: function(min=0, max=1) { return min + Math.random() * (max - min); }
    
  })});
  
  let FastRandom = U.form({ name: 'FastRandom', has: { Random }, props: (forms, Form) => ({
    
    // Powered by quick xor pseudorandomness
    
    $num: 1 << 30,
    $den: 1 / (1 << 30),
    $initialChurns: 7,
    
    init: function(seed=foundation.getMs()) {
      if (!U.isForm(seed, Number)) throw Error(`${U.getFormName(this)} requires numeric seed`);
      if (Math.floor(seed) !== seed) throw Error(`${U.getFormName(this)} requires integer seed`);
      if (seed < 0) throw Error(`${U.getFormName(this)} requires seed >= 0`);
      
      this.seed0 = (Form.den * (seed * 0.1 + 27.001)) % 1;
      this.seed1 = (Form.den * (seed * 0.5 +  0.233)) % 1;
      
      // Churning introduces randomness to stable initial configurations
      for (let i = 0; i < Form.initialChurns; i++) this.genFloat();
      
    },
    genInteger: function(min, max) {
      return min + Math.floor(this.genFloat(0, max - min));
    },
    genFloat: function(min=0, max=1) {
      
      let v = ((this.seed0 * Form.num) ^ (this.seed1 * Form.num)) * Form.den;
      this.seed0 = ((v + 100.133) * this.seed0) % 1;
      this.seed1 = ((v + 100.144) * this.seed1) % 1;
      return min + v * (max - min);
      
    }
    
  })});
  
  let SecureRandom = U.form({ name: 'SecureRandom', has: { Random }, props: (forms, Form) => ({
    
    // TODO: Something like linear congruential formula?
    
    init: C.notImplemented
    
  })});
  
  return { Random, NativeRandom, FastRandom };
  
};
