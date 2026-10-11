// DR1 shell. The driver app's native additions go here, so the commuter app never gets them:
// the beacon service and boot receiver with their Bluetooth permissions (DR4), the SMS receivers
// and RECEIVE_SMS (DR5). Added to the plugins list by app.config.js for APP_VARIANT=driver only.

module.exports = function withDriverAndroid(config) {
  return config;
};
