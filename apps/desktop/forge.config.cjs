const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const path = require('node:path');
const product = require('../../packages/core/product-identity.json');
const windowsIcon = path.resolve(__dirname, 'assets/brand/PaskoPerformance.ico');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: product.executableName,
    appBundleId: product.appUserModelId,
    name: product.electronName,
    icon: windowsIcon,
    extraResource: ['.runtime/web', '.runtime/postgres', '../../packages/core/product-identity.json'],
    ignore: [/^\/\.runtime(?:\/|$)/],
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: product.squirrelName, setupIcon: windowsIcon } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
