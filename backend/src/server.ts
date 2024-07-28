import { PrismaClient } from '@prisma/client'
import fastify from 'fastify'
import { z } from 'zod'

const app = fastify()

const prisma = new PrismaClient()

app.get('/users', async ()=>{
    const users = await prisma.usuario.findMany()

    return {users}
})
app.post('/users', async (request, reply)=>{
    const createUserSchema = z.object({
        nome: z.string(),
        email: z.string().email(),
        senha: z.string()
    })

    const { email, senha, nome } = createUserSchema.parse(request.body)

    await prisma.usuario.create({
        data:{
            email,
            senha,
            nome
        }
    })

    return reply.status(201).send
})

app.listen({
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 3333,
}).then(()=>{
    console.log('HTTP Server Running')
})