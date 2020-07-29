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
                position: absolute; left: 0; right: 0; top: 0; bottom: 0;
                margin: 0; padding: 0;
                font-family: monospace;
              }
              body { overflow-x: hidden; overflow-y: auto; }
              .drying { opacity: 0.7; }
              .rec {
                position: relative;
                padding: 10px;
                margin-bottom: 10px;
                box-sizing: border-box;
                background-color: rgba(0, 0, 0, 0.15);
                color: #ffffff;
                font-size: 16px;
                overflow: hidden;
                transition: height 1000ms linear, margin-bottom 1000ms linear, padding-bottom 1000ms linear, padding-top 1000ms linear;
              }
              .rec.dry { height: 0 !important; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
              .rec:hover { background-color: rgba(0, 120, 0, 0.15); }
              .rec > .title {}
              .rec > .value {
                position: relative;
                margin: 4px 0;
                box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
              }
              .rec > .value > .display { height: 16px; line-height: 16px; padding: 5px; }
              .rec > .options {}
              .rec:hover > .value { box-shadow: inset 0 0 0 2px rgba(0, 120, 0, 0.15); }
              .rec > .children {}
              .rec.rem > .rem {
                position: absolute;
                right: 0; top: 0; width: 10px; height: 10px;
                background-color: red;
              }
              .rec.set > .value { cursor: pointer; }
              .rec.set > .value > .editor {
                position: absolute;
                box-sizing: border-box;
                left: 0; top: 0; width: 100%; height: 100%;
                padding-right: 26px;
              }
              .rec.set > .value > .editor.drying { display: none; }
              .rec.set > .value > .editor > .edit {
                position: relative;
                box-sizing: border-box;
                left: 0; top: 0; width: 100%; height: 100%;
                background-color: #fff;
                border: none; outline: none !important; padding: 5px;
                font-family: inherit; font-size: inherit;
              }
              .rec.set > .value > .editor > .submit {
                position: absolute;
                width: 26px; height: 100%; right: 0; top: 0;
                background-color: #0f0;
              }
              
              body > .rec { color: #000000; }
            `)
          });
          
        });
        /// =ABOVE}
        
      }
    })});
    
    let Permissions = U.inspire({ name: 'Permissions', insps: { Drop }, methods: (insp, Insp) => ({
      
      $mod: (parHut, rec, value) => {
        if (value === rec.val) return;
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
          parHut.roadNozz(`perm.${kidHut.uid}.add`).route(this.attemptAdd.bind(this)),
          parHut.roadNozz(`perm.${kidHut.uid}.rem`).route(this.attemptRem.bind(this))
        ];
      },
      followRec: function(rec, ...perms) {
        
        if (rec.type.name === 'perm.perm') throw Error(`Can't assign permissions on Rec of type "perm.perm"`);
        
        let permRec = rec.relRecs('perm.perm/rec?').find(perm => perm.mems.hut.uid === this.kidHut.uid).val;
        if (!permRec) permRec = this.parHut.createRec('perm.perm', { 'rec?': rec, hut: this.kidHut }, {});
        
        if (!this.recPerms.has(rec.uid)) this.recPerms[rec.uid] = {};
        for (let perm of perms) {
          if (!this.recPerms[rec.uid].has(perm)) this.recPerms[rec.uid][perm] = 0;
          this.recPerms[rec.uid][perm]++
        }
        
        permRec.setVal(this.recPerms[rec.uid].map(v => !!v).gain({ get: C.skip }));
        
        let followDrop = this.kidHut.followRec(rec);
        let followPermDrop = this.kidHut.followRec(permRec);
        
        return Drop(null, () => {
          
          for (let perm of perms) {
            this.recPerms[rec.uid][perm]--;
            if (this.recPerms[rec.uid][perm] === 0) delete this.recPerms[rec.uid][perm];
          }
          if (this.recPerms[rec.uid].isEmpty()) {
            delete this.recPerms[rec.uid];
            permRec.dry();
          }
          followDrop.dry();
          
        });
        
      },
      attemptMod: function({ road, srcHut, msg, reply }) {
        
        if (!U.isType(msg, Object)) throw Error(`Invalid message`);
        if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
        if (!msg.has('value')) throw Error(`Missing "value" param`);
        if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
        if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
        if (!this.recPerms[msg.recUid].has('set')) throw Error(`No "set" permission for rec with uid ${msg.recUid}`);
        
        this.parHut.allRecs.get(msg.recUid).setVal(msg.value);
        
      },
      attemptAdd: function({ road, srcHut, msg, reply }) {
        
        if (!U.isType(msg, Object)) throw Error(`Invalid message`);
        if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
        if (!msg.has('relName')) throw Error(`Missing "relName" param`);
        if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
        if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
        if (!this.recPerms[msg.recUid].has(`add:${msg.relName}`)) throw Error(`No "add:${msg.relName}" permission for rec with uid ${msg.recUid}`);
        
        let rec = this.parHut.allRecs.get(msg.recUid);
        let newRec = this.parHut.createRec(msg.relName, { [rec.type.name]: rec, 'author': srcHut });
        
      },
      attemptRem: function({ road, srcHut, msg, reply }) {
        
        if (!U.isType(msg, Object)) throw Error(`Invalid message`);
        if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
        if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
        if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
        if (!this.recPerms[msg.recUid].has(`rem`)) throw Error(`No "rem" permission for rec with uid ${msg.recUid}`);
        
        this.parHut.allRecs.get(msg.recUid).dry();
        
      },
      onceDry: function() { for (let route of this.routes) route.dry(); }
      
    })});
    
    let Node = U.inspire({ name: 'Node', insps: { Drop }, methods: (insp, Insp) => ({
      
      init: function(parent, name, elem=null) {
        
        insp.Drop.init.call(this);
        this.parent = parent;
        this.name = name;
        this.dryMs = 2000;
        
        if (!parent) {
          this.domElem = elem || document.body;
          this.domElem.classList.add('ready');
        } else {
          this.domElem = elem || document.createElement('div');
          this.domElem.classList.add(this.name.replace(/[.]/g, '-'));
        }
        
        if (parent) parent.domElem.appendChild(this.domElem);
        
      },
      onceDry: async function() {
        
        this.domElem.classList.add('drying');
        this.domElem.style.height = `${this.domElem.getBoundingClientRect().height}px`;
        
        await Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        
        this.domElem.classList.add('dry');
        setTimeout(() => this.domElem.remove(), this.dryMs);
        
      }
      
    })});
    
    let render = (parHut, rec, parentNode=Node(null, 'root', document.body), seen=Set()) => {
      
      let basin = Basin();
      
      if (rec.type.name === 'perm.perm') {
        basin.dry();
        return basin;
      }
      
      let circ = seen.has(rec);
      
      seen.add(rec);
      basin.add(Drop(null, () => seen.rem(rec)));
      
      let recNode = basin.add(Node(parentNode, rec.type.name));
      recNode.domElem.classList.add('rec');
      
      let titleNode = Node(recNode, 'title');
      titleNode.domElem.innerHTML = `${rec.type.name} (${rec.uid})`;
      
      let valueNode = Node(recNode, 'value');
      let displayNode = Node(valueNode, 'display');
      let childrenNode = Node(recNode, 'children');
      
      // Update DOM when Rec value changes
      basin.add(rec.route(value => displayNode.domElem.innerHTML = U.isType(value, String) ? value : JSON.stringify(value)));
      
      // Recursively render all children for all terms within
      if (!circ) basin.add(rec.relTermNozz.route(relTerm => {
        basin.add(RecScope(rec, relTerm, (childRec, dep) => dep(render(parHut, childRec, childrenNode, seen))));
      }));
      
      // Make DOM changes when permissions change
      let permDrops = {};
      
      basin.add(RecScope(rec, 'perm.perm/rec?', (perm, dep) => {
        
        console.log(`${rec.type.name} has perms: ${JSON.stringify(perm.val)}`);
        
        dep(perm.route(perms => {
          
          let removedPerms = { ...permDrops };
          for (let k in perms) {
            
            // Some perms look like "add:room.type"
            let [ perm, ...params ] = k.split(':');
            
            // This perm isn't being removed
            delete removedPerms[perm];
            
            // If the perm has been seen, skip it
            if (permDrops.has(perm)) continue;
            
            permDrops[perm] = ({
              
              set: () => {
                
                recNode.domElem.classList.add('set');
                let editorNode = null;
                let clickToEditFn = () => {
                  
                  if (editorNode) return;
                  editorNode = Node(valueNode, 'editor');
                  let editNode = Node(editorNode, 'edit', document.createElement('input'));
                  let submitNode = Node(editorNode, 'submit');
                  editNode.domElem.value = rec.val;
                  editNode.domElem.focus();
                  
                  let doneEditFn = evt => {
                    if (!editorNode) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    Permissions.mod(parHut, rec, editNode.domElem.value);
                    editorNode.dry();
                    editorNode = null;
                  };
                  editNode.domElem.addEventListener('input', () => {
                    Permissions.mod(parHut, rec, editNode.domElem.value);
                  });
                  
                  editNode.domElem.addEventListener('keydown', evt => evt.ctrlKey && evt.keyCode === 13 && doneEditFn(evt));
                  submitNode.domElem.addEventListener('click', doneEditFn);
                  
                };
                valueNode.domElem.addEventListener('click', clickToEditFn);
                return Drop(null, () => {
                  recNode.classList.remove('set');
                  valueNode.domElem.removeEventListener('click', clickToEditFn);
                  if (editorNode) editorNode.dry();
                });
                
              },
              add: relName => {
                
              },
              rem: () => {
                recNode.domElem.classList.add('rem');
                let remNode = Node(recNode, 'rem');
                return Drop(null, () => {
                  recNode.domElem.classList.remove('rem');
                  remNode.dry();
                });
              }
              
            })[perm](...params);
            
          }
          
          removedPerms.each(drop => drop.dry());
          
        }));
        
      }));
      
      if (circ) childrenNode.innerHTML = 'Omitting children for circular Rec';
      
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
      setTimeout(() => { anotherExample.dry(); }, 1500);
      
    }, 4000);
    
    /// =ABOVE}
    
    let rootScope = RecScope(promoHut, 'pmo.promo', async (promoRec, dep) => {
      
      /// {ABOVE=
      dep.scp(promoHut, 'lands.kidHut/par', (kidParHut, dep) => {
        
        let kidHut = kidParHut.mems.kid;
        let perms = dep(Permissions(promoHut, kidHut));
        
        dep(perms.followRec(promoRec, 'get'));
        dep(perms.followRec(promoRec, 'get'));
        dep.scp(promoRec, 'pmo.promoExample', (promoExample, dep) => dep(perms.followRec(promoExample, 'get', 'set')));
        
      });
      /// =ABOVE}
      
      /// {BELOW=
      dep(spoof.render(promoHut, promoRec));
      
      // setTimeout(() => {
      //   console.log('TELL:', promoHut.uid);
      //   Permissions.mod(promoHut, promoRec, 'hello');
      // }, 2000);
      
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
