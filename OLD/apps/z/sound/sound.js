var package = new PACK.pack.Package({ name: 'sound',
	dependencies: [ 'queries', 'tasks', 'random' ],
	buildFunc: function() {
		var channelOperation = function(buffer, op) {
			var channels = buffer.numberOfChannels;
			var ret = PACK.sound.context.createBuffer(channels, buffer.length, PACK.sound.context.sampleRate);
			
			for (var chn = 0; chn < channels; chn++) {
				var arr = new Float32Array(buffer.length);
				buffer.copyFromChannel(arr, chn, 0);
				if (op) op(arr);
				ret.copyToChannel(arr, chn, 0);
			}
			
			return ret;
		};
		
		var Keyboard = U.makeClass({ name: 'KeyBoard',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* rootHz, step */) {
					this.rootHz = U.param(params, 'rootHz');
					this.step = U.param(params, 'step');
				},
				keyHz: function(key) {
					return this.rootHz * Math.pow(this.step, key);
				},
			}; }
		});
		
		var Sound = U.makeClass({ name: 'Sound',
			propertyNames: [ 'name', 'buffer' ],
			methods: function(sc, c) { return {
				init: function(params /* name, buffer */) {
					/*
					-name: Name for this sound
					-buffer: Either an AudioBuffer or anything array-like (mono)
					*/
					this.name = U.param(params, 'name', '');
					var buffer = U.param(params, 'buffer');
					
					if (U.isObj(buffer, AudioBuffer)) {
						this.buffer = buffer;
					} else {
						this.buffer = PACK.sound.context.createBuffer(2, buffer.length, PACK.sound.context.sampleRate);
						this.buffer.copyToChannel(buffer, 0);
						this.buffer.copyToChannel(buffer, 1);
						
						if (!this.name) this.name = 'buffered (' + (this.buffer.length) + ')';
					}
				},
				play: function(params /* delay, start, len */) {
					var delay = U.param(params, 'delay', 0);
					var start = U.param(params, 'start', 0);
					var len = U.param(params, 'len', null);
					
					var node = PACK.sound.context.createBufferSource();
					node.buffer = this.buffer;
					node.connect(PACK.sound.context.destination);
					
					if (len)	node.start(delay, start, len);
					else 			node.start(delay, start);
				},
				draw: function(channelNum, graphics, tlX, tlY, w, h, quality) {
					if (!U.exists(quality)) quality = 1;
					
					var pass = this;
					
					var buffer = this.buffer.getChannelData(channelNum);
					var numSamples = parseInt(buffer.length * quality);
					
					var hh = h * 0.5;
					var xInc = w / numSamples;
					
					new PACK.tasks.Task({
						start: function(items) {
							graphics.lineWidth = 0.7;
							graphics.strokeStyle = '#980000';
							graphics.moveTo(tlX, tlY + hh);
						},
						beforeChunk: function() { graphics.beginPath(); },
						work: function(items, n) {
							var newX = tlX + (n * xInc);
							var newY = tlY + hh + (buffer[n] * hh);
							graphics.lineTo(newX, newY);
						},
						afterChunk: function() { graphics.stroke(); },
						end: function() {
							
							var profile = pass.profileReduce({ iterations: 10, amount: 0.5 });
							
							new PACK.tasks.Task({
								start: function(items) {
									graphics.lineWidth = 2;
									graphics.strokeStyle = '#000000';
								},
								beforeChunk: function() { graphics.beginPath(); },
								work: function(items, n) {
									var newX = tlX + (n * xInc);
									var newY = tlY + hh - (profile[n] * hh);
									graphics.lineTo(newX, newY);
								},
								afterChunk: function() { graphics.stroke(); }
							}).run({
								totalTasks: profile.length,
								tasksPerTick: 50000,
								sleepTime: 5
							});
							
							/*
							var bias = 0.99;
							var evenReps = 2;
							var threshold = 0.4;
							var thresholdOut = 0.2;
							var fallback = 0;
							
							var beats = pass.beatLocations({
								cut: 350,
								reps: 10,
								bias: bias,
								evenReps: evenReps,
								threshold: threshold,
								thresholdOut: thresholdOut,
								fallback: fallback
							});
							
							new PACK.tasks.Task({
								start: function(items) {
									graphics.lineWidth = 30;
									graphics.strokeStyle = '#009800';
								},
								beforeChunk: function() { graphics.beginPath(); },
								work: function(items, n) {
									var newX = tlX + (beats[n] * xInc);
									var newY = tlY;
									graphics.moveTo(newX, newY);
									graphics.lineTo(newX, newY + hh + hh);
								},
								afterChunk: function() { graphics.stroke(); },
							}).run({
								totalTasks: beats.length, 
								tasksPerTick: 50000,
								sleepTime: 5,
							});*/
						},
						
					}).run({
						items: {},
						totalTasks: buffer.length,
						tasksPerTick: 50000,
						sleepTime: 5,
						// progressCB: function(n, t) { console.log(parseInt((n / t) * 100)); },
					});
				},
				getSubSound: function(params /* offset, length */) {
					
					var offset = U.param(params, 'offset', 0);
					var length = U.param(params, 'length', this.buffer.length - offset);
					
					var b1 = new Float32Array(length);
					var b2 = new Float32Array(length);
					
					this.buffer.copyFromChannel(b1, 0, offset);
					this.buffer.copyFromChannel(b2, 1, offset);
					
					var buff = PACK.sound.context.createBuffer(2, length, PACK.sound.context.sampleRate);
					buff.copyToChannel(b1, 0, 0);
					buff.copyToChannel(b2, 1, 0);
					
					return new Sound({
						name: this.name + ' (' + offset + ' - ' + (offset + length) + ')',
						buffer: buff
					});
				},
				getInformation: function() {
					var ret = [];
					for (var i = 0, len = this.buffer.numberOfChannels; i < len; i++) {
						var arr = new Float32Array(this.buffer.length);
						this.buffer.copyFromChannel(arr, i, 0);
						ret.push(arr);
					}
					return ret;
				},
				operate: function(op) {
					return new Sound({
						name: this.name + ' (op)',
						buffer: channelOperation(this.buffer, op)
					});
				},
				lowpassed: function(params /* offset, length, cut, reps */) {
					/*
					// WITH DT AND RC (time-interval, time-constant)
					var dt = U.param(params, 'dt');
					var rc = U.param(params, 'rc');
					var alpha = dt / (rc + dt);
					*/
					
					var cut = U.param(params, 'cut');
					var reps = U.param(params, 'reps', 5);
					
					var alpha = 2 * Math.PI * (cut / PACK.sound.context.sampleRate); // Inverse sample-rate is delta-t
					alpha = alpha / (alpha + 1);
					
					return this.operate(function(arr) {
						
						for (var rep = 0; rep < reps; rep++) {
							for (var i = 1, len = arr.length; i < len; i++) {
								var v1 = arr[i - 1];
								var v2 = arr[i];
								
								var prev = arr[i - 1];
								arr[i] = prev + (alpha * (arr[i] - prev));
								
								arr[i] = v1 + (alpha * (v2 - v1));
							}
						}
						
					});
					
				},
				monoAverage: function(params /* offset, length */) {
					var offset = U.param(params, 'offset', 0);
					var length = U.param(params, 'length', this.buffer.length - offset);
					
					var c1 = this.buffer.getChannelData(0);
					var c2 = this.buffer.getChannelData(1);
					
					var ret = new Float32Array(length - offset);
					
					for (var i = offset, len = offset + length; i < len; i++) ret[i] = (c1[i] + c2[i]) * 0.5;
					
					return ret;
				},
				profileReduce: function(params /* iterations, amount */) {
					var iterations = U.param(params, 'iterations', 10);
					var amount = U.param(params, 'amount', 0.5);
					
					var info = this.getInformation();
					var nSmps = info[0].length;
					var nChns = info.length;
					
					var energies = [];
					
					for (var smp = 0; smp < nSmps; smp++) {
						
						var energy = 0;
						for (var chn = 0; chn < nChns; chn++) {
							var v = info[chn][smp];
							energy += v * v;
						}
						energies.push(energy);
						
					}
					
					var maxEnergy = 0;
					var minEnergy = Number.MAX_VALUE;
					
					for (var i = 0, len = energies.length; i < len; i++) {
						var e = energies[i];
						if (e > maxEnergy) maxEnergy = e;
						if (e < minEnergy) minEnergy = e;
					}
					if (maxEnergy === 0) throw new Error('No energy?');
					
					
					energies = energies.map(function(n) { return n / maxEnergy; });
					for (var it = 0; it < 20; it++) {
						
						//var maxEnergy = 0;
						var n = 0;
						
						for (var i = 0, len = energies.length - 1; i < len; i++) {
							
							var v1 = energies[i];
							
							n = (n * 0.95) + (v1 * 0.05);
							v1 = n;
							
							energies[i] = v1;
							
						}
						
						//var mult = 1 / maxEnergy;
						//energies = energies.map(function(n) { return n * mult; });
						
					}
					
					return energies;
					
					
				},
				beatLocations: function(params /* offset, length, cut, reps, bias, evenReps, threshold, thresholdOut, fallback */) {
					/*
					High level function.
					Lowpasses this sound using cut and rep params.
					Takes the lowpassed sound's evened profile using reps and evenReps.
					Considers a beat every time the value of that profile spikes above threshold.
					
					-offset: position in the sound to begin beat detection
					-length: number of samples from the sound on which to perform beat detection
					-cut: lowpass cutoff frequency
					-reps: lowpass repetition quality
					-bias: profiling bias
					-evenReps: profile evening repetition quality
					-threshold: beat volume threshold
					*/
					
					var chns = [];
					var smps = this.buffer.length;
					for (var i = 0, len = this.buffer.numberOfChannels; i < len; i++) {
						var arr = new Float32Array(this.buffer.length);
						this.buffer.copyFromChannel(arr, i, 0);
						chns.push(arr);
					}
					
					var blockSize = 1000;
					var blockEnergies = [];
					
					for (var i = 0; i < smps; i += blockSize) {
						
						var energy = 0;
						
						// Loop through channels, and then through the block
						for (var chn = 0; chn < chns.length; chn++) {
							for (var j = i, len = Math.min(i + blockSize, smps); j < len; j++) {
								var v = chns[chn][j];
								energy += v * v;
							}
						}
						blockEnergies.push(energy);
						
					}
					
					var avg = blockEnergies.reduce(function(a, b) { return a + b; }, 0) / blockEnergies.length;
					var threshMult = 1.5;
					var thresh = avg * threshMult;
					
					var beats = [];
					var needToWait = 3;
					var wait = 0;
					for (var i = 0, len = blockEnergies.length; i < len; i++) {
						if (blockEnergies[i] > thresh && !wait) {
							beats.push(i * blockSize);
							wait = needToWait;
						} else if (wait) {
							wait--;
						}
					}
					
					return beats;
				},
			}; },
			statik: {
				fromFile: function(file, successCB, progressCB) {
					var reader = new FileReader();
					
					reader.onload = function() {
						Sound.AUDIO_CONTEXT.decodeAudioData(reader.result, function(buffer) {
							if (PACK.util.defd(progressCB)) progressCB('process', 1); //Decoding is done
							successCB(new Sound(buffer));
						});
					};
					
					if (PACK.util.defd(progressCB)) 
						reader.onprogress = function(e) { progressCB('read', e.loaded / e.total); };
					
					reader.readAsArrayBuffer(file);
				},
			}
		});
		
		var SoundGen = U.makeClass({ name: 'SoundGen',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* */) {
					this.playedSamples = 0;
					this.playedOsc = 0;
				},
				reset: function() {
					this.playedOsc = 0;
					this.playedSamples = 0;
				},
				nextSample: function(params /* n, i, channel, rootHz, velocity */) {
					throw new Error('not implemented');
				},
				write: function(params /* buffer, offset, length */) {
					var buffer = U.param(params, 'buffer');
					
					if (buffer.constructor === AudioBuffer)
						this.writeBuff(params);
					else
						this.writeArr(params);
				},
				writeBuff: function(params /* buffer, offset, length */) {
					var buffer = U.param(params, 'buffer');
					var offset = U.param(params, 'offset');
					var length = U.param(params, 'length');
					var p = params.clone();
					var secsPerSample = (Math.PI * 2) / PACK.sound.context.sampleRate;
					
					var c1 = buffer.getChannelData(0);
					var c2 = buffer.getChannelData(1);
					
					for (var i = offset, len = offset + length; i < len; i++) {
						c1[i] += this.nextSample(p.update({ n: this.playedOsc, i: this.playedSamples, channel: 0 }));
						c2[i] += this.nextSample(p.update({ n: this.playedOsc, i: this.playedSamples, channel: 1 }));
						
						if (isNaN(c1[i] + c2[i])) throw new Error('NaN');
						
						this.playedOsc += secsPerSample;
						this.playedSamples += 1;
					}
					
					this.reset();
				},
				writeArr: function(params /* buffer, offset, length */) {
					var buffer = U.param(params, 'buffer');
					var offset = U.param(params, 'offset');
					var length = U.param(params, 'length');
					var p = params.clone({ channel: 0 });
					var secsPerSample = (Math.PI * 2) / PACK.sound.context.sampleRate;
					
					for (var i = offset, len = offset + length; i < len; i++) {
						arr[i] += this.nextSample(p.update({ n: this.playedOsc, i: this.playedSamples }));
						
						this.playedOsc += secsPerSample;
						this.playedSamples += 1;
					}
					
					this.reset();
				},
			}; }
		});
		
		var SoundGenSin = U.makeClass({ name: 'SoundGenSin',
			superclassName: 'SoundGen',
			propertyNames: [ 'phase' ],
			methods: function(sc, c) { return {
				init: function(params /* phase  */) {
					sc.init.call(this, params);
					this.phase = 	U.param(params, 'phase', 0);
				},
				nextSample: function(params /* n, i, channel, rootHz, velocity */) {
					// No use of U.param here for SPEED
					// params.channel is ignored (this is a mono signal)
					
					return Math.sin(this.phase + (params.n * params.rootHz)) * params.velocity;
				},
			}; }
		});
		
		var SoundGenTremollo = U.makeClass({ name: 'SoundGenTremollo',
			superclassName: 'SoundGen',
			propertyNames: [ 'tremolloHz', 'tremolloAmount', 'soundGen' ],
			methods: function(sc, c) { return {
				init: function(params /* tremolloHz, soundGen */) {
					sc.init.call(this, params);
					
					this.tremolloHz = U.param(params, 'tremolloHz');
					this.tremolloAmount = U.param(params, 'tremolloAmount');
					this.soundGen = U.param(params, 'soundGen');
					
					this.baseAmount = 1 - this.tremolloAmount;
				},
				nextSample: function(params /* n, i, channel, rootHz, velocity */) {
					return this.soundGen.nextSample(params) * (this.baseAmount + (Math.sin(params.n * this.tremolloHz) * this.tremolloAmount));
				},
			}; }
		});
		
		var SoundGenSample = U.makeClass({ name: 'SoundGenSample',
			superclassName: 'SoundGen',
			propertyNames: [ 'sound', 'offset', 'length' ],
			methods: function(sc, c) { return {
				init: function(params /* sound, offset, length */){
					sc.init.call(this, params);
					
					this.sound = U.param(params, 'sound');
					this.offset = U.param(params, 'offset', 0);
				},
				nextSample: function(params /* n, i, channel, rootHz, velocity */) {
					var n = params.i + this.offset;
					if (n > this.sound.buffer.length) return 0;
					return this.sound.buffer.getChannelData(params.channel)[n];
				}
			}; }
		});
		
		var Midi = U.makeClass({ name: 'Midi',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* offset, length, soundGen, keyboard, key, velocity */) {
					this.offset = U.param(params, 'offset', 0);
					this.length = U.param(params, 'length', 1 * PACK.sound.context.sampleRate);
					this.soundGen = U.param(params, 'soundGen');
					
					this.keyboard = U.param(params, 'keyboard', PACK.sound.stdKeyboard);
					this.key = U.param(params, 'key');
					this.velocity = U.param(params, 'velocity', 0.8);
				},
				end: function() { return this.offset + this.length; },
				write: function(buff) {
					this.soundGen.write({
						buffer: buff,
						offset: this.offset,
						length: this.length,
						rootHz: this.keyboard.keyHz(this.key),
						velocity: this.velocity,
					});
				},
			}; },
		});
		
		var MidiSequence = U.makeClass({ name: 'MidiSequence',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* midis */) {
					this.midis = U.param(params, 'midis');
				},
				genSound: function(name) {
					var len = 0;
					
					this.midis.forEach(function(midi) {
						var end = midi.end();
						if (end > len) len = end;
					});
					
					var buffer = PACK.sound.context.createBuffer(2, len, PACK.sound.context.sampleRate);
					
					this.midis.forEach(function(midi) { midi.write(buffer); });
					
					return new PACK.sound.Sound({ buffer: buffer, name: U.exists(name) ? name : '' });
				}
			}; },
			statik: {
				simpleMelody: function(params /* soundGen, timeMult, noteLen, notes */) {
					// The notes parameter is an array of { key, velocity }
					var soundGen = U.param(params, 'soundGen');
					var timeMult = U.param(params, 'timeMult', 1) * PACK.sound.context.sampleRate;
					var noteLen = U.param(params, 'noteLen', 0.9) * timeMult;
					var notes = U.param(params, 'notes');
					
					return new PACK.sound.MidiSequence({
						midis: notes.map(function(note, n) {
							return new PACK.sound.Midi({
								offset: n * timeMult,
								length: noteLen,
								soundGen: soundGen,
								key: note.key,
								velocity: note.velocity
							});
						})
					});
				},
			},
		});
		
		var SoundApp = U.makeClass({ name: 'SoundApp',
			superclassName: 'QueryHandler',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* */) {
					
				},
				handleQuery: function(params /* */) {
					return { msg: 'SoundApp handled query', params: params };
				}
			}; },
		});
		
		return {
			context: 'AudioContext' in global ? new AudioContext() : null,
			stdKeyboard: new Keyboard({ rootHz: 432, step: Math.pow(2, 1 / 12) }),
			
			Keyboard: Keyboard,
			Sound: Sound,
			SoundGen: SoundGen,
			SoundGenSin: SoundGenSin,
			SoundGenTremollo: SoundGenTremollo,
			SoundGenSample: SoundGenSample,
			Midi: Midi,
			MidiSequence: MidiSequence,
			SoundApp: SoundApp,
			
			getUploadControls: function(params /* callbackSingle, callbackAll */) {
				var callbackSingle = U.param(params, 'callbackSingle', null);
				var callbackAll = U.param(params, 'callbackAll', null);
				
				var inp = document.createElement('input');
				inp.setAttribute('type', 'file');
				inp.setAttribute('multiple', 'multiple');
				inp.onchange = function(e) {
					var files = U.toArray(e.target.files);
					var sounds = [];
					
					files.forEach(function(file) {
						var reader = new FileReader();
						reader.onload = function() {
							PACK.sound.context.decodeAudioData(reader.result, function(buffer) {
								var sound = new PACK.sound.Sound({ name: file.name, buffer: buffer });
								sounds.push(sound);
								
								if (callbackSingle) callbackSingle(sound);
								if (callbackAll && sounds.length === files.length) callbackAll(sounds);
							});
						};
						reader.readAsArrayBuffer(file);
					});
				};
				
				return inp;
			},
			
			queryHandler: new SoundApp(),
		};
	},
	runAfter: function() {
		if (U.isServer()) return;
		
		var canvas = document.createElement('canvas');
		canvas.setAttribute('width', '8000');
		canvas.setAttribute('height', '400');
		canvas.setAttribute('style', 'position: relative; left: 0; top: 0; display: inline-block; /*width: 500px; height: 400px;*/');
		var ctx = canvas.getContext('2d');
		
		var cont = document.createElement('div');
		cont.setAttribute('style', 'overflow-x: scroll;');
		
		var body = document.getElementsByTagName('body')[0];
		body.appendChild(cont);
		cont.appendChild(canvas);
		
		body.appendChild(PACK.sound.getUploadControls({
			callbackSingle: function(sound) { console.log(sound.name); },
			callbackAll: function(sounds) {
				var r = new PACK.random.Random();
				var pieceLen = parseInt(0.6 * PACK.sound.context.sampleRate);
				
				var beats = [];
				sounds.forEach(function(sound) {
					sound.beatLocations({}).forEach(function(beatOffset) {
						beats.push(new PACK.sound.SoundGenSample({
							sound: sound,
							offset: beatOffset
						}));
					});
					console.log('got beats for ' + sound.name, beats.length);
				});
				
				var go = document.createElement('div');
				go.setAttribute('style', 'display: inline-block; font-size: 30px; cursor: pointer; margin-left: 20px;');
				go.innerHTML = 'go';
				go.onclick = function() {
					var sec = PACK.sound.context.sampleRate;
					var sound = sounds[0].getSubSound({ offset: sec * 60, length: sec * 5 });
					
					/*var seq = new PACK.sound.MidiSequence({
						midis: U.range({0:20}).map(function(i) {
							var soundGen = r.randElem(beats);
							return new PACK.sound.Midi({
								offset: pieceLen * i,
								length: pieceLen,
								key: 0,
								soundGen: soundGen
							});
						})
					});
					
					var sound = seq.genSound();*/
					
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					sound.draw(0, ctx, 10, 10, 7980, 380, 1);
					sound.play();
				};
				
				/*
				// skylarking: 62.3-3.84
				var sound0 = sounds[0];
				go.onclick = function() {
					var sec = PACK.sound.context.sampleRate;
					var t = prompt('start-len?').split('-');
					var sound = sound0.getSubSound({ offset: Math.round(sec * parseFloat(t[0])), length: Math.round(sec * parseFloat(t[1])) });
					console.log('HERES', sound.name);
					sound.draw(0, ctx, 10, 10, 7980, 380, 1);
					sound.play();
				};
				
				var size = document.createElement('div');
				size.setAttribute('style', 'display: inline-block; font-size: 30px; cursor: pointer; margin-left: 20px;');
				size.innerHTML = 'size';
				size.onclick = function() {
					var size = prompt('size');
					canvas.setAttribute('style', 'position: relative; left: 0; top: 0; display: inline-block; width: ' + size + 'px; height: 400px;');
				};
				body.appendChild(size);
				*/
				
				body.appendChild(go);
			}
		}));
	},
});
package.build();
