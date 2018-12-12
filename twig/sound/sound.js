U.makeTwig({ name: 'sound', twigs: [ 'hinterlands', 'real' ], make: (sound, record, hinterlands, persona, real) => {
  
  sound.outline = () => {
  };
  sound.setupRealizer = () => {
  };
  sound.realizer = () => {
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
  
  // Util
  let randInt = (min, max) => min + Math.floor(Math.random() * (max - min));
  
  // Data util
  let audioBuffer2Sound = (audioBuffer, len=null) => {
    if (len === null) len = audioBuffer.length;
    let ret = [];
    for (let chn = 0; chn < audioBuffer.numberOfChannels; chn++) {
      let buff = new Float32Array(len);
      audioBuffer.copyFromChannel(buff, chn, 0);
      ret.push(buff);
    }
    return ret;
  };
  let sound2AudioBuffer = sound => {
    let ret = audioContext.createBuffer(sound.length, sound[0].length, audioContext.sampleRate);
    for (let chn = 0; chn < sound.length; chn++) {
      ret.copyToChannel(sound[chn], chn, 0);
    }
    return ret;
  };
  let soundSlice = (sound, offset, len) => {
    let ret = [];
    let endInd = offset + len;
    for (let i = 0; i < sound.length; i++) {
      let buff = new Float32Array(len);
      for (let buffInd = 0; buffInd < len; buffInd++) buff[buffInd] = sound[i][buffInd + offset];
      ret.push(buff);
    }
    return ret;
  };
  let combineSlices = slices => {
    let totalLen = A.reduce(slices, 0, (sound, sum) => sum + sound[0].length);
    let numChannels = slices[0].length;
    let ret = [];
    for (let chnInd = 0; chnInd < numChannels; chnInd++) {
      let buff = new Float32Array(totalLen);
      let buffInd = 0;
      for (let slcInd = 0; slcInd < slices.length; slcInd++) {
        let slc = slices[slcInd];
        for (let smpInd = 0; smpInd < slc[chnInd].length; smpInd++) {
          buff[buffInd++] = slc[chnInd][smpInd];
        }
      }
      ret.push(buff);
    }
    return ret;
  };
  let sinSound = (audioContext, freq, len, amp=1) => {
    
    let ret = [
      new Float32Array(len),
      new Float32Array(len)
    ];
    
    let mult = Math.PI * 2 * (freq / audioContext.sampleRate);
    
    for (let i = 0; i < len; i++) {
      
      let v = Math.sin(i * mult) * amp;
      ret[0][i] = v;
      ret[1][i] = v;
      
    }
    
    return ret;
    
  };
  let addSounds = (sounds, len=null) => {
    
    if (len === null) {
      len = Number.MAX_SAFE_INTEGER;
      for (let sndInd = 0; sndInd < sounds.length; sndInd++)
        if (sounds[sndInd][0].length < len) len = sounds[sndInd][0].length;
    }
    
    console.log('ADD:', len);
    
    let ret = [
      new Float32Array(len),
      new Float32Array(len)
    ];
    
    console.log('RET:', ret);
    
    for (let sndInd = 0; sndInd < sounds.length; sndInd++) {
      for (let chnInd = 0; chnInd < ret.length; chnInd++) {
        
        let retChn = ret[chnInd];
        let sndChn = sounds[sndInd][chnInd];
        
        for (let smpInd = 0; smpInd < len; smpInd++) {
          retChn[smpInd] += sndChn[smpInd];
        }
        
      }
    }
    
    return ret;
    
  };
  
  let smpDiff = (smp1, smp2) => {
    return Math.max(smp1, smp2) - Math.min(smp1, smp2);
  };
  let smpsAvg = samples => {
    
    let sum = 0;
    for (let i = 0, len = samples.length; i < len; i++) sum += samples[i];
    return sum / samples.length;
    
  };
  
  /*
  // Channel gradient generators:
  let energyGradient = samples => {
    let result = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      result[i] = samples[i] * samples[i];
    }
    return {
      gradient: result
    };
  };
  let freqGradient = (samples, freq) => {
    
    // TODO: Probably broken with non-integer `freq`
    // Some values in the return will be skipped due to floating point
    // rounding when converting non-integer to array index
    
    freq = freq >> 1; // TODO: Does this make sense?
    
    let phaseData = [];
    let highestOffset = -1;
    let highestValue = -1;
    let result = [];
    
    for (let offset = 0; offset < freq; offset++) {
      
      let dir = 1;
      let samplesPerStep = Math.floor((samples.length - offset) / freq);
      let avg = 0;
      
      for (let oscInd = offset; oscInd < samples.length; oscInd += freq) {
        let v = samples[Math.round(oscInd)];
        avg += v * dir;
        dir = -dir;
      }
      
      [ dir, avg ] = avg < 0 ? [ -1, -avg ] : [ 1, avg ];
      
      // Divide avg by the number of samples it contains; that's the intensity of `freq` at this phase offset!
      avg /= samplesPerStep;
      phaseData.push(avg);
      
      if (avg > highestValue) {
        highestValue = avg;
        highestOffset = offset;
      }
      
      for (let oscInd = offset; oscInd < samples.length; oscInd += freq) {
        
        let v = samples[Math.round(oscInd)];
        result[oscInd] = v * avg * dir; // Here's where floating-point `oscInd` would cause a problem
        dir = -dir;
        
      }
      
    }
    
    return {
      phaseIntensity: phaseData,
      highestValue,
      highestOffset,
      gradient: result
    };
    
  };
  */
  
  let playSound = (audioContext, sound) => {
    let audioBuff = sound2AudioBuffer(sound);
    let bufferNode = audioContext.createBufferSource();
    bufferNode.buffer = audioBuff;
    bufferNode.connect(audioContext.destination);
    bufferNode.start(0, 0);
  };
  
  let calcRoughness = (numSamples, samplesPrev, samplesNext) => {
    
    // Returns in the range of 0 - 1, where 0 indicates no cost
    // and 1 indicates maximum cost
    
    // Make sure `numSamples` isn't greater than either array of samples
    if (numSamples > samplesPrev.length) numSamples = samplesPrev.length;
    if (numSamples > samplesNext.length) numSamples = samplesNext.length;
    
    let minVal = 1;
    let maxVal = -1;
    for (let smpInd = 0; smpInd < numSamples; smpInd++) {
      
      let prevSmp = samplesPrev[samplesPrev.length - (1 + smpInd)];
      let nextSmp = samplesNext[smpInd];
      
      let smpGt = Math.max(prevSmp, nextSmp);
      let smpLe = Math.min(prevSmp, nextSmp);
      if (smpGt > maxVal) maxVal = smpGt;
      if (smpLe < minVal) minVal = smpLe;
      
    }
    
    let rangeMult = 1 / (maxVal - minVal);
    let roughness = 0;
    let importance = 1;
    let importanceSum = 0;
    for (let smpInd = 0; smpInd < numSamples; smpInd++) {
      
      let prevSmp = samplesPrev[samplesPrev.length - (1 + smpInd)];
      let nextSmp = samplesNext[smpInd];
      
      let diff = smpDiff(prevSmp, nextSmp);
      
      roughness += importance * diff;
      importanceSum += importance;
      importance *= 0.91; // TODO: pick a better value?
      
    }
    
    // Convert to importance-aware average
    return roughness /= importanceSum;
    
  };
  
  let Sound = U.makeClass({ name: 'Sound', inspiration: {}, methods: (insp, Cls) => ({
    
    init: function({ l=null, r=null, audioBuffer=null, sounds=null }) {
      
      if (audioBuffer) {
        l = new Float32Array(audioBuffer.length);
        r = new Float32Array(audioBuffer.length);
        audioBuffer.copyFromChannel(l, 0, 0);
        audioBuffer.copyFromChannel(r, 1, 0);
      } else if (sounds) {
        l = new Float32Array(A.reduce(sounds, 0, (sound, sum) => sum + sound.len));
        r = new Float32Array(l.length);
        let ind = 0;
        A.each(sounds, s => {
          for (let i = 0; i < s.len; i++) { l[ind] = s.l[i]; r[ind] = s.r[i]; ind++; }
        });
      }
      
      if (l || r) {
        if (!l) throw new Error('Missing "l"');
        if (!r) throw new Error('Missing "r"');
        if (l.length !== r.length) throw new Error('Mismatching channels');
      }
      
      this.l = l;
      this.r = r;
      this.len = l.length;
      
    },
    slice: function(offset, length) {
      
      return new Sound({
        l: this.l.slice(offset, offset + length),
        r: this.r.slice(offset, offset + length)
      });
      
    }
    
  })});
  
  let AudioSandbox = U.makeClass({ name: 'AudioSandbox', inspiration: {}, methods: (insp, Cls) => ({
    
    init: function({ audCtx, visCtx }) {
      
      this.audCtx = audCtx;
      this.sampleRate =  this.audCtx.sampleRate;
      this.invSampleRate = 1 / this.sampleRate;
      
      this.visCtx = visCtx;
      
      this.sounds = [];
      
    },
    secs2Smps: function(secs) { return secs * this.sampleRate; },
    smps2Secs: function(smps) { return smps * this.invSampleRate; },
    
    setSounds: function(sounds) { this.sounds = sounds; },
    soundToAudioBuffer: function(sound) {
      
      let ret = this.audCtx.createBuffer(2, sound.len, this.sampleRate);
      ret.copyToChannel(sound.l, 0, 0);
      ret.copyToChannel(sound.r, 1, 0);
      return ret;
      
    },
    
    sandboxSound: function() {
      
      let consistentSound = (sound, res=Math.pow(2, 11), thrsh=0.1) => {
        
        let offsetInc = res >> 2;
        let lengthInc = res >> 2;
        
        let buff = sound.l;
        
        let bestLength = 0;
        let bestOffset = 0;
        
        for (let offset = 0; offset < buff.length - res; offset += offsetInc) {
          
          let slice = buff.slice(offset, offset + res);
          let f1 = fourier(slice);
          
          let length = res;
          while (true) {
            
            if (offset + length + res > buff.length) break;
            
            let nextSlice = buff.slice(offset + length, offset + length + res);
            let f2 = fourier(nextSlice);
            if (fourierDiff(f1, f2) > thrsh) break;
            
            length += lengthInc;
            
          }
          
          if (length > bestLength) {
            bestLength = length;
            bestOffset = offset;
          }
          
        }
        
        return sound.slice(bestOffset, bestLength);
        
      };
      
      let num = 10;
      let analyzed = [];
      for (let i = 0; i < num; i++) {
        
        let sound = this.sounds[randInt(0, this.sounds.length)];
        
        // let len = Math.pow(2, 15);
        let len = randInt(this.secs2Smps(0.2), this.secs2Smps(0.5));
        
        let randSlice = sound.slice(randInt(0, sound.len - len), len);, 
        
        analyzed.push({
          sound: consistentSound(randSlice)
          // sound: sound.slice(randInt(0, sound.len - len), len)
        });
        
      }
      
      for (let i = 0; i < num; i++) {
        
        let l = analyzed[i].sound.l;
        let r = analyzed[i].sound.r;
        
        O.include(analyzed[i], {
          
        });
        
      }
      
      return new Sound({ sounds: shortSounds });
      
    },
    
    run: function() {
      
      let sound = this.sandboxSound();
      let audioBuff = this.soundToAudioBuffer(sound);
      let bufferNode = this.audCtx.createBufferSource();
      bufferNode.buffer = audioBuff;
      bufferNode.connect(this.audCtx.destination);
      bufferNode.start(0, 0);
      
    }
    
  })});
  
  /// {CLIENT=
  window.onload = () => {
    
    let canvas = document.createElement('canvas');
    let sandbox = AudioSandbox({ audCtx: new AudioContext(), visCtx: canvas.getContext('2d') });
    
    let audioContext = new AudioContext();
    let graphicsContext = null;
    
    let secs2Smps = secs => Math.round(secs * audioContext.sampleRate);
    
    let body = document.getElementsByTagName('body')[0];
    
    let scroll = body.appendChild(document.createElement('div'));
    scroll.setAttribute('style', 'overflow-x: scroll;');
    
    scroll.appendChild(canvas);
    canvas.setAttribute('width', '8000');
    canvas.setAttribute('height', '400');
    canvas.setAttribute('style', 'position: relative; left: 0; top: 0; display: inline-block;');
    
    let fileInput = body.appendChild(document.createElement('input'));
    fileInput.setAttribute('type', 'file');
    fileInput.setAttribute('multiple', 'multiple');
    fileInput.onchange = async e => {
      
      let sounds = await Promise.all(A.map(e.target.files, async file => {
        
        let reader = new FileReader();
        let encodedFilePromise = new Promise(resolve => { reader.onload = () => resolve(reader.result); });
        reader.readAsArrayBuffer(file);
        
        let encodedFile = await encodedFilePromise;
        let audioBuffer = await new Promise(resolve => audioContext.decodeAudioData(encodedFile, resolve));
        
        return Sound({ audioBuffer });
        
      }));
      console.log('Ready!');
      sandbox.setSounds(sounds);
      
      /*return;
      
      testSound = audioBuffer2Sound(audioBuffers[0]);
      
      console.log('Ready!');
      
      return;
      
      let mySound = audioBuffer2Sound(audioBuffers[0]);
      let mySlice = soundSlice(mySound, secs2Smps(10), secs2Smps(2));
      let bestVal = -1;
      let bestFreq = 0;
      for (let freq = 500; freq < 1500; freq++) {
        let v = freqGradient(mySlice[0], freq).highestValue;
        if (v > bestVal) { bestVal = v; bestFreq = freq; }
        if (!(freq % 100)) console.log(`Computed ${freq}`);
      }
      console.log(`BEST: ${bestVal} @ ${bestFreq}`);
      
      playSound(audioContext, mySlice);
      
      return;
      
      console.log('Generating raw format...');
      let sounds = A.map(audioBuffers, audioBuffer => audioBuffer2Sound(audioBuffer, audioContext.sampleRate * 50));
      
      console.log('Getting slices...');
      let slices = [];
      let numSlices = 200;
      // let minSliceLen = secs2Smps(0.10);
      // let maxSliceLen = secs2Smps(0.10);
      for (let sliceInd = 0; sliceInd < numSlices; sliceInd++) {
        let sound = sounds[randInt(0, sounds.length)];
        //let len = randInt(minSliceLen, maxSliceLen);
        let len = secs2Smps(0.4) * randInt(1, 5);
        let offset = randInt(0, sound[0].length - len);
        slices.push(soundSlice(sound, offset, len));
      }
      
      sounds = null; // Free memory!
      
      console.log('Analyzing slices...');
      let analyzedSlices = [];
      for (let sliceInd = 0; sliceInd < numSlices; sliceInd++) {
        
        let slice = slices[sliceInd];
        
        /*
        TODO: HEEERE!!!!
        Each slice should be analyzed according to its energy, beat, harmonics, etc.
        
        Harmonics should be analyzed with multiple applications of `freqGradient`
        
        Beat may just be harmonics over very long intervals??
        Or could consider quantizing while scaling towards zero, and finally chopping
        off all values below a certain tiny threshold to determine areas where beats
        occur
        
        Once all slices are analyzed they could be put into order by optimizing some
        measure of their closeness to the previous slice in the ordering. Instead of
        needing to meet some threshold, the "best" slice could be picked at every
        instant.
        
        The ideal ordering would involve knowing the cost of each slice before/after
        every other slice, and then maximizing the final order (which sounds like the
        travelling salesman problem)
        * /
        
        analyzedSlices.push({
          slice,
          character: {
            
          },
          harmonics: {
            
          }
        });
        
      }
      
      console.log('Beginning processing...');
      let considerations = {
        /*click: {
          importance: 0,
          gen: smps => smps, // Smooth over unprocessed waveforms
          cost: (smps1, smps2) => {
            let smp1 = smps1[smps1.length - 1];
            let smp2 = smps2[0];
            let minSmp = Math.min(smp1, smp2);
            let maxSmp = Math.max(smp1, smp2);
            return (maxSmp - minSmp) / 2;
          }
        },* /
        energy: {
          importance: 0.3,
          gen: smps => energyGradient(smps).gradient,
          cost: (smps1, smps2) => {
            
            let avg1 = 0;
            for (let si = 0; si < smps1.length; si++) avg1 += smps1[si];
            avg1 /= smps1.length;
            
            let avg2 = 0;
            for (let si = 0; si < smps2.length; si++) avg2 += smps2[si];
            avg2 /= smps2.length;
            
            let min = Math.min(avg1, avg2);
            let max = Math.max(avg1, avg2);
            
            // 30% of the consideration is total energy; 70% is connecting energy
            return ((max - min) * 0.3) + (calcRoughness(secs2Smps(0.05), smps1, smps2) * 0.7);
            
          }
        },
        freq60: {
          importance: 1,
          gen: smps => freqGradient(smps, secs2Smps(1 / 80)).gradient,
          cost: (smps1, smps2) => calcRoughness(secs2Smps(0.1), smps1, smps2)
        },
        freq120: {
          importance: 1,
          gen: smps => freqGradient(smps, secs2Smps(1 / 120)).gradient,
          cost: (smps1, smps2) => calcRoughness(secs2Smps(0.1), smps1, smps2)
        },
        freq440: {
          importance: 1,
          gen: smps => freqGradient(smps, secs2Smps(1 / 440)).gradient,
          cost: (smps1, smps2) => calcRoughness(secs2Smps(0.1), smps1, smps2)
        },
        freq523: {
          importance: 1,
          gen: smps => freqGradient(smps, secs2Smps(1 / 523)).gradient,
          cost: (smps1, smps2) => calcRoughness(secs2Smps(0.1), smps1, smps2)
        }
      };
      
      console.log(`Processing will consider: ${Object.keys(considerations).join(', ')}`);
      let sliceStream = [];
      let streamLen = 20;
      let numFails = 0;
      let maxFails = 1000;
      let costThreshold = 0.01;
      let totalImportance = O.reduce(considerations, 0, (cnsd, sum) => sum + cnsd.importance);
      while (sliceStream.length < streamLen && numFails < maxFails) {
        
        console.log(`Successes: ${sliceStream.length} / ${streamLen}, Failures: ${numFails} / ${maxFails}`);
        
        let prevSlice = sliceStream.length
          ? sliceStream[sliceStream.length - 1]
          : slices[randInt(0, slices.length)];
        let nextSlice = slices[randInt(0, slices.length)];
        
        let slicesCost = 0;
        let report = {};
        for (let cnsdName in considerations) {
          
          let totalSoundCost = 0;
          let cnsd = considerations[cnsdName];
          for (let chnInd = 0; chnInd < prevSlice.length; chnInd++) {
            
            let prevGradient = cnsd.gen(prevSlice[chnInd]);
            let nextGradient = cnsd.gen(nextSlice[chnInd]);
            let cost = cnsd.cost(prevGradient, nextGradient);
            
            totalSoundCost += cost * cnsd.importance
            
          }
          
          report[cnsdName] = totalSoundCost / (totalImportance * prevSlice.length);
          slicesCost += totalSoundCost;
          
        }
        
        // Normalize against potential unnormalized importance and number of channels
        slicesCost /= (totalImportance * prevSlice.length);
        
        if (slicesCost < costThreshold) {
          sliceStream.push(nextSlice);
        } else {
          numFails++;
          console.log('FAILED:', slicesCost, report);
        }
        
      }
      
      playSound(audioContext, combineSlices(sliceStream));
      
      let play = true;
      if (play) {
        
        let finalSound = combineSlices(sliceStream)
        let finalAudioBuffer = sound2AudioBuffer(finalSound);
        let bufferNode = audioContext.createBufferSource();
        bufferNode.buffer = finalAudioBuffer;
        bufferNode.connect(audioContext.destination);
        bufferNode.start(0, 0);
        
      }*/
      
    };
    
    /*
    let searchStart = body.appendChild(document.createElement('input'));
    searchStart.setAttribute('type', 'text');
    searchStart.setAttribute('placeholder', 'freq1');
    
    let searchEnd = body.appendChild(document.createElement('input'));
    searchEnd.setAttribute('type', 'text');
    searchEnd.setAttribute('placeholder', 'freq2');
    
    let offsetInput = body.appendChild(document.createElement('input'));
    offsetInput.setAttribute('type', 'text');
    offsetInput.setAttribute('placeholder', 'start');
    
    let lengthInput = body.appendChild(document.createElement('input'));
    lengthInput.setAttribute('type', 'text');
    lengthInput.setAttribute('placeholder', 'length');
    
    body.appendChild(document.createElement('br'));
    */
    
    let running = false;
    let playInput = body.appendChild(document.createElement('input'));
    playInput.setAttribute('type', 'button');
    playInput.setAttribute('value', 'Play');
    playInput.onclick = () => {
      
      sandbox.run();
      return;
      
      if (running) return;
      running = true;
      
      let freq1 = parseInt(searchStart.value);
      let freq2 = parseInt(searchEnd.value);
      
      let offset = parseFloat(offsetInput.value);
      let length = parseFloat(lengthInput.value);
      
      let mySlice = soundSlice(testSound, secs2Smps(offset), secs2Smps(length));
      // playSound(audioContext, mySlice);
      
      let thresh = 0.15;
      let goods = [];
      let bestVal = -1;
      let bestFreq = 0;
      for (let freq = freq1; freq < freq2; freq++) {
        let v = freqGradient(mySlice[0], freq).highestValue;
        if (v > bestVal) { bestVal = v; bestFreq = freq; }
        if (v > thresh) { goods.push(freq); }
        if (!(freq % 100)) console.log(`Computed ${freq}`);
      }
      console.log(`BEST: ${bestVal} @ ${bestFreq}; ${goods.length} important freqs`);
      console.log('GOODS:', goods);
      
      let amp = 0.8 / goods.length;
      
      let bestSin = sinSound(audioContext, bestFreq, secs2Smps(1), 0.3);
      let sins = A.map(goods, freq => sinSound(audioContext, freq, secs2Smps(1), amp));
      let sinStack = addSounds(sins);
      
      console.log(sinStack);
      
      let silence = sinSound(audioContext, bestFreq, secs2Smps(0.5), 0);
      
      playSound(audioContext, combineSlices([ mySlice, silence, bestSin, silence, sinStack ]));
      
      running = false;
      
    };
    
    O.include(window, {
      sandbox
    });
    
  };
  /// =CLIENT}
  
}});

