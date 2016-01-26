var assert = require('assert');
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
var MAX_PORT = 65535;
var curPort = 60000;
var options = JSON.parse(decodeURIComponent(process.argv[2]));
var script = options.script;
var execScript = require(script);
var timeout, heartbeatTimeout, done;

assert(typeof execScript == 'function', script + ' not a function');

execScript(options, function(err, data) {
	if (done) {
		return;
	}
	done = true;
	if (err) {
		console.error(err.stack || err);
	} else {
		process.send(JSON.stringify({
			type: MESSAGE,
			data: data
		}));
	}
});
keepAlive();
process.on('message', function(msg) {
	keepAlive();
	try {
		var msg = JSON.parse(msg);
		if (msg && msg.type == DATA) {
			process.emit('data', msg.data);
		}
	} catch(e) {}
});

process.sendData = function(data) {
	try {
		process.send(JSON.stringify({
			type: DATA,
			data: data
		}));
	} catch(e) {}
};

function keepAlive() {
	clearTimeout(heartbeatTimeout);
	clearTimeout(timeout);
	timeout = setTimeout(function() {
		process.send(MESSAGE);
	}, HEARTBEAT_INTERVAL);
	heartbeatTimeout = setTimeout(handleError, HEARTBEAT_TIMEOUT);
}

function errorHandler() {
	process.exit(1);
}





