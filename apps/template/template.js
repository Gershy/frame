/*

Credential entry + login; generate a server-side Account

*/

var package = new PACK.pack.Package({ name: 'template',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify'],
  /// =CLIENT}
  buildFunc: function(tmp, ap, ds, nf, p, sv, uf) {
    
  },
  runAfter: function(tmp, ap, ds, nf, p, sv, uf) {
    
    var App = ap.App;
    var P = p.P;
    
    new App({ name: 'template',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
        
      },
      setupOutline: function(template) {
        
        template.addChild(new ds.Val({ name: 'text' }));
        
      },
      setupActions: function(template, actionizer) {
        
        actionizer.addAbility(template, 'mod', 'public', true, actionizer.modVal);
        
      },
      genOutlineData: function() {
        
        /// {SERVER=
        return {
          text: 'hihihi'
        };
        /// =SERVER}
        
        /// {CLIENT=
        return {
        };
        /// =CLIENT}
        
      },
      run: function(template, actionizer) {
        
        /// {CLIENT=
        var view = new uf.RootView({ name: 'root', children: [
          new uf.TextEditView({ name: 'text', info: actionizer.enliven(template.getChild('text'), 'mod') })
        ]});
        view.start();
        /// =CLIENT}
        
      }
      
    }).$start().done();
    
  }
});
package.build();
