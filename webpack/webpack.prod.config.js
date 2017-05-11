var webpack = require("webpack");
var AppCachePlugin = require('appcache-webpack-plugin');
var webpackConfig = require("./webpack.base.config.js");

var mainConfig = webpackConfig[0];

mainConfig.devtool = "source-map";  // full separate source maps
mainConfig.bail = true;  // at any error just fallover
mainConfig.plugins = mainConfig.plugins.concat(
    new webpack.DefinePlugin({
        "process.env": {
            // This has effect on the react lib size
            "NODE_ENV": JSON.stringify("production")
        }
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin()
);

module.exports = webpackConfig;
