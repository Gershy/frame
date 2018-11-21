let http = require('http');
let net = require('net');
let crypto = require('crypto');
let fs = require('fs-extra');
let path = require('path');

// ==== UTIL
require('./common.js');

let isShallowArr = arr => {
  for (let i = 0; i < arr.length; i++) {
    if (U.isType(arr[i], Array) || U.isType(arr[i], Object)) return false;
  }
  return true;
};
let vn = (v, rad=3) => U.isType(v, Number) ? v.toFixed(rad) : U.typeOf(v);
let pArr = (arr, rad=3, spcs=0) => {
  
  let val = [];
  let spcStr = ' '.repeat(spcs);
  
  if (!U.isType(arr, Array)) {
    val.push(`${spcStr}${vn(arr, rad)}`);
  } else if (arr.length === 0) {
    val.push(`${spcStr}[]`);
  } else if (isShallowArr(arr)) {
    val.push(`${spcStr}[ ${arr.map(v => vn(v, rad)).join(', ')} ]`);
  } else {
    val.push(`${spcStr}[`);
    for (let i = 0; i < arr.length; i++) val.push(pArr(arr[i], rad, spcs + 2) + (i === arr.length - 1 ? '' : ','));
    val.push(`${spcStr}]`); 
  }
  
  return val.join('\n');
};

U.gain({
  validNum: n => !isNaN(n) && n !== Infinity && n !== -Infinity,
  ROT_U: 0,
  ROT_R: Math.PI / 2,
  ROT_D: Math.PI,
  ROT_L: Math.PI * (4 / 3),
  ROT_CW0: 0,
  ROT_CW1: Math.PI / 2,
  ROT_CW2: Math.PI,
  ROT_CCW0: 0,
  ROT_CCW1: Math.PI / -2,
  ROT_CCW2: Math.PI,
  ROT_FULL: Math.PI * 2,
  ROT_HALF: Math.PI,
  rand: () => Math.random(),
  randInt: (min=0, max) => min + (Math.floor(Math.random() * (max - min))),
  randCen: () => Math.random() - 0.5,
  randPrt: amt => amt + Math.random() * (1 - amt),
  randBln: () => Math.random() > 0.5,
  randRot: () => U.randCen * U.ROT_FULL,
  randElem: arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null
});
let config = {
  hostname: 'localhost', // '192.168.1.144', // 'localhost',
  httpPort: 80,
  soktPort: 81
};
let RoundFixedSet = U.inspire({ name: 'RoundFixedSet', methods: (insp, Insp) => ({
  init: function(size) {
    this.size = size;
    let start = { val: null, next: null };
    let ptr = start;
    for (let i = 1; i < size; i++) {
      ptr.next = { val: null, next: null };
      ptr = ptr.next;
    }
    ptr.next = start;
    this.ptr = ptr;
  },
  add: function(val) {
    this.ptr = this.ptr.next;
    this.ptr.val = val;
  },
  upd: function(f) {
    this.ptr.val = f(this.ptr.val);
    let ptr = this.ptr.next;
    while (ptr !== this.ptr) {
      ptr.val = f(ptr.val);
      ptr = ptr.next;
    }
  }
})});
let Brain = U.inspire({ name: 'Brain', methods: (insp, Insp) => ({
  $sigmoid0: v => 1 / (1 + Math.exp(-v)),
  $sigmoid1: (v, v0=Brain.sigmoid0(v)) => v0 * (1 - v0),
  $meanSqr0: (src, trg) => { let d = src - trg; return d * d; },
  $meanSqr1: (src, trg) => src - trg,
  init: function(layers, initB=Math.random, initW=Math.random) {
    
    /*
    
    With `layers=[4, 5, 3]`:
    
    this.layers = [
      { biases: [ 0, 0, 0, 0 ],
        weights: []  // The `weights` array for the 1st layer is always empty!
      },
      { biases: [ 0, 0, 0, 0, 0 ],
        weights: [
          0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 1st node of layer 2
          0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 2nd node of layer 2
          0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 3rd node of layer 2
          0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 4th node of layer 2
          0, 0, 0, 0  // For nodes in the 1st layer 1-4, values connecting them to the 5th node of layer 2
        ]
      },
      { biases: [ 0, 0, 0 ],
        weights: [
          0, 0, 0, 0, 0,
          0, 0, 0, 0, 0,
          0, 0, 0, 0, 0
        ]
      }
    ];
    */
    
    this.layers = new Array(layers.length);
    for (let li = 0, ln = layers.length; li < ln; li++) {
      
      let numNow = layers[li];
      let numPrv = li ? layers[li - 1] : 0;
      
      let layer = { length: numNow, biases: [], weights: [] };
      this.layers[li] = layer;
      
      // if (!li) continue;
      
      for (let n = 0; n < numNow; n++) {
        // Looking at node ${n} in layer ${li}...
        
        // Define a bias for this node...
        layer.biases.push(initB());
        
        // Define a weight for each node in the next layer
        for (let m = 0; m < numPrv; m++) layer.weights.push(initW());
      }
      
    }
    this.size = this.layers.length;
    
  },
  opinion: function(inp, smoothing0=Brain.sigmoid0) {
    
    // Returns two lists:
    // 1) The list of activation values for each layer
    // 2) The list of activation values before `smoothing0` is applied for each layer
    
    if (inp.length !== this.layers[0].biases.length) throw new Error(`Incorrect number of inputs!`);
    
    let result = null;
    let resultsZ = new Array(this.size);
    let resultsX = new Array(this.size);
    for (let lInd = 0; lInd < this.size; lInd++) {
      
      let [ layerP, layer0 ] = [ this.layers[lInd - 1], this.layers[lInd] ];
      
      if (!result) {
        
        result = inp;
        
      } else {
        
        let [ sP, s0 ] = [ layerP.length, layer0.length ];
        let fwdWeights = layer0.weights;
        let fwdBiases = layer0.biases;
        let resultP = result;
        
        result = new Array(s0);
        for (let ind0 = 0; ind0 < s0; ind0++) {
          let sum = 0;
          for (let indP = 0; indP < sP; indP++) sum += fwdWeights[indP + ind0 * sP] * resultP[indP];
          result[ind0] = sum + fwdBiases[ind0];
        }
        
      }
      
      // Collect unsmoothed, then smooth, then collect smoothed
      resultsZ[lInd] = result;
      if (lInd) result = result.map(smoothing0); // TODO: The `if` prolly isn't necessary
      resultsX[lInd] = result;
      
    }
    
    return [ resultsZ, resultsX, result ];
    
  },
  calcGradient: function([ zs, xs ], correct, cost0=Brain.meanSqr0, cost1=Brain.meanSqr1, smoothing0=Brain.sigmoid0, smoothing1=Brain.sigmoid1) {
    
    // `errZ` is a list of pre-smoothing activations
    // `errX` is a list of activations
    let s = this.size;
    
    let biasGrads = new Array(this.size);
    let weightGrads = new Array(this.size);
    let backPass = null;
    for (let lInd = this.size - 1; lInd >= 1; lInd--) {
      
      // Get references to the layer size, unsmoothed layer error, and layer error
      // Do this for the previous layer (P), current layer (0), and next layer (N)
      let [ sP, s0, sN ] = this.layers.slice(lInd - 1, lInd + 2).map(l => l.length);
      let [ zP, z0, zN ] = zs.slice(lInd - 1, lInd + 2);
      let [ xP, x0, xN ] = xs.slice(lInd - 1, lInd + 2);
      
      // Now calculate the error gradient for this layer (`backPass`)...
      
      if (!backPass) {
        
        // Calculate the error gradient of the final activation
        backPass = x0.map((v, i) => cost1(v, correct[i]) * smoothing1(z0[i], v));
        
      } else {
        
        // Move the error gradient `backPass` back to the previous layer
        let fwdActivation = backPass;                   // sN x 1
        let fwdWeights = this.layers[lInd + 1].weights; // s0 x sN
        // let fwdBiases = this.layers[lInd + 1].biases;   // s0 x 1
        
        // For each node in the current layer calculate the weighted error based on the next layer's error
        backPass = new Array(s0);
        for (let ind0 = 0; ind0 < s0; ind0++) {
          let sum = 0;
          for (let indN = 0; indN < sN; indN++) sum += fwdWeights[ind0 + indN * s0] * fwdActivation[indN];
          backPass[ind0] = sum * smoothing1(z0[ind0], x0[ind0]); // Unapply the smoothing function
        }
        
      }
      
      // `backPass` has stepped back from `lInd + 1` and is the error gradient at layer `lInd`
      
      // `backPass` is already exactly the bias gradient!
      biasGrads[lInd] = backPass;
      
      // The weight gradient ought to be sP x s0
      // `backPass` -> s0 x 1
      // `xP`       -> sP x 1
      let weightGrad = new Array(sP * s0);
      for (let indP = 0; indP < sP; indP++) { for (let ind0 = 0; ind0 < s0; ind0++) {
        weightGrad[indP + ind0 * sP] = xP[indP] * backPass[ind0];
      }}
      weightGrads[lInd] = weightGrad;
      
    }
    
    return [ biasGrads, weightGrads ];
    
  },
  study: function(trainingData, batchSize, amt=3) {
    
    amt /= batchSize;
    
    for (let i = 0; i < trainingData.length; i += batchSize) {
      
      // `biasGrads` and `weightGrads` will represent the average gradient for
      // `batchSize` training examples
      
      let [ biasGrads, weightGrads ] = [ null, null ];
      let num = Math.min(trainingData.length - i, batchSize);
      for (let j = i; j < i + num; j++) {
        
        let [ src, trg ] = trainingData[j];
        
        [ bGrads, wGrads ] = this.calcGradient(this.opinion(src), trg);
        
        if (!biasGrads) {
          
          [ biasGrads, weightGrads ] = [ bGrads, wGrads ];
          
        } else {
          
          for (let lInd = 1; lInd < this.layers.length; lInd++) {
            // Get biases+weights, and fresh biases+weights, for the current layer index
            let [ lb, lw, lbd, lwd ] = [ biasGrads[lInd], weightGrads[lInd], bGrads[lInd], wGrads[lInd] ];
            for (let bInd = 0; bInd < lb.length; bInd++) lb[bInd] += lbd[bInd];
            for (let wInd = 0; wInd < lw.length; wInd++) lw[wInd] += lwd[wInd];
          }
          
          
          // biasGrads = biasGrads.map((bg, lInd) => bg.map((bv, bInd) => bv + bGrads0[lInd][bInd]));
          // weightGrads = weightGrads.map((wg, lInd) => wg.map((wv, wInd) => wv + wGrads0[lInd][wInd]));
        }
        
      }
      
      // We've averaged out bias+weight gradients; now apply them
      this.refine([ biasGrads, weightGrads ], amt);
      
    }
    
  },
  refine: function([ biasGrads, weightGrads ], amt) {
    
    for (let lInd = 1; lInd < this.size; lInd++) {
      
      let { biases, weights } = this.layers[lInd];
      let [ bGrad, wGrad ] = [ biasGrads[lInd], weightGrads[lInd] ];
      
      for (let bInd = 0; bInd < biases.length; bInd++) biases[bInd] -= amt * bGrad[bInd];
      for (let wInd = 0; wInd < weights.length; wInd++) weights[wInd] -= amt * wGrad[wInd];
      
    }
    
  }
})});

