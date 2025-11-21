import events from 'events'

class Record extends events {
  constructor() {
    super()
    this.recorder = null;
    this.recordingData = [];
    this.recorderStream=null;
  }
  
  /**
 * 混合音频
 * */
  async mixer(stream1, stream2) {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();

    if(stream1.getAudioTracks().length > 0)
        ctx.createMediaStreamSource(stream1).connect(dest);

    if(stream2.getAudioTracks().length > 0)
        ctx.createMediaStreamSource(stream2).connect(dest);

    let tracks = dest.stream.getTracks();
    tracks = tracks.concat(stream1.getVideoTracks()).concat(stream2.getVideoTracks());

    return new MediaStream(tracks)

  }

  /**
  * 根据URL和时间戳中的Jitsi房间名称返回文件名
  * 
  */
  async getFilename(){
    const now = new Date();
    const timestamp = now.toISOString();
    const room = new RegExp(/(^.+)\s\|/).exec(document.title);
    if(room && room[1]!=="")
        return `${room[1]}_${timestamp}`;
    else
        return `recording_${timestamp}`;
  }

  /**
   * 检查浏览器支持的编码
   *
   */
   async checkCodecsSupported(){
    let options = {mimeType: 'video/webm;codecs=vp9,opus'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = {mimeType: 'video/webm;codecs=vp8,opus'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = {mimeType: 'video/webm'};
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.error(`${options.mimeType} is not supported`);
          options = {mimeType: ''};
        }
      }
    }
    return options;
  }
  async reStart(){
    await this.stopCapture()
    let that = this;
    var options = {
      mimeType: "video/webm;codecs=vp8"
    }
    // const options =await this.checkCodecsSupported();
    if(this.MediaRecorder&&!this.MediaRecorder.isTypeSupported(options.mimeType)){    //查看是否支持这个类型
      console.error("${options.mimeType} is not suppported!");
      return;
    }
    try{
      this.recorder = new MediaRecorder(this.recorderStream,options);
      console.log('this.mediaRecorder');
    }catch(e){
        console.error("Failed to create MediaRecoder!");
        return;
    }
    this.recorder.ondataavailable = function(e) {
      if (e.data.size>0) {
        that.recordingData.push(e.data);
      }
    };
    setTimeout(() => {
      that.recorder.start(10)
    }, 100);
    console.log("reloadstarted recording");
  }
  async start() {
    let that = this;
    var options = {
      mimeType: "video/webm;codecs=vp8"
    }
    // const options =await this.checkCodecsSupported();
    if(this.MediaRecorder&&!this.MediaRecorder.isTypeSupported(options.mimeType)){    //查看是否支持这个类型
      console.error("${options.mimeType} is not suppported!");
      return;
    }
    try{
      this.recorder = new MediaRecorder(this.recorderStream,options);
      console.log('this.mediaRecorder');
    }catch(e){
        console.error("Failed to create MediaRecoder!");
        return;
    }
    this.recorder.ondataavailable = function(e) {
      if (e.data.size>0) {
        that.recordingData.push(e.data);
      }
    };
    this.recorder.start(10);    //设置时间片存储数据;
    console.log("started recording");
  }
  async stopCapture(){
    console.log("Stopping recording");
    this.recorder.stop();
  }
  async pauseCapture(){
    if(this.recorder.state ==='paused'){
      this.recorder.resume();
    }
    else if (this.recorder.state === 'recording'){
      this.recorder.pause();
    }
  }
  async save(){
    var blob = new Blob(this.recordingData,{type: 'video/webm'});
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement("a");    //模拟链接，进行点击下载
    a.href = url;
    a.style.display = "none";    //不显示
    a.download = "video.webm";
    a.click();
  }

}
export { Record }
