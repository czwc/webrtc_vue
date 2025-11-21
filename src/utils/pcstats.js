import events from 'events'

class PcStats extends events {
  constructor(pc, isSender, caller) {
    super()
    this.pc = pc
    this.isSender = isSender
    this.caller = caller
    this.reset()
  }
  reset() {
    this.lastPullResult = null
    this.lastResult = null;
    this.audioStat = {
      outbound_rtp: null, //sender only
      remote_inbound_rtp: null, //sender only?
      inbound_rtp: null, //receiver only

      candidate_pair: null,
      local_candidate: null,
      remote_candidate: null,
      track: null,
      transport: null,
      last_get_timestamp: Date.now()
    }
    this.videoStat = {
      outbound_rtp: null, //sender only
      remote_inbound_rtp: null, //sender only?
      inbound_rtp: null, //receiver only

      media_source: null, //video sender only?

      candidate_pair: null,
      local_candidate: null,
      remote_candidate: null,
      track: null,
      transport: null,
      last_get_timestamp: Date.now()
    }
    this.calcAudioSum(null)
    this.calcVideoSum(null)
    this.resetSum()
  }
  resetSum() {
    this.sum = {
      rtt: 0,
      bitrateSend: 0,
      bitrateRecv: 0,
      networkQulity: 6 //TODO
    }
  }

  calcAudioSum(stat) {
    this.audioSum = {
      bitrateRecv: 0,
      lossrateSend: 0, //根据丢包数 计算丢包率
      lossrateRecv: 0, //根据丢包数 计算丢包率

      //recv only
      lastPacketReceivedTimestamp: 0,

      //send only
      nackcount: 0,

      //recvonly
      last_get_timestamp: Date.now()
    }

    if (!stat) return
    // console.log((stat.candidate_pair.availableIncomingBitrate/8194).toFixed(2)+'KB',(stat.candidate_pair.availableOutgoingBitrate/8194).toFixed(2)+'KB','推流音频详情');
    if (this.audioStat.outbound_rtp && stat.outbound_rtp) {
      //loss windows 试试
      if (this.audioStat.remote_inbound_rtp && stat.remote_inbound_rtp) {
        this.audioSum.lossrateSend =
          ((stat.outbound_rtp.nackCount -
            this.audioStat.outbound_rtp.nackCount) *
            100) / //百分比
          (stat.outbound_rtp.packetsSent -
            this.audioStat.outbound_rtp.packetsSent)
      }

      //nack
      this.audioSum.nackcount =
        stat.outbound_rtp.nackCount - this.audioStat.outbound_rtp.nackCount
    }
    if (this.audioStat.inbound_rtp && stat.inbound_rtp) {
      //loss windows 试试
      this.audioSum.lossrateRecv =
        ((stat.inbound_rtp.packetsLost -
          this.audioStat.inbound_rtp.packetsLost) *
          100) / //百分比
        (stat.inbound_rtp.packetsReceived -
          this.audioStat.inbound_rtp.packetsReceived)
    }

    if (this.audioStat.candidate_pair && stat.candidate_pair) {
      this.audioSum.bitrateRecv = Math.ceil(
        ((stat.candidate_pair.bytesReceived -
          this.audioStat.candidate_pair.bytesReceived) *
          1000) /
          (stat.candidate_pair.timestamp -
            this.audioStat.candidate_pair.timestamp)
      )
    }

    //最后收到包
    stat.inbound_rtp &&
      (this.audioSum.lastPacketReceivedTimestamp =
        stat.inbound_rtp.lastPacketReceivedTimestamp)

    // 是否说话
    if (stat.track && stat.track.audioLevel) {
      if (
        stat.track.audioLevel >= 0.01 &&
        (!this.audioStat.track || this.audioStat.track.audioLevel < 0.01)
      ) {
        this.emit('start-speaking', this.isSender, this.caller)
      } else if (
        stat.track.audioLevel < 0.01 &&
        this.audioStat.track &&
        this.audioStat.track.audioLevel >= 0.01
      ) {
        this.emit('stop-speaking', this.isSender, this.caller)
      }
    }

    // console.log(this.audioSum.lossrateSend,'音频丢包率',(stat.candidate_pair.bytesSent-this.audioStat.candidate_pair.bytesSent)/8192,(stat.candidate_pair.bytesReceived-this.audioStat.candidate_pair.bytesReceived)/8192)
  }

