var package = new PACK.pack.Package({ name: 'actionizer',
  dependencies: [ 'p', 'dossier' ],
  buildFunc: function(az, p, ds) {
    
    var P = p.P;
    
    az.Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      init: function(params /* channeler */) {
        
        var channeler = this.channeler = U.param(params, 'channeler');
        
        // All types
        this.sync = function(doss, params, /* */ stager) { // TODO: Could probably be implemented with `makeAbility`
          
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
            var params = { data: doss.getJson(), sync: 'none' };
            /// =SERVER}
            
            return channeler.$giveCommand({
              session: stager.session,
              channelerParams: stager.consumeChannelerParams(),
              data: {
                address: doss.getAddress(),
                command: command,
                params: params
              }
            });
            
          }).done();
          
        };
        this.display = this.makeAbility('display', function(doss, data, stager) {
          
          console.log('DISPLAY:');
          console.log(JSON.stringify(doss.getJson(), null, 2));
          
        });
        
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
            stager(child, 'mod', { data: add[k]});
          }
          
        });
        this.addArr = this.makeAbility('add', function(doss, data, stager) {
          
          var editor = stager.editor;
          
          // Adding a child will certainly invalidate
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          // Add `data` to `doss`
          return editor.add({ par: doss, data: data });
          
        });
        this.addsArr = this.makeAbility('adds', function(doss, data, stager) {
          
          if (O.isEmpty(data)) return;
          
          var editor = stager.editor;
          var added = {};
          
          for (var k in data) {
            added[k] = editor.add({ par: doss, data: null, name: k, recurseObj: false });
            stager(added[k], 'mod', { data: add[k] });
          }
          
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          return added;
          
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
          editor.$transaction.then(child.as('worry', 'invalidated'));
          
        });
        
        // Ref
        this.modRef = this.makeAbility('mod', function(doss, data, stager) {
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          
          /*
          setValue: function(value, sync) {
            
            if (this.wait) {
              console.log('Resetting `wait');
              this.wait.doss.remWorry('invalidated', this.wait.func);
              this.wait = null;
            }
            
            // DossierRef does something much more complicated if its value doesn't exist!!
            value = this.sanitizeValue(this, value);
            
            // Null values can always be set immediately
            if (value === null) return sc.setValue.call(this, value, sync);
            
            var addr = this.getRefAddress.call({ outline: this.outline, value: value });
            var child = this.getChild(addr);
            
            // Values referencing existant Dossiers can always be set immediately
            if (child) return sc.setValue.call(this, value, sync);
            
            // Here's the hard part: a nonexistant child has been referenced
            var closestChild = this.approachChild(addr).child;
            
            // No value is set; no ability is called! Keep getting closer and closer
            // children (detecting new children through "invalidated") until we
            // finally get to the target child
            var pass = this;
            this.wait = {
              doss: closestChild,
              func: closestChild.addWorry('invalidated', pass.setValue.bind(pass, value, sync))
            };
            
          }
          */
          
          editor.$transaction.then(function() {
            
            // The following is complicated! We only want to fire an `invalidated`
            // event on `doss` once its reference is crystallized. If it can't
            // fully dereference, we approach through the Dossier tree as far as
            // possible, and worry about the furthest-possible Dossier reached.
            // When this worry activates, we try the process again.
            
            // Assumes that the furthest-possible Dossier is a DossierArr, and will
            // trigger worries when it has children added (and when the possibility
            // of crystallizing the reference is renewed).
            
            // Handles removal of the furthest-possible Dossier, as removals trigger
            // invalidations.
            
            // It wouldn't be so complicated if adding worries were a resourceless
            // operation. Unfortunately we need to make sure that if an
            // uncrystallized reference is suddenly no longer needed (e.g. it's
            // removed or it suddenly refers to something else), our worry at the
            // tip of the approach is cleaned up.
            
            // So: We worry at the tip (TipWorry) and at the DossierRef (CleanupWorry)
            // - If CleanupWorry, we clean up TipWorry
            // - TipWorry, we update TipWorry to be set at the new tip
            // - If TipWorry and the reference crystallizes, clean up CleanupWorry
            //   (yes... clean up the clean up), and TipWorry
            
            // TODO: What if the DossierRef is deep in a Dossier tree which becomes
            // fully removed? This will not cause an invalidation worry at
            // DossierRef. The solution may be to invalidate the full tree?
            
            var closest = null;
            var tryValue = null;
            var removeClosestWorry = function() {
              if (closest) {
                closest.remWorry('invalidated', tryValue);
                closest = null;
              }
            };
            
            tryValue = function() {
              
              // console.log('Crystallizing ' + doss.identity() + '...');
              
              removeClosestWorry();
              
              var targetAddr = doss.getRefAddress();
              var approach = doss.approachChild(targetAddr);
              
              if (!approach.remaining.length) {
                
                // The reference is crystallized!
                
                // console.log('Approached fully!');
                
                if (!doss.isRooted()) return; // Crystallization happened too late - `doss` has been unrooted :(
                
                // console.log('Crystallized!');
                
                doss.remWorry('invalidated', removeClosestWorry);
                doss.worry('invalidated');
                return;
                
              }
              
              // console.log('Approached; missed by ' + approach.remaining.length);
              
              var closest = approach.child;
              closest.addWorry('invalidated', tryValue);
              
            };
            
            // Ensure that our worries on `closest` are cleaned up if `doss`
            // becomes unrooted or changes before it becomes crystallized
            doss.addWorry('invalidated', removeClosestWorry);
            
            tryValue();
            
          });
          //editor.$transaction.then(doss.as('worry', 'invalidated')).done();
          
        });
        
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
          
          // Perform whatever actions this ability ought to carry out
          var data = U.param(params, 'data');
          
          // The transaction may alter the Dossier's address!
          var origAddress = doss.hasResolvedName() ? doss.getAddress() : null;
          
          var sync = U.param(params, 'sync', 'none');
          /// {SERVER=
          if (sync === 'ensure') sync = 'quick'; // The server never needs clients to confirm a sync
          /// =SERVER}
          
          if (!A.contains([ 'none', 'quick', 'ensure' ], sync)) throw new Error('Invalid "sync" value: "' + sync + '"');
          
          // Run the `editsFunc` with `stager`
          var ret = editsFunc(doss, data, stager);
          
          if (sync !== 'none') {
            
            var $doSync = function() {
              
              // We only use the address AFTER the transaction when the original address
              // wasn't fully resolved
              var address = origAddress ? origAddress : doss.getAddress();
              
              /// {CLIENT=
              var propagate = U.param(params, 'propagate', true);
              var sessions = { server: { ip: location.hostname } };
              var commandParams = { data: data, sync: propagate ? 'quick' : 'none' }; // The server should sync other clients
              /// =CLIENT}
              
              /// {SERVER=
              
              // POSSIBLE `sessions` VALUES:
              // - NULL or STRING("peers"): Resolves to all sessions excepting the
              //    initiating session. To be used when the same ability is being
              //    carried out on both sides, so the only machines uninformed are
              //    all the clients besides the one which initiated this ability
              //
              // - ARRAY: An array containing Session instances. Precisely these
              //    sessions will be informed
              //
              // - STRING("all"): All sessions which the channeler is aware of will
              //    be informed
              //
              // - OBJECT({ <ip>: Session }): An Object of session ips mapped to
              //    full Session instances
              
              // Scrub out any necessary data
              var scrub = U.param(params, 'scrub', []);
              for (var i = 0, len = scrub.length; i < len; i++) delete data[scrub[i]];
              
              var sessions = U.param(params, 'sessions', 'peers');
              
              if (sessions === null) throw new Error('Got null "sessions" param');
              
              if (sessions === 'peers')  { // If syncing without any explicit sessions, default to informing all sessions but the source
                
                sessions = O.clone(channeler.sessionSet);
                if (session !== null) delete sessions[session.ip];
                
              } else if (sessions === 'all') {
                
                sessions = channeler.sessionSet;
                
              } else {
                
                if (U.isObj(sessions, Array)) sessions = A.toObj(sessions, function(s) { return U.isObj(s, String) ? s : s.ip; });
                
                for (var k in sessions) {
                  var sesh = sessions[k];
                  if (U.isObj(sesh, String)) {
                    if (!O.contains(channeler.sessionSet, sesh)) throw new Error('String ip doesn\'t correspond to any session: "' + sesh + '"');
                    sessions[k] = channeler.sessionSet[sesh];
                  }
                }
                
              }
              
              if (O.isEmpty(sessions)) return p.$null; // If no sessions to sync, we're done!
              
              var commandParams = { data: data, sync: 'none' }; // Clients should not sync the server back
              
              if (false)
                console.log('SENDING TO:', O.toArr(sessions, function(s) { return s.ip; }).join(', '), JSON.stringify({
                  address: address,
                  command: name,
                  params: commandParams
                }, null, 2));
              
              /// =SERVER}
              
              return new P({ all: O.map(sessions, function(sessionToInform) {
                
                return channeler.$giveCommand({
                  session: sessionToInform,
                  channelerParams: sessionToInform === session ? stager.consumeChannelerParams() : null,
                  data: {
                    address: address,
                    command: name,
                    params: commandParams
                  }
                });
                
              })});
              
            };
            
            if (sync === 'ensure') {
              
              throw new Error('confirm-type syncing not implemented');
              
              // Force the call to `editor.$transact` to delay until it is confirmed
              // that the operation worked on the other side
              
            } else {
              
              // Do the sync once it's confirmed to have worked on our side
              editor.$transaction.then($doSync).done();
              
            }
            
          }
          
          return ret;
          
        };
        
      },
      recurse: function(outline) {
        
        if (U.isInstance(outline, ds.Val)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            display: this.display,
            mod: U.isInstance(outline, ds.Ref) ? this.modRef : this.modVal
          });
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            display: this.display,
            mod: this.modObj
          });
          
          for (var k in outline.children) this.recurse(outline.children[k]);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          O.update(outline.abilities, {
            sync: this.sync,
            display: this.display,
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
