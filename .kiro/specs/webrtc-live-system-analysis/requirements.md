# WebRTC直播系统 - 项目分析文档

## 项目概述

这是一个基于WebRTC技术的实时音视频直播系统,支持多人视频会议、屏幕共享、角色管理等功能。系统采用Vue.js + Vuex架构,通过WebSocket信令服务器进行连接协商和状态同步。

---

## 核心架构分析

### 1. 技术栈

- **前端框架**: Vue.js 2.x + Vuex
- **UI组件**: Element UI
- **实时通信**: WebRTC (RTCPeerConnection)
- **信令协议**: WebSocket
- **状态管理**: Vuex Store
- **音视频处理**: Web Audio API, MediaStream API

### 2. 核心模块

#### 2.1 Room类 (`src/utils/room.js`)
**职责**: WebRTC房间管理核心类,继承自EventEmitter

**关键属性**:
- `players`: Map结构,存储所有远端播放器(拉流)
- `publish`: 本地推流相关状态(pc, subpc, recordpc)
- `roominfo`: 房间信息(参与者列表、房间状态)
- `myInfo`: 当前用户信息(display, role, username)
- `mixStream`: 混流管理器
- `deviceInfo`: 设备信息管理器

**核心流程**:

```
1. 连接流程:
   connect() → createWebSocket() → join() → playallsdp()
   
2. 推流流程:
   publishsdp() → startPublish() → publishNotify()
   
3. 拉流流程:
   playallsdp() → playsdp() → startPlay()
   
4. 辅流流程:
   publishAuxiliaryStream() → publishsubsdp() → publishsubNotify()
```

#### 2.2 MixStream类 (混流管理)
**职责**: 管理本地和远端音视频流的混合与分发

**关键功能**:
- `localAudioStream`: 本地音频流
- `localVideoStream`: 本地视频流
- `playVideoStream`: Map结构,存储所有播放的视频流
- `playAudioStream`: 播放的音频流

#### 2.3 HelloWorld.vue (主界面组件)
**职责**: 直播间UI交互和视频渲染

**核心功能**:
- 视频网格布局(分页显示)
- 辅流独立显示区域
- 设备检测弹窗
- 移动端适配
- 视频健康检查机制

---

## 关键流程详解

### 3.1 加入直播间流程

```javascript
// 1. 用户点击"加入直播"
JoinLive() {
  // 获取信令服务器地址
  axios.post('/backend/v1/signaling/query', { roomId })
  
  // 获取token
  axios.post('/backend/v1/createToken', { 
    roomId, username, role, groupIds 
  })
  
  // 连接WebSocket并加入房间
  room.connect(url, roomId, role, display, tokenId, deviceInfo)
}

// 2. Room类处理连接
connect() {
  createWebSocket(display)  // 建立WebSocket连接
    → ws.onopen → join()    // 发送join消息
    → onresponse('join')    // 收到服务器响应
    → playallsdp()          // 自动拉取所有流
}
```

### 3.2 推流流程 (发布音视频)

```javascript
// 1. 用户点击"开始推流"
StartPublish() {
  deviceCheckVisible = true  // 打开设备检测弹窗
  startPreview()             // 预览摄像头和麦克风
}

// 2. 确认推流
confirmPublish() {
  room.publishsdp(true, true)  // 协商推流SDP
}

// 3. Room类处理推流
publishsdp(isPushAudio, isPushVideo) {
  // 创建RTCPeerConnection
  publish.pc = new RTCPeerConnection()
  
  // 添加收发器
  pc.addTransceiver('audio', { direction: 'sendonly' })
  pc.addTransceiver('video', { direction: 'sendonly' })
  
  // 获取本地媒体流
  stream = await navigator.mediaDevices.getUserMedia(constraints)
  
  // 根据角色限制码率
  if (role == 'user') {
    // 观众: 160x90, 15fps, 50kbps
  } else {
    // 主持人: 1280x720, 30fps
  }
  
  // 创建Offer并发送
  offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  send({ action: 'publishsdp', sdp: offer.sdp })
}

// 4. 收到服务器Answer
onresponse('publishsdp') {
  publish.remote_sdp = msg.sdp
  startPublish('main')  // 设置远端SDP
    → publishNotify()   // 通知其他人拉流
}
```

### 3.3 拉流流程 (接收远端音视频)

