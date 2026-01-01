var assert = require('assert');
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
var ERROR = util.ERROR;
var options = JSON.parse(decodeURIComponent(process.argv[2]));
var script = options.script;
var timer, done;
var times = 0;

process.on('message', function(msg) {
  clearTimeout(timer);
  timer = null;
  times = 0;
  if (msg == MESSAGE) {
    return;
  }
  try {
    msg = JSON.parse(msg);
    if (msg && msg.type == DATA) {
      process.emit('data', msg.data);
    }
  } catch(e) {}
});

process.sendData = function(data) {
  processSend(JSON.stringify({
    type: DATA,
    data: data
  }));
};

function processSend(msg) {
  try {
    process.send(msg, util.noop);
  } catch(e) {}
}

function errorHandler() {
  process.exit(1);
}

function keepAlive() {
  setTimeout(function() {
    processSend(MESSAGE);
    keepAlive();
  }, HEARTBEAT_INTERVAL);
  timer = timer || setTimeout(handleTimeout, HEARTBEAT_TIMEOUT);
}

function handleTimeout() {
  if (++times > 1) {
    return errorHandler();
  }
  timer = null;
  keepAlive();
}

function handleError(e) {
  var data = e ? (e.stack || e.message || String(e)) : 'unhandledRejection';
  if (typeof process._handlePforkUncaughtException === 'function' &&
    process._handlePforkUncaughtException(data, e) === false) {
    return;
  }
  processSend(JSON.stringify({
    type: ERROR,
    data: data
  }));
  setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
}
process.on('unhandledRejection', handleError);

process.on('uncaughtException', handleError);

var execScript = require(script);
assert(typeof execScript == 'function', script + ' not a function');
execScript(options, function(err, data) {
  if (done) {
    return;
  }
  done = true;
  if (err) {
    throw err;
  } else {
    processSend(JSON.stringify({
      type: MESSAGE,
      data: data
    }));
  }
});
keepAlive();
