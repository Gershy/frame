/// {SERVER=
throw new Error('For client-side use only');
/// =SERVER}

var package = new PACK.pack.Package({ name: 'userify',
  dependencies: [ 'tree', 'dossier', 'informer', 'p' ],
  buildFunc: function(uf, tr, ds, nf, p) {
    var P = p.P;
  
    /* Info */
    uf.pafam = function(params, name, def) {
      return nf.toInfo(U.param(params, name, def));
    };
    
    /* Dom util */
    uf.domSetText = function(elem, text) {
      // TODO: Escaping can occur here
      if (elem.innerHTML !== text) elem.innerHTML = text;
    };
    uf.domSetValue = function(elem, value) {
      if (elem.value !== value) elem.value = value;
    };
    uf.domRestartAnimation = function(elem) {
      elem.style.animation = 'none';
      requestAnimationFrame(function() { elem.style.animation = ''; }, 10);
    };
    uf.domAddListener = function(elem, type, func) {
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
    };
    uf.domRemListener = function(elem, type, func) {
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
    };
    uf.domEventNode = function(event) {
      
      return event.target;
      
    };
    uf.domEventView = function(event) {
      
      var node = uf.domEventNode(event);
      while (node && !node['~view']) node = node.parentNode;
      return node ? node['~view'] : null;
      
    };
    
    /* Decorator */
    uf.Decorator = U.makeClass({ name: 'Decorator',
      methods: function(sc, c) { return {
        init: function(params /* */) {
          this.id = U.id(c.NEXT_ID++);
        },
        getAllInformers: function() { return []; },
        update: function(view) { },
        start: function(view) {
          
          // TODO: Avoid (many invalidations from any number of Informers) causing (multiple updates per frame)
          // OR is the real solution to avoid many invalidations??
          
          var updateView = view['~' + this.id + '.update'] = this.update.bind(this, view);
          A.each(this.getAllInformers(), function(inf) {
            inf.addWorry('invalidated', updateView);
            updateView(inf.getValue()); // Initially update!
          });
          
        },
        stop: function(view) {
          
          var updateView = view['~' + this.id + '.update'];
          delete view['~' + this.id + '.update'];
          A.each(this.getAllInformers(), function(inf) { inf.remWorry('invalidated', updateView); });
          
        }
      };},
      statik: {
        NEXT_ID: 0
      }
    });
    uf.ClassDecorator = U.makeClass({ name: 'ClassDecorator', superclass: uf.Decorator,
      description: 'Dynamically changes html classes on an element',
      methods: function(sc, c) { return {
        
        init: function(params /* informer, list */) {
          
          sc.init.call(this, params);
          this.list = U.param(params, 'list');
          this.informer = uf.pafam(params, 'informer');
          
        },
        getAllInformers: function() {
          
          return [ this.informer ];
          
        },
        update: function(view) {
          
          var nextClasses = this.informer.getValue();
          if (nextClasses !== null && !U.isObj(nextClasses, Array)) nextClasses = [ nextClasses ];
          
          var classList = view.domRoot.classList;
          classList.remove.apply(classList, this.list); 
          
          if (!nextClasses) return;
          
          for (var i = 0, len = nextClasses.length; i < len; i++)
            classList.add(nextClasses[i]);
          
          
          /*if (nextClass === null || !classList.contains(nextClass)) {
            
            // Remove all classes, then apply current one
            if (nextClass !== null) classList.add(nextClass);
            
          }*/
          
        },
        start: function(view) {
          
          sc.start.call(this, view);
          
        },
        stop: function(view) {
          
          if (view.domRoot) {
            var classList = view.domRoot.classList;
            classList.remove.apply(classList, this.list);
          }
          
          sc.stop.call(this, view);
          
        }
        
      };}
    });
    uf.CssDecorator = U.makeClass({ name: 'CssDecorator', superclass: uf.Decorator,
      description: 'Dynamically changes inline css properties on an element',
      methods: function(sc, c) { return {
        init: function(params /* list, info */) {
          sc.init.call(this, params);
          this.list = U.param(params, 'list');
          this.informer = uf.pafam(params, 'informer');
        },
        getAllInformers: function() {
          return [ this.informer ];
        },
        update: function(view) {
          
          var nextProps = this.informer.getValue(view.domRoot);
          var style = view.domRoot.style;
          
          // Calculate the difference...
          for (var i = 0; i < this.list.length; i++) {
            var prop = this.list[i];
            var val = (prop in nextProps) ? nextProps[prop] : ''; // Unspecified properties are removed
            if (val !== style[prop]) style[prop] = val; // Only update the style props that have changed
          }
          
        },
        start: function(view) {
          
          sc.start.call(this, view);
          
        },
        stop: function(view) {
          
          if (view.domRoot) {
            var style = view.domRoot.style;
            for (var i = 0; i < this.list.length; i++) style[this.list[i]] = '';
          }
          
          sc.stop.call(this, view);
          
        }
      };}
    });
    uf.FuncDecorator = U.makeClass({ name: 'FuncDecorator', superclass: uf.Decorator,
      description: 'Perform arbitrary actions in `Decorator` context',
      methods: function(sc, c) { return {
        init: function(params /* func */) {
          this.func = U.param(params, 'func');
        },
        update: function(view) {
          
          this.func(view);
          
        },
        start: function(view) {
          
          sc.start.call(this, view);
          
        },
        stop: function(view) {
          
          sc.stop.call(this, view);
          
        }
      };}
    });
    
    /* Input Decorators */
    uf.ActionDecorator = U.makeClass({ name: 'ActionDecorator', superclass: uf.Decorator,
      description: 'Perform an asynchronous action on interaction',
      methods: function(sc, c) { return {
        init: function(params /* $action, action */) {
          sc.init.call(this, params);
          
          var $action = U.param(params, '$action', null);
          var action = U.param(params, 'action', null);
          
          if (!!$action === !!action) throw new Error('Need to supply exactly one of "$action" and "action"');
          
          this.$action = action
            ? function() { action(); return p.$null; }
            : $action;
          
          this.loadingInfo = new nf.ValueInformer({ value: false });
          
        },
        doAction: function(view, event) {
          
          if (this.loadingInfo.getValue()) return; // The action is already pending
          
          var pass = this;
          this.loadingInfo.setValue(true);
          this.$action(event, view).then(function() {
            pass.loadingInfo.setValue(false);
          }).done();
          
        },
        isLoading: function() {
          return this.loadingInfo.getValue();
        },
        start: function(view) {
          
          sc.start.call(this, view);
          
          if (view['~' + this.id + '.click'])
            throw new Error('View ' + view.name + ' already has handler!!! :(');
          
          view.domRoot.setAttribute('tabindex', 0);
          view['~' + this.id + '.click'] = this.doAction.bind(this, view);
          uf.domAddListener(view.domRoot, 'onclick', view['~' + this.id + '.click']);
          
        },
        stop: function(view) {
          
          if (view.domRoot) {
            view.domRoot.removeAttribute('tabindex');
            uf.domRemListener(view.domRoot, 'onclick', view['~' + this.id + '.click']);
          }
          
          delete view['~' + this.id + '.click'];
          
          sc.stop.call(this, view);
          
        }
      };}
    });
    uf.HoverDecorator = U.makeClass({ name: 'HoverDecorator', superclass: uf.Decorator,
      description: 'Manipulates "hoverActive and "hoverInactive" classes. Differs ' +
        'from css :hover pseudoclass in that it applies to only the single element, ' +
        'and will not respond to events which have bubbled from children',
      methods: function(sc, c) { return {
        init: function(params /* onClassName, delayClassName, offClassName, includeDepth, offDelay */) {
          
          sc.init.call(this, params);
          
          this.onClassName = U.param(params, 'onClassName', 'hoverActive');
          this.delayClassName = U.param(params, 'delayClassName', 'hoverEnding');
          this.offClassName = U.param(params, 'offClassName', 'hoverInactive');
          this.includeDepth = U.param(params, 'includeDepth', 0); // If the hover occurs on a child, consider it a hover at this depth
          this.offDelay = U.param(params, 'offDelay', 0); // Amount of time to delay class change after mouse exits
          this.offTimeout = null;
          
        },
        
        start: function(view) {
          
          sc.start.call(this, view);
          
          // TODO: Could consider only adding the mouseout event after mouseover occurs
          var mouseOver = view['~' + this.id + '.mouseOver'] = c.mouseOver.bind(this, view);
          var mouseOut = view['~' + this.id + '.mouseOut'] = c.mouseOut.bind(this, view);
          
          uf.domAddListener(view.domRoot, 'onmouseover', mouseOver);
          uf.domAddListener(view.domRoot, 'onmouseout', mouseOut);
          
        },
        stop: function(view) {
          
          uf.domRemListener(view.domRoot, 'onmouseover', view['~' + this.id + '.mouseOver']);
          uf.domRemListener(view.domRoot, 'onmouseout', view['~' + this.id + '.mouseOut']);
          
          delete view['~' + this.id + '.mouseOver'];
          delete view['~' + this.id + '.mouseOut'];
          
          sc.stop.call(this, view);
          
        }
      }},
      statik: {
        mouseOver: function(view, event) {
          
          var eventView = uf.domEventView(event);
          var withinDepth = eventView === view;
          for (var i = 0; i < this.includeDepth && !withinDepth && eventView; i++) {
            eventView = eventView.par;
            if (eventView === view) withinDepth = true;
          }
          
          if (withinDepth) {
            view.domRoot.classList.remove(this.offClassName);
            view.domRoot.classList.remove(this.delayClassName);
            view.domRoot.classList.add(this.onClassName);
            clearTimeout(this.offTimeout);
          }
          
        },
        mouseOut: function(view, event) {
          
          if (this.offDelay) {
            
            view.domRoot.classList.add(this.delayClassName);
            setTimeout(function() {
              view.domRoot.classList.remove(this.onClassName);
              view.domRoot.classList.remove(this.delayClassName);
              view.domRoot.classList.add(this.offClassName);
            }.bind(this), this.offDelay);
            
          } else {
            
            view.domRoot.classList.remove(this.onClassName);
            view.domRoot.classList.add(this.offClassName);
            
          }
          
        }
      }
    });
    
    /* // TODO: POINTER DECORATORS; move these to a new package???
    
    // TODO: A Decorator to combine dragging + clicking? These 2 features are probably
    // usually desirable together, and annoying to implement independently
    
    uf.PointerDecorator = U.makeClass({ name: 'PointerDecorator', superclass: uf.Decorator,
      description: 'Generic class for decorators which deal with pointer actions; ' +
        'e.g. click, mouseover, drag, etc.',
      methods: function(sc, c) { return {
        init: function(params /* validTargets * /) {
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
          * /
          this.validTargets = U.param(params, 'validTargets', []);
        },
        validTarget: function(view, target) {
          // Returns true if `validTargets` is empty, the target is the view's root, or the target matches any selector
          return !this.validTargets.length
            || view.domRoot === target
            || this.validTargets.any(function(sel) { return target.matches(sel); });
        }
      };}
    });
    uf.ClickDecorator = U.makeClass({ name: 'ClickDecorator', superclass: uf.PointerDecorator,
      methods: function(sc, c) { return {
        init: function(params /* action, validTargets * /) {
          sc.init.call(this, params);
          
          this.action = U.param(params, 'action', null);
          this.info = new uf.SimpleInfo({ value: false });
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
    });
    uf.DragDecorator = U.makeClass({ name: 'DragDecorator', superclass: uf.PointerDecorator,
      methods: function(sc, c) { return {
        init: function(params /* tolerance, validTargets, captureOnStart * /) {
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
            capturedInfo: this.captureOnStart ? this.captureOnStart(view) : null,
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
              // TODO: This is when the drag really starts; should consider updating `pt1` and `capturedInfo`
              info.drag = true;
            }
            
            info.lastDragMs = +new Date();
            
            return info;
          }.bind(this));
          
          event.preventDefault(); // Stops annoying highlighting. TODO: Should this be optional?
        }
      }
    });
    uf.DragActionDecorator = U.makeClass({ name: 'DragActionDecorator', superclass: uf.Decorator,
      methods: function(sc, c) { return {
        init: function(params /* dragDecorator, action({ target, dropZone }) * /) {
          sc.init.call(this, params);
          this.dragDecorator = U.param(params, 'dragDecorator');
          this.action = U.param(params, 'action');
          this.info = uf.toInfo(null);
        },
        createClassDecorator: function(view) {
          return new uf.ClassDecorator({
            list: [ 'dragHover' ],
            informer: function(view) { return this.info.getValue() === view ? 'dragHover' : null; }.bind(this, view)
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
          
          // It's possible `dropZone` is null if the mouseup is occurring, but not as the final step of a drag action
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
    });
    */
    
    /* // TODO: FORM DECORATORS; move these to a new package???
    
    uf.FormDecorator = U.makeClass({ name: 'FormDecorator', superclass: uf.Decorator,
      methods: function(sc, c) { return {
        init: function(params /* * /) {
          sc.init.call(this, params);
          
          this.inputs = [];
          this.submits = [];
        },
        genInputDecorator: function(validateFunc) {
          var ret = new uf.FormInputDecorator({ form: this, validateFunc: validateFunc || null });
          this.inputs.push(ret);
          return ret;
        },
        genSubmitDecorator: function($action) {
          if (!$action) throw new Error('Must provide an $action promise-func');
          
          var ret = new uf.FormSubmitDecorator({ $action: $action, form: this });
          this.submits.push(ret);
          return ret;
        },
        getErrorText: function() {
          for (var i = 0; i < this.inputs.length; i++) if (this.inputs[i].errorText) return this.inputs[i].errorText;
          return null;
        },
        start: function(view) {
        },
        stop: function(view) {
        }
      };}
    });
    uf.FormInputDecorator = U.makeClass({ name: 'FormInputDecorator', superclass: uf.Decorator,
      methods: function(sc, c) { return {
        init: function(params /* form, validateFunc * /) {
          sc.init.call(this, params);
          
          this.form = U.param(params, 'form');
          this.validateFunc = U.param(params, 'validateFunc', null);
          this.valConcern = c.valConcern.bind(this);
          this.errorText = null;
        },
        genErrorView: function(name) {
          var pass = this;
          return new uf.TextHideView({ name: name || 'error', info: function() { return pass.errorText; } });
        },
        start: function(view) {
          view['~' + this.id + '.keyPress'] = c.keyPress.bind(this, view);
          uf.domAddListener(view.domRoot.getElementsByClassName('interactive')[0], 'onkeydown', view['~' + this.id + '.keyPress']);
          
          if (this.validateFunc) view.info.addWorry('value', this.valConcern);
        },
        stop: function(view) {
          if (this.validateFunc) view.info.remWorry('value', this.valConcern);
          
          if (view.domRoot) {
            var interactive = view.domRoot.getElementsByClassName('interactive')[0];
            if (interactive) uf.domRemListener(interactive, 'onkeydown', view['~' + this.id + '.keyPress']);
          }
          delete view['~' + this.id + '.keyPress'];
        }
      };},
      statik: {
        keyPress: function(view, event) {
          if (this.form.submits.length && event.keyCode === 13) this.form.submits[0].doAction(view, event);
        },
        valConcern: function(val) {
          this.errorText = this.validateFunc(val);
        }
      }
    });
    uf.FormSubmitDecorator = U.makeClass({ name: 'FormSubmitDecorator', superclass: uf.ActionDecorator,
      methods: function(sc, c) { return {
        init: function(params /* $action * /) {
          this.form = U.param(params, 'form');
          
          var pass = this;
          var $action = U.param(params, '$action');
          sc.init.call(this, O.update(params, { $action: function(event) {
            var errorText = pass.form.getErrorText();
            return errorText
              ? new P({ value: null }) // new P({ err: new Error(errorText) }) // What happens if there's an error on submission? Probably nothing?
              : $action(event);
          }}));
        }
      };}
    });
    */
    
    /* VIEW */
    // TODO: `update` should not need to check for `start`. `start` should be called by an outside source.
    // `update` ruins `start`/`stop` symmetry
    uf.NAME_REGEX = /^[a-z0-9]+[a-zA-Z0-9]*$/;
    uf.View = U.makeClass({ name: 'View', mixins: [ tr.TreeNode ],
      resolvers: {
        init: function(initConflicts, params) {
          initConflicts.TreeNode.call(this, params);
          initConflicts.View.call(this, params);
        }
      },
      methods: function(sc, c) { return {
        
        init: function(params /* name, cssId, cssClasses, decorators */) {
          if (!uf.NAME_REGEX.test(this.name)) throw new Error('Illegal View name: "' + this.name + '"');
          
          // `this.cssId` allows html id generation to begin from such a value, instead of including the entire heirarchy chain
          this.cssId = U.param(params, 'cssId', null);
          
          this.cssClasses = U.param(params, 'cssClasses', []);
          this.decorators = U.param(params, 'decorators', []);
          
          this.domRoot = null;
          this.started = false;
        },
        getNamedChild: function(addr) { return null; },
        
        // DOM
        getHtmlId: function() {
          if (this.cssId) return this.cssId;
          return (this.par ? this.par.getHtmlId() + '-' : '') + this.name;
        },
        initDomRoot: function() {
          if (this.domRoot === null) {
            this.domRoot = this.createDomRoot();
            this.domRoot['~view'] = this;
          }
          return this.domRoot;
        },
        createDomRoot: function() {
          return document.createElement('div');
        },
        
        getAllInformers: function() {
          
          return {
          };
          
        },
        
        start: function() {
          
          // TODO: Would be nice to simply ensure that `start` is never called on
          // Views which are already started. At the time this seemed tricky;
          // DynamicSetView regularly tried to start already-started Views
          if (this.started) return;
          this.started = true;
          this.start0();
          
        },
        stop: function() {
          
          if (!this.started) return;
          this.started = false;
          this.stop0();
          
        },
        
        start0: function() {
          
          this.initDomRoot();
          
          // Set the id property
          var htmlId = this.getHtmlId();
          if (htmlId.length < 40) this.domRoot.id = htmlId;
          
          // Set desired css classes
          this.domRoot.classList.add(isNaN(this.name[0]) ? this.name : ('_' + this.name));
          for (var i = 0, len = this.cssClasses.length; i < len; i++) this.domRoot.classList.add(this.cssClasses[i]);
          
          if (this.par) this.par.provideContainer(this).appendChild(this.domRoot);
          
          // Now `this.domRoot` is fully initialized!
          
          // Add worries for all informers
          var infs = this.getAllInformers();
          
          for (var infTerm in infs) {
            
            var funcName = 'on' + infTerm[0].toUpperCase() + infTerm.substr(1) + 'Change';
            this['~inf.' + infTerm] = this[funcName].bind(this);
            infs[infTerm].addWorry('invalidated', this['~inf.' + infTerm]);
            
          }
          
          // After all worries are attached simulate them all invalidating to obtain a nice initial state
          for (var infTerm in infs) this['~inf.' + infTerm](infs[infTerm].getValue());
          
          // Apply all decorators
          for (var i = 0, len = this.decorators.length; i < len; i++) {
            this.decorators[i].start(this);  // Make any initial changes
            this.decorators[i].update(this); // Perform the first update immediately
          }
          
        },
        stop0: function() {
          
          // Remove all decorators
          for (var i = 0, len = this.decorators.length; i < len; i++) this.decorators[i].stop(this);
          
          // Remove all worries
          var infs = this.getAllInformers();
          for (var infTerm in infs) {
            infs[infTerm].remWorry('invalidated', this['~inf.' + infTerm]);
            delete this['~inf.' + infTerm];
          }
          
          if (this.domRoot && this.domRoot.parentNode) this.domRoot.parentNode.removeChild(this.domRoot);
          this.domRoot = null;
          
        }
        
      };}
    });
    uf.HtmlView = U.makeClass({ name: 'HtmlView', superclass: uf.View,
      methods: function(sc, c) { return {
        init: function(params /* name, cssId, cssClasses, decorators, html */) {
          sc.init.call(this, params);
          this.html = U.param(params, 'html');
        },
        createDomRoot: function() {
          var ret = sc.createDomRoot.call(this);
          ret.innerHTML = this.html;
          return ret;
        }
      };}
    });
    uf.TextView = U.makeClass({ name: 'TextView', superclass: uf.View,
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
        
        onTextChange: function() {
          var text = this.info.getValue();
          if (text === null) text = '';
          text = text.toString();
          uf.domSetText(this.domRoot, text);
        },
        
        getAllInformers: function() {
          return O.update(sc.getAllInformers.call(this), {
            text: this.info
          });
        }
        
      };}
    });
    uf.InteractiveView = U.makeClass({ name: 'InteractiveView', superclass: uf.View,
      methods: function(sc, c) { return {
        
        init: function(params /* name, enabledInfo */) {
          sc.init.call(this, params);
          this.enabledInfo = uf.pafam(params, 'enabledInfo', true);
        },
        
        onEnabledChange: function() {
          var action = this.enabledInfo.getValue() ? 'remove' : 'add';
          this.domRoot.classList[action]('disabled');
        },
        
        getAllInformers: function() {
          return O.update(sc.getAllInformers.call(this), {
            enabled: this.enabledInfo
          });
        }
        
      };}
    });
    uf.TextEditView = U.makeClass({ name: 'TextEditView', superclass: uf.InteractiveView,
      methods: function(sc, c) { return {
        
        init: function(params /* name, multiline, info, placeholderInfo, enabledData */) {
          sc.init.call(this, params);
          this.multiline = U.param(params, 'multiline', false);
          this.info = uf.pafam(params, 'info', '');
          this.placeholderInfo = uf.pafam(params, 'placeholderInfo', '');
        },
        
        createDomRoot: function() {
          
          var ret = document.createElement('div');
          ret.classList.add('input');
          ret.classList.add(this.multiline ? 'multiline' : 'inline');
          
          var input = document.createElement(this.multiline ? 'textarea' : 'input');
          input.classList.add('interactive');
          input.oninput = function(e) { this.info.setValue(input.value); }.bind(this); // TODO: Have to ensure that the string is being set in the DOM before being set in the Informer - otherwise LOOPS when typing
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
          
          // Set up listeners to apply the "focus" class
          uf.domAddListener(input, 'onfocus', function() {
            if (!ret.classList.contains('focus')) {
              ret.classList.add('focus');
              for (var i = 0, len = anim.childNodes.length; i < len; i++) uf.domRestartAnimation(anim.childNodes[i]);
            }
          });
          
          uf.domAddListener(input, 'onblur', function() {
            ret.classList.remove('focus');
          });
          
          return ret;
          
        },
        
        onTextChange: function() {
          
          var inputElem = this.domRoot.childNodes[0];
          var inputVal = this.info.getValue();
          if (inputVal === null) inputVal = '';
          inputVal = inputVal.toString(); // Ensure it's a string
          uf.domSetValue(inputElem, inputVal);
          
          if (inputVal.length)  this.domRoot.classList.remove('empty');
          else                  this.domRoot.classList.add('empty');
          
        },
        onPlaceholderChange: function() {
          
          var placeholderElem = this.domRoot.childNodes[1];
          uf.domSetText(placeholderElem, this.placeholderInfo.getValue());
          
        },
        
        getAllInformers: function() {
          
          return O.update(sc.getAllInformers.call(this), {
            text: this.info,
            placeholder: this.placeholderInfo
          });
          
        }
        
      };}
    });
    
    /* SET VIEW */
    uf.AbstractSetView = U.makeClass({ name: 'AbstractSetView', superclass: uf.View,
      methods: function(sc, c) { return {
        
        init: function(params /* name, children */) {
          sc.init.call(this, params);
          this.children = {};
          this.addChildren(U.param(params, 'children', []));
        },
        
        getNamedChild: function(addr) { return this.children[addr]; },
        addChildren: function(children) {
          for (var i = 0, len = children.length; i < len; i++) this.addChild(children[i]);
        },
        addChild: function(child) {
          
          if (child.par === this) return child;
          
          if (child.par !== null) throw new Error('Tried to add View with parent: ' + child.getAddress());
          if (O.contains(this.children, child.name)) throw new Error('Already have a child named "' + child.name + '"');
          
          child.par = this;
          this.children[child.name] = child;
          if (this.started) child.start();
          
          return child;
          
        },
        addChildHead: function(child) {
          
          this.addChild(child);
          delete this.children[child.name];
          
          var head = {};
          head[child.name] = child;
          
          this.children = O.update(head, this.children);
          
        },
        remChild: function(child) {
          
          // Resolve string to child
          if (U.isObj(child, String)) child = this.children[child];
          
          if (!child || this.children[child.name] !== child) return null;
          
          child.stop(); // Detach dom
          child.par = null; // Detach info step 1
          delete this.children[child.name]; // Detach info step 2
          
          return child;
          
        },
        provideContainer: function() {
          throw new Error('not implemented');
        },
        
        autoStartChildren: function() {
          return true;
        },
        start0: function() {
          sc.start0.call(this);
          if (this.autoStartChildren())
            for (var k in this.children) this.children[k].start();
        },
        stop0: function() {
          for (var k in this.children) this.children[k].stop();
          sc.stop0.call(this);
        }
        
      };}
    });
    uf.SetView = U.makeClass({ name: 'SetView', superclass: uf.AbstractSetView,
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
            ptr.classList.add('wrapper');
            ptr.classList.add('wrapper' + i);
          }
          return ret;
        },
        provideContainer: function() {
          var ret = this.domRoot;
          for (var i = 0, len = this.numWrappers; i < len; i++) ret = ret.childNodes[0];
          return ret;
        }
        
      };}
    });
    uf.RootView = U.makeClass({ name: 'RootView', superclass: uf.SetView,
      description: '',
      methods: function(sc, c) { return {
        
        start0: function() {
          
          this.domRoot = this.createDomRoot();
          document.body.appendChild(this.domRoot);
          sc.start0.call(this);
          
          this.update(); // Immediately update once
          
        },
        stop0: function() {
          
          if (this.domRoot) document.body.removeChild(this.domRoot);
          sc.stop0.call(this);
          
        }
        
      };}
    });
    uf.ChoiceView = U.makeClass({ name: 'ChoiceView', superclass: uf.AbstractSetView,
      methods: function(sc, c) { return {
        
        init: function(params /* name, choiceInfo, transitionTime, children */) {
          
          sc.init.call(this, params);
          
          // Info returning the name of one of the children
          this.choiceInfo = uf.pafam(params, 'choiceInfo');
          
          // Allow for transitions by maintaining removed elements for this amount of time
          this.transitionTime = U.param(params, 'transitionTime', 0);
          
          // Property to keep track of the currently active child
          this.currentChild = null;
          
        },
        
        provideContainer: function() {
          return this.domRoot;
        },
        onChoiceChange: function() {
          
          var choice = this.choiceInfo.getValue();
          
          if (choice === null) {
            var nextChild = null;
          } else {
            if (!O.contains(this.children, choice)) throw new Error('Bad view choice: "' + choice + '"');
            var nextChild = this.children[choice];
          }
          
          if (nextChild !== this.currentChild) {
            
            if (this.currentChild) {
              
              this.domRoot.classList.remove('choose-' + this.currentChild.name);
              
              if (this.transitionTime) {
                
                this.currentChild.domRoot.classList.add('choiceRemoved');
                setTimeout(this.currentChild.stop.bind(this.currentChild), this.transitionTime);
                
              } else {
              
                this.currentChild.stop();
                
              }
              
            }
            
            this.currentChild = nextChild;
            if (this.currentChild) {
              this.domRoot.classList.add('choose-' + this.currentChild.name);
              this.currentChild.start();
            }
            
          }
          
        },
        getAllInformers: function() {
          
          return O.update(sc.getAllInformers.call(this), {
            choice: this.choiceInfo
          });
          
        },
        autoStartChildren: function() { return false; }
        
      };}
    });
    
    /* TODO: Probably makes more sense to compose these with Views+Decorators
    
    uf.TextHideView = U.makeClass({ name: 'TextHideView', superclass: uf.ChoiceView,
      description: 'A text field that is hidden when its text is empty',
      methods: function(sc, c) { return {
        init: function(params /* name, info * /) {
          var info = uf.pafam(params, 'info');
          sc.init.call(this, O.update(params, {
            choiceInfo: nf.toInfo(function() { return info.getValue() ? 'text' : null; }),
            children: [  new uf.TextView({ name: 'text', info: info })  ]
          }));
        }
      };}
    });
    
    uf.DynamicTextEditView = U.makeClass({ name: 'DynamicTextEditView', superclass: uf.ChoiceView,
      description: 'A text field which is conditionally editable',
      methods: function(sc, c) { return {
        init: function(params /* name, editableData, info, inputViewParams * /) {
          
          var editableData = uf.pafam(params, 'editableData');
          this.info = uf.pafam(params, 'info');
          var inputViewParams = U.param(params, 'inputViewParams', {});
          
          
          
          sc.init.call(this, O.update(params, {
            choiceInfo: nf.toInfo(function() { return editableData.getValue() ? 'edit' : 'display'; }),
            children: [
              new uf.TextEditView(O.update(inputViewParams, { name: 'edit', info: this.info })),
              new uf.TextView({ name: 'display', info: this.info })
            ]
          }));
          
        }
      };}
    });
    
    */
    
    uf.DynamicSetView = U.makeClass({ name: 'DynamicSetView', superclass: uf.SetView,
      description: 'A SetView whose children are based on Info. ' +
        'Modifications to the Info instantly modify the children of ' +
        'the DynamicSetView. Adds a 2nd parameter to `addChild`; the ' +
        'raw info that the child was built from.',
      methods: function(sc, c) { return {
        
        init: function(params /* name, childInfo, genChildView, transitionTime */) {
          
          if (O.contains(params, 'children')) throw new Error('Cannot initialize DynamicSetView with `children` param');
          
          // TODO: "comparator" for ordering children dynamically
          
          sc.init.call(this, params);
          this.childInfo = uf.pafam(params, 'childInfo');
          this.genChildView = U.param(params, 'genChildView'), // function(name, initialRawData, info) { /* generates a View */ };
          this.transitionTime = U.param(params, 'transitionTime', 0);
          
        },
        
        onChildrenChange: function(cd) {
          
          /*
          Fully compares `this.children` to `this.childInfo.getValue()`
          Adds/removes any elements in `this.children` based on their
          existence in `this.childInfo`. Returns values showing which
          children were added and which were removed.
          */
          
          var rem = this.children.clone(); // Initially mark all children for removal
          var add = {};  // Initially mark no children for addition
          
          if (!cd) cd = this.childInfo.getValue();
          
          for (var k in cd) {
            
            // Unmark for removal
            delete rem[k];
            
            // Mark for addition
            if (!O.contains(this.children, k)) add[k] = cd[k];
            
          }
          
          // Remove all children as necessary
          for (var k in rem) {
            
            if (this.transitionTime) {
              this.children[k].domRoot.classList.add('dynamicRemove');
              setTimeout(this.remChild.bind(this, k), this.transitionTime);
            } else {
              this.remChild(k);
            }
            
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
          
          if (O.contains(this.children, newName)) throw new Error('A child is already named "' + newName + '"; can\'t rename');
          if (!O.contains(this.childInfo.getValue(), newName)) throw new Error('Renaming "' + view.name + '" to "' + newName + ' would leave it without any info. Update `childInfo` before calling `renameChild`.');
          
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
        
        getAllInformers: function() {
          
          return O.update(sc.getAllInformers.call(this), {
            children: this.childInfo // TODO: `onChildrenChange` has a `cd` param; what is being passed from here?
          });
          
        },
        stop0: function() {
          
          /*
          Here we update as if `this.childInfo` returned an empty set.
          
          This fixes a very particular error: A `DynamicSetView` was linked to a text submission.
          This text submission gets keyed under a username (a value which probably doesn't change
          between submissions). Submitting immediately hid the `DynamicSetView` (calling `stop`),
          so that it was no longer checking for child updates. By the time the `DynamicSetView`
          reappeared, the submission under the username had gone from non-existant to the new
          submission, but because the `DynamicSetView` had been stopped it never had an
          opportunity to purge the old submission. Because of this, and because the key of the new
          submission was the same as the key of the old submission, the `DynamicSetView` used the
          cached, old value at the key instead of calling `genChildView` to generate a new element
          based on the new submission.
          
          This problem is now solved by always removing all cached elements by calling
          `onChildrenChange` with an empty set. This makes it impossible for a `DynamicSetView` to
          maintain an invalid value by missing a more recent one.
          
          TODO: A further consideration: a `hasInfoChanged` parameter, allowing the
          `DynamicSetView` to detect changes on its children and call `genChildView` as required.
          */
          
          var kids = O.clone(this.children);
          for (var k in kids) this.remChild(k);
          // for (var k in this.children) this.remChild(this.children[k]);
          sc.stop0.call(this);
          
        }
      
      };}
    })
    
  }
});
package.build();
