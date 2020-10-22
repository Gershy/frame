global.rooms.write = async foundation => {
  
  let { Tmp, Slots, Src, MemSrc, Chooser } = U.logic;
  
  let { RecScope } = await foundation.getRoom('record');
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  let layouts = U.setup;
  
  return { open: async hut => {
    
    let htmlApp = HtmlApp({ name: 'write' });
    await htmlApp.decorateApp(hut);
    
    /// {ABOVE=
    let writeRec = hut.createRec('wrt.write', [ hut ]);
    /// =ABOVE}
    
    let rootScope = RecScope(hut, 'wrt.write', async (writeRec, dep) => {
      
      /// {ABOVE=
      dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => scopedWriteHut(writeRec, kidParHut.mems.kid, dep));
      /// =ABOVE} {BELOW=
      scopedWriteHut(writeRec, hut, dep);
      /// =BELOW}
      
    });
    
    let scopedWriteHut = async (writeRec, writeHut, dep) => {
      
      // TODO: This process is pure bootstrapping:
      // - ABOVE creates root Rec for app
      // - ABOVE allows all kid huts to follow root Rec
      // - BELOW receives root rec before continuing
      
      // TODO: Can ABOVE look at the code for BELOW, and use that to
      // automatically determine which Recs to follow??
      
      let rootReal = await foundation.seek('real', 'primary');
      let mainReal = dep(rootReal.addReal('wrt.main', ctx => ({
        layouts: [ layouts.FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: layouts.Axis1DLayout({ axis: 'y', flow: '+' }),
        decals: {
          border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      })));
      
      /// {ABOVE=
      
      dep(writeHut.followRec(writeRec));
      
      // setTimeout(() => {
      //   let iden = dep(hut.createRec('wrt.identity', [ kidHut ]));
      //   kidHut.followRec(iden);
      // }, 3000);
      
      /// =ABOVE}
      
      let loginChooser = dep(Chooser([ 'out', 'inn' ]));
      dep.scp(writeHut, 'wrt.identity', (iden, dep) => { chooser.choose('inn'); dep(Tmp(() => chooser.choose('out'))); });
      
      dep.scp(loginChooser.srcs.out, (loggedOut, dep) => {
        
        console.log(`${writeHut.uid} logged out`);
        
        let logoutReal = dep(rootReal.addReal('wrt.login', ctx => ({
          layouts: [ layouts.FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: layouts.Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
          decals: {
            colour: 'rgba(0, 0, 255, 0.05)'
          }
        })));
        
        let username = '';
        let usernameReal = logoutReal.addReal('wrt.login.user', ctx => ({
          layouts: [ layouts.TextInputLayout({ align: 'mid', size: '30px' }), layouts.SizedLayout({ w: '200px', h: '50px' }) ],
          decals: { border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' } }
        }));
        let usernameInpSrc = dep(usernameReal.addInput()).src;
        dep(usernameInpSrc.route(val => username = val));
        
        let password = '';
        let passwordReal = logoutReal.addReal('wrt.login.pass', ctx => ({
          layouts: [ layouts.TextInputLayout({ align: 'mid', size: '10px' }), layouts.SizedLayout({ w: '200px', h: '50px' }) ],
          decals: { border: { ext: '3px', colour: 'rgba(0, 0, 255, 0.5)' } }
        }));
        let passwordInpSrc = dep(passwordReal.addInput()).src;
        dep(passwordInpSrc.route(val => password = val));
        
        let submitReal = logoutReal.addReal('wrt.login.submit', ctx => ({
          layouts: [ layouts.TextLayout({ text: 'enter', size: '30px' }), layouts.SizedLayout({ w: '200px', h: '50px' }) ],
          decals: { colour: 'rgba(0, 0, 255, 0.2)' }
        }));
        let submitSrc = dep(submitReal.addPress()).src;
        dep(submitSrc.route(() => writeHut.tell({ command: 'login', username, password })));
        
      });
      
      dep.scp(loginChooser.srcs.inn, (loggedInn, dep) => {
        console.log(`${writeHut.uid} logged IN!`);
        
        let loginReal = dep(rootReal.addReal('wrt.login', ctx => ({
          layouts: [ layouts.FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: layouts.Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
          decals: {
            colour: 'rgba(0, 0, 255, 0.2)'
          }
        })));
        
      });
      
    };
    
  }};
  
};
