import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import { claims, cache, where, graph } from '$lib/server/common.js';
import bcrypt from "bcrypt";

export async function POST(event) {
    try {
        const data = await event.request.json();
        ['id', 'org', 'creator', 'created', 'updated'].forEach(i => delete data[i]);
        const owner = claims(event)
        data.creator = owner.user
        data.org = owner.org
        if (data.password) { //hash password if it is plaintext
            try {
                await bcrypt.getRounds(data.password) //will fail for plain text
            } catch (e) {
                data.password = await bcrypt.hash(data.password, 10)
            }
        }
        if (data.hasOwnProperty('public') && event.possession.own) {
            delete data.public
        }
        const roles = await prisma.roles.findMany({
            where: {
                OR: [
                    {
                        org: owner.org,
                    },
                    {
                        public: true,
                    },
                ],
                AND: {
                    default: true,
                },
            },
            select: {
                id: true
            }
        })
        data['roles'] = {
            connect: roles
        }
        const model = await prisma.users.create({
            data: data,
        });

        return json(model);
    } catch (e) {
        log.error(e)
        throw error(400, e)
    }
}

export async function GET(event) {
    const params = Object.fromEntries(event.url.searchParams)
    const metadata = cache.get(event.url.pathname.split('/')[1])
    const schema = params.schema ? params.schema : null
    if (schema === 'only') {
        return json(metadata)
    }

    const skip = params.skip ? parseInt(params.skip) : 0
    const take = params.take ? parseInt(params.take) : 25
    const order = params.order ?? 'created'
    const sort = params.asc ? 'asc' : 'desc'
    const clause = params.where ? params.where : null
    const creator = !!params.creator
    const token = claims(event)
    const userRel = metadata.find(s => s.kind === 'object' && s.type === 'users' && !s.isList)
    let fields
    let include = 'include'
    let value = {}
    let userCol, userRef
    if (userRel) {
        userCol = userRel.relationFromFields[0]
        userRef = userRel.relationToFields[0]
    }

    let query = {}
    const filter = {}
    let ops = {
        OR: [],
        AND:[],
        NOT: []
    }

    if (clause) {
        ops = where(clause)
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
        log.debug(`######### ${JSON.stringify(fields, null, 2)}`);
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
    let data = await prisma.users.findMany({
        skip: skip,
        take: take,
        where: query,
        [include]: value,
        orderBy: {
            [order]: sort
        }
    })
    if (data && permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            data = permission.filter(data)
        }
    }
    if (schema === 'include') {
        return json({
            schema: metadata,
            data: data
        })
    }
    return json(data)
}
