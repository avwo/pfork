var HEARTBEAT_INTERVAL = 10000;

module.exports = {
  noop: function() {},
  HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT: HEARTBEAT_INTERVAL * 3,
  MESSAGE: 'pforkMessage',
  DATA: 'pforkData',
  ERROR: 'pforkError'
};
