var path = require('path');
var autoprefixer = require('autoprefixer');

const PATHS = {
    build: path.join(path.dirname(__dirname), 'app')
};

module.exports = [
    {
        name: 'main',
        entry: './app/ts/index.ts',
        output: {
            path: PATHS.build,
            filename: 'bundle.main.js'
        },
        resolve: {
            extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js', '.scss']
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
                    loader: 'json'
                },
                {
                    test: /\.scss$/,
                    loaders: ['style', 'css?sourceMap', 'resolve-url', 'sass?sourceMap', 'postcss']
                },
                {
                    test: /\.svg$/,
                    loader: 'url-loader',
                    options: {
                        limit: 50000,
                        mimetype: 'image/svg+xml'
                    }
                },
                {
                    test: /\.woff$/,
                    loader: 'url-loader',
                    options: {
                        limit: 50000,
                        mimetype: 'application/font-woff'
                    }
                },
                {
                    test: /\.ttf$/,
                    loader: 'url-loader',
                    options: {
                        limit: 50000,
                        mimetype: 'application/octet-stream'
                    }
                },
                {
                    test: /\.eot$/,
                    loader: 'url-loader',
                    options: {
                        limit: 50000,
                        mimetype: 'application/vnd.ms-fontobject'
                    }
                },
                {
                    test: /\.(png|jpg)$/,
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
    },
    {
        name: 'preferences',
        entry: './app/ts/preferences.ts',
        output: {
            path: PATHS.build,
            filename: 'bundle.preferences.js'
        },
        resolve: {
            extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js', '.scss']
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
                    loader: 'json'
                }
            ]
        },
        target: 'electron-renderer',
        ts: {
            visualStudioErrorFormat: true
        },
        plugins: []
    }
];
