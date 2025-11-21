import events from 'events'
import { LocalStream } from './localstream'

class MicCheck extends events {
  constructor() {
    super()
    this.AudioContext = window.AudioContext || window.webkitAudioContext
    this.audioContext = new this.AudioContext()
    this.microStream = new LocalStream(this.audioContext, true)
    this.deviceInfo = null
    this.started = false
  }

  resetDeviceInfo() {
    if (!this.deviceInfo) return
    this.deviceInfo.removeListener(
      'audio-input-updated',
      this.onAudioInputUpdated
    )
    this.deviceInfo.removeListener(
      'microphone-volume-updated',
      this.onAudioInputVolumeUpdated
    )
    this.deviceInfo = null
  }

  async onAudioInputUpdated() {
    console.log('切换音频设备');
    //从硬件获取音频
    if (this.started) {
      var constraints = this.deviceInfo.genAudioConstraints()
      if (constraints.audio) {
        var stream = await navigator.mediaDevices.getUserMedia(constraints)
        this.microStream.addTrack(stream.getAudioTracks()[0])
        this.emit(
          'play-audio-stream-updated',
          this.microStream.destStream.stream
        )
      }
    }
  }

  // deviceInfo 麦克风音量变大
  onAudioInputVolumeUpdated() {
    console.log('onAudioInputVolumeUpdated')
    if (this.microStream && this.deviceInfo) {
      this.microStream.setVolume(this.deviceInfo.microphone.volume)
    }
  }

  start(deviceInfo) {
    if (!deviceInfo) return
    this.deviceInfo = deviceInfo
    this.onAudioInputUpdated = this.onAudioInputUpdated.bind(this)
    this.onAudioInputVolumeUpdated = this.onAudioInputVolumeUpdated.bind(this)
    this.deviceInfo.addListener('audio-input-updated', this.onAudioInputUpdated)
    this.deviceInfo.addListener(
      'microphone-volume-updated',
      this.onAudioInputVolumeUpdated
    )
    this.started = true
    this.onAudioInputUpdated()
  }
  stop() {
    this.started = false
    this.microStream.removeAudioTrack()
    this.microStream.reset()
    this.resetDeviceInfo()
  }
}

export { MicCheck }
