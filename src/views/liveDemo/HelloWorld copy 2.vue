<template>
  <div class="meetbg">
    <el-button style="position:absolute;top:80vh;left:20px;z-index: 999999999;" icon="el-icon-s-fold" @click="drawer=true" circle></el-button>
    
    <!-- 移动端调试面板 -->
    <div v-if="isMobile" class="mobile-debug-panel">
      <!-- <el-button 
        @click="debugInfo.show = !debugInfo.show" 
        size="mini" 
        type="info"
        style="position: fixed; top: 10px; right: 10px; z-index: 10000;"
      >
        {{ debugInfo.show ? '隐藏' : '调试' }}
      </el-button> -->
      
      <div v-if="debugInfo.show" class="debug-content">
        <div class="debug-section">
          <h4>设备信息</h4>
          <p>浏览器: {{ getBrowserType() }}</p>
          <p>屏幕: {{ window.innerWidth }}x{{ window.innerHeight }}</p>
          <p>WebRTC: {{ supportsWebRTC ? '支持' : '不支持' }}</p>
        </div>
        
        <div class="debug-section">
          <h4>视频状态</h4>
          <div v-for="(state, key) in debugInfo.videoStates" :key="key">
            <p>{{ key }}: {{ state }}</p>
          </div>
        </div>
        
        <div class="debug-section">
          <h4>流信息</h4>
          <div v-for="(info, key) in debugInfo.streamInfo" :key="key">
            <p>{{ key }}: {{ info }}</p>
          </div>
        </div>
        
        <div class="debug-section">
          <h4>日志 (最新10条)</h4>
          <div class="debug-logs">
            <div v-for="(log, index) in debugInfo.logs.slice(-10)" :key="index" class="log-item">
              <span class="log-time">{{ log.time }}</span>
              <span :class="'log-' + log.level">{{ log.message }}</span>
            </div>
          </div>
        </div>
        
        <div class="debug-section">
          <el-button @click="clearDebugLogs" size="mini">清空日志</el-button>
          <el-button @click="forceRefreshVideos" size="mini" type="primary">强制刷新视频</el-button>
        </div>
      </div>
    </div>
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
        <el-button type="danger" @click="shutdown" v-if="isJoined && liverole=='admin'">结束直播</el-button>
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
        <template v-for="(item, index) in playVideoStream">
          <div
            v-if="
              getUsername(item[0]) !== '辅流' &&
              index >= page &&
              index < page + limit
            "
            :key="item[0]"
            class="playvideo"
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
        </template>
      </div>


      <!-- <video
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
      ></video> -->
      <audio class="audio" autoplay ref="audioSrc"></audio>
      <el-drawer
        :size="drawerSize"
        title="直播详情"
        :visible.sync="drawer"
        :direction="drawerDirection"
        :modal="isMobile"
        class="live-drawer"
        :show-close="true"
        :close-on-click-modal="true"
        @close="closeDrawer"
        >
        <!-- 移动端专用关闭按钮 -->
        <div v-if="isMobile" class="mobile-drawer-close">
          <el-button 
            @click="closeDrawer" 
            type="info" 
            size="small" 
            icon="el-icon-close"
            circle
            class="close-btn"
          ></el-button>
          <span class="close-hint">点击关闭或向下滑动</span>
        </div>
        
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
    <!-- 辅流区域 - 支持多个辅流 -->
    <div v-if="subStreams.length > 0" class="subvideoStyle">
      <div 
        v-for="(subStream, index) in subStreams" 
        :key="subStream.key"
        class="sub-video-item"
      >
        <div class="sub-video-header">
          <span>辅流 {{ index + 1 }} - {{ subStream.key }}</span>
        </div>
        <video
          muted
          :autoplay="true"
          controls="controls"
          style="width:100%;height: 100%;"
          class="video sub-video"
          :ref="'subVideoStream_' + subStream.key"
        ></video>
      </div>
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
      debugInfo: {
        show: false,
        logs: [],
        videoStates: {},
        streamInfo: {}
      },
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
      limit: 38,
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
    
    // 添加调试相关的computed属性
    supportsWebRTC() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    
    window() {
      return window;
    },
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
        // 根据屏幕高度动态调整抽屉高度
        const screenHeight = window.innerHeight;
        if (screenHeight < 600) {
          // 小屏幕手机（如iPhone SE）
          this.drawerSize = '75%';
        } else if (screenHeight < 800) {
          // 中等屏幕手机
          this.drawerSize = '80%';
        } else {
          // 大屏幕手机
          this.drawerSize = '85%';
        }
        this.drawerDirection = 'btt'; // bottom to top
      } else {
        this.drawerSize = '40%';
        this.drawerDirection = 'rtl'; // right to left
      }
    },
    
    // 更新所有统计信息
    updateAllStats() {
      if (!this.participants) return;
      
      const stats = {
        totalUsers: this.participants.length,
        publishingUsers: this.participants.filter(user => user.publishing).length,
        adminUsers: this.participants.filter(user => user.role === 'admin').length,
        mutedUsers: this.participants.filter(user => user.audiomuted).length,
        videoOffUsers: this.participants.filter(user => user.videomuted).length
      };
      
      // 更新调试信息
      if (this.isMobile) {
        Object.entries(stats).forEach(([key, value]) => {
          this.updateStreamInfo(key, value);
        });
        
        this.addDebugLog(`统计更新 - 总人数:${stats.totalUsers}, 推流:${stats.publishingUsers}, 主持人:${stats.adminUsers}`, 'info');
      }
      
      console.log('📊 统计信息更新:', stats);
      return stats;
    },
    
    // 关闭抽屉
    closeDrawer() {
      this.drawer = false;
      if (this.isMobile) {
        // 移动端关闭时的反馈
        this.$message({
          message: '直播详情已关闭',
          type: 'info',
          duration: 1500,
          showClose: false
        });
      }
    },
    
    // 添加调试日志
    addDebugLog(message, level = 'info') {
      const time = new Date().toLocaleTimeString();
      this.debugInfo.logs.push({ time, message, level });
      
      // 保持日志数量在合理范围内
      if (this.debugInfo.logs.length > 50) {
        this.debugInfo.logs = this.debugInfo.logs.slice(-30);
      }
      
      // 同时输出到控制台
      console.log(`[${time}] ${message}`);
    },
    
    // 更新视频状态
    updateVideoState(key, state) {
      this.$set(this.debugInfo.videoStates, key, state);
    },
    
    // 更新流信息
    updateStreamInfo(key, info) {
      this.$set(this.debugInfo.streamInfo, key, info);
    },
    
    // 清空调试日志
    clearDebugLogs() {
      this.debugInfo.logs = [];
    },
    
    // 强制刷新视频
    forceRefreshVideos() {
      this.addDebugLog('强制刷新视频...', 'info');
      
      // 重新触发视频流更新
      if (this.playVideoStream && this.playVideoStream.size > 0) {
        this.playVideoStreamUpdated(this.playVideoStream);
        this.addDebugLog(`重新处理 ${this.playVideoStream.size} 个视频流`, 'info');
      } else {
        this.addDebugLog('没有找到视频流', 'warn');
      }
    },
    
    // 添加移动端调试信息
    addMobileDebugInfo() {
      if (this.isMobile) {
        this.addDebugLog('=== 移动端调试信息 ===', 'info');
        this.addDebugLog(`User Agent: ${navigator.userAgent}`, 'info');
        this.addDebugLog(`屏幕尺寸: ${window.innerWidth}x${window.innerHeight}`, 'info');
        this.addDebugLog(`设备像素比: ${window.devicePixelRatio}`, 'info');
        this.addDebugLog(`WebRTC支持: ${this.supportsWebRTC ? '是' : '否'}`, 'info');
        this.addDebugLog(`浏览器类型: ${this.getBrowserType()}`, 'info');
        
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
    async tryPlayVideo(videoElement, key = 'unknown') {
      if (!videoElement || !videoElement.srcObject) {
        this.addDebugLog(`尝试播放视频失败: 元素或流不存在 (${key})`, 'error');
        return;
      }
      
      try {
        await videoElement.play();
        this.addDebugLog(`视频 ${key} 播放成功`, 'success');
        this.updateVideoState(key, '播放中');
      } catch (error) {
        this.addDebugLog(`视频 ${key} 自动播放失败: ${error.message}`, 'warn');
        this.updateVideoState(key, '需要用户交互');
        // 添加点击播放提示
        this.addPlayButton(videoElement, key);
      }
    },
    
    // 添加播放按钮
    addPlayButton(videoElement, key = 'unknown') {
      if (videoElement.parentElement.querySelector('.play-button')) return;
      
      this.addDebugLog(`为视频 ${key} 添加播放按钮`, 'info');
      
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
          this.addDebugLog(`用户手动播放视频 ${key} 成功`, 'success');
          this.updateVideoState(key, '手动播放成功');
          playButton.remove();
        } catch (error) {
          this.addDebugLog(`用户手动播放视频 ${key} 失败: ${error.message}`, 'error');
          this.updateVideoState(key, '手动播放失败');
        }
      };
      
      videoElement.parentElement.appendChild(playButton);
    },
    
    // 处理移动端视频流
    async handleMobileVideoStream(videoElement, key = 'unknown') {
      if (!videoElement || !videoElement.srcObject) {
        this.addDebugLog(`处理移动端视频流失败: 元素或流不存在 (${key})`, 'error');
        return;
      }
      
      this.addDebugLog(`开始处理移动端视频流: ${key}`, 'info');
      
      // 确保视频属性正确设置
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('playsinline', 'true');
      
      this.updateVideoState(key, `准备状态: ${videoElement.readyState}`);
      
      // 等待视频准备就绪
      if (videoElement.readyState >= 2) {
        // 视频已经有足够的数据开始播放
        this.addDebugLog(`视频 ${key} 已准备就绪，尝试播放`, 'info');
        await this.tryPlayVideo(videoElement, key);
      } else {
        // 等待视频加载
        this.addDebugLog(`等待视频 ${key} 加载数据...`, 'info');
        videoElement.addEventListener('loadeddata', () => {
          this.addDebugLog(`视频 ${key} 数据加载完成`, 'info');
          this.tryPlayVideo(videoElement, key);
        }, { once: true });
        
        // 添加超时处理
        setTimeout(() => {
          if (videoElement.readyState < 2) {
            this.addDebugLog(`视频 ${key} 加载超时`, 'error');
            this.updateVideoState(key, '加载超时');
          }
        }, 10000);
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
      // 权限检查：只有主持人才能结束直播
      if (this.liverole !== 'admin') {
        this.$message({
          message: '只有主持人才能结束直播',
          type: 'error',
          duration: 3000
        });
        return;
      }
      
      // 二次确认
      this.$confirm('确定要结束直播吗？结束后所有用户将被踢出直播间。', '确认结束直播', {
        confirmButtonText: '确定结束',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }).then(() => {
        //关闭直播间后将记得调用disconnect关闭信令以及停止推流
        let that = this
        
        // 显示加载状态
        const loading = this.$loading({
          lock: true,
          text: '正在结束直播...',
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        axios
          .post('/sig/v1/room/shutdown', {
            room: this.room.myInfo.room
          })
          .then(function(res) {
            console.log('关闭直播间了吗', res)
            that.room.disconnect()
            that.room.myInfo.role = that.liverole
            
            loading.close();
            that.$message({
              message: '直播已成功结束',
              type: 'success',
              duration: 3000
            });
          })
          .catch(function(error) {
            console.log(error)
            loading.close();
            that.$message({
              message: '结束直播失败，请重试',
              type: 'error',
              duration: 3000
            });
          })
      }).catch(() => {
        // 用户取消操作
        console.log('用户取消结束直播');
      });
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
        type: 'success',
        duration: 3000
      });
      
      // 添加调试日志
      if (this.isMobile) {
        this.addDebugLog(`用户加入: ${e.peer.username}`, 'success');
        this.updateStreamInfo('最新加入', e.peer.username);
      }
      
      // 强制更新统计
      this.$nextTick(() => {
        this.updateAllStats();
      });
    },
    //有人离开房间
    someOneLeaveRoom(e) {
      this.$message({
        message: e.peer.username + "已离开直播间",
        type: 'warning',
        duration: 3000
      });
      
      // 添加调试日志
      if (this.isMobile) {
        this.addDebugLog(`用户离开: ${e.peer.username}`, 'warn');
        this.updateStreamInfo('最新离开', e.peer.username);
      }
      
      // 强制更新统计
      this.$nextTick(() => {
        this.updateAllStats();
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
      let newSubStreams = []; // 使用临时数组，避免直接清空
      
      if (vStream.size == 0) {
        return false;
      }
      
      vStream.size && vStream.forEach((value, key) => {
        let isSome = this.participants.some((e) => {
          return e.display == key;
        });
        
        if (isSome) {
          // 普通视频流
          arr.push({ key: key, stream: value });
        } else {
          // 辅流处理
          // 检查是否已经存在相同的辅流
          const existingSubStream = this.subStreams.find(s => s.key === key);
          
          if (existingSubStream && existingSubStream.stream.id === value.id) {
            // 如果是同一个流（相同的key和stream id），保持不变，避免闪烁
            console.log('辅流未改变，保持现有流:', key, value.id);
            newSubStreams.push(existingSubStream);
          } else {
            // 只有在流真正改变时才更新
            console.log('辅流改变或新增:', key, value.id);
            console.log('查看该辅流的视频通道是否正常', value.getVideoTracks());
            console.log('查看该辅流的音频通道是否正常', value.getAudioTracks());
            
            newSubStreams.push({ key: key, stream: value });
          }
        }
      });
      
      // 只在辅流真正改变时才更新 subStreams
      // 比较新旧辅流的 key 和 stream id
      const oldSubStreamKeys = this.subStreams.map(s => `${s.key}_${s.stream.id}`).sort().join(',');
      const newSubStreamKeys = newSubStreams.map(s => `${s.key}_${s.stream.id}`).sort().join(',');
      
      if (oldSubStreamKeys !== newSubStreamKeys) {
        console.log('辅流列表发生变化，更新 subStreams');
        
        // 找出被移除的辅流，清理对应的video元素
        const removedSubStreams = this.subStreams.filter(
          oldSub => !newSubStreams.some(newSub => newSub.key === oldSub.key)
        );
        
        if (removedSubStreams.length > 0) {
          console.log('检测到辅流被移除:', removedSubStreams.map(s => s.key));
          this.cleanupRemovedSubStreams(removedSubStreams);
        }
        
        this.subStreams = newSubStreams;
        
        // 如果所有辅流都被移除，确保清理
        if (newSubStreams.length === 0) {
          console.log('所有辅流已移除，执行完整清理');
          this.cleanupAllSubStreams();
        } else {
          // 为新的辅流设置video元素
          this.$nextTick(() => {
            this.setupSubStreamVideos();
          });
        }
      } else {
        console.log('辅流列表未变化，保持现有状态');
      }
      
      console.log(this.subStreams, "当前辅流数");
      this.playVideos = arr;
    },
    //监听到右流推过来
    async playVideoStreamUpdated(vStream) {
      this.addDebugLog(`收到视频流更新，流数量: ${vStream.size}`, 'info');
      this.updateStreamInfo('总流数量', vStream.size);
      
      await this.changePlayVideos(vStream);
      clearTimeout(this.implementFun);
      this.implementFun = setTimeout(() => {
        if (vStream.size == 0) {
          this.addDebugLog('没有视频流可处理', 'warn');
          return false;
        }
        
        let processedCount = 0;
        vStream.forEach((value, key) => {
          const videoTracks = value.getVideoTracks();
          this.addDebugLog(`处理流 ${key}: 视频轨道数 ${videoTracks.length}`, 'info');
          
          if (videoTracks.length > 0 && !videoTracks[0].muted) {
            setTimeout(() => {
              if (this.$refs[key] && this.$refs[key][0]) {
                const videoElement = this.$refs[key][0];
                this.updateVideoState(key, '找到视频元素');
                
                if (!videoElement.srcObject) {
                  videoElement.srcObject = value;
                  this.addDebugLog(`设置视频流: ${key}`, 'success');
                  this.updateVideoState(key, '已设置流');
                  processedCount++;
                  
                  // 移动端特殊处理
                  if (this.isMobile) {
                    this.$nextTick(() => {
                      this.handleMobileVideoStream(videoElement, key);
                    });
                  }
                } else if (
                  videoElement.srcObject &&
                  videoElement.srcObject.id != value.id
                ) {
                  videoElement.srcObject = value;
                  this.addDebugLog(`更新视频流: ${key}`, 'success');
                  this.updateVideoState(key, '已更新流');
                  processedCount++;
                  
                  // 移动端特殊处理
                  if (this.isMobile) {
                    this.$nextTick(() => {
                      this.handleMobileVideoStream(videoElement, key);
                    });
                  }
                } else {
                  this.updateVideoState(key, '流已存在，无需更新');
                }
              } else {
                this.addDebugLog(`未找到视频元素: ${key}`, 'error');
                this.updateVideoState(key, '元素不存在');
              }
            }, 100);
          } else {
            this.addDebugLog(`流 ${key} 被静音或无视频轨道`, 'warn');
            this.updateVideoState(key, '静音或无轨道');
          }
        });
        
        this.updateStreamInfo('已处理流数量', processedCount);
        
        // 更新推流统计
        this.$nextTick(() => {
          this.updateAllStats();
        });
      }, 500);
    },
    async playVideosubStreamUpdated(vStream) {
      console.log(vStream, '辅流更新事件触发');
      if (vStream === null) return;
      
      // 注意：这个方法现在主要由 setupSubStreamVideos 处理
      // 保留此方法以兼容可能的其他调用
      console.log('playVideosubStreamUpdated 被调用，但现在由 setupSubStreamVideos 统一处理');
    },
    
    // 设置所有辅流的video元素
    setupSubStreamVideos() {
      console.log('setupSubStreamVideos: 开始设置辅流video元素');
      
      this.subStreams.forEach((subStream) => {
        const refName = 'subVideoStream_' + subStream.key;
        const videoElements = this.$refs[refName];
        
        if (!videoElements || videoElements.length === 0) {
          console.log(`辅流video元素不存在: ${refName}`);
          return;
        }
        
        const videoElement = Array.isArray(videoElements) ? videoElements[0] : videoElements;
        
        // 如果是同一个流，不做任何操作，避免闪烁
        if (videoElement.srcObject && videoElement.srcObject.id === subStream.stream.id) {
          console.log('辅流未改变，跳过更新:', subStream.key, subStream.stream.id);
          return;
        }
        
        console.log('设置辅流到video元素:', subStream.key, subStream.stream.id);
        
        // 平滑过渡：直接替换流，不暂停，不清空
        videoElement.srcObject = subStream.stream;
        
        // 确保播放
        videoElement.play().then(() => {
          console.log('辅流播放成功:', subStream.key);
        }).catch((error) => {
          console.log('辅流播放失败:', subStream.key, error);
        });
      });
    },
    
    // 清理被移除的辅流
    cleanupRemovedSubStreams(removedSubStreams) {
      console.log('cleanupRemovedSubStreams: 清理被移除的辅流');
      
      removedSubStreams.forEach((subStream) => {
        const refName = 'subVideoStream_' + subStream.key;
        const videoElements = this.$refs[refName];
        
        if (videoElements && videoElements.length > 0) {
          const videoElement = Array.isArray(videoElements) ? videoElements[0] : videoElements;
          
          console.log('清理辅流video元素:', subStream.key);
          
          // 暂停并清空srcObject
          if (videoElement.srcObject) {
            videoElement.pause();
            videoElement.srcObject = null;
          }
        }
      });
    },
    
    // 清理所有辅流
    cleanupAllSubStreams() {
      console.log('cleanupAllSubStreams: 清理所有辅流');
      
      // 遍历所有可能的辅流video元素
      Object.keys(this.$refs).forEach((refName) => {
        if (refName.startsWith('subVideoStream_')) {
          const videoElements = this.$refs[refName];
          
          if (videoElements && videoElements.length > 0) {
            const videoElement = Array.isArray(videoElements) ? videoElements[0] : videoElements;
            
            console.log('清理辅流video元素:', refName);
            
            if (videoElement.srcObject) {
              videoElement.pause();
              videoElement.srcObject = null;
            }
          }
        }
      });
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
  width: 98%;
  margin: 2vh auto 0;
  min-height: 120px;
  max-height: 35vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  grid-gap: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  
  // 桌面端 - 更多更小的视频
  @media (min-width: 1200px) {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    grid-gap: 8px;
    max-height: 30vh;
  }
  
  @media (min-width: 1600px) {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    grid-gap: 8px;
    max-height: 28vh;
  }
  
  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  }
}
.subvideoStyle {
  width: 95%;
  margin: 1vh auto 0;
  height: auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  grid-gap: 15px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    width: 100%;
    padding: 10px;
    grid-gap: 10px;
  }
}

.sub-video-item {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  aspect-ratio: 16/9;
  min-height: 200px;
}

.sub-video-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  padding: 0 12px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.5) 70%, transparent 100%);
  color: #fff;
  z-index: 20;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  
  span {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 32px;
  }
}

