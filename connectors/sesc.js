require('dotenv').config({ path: '../.env' })
const logger = require('./logger')
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const UO_24_DE_MAIO = 52
const UO_BELENZINHO = 62
const UO_CAMPINAS = 75
const UO_CARMO = 64
const UO_GUARULHOS = 73
const UO_INTERLAGOS = 55
const UO_ITAQUERA = 56
const UO_PINHEIROS = 58
const UO_POMPEIA = 63
const UO_SANTO_ANDRE = 88
const UO_SANTOS = 78
const UO_VILA_MARIANA = 66

const FUSO_SERVIDOR = process.env.FUSO || -3 //por padrao será -3 pois executando local a máquina está configurada com o horario de brasilia

let processando = false
let listaStatus = null
let statusAguardando = null
let statusAgendado = null
let statusTentando = null
let statusVencido = null

async function carregarStatus() {
    listaStatus = await prisma.status.findMany()
    statusAguardando = listaStatus.find(itemStatus => itemStatus.status == 'Aguardando')
    statusAgendado = listaStatus.find(itemStatus => itemStatus.status == 'Agendado')
    statusTentando = listaStatus.find(itemStatus => itemStatus.status == 'Tentando')
    statusVencido = listaStatus.find(itemStatus => itemStatus.status == 'Vencido')
}

async function logar(usuario) {
    const login = await axios({
        method: 'post',
        url: 'https://centralrelacionamento-api.sescsp.org.br/autenticacao/login',
        data: {
            'cpf': usuario.cpf,
            'credencial': '',
            'senha': usuario.senha,
            'audit': {
                'ip': `23.37.223.${Math.floor(Math.random() * 255)}`,
                'location': null,
                'device': {
                    'ua': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
                }
            }
        }
    })
    return login.data
}

async function logarUsuarios(usuarios) {
    for (usuario of usuarios) {
        usuario.login = await logar(usuario)
    }
}


