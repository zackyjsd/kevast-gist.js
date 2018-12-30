const path = require('path');

function generateConfig(name) {
  const mode = name.includes('min') ? 'production' : 'development';
  return {
    entry: ['@babel/polyfill', './index.ts'],
    mode,
    module: {
      rules: [
        {
          test: /\.ts?$/,
          loader: 'babel-loader',
          exclude: /node_modules/
        },
        {
          test: /\.ts?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: [ '.ts', '.js' ]
    },
    output: {
      filename: `${name}.js`,
      path: path.resolve(__dirname, 'dist'),
      library: 'KevastGist',
      libraryTarget: 'umd'
    },
    devtool: 'source-map'
  }
}

module.exports = [generateConfig('kevast-gist'), generateConfig('kevast-gist.min')];
