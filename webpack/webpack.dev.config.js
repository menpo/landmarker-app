var webpackConfig = require("./webpack.base.config.js");

for (var i = 0; i < webpackConfig.length; i++) {
    var config = webpackConfig[i];
    config.devtool = "source-map";
    config.debug = true;
    config.output.publicPath = '/';
}

module.exports = webpackConfig;
