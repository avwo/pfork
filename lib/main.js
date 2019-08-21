var assert = require('assert');
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
var ERROR = util.ERROR;
var options = JSON.parse(decodeURIComponent(process.argv[2]));
var script = options.script;
var heartbeatTimeout, done;

process.on('message', function(msg) {
  clearTimeout(heartbeatTimeout);
  heartbeatTimeout = null;
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
  if (!heartbeatTimeout) {
    heartbeatTimeout = setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
  }
}

process.on('uncaughtException', function (e) {
  processSend(JSON.stringify({
    type: ERROR,
    data: e.stack
  }));
  setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
});

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
