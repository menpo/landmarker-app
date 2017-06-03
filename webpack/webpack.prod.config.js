var webpack = require("webpack");
var AppCachePlugin = require('appcache-webpack-plugin');
var webpackConfig = require("./webpack.base.config.js");

for (var i = 0; i < webpackConfig.length; i++) {
    var config = webpackConfig[i];
    config.devtool = "source-map";  // full separate source maps
    config.bail = true;  // at any error just fallover
    config.plugins = config.plugins.concat(
        new webpack.DefinePlugin({
            "process.env": {
                // This has effect on the react lib size
                "NODE_ENV": JSON.stringify("production")
            }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin()
    );
}


module.exports = webpackConfig;
