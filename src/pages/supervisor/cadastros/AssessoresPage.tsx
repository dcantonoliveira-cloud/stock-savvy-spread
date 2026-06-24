import CadastroListPage from './CadastroListPage';
export default function AssessoresPage() {
  return <CadastroListPage title="Assessores" table="suppliers" typeFilter={{ column: 'type', value: 'organizer' }} namePlaceholder="Ex: Maria Assessoria..." />;
}
