const CopyWebpackPlugin = require('copy-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');

module.exports = {
    // 生产环境配置
    productionSourceMap: false, // 关闭生产环境source map
    
    configureWebpack: config => {
      const plugins = [
        new CopyWebpackPlugin([
            { from: 'node_modules/@liveqing/liveplayer/dist/component/crossdomain.xml'},
            { from: 'node_modules/@liveqing/liveplayer/dist/component/liveplayer-lib.min.js', to: 'js/'},
            { from: 'node_modules/@liveqing/liveplayer/dist/component/liveplayer.swf'}
        ])
      ];

      // 生产环境启用gzip压缩
      if (process.env.NODE_ENV === 'production') {
        plugins.push(
          new CompressionWebpackPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 10240, // 只压缩大于10KB的文件
            minRatio: 0.8,
            deleteOriginalAssets: false
          })
        );
      }

      return {
        plugins,
        // 代码分割优化
        optimization: {
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // 第三方库单独打包
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                priority: 10,
                chunks: 'initial'
              },
              // Element UI单独打包
              elementUI: {
                test: /[\\/]node_modules[\\/]element-ui[\\/]/,
                name: 'element-ui',
                priority: 20
              },
              // 公共模块
              common: {
                minChunks: 2,
                priority: 5,
                reuseExistingChunk: true
              }
            }
          },
          // 运行时代码单独打包
          runtimeChunk: {
            name: 'runtime'
          }
        },
        // 性能提示
        performance: {
          hints: 'warning',
          maxEntrypointSize: 500000, // 入口文件最大500KB
          maxAssetSize: 300000 // 资源文件最大300KB
        }
      }
    },
    
    // CSS相关配置
    css: {
      // 生产环境提取CSS
      extract: process.env.NODE_ENV === 'production',
      // CSS source map
      sourceMap: false
    },
    
    lintOnSave:false,
    
    devServer: {
      https: false,
      open: false,
      port: 8080,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      overlay: {
        warnings: false,
        errors: false
      },
      proxy: {
        '/backend': {
          target: 'http://220.160.33.183:9001/',
          changeOrigin: true,
          pathRewrite: {
            '^/backend': '/backend'
          }
        },
        '/sig': {
          target: 'http://220.160.33.183:8094/',
          changeOrigin: true,
          pathRewrite: {
            '^/sig': '/sig'
          }
        }
      }
    }
  }
