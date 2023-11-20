const winston = require('winston');
const path = require('node:path'); 

const logConfiguration = {
    'transports': [
        new (winston.transports.Console)(),
        new winston.transports.File({
            filename: path.resolve(__dirname, "../logs/logs-sesc.log")
        })
    ],
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD-MM-YYYY HH:mm:ss'
        }),
        winston.format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
    )
};

const logger = winston.createLogger(logConfiguration);

module.exports = logger