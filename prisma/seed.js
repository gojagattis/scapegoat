import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient()
const exclude = ['litestream_lock', 'litestream_seq', 'holding_area']

async function main() {
    const users = await prisma.users.findMany({})
    if (users.length === 0) {
        const sa = await prisma.users.create({
            data: {
                username: 'admin',
                password: await bcrypt.hash('admin', 10),
            },
        })

        const demo = await prisma.users.create({
            data: {
                username: 'demo',
                password: await bcrypt.hash('demo', 10),
                creator: sa.id,
            },
        })

        await prisma.roles.create({
            data: {
                name: 'Admin',
                creator: sa.id,
                users: {
                    connect: [ { id: sa.id } ]
                }
            },
        })

        await prisma.roles.create({
            data: {
                name: 'User',
                default: true,
                creator: sa.id,
                users: {
                    connect: [ { id: demo.id } ]
                }
            },
        })

        const resources = []
        const models = prisma['_runtimeDataModel']['models']
        Object.keys(models).forEach(m => {if (!exclude.includes(m)) resources.push(m)})
        const actions = ['create:any', 'read:any', 'update:any', 'delete:any']

        for (const resource of resources) {
            for (const action of actions) {
                try {
                    await prisma.permissions.create({
                        data: {
                            role: 'Admin',
                            resource: resource,
                            action: action,
                            attributes: resource === 'users' && action === 'read:any' ? '*, !password' : '*',
                            creator: sa.id,
                        },
                    });
                } catch (e) {
                    console.log(e)
                }
            }
        }

        await prisma.permissions.create({
            data: {
                role: 'Admin',
                resource: 'privileges',
                action: 'read:any',
                creator: sa.id,
            },
        })

        await prisma.permissions.create({
            data: {
                role: 'User',
                resource: 'users',
                action: 'read:own',
                attributes: '*, !password',
                creator: sa.id,
            },
        })
    }
}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