let doBrainTest = false;
if (doBrainTest) {
  console.log('BRAIN TEST...');
  console.log('================================================');

  let brain = new Brain([ 2, 5, 1 ]);

  let egs = [];
  for (let i = 0; i < 1000; i++) {
    let v1 = Math.random() > 0.5 ? 0 : 1;
    let v2 = Math.random() > 0.5 ? 0 : 1;
    egs.push([ [ v1, v2 ], [ v1 && v2 ? 1 : 0 ] ]);
  }

  brain.study(egs, 1, 1);

  for (let i = 0; i < 10; i++) {
    let v1 = Math.random() > 0.5 ? 0 : 1;
    let v2 = Math.random() > 0.5 ? 0 : 1;
    let [ zs, xs, result ] = brain.opinion([ v1, v2 ]);
    console.log(`${v1.toFixed(3)} && ${v2.toFixed(3)}: ${result}`);
  }
  
  return process.exit(0);
}


// ==== 2D MATH
let XY = U.inspire({ name: 'XY', methods: (insp, Insp) => ({
  init: function() {},
  xx:       function()    { throw new Error('not implemented'); },
  yy:       function()    { throw new Error('not implemented'); },
  nonZero:  function()    { throw new Error('not implemented'); },
  asCarte:  function()    { throw new Error('not implemented'); },
  asPolar:  function()    { throw new Error('not implemented'); },
  toCarte:  function()    { throw new Error('not implemented'); },
  toPolar:  function()    { throw new Error('not implemented'); },
  toCarte:  function()    { throw new Error('not implemented'); },
  toPolar:  function()    { throw new Error('not implemented'); },
  add:      function(pt)  { throw new Error('not implemented'); },
  sub:      function(pt)  { throw new Error('not implemented'); },
  scale:    function(mag) { throw new Error('not implemented'); },
  distSqr:  function(pt)  { throw new Error('not implemented'); },
  dist:     function(pt)  { throw new Error('not implemented'); },
  magSqr:   function()    { throw new Error('not implemented'); },
  mag:      function()    { throw new Error('not implemented'); },
  norm:     function()    { throw new Error('not implemented'); },
  eq:       function(pt)  { throw new Error('not implemented'); },
  perpCW:   function()    { throw new Error('not implemented'); },
  perpCCW:  function()    { throw new Error('not implemented'); },
  dotProd:  function(pt)  { throw new Error('not implemented'); },
  proj:     function(pt)  { throw new Error('not implemented'); },
  projLen:  function(pt)  { throw new Error('not implemented'); },
  ang:      function()    { throw new Error('not implemented'); },
  angTo:    function(pt)  { throw new Error('not implemented'); },
  rot:      function(ang) { throw new Error('not implemented'); },
})});
let CarteXY = U.inspire({ name: 'CarteXY', methods: (insp, Insp) => ({
  init:     function(x=0, y=0) { this.x = x; this.y = y; if (!U.validNum(x) || !U.validNum(y)) throw new Error(`NAN! ${JSON.stringify(x)}, ${y}`); },
  xx:       function()    { return this.x; },
  yy:       function()    { return this.y; },
  nonZero:  function()    { return this.x || this.y; },
  asCarte:  function()    { return [ this.x, this.y ]; },
  toCarte:  function()    { return this; },
  asPolar:  function()    { return [ this.ang(), this.mag() ]; },
  toPolar:  function()    { return new PolarXY(this.ang(), this.mag()); },
  add:      function(pt)  { let [ x, y ] = pt.asCarte(); return new CarteXY(this.x + x, this.y + y); },
  sub:      function(pt)  { let [ x, y ] = pt.asCarte(); return new CarteXY(this.x - x, this.y - y); },
  scale:    function(amt) { return new CarteXY(this.x * amt, this.y * amt); },
  distSqr:  function(pt)  { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ this.x - x, this.y - y ]; return dx * dx + dy * dy; },
  dist:     function(pt)  { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ this.x - x, this.y - y ]; return Math.sqrt(dx * dx + dy * dy); },
  magSqr:   function()    { return this.x * this.x + this.y * this.y; },
  mag:      function()    { return Math.sqrt(this.x * this.x + this.y * this.y); },
  norm:     function()    { let m = Math.sqrt(this.x * this.x + this.y * this.y); if (!m) return null; m = 1 / m; return new CarteXY(this.x * m, this.y * m); },
  eq:       function(pt)  { let [ x, y ] = pt.asCarte(); return this.x === x && this.y === y; },
  perpCW:   function()    { return new CarteXY(this.y, -this.x); },
  perpCCW:  function()    { return new CarteXY(-this.y, this.x); },
  dotProd:  function(pt)  { let [ x, y ] = pt.asCarte(); return this.x * x + this.y * y; },
  proj:     function(pt)  { let [ x, y ] = pt.asCarte(); return pt.scale((this.x * x + this.y * y) / pt.mag()); },
  projLen:  function(pt)  { let [ x, y ] = pt.asCarte(); let mag = pt.mag(); if (!mag) return 0; return (this.x * x + this.y * y) / mag; },
  ang:      function()    { return (this.x || this.y) ? Math.atan2(this.x, this.y) : 0; },
  angTo:    function(pt)  { let [ x, y ] = pt.asCarte(); let [ dx, dy ] = [ x - this.x, y - this.y ]; return (dx || dy) ? Math.atan2(dx, dy) : 0; },
  rot:      function(ang) { return new PolarXY(this.ang() + ang, this.mag()); },
})});
let PolarXY = U.inspire({ name: 'PolarXY', methods: (insp, Insp) => ({
  init:     function(r=0, m=1) { this.r = r; this.m = m; if (!U.validNum(r) || !U.validNum(m)) throw new Error('NAN!'); },
  xx:       function()    { return Math.sin(this.r) * this.m; },
  yy:       function()    { return Math.cos(this.r) * this.m; },
  nonZero:  function()    { return this.m; },
  asCarte:  function()    { return [ Math.sin(this.r) * this.m, Math.cos(this.r) * this.m ]; },
  toCarte:  function()    { return new CarteXY(Math.sin(this.r) * this.m, Math.cos(this.r) * this.m); },
  asPolar:  function()    { return [ this.r, this.m ]; },
  toPolar:  function()    { return this; },
  add:      function(pt)  { return pt.add(this.toCarte()); }, // No smooth way to add polar coords
  sub:      function(pt)  { return pt.sub(this.toCarte()); }, // No smooth way to add polar coords
  scale:    function(amt) { return new PolarXY(this.r, this.m * amt); },
  distSqr:  function(pt)  { let [ r, m ] = pt.asPolar(); m = (this.m * this.m) + (m * m) - (2 * this.m * m * Math.cos(r - this.r)); return m; },
  dist:     function(pt)  { let [ r, m ] = pt.asPolar(); m = (this.m * this.m) + (m * m) - (2 * this.m * m * Math.cos(r - this.r)); return Math.sqrt(m); },
  magSqr:   function()    { return this.m * this.m; },
  mag:      function()    { return this.m; },
  norm:     function()    { return new PolarXY(this.r, 1); },
  eq:       function(pt)  { return pt.eq(this.toCarte()); },
  perpCW:   function()    { return new PolarXY(this.r + U.ROT_CW1, this.m); },
  perpCCW:  function()    { return new PolarXY(this.r + U.ROT_CCW1, this.m); },
  dotProd:  function(pt)  { return pt.dotProd(this.toCarte()); },
  proj:     function(pt)  { return this.toCarte().proj(pt); },
  projLen:  function(pt)  { return this.toCarte().projLen(pt); },
  ang:      function()    { return this.r; },
  angTo:    function(pt)  { let d = pt.ang() - this.ang(); while(d > U.ROT_HALF) d -= U.ROT_FULL; while(d < -U.ROT_HALF) d += U.ROT_FULL; return d; },
  rot:      function(ang) { return new PolarXY(this.r + r, this.m); },
})});
XY.sum = (xys) => {
  let [ x, y ] = [ 0, 0 ];
  for (let i = 0, len = xys.length; i < len; i++) {
    let [ xd, yd ] = xys[i].asCarte();
    x += xd;
    y += yd;
  }
  return new CarteXY(x, y);
};
XY.orbit = (pt, pivot, ang) => {
  let ang0 = pivot.angTo(pt);
  return pivot.add(new PolarXY(ang0 + ang, pivot.dist(pt)));
};
XY.ORIGIN = new CarteXY(0, 0);

// ==== GEN
let makePistol = () => {
  let pistol = new Gun('pistol', (rot, unit) => {
    let shootSpd = 900;
    let lifespanSecs = 4;
    let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
    bullet.invWeight = 10 / 1;
    bullet.strikeDamage = 20;
    return bullet;
  });
  pistol.recoilAng = (Math.PI * 2) / 65;
  pistol.shootDelaySecs = 0.3;
  pistol.shotsInClip = 12;
  pistol.reloadDelaySecs = 1;
  return pistol;
};
let makeM16 = () => {
  let m16 = new Gun('m16', (rot, unit) => {
    let shootSpd = 1400;
    let lifespanSecs = 3;
    let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
    bullet.invWeight = 10 / 1;
    bullet.strikeDamage = 30;
    return bullet;
  });
  m16.recoilAng = (Math.PI * 2) / 80;
  m16.shootDelaySecs = 0.14;
  m16.shotsInClip = 30;
  m16.reloadDelaySecs = 2;
  return m16;
};
let makeMag = () => {
  let mag = new Gun('mag', (rot, unit) => {
    let shootSpd = 1500;
    let lifespanSecs = 3;
    let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
    bullet.invWeight = 10 / 2;
    bullet.strikeDamage = 40;
    return bullet;
  });
  mag.recoilAng = (Math.PI * 2) / 65;
  mag.shootDelaySecs = 0.09;
  mag.shotsInClip = 100;
  mag.reloadDelaySecs = 4;
  return mag;
};
let makeGatling = () => {
  let gatling = new Gun('gatling', (rot, unit) => {
    let shootSpd = 2100;
    let lifespanSecs = 2;
    let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
    bullet.invWeight = 10 / 3;
    bullet.strikeDamage = 10;
    return bullet;
  });
  gatling.recoilAng = (Math.PI * 2) / 52;
  gatling.shootDelaySecs = 0.01;
  gatling.shotsInClip = 2000;
  gatling.reloadDelaySecs = 10;
  return gatling;
};
let makeFlamer = () => {
  let flamer = new Gun('flamer', (rot, unit) => {
    let shootSpd = 250;
    let lifespanSecs = 2;
    let bullet = new Bullet(rot, unit, shootSpd, lifespanSecs);
    bullet.invWeight = 10 / 1;
    bullet.strikeDamage = 5;
    return bullet;
  });
  flamer.recoilAng = (Math.PI * 2) / 40;
  flamer.shootDelaySecs = 0.005;
  flamer.shotsInClip = 1000;
  flamer.reloadDelaySecs = 1;
  return flamer;
};

