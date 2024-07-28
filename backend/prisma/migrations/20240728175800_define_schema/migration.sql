/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Processo" (
    "numero" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "valorDivida" REAL NOT NULL,
    "juiz" TEXT NOT NULL,
    "distribuicao" TEXT,
    "vara" TEXT NOT NULL,
    "dataPrescricao" DATETIME,
    "executado" TEXT,
    "assunto" TEXT,
    "foro" TEXT,
    "controle" TEXT
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "processoId" INTEGER NOT NULL,
    CONSTRAINT "Movimentacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("numero") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsuarioProcesso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "processoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsuarioProcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsuarioProcesso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("numero") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioProcesso_usuarioId_processoId_key" ON "UsuarioProcesso"("usuarioId", "processoId");
