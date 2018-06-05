'use strict';

U.makeTwig({ name: 'clearing', twigs: [], make: clearing => {
  
  const DeploymentBinding = U.makeClass({ name: 'DeploymentBinding', methods: (insp, Cls) => ({
    
    init: function({ args }={}) {
      
      if (!args.hut) throw new Error('Missing "hut" argument');
      if (!O.has(args, 'debugMode')) throw new Error('Missing "debugMode" argument');
      
      this.args = args;
      this.debugMode = this.args.debugMode;
      this.hut = this.args.hut;
      this.host = this.args.host || null;
      this.port = this.args.port || null;
      
      /// {SERVER=
      this.fileSystemRoot = path.join(__dirname, 'twig', this.args.hut);
      /// =SERVER}
      
    }
    
  })});
  
  /// {SERVER==========
  const path = U.withProto(() => require('path'));
  const StandardBinding = U.makeClass({ name: 'StandardBinding', inspiration: { DeploymentBinding }, methods: (insp, Cls) => ({
    
    init: function(params={}) {
      
      insp.DeploymentBinding.init.call(this, params);
      this.fileSystemRoot = path.join(__dirname, this.hut);
      
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
      
    }
    
  })});
  /// ==========CLIENT}
  
  /// {SERVER==========
  let deployments = {
    standard: StandardBinding,
    heroku: HerokuBinding,
    openshift: OpenshiftBinding
  };
  /// =SERVER} {CLIENT=
  let deployments = {
    standard: BrowserBinding
  };
  /// ==========CLIENT}
  
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
  let args = O.include({
    debugMode: true,
    deployment: 'standard',
  }, parseArgs(process.argv.slice(2).join(' ')));
  
  if (!deployments[args.deployment]) throw new Error(`Unsupported deployment: "${deployment}"`);
  let DeploymentBindingCls = deployments[args.deployment];
  clearing.deployment = DeploymentBindingCls({ args });
  
}});