// ==== BOUND
let Bound = U.inspire({ name: 'Bound', methods: (insp, Insp) => ({
  init: function() {
    this.loc = new CarteXY();
    this.rot = 0;
  },
  getAxisAlignedBound: function() { throw new Error('not implemented'); },
  getAxes: function(bound2) { throw new Error('not implemented'); },
  projOnAxis: function(axis) { throw new Error('not implemented'); },
})});
Bound.getPenetration = (b1, b2) => {
  
  let axes1 = b1.getAxes(b2);
  for (let axis of axes1) if (!axis) throw new Error(`Bound ${b1.constructor.name} produced bad axis`);
  
  let axes2 = b2.getAxes(b1);
  for (let axis of axes2) if (!axis) throw new Error(`Bound ${b2.constructor.name} produced bad axis`);
  
  let axes = [ ...axes1, ...axes2 ];
  
  let leastAxis = null;
  let leastPenAmt = U.intUpperBound;
  for (let i = 0, len = axes.length; i < len; i++) {
    let axis = axes[i];
    let [ minL, minR ] = b1.projOnAxis(axis);
    let [ maxL, maxR ] = b2.projOnAxis(axis);
    if (maxL < minL) [ minL, minR, maxL, maxR ] = [ maxL, maxR, minL, minR ];
    
    let penAmt = minR - maxL;
    if (penAmt < 0) return null; // Found an axis with separation!
    
    if (penAmt < leastPenAmt) [ leastAxis, leastPenAmt ] = [ axis, penAmt ];
  }
  
  return leastAxis ? [ leastAxis, leastPenAmt ] : null;
  
};
let ConvexPolygonBound = U.inspire({ name: 'ConvexPolygonBound', insps: { Bound }, methods: (insp, Insp) => ({
  init: function(vertsCW, angs=null) {
    insp.Bound.init.call(this);
    this.vertsCW = vertsCW;
    this.angs = angs;
    if (!this.angs) {
      this.angs = [];
      this.eachSeg((v1, v2) => {
        this.angs.push(v1.angTo(v2) - U.ROT_CCW1);
      });
    }
  },
  eachSeg: function(f) {
    let ret = [];
    let len = this.vertsCW.length;
    let last = this.vertsCW[len - 1];
    for (let i = 0; i < len; i++) {
      f(last, this.vertsCW[i]);
      last = this.vertsCW[i];
    }
  },
  getAxisAlignedBound: function() {
    
    let h = this.projOnAxis(new CarteXY(1, 0));
    let v = this.projOnAxis(new CarteXY(0, 1));
    
    if (!U.validNum(h[0]) || !U.validNum(h[1])) throw new Error('INVALID NUM');
    if (!U.validNum(v[0]) || !U.validNum(v[1])) throw new Error('INVALID NUM');
    
    return {
      x0: h[0], x1: h[1],
      y0: v[0], y1: v[1]
    };
    
  },
  getAxes: function(bound2) {
    return this.angs.map(ang => new PolarXY(ang + this.rot));
  },
  projOnAxis: function(axis) {
    let min = U.intUpperBound;
    let max = U.intLowerBound;
    for (let i = 0, len = this.vertsCW.length; i < len; i++) {
      
      let v = this.vertsCW[i];
      let mag = v.mag();
      let ang = v.ang();
      
      let offsetVert = this.loc.add(new PolarXY(ang + this.rot, mag));
      
      // let offsetVert = this.loc.add(this.vertsCW[i]);
      let projLen = offsetVert.projLen(axis, 1);
      if (projLen < min) min = projLen;
      if (projLen > max) max = projLen;
    }
    return [ min, max ];
  },
  getExtremeties: function() {
    return this.vertsCW.map(v => v.rot(this.rot).add(this.loc));
  },
})});
let RectangleBound = U.inspire({ name: 'RectangleBound', insps: { ConvexPolygonBound }, methods: (insp, Insp) => ({
  init: function(w, h, hw=w*0.5, hh=h*0.5) {
    insp.ConvexPolygonBound.init.call(this, 
      [ new CarteXY(-hw, -hh), new CarteXY(hw, -hh), new CarteXY(hw, hh), new CarteXY(-hw, hh) ],
      [ U.ROT_U, U.ROT_R ]
    );
  },
})});
let CircleBound = U.inspire({ name: 'CircleBound', insps: { Bound }, methods: (insp, Insp) => ({
  init: function(r) {
    insp.Bound.init.call(this);
    this.r = r;
  },
  getAxisAlignedBound: function() {
    let [ x, y ] = this.loc.asCarte();
    let r = this.r;
    
    if (!U.validNum(x) || !U.validNum(y) || !U.validNum(r)) throw new Error('INVALID NUM');
    
    return {
      x0: x - r, x1: x + r,
      y0: y - r, y1: y + r
    }
  },
  getAxes: function(bound2) {
    // If `bound2` has no extremeties, the best we can do is hope the mid->mid vector works
    let extremeties = bound2.getExtremeties() || [ bound2.loc ];
    let ret = [];
    for (let i = 0, len = extremeties.length; i < len; i++) {
      let diff = extremeties[i].sub(this.loc).norm();
      if (diff) ret.push(diff);
    }
    return ret;
    // return extremeties.map(ex => ex.sub(this.loc).norm());
  },
  projOnAxis: function(axis) {
    let p = this.loc.projLen(axis);
    return [ p - this.r, p + this.r ];
  },
  getExtremeties: function() {
    return null;
  },
})});
let LineSegmentBound = U.inspire({ name: 'LineSegmentBound', insps: { Bound }, methods: (insp, Insp) => ({
  init: function(length) {
    insp.Bound.init.call(this);
    this.length = length;
    if (!U.validNum(this.length)) throw new Error(`Invalid length: ${length}`);
  },
  endPt: function() {
    return this.loc.add(new PolarXY(this.rot, this.length));
  },
  getAxisAlignedBound: function() {
    let [ endX, endY ] = this.endPt().asCarte();
    let [ x0, x1 ] = [ this.loc.x, endX ];
    let [ y0, y1 ] = [ this.loc.y, endY ];
    
    if (x1 < x0) [ x0, x1 ] = [ x1, x0 ];
    if (y1 < y0) [ y0, y1 ] = [ y1, y0 ];
    
    return { x0, x1, y0, y1 };
  },
  getAxes: function(bound2) {
    return [
      new PolarXY(this.rot),
      new PolarXY(this.rot + U.ROT_CW1)
    ];
  },
  projOnAxis: function(axis) {
    let [ proj1, proj2 ] = [ this.loc.projLen(axis), this.endPt().projLen(axis) ];
    return proj1 < proj2 ? [ proj1, proj2 ] : [ proj2, proj1 ];
  },
  getExtremeties: function() {
    return [ this.loc, this.endPt() ];
  },
})});

// ==== ZONE
let Zone = U.inspire({ name: 'Zone', methods: (insp, Insp) => ({
  $UID: 0,
  
  init: function(name) {
    this.name = name;
    this.uid = Zone.UID++;
    this.parentZone = null;
    this.entities = {};
    this.jurisdictionCount = 0; // Count of ALL entities in this zone
  },
  addEntity: function(entity) {
    if (entity.zone) entity.zone.remEntity(entity);
    entity.zones[this.uid] = this;
    this.entities[entity.uid] = entity;
    this.childAdd(entity);
    return entity;
  },
  remEntity: function(entity) {
    delete entity.zones[this.uid];
    delete this.entities[entity.uid];
    this.childRem(entity);
    return entity;
  },
  childAdd: function(entity, child=this) { this.jurisdictionCount++; if (this.parentZone) this.parentZone.childAdd(entity, child); },
  childRem: function(entity, child=this) { this.jurisdictionCount--; if (this.parentZone) this.parentZone.childRem(entity, child); },
  getFlatJurisdiction: function() {
    // Returns an Array of every Zone, including `this`, under our jurisdiction
    throw new Error('not implemented');
  },
  getBestZones: function(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyContains=false) {
    // Returns `null` if outside this Zone, or the finest-grained Zones in this
    // Zone's jurisdiction which fully enclose the bound
    throw new Error('not implemented');
  },
  placeEntity: function(entity) {
    let exitedZones = { ...entity.zones }; // Initially mark all zones as exited
    for (let zone of this.getBestZones(entity.bound)) {
      if (!zone.entities.hasOwnProperty(entity.uid)) zone.addEntity(entity);
      delete exitedZones[zone.uid]; // Unmark this zone as exited
    }
    for (let exitedZone of Object.values(exitedZones)) exitedZone.remEntity(entity);
  },
  unplaceEntity: function(entity) {
    for (let exitedZone of Object.values(entity.zones)) exitedZone.remEntity(entity);
  },
})});
let SquareZone = U.inspire({ name: 'SquareZone', insps: { Zone }, methods: (insp, Insp) => ({
  init: function(name, offset, e) {
    insp.Zone.init.call(this, name);
    this.offset = offset.toCarte();
    this.he = e * 0.5; // "e" is "extent"; "he" is "half-extent"
  },
  containsRect: function({ x0, x1, y0, y1 }) {
    let rhw = (x1 - x0) * 0.5; // rect-half-width
    let rhh = (y1 - y0) * 0.5; // rect-half-height
    let rx = x0 + rhw; // rect center x
    let ry = y0 + rhh; // rect center y
    
    let { x, y } = this.offset; // Definitely a CarteXY
    let he = this.he;
    
    let tw = rhw + he; // Total x clearance distance
    let th = rhh + he; // Total y clearance distance
    
    return (Math.abs(rx - x) < tw) && (Math.abs(ry - y) < th);
    
  },
  getFlatJurisdiction: function() {
    return [ this ];
  },
  getBestZones: function(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyContains=false) {
    return (thisDefinitelyContains || this.containsRect(aaBound)) ? [ this ] : [];
  },
})});
let TiledZone = U.inspire({ name: 'TiledZone', insps: { SquareZone }, methods: (insp, Insp) => ({
  init: function(name, offset, e, numTilesAcross=4, makeSquareZone=null) {
    insp.SquareZone.init.call(this, name, offset, e);
    this.numTilesAcross = numTilesAcross;
    this.tileW = (this.he * 2) / this.numTilesAcross;
    this.invTileW = 1 / this.tileW;
    this.tiles = {}; // List of individual tiles
    this.tileExts = {}; // List of rectangular selections of tiles
    this.makeSquareZone = makeSquareZone || ((name, off, e) => new SquareZone(name, off, e));
  },
  xyToTileCoords: function(x, y) {
    return [
      Math.floor((x - (this.offset.xx() - this.he)) * this.invTileW),
      Math.floor((y - (this.offset.yy() - this.he)) * this.invTileW)
    ];
  },
  getFlatJurisdiction: function() {
    let supJurisdiction = insp.SquareZone.getFlatJurisdiction.call(this);
    return supJurisdiction.concat(...Object.values(this.tiles).map(t => t.getFlatJurisdiction()));
  },
  getBestZones: function(bound, aaBound=bound.getAxisAlignedBound(), thisDefinitelyContains=false) {
    let { x0, y0, x1, y1 } = aaBound;
    let [ cx1, cy1 ] = this.xyToTileCoords(x0, y0);
    let [ cx2, cy2 ] = this.xyToTileCoords(x1, y1);
    
    // Bound the tile coords between 0 (inc) and `this.numTilesAcross` (exc)
    if (cx1 < 0) cx1 = 0;
    if (cy1 < 0) cy1 = 0;
    if (cx2 >= this.numTilesAcross) cx2 = this.numTilesAcross - 1;
    if (cy2 >= this.numTilesAcross) cy2 = this.numTilesAcross - 1;
    
    let childZones = [];
    for (let x = cx1; x <= cx2; x++) { for (let y = cy1; y <= cy2; y++) {
      let key = `${x},${y}`;
      if (!this.tiles.has(key)) {
        let tile = this.makeSquareZone(key, new CarteXY((cx1 + 0.5) * this.tileW, (cx2 + 0.5) * this.tileW), this.tileW);
        this.tiles[key] = tile;
        tile.parentZone = this;
      }
      childZones.push(this.tiles[key].getBestZones(bound, aaBound, true));
    }}
    
    return [].concat(...childZones);
  },
  childRem: function(entity, child=this) {
    // If `child` is empty, and `child` is a direct tile child of ours, free it up!
    if (child.jurisdictionCount === 0 && this.tiles[child.name] === child) delete this.tiles[child.name];
    insp.SquareZone.childRem.call(this, entity, child);
  },
})});

