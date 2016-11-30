var package = new PACK.pack.Package({ name: 'userify',
	dependencies: [ 'uth', 'quickDev' ],
	buildFunc: function() {
		var namespace = {};
		
		return {
			Data: PACK.uth.makeClass({ name: 'Data', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* value */) {
						this.value = U.param(params, 'value', null);
					}
				};}
			}),
			DataArr: PACK.uth.makeClass({ name: 'DataArr', namespace: namespace,
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* value */) {
						sc.init.call(this, params);
						this.children = [];
					}
				};}
			}),
			DataMap: PACK.uth.makeClass({ name: 'DataMap', namespace: namespace,
				superclassName: 'Data',
				methods: function(sc, c) { return {
					init: function(params /* value */) {
						sc.init.call(this, params);
						this.children = {};
					}
				};}
			}),
			
			Experience: PACK.uth.makeClass({ name: 'Experience', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* name, data, manager, expand */) {
						this.name = U.param(params, 'name');
						this.data = U.param(params, 'data');
						this.manager = U.param(params, 'manager');
						this.expand = U.param(params, 'expand', true);
						this.par = null;
						this.children = {};
					},
					activate0: function() {
						throw new Error('not implemented');
					},
					activate: function() {
						this.activate0();
						
						if (this.expand) {
							
						}
					}
				};}
			}),
			HtmlExperience: PACK.uth.makeClass({ name: 'HtmlExperience', namespace: namespace,
				superclassName: 'Experience',
				methods: function(sc, c) { return {
					init: function(params /* name, data, manager, expand, initElem, updateElem */) {
						sc.init.call(this, params);
						this.initElem = U.param(params, 'initElem');
						this.updateElem = U.param(params, 'updateElem', null);
						this.elem = null;
					},
					activate: function() {
						this.elem = this.initElem(this.data);
						this.updateElem(this.elem, this.data);
						
						(this.par === null ? document.getElementByTagName('body')[0] : this.par.elem).appendChild(this.elem);
					}
				};}
			}),
			
			ExperienceManager: PACK.uth.makeClass({ name: 'ExperienceManager', namespace: namespace,
				methods: function(sc, c) { return {
					init: function(params /* makeData */) {
						this.makeData = U.param(params, 'makeData');
						this.makeExperience = U.param(params, 'makeExperience');
					},
					getExperience: function(params /* name, rawData */) {
						var name = U.param(params, 'name', 'root');
						var rawData = U.param(params, 'rawData');
						
						return this.makeExperience({
							name: name,
							data: this.makeData(rawData),
							manager: this
						});
					}
				};}
			}),
			
			queryHandler: new PACK.quickDev.QDict({ name: 'app' })
		};
	},
	runAfter: function() {
		var makeData = function(item) {
			if (PACK.uth.instanceOf(input, Array)) {
				var ret = new PACK.userify.DataArr({ value: item });
				for (var i = 0; i < input.length; i++) ret.children.push(makeData(input[i]));
			} else if (PACK.uth.instanceOf(input, Object)) {
				var ret = new PACK.userify.DataMap({ value: item });
				for (var k in item) ret.children[k] = makeData(item[k]);
			} else {
				var ret = new PACK.userify.Data({ value: item });
			}
			return ret;
		};
		var manager = new PACK.userify.ExperienceManager({
			makeData: makeData,
			makeExperience: function(params) {
				return U.param({
					
					
				}, params.name, function() {
					return new HtmlExperience(params.update({
						initElem: function(data) {
							var elem = document.createElement('div');
							elem.setAttribute('class', 'exp');
							elem.innerHTML = 'default 0';
							return elem;
						},
						updateElem: function(elem, data) {
							elem.innerHTML = 'default' + (parseInt(elem.innerHTML.substr(8)) + 1).toString();
						}
					}));
				})();
			}
		});
		var exp = manager.getExperience();
	}
});
package.build();
	
