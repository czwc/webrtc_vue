<template>
  <div class="room-user-list">
    <!-- 统计信息头部 -->
    <div class="user-stats-header">
      <div class="stats-item">
        <span class="stats-label">总人数:</span>
        <span class="stats-value">{{ totalUsers }}</span>
      </div>
      <div class="stats-item">
        <!-- <span class="stats-label">推流中:</span>
        <span class="stats-value publishing">{{ publishingUsers }}</span> -->
      </div>
      <div class="stats-item">
        <span class="stats-label">主持人:</span>
        <span class="stats-value admin">{{ adminUsers }}</span>
      </div>
    </div>
    
    <div class="user-list-content">
      <div class="user-item" :key="index" v-for="(user, index) in participants">
        <div class="user-info">
          <div class="user-avatar" :class="getUserAvatarClass(user)">
            {{ getUserInitial(user.username) }}
          </div>
          <div class="user-details">
            <div class="user-name" :title="user.username">
              {{ user.username }}
              <span v-if="user.display === self.display" class="self-tag">（我）</span>
            </div>
            <div class="user-status">
              <span class="user-id">{{ user.display }}</span>
              <span class="role-tag" :class="user.role">{{ getRoleText(user.role) }}</span>
              <span v-if="user.publishing" class="status-tag publishing">推流中</span>
              <span v-if="user.audiomuted" class="status-tag muted">静音</span>
              <span v-if="user.videomuted" class="status-tag video-off">关闭视频</span>
            </div>
          </div>
        </div>
        <div class="operate">
          <el-button
            style="margin-left:10px"
            title="分享屏幕"
            type="primary"
            size="mini"
            @click="ScreenShare()"
            v-if="user.display === self.display"
          >
            屏幕分享
          </el-button>

          <el-button
            title="全部静音"
            type="primary"
            size="mini"
            @click="muteall()"
          >
            全部静音
          </el-button>

          <el-button
            title="全部解除静音"
            type="primary"
            size="mini"
            @click="unmuteall()"
          >
            全部解除静音
          </el-button>

          <el-button
            title="点击静音"
            v-if="!user.audiomuted && user.username !== self.username"
            type="primary"
            size="mini"
            @click="mute(user)"
          >
            静音
          </el-button>

          <el-button
            v-if="user.audiomuted && user.username !== self.username"
            title="解除静音"
            type="primary"
            size="mini"
            @click="unMute(user)"
          >
            解除静音
          </el-button>

          <el-button
            title="打开视频"
            v-if="
              user.display === self.display &&
                user.videomuted &&
                user.publishing &&
                room.publish.isLocalVideoMuted
            "
            type="primary"
            size="mini"
            @click="unMuteLocal('video')"
          >
            打开视频
          </el-button>
          <el-button
            title="关闭视频"
            v-if="
              user.display === self.display &&
                !user.videomuted &&
                user.publishing &&
                !room.publish.isLocalVideoMuted
            "
            type="primary"
            size="mini"
            @click="muteLocal('video')"
          >
            关闭视频
          </el-button>
          <el-button
            title="直播切换"
            v-if="user.role  === 'user'&&self.role === 'admin'"
            type="primary"
            size="mini"
            @click="publishStream(user.display)"
          >
            直播切换
          </el-button>
          <el-button
            title="本地静音"
            v-if="user.display === self.display && !self.audiomuted"
            type="primary"
            size="mini"
            @click="muteLocal('audio')"
          >
            本地静音
          </el-button>
          <el-button
            title="本地解除静音"
            v-if="user.display === self.display && self.audiomuted"
            type="primary"
            size="mini"
            @click="unMuteLocal('audio')"
          >
            本地解除静音
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import axios from 'axios'
export default {
  data() {
    return {}
  },
  components: {},
  props: {
    hasPermission: {
      type: Boolean,
      default: false
    },
    allUsers: {
      type: Array,
      default() {
        return []
      }
    }
  },
  computed: {
    ...mapState({
      deviceInfo: state => state.main.deviceInfo,
      room: state => state.main.room,
      self: state => state.main.room.roominfo.self,
      participants: state => state.main.room.roominfo.participants
    }),
    isPresenter() {
      return this.self.role === 'presenter'
    },
    // 统计信息
    totalUsers() {
      return this.participants ? this.participants.length : 0
    },
    publishingUsers() {
      return this.participants ? this.participants.filter(user => user.publishing).length : 0
    },
    adminUsers() {
      return this.participants ? this.participants.filter(user => user.role === 'admin').length : 0
    }
  },
  watch: {
    // 监听参与者列表变化，实时更新统计
    participants: {
      handler(newParticipants, oldParticipants) {
        if (newParticipants && oldParticipants) {
          // 检查是否有用户加入或离开
          const newCount = newParticipants.length;
          const oldCount = oldParticipants.length;
          
          if (newCount !== oldCount) {
            console.log(`用户数量变化: ${oldCount} -> ${newCount}`);
            this.logUserChanges(newParticipants, oldParticipants);
          }
          
          // 检查推流状态变化
          this.checkPublishingChanges(newParticipants, oldParticipants);
          
          // 检查角色变化
          this.checkRoleChanges(newParticipants, oldParticipants);
        }
      },
      deep: true, // 深度监听，检测对象内部属性变化
      immediate: false
    }
  },
  methods: {
    // 获取用户头像样式类
    getUserAvatarClass(user) {
      const classes = []
      if (user.role === 'admin') classes.push('admin')
      if (user.publishing) classes.push('publishing')
      if (user.display === this.self.display) classes.push('self')
      return classes
    },
    
    // 获取用户名首字母
    getUserInitial(username) {
      if (!username) return '?'
      // 如果是中文，取第一个字符
      if (/[\u4e00-\u9fa5]/.test(username)) {
        return username.charAt(0)
      }
      // 如果是英文，取首字母大写
      return username.charAt(0).toUpperCase()
    },
    
    // 获取角色文本
    getRoleText(role) {
      const roleMap = {
        'admin': '主持人',
        'user': '观众',
        'presenter': '讲师'
      }
      return roleMap[role] || role
    },
    
    // 记录用户变化
    logUserChanges(newParticipants, oldParticipants) {
      const newUsers = newParticipants.filter(newUser => 
        !oldParticipants.find(oldUser => oldUser.display === newUser.display)
      );
      
      const leftUsers = oldParticipants.filter(oldUser => 
        !newParticipants.find(newUser => newUser.display === oldUser.display)
      );
      
      newUsers.forEach(user => {
        console.log(`👋 用户加入: ${user.username} (${user.display}) - 角色: ${user.role}`);
      });
      
      leftUsers.forEach(user => {
        console.log(`👋 用户离开: ${user.username} (${user.display}) - 角色: ${user.role}`);
      });
    },
    
    // 检查推流状态变化
    checkPublishingChanges(newParticipants, oldParticipants) {
      newParticipants.forEach(newUser => {
        const oldUser = oldParticipants.find(u => u.display === newUser.display);
        if (oldUser && oldUser.publishing !== newUser.publishing) {
          const status = newUser.publishing ? '开始推流' : '停止推流';
          console.log(`📹 ${newUser.username} ${status}`);
          
          // 可以在这里添加消息提示
          if (this.$message) {
            this.$message({
              message: `${newUser.username} ${status}`,
              type: newUser.publishing ? 'success' : 'info',
              duration: 2000
            });
          }
        }
      });
    },
    
    // 检查角色变化
    checkRoleChanges(newParticipants, oldParticipants) {
      newParticipants.forEach(newUser => {
        const oldUser = oldParticipants.find(u => u.display === newUser.display);
        if (oldUser && oldUser.role !== newUser.role) {
          console.log(`👑 ${newUser.username} 角色变化: ${oldUser.role} -> ${newUser.role}`);
          
          // 可以在这里添加消息提示
          if (this.$message) {
            const roleText = this.getRoleText(newUser.role);
            this.$message({
              message: `${newUser.username} 成为${roleText}`,
              type: 'warning',
              duration: 3000
            });
          }
        }
      });
    },
    
    openStudentVideo(display){
      this.room.openVideo(display)
    },
    closeStudentVideo(display){
      this.room.closeVideo(display)
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
        })
        .catch(function(error) {
          console.log(error)
        })
      // this.room.ShutdownNotify()
    },
    muteLocal(kind) {
      this.$store.dispatch('MuteLocal', kind)
    },
    unMuteLocal(kind) {
      this.$store.dispatch('UnMuteLocal', kind)
    },
    async ScreenShare() {
      // 当前先不获取音频，后续可以考虑放开
      this.dialogVisible = false
      let stream = await this.room.startCaptureScreen(true)
      this.$store.dispatch('ShareScreenStream', stream)
    },
    mute(user) {
      this.$store.dispatch('Mute', user.display)
    },
    unMute(user) {
      this.$store.dispatch('UnMute', user.display)
    },
    muteall() {
      this.$store.dispatch('MuteAll')
    },
    unmuteall() {
      this.$store.dispatch('UnMuteAll')
    },
    publishStream(display) {
      if (this.participants.length) {
        //找到正在推流的那个人，通知他关流
        this.participants.forEach(e => {
          if (e.role == 'admin'&&e.publishing) {
            this.room.stopPublishStreamNotification(e.display)
          }
        })
      }
      setTimeout(() => {
        this.room.startPublishStreamNotification(display)
      }, 500)
    },
    upgradeRole(user) {
      this.$store.dispatch('UpgradeRole', user.display)
    }
  },
  mounted() {}
}
</script>

