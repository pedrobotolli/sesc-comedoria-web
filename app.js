require('dotenv').config()
const express = require('express')
const app = express()
const axios = require('axios')
const UO_SANTOS = 78 //Santos é 78
let credenciais = JSON.parse(process.env.CREDENCIAIS)
let usuariosLogados = []
let headers = []
let execucoesAgendadas = []
const porta = process.env.PORT || 3000


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

    return login
}

async function logarTodosOsUsuarios() {
    for (usuario of credenciais.usuarios) {
        let usuarioLogado = await logar(usuario)
        usuariosLogados.push(usuarioLogado.data)
    }
}

function criarHeader() {
    for (usuarioLogado of usuariosLogados) {
        let header = {
            Authorization: `Bearer ${usuarioLogado.auth_token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
        }
        headers.push(header)
        usuarioLogado["header"] = header
    }
}


async function entrarNaFila(header) {
    const fila = await axios({
        method: 'post',
        url: 'https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/fila',
        data: {
            unidade: UO_SANTOS,
            credenciais: []
        },
        headers: header
    })
    return fila
}

async function listarHorariosDisponiveis(credencial, header) {
    const horarios = await axios({
        method: 'get',
        url: `https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/unidades-horarios?uo=${UO_SANTOS}&credenciais=${credencial}`,
        headers: header
    })
    return horarios.data.horarios
}

async function agendarAlmoco(login, horarioId) {
    const agendar = await axios({
        method: 'post',
        url: 'https://agendamentos-api.sescsp.org.br/api/agendamento-comedoria/agendar',
        data: {
            credenciais: [login.credencial],
            horarioId: horarioId
        },
        headers: login.header
    })
    return agendar
}

async function agendarAlmocoDeTodos() {
    let resultadoFila = await Promise.all(headers.map(header => entrarNaFila(header)))

    while (!resultadoFila.every((resultado => resultado.data.status == 'LIBERADO'))) {
        if(resultadoFila.some((resultado => resultado.data.status == 'ESGOTADO'))) {
            throw new Error('Vagas esgotadas!')
        }
        resultadoFila = await Promise.all(headers.map(header => entrarNaFila(header)))
    }

    let horariosApi = await listarHorariosDisponiveis(usuariosLogados[0].credencial, headers[0])
    let listaHorarios = []

    if (horariosApi.hasOwnProperty('manha')) {
        for (horario of horariosApi.manha) {
            listaHorarios.push(horario)
        }
    }
    if (horariosApi.hasOwnProperty('tarde')) {
        for (horario of horariosApi.tarde) {
            listaHorarios.push(horario)
        }
    }

    listaHorarios.reverse()

    for (horario of listaHorarios) {

        let resultadoAgendamento = await Promise.all(usuariosLogados.map(usuarioLogado => agendarAlmoco(usuarioLogado, horario.id)))

        if (resultadoAgendamento.every((resultado => resultado.status == 200))) {
            console.log(`horario agendado com sucesso!`)
            break
        }
    }
}

async function processoAgendamentoSesc(id) {

    let execucao = execucoesAgendadas.find(agendamento => agendamento.id == id)
    execucao.status = 'agendado'
    try {
        let agora = new Date()
        let milisegundosAte1428 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 14, 28, 0, 0) - agora
        if (milisegundosAte1428 > 0) {
            await new Promise(resolve => setTimeout(resolve, milisegundosAte1428))
        }
        execucao.status = 'logando'
        //faz o login para todos os usuarios configurados no .env
        await logarTodosOsUsuarios()

        //cria uma lista de headers com a autenticação para cada usuario
        criarHeader()

        execucao.status = 'esperando'
        //esperar até 17:30 UTC (14:30 de brasilia (GMT -3))
        agora = new Date()
        let milisegundosAte1430 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 14, 30, 0, 0) - agora

        //as 14:30 de brasilia executa a funcao agendarAlmocoDeTodos
        if (milisegundosAte1430 > 0) {
            await new Promise(resolve => setTimeout(resolve, milisegundosAte1430))
        }
        await agendarAlmocoDeTodos()
        execucao.status = 'sucesso'
    }
    catch (erro) {
        execucao.status = 'erro'
        console.log(erro)
    }

}

app.get('/agendamentos', (req, res) => {

    res.status(200).json({ agendamentos: [execucoesAgendadas] })

})

app.get('/agendamentos/novo', async (req, res) => {

    let instanceId = Math.floor(Math.random() * 1000000000000000)
    execucoesAgendadas.push({ id: instanceId, status: 'pendente' })
    res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: instanceId })

    await processoAgendamentoSesc(instanceId)

})

app.get('/agendamentos/status/:id', (req, res) => {

    let execucao = execucoesAgendadas.find(agendamento => agendamento.id == req.params.id)
    res.status(200).json(execucao)

})

app.get('/horario', (req, res) => {

    let agora = new Date()
    res.status(200).json({ ano: agora.getFullYear(), mes: agora.getMonth(), dia: agora.getDate(), hora: agora.getHours(), minuto: agora.getMinutes() })

})


app.listen(porta, () => console.log('Servidor executando na porta: ' + porta))


