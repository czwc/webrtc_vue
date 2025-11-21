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
    <div style="width: 100%;">
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
        
        <!-- 布局切换按钮（仅在有辅流时显示） -->
        <el-dropdown @command="changeLayout" v-if="isJoined && subStreams.length > 0" style="margin-left: 6px">
          <el-button type="info" icon="el-icon-s-grid">
            布局 <i class="el-icon-arrow-down el-icon--right"></i>
          </el-button>
          <el-dropdown-menu slot="dropdown">
            <el-dropdown-item 
              v-for="option in layoutOptions" 
              :key="option.value"
              :command="option.value"
              :icon="option.icon">
              {{ option.label }}
              <span v-if="layoutMode === option.value" style="color: #409EFF; margin-left: 10px;">✓</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>
    </div>
    
    <!-- 主内容区域：左右分栏布局 -->
    <div class="live-main-content" :class="'layout-' + layoutMode">
      <!-- 左侧：主流视频网格 -->
      <div class="main-streams-section" :style="mainStreamsSectionStyle">
        <div class="video-container">
          <!-- 分页控制栏 -->
          <div class="pagination-bar" :class="{ 'collapsed': isMainStreamCollapsed }">
            <!-- 上部：缩放按钮 + 页码导航 -->
            <div class="pagination-top">
              <!-- 缩放按钮（桌面端显示，移动端隐藏） -->
              <div 
                class="zoom-button-wrapper desktop-only" 
                @click="toggleMainStreamSize"
              >
                <i
                  :class="isMainStreamCollapsed ? 'el-icon-full-screen' : 'el-icon-zoom-out'"
                  class="zoom-button"
                  :title="isMainStreamCollapsed ? '放大主流' : '缩小主流'"
                ></i>
              </div>
              
              <!-- 页码导航 -->
              <div class="page-navigation">
                <i
                  v-show="page > 0"
                  @click="firstPage"
                  class="el-icon-d-arrow-left nav-icon"
                  title="首页"
                ></i>
                <i
                  v-show="page > 0"
                  @click="leftPage"
                  class="el-icon-arrow-left nav-icon nav-icon-main"
                  title="上一页"
                ></i>
                
                <div class="page-info">
                  <span>第</span>
                  <el-input
                    v-model.number="jumpToPageInput"
                    @keyup.enter.native="handleJumpToPage"
                    @blur="handleJumpToPage"
                    size="mini"
                    type="number"
                    min="1"
                    :max="Math.ceil(getPlayVideoStreamSize() / limit)"
                    class="page-input"
                    placeholder=""
                  />
                  <span>/{{ Math.ceil(getPlayVideoStreamSize() / limit) }}页</span>
                </div>
                
                <i
                  v-show="getPlayVideoStreamSize() > page + limit"
                  @click="rightPage"
                  class="el-icon-arrow-right nav-icon nav-icon-main"
                  title="下一页"
                ></i>
                <i
                  v-show="getPlayVideoStreamSize() > page + limit"
                  @click="lastPage"
                  class="el-icon-d-arrow-right nav-icon"
                  title="尾页"
                ></i>
              </div>
            </div>
            
            <!-- 下部：每页数量选择器 -->
            <div class="pagination-bottom">
              <el-select 
                v-model="limit" 
                @change="onPageSizeChange"
                size="small"
                class="page-size-select"
              >
                <el-option label="每页2个" :value="2"></el-option>
                <el-option label="每页6个" :value="6"></el-option>
                <el-option label="每页9个" :value="9"></el-option>
                <el-option label="每页12个" :value="12"></el-option>
                <el-option label="每页15个" :value="15"></el-option>
              </el-select>
            </div>
      </div>
      
      <!-- 视频网格 -->
      <div class="videoStyle" :class="{ 'collapsed': isMainStreamCollapsed }">
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
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsinline
                webkit-playsinline
                x5-playsinline
                x5-video-player-type="h5"
                x5-video-player-fullscreen="true"
                style="width: 100%; height: 100%"
                class="video"
                :ref="i"
                @click="handleVideoClick(i)"
                @loadedmetadata="onVideoLoadedMetadata($event, i)"
                @canplay="onVideoCanPlay($event, i)"
                @playing="onVideoPlaying($event, i)"
                @error="onVideoError($event, i)"
                @stalled="onVideoStalled($event, i)"
                @waiting="onVideoWaiting($event, i)"
                @suspend="onVideoSuspend($event, i)"
                @emptied="onVideoEmptied($event, i)"
                @pause="onVideoPause($event, i)"
                :class="{ 'video-fullscreen': fullscreenVideo === i }"
              ></video>
            </div>
          </div>
        </template>
          </div>
        </div>
      </div>
      <!-- 左侧主流区域结束 -->
      
      <!-- 右侧：辅流视频区域 -->
        <div v-if="subStreams.length > 0" class="sub-streams-section" :style="subStreamsSectionStyle">
          <div class="subvideoStyle sub-streams-wrapper">
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
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                style="width:100%;height: 100%;"
                class="video sub-video"
                :ref="'subVideoStream_' + subStream.key"
                @pause="onSubVideoPause($event, subStream.key)"
              ></video>
            </div>  
          </div>
        </div>
        <!-- 右侧辅流区域结束 -->
      </div>
      <!-- 主内容区域结束 -->


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
      limit: 9, // 默认每页数量（推荐值）
      recommendedLimit: 12, // 推荐的每页数量（性能最优）
      jumpToPageInput: 1, // 跳转页码输入
      videoPlayers: null,
      // 布局模式配置
      layoutMode: 'left-right', // 'left-right', 'top-bottom', 'sub-first'
      mainStreamsWidth: '30%', // 主流区域宽度
      subStreamsWidth: '70%', // 辅流区域宽度
      isMainStreamCollapsed: true, // 主流区域是否收起（默认缩小）
      layoutOptions: [
        { value: 'left-right', label: '左右分栏', icon: 'el-icon-s-grid' },
        { value: 'top-bottom', label: '上下布局', icon: 'el-icon-d-caret' },
        { value: 'sub-first', label: '辅流优先', icon: 'el-icon-monitor' }
      ],
      // 性能优化开关（可通过localStorage或配置控制）
      performanceOptimization: {
        enabled: true, // 是否启用性能优化
        lazyLoadStreams: true, // 懒加载流（只处理可见视频）
        cleanupInvisible: true, // 清理不可见视频的健康检查
        stats: {
          totalStreams: 0,
          visibleStreams: 0,
          skippedStreams: 0,
          lastUpdateTime: 0,
          updateCount: 0
        }
      },
      statsOutputAudio:"",
      statsOutputVideo:"",
      statsInputAudio:"",
      statsInputVideo:"",
      // 用于跟踪之前的视频流状态，避免重复渲染
      previousVideoStreams: new Map(),
      // 视频流健康检查
      videoHealthCheck: {
        timers: new Map(), // 每个视频的检查定时器
        states: new Map(), // 每个视频的健康状态
        lastPlayingTime: new Map(), // 每个视频最后播放时间
        lastRecoveryTime: new Map(), // 每个视频最后恢复时间
        recoveryCount: new Map(), // 每个视频的恢复次数
        checkInterval: 5000, // 检查间隔5秒（避免过于频繁）
        timeout: 15000, // 超时时间15秒（给更多缓冲时间）
        recoveryCooldown: 10000, // 恢复冷却时间10秒（防止频繁恢复）
        maxRecoveryAttempts: 3, // 最大恢复次数（避免无限循环）
      },
    };
  },
  mounted() {
    // 检测移动端
    this.checkMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.checkMobile);
    
    // 添加移动端调试信息
    this.addMobileDebugInfo();
    
    // 从localStorage恢复每页数量设置
    this.loadPageSizeFromStorage();
    
    // 从localStorage恢复布局偏好
    this.loadLayoutPreference();
    
    // 添加键盘快捷键监听
    window.addEventListener('keydown', this.handleKeyboardShortcut);
    
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
    
    // 主流区域样式
    mainStreamsSectionStyle() {
      if (this.layoutMode === 'left-right') {
        // 根据收起状态动态调整宽度
        const width = this.isMainStreamCollapsed ? '15%' : this.mainStreamsWidth;
        return {
          width: width,
          height: '100%',
          minWidth: this.isMainStreamCollapsed ? '180px' : 'auto'
        };
      } else if (this.layoutMode === 'top-bottom') {
        return {
          width: '100%',
          height: '40%'
        };
      } else if (this.layoutMode === 'sub-first') {
        return {
          width: '100%',
          height: '150px'
        };
      }
      return {};
    },
    
    // 辅流区域样式
    subStreamsSectionStyle() {
      if (this.layoutMode === 'left-right') {
        // 根据主流收起状态动态调整宽度
        const width = this.isMainStreamCollapsed ? '85%' : this.subStreamsWidth;
        return {
          width: width,
          height: '100%'
        };
      } else if (this.layoutMode === 'top-bottom') {
        return {
          width: '100%',
          height: '60%'
        };
      } else if (this.layoutMode === 'sub-first') {
        return {
          width: '100%',
          height: 'calc(100% - 150px)'
        };
      }
      return {};
    },
    
    // 视频网格列数
    videoGridColumns() {
      return this.isMainStreamCollapsed ? 1 : 3;
    },
  },
  beforeDestroy() {
    // 清理事件监听器
    window.removeEventListener('resize', this.checkMobile);
    window.removeEventListener('keydown', this.handleKeyboardShortcut);
    
    // 清理所有定时器
    if (this.implementFun) {
      clearTimeout(this.implementFun);
      this.implementFun = null;
    }
    
    // 清理所有视频健康检查
    this.cleanupAllVideoHealthChecks();
    
    // 清理 room 相关的事件监听器（防止内存泄漏）
    if (this.room) {
      this.room.removeListener("play-audio-stream-updated", this.playAudioStreamUpdated);
      this.room.removeListener("play-video-stream-updated", this.playVideoStreamUpdated);
      this.room.removeListener("play-video-substream-updated", this.playVideosubStreamUpdated);
      this.room.removeListener("allow-to-push-video", this.allowToPushVideo);
      this.room.removeListener("is-kicked-by-other-device", this.kickUser);
      this.room.removeListener("startRecordSuccess", this.alartStartRecord);
      this.room.removeListener("stopRecordSuccess", this.alartStoptRecord);
      this.room.removeListener("start-speaking", this.speakingStart);
      this.room.removeListener("peer-leave", this.someOneLeaveRoom);
      this.room.removeListener("peer-joined", this.someOneJoinRoom);
      this.room.removeListener("stop-speaking", this.speakingStop);
      this.room.removeListener("device-change", this.deviceChange);
      this.room.removeListener("errormsg", this.getErrorMsg);
      this.room.removeListener("sendMsg", this.getMsgs);
    }
    
    // 清理 deviceInfo 相关的事件监听器
    if (this.deviceInfo) {
      this.deviceInfo.removeListener("audio-output-updated", this.deviceOutputChange);
    }
    
    // 清理 micCheck 相关的事件监听器
    if (this.micCheck) {
      this.micCheck.removeListener("local-stream-updated", this.micCheckStreamUpdated);
    }
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
      
      // 清空跟踪状态，强制重新处理所有视频
      this.previousVideoStreams.clear();
      
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
    // ========== 视频流健康检查相关方法 ==========
    
    // 检查视频是否在当前页面可见
    isVideoVisible(videoKey) {
      // 获取视频在列表中的索引
      const streamArray = Array.from(this.playVideoStream.keys());
      const index = streamArray.indexOf(videoKey);
      
      if (index === -1) return false;
      
      // 检查是否在当前页面范围内
      return index >= this.page && index < this.page + this.limit;
    },
    
    // 启动视频健康检查
    startVideoHealthCheck(videoKey) {
      // 只为可见的视频启动健康检查，优化性能
      if (!this.isVideoVisible(videoKey)) {
        console.log(`跳过不可见视频的健康检查: ${videoKey}`);
        return;
      }
      
      // 清除旧的定时器
      this.stopVideoHealthCheck(videoKey);
      
      // 初始化状态
      this.videoHealthCheck.states.set(videoKey, 'checking');
      this.videoHealthCheck.lastPlayingTime.set(videoKey, Date.now());
      
      // 启动定时检查
      const timer = setInterval(() => {
        this.checkVideoHealth(videoKey);
      }, this.videoHealthCheck.checkInterval);
      
      this.videoHealthCheck.timers.set(videoKey, timer);
      console.log(`启动视频健康检查: ${videoKey}`);
    },
    
    // 停止视频健康检查
    stopVideoHealthCheck(videoKey) {
      const timer = this.videoHealthCheck.timers.get(videoKey);
      if (timer) {
        clearInterval(timer);
        this.videoHealthCheck.timers.delete(videoKey);
        this.videoHealthCheck.states.delete(videoKey);
        this.videoHealthCheck.lastPlayingTime.delete(videoKey);
        this.videoHealthCheck.lastRecoveryTime.delete(videoKey);
        this.videoHealthCheck.recoveryCount.delete(videoKey);
        console.log(`停止视频健康检查: ${videoKey}`);
      }
    },
    
    // 检查视频健康状态
    checkVideoHealth(videoKey) {
      const videoElements = this.$refs[videoKey];
      if (!videoElements || !videoElements[0]) {
        // video元素不存在，停止检查
        this.stopVideoHealthCheck(videoKey);
        return;
      }
      
      const videoElement = videoElements[0];
      const currentState = this.videoHealthCheck.states.get(videoKey);
      const lastPlayingTime = this.videoHealthCheck.lastPlayingTime.get(videoKey);
      const now = Date.now();
      
      // 检查视频元素是否有流
      if (!videoElement.srcObject) {
        console.warn(`视频元素没有流 [${videoKey}]`);
        return; // 没有流的情况下不进行健康检查
      }
      
      // 检查视频状态
      const isPlaying = !videoElement.paused && !videoElement.ended && videoElement.readyState > 2;
      const hasError = videoElement.error !== null;
      
      // 更准确的卡顿判断：只有在 NETWORK_LOADING 且长时间没有数据时才认为卡顿
      const isNetworkLoading = videoElement.networkState === 2;
      const isBuffering = videoElement.readyState < 3; // HAVE_FUTURE_DATA
      const timeSinceLastPlay = now - lastPlayingTime;
      
      if (hasError) {
        // 只有真正的错误才处理
        console.error(`视频流错误 [${videoKey}]:`, videoElement.error);
        this.handleVideoStreamError(videoKey, 'error');
      } else if (isPlaying) {
        // 视频正常播放 - 最优先的状态
        if (currentState !== 'playing') {
          console.log(`视频流正常播放 [${videoKey}]`);
          this.videoHealthCheck.states.set(videoKey, 'playing');
          // 重置恢复计数（视频已经恢复正常）
          this.videoHealthCheck.recoveryCount.set(videoKey, 0);
        }
        this.videoHealthCheck.lastPlayingTime.set(videoKey, now);
      } else if (isNetworkLoading && isBuffering && timeSinceLastPlay > this.videoHealthCheck.timeout) {
        // 只有长时间缓冲且超时才认为需要恢复
        if (currentState !== 'recovering') {
          console.warn(`视频流超时 [${videoKey}]: 超过${this.videoHealthCheck.timeout/1000}秒未播放`);
          this.handleVideoStreamError(videoKey, 'timeout');
        }
      } else if (isBuffering && timeSinceLastPlay < this.videoHealthCheck.timeout) {
        // 正常缓冲中，不需要处理
        if (currentState !== 'buffering') {
          console.log(`视频缓冲中 [${videoKey}]`);
          this.videoHealthCheck.states.set(videoKey, 'buffering');
        }
      }
    },
    
    // 处理视频流错误
    handleVideoStreamError(videoKey, errorType) {
      const stream = this.playVideoStream.get(videoKey);
      if (!stream) return;
      
      const now = Date.now();
      const lastRecoveryTime = this.videoHealthCheck.lastRecoveryTime.get(videoKey) || 0;
      const recoveryCount = this.videoHealthCheck.recoveryCount.get(videoKey) || 0;
      
      // 检查是否在冷却时间内
      if (now - lastRecoveryTime < this.videoHealthCheck.recoveryCooldown) {
        console.log(`跳过恢复 [${videoKey}]: 冷却时间内 (${Math.round((now - lastRecoveryTime) / 1000)}秒)`);
        return;
      }
      
      // 检查是否超过最大恢复次数
      if (recoveryCount >= this.videoHealthCheck.maxRecoveryAttempts) {
        console.warn(`停止恢复 [${videoKey}]: 已达到最大尝试次数 (${recoveryCount}次)`);
        this.videoHealthCheck.states.set(videoKey, 'failed');
        this.stopVideoHealthCheck(videoKey); // 停止健康检查，避免继续尝试
        return;
      }
      
      console.log(`尝试恢复视频流 [${videoKey}], 错误类型: ${errorType}, 第${recoveryCount + 1}次尝试`);
      
      const videoElements = this.$refs[videoKey];
      if (videoElements && videoElements[0]) {
        const videoElement = videoElements[0];
        
        // 标记为恢复中
        this.videoHealthCheck.states.set(videoKey, 'recovering');
        this.videoHealthCheck.lastRecoveryTime.set(videoKey, now);
        this.videoHealthCheck.recoveryCount.set(videoKey, recoveryCount + 1);
        
        // 尝试重新设置流
        try {
          // 先清空
          videoElement.srcObject = null;
          
          // 短暂延迟后重新设置
          setTimeout(() => {
            const currentStream = this.playVideoStream.get(videoKey);
            if (currentStream && videoElements[0]) {
              videoElements[0].srcObject = currentStream;
              console.log(`重新设置视频流 [${videoKey}]`);
              
              // 尝试播放
              videoElements[0].play().catch(err => {
                console.error(`视频播放失败 [${videoKey}]:`, err);
              });
              
              // 更新最后播放时间
              this.videoHealthCheck.lastPlayingTime.set(videoKey, Date.now());
            }
          }, 500);
        } catch (error) {
          console.error(`恢复视频流失败 [${videoKey}]:`, error);
        }
      }
    },
    
    // 清理所有视频健康检查
    cleanupAllVideoHealthChecks() {
      this.videoHealthCheck.timers.forEach((timer, key) => {
        clearInterval(timer);
      });
      this.videoHealthCheck.timers.clear();
      this.videoHealthCheck.states.clear();
      this.videoHealthCheck.lastPlayingTime.clear();
      this.videoHealthCheck.lastRecoveryTime.clear();
      this.videoHealthCheck.recoveryCount.clear();
      console.log('清理所有视频健康检查');
    },
    
    // ========== 视频事件处理方法 ==========
    
    onVideoLoadedMetadata(event, videoKey) {
      console.log(`视频元数据加载完成 [${videoKey}]`);
      if (this.isMobile) {
        this.tryPlayVideo(event.target);
      }
    },
    
    onVideoCanPlay(event, videoKey) {
      console.log(`视频可以播放 [${videoKey}]`);
      if (this.isMobile) {
        this.tryPlayVideo(event.target);
      }
    },
    
    onVideoPlaying(event, videoKey) {
      console.log(`视频开始播放 [${videoKey}]`);
      // 更新健康状态
      this.videoHealthCheck.states.set(videoKey, 'playing');
      this.videoHealthCheck.lastPlayingTime.set(videoKey, Date.now());
    },
    
    onVideoError(event, videoKey) {
      const error = event.target.error;
      console.error(`视频播放错误 [${videoKey}]:`, error);
      
      let errorMessage = '视频播放失败';
      if (error) {
        switch (error.code) {
          case 1: errorMessage = '视频加载被中止'; break;
          case 2: errorMessage = '网络错误'; break;
          case 3: errorMessage = '视频解码失败'; break;
          case 4: errorMessage = '视频格式不支持'; break;
        }
      }
      
      this.addDebugLog(`${errorMessage} [${videoKey}]`, 'error');
      this.videoHealthCheck.states.set(videoKey, 'error');
      
      // 尝试自动恢复
      setTimeout(() => {
        this.handleVideoStreamError(videoKey, 'error');
      }, 1000);
    },
    
    onVideoStalled(event, videoKey) {
      console.warn(`视频缓冲卡顿 [${videoKey}]`);
      this.videoHealthCheck.states.set(videoKey, 'stalled');
      // 不立即尝试恢复，让健康检查机制来处理
    },
    
    onVideoWaiting(event, videoKey) {
      // console.log(`视频等待数据 [${videoKey}]`);
      this.videoHealthCheck.states.set(videoKey, 'waiting');
      // 等待数据是正常现象，不需要处理
    },
    
    onVideoSuspend(event, videoKey) {
      // console.log(`视频加载挂起 [${videoKey}]`);
      // suspend 是正常的网络优化行为，不需要处理
    },
    
    onVideoEmptied(event, videoKey) {
      console.warn(`视频流被清空 [${videoKey}]`);
      this.videoHealthCheck.states.set(videoKey, 'emptied');
      
      // 只有在确实需要时才尝试恢复（通过健康检查机制判断）
      // 不立即恢复，避免误判导致闪烁
    },
    
    // 禁止用户暂停直播视频
    onVideoPause(event, videoKey) {
      const videoElement = event.target;
      console.log(`检测到暂停操作 [${videoKey}]，直播不允许暂停，自动恢复播放`);
      
      // 延迟一帧，确保暂停事件处理完成后再恢复播放
      this.$nextTick(() => {
        if (videoElement.paused) {
          videoElement.play().then(() => {
            console.log(`直播视频 [${videoKey}] 已恢复播放`);
            
          }).catch(err => {
            console.error(`恢复播放失败 [${videoKey}]:`, err);
          });
        }
      });
    },
    
    // 禁止用户暂停辅流视频
    onSubVideoPause(event, subKey) {
      const videoElement = event.target;
      console.log(`检测到辅流暂停操作 [${subKey}]，直播不允许暂停，自动恢复播放`);
      
      this.$nextTick(() => {
        if (videoElement.paused) {
          videoElement.play().then(() => {
            console.log(`辅流视频 [${subKey}] 已恢复播放`);
            
          }).catch(err => {
            console.error(`辅流恢复播放失败 [${subKey}]:`, err);
          });
        }
      });
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
    // 获取当前页面可见的视频key列表（性能优化核心方法）
    getVisibleVideoKeys() {
      if (!this.playVideoStream || this.playVideoStream.size === 0) {
        return [];
      }
      
      // 如果性能优化未启用，返回所有key（向后兼容）
      if (!this.performanceOptimization.enabled || !this.performanceOptimization.lazyLoadStreams) {
        return Array.from(this.playVideoStream.keys());
      }
      
      const streamArray = Array.from(this.playVideoStream.keys());
      const visibleKeys = streamArray.slice(this.page, this.page + this.limit);
      
      // 更新性能统计
      this.performanceOptimization.stats.totalStreams = streamArray.length;
      this.performanceOptimization.stats.visibleStreams = visibleKeys.length;
      this.performanceOptimization.stats.skippedStreams = streamArray.length - visibleKeys.length;
      
      return visibleKeys;
    },
    // 清理不可见视频的健康检查（性能优化）
    cleanupInvisibleHealthChecks() {
      // 如果性能优化未启用，不执行清理
      if (!this.performanceOptimization.enabled || !this.performanceOptimization.cleanupInvisible) {
        return;
      }
      
      const visibleKeys = this.getVisibleVideoKeys();
      const allKeys = Array.from(this.videoHealthCheck.timers.keys());
      
      let cleanedCount = 0;
      allKeys.forEach(key => {
        if (!visibleKeys.includes(key)) {
          // 停止不在当前页面的视频的健康检查
          this.stopVideoHealthCheck(key);
          cleanedCount++;
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`性能优化：清理了 ${cleanedCount} 个不可见视频的健康检查`);
      }
    },
    // 为可见视频设置流（翻页时调用）
    setupVisibleStreams() {
      const visibleKeys = this.getVisibleVideoKeys();
      
      visibleKeys.forEach(key => {
        const stream = this.playVideoStream.get(key);
        if (!stream) return;
        
        const videoElements = this.$refs[key];
        if (videoElements && videoElements[0]) {
          const videoElement = videoElements[0];
          
          // 如果流还没有设置，则设置
          if (!videoElement.srcObject || videoElement.srcObject.id !== stream.id) {
            videoElement.srcObject = stream;
            console.log(`翻页：设置视频流 ${key}`);
            
            // 启动健康检查
            this.$nextTick(() => {
              this.startVideoHealthCheck(key);
            });
          }
        }
      });
    },
    // 下一页
    rightPage() {
      const totalSize = this.getPlayVideoStreamSize();
      if (this.page + this.limit < totalSize) {
        this.page = this.page + this.limit;
        this.refreshCurrentPage();
      }
    },
    // 上一页
    leftPage() {
      if (this.page > 0) {
        this.page = Math.max(0, this.page - this.limit);
        this.refreshCurrentPage();
      }
    },
    // 首页
    firstPage() {
      if (this.page !== 0) {
        this.page = 0;
        this.refreshCurrentPage();
      }
    },
    // 尾页
    lastPage() {
      const totalSize = this.getPlayVideoStreamSize();
      const totalPages = Math.ceil(totalSize / this.limit);
      const lastPageStart = (totalPages - 1) * this.limit;
      
      if (this.page !== lastPageStart) {
        this.page = lastPageStart;
        this.refreshCurrentPage();
      }
    },
    // 刷新当前页面（统一的翻页后处理）- 优化版
    refreshCurrentPage() {
      // 性能优化：翻页时不重新处理所有流，只设置当前页面的流
      console.log('翻页优化：仅设置当前页面的视频流');
      
      // 清理不在当前页面的视频的健康检查
      this.cleanupInvisibleHealthChecks();
      
      // 延迟一帧，确保DOM已更新
      this.$nextTick(() => {
        // 只为当前页面的视频设置流
        this.setupVisibleStreams();
      });
    },
    // 每页数量变化时
    onPageSizeChange(newLimit) {
      console.log(`每页数量改为: ${newLimit}`);
      
      // 清理所有健康检查
      this.cleanupAllVideoHealthChecks();
      
      // 保存到localStorage
      this.savePageSizeToStorage(newLimit);
      
      // 智能调整page，保持当前查看的内容尽可能不变
      const currentFirstItemIndex = this.page;
      this.page = Math.floor(currentFirstItemIndex / newLimit) * newLimit;
      
      // 根据每页数量给出性能提示
      if (newLimit >= 20) {
        this.$message.warning({
          message: `每页${newLimit}个视频可能导致卡顿，建议配置较好的电脑使用`,
          duration: 3000
        });
      } else if (newLimit >= 12) {
        this.$message.info({
          message: `每页${newLimit}个视频，推荐中高配置电脑使用`,
          duration: 2000
        });
      } 
      
      // 触发视频流更新
      this.$nextTick(() => {
        this.playVideoStreamUpdated(this.playVideoStream);
      });
    },
    
    // 切换主流区域大小
    toggleMainStreamSize() {
      this.isMainStreamCollapsed = !this.isMainStreamCollapsed;
      
      let message = '';
      if (this.subStreams.length > 0) {
        message = this.isMainStreamCollapsed 
          ? '主流已缩小（1列），辅流已放大' 
          : '主流已放大（3列），辅流已缩小';
      } else {
        message = this.isMainStreamCollapsed 
          ? '主流已缩小为1列显示' 
          : '主流已恢复3列显示';
      }
      
      this.$message({
        message: message,
        type: 'success',
        duration: 2000
      });
      
      // 保存偏好设置
      try {
        localStorage.setItem('isMainStreamCollapsed', this.isMainStreamCollapsed);
      } catch (error) {
        console.error('保存缩放状态失败:', error);
      }
    },
    
    // 切换布局模式
    changeLayout(mode) {
      this.layoutMode = mode;
      
      // 根据模式设置默认宽度
      if (mode === 'left-right') {
        this.mainStreamsWidth = '30%';
        this.subStreamsWidth = '70%';
      } else if (mode === 'top-bottom') {
        this.mainStreamsWidth = '100%';
        this.subStreamsWidth = '100%';
      } else if (mode === 'sub-first') {
        this.mainStreamsWidth = '100%';
        this.subStreamsWidth = '100%';
      }
      
      // 保存布局偏好
      this.saveLayoutPreference();
      
      const layoutLabels = {
        'left-right': '左右分栏',
        'top-bottom': '上下布局',
        'sub-first': '辅流优先'
      };
      
      
    },
    
    // 保存布局偏好
    saveLayoutPreference() {
      try {
        localStorage.setItem('liveLayoutMode', this.layoutMode);
        localStorage.setItem('liveMainStreamsWidth', this.mainStreamsWidth);
        localStorage.setItem('liveSubStreamsWidth', this.subStreamsWidth);
      } catch (error) {
        console.error('保存布局偏好失败:', error);
      }
    },
    
    // 加载布局偏好
    loadLayoutPreference() {
      try {
        const savedLayout = localStorage.getItem('liveLayoutMode');
        const savedMainWidth = localStorage.getItem('liveMainStreamsWidth');
        const savedSubWidth = localStorage.getItem('liveSubStreamsWidth');
        const savedCollapsed = localStorage.getItem('isMainStreamCollapsed');
        
        if (savedLayout) {
          this.layoutMode = savedLayout;
          console.log(`从localStorage恢复布局模式: ${savedLayout}`);
        }
        if (savedMainWidth) {
          this.mainStreamsWidth = savedMainWidth;
        }
        if (savedSubWidth) {
          this.subStreamsWidth = savedSubWidth;
        }
        if (savedCollapsed !== null) {
          this.isMainStreamCollapsed = savedCollapsed === 'true';
          console.log(`从localStorage恢复缩放状态: ${this.isMainStreamCollapsed}`);
        }
      } catch (error) {
        console.error('加载布局偏好失败:', error);
      }
    },
    
    // 从localStorage加载每页数量设置
    loadPageSizeFromStorage() {
      try {
        const savedLimit = localStorage.getItem('livePageSize');
        if (savedLimit) {
          const limit = parseInt(savedLimit, 10);
          // 验证是否为有效值
          const validLimits = [1, 6, 9, 12, 16, 20, 30];
          if (validLimits.includes(limit)) {
            this.limit = limit;
            console.log(`从localStorage恢复每页数量设置: ${limit}`);
          }
        }
        
        // 加载性能优化开关设置
        const savedOptimization = localStorage.getItem('livePerformanceOptimization');
        if (savedOptimization !== null) {
          this.performanceOptimization.enabled = savedOptimization === 'true';
          console.log(`性能优化开关: ${this.performanceOptimization.enabled ? '已启用' : '已禁用'}`);
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    },
    // 打印性能统计信息
    logPerformanceStats() {
      if (!this.performanceOptimization.enabled) {
        console.log('⚠️ 性能优化已禁用');
        return;
      }
      
      const stats = this.performanceOptimization.stats;
      console.log('📊 性能统计:');
      console.log(`  - 总流数量: ${stats.totalStreams}`);
      console.log(`  - 可见流数量: ${stats.visibleStreams}`);
      console.log(`  - 优化跳过流: ${stats.skippedStreams}`);
      console.log(`  - 性能提升: ${stats.totalStreams > 0 ? Math.round((stats.skippedStreams / stats.totalStreams) * 100) : 0}%`);
      console.log(`  - 更新次数: ${stats.updateCount}`);
      
      if (stats.skippedStreams > 0) {
        console.log(`✅ 性能优化生效：跳过了 ${stats.skippedStreams} 个不可见流的处理`);
      }
    },
    // 保存每页数量设置到localStorage
    savePageSizeToStorage(limit) {
      try {
        localStorage.setItem('livePageSize', limit.toString());
        console.log(`保存每页数量设置到localStorage: ${limit}`);
      } catch (error) {
        console.error('保存每页数量设置失败:', error);
      }
    },
    // 键盘快捷键处理
    handleKeyboardShortcut(event) {
      // 如果正在输入框中输入，不触发快捷键
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      
      const totalSize = this.getPlayVideoStreamSize();
      if (totalSize === 0) return;
      
      switch(event.key) {
        case 'ArrowLeft': // 左箭头 - 上一页
          event.preventDefault();
          this.leftPage();
          break;
        case 'ArrowRight': // 右箭头 - 下一页
          event.preventDefault();
          this.rightPage();
          break;
        case 'Home': // Home键 - 首页
          event.preventDefault();
          this.firstPage();
          break;
        case 'End': // End键 - 尾页
          event.preventDefault();
          this.lastPage();
          break;
      }
    },
    // 处理跳转到指定页
    handleJumpToPage() {
      const totalSize = this.getPlayVideoStreamSize();
      if (totalSize === 0) return;
      
      const totalPages = Math.ceil(totalSize / this.limit);
      let targetPage = this.jumpToPageInput;
      
      // 验证输入
      if (!targetPage || isNaN(targetPage)) {
        // 恢复当前页码显示
        this.jumpToPageInput = Math.floor(this.page / this.limit) + 1;
        return;
      }
      
      // 限制范围
      targetPage = Math.max(1, Math.min(targetPage, totalPages));
      this.jumpToPageInput = targetPage;
      
      // 计算page索引（从0开始）
      const newPage = (targetPage - 1) * this.limit;
      
      if (newPage !== this.page) {
        this.page = newPage;
        this.refreshCurrentPage();
        
      }
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
      
      // 清理离开用户的视频健康检查（通过display查找）
      if (e.peer && e.peer.display) {
        this.stopVideoHealthCheck(e.peer.display);
        console.log(`清理离开用户的视频健康检查: ${e.peer.display}`);
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
      // 清理之前的视频流跟踪状态
      this.previousVideoStreams.clear();
      // 清理所有视频健康检查
      this.cleanupAllVideoHealthChecks();
      
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
      this.room.myInfo.role = this.liverole;
      // 清理视频流跟踪状态
      this.previousVideoStreams.clear();
      // 清理所有视频健康检查
      this.cleanupAllVideoHealthChecks();
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
          // 清空跟踪状态
          this.previousVideoStreams.clear();
          return false;
        }
        
        let processedCount = 0;
        const changedStreams = []; // 只收集有变化的流
        
        // 获取当前页面可见的视频key列表（性能优化：只处理可见视频）
        const visibleKeys = this.getVisibleVideoKeys();
        
        // 第一步：找出新增和更新的流（只处理可见的流）
        vStream.forEach((value, key) => {
          // 性能优化：只处理当前页面可见的视频
          const isVisible = visibleKeys.includes(key);
          
          const previousStream = this.previousVideoStreams.get(key);
          
          // 如果是新流或者流ID发生变化，则标记需要检查
          if (!previousStream || previousStream.id !== value.id) {
            changedStreams.push({ key, value, isNew: !previousStream, isVisible });
          } else if (isVisible) {
            // 只对可见的视频进行额外检查（防止DOM重新渲染导致srcObject丢失）
            changedStreams.push({ key, value, isNew: false, needsCheck: true, isVisible });
          }
          // 更新跟踪状态
          this.previousVideoStreams.set(key, value);
        });
        
        // 第二步：找出被移除的流
        const removedKeys = [];
        this.previousVideoStreams.forEach((value, key) => {
          if (!vStream.has(key)) {
            removedKeys.push(key);
          }
        });
        
        // 清理被移除的流
        removedKeys.forEach(key => {
          this.previousVideoStreams.delete(key);
          this.stopVideoHealthCheck(key); // 停止健康检查
          this.addDebugLog(`流 ${key} 已被移除`, 'info');
        });
        
        // 如果有被移除的流，记录日志
        if (removedKeys.length > 0) {
          this.addDebugLog(`${removedKeys.length} 个流被移除`, 'info');
        }
        
        // 第三步：处理流（只处理可见的流，提升性能）
        let updatedCount = 0;
        let skippedCount = 0;
        let invisibleCount = 0;
        
        changedStreams.forEach(({ key, value, isNew, needsCheck, isVisible }) => {
          // 性能优化：跳过不可见的视频流处理
          if (!isVisible) {
            invisibleCount++;
            return;
          }
          
          const videoTracks = value.getVideoTracks();
          
          if (videoTracks.length > 0 && !videoTracks[0].muted) {
            setTimeout(() => {
              if (this.$refs[key] && this.$refs[key][0]) {
                const videoElement = this.$refs[key][0];
                
                // 检查是否真的需要更新
                const needsUpdate = !videoElement.srcObject || 
                                   videoElement.srcObject.id !== value.id;
                
                if (needsUpdate) {
                  videoElement.srcObject = value;
                  const action = isNew ? '新增' : '更新';
                  this.addDebugLog(`${action}视频流: ${key}`, 'success');
                  this.updateVideoState(key, `已${action}流`);
                  updatedCount++;
                  
                  // 启动视频流健康检查（仅对可见视频）
                  this.$nextTick(() => {
                    this.startVideoHealthCheck(key);
                  });
                  
                  // 移动端特殊处理
                  if (this.isMobile) {
                    this.$nextTick(() => {
                      this.handleMobileVideoStream(videoElement, key);
                    });
                  }
                } else {
                  // 流已正确设置，无需更新
                  if (!needsCheck) {
                    // 只在第一次发现无需更新时记录日志，避免日志过多
                    this.updateVideoState(key, '流已正确设置');
                  }
                  skippedCount++;
                }
              } else {
                if (isNew || !needsCheck) {
                  // 只对新流或确实变化的流报错
                  this.addDebugLog(`未找到视频元素: ${key}`, 'error');
                  this.updateVideoState(key, '元素不存在');
                }
              }
            }, 100);
          } else {
            if (isNew) {
              this.addDebugLog(`流 ${key} 被静音或无视频轨道`, 'warn');
              this.updateVideoState(key, '静音或无轨道');
            }
          }
        });
        
        // 延迟统计，等待所有异步操作完成
        setTimeout(() => {
          if (updatedCount > 0 || removedKeys.length > 0 || invisibleCount > 0) {
            this.addDebugLog(
              `处理完成: ${updatedCount} 个流已更新, ${skippedCount} 个流跳过, ${invisibleCount} 个不可见流跳过, ${removedKeys.length} 个流移除`, 
              'info'
            );
          }
          this.updateStreamInfo('实际更新流数量', updatedCount);
          this.updateStreamInfo('优化跳过流数量', invisibleCount);
          
          // 更新性能统计
          this.performanceOptimization.stats.lastUpdateTime = Date.now();
          this.performanceOptimization.stats.updateCount++;
          
          // 定期打印性能统计（每10次更新打印一次）
          if (this.performanceOptimization.stats.updateCount % 10 === 0) {
            this.logPerformanceStats();
          }
        }, 200);
        
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
    // 监听page变化，同步更新跳转输入框
    page: {
      handler(val) {
        this.jumpToPageInput = Math.floor(val / this.limit) + 1;
      },
      immediate: true
    },
    // 监听视频流数量变化，智能调整分页
    'playVideoStream.size': {
      handler(newSize, oldSize) {
        if (newSize === undefined || oldSize === undefined) return;
        
        const totalPages = Math.ceil(newSize / this.limit);
        const currentPage = Math.floor(this.page / this.limit) + 1;
        
        // 如果当前页超出范围，自动跳转到最后一页
        if (currentPage > totalPages && totalPages > 0) {
          console.log(`视频流减少，当前页(${currentPage})超出范围，跳转到最后一页(${totalPages})`);
          this.page = (totalPages - 1) * this.limit;
          this.$message.info({
            message: `当前页已超出范围，已自动跳转到第${totalPages}页`,
            duration: 2000
          });
        }
        
        // 如果当前页没有视频了（但不是最后一页），尝试保持在合理位置
        const endIndex = this.page + this.limit;
        if (newSize > 0 && this.page >= newSize && currentPage > 1) {
          console.log(`当前页无内容，调整到有效页面`);
          this.page = Math.max(0, (totalPages - 1) * this.limit);
        }
      }
    }
  },
};
</script>
<style lang="scss" scoped>
// 主内容区域布局
.live-main-content {
  width: 100%;
  margin: 5px 0 0;
  display: flex;
  gap: 10px;
  height: calc(100vh - 60px);
  overflow: hidden;
  padding: 0 8px;
  box-sizing: border-box;
  
  // 左右分栏模式
  &.layout-left-right {
    flex-direction: row;
    
    .main-streams-section {
      flex-shrink: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .sub-streams-section {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
  }
  
  // 上下布局模式
  &.layout-top-bottom {
    flex-direction: column;
    
    .main-streams-section {
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .sub-streams-section {
      overflow-y: auto;
      overflow-x: hidden;
    }
  }
  
  // 辅流优先模式
  &.layout-sub-first {
    flex-direction: column;
    
    .sub-streams-section {
      order: -1;
      flex: 1;
      overflow-y: auto;
    }
    
    .main-streams-section {
      flex-shrink: 0;
      overflow-x: auto;
      overflow-y: hidden;
      
      .videoStyle {
        display: flex !important;
        flex-direction: row !important;
        gap: 10px !important;
        padding: 10px !important;
        max-height: none !important;
        min-height: auto !important;
        
        .playvideo {
          flex-shrink: 0;
          width: 200px !important;
          height: 112px !important;
        }
      }
    }
  }
  
  // 移动端布局
  @media (max-width: 768px) {
    width: 100%;
    margin: 5px 0 0;
    gap: 10px;
    height: calc(100vh - 60px);
    flex-direction: column !important;
    padding: 0 10px;
    
    .main-streams-section,
    .sub-streams-section {
      width: 100% !important;
    }
    
    &.layout-left-right,
    &.layout-top-bottom {
      .main-streams-section {
        height: 35% !important;
        min-width: auto !important; // 移动端取消最小宽度限制
      }
      
      .sub-streams-section {
        height: 65% !important;
        flex: none !important;
      }
    }
    
    &.layout-sub-first {
      .sub-streams-section {
        height: 70% !important;
      }
      
      .main-streams-section {
        height: 30% !important;
        min-width: auto !important;
      }
    }
  }
  
  @media (max-width: 480px) {
    padding: 0 5px;
  }
}

// 主流区域样式
.main-streams-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  box-sizing: border-box;
  transition: width 0.3s ease;
  
  .video-container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
  
  .videoStyle {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    box-sizing: border-box;
    
    // 优化滚动条样式
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
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
  
  @media (max-width: 768px) {
    border-radius: 8px;
  }
}

// 辅流区域样式
.sub-streams-section {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  overflow: hidden;
  transition: width 0.3s ease;
  
  .sub-streams-wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  .sub-video-item {
    height: 100%;
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
  }
  
  // 优化滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }
  }
  
  @media (max-width: 768px) {
    border-radius: 8px;
    padding: 10px;
  }
}

// 分页栏样式
.pagination-bar {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  border-radius: 8px 8px 0 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  transition: all 0.3s ease;
  
  // 上部区域
  .pagination-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  
  // 下部区域
  .pagination-bottom {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  // 缩放按钮区域
  .zoom-button-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.3), rgba(100, 180, 255, 0.25));
    border: 1px solid rgba(64, 158, 255, 0.4);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    
    &:hover {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.5), rgba(100, 180, 255, 0.4));
      box-shadow: 0 4px 16px rgba(64, 158, 255, 0.5);
      transform: translateY(-2px);
      border-color: rgba(64, 158, 255, 0.6);
    }
    
    &:active {
      transform: translateY(0);
    }
    
    // 激活状态（缩小时）
    &.active {
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.35), rgba(255, 193, 7, 0.3));
      border-color: rgba(255, 152, 0, 0.5);
      
      &:hover {
        background: linear-gradient(135deg, rgba(255, 152, 0, 0.55), rgba(255, 193, 7, 0.5));
        box-shadow: 0 4px 16px rgba(255, 152, 0, 0.5);
      }
      
      .zoom-button {
        color: #FFA726;
      }
      
      .zoom-text {
        color: #FFE082;
      }
    }
    
    .zoom-button {
      font-size: 22px;
      color: #66B1FF;
      transition: all 0.2s ease;
    }
    
    .zoom-text {
      font-size: 13px;
      color: white;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
      letter-spacing: 0.5px;
    }
  }
  
  // 页码导航区域
  .page-navigation {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }
  
  // 导航图标
  .nav-icon {
    font-size: 20px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.8;
    padding: 4px;
    border-radius: 4px;
    
    &:hover {
      color: #66B1FF;
      transform: scale(1.15);
      opacity: 1;
      background: rgba(64, 158, 255, 0.2);
    }
    
    &:active {
      transform: scale(0.95);
    }
    
    &.nav-icon-main {
      font-size: 24px;
      opacity: 1;
    }
  }
  
  // 页码信息
  .page-info {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(64, 158, 255, 0.2);
    border-radius: 12px;
    
    span {
      color: white;
      font-size: 12px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      white-space: nowrap;
    }
  }
  
  // 标签文字
  .label-text {
    color: white;
    font-size: 12px;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
  }
  
  // 页码输入框
  .page-input {
    width: 45px;
    
    ::v-deep .el-input__inner {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(64, 158, 255, 0.3);
      color: #333;
      text-align: center;
      padding: 0 4px;
      font-weight: bold;
      font-size: 12px;
      height: 26px;
      line-height: 26px;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: rgba(64, 158, 255, 0.5);
      }
      
      &:focus {
        border-color: #409EFF;
        background: #fff;
      }
      
      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }
  
  // 每页数量选择器
  .page-size-select {
    width: 50%;
    
    ::v-deep .el-input__inner {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(64, 158, 255, 0.3);
      color: #333;
      font-weight: 500;
      font-size: 12px;
      height: 30px;
      line-height: 30px;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: rgba(64, 158, 255, 0.5);
      }
      
      &:focus {
        border-color: #409EFF;
      }
    }
  }
  
  // 缩小状态样式优化
  &.collapsed {
    padding: 8px 10px;
    gap: 6px;
    
    .pagination-top {
      flex-direction: column;
      gap: 6px;
    }
    
    .zoom-button-wrapper {
      justify-content: center;
      padding: 6px 10px;
    }
    
    .page-navigation {
      width: 100%;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .pagination-bottom {
      padding-top: 4px;
      margin-top: 2px;
    }
  }
  
  // 桌面端缩放按钮显示控制
  .desktop-only {
    display: flex;
  }
  
  @media (max-width: 768px) {
    padding: 8px 10px;
    
    // 移动端隐藏缩放按钮
    .zoom-button-wrapper.desktop-only {
      display: none !important;
    }
    
    // 移动端分页栏调整
    .pagination-top {
      justify-content: center;
    }
    
    .page-navigation {
      width: 100%;
    }
    
    .nav-icon {
      font-size: 18px;
      
      &.nav-icon-main {
        font-size: 22px;
      }
    }
    
    .page-size-select {
      width: 75px;
    }
  }
}

