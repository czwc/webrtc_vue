<template>
  <div id="app" class="app">
    <Loading v-if="loading" text="正在加载直播系统..." />
    <router-view v-else />
  </div>
</template>

<script>
import Loading from '@/components/Loading.vue'

export default {
  name: 'App',
  components: {
    Loading
  },
  data() {
    return {
      loading: true
    }
  },
  mounted() {
    // 首屏加载完成后隐藏loading
    this.$nextTick(() => {
      setTimeout(() => {
        this.loading = false
      }, 300)
    })
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  color: #2c3e50;
  width: 100%;
  height: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
