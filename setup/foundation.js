/*
Huts are built on Foundations. There is OurHut representing ourself in
the hinterlands, and FarHuts representing others.

A Foundation sits on any platform which supports javascript - redhat,
digitalocean, heroku, browser, etc.

Huts connect to each other through a variable number of Connections

Huts can be uphill, downhill or level with each other. Any Hut may be at
the very top, or in communication with a single upwards Hut.

Any Hut with Huts underneath it can support a variety of Realities. A
Hut at the very bottom runs using a single Reality.
*/

(() => {
  let { Drop, Nozz, Funnel, TubVal, TubSet, TubDry, Scope, defDrier } = U.water;
  
  let Saved = U.inspire({ name: 'Saved', insps: { Drop }, methods: (insp, Insp) => ({
    init: function() {},
    getContentType: function() { return null; },
    update: C.notImplemented,
    getPipe: C.notImplemented,
    getContent: C.notImplemented,
    getNumBytes: C.notImplemented,
    onceDry: C.notImplemented
  })});
  let Goal = U.inspire({ name: 'Goal', methods: (insp, Insp) => ({
    init: function({ name, desc, detect, enact }) {
      ({}).gain.call(this, { name, desc, detect, enact, children: Set() });
    },
    attempt: async function(foundation, args) {
      if (!this.detect(args)) return false;
      await this.enact(foundation, args);
      for (let child of this.children) await child.attempt(foundation, args);
      return true;
    }
  })});
  
  let Foundation = U.inspire({ name: 'Foundation', methods: (insp, Insp) => ({
    init: function() {
      this.goals = this.defaultGoals();
      this.raiseArgs = {};
      this.root = this; // TODO: Eventually sub-instances of Foundation can exist
      this.uidCnt = 0;
    },
    defaultGoals: function() {
      
      let settleGoal = Goal({
        name: 'settle',
        desc: 'Settle our Hut down',
        detect: args => args.has('settle'),
        enact: async (foundation, args) => {
          let [ hut=null, bearing=null ] = args.settle.split('.');
          if (!args.has('title')) args.title = U.isType(hut, Object) ? hut.name : hut;
          
          let rootRoom = await foundation.establishHut({ hut, bearing, ...args });
          if (!rootRoom.built.has('open')) throw Error(`Room "${rootRoom.name}" isn't setup for settling`);
          
          console.log(`Settling ${rootRoom.name} on ${this.getPlatformName()}`);
          await rootRoom.built.open();
        }
      });
      
      return [ settleGoal ];
      
    },
    getPlatformName: C.notImplemented,
    
    // Platform
    getMs: function() { return +new Date(); },
    queueTask: C.notImplemented,
    makeHttpServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    makeSoktServer: async function(pool, ip, port) { C.notImplemented.call(this); },
    getRootReal: async function() { C.notImplemented.call(this); },
    formatError: C.notImplemented,
    getOrderedRoomNames: C.notImplemented,
    getTerm: C.notImplemented,
    getUid: function() { return U.base62(this.uidCnt++).padHead(8, '0'); },
    
    // Setup
    raise: async function(raiseArgs) {
      
      if (!raiseArgs.has('mode')) raiseArgs.mode = 'prod';
      
      this.raiseArgs = raiseArgs;
      let goalAchieved = false;
      for (let goal of this.goals) if (await goal.attempt(this, this.raiseArgs)) { goalAchieved = true; break; }
      if (!goalAchieved) console.log(`Couldn't achieve any goal based on args: ${JSON.stringify(this.raiseArgs, null, 2)}`);
      
    },
    establishHut: async function(args) { C.notImplemented.call(this); },
    parseUrl: function(url) {
      let [ full, protocol, host, port=80, path='/', query='' ] = url.match(/^([^:]+):\/\/([^:?/]+)(?::([0-9]+))?(\/[^?]*)?(?:\?(.+))?/);
      if (!path.hasHead('/')) path = `/${path}`;
      
      return {
        protocol, host, port, path,
        query: (query ? query.split('&') : []).toObj(pc => pc.has('=') ? pc.split('=') : [ pc, null ])
      };
    },
  })});
  
  U.setup.gain({ Saved, Goal, Foundation });
})();
