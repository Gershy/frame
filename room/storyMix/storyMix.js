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
      
      let rootAboveScope = AccessPath(WobVal(lands.arch), (dep, arch) => {
        
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
            
            // Follow the Author through `rt.storyMixAuthor`, not `rt.hutAuthor`
            let author = hutAuthor.members[1];
            dep(hut.followRec(author));
            dep(hut.followRec(author.relRec(rt.storyMixAuthor)));
            
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
                  
                  dep(AccessPath(entry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                    
                    let author = entryAuthor.members[1];
                    dep(hut.followRec(author));
                    dep(hut.followRec(entryAuthor));
                    
                  }));
                  
                  dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                    
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
            
            // The truthiness of `username` determines if we're logging
            // in or logging out.
            
            if (username !== null) {
              
              if (hut.relRec(rt.hutAuthor)) return hut.tell({ command: 'error', type: 'denied', msg: 'already logged in', org: msg });
              
              // Find an author by that username
              let allAuthors = storyMix.relRecs(rt.storyMixAuthor).map(sma => sma.members[1]);
              let author = null;
              let findAuthor = allAuthors.find(auth => auth.value.username === username);
              
              if (!findAuthor) {
                
                console.log('Create author for', hut.getTerm());
                
                author = lands.createRec('author', { value: { username, term: null } });
                let pass = lands.createRec('password', { value: password });
                
                lands.createRec('storyMixAuthor', {}, storyMix, author);
                lands.createRec('authorPassword', {}, author, pass);
                
              } else {
                
                author = findAuthor[0];
                
              }
              
              if (author.relRec(rt.authorPassword).members[1].value !== password) return hut.tell({ command: 'error', type: 'denied', msg: 'incorrect password', orig: msg });
              
              // Set `author` as currently controlled by `hut`
              author.modify(v => v.gain({ term: hut.getTerm() }));
              lands.createRec('hutAuthor', {}, hut, author);
              
            } else {
              
              // Shut the AuthorHut
              let hutAuthor = hut.relRec(rt.hutAuthor);
              hutAuthor.members[1].modify(v => v.gain({ term: null }));
              hutAuthor.shut();
              
            }
            
          }));
          
        }));
        
        // Controls on Authors
        dep(AccessPath(storyMix.relWob(rt.storyMixAuthor), (dep, storyMixAuthor) => {
          
          let author = storyMixAuthor.members[1];
          
          // Enable Author actions: 1) create story 2) join story
          dep(AccessPath(author.relWob(rt.hutAuthor), (dep, hutAuthor) => {
            
            let hut = hutAuthor.members[0];
            
            dep(hut.comWob('story').hold(({ msg }) => {
              
              let { name, desc, roundMs, maxAuthors } = msg;
              
              if (!U.isType(name, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(desc, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(roundMs, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(maxAuthors, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              
              let newStory = lands.createRec('story', { value: {
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
              
              // Liven up `newStory.value.numAuthors`
              let ap = AccessPath(newStory.relWob(rt.storyAuthor), (dep, relAuthor) => {
                newStory.modify(v => (v.numAuthors++, v));
                dep(Hog(() => newStory.modify(v => (v.numAuthors--, v))));
              });
              
              let storyMixStory = lands.createRec('storyMixStory', {}, storyMix, newStory);
              storyMixStory.shutWob().hold(() => ap.shut()); // Stop counting authors if relation breaks
              
              let storyCreatorAuthor = lands.createRec('storyCreatorAuthor', {}, newStory, author);
              let storyAuthor = lands.createRec('storyAuthor', {}, newStory, author);
              
            }));
            
            dep(hut.comWob('join').hold(({ msg }) => {
              
              if (!msg.has('story')) return hut.tell({ command: 'error', type: 'denied', msg: 'no story specified', orig: msg });
              
              if (msg.story !== null) {
                
                if (author.relRec(rt.authorCurStory)) return hut.tell({ command: 'error', type: 'denied', msg: 'already in a story', orig: msg });
                
                let findStory = storyMix.relRecs(rt.storyMixStory).find(sms => sms.members[1].uid === msg.story);
                if (!findStory) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid uid', orig: msg });
                
                // We found the Story! Reference it.
                let story = findStory[0].members[1];
                
                // Try to find if the Author has already joined the story...
                let findAuthorInStory = story.relRecs(rt.storyAuthor).find(sa => sa.members[1] === author);
                
                // Group Author and Story if not already grouped!
                if (!findAuthorInStory) lands.createRec('storyAuthor', {}, story, author);
                
                // Always set this Story as the Author's CurrentStory
                lands.createRec('authorCurStory', {}, author, story);
                
              } else {
                
                if (!author.relRec(rt.authorCurStory)) return hut.tell({ command: 'error', type: 'denied', msg: 'not in a story', orig: msg });
                
                author.relRec(rt.authorCurStory).shut();
                
              }
              
            }));
            
          }));
          
          // Controls on Author -> CurStory
          dep(AccessPath(author.relWob(rt.authorCurStory), (dep, authorCurStory) => {
            
            let story = authorCurStory.members[1];
            
            // Enable Author actions: 1) submit Entry; 2) submit Vote
            dep(AccessPath(author.relWob(rt.hutAuthor), (dep, hutAuthor) => {
              
              let hut = hutAuthor.members[0];
              
              dep(hut.comWob('entry').hold(({ msg }) => {
                
                // If no Round exists, a new one begins
                
                // TODO: If max Rounds reached, deny
                
                let storyCurRound = story.relRec(rt.storyCurRound);
                let curRound = null;
                if (!storyCurRound) {
                  
                  let ms = foundation.getMs();
                  
                  curRound = lands.createRec('round', { value: {
                    roundNum: story.relRecs(rt.storyRound).length,
                    startMs: ms,
                    endMs: ms + story.value.settings.roundMs,
                    numVotes: 0
                  }});
                  
                  // Liven up `curRound.value.numVotes`
                  let scope = AccessPath(curRound.relWob(rt.roundEntry), (dep, roundEntry) => {
                    let entry = roundEntry.members[1];
                    dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                      curRound.modify(v => (v.numVotes++, v));
                      dep(Hog(() => curRound.modify(v => (v.numVotes--, v))));
                    }));
                  });
                  curRound.shutWob().hold(() => scope.shut());
                  
                  lands.createRec('storyCurRound', {}, story, curRound);
                  
                } else {
                  
                  curRound = storyCurRound.members[1];
                  
                }
                
                let entry = lands.createRec('entry', { value: { text: msg.text, numVotes: 0 } });
                
                // Liven up `entry.value.numVotes`
                let scope = AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                  entry.modify(v => (v.numVotes++, v));
                  dep(Hog(() => entry.modify(v => (v.numVotes--, v))));
                });
                
                // Connect Entry to Author
                let entryAuthor = lands.createRec('entryAuthor', {}, entry, author);
                
                // Connect Entry to Round
                let roundEntry = lands.createRec('roundEntry', {}, curRound, entry);
                roundEntry.shutWob().hold(() => scope.shut());
                
              }));
              
              dep(hut.comWob('vote').hold(({ msg }) => {
                
                let storyCurRound = story.relRec(rt.storyCurRound);
                if (!storyCurRound) return hut.tell({ command: 'error', type: 'denied', msg: 'no round', orig: msg });
                
                let curRound = storyCurRound.members[1];
                let entries = curRound.relRecs(rt.roundEntry).map(roundEntry => roundEntry.members[1]);
                
                let findEntry = entries.find(entry => entry.uid === msg.entry);
                
                if (!findEntry) return hut.tell({ command: 'error', type: 'denied', msg: `Invalid Entry uid: ${msg.entry}`, orig: msg });
                
                lands.createRec('entryVoterAuthor', {}, findEntry[0], author);
                
              }));
              
            }));
            
          }));
          
        }));
        
        // Controls on Stories
        dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
          
          let story = storyMixStory.members[1];
          
          // Controls on Stories -> Rounds
          dep(AccessPath(story.relWob(rt.storyCurRound), (dep, storyCurRound) => {
            
            let round = storyCurRound.members[1];
            
            let unbeatableEntry = () => {
              
              // Sum up votes for all Entries. Figure out how many Authors haven't voted.
              // If not enough Authors remain to tip the balance to another Entry, return
              // the unbeatable Entry
              
              let entries = round.relRecs(rt.roundEntry).map(roundEntry => roundEntry.members[1]);
              if (entries.length === 0) return null;
              if (entries.length === 1) return entries[0]; // TODO: A lone Entry is unbeatable??
              
              let numVotesRemaining = story.value.numAuthors - round.value.numVotes;
              let [ place1, place2 ] = entries.sort((a, b) => b.value.numVotes - a.value.numVotes);
              
              // If `place1` is unbeatable, return it - otherwise, `null`
              return ((place1.value.numVotes - place2.value.numVotes) > numVotesRemaining) ? place1 : null;
              
            };
            let bestEntries = () => {
              
              // Return all Entries tied for first in votes
              
              let entries = round.relRecs(rt.roundEntry).map(roundEntry => roundEntry.members[1]);
              
              let mostVotes = 0;
              entries.forEach(entry => mostVotes = Math.max(mostVotes, entry.value.numVotes));
              
              return entries.map(entry => entry.value.numVotes === mostVotes ? entry : C.skip);
              
            };
            let bestEntry = () => chance.elem(bestEntries()); // Randomly select a top Entry
            let endRound = (reason, entry) => {
              
              // TODO: Multiple shuts can occur if "insurmountableEntry"
              // and "noMoreVotes" occur at the same time (and generally
              // if two end conditions aren't mutually exclusive). We'd
              // expect `dep` to ensure only one condition occurs: this
              // whole scope is reliant on `storyCurRound`, and
              // therefore shutting `storyCurRound` should close all
              // `deps`, including the `dep` listening for the 2nd end
              // condition.
              // In the meantime, need this stupid `if` to prevent
              // multiple shuts of `storyCurRound`.
              
              if (storyCurRound.isShut()) return;
              
              console.log(`Round ending with reason "${reason}"`);
              console.log(`Message: "${entry.value.text}"`);
              
              // Mark Round as no longer the current Round
              storyCurRound.shut();
              
              // Add Round into the Story's history of Rounds
              lands.createRec('storyRound', {}, story, round);
              
              // Add Entry into the Story
              lands.createRec('storyEntry', {}, story, entry);
              
            };
            
            // Round ends because of timeout with a random Entry tied for 1st place
            let timeoutDur = round.value.endMs - foundation.getMs();
            let timeout = setTimeout(() => endRound('deadline', bestEntry()), timeoutDur);
            dep(Hog(() => clearTimeout(timeout)));
            
            // Round ends because of insurmountable vote on a specific Entry
            dep(AccessPath(round.relWob(rt.roundEntry), (dep, roundEntry) => {
              
              let entry = roundEntry.members[1];
              dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                
                // Another Vote just happened on an Entry! See if an Entry has become unbeatable.
                let winningEntry = unbeatableEntry();
                if (winningEntry) endRound('insurmountableEntry', winningEntry);
                
              }));
              
            }));
            
            // Round ends because there's at least one Vote, and Votes are exhausted
            // Note that 2 factors determine this: total votes available, and total votes cast.
            // We only listen for changes in total votes cast to trigger the round-end-due-to-exhaustion event though.
            // TODO: This assumes that total votes available can never decrement
            dep(round.hold(v => {
              if (v.numVotes >= story.value.numAuthors) endRound('noMoreVotes', bestEntry());
            }));
            
          }));
          
          /*
          // Controls on Stories -> Authors
          dep(AccessPath(story.relWob(rt.storyAuthor), (dep, storyAuthor) => {
            
            let author = storyAuthor.members[1];
            
            // Enable Author actions: 1) submit Entry; 2) submit Vote
            dep(AccessPath(author.relWob(rt.hutAuthor), (dep, hutAuthor) => {
              
              let hut = hutAuthor.members[0];
              
              dep(hut.comWob('entry').hold(({ msg }) => {
                
                // If no Round exists, a new one begins
                
                // TODO: If max Rounds reached, deny
                
                let storyCurRound = story.relRec(rt.storyCurRound);
                let curRound = null;
                if (!storyCurRound) {
                  
                  let ms = foundation.getMs();
                  
                  curRound = lands.createRec('round', { value: {
                    roundNum: story.relRecs(rt.storyRound).length,
                    startMs: ms,
                    endMs: ms + story.value.settings.roundMs,
                    numVotes: 0
                  }});
                  
                  // Liven up `curRound.value.numVotes`
                  let scope = AccessPath(curRound.relWob(rt.roundEntry), (dep, roundEntry) => {
                    let entry = roundEntry.members[1];
                    dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                      curRound.modify(v => (v.numVotes++, v));
                      dep(Hog(() => curRound.modify(v => (v.numVotes--, v))));
                    }));
                  });
                  curRound.shutWob().hold(() => scope.shut());
                  
                  lands.createRec('storyCurRound', {}, story, curRound);
                  
                } else {
                  
                  curRound = storyCurRound.members[1];
                  
                }
                
                let entry = lands.createRec('entry', { value: { text: msg.text, numVotes: 0 } });
                
                // Liven up `entry.value.numVotes`
                let scope = AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                  entry.modify(v => (v.numVotes++, v));
                  dep(Hog(() => entry.modify(v => (v.numVotes--, v))));
                });
                
                // Connect Entry to Author
                let entryAuthor = lands.createRec('entryAuthor', {}, entry, author);
                
                // Connect Entry to Round
                let roundEntry = lands.createRec('roundEntry', {}, curRound, entry);
                roundEntry.shutWob().hold(() => scope.shut());
                
              }));
              
              dep(hut.comWob('vote').hold(({ msg }) => {
                
                let storyCurRound = story.relRec(rt.storyCurRound);
                if (!storyCurRound) return hut.tell({ command: 'error', type: 'denied', msg: 'no round', orig: msg });
                
                let curRound = storyCurRound.members[1];
                let entries = curRound.relRecs(rt.roundEntry).map(roundEntry => roundEntry.members[1]);
                
                let findEntry = entries.find(entry => entry.uid === msg.entry);
                
                if (!findEntry) return hut.tell({ command: 'error', type: 'denied', msg: `Invalid Entry uid: ${msg.entry}`, orig: msg });
                
                lands.createRec('entryVoterAuthor', {}, findEntry[0], author);
                
              }));
              
            }));
            
          }));
          */
          
        }));
        
      });
      
      /// =ABOVE}
      
      let { UnitPx, UnitPc, layout, slots } = real;
      let reality = Reality('storyMix', {
        
        // TODO: Should layout and slots be condition-able? If they were conditional,
        // it would make things like responsive grid-layout with javascript-fallback
        // trivial. Super tricky to implement though!
        
        'main': ({ slots, viewport }) => ({
          layout: real.layout.Free({ w: viewport.min.mult(0.9), h: viewport.min.mult(0.9) }),
          slots: real.slots.Titled({ titleExt: UnitPx(53) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)'
          }
        }),
        'main.header': ({ slots }) => ({
          layout: slots.insertTitle(),
          decals: {
            colour: 'rgba(0, 0, 0, 0.2)'
          }
        }),
        'main.header.title': ({ slots }) => ({
          layout: real.layout.Free({ w: UnitPc(0.5), h: UnitPc(1) }),
          decals: {
            textOrigin: 'center',
            textSize: UnitPx(24),
            colour: 'rgba(0, 0, 0, 0.2)'
          }
        }),
        'main.header.back': ({ slots }) => ({
          layout: real.layout.Free({ w: UnitPc(0.1), h: UnitPc(1), x: UnitPc(0.45), y: UnitPc(0) }),
          decals: {
            textOrigin: 'center',
            textSize: UnitPx(20),
            colour: 'rgba(0, 0, 0, 0.5)',
            textColour: '#ffffff'
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
          layout: slots.insertJustifiedItem(), // real.layout.Free({ w: UnitPc(0.6), h: UnitPc(0.6) }),
          slots: real.slots.FillV({}),
          decals: {
            size: [ UnitPc(0.6), null ]
          }
        }),
        'main.loggedOut.form.item': ({ slots }) => ({
          layout: slots.insertVItem({ size: [ UnitPc(1), UnitPx(50) ] }),
          slots: real.slots.Titled({ titleExt: UnitPx(20) })
        }),
        'main.loggedOut.form.item.title': ({ slots }) => ({
          layout: slots.insertTitle()
        }),
        'main.loggedOut.form.item.field': ({ slots }) => ({
          layout: slots.insertContent(),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textColour: 'rgba(0, 0, 0, 1)',
            textLining: { type: 'single', pad: UnitPx(5) }
          }
        }),
        'main.loggedOut.form.submit': ({ slots }) => ({
          layout: slots.insertVItem(),
          decals: {
            colour: '#d0d0d0',
            size: [ UnitPc(1), UnitPx(30) ],
            textLining: { type: 'single' },
            textOrigin: 'center',
            textSize: UnitPx(22),
            _css: { main: {
              marginTop: UnitPx(20)
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
          slots: real.slots.FillV({ pad: UnitPx(5) }),
          decals: {
            size: [ UnitPc(0.5), UnitPc(1) ],
            border: { w: UnitPx(2), colour: '#00ff00' }
          }
        }),
        'main.loggedIn.storyOut.storyList.item': ({ slots }) => ({
          layout: slots.insertVItem({ size: [ null, UnitPx(50) ] }),
          slots: real.slots.Titled({ titleExt: UnitPx(30) }),
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
            textSize: UnitPx(22)
          }
        }),
        'main.loggedIn.storyOut.storyList.item.desc': ({ slots }) => ({
          layout: slots.insertContent(),
          decals: {
            textSize: UnitPx(14)
          }
        }),
        
        'main.loggedIn.storyOut.storyCreate': ({ slots }) => ({
          layout: slots.insertHItem(),
          slots: real.slots.Justified(),
          decals: {
            size: [ UnitPc(0.5), UnitPc(1) ],
            border: { w: UnitPx(2), colour: '#00c8a0' }
          }
        }),
        'main.loggedIn.storyOut.storyCreate.form': ({ slots }) => ({
          layout: slots.insertJustifiedItem(),
          slots: real.slots.FillV({}),
          decals: {
            size: [ UnitPc(0.8), null ]
          }
        }),
        'main.loggedIn.storyOut.storyCreate.form.item': ({ slots }) => ({
          layout: slots.insertVItem({ size: [ null, UnitPx(50) ] }),
          slots: real.slots.Titled({ titleExt: UnitPx(20) })
        }),
        'main.loggedIn.storyOut.storyCreate.form.item.title': ({ slots }) => ({
          layout: slots.insertTitle()
        }),
        'main.loggedIn.storyOut.storyCreate.form.item.field': ({ slots }) => ({
          layout: slots.insertContent(),
          decals: {
            colour: '#ffffff',
            textColour: '#000000',
            textLining:  { type: 'single', pad: UnitPx(5) }
          }
        }),
        'main.loggedIn.storyOut.storyCreate.form.submit': ({ slots }) => ({
          layout: slots.insertVItem(),
          decals: {
            size: [ null, UnitPx(30) ],
            colour: '#d0d0d0',
            textLining: { type: 'single' },
            textOrigin: 'center',
            textSize: UnitPx(22),
            
            _css: { main: {
              marginTop: UnitPx(20)
            }}
            
            
            //_css: { main: {
            //  height: UnitPx(30),
            //  lineHeight: UnitPx(30),
            //  marginTop: UnitPx(20),
            //  fontSize: UnitPx(22),
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
            size: [ null, UnitPc(0.5) ]
          }
        }),
        'main.loggedIn.storyIn.controls': ({ slots }) => ({
          layout: slots.insertVItem(),
          decals: {
            size: [ null, UnitPc(0.5) ]
          }
        }),
        'main.loggedIn.storyIn.controls.write': ({ slots }) => ({
          layout: real.layout.Fill({}),
          slots: real.slots.Titled({ side: 'b', titleExt: UnitPx(50) })
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
          layout: real.layout.Fill({ pad: UnitPx(5) }),
          slots: real.slots.FillV({})
        }),
        'main.loggedIn.storyIn.controls.entries.entry': ({ slots }) => ({
          layout: slots.insertVItem(),
          decals: {
            colour: '#ffffff',
            border: { w: UnitPx(2), colour: '#000000' }
          }
        }),
        'main.loggedIn.storyIn.controls.entries.entry.author': ({ slots }) => ({}),
        'main.loggedIn.storyIn.controls.entries.entry.text': ({ slots }) => ({}),
        'main.loggedIn.storyIn.controls.entries.entry.votes': ({ slots }) => ({}),
        'main.loggedIn.storyIn.controls.entries.entry.votes.vote': ({ slots }) => ({})
        
      });
      
      let rootReal = await foundation.getRootReal();
      reality.contain(foundation, rootReal); // Need to contain the root even if it's `null` (TODO: `.contain` should go into `dep` once there's a single root HorzScope!)
      
      /// {BELOW=
      
      let rootBelowScope = AccessPath(lands.arch.relWob(rt.archStoryMix), (dep, archStoryMix) => {
        
        let storyMix = archStoryMix.members[1];
        
        let mainReal = rootReal.addReal('main');
        let headerReal = mainReal.addReal('header');
        let titleReal = headerReal.addReal('title');
        titleReal.setText('StoryMix');
        
        // Some fancy footwork: only listen to do `myAuthorWob.up(...)`
        // when `myAuthorWob` is dn!
        let myAuthorWob = WobTmp('dn');
        dep(AccessPath(storyMix.relWob(rt.storyMixAuthor), (dep, storyMixAuthor) => {
          let author = storyMixAuthor.members[1];
          if (author.value.term === U.hutTerm) dep(myAuthorWob.up(author));
        }));
        
        dep(AccessPath(myAuthorWob.inverse(), dep => {
          
          let loggedOutReal = dep(mainReal.addReal('loggedOut'));
          let loginForm = loggedOutReal.addReal('form');
          let form = loginForm.form('Login', dep,
            v => form.clear() && lands.tell({ command: 'author', ...v }),
            {
              username: { type: 'str', desc: 'Username' },
              password: { type: 'str', desc: 'Password' }
            }
          );
          
        }));
        
        dep(AccessPath(myAuthorWob, (dep, { value: author }) => {
          
          let loggedInReal = dep(mainReal.addReal('loggedIn'));
          
          let myStoryWob = WobTmp('dn');
          dep(AccessPath(author.relWob(rt.authorCurStory), (dep, authorCurStory) => {
            
            console.log('GOT STORY!!', authorCurStory.members[1].uid);
            
            let curStory = authorCurStory.members[1];
            dep(myStoryWob.up(curStory));
            
          }));
          
          dep(AccessPath(myStoryWob.inverse(), dep => {
            
            console.log('NO STORY!!!');
            
            let noStoryReal = dep(loggedInReal.addReal('storyOut'));
            
            let storyList = noStoryReal.addReal('storyList');
            dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
              
              let story = storyMixStory.members[1];
              
              let joinStory = dep(storyList.addReal('item'));
              let joinStoryName = joinStory.addReal('name');
              let joinStoryDesc = joinStory.addReal('desc');
              
              dep(story.hold(({ name, desc }) => {
                joinStoryName.setText(name);
                joinStoryDesc.setText(desc);
              }));
              joinStory.feelWob().hold(() => lands.tell({ command: 'join', story: story.uid }));
              
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
          
          dep(AccessPath(myStoryWob, (dep, { value: story }) => {
            
            let backReal = dep(headerReal.addReal('back'));
            backReal.setText('Back');
            backReal.feelWob().hold(() => lands.tell({ command: 'join', story: null }));
            
            let storyReal = dep(loggedInReal.addReal('storyIn'));
            
            let entriesReal = storyReal.addReal('entries');
            dep(AccessPath(story.relWob(rt.storyEntry), (dep, storyEntry) => {
              
              let entry = storyEntry.members[1];
              let entryReal = dep(entriesReal.addReal('entry'));
              dep(entry.hold(v => entryReal.setText(v.text)));
              
            }));
            
            let myCurEntryWob = WobTmp('dn');
            let myCurVotedEntryWob = WobTmp('dn');
            dep(AccessPath(story.relWob(rt.storyCurRound), (dep, storyCurRound) => {
              
              let round = storyCurRound.members[1];
              dep(AccessPath(round.relWob(rt.roundEntry), (dep, roundEntry) => {
                
                let entry = roundEntry.members[1];
                
                // Look at "entryAuthor" to establish current Entry
                dep(AccessPath(entry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                  
                  let authorOfEntry = entryAuthor.members[1];
                  if (authorOfEntry === author) dep(myCurEntryWob.up(entry));
                  
                }));
                
                // Look at "entryVoterAuthor" to establish current voted Entry
                dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                  
                  let voterAuthor = entryVoterAuthor.members[1];
                  if (voterAuthor === author) dep(myCurVotedEntryWob.up(entry));
                  
                }));
                
              }));
              
            }));
            
            /*
            // TODO: This also works to liven up `myCurEntryWob` and
            // `myCurVotedEntryWob`!
            let storyScope = VertScope();
            let entryWob = storyScope
              .dive(story =>          story.relWob(rt.storyCurRound))
              .dive(storyCurRound =>  WobVal(storyCurRound.members[1]))
              .dive(round =>          round.relWob(rt.roundEntry))
              .dive(roundEntry =>     WobVal(roundEntry.members[1]));
            
            let authorOfEntryWob = entryWob
              .dive(entry => entry.relWob(rt.entryAuthor))
              .dive(entryAuthor => WobVal(entryAuthor.members[1]));
            
            let voterAuthorOfEntryWob = entryWob
              .dive(entry => entry.relWob(rt.entryVoterAuthor))
              .dive(entryVoterAuthor => WobVal(entryVoterAuthor.members[1]));
            
            dep(authorOfEntryWob.hold((dep, [ authorOfEntry, _, entry ]) => {
              if (authorOfEntry === author) dep(myCurEntryWob.up(entry));
            }));
            
            dep(voterAuthorOfEntryWob.hold((dep, [ voterAuthor, _, entry ]) => {
              if (voterAuthor === author) dep(myCurVotedEntryWob.up(entry));
            }));
            
            storyScope.trackWob(story);
            */
            
            let roundReal = storyReal.addReal('controls');
            
            dep(AccessPath(myCurEntryWob.inverse(), dep => {
              
              let writeReal = dep(roundReal.addReal('write'));
              let writeFieldReal = writeReal.addReal('field');
              let writeSubmitReal = writeReal.addReal('submit');
              
              let entryText = '';
              writeFieldReal.tellWob().hold(v => entryText = v);
              
              writeSubmitReal.setText('Submit!');
              writeSubmitReal.feelWob().hold(() => lands.tell({ command: 'entry', text: entryText }));
              
            }));
            
            dep(AccessPath(myCurEntryWob, dep => {
              
              dep(AccessPath(story.relWob(rt.storyCurRound), (dep, storyCurRound) => {
                
                let round = storyCurRound.members[1];
                
                let entriesReal = dep(roundReal.addReal('entries'));
                
                dep(AccessPath(round.relWob(rt.roundEntry), (dep, roundEntry) => {
                  
                  let entry = roundEntry.members[1];
                  
                  let entryReal = dep(entriesReal.addReal('entry'));
                  
                  let entryTextReal = entryReal.addReal('text');
                  dep(entry.hold(v => entryTextReal.setText(v.text)));
                  
                  dep(AccessPath(myCurVotedEntryWob.inverse(), dep => {
                    let entryVoteReal = dep(entryReal.addReal('doVote'));
                    entryVoteReal.setText('Vote!');
                    entryVoteReal.feelWob().hold(() => lands.tell({ command: 'vote', entry: entry.uid }));
                  }));
                  
                  let entryAuthorReal = entryReal.addReal('author');
                  dep(AccessPath(entry.relWob(rt.entryAuthor), (dep, entryAuthor) => {
                    let author = entryAuthor.members[1];
                    dep(author.hold(v => entryAuthorReal.setText(v.username)));
                  }));
                  
                  let entryVotesReal = entryReal.addReal('votes');
                  dep(AccessPath(entry.relWob(rt.entryVoterAuthor), (dep, entryVoterAuthor) => {
                    let voterAuthor = entryVoterAuthor.members[1];
                    let voterAuthorReal = entryVotesReal.addReal('vote');
                    dep(voterAuthor.hold(v => voterAuthorReal.setText(v.username)));
                  }));
                  
                }));
                
              }));
              
            }));
            
          }));
          
        }));
        
      });
      
      /// =BELOW}
      
      await lands.open();
      
    };
    
    return { open };
  }
});
