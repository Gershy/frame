global.rooms['hinterlands.htmlApp'] = async foundation => {
  let HtmlApp = U.inspire({ name: 'HtmlApp', methods: (insp, Insp) => ({
    init: function({ name }) { this.name = name; },
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
        let { textSize='100%' } = msg;
        
        reply(U.multilineString(`
          <!doctype html>
          <html>
            <head>
              <title>${this.name.upper()}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <link rel="shortcut icon" type="image/x-icon" href="${urlFn({ command: 'html.icon' })}" />
              <link rel="stylesheet" type="text/css" href="${urlFn({ command: 'html.css' })}" />
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
              <script type="text/javascript">window.global = window;</script>
              <script type="text/javascript">global.roomDebug = {};</script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'clearing' })}"></script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundation' })}"></script>
              <script type="text/javascript" src="${urlFn({ command: 'html.room', type: 'setup', room: 'foundationBrowser' })}"></script>
              <script type="text/javascript">
                global.domAvailable = Promise(r => window.addEventListener('DOMContentLoaded', r));
                
                global.domAvailable.then(() => {
                  window.addEventListener('load', () => document.body.classList.add('loaded'));
                  window.addEventListener('beforeunload', () => document.body.classList.remove('loaded'));
                  window.addEventListener('focus', () => document.body.classList.add('focus'));
                  window.addEventListener('blur', () => document.body.classList.remove('focus'));
                  window.focus();
                });
                
                let foundation = global.foundation = U.setup.FoundationBrowser({
                  ...${JSON.stringify(foundation.origArgs)},
                  bearing: 'below',
                  hutId: '${srcHut.uid}',
                  isSpoofed: ${srcHut.isSpoofed},
                  aboveMsAtResponseTime: ${foundation.getMs()},
                  initData: ${JSON.stringify(initSyncTell)}
                });
                foundation.settleRoom('${this.name}', 'below').catch(err => {
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
        
        let roomPcs = msg.room.split('.');
        let pcs = (msg.type === 'room')
          ? [ 'room', ...roomPcs, `${roomPcs.slice(-1)[0]}.js` ]
          : [ 'setup', `${msg.room}.js` ];
        
        let srcContent = await foundation.seek('keep', 'fileSystem', pcs).getContent('utf8');
        if (srcContent === null) return reply(`throw Error('Invalid room request: ${JSON.stringify(msg)}')`);
        let { lines, offsets } = foundation.compileContent('below', srcContent);
        
        reply([
          ...lines,
          `global.roomDebug['${msg.room}'] = ${JSON.stringify({ offsets })};`
        ].join('\n'));
        
      });
      parHut.roadSrc('html.icon').route(async ({ road, srcHut, msg, reply }) => {
        
        reply(foundation.seek('keep', 'fileSystem', 'setup', 'favicon.ico'));
        
      });
      parHut.roadSrc('html.css').route(async ({ road, srcHut, msg, reply }) => {
        
        reply(U.multilineString(`
          @keyframes smoothFocus {
            0% { outline: rgba(0, 0, 0, 0) solid 0px; }
            20% { outline: rgba(0, 0, 0, 0.4) solid 10px; }
            100% { outline: rgba(0, 0, 0, 0.2) solid 2px; }
          }
          
          html, body {
            position: absolute; left: 0; top: 0; width: 100%; height: 100%;
            margin: 0; padding: 0;
            font-family: monospace;
            overflow: hidden;
          }
          :focus {
            animation-name: smoothFocus;
            animation-duration: 400ms;
            animation-timing-function: ease-in-out;
            animation-iteration-count: 1;
            animation-fill-mode: forwards;
          }
        `));
        
      });
      parHut.roadSrc('html.renderCss').route(async ({ road, srcHut, msg, reply }) => {
        
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
        
      });
      
      parHut.roadSrc('html.multi').route(async ({ road, srcHut, msg, reply }) => {
        
        let { num='4', w='400', h='400', textSize='100%' } = msg;
        
        let genIframe = n => {
          let paramStr = ({
            id: `multi${n}`,
            title: `Multi #${n + 1}`,
            width: w, height: h,
            src: `?textSize=${textSize}`
          }).toArr((v, k) => `${k}="${v}"`).join(' ');
          return `<iframe ${paramStr}></iframe>`
        }
        let urlFn = (p={}, params={ hutId: srcHut.uid, ...p, reply: '1' }) => {
          return '?' + params.toArr((v, k) => `${k}=${v}`).join('&');
        };
        
        reply(U.multilineString(`
          <!doctype html>
          <html>
            <head>
              <title>${this.name.upper()}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <link rel="shortcut icon" type="image/x-icon" href="${urlFn({ command: 'html.icon' })}" />
              <style type="text/css">
                body, html { padding: 0; margin: 0; }
                body { margin: 2px; text-align: center; }
                iframe { display: inline-block; margin: 1px; vertical-align: top; border: none; }
              </style>
            </head>
            <body>${parseInt(num, 10).toArr(genIframe).join('')}</body>
          </html>
        `));
        
      });
      /// =ABOVE}
    }
  })});
  return { HtmlApp };
};
