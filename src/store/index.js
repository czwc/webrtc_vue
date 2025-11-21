import Vue from 'vue'
import Vuex from 'vuex'
import Events from 'events'

import mMain from './main'
Vue.use(Vuex)

const vuexWatcher = new Events()
window.vuexWatcher = vuexWatcher
const storeWatcher = (store) => {
  store.subscribe((mutation, state) => {
    vuexWatcher.emit('update', Date.now())
  })
}

const store = new Vuex.Store({
  plugins: [storeWatcher],
  modules: {
    main: mMain
  }
})

window.STORE = store

export default store
