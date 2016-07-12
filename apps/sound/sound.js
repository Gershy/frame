var package = new PACK.pack.Package({ name: 'sound',
	dependencies: [ 'queries', 'tasks', 'random' ],
	buildFunc: function() {
		var Keyboard = PACK.uth.makeClass({ name: 'KeyBoard',
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
		
		var Sound = PACK.uth.makeClass({ name: 'Sound',
			propertyNames: [ 'name', 'buffer' ],
			methods: function(sc, c) { return {
				init: function(params /* name, buffer */) {
					/*
					-name: Name for this sound
					-buffer: Either an AudioBuffer or anything array-like (mono)
					*/
					this.name = U.param(params, 'name', '');
					this.buffer = null;
					this.time = 0;
					
					if ('buffer' in params) this.setData(params.buffer);
				},
				setData: function(buffer) {
					var ctx = PACK.sound.context;
					
					// Convert mono array to AudioBuffer
					if (buffer.constructor !== AudioBuffer) {
						var arr = buffer;
						
						buffer = ctx.createBuffer(2, arr.length, ctx.sampleRate);
						buffer.copyToChannel(arr, 0);
						buffer.copyToChannel(arr, 1);
					}
					
					this.buffer = buffer;
					this.time = this.buffer.length / ctx.sampleRate;
					
					if (this.name.length === 0) this.name = 'buffered (' + (this.buffer.length / ctx.sampleRate).toFixed(2) + 's)'
				},
				numSamples: function() { return this.buffer.length; },
				play: function(params /* delay, start, len */) {
					var delay = U.param(params, 'delay', 0);
					var start = U.param(params, 'start', 0);
					var len = U.param(params, 'len', null);
					
					var node = PACK.sound.context.createBufferSource();
					node.buffer = this.buffer;
					node.connect(PACK.sound.context.destination);
					
					if (len)	node.start(delay, start, len);
					else		node.start(delay, start);
				},
				draw: function(channelNum, ctx, tlX, tlY, w, h, quality) {
					if (!U.exists(quality)) quality = 1;
					
					var pass = this;
					
					var buffer = this.buffer.getChannelData(channelNum);
					var numSamples = parseInt(buffer.length * quality);
					
					var hh = h * 0.5;
					var xInc = w / numSamples;
					
					new PACK.tasks.Task({
						start: function(items) {
							ctx.lineWidth = 0.7;
							ctx.strokeStyle = '#980000';
							ctx.moveTo(tlX, tlY + hh);
						},
						beforeChunk: function() { ctx.beginPath(); },
						work: function(items, n) {
							var newX = tlX + (n * xInc);
							var newY = tlY + hh + (buffer[n] * hh);
							ctx.lineTo(newX, newY);
						},
						afterChunk: function() { ctx.stroke(); },
						end: function() {
							
							var bias = 0.99;
							var evenReps = 2;
							var threshold = 0.4;
							var thresholdOut = 0.2;
							var fallback = 0;
							
							var profile = pass.evenProfiled({ bias: bias, evenReps: evenReps });
							
							new PACK.tasks.Task({
								start: function(items) {
									ctx.lineWidth = 0.7;
									ctx.strokeStyle = '#000098';
									ctx.moveTo(tlX, tlY + hh);
								},
								beforeChunk: function() { ctx.beginPath(); },
								work: function(items, n) {
									var newX = tlX + (n * xInc);
									var newY = tlY + hh + (-profile[n] * hh);
									ctx.lineTo(newX, newY);
								},
								afterChunk: function() { ctx.stroke(); },
								end: function() {
									
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
											ctx.lineWidth = 0.7;
											ctx.strokeStyle = '#009800';
										},
										beforeChunk: function() { ctx.beginPath(); },
										work: function(items, n) {
											var newX = tlX + (beats[n] * xInc);
											var newY = tlY;
											ctx.moveTo(newX, newY);
											ctx.lineTo(newX + 5, newY + hh + hh);
										},
										afterChunk: function() { ctx.stroke(); },
									}).run({
										totalTasks: beats.length, 
										tasksPerTick: 50000,
										sleepTime: 5,
									});
								},
								
							}).run({
								totalTasks: profile.length, 
								tasksPerTick: 50000,
								sleepTime: 5,
							});
						},
						
					}).run({
						items: {},
						totalTasks: buffer.length,
						tasksPerTick: 50000,
						sleepTime: 5,
						// progressCB: function(n, t) { console.log(parseInt((n / t) * 100)); },
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
				lowpassed: function(params /* offset, length, cut, reps */) {
					var ret = this.monoAverage(params);
					
					/*
					// WITH DT AND RC (time-interval, time-constant)
					var dt = U.param(params, 'dt');
					var rc = U.param(params, 'rc');
					var alpha = dt / (rc + dt);
					*/
					
					// WITH CUT AND REPS (cutoff-frequency, repetitions)
					// TODO: This makes everything quieter :(
					var cut = U.param(params, 'cut');
					var reps = U.param(params, 'reps', 5);
					var alpha = 2 * Math.PI * (cut / PACK.sound.context.sampleRate); // Inverse sample-rate is delta-t
					alpha /= alpha + 1;
					
					for (var rep = 0; rep < reps; rep++) {
						for (var i = 1, len = ret.length; i < len; i++) {
							var prev = ret[i - 1];
							ret[i] = prev + (alpha * (ret[i] - prev));
						}
					}
					
					var orig = this.monoAverage(params);
					var diffSum = 0;
					for (var i = 0; i < orig.length; i++) {
						diffSum += Math.max(orig[i], ret[i]) - Math.min(orig[i], ret[i]);
					}
					console.log('Average diff', (diffSum / orig.length).toFixed(3));
					
					return ret;
				},
				profiled: function(params /* offset, length, bias */) {
					var bias = U.param(params, 'bias', 0.8);
					var unBias = 1 - bias;
					
					var mono = this.monoAverage(params);
					var ret = new Float32Array(mono.length);
					
					var lastVal = Math.abs(mono[0]);
					for (var i = 1, len = mono.length; i < len; i++) {
						var v = Math.abs(mono[i]);
						
						lastVal = v > lastVal
							? (v * bias) + (lastVal * unBias)
							: (v * unBias) + (lastVal * bias);
						
						ret[i] = lastVal;
					}
					
					return ret;
				},
				evenProfiled: function(params /* offset, length, bias, evenReps */) {
					var reps = U.param(params, 'evenReps', 1);
					
					var profile = this.profiled(params);
					
					for (var rep = 0; rep < reps; rep++) {
					
						var prevCrestP = 0;
						var crestP = 0;
						var hasValley = false;
						for (var i = 1; i < profile.length; i++) {
							var v = profile[i];
							
							if (hasValley && v < profile[crestP]) {
								// We're past a valley and descending again
								
								// Linearize the curve between prevCrestP(crest1V) and crestP(crest2V)
								var crest1V = profile[prevCrestP];
								var crest2V = profile[crestP];
								for (var j = prevCrestP; j < crestP; j++) {
									var perc = (j - prevCrestP) / (crestP - prevCrestP);
									profile[j] = (crest1V * (1 - perc)) + (crest2V * perc);
								}
								
								hasValley = false;
								prevCrestP = i;
								
							} else if (!hasValley && v < profile[crestP]) {
								// We're descending, but we haven't found a valley
								
							} else if (hasValley && v > profile[crestP]) {
								// We're past a valley and still ascending
								
							} else if (!hasValley && v > profile[crestP]) {
								// No valley yet, but just beginning to ascend
								hasValley = true;
								
							}
							
							crestP = i;
						}
						
					}
					
					return profile;
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
					
					var cut = U.param(params, 'cut', 350);
					var reps = U.param(params, 'reps', 15);
					var bias = U.param(params, 'bias', 0.995);
					var evenReps = U.param(params, 'evenReps', 2);
					var threshold = U.param(params, 'threshold', 0.6);
					var thresholdOut = U.param(params, 'thresholdOut', 0.2);
					var fallback = U.param(params, 'fallback', 0);
					
					//var evenProfile = new Sound({ name: 'lowpassed', buffer: this.lowpassed(params.clone({
					//	cut: 		cut,
					//	reps: 		reps
					//}))}).evenProfiled(params.clone({
					//	bias: 		bias,
					//	evenReps: 	evenReps
					//}));
					
					var evenProfile = this.evenProfiled(params.clone({
						bias: 		bias,
						evenReps: 	evenReps
					}));
					
					var beats = [];
					var inBeat = false;
					for (var i = 0, len = evenProfile.length; i < len; i++) {
						var v = evenProfile[i];
						if (!inBeat) {
							if (v > threshold) {
								inBeat = true;
								beats.push(Math.max(i - fallback, 0));
							}
						} else if (v < thresholdOut) {
							inBeat = false;
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
		
		var SoundGen = PACK.uth.makeClass({ name: 'SoundGen',
			propertyNames: [ ],
			methods: function(sc, c) { return {
				init: function(params /* */) {
					this.played = 0;
					this.playedHz = 0;
				},
				reset: function() {
					this.playedHz = 0;
					this.played = 0;
				},
				nextSample: function(params /* n, i, channel, rootHz, velocity */) {
					throw 'not implemented';
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
						c1[i] += this.nextSample(p.update({ n: this.playedHz, i: this.played, channel: 0 }));
						c2[i] += this.nextSample(p.update({ n: this.playedHz, i: this.played, channel: 1 }));
						
						if (isNaN(c1[i] + c2[i])) {
							console.log(c1[i], c2[i], p);
							throw 'NAN';
						}
						
						this.playedHz += secsPerSample;
						this.played += 1;
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
						arr[i] += this.nextSample(p.update({ n: this.playedHz, i: this.played }));
						
						this.playedHz += secsPerSample;
						this.played += 1;
					}
					
					this.reset();
				},
			}; }
		});
		
		var SoundGenSin = PACK.uth.makeClass({ name: 'SoundGenSin',
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
		
		var SoundGenTremollo = PACK.uth.makeClass({ name: 'SoundGenTremollo',
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
		
		var SoundGenSample = PACK.uth.makeClass({ name: 'SoundGenSample',
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
		
		var Midi = PACK.uth.makeClass({ name: 'Midi',
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
		
		var MidiSequence = PACK.uth.makeClass({ name: 'MidiSequence',
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
		
		var SoundApp = PACK.uth.makeClass({ name: 'SoundApp',
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
					var files = U.arr(e.target.files);
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
		canvas.setAttribute('width', '4000');
		canvas.setAttribute('height', '200');
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
					var seq = new PACK.sound.MidiSequence({
						midis: U.rng({0:20}).map(function(i) {
							var soundGen = r.randElem(beats);
							return new PACK.sound.Midi({
								offset: pieceLen * i,
								length: pieceLen,
								key: 0,
								soundGen: soundGen
							});
						})
					});
					
					//var orig = seq.genSound();
					/*var orig = new PACK.sound.SoundGenSample({ sound: sounds[0], offset: OFF * PACK.sound.context.sampleRate });
					var seq = new PACK.sound.MidiSequence({ midis: [ new PACK.sound.Midi({
						offset: 0,
						length: 5 * PACK.sound.context.sampleRate,
						key: 0,
						soundGen: orig
					}) ]});
					*/
					
					var sound = seq.genSound();
					
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					sound.draw(0, ctx, 10, 10, 3980, 180, 1);
					sound.play();
				};
				body.appendChild(go);
			}
		}));
		
		//sound.play();
	},
});
package.build();
