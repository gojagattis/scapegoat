import { error, json, redirect } from '@sveltejs/kit';
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import cryptoRandomString from 'crypto-random-string';

const TWO_FACTOR_AUTH = false

async function defaultRoles() {
    return await prisma.roles.findMany({
        where: {
            default: true
        },
        select: {
            id: true
        }
    })
}

export async function GET(event) {
    const params = event.url.searchParams
    const key = params.get('key')

    const user = await prisma.holding_area.findUnique({
        where: {
            key: key
        }
    })

    if (!user) {
        error(400, 'Invalid key')
    }
    await prisma.users.create({
        data: {
            username: user.username,
            password: user.password,
            roles: {
                connect: await defaultRoles()
            },
        },
    })
    await prisma.holding_area.deleteMany({
        where: {
            username: user.username
        }
    })
    return json({message: 'User verified successfully.\nLogin to continue.'})
}

export async function POST(event) {
    const data = await event.request.json()
    const exists = await prisma.users.findUnique({
        where: {
            username: data.username
        }
    })

    if (exists) {
        error(400, 'Email already exists')
    } else {
        delete data.extend
        if (data.password) {
            try {
                await bcrypt.getRounds(data.password) //will fail for plain text
            } catch (e) {
                data.password = await bcrypt.hash(data.password, 10)
            }
        }
        if (TWO_FACTOR_AUTH) {
            data.key = cryptoRandomString({length: 31})
            await prisma.holding_area.create({
                data: data,
            })
            //Send email with magic link .../?flow=signup&key=data.key
            return new Response(JSON.stringify({message: 'New user created.\nCheck email to continue.'}), {status: 202})
        } else {
            data.roles = {
                connect: await defaultRoles()
            }
            await prisma.users.create({
                data: data
            })
            return json({message: 'New user created.\nLogin to continue.'})
        }
    }
}
