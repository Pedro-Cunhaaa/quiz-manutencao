const express = require('express');
const app = express();

// Aumenta o limite para 50MB para suportar as imagens em Base64
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

// --- ROTAS DE LOGIN ---

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    const usuarios = lerJSON(CAMINHO_USUARIOS);
    const user = usuarios.find(u => u.login === usuario && u.senha === senha);

    if (user) {
        res.json({
            sucesso: true,
            tipo: user.tipo,
            tentativas: lerJSON(CAMINHO_HISTORICO),
            ideiasAtuais: lerJSON(CAMINHO_IDEIAS),
            listaUsuarios: usuarios,
            perguntas: user.tipo === 'user' ? lerJSON(CAMINHO_PERGUNTAS) : []
        });
    } else {
        res.json({ sucesso: false });
    }
});

// --- GESTÃO DE QUESTÕES ---

app.get('/questoes/listar', (req, res) => res.json(lerJSON(CAMINHO_PERGUNTAS)));

app.get('/questoes/listar-banco', (req, res) => res.json(lerJSON(CAMINHO_BANCO_GERAL)));

app.post('/questoes/adicionar-da-sugestao', (req, res) => {
    const { id } = req.body;
    let ideias = lerJSON(CAMINHO_IDEIAS);
    let banco = lerJSON(CAMINHO_BANCO_GERAL);
    const index = ideias.findIndex(i => i.id === id);

    if (index !== -1) {
        // Mantém todos os dados da ideia (incluindo imagem se houver)
        banco.push({ ...ideias[index], id: Date.now() });
        ideias.splice(index, 1);
        salvarJSON(CAMINHO_BANCO_GERAL, banco);
        salvarJSON(CAMINHO_IDEIAS, ideias);
        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false });
    }
});

app.post('/questoes/ativar', (req, res) => {
    let banco = lerJSON(CAMINHO_BANCO_GERAL);
    let perguntasAtivas = lerJSON(CAMINHO_PERGUNTAS);
    const questao = banco.find(q => q.id === req.body.id);

    if (questao) {
        perguntasAtivas.push(questao);
        banco = banco.filter(q => q.id !== req.body.id);
        salvarJSON(CAMINHO_PERGUNTAS, perguntasAtivas);
        salvarJSON(CAMINHO_BANCO_GERAL, banco);
        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false });
    }
});

app.post('/questoes/remover-do-quiz', (req, res) => {
    let ativas = lerJSON(CAMINHO_PERGUNTAS);
    let banco = lerJSON(CAMINHO_BANCO_GERAL);
    const questao = ativas.find(q => q.id === req.body.id);

    if (questao) {
        banco.push(questao);
        ativas = ativas.filter(q => q.id !== req.body.id);
        salvarJSON(CAMINHO_PERGUNTAS, ativas);
        salvarJSON(CAMINHO_BANCO_GERAL, banco);
        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false });
    }
});

app.post('/questoes/excluir-do-banco', (req, res) => {
    let banco = lerJSON(CAMINHO_BANCO_GERAL);
    const novoBanco = banco.filter(q => q.id !== req.body.id);
    salvarJSON(CAMINHO_BANCO_GERAL, novoBanco);
    res.json({ sucesso: true });
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
            respostaDada: resp || "N/A",
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
    const i = lerJSON(CAMINHO_IDEIAS);
    i.push({ id: Date.now(), ...req.body });
    salvarJSON(CAMINHO_IDEIAS, i);
    res.json({ sucesso: true });
});

app.post('/excluir-ideia', (req, res) => {
    let i = lerJSON(CAMINHO_IDEIAS).filter(x => x.id !== req.body.id);
    salvarJSON(CAMINHO_IDEIAS, i);
    res.json({ sucesso: true });
});

app.get('/admin/refresh-dados', (req, res) => {
    res.json({
        tentativas: lerJSON(CAMINHO_HISTORICO),
        ideiasAtuais: lerJSON(CAMINHO_IDEIAS),
        listaUsuarios: lerJSON(CAMINHO_USUARIOS)
    });
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