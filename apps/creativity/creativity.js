var package = new PACK.pack.Package({ name: 'creativity',
	dependencies: [ 'quickDev' ],
	buildFunc: function() {
		var qd = PACK.quickDev;
		
		var ret = {
			resources: { css: [ 'apps/creativity/style.css' ] }
		};
		
		var CreativityApp = PACK.uth.makeClass({ name: 'CreativityApp',
			superclassName: 'QDict',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* */) { sc.init.call(this, params); },
				genUserToken: function(user) {
					var u = user.getChild('username').value;
					var p = user.getChild('password').value;
					
					var str = '';
					var val = 9;
					var chars = '0ab45cd21ef58gh02ij0klm0no23p9qr62stu92vwxyz5AB8C0D37EF5GH7I4JKL2M4NO4PQR6ST8U39VW9998XYZ';
					
					for (var i = 0; i < 12; i++) {
						var v1 = u[(val + 19) % u.length].charCodeAt(0);
						var v2 = p[((val * val) + 874987) % p.length].charCodeAt(0);
						val = (v1 * v2 * 11239) + 11 + (i + v1);
						str += chars[val % chars.length];
					}
					
					return str;
				},
				handleQuery: function(params) {
					var com = U.param(params, 'command');
					
					if (com === 'getToken') {
						
						var tokenParams = U.param(params, 'params');
						var username = U.param(tokenParams, 'username');
						var password = U.param(tokenParams, 'password');
						
						var query = { p: {}, i: {
							username: { p: { value: username } },
							password: { p: { value: password } }
						}};
						var result = this.getChild('users').filterChildren(query);
						
						if (result.length === 0) {
							return { help: 'Invalid credentials' };
						}
						
						var user = result[0];
						
						return { msg: 'user retrieved', token: this.genUserToken(user) };
						
					}
					
					return sc.handleQuery.call(this, params);
				}
			}; }
		});
		
		ret.queryHandler = new CreativityApp({ name: 'app',
			children: [
				new qd.QGen({ name: 'users',
					_schema: U.addSerializable({
						name: 'creativity.usersSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							username:	new qd.QSchema({ c: qd.QString, p: { name: 'username', 	value: '' } }),
							password:	new qd.QSchema({ c: qd.QString, p: { name: 'password', 	value: '' } }),
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.usersInitChild',
						value: function(child, params /* username, password */) {
							var username = U.param(params, 'username');
							var password = U.param(params, 'password');
							child.getChild('username').setValue(username);
							child.getChild('password').setValue(password);
						}
					}),
					prop: 'username/value'
				}),
				new qd.QGen({ name: 'blurbs',
					_schema: U.addSerializable({
						name: 'creativity.blurbSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							user: new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
							text: new qd.QSchema({ c: qd.QString, p: { name: 'text', minLen: 1, maxLen: 140, value: '' } })
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.blurbInitChild',
						value: function(child, params /* username, text */) {
							var username = U.param(params, 'username');
							var text = U.param(params, 'text');
							
							child.setValue('user', 'users/' + username);
							child.getChild('text').setValue(text);
						}
					}),
					prop: 'id/value'
				}),
				new qd.QGen({ name: 'votables',
					_schema: U.addSerializable({ name: 'creativity.votableSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: 	new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							blurb: 	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({ name: 'creativity.votablesInitChild',
						value: function(child, params /* blurb */) {
							var blurb = U.param(params, 'blurb');
							child.setValue('blurb', blurb);
						}
					}),
					prop: 'id/value'
				}),
				new qd.QGen({ name: 'votes',
					_schema: U.addSerializable({ name: 'creativity.voteSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id:		new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							user:	new qd.QSchema({ c: qd.QRef, p: { name: 'user', value: '' } }),
							votable: new qd.QSchema({ c: qd.QRef, p: { name: 'votable', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({ name: 'creativity.votesInitChild',
						value: function(child, params /* user, votable */) {
							var user = U.param(params, 'user');
							var votable = U.param(params, 'votable');
							child.setValue('user', user);
							child.setValue('votable', votable);
						}
					}),
					prop: 'user.username/value'
				}),
				new qd.QGen({ name: 'storyItems',
					_schema: U.addSerializable({
						name: 'creativity.storyItemSchema',
						value: new qd.QSchema({ c: qd.QDict, i: {
							id: 	new qd.QSchema({ c: qd.QInt, p: { name: 'id', value: 0 } }),
							blurb:	new qd.QSchema({ c: qd.QRef, p: { name: 'blurb', value: '' } })
						}})
					}),
					_initChild: U.addSerializable({
						name: 'creativity.storyItemsInitChild',
						value: function(child, params /* blurb */) {
							var blurb = U.param(params, 'blurb');
							child.setValue('blurb', blurb);
						}
					}),
					prop: 'id/value'
				})
			]
		});
		
		return ret;
	},
	runAfter: function() {
		
		var c = PACK.creativity;
		var root = c.queryHandler;
		
		if (!U.isServer()) {
			
			var e = PACK.e.e;
		
			var scene = new PACK.e.RootScene({ name: 'root', title: 'root',
				build: function(rootElem, subsceneElem) {
					
					rootElem.append(subsceneElem.main);
					
				},
				subscenes: {
					main: [
						new PACK.e.Scene({ name: 'login', title: 'Login',
							build: function(rootElem, subsceneElem, scene) {
								
								var title = e('<h1>Creativity</h1>');
								
								var credentials = e('<div class="input-form credentials"></div>');
								
								var usernameField = e('<div class="input-field username"></div>');
								usernameField.append('<div class="label">Username</div>');
								usernameField.append('<input type="text"/>');
								
								var passwordField = e('<div class="input-field password"></div>');
								passwordField.append('<div class="label">Password</div>');
								passwordField.append('<input type="password"/>');
								
								var submit = e('<div class="submit"><div class="content">Submit</div><div class="error"></div></div>');
								submit.handle('click', function() {
									root.$request({ command: 'getToken', params: {
										username: usernameField.find('input').fieldValue(),
										password: passwordField.find('input').fieldValue()
									}, onComplete: function(response) {
										if ('help' in response) {
											submit.find('.error').setHtml(response.help);
											submit.listAttr({ class: '+error' });
											setTimeout(function() { submit.listAttr({ class: '-error' }) }, 2000);
										} else {
											scene.par.setSubscene('main', 'writing');
										}
									}});
								});
								
								var spin = e('<div class="spin"></div>');
								spin.append(U.rng(20).map(function(i) { return '<div class="spinner"><div class="dash"></div></div>'; }));
								
								credentials.append([ usernameField, passwordField, submit, spin ]);
								
								rootElem.append(title);
								rootElem.append(credentials);
								
								return {};
							}
						}),
						new PACK.e.Scene({ name: 'writing', title: 'Writing',
							build: function(rootElem, subsceneElem) {
								
								var story = e('<div class="writing-elem story"></div>');
								story.append('<div class="scroller"></div>');
								
								var voting = e('<div class="writing-elem voting"></div>');
								voting.append('<div class="scroller"></div>');
								
								var writing = e('<div class="writing-elem writing"></div>');
								writing.append([
									'<div class="input-form">',
										'<div class="input-field">',
											'<textarea></textarea>',
										'</div>',
									'</div>'
								].join(''));
								
								var storyData = root.getChild('storyItems');
								story.listAttr({ class: [ '+loading' ] });
								storyData.$load({ onComplete: function(elem) {
									console.log('LOADED STORY!!');
									console.log(elem.simplified());
								}});
								
								var submit = writing.find('.input-form').append('<div class="submit">Submit</div>');
								
								submit.handle('click', function() {
									console.log('Submitted story item!');
								});
								
								rootElem.append([ story, voting, writing ]);
								
							}
						})
					]
				},
				defaultScenes: { main: 'login' }
			});
			
			scene.go();
			
			setTimeout(function() {
				
				var users = root.getChild('users');
				users.$getChild({ address: 'gershom', addChild: true, onComplete: function(child) { console.log('HEY!!!', child); } });
				
			}, 200);
			
		} else {
			
			var userData = {
				ari: 		'ari117',
				daniel: 	'daniel228',
				gershom: 	'gershom331',
				levi: 		'levi443',
				yehuda: 	'yehuda556'
			};
			var users = root.getChild('users');
			for (var k in userData) users.getNewChild({ username: k, password: userData[k] });
			
			var blurbData = [
				[	'ari',		'Skranula looked upon the mountain.' ],
				[	'gershom',	'Hello my name is Tim.' ],
				[	'daniel',	'I love gogreens SO MUCH.' ],
				[	'yehuda', 	'WTF MANG LOLLLL' ],
				[	'levi',		'HAHAHA' ],
				[	'ari',		'srsly HAHA' ],
				[	'daniel',	'man lol I KNOW AHAH LAAOLLOL' ],
				[	'yehuda',	'lol' ],
				[	'levi',		'huehue HAHA LAOWLA' ],
				[	'gershom',	'LOLOL' ],
				[	'yehuda',	'HAHA WHAT IS THE JOKE THO' ],
				[	'daniel',	'DUNNO BUT IT funny.' ],
				[	'gershom',	'I lol\'d one time ahah.' ],
				[	'levi',		'bro you LYING you loled SEVERAL -' ],
				[	'yehuda',	'- TIMES.' ],
				[	'levi',		'DAWG DON\'T FINISH MY SENTENCES FKIN BISH ASS BISH' ]
			];
			var blurbs = root.getChild('blurbs');
			blurbData.forEach(function(data) {
				blurbs.getNewChild({ username: data[0], text: data[1] });
			});
			
			var taken = {};
			var children = blurbs.getChildren();
			
			var toVote = [];
			var toStory = [];
			
			for (var k in children) {
				var username = children[k].children.user.value;
				if (username in taken) {
					toStory.push(children[k]);
				} else {
					toVote.push(children[k]);
					taken[username] = true;
				}
			}
			
			var votables = root.getChild('votables');
			toVote.forEach(function(blurb) {
				votables.getNewChild({ blurb: blurb });
			});
			
			var storyItems = root.getChild('storyItems');
			toStory.forEach(function(blurb) {
				storyItems.getNewChild({ blurb: blurb });
			});
			
			var votes = root.getChild('votes');
			votes.getNewChild({ user: users.getChild('ari'), votable: votables.getChild('2') });
			
			console.log(root.simplified());
		}
		
	}
});
package.build();