<style lang="scss">
.room-user-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  
  // 统计信息头部
  .user-stats-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    
    .stats-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .stats-label {
        font-size: 11px;
        opacity: 0.8;
        margin-bottom: 2px;
      }
      
      .stats-value {
        font-size: 16px;
        font-weight: bold;
        
        &.publishing {
          color: #00ff88;
        }
        
        &.admin {
          color: #ffd700;
        }
      }
    }
  }
  
  // 用户列表内容区域
  .user-list-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
    
    // 自定义滚动条
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
      
      &:hover {
        background: #a8a8a8;
      }
    }
  }
  
  // 用户项
  .user-item {
    background: white;
    border-radius: 8px;
    margin-bottom: 8px;
    padding: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  // 用户信息区域
  .user-info {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      color: white;
      margin-right: 12px;
      flex-shrink: 0;
      
      &.admin {
        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      }
      
      &.publishing {
        background: linear-gradient(135deg, #00d2d3, #54a0ff);
        animation: pulse 2s infinite;
      }
      
      &.self {
        border: 2px solid #ffd700;
      }
    }
    
    .user-details {
      flex: 1;
      min-width: 0; // 防止文本溢出
      
      .user-name {
        font-size: 14px;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        
        .self-tag {
          color: #ffd700;
          font-size: 12px;
          margin-left: 4px;
        }
      }
      
      .user-status {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        
        .user-id {
          font-size: 10px;
          color: #7f8c8d;
          background: #ecf0f1;
          padding: 2px 6px;
          border-radius: 10px;
        }
        
        .role-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
          
          &.admin {
            background: #ff6b6b;
            color: white;
          }
          
          &.user {
            background: #74b9ff;
            color: white;
          }
          
          &.presenter {
            background: #00b894;
            color: white;
          }
        }
        
        .status-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
          
          &.publishing {
            background: #00d2d3;
            color: white;
            animation: blink 1.5s infinite;
          }
          
          &.muted {
            background: #fdcb6e;
            color: #2d3436;
          }
          
          &.video-off {
            background: #e17055;
            color: white;
          }
        }
      }
    }
  }
  
  // 操作按钮区域
  .operate {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    
    .el-button--mini {
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 4px;
      margin: 0;
    }
  }
  
  // 动画效果
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(0, 210, 211, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(0, 210, 211, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(0, 210, 211, 0);
    }
  }
  
  @keyframes blink {
    0%, 50% {
      opacity: 1;
    }
    51%, 100% {
      opacity: 0.6;
    }
  }
}

// 移动端适配
@media screen and (max-width: 768px) {
  .room-user-list {
    .user-stats-header {
      padding: 8px 12px;
      
      .stats-item {
        .stats-label {
          font-size: 10px;
        }
        
        .stats-value {
          font-size: 14px;
        }
      }
    }
    
    .user-list-content {
      padding: 6px;
    }
    
    .user-item {
      padding: 8px;
      margin-bottom: 6px;
    }
    
    .user-info {
      .user-avatar {
        width: 32px;
        height: 32px;
        font-size: 14px;
        margin-right: 8px;
      }
      
      .user-details {
        .user-name {
          font-size: 13px;
        }
        
        .user-status {
          .user-id,
          .role-tag,
          .status-tag {
            font-size: 9px;
            padding: 1px 4px;
          }
        }
      }
    }
    
    .operate {
      .el-button--mini {
        padding: 2px 6px;
        font-size: 10px;
      }
    }
  }
}
</style>
