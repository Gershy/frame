var package = new PACK.pack.Package({ name: 'permute',
	buildFunc: function() { 
		return {
			Permute: U.makeClass({ name: 'Permute',
				methods: function(sc, c) { return {
					init: function(params /* limits */) {
						this.limits = U.param(params, 'limits');
						this.vals = null; // U.toArray(this.limits.length, 0);
					},
					increment: function(params /* ind */) {
						var ind = U.param(params, 'ind', 0);
						
						if (this.vals) {
						
							while (++this.vals[ind] >= this.limits[ind]) {
								this.vals[ind] = 0;
								if (++ind >= this.limits.length) { this.vals = null; return false; }
							}
						
						} else {
							
							this.vals = U.toArray(this.limits.length, 0);
							
						} 
						
						return this.vals;
					},
					full: function() {
						for (var i = 0; i < this.limits.length; i++) if (this.vals[i] < (this.limits[i] - 1)) return false;
						
						return true;
					},
					value: function() {
						return this.vals || U.toArray(this.limits.length, 0);
					}
				};}
			})
		};
	}
});
package.build();
