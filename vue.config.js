const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    configureWebpack: {
      plugins: [
        new CopyWebpackPlugin([
            { from: 'node_modules/@liveqing/liveplayer/dist/component/crossdomain.xml'},
            { from: 'node_modules/@liveqing/liveplayer/dist/component/liveplayer-lib.min.js', to: 'js/'},
            { from: 'node_modules/@liveqing/liveplayer/dist/component/liveplayer.swf'}
        ])
      ]
    },
    lintOnSave:false,
    devServer: {
      https: false,
      open: false, // 设置自动打开
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
          target: 'http://192.168.3.173:9001/',//设置你调用的接口域名和端口号 别忘了加http
          changeOrigin: true,
          pathRewrite: {
            '^/backend': '/backend'//这里理解成用‘/api’代替target里面的地址，后面组件中我们掉接口时直接用api代替 比如我要调用'http://40.00.100.100:3002/user/add'，直接写‘/api/user/add’即可
          }
        },
        '/sig': {
          target: 'http://192.168.3.173:8094/',//设置你调用的接口域名和端口号 别忘了加http
          changeOrigin: true,
          pathRewrite: {
            '^/sig': '/sig'//这里理解成用‘/api’代替target里面的地址，后面组件中我们掉接口时直接用api代替 比如我要调用'http://40.00.100.100:3002/user/add'，直接写‘/api/user/add’即可
          }
        }
      }
    }
  }
