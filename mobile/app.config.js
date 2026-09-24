module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gatewayOrigin: process.env.API_GATEWAY_ORIGIN || config.extra?.gatewayOrigin || "",
  },
});