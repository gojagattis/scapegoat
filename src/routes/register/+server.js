import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import {random} from "$lib/server/common.js";

const TWO_FACTOR_AUTH = false

async function defaultRoles(org) {
    return await prisma.roles.findMany({
        where: {
            OR: [
                {
                    org: org,
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
}

export async function GET(event) {
    const params = event.url.searchParams
    const nonce = params.get('nonce') ? params.get('nonce') : ''

    const genesis = await prisma.users.findFirst()

    const user = await prisma.temp.findUnique({
        where: {
            nonce: nonce
        }
    })

    if (!user) {
        return json({message: 'Invalid request'})
    }
    const roles = await defaultRoles(genesis.org)
    await prisma.users.create({
        data: {
            username: user.username,
            password: user.password,
            roles: {
                connect: roles
            },
            creator: genesis.user,
            org: genesis.org,
        },
    })
    await prisma.temp.deleteMany({
        where: {
            username: user.username
        }
    })
    return json({message: 'User verified successfully.\nLogin to continue.'})
}

export async function POST(event) {
    const data = await event.request.json()
    let users = await prisma.users.findMany({
        where: {
            username: data.username
        }
    })
    users = Array.from(users)

    if (users.length) {
        throw error(404, 'Email already exists')
    } else {
        data.nonce = random(64)
        if (data.password) {
            try {
                await bcrypt.getRounds(data.password) //will fail for plain text
            } catch (e) {
                data.password = await bcrypt.hash(data.password, 10)
            }
        }
        if (TWO_FACTOR_AUTH) {
            await prisma.temp.create({
                data: data,
            })
            //Send email with url like /register?nonce=...
            return json({message: 'User created successfully.\nCheck email to continue.'})
        } else {
            const genesis = await prisma.users.findFirst()
            const roles = await defaultRoles(genesis.org)
            await prisma.users.create({
                data: {
                    username: data.username,
                    password: data.password,
                    roles: {
                        connect: roles
                    },
                    creator: genesis.user,
                    org: genesis.org,
                },
            })
            return json({message: 'User created successfully.\nLogin to continue.'})
        }
    }
}
