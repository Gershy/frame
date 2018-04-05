// TODO: This package defines specifically a DossierActionizer. Perhaps an abstract
// version can serve as the superclass some day?

var package = new PACK.pack.Package({ name: 'actionizer',
  dependencies: [ 'p', 'dossier' ],
  buildFunc: function(az, p, ds) {
    
    var P = p.P;
    
    az.Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      init: function(params /* channeler */) {
        
        var channeler = this.channeler = U.param(params, 'channeler');
        this.rootDoss = U.param(params, 'rootDoss', null);
        this.ablTree = {};
        
        // All types
        this.display = function(doss, data, stager) {
          
          console.log('DISPLAY:');
          console.log(JSON.stringify(doss.getJson(), null, 2));
          
        };
        
        // Val
        this.modVal = function(doss, data, stager) {
          
          console.log('DATA FOR ' + doss.identity() + ': ' + data);
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          editor.$transaction.then(doss.as('worry', 'invalidated')).done();
          
        };
        
        // Obj
        this.modObj = function(doss, data, stager) {
          
          var editor = stager.editor;
          var outlineChildren = doss.outline.children;
          
          for (var childName in outlineChildren) {
            
            var child = O.contains(doss.children, childName)
              ? doss.children[childName]
              : editor.add({ par: doss, name: childName, data: null });
            
            // Only stage 'mod' if data was provided for the child
            if (data.hasOwnProperty(childName)) stager(child, 'mod', data[childName]);
            
          }
          
        };
        
        // Arr
        this.modArr = function(doss, data, stager) {
          
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
          for (var k in mod) {
            stager(doss.children[k], 'mod', mod[k]);
          }
          for (var k in add) {
            var child = editor.add({ par: doss, data: null, name: k, recurseObj: false });
            stager(child, 'mod', add[k]);
          }
          
        };
        this.addArr = function(doss, data, stager) {
          
          var editor = stager.editor;
          
          // Adding a child will certainly invalidate
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          // Add `data` to `doss`
          var child = editor.add({ par: doss, data: null, recurseObj: false });
          stager(child, 'mod', data);
          return child;
          
        };
        this.remArr = function(doss, data, stager) {
          
          var editor = stager.editor;
          
          // Removing a child will certainly invalidate
          editor.$transaction.then(doss.as('worry', 'invalidated'));
          
          // Get the child; convert String to child instance if necessary
          var child = data;
          if (U.isObj(child, String)) child = doss.children[child];
          
          // Remove with `editor`
          editor.rem({ child: child });
          editor.$transaction.then(child.as('worry', 'invalidated'));
          
        };
        
        // Ref
        this.modRef = function(doss, data, stager) {
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          
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
              
              removeClosestWorry();
              
              var targetAddr = doss.getRefAddress();
              var approach = doss.approachChild(targetAddr);
              
              if (!approach.remaining.length) { // The reference is crystallized!
                
                if (!doss.isRooted()) return; // Crystallization happened too late - `doss` has been unrooted :(
                
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
          
        };
        
      },
      /*makeAbility: function(name, editsFunc) {
        
        var channeler = this.channeler;
        
        return function(doss, params /* sync, sessions, data * /, stager) {
          
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
      */
      addAbility: function(outline, name, machineScope, clientCanValidate, func) {
        
        /*
        syncData.session is either the commanding Session, or `null` representing "self"
        syncData.channelerParams is same as usual
        syncData.machineScope is either 'private', 'entrusted', or 'public', OR
          an Array or Object (of Sessions or ips) indicating the specific sessions
          which need to get the sync. Should possibly also have the option of being
          a function returning Object or Array - for dynamic WorryGroups (groups worried about the value being modified by the ability)
        syncData.clientCanValidate is a Boolean. If `true` the same operation is carried
          out simultaneously both client- and server-side. This is possible because
          each can validate (the server can ALWAYS validate, and we've explicitly
          labelled the client as being capable in this case). If `false` the client
          will wait for the server to perform the action, and will only perform the
          action itself if the server successfully performed it. If the server
          succeeded, any value resulting from the server's ability will become
          available for the client-side's attempt at running the same ability.

        CAREFUL: THIS IS A BIG CHANGE, MAY HAVE TO REVERT. PLEEEEASE DO NOT MAKE CHANGES OUTSIDE OF
        CONVERTING TO THIS NEW "syncData" FORMAT!!
        */
        
        if (O.contains(outline.metadata, name)) throw new Error('Tried to overwrite metadata: Outline(' + this.getAddress() + ').' + name);
        
        if (!U.isObj(clientCanValidate, Boolean)) throw new Error('Invalid clientCanValidate value: "' + clientCanValidate + '"');
        
        /// {CLIENT=
        if (machineScope !== 'private' && machineScope !== 'entrusted' && machineScope !== 'public')
          throw new Error('Invalid machineScope value: "' + machineScope + '"');
        /// =CLIENT}
        
        /// {SERVER=
        if (machineScope !== 'private' && machineScope !== 'entrusted' && machineScope !== 'public' && !U.isObj(machineScope, Function))
          throw new Error('Invalid machineScope value: "' + machineScope + '"');
        /// =SERVER}
        
        outline.metadata[name] = {
          name: name,
          machineScope: machineScope,
          clientCanValidate: clientCanValidate,
          func: func
        };
      
      },
      recurse: function(outline) {
        
        outline.addAbility('sync', 'global', true, this.sync);
        outline.addAbility('display', 'global', true, this.display);
        
        if (U.isInstance(outline, ds.Val)) {
          
          outline.addAbility('mod', 'global', true, U.isInstance(outline, ds.Ref) ? this.modRef : this.modVal);
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          outline.addAbility('mod', 'global', true, this.modObj);
          for (var k in outline.children) this.recurse(outline.children[k]);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          outline.addAbility('mod', 'global', true, this.modArr);
          outline.addAbility('rem', 'global', true, this.remArr);
          outline.addAbility('add', 'global', true, this.addArr);
          this.recurse(outline.template);
          
        }
        
      },
      
      $do: function(srcDoss, srcAbilityData, srcData) {
        
        var pass = this;
        
        // Note 2 extra params unlisted in the signature: `session` and `channelerParams`
        var srcSession = (arguments.length > 3) ? arguments[3] : null;
        var channelerParams = (arguments.length > 4) ? arguments[4] : null;
        
        // Make sure we work with a Dossier instance
        if (U.isObj(srcDoss, String)) srcDoss = this.rootDoss.getChild(srcDoss);
        if (!srcDoss) throw new Error('Couldn\'t get Dossier instance');
        
        // Make sure we work with an ability-data instance
        if (U.isObj(srcAbilityData, String)) srcAbilityData = srcDoss.outline.metadata[srcAbilityData];
        if (!srcAbilityData) throw new Error('Couldn\'t get ability-data');
        
        /// {SERVER=
        if (srcAbilityData.machineScope === 'entrusted' && !srcSession)
          throw new Error('Self-initiated an entrusted ability');
        /// =SERVER}
        
        // Set up the `stager`...
        var stager = function(doss, abilityData, data) {
          
          // Make sure we work with an ability data instance
          if (U.isObj(abilityData, String)) console.log('ABILITY: ' + doss.identity() + '.' + abilityData);
          if (U.isObj(abilityData, String)) abilityData = doss.outline.metadata[abilityData];
          if (!abilityData) throw new Error('Couldn\'t get ability-data');
          
          if (srcAbilityData.machineScope !== abilityData.machineScope)
            throw new Error('Ability with scope "' + srcAbilityData.machineScope + '" tried to stage an ability with scope "' + abilityData.machineScope + '"');
          
          return abilityData.func(doss, data, stager);
          
        };
        var editor = stager.editor = new ds.Editor();
        stager.session = srcSession;
        stager.consumeChannelerParams = function() {
          // `channelerParams` is only returned on the first call
          var ret = channelerParams;
          channelerParams = null;
          return ret || {};
        };
        stager.$use = function(doss, abilityData, data) {
          return pass.$do(doss, abilityData, data, srcSession, {}); // TODO: Session should probably be null here...
        };
        
        // Abilities may alter the Dossier's address! Get the address before anything is staged
        var origAddress = srcDoss.hasResolvedName() ? srcDoss.getAddress() : null;
        var channeler = this.channeler;
        
        var $sync = function() {
          
          // Determine `sessions`: the set of all Sessions which need to be synced
          
          /// {CLIENT=
          // Syncs NO sessions if the scope is private, otherwise syncs the server
          var sessions = srcAbilityData.machineScope !== 'private' ? [ channeler.serverSession ] : [];
          /// =CLIENT}
          
          /// {SERVER=
          var scope = srcAbilityData.machineScope;
          if (scope === 'private') {
            
            // A private ability on the server NEVER concerns any clients
            var sessions = [];
            
          } else if (scope === 'entrusted') {
            
            // Entrusted actions are ALWAYS initiated by the client. We'd
            // love to never do any syncing of entrusted data, but we need
            // to if the client isn't able to independently validate
            var sessions = srcAbilityData.clientCanValidate ? [] : [ srcSession ];
            
            // TODO: REMOVE THIS EVENTUALLY!!! It's here because entrusted
            // abilities aren't implemented yet. ONCE ENTRUSTED ABILITIES
            // WORK PLS REMOVE
            var sessions = [];
            
            
          } else if (scope === 'public') {
            
            // Public scope concerns all clients. The only occasion on which
            // a client isn't informed, is that it initiated the action and
            // was able to validate for itself.
            
            // Begin with all sessions...
            var sessions = O.clone(channeler.sessionSet);
            
            // If this action was initiated by a session and that session
            // could validate on its own, it doesn't need any syncing from
            // the server
            if (session && srcAbilityData.clientCanValidate) delete sessions[srcSession.ip];
            
          } else {
            
            // The scope changes over time! Calculate sessions manually
            var sessions = scope(srcDoss);
            
          }
          /// =SERVER}
          
          // Convert Array to Object
          if (U.isObj(sessions, Array)) sessions = A.toObj(sessions, function(s) { return U.isObj(s, String) ? s : s.ip; });
            
          // Convert String to actual Session instance
          sessions = O.map(sessions, function(sesh) {
            
            if (!U.isObj(sesh, String)) return sesh;
            
              // TODO: A little funky that the client-side references channeler.sessionSet
            if (!O.contains(channeler.sessionSet, sesh)) throw new Error('String ip doesn\'t correspond to any session: "' + sesh + '"');
            return channeler.sessionSet[sesh];
            
          });
          
          if (O.isEmpty(sessions)) return p.$null; // If no sessions to sync, we're done!
          
          // The only case where we prefer the address AFTER the transaction,
          // is the case where the address wasn't resolved beforehand
          var address = origAddress ? origAddress : srcDoss.getAddress();
          var command = srcAbilityData.name;
          
          if (false)
            console.log('SENDING TO:', Object.keys(sessions).join(', '), JSON.stringify({
              address: address,
              command: command,
              params: srcData
            }, null, 2));
          
          return new P({ all: O.map(sessions, function(session) {
            
            return channeler.$giveCommand({
              session: session,
              channelerParams: session === srcSession ? stager.consumeChannelerParams() : null,
              data: {
                address: address,
                command: command,
                params: srcData
              }
            });
            
          })});
          
        };
        
        var confirmRemoteSuccess = U.isServer() ? false : (!srcAbilityData.clientCanValidate);
        if (confirmRemoteSuccess) {
          
          console.log('syncing with confirmRemoteSuccess not implemented yet...');
          var $remoteSuccess = new P({ value: null }); // $sync should come first here
          
          return $remoteSuccess
            .then(stager.bind(null, srcDoss, srcAbilityData, srcData))
            .then(editor.$transact.bind(editor))
            .then($sync); // No $sync should happen at the end - we've confirmed it already happened!
          
        } else {
          
          var ret = stager(srcDoss, srcAbilityData, srcData);
          return editor.$transact().then(function() {
            $sync().done();
            return ret;
          });
          
        }
        
      },
      
      $heedCommand: function(params /* session, channelerParams, address, command, params }; */) {
        
        var data = params.params; // Consider this value "data", NOT "params"
        
        var doss = this.rootDoss.getChild(params.address);
        if (!doss) throw new Error('Invalid address: ', params.address.join('.'));
        
        var outline = doss.outline;
        if (!O.contains(outline.metadata, params.command)) throw new Error('Unsupported ability: ' + params.address.join('.') + '.' + params.command);
        
        return this.$do(doss, outline.metadata[params.command], data, params.session, params.channelerParams);
        
      }
      
    };}});
    
  }
});
package.build();
