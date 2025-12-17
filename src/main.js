import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
// import './plugins/element' // 按需引入Element UI
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

Vue.use(ElementUI);
Vue.config.productionTip = false

// 路由懒加载时显示loading
router.beforeEach((to, from, next) => {
  // 可以添加全局loading
  next()
})

new Vue({
  render: h => h(App),
  router,
  store,
}).$mount('#app')
