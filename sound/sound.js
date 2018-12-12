let Brain = U.inspire({ name: 'Brain', methods: (insp, Insp) => ({
  $sigmoid0: v => 1 / (1 + Math.exp(-v)),
  $sigmoid1: (v, v0=Brain.sigmoid0(v)) => v0 * (1 - v0),
  $meanSqr0: (src, trg) => { let d = src - trg; return d * d; },
  $meanSqr1: (src, trg) => src - trg,
  $reproduce: (pars, rnd=0) => {
    
    let child = new Brain({
      sizes: pars[0].sizes,
      inputValues: pars[0].inputValues,
      rubric0: pars[0].rubric0,
      rubric1: pars[0].rubric1,
      smoothing0: pars[0].smoothing0,
      smoothing1: pars[0].smoothing1,
      initB: () => 0,
      initW: () => 0
    });
    
    for (let lInd = 0; lInd < child.size; lInd++) {
      
      let adds = child.adds[lInd];
      for (let aInd = 0; aInd < adds.length; aInd++) {
        child.adds[lInd][aInd] = (Math.random() > rnd)
          ? pars[Math.floor(Math.random() * pars.length)].adds[lInd][aInd]
          : Math.random();
      }
      
      let muls = child.muls[lInd];
      for (let mInd = 0; mInd < muls.length; mInd++) {
        child.adds[lInd][mInd] = (Math.random() > rnd)
          ? pars[Math.floor(Math.random() * pars.length)].muls[lInd][mInd]
          : Math.random();
      }
      
    }
    
    return child;
    
  },
  
  init: function({ sizes, inputValues=v=>v, rubric0=null, rubric1=null, smoothing0=Brain.sigmoid0, smoothing1=Brain.sigmoid1, initB=Math.random, initW=Math.random }) {
    
    /*
    With `layers=[4, 5, 3]`:
    
    layer 0:
      adds: [ 0, 0, 0, 0 ] // Filled but not used
      muls: []
    layer 1:
      adds: [ 0, 0, 0, 0, 0 ]
      muls: [
        0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 1st node of layer 2
        0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 2nd node of layer 2
        0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 3rd node of layer 2
        0, 0, 0, 0, // For nodes in the 1st layer 1-4, values connecting them to the 4th node of layer 2
        0, 0, 0, 0  // For nodes in the 1st layer 1-4, values connecting them to the 5th node of layer 2
      ]
    layer 2:
      adds: [ 0, 0, 0 ]
      muls: [
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      ]
    */
    
    if (!rubric0) throw new Error('Missing rubric0');
    if (!rubric1) throw new Error('Missing rubric1');
    
    this.inputValues = inputValues;
    this.rubric0 = rubric0;
    this.rubric1 = rubric1;
    
    this.smoothing0 = smoothing0;
    this.smoothing1 = smoothing1;
    
    this.sizes = sizes;
    this.size = sizes.length;
    this.adds = new Array(this.size);
    this.muls = new Array(this.size);
    for (let lInd = 0; lInd < this.size; lInd++) {
      let [ s0, sP ] = [ sizes[lInd], lInd ? sizes[lInd - 1] : 0 ];
      let [ add, mul ] = [ [], [] ];
      this.adds[lInd] = add;
      this.muls[lInd] = mul;
      
      for (let ind0 = 0; ind0 < s0; ind0++) {
        add[ind0] = initB(lInd, ind0);
        for (let indP = 0; indP < sP; indP++) mul[indP + ind0 * sP] = initW(lInd, ind0, indP);
      }
    }
    
  },
  opinion: function(inp) {
    
    // Returns two lists:
    // 1) The list of activation values for each layer
    // 2) The list of activation values before `act0` is applied for each layer
    
    inp = this.inputValues(inp);
    if (inp.length !== this.sizes[0]) throw new Error(`Incorrect number of inputs!`);
    
    let result = null;
    let resultsZ = new Array(this.size);
    let resultsX = new Array(this.size);
    for (let lInd = 0; lInd < this.size; lInd++) {
      
      if (!result) {
        
        result = inp;
        
      } else {
        
        let [ sP, s0 ] = [ this.sizes[lInd - 1], this.sizes[lInd] ];
        let [ fwdAdds, fwdMuls ] = [ this.adds[lInd], this.muls[lInd] ];
        let resultP = result;
        
        result = new Array(s0);
        for (let ind0 = 0; ind0 < s0; ind0++) {
          let sum = 0;
          for (let indP = 0; indP < sP; indP++) sum += fwdMuls[indP + ind0 * sP] * resultP[indP];
          result[ind0] = sum + fwdAdds[ind0];
        }
        
      }
      
      // Collect unsmoothed, then do smoothing, then collect smoothed
      resultsZ[lInd] = result;
      result = result.map(this.smoothing0); // Skip smoothing for input layer
      resultsX[lInd] = result;
      
    }
    
    return [ resultsZ, resultsX, result ];
    
  },
  reflect: function(inp, opinion=this.opinion(inp)[2]) {
    let errorVec = this.rubric0(inp, opinion);
    let sqrSum = 0;
    errorVec.forEach(v => sqrSum += v);
    return sqrSum / errorVec.length;
  },
  calcGradient: function(inp, [ zs, xs ]) {
    
    // Based on fed-forward x and z vals for each layer, calculate the error gradient
    // for all adds+muls at each layer
    
    let s = this.size;
    let smoothing1 = this.smoothing1;
    
    let [ addGrads, mulGrads, backPass ] = [ new Array(this.size), new Array(this.size), null ];
    for (let lInd = this.size - 1; lInd >= 1; lInd--) {
      
      // Get references to the layer size, unsmoothed layer error, and layer error
      // Do this for the previous layer (P), current layer (0), and next layer (N)
      let [ sP, s0, sN ] = this.sizes.slice(lInd - 1, lInd + 2);
      let [ zP, z0, zN ] = zs.slice(lInd - 1, lInd + 2);
      let [ xP, x0, xN ] = xs.slice(lInd - 1, lInd + 2);
      
      // Now calculate the error gradient for this layer (`backPass`)...
      
      if (!backPass) {
        
        // Initial value based on rubric gradient
        backPass = this.rubric1(inp, x0).map((v, i) => v * smoothing1(z0[i], x0[i]));
        
      } else {
        
        // Move the error gradient `backPass` back to the previous layer
        let fwdActivation = backPass;       // sN x 1
        let fwdMuls = this.muls[lInd + 1];  // s0 x sN
        
        // For each node in the current layer calculate the weighted error based on the next layer's error
        backPass = new Array(s0);
        for (let ind0 = 0; ind0 < s0; ind0++) {
          let sum = 0;
          for (let indN = 0; indN < sN; indN++) sum += fwdMuls[ind0 + indN * s0] * fwdActivation[indN];
          backPass[ind0] = sum * smoothing1(z0[ind0], x0[ind0]); // Unapply the smoothing function
        }
        
      }
      
      // `backPass` has moved back from `lInd + 1` and is the error gradient at layer `lInd`
      // Now need to store add and mul gradients based on `backPass`
      
      // `backPass` is already exactly the add gradient!
      addGrads[lInd] = backPass;
      
      // The resulting mul gradient ought to be sP x s0
      // `backPass` -> s0 x 1
      // `xP`       -> sP x 1
      let mulGrad = new Array(sP * s0);
      for (let indP = 0; indP < sP; indP++) { for (let ind0 = 0; ind0 < s0; ind0++) {
        mulGrad[indP + ind0 * sP] = xP[indP] * backPass[ind0];
      }}
      mulGrads[lInd] = mulGrad;
      
    }
    
    return [ addGrads, mulGrads ];
    
  },
  study: function(inp, amt) {
    this.refine(this.calcGradient(inp, this.opinion(inp)), amt);
  },
  refine: function([ addGrads, mulGrads ], amt) {
    // Update values according to the provided gradients
    for (let lInd = 1; lInd < this.size; lInd++) {
      let [ adds, muls ] = [ this.adds[lInd], this.muls[lInd] ];
      let [ aGrad, mGrad ] = [ addGrads[lInd], mulGrads[lInd] ];
      for (let aInd = 0; aInd < adds.length; aInd++) adds[aInd] -= amt * aGrad[aInd];
      for (let mInd = 0; mInd < muls.length; mInd++) muls[mInd] -= amt * mGrad[mInd];
    }
  }
})});
let Soundscape = U.inspire({ name: 'Soundscape', methods: (insp, Insp) => ({
  init: function() {
    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;
    this.invSampleRate = 1 / this.sampleRate;
  },
  buff2Audio: async function(buff) {
    return new Promise(r => { this.audioContext.decodeAudioData(buff, r); });
  },
  smps2Secs: function(smps) { return smps / this.invSampleRate; },
  secs2Smps: function(secs) { return Math.round(secs * this.sampleRate); },
  // For streaming: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource
  playSound: function(sound) {
    let audioBuff = sound.toAudioBuffer();
    let bufferNode = this.audioContext.createBufferSource();
    bufferNode.buffer = audioBuff;
    bufferNode.connect(this.audioContext.destination);
    bufferNode.start(0, 0);
  },
  playDataBuff: function(dataBuff) {
    this.playSound(Sound({ scape: this, l: dataBuff, r: dataBuff }));
  }
})});
let Sound = U.inspire({ name: 'Sound', methods: (insp, Insp) => ({
  init: function({ scape, name=null, l=null, r=null, audioBuffer=null }) {
    
    if (audioBuffer) {
      if (l || r) throw new Error('Can\'t provide "audioBuffer" along with "l" or "r"');
      l = new Float32Array(audioBuffer.length);
      r = new Float32Array(audioBuffer.length);
      audioBuffer.copyFromChannel(l, 0, 0);
      audioBuffer.copyFromChannel(r, 1, 0);
    }
    
    if (l || r) {
      if (!l) throw new Error('Missing "l"');
      if (!r) throw new Error('Missing "r"');
      if (l.length !== r.length) throw new Error('Mismatching channels');
    }
    
    this.scape = scape;
    this.name = name;
    this.l = l;
    this.r = r;
    this.len = l.length;
    
  },
  toMono: function(side='l') {
    if (side !== 'l' && side !== 'r') throw new Error(`Invalid side: "${side}"`);
    let channel = this[side];
    return new Sound({ scape: this.scape, name: this.name, l: channel, r: channel });
  },
  toAudioBuffer: function() {
    let ret = this.scape.audioContext.createBuffer(2, this.l.length, this.scape.sampleRate);
    ret.copyToChannel(this.l, 0, 0);
    ret.copyToChannel(this.r, 1, 0);
    return ret;
  },
  slice: function(offset, length) {
    return new Sound({
      l: this.l.slice(offset, offset + length),
      r: this.r.slice(offset, offset + length)
    });
  }
})});

