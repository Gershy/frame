var package = new PACK.pack.Package({ name: 'creativity',
  dependencies: [ 'quickDev', 'userify', 'p', 'queries' ],
  buildFunc: function(packageName, qd, uf, p, qr) {
    
    var P = p.P;
    
    var cr = {};
    
    return cr;
    
  },
  runAfter: function(cr, qd, uf, p, qr) {
    
    var beginServer = {};
    
    var beginClient = (function() {
      
      var doss = new qd.DossierDict({ outline: null }).updateName('app');
      
      var infoSet = new uf.DictInfo({ children: {} });
      infoSet.addChild('icons', new uf.DictInfo({ children: {} }));
      
      infoSet.addChild('loginError', new uf.TemporaryInfo({ value: '', memoryMs: 3000 }));
      infoSet.addChild('username', new uf.SimpleInfo({ value: '' }));
      infoSet.addChild('password', new uf.SimpleInfo({ value: '' }));
      infoSet.addChild('token', new uf.SimpleInfo({ value: null }));
      
      infoSet.addChild('appVersion', new uf.RepeatingSyncedInfo({
        $getFunc: doss.$doRequest.bind(doss, { address: 'version', command: 'getData' })
      }));
      
      var rootView = new uf.RootView({ name: 'root', children: [
        
        new uf.ChoiceView({ name: 'login', choiceInfo: function() { return infoSet.getValue('token') ? 'in' : 'out' }, children: [
          
          new uf.SetView({ name: 'out', children: [
            
            new uf.TextHideView({ name: 'loginError', info: infoSet.getChild('loginError') }),
            new uf.TextEditView({ name: 'username', textInfo: infoSet.getChild('username'), placeholderData: 'Username' }),
            new uf.TextEditView({ name: 'password', textInfo: infoSet.getChild('password'), placeholderData: 'Password' }),
            new uf.ActionView({ name: 'submit', textInfo: 'Submit!', $action: function() {
              return doss.$doRequest({ command: 'getToken', params: {
                username: infoSet.getValue('username'),
                password: infoSet.getValue('password')
              }}).then(function(data) {
                infoSet.setValue('token', data.token);
              }).fail(function(err) {
                infoSet.setValue('loginError', err.message);
              });
            }})
            
          ]}),
          new uf.SetView({ name: 'in', children: [
            
          ]})
          
        ]}),
        new uf.TextView({ name: 'version', info: infoSet.getChild('appVersion') }),
        new uf.TextView({ name: 'rps', info: function() { return 'update: ' + rootView.updateTimingInfo + 'ms' } })
        
      ]});
      rootView.start();
      
      window.infoSet = infoSet;
      window.doss = doss;
      
    })();
    
  }
});
package.build();
