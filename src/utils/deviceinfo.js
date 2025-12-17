import events from 'events'

class DeviceInfo extends events {
  constructor() {
    super()
    this.audioInputDeviceId = localStorage.getItem('audioInputDeviceId') || ''
    this.audioInputDeviceGroupId = ''
    this.videoInputDeviceId = localStorage.getItem('videoInputDeviceId') || ''
    this.videoInputDeviceGroupId = ''
    this.audioOutputDeviceId = localStorage.getItem('audioOutputDeviceId') || ''
    this.audioOutputDeviceGroupId = ''

    this.clear()

    this.audioOption = {
      sampleRate: 8000,
      channelCount: {
        ideal: 1,
      }, // 单通道
      autoGainControl: true, // 自动增益
      echoCancellation: true, // 回音消除
      latency: 0, // 延迟
      noiseSuppression: true, // 噪音消除
    }
    this.videoOption = {
      aspectRatio: 16 / 9, // 宽高比
      frameRate: 16, // 帧率
      // width: 160, // 宽  160 920  1840
      // height: 90, // 高 90 540  1080
    }
    this.started = false
    this.speaker = {
      volume: 1
    }
    this.microphone = {
      volume: 1
    }
  }
  // 设置扬声器音量
  setSpeakerVolume(volume) {
    if (volume < 0.1 || volume > 1) return
    this.speaker.volume = volume
  }
  // 设置麦克风音量
  setMicrophoneVolume(volume) {
    if (volume < 0 || volume > 1) return
    this.microphone.volume = volume
    this.emit('microphone-volume-updated') //reset stream
  }
  getPushConstraints() {
    var constraints = {
      audio: false,
      video: false
    }

    if (this.videoInputDevice) {
      constraints.video = Object.assign({}, this.videoOption, {
        deviceId: { exact: this.videoInputDevice.deviceId }
      });
    } else {
      constraints.video = this.videoOption;
    }

    if (this.audioInputDevice) {
      constraints.audio = Object.assign({}, this.audioOption, {
        deviceId: { exact: this.audioInputDevice.deviceId }
      });
    } else {
      constraints.audio = this.audioOption;
    }

    return constraints
  }
  //只开始采集音频或者视频，不能同时采集两者，一般是用在正在推流的时候, 交互性需要
  async startCaptureSingle(kind) {
    let constraints = {
      audio: false,
      video: false
    }
    let stream = null

    if (kind === 'audio') {
      constraints = this.genAudioConstraints()
      if (!constraints.audio) {
        console.log(
          "you can't get audio while audio device not available!!!!!!!!!!!!!!!!!!!!!!"
        )
        return null
      }
    }

    if (kind === 'video') {
      constraints = this.getPushConstraints()
      constraints.video.width = '1280'
      constraints.video.height = '720'
      console.log(constraints, 'constraints')
      if (!constraints.video) {
        console.log(
          "you can't get video while audio device not available!!!!!!!!!!!!!!!!!!!!!!"
        )
        return null
      }
    }

    if (!!constraints.audio || !!constraints.video) {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
      return stream
    }

    return null
  }

  clear() {
    this.audioInputDevices = []
    this.audioInputDevice = null
    this.videoInputDevices = []
    this.videoInputDevice = null
    this.audioOutputDevices = []
    this.audioOutputDevice = null
  }

  // 重新刷新麦克风
  refreshAudioInput(device, groupId, id) {
    this.audioInputDeviceId = id
    localStorage.setItem('audioInputDeviceId', id)
    this.audioInputDevice = device
    if (this.audioInputDeviceGroupId !== groupId) {
      this.audioInputDeviceGroupId = groupId
      this.emit('audio-input-updated') //reset stream
    }
  }

  // 重新刷新摄像头
  refreshVideoInput(device, groupId, id) {
    this.videoInputDeviceId = id
    localStorage.setItem('videoInputDeviceId', id)
    this.videoInputDevice = device
    if (this.videoInputDeviceGroupId !== groupId) {
      // console.log(device, groupId, id,'刷新摄像头');
      this.videoInputDeviceGroupId = groupId
      this.emit('video-input-updated') //reset stream
    }
  }

  // 重新扬声器
  refreshAudioOutput(device, groupId, id) {
    this.audioOutputDeviceId = id
    localStorage.setItem('audioOutputDeviceId', id)
    this.audioOutputDevice = device
    if (this.audioOutputDeviceGroupId !== groupId) {
      this.audioOutputDeviceGroupId = groupId
      this.emit('audio-output-updated') //reset stream
    }
  }