let dom = {
  toArr: elems => { let ret = []; for (let i = 0, len = elems.length; i < len; i++) ret.push(elems[i]); return ret; },
  id: id => document.getElementById(id),
  cls: cls => dom.toArr(document.getElementsByClassName(cls)),
  cls1: cls => document.getElementsByClassName(cls)[0],
  div: (id=null) => dom.elem('div', id),
  elem: (type, id=null) => { let ret = document.createElement(type); if (id) ret.id = id; return ret; }
};
  
let butterfly = (k1, reps) =>{
  
  let k2 = 0;
  let k3 = 0;
  
  for (let i = 0; i < reps; i++) {
    
    k3 = k1 >> 1;
    k2 = 2 * (k2 - k3) + k1;
    k1 = k3;
    
  }
  
  return k2;
  
};
let fourier = rBuff => {
  
  let iBuff = new Float32Array(rBuff.length);
  
  let len = rBuff.length;
  let hLen = len >> 1;
  let pow = Math.log2(len);
  let rotSpd = (Math.PI * 2) / len;
  
  for (let ascExp = 0; ascExp < pow; ascExp++) {
    
    let dscExp = pow - ascExp - 1;
    let powDsc = Math.pow(2, dscExp);
    let powAsc = Math.pow(2, ascExp);
    let smpInd = 0;
    
    for (let i = 0; i < powAsc; i++) {
      
      let k2 = butterfly(smpInd >> dscExp, pow);
      let y1 = +Math.cos(rotSpd * k2);
      let y2 = -Math.sin(rotSpd * k2);
      
      // Adds `1 * powDsc` to `smpInd`
      for (let j = 0; j < powDsc; j++) {
        
        let ahdInd = smpInd + powDsc;
        
        y3 = rBuff[ahdInd] * y1 - iBuff[ahdInd] * y2;
        y4 = rBuff[ahdInd] * y2 + iBuff[ahdInd] * y1;
        
        rBuff[ahdInd] = rBuff[smpInd] - y3;
        iBuff[ahdInd] = iBuff[smpInd] - y4
        rBuff[smpInd] = rBuff[smpInd] + y3;
        iBuff[smpInd] = iBuff[smpInd] + y4;
        
        smpInd++;
        
      }
      
      // Adds `powDsc * 1` to `smpInd`
      smpInd += powDsc;
      
    }
    
  }
  
  // Apply butterfly to samples
  for (let i = 0; i < len; i++) {
    let k2 = butterfly(i, pow);
    if (k2 >= i || k2 >= hLen) continue; // Don't bother
    [ rBuff[i], rBuff[k2] ] = [ rBuff[k2], rBuff[i] ];
    [ iBuff[i], iBuff[k2] ] = [ iBuff[k2], iBuff[i] ];
  }
  
  // Take the magnitude of all imaginary vectors (only the 1st 1/2 of the buff is meaningful!)
  for (let i = 0; i < hLen; i++) {
    rBuff[i] = Math.sqrt((rBuff[i] * rBuff[i] + iBuff[i] * iBuff[i])) * 2 / len;
  }
  
  return rBuff; // Only the first rBuff.length >> 1 samples are correct
  
};
let fourierDiff = (f1, f2) => {
  
  let big = f1;
  let sml = f2;
  if (bg.length < small.length) { big = f2; sml = f1; }
  
  let mult = big.length / sml.length;
  let sum = 0;
  for (let i = 0; i < sml.length; i++) {
    let smp1 = sml[0];
    let smp2 = big[Math.floor(i * mult)];
    sum += Math.max(smp1, smp2) - Math.min(smp1, smp2);
  }
  
  return sum / sml.length;
  
};

