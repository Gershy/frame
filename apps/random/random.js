var package = new PACK.pack.Package({ name: 'random',
	dependencies: [ 'uth' ],
	buildFunc: function() {
		return {
			Random: PACK.uth.makeClass({ name: 'Random',
				propertyNames: [ 'seed', ],
				methods: {
					init: function(params /* seed */) {
						// TODO: this.seed is being ignored!!!
						this.seed = U.param(params, 'seed', null);
					},
					randFloat: function() {
						return Math.random();
					},
					randInt: function(params /* hi, lo */) {
						var hi = U.param(params, 'hi');
						var lo = U.param(params, 'lo', 0);
						return lo + Math.floor(this.randFloat() * (hi - lo));
					},
					randElem: function(arr) {
						return arr[this.randInt({ hi: arr.length })];
					},
				},
			}),
			def: null,
			getDefault: function() {
				if (PACK.random.def === null) PACK.random.def = new PACK.random.Random();
				return PACK.random.def;
			}
		};
	},
});
package.build();
