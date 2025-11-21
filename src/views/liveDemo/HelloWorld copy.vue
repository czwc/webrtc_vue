<template>
  <div class="meetbg">
    <el-button style="position:absolute;top:80vh;left:20px;z-index: 999999999;" icon="el-icon-s-fold" @click="drawer=true" circle></el-button>
    <div style="width: 100%">
      <div
        class="control-panel"
        style="
          display: flex;
          flex-direction: row;
          justify-content: center;
          margin-top: 20px;
        "
      >
        <el-button
          style="margin-left: 6px"
          @click="createRoom"
          v-if="!isJoined"
        >
          创建直播间</el-button
        >
        <el-input
          style="width: 250px; margin-left: 6px"
          v-model="roomId"
          placeholder="请输入房间号"
        ></el-input>
        <el-input
          style="width: 250px; margin-left: 6px"
          v-model="username"
          placeholder="请输入用户名"
        ></el-input>
        <el-select
          @change="getLiveRole"
          style="width: 100px; margin:0 6px"
          v-model="liverole"
          placeholder="请选择角色"
        >
          <el-option key="admin" label="主持人" value="admin"> </el-option>
          <el-option key="user" label="观众" value="user"> </el-option>
        </el-select>
        <el-select
          multiple
          @change="getGroups"
          style="width: 200px; margin:0 6px"
          v-model="groups"
          placeholder="请选择分组"
        >
          <el-option key="1" label="组1" value="1"></el-option>
          <el-option key="2" label="组2" value="2"></el-option>
          <el-option key="3" label="组3" value="3"></el-option>
        </el-select>
        <el-button type="primary" style="margin-left: 6px" @click="JoinLive" v-if="!isJoined">
          加入直播</el-button
        >
        <el-button
          type="primary"
          style="margin-left: 6px"
          v-if="isJoined && !self.publishing"
          ref="startpublish"
          @click="StartPublish()"
        >
          开始推流
        </el-button>
        <el-button type="primary" @click="auxiliaryStream" v-if="isJoined&&liverole=='admin'"> 推辅流</el-button>
        <el-button  type="warning" style="margin-left: 6px" @click="leaveRoom" v-if="isJoined">离开直播</el-button>
        <el-button type="danger" @click="shutdown" v-if="isJoined">结束直播</el-button>
        <el-button @click="searchGroups" v-if="isJoined">
          查组员</el-button>
      </div>
    </div>
    <div>
      <div>
        <i
          v-show="page !== 0 && page >= limit"
          @click="leftPage"
          style="font-size: 50px; color: white"
          class="el-icon-caret-left"
        ></i>
        <i
          v-show="getPlayVideoStreamSize() > page + limit"
          @click="rightPage"
          style="font-size: 50px; color: white"
          class="el-icon-caret-right"
        ></i>
      </div>
      <div class="videoStyle">
        <div v-for="(item, index) in playVideoStream" :key="index + 'v'">
          <div
            class="playvideo"
            v-if="
              getUsername(item[0]) !== '辅流' &&
              index >= page &&
              index < page + limit
            "
          >
            <div v-for="(i, ind) in item" :key="ind + 'i'">
              <div class="videoHeader" v-if="ind === 0">
                <span style="color: #fff"> {{ getUsername(i) }}</span>
              </div>
              <video
                v-if="ind === 0"
                muted
                :autoplay="true"
                controls="controls"
                playsinline
                webkit-playsinline
                x5-playsinline
                x5-video-player-type="h5"
                x5-video-player-fullscreen="true"
                style="width: 100%; height: 100%"
                class="video"
                :ref="i"
                @click="handleVideoClick(i)"
                @loadedmetadata="onVideoLoadedMetadata"
                @canplay="onVideoCanPlay"
                @error="onVideoError"
                :class="{ 'video-fullscreen': fullscreenVideo === i }"
              ></video>
            </div>
          </div>
        </div>
      </div>

      <video
        muted
        :autoplay="true"
        controls="controls"
        playsinline
        webkit-playsinline
        x5-playsinline
        x5-video-player-type="h5"
        style="
          width: 160px;
          height: 90px;
          position: absolute;
          left: 10px;
          bottom: 10px;
          background-color: #fff;
        "
        class="video sub-video"
        ref="subSrc"
        @loadedmetadata="onVideoLoadedMetadata"
        @canplay="onVideoCanPlay"
        @error="onVideoError"
      ></video>
      <audio class="audio" autoplay ref="audioSrc"></audio>
      <el-drawer
        :size="drawerSize"
        title="直播详情"
        :visible.sync="drawer"
        :direction="drawerDirection"
        :modal="isMobile"
        class="live-drawer"
        >
        <div style="padding:10px">
          <UserList />
          <div>
            <div style="margin: 10px 0;float: left;">
              <span style="font-weight: bold">带宽:</span><i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ bitrateSend.toFixed(2) }}</span> <span style="font-weight: bold">KB </span>
              <i style="color:#FF4500" class="el-icon-bottom"></i> <span style="color:#FF4500">{{ bitrateRecv.toFixed(2) }}</span> <span style="font-weight: bold">KB</span>
            </div>
          </div>
          <div style="clear:both;">
            <div style="margin: 10px 0;float: left;">
              <span style="font-weight: bold">主流丢包率:</span> 
              音<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ pcAudioPacketLoss }}%</span>
              视<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ pcVideoPacketLoss }}%</span>
            </div>
          </div>
          <div style="clear:both;">
            <div style="margin: 10px 0;float: left;">
              <span style="font-weight: bold">辅流丢包率:</span> 
              音<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ subAudioPacketLoss }}%</span>
              视<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ subVideoPacketLoss }}%</span>
            </div>
          </div>
          <div style="clear:both;">
            <div style="margin: 10px 0;float: left;">
              <span style="font-weight: bold">拉流丢包率:</span> 
              音<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ pullAudioPacketLost }}%</span>
              视<i style="color:#008080" class="el-icon-top"></i> <span style="color:#008080">{{ pullVideoPacketLost }}%</span>
            </div>
          </div>
          <div style="clear:both;">
            <div style="margin: 10px 0;float: left;">
              <i style="color:#000000;font-size: 20px;" class="el-icon-microphone"></i>
              <span style="font-weight: bold">{{users}}</span> 
            </div>
          </div>
        <div style="clear:both">
          <div style="margin: 10px 0;">
            <span style="font-weight: bold">扬声器:</span>
            <el-select
            slot="append"
            v-model="deviceInfo.audioOutputDeviceId"
            class="audio-options"
            @change="changeAudioOutput"
          >
            <el-option
              v-for="item in deviceInfo.audioOutputDevices"
              :key="item.deviceId"
              :value="item.deviceId"
              :label="item.label"
            >
            </el-option>
          </el-select>
          </div>
          <div style="margin: 10px 0;">
            <span style="font-weight: bold">摄像头:</span>
            <span v-if="!deviceInfo.videoInputDevice">摄像头不可用</span>
            <el-select
            slot="append"
            v-model="deviceInfo.videoInputDeviceId"
            class="audio-options"
            @change="changeVideoInput"
          >
            <el-option
              v-for="item in deviceInfo.videoInputDevices"
              :key="item.deviceId"
              :value="item.deviceId"
              :label="item.label"
            >
            </el-option>
          </el-select>
          </div>
          <div style="margin: 10px 0;">
            <span style="font-weight: bold">麦克风:</span>
            <el-select
            v-model="deviceInfo.audioInputDeviceId"
            class="audio-options"
            @change="changeAudioInput"
          >
            <el-option
              v-for="item in deviceInfo.audioInputDevices"
              :key="item.deviceId"
              :value="item.deviceId"
              :label="item.label"
            >
            </el-option>
          </el-select>
          </div>
        </div>
        </div>
      </el-drawer>
    </div>
    <div v-show="subStreams.length" class="subvideoStyle">
      <video
        muted
        :autoplay="true"
        controls="controls"
        style="width:100%;height: 100%;"
        class="video"
        ref="subVideoStream"
      ></video>
    </div>
    <div v-html="statsOutputVideo"></div>
    <div v-html="statsInputAudio"></div>
    <div v-html="statsInputVideo"></div>
    <el-dialog
      title="组员"
      :visible.sync="showGroups"
      width="50%">
        <div style="width:100%;height:60px">
          <el-select
          @change="searchUsers"
          clearable
          style="width: 200px; margin:0 6px;float: left;"
          v-model="groupId"
          placeholder="请选择分组"
        >
          <el-option key="1" label="组1" value="1"></el-option>
          <el-option key="2" label="组2" value="2"></el-option>
          <el-option key="3" label="组3" value="3"></el-option>
        </el-select>
        <el-button style="float:left" @click="searchGroupUsers">
          查询</el-button>
        </div>
        <div style="padding-left:1%">
          <div style="font-weight: bold;margin-bottom:5px" v-for="(item,index) in groupUsers" :key="index+'group'">
            {{item.username+'--'+item.display}}
          </div>
        </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from "vuex";