  // 重新刷新 groupid，deviceid，device
  refreshDevices() {
    //查找device是否存在
    var index = this.audioInputDevices.findIndex(d => {
      return this.audioInputDeviceId === d.deviceId
    })
    if (this.audioInputDeviceId !== 'default') {
      if (index === -1) {
        //选定的其他的不存在，设置为default
        index = this.audioInputDevices.findIndex(d => {
          return d.deviceId === 'default'
        })
      }
    }
    if (index === -1) {
      //default找不到了,说明可能输入不存在了
      this.refreshAudioInput(null, '', 'default')
    } else {
      this.refreshAudioInput(
        this.audioInputDevices[index],
        this.audioInputDevices[index].groupId,
        this.audioInputDevices[index].deviceId
      )
    }

    //查找device是否存在
    index = this.videoInputDevices.findIndex(d => {
      return this.videoInputDeviceId === d.deviceId
    })
    if (index === -1) {
      //选定的其他的不存在，设置为default
      index = this.videoInputDevices.findIndex(d => {
        return d.deviceId === 'default'
      })
      if (index === -1 && this.videoInputDevices.length !== 0) {
        index = 0
      }
    }
    if (index === -1) {
      //default找不到了,说明可能输入不存在了
      this.refreshVideoInput(null, '', 'default')
    } else {
      this.refreshVideoInput(
        this.videoInputDevices[index],
        this.videoInputDevices[index].groupId,
        this.videoInputDevices[index].deviceId
      )
    }

    //查找device是否存在
    index = this.audioOutputDevices.findIndex(d => {
      return this.audioOutputDeviceId === d.deviceId
    })
    if (this.audioOutputDeviceId !== 'default') {
      if (index === -1) {
        //选定的其他的不存在，设置为default
        index = this.audioOutputDevices.findIndex(d => {
          return d.deviceId === 'default'
        })
      }
    }
    if (index === -1) {
      //default找不到了,说明可能输入不存在了
      this.refreshAudioOutput(null, '', 'default')
    } else {
      this.refreshAudioOutput(
        this.audioOutputDevices[index],
        this.audioOutputDevices[index].groupId,
        this.audioOutputDevices[index].deviceId
      )
    }
  }

  // 同时获取音视频流constraints
  genConstraints(isAudio, isVideo) {
    var constraints = {
      audio: false,
      video: false
    }

    constraints.audio = isAudio && !!this.audioInputDevice
    constraints.video = isVideo && !!this.videoInputDevice

    if (constraints.audio) {
      constraints.audio = Object.assign({}, this.audioOption, {
        deviceId: { exact: this.audioInputDevice.deviceId }
      });
    }

    if (constraints.video) {
      constraints.video = Object.assign({}, this.videoOption, {
        deviceId: { exact: this.videoInputDevice.deviceId }
      });
    }

    console.log(constraints, '推流参数')

    return constraints
  }

  // 只获取音频流的constraints
  genAudioConstraints() {
    var constraints = {
      audio: false,
      video: false
    }

    constraints.audio = !!this.audioInputDevice
    if (constraints.audio) {
      constraints.audio = Object.assign({}, this.audioOption, {
        deviceId: { exact: this.audioInputDevice.deviceId }
      });
    }
    return constraints
  }
  // 只获取视频流的constraints
  genVideoConstraints() {
    var constraints = {
      audio: false,
      video: false
    }

    if (this.videoInputDevice) {
      constraints.video = Object.assign({}, this.videoOption, {
        deviceId: { exact: this.videoInputDevice.deviceId }
      });
    } else {
      constraints.video = this.videoOption;
    }

    return constraints
  }

