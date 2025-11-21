import events from 'events'
import {
  LocalStream
} from './localstream'

class MixStream extends events {
  constructor(audioContext) {
    super()
    this.audioContext = new AudioContext()
    //本地音频，视频，发送给对端的
    this.localAudioStream = new LocalStream(this.audioContext) //本地麦克风
    this.shareAudioStream = new LocalStream(this.audioContext) //本地桌面音频
    this.localVideoStream = new MediaStream() //本地视频或者是屏幕分享的, 如果多路流就放到上面两个
    this.localVideoStreamScreen = false
    //本地合音频，发送给对端的, 可以在麦克风调试中使用
    this.mixAudioStream = new MediaStream() //本地麦克风+桌面 融合起来
    //播放使用下面的
    this.localSubStream = new MediaStream() //本地辅流
    this.localSubAudioStream = new MediaStream() //本地音频辅流
    this.playAudioStream = new MediaStream() //播放音频，对端的
    this.playVideoStream = new MediaStream() //播放视频，对端的，或者是本端的
    this.audioCtx = null
    this.audioInput = null
    this.playVideoStream = new Map() //所有视频流
    //注意，推送的视频同时存在于this.playVideoStream 与 this.localVideoStream
  }

  reset() {
    //本地mix音频
    this.mixAudioRemoveTrack()
    //本地音频
    this.localAudioStream.reset()
    this.shareAudioStream.reset()
    //本地视频
    this.localVideoRemoveTrack()
    //play音视频
    this.playAudioRemoveTrack()
    this.playVideoStream = new Map()
  }

  setVolume(volume) {
    if (volume <= 0 && volume > 1) {
      return
    }

    // this.gainNode.gain.value = volume
    this.localAudioStream.setVolume(volume)
    this.shareAudioStream.setVolume(volume)
  }


  mixAudioRemoveTrack() {
    //针对mixAudioStream删除track
    if (this.mixAudioStream.getAudioTracks().length !== 0) {
      var track = this.mixAudioStream.getAudioTracks()[0]
      track.stop()
      this.mixAudioStream.removeTrack(track)
      //   this.emit('local-audio-stream-updated', this.destStream.stream)
      this.emit('local-audio-stream-updated', this.mixAudioStream)
    }
  }

  //音频融合
  async mixAudioStreamFix() {
    // Create a couple of sources
    const srcLocal = this.localAudioStream.source
    const srcShare = this.shareAudioStream.source

    if (srcLocal && srcShare) {
      // 浏览器生成一个包含音轨的 mediaStream 对象
      let mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
      // 生成一个 mediaStream 音频源
      const micSourceNode = this.audioContext.createMediaStreamSource(mediaStream);
      const destination = this.audioContext.createMediaStreamDestination()
      //开始融合音轨
      srcShare.connect(destination)
      micSourceNode.connect(destination)
      this.mixAudioReplaceTrack(destination.stream.getAudioTracks()[0])
    } else if (srcLocal) {
      this.mixAudioReplaceTrack(
        this.localAudioStream.stream.getAudioTracks()[0]
      )
    } else if (srcShare) {
      this.mixAudioReplaceTrack(
        this.shareAudioStream.stream.getAudioTracks()[0]
      )
    } else {
      // 音频不存在了
      this.mixAudioRemoveTrack()
      this.emit('local-audio-stream-updated', this.mixAudioStream)
    }
  }

  // 融合的track设置到mixstream
  mixAudioReplaceTrack(track) {
    this.mixAudioRemoveTrack()
    this.mixAudioStream.addTrack(track)
    this.emit('local-audio-stream-updated', this.mixAudioStream)
  }

