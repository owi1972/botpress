import CleanWebpackPlugin from 'clean-webpack-plugin'
import fs from 'fs'
import _ from 'lodash'
import path from 'path'
import webpack from 'webpack'

import { debug, error, normal } from './log'

const libraryTarget = mod => `botpress = typeof botpress === "object" ? botpress : {}; botpress["${mod}"]`

export function config(projectPath) {
  const packageJson = require(path.join(projectPath, 'package.json'))

  const web: webpack.Configuration = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.argv.find(x => x.toLowerCase() === '--nomap') ? false : 'source-map',
    entry: ['./src/views/index.jsx'],
    output: {
      path: path.resolve(projectPath, './assets/web'),
      publicPath: '/js/modules/',
      filename: 'web.bundle.js',
      libraryTarget: 'assign',
      library: libraryTarget(packageJson.name)
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      'react-bootstrap': 'ReactBootstrap'
    },
    resolveLoader: {
      modules: ['node_modules', path.resolve(projectPath, './node_modules/module-builder/node_modules')]
    },
    resolve: {
      extensions: ['.js', '.jsx']
    },
    plugins: [new CleanWebpackPlugin([path.resolve(projectPath, './assets/web')], { root: projectPath })],
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env'], '@babel/preset-typescript', '@babel/preset-react'],
              plugins: [
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-syntax-function-bind',
                '@babel/plugin-proposal-function-bind'
              ]
            }
          },
          exclude: /node_modules/
        },
        {
          test: /\.scss$/,
          use: [
            { loader: 'style-loader' },
            {
              loader: 'css-loader',
              options: {
                modules: true,
                importLoaders: 1,
                localIdentName: packageJson.name + '__[name]__[local]___[hash:base64:5]'
              }
            },
            { loader: 'sass-loader' }
          ]
        },
        {
          test: /\.css$/,
          use: [{ loader: 'style-loader' }, { loader: 'css-loader' }]
        },
        {
          test: /font.*\.(woff|woff2|svg|eot|ttf)$/,
          use: { loader: 'file-loader', options: { name: '../fonts/[name].[ext]' } }
        },
        {
          test: /\.(jpe?g|png|gif|svg)$/i,
          use: [{ loader: 'file-loader', options: { name: '[name].[hash].[ext]' } }]
        }
      ]
    }
  }

  if (packageJson.webpack) {
    _.merge(web, packageJson.webpack)
  }

  const liteViews = (packageJson.botpress && packageJson.botpress.liteViews) || {}
  const lite: webpack.Configuration = Object.assign({}, web, {
    entry: liteViews,
    output: {
      path: path.resolve(projectPath, './assets/web'),
      publicPath: '/js/lite-modules/',
      filename: '[name].bundle.js',
      libraryTarget: 'assign',
      library: libraryTarget(packageJson.name)
    }
  })

  const webpackFile = path.join(projectPath, 'webpack.frontend.js')
  if (fs.existsSync(webpackFile)) {
    debug('Webpack override found for frontend')
    return require(webpackFile)({ web, lite })
  }

  const configs = [web]
  if (Object.keys(liteViews).length) {
    configs.push(lite)
  }
  return configs
}

function writeStats(err, stats, exitOnError = true) {
  if (err || stats.hasErrors()) {
    error(stats.toString('minimal'))
    if (exitOnError) {
      return process.exit(1)
    }
  }

  for (const child of stats.toJson().children) {
    normal(`Generated frontend bundle (${child.time} ms)`)
  }
}

export function watch(projectPath: string) {
  const confs = config(projectPath)
  const compiler = webpack(confs)
  compiler.watch({}, (err, stats) => writeStats(err, stats, false))
}

export function build(projectPath: string) {
  const confs = config(projectPath)
  webpack(confs, (err, stats) => writeStats(err, stats, true))
}
