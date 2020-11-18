global.rooms['internal.test.test2'] = async foundation => {
  
  let [ HtmlBrowserHabitat, Setup ] = await Promise.allArr([
    foundation.getRoom('hinterlands.habitat.htmlBrowser'),
    foundation.getRoom('hinterlands.setup')
  ]);
  
  return Setup('t2', 'internal.test.test2', {
    
    habitats: [ HtmlBrowserHabitat() ],
    parFn: (hut, test2, real, dep) => {
    },
    kidFn: (hut, test2, real, dep) => {
      
      let { FreeLayout, SizedLayout, Axis1DLayout, TextLayout, TextInputLayout, ScrollLayout } = U.setup;
      let { Chooser } = U.logic;
      
      let mainReal = dep(real.addReal('t2.main', {
        layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
        decals: {
          colour: 'rgba(0, 120, 115, 1)',
          textColour: 'rgba(255, 255, 255, 1)'
        }
      }));
      
      let userChooser = dep(Chooser(hut.relSrc('t2.presence')));
      dep.scp(userChooser.srcs.off, (noPresence, dep) => {
        
        let loginAct = dep(hut.enableAction('t2.login', ({ name }) => {
          
          let user = null
            || test2.relRecs('t2.user').find(rec => rec.getVal('name') === name).val
            || hut.createRec('t2.user', [ test2 ], { name, ms: foundation.getMs() });
          
          hut.createRec('t2.presence', [ hut, user ], { ms: foundation.getMs() });
          
        }));
        
        let loggedOutReal = dep(mainReal.addReal('t2.loggedOut', {
          layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
          innerLayout: Axis1DLayout({ axis: 'y', dir: '+', cuts: 'focus' }),
          decals: { colour: 'rgba(255, 255, 255, 0.15)' }
        }));
        let nameReal = loggedOutReal.addReal('t2.name', {
          layouts: [
            SizedLayout({ w: '200px', h: '60px' }),
            TextInputLayout({ prompt: 'Name', size: '200%', align: 'mid' })
          ],
          decals: {
            textColour: 'rgba(255, 255, 255, 1)',
            border: { ext: '2px', colour: 'rgba(255, 255, 255, 1)' }
          }
        });
        let submitReal = loggedOutReal.addReal('t2.submit', {
          layouts: [ TextLayout({ text: 'Submit', size: '150%' }) ],
          decals: { border: { ext: '2px', colour: 'rgba(255, 255, 255, 1)' } }
        });
        
        let inputWatcher = dep(nameReal.addInput());
        let submitWatcher = dep(submitReal.addPress());
        
        dep(submitWatcher.src.route(() => loginAct.act({ name: inputWatcher.src.val })));
        
      });
      dep.scp(userChooser.srcs.onn, (user, dep) => {
        
        let logoutAct = dep(hut.enableAction('t2.logout', () => void user.end()));
        
        let headerReal = dep(mainReal.addReal('t2.header', {
          layouts: [ FreeLayout({ mode: 'tl', x: '0', y: '0', w: '100%', h: '80px' }) ],
          decals: { border: { ext: '4px', colour: 'rgba(255, 255, 255, 1)' } }
        }));
        
        headerReal.addReal('t2.iden', {
          layouts: [
            FreeLayout({ mode: 'center', x: '0', y: '0', w: '40%', h: '100%' }),
            TextLayout({ text: user.getVal('name'), align: 'mid', size: '200%' })
          ]
        });
        let logoutReal = headerReal.addReal('t2.logout', {
          layouts: [
            FreeLayout({ mode: 'tr', w: '20%', h: '100%', x: '0', y: '0' }),
            TextLayout({ text: 'logout', align: 'mid', size: '120%' })
          ]
        });
        
        let logoutPress = dep(logoutReal.addPress());
        dep(logoutPress.src.route(() => logoutAct.act()));
        
        let usersScrollReal = dep(mainReal.addReal('t2.usersScroll', {
          layouts: [ FreeLayout({ mode: 'tl', x: '0', y: '80px', w: '100%', h: 'calc(100% - 80px)' }) ],
          innerLayout: ScrollLayout({ x: 'none', y: 'auto' })
        }));
        let usersReal = usersScrollReal.addReal('t2.users', {
          innerLayout: Axis1DLayout({ axis: 'y', dir: '+' })
        });
        dep.scp(test2, 't2.user', (user, dep) => {
          
          let userReal = dep(usersReal.addReal('t2.user', {
            layouts: [ TextLayout({ text: user.getVal('name') }) ],
            decals: { textColour: 'rgba(255, 255, 255, 0.4)' }
          }));
          
          dep.scp(user, 't2.presence', (presence, dep) => {
            dep(userReal.addDecals({ textColour: 'rgba(255, 255, 255, 1)' }));
          });
          
        });
        
      });
      
    }
    
  });
  
};
