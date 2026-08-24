const path = require('node:path');

module.exports = {
  outDir: 'out-phase81',
  packagerConfig: {
    asar: true,
    name: 'PASKO License Issuer',
    executableName: 'PaskoLicenseIssuer',
    appVersion: require('./package.json').version,
    appBundleId: 'com.pasko.licenseissuer',
    icon: path.resolve(__dirname, '../../apps/desktop/assets/brand/PaskoPerformance.ico'),
    ignore: [/^\/src(?:\/|$)/, /^\/test(?:\/|$)/, /^\/scripts(?:\/|$)/, /^\/out(?:-[^\/]+)?(?:\/|$)/, /^\/(?:tsconfig\.json|forge\.config\.cjs)$/],
  },
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: {
      name: 'pasko_license_issuer',
      title: 'PASKO License Issuer',
      exe: 'PaskoLicenseIssuer.exe',
      setupExe: 'PASKO-License-Issuer-Setup-1.0.0.exe',
      setupIcon: path.resolve(__dirname, '../../apps/desktop/assets/brand/PaskoPerformance.ico'),
      noMsi: true,
      description: 'PRIVATE OPERATOR TOOL — НЕ ПЕРЕДАВАТЬ КЛИЕНТАМ',
      version: require('./package.json').version,
    },
  }],
};
