var cp = require('child_process');
var path = require('path');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var MAIN = path.join(__dirname, 'main');
var cache = {};

function getKey(options) {
	var key = options && options.script;
	if (typeof key != 'string' || !(key = key.trim())) {
		return;
	}
	
	if (typeof options.value == 'string') {
		key = encodeURIComponent(key) + '?value=' + encodeURIComponent(options.value);
	}
	return key;
}

function fork(options, callback) {
	var key = getKey(options);
	if (!key) {
		return;
	}
	var promise = cache[key];
	var defer;
	
	if (!promise) {
		defer = Q.defer();
		cache[key] = promise = defer.promise;
	}
	
	promise.done(function(ports) {
		callback(null, ports);
	}, function(err) {
		callback(err);
	});
	
	if (!defer) {
		return;
	} 
	
	var timeout, heartbeatTimeout, done;
	var args = Array.isArray(options._args) ? options._args : [];
	delete options._args;
	args.push(MAIN, JSON.stringify(options));
	var child = cp.spawn('node', args, {
		detached: true,
		stdio: ['ipc']
	});
	
	child.on('error', errorHandler);
	child.on('close', errorHandler);
	child.on('exit', errorHandler);
	child.on('disconnect', errorHandler);
	child.on('message', function(msg) {
		 keepAlive();
		if (msg == MESSAGE) {
			return;
		}
		
		try {
			msg = JSON.parse(msg);
			if (msg.type == MESSAGE) {
				callbackHandler(null, msg.data);
			}
		} catch(e) {}
	});
	child.stderr.on('data', function(err) {
		if (done) {
			return;
		}
		err = err + '';
		killChild();
		callbackHandler(err);
	});
	child.unref();
	keepAlive();
	promise.kill = killChild;
	
	function keepAlive() {
		clearAllTimeout();
		timeout = setTimeout(function() {
			child.send(MESSAGE);
		}, HEARTBEAT_INTERVAL);
		heartbeatTimeout = setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
	}
	
	function clearAllTimeout() {
		clearTimeout(heartbeatTimeout);
		clearTimeout(timeout);
	}
	
	function errorHandler(err) {
		killChild();
		process.nextTick(function() {
			callbackHandler(err && err.stack || 'Error');
		});
	}
	
	function killChild() {
		clearAllTimeout();
		delete cache[key];
		try {
			process.kill(child.pid);
		} catch(e) {}
	}

	function callbackHandler(err, data) {
		if (done) {
			return;
		}
		done = true;
		if (err) {
			defer.reject(err);
		} else {
			defer.resolve(data);
		}
	}
}

exports.fork = fork;

function kill(options) {
	var key = getKey(options);
	if (!key) {
		return;
	}
	var child = cache[key];
	if (!child) {
		return;
	}
	child.kill();
}

exports.kill = kill;

