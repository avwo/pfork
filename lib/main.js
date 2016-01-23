var assert = require('assert');
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var MAX_PORT = 65535;
var curPort = 60000;
var options = JSON.parse(decodeURIComponent(process.argv[2]));
var script = options.script;
var execScript = require(script);
var timeout, heartbeatTimeout;

assert(typeof execScript == 'function', script + ' not a function');

execScript(options, function(err, data) {
	if (err) {
		console.error(err.stack || err);
	} else {
		process.send(JSON.stringify({
			type: MESSAGE,
			data: data
		}));
	}
});
heartbeat();
process.on('message', heartbeat);

function heartbeat() {
	clearTimeout(heartbeatTimeout);
	clearTimeout(timeout);
	timeout = setTimeout(function() {
		process.send(MESSAGE);
	}, HEARTBEAT_INTERVAL);
	heartbeatTimeout = setTimeout(handleError, HEARTBEAT_TIMEOUT);
}

function handleError() {
	process.exit(1);
}





