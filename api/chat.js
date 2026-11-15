export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { text, mode } = req.body;

    const stylePrompts = {
      story: "Объясняй через яркие, смешные жизненные ассоциации и образы, которые невозможно забыть.",
      logic: "Объясняй максимально четко, структурно, с опорой на факты, даты и причинно-следственные связи.",
      game: "Объясняй как сюжет, квест или механику из популярной видеоигры (ресурсы, крафт, боссы, уровни)."
    };

    const systemPrompt = `Ты — умный ИИ-тренер MindSnap для школьников. Разбери присланный текст или тему так, чтобы ученик запомнил её за 3 минуты и сдал на 5.
Стиль объяснения: ${stylePrompts[mode] || stylePrompts.story}
Отвечай СТРОГО в формате чистого JSON без какого-либо лишнего текста до или после скобок:
{
  "summary": "Суть темы простыми словами за 30 секунд (3-4 живых предложения)",
  "anchors": ["Пункт плана ответа 1", "Пункт плана ответа 2", "Пункт плана ответа 3"],
  "question": "Один хитрый проверочный вопрос от учителя на понимание",
  "options": [
    {"text": "Правильный вариант ответа", "correct": true},
    {"text": "Правдоподобный, но неверный вариант 1", "correct": false},
    {"text": "Правдоподобный, но неверный вариант 2", "correct": false}
  ]
}`;

    const models = [
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "openrouter/free"
    ];

    let parsedData = null;
    let lastError = "Нет ответа от моделей";

    for (const model of models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vercel.app",
            "X-Title": "MindSnap AI"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
            ],
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (data.error) {
          lastError = data.error.message || JSON.stringify(data.error);
          continue;
        }

        const raw = data.choices?.at(0)?.message?.content || "";
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          parsedData = JSON.parse(raw.slice(start, end + 1));
          if (parsedData && parsedData.summary) break;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!parsedData) {
      return res.status(502).json({ error: lastError });
    }

    return res.status(200).json(parsedData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
