const express = require('express');
const fs = require('fs');
const app = express();

// Aumente o limite para 50MB para suportar as imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Configuração de Caminhos
const CAMINHO_USUARIOS = './usuarios.json';
const CAMINHO_HISTORICO = './historico.json';
const CAMINHO_IDEIAS = './ideias.json';
const CAMINHO_PERGUNTAS = './perguntas.json';
const CAMINHO_BANCO_GERAL = './banco_geral.json';

// Funções Auxiliares
const lerJSON = (caminho) => {
    try {
        if (!fs.existsSync(caminho)) fs.writeFileSync(caminho, '[]');
        const conteudo = fs.readFileSync(caminho, 'utf8');
        return conteudo ? JSON.parse(conteudo) : [];
    } catch (err) {
        return [];
    }
};

const salvarJSON = (caminho, dado) => {
    fs.writeFileSync(caminho, JSON.stringify(dado, null, 2));
};

// ROTA DE LOGIN CORRIGIDA
app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    const usuarios = JSON.parse(fs.readFileSync('./usuarios.json', 'utf8'));
    
    // Procura o usuário ignorando maiúsculas/minúsculas
    const user = usuarios.find(u => u.login.toLowerCase() === usuario.toLowerCase() && u.senha === senha);

    if (user) {
        const perguntas = JSON.parse(fs.readFileSync('./perguntas.json', 'utf8'));
        const ideias = JSON.parse(fs.readFileSync('./ideias.json', 'utf8'));
        const historico = JSON.parse(fs.readFileSync('./historico.json', 'utf8'));

        res.json({
            sucesso: true,
            tipo: user.tipo,
            perguntas: user.tipo === 'user' ? perguntas : [],
            ideiasAtuais: ideias,
            tentativas: historico,
            listaUsuarios: usuarios
        });
    } else {
        res.status(401).json({ sucesso: false, mensagem: "Usuário ou senha inválidos" });
    }
});

// --- GESTÃO DE QUESTÕES ---

app.get('/questoes/listar', (req, res) => res.json(lerJSON(CAMINHO_PERGUNTAS)));

app.get('/questoes/listar-banco', (req, res) => res.json(lerJSON(CAMINHO_BANCO_GERAL)));

