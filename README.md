# ThinkCentre OLED Monitor

i2c ssd1309 1.54' OLED, Lenovo ThinkCentre M920q with Elementary OS (Ubuntu 18.04)

![demo](https://raw.githubusercontent.com/bikekoala/tc-oled/main/doc/images/demo.jpg)

## Usage

```bash
git clone https://github.com/bikekoala/tc-oled.git
cd tc-oled

sudo insmod doc/drivers/i2c-ch341-usb.ko
sudo chmod 0777 /dev/i2c*

cp .env.example .env
npm start
```

## License
[MIT](https://choosealicense.com/licenses/mit/)
