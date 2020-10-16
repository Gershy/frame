global.rooms.promo = async foundation => {
  
  let { Tmp, Slots } = U.logic;
  
  let { Scope } = U.logic;
  let { RecScope } = await foundation.getRoom('record');
  let { Real, Axis1DLayout, FreeLayout, SizedLayout, TextLayout, ImageLayout } = U.setup;
  
  let { HtmlApp } = await (() => { // foundation.getRoom('htmlApp');
    
    let HtmlApp = U.inspire({ name: 'HtmlApp', methods: (insp, Insp) => ({
      init: function({ name }) {
        this.name = name;
      },
      decorateApp: function(parHut) {
        
        /// {ABOVE=
        parHut.roadSrc('syncInit').route(async ({ road, srcHut, msg, reply }) => {
          
          // The AfarHut immediately has its state reset, requiring a
          // full sync to update. Then this full sync is consumed here,
          // to be included within the html response (the initial html
          // and sync data will arrive at precisely the same time!)
          srcHut.resetSyncState();
          let initSyncTell = srcHut.consumePendingSync();
          
          let urlFn = (p={}, params={ hutId: srcHut.uid, ...p, reply: '1' }) => {
            return '?' + params.toArr((v, k) => `${k}=${v}`).join('&');
          };
          
          reply(U.multiLineString(`
            <!doctype html>
            <html>
              <head>
                <title>${this.name.upper()}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="shortcut icon" type="image/x-icon" href="${urlFn({ command: 'html.icon' })}" />
                <link rel="stylesheet" type="text/css" href="${urlFn({ command: 'html.css' })}" />
                <!--
                <link rel="stylesheet" type="text/css" href="${urlFn({ command: 'html.renderCss' })}" />
                -->
                <style type="text/css">
                  body { position: relative; opacity: 0; transition: opacity 750ms linear; }
                  body.loaded { opacity: 1; }
                </style>
                <script type="text/javascript">window.global = window;</script>
                <script type="text/javascript">global.roomDebug = {};</script>
                <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'clearing' })}"></script>
                <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundation' })}"></script>
                <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundationBrowser' })}"></script>
                <script type="text/javascript">
                  window.addEventListener('load', () => document.body.classList.add('loaded'));
                  window.addEventListener('beforeunload', () => document.body.classList.remove('loaded'));
                  global.domAvailable = Promise(r => window.addEventListener('DOMContentLoaded', r));
                  let foundation = global.foundation = U.setup.FoundationBrowser({
                    ...${JSON.stringify(foundation.origArgs)},
                    bearing: 'below',
                    hutId: '${srcHut.uid}',
                    isSpoofed: ${srcHut.isSpoofed},
                    aboveMsAtResponseTime: ${foundation.getMs()},
                    initData: ${JSON.stringify(initSyncTell)}
                  });
                  foundation.getRoom('${this.name}', 'below')
                    .then(room => room.open(foundation))
                    .catch(err => {
                      console.log('FATAL ERROR:', foundation.formatError(err));
                      foundation.halt();
                    });
                </script>
              </head>
              <body>
              </body>
            </html>
          `));
          
        });
        parHut.roadSrc('html.room').route(async ({ road, srcHut, msg, reply }) => {
          
          let pcs = (msg.type === 'room')
            ? [ 'room', msg.room, `${msg.room}.js` ]
            : [ 'setup', `${msg.room}.js` ];
          
          let srcContent = await foundation.seek('keep', 'fileSystem', pcs).getContent('utf8');
          if (srcContent === null) return reply(`throw Error('Invalid room request: ${JSON.stringify(msg)}')`);
          let { lines, offsets } = foundation.compileContent('below', srcContent);
          
          reply([
            ...lines,
            `global.roomDebug.${msg.room} = ${JSON.stringify({ offsets })};`
          ].join('\n'));
          
        });
        parHut.roadSrc('html.icon').route(async ({ road, srcHut, msg, reply }) => {
          
          reply(foundation.seek('keep', 'fileSystem', 'setup', 'favicon.ico'));
          
        });
        parHut.roadSrc('html.css').route(async ({ road, srcHut, msg, reply }) => {
          
          reply(U.multiLineString(`
            html, body {
              position: absolute; left: 0; top: 0; width: 100%; height: 100%;
              margin: 0; padding: 0;
              font-family: monospace;
              overflow: hidden;
            }
          `));
          
        });
        parHut.roadSrc('html.renderCss').route(async ({ road, srcHut, msg, reply }) => {
          
          reply(U.multiLineString(`
            body > .rec { color: #000000; }
            .drying { pointer-events: none !important; opacity: 0.7; }
            .drying > * { pointer-events: none !important; }
            .rec {
              position: relative;
              padding: 10px;
              margin-bottom: 4px;
              box-sizing: border-box;
              background-color: rgba(0, 0, 0, 0.15);
              color: #ffffff;
              font-size: 16px;
              overflow: hidden;
              transition: height 250ms linear, margin-bottom 250ms linear, padding-bottom 250ms linear, padding-top 250ms linear;
            }
            .rec.dry { height: 0 !important; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
            .rec:hover { background-color: rgba(0, 120, 0, 0.15); }
            .rec > .title { font-size: 120%; }
            .rec > .value { position: relative; margin: 4px 0; }
            .rec.set > .value { box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15); }
            .rec.set:hover > .value { box-shadow: inset 0 0 0 2px rgba(0, 120, 0, 0.15); }
            .rec > .value > .display { height: 16px; line-height: 16px; padding: 5px; }
            .rec > .options {}
            .rec > .children {}
            .rec.rem > .rem {
              position: absolute;
              right: 0; top: 0; width: 20px; height: 20px;
              background-color: rgba(150, 0, 0, 0.5);
              cursor: pointer;
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
            .rec > .control {
              display: block;
              height: 26px;
              margin-bottom: 4px;
            }
            .rec > .control:empty { display: none; }
            .rec > .control > .add {
              display: inline-block;
              height: 16px; line-height: 16px; padding: 5px;
              font-size: 80%;
              margin-right: 4px;
              background-color: rgba(0, 0, 0, 0.1);
              cursor: pointer;
            }
            .rec > .control > .add:hover { background-color: rgba(0, 0, 0, 0.3); }
          `));
          
        });
        /// =ABOVE}
        
      }
    })});
    return { HtmlApp };
    
  })();
  
  let { Permissions } = await (() => { // foundation.getRoom('hinterlands.permissions');
    
    let Permissions = U.inspire({ name: 'Permissions', insps: { Tmp }, methods: (insp, Insp) => ({
      
      $mod: (parHut, rec, value) => {
        if (value === rec.val) return;
        parHut.tell({ command: `perm.${parHut.uid}.mod`, recUid: rec.uid, value });
      },
      $add: (parHut, rec, relName) => {
        parHut.tell({ command: `perm.${parHut.uid}.add`, recUid: rec.uid, relName });
      },
      $rem: (parHut, rec) => {
        parHut.tell({ command: `perm.${parHut.uid}.rem`, recUid: rec.uid });
      },
      
      init: function(parHut, kidHut) {
        this.parHut = parHut;
        this.kidHut = kidHut;
        this.recPerms = {};
        
        this.routes = [
          parHut.roadSrc(`perm.${kidHut.uid}.mod`).route(this.attemptMod.bind(this)),
          parHut.roadSrc(`perm.${kidHut.uid}.add`).route(this.attemptAdd.bind(this)),
          parHut.roadSrc(`perm.${kidHut.uid}.rem`).route(this.attemptRem.bind(this))
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
    
    return { Permissions };
    
  })();
  
  let { render } = await (() => { // foundation.getRoom('htmlApp.render');
    
    let Node = U.inspire({ name: 'Node', insps: { Tmp }, methods: (insp, Insp) => ({
      
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
      cleanup: async function() {
        
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
      let controlNode = Node(recNode, 'control');
      let childrenNode = Node(recNode, 'children');
      
      // Update DOM when Rec value changes
      basin.add(rec.valSrc.route(value => displayNode.domElem.innerHTML = U.isType(value, String) ? value : JSON.stringify(value)));
      
      // Recursively render all children for all terms within
      if (!circ) basin.add(rec.relTermSrc.route(relTerm => {
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
            if (permDrops.has(k)) continue;
            
            permDrops[k] = ({
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
                let addNode = Node(controlNode, 'add');
                addNode.domElem.classList.add(relName.replace(/[.]/g, '-'));
                addNode.domElem.addEventListener('click', () => Permissions.add(parHut, rec, relName));
                addNode.domElem.innerHTML = `+${relName}`;
                
                return Drop(null, () => addNode.dry());
              },
              rem: () => {
                recNode.domElem.classList.add('rem');
                let remNode = Node(recNode, 'rem');
                remNode.domElem.addEventListener('click', () => Permissions.rem(parHut, rec));
                
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
    
    return { render };
    
  })();
  
  return { open: async () => {
    
    let promoHut = await foundation.getRootHut({ heartMs: 1000 * 40 });
    promoHut.roadDbgEnabled = false; // TODO: This doesn't affect the Below!
    foundation.seek('keep', 'static').setHut(promoHut);
    
    let htmlApp = HtmlApp({ name: 'promo' });
    await htmlApp.decorateApp(promoHut);
    
    /// {ABOVE=
    let promoRec = promoHut.createRec('pmo.promo', [ promoHut ]);
    /// =ABOVE}
    
    let rootScope = RecScope(promoHut, 'pmo.promo', async (promoRec, dep) => {
      
      /// {ABOVE=
      
      dep.scp(promoHut, 'lands.kidHut/par', (kidParHut, dep) => {
        
        let kidHut = kidParHut.mems.kid;
        
        // let perms = dep(Permissions(promoHut, kidHut));
        // dep(perms.followRec(promoRec, 'get', 'add:pmo.example'));
        let fol = (rec, ...args) => kidHut.followRec(rec, ...args); // perms.followRec(rec, ...args);
        
        
        dep(fol(promoRec, 'get', 'add:pmo.example'));
        dep.scp(promoRec, 'pmo.example', (example, dep) => {
          
          dep(fol(example, 'get', 'set', 'rem', 'add:pmo.sub'))
          dep.scp(example, 'pmo.sub', (sub, dep) => {
            dep(fol(sub, 'get', 'set', 'rem'));
          });
          
        });
        
      });
      
      /// =ABOVE}
      
      let rootReal = await foundation.seek('real', 'primary');
      
      // Axis1DLayout - "cuts" can be:
      // Arr for ad-hoc sections (with "fill remaining" as last section)
      // Int for n evenly divided sections (TODO: necessary? Just divide evenly for number of children added)
      // Omitted for arbitrary flow of sections (no param required for child layouts)
      
      let promoReal = dep(rootReal.addReal('pmo.promo', ctx => ({
        layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: [ '80px' ] })
      })));
      let headerReal = promoReal.addReal('pmo.header', ctx => ({
        layouts: ctx.layouts(0),
        innerLayout: Axis1DLayout({ axis: 'x', flow: '+', cuts: 'distribute' }),
        decals: {
          border: { width: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      }));
      let tabs = {
        hut:      headerReal.addReal('pmo.header.hut',      ctx => ({ layouts: [ ...ctx.layouts(0), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'HUT', size: 'calc(12px + 2vw)' })        })),
        phil:     headerReal.addReal('pmo.header.phil',     ctx => ({ layouts: [ ...ctx.layouts(1), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Philosophy', size: 'calc(10px + 1vw)' }) })),
        example:  headerReal.addReal('pmo.header.example',  ctx => ({ layouts: [ ...ctx.layouts(2), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Example', size: 'calc(10px + 1vw)' })    })),
        rooms:    headerReal.addReal('pmo.header.rooms',    ctx => ({ layouts: [ ...ctx.layouts(3), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Rooms', size: 'calc(10px + 1vw)' })      }))
      };
      
      let scrollReal = promoReal.addReal('pmo.scroll', ctx => ({
        layouts: ctx.layouts(1),
        decals: { scroll: { x: 'none', y: 'auto' } }
      }));
      let contentReal = scrollReal.addReal('pmo.content', ctx => ({
        layouts: [ SizedLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
      }));
      
      let pages = {
        hut: (() => {
          
          let real = contentReal.addReal('pmo.content.hut', ctx => ({
            layouts: [ ...ctx.layouts(0), SizedLayout({ w: '100%', h: '100%' }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+', cuts: 'focus' }),
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          let hutSectionImageReal = real.addReal('pmo.content.hut.image', ctx => ({
            layouts: [
              ...ctx.layouts(0),
              SizedLayout({ h: '60vmin', ratio: 8 / 5 }),
              ImageLayout({ image: foundation.seek('keep', 'static', [ 'room', 'promo', 'asset', 'hutIcon.svg' ]) })
            ]
          }));
          let hutSectionTextReal = real.addReal('pmo.content.hut.text', ctx => ({
            layouts: [
              ...ctx.layouts(1),
              SizedLayout({ h: 'calc(20px + 4vw)' }),
              TextLayout({ text: 'Reimagine Distributed Software', size: 'calc(10px + 2vw)' })
            ]
          }));
          return real;
          
        })(),
        phil: (() => {
          
          let real = contentReal.addReal('pmo.content.philosophy', ctx => ({
            layouts: [ ...ctx.layouts(1), SizedLayout({ w: '100%', h: '100%' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          return real;
          
        })(),
        example: (() => {
          
          let real = contentReal.addReal('pmo.content.example', ctx => ({
            layouts: [ ...ctx.layouts(1), SizedLayout({ w: '100%', h: '100%' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          return real;
          
        })(),
        rooms: (() => {
          
          let real = contentReal.addReal('pmo.content.rooms', ctx => ({
            layouts: [ ...ctx.layouts(1), SizedLayout({ w: '100%', h: '100%' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          return real;
          
        })()
      };
      
      for (let [ name, tab ] of tabs) {
        
        let page = pages[name];
        
        let feelSrc = dep(tab.feelSrc());
        let pressSrc = dep(tab.pressSrc());
        dep(Scope(feelSrc.src, (hover, dep) => dep(tab.addDecals({ colour: 'rgba(0, 0, 0, 0.2)' }))));
        dep(pressSrc.src.route(press => scrollReal.scrollTo(page)));
        
      }
      
    });
    
  }};
  
};
