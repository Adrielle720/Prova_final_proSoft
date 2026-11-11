import { useCallback, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API = import.meta.env.VITE_API_URL || '/api';
const FORM_VAZIO = { emailAvaliado: '', comentarios: '', nota: 5 };

// Lê as permissões (RBAC do Auth0) de dentro do access token
function permissoesDoToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.permissions || [];
  } catch {
    return [];
  }
}

export default function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user, getAccessTokenSilently, error } = useAuth0();
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

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
      setAvaliacoes(await chamarApi('/avaliacoes'));
    } catch (e) {
      setErro(e.message);
    }
  }, [chamarApi]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessTokenSilently().then((t) => setPermissoes(permissoesDoToken(t)));
    carregar();
  }, [isAuthenticated, getAccessTokenSilently, carregar]);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setSalvando(true);
    try {
      await chamarApi('/avaliacoes', {
        method: 'POST',
        body: JSON.stringify({ ...form, nota: Number(form.nota) }),
      });
      setForm(FORM_VAZIO);
      setSucesso('Avaliação cadastrada!');
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <p className="centro">Carregando...</p>;

  if (!isAuthenticated) {
    return (
      <main className="centro">
        <h1>Sistema de Avaliações</h1>
        {error && <p className="erro">{error.message}</p>}
        <button onClick={() => loginWithRedirect()}>Entrar com Auth0</button>
      </main>
    );
  }

  const isAdmin = permissoes.includes('create:avaliacoes');

  return (
    <main>
      <header>
        <h1>Sistema de Avaliações</h1>
        <div>
          <span>
            {user.email} <small>({isAdmin ? 'ADMIN' : 'USER'})</small>
          </span>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Sair</button>
        </div>
      </header>

      {isAdmin && (
        <section>
          <h2>Nova avaliação</h2>
          <form onSubmit={salvar}>
            <label>
              E-mail do avaliado
              <input
                type="email"
                required
                value={form.emailAvaliado}
                onChange={(e) => setForm({ ...form, emailAvaliado: e.target.value })}
              />
            </label>
            <label>
              Nota (0 a 10)
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                required
                value={form.nota}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
              />
            </label>
            <label>
              Comentários
              <textarea
                rows="3"
                value={form.comentarios}
                onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
              />
            </label>
            <button disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar'}</button>
          </form>
        </section>
      )}

      {erro && <p className="erro">{erro}</p>}
      {sucesso && <p className="sucesso">{sucesso}</p>}

      <section>
        <h2>Avaliações</h2>
        {avaliacoes.length === 0 ? (
          <p>Nenhuma avaliação cadastrada.</p>
        ) : (
          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Avaliador</th>
                  <th>Avaliado</th>
                  <th>Nota</th>
                  <th>Comentários</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {avaliacoes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.emailAvaliador}</td>
                    <td>{a.emailAvaliado}</td>
                    <td>{a.nota}</td>
                    <td>{a.comentarios}</td>
                    <td>{new Date(a.dataAvaliacao).toLocaleString('pt-BR')}</td>
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
