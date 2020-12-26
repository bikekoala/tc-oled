require('dotenv').config()
const OLED = require('../libs/oled')
const font = require('oled-font-5x7')
const pngparse = require('pngparse')
const si = require('systeminformation')
const moment = require('moment')
const Twitter = require('twitter')

/**
 * initialize oled screen
 */
const initOLED = () => {
  const options = {
    width:   process.env.OLED_WIDTH,
    height:  process.env.OLED_HEIGHT,
    address: Number(process.env.OLED_ADDRESS),
    device:  process.env.OLED_DEVICE
  }

  const oled = new OLED(options)
  oled.dimDisplay(true)
  oled.update()

  return oled
}

/**
 * clear oled screen
 */
const clearOLED = () => {
  mData.intervalIDs.map(id => clearInterval(id))
  mData.intervalIDs = []
  mOled.clearDisplay()
}

/**
 * allocate a random coordinate
 */
const allocXY = (maxX, maxY) => {
  const getRandomIntInclusive = (min, max) => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

  const x = getRandomIntInclusive(0, maxX)
  const y = getRandomIntInclusive(0, maxY)

  return { x, y }
}

/**
 * calculate element coordinate
 */
const calcElementXY = (x, y, height) => {
  height = typeof height === 'number' ? height : font.height

  const nx = x + mData.icon.width + mData.eleSpacing
  const ny = y + Math.round((mData.icon.height - height) / 2)

  return {
    x: nx,
    y: ny
  }
}

/**
 * calculate digit coordinate from right
 */
const calcElementDigitXY = (x, y, count = 2) => {
  const nx = x + mData.width - (mData.digit.width * count + mData.digit.spacing)
  const ny = y + Math.round((mData.icon.height - mData.digit.height) / 2)

  return {
    x: nx,
    y: ny
  }
}

/**
 * fetch one twitter text
 */
const getTweet = (name = 'realDonaldTrump') => {
  const client = new Twitter({
    consumer_key:        process.env.TWITTER_API_KEY,
    consumer_secret:     process.env.TWITTER_API_SECRET_KEY,
    access_token_key:    process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  })

  const params = {
    'screen_name': name,
    'count': 10
  }

  return new Promise((resolve, reject) => {
    client.get('statuses/user_timeline', params).then(data => {
      let tweet = 'empty'
      for (const item of data) {
        if (item.text.startsWith('http')) continue
        tweet = item.text + ' -- ' + item.user.name
        break
      }
      resolve(tweet)
    }).catch(err => {
      console.log(0, err)
      resolve('[err] ' + (err[0] ? err[0].message : err))
    })
  })
}

/**
 * scroll text from right to left
 * compatible for ssd1309
 */
const scrollTextLeft = (x, y, text, width = 0, delay = 50) => {
  let i = 0
  return setInterval(() => drawString(x, y, text, width, i--), delay)
}

/**
 * draw string by bitmap
 */
const drawString = (x, y, text, width, position = 0) => {
  // collect all bytes
  let bytes = []
  const chars = text.split('')
  for (let i = 0; i < chars.length; i++) {
    const charBuf = mOled._findCharBuf(font, chars[i])
    const charBytes = mOled._readCharBytes(charBuf)
    if (chars[i] === ' ') {
      bytes = bytes.concat(charBytes)
    } else {
      const fillLength = charBytes[0] ? charBytes[0].length : 0
      bytes = bytes.concat(charBytes, [Array(fillLength).fill(0)])
    }
  }

  // scroll the bytes
  if (position < 0) {
    const byteParts = bytes.splice(0, -position % bytes.length)
    bytes = bytes.concat(byteParts)
  } else {
    const byteParts = bytes.splice(-position % bytes.length)
    bytes = byteParts.concat(bytes)
  }

  // resize the display width
  const availableWidth = mOled.WIDTH - x
  const targetWidth = width <= 0 || width > availableWidth ? availableWidth : width
  bytes = bytes.splice(0, targetWidth)

  // convert to bitmap
  const bitmap = []
  for (let i = 0; i < bytes[0].length; i++) {
    for (let j = 0; j < bytes.length; j++) {
      bitmap.push(bytes[j][i])
    }
  }

  // draw bitmap
  mOled.setCursor(x, y)
  mOled.drawBitmap(Buffer.from(bitmap), bytes.length)
}

/**
 * draw bitmap from asstes
 */
const drawBitmap = (x, y, file, dir = 'icons') => {
  const filepath = __dirname + '/../assets/' + dir + '/' + file
  return new Promise((resolve, reject) => {
    pngparse.parseFile(filepath, (err, image) => {
      if (err) return reject(err)
      mOled.setCursor(x, y)
      mOled.drawBitmap(image.data, image.width)
      return resolve(image)
    })
  })
}

/**
 * draw dot-intege-rnumber
 */
const drawDigit = (x, y, number) => {
  const numbers = number.toString().split('')
  for (const i in numbers) {
    x = i == 0 ? x : x + mData.digit.spacing + mData.digit.width + 1
    const filename = numbers[i] + '.png'
    drawBitmap(x, y, filename, 'digits')
  }
}

