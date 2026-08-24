const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const path = require('node:path');
const product = require('../../packages/core/product-identity.json');
const releasePackage = require('../../package.json');
const windowsIcon = path.resolve(__dirname, 'assets/brand/PaskoPerformance.ico');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: product.executableName,
    appVersion: releasePackage.version,
    appBundleId: product.appUserModelId,
    name: product.shortProductName,
    icon: windowsIcon,
    extraResource: ['.runtime/web', '.runtime/postgres', '.runtime/db', '../../packages/core/product-identity.json'],
    ignore: [
      /^\/\.runtime(?:\/|$)/,
      /^\/\.cache(?:\/|$)/,
      /^\/test(?:\/|$)/,
      /^\/scripts(?:\/|$)/,
      /^\/src(?:\/|$)/,
      /^\/assets(?:\/|$)/,
      /^\/(?:README\.md|forge\.config\.cjs|postgres-runtime\.json|tsconfig\.json|\.gitignore)$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: product.squirrelName,
        title: product.shortProductName,
        exe: `${product.executableName}.exe`,
        setupExe: `${product.releaseArtifactPrefix}-${releasePackage.version}.exe`,
        setupIcon: windowsIcon,
        noMsi: true,
        authors: product.creator.nameEn,
        description: product.display,
        version: releasePackage.version,
      },
    },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};
