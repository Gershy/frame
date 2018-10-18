U.makeTwig({ name: 'clearing', twigs: [ 'record', 'hinterlands', 'real' ], make: (clearing, record, hinterlands, real) => {
  
  /// {SERVER=
  const path = require('path');
  /// =SERVER}
  
  let { Val, Obj, Arr, Editor } = record;
  let { OutlineHinterlands, OutlinePassage, PassageHttp, PassageSokt } = hinterlands;
  let { ClassicHtmlRealizer, Real, RealObj, RealArr, RealStr } = real;
  
  const DeploymentBinding = U.makeClass({ name: 'DeploymentBinding', methods: (insp, Cls) => ({
    
    init: function({ args, host=null, port=null }={}) {
      
      if (!O.has(args, 'plan')) throw new Error('Missing "plan" argument');
      if (!O.has(args, 'debugMode')) throw new Error('Missing "debugMode" argument');
      
      this.args = args;
      this.debugMode = this.args.debugMode;
      this.plan = this.args.plan;
      this.host = O.has(args, 'host') ? args.host : host;
      this.port = O.has(args, 'port') ? args.port : port;
      this.ip = U.compactIp(this.host);
      
    },
    
    getHillHutSetData: function() { throw new Error('not implemented'); },
    getObjectiveData: function() { throw new Error('not implemented'); },
    getInitialFrameId: function() { throw new Error('not implemented'); },
    
    /// {SERVER=
    getServerSupportedRealizers: function() { throw new Error('not implemented'); },
    /// =SERVER}
    getOwnRealizers: function() { throw new Error('not implemented'); },
    
    deploy: async function() {
      
      let twig = await COMPILER.run(this.plan);
      
      // Hinterlands outlining
      let otlLands = OutlineHinterlands({ name: 'lands', deployment: this });
      let otlObjective = otlLands.getChild('objective');
      
      // TODO: Passages should be attached by implementation...
      // Passages outlining
      let otlPassages = otlLands.add(Obj({ name: 'passages' }));
      otlPassages.add(OutlinePassage({ name: 'http', recCls: PassageHttp, hinterlands: otlLands }));
      // otlPassages.add(OutlinePassage({ name: 'sokt', recCls: PassageSokt, hinterlands: otlLands }));
      
      // Plan-specific outlining
      twig.outline(otlLands);
      
      // Initialize the hut with hill-hut set and initial data
      let editor = Editor();
      let lands = global.lands = editor.shape({ outline: otlLands, assumeType: 'exact', name: 'lands', data: {
        hutSet: this.getHillHutSetData(),
        objective: this.getObjectiveData()
      }});
      editor.run();
      
      // Get the initial frame id we've been given by our server
      let initialFrameId = this.getInitialFrameId();
      if (initialFrameId !== null) lands.updateFrameId(initialFrameId);
      
      /// {SERVER=
      A.each(this.getServerSupportedRealizers(), clientRealizer => {
        
        twig.setupRealizer(clientRealizer);
        clientRealizer.prepareClientSupport(otlLands, lands);
        
      });
      /// =SERVER}
      
      await Promise.all(A.map(this.getOwnRealizers(), async ownRealizer => {
        
        twig.setupRealizer(ownRealizer);
        
        let realLands = RealObj({ name: 'lands', realizer: ownRealizer });
        
        twig.realizer(lands, ownRealizer, realLands);
        
        await ownRealizer.ready;
        
        realLands.up();
        
        // ownRealizer.addChild({ child: realLands });
        
      }));
      
    }
    
  })});
  
  /// {SERVER==========
  
  const StandardBinding = U.makeClass({ name: 'StandardBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this, { ...params, host: '127.0.0.1', port: 80 });
      this.fileSystemRoot = path.join(__dirname, '..', '..', '.history');
      
    },
    
    getHillHutSetData: function() {
      return null;
    },
    getObjectiveData: function() {
      // TODO: Needs to load history!
      let twig = TWIGS[this.plan].material;
      return O.has(twig, 'initialData') ? twig.initialData : null;
    },
    getInitialFrameId: function() {
      return null;
    },
    getOwnRealizer: function() {
      return null;
    },
    getServerSupportedRealizers: function() {
      return [ ClassicHtmlRealizer() ];
    },
    getOwnRealizers: function() {
      return [];
    }
    
  })});
  const HerokuBinding = U.makeClass({ name: 'HerokuBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this);
      
    }
    
  })});
  const OpenshiftBinding = U.makeClass({ name: 'OpenshiftBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this);
      
    }
    
  })});
  
  /// =SERVER} {CLIENT=
  
  const BrowserBinding = U.makeClass({ name: 'BrowserBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this, {
        ...params,
        host: window.location.hostname, // TODO: Really, this should be the browser's local address
        port: parseInt(window.location.port || 80) // TODO: incompatible with https
      });
      
    },
    
    getHillHutSetData: function() {
      return global.INITIAL_HUT_SET_DATA;
    },
    getObjectiveData: function() {
      return global.INITIAL_CATCH_UP_DATA;
    },
    getInitialFrameId: function() {
      return global.INITIAL_FRAME_ID;
    },
    getOwnRealizers: function() {
      return [ ClassicHtmlRealizer() ];
    }
    
  })});
  const AndroidBinding = U.makeClass({ name: 'AndroidBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this, params)
      
    }
    
  })});
  
  /// ==========CLIENT}
  
  let deploymentEnvironmentMapping = {
    /// {SERVER==========
    standard: StandardBinding,
    heroku: HerokuBinding,
    openshift: OpenshiftBinding,
    /// =SERVER} {CLIENT=
    standard: BrowserBinding
    /// ==========CLIENT}
  };
  
  let parseArgs = (rawArgs) => {
    
    if (rawArgs[0] === '{') return eval('(' + rawArgs + ')');
    let ret = {};
    let pcs = A.map(rawArgs.split('--'), arg => arg.trim());
    A.each(pcs, arg => {
      if (!arg) return;
      let [ k, ...v ] = arg.split(' ');
      ret[k] = v.join(' ') || true;
    });
    return ret;
    
  };
  let args = {
    debugMode: true,
    deployment: 'standard',
    ...parseArgs(process.argv.slice(2).join(' '))
  };
  
  if (!O.has(deploymentEnvironmentMapping, args.deployment)) throw new Error(`Unsupported deployment: "${args.deployment}"`);
  let DeploymentBindingCls = deploymentEnvironmentMapping[args.deployment];
  
  let deployment = DeploymentBindingCls({ args });
  
  (async () => await deployment.deploy())();
  
}});