// ==== CLIENT
let Client = U.inspire({ name: 'Client', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    ip: { sync: C.sync.delta,
      change: (inst, ip2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.ip,
      actual: (inst) => inst.ip
    }
  }),
  
  init: function(ip, sokt) {
    insp.Entity.init.call(this);
    this.ip = ip;
    this.sokt = sokt;
    this.actor = null;
    
    this.p = {
      status: 'starting',
      buff: Buffer.alloc(0),
      curOp: null,
      curFrames: []
    };
    
    sokt.on('readable', () => {
      let p = this.p;
      let buff = sokt.read();
      
      if (buff === null) buff = Buffer.alloc(0);
      
      let totalLen = p.buff.length + buff.length; // TODO: deny HUGE buffers!
      p.buff = Buffer.concat([ p.buff, buff ], totalLen);
      this[p.status !== 'starting' ? 'receivedData' : 'receivedHandshakeData']();
    });
  },
  handshakeReply: function(packet) {
    try {
      let lines = packet.split('\r\n');
      // Parse headers:
      let headers = {};
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        let sepInd = line.indexOf(':');
        if (sepInd === -1) throw new Error(`Line doesn't contain header: ${line}`);
        let k = line.substr(0, sepInd).trim().toLowerCase();
        let v = line.substr(sepInd + 1).trim();
        headers[k] = v;
      }
      
      if (!headers.hasOwnProperty('sec-websocket-key')) throw new Error('Missing "sec-websocket-key" header');
      let hash = crypto.createHash('sha1');
      hash.end(`${headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`);
      this.sokt.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Accept: ${hash.read().toString('base64')}\r\n` +
        `\r\n`
      );
    } catch(err) {
      this.sokt.end(`HTTP/1.1 400 ${err.message} \r\n\r\n`);
      throw err;
    }
  },
  receivedHandshakeData: function() {
    
    let p = this.p;
    let buff = p.buff;
    if (buff.length < 4) return;
    
    let packetInd = null;
    for (let i = 0, len = buff.length - 4; i <= len; i++) {
      if (buff[i] === 13 && buff[i + 1] === 10 && buff[i + 2] === 13 && buff[i + 3] === 10) { packetInd = i; break; }
    }
    if (packetInd === null) return;
    
    let packet = buff.slice(0, packetInd).toString('utf8');
    p.buff = buff.slice(packetInd + 4);
    
    try {
      this.handshakeReply(packet);
      p.status = 'started';
      this.sokt.emit('working');
      if (p.buff.length) this.receivedData();
    } catch(err) {
      output(`Couldn't do handshake:${'\n'}PACKET:${'\n'}${packet}${'\n'}REASON: ${err.stack}`);
      if (p.buff.length) this.receivedHandshakeData();
    }
  },
  receivedData: function() {
    let p = this.p;
    let { buff, curOp } = p;
    
    try {
      while (buff.length >= 2) {
        // ==== PARSE FRAME
        
        let b = buff[0] >> 4; // Look at bits beyond first 4
        if (b % 8) throw new Error('Some reserved bits are on');
        let final = b === 8;
        
        let op = buff[0] % 16;
        if (op < 0 || (op > 2 && op < 8) || op > 10) throw new Error(`Invalid op: ${op}`);
        
        if (op >= 8 && !final) throw new Error('Fragmented control frame');
        
        b = buff[1];
        let masked = b >> 7;
        
        // Server requires a mask. Client requires no mask
        if (!masked) throw new Error('No mask');
        
        let length = b % 128;
        let offset = masked ? 6 : 2; // Masked frames have an extra 4 halfwords containing the mask
        
        if (buff.length < offset + length) return; // Await more data
        
        if (length === 126) {         // Websocket's "medium-size" frame format
          length = buff.readUInt16BE(2);
          offset += 2;
        } else if (length === 127) {  // Websocket's "large-size" frame format
          length = buff.readUInt32BE(2) * U.int32 + buff.readUInt32BE(6);
          offset += 8;
        }
        
        if (buff.length < offset + length) return; // Await more data
        
        // Now we know the exact range of the incoming frame; we can slice and unmask it as necessary
        let data = buff.slice(offset, offset + length);
        if (masked) { // Apply an XOR mask if directed
          
          let mask = buff.slice(offset - 4, offset); // The 4 halfwords preceeding the offset are the mask
          let w = 0;
          for (let i = 0, len = data.length; i < len; i++) {
            data[i] ^= mask[w];
            w = w < 3 ? w + 1 : 0; // `w` follows `i`, but wraps every 4. More efficient than `%`
          }
          
        }
        
        // Remove the frame we've managed to locate
        p.buff = buff = buff.slice(offset + length); 
        
        // ==== PROCESS FRAME (based on `final`, `op`, and `data`)
        
        // The following operations can occur regardless of the socket's status
        if (op === 8) {         // Process "close" op
          
          p.status = 'ending';
          this.sokt.end();
          break;
          
        } else if (op === 9) {  // Process "ping" op
          
          throw Error('not implemented op: 9');
          
        } else if (op === 10) { // Process "pong" op
          
          throw Error('not implemented op: 10');
          
        }
        
        // For the following operations, ensure that the socket is open
        if (p.status !== 'started') continue;
        
        // Validate "continuation" functionality
        if (op === 0 && curOp === null) throw new Error('Invalid continuation frame');
        if (op !== 0 && curOp !== null) throw new Error('Expected continuation frame');
        
        // Process "continuation" ops as if they were the op being continued
        if (op === 0) op = curOp;
        
        if (op !== 1) {
          throw new Error(`Unsupported op: ${op}`);
        } else { // Text ops are our ONLY supported ops!
          p.curOp = 1;
          p.curFrames.push(data);
          
          if (final) {
            let fullStr = Buffer.concat(p.curFrames).toString('utf8');
            p.curOp = null;
            p.curFrames = [];
            this.receive(JSON.parse(fullStr));
          }
        }
      }
    } catch(err) {
      
      output(`Websocket error:${'\n'}${err.stack}`);
      
      p.buffer = Buffer.alloc(0);
      p.curOp = null;
      p.curFrames = null;
      
    } 
  },
  receive: function(command) {
    this.sokt.emit('command', command);
  },
  send: async function(command) {
    if (this.p.status !== 'started') throw new Error(`Can't send data to client with status ${this.p.status}`);
    let data = null;
    try {
      data = JSON.stringify(command);
    } catch(err) {
      output(`Error sending: ${err.message}`);
      output(`Type: ${command.type}`);
      if (command.type === 'update') for (let key of [ 'add', 'rem', 'upd']) output(`${key}:`, command.update[key]);
      return;
    }
    
    let metaBuff = null;
    
    if (data.length < 126) {            // small-size
      
      metaBuff = Buffer.alloc(2);
      metaBuff[1] = data.length;
      
    } else if (data.length < 65536) {   // medium-size
      
      metaBuff = Buffer.alloc(4);
      metaBuff[1] = 126;
      metaBuff.writeUInt16BE(data.length, 2);
      
    } else {                            // large-size
      
      metaBuff = Buffer.alloc(8);
      metaBuff[1] = 127;
      metaBuff.writeUInt32BE(Math.floor(data.length / U.int32), 2);
      metaBuff.writeUInt32BE(data.length % U.int32, 6);
      
    }
    
    metaBuff[0] = 129; // 128 + 1; `128` pads for modding by 128; `1` is the "text" op
    await new Promise(r => this.sokt.write(Buffer.concat([ metaBuff, Buffer.from(data) ]), r));
  },
  start: function() {},
  update: function(secs) { /* nothing */ },
  end: function() {
    this.p.status = 'ended';
    this.sokt.end();
  },
})});

// ==== DECALS
let Decal = U.inspire({ name: 'Decal', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    loc: { sync: C.sync.delta,
      change: (inst, loc) => { inst.loc = loc },
      serial: (inst) => inst.loc.asCarte(),
      actual: (inst) => inst.loc
    },
    rot: { sync: C.sync.delta,
      change: (inst, rot) => { inst.rot = rot; },
      serial: (inst) => inst.rot,
      actual: (inst) => inst.rot
    }
  }),
  
  init: function(loc=new CarteXY(), rot=0) {
    insp.Entity.init.call(this);
    this.loc = loc;
    this.rot = rot;
  },
  start: function() {},
  update: function() {},
  end: function() {}
})});
let Road = U.inspire({ name: 'Road', insps: { Decal }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    condition: { sync: C.sync.delta,
      change: (inst, condition) => { inst.condition = condition; },
      serial: (inst) => inst.condition,
      actual: (inst) => inst.condition
    },
    width: { sync: C.sync.delta,
      change: (inst, width) => { inst.width = width; },
      serial: (inst) => inst.width,
      actual: (inst) => inst.width
    },
    points: { sync: C.sync.delta,
      change: (inst, points) => { inst.points = points; },
      serial: (inst) => inst.points.map(p => p.asCarte()),
      actual: (inst) => inst.points
    }
  }),
  
  init: function(width=10, points=[]) {
    insp.Decal.init.call(this);
    this.width = width;
    this.points = points;
  }
})});
let FloorPlan = U.inspire({ name: 'FloorPlan', insps: { Decal }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    w: { sync: C.sync.delta,
      change: (inst, w) => { inst.w = w; },
      serial: (inst) => inst.w,
      actual: (inst) => inst.w
    },
    h: { sync: C.sync.delta,
      change: (inst, h) => { inst.h = h; },
      serial: (inst) => inst.h,
      actual: (inst) => inst.h
    }
  }),
  
  init: function(w, h, loc, rot) {
    insp.Decal.init.call(this, loc, rot);
    this.w = w;
    this.h = h;
  }
})});

// ==== SPATIAL ENTITY
let SpatialEntity = U.inspire({ name: 'SpatialEntity', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    rot: { sync: C.sync.delta,
      change: (inst, rot2) => { inst.bound.rot = (rot2 % U.ROT_FULL); },
      serial: (inst) => inst.bound.rot,
      actual: (inst) => inst.bound.rot
    },
    loc: { sync: C.sync.delta,
      change: (inst, loc2) => { inst.bound.loc = loc2; },
      serial: (inst) => inst.bound.loc.asCarte(),
      actual: (inst) => inst.bound.loc
    }
  }),
  
  init: function(bound=new CircleBound(10)) {
    insp.Entity.init.call(this);
    
    this.zones = {};
    this.bound = bound;
    
    this.rotVel = 0;
    this.vel = new CarteXY();
    this.acl = new CarteXY();
    this.invWeight = 1;
  },
  isTangible: function() {
    // Entities that are "tangible" can still detect collisions, but don't
    // need to be separated upon collision. A collision involving an
    // intangible entity may not have any separation occur, but `collideAll`
    // will still get called
    return true;
  },
  physicalUpdate: function(secs) { throw new Error('not implemented'); },
  dist: function(phys2) {
    return this.bound.loc.dist(phys2.bound.loc);
  },
  canCollide: function(entity) {
    return true;
  },
  collideAll: function(collisions) {
    
  },
  start: function() {
    this.world.rootZone.placeEntity(this);
  },
  update: function(secs) {
    let locChanged = this.modF('loc', loc => this.vel.nonZero() ? loc.add(this.vel.scale(secs)) : loc);
    let rotChanged = this.modF('rot', rot => rot + (this.rotVel * secs))
    
    // It's nice to be able to call `update` on some entities before they've
    // entered the world. Those entities shouldn't be placed into zones
    // Doing so leads to an invalid state: a zone contains a uid not also
    // contained in `this.world.entities`; hence the `this.inWorld` check
    if (this.inWorld && (locChanged || rotChanged)) this.world.rootZone.placeEntity(this);
  },
  end: function() {
    this.world.rootZone.unplaceEntity(this);
  }
})});

