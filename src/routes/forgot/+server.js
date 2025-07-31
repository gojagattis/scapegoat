import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import cryptoRandomString from 'crypto-random-string';

export async function POST(event) {
    const data = await event.request.json()
    const exists = await prisma.users.findUnique({
        where: {
            username: data.username
        }
    })

    if (!exists) {
        error(400, 'Invalid email')
    } else {
        data.key = cryptoRandomString({length: 31})
        await prisma.holding_area.create({
            data: data,
        })
        //Send email with magic link .../?flow=reset&key=data.key
        return json({message: 'Check email to continue.'})
    }
}
