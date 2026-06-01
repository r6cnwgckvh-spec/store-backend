const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix for react-native 0.81.5 missing VirtualView module on EAS cloud
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './src/private/components/virtualview/VirtualView') {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
