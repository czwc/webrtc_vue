import events from 'events'

class LocalStream extends events {
  constructor(audioContext, isProcessAudio = true) {
    super()
    this.audioContext = audioContext
    this.stream = null //暂时只装音频，视频放上层, source stream
    this.gainNode = null
    this.rmsNode = null // script processor, get volume, runtime
    this.source = null // create from steam
    this.rms = 0 // 0 - 100

    this.destStream = null
    this.isProcessAudio = isProcessAudio
    if (this.isProcessAudio) {
      this.gainNode = this.audioContext.createGain() //gain, set volume
    }
  }

  // 重置
  reset() {
    this.removeAudioTrack() //包含disconnectSource
    this.removeVideoTrack()
    this.stream = null
    this.destStream = null
  }

  // 音量设置
  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      console.log('Invalid value ...............value [0-1]')
      return
    }
    this.gainNode.gain.value = volume
  }

  disconnectSource() {
    if (this.isProcessAudio && this.source) {
      this.source.disconnect(this.rmsNode)
      this.source.disconnect(this.gainNode)
      this.rmsNode.disconnect(this.audioContext.destination)
      this.gainNode.disconnect(this.destStream)
      this.destStream = null
    }
    this.source = null
    this.rmsNode = null
    this.rms = 0
  }

  connectSource() {
    if (this.isProcessAudio) {
      this.destStream = this.audioContext.createMediaStreamDestination()
      this.rmsNode.connect(this.audioContext.destination)
      this.gainNode.connect(this.destStream)
      this.source.connect(this.rmsNode)
      this.source.connect(this.gainNode)
    }
  }

  removeAudioTrack() {
    if (this.stream && this.stream.getAudioTracks().length !== 0) {
      this.stream.getAudioTracks()[0].stop()
      this.stream.removeTrack(this.stream.getAudioTracks()[0])
    }

    this.source && this.disconnectSource()
  }
  removeVideoTrack() {
    if (this.stream && this.stream.getVideoTracks().length !== 0) {
      this.stream.getVideoTracks()[0].stop()
      this.stream.removeTrack(this.stream.getVideoTracks()[0])
    }
  }

  // track 加入 localstream
  addTrack(track) {
    if (!this.stream) {
      this.stream = new MediaStream()
    }
    // console.log(this.stream.getAudioTracks())
    // console.log(this.stream.getVideoTracks())
    // console.log(track)

    //判断音频是否存在，存在的话删除
    if (track.kind === 'audio') {
      this.removeAudioTrack()
    }
    //判断视频是否存在，存在的话删除
    if (track.kind === 'video') {
      this.removeVideoTrack()
    }
    //加入track
    this.stream.addTrack(track)

    //audio 获取音量
    if (track.kind === 'audio') {
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      //
      let that = this
      if (this.isProcessAudio) {
        this.rmsNode = this.audioContext.createScriptProcessor(2048, 1, 1)
        this.rmsNode.onaudioprocess = event => {
          const input = event.inputBuffer.getChannelData(0)
          let i
          let sum = 0.0
          for (i = 0; i < input.length; ++i) {
            sum += input[i] * input[i]
          }
          var rms = Math.round(Math.sqrt(sum / input.length) * 100)
          //当前不不用判断吧
          if (that.rms > 0 && rms === 0) {
            that.emit('stop-speaking')
          } else if (this.rms === 0 && rms > 0) {
            that.emit('start-speaking')
          }
          that.rms = rms
          //console.log(`rms: ${that.rms}`) //for debug
        }
      }
      this.source.onended = () => {
        console.log('source ended')
        that.disconnectSource()
      }

      this.connectSource()
      console.log('source connect node success')
    }
  }

  removeTrack(kind) {
    if (!this.stream) {
      console.log('Warning stream is null')
      return
    }
    if (kind === 'audio') {
      this.removeAudioTrack()
      this.disconnectSource()
    } else if (kind === 'video') {
      this.removeVideoTrack()
    }
  }
}

export { LocalStream }