  calcVideoSum(stat) {
    this.videoSum = {
      bitrateRecv: 0,
      lossrateSend: 0, //根据丢包数 计算丢包率
      lossrateRecv: 0, //根据丢包数 计算丢包率

      //recv only
      lastPacketReceivedTimestamp: 0,

      //send only
      nackcount: 0,

      //recvonly
      last_get_timestamp: Date.now()
    }

    if (!stat) return
    // console.log((stat.candidate_pair.availableIncomingBitrate/8194).toFixed(2)+'KB',(stat.candidate_pair.availableOutgoingBitrate/8194).toFixed(2)+'KB','推流视频详情');

    if (this.videoStat.outbound_rtp && stat.outbound_rtp) {
      //loss windows 试试
      if (this.videoStat.remote_inbound_rtp && stat.remote_inbound_rtp) {
        this.videoSum.lossrateSend =
          ((stat.outbound_rtp.nackCount -
            this.videoStat.outbound_rtp.nackCount) *
            100) / //百分比
          (stat.outbound_rtp.packetsSent -
            this.videoStat.outbound_rtp.packetsSent)
      }

      //nack
      this.videoSum.nackcount =
        stat.outbound_rtp.nackCount - this.videoStat.outbound_rtp.nackCount
    }

    if (this.videoStat.inbound_rtp && stat.inbound_rtp) {
      //loss windows 试试
      this.videoSum.lossrateRecv =
        ((stat.inbound_rtp.packetsLost -
          this.videoStat.inbound_rtp.packetsLost) *
          100) / //百分比
        (stat.inbound_rtp.packetsReceived -
          this.videoStat.inbound_rtp.packetsReceived)
    }

    if (this.videoStat.candidate_pair && stat.candidate_pair) {
      this.videoSum.bitrateRecv =
        Math.ceil(
          (stat.candidate_pair.bytesReceived -
            this.videoStat.candidate_pair.bytesReceived) *
            1000
        ) /
        (stat.candidate_pair.timestamp -
          this.videoStat.candidate_pair.timestamp)
    }

    //最后收到包
    stat.inbound_rtp &&
      (this.videoSum.lastPacketReceivedTimestamp =
        stat.inbound_rtp.lastPacketReceivedTimestamp)

    // console.log(this.videoSum.lossrateSend,'视频丢包率',(stat.candidate_pair.bytesSent-this.videoStat.candidate_pair.bytesSent)/8192,(stat.candidate_pair.bytesReceived-this.videoStat.candidate_pair.bytesReceived)/8192)
  }

