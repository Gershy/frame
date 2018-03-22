var package = new PACK.pack.Package({ name: 'app',
  dependencies: [ 'p', 'dossier', 'actionizer', 'server' ],
  buildFunc: function(ap, p, ds, az, sv) {
    
    var P = p.P;
    
    ap.App = U.makeClass({ name: 'App', methods: function(sc, c) { return {
      
      init: function(params /* name, setupChanneler, setupActionizer, setupOutline, genOutlineData, genView */) {
        
        this.name = U.param(params, 'name');
        this.setupChanneler = U.param(params, 'setupChanneler');
        this.setupActionizer = U.param(params, 'setupActionizer');
        this.setupOutline = U.param(params, 'setupOutline');
        this.genOutlineData = U.param(params, 'genOutlineData');
        
        this.activities = [];
        
        /// {CLIENT=
        this.genView = U.param(params, 'genView');
        /// =CLIENT}
        
      },
      $run: function() {
        
        var pass = this;
        
        /// {CLIENT=
        window.addEventListener('unload', function() { pass.$end().done(); }, { capture: true });
        /// =CLIENT}
        
        // Generate a Channeler
        var channeler = new sv.Channeler({ name: this.name, appName: this.name });
        this.setupChanneler(channeler);
        this.activities.push(channeler);
        
        // Generate an Actionizer
        var actionizer = new az.Actionizer({ channeler: channeler });
        this.setupActionizer(actionizer);
        
        // Generate an Outline and it's corresponding initial data
        var outline = new ds.Obj({ name: this.name, abilities: {
          output: actionizer.makeAbility('output', false, function(editor, doss, data) {
            var data = JSON.stringify(doss.getJson(), null, 2).replace(/"/g, '\'');
            console.log('OUTPUT:\n', data);
          })
        }});
        this.setupOutline(outline, actionizer);
        
        var outlineData = this.genOutlineData();
        
        var editor = new ds.Editor();
        var doss = editor.add({ outline: outline, data: outlineData });
        
        return editor.$transact()
          .then(function() { channeler.handler = doss; }) // Set `doss` as the request handler
          .then(channeler.as('$start'))                   // Start the channeler
          /// {CLIENT=
          .then(function() {                              // Generate the view
            
            var view = pass.genView(doss);
            view.start();
            
            pass.activities.push(view);
            
            window.doss = doss;
            window.view = view;
            
          })
          .then(doss.as('$useAbility', 'sync')) ;         // Sync `doss` to the server
          /// =CLIENT}
        
      },
      $end: function() {
        
        return new P({ all: A.map(this.activities, function(activity) {
          
          if (activity.stop)  return activity.stop();
          else                return activity.$stop();
          
        })});
        
      }
      
    };}});
    
  }
});
package.build();
