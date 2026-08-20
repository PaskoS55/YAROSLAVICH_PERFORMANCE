const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const product = require('../../packages/core/product-identity.json');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: product.executableName,
    appBundleId: product.appUserModelId,
    name: product.electronName,
    extraResource: ['.runtime/web', '.runtime/postgres', '../../packages/core/product-identity.json'],
    ignore: [/^\/\.runtime(?:\/|$)/],
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: product.squirrelName } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
