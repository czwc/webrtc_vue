import { Room } from '../utils/room'
import { DeviceInfo } from '../utils/deviceinfo'
import { MicCheck } from '../utils/miccheck'

const Main = {
  state: {
    room: new Room(),
    room_options: {
      roomid: '61a5cf9460e3d815f0c9f5eb',
      host: 'chat.xmyuntian.com', //信令地址
      port: 8094,
      schema: 'wss',
      tokenId: '',
      display: Number(parseInt(new Date().getTime() * Math.random() * 100))
        .toString(16)
        .toString(16)
        .substr(0, 15),
      role: 'admin'
    },
    deviceInfo: new DeviceInfo(),
    micCheck: new MicCheck()
  },
  namespace: true,
  mutations: {
    SET_TOKENID(state, tokenId) {
      state.room_options.tokenId = tokenId
    },
    UPGRADE_ROLE(state, display) {
      state.room.UpgradeRole(display)
    },
    MUTE(state, display) {
      state.room.mute(display)
    },
    MUTE_LOCAL(state, kind) {
      state.room.mutelocal(kind)
    },
    UNMUTE_LOCAL(state, kind) {
      state.room.unmutelocal(kind)
    },
    UNMUTE(state, display) {
      state.room.unmute(display)
    },
    MUTEALL(state) {
      state.room.muteall()
    },
    UNMUTEALL(state) {
      state.room.unmuteall()
    },
    SHARE_SCREEN_STREAM: (state, stream) => {
      state.room.shareScreenStream(stream)
    }
  },
  actions: {
    Connect({ state }) {
      return state.room.connect(
        state.room_options.schema +
          '://' +
          state.room_options.host +
          ':' +
          state.room_options.port +
          '/sig/v1/rtc',
        state.room_options.roomid,
        state.room_options.role,
        state.room_options.display,
        state.room_options.tokenId,
        state.deviceInfo
      )
    },
    Disconnect({ commit }) {
      commit('ROOM_DISCONN')
    },
    SetTokenId({ commit }, tokenId) {
      commit('SET_TOKENID', tokenId)
    },
    UpgradeRole({ commit }, display) {
      commit('UPGRADE_ROLE', display)
    },
    Mute({ commit }, display) {
      commit('MUTE', display)
    },
    MuteLocal({ commit }, kind) {
      commit('MUTE_LOCAL', kind)
    },
    UnMuteLocal({ commit }, kind) {
      commit('UNMUTE_LOCAL', kind)
    },
    UnMute({ commit }, display) {
      commit('UNMUTE', display)
    },
    MuteAll({ commit }) {
      commit('MUTEALL')
    },
    UnMuteAll({ commit }) {
      commit('UNMUTEALL')
    },
    ShareScreenStream({ commit }, stream) {
      commit('SHARE_SCREEN_STREAM', stream)
    }
  }
}

export default Main
