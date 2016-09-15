var package = new PACK.pack.Package({ name: 'htmlText',
	buildFunc: function() {
		return {
			render: function(text) {
				console.log('TAKING TEXT', text.replace(/\n/g, '<br/>'));
				return text.replace(/\n/g, '<br/>');
			}
		};
	}
});
package.build();
