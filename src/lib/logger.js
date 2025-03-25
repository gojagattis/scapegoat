import winston, {transports, format} from "winston";
import dayjs from "dayjs";

const options = {
    level: 'debug',
    host: 'localhost',
    port: '5080',
    path: '/api/<organization>/<stream>/_json',
    auth: {
        username: '<username>',
        password: '<password>',
    },
    ssl: false,
    batch: true,
    batchInterval: 5000,
    batchCount: 10,
    format: format.combine(
        format.splat(),
        format.printf(info => `${dayjs().format('h:mm:ss.SSS a')} ${info.level} ${info.message}`),
    ),
};

export const log = winston.createLogger({
    transports: [
        // new transports.Http(options),
        new transports.File({
            filename: "server.log",
            level: 'debug',
            format: format.combine(
                format.splat(),
                format.printf(info => `${dayjs().format('h:mm:ss.SSS a')} ${info.level} ${info.message}`),
            ),
        }),
        new transports.Console({
            level: 'debug',
            format: format.combine(
                format.splat(),
                format.printf(info => `${dayjs().format('h:mm:ss.SSS a')} ${info.level} ${info.message}`),
            ),
        }),
    ],
    // exceptionHandlers: new transports.Http(options),
    exitOnError: false
})
