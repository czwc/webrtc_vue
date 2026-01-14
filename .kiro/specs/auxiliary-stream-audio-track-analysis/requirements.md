# 辅流音轨处理需求分析

## 介绍

本文档分析当前WebRTC直播系统中推辅流（屏幕共享流）时的音轨处理逻辑，特别关注当辅流中没有音轨时是否插入静音音轨的问题。

## 术语表

- **辅流 (Auxiliary Stream)**: 屏幕共享或白板共享产生的媒体流，区别于摄像头产生的主流
- **音轨 (Audio Track)**: MediaStream中的音频轨道
- **静音音轨 (Silent Audio Track)**: 不包含实际音频数据的空音频轨道
- **WebRTC PeerConnection**: 用于建立点对点连接的WebRTC API
- **Transceiver**: WebRTC中用于发送和接收媒体的收发器

## 当前实现分析

### 发现 1: 推辅流的核心方法

**位置**: `src/utils/room.js` - `publishAuxiliaryStream()` 方法（第1986行）

**流程**:
1. 停止之前的辅流轨道
2. 存储新的屏幕共享流
3. 如果之前有推辅流，先停止并清理
4. **调用 `mixAudioStream(stream)` 进行音频混流**
5. 将混流后的结果传递给 `publishsubsdp()`

### 发现 2: 音频混流逻辑

**位置**: `src/utils/room.js` - `mixAudioStream()` 方法（第2043行）

**关键代码**:
```javascript
async mixAudioStream(astream) {
    let track = this.publish.pc ? this.publish.pc.getSenders()[0].track : null
    if (track) {
        // 如果主流有音频轨道，进行混流（代码被注释掉了）
        return astream; // 直接返回原始辅流
    } else {
        return astream; // 主流没有音频流，直接返回原始辅流
    }
}
```

**结论**: 无论主流是否有音频，都**直接返回原始辅流**，没有进行实际的音频混流。

### 发现 3: 辅流SDP协商

**位置**: `src/utils/room.js` - `publishsubsdp()` 方法（第1896行）

**关键代码**:
```javascript
async publishsubsdp(isPushAudio, isPushVideo, screenStream = null) {
    this.publish.subpc = new RTCPeerConnection(null)
    // 添加音频收发器（无论是否有音轨）
    isPushAudio && this.publish.subpc.addTransceiver('audio', { direction: 'sendonly' })
    // 添加视频收发器
    isPushVideo && this.publish.subpc.addTransceiver('video', { direction: 'sendonly' })
    
    // 将流发送到远端
    this.subStreamUpdated(screenStream)
    this.subAudioStreamUpdated(screenStream)
    
    // 创建offer并发送
    let offer = await this.publish.subpc.createOffer()
    // ...
}
```

### 发现 4: 音频轨道更新逻辑

**位置**: `src/utils/room.js` - `subAudioStreamUpdated()` 方法（第2093行）

**关键代码**:
```javascript
subAudioStreamUpdated(aStream) {
    if (!this.publish.subpc) return
    var track = null
    // 只有当流存在且有音频轨道时才赋值
    aStream && aStream.getAudioTracks().length > 0 && (track = aStream.getAudioTracks()[0])
    
    var senders = this.publish.subpc.getSenders()
    var sender = senders.find((sender) => {
        return sender.track && sender.track.kind === 'audio'
    })
    
    if (!sender && senders.length >= 1) {
        sender = senders[0]
    }
    
    if (sender) {
        sender.replaceTrack(track) // track可能为null
    }
}
```

## 问题总结

### 需求 1: 辅流音轨缺失问题

**用户故事**: 作为系统开发者，我需要了解当屏幕共享流没有音轨时系统的处理方式，以便确保WebRTC连接的稳定性。

#### 验收标准

1. **当辅流没有音轨时**，系统的行为是：
   - 创建了音频transceiver（`addTransceiver('audio')`）
   - 但**没有插入静音音轨**
   - 调用 `sender.replaceTrack(null)` 将音频sender的track设置为null

2. **潜在问题**:
   - WebRTC规范允许sender的track为null，但某些浏览器或服务器可能期望有实际的音轨
   - 可能导致SDP协商异常或连接不稳定
   - 接收端可能收到空的音频流

