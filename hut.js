// The server-side equivalent of a web-page running hut:
// Build the clearing, the foundation and all prerequisite rooms, and
// finally build the hut being run.
// Server-side huts perform compilation, as part of the foundation.

// ==== NOTES
// EventSource looks useful: https://developer.mozilla.org/en-US/docs/Web/API/EventSource

// RIGHT NOW: Match deadline should be implemented with FilterWob, or some other paradigm
// that makes beginning and ending explicit. WobVal implementation should be cleaned up,
// and with it, Wobblies accept simpler parameters, not objects (with ramifications for
// certain occurrences of WobVal usage)

Error.stackTraceLimit = Infinity;

// Do setup
require('./setup/clearing.js');

let testy = [ true, false ][1];
if (testy) {
  
  // Test MulTmps
  let arr = [ 'a', 'd', 'g', 'l', 'y' ];
  
  let mul = U.MulTmps(U.WobRep(2000), () => {
    let val = arr[Math.floor(Math.random() * arr.length)];
    console.log('NEW VAL:', val);
    return val;
  });
  
  mul.getTmp('a').attach.hold(() => console.log('A: >> attach!'));
  mul.getTmp('a').detach.hold(() => console.log('A: << detach!'));
  
  mul.getTmp('d').attach.hold(() => console.log('D: >> attach!'));
  mul.getTmp('d').detach.hold(() => console.log('D: << detach!'));
  
  mul.getTmp('g').attach.hold(() => console.log('G: >> attach!'));
  mul.getTmp('g').detach.hold(() => console.log('G: << detach!'));
  
  mul.getTmp('l').attach.hold(() => console.log('L: >> attach!'));
  mul.getTmp('l').detach.hold(() => console.log('L: << detach!'));
  
  mul.getTmp('y').attach.hold(() => console.log('Y: >> attach!'));
  mul.getTmp('y').detach.hold(() => console.log('Y: << detach!'));
  
  U.WobDel(15000).hold(() => {
    console.log('COMPLETELY ENDING!!!');
    mul.decideWob.shut();
    mul.shut();
    console.log('DONE!');
  });
  
  return;
  
  // Test shutting WobFnc
  let wob1 = U.Wob();
  let wob2 = U.Wob();
  
  wob1.hold(v => console.log(`wob1: ${v}`));
  wob2.hold(v => console.log(`wob2: ${v}`));
  
  let wobFn = U.WobFnc([ wob1, wob2 ], (v1, v2) => `${v1} and ${v2}`);
  wobFn.hold(v => console.log('CALC:', v));
  
  wob1.wobble('HUZZAHHH');
  wob2.wobble('WEEP WAP WOP');
  
  wobFn.shut();
  
  wob1.wobble('lolol');
  wob2.wobble('lelel');
  
  console.log(wobFn.wobs);
  
  return;
  
  // Test WobFnc
  let inc1 = 0;
  let inc2 = 0;
  
  let v1 = 'abcdefghijklmnopqrstuvwxyz'.split('');
  let v2 = Array.fill(26, v => v);
  
  let val1 = U.WobVal(null);
  let val2 = U.WobVal(null);
  
  U.WobRep(1000).hold(() => val1.wobble(v1[inc1++]));
  U.WobRep(1100).hold(() => val2.wobble(v2[inc2++]));
  
  U.WobFnc([ val1, val2 ], (...v) => v.join(' / ')).hold((...args) => {
    
    console.log('WOBFNC WOB:', args);
    
  });
  
  return;
  
}


require('./setup/foundation.js');
require('./setup/foundationNodejs.js');

// Process args
let args = process.argv.slice(2).join(' ');

if (args[0] === '{') {
  args = eval(`(${args})`);
} else {
  args = args.split('-').toObj(a => {
    if (!a) return C.skip;
    let [ k, ...v ] = a.trim().split(' ');
    return [ k, v.join(' ') || true ];
  });
}

// Powershell and other terminals may pass "encodedCommand"
if (args.has('encodedCommand')) {
  // Decode from base64; strip all 0-bytes
  let encoded = Buffer.from(args.encodedCommand, 'base64').toString('utf8')
    .split('').map(v => v.charCodeAt(0) ? v : C.skip).join('');
  
  args.gain({
    ...eval(`({${encoded}})`),
    encodedCommand: C.skip,
    inputFormat: C.skip,
    outputFormat: C.skip
  });
}

// Make the foundation
let { FoundationNodejs } = U.foundationClasses;
U.foundation = FoundationNodejs({
  ...args,
  variantDefs: {
    above: { above: 1, below: 0 },
    below: { above: 0, below: 1 }
    //between: { above: 1, below: 1 },
    //alone: { above: 0, below: 0 }
  }
});

U.foundation.install();
