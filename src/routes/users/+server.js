import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import {claims, cache} from "$lib/server/common.js";
import bcrypt from "bcrypt";

const entity = 'users'

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
    const params = event.url.searchParams;
    const skip = params.get('skip') ? parseInt(params.get('skip')) : 0;
    const take = params.get('take') ? parseInt(params.get('take')) : parseInt(import.meta.env.VITE_PAGE_SIZE);
    const sort = params.get('sort') ? params.get('sort') : 'created';
    const direction = params.get('direction') ? params.get('direction') : 'desc';
    const field = params.get('field') ? params.get('field') : null;
    const operator = params.get('operator') ? params.get('operator') : 'contains';
    const value = params.get('value') ? params.get('value') : null;
    const active = params.get('active') ? params.get('active') : 'true';
    const auth = claims(event)
    const schema = cache.get(entity)
    const user = schema.find(s => s.kind === 'object' && s.type === 'users' && !s.isList)

    let query = {}
    const filter = {}
    const or = []
    const and = []
    const arr = []

    if (schema.find(s => s.name === 'public' && s.type === 'Boolean') &&
        !(!user && event.possession.any)) {
        or.push(
            {
                public: true
            }
        )
    }

    if (user && event.possession.own) {
        and.push(
            {
                user: auth.user
            }
        )
    }

    if ((user && event.possession.any) || (!user && event.possession.own)) {
        and.push(
            {
                org: auth.org
            }
        )
    }

    if (schema.find(s => s.name === 'active' && s.type === 'Boolean')) {
        and.push(
            {
                active: active.toLowerCase() !== 'false'
            }
        )
    }

    if (value && !field) {
        const ignore = ['id', 'creator', 'org']
        const fields = schema.filter(r => r.type === 'String' && !ignore.includes(r.name))
        Array.from(fields).forEach(f => {
            arr.push(
                {
                    [f.name]: {
                        [operator]: value
                    },
                }
            )
        })
    }

    //Advanced search
    /*    if (value && field) {
            or.push(
                {
                    [field]: {
                        [operator]: value
                    },
                }
            )
        }*/

    if (or.length) {
        filter.OR = or
        if (and.length) {
            filter.OR.push(
                {
                    AND: and
                }
            )
        }
    } else if (and.length) {
        filter.AND = and
    }

    if (arr.length) {
        query.AND = [
            {
                OR: arr
            }
        ]
        if (filter) {
            query.AND.push(filter)
        }
    } else if (filter) {
        query = filter
    }

    log.debug(`Query: ${JSON.stringify(query, null, 2)}`)
    const data = await prisma.users.findMany({
        skip: skip,
        take: take,
        where: query,
        orderBy: {
            [sort]: direction
        }
    })
    return json(data.map(item => {
        delete item['password']
        return item
    }))
}
