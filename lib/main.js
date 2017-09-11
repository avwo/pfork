var assert = require('assert');
var util = require('./util');
var HEARTBEAT_INTERVAL = util.HEARTBEAT_INTERVAL;
var HEARTBEAT_TIMEOUT = util.HEARTBEAT_TIMEOUT;
var MESSAGE = util.MESSAGE;
var DATA = util.DATA;
var options = JSON.parse(decodeURIComponent(process.argv[2]));
var script = options.script;
var execScript = require(script);
var heartbeatTimeout, done;

assert(typeof execScript == 'function', script + ' not a function');

execScript(options, function(err, data) {
  if (done) {
    return;
  }
  done = true;
  if (err) {
    console.error(err.stack || err);
  } else {
    processSend(JSON.stringify({
      type: MESSAGE,
      data: data
    }));
  }
});
keepAlive();
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

function keepAlive() {
  setTimeout(function() {
    processSend(MESSAGE);
    keepAlive();
  }, HEARTBEAT_INTERVAL);
  if (!heartbeatTimeout) {
    heartbeatTimeout = setTimeout(errorHandler, HEARTBEAT_TIMEOUT);
  }
}

function errorHandler() {
  process.exit(1);
}

function processSend(msg) {
  try {
    process.send(msg);
  } catch(e) {}
}




