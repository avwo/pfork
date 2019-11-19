var cp = require('child_process');
var path = require('path');
var assert = require('assert');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
var ERROR = util.ERROR;
var MAIN = path.join(__dirname, 'main');
var cache = {};
var version = process.version.substring(1).split('.');
var supportTlsMinV1 = version[0] > 11;
var supportMaxHeaderSize = (version[0] == 10 && version[1] >= 15) || (version[0] == 11 && version[1] > 5) || version[0] > 11;

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
    promise._firstCall = true;
  }

  promise.done(function(result) {
    callback(null, result[0], result[1], promise._firstCall);
    promise._firstCall = false;
  }, function(err) {
    callback(err, undefined, undefined, promise._firstCall);
    promise._firstCall = false;
  });

  if (!defer) {
    return;
  }

  var child, timeout, heartbeatTimeout, done, errMsg;
  var emitter = new EventEmitter();
  var args = Array.isArray(options._args) ? options._args : [];
  delete options._args;
  if (options._inspect || process.env.PFORK_MODE === 'inline') {
    var script = options.script;
    var execScript = require(script);
    assert(typeof execScript == 'function', script + ' not a function');
    execScript(options, function(err, data) {
      if (done) {
        return;
      }
      done = true;
      if (err) {
        defer.reject(err);
      } else {
        emitter.kill = util.noop;
        emitter.sendData = function(data) {
          try {
            process.emit('data', data);
          } catch (e) {}
        };
        defer.resolve([data, emitter]);
      }
    });
    return;
  }
  args.push(MAIN, encodeURIComponent(JSON.stringify(options)));
  if ((!options.execPath && supportMaxHeaderSize) || options.maxHttpHeadersSize > 0) {
    args.unshift('--max-http-header-size=' + (options.maxHttpHeadersSize || 256000));
  }
  if (!options.execPath && supportTlsMinV1) {
    args.unshift('--tls-min-v1.0');
  }
  try {
    var spawnOpts = options._detached === false || process.env.PFORK_MODE === 'bind';
    spawnOpts = spawnOpts ? { stdio: [0, 1, 2, 'ipc'] } : {
      detached: true,
      stdio: ['ipc']
    };
    child = cp.spawn(options.execPath || process.env.PFORK_EXEC_PATH || 'node', args, spawnOpts);
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
          } else if (msg.type == ERROR) {
            errorHandler(msg.data);
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
        child.send(MESSAGE, util.noop);
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
      err = typeof err === 'string' ? err : (err && err.stack);
      callbackHandler(err || errMsg || 'unknown');
    });
  }

  function killChild(delay) {
    clearTimeout(heartbeatTimeout);
    clearTimeout(timeout);
    delete cache[key];
    emitter.emit('close');
    var _kill = function() {
      try {
        process.kill(child.pid);
      } catch(e) {}
      try {
        child.removeAllListeners();
        child.on('error', util.noop);
        if (child.stderr) {
          child.stderr.removeAllListeners();
        }
      } catch(e) {}
      emitter.kill = util.noop;
      emitter.sendData = util.noop;
      emitter.emit('exit');
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
          }), util.noop);
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
