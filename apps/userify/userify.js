// TODO: Some Data objects can be optimized to cache previous values until the end of the frame (or some other condition?)
// E.g. Would stop 1000 elements all connected to the same CalculatedData from repeating the calculation 1000 times
// TODO: A Decorator to combine dragging + clicking? These 2 features are probably usually desirable together, and annoying
// to implement.
// TODO: RENAME `DATA` CLASSES!!!!

var package = new PACK.pack.Package({ name: 'userify',
  dependencies: [ 'quickDev', 'p', 'geom' ],
  buildFunc: function() {
    var namespace = {};
    
    var P = PACK.p.P;
    var Point = PACK.geom.Point;
    var origin = PACK.geom.ORIGIN;
    
    var uf = {
      
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
      padam: function(params, name, def) {
        // Data-param; ensures the return value is an instance of PACK.userify.Data (defaulting to SimpleData)
        var ret = U.param(params, name, def);
        if (U.isInstance(ret, uf.Data)) return ret;
        return U.isObj(ret, Function)
          ? new uf.CalculatedData({ getFunc: ret })
          : new uf.SimpleData({ value: ret });
      },
      
      /* DATA */
      Data: U.makeClass({ name: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* */) {
            this.value = null;
          },
          
          walk: function(path) {
            if (U.isObj(path, String)) path = path ? path.split('.') : [];
            var obj = this;
            for (var i = 0, len = path.length; i < len; i++) {
              if (U.isInstance(obj, uf.Data)) obj = obj.getValue();
              obj = obj[path[i]];
            }
            return obj;
          },
          walkGet: function(path) {
            var result = this.walk(path);
            return U.isInstance(result, uf.Data) ? result.getValue() : result;
          },
          walkSet: function(path, value) {
            if (U.isObj(path, String)) path = path ? path.split('.') : [];
            
            var result = this.walk(path);
            if (!U.isInstance(result, uf.Data)) throw new Error('walkSet with path "' + path.join('.') + '" did not retrieve an instance of Data');
            
            result.setValue(value);
          },
          getValue: function() {
            throw new Error('Not implemented');
          },
          setValue: function(value) {
            throw new Error('Not implemented');
          },
          modValue: function(modFunc) {
            var val = modFunc(this.getValue());
            
            if (!U.exists(val)) throw new Error('modFunc shouldn\'t return `undefined`');
            
            this.setValue(val);
            return val;
          },
          
          start: function() {},
          stop: function() {}
        };}
      }),
      SimpleData: U.makeClass({ name: 'SimpleData',
        superclassName: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* value */) {
            sc.init.call(this, params);
            this.value = U.param(params, 'value');
          },
          
          getValue: function() {
            return this.value;
          },
          setValue: function(value) {
            this.value = value;
          }
        };}
      }),
      UpdatingData: U.makeClass({ name: 'UpdatingData',
        superclassName: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* $getFunc, $setFunc, updateMillis, initialValue */) {
            sc.init.call(this, params);
            this.$getFunc = U.param(params, '$getFunc');
            this.$setFunc = U.param(params, '$setFunc', null);
            this.updateMillis = U.param(params, 'updateMillis', 0);
            this.value = U.param(params, 'initialValue', null);
            
            this.num = 0;
            this.freshestNum = -1; // The numbering of the most recent value that's been set
            this.timeout = null;
            
            this.start();
          },
          
          getValue: function() {
            return this.value;
          },
          setValue: function(value) {
            if (!this.$setFunc) throw new Error('No `$setFunc`');
            
            this.freshestNum = this.num; // Invalidates any pending requests
            this.value = value;
            
            this.$setFunc(value).done();
          },
          refresh: function() {
            clearTimeout(this.timeout); // If this method was manually called, clear the automatic timeout
            
            this.$getFunc().then(function(num, val) {
              if (num > this.freshestNum) {
                this.freshestNum = num;
                this.value = val;
              }
            }.bind(this, this.num++)).done();
            
            if (this.updateMillis) {
              this.timeout = setTimeout(function() {
                this.refresh();
              }.bind(this), this.updateMillis); // The timeout delay should compensate for latency
            }
          },
          
          start: function() {
            // TODO: Shouldn't be setInterval - should be setTimeout; timeout should take promise latency into account
            this.refresh();
          },
          stop: function() {
            if (this.timeout !== null) clearTimeout(this.timeout);
          },
        };}
      }),
      CalculatedData: U.makeClass({ name: 'CalculatedData',
        superclassName: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* getFunc */) {
            sc.init.call(this, params);
            this.getFunc = U.param(params, 'getFunc');
            this.setFunc = U.param(params, 'setFunc', null);
          },
          
          getValue: function() {
            return this.getFunc();
          },
          setValue: function(value) {
            if (!this.setFunc) throw new Error('No `setFunc`');
            this.setFunc(value);
          }
        };}
      }),
      CachedData: U.makeClass({ name: 'CachedData',
        // TODO: Need a way to register this badboy in a list so the whole list can be reset at once
        // Will require modifications to CachedData.prototype.stop/start; to register/unregister itself
        superclassName: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* data */) {
            sc.init.call(this, params);
            this.data = uf.padam(params, 'data');
            this.cached = c.NO_VALUE;
          },
          getValue: function() {
            if (this.cached === c.NO_VALUE) this.cached = this.data.getValue();
            return this.cached;
          },
          setValue: function(val) {
            this.cached = val;
          },
          reset: function() {
            if (this.cached === c.NO_VALUE) return;
            
            this.data.setValue(this.cached);
            this.cached = c.NO_VALUE;
          },
          stop: function() {
            this.reset();
          }
        };},
        statik: {
          NO_VALUE: { NO_VALUE: true }
        }
      }),
      ProxyData: U.makeClass({ name: 'ProxyData',
        superclassName: 'Data',
        methods: function(sc, c) { return {
          init: function(params /* data, path */) {
            sc.init.call(this, params);
            this.data = U.param(params, 'data');
            this.path = U.param(params, 'path');
            
            if (U.isObj(this.path, String)) this.path = this.path ? this.path.split('.') : [];
          },
          getValue: function() {
            var obj = this.data;
            
            for (var i = 0, len = this.path.length; i < len; i++) {
              var pathPc = this.path[i];
              obj = pathPc === '~' ? obj.getValue() : obj[pathPc];
            }
            
            return obj;
          },
          setValue: function(val) {
            var obj = this.data;
            
            for (var i = 0, len = this.path.length - 1; i < len; i++) {
              var pathPc = this.path[i];
              obj = pathPc === '~' ? obj.getValue() : obj[pathPc];
            }
            
            var pathPc = this.path[this.path.length - 1];
            if (pathPc === '~') obj.setValue(val);
            else                 obj[pathPc] = val;
          }
        };}
      }),
      
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
            this.data = new uf.SimpleData({ value: false });
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
            
            this.data.setValue(true);
            
            uf.domAddListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domAddListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
          },
          clickFuncUp: function(view, event) {
            if (!this.data.getValue()) return; // Could get called x2 with listeners on both document and `view.domRoot`
            
            uf.domRemListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domRemListener(view.domRoot, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            
            this.data.setValue(false); // The mouse is up so change data to reflect that
            
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
            this.data = new uf.SimpleData({ value: { drag: false, mouseDown: false, view: null } });
            this.tolerance = U.param(params, 'tolerance', 0);
            
            // TODO: Function to capture arbitrary data when drag begins (will allow physics values to be captured)
            this.captureOnStart = U.param(params, 'captureOnStart', null);
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
          clickFuncDn: function(view, event) { // Mouse down - add up listener, modify `this.data`
            if (!this.validTarget(view, event.target)) return;
            
            // Add listeners
            uf.domAddListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domAddListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
            
            var rect = view.domRoot.getBoundingClientRect();
            
            // Update data
            this.data.setValue({
              drag: false,
              lastDragMs: null,
              getWaitTimeMs: function() {
                var ms = this.data.getValue().lastDragMs;
                return ms ? new Date() - ms : null;
              }.bind(this),
              mouseDown: true,
              view: view,
              capturedData: this.captureOnStart ? this.captureOnStart(view) : null,
              pt1: new Point({ x: event.clientX, y: event.clientY }),
              pt2: new Point({ x: event.clientX, y: event.clientY })
            });
          },
          clickFuncUp: function(view, event) { // Mouse up - modify `this.data`, remove up listener
            // Remove listeners
            uf.domRemListener(window, 'onmouseup', view['~' + this.id + '.clickFuncUp']);
            uf.domRemListener(document.body, 'onmousemove', view['~' + this.id + '.mouseMove']);
            
            var dragOccurred = this.data.getValue().drag;
            
            // Reset data
            this.data.setValue({
              drag: false,
              mouseDown: false,
              view: null
            });
            
            // If the drag happened prevent any clicks from going through on mouseup
            if (dragOccurred) event.preventDefault();
          },
          mouseMove: function(view, event) {   // Mouse move
            // Update values in `this.data`
            var data = this.data.getValue(); // We know `this.data` is a SimpleData, so just updating it normally works here
            
            // It's possible for mousemove to fire after mouseup; detectable if data.pt1 is undefined
            if (!data.pt1) return;
            
            // Update `drag`
            data.pt2 = new Point({ x: event.clientX, y: event.clientY });
            if (!data.drag && data.pt2.dist(data.pt1) > this.tolerance) {
              // TODO: This is when the drag really starts; should consider updating `pt1` and `capturedData`
              data.drag = true;
            }
            
            data.lastDragMs = +new Date();
            
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
            this.data = new uf.SimpleData({ value: null });
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
            // views are hovered, the one that is used is the one in `this.data`.
            // This means that the view on which the mouseup is occurring is not
            // necessarily the view which is being passed to `this.action`.
            var drg = this.dragDecorator.data.getValue();
            var dropZone = this.data.getValue();
            if (dropZone === null) {
              console.error('DragActionDecorator `this.data.getValue()` was null on mouseup');
              dropZone = view;
            }
            if (drg.drag) this.action({ target: drg.view, dropZone: dropZone });
          },
          mouseEnter: function(view, event) {
            this.data.modValue(function(view0) {
              // Won't overwrite an old value unless the old value is `null`
              // Should make drags over multiple targets more stable
              return view0 ? view0 : view;
            });
          },
          mouseLeave: function(view, event) {
            this.data.modValue(function(view0) {
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
          init: function(params /* data, possibleClasses */) {
            sc.init.call(this, params);
            this.possibleClasses = U.param(params, 'possibleClasses');
            this.data = uf.padam(params, 'data');
          },
          start: function(view) {
          },
          update: function(view) {
            var nextClass = this.data.getValue();
            var classList = view.domRoot.classList;
            if (!nextClass || !classList.contains(nextClass)) {
              
              // Remove all possible classes
              classList.remove.apply(classList, this.possibleClasses); 
              
              // Add the current class
              if (nextClass) classList.add(nextClass);
              
            }
          },
          end: function(view) {
            var classList = view.domRoot.classList;
            classList.remove.apply(classList, this.possibleClasses);
          }
        };}
      }),
      CssDecorator: U.makeClass({ name: 'CssDecorator',
        superclassName: 'Decorator',
        description: 'Dynamically changes css properties on an element',
        methods: function(sc, c) { return {
          init: function(params /* data, properties */) {
            sc.init.call(this, params);
            this.properties = U.param(params, 'properties');
            this.data = uf.padam(params, 'data');
          },
          start: function(view) {
          },
          update: function(view) {
            var nextProps = this.data.getValue();
            var style = view.domRoot.style;
            
            // Calculate the difference...
            for (var i = 0; i < this.properties.length; i++) {
              var prop = this.properties[i];
              var val = (prop in nextProps) ? nextProps[prop] : ''; // Unspecified properties are removed
              if (val !== style[prop]) style[prop] = val; // Only update the style props that have changed
            }
          },
          end: function(view) {
            var style = view.domRoot.style;
            for (var i = 0; i < this.properties.length; i++) style[this.properties[i]] = '';
          }
        };}
      }),
      
      /* VIEW */
      NAME_REGEX: /^[a-z0-9]+[a-zA-Z0-9]*$/,
      View: U.makeClass({ name: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, framesPerTick, cssClasses, onClick, decorators */) {
            this.name = U.param(params, 'name');
            if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
            
            this.cssClasses = U.param(params, 'cssClasses', []);
            this.onClick = U.param(params, 'onClick', null);
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
            while(ptr !== null) {
              ret.push(ptr);
              ptr = ptr.par;
            }
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
            this.domRoot.id = this.getNameChain().join('-');
            
            // Set desired css classes
            this.domRoot.classList.add('_' + this.name);
            for (var i = 0, len = this.cssClasses.length; i < len; i++)
              this.domRoot.classList.add(this.cssClasses[i]);
            
            // Set up any desired click handlers
            if (this.onClick)
              this.domRoot.onclick = this.onClick.bind(this);
            
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
          init: function(params /* name, data */) {
            sc.init.call(this, params);
            this.data = uf.padam(params, 'data');
          },
          
          createDomRoot: function() {
            var ret = document.createElement('span');
            ret.classList.add('_text');
            return ret;
          },
          tick: function(millis) {
            uf.domSetText(this.domRoot, this.data.getValue());
          },
          
          start: function() {
            sc.start.call(this);
            this.data.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.data.stop();
          }
        };}
      }),
      InteractiveView: U.makeClass({ name: 'InteractiveView',
        superclassName: 'View',
        methods: function(sc, c) { return {
          init: function(params /* name, enabledData */) {
            sc.init.call(this, params);
            this.enabledData = uf.padam(params, 'enabledData', true);
          },
          
          tick: function(millis) {
            if (this.enabledData.getValue())
              this.domRoot.classList.remove('_disabled');
            else
              this.domRoot.classList.add('_disabled');
          },
          
          start: function() {
            sc.start.call(this);
            this.enabledData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.enabledData.stop();
          }
        };}
      }),
      InputView: U.makeClass({ name: 'InputView',
        superclassName: 'InteractiveView',
        methods: function(sc, c) { return {
          init: function(params /* name, multiline, initialValue, textData, placeholderData, enabledData */) {
            sc.init.call(this, params);
            this.multiline = U.param(params, 'multiline', false);
            this.textData = uf.padam(params, 'textData', '');
            this.placeholderData = uf.padam(params, 'placeholderData', '');
          },
          
          createDomRoot: function() {
            var ret = document.createElement('div');
            ret.classList.add('_input');
            ret.classList.add(this.multiline ? '_multiline' : '_inline');
            
            var input = document.createElement(this.multiline ? 'textarea' : 'input');
            input.classList.add('_interactive');
            input.oninput = function(e) {
              this.textData.setValue(input.value);
            }.bind(this);
            ret.appendChild(input);
            
            var placeholder = document.createElement('div');
            placeholder.classList.add('_placeholder');
            ret.appendChild(placeholder);
            
            var anim = document.createElement('div');
            anim.classList.add('_anim');
            for (var i = 0; i < 4; i++) {
              var a = document.createElement('div');
              a.classList.add('_a');
              a.classList.add('_a' + (i + 1));
              anim.appendChild(a);
            }
            ret.appendChild(anim);
            
            return ret;
          },
          tick: function(millis) {
            sc.tick.call(this, millis);
            
            var input = this.domRoot.childNodes[0];
            var inputText = this.textData.getValue();
            
            // Update text items
            uf.domSetText(this.domRoot.childNodes[1], this.placeholderData.getValue());
            uf.domSetValue(input, inputText);
            
            // Update the "_empty" class
            if (inputText)  this.domRoot.classList.remove('_empty');
            else             this.domRoot.classList.add('_empty');
            
            // Update the "_focus" class
            if (document.activeElement === input && !this.domRoot.classList.contains('_focus')) {
              this.domRoot.classList.add('_focus');
              var animSet = this.domRoot.childNodes[2].childNodes;
              for (var i = 0, len = animSet.length; i < len; i++) uf.domRestartAnimation(animSet[i]);
            } else if (document.activeElement !== input) {
              this.domRoot.classList.remove('_focus');
            }
          },
          
          start: function() {
            sc.start.call(this);
            this.textData.start();
            this.placeholderData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.textData.stop();
            this.placeholderData.stop();
          }
        };}
      }),
      ActionView: U.makeClass({ name: 'ActionView',
        superclassName: 'InteractiveView',
        methods: function(sc, c) { return {
          init: function(params /* name, $action, textData, enabledData */) {
            sc.init.call(this, params);
            this.$action = U.param(params, '$action');
            this.waiting = false;
            this.textData = uf.padam(params, 'textData');
          },
          
          createDomRoot: function() {
            var button = document.createElement('div');
            button.classList.add('_button');
            button.classList.add('_interactive');
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
            
            uf.domSetText(this.domRoot, this.textData.getValue());
            
            if (this.waiting)  this.domRoot.classList.add('_waiting');
            else               this.domRoot.classList.remove('_waiting');
          },
          
          start: function() {
            sc.start.call(this);
            this.textData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.textData.stop();
          }
        };}
      }),
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
          remChild: function(name) {
            if (!U.isObj(name, String)) name = name.name;
            
            if (!(name in this.children)) return null;
            
            var child = this.children[name];
            child.stop();                // Detach dom
            child.par = null;            // Detach data step 1
            delete this.children[name];  // Detach data step 2
            
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
              ptr.classList.add('_wrap');
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
      ChoiceView: U.makeClass({ name: 'ChoiceView',
        superclassName: 'AbstractSetView',
        methods: function(sc, c) { return {
          init: function(params /* name, choiceData, children */) {
            sc.init.call(this, params);
            
            // Data returning the name of one of the children
            this.choiceData = uf.padam(params, 'choiceData');
            
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
            var choice = this.choiceData.getValue();
            
            if (choice === null) {
              var nextChild = null;
            } else {
              if (!(choice in this.children)) throw new Error('Bad view choice: "' + choice + '"');
              var nextChild = this.children[choice];
            }
            
            if (nextChild !== this.currentChild) {
              if (this.currentChild) {
                this.domRoot.classList.remove('_choose-' + this.currentChild.name);
                this.currentChild.stop();
              }
              this.currentChild = nextChild;
              if (this.currentChild) {
                this.domRoot.classList.add('_choose-' + this.currentChild.name);
              }
            }
          },
          
          start: function() {
            sc.start.call(this);
            this.choiceData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.choiceData.stop();
          }
        };}
      }),
      TextHideView: U.makeClass({ name: 'TextHideView',
        superclassName: 'ChoiceView',
        description: 'A text field that is hidden when its text is empty',
        methods: function(sc, c) { return {
          init: function(params /* name, data */) {
            var data = uf.padam(params, 'data');
            sc.init.call(this, params.update({
              choiceData: new uf.CalculatedData({ getFunc: function() { return data.getValue() ? 'text' : null; } }),
              children: [  new uf.TextView({ name: 'text', data: data })  ]
            }));
          }
        };}
      }),
      DynamicTextView: U.makeClass({ name: 'DynamicTextView',
        superclassName: 'ChoiceView',
        description: 'A text field which is conditionally editable',
        methods: function(sc, c) { return {
          init: function(params /* name, editableData, textData, inputViewParams */) {
            var editableData = uf.padam(params, 'editableData');
            this.textData = uf.padam(params, 'textData');
            var inputViewParams = U.param(params, 'inputViewParams', {});
            sc.init.call(this, params.update({
              choiceData: new uf.CalculatedData({ getFunc: function() { return editableData.getValue() ? 'edit' : 'display'; } }),
              children: [
                new uf.InputView(inputViewParams.update({ name: 'edit', textData: this.textData })),
                new uf.TextView({ name: 'display', data: this.textData })
              ]
            }));
          },
          
          start: function() {
            sc.start.call(this);
            this.textData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.textData.stop();
          }
        };}
      }),
      
      /* COMPLEX VIEW */
      DynamicSetView: U.makeClass({ name: 'DynamicSetView',
        superclassName: 'SetView',
        description: 'A SetView whose children are based on Data. ' +
          'Modifications to the Data instantly modify the children of ' +
          'the DynamicSetView. Adds a 2nd parameter to `addChild`; the ' +
          'raw data that the child was built from.',
        methods: function(sc, c) { return {
          init: function(params /* name, childData, getDataId, genChildView, comparator */) {
            if ('children' in params) throw new Error('Cannot initialize DynamicSetView with `children` param');
            
            sc.init.call(this, params);
            this.childData = uf.padam(params, 'childData');
            //this.getDataId = U.param(params, 'getDataId'), // Returns a unique id for a piece of data (will be used for child.name)
            this.genChildView = U.param(params, 'genChildView'), // function(name, initialRawData, data) { /* generates a View */ };
            this.comparator = U.param(params, 'comparator', null); // TODO: implement!
            
            this.childFullData = {}; // A properly-keyed list of raw data items. The child's name corresponds to the data's key.
            
            this.count = 0;
          },
          
          tick: function(millis) {
            
            var addr = this.getAddress();
            
            var rem = this.children.clone(); // Initially mark all children for removal
            var add = {};  // Initially mark no children for addition
            
            var cd = this.childData.getValue();
            
            for (var k in cd) {
              
              // Unmark for removal
              delete rem[k];
              
              // Mark for addition
              if (!(k in this.children)) add[k] = cd[k];
              
            }
            
            /*
            this.childData.getValue().forEach(function(item, ind) {
              
              // `itemId` is also always the name of the corresponding child
              var itemId = this.getDataId(item);
              
              // Each item in `data` and in `rem` is unmarked for removal
              delete rem[itemId];  
              
              // Each item not in `data` and in `add` is marked for addition
              if (!(itemId in this.children)) add[itemId] = item;
              
            }.bind(this));
            */
            
            // Remove all children as necessary
            for (var k in rem) {
              var child = this.remChild(k);
              delete this.childFullData[child.name];
              
              if (!child) { // TODO: This is just for sanity; should never occur
                console.log(rem, this.getAddress(), this.children);
                throw new Error('Couldn\'t remove child: "' + k + '"');
              }
            }
            
            // Add all children as necessary
            for (var k in add) {
              // `add[k]` is never even accessed; add is coming from `this.childData` which the client should already have access to
              var child = this.genChildView.call(this, k, add[k]); // TODO: Or should `add[k]` be provided here?
              if (child.name !== k) throw new Error('Child named "' + child.name + '" needs to be named "' + k + '"');
              
              var child = this.addChild(child);
              if (!child) throw new Error('DynamicSetView `addChild` failed');
              return child;
            }
            
          },
          
          renameChild: function(view, newName) {
            if (newName in this.children) throw new Error('A child is already named "' + newName + '"; can\'t rename');
            if (!(newName in this.childData.getValue())) throw new Error('Renaming "' + view.name + '" to "' + newName + ' would leave it without any data. Update `childData` before calling `renameChild`.');
            
            this.children[newName] = this.children[view.name];
            delete this.children[view.name];
            
            if (view.domRoot) {
              view.domRoot.classList.remove('_' + view.name);
              view.domRoot.classList.add('_' + newName);
            }
            
            view.name = newName;
          },
          
          start: function() {
            sc.start.call(this);
            this.childData.start();
          },
          stop: function() {
            sc.stop.call(this);
            this.childData.stop();
          }
        };}
      })
      
    };
    
    return uf;
  }
});
package.build();
