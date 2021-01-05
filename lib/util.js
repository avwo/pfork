var cp = require('child_process');

var HEARTBEAT_INTERVAL = 10000;

module.exports = {
  noop: function() {},
  HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT: HEARTBEAT_INTERVAL * 3,
  MESSAGE: 'pforkMessage',
  DATA: 'pforkData',
  ERROR: 'pforkError',
  getVersion: function(execPath) {
    if (!execPath) {
      return process.version;
    }
    if (typeof cp.spawnSync === 'function') {
      try {
        if (/v\d+\.\d+\.\d+/.test(String(cp.spawnSync(execPath, ['-v']).output))) {
          return RegExp['$&'];
        }
      } catch (e) {}
    }
  },
  getMaxSemiSpaceFlag: function(execPath) {
    if (typeof cp.spawnSync !== 'function') {
      return;
    }
    try {
      var v8Options = String(cp.spawnSync(execPath || 'node', ['--v8-options']).output);
      if (v8Options.indexOf('--max-semi-space-size') !== -1) {
        return '--max-semi-space-size';
      }
      if (v8Options.indexOf('--max_semi_space_size') !== -1) {
        return '--max_semi_space_size';
      }
    } catch (e) {}
  }
};
