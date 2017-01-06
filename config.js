//module.exports.defaultApp = 'ahoy';
//module.exports.defaultApp = 'defend';
//module.exports.defaultApp = 'parse';
//module.exports.defaultApp = 'sound';
//module.exports.defaultApp = 'match';
//module.exports.defaultApp = 'userify';
//module.exports.defaultApp = 'ctrl';
module.exports.defaultApp = 'logic';

module.exports.legalExtensions = {
	// "!" preceeding the extension name indicates a binary filetype
	'.html' : 	'text/html',
	'.js': 		'application/javascript', 
	'.css': 	'text/css',
	'.txt': 	'text/plain',
	'.jpg': 	'!image/jpeg',
	'.gif': 	'!image/gif',
	'.png': 	'!image/png',
	'.ico':		'!image/x-icon',
	'.eot': 	'!font/eot',
	'.woff': 	'!font/woff',
	'.ttf': 	'!font/ttf',
	'.svg': 	'!image/svg+xml'
};
