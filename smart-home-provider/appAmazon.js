__flag = Config.setInside(0,"START_TYPE","LOCAL","AUTO_DEV","YES","RESET_DEV","NO","WELL_KNOWN","YES","AUTOLOGIN","YES");
__smartHomeProviderCloudEndpoint = "https://mfzaws1.ddns.net";
process.chdir(__dirname);
require('./cloud/smart-home-provider-cloud.js');
