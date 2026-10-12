import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Barcode, Building2,
  Check, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, CircleHelp,
  Layers3, Link2, LoaderCircle, Menu, Package, Pencil, Plus,
  RefreshCw, Search, ShieldCheck, Trash2, Unlink, X,
} from 'lucide-react';
import { request } from './api.js';

const pages = {
  produtos: { title: 'Produtos', singular: 'produto', resource: 'products', icon: Package, description: 'Seu catálogo organizado. Cada produto, no lugar certo.' },
  fornecedores: { title: 'Fornecedores', singular: 'fornecedor', resource: 'suppliers', icon: Building2, description: 'Boas parcerias começam com informações bem organizadas.' },
  associacoes: { title: 'Associações', singular: 'associação', resource: 'associations', icon: Link2, description: 'Conecte seus produtos a quem fornece cada um deles.' },
};

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatCnpj = (value) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plural = (count, singular, pluralValue = `${singular}s`) => `${count} ${count === 1 ? singular : pluralValue}`;
const getPage = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] in pages ? window.location.hash.replace(/^#\/?/, '').split('?')[0] : 'produtos';

function Modal({ title, subtitle, icon: Icon, children, onClose, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}>
      <div className="dialog-body">
        <div className="dialog-heading">
          <div className="dialog-icon"><Icon size={24} /></div>
          <button className="icon-button" aria-label="Fechar janela" onClick={onClose}><X size={20} /></button>
        </div>
        <h2 id="dialog-title">{title}</h2>
        <p className="dialog-subtitle">{subtitle}</p>
        {children}
      </div>
    </dialog>
  );
}