// 视频容器整体样式
.video-container {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.videoStyle {
  width: 100%;
  margin: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: max-content;
  grid-gap: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 0 0 10px 10px;
  align-content: start;
  box-sizing: border-box;
  transition: all 0.3s ease;
  
  // 缩小状态：一列显示
  &.collapsed {
    grid-template-columns: 1fr;
    grid-gap: 6px;
    padding: 8px 10px;
  }
  
  // 移动端优化
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important; // 移动端强制2列
    grid-gap: 8px;
    padding: 8px;
    border-radius: 0 0 8px 8px;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-gap: 6px;
    padding: 6px;
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
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  grid-gap: 10px;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-gap: 8px;
  }
  
  @media (max-width: 480px) {
    grid-gap: 6px;
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
  height: 36px;
  padding: 0 12px;
  background: linear-gradient(
    180deg, 
    rgba(0, 0, 0, 0.85) 0%, 
    rgba(0, 0, 0, 0.5) 70%, 
    transparent 100%
  );
  color: #fff;
  z-index: 20;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  border-bottom: 1px solid rgba(64, 158, 255, 0.4);
  
  span {
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 36px;
    display: block;
    color: #66B1FF;
  }
  
  @media (max-width: 768px) {
    height: 30px;
    font-size: 12px;
    padding: 0 10px;
    
    span {
      line-height: 30px;
    }
  }
}

.sub-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  
  // 尝试隐藏播放/暂停按钮（部分浏览器支持）
  &::-webkit-media-controls-play-button {
    display: none !important;
  }
  
  &::-webkit-media-controls-start-playback-button {
    display: none !important;
  }
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
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; // 16:9 宽高比
  
  // 桌面端悬停效果
  @media (min-width: 769px) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-color: rgba(64, 158, 255, 0.5);
      z-index: 5;
    }
  }
  
  // 移动端无悬停效果
  @media (max-width: 768px) {
    border-radius: 6px;
  }
  
  // 所有内容都要绝对定位
  > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
    
    // 尝试隐藏播放/暂停按钮（部分浏览器支持）
    &::-webkit-media-controls-play-button {
      display: none !important;
    }
    
    &::-webkit-media-controls-start-playback-button {
      display: none !important;
    }
  }
  
  // videoHeader需要绝对定位
  .videoHeader {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
  }
}

.videoHeader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 26px;
  padding: 0 8px;
  background: linear-gradient(
    180deg, 
    rgba(0, 0, 0, 0.8) 0%, 
    rgba(0, 0, 0, 0.5) 70%, 
    transparent 100%
  );
  color: #fff;
  z-index: 20;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  border-radius: 8px 8px 0 0;
  
  span {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 26px;
    display: block;
  }
  
  @media (max-width: 768px) {
    height: 24px;
    font-size: 11px;
    padding: 0 6px;
    
    span {
      line-height: 24px;
    }
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

// 添加平滑滚动
.videoStyle,
.sub-streams-section {
  scroll-behavior: smooth;
}

// 响应式优化
@media (max-width: 1200px) {
  .live-main-content.layout-left-right {
    .main-streams-section {
      width: 40% !important;
    }
    .sub-streams-section {
      width: 60% !important;
    }
  }
}

@media (max-width: 900px) {
  .live-main-content.layout-left-right {
    flex-direction: column !important;
    
    .main-streams-section,
    .sub-streams-section {
      width: 100% !important;
      height: 50% !important;
    }
  }
}
</style>

