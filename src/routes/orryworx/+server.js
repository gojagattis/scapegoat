import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import { claims, cache, where, graph } from '$lib/server/common.js';
import {limit} from "$lib/common";

export async function POST(event) {
    const data = await event.request.json();
    ['id', 'creator', 'created', 'updated'].forEach(i => delete data[i])
    data.creator = (claims(event)).sub
    const schema = cache.get(event.url.pathname.split('/')[1])
    const errors = []
    schema.forEach(s => {
        if (s.kind === 'scalar' && s.isRequired && !s.hasDefaultValue && (!data.hasOwnProperty(s.name) || (s.type === 'String' && !data[s.name].trim()))) {
            errors.push(s.name)
        }
    })
    if (errors.length) {
        error(400, `Required fields: ${errors.join(', ')}`)
    }
    let model = await prisma[event.locals.resource].create({
        data: data,
    })

    const permission = event.locals.permission
    if (model && permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            model = permission.filter(model)
        }
    }

    return json(model);
}

export async function GET(event) {
    const resource = event.locals.resource
    const params = Object.fromEntries(event.url.searchParams)
    const schema = cache.get(resource)
    const skip = params.skip ? Number(params.skip) : 0
    const take = params.take ? Number(params.take) : limit
    const order = params.order ?? 'created'
    const sort = params.sort ? params.sort : 'desc'
    const clause = params.where ? params.where : null
    const creator = !!params.creator
    const token = claims(event)
    const userRel = schema.find(s => s.kind === 'object' && s.type === 'users' && !s.isList)
    let fields
    let include = 'include'
    let value = {}
    let userCol, userRef
    if (userRel) {
        userCol = userRel.relationFromFields[0]
        userRef = userRel.relationToFields[0]
    }
    const schemas = {}
    let query = {}
    const filter = {}
    let ops = {
        OR: [],
        AND:[],
        NOT: []
    }

    if (clause) {
        ops = where(clause, schema)
    }

    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (userRel && !creator) {
            ops.AND.push( { [userCol]: userRef === 'id' ? token.sub : token.name } )
        } else if (creator) {
            ops.AND.push( { creator: token.sub } )
        } else {
            ops.AND.push( { id: token.sub } )
        }
    }

    fields = graph(params)
    if (fields) {
        const [k, v] = (Object.entries(fields))[0]
        include = k
        value = v
    }

    if (ops.OR.length) {
        filter.OR = ops.OR
    }
    if (ops.AND.length) {
        filter.AND = ops.AND
    }
    if (ops.NOT.length) {
        filter.NOT = ops.NOT
    }

    if (filter) {
        query = filter
    }

    log.debug(`Query: ${JSON.stringify(query, null, 2)}`)
    let [data, count] = await prisma.$transaction([
        prisma[resource].findMany({
            skip: skip,
            take: take,
            where: query,
            [include]: value,
            orderBy: {
                [order]: sort
            }
        }),
      prisma[resource].count({
          where: query,
      })
    ])
    if (data && permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            data = permission.filter(data)
        }
    }
    if (params.schema) {
        schemas[resource] = schema
        schema.forEach(m => {
            if (m.kind === 'object') {
                schemas[m.type] = cache.get(m.type)
            }
        })
    }
    return json({
        schemas: schemas,
        count: count,
        data: data
    })
}
