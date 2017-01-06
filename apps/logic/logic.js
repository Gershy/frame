var package = new PACK.pack.Package({ name: 'logic',
	dependencies: [ 'quickDev', 'htmlText', 'clock', 'userify' ],
	buildFunc: function(packageName) {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/logic/style.css' ] },
			versionString: '0.0.1',
			LogicApp: PACK.uth.makeClass({ name: 'LogicApp',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					},
					start: function() {
						if (!U.isServer()) throw new Error('Only call this server-side');
						
						var pass = this;
						this.dbUpdate = new qd.QUpdate({
							request: function(cb) {
								pass.setState(pass.schemaParams({
									selection: qd.sel.all
								}), cb);
							},
							onStart: function() {},
							onEnd: function(response) { }
						});
						this.dbUpdate.repeat({ delay: 1500 });
					},
					getState: function(cb) {
						/*
						Retrieves the persisted state of the creativity app from the db
						*/
						if (DB === null) { cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.find({ name: packageName }).limit(1).next(function(err, doc) {
								cb(doc !== null ? doc.data : null);
							});
						});
					},
					setState: function(state, cb) {
						/*
						Persists the creativity app into the db
						*/
						if (DB === null) { if(cb) cb(null); return; }
						
						DB.collection('apps', function(err, collection) {
							collection.update({ name: packageName }, { $set: { data: state } }, { upsert: true }, function(err, doc) {
								if (cb) cb(doc.result);
							});
						});
					},
				}; }
			}),
			LogicTheory: PACK.uth.makeClass({ name: 'LogicTheory',
				superclassName: 'QDict',
				methods: function(sc, c) { return {
					init: function(params /* */) {
						sc.init.call(this, params);
					}
				}; }
			})
		};
		ret.queryHandler = new ret.LogicApp({ name: 'app', children: [] });
		
		U.addSerializables([
			{	name: 'logic.root.schemaParams',
				value: { c: ret.LogicApp, p: { name: 'app' }, i: [
					{	c: qd.QString, p: { name: 'version', value: '0.0.1 (initial)' } },
					{ 	c: qd.QGen, p: { name: 'users',
						_schema: 'logic.user.schema',
						_initChild: 'logic.user.init',
						prop: 'username/value'
					}},
					{	c: qd.QGen, p: { name: 'essays',
						_schema: 'logic.essay.schema',
						_initChild: 'logic.essay.init',
						prop: 'id/value'
					}},
					{	c: qd.QGen, p: { name: 'theories',
						_schema: 'logic.theory.schema',
						_initChild: 'logic.theory.init',
						prop: 'quickName/value'
					}}
				]}
			},
			
			{	name: 'logic.user.schema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QString, p: { name: 'fname' } },
					{ c: qd.QString, p: { name: 'lname' } },
					{ c: qd.QString, p: { name: 'username' } }
				]})
			},
			{	name: 'logic.user.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.essay.schema',
				value: new qd.QSchema({ c: qd.QDict, i: [
					{ c: qd.QInt, p: { name: 'id', value: 0 } },
					{ c: qd.QString, p: { name: 'markup' } }
				]})
			},
			{	name: 'logic.essay.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.schema',
				value: new qd.QSchema({ c: ret.LogicTheory, i: [
					{ c: qd.QRef, 		p: { name: 'user' } },
					{ c: qd.QInt, 		p: { name: 'timestamp' } },
					{ c: qd.QRef, 		p: { name: 'duplicate' } },
					{ c: qd.QString, 	p: { name: 'quickName' } },
					{ c: qd.QString, 	p: { name: 'title' } },
					{ c: qd.QRef, 		p: { name: 'essay' } },
					{ c: qd.QGen, 		p: { name: 'challengers',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@theory.quickName/value'
					}},
					{ c: qd.QGen, 		p: { name: 'prerequisites',
						_schema: 'logic.theory.related.schema',
						_initChild: 'logic.theory.related.init',
						prop: '@theory.quickName/value'
					}},
					{ c: qd.QGen, 		p: { name: 'voters',
						_schema: 'logic.theory.voter.schema',
						_initChild: 'logic.theory.voter.init',
						prop: '@voter.username/value'
					}}
				]})
			},
			{	name: 'logic.theory.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.related.schema',
				value: new qd.QSchema({ c: qd.QRef, p: { name: 'theory' } })
			},
			{	name: 'logic.theory.related.init',
				value: function(child, params /* */) {
					
				}
			},
			
			{	name: 'logic.theory.voter.schema',
				value: new qd.QSchema({ c: qd.QDict, p: { name: 'voter' }, i: [
					{ c: qd.QRef, p: { name: 'user' } },
					{ c: qd.QInt, p: { name: 'vote' } }
				]})
			},
			{	name: 'logic.theory.voter.init',
				value: function(child, params /* */) {
					
				}
			}
		]);
		
		return ret;
	},
	runAfter: function() {
		
		if (U.isServer()) return;
		
		var root = PACK.logic.queryHandler;
		var qd = PACK.quickDev;
		var us = PACK.userify;
		var e = PACK.e.e;
		
		root.$load({ selection: new qd.QSelAll() }).fire(function(app) {
			app.addChild(new qd.QDict({ name: 'static', children: [
				new qd.QDict({ name: 'credentials', children: [
					new qd.QString({ name: 'token', value: '' }),
					new qd.QRef({ name: 'user', value: null })
				]}),
				new qd.QDict({ name: 'forms', children: [
					new qd.QDict({ name: 'login', children: [
						new qd.QString({ name: 'username', value: '' }),
						new qd.QString({ name: 'password', value: '' })
					]})
				]}),
				new qd.QDict({ name: 'text', children: [
					new qd.QString({ name: 'version', value: 'Version:' }),
					new qd.QString({ name: 'enterCreds', value: 'Enter credentials:' })
				]})
			]}));
			
			console.log(app.simplified());
			
			var view = new us.RootView({ name: 'root', appData: app, elem: PACK.e.e('body'), children: [
				
				new us.IfView({ name: 'checkLogin', appData: app,
					
					condition: function() { return app.getChild('static.credentials.token').value !== ''; },
					
					view0: new us.SetView({ name: 'login', children: [
						
						// TODO: Need to decide how to handle `appData` with throw-away fields like these
						new us.StringView({ name: 'title', appData: 'static.text.enterCreds', editable: false }),
						new us.StringView({ name: 'username', appData: 'static.forms.login.username', editable: true }),
						new us.StringView({ name: 'password', appData: 'static.forms.login.password', editable: true }),
						new us.ActionView({ name: 'submit', appData: null, title: 'LOGIN',
							action: function() {
								app.getChild('static.credentials.token').setValue('WOOO');
							}
						})
					
					]}),
					
					view1: new us.SetView({ name: 'app', children: [
					]})
					
				}),
				
				new us.SetView({ name: 'test', children: [
					
					new us.SetView({ name: 'inner', children: [] })
					
				]}),
				
				new us.SetView({ name: 'versionText', flow: 'inline', children: [
					new us.StringView({ name: '1', appData: 'static.text.version', editable: false }),
					new us.StringView({ name: '2', appData: 'version', editable: false })
				]})
				
				
				/*
				new us.ConditionView({ name: 'checkLogin', target: 'app.@client', cond: 'exists',
					
					child0: new us.CompoundView({ name: 'loggedOut', children: [
						
						new us.StringView({ name: 'errorMsg', content: 'app.loginError' }),
						new us.StringView({ name: 'username', content: null }),
						new us.StringView({ name: 'password', content: null }),
						new us.ActionView({ name: 'submit', action: function(view, cb) {
							app.$loginUser({
								username: view.par.getChild('username').value,
								password: view.par.getChild('password').value
							}).fire(function(user) {
								if (U.err(user)) return;
							});
						}})
						
					]}),
					
					child1: new us.CompoundView({ name: 'loggedIn', children: [
						
					]})
					
				}),
				
				new us.StringView({ name: 'version', content: 'app.version' })
				*/
				
			]});
			
			view.startRender();
			window.view = view;
			window.root = root; // Nice to make "root" available on client-side terminal
		});
		
	}
});
package.build();
