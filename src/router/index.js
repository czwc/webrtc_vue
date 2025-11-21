import Vue from 'vue'
import Router from 'vue-router'
import HelloWorld from '@/views/liveDemo/HelloWorld'
import Main from '@/components/main/main'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'main',
      component: Main,
      redirect: '/HelloWorld',
      children:[
        {
          path: '/HelloWorld',
          name: 'HelloWorld',
          cnName:'直播1',
          component: () => import('@/views/liveDemo/HelloWorld'),
        },
        // {
        //   path: '/live',
        //   name: 'Live',
        //   cnName:'直播2',
        //   component: () => import('@/views/liveDemo/live'),
        // }
      ]
    },
  ]
})
