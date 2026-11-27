export type AiMode = "tutor" | "chatbot";
export type AiResult = { text: string; source: "ai" | "fallback"; unavailable?: boolean; error?: string };

export interface AiMessage { role: "student" | "assistant"; text: string }

export async function askAI(mode: AiMode, messages: AiMessage[], context: string): Promise<AiResult> {
  const valid = messages.map((m) => ({ role: m.role === "student" ? "user" : "assistant", content: m.text })).filter((m) => m.content.trim()).slice(-20);
  if (!valid.length) return { text: "Escribe una pregunta para comenzar.", source: "fallback", unavailable: true };
  try {
    const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: mode === "chatbot" ? "chatbot" : "tutor", messages: valid, context }) });
    const data = await response.json().catch(() => null) as { text?: string; error?: string; fallback?: boolean } | null;
    if (!response.ok) {
      const error = data?.error || `El servicio de IA devolvió HTTP ${response.status}.`;
      return { text: "La IA real no está disponible. Se conserva el respaldo local y puedes solicitar apoyo a un docente.", source: "fallback", unavailable: true, error };
    }
    if (!data?.text?.trim()) {
      return { text: "La IA real no devolvió una respuesta válida. Puedes solicitar apoyo a un docente.", source: "fallback", unavailable: true, error: "La respuesta del endpoint no contiene un campo text válido." };
    }
    return { text: data.text, source: "ai" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error de red desconocido";
    return { text: "No fue posible contactar con el endpoint de IA. Puedes continuar con el respaldo local o solicitar atención humana.", source: "fallback", unavailable: true, error: `No se pudo acceder a /api/ai: ${detail}` };
  }
}
