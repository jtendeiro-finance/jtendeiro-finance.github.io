import { useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import { useAuth } from '../store/useAuth';
import { useProfile } from '../store/useProfile';
import { useChat } from '../store/useChat';
import { useDerivedData } from '../lib/useDerivedData';
import { buildFinancialContext } from '../lib/ai/financialContext';
import { streamCfoChat, streamCfoReport, toApiMessages } from '../lib/ai/callables';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextInput } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { toast } from '../components/ui/Toast';

const SUGGESTIONS = [
  'Como está a saúde financeira da empresa?',
  'Onde posso cortar custos?',
  'Tenho dinheiro para contratar mais uma pessoa?',
  'O que devo preparar para o próximo prazo de IVA?',
];

export default function CfoPage() {
  const uid = useAuth((s) => s.user!.uid);
  const profile = useProfile((s) => s.profile)!;
  const { messages, streamingText, append, setStreaming, clear } = useChat();
  const { kpis, deadlines, forecast, alerts } = useDerivedData();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  const context = () => buildFinancialContext(profile, kpis, deadlines, alerts, forecast);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    try {
      await append(uid, userMsg);
      setStreaming('');
      abortRef.current = new AbortController();
      let acc = '';
      const final = await streamCfoChat(
        { context: context(), messages: toApiMessages([...messages, userMsg]) },
        (delta) => {
          acc += delta;
          setStreaming(acc);
        },
        abortRef.current.signal,
      );
      await append(uid, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: final || acc,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('error', (e as Error).message);
    } finally {
      setStreaming(null);
      setBusy(false);
      abortRef.current = null;
    }
  };

  const generateReport = async () => {
    setReportBusy(true);
    setReport('');
    abortRef.current = new AbortController();
    try {
      let acc = '';
      const final = await streamCfoReport(
        context(),
        (delta) => {
          acc += delta;
          setReport(acc);
        },
        abortRef.current.signal,
      );
      setReport(final || acc);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast('error', (e as Error).message);
        setReport(null);
      }
    } finally {
      setReportBusy(false);
      abortRef.current = null;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">CFO virtual</h1>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" onClick={() => void clear(uid)}>
              Limpar conversa
            </Button>
          )}
          <Button variant="secondary" onClick={() => void generateReport()} busy={reportBusy}>
            📋 Análise do CFO
          </Button>
        </div>
      </div>

      {report !== null && (
        <Card
          title="Análise do CFO"
          action={
            <button onClick={() => setReport(null)} className="text-xs text-slate-400 hover:text-slate-600">
              fechar ✕
            </button>
          }
        >
          {report === '' ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Spinner className="size-4" /> A analisar os dados da empresa…
            </div>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-brand-800">
              <Markdown>{report}</Markdown>
            </div>
          )}
        </Card>
      )}

      <Card className="flex min-h-[50vh] flex-col">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && streamingText === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="text-3xl">🤖</div>
              <p className="text-sm text-slate-600">
                Pergunte o que quiser ao seu CFO — ele conhece os números da «{profile.name}».
              </p>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 py-2">
              {messages.map((m) => (
                <li key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      m.role === 'user' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </li>
              ))}
              {streamingText !== null && (
                <li className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800">
                    {streamingText === '' ? (
                      <Spinner className="size-4" />
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <Markdown>{streamingText}</Markdown>
                      </div>
                    )}
                  </div>
                </li>
              )}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <TextInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao seu CFO…"
            disabled={busy}
          />
          {busy ? (
            <Button variant="danger" type="button" onClick={() => abortRef.current?.abort()}>
              Parar
            </Button>
          ) : (
            <Button type="submit" disabled={input.trim().length === 0}>
              Enviar
            </Button>
          )}
        </form>
      </Card>
    </div>
  );
}
