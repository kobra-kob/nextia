import { dateTime } from "@/lib/format";

type Message = {
  id: string;
  body: string;
  internal: boolean;
  createdAt: Date;
  author: { name: string; role: string };
};

/** Fil de discussion d'un ticket. `viewerIsClient` masque déjà les notes internes en amont. */
export function TicketThread({ messages, viewerIsClient }: { messages: Message[]; viewerIsClient: boolean }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const fromClient = m.author.role === "CLIENT";
        const mine = viewerIsClient ? fromClient : !fromClient;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                m.internal
                  ? "border border-dashed border-amber-300 bg-amber-50"
                  : mine
                    ? "bg-brand-600 text-white"
                    : "border border-slate-200 bg-white"
              }`}
            >
              <p className={`mb-1 text-xs ${mine && !m.internal ? "text-brand-100" : "text-slate-500"}`}>
                {m.author.name}
                {!viewerIsClient && !fromClient && " · équipe"}
                {m.internal && " · note interne"} · {dateTime(m.createdAt)}
              </p>
              <p className="whitespace-pre-line">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
