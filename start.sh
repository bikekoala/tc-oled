#!/bin/bash

insmod doc/drivers/i2c-ch341-usb.ko
chmod 0777 /dev/i2c-*
npm start
