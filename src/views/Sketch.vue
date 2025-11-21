<template>
  <div class="sketch-wrapper">
    <canvas class="sketch-canvas" id="sketchCanvas"></canvas>
    <div class="control-panel">
      <button :class="{ active: currentTool === 'Pencil' }" @click="changeTool('Pencil')">铅笔</button>
      <button :class="{ active: currentTool === 'Line' }" @click="changeTool('Line')">直线</button>
      <button :class="{ active: currentTool === 'Dashed' }" @click="changeTool('Dashed')">虚线</button>
      <button :class="{ active: currentTool === 'Rect' }" @click="changeTool('Rect')">四边形</button>
      <button :class="{ active: currentTool === 'Circle' }" @click="changeTool('Circle')">圆</button>
      <button :class="{ active: currentTool === 'Ellipse' }" @click="changeTool('Ellipse')">椭圆</button>
      <button
        :class="{ active: currentTool === 'Triangle' }"
        @click="changeTool('Triangle')"
      >三角形</button>
      <button :class="{ active: currentTool === 'Text' }" @click="changeTool('Text')">文字</button>
      <button :class="{ active: currentTool === 'Eraser' }" @click="changeTool('Eraser')">橡皮</button>
      <button :class="{ active: currentTool === 'Clear' }" @click="changeTool('Clear')">清除</button>
      <button :class="{ active: currentTool === 'Undo' }" @click="changeTool('Undo')">撤销</button>
      <button :class="{ active: currentTool === 'Redo' }" @click="changeTool('Redo')">反撤销</button>
      <hr />
      <button @click="toJson">toJson</button>
    </div>
  </div>
</template>