// Structures
let RectStructure = U.inspire({ name: 'RectStructure', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    w: { sync: C.sync.delta,
      change: (inst, w2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.w
    },
    h: { sync: C.sync.delta,
      change: (inst, h2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.h
    }
  }),
  
  init: function(w, h, loc, rot) {
    let rectBound = new RectangleBound(w, h);
    rectBound.loc = loc;
    rectBound.rot = rot;
    
    insp.SpatialEntity.init.call(this, rectBound);
    this.w = w;
    this.h = h;
    this.invWeight = 0; // immovable
  },
  update: function(secs) { /* nothing! */ }
})});
let SiloStructure = U.inspire({ name: 'SiloStructure', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    r: { sync: C.sync.delta,
      change: (inst, r2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.r,
      actual: (inst) => inst.r
    }
  }),
  
  init: function(r, loc, rot) {
    let circBound = new CircleBound(r);
    circBound.loc = loc;
    circBound.rot = rot;
    
    insp.SpatialEntity.init.call(this, circBound);
    this.r = r;
    this.invWeight = 0; // immovable
  },
  update: function(secs) { /* nothing! */ }
})});

// Bullets
let Bullet = U.inspire({ name: 'Bullet', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  $genFlatDef: supDef => ({
    loc: supDef.loc.gain({ sync: C.sync.total }), // Bullet "loc" is deterministic!
    unit: { sync: C.sync.delta,
      change: (inst, unit2) => { inst.unit = unit2; },
      serial: (inst) => inst.unit ? inst.unit.uid : null,
      actual: (inst) => inst.unit
    },
    maxSize: { sync: C.sync.delta,
      change: (inst, maxSize2) => { inst.maxSize = maxSize2 },
      serial: (inst) => inst.maxSize,
      actual: (inst) => inst.maxSize
    },
    vel: { sync: C.sync.delta,
      change: (inst, vel2) => { inst.vel = vel2 },
      serial: (inst) => inst.vel.asCarte(),
      actual: (inst) => inst.vel
    }
  }),
  
  init: function(rot, unit, shootSpd=1000, lifespanSecs=3) {
    insp.SpatialEntity.init.call(this, new LineSegmentBound(0));
    
    this.unit = unit;
    
    this.maxSize = shootSpd * (1/4);
    this.shootSpd = shootSpd;
    this.invWeight = 10;
    this.strikeDamage = 50;
    
    // Vel and rot are locked in from initialization
    this.bound.rot = rot;
    this.vel = (new PolarXY(this.bound.rot, this.shootSpd)).toCarte();
    
    this.lifespanSecs = lifespanSecs;
    this.secsLeftToLive = lifespanSecs;
    this.totalDist = 0;
  },
  isTangible: function() { return false; /* decollision doesn't occur against bullets */ },
  canCollide: function(entity) {
    return this.secsLeftToLive > 0 && entity !== this.unit && !U.isInspiredBy(entity, Bullet);
  },
  collideAll: function(collisions) {
    let deepestEntity = null;
    let deepestPen = U.intUpperBound; // U.intLowerBound; // TODO: Shallowest?? Wat???
    // let lowestAmt = U.intUpperBound;
    let axis = new PolarXY(this.bound.rot); // A unit vector in the direction of interest
    
    for (let { entity, sepAmt } of Object.values(collisions)) {
      if (sepAmt < deepestPen) [ deepestEntity, deepestPen ] = [ entity, sepAmt ];
    }
    
    this.strike(deepestEntity);
    
    // This method is called because we've collided. Bullets die on impact
    this.world.remEntity(this);
    this.secsLeftToLive = 0;
  },
  strike: function(entity) {
    
    if (U.isInspiredBy(entity, Actor)) {
      entity.modF('health', health => health - this.strikeDamage);
    }
    
  },
  update: function(secs) {
    // This is how far we'll physically translate this frame
    let dist = this.shootSpd * secs;
    this.totalDist += dist;
    
    let len = Math.min(this.totalDist, this.maxSize);
    this.bound.length = -len; // Bullet stretches back for some time
    
    this.secsLeftToLive -= secs;
    if (this.secsLeftToLive <= 0) this.world.remEntity(this);
    
    insp.SpatialEntity.update.call(this, secs);
  }
})});