  localVideoRemoveTrack() {
    //删除本地的视频track
    if (this.localVideoStream.getVideoTracks().length !== 0) {
      var track = this.localVideoStream.getVideoTracks()[0]
      track.stop()
      this.localVideoStream.removeTrack(track)
      this.localVideoStreamScreen = false
      this.emit('local-video-stream-updated', this.localVideoStream)
    }
  }
  localSubRemoveStream(){
    if (this.localSubStream.getVideoTracks().length !== 0) {
      var track = this.localSubStream.getVideoTracks()[0]
      track.stop()
      this.localSubStream.removeTrack(track)
      this.emit('local-video-substream-updated', this.localVideoStream)
    }
  }
  localsubTrack(track){
    this.localSubStream = new MediaStream()
    this.localSubStream.addTrack(track)
    this.emit('play-video-substream-updated', this.localSubStream)
  }
  // 本地相关的音视频流添加
  localAddTrack(track, isScreen) {
    if (track.kind === 'audio') {
      if (isScreen) {
        this.shareAudioStream.addTrack(track)
      } else {
        let audioStream = new MediaStream()
        audioStream.addTrack(track)
        this.audioCtx = new AudioContext();
        this.audioInput = this.audioCtx.createMediaStreamSource(audioStream);
        var recorder = this.audioCtx.createScriptProcessor(4096, 1, 1);
        this.audioInput.connect(recorder);
        recorder.connect(this.audioCtx.destination);
        var size = 0
        recorder.onaudioprocess = function (e) {
          // getChannelData返回Float32Array类型的pcm数据
          var data = e.inputBuffer.getChannelData(0);
          let inputData = []
          inputData.push(new Float32Array(data));
          size += data.length;
        }
        this.localAudioStream.addTrack(track)
      }
      this.mixAudioStreamFix()
    } else if (track.kind === 'video') {
      //视频直接替换融合
      this.localVideoRemoveTrack()
      this.localVideoStream.addTrack(track)
      this.localVideoStreamScreen = isScreen
      this.emit('local-video-stream-updated', this.localVideoStream)
      //上层如果是主持人，需调用playAddTrack
    }
  }
  // 删除本地通道
  localRemoveTrack(kind, isScreen) {
    if (kind === 'audio') {
      //音频关闭，当前暂时没获取共享屏幕音频所以会走入else
      if (isScreen) {
        this.shareAudioStream.removeTrack(kind)
      } else {
        this.localAudioStream.removeTrack(kind)
      }
      this.mixAudioStreamFix()
    } else if (kind === 'video') {
      //视频关闭
      this.localVideoRemoveTrack()
    }
  }
  // 删除播放流的音频通道
  playAudioRemoveTrack() {
    //删除play的音频track，可能有多个
    if (this.playAudioStream.getAudioTracks().length > 0) {
      this.playAudioStream.getAudioTracks().forEach(track => {
        track.stop()
        this.playAudioStream.removeTrack(track)
      })
      this.emit('play-audio-stream-updated', this.playAudioStream)
    }
  }
  // 删除播放的视频流通道
  playVideoRemoveTrack(display) {
    //删除play的视频track，只有一个
    if (this.playVideoStream.get(display)&&this.playVideoStream.get(display).getVideoTracks().length > 0) {
      var track = this.playVideoStream.get(display).getVideoTracks()[0]
      track.stop()
      this.playVideoStream.get(display).removeTrack(track)
      this.emit('play-video-stream-updated', this.playVideoStream)
    }
  }

  playVideoRemoveTrackWithTrack(trackToRemove,display) {
    //删除play的视频track，只有一个
    if (this.playVideoStream.get(display)&&this.playVideoStream.get(display).getVideoTracks().length > 0) {
      var track = this.playVideoStream.get(display).getVideoTracks()[0]
      if (track.id === trackToRemove.id) {
        track.stop()
        this.playVideoStream.get(display).removeTrack(track)
        this.emit('play-video-stream-updated', this.playVideoStream)
      }
      this.removeSubStream(display)
    }
  }
  removeSubStream(display) {
    if (this.playVideoStream.get(display)) {
      this.playVideoStream.delete(display)

      this.emit('play-video-stream-updated', this.playVideoStream)
    }
  }
  // 本地相关的音视频流添加
  playAddTrack(track,display) {
    if (track.kind === 'audio') {
      this.playAudioStream.addTrack(track)
      this.emit('play-audio-stream-updated', this.playAudioStream)
    } else if (track.kind === 'video') {
      if (this.playVideoStream.get(display)) {
        //视频直接替换
        this.playVideoRemoveTrack(display)
        this.playVideoStream.get(display).addTrack(track)
        this.emit('play-video-stream-updated', this.playVideoStream)
      }else{
        this.playVideoStream.set(display,new MediaStream())
        this.playVideoStream.get(display).addTrack(track)
        this.emit('play-video-stream-updated', this.playVideoStream)
      }
    }
  }

  //一般只有在音频调用此函数，视频直接调用playVideoRemoveTrackWithTrack
  playRemoveTrack(track,display) {
    if (track.kind === 'audio') {
      this.playAudioStream.removeTrack(track)
    } else if (track.kind === 'video') {
      this.playVideoRemoveTrackWithTrack(track,display)
    }
  }
}

export {
  MixStream
}