function criarHeader(usuariosLogados) {
    for (usuarioLogado of usuariosLogados) {
        let header = {
            Authorization: `Bearer ${usuarioLogado.login.auth_token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
        }
        usuarioLogado.header = header
    }
}


async function entrarNaFila(header) {
    let fila = null
    let contador = 0
    while (fila == null) {
        contador = contador + 1
        if (contador > 3) {
            throw new Error('Numero maximo de tentativas para entrar na fila excedido')
        }

        try {
            fila = await axios({
                method: 'post',
                url: 'https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/fila',
                data: {
                    unidade: UO_SANTOS,
                    credenciais: []
                },
                headers: header
            })
        } catch (erro) {
            logger.error(erro.message)
        }
    }

    return fila
}

async function verificarStatusFila(header) {
    let statusFila = null
    let contador = 0

    while (statusFila == null) {
        contador = contador + 1
        if (contador > 3) {
            throw new Error('Numero maximo de tentativas para verificar o status da fila excedido')
        }

        try {
            statusFila = await axios({
                method: 'get',
                url: `https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/fila?uo=${UO_SANTOS}`,
                headers: header
            })
        } catch (erro) {
            logger.error(erro.message)
        }
    }
    logger.info(JSON.stringify(statusFila.data));
    return statusFila
}

async function listarHorariosDisponiveis(credencial, header) {
    const horarios = await axios({
        method: 'get',
        url: `https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/unidades-horarios?uo=${UO_SANTOS}&credenciais=${credencial}`,
        headers: header
    })
    return horarios.data.horarios
}

async function agendarAlmoco(usuario, horarioId) {
    let agendar = null
    let contador = 0

    while (agendar == null) {

        contador = contador + 1
        if (contador > 3) {
            throw new Error('Numero maximo de tentativas para verificar o status do agendamento excedido')
        }

        try {
            agendar = await axios({
                method: 'post',
                url: 'https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/agendar',
                data: {
                    credenciais: [usuario.login.credencial],
                    horarioId: horarioId
                },
                headers: usuario.header
            })

            logger.info(`horario agendado com sucesso!`)

            prisma.agendamento.update({
                where: {
                    id: usuario.id
                },
                data: { 
                    statusId: statusAgendado.id
                }
            })


        } catch (erro) {
            logger.error(JSON.stringify(erro.response.data))
            logger.error(erro.message)
        }
    }


    return agendar
}

async function agendarAlmocoDeTodos(usuariosLogados) {
    let resultadoFila = await Promise.all(usuariosLogados.map(usuarioLogado => entrarNaFila(usuarioLogado.header)))
    let contadorErros = 0
    while (!resultadoFila.every((resultado => resultado.data.status == 'LIBERADO'))) {
        if (resultadoFila.some((resultado => resultado.data.status == 'ESGOTADO'))) {
            contadorErros = contadorErros + 1
            if (contadorErros <= 3) {
                await new Promise(resolve => setTimeout(resolve, 100))
            } else {
                throw new Error('Vagas esgotadas!')
            }
        }
        resultadoFila = await Promise.all(usuariosLogados.map(usuarioLogado => verificarStatusFila(usuarioLogado.header)))
    }

    let horariosApi = await listarHorariosDisponiveis(usuariosLogados[0].login.credencial, usuariosLogados[0].header)
    let listaHorarios = []

    if (horariosApi.hasOwnProperty('manha')) {
        for (horario of horariosApi.manha) {
            if (horario.disponivel == true) {
                listaHorarios.push(horario)
            }
        }
    }
    if (horariosApi.hasOwnProperty('tarde')) {
        for (horario of horariosApi.tarde) {
            if (horario.disponivel == true) {
                listaHorarios.push(horario)
            }
        }
    }

    let resultadoAgendamento = null
    let usuariosAgendadosParaRemover = []
    for (usuarioLogado of usuariosLogados) {
        const itemHorarioEscolhido = listaHorarios.find(horario => horario.horarioInicio == usuarioLogado.agendarParaHorario)
        if (itemHorarioEscolhido) {
            resultadoAgendamento = await agendarAlmoco(usuarioLogado, itemHorarioEscolhido.id)
            if (resultadoAgendamento.status = 200) {
                logger.info(`horario do usuario ${usarioLogado.cpf} agendado com sucesso!`)
                usuariosAgendadosParaRemover.push(usuarioLogado)
            }
        }
    }

    for (usuarioParaRemover of usuariosAgendadosParaRemover) {
        let indiceParaRemover = usuariosLogados.findIndex(usuarioLogado => usuarioLogado == usuarioParaRemover)
        usuariosLogados = usuarioLogados.splice(indiceParaRemover, 1)
    }

    listaHorarios = listaHorarios.reverse()

    for (horario of listaHorarios) {
        try {
            resultadoAgendamento = await Promise.all(usuariosLogados.map(usuarioLogado => agendarAlmoco(usuarioLogado, horario.id)))

            if (resultadoAgendamento.every((resultado => resultado.status == 200))) {
                break
            }
        }
        catch (erro) {
            logger.error(erro.message)
        }
    }
}

async function processoAgendamentoSesc1430() {
    if (processando)
        return

    await carregarStatus()

    let agora = new Date();
    let inicio = null
    let fim = null


    logger.info('processo de agendamento das 14:30 (liberação de horários amanhã)')
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 0 + FUSO_SERVIDOR, 0, 0);
    logger.info(inicio.toISOString())
    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 23 + FUSO_SERVIDOR, 59, 0);
    logger.info(fim.toISOString())


    let execucoesAgendadas = await prisma.agendamento.findMany({
        where: {
            agendarParaDia: {
                gte: inicio,    // gte significa "maior ou igual a"
                lte: fim    // lt significa "menor que"
            },
            statusId: statusAguardando.id
        }
    })

    if (execucoesAgendadas.length == 0)
        return

    await prisma.agendamento.updateMany({
        where: {
            agendarParaDia: {
                gte: inicio,    // gte significa "maior ou igual a"
                lte: fim    // lt significa "menor que"
            },
            OR: [
                { status: statusAguardando },
                { status: statusTentando }
            ]
        },
        data: {
            statusId: statusTentando.id
        }
    })

    try {
        //faz o login para todos os usuarios configurados no .env
        await logarUsuarios(execucoesAgendadas)

        //cria uma lista de headers com a autenticação para cada usuario
        criarHeader(execucoesAgendadas)

        //esperar até 17:30 UTC (14:30 de brasilia (GMT -3))
        agora = new Date()
        let milisegundosAte1430 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 17 + FUSO_SERVIDOR, 29, 0, 800) - agora
        logger.info(`milisegundos ate 14:30 = [${milisegundosAte1430}]`)
        //as 14:30 de brasilia executa a funcao agendarAlmocoDeTodos
        if (milisegundosAte1430 > 0) {
            await new Promise(resolve => setTimeout(resolve, milisegundosAte1430))
        }
        await agendarAlmocoDeTodos(execucoesAgendadas)
    }
    catch (erro) {
        logger.error(erro.message)
    }

}

async function processoAgendamentoSesc() {
    if (processando)
        return

    await carregarStatus()

    let agora = new Date();
    let inicio = null
    let fim = null

    if (agora.getHours() == 14 && agora.getMinutes() < 30) {
        logger.info('Horário atual entre 14 e 14:30, agora só serão feitas tentativas de agendamento para amanhã, iniciaremos as tentativas as 14:30')
        return
    }
    if (agora.getHours() < 14) {
        logger.info('como ainda não deu 14 horas vamos procurar agendamentos pendentes para hoje')
        inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0 + FUSO_SERVIDOR, 0, 0);
        logger.info(inicio.toISOString())
        fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23 + FUSO_SERVIDOR, 59, 0);
        logger.info(fim.toISOString())
    } else {
        logger.info('como já passou das 14 horas vamos procurar agendamentos pendentes para amanhã')
        inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 0 + FUSO_SERVIDOR, 0, 0);
        logger.info(inicio.toISOString())
        fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 23 + FUSO_SERVIDOR, 59, 0);
        logger.info(fim.toISOString())
    }

    let execucoesAgendadas = await prisma.agendamento.findMany({
        where: {
            agendarParaDia: {
                gte: inicio,    // gte significa "maior ou igual a"
                lte: fim    // lt significa "menor que"
            },
            OR: [
                { status: statusAguardando },
                { status: statusTentando }
            ]

        }
    })
    if (execucoesAgendadas.length == 0) {
        logger.info('nenhuma tarefa de agendamento pendente encontrada')
        return
    }

    await prisma.agendamento.updateMany({
        where: {
            agendarParaDia: {
                gte: inicio,    // gte significa "maior ou igual a"
                lte: fim    // lt significa "menor que"
            },
            OR: [
                { status: statusAguardando },
                { status: statusTentando }
            ]
        },
        data: {
            statusId: statusTentando.id
        }
    })

    try {
        //faz o login para todos os usuarios configurados no .env
        await logarUsuarios(execucoesAgendadas)

        //cria uma lista de headers com a autenticação para cada usuario
        criarHeader(execucoesAgendadas)

        await agendarAlmocoDeTodos(execucoesAgendadas)
    }
    catch (erro) {
        logger.error(erro.message)
    }

}


module.exports = {
    processoAgendamentoSesc,
    processoAgendamentoSesc1430
}