// Actors
let Actor = U.inspire({ name: 'Actor', insps: { SpatialEntity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    r: { sync: C.sync.delta,
      change: (inst, r2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.bound.r
    },
    maxHealth: { sync: C.sync.delta,
      change: (inst, maxHealth2) => { inst.maxHealth = maxHealth2 },
      serial: (inst) => inst.maxHealth
    },
    health: { sync: C.sync.delta,
      change: (inst, health2) => { inst.health = health2 },
      serial: (inst) => inst.health
    }
  }),
  
  init: function(r) {
    insp.SpatialEntity.init.call(this, new CircleBound(r));
    this.formation = null;
    this.strafeSpd = 30;
    this.aheadSpd = 65;
    this.backSpd = 25;
    this.rotSpd = (Math.PI * 2) / 4; // 4s for a full rotation
    
    this.maxHealth = 100;
    this.health = this.maxHealth;
    
    this.client = null;
  },
  update: function(secs) {
    if (this.health > this.maxHealth) this.health = this.maxHealth;
    if (this.health <= 0) return this.world.remEntity(this);
    insp.SpatialEntity.update.call(this, secs);
  },
  end: function() {
    if (this.client) this.mod('client', { act: 'detach' });
    if (this.formation) this.mod('formation', { act: 'detach' });
    insp.SpatialEntity.end.call(this);
  }
})});
let Unit = U.inspire({ name: 'Unit', insps: { Actor }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    visionAngle: { sync: C.sync.delta,
      change: (inst, visionAngle2) => { inst.visionAngle = visionAngle2; },
      serial: (inst) => inst.visionAngle
    },
    visionRange: { sync: C.sync.delta,
      change: (inst, visionRange2) => { inst.visionRange = visionRange2; },
      serial: (inst) => inst.visionRange
    },
    visionScale: { sync: C.sync.delta,
      change: (inst, visionScale2) => { inst.visionScale = visionScale2; },
      serial: (inst) => inst.visionScale
    },
    bodyVision: { sync: C.sync.delta,
      change: (inst, bodyVision2) => { inst.bodyVision = bodyVision2; },
      serial: (inst) => inst.bodyVision
    }
  }),
  
  init: function(r) {
    insp.Actor.init.call(this, r);
    
    this.aheadSpd = 200;
    this.backSpd = 150;
    this.strafeSpd = 90;
    this.rotSpd = (Math.PI * 2) / 3;
    
    this.recoilAng = (Math.PI * 2) / 120;
    
    this.shootDelaySecs = 0.14;
    this.shootCooldownSecs = 0;
    
    this.mainVisionAngle = (Math.PI * 2) * 0.15;
    this.mainVisionRange = 600; // Size of the vision-type reveal
    this.mainVisionScale = 1; // 0.3; // Actual zoom level of awareness
    this.mainBodyVision = 40;
    this.visionAngle = this.mainVisionAngle;
    this.visionRange = this.mainVisionRange;
    this.visionScale = this.mainVisionScale;
    this.bodyVision = this.mainBodyVision;
    
    this.control = { s: 0, a: 0, r: 0, i: '0000' }; // Each frame these values determine updates
    this.mainItem = null;
    
    this.reveals = [];
  },
  update: function(secs) {
    // Get current interactions
    let [ mainAction, aiming, int3, int4 ] = this.control.i.split('').map(c => c === '1');
    
    // Update velocity based on interactions
    if (this.control.s || this.control.a) {
      let { a, s } = this.control;
      this.vel = XY.sum([
        new PolarXY(this.bound.rot, a ? (a > 0 ? this.aheadSpd : -this.backSpd) : 0),
        new PolarXY(this.bound.rot + U.ROT_CW1, Math.sign(s) * this.strafeSpd)
      ]);
    } else {
      this.vel = new CarteXY();
    }
    
    // Update rotational velocity
    this.rotVel = Math.sign(this.control.r) * this.rotSpd * (aiming ? 0.3 : 1);
    
    // Apply new vision params
    this.modF('visionAngle', v => !aiming ? (this.mainVisionAngle) : (this.mainVisionAngle * 0.5));
    this.modF('visionRange', v => !aiming ? (this.mainVisionRange) : (this.mainVisionRange * 1.25));
    this.modF('visionScale', v => !aiming ? (this.mainVisionScale) : (this.mainVisionScale * 0.8));
    this.modF('bodyVision', v => !aiming ? (this.mainBodyVision) : (this.mainBodyVision * 0));
    
    if (!this.client) { mainAction = true; }
    
    // Allow item use
    if (this.mainItem) {
      if (mainAction) this.mainItem.activate(secs, this, { use: 'main', steadiness: aiming ? 0.6 : 0 });
      else if (int3) this.mainItem.activate(secs, this, { use: 'reload' });
    }
    
    insp.Actor.update.call(this, secs);
  },
  end: function() {
    // TODO: What to do about our mainItem? Just remove it?
    if (this.mainItem) this.world.remEntity(this.mainItem);
    insp.Actor.end.call(this);
  }
})});
let PlannedZombie = U.inspire({ name: 'PlannedZombie', insps: { Actor }, methods: (insp, Insp) => ({
  $genFlatDef: () => {},
  
  init: function(r) {
    insp.Actor.init.call(this, r);
    this.manager = null;
    
    this.idea = null;
    
    this.rotSpd = Math.PI * 2;
    this.aheadSpd = 200;
    
    this.leadership = Math.random(); // How naturally good of a leader this zombie is
    this.idol = null; // The zombie this zombie wants to be like
    this.progress = 0; // How close this zombie feels it is to actualizing its zombie purpose in life
    this.loneliness = 0; // How far away this zombie feels from all other zombies
    this.perceivedCompany = null; // Spot where this zombie thinks it will find company
    
    // this.milestonePoint = null; // Favourable spot the zombie remembers being
    // this.milestoneProgress = 0;
    
    this.target = null;
    // this.milestoneTargetLoc = null;
    
    this.damageDealt = 0;
  },
  canCollide: function(entity) { return !U.isInspiredBy(entity, Zombie); },
  update: function(secs) {
    
    if (!manager) throw new Error('Zombie without manager');
    
    let company = this.perceivedCompany || this.bound.loc;
    let leader = 
    
    let [ movementDir, setLeader, pushMilestone ] = this.manager.hiveMind.result([
      this.bound.rot,
      this.loneliness,
      this.bound.loc.distSqr(company), this.bound.loc.angTo(company)
    ]);
    
    let { entities } = this.world;
    
    if (this.idol && (!entities.hasOwnProperty(this.idol.uid) || this.idol.progress < 0.2)) this.idol = null;
    if (this.target && !entities.hasOwnProperty(this.target.uid)) this.target = null;
    if (this.perceivedCompany === null) this.perceivedCompany = this.bound.loc;
    
    let entityEntries = Object.entries(entities);
    let [ uid, randEnt ] = entityEntries[Math.floor(Math.random() * entityEntries.length)];
    
    if (U.isInspiredBy(randEnt, Unit)) {
      if (!this.target || this.dist(randEnt) < this.dist(this.target) || Math.random() < 0.01) this.target = randEnt;
    } else if (U.isInspiredBy(randEnt, Zombie) && randEnt !== this) {
      if (!this.idol || randEnt.progress > this.idol.progress) this.idol = randEnt;
      if (!this.target && randEnt.target) this.target = randEnt.target;
      let dist = this.dist(randEnt);
      this.loneliness = (this.loneliness * 0.75) + (Math.min(dist, 1000) * (0.25 / 1000));
      this.perceivedCompany = XY.sum([
        this.perceivedCompany.scale(0.4),
        randEnt.bound.loc.scale(0.3),
        (randEnt.perceivedCompany ? randEnt.perceivedCompany : randEnt.bound.loc).scale(0.3)
      ]);
    }
    
    if (this.idol && this.idol.target && Math.random() < (this.target ? 0.01 : 0.5)) this.target = this.idol.target;
    
    let lastProgress = this.progress;
    
    this.progress = 0;
    let sigDist = 200; // Distance at which we start gaining progress
    let maxDmgSig = 100; // Amount of damage after which progress no longer increases
    
    // Progress calculation
    this.progress += this.leadership * 0.2; // TOTAL: 0.2
    if (this.target) this.progress += 0.2 + (sigDist - Math.min(this.dist(this.target), sigDist)) * (0.2 / sigDist); // TOTAL: 0.6
    if (this.idol) this.progress += 0.1; // TOTAL: 0.7
    this.progress += Math.max(maxDmgSig, this.damageDealt) * (0.3 / maxDmgSig); // TOTAL: 1
    
    // If we've started doing worse, 
    if (lastProgress > this.progress && Math.random() < 0.02) {
      this.target = null;
      this.idol = null;
      this.idea = null;
    }
    
    // Idea formulation
    if (this.idea === null) {
      if (this.target && Math.random() < (1 - (Math.min(this.dist(this.target), 1000) / 1000)) * 0.4) {
        
        let attackIdea = {
          type: 'attack',
          target: this.target,
          offset: new PolarXY(Math.random() * U.ROT_FULL, Math.random() * this.bound.r),
          dest: null,
          next: null
        };
        
        if (Math.random() < 0.7) {
          
          this.idea = {
            type: 'stalk',
            dest: this.target.bound.loc.add(new PolarXY(Math.random() * U.ROT_FULL, 50 + Math.random() * 150)),
            next: attackIdea
          };
          
        } else {
          
          this.idea = attackIdea;
          
        }
        
      } else if (this.idol && Math.random() < (1 - (Math.min(this.dist(this.idol), 1000) / 1000)) * 0.8) {
        this.idea = {
          type: 'follow',
          target: this.idol,
          offset: new PolarXY(Math.random() * U.ROT_FULL, 30 + Math.random() * 60),
          dest: null,
          next: null
        };
      } else if (Math.random() < this.loneliness * 0.4) { // 40% guaranteed at 1 loneliness; 0% at 0
        this.idea = {
          type: 'centralize',
          dest: this.perceivedCompany.add(new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 100)),
          next: null
        };
      } else {
        this.idea = {
          type: 'wander',
          dest: this.bound.loc.add(new PolarXY(Math.random() * U.ROT_FULL, 100 + Math.random() * 50)),
          next: null
        };
      }
    }
    
    if (this.idea.type === 'attack' || this.idea.type === 'follow') {
      this.idea.dest = this.idea.target.bound.loc.add(this.idea.offset);
    }
    
    this.rotVel = 0;
    this.vel = new CarteXY(0, 0);
    
    // Movement ideas
    if ([ 'stalk', 'attack', 'follow', 'centralize', 'wander', 'pathfind' ].includes(this.idea.type)) {
      
      if (this.bound.loc.distSqr(this.idea.dest) < 5 * 5) {
        
        // We're really close to destination!
        this.bound.loc = this.idea.dest;
        if (this.idea.type !== 'attack' || !entities.hasOwnProperty(this.idea.target.uid)) this.idea = this.idea.next;
        
      } else {
        
        // Far from destination! Facing right way?
        let neededAng = new PolarXY(this.bound.rot).angTo(this.idea.dest.sub(this.bound.loc));
        if (Math.abs(neededAng < this.rotSpd * secs)) {
          // Almost exactly facing the right way! Full speed ahead!
          // this.modF('rot', r => r + neededAng);
          // this.bound.rot += neededAng;
          this.rotVel = neededAng / secs;
          this.vel = new PolarXY(this.bound.rot, this.aheadSpd);
        } else {
          // Need to turn!
          this.rotVel = Math.sign(neededAng) * this.rotSpd;
        }
        
      }
      
    }
    
    insp.Actor.update.call(this, secs);
    
  },
  collideAll: function(collisions) {
    
    let [ barrier, barrierAxis ] = [ null, null ];
    
    for (let { entity, sepAxis, sepAmt } of Object.values(collisions)) {
      if (entity.invWeight === 0) [ barrier, barrierAxis ] = [ entity, sepAxis ];
      if (U.isInspiredBy(entity, Unit)) {
        let dmg = this.bound.r * 0.2;
        entity.modF('health', health => health - dmg);
        this.damageDealt += dmg;
        
        this.target = entity;
        this.idea = {
          type: 'attack',
          target: this.target,
          offset: new CarteXY(0, 0),
          dest: null,
          next: this.idea
        };
      }
    }
    
    if (barrier && this.idea) {
      
      if (this.idea.type === 'pathfind' || Math.random() < 0.2) {
        this.idea = this.idea.next;
      } else if (this.idea.dest) { // TODO: check shouldn't be needed, attack null-dests aren't being filled in maybe?
        
        let extremeties = barrier.bound.getExtremeties();
        if (extremeties) {
          
          let loc = this.bound.loc;
          let dir = this.idea.dest.sub(loc); // needle delta wanna translate
          
          let nav1 = barrierAxis.perpCW();
          let nav2 = barrierAxis.perpCCW();
          
          let bestNav = (nav1.dotProd(dir) > nav2.dotProd(dir)) ? nav1 : nav2;
          
          let cornerNav = loc.add(bestNav.scale(this.bound.r * (1.3 + Math.random()) + (Math.random() * 20)));
          cornerNav = cornerNav.add(new PolarXY(Math.random() * U.ROT_FULL, (0.4 + Math.random() * 0.6) * this.bound.r));
          
          this.idea = {
            type: 'pathfind', 
            dest: cornerNav,
            next: (this.idea && this.idea.type !== 'pathfind') ? this.idea : null
          };
          
        } else {
          this.idea = this.idea.next;
        }
        
      }
      
    }
    
  }
})});
let Zombie = U.inspire({ name: 'Zombie', insps: { Actor }, methods: (insp, Insp) => ({
  $genFlatDef: () => {},
  
  init: function(r) {
    insp.Actor.init.call(this, r);
    
    this.manager = null;
    this.loneliness = 0;
    this.ememies = new RoundFixedSet(2);    // Enemy actors; goal is to touch them
    this.fellows = new RoundFixedSet(3);    // Fellow Zombies this Zombie is aware of
    this.obstacles = new RoundFixedSet(10); // Locations the Zombie has been at when it's touched an immovable object
    
    // this.rotSpd = Math.PI * 2;
    // this.aheadSpd = 200;
    // this.leadership = Math.random(); // How naturally good of a leader this zombie is
    // this.idol = null; // The zombie this zombie wants to be like
    // this.progress = 0; // How close this zombie feels it is to actualizing its zombie purpose in life
    // this.loneliness = 0; // How far away this zombie feels from all other zombies
    // this.perceivedCompany = null; // Spot where this zombie thinks it will find company
    // this.milestonePoint = null; // Favourable spot the zombie remembers being
    // this.milestoneProgress = 0;
    // this.target = null;
    // this.milestoneTargetLoc = null;
    // this.damageDealt = 0;
  },
  canCollide: function(entity) { return !U.isInspiredBy(entity, Zombie); },
  update: function(secs) {
    
    if (!manager) throw new Error('Zombie without manager');
    
    let cmpLoc = (loc1, loc2) => {
      if (loc2 === null) return [ 0, 0, 0 ];
      if (U.isInspiredBy(loc2, SpatialEntity)) loc2 = loc2.bound.loc;
      
      let ang = loc1.angTo(loc2);
      let absAng = ang; while(absAng < 0) absAng += U.FULL_ROT;
      
      return [ 1, loc1.distSqr(loc2), loc1.angTo(loc2) ];
    };
    
    // Clear entities which no longer exist out of memory
    this.enemies.upd(en => this.world.entities.has(en.uid) ? en : null);
    this.fellows.upd(fl => this.world.entities.has(fl.uid) ? fl : null);
    
    let chkZmb = U.randElem(Object.values(this.manager.zombies));
    if (this.fellows.has(chkZmb.uid)) chkZmb = null; // Don't think about random zomb if it's already a fellow?
    
    let chkEnm = U.randElem(Object.values(this.manager.enemyFormation.actors));
    if (this.fellows.has(chkEnm.uid)) chkEnm = null; // Don't think about random enemy if it's already known?
    
    let { loc, rot } = this.bound;
    let [ moveAmt, movementDir, addEnemy, addFellow, addHotSpot ] = this.manager.hiveMind.result([
      rot,
      this.loneliness,
      ...cmpLoc(loc, chkZmb),
      ...cmpLoc(loc, chkEnm),
      ...this.enemies.mapFlat(en => [ ...cmpLoc(loc, en), en.health, en.bound.rot ]),
      ...this.fellows.mapFlat(fl => cmpLoc(loc, fl)),
      ...this.obstacles.mapFlat(ob => cmpLoc(loc, ob)),
      ...this.manager.hotspots.mapFlat(hs => cmpLoc(loc, hs)) 
    ]);
    
    if (addEnemy > 0.5) this.enemies.add(chkEnemy);
    if (addFellow > 0.5) this.fellows.add(chkZmb);
    if (addHotspot > 0.5) this.manager.hotspots.add(this.loc);
    
    this.rotSpd = 0;
    this.mod('rot', movementDir); // This skips SpatialEntity's Zone updating from rotation changes (fortunately irrelevant with circle bounds)
    this.vel = moveAmt > 0.5 ? new PolarXY(this.bound.rot, this.aheadSpd) : new CarteXY(0, 0);
    
    insp.Actor.update.call(this, secs);
    
  },
  collideAll: function(collisions) {
    for (let k in collisions) if (collisions[k].entity.invWeight === 0) { this.obstacles.add(this.bound.loc); break; }
  }
})});

