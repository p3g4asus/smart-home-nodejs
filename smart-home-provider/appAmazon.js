__argv = ["smart-home=https://mfzaws1.ddns.net","-fSTART_TYPE=LOCAL","-fAUTO_DEV=YES","-fRESET_DEV=NO","-fWELL_KNOWN=YES","-fAUTOLOGIN=YES"];
process.chdir(__dirname);
require('./cloud/smart-home-provider-cloud.js');
