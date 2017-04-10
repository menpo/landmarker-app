var webpack = require("webpack");
var AppCachePlugin = require('appcache-webpack-plugin');
var webpackConfig = require("./webpack.base.config.js");

webpackConfig.devtool = "source-map";  // full separate source maps
webpackConfig.bail = true;  // at any error just fallover
webpackConfig.plugins = webpackConfig.plugins.concat(
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
