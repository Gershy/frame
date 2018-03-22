var package = new PACK.pack.Package({ name: 'actionizer',
  dependencies: [ 'p', 'dossier' ],
  buildFunc: function(az, p, ds) {
    
    var P = p.P;
    
    az.Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      init: function(params /* channeler */) {
        
        var channeler = this.channeler = U.param(params, 'channeler');
        
        this.sync = function(session, channelerParams, editor, doss, params /* */) {
          
          // Note that the server side never gives a "sync" command; the server is the source of truth,
          // it doesn't rely on any outside sources to synchronize it.
          // Attach a sync action to occur when the `editor` is done (but don't wait to fulfill $staged!)
          editor.$transaction.then(function() {
            
            /// {CLIENT=
            // The client side issues a sync command
            var command = 'sync';
            var params = {};
            /// =CLIENT}
            
            /// {SERVER=
            // The server side issues a mod command in response
            var command = 'mod';
            var params = { doSync: false, data: doss.getJson() };
            /// =SERVER}
            
            return channeler.$giveCommand({
              session: session,
              channelerParams: channelerParams,
              data: {
                address: doss.getAddress(),
                command: command,
                params: params
              }
            });
            
          }).done();
          
          return p.$null;
          
        };
        this.modVal = this.makeAbility('mod', true, function(editor, doss, data) {
          
          // TODO: It's not nearly this easy as the currentl uncommented code!
          // console.log('Mod not implemented ;D');
          // Modifying an object results in many removed, added, and modified children.
          // Verification needs to happen for everything in the tree of changes.
          
          editor.mod({ doss: doss, data: data });
          
        });
        this.modObj = this.makeAbility('mod', true, function(editor, doss, data, session, channelerParams) {
          
          return new P({ all: O.map(doss.outline.children, function(childOutline, childName) {
            
            var childData = data.hasOwnProperty(childName) ? data[childName] : null;
            
            var child = O.contains(doss.children, childName)
              ? doss.children[childName]
              : editor.add({ par: doss, name: childName, data: null });
            
            return child.$stageAbility('mod', session, channelerParams, editor, { data: childData, doSync: false });
            
          })});
          
        });
        this.modArr = this.makeAbility('mod', true, function(editor, doss, data, session, channelerParams) {
          
          return new P({ all: O.map(data, function(childData, childName) {
            
            // We don't want to recurse on objects. This is because objects will
            // add their children through their own 'mod' ability - and
            // `recurseObj` will generate all children, even if `data` is null
            var child = editor.add({ par: doss, data: null, recurseObj: false });
            return child.$stageAbility('mod', session, channelerParams, editor, { data: childData, doSync: false });
            
          })});
          
        });
        
      },
      makeAbility: function(name, invalidates, editsFunc) {
        
        /// {DOC=
        { desc: 'Makes a syncing ability, allowing the writer to worry only about the edits ' +
            'without needing to take anything else into account',
          params: {
            name: { desc: 'The unique name of the ability' },
            invalidates: { desc: 'Indicates whether this ability invalidates the Dossier' },
            editsFunc: { signature: function(editor, doss, data){},
              desc: 'A function which calls edit methods on `editor`. This method is allowed ' +
                'to return a promise',
              params: {
                editor: { desc: 'The editor' },
                doss: { desc: 'The Dossier instance which may be needed for some edits' },
                data: { desc: 'Arbitrary parameters for the ability' }
              }
            }
          }
        }
        /// =DOC}
        
        var channeler = this.channeler;
        
        return function(session, channelerParams, editor, doss, params /* doSync, data */) {
          
          // Perform whatever actions this ability ought to carry out
          var data = U.param(params, 'data');
          
          // The transaction may alter the Dossier's address! Get the current address early.
          var address = doss.getAddress();
          
          var $result = new P({ run: editsFunc.bind(null, editor, doss, data, session, channelerParams) });
          
          return $result.then(function() { // After `editsFunc` has run, prepare post-transaction to sync changes
            
            // When the editor transacts, sync any sessions as is necessary. This doesn't block $staging.
            editor.$transaction
              .then(function() {
                
                // Send worries if invalidated
                if (invalidates) doss.worry('invalidated');
                
                if (!U.param(params, 'doSync', false)) return;
                
                // Determine which sessions need to be informed, and then inform them!
                
                /// {CLIENT=
                // Resolves a list containing either one or zero sessions. If `doSync` is true, will sync
                // the server session (the only session of which a client session is aware).
                var sessionsToInform = { server: null }; // The only session a client can inform is the server session
                var commandParams = { data: data, doSync: true }; // The server should sync any other clients
                //if (doSync) console.log('Syncing server...');
                /// =CLIENT}
                
                /// {SERVER=
                // If `session` is set, it means that this modification was spurred on by that session.
                // That session does not need to be informed of the change, as it's the source of the change.
                // Resolves a list of sessions; either ALL sessions, or all sessions excluding the source.
                var sessionsToInform = O.clone(channeler.sessionSet);
                if (session !== null) delete sessionsToInform[session.ip];
                var commandParams = { data: data, doSync: false };
                
                //console.log('Server syncing: [ ' + Object.keys(sessionsToInform).join(', ') + ' ]');
                /// =SERVER}
                
                return new P({ all: O.map(sessionsToInform, function(sessionToInform) {
                  
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
                
              })
              .fail(console.error.bind(console))
              .done();
            
          });
          
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
            mod: this.modArr
          });
          
          this.recurse(outline.template);
          
        }
        
      }
    };}});
    
  }
});
package.build();
