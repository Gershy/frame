require('./clearing.js');
require('./foundation.js');
require('./foundationNodejs.js');
let foundation = U.setup.FoundationNodejs({});

// Building blocks
let Unsure = U.inspire({ name: 'Unsure', methods: (insp, Insp) => ({
  
  $globalRegistry: Set(),
  
  init: function(fn=null, name=null) {
    
    // Allow performance monitoring
    Insp.globalRegistry.add(this);
    
    // Names evolve in complexity to reflect increasingly abstract purposes
    if (name) this.name = name;
    
    // The constructor allows shorthand to bind a function to run when
    // the `Unsure` ends
    if (fn) this.getDoneSender().add(fn, false);
  },
  bool: function() { return true; },
  end: function() {
    // Cause the Unsure to end
    if (this.bool()) {
      
      // Effect the results of `bool` and `done`
      this.bool = () => false;
      
      // `this.sdDone` will be set if any activity has occurred on our
      // DoneSender. If it exists it likely has targets, so send value
      if (this.sdDone) this.sdDone.send();
      
      // Remove from performance monitoring
      Insp.globalRegistry.rem(this);
    }
    return this;
  },
  getDoneSender: function() {
    
    if (!this.sdDone) {
      // This may be the first request for a DoneSender; create it
      this.sdDone = Sender1x(`${this.getName()}.doneSender`);
      
      // The DoneSender is immediately used to send (and thereby ended)
      // if `this` is done
      if (this.done()) this.sdDone.send('done');
    }
    
    return this.sdDone;
    
  },
  
  // Sugar:
  getName: function() { return this.name || '<unnamed>'; },
  toString: function() { return this.getName(); },
  done: function() { return !this.bool(); },
  endWith: function(unsure, rem=false) {
    // Convenient way to force another Unsure to end along with `this`
    // Note this coupling is considered permanent by default - that is,
    // there is no way, by default, to remove the relationship that
    // `unsure` always ends when `this` ends
    return this.getDoneSender().add(() => unsure.end(), rem);
  },
  endWithFn: function(fn, rem=false) {
    // Convenient way to run a function when `this` ends. Note this
    // coupling is considered permanent by default - that is, there is
    // no way, by default, to remove the relationship that `fn` always
    // runs when `this` ends
    return this.getDoneSender().add(fn, rem);
  }
})});
let Sender = U.inspire({ name: 'Sender', methods: (insp, Insp) => ({
  init: function(name=null) {
    // `name` for debugging
    if (name) this.name = name;
    
    // A set of functions to send to
    this.trgs = Set();
  },
  getName: function() { return this.name || '<unnamed>'; },
  add: function(trg, rem=true) {
    // Add a function to be run when this Sender sends a value. This
    // creates a relationship between `this` sending, and `trg` (a
    // function) running. This relationship is considered temporary by
    // default - this is there is, by default, a mechanism to decouple
    // the function from running whenever `this` sends. The "coupling"
    // is considered to be its own Unsure, and ending it ends the
    // relationship
    this.trgs.add(trg);
    
    // Return an Unsure only if the relationship might be temporary
    return rem ? Unsure(() => this.trgs.rem(trg), `${this.getName()}.undoTrgSends`) : null;
  },
  send: function(...vals) {
    // Call all target functions with the provided arguments. Note an
    // edge case could occur if a target function's operation involves
    // adding a new target to this Sender. In this case the newly-added
    // target would be called within the same iteration of pre-existing
    // targets. This behaviour leads to awkward implementations, and so
    // it is avoided by iterating over a snapshot of all targets, rather
    // than the targets themselves. Any targets added mid-iteration will
    // not be added to the snapshot.
    // This leads to a secondary problem: a target may *remove* a
    // pre-existing target, mid-iteration. In this case it is awkward if
    // this mid-iteration change is *not* ignored. In order to avoid
    // running any targets in the snapshot, if they have been removed
    // mid-iteration, every snapsohtted target has its existence checked
    // in the original Set (`this.trgs`) to ensure it wasn't removed.
    for (let trg of [ ...this.trgs ]) if (this.trgs.has(trg)) trg(...vals);
  }
})});
let Sender1x = U.inspire({ name: 'Sender1x', insps: { Sender, Unsure }, methods: (insp, Insp) => ({
  init: function(name=null) {
    insp.Sender.init.call(this, name);
    insp.Unsure.init.call(this, null, name);
    
    // The arguments passed the one and only time this Sender sent
    this.sent1x = [];
  },
  getName: insp.Unsure.getName,
  add: function(trg, rem=true) {
    // Before a Sender1x sends it behaves exactly like a Sender
    if (this.bool()) return insp.Sender.add.call(this, trg, rem);
    
    // If this Sender1x has sent, avoid storing `trg` in memory and
    // instead immediately call it with the correct arguments
    trg(...this.sent1x);
    
    // Return an Unsure only if the `this.send() -> trg()` relationship
    // is temporary
    return rem ? Unsure().end(null, `${this.getName()} -> remTrg/instaEnded`) : null;
  },
  send: function(...vals) {
    // Prevent Sender1x from sending if it has already done so
    if (this.done()) return;
    
    // This is the one and only send that will occur:
    this.sent1x = vals;                           // store the argumnets
    this.end();                                   // immediately end
    insp.Sender.send.call(this, ...this.sent1x);  // send to targets
    this.trgs = null;                             // Free up memory
  },
  getDoneSender: function() {
    // An optimization is possible here, based on the fact that Sender1x
    // ends the moment it is told to send. The DoneSender must not send
    // any value while its related Unsure is active, and finally when
    // this Unsure ends the DoneSender must send exactly once to every
    // target that was waiting, and to any further targets. Because a
    // Sender1x has exactly the behaviour of sending a single value and
    // sending this value to any targets that are added later, a
    // Sender1x *is its own DoneSender* once it has sent its initial
    // value.
    // Why can't it be its own DoneSender *before* sending this value?
    // This is because a Sender1x may end when it sends, but not the
    // other way around: telling `Sender1x().end()` will not cause that
    // instance to send. Sender1x can complete its lifetime with 1 *or*
    // 0 sends. Imagine `let sd1 = Sender1x();`. In this case
    // `sd1.end()` would need to cause `sd1.send()` because
    // `sd1 === sd1.getDoneSender()`, and a send would be required from
    // that same instance to indicate "done"
    return this.done() ? this : insp.Unsure.getDoneSender.call(this);
  }
})});

