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
    log.debug('Query: ' + e.query)
    log.debug('Params: ' + e.params)
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

prisma.$use(async (params, next) => {
    const before = Date.now()
    const result = await next(params)
    const after = Date.now()
    log.debug(`${params.model}.${params.action} ${after - before}ms`)

    return result
})
