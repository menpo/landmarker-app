var webpackConfig = require("./webpack.base.config.js");
var mainConfig = webpackConfig[0];
mainConfig.devtool = "source-map";
mainConfig.debug = true;
mainConfig.output.publicPath = '/';

module.exports = webpackConfig;
