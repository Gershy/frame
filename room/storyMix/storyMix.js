U.buildRoom({
  name: 'storyMix',
  innerRooms: [ 'hinterlands', 'record', 'soul', 'chance', 'real', 'realHtmlCss' ],
  build: (foundation, hinterlands, record, soul, chance, real, realHtmlCss) => {
    
    // TODO: If an AccessPath accepted a GeneratorFunction as its `gen` param,
    // the GeneratorFunction could `yield` every dependent Hog.
    // TODO: "innerRooms" now depends on Bearing. Above needs potentially
    // lots of different realRooms, whereas Below never needs more than 1.
    
    let { HorzScope: AccessPath, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Chance } = chance;
    let { Rec, recTyper } = record;
    let { Lands } = hinterlands;
    
    let soulRt = soul.rt;
    let landsRt = hinterlands.rt;
    
    let { rt, add } = recTyper();
    add('storyMix', Rec); // Note: `Rec` is optional when it's the last param
    add('story', Rec);
    add('round', Rec);
    add('entry', Rec);
    
    add('archStoryMix',       Rec, '11', landsRt.arch, rt.storyMix);
    add('storyMixStory',      Rec, '1M', rt.storyMix,         rt.story);
    add('soulCurStory',       Rec, 'M1', soulRt.soul,        rt.story);
    add('storyCreatorSoul',   Rec, 'M1', rt.story,            soulRt.soul);
    add('storySoul',          Rec, 'MM', rt.story,            soulRt.soul);
    add('storyRound',         Rec, '1M', rt.story,            rt.round);
    add('storyCurRound',      Rec, '11', rt.story,            rt.round);
    add('storyEntry',         Rec, '1M', rt.story,            rt.entry);
    add('roundEntry',         Rec, '1M', rt.round,            rt.entry);
    add('entrySoul',          Rec, 'M1', rt.entry,            soulRt.soul);
    add('entryVoterSoul',     Rec, 'MM', rt.entry,            soulRt.soul);
    
    let open = async () => {
      
      console.log('Init storyMix...');
      
      let recTypes = { ...landsRt, ...soulRt, ...rt }; // TODO: Collisions could occur...
      let heartbeatMs = 10 * 60 * 1000;
      let lands = U.lands = Lands({ foundation, recTypes, heartbeatMs });
      
      // Note: The Foundation has host and port values, but technically
      // a Foundation can run a number of servers - so this ip+port
      // pair is like the "default" host+port pair, while others could
      // exist too.
      let { ip, port } = foundation;
      lands.makeServers.push(pool => foundation.makeHttpServer(pool, '127.0.0.1', 80));
      lands.makeServers.push(pool => foundation.makeSoktServer(pool, '127.0.0.1', 8000));
      
      /// {ABOVE=
      // TODO: Eventually decouple this from hinterlands
      // TODO: Should commandline arguments determine which real-rooms
      //       to support?
      // NOTE: Maybe a list of room names, rather than rooms? That could
      //       potentially clear up dependencies for Below...
      lands.setRealRooms([ realHtmlCss ]);
      /// =ABOVE}
      
      let { UnitPx, UnitPc } = real;
      let { FillParent, WrapChildren, ShowText } = real;
      let { AxisSections, LinearSlots, CenteredSlot, TextFlowSlots } = real;
      lands.realLayout = {
        
        'main': {
          slot: par => par.cmps.slots.insertViewPortItem(),
          slots: AxisSections({ axis: 'y', cuts: [ UnitPx(50) ] }),
          decals: {
            colour: 'rgba(0, 0, 0, 1)'
          }
        },
        'main.header': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          slots: AxisSections({ axis: 'x', cuts: [ UnitPc(1/3), UnitPc(1/3), UnitPc(1/6) ] }),
          decals: {
            colour: 'rgba(100, 255, 30, 0.75)',
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.header.title': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          size: ShowText({ origin: 'cc' }),
          decals: {
            textSize: UnitPx(24),
          }
        },
        'main.header.back': {
          slot: par => par.cmps.slots.insertSectionItem(3),
          size: ShowText({ origin: 'cc' }),
          decals: {
            textSize: UnitPx(20),
            border: { ext: UnitPx(2), colour: 'rgba(255, 255, 255, 1)' }
          }
        }, // TODO: Separate the next items as a new section
        
        'main.loggedOut': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          slots: CenteredSlot(),
          decals: {
            colour: 'rgba(200, 200, 200, 1)'
          }
        },
        'main.loggedOut.form': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          size: WrapChildren({ pad: UnitPx(10), padB: UnitPx(50) }),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.loggedOut.form.item': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ padB: UnitPx(8) }),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.loggedOut.form.item.title': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(2) }),
          decals: {
            textSize: UnitPx(30)
          }
        },
        'main.loggedOut.form.item.field': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', interactive: true, pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(20)
          }
        },
        'main.loggedOut.form.submit': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', padV: UnitPx(4) }),
          decals: {
            colour: 'rgba(255, 180, 0, 0.8)',
            textSize: UnitPx(30)
          }
        },
        
        'main.loggedIn': {
          slot: par => par.cmps.slots.insertSectionItem(1),
        },
        'main.loggedIn.storyOut': {
          size: FillParent({}),
          slots: AxisSections({ axis: 'x', cuts: [ UnitPc(0.5) ] })
        },
        'main.loggedIn.storyOut.storyList': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          slots: LinearSlots({ axis: 'y', dir: '+' }),
          decals: {
            colour: 'rgba(170, 255, 170, 0.9)'
          }
        },
        'main.loggedIn.storyOut.storyList.item': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ pad: UnitPx(5), padB: UnitPx(0) }),
        },
        'main.loggedIn.storyOut.storyList.item.content': {
          size: WrapChildren({}),
          slots: LinearSlots({ axis: 'y', dir: '+' }),
          decals: {
            colour: 'rgba(0, 120, 0, 0.8)'
          }
        },
        'main.loggedIn.storyOut.storyList.item.content.name': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(4) }),
          decals: {
            textSize: UnitPx(25),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.loggedIn.storyOut.storyList.item.content.desc': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(4) }),
          decals: {
            textSize: UnitPx(16),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        
        'main.loggedIn.storyOut.storyCreate': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          slots: CenteredSlot({}),
          decals: {
            colour: 'rgba(200, 255, 200, 1)'
          }
        },
        'main.loggedIn.storyOut.storyCreate.form': {
          slot: par => par.cmps.slots.insertCenteredItem(),
          size: WrapChildren({ pad: UnitPx(5) }),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.loggedIn.storyOut.storyCreate.form.item': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ padB: UnitPx(8) }),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.loggedIn.storyOut.storyCreate.form.item.title': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(2) }),
          decals: {
            textSize: UnitPx(20)
          }
        },
        'main.loggedIn.storyOut.storyCreate.form.item.field': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', interactive: true, pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(18)
          }
        },
        'main.loggedIn.storyOut.storyCreate.form.submit': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'cc', pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(0, 100, 0, 1)',
            textColour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(25)
          }
        },
        
        'main.loggedIn.storyIn': {
          size: FillParent({}),
          slots: AxisSections({ axis: 'y', cuts: [ UnitPc(0.5) ] })
        },
        'main.loggedIn.storyIn.upperPane': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          slots: AxisSections({ axis: 'y', dir: '-', cuts: [ UnitPx(30) ] })
        },
        'main.loggedIn.storyIn.lowerPane': {
          slot: par => par.cmps.slots.insertSectionItem(1),
        },
        
        'main.loggedIn.storyIn.upperPane.meta': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          slots: AxisSections({ axis: 'x', cuts: [ UnitPc(1/3), UnitPc(1/3) ] }),
          decals: {
            colour: 'rgba(0, 0, 0, 1)',
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.loggedIn.storyIn.upperPane.meta.clock': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          size: ShowText({ origin: 'cc' }),
          decals: {
            textSize: UnitPx(18)
          }
        },
        
        'main.loggedIn.storyIn.upperPane.entries': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          size: WrapChildren({ pad: UnitPx(6) }),
          slots: TextFlowSlots({ gap: UnitPx(4), lineHeight: UnitPx(22) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: UnitPx(4), colour: 'rgba(177, 232, 177, 1)' }
          }
        },
        'main.loggedIn.storyIn.upperPane.entries.entry': {
          slot: par => par.cmps.slots.insertTextFlowItem(),
          decals: {
            colour: 'rgba(0, 80, 0, 0.074)',
            textSize: UnitPx(16),
            hover: {
              colour: 'rgba(0, 80, 0, 0.8)',
              textSize: UnitPx(16),
              textColour: 'rgba(255, 255, 255, 1)'
            }
          }
        },
        
        'main.loggedIn.storyIn.lowerPane.writing': {
          size: FillParent({}),
          slots: AxisSections({ axis: 'y', dir: '-', cuts: [ UnitPx(50) ] })
        },
        'main.loggedIn.storyIn.lowerPane.writing.submit': {
          slot: par => par.cmps.slots.insertSectionItem(0),
          size: ShowText({ origin: 'cc' }),
          decals: {
            colour: 'rgba(150, 255, 130, 1)',
            textSize: UnitPx(24)
          }
        },
        'main.loggedIn.storyIn.lowerPane.writing.field': {
          slot: par => par.cmps.slots.insertSectionItem(1),
          size: ShowText({ origin: 'lt', interactive: true, multiLine: true, pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(16)
          }
        },
        
        'main.loggedIn.storyIn.lowerPane.voting': {
          size: FillParent({}),
          slots: LinearSlots({ axis: 'y', dir: '+' }),
          decals: {
            colour: 'rgba(175, 200, 175, 1)'
          }
        },
        'main.loggedIn.storyIn.lowerPane.voting.entry': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ pad: UnitPx(8), padB: UnitPx(0) }),
          slots: LinearSlots({ axis: 'y', dir: '+' })
        },
        'main.loggedIn.storyIn.lowerPane.voting.entry.author': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(0, 150, 0, 1)',
            textSize: UnitPx(14),
            textColour: 'rgba(255, 255, 255, 1)'
          }
        },
        'main.loggedIn.storyIn.lowerPane.voting.entry.text': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(10), multiLine: true }),
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(16),
            textFont: 'serif',
            border: { ext: UnitPx(8), colour: 'rgba(0, 150, 0, 1)' }
          }
        },
        'main.loggedIn.storyIn.lowerPane.voting.entry.votes': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: WrapChildren({ pad: UnitPx(4) }),
          slots: LinearSlots({ axis: 'x', dir: '+' }),
          decals: {
            colour: 'rgba(0, 100, 0, 1)'
          }
        },
        'main.loggedIn.storyIn.lowerPane.voting.entry.votes.vote': {
          slot: par => par.cmps.slots.insertLinearItem(),
          size: ShowText({ origin: 'lc', pad: UnitPx(4) }),
          decals: {
            colour: 'rgba(0, 150, 0, 1)',
            textColour: 'rgba(255, 255, 255, 1)',
            textSize: UnitPx(14),
            border: { ext: UnitPx(1), colour: 'rgba(255, 255, 255, 1)' }
          }
        }
        
      };
      
      /// {ABOVE=
      let storyMix = lands.createRec('storyMix', { value: { version: '0.0.1' } });
      let archStoryMix = lands.createRec('archStoryMix', {}, lands.arch, storyMix);
      /// =ABOVE}
      
      let rootScope = AccessPath(lands.arch.relWob(rt.archStoryMix), async (dep, archStoryMix) => {
        
        let storyMix = archStoryMix.members[1];
        
        /// {ABOVE=
        
        let chance = Chance(null);
        
        // Allow Huts to gain Souls
        dep(soul.makeScope(lands));
        
        // Follows
        dep(AccessPath(lands.arch.relWob(landsRt.archHut), (dep, archHut) => {
          
          // Huts immediately follow the root StoryMix instance
          let hut = archHut.members[1];
          dep(hut.followRec(archStoryMix));
          dep(hut.followRec(storyMix));
          
          dep(AccessPath(hut.relWob(soulRt.hutSoul), (dep, hutSoul) => {
            
            let soul = hutSoul.members[1];
            
            // Only Huts with Souls follow the list of all Stories
            dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
              
              let story = storyMixStory.members[1];
              dep(hut.followRec(story));
              dep(hut.followRec(storyMixStory));
              
            }));
            
            // Only Huts with Souls follow the current Story
            dep(AccessPath(soul.relWob(rt.soulCurStory), (dep, soulCurStory) => {
              
              let curStory = soulCurStory.members[1];
              dep(hut.followRec(curStory));
              dep(hut.followRec(soulCurStory));
              
              dep(AccessPath(curStory.relWob(rt.storyEntry), (dep, storyEntry) => {
                
                let entry = storyEntry.members[1];
                dep(hut.followRec(entry));
                dep(hut.followRec(storyEntry));
                
                dep(AccessPath(entry.relWob(rt.entrySoul), (dep, entrySoul) => {
                  
                  let soul = entrySoul.members[1];
                  dep(hut.followRec(soul));
                  dep(hut.followRec(entrySoul));
                  
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
                  
                  dep(AccessPath(entry.relWob(rt.entrySoul), (dep, entrySoul) => {
                    let soul = entrySoul.members[1];
                    dep(hut.followRec(soul));
                    dep(hut.followRec(entrySoul));
                  }));
                  
                  dep(AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
                    let voterSoul = entryVoterSoul.members[1];
                    dep(hut.followRec(voterSoul));
                    dep(hut.followRec(entryVoterSoul));
                  }));
                  
                }));
                
              }));
              
            }));
            
          }));
          
        }));
        
        // Controls on Souls
        dep(AccessPath(lands.arch.relWob(soulRt.archSoul), (dep, archSoul) => {
          
          let soul = archSoul.members[1];
          
          // Enable Soul actions: 1) create story 2) join story
          dep(AccessPath(soul.relWob(soulRt.hutSoul), (dep, hutSoul) => {
            
            let hut = hutSoul.members[0];
            dep(hut.comWob('story').hold(({ msg }) => {
              
              let { name, desc, roundMs, maxSouls } = msg;
              
              if (!U.isType(name, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(desc, String)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(roundMs, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              if (!U.isType(maxSouls, Number)) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid', orig: msg });
              
              let newStory = lands.createRec('story', { value: {
                name,
                desc,
                startMs: foundation.getMs(),
                endMs: null,
                numSouls: 0,
                settings: {
                  roundMs,
                  // TODO: minSouls (can't start a Round until this many Souls have joined)
                  maxSouls
                  // TODO: minEntryLength
                  // TODO: maxEntryLength
                  // TODO: showRoundEntrySoul
                  // TODO: showStoryEntrySoul
                  // TODO: showRoundEntryVotes  // (hidden|amount|names) (amount: show count but not names)
                  // TODO: maxRounds
                }
              }});
              
              // Liven up `newStory.value.numSouls`
              let ap = AccessPath(newStory.relWob(rt.storySoul), (dep, storySoul) => {
                newStory.modify(v => (v.numSouls++, v));
                dep(Hog(() => newStory.modify(v => (v.numSouls--, v))));
              });
              
              let storyMixStory = lands.createRec('storyMixStory', {}, storyMix, newStory);
              storyMixStory.shutWob().hold(() => ap.shut()); // Stop counting souls if relation breaks
              
              let storyCreatorSoul = lands.createRec('storyCreatorSoul', {}, newStory, soul);
              let storySoul = lands.createRec('storySoul', {}, newStory, soul);
              
            }));
            dep(hut.comWob('join').hold(({ msg }) => {
              
              if (!msg.has('story')) return hut.tell({ command: 'error', type: 'denied', msg: 'no story specified', orig: msg });
              
              if (msg.story !== null) {
                
                if (soul.relRec(rt.soulCurStory)) return hut.tell({ command: 'error', type: 'denied', msg: 'already in a story', orig: msg });
                
                let findStory = storyMix.relRecs(rt.storyMixStory).find(sms => sms.members[1].uid === msg.story);
                if (!findStory) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid uid', orig: msg });
                
                // We found the Story! Reference it.
                let story = findStory[0].members[1];
                
                // Group Soul and Story if not already grouped
                let findSoulInStory = story.relRecs(rt.storySoul).find(sa => sa.members[1] === soul);
                if (!findSoulInStory) lands.createRec('storySoul', {}, story, soul);
                
                // Always set this Story as the Soul's CurrentStory
                lands.createRec('soulCurStory', {}, soul, story);
                
              } else {
                
                if (!soul.relRec(rt.soulCurStory)) return hut.tell({ command: 'error', type: 'denied', msg: 'not in a story', orig: msg });
                soul.relRec(rt.soulCurStory).shut();
                
              }
              
            }));
            
          }));
          
          // Controls on Soul -> CurStory
          dep(AccessPath(soul.relWob(rt.soulCurStory), (dep, soulCurStory) => {
            
            let story = soulCurStory.members[1];
            
            // Enable Soul actions: 1) submit Entry; 2) submit Vote
            dep(AccessPath(soul.relWob(soulRt.hutSoul), (dep, hutSoul) => {
              
              let hut = hutSoul.members[0];
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
                    dep(AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
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
                let scope = AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
                  entry.modify(v => (v.numVotes++, v));
                  dep(Hog(() => entry.modify(v => (v.numVotes--, v))));
                });
                
                // Connect Entry to Soul
                let entrySoul = lands.createRec('entrySoul', {}, entry, soul);
                
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
                
                lands.createRec('entryVoterSoul', {}, findEntry[0], soul);
                
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
              
              // Sum votes for Entries, determine how many votes remain
              // If too few Souls remain to unseat winner, return winner
              
              let entries = round.relRecs(rt.roundEntry).map(roundEntry => roundEntry.members[1]);
              if (entries.length === 0) return null;
              if (entries.length === 1) return entries[0]; // TODO: A lone Entry is unbeatable??
              
              let numVotesRemaining = story.value.numSouls - round.value.numVotes;
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
              dep(AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
                
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
              if (v.numVotes >= story.value.numSouls) endRound('noMoreVotes', bestEntry());
            }));
            
          }));
          
        }));
        
        /// =ABOVE} {BELOW=
        
        let rootReal = await lands.getRootReal();
        
        let mainReal = dep(rootReal.addReal('main'));
        let headerReal = mainReal.addReal('header', 'lolol');
        let titleReal = headerReal.addReal('title');
        titleReal.setText('StoryMix');
        
        // Some fancy footwork: only listen to do `mySoulWob.up(...)`
        // when `mySoulWob` is dn!
        let mySoulWob = WobTmp('dn');
        dep(AccessPath(lands.arch.relWob(soulRt.archSoul), (dep, archSoul) => {
          let soul = archSoul.members[1];
          if (soul.value.term === U.hutTerm) dep(mySoulWob.up(soul));
        }));
        
        dep(AccessPath(mySoulWob.inverse(), dep => {
          
          let loggedOutReal = dep(mainReal.addReal('loggedOut'));
          let loginForm = loggedOutReal.addReal('form');
          let form = loginForm.form('Login', dep,
            v => form.clear() && lands.tell({ command: 'soulHold', ...v }),
            {
              name: { type: 'str', desc: 'Username' },
              pass: { type: 'str', desc: 'Password' }
            }
          );
          
        }));
        
        dep(AccessPath(mySoulWob, (dep, { value: soul }) => {
          
          let loggedInReal = dep(mainReal.addReal('loggedIn'));
          
          let myStoryWob = WobTmp('dn');
          dep(AccessPath(soul.relWob(rt.soulCurStory), (dep, soulCurStory) => {
            
            let curStory = soulCurStory.members[1];
            dep(myStoryWob.up(curStory));
            
          }));
          
          dep(AccessPath(myStoryWob.inverse(), dep => {
            
            let noStoryReal = dep(loggedInReal.addReal('storyOut'));
            
            let storyList = noStoryReal.addReal('storyList');
            dep(AccessPath(storyMix.relWob(rt.storyMixStory), (dep, storyMixStory) => {
              
              let story = storyMixStory.members[1];
              
              let joinStory = dep(storyList.addReal('item'));
              let joinStoryContent = joinStory.addReal('content');
              let joinStoryContentName = joinStoryContent.addReal('name');
              let joinStoryContentDesc = joinStoryContent.addReal('desc');
              
              dep(story.hold(({ name, desc }) => {
                joinStoryContentName.setText(name);
                joinStoryContentDesc.setText(desc);
              }));
              joinStory.feelWob().hold(() => lands.tell({ command: 'join', story: story.uid }));
              
            }));
            
            let storyCreate = noStoryReal.addReal('storyCreate');
            let storyForm = storyCreate.addReal('form');
            let form = storyForm.form('Create!', dep, v => form.clear() && lands.tell({ command: 'story', ...v }), {
              name:       { type: 'str', desc: 'Name', v: 'test' },
              desc:       { type: 'str', desc: 'Description', v: 'TEST TEST' },
              roundMs:    { type: 'int', desc: 'Round Timer', v: '10000000' },
              maxSouls:   { type: 'int', desc: 'Max Authors', v: '10' }
            });
            
          }));
          
          dep(AccessPath(myStoryWob, (dep, { value: story }) => {
            
            let backReal = dep(headerReal.addReal('back'));
            backReal.setText('Back');
            backReal.feelWob().hold(() => lands.tell({ command: 'join', story: null }));
            
            let storyReal = dep(loggedInReal.addReal('storyIn'));
            let storyUpperReal = storyReal.addReal('upperPane');
            let storyLowerReal = storyReal.addReal('lowerPane');
            
            let entriesReal = storyUpperReal.addReal('entries');
            dep(AccessPath(story.relWob(rt.storyEntry), (dep, storyEntry) => {
              let entry = storyEntry.members[1];
              let entryReal = dep(entriesReal.addReal('entry'));
              dep(entry.hold(v => entryReal.setText(v.text)));
            }));
            
            let metaReal = storyUpperReal.addReal('meta');
            let clockReal = metaReal.addReal('clock');
            
            let myCurEntryWob = WobTmp('dn');
            let myCurVotedEntryWob = WobTmp('dn');
            let myCurRoundWob = WobTmp('dn');
            dep(AccessPath(story.relWob(rt.storyCurRound), (dep, storyCurRound) => {
              
              let round = storyCurRound.members[1];
              dep(myCurRoundWob.up(round));
              
              dep(AccessPath(round.relWob(rt.roundEntry), (dep, roundEntry) => {
                
                let entry = roundEntry.members[1];
                
                // Look at "entrySoul" to establish current Entry
                dep(AccessPath(entry.relWob(rt.entrySoul), (dep, entrySoul) => {
                  
                  let soulOfEntry = entrySoul.members[1];
                  if (soulOfEntry === soul) dep(myCurEntryWob.up(entry));
                  
                }));
                
                // Look at "entryVoterSoul" to establish current voted Entry
                dep(AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
                  
                  let voterSoul = entryVoterSoul.members[1];
                  if (voterSoul === soul) dep(myCurVotedEntryWob.up(entry));
                  
                }));
                
              }));
              
            }));
            
            dep(AccessPath(myCurRoundWob.inverse(), dep => {
              clockReal.setText('---');
            }));
            dep(AccessPath(myCurRoundWob, (dep, { value: round }) => {
              
              let updTime = () => {
                let diff = round.value.endMs - foundation.getMs();
                clockReal.setText(`${Math.floor(diff / 1000)}s`);
              };
              let clockInterval = setInterval(updTime, 500); updTime();
              dep(Hog(() => clearInterval(clockInterval)));
              
            }));
            
            dep(AccessPath(myCurEntryWob.inverse(), dep => {
              
              let writeReal = dep(storyLowerReal.addReal('writing'));
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
                
                let entriesReal = dep(storyLowerReal.addReal('voting'));
                
                dep(AccessPath(round.relWob(rt.roundEntry), (dep, roundEntry) => {
                  
                  let entry = roundEntry.members[1];
                  
                  let entryReal = dep(entriesReal.addReal('entry'));
                  let entryAuthorReal = entryReal.addReal('author');
                  let entryTextReal = entryReal.addReal('text');
                  dep(entry.hold(v => entryTextReal.setText(v.text)));
                  
                  // Listen for clicks when we haven't voted
                  dep(AccessPath(myCurVotedEntryWob.inverse(), dep => {
                    dep(entryReal.feelWob().hold(() => lands.tell({ command: 'vote', entry: entry.uid })));
                  }));
                  
                  dep(AccessPath(entry.relWob(rt.entrySoul), (dep, entrySoul) => {
                    let soul = entrySoul.members[1];
                    dep(soul.hold(v => entryAuthorReal.setText(v.username)));
                  }));
                  
                  let entryVotesReal = null;
                  dep(AccessPath(entry.relWob(rt.entryVoterSoul), (dep, entryVoterSoul) => {
                    // TODO: BAD!
                    if (!entryVotesReal) entryVotesReal = entryReal.addReal('votes');
                    
                    let voterSoul = entryVoterSoul.members[1];
                    let voterSoulReal = entryVotesReal.addReal('vote');
                    dep(voterSoul.hold(v => voterSoulReal.setText(v.username)));
                  }));
                  
                }));
                
              }));
              
            }));
            
          }));
          
        }));
        
        /// =BELOW}
        
      });
      
      await lands.open();
      
    };
    
    return { open };
  }
});