let UnsureAnd = U.inspire({ name: 'UnsureAnd', insps: { Unsure }, methods: (insp, Insp) => ({
  
  // Provides an Unsure which is active while ALL of a set of child
  // Unsure instances are active. Note that ending `UnsureAnd(children)`
  // has no effect on the active state of any of those children! For
  // that it would be required to say:
  //  |     let us = UnsureAnd(children);
  //  |     for (let c of children) us.endWith(c);
  init: function(usList=[], name) {
    insp.Unsure.init.call(this, null, name);
    for (let unsure of usList) this.endWith(unsure.getDoneSender().add(() => this.end()));
  }
  
})});
let MemSender = U.inspire({ name: 'MemSender', insps: { Sender, Unsure }, methods: (insp, Insp) => ({
  
  // Applies history to a history-less Sender. Imagine a typical Sender
  // (`sender`) sends a bunch of values to some function, `listener1`.
  // After this is done we cause some `listener2` to listen to `sender`.
  // In this case `listener2` receives no values; it has missed its
  // chance. `sender` can't help, since it has no memory of any of the
  // values it sent. If we need `listener2` to receive the same values
  // as `listener1` in a situation like this, we should work with
  // `MemSender(sender)` instead of simply `sender`.
  
  init: function(sender, name) {
    insp.Unsure.init.call(this, null, name);
    insp.Sender.init.call(this, name);
    this.sender = sender;
    this.mode = null;
    
    this.msgs = Set();
    this.endWith(this.sender.add((...msg) => {
      let expMode = (msg.length === 1 && U.isInspiredBy(msg[0], Unsure)) ? 'dynamic' : 'static'
      if (!this.mode) this.mode = expMode;
      if (this.mode !== expMode) throw Error(`Mixed message types; first ${this.mode} then ${expMode}`);
      
      this.msgs.add(msg);
      if (this.mode === 'dynamic') UnsureAnd([ this, msg[0] ]).endWithFn(() => console.log(`a msg was removed`) || this.msgs.rem(msg));
      
      this.send(...msg);
    }));
    this.endWithFn(() => this.msgs = Set());
  },
  getName: insp.Unsure.getName,
  add: function(trg, rem=true) {
    for (let msg of this.msgs) trg(...msg);
    return insp.Sender.add.call(this, trg, rem);
  }
  
})});

let sd = Sender('source');
let ms = MemSender(sd, 'memSender');
let listener = name => {
  let set = Set();
  return val => {
    let log = (sym, val) => console.log(`${name} ${sym} ${val}; full: ${set.toArr(v => v).join(', ')}`);
    set.add(val); log('+++', val);
    if (U.isInspiredBy(val, Unsure)) val.endWithFn(() => (set.rem(val), log('---', val)));
  };
};

let ls1 = ms.add(listener('A')); // ms.add(val => console.log(`listener 1 GOT VAL: ${val}`));

sd.send(Unsure(null, 'hello1'));
sd.send(Unsure(null, 'hello2'));
sd.send(Unsure(null, 'hello3'));

let ls2 = ms.add(listener('B')); // ms.add(val => console.log(`listener 2 GOT VAL: ${val}`));

sd.send(Unsure(null, 'hello4'));
sd.send(Unsure(null, 'hello5'));
sd.send(Unsure(null, 'hello6'));

