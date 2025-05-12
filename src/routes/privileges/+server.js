import {json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";

export async function GET(event) {
    const models = prisma['_runtimeDataModel']['models'];
    ['temp', 'litestream_lock', 'litestream_seq'].forEach(i => delete models[i]);
    const routes = [...Object.keys(models), 'privileges'];
    const roles = await prisma.roles.findMany({
        include: {
            permissions: true
        }
    })

    return json({
        resources: routes,
        roles: roles,
    })
}