```javascript
// 1. 自动拉取所有流
playallsdp() {
  // 遍历所有参与者
  roominfo.participants.forEach(p => {
    if (p.publishing && p.display !== self.display) {
      // 创建播放器
      player = {
        pc: new RTCPeerConnection(),
        display: p.display,
        stream: new MediaStream()
      }
      
      // 添加接收器
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.addTransceiver('video', { direction: 'recvonly' })
      
      // 监听track事件
      pc.ontrack = (event) => {
        mixStream.playAddTrack(event.track, p.display)
      }
      
      // 发送拉流请求
      playsdp(player)
      players.set(player.display, player)
    }
  })
}

// 2. 收到服务器Answer
onresponse('playsdp') {
  player.remote_sdp = msg.sdp
  startPlay(player)  // 设置远端SDP,开始接收流
}

// 3. 视频流更新通知
playVideoStreamUpdated(vStream) {
  // 触发Vue组件更新
  emit('play-video-stream-updated', vStream)
}

// 4. Vue组件渲染视频
// HelloWorld.vue
playVideoStreamUpdated(vStream) {
  // 遍历视频流Map
  vStream.forEach((stream, key) => {
    // 设置video元素的srcObject
    videoElement.srcObject = stream
    
    // 启动视频健康检查
    startVideoHealthCheck(key)
  })
}
```

### 3.4 辅流(屏幕共享)流程

```javascript
// 1. 用户点击"推辅流"
auxiliaryStream() {
  // 获取屏幕共享流
  stream = await room.startCaptureScreen(true)
  
  // 发布辅流
  room.publishAuxiliaryStream(stream)
}

// 2. Room类处理辅流
publishAuxiliaryStream(stream) {
  // 混合音频流(主流音频+辅流音频)
  mixedStream = await mixAudioStream(stream)
  
  // 创建辅流PeerConnection
  publish.subpc = new RTCPeerConnection()
  
  // 生成辅流display ID
  myInfo.subDisplay = generateRandomId()
  
  // 监听辅流关闭
  stream.getVideoTracks()[0].onended = () => {
    unPublishsubNotify()  // 通知停止辅流
    subpc.close()
  }
  
  // 协商辅流SDP
  publishsubsdp(true, true, mixedStream)
}

// 3. 辅流独立显示
// HelloWorld.vue中辅流单独渲染在右侧区域
<div class="sub-streams-section">
  <video :ref="'subVideoStream_' + subStream.key"></video>
</div>
```

---

## 核心机制详解

### 4.1 信令协议

**WebSocket消息格式**:
```javascript
{
  tid: "随机事务ID",
  msg: {
    action: "操作类型",
    room: "房间ID",
    display: "用户标识",
    tokenId: "认证token",
    // ... 其他参数
  }
}
```

**主要信令消息**:

| Action | 方向 | 说明 |
|--------|------|------|
| join | C→S | 加入房间 |
| publishsdp | C→S | 推流SDP协商 |
| publish | C→S | 推流通知 |
| playsdp | C→S | 拉流SDP协商 |
| unpublish | C→S | 停止推流 |
| mute/unmute | C→S | 静音控制 |
| shutdown | C→S | 结束直播 |
| localstatenotify | C→S | 本地状态通知 |

**事件通知** (服务器主动推送):

| Event | 说明 |
|-------|------|
| publish | 有人开始推流 |
| unpublish | 有人停止推流 |
| join | 有人加入房间 |
| leave | 有人离开房间 |
| publishsub | 有人推辅流 |
| unpublishsub | 有人停止辅流 |

### 4.2 角色权限管理

**角色类型**:
- `admin`: 主持人 - 高清推流(1280x720@30fps)
- `user`: 观众 - 低清推流(160x90@15fps, 50kbps限速)

**权限控制**:
```javascript
// 推流时根据角色限制码率
if (myInfo.role == 'user') {
  constraints.video.width = { ideal: 160, max: 160 }
  constraints.video.height = { ideal: 90, max: 90 }
  constraints.video.frameRate = { ideal: 15, max: 15 }
  offer.sdp = setMediaBitrates(offer.sdp, 50, 49)  // 视频50kbps, 音频49kbps
}
```

### 4.3 视频健康检查机制

**目的**: 检测视频流卡顿、黑屏,自动恢复

**核心逻辑**:
```javascript
// 1. 启动健康检查
startVideoHealthCheck(videoKey) {
  timer = setInterval(() => {
    checkVideoHealth(videoKey)
  }, 5000)  // 每5秒检查一次
}

// 2. 检查视频状态
checkVideoHealth(videoKey) {
  const isPlaying = !video.paused && !video.ended && video.readyState > 2
  const hasError = video.error !== null
  const timeSinceLastPlay = now - lastPlayingTime
  
  if (hasError || timeSinceLastPlay > 15000) {
    handleVideoStreamError(videoKey, 'timeout')
  }
}

// 3. 错误恢复
handleVideoStreamError(videoKey, errorType) {
  // 检查恢复冷却时间和最大尝试次数
  if (now - lastRecoveryTime < 10000) return
  if (recoveryCount >= 3) return
  
  // 重新设置流
  videoElement.srcObject = null
  setTimeout(() => {
    videoElement.srcObject = stream
    videoElement.play()
  }, 500)
}
```

### 4.4 性能优化策略

**1. 分页显示**:
```javascript
// 只渲染当前页的视频
v-if="index >= page && index < page + limit"

// 默认每页6个,可配置
limit: 6
```