3. **对比白板共享流**（`publishBoardsdp`方法）:
   - 白板共享时**强制获取麦克风音频**：
   ```javascript
   var stream = await navigator.mediaDevices.getUserMedia({ audio: true })
   this.subAudioStreamUpdated(stream)
   ```
   - 这说明系统认为某些场景需要确保有音频轨道

### 需求 2: 音频混流功能未实现

**用户故事**: 作为系统开发者，我发现音频混流代码被注释掉了，需要确认这是否是预期行为。

#### 验收标准

1. `mixAudioStream()` 方法中的混流逻辑被完全注释
2. 无论主流是否有音频，都直接返回原始辅流
3. 这可能导致：
   - 无法同时听到主播声音和屏幕共享的系统音
   - 功能不完整

## 需求 3: 为辅流添加静音音轨支持

**用户故事**: 作为系统开发者，我需要在推辅流时，当屏幕共享流没有音轨时自动插入一个静音音轨，以确保WebRTC连接的稳定性和兼容性，同时不影响其他功能（主流推送、白板共享等）。

### 验收标准

1. **仅影响辅流推送功能**
   - 修改只应用于 `publishAuxiliaryStream()` 方法
   - 不影响主流推送（`publishsdp()`）
   - 不影响白板共享（`publishBoardsdp()`）
   - 不影响其他音视频处理逻辑

2. **当辅流没有音轨时**
   - 系统应检测到 `stream.getAudioTracks().length === 0`
   - 自动创建一个静音音轨
   - 将静音音轨添加到辅流中
   - 正常进行SDP协商和推流

3. **当辅流有音轨时**
   - 保持原有逻辑不变
   - 使用原始的音频轨道
   - 不创建额外的静音轨道

4. **静音音轨的特性**
   - 使用AudioContext创建
   - 轨道状态为enabled=false（静音）
   - 不产生实际音频数据
   - 带宽消耗极小

5. **资源管理**
   - 静音音轨应在辅流停止时正确清理
   - 不造成内存泄漏
   - AudioContext应适当管理（复用或关闭）

6. **兼容性保证**
   - 在Chrome、Firefox、Safari、Edge浏览器中正常工作
   - 不破坏现有的屏幕共享功能
   - 不影响录制功能

### 实现约束

1. **修改范围限制**
   - 只修改 `publishAuxiliaryStream()` 方法及其直接调用的辅助方法
   - 不修改 `publishsdp()`、`publishBoardsdp()` 等其他推流方法
   - 不修改 `mixAudioStream()` 方法（保持其当前行为）

2. **向后兼容**
   - 对于已有的辅流（带音轨），行为完全不变
   - 不改变SDP协商的整体流程
   - 不影响接收端的处理逻辑

3. **代码位置**
   - 在 `publishAuxiliaryStream()` 方法中添加音轨检测和静音轨道创建逻辑
   - 可以添加独立的辅助方法 `createSilentAudioTrack()` 用于创建静音轨道

## 技术实现参考

### 创建静音音轨的标准方法

```javascript
/**
 * 创建一个静音音频轨道
 * @returns {MediaStreamTrack} 静音的音频轨道
 */
createSilentAudioTrack() {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false; // 设置为静音
    return track;
}
```

### 修改点示意

在 `publishAuxiliaryStream()` 方法中：

```javascript
async publishAuxiliaryStream(stream) {
    // ... 现有的清理逻辑 ...
    
    // 检查是否有音轨，如果没有则添加静音轨道
    if (stream.getAudioTracks().length === 0) {
        console.log('辅流没有音轨，添加静音音轨');
        const silentTrack = this.createSilentAudioTrack();
        stream.addTrack(silentTrack);
    }
    
    // ... 继续原有的推流逻辑 ...
}
```

## 测试验证计划

1. **功能测试**
   - 测试屏幕共享（不包含音频）
   - 测试屏幕共享（包含系统音频）
   - 验证静音轨道是否正确添加

2. **兼容性测试**
   - Chrome浏览器测试
   - Firefox浏览器测试
   - Safari浏览器测试（如适用）
   - Edge浏览器测试

3. **回归测试**
   - 主流推送功能正常
   - 白板共享功能正常
   - 录制功能正常
   - 音频混流功能不受影响

4. **性能测试**
   - 验证静音轨道不增加明显的CPU/内存消耗
   - 验证带宽消耗在可接受范围内
