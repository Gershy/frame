var package = new PACK.pack.Package({ name: 'clock',
	dependencies: [ 'e' ],
	buildFunc: function() {
		var controlClick = function(amount) {
			this.changeSeconds(amount);
		};
		
		return {
			Clock: U.makeClass({ name: 'Clock',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* hasControls, minSeconds, maxSeconds */) {
						this.hasControls = U.param(params, 'hasControls', true);
						this.minSeconds = U.param(params, 'minSeconds', 0);
						this.maxSeconds = U.param(params, 'maxSeconds', 60 * 60 * 24);
						this.field = U.param(params, 'field', null);
						
						this.elem = null;
					},
					createElem: function(seconds) {
						var pass = this;
						this.elem = new PACK.e.e('<div class="clock"></div>');
						
						if (this.hasControls) this.elem.listAttr({ class: [ '+controls' ] });
						
						[ [ 'hour', 60 * 60 ], [ 'minute', 60 ], [ 'second', 1 ] ].forEach(function(type) {
							var c = pass.elem.append('<div class="time-component ' + type[0] + '"></div>');
							
							if (pass.hasControls) var controlDn = c.append('<div class="control less"></div>');
							
							var content = c.append('<div class="display"></div>');
							
							if (pass.hasControls) var controlUp = c.append('<div class="control more"></div>');
							
							if (pass.hasControls) {
								controlDn.handle('mousedown', controlClick.bind(pass, -type[1]));
								controlUp.handle('mousedown', controlClick.bind(pass, +type[1]));
							}
						});
						
						if (this.hasControls) this.elem.append('<div class="description"><div class="text"></div></div>');
						
						this.setSeconds(U.exists(seconds) ? seconds : 0);
						
						return this.elem;
					},
					getSeconds: function() {
						if (this.elem === null) throw new Error('Cannot get seconds before creating an element');
						
						var secText = this.elem.find('.time-component.second > .display').text();
						if (secText === '--') return null;
						
						var seconds = parseInt(secText);
						var minutes = parseInt(this.elem.find('.time-component.minute > .display').text());
						var hours = parseInt(this.elem.find('.time-component.hour > .display').text());
						
						return seconds + ((minutes + (hours * 60)) * 60);
					},
					setSeconds: function(seconds) {
						if (this.elem === null) throw new Error('Cannot modify seconds before creating an element');
						
						if (seconds !== null) {
							if (this.maxSeconds !== null && seconds > this.maxSeconds) seconds = this.maxSeconds;
							if (this.minSeconds !== null && seconds < this.minSeconds) seconds = this.minSeconds;
							
							var hours = Math.floor(seconds / (60 * 60));
							seconds -= hours * 60 * 60;
							var minutes = Math.floor(seconds / 60);
							seconds -= minutes * 60;
							
							this.elem.find('.time-component.second > .display').text(seconds.toString().padLeft(2, '0'));
							this.elem.find('.time-component.minute > .display').text(minutes.toString().padLeft(2, '0'));
							this.elem.find('.time-component.hour > .display').text(hours.toString().padLeft(2, '0'));
							
						} else {
							this.elem.find('.time-component.second > .display').text('--');
							this.elem.find('.time-component.minute > .display').text('--');
							this.elem.find('.time-component.hour > .display').text('--');
						}
						
						if (this.field !== null) {
							var s = this.getSeconds();
							this.field.fieldValue(s === null ? '' : s);
						}
						
						if (this.hasControls) this.elem.find('.description > .text').text(this.description());
					},
					changeSeconds: function(delta) {
						this.setSeconds(this.getSeconds() + delta);
					},
					description: function() {
						var descPcs = [];
						
						[
							[ 'hour', parseInt(this.elem.find('.time-component.hour > .display').text()) ],
							[ 'minute', parseInt(this.elem.find('.time-component.minute > .display').text()) ],
							[ 'second', parseInt(this.elem.find('.time-component.second > .display').text()) ],
						].forEach(function(type) {
							if (type[1] > 0) descPcs.push(type[1].toString() + ' ' + type[0] + (type[1] === 1 ? '' : 's'));
						});
						
						return descPcs.length > 0 ? descPcs.join(', ') : 'No time at all.';
					}
				};}
			})
		};
	}
});
package.build();
