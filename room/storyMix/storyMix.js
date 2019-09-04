// [ ] Aggregate info into Round - can store max votes and num votes remaining
// [ ] Show metadata in Submission/Voting stage - timer, votes submitted, votes remaining
// [ ] Editable StoryEntries - all users suggest edits; only the original author accepts
// [ ] Make everything look nice!!
// [ ] Factor Users into its own hut. Should be possible to easily integrate into any Hut!

// "Scenario" -> A trail of occurrences leading to a particular moment
// "AccessPath" -> "Reflex" -> Accompanying effects occurring in a scenario

// TODO: If every Hog threw an Error upon initialization, it could implicitly pass itself
// to any containing scope - e.g. a Rec created inside of an AccessPath could automatically
// be seen by the AccessPath if Rec calls `insp.Hog.init.call(this, ...)`, and Hog init
// throws an error. In this case, though, only 1 Rec could be created inside of an
// AccessPath - the first would short-circuit the flow of the AccessPath's "gen" function


U.buildRoom({
  name: 'storyMix',
  innerRooms: [ 'hinterlands', 'chance', 'record', 'real' ],
  build: (foundation, hinterlands, chance, record, real) => {
    
    let { HorzScope: AccessPath, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Chance } = chance;
    let { Rec, recTyper } = record;
    let { Lands, LandsRecord, Way, Hut, rel: landsRel } = hinterlands;
    let { Reality, Real } = real;
    
    let { rt, add } = recTyper();
    add('storyMix', Rec);
    add('author', Rec);
    add('password', Rec);
    add('story', Rec);
    add('round', Rec);
    add('entry', Rec);
    
    add('archStoryMix',       Rec, '11', hinterlands.rt.arch, rt.storyMix);
    add('storyMixStory',      Rec, '1M', rt.storyMix,         rt.story);
    add('storyMixAuthor',     Rec, '1M', rt.storyMix,         rt.author);
    add('hutAuthor',          Rec, '11', hinterlands.rt.hut,  rt.author);
    add('authorPassword',     Rec, '11', rt.author,           rt.password);
    add('authorCurStory',     Rec, 'M1', rt.author,           rt.story);
    add('storyCreatorAuthor', Rec, 'M1', rt.story,            rt.author);
    add('storyAuthor',        Rec, 'MM', rt.story,            rt.author);
    add('storyRound',         Rec, '1M', rt.story,            rt.round);
    add('storyCurRound',      Rec, '11', rt.story,            rt.round);
    add('storyEntry',         Rec, '1M', rt.story,            rt.entry);
    add('roundEntry',         Rec, '1M', rt.round,            rt.entry);
    add('entryAuthor',        Rec, 'M1', rt.entry,            rt.author);
    add('entryVoterAuthor',   Rec, 'MM', rt.entry,            rt.author);
    
    let open = async () => {
      
      console.log('Init storyMix...');
      
      let recTypes = { ...hinterlands.rt, ...rt }; // TODO: Collisions could occur...
      let commands = [ 'author', 'story', 'join', 'entry', 'vote' ];
      let heartbeatMs = 10 * 60 * 1000;
      let lands = U.lands = Lands({ foundation, recTypes, commands, heartbeatMs });
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer(lands.pool, 'localhost', 80) }));
      
      /// {ABOVE=
      
      let rootScope = AccessPath(WobVal(lands.arch), (dep, arch) => {
        
        // Initialize StoryMix
        let chance = Chance(null);
        
        let storyMix = lands.createRec('storyMix', {
          value: {
            version: '0.0.1',
            description: 'Collaborate with other authors to write stories that belong to everyone!'
          }
        });
        let archStoryMix = lands.createRec('archStoryMix', {}, lands.arch, storyMix);
        
        // Follows
        dep(AccessPath(arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          
          let hut = archHut.members[1];
          dep(hut.followRec(archStoryMix));
          dep(hut.followRec(storyMix));
          
          dep(AccessPath(hut.relWob(rt.hutAuthor), (dep, hutAuthor) => {
            
            let author = hutAuthor.members[1];
            dep(hut.followRec(author));
            dep(hut.followRec(author.relWob(rt.storyMixAuthor).toArr(v => v)[0]));
            
            dep(AccessPath(author.relWob(rt.authorCurStory), (dep, authorCurStory) => {
              
              let curStory = authorCurStory.members[1];
              dep(hut.followRec(curStory));
              dep(hut.followRec(authorCurStory));
              
              dep(AccessPath(curStory.relWob(rt.storyEntry), (dep, storyEntry) => {
                
                let entry = storyEntry.members[1];
                dep(hut.followRec(entry));
                dep(hut.followRec(storyEntry));
                
                dep(AccessPath(entry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                  
                  let author = entryAuthor.members[1];
                  dep(hut.followRec(author));
                  dep(hut.followRec(entryAuthor));
                  
                }));
                
              }));
              
              dep(AccessPath(curStory.relWob(rt.storyCurRound), (dep, storyCurRound) => {
                
                let curRound = storyCurRound.members[1];
                dep(hut.followRec(curRound));
                dep(hut.followRec(storyCurRound));
                
                dep(AccessPath(curRound.relWob(rt.roundEntry), (dep, roundEntry) => {
                  
                  let entry = roundEntry.members[1];
                  dep(hut.followRec(entry));
                  dep(hut.followRec(roundEntry));
                  
                  dep(AccessPath(roundEntry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                    
                    let author = entryAuthor.members[1];
                    dep(hut.followRec(author));
                    dep(hut.followRec(entryAuthor));
                    
                  }));
                  
                  dep(AccessPath(roundEntry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                    
                    let voterAuthor = entryVoterAuthor.members[1];
                    dep(hut.followRec(voterAuthor));
                    dep(hut.followRec(entryVoterAuthor));
                    
                  }));
                  
                }));
                
              }));
              
            }));
            
          }));
          
          dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
            
            let story = storyMixStory.members[1];
            dep(hut.followRec(story));
            dep(hut.followRec(storyMixStory));
            
          }));
          
        }));
        
        // Controls on Huts
        dep(AccessPath(arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          
          let hut = archHut.members[1];
          
          dep(hut.comWob('author').hold(({ lands, hut, msg }) => {
            
            let { username, password } = msg;
            
            // If `username` is given, login - otherwise logout!
            
            if (username !== null) {
              
              if (hut.relRec(rel.hutAuthor)) return hut.tell({ command: 'error', type: 'denied', msg: 'already logged in', org: msg });
              
              // Find an author by that username
              let author = null;
              let allAuthors = storyMix.relRecs(rel.storyMixAuthor).map(sma => sma.members[1]);
              let author = allAuthors.find(auth => auth.value.username === username);
              
              if (!author) {
                
                console.log('Create author for', hut.getTerm());
                
                author = lands.createRec('author', { value: { username, term: null } });
                let pass = lands.createRec('password', { value: password });
                
                lands.createRec('storyMixAuthor', {}, storyMix, author);
                lands.createRec('authorPassword', {}, author, pass);
                
              }
              
              if (author.relRec(rel.authorPassword).value !== password) return hut.tell({ command: 'error', type: 'denied', msg: 'incorrect password', orig: msg });
              
            }
            
          });
          
        }));
        
      });
      
      
      /// =ABOVE}
      
      if (false) AccessPath(WobVal(lands.arch), async (dep, arch) => {
        
        /// {ABOVE=
        
        /*
        let chance = Chance(null);
        
        let storyMix = dep(lands.createRec('storyMix', {
          value: {
            version: '0.0.1',
            description: 'Collaborate with other authors to write stories that belong to everyone!'
          }
        }));
        lands.createRec('archStoryMix', {}, arch, storyMix);
        
        // Follows
        dep(AccessPath(arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          
          let hut = archHut.members[1]; // TODO: "members" should almost definitely be an Object, not an Array
          
          dep(hut.followRec(storyMix));
          
          // StoryMix -> Story
          dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
            
            let story = storyMixStory.members[1];
            dep(hut.followRec(story));
            
          }));
          
          // StoryMix -> Author
          dep(AccessPath(hut.relWob(rt.hutAuthor), (dep, hutAuthor) => {
            
            let author = hutAuthor.members[1];
            dep(hut.followRec(hutAuthor));
            dep(hut.followRec(author));
            
            // StoryMix -> Author -> CurrentStory
            dep(AccessPath(author.relWob(rt.authorCurStory), (dep, authorCurStory) => {
              
              let curStory = authorCurStory.members[1];
              dep(hut.followRec(authorCurStory));
              dep(hut.followRec(curStory));
              
              // StoryMix -> Author -> CurrentStory -> CurrentRound
              dep(AccessPath(curStory.relWob(rt.storyCurRound), (dep, storyCurRound) => {
                
                let curRound = storyCurRound.members[1];
                dep(hut.followRec(storyCurRound));
                dep(hut.followRec(curRound));
                
                // StoryMix -> Author -> CurrentStory -> CurrentRound -> RoundEntries
                dep(AccessPath(curRound.relWob(rt.roundEntry), (dep, roundEntry) => {
                  
                  let entry = roundEntry.members[1];
                  dep(hut.followRec(roundEntry));
                  dep(hut.followRec(entry));
                  
                  // StoryMix -> Author -> CurrentStory -> CurrentRound -> RoundEntry -> EntryAuthor
                  dep(AccessPath(entry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                    
                    let author = entryAuthor.members[1];
                    dep(hut.followRec(entryAuthor));
                    dep(hut.followRec(author));
                    
                  }));
                  
                  // StoryMix -> Author -> CurrentStory -> CurrentRound -> RoundEntry -> EntryVoteAuthors
                  dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                    
                    let voterAuthor = entryVoterAuthor.members[1];
                    dep(hut.followRec(entryVoterAuthor));
                    dep(hut.followRec(voterAuthor));
                    
                  }));
                  
                }));
                
              }));
              
              // StoryMix -> Author -> CurrentStory -> StoryEntries
              console.log('HUT', hut.getTerm(), 'entries PLURAL +++');
              dep(Hog(() => console.log('HUT', hut.getTerm(), 'entries PLURAL ---')));
              dep(AccessPath(currentStory.relWob(rel.storyEntries.fwd), (dep, { rec: storyEntry }) => {
                
                console.log('HUT', hut.getTerm(), 'entries SINGLE +++');
                dep(Hog(() => console.log('HUT', hut.getTerm(), 'entries SINGLE ---')));
                dep(hut.followRec(storyEntry));
                
              }));
              
            }));
            
          }));
          
        }));
        */
        
        // Controls on Huts
        dep(AccessPath(lands.relWob(landsRel.landsHuts.fwd), (dep, { rec: hut }) => {
          
          // Enable Hut actions: 1) login; 2) logout
          dep(hut.comWob('author').hold(({ lands, hut, msg }) => {
            
            let { username, password } = msg;
            
            if (username !== null) {
              
              // Login
              
              if (hut.getRelRec(rel.hutAuthor.fwd)) return hut.tell({ command: 'error', type: 'denied', msg: 'already logged in', orig: msg });
              
              let author = null;
              let relAuthor = storyMix.relWob(rel.storyMixAuthors.fwd).find(({ rec: auth }) => auth.value.username === username);
              if (!relAuthor) {
                
                console.log('Create author for', hut.getTerm());
                
                author = Author({ lands, value: { username, term: hut.getTerm() } });
                let pass = Password({ lands, value: password });
                author.attach(rel.authorPassword.fwd, pass);
                storyMix.attach(rel.storyMixAuthors.fwd, author);
                
              } else {
                
                author = relAuthor.rec;
                
              }
              
              if (author.getRec(rel.authorPassword.fwd).value !== password) return hut.tell({ command: 'error', type: 'denied', orig: msg });
              
              author.modify(v => v.gain({ term: hut.getTerm() }));
              author.attach(rel.hutAuthor.bak, hut);
              
              console.log('Authenticated! Logging in', hut.getTerm());
              
            } else {
              
              // Logout
              
              let relAuthor = hut.getRelRec(rel.hutAuthor.fwd);
              if (!author) return hut.tell({ command: 'error', type: 'denied', orig: msg });
              
              console.log('Logging out', hut.getTerm());
              relAuthor.rec.modify(v => v.gain({ term: C.skip }));
              relAuthor.shut();
              
            }
            
          }));
          
        }));
        
        // Controls on Authors
        dep(AccessPath(storyMix.relWob(rel.storyMixAuthors.fwd), (dep, { rec: author }) => {
          
          // Enable Author actions: 1) create story 2) join story
          dep(AccessPath(author.relWob(rel.hutAuthor.bak), (dep, { rec: authorHut }) => {
            
            dep(authorHut.comWob('story').hold(({ lands, hut, msg }) => {
              
              let { name, desc, roundMs, maxAuthors } = msg;
              
              if (!U.isType(name, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(desc, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(roundMs, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(maxAuthors, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              
              let newStory = Story({ lands, value: {
                name,
                desc,
                startMs: foundation.getMs(),
                endMs: null,
                numAuthors: 0,
                settings: {
                  roundMs,
                  // TODO: minAuthors (can't start a Round until this many Authors have joined)
                  maxAuthors
                  // TODO: minEntryLength
                  // TODO: maxEntryLength
                  // TODO: showRoundEntryAuthor
                  // TODO: showStoryEntryAuthor
                  // TODO: showRoundEntryVotes  // (hidden|amount|authors) - show amount, but not who voted?
                  // TODO: maxRounds
                }
              }});
              let ap = AccessPath(newStory.relWob(rel.storyAuthors.fwd), (dep, relAuthor) => {
                newStory.modify(v => { v.numAuthors++; return v; });
                dep(Hog(() => newStory.modify(v => { v.numAuthors--; return v; })));
              });
              let attachStoryMixStory = newStory.attach(rel.storyMixStories.bak, storyMix);
              attachStoryMixStory.shutWob().hold(() => ap.shut());
              
              newStory.attach(rel.storyCreatorAuthor.fwd, author);
              newStory.attach(rel.storyAuthors.fwd, author);
              
            }));
            
            dep(authorHut.comWob('join').hold(({ lands, hut, msg }) => {
              
              if (author.getRec(rel.authorCurrentStory.fwd)) return hut.tell({ command: 'error', type: 'denied', msg: 'already in a story', orig: msg });
              if (!msg.has('story')) return hut.tell({ command: 'error', type: 'denied', msg: 'no story specified', orig: msg });
              
              let story = storyMix.getRec(rel.storyMixStories.fwd, msg.story);
              if (!story) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid uid', orig: msg });
              
              // If the Author has never joined this Story, attach!
              if (!story.getRec(rel.storyAuthors.fwd, author.uid)) author.attach(rel.storyAuthors.bak, story);
              
              // Always set this Story as the Author's CurrentStory
              author.attach(rel.authorCurrentStory.fwd, story);
              
            }));
            
          }));
          
        }));
        
        // Controls on Stories
        dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
          
          // Controls on Stories -> Rounds
          dep(AccessPath(story.relWob(rel.storyCurrentRound.fwd), (dep, relStoryCurrentRound) => {
            
            let storyCurrentRound = relStoryCurrentRound.rec;
            
            let unbeatableEntry = () => {
              
              // Sum up votes for all Entries. Figure out how many Authors haven't voted.
              // If not enough Authors remain to tip the balance to another Entry, return
              // the unbeatable Entry
              
              let entries = storyCurrentRound.relWob(rel.roundEntries.fwd).toArr().map(relRec => relRec.rec);
              if (entries.length === 0) return null;
              if (entries.length === 1) return entries[0];
              
              let numVotesRemaining = story.value.numAuthors - storyCurrentRound.value.numVotes;
              let [ place1, place2 ] = entries.sort((a, b) => b.value.numVotes - a.value.numVotes);
              
              // If `place1` is unbeatable, return it - otherwise, `null`
              return ((place1.value.numVotes - place2.value.numVotes) > numVotesRemaining) ? place1 : null;
              
            };
            let bestEntries = () => {
              // Return all Entries tied for first in votes
              
              let entries = storyCurrentRound.relWob(rel.roundEntries.fwd).toArr();
              
              let mostVotes = 0;
              entries.forEach( ({ rec: entry }) => mostVotes = Math.max(mostVotes, entry.value.numVotes) );
              
              return entries.map( ({ rec: entry }) => entry.value.numVotes === mostVotes ? entry : C.skip );
              
            };
            let bestEntry = () => chance.elem(bestEntries());
            let endRound = (reason, entry) => {
              
              // TODO: A pity this check is needed! Ideally any further round-end-detection
              // would be disabled by `relStoryCurrentRound.shut()` removing all additional
              // checks via `dep`
              if (relStoryCurrentRound.isShut()) return;
              
              console.log(`Round ending with reason "${reason}"`);
              
              // NOTE: It's possible that a Follow will decrement and increment
              // in the same tick here: `relStoryCurrentRound.shut()` will kill
              // the AccessPath leading to the Entry through the CurrentRound,
              // while `story.attach(..., entry)` will re-follow it through
              // following the Story's list of all Entries. Unfortunately this
              // results in the same Record being present in `hut.sync.addRec`
              // and `hut.sync.remRec`, and this will be resolved by preferring
              // "remRec". The solution should probably be to give preference
              // to the latest operation - if rem comes last, it should win. If
              // add comes last, *it* should win.
              
              // Detach the current Round
              relStoryCurrentRound.shut();
              
              if (entry) {
                // Add the Entry to the Story.
                // TODO: No delay should be necessary! Need to fix sync-addRec-remRec-conflict bug!!
                setTimeout(() => story.attach(rel.storyEntries.fwd, entry), 1000);
              } else {
                console.log('Round ended without entry :(');
              }
              
            };
            
            // Round ends because of timeout with a random Entry tied for 1st place
            let timeoutDur = storyCurrentRound.value.endMs - foundation.getMs();
            let timeout = setTimeout(() => endRound('deadline', bestEntry()), timeoutDur);
            dep(Hog(() => clearTimeout(timeout)));
            
            // Round ends because of insurmountable vote on a specific Entry
            dep(AccessPath(storyCurrentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
              
              dep(AccessPath(roundEntry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: roundEntryVoteAuthor }) => {
                
                // Another Vote just happened on an Entry! See if an Entry has become unbeatable.
                let winningEntry = unbeatableEntry();
                if (winningEntry) endRound('outcomeKnown', winningEntry);
                
              }));
              
            }));
            
            // Round ends because there's at least one Vote, and Votes are exhausted
            // Note that 2 factors determine this: total votes available, and total votes cast.
            // We only listen for changes in total votes cast to trigger the round-end-due-to-exhaustion event though.
            dep(storyCurrentRound.hold(
              ({ numVotes }) => (numVotes >= story.value.numAuthors) && endRound('noMoreVotes', bestEntry())
            ));
            
          }));
          
          // Controls on Stories -> Authors
          dep(AccessPath(story.relWob(rel.storyAuthors.fwd), (dep, { rec: storyAuthor }) => {
            
            // Enable Author actions: 1) submit Entry; 2) submit Vote
            
            dep(AccessPath(storyAuthor.relWob(rel.hutAuthor.bak), (dep, { rec: storyAuthorHut }) => {
              
              dep(storyAuthorHut.comWob('entry').hold(({ lands, hut, msg }) => {
                
                // If no Round exists, a new one is begun.
                // Then the Author adds a new Entry to the Round.
                
                // TODO: If max Rounds reached, deny
                
                let storyCurrentRound = story.getRec(rel.storyCurrentRound.fwd);
                if (!storyCurrentRound) {
                  
                  let ms = foundation.getMs();
                  
                  storyCurrentRound = Round({ lands, value: {
                    roundNum: story.relWob(rel.storyRounds.fwd).size(),
                    startMs: ms,
                    endMs: ms + story.value.settings.roundMs,
                    numVotes: 0
                  }});
                  let ap = AccessPath(storyCurrentRound.relWob(rel.roundEntries.fwd), (dep, { rec: entry }) => {
                    dep(AccessPath(entry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, relVoteAuthor) => {
                      storyCurrentRound.modify(v => { v.numVotes++; return v; });
                      dep(Hog(() => storyCurrentRound.modify(v => { v.numVotes--; return v; })));
                    }));
                  });
                  storyCurrentRound.shutWob().hold(() => ap.shut());
                  
                  story.attach(rel.storyRounds.fwd, storyCurrentRound);
                  story.attach(rel.storyCurrentRound.fwd, storyCurrentRound);
                  
                }
                
                // TODO: If already submitted, deny
                
                let entry = Entry({ lands, value: { text: msg.text, numVotes: 0 } });
                let ap = AccessPath(entry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: voteAuthor }) => {
                  entry.modify(v => { v.numVotes++; return v; });
                  dep(Hog(() => entry.modify(v => { v.numVotes--; return v; })));
                });
                
                let entryAttachRound = entry.attach(rel.roundEntries.bak, storyCurrentRound);
                entryAttachRound.shutWob().hold(() => ap.shut());
                
                entry.attach(rel.entryAuthor.fwd, storyAuthor);
                
              }));
              
              dep(storyAuthorHut.comWob('vote').hold(({ lands, hut, msg }) => {
                
                let storyCurrentRound = story.getRec(rel.storyCurrentRound.fwd);
                if (!storyCurrentRound) return hut.tell({ command: 'error', type: 'denied', msg: 'no round', orig: msg });
                
                let entry = storyCurrentRound.getRec(rel.roundEntries.fwd, msg.entry);
                entry.attach(rel.roundEntryVoteAuthors.fwd, storyAuthor);
                
              }));
              
            }));
            
          }));
          
        }));
        
        /// =ABOVE}
        
        let s = { w: real.UnitPx(100), h: real.UnitPx(100) };
        let reality = Reality('storyMix', {
          
          // TODO: Should layout and slots be condition-able? If they were conditional,
          // it would make things like responsive grid-layout with javascript-fallback
          // trivial. Super tricky to implement though!
          
          'main': ({ slots, viewport }) => ({
            layout: real.layout.Free({ w: viewport.min.mult(0.9), h: viewport.min.mult(0.9) }),
            slots: real.slots.Titled({ titleExt: real.UnitPx(53) }),
            decals: {
              colour: 'rgba(255, 255, 255, 1)'
            }
          }),
          'main.title': ({ slots }) => ({
            layout: slots.insertTitle(),
            decals: {
              colour: 'rgba(0, 0, 0, 0.2)',
              textOrigin: 'center',
              textSize: real.UnitPx(24)
            }
          }),
          'main.loggedOut': ({ slots }) => ({
            layout: slots.insertContent(),
            slots: real.slots.Justified(),
            decals: {
              colour: 'rgba(255, 220, 220, 1)'
            }
          }),
          'main.loggedOut.form': ({ slots }) => ({
            layout: slots.insertJustifiedItem(), // real.layout.Free({ w: real.UnitPc(60), h: real.UnitPc(60) }),
            slots: real.slots.FillV({}),
            decals: {
              size: [ real.UnitPc(60), null ]
            }
          }),
          'main.loggedOut.form.item': ({ slots }) => ({
            layout: slots.insertVItem({ size: [ real.UnitPc(100), real.UnitPx(50) ] }),
            slots: real.slots.Titled({ titleExt: real.UnitPx(20) })
          }),
          'main.loggedOut.form.item.title': ({ slots }) => ({
            layout: slots.insertTitle()
          }),
          'main.loggedOut.form.item.field': ({ slots }) => ({
            layout: slots.insertContent(),
            decals: {
              colour: 'rgba(255, 255, 255, 1)',
              textColour: 'rgba(0, 0, 0, 1)',
              textLining: { type: 'single', pad: real.UnitPx(5) }
            }
          }),
          'main.loggedOut.form.submit': ({ slots }) => ({
            layout: slots.insertVItem(),
            decals: {
              colour: '#d0d0d0',
              size: [ real.UnitPc(100), real.UnitPx(30) ],
              textLining: { type: 'single' },
              textOrigin: 'center',
              textSize: real.UnitPx(22),
              _css: { main: {
                marginTop: real.UnitPx(20)
              }}
            }
          }),
          
          'main.loggedIn': ({ slots }) => ({
            layout: slots.insertContent(),
            decals: {
              colour: 'rgba(220, 255, 220, 1)'
            }
          }),
          'main.loggedIn.storyOut': ({ slots }) => ({
            layout: real.layout.Fill({}),
            slots: real.slots.FillH({})
          }),
          'main.loggedIn.storyOut.storyList': ({ slots }) => ({
            layout: slots.insertHItem(),
            slots: real.slots.FillV({ pad: real.UnitPx(5) }),
            decals: {
              size: [ real.UnitPc(50), real.UnitPc(100) ],
              border: { w: real.UnitPx(2), colour: '#00ff00' }
            }
          }),
          'main.loggedIn.storyOut.storyList.item': ({ slots }) => ({
            layout: slots.insertVItem({ size: [ null, real.UnitPx(50) ] }),
            slots: real.slots.Titled({ titleExt: real.UnitPx(30) }),
            decals: {
              colour: 'rgba(0, 100, 0, 0.1)',
              hover: {
                colour: 'rgba(0, 150, 0, 0.2)'
              }
            }
          }),
          'main.loggedIn.storyOut.storyList.item.name': ({ slots }) => ({
            layout: slots.insertTitle(),
            decals: {
              textSize: real.UnitPx(22)
            }
          }),
          'main.loggedIn.storyOut.storyList.item.desc': ({ slots }) => ({
            layout: slots.insertContent(),
            decals: {
              textSize: real.UnitPx(14)
            }
          }),
          
          'main.loggedIn.storyOut.storyCreate': ({ slots }) => ({
            layout: slots.insertHItem(),
            slots: real.slots.Justified(),
            decals: {
              size: [ real.UnitPc(50), real.UnitPc(100) ],
              border: { w: real.UnitPx(2), colour: '#00c8a0' }
            }
          }),
          'main.loggedIn.storyOut.storyCreate.form': ({ slots }) => ({
            layout: slots.insertJustifiedItem(),
            slots: real.slots.FillV({}),
            decals: {
              size: [ real.UnitPc(80), null ]
            }
          }),
          'main.loggedIn.storyOut.storyCreate.form.item': ({ slots }) => ({
            layout: slots.insertVItem({ size: [ null, real.UnitPx(50) ] }),
            slots: real.slots.Titled({ titleExt: real.UnitPx(20) })
          }),
          'main.loggedIn.storyOut.storyCreate.form.item.title': ({ slots }) => ({
            layout: slots.insertTitle()
          }),
          'main.loggedIn.storyOut.storyCreate.form.item.field': ({ slots }) => ({
            layout: slots.insertContent(),
            decals: {
              colour: '#ffffff',
              textColour: '#000000',
              textLining:  { type: 'single', pad: real.UnitPx(5) }
            }
          }),
          'main.loggedIn.storyOut.storyCreate.form.submit': ({ slots }) => ({
            layout: slots.insertVItem(),
            decals: {
              size: [ null, real.UnitPx(30) ],
              colour: '#d0d0d0',
              textLining: { type: 'single' },
              textOrigin: 'center',
              textSize: real.UnitPx(22),
              
              _css: { main: {
                marginTop: real.UnitPx(20)
              }}
              
              
              //_css: { main: {
              //  height: real.UnitPx(30),
              //  lineHeight: real.UnitPx(30),
              //  marginTop: real.UnitPx(20),
              //  fontSize: real.UnitPx(22),
              //  textAlign: 'center',
              //  backgroundColor: '#d0d0d0'
              //}}
            }
          }),
          
          'main.loggedIn.storyIn': ({ slots }) => ({
            layout: real.layout.Fill({}),
            slots: real.slots.FillV({})
          }),
          'main.loggedIn.storyIn.entries': ({ slots }) => ({
            layout: slots.insertVItem(),
            decals: {
              size: [ null, real.UnitPc(50) ]
            }
          }),
          'main.loggedIn.storyIn.controls': ({ slots }) => ({
            layout: slots.insertVItem(),
            decals: {
              size: [ null, real.UnitPc(50) ]
            }
          }),
          'main.loggedIn.storyIn.controls.write': ({ slots }) => ({
            layout: real.layout.Fill({}),
            slots: real.slots.Titled({ side: 'b', titleExt: real.UnitPx(50) })
          }),
          'main.loggedIn.storyIn.controls.write.field': ({ slots }) => ({
            layout: slots.insertContent(),
            decals: {
              colour: 'rgba(255, 255, 255, 1)'
            }
          }),
          'main.loggedIn.storyIn.controls.write.submit': ({ slots }) => ({
            layout: slots.insertTitle(),
            decals: {
              colour: 'rgba(120, 200, 120, 1)',
              textOrigin: 'center'
            }
          }),
          
          'main.loggedIn.storyIn.controls.entries': ({ slots }) => ({
            layout: real.layout.Fill({ pad: real.UnitPx(5) }),
            slots: real.slots.FillV({})
          }),
          'main.loggedIn.storyIn.controls.entries.entry': ({ slots }) => ({
            layout: slots.insertVItem(),
            decals: {
              colour: '#ffffff',
              border: { w: real.UnitPx(2), colour: '#000000' }
            }
          }),
          'main.loggedIn.storyIn.controls.entries.entry.author': ({ slots }) => ({}),
          'main.loggedIn.storyIn.controls.entries.entry.text': ({ slots }) => ({}),
          'main.loggedIn.storyIn.controls.entries.entry.votes': ({ slots }) => ({}),
          'main.loggedIn.storyIn.controls.entries.entry.votes.vote': ({ slots }) => ({})
          
        });
        
        let rootReal = await foundation.getRootReal();
        dep(reality.contain(foundation, rootReal)); // Need to contain the root even if it's `null`
        
        /// {BELOW=
        
        storyMix = await lands.getInitRec(StoryMix); // TODO: `Lands.prototype.getInitRec` barely works :P
        let mainReal = rootReal.addReal('main');
        dep(AccessPath(WobVal(storyMix), (dep, storyMix) => {
          
          let title = mainReal.addReal('title');
          title.setText('Story Mix');
          
          let myAuthorWob = dep(WobFlt(storyMix.relWob(rel.storyMixAuthors.fwd), relAuthor => {
            return relAuthor.rec.value.term === U.hutTerm ? relAuthor : C.skip;
          }));
          let noAuthorWob = WobTmp('up');
          
          dep(AccessPath(noAuthorWob, dep => {
            
            let loggedOutReal = dep(mainReal.addReal('loggedOut'));
            
            let loginForm = loggedOutReal.addReal('form');
            let form = loginForm.form('Login', dep, v => form.clear() && lands.tell({ command: 'author', ...v }), {
              username: { type: 'str', desc: 'Username' },
              password: { type: 'str', desc: 'Password' }
            });
            
          }));
          dep(AccessPath(myAuthorWob, (dep, { rec: myAuthor }) => {
            
            noAuthorWob.dn();
            dep(Hog(() => noAuthorWob.up()));
            
            let loggedInReal = dep(mainReal.addReal('loggedIn'));
            
            let noStoryWob = WobTmp('up');
            
            dep(AccessPath(noStoryWob, dep => {
              
              let noStoryReal = dep(loggedInReal.addReal('storyOut'));
              
              let storyList = noStoryReal.addReal('storyList');
              dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
                
                let joinStory = dep(storyList.addReal('item'));
                let joinStoryName = joinStory.addReal('name');
                let joinStoryDesc = joinStory.addReal('desc');
                
                dep(story.hold(v => {
                  joinStoryName.setText(v.name);
                  joinStoryDesc.setText(v.desc);
                }));
                dep(joinStory.feelWob().hold(() => lands.tell({ command: 'join', story: story.uid })));
                
              }));
              
              let storyCreate = noStoryReal.addReal('storyCreate');
              
              let storyForm = storyCreate.addReal('form');
              let form = storyForm.form('Create!', dep, v => form.clear() && lands.tell({ command: 'story', ...v }), {
                name:       { type: 'str', desc: 'Name', v: 'test' },
                desc:       { type: 'str', desc: 'Description', v: 'TEST TEST' },
                roundMs:    { type: 'int', desc: 'Round Timer', v: '10000000' },
                maxAuthors: { type: 'int', desc: 'Max Authors', v: '10' }
              });
              
            }));
            dep(AccessPath(myAuthor.relWob(rel.authorCurrentStory.fwd), (dep, { rec: myStory }) => {
              
              noStoryWob.dn();
              dep(Hog(() => noStoryWob.up()));
              
              let storyReal = dep(loggedInReal.addReal('storyIn'));
              
              // Show all the Story's entries
              let entriesPane = storyReal.addReal('entries');
              dep(AccessPath(myStory.relWob(rel.storyEntries.fwd), (dep, { rec: entry }) => {
                let entryReal = dep(entriesPane.addReal('entry'));
                dep(entry.hold(v => entryReal.setText(v.text)));
              }));
              
              // Calculate the current entry wob. For the current round, check all RoundEntries, and
              // then the RoundEntry's EntryAuthor.
              let myCurrentEntryWob = WobTmp('dn');
              dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: entry }) => {
                  
                  let authorFlt = dep(WobFlt(entry.relWob(rel.entryAuthor.fwd), relAuthor => {
                    return relAuthor.rec === myAuthor ? relAuthor : C.skip;
                  }));
                  
                  dep(AccessPath(authorFlt, (dep, { rec: author }) => {
                    myCurrentEntryWob.up(entry);
                    dep(Hog(() => myCurrentEntryWob.dn()));
                  }));
                  
                }));
                
              }));
              
              // Calculate the current voted Entry. For the current round, check all RoundEntries,
              // then  filter the RoundEntry's VoteAuthors, searching for our Author.
              let myCurrentVotedEntryWob = WobTmp('dn');
              dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: entry }) => {
                  
                  let authorFlt = dep(WobFlt(entry.relWob(rel.roundEntryVoteAuthors.fwd), relVoteAuthor => relVoteAuthor.rec === myAuthor ? relVoteAuthor : C.skip));
                  dep(AccessPath(authorFlt, (dep, { rec: author }) => {
                    myCurrentVotedEntryWob.up(entry);
                    dep(Hog(() => myCurrentVotedEntryWob.dn()));
                  }));
                  
                }));
                
              }));
              
              // Will hold controls for creating and voting on Round Entries
              let roundPane = storyReal.addReal('controls');
              
              // If no current Entry (potentially even before Round begins), show the writing pane
              dep(AccessPath(myCurrentEntryWob.inverse(), dep => {
                
                // Entries submittable if no current Entry. So at this stage either:
                // 1 - No Round exists
                // 2 - Round exists, but no Entry submitted by our Author
                let entryWritePane = dep(roundPane.addReal('write'));
                let entryWriteField = entryWritePane.addReal('field');
                let entryWriteSubmit = entryWritePane.addReal('submit');
                
                // TODO: Should use "form" stuff here
                let entryText = '';
                dep(entryWriteField.tellWob().hold(v => { entryText = v; }));
                
                entryWriteSubmit.setText('Submit!');
                dep(entryWriteSubmit.feelWob().hold( () => lands.tell({ command: 'entry', text: entryText }) ));
                
              }));
              
              // If an Entry has been submitted, show the list of votable Entries
              dep(AccessPath(myCurrentEntryWob, dep => {
                
                // Show all Round stuff
                dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                  
                  // Show all votable Entries for current Round
                  let entriesPane = dep(roundPane.addReal('entries'));
                  
                  dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
                    
                    // A Real for the whole Entry
                    let roundEntryReal = dep(entriesPane.addReal('entry'));
                    
                    // Show the Entry's text
                    let roundEntryTextReal = roundEntryReal.addReal('text');
                    dep(roundEntry.hold(v => roundEntryTextReal.setText(v.text)));
                    
                    // Before we vote, show an option to vote on Entries
                    dep(AccessPath(myCurrentVotedEntryWob.inverse(), dep => {
                      
                      let roundEntryVoteReal = dep(roundEntryReal.addReal('doVote'));
                      roundEntryVoteReal.setText('Vote!');
                      roundEntryVoteReal.feelWob().hold(() => lands.tell({ command: 'vote', entry: roundEntry.uid }));
                      
                    }));
                    
                    // Show the username of the Entry's Author
                    let roundEntryAuthorReal = roundEntryReal.addReal('author');
                    dep(AccessPath(roundEntry.relWob(rel.entryAuthor.fwd), (dep, { rec: entryAuthor }) => {
                      dep(entryAuthor.hold(v => roundEntryAuthorReal.setText(v.username)));
                    }));
                    
                    // Show each Vote for the Entry
                    let roundEntryVotes = roundEntryReal.addReal('votes');
                    dep(AccessPath(roundEntry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: voteAuthor }) => {
                      
                      let voteReal = dep(roundEntryVotes.addReal('vote'));
                      dep(voteAuthor.hold(v => voteReal.setText(v.username)));
                      
                    }));
                    
                  }));
                  
                }));
                
              }));
              
            }));
            
          }));
          
        }));
        
        /// =BELOW}
        
      });
      
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer() }));
      U.lands = lands;
      await lands.open();
    };
    
    return { open };
  }
});
