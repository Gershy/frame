global.rooms.write = async foundation => {
  
  let { Tmp, Slots, Src, MemSrc, Chooser } = U.logic;
  
  let { FreeLayout, SizedLayout, Axis1DLayout, TextLayout, TextInputLayout } = U.setup;
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  
  let { makeHutAppScope } = await foundation.getRoom('hinterlands.hutApp')
  
  return { open: async hut => {
    
    await HtmlApp({ name: 'write' }).decorateApp(hut);
    
    /// {ABOVE=
    hut.relSrc('wrt.write').route(writeRec => {
      hut.createRec('wrt.user', [ writeRec ], { username: 'admin1', password: 'sm4rtadmin?' });
      hut.createRec('wrt.user', [ writeRec ], { username: 'admin2', password: 'sm4rtadmin?' });
      hut.createRec('wrt.user', [ writeRec ], { username: 'admin3', password: 'sm4rtadmin?' });
    });
    /// =ABOVE}
    
    makeHutAppScope(hut, 'wrt', 'write', (writeRec, writeHut, rootReal, dep) => {
      
      // TODO: Can ABOVE look at the code for BELOW, and use that to
      // automatically determine which Recs to follow??
      
      let mainReal = dep(rootReal.addReal('wrt.main', ctx => ({
        layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+' }),
        decals: {
          border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      })));
      
      let loginChooser = dep(Chooser([ 'out', 'inn' ]));
      dep.scp(writeHut, 'wrt.identity', (identity, dep) => {
        loginChooser.choose('inn', identity);
        dep(Tmp(() => loginChooser.choose('out')));
      });
      
      dep.scp(loginChooser.srcs.out, (loggedOut, dep) => {
        
        console.log(`${writeHut.uid} logged out`);
        
        let loginSender = dep(writeHut.getTellSender('wrt.login', ({ username, password }) => {
          
          let user = writeRec.relRecs('wrt.user').find(rec => rec.getVal().username === username).val;
          if (user) {
            if (user.getVal().password !== password) throw Error(`invalid password`);
            console.log('Signed in as existing user');
          } else {
            if (password.count() < 5) throw Error('Password too short');
            user = hut.createRec('wrt.user', [ writeRec ], { username, password });
            console.log('Created new user');
          }
          
          let iden = hut.createRec('wrt.identity', [ writeHut, user ], { login: foundation.getMs() });
          writeHut.followRec(iden);
          
        }));
        
        let loginReal = dep(rootReal.addReal('wrt.login', ctx => ({
          layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
          decals: {
            colour: 'rgba(0, 0, 255, 0.05)'
          }
        })));
        
        let usernameReal = loginReal.addReal('wrt.login.user', ctx => ({
          layouts: [ TextInputLayout({ align: 'mid', size: '30px', prompt: 'Username' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 0, 0.5)' }
          }
        }));
        let passwordReal = loginReal.addReal('wrt.login.pass', ctx => ({
          layouts: [ TextInputLayout({ align: 'mid', size: '10px', prompt: 'Password' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: {
            colour: 'rgba(255, 255, 255, 1)',
            border: { ext: '3px', colour: 'rgba(0, 0, 255, 0.5)' }
          }
        }));
        let submitReal = loginReal.addReal('wrt.login.submit', ctx => ({
          layouts: [ TextLayout({ text: 'enter', size: '30px' }), SizedLayout({ w: '200px', h: '50px' }) ],
          decals: { colour: 'rgba(0, 0, 255, 0.2)' }
        }));
        loginReal.addReal('wrt.login.help', ctx => ({
          layouts: [
            TextLayout({ text: 'Account will be created if none is found', size: '90%', align: 'mid' }),
            SizedLayout({ w: '200px', h: '45px' })
          ],
          decals: { textColour: 'rgba(0, 0, 0, 0.7)' }
        }));
        
        let usernameInpSrc = dep(usernameReal.addInput()).src;
        let passwordInpSrc = dep(passwordReal.addInput()).src;
        
        [
          dep(passwordReal.addPress('discrete')).src,
          dep(usernameReal.addPress('discrete')).src,
          dep(submitReal.addPress()).src
        ].each(submitSrc => dep(submitSrc.route(() => loginSender.src.send({
          username: usernameInpSrc.val,
          password: passwordInpSrc.val
        }))));
        
      });
      
      dep.scp(loginChooser.srcs.inn, (identity, dep) => {
        
        console.log(`${writeHut.uid} logged IN!`);
        
        let logoutSender = dep(writeHut.getTellSender('wrt.logout', () => identity.end()));
        
        let loginReal = dep(rootReal.addReal('wrt.login', ctx => ({
          layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
          innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
          decals: {
            colour: 'rgba(0, 0, 255, 0.2)'
          }
        })));
        
      });
      
    });
    
  }};
  
};
