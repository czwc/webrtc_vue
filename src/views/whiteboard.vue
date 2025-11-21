<template>
  <div class="demo">
    <div class="rtcBox">
      <div style="position:relative">
        <!-- <div style="position:absolute;left:20px">
            <div :class="[initIdx == idx ? 'contro-item active' : 'contro-item']" :key="idx" @click="handleTools(item, idx)" v-for="(item, idx) in toolsArr">
              <i v-show="item.icon" style="color:#fff" size="20" :class="item.icon" />
              <img v-show="!item.icon" src="../static/img/xpc.png" style="width:35%" alt="" />
            </div>
        </div> -->
        <div class="actionTool">
          <div v-for="v in handleList" :key="v.type">
            <el-color-picker
              v-model="color"
              show-alpha
              v-if="v.type === 'color'"
              @change="colorChange"
              :disabled="allowHangup"
            ></el-color-picker>
            <button
            style="width:56px"
              :disabled="
                v.type === 'cancel'
                  ? allowHangup || allowCancel
                  : v.type === 'go'
                  ? allowHangup || allowGo
                  : allowHangup
              "
              @click="handleClick(v)"
              v-if="!['color', 'lineWidth', 'polygon'].includes(v.type)"
              :class="{ active: currHandle === v.type }"
            >
              {{ v.name }}
            </button>
            <el-popover
              placement="top"
              width="400"
              trigger="click"
              v-if="v.type === 'polygon'"
            >
              <el-input-number
                v-model="sides"
                controls-position="right"
                @change="sidesChange"
                :min="3"
                :max="10"
              ></el-input-number>
              <button
                slot="reference"
                :disabled="allowHangup"
                @click="handleClick(v)"
                :class="{ active: currHandle === v.type }"
              >
                {{ v.name }}
              </button>
            </el-popover>
            <el-popover
              placement="top"
              width="400"
              trigger="click"
              v-if="v.type === 'lineWidth'"
            >
              <el-slider
                v-model="lineWidth"
                :max="20"
                @change="lineWidthChange"
              ></el-slider>
              <button slot="reference" :disabled="allowHangup">
                {{ v.name }} <i>{{ lineWidth + "px" }}</i>
              </button>
            </el-popover>
          </div>
        </div>
      </div>
      <div>
        <canvas :width="windowWidth" height="550" ref="canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { Palette } from "../utils/palette";
export default {
  name: "whiteboard",
  data() {
    return {
        handleList: [
        { name: "圆", type: "arc" },
        { name: "线条", type: "line" },
        { name: "矩形", type: "rect" },
        { name: "多边形", type: "polygon" },
        { name: "橡皮擦", type: "eraser" },
        { name: "撤回", type: "cancel" },
        { name: "前进", type: "go" },
        { name: "清屏", type: "clear" },
        { name: "线宽", type: "lineWidth" },
        { name: "颜色", type: "color" },
      ],
        toolsArr: [
        {
          name: 'undo',
          type: "cancel",
          icon: 'el-icon-refresh-left'
        },
        {
          name: 'reset',
          icon: 'el-icon-refresh',
          type: "clear"
        },
        {
          name: 'pencil',
          icon: 'el-icon-edit', type: "line"
        },
        {
          name: 'line',
          icon: 'el-icon-minus'
        },
        {
          name: 'arrow',
          icon: 'el-icon-right'
        },
        {
          name: 'text',
          icon: 'el-icon-tickets'
        },
        {
          name: 'cricle',
          icon: 'el-icon-remove-outline'
        },
        {
          name: 'juxing',
          icon: 'el-icon-crop'
        },
      
        {
          name: 'remove',
          icon: null
        }
      ],
      initIdx:0,
      windowWidth: document.documentElement.clientWidth, //获取屏幕宽度
      windowHeight: document.documentElement.clientHeight,
      peerA: null,
      peerB: null,
      offerOption: {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      },
      allowCall: true,
      allowHangup: true,
      color: "rgba(0, 0, 0, 1)",
      currHandle: "line",
      lineWidth: 5,
      palette: null, // 画板
      allowCancel: true,
      allowGo: true,
      sides: 3,
    };
  },
  methods: {
    handleTools(item,index){
        this.initIdx = index
    },
    initPalette() {
      this.palette = new Palette(this.$refs["canvas"], {
        drawColor: this.color,
        drawType: this.currHandle,
        lineWidth: this.lineWidth,
        allowCallback: this.allowCallback,
      });
    },
    allowCallback(cancel, go) {
      this.allowCancel = !cancel;
      this.allowGo = !go;
    },
    sidesChange() {
      this.palette.changeWay({ sides: this.sides });
    },
    colorChange() {
      this.palette.changeWay({ color: this.color });
    },
    lineWidthChange() {
      this.palette.changeWay({ lineWidth: this.lineWidth });
    },
    handleClick(v) {
      if (["cancel", "go", "clear"].includes(v.type)) {
        this.palette[v.type]();
        return;
      }
      this.palette.changeWay({ type: v.type });
      if (["color", "lineWidth"].includes(v.type)) return;
      this.currHandle = v.type;
    },
    start() {
      this.state = "2";
      this.newRecognition.start();
    },
    stop() {
      this.state = "1";
      this.newRecognition.stop();
    },
    async call() {
      this.allowCall = true;
      this.allowHangup = false;
    },
    hangup() {
      this.peerA.close();
      this.peerB.close();
      this.peerA = null;
      this.peerB = null;
      this.allowCall = false;
      this.allowHangup = true;
      this.palette.destroy();
      this.palette = null;
    },
    async onCreateOffer(desc) {
      try {
        await this.peerB.setLocalDescription(desc); // 呼叫端设置本地 offer 描述
      } catch (e) {
        console.log("Offer-setLocalDescription: ", e);
      }
      try {
        await this.peerA.setRemoteDescription(desc); // 接收端设置远程 offer 描述
      } catch (e) {
        console.log("Offer-setRemoteDescription: ", e);
      }
      try {
        let answer = await this.peerA.createAnswer(); // 接收端创建 answer
        await this.onCreateAnswer(answer);
      } catch (e) {
        console.log("createAnswer: ", e);
      }
    },
    async onCreateAnswer(desc) {
      try {
        await this.peerA.setLocalDescription(desc); // 接收端设置本地 answer 描述
      } catch (e) {
        console.log("answer-setLocalDescription: ", e);
      }
      try {
        await this.peerB.setRemoteDescription(desc); // 呼叫端设置远程 answer 描述
      } catch (e) {
        console.log("answer-setRemoteDescription: ", e);
      }
    },
    async createMedia() {
      // 保存本地流到全局
      this.localstream = this.$refs["canvas"].captureStream();
    },
  },
  mounted() {
    this.initPalette();
    this.call();
    this.$nextTick(() => {
      // {mediaSource: 'screen'}
      this.createMedia();
    });
  },
};
</script>

<style lang="scss" scoped>
.actionTool {
  position: absolute;
  left: 15px;
  top: 10px;
}
.rtcBox {
  display: flex;
  justify-content: center;
  width: 100%;
  canvas {
    width: 100%;
    border: 1px solid #000;
    background: #fff;
  }
  ul {
    text-align: left;
  }
}
.contro-item {
    width: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-bottom: 1px solid #dad7d9;
      text-align: center;
      cursor: pointer;
      background: #000;
      height: 38px;
      i {
        font-size: 26px;
        line-height: 50px;
      }

      &.active {
        background: rgba($color: #000000, $alpha: 0.5);
        color: #fff;
      }
    }
</style>
