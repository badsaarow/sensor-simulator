// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const escpos = require('escpos')
const SerialPort = require('serialport')
const tableify = require('tableify')

const app = new Vue({
  el: "#app",
  data() {
    const vm = this
    return {
     connected: false,
     arduino: null,
     sensorData: null,
     pressed_button: null,
     recvs: []
    }
  },
  created() {
    this.showPorts()
  },
  methods: {
    showPorts() {
      SerialPort.list()
      .then((ports) => {
        console.log('ports', ports);
      
        document.getElementById('error').textContent = ''
        if (ports.length === 0) {
          document.getElementById('error').textContent = 'No ports discovered'
        }
      
        tableHTML = tableify(ports)
        document.getElementById('ports').innerHTML = tableHTML
      })
      .catch((err) => {
        document.getElementById('error').textContent = err.message
        return
      })
    },
    sendTest() {
      this.arduino.print('AT\n')
      this.arduino.flush((err) => {
        if (err) console.error(err)
      })
    },   
    createToInt(size) {
      if (size < 2) {
          throw new Error('Minimum size is 2');
      }
      else if (size > 64) {
          throw new Error('Maximum size is 64');
      }
  
      // Determine value range
      const maxValue = (1 << (size - 1)) - 1;
      const minValue = -maxValue - 1;
  
      return (value) => {
          if (value > maxValue || value < minValue) {
              throw new Error(`Int${size} overflow`);
          }
  
          if (value < 0) {
              return (1 << size) + value;
          }
          else {
              return value;
          }
      };
    }, 
    sendEvent() {
      if (!this.arduino) return
      console.log('start sendEvent')
      const repeatSender = () => {
        if (!this.connected) return
        this.sensorData = (this.pressed_button === 'reset' ? '01': '00') // reset
        this.sensorData += (this.pressed_button === 'pairing' ? '01': '00') //pairing
        let x = document.getElementsByName('sensor')
        for (let i=0; i < x.length; i++) {
          if (!x[i].value) this.sensorData += '00'
          else {
            const toInt8 = this.createToInt(8)
            let intNum = parseInt(x[i].value, 10)
            const hexStr = toInt8(intNum).toString(16).padStart(2, '0')
            this.sensorData += hexStr
          }
        }
        /*
        this.sensorData = x.map((v, i) => `${i}:${v.value}`).reduce((pre, curr) => {
          if (!pre) return `AT+SKSTAT=${curr}`
          return `${pre},${curr}`
        })
        */
        console.log('send sensorData', this.sensorData)
    
        this.arduino.print(this.sensorData + '\n')
    
        this.arduino.flush()
        setTimeout(repeatSender, 1000)
      }
      setTimeout(repeatSender, 1000)
    
      this.arduino.flush()
    },
    numHex(s) {
      const a = s.toString(16);
      if ((a.length % 2) > 0) {
          a = "0" + a;
      }
      return a;
    },
    closePort() {
      if (!this.arduino) return
      this.arduino.close(() => {
        console.log('port closed')
        this.connected = false
      });
      this.arduino = null
    },
    startPairing() {
      if (!this.arduino) return
      console.log('startPairing')
      this.arduino.print('AT+SKPAIR\n')
      this.arduino.flush()
    },
    openPort() {
      if (this.arduino) return
      console.log('openPort')
      this.recvs.length = 0
    
      const portName = document.getElementById("port").value
      const port = new escpos.Serial(portName, {
        baudRate: 9600,
        autoOpen: false
      });
      this.arduino = new escpos.Arduino(port);
    
      port.open(err => {
        if (err) {
          console.error(err)
          this.connected = false
          return
        }
    
        console.log('port opened')
        this.connected = true
        this.arduino.flush()
      })
    
      this.arduino.on('message', (data) => {
        if (!data) return
        console.log('message', data.toString())
        this.recvs.push(data)
        // #으로 시작하는 hex는 변경 device값
        if (data[0] === '#'.charCodeAt(0)) {
          for (let i=0; i < data.length -4 && i < 29; i+=1) {
            const hexValue = data.slice(i*2+1+4, i*2+1+2+4).toString()
            console.log(i, hexValue)
            document.getElementsByName('sensor')[i].value = parseInt(hexValue, 16) // 16진수로 표시
          }
        }
      })
    }
  }
})