<script>
import throttle from 'lodash/throttle'
import debounce from 'lodash/debounce'
import { fabric } from 'fabric'
import { mapState, mapActions, mapGetters } from 'vuex'
export default {
  name: 'sketch',
  data() {
    return {
      canvas: null,
      brushWidth: 3,
      brushColor: '#E34F51',
      startPos: {},
      endPos: {},
      textBox: null,
      currentObject: null,
      isDrawing: false,
      isLoading: false,
      cxt:null,
      canvasStream:null
    }
  },
  mounted() {
    this.init()
  },
  computed: {
    canvasWidth() {
      return window.innerWidth;
    },
    canvasHeight() {
      return this.$refs.sketchCanvas.offsetHeight;
    },
    ...mapState({
      currentTool: (state) => state.boards.currentTool,
      present:(state)=>state.boards.present
    }),
    ...mapGetters("boards",['isFreeMode']),
  },
  methods: {
    ...mapActions("boards",['updateTool','saveObjects','loadPrev','loadNext']),

    init: async function() {
      // await this.$nextTick();
      this.initSketch()
      // console.log( new fabric.Color('asd'))
    },
    initSketch() {
      this.canvas = new fabric.Canvas('sketchCanvas', {
        backgroundColor:"#FFFFFF",
        freeDrawingCursor: 'crosshair',
        isDrawingMode: this.isFreeMode,
        selection: false,
        skipTargetFind: true,
        stopContextMenu: true,
        devicePixelRatio: true // Retina 高清屏 屏幕支持
      })
      this.canvas.freeDrawingBrush.color = this.brushColor
      this.canvas.freeDrawingBrush.width = this.brushWidth
      this.setSketchSize()
      const canvasexample = document.getElementById('sketchCanvas');
      this.cxt = canvasexample.getContext('2d');
      this.cxt.fillStyle = '#FFFFFF';
      this.cxt.fillRect(0, 0, canvasexample.width, canvasexample.height);
      this.canvas.on({
        'mouse:down': this.onMouseDown,
        'mouse:move': this.onMouseMove,
        'mouse:up': this.onMouseUp,
        'object:added': () => {
          // 添加新对象后，缓存当前画板中的所有对象
          !this.isLoading && this.saveObjects(this.canvas.toJSON())
        },
      })
      console.log(document.querySelector('canvas').captureStream());
      window.addEventListener('resize', throttle(this.setSketchSize, 50), false)
      window.addEventListener(
        'message',
        debounce(this.receiveMessage, 50),
        false
      )

      // 初始化加载原数据
      this.loadSketch()
      this.canvasStream = canvasexample.captureStream()
      console.log('initSketch', canvasexample,canvasexample.width,canvasexample.height)
      // window.canvas = this.canvas
      // window.ctx = this.canvas.getContext();
    },
    // 清除绑定的监听事件
    clearEventListeners() {
      const listeners = this.canvas.__eventListeners
      if (listeners) {
        listeners['path:created'] = []
        listeners['mouse:down'] = []
        listeners['mouse:move'] = []
        listeners['mouse:up'] = []
      }
    },
    onMouseDown(e) {
      this.isDrawing = true
      if (this.isFreeMode) {
        return
      }

      // console.log("mouse:down", e);
      this.startPos.x = e.pointer.x
      this.startPos.y = e.pointer.y

      if (this.currentTool === 'Text') {
        this.deleteEmptyText()
        this.textBox = this.createText()
        this.canvas.add(this.textBox)
        this.textBox.enterEditing()
        this.canvas.setActiveObject(this.textBox)
        // this.textBox.hiddenTextarea.focus();
      }

      // 立刻渲染：解决从画笔切换到图形时，首次存在画笔残留的问题
      this.canvas.renderAll()
    },
    onMouseMove(e) {
      if (!this.isDrawing) {
        return
      }
      if (this.isFreeMode) {
        this.sendSketchJson()
        return
      }
      this.endPos.x = e.pointer.x
      this.endPos.y = e.pointer.y
      this.drawing()
    },
    onMouseUp(e) {
      this.isDrawing = false
      if (this.isFreeMode) {
        return
      }
      // console.log("mouse:up", e);
      this.endPos.x = e.pointer.x
      this.endPos.y = e.pointer.y
      this.currentObject = null
    },
    onEraserDone(e) {
      // 橡皮擦模式：划线后，修改混合方式，并立刻渲染
      e.path.globalCompositeOperation = 'destination-out'
      this.canvas.renderAll()
    },
    drawing() {
      if (this.currentObject) {
        this.canvas.remove(this.currentObject)
      }

      if (this.currentTool === 'Line') {
        this.currentObject = this.createLine()
      } else if (this.currentTool === 'Dashed') {
        this.currentObject = this.createLine(true)
      } else if (this.currentTool === 'Rect') {
        this.currentObject = this.createRect()
      } else if (this.currentTool === 'Circle') {
        this.currentObject = this.createCircle()
      } else if (this.currentTool === 'Ellipse') {
        this.currentObject = this.createEllipse()
      } else if (this.currentTool === 'Triangle') {
        this.currentObject = this.createTriangle()
      }

      this.currentObject && this.canvas.add(this.currentObject)
      this.sendSketchJson()
    },
    createLine(isDashed) {
      const dash = {
        strokeDashArray: isDashed ? [10, 3] : undefined,
      }
      return new fabric.Line(
        [this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y],
        {
          strokeWidth: this.brushWidth,
          stroke: this.brushColor,
          ...dash,
        }
      )
    },
    createRect() {
      const start = this.startPos
      const end = this.endPos
      const origin = {
        originX: end.x - start.x >= 0 ? 'left' : 'right',
        originY: end.y - start.y >= 0 ? 'top' : 'bottom',
      }
      const path = `
        M ${start.x} ${start.y}
        L ${end.x} ${start.y}
        L ${end.x} ${end.y}
        L ${start.x} ${end.y}
        L ${start.x} ${start.y}
        z`
      return new fabric.Path(path, {
        left: start.x,
        top: start.y,
        stroke: this.brushColor,
        strokeWidth: this.brushWidth,
        fill: 'rgba(0, 0, 0, 0)',
        ...origin,
      })
    },
    createCircle() {
      let radius =
        Math.sqrt(
          (this.endPos.x - this.startPos.x) ** 2 +
            (this.endPos.y - this.startPos.y) ** 2
        ) / 2
      return new fabric.Circle({
        left: this.startPos.x,
        top: this.startPos.y,
        strokeWidth: this.brushWidth,
        stroke: this.brushColor,
        fill: 'rgba(0, 0, 0, 0)',
        originX: 'center',
        originY: 'center',
        radius: radius,
      })
    },
    createEllipse() {
      return new fabric.Ellipse({
        left: this.startPos.x,
        top: this.startPos.y,
        strokeWidth: this.brushWidth,
        stroke: this.brushColor,
        fill: 'rgba(0, 0, 0, 0)',
        originX: 'center',
        originY: 'center',
        rx: Math.abs(this.endPos.x - this.startPos.x),
        ry: Math.abs(this.endPos.y - this.startPos.y),
      })
    },
    createTriangle() {
      const height = Math.abs(this.endPos.y - this.startPos.y)
      return new fabric.Triangle({
        left: this.startPos.x,
        top: this.startPos.y,
        width: Math.sqrt(height ** 2 + (height / 2.0) ** 2),
        height: height,
        strokeWidth: this.brushWidth,
        stroke: this.brushColor,
        fill: 'rgba(0, 0, 0, 0)',
        originX: 'center',
        originY: 'center',
      })
    },
    createText() {
      return new fabric.Textbox('', {
        left: this.startPos.x,
        top: this.startPos.y - 10,
        width: 150,
        fontSize: 20,
        fill: this.brushColor,
        borderColor: '#2c2c2c',
        editingBorderColor: '#ccc',
        hasControls: false,
      })
    },
    deleteEmptyText() {
      if (this.textBox) {
        this.textBox.exitEditing()
        this.textBox.text === '' && this.canvas.remove(this.textBox)
        this.textBox = null
      }
    },
    changeTool(tool) {
      this.updateTool(tool)
      this.isDrawing = false

      const listeners = this.canvas.__eventListeners
      listeners && (listeners['path:created'] = [])

      if (this.isFreeMode) {
        this.canvas.isDrawingMode = true
        this.canvas.freeDrawingBrush.oldEnd = undefined
        this.canvas.freeDrawingBrush.color = this.brushColor
        this.currentObject = null
      } else {
        this.canvas.isDrawingMode = false
      }
      if (this.currentTool === 'Eraser') {
        this.canvas.freeDrawingBrush.color = '#fff'
        this.canvas.on('path:created', this.onEraserDone)
      }
      if (this.currentTool === 'Undo') {
        this.loadPrev()
        this.loadSketch()
      } else if (this.currentTool === 'Redo') {
        this.loadNext()
        this.loadSketch()
      }
      this.currentTool === 'Clear' && this.canvas.clear()

      this.deleteEmptyText()

      console.log('changeTool: ', this.currentTool)
      this.sendButtonEvent()
    },
    loadSketch() {
      if (this.present) {
        this.isLoading = true
        this.canvas.loadFromJSON(this.present, () => {
          this.isLoading = false
          this.canvas.renderAll()
        })
      } else {
        // 原数据不存在，默认保存一次
        // this.saveObjects(this.canvas.toJSON(),'保存1json')
      }
    },
    setSketchSize() {
      this.canvas.setDimensions({
        width: window.innerWidth,
        height: '400',
      })
      this.canvas.renderAll()
    },
    toJson() {
      let json = this.canvas.toJSON()
      console.log(json,'保存1json')
    },
    receiveMessage(e) {
      // console.log(e);
      if (e.data.type === 'sketch' && e.data.button) {
        console.log('changeButton: ', e)
        this.currentTool = e.data.button
      } else if (e.data.type === 'sketch-json') {
        console.log('loadFromJSON: ', e)
        this.canvas.loadFromJSON(e.data.json)
        this.canvas.renderAll()
      }
    },
    sendButtonEvent() {
      // console.log("sendButtonEvent");
      window.parent !== window &&
        window.parent.postMessage(
          {
            type: 'sketch',
            button: this.currentTool,
          },
          '*'
        )
    },
    sendSketchJson() {
      // console.log("sendSketchJson",this.canvas.toJSON(),'保存1json');
      window.parent !== window &&
        window.parent.postMessage(
          {
            type: 'sketch-json',
            json: JSON.stringify(this.canvas.toJSON()),
          },
          '*'
        )
    },
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.setSketchSize, false)
  },
}
</script>

<style>
.sketch-wrapper {
  position: relative;
  background-color: #fff;
  height: 400px;
}
.control-panel {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  height: 400px;
  user-select: none;
}
.captureStream{
  background-color: #fff;
}
.control-panel button.active {
  color: red;
}
</style>
