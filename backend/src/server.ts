import { PrismaClient } from '@prisma/client'
import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = fastify()
const prisma = new PrismaClient()

const SECRET_KEY = 'your-secret-key'

interface UserPayload {
  userId: number;
  email: string;
}

interface UserRequest extends FastifyRequest {
  user?: UserPayload;
}

// Middleware para autenticação
app.addHook('preHandler', async (request: UserRequest, reply: FastifyReply) => {
  if (request.routerPath !== '/login' && request.routerPath !== '/users') {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as UserPayload
      request.user = decoded
    } catch (err) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }
  }
})

app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const users = await prisma.usuario.findMany()
    return { users }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  const createUserSchema = z.object({
    nome: z.string(),
    email: z.string().email(),
    senha: z.string().min(6),
  })

  try {
    const { nome, email, senha } = createUserSchema.parse(request.body)

    // Verifica se o usuário já existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email },
    })

    if (existingUser) {
      return reply.status(400).send({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(senha, 10)

    await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
      },
    })

    return reply.status(201).send()
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
  const loginSchema = z.object({
    email: z.string().email(),
    senha: z.string(),
  })

  try {
    const { email, senha } = loginSchema.parse(request.body)

    const user = await prisma.usuario.findUnique({
      where: { email },
    })

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return reply.status(401).send({ message: 'Invalid credentials' })
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' })
    return { token }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.get('/processos/:numero', async (request: UserRequest, reply: FastifyReply) => {
  const numeroSchema = z.object({
    numero: z.number(),
  })

  try {
    const { numero } = numeroSchema.parse(request.params)
    const userId = request.user?.userId

    if (userId === undefined) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const processo = await prisma.processo.findUnique({
      where: { numero },
    })

    if (!processo) {
      return reply.status(404).send({ message: 'Process not found' })
    }

    await prisma.usuarioProcesso.upsert({
      where: { usuarioId_processoId: { usuarioId: userId, processoId: numero } },
      update: { createdAt: new Date() },
      create: { usuarioId: userId, processoId: numero },
    })

    // Limita o histórico a 10 processos
    const recentSearches = await prisma.usuarioProcesso.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
      skip: 10,
    })

    const idsToDelete = recentSearches.map((search) => search.id)
    if (idsToDelete.length > 0) {
      await prisma.usuarioProcesso.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }

    return { processo }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.get('/processos', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const processos = await prisma.processo.findMany({
      orderBy: { dataPrescricao: 'asc' },
    })
    return { processos }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.get('/me/processos', async (request: UserRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId
    if (userId === undefined) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const processos = await prisma.usuarioProcesso.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { processo: true },
    })
    return { processos: processos.map((p) => p.processo) }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.get('/processos/:numero/movimentacoes', async (request: FastifyRequest, reply: FastifyReply) => {
  const numeroSchema = z.object({
    numero: z.number(),
  })

  try {
    const { numero } = numeroSchema.parse(request.params)

    const movimentacoes = await prisma.movimentacao.findMany({
      where: { processoId: numero },
    })

    return { movimentacoes }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.put('/movimentacoes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const updateMovimentacaoSchema = z.object({
    id: z.number(),
    tipo: z.string(),
  })

  try {
    const { id: paramId } = request.params as { id: string }
    const { tipo: bodyTipo } = request.body as { tipo: string }

    const { id, tipo } = updateMovimentacaoSchema.parse({
      id: Number(paramId),
      tipo: bodyTipo,
    })

    const movimentacao = await prisma.movimentacao.update({
      where: { id },
      data: { tipo },
    })

    return { movimentacao }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.listen({
  host: '0.0.0.0',
  port: process.env.PORT ? Number(process.env.PORT) : 3333,
}).then(() => {
  console.log('HTTP Server Running')
})
