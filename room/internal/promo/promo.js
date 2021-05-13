global.rooms['internal.promo'] = async foundation => {
  
  let { Tmp, Slots } = U.logic;
  
  let { Scope } = U.logic;
  let { RecScope } = await foundation.getRoom('record');
  let { Real, Axis1DLayout, FreeLayout, SizedLayout, ScrollLayout, TextLayout, ImageLayout } = U.setup;
  let { HtmlApp } = await foundation.getRoom('hinterlands.htmlApp');
  
  return { open: async promoHut => {
    
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
      
      // Axis1DLayout - "mode" can be:
      // - Array for custom-sized sections (and fill final section)
      // - "compactCenter" to press all children together in the middle
      // - "disperseTouchEdge" evenly spaces kids; no padding at edges
      // - "dispersePadHalfEdge" evenly space; half padding at edges
      // - "dispersePadFullEdge" even children; even padding
      // Omitted for arbitrary flow of sections (no param required for child layouts)
      
      let promoReal = dep(rootReal.addReal('pmo.promo', ctx => ({
        layouts: [ FreeLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+', mode: [ '80px' ] })
      })));
      let headerReal = promoReal.addReal('pmo.header', ctx => ({
        layouts: ctx.layouts(0),
        innerLayout: Axis1DLayout({ axis: 'x', flow: '+', mode: 'stretch' }),
        decals: {
          border: { ext: '2px', colour: 'rgba(0, 0, 0, 0.1)' }
        }
      }));
      let tabs = {
        hut:      headerReal.addReal('pmo.header.hut',      ctx => ({ layouts: [ ...ctx.layouts(), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'HUT', size: 'calc(12px + 2vw)' })        })),
        phil:     headerReal.addReal('pmo.header.phil',     ctx => ({ layouts: [ ...ctx.layouts(), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Philosophy', size: 'calc(10px + 1vw)' }) })),
        example:  headerReal.addReal('pmo.header.example',  ctx => ({ layouts: [ ...ctx.layouts(), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Example', size: 'calc(10px + 1vw)' })    })),
        rooms:    headerReal.addReal('pmo.header.rooms',    ctx => ({ layouts: [ ...ctx.layouts(), SizedLayout({ h: '100%' }) ], innerLayout: TextLayout({ text: 'Rooms', size: 'calc(10px + 1vw)' })      }))
      };
      
      let scrollReal = promoReal.addReal('pmo.scroll', ctx => ({
        layouts: ctx.layouts(1),
        innerLayout: ScrollLayout({ x: 'none', y: 'auto' })
      }));
      let contentReal = scrollReal.addReal('pmo.content', ctx => ({
        layouts: [ ...ctx.layouts(), SizedLayout({ w: '100%', h: '100%' }) ],
        innerLayout: Axis1DLayout({ axis: 'y', flow: '+' })
      }));
      
      let pages = {
        hut: (() => {
          
          let real = contentReal.addReal('pmo.content.hut', ctx => ({
            layouts: [ ...ctx.layouts(), SizedLayout({ w: '100%', h: '100%' }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+', mode: 'compactCenter' }),
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          let hutSectionImageReal = real.addReal('pmo.content.hut.image', ctx => ({
            layouts: [
              ...ctx.layouts(),
              SizedLayout({ h: '60vmin', ratio: 8 / 5 }),
              ImageLayout({ image: foundation.seek('keep', 'static', [ 'room', 'promo', 'asset', 'hutIcon.svg' ]) })
            ]
          }));
          let hutSectionTextReal = real.addReal('pmo.content.hut.text', ctx => ({
            layouts: [
              ...ctx.layouts(),
              SizedLayout({ h: 'calc(20px + 4vw)' }),
              TextLayout({ text: 'Reimagine Distributed Software', size: 'calc(10px + 2vw)' })
            ]
          }));
          return real;
          
        })(),
        phil: (() => {
          
          let real = contentReal.addReal('pmo.content.philosophy', ctx => ({
            layouts: [ ...ctx.layouts(), SizedLayout({ w: '100%', h: '100%' }) ],
            innerLayout: Axis1DLayout({ axis: 'y', flow: '+', mode: 'compactCenter' }),
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          real.addReal('pmo.content.philosophy.text1', ctx => ({
            layouts: [ ...ctx.layouts(),
              TextLayout({ size: '120%', align: 'mid', text: [
                'The complexity of traditionally developing web pages is too high.',
                'Assembly language was considered too complex, and was replaced with C and higher-level languages.',
                'There is little reason to use Assembly today. And as Assembly had C, the web now has Hut.'
              ].join(' ')})
            ]
          }));
          real.addReal('pmo.content.philosophy.text2', ctx => ({
            layouts: [ ...ctx.layouts(),
              TextLayout({ size: '120%', align: 'mid', text: [
                'New developers full of ideas flock to tutorials, eager to create what they imagine.',
                'Suddenly they encounter the absurd DOM, circular code dependencies, the overripe CSS language,',
                'HTTP and its pitfalls. Motivation and freshness fade away. The idea distorts, and no longer seems enticing.'
              ].join(' ')})
            ]
          }));
          return real;
          
        })(),
        example: (() => {
          
          let real = contentReal.addReal('pmo.content.example', ctx => ({
            layouts: [ ...ctx.layouts(), SizedLayout({ w: '100%', h: '100%' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          return real;
          
        })(),
        rooms: (() => {
          
          let real = contentReal.addReal('pmo.content.rooms', ctx => ({
            layouts: [ ...ctx.layouts(), SizedLayout({ w: '100%', h: '100%' }) ],
            decals: { colour: 'rgba(0, 0, 0, 0)' }
          }));
          return real;
          
        })()
      };
      
      pages.each(page => page.addDecals({
        colour: 'rgba(0, 0, 0, 1)',
        transition: { colour: { delayMs: 500, ms: 200 } }
      }));
      
      // let scrolledContentChecker = dep(scrollReal.addScrolledContentChecker());
      // dep(Scope(scrolledContentChecker, (scrolledContent, dep) => {
      // }));
      
      for (let name in pages) {
        
        let [ page, tab ] = [ pages, tabs ].map(v => v[name]);
        
        let feel = dep(tab.addFeel());
        let press = dep(tab.addPress());
        dep(Scope(feel.src, (hover, dep) => dep(tab.addDecals({ colour: 'rgba(0, 0, 0, 0.2)' }))));
        dep(press.src.route(press => scrollReal.scrollTo(page)));
        
        let viewportEntry = dep(page.addViewportEntryChecker());
        let lighten = dep(Scope(viewportEntry.src, (entered, dep) => {
          dep(page.addDecals({
            colour: 'rgba(0, 0, 0, 0)'
          }));
        }));
        
      }
      
    });
    
  }};
  
};