let ls3 = ms.add(listener('C')); // ms.add(val => console.log(`listener 3 GOT VAL: ${val}`));

for (let us of [ ...ms.msgs.toArr(v => v[0]), ls1, ls2, ls3 ]) us.end();

console.log(Unsure.globalRegistry.toArr(v => `${v}`), Unsure.globalRegistry.count(), ms.msgs.count());
//process.exit(0);

let mappings = {
  
  orig: {
    temporary: {
      Cls: U.water.Drop,
      getPosActive: 'isWet',
      getNegActive: 'isDry',
      setInactive: 'dry',
      getInactiveEventSender: 'drierNozz'
    },
    eventSender: {
      Cls: U.water.Nozz
    }
  },
  improved: {
    temporary: {
      Cls: Unsure,
      getPosActive: 'bool',
      getNegActive: 'done',
      setInactive: 'end',
      getInactiveEventSender: 'getDoneSender'
    },
    eventSender: {
      Cls: Sender,
      runFunctionOnEvent: 'add',
      doSendEvent: 'send'
    },
    eventSenderSingle: {
      Cls: Sender1x
    }
  }
  
};
let tests = [
  
  // Temporary and EventSingleSender
  ...[ 'temporary', 'eventSenderSingle' ].map(name => [
    async m => { // Ending a Temporary changes the results of getter methods
      let tmp = m[name].Cls();
      if (!tmp[m.temporary.getPosActive]()) throw Error(`getPosActive() === false before setInactive()`);
      if (tmp[m.temporary.getNegActive]()) throw Error(`getNegActive() === true before setInactive()`);
      tmp[m.temporary.setInactive]();
      if (tmp[m.temporary.getPosActive]()) throw Error(`getPosActive() === true after setInactive()`);
      if (!tmp[m.temporary.getNegActive]()) throw Error(`getNegActive() === false after setInactive()`);
    },
    async m => { // Send 0 events correctly
      let snd = m.eventSender.Cls();
      let events = [];
      snd[m.eventSender.runFunctionOnEvent](val => events.push(val));
      if (events.count() !== 0) throw Error(`Expected exactly 0 events; got ${events.count()}`);
    },
    async m => { // Inactive event sent when function applied before setInactive()
      let tmp = m[name].Cls();
      let snd = tmp[m.temporary.getInactiveEventSender]();
      let gotInactiveEvent = false;
      snd[m.eventSender.runFunctionOnEvent](() => gotInactiveEvent = true);
      tmp[m.temporary.setInactive]();
      if (!gotInactiveEvent) throw Error(`No inactive event received after setInactive()`);
    },
    async m => { // Inactive event sent when function applied after setInactive() (immediate setInactive)
      let tmp = m[name].Cls();
      tmp[m.temporary.setInactive]();
      let snd = tmp[m.temporary.getInactiveEventSender]();
      let gotInactiveEvent = false;
      snd[m.eventSender.runFunctionOnEvent](() => gotInactiveEvent = true);
      if (!gotInactiveEvent) throw Error(`No inactive event received after setInactive()`);
    },
    async m => { // Inactive event not sent when removed; function applied before setInactive()
      let tmp = m[name].Cls();
      let snd = tmp[m.temporary.getInactiveEventSender]();
      let gotInactiveEvent = false;
      let runFunctionOnEvent = snd[m.eventSender.runFunctionOnEvent](() => gotInactiveEvent = true);
      runFunctionOnEvent[m.temporary.setInactive]();
      tmp[m.temporary.setInactive]();
      if (gotInactiveEvent) throw Error(`Inactive event wrongly received after setInactive()`);
    }
  ]).flat(Infinity),
  
  // EventSender and EventSenderSingle
  ...[ 'eventSender', 'eventSenderSingle' ].map(name => [
    async m => { // Ensure single undefined value is sent correctly
      let snd = m[name].Cls();
      let events = [];
      snd[m.eventSender.runFunctionOnEvent](val => events.push(val));
      snd[m.eventSender.doSendEvent]();
      if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
    },
    async m => { // Ensure single set value is sent correctly
      let snd = m[name].Cls();
      let events = [];
      snd[m.eventSender.runFunctionOnEvent](val => events.push(val));
      snd[m.eventSender.doSendEvent]('haha');
      if (events.count() !== 1) throw Error(`Expected exactly 1 event; got ${events.count()}`);
      if (events[0] !== 'haha') throw Error(`Expected event value to be "haha"; got ${events[0]}`);
    }
  ]).flat(Infinity)
  
];

(async () => {
  
  for (let test of tests) {
    let name = (test.toString().match(/[/][/](.*)\n/) || { 1: '<unnamed>' })[1].trim();
    try {
      let result = await test(mappings.improved);
      console.log(`Test pass (${name})`);
    } catch (err) {
      console.log(`Test FAIL (${name}):\n${foundation.formatError(err)}`);
    }
  }
  
})();
