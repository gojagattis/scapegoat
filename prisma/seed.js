import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient()
const exclude = ['litestream_lock', 'litestream_seq']

async function main() {
    const users = await prisma.users.findMany({})
    if (users.length === 0) {
        const sa = await prisma.users.create({
            data: {
                username: 'admin',
                password: await bcrypt.hash('admin', 10),
                owner: 'admin',
            },
        })

        await prisma.users.update({
            data: {
                owner: sa.id,
            },
            where: {
                id: sa.id
            }
        })

        const demo = await prisma.users.create({
            data: {
                username: 'demo',
                password: await bcrypt.hash('demo', 10),
                owner: sa.id,
            },
        })

        const admin = await prisma.roles.create({
            data: {
                name: 'Admin',
                owner: sa.id,
                users: {
                    connect: [ { id: sa.id } ]
                }
            },
        })

        const user = await prisma.roles.create({
            data: {
                name: 'User',
                owner: sa.id,
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
                            owner: sa.id,
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
                owner: sa.id,
            },
        })

        await prisma.permissions.create({
            data: {
                role: 'User',
                resource: 'users',
                action: 'read:own',
                attributes: '*, !password',
                owner: sa.id,
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