app.post('/questoes/adicionar-da-sugestao', (req, res) => {
    try {
        const idProcurado = Number(req.body.id);
        let ideias = lerJSON(CAMINHO_IDEIAS);
        let banco = lerJSON(CAMINHO_BANCO_GERAL);
        
        const index = ideias.findIndex(i => Number(i.id) === idProcurado);

        if (index !== -1) {
            // Pegamos o objeto completo (que já contém a imagem do Mateus)
            const novaQuestao = ideias[index];
            
            // Opcional: atualizar o ID para o momento da aprovação
            novaQuestao.id = Date.now();

            banco.push(novaQuestao); 
            ideias.splice(index, 1);
            
            salvarJSON(CAMINHO_BANCO_GERAL, banco);
            salvarJSON(CAMINHO_IDEIAS, ideias);
            res.json({ sucesso: true });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Sugestão não encontrada." });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

app.post('/questoes/ativar', (req, res) => {
    try {
        let banco = lerJSON(CAMINHO_BANCO_GERAL);
        let perguntasAtivas = lerJSON(CAMINHO_PERGUNTAS);
        
        // Garantimos que o ID seja tratado como número para a comparação
        const idProcurado = Number(req.body.id);
        const questao = banco.find(q => Number(q.id) === idProcurado);

        if (questao) {
            perguntasAtivas.push(questao);
            const novoBanco = banco.filter(q => Number(q.id) !== idProcurado);
            
            salvarJSON(CAMINHO_PERGUNTAS, perguntasAtivas);
            salvarJSON(CAMINHO_BANCO_GERAL, novoBanco);
            res.json({ sucesso: true });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Questão não encontrada no banco." });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

app.post('/questoes/remover-do-quiz', (req, res) => {
    try {
        let ativas = lerJSON(CAMINHO_PERGUNTAS);
        let banco = lerJSON(CAMINHO_BANCO_GERAL);
        
        // Convertemos ambos para Number para garantir que a comparação funcione
        const idProcurado = Number(req.body.id);
        const questao = ativas.find(q => Number(q.id) === idProcurado);

        if (questao) {
            // Adiciona ao banco
            banco.push(questao);
            
            // Remove das ativas
            const novasAtivas = ativas.filter(q => Number(q.id) !== idProcurado);
            
            salvarJSON(CAMINHO_PERGUNTAS, novasAtivas);
            salvarJSON(CAMINHO_BANCO_GERAL, banco);
            
            res.json({ sucesso: true });
        } else {
            res.status(404).json({ sucesso: false, mensagem: "Questão não encontrada nas ativas." });
        }
    } catch (err) {
        console.error("Erro ao mover questão:", err);
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Rota para excluir questão do Banco Geral
app.post('/questoes/excluir-do-banco', (req, res) => {
    const { id } = req.body;
    try {
        let banco = JSON.parse(fs.readFileSync('./banco_geral.json', 'utf8'));
        
        // Filtra removendo a questão com o ID correspondente
        // Usamos Number(id) para garantir a comparação correta
        const novoBanco = banco.filter(q => Number(q.id) !== Number(id));
        
        fs.writeFileSync('./banco_geral.json', JSON.stringify(novoBanco, null, 2));
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// --- USUÁRIOS E RELATÓRIOS ---

app.post('/usuarios/adicionar', (req, res) => {
    const u = lerJSON(CAMINHO_USUARIOS);
    u.push(req.body);
    salvarJSON(CAMINHO_USUARIOS, u);
    res.json({ sucesso: true, lista: u });
});

app.post('/usuarios/editar', (req, res) => {
    let u = lerJSON(CAMINHO_USUARIOS);
    const { index, novoLogin, novaSenha, novoTipo } = req.body;
    if (u[index]) {
        u[index] = { login: novoLogin, senha: novaSenha, tipo: novoTipo };
        salvarJSON(CAMINHO_USUARIOS, u);
    }
    res.json({ sucesso: true, lista: u });
});

app.post('/usuarios/excluir', (req, res) => {
    let u = lerJSON(CAMINHO_USUARIOS);
    u.splice(req.body.index, 1);
    salvarJSON(CAMINHO_USUARIOS, u);
    res.json({ sucesso: true, lista: u });
});

app.post('/validar', (req, res) => {
    const { usuario, respostas } = req.body;
    const banco = lerJSON(CAMINHO_PERGUNTAS);
    let acertos = 0;

    let detalhes = banco.map(p => {
        const resp = respostas[p.id];
        const ok = String(resp) === String(p.correta);
        if (ok) acertos++;
        return {
            pergunta: p.pergunta,
            imagem: p.imagem, // ADICIONADO: Salva a imagem no relatório
            respostaDada: resp || "N/A",
            correta: p.correta, // ADICIONADO: Para comparar no relatório
            status: ok
        };
    });

    const hist = lerJSON(CAMINHO_HISTORICO);
    hist.push({
        nome: usuario,
        nota: `${acertos}/${banco.length}`,
        data: new Date().toLocaleString('pt-BR'),
        detalhes
    });

    salvarJSON(CAMINHO_HISTORICO, hist);
    res.json({ sucesso: true });
});

app.post('/remover-relatorio', (req, res) => {
    let h = lerJSON(CAMINHO_HISTORICO);
    h.splice(req.body.indexOriginal, 1);
    salvarJSON(CAMINHO_HISTORICO, h);
    res.json({ sucesso: true });
});

// --- SUGESTÕES (IDEIAS) ---

app.post('/salvar-ideia', (req, res) => {
    const ideias = lerJSON(CAMINHO_IDEIAS);
    
    // O req.body já traz a pergunta, opcoes, correta E a imagem (Base64)
    ideias.push({ 
        id: Date.now(), 
        ...req.body 
    });
    
    salvarJSON(CAMINHO_IDEIAS, ideias);
    res.json({ sucesso: true });
});

app.post('/excluir-ideia', (req, res) => {
    let i = lerJSON(CAMINHO_IDEIAS).filter(x => x.id !== req.body.id);
    salvarJSON(CAMINHO_IDEIAS, i);
    res.json({ sucesso: true });
});

app.get('/admin/refresh-dados', (req, res) => {
    try {
        // Função auxiliar interna para evitar repetição de código e tratar erros de leitura
        const lerArquivoSafe = (caminho) => {
            try {
                if (!fs.existsSync(caminho)) return [];
                const conteudo = fs.readFileSync(caminho, 'utf8');
                return JSON.parse(conteudo || '[]');
            } catch (e) {
                console.error(`Erro ao ler ${caminho}:`, e);
                return [];
            }
        };

        // Retorna todos os dados sincronizados
        res.json({
            tentativas: lerArquivoSafe('./historico.json'),
            ideiasAtuais: lerArquivoSafe('./ideias.json'),
            listaUsuarios: lerArquivoSafe('./usuarios.json'),
            bancoGeral: lerArquivoSafe('./banco_geral.json'),
            perguntasQuiz: lerArquivoSafe('./perguntas.json')
        });
    } catch (err) {
        console.error("Erro crítico na rota refresh-dados:", err);
        res.status(500).json({ erro: "Erro interno ao processar sincronização" });
    }
});

// Permite que o administrador/manutenção crie questões diretamente no banco ativo
app.post('/questoes/adicionar', (req, res) => {
    try {
        let perguntasAtivas = lerJSON(CAMINHO_PERGUNTAS);
        
        // O payload enviado pelo front já contém pergunta, imagem, opcoes e correta
        const novaQuestao = {
            ...req.body,
            id: req.body.id || Date.now()
        };

        perguntasAtivas.push(novaQuestao);
        salvarJSON(CAMINHO_PERGUNTAS, perguntasAtivas);
        
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---

const PORT = 3000;

// Para rodar localmente
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

/* PARA PRODUÇÃO (MÁQUINA DEDICADA NA CTA):
Substitua o trecho acima por:

const IP_SERVIDOR = '0.0.0.0';
app.listen(PORT, IP_SERVIDOR, () => {
    console.log(`Servidor rodando em http://SEU_IP_AQUI:${PORT}`);
});
*/