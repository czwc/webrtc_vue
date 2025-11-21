import events from 'events'

class Bandwidth extends events {
  constructor() {
    super()
    this.lastKindResult = new Map();
    this.lastResult = new Map();
    this.lastSubResult = new Map();
    this.lastPullResult = new Map();
    this.lastRecordResult = new Map();  
    this.lastPacketLoss = new Map();
    this.lastSubPacketLoss = new Map();
    this.lastPullPacketLoss = new Map();
  }
  //拉流视频丢包率
  async getPullLossPackRatioByVideo(pc,display){
    let totalStats =await pc.getStats()
    let that = this;
    var lossVideoratio = 0;
    totalStats.forEach((report)=>{
      if(report.type === "inbound-rtp"&&report.kind=='video'){    //获取输出带宽
        var curTs = report.timestamp;
        let lastStats = that.lastPullPacketLoss.get(display+report.id)
        if(lastStats && report.kind=='video' && lastStats.has(report.id)){
          if (!report.packetsReceived) {
            return; 
          }
          lossVideoratio = (report.packetsLost-lastStats.get(report.id).packetsLost)/(report.packetsLost-lastStats.get(report.id).packetsLost+report.packetsReceived-lastStats.get(report.id).packetsReceived)/(curTs-lastStats.get(report.id).timestamp)*100000
        }
        this.lastPullPacketLoss.set(display+report.id,totalStats);
      }
    })
    return lossVideoratio.toFixed(2);
  }
  // 拉流音频丢包率
  async getPullLossPackRatioByAudio(pc,display){
    let totalStats =await pc.getStats()
    let that = this;
    var lossAudioratio = 0;
    totalStats.forEach((report)=>{
      if(report.type === "inbound-rtp"&&report.kind=='audio'){    //获取输出带宽
        var curTs = report.timestamp;
        let lastStats = that.lastPullPacketLoss.get(display+report.id)
        if(lastStats && report.kind=='audio' && lastStats.has(report.id)){
          if (!report.packetsReceived) {
            return; 
          }
          lossAudioratio = (report.packetsLost-lastStats.get(report.id).packetsLost)/(report.packetsLost-lastStats.get(report.id).packetsLost+report.packetsReceived-lastStats.get(report.id).packetsReceived)/(curTs-lastStats.get(report.id).timestamp)*100000
        }
        this.lastPullPacketLoss.set(display+report.id,totalStats);
      }
    })
    return lossAudioratio.toFixed(2);
  }
  // 推主流视频丢包率
  async getPcLossPackRatioByVideo(pc){
      let totalStats =await pc.getStats()
      let that = this;
      var lossVideoratio = 0;
      totalStats.forEach((report)=>{
        if(report.type === "outbound-rtp"&&report.kind=='video'){    //获取输出带宽
          if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
              return;
          }
          var curTs = report.timestamp;
          let lastStats = that.lastPacketLoss.get(report.id)
          if(lastStats && report.kind=='video' && lastStats.has(report.id)){
            if (!report.packetsSent) {
              return; 
            }
            lossVideoratio = (report.nackCount-lastStats.get(report.id).nackCount)/(report.nackCount-lastStats.get(report.id).nackCount+report.packetsSent-lastStats.get(report.id).packetsSent)/(curTs-lastStats.get(report.id).timestamp)*100000
          }
          this.lastPacketLoss.set(report.id,totalStats);
        }
      })
      return lossVideoratio.toFixed(2);
  }
  // 推辅流视频丢包率
  async getSubPcLossPackRatioByVideo(pc){
    let totalStats =await pc.getStats()
    let that = this;
    var lossVideoratio = 0;
    totalStats.forEach((report)=>{
      if(report.type === "outbound-rtp"&&report.kind=='video'){    //获取输出带宽
        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        let lastStats = that.lastSubPacketLoss.get(report.id)
        if(lastStats && report.kind=='video' && lastStats.has(report.id)){
          if (!report.packetsSent) {
            return; 
          }
          lossVideoratio = (report.nackCount-lastStats.get(report.id).nackCount)/(report.nackCount-lastStats.get(report.id).nackCount+report.packetsSent-lastStats.get(report.id).packetsSent)/(curTs-lastStats.get(report.id).timestamp)*100000
        }
        this.lastSubPacketLoss.set(report.id,totalStats);
      }
    })
    return lossVideoratio.toFixed(2);
  }
  // 推主流音频丢包率
  async getPcLossPackRatioByAudio(pc){
    let totalStats =await pc.getStats()
    let that = this;
    var lossAudioratio = 0;
    totalStats.forEach((report)=>{
      if(report.type === "outbound-rtp"&&report.kind=='audio'){    //获取输出带宽
        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        let lastStats = that.lastPacketLoss.get(report.id)
        if(lastStats && report.kind=='audio' && lastStats.has(report.id)){
          if (!report.packetsSent) {
            return; 
          }
          lossAudioratio = (report.nackCount-lastStats.get(report.id).nackCount)/(report.nackCount-lastStats.get(report.id).nackCount+report.packetsSent-lastStats.get(report.id).packetsSent)/(curTs-lastStats.get(report.id).timestamp)*100000
        }
        this.lastPacketLoss.set(report.id,totalStats);
      }
    })
    return lossAudioratio.toFixed(2);
}
// 推辅流音频丢包率
async getSubPcLossPackRatioByAudio(pc){
  let totalStats =await pc.getStats()
  let that = this;
  var lossAudioratio = 0;
  totalStats.forEach((report)=>{
    if(report.type === "outbound-rtp"&&report.kind=='audio'){    //获取输出带宽
      if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
          return;
      }
      var curTs = report.timestamp;
      let lastStats = that.lastSubPacketLoss.get(report.id)
      if(lastStats && report.kind=='audio' && lastStats.has(report.id)){
        if (!report.packetsSent) {
          return; 
        }
        lossAudioratio = (report.nackCount-lastStats.get(report.id).nackCount)/(report.nackCount-lastStats.get(report.id).nackCount+report.packetsSent-lastStats.get(report.id).packetsSent)/(curTs-lastStats.get(report.id).timestamp)*100000
      }
      this.lastSubPacketLoss.set(report.id,totalStats);
    }
  })
  return lossAudioratio.toFixed(2);
}
  //计算主流推流带宽
  async bandwidthComputingByPush(pc){
    let totalStats =await pc.getStats()
    let that = this;
    var biterate = 0;
    var lossAudioratio = 0;
    var lossVideoratio = 0;
    totalStats.forEach((report)=>{
      if(report.type === "outbound-rtp"){    //获取输出带宽
        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        var bytes = report.bytesSent;
        if(that.lastResult.get(report.id) && that.lastResult.get(report.id).has(report.id)){
            biterate += 8*(bytes-that.lastResult.get(report.id).get(report.id).bytesSent)/(curTs-that.lastResult.get(report.id).get(report.id).timestamp);
        }
        this.lastResult.set(report.id,totalStats);
      }
    })
    return biterate
  }
  //计算录屏推流带宽
  async bandwidthComputingByRecord(pc){
    let totalStats =await pc.getStats()
    let that = this;
    var biterate = 0;
    totalStats.forEach((report)=>{
      if(report.type === "outbound-rtp"){    //获取输出带宽
        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        var bytes = report.bytesSent;
        if(that.lastRecordResult.get(report.id) && that.lastRecordResult.get(report.id).has(report.id)){
            biterate += 8*(bytes-that.lastRecordResult.get(report.id).get(report.id).bytesSent)/(curTs-that.lastRecordResult.get(report.id).get(report.id).timestamp);
        }
        this.lastRecordResult.set(report.id,totalStats);
      }
    })
    return biterate;
  }
  //计算辅流推流带宽
  async bandwidthComputingBySubPush(pc){
    let totalStats =await pc.getStats()
    let that = this;
    var biterate = 0;
    totalStats.forEach((report)=>{
     
      if(report.type === "outbound-rtp"){    //获取输出带宽
        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        var bytes = report.bytesSent;
        if(that.lastSubResult.get(report.id) && that.lastSubResult.get(report.id).has(report.id)){
            biterate += 8*(bytes-that.lastSubResult.get(report.id).get(report.id).bytesSent)/(curTs-that.lastSubResult.get(report.id).get(report.id).timestamp);
        }
        this.lastSubResult.set(report.id,totalStats);
      }
    })
    return biterate
  }
  //计算拉流的带宽
  async bandwidthComputingByPull(pc,display){
    let totalStats =await pc.getStats()
    let that = this;
    var biterate = 0;
    await totalStats.forEach((report)=>{
      if(report.type === "inbound-rtp"){    //获取输出带宽
        var curTs = report.timestamp;
        var bytes = report.bytesReceived;
        //上面的bytes和packets是累计值。我们只需要差值
        let lastStats = that.lastPullResult.get(display+report.id)
        if(lastStats && lastStats.has(report.id)){
            if(lastStats.get(report.id).bytesReceived==report.bytesReceived){
              return false;
            }
            biterate += 8*(bytes-lastStats.get(report.id).bytesReceived)/(curTs-lastStats.get(report.id).timestamp);
        }
        this.lastPullResult.set(display+report.id,totalStats)
      }
    })
    return biterate;
  }
  //监听谁在讲话
  async getSpeakUser(pc,username=''){
    let totalStats =await pc.getStats()
    var user = null;
    await totalStats.forEach((report)=>{
      if(report.type === "inbound-rtp"){    //获取音频能量大于0.01代表有在说话
        if(report.kind === "audio"&&report.audioLevel >= 0.01){
          user=username+' '
        }
      }
    })
    return user;
  }

}
export { Bandwidth }
