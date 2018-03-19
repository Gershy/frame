new PACK.pack.Package({ name: 'tree',
  buildFunc: function(tr) {
    
    tr.TreeNode = U.makeMixin({ name: 'TreeNode',
      methods: function(sc, c) { return {
        init: function(params /* */) {
          this.name = U.param(params, 'name');
          this.par = U.param(params, 'par', null);
        },
        getAncestry: function() {
          var ret = [];
          var ptr = this;
          while(ptr !== null) { ret.push(ptr); ptr = ptr.par; }
          return ret;
        },
        getNameChain: function() {
          return this.getAncestry().reverse().map(function(doss) { return doss.name.toString(); });
        },
        getAddress: function() {
          return this.getNameChain().join('.');
        },
        getRoot: function() {
          var ptr = this;
          while (ptr.par) ptr = ptr.par;
          return ptr;
        },
        getChild: function(addr) {
          if (addr.length === 0) return this; // Works for both strings and arrays
          
          if (U.isObj(addr, String)) addr = addr.split('.');
          else if (!U.isObj(addr, Array)) addr = [ addr ]; // `addr` is probably numeric
          
          var ptr = this;
          for (var i = 0, len = addr.length; (i < len) && ptr; i++) ptr = ptr.getNamedChild(addr[i].toString());
          
          return ptr;
        }
        // getNamedChild: function(name) { throw new Error('not implemented'); }
      };}
    });
    
  }
}).build();