**2. 懒加载流**:
```javascript
// 只为可见视频设置流和健康检查
getVisibleVideoKeys() {
  return streamArray.slice(this.page, this.page + this.limit)
}

setupVisibleStreams() {
  visibleKeys.forEach(key => {
    videoElement.srcObject = stream
    startVideoHealthCheck(key)
  })
}
```

**3. 清理不可见视频**:
```javascript
cleanupInvisibleHealthChecks() {
  allKeys.forEach(key => {
    if (!visibleKeys.includes(key)) {
      stopVideoHealthCheck(key)
    }
  })
}
```

**4. 避免重复渲染**:
```javascript
// 跟踪之前的流状态
previousVideoStreams: new Map()

// 只处理变化的流
if (!previousStream || previousStream.id !== value.id) {
  videoElement.srcObject = value
}
```

### 4.5 移动端适配

**响应式布局**:
```css
@media (max-width: 768px) {
  .videoStyle {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  
  .control-panel {
    flex-direction: column !important;
  }
  
  .live-drawer {
    height: 80%;
    direction: btt;  /* bottom to top */
  }
}
```

**移动端特性**:
- 自动播放策略处理
- 触摸友好的UI
- 视频点击全屏
- 调试面板

---

## 状态管理 (Vuex)

### Store结构

```javascript
// src/store/main.js
state: {
  room: new Room(),           // Room实例
  room_options: {             // 房间配置
    roomid, host, port, schema, tokenId, display, role
  },
  deviceInfo: new DeviceInfo(),  // 设备管理
  micCheck: new MicCheck()       // 麦克风检测
}

mutations: {
  SET_TOKENID,
  MUTE, UNMUTE,
  MUTE_LOCAL, UNMUTE_LOCAL,
  MUTEALL, UNMUTEALL,
  SHARE_SCREEN_STREAM
}

actions: {
  Connect,      // 连接WebSocket
  Disconnect,   // 断开连接
  Mute/UnMute,  // 静音控制
  ShareScreenStream  // 屏幕共享
}
```

### 数据流向

```
用户操作 → Vue组件方法 
  → Vuex Action 
  → Room类方法 
  → WebSocket发送 
  → 服务器处理 
  → WebSocket接收 
  → Room类事件触发 
  → Vue组件监听更新 
  → UI重新渲染
```

---

## 关键API调用

### 后端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /backend/v1/signaling/query | POST | 获取信令服务器地址 |
| /backend/v1/createToken | POST | 创建房间token |
| /backend/v1/createRoom | POST | 创建直播间 |
| /sig/v1/room/shutdown | POST | 关闭直播间 |

### WebRTC API

```javascript
// 创建PeerConnection
pc = new RTCPeerConnection(config)

// 添加收发器
pc.addTransceiver('audio', { direction: 'sendonly' })

// 获取媒体流
stream = await navigator.mediaDevices.getUserMedia(constraints)

// 创建Offer/Answer
offer = await pc.createOffer()
await pc.setLocalDescription(offer)
await pc.setRemoteDescription(answer)

// 监听track
pc.ontrack = (event) => { ... }

// 监听连接状态
pc.onconnectionstatechange = (event) => { ... }
```

---

## 常见问题与解决方案

### 1. 视频黑屏/卡顿
**原因**: 
- 流未正确设置
- 网络波动导致track ended
- 浏览器自动播放策略

**解决**:
- 视频健康检查机制自动恢复
- 监听track.onended重新拉流
- 用户交互后播放

### 2. 移动端自动播放失败
**原因**: 浏览器自动播放策略限制

**解决**:
```javascript
// 添加播放按钮
addPlayButton(videoElement) {
  playButton.onclick = async () => {
    await videoElement.play()
  }
}
```

### 3. 辅流音频混流
**原因**: 需要同时推送主流音频和辅流音频

**解决**:
```javascript
mixAudioStream(auxiliaryStream) {
  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()
  
  // 混合主流和辅流音频
  mainAudioSource.connect(destination)
  subAudioSource.connect(destination)
  
  return destination.stream
}
```

### 4. 性能优化
**问题**: 多人直播时视频过多导致卡顿

**解决**:
- 分页显示(默认6个/页)
- 懒加载流(只处理可见视频)
- 清理不可见视频的健康检查
- 避免重复渲染

---

## 总结

这是一个功能完善的WebRTC直播系统,核心特点:

✅ **完整的信令流程**: WebSocket + 自定义协议
✅ **多流管理**: 主流、辅流、录制流分离
✅ **角色权限**: 主持人/观众差异化推流
✅ **健康检查**: 自动检测和恢复视频流
✅ **性能优化**: 分页、懒加载、避免重复渲染
✅ **移动端适配**: 响应式布局、触摸优化
✅ **设备管理**: 摄像头、麦克风、扬声器切换

**后续优化方向**:
1. 添加更多布局模式(画廊模式、演讲者模式)
2. 优化网络自适应(根据带宽动态调整码率)
3. 添加美颜、虚拟背景等特效
4. 支持录制回放
5. 添加聊天、白板等协作功能