import UserList from "@/components/Control/UserList.vue";
import axios from "axios";
import LivePlayer from "@liveqing/liveplayer";
export default {
  name: "HelloWorld",
  components: {
    LivePlayer,
    UserList
  },
  data() {
    return {
      groupId:'1',
      showGroups:false,
      groups:[],
      drawer: false,
      direction: 'rtl',
      isMobile: false,
      drawerSize: '40%',
      drawerDirection: 'rtl',
      fullscreenVideo: null,
      showBox: false,
      liverole: "user",
      msgType: "handup",
      msgData: "xxx举手了",
      receiveList: [],
      min: 0,
      max: 100,
      value1: 100,
      roomId: "",
      username: "",
      speaking: [],
      dialogVisible: false,
      source: null,
      ctx: null,
      speaker_rms: 0,
      isSpeakerTesting: false,
      videoUrl: "",
      boardLists: [],
      boardStream: null,
      playVideos: [],
      subStreams: [],
      implementFun: null,
      page: 0,
      limit: 8,
      videoPlayers: null,
      statsOutputAudio:"",
      statsOutputVideo:"",
      statsInputAudio:"",
      statsInputVideo:"",
    };
  },
  mounted() {
    // 检测移动端
    this.checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.checkMobile);
    
    // 添加移动端调试信息
    this.addMobileDebugInfo();
    
    this.groups.push(this.getRandomInt(1,3)+'')
    this.username = this.getCnName();
    this.room.addListener(
      "play-audio-stream-updated",
      this.playAudioStreamUpdated
    ); //todo 更改
    this.room.addListener(
      "play-video-stream-updated",
      this.playVideoStreamUpdated
    ); //todo更改
    this.room.addListener(
      "play-video-substream-updated",
      this.playVideosubStreamUpdated
    );
    this.micCheck.addListener(
      "play-audio-stream-updated",
      this.onTestMicphoneStream
    ); //todo更改
    this.room.addListener("allow-to-push-video", this.allowToPushVideo);
    this.room.addListener("is-kicked-by-other-device", this.kickUser);
    this.room.addListener("startRecordSuccess", this.alartStartRecord);
    this.room.addListener("stopRecordSuccess", this.alartStoptRecord);
    this.room.addListener("start-speaking", this.speakingStart);
    this.room.addListener("peer-leave", this.someOneLeaveRoom);
    this.room.addListener("peer-joined", this.someOneJoinRoom);
    this.room.addListener("stop-speaking", this.speakingStop);
    this.room.addListener("device-change", this.deviceChange);
    this.room.addListener("errormsg", this.getErrorMsg);
    this.room.addListener("sendMsg", this.getMsgs);
    this.deviceInfo.addListener(
      "audio-output-updated",
      this.deviceOutputChange
    );
    this.deviceInfo.start(); //在外部就可以选择， 不用再房间内选择
    this.deviceInfo.setSpeakerVolume(1);
    this.deviceInfo.setMicrophoneVolume(1);
  },
  computed: {
    ...mapState({
      playVideoStream: (state) =>
        state.main.room.mixStream
          ? state.main.room.mixStream.playVideoStream
          : new Map(),
      room_options: (state) => state.main.room_options,
      room: (state) => state.main.room,
      myInfo: (state) => state.main.room.myInfo,
      roominfo: (state) => state.main.room.roominfo,
      deviceInfo: (state) => state.main.deviceInfo,
      self: (state) => state.main.room.roominfo.self,
      role: (state) => state.main.room_options.role,
      isJoined: (state) => state.main.room.roominfo.isJoined,
      isRecording: (state) => state.main.room.roominfo.room.isRecording,
      players: (state) => state.main.room.players,
      rms: (state) =>
        state.main.room.mixStream && state.main.room.mixStream.localAudioStream
          ? state.main.room.mixStream.localAudioStream.rms
          : 0,
      bitrateSend: (state) =>state.main.room.pushBitrate,
      bitrateRecv: (state) => state.main.room.pullBitrate,
      pcAudioPacketLoss: (state) => state.main.room.pcAudioPacketsLoss,
      pcVideoPacketLoss: (state) => state.main.room.pcVideoPacketsLoss,
      subAudioPacketLoss: (state) => state.main.room.subAudioPacketsLoss,
      subVideoPacketLoss: (state) => state.main.room.subVideoPacketsLoss,
      users: (state) => state.main.room.users,
      micCheck: (state) => state.main.micCheck,
      microphone_rms: (state) => state.main.micCheck.microStream.rms,
      participants: (state) => state.main.room.roominfo.participants,
      lossAudiorateRecv: (state) => state.main.room.newPcStats().audioSum.lossrateRecv,
      lossAudiorateSend: (state) => state.main.room.newPcStats().audioSum.lossrateSend,
      lossVideorateRecv: (state) => state.main.room.newPcStats().videoSum.lossrateRecv,
      lossVideorateSend: (state) => state.main.room.newPcStats().videoSum.lossrateSend,
      pullAudioPacketLost: (state) => state.main.room.pullAudioPackLost,
      pullVideoPacketLost: (state) => state.main.room.pullVideoPackLost,
      groupUsers: (state) => state.main.room.groupUsers,
    }),
  },
  beforeDestroy() {
    // 清理事件监听器
    window.removeEventListener('resize', this.checkMobile);
  },
  methods: {
    // 检测是否为移动端
    checkMobile() {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      
      this.isMobile = isMobile || isSmallScreen;
      
      if (this.isMobile) {
        this.drawerSize = '90%';
        this.drawerDirection = 'btt'; // bottom to top
      } else {
        this.drawerSize = '40%';
        this.drawerDirection = 'rtl'; // right to left
      }
    },
    
    // 添加移动端调试信息
    addMobileDebugInfo() {
      if (this.isMobile) {
        console.log('=== 移动端调试信息 ===');
        console.log('User Agent:', navigator.userAgent);
        console.log('屏幕尺寸:', window.innerWidth + 'x' + window.innerHeight);
        console.log('设备像素比:', window.devicePixelRatio);
        console.log('是否支持WebRTC:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
        console.log('浏览器类型:', this.getBrowserType());
        
        // 检查自动播放策略
        this.checkAutoplayPolicy();
      }
    },
    
    // 获取浏览器类型
    getBrowserType() {
      const ua = navigator.userAgent;
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Edge')) return 'Edge';
      return 'Unknown';
    },
    
    // 检查自动播放策略
    async checkAutoplayPolicy() {
      try {
        const video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        
        const canAutoplay = await video.play().then(() => true).catch(() => false);
        console.log('自动播放支持:', canAutoplay);
        
        if (!canAutoplay) {
          console.warn('⚠️ 自动播放被阻止，需要用户交互才能播放视频');
          this.showAutoplayWarning();
        }
      } catch (error) {
        console.error('检查自动播放策略失败:', error);
      }
    },
    
    // 显示自动播放警告
    showAutoplayWarning() {
      if (this.isMobile) {
        this.$message({
          message: '请点击任意视频区域以开始播放',
          type: 'warning',
          duration: 5000
        });
      }
    },
    
    // 视频元数据加载完成
    onVideoLoadedMetadata(event) {
      console.log('视频元数据加载完成:', event.target);
      if (this.isMobile) {
        // 在移动端尝试手动播放
        this.tryPlayVideo(event.target);
      }
    },
    
    // 视频可以播放
    onVideoCanPlay(event) {
      console.log('视频可以播放:', event.target);
      if (this.isMobile) {
        this.tryPlayVideo(event.target);
      }
    },
    
    // 视频错误
    onVideoError(event) {
      console.error('视频播放错误:', event.target.error);
      if (this.isMobile) {
        this.$message({
          message: '视频播放失败，请检查网络连接',
          type: 'error',
          duration: 3000
        });
      }
    },
    
    // 尝试播放视频
    async tryPlayVideo(videoElement) {
      if (!videoElement || !videoElement.srcObject) return;
      
      try {
        await videoElement.play();
        console.log('视频播放成功:', videoElement);
      } catch (error) {
        console.warn('自动播放失败，需要用户交互:', error);
        // 添加点击播放提示
        this.addPlayButton(videoElement);
      }
    },
    
    // 添加播放按钮
    addPlayButton(videoElement) {
      if (videoElement.parentElement.querySelector('.play-button')) return;
      
      const playButton = document.createElement('div');
      playButton.className = 'play-button';
      playButton.innerHTML = '▶️ 点击播放';
      playButton.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        z-index: 100;
        font-size: 14px;
      `;
      
      playButton.onclick = async () => {
        try {
          await videoElement.play();
          playButton.remove();
        } catch (error) {
          console.error('手动播放失败:', error);
        }
      };
      
      videoElement.parentElement.appendChild(playButton);
    },
    
    // 处理移动端视频流
    async handleMobileVideoStream(videoElement) {
      if (!videoElement || !videoElement.srcObject) return;
      
      console.log('处理移动端视频流:', videoElement);
      
      // 确保视频属性正确设置
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('playsinline', 'true');
      
      // 等待视频准备就绪
      if (videoElement.readyState >= 2) {
        // 视频已经有足够的数据开始播放
        await this.tryPlayVideo(videoElement);
      } else {
        // 等待视频加载
        videoElement.addEventListener('loadeddata', () => {
          this.tryPlayVideo(videoElement);
        }, { once: true });
      }
    },
    
    // 处理视频点击事件
    handleVideoClick(videoRef) {
      if (!this.isMobile) return; // 仅在移动端启用
      
      if (this.fullscreenVideo === videoRef) {
        // 退出全屏模式
        this.fullscreenVideo = null;
        // 移除容器的全屏类
        this.$nextTick(() => {
          const videoElement = this.$refs[videoRef];
          if (videoElement && videoElement.parentElement) {
            videoElement.parentElement.classList.remove('fullscreen-container');
          }
        });
      } else {
        // 进入全屏模式
        this.fullscreenVideo = videoRef;
        // 添加容器的全屏类
        this.$nextTick(() => {
          const videoElement = this.$refs[videoRef];
          if (videoElement && videoElement.parentElement) {
            videoElement.parentElement.classList.add('fullscreen-container');
          }
        });
      }
    },
    
    searchGroupUsers(){
      this.room.searchUsers(this.groupId)
    },
    searchUsers(e){
      this.room.searchUsers(e)
    },
    searchGroups(){
      this.showGroups = true;
    },
    getRandomInt(min, max) {
      return Math.floor(Math.random()*(max-min+1))+min;
    },
    getGroups(e){
      console.log(e);
      console.log(this.groups);
    },  
    shutdown() {
      //关闭直播间后将记得调用disconnect关闭信令以及停止推流
      let that = this
      axios
        .post('/sig/v1/room/shutdown', {
          room: this.room.myInfo.room
        })
        .then(function(res) {
          console.log('关闭直播间了吗', res)
          that.room.disconnect()
          that.room.myInfo.role = that.liverole
        })
        .catch(function(error) {
          console.log(error)
        })
      // this.room.ShutdownNotify()
    },
    getPlayVideoStreamSize() {
      return this.playVideoStream ? this.playVideoStream.size : 0;
    },
    rightPage() {
      this.page = this.page + this.limit;
      this.playVideoStreamUpdated(this.playVideoStream);
    },
    leftPage() {
      this.page = this.page - this.limit;
      this.playVideoStreamUpdated(this.playVideoStream);
    },
    getLiveRole(e) {
      console.log(e);
      this.room.myInfo.role = e;
      this.myInfo.role = e;
    },
    getUsername(key) {
      let username = this.participants.filter((e) => {
        return e.display == key;
      });
      return username.length
        ? username[0].username + " - " + username[0].display
        : "辅流";
    },
    changeSpeedLimit() {
      this.room.speedLimit = !this.room.speedLimit;
      // this.room.changehdplayallsdp()
    },
    getMsgs(msg) {
      this.$message({
        message: msg.msgData,
        type: "success",
      });
    },
    // 参数msgType,msgData,receiveList=[],receiveList数组里面是对应的display，空数组代表全部通知
    sendMsgs() {
      this.room.sendMessages(this.msgType, this.msgData, this.receiveList);
    },
    kickUser(e) {
      this.room.disconnect();
      this.$message({
        message: "您被用户挤出直播间",
      });
    },
    getRecordVideo() {
      let that = this;
      axios
        .post("/backend/v1/createToken", {
          roomId: this.roomId,
        })
        .then(function (response) {
          that.videoUrl = response.data.url;
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
    },
    alartStartRecord(e) {
      this.$message({
        message: "开始录屏",
      });
    },
    alartStoptRecord(e) {
      this.$message({
        message: "结束录屏",
      });
    },
    //获取错误信息
    getErrorMsg(e) {
      this.$message({
        message: e.message,
        type: "error",
      });
      console.log(e, "这是错误信息");
    },
    //有人加入房间
    someOneJoinRoom(e) {
      this.$message({
        message: e.peer.username + "进入直播间",
      });
    },
    //有人离开房间
    someOneLeaveRoom(e) {
      this.$message({
        message: e.peer.username + "已离开直播间",
      });
    },
    getWsurl() {
      let that = this;
      axios
        .post("/backend/v1/signaling/query", {
          roomId: this.roomId,
        })
        .then(function (res) {
          that.room_options.host = res.data.host; //信令地址
          that.room_options.port = res.data.port; //信令地址
          that.room_options.schema = res.data.schema; //信令地址
          // console.log('这是获取到的ws信息', res)
        })
        .catch(function (error) {
          console.log(error);
        });
    },
    //加入直播，输入房间号和username之后调用接口会获取到带有直播间信息的token，解码后拿到对应的参数可加入直播间
    async JoinLive() {
      if (!this.roomId || !this.username) {
        this.$message({
          message: "请输入对应的房间号和用户名",
        });
        return;
      }
      if (!this.groups.length) {
        this.$message({
          message: "请选择分组",
        });
      }
      let that = this;
      axios
        .post("/backend/v1/signaling/query", {
          roomId: this.roomId,
        }).then(function (res) {
          that.room_options.host = res.data.host; //信令地址
          that.room_options.port = res.data.port; //信令地址
          that.room_options.schema = res.data.schema; //信令地址
            axios.post("/backend/v1/createToken", {
              roomId: that.roomId,
              username: that.username,
              role: that.liverole,
              groupIds: that.groups.join(';')
            })
            .then(function (response) {
              let token = response.data.data.token;
              let roomInfo = JSON.parse(token);
              that.room_options.roomid = roomInfo.room; //房间号
              that.room_options.tokenId = roomInfo.tokenId; //tokenId
              that.JoinRoom();
            })
            .catch(function (error) {
              console.log(error);
            });
          })
        .catch(function (error) {
          console.log(error);
        });
      
    },
    //创建房间
    createRoom() {
      let that = this;
      axios
        .post("/backend/v1/createRoom", {
          name: "adminUser",
          creator: "admins",
          needRecord:true,
        })
        .then(function (response) {
          that.roomId = response.data.data.id;
        })
        .catch(function (error) {
          console.log(error);
        });
    },
    // 开始录屏
    StartRecord() {
      this.room.startRecording();
    },
    // 停止录屏
    StopRecord() {
      this.room.stopRecording();
    },
    alertMessage(action, msg) {
      this.$message({
        message: msg,
        type: action,
      });
    },
    onSpeakerVolumeChange() {
      const { testSpeaker } = this.$refs;
      testSpeaker.volume = this.deviceInfo.speaker.volume;
      this.deviceInfo.setSpeakerVolume(this.deviceInfo.speaker.volume);
    },
    onMicrophoneVolumeChange() {
      this.deviceInfo.setMicrophoneVolume(this.deviceInfo.microphone.volume);
    },
    testSpeaker() {
      const { testSpeaker } = this.$refs;
      const audio = testSpeaker;

      if (!this.ctx) {
        this.ctx = new AudioContext();
        var that = this;

        // 2048 sample buffer, 1 channel in, 1 channel out
        var processor = this.ctx.createScriptProcessor(2048, 1, 1);

        audio.addEventListener(
          "playing",
          (event) => {
            console.log("playing", event);
            !this.source &&
              (this.source = this.ctx.createMediaElementSource(audio));
            this.source.connect(processor);
            this.source.connect(this.ctx.destination);
            processor.connect(this.ctx.destination);
          },
          false
        );

        audio.addEventListener(
          "ended",
          (event) => {
            console.log("ended", event);
            this.source.disconnect(processor);
            this.source.disconnect(this.ctx.destination);
            processor.disconnect(this.ctx.destination);
          },
          false
        );

        // // loop through PCM data and calculate average
        // // volume for a given 2048 sample buffer
        processor.onaudioprocess = function (evt) {
          var input = evt.inputBuffer.getChannelData(0);
          var len = input.length;
          var total = 0;
          var i = 0;
          while (i < len) total += Math.abs(input[i++]);
          that.speaker_rms = Math.ceil(Math.sqrt(total / len) * 100);
        };
      }

      if (this.isSpeakerTesting) {
        testSpeaker.pause();
        this.isSpeakerTesting = false;
      } else {
        console.log(this.deviceInfo.speaker.volume);
        testSpeaker.volume = this.deviceInfo.speaker.volume;
        testSpeaker.currentTime = 0;
        testSpeaker.play();
        this.isSpeakerTesting = true;
      }
    },
    testMicrophone() {
      if (this.micCheck.started) {
        this.micCheck.stop();
      } else {
        this.micCheck.start(this.deviceInfo);
      }
    },
    //测试麦克风流
    async onTestMicphoneStream(aStream) {
      console.log("onTestMicphoneStream", aStream);
      if (aStream === null) return;
      const { testMicrophoneAudio } = this.$refs;
      if (
        testMicrophoneAudio.srcObject &&
        testMicrophoneAudio.srcObject.id === aStream.id
      ) {
        console.log("onTestMicphoneStream alreay exising");
        return;
      }
      if (testMicrophoneAudio.srcObject) {
        testMicrophoneAudio.pause();
        testMicrophoneAudio.srcObject = null;
      }
      try {
        testMicrophoneAudio.srcObject = aStream;
        testMicrophoneAudio.play();
      } catch (e) {}
    },
    deviceChange(kind, label) {
      if (kind === "audio-input") {
        // this.alertMessage('success', `当前麦克风设备为: ${label}`)
      }
      if (kind === "video-input") {
        // this.alertMessage('success', `当前摄像头设备为: ${label}`)
      }
    },
    deviceOutputChange() {
      console.log("deviceOutputChange", this.deviceInfo.audioOutputDeviceId);
      const { audioSrc } = this.$refs; //TODO 后续使用动态添加的video
      // console.log(audioSrc)
      audioSrc && audioSrc.setSinkId(this.deviceInfo.audioOutputDeviceId);
      // this.alertMessage(
      //   'success',
      //   `当前扬声器设备为: ${this.deviceInfo.audioOutputDevice.label}`
      // )
    },
    //加入房间
    async JoinRoom() {
      //加入房间，首先连接，然后调用room的join()
      try {
        await this.$store.dispatch("Connect");
      } catch (e) {
        return;
      }
      try {
        await this.room.join();
      } catch (e) {
        console.log(e);
      }
    },
    //离开直播间
    leaveRoom() {
      this.room.disconnect();
      this.room.myInfo.role = this.liverole
    },
   playPackLose(){
      setInterval(() =>{
        this.room.players.forEach(async player =>{
          console.log(player.pc,'=  =============');
          player.pc.getReceivers().forEach(async receiver => {
          let stats =await receiver.getStats()
          console.log(stats,'=============');
          //console.log('receiver.track.kind', receiver.track.kind)
          if (receiver.track && receiver.track.kind === 'audio') {
            let statsInputAudio = ''
            stats.forEach(report => {
              statsInputAudio += `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
                  `<strong>Timestamp:</strong> ${report.timeStamp}<br>\n`;

              Object.keys(report).forEach(stateName => {
                  if (stateName !== "id" && stateName != "timestamp" && stateName !== "type") {
                    statsInputAudio += `<strong>${stateName}:</strong> ${report[stateName]}<br>\n`;
                  }
              });
              this.statsInputAudio = statsInputAudio;

          });
          } else if (receiver.track && receiver.track.kind === 'video') {
            let statsInputVideo = ''
            stats.forEach(report => {
              statsInputVideo += `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
                  `<strong>Timestamp:</strong> ${report.timeStamp}<br>\n`;

              Object.keys(report).forEach(stateName => {
                  if (stateName !== "id" && stateName != "timestamp" && stateName !== "type") {
                    statsInputVideo += `<strong>${stateName}:</strong> ${report[stateName]}<br>\n`;
                  }
              });
              this.statsInputVideo = statsInputVideo;
          });
        }
    })
        })
      },1000)
    },
    // 查看丢包率
   async getPackLose(){
      setInterval(() =>{
       this.room.publish.pc.getStats(null).then(stats => {
        let statsOutputVideo = "";
        stats.forEach(report => {
          statsOutputVideo += `<h2>Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
                `<strong>Timestamp:</strong> ${report.timeStamp}<br>\n`;

            Object.keys(report).forEach(stateName => {
                if (stateName !== "id" && stateName != "timestamp" && stateName !== "type") {
                  statsOutputVideo += `<strong>${stateName}:</strong> ${report[stateName]}<br>\n`;
                }
            });
            this.statsOutputVideo = statsOutputVideo;
          });
        console.log(stats,'丢包信息');
        });
      },1000)
    },
    // 推辅流
    async auxiliaryStream() {
      let stream = await this.room.startCaptureScreen(true);
      this.room.publishAuxiliaryStream(stream);
    },
    async shareBoard() {
      // this.room.publishBoardStream(this.$refs.board.localstream);
      this.room.publishBoardStream(this.$refs.board.$refs.canvas.captureStream());
      // this.room.publishBoardStream(this.$refs.board.canvasStream);
    },
    changeResolutionRatio() {
      this.room.changeResolutionRatio();
    },
    changeResolutionRatio1() {
      this.room.changeResolutionRatio1();
    },
    //屏幕共享
    async ScreenShare() {
      // 当前先不获取音频，后续可以考虑放开
      this.dialogVisible = false;
      let stream = await this.room.startCaptureScreen(true);
      console.log(stream.getVideoTracks()[0].getSettings());
      this.$store.dispatch("ShareScreenStream", stream);
    },
    async StartPublishVideo() {
      this.dialogVisible = false;
      await this.room.startCaptureSingle("video");
    },
    async StartPublish() {
      // console.log(this.$refs.board.$refs.canvas.captureStream(),this.$refs.board.$refs.canvas.captureStream().getTracks(),'----------------------------lll');
      // this.room.publishsdp(true, true,this.$refs.board.$refs.canvas.captureStream());
      this.room.publishsdp(true, true);
    },
     // 监听到新的音频
     async playAudioStreamUpdated(aStream) {
      console.log(aStream.getAudioTracks(), "yinptongdao");
      if (aStream === null) return;
      const { audioSrc } = this.$refs;
      if (audioSrc.srcObject) {
        audioSrc.pause()
        audioSrc.srcObject = null
      }
      if (audioSrc) {
        // audioSrc.pause();
        // 刷新界面 重新赋值
        audioSrc.srcObject = aStream;
        audioSrc.volume = this.deviceInfo.speaker.volume;
        audioSrc.play()
      }
    },
    changePlayVideos(vStream) {
      let arr = [];
      this.subStreams = [];
      if (vStream.size == 0) {
        return false;
      }
      vStream.size&&vStream.forEach((value, key) => {
        let isSome = this.participants.some((e) => {
          return e.display == key;
        });
        if (isSome) {
          // console.log(key);
          // let some = this.playVideos.some(e => {
          // return e.display == key
          // })
          // if (!some) {
          //   this.playVideos.push({ key: key, stream: value })
          // }
          arr.push({ key: key, stream: value });
        } else {
          setTimeout(() => {
            console.log('拉到辅流',value,this.$refs["subVideoStream"],);
            console.log('查看该辅流的视频通道是否正常',value.getVideoTracks());
            console.log('查看该辅流的音频通道是否正常',value.getAudioTracks());
            if (this.$refs["subVideoStream"]) {
              this.$refs["subVideoStream"].srcObject = value;
            }
          }, 200);
          this.subStreams.push({ key: key, stream: value });
          console.log(this.subStreams, "辅流数");
        }
      });
      // setTimeout(() => {
      //   this.playVideos.forEach((item, index)=>{
      //     if (index>0) {
      //       if (this.playVideos[index].key==this.playVideos[index-1].key) {
      //         this.playVideos.splice(index,1)
      //       }
      //     }
      //   })
      // }, 200);
      this.playVideos = arr;
    },
    //监听到右流推过来
    async playVideoStreamUpdated(vStream) {
      console.log(vStream,'视频轨道');
      await this.changePlayVideos(vStream);
      clearTimeout(this.implementFun);
      this.implementFun = setTimeout(() => {
        if (vStream.size == 0) {
          return false;
        }
        vStream.forEach((value, key) => {
          if (!value.getVideoTracks()[0].muted) {
            setTimeout(() => {
              if (this.$refs[key] && this.$refs[key][0]) {
                const videoElement = this.$refs[key][0];
                
                if (!videoElement.srcObject) {
                  videoElement.srcObject = value;
                  console.log('设置视频流:', key, value);
                  
                  // 移动端特殊处理
                  if (this.isMobile) {
                    this.$nextTick(() => {
                      this.handleMobileVideoStream(videoElement);
                    });
                  }
                } else if (
                  videoElement.srcObject &&
                  videoElement.srcObject.id != value.id
                ) {
                  videoElement.srcObject = value;
                  console.log('更新视频流:', key, value);
                  
                  // 移动端特殊处理
                  if (this.isMobile) {
                    this.$nextTick(() => {
                      this.handleMobileVideoStream(videoElement);
                    });
                  }
                }
              }
            }, 100);
          }
        });
      }, 500);
    },
    async playVideosubStreamUpdated(vStream) {
      console.log(vStream,'拿到数据了吗');
      if (vStream === null) return;
      const { subSrc } = this.$refs;
      // TODO: 待解决 6184 6185
      if (subSrc.srcObject && subSrc.srcObject.id === vStream.id) {
        return;
      }
      // 先play 被 pause interrupt 的bug
      if (subSrc.srcObject) {
        subSrc.pause();
        subSrc.srcObject = null;
      }
      subSrc.srcObject = vStream;
      subSrc.play();
    },
    allowToPushVideo() {},
    // 监听到有人讲话
    speakingStart(username) {
      // console.log(`${username} start speaking`)
      for (let i = 0; i < this.speaking.length; i++) {
        let obj = this.speaking[i];
        if (obj === username) {
          return;
        }
      }
      this.speaking.push(username);
    },
    //某人停止讲话
    speakingStop(username) {
      for (let i = 0; i < this.speaking.length; i++) {
        let obj = this.speaking[i];
        if (obj === username) {
          this.speaking.splice(i, 1);
        }
      }
    },
    changeAudioInput() {
      this.deviceInfo.setAudioInput();
    },
    changeVideoInput(e) {
      console.log(e, "切换摄像头");
      this.deviceInfo.setVideoInput(e);
    },
    changeAudioOutput() {
      this.deviceInfo.setAudioOutput();
    },

    getCnName() {
      Array.prototype.removeDup = function () {
        var result = [];
        var obj = {};
        for (var i = 0; i < this.length; i++) {
          if (!obj[this[i]]) {
            result.push(this[i]);
            obj[this[i]] = 1;
          }
        }
        return result;
      };
      var firstNames = [
        "赵",
        "钱",
        "孙",
        "李",
        "周",
        "吴",
        "郑",
        "王",
        "冯",
        "陈",
        "卫",
        "蒋",
        "沈",
        "韩",
        "杨",
        "朱",
        "秦",
        "尤",
        "许",
        "何",
        "吕",
        "施",
        "张",
        "孔",
        "曹",
        "严",
        "华",
        "金",
        "魏",
        "陶",
        "姜",
        "杜",
        "阮",
        "蔡",
        "田",
      ];
      var lastNames = [
        "子璇",
        "三",
        "四",
        "五",
        "小明",
        "小红",
        "小兰",
        "淼",
        "国栋",
        "丰源",
        "学东",
        "奇岩",
        "浩财",
        "和蔼",
        "红言",
        "瑞赫",
        "森圆",
        "欣赢",
        "梓鸿",
        "博明",
        "铭育",
        "颢硕",
        "宇烯",
        "宇如",
        "淳炎",
        "源承",
        "斌彬",
        "飞沉",
        "鸿璐",
        "昊弘",
      ];
      lastNames = lastNames.removeDup();
      var firstLength = firstNames.length;
      var lastLength = lastNames.length;
      var i = parseInt(Math.random() * firstLength);
      var j = parseInt(Math.random() * lastLength);
      var name = firstNames[i] + lastNames[j];
      return name;
    },
  },
  watch: {
    value1: {
      handler(val) {
        this.deviceInfo.speaker.volume = val / 100;
      },
    },
  },
};
</script>
<style lang="scss" scoped>
.videoStyle {
  width: 92%;
  margin-left: 4%;
  height: 130px;
  margin-top: 5vh;
  overflow-y: auto;
  // display: flex;
  // flex-direction: row;
  // justify-content:center;
  // flex-wrap:wrap;
}
.subvideoStyle {
  width: 88%;
  margin-left: 6%;
  height: auto;
  margin-top: 1vh;
  background: #ccc;
}
::-webkit-scrollbar {
  width: 12px;
}
/* 滚动槽 */
::-webkit-scrollbar-track {
  -webkit-box-shadow: inset006pxrgba(0, 0, 0, 0.3);
  border-radius: 10px;
}
/* 滚动条滑块 */
::-webkit-scrollbar-thumb {
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.1);
  -webkit-box-shadow: inset006pxrgba(0, 0, 0, 0.5);
}
::-webkit-scrollbar-thumb:window-inactive {
  background: rgba(255, 0, 0, 0.4);
}
.meetbg {
  overflow-x: hidden;
  width: 100%;
  height: 100vh;
  background: url("../../assets/bg.png");
  background-size: cover;
  background-position: 100% 100%;
  background-repeat: no-repeat;
}
.playvideo {
  width: 160px;
  height: auto;
  margin: 1%;
  float: left;
  position: relative;
}
.videoHeader {
  position: absolute;
  width: 100%;
  height: 22px;
  line-height: 20px;
  text-align: center;
  font-size: 12px;
  overflow-x: hidden;
  top: 0px;
  background: rgba($color: #000000, $alpha: 0.3);
}

.open {
  width: 20px;
  height: 60px;
  position: fixed;
  line-height: 60px;
  background: #fff;
  right: 0px;
  top: 45vh;
  border: 1px solid #ccc;
}
.close {
  width: 20px;
  height: 60px;
  line-height: 60px;
  position: fixed;
  background: #fff;
  right: 560px;
  top: 45vh;
  border: 1px solid #ccc;
}
.user-list-container {
  width: 550px;
  height: 90vh;
  background-color: #f2f2f2;
  position: fixed;
  top: 80px;
  right: 0px;
  z-index: 999;
  border-top-left-radius: 5px;
  border-bottom-left-radius: 5px;
  padding: 5px;
}
.main-container {
  width: 100%;
  height: 100%;
  flex-direction: row;
  .demo-container {
    .el-form-item {
      width: 120px;
      .volume {
        .el-input__inner {
          width: 12px;
        }
      }
    }
  }
  .demo-video-container {
    height: auto;
    margin-bottom: 20px;
    display: flex;
    flex-direction: row;
    width: 100%;
    border: 1px solid #f2f2f2;
    .video {
      //transform: rotateY(180deg);
      width: 60%;
    }
  }
  .local-operator-container {
    height: 50px;
    display: flex;
    flex-direction: row;
  }
  .test-contain {
    display: flex;
    flex-direction: row;
    .speaker-contain {
      width: 100px;
    }
  }
}
.audio-options {
  margin: 5px;
}
.hello {
  width: 95vw;
  height: 55vh;
  border: 1px solid black;
}
.bgl {
  background-color: #ccc;
}
.vbheader {
  width: 100%;
  border-bottom: 1px solid #ffffff;
}
.boardstyle {
  width: 60px;
  height: 22px;
  margin: 10px 6px;
  border: 1px solid #000;
  color: #000;
  text-align: center;
  line-height: 20px;
  font-size: 12px;
  border-radius: 5px;
  float: left;
}
.canvasstreams {
  width: 100%;
  height: 500px;
  position: absolute;
  left: 0;
  z-index: 99999999999;
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  /* 顶部控制区域适配 */
  .control-panel {
    flex-direction: column !important;
    align-items: center !important;
    padding: 10px !important;
    gap: 10px !important;
  }
  
  /* 输入框和按钮适配 */
  .control-panel > * {
    margin: 5px 0 !important;
    width: 90% !important;
    max-width: 300px !important;
  }
  
  /* Element UI 组件特殊处理 */
  .control-panel .el-input {
    width: 90% !important;
    max-width: 300px !important;
  }
  
  .control-panel .el-select {
    width: 90% !important;
    max-width: 300px !important;
  }
  
  .control-panel .el-button {
    width: 90% !important;
    max-width: 300px !important;
  }
  
  /* 视频区域适配 */
  .videoStyle {
    width: 100% !important;
    margin-left: 0 !important;
    height: auto !important;
    min-height: 300px !important;
    margin-top: 2vh !important;
    padding: 0 10px !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }
  
  /* 视频播放器适配 */
  .playvideo {
    width: calc(50% - 10px) !important;
    margin: 5px !important;
    float: left !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    background: #000 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
  }
  
  /* 视频元素适配 */
  .playvideo video {
    width: 100% !important;
    height: auto !important;
    min-height: 120px !important;
    object-fit: cover !important;
    border-radius: 8px !important;
  }
  
  /* 视频标题优化 */
  .videoHeader {
    background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent) !important;
    padding: 8px 12px !important;
    border-radius: 8px 8px 0 0 !important;
  }
  
  /* 辅流视频移动端优化 */
  .sub-video {
    width: 120px !important;
    height: 68px !important;
    position: fixed !important;
    right: 10px !important;
    bottom: 80px !important;
    border-radius: 8px !important;
    border: 2px solid #fff !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important;
    z-index: 1000 !important;
    left: auto !important;
  }
  
  /* 抽屉按钮位置调整 */
  .meetbg > el-button:first-child {
    top: 70vh !important;
    left: 10px !important;
  }
  
  /* 抽屉移动端优化 */
  .live-drawer .el-drawer {
    border-radius: 15px 15px 0 0 !important;
  }
  
  .live-drawer .el-drawer__header {
    padding: 15px 20px !important;
    border-bottom: 1px solid #f0f0f0 !important;
  }
  
  .live-drawer .el-drawer__body {
    padding: 0 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  .live-drawer .el-drawer__body > div {
    padding: 15px 20px !important;
  }
  
  /* 抽屉内容布局优化 */
  .live-drawer .el-select {
    width: 100% !important;
    margin: 10px 0 !important;
  }
  
  .live-drawer .audio-options {
    width: 100% !important;
    margin: 10px 0 !important;
  }
  
  /* 统计信息布局 */
  .live-drawer div[style*="float: left"] {
    float: none !important;
    margin: 15px 0 !important;
    padding: 10px !important;
    background: #f8f9fa !important;
    border-radius: 8px !important;
  }
  
  /* 分页按钮适配 */
  .el-icon-caret-left,
  .el-icon-caret-right {
    font-size: 30px !important;
    position: fixed !important;
    top: 50% !important;
    z-index: 1000 !important;
  }
  
  .el-icon-caret-left {
    left: 10px !important;
  }
  
  .el-icon-caret-right {
    right: 10px !important;
  }
}

@media screen and (max-width: 480px) {
  /* 超小屏幕适配 */
  .playvideo {
    width: calc(100% - 20px) !important;
    margin: 10px !important;
    min-height: 200px !important;
  }
  
  .playvideo video {
    min-height: 180px !important;
  }
  
  /* 辅流视频在超小屏幕上的调整 */
  .sub-video {
    width: 100px !important;
    height: 56px !important;
    right: 5px !important;
    bottom: 70px !important;
  }
  
  /* 控制区域更紧凑 */
  .control-panel > * {
    width: 95% !important;
    font-size: 14px !important;
  }
  
  .control-panel .el-input,
  .control-panel .el-select,
  .control-panel .el-button {
    width: 95% !important;
    font-size: 14px !important;
  }
  
  /* 视频标题字体调整 */
  .videoHeader {
    font-size: 12px !important;
    height: 18px !important;
    line-height: 18px !important;
  }
  
  /* 抽屉按钮更小 */
  .meetbg > el-button:first-child {
    top: 75vh !important;
  }
  
  /* 超小屏幕抽屉优化 */
  .live-drawer .el-drawer__header {
    padding: 10px 15px !important;
    font-size: 16px !important;
  }
  
  .live-drawer .el-drawer__body > div {
    padding: 10px 15px !important;
  }
  
  .live-drawer div[style*="float: left"] {
    padding: 8px !important;
    margin: 10px 0 !important;
    font-size: 14px !important;
  }
  
  .live-drawer .el-select,
  .live-drawer .audio-options {
    font-size: 14px !important;
  }
}

/* 横屏模式适配 */
@media screen and (max-width: 768px) and (orientation: landscape) {
  .control-panel {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
  }
  
  .control-panel > * {
    width: auto !important;
    min-width: 120px !important;
    margin: 5px !important;
  }
  
  .videoStyle {
    margin-top: 1vh !important;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  /* 增大可点击区域 */
  .el-button {
    min-height: 44px !important;
    padding: 12px 20px !important;
  }
  
  .el-input__inner {
    min-height: 44px !important;
    padding: 12px 15px !important;
  }
  
  .el-select .el-input__inner {
    min-height: 44px !important;
  }
  
  /* 视频控制按钮更大 */
  .playvideo {
    position: relative !important;
  }
  
  .playvideo::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    min-height: 44px !important;
  }
}

/* 防止页面缩放 */
@media screen and (max-width: 768px) {
  .meetbg {
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  /* 优化滚动性能 */
  .videoStyle {
    -webkit-overflow-scrolling: touch !important;
    overflow-x: hidden !important;
  }
  
  /* 辅流区域移动端优化 */
  .subvideoStyle {
    width: 100% !important;
    margin-left: 0 !important;
    margin-top: 2vh !important;
    padding: 0 10px !important;
    box-sizing: border-box !important;
  }
  
  .subvideoStyle video {
    width: 100% !important;
    height: auto !important;
    min-height: 200px !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2) !important;
  }
  
  /* 全屏视频样式 */
  .video-fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
    background: #000 !important;
    object-fit: contain !important;
    border-radius: 0 !important;
  }
  
  .playvideo.fullscreen-container {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  
  /* 播放按钮样式优化 */
  .play-button {
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: rgba(0,0,0,0.8) !important;
    color: white !important;
    padding: 15px 25px !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    z-index: 100 !important;
    font-size: 16px !important;
    border: 2px solid rgba(255,255,255,0.3) !important;
    backdrop-filter: blur(10px) !important;
    transition: all 0.3s ease !important;
  }
  
  .play-button:hover {
    background: rgba(0,0,0,0.9) !important;
    border-color: rgba(255,255,255,0.5) !important;
    transform: translate(-50%, -50%) scale(1.05) !important;
  }
  
  .play-button:active {
    transform: translate(-50%, -50%) scale(0.95) !important;
  }
}
</style>
