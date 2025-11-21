import events from 'events'
import { MixStream } from './mixstream'
import { ScreenShare } from './screenshare'
import { PcStats } from './pcstats'
import { Bandwidth } from './bandWidth'
import { Record } from './record'
import { Message } from 'element-ui';
class Room extends events {
  status = {}

  constructor() {
    super()
    this.players = new Map() // key is display, 播放的音频流
    this.internals = {
      // Key is tid, value is object {resolve, reject, response}.
      msgs: new Map(),
    }
    this.users = '';
    this.pcAudioPacketsLoss=0.00;
    this.pcVideoPacketsLoss=0.00;
    this.subAudioPacketsLoss=0.00;
    this.subVideoPacketsLoss=0.00;
    this.pullAudioPackLost = 0.00;
    this.pullVideoPackLost = 0.00;
    this.bandwidthTimer = null;
    this.lastResult = new Map();
    this.lastSubResult = new Map();
    this.lastPullResult = new Map();
    this.pushBitrate = 0;
    this.pullBitrate = 0;
    this.AudioContext = window.AudioContext || window.webkitAudioContext
    this.audioContext = null // can be reuse, so put it here
    this.reset()
    this.screenshare = new ScreenShare()
    this.videoStreamTarck = null
    // 心跳定时器
    this.pongTimer = null
    // 最大连接次数
    this.connectMax = 5
    this.connectIndex = 0
    // 离开状态
    this.leaveStatus = null
    this.buffer=[];    //存储录制数据
    this.mediaRecorder = null;    //对象
    this.auxiliaryStream = new MediaStream() //被储存的辅流
    this.mixStreams = new MediaStream() //融合完的流
    // 作用于触发对象的记录
    this.state = {
      audio: false,
    }
    // 记录动作
    this.action = null
    // 是否对流进行限制 默认对 摄像头 视频流限速
    this.speedLimit = true
    // 锁定重连
    this.lockReconnect = true
    this.reconnectTimer = null
    this.setTime = true //如果settime为true，
    this.record = null;
    this.groupUsers= [];
    this.iTime = null; 
  }

  get getAction() {
    return this.action
  }

  set updateLeaveStatus(value) {
    this.leaveStatus = value
  }

  resetMixStream() {
    if (this.mixStream) {
      this.mixStream.reset()

      this.mixStream.removeListener(
        'local-audio-stream-updated', // 本地音频变更
        this.localAudioStreamUpdated
      )
      this.mixStream.removeListener(
        'local-video-stream-updated', // 本地视频变更
        this.localVideoStreamUpdated
      )
      this.mixStream.removeListener(
        'local-video-substream-updated', // 本地视频变更
        this.subStreamUpdated
      )
      this.mixStream.removeListener(
        'play-audio-stream-updated', // 播放音频变更
        this.playAudioStreamUpdated
      )
      this.mixStream.removeListener(
        'play-video-stream-updated', // 播放视频变更
        this.playVideoStreamUpdated
      )
      this.mixStream.removeListener(
        'play-video-substream-updated', // 播放视频变更
        this.playVideosubStreamUpdated
      )
    }
    this.mixStream = null
  }

  newMixStream() {
    let that = this
    if (!this.mixStream) {
      this.mixStream = new MixStream(this.audioContext)
      this.onAudioInputVolumeUpdated()
      this.localAudioStreamUpdated = this.localAudioStreamUpdated.bind(this)
      this.localVideoStreamUpdated = this.localVideoStreamUpdated.bind(this)
      this.playAudioStreamUpdated = this.playAudioStreamUpdated.bind(this)
      this.playVideoStreamUpdated = this.playVideoStreamUpdated.bind(this)
      this.playVideosubStreamUpdated = this.playVideosubStreamUpdated.bind(this)
      this.subStreamUpdated = this.subStreamUpdated.bind(this)
      this.mixStream.addListener(
        'local-audio-stream-updated', // 本地音频变更
        this.localAudioStreamUpdated
      )
      this.mixStream.addListener(
        'local-video-stream-updated', // 本地视频变更
        this.localVideoStreamUpdated
      )
      this.mixStream.addListener(
        'local-video-substream-updated', // 本地视频变更
        that.subStreamUpdated
      )
      this.mixStream.addListener(
        'play-audio-stream-updated', // 播放音频变更
        this.playAudioStreamUpdated
      )
      this.mixStream.addListener(
        'play-video-stream-updated', // 播放视频变更
        this.playVideoStreamUpdated
      )
      this.mixStream.addListener(
        'play-video-substream-updated', // 播放视频变更
        this.playVideosubStreamUpdated
      )

      this.onStopSpeakingSelf = this.onStopSpeakingSelf.bind(this)
      this.onStartSpeakingSelf = this.onStartSpeakingSelf.bind(this)

      this.mixStream.localAudioStream.addListener('start-speaking', this.onStartSpeakingSelf)
      this.mixStream.localAudioStream.addListener('stop-speaking', this.onStopSpeakingSelf)
    }
  }

  onStopSpeaking(isSender, caller) {
    this.emit('stop-speaking', caller.username, caller.display)
    !isSender && (caller.isSpeaking = false)
  }
  onStartSpeaking(isSender, caller) {
    this.emit('start-speaking', caller.username, caller.display)
    !isSender && (caller.isSpeaking = true)
  }
  onStopSpeakingSelf() {
    this.emit('stop-speaking', this.myInfo.username, this.myInfo.display)
    this.myInfo.isSpeaking = false
  }
  onStartSpeakingSelf() {
    this.emit('start-speaking', this.myInfo.username, this.myInfo.display)
    this.myInfo.isSpeaking = true
  }
  onSumRsult(isSender, caller) {
    if (!isSender) {
      this.sum.bitrateRecv = 0
      this.players.forEach((_player) => {
        this.sum.bitrateRecv += _player.pcStats.sum.bitrateRecv
      })
    }
  }

  resetPcStats(pcStats) {
    pcStats.removeListener('stop-speaking', this.onStopSpeaking)
  }

  newPcStats(pc, isSender, caller) {
    var pcStats = new PcStats(pc, isSender, caller)
    this.onStopSpeaking = this.onStopSpeaking.bind(this)
    this.onStartSpeaking = this.onStartSpeaking.bind(this)
    this.onSumRsult = this.onSumRsult.bind(this)

    pcStats.addListener('stop-speaking', this.onStopSpeaking)
    pcStats.addListener('start-speaking', this.onStartSpeaking)
    pcStats.addListener('sum-result', this.onSumRsult)
    return pcStats
  }