// Items
let Item = U.inspire({ name: 'Item', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    name: { sync: C.sync.delta,
      change: (inst, name2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.name
    }
  }),
  
  init: function(name) {
    insp.Entity.init.call(this);
    this.name = name;
    this.unit = null;
  },
  start: function() {},
  update: function(secs) { throw new Error('not implemented'); },
  end: function() {},
  activate: function(secs, unit, { use='main' }) {
    throw new Error('not implemented');
  }
})});
let Gun = U.inspire({ name: 'Gun', insps: { Item }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    shotsInClip: { sync: C.sync.delta,
      change: (inst, shotsInClip2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.shotsInClip
    },
    shotsFired: { sync: C.sync.delta,
      change: (inst, shotsFired2) => { inst.shotsFired = shotsFired2; },
      serial: (inst) => inst.shotsFired
    },
    reloadDelaySecs: { sync: C.sync.delta,
      change: (inst, reloadDelaySecs2) => { throw new Error('Can\'t modify this prop'); },
      serial: (inst) => inst.reloadDelaySecs
    }
  }),
  
  init: function(name, makeBullet=null) {
    insp.Item.init.call(this, name);
    this.makeBullet = makeBullet;
    this.recoilAng = (Math.PI * 2) / 80;
    this.shootDelaySecs = 0.14;
    this.shootCooldownSecs = 0;
    this.shotsInClip = 30;
    this.shotsFired = 0;
    this.reloadDelaySecs = 2;
    this.reloadCooldownSecs = 0;
  },
  update: function(secs) {
    if (this.shootCooldownSecs > 0) this.shootCooldownSecs -= secs;
    
    // If magazine empty, start reloading
    if (this.reloadCooldownSecs <= 0 && this.shotsFired >= this.shotsInClip) {
      this.reloadCooldownSecs = this.reloadDelaySecs;
    }
    
    // If reloading, keep reloading
    if (this.reloadCooldownSecs > 0) {
      this.reloadCooldownSecs -= secs;
      if (this.reloadCooldownSecs <= 0) this.modF('shotsFired', v => 0);
    }
  },
  activate: function(secs, unit, { use='main', steadiness=0 }) {
    if (use === 'main') {
      
      if (this.reloadCooldownSecs > 0) return;
      
      let rot = this.unit.bound.rot;
      let denom = 1 / this.shootDelaySecs;
      let countShotsNow = 0;
      while (this.shootCooldownSecs <= 0 && (this.shotsFired + countShotsNow) < this.shotsInClip) {
        let ang = rot + (Math.random() - 0.5) * (this.recoilAng - (this.recoilAng * steadiness));
        let bullet = this.world.addEntity(this.makeBullet(ang, this.unit));
        bullet.bound.loc = this.unit.bound.loc;
        
        // Split the `secs` we have to work with into properly weighted pieces
        bullet.update(secs * -(this.shootCooldownSecs * denom));
        
        this.shootCooldownSecs += this.shootDelaySecs;
        countShotsNow++;
      }
      
      this.modF('shotsFired', shotsFired => shotsFired + countShotsNow);
      
    } else if (use === 'reload') {
      
      if (this.shotsFired >= this.shotsInClip || this.shotsFired === 0) return;
      this.mod('shotsFired', this.shotsInClip); // Mark all bullets as fired
      
    } else {
      
      throw new Error('Unknown use: ', use);
      
    }
  }
})});

// Formations
let Formation = U.inspire({ name: 'Formation', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    
  }),
  
  init: function() {
    insp.Entity.init.call(this);
    this.actors = {};
  },
  start: function() {},
  update: function(secs) {
  },
  end: function() {
    for (let [ uid, actor ] of Object.entries(this.actors)) actor.mod('formation', { act: 'detach' });
  }
})});

// Managers
let ClientManager = U.inspire({ name: 'ClientManager', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({}),
  
  init: function(formation) {
    insp.Entity.init.call(this);
    this.formation = formation;
    
    let soktServer = net.createServer(sokt => {
      let ip = sokt.remoteAddress;
      output(`SOKT: ${ip}`);
      let client = new Client(ip, sokt);
      this.incomingClient(client);
    });
    
    this.ready = Promise.all([
      new Promise(r => soktServer.listen(config.soktPort, config.hostname, r))
    ]);
  },
  incomingClient: function(client) {
    client.sokt.on('working', () => {
      // Listen for client commands
      client.sokt.on('command', command => this.onClientCommand(client, command))
      
      this.world.addClient(client); // Only add the client after we know it's working!
      
      // TODO: Reloading when a client-unit already exists breaks! (can't even spawn!)
      // See if there's already a unit for this client
      let prevUnit = null;
      for (let [ uid, entity ] of Object.entries(this.world.entities)) {
        if (U.isInspiredBy(entity, Unit) && entity.client && entity.client.ip === client.ip) { prevUnit = entity; break; }
      }
      
      if (prevUnit) {
        this.world.remEntity(prevUnit.client);
        prevUnit.mod('client', { act: 'attach', client });
      }
      
    });
    client.sokt.on('close', () => {
      this.world.remClient(client);
    });
    client.sokt.on('error', err => {
      output(`SOKT ${client.ip} ERROR: ${err.stack}`);
      this.world.remClient(client);
    });
  },
  onClientCommand: function(client, command) {
    
    let clientCommands = ({
      spawn: (client, command) => {
        if (client.actor) return;
        output(`SPAWNING: ${client.ip}`);
        
        let mainItem = this.world.addEntity(makeGatling());
        let unit = this.world.addEntity(new Unit(8));
        unit.bound.loc = new CarteXY(0, 0);
        unit.bound.rot = U.ROT_D;
        
        // unit.mainVisionRange = 400;
        // unit.mainVisionScale = 0.5;
        // unit.mainVisionAngle = Math.PI * 0.2;
        // unit.mainBodyVision = 2000;
        // unit.mainVisionScale = 0.4;
        
        unit.mod('mainItem', { act: 'attach', mainItem });
        unit.mod('client', { act: 'attach', client });
        unit.mod('formation', { act: 'attach', formation: this.formation });
      },
      control: (client, command) => {
        if (!client.actor) return;
        client.actor.control = command.control;
      }
    });
    
    if (!clientCommands.hasOwnProperty(command.type)) return output(`Unexpected command: ${command.type}`);
    clientCommands[command.type](client, command);
  },
  start: function() {},
  update: function(secs) {},
  end: function() {}
})});
let ZombieManager = U.inspire({ name: 'ZombieManager', insps: { Entity }, methods: (insp, Insp) => ({
  $genFlatDef: () => ({
    
  }),
  
  init: function(secsPerSpawn=30, enemyFormation) {
    insp.Entity.init.call(this);
    this.secsPerSpawn = secsPerSpawn;
    this.enemyFormation = enemyFormation;
    this.spawnCounter = 0;
    this.zombies = {};
    this.hotspots = new RoundFixedSet(30);
  },
  start: function() {},
  update: function(secs) {
    
    if (!this.secsPerSpawn) { this.spawnCounter = 0; return; }
    
    this.spawnCounter += secs;
    if (this.spawnCounter > this.secsPerSpawn) {
      this.spawnCounter = 0;
      let size = Math.round(Math.random() * Math.random() * Math.random() * Math.random() * 30);
      let zombie = this.world.addEntity(new Zombie(this, 10 + size));
      zombie.mod('manager', { act: 'attach', manager: this });
      zombie.aheadSpd = 200 / Math.max(2, size);
      zombie.bound.loc = new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 700);
      zombie.bound.rot = Math.random() * U.ROT_FULL;
      zombie.health = 30 + (zombie.bound.r * zombie.bound.r * zombie.bound.r * 0.15);
      zombie.maxHealth = zombie.health;
      
      if (Math.random() < 0.6) {
        
        let unit = this.world.addEntity(new Unit(8));
        unit.bound.loc = new PolarXY(Math.random() * U.ROT_FULL, Math.random() * 300);
        unit.bound.rot = Math.random() * U.ROT_FULL;
        
        // Set a main item
        let mainItem = this.world.addEntity(makePistol());
        unit.mod('mainItem', { act: 'attach', mainItem });
        
        // Set a formation
        unit.mod('formation', { act: 'attach', formation: this.enemyFormation });
        
      }
    }
    
  },
  end: function() {}
})});

Entity.relate11('actorWithClient', C.sync.delta, Actor, 'client', Client, 'actor');
Entity.relate1M('actorInFormation', C.sync.delta, Actor, 'formation', Formation, 'actors');
Entity.relate11('unitWithMainItem', C.sync.delta, Unit, 'mainItem', Client, 'unit');
Entity.relate1M('zombieWithManager', C.sync.none, Zombie, 'manager', ZombieManager, 'zombies');

// Enforcers
let PhysicsEnforcer = U.inspire({ name: 'PhysicsEnforcer', methods: (insp, Insp) => ({
  init: function(rootZone) {
    this.rootZone = rootZone;
  },
  enforce: function(secs) {
    let { entities } = this.world;
    
    let checks = {};
    
    // Broad separation...
    let allZones = this.rootZone.getFlatJurisdiction();
    for (let zone of allZones) {
      let zEnts = Object.values(zone.entities);
      for (let i = 1; i < zEnts.length; i++) { for (let j = 0; j < i; j++) {
        let [ e1, e2 ] = [ zEnts[i], zEnts[j] ];
        if (!e1.invWeight && !e2.invWeight) continue; // No check if both are immovable
        if (!e1.canCollide(e2) || !e2.canCollide(e1)) continue;
        checks[U.duoKey(e1.uid, e2.uid)] = [ e1, e2 ];
      }}
    }
    
    // Narrow separation... (between pairs of entities calculated in broad phase)
    let collisions = {};
    let separations = [];
    for (let [ entity1, entity2 ] of Object.values(checks)) {
      
      let penResult = Bound.getPenetration(entity1.bound, entity2.bound);
      if (!penResult) continue;
      let [ sepAxis1To2, sepAmt ] = penResult;
      
      let [ iw1, b1 ] = [ entity1.invWeight, entity1.bound ];
      let [ iw2, b2 ] = [ entity2.invWeight, entity2.bound ];
      
      // `Bound.getPenetration` doesn't guarantee the direction of the resulting axis. Check to
      // make sure it's roughly co-linear with the delta vector between the two entities
      let sepAxis2To1 = sepAxis1To2.scale(-1);
      let vec1To2 = b1.loc.sub(b2.loc);
      if (sepAxis1To2.dotProd(vec1To2) < 0) [ sepAxis1To2, sepAxis2To1 ] = [ sepAxis2To1, sepAxis1To2 ];
      
      // Keep track of the collision for each entity
      if (!collisions.hasOwnProperty(entity1.uid)) collisions[entity1.uid] = {};
      collisions[entity1.uid][entity2.uid] = { entity: entity2, sepAxis: sepAxis1To2, sepAmt };
      if (!collisions.hasOwnProperty(entity2.uid)) collisions[entity2.uid] = {};
      collisions[entity2.uid][entity1.uid] = { entity: entity1, sepAxis: sepAxis2To1, sepAmt };
      
      // Keep track of the separation which needs to happen. Only the lighter entity will move.
      let [ light, heavy ] = (iw1 === iw2)
        ? (Math.random() > 0.5 ? [ entity1, entity2 ] : [ entity2, entity1 ])
        : (iw1 > iw2 ? [ entity1, entity2 ] : [ entity2, entity1 ]);
      
      if (light.isTangible() && heavy.isTangible())
        separations.push({ light, heavy, sepAmt, sepAxis: light === entity1 ? sepAxis1To2 : sepAxis2To1 });
      
    }
    
    for (let [ uid, coll ] of Object.entries(collisions)) entities[uid].collideAll(coll);
    
    for (let { light, heavy, sepAxis, sepAmt } of separations) {
      light.modF('loc', loc => loc.add(sepAxis.scale(sepAmt)));
      this.rootZone.placeEntity(light);
    }
    
  },
})});

