global.rooms.promo = async foundation => {
  
  let { RecScope } = await foundation.getRoom('record');
  
  let spoof = (() => {
    
    let { Drop, Basin } = U.water;
    
    let HtmlApp = U.inspire({ name: 'HtmlApp', methods: (insp, Insp) => ({
      init: function({ name }) {
        this.name = name;
      },
      decorateApp: function(parHut) {
        
        /// {ABOVE=
        parHut.roadNozz('syncInit').route(async ({ road, srcHut, msg, reply }) => {
          
          // The AfarHut immediate has its state forgotten, requiring a
          // full sync to update. Then this full sync is consumed here,
          // to be included within the html response (the initial html
          // and sync data will arrive at precisely the same time!)
          srcHut.resetSyncState();
          let initSyncTell = srcHut.consumePendingSync();
          
          let baseParams = { [road.isSpoofed ? 'spoof' : 'hutId']: srcHut.uid };
          let urlFn = (customParams={}, params={ ...baseParams, ...customParams, reply: '1' }) => {
            return '?' + params.toArr((v, k) => `${k}=${v}`).join('&');
          };
          
          reply([
            '<!doctype html>',
            '<html>',
            '  <head>',
            `    <title>${this.name.upper()}</title>`,
            '    <meta name="viewport" content="width=device-width, initial-scale=1"/>',
            `    <link rel="shortcut icon" type="image/x-icon" href="${urlFn({ command: 'html.icon' })}" />`,
            `    <link rel="stylesheet" type="text/css" href="${urlFn({ command: 'html.css' })}" />`,
            '    <script type="text/javascript">window.global = window;</script>',
            '    <script type="text/javascript">global.roomDebug = {};</script>',
            `    <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'clearing' })}"></script>`,
            `    <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundation' })}"></script>`,
            `    <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundationBrowser' })}"></script>`,
            '    <script type="text/javascript">',
            `      U.hutId = '${srcHut.uid}';`,
            `      U.aboveMsAtResponseTime = ${foundation.getMs()};`,
            `      U.initData = ${JSON.stringify(initSyncTell)};`,
            `      let foundation = global.foundation = U.setup.FoundationBrowser(${JSON.stringify({ ...foundation.origArgs, settle: '${foundation.hut}.below' })});`,
            `      foundation.getRoom('${this.name}', 'below')`,
            '        .then(room => room.open(foundation))',
            '        .catch(err => {',
            `          console.log('FATAL ERROR:', foundation.formatError(err));`,
            '          debugger;',
            '        });',
            '    </script>',
            '  </head>',
            '  <body>',
            '  </body>',
            '</html>'
          ].join('\n'));
          
        });
        parHut.roadNozz('html.room').route(async ({ road, srcHut, msg, reply }) => {
          
          let pcs = (msg.type === 'room')
            ? [ 'room', msg.room, `${msg.room}.js` ]
            : [ 'setup', `${msg.room}.js` ];
          
          let srcContent = await foundation.getKeep('fileSystem', pcs).getContent('utf8');
          let { lines, offsets } = foundation.compileContent('below', srcContent);
          
          reply([
            ...lines,
            `global.roomDebug.${msg.room} = ${JSON.stringify({ offsets })};`
          ].join('\n'));
          
        });
        parHut.roadNozz('html.css').route(async ({ road, srcHut, msg, reply }) => {
          
          reply({
            '~contentData': true,
            type: 'css',
            content: U.multiLineString(`
              html, body {
                position: fixed; left: 0; right: 0; top: 0; bottom: 0;
                margin: 0; padding: 0;
                font-family: monospace;
              }
              body { overflow-x: hidden; overflow-y: auto; }
              .rec {
                position: relative;
                padding: 10px;
                margin-bottom: 10px;
                background-color: rgba(0, 0, 0, 0.25);
                color: #ffffff;
                font-size: 16px;
                transition: font-size 1s 1s, margin 1s 1s, padding 1s 1s;
                overflow: hidden;
              }
              .rec:hover { background-color: rgba(0, 120, 0, 0.25); }
              .rec.dry {
                opacity: 0.7;
                pointer-events: none;
                font-size: 0; margin-top: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0;
              }
              .rec > .title {}
              .rec > .value {}
              .rec > .children {}
            `)
          });
          
        });
        /// =ABOVE}
        
      }
    })});
    
    let HtmlNode = U.inspire({ name: 'HtmlNode', methods: (insp, Insp) => ({
      init: function({ slot, layout, decals }) {
        this.slot = slot;
        this.layout = layout;
        this.decals = decals;
        this.techNode = null;
      },
    })});
    
    let Layout = U.inspire({ name: 'Layout', methods: (insp, Insp) => ({
      init: function(params) {
        
      },
      apply: function(par, child) { return C.noFn.call(this, 'apply'); }
    })});
    
    let Permissions = U.inspire({ name: 'Permissions', insps: { Drop }, methods: (insp, Insp) => ({
      
      $mod: (parHut, rec, value) => {
        parHut.tell({ command: `perm.${parHut.uid}.mod`, recUid: rec.uid, value });
      },
      $add: (parHut, rec, relName) => {
        parHut.tell({ command: `perm.${parHut.uid}.mod`, recUid: rec.uid, relName });
      },
      
      init: function(parHut, kidHut) {
        this.parHut = parHut;
        this.kidHut = kidHut;
        this.recPerms = {};
        
        this.routes = [
          parHut.roadNozz(`perm.${kidHut.uid}.mod`).route(this.attemptMod.bind(this)),
          parHut.roadNozz(`perm.${kidHut.uid}.add`).route(this.attemptAdd.bind(this))
        ];
      },
      followRec: function(rec, ...perms) {
        
        if (!this.recPerms.has(rec.uid)) this.recPerms[rec.uid] = {};
        for (let perm of perms) {
          if (!this.recPerms[rec.uid].has(perm)) this.recPerms[rec.uid][perm] = 0;
          this.recPerms[rec.uid][perm]++
        }
        
        let followDrop = this.kidHut.followRec(rec);
        return Drop(null, () => {
          
          for (let perm of perms) {
            this.recPerms[rec.uid][perm]--;
            if (this.recPerms[rec.uid][perm] === 0) delete this.recPerms[rec.uid][perm];
          }
          if (this.recPerms[rec.uid].isEmpty()) delete this.recPerms[rec.uid];
          followDrop.dry();
          
        });
        
      },
      attemptMod: function({ road, srcHut, msg, reply }) {
        
        if (!U.isType(msg, Object)) throw Error(`Invalid message`);
        if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
        if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
        if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for rec with uid ${msg.recUid}`);
        if (!this.recPerms[msg.recUid].has('set')) throw Error(`No "set" permission for rec with uid ${msg.recUid}`);
        
        this.parHut.allRecs.get(msg.recUid).setVal(msg.value);
        
      },
      attemptAdd: function({ road, srcHut, msg, reply }) {
        
        console.log(`Attempted MOD from ${srcHut.uid}: ${msg.recUid} ++ ${msg.relName}`);
        console.log('PERMS:', this.recPerms[msg.recUid]);
        
      },
      onceDry: function() { for (let route of this.routes) this.route.dry(); }
      
    })});
    
    let Node = U.inspire({ name: 'Node', insps: { Drop }, methods: (insp, Insp) => ({
      
      init: function(parent, name) {
        
        insp.Drop.init.call(this);
        this.parent = parent;
        this.name = name;
        
        if (!parent) {
          this.domElem = document.body;
          this.domElem.classList.add('ready');
        } else {
          this.domElem = document.createElement('div');
          this.domElem.classList.add(this.name.replace(/[.]/g, '-'));
        }
        
        if (parent) parent.domElem.appendChild(this.domElem);
        
      },
      onceDry: function() {
        
        this.domElem.classList.add('dry');
        setTimeout(() => this.domElem.remove(), 2000);
        
      }
      
    })});
    
    let render = (rec, parentNode=Node(null, 'root', document.body), seen=Set()) => {
      
      if (seen.has(rec)) {
        let node = Node(parentNode, rec.type.name);
        node.domElem.innerHTML = `Circular: ${rec.type.name} (${rec.uid})`;
        return node;
      }
      seen.add(rec);
      
      let basin = Basin({ onceDry: () => seen.rem(rec) });
      let recNode = basin.add(Node(parentNode, rec.type.name));
      recNode.domElem.classList.add('rec');
      
      let titleNode = Node(recNode, 'title');
      titleNode.domElem.innerHTML = `${rec.type.name} (${rec.uid})`;
      
      let valueNode = Node(recNode, 'value');
      let childrenNode = Node(recNode, 'children');
      
      basin.add(rec.route(value => {
        valueNode.domElem.innerHTML = JSON.stringify(value);
      }));
      
      rec.mems.forEach(memRec => basin.add(render(memRec, childrenNode, seen)));
      
      basin.add(rec.relTermNozz.route(relTerm => {
        basin.add(RecScope(rec, relTerm, (childRec, dep) => {
          dep(render(childRec, childrenNode, seen));
        }));
      }));
      
      return basin;
      
    };
    
    return {
      HtmlApp,
      Permissions,
      layout: {},
      design: {},
      render
    };
    
  })();
  
  let { HtmlApp, Permissions } = spoof;
  let { Flow } = spoof.layout;
  let { Colour, ExtAbs, ExtRel } = spoof.design;
  
  return { open: async () => {
    
    let promoHut = await foundation.getRootHut({ heartMs: 1000 * 40 });
    promoHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
    
    let htmlApp = spoof.HtmlApp({ name: 'promo' });
    await htmlApp.decorateApp(promoHut);
    
    /// {ABOVE=
    let promoRec = promoHut.createRec('pmo.promo', [ promoHut ]);
    let example = promoHut.createRec('pmo.example', [], 'EXAMPLE');
    promoHut.createRec('pmo.promoExample', [ promoRec, example ]);
    
    setInterval(() => {
      
      let anotherExample = promoHut.createRec('pmo.example', [], foundation.getMs());
      promoHut.createRec('pmo.promoExample', [ promoRec, anotherExample ]);
      setTimeout(() => { anotherExample.dry(); }, 30000);
      
    }, 20000);
    
    /// =ABOVE}
    
    let rootScope = RecScope(promoHut, 'pmo.promo', async (promoRec, dep) => {
      
      /// {ABOVE=
      dep.scp(promoHut, 'lands.kidHut/par', (kidParHut, dep) => {
        
        let kidHut = kidParHut.mems.kid;
        let perms = dep(Permissions(promoHut, kidHut));
        
        dep(perms.followRec(promoRec, 'get', 'set'));
        dep.scp(promoRec, 'pmo.promoExample', (promoExample, dep) => dep(perms.followRec(promoExample, 'get', 'set')));
        
      });
      /// =ABOVE}
      
      /// {BELOW=
      dep(spoof.render(promoRec));
      
      setTimeout(() => {
        console.log('TELL:', promoHut.uid);
        Permissions.mod(promoHut, promoRec, 'hello');
        //;
      }, 2000);
      
      /// =BELOW}
      
      // dep(htmlApp.rootNode.addNode({
      //   slot: 'main',
      //   layout: spoof.layout.Flow({ axis: 'y', dir: '+' }),
      //   decals: {
      //     colour: html.design.Colour(1, 1, 1),
      //     textColour: html.design.Colour(0, 0, 0)
      //   }
      // }));
      
    });
    
  }};
  
};
