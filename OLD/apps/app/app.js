var package = new PACK.pack.Package({ name: 'app',
  dependencies: [ 'p', 'dossier', 'actionizer', 'server' ],
  buildFunc: function(ap, p, ds, az, sv) {
    
    var P = p.P;
    
    ap.App = U.makeClass({ name: 'App', methods: function(sc, c) { return {
      
      init: function(params /* name, setupChanneler, setupActionizer, setupOutline, genOutlineData, genView */) {
        
        this.name = U.param(params, 'name');
        this.setupChanneler = U.param(params, 'setupChanneler');
        this.setupActionizer = U.param(params, 'setupActionizer', null);
        this.setupOutline = U.param(params, 'setupOutline');
        this.setupActions = U.param(params, 'setupActions');
        this.genOutlineData = U.param(params, 'genOutlineData');
        this.run = U.param(params, 'run', function(doss) {});
        
        this.activities = [];
        
        /// {CLIENT=
        this.genView = U.param(params, 'genView', null);
        /// =CLIENT}
        
      },
      $start: function() {
        
        var pass = this;
        
        /// {CLIENT=
        window.addEventListener('unload', function() { pass.$end().done(); }, { capture: true });
        /// =CLIENT}
        
        // Generate a Channeler
        var channeler = new sv.Channeler({ name: 'channeler', appName: this.name });
        this.setupChanneler(channeler);
        this.activities.push(channeler);
        
        // Generate an Actionizer
        var actionizer = new az.Actionizer({ channeler: channeler });
        (this.setupActionizer || function() {})(actionizer);
        
        // Generate an Outline and it's corresponding initial data
        var outline = new ds.Obj({ name: this.name });
        outline.start();
        this.setupOutline(outline, actionizer, channeler);
        this.setupActions(outline, actionizer);
        
        var outlineData = this.genOutlineData();
        
        var editor = new ds.Editor();
        var doss = editor.add({ outline: outline, data: outlineData });
        actionizer.rootDoss = doss;
        
        var $act = function(doss, ability, data) {
          return actionizer.$do.bind(actionizer, doss, ability, data);
        };
        
        return editor.$transact()
          .then(function() {                            // Set `actionizer` as the request handler
            channeler.handler = actionizer;
            channeler.directToHandler = true;
          })
          .then(channeler.as('start'))                  // Start the channeler
          .then(this.run.bind(null, doss, actionizer, $act));
        
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
