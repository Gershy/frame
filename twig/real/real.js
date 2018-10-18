U.makeTwig({ name: 'real', twigs: [ ], make: (real) => {
  
  /*
  
  CSS has many shortcomings. One is that it can't naturally combine some rules;
  E.g. if you have
  
  .scaled {
    transform: scale(1.1, 2.2);
  }
  .rotated {
    transform: rotate(10deg);
  }
  
  Then `.scaled.rotated` will only be rotated. Need a separate rule to fix:
  
  .scaled.rotated {
    transform: scale(1.1, 2.2) rotate(10deg);
  }
  
  But this requires knowledge that .scaled and .rotated will eventually be combined.
  Otherwise this "fix" is never even used, and is just clutter in the CSS. And for 
  many different transform-specifying classes, can't afford to generate rules for
  all permutations.
  
  PURPOSE TREES
  
  The display format involves elements SATISFYING a PROVISION of the parent, and serving
  their own PURPOSE.
  
  For example a "quad" element, rectangular with elements lining each side and the center,
  has the PURPOSE of being a "quad", and PROVISIONS "tSide", "bSide", "lSide", "rSide",
  and "main".
  
  An inner "bside" element would SATISFY the "bside" PROVISION of the "quad". The inner
  "bside" element may have any further PURPOSE. It may even be another "quad", which would
  lead to a "quad" nested in the "bside" of a parent "quad".
  
  {
    quad: { desc: 'arbitrary display of content',
      provisions: {
        tSide: { desc: 'Header; fills in parent from top',
          constrains: {
            layout: 'rectangle'
          }
        },
        bSide: { desc: 'Footer; fills in parent from top',
          constrains: {
            layout: 'rectangle'
          }
        },
        lSide: { desc: 'Left-bar; fills in parent from left',
          constrains: {
            layout: 'rectangle'
          }
        },
        rSide: { desc: 'Right-bar; fills in parent from right',
          constrains: {
            layout: 'rectangle'
          }
        },
        main: { desc: 'Main content; fills between all side elements',
          constrains: {
            layout: 'rectangle'
          }
        }
      },
      params: {
        corners: 'Accepts an Object mapping corners to the "side" which occupies that ' +
          'corner. ' +
          'E.g. { tl: 'tSide', tr: 'tSide', bl: 'bSide', br: 'bSide' }: ' +
          'Creates a quad with top/bottom sides spanning fully, while the left and ' +
          'right sides are clamped between the top/bottom sides. ' +
          'E.g. { tl: 'lSide', tr: 'tSide', br: 'rSide', bl: 'bSide' }: ' +
          'Creates a quad with splayed out sides; each side touches a corner with ' +
          'clockwise preference.' +
          'E.g. { tl: 'rSide', tr: 'bSide', br: 'lSide', bl: 'tSide' }: ' +
          'This quad is invalid!! The corners are mapped to invalid sides which cannot ' +
          'occupy the corners.' +
          'Default: { tl: 'tSide', tr: 'tSide', bl: 'bSide', br: 'bSide' }
      }
    },
    flow: { desc: 'Depict flowing children; e.g. lists flowing downwards, header-items ' +
        'flowing horizontally',
      provisions: {
        flowItem: { desc: 'An item which flows in a string of items',
        }
      },
      params: {
        direction: 'Accepts "u", "d", "l", or "r". Specifies the direction of flow'
      }
    }
  }
  
  setupRealizer: function(rootForm, realizer) {
    
    // Setup a header with a logo and logout button, as well as
    // some header categories.
    
    let main = rootForm.setContent(QuadForm({
      corners: {
        tl: 'tSide', tr: 'tSide', bl: 'bSide', br: 'bSide'
      }
    }));
    let header = main.setTSide(QuadForm({
      corners: {
        tl: 'lSide', tr: 'rSide', bl: 'lSide', br: 'rSide'
      }
    }));
    let logo = header.setLSide(ImageForm({
      // ... an asset url or something
    }));
    let logout = header.setRSide(ButtonForm({
      // An action on click or something
      text: 'logout'
    }));
    let categories = header.setMain(FlowForm({
      direction: 'l'
    }));
    let category1 = categories.addFlowItem(ButtonForm({
      text: 'category1'
    }));
    let category2 = categories.addFlowItem(ButtonForm({
      text: 'category2'
    }));
    
  }
  
  content - arbitrary container
    content.tside - header; fills in the parent from the top
    content.bside - footer; fills in the parent from the bottom
    content.
  
  free - all children can float around with affecting each other
  heldHorz - all children stack up horizontally
  heldVert - all children stack up vertically
  
  */
  
  const { Temporary, TreeNode } = U;
  
  // const { JourneyBuff } = hinterlands;
  // const { Temporary, TreeNode } = U;
  
  const Fashion = U.makeClass({ name: 'Fashion', inspiration: {}, methods: (insp, Cls) => ({
    init: function(name) {
      
      this.name = name;
      
    }
  })});
  const ConstantFashion = U.makeClass({ name: 'ConstantFashion', inspiration: { Fashion }, methods: (insp, Cls) => ({
    init: function(name, fashions) {
      insp.Fashion.init.call(this, name);
      this.fashions = fashions;
    },
    resolve: function(value) {
      return this.fashions;
    }
  })});
  const DiscreetFashion = U.makeClass({ name: 'DiscreetFashion', inspiration: { Fashion }, methods: (insp, Cls) => ({
    init: function(name, fashionMap) {
      insp.Fashion.init.call(this, name);
      this.fashionMap = fashionMap;
    },
    resolve: function(value) {
      return this.fashionMap[value];
    }
  })});
  const ContinuousFashion = U.makeClass({ name: 'ContinuousFashion', inspiration: { Fashion }, methods: (insp, Cls) => ({
    init: function(name, fashionCalc) {
      insp.Fashion.init.call(this, name);
      this.fashionCalc = fashionCalc;
    },
    resolve: function(value) {
      return this.fashionCalc(value);
    }
  })});
  
  const Realizer = U.makeClass({ name: 'Realizer', inspiration: {}, methods: (insp, Cls) => ({
    
    init: function({}) {
      this.ready = this.genReadyPromise();
      this.fashions = {};
    },
    produce: function() { throw new Error('not implemented'); },
    release: function() { throw new Error('not implemented'); },
    genReadyPromise: async function() { throw new Error('not implemented'); },
    /// {SERVER=
    prepareClientSupport: function(lands) { throw new Error('not implemented'); },
    /// =SERVER}
    addFashion: function(fashion) {
      if (O.has(this.fashions, fashion.name)) throw new Error(`Tried to overwrite fashion "${fashion.name}"`);
      this.fashions[fashion.name] = fashion;
    },
    dress: function(real, name, wobbly=null) {
      
      if (!O.has(this.fashions, name)) throw new Error(`Couldn't find fashion "${name}"`);
      
      let fashion = this.fashions[name];
      
      // TODO: `wobbly` may still be calling `update` even if `real` has gone dn
      let update = () => this.applyFashion(real, fashion, wobbly ? wobbly.getValue() : null);
      if (wobbly) wobbly.hold(update, `~realizer.${name}`);
      update();
      
    },
    undress: function(real, name, wobbly) {
      
      if (wobbly) wobbly.drop(`~realizer.${name}`);
      
    },
    applyFashion: function(real, fashion, value) { throw new Error('not implemented'); }
    
  })});
  const ClassicHtmlRealizer = U.makeClass({ name: 'ClassicHtmlRealizer', inspiration: { Realizer }, methods: (insp, Cls) => ({
    
    init: function() {
      
      insp.Realizer.init.call(this, {});
      this.classNames = {};
      this.classNameCount = 0;
      
    },
    addFashion: function(fashion) {
      
      insp.Realizer.addFashion.call(this, fashion);
      this.classNames[fashion.name] = U.charId(this.classNameCount++, 4);
      
    },
    
    newCssRep: function() {
      
      return {
        position: null,
        display: null,
        width: null,
        height: null,
        left: null,
        right: null,
        top: null,
        bottom: null,
        lineHeight: null,
        textAlign: null,
        margin: null,           // { l, r, t, b }
        padding: null,          // { l, r, t, b }
        backgroundColour: null,
        background: null,       // { position, sizing, repeat, url }
        border: null,           // { l: { width, colour }, r: { width, colour }, t: { width, colour }, b: { width, colour } }
        borderRadius: null,     // { tl, tr, bl, br }
        transition: null       // { propName1: { duration, formula }... }
      };
      
    },
    cssRepToCssRules: function(cssRep) {
      
      let cssRules = {};
      for (var k in cssRep) {
        
        // Skip any omitted rules
        if (cssRep[k] === null) continue;
        
        // Convert camel-case to css' kebab-case
        cssRules[k.replace(/[A-Z]/g, match => '-' + match.toLowerCase())] = cssRep[k];
        
      }
      
      if (O.has(cssRules, 'margin')) {
        throw new Error('not implemented');
      }
      
      if (O.has(cssRules, 'padding')) {
        throw new Error('not implemented');
      }
      
      if (O.has(cssRules, 'background')) {
        throw new Error('not implemented');
      }
      
      if (O.has(cssRules, 'border')) {
        throw new Error('not implemented');
      }
      
      if (O.has(cssRules, 'border-radius')) {
        throw new Error('not implemented');
      }
      
      if (O.has(cssRules, 'transition')) {
        throw new Error('not implemented');
      }
      
    },
    
    includeCssRuleData: function(allRules, parFashion=null, fashion, fashionData, id, parId=null) {
      
      if (parFashion === null) {
        let fashionNameChain = S.split(fashion.name, '.');
        let parFashionName = fashionNameChain.slice(0, fashionNameChain.length - 1).join('.');
        
        parFashion = O.has(this.fashions, parFashionName) ? this.fashions[parFashionName] : null;
        if (parFashion) parId = this.classNames[parFashionName];
      }
      
      U.output(`Generating for "${parFashion ? parFashion.name : 'ROOT'}" -> "${fashion.name}"`);
      
      let myCssRep = this.newCssRep();
      let parCssRep = this.newCssRep();
      
      // Fill out the cssReps based on the fashion
      let { satisfies, purpose, looks } = fashion.resolve(fashionData);
      if (parFashion && !allRules[parId].type) throw new Error(`Don't yet know parent type for ${parFashion.name}`);
      
      let parType = parFashion ? allRules[parId].type : 'ROOT';
      let validSatisfiers = {
        ROOT: {
          root: true
        },
        quad: {
          lSide: true,
          rSide: true,
          tSide: true,
          bSide: true,
          center: true
        },
        text: {
        }
      };
      
      if (!O.has(validSatisfiers, parType)) throw new Error(`Invalid parType: "${parType}"`);
      if (!O.has(validSatisfiers[parType], satisfies.type)) throw new Error(`Invalid type "${satisfies.type}" can't satisfy parent "${parType}"`);
      if (!O.has(satisfies, 'type')) throw new Error('Missing satisfies.type');
      
      // TODO: HEEERE! Generate css rules based on `satisfies`, `purpose`, and `looks`
      
      if (parType === 'ROOT') {
        
        if (satisfies.type === 'root') {
          
          O.include(myCssRep, {
            display: 'block',
            position: 'fixed',
            width: '100%',
            height: '100%',
            left: '0px',
            top: '0px'
          });
          
        }
        
      } else if (parType === 'quad') {
        
        if (satisfies.type === 'lside') {
          
          _.extend(myCssRep, {
            
          });
          
        } else if (satisfies.type === 'rside') {
          
        } else if (satisfies.type === 'tside') {
          
        } else if (satisfies.type === 'bside') {
          
        } else if (satisfies.type === 'center') {
          
        }
        
      }
      
      for (var k in satisfies) {
        
        if (k === 'type') {
          
          
          
        } else {
          
        }
        
        myCssRep.po
        myCssRep.width = '100%';
        myCssRep.height = '100%';
        myCssRep.left = '0px';
        myCssRep.top = '0px';
        console.log(`Considering SATISFY ${k}: ${satisfies[k]}`);
      };
      for (var k in purpose) {
        console.log(`Considering PURPOSE ${k}: ${purpose[k]}`);
      };
      for (var k in looks) {
        console.log(`Considering LOOKS ${k}: ${looks[k]}`);
      };
      
      // Now convert cssReps to cssRules
      let myCssRules = this.cssRepToCssRules(myCssRep);
      let parCssRules = this.cssRepToCssRules(parCssRep);
      
      let myCssDataRef = allRules[id];
      let parCssDataRef = parFashion ? allRules[parId] : null;
      
      myCssDataRef.type = purpose.type; // We found out the type, so install it
      
      // Apply all cssRules to the main css container (`allRules[id].rules[cssPropName]`)
      for (var k in myCssRules) {
        if (myCssDataRef.rules.hasOwnProperty[k]) console.log(`Warning: multiple fashions write to ${fashion.name} for style ${k}`);
        myCssDataRef.rules[k] = myCssRules[k];
      }
      
      for (var k in parCssRules) {
        if (parCssDataRef.rules.hasOwnProperty[k]) console.log(`Warning: multiple fashions write to ${parFashion.name} for style ${k}`);
        parCssDataRef.rules[k] = parCssRules[k];
      }
      
    },
    
    /// {SERVER=
    
    genReadyPromise: async function() {
      // nothing
    },
    genCssFourVal: function({ l, r, t, b }) {
      
      // All equal; 1 value
      if (l === r && l === b && l === t) return l;
      
      // Left equals right; top equals bottom; 2 values
      if (l === r && t === b) return `${t} ${l}`;
      
      // Only left equals right; 3 values
      if (l === r) return `${t} ${l} ${b}`;
      
      // Otherwise 4 values
      return `${t} ${r} ${b} ${l}`;
      
    },
    genCssRuleData2: function(fashionData) {
      
      // U.output(`Resolving for ${JSON.stringify(fashionData, null, 2)}...`);
      
      // Fashion values to keep track of
      let fashion = {
        shape: null,
        layout: null
      };
      
      // Css values to keep track of
      let position = null;
      let display =  null;
      let width = null;
      let height = null;
      let left = null;
      let right = null;
      let top = null;
      let bottom = null;
      
      let lineHeight = null;
      let textAlign = null;
      
      let margin = null; // { top, right, bottom, left }
      
      let backgroundColour = null;
      let backgroundImage = null;
      
      let border = null; // { width, colour }
      let borderRadius = null; // { top, right, bottom, left }
      
      let transitions = {}; // { propName1: { duration, formula }... }
      
      for (var name in fashionData) {
        
        if (name === 'shape') {
          
          let shape = fashionData[name];
          if (shape === 'rectangle') {
            
          } else if (shape === 'square') {
            
          } else if (shape === 'circle') {
            
            borderRadius = { top: '100%', right: '100%', bottom: '100%', left: '100%' };
            
          }
          
          fashion.shape = shape;
          
        } else if (name === 'shape.x') {
          
          if (fashion.shape === 'rectangle') {
            
            width = fashionData[name];
            
          } else {
            
            throw new Error(`Can't specify "shape.x" for shape ${fashion.shape}`);
            
          }
          
        } else if (name === 'shape.y') {
          
          if (fashion.shape === 'rectangle') {
            
            height = fashionData[name];
            
          } else {
            
            throw new Error(`Can't specify "shape.y" for shape ${fashion.shape}`);
            
          }
          
        } else if (name === 'shape.radius') {
          
          if (fashion.shape === 'circle') {
            
            width = fashionData[name];
            height = width;
            
          } else {
            
            throw new Error(`Can't specify "shape.radius" for shape ${fashion.shape}`);
            
          }
          
        } else if (name === 'shape.extent') {
          
          if (fashion.shape === 'square') {
            
            width = fashionData[name];
            height = width;
            
          } else {
            
            throw new Error(`Can't specify "shape.extent" for shape ${fashion.shape}`);
            
          }
          
        } else if (name === 'layout') {
          
          let layout = fashionData[name];
          if (layout === 'free') {
            
            position = 'absolute';
            display = 'block';
            
          } else if (layout === 'held') {
            
            position = 'relative';
            display = 'inline-block';
            
          }
          
          fashion.layout = layout;
          
        } else if (name === 'layout.x') {
          
          if (fashion.layout === 'free') {
            
            left = fashionData[name];
            
          } else {
            
            throw new Error(`Can't specify "layout.x" when layout is ${fashion.layout}`);
            
          }
          
        } else if (name === 'layout.y') {
          
          if (fashion.layout === 'free') {
            
            top = fashionData[name];
            
          } else {
            
            throw new Error(`Can't specify "layout.y" when layout is ${fashion.layout}`);
            
          }
          
        } else if (name === 'layout.clamp') {
          
          if (fashion.layout === 'free') {
            
            let clamp = fashionData[name];
            if (clamp === 'tl') {
              left = '0px';
              top = '0px';
            } else if (clamp === 'tr') {
              right = '0px';
              top = '0px';
            } else if (clamp === 'bl') {
              left = '0px';
              bottom = '0px';
            } else if (clamp === 'br') {
              
              right = '0px';
              bottom = '0px';
              
            } else if (clamp === 'center') {
              
              if (width === null) throw new Error('Can\'t clamp to center without knowing width');
              if (height === null) throw new Error('Can\'t clamp to center without knowing height');
              
              left = '50%';
              top = '50%';
              margin = { left: `-${parseInt(width) >> 1}px`, right: '0px', top: `-${parseInt(height) >> 1}px`, bottom: '0px' };
              
            } else {
              throw new Error(`Invalid "layout.clamp" value: ${clamp}`);
            }
            
          } else {
            
            throw new Error(`Can't specify "layout.clamp" when layout is ${fashion.layout}`);
            
          }
          
        } else if (name === 'layout.x.transition.duration') {
          
          if (!O.has(transitions, 'left')) transitions.left = { duration: null, formula: null };
          transitions.left.duration = fashionData[name];
          
        } else if (name === 'layout.x.transition.formula') {
          
          if (!O.has(transitions, 'left')) transitions.left = { duration: null, formula: null };
          transitions.left.formula = fashionData[name];
          
        } else if (name === 'layout.y.transition.duration') {
          
          if (!O.has(transitions, 'top')) transitions.top = { duration: null, formula: null };
          transitions.top.duration = fashionData[name];
          
        } else if (name === 'layout.y.transition.formula') {
          
          if (!O.has(transitions, 'top')) transitions.top = { duration: null, formula: null };
          transitions.top.formula = fashionData[name];
          
        } else if (name === 'fill.colour') {
          
          backgroundColour = fashionData[name];
          
        } else if (name === 'fill.image.path') {
          
          if (!backgroundImage) backgroundImage = { position: 'center', sizing: 'cover', repeat: 'no-repeat', url: 'invalid.png' };
          backgroundImage.url = fashionData[name];
          
        } else if (name === 'fill.image.position') {
          
          if (!backgroundImage) backgroundImage = { position: 'center', sizing: 'cover', repeat: 'no-repeat', url: 'invalid.png' };
          backgroundImage.position = fashionData[name];
          
        } else if (name === 'fill.image.sizing') {
          
          if (!backgroundImage) backgroundImage = { position: 'center', sizing: 'cover', repeat: 'no-repeat', url: 'invalid.png' };
          backgroundImage.sizing = fashionData[name];
          
        } else if (name === 'contains') {
          
          let contains = fashionData[name];
          if (contains === 'text') {
            
            if (height !== null) {
              
              lineHeight = height;
              textAlign = 'center';
              
            } else {
              
              throw new Error(`Can\'t contain text when height is unknown`);
              
            }
            
          }
          
        } else {
          
          console.log('UNKNOWN:', name);
          
        }
        
      }
      
      let cssCalc = O.map({
        position, display,
        width, height,
        left, right, top, bottom,
        'line-height': lineHeight,
        'text-align': textAlign,
        'background-color': backgroundColour
      }, v => v === null ? U.SKIP : v);
      
      if (margin) {
        margin = O.include({ left: '0px', right: '0px', top: '0px', bottom: '0px' }, margin);
        cssCalc['margin'] = this.genCssFourVal(margin);
      }
      
      if (borderRadius) {
        borderRadius = O.include({ left: '0px', right: '0px', top: '0px', bottom: '0px' }, borderRadius);
        cssCalc['border-radius'] = this.genCssFourVal(borderRadius);
      }
      
      if (!O.isEmpty(transitions)) {
        
        cssCalc['transition'] = A.join(O.toArr(transitions, (data, propName) => {
          return `${propName} ${data.duration} ${data.formula}`;
        }), ', ');
        
      }
      
      if (backgroundImage) {
        
        let bgImg = backgroundImage;
        cssCalc['background'] = `${bgImg.position} / ${bgImg.sizing} ${bgImg.repeat} url("${bgImg.url}")`;
        
      }
      
      return cssCalc;
      
    },
    genCssDoc: function() {
      
      let fullCssData = {};
      let dataForCss = [];
      
      /*
      let cssRuleData = [
        {
          fashion: { name: '~default' },
          selector: 'body, html',
          rules: {
            'position': 'fixed',
            'left': '0',
            'top': '0',
            'width': '100%',
            'height': '100%',
            'padding': 0,
            'margin': 0,
            'overflow': 'hidden',
            'font-family': 'sans-serif',
            'background-color': '#e0e4e8'
          }
        }
      ];
      */
      
      for (var fashionName in this.fashions) {
        
        let fashion = this.fashions[fashionName];
        
        let fashionNamePcs = fashionName.split('.');
        let parFashionName = fashionNamePcs.slice(0, fashionNamePcs.length - 1).join('.');
        if (parFashionName && !O.has(this.fashions, parFashionName)) throw new Error(`Fashion ${fashionName} has no parent`);
        
        let uniqueId = this.classNames[fashionName];
        fullCssData[uniqueId] = { fashion, selector: `.${uniqueId}`, type: null, rules: {} };
        
        if (U.isInspiredBy(fashion, ConstantFashion)) {
          
          dataForCss.push({
            id: uniqueId,
            fashion,
            fashionData: null
          });
          
        } else if (U.isInspiredBy(fashion, DiscreetFashion)) {
          
          for (var type in fashion.fashionMap) {
            
            let uniqueTypeId = `${this.classNames[fashionName]}-${type}`;
            fullCssData[uniqueTypeId] = { fashion, selector: `.${uniqueTypeId}`, type: null, rules: {} };
            
            dataForCss.push({
              id: uniqueTypeId,
              fashion,
              fashionData: type
            });
            
          }
          
        } else if (U.isInspiredBy(fashion, ContinuousFashion)) {
          
          /*
          cssRuleData.push({
            selector: `.${this.classNames[k]}`,
            rules: null
          });
          */
          
        }
        
      }
      
      while (dataForCss.length) {
        
        let remainingDataForCss = [];
        let hasSuccess = false;
        
        for (let i = 0, len = dataForCss.length; i < len; i++) {
          let d = dataForCss[i];
          try {
            this.includeCssRuleData(fullCssData, null, d.fashion, d.fashionData, d.id, null);
            hasSuccess = true;
          } catch(err) {
            throw err; // TODO: Take out!
            remainingDataForCss.push(d);
          }
        }
        
        if (!hasSuccess) throw new Error('Failed with ' + dataForCss.length + ' css data items remaining');
        
        dataForCss = remainingDataForCss;
        
      }
      
      return A.join(O.toArr(fullCssData, (cssData, className) => {
        
        let { fashion, selector, rules } = cssData;
        
        // No need to include empty css rules
        if (O.isEmpty(rules)) return U.SKIP;
        
        // Convert rules to css format
        rules = O.toArr(rules, (value, rule) => `${rule}: ${value};`);
        
        // Generate and return the multiline css rule
        let lines = [
          `/* ${fashion.name}: */ ${selector} {`,
          S.indent(A.join(cssRules, '\n'), '  '),
          `}`
        ];
        return A.join(lines, '\n');
        
      }), '\n');
      
    },
    prepareClientSupport: function(otlLands, lands) {
      otlLands.addPublicFile('style.css', 'css', this.genCssDoc());
      /*otlLands.addPublicFile('style.css', JourneyBuff({
        type: 'css',
        buffer: this.genCssDoc()
      }));*/
    },
    applyFashion: function(real, fashion, value) {
      // do nothing (we just generate css to be used server-side)
    },
    
    /// =SERVER} {CLIENT=
    
    genReadyPromise: async function() {
      // TODO: restore the following line! It's only commented out for testing via the raw DOM api
      // await new Promise(rsv => { window.onload = rsv; });
    },
    produce: function(real) {
      
      if (real.realization) throw new Error(`Already produced for ${real.describe()}`);
      
      let elem = document.createElement('div');
      elem.classList.add('rl-' + real.name);
      elem.id = real.getAddress('arr').join('-');
      
      real.realization = elem;
      
    },
    release: function(real) {
      
      // TODO: Remove all listeners from `real.realization`
      
      real.realization = null;
      
    },
    addChild: function({ par, child }) {
      
      let parRealization = par ? par.realization : document.body;
      parRealization.appendChild(child.realization);
      
    },
    remChild: function({ par, child }) {
      
      let parRealization = par ? par.realization : document.body;
      parRealization.removeChild(child.realization);
      
    },
    setText: function(real, text) {
      
      // TODO: Escaping!!
      let realization = real.realization;
      if (realization.innerHTML !== text) realization.innerHTML = text;
      
    },
    applyFashion: function(real, fashion, value) {
      
      if (!real.realization) throw new Error('Missing realization');
      
      if (U.isType(fashion, ConstantFashion)) {
        
        let realization = real.realization;
        realization.classList.add(this.classNames[fashion.name]);
        
      } else if (U.isType(fashion, DiscreetFashion)) {
        
        let className = this.classNames[fashion.name];
        realization.classList.remove(...O.toArr(fashion.fashionMap, (vals, discreetName) => `${className}-${discreetName}`));
        realization.classList.add(`${className}-${value}`);
        
      } else if (U.isType(fashion, ContinuousFashion)) {
        
        throw new Error('Not implemented');
        
      } else {
        
        throw new Error(`Can't apply ${U.typeOf(fashion)}`);
        
      }
      
      U.output(`APPLY ${U.typeOf(fashion)} TO ${U.typeOf(real)} WITH ${value}`);
    }
    
    /// =CLIENT}
    
  })});
  
  const Real = U.makeClass({ name: 'Real', inspiration: { TreeNode, Temporary }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer=null }) {
      insp.TreeNode.init.call(this, { name });
      this.realizer = realizer;
      this.realization = null;
      this.fashions = {}; // Maps fashion names to the corresponding Wobbly controlling the fashion
    },
    getRealizer: function() {
      if (!this.realizer) this.realizer = this.par.getRealizer();
      return this.realizer;
    },
    getTmpActions: function() {
      return [
        {
          up: function() {
            let realizer = this.getRealizer();
            realizer.produce(this);
            O.each(this.fashions, (wobbly, fashionName) => realizer.dress(this, fashionName, wobbly));
          },
          dn: function() {
            if (!this.realization) return;
            let realizer = this.getRealizer();
            O.each(this.fashions, (wobbly, fashionName) => realizer.undress(this, fashionName, wobbly));
            realizer.release(this);
          }
        }
      ];
    },
    dress: function(name, wobbly=null) {
      if (O.has(this.fashions, name)) throw new Error(`Tried to overwrite fashion "${name}"`);
      this.fashions[name] = wobbly;
    }
    
  })});
  const RealObj = U.makeClass({ name: 'RealObj', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer }) {
      
      insp.Real.init.call(this, { name, realizer });
      this.children = {};
      
    },
    getTmpActions: function() {
      
      // Children go dn before parent goes down; children go up after parent goes up
      return A.include(
        [{
          up: function() {},
          dn: function() {
            O.each(this.children, c => {
              this.getRealizer().remChild({ par: this, child: c });
              c.dn();
            });
          }
        }],
        insp.Real.getTmpActions.call(this),
        [{
          up: function() {
            O.each(this.children, c => {
              c.up();
              this.getRealizer().addChild({ par: this, child: c });
            });
          },
          dn: function() {}
        }]
      );
      
    },
    add: function(child) {
      
      this.children[child.name] = child;
      child.par = this;
      return child;
      
    },
    rem: function(child) {
      
      if (child.par !== this) throw new Error(`Child ${child.describe()} is not a child of ${this.describe()}`);
      child.par = null;
      delete this.children[child.name];
      
    }
    
  })});
  const RealArr = U.makeClass({ name: 'RealArr', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer, wobbly }) {
      
      insp.Real.init.call(this, { name, realizer });
      this.wobbly = wobbly;
      this.template = null;
      this.children = {};
      
      this.onRecWobble = (delta) => {
        
        if (!delta) throw new Error('Wobble without delta :(');
        if (!O.has(delta, 'add')) throw new Error('Invalid delta; missing "add"');
        if (!O.has(delta, 'rem')) throw new Error('Invalid delta; missing "rem"');
        
        A.each(delta.add, childReal => {
          let real = this.template(childReal);
          this.children[real.name] = real;
          real.par = this;
          real.up();
        });
        A.each(delta.rem, childRealName => {
          let real = this.children[childRealName];
          delete this.children[real.name];
          real.par = null;
          real.dn();
        });
        
      };
      
    },
      
    getTmpActions: function() {
      
      // Children go dn before parent goes down
      return A.include(
        [{
          up: function() {},
          dn: function() { O.each(this.children, c => c.dn()); }
        }],
        insp.Real.getTmpActions.call(this),
        [{
          up: function() { this.wobbly.hold(this.onRecWobble); },
          dn: function() { this.wobbly.drop(this.onRecWobble); }
        }]
      );
      
    },
    
    setTemplate: function(template) {
      this.template = template;
    }
    
  })});
  const RealStr = U.makeClass({ name: 'RealStr', inspiration: { Real }, methods: (insp, Cls) => ({
    
    init: function({ name, realizer, wobbly }) {
      
      if (!wobbly) throw new Error('Missing "wobbly" param');
      
      insp.Real.init.call(this, { name, realizer });
      this.wobbly = wobbly;
      this.onRecWobble = (delta) => {
        this.getRealizer().setText(this, this.wobbly.getValue());
      };
      
    },
    getTmpActions: function() {
      
      return A.include(insp.Real.getTmpActions.call(this), [
        {
          up: function() {
            this.getRealizer().setText(this, this.wobbly.getValue());
            this.wobbly.hold(this.onRecWobble);
          },
          dn: function() {
            this.wobbly.drop(this.onRecWobble);
          }
        }
      ]);
      
    }
    
  })});
  
  O.include(real, {
    ConstantFashion, DiscreetFashion, ContinuousFashion,
    Realizer, ClassicHtmlRealizer,
    Real, RealObj, RealArr, RealStr
  });
  
}});
