# 辅流静音音轨插入 - 设计文档

## 概述

本设计文档描述如何在推辅流（屏幕共享）时，当流中没有音轨时自动插入静音音轨，以确保WebRTC连接的稳定性和兼容性。

## 设计目标

1. **最小化影响**: 只修改辅流推送逻辑，不影响其他功能
2. **自动检测**: 自动识别辅流是否缺少音轨
3. **资源高效**: 静音轨道消耗最小资源
4. **易于维护**: 代码清晰，逻辑独立

## 架构设计

### 修改范围

```
src/utils/room.js
├── publishAuxiliaryStream()  [修改] - 添加音轨检测和静音轨道插入逻辑
├── createSilentAudioTrack()  [新增] - 创建静音音频轨道
└── stopAuxiliaryStream()     [修改] - 清理静音轨道资源
```

### 不修改的部分

- `publishsdp()` - 主流推送
- `publishBoardsdp()` - 白板共享推送
- `mixAudioStream()` - 音频混流逻辑
- `publishsubsdp()` - SDP协商逻辑
- `subAudioStreamUpdated()` - 音频轨道更新逻辑

## 详细设计

### 1. 静音音轨创建器

**方法名**: `createSilentAudioTrack()`

**功能**: 创建一个不产生实际音频数据的静音音频轨道

**实现方案**:

```javascript
/**
 * 创建一个静音音频轨道
 * 使用AudioContext创建一个空的音频流，并将其设置为静音状态
 * @returns {MediaStreamTrack} 静音的音频轨道
 */
createSilentAudioTrack() {
    try {
        // 创建音频上下文
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 创建振荡器（但不会产生实际声音，因为track会被禁用）
        const oscillator = ctx.createOscillator();
        
        // 创建媒体流目标
        const destination = ctx.createMediaStreamDestination();
        
        // 连接振荡器到目标
        oscillator.connect(destination);
        
        // 启动振荡器
        oscillator.start();
        
        // 获取音频轨道
        const track = destination.stream.getAudioTracks()[0];
        
        // 禁用轨道（静音）
        track.enabled = false;
        
        // 存储AudioContext引用以便后续清理
        track._silentAudioContext = ctx;
        
        console.log('[辅流] 创建静音音轨成功');
        return track;
    } catch (error) {
        console.error('[辅流] 创建静音音轨失败:', error);
        return null;
    }
}
```

**设计要点**:
- 使用标准的Web Audio API
- 兼容性处理（`AudioContext` / `webkitAudioContext`）
- 轨道默认禁用（`enabled = false`）
- 存储AudioContext引用用于资源清理
- 错误处理，失败时返回null

### 2. 辅流推送逻辑修改

**方法名**: `publishAuxiliaryStream(stream)`

**修改位置**: 在调用 `mixAudioStream()` 之前

**修改逻辑**:

```javascript
async publishAuxiliaryStream(stream) {
    // 停止之前的辅流轨道
    this.screenStream && this.screenStream.getTracks().forEach((track) => track.stop())
    
    // 存储新的屏幕共享流
    this.screenStream = stream
    
    // 如果之前有推辅流，先停止
    if (this.publish.subpc) {
        this.publish.subpc.close()
        this.publish.subpc = null
    }
    
    // ========== 新增逻辑开始 ==========
    // 检查辅流是否有音轨，如果没有则添加静音轨道
    if (stream && stream.getAudioTracks().length === 0) {
        console.log('[辅流] 检测到无音轨，尝试添加静音音轨');
        const silentTrack = this.createSilentAudioTrack();
        
        if (silentTrack) {
            stream.addTrack(silentTrack);
            // 标记这是一个自动添加的静音轨道，用于后续清理
            silentTrack._isAutoAddedSilent = true;
            console.log('[辅流] 静音音轨已添加');
        } else {
            console.warn('[辅流] 静音音轨创建失败，继续使用无音轨的流');
        }
    }
    // ========== 新增逻辑结束 ==========
    
    // 继续原有的推流逻辑
    let astream = await this.mixAudioStream(stream)
    this.publishsubsdp(true, true, astream)
}
```

**设计要点**:
- 在 `mixAudioStream()` 调用之前插入检测逻辑
- 只在没有音轨时才创建静音轨道
- 标记自动添加的轨道（`_isAutoAddedSilent`）便于清理
- 即使静音轨道创建失败，也继续推流（降级处理）
- 添加详细的日志便于调试

### 3. 资源清理逻辑

**方法名**: `stopAuxiliaryStream()` 或在 `publishAuxiliaryStream()` 开始处

**清理逻辑**:

```javascript
// 在 publishAuxiliaryStream() 方法开始处的清理逻辑中添加
async publishAuxiliaryStream(stream) {
    // 停止之前的辅流轨道（包括清理静音轨道）
    if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => {
            // 如果是自动添加的静音轨道，清理AudioContext
            if (track._isAutoAddedSilent && track._silentAudioContext) {
                try {
                    track._silentAudioContext.close();
                    console.log('[辅流] 静音音轨AudioContext已清理');
                } catch (error) {
                    console.error('[辅流] 清理AudioContext失败:', error);
                }
            }
            track.stop();
        });
    }
    
    // ... 继续原有逻辑 ...
}
```

**设计要点**:
- 检查轨道是否为自动添加的静音轨道
- 关闭AudioContext释放资源
- 错误处理，避免清理失败影响主流程
- 在停止轨道前先清理AudioContext

## 数据流图