/**
 * draw bar chart
 */
const drawBarChart = (x, y, w, h, percent, cpuMatrix = []) => {
  const genColumn = percent => {
    const data = []
    const value = Math.ceil(percent * h)
    for (let i = h - 1; i >= 0; i--) {
      data.push(i >= value ? 0 : 1)
    }
    return data
  }

  if (cpuMatrix.length === 0) {
    const lastRow = []
    for (let i = 0; i < w; i++) {
      lastRow.push(i % 3 ? 0 : 1)
    }

    for (let i = 0; i < h; i++) {
      cpuMatrix[i] = i === h - 1 ? lastRow : Array(w).fill(0)
    }
  }

  const bitmap = []
  const column = genColumn(percent)
  for (const i in cpuMatrix) {
    const row = cpuMatrix[i]
    row.shift()
    row.push(column[i])
    row.map(bit => bitmap.push(bit))
  }

  mOled.setCursor(x, y)
  mOled.drawBitmap(Buffer.from(bitmap), w)
}

/**
 * module - cpu usage
 */
const showCpuUsage = (x, y) => {
  drawBitmap(x, y, 'cpu.png').then((image, err) => {
    const matrix = []
    const barWidth = 95
    const barHeight = 10
    mData.intervalIDs.push(setInterval(() => {
      si.currentLoad().then(data => {
        const load = Math.round(data.currentload)
        const coord = calcElementXY(x, y, barHeight)
        drawBarChart(coord.x, coord.y, barWidth, barHeight, load / 100, matrix)

        const string = load < 10 ? '0' + load : load
        const coord1 = calcElementDigitXY(x, y)
        drawDigit(coord1.x, coord1.y, string)
      })
    }, 1000))
  })
}

/**
 * module - memory usage
 */
const showMemoryUsage = (x, y) => {
  drawBitmap(x, y, 'memory.png').then((image, err) => {
    const matrix = []
    const barWidth = 95
    const barHeight = 10
    mData.intervalIDs.push(setInterval(() => {
      si.mem().then(data => {
        const usage = Math.round((data.total -data.available) / data.total * 100)
        const coord = calcElementXY(x, y, barHeight)
        drawBarChart(coord.x, coord.y, barWidth, barHeight, usage / 100, matrix)

        const string = usage < 10 ? '0' + usage : usage
        const coord1 = calcElementDigitXY(x, y)
        drawDigit(coord1.x, coord1.y, string)
      })

    }, 1000))
  })
}

/**
 * module - system info
 */
const showSystemInfo = (x, y) => {
  drawBitmap(x, y, 'dashboard.png').then((image, err) => {
    mData.intervalIDs.push(setInterval(() => {
      const time = si.time()
      const uptime = moment(time.uptime * 1000).format('hh:mm:ss')

      const coord = calcElementXY(x, y)
      mOled.setCursor(coord.x, coord.y)
      mOled.writeString(font, 1, uptime)

      si.cpuCurrentspeed().then(data => {
        mOled.setCursor(coord.x + 63, coord.y)
        mOled.writeString(font, 1, data.avg.toString())
      })

      si.cpuTemperature().then(data => {
        const coord = calcElementDigitXY(x, y)
        drawDigit(coord.x, coord.y, data.main)
      })
    }, 1000))
  })
}

/**
 * module - network
 */
const showNetwork = (x, y) => {
  drawBitmap(x, y, 'twitter.png').then((image, err) => {
    let intervalId
    const drawTweet = () => {
      getTweet().then(tweet => {
        clearInterval(intervalId)
        const width = x + mData.width - mData.icon.width - mData.eleSpacing
        const coord = calcElementXY(x, y)
        intervalId = scrollTextLeft(coord.x, coord.y, tweet + ' ', width)
        mData.intervalIDs.push(intervalId)
      })
    }

    drawTweet()
    mData.intervalIDs.push(setInterval(() => drawTweet(), 60000))
  })
}

/**
 * display modules
 */
const run = () => {
  const spacingY = mData.icon.height + mData.modSpacing
  const maxX = mOled.WIDTH - mData.width - 1
  let maxY = mOled.HEIGHT - mData.height - 1
  let { x, y } = allocXY(maxX, maxY)

  clearOLED()
  showCpuUsage(x, y)
  showMemoryUsage(x, y += spacingY)
  showSystemInfo(x, y += spacingY)
  showNetwork(x, y += spacingY)
}

// start
const mData = {
  width: 125,      // available width
  height: 56,      // available height
  eleSpacing: 4,   // element spacing
  modSpacing: 3,   // module spacing
  intervalIDs: [], // interval ids
  icon: {          // icon
    width: 12,
    height: 12
  },
  digit: {         // dot number
    width: 5,
    height: 9,
    spacing: 1
  }
}
const mOled = initOLED()

run()
setInterval(() => run(), 60000)

// clear display when catch an signal
process.on('SIGINT', () => {
  setTimeout(() => process.exit(), 1000)
})
