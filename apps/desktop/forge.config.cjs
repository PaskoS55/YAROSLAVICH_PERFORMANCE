const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');

module.exports = {
  packagerConfig: { asar: true },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: 'yaroslavich_performance' } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
