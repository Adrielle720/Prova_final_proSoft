import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API = import.meta.env.VITE_API_URL || '/api';
const FORM_VAZIO = { projeto: '', titulo: '', descricao: '', prioridade: 'media' };
const ROTULO_PRIORIDADE = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

export default function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user, getAccessTokenSilently, error } = useAuth0();
  const [tarefas, setTarefas] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(null);

  // Toda chamada leva o access token do Auth0 no header Authorization
  const chamarApi = useCallback(
    async (path, options = {}) => {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro || `Erro ${res.status}`);
      return corpo;
    },
    [getAccessTokenSilently]
  );

  const carregar = useCallback(async () => {
    try {
      setTarefas(await chamarApi('/tarefa'));
    } catch (e) {
      setErro(e.message);
    }
  }, [chamarApi]);

  useEffect(() => {
    if (isAuthenticated) carregar();
  }, [isAuthenticated, carregar]);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setSalvando(true);
    try {
      await chamarApi('/tarefa', {
        method: 'POST',
        body: JSON.stringify({ ...form, projeto: form.projeto.trim() || 'Geral' }),
      });
      setForm(FORM_VAZIO);
      setSucesso('Tarefa criada!');
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function deletar(tarefa) {
    if (!window.confirm(`Deletar a tarefa "${tarefa.titulo}"?`)) return;
    setErro('');
    setSucesso('');
    setDeletando(tarefa.id);
    try {
      await chamarApi(`/tarefa?id=${tarefa.id}`, { method: 'DELETE' });
      setSucesso('Tarefa deletada!');
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setDeletando(null);
    }
  }

  if (isLoading) return <p className="centro">Carregando...</p>;

  if (!isAuthenticated) {
    return (
      <main className="centro">
        <h1>Gerenciador de Tarefas</h1>
        {error && <p className="erro">{error.message}</p>}
        <button onClick={() => loginWithRedirect()}>Entrar com Auth0</button>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Gerenciador de Tarefas</h1>
        <div>
          <span>{user.email}</span>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Sair</button>
        </div>
      </header>

      <section>
        <h2>Nova tarefa</h2>
        <form onSubmit={criar}>
          <label>
            Projeto
            <input
              placeholder="Geral"
              value={form.projeto}
              onChange={(e) => setForm({ ...form, projeto: e.target.value })}
            />
          </label>
          <label>
            Título
            <input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label>
            Descrição
            <textarea
              rows="3"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </label>
          <label>
            Prioridade
            <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <button disabled={salvando}>{salvando ? 'Salvando...' : 'Criar tarefa'}</button>
        </form>
      </section>

      {erro && <p className="erro">{erro}</p>}
      {sucesso && <p className="sucesso">{sucesso}</p>}

      <section>
        <h2>Tarefas</h2>
        {tarefas.length === 0 ? (
          <p>Nenhuma tarefa cadastrada.</p>
        ) : (
          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Projeto</th>
                  <th>Título</th>
                  <th>Descrição</th>
                  <th>Prioridade</th>
                  <th>Criada por</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.projeto}</td>
                    <td>{t.titulo}</td>
                    <td>{t.descricao}</td>
                    <td>
                      <span className={`prioridade ${t.prioridade}`}>{ROTULO_PRIORIDADE[t.prioridade]}</span>
                    </td>
                    <td>{t.email}</td>
                    <td>{new Date(t.criada_em).toLocaleString('pt-BR')}</td>
                    <td>
                      <button className="perigo" disabled={deletando === t.id} onClick={() => deletar(t)}>
                        {deletando === t.id ? '...' : 'Deletar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
