
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
    let Password = U.inspire({ name: 'Password', insps: { LandsRecord } });
    let Story = U.inspire({ name: 'Story', insps: { LandsRecord } });
    let Round = U.inspire({ name: 'Round', insps: { LandsRecord } });
    let Entry = U.inspire({ name: 'Entry', insps: { LandsRecord } });
    
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
        commands: [ 'author', 'story', 'join', 'entry', 'vote' ],
        /// =ABOVE} {BELOW=
        records: [ StoryMix, Author, Story, Round, Entry ],
        relations: rel.toArr(v => v),
        /// =BELOW}
      });
      
      AccessPath(WobVal(lands), async (dep, lands) => {
        
        let rootReal = await foundation.getRootReal();
        
        /// {ABOVE=
        
        let chance = Chance(null);
        
        let storyMix = dep(StoryMix({ lands }));
        lands.attach(rel.landsStoryMix.fwd, storyMix);
        
        // Follows
        dep(AccessPath(lands.relWob(landsRel.landsHuts.fwd), (dep, { rec: hut }) => {
          
          console.log('======= FOLLOWING HUT');
          
          dep(hut.followRec(storyMix));
          
          dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
            
            dep(hut.followRec(story));
            
          }));
          
          dep(AccessPath(hut.relWob(rel.hutAuthor.fwd), (dep, { rec: author }) => {
            
            console.log('======= FOLLOWING HUT AUTHOR');
            
            hut.followRec(author);
            
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
              
              let { name, desc, roundMs, maxAuthors } = msg.params;
              
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
              
              // TODO: Implement!
              return null;
            };
            let bestEntries = () => {
              // Return all Entries tied for first in votes
              
              // TODO: Implement!
              return null;
            };
            let endRound = (reason, entry) => {
              
              // Add the Entry to the Story.
              // Detach the current Round
              story.attach(rel.storyEntries.fwd, entry);
              relStoryCurrentRound.shut();
              
            };
            
            // Round ends because of timeout with a random Entry tied for 1st place
            let timeout = setTimeout(() => endRound('timeout', chance.elem(bestEntries())), storyCurrentRound.value.endMs - foundation.getMs());
            dep(Hog(() => clearTimeout(timeout)));
            
            // Round ends because of insurmountable vote on a specific Entry
            dep(AccessPath(storyCurrentRound.relWob(rel.roundEntries.fwd), (dep, { rec: roundEntry }) => {
              
              dep(AccessPath(roundEntry.relWob(rel.roundEntryVoteAuthors.fwd), (dep, { rec: roundEntryVoteAuthor }) => {
                
                // Another Vote just happened on an Entry! See if any Entry is unbeatable.
                let winningEntry = unbeatableEntry();
                if (winningEntry) endRound('winner', entry);
                
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
                console.log('Author:', storyAuthor.value);
                console.log('Entry:', args);
                console.log('');
                
                // TODO: If max Rounds reached, deny
                
                let storyCurrentRound = story.getRelRec(rel.storyCurrentRound.fwd);
                
                if (!storyCurrentRound) {
                  
                  let ms = foundation.getMs();
                  
                  storyCurrentRound = Round({ lands, value: {
                    roundNum: story.relWob(rel.storyRounds.fwd).size(),
                    startMs: ms,
                    endMs: ms + storySettings.roundMs
                  }});
                  
                  story.attach(rel.storyRounds.fwd, storyCurrentRound);
                  story.attach(rel.storyCurrentRound.fwd, storyCurrentRound);
                  
                  console.log('BEGAN NEW ROUND');
                  
                } else {
                  
                  storyCurrentRound = storyCurrentRound.rec;
                  
                }
                
                // TODO: If already submitted, deny
                
              }));
              
              dep(storyAuthorHut.comWob('vote').hold((...args) => {
                console.log('\nAUTHOR VOTED')
                console.log('Author:', storyAuthor.value);
                console.log('Vote:', args);
                console.log('');
              }));
              
            }));
            
          }));
          
        }));
        
        /// =ABOVE} {BELOW=
        
        let { Reality, Real } = real;
        
        let size = v => Math.round(v * 7);
        
        /*
        // NOTE: Consider `real.ForParW`, `real.ForParH`, `real.ForParSize`
        // Can these be made intelligent enough to generate CSS for some
        // properties? Consider the following:
        //
        // Reality({
        //   'par': [
        //     real.ForViewport((w, h) => ({
        //       size: [ w, h ]
        //     }))
        //   ],
        //   'par.child': [
        //     real.ForParSize((w, h) => ({
        //       size: [ w * 0.2, h * 0.2 ],
        //       textSize: w * 0.01
        //     }))
        //   ]
        // });
        //
        // We'll need javascript to apply "fontSize", as it can't be
        // specified as a percentage of the parent dimensions - only in
        // terms of parent's "fontSize"! But width and height can be set
        // as percentages. We can do CSS: `{ width: 20%; height: 20%; }`
        // But the rest is javascript:
        //
        // dep(parent.resizeWob().hold( (w, h) => child.setFontSize(w * 0.01) ))
        //
        // We'd need to determine that the float value "w"; SizeHorzUnits; doesn't
        // translate nicely into TextSizeUnits.
        // 
        // TODO: THIS MAY ACTUALLY WORK FOR **ANY** DISPLAY TECHNOLOGY!!
        // let reality = Reality({
        //   'root': [
        //     real.ForAlways(() => ({
        //       isRoot: true,
        //       colour: 'rgba(0, 0, 0, 1)'
        //     }))
        //   ],
        //   'root.scale': [
        //     real.ForAlways(() => ({
        //       size: 100,
        //       colour: 'rgba(255, 255, 255, 1)'
        //     })),
        //     real.ForViewport((w, h) => {
        //       return { scale: Math.min(w, h) * scaleFac };
        //     })
        //   ],
        //   'root.scale.title': [
        //     real.ForAlways(() => ({
        //       size: [ 100, 8 ],
        //       loc: [ 0, -46 ],
        //       colour: 'rgba(0, 0, 0, 0.2)',
        //       textSize: 5,
        //       text: 'Story Mix'
        //     }))
        //   ]
        // });
        */
        
        let scaleReal = rootReal.addReal(Real());
        scaleReal.setSize(size(100));
        scaleReal.setColour('rgba(255, 255, 255, 1)');
        // This scaling makes blinking cursors look funny :(
        //let scaleFac = 1 / size(100);
        //let scaleFunc = () => {
        //  let { width, height } = document.body.getBoundingClientRect();
        //  let scaleAmt = (width <= height ? width : height) * scaleFac;
        //  scaleReal.setScale(scaleAmt);
        //};
        //window.addEventListener('resize', scaleFunc);
        //scaleFunc();
        
        // TODO: `Lands` needs to be a LandsRecord, or needs an always-related LandsRecord
        // to serve as an entrypoint for Below
        // E.g. AccessPath(lands.clearing.relWob(appRel.relClearingStoryMix), (dep, { rec: storyMix }) => { /* ... */ })
        await new Promise(r => setTimeout(r, 0));
        let storyMix = null;
        for (let [ k, rec ] of lands.allRecs) if (rec.isInspiredBy(StoryMix)) { storyMix = rec; break; }
        
        dep(AccessPath(storyMix ? WobVal(storyMix) : Wob(), (dep, storyMix) => {
          
          let titleReal = dep(scaleReal.addReal(Real()));
          titleReal.setSize(size(100), size(8));
          titleReal.setLoc(size(0), size(-46));
          titleReal.setColour('rgba(0, 0, 0, 0.2)')
          titleReal.setTextSize(size(5));
          titleReal.setText('Story Mix');
          
          let myAuthorWob = dep(WobFlt(storyMix.relWob(rel.storyMixAuthors.fwd), relAuthor => {
            return relAuthor.rec.value.term === U.hutTerm ? relAuthor : C.skip;
          }));
          let noAuthorWob = WobTmp('up');
          
          dep(AccessPath(noAuthorWob, dep => {
            
            let loginReal = dep(scaleReal.addReal(Real()));
            loginReal.setSize(size(50));
            loginReal.setColour('rgba(255, 255, 255, 1)');
            loginReal.setBorder('outer', size(0.5), 'rgba(0, 0, 0, 1)');
            
            let userTitleReal = loginReal.addReal(Real());
            userTitleReal.setText('User:');
            userTitleReal.setColour('rgba(255, 255, 255, 1)');
            
            let userReal = loginReal.addReal(Real());
            userReal.setBorder('inner', size(0.5), 'rgba(0, 0, 0, 0.4)');
            userReal.setColour('rgba(255, 255, 255, 1)');
            
            let passTitleReal = loginReal.addReal(Real());
            passTitleReal.setText('Pass:');
            passTitleReal.setColour('rgba(255, 255, 255, 1)');
            
            let passReal = loginReal.addReal(Real());
            passReal.setBorder('inner', size(0.5), 'rgba(0, 0, 0, 0.4)');
            passReal.setColour('rgba(255, 255, 255, 1)');
            
            let submitReal = loginReal.addReal(Real());
            submitReal.setColour('rgba(235, 235, 235, 1)');
            submitReal.setText('Login!');
            
            [ userTitleReal, userReal, passTitleReal, passReal, submitReal ].forEach((r, n) => {
              r.setSize(size(50), size(10));
              r.setLoc(size(0), size(-20 + n * 10));
              r.setTextSize(size(4));
              r.setTextColour('rgba(0, 0, 0, 1)');
            });
            
            userReal.nextTrg = passReal;
            passReal.nextTrg = submitReal;
            
            let username = '';
            dep(userReal.tellWob().hold(v => { username = v; }));
            
            let password = '';
            dep(passReal.tellWob().hold(v => { password = v; }));
            
            submitReal.feelWob().hold(() => {
              
              console.log('LOGGING IN:', username, password);
              lands.tell({
                command: 'author',
                username: username,
                password: password
              });
              
            });
            
          }));
          
          dep(AccessPath(myAuthorWob, (dep, { rec: author }) => {
            
            noAuthorWob.dn();
            dep(Hog(() => noAuthorWob.up()));
            
            let noCurStoryWob = WobTmp('up');
            
            dep(AccessPath(noCurStoryWob, dep => {
              
              let joinReal = dep(scaleReal.addReal(Real()));
              joinReal.setSize(size(100), size(92));
              joinReal.setLoc(size(0), size(4));
              joinReal.setColour('rgba(255, 255, 255, 0)');
              
              let enterTitleReal = joinReal.addReal(Real());
              enterTitleReal.setSize(size(50), size(6));
              enterTitleReal.setLoc(size(-25), size(-43));
              enterTitleReal.setColour('rgba(150, 150, 255)')
              enterTitleReal.setTextSize(size(4));
              enterTitleReal.setText('Join Story');
              
              let enterReal = joinReal.addReal(Real());
              enterReal.setSize(size(50), size(86));
              enterReal.setLoc(size(-25), size(3));
              enterReal.setColour('rgba(0, 0, 0, 0)');
              enterReal.setBorder('inner', size(0.5), 'rgba(175, 175, 255)');
              
              let storyReals = new Set();
              let reflowStoryReals = () => {
                let cnt = 0;
                for (storyReal of storyReals) storyReal.setLoc(size(0), size(-43 + 0.5 + 6 + (cnt++) * 11));
              };
              dep(AccessPath(storyMix.relWob(rel.storyMixStories.fwd), (dep, { rec: story }) => {
                
                let storyReal = dep(enterReal.addReal(Real()));
                storyReal.setSize(size(50 - 3), size(10));
                storyReal.setColour('rgba(200, 200, 255, 1)');
                
                let storyNameReal = storyReal.addReal(Real());
                storyNameReal.setSize(size(40), size(5));
                storyNameReal.setLoc(size(0), size(-2.5));
                storyNameReal.setColour('rgba(0, 0, 0, 0)');
                storyNameReal.setTextSize(size(3));
                
                let storyDescReal = storyReal.addReal(Real());
                storyDescReal.setSize(size(50 - 3), size(4));
                storyDescReal.setLoc(size(0), size(2));
                storyDescReal.setColour('rgba(0, 0, 0, 0)');
                storyDescReal.setTextSize(size(2));
                
                dep(story.hold(v => {
                  storyNameReal.setText(v.name);
                  storyDescReal.setText(v.desc);
                }));
                
                // TODO: Automatically convert Records to their uids in cases like this??
                dep(storyReal.feelWob().hold( () => lands.tell({ command: 'join', story: story.uid }) ));
                
                storyReals.add(storyReal);
                dep(Hog(() => storyReals.delete(storyReal)));
                
                reflowStoryReals();
                dep(Hog(reflowStoryReals));
                
              }));
              
              let createTitleReal = joinReal.addReal(Real());
              createTitleReal.setSize(size(50), size(6));
              createTitleReal.setLoc(size(25), size(-43));
              createTitleReal.setColour('rgba(150, 170, 255)');
              createTitleReal.setTextSize(size(4));
              createTitleReal.setText('Create Story');
              
              let createReal = joinReal.addReal(Real());
              createReal.setSize(size(50), size(86));
              createReal.setLoc(size(25), size(3));
              createReal.setColour('rgba(0, 0, 0, 0)');
              createReal.setBorder('inner', size(0.5), 'rgba(200, 225, 255)');
              
              // Create Story form
              let makeField = (par, cnt, name, type) => {
                
                let title = par.addReal(Real());
                title.setSize(size(40), size(4));
                title.setLoc(size(0), size(-40 + 1 + cnt.val * 10));
                title.setColour('rgba(125, 125, 125, 1)');
                title.setTextSize(size(3));
                title.setText(name);
                
                let field = par.addReal(Real());
                field.setSize(size(40), size(5));
                field.setLoc(size(0), size(-40 + 5.5 + cnt.val * 10));
                field.setColour('rgba(0, 0, 0, 0)');
                field.setBorder('inner', size(0.25), 'rgba(125, 125, 125, 1)');
                field.setTextSize(size(3));
                field.setTextColour('rgba(125, 125, 125, 1)');
                
                cnt.val++;
                
                return { title, field, valWob: field.tellWob() };
                
              };
              let makeFields = (dep, par, vals) => {
                
                let fullVal = {};
                let cnt = { val: 0 };
                let prev = null;
                
                vals.forEach(([ name, type ], k) => {
                  
                  fullVal[k] = null;
                  let { field, valWob } = makeField(par, cnt, name, type);
                  
                  if (prev) prev.nextTrg = field;
                  prev = field;
                  
                  dep(valWob.hold(v => { fullVal[k] = v; }));
                  
                });
                
                return {
                  prev,
                  getFullVal: () => fullVal
                };
                
              };
              
              let { prev, getFullVal } = makeFields(dep, createReal, {
                name: [ 'Story Name', 'string' ],
                desc: [ 'Description', 'string' ],
                roundMs: [ 'Round Duration', 'int' ],
                maxAuthors: [ 'Max Authors', 'int' ]
              });
              
              let createSubmitReal = createReal.addReal(Real());
              createSubmitReal.setSize(size(40), size(7));
              createSubmitReal.setLoc(size(0), size(10));
              createSubmitReal.setTextSize(size(4));
              createSubmitReal.setText('Create Story!');
              dep(createSubmitReal.feelWob().hold(() => {
                
                lands.tell({
                  command: 'story',
                  params: getFullVal()
                });
                
              }));
              
              prev.nextTrg = createSubmitReal;
              
            }));
            
            dep(AccessPath(author.relWob(rel.authorCurrentStory.fwd), (dep, { rec: authorCurStory }) => {
              
              let storyReal = dep(scaleReal.addReal(Real()));
              storyReal.setSize(size(100), size(92));
              storyReal.setLoc(size(0), size(4));
              storyReal.setColour('rgba(0, 0, 0, 0)');  
              
              let storyTitleReal = storyReal.addReal(Real());
              storyTitleReal.setSize(size(100), size(6));
              storyTitleReal.setLoc(size(0), size(-43));
              storyTitleReal.setTextSize(size(4));
              dep(authorCurStory.hold(v => storyTitleReal.setText(`Story: ${v.name}`)));
              
              noCurStoryWob.dn();
              dep(Hog(() => noCurStoryWob.up()));
              
            }));
            
          }));
          
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
