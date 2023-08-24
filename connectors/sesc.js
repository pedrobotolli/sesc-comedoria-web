require('dotenv').config({ path: '../.env' })
const axios = require('axios')

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


let headers = []
let execucoesAgendadas = []

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

async function logarUsuarios(credenciais, usuariosLogados) {
    for (usuario of credenciais.usuarios) {
        let usuarioLogado = await logar(usuario)
        usuariosLogados.push(usuarioLogado.data)
    }
}


function criarHeader(usuariosLogados) {
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
            console.log(erro)
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
            console.log(erro)
        }
    }

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

async function agendarAlmocoDeTodos(horarioEscolhido, usuariosLogados) {
    let resultadoFila = await Promise.all(headers.map(header => entrarNaFila(header)))
    let contadorErros = 0
    while (!resultadoFila.every((resultado => resultado.data.status == 'LIBERADO'))) {
        if(resultadoFila.some((resultado => resultado.data.status == 'ESGOTADO'))) {
            contadorErros = contadorErros + 1
            if (contadorErros <= 3) {
                await new Promise(resolve => setTimeout(resolve, 500))
            } else {
                throw new Error('Vagas esgotadas!')
            }            
        }
        resultadoFila = await Promise.all(headers.map(header => verificarStatusFila(header)))
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

    let resultadoAgendamento = null
    const itemHorarioEscolhido = listaHorarios.find(horario => horario.horarioInicio == horarioEscolhido)
    if (itemHorarioEscolhido) {
        resultadoAgendamento = await Promise.all(usuariosLogados.map(usuarioLogado => agendarAlmoco(usuarioLogado, itemHorarioEscolhido.id)))
        if (resultadoAgendamento.every((resultado => resultado.status == 200))) {
            console.log(`horario agendado com sucesso!`)
            return
        }
    }

    listaHorarios.reverse()

    for (horario of listaHorarios) {

        resultadoAgendamento = await Promise.all(usuariosLogados.map(usuarioLogado => agendarAlmoco(usuarioLogado, horario.id)))

        if (resultadoAgendamento.every((resultado => resultado.status == 200))) {
            console.log(`horario agendado com sucesso!`)
            break
        }
    }
}

async function processoAgendamentoSesc(id, credenciais, horarioEscolhido) {
    credenciais = credenciais || JSON.parse(process.env.CREDENCIAIS)
    let usuariosLogados = []

    let execucao = execucoesAgendadas.find(agendamento => agendamento.id == id)
    execucao.status = 'agendado'
    execucao.cpf = credenciais.usuarios[0].cpf || 'usuario padrao'
    execucao.horario = horarioEscolhido || 'horario padrao'
    try {
        let agora = new Date()
        let milisegundosAte1428 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 17 + FUSO_SERVIDOR, 28, 0, 0) - agora
        console.log(`milisegundos ate 14:28 = [${milisegundosAte1428}]`)
        if (milisegundosAte1428 > 0) {
            await new Promise(resolve => setTimeout(resolve, milisegundosAte1428))
        }
        execucao.status = 'logando'
        //faz o login para todos os usuarios configurados no .env
        await logarUsuarios(credenciais, usuariosLogados)

        //cria uma lista de headers com a autenticação para cada usuario
        criarHeader(usuariosLogados)

        execucao.status = 'esperando'
        //esperar até 17:30 UTC (14:30 de brasilia (GMT -3))
        agora = new Date()
        let milisegundosAte1430 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 17 + FUSO_SERVIDOR, 30, 0, 0) - agora
        console.log(agora)
        console.log(`milisegundos ate 14:30 = [${milisegundosAte1430}]`)
        //as 14:30 de brasilia executa a funcao agendarAlmocoDeTodos
        if (milisegundosAte1430 > 0) {
            await new Promise(resolve => setTimeout(resolve, milisegundosAte1430))
        }
        await agendarAlmocoDeTodos(horarioEscolhido, usuariosLogados)
        execucao.status = 'sucesso'
    }
    catch (erro) {
        execucao.status = 'erro'
        console.log(erro)
    }

}

module.exports = {
    execucoesAgendadas,
    processoAgendamentoSesc    
}