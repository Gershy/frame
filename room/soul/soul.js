U.buildRoom({
  name: 'soul',
  innerRooms: [ 'record', 'hinterlands' ],
  build: (foundation, record, hinterlands) => {
    let { HorzScope, Hog, Wob, WobVal, WobTmp, AggWobs } = U;
    let { Rec, recTyper } = record;
    
    let { rt, add } = recTyper();
    add('soul',         Rec);
    add('thoughts',     Rec);
    add('archSoul',     Rec, '1M', hinterlands.rt.arch, rt.soul);
    add('hutSoul',      Rec, '11', hinterlands.rt.hut,  rt.soul);
    add('soulThoughts', Rec, '11', rt.soul,             rt.thoughts);
    
    let makeScope = lands => {
      
      return HorzScope(WobVal(lands.arch), (dep, arch) => {
        
        dep(HorzScope(arch.relWob(hinterlands.rt.archHut), (dep, archHut) => {
          
          let hut = archHut.members[1];
          let hutCurSoul = WobTmp('dn');
          dep(HorzScope(hut.relWob(rt.hutSoul), (dep, hutSoul) => dep(hutCurSoul.up(hutSoul.members[1]))));
          
          // Huts without Souls can hold Souls
          dep(HorzScope(hutCurSoul.inverse(), dep => {
            
            dep(hut.comWob('soulHold').hold(({ msg }) => {
              
              let { name, pass } = msg;
              if (!name) return hut.tell({ command: 'error', type: 'denied', msg: 'invalid name for login' });
              
              if (hut.relRec(rt.hutSoul)) return hut.tell({ command: 'error', type: 'denied', msg: 'a soul is already held' });
              
              let souls = arch.relRecs(rt.archSoul).map(archSoul => archSoul.members[1]);
              let findSoul = souls.find(soul => soul.value.name === name);
              
              let soul = null;
              if (!findSoul) {
                
                // TODO: Any souls created this way should expire from
                // a timeout unless they're verified first
                
                soul = lands.createRec('soul', { value: { name, term: null } });
                
                let thoughts = lands.createRec('thoughts', { value: { pass } });
                lands.createRec('soulThoughts', {}, soul, thoughts);
                
                lands.createRec('archSoul', {}, arch, soul);
                
              } else if (findSoul) {
                
                soul = findSoul[0];
                
              }
              
              if (soul.relRec(rt.hutSoul)) return hut.tell({ command: 'error', type: 'denied', msg: 'soul already held', orig: msg });
              if (soul.relRec(rt.soulThoughts).members[1].value.pass !== pass) return hut.tell({ command: 'error', typed: 'denied', msg: 'invalid login', orig: msg });
              
              soul.modify(v => v.gain({ term: hut.getTerm() }));
              lands.createRec('hutSoul', {}, hut, soul);
              
            }));
            
          }));
          
          // Huts with Souls can drop their Soul
          dep(HorzScope(hutCurSoul, dep => {
            
            dep(hut.comWob('soulDrop').hold(({ msg }) => {
              
              // Shut the AuthorHut
              let hutSoul = hut.relRec(rt.hutSoul);
              if (!hutSoul) return hut.tell({ command: 'error', type: 'denied', msg: 'soul already dropped', orig: msg });
              hutSoul.members[1].modify(v => v.gain({ term: null }));
              hutSoul.shut();
              
            }));
            
          }));
          
          // Follow Soul when possible
          dep(HorzScope(hutCurSoul, (dep, { value: soul }) => {
            
            // Follow the Soul through the Arch, not the Hut
            dep(hut.followRec(soul.relRec(rt.archSoul)));
            dep(hut.followRec(soul));
            
            // Follow the Soul's Thoughts (only for this Hut)
            dep(HorzScope(soul.relWob(rt.soulThoughts), (dep, soulThoughts) => {
              let thoughts = soulThoughts.members[1];
              dep(hut.followRec(thoughts));
              dep(hut.followRec(soulThoughts));
            }));
            
          }));
          
        }));
        
      });
      
    };
    
    return { rt, makeScope };
    
  }
});