let ZombWorld = U.inspire({ name: 'ZombWorld', insps: { World }, methods: (insp, Insp) => ({
  init: function({ framesPerSec=60, rootZone=null }={}) { // TODO: 60fps isn't a bit ambitious?
    insp.World.init.call(this);
    this.nextUid = 0;
    this.rootZone = rootZone;
    this.enforcers = [];
    
    // The update loop
    this.secsPerFrame = 1 / framesPerSec;
    this.millisPerFrame = this.secsPerFrame * 1000;
    
    let smoothMs = new SmoothingVal(0, 0.1);
    let initialTime = +new Date();
    
    this.updateInterval = new Interval(() => {
      let time = +new Date();
      this.update(this.secsPerFrame);
      process.stdout.write(`\rProcessed in ${Math.round(smoothMs.update(new Date() - time))}ms / ${Math.round(this.millisPerFrame)}ms (${(Math.floor((new Date() - initialTime) * 0.01) / 10).toFixed(1)}s) ${' '.repeat(10)}\r`);
    });
  },
  startUpdateInterval: function() {
    this.updateInterval.start(this.millisPerFrame);
  },
  stopUpdateInterval: function() {
    this.updateInterval.stop();
  },
  update: function(secs) {
    this.entities.forEach(ent => ent.update(secs));
    this.enforcers.forEach(enf => enf.enforce(secs));
    
    let tickResult = this.doTickResolution();
    
    // Serialize "add", "rem", and "upd"
    if (U.empty(tickResult.add))  delete tickResult.add;
    else                          tickResult.add = tickResult.add.map(ent => ent.serializeFull());
    if (U.empty(tickResult.rem))  delete tickResult.rem;
    else                          tickResult.rem = tickResult.rem.map(ent => 1);
    if (U.empty(tickResult.upd))  delete tickResult.upd;
    else                          tickResult.upd = tickResult.upd.map((fieldMap, uid) => this.entities[uid].serializePart(fieldMap));
    
    // Generate the "catchup" structure if needed
    let catchUp = U.empty(this.uninitializedClients) ? null : { add: this.entities.map(ent => ent.serializeFull()) };
    
    for (let [ uid, client ] of Object.entries(this.clients)) {
      // Decide if this client needs the latest update, or the full catchup data
      let updateData = this.uninitializedClients.hasOwnProperty(uid) ? catchUp : tickResult;
      if (updateData && !U.empty(updateData)) client.send({ type: 'update', update: updateData });
    }
    
    // Mark all clients as initialized
    this.uninitializedClients = {};
  },
  addEnforcer: function(enf) {
    this.enforcers.push(enf);
    enf.world = this;
    return enf;
  },
  getNextUid: function() {
    return this.nextUid++;
  },
})});

let secsPerZombieSpawn = 2000;
let angler = ({ changeAmt, turnAmt, maxTurnVel, ang=Math.random() * Math.PI * 2, turnVel=0 }) => {
  return () => {
    let ret = ang;
    turnVel = ((1 - changeAmt) * turnVel) + changeAmt * ((Math.random() - 0.5) * U.ROT_FULL * turnAmt);
    if (Math.abs(turnVel) > U.ROT_FULL * maxTurnVel) turnVel = Math.sign(turnVel) * U.ROT_FULL * maxTurnVel;
    ang += turnVel;
    return ret;
  };
};
let pointsAngler = ({ startPt=new CarteXY(0, 0), d=() => 0, changeAmt, turnAmt, maxTurnVel, ang, turnVel }) => {
  let lastPt = startPt;
  let pts = [ lastPt ];
  let pointAngler = angler({ changeAmt, turnAmt, maxTurnVel, ang, turnVel });
  return [
    () => {
      let turn = pointAngler();
      let nextPt = lastPt.add(new PolarXY(turn, d()));
      pts.push(nextPt);
      lastPt = nextPt;
      return [ turn, lastPt ];
    },
    pts
  ]
};
let residences = {
  house: s => [
    new FloorPlan(s * 1.1, s * 1.1, new CarteXY(0, 0), 0),
    new RectStructure(s * 1.0, s * 0.6, new CarteXY(s * 0, s * +0.2), 0),
    new RectStructure(s * 0.4, s * 1, new CarteXY(s * 0, s * 0), 0)
  ],
  squares: s => [
    new FloorPlan(s * 1.1, s * 1.1, new CarteXY(0, 0), 0),
    new RectStructure(s * 0.45, s * 0.45, new CarteXY(s * -0.275, s * -0.275), 0),
    new RectStructure(s * 0.45, s * 0.45, new CarteXY(s * +0.275, s * -0.275), 0),
    new RectStructure(s * 0.45, s * 0.45, new CarteXY(s * +0.275, s * +0.275), 0),
    new RectStructure(s * 0.20, s * 0.20, new CarteXY(s * -0.275, s * +0.275), 0)
  ]
};
let genStatic = () => {
  
  let residenceEntries = Object.values(residences);
  let ret = [];
    
  let [ mainRoadAngler, mainRoadPts ] = pointsAngler({
    startPt: new CarteXY(0, 0),
    d: () => U.randPrt(0.5) * 100,
    changeAmt: 0.4,
    turnAmt: 0.2,
    maxTurnVel: 0.025
  });
  for (let i = 0; i < 100; i++) {
    let [ turn, pt ] = mainRoadAngler();
    
    if (i === 0 || i % 5 !== 0) continue;
    // ret.push(new FloorPlan(130, 130, pt, 0));
    // continue;
    
    let [ offshootAngler, offshootPts ] = pointsAngler({
      startPt: pt,
      d: () => U.randPrt(0.3) * 70,
      changeAmt: 0.3,
      turnAmt: 0.2,
      maxTurnVel: 0.05,
      ang: turn + (U.randBln() ? U.ROT_CW1 : U.ROT_CCW1)
    });
    let [ turn0, pt0 ] = [ null, null ];
    let len = U.randInt(4, 7);
    for (let j = 0; j < len; j++) {
      [ turn0, pt0 ] = offshootAngler();
    }
    ret.push(new Road(30, offshootPts));
    
    let residence = residenceEntries[U.randInt(0, residenceEntries.length)](200);
    residence.forEach(c => {
      c.modF('loc', loc => XY.orbit(loc, XY.ORIGIN, turn0).add(pt0).add(new PolarXY(turn0, 200 * 0.5)));
      c.modF('rot', rot => rot + turn0);
      ret.push(c);
    });
    
  }
  
  ret.push(new Road(50, mainRoadPts));
  return ret;
  
};
(async () => {
  
  // NUM TILES ACROSS: 30: 13s, 100: 16s, 200: 18s, 300: 10s, 250: 11s, 150: 20s,
  // 175: 17s, 125: 17s, 160: 20s
  let rootZone = new TiledZone('root', new CarteXY(0, 0), 10000, 150); 
  let world = new ZombWorld({ rootZone });
  
  // ==== Unit formation
  let testFormation = world.addEntity(new Formation());
  
  // ==== Client manager
  let clientManager = world.addEntity(new ClientManager(testFormation));
  
  // ==== Zombie manager
  let zombieManager = world.addEntity(new ZombieManager(secsPerZombieSpawn, testFormation));
  
  // ==== Static geometry
  genStatic().forEach(s => world.addEntity(s));
  
  /*
  // Tuning-fork bunker kinda thing
  world.addEntity(new RectStructure(180, 300, new CarteXY(0, -170), U.ROT_U));
  world.addEntity(new RectStructure(40, 150, new CarteXY(-70, +20), U.ROT_CW1 / 3));
  world.addEntity(new RectStructure(40, 150, new CarteXY(+70, +20), U.ROT_CCW1 / 3));
  world.addEntity(new RectStructure(40, 150, new CarteXY(-36, +150), U.ROT_U));
  world.addEntity(new RectStructure(40, 150, new CarteXY(+36, +150), U.ROT_U));
  
  // Flanking angled rects
  world.addEntity(new RectStructure(150, 150, new CarteXY(-130, +350), U.ROT_CW1 / 4));
  world.addEntity(new RectStructure(150, 150, new CarteXY(+130, +350), U.ROT_CCW1 / 4));
  
  // Big SiloStructure
  world.addEntity(new SiloStructure(150, new CarteXY(0, +600), U.ROT_U));
  */
  
  // Test units
  let testUnit1 = world.addEntity(new Unit(8));
  testUnit1.bound.loc = new CarteXY(-130, +445);
  testUnit1.bound.rot = U.ROT_CCW1 / 2;
  testUnit1.mod('formation', { act: 'attach', formation: testFormation });
  
  let testUnit2 = world.addEntity(new Unit(8));
  testUnit2.bound.loc = new CarteXY(+130, +445);
  testUnit2.bound.rot = U.ROT_CW1 / 2;
  testUnit2.mod('formation', { act: 'attach', formation: testFormation });
  
  // Enforce physical entity separation
  let physicsEnforcer = world.addEnforcer(new PhysicsEnforcer(rootZone));
  
  // Server setup
  let httpServer = http.createServer(async (request, response) => {
    
    output(`HTTP: ${request.method} ${request.url}`);
    
    let method = request.method.toLowerCase();
    let url = request.url;
    
    try {
      
      if (method === 'get' && url === '/') {
        
        response.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(__dirname, 'client.html')).pipe(response);
        
      } else if (method === 'get' && url === '/config.js') {
        
        let clientConfig = {
          ...config,
          clientIp: request.socket.remoteAddress // This needs to correlate with the socket remoteAddress (it should!)
        };
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        response.end(`let config = global.CONFIG = ${JSON.stringify(clientConfig, null, 2)}`);
        
      } else if (method === 'get' && url === '/client.js') {
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(path.join(__dirname, 'client.js')).pipe(response);
        
      } else if (method === 'get' && url === '/common.js') {
        
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(path.join(__dirname, 'common.js')).pipe(response);
        
      } else if (method === 'get' && url === '/client.css') {
        
        response.writeHead(200, { 'Content-Type': 'text/css' });
        fs.createReadStream(path.join(__dirname, 'client.css')).pipe(response);
        
      } else if (method === 'get' && url === '/favicon') {
        
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('No favicon yet :(');
        
      } else if (method === 'get' && url.startsWith('/assets')) {
        
        let pcs = url.split('/');
        let lastPc = pcs[pcs.length - 1];
        
        if (!~lastPc.indexOf('.')) throw new Error(`Bad url: ${url}`);
        
        lastPc = lastPc.split('.');
        let ext = lastPc[lastPc.length - 1];
        
        let contentType = ({
          png: 'image/png',
          jpg: 'image/jpg',
          jpeg: 'image/jpg'
        })[ext];
        
        if (!contentType) throw new Error(`Bad asset extension: ${ext}`);
        
        response.writeHead(200, { 'Content-Type': contentType });
        
        let filepath = path.join(__dirname, ...pcs);
        fs.createReadStream(filepath).pipe(response);
        
      } else {
        
        throw new Error('bad request');
        
      }
      
      output(`served: ${method} ${url}`);
      
    } catch(err) {
      
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end(`dunno: ${method} ${url}`);
      output(`error: ${method} ${url} (${err.message})`);
      return;
      
    }
    
  });
  
  await Promise.all([
    clientManager.ready,
    new Promise(r => httpServer.listen(config.httpPort, config.hostname, r))
  ]);
  
  world.startUpdateInterval();
  
  output(`Ready: ${JSON.stringify(config, null, 2)}`);
  
})();
