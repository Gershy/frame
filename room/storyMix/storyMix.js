
U.buildRoom({
  name: 'storyMix',
  innerRooms: [ 'hinterlands', 'chance', 'record', 'real' ],
  build: (foundation, hinterlands, chance, record, real) => {
    
    let { AccessPath, Wob, WobVal, AggWobs } = U;
    let { Chance } = chance;
    let { Record, Relation } = record;
    let { Lands, LandsRecord, Way, Hut, rel: landsRel } = hinterlands;
    
    let heartbeatMs = 3 * 60 * 1000;
    
    let StoryMix = U.inspire({ name: 'StoryMix', insps: { LandsRecord } });
    let Author = U.inspire({ name: 'Author', insps: { LandsRecord } });
    let Story = U.inspire({ name: 'Story', insps: { LandsRecord } });
    let Settings = U.inspire({ name: 'Settings', insps: { LandsRecord } });
    let Round = U.inspire({ name: 'Round', insps: { LandsRecord } });
    let Entry = U.inspire({ name: 'Entry', insps: { LandsRecord } });
    
    let rel = {
      landsStoryMix:          Relation(Lands, StoryMix, '11'),
      storyMixStories:        Relation(StoryMix, Story, '1M'),
      storyMixAuthors:        Relation(StoryMix, Author, '1M'),
      hutAuthor:              Relation(Hut, Author, '11'),
      authorCurrentStory:     Relation(Author, Story, '11'),
      storySettings:          Relation(Story, Settings, '11'),
      storyAuthors:           Relation(Story, Author, '1M'),
      storyRounds:            Relation(Story, Round, '1M'),
      storyCurrentRound:      Relation(Story, Round, '1M'),
      roundEntries:           Relation(Round, Entry, '1M'),
      storyEntries:           Relation(Story, Entry, '1M'),
      entryAuthor:            Relation(Entry, Author, '1M'),
      roundEntryVoteAuthors:  Relation(Entry, Author, '1M')
    };
    
    let open = async () => {
      console.log('Init storyMix...');
      
      let lands = U.lands = Lands({
        foundation,
        heartbeatMs,
        /// {ABOVE=
        commands: [ 'author', 'entry', 'vote', 'story' ],
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
        
        // Follows
        dep(AccessPath(lands.relWob(landsRel.landsHuts.fwd), (dep, { rec: hut }) => {
          
          dep(hut.followRec(storyMix));
          
          dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
            
            dep(hut.followRec(story));
            
          }));
          
          dep(AccessPath(hut.relWob(rel.hutAuthor.fwd), (dep, { rec: author }) => {
            
            dep(AccessPath(author.relWob(rel.authorCurrentStory.fwd), (dep, { rec: currentStory }) => {
              
              hut.followRec(currentStory);
              
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
          dep(hut.comWob('author').hold((...args) => {
            
            console.log('HUT -> AUTHOR???');
            console.log('Hut:', hut.getTerm());
            console.log('Wants author:', args);
            
          }));
          
        }));
        
        // Controls on Authors
        dep(AccessPath(storyMix.relWob(rel.storyMixAuthors.fwd), (dep, { rec: author }) => {
          
          // Enable Author actions: 1) create/join story
          dep(author.comWob('story').hold((...args) => {
            
            // TODO: HEEERE! Still some loose ends in Above code.
            // Need to start writing Below code, so we can actually activate these
            // AccessPaths!
            
            console.log('\nAUTHOR -> STORY???');
            console.log('Author:', author.getValue());
            console.log('Create story:', args);
            
            //  let newStory = Story({ lands, value: {
            //    startMs: foundation.getMs(),
            //    endMs: null,
            //    settings: {
            //      roundMs,
            //      maxAuthors
            //    }
            //  }});
            
          }));
          
        }));
        
        // Controls on Stories
        dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
          
          let storySettings = story.getValue().settings; // Work with the actual JSON settings
          
          // Controls on Stories -> Rounds
          dep(AccessPath(story.relWob(rel.storyCurrentRound.fwd), (dep, relStoryCurrentRound) => {
            
            let storyCurrentRound = relStoryCurrentRound.rec;
            
            let unbeatableEntry = () => {
              // Sum up votes for all Entries. Figure out how many Authors haven't voted.
              // If not enough Authors remain to tip the balance to another Entry, return
              // the unbeatable Entry
              
              // TODO: Implement!
              return null;
            };
            let bestEntries = () => {
              // Return all Entries tied for first in votes
              
              // TODO: Implement!
              return null;
            };
            let endRound = entry => {
              
              // Add the Entry to the Story.
              // Detach the current Round
              story.attach(rel.storyEntries.fwd, entry);
              relStoryCurrentRound.shut();
              
            };
            
            // Round ends because of timeout with a random Entry tied for 1st place
            let timeout = setTimeout(() => endRound(chance.elem(bestEntries())), storyCurrentRound.getValue().endMs - foundation.getMs());
            dep(Hog(() => clearTimeout(timeout)));
            
            // Round ends because of insurmountable vote on a specific Entry
            dep(AccessPath(storyCurrentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
              
              dep(AccessPath(roundEntry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: roundEntryVoteAuthor }) => {
                
                // Another Vote just happened on an Entry! See if any Entry is unbeatable.
                let winningEntry = unbeatableEntry();
                if (winningEntry) endRound(entry);
                
              }));
              
            }));
            
          }));
          
          // Controls on Stories -> Authors
          dep(AccessPath(story.relWob(rel.storyAuthors.fwd), (dep, { rec: storyAuthor }) => {
            
            // Enable Author actions: 1) submit Entry; 2) submit Vote
            
            dep(AccessPath(storyAuthor.relWob(rel.hutAuthor.bak), (dep, { rec: storyAuthorHut }) => {
              
              dep(storyAuthorHut.comWob('entry').hold((...args) => {
                
                // User adds a new Entry to the Round.
                // If no Round exists, a new one is spawned
                
                console.log('\nAUTHOR SUBMITTED')
                console.log('Author:', storyAuthor.getValue());
                console.log('Entry:', args);
                console.log('');
                
                // TODO: If max Rounds reached, deny
                
                let storyCurrentRound = story.relWob(rel.storyCurrentRound.fwd).getValue();
                
                if (!storyCurrentRound) {
                  
                  let ms = foundation.getMs();
                  
                  storyCurrentRound = Round({ lands, value: {
                    roundNum: story.relWob(rel.storyRounds.fwd).getValue().toArr(v => v).length,
                    startMs: ms,
                    endMs: ms + storySettings.roundMs
                  }});
                  
                  story.attach(rel.storyRounds.fwd, storyCurrentRound);
                  story.attach(rel.storyCurrentRound.fwd, storyCurrentRound);
                  
                  console.log('BEGAN NEW ROUND');
                  
                }
                
                // TODO: If already submitted, deny
                
              }));
              
              dep(storyAuthorHut.comWob('vote').hold((...args) => {
                console.log('\nAUTHOR VOTED')
                console.log('Author:', storyAuthor.getValue());
                console.log('Vote:', args);
                console.log('');
              }));
              
            }));
            
          }));
          
        }));
        
        /// =ABOVE} {BELOW=
        
        let { Real } = real;
        
        let size = v => Math.round(v * 100);
        
        let rootReal = Real({ isRoot: true, flag: 'root' });
        rootReal.setColour('rgba(0, 0, 0, 1)');
        dep(Hog(() => rootReal.shut()));
        
        let scaleReal = rootReal.addReal(Real({ flag: 'scale' }));
        scaleReal.setSize(size(100));
        scaleReal.setColour('rgba(0, 0, 0, 0)');
        let scaleFac = 1 / size(100);
        let scaleFunc = () => {
          let { width, height } = document.body.getBoundingClientRect();
          let scaleAmt = (width <= height ? width : height) * scaleFac;
          scaleReal.setScale(scaleAmt);
        };
        window.addEventListener('resize', scaleFunc);
        scaleFunc();
        
        // TODO: `Lands` needs to be a LandsRecord, or needs an always-related LandsRecord
        // to serve as an entrypoint for Below
        // E.g. AccessPath(lands.clearing.relWob(appRel.relClearingStoryMix), (dep, { rec: storyMix }) => { /* ... */ })
        await new Promise(r => setTimeout(r, 0));
        let storyMix = null;
        for (let [ k, rec ] of lands.allRecs) if (rec.isInspiredBy(StoryMix)) { storyMix = rec; break; }
        
        dep(AccessPath(storyMix ? WobVal(storyMix) : Wob(), (dep, storyMix) => {
          
          let titleReal = scaleReal.addReal(Real({ flag: 'title' }));
          titleReal.setSize(size(100));
          titleReal.setColour('rgba(0, 0, 0, 0)')
          titleReal.setTextSize(size(5));
          dep(Hog(() => titleReal.shut()));
          dep(storyMix.hold(v => titleReal.setText(v)));
          
        }));
        
        /// =BELOW}
        
      });
      
      let way = Way({ lands, makeServer: () => foundation.makeHttpServer() });
      lands.addWay(way);
      await lands.open();
    };
    
    return { open };
  }
});
