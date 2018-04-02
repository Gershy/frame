var package = new PACK.pack.Package({ name: 'actionizer',
  dependencies: [ 'p', 'dossier' ],
  buildFunc: function(az, p, ds) {
    
    var P = p.P;
    
    az.Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      init: function(params /* channeler */) {
        
        var channeler = this.channeler = U.param(params, 'channeler');
        
        // All types
        this.sync = function(doss, params, /* */ stager) {
          
          // Note that the server side never gives a "sync" command; the server is the source of truth,
          // it doesn't rely on any outside sources to synchronize it.
          // Attach a sync action to occur when the `editor` is done (but don't wait to fulfill $staged!)
          stager.editor.$transaction.then(function() {
            
            /// {CLIENT=
            // The client side issues a sync command
            var command = 'sync';
            var params = {};
            /// =CLIENT}
            
            /// {SERVER=
            // The server side issues a mod command in response
            var command = 'mod';
            var params = { data: doss.getJson(), sync: 'quick' };
            /// =SERVER}
            
            return channeler.$giveCommand({
              session: stager.session,
              channelerParams: stager.channelerParams,
              data: {
                address: doss.getAddress(),
                command: command,
                params: params
              }
            });
            
          }).done();
          
          return p.$null;
          
        };
        
        // Val
        this.modVal = this.makeAbility('mod', function(doss, data, stager) {
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          editor.$transaction.then(doss.as('worry', 'invalidated')).done();
          
        });
        
        // Obj
        this.modObj = this.makeAbility('mod', function(doss, data, stager) {
          
          var editor = stager.editor;
          var outlineChildren = doss.outline.children;
          
          for (var childName in outlineChildren) {
            
            var child = O.contains(doss.children, childName)
              ? doss.children[childName]
              : editor.add({ par: doss, name: childName, data: null });
            
            // Only stage 'mod' if data was provided for the child
            if (data.hasOwnProperty(childName))
              stager(child, 'mod', { data: data[childName] });
            
          }
          
        });
        
        // Arr
        this.modArr = this.makeAbility('mod', function(doss, data, stager) {
          
          var editor = stager.editor;
          
          var add = {};                     // childName -> childData
          var mod = {};                     // childName -> childData
          var rem = O.clone(doss.children); // childName -> childInstance
          
          for (var k in data) {
            var name = k;
            delete rem[name];
            (O.contains(doss.children, name) ? mod : add)[name] = data[name]; // Fancy!
          }
          
          // Invalidate for rems and adds - mods invalidate the child, not the parent Arr
          if (!O.isEmpty(rem) || !O.isEmpty(add))
            editor.$transaction.then(doss.as('worry', 'invalidated')); // TODO: Easy to include delta here...
          
          for (var k in rem) {
            editor.rem({ child: rem[k] });
            editor.$transaction.then(rem[k].as('worry', 'invalidated')); // Invalidate removed children
          }
          for (var k in mod) stager(doss.children[k], 'mod', { data: mod[k] });
          for (var k in add) {
            var child = editor.add({ par: doss, data: null, name: k, recurseObj: false });
            stager(child, 'mod', { data: add[k] });
          }
          
        });
        this.addArr = this.makeAbility('add', function(doss, data, stager) {
          
          var editor = stager.editor;
          
          // Adding a child will certainly invalidate
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          // Add `data` to `doss`
          return editor.add({ par: doss, data: data });
          
        });
        this.remArr = this.makeAbility('rem', function(doss, data, stager) {
          
          var editor = stager.editor;
          
          // Removing a child will certainly invalidate
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          // Get the child; convert String to child instance if necessary
          var child = data;
          if (U.isObj(child, String)) child = doss.children[child];
          
          // Remove with `editor`
          editor.rem({ child: child });
          
        });
        
        // TODO: What happens when a Ref is synced, but the Ref target isn't available?
        // Probably need to sync Refs differently or something...
        
      },
      makeAbility: function(name, editsFunc) {
        
        /// {DOC=
        { desc: 'Makes a syncing ability, allowing the writer to worry only about the edits ' +
            'without needing to take anything else into account',
          params: {
            name: { desc: 'The unique name of the ability' },
            editsFunc: { signature: function(doss, data, stager){},
              desc: 'A function which calls edit methods on `editor`. This method is allowed ' +
                'to return a promise',
              params: {
                doss: { desc: 'The Dossier instance which may be needed for some edits' },
                data: { desc: 'Arbitrary parameters for the ability' },
                stager: { signature: function(doss, abilityName, params){},
                  desc: 'Convenient shorthand function for further calling Dossier abilities',
                  params: {
                    doss: { desc: 'The Dossier on which to call the ability' },
                    abilityName: { desc: 'The name of the ability to call' },
                    params: { desc: 'Arbitrary params to the ability' }
                  }
                }
              }
            }
          }
        }
        /// =DOC}
        
        var channeler = this.channeler;
        
        return function(doss, params /* sync, sessions, data */, stager) {
          
          var editor = stager.editor;
          var session = stager.session;
          var channelerParams = stager.channelerParams;
          
          // Perform whatever actions this ability ought to carry out
          var data = U.param(params, 'data');
          
          // The transaction may alter the Dossier's address!
          var origAddress = doss.hasResolvedName() ? doss.getAddress() : null;
          
          var sync = U.param(params, 'sync', 'none');
          /// {SERVER=
          if (sync === 'ensure') sync = 'quick'; // The server never needs clients to confirm a sync
          /// =SERVER}
          
          if (!A.contains([ 'none', 'quick', 'confirm' ], sync)) throw new Error('Invalid "sync" value: "' + sync + '"');
          
          // Run the `editsFunc` with `stager`
          var $staged = new P({ run: editsFunc.bind(null, doss, data, stager) });
          
          if (sync !== 'none') {
            
            var $doSync = function() {
              
              // We only use the address AFTER the transaction when the original address
              // wasn't fully resolved
              var address = origAddress ? origAddress : doss.getAddress();
              
              /// {CLIENT=
              var sessions = { server: { ip: location.hostname } };
              var commandParams = { data: data, sync: 'quick' }; // The server should sync other clients
              /// =CLIENT}
              
              /// {SERVER=
              var sessions = U.param(params, 'sessions', null);
              if (!sessions)  { // If syncing without any explicit sessions, default to informing all sessions but the source
                sessions = O.clone(channeler.sessionSet);
                if (session !== null) delete sessions[session.ip];
              }
              if (U.isObj(sessions, Array)) sessions = A.toObj(sessions, function(s) { return s.ip; });
              var commandParams = { data: data, sync: 'none' }; // Clients should not sync the server back
              /// =SERVER}
              
              return new P({ all: O.map(sessions, function(sessionToInform) {
                
                return channeler.$giveCommand({
                  session: sessionToInform,
                  channelerParams: sessionToInform === session ? channelerParams : null,
                  data: {
                    address: address,
                    command: name,
                    params: commandParams
                  }
                });
                
              })});
              
            }
            
            if (sync === 'confirm') {
              
              // TODO: $doSync() resolves that the command was sent, but not that it completed successfully...
              // TODO: Maybe $staged should be a function so it doesn't begin to immediately stage?
              // Refuse to resolve the staging until the sync is complete
              return $doSync().then(function() { return $staged; });
              
            } else {
              
              $doSync().done();
              return $staged;
              
            }
            
          } else {
            
            return $staged;
            
          }
          
        };
        
      },
      recurse: function(outline) {
        
        if (U.isInstance(outline, ds.Val)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modVal
          });
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modObj
          });
          
          for (var k in outline.children) this.recurse(outline.children[k]);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            mod: this.modArr,
            rem: this.remArr,
            add: this.addArr
          });
          
          this.recurse(outline.template);
          
        }
        
      }
    };}});
    
  }
});
package.build();
