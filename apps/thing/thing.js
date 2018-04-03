/*

Credential entry + login; generate a server-side Account

*/

var package = new PACK.pack.Package({ name: 'thing',
  /// {SERVER=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server' ],
  /// =SERVER}
  /// {CLIENT=
  dependencies: [ 'app', 'dossier', 'informer', 'p', 'server', 'userify'],
  /// =CLIENT}
  buildFunc: function(thing, ap, ds, nf, p, sv, uf) {
    
  },
  runAfter: function(thing, ap, ds, nf, p, sv, uf) {
    
    var App = ap.App;
    var P = p.P;
    
    new App({ name: 'thing',
      
      setupChanneler: function(channeler) {
        channeler.addChannel(new sv.ChannelHttp({ name: 'http', priority: 0, host: '192.168.1.148', port: 80, numToBank: 1 }));
        //channeler.addChannel(new sv.ChannelSocket({ name: 'sokt', priority: 1, port: 81 }));
      },
      setupActionizer: function(actionizer) {
      },
      setupOutline: function(thing, actionizer) {
        
        thing.addChild(new ds.Val({ name: 'text' }));
        actionizer.recurse(thing);
        
      },
      genOutlineData: function() {
        
        /// {SERVER=
        return {
          text: 'hihihi'
        };
        /// =SERVER}
        
        /// {CLIENT=
        return {
          text: ''
        };
        /// =CLIENT}
        
      },
      setupDoss: function(thing) {
      },
      /// {CLIENT=
      genView: function(thing) {
        
        return new uf.RootView({ name: 'root', children: [
          new uf.TextEditView({ name: 'text', info: thing.getChild('text'), syncOnInput: true })
        ]});
        
      }
      /// =CLIENT}
      
    }).$run().done();
    
  }
});
package.build();
