import prisma from './prismaClient'
import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import FastifySwagger from '@fastify/swagger'
import FastifySwaggerUI from '@fastify/swagger-ui'
import FastifyStatic from '@fastify/static'
import path from 'path'
import { readFileSync } from 'fs'

const app = fastify()

const SECRET_KEY = 'your-secret-key'

interface UserPayload {
  userId: number;
  email: string;
}

interface UserRequest extends FastifyRequest {
  user?: UserPayload;
}

// Carrega a documentação Swagger a partir do arquivo JSON
const swaggerDocument = JSON.parse(readFileSync(path.join(__dirname, 'swagger-docs.json'), 'utf8'))

// Registra o Swagger
app.register(FastifySwagger, {
  mode: 'static',
  specification: {
    document: swaggerDocument,
  },
})

// Registra o Swagger UI
app.register(FastifySwaggerUI, {
  routePrefix: '/documentacao',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false,
  },
  uiHooks: {
    onRequest: function (request, reply, next) { next() },
    preHandler: function (request, reply, next) { next() },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
})

// Configuração do Fastify Static para servir arquivos estáticos
app.register(FastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
})

// Middleware para autenticação
app.addHook('preHandler', async (request: UserRequest, reply: FastifyReply) => {
  // Permite acesso a rotas públicas sem autenticação
  const publicRoutes = ['/login', '/usuario', '/documentacao'];
  const currentPath = request.raw.url || '';

  if (publicRoutes.some(route => currentPath.startsWith(route))) {
    return; // Permite acesso a rotas públicas sem autenticação
  }

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
})

// Documentação para o endpoint GET /users
app.get('/usuario', async () => {
  const users = await prisma.usuario.findMany()
  return { users }
})

// Documentação para o endpoint POST /users
app.post('/usuario', async (request: FastifyRequest, reply: FastifyReply) => {
  const createUserSchema = z.object({
    nome: z.string(),
    email: z.string().email(),
    senha: z.string().min(6),
  })

  const { nome, email, senha } = createUserSchema.parse(request.body)

  const existingUser = await prisma.usuario.findUnique({
    where: { email },
  })

  if (existingUser) {
    return reply.status(409).send({ message: 'User already exists' })
  }''

  const hashedPassword = await bcrypt.hash(senha, 10)

  await prisma.usuario.create({
    data: {
      nome,
      email,
      senha: hashedPassword,
    },
  })

  return reply.status(201).send()
})

// Documentação para o endpoint POST /login
app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
  const loginSchema = z.object({
    email: z.string().email(),
    senha: z.string(),
  })

  const { email, senha } = loginSchema.parse(request.body)

  const user = await prisma.usuario.findUnique({
    where: { email },
  })

  if (!user || !(await bcrypt.compare(senha, user.senha))) {
    return reply.status(401).send({ message: 'Invalid credentials' })
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' })
  return { token }
})

// Documentação para o endpoint GET /processos/:numero
app.get('/processo/:numero', async (request: UserRequest, reply: FastifyReply) => {
  const numeroSchema = z.object({
    numero: z.number(),
  })

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
})

// Documentação para o endpoint GET /processos
app.get('/processo', async () => {
  const processos = await prisma.processo.findMany({
    orderBy: { dataPrescricao: 'asc' },
  })
  return { processos }
})

// Documentação para o endpoint GET /me/processos
app.get('/me/processo', async (request: UserRequest, reply: FastifyReply) => {
  const userId = request.user?.userId

  if (userId === undefined) {
    return reply.status(401).send({ message: 'Unauthorized' })
  }

  const recentProcessos = await prisma.usuarioProcesso.findMany({
    where: { usuarioId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const processos = await Promise.all(
    recentProcessos.map((item) =>
      prisma.processo.findUnique({
        where: { numero: item.processoId },
      })
    )
  )

  return { processos: processos.filter(Boolean) }
})

// Documentação para o endpoint PUT /movimentacoes/:id
app.put('/movimentacao/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const updateMovimentacaoSchema = z.object({
    tipo: z.string(),
  })

  try {
    const { id: paramId } = request.params as { id: string }
    const { tipo: bodyTipo } = request.body as { tipo: string }

    const { tipo } = updateMovimentacaoSchema.parse({
      tipo: bodyTipo,
    })

    const movimentacao = await prisma.movimentacao.update({
      where: { id: Number(paramId) },
      data: { tipo },
    })

    return { movimentacao }
  } catch (error) {
    console.error(error)
    return reply.status(500).send({ message: 'Internal Server Error' })
  }
})

app.listen({
  port: 3333,
  host: '0.0.0.0',
}, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Servidor ouvindo na porta ${address}`)
})
