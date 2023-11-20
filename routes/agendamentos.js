const express = require('express')
const router = express.Router()

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

router.get('/', async (req, res, next) => {
    try {
        res.status(200).json({ agendamentos: [await prisma.agendamento.findMany()] })
    }
    catch (error) {
        next(error)
    }
})

router.post('/novo', async (req, res, next) => {
    try {
        let horarioEscolhido = req.body.horario || null
        let status = await prisma.status.findUnique({ where: { status: "Aguardando" } })
        let textoDataAgendamento = req.body.dataAgendamento || null
        let agendarParaDia = null
        try {
            if (textoDataAgendamento) {
                var partesDaDataAgendamento = textoDataAgendamento.split("/")
                agendarParaDia = new Date(partesDaDataAgendamento[2], partesDaDataAgendamento[1] - 1, partesDaDataAgendamento[0])
            }
        } catch (e) {
            agendarParaDia = new Date()
        }
        let agendamento = await prisma.agendamento.create({ data: { cpf: req.body.cpf, senha: req.body.senha, agendarParaDia, agendarParaHorario: horarioEscolhido, statusId: status.id } })
        res.status(201).json({ msg: 'Nova instancia de agendamento criada', id: agendamento.id })

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
            let horarioEscolhido = usuario.horario || null
            let status = await prisma.status.findUnique({ where: { status: "Aguardando" } })
            let textoDataAgendamento = usuario.dataAgendamento || null
            let agendarParaDia = null
            try {
                if (textoDataAgendamento) {
                    var partesDaDataAgendamento = textoDataAgendamento.split("/")
                    agendarParaDia = new Date(partesDaDataAgendamento[2], partesDaDataAgendamento[1] - 1, partesDaDataAgendamento[0])
                }
            } catch (e) {
                agendarParaDia = new Date()
            }
            try {
                let agendamento = await prisma.agendamento.create({ data: { cpf: usuario.cpf, senha: usuario.senha, agendarParaDia, agendarParaHorario: horarioEscolhido, statusId: status.id } })
                idAgendamentos.push(agendamento.id)
            }
            catch (e) {
                console.log(e)
            }

        }
        res.status(201).json({ msg: 'Nova instancias de agendamento criadas', ids: idAgendamentos })

    } catch (error) {
        next(error)
    }
})

router.get('/status/:id', async (req, res, next) => {

    try {
        let execucao = await prisma.agendamentos.findUnique({ where: { id: req.params.id } })
        res.status(200).json(execucao)
    } catch (error) {
        next(error)
    }

})



module.exports = router