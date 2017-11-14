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
					},
					run: function(params /* onProgress, totalTasks, tasksPerTick, sleepTime */) {
						var totalTasks = 	U.param(params, 'totalTasks');
						var onProgress = 	U.param(params, 'onProgress', null);
						var tasksPerTick = 	U.param(params, 'tasksPerTick', 10000);
						var sleepTime = 	U.param(params, 'sleepTime', 10);
						
						var pass = this;
						
						// Run the progress callback guaranteeing that it is called with 0
						if (onProgress) onProgress(0, totalTasks);
						
            if (sleepTime === 'anim') {
              var startFunc = PACK.tasks.animCallbackFunc;
              var stopFunc = PACK.tasks.animCallbackFuncEnd;
            } else {
              var startFunc = PACK.tasks.timedCallbackFunc;
              var stopFunc = timedCallbackFuncEnd;
            }
            
            var count = 0;
            var func = function() {
							if (intervalId === ENDED) return;
							
							var tasksAlready = count * tasksPerTick;
							var tasksByTickEnd = tasksAlready + Math.min(tasksPerTick, totalTasks - tasksAlready);
							
							if (tasksAlready === 0 && pass.start) pass.start();
							
							if (pass.beforeChunk) pass.beforeChunk(tasksDone);
							for (var tasksDone = tasksAlready; tasksDone < tasksByTickEnd; tasksDone++)	pass.work(tasksDone);
							if (pass.afterChunk) pass.afterChunk(tasksDone);
							
							if (onProgress) onProgress(tasksDone, totalTasks);
							
							if (tasksDone === totalTasks) {
                stopFunc(intervalId);
								intervalId = ENDED;
								if (pass.end) pass.end();
							}
							
							count++;
						};
						var intervalId = startFunc(func, sleepTime);
					},
				}; },
			}),
      ENDED: { ended: true },
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
