import CadastroListPage from './CadastroListPage';
export default function DecoradoresPage() {
  return <CadastroListPage title="Decoradores" table="suppliers" typeFilter={{ column: 'type', value: 'decorator' }} namePlaceholder="Ex: Flores & Arte Decorações..." />;
}
