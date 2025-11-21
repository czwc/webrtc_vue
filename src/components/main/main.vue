<!--  -->
<template>
  <div>
    <el-container>
      <el-main><router-view /></el-main>
    </el-container>
  </div>
</template>

<script>
import meuns from '../../router/index'
export default {
  data () {
    return {
      activeIndex: '',
      routemenus:[],
    };
  },

  components: {},

  computed: {},

  mounted(){
    this.routemenus = meuns.options.routes[0].children
    let nowPath = sessionStorage.getItem('nowPath')
    if (nowPath) {
      this.activeIndex = nowPath;
    }else {
      this.activeIndex = this.routemenus[0].path;
    }
  },

  methods: {
    handleSelect(key, keyPath) {
      let nowPath = sessionStorage.getItem('nowPath')
      if (key!=nowPath) {
        this.$router.push({path:key})
        sessionStorage.setItem('nowPath',key)
      }
        console.log(key, keyPath);
      }
  }
}

</script>
<style lang='less' scoped>
  body{
    padding: 0!important;
  }
  .el-header{
    padding:0!important
  }
.el-card__body{
    padding:0!important
  }
 .el-main{
    padding:0!important
  }
</style>
