var path = require('path');
var autoprefixer = require('autoprefixer');

const PATHS = {
    build: path.join(path.dirname(__dirname), 'app')
};

module.exports = {
    entry: "./app/ts/index.ts",
    output: {
        path: PATHS.build,
        filename: "bundle.js"
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            {
                test: /\.tsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'ts'
            },
            {
                test: /\.json$/,
                loader: "json"
            },
            {
                test: /\.scss$/,
                loaders: ["style", "css?sourceMap", "resolve-url", "sass?sourceMap", "postcss"]
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2)$/,
                loader: 'file-loader?name=fonts/[name].[ext]&outputPath=fonts/out/'
            },
            {
                test: /\.(png|jpg|svg)$/,
                loader: 'url?limit=8192'  // inline base64 URLs for <=8k images, direct URLs for the rest
            }
        ]
    },
    postcss: function () {
        return [autoprefixer];
    },
    target: 'electron-renderer',
    ts: {
        visualStudioErrorFormat: true
    },
    plugins: []
};
