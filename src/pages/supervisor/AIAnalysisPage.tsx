import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AIAnalysisPage() {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-stock');
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAnalysis(data.analysis);
      setGeneratedAt(data.generated_at);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar análise');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Análise IA</h1>
          <p className="text-muted-foreground mt-1">Insights inteligentes sobre seu estoque</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : analysis ? <RefreshCw className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? 'Analisando...' : analysis ? 'Atualizar' : 'Gerar Análise'}
        </Button>
      </div>

      {!analysis && !loading && (
        <div className="text-center py-16">
          <Brain className="w-20 h-20 text-primary/30 mx-auto mb-4" />
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">Análise Inteligente</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            A IA vai analisar todos os seus dados de estoque, movimentações e tendências para gerar insights e recomendações personalizadas.
          </p>
          <Button size="lg" onClick={runAnalysis}>
            <Sparkles className="w-5 h-5 mr-2" /> Gerar Análise Completa
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Analisando dados do estoque com IA...</p>
        </div>
      )}

      {analysis && !loading && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Relatório de Análise
              {generatedAt && (
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  {new Date(generatedAt).toLocaleString('pt-BR')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
              {analysis.split('\n').map((line, i) => {
                if (line.match(/^#+\s/)) {
                  return <h3 key={i} className="text-lg font-display font-semibold text-foreground mt-6 mb-2">{line.replace(/^#+\s/, '')}</h3>;
                }
                if (line.match(/^(📊|🚨|📈|💡|💰|⚠️|✅|🔍)/)) {
                  return <h3 key={i} className="text-base font-display font-semibold text-foreground mt-5 mb-2">{line}</h3>;
                }
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return <p key={i} className="text-sm text-foreground ml-4 mb-1">{line}</p>;
                }
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="text-sm text-foreground mb-2">{line}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