```
用户发起屏幕共享
    ↓
获取屏幕共享流 (stream)
    ↓
publishAuxiliaryStream(stream)
    ↓
检查: stream.getAudioTracks().length === 0 ?
    ├─ 是 → createSilentAudioTrack()
    │         ↓
    │      stream.addTrack(silentTrack)
    │         ↓
    └─ 否 → 使用原始流
    ↓
mixAudioStream(stream)
    ↓
publishsubsdp(true, true, stream)
    ↓
WebRTC推流
```

## 状态管理

### 新增状态标记

在MediaStreamTrack对象上添加自定义属性：

- `track._isAutoAddedSilent`: Boolean - 标记是否为自动添加的静音轨道
- `track._silentAudioContext`: AudioContext - 存储AudioContext引用用于清理

### 状态生命周期

1. **创建**: 在 `createSilentAudioTrack()` 中创建并标记
2. **使用**: 在 `publishAuxiliaryStream()` 中添加到流中
3. **清理**: 在下次推流或停止时清理AudioContext和轨道

## 错误处理

### 1. AudioContext创建失败

```javascript
try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // ...
} catch (error) {
    console.error('[辅流] 创建静音音轨失败:', error);
    return null; // 返回null，调用方继续使用无音轨的流
}
```

### 2. 轨道添加失败

```javascript
if (silentTrack) {
    stream.addTrack(silentTrack);
} else {
    console.warn('[辅流] 静音音轨创建失败，继续使用无音轨的流');
}
// 无论是否成功，都继续推流
```

### 3. 资源清理失败

```javascript
try {
    track._silentAudioContext.close();
} catch (error) {
    console.error('[辅流] 清理AudioContext失败:', error);
    // 继续清理其他资源
}
```

## 兼容性考虑

### 浏览器兼容性

| 浏览器 | AudioContext | MediaStreamTrack | 兼容性 |
|--------|--------------|------------------|--------|
| Chrome 80+ | ✓ | ✓ | 完全支持 |
| Firefox 75+ | ✓ | ✓ | 完全支持 |
| Safari 14+ | ✓ (webkit前缀) | ✓ | 需要前缀 |
| Edge 80+ | ✓ | ✓ | 完全支持 |

### 兼容性处理

```javascript
// 使用兼容性写法
const ctx = new (window.AudioContext || window.webkitAudioContext)();
```

## 性能影响分析

### CPU消耗

- AudioContext创建: 一次性，约1-2ms
- 振荡器运行: 轨道禁用后几乎无消耗
- 轨道管理: 可忽略不计

### 内存消耗

- AudioContext: 约100-200KB
- MediaStreamTrack: 约10-20KB
- 总计: 约110-220KB（可接受）

### 带宽消耗

- 静音轨道（enabled=false）: 几乎无带宽消耗
- WebRTC会优化静音轨道的传输

## 测试策略

### 单元测试

1. 测试 `createSilentAudioTrack()` 方法
   - 验证返回的是MediaStreamTrack
   - 验证轨道类型为'audio'
   - 验证轨道enabled为false
   - 验证AudioContext引用存在

2. 测试 `publishAuxiliaryStream()` 方法
   - 无音轨流 → 验证静音轨道被添加
   - 有音轨流 → 验证不添加静音轨道
   - 验证资源清理逻辑

### 集成测试

1. 屏幕共享（无音频）
   - 发起屏幕共享（不包含系统音频）
   - 验证推流成功
   - 验证接收端正常

2. 屏幕共享（有音频）
   - 发起屏幕共享（包含系统音频）
   - 验证使用原始音轨
   - 验证不创建静音轨道

3. 多次推流
   - 连续多次发起屏幕共享
   - 验证资源正确清理
   - 验证无内存泄漏

### 回归测试

1. 主流推送功能
2. 白板共享功能
3. 录制功能
4. 音频混流功能

## 风险评估

### 低风险

- ✓ 修改范围小，只影响辅流推送
- ✓ 有降级处理，失败不影响主流程
- ✓ 使用标准Web API，兼容性好

### 中风险

- ⚠ AudioContext可能在某些浏览器有限制（如需要用户交互）
  - **缓解**: 屏幕共享本身需要用户交互，满足条件
  
- ⚠ 静音轨道可能被某些服务器拒绝
  - **缓解**: 轨道是有效的MediaStreamTrack，符合WebRTC规范

### 高风险

- 无

## 实施计划

### 阶段1: 核心功能实现（1-2小时）

1. 实现 `createSilentAudioTrack()` 方法
2. 修改 `publishAuxiliaryStream()` 方法
3. 添加资源清理逻辑

### 阶段2: 测试验证（1-2小时）

1. 本地功能测试
2. 多浏览器兼容性测试
3. 回归测试

### 阶段3: 优化和文档（0.5-1小时）

1. 代码审查和优化
2. 添加注释
3. 更新相关文档

**总计**: 约3-5小时

## 回滚计划

如果实施后出现问题，可以快速回滚：

1. 移除 `createSilentAudioTrack()` 方法
2. 移除 `publishAuxiliaryStream()` 中的音轨检测逻辑
3. 移除资源清理逻辑中的AudioContext清理代码

回滚影响：恢复到原有行为（辅流无音轨时不添加静音轨道）

## 后续优化建议

1. **AudioContext复用**: 考虑复用AudioContext而不是每次创建新的
2. **配置化**: 添加配置项控制是否启用静音轨道插入
3. **监控**: 添加性能监控，跟踪静音轨道的使用情况
4. **音频混流**: 未来可以考虑实现真正的音频混流功能