.sub-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
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
  position: relative;
  background: transparent;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  width: 100%;
  
  // 使用padding-top技巧确保16:9比例，避免高度不一致
  &::before {
    content: '';
    display: block;
    padding-top: 56.25%; // 16:9 = 9/16 = 0.5625 = 56.25%
  }
  
  // 桌面端悬停效果
  @media (min-width: 769px) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      z-index: 5;
    }
  }
  
  // 视频元素绝对定位，填充整个容器
  video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: transparent;
  }
  
  // videoHeader也需要绝对定位
  .videoHeader {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
  }
}

// 在线状态脉冲动画
@keyframes pulse-online {
  0% {
    box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
  }
  50% {
    box-shadow: 0 0 16px rgba(0, 255, 136, 0.8);
  }
  100% {
    box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
  }
}
.videoHeader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  padding: 0 8px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.4) 80%, transparent 100%);
  color: #fff;
  z-index: 20;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  border-radius: 6px 6px 0 0;
  
  span {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 24px;
  }
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

/* 小屏幕手机特殊优化 */
@media screen and (max-width: 480px) and (max-height: 700px) {
  .control-panel {
    padding: 4px 6px !important;
    gap: 4px !important;
  }
  
  .control-panel .el-input .el-input__inner,
  .control-panel .el-select .el-input__inner {
    height: 32px !important;
    line-height: 32px !important;
    font-size: 13px !important;
  }
  
  .control-panel .el-button {
    height: 34px !important;
    font-size: 13px !important;
    padding: 5px 10px !important;
  }
  
  .videoStyle {
    max-height: 70vh !important;
    min-height: 250px !important;
    margin: 0.5vh auto 0 !important;
  }
}

