const express = require('express')
const sesc = require('../connectors/sesc')
const router = express.Router()

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

router.get('/', (req, res, next) => {
    try {
        res.status(200).json({ agendamentos: [prisma.agendamento.findMany()] })
    }
    catch (error) {
        next(error)
    }
})

router.post('/novo', async (req, res, next) => {
    try {
        let horarioEscolhido = req.body.horario || null
        let status = prisma.status.findUnique({ where: { status: "Aguardando" } })
        let textoDataAgendamento = req.body.dataAgendamento || null
        let agendarParaDia = null
        try {
            if (textoDataAgendamento) {
                var partesDaDataAgendamento = dataString.split("/")
                agendarParaDia = new Date(partesDaDataAgendamento[2], partesDaDataAgendamento[1] - 1, partesDaDataAgendamento[0])
            }
        } catch (e) {
            agendarParaDia = new Date()
        }
        prisma.agendamento.create({ data: { cpf: req.body.cpf, senha: req.body.senha, agendarParaDia, agendarParaHorario: horarioEscolhido, status: status } })
        res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: agendamento.id })

        await sesc.processoAgendamentoSesc()
    } catch (error) {
        next(error)
    }

})

router.post('/novos', async (req, res, next) => {
    try {
        if (!req.body.usuarios)
            return res.status(400).json({ "msg": "Não foi possível encontrar a propriedade obrigatoria 'usuarios' no JSON enviado" })

        let idAgendamentos = []

        for (usuario of req.body.usuarios) {
            let horarioEscolhido = req.body.horario || null
            let status = prisma.status.findUnique({ where: { status: "Aguardando" } })
            let textoDataAgendamento = req.body.dataAgendamento || null
            let agendarParaDia = null
            try {
                if (textoDataAgendamento) {
                    var partesDaDataAgendamento = dataString.split("/")
                    agendarParaDia = new Date(partesDaDataAgendamento[2], partesDaDataAgendamento[1] - 1, partesDaDataAgendamento[0])
                }
            } catch (e) {
                agendarParaDia = new Date()
            }
            let agendamento = prisma.agendamento.create({ data: { cpf: usuario.cpf, senha: usuario.senha, agendarParaDia, agendarParaHorario: horarioEscolhido, status: status } })
            idAgendamentos.push(agendamento.id)
        }
        res.status(201).json({ msg: 'Nova instancias de agendamento criadas', ids: idAgendamentos })

        await sesc.processoAgendamentoSesc()

    } catch (error) {
        next(error)
    }
})

router.get('/status/:id', (req, res, next) => {

    try {
        let execucao = prisma.agendamentos.findUnique({where: {id: req.params.id}})
        res.status(200).json(execucao)
    } catch (error) {
        next(error)
    }

})



module.exports = router