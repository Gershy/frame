var package = new PACK.pack.Package({ name: 'tasks',
	dependencies: [],
	buildFunc: function() {
		return {
			Task: U.makeClass({ name: 'Task',
				propertyNames: [ ],
				methods: function(sc, c) { return {
					init: function(params /* start, beforeChunk, work, afterChunk, end */) {
						this.start = 		U.param(params, 'start', null);
						this.beforeChunk = 	U.param(params, 'beforeChunk', null);
						this.work = 		U.param(params, 'work');
						this.afterChunk = 	U.param(params, 'afterChunk', null);
						this.end = 			U.param(params, 'end', null);
						
						this.intervalId = null;
					},
					run: function(params /* items, onProgress, totalTasks, tasksPerTick, sleepTime */) {
						var totalTasks = 	U.param(params, 'totalTasks');
						var items = 		U.param(params, 'items', {});
						var onProgress = 	U.param(params, 'onProgress', null);
						var tasksPerTick = 	U.param(params, 'tasksPerTick', 10000);
						var sleepTime = 	U.param(params, 'sleepTime', 10);
						
						var pass = this;
						
						// Run the progress callback guaranteeing that it is called with 0
						if (onProgress) onProgress(0, totalTasks);
						
						var count = 0;
						var intervalFunc = sleepTime !== 'anim' ? PACK.tasks.timedCallbackFunc : PACK.tasks.animCallbackFunc;
						
						this.intervalId = intervalFunc(function() {
							if (pass.intervalId === null) return;
							
							var tasksAlready = count * tasksPerTick;
							var tasksThisTick = Math.min(tasksPerTick, totalTasks - tasksAlready);
							var tasksByTickEnd = tasksAlready + tasksThisTick;
							
							if (tasksAlready === 0 && pass.start) pass.start(items);
							
							if (pass.beforeChunk) pass.beforeChunk(items, tasksDone);
							for (var tasksDone = tasksAlready; tasksDone < tasksByTickEnd; tasksDone++)	pass.work(items, tasksDone);
							if (pass.afterChunk) pass.afterChunk(items, tasksDone);
							
							if (onProgress) onProgress(tasksDone, totalTasks);
							
							if (tasksDone >= totalTasks) {
								var intervalFuncEnd = sleepTime !== 'anim' ? PACK.tasks.timedCallbackFuncEnd : PACK.tasks.animCallbackFuncEnd;
								intervalFuncEnd(pass.intervalId);
								pass.intervalId = null;
								if (pass.end) pass.end(items);
								
								// Sanity check over here
								if (tasksDone > totalTasks) throw 'WORKED TOO MANY TIMES (' + tasksDone + ' / ' + totalTasks + ')';
							}
							
							count++;
						}, sleepTime);
					},
				}; },
			}),
			timedCallbackFunc: setInterval,
			timedCallbackFuncEnd: clearInterval,
			animCallbackFunc: function(it, delay) {
				var id = { running: true };
				
				var func = function() {
					if (!id.running) return;
					it();
					requestAnimationFrame(func);
				};
				
				// Set the loop in motion, and return the id
				requestAnimationFrame(func);
				return id;
			},
			animCallbackFuncEnd: function(animId) {
				animId.running = false;
			}
		};
	}
});
package.build();