  setVideoStats(stats) {
    let newStat = {
      outbound_rtp: null, //sender only
      remote_inbound_rtp: null, //sender only?
      inbound_rtp: null, //receiver only

      media_source: null, //video sender only?

      candidate_pair: null,
      local_candidate: null,
      remote_candidate: null,
      track: null,
      transport: null,
      last_get_timestamp: Date.now()
    }
    let emptyStat = newStat

    stats.forEach(stat => {
      switch (stat.type) {
        case 'outbound-rtp':
          newStat.outbound_rtp = stat
          break
        case 'remote-inbound-rtp':
          newStat.remote_inbound_rtp = stat
          break
        case 'inbound-rtp':
          newStat.inbound_rtp = stat
          break
        case 'candidate-pair':
          newStat.candidate_pair = stat
          break
        case 'local-candidate':
          newStat.local_candidate = stat
          break
        case 'remote-candidate':
          newStat.remote_candidate = stat
          break
        case 'track':
          newStat.track = stat
          break
        case 'transport':
          newStat.transport = stat
          break
        case 'media_source':
          newStat.media_source = stat
          break
      }
    })

    if (
      stats.size === 0 ||
      !this.videoStat.track ||
      this.videoStat.track.trackIdentifier !== newStat.track.trackIdentifier
    ) {
      this.videoStat = emptyStat
    }
    this.calcVideoSum(newStat)
    this.videoStat = newStat
  }
  setAudioStats(stats) {
    let newStat = {
      outbound_rtp: null, //sender only
      remote_inbound_rtp: null, //sender only?
      inbound_rtp: null, //receiver only

      candidate_pair: null,
      local_candidate: null,
      remote_candidate: null,
      track: null,
      transport: null,
      last_get_timestamp: Date.now()
    }
    let emptyStat = newStat

    stats.forEach(stat => {
      switch (stat.type) {
        case 'outbound-rtp':
          newStat.outbound_rtp = stat
          break
        case 'remote-inbound-rtp':
          newStat.remote_inbound_rtp = stat
          break
        case 'inbound-rtp':
          newStat.inbound_rtp = stat
          break
        case 'candidate-pair':
          newStat.candidate_pair = stat
          break
        case 'local-candidate':
          newStat.local_candidate = stat
          break
        case 'remote-candidate':
          newStat.remote_candidate = stat
          break
        case 'track':
          newStat.track = stat
          break
        case 'transport':
          newStat.transport = stat
          break
      }
    })

    if (
      stats.size === 0 ||
      !this.audioStat.track ||
      this.audioStat.track.trackIdentifier !== newStat.track.trackIdentifier
    ) {
      this.audioStat = emptyStat
    }
    this.calcAudioSum(newStat)
    this.audioStat = newStat
  }