(async () => {
  
  let soundscape = new Soundscape();
  
  await new Promise(r => { window.onload = r });
  
  let body = document.body;
  
  let uploadWrp0 = body.appendChild(dom.elem('div', 'uploadWrp0'));
  let uploader = uploadWrp0.appendChild(dom.elem('input'), 'uploader');
  uploader.setAttribute('type', 'file');
  uploader.setAttribute('multiple', 'multiple');
  
  let learn = body.appendChild(dom.elem('div', 'learnWrp0'));
  let learnLatency = learn.appendChild(dom.elem('div', 'learnLatency'));
  let learnNumTests = learn.appendChild(dom.elem('div', 'learnNumTests'));
  let learnNumReproductions = learn.appendChild(dom.elem('div', 'learnNumReproductions'));
  // let accuracy = learn.appendChild(dom.elem('div', 'accuracy'));
  let learnCost = learn.appendChild(dom.elem('div', 'learnCost'));
  let learnCostBar = learnCost.appendChild(dom.elem('div', 'learnCostBar'));
  
  let audio = body.appendChild(dom.elem('div', 'audio'));
  let audioPlay = audio.appendChild(dom.elem('div', 'audioPlay'));
  audioPlay.innerHTML = 'PLAY';
  
  let files = await new Promise(r => { uploader.onchange = e => r(Array.from(e.target.files)); });
  
  let numSmpsConsidered = 50; // Math.floor(soundscape.sampleRate / 80); // Accept enough samples to process 80hz
  
  let sounds = await Promise.all(files.map(async file => {
    let reader = new FileReader();
    let readPromise = new Promise(r => { reader.onload = () => r(reader.result); });
    reader.readAsArrayBuffer(file);
    let buff = await readPromise;
    let audioBuffer = await soundscape.buff2Audio(buff);
    return new Sound({ scape: soundscape, name: file.name, audioBuffer }).toMono();
  }));
  let normSmp = smp => 0.5 + smp * 0.5;
  let genTest = () => {
    let correctInd = Math.floor(Math.random() * sounds.length);
    let testSound = sounds[correctInd];
    
    // Insert `numSmpsConsidered` samples as data
    let question = new Array(numSmpsConsidered);
    let smpOff = Math.floor(Math.random() * (testSound.len - numSmpsConsidered - 1));
    for (let smpCnt = 0; smpCnt < numSmpsConsidered; smpCnt++) question[smpCnt] = normSmp(testSound.l[smpOff + smpCnt]);
    
    // // Insert the next sample from `testSound`, and random samples from other sounds
    // for (let sndInd = 0; sndInd < sounds.length; sndInd++) {
    //   let sound = sounds[sndInd];
    //   question[numSmpsConsidered + sndInd] = (sound === testSound)
    //     ? normSmp(sound.l[smpOff + numSmpsConsidered])
    //     : normSmp(sound.l[Math.floor(Math.random() * sound.len)]);
    // }
    // 
    // // The answers is all 0, except a 1 for the correct answer
    // let answer = Array.fill(sounds.length, i => i === correctInd ? 1 : 0);
    
    let answer = normSmp(testSound.l[smpOff + numSmpsConsidered]);
    return { question, answer, correctInd };
  };
  
  let genAudioWidget = (numSmps, sound, getComposer) => {
    
    console.log(sound.name);
    
    let buff = sound.l;
    let offset = 0;
    let endSelection = numSmpsConsidered;
    
    let opinion = null;
    
    let ret = dom.elem('div');
    ret.classList.add('audioWidget');
    ret.classList.add(`size${numSmps}`);
    
    let smps = ret.appendChild(dom.elem('div'));
    smps.classList.add('smps');
    
    let remOpinion = () => {
      if (opinion) {
        opinion.removeChild(opinion.getElementsByClassName('opn')[0]);
        opinion.classList.remove('opinion');
        opinion = null;
      }
    };
    let onClickSmp = (smp, evt) => {
      console.log('SMP:', smp);
      console.log('EVT:', evt);
      let ind = offset + smp['~ind'];
      
      remOpinion();
      
      if (ind < numSmpsConsidered) return; // Not enough samples
      
      opinion = smp;
      
      let opnVal = getComposer().opinion({ question: buff.slice(ind - numSmpsConsidered, ind).map(v => normSmp(v)) })[2];
      
      let opn = smp.appendChild(dom.elem('div'));
      console.log('OPNVAL:', opnVal);
      opn.classList.add('opn');
      opn.style.top = `${opnVal[0] * 100}%`;
      
      smp.classList.add('opinion');
      
    };
    
    for (let i = 0; i < numSmps; i++) {
      let smp = smps.appendChild(dom.elem('div'));
      smp['~ind'] = i;
      smp.classList.add('smp');
      smp.classList.add(`smp${i}`);
      smp.addEventListener('click', onClickSmp.bind(null, smp));
      
      let amt = smp.appendChild(dom.elem('div'));
      amt.classList.add('amt');
    }
    
    let cnt = ret.appendChild(dom.elem('div'));
    cnt.classList.add('cnt');
    
    let scr = cnt.appendChild(dom.elem('div'));
    scr.classList.add('scr');
    
    let doScroll = evt => {
      remOpinion();
      
      let { width } = cnt.getBoundingClientRect();
      let { offsetX } = evt;
      
      let perc = offsetX / width;
      offset = Math.floor(perc * (buff.length - numSmpsConsidered));
      
      for (let i = 0; i < numSmps; i++) smps.children[i].children[0].style.top = `${50 + buff[offset + i] * 50}%`;
      
      scr.style.left = `${perc * 100}%`;
    };
    
    doScroll({ offsetX: 0 });
    
    let mouse = 'u';
    cnt.addEventListener('mouseout', () => { mouse = 'u'; });
    cnt.addEventListener('mousedown', evt => { mouse = 'd'; doScroll(evt); evt.preventDefault(); evt.stopPropagation(); });
    cnt.addEventListener('mouseup', evt => { mouse = 'u'; evt.preventDefault(); evt.stopPropagation(); });
    cnt.addEventListener('mousemove', evt => mouse === 'd' ? doScroll(evt) : null);
    
    return ret;
  };
  
  let countFrames = 0;
  let framesPerReproduce = 600;
  let countReproductions = 0;
  let countTests = 0;
  
  let numComposers = 10;
  let numGoodComposers = 3;
  let numComposersToKeep = 2;
  let studiesPerFrame = 5;
  let learnRate = 0.01;
  
  let right = 0;
  let total = 0;
  
  let composerContests = Array.fill(numComposers, () => ({
    cost: 1,
    attempts: 0,
    corrects: 0,
    composer: Brain({
      sizes: [ numSmpsConsidered, 20, 10, 1 ],
      rubric0: (inp, out) => [ Math.abs(out[0] - inp.answer) /* Brain.meanSqr0(out[0], inp.answer)*/ ], // inp.answer.map((v, i) => Brain.meanSqr0(out[i], v)),
      rubric1: (inp, out) => [ Brain.meanSqr1(out[0], inp.answer) ], // inp.answer.map((v, i) => Brain.meanSqr1(out[i], v)),
      inputValues: v => v.question
    })
  }));
  
  audio.appendChild(genAudioWidget(100, sounds[1], () => composerContests[0].composer));
  
  let reproduce = () => {
    
    // Create new composers from the best of the current composers
    
    composerContests.sort((cc1, cc2) => cc1.cost - cc2.cost);
    
    // Keep the leading composers
    let goodComposers = composerContests.slice(0, numGoodComposers).map(cc => cc.composer);
    let numBadComposers = numComposers - numGoodComposers;
    
    // Replace all "bad" composers
    for (let i = 0; i < numBadComposers; i++) {
      composerContests[numGoodComposers + i] = {
        composer: Brain.reproduce(goodComposers, (i / numBadComposers) * 0.8) // Varying degrees of randomness
      };
    }
    
    // Reset stats on all contests
    composerContests.forEach(cc => {
      cc.cost = 1;
      cc.attempts = 0;
      cc.corrects = 0;
    });
    
  };
  
  let improve = () => {
    
    // Allow all composers to backpropagate and get better
    
    // These tests will be used for each composer
    let tests = Array.fill(studiesPerFrame, genTest);
    
    composerContests.forEach(cc => {
      
      let { composer } = cc;
      
      // Each composer studies all tests
      tests.forEach(t => composer.study(t, learnRate));
      
      let cost = tests.reduce((m, t) => {
        let opinion = composer.opinion(t)[2];
        let [ bestInd, bestVal ] = [ null, Number.MIN_SAFE_INTEGER ];
        for (let j = 0; j < opinion.length; j++) if (opinion[j] > bestVal) [ bestInd, bestVal ] = [ j, opinion[j] ];
        return m + composer.reflect(t, opinion);
      }, 0);
      
      cc.cost = cc.cost * 0.92 + (cost / studiesPerFrame) * 0.08;
      
    });
    
  };
  
  let testFrame = () => {
    
    let time = +new Date();
    
    if (countFrames >= framesPerReproduce) {
      countFrames = 0;
      countReproductions++;
      reproduce();
    } else {
      countFrames++;
      countTests += studiesPerFrame;
      improve();
    }
    
    let elapsed = new Date() - time;
    
    let cc0 = composerContests[0];
    let bestCost = composerContests[0].cost;
    learnNumReproductions.innerHTML = `Reproductions: ${countReproductions}`;
    learnLatency.innerHTML = `Time: ${elapsed}ms`;
    learnNumTests.innerHTML = `Tests: ${countTests}`;
    // accuracy.innerHTML = `Accuracy: ${((cc0.corrects / cc0.attempts) * 100).toFixed(3)}%`;
    learnCostBar.innerHTML = `Cost: ${cc0.cost.toFixed(5)}`;
    learnCostBar.style.width = `${cc0.cost * 100}%`;
    
    requestAnimationFrame(testFrame);
  };
  requestAnimationFrame(testFrame);
  
  audioPlay.addEventListener('mousedown', evt => {
    
    let time = +new Date();
    let { composer } = composerContests[0];
    
    for (let i = 0; i < 10; i++) {
      
      let question = Array.fill(numSmpsConsidered, i0 => normSmp(Math.sin((i0 * i * 100) / soundscape.sampleRate)));
      console.log(question.slice(0, 10).map(v => v.toFixed(3)));
      let opinion = composer.opinion({ question })[2];
      console.log(opinion);
      
    }
    
    return;
    
    
    let numSmps = soundscape.secs2Smps(10);
    
    let dataBuff = new Float32Array(numSmps);
    let off = 0;
    
    let curSound = sounds[Math.floor(Math.random() * sounds.length)];
    console.log(curSound.name);
    for (; off < numSmpsConsidered; off++) dataBuff[off] = normSmp(curSound.l[off]);
    
    console.log(dataBuff);
    
    for (; off < numSmps; off++) {
      let question = curSound.l.slice(off - numSmpsConsidered, off);
      if (Math.random() < 0.00001) console.log('Q:', question[0], question);
      // if (Math.random() < 0.0001) console.log(`OFF: ${off}, SMP: ${dataBuff[off - numSmpsConsidered]}`); // console.log(off - numSmpsConsidered, off, question[0]);
      //let question = new Array(numSmpsConsidered);
      // for (let i = 0; i < numSmpsConsidered; i++) question[i] = dataBuff[off - (numSmpsConsidered - i)];
      let nextSmp = composer.opinion({ question })[2];
      if (Math.random() < 0.0001) console.log('A:', nextSmp);
      dataBuff[off] = nextSmp[0];
    }
    
    /*
    let { composer } = composerContests[0]; // Pick the best composer
    
    let noise = 0;
    let invNoise = 1 - noise;
    let numSmps = soundscape.sampleRate * 10; // 10 seconds
    
    let dataBuff = new Float32Array(numSmps);
    
    // Start at the beginning of a random sound
    let runningOffset = 0;
    let runningSound = sounds[Math.floor(Math.random() * sounds.length)];
    
    let streaks = { 0: runningSound.name };
    let indCount = Array.fill(sounds.length, () => 0);
    
    for (let trgSmpInd = 0; trgSmpInd < numSmps; trgSmpInd++) {
      
      // The beginning of `dataBuff` is filled directly from the initial sound
      if (trgSmpInd < numSmpsConsidered) {
        dataBuff[trgSmpInd] = runningSound.l[trgSmpInd];
        runningOffset++; // Points to the next sample which hasn't been picked yet
        continue;
      }
      
      // The index of the sample which will be considered for all sounds at this point
      let soundOffsets = sounds.map(sound => {
        return (sound !== runningSound || runningOffset >= runningSound.len)
          ? Math.floor(Math.random() * sound.len)
          : runningOffset;
      });
      
      let fullTest = new Array(numSmpsConsidered + sounds.length);
      
      // Include data from `trgSmpInd - numSmpsConsidered` until now
      for (let j = 0; j < numSmpsConsidered; j++) fullTest[j] = normSmp(dataBuff[trgSmpInd - (numSmpsConsidered - j)]);
      
      // Include the next sample from each sound
      for (let j = 0; j < sounds.length; j++) {
        let sndSmp = sounds[j].l[soundOffsets[j]];
        let noiseSmp = (1 - Math.random() * 2);
        fullTest[numSmpsConsidered + j] = normSmp(invNoise * sndSmp + noise * noiseSmp);
      }
      
      let pick = composer.opinion({ question: fullTest })[2];
      
      let [ bestInd, bestVal ] = [ null, Number.MIN_SAFE_INTEGER ];
      for (let j = 0; j < pick.length; j++) {
        if (pick[j] > bestVal) [ bestInd, bestVal ] = [ j, pick[j] ];
      }
      
      if (bestInd === null || isNaN(bestInd) || bestInd < 0 || bestInd >= sounds.length) throw new Error(`BAD BESTIND: ${bestInd}`);
      
      let pickedSound = sounds[bestInd];
      let pickedOffset = soundOffsets[bestInd];
      let pickedSmp = pickedSound.l[pickedOffset];
      
      dataBuff[trgSmpInd] = pickedSmp;
      
      if (pickedSound !== runningSound) {
        console.log(`Ended ${runningSound.name}; beginning ${pickedSound.name}`);
        streaks[trgSmpInd] = pickedSound.name;
      }
      
      indCount[bestInd]++;
      
      runningSound = pickedSound;
      runningOffset = pickedOffset + 1;
      
    }
    
    console.log(`Built sound in ${new Date() - time}ms`);
    console.log('STREAKS:', streaks);
    console.log('INDCOUNT:', indCount.map((v, i) => `${sounds[i].name}: ${v}`));
    
    console.log('SOUND:', sound);
    */
    
    // Denormalize
    for (let i = 0; i < dataBuff.length; i++) dataBuff[i] = (dataBuff[i] - 0.5) * 2;
    
    console.log(`Completed in ${new Date() - time}ms`);
    
    let sound = new Sound({ scape: soundscape, l: dataBuff, r: dataBuff });
    soundscape.playSound(sound);
  });
  
})();
