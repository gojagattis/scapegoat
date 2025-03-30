import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import cryptoRandomString from 'crypto-random-string';

export async function POST(event) {
    const data = await event.request.json();
    let users = await prisma.users.findMany({
        where: {
            username: data.username
        }
    })
    users = Array.from(users)

    if (!users.length) {
        throw error(404, 'Invalid email')
    } else {
        data.nonce = cryptoRandomString({length: 64})
        data.username = users[0].username
        data.userId = users[0].id
        await prisma.temp.create({
            data: data,
        })
        //Send email with url like /reset?nonce=...
        return json({message: 'Check email to continue.'})
    }
}
