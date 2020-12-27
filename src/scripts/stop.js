require('dotenv').config()
const OLED = require('../libs/oled')

const initOLED = () => {
  const options = {
    width:   process.env.OLED_WIDTH,
    height:  process.env.OLED_HEIGHT,
    address: Number(process.env.OLED_ADDRESS),
    device:  process.env.OLED_DEVICE
  }

  return  new OLED(options)
}

const mOled = initOLED()
mOled.turnOffDisplay()
