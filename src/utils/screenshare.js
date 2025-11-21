import events from 'events'

class ScreenShare extends events {
  constructor() {
    super()

    this.audioOption = {
      channelCount: { ideal: 1 }, //单通道
      autoGainControl: false,
      noiseSuppression: false,
      sampleRate: { ideal: 48000 }
    }
    this.videoOption = {
      // height: { ideal:720},
      // width: { ideal:1280 },
      // frameRate: {  ideal:20,max: 30 }
    }
  }

  //获取桌面的流
  async startCaptureScreen(enableAudio) {
    let constraints = this.genConstraints(enableAudio)
    console.log(constraints)
    return navigator.mediaDevices.getDisplayMedia(constraints)
  }

  // 可同时获取音视频流
  genConstraints(enableAudio) {
    var constraints = {
      audio: false,
      video: true
    }

    constraints.audio =
      enableAudio && Object.assign(constraints.audio, this.audioOption)
    constraints.video =
      constraints.video && Object.assign(constraints.video, this.videoOption)
    console.log(constraints.video,'constraints----------------');
    console.log(constraints.audio,'constraints.audio----------------');
    console.log(enableAudio,'enableAudio----------------');
    console.log(this.audioOption,'this.audioOption----------------');
    console.log(this.videoOption,'this.videoOption----------------');
    
    return constraints
  }
}

export { ScreenShare }
