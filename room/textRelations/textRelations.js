U.buildRoom({
  name: 'textRelations',
  innerRooms: [],
  build: (foundation) => ({ open: async () => {
    
    let allowIdenCorr = false; // TUNE: This boi! TODO: When decided, factor it out of code flow
    let { path, reps=100, verbose=false, delayMs=0, resultSize=5 } = foundation.raiseArgs;
    if (!path) throw new Error('Missing "path"');
    
    let content = await foundation.readFile(path);
    let paragraphs = content.split('\n').map(ln => { ln = ln.trim(); return ln || C.skip; });
    
    let sentences = [];
    for (let paragraph of paragraphs) {
      let paraSentences = paragraph.split(/[.?!]/);
      for (let ps of paraSentences) {
        // Lowercase, only a-z and spaces, without multi-space sequences
        ps = ps.lower().replace(/[^a-z0-9 ]/g, '').split(' ').map(ln => ln.trim() || C.skip);
        if (!ps.isEmpty()) sentences.push(ps);
      }
    }
    content = null;
    paragraphs = null;
    
    if (sentences.length < 10) throw new Error('Not enough sentences');
    
    let uniqueWords = Set();
    for (let sen of sentences) for (let word of sen) uniqueWords.add(word);
    
    let maxCorrelations = allowIdenCorr
      ? (uniqueWords.size * uniqueWords.size)
      : (uniqueWords.size * uniqueWords.size - uniqueWords.size);
    console.log(`Text parsed; ${uniqueWords.size} unique words entails ${maxCorrelations} correlations`);
    console.log('Churning...');
    uniqueWords = null;
    
    let correlate = Map();
    let numCorrelations
    let corrKey = (w1, w2) => (w1.localeCompare(w2) <= 0) ? `${w1}.${w2}` : `${w2}.${w1}`;
    let wordCorrAmt = (w1, w2) => {
      if (!allowIdenCorr && w1 === w2) return 1;
      let key = corrKey(w1, w2);
      return correlate.has(key) ? correlate.get(key) : ((w1 === w2) ? 1 : 0);
    };
    
    let wordCorrUpd = (w1, w2, amt, fade=1) => { // TUNE: best value for `fade``??
      if (!allowIdenCorr && w1 === w2) return;
      let key = corrKey(w1, w2);
      let prev = correlate.has(key) ? correlate.get(key) : 0;
      if (prev !== amt) correlate.set(key, amt * fade + prev * (1 - fade));
    };
    
    let compareCnt = 0;
    while (true) {
      
      if (verbose) console.log('Collecting data for churn...');
      
      let t = +new Date();
      for (let i = 0; i < reps; i++) {
        let [ ind1, ind2 ] = Array.fill(2, () => Math.floor(Math.random() * sentences.length));
        
        // Here are the two sentences we'll consider - ensure we know
        // which is longer and shorter
        let senLo = sentences[ind1];
        let senHi = sentences[ind2];
        if (senLo.length > senHi.length) [ senLo, senHi ] = [ senHi, senLo ];
        
        // TODO: Shift `senLo` to get the best possible match??
        // What correlation score do we get comparing pairs of words?
        let sizeDiff = senHi.length - senLo.length;
        let anchorCorrScore = 0; // Note that the maximum possible value is (senHi.length + senLo.length)
        let anchorOffset = 0;
        for (let off = 0; off <= sizeDiff; off++) {
          let attemptScore = 0;
          let pairsWithScore = Set();
          for (let i = 0; i < senLo.length; i++) {
            let w1 = senLo[i];
            let w2 = senHi[off + i];
            let pairScore = wordCorrAmt(w1, w2);
            attemptScore += pairScore;
          }
          if (attemptScore > anchorCorrScore) {
            anchorCorrScore = attemptScore;
            anchorOffset = off;
          }
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
        // Power  Saturation     0.01        0.3       0.5       0.75
        // 1/2    2x             ~0.1        ~0.45     ~0.7      ~0.85
        // 1/3    3x             ~0.21       ~0.65     ~0.8      ~0.9
        // 1/4    4x             ~0.31       ~0.75     ~0.85     ~0.9
        let sentencePower = Math.pow(anchorCorrScore / senLo.length, 1 / 2); // TODO: Tune saturation
        
        // Given these insights recalculate all pairs of words
        let upds = Map();
        for (let indLo = 0; indLo < senLo.length; indLo++) { for (let indHi = 0; indHi < senHi.length; indHi++) {
          let w1 = senLo[indLo];
          let w2 = senHi[indHi];
          
          let dist = Math.abs((anchorOffset + indLo) - indHi);
          let distScore = 0.2 / (dist + 0.2); // TUNE: distScore?? The closer to 0 the constant, the more distance is punished
          
          let pairAmt = wordCorrAmt(w1, w2); // TODO: Should this look into the tan?
          
          // TUNE: This? How much power to the sentence vs the pair?
          // Where should `distScore` apply?
          let amt = sentencePower * 0.3 + pairAmt * distScore * 0.7;
          
          let key = corrKey(w1, w2);
          if (!upds.has(key)) upds.set(key, { total: 0, div: 0 });
          upds.get(key).total += amt;
          upds.get(key).div += 1;
        }}
        
        upds.forEach(({ total, div }, key) => wordCorrUpd(...key.split('.'), total / div));
        
        // Now compare every word with every word
        
        if (verbose) {
          let formatLo = []; // Array.fill('', anchorOffset); // An entry for every skipped word
          let formatHi = [];
          let formatGap = 0;
          for (let i = 0; i < senHi.length; i++) {
            let w1 = senHi[i];
            let w2 = (i < anchorOffset || (i - anchorOffset) >= senLo.length) ? '' : senLo[i - anchorOffset];
            
            if (w1.length < w2.length) w1 = w1.padTail(w2.length, ' ');
            if (w2.length < w1.length) w2 = w2.padTail(w1.length, ' ');
            
            formatHi.push(w1);
            formatLo.push(w2);
          }
          console.log(`${compareCnt.toString().padHead(7, '0')}.1 - ${formatHi.join(' ')}`);
          console.log(`${compareCnt.toString().padHead(7, '0')}.1 - ${formatLo.join(' ')}`);
          console.log(`Anchor score: ${anchorCorrScore.toFixed(3)} (${senHi.length + senLo.length} total words)`);
          console.log('');
        }
        
        compareCnt++;
        
      }
      console.log(`Compared ${reps} random sentence pair${reps === 1 ? '' : 's'} in ${((new Date() - t) / 1000).toFixed(2)} seconds`);
      
      t = +new Date();
      let corrItems = correlate.toArr((amt, key) => {
        let [ w1, w2 ] = key.split('.');
        return (w1 === w2) ? C.skip : { w1, w2, amt };
      });
      corrItems.sort(({ amt: a1 }, { amt: a2 }) => a2 - a1);
      console.log(`Sorted ${corrItems.length} relations in ${((new Date() - t) / 1000).toFixed(2)} seconds:`);
      console.log(corrItems.slice(0, resultSize).map(({ w1, w2, amt }) => `  ${amt.toFixed(8)} -> ${w1}, ${w2}`).join('\n'));
      
      if (delayMs)  await Promise(r => setTimeout(r, delayMs));
      else          break;
      
    }
    
  }})
});
