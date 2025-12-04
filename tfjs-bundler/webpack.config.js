const path = require('path');

module.exports = {
  target: 'web',
  entry: './src/index.js',
  output: {
    filename: 'tfjs-bundle.js',
    library: {
      type: 'umd',
    },
    path: path.resolve(__dirname, 'dist'),
  },
  devtool: 'source-map',
  experiments: {
    topLevelAwait: true,
    syncWebAssembly: true
  },
  resolve: {
    fallback: {
      "os": false
    }
  },
  module: {
    rules: [
      {
        test: /\.wasm$/i,
        type: 'javascript/auto',
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ],
  },
};
