U.makeTwig({ name: 'clearing', twigs: [ 'record', 'hinterlands', 'real' ], make: (clearing, record, hinterlands, real) => {
  
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
    
    getMountainHutSetData: function() { throw new Error('not implemented'); },
    getObjectiveData: function() { throw new Error('not implemented'); },
    getInitialFrameId: function() { throw new Error('not implemented'); },
    getRealizer: function() { throw new Error('not implemented'); },
    
    deploy: async function() {
      
      let twig = await COMPILER.run(this.plan);
      
      let { Val, Obj, Arr, Editor } = record;
      let { OutlineHinterlands, OutlinePassage, PassageHttp, PassageSokt } = hinterlands;
      let { ClassicHtmlRealizer, Real, RealObj, RealArr, RealStr } = real;
      
      // Hinterlands outlining
      let otlLands = OutlineHinterlands({ name: 'lands', deployment: this });
      let otlObjective = otlLands.getChild('objective');
      
      // Passages outlining
      let otlPassages = otlLands.add(Obj({ name: 'passages' }));
      otlPassages.add(OutlinePassage({ name: 'http', recCls: PassageHttp, hinterlands: otlLands }));
      // otlPassages.add(OutlinePassage({ name: 'sokt', recCls: PassageSokt, hinterlands: otlLands }));
      
      // Plan-specific outlining
      twig.outline(otlLands);
      
      let editor = Editor();
      let lands = global.lands = editor.shape({ outline: otlLands, assumeType: 'exact', name: 'lands', data: {
        hutSet: this.getMountainHutSetData(),
        objective: this.getObjectiveData()
      }});
      editor.run();
      
      let initialFrameId = this.getInitialFrameId();
      if (initialFrameId !== null) lands.updateFrameId(initialFrameId);
      
      let realizer = this.getRealizer();
      if (realizer) {
        
        let realLands = RealObj({ name: 'lands', realizer });
        twig.realize(lands, realLands);
        
        await realizer.ready;
        realLands.up();
        
      }
      
    }
    
  })});
  
  /// {SERVER==========
  const path = require('path');
  const StandardBinding = U.makeClass({ name: 'StandardBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this, { ...params, host: '127.0.0.1', port: 80 });
      this.fileSystemRoot = path.join(__dirname, '..', '..', '.history');
      
    },
    
    getMountainHutSetData: function() {
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
    getRealizer: function() {
      return null; // TODO: possibility for graphical console or GUI here!
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
    
    getMountainHutSetData: function() {
      return global.INITIAL_HUT_SET_DATA;
    },
    getObjectiveData: function() {
      return global.INITIAL_CATCH_UP_DATA;
    },
    getInitialFrameId: function() {
      return global.INITIAL_FRAME_ID;
    },
    getRealizer: function() {
      return new real.ClassicHtmlRealizer();
    }
    
  })});
  /// ==========CLIENT}
  
  let deploymentEnvironmentMapping = {
    /// {SERVER==========
    standard: StandardBinding,
    heroku: HerokuBinding,
    openshift: OpenshiftBinding
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
  
  if (!deploymentEnvironmentMapping[args.deployment]) throw new Error(`Unsupported deployment: "${deployment}"`);
  let DeploymentBindingCls = deploymentEnvironmentMapping[args.deployment];
  
  let deployment = DeploymentBindingCls({ args });
  
  (async () => await deployment.deploy())();
  
}});
