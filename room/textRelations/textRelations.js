U.buildRoom({
  name: 'textRelations',
  innerRooms: [],
  build: (foundation) => ({ open: async () => {
    
    let format = (args, defs) => {
      
      // Formats `args`, which is expected to be an Object mapping
      // String -> String, to conform with `defs`.
      
      let result = {};
      let relsToApply = [];
      for (let { name, type, def=null } of defs) {
        
        if (args.has(name)) {
          
          result[name] = ({
            int: () => parseInt(args[name]),
            flt: () => parseFloat(args[name]),
            str: () => args[name]
          })[type]();
          
        } else if (def === null) {
          
          throw new Error(`Missing "${name}" param`);
          
        } else if (!U.isType(def, Function)) {
          
          result[name] = def;
          
        } else {
          
          result[name] = null;
          relsToApply.push(() => result[name] = def(result));
          
        }
        
      }
      
      for (let rel of relsToApply) rel();
      
      return result;
      
    };
    
    let args = format(foundation.raiseArgs, [
      { name: 'path',       type: 'str' },
      { name: 'pSize',      type: 'int', def: 80 },
      { name: 'pStep',      type: 'int', def: args => args.pSize >> 1 },
      { name: 'corrLen',    type: 'int', def: 5000 },
      { name: 'reps',       type: 'int', def: 300 },
      { name: 'delayMs',    type: 'int', def: 0 },
      { name: 'resultLen',  type: 'int', def: 10 },
      { name: 'printEvery', type: 'int', def: 20 }
    ]);
    
    if (!args.path) throw new Error('Missing "path"');
    console.log(`ARGS:\n${JSON.stringify(args, null, 2)}`);
    
    let sentences = (await foundation.getSaved([ args.path ]).getContent())
      .lower()
      .replace(/[^a-z0-9.!?— ]/g, '')
      .split(/[.?!]/)
      .map(sen => (sen = sen.trim())
        ? sen.split(/[ —]|[^a-z0-9— ]{2,}/).map(w => w.trim() || C.skip)
        : C.skip
      );
    
    if (sentences.length < 10) throw new Error('Not enough sentences');
    
    let freqCount = Map();
    for (let sen of sentences) for (let word of sen) freqCount.set(word, (freqCount.get(word) || 0) + 1);
    let maxCorrelations = freqCount.size * freqCount.size - freqCount.size;
    console.log(`Text parsed; ${freqCount.size} unique words -> ${maxCorrelations} possible correlations`);
    freqCount = null;
    
    // Get a unique key for the relationship between two words
    let corrKey = (w1, w2) => (w1.localeCompare(w2) <= 0) ? `${w1}.${w2}` : `${w2}.${w1}`;
    
    let updateCorrelations = (num, sentences, correlate=Map()) => {
      
      let freqCount = Map();
      let maxFreq = 0;
      for (let sen of sentences) { for (let word of sen) {
        let newFreq = (freqCount.get(word) || 0) + 1;
        if (newFreq > maxFreq) maxFreq = newFreq;
        freqCount.set(word, newFreq);
      }}
      
      // Get the correlation between two words
      let wordCorrAmt = (w1, w2) => {
        if (w1 === w2) return 2 / (freqCount.get(w1) + freqCount.get(w2));
        let key = corrKey(w1, w2);
        return correlate.has(key) ? correlate.get(key) : ((w1 === w2) ? 1 : 0);
      };
      
      // Change the correlation between two words
      let wordCorrUpd = (w1, w2, amt, fade=1) => { // TUNE: best value for `fade``??
        if (w1 === w2) return;
        let key = corrKey(w1, w2);
        let prev = correlate.has(key) ? correlate.get(key) : 0;
        if (prev !== amt) correlate.set(key, amt * fade + prev * (1 - fade));
      };
      
      for (let n = 0; n < num; n++) {
        
        let [ ind1, ind2 ] = Array.fill(2, () => Math.floor(Math.random() * sentences.length));
        
        // Here are the two sentences we'll consider - ensure we know
        // which is longer and shorter
        let senLo = sentences[ind1];
        let senHi = sentences[ind2];
        if (senLo.length > senHi.length) [ senLo, senHi ] = [ senHi, senLo ];
        
        // Shift `senLo` to get the best possible match
        let sizeDiff = senHi.length - senLo.length;
        let anchorCorrScore = 0; // Note that the maximum possible value is (senHi.length + senLo.length)
        let anchorOffset = 0;
        for (let off = 0; off <= sizeDiff; off++) {
          let attemptScore = 0;
          for (let i = 0; i < senLo.length; i++) attemptScore += wordCorrAmt(senLo[i], senHi[off + i]);
          if (attemptScore > anchorCorrScore) { anchorCorrScore = attemptScore; anchorOffset = off; }
        }
        
        // NOTE: `sentencePower` is very important to the overall
        // outcome - it determines how much disconnected words become
        // closer! It will stem from `anchorCorrScore`, which is largely
        // based on the structure of `senHi` and `senLo` - it's the best
        // sum that resulted by sliding `senLo` along `senHi` and
        // summing the correlation amounts of the paired words. This
        // means that the maximum `sentencePower` is `senLo.length` -
        // this occurs when a sentence is compared against itself.
        // Therefore `senLo.length` becomes a natural denominator. But
        // this is very punishing against `sentencePower` - while
        // `senLo.length` is the possible maximum for `anchorCorrScore`
        // the value will almost always be much closer to 0. It's rare
        // for even 2 words to perfectly correlate. Consider `div`, the
        // result of `anchorCorrScore / senLo.length` - it's largely in
        // the range of 0.01 -> 0.3. To make these values less punishing
        // we use a saturation curve:
        // 
        // Power  Saturation     0.01        0.3       0.5       0.75
        // 1/2    2x             ~0.1        ~0.45     ~0.7      ~0.85
        // 1/3    3x             ~0.21       ~0.65     ~0.8      ~0.9
        // 1/4    4x             ~0.31       ~0.75     ~0.85     ~0.9
        let sentencePower = Math.pow(anchorCorrScore / senLo.length, 1 / 3); // TODO: Tune saturation
        
        // Given these insights recalculate all pairs of words
        let upds = Map();
        let loWords = senLo;
        let hiWords = senHi.slice(anchorOffset, anchorOffset + loWords.length);
        for (let indLo = 0; indLo < loWords.length; indLo++) { for (let indHi = 0; indHi < hiWords.length; indHi++) {
          let w1 = loWords[indLo];
          let w2 = hiWords[indHi];
          if (w1 === w2) continue;
          
          let dist = Math.abs((anchorOffset + indLo) - indHi);
          let distMult = 0.2 / (dist + 0.2); // TUNE: distScore?? The closer to 0 the constant the more distance is punished
          let freqMult = 2 / (freqCount.get(w1) + freqCount.get(w2));
          //let pairPower = wordCorrAmt(w1, w2) * distMult * freqMult;
          
          let amt = 0
            + 0.70 * wordCorrAmt(w1, w2)
            + 0.30 * sentencePower * distMult * freqMult;
          
          //let amt = 0
          //  + 0.25 * sentencePower
          //  + 0.25 * pairPower
          //  + 0.50 * sentencePower * pairPower;
          
          let key = corrKey(w1, w2);
          if (!upds.has(key)) upds.set(key, { total: 0, div: 0 });
          upds.get(key).total += amt;
          upds.get(key).div += 1;
        }}
        
        upds.forEach(({ total, div }, key) => wordCorrUpd(...key.split('.'), total / div));
        
      }
      
      return correlate;
      
    };
    
    let correlations = Map();
    let portionOffset = 0;
    let portionCount = 0;
    while (true) {
      
      let t = foundation.getMs();
      
      let portion = (portionOffset + args.pSize >= sentences.length)
        ? [ ...sentences.slice(portionOffset), ...sentences.slice(0, args.pSize - (sentences.length - portionOffset)) ]
        : sentences.slice(portionOffset, portionOffset + args.pSize);
      
      updateCorrelations(args.reps, portion, correlations);
      
      let corrItems = correlations.toArr((amt, key) => {
        let [ w1, w2 ] = key.split('.');
        return (w1 === w2) ? C.skip : { w1, w2, amt };
      });
      corrItems.sort((corr1, corr2) => corr2.amt - corr1.amt);
      correlations = Map(corrItems.slice(0, args.corrLen).map(({ w1, w2, amt }) => [ corrKey(w1, w2), amt ]));
      
      let msStr = `${foundation.getMs() - t}ms`;
      console.log([
        `Completed ${args.reps} comparisons in ${msStr.padTail(7, ' ')}`,
        `@ offset ${portionOffset} (${(100 * (portionOffset / sentences.length)).toFixed(1)}%)`
      ].join(' '));
      
      if ((portionCount % args.printEvery) === 0) {
        
        console.log(corrItems.slice(0, args.resultLen).map(({ w1, w2, amt }) => {
          return `  ${amt.toFixed(5)} -> ${w1}, ${w2}`;
        }).join('\n'));
        if (args.delayMs) await new Promise(rsv => setTimeout(rsv, args.delayMs));
        
      }
      
      portionOffset = (portionOffset + args.pStep) % sentences.length;
      portionCount++;
      
    }
    
  }})
});
