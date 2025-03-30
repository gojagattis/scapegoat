import {PrismaClient} from "@prisma/client";
import {log} from "./logger.js";

export const prisma = new PrismaClient({
    log: [
        {
            emit: 'event',
            level: 'query',
        },
        {
            emit: 'event',
            level: 'error',
        },
        {
            emit: 'event',
            level: 'info',
        },
        {
            emit: 'event',
            level: 'warn',
        },
    ],
})

prisma.$on('query', (e) => {
    log.debug(`${e.query} ${e.params} ${e.duration}ms`)
})

prisma.$on('error', (e) => {
    log.error(e)
})

prisma.$on('info', (e) => {
    log.info(e)
})

prisma.$on('warn', (e) => {
    log.warn(e)
})
