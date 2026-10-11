// DR1 shell. The gateway app's native additions go here, so no other app gets them: SEND_SMS
// (DR5 spike), the gateway service, its boot receiver and the development-only cleartext rule for
// localhost (DR7). Added to the plugins list by app.config.js for APP_VARIANT=gateway only.

module.exports = function withGatewayAndroid(config) {
  return config;
};
