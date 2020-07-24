U.buildRoom({ name: 'life', innerRooms: [], build: (foundation) => ({ open: async () => {
  
  let numParams = 2;
  let numRegs = 4;
  let skipDist = 4;
  let id = 0;
  let tooBig = 200;
  
  let makeEnt = (parent, body) => {
    
    // let form = {
    //   steps: []
    // };
    // let parse = (ind, form) => {
    //   
    //   for (let item
    //   
    // };
    
    return {
      id: id++,
      alive: true,
      body,
      step: 0,
      lifespan: 0,
      work: [],
      regs: [ body.count(), 0, 0, 0 ],
      parent,
      generation: parent ? parent.generation + 1 : 0,
      children: Set(),
      birth: null,
      error: null
    };
    
  };
  
  let ops = [
    'submit',
    'regReduceLoop',  // Decrement reg0; if > 0 perform next op; else skip next op
    'regInc',         // Increment reg0
    'regAdd',         // Increment reg0 by reg1
    'regWrite'        // Write op at index (reg0 - reg1)
  ];
  
  let opFns = {
    perform: (ent, [ opName, ...params ]) => {
      console.log(`Ent @ ${ent.id} does ${opName}`);
      opFns[opName](ent, ...params);
    },
    basicStart: (ent) => {
      
    },
    basicEnd: (ent) => {
      ent.step++;
      ent.lifespan++;
    },
    submit: (ent) => {
      if (ent.work.count() > ent.body.count() * 0.5) {
        ent.birth = makeEnt(ent, ent.body);
        ent.work = [];
        console.log('Did birth...');
      } else {
        ent.error = 'submit incomplete work: ' + ent.work.map(([ opName, ...params ]) => `${opName}(${params.join(', ')})`).join(' ');
      }
    },
    regReduceLoop: (ent, reg0) => {
      if (ent.regs[reg0] > 0) {
        let ind = ent.step + 1;
        let nextOp = (ind >= ent.body.count()) ? ent.body[0] : ent.body[ind];
        ent.regs[reg0]--;
        opFns.perform(ent, nextOp);
        ent.step--;
      } else {
        ent.step++;
      }
    },
    regInc: (ent, reg0) => ent.regs[reg0]++,
    regAdd: (ent, reg0, reg1) => ent.regs[reg0] += ent.regs[reg1],
    regWrite: (ent, reg0, reg1) => {
      let ind = ent.regs[reg0] - ent.regs[reg1];
      if (!ent.body[ind]) {
        ent.error = 'regWrite out of bounds';
        return;
      }
      ent.work.push(ent.body[ind]);
    }
  };
  
  let descEnt = ent => {
    return `ENT @ ${ent.id.toString().padHead(4, '0')}; GEN: ${ent.generation}; age: ${ent.lifespan}; children: ${ent.children.count()}; par: ${ent.parent ? ent.parent.id : 'none'}`;
  };
  let step = entities => {
    
    if (!entities.count()) return;
    
    for (let e of entities) {
      
      opFns.perform(e, [ 'basicStart' ]);
      opFns.perform(e, e.body[e.step]);
      opFns.perform(e, [ 'basicEnd' ]);
      
      while (e.step >= e.body.count()) e.step -= e.body.count();
      while (e.step < 0) e.step += e.body.count();
      
      if (e.birth) {
        e.children.add(e.birth);
        entities.add(e.birth);
        e.birth = null;
      }
      
      let causes = [
        [ e.error, `accident: ${e.error}` ],
        [ e.work.count() >= tooBig, `too much work` ],
        [ e.children.count() > 100 && e.children.find(child => child.children.count() > 0), 'too many children' ],
        [ (e.lifespan >= tooBig && (e.lifespan / tooBig) > e.children.count()), `unproductivity; lifespan: ${e.lifespan}; kids: ${e.children.count()}` ]
      ];
      
      let [ causeOfDeath=null ] = causes.find(cause => cause[0]) || [];
      if (causeOfDeath) {
        console.log(`Ent @ ${e.id} DIED: ${causeOfDeath[1]}`);
        e.alive = false;
        entities.rem(e);
        if (e.parent) e.parent.children.rem(e);
      }
      
    }
    
  };
  
  // ==========================
  
  let params = {
    iterationSize: 50,
    minEntities: 5
  };
  let rand = (min, max) => min + Math.floor(Math.random() * (max - min));
  let randBody = (min=20, max=50) => {
    let numOps = rand(min, max);
    return Array.fill(numOps, () => {
      let randOp = ops[rand(0, ops.length)];
      let randParams = Array.fill(numParams, () => rand(0, numRegs));
      return [ randOp, ...randParams ];
    });
  };
  
  let calcEntScore = ent => {
    return 0
      + 1.0 * ent.generation * ent.body.count()
      + 1.0 * ent.children.count();
  };
  let entities = Set(Array.fill(params.minEntities, () => makeEnt(null, randBody())));
  
  let inp = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  while (true) {
    
    for (let i = 0; i < params.iterationSize; i++) {
      while (entities.count() < params.minEntities) entities.add(makeEnt(null, randBody()));
      step(entities);
    }
    let ents = [ ...entities ].sort((e1, e2) => calcEntScore(e2) - calcEntScore(e1));
    
    console.log(`\n====RANKING ${ents.count()} ENTITIES====`);
    for (let ent of ents.slice(0, 10)) {
      console.log(calcEntScore(ent).toFixed(3), descEnt(ent));
    }
    
    while (true) {
      let query = await Promise(r => inp.question('> ', r));
      if (query === '') break;
      try {
        console.log(eval(query));
      } catch(err) {
        console.log(foundation.formatError(err));
      }
    }
    
  }
  
  
}})});


