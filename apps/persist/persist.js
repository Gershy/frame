var path = require('path');
var fs = require('fs');

new PACK.pack.Package({ name: 'persist',
  dependencies: [ 'p' ],
  buildFunc: function(packageName, p) {
    
    var P = p.P;
    
    var $readDir = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.readdir(pathName, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    var $createDir = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.mkdir(pathName, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    var $ensureDir = function(pathName) {
      
      var $ret = p.$null;
      
      var pcs = pathName.split(path.sep);
      var curPathName = pcs[0];
      
      for (var i = 1, len = pcs.length; i < len; i++) {
        
        (function(pn) {
          $ret = $ret.then($readDir.bind(null, pn)).then(function() {
            console.log('Dir ' + pn + ' already exists');
          }).fail(function() {
            console.log('Dir ' + pn + ' is MISSING; creating...');
            return $createDir(pn).then(function() { console.log('Created!'); });
          });
        }).call(null, curPathName = path.join(curPathName, pcs[i]));
        
      }
      
      return $ret.then(function() {
        console.log('Ensured: ' + pathName);
      });
      
    };
    var $ensureFile = function(pathName, content) {
      if (!U.exists(content)) content = '';
      
      // TODO: What if the file is huge?? Don't read it; instead check if it exists
      return $readFile(pathName).fail(function() {
        var pcs = pathName.split(path.sep);
        return $ensureDir(pcs.slice(0, pcs.length - 1).join(path.sep)).then($writeFile.bind(null, pathName, content));
      });
    };
    var $readFile = function(pathName) {
      return new P({ custom: function(resolve, reject) {
        fs.readFile(pathName, function(err, val) { if (err) reject(err); else resolve(val.toString()); });
      }});
    };
    var $writeFile = function(pathName, content) {
      return new P({ custom: function(resolve, reject) {
        fs.writeFile(pathName, content, function(err, val) { if (err) reject(err); else resolve(val); });
      }});
    };
    
    var pr = {};
    pr.update({
      Persister: U.makeClass({ name: 'Persister', 
        methods: function(sc, c) { return {
          init: function(params /* packageName, genDefaultData */) {
            this.packageName = U.param(params, 'packageName');
            this.genDefaultData = U.param(params, 'genDefaultData');
            
            this.pathName = null;
            
            if (ENVIRONMENT.type === 'default') {
              
              this.pathName = path.join(ENVIRONMENT.fileRootName, 'apps', this.packageName, 'state', 'state.json');
              
            } else if (ENVIRONMENT.type === 'openshift') {
              
              this.pathName = path.join(ENVIRONMENT.fileRootName, this.packageName, 'state.json');
              console.log('Persister (openshift) at: ' + this.pathName);
              
            }
            
          },
          $init: function() {
            
            return ENVIRONMENT.rawArgs.resetPersistedData
              ? $ensureFile(this.pathName).then($writeFile.bind(null, this.pathName, ''))
              : $ensureFile(this.pathName, '{}');
            
          },
          $getData: function() {
            var pass = this;
            return $readFile(this.pathName).then(function(data) {
              if (!data.trim().length) throw new Error(); // An empty file responds with default data
              return JSON.parse(data);
            }).fail(function() {
              var data = pass.genDefaultData();
              return pass.$putData(data).then(function() { return data; });
            });
          },
          $putData: function(data) {
            return $writeFile(this.pathName, JSON.stringify(data, null, 2));
          }
        };}
      })
    });
    
    return pr;
    
  }
}).build();
