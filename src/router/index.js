import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  mode: 'hash', // 使用hash模式，避免需要服务器配置
  routes: [
    {
      path: '/',
      name: 'main',
      component: () => import(/* webpackChunkName: "main" */ '@/components/main/main'),
      redirect: '/HelloWorld',
      children:[
        {
          path: '/HelloWorld',
          name: 'HelloWorld',
          cnName:'直播1',
          // 路由级代码分割，生成单独的chunk
          component: () => import(/* webpackChunkName: "hello-world" */ '@/views/liveDemo/HelloWorld'),
        },
        // {
        //   path: '/live',
        //   name: 'Live',
        //   cnName:'直播2',
        //   component: () => import(/* webpackChunkName: "live" */ '@/views/liveDemo/live'),
        // }
      ]
    },
  ]
})
