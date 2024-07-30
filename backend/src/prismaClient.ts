// prismaClient.ts
import { PrismaClient } from '@prisma/client';
import { addYears } from 'date-fns';

const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  if (params.model === 'Movimentacao' && params.action === 'create') {
    const movimentacao = params.args.data;
    if (movimentacao.tipo.toLowerCase() === 'penhora') {
      const newDataPrescricao = addYears(new Date(movimentacao.data), 6);
      await prisma.processo.update({
        where: { numero: movimentacao.processoId },
        data: { dataPrescricao: newDataPrescricao },
      });
    }
  }
  return next(params);
});

export default prisma;
