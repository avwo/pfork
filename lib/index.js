var cp = require('child_process');
var path = require('path');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
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
    return callback('options.script is required.');
  }
  var promise = cache[key];
  var defer;

  if (!promise) {
    defer = Q.defer();
    cache[key] = promise = defer.promise;
  }

  promise.done(function(result) {
    callback(null, result[0], result[1]);
  }, function(err) {
    callback(err);
  });

  if (!defer) {
    return;
  }

  var child, timeout, heartbeatTimeout, done, errMsg;
  var emitter = new EventEmitter();
  var args = Array.isArray(options._args) ? options._args : [];
  delete options._args;
  args.push(MAIN, encodeURIComponent(JSON.stringify(options)));

  try {
    child = cp.spawn(options.execPath || 'node', args, {
      detached: true,
      stdio: ['ipc']
    });
    child.on('error', errorHandler);
    child.on('close', errorHandler);
    child.on('exit', errorHandler);
    child.on('disconnect', errorHandler);
    child.on('message', function(msg) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
      if (msg == MESSAGE) {
        return;
      }

      try {
        if (msg = JSON.parse(msg)) {
          if (msg.type == MESSAGE) {
            callbackHandler(null, msg.data);
          } else if (msg.type == DATA) {
            emitter.emit('data', msg.data);
          }
        }
      } catch(e) {}
    });
    if (child.stderr) {
      child.stderr.on('data', function(data) {
        if (done || !Buffer.isBuffer(data)) {
          return;
        }
        errMsg = errMsg ? Buffer.concat([errMsg, data]) : data;
      });
    }
    child.unref();
    keepAlive();
    promise.kill = killChild;
  } catch(err) {
    errorHandler(err);
  }

  function keepAlive() {
    timeout = setTimeout(function() {
      try {
        child.send(MESSAGE);
        keepAlive();
      } catch (err) {}
    }, HEARTBEAT_INTERVAL);
    if (!heartbeatTimeout) {
      heartbeatTimeout = setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
    }
  }

  function errorHandler(err) {
    killChild();
    process.nextTick(function() {
      errMsg = errMsg && errMsg + '';
      callbackHandler(err && err.stack || errMsg || 'unknown');
    });
  }

  function killChild(delay) {
    clearTimeout(heartbeatTimeout);
    clearTimeout(timeout);
    delete cache[key];
    var _kill = function() {
      try {
        process.kill(child.pid);
        child.removeAllListeners();
        child.on('error', util.noop);
        emitter.kill = util.noop;
        emitter.sendData = util.noop;
        emitter.emit('exit');
        if (child.stderr) {
          child.stderr.removeAllListeners();
        }
      } catch(e) {}
    };
    delay > 0 ? setTimeout(_kill, delay) : _kill();
  }

  function callbackHandler(err, data) {
    if (done) {
      return;
    }
    done = true;
    if (err) {
      defer.reject(err);
    } else {
      emitter.kill = killChild;
      emitter.sendData = function(data) {
        try {
          child.send(JSON.stringify({
            type: DATA,
            data: data
          }));
        } catch(e) {}
      };
      defer.resolve([data, emitter]);
    }
  }
}

exports.fork = fork;

function kill(options, delay) {
  var key = getKey(options);
  if (!key) {
    return;
  }
  var child = cache[key];
  if (!child) {
    return;
  }
  child.kill(delay);
}

exports.kill = kill;

function exists(options) {
  var key = getKey(options);
  if (!key || !cache[key]) {
    return false;
  }

  return true;
}

exports.exists = exists;