  setSum() {
    //上行带宽
    this.sum.bitrateSend = 0
    this.sum.bitrateRecv = 0
    if (this.isSender) {
      if (
        this.audioStat.candidate_pair &&
        this.audioStat.candidate_pair.availableOutgoingBitrate
      ) {
        this.sum.bitrateSend += this.audioStat.candidate_pair.availableOutgoingBitrate
        this.sum.rtt = this.audioStat.candidate_pair.currentRoundTripTime
      }
      if (
        this.videoStat.candidate_pair &&
        this.videoStat.candidate_pair.availableOutgoingBitrate
      ) {
        this.sum.bitrateSend += this.videoStat.candidate_pair.availableOutgoingBitrate
        this.sum.rtt = this.videoStat.candidate_pair.currentRoundTripTime
      }
    } else {
      //下行带宽
      if (this.audioStat.candidate_pair) {
        if (this.audioStat.candidate_pair.availableIncomingBitrate) {
          this.sum.bitrateRecv += this.audioStat.candidate_pair.availableIncomingBitrate
        } else if (this.audioStat.candidate_pair.bytesReceived) {
          this.sum.bitrateRecv += this.audioSum.bitrateRecv
        }
        this.sum.rtt = this.audioStat.candidate_pair.currentRoundTripTime
      } else if (this.videoStat.candidate_pair) {
        if (this.videoStat.candidate_pair.availableIncomingBitrate) {
          this.sum.bitrateRecv += this.videoStat.candidate_pair.availableIncomingBitrate
        } else if (this.videoStat.candidate_pair.bytesReceived) {
          this.sum.bitrateRecv += this.videoSum.bitrateRecv
        }
        this.sum.rtt = this.videoStat.candidate_pair.currentRoundTripTime
      }
    }

    if (this.isSender) {
      var networkQulity = 6

      var totalNackCount = 0
      if (this.audioSum.nackcount > 1) {
        totalNackCount += this.audioSum.nackcount
      } else if (this.videoSum.nackcount > 1) {
        totalNackCount += this.videoSum.nackcount
      }
      if (totalNackCount > 20) {
        totalNackCount = 20
      }

      if (totalNackCount > 1) {
        networkQulity -= Math.ceil(totalNackCount / 10)
      }

      if (this.sum.rtt > 150) {
        if (this.sum.rtt < 400) {
          networkQulity = networkQulity - 1
        } else {
          networkQulity = networkQulity - 2
        }
      }
      this.sum.networkQulity = networkQulity
    }
    this.emit('sum-result', this.isSender, this.caller)
    // console.log(this.sum.bitrateSend,this.sum.bitrateRecv,'算好的上下行带宽');
  }
  async bandwidthComputing(){
    let totalStats =await this.pc.getStats()
    let taht = this;
    totalStats.forEach((report)=>{
      if(report.type === "outbound-rtp"){    //获取输出带宽
      // console.log(report,'total');

        if(report.isRemote){    //表示是远端的数据，我们只需要自己本端的
            return;
        }
        var curTs = report.timestamp;
        var bytes = report.bytesSent;
        var packets = report.packetsSent;
        //上面的bytes和packets是累计值。我们只需要差值
        if(taht.lastResult && taht.lastResult.has(report.id)){
            var biterate = 8*(bytes-taht.lastResult.get(report.id).bytesSent)/(curTs-taht.lastResult.get(report.id).timestamp);
            var packetCnt = packets - taht.lastResult.get(report.id).packetsSent;
            // console.log(biterate,packetCnt,'计算好的推流带宽');
        }
      }
    })
    this.lastResult = totalStats;
  }
  async bandwidthComputingByPull(){
    let totalStats =await this.pc.getStats()
    let taht = this;
    totalStats.forEach((report)=>{
      if(report.type === "inbound-rtp"){    //获取输出带宽
      // console.log(report,'total');
        var curTs = report.timestamp;
        var bytes = report.bytesReceived;
        var packets = report.packetsReceived;
        //上面的bytes和packets是累计值。我们只需要差值
        if(taht.lastPullResult && taht.lastPullResult.has(report.id)){
            var biterate = 8*(bytes-taht.lastPullResult.get(report.id).bytesReceived)/(curTs-taht.lastPullResult.get(report.id).timestamp);
            var packetCnt = packets - taht.lastPullResult.get(report.id).packetsReceived;
            // console.log(biterate,packetCnt,'计算好的拉流带宽');
        }
      }
    })
    this.lastPullResult = totalStats;
  }
  async start() {
    if (this.timer) return
    const that = this
    if (this.isSender) {
      this.timer = window.setInterval(() => {
        this.bandwidthComputing()
        //console.log('start get stats')
        that.pc.getSenders().forEach(async sender => {
          let stats = await sender.getStats()
          //console.log('sender.track.kind', sender.track.kind)
          if (sender.track && sender.track.kind === 'audio') {
            that.setAudioStats(stats)
          } else if (sender.track && sender.track.kind === 'video') {
            that.setVideoStats(stats)
          }
        })
        that.setSum()
      }, 1000)
    } else {
      this.timer = window.setInterval(() => {
        this.bandwidthComputingByPull()
        //console.log('start get stats')
        that.pc.getReceivers().forEach(async receiver => {
          let stats = await receiver.getStats()
          //console.log('receiver.track.kind', receiver.track.kind)
          if (receiver.track && receiver.track.kind === 'audio') {
            that.setAudioStats(stats)
          } else if (receiver.track && receiver.track.kind === 'video') {
            that.setVideoStats(stats)
          }
        })
        that.setSum()
      }, 1000)
    }
  }

  stop() {
    if (!this.timer) return
    if (!this.isSender) {
      // console.log('stop-speaking')
      this.emit('stop-speaking', this.isSender, this.caller)
    }
    window.clearInterval(this.timer)
    this.timer = null
  }
}

export { PcStats }
