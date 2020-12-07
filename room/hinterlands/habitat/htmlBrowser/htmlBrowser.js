global.rooms['hinterlands.habitat.htmlBrowser'] = async foundation => {
  
  let { Tmp } = U.logic;
  
  return U.form({ name: 'HtmlBrowserHabitat', has: { Tmp }, props: (forms, Form) => ({
    
    // TODO: All road names should be overridable - in fact if there are
    // multiple HtmlBrowserHabitat instances, no two should share a road
    // name. This would be easier by simply providing a unique prefix
    // for all road names, but "syncInit" won't work if prefixed. Could
    // be the best solution requires changing how "syncInit" functions
    // in hinterlands
    
    init: function({ rootRoadSrcName='syncInit' /*, prefix='html' */ }={}) {
      forms.Tmp.init.call(this);
      this.rootRoadSrcName = rootRoadSrcName;
    },
    prepare: async function(name, hut) {
      
      let tmp = Tmp();
      
      /// {ABOVE=
      let urlFn = (srcHut, p={}, { reply='1' }=p) => {
        return '?' + ({ hutId: srcHut.uid, ...p, reply }).toArr((v, k) => `${k}=${v}`).join('&');
      };
      tmp.endWith(hut.roadSrc(this.rootRoadSrcName).route(async ({ srcHut, msg, reply }) => {
        
        // TODO: If supporting outdated browsers, useragent agent
        // detection at this point has an opportunity to send html which
        // initiates not FoundationBrowser, but rather
        // FoundationBrowserIE9 (which would need to come complete with
        // a completely overhauleded clearing.js using only IE9 syntax)
        
        // The AfarHut immediately has its state reset, requiring a
        // full sync to update. Then this full sync is consumed here,
        // to be included within the html response (the initial html
        // and sync data will arrive at precisely the same time!)
        srcHut.resetSyncState();
        let initSyncTell = srcHut.consumePendingSync();
        
        let { textSize='100%' } = msg;
        reply(U.multilineString(`
          <!doctype html>
          <html spellcheck="false">
            <head>
              <title>${name.split('.').slice(-1)[0].upper()}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <link rel="shortcut icon" type="image/x-icon" href="${urlFn(srcHut, { command: 'html.icon', reply: '2' })}" />
              <style type="text/css">
                body { position: relative; opacity: 0; font-size: ${textSize}; transition: opacity 750ms linear; }
                body::before {
                  content: ''; display: block; position: absolute;
                  left: 0; right: 0; top: 0; bottom: 0;
                  box-shadow: inset 0 0 20px 10px rgba(255, 255, 255, 1);
                  z-index: 1000;
                  pointer-events: none;
                  transition: box-shadow 100ms linear;
                }
                body.loaded { opacity: 1; }
                body.focus::before { box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 1); }
              </style>
              <link rel="stylesheet" type="text/css" href="${urlFn(srcHut, { command: 'html.css' })}" />
              <script type="text/javascript">window.global = window; global.roomDebug = {};</script>
              <script type="text/javascript" src="${urlFn(srcHut, { command: 'html.room', type: 'setup', room: 'clearing' })}"></script>
              <script type="text/javascript" src="${urlFn(srcHut, { command: 'html.room', type: 'setup', room: 'foundation' })}"></script>
              <script type="text/javascript" src="${urlFn(srcHut, { command: 'html.room', type: 'setup', room: 'foundationBrowser' })}"></script>
              <script type="text/javascript">
                global.domAvailable = Promise(r => window.addEventListener('DOMContentLoaded', r));
                
                global.domAvailable.then(() => {
                  let body = document.body;
                  body.classList.add('focus');
                  window.addEventListener('load', () => body.classList.add('loaded'));
                  window.addEventListener('beforeunload', () => body.classList.remove('loaded'));
                  window.addEventListener('focus', evt => body.classList.add('focus'));
                  window.addEventListener('blur', evt => body.classList.remove('focus'));
                  window.focus();
                });
                
                let foundation = global.foundation = U.setup.FoundationBrowser(JSON.parse('${JSON.stringify({
                  ...foundation.origArgs,
                  ...foundation.readyArgs,
                  bearing: 'below',
                  hutId: srcHut.uid,
                  aboveMsAtResponseTime: foundation.getMs(),
                  initData: initSyncTell
                })}'));
                
                /// {DEBUG=
                // Catch exceptions after building all Rooms
                let handleError = evt => {
                  evt.preventDefault();
                  console.error(foundation.formatError(evt.error || evt.reason));
                  foundation.halt();
                };
                window.addEventListener('unhandledrejection', handleError);
                window.addEventListener('error', handleError);
                /// =DEBUG}
                
                foundation.settleRoom('${name}', 'below').catch(err => {
                  console.log('FATAL ERROR:\\n' + foundation.formatError(err));
                  foundation.halt();
                });
              </script>
            </head>
            <body>
            </body>
          </html>
        `));
        
      }));
      tmp.endWith(hut.roadSrc('html.room').route(async ({ srcHut, msg, reply }) => {
        
        let roomPcs = msg.room.split('.');
        let pcs = (msg.type === 'room')
          ? [ 'room', ...roomPcs, `${roomPcs.slice(-1)[0]}.js` ]
          : [ 'setup', `${msg.room}.js` ];
        
        let srcContent = await foundation.seek('keep', 'fileSystem', pcs).getContent('utf8');
        if (srcContent === null) return reply(`throw Error('Invalid room request: ${JSON.stringify(msg)}');`);
        let { lines, offsets } = foundation.compileContent(pcs, 'below', srcContent);
        
        if (foundation.getArg('debug').has('wrapClientJs')) {
          
          // SyntaxError is uncatchable in the FoundationBrowser and
          // gives no trace information. We can circumvent this by
          // sending code which cannot cause a SyntaxError directly;
          // instead the code is represented as a foolproof String, and
          // then it is eval'd. If the string represents syntactically
          // incorrect js `eval` will crash, but the script will have
          // loaded without any issue; a much more descriptive trace
          // can result! There's also an effort here to not change the
          // line count in order to keep debuggability. All wrapping
          // code is (ap|pre)pended to the first and last lines.
          let escQt = '\\' + `'`;
          let escEsc = '\\' + '\\';
          let headEvalStr = `try { eval([`;
          let tailEvalStr = `].join('\\n')); } catch(err) { console.log('Error from wrapped client code:', err); throw err; }`;
          
          lines = lines.map(ln => `  '` + ln.replace(/\\/g, escEsc).replace(/'/g, escQt) + `',`);
          let headInd = 0;
          let tailInd = lines.count() - 1;
          lines[headInd] = headEvalStr + lines[headInd];
          lines[tailInd] = lines[tailInd] + tailEvalStr;
            
        }
        
        reply([
          ...lines,
          `global.roomDebug['${msg.room}'] = ${JSON.stringify({ offsets })};`
        ].join('\n'));
        
      }));
      tmp.endWith(hut.roadSrc('html.icon').route(async ({ srcHut, msg, reply }) => {
        
        reply(foundation.seek('keep', 'fileSystem', 'setup', 'favicon.ico'));
        
      }));
      tmp.endWith(hut.roadSrc('html.css').route(async ({ srcHut, msg, reply }) => {
        
        reply(U.multilineString(`
          @keyframes smoothFocus {
            0% { outline: solid 0px; }
            20% { outline: solid 10px; }
            100% { outline: solid 2px; }
          }
          html, body {
            position: absolute; left: 0; top: 0; width: 100%; height: 100%;
            margin: 0; padding: 0;
            font-family: monospace;
            overflow: hidden;
          }
          :focus {
            outline: none;
            animation-name: smoothFocus;
            animation-duration: 400ms;
            animation-timing-function: ease-in-out;
            animation-iteration-count: 1;
            animation-fill-mode: forwards;
          }
          ::placeholder { color: inherit; opacity: 0.6; }
        `));
        
      }));
      tmp.endWith(hut.roadSrc('html.renderCss').route(async ({ srcHut, msg, reply }) => {
        
        // Only for use with auto-rendering!
        reply(U.multilineString(`
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
        
      }));
      if (foundation.getArg('deploy') === 'dev') tmp.endWith(hut.roadSrc('html.multi').route(async ({ srcHut, msg, reply }) => {
        
        let { num='4', w='400', h='400', textSize='100%' } = msg;
        
        let genIframe = n => {
          let paramStr = ({
            id: `multi${n}`,
            title: `Multi #${n + 1}`,
            width: w, height: h,
            src: `/?textSize=${textSize}`
          }).toArr((v, k) => `${k}="${v}"`).join(' ');
          return `<iframe ${paramStr}></iframe>`
        }
        reply(U.multilineString(`
          <!doctype html>
          <html>
            <head>
              <title>${name.split('.').slice(-1)[0].upper()}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <link rel="shortcut icon" type="image/x-icon" href="${urlFn(srcHut, { command: 'html.icon', reply: '2' })}" />
              <style type="text/css">
                body, html { padding: 0; margin: 0; }
                body { margin: 2px; text-align: center; }
                iframe { display: inline-block; margin: 1px; vertical-align: top; border: none; }
              </style>
              <script type="text/javascript">window.addEventListener('load', () => document.querySelector('iframe').focus())</script>
            </head>
            <body>${parseInt(num, 10).toArr(genIframe).join('')}</body>
          </html>
        `));
        
      }));
      /// =ABOVE}
      
      return tmp;
      
    }
    
  })});
  
};
