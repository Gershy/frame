// TODO: This package defines specifically a DossierActionizer. Perhaps an abstract
// version can serve as the superclass some day?

var package = new PACK.pack.Package({ name: 'actionizer',
  dependencies: [ 'p', 'informer', 'dossier' ],
  buildFunc: function(az, p, nf, ds) {
    
    var P = p.P;
    
    // Changes to a dossier sync to all aware sessions
    // Adding a session causes current dossier to sync
    // Removing a session causes the dossier to sync as `null`
    
    az.DossierAction = U.makeClass({ name: 'DossierAction', methods: function(sc, c) { return {
      
      // TODO: HEEERE, need to redo standard abilities to consider a 1st `rootDoss` param,
      // as well as worry "rootInvalidated" if necessary
      init: function(params /* name, clientResolves, clientVerifies, sessions, func(rootDoss, doss, data, stager, isRootAbility) */) {
        
        this.name = U.param(params, 'name');
        this.clientResolves = U.param(params, 'clientResolves');
        this.clientVerifies = U.param(params, 'clientVerifies', this.clientResolves);
        this.func = U.param(params, 'func', null);
        
        /// {CLIENT=
        if (O.contains(params, 'sessions')) throw new Error('Provided "sessions" param');
        if (this.clientVerifies && !this.clientResolves) throw new Error('Invalid config: client can verify but not use');
        if (!this.clientResolves && this.func) throw new Error('Invalid config: client can\'t use, but "func" provided');
        /// =CLIENT}
        
      }
      
    };}});
    
    az.DossierInformer = U.makeClass({ name: 'DossierInformer', superclass: nf.Informer, methods: function(sc, c) { return {
      
      init: function(params /* actionizer, doss, abilityName */) {
        sc.init.call(this, params);
        this.actionizer = U.param(params, 'actionizer');
        this.abilityName = U.param(params, 'abilityName');
        this.doss = U.param(params, 'doss');
        this.func = null;
        
      },
      
      getValue: function() {
        return this.doss.getInternalValue();
      },
      setValue: function(val) {
        // Override `setValue` (instead of `setValue0`) to avoid the immediate call to `invalidated`
        // When `this.doss` finally invalidates, it will worry `this`, causing it to also
        // invalidate.
        this.actionizer.$do(this.doss, this.abilityName, val).done();
      },
      
      isStarted: function() {
        return !!this.func;
      },
      start: function() {
        this.func = this.worry.bind(this, 'invalidated');
        this.doss.addWorry('invalidated', this.func);
        sc.start.call(this);
      },
      stop: function() {
        sc.stop.call(this);
        this.doss.remWorry('invalidated', this.func);
        this.func = null;
      }
      
    };}});
    
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
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          editor.$transaction.then(doss.as('worry', 'invalidated')).done();
          
        };
        
        // Obj
        this.modObj = function(doss, data, stager) {
          
          var editor = stager.editor;
          var outlineChildren = doss.outline.children;
          
          // TODO: Checking to ensure that each property in `data`
          // actually corresponds to a child of `doss` could save
          // a lot of frustration and hard-to-debug moments
          
          // One of the main blockers to this is the lack of "scrub"
          // functionality to filter out server-side values which
          // shouldn't get synced (they don't correspond to anything
          // server-side)
          
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
      addAbility: function(outline, dossAction) {
        
        /*
        syncData.session is either the commanding Session, or `null` representing "self"
        syncData.channelerParams is same as usual
        syncData.machineScope is either 'private', 'entrusted', 'public',
          'serverSourced', OR an Array or Object (of Sessions or ips) indicating the
          specific sessions which need to get the sync. Should possibly also have
          the option of being a function returning Object or Array - for dynamic
          WorryGroups (groups worried about the value being modified by the ability)
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
        
        var name = dossAction.name;
        if (O.contains(outline.metadata, name)) throw new Error('Tried to overwrite metadata with action: Outline(' + this.getAddress() + ').' + name);
        outline.metadata[name] = dossAction;
      
      },
      recurse: function(outline, machineScope, clientCanValidate) {
        
        this.addAbility(outline, 'display', machineScope, clientCanValidate, this.display);
        
        if (U.isInstance(outline, ds.Val)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, U.isInstance(outline, ds.Ref) ? this.modRef : this.modVal);
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, this.modObj);
          for (var k in outline.children) this.recurse(outline.children[k], machineScope, clientCanValidate);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, this.modArr);
          this.addAbility(outline, 'rem', machineScope, clientCanValidate, this.remArr);
          this.addAbility(outline, 'add', machineScope, clientCanValidate, this.addArr);
          this.recurse(outline.template, machineScope, clientCanValidate);
          
        }
        
      },
      enliven: function(doss, abilityName) {
        return new az.DossierInformer({ actionizer: this, doss: doss, abilityName: abilityName || 'mod' });
      },
      
      $sync: function(origAddress, doss, abilityData, data, session, channelerParams, specificSessions) {
        
        // Determine `sessions`: the set of all Sessions which need to be synced
        var channeler = this.channeler;
        
        /// {CLIENT=
        // Syncs NO sessions if the scope is private, otherwise syncs the server
        var sessions = {};
        if (abilityData.machineScope !== 'private') sessions[channeler.serverSession.ip] = channeler.serverSession;
        /// =CLIENT}
        
        /// {SERVER=
        var scope = abilityData.machineScope;
        if (specificSessions) { // TODO: BAD
          
          var sessions = specificSessions;
          
        } if (scope === 'private') {
          
          // A private ability on the server NEVER concerns any clients
          var sessions = {};
          
        } else if (scope === 'entrusted') {
          
          // Entrusted actions are ALWAYS initiated by the client. We'd
          // love to never do any syncing of entrusted data, but we need
          // to if the client isn't able to independently validate
          var sessions = {};
          sessions[session.ip] = session;
          
        } else if (scope === 'public' || scope === 'serverSourced') {
          
          // Change applies to all sessions
          var sessions = O.clone(channeler.sessionSet);
          
        } else {
          
          // The scope changes over time! Calculate sessions manually.
          // `scope` must be a function
          var sessions = scope(channeler.sessionSet, doss);
          console.log('FOR ' + doss.identity() + '.' + abilityData.name + ':', Object.keys(sessions).join(', '));
          
        }
        /// =SERVER}
        
        // Ensure we're working with an `Object`
        if (!U.isObj(sessions, Object)) throw new Error('Sessions list must be an Object');
        
        if (session) {
          
          if (!O.contains(sessions, session.ip)) // Ensure that the client is included (to force good design)
            throw new Error('Syncing ability doesn\'t include the initiating client: ' + doss.identity() + '.' + abilityData.name);
          
          if (abilityData.clientCanValidate) // Never sync a self-validating client
            delete sessions[session.ip];
            
        }
        
        // Map any Strings to Session instances
        sessions = O.map(sessions, function(sesh) {
          
          if (!U.isObj(sesh, String)) return sesh;
          
          // TODO: A little funky that the client-side uses the term "channeler.sessionSet"
          if (!O.contains(channeler.sessionSet, sesh)) throw new Error('String ip doesn\'t correspond to any session: "' + sesh + '"');
          return channeler.sessionSet[sesh];
          
        });
        
        if (O.isEmpty(sessions)) return p.$null; // If no sessions to sync, we're done!
        
        // The only case where we prefer the address AFTER the transaction,
        // is the case where the address wasn't resolved beforehand
        var commandData = {
          address: origAddress ? origAddress : doss.getAddress(),
          command: abilityData.name,
          params: data
        };
        
        if (false) {
          
          var seen = [];
          console.log('SEND (' + Object.keys(sessions).join(', ') + ') --> ' + JSON.stringify(commandData, function(k, v) {
            
            if (U.isPrimitive(v)) return v;
            if (U.isInstance(v, ds.Dossier)) return v.identity();
            if (~seen.indexOf(v)) return '<CIRC>';
            if (seen.length > 30) return 'TOO MANY';
            seen.push(v);
            return v;
            
          }, 2));
          
        }
        
        return new P({ all: O.map(sessions, function(trgSession) {
          
          return channeler.$giveCommand({
            session: trgSession,
            channelerParams: trgSession === session ? channelerParams : {},
            data: commandData
          });
          
        })});
        
      },
      validateAbility: function(doss, ability, session) {
        
        if (!ability) throw new Error('Missing ability');
        
      },
      $do: function(srcDoss, srcAbility, srcData) {
        
        var pass = this;
        var rootDoss = this.rootDoss;
        
        // Note 3 extra params unlisted in the signature: `srcSession`, `srcChannelerParams`, `srcSessions`
        var srcSession = (arguments.length > 3) ? arguments[3] : null;
        var srcChannelerParams = (arguments.length > 4) ? arguments[4] : null;
        var srcSessions = (arguments.length > 5) ? arguments[5] : null;
        
        // Make sure we work with a Dossier instance
        if (U.isObj(srcDoss, String)) srcDoss = rootDoss.getChild(srcDoss);
        if (!srcDoss) throw new Error('Couldn\'t get Dossier instance');
        
        // Make sure we work with an Ability instance
        if (U.isObj(srcAbility, String)) {
          if (!O.contains(srcDoss.outline.metadata, srcAbility))  throw new Error('Couldn\'t get ability: ' + srcDoss.identity() + '.' + srcAbility);
          srcAbility = srcDoss.outline.metadata[srcAbility];
        }
        
        this.validateAbility(srcDoss, srcAbility, srcSession);
        
        // Resolve `srcData` as an actual value
        if (U.isObj(srcData, Function)) srcData = srcData(srcDoss.getInternalValue(), srcDoss);
        
        // Abilities may alter the Dossier's address! Get the address before anything is staged
        var origAddress = srcDoss.hasResolvedName() ? srcDoss.getAddress() : null;
        var doSync = true;
        
        /// {CLIENT=
        if (!srcAbility.clientValidates && !srcSession) {
          
          // The client is trying to perform a self-initiated ability it can't
          // validate itself. ONLY perform the sync, take no actual action. The
          // server will get the command and realize we couldn't validate it
          // ourselves. It will then validate/perform the command and sync us
          // in return. When that happens we'll arrive here again except
          // `srcSession` will be non-null
          return this.$sync(origAddress, srcDoss, srcAbility, srcData, srcSession, srcChannelerParams);
          
        } else if (!srcAbility.clientCanValidate) {
          
          // We can't validate this ability, but the request is coming from the
          // server! Just make sure that we don't sync this time, since this is
          // already the result of a sync.
          doSync = false;
          
        }
        /// =CLIENT}
        
        // Set up the `stager`...
        var stager = function(doss, ability, data) {
          
          var rootAbility = !!arguments[3];
          
          if (!doss) throw new Error('No doss');
          
          // Make sure we work with an ability data instance
          if (U.isObj(ability, String)) {
            if (!O.contains(doss.outline.metadata, ability)) throw new Error('Couldn\'t get ability-data: ' + doss.identity() + '.' + ability);
            ability = doss.outline.metadata[ability];
          }
          
          if (U.isObj(data, Function)) data = data(doss.getInternalValue(), doss);
          return ability.func(rootDoss, doss, data, stager, rootAbility);
          
        };
        var editor = stager.editor = new ds.Editor();
        stager.session = srcSession;
        stager.ability = srcAbility;
        stager.consumeChannelerParams = function() {
          var ret = srcChannelerParams;
          srcChannelerParams = {}; // `srcChannelerParams` is set to an empty object after the first call
          return ret;
        };
        stager.$do = function(doss, ability, data) {
          // Queue an ability to go off once this ability is completed
          return editor.$transaction.then(pass.$do.bind(pass, doss, ability, data));
        };
        
        // Stage the ability...
        var ret = stager(srcDoss, srcAbility, srcData, true);
        
        // Finally transact, sync, and return value
        return editor.$transact().then(function() {
          
          if (doSync) {
            
            /// {SERVER=
            if (srcSession && !srcAbility.clientCanValidate) {
              
              // If the client initiated this ability and couldn't validate for itself
              // it means that there is some kind of validation functionality which only
              // the server can perform. This almost certainly means that there is some
              // kind of server-generated id or value which is unknown to the client.
              // For this reason, some kind of output is always expected from the server.
              if (!ret) throw new Error('Need to provide a return value for ' + srcDoss.identity() + '.' + srcAbility.name);
              srcData = ret;
              
            }
            /// =SERVER}
            
            pass.$sync(origAddress, srcDoss, srcAbility, srcData, srcSession, srcChannelerParams, srcSessions).done();
            
          }
          
          return ret;
          
        });
        
      },
      $heedCommand: function(params /* session, channelerParams, address, command, params }; */) {
        
        console.log('HEED:', params);
        
        var data = params.params; // Consider this value "data", NOT "params"
        
        var doss = this.rootDoss.getChild(params.address);
        if (!doss) throw new Error('hahaha ' + params.command);
        if (!doss) throw new Error('Invalid address:', params.address.join('.'), 'for command "' + params.command + '"');
        
        var outline = doss.outline;
        if (!O.contains(outline.metadata, params.command)) throw new Error('Unsupported ability: ' + params.address.join('.') + '.' + params.command);
        
        return this.$do(doss, outline.metadata[params.command], data, params.session, params.channelerParams);
        
      }
      
    };}});
    
    /*
    az.Actionizer = U.makeClass({ name: 'Actionizer', methods: function(sc, c) { return {
      
      init: function(params /* channeler * /) {
        
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
          
          var editor = stager.editor;
          editor.mod({ doss: doss, data: data });
          editor.$transaction.then(doss.as('worry', 'invalidated')).done();
          
        };
        
        // Obj
        this.modObj = function(doss, data, stager) {
          
          var editor = stager.editor;
          var outlineChildren = doss.outline.children;
          
          // TODO: Checking to ensure that each property in `data`
          // actually corresponds to a child of `doss` could save
          // a lot of frustration and hard-to-debug moments
          
          // One of the main blockers to this is the lack of "scrub"
          // functionality to filter out server-side values which
          // shouldn't get synced (they don't correspond to anything
          // server-side)
          
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
      addAbility: function(outline, name, machineScope, clientCanValidate, func) {
        
        /*
        syncData.session is either the commanding Session, or `null` representing "self"
        syncData.channelerParams is same as usual
        syncData.machineScope is either 'private', 'entrusted', 'public',
          'serverSourced', OR an Array or Object (of Sessions or ips) indicating the
          specific sessions which need to get the sync. Should possibly also have
          the option of being a function returning Object or Array - for dynamic
          WorryGroups (groups worried about the value being modified by the ability)
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
        * /
        
        if (O.contains(outline.metadata, name)) throw new Error('Tried to overwrite metadata: Outline(' + this.getAddress() + ').' + name);
        
        if (!U.isObj(clientCanValidate, Boolean)) throw new Error('Invalid clientCanValidate value: "' + clientCanValidate + '"');
        
        if (!A.contains([ 'private', 'entrusted', 'public', 'serverSourced' ], machineScope) && !U.isObj(machineScope, Function))
          throw new Error('Invalid machineScope value: "' + machineScope + '"');
        
        outline.metadata[name] = {
          name: name,
          machineScope: machineScope,
          clientCanValidate: clientCanValidate,
          func: func
        };
      
      },
      recurse: function(outline, machineScope, clientCanValidate) {
        
        this.addAbility(outline, 'display', machineScope, clientCanValidate, this.display);
        
        if (U.isInstance(outline, ds.Val)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, U.isInstance(outline, ds.Ref) ? this.modRef : this.modVal);
          
        } else if (U.isInstance(outline, ds.Obj)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, this.modObj);
          for (var k in outline.children) this.recurse(outline.children[k], machineScope, clientCanValidate);
          
        } else if (U.isInstance(outline, ds.Arr)) {
          
          this.addAbility(outline, 'mod', machineScope, clientCanValidate, this.modArr);
          this.addAbility(outline, 'rem', machineScope, clientCanValidate, this.remArr);
          this.addAbility(outline, 'add', machineScope, clientCanValidate, this.addArr);
          this.recurse(outline.template, machineScope, clientCanValidate);
          
        }
        
      },
      enliven: function(doss, abilityName) {
        return new az.DossierInformer({ actionizer: this, doss: doss, abilityName: abilityName || 'mod' });
      },
      
      $sync: function(origAddress, doss, abilityData, data, session, channelerParams, specificSessions) {
        
        // Determine `sessions`: the set of all Sessions which need to be synced
        
        var channeler = this.channeler;
        
        /// {CLIENT=
        // Syncs NO sessions if the scope is private, otherwise syncs the server
        var sessions = {};
        if (abilityData.machineScope !== 'private') sessions[channeler.serverSession.ip] = channeler.serverSession;
        /// =CLIENT}
        
        /// {SERVER=
        var scope = abilityData.machineScope;
        if (specificSessions) { // TODO: BAD
          
          var sessions = specificSessions;
          
        } if (scope === 'private') {
          
          // A private ability on the server NEVER concerns any clients
          var sessions = {};
          
        } else if (scope === 'entrusted') {
          
          // Entrusted actions are ALWAYS initiated by the client. We'd
          // love to never do any syncing of entrusted data, but we need
          // to if the client isn't able to independently validate
          var sessions = {};
          sessions[session.ip] = session;
          
        } else if (scope === 'public' || scope === 'serverSourced') {
          
          // Change applies to all sessions
          var sessions = O.clone(channeler.sessionSet);
          
        } else {
          
          // The scope changes over time! Calculate sessions manually.
          // `scope` must be a function
          var sessions = scope(channeler.sessionSet, doss);
          console.log('FOR ' + doss.identity() + '.' + abilityData.name + ':', Object.keys(sessions).join(', '));
          
        }
        /// =SERVER}
        
        // Ensure we're working with an `Object`
        if (!U.isObj(sessions, Object)) throw new Error('Sessions list must be an Object');
        
        if (session) {
          
          if (!O.contains(sessions, session.ip)) // Ensure that the client is included (to force good design)
            throw new Error('Syncing ability doesn\'t include the initiating client: ' + doss.identity() + '.' + abilityData.name);
          
          if (abilityData.clientCanValidate) // Never sync a self-validating client
            delete sessions[session.ip];
            
        }
        
        // Map any Strings to Session instances
        sessions = O.map(sessions, function(sesh) {
          
          if (!U.isObj(sesh, String)) return sesh;
          
          // TODO: A little funky that the client-side uses the term "channeler.sessionSet"
          if (!O.contains(channeler.sessionSet, sesh)) throw new Error('String ip doesn\'t correspond to any session: "' + sesh + '"');
          return channeler.sessionSet[sesh];
          
        });
        
        if (O.isEmpty(sessions)) return p.$null; // If no sessions to sync, we're done!
        
        // The only case where we prefer the address AFTER the transaction,
        // is the case where the address wasn't resolved beforehand
        var commandData = {
          address: origAddress ? origAddress : doss.getAddress(),
          command: abilityData.name,
          params: data
        };
        
        if (false) {
          
          var seen = [];
          console.log('SEND (' + Object.keys(sessions).join(', ') + ') --> ' + JSON.stringify(commandData, function(k, v) {
            
            if (U.isPrimitive(v)) return v;
            if (U.isInstance(v, ds.Dossier)) return v.identity();
            if (~seen.indexOf(v)) return '<CIRC>';
            if (seen.length > 30) return 'TOO MANY';
            seen.push(v);
            return v;
            
          }, 2));
          
        }
        
        return new P({ all: O.map(sessions, function(trgSession) {
          
          return channeler.$giveCommand({
            session: trgSession,
            channelerParams: trgSession === session ? channelerParams : {},
            data: commandData
          });
          
        })});
        
      },
      validateAbilityData: function(doss, abilityData, session) {
        
        if (!abilityData) throw new Error('Missing abilityData');
        
        /// {CLIENT=
        // Self can't run serverSourced abilities
        if (abilityData.machineScope === 'serverSourced' && !session)
          throw new Error('Self-initiated serverSourced ability: ' + doss.identity() + '.' + abilityData.name);
        
        // Self can't run serverSourced abilities
        if (U.isObj(abilityData.machineScope, Function) && !session)
          throw new Error('Self-initiated dynamic-scoped ability: ' + doss.identity() + '.' + abilityData.name);
        /// =CLIENT}
        
        /// {SERVER=
        // Self can't run entrusted abilities
        if (abilityData.machineScope === 'entrusted' && !session)
          throw new Error('Self-initiated entrusted ability');
        
        // Foreign can't run private abilities
        if (abilityData.machineScope === 'private' && session)
          throw new Error('Remote session can\'t initiate private ability: ' + doss.identity() + '.' + abilityData.name);
        
        // Foreign can't run serverSourced abilities
        if (abilityData.machineScope === 'serverSourced' && session)
          throw new Error('Foreign-initiated serverSourced ability: ' + doss.identity() + '.' + abilityData.name);
        
        // Foreign can't run dynamic-scoped abilities
        if (U.isObj(abilityData.machineScope, Function) && session)
          throw new Error('Self-initiated dynamic-scoped ability: ' + doss.identity() + '.' + abilityData.name);
        /// =SERVER}
        
      },
      $do: function(srcDoss, srcAbilityData, srcData) {
        
        var pass = this;
        
        // Note 3 extra params unlisted in the signature: `srcSession`, `srcChannelerParams`, `srcSessions`
        var srcSession = (arguments.length > 3) ? arguments[3] : null;
        var srcChannelerParams = (arguments.length > 4) ? arguments[4] : null;
        var srcSessions = (arguments.length > 5) ? arguments[5] : null;
        
        // Make sure we work with a Dossier instance
        if (U.isObj(srcDoss, String)) srcDoss = this.rootDoss.getChild(srcDoss);
        if (!srcDoss) throw new Error('Couldn\'t get Dossier instance');
        
        // Make sure we work with an ability-data instance
        if (U.isObj(srcAbilityData, String)) {
          var abilityData = srcDoss.outline.metadata[srcAbilityData];
          if (!abilityData) throw new Error('Couldn\'t get ability-data: ' + srcDoss.identity() + '.' + srcAbilityData);
          srcAbilityData = abilityData;
        }
        
        this.validateAbilityData(srcDoss, srcAbilityData, srcSession);
        
        // Resolve `srcData` as an actual value
        if (U.isObj(srcData, Function)) srcData = srcData(srcDoss.getInternalValue(), srcDoss);
        
        // Abilities may alter the Dossier's address! Get the address before anything is staged
        var origAddress = srcDoss.hasResolvedName() ? srcDoss.getAddress() : null;
        var doSync = true;
        
        /// {CLIENT=
        if (!srcAbilityData.clientCanValidate && !srcSession) {
          
          // The client is trying to perform a self-initiated ability it can't
          // validate itself. ONLY perform the sync, take no actual action. The
          // server will get the command and realize we couldn't validate it
          // ourselves. It will then validate/perform the command and sync us
          // in return. When that happens we'll arrive here again except
          // `srcSession` will be non-null
          return this.$sync(origAddress, srcDoss, srcAbilityData, srcData, srcSession, srcChannelerParams);
          
        } else if (!srcAbilityData.clientCanValidate) {
          
          // We can't validate this ability, but the request is coming from the
          // server! Just make sure that we don't sync this time, since this is
          // already the result of a sync.
          doSync = false;
          
        }
        /// =CLIENT}
        
        // Set up the `stager`...
        var stager = function(doss, abilityData, data) {
          
          if (!doss) throw new Error('No doss');
          
          // Make sure we work with an ability data instance
          if (U.isObj(abilityData, String)) {
            if (!O.contains(doss.outline.metadata, abilityData)) throw new Error('Couldn\'t get ability-data: ' + doss.identity() + '.' + abilityData);
            abilityData = doss.outline.metadata[abilityData];
          }
          
          if (U.isObj(data, Function)) data = data(doss.getInternalValue(), doss);
          return abilityData.func(doss, data, stager);
          
        };
        var editor = stager.editor = new ds.Editor();
        stager.session = srcSession;
        stager.abilityData = srcAbilityData;
        stager.consumeChannelerParams = function() {
          var ret = srcChannelerParams;
          srcChannelerParams = {}; // `srcChannelerParams` is set to an empty object after the first call
          return ret;
        };
        stager.$do = function(doss, abilityData, data) {
          return editor.$transaction.then(pass.$do.bind(pass, doss, abilityData, data));
        };
        
        // Stage the ability...
        var ret = stager(srcDoss, srcAbilityData, srcData);
        
        // Finally transact, sync, and return value
        return editor.$transact().then(function() {
          
          if (doSync) {
            
            /// {SERVER=
            if (srcSession && !srcAbilityData.clientCanValidate) {
              
              // If the client initiated this ability and couldn't validate for itself
              // it means that there is some kind of validation functionality which only
              // the server can perform. This almost certainly means that there is some
              // kind of server-generated id or value which is unknown to the client.
              // For this reason, some kind of output is always expected from the server.
              if (!ret) throw new Error('Need to provide a return value for ' + srcDoss.identity() + '.' + srcAbilityData.name);
              srcData = ret;
              
            }
            /// =SERVER}
            
            pass.$sync(origAddress, srcDoss, srcAbilityData, srcData, srcSession, srcChannelerParams, srcSessions).done();
            
          }
          
          return ret;
          
        });
        
      },
      $heedCommand: function(params /* session, channelerParams, address, command, params }; * /) {
        
        console.log('HEED:', params);
        
        var data = params.params; // Consider this value "data", NOT "params"
        
        var doss = this.rootDoss.getChild(params.address);
        if (!doss) throw new Error('hahaha ' + params.command);
        if (!doss) throw new Error('Invalid address:', params.address.join('.'), 'for command "' + params.command + '"');
        
        var outline = doss.outline;
        if (!O.contains(outline.metadata, params.command)) throw new Error('Unsupported ability: ' + params.address.join('.') + '.' + params.command);
        
        return this.$do(doss, outline.metadata[params.command], data, params.session, params.channelerParams);
        
      }
      
    };}});
    */
    
  }
});
package.build();
