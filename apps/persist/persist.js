var path = require('path');
var fs = require('fs');

new PACK.pack.Package({ name: 'persist',
  dependencies: [ 'p' ],
  buildFunc: function(packageName, p) {
    
    var P = p.P;
    var pr = {};
    
    var $readDir = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.readdir(pathName, function(err, val) { if (err) reject(err); else resolve(val.toString()); });
      }});
    };
    var $createDir = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.mkdir(pathName, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    var $ensureDir = function(pathName) {
      return $readDir(pathName).fail(function() { return $createDir(pathName); });
    };
    var $readFile = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.readFile(pathName, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    var $writeFile = function(pathName, content) {
      return new P({ custom: function(resolve, reject) {
        fs.writeFile(pathName, content, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    
    pr.update({
      Persister: U.makeClass({ name: 'Persister', 
        methods: function(sc, c) { return {
          init: function(params /* packageName */) {
            this.packageName = U.param(params, 'packageName');
            this.genDefaultData = U.param(params, 'genDefaultData');
            
            this.pathName = null;
            
            if (ENVIRONMENT.type === 'default') {
              
              this.pathName = path.join(ENVIRONMENT.fileRootName, 'apps', this.packageName, 'state', 'state.json');
              
            } else if (ENVIRONMENT.type === 'openshift') {
              
              this.pathName = path.join(ENVIRONMENT.fileRootName, this.packageName, 'state', 'state.json');
              console.log('OPENSHIFT PERSIST PATH: ' + this.pathName);
              
            }
            
          },
          $init: function() {
            
            var pcs = this.pathName.split(path.sep);
            
            var $ret = $writeFile(path.join(pcs[0], 'thing.txt'), 'hello??').then(function() {
              
              console.log('WROTE thing.txt');
              
              return $readFile(path.join(pcs[0], 'thing.txt')).then(function(hello) {
                console.log('READ thing.txt:', hello);
              });
              
            });
            
            var pathName = pcs[0];
            
            for (var i = 1, len = pcs.length - 1; i < len; i++) {
              
              pathName = path.join(pathName, pcs[i]);
              $ret = $ret.then($ensureDir.bind(null, pathName));
              
            }
            
            return $ret;
            
          },
          $getData: function() {
            var pass = this;
            return $readFile(this.pathName).then(function(data) {
              if (!data.length) throw new Error(); // An empty file also results in default data
              if (ENVIRONMENT.type === 'openshift') console.log('Persist: getData length: ' + data.length);
              return JSON.parse(data);
            }).fail(function() {
              var data = pass.genDefaultData();
              return pass.$putData(data).then(function() { return data; });
            });
          },
          $putData: function(data) {
            if (ENVIRONMENT.type === 'openshift') console.log('Persist: putData length: ' + JSON.stringify(data, null, 2).length);
            return $writeFile(this.pathName, JSON.stringify(data, null, 2));
          }
        };}
      })
    });
    
    return pr;
    
  }
}).build();
