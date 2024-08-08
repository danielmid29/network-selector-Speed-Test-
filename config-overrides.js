module.exports = function override(config, env) {
  // Add fallbacks for Node.js modules
  config.resolve.fallback = {
    fs: false,
    path: require.resolve("path-browserify"),
    electron: require.resolve("electron"),
  };

  // Return the updated config
  return config;
};