  resetWsClient() {
    if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer)
    this.keepaliveTimer = null
    this.wsClient = {
      ws: null,
      url: '',
      status: 'disconnected',
      keepaliveTimer: null,
      wsBuffer: '',
    }
    this.internals.msgs.clear()
  }

  resetMyInfo() {
    this.myInfo = {
      display: '',
      subDisplay:null,
      recordDisplay:null,
      tokenId: '',
      role: 'user',
      room: '',
      username: '',
      isSpeaking: false,
    }

    this.hasAudioInput = false
    this.hasWebcam = false
  }

  resetRoomInfo() {
    this.roominfo = {
      self: null,
      participants: [],
      isJoined: false,
      room: '',
      nextPresenterDisplay: '',
    }
  }

  resetPublish() {
    this.publish = {
      remote_sdp: '',
      remote_subsdp: '',
      remote_recordsdp: '',
      offer: null,
      suboffer: null,
      recordoffer: null,
      recordpc: null,
      subpc:null,
      pc: null,
      stream: null, // 可以显示本地的
      publish_state: 'unpublished',
      isLocalMuted: false, // 本地静音
      isLocalVideoMuted: false, // 本地关闭摄像头
      isAllowPushVideo: false, // 信令控制，是否可以推视频流，现在只有主持人可以推
      pcStats: null,
      isSharing: false,
      subDisplay:null
    }
  }

  resetPlayers() {
    this.players.clear()
    this.sum = {
      bitrateRecv: 0,
    }
  }

  resetDeviceInfo() {
    if (!this.deviceInfo) return
    this.deviceInfo.removeListener('audio-input-updated', this.onAudioInputUpdated)
    this.deviceInfo.removeListener('video-input-updated', this.onVideoInputUpdated)
    this.deviceInfo.removeListener('microphone-volume-updated', this.onAudioInputVolumeUpdated)
    this.deviceInfo = null
  }

  // 重置所有
  reset() {
    this.resetPlayers() // 清除players
    this.resetWsClient() // 重置websocket
    this.resetRoomInfo() // 重置roomInfo，信令相关
    this.resetPublish() // 重置推流信息
    this.resetMixStream() // 重置本地流信息
    this.resetDeviceInfo() // deviceInfo
    this.resetMyInfo() // 房间号，用户信息，上层输入的
  }

  //计算带宽，join之后开始调用，leave之后将定时器清除停止调用
  async bandwidthComputing(){
    this.bandwidth = new Bandwidth()
    this.bandwidthTimer = setInterval(async () => {
      let bandwidth = 0;
      var pullbandwidth = 0;
      var pullVideoPackLost = 0;
      var pullAudioPackLost = 0;
      var users = ''
      let pc = this.publish?this.publish.pc:null;
      let subpc = this.publish?this.publish.subpc:null;
      let recordpc = this.publish?this.publish.recordpc:null;
      if(pc){
        bandwidth+=await this.bandwidth.bandwidthComputingByPush(pc)
        this.pcAudioPacketsLoss = await this.bandwidth.getPcLossPackRatioByAudio(pc)
        this.pcVideoPacketsLoss = await this.bandwidth.getPcLossPackRatioByVideo(pc)
      }
      if(subpc){
        bandwidth+=await this.bandwidth.bandwidthComputingBySubPush(subpc)
        this.subAudioPacketsLoss = await this.bandwidth.getSubPcLossPackRatioByAudio(subpc)
        this.subVideoPacketsLoss = await this.bandwidth.getSubPcLossPackRatioByVideo(subpc)
      }
      if(recordpc){
        await this.bandwidth.bandwidthComputingByRecord(recordpc)
      }
      //上行计算主流加辅流
      this.pushBitrate = bandwidth;
      if (this.players.size) {
        //下行遍历players将所有下行相加
      this.players.forEach(async (player)=>{
          let bands = await this.bandwidth.bandwidthComputingByPull(player.pc,player.display)
          let user = await this.bandwidth.getSpeakUser(player.pc, player.username)
          let pullVideoPackLoss = await this.bandwidth.getPullLossPackRatioByVideo(player.pc,player.display)
          let pullAudioPackLoss = await this.bandwidth.getPullLossPackRatioByAudio(player.pc,player.display)
          user&&(users+=user)
          pullbandwidth+=bands
          pullAudioPackLoss&&(pullAudioPackLost+=Number(pullAudioPackLoss))
          pullVideoPackLoss&&(pullVideoPackLost+=Number(pullVideoPackLoss))
        })
        setTimeout(() => {
          this.pullBitrate = pullbandwidth;
          this.users = users
          this.pullAudioPackLost = (pullAudioPackLost/this.players.size).toFixed(2)
          this.pullVideoPackLost = (pullVideoPackLost/this.players.size).toFixed(2)
          // console.log(pullAudioPackLost/this.players.size, pullVideoPackLost/this.players.size,'---');
        }, 50);
      }
    }, 1000);
  }




  // 本地音频输入设备变更事件，deviceinfo回调
  async onAudioInputUpdated() {
    // 从硬件获取音频
    if (!this.publish.isLocalMuted && this.roominfo.self && this.roominfo.self.publishing && this.publish.pc) {
      var constraints = this.deviceInfo.genAudioConstraints()
      if (constraints.audio) {
        var stream = await navigator.mediaDevices.getUserMedia(constraints)
        this.mixStream.localAddTrack(stream.getAudioTracks()[0], false)
      }
    }
  }

  // deviceInfo 麦克风音量变大
  onAudioInputVolumeUpdated() {
    if (this.mixStream) {
      this.mixStream.setVolume(this.deviceInfo.microphone.volume)
    }
  }

  // 本地视频输入设备变更事件，deviceinfo回调
  async onVideoInputUpdated() {
    console.log('地视频输入设备变更事件，deviceinfo回调');
    // 从硬件获取音频
    if (!this.publish.isLocalVideoMuted && this.roominfo.self && this.roominfo.self.publishing && this.publish.pc) {
      var constraints = this.deviceInfo.genAudioConstraints()
      if (constraints.video) {
        var stream = await navigator.mediaDevices.getUserMedia(constraints)
        this.mixStream.localAddTrack(stream.getVideoTracks()[0], false)

        this.mixStream.playAddTrack(stream.getVideoTracks()[0],this.myInfo.display)
      }
    }
  }
  mixRecordAudioStream(pcTrack,subTrack){
    let pcStream = new MediaStream()
    let subStream = new MediaStream()
    pcTrack&&pcStream.addTrack(pcTrack)
    subTrack&&subStream.addTrack(subTrack)
    let audioContext = new AudioContext();//创建音频上下文
    let mixedOutput = audioContext.createMediaStreamDestination();//创建一个输出媒体流节点
    if (pcTrack) {
      let localMicrophoneStreamNode = audioContext.createMediaStreamSource(pcStream);//创建节点
      localMicrophoneStreamNode.connect(mixedOutput);//把麦克风节点和系统音节点添加到输出媒体流
    }
    if(subTrack){
      let audioStreamNode = audioContext.createMediaStreamSource(subStream);//创建系统音频节点
      audioStreamNode.connect(mixedOutput);//把麦克风节点和系统音节点添加到输出媒体流
    }
    // this.players.forEach(player =>{
    //   let newStream = new MediaStream()
    //   player.pc.getReceivers()[0].track&&newStream.addTrack(player.pc.getReceivers()[0].track)
    //   player.pc.getReceivers()[0].track&&audioContext.createMediaStreamSource(newStream).connect(mixedOutput)
    //   console.log(player,'player');
    // })
    return mixedOutput.stream.getTracks()[0]
  }
  async publishRecordSdp(){
    console.log(this.myInfo.role,'this.room.myInfo.role');
    
    if (this.myInfo.role=='user') {
      return false;
    }
    clearTimeout(this.iTime);
    this.iTime = setTimeout(async () =>{
      //是主持人再来调用这个接口,根据个人需求判断
      // if(this.myInfo.role!='admin'){
      //   return false;
      // }
      let pcSenders =await this.publish.pc?this.publish.pc.getSenders():null;
      let subpcSenders =await this.publish.subpc?this.publish.subpc.getSenders():null;
      let hasPcVideo = !!pcSenders&&pcSenders[1]?.track.readyState==="live";
      let hasSubpcVideo = !!subpcSenders&&subpcSenders[1].track?.readyState==="live";
      let hasPcAudio = !!pcSenders&&pcSenders[0]?.track.readyState==="live";
      let hasSubpcAudio = !!subpcSenders&&subpcSenders[0].track?.readyState==="live";
      let videoDisplay =''
      let mainDisplay = ''
      let subDisplay = ''
      if (pcSenders&&subpcSenders) {
        console.log('主辅流都存在时');
        mainDisplay = this.myInfo.subDisplay
        //当没主音频有辅音频时推辅音频，否则推主音频
        if (!hasPcAudio&&hasSubpcAudio) {
          subDisplay = this.myInfo.subDisplay
        }else {
          subDisplay = this.myInfo.display
        }
      }else if (!pcSenders&&subpcSenders) {
        console.log('当只存在共享屏幕通道时');
        mainDisplay = this.myInfo.subDisplay
      }else if (pcSenders&&!subpcSenders) {
        console.log('当只存在摄像头通道时');
        mainDisplay = this.myInfo.display
      }else if (!pcSenders&&!subpcSenders) {
        console.log('当两个通道都不存在时，关闭录制');
        mainDisplay=''
        subDisplay=''
        return false;
      }
      //当两路视频流都停止时videoRecord = false
      if(!hasPcVideo&&!hasSubpcVideo){
        mainDisplay=''
      }
      this.startRecording(mainDisplay,subDisplay);
    },150)

 }
  // 开始录像
  startRecording(mainDisplay,subDisplay) {
    return this.send({
      action: 'startRecord',
      room: this.myInfo.room,
      mainDisplay: mainDisplay,
      subDisplay: subDisplay
    })
  }
  // 查找用户
  searchUsers(e) {
    this.groupUsers= [];
    return this.send({
      action: 'getGroupParticipants',
      room: this.myInfo.room,
      groupId:e
    })
  }
  // 本地音频更新事件，更新到发送远端的peer_connection, mixStream回调
  localAudioStreamUpdated(aStream) {
    if (!this.publish.pc) return

    var track = null
    aStream && aStream.getAudioTracks().length > 0 && (track = aStream.getAudioTracks()[0])
    var senders = this.publish.pc.getSenders()
    var sender = senders.find((sender) => {
      return sender.track && sender.track.kind === 'audio'
    })

    if (!sender && senders.length >= 1) {
      sender = senders[0]
    }
    if (sender) {
      sender.track && sender.track.stop()
      sender.replaceTrack(track)
    }
    if (track !== null) this.emit('device-change', 'audio-input', track.label)
  }

  // 本地视频更新事件，更新到发送远端的peer_connection, mixStream回调
  localVideoStreamUpdated(vStream) {
    if (!this.publish.pc) return

    let track = null
    vStream.getVideoTracks().length > 0 && (track = vStream.getVideoTracks()[0])
    var senders = this.publish.pc.getSenders()
    var sender = senders.find((sender) => {
      return sender.track && sender.track.kind === 'video'
    })
    if (!sender && senders.length >= 2) {
      sender = senders[1]
    }
    if (sender) {
      sender.track && sender.track.stop()
      sender.replaceTrack(track)
    }
    if (track !== null) this.emit('device-change', 'video-input', track.label)
  }

  // 本地音频渲染更新事件，通知上层渲染, mixStream回调
  playAudioStreamUpdated(aStream) {
    this.emit('play-audio-stream-updated', aStream)
  }
  // 本地视频渲染更新事件，通知上层渲染, mixStream回调
  playVideoStreamUpdated(vStream) {
    // console.log('视频流更新',vStream);

    this.emit('play-video-stream-updated', vStream)
  }
  playVideosubStreamUpdated(vStream) {
    this.emit('play-video-substream-updated', vStream)
  }
  // 设置是否能推送视频, 如果现在正在推流，则直接采集摄像头?还是说交给上层来弄
  // 比如某人在推音频流，然后这时候他变成主持人
  setAllowPushVideo(isAllow) {
    this.publish.isAllowPushVideo = isAllow
    if (isAllow && this.publish.pc) {
      if (this.mixStream.localVideoStream.getVideoTracks().length === 0) {
        this.emit('allow-to-push-video') // 通知上层是否要推流
      }
    }
  }


  // 获取桌面的流
  async startCaptureScreen(enableAudio) {
    return this.screenshare.startCaptureScreen(enableAudio)
  }

  //重新连接  3000-5000之间，设置延迟避免请求过多
  reconnect() {
    //设置lockReconnect变量避免重复连接
    if (this.lockReconnect) return
    this.lockReconnect = true
    this.reconnectTimer && clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(async () => {
      await this.$store.dispatch('Connect')
      this.lockReconnect = false
    }, 1000)
  }
  /**
   * 加入房间
   */
  async connect(url, room, role, display, tokenId, deviceInfo, username) {
    return new Promise((resolve, reject) => {
      if (this.wsClient.ws !== null) {
        reject(new Error('already connected, disconnect it first!'))
      }

      this.wsClient.url = url
      this.deviceInfo = deviceInfo
      this.onAudioInputUpdated = this.onAudioInputUpdated.bind(this)
      this.onVideoInputUpdated = this.onVideoInputUpdated.bind(this)
      this.onAudioInputVolumeUpdated = this.onAudioInputVolumeUpdated.bind(this)
      this.deviceInfo.addListener('audio-input-updated', this.onAudioInputUpdated)
      this.deviceInfo.addListener('video-input-updated', this.onVideoInputUpdated)
      this.deviceInfo.addListener('microphone-volume-updated', this.onAudioInputVolumeUpdated)
      this.myInfo.room = room
      this.myInfo.tokenId = tokenId
      username && (this.myInfo.username = username)
      // 创建ws
      this.createWebSocket(display)
        .then(() => {
          resolve()
        })
        .catch(() => {
          reject()
        })
    })
  }

  /**
   * 创建ws
   */
  createWebSocket(display) {
    this.myInfo.display = display
    return new Promise((resolve, reject) => {
      const that = this
      this.wsClient.ws = new WebSocket(this.wsClient.url)
      // 连接回调
      this.wsClient.ws.onopen = (event) => {
        if (this.wsClient.ws.readyState === 1) {
          // that.join()
          that.status = 'connected'
        }
        // 断开回调
        this.wsClient.ws.onclose = (e) => {
          if (!this.leaveStatus) {
            this.emit('ws-close')
          }
          // this.resetWsClient()
        }
        // 消息回调
        this.wsClient.ws.onmessage = function (event) {
          that.wsClient.wsBuffer = that.wsClient.wsBuffer.concat(event.data)
          while (1) {
            if (that.wsClient.wsBuffer.length <= 6) {
              return
            }
            const len = parseInt(that.wsClient.wsBuffer.substring(0, 6))
            if (len <= 6) {
              that.disconnect()
              return
            }
            if (isNaN(len)) {
              return
            }
            if (len > that.wsClient.wsBuffer.length) {
              return
            }
            const m = that.wsClient.wsBuffer.substring(6, len)
            that.wsClient.wsBuffer = that.wsClient.wsBuffer.substring(len)
            if (m) {
              try {
                var r = JSON.parse(m)
              } catch (e) {
                console.log('e', e, 'm', m)
              }
              var promise = that.internals.msgs.get(r.tid)
              if (promise) {
                that.onresponse(r.msg) // 应答
                promise.resolve()
                clearTimeout(promise.responseTimer)
                that.internals.msgs.delete(r.tid)
              } else {
                that.onmessage(r.msg) // 通知事件
              }
            }
          }
        }
        resolve(event)
      }

      // 连接失败回调
      this.wsClient.ws.onerror = (event) => {
        that.status = 'disconnected'
        that.emit('websocket-connect-failed')
        this.disconnect()
        reject(event)
      }
    })
  }

  disconnect() {
    // this.record.stopCapture()
    // this.record.save()
    clearInterval(this.bandwidthTimer)
    this.bandwidthTimer = null;
    if (this.publish.pc) {
      this.publish.pc.getSenders().forEach(sender => {
          sender.track&&sender.track.stop()
      })
      this.stopPublish()
      this.publish.publish_state = 'unpublishing'
      this.unPublishNotify()
      this.emit('muted')
    }
    if (this.publish.subpc) {
      //将通道关掉共享的标签才会自己不见
      this.publish.subpc.getSenders().forEach(sender => {
        sender.track&&sender.track.stop()
    })
      this.publish.subpc && this.publish.subpc.close()
      this.publish.subpc = null
      this.myInfo.subDisplay = ''
      this.mixStream.localSubRemoveStream() //本地流删除视频辅流
      this.unPublishsubNotify()
    }

    this.players.forEach((player) => {
      this.stopPlay(player)
    })

    this.wsClient.ws && this.wsClient.ws.close()

    this.internals.msgs.forEach((promise) => {
      clearTimeout(promise.responseTimer)
      promise.reject('服务器连接已断开')
    })
    this.reset()
  }

  // 发送请求
  send(message) {
    const that = this
    return new Promise(function (resolve, reject) {
      var r = {
        tid: Number(parseInt(new Date().getTime() * Math.random() * 100))
          .toString(16)
          .substr(0, 7),
        msg: message,
      }
      var responseTimer = setTimeout(() => {
        that.emit('response-timeout', message.action)
      }, 10000)

      that.internals.msgs.set(r.tid, {
        resolve: resolve,
        reject: reject,
        responseTimer: responseTimer,
      })

      const encoded = JSON.stringify(r)
      const length = (Array(6).join('0') + (encoded.length + 6)).slice(-6)
      that.wsClient.ws.send(length + encoded)
    })
  }

  // 请求响应处理函数(加入房间、推流SDP协商、推流通知、拉流SDP协商、控制接口)
  onresponse(msg) {
    const that = this
    if (msg.code !== 200200 && msg.code) {
      console.log(msg,'===这是code !== 200200的msg===');
      
      this.emit('errormsg', msg)
      if (msg.code === 200205) {
        this.disconnect()
      }
      return
    }
    // 加入房间返回，更新peer
    if (msg.action === 'join') {
      this.record = new Record()
      this.bandwidthComputing()
      this.sendKeepalive()
      this.roominfo.isJoined = true
      this.roominfo.self = msg.self
      this.roominfo.room = msg.room
      this.myInfo.username = msg.self.username
      this.roominfo.participants = msg.participants
      // 如果当前直播间里面没有讲师，本身我就是讲师
      // if (this.roominfo.self.role === 'presenter') {
      //   this.setAllowPushVideo(true)
      // }
      // 检测参与人
      this.emit('check-participants', msg)
      this.setAllowPushVideo(true)
      this.playallsdp() // 加入房间，默认拉取所有流
    }else if(msg.action === 'getGroupParticipants'){
      this.groupUsers = msg.peer
    }else if(msg.action === 'publishRecordSdp'){
      this.publish.remote_recordsdp = msg.sdp
    } else if (msg.action === 'publishsdp') {
      // 推流SDP协商返回
      if (msg.sdp.length === 0) {
        return
      }
      if (msg.subDisplay.length) {
        //如果是辅流
        this.publish.remote_subsdp = msg.sdp
        this.publish.publish_state = 'publishsdped'
        this.startPublish('sub')
      }else{
        this.publish.remote_sdp = msg.sdp
        this.publish.publish_state = 'publishsdped'
        this.startPublish('main')
      }
    } else if (msg.action === 'publish') {
      // 推流通知返回,真正完成推流
      this.publish.publish_state = 'published'
      this.roominfo.self = msg.self
      this.publishRecordSdp() 
      this.roomUpdateParticipants(msg.self, 'msg.action=publish')
      
      this.playallsdp()
      // 推流拉流，更新底部按钮
      this.emit('check-participants')
    }else if (msg.action === 'publishsub') {
      // 推流通知返回,真正完成推流
      this.publish.publish_state = 'published'
      this.roominfo.self.subDisplay = msg.subDisplay
        this.publishRecordSdp()
      this.roomUpdateParticipants(this.roominfo.self, 'msg.action=publish')
      // 推流拉流，更新底部按钮
      this.emit('check-participants')
    } else if (msg.action === 'unpublish') {
      this.publish.publish_state = 'unpublished'
      this.mixStream.removeSubStream(msg.display)
      this.handleUnpublish(msg.self)
      this.roomUpdateParticipants(msg.self)
        this.publishRecordSdp()
    }
    else if (msg.action === 'unpublishsub') {
      //主持人关掉了辅流，将辅流从map中去除
      let findIndex = this.roominfo.participants.findIndex((item) => item.display === msg.display)
      if (findIndex) {
        this.roominfo.participants[findIndex].subDisplay = ''
      }
        setTimeout(() => {
          this.publishRecordSdp()
        }, 1000);
      // if (this.publish.subpc) {
      //   this.publish.subpc.getSenders()&&this.publish.subpc.getSenders()[0].track.stop()
      //   this.publish.subpc.getSenders()&&this.publish.subpc.getSenders()[1].track.stop()
      // }
    } else if (msg.action === 'startshare') {
    } else if (msg.action === 'stopshare') {
    } else if (msg.action === 'unmuteall') {
      console.log('msg action= unmuteall')
      // 静音状态
      this.emit('unmuteall-status', false)
    } else if (msg.action === 'muteall') {
      console.log('msg action= muteall')
      // 静音状态
      this.emit('unmuteall-status', true)
    } else if (msg.action === 'playsdp') {
      // 拉流sdp协商后，开始播放
      const player = this.players.get(msg.action_display)
      // console.log('player==', player)
      if (player&&msg.sdp) {
        player.remote_sdp = msg.sdp
          this.startPlay(player)
      }
      // 主持端的display存储到拉取端
      this.emit('save-peer-display', msg.action_display)
      // 推流拉流，更新底部按钮
      // this.emit('self-publish', msg)
    } else if (msg.action === 'shutdown') {
      this.disconnect()
    } else if (msg.action === 'keepalive') {
      this.keepaliveTimer = setTimeout(() => {
        if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer)
        this.keepaliveTimer = null
        if (this.wsClient.ws.readyState === 1) {
          this.sendKeepalive()
        } else {
          this.reconnect()
        }
      }, 5000)
    } else if (msg.action === 'getRoomInfo') {
      this.roominfo.room = msg.room
    } else if (msg.action === 'startRecord') {
      that.emit('startRecordSuccess')
      this.roominfo.room = msg.room
      this.roominfo.room.isRecording = true
    } else if (msg.action === 'stopRecord') {
      // that.emit('stopRecordSuccess')
      this.roominfo.room.isRecording = false
    } else if (msg.action === 'localstatenotify') {
      this.roomUpdateParticipants(msg.peer, 'action = localstatenotify')
      this.updateSelf(msg.peer)
    } else if (msg.action === 'unmute') {
      that.emit('unmute-update')
    }
  }

  // 服务器主动发起 ***通知事件*****
  onmessage(msg) {
    msg.self && (this.roominfo.self = msg.self)
    msg.participants && (this.roominfo.participants = msg.participants)

    if (msg.event === 'publish') {
      // 对端状态 self+peer, 更新Participants
      this.roomUpdateParticipants(msg.peer, 'publish')
      // this.emit('update-user-peer', msg.peer)
       // 后续看下，如果性能原因，优化接口，下发的时候不带全量，带增量
      this.emit('check-participants')
      setTimeout(() => {
        this.playallsdp()
      }, 100);
    }else if (msg.event === 'publishsub') {
      // 对端状态 self+peer, 更新Participants
      this.roomUpdateParticipants(msg.peer, 'publishsub')
      // this.emit('update-user-peer', msg.peer)
      setTimeout(e=>{
        this.playallsdp()
        this.emit('check-participants')
      },500)
      setTimeout(() => {
        console.log('有人推辅流');
        if(this.players.get(msg.peer.subDisplay)&&this.players.get(msg.peer.subDisplay).pc.getReceivers()[1].track&&this.publish.recordpc){
          let recordSenders = this.publish.recordpc.getSenders();
          console.log(recordSenders[1].track,recordSenders[1],this.players.get(msg.peer.subDisplay).pc.getReceivers()[1].track);
          recordSenders[1].track&&recordSenders[1].replaceTrack(this.players.get(msg.peer.subDisplay).pc.getReceivers()[1].track)
        }
      }, 2000);
    } else if (msg.event === 'unpublish') {
      // 对端状态 self+peer, 更新Participants
      this.mixStream.removeSubStream(msg.peer.display)


      this.roomRemoveParticipants(msg.peer, 'unpublish')
      this.playallsdp() // 后续看下，如果性能原因，优化接口，下发的时候不带全量，带增量
      this.emit('peer-unpublish', msg.peer.username, msg.peer.display)
    }else if (msg.event === 'unpublishsub') {
      // 对端状态 self+peer, 更新Participants
      if(msg.peer.display !=this.roominfo.self.display){
        this.mixStream.removeSubStream(msg.subDisplay)
        this.emit('peer-unpublish', msg.peer.username, msg.peer.display)
      }
    } else if (msg.event === 'join') {
      // 房间状态 self+peer+participants, 全量，房间用户排序状态以服务器为准
      // this.emit('peer-joined', msg.peer.username, msg.peer.display)
      this.roominfo.participants.push(msg.peer)
      this.emit('peer-joined', msg)
    } else if (msg.event === 'leave') {
      // 对端状态 self+peer, 更新Participants
       //主持人关掉了辅流，将辅流从map中去除
      this.mixStream.removeSubStream(msg.peer.display)
      this.roomRemoveParticipants(msg.peer)
      this.emit('peer-leave', msg, msg.peer.display)
      this.emit('main-leave', msg)
      this.playallsdp() // 后续看下，如果性能原因，优化接口，下发的时候不带全量，带增量
    } else if (msg.event === 'mute') {
      // if (this.roominfo.self.videomuted === false) return // 当前主讲老师不能 被静音
      this.publish.isLocalMuted = false
      // this.roominfo.self.audiomuted = true
      this.publish.publish_state = 'unpublishing'
      this.mutelocal('audio')
    } else if (msg.event === 'unmute') {
      // if (this.publish.publish_state !== 'unpublished') return //如果还在协商，忽略消息
      this.publish.publish_state = 'publishsdping'
      this.publish.isLocalMuted = true
      // this.roominfo.self.audiomuted = false
      this.unmutelocal('audio')
      this.emit('unmuted', msg.action_display)
    } else if (msg.event === 'localstatenotify') {
      this.roomUpdateParticipants(msg.peer, 'event = localstatenotify')
      this.playallsdp()
      this.emit('peer-local-state-updated', msg.peer)
    }  else if (msg.event === 'stopPublish') {
      this.stopPublish()
      this.publish.publish_state = 'unpublishing'
      // this.publish.isAllowPushVideo = false
      this.roominfo.self.videomuted = true
      this.unPublishNotify()
      // this.roominfo.nextPresenterDisplay = msg.action_display
    }else if (msg.event === 'startVideo'){
      this.publish.isAllowPushVideo = true
      this.publish.isLocalMuted = false
      this.publish.isLocalVideoMuted = false
      this.publishsdp(true, true)
    }else if (msg.event === 'stopVideo'){
      console.log('关闭视频');
      this.stopPublish()
      this.publish.publish_state = 'unpublishing'
      this.roominfo.self.videomuted = true
      this.unPublishNotify()
    } else if (msg.event === 'startPublish') {
      this.roomUpdateParticipants(msg.peer, 'event= startPublish')
      this.roominfo.nextPresenterDisplay = msg.action_display
      this.getRoomInfo()
      if (msg.peer.display === this.roominfo.self.display) {
        this.publish.isAllowPushVideo = true
        this.publish.isLocalVideoMuted = false
        this.roominfo.self.videomuted = false
        this.publish.isLocalMuted = false
        if (this.publish.pc) {
          this.unmutelocal('video')
          this.unmutelocal('audio')
          return
        }
        this.publishsdp(true, true)
      } else {
        const p = this.players.get(msg.peer.display)
        if (p) {
          // 其他人被设为主持人，如果已经在推流，则直接播放
          if (p.videoTrack) {

            this.mixStream.playAddTrack(p.videoTrack,msg.peer.display)
          }
        }
      }
    } else if (msg.event === 'shutdown') {
      this.disconnect()
      this.emit('shutdown', msg.display)
    } else if (msg.event === 'startRecord') {
      this.emit('start-record', msg)
    } else if (msg.event === 'stopRecord') {
      this.emit('stop-record', msg)
    } else if (msg.event === 'sendMsg') {
      // 学员举手
      if (msg.msgType === '110') {
        this.emit('callback-hands', msg.senderDisplay)
      }
      // 取消学员举手
      if (msg.msgType === '1100') {
        this.emit('callback-cancal-hands', msg)
      }
      // 记录动作
      if (msg.msgType === 'action') {
        this.action = msg.msgData
      }
      // 动作回调
      if (msg.msgType === 'actionCallback') {
        // 回调动作特殊处理
        const data = msg.msgData.split('|')
        const action = data[1]
        const info = JSON.parse(data[0])
        if (action === 'mute' || action === 'unMute') {
          // this.emit('ws-callback-mute-action', info)
          this.roomUpdateParticipants(info.peer, 'msg.msgType = actionCallback')
        }
      }
      // 学员关闭视频
      if (msg.msgType === 'studentClosePlay') {
        this.emit('student-close-play', msg)
      }
      // 学员关闭视频
      if (msg.msgType === 'studentOpenPlay') {
        this.emit('student-open-play', msg)
      }
      // 学员关闭视频
      if (msg.msgType === 'endCurriculum') {
        this.emit('shutdown', msg)
      }
      // 学员关闭视频
      if (msg.msgType === 'videoAvailabel') {
        this.emit('video-availabel', msg.msgData)
      }
    }
  }

  updateSelf(peer) {
    if (peer.display === this.roominfo.self.display) {
      this.roominfo.self = peer
    }
  }

  roomUpdateParticipants(peer, type = '') {
    var index = this.roominfo.participants.findIndex((pa) => {
      return pa.display === peer.display
    })
    // console.log(peer,'--------------------------');
    if (index >= 0) {
      this.roominfo.participants[index] = peer
    }else{
      this.roominfo.participants.push(peer)
    }
  }

  roomRemoveParticipants(peer) {
    var index = this.roominfo.participants.findIndex((pa) => {
      return pa.display === peer.display
    })
    index >= 0 && this.roominfo.participants.splice(index, 1)
  }

  async startPublish(type) {
    await this.publish[type==='main'?'pc':'subpc'].setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: type==='main'?this.publish.remote_sdp:this.publish.remote_subsdp,
      })
    )

    this.roominfo.self.publishing = true // 强制设为true，因为不会有publish发过来
    for (let i = 0; i < this.roominfo.participants.length; i++) {
      if (this.roominfo.participants[i].display === this.roominfo.self.display) {
        this.roominfo.participants[i].publishing = true
        break
      }
    }
    this.publish.publish_state = 'publishing'
    type==='main'&&this.publish.pcStats.start()
    await type==='main'?this.publishNotify():this.publishsubNotify()
  }

  // 开始播放
  async startPlay(player) {
    console.log(player);
    await player.pc.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: player.remote_sdp,
      })
    )
  }
  // 停止播放
  stopPlay(player) {
    if (!player.pc) return
    player.pcStats.stop()
    const receivers = player.pc.getReceivers()
    receivers.forEach((receiver) => {
      if (receiver.track) {
        this.mixStream.playRemoveTrack(receiver.track) // 停止播放的话，就把track从播放表中删除
        receiver.track.stop()
      }
    })

    if (player.videoTrack) {
      player.videoTrack.stop()
      player.videoTrack = null
    }

    player.pc && player.pc.close()
    player.pc = null
  }

  stopPublish() {
    // mixStream只针对本地的进行删除
    this.mixStream.localRemoveTrack('audio', false)
    this.mixStream.localRemoveTrack('audio', true)
    if (
      this.mixStream.playVideoStream.get(this.myInfo.display)&&
      this.mixStream.playVideoStream.get(this.myInfo.display).getVideoTracks()[0] &&
      this.mixStream.localVideoStream.getVideoTracks()[0] &&
      this.mixStream.playVideoStream.get(this.myInfo.display).getVideoTracks()[0] === this.mixStream.localVideoStream.getVideoTracks()[0]
    ) {
      // play与local一样
      this.mixStream.playRemoveTrack(this.mixStream.playVideoStream.get(this.myInfo.display).getVideoTracks()[0],this.myInfo.display)
    }

    this.mixStream.localRemoveTrack('video', false)
    this.mixStream.localRemoveTrack('video', true)

    if (this.publish.pcStats) {
      this.publish.pcStats.stop()
      this.publish.pcStats = null
    }
    this.publish.pc && this.publish.pc.close()
    this.publish.pc = null
    this.publish.offer = null
    this.publish.remote_sdp = ''
  }

  // 加入房间
  join() {
    return this.send({
      action: 'join',
      room: this.myInfo.room,
      role:this.myInfo.role,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }

  // 自定义广播消息
  sendNotification(data) {
    return new Promise((resolve, reject) => {
      this.send({
        action: 'sendMsg',
        roomId: this.myInfo.room,
        display: this.myInfo.display,
        tokenId: this.myInfo.tokenId,
        msgType: data.msgType,
        msgData: data.msgData,
      })
      resolve()
    })
  }
  //清晰度切换
  async changeResolutionRatio(){
    if (this.publish.pc) {
      this.publish.pc.getSenders()[1].track&&this.publish.pc.getSenders()[1].track.stop()
    }
    if (this.publish.pc) this.localStateNotify()
    var constraints = this.deviceInfo.getPushConstraints();
    constraints.video.width&&(constraints.video.width = '160');
    constraints.video.height&&(constraints.video.height ='90');
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.publish.pc.getSenders()[1].replaceTrack(stream.getVideoTracks()[0])
    this.mixStream.playAddTrack(stream.getVideoTracks()[0],this.myInfo.display)
    this.localStateNotify()
    console.log(constraints,'==模糊====');
  }
  async changeResolutionRatio1(){
    if (this.publish.pc) {
      this.publish.pc.getSenders()[1].track&&this.publish.pc.getSenders()[1].track.stop()
    }
    if (this.publish.pc) this.localStateNotify()
    var constraints = this.deviceInfo.getPushConstraints();
    constraints.video.width = '1280'
    constraints.video.height = '720'
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.publish.pc.getSenders()[1].replaceTrack(stream.getVideoTracks()[0])
    this.mixStream.playAddTrack(stream.getVideoTracks()[0],this.myInfo.display)
    this.localStateNotify()
    console.log(constraints,'===超清===');
  }
  reloadPublish() {
    console.log(this.roominfo, this.publish.pc, '现在有什么数据')
    let videomuted = this.roominfo.self.videomuted
    let audiomuted = this.roominfo.self.audiomuted
    if (!videomuted && !audiomuted) {
      this.stopPublish()
      this.unPublishNotify()
      this.publish.isAllowPushVideo = true
      this.publish.isLocalVideoMuted = false
      this.roominfo.self.videomuted = false
      this.publish.isLocalMuted = false
      this.publishsdp(true, true)
    }else{
      this.stopPublish()
      this.unPublishNotify()
      this.publish.isAllowPushVideo = true
      this.publish.isLocalVideoMuted = videomuted
      this.roominfo.self.videomuted = videomuted
      this.publish.isLocalMuted = audiomuted
      this.publishsdp(!audiomuted, !videomuted)
    }
  }
  async publishmutesdp() {
    let that = this
    if (this.publish.pc) {
      return Error('is already publishing!!!!')
    }
    this.hasAudioInput = this.deviceInfo.audioInputDevice !== null
    this.hasWebcam = this.deviceInfo.videoInputDevice !== null
    this.publish.pc = new RTCPeerConnection(null)
    this.publish.pc.onconnectionstatechange = function (event) {
      switch (that.publish.pc.connectionState) {
        case 'connected':
          // The connection has become fully connected
          break
        case 'disconnected':
          Message({
            showClose: true,
            message: '连接断开，但是可能重新连接',
            type: 'warning'
          });
          break
        case 'failed':
          that.reloadPublish()
          // One or more transports has terminated unexpectedly or in an error
          break
        case 'closed':
          // The connection has been closed
          break
      }
    }
    this.publish.pcStats = this.newPcStats(this.publish.pc, true, this.myInfo)
    this.newMixStream()
    this.publish.pc.addTransceiver('audio', { direction: 'sendonly' })
    this.publish.pc.addTransceiver('video', { direction: 'sendonly' })
    //获取本地流
    var constraints = this.deviceInfo.genConstraints(!this.publish.isLocalMuted, !this.publish.isLocalVideoMuted && this.publish.isAllowPushVideo)
    // var constraints = {audio: true, video: false}
    let stream = await navigator.mediaDevices.getUserMedia(constraints)
    stream.getTracks().forEach((track) => {
      //音频流中的音频track,视频track, 加入pc发送
      if (track.kind === 'video') {
        this.mixStream.localAddTrack(track, false) //加入本地流
        this.mixStream.playAddTrack(track) //加入本地播放，推送，自己可以观看
      } else {
        this.mixStream.localAddTrack(track, false)
        //this.mixStream.playAddTrack(track) //测试
      }
    })
    //创建SDP
    var offer = await this.publish.pc.createOffer()
    this.publish.offer = offer
    //pc设置本地SDP
    await this.publish.pc.setLocalDescription(offer)
    await this.send({
      action: 'publishsdp',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      sdp: this.publish.offer.sdp,
    })
  }
  // 协商推送sdp, 两个参数一般都是要设为true, 具体要不要推视频流，从constraints控制
  async publishsdp(isPushAudio, isPushVideo, screenStream = null) {
    // const that = this
    // if (this.publish.pc) {
    //   this.stopPublishStreamNotification(this.roominfo.self.display)
    // }
    
    let that = this
    this.hasAudioInput = this.deviceInfo.audioInputDevice !== null
    this.hasWebcam = this.deviceInfo.videoInputDevice !== null
    this.publish.pc = new RTCPeerConnection(null) // 创建对等链接
    this.publish.pc.onconnectionstatechange = function (event) {
      switch (that.publish.pc.connectionState) {
        case 'new':
            // 新建，尚未启动
            console.log('新建，尚未启动');
            break;
        case 'connecting':
            // 正在尝试建立连接
            console.log('正在尝试建立连接');
            break;
        case 'checking':
            // 检查是否可以建立连接
            console.log('检查是否可以建立连接');
            break;
        case 'connected':
            // 已经建立连接
            console.log('已经建立连接');
            break;
        case 'completed':
            // 连接已完成，此时两端都有多于一个的候选对等体
            console.log('连接已完成，此时两端都有多于一个的候选对等体');
            break;
        case 'failed':
            // 连接尝试失败
            console.log('连接尝试失败');
            setTimeout(() => {
              that.reloadPublish()
            }, 500);
            break;
        case 'disconnected':
            // 连接断开，但是可能重新连接
            Message({
              showClose: true,
              message: '连接断开，但是可能重新连接',
              type: 'warning'
            });
            console.log('连接断开，但是可能重新连接');
            break;
        case 'closed':
            // 连接关闭
            console.log('连接关闭');
            break;
        default:
            // 其他状态
            console.log('其他状态');
            break;
      }
    }
    this.publish.pcStats = this.newPcStats(this.publish.pc, true, this.myInfo)
    this.newMixStream() // 实例化mixstream文件的类
    // 收发器，代表只发送
    // 添加一个单向的音频流
     this.publish.pc.addTransceiver('audio', { direction: 'sendonly' })

     this.publish.pc.addTransceiver('video', { direction: 'sendonly' })
    //分享屏幕的时候多一个音频通道
    // 获取本地流
    var constraints = this.deviceInfo.genConstraints(!this.publish.isLocalMuted, !this.publish.isLocalVideoMuted && this.publish.isAllowPushVideo)
    // 如果是观众角色，限制推流为小头像流
    console.log(this.myInfo.role,'this.myInfo.role1111111111');
    
    if (this.myInfo.role == 'user') {
      console.log('这是观众角色，限制推流为小头像流');
      
      constraints.video.width = { ideal: 160, max: 160 };
      constraints.video.height = { ideal: 90, max: 90 };
      constraints.video.frameRate = { ideal: 15, max: 15 };
    }else{
      console.log('这是主持人角色，推流为大头像流');
      constraints.video.width = { ideal: 1280, max: 1920 };
      constraints.video.height = { ideal: 720, max: 1080 };
      constraints.video.frameRate = { ideal: 30, max: 30 };
    }
    // if (constraints.audio || constraints.video) {
      const devices = await navigator.mediaDevices.enumerateDevices()
      try {
        console.log(constraints,'constraints22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222')
        
        var stream = await navigator.mediaDevices.getUserMedia(constraints)
        // var stream = new MediaStream()
        // console.log(streams.getAudioTracks(),screenStream.getTracks());
        // stream.addTrack(streams.getAudioTracks()[0])
        // stream.addTrack(screenStream.getTracks()[0],screenStream)
        // console.log(stream,'这是拉到的流',stream.getTracks());
        // console.log(screenStream.getTracks(),streams.getVideoTracks(),'拉流设置的参数');
        stream.getTracks().forEach((track) => {
          // 音频流中的音频track,视频track, 加入pc发送
          if (track.kind === 'video') {
            console.log(track,'video');
            this.publish.pc.getSenders()[1].replaceTrack(track)
            // this.mixStream.localAddTrack(track, false) // 加入本地流
            this.mixStream.playAddTrack(track,this.myInfo.display) // 加入本地播放，推送，自己可以观看
          } else {
            this.publish.pc.getSenders()[0].replaceTrack(track)
            // this.mixStream.localAddTrack(track, false)
          }
          console.log(track,'这是在推流时获取到的流通道');
        })
      } catch(err) {
        console.error('请先去系统设置权限', err)
      }
    // }else{
    //   console.log('当前无音视频设备权限，无法推流');
    //   confirm('当前无音视频设备权限，无法推流')
    //   return false;
    // }
    // 判断是否带流过来，如果有带流就协商的时候插入这个流
    // 创建SDP
    var offer = await this.publish.pc.createOffer()
    //     offer.sdp = this.enableRRtr(offer.sdp,"H264", "rrtr")
    //     offer.sdp = this.enableRRtr(offer.sdp,"VP8", "rrtr")
    //     offer.sdp = this.enableRRtr(offer.sdp,"VP9", "rrtr")
    //     offer.sdp = this.enableRRtr(offer.sdp,"AV1", "rrtr")
    if (this.myInfo.role=='user') {
        var vbit = 50
        var abit = 49
        offer.sdp = this.setMediaBitrates(offer.sdp, vbit, abit)
    }
    // const modifedOfferString = this.setMediaBitrates(offer.sdp)
    // offer.sdp = modifedOfferString
    this.publish.offer = offer
    // console.log(offer.sdp,'这是主持人协商的sdp');
    await this.publish.pc.setLocalDescription(offer)
    await this.send({
      action: 'publishsdp',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      sdp: this.publish.offer.sdp, //
    })
  }
  addParams(sdp,str){
    var sdpLines = sdp.split('\r\n');
    sdpLines.forEach((e,index)=>{
      if(e.indexOf('level-asymmetry-allowed')!==-1){
        console.log(e,'这是要改的');
        sdpLines[index]=e+str
      }
    })
    sdp = sdpLines.join('\r\n');
    return sdp;
  }
  enableRRtr(sdp, codec, param) {
        var sdpLines = sdp.split('\r\n');
        for (var codecIndex = this.findLine(sdpLines, 'a=rtpmap', codec);codecIndex != null; ){
          sdpLines.splice(codecIndex + 1, 0, "a=rtcp-fb:" + this.getCodecPayloadTypeFromLine(sdpLines[codecIndex]) + " " + param);
          codecIndex = this.findLineInRange(sdpLines, codecIndex+1, -1, 'a=rtpmap', codec); 
        }   
        sdp = sdpLines.join('\r\n');
        return sdp;
    }
    findLine(sdpLines, prefix, substr) {
        return this.findLineInRange(sdpLines, 0, -1, prefix, substr);
      }
      findLineInRange(
          sdpLines,
          startLine,
          endLine,
          prefix,
          substr,
          direction
        ) {
          if (direction === undefined) {
            direction = 'asc';
          }
        
          direction = direction || 'asc';
        
          if (direction === 'asc') {
            // Search beginning to end
            var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
            for (var i = startLine; i < realEndLine; ++i) {
              if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                  return i;
                }
              }
            }
          } else {
            // Search end to beginning
            var realStartLine = startLine !== -1 ? startLine : sdpLines.length-1;
            for (var j = realStartLine; j >= 0; --j) {
              if (sdpLines[j].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[j].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                  return j;
                }
              }
            }
          }
          return null;
        }
    getCodecPayloadTypeFromLine(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) [a-zA-Z0-9-]+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
      }
  // 通知远端拉流
  publishNotify() {
    return this.send({
      action: 'publish',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      audiomuted: this.publish.isLocalMuted,
      videomuted: this.publish.isLocalVideoMuted,
      sharing: this.publish.isSharing,
    })
  }
  //通知远端拉辅流
  publishsubNotify() {
    return this.send({
      action: 'publishsub',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      subDisplay:this.myInfo.subDisplay
    })
  }
  // 通知远端取消拉辅流
  unPublishsubNotify() {
    return this.send({
      action: 'unpublishsub',
      room: this.myInfo.room,
      display: this.myInfo.display,
      subDisplay: this.myInfo.subDisplay,
      tokenId: this.myInfo.tokenId
    })
  }
  // 通知远端取消拉流
  unPublishNotify() {
    return this.send({
      action: 'unpublish',
      room: this.myInfo.room,
      display: this.myInfo.display,
      audiomuted: true,
      videomuted: true,
      tokenId: this.myInfo.tokenId,
    })
  }

  // 通知远端 当前视频流是屏幕分享
  startShareNotify() {
    return this.send({
      action: 'startshare',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }

  // 通知远端 已取消屏幕分享
  stopShareNotify() {
    return this.send({
      action: 'stopshare',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }

  // 本地状态的通知
  localStateNotify() {
    return this.send({
      action: 'localstatenotify',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      audiomuted: this.publish.isLocalMuted,
      videomuted: this.publish.isLocalVideoMuted,
      sharing: this.publish.isSharing,
    })
  }

  async playsdp(player) {
    var offer = await player.pc.createOffer()
//        offer.sdp = this.enableRRtr(offer.sdp,"H264", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"VP8", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"VP9", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"AV1", "rrtr")
    player.offer = offer

    // pc设置本地SDP
    await player.pc.setLocalDescription(offer)

    return this.send({
      action: 'playsdp',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      sdp: player.offer.sdp,
      action_display: player.display,
    })
  }

  playallsdp() {
    const closePlayers = new Map()
    !this.audioContext && (this.audioContext = new this.AudioContext())
    this.newMixStream()
    const that = this
    this.players.forEach((player) => {
      closePlayers.set(player.display, true)
    })
    this.roominfo.participants.forEach((p) => {
      // 过滤掉自己
      if (p.display !== this.roominfo.self.display && p.publishing === true) {
        // participants 当前还没有流
        if (p.subDisplay.length) {
          if (!this.players.get(p.subDisplay)) {
            const player = {
              pc: new RTCPeerConnection(null), // PeerConnection
              stream: new MediaStream(), //MediaStream
              offer: null, // Offer
              display: '', // display
              pcStats: null,
              isSpeaking: false,
              videoTrack: null,
              username: p.username,
            }
            player.pcStats = this.newPcStats(player.pc, false, player)
            player.pc.addTransceiver('audio', { direction: 'recvonly' }) // 接收音频
            player.pc.addTransceiver('video', { direction: 'recvonly' }) // 接收视频，可以把通道开起来？？？
            player.offer = null
            player.display = p.subDisplay
            player.pc.ontrack = (event) => {
                if (event.track.kind === 'audio') {
                  // 只拿声音，视频是本地视频`
                  console.log('进来添加音频轨道');
                  that.mixStream.playAddTrack(event.track,p.subDisplay)
                  player.pcStats.start()
                } else {
                  // video
                   player.stream.addTrack(event.track)
                  that.mixStream.playAddTrack(event.track,p.subDisplay)
                }
              }
            this.playsdp(player) // 发送sdp
            this.players.set(player.display, player)
          } else {
            //当之前已经有在players里面，且还没退出直播时的操作
            closePlayers.set(p.subDisplay, false)
          }
        }
        if (!this.players.get(p.display)) {
          console.log('进来重新创建链了吗',p.display);
          const player = {
            pc: new RTCPeerConnection(null), // PeerConnection
            stream: new MediaStream(),
            offer: null, // Offer
            display: '', // display
            pcStats: null,
            isSpeaking: false,
            videoTrack: null,
            username: p.username,
          }
          player.pcStats = this.newPcStats(player.pc, false, player)
          player.pc.addTransceiver('audio', { direction: 'recvonly' }) // 接收音频
          player.pc.addTransceiver('video', { direction: 'recvonly' }) // 接收视频，可以把通道开起来？？？
          player.offer = null
          player.display = p.display
          player.pc.ontrack = (event) => {
            if (event.track.kind === 'audio') {
              // 只拿声音，视频是本地视频`
              console.log('添加音频轨道');
              that.mixStream.playAddTrack(event.track,p.display)
              player.pcStats.start()
            } else if(event.track.kind === 'video') {
              that.mixStream.playAddTrack(event.track,p.display)
            }
          }
          this.playsdp(player) // 发送sdp
          this.players.set(player.display, player)
        } else {
          closePlayers.set(p.display, false)
        }
      }
    })
    closePlayers.forEach((value, key) => {
      if (value === true) {
        console.log('又进来停止播放流吗');
        const player = this.players.get(key)
        if (this.players.get(key).stream&&this.players.get(key).stream.getVideoTracks().length) {
          let track =  this.players.get(key).stream.getVideoTracks()[0]
          track.stop()
          this.players.get(key).stream.removeTrack(track)
        }
        this.players.delete(key)
        if (player) {
          this.stopPlay(player)
        }
      }
    })
    setTimeout(() => {
      if(this.mixStream.playVideoStream.size){
        this.emit('play-video-stream-updated', this.mixStream.playVideoStream)
      }
    }, 1500);
  }
  openVideo(display) {
    return this.send({
      action: 'startVideo',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      action_display: display,
    })
  }
  closeVideo(display) {
    return this.send({
      action: 'stopVideo',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      action_display: display,
    })
  }
  // 主持人屏蔽远端
  unmute(display) {
    return this.send({
      action: 'unmute',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      action_display: display,
    })
  }

  // 主持人解除屏蔽远端
  mute(display) {
    return this.send({
      action: 'mute',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      action_display: display,
    })
  }

  muteall() {
    return this.send({
      action: 'muteall',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }

  unmuteall() {
    return this.send({
      action: 'unmuteall',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }
  // 本地流静音, kind=audio/video
   mutelocal(kind) {
    if (kind === 'audio') {
      if (this.publish.isLocalMuted) {
        return
      }
      // this.mixStream && this.mixStream.localRemoveTrack(kind, false) // 音频只管删除发送
      if (this.publish.pc) {
        this.publish.pc.getSenders()[0].track&&this.publish.pc.getSenders()[0].track.stop()
      }
      this.publish.isLocalMuted = true
    } else if (kind === 'video') {
      if (this.publish.isLocalVideoMuted) return
      this.publish.isLocalVideoMuted = true
      if (this.mixStream && !this.mixStream.localVideoStreamScreen) {
        // 不是屏幕分享的流才删除
        // this.mixStream && this.mixStream.localRemoveTrack(kind, false) // 视频删除发送
        this.mixStream && this.mixStream.playVideoRemoveTrack() // 视频直接清空，本地不显示视频
      }
      if (this.publish.pc) {
        this.publish.pc.getSenders()[1].track&&this.publish.pc.getSenders()[1].track.stop()
      }
    }
    this.publishRecordSdp()
    if (this.publish.pc) this.localStateNotify()
  }

  // 本地流解除静音
  async unmutelocal(kind) {
    if (!this.publish.pc) {
      this.publish.isLocalMuted = false
      this.publish.isLocalVideoMuted = true
      this.publishsdp(true,true)
    }
    const stream = await this.deviceInfo.startCaptureSingle(kind)
    if (kind === 'video') {
      if (!this.publish.isAllowPushVideo) {
        return
      }
      if (!this.publish.isLocalVideoMuted && this.publish.pc) {
        if (this.publish.pc.getSenders()[1] && this.publish.pc.getSenders()[1].track) {
          return
        }
      }
      this.publish.pc.getSenders()[1].replaceTrack(stream.getVideoTracks()[0])
      this.mixStream.playAddTrack(stream.getVideoTracks()[0],this.myInfo.display)
      this.publish.isLocalVideoMuted = false
      this.publishRecordSdp()
    } else {
      // kind === 'audio'
      if (!this.publish.pc) {
        this.publish.isLocalVideoMuted = true
      }
      if (!this.publish.isLocalMuted && this.publish.pc) {
        if (this.publish.pc.getSenders()[0] && this.publish.pc.getSenders()[0].track) {
          return
        }
      }
      this.publish.pc.getSenders()[0].replaceTrack(stream.getAudioTracks()[0])
      this.mixStream.playAudioStream.size>0&&this.emit('play-video-stream-updated', this.mixStream.playAudioStream)
      this.publish.isLocalMuted = false
    }
    this.localStateNotify()
  }


  // 停止推流
  republish() {
    if (!this.publish.pc) {
      return false
    }
    this.stopPublish()
    this.unPublishNotify()
    this.publish.isAllowPushVideo = true
    this.publish.isLocalVideoMuted = false
    this.roominfo.self.videomuted = false
    this.publish.isLocalMuted = false
  }
  // 必须要有视频，可以没有音频, 替换掉本地的视频
  // 必须要有视频，可以没有音频, 替换掉本地的视频
 async shareScreenStream(stream) {
  let that = this
    this.republish()
    this.hasAudioInput = this.deviceInfo.audioInputDevice !== null
    this.hasWebcam = this.deviceInfo.videoInputDevice !== null
    this.publish.pc = new RTCPeerConnection(null) // 创建对等链接
    this.publish.pcStats = this.newPcStats(this.publish.pc, true, this.myInfo)
    this.newMixStream() // 实例化mixstream文件的类
    // 收发器，代表只发送
    this.publish.pc.addTransceiver('audio', { direction: 'sendonly' })
    // 添加单向的视频流
    this.publish.pc.addTransceiver('video', { direction: 'sendonly' })
    stream.getTracks().forEach((track) => {
      // 音频流中的音频track,视频track, 加入pc发送
      if (track.kind === 'video') {
        this.mixStream.localAddTrack(track, false) // 加入本地流
        this.mixStream.playAddTrack(track,this.myInfo.display) // 加入本地播放，推送，自己可以观看
      } else {
        this.mixStream.localAddTrack(track, false)
      }
    })
    stream.getVideoTracks()[0].onended = async () => {
      that.publish.isSharing = false
          that.mixStream.localRemoveTrack('video', true) // 本地流删除视频流
          that.mixStream.playRemoveTrack(stream.getVideoTracks()[0],this.myInfo.display)
          that.speedLimit = true // false为不限速，true为限速
          that.publish.subpc&&that.publish.subpc.close()
          that.publish.subpc = null
          this.unPublishsubNotify()
          that.republish()
          setTimeout(() => {
            this.publishsdp(true, true)
          }, 2000);
    }
    // 创建SDP
    var offer = await this.publish.pc.createOffer()
//        offer.sdp = this.enableRRtr(offer.sdp,"H264", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"VP8", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"VP9", "rrtr")
//     offer.sdp = this.enableRRtr(offer.sdp,"AV1", "rrtr")
    this.publish.offer = offer
    await this.publish.pc.setLocalDescription(offer)
    setTimeout(() => {
      this.send({
        action: 'publishsdp',
        room: this.myInfo.room,
        display: this.myInfo.display,
        tokenId: this.myInfo.tokenId,
        sdp: this.publish.offer.sdp, //
      })
    }, 2000);
  }
  audioStreamUpdated(aStream){
    if (!this.publish.pc) return
    var track = null
    aStream && aStream.getAudioTracks().length > 0 && (track = aStream.getAudioTracks()[0])
    var senders = this.publish.pc.getSenders()
    var sender = senders.find((sender) => {
      return sender.track && sender.track.kind === 'audio'
    })

    if (!sender && senders.length >= 1) {
      sender = senders[0]
    }
    setTimeout(() => {
     console.log(track,'辅流音频通道');
      if (sender) {
        sender.setStreams(aStream)
      }
    }, 300);
    if (track !== null) this.emit('device-change', 'audio-input', track.label)
  }
    //推辅流的方法
    async publishsubsdp(isPushAudio, isPushVideo, screenStream = null) {
      const that = this
      this.publish.subpc = new RTCPeerConnection(null) // 创建对等链接
      // 收发器，代表只发送
      isPushAudio && this.publish.subpc.addTransceiver('audio', { direction: 'sendonly' })
      // 添加单向的视频流
      isPushVideo && this.publish.subpc.addTransceiver('video', { direction: 'sendonly' })
      //subDisplay是辅流的display
      that.myInfo.subDisplay = Number(parseInt(new Date().getTime() * Math.random() * 100))
        .toString(16)
        .toString(16)
        .substr(0, 15)
      if (screenStream.getVideoTracks().length>0&&this.publish.subpc) {
        //监听辅流是否关闭
        screenStream.getVideoTracks()[0].onended = async () => {
          this.unPublishsubNotify()
          this.publish.subpc.close()
          that.publish.subpc = null
          that.myInfo.subDisplay = ''
        }
      }
      // 将流发送到远端
      this.subStreamUpdated(screenStream)
      this.subAudioStreamUpdated(screenStream)
      let offer = await this.publish.subpc.createOffer()
//       offer.sdp = this.enableRRtr(offer.sdp,"H264", "rrtr")
//       offer.sdp = this.enableRRtr(offer.sdp,"VP8", "rrtr")
//       offer.sdp = this.enableRRtr(offer.sdp,"VP9", "rrtr")
//       offer.sdp = this.enableRRtr(offer.sdp,"AV1", "rrtr")
      // offer.sdp = this.addParams(offer.sdp,';x-google-max-bitrate=10000;x-google-min-bitrate=2000;x-google-start-bitrate=5000')
      //本地储存辅流
      that.mixStream.localsubTrack(screenStream.getVideoTracks()[0])
      //suboffer是辅流的offer
      this.publish.suboffer = offer
      // pc设置本地SDP更改与连接关联的本地描述。
      // 此描述指定连接本地端的属性，包括媒体格式。该方法接受一个参数——会话描述——并且它返回一个 Promise，一旦描述被改变，它就会异步地完成。
      await this.publish.subpc.setLocalDescription(offer)
      await this.send({
        action: 'publishsdp',
        room: this.myInfo.room,
        display: this.myInfo.display,
        tokenId: this.myInfo.tokenId,
        subDisplay:this.myInfo.subDisplay,//推辅流要多加subdisplay
        sdp: this.publish.suboffer.sdp,
      })
  }
  async publishBoardsdp(isPushAudio, isPushVideo, screenStream = null) {
    console.log(screenStream.getVideoTracks(),screenStream.getTracks(),'共享白板流');
    const that = this
    this.publish.subpc = new RTCPeerConnection(null) // 创建对等链接
    // 收发器，代表只发送
    isPushAudio && this.publish.subpc.addTransceiver('audio', { direction: 'sendonly' })
    // 添加单向的视频流
    isPushVideo && this.publish.subpc.addTransceiver('video', { direction: 'sendonly' })
    //subDisplay是辅流的display
    that.myInfo.subDisplay = Number(parseInt(new Date().getTime() * Math.random() * 100))
      .toString(16)
      .toString(16)
      .substr(0, 15)
    if (screenStream.getVideoTracks().length>0&&this.publish.subpc) {
      //监听辅流是否关闭
      screenStream.getVideoTracks()[0].onended = async () => {
        this.unPublishsubNotify()
        this.publish.subpc.close()
        that.publish.subpc = null
        that.myInfo.subDisplay = ''
      }
    }
    // 将流发送到远端
    this.subStreamUpdated(screenStream)
    var stream = await navigator.mediaDevices.getUserMedia({audio:true})
    this.subAudioStreamUpdated(stream)
    let offer = await this.publish.subpc.createOffer()
    //本地储存辅流
    that.mixStream.localsubTrack(screenStream.getVideoTracks()[0])
    //suboffer是辅流的offer
    this.publish.suboffer = offer
    // pc设置本地SDP更改与连接关联的本地描述。
    // 此描述指定连接本地端的属性，包括媒体格式。该方法接受一个参数——会话描述——并且它返回一个 Promise，一旦描述被改变，它就会异步地完成。
    await this.publish.subpc.setLocalDescription(offer)
    await this.send({
      action: 'publishsdp',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
      subDisplay:this.myInfo.subDisplay,//推辅流要多加subdisplay
      sdp: this.publish.suboffer.sdp,
    })
}
  // 推辅流
  async publishAuxiliaryStream(stream){
    //推辅流或者推新的辅流则将之前的流轨道都停掉
    this.auxiliaryStream.getTracks().forEach( track => track.stop() )
    this.mixStreams.getTracks().forEach( track => track.stop() )
    //将新的共享屏幕流存储起来
    this.auxiliaryStream = stream;
    //如果之前有推辅流就先停止
    if (this.publish.subpc) {
      this.publish.subpc.getSenders()[0].track&&this.publish.subpc.getSenders()[0].track.stop()
      this.publish.subpc.getSenders()[1].track&&this.publish.subpc.getSenders()[1].track.stop()
      this.myInfo.subDisplay = ''
      this.mixStream.localSubRemoveStream() //本地流删除视频辅流
      this.unPublishsubNotify()
      this.publish.subpc.close()
      this.publish.subpc = null
    }
    //调用混流操作
    let mstream =await this.mixAudioStream(stream)
    //将混好的流存储起来
    this.mixStreams = mstream
    //开始进行辅流协商
    this.publishsubsdp(true, true, mstream) // 重新协商将屏幕流带进去
  }
   // 推共白板
   async publishBoardStream(stream){
    console.log('-------------------------------------------------------------');
    //推辅流或者推新的辅流则将之前的流轨道都停掉
    this.auxiliaryStream.getTracks().forEach( track => track.stop() )
    this.mixStreams.getTracks().forEach( track => track.stop() )
    //将新的共享屏幕流存储起来
    this.auxiliaryStream = stream;
    //如果之前有推辅流就先停止
    if (this.publish.subpc) {
      this.publish.subpc.getSenders()[0].track&&this.publish.subpc.getSenders()[0].track.stop()
      this.publish.subpc.getSenders()[1].track&&this.publish.subpc.getSenders()[1].track.stop()
      this.myInfo.subDisplay = ''
      this.mixStream.localSubRemoveStream() //本地流删除视频辅流
      this.unPublishsubNotify()
      this.publish.subpc.close()
      this.publish.subpc = null
    }
    //调用混流操作
    let mstream =await this.mixAudioStream(stream)
    //将混好的流存储起来
    this.mixStreams = mstream
    //开始进行辅流协商
    this.publishBoardsdp(true, true, mstream) // 重新协商将屏幕流带进去
  }
  //融音频流
  async mixAudioStream(astream){
    console.log(this.roominfo.self);
    let track = this.publish.pc?this.publish.pc.getSenders()[0].track:null
    //判断主流是否在推音频流，如果有在推音频流就停止主流pc的音轨然后融流，否者返回原摄像头流
    console.log(track,'track--------------------------------');
    if(track){
      // track.stop()//停止主流音轨
      // let mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});//获取设备音频流
      // const micSourceNode = this.mixStream.audioContext.createMediaStreamSource(mediaStream);// 生成一个设备 mediaStream 音频源
      // const destination = this.mixStream.audioContext.createMediaStreamDestination()
      // const srcShare = astream.getAudioTracks().length?this.mixStream.audioContext.createMediaStreamSource(astream):null//获取屏幕音频源
      // //开始融合音轨
      // srcShare&&srcShare.connect(destination)
      // micSourceNode.connect(destination)
      // let mstream = new MediaStream()
      // astream.getVideoTracks().length&&mstream.addTrack(astream.getVideoTracks()[0])
      // mstream.addTrack(destination.stream.getAudioTracks()[0])
      return astream;//将融合完毕的音轨放到新流里面返回
    }else{
      return astream;//主流之中没有音频流，则直接返回原始的共享音频流
    }
  }
  //当本地声音发生改变时，对音轨进行操作
  async changesubAudioStream(hasAudio){
    if (hasAudio) {
      console.log('开启音频');
      // console.log(this.auxiliaryStream.getTracks());
      // 当本地开启声音的时候，就拿刚才存储的声音
      let mstream =await this.mixAudioStream(this.auxiliaryStream)
      this.subAudioStreamUpdated(mstream)
    }else{
      console.log('关闭音频');
      this.subAudioStreamUpdated(this.auxiliaryStream)
    }
  }
  // 将辅流推到远端的方法
  subStreamUpdated(vStream) {
    if (!this.publish.subpc) return
    console.log(vStream.getVideoTracks(),'共享品目视频通道');
    let track = null
    vStream.getVideoTracks().length > 0 && (track = vStream.getVideoTracks()[0])
    var senders = this.publish.subpc.getSenders()
    var sender = senders.find((sender) => {
      return sender.track && sender.track.kind === 'video'
    })

    if (!sender && senders.length >= 2) {
      sender = senders[1]
    }
    if (sender) {
      sender.track && sender.track.stop()
      sender.replaceTrack(track)
    }
    if (track !== null) this.emit('device-change', 'video-input', track.label)
  }
  subAudioStreamUpdated(aStream){
    if (!this.publish.subpc) return
    var track = null
    // console.log(aStream);
    aStream && aStream.getAudioTracks().length > 0 && (track = aStream.getAudioTracks()[0])
    var senders = this.publish.subpc.getSenders()
    var sender = senders.find((sender) => {
      return sender.track && sender.track.kind === 'audio'
    })

    if (!sender && senders.length >= 1) {
      sender = senders[0]
    }
    // console.log(track,'辅流音频通道');
    if (sender) {
      // sender.track && sender.track.stop()
      sender.replaceTrack(track)
    }
    if (track !== null) this.emit('device-change', 'audio-input', track.label)

  }
  // 通知远端取消拉流
  ShutdownNotify() {
    return this.send({
      action: 'shutdown',
      room: this.myInfo.room,
      display: this.myInfo.display,
      tokenId: this.myInfo.tokenId,
    })
  }

  startPublishStreamNotification(display) {
    // let index = this.roominfo.participants.findIndex((pa) => {
    //   return pa.display === display
    // })
    // if (index>=0) {
    //   let obj = this.roominfo.participants[index]
    //   obj.role = 'admin'
    //   this.roominfo.participants[index] = obj
    // }
    return this.send({
      action: 'startPublish',
      room: this.myInfo.room,
      action_display: display,
    })
  }
  stopPublishStreamNotification(display) {
    // let index = this.roominfo.participants.findIndex((pa) => {
    //   return pa.display === display
    // })
    // if (index>=0) {
    //   let obj = this.roominfo.participants[index]
    //   obj.role = 'user'
    //   this.roominfo.participants[index] = obj
    // }
    if (this.publish.subpc) {
      this.mixStream.localSubRemoveStream() //本地流删除视频辅流
      this.unPublishsubNotify()
      this.publish.subpc = null
      this.myInfo.subDisplay = ''
    }

    if (this.publish.recordpc) {
      this.publish.recordpc = null
      this.myInfo.recordDisplay = ''
    }
    return this.send({
      action: 'stopPublish',
      room: this.myInfo.room,
      action_display: display,
    })
  }
  // 获取房间信息
  getRoomInfo() {
    return this.send({
      action: 'getRoomInfo',
      room: this.myInfo.room,
    })
  }
  sendKeepalive() {
    return this.send({
      action: 'keepalive',
    })
  }
  handleUnpublish(peer) {
    const findIndex = this.roominfo.participants.findIndex((item) => item.display === peer.display)
    this.roominfo.participants[findIndex] = peer
  }

  // 前端播放流时 500kbps 限流
  setMediaBitrates(sdp, vbit, abit) {
    return this.setMediaBitrate(this.setMediaBitrate(sdp, 'video', vbit), 'audio', abit)
  }

  setMediaBitrate(sdp, media, bitrate) {
    var lines = sdp.split('\n')
    var line = -1
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('m=' + media) === 0) {
        line = i
        break
      }
    }
    if (line === -1) {
      return sdp
    }

    // II Pass the m tine
    line++

    // II Sktp i and c lines
    while (lines[line].indexOf('i=') === 0 || lines[line].indexOf('c=') === 0) {
      line++
    }

    // II If we’re on a b line, replace it
    if (lines[line].indexOf('b') === 0) {
      lines[line] = 'b=AS:' + bitrate
      return lines.join('\n')
    }

    // II Add a new b line
    var newLines = lines.slice(0, line)
    newLines.push('b=AS:' + bitrate)
    newLines = newLines.concat(lines.slice(line, lines.length))
    return newLines.join('\n')
  }
}

export { Room }
