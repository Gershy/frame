// - Factor Users into its own hut. It should be easily integrated into any other Hut!

U.buildRoom({
  name: 'storyMix',
  innerRooms: [ 'hinterlands', 'chance', 'record', 'real' ],
  build: (foundation, hinterlands, chance, record, real) => {
    
    let { AccessPath, Hog, Wob, WobVal, AggWobs } = U;
    let { Chance } = chance;
    let { Record, Relation } = record;
    let { Lands, LandsRecord, Way, Hut, rel: landsRel } = hinterlands;
    let { Reality, Real } = real;
    
    let heartbeatMs = 3 * 60 * 1000;
    
    let StoryMix = U.inspire({ name: 'StoryMix', insps: { LandsRecord } });
    let Author = U.inspire({ name: 'Author', insps: { LandsRecord } });
    let Password = U.inspire({ name: 'Password', insps: { LandsRecord } });
    let Story = U.inspire({ name: 'Story', insps: { LandsRecord } });
    let Round = U.inspire({ name: 'Round', insps: { LandsRecord } });
    let Entry = U.inspire({ name: 'Entry', insps: { LandsRecord } });
    
    // TODO: Relation should receive cardinality as 1st param
    let rel = {
      landsStoryMix:          Relation(Lands, StoryMix, '11'),
      storyMixStories:        Relation(StoryMix, Story, '1M'),
      storyMixAuthors:        Relation(StoryMix, Author, '1M'),
      hutAuthor:              Relation(Hut, Author, '11'),
      authorPassword:         Relation(Author, Password, '11'),
      authorCurrentStory:     Relation(Author, Story, '11'),
      storyCreatorAuthor:     Relation(Story, Author, 'M1'), // Author who created
      storyAuthors:           Relation(Story, Author, 'MM'), // Participating Authors
      storyRounds:            Relation(Story, Round, '1M'),
      storyCurrentRound:      Relation(Story, Round, '11'),
      storyEntries:           Relation(Story, Entry, '1M'),
      roundEntries:           Relation(Round, Entry, '1M'),
      entryAuthor:            Relation(Entry, Author, '1M'),
      roundEntryVoteAuthors:  Relation(Entry, Author, '1M')
    };
    
    let open = async () => {
      console.log('Init storyMix...');
      
      let lands = U.lands = Lands({
        foundation,
        heartbeatMs,
        /// {ABOVE=
        commands: [ 'author', 'story', 'join', 'entry', 'vote' ],
        /// =ABOVE} {BELOW=
        records: [ StoryMix, Author, Story, Round, Entry ],
        relations: rel.toArr(v => v),
        /// =BELOW}
      });
      
      AccessPath(WobVal(lands), async (dep, lands) => {
        
        /// {ABOVE=
        
        let chance = Chance(null);
        
        let storyMix = dep(StoryMix({ lands }));
        lands.attach(rel.landsStoryMix.fwd, storyMix);
        
        let testAuthor = Author({ lands, value: { username: 'admin' } });
        let testStory = Story({ lands, value: {
          name: 'test',
          desc: 'test story',
          startMs: foundation.getMs(),
          endMs: null,
          settings: {
            roundMs: 1000 * 60 * 60, // 1hr
            maxAuthors: 10
          }
        }});
        
        testStory.attach(rel.storyCreatorAuthor.fwd, testAuthor);
        storyMix.attach(rel.storyMixStories.fwd, testStory);
        
        // Follows
        dep(AccessPath(lands.relWob(landsRel.landsHuts.fwd), (dep, { rec: hut }) => {
          
          dep(hut.followRec(storyMix));
          
          // StoryMix -> Story
          dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
            
            dep(hut.followRec(story));
            
          }));
          
          // StoryMix -> Author
          dep(AccessPath(hut.relWob(rel.hutAuthor.fwd), (dep, { rec: author }) => {
            
            hut.followRec(author);
            
            // StoryMix -> Author -> CurrentStory
            dep(AccessPath(author.relWob(rel.authorCurrentStory.fwd), (dep, { rec: currentStory }) => {
              
              hut.followRec(currentStory);
              
              // StoryMix -> Author -> CurrentStory -> CurrentRound
              dep(AccessPath(currentStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                hut.followRec(currentRound);
                dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
                  
                  hut.followRec(roundEntry);
                  
                }));
                
              }));
              
              dep(AccessPath(currentStory.relWob(rel.storyEntries.fwd), (dep, { rec: storyEntry }) => {
                
                hut.followRec(storyEntry);
                
              }));
              
              
            }));
            
          }));
          
        }));
        
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
                
                author = Author({ lands, value: { username } });
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
                settings: {
                  roundMs,
                  maxAuthors
                }
              }});
              
              newStory.attach(rel.storyMixStories.bak, storyMix);
              newStory.attach(rel.storyCreatorAuthor.fwd, author);
              newStory.attach(rel.storyAuthors.fwd, author);
              
            }));
            
            dep(authorHut.comWob('join').hold(({ lands, hut, msg }) => {
              
              if (author.getRec(rel.authorCurrentStory.fwd)) return hut.tell({ command: 'error', type: 'denied', msg: 'already in a story', orig: msg });
              if (!msg.has('story')) return hut.tell({ command: 'error', type: 'denied', msg: 'no story specified', orig: msg });
              
              let story = storyMix.getRec(rel.storyMixStories.fwd, msg.story);
              if (!story) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid uid', orig: msg });
              
              try {
                author.attach(rel.storyAuthors.bak, story);
              } catch(err) {}
              
              author.attach(rel.authorCurrentStory.fwd, story);
              
            }));
            
          }));
          
        }));
        
        // Controls on Stories
        dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
          
          let storySettings = story.value.settings; // Work with the actual JSON settings
          
          // Controls on Stories -> Rounds
          dep(AccessPath(story.relWob(rel.storyCurrentRound.fwd), (dep, relStoryCurrentRound) => {
            
            let storyCurrentRound = relStoryCurrentRound.rec;
            
            let unbeatableEntry = () => {
              
              // Sum up votes for all Entries. Figure out how many Authors haven't voted.
              // If not enough Authors remain to tip the balance to another Entry, return
              // the unbeatable Entry
              
              let entries = storyCurrentRound.relWob(rel.roundEntries.fwd).toArr();
              if (entries.isEmpty()) return null;
              if (entries.length === 1) return entries[0].rec;
              
              let entriesWithVotes = [];
              let numVotesRemaining = story.relWob(rel.storyAuthors.fwd).size(); // Initialize 1 vote per author in story; we'll subtract over time
              entries.forEach(({ rec: entry }) => {
                let votes = entry.relWob(rel.roundEntryVoteAuthors.fwd).size();
                numVotesRemaining -= votes;
                entriesWithVotes.push({ entry, votes });
              });
              
              let [ place1, place2 ] = entriesWithVotes.sort((a, b) => b.votes - a.votes);
              let numAuthors = story.relWob(rel.storyAuthors.fwd).size();
              
              // If `place1` is unbeatable, return it - otherwise, `null`
              return ((place1.votes - place2.votes) > numVotesRemaining)
                ? place1.entry
                : null;
              
            };
            let bestEntries = () => {
              // Return all Entries tied for first in votes
              
              let entries = storyCurrentRound.relWob(rel.roundEntries.fwd).toArr();
              let mostVotes = 0;
              
              entries.forEach(({ rec: entry }) => {
                let votes = entry.relWob(rel.roundEntryVoteAuthors.fwd).size();
                if (votes > mostVotes) mostVotes = votes;
              });
              
              return entries.map(({ rec: entry }) => {
                let votes = entry.relWob(rel.roundEntryVoteAuthors.fwd).size();
                return votes === mostVotes ? entry : C.skip;
              });
              
            };
            let endRound = (reason, entry) => {
              
              if (entry) {
                // Add the Entry to the Story.
                story.attach(rel.storyEntries.fwd, entry);
              } else {
                console.log('Round ended without entry :(');
              }
              
              // Detach the current Round
              relStoryCurrentRound.shut();
              
            };
            
            // Round ends because of timeout with a random Entry tied for 1st place
            let timeoutDur = storyCurrentRound.value.endMs - foundation.getMs();
            console.log('TIMEOUT DURATION:', timeoutDur);
            let timeout = setTimeout(() => endRound('timeout', chance.elem(bestEntries())), timeoutDur);
            dep(Hog(() => clearTimeout(timeout)));
            
            // Round ends because of insurmountable vote on a specific Entry
            dep(AccessPath(storyCurrentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
              
              dep(AccessPath(roundEntry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: roundEntryVoteAuthor }) => {
                
                // Another Vote just happened on an Entry! See if an Entry has become unbeatable.
                let winningEntry = unbeatableEntry();
                console.log('Vote happened; unbeatable Entry?', winningEntry);
                if (winningEntry) endRound('winner', winningEntry);
                
              }));
              
            }));
            
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
                    endMs: ms + storySettings.roundMs
                  }});
                  
                  story.attach(rel.storyRounds.fwd, storyCurrentRound);
                  story.attach(rel.storyCurrentRound.fwd, storyCurrentRound);
                  
                }
                
                // TODO: If already submitted, deny
                
                let entry = Entry({ lands, value: { text: msg.text } });
                entry.attach(rel.roundEntries.bak, storyCurrentRound);
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
                name:       { type: 'str', desc: 'Name' },
                desc:       { type: 'str', desc: 'Description' },
                roundMs:    { type: 'int', desc: 'Round Timer' },
                maxAuthors: { type: 'int', desc: 'Max Authors' }
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
              
              // Gives access to create and vote on Round Entries
              let roundPane = storyReal.addReal('controls');
              
              // Calculate the current entry wob. For the current round, check all RoundEntries, and
              // then the RoundEntry's EntryAuthor.
              let myCurrentEntryWob = WobTmp('dn');
              dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: entry }) => {
                  
                  let authorFlt = dep(WobFlt(entry.relWob(rel.entryAuthor.fwd), relAuthor => relAuthor.rec === myAuthor ? relAuthor : C.skip));
                  dep(AccessPath(authorFlt, (dep, { rec: author }) => {
                    myCurrentEntryWob.up(entry);
                    dep(Hog(() => myCurrentEntryWob.dn()));
                  }));
                  
                }));
                
              }));
              
              // "AccessPath" -> "Moment"? "Setting" (as in, a movie setting)? "Theater"? "Arena"? "Scene"?
              // "Cause"?
              
              //  let myCurrentVotedEntryWob = dep(accessSearch('Story', myStory)) // Adds Story to chain
              //    .rel('Round', rel.storyCurrentRound.fwd)          // Adds Round to chain
              //    .rel('Entry', rel.roundEntries.fwd)               // Adds Entry to chain
              //    .rel('VoteAuthor', rel.roundEntryVoteAuthors.fwd) // Adds VoteAuthor to chain
              //    .filter(auth => auth.rec === myAuthor); // Doesn't add anything to the chain
              //  
              //  dep(AccessPath(myCurrentVotedEntryWob, (dep, [ myAuthor, entry, round, story ]) => {
              //    
              //  }));
              
              // Calculate the current voted Entry. For the current round, check all RoundEntries,
              // then  filter the RoundEntry's VoteAuthors, searching for our Author.
              let myCurrentVotedEntryWob = WobTmp('dn');
              dep(myCurrentVotedEntryWob.hold(tmp => {
                console.log('GOT CURRENT VOTED ENTRY!');
                dep(tmp.shutWob().hold(() => console.log('LOST current VOTED ENTRY')));
              }));
              
              dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                dep(AccessPath(currentRound.relWob(rel.roundEntries.fwd), (dep, { rec: entry }) => {
                  
                  let authorFlt = dep(WobFlt(entry.relWob(rel.roundEntryVoteAuthors.fwd), relVoteAuthor => relVoteAuthor.rec === myAuthor ? relVoteAuthor : C.skip));
                  dep(AccessPath(authorFlt, (dep, { rec: author }) => {
                    myCurrentVotedEntryWob.up(entry);
                    dep(Hog(() => myCurrentVotedEntryWob.dn()));
                  }));
                  
                }));
                
              }));
              
              // Entries can be submitted if we have no current Entry. So either:
              // 1 - No Round exists
              // 2 - Round exists, but no Entry submitted by our Author
              dep(AccessPath(myCurrentEntryWob.inverse(), dep => {
                let entryWritePane = dep(roundPane.addReal('write'));
                let entryWriteField = entryWritePane.addReal('field');
                let entryWriteSubmit = entryWritePane.addReal('submit');
                
                // TODO: Should use "form" stuff here
                let entryText = '';
                dep(entryWriteField.tellWob().hold(v => { entryText = v; }));
                
                entryWriteSubmit.setText('Submit!');
                dep(entryWriteSubmit.feelWob().hold( () => lands.tell({ command: 'entry', text: entryText }) ));
              }));
              
              // Show all Round stuff
              let noRoundWob = WobTmp('up');
              //dep(AccessPath(noRoundWob, dep => dep(roundPane.addReal('empty'))));
              dep(AccessPath(myStory.relWob(rel.storyCurrentRound.fwd), (dep, { rec: currentRound }) => {
                
                noRoundWob.dn();
                dep(Hog(() => noRoundWob.up()));
                
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
        
        /// =BELOW}
        
      });
      
      lands.addWay(Way({ lands, makeServer: () => foundation.makeHttpServer() }));
      U.lands = lands;
      await lands.open();
    };
    
    return { open };
  }
});