/* 移动端适配 - 垂直滚动列表 */
@media screen and (max-width: 768px) {
  /* 顶部控制区域适配 - 更紧凑 */
  .control-panel {
    flex-direction: column !important;
    align-items: center !important;
    padding: 6px 8px !important;
    gap: 6px !important;
    margin-bottom: 5px !important;
  }
  
  /* 输入框和按钮适配 - 更紧凑 */
  .control-panel > * {
    margin: 2px 0 !important;
    width: 95% !important;
    max-width: 320px !important;
  }
  
  /* Element UI 组件特殊处理 - 统一高度 */
  .control-panel .el-input {
    width: 95% !important;
    max-width: 320px !important;
  }
  
  .control-panel .el-input .el-input__inner {
    height: 34px !important;
    line-height: 34px !important;
    font-size: 14px !important;
  }
  
  .control-panel .el-select {
    width: 95% !important;
    max-width: 320px !important;
  }
  
  .control-panel .el-select .el-input__inner {
    height: 34px !important;
    line-height: 34px !important;
    font-size: 14px !important;
  }
  
  .control-panel .el-button {
    width: 95% !important;
    max-width: 320px !important;
    height: 36px !important;
    font-size: 14px !important;
    padding: 6px 12px !important;
  }
  
  /* 移动端视频区域 - 垂直滚动 */
  .videoStyle {
    width: 100% !important;
    margin: 0 !important;
    padding: 10px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    max-height: 70vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    background: transparent !important;
    border-radius: 0 !important;
    border: none !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  /* 所有视频统一样式 */
  .playvideo {
    width: 100% !important;
    height: auto !important;
    min-height: 200px !important;
    aspect-ratio: 16/9 !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
    margin: 0 !important;
    background: transparent !important;
    
    video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      background: transparent !important;
      border-radius: 8px !important;
    }
    
    .videoHeader {
      height: 32px !important;
      padding: 0 12px !important;
      font-size: 14px !important;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.4) 70%, transparent 100%) !important;
      border-radius: 8px 8px 0 0 !important;
      
      span {
        line-height: 32px !important;
      }
    }
  }
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
    position: relative !important;
  }
  
  /* 移动端专用关闭按钮区域 */
  .mobile-drawer-close {
    position: sticky !important;
    top: 0 !important;
    background: white !important;
    padding: 10px 15px !important;
    border-bottom: 1px solid #f0f0f0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    z-index: 100 !important;
    
    .close-btn {
      background: #ff4757 !important;
      border-color: #ff4757 !important;
      color: white !important;
      
      &:hover {
        background: #ff3838 !important;
        border-color: #ff3838 !important;
      }
    }
    
    .close-hint {
      font-size: 12px !important;
      color: #666 !important;
      flex: 1 !important;
      text-align: center !important;
    }
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

@media screen and (max-width: 480px) {
  /* 超小屏幕适配 */
  .videoStyle {
    grid-template-columns: 1fr !important;
    padding: 8px !important;
    grid-gap: 8px !important;
  }
  
  .playvideo {
    min-height: 180px !important;
    aspect-ratio: 16/9 !important;
  }
  
  .playvideo video {
    min-height: 180px !important;
  }
  
  .videoHeader {
    min-height: 24px !important;
    padding: 4px 8px !important;
    font-size: 11px !important;
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
    padding: 8px 12px !important;
    font-size: 14px !important;
  }
  
  .live-drawer .el-drawer__body > div {
    padding: 8px 12px !important;
  }
  
  /* 超小屏幕的关闭按钮区域 */
  .mobile-drawer-close {
    padding: 8px 12px !important;
    
    .close-btn {
      width: 32px !important;
      height: 32px !important;
    }
    
    .close-hint {
      font-size: 11px !important;
    }
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
    margin: 1vh 0 0 0 !important;
    padding: 10px !important;
    grid-template-columns: 1fr !important;
    grid-gap: 10px !important;
    background: rgba(0, 0, 0, 0.05) !important;
  }
  
  .sub-video-item {
    min-height: 200px !important;
    aspect-ratio: 16/9 !important;
  }
  
  .sub-video {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    background: #000 !important;
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
  
  /* 移动端调试面板样式 */
  .debug-content {
    position: fixed !important;
    top: 50px !important;
    right: 10px !important;
    width: 300px !important;
    max-height: 70vh !important;
    background: rgba(0,0,0,0.9) !important;
    color: white !important;
    padding: 15px !important;
    border-radius: 8px !important;
    z-index: 9999 !important;
    overflow-y: auto !important;
    font-size: 12px !important;
    backdrop-filter: blur(10px) !important;
  }
  
  .debug-section {
    margin-bottom: 15px !important;
    padding-bottom: 10px !important;
    border-bottom: 1px solid rgba(255,255,255,0.2) !important;
  }
  
  .debug-section h4 {
    margin: 0 0 8px 0 !important;
    color: #00ff88 !important;
    font-size: 14px !important;
  }
  
  .debug-section p {
    margin: 2px 0 !important;
    font-size: 11px !important;
    line-height: 1.4 !important;
  }
  
  .debug-logs {
    max-height: 150px !important;
    overflow-y: auto !important;
    background: rgba(255,255,255,0.1) !important;
    padding: 8px !important;
    border-radius: 4px !important;
  }
  
  .log-item {
    margin: 2px 0 !important;
    font-size: 10px !important;
    line-height: 1.3 !important;
  }
  
  .log-time {
    color: #888 !important;
    margin-right: 5px !important;
  }
  
  .log-info {
    color: #fff !important;
  }
  
  .log-success {
    color: #00ff88 !important;
  }
  
  .log-warn {
    color: #ffaa00 !important;
  }
  
  .log-error {
    color: #ff4444 !important;
  }
}
</style>
