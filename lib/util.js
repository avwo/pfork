var cp = require('child_process');

var HEARTBEAT_INTERVAL = 10000;

function execCmd(execPath, args, callback) {
  var data;
  var done;
  var timer;
  var execCb = function() {
    if (!done) {
      clearTimeout(timer);
      done = true;
      callback(data ? String(data) : '');
    }
  };
  try {
    var child = cp.spawn(execPath || 'node', args, { detached: true });
    timer = setTimeout(function() {
      try {
        process.kill(child.pid);
      } catch(e) {}
    }, 5000);
    child.on('error', execCb);
    child.on('close', execCb);
    child.on('exit', execCb);
    child.on('disconnect', execCb);
    child.stdout.on('data', function(chunk) {
      data = data ? Buffer.concat([data, chunk]) : chunk;
    });
    child.stdout.on('end', execCb);
    child.unref();
  } catch(err) {
    execCb(err);
  }
}

function getVersion(execPath, callback) {
  if (!execPath) {
    return callback(process.version);
  }
  execCmd(execPath, ['-v'], function(str) {
    if (/v\d+\.\d+\.\d+/.test(str)) {
      callback(RegExp['$&']);
    } else {
      callback('');
    }
  });
}

function getMaxSemiSpaceFlag(execPath, callback) {
  execCmd(execPath, ['--v8-options'], function(v8Options) {
    if (v8Options.indexOf('--max-semi-space-size') !== -1) {
      return callback('--max-semi-space-size');
    }
    if (v8Options.indexOf('--max_semi_space_size') !== -1) {
      return callback('--max_semi_space_size');
    }
    callback('');
  });
}

module.exports = {
  noop: function() {},
  HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT: HEARTBEAT_INTERVAL * 3,
  MESSAGE: 'pforkMessage',
  DATA: 'pforkData',
  ERROR: 'pforkError',
  getArgs: function(execPath, callback) {
    var version;
    var flag;
    var execCb = function() {
      if (version != null && flag != null) {
        callback(version, flag);
      }
    };
    getVersion(execPath, function(v) {
      version = v;
      execCb();
    });
    getMaxSemiSpaceFlag(execPath, function(f) {
      flag = f;
      execCb();
    });
  }
};