function Field({ label, name, error, children, ...props }) {
  const id = `field-${name}`;
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={id}>{label}<span aria-hidden="true"> *</span></label>
      {children ? children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined }) : <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />}
      {error && <span className="field-error-message" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function EntityForm({ page, item, products, suppliers, associations, onSave, onClose }) {
  const [values, setValues] = useState(() => item ?? (page === 'produtos'
    ? { name: '', description: '', price: '', barcode: '' }
    : page === 'fornecedores' ? { name: '', cnpj: '', address: '', contact: '' } : { productId: '', supplierId: '' }));
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const meta = pages[page];
  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFields((current) => ({ ...current, [name]: undefined }));
    setError('');
  };
  const fieldProps = (name) => ({ name, value: values[name] ?? '', error: fields[name], onChange: (event) => setValue(name, event.target.value), required: true });
  const availableSuppliers = suppliers.filter((supplier) => !associations.some((association) => association.productId === Number(values.productId) && association.supplierId === supplier.id));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const body = page === 'produtos'
      ? { name: values.name, description: values.description, barcode: values.barcode, price: Number(values.price) }
      : page === 'fornecedores'
        ? { name: values.name, cnpj: values.cnpj, address: values.address, contact: values.contact }
        : { productId: Number(values.productId), supplierId: Number(values.supplierId) };
    try {
      await onSave(body, item?.id);
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields ?? {});
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? `Editar ${meta.singular}` : page === 'associacoes' ? 'Nova associação' : `Novo ${meta.singular}`} subtitle={page === 'associacoes' ? 'Selecione um produto e o fornecedor que deseja vincular.' : 'Preencha os dados abaixo para manter seu cadastro atualizado.'} icon={meta.icon} onClose={() => { if (!saving) onClose(); }}>
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="form-fields">
          {page === 'produtos' && <>
            <Field label="Nome do produto" {...fieldProps('name')} maxLength={120} placeholder="Ex.: Café especial 250 g" autoFocus />
            <Field label="Descrição" name="description" error={fields.description}>{(props) => <textarea {...props} name="description" value={values.description} onChange={(event) => setValue('description', event.target.value)} required maxLength={2000} rows={3} placeholder="Descreva as principais características do produto" />}</Field>
            <div className="form-columns">
              <Field label="Preço (R$)" {...fieldProps('price')} type="number" min="0" max="9999999.99" step="0.01" placeholder="0,00" />
              <Field label="Código de barras" {...fieldProps('barcode')} maxLength={64} placeholder="Ex.: 7891234567890" />
            </div>
          </>}
          {page === 'fornecedores' && <>
            <Field label="Nome do fornecedor" {...fieldProps('name')} maxLength={120} placeholder="Ex.: Distribuidora Horizonte" autoFocus />
            <Field label="CNPJ" {...fieldProps('cnpj')} inputMode="numeric" maxLength={18} pattern="[0-9]{14}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}" placeholder="00.000.000/0000-00" />
            <Field label="Endereço" {...fieldProps('address')} maxLength={300} placeholder="Rua, número, bairro, cidade e estado" />
            <Field label="Contato" {...fieldProps('contact')} maxLength={160} placeholder="E-mail ou telefone" />
          </>}
          {page === 'associacoes' && <>
            <Field label="Produto" name="productId" error={fields.productId}>{(props) => <select {...props} name="productId" value={values.productId} required autoFocus onChange={(event) => { setValue('productId', event.target.value); setValue('supplierId', ''); }}><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.barcode}</option>)}</select>}</Field>
            <div className="connection-bridge"><span /><Link2 size={18} /><span /></div>
            <Field label="Fornecedor" name="supplierId" error={fields.supplierId}>{(props) => <select {...props} name="supplierId" value={values.supplierId} required disabled={!values.productId} onChange={(event) => setValue('supplierId', event.target.value)}><option value="">Selecione um fornecedor</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {formatCnpj(supplier.cnpj)}</option>)}</select>}</Field>
            {values.productId && !availableSuppliers.length && <div className="inline-note"><CircleAlert size={17} />Todos os fornecedores já estão associados a este produto.</div>}
            <div className="form-hint"><ShieldCheck size={18} /><p>Um produto pode ter vários fornecedores. Um fornecedor também pode oferecer vários produtos.</p></div>
          </>}
          {error && <div className="form-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
          <div className="dialog-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button button-primary" disabled={saving || (page === 'associacoes' && (!products.length || !suppliers.length))}>{saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{saving ? 'Salvando...' : page === 'associacoes' ? 'Criar associação' : 'Salvar cadastro'}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function DeleteDialog({ page, item, onDelete, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isAssociation = page === 'associacoes';
  return (
    <Modal title={isAssociation ? 'Desvincular associação?' : `Excluir ${pages[page].singular}?`} subtitle={isAssociation ? 'O produto e o fornecedor continuarão cadastrados.' : 'Esta ação é permanente. As associações deste cadastro também serão removidas.'} icon={isAssociation ? Unlink : Trash2} onClose={() => { if (!saving) onClose(); }}>
      <div className="delete-target">{isAssociation ? <><strong>{item.productName}</strong><ArrowRight size={18} /><strong>{item.supplierName}</strong></> : <strong>{item.name}</strong>}</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button className="button button-secondary" disabled={saving} onClick={onClose}>Cancelar</button>
        <button className="button button-danger" disabled={saving} onClick={async () => { setSaving(true); try { await onDelete(item.id); } catch (failure) { setError(failure.message); setSaving(false); } }}>{saving ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}{saving ? 'Removendo...' : isAssociation ? 'Desvincular' : 'Excluir cadastro'}</button>
      </div>
    </Modal>
  );
}

function MetricCard({ label, value, description, icon: Icon, accent }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${accent ?? ''}`}><Icon size={18} /></div></div><strong className="metric-value">{value}</strong><div className="metric-description"><span className="tiny-dot" />{description}</div></div>;
}

function Badge({ count, type, onClick }) {
  return <button className={`badge ${count ? 'badge-green' : 'badge-neutral'}`} onClick={onClick}>{count ? <Link2 size={13} /> : <span className="badge-dot" />}{plural(count, type, type === 'fornecedor' ? 'fornecedores' : 'produtos')}{count > 0 && <ArrowUpRight size={12} />}</button>;
}

function EmptyState({ page, filtered, onCreate, onClear }) {
  const Icon = filtered ? Search : pages[page].icon;
  return <div className="empty-state"><div className="empty-icon"><Icon size={30} /></div><h3>{filtered ? 'Nenhum resultado encontrado' : page === 'associacoes' ? 'As conexões começam aqui' : `Seu primeiro ${pages[page].singular} começa aqui`}</h3><p>{filtered ? 'Tente outro termo ou remova os filtros para ver todos os cadastros.' : page === 'associacoes' ? 'Vincule produtos e fornecedores para organizar suas parcerias.' : `Adicione um ${pages[page].singular} para começar a organizar sua operação.`}</p><button className="button button-secondary" onClick={filtered ? onClear : onCreate}>{filtered ? <X size={16} /> : <Plus size={16} />}{filtered ? 'Limpar filtros' : page === 'associacoes' ? 'Criar associação' : `Adicionar ${pages[page].singular}`}</button></div>;
}

function RelatedDialog({ page, item, products, suppliers, associations, onClose, onView }) {
  const isProduct = page === 'produtos';
  const related = isProduct
    ? suppliers.filter((supplier) => associations.some((association) => association.productId === item.id && association.supplierId === supplier.id))
    : products.filter((product) => associations.some((association) => association.supplierId === item.id && association.productId === product.id));
  const Icon = isProduct ? Building2 : Package;
  return <Modal title={isProduct ? 'Fornecedores do produto' : 'Produtos do fornecedor'} subtitle={item.name} icon={Link2} onClose={onClose}><div className="related-list">{related.length ? related.map((entity) => <div className="related-item" key={entity.id}><div className="entity-avatar"><Icon size={20} /></div><div><strong>{entity.name}</strong><span>{isProduct ? formatCnpj(entity.cnpj) : currency(entity.price)}</span></div><CheckCircle2 size={18} className="green" /></div>) : <div className="related-empty">Nenhuma associação cadastrada para este {pages[page].singular}.</div>}</div><div className="dialog-actions"><button className="button button-secondary" onClick={onClose}>Fechar</button><button className="button button-primary" onClick={onView}>Gerenciar associações<ArrowRight size={16} /></button></div></Modal>;
}

function HelpDialog({ onClose }) {
  return <Modal title="Tudo conectado, sem complicação" subtitle="Um caminho simples para organizar seus cadastros." icon={CircleHelp} onClose={onClose}><div className="help-steps">{[{ number: '01', title: 'Cadastre seus produtos', text: 'Informe nome, descrição, preço e código de barras de cada produto.' }, { number: '02', title: 'Adicione os fornecedores', text: 'Guarde nome, CNPJ, endereço e um contato para cada parceiro.' }, { number: '03', title: 'Crie suas associações', text: 'Na página Associações, vincule os produtos aos fornecedores. Você pode consultar ou desfazer esses vínculos quando precisar.' }].map((step) => <div className="help-step" key={step.number}><span>{step.number}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}</div><div className="dialog-actions"><button className="button button-primary" onClick={onClose}>Entendi<Check size={16} /></button></div></Modal>;
}

export default function App() {
  const [page, setPage] = useState(getPage);
  const [data, setData] = useState({ products: [], suppliers: [], associations: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [sort, setSort] = useState({ key: 'id', direction: 'desc' });
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const toastTimer = useRef(null);
  const { products, suppliers, associations } = data;
  const meta = pages[page];

  const reload = useCallback(async () => {
    const [nextProducts, nextSuppliers, nextAssociations] = await Promise.all([request('/products'), request('/suppliers'), request('/associations')]);
    setData({ products: nextProducts, suppliers: nextSuppliers, associations: nextAssociations });
    setLoadError('');
  }, []);

  useEffect(() => { let active = true; reload().catch((error) => { if (active) setLoadError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reload]);
  useEffect(() => {
    const onHash = () => { setPage(getPage()); setMobileMenu(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { setSearch(''); setFilter('all'); setProductFilter(''); setSupplierFilter(''); setPageNumber(1); setSort({ key: 'id', direction: 'desc' }); }, [page]);
  useEffect(() => { setPageNumber(1); }, [search, filter, productFilter, supplierFilter]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(message, warning = false) {
    clearTimeout(toastTimer.current);
    setToast({ message, warning });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  async function refresh() {
    setRefreshing(true);
    try { await reload(); } catch (error) { setLoadError(error.message); } finally { setRefreshing(false); }
  }

  function create() {
    if (loading || loadError) { notify('Atualize os cadastros antes de continuar.', true); return; }
    if (page === 'associacoes' && (!products.length || !suppliers.length)) {
      notify('Cadastre pelo menos um produto e um fornecedor antes de criar uma associação.', true);
      return;
    }
    setModal({ type: 'form', item: null });
  }

  async function afterMutation(message) {
    setModal(null);
    try {
      await reload();
      notify(message);
    } catch (error) {
      setLoadError(error.message);
      notify(`${message} Atualize a lista para visualizar a alteração.`, true);
    }
  }

  async function save(body, id) {
    await request(`/${meta.resource}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    await afterMutation(page === 'associacoes' ? 'Associação criada com sucesso.' : id ? 'Cadastro atualizado com sucesso.' : 'Cadastro criado com sucesso.');
  }

  async function remove(id) {
    await request(`/${meta.resource}/${id}`, { method: 'DELETE' });
    await afterMutation(page === 'associacoes' ? 'Associação desvinculada com sucesso.' : 'Cadastro excluído com sucesso.');
  }

  function sortBy(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  }

  function clearFilters() { setSearch(''); setFilter('all'); setProductFilter(''); setSupplierFilter(''); }

  const term = normalize(search.trim());
  const source = data[meta.resource];
  const filteredRows = source.filter((item) => {
    const searchable = page === 'produtos' ? [item.name, item.description, item.barcode]
      : page === 'fornecedores' ? [item.name, item.cnpj, formatCnpj(item.cnpj), item.address, item.contact]
        : [item.productName, item.productBarcode, item.supplierName, item.supplierCnpj, formatCnpj(item.supplierCnpj)];
    const count = page === 'produtos' ? item.supplierCount : item.productCount;
    return searchable.some((value) => normalize(value).includes(term))
      && (page === 'associacoes' || filter === 'all' || (filter === 'linked' ? count > 0 : count === 0))
      && (page !== 'associacoes' || ((!productFilter || item.productId === Number(productFilter)) && (!supplierFilter || item.supplierId === Number(supplierFilter))));
  }).sort((a, b) => {
    const first = a[sort.key];
    const second = b[sort.key];
    const result = typeof first === 'number' ? first - second : String(first).localeCompare(String(second), 'pt-BR', { sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  });

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const rows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = !!search || filter !== 'all' || !!productFilter || !!supplierFilter;
  const linkedProducts = products.filter((product) => product.supplierCount > 0).length;
  const linkedSuppliers = suppliers.filter((supplier) => supplier.productCount > 0).length;
  const linkedCount = page === 'produtos' ? linkedProducts : linkedSuppliers;
  const averagePrice = products.length ? products.reduce((sum, product) => sum + product.price, 0) / products.length : 0;

  function SortHeading({ label, field }) {
    return <button className="sort-heading" onClick={() => sortBy(field)}>{label}{sort.key === field ? sort.direction === 'asc' ? <ArrowUpRight size={13} /> : <ArrowDown size={13} /> : <ArrowDown size={12} className="sort-inactive" />}</button>;
  }

  return (
    <div className="app-shell">
      {mobileMenu && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <a href="#/produtos" className="brand" aria-label="Elo — página de produtos"><span className="brand-symbol"><Layers3 size={27} strokeWidth={1.9} /></span><span>elo<span className="brand-period">.</span></span></a>
        <div className="workspace-card"><div className="workspace-icon"><Building2 size={20} /></div><div><strong>Minha operação</strong><span>Gestão de cadastros</span></div><span className="workspace-dot" /></div>
        <div className="nav-label">ÁREA DE TRABALHO</div>
        <nav aria-label="Navegação principal">{Object.entries(pages).map(([key, value]) => {
          const Icon = value.icon;
          return <a key={key} href={`#/${key}`} className={`nav-item ${page === key ? 'nav-active' : ''}`} aria-current={page === key ? 'page' : undefined}><Icon size={20} /><span>{value.title}</span><span className="nav-count">{data[value.resource].length}</span></a>;
        })}</nav>
        <div className="sidebar-tip"><div className="tip-orbit"><Link2 size={22} /><span className="orbit-dot" /></div><strong>Conexões que fazem sentido.</strong><p>Produtos e fornecedores juntos, em uma operação mais organizada.</p><button onClick={() => setModal({ type: 'help' })}>Como funciona<ArrowUpRight size={15} /></button></div>
        <div className="sidebar-bottom"><span className="academic-mark">G</span><div><strong>Projeto Integrador</strong><span>Faculdade Gran</span></div></div>
      </aside>

      <div className="main-shell">
        <header className="topbar"><div className="breadcrumbs"><button className="icon-button menu-button" aria-label="Abrir menu" onClick={() => setMobileMenu(true)}><Menu size={22} /></button><span>Área de trabalho</span><ChevronRight size={14} /><strong>{meta.title}</strong></div><div className="topbar-right"><span className={`connection-status ${loadError ? 'status-error' : ''}`}><span />{loadError ? 'Sem conexão' : loading ? 'Conectando' : 'Conectado'}</span><span className="topbar-divider" /><button className="profile-button" aria-label="Ajuda do sistema" onClick={() => setModal({ type: 'help' })}>PI</button></div></header>

        <main className="main-content" id="main-content">
          <div className="page-heading"><div><div className="eyebrow"><span />ORGANIZAÇÃO QUE CONECTA</div><h1>{meta.title}<span className="heading-dot">.</span></h1><p>{meta.description}</p></div><button className="button button-primary new-button" onClick={create} disabled={loading || !!loadError}><Plus size={18} />{page === 'associacoes' ? 'Nova associação' : `Novo ${meta.singular}`}</button></div>

          <section className="metrics" aria-label="Resumo dos cadastros">
            <MetricCard label={page === 'produtos' ? 'Total de produtos' : page === 'fornecedores' ? 'Total de fornecedores' : 'Total de associações'} value={loading ? '—' : source.length.toString().padStart(2, '0')} description={page === 'associacoes' ? 'Conexões na sua operação' : 'Cadastros na sua operação'} icon={meta.icon} />
            <MetricCard label={page === 'produtos' ? 'Preço médio' : page === 'fornecedores' ? 'Com produtos associados' : 'Produtos conectados'} value={loading ? '—' : page === 'produtos' ? currency(averagePrice) : (page === 'fornecedores' ? linkedSuppliers : linkedProducts).toString().padStart(2, '0')} description={page === 'produtos' ? 'Média dos produtos cadastrados' : page === 'fornecedores' ? 'Fornecedores com vínculos ativos' : 'Com pelo menos um fornecedor'} icon={page === 'produtos' ? Barcode : Package} accent="metric-sand" />
            <MetricCard label={page === 'produtos' ? 'Com fornecedores' : page === 'fornecedores' ? 'Associações ativas' : 'Fornecedores conectados'} value={loading ? '—' : (page === 'produtos' ? linkedProducts : page === 'fornecedores' ? associations.length : linkedSuppliers).toString().padStart(2, '0')} description={page === 'produtos' ? 'Produtos com vínculos ativos' : page === 'fornecedores' ? 'Produtos e fornecedores conectados' : 'Com pelo menos um produto'} icon={Link2} accent="metric-blue" />
          </section>

          {loadError && <div className="error-banner" role="alert"><CircleAlert size={20} /><div><strong>Não foi possível atualizar os cadastros.</strong><p>{loadError}</p></div><button className="button button-secondary" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} />Tentar novamente</button></div>}

          <section className="catalog-card" aria-label={`Lista de ${meta.title.toLowerCase()}`}>
            <div className="catalog-heading"><div><h2>{page === 'produtos' ? 'Catálogo de produtos' : page === 'fornecedores' ? 'Sua rede de fornecedores' : 'Produtos e fornecedores'}<span className="total-badge">{source.length}</span></h2><p>{page === 'associacoes' ? 'Acompanhe os vínculos e encontre as parcerias de cada produto.' : 'Consulte e gerencie todos os seus cadastros.'}</p></div><button className="icon-button refresh-button" aria-label="Atualizar cadastros" title="Atualizar cadastros" onClick={refresh} disabled={refreshing || loading}><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button></div>
            <div className="catalog-toolbar"><div className="search-box"><Search size={18} /><input type="search" aria-label={`Buscar ${meta.title.toLowerCase()}`} placeholder={page === 'produtos' ? 'Buscar por nome ou código de barras...' : page === 'fornecedores' ? 'Buscar por nome, CNPJ ou contato...' : 'Buscar produto ou fornecedor...'} value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Limpar busca" className="clear-search" onClick={() => setSearch('')}><X size={15} /></button>}</div>{page !== 'associacoes' ? <div className="filter-tabs" aria-label="Filtrar cadastros">{[{ value: 'all', label: 'Todos', count: source.length }, { value: 'linked', label: page === 'produtos' ? 'Com fornecedor' : 'Com produtos', count: linkedCount }, { value: 'unlinked', label: page === 'produtos' ? 'Sem fornecedor' : 'Sem produtos', count: source.length - linkedCount }].map((tab) => <button key={tab.value} aria-pressed={filter === tab.value} className={filter === tab.value ? 'filter-active' : ''} onClick={() => setFilter(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}</div> : <div className="association-filters"><select aria-label="Filtrar por produto" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="">Todos os produtos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><select aria-label="Filtrar por fornecedor" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="">Todos os fornecedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>}</div>

            {loading ? <div className="loading-state" role="status"><LoaderCircle size={28} className="spin" /><p>Carregando seus cadastros...</p></div> : !rows.length ? <EmptyState page={page} filtered={hasFilters} onCreate={create} onClear={clearFilters} /> : <div className="table-scroll"><table><thead><tr>{page === 'produtos' ? <><th><SortHeading label="PRODUTO" field="name" /></th><th>CÓDIGO DE BARRAS</th><th><SortHeading label="PREÇO" field="price" /></th><th>FORNECEDORES</th></> : page === 'fornecedores' ? <><th><SortHeading label="FORNECEDOR" field="name" /></th><th>CNPJ</th><th>CONTATO</th><th>PRODUTOS</th></> : <><th><SortHeading label="PRODUTO" field="productName" /></th><th className="connection-column" /><th><SortHeading label="FORNECEDOR" field="supplierName" /></th><th>DATA DO VÍNCULO</th></>}<th className="actions-heading">AÇÕES</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}>{page === 'produtos' ? <><td><div className="entity-cell"><div className={`entity-avatar avatar-${item.id % 4}`}><Package size={21} strokeWidth={1.7} /></div><div className="entity-details"><strong>{item.name}</strong><span title={item.description}>{item.description}</span></div></div></td><td><span className="barcode-text">{item.barcode}</span></td><td className="price-cell">{currency(item.price)}</td><td><Badge count={item.supplierCount} type="fornecedor" onClick={() => setModal({ type: 'related', item })} /></td></> : page === 'fornecedores' ? <><td><div className="entity-cell"><div className={`entity-avatar avatar-${item.id % 4}`}>{item.name.trim().slice(0, 2).toUpperCase()}</div><div className="entity-details"><strong>{item.name}</strong><span title={item.address}>{item.address}</span></div></div></td><td><span className="barcode-text">{formatCnpj(item.cnpj)}</span></td><td><span className="contact-text">{item.contact}</span></td><td><Badge count={item.productCount} type="produto" onClick={() => setModal({ type: 'related', item })} /></td></> : <><td><div className="entity-cell"><div className={`entity-avatar avatar-${item.productId % 4}`}><Package size={21} strokeWidth={1.7} /></div><div className="entity-details"><strong>{item.productName}</strong><span>{item.productBarcode}</span></div></div></td><td className="connection-column"><div className="table-link"><Link2 size={17} /></div></td><td><div className="entity-cell"><div className="entity-avatar avatar-small">{item.supplierName.trim().slice(0, 2).toUpperCase()}</div><div className="entity-details"><strong>{item.supplierName}</strong><span>{formatCnpj(item.supplierCnpj)}</span></div></div></td><td><span className="date-text">{new Date(item.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span></td></>}<td><div className="row-actions">{page !== 'associacoes' && <button className="icon-button" aria-label={`Editar ${item.name}`} title="Editar cadastro" onClick={() => setModal({ type: 'form', item })}><Pencil size={16} /></button>}<button className="icon-button delete-button" aria-label={page === 'associacoes' ? `Desvincular ${item.productName} de ${item.supplierName}` : `Excluir ${item.name}`} title={page === 'associacoes' ? 'Desvincular' : 'Excluir cadastro'} onClick={() => setModal({ type: 'delete', item })}>{page === 'associacoes' ? <Unlink size={16} /> : <Trash2 size={16} />}</button></div></td></tr>)}</tbody></table></div>}

            <div className="table-footer"><span>{filteredRows.length ? <>Mostrando <strong>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)}</strong> de <strong>{filteredRows.length}</strong> {meta.title.toLowerCase()}</> : 'Nenhum cadastro para exibir'}{hasFilters && <button className="text-button" onClick={clearFilters}>Limpar filtros</button>}</span><div className="pagination"><button className="icon-button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPageNumber(currentPage - 1)}><ChevronLeft size={17} /></button><span className="page-indicator">{currentPage}</span><span className="pagination-total">de {totalPages}</span><button className="icon-button" aria-label="Próxima página" disabled={currentPage >= totalPages} onClick={() => setPageNumber(currentPage + 1)}><ChevronRight size={17} /></button></div></div>
          </section>

          <div className="connection-callout"><div className="callout-icon"><Link2 size={22} /></div><div><strong>{page === 'associacoes' ? 'Uma rede, muitas possibilidades.' : 'Tudo fica melhor quando está conectado.'}</strong><p>{page === 'associacoes' ? 'Consulte produtos e fornecedores para manter suas parcerias sempre atualizadas.' : 'Associe produtos a fornecedores e tenha uma visão completa das suas parcerias.'}</p></div>{page === 'associacoes' ? <a href="#/fornecedores">Ver fornecedores<ArrowRight size={16} /></a> : <a href="#/associacoes">Gerenciar associações<ArrowRight size={16} /></a>}</div>
          <footer className="page-footer"><span>elo. <span>Uma operação mais organizada.</span></span><span><ShieldCheck size={14} />Produtos e fornecedores em um só lugar</span></footer>
        </main>
      </div>

      {modal?.type === 'form' && <EntityForm key={`${page}-${modal.item?.id ?? 'new'}`} page={page} item={modal.item} products={products} suppliers={suppliers} associations={associations} onSave={save} onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && <DeleteDialog page={page} item={modal.item} onDelete={remove} onClose={() => setModal(null)} />}
      {modal?.type === 'related' && <RelatedDialog page={page} item={modal.item} products={products} suppliers={suppliers} associations={associations} onClose={() => setModal(null)} onView={() => { setModal(null); window.location.hash = '#/associacoes'; }} />}
      {modal?.type === 'help' && <HelpDialog onClose={() => setModal(null)} />}
      {toast && <div className={`toast ${toast.warning ? 'toast-warning' : ''}`} role="status">{toast.warning ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button aria-label="Fechar notificação" onClick={() => setToast(null)}><X size={17} /></button></div>}
    </div>
  );
}
