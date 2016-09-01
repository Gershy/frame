var package = new PACK.pack.Package({ name: 'htmlText',
	buildFunc: function() {
		return {
			render: function(text) {
				return text.replace(/\n/g, '<br/>');
			}
		};
	}
});
package.build();
