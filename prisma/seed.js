const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const listaDeStatus = [{
    status: "Aguardando",
    descricao: "Aguardando o horário que permite agendamentos para o dia especificado"
},
{
    status: "Agendado",
    descricao: "Almoço agendado com sucesso"
},
{
    status: "Tentando",
    descricao: "Não foi possível agendar no horário que é liberado o agendamento, vamos continuar tentando agendar para a data especificada"
},
{
    status: "Cancelado",
    descricao: "Esse pedido de agendamento foi cancelado"
},
{
    status: "Vencido",
    descricao: "Não foi possível agendar almoço na data especificada e essa data já passou"
}]

async function main() {
  console.log(`Iniciando a alimentação do banco de dados...`)
  for (const s of listaDeStatus) {
    const status = await prisma.status.create({
      data: s,
    })
    console.log(`Criado status com o id: ${status.id}`)
  }
  console.log(`Alimentação do banco de dados concluída`)
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