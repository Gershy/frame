// TODO: A Decorator to combine dragging + clicking? These 2 features are probably usually desirable together, and annoying
// to implement.

var package = new PACK.pack.Package({ name: 'userify',
  dependencies: [ 'quickDev', 'p', /*'geom'*/ ],
  buildFunc: function(packageName, qd) {
    var namespace = {};
    
    var P = PACK.p.P;
    
    /*
    // TODO: Removing "geom" dependency will break `PointerDecorator`
    var Point = PACK.geom.Point;
    var origin = PACK.geom.ORIGIN;
    */
    
    var uf = {
      
      /* DOM UTIL */
      domSetText: function(elem, text) {
        // TODO: Escaping can occur here
        if (elem.innerHTML !== text) elem.innerHTML = text;
      },
      domSetValue: function(elem, value) {
        if (elem.value !== value) elem.value = value;
      },
      domRestartAnimation: function(elem) {
        elem.style.animation = 'none';
        requestAnimationFrame(function() { elem.style.animation = ''; }, 10);
      },
      domAddListener: function(elem, type, func) {
        // Key the set at an index that isn't already in use
        var setName = '~' + type + 'Set';
        
        if (!func) throw new Error('Bad func:', func);
        
        // If no set already exists for this type of listener, create it
        if (!(setName in elem)) {
          
          // Create the set...
          elem[setName] = [];              
          
          // Set up a function at "type" to call every function at "setName"
          elem[type] = function(listenerSet, event) {
            // `clone` listenerSet before iteration in case of listeners which add/remove more listeners
            var ls = listenerSet.clone();
            for (var i = 0; i < ls.length; i++) ls[i](event);
          }.bind(null, elem[setName]);
          
        }
        
        if (~elem[setName].indexOf(func)) throw new Error('Func already added');
        
        // Add the listener
        elem[setName].push(func);
      },
      domRemListener: function(elem, type, func) {
        // Key the set at an index that isn't already in use
        var setName = '~' + type + 'Set';
        
        if (!(setName in elem)) return;
        
        var listenerSet = elem[setName];
        
        var len = listenerSet.length;
        if (listenerSet.remove(func) && U.isEmpty(listenerSet)) {
          // Clean up listener-set and calling-function
          elem[type] = null; // The `type` property isn't removable (e.g. "onmousemove", "onmouseup", etc.)
          delete elem[setName]; // But this is a custom property, so it can be removed
        }
      },
      toInfo: function(obj) {
        if (U.isObj(obj) && U.isObj(obj.getValue, Function)) return obj;
        if (U.isObj(obj, Function)) return { getValue: obj };
        return { getValue: function() { return this.value; }, setValue: function(val) { this.value = val; }, value: obj };
      },
      pafam: function(params, name, def) {
        return uf.toInfo(U.param(params, name, def));
      },
      
      /* DECORATOR */
      Decorator: U.makeClass({ name: 'Decorator',
        methods: function(sc, c) { return {
          init: function(params /* */) {
            this.id = U.id(c.NEXT_ID++);
          },
          start: function(view) { },
          update: function(view) { },
          stop: function(view) { }
        };},
        statik: {
          NEXT_ID: 0
        }
      }),
      PointerDecorator: U.makeClass({ name: 'PointerDecorator',
        superclassName: 'Decorator',
        methods: function(sc, c) { return {
          init: function(params /* validTargets */) {
            sc.init.call(this, params);
            
            /*
            PointerDecorators can be configured to fire on only specific children
            of the decorated element. If `validTargets` is an empty array, it
            means drags can only occur when the root element is clicked, and not
            its children. If `validTargets === null` then drags can be initiated
            by clicking on any child, or the root element. Otherwise,
            `validTargets` is an array of css-selectors and only child elements
            which match one of those selectors will be able to initiate drag
            events.
            */
            this.validTargets = U.param(params, 'validTargets', []);
          },
          validTarget: function(view, target) {
            // Returns true if `validTargets` is empty, the target is the view's root, or the target matches any selector
            return !this.validTargets.length
              || view.domRoot === target
              || this.validTargets.any(function(sel) { return target.matches(sel); });
          }
        };}
      }),
      ClickDecorator: U.makeClass({ name: 'ClickDecorator',
        superclassName: 'PointerDecorator',
        methods: function(sc, c) { return {
          init: function(params /* action, validTargets */) {
            sc.init.call(this, params);
            
            this.action = U.param(params, 'action', null);
            this.info = uf.toInfo(false);
          },
          start: function(view) {
            view['~' + this.id + '.clickFuncDn'] = c.clickFuncDn.bind(this, view);
            view['~' + this.id + '.clickFuncUp'] = c.clickFuncUp.bind(this, view);
            
            uf.domAddListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']); // Up listener is only added after mousedown
          },
          stop: function(view) {
            uf.domRemListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
            uf.domRemListener(document.body, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            
            delete view['~' + this.id + '.clickFuncDn'];
            delete view['~' + this.id + '.clickFuncUp'];
          }
        };},
        statik: {
          clickFuncDn: function(view, event) {
            if (!this.validTarget(view, event.target)) return;
            
            this.info.setValue(true);
            
            uf.domAddListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domAddListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
          },
          clickFuncUp: function(view, event) {
            if (!this.info.getValue()) return; // Could get called x2 with listeners on both document and `view.domRoot`
            
            uf.domRemListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domRemListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            
            this.info.setValue(false); // The mouse is up so change info to reflect that
            
            // Only run the action for valid targets
            if (this.validTarget(view, event.target) && this.action) this.action(view);
          }
        }
      }),
      DragDecorator: U.makeClass({ name: 'DragDecorator',
        superclassName: 'PointerDecorator',
        methods: function(sc, c) { return {
          init: function(params /* tolerance, validTargets, captureOnStart */) {
            sc.init.call(this, params);
            this.info = uf.toInfo({ drag: false, mouseDown: false, view: null });
            this.tolerance = U.param(params, 'tolerance', 0);
            
            // TODO: Function to capture arbitrary info when info begins (will allow physics values to be captured)
            this.captureOnStart = U.param(params, 'captureOnStart', null);
          },
          isDragging: function(view) {
            var val = this.info.getValue();
            return val.drag && (!view || view === val.view);
          },
          start: function(view) {
            // Store properties on the view
            view['~' + this.id + '.clickFuncDn'] = c.clickFuncDn.bind(this, view);
            view['~' + this.id + '.clickFuncUp'] = c.clickFuncUp.bind(this, view);
            view['~' + this.id + '.mouseMove'] = c.mouseMove.bind(this, view);
            view['~' + this.id + '.mouseOver'] = function() { return false; };
            
            uf.domAddListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
            uf.domAddListener(view.domRoot, 'onmouseover', view['~' + this.id + '.mouseOver']);
          },
          stop: function(view) {
            uf.domRemListener(view.domRoot, 'onmousedown', view['~' + this.id + '.clickFuncDn']);
            uf.domRemListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']); // If stopped during mousedown, this is necessary
            uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']); // If stopped during mousedown, this is necessary
            uf.domRemListener(view.domRoot, 'onmousemove', view['~' + this.id + '.mouseOver']); // If stopped during mousedown, this is necessary
            
            // Delete properties from the view
            delete view['~' + this.id + '.clickFuncDn'];
            delete view['~' + this.id + '.clickFuncUp'];
            delete view['~' + this.id + '.mouseMove'];
          }
        };},
        statik: {
          // For these methods `this` still refers to the DragDecorator even though these methods are static
          clickFuncDn: function(view, event) { // Mouse down - add up listener, modify `this.info`
            if (!this.validTarget(view, event.target)) return;
            
            // Add listeners
            uf.domAddListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domAddListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
            
            var rect = view.domRoot.getBoundingClientRect();
            
            // Update info
            this.info.setValue({
              drag: false,
              lastDragMs: null,
              getWaitTimeMs: function() {
                var ms = this.info.getValue().lastDragMs;
                return ms ? new Date() - ms : null;
              }.bind(this),
              mouseDown: true,
              view: view,
              capturedData: this.captureOnStart ? this.captureOnStart(view) : null,
              pt1: new Point({ x: event.clientX, y: event.clientY }),
              pt2: new Point({ x: event.clientX, y: event.clientY })
            });
          },
          clickFuncUp: function(view, event) { // Mouse up - modify `this.info`, remove up listener
            // Remove listeners
            uf.domRemListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
            
            var dragOccurred = this.info.getValue().drag;
            
            // Reset info
            this.info.setValue({
              drag: false,
              mouseDown: false,
              view: null
            });
            
            // If the drag happened prevent any clicks from going through on mouseup
            if (dragOccurred) event.preventDefault();
          },
          mouseMove: function(view, event) {   // Mouse move
            // Update values in `this.info`
            this.info.modValue(function(info) {
              // It's possible for mousemove to fire after mouseup; detectable if info.pt1 is undefined
              if (!info.pt1) return info;
              
              // Update `drag`
              info.pt2 = new Point({ x: event.clientX, y: event.clientY });
              
              if (!info.drag && info.pt2.dist(info.pt1) > this.tolerance) {
                // TODO: This is when the drag really starts; should consider updating `pt1` and `capturedData`
                info.drag = true;
              }
              
              info.lastDragMs = +new Date();
              
              return info;
            }.bind(this));
            
            event.preventDefault(); // Stops annoying highlighting. TODO: Should this be optional?
          }
        }
      }),
      DragActionDecorator: U.makeClass({ name: 'DragActionDecorator',
        superclassName: 'Decorator',
        methods: function(sc, c) { return {
          init: function(params /* dragDecorator, action({ target, dropZone }) */) {
            sc.init.call(this, params);
            this.dragDecorator = U.param(params, 'dragDecorator');
            this.action = U.param(params, 'action');
            this.info = uf.toInfo(null);
          },
          createClassDecorator: function(view) {
            return new uf.ClassDecorator({
              list: [ 'dragHover' ],
              info: function(view) { return this.info.getValue() === view ? 'dragHover' : null; }.bind(this, view)
            })
          },
          start: function(view) {
            view['~' + this.id + '.clickFuncUp'] = c.clickFuncUp.bind(this, view);
            view['~' + this.id + '.mouseEnter'] = c.mouseEnter.bind(this, view);
            view['~' + this.id + '.mouseLeave'] = c.mouseLeave.bind(this, view);
            
            uf.domAddListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domAddListener(view.domRoot, 'onmouseenter', view['~' + this.id + '.mouseEnter']);
            uf.domAddListener(view.domRoot, 'onmouseleave', view['~' + this.id + '.mouseLeave']);
          },
          stop: function(view) {
            uf.domRemListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domRemListener(view.domRoot, 'onmouseenter', view['~' + this.id + '.mouseEnter']);
            uf.domRemListener(view.domRoot, 'onmouseleave', view['~' + this.id + '.mouseLeave']);
            
            delete view['~' + this.id + '.clickFuncUp'];
            delete view['~' + this.id + '.mouseEnter'];
            delete view['~' + this.id + '.mouseLeave'];
          }
        };},
        statik: {
          clickFuncUp: function(view, event) {
            // Note that if the mouseup event occurs when multiple overlapping
            // views are hovered, the one that is used is the one in `this.info`.
            // This means that the view on which the mouseup is occurring is not
            // necessarily the view which is being passed to `this.action`.
            var drg = this.dragDecorator.info.getValue();
            var dropZone = this.info.getValue();
            
            // It's possible `dropZone` is null if the mouseup is occuring not as the final step of a drag action
            if (dropZone && drg.drag) this.action({ target: drg.view, dropZone: dropZone });
          },
          mouseEnter: function(view, event) {
            if (this.dragDecorator.isDragging())
              this.info.modValue(function(view0) {
                // Won't overwrite an old value unless the old value is `null`
                // Should make drags over multiple targets more stable
                return view0 ? view0 : view;
              });
          },
          mouseLeave: function(view, event) {
            this.info.modValue(function(view0) {
              // Won't clear the old value unless the leave event occurred on that value
              return view0 === view ? null : view0;
            });
          }
        }
      }),
      ClassDecorator: U.makeClass({ name: 'ClassDecorator',
        superclassName: 'Decorator',
        description: 'Dynamically changes html classes on an element',
        methods: function(sc, c) { return {
          init: function(params /* info, list */) {
            sc.init.call(this, params);
            this.list = U.param(params, 'list');
            this.info = uf.pafam(params, 'info');
          },
          start: function(view) {
          },
          update: function(view) {
            var nextClass = this.info.getValue();
            var classList = view.domRoot.classList;
            if (!nextClass || !classList.contains(nextClass)) {
              
              // Remove all possible classes
              classList.remove.apply(classList, this.list); 
              
              // Add the current class
              if (nextClass) classList.add(nextClass);
              
            }
          },
          stop: function(view) {
            if (view.domRoot) {
              var classList = view.domRoot.classList;
              classList.remove.apply(classList, this.list);
            }
          }
        };}
      }),
      CssDecorator: U.makeClass({ name: 'CssDecorator',
        superclassName: 'Decorator',
        description: 'Dynamically changes css properties on an element',
        methods: function(sc, c) { return {
          init: function(params /* info, properties */) {
            sc.init.call(this, params);
            this.properties = U.param(params, 'properties');
            this.info = uf.pafam(params, 'info');
          },
          start: function(view) {
          },
          update: function(view) {
            var nextProps = this.info.getValue();
            var style = view.domRoot.style;
            
            // Calculate the difference...
            for (var i = 0; i < this.properties.length; i++) {
              var prop = this.properties[i];
              var val = (prop in nextProps) ? nextProps[prop] : ''; // Unspecified properties are removed
              if (val !== style[prop]) style[prop] = val; // Only update the style props that have changed
            }
          },
          stop: function(view) {
            if (view.domRoot) {
              var style = view.domRoot.style;
              for (var i = 0; i < this.properties.length; i++) style[this.properties[i]] = '';
            }
          }
        };}
      }),
      FuncDecorator: U.makeClass({ name: 'FuncDecorator',
        superclassName: 'Decorator',
        description: 'Perform arbitrary actions as a decorator',
        methods: function(sc, c) { return {
          init: function(params /* func */) {
            this.func = U.param(params, 'func');
          },
          update: function(view) {
            this.func(view);
          }
        };}
      }),
            
      /* VIEW */
      NAME_REGEX: /^[a-z0-9]+[a-zA-Z0-9]*$/,
      View: U.makeClass({ name: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, cssId, framesPerTick, cssClasses, decorators */) {
            this.name = U.param(params, 'name');
            if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
            
            // `this.htmlId` allows html id generation to begin from such a value, instead of including the entire heirarchy chain
            this.cssId = U.param(params, 'cssId', null);
            
            this.cssClasses = U.param(params, 'cssClasses', []);
            this.decorators = U.param(params, 'decorators', []);
            this.framesPerTick = U.param(params, 'framesPerTick', 1);
            this.frameCount = this.framesPerTick; // `frameCount` starting full ensures 1st tick not skipped
            
            this.par = null;
            this.domRoot = null;
            this.millisAlive = 0;
          },
          
          // Heirarchy
          getAncestry: function() {
            var ret = [];
            var ptr = this;
            while(ptr !== null) { ret.push(ptr); ptr = ptr.par; }
            return ret;
          },
          getNameChain: function() {
            return this.getAncestry().reverse().map(function(ptr) {
              return ptr.name.toString();
            });
          },
          getAddress: function() {
            return this.getNameChain().join('.');
          },
          getHtmlId: function() {
            if (this.cssId) return this.cssId;
            return (this.par ? this.par.getHtmlId() + '-' : '') + this.name;
          },
          getRoot: function() {
            var ptr = this;
            while (ptr.par) ptr = ptr.par;
            return ptr;
          },
          getChild: function(address) {
            if (address.length === 0) return this; // Works for both strings and arrays
            
            if (!U.isObj(address, Array)) address = address.toString().split('.');
            
            var ptr = this;
            for (var i = 0, len = address.length; (i < len) && ptr; i++) ptr = ptr.children[address[i]];
            return ptr;
          },
          
          // DOM
          createDomRoot: function() {
            return document.createElement('div');
          },
          update: function(millis) {
            // Calling `update` ensures that `domRoot` is initialized
            if (this.domRoot === null) {
              this.domRoot = this.createDomRoot();
              this.start();
            }
            
            if (++this.frameCount >= this.framesPerTick) {
              for (var i = 0, len = this.decorators.length; i < len; i++)
                this.decorators[i].update(this, millis);
              
              this.tick(millis * this.framesPerTick);
              this.frameCount = 0;
            }
            this.millisAlive += millis;
            
            return PACK.p.$null;
          },
          tick: function(millis) {
            throw new Error('not implemented for ' + this.constructor.title);
          },
          
          start: function() {
            // Reverse-reference the View from the html element (useful for debugging)
            this.domRoot['~view'] = this;
            
            // Set the id property
            var htmlId = this.getHtmlId();
            if (htmlId.length < 40) this.domRoot.id = htmlId;
            
            // Set desired css classes
            this.domRoot.classList.add(this.name);
            for (var i = 0, len = this.cssClasses.length; i < len; i++)
              this.domRoot.classList.add(this.cssClasses[i]);
            
            (this.par ? this.par.provideContainer(this) : document.body).appendChild(this.domRoot);
            
            for (var i = 0, len = this.decorators.length; i < len; i++)
              this.decorators[i].start(this);
          },
          stop: function() {
            for (var i = 0, len = this.decorators.length; i < len; i++)
              this.decorators[i].stop(this);
            
            if (this.domRoot && this.domRoot.parentNode) this.domRoot.parentNode.removeChild(this.domRoot);
            this.domRoot = null;
          }
        };}
      }),
      TextView: U.makeClass({ name: 'TextView',
        superclassName: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, info */) {
            sc.init.call(this, params);
            this.info = uf.pafam(params, 'info');
          },
          
          createDomRoot: function() {
            var ret = document.createElement('span');
            ret.classList.add('text');
            return ret;
          },
          tick: function(millis) {
            var val = this.info.getValue();
            uf.domSetText(this.domRoot, val);
            //uf.domSetText(this.domRoot, this.info.getValue());
          },
          
          start: function() {
            sc.start.call(this);
            //this.info.start();
          },
          stop: function() {
            sc.stop.call(this);
            //this.info.stop();
          }
        };}
      }),
      InteractiveView: U.makeClass({ name: 'InteractiveView',
        superclassName: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, enabledData */) {
            sc.init.call(this, params);
            this.enabledData = uf.pafam(params, 'enabledData', true);
          },
          
          tick: function(millis) {
            if (this.enabledData.getValue())
              this.domRoot.classList.remove('disabled');
            else
              this.domRoot.classList.add('disabled');
          },
        };}
      }),
      TextEditView: U.makeClass({ name: 'TextEditView',
        superclassName: 'InteractiveView',
        methods: function(sc, c) { return {
          init: function(params /* name, multiline, initialValue, textInfo, placeholderData, enabledData */) {
            sc.init.call(this, params);
            this.multiline = U.param(params, 'multiline', false);
            this.textInfo = uf.pafam(params, 'textInfo', '');
            this.placeholderData = uf.pafam(params, 'placeholderData', '');
          },
          
          createDomRoot: function() {
            var ret = document.createElement('div');
            ret.classList.add('input');
            ret.classList.add(this.multiline ? 'multiline' : 'inline');
            
            var input = document.createElement(this.multiline ? 'textarea' : 'input');
            input.classList.add('interactive');
            input.oninput = function(e) {
              this.textInfo.setValue(input.value);
            }.bind(this);
            ret.appendChild(input);
            
            var placeholder = document.createElement('div');
            placeholder.classList.add('placeholder');
            ret.appendChild(placeholder);
            
            var anim = document.createElement('div');
            anim.classList.add('anim');
            for (var i = 0; i < 4; i++) {
              var a = document.createElement('div');
              a.classList.add('a');
              a.classList.add('a' + (i + 1));
              anim.appendChild(a);
            }
            ret.appendChild(anim);
            
            return ret;
          },
          tick: function(millis) {
            sc.tick.call(this, millis);
            
            var input = this.domRoot.childNodes[0];
            var inputText = this.textInfo.getValue();
            
            // Update text items
            uf.domSetText(this.domRoot.childNodes[1], this.placeholderData.getValue());
            uf.domSetValue(input, inputText);
            
            // Update the "_empty" class
            if (inputText)  this.domRoot.classList.remove('empty');
            else             this.domRoot.classList.add('empty');
            
            // Update the "_focus" class
            if (document.activeElement === input && !this.domRoot.classList.contains('focus')) {
              this.domRoot.classList.add('focus');
              var animSet = this.domRoot.childNodes[2].childNodes;
              for (var i = 0, len = animSet.length; i < len; i++) uf.domRestartAnimation(animSet[i]);
            } else if (document.activeElement !== input) {
              this.domRoot.classList.remove('focus');
            }
          },
        };}
      }),
      ActionView: U.makeClass({ name: 'ActionView',
        superclassName: 'InteractiveView',
        methods: function(sc, c) { return {
          init: function(params /* name, $action, textInfo, enabledData */) {
            sc.init.call(this, params);
            this.$action = U.param(params, '$action');
            this.waiting = false;
            this.textInfo = uf.pafam(params, 'textInfo');
          },
          
          createDomRoot: function() {
            var button = document.createElement('div');
            button.classList.add('button');
            button.classList.add('interactive');
            button.onkeypress = function(e) {
              if (e.keyCode === 13 || e.keyCode === 32) {
                button.onclick();
                e.preventDefault();
              }
            };
            button.onclick = function() {
              if (this.waiting) return;
              this.waiting = true;
              this.$action().then(function() {
                this.waiting = false;
              }.bind(this)).done();
            }.bind(this);
            
            return button;
          },
          tick: function(millis) {
            sc.tick.call(this, millis);
            
            uf.domSetText(this.domRoot, this.textInfo.getValue());
            
            if (this.waiting)  this.domRoot.classList.add('waiting');
            else               this.domRoot.classList.remove('waiting');
          },
          
        };}
      }),
      CanvasView: U.makeClass({ name: 'CanvasView',
        superclassName: 'View',
        description: 'Generates a canvas and paint handler for ' +
          'arbitrary graphics',
        methods: function(sc, c) { return {
          init: function(params /* name, options { centered }, drawFunc(graphicsContext, millis) */) {
            sc.init.call(this, params);
            
            this.drawFunc = U.param(params, 'drawFunc');
            this.options = {
              centered: false
            }.update(U.param(params, 'options', {}));
            this.context = null;
          },
          
          createDomRoot: function() {
            var canvas = document.createElement('canvas');
            this.context = canvas.getContext('2d');
            
            return canvas;
          },
          tick: function(millis) {
            var canvas = this.domRoot;
            var bounds = canvas.parentNode.getBoundingClientRect();
            var bw = Math.round(bounds.width);
            var bh = Math.round(bounds.height);
            
            if (canvas.width !== bw || canvas.height !== bh) {
              canvas.width = bw;
              canvas.height = bh;
            }
            
            this.context.clearRect(0, 0, canvas.width, canvas.height)
            
            this.context.save();
            if (this.options.centered) { this.context.translate(bw >> 1, bh >> 1); }
            this.drawFunc(this.context, millis)
            this.context.restore();
          }
        };}
      }),
      
      /* SET VIEW */
      AbstractSetView: U.makeClass({ name: 'AbstractSetView',
        superclassName: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, children */) {
            sc.init.call(this, params);
            this.children = {};
            this.addChildren(U.param(params, 'children', []));
          },
          
          addChildren: function(children) {
            for (var i = 0, len = children.length; i < len; i++)
              this.addChild(children[i]);
          },
          addChild: function(child) {
            if (child.par === this) return child;
            if (child.par !== null) throw new Error('Tried to add View with parent: ' + child.getAddress());
            if (child.name in this.children) throw new Error('Already have a child named "' + child.name + '"');
            
            child.par = this;
            this.children[child.name] = child;
            
            return child;
          },
          remChild: function(child) {
            // Resolve string to child
            if (U.isObj(child, String)) child = this.children[child];
            
            if (!child || !(child.name in this.children)) return null;
            
            child.stop(); // Detach dom
            child.par = null; // Detach info step 1
            delete this.children[child.name]; // Detach info step 2
            
            return child;
          },
          provideContainer: function() {
            throw new Error('not implemented');
          },
          
          stop: function() {
            for (var k in this.children) this.children[k].stop();
            sc.stop.call(this);
          }
        };}
      }),
      SetView: U.makeClass({ name: 'SetView',
        superclassName: 'AbstractSetView',
        description: 'The simplest implementation of AbstractSetView. ' +
          'Updates all child views.',
        methods: function(sc, c) { return {
          init: function(params /* name, children, numWrappers */) {
            sc.init.call(this, params);
            this.numWrappers = U.param(params, 'numWrappers', 0);
          },
          
          createDomRoot: function() {
            var ret = sc.createDomRoot.call(this);
            var ptr = ret;
            for (var i = 0, len = this.numWrappers; i < len; i++) {
              ptr.appendChild(document.createElement('div'));
              ptr = ptr.childNodes[0];
              ptr.classList.add('wrap');
            }
            return ret;
          },
          provideContainer: function() {
            var ret = this.domRoot;
            for (var i = 0, len = this.numWrappers; i < len; i++) ret = ret.childNodes[0];
            return ret;
          },
          update: function(millis) {
            var children = this.children;
            
            sc.update.call(this, millis);
            for (var k in this.children) this.children[k].update(millis);
          },
          tick: function(millis) {
          }
          
        };}
      }),
      RootView: U.makeClass({ name: 'RootView',
        superclassName: 'SetView',
        description: '',
        methods: function(sc, c) { return {
          init: function(params /* updateFunc */) {
            sc.init.call(this, params);
            this.updateFunc = U.param(params, 'updateFunc', null);
            this.updateTimingInfo = uf.toInfo(0);
            this.running = false;
            this.updateMs = 1000 / 60; // 60fps
          },
          update: function(millis) {
            if (this.updateFunc) this.updateFunc();
            sc.update.call(this, millis);
          },
          animationLoop: function() {
            if (!this.running) return;
            
            var time0 = +new Date();
            this.update(this.updateMs);
            this.updateTimingInfo.setValue(new Date() - time0);
            requestAnimationFrame(this.animationLoop.bind(this));
          },
          start: function() {
            this.domRoot = this.createDomRoot();
            sc.start.call(this);
            this.running = true;
            requestAnimationFrame(this.animationLoop.bind(this));
          },
          stop: function() {
            sc.stop.call(this);
            this.running = false;
          }
        };}
      }),
      ChoiceView: U.makeClass({ name: 'ChoiceView',
        superclassName: 'AbstractSetView',
        methods: function(sc, c) { return {
          init: function(params /* name, choiceInfo, children */) {
            sc.init.call(this, params);
            
            // Info returning the name of one of the children
            this.choiceInfo = uf.pafam(params, 'choiceInfo');
            
            // Property to keep track of the currently active child
            this.currentChild = null;
          },
          
          provideContainer: function() {
            return this.domRoot;
          },
          update: function(millis) {
            sc.update.call(this, millis);
            if (this.currentChild) this.currentChild.update(millis);
          },
          tick: function(millis) {
            var choice = this.choiceInfo.getValue();
            
            if (choice === null) {
              var nextChild = null;
            } else {
              if (!(choice in this.children)) throw new Error('Bad view choice: "' + choice + '"');
              var nextChild = this.children[choice];
            }
            
            if (nextChild !== this.currentChild) {
              if (this.currentChild) {
                this.domRoot.classList.remove('choose-' + (this.currentChild ? this.currentChild.name : 'null'));
                this.currentChild.stop();
              }
              this.currentChild = nextChild;
              if (this.currentChild) {
                this.domRoot.classList.add('choose-' + (this.currentChild ? this.currentChild.name : 'null'));
              }
            }
          }
        };}
      }),
      TextHideView: U.makeClass({ name: 'TextHideView',
        superclassName: 'ChoiceView',
        description: 'A text field that is hidden when its text is empty',
        methods: function(sc, c) { return {
          init: function(params /* name, info */) {
            var info = uf.pafam(params, 'info');
            sc.init.call(this, params.update({
              choiceInfo: uf.toInfo(function() { return info.getValue() ? 'text' : null; }),
              children: [  new uf.TextView({ name: 'text', info: info })  ]
            }));
          }
        };}
      }),
      DynamicTextEditView: U.makeClass({ name: 'DynamicTextEditView',
        superclassName: 'ChoiceView',
        description: 'A text field which is conditionally editable',
        methods: function(sc, c) { return {
          init: function(params /* name, editableData, textInfo, inputViewParams */) {
            var editableData = uf.pafam(params, 'editableData');
            this.textInfo = uf.pafam(params, 'textInfo');
            var inputViewParams = U.param(params, 'inputViewParams', {});
            sc.init.call(this, params.update({
              choiceInfo: uf.toInfo(function() { return editableData.getValue() ? 'edit' : 'display'; }),
              children: [
                new uf.TextEditView(inputViewParams.update({ name: 'edit', textInfo: this.textInfo })),
                new uf.TextView({ name: 'display', info: this.textInfo })
              ]
            }));
          }
        };}
      }),
      DynamicSetView: U.makeClass({ name: 'DynamicSetView',
        superclassName: 'SetView',
        description: 'A SetView whose children are based on Info. ' +
          'Modifications to the Info instantly modify the children of ' +
          'the DynamicSetView. Adds a 2nd parameter to `addChild`; the ' +
          'raw info that the child was built from.',
        methods: function(sc, c) { return {
          init: function(params /* name, childInfo, getDataId, genChildView, comparator */) {
            if ('children' in params) throw new Error('Cannot initialize DynamicSetView with `children` param');
            
            sc.init.call(this, params);
            this.childInfo = uf.pafam(params, 'childInfo');
            //this.getDataId = U.param(params, 'getDataId'), // Returns a unique id for a piece of info (will be used for child.name)
            this.genChildView = U.param(params, 'genChildView'), // function(name, initialRawData, info) { /* generates a View */ };
            this.comparator = U.param(params, 'comparator', null); // TODO: implement!
            
            // TODO: `this.childFullData` is hardly ever mentioned on ctrl+f, so remove it?
            //this.childFullData = {}; // A properly-keyed list of raw info items. The child's name corresponds to the info's key.
            
            this.count = 0;
          },
          
          tick: function(millis) {
            
            this.updateChildren();
            
          },
          
          updateChildren: function() {
            /*
            Fully compares `this.children` to `this.childInfo.getValue()`
            Adds/removes any elements in `this.children` based on their
            existence in `this.childInfo`. Returns values showing which
            children were added and which were removed.
            */
            
            var rem = this.children.clone(); // Initially mark all children for removal
            var add = {};  // Initially mark no children for addition
            
            var cd = this.childInfo.getValue();
            
            for (var k in cd) {
              
              // Unmark for removal
              delete rem[k];
              
              // Mark for addition
              if (!(k in this.children)) add[k] = cd[k];
              
            }
            
            // Remove all children as necessary
            for (var k in rem) {
              this.remChild(k);
              //var child = this.remChild(k);
              // delete this.childFullData[child.name]; // TODO: This is the only other place `this.childFullData` is mentioned
            }
            
            // Add all children as necessary
            for (var k in add) {
              // `add[k]` is never even accessed; add is coming from `this.childInfo` which the client should already have access to
              var child = this.genChildView.call(this, k, add[k]); // TODO: Or should `add[k]` be provided here?
              if (child.name !== k) throw new Error('Child named "' + child.name + '" needs to be named "' + k + '"');
              
              add[k] = this.addChild(child);
              if (!add[k]) throw new Error('DynamicSetView `addChild` failed');
            }
            
            return { rem: rem, add: add };
            
          },
          
          renameChild: function(view, newName) {
            if (newName === view.name) return;
            
            if (newName in this.children) throw new Error('A child is already named "' + newName + '"; can\'t rename');
            if (!(newName in this.childInfo.getValue())) throw new Error('Renaming "' + view.name + '" to "' + newName + ' would leave it without any info. Update `childInfo` before calling `renameChild`.');
            
            this.children[newName] = this.children[view.name];
            delete this.children[view.name];
            
            if (view.domRoot) {
              // Get the name-chain, but replace the last item with the new name
              var nameChain = view.getNameChain();
              nameChain[nameChain.length - 1] = newName;
              view.domRoot.id = nameChain.join('-');
              
              // Replace the naming class
              view.domRoot.classList.remove(view.name);
              view.domRoot.classList.add(newName);
            }
            
            view.name = newName;
          },
          
          start: function() {
            sc.start.call(this);
            //this.childInfo.start();
          },
          stop: function() {
            sc.stop.call(this);
            //this.childInfo.stop();
          }
        };}
      })
      
    };
    
    return uf;
  }
});
package.build();
