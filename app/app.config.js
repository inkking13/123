// GitHub Pages serves the web build from /<repo>/, so the CI build sets
// EXPO_BASE_URL; local dev and native builds leave it unset.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
