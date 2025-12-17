import Vue from 'vue'
import {
  Button,
  Input,
  Select,
  Option,
  Drawer,
  Dialog,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Alert,
  Progress,
  Message,
  MessageBox,
  Loading
} from 'element-ui'
// 引入Element UI样式
import 'element-ui/lib/theme-chalk/index.css'

// 注册组件
Vue.use(Button)
Vue.use(Input)
Vue.use(Select)
Vue.use(Option)
Vue.use(Drawer)
Vue.use(Dialog)
Vue.use(Dropdown)
Vue.use(DropdownMenu)
Vue.use(DropdownItem)
Vue.use(Alert)
Vue.use(Progress)
Vue.use(Loading.directive)

// 挂载全局方法
Vue.prototype.$message = Message
Vue.prototype.$msgbox = MessageBox
Vue.prototype.$alert = MessageBox.alert
Vue.prototype.$confirm = MessageBox.confirm
Vue.prototype.$prompt = MessageBox.prompt
Vue.prototype.$loading = Loading.service



