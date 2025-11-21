<!--
 * @Author: czw
 * @Date: 2022-09-02 14:09:54
 * @LastEditors: czw
 * @LastEditTime: 2022-09-02 15:02:56
 * @FilePath: \liveplayer-vc-master\src\components\LivePlayerDemo.vue
 * @Description:
 *
 * Copyright (c) 2022 by czw/bysc, All Rights Reserved.
-->
<template>
<div class="hello">
    <div style="margin:10px">视频1地址：<input v-model="videoUrl1"/><li><a @click="play1" rel="noopener">播放</a></li></div>
    <div style="margin:10px">视频2地址：<input v-model="videoUrl2"/><li><a @click="play2" rel="noopener">播放</a></li></div>
    <div style="margin:10px">视频3地址：<input v-model="videoUrl3"/><li><a @click="play3" rel="noopener">播放</a></li></div>

    <div style="width:512px;height:300px;margin:auto">
        <LivePlayer ref="player1" :videoUrl="videoUrl1" />
    </div>
    <div style="width:512px;height:300px;margin:auto">
        <LivePlayer ref="player2" :videoUrl="videoUrl2" />
    </div>
    <div style="width:512px;height:300px;margin:auto">
        <LivePlayer ref="player3" :videoUrl="videoUrl3" />
    </div>
    <!-- <h1>{{ msg }}</h1>
    <h3>相关说明</h3>
    <ul>
        <li><a href="https://www.liveqing.com/docs/manuals/LivePlayer.html#%E5%B1%9E%E6%80%A7-property" target="_blank" rel="noopener">属性(Property)</a></li>
        <li><a href="https://www.liveqing.com/docs/manuals/LivePlayer.html#%E6%96%B9%E6%B3%95-medthod" target="_blank" rel="noopener">方法(Medthod)</a></li>
        <li><a href="https://www.liveqing.com/docs/manuals/LivePlayer.html#%E4%BA%8B%E4%BB%B6-event" target="_blank" rel="noopener">事件(Event)</a></li>
    </ul> -->

    <!-- <h3>方法调用示例</h3>
    <ul>
        <li><a @click="pause" rel="noopener">暂停</a></li>
        <li><a @click="play" rel="noopener">播放</a></li>
        <li><a @click="snap" rel="noopener">截图数据</a></li>
    </ul> -->
    <br/>
    <br/>
</div>
</template>

<script>
import LivePlayer from '@liveqing/liveplayer'
export default {
    name: 'LivePlayerDemo',
    components: {
        LivePlayer
    },
    props: {
        msg: String
    },
    data(){
      return{
        videoUrl1:'',
        videoUrl2:'',
        videoUrl3:''
      }
    },
    computed: {
        mp4URL() {
            return 'http://192.168.3.250:8888/GetFile/631183b03a8aa3375681d287'
        },
        flvURL() {
            return `${location.protocol}//${location.host}/video.flv`
        }
    },
    methods: {
        pause: function () {
            this.$refs.player2.pause();
        },
        play: function () {
            this.$refs.player1.play();
            this.$refs.player2.play();
        },
        play1: function () {
            this.$refs.player1.play();
        },
        play2: function () {
            this.$refs.player2.play();
        },
        play3: function () {
            this.$refs.player3.play();
        },
        snap: function () {
            this.$refs.player2.snap();
        },
        snapOutside: function (snapData) {
            alert(snapData)
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>
h3 {
    margin: 40px 0 0;
}

ul {
    list-style-type: none;
    padding: 0;
}

li {
    display: inline-block;
    margin: 0 10px;
    cursor: pointer;
}

a {
    color: #42b983;
}
</style>
