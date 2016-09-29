var p = PACK.creativity;
var qd = PACK.quickDev;
var root = p.queryHandler;

var users = root.getChild('users');
var blurbs = root.getChild('blurbs');
var storyItems = root.getChild('storyItems');
var votables = root.getChild('votables');

({	ari: 		'ari117',
	daniel: 	'daniel228',
	gershom: 	'gershom331',
	levi: 		'levi443',
	yehuda: 	'yehuda556'
}).forEach(function(v, k) { users.getNewChild({ username: k, password: v }); });

/*
[
	[ 'gershom', 'Howdy.' ],
	[ 'levi', 'My name is Bill,' ],
	[ 'ari', 'but you can call me Reginald the Fourth.' ],
	[ 'yehuda', 'Actually, please do go with Reginald.' ],
	[ 'daniel', 'If you ever call me Bill,' ],
	[ 'gershom', 'even once,' ],
	[ 'levi', 'I mean just even try it you' ],
	[ 'ari', 'fucking little scumbag,' ],
	[ 'yehuda', 'and you will feel the wrath of not only my niece, Egret,' ],
	[ 'daniel', 'but also that of the dangerous Etherlord Waqqagrub.\n\n' ],
	[ 'gershom', 'So just try it.' ],
	[ 'levi', 'I fucking dare you.' ],
	[ 'ari', 'Call me Bill.' ],
	[ 'yehuda', 'Call me Bill you fuckass.' ],
].forEach(function(d) {
	var blurb = blurbs.getNewChild({ username: d[0], text: d[1] });
	storyItems.getNewChild({ blurb: blurb });
});

[
	[ 'levi', 'Hahaha.' ],
	[ 'ari', 'Huehuehuehue.' ],
	[ 'yehuda', 'LOL OWNED.' ],
	[ 'daniel', 'You won\'t, you\'re a pansy!' ],
].forEach(function(d) {
	var blurb = blurbs.getNewChild({ username: d[0], text: d[1] });
	votables.getNewChild({ blurb: blurb });
});
*/

var migrations = new qd.QMigration({ name: 'head',
	apply: function(data) { return { msg: 'beginning migrations.', data: data }; }
});
migrations.chain([
	new qd.QMigration({ name: 'string to json',
		apply: function(data) {
			return data.constructor === String
				? { msg: 'parsed json',	data: JSON.parse(data) }
				: { msg: 'no change.',	data: data };
		}
	})
]);

root.getState(function(state) {
	if (state !== null) {
		console.log('Loading saved state...');
		
		var schemaParams = migrations.run(state);
		var schema = new PACK.quickDev.QSchema(schemaParams);
		
		schema.assign({ elem: root,	recurse: true });
		
		var startedMillis = root.getChild('resolutionTimer.startedMillis').value;
		if (startedMillis !== -1) {
			
			var target = root.getChild('resolutionTimer.delaySeconds').value;
			var millisRemaining = (target * 1000) - (new Date() - startedMillis);
			
			if (millisRemaining > 0) {
				
				root.resolutionTimerRef = setTimeout(function() {
					root.resolveVote();
				}, millisRemaining);
				
			} else {
				
				root.resolveVote();
				
			}
			
		}
		
	}
});

var dbUpdate = new qd.QUpdate({
	request: function(cb) { root.setState(root.schemaParams(), cb); },
	start: function() {},
	end: function(response) { }
});
dbUpdate.repeat({ delay: 500 });