  // 获取设备列表，更新设备列表信息
  async deviceChange() {
    try {
      var devices = await navigator.mediaDevices.enumerateDevices()
      console.log(devices, '设备列表');
      var needAskAudio = false
      var needAskVideo = false
      var hasVideoDevice = false
      var hasAudioDevice = false
      if (devices.some(e => {
        return e.kind === 'videoinput'
      })) {
        hasVideoDevice = true
      }
      if (devices.some(e => {
        return e.kind === 'audioinput'
      })) {
        hasAudioDevice = true
      }
      if (
        devices.findIndex(d => {
          return d.label === '' && d.kind === 'audioinput'
        }) !== -1
      ) {
        needAskAudio = true
      }
      if (
        devices.findIndex(d => {
          return d.label === '' && d.kind === 'videoinput'
        }) !== -1
      ) {
        needAskVideo = true
      }
      // console.log(needAskAudio, needAskVideo, 'aada111jdoajdoa');
      if (needAskAudio || needAskVideo || !hasAudioDevice || !hasVideoDevice) {
        try {
          var stream = await navigator.mediaDevices.getUserMedia({
            audio: needAskAudio,
            video: needAskVideo
          })
          stream.getTracks().forEach(track => {
            track.stop()
          })
        } catch (err) {
          console.log(err, '没有音视频设备权限无法推流');
          // confirm('您的摄像头或者麦克风权限被禁止，请开启权限')
        }



        //again
        // // noVideoPermission为true就是没摄像头设备或者权限，拉流时设置不能为true
        // let noVideoPermission = devices.findIndex(d => {
        //   return d.label === '' && d.kind === 'videoinput'
        // }) !== -1
        // // noAudioPermission为true就是没麦克风设备或者权限，拉流时设置不能为true
        // let noAudioPermission = devices.findIndex(d => {
        //   return d.label === '' && d.kind === 'audioinput'
        // }) !== -1
        // try {
        //   var stream = await navigator.mediaDevices.getUserMedia({
        //     audio: needAskAudio,
        //     video: needAskVideo
        //   })
        // } catch (err) {
        //   var stream = await navigator.mediaDevices.getUserMedia({
        //     audio: !noAudioPermission,
        //     video: !noVideoPermission
        //   })
        // }
      }
      devices = await navigator.mediaDevices.enumerateDevices()
      // console.log(devices, this)
      this.clear()
      devices.forEach(device => {
        if (device.kind === 'audioinput') {
          this.audioInputDevices.push(device)
        } else if (device.kind === 'videoinput') {
          this.videoInputDevices.push(device)
        } else if (device.kind === 'audiooutput') {
          this.audioOutputDevices.push(device)
        }
      })

      this.refreshDevices()
    } catch (err) {
      console.log(err);
    }

  }

  // 前端调用，设置麦克风信息
  setAudioInput() {
    console.log('setAudioInput,修改麦克风设备');
    var index = this.audioInputDevices.findIndex(d => {
      return this.audioInputDeviceId === d.deviceId
    })
    if (index === -1) {
      //做检查
      if (this.audioInputDevice) {
        this.audioInputDeviceId = this.audioInputDevice.deviceId
      } else {
        this.audioInputDeviceId = ''
      }
    } else {
      this.refreshAudioInput(
        this.audioInputDevices[index],
        this.audioInputDevices[index].groupId,
        this.audioInputDevices[index].deviceId
      )
    }
  }

  // 前端调用，设置摄像头信息
  setVideoInput() {
    var index = this.videoInputDevices.findIndex(d => {
      return this.videoInputDeviceId === d.deviceId
    })
    console.log(index, '设置摄像头', this.videoInputDevices)
    if (index === -1) {
      //做检查
      if (this.videoInputDevice) {
        this.videoInputDeviceId = this.videoInputDevice.deviceId
      } else {
        this.videoInputDeviceId = ''
      }
    } else {
      this.refreshVideoInput(
        this.videoInputDevices[index],
        this.videoInputDevices[index].groupId,
        this.videoInputDevices[index].deviceId
      )
    }
  }

  // 前端调用，设置修改后扬声器的相关信息
  setAudioOutput() {
    console.log('进来切换setAudioOutput');
    var index = this.audioOutputDevices.findIndex(d => {
      return this.audioOutputDeviceId === d.deviceId
    })
    if (index === -1) {
      //做检查
      if (this.audioOutputDevice) {
        this.audioOutputDeviceId = this.audioOutputDevice.deviceId
      } else {
        this.audioOutputDeviceId = ''
      }
    } else {
      this.refreshAudioOutput(
        this.audioOutputDevices[index],
        this.audioOutputDevices[index].groupId,
        this.audioOutputDevices[index].deviceId
      )
    }
  }

  //开始监听设备变化
  async start() {
    if (this.started) return
    await this.deviceChange()
    try {
      navigator.mediaDevices.addEventListener(
        'devicechange',
        this.deviceChange.bind(this)
      )
      this.started = true
    } catch (error) {
      console.log(error, '无权限')
    }
  }

  //结束监听设备变化
  stop() {
    if (!this.started) return
    navigator.mediaDevices.removeEventListener(
      'devicechange',
      this.deviceChange.bind(this)
    )
    this.started = false
  }
}

export {
  DeviceInfo
}